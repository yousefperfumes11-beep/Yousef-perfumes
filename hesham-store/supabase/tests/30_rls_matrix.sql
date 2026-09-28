/* ═══════════════════════════════════════════════════════════════════
   30_rls_matrix.sql — مصفوفة الصلاحيات الفعلية على مستوى القاعدة
   ═══════════════════════════════════════════════════════════════════
   مطلب البرومت: «لا يستطيع البائع تجاوز الصلاحيات حتى عبر devtools».
   يُختبر هنا بدور authenticated الحقيقي (لا المالك) لكل دور × كل جدول
   × insert/update/delete/select.

   التوقّع **لا يُكتب يدويًا** بل يُشتق من role_permissions نفسها،
   فيصير الاختبار مطابقةً حية بين صلاحيات الكود وسياسات القاعدة.

   طبقتا المنع:
     1) صلاحية SQL (GRANT) — الجداول المالية بلا grant إطلاقًا
     2) سياسة RLS — تُصفّي صفوف UPDATE/DELETE بصمت (بلا خطأ)
   وكلاهما يُرصد هنا.
   ═══════════════════════════════════════════════════════════════════ */

\set ON_ERROR_STOP on
set client_min_messages = notice;

/* ─────────── مرجعيات ثابتة للاختبار ─────────── */
/* صفوف مرجعية تكفي المصفوفة وحدها (لا تعتمد على نتيجة ملف سابق) */
insert into public.expenses (category, amount, method, note)
values ('other', 1, 'cash', 'مرجع اختبار المصفوفة');
insert into public.cash_entries (direction, amount, reason, kind)
values ('in', 1, 'مرجع اختبار المصفوفة', 'deposit');

drop table if exists tests.refs;
create table tests.refs as
select
  (select id from public.products where sku = 'YP9001')      as product_id,
  (select id from public.customers where phone = '0913345566') as customer_id,
  (select id from public.sales limit 1)                      as sale_id,
  (select id from public.cash_entries where kind <> 'opening' limit 1) as entry_id,
  (select id from public.expenses limit 1)                   as expense_id,
  (select id from public.suppliers limit 1)                  as supplier_id,
  (select id from public.purchases limit 1)                  as purchase_id;

/* دفعة مورد مرجعية (سيناريو المشتريات قد لا يكون قد جرى) */
insert into public.supplier_payments (supplier_id, purchase_id, amount, method, note)
select (select supplier_id from tests.refs), (select purchase_id from tests.refs), 1, 'cash',
       'مرجع اختبار المصفوفة'
where (select supplier_id from tests.refs) is not null;

/* إن لم توجد فاتورة (تشغيل المصفوفة منفردة) نُنشئ واحدة عبر الدالة الرسمية */
do $$
declare r record; v_sid uuid;
begin
  select * into r from tests.refs;
  if r.sale_id is null then
    perform set_config('app.uid','11111111-1111-1111-1111-111111111111', false);
    select (public.create_sale(jsonb_build_object('items', jsonb_build_array(
        jsonb_build_object('productId', r.product_id, 'qty', 1)),
        'method','cash')) -> 'sale' ->> 'id')::uuid into v_sid;
    update tests.refs set sale_id = v_sid;
  end if;
end $$;

grant select on tests.refs to authenticated;

/* صف قابل للتلف لكل محاولة حذف: يُنشأ ثم يُحذف داخل المعاملة الفرعية نفسها */
drop table if exists tests.tmp_id;
create table tests.tmp_id (id text);
grant all on tests.tmp_id to authenticated;

/* ─────────── منفّذ عملية مع إلغاء أثرها ───────────
   ينفّذ العبارة، يقرأ عدد الصفوف، ثم يُلغي كل أثر برفع استثناء
   داخلي يُلتقط في المستوى نفسه (subtransaction rollback). */
