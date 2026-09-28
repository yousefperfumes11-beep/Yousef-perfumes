/* ═══════════════════════════════════════════════════════════════════
   004 — الهوية، الصلاحيات، وRLS
   ═══════════════════════════════════════════════════════════════════
   القرار 1 = «مطابقة»: الصلاحيات هنا هي نفسها المعمول بها في
   الواجهة اليوم (data.js:292-298). لا تشديد على البائع ولا إخفاء
   للتكلفة أو الربح. ما يُفرض فعليًا هنا هو ما طلبه البرومت §4.4:
     · لا كتابة مباشرة على sales / sale_items / stock_movements /
       customer_payments — كلها عبر دوال security definer.
     · القراءة للمصادَقين النشطين فقط.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────── دوال الهوية ─────────── */

create or replace function public.current_profile()
returns public.profiles
language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() $$;

/** مطابقة لـ store.js:217 — المدير يتجاوز كل الفحوص */
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select p.role = 'مدير' from public.profiles p
                   where p.id = auth.uid()), false);
$$;

/** القراءة كلها مشروطة بحساب نشط */
create or replace function public.is_active_profile()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select p.active from public.profiles p
                   where p.id = auth.uid()), false);
$$;

/**
 * مطابقة تامة لمنطق HS.store.can(perm):
 *   غير مصادق → false · مدير → true · حساب موقوف → false · وإلا وجودها في المصفوفة
 */
create or replace function public.has_perm(perm text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select case
             when p.role = 'مدير'      then true
             when p.active is not true then false
             else perm = any (p.permissions)
           end
    from public.profiles p where p.id = auth.uid()
  ), false);
$$;

/* لا تُنفَّذ كتابة إلا بهوية حقيقية */
create or replace function public.require_actor()
returns uuid
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'NO_SESSION: الجلسة منتهية، سجّل الدخول من جديد';
  end if;
  if not public.is_active_profile() then
    raise exception 'INACTIVE: هذا الحساب موقوف، راجع مدير النظام';
  end if;
  return auth.uid();
end $$;

/* ─────────── تفعيل RLS على كل جدول ─────────── */
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('spatial_ref_sys')
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

/* ─────────── سياسات القراءة: مصادَق نشط فقط ─────────── */
do $$
declare t text;
    readable text[] := array[
      'categories','brands','products','stock_movements',
      'customers','sales','sale_items','customer_payments','expenses',
      'cash_entries','suppliers','purchases','purchase_items','supplier_payments',
      'settings','permissions','role_permissions'
    ];
