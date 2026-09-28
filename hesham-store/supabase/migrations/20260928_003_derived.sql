/* ═══════════════════════════════════════════════════════════════════
   003 — الطبقة المشتقة: الرصيد، ذمم العملاء، والصندوق
   ═══════════════════════════════════════════════════════════════════
   هنا قلب النظام. كل دالة فيه **نقل حرفي** لمنطق JS المقابل،
   بالترتيب والشروط نفسها، حتى تتطابق الأرقام مع ما يعرفه المحل:

     product_stock      ← recomputeStock()          store.js:18-31
     customer_balances  ← الرصيد = فواتير الدين + القيود − الدفعات
     cash_events()      ← HS.store.cashEvents()     store.js:1061-1131
     cash_summary()     ← HS.store.cash()           store.js:1140-1205
     debts_summary()    ← HS.store.debts()          store.js:1252-1300
     overdue_sales()    ← HS.store.overdue()        store.js:~1015

   القرار 5: الصندوق **يُشتق ولا يُخزَّن** — فلا يمكن أن ينحرف.
   ═══════════════════════════════════════════════════════════════════ */

/* ─────────── الرصيد المشتق ─────────── */
create or replace view public.product_stock as
select
  p.id,
  p.opening + coalesce(sum(
    case m.type when 'out' then -m.qty else m.qty end
  ), 0) as stock
from public.products p
left join public.stock_movements m on m.product_id = p.id
group by p.id, p.opening;

/** الأصناف كما تراها الواجهة: كل حقول الصنف + الرصيد المشتق */
create or replace view public.products_live as
select
  p.*,
  coalesce(ps.stock, p.opening) as stock,
  p.name || coalesce(' · ' || p.size_label, '') as label   /* HS.store.label */
from public.products p
left join public.product_stock ps on ps.id = p.id;

/* ─────────── ذمم العملاء المشتقة ───────────
   في JS الرصيد مُجمَّع يدويًا (قرار 14)؛ هنا يُشتقّ حتى لا ينحرف
   بين جهازين. المعادلة مطابقة لما تنتجه العمليات:
     + فواتير الدين غير المرتجعة (total − paid)
     + قيود الدين اليدوية (amount سالب → نطرحه)
     − الدفعات المحصّلة (amount موجب) */
create or replace view public.customer_balances as
select
  c.id,
  c.name, c.phone, c.city, c.account_type, c.credit_limit, c.active,
  /* مطابقة تامة لسلوك JS: عند البيع يُضاف (total − paid) إلى الذمة متى كانت
     الحالة غير «مدفوعة» — لأي طريقة دفع كانت. ولأن paid ≤ total دائمًا،
     فالفاتورة المدفوعة تسهم بصفر، فيكفي جمع (total − paid) لكل غير المرتجع. */
  coalesce((
    select public.round3(sum(s.total - s.paid))
    from public.sales s
    where s.customer_id = c.id
      and s.status <> 'returned'
  ), 0)
  + coalesce((
    select public.round3(sum(-p.amount))
    from public.customer_payments p
    where p.customer_id = c.id and p.kind = 'charge'
  ), 0)
  - coalesce((
    select public.round3(sum(p.amount))
    from public.customer_payments p
    where p.customer_id = c.id and p.kind = 'payment' and p.amount > 0
  ), 0) as balance,
  coalesce((
    select count(*) from public.sales s
    where s.customer_id = c.id and s.status not in ('returned')
  ), 0)::int as visits,
  coalesce((
    select public.round3(sum(s.total)) from public.sales s
    where s.customer_id = c.id and s.status <> 'returned'
  ), 0) as total_spent,
  coalesce((
    select public.round3(sum(p.amount)) from public.customer_payments p
    where p.customer_id = c.id and p.amount > 0
  ), 0) as total_paid,
  coalesce((
    select public.round3(sum(-p.amount)) from public.customer_payments p
    where p.customer_id = c.id and p.kind = 'charge'
  ), 0) as total_charged,
  (select max(s.created_at) from public.sales s
    where s.customer_id = c.id and s.status <> 'returned') as last_visit
