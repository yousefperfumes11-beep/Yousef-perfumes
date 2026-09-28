/* ═══════════════════════════════════════════════════════════════════
   10_seed_fixture.sql — بيانات الاختبار + أدوات التقرير
   ═══════════════════════════════════════════════════════════════════
   للاختبار المحلي فقط. يُنشئ أربعة مستخدمين بأدوارهم الحقيقية
   (مدير/بائع/مشرف مخزن/محاسب) وثلاثة أصناف بأرقام معلومة، حتى تكون
   كل نتيجة متوقعة حسابيًا لا تقديرية.
   ═══════════════════════════════════════════════════════════════════ */

\set ON_ERROR_STOP on
set client_min_messages = warning;

/* ─────────── أدوات التقرير ───────────
   في مخطّط tests لا public: هجرة 004 تفعّل RLS على كل جدول في public،
   وجدول النتائج ليس جزءًا من التطبيق فلا ينبغي أن يخضع لسياساتها. */
drop schema if exists tests cascade;
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create table tests.log (
  id      serial primary key,
  kind    text not null check (kind in ('pass','fail','info')),
  name    text not null,
  extra   text
);

create or replace function public.test_assert(p_name text, p_cond boolean, p_extra text default null)
returns void language plpgsql as $$
begin
  insert into tests.log (kind, name, extra)
  values (case when p_cond then 'pass' else 'fail' end, p_name, p_extra);
  if p_cond then raise notice '  ✓ % %', p_name, coalesce(' — ' || p_extra, '');
  else            raise notice '  ✗ % %', p_name, coalesce(' — ' || p_extra, '');
  end if;
end $$;

create or replace function public.test_info(p_name text, p_extra text default null)
returns void language plpgsql as $$
begin
  insert into tests.log (kind, name, extra) values ('info', p_name, p_extra);
  raise notice '  · % %', p_name, coalesce(' — ' || p_extra, '');
end $$;

/** يؤكد أن عبارة ما رُفضت، ويسجّل سبب الرفض العربي */
create or replace function public.test_expect_fail(p_name text, p_sql text)
returns void language plpgsql as $$
declare v_msg text; v_ok boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    v_ok := true; v_msg := SQLERRM;
  end;
  insert into tests.log (kind, name, extra)
  values (case when v_ok then 'pass' else 'fail' end, p_name,
          coalesce(v_msg, 'لم يُرفض — وهذا خلل'));
  if v_ok then raise notice '  ✓ % — رُفض: %', p_name, left(v_msg, 90);
  else            raise notice '  ✗ % — لم يُرفض!', p_name;
  end if;
end $$;

/* ─────────── هويات الاختبار ───────────
   تُضبط هوية المدير أولًا: حاجز التصعيد (004) يجمّد الدور والصلاحيات
   لأي تحديث لا يجريه من يملك users_manage — حتى في إعادة تهيئة الاختبار. */
select set_config('app.uid','11111111-1111-1111-1111-111111111111', false);

do $$
declare
  u_admin  uuid := '11111111-1111-1111-1111-111111111111';
  u_seller uuid := '22222222-2222-2222-2222-222222222222';
  u_store  uuid := '33333333-3333-3333-3333-333333333333';
  u_acc    uuid := '44444444-4444-4444-4444-444444444444';
  u_off    uuid := '55555555-5555-5555-5555-555555555555';
begin
  insert into auth.users (id, email, email_confirmed_at) values
    (u_admin,  'youssef@youssef.local', now()),
    (u_seller, 'moataz@youssef.local',  now()),
    (u_store,  'storekeeper@youssef.local', now()),
    (u_acc,    'accountant@youssef.local',  now()),
    (u_off,    'off@youssef.local', now())
  on conflict (id) do nothing;

  insert into public.profiles (id, username, full_name, role, permissions, status_note, active)
  select u_admin, 'youssef', 'يوسف كريفة', 'مدير'::public.user_role,
         array(select id from public.permissions), 'صاحب المحل', true
  union all
  select u_seller, 'moataz', 'معتز بن ناصر', 'بائع',
         (select array_agg(permission_id) from public.role_permissions where role = 'بائع'),
         'دوام صباحي', true
  union all
  select u_store, 'storekeeper', 'مشرف المخزن', 'مشرف مخزن',
         (select array_agg(permission_id) from public.role_permissions where role = 'مشرف مخزن'),
         'دوام صباحي', true
  union all
  select u_acc, 'accountant', 'محاسب المحل', 'محاسب',
         (select array_agg(permission_id) from public.role_permissions where role = 'محاسب'),
         'دوام مسائي', true
  union all
  select u_off, 'stopped', 'حساب موقوف', 'بائع',
         (select array_agg(permission_id) from public.role_permissions where role = 'بائع'),
         'موقوف', false
  on conflict (id) do update set
    role = excluded.role, permissions = excluded.permissions, active = excluded.active;
end $$;

/* ─────────── الأقسام والمرجات ─────────── */
insert into public.categories (id, name, emoji, sort) values
  ('men',  'عطور رجالية', '🧔', 1),
  ('oud',  'عطور شرقية وعود', '🪵', 4)
on conflict (id) do nothing;

insert into public.brands (name, prefix, country) values
  ('Dior', '3125', 'فرنسا'), ('Lattafa', '6292', 'الإمارات')
on conflict (name) do nothing;