drop function if exists tests.try_op(text);
create or replace function tests.try_op(p_sql text, p_setup text default null)
returns text language plpgsql as $$
declare n int := 0; res text;
begin
  begin
    delete from tests.tmp_id;
    if p_setup is not null then
      execute p_setup;                       /* يهيّئ الصف المستهدف — ويُلغى معه */
    end if;
    execute p_sql;
    get diagnostics n = row_count;
    res := case when n > 0 then 'allowed' else 'denied-rls' end;
    raise exception 'ROLLBACK_MARKER' using errcode = 'ZZ001';
  exception
    when sqlstate 'ZZ001' then null;                        /* إلغاء مقصود */
    when insufficient_privilege then res := 'denied-grant';
    when others then
      if SQLERRM like '%row-level security%' then res := 'denied-rls';
      elsif SQLSTATE = '42501' then res := 'denied-grant';
      else res := 'error: ' || SQLERRM; end if;
  end;
  return res;
end $$;
grant execute on function tests.try_op(text, text) to authenticated;

/* ─────────── جدول المصفوفة ───────────
   perm      = الصلاحية الحاكمة للإدراج والتعديل (null → المدير وحده)
   del_rule  = 'admin' الحذف النهائي للمدير · 'none' الجدول غير قابل للحذف
   locked    = جدول مقفول: الكتابة عبر الدوال وحدها (بلا GRANT ولا سياسة)
   sel_rule  = 'admin_rows' القراءة تُصفّى للمدير وحده
   ins_sql   = null → لا يُختبر الإدراج (جدول أحادي الصف)
   كل عبارة حذف تُنشئ صفًا قابلًا للتلف ثم تحذفه في عبارة واحدة (CTE)،
   حتى لا يقيس الاختبار قيود التكامل المرجعي بدل سياسات الصلاحية. */
drop table if exists tests.matrix_def;
create table tests.matrix_def (
  tbl      text primary key,
  perm     text,
  locked   boolean not null default false,
  del_rule text not null default 'admin',
  sel_rule text,
  pk_col   text default 'id',   /* null → عبارتا التحضير والحذف مكتوبتان يدويًا */
  ins_sql  text,
  upd_sql  text,
  del_setup text,
  del_sql  text
);