from public.customers c;

/* ─────────── أحداث الصندوق ───────────
   نقل حرفي لـ HS.store.cashEvents(from, to) — بنفس الترتيب والخمس مصادر:
     1) القبض وقت البيع: paid>0 والطريقة cash أو credit
        → kind = sale (نقدي) أو downpayment (مقدمة على دين)
     2) الاسترداد عند الإرجاع: status=returned وpaid>0 وcash أو credit
        → kind = refund بتاريخ returned_at (أو تاريخ البيع إن غاب)
     3) دفعات العملاء النقدية الموجبة → kind = debt
     4) المصروفات النقدية → kind = expense (خروج)
     5) القيود اليدوية → deposit أو withdraw
   ثم تُرتَّب تصاعديًا ويُحسب الرصيد المتراكم. */
create or replace function public.cash_events(
  from_ts timestamptz default '-infinity',
  to_ts   timestamptz default  'infinity'
)
returns table (
  ts         timestamptz,
  direction  public.cash_direction,
  amount     numeric,
  kind       text,
  ref        text,
  label      text,
  detail     text,
  sale_id    uuid,
  source_id  text,
  actor_id   uuid,
  balance    numeric
)
language sql stable
as $$
  with ev as (
    /* 1) القبض وقت البيع */
    select s.created_at as ts,
           'in'::public.cash_direction as direction,
           public.round3(s.paid) as amount,
           case when s.payment_method = 'cash' then 'sale' else 'downpayment' end as kind,
           s.number as ref,
           case when s.payment_method = 'cash'
                then 'بيع نقدي — ' || s.number
                else 'مقدمة على دين — ' || s.number end as label,
           s.customer_name as detail,
           s.id as sale_id,
           s.id::text as source_id,
           s.seller_id as actor_id
    from public.sales s
    where s.paid > 0
      and s.payment_method in ('cash','credit')
      and s.created_at between from_ts and to_ts

    union all
    /* 2) الاسترداد عند الإرجاع */
    select coalesce(s.returned_at, s.created_at),
           'out'::public.cash_direction,
           public.round3(s.paid),
           'refund',
           s.number,
           'إلغاء عملية بيع — استرداد — ' || s.number,
           coalesce(s.return_reason, s.customer_name),
           s.id, s.id::text, s.seller_id
    from public.sales s
    where s.status = 'returned'
      and s.paid > 0
      and s.payment_method in ('cash','credit')
      and coalesce(s.returned_at, s.created_at) between from_ts and to_ts

    union all
    /* 3) سداد الديون نقدًا (القيود السالبة ليست أموالًا → تُستثنى) */
    select p.created_at, 'in'::public.cash_direction, public.round3(p.amount),
           'debt', coalesce(c.name, ''),
           'سداد دين — ' || coalesce(c.name, ''), coalesce(p.note, ''),
           p.sale_id, p.id::text, p.actor_id
    from public.customer_payments p
    left join public.customers c on c.id = p.customer_id
    where p.kind = 'payment' and p.amount > 0 and coalesce(p.method, 'cash') = 'cash'
      and p.created_at between from_ts and to_ts

    union all
    /* 4) المصروفات النقدية */
    select e.created_at, 'out'::public.cash_direction, public.round3(e.amount),
           'expense', e.category, 'مصروف نقدي — ' || e.category, coalesce(e.note, ''),
           null, e.id::text, e.actor_id
    from public.expenses e
    where e.deleted_at is null
      and e.method = 'cash'
      and e.created_at between from_ts and to_ts

    union all
    /* 5) الإيداع والسحب اليدوي (ومنهما الرصيد الافتتاحي وفرق الجرد) */
    select k.created_at, k.direction, public.round3(k.amount),
           case k.direction when 'out' then 'withdraw' else 'deposit' end,
           k.reason, k.reason, '', null, k.id::text, k.actor_id
    from public.cash_entries k
    where k.deleted_at is null
      and k.created_at between from_ts and to_ts
  )
  select ev.ts, ev.direction, ev.amount, ev.kind, ev.ref, ev.label, ev.detail,
         ev.sale_id, ev.source_id, ev.actor_id,
         public.round3(sum(case when ev.direction = 'out' then -ev.amount else ev.amount end)
           over (order by ev.ts, ev.source_id
                 rows between unbounded preceding and current row)) as balance
  from ev
  order by ev.ts, ev.source_id;