/* ─────────── مورد وأمر شراء ─────────── */
insert into public.suppliers (id, name, contact, city, focus, rating, terms_days, active)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'شركة الياسمين للعطور', 'عبدالرحمن', 'طرابلس', 'men', 4.6, 30, true)
on conflict (id) do nothing;

/* ─────────── الأصناف: أرقام معلومة حتى يكون كل توقع حسابيًا ───────────
   A: تكلفة 100 · سعر 150 · رصيد 5  (هامش 50)
   B: تكلفة 200 · سعر 320 · رصيد 1  (للاختبار التزامن — آخر وحدة)
   C: تكلفة  40 · سعر  75 · رصيد 0  (نافد — لاختبار الرفض)
   D: موقوف   · رصيد 9              (ل اختبار رفض الصنف الموقوف)
   E: خاضع للضريبة · رصيد 3         (ل اختبار معادلة الضريبة) */
insert into public.products (id, sku, barcode, name, brand, category_id, size_label, size_num,
                             unit, cost, price, opening, min_stock, supplier_id, taxable, active)
values
 ('bbbbbbbb-0000-0000-0000-00000000000a','YP9001','3125000000017','عطر الاختبار أ','Dior','men','100 مل',100,'عبوة',100,150,5,2,'aaaaaaaa-0000-0000-0000-000000000001',false,true),
 ('bbbbbbbb-0000-0000-0000-00000000000b','YP9002','3125000000024','عطر الاختبار ب','Lattafa','oud','50 مل',50,'عبوة',200,320,1,1,'aaaaaaaa-0000-0000-0000-000000000001',false,true),
 ('bbbbbbbb-0000-0000-0000-00000000000c','YP9003','3125000000031','عطر الاختبار ج','Dior','men','30 مل',30,'عبوة',40,75,0,2,'aaaaaaaa-0000-0000-0000-000000000001',false,true),
 ('bbbbbbbb-0000-0000-0000-00000000000d','YP9004','3125000000048','عطر الاختبار د','Dior','men','75 مل',75,'عبوة',60,110,9,2,'aaaaaaaa-0000-0000-0000-000000000001',false,false),
 ('bbbbbbbb-0000-0000-0000-00000000000e','YP9005','3125000000055','عطر الاختبار هـ','Lattafa','oud','200 مل',200,'عبوة',90,140,3,1,'aaaaaaaa-0000-0000-0000-000000000001',true,true)
on conflict (id) do update set
  cost = excluded.cost, price = excluded.price, opening = excluded.opening,
  active = excluded.active, taxable = excluded.taxable;

/* حركات المخزون: الأرصدة مشتقة منها، فلا بدّ من قيد افتتاحي لكل صنف */
delete from public.stock_movements;
insert into public.stock_movements (product_id, type, qty, reason, ref_type, ref_id, actor_id, created_at)
select p.id, 'in', p.opening, 'رصيد افتتاحي', 'init', 'INIT',
       '11111111-1111-1111-1111-111111111111', now() - interval '30 days'
from public.products p where p.opening > 0;

/* ─────────── العملاء ─────────── */
insert into public.customers (id, name, phone, city, account_type, credit_limit, active)
values ('cccccccc-0000-0000-0000-000000000001','سالم المبروك','0913345566','طرابلس','دين',5000,true),
       ('cccccccc-0000-0000-0000-000000000002','نجوى العقوري','0944129670','تاجوراء','نقدي',0,true)
on conflict (id) do update set account_type = excluded.account_type, credit_limit = excluded.credit_limit;

/* ─────────── تصفير ما قد يلوّث النتائج ─────────── */
/* الترتيب يتبع القيود المرجعية: الولد قبل الأب */
delete from public.supplier_payments;
delete from public.purchase_items;
delete from public.purchases;
delete from public.customer_payments;
delete from public.sale_items;
delete from public.sales;
delete from public.expenses;
delete from public.cash_entries;
delete from public.audit_log;
select setval('public.sale_number_seq', 1, false);

/* الرصيد الافتتاحي 2500 بتاريخ أقدم من كل العمليات — كما في data.js */
select public.set_opening_cash(2500);
update public.cash_entries set created_at = now() - interval '31 days' where kind = 'opening';

/* أمر شراء مسودة للاختبار الاستلام */
insert into public.purchases (id, number, supplier_id, supplier_name, status, order_date, expected_date, total, paid)
values ('dddddddd-0000-0000-0000-000000000001','PO-2026-901','aaaaaaaa-0000-0000-0000-000000000001',
        'شركة الياسمين للعطور','draft',current_date - 3, current_date + 7, 500, 0);
insert into public.purchase_items (purchase_id, product_id, name_snapshot, qty, unit_cost)
values ('dddddddd-0000-0000-0000-000000000001','bbbbbbbb-0000-0000-0000-00000000000c','عطر الاختبار ج · 30 مل',5,40);

select public.test_info('تم تجهيز بيئة الاختبار',
  (select count(*)::text || ' مستخدم، ' from public.profiles) ||
  (select count(*)::text || ' صنف، رصيد افتتاحي ' from public.products) ||
  (select expected::text from public.cash_summary('-infinity','infinity')) || ' د.ل');

/* صلاحيات أدوات التقرير لدور العميل الحقيقي — تُختبر السيناريوهات بدور authenticated */
grant select, insert, update, delete on tests.log to authenticated;
grant usage, select on sequence tests.log_id_seq to authenticated;
grant execute on function public.test_assert(text, boolean, text) to authenticated;
grant execute on function public.test_info(text, text) to authenticated;
grant execute on function public.test_expect_fail(text, text) to authenticated;