insert into tests.matrix_def (tbl, perm, locked, del_rule, sel_rule, ins_sql, upd_sql, del_sql) values
 /* ── مقفولة: لا GRANT ولا سياسة كتابة ── */
 ('sales', null, true, 'admin', null,
  $s$ insert into public.sales (number, status, payment_method, subtotal, total, customer_name)
      values ('RLS-TEST-' || floor(random()*1e9)::int::text,'paid','cash',1,1,'اختبار') returning 1 $s$,
  $s$ update public.sales set note = 'اختبار'
      where id = (select sale_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.sales (number, status, payment_method, subtotal, total, customer_name)
      values ('RLS-DEL-' || floor(random()*1e9)::int::text,'paid','cash',1,1,'اختبار') returning id)
      delete from public.sales where id = (select id from x) returning 1 $s$),

 ('sale_items', null, true, 'admin', null,
  $s$ insert into public.sale_items (sale_id, product_id, name_snapshot, qty, unit_price, line_total)
      values ((select sale_id from tests.refs), (select product_id from tests.refs), 'اختبار', 1, 1, 1) returning 1 $s$,
  $s$ update public.sale_items set qty = qty
      where sale_id = (select sale_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.sale_items (sale_id, product_id, name_snapshot, qty, unit_price, line_total)
      values ((select sale_id from tests.refs), (select product_id from tests.refs), 'اختبار', 1, 1, 1) returning id)
      delete from public.sale_items where id = (select id from x) returning 1 $s$),

 ('stock_movements', null, true, 'admin', null,
  $s$ insert into public.stock_movements (product_id, type, qty, reason)
      values ((select product_id from tests.refs), 'in', 1, 'اختبار') returning 1 $s$,
  $s$ update public.stock_movements set reason = 'اختبار'
      where product_id = (select product_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.stock_movements (product_id, type, qty, reason)
      values ((select product_id from tests.refs), 'in', 1, 'اختبار') returning id)
      delete from public.stock_movements where id = (select id from x) returning 1 $s$),

 ('customer_payments', null, true, 'admin', null,
  $s$ insert into public.customer_payments (customer_id, amount, method)
      values ((select customer_id from tests.refs), 1, 'cash') returning 1 $s$,
  $s$ update public.customer_payments set note = 'اختبار'
      where customer_id = (select customer_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.customer_payments (customer_id, amount, method)
      values ((select customer_id from tests.refs), 1, 'cash') returning id)
      delete from public.customer_payments where id = (select id from x) returning 1 $s$),

 ('audit_log', null, true, 'admin', 'admin_rows',
  $s$ insert into public.audit_log (action, entity) values ('rls_test','tests') returning 1 $s$,
  $s$ update public.audit_log set action = action returning 1 $s$,
  $s$ with x as (insert into public.audit_log (action, entity) values ('rls_test','tests') returning id)
      delete from public.audit_log where id = (select id from x) returning 1 $s$),

 /* ── مفتوحة بصلاحية ── */
 ('products', 'products_edit', false, 'admin', null,
  $s$ insert into public.products (sku, barcode, name, cost, price, opening)
      values ('RLS-' || floor(random()*1e9)::int::text, '99' || lpad(floor(random()*1e9)::int::text, 11, '0'),
              'صنف اختبار RLS', 1, 2, 0) returning 1 $s$,
  $s$ update public.products set price = price
      where id = (select product_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.products (sku, barcode, name, cost, price, opening)
      values ('RLSD-' || floor(random()*1e9)::int::text, '98' || lpad(floor(random()*1e9)::int::text, 11, '0'),
              'صنف حذف RLS', 1, 2, 0) returning id)
      delete from public.products where id = (select id from x) returning 1 $s$),

 ('customers', 'customers_edit', false, 'admin', null,
  $s$ insert into public.customers (name, phone)
      values ('عميل اختبار RLS', '09' || lpad(floor(random()*1e7)::int::text, 8, '0')) returning 1 $s$,
  $s$ update public.customers set city = city
      where id = (select customer_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.customers (name, phone)
      values ('عميل حذف RLS', '08' || lpad(floor(random()*1e7)::int::text, 8, '0')) returning id)
      delete from public.customers where id = (select id from x) returning 1 $s$),

 ('expenses', 'expenses_manage', false, 'none', null,
  $s$ insert into public.expenses (category, amount, method) values ('other', 1, 'cash') returning 1 $s$,
  $s$ update public.expenses set note = note returning 1 $s$,
  $s$ with x as (insert into public.expenses (category, amount, method) values ('other', 1, 'cash') returning id)
      delete from public.expenses where id = (select id from x) returning 1 $s$),

 /* السجلات المالية غير قابلة للحذف النهائي: التراجع تليين (deleted_at) */
 ('cash_entries', 'cash_manage', false, 'none', null,
  $s$ insert into public.cash_entries (direction, amount, reason, kind)
      values ('in', 1, 'اختبار RLS', 'deposit') returning 1 $s$,
  $s$ update public.cash_entries set reason = reason
      where id = (select entry_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.cash_entries (direction, amount, reason, kind)
      values ('in', 1, 'اختبار حذف RLS', 'deposit') returning id)
      delete from public.cash_entries where id = (select id from x) returning 1 $s$),

 ('suppliers', 'purchases_manage', false, 'admin', null,
  $s$ insert into public.suppliers (name) values ('مورد اختبار RLS ' || floor(random()*1e6)::int::text) returning 1 $s$,
  $s$ update public.suppliers set name = name
      where id = (select supplier_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.suppliers (name)
      values ('مورد حذف RLS ' || floor(random()*1e6)::int::text) returning id)
      delete from public.suppliers where id = (select id from x) returning 1 $s$),

 ('purchases', 'purchases_manage', false, 'admin', null,
  $s$ insert into public.purchases (number, supplier_id, supplier_name, status, order_date, total, paid)
      values ('PO-RLS-' || floor(random()*1e9)::int::text, (select supplier_id from tests.refs),
              'اختبار','draft', current_date, 0, 0) returning 1 $s$,
  $s$ update public.purchases set note = 'اختبار'
      where id = (select purchase_id from tests.refs) returning 1 $s$,
  $s$ with x as (insert into public.purchases (number, supplier_id, supplier_name, status, order_date, total, paid)
      values ('PO-RLSD-' || floor(random()*1e9)::int::text, (select supplier_id from tests.refs),
              'اختبار','draft', current_date, 0, 0) returning id)
      delete from public.purchases where id = (select id from x) returning 1 $s$),

 ('purchase_items', 'purchases_manage', false, 'admin', null,
  $s$ insert into public.purchase_items (purchase_id, product_id, name_snapshot, qty, unit_cost)
      values ((select purchase_id from tests.refs),(select product_id from tests.refs),'اختبار',1,1) returning 1 $s$,
  $s$ update public.purchase_items set qty = qty
      where purchase_id = (select purchase_id from tests.refs) returning 1 $s$,
  $s$ with p as (insert into public.purchases (number, supplier_name, status, order_date, total, paid)
                   values ('PO-RLSD-' || floor(random()*1e9)::int::text,'اختبار','draft',current_date,0,0) returning id),
           x as (insert into public.purchase_items (purchase_id, product_id, name_snapshot, qty, unit_cost)
                   values ((select id from p),(select product_id from tests.refs),'اختبار',1,1) returning id)
      delete from public.purchase_items where id = (select id from x) returning 1 $s$),

 ('supplier_payments', 'purchases_manage', false, 'admin', null,
  $s$ insert into public.supplier_payments (supplier_id, purchase_id, amount, method)
      values ((select supplier_id from tests.refs), (select purchase_id from tests.refs), 1, 'cash') returning 1 $s$,
  $s$ update public.supplier_payments set note = note returning 1 $s$,
  $s$ with x as (insert into public.supplier_payments (supplier_id, purchase_id, amount, method)
      values ((select supplier_id from tests.refs), (select purchase_id from tests.refs), 1, 'cash') returning id)
      delete from public.supplier_payments where id = (select id from x) returning 1 $s$),

 /* الإعدادات: صف واحد (قيد id = 1) فلا يُختبر الإدراج */
 ('settings', 'settings_manage', false, 'none', null, null,
  $s$ update public.settings set updated_at = now() where id = 1 returning 1 $s$,
  $s$ delete from public.settings where id = 1 returning 1 $s$),

 /* ── مرجعيات: المدير وحده ── */
 ('categories', null, false, 'admin', null,
  $s$ insert into public.categories (id, name)
      values ('rls-' || floor(random()*1e6)::int::text, 'قسم اختبار') returning 1 $s$,
  $s$ update public.categories set name = name returning 1 $s$,
  $s$ with x as (insert into public.categories (id, name)
      values ('rlsd-' || floor(random()*1e6)::int::text, 'قسم حذف') returning id)
      delete from public.categories where id = (select id from x) returning 1 $s$),

 ('brands', null, false, 'admin', null,
  $s$ insert into public.brands (name) values ('RLSBRAND' || floor(random()*1e6)::int::text) returning 1 $s$,
  $s$ update public.brands set name = name returning 1 $s$,
  $s$ with x as (insert into public.brands (name)
      values ('RLSDELBRAND' || floor(random()*1e6)::int::text) returning id)
      delete from public.brands where id = (select id from x) returning 1 $s$),

 ('role_permissions', null, false, 'admin', null,
  $s$ insert into public.role_permissions (role, permission_id) values ('بائع','users_manage') returning 1 $s$,
  $s$ update public.role_permissions set role = role returning 1 $s$,
  $s$ delete from public.role_permissions where role = 'بائع' and permission_id = 'users_manage' returning 1 $s$);


