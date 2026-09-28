/* ═══════════════════════════════════════════════════════════════════
   00_local_stubs.sql — للاختبار المحلي على Postgres عادي فقط
   ═══════════════════════════════════════════════════════════════════
   هذا الملف **لا يُرفع إلى Supabase ولا يُنفَّذ عليه أبدًا**.
   وظيفته توفير ما توفّره منصة Supabase تلقائيًا حتى تعمل الهجرات
   والاختبارات على Postgres محلي:
     · مخطط auth وجدول auth.users
     · دالة auth.uid()
     · الأدوار anon / authenticated / service_role

   محاكاة الهوية: تُضبط بـ
     set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
   أو بالمتغير المختصر:
     set local app.uid = '<uuid>';
   ═══════════════════════════════════════════════════════════════════ */

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  encrypted_password text,
  email_confirmed_at timestamptz,
  created_at         timestamptz not null default now(),
  banned_until       timestamptz,
  raw_app_meta_data  jsonb,
  raw_user_meta_data jsonb
);

/* أدوار Supabase */
do $$ begin create role anon              nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated     nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role      nologin bypassrls; exception when duplicate_object then null; end $$;

/**
 * بديل auth.uid(): يقرأ الهوية من مطالبة JWT إن وُجدت، وإلا من app.uid.
 * في Supabase الحقيقية هذه الدالة معرّفة مسبقًا ولا يُنشئها هذا الملف.
 */
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub',
    nullif(current_setting('app.uid', true), '')
  )::uuid;
$$;

/** بديل auth.role() */
create or replace function auth.role()
returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    nullif(current_setting('request.role', true), ''),
    'anon'
  );
$$;

/** بديل auth.jwt() */
create or replace function auth.jwt()
returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

/* صلاحية التنفيذ للاختبارات */
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid()  to anon, authenticated, service_role;
grant execute on function auth.role() to anon, authenticated, service_role;
grant execute on function auth.jwt()  to anon, authenticated, service_role;
