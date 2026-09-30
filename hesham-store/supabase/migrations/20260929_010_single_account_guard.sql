-- 010: الموقع يعتمد حسابًا واحدًا فقط.
-- أول حساب يُنشأ يصبح «مدير» بكل الصلاحيات، وأي حساب بعده يُرفض من قاعدة البيانات نفسها.

create or replace function public.enforce_single_account()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  perform pg_advisory_xact_lock(hashtext('single_account_guard'));
  if exists (select 1 from auth.users) then
    raise exception 'SINGLE_ACCOUNT: هذا الموقع يقبل حسابًا واحدًا فقط ولا يمكن إنشاء حساب آخر'
      using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_single_account on auth.users;
create trigger trg_single_account
  before insert on auth.users
  for each row execute function public.enforce_single_account();

create or replace function public.create_owner_profile()
returns trigger
language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (id, username, full_name, role, permissions, active)
  values (
    new.id,
    coalesce(nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'owner'),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
             nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'المدير'),
    'مدير',
    coalesce((select array_agg(id) from public.permissions), '{}'),
    true
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_create_owner_profile on auth.users;
create trigger trg_create_owner_profile
  after insert on auth.users
  for each row execute function public.create_owner_profile();

-- تستعملها الواجهة لتعرف هل تعرض «إنشاء الحساب» أم «تسجيل الدخول»
create or replace function public.owner_exists()
returns boolean
language sql stable security definer set search_path = public, auth
as $$ select exists (select 1 from auth.users) $$;

revoke execute on function public.enforce_single_account() from public, anon, authenticated;
revoke execute on function public.create_owner_profile() from public, anon, authenticated;
grant execute on function public.owner_exists() to anon, authenticated;