/* ─────────── اشتقاق عبارات الحذف ───────────
   القTE لا ترى صفوفها الخاصة في المسح الرئيسي (لقطة واحدة للعبارة كلها)،
   لذا يُنشأ الصف المستهدف في عبارة مستقلة داخل المعاملة الفرعية نفسها. */
update tests.matrix_def
   set del_setup = 'with ins as ('
                   || regexp_replace(ins_sql, '\s*returning\s+1\s*$', '', 'i')
                   || ' returning ' || pk_col || ') '
                   || 'insert into tests.tmp_id (id) select (' || pk_col || ')::text from ins',
       del_sql   = 'delete from public.' || tbl
                   || ' where (' || pk_col || ')::text = (select id from tests.tmp_id limit 1) returning 1'
 where pk_col is not null and ins_sql is not null;

/* brands مفتاحها name لا id */
update tests.matrix_def
   set pk_col    = 'name',
       del_setup = 'with ins as ('
                   || regexp_replace(ins_sql, '\s*returning\s+1\s*$', '', 'i')
                   || ' returning name) '
                   || 'insert into tests.tmp_id (id) select name::text from ins',
       del_sql   = 'delete from public.brands where name::text = (select id from tests.tmp_id limit 1) returning 1'
 where tbl = 'brands';