$$;

/** الرصيد المُرحَّل قبل بداية الفترة — مطابق لـ HS.store.cashCarried */
create or replace function public.cash_carried(from_ts timestamptz)
returns numeric
language sql stable
as $$
  select public.round3(coalesce(sum(
    case when ce.direction = 'out' then -ce.amount else ce.amount end), 0))
  from public.cash_events('-infinity'::timestamptz, from_ts - interval '1 millisecond') ce;
$$;

/* ─────────── ملخص الصندوق: 27 حقلًا كما في HS.store.cash() ─────────── */
create or replace function public.cash_summary(
  from_ts timestamptz,
  to_ts   timestamptz
)
returns table (
  carried               numeric,
  cash_sales            numeric,
  cash_collected        numeric,
  card_sales            numeric,
  credit_sales          numeric,
  credit_down_payment   numeric,
  credit_outstanding    numeric,
  debt_cash             numeric,
  debt_card             numeric,
  debt_total            numeric,
  exp_cash              numeric,
  exp_other             numeric,
  exp_total             numeric,
  refunds               numeric,
  other_in              numeric,
  other_out             numeric,
  inflow                numeric,
  outflow               numeric,
  net                   numeric,
  expected              numeric,
  not_in_cash           numeric,
  cash_sales_count      bigint,
  card_sales_count      bigint,
  credit_sales_count    bigint,
  in_count              bigint,
  out_count             bigint,
  events                bigint,
  sales_count           bigint
)
language sql stable
as $$
  with s as (
    select * from public.sales
    where created_at between from_ts and to_ts and status <> 'returned'
  ),
  e as (
    select * from public.cash_events(from_ts, to_ts)
  ),
  agg as (
    select
      public.round3(sum(s.total) filter (where s.payment_method = 'cash'))   as cash_sales,
      public.round3(sum(s.total) filter (where s.payment_method = 'card'))   as card_sales,
      public.round3(sum(s.total) filter (where s.payment_method = 'credit')) as credit_sales,
      count(*) filter (where s.payment_method = 'cash')   as cash_n,
      count(*) filter (where s.payment_method = 'card')   as card_n,
      count(*) filter (where s.payment_method = 'credit') as credit_n,
      count(*) as sales_n
    from s
  ),
  evagg as (
    select
      public.round3(sum(e.amount) filter (where e.kind = 'sale'        and e.direction = 'in'))  as cash_collected,
      public.round3(sum(e.amount) filter (where e.kind = 'downpayment' and e.direction = 'in'))  as credit_down,
      public.round3(sum(e.amount) filter (where e.kind = 'debt'        and e.direction = 'in'))  as debt_cash,
      public.round3(sum(e.amount) filter (where e.kind = 'deposit'     and e.direction = 'in'))  as other_in,
      public.round3(sum(e.amount) filter (where e.kind = 'refund'      and e.direction = 'out')) as refunds,
      public.round3(sum(e.amount) filter (where e.kind = 'expense'     and e.direction = 'out')) as exp_cash,
      public.round3(sum(e.amount) filter (where e.kind = 'withdraw'    and e.direction = 'out')) as other_out,
      count(*) filter (where e.direction = 'in')  as in_n,
      count(*) filter (where e.direction = 'out') as out_n,
      count(*) as ev_n
    from e
  ),
  pay as (
    select public.round3(sum(p.amount)) as debt_card
    from public.customer_payments p
    where p.created_at between from_ts and to_ts
      and p.kind = 'payment' and p.amount > 0
      and coalesce(p.method, 'cash') <> 'cash'
  ),
  exp as (
    select public.round3(sum(x.amount)) as exp_other
    from public.expenses x
    where x.deleted_at is null and x.created_at between from_ts and to_ts
      and x.method <> 'cash'
  )
  select
    public.cash_carried(from_ts)                                        as carried,
    coalesce(agg.cash_sales, 0)                                         as cash_sales,
    coalesce(evagg.cash_collected, 0)                                   as cash_collected,
    coalesce(agg.card_sales, 0)                                         as card_sales,
    coalesce(agg.credit_sales, 0)                                       as credit_sales,
    coalesce(evagg.credit_down, 0)                                      as credit_down_payment,
    coalesce(agg.credit_sales, 0) - coalesce(evagg.credit_down, 0)      as credit_outstanding,
    coalesce(evagg.debt_cash, 0)                                        as debt_cash,
    coalesce(pay.debt_card, 0)                                          as debt_card,
    coalesce(evagg.debt_cash, 0) + coalesce(pay.debt_card, 0)           as debt_total,
    coalesce(evagg.exp_cash, 0)                                         as exp_cash,
    coalesce(exp.exp_other, 0)                                          as exp_other,
    coalesce(evagg.exp_cash, 0) + coalesce(exp.exp_other, 0)            as exp_total,
    coalesce(evagg.refunds, 0)                                          as refunds,
    coalesce(evagg.other_in, 0)                                         as other_in,
    coalesce(evagg.other_out, 0)                                        as other_out,
    coalesce(evagg.cash_collected,0) + coalesce(evagg.credit_down,0)
      + coalesce(evagg.debt_cash,0) + coalesce(evagg.other_in,0)        as inflow,
    coalesce(evagg.refunds,0) + coalesce(evagg.exp_cash,0)
      + coalesce(evagg.other_out,0)                                     as outflow,
    (coalesce(evagg.cash_collected,0) + coalesce(evagg.credit_down,0)
      + coalesce(evagg.debt_cash,0) + coalesce(evagg.other_in,0))
    - (coalesce(evagg.refunds,0) + coalesce(evagg.exp_cash,0)
      + coalesce(evagg.other_out,0))                                    as net,
    public.cash_carried(from_ts)
    + (coalesce(evagg.cash_collected,0) + coalesce(evagg.credit_down,0)
        + coalesce(evagg.debt_cash,0) + coalesce(evagg.other_in,0))
    - (coalesce(evagg.refunds,0) + coalesce(evagg.exp_cash,0)
        + coalesce(evagg.other_out,0))                                  as expected,
    coalesce(agg.card_sales,0)
      + (coalesce(agg.credit_sales,0) - coalesce(evagg.credit_down,0))
      + coalesce(pay.debt_card,0) + coalesce(exp.exp_other,0)           as not_in_cash,
    coalesce(agg.cash_n, 0)   as cash_sales_count,
    coalesce(agg.card_n, 0)   as card_sales_count,
    coalesce(agg.credit_n, 0) as credit_sales_count,
    coalesce(evagg.in_n, 0)   as in_count,
    coalesce(evagg.out_n, 0)  as out_count,
    coalesce(evagg.ev_n, 0)   as events,
    coalesce(agg.sales_n, 0)  as sales_count
  from agg, evagg, pay, exp;
