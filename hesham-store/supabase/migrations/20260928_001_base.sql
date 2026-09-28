/* ═══════════════════════════════════════════════════════════════════
   001 — الأساس: الامتدادات، الأنواع العددية، ودوال الصلاحيات
   المشروع: يوسف للعطور
   المطابقة: data.js (PERMISSIONS, ROLE_PERMS, PAY_METHODS) وstore.js (can)

   ملاحظة: القرار 1 = «مطابقة». الأدوار والصلاحيات هنا هي نفسها
   المعمول بها في الواجهة اليوم، لا تشديد ولا تخفيف.
   ═══════════════════════════════════════════════════════════════════ */

create extension if not exists pgcrypto;   /* gen_random_uuid() */

/* ── الأنواع العددية ── */
do $$ begin
  create type public.sale_status   as enum ('paid','partial','unpaid','returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.pay_method    as enum ('cash','card','credit');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.movement_type as enum ('in','out','adjust','return');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.po_status     as enum ('draft','shipping','received','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.user_role     as enum ('مدير','بائع','مشرف مخزن','محاسب');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cash_direction as enum ('in','out');
exception when duplicate_object then null; end $$;

/* ── قائمة الصلاحيات الأربع عشرة (مطابقة لـ data.js:273-288) ── */
create table if not exists public.permissions (
  id    text primary key,
  name  text not null,
  sort  int  not null default 0
);

insert into public.permissions (id, name, sort) values
  ('view_dashboard',   'عرض الصفحة الرئيسية',        1),
  ('pos_sell',         'إتمام عمليات البيع',          2),
  ('pos_discount',     'منح خصم على الفاتورة',        3),
  ('sales_refund',     'تعديل وإلغاء العمليات',       4),
  ('products_edit',    'تعديل المنتجات والأسعار',     5),
  ('inventory_adjust', 'تعديل أرصدة المخزون',         6),
  ('cash_manage',      'الإيداع والسحب من الصندوق',   7),
  ('debts_manage',     'تسجيل الديون والدفعات',       8),
  ('expenses_manage',  'تسجيل المصروفات',             9),
  ('purchases_manage', 'إدارة المشتريات',            10),
  ('reports_view',     'عرض التقارير',               11),
  ('reports_export',   'تصدير التقارير',             12),
  ('settings_manage',  'إدارة إعدادات النظام',        13),
  ('users_manage',     'إدارة المستخدمين',            14),
  /* مستعملة في customers.js:38,260 لكنها غير معرّفة في data.js —
    Decision 3 = مطابقة: تبقى حكرًا على المدير لأن can() تتجاوز له فقط */
  ('customers_edit',   'تعديل بيانات العملاء',        15)
on conflict (id) do update set name = excluded.name, sort = excluded.sort;

/* ── صلاحيات كل دور (مطابقة لـ data.js:292-298) ── */
create table if not exists public.role_permissions (
  role          public.user_role not null,
  permission_id text not null references public.permissions(id) on delete cascade,
  primary key (role, permission_id)
);

delete from public.role_permissions;
insert into public.role_permissions (role, permission_id)
select r.role::public.user_role, x.perm
from (values
  ('مدير', (select array_agg(id) from public.permissions)),
  ('بائع', array[
    'view_dashboard','pos_sell','pos_discount','products_edit','inventory_adjust',
    'debts_manage','expenses_manage','cash_manage','reports_view']),
  ('مشرف مخزن', array[
    'view_dashboard','products_edit','inventory_adjust','purchases_manage',
    'reports_view','reports_export']),
  ('محاسب', array[
    'view_dashboard','sales_refund','expenses_manage','cash_manage',
    'debts_manage','reports_view','reports_export'])
) as r(role, perms)
cross join lateral unnest(r.perms) as x(perm);

/** المنطقة الزمنية المرجعية للمحل (البرومت §4.3) */
create or replace function public.store_tz()
returns text
language sql immutable
as $$ select 'Africa/Tripoli'::text $$;

/** تقريب بثلاث خانات كما يفعل HS.round(v, 3) في lib.js */
create or replace function public.round3(v numeric)
returns numeric
language sql immutable
as $$ select round(coalesce(v, 0), 3) $$;