/* استثناءات الاشتقاق: */
/* · الإعدادات صف واحد (قيد id = 1) فلا يُحضَّر له صف */
update tests.matrix_def set pk_col = null, del_setup = null where tbl = 'settings';
/* · صلاحيات الأدوار مفتاحها مركّب (role, permission_id) */
update tests.matrix_def
   set pk_col = null,
       del_setup = $s$ with ins as (insert into public.role_permissions (role, permission_id)
                values ('بائع','users_manage') returning role, permission_id)
        insert into tests.tmp_id (id) select role::text || '|' || permission_id from ins $s$,
       del_sql   = $s$ delete from public.role_permissions
       where role::text || '|' || permission_id = (select id from tests.tmp_id limit 1) returning 1 $s$
 where tbl = 'role_permissions';

grant select on tests.matrix_def to authenticated;

/* ─────────── تنفيذ المصفوفة ─────────── */
do $$
declare
  m record; act record; got text; want text; v_uid text; n int;
  actors text[] := array[
    '11111111-1111-1111-1111-111111111111',   -- مدير
    '22222222-2222-2222-2222-222222222222',   -- بائع
    '33333333-3333-3333-3333-333333333333',   -- مشرف مخزن
    '44444444-4444-4444-4444-444444444444'    -- محاسب
  ];
  summary text := '';
begin
  set role authenticated;

  foreach v_uid in array actors loop
    perform set_config('app.uid', v_uid, false);
    select * into act from public.profiles where id = v_uid::uuid;

    for m in select * from tests.matrix_def order by locked desc, tbl loop
      /* ── الكتابة: مقفولة دائمًا، أو بحسب الصلاحية الحاكمة ── */
      if m.locked then
        want := 'denied';
      elsif m.perm is null then
        want := case when public.is_admin() then 'allowed' else 'denied' end;
      else
        want := case when public.has_perm(m.perm) then 'allowed' else 'denied' end;
      end if;

      if m.ins_sql is not null then
        got := tests.try_op(m.ins_sql);
        perform public.test_assert(
          act.role::text || ' · إدراج في ' || m.tbl,
          (want = 'allowed' and got = 'allowed') or (want = 'denied' and got like 'denied%'),
          'المتوقع ' || coalesce(m.perm, 'المدير فقط') || ' → ' || want || ' · الواقع ' || got);
      end if;

      got := tests.try_op(m.upd_sql);
      perform public.test_assert(
        act.role::text || ' · تعديل ' || m.tbl,
        (want = 'allowed' and got = 'allowed') or (want = 'denied' and got like 'denied%'),
        'المتوقع ' || coalesce(m.perm, 'المدير فقط') || ' → ' || want || ' · الواقع ' || got);

      /* الحذف: المقفول مرفوض · غير القابل للحذف مرفوض · غيره للمدير وحده */
      if m.locked or m.del_rule = 'none' then want := 'denied'; else
        want := case when public.is_admin() then 'allowed' else 'denied' end;
      end if;
      got := tests.try_op(m.del_sql, m.del_setup);
      perform public.test_assert(
        act.role::text || ' · حذف من ' || m.tbl,
        (want = 'allowed' and got = 'allowed') or (want = 'denied' and got like 'denied%'),
        'المتوقع ' || want || ' · الواقع ' || got);

      /* ── القراءة: RLS تُصفّي الصفوف ولا تُفشل العبارة، فيُقاس عدد المرئي ── */
      begin
        execute format('select count(*) from public.%I', m.tbl) into n;
        got := 'query-ok';
      exception when others then got := 'denied'; n := -1;
      end;
      if m.sel_rule = 'admin_rows' then
        want := case when public.is_admin() then 'rows' else 'empty' end;
      else
        want := 'rows';
      end if;
      perform public.test_assert(act.role::text || ' · قراءة ' || m.tbl,
        (want = 'rows'  and got = 'query-ok' and n > 0) or
        (want = 'empty' and got = 'query-ok' and n = 0),
        'المتوقع ' || want || ' · الواقع ' || got || ' بـ ' || n || ' صفًا');
    end loop;
  end loop;

  reset role;