$$;

/* ─────────── ملخص الديون: 20 حقلًا كما في HS.store.debts() ─────────── */
create or replace function public.debts_summary(
  from_ts timestamptz,
  to_ts   timestamptz
)
returns table (
  granted             numeric,
  sales_granted       numeric,
  charges_granted     numeric,
  charge_count        bigint,
  down_paid           numeric,
  collected           numeric,
  collected_count     bigint,
  total_collected     numeric,
  range_outstanding   numeric,
  outstanding_now     numeric,
  unpaid_count        bigint,
  unpaid_value        numeric,
  partial_count       bigint,
  partial_value       numeric,
  settled_count       bigint,
  settled_value       numeric
)
language sql stable
as $$
  with cr as (
    select * from public.sales
    where created_at between from_ts and to_ts
      and payment_method = 'credit' and status <> 'returned'
  ),
  pay as (
    select * from public.customer_payments
    where created_at between from_ts and to_ts
  ),
  a as (
    select
      public.round3(sum(cr.total))                    as sales_granted,
      public.round3(sum(cr.paid))                     as down_paid,
      count(*) filter (where cr.status = 'unpaid')    as unpaid_n,
      public.round3(sum(cr.total - cr.paid) filter (where cr.status = 'unpaid'))  as unpaid_v,
      count(*) filter (where cr.status = 'partial')   as partial_n,
      public.round3(sum(cr.total - cr.paid) filter (where cr.status = 'partial')) as partial_v,
      count(*) filter (where cr.status = 'paid')      as settled_n,
      public.round3(sum(cr.total) filter (where cr.status = 'paid'))              as settled_v
    from cr
  ),
  b as (
    select
      public.round3(sum(p.amount) filter (where p.kind = 'payment' and p.amount > 0)) as collected,
      count(*) filter (where p.kind = 'payment' and p.amount > 0)                     as collected_n,
      public.round3(sum(-p.amount) filter (where p.kind = 'charge'))                  as charges_granted,
      count(*) filter (where p.kind = 'charge')                                       as charge_n
    from pay p
  )
  select
    coalesce(a.sales_granted,0) + coalesce(b.charges_granted,0) as granted,
    coalesce(a.sales_granted, 0)  as sales_granted,
    coalesce(b.charges_granted,0) as charges_granted,
    coalesce(b.charge_n, 0)       as charge_count,
    coalesce(a.down_paid, 0)      as down_paid,
    coalesce(b.collected, 0)      as collected,
    coalesce(b.collected_n, 0)    as collected_count,
    coalesce(a.down_paid,0) + coalesce(b.collected,0) as total_collected,
    (coalesce(a.sales_granted,0) + coalesce(b.charges_granted,0))
      - coalesce(a.down_paid,0) - coalesce(b.collected,0) as range_outstanding,
    (select public.round3(coalesce(sum(cb.balance), 0))
       from public.customer_balances cb where cb.balance > 0) as outstanding_now,
    coalesce(a.unpaid_n, 0)  as unpaid_count,
    coalesce(a.unpaid_v, 0)  as unpaid_value,
    coalesce(a.partial_n, 0) as partial_count,
    coalesce(a.partial_v, 0) as partial_value,
    coalesce(a.settled_n, 0) as settled_count,
    coalesce(a.settled_v, 0) as settled_value
  from a, b;
