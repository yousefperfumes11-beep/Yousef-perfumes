/* ═══════════════════════════════════════════════════════════════════
   006 — دوال الديون
   ═══════════════════════════════════════════════════════════════════
   القرار 6 = «مساران كما هما، بلا توزيع على الأقدم أولًا»:
     collect_debt   ← HS.store.customerPayment  store.js:903-925
     add_debt_charge← HS.store.addDebt          store.js:927-957
   الرصيد هنا **مشتق** (customer_balances) فلا يُحدَّث يدويًا أبدًا —
   وهذا يسبب انحرافًا مستحيلًا بين جهازين (القرار 14).
   ═══════════════════════════════════════════════════════════════════ */

/** تحصيل من عميل: يدخل الصندوق إن كان نقدًا، وينقص الذمة المشتقة */
create or replace function public.collect_debt(
  p_customer_id uuid,
  p_amount      numeric,
  p_method      public.pay_method default 'cash',
  p_note        text default null,
  p_ts          timestamptz default null       /* تاريخ مرجعي كما في JS */
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor   uuid;
  v_name    text;
  v_balance numeric;
  v_pay     numeric;
  v_id      uuid;
begin
  v_actor := public.require_actor();
  if not public.has_perm('debts_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تسجيل الديون والدفعات»'
      using errcode = '42501';
  end if;

  select c.name into v_name from public.customers c
   where c.id = p_customer_id and c.active;
  if v_name is null then
    raise exception 'NO_CUSTOMER: العميل غير موجود' using errcode = 'P0002';
  end if;

  v_pay := public.round3(coalesce(p_amount, 0));
  if v_pay <= 0 then
    raise exception 'BAD_AMOUNT: أدخل مبلغًا موجبًا' using errcode = '22023';
  end if;

  /* قفل صف العميل أولًا: الرصيد مشتق، وبلا قفل ينجح تحصيلان متزامنان
     على الرصيد نفسه فينزل الرصيد تحت الصفر (جهازان يبيعان معًا). */
  perform 1 from public.customers c where c.id = p_customer_id for update;
  select coalesce(cb.balance, 0) into v_balance
    from public.customer_balances cb where cb.id = p_customer_id;

  if v_pay > v_balance + 0.001 then
    raise exception 'OVER_BALANCE: المبلغ أكبر من الرصيد المستحق' using errcode = '22023';
  end if;

  insert into public.customer_payments
    (customer_id, amount, kind, method, note, actor_id, created_at)
  values (p_customer_id, v_pay, 'payment', coalesce(p_method, 'cash'),
          coalesce(p_note, ''), v_actor, coalesce(p_ts, now()))
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'collect_debt', 'customer_payments', v_id::text,
          jsonb_build_object('customer', v_name, 'amount', v_pay,
                             'method', coalesce(p_method, 'cash')));

  return jsonb_build_object('ok', true, 'paymentId', v_id, 'amount', v_pay,
                            'balanceBefore', v_balance,
                            'balanceAfter', public.round3(v_balance - v_pay),
                            'inCashbox', coalesce(p_method, 'cash') = 'cash');
end $$;

/** دين يُضاف يدويًا: قيد سالب، لا أموال تتحرك ولا أثر على الصندوق */
create or replace function public.add_debt_charge(
  p_customer_id uuid,
  p_amount      numeric,
  p_note        text default null,
  p_ts          timestamptz default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor   uuid;
  v_name    text;
  v_amt     numeric;
  v_balance numeric;
  v_id      uuid;
begin
  v_actor := public.require_actor();
  if not public.has_perm('debts_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تسجيل الديون والدفعات»'
      using errcode = '42501';
  end if;

  select c.name into v_name from public.customers c
   where c.id = p_customer_id and c.active;
  if v_name is null then
    raise exception 'NO_CUSTOMER: العميل غير موجود' using errcode = 'P0002';
  end if;

  v_amt := public.round3(coalesce(p_amount, 0));
  if v_amt <= 0 then
    raise exception 'BAD_AMOUNT: أدخل مبلغًا موجبًا' using errcode = '22023';
  end if;

  /* قفل صف العميل أولًا: الرصيد مشتق، وبلا قفل ينجح تحصيلان متزامنان
     على الرصيد نفسه فينزل الرصيد تحت الصفر (جهازان يبيعان معًا). */
  perform 1 from public.customers c where c.id = p_customer_id for update;
  select coalesce(cb.balance, 0) into v_balance
    from public.customer_balances cb where cb.id = p_customer_id;

  insert into public.customer_payments
    (customer_id, amount, kind, method, note, actor_id, created_at)
  values (p_customer_id, -v_amt, 'charge', null,
          coalesce(nullif(trim(coalesce(p_note, '')), ''), 'دين مضاف يدويًا'),
          v_actor, coalesce(p_ts, now()))
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'add_debt_charge', 'customer_payments', v_id::text,
          jsonb_build_object('customer', v_name, 'amount', v_amt));

  return jsonb_build_object('ok', true, 'chargeId', v_id, 'amount', v_amt,
                            'balanceBefore', v_balance,
                            'balanceAfter', public.round3(v_balance + v_amt),
                            'inCashbox', false);
end $$;

grant execute on function public.collect_debt(uuid, numeric, public.pay_method, text, timestamptz) to authenticated;
grant execute on function public.add_debt_charge(uuid, numeric, text, timestamptz) to authenticated;