end $$;

/* ─────────── صفوف إضافية لا تدخل المصفوفة العامة ─────────── */
do $$
declare n int;
begin
  set role authenticated;

  /* ملف شخصي: يعدّل صاحبه فقط، ولا يمسّ ملف غيره ولا يرفع دوره */
  perform set_config('app.uid','22222222-2222-2222-2222-222222222222', false);
  update public.profiles set phone = '0910000000'
   where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform public.test_assert('بائع: يعدّل ملفه الشخصي', n = 1, n || ' صف');

  update public.profiles set phone = '0910000001'
   where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  perform public.test_assert('بائع: لا يعدّل ملف المدير', n = 0, n || ' صف');

  /* محاولة تصعيد: يغيّر دوره وصلاحياته في صفّه هو — وهو ما تتيحه له سياسة profiles */
  update public.profiles
     set role = 'مدير'::public.user_role,
         permissions = array['users_manage','settings_manage','sales_refund'],
         phone = '0910000002'
   where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  perform public.test_assert('بائع: حاجز التصعيد يُثبّت الدور',
    n = 1 and (select role::text from public.profiles
               where id='22222222-2222-2222-2222-222222222222') = 'بائع',
    n || ' صف · الدور بقي ' ||
    (select role::text from public.profiles where id='22222222-2222-2222-2222-222222222222'));
  perform public.test_assert('بائع: حاجز التصعيد يُثبّت الصلاحيات',
    not (select 'users_manage' = any(permissions) from public.profiles
         where id='22222222-2222-2222-2222-222222222222')
    and not (select 'settings_manage' = any(permissions) from public.profiles
         where id='22222222-2222-2222-2222-222222222222'),
    (select array_length(permissions,1)::text || ' صلاحية كما هي' from public.profiles
      where id='22222222-2222-2222-2222-222222222222'));
  perform public.test_assert('بائع: بياناته الشخصية تُحفظ فعلًا (لا منع مطلق)',
    (select phone from public.profiles
      where id='22222222-2222-2222-2222-222222222222') = '0910000002');
  perform public.test_assert('بائع: لا يوقف حسابه ولا حساب غيره',
    (select active from public.profiles where id='22222222-2222-2222-2222-222222222222'));

  /* العروض المشتقة: تخضع لـ RLS جداولها (security_invoker) */
  perform public.test_assert('بائع: يقرأ الأرصدة المشتقة',
    (select count(*) from public.product_stock) >= 0
    and (select count(*) from public.customer_balances) >= 0
    and (select count(*) from public.products_live) >= 0);

  /* الموقوف: لا يقرأ شيئًا */
  perform set_config('app.uid','55555555-5555-5555-5555-555555555555', false);
  select count(*) into n from public.products;
  perform public.test_assert('حساب موقوف: لا يرى المنتجات', n = 0, n || ' صف');
  select count(*) into n from public.sales;
  perform public.test_assert('حساب موقوف: لا يرى الفواتير', n = 0, n || ' صف');

  /* بلا جلسة */
  perform set_config('app.uid','', false);
  select count(*) into n from public.products;
  perform public.test_assert('بلا جلسة: لا يرى المنتجات', n = 0, n || ' صف');

  /* دور anon: لا صلاحية SQL أصلًا على الجداول */
  reset role;
end $$;

/* ─────────── خلاصة المصفوفة ─────────── */
\echo ''
\echo '── خلاصة المصفوفة ──'
select
  split_part(name, ' · ', 1)                          as "الدور",
  split_part(split_part(name, ' · ', 2), ' ', 2)      as "الجدول",
  count(*) filter (where kind = 'pass')               as "نجح",
  count(*) filter (where kind = 'fail')               as "فشل"
from tests.log
where name like '% · %'
group by 1, 2
order by 1, 2;