$$;

/* ─────────── الديون المتأخرة — مطابقة لـ HS.store.overdue() ─────────── */
create or replace function public.overdue_sales()
returns table (
  sale_id uuid, number text, customer_name text,
  age_days int, due numeric, total numeric, paid numeric, status public.sale_status
)
language sql stable
as $$
  select s.id, s.number, s.customer_name,
         greatest(0, floor(extract(epoch from (now() - s.created_at)) / 86400))::int as age_days,
         public.round3(s.total - s.paid) as due,
         s.total, s.paid, s.status
  from public.sales s
  where s.status in ('unpaid','partial')
    and greatest(0, floor(extract(epoch from (now() - s.created_at)) / 86400))::int
        > coalesce(nullif((select (public.settings.data ->> 'maxCreditDays')::int
                           from public.settings where id = 1), 0), 30)
  order by age_days desc;
$$;

/* ─────────── الربح: للتحقق من العمود المخزّن ───────────
   مطابقة لـ HS.store.saleProfit: Σ qty×(price−cost) − خصم الفاتورة */
create or replace function public.sale_profit_recomputed(p_sale_id uuid)
returns numeric
language sql stable
as $$
  select public.round3(
    coalesce((select sum(i.qty * (i.unit_price - i.unit_cost))
              from public.sale_items i where i.sale_id = p_sale_id), 0)
    - coalesce((select s.discount from public.sales s where s.id = p_sale_id), 0)
  );
$$;