begin
  foreach t in array readable loop
    execute format('drop policy if exists "%s_select" on public.%I', t, t);
    execute format(
      'create policy "%s_select" on public.%I for select to authenticated
         using (public.is_active_profile())', t, t);
  end loop;
end $$;

/* ─────────── العروض المشتقة: تفرض RLS على جداولها الأساسية ───────────
   بلا security_invoker ينفّذ العرض صلاحيات مالكه فيتجاوز RLS — ثغرة صامتة.
   يتطلب Postgres 15+ (وSupabase عليه). */
alter view public.product_stock    set (security_invoker = true);
alter view public.products_live    set (security_invoker = true);
alter view public.customer_balances set (security_invoker = true);
grant select on public.product_stock, public.products_live, public.customer_balances to authenticated;

/* profiles: كل مصادَق نشط يقرأ زملاءه (كما في صفحة المستخدمون اليوم)،
   ويعدّل تفضيلاته الشخصية فقط */
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (public.is_active_profile());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

/* ─────────── سياسات الكتابة ───────────
   الجداول المالية/المخزنية الحساسة بلا سياسات كتابة إطلاقًا:
     sales, sale_items, stock_movements, customer_payments
   → كل الكتابة عبر دوال security definer في 005–008. */

/* المنتجات: من يملك products_edit (اليوم: المدير والبائع ومشرف المخزن) */
drop policy if exists "products_write" on public.products;
create policy "products_write" on public.products
  for insert to authenticated with check (public.has_perm('products_edit'));
drop policy if exists "products_update" on public.products;
create policy "products_update" on public.products
  for update to authenticated using (public.has_perm('products_edit'))
  with check (public.has_perm('products_edit'));
/* الحذف النهائي للمدير وحده — الحذف المعتاد تليين عبر active=false */
drop policy if exists "products_delete" on public.products;
create policy "products_delete" on public.products
  for delete to authenticated using (public.is_admin());

/* العملاء: customers_edit — غير معرّفة لأي دور، فتمرّ للمدير فقط (القرار 3) */
drop policy if exists "customers_write" on public.customers;
create policy "customers_write" on public.customers
  for insert to authenticated with check (public.has_perm('customers_edit'));
drop policy if exists "customers_update" on public.customers;
create policy "customers_update" on public.customers
  for update to authenticated using (public.has_perm('customers_edit'))
  with check (public.has_perm('customers_edit'));
drop policy if exists "customers_delete" on public.customers;
create policy "customers_delete" on public.customers
  for delete to authenticated using (public.is_admin());

/* المصروفات: expenses_manage (الكتابة المباشرة مسموحة كما اليوم) */
drop policy if exists "expenses_write" on public.expenses;
create policy "expenses_write" on public.expenses
  for insert to authenticated with check (public.has_perm('expenses_manage'));
drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses
  for update to authenticated using (public.has_perm('expenses_manage'))
  with check (public.has_perm('expenses_manage'));

/* القيود النقدية اليدوية: cash_manage */
drop policy if exists "cash_entries_write" on public.cash_entries;
create policy "cash_entries_write" on public.cash_entries
  for insert to authenticated with check (public.has_perm('cash_manage'));
drop policy if exists "cash_entries_update" on public.cash_entries;
create policy "cash_entries_update" on public.cash_entries
  for update to authenticated using (public.has_perm('cash_manage'))
  with check (public.has_perm('cash_manage'));

/* الموردون والمشتريات ودفعات الموردين: purchases_manage */
do $$
declare t text;
begin
  foreach t in array array['suppliers','purchases','purchase_items','supplier_payments'] loop
    execute format('drop policy if exists "%s_write" on public.%I', t, t);
    execute format(
      'create policy "%s_write" on public.%I for insert to authenticated
         with check (public.has_perm(''purchases_manage''))', t, t);
    execute format('drop policy if exists "%s_update" on public.%I', t, t);
    execute format(
      'create policy "%s_update" on public.%I for update to authenticated
         using (public.has_perm(''purchases_manage''))
         with check (public.has_perm(''purchases_manage''))', t, t);
    execute format('drop policy if exists "%s_delete" on public.%I', t, t);
    execute format(
      'create policy "%s_delete" on public.%I for delete to authenticated
         using (public.is_admin())', t, t);
  end loop;
end $$;

/* الإعدادات: settings_manage */
drop policy if exists "settings_update" on public.settings;
create policy "settings_update" on public.settings
  for update to authenticated using (public.has_perm('settings_manage'))
  with check (public.has_perm('settings_manage'));
drop policy if exists "settings_insert" on public.settings;
create policy "settings_insert" on public.settings
  for insert to authenticated with check (public.has_perm('settings_manage'));

/* المرجعيات: المدير وحده */
do $$
declare t text;
begin
  foreach t in array array['categories','brands','permissions','role_permissions'] loop
    execute format('drop policy if exists "%s_admin_all" on public.%I', t, t);
    execute format(
      'create policy "%s_admin_all" on public.%I for all to authenticated
         using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

/* التدقيق: القراءة للمدير، والكتابة عبر الدوال (security definer) فقط */
drop policy if exists "audit_select" on public.audit_log;
create policy "audit_select" on public.audit_log
  for select to authenticated using (public.is_admin());

/* ─────────── صلاحيات SQL للأدوار ───────────
   في Supabase هذه تُمنح تلقائيًا؛ نوثّقها هنا للاختبار المحلي. */
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
/* الكتابة المباشرة ممنوحة حيث توجد سياسة RLS تقابلها — أي أن المنع
   يمرّ بطبقتين: صلاحية SQL ثم سياسة RLS.
   المُستثناة عمدًا (كتابة عبر الدوال وحدها): sales, sale_items,
   stock_movements, customer_payments, audit_log. */
grant insert, update, delete on
  products, customers, expenses, cash_entries, suppliers, purchases,
  purchase_items, supplier_payments, settings, profiles,
  categories, brands, permissions, role_permissions
  to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;

/* ─────────── تدقيق تلقائي على العمليات الحساسة ─────────── */
create or replace function public.audit_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (auth.uid(), tg_op, tg_table_name,
          coalesce((case when tg_op = 'INSERT' then new.id else old.id end)::text, null),
          case when tg_op = 'DELETE' then to_jsonb(old) else null end,
          case when tg_op = 'INSERT' then null else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

drop trigger if exists products_audit on public.products;
create trigger products_audit after update of cost, price, active or delete
  on public.products for each row execute function public.audit_write();

drop trigger if exists settings_audit on public.settings;
create trigger settings_audit after update on public.settings
  for each row execute function public.audit_write();

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit after update of role, permissions, active or delete
  on public.profiles for each row execute function public.audit_write();

drop trigger if exists cash_entries_audit on public.cash_entries;
create trigger cash_entries_audit after insert or update or delete
  on public.cash_entries for each row execute function public.audit_write();

/* ─────────── حاجز تصعيد الصلاحيات ───────────
   سياسة profiles تسمح لصاحب الحساب بتعديل صفّه — وهذا وحده يكفي
   لأن يكتب بائع role='مدير' أو permissions={...} في صفّه عبر devtools
   ويرث كل الصلاحيات. الاكتشاف جاء من اختبار 30_rls_matrix.
   الحاجز: من لا يملك users_manage يلمس بياناته الشخصية وتفضيلاته فقط،
   والحقول الحاكمة تُثبَّت على قيمها القديمة مهما أرسل العميل. */
create or replace function public.protect_profile_escalation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.has_perm('users_manage') then
    return new;                     /* المدير: كما في صفحة المستخدمون اليوم */
  end if;
  new.role        := old.role;
  new.permissions := old.permissions;
  new.active      := old.active;
  new.username    := old.username;
  new.status_note := old.status_note;
  return new;
end $$;

drop trigger if exists trg_protect_profile on public.profiles;
create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_escalation();
