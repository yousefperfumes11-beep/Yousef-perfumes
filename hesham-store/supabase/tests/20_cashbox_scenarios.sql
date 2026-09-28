/* ═══════════════════════════════════════════════════════════════════
   20_cashbox_scenarios.sql — سيناريوهات الصندوق والمخزون والديون
   ═══════════════════════════════════════════════════════════════════
   معيار نجاح المرحلة 1 من البرومت:
   «استعلام رصيد الصندوق من cash_events يطابق الجدول في القسم 2
     لكل السيناريوهات» — الجدول المُختبَر هنا:

     بيع نقدي            → الصندوق += الإجمالي        · المخزون ينزل · الربح يُسجَّل
     بيع بالبطاقة        → الصندوق لا يتغير           · المخزون ينزل · الربح يُسجَّل
     بيع بالدين          → الصندوق لا يتغير           · المخزون ينزل · الذمة تُسجَّل
     دفعة أولى على دين   → الصندوق += الدفعة فقط      · الباقي ذمة
     تحصيل دين نقدًا     → الصندوق += المحصَّل        · الذمة تنقص
     إرجاع بيع نقدي      → الصندوق −= المقبوض         · المخزون يعود
     مصروف نقدي          → الصندوق −= المبلغ
     رصيد غير كافٍ       → رفض
     بائع + عملية إدارية → رفض

   ومعادلة الصندوق تُفحص بعد **كل** خطوة:
     expected = carried + cash_collected + credit_down_payment + debt_cash + other_in
              − refunds − exp_cash − other_out
   ═══════════════════════════════════════════════════════════════════ */

\set ON_ERROR_STOP on
set client_min_messages = notice;

/* مستخدم سادس: يملك pos_sell بلا pos_discount — لاختبار فرض الخصم خادميًا */
insert into auth.users (id, email, email_confirmed_at)
values ('66666666-6666-6666-6666-666666666666','nodisc@youssef.local', now())
on conflict (id) do nothing;
insert into public.profiles (id, username, full_name, role, permissions, active)
values ('66666666-6666-6666-6666-666666666666','nodisc','بائع بلا صلاحية خصم','بائع',
        array['view_dashboard','pos_sell'], true)
on conflict (id) do update set permissions = excluded.permissions;

/* ─────────── فحص المعادلة: يُستدعى بعد كل خطوة ─────────── */
create or replace function public.test_identity(p_tag text)
returns void language plpgsql as $$
declare c record; v_ok boolean;
begin
  select * into c from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);
  v_ok := abs(c.expected - (c.carried + c.cash_collected + c.credit_down_payment
             + c.debt_cash + c.other_in - c.refunds - c.exp_cash - c.other_out)) < 0.001;
  perform public.test_assert('معادلة الصندوق ثابتة (' || p_tag || ')', v_ok,
    'الرصيد ' || c.expected || ' = مُرحّل ' || c.carried || ' + داخل ' || c.inflow
    || ' − خارج ' || c.outflow);
end $$;
grant execute on function public.test_identity(text) to authenticated;

/* ─────────── اختصارات الهويات ─────────── */
create or replace function public.as_admin()  returns void language sql as
  $$ select set_config('app.uid','11111111-1111-1111-1111-111111111111', false) $$;
create or replace function public.as_seller() returns void language sql as
  $$ select set_config('app.uid','22222222-2222-2222-2222-222222222222', false) $$;
create or replace function public.as_store()  returns void language sql as
  $$ select set_config('app.uid','33333333-3333-3333-3333-333333333333', false) $$;
create or replace function public.as_acc()    returns void language sql as
  $$ select set_config('app.uid','44444444-4444-4444-4444-444444444444', false) $$;
create or replace function public.as_off()    returns void language sql as
  $$ select set_config('app.uid','55555555-5555-5555-5555-555555555555', false) $$;
create or replace function public.as_nodisc() returns void language sql as
  $$ select set_config('app.uid','66666666-6666-6666-6666-666666666666', false) $$;
create or replace function public.as_anon()   returns void language sql as
  $$ select set_config('app.uid','', false) $$;

/* من هنا تُنفَّذ السيناريوهات بدور العميل الحقيقي (لا المالك) حتى تسري RLS فعلاً */
set role authenticated;

\echo ''
\echo '── السيناريو 1: بيع نقدي ──'
do $$
declare e0 numeric; s0 numeric; res jsonb; c record;
begin
  perform public.as_admin();
  select expected into e0 from public.cash_summary('-infinity','infinity');
  select stock into s0 from public.product_stock where id = 'bbbbbbbb-0000-0000-0000-00000000000a';

  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',2)),
    'method','cash'));

  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('نقدي: دخل الصندوق كاملًا (2 × 150)',
    c.expected = e0 + 300, e0 || ' → ' || c.expected);
  perform public.test_assert('نقدي: cash_collected زاد 300', c.cash_collected = 300);
  perform public.test_assert('نقدي: نزل المخزون وحدتين',
    (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a') = s0 - 2,
    s0 || ' → ' || (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a'));
  perform public.test_assert('نقدي: الربح = 2 × (150 − 100)',
    (res -> 'sale' ->> 'profit')::numeric = 100, res -> 'sale' ->> 'profit');
  perform public.test_assert('نقدي: الحالة paid والمحصَّل = الإجمالي',
    res -> 'sale' ->> 'status' = 'paid' and (res -> 'sale' ->> 'paid')::numeric = 300);
  perform public.test_assert('نقدي: رقم الفاتورة بصيغة PREFIX-YYYY-NNNN',
    (res -> 'sale' ->> 'number') ~ ('^INV-\d{4}-\d{4}$'), res -> 'sale' ->> 'number');
  perform public.test_identity('بعد البيع النقدي');
end $$;

\echo ''
\echo '── السيناريو 2: بيع بالبطاقة ──'
do $$
declare e0 numeric; card0 numeric; res jsonb; c record; s0 numeric;
begin
  perform public.as_admin();
  select expected, card_sales into e0, card0 from public.cash_summary('-infinity','infinity');
  select stock into s0 from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a';

  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',1)),
    'method','card'));

  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('بطاقة: لم يدخل الصندوق إطلاقًا', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('بطاقة: card_sales زاد 150', c.card_sales = card0 + 150);
  perform public.test_assert('بطاقة: ضمن «خارج الصندوق»', c.not_in_cash >= 150, c.not_in_cash::text);
  perform public.test_assert('بطاقة: نزل المخزون وسُجّل الربح',
    (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a') = s0 - 1
    and (res -> 'sale' ->> 'profit')::numeric = 50);
  perform public.test_assert('بطاقة: لا دين على أحد',
    (select coalesce(sum(balance),0) from public.customer_balances where balance > 0) = 0);
  perform public.test_identity('بعد البيع بالبطاقة');
end $$;

\echo ''
\echo '── السيناريو 3: بيع بالدين بلا دفعة ──'
do $$
declare e0 numeric; res jsonb; c record; bal numeric;
begin
  perform public.as_admin();
  select expected into e0 from public.cash_summary('-infinity','infinity');

  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000e','qty',1)),
    'method','credit','customerId','cccccccc-0000-0000-0000-000000000001'));

  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('دين: لم يدخل الصندوق', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('دين: الحالة unpaid والمحصَّل صفر',
    res -> 'sale' ->> 'status' = 'unpaid' and (res -> 'sale' ->> 'paid')::numeric = 0);
  perform public.test_assert('دين: سُجّلت ذمة 140 على العميل', bal = 140, bal::text);
  perform public.test_assert('دين: credit_outstanding = 140', c.credit_outstanding = 140);
  perform public.test_assert('دين: الربح سُجّل رغم عدم القبض',
    (res -> 'sale' ->> 'profit')::numeric = 50, res -> 'sale' ->> 'profit');
  perform public.test_identity('بعد البيع بالدين');
end $$;

\echo ''
\echo '── السيناريو 4: دين مع دفعة أولى ──'
do $$
declare e0 numeric; res jsonb; c record; bal numeric;
begin
  perform public.as_seller();
  select expected into e0 from public.cash_summary('-infinity','infinity');

  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',1)),
    'method','credit','paid',50,'customerId','cccccccc-0000-0000-0000-000000000001'));

  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('دفعة أولى: دخل الصندوق 50 فقط', c.expected = e0 + 50, e0 || ' → ' || c.expected);
  perform public.test_assert('دفعة أولى: kind = downpayment', c.credit_down_payment = 50);
  perform public.test_assert('دفعة أولى: الحالة partial', res -> 'sale' ->> 'status' = 'partial');
  perform public.test_assert('دفعة أولى: الذمة = 150 − 50 = 100 فوق السابقة', bal = 240, bal::text);
  perform public.test_identity('بعد الدفعة الأولى');
end $$;

\echo ''
\echo '── السيناريو 5: إرجاع فاتورة نقدية ──'
do $$
declare e0 numeric; res jsonb; ret jsonb; c record; s_before numeric; s_after numeric;
        v_sid uuid;
begin
  perform public.as_admin();
  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',1)),
    'method','cash'));
  v_sid := (res -> 'sale' ->> 'id')::uuid;

  select expected into e0 from public.cash_summary('-infinity','infinity');
  select stock into s_before from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a';

  ret := public.return_sale(v_sid, 'اختبار الإرجاع');

  select * into c from public.cash_summary('-infinity','infinity');
  select stock into s_after from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a';
  perform public.test_assert('إرجاع: خرج 150 من الصندوق (استرداد)', c.expected = e0 - 150,
    e0 || ' → ' || c.expected);
  perform public.test_assert('إرجاع: refunds = 150', c.refunds = 150);
  perform public.test_assert('إرجاع: عاد المخزون', s_after = s_before + 1, s_before || ' → ' || s_after);
  perform public.test_assert('إرجاع: الحالة returned',
    (select status::text from public.sales where id = v_sid) = 'returned');
  perform public.test_assert('إرجاع: لا يُحتسب في الإيراد الصالح',
    (select count(*) from public.sales where status <> 'returned') = 4);
  perform public.test_identity('بعد الإرجاع');
end $$;

\echo ''
\echo '── السيناريو 6: تحصيل الدين (نقدًا وبالبطاقة) ──'
do $$
declare e0 numeric; r1 jsonb; r2 jsonb; c record; bal numeric;
begin
  perform public.as_seller();
  select expected into e0 from public.cash_summary('-infinity','infinity');

  r1 := public.collect_debt('cccccccc-0000-0000-0000-000000000001', 100, 'cash', 'دفعة نقدية');
  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('تحصيل نقدي: دخل الصندوق 100', c.expected = e0 + 100, e0 || ' → ' || c.expected);
  perform public.test_assert('تحصيل نقدي: debt_cash = 100', c.debt_cash = 100);
  perform public.test_assert('تحصيل نقدي: الذمة 240 → 140', bal = 140, bal::text);
  perform public.test_assert('تحصيل نقدي: inCashbox = true', (r1 ->> 'inCashbox')::boolean);
  perform public.test_identity('بعد التحصيل النقدي');

  e0 := c.expected;
  r2 := public.collect_debt('cccccccc-0000-0000-0000-000000000001', 40, 'card', 'دفعة بالشبكة');
  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('تحصيل بالبطاقة: لم يدخل الصندوق', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('تحصيل بالبطاقة: ضمن debt_card', c.debt_card = 40);
  perform public.test_assert('تحصيل بالبطاقة: الذمة 140 → 100', bal = 100, bal::text);
  perform public.test_assert('تحصيل بالبطاقة: inCashbox = false', not (r2 ->> 'inCashbox')::boolean);
  perform public.test_identity('بعد التحصيل بالبطاقة');
end $$;

\echo ''
\echo '── السيناريو 7: رصيد غير كافٍ وأصناف مرفوضة ──'
do $$
declare e0 numeric; c record; s0 numeric;
begin
  perform public.as_seller();
  select expected into e0 from public.cash_summary('-infinity','infinity');
  select stock into s0 from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a';

  perform public.test_expect_fail('رفض: صنف رصيده صفر',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000c","qty":1}],"method":"cash"}'::jsonb) $q$);
  perform public.test_expect_fail('رفض: كمية تفوق المتاح',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":99}],"method":"cash"}'::jsonb) $q$);
  perform public.test_expect_fail('رفض: صنف موقوف',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000d","qty":1}],"method":"cash"}'::jsonb) $q$);
  perform public.test_expect_fail('رفض: سلة فارغة',
    $q$ select public.create_sale('{"items":[],"method":"cash"}'::jsonb) $q$);
  perform public.test_expect_fail('رفض: طريقة دفع رابعة',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"transfer"}'::jsonb) $q$);
  perform public.test_expect_fail('رفض: خصم سالب',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash","discount":-5}'::jsonb) $q$);

  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('كل المرفوضات لم تلمس الصندوق', c.expected = e0, c.expected::text);
  perform public.test_assert('كل المرفوضات لم تلمس المخزون',
    (select stock from public.product_stock
      where id='bbbbbbbb-0000-0000-0000-00000000000a') = s0,
    'قبل ' || s0 || ' · بعد ' ||
    (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000a'));
  perform public.test_identity('بعد المرفوضات');
end $$;

\echo ''
\echo '── السيناريو 8: الصلاحيات — كل دور وما يُرفض له ──'
do $$
declare v_sid uuid; declare_rows int;
begin
  /* بائع: يبيع ✔ لكن لا يُرجع (sales_refund ليست له — مطابقة لـ ROLE_PERMS) */
  perform public.as_seller();
  select (public.create_sale(jsonb_build_object('items', jsonb_build_array(
      jsonb_build_object('productId','bbbbbbbb-0000-0000-0000-00000000000e','qty',1)),
      'method','cash')) -> 'sale' ->> 'id')::uuid into v_sid;
  perform public.test_assert('بائع: أتمّ بيعًا نقديًا', v_sid is not null);
  perform public.test_expect_fail('بائع: مُنع من إرجاع فاتورة',
    format('select public.return_sale(%L, ''محاولة بائع'')', v_sid));

  perform public.as_acc();
  perform public.test_assert('محاسب: يملك sales_refund فأرجع الفاتورة',
    (public.return_sale(v_sid, 'إرجاع المحاسب') ->> 'ok')::boolean);

  /* مشرف المخزن والمحاسب: لا pos_sell */
  perform public.as_store();
  perform public.test_expect_fail('مشرف مخزن: مُنع من البيع',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash"}'::jsonb) $q$);
  perform public.as_acc();
  perform public.test_expect_fail('محاسب: مُنع من البيع',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash"}'::jsonb) $q$);

  /* عمليات إدارية حكر على المدير */
  perform public.as_seller();
  perform public.test_expect_fail('بائع: مُنع من تغيير الرصيد الافتتاحي',
    $q$ select public.set_opening_cash(9999) $q$);
  perform public.as_store();
  perform public.test_expect_fail('مشرف مخزن: مُنع من تسجيل مصروف',
    $q$ insert into public.expenses (category, amount, method) values ('rent', 10, 'cash') $q$);
  perform public.as_seller();
  declare_rows := 0;
  update public.customers set city = 'بنغازي'
   where id = 'cccccccc-0000-0000-0000-000000000001';
  get diagnostics declare_rows = row_count;
  perform public.test_assert(
    'بائع: مُنع من تعديل عميل (customers_edit غير ممنوحة)',
    declare_rows = 0 and (select city from public.customers
                          where id='cccccccc-0000-0000-0000-000000000001') = 'طرابلس',
    'صفوف متأثرة = ' || declare_rows ||
    ' · RLS تُصفّي بصمت بلا خطأ — على الواجهة إعادة القراءة للتأكد');

  /* كتابة مباشرة على الجداول المحمية */
  perform public.as_admin();
  perform public.test_expect_fail('حتى المدير: مُنع من إدراج فاتورة مباشرة (بلا RPC)',
    $q$ insert into public.sales (number, status, payment_method, subtotal, total, customer_name)
        values ('MANUAL-1','paid','cash',10,10,'زبون') $q$);
  perform public.test_expect_fail('حتى المدير: مُنع من كتابة حركة مخزون مباشرة',
    $q$ insert into public.stock_movements (product_id, type, qty)
        values ('bbbbbbbb-0000-0000-0000-00000000000a','in',5) $q$);
  perform public.test_expect_fail('حتى المدير: مُنع من كتابة دفعة عميل مباشرة',
    $q$ insert into public.customer_payments (customer_id, amount)
        values ('cccccccc-0000-0000-0000-000000000001', 5) $q$);

  /* خصم بلا صلاحية */
  perform public.as_nodisc();
  perform public.test_expect_fail('بائع بلا pos_discount: مُنع من الخصم',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash","discount":5}'::jsonb) $q$);

  /* جلسة منتهية وحساب موقوف */
  perform public.as_anon();
  perform public.test_expect_fail('بلا جلسة: رُفض',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash"}'::jsonb) $q$);
  perform public.as_off();
  perform public.test_expect_fail('حساب موقوف: رُفض',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000a","qty":1}],"method":"cash"}'::jsonb) $q$);

  perform public.as_admin();
  perform public.test_identity('بعد اختبار الصلاحيات');
end $$;

\echo ''
\echo '── السيناريو 9: المصروفات ──'
do $$
declare e0 numeric; c record;
begin
  perform public.as_seller();          /* البائع يملك expenses_manage — مطابقة */
  select expected into e0 from public.cash_summary('-infinity','infinity');
  insert into public.expenses (category, amount, method, note, actor_id)
  values ('utilities', 45, 'cash', 'كهرباء', auth.uid());
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('مصروف نقدي: نقص الصندوق 45', c.expected = e0 - 45, e0 || ' → ' || c.expected);
  perform public.test_assert('مصروف نقدي: exp_cash = 45', c.exp_cash = 45);
  perform public.test_identity('بعد المصروف النقدي');

  e0 := c.expected;
  insert into public.expenses (category, amount, method, note, actor_id)
  values ('display', 30, 'card', 'فاترينة', auth.uid());
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('مصروف بالبطاقة: لم يمسّ الصندوق', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('مصروف بالبطاقة: ضمن exp_other', c.exp_other = 30);
  perform public.test_identity('بعد المصروف بالبطاقة');
end $$;

\echo ''
\echo '── السيناريو 10: دين يدوي ثم سداده ──'
do $$
declare e0 numeric; r jsonb; c record; bal numeric; d record;
begin
  perform public.as_seller();
  select expected into e0 from public.cash_summary('-infinity','infinity');
  r := public.add_debt_charge('cccccccc-0000-0000-0000-000000000001', 120, 'سلفة على الحساب');
  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('دين يدوي: لم يلمس الصندوق', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('دين يدوي: الذمة 100 → 220', bal = 220, bal::text);
  perform public.test_assert('دين يدوي: inCashbox = false', not (r ->> 'inCashbox')::boolean);
  select * into d from public.debts_summary(now() - interval '1 day', now());
  perform public.test_assert('دين يدوي: يُحتسب ضمن granted', d.charges_granted = 120, d.charges_granted::text);
  perform public.test_identity('بعد الدين اليدوي');

  e0 := c.expected;
  r := public.collect_debt('cccccccc-0000-0000-0000-000000000001', 220, 'cash', 'تسوية كاملة');
  select * into c from public.cash_summary('-infinity','infinity');
  select balance into bal from public.customer_balances where id='cccccccc-0000-0000-0000-000000000001';
  perform public.test_assert('تسوية كاملة: دخل الصندوق 220', c.expected = e0 + 220, e0 || ' → ' || c.expected);
  perform public.test_assert('تسوية كاملة: الذمة صفر', bal = 0, bal::text);
  perform public.test_identity('بعد التسوية الكاملة');

  perform public.test_expect_fail('رفض: تحصيل أكبر من الرصيد',
    $q$ select public.collect_debt('cccccccc-0000-0000-0000-000000000001', 5, 'cash') $q$);
  perform public.test_expect_fail('رفض: مبلغ سالب كدين يدوي',
    $q$ select public.add_debt_charge('cccccccc-0000-0000-0000-000000000001', -10) $q$);
end $$;

\echo ''
\echo '── السيناريو 11: الإيداع والسحب وجرد الصندوق ──'
do $$
declare e0 numeric; r jsonb; c record; o_in0 numeric; o_out0 numeric;
begin
  perform public.as_seller();          /* cash_manage ممنوحة للبائع — مطابقة */
  select expected into e0 from public.cash_summary('-infinity','infinity');
  r := public.add_cash_entry('out', 3000, 'توريد أسبوعي إلى المصرف');
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('سحب يدوي: نقص الصندوق 3000', c.expected = e0 - 3000, e0 || ' → ' || c.expected);
  o_out0 := 0;
  perform public.test_assert('سحب يدوي: other_out زاد 3000', c.other_out = o_out0 + 3000, c.other_out::text);

  e0 := c.expected; o_in0 := c.other_in;
  r := public.add_cash_entry('in', 500, 'سحب من المصرف للصندوق');
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('إيداع يدوي: زاد الصندوق 500', c.expected = e0 + 500, e0 || ' → ' || c.expected);
  perform public.test_assert('إيداع يدوي: other_in زاد 500', c.other_in = o_in0 + 500,
    o_in0 || ' → ' || c.other_in || ' (يشمل الرصيد الافتتاحي داخل المدى اللانهائي)');
  perform public.test_identity('بعد الإيداع والسحب');

  /* جرد مطابق ثم جرد بعجز */
  r := public.record_cash_count(c.expected, 'جرد نهاية اليوم');
  perform public.test_assert('جرد مطابق: لا قيد ولا تغيير',
    (r ->> 'matched')::boolean and r ->> 'diff' = '0');
  e0 := c.expected;
  r := public.record_cash_count(c.expected - 25, 'نقص في الدرج');
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('جرد بعجز 25: سجّل قيد خروج وصحّح الرصيد',
    not (r ->> 'matched')::boolean and (r ->> 'diff')::numeric = -25 and c.expected = e0 - 25,
    r ->> 'reason');
  perform public.test_identity('بعد جرد الصندوق');

  perform public.test_expect_fail('رفض: الرصيد الافتتاحي لا يُحذف',
    $q$ select public.delete_cash_entry((select id from public.cash_entries where kind='opening' limit 1)) $q$);
end $$;

\echo ''
\echo '── السيناريو 12: المشتريات والموردون ──'
do $$
declare e0 numeric; c record; s0 numeric; r jsonb;
        po uuid := 'dddddddd-0000-0000-0000-000000000001';
begin
  perform public.as_store();           /* مشرف المخزن يملك purchases_manage */
  select expected into e0 from public.cash_summary('-infinity','infinity');
  select stock into s0 from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000c';

  r := public.pay_supplier(po, 200, 'cash', 'دفعة أولى للمورد');
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('دفعة مورد: لا تمسّ الصندوق (القرار 15 — مطابقة)', c.expected = e0, e0 || ' → ' || c.expected);
  perform public.test_assert('دفعة مورد: paid على الأمر = 200',
    (select paid from public.purchases where id = po) = 200);
  perform public.test_assert('دفعة مورد: inCashbox = false', not (r ->> 'inCashbox')::boolean);

  r := public.receive_purchase(po);
  select * into c from public.cash_summary('-infinity','infinity');
  perform public.test_assert('استلام أمر: زاد المخزون 5',
    (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000c') = s0 + 5,
    s0 || ' → ' || (select stock from public.product_stock where id='bbbbbbbb-0000-0000-0000-00000000000c'));
  perform public.test_assert('استلام أمر: لم يمسّ الصندوق', c.expected = e0);
  perform public.test_assert('استلام أمر: التكلفة لم تتغير (القرار 7 — مطابقة)',
    (select cost from public.products where id='bbbbbbbb-0000-0000-0000-00000000000c') = 40);
  perform public.test_expect_fail('رفض: استلام مزدوج',
    format('select public.receive_purchase(%L)', po));
  perform public.test_expect_fail('رفض: دفعة تتجاوز إجمالي الأمر',
    format('select public.pay_supplier(%L, 9999, ''cash'')', po));
  perform public.test_identity('بعد المشتريات');
end $$;

\echo ''
\echo '── السيناريو 13: تليين الحذف والتراجع ──'
do $$
declare r jsonb; n int;
begin
  perform public.as_admin();
  r := public.soft_delete_product('bbbbbbbb-0000-0000-0000-00000000000e');
  perform public.test_assert('تليين: الصنف صار غير نشط',
    not (select active from public.products where id='bbbbbbbb-0000-0000-0000-00000000000e'));
  perform public.test_assert('تليين: تبقى فواتيره وربحها قابلة للقراءة',
    exists (select 1 from public.sale_items i join public.sales s on s.id=i.sale_id
            where i.product_id='bbbbbbbb-0000-0000-0000-00000000000e'));
  perform public.test_expect_fail('تليين: لا يُباع صنف موقوف',
    $q$ select public.create_sale('{"items":[{"productId":"bbbbbbbb-0000-0000-0000-00000000000e","qty":1}],"method":"cash"}'::jsonb) $q$);
  r := public.restore_product('bbbbbbbb-0000-0000-0000-00000000000e');
  perform public.test_assert('تراجع التليين: عاد الصنف نشطًا',
    (select active from public.products where id='bbbbbbbb-0000-0000-0000-00000000000e'));
end $$;

\echo ''
\echo '── السيناريو 14: الضريبة والخصم (مطابقة معادلة JS) ──'
do $$
declare res jsonb; c record; e0 numeric;
begin
  perform public.as_admin();
  update public.settings set data = jsonb_set(data, '{taxRate}', '5');

  /* JS: taxable=140, subtotal=140 → tax = (140/140)*140*0.05 = 7 → total 147 */
  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000e','qty',1)),
    'method','cash'));
  perform public.test_assert('ضريبة 5٪ على صنف خاضع: tax = 7 وtotal = 147',
    (res -> 'sale' ->> 'tax')::numeric = 7 and (res -> 'sale' ->> 'total')::numeric = 147,
    'tax=' || (res -> 'sale' ->> 'tax') || ' total=' || (res -> 'sale' ->> 'total'));
  perform public.test_assert('ضريبة: دخل الصندوق 147 كاملًا',
    (select cash_collected from public.cash_summary('-infinity','infinity')) >= 147);

  /* صنف غير خاضع: الضريبة صفر رغم المعدل */
  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',1)),
    'method','cash'));
  perform public.test_assert('صنف غير خاضع: tax = 0', (res -> 'sale' ->> 'tax')::numeric = 0);

  /* خصم على الفاتورة: الربح = Σ qty×(price−cost) − الخصم */
  res := public.create_sale(jsonb_build_object(
    'items', jsonb_build_array(jsonb_build_object(
      'productId','bbbbbbbb-0000-0000-0000-00000000000a','qty',1)),
    'method','cash','discount',10));
  perform public.test_assert('خصم 10: الإجمالي 140 والربح 40',
    (res -> 'sale' ->> 'total')::numeric = 140 and (res -> 'sale' ->> 'profit')::numeric = 40,
    'total=' || (res -> 'sale' ->> 'total') || ' profit=' || (res -> 'sale' ->> 'profit'));

  update public.settings set data = jsonb_set(data, '{taxRate}', '0');
  perform public.test_identity('بعد الضريبة والخصم');
end $$;

\echo ''
\echo '── السيناريو 15: ثوابت عامة على كل البيانات ──'
do $$
declare c record; d record; v_bad int;
begin
  perform public.as_admin();
  select * into c from public.cash_summary('-infinity','infinity');
  select * into d from public.debts_summary('-infinity','infinity');

  /* كل فاتورة: الربح المخزّن = الربح المُعاد حسابه بمعادلة JS */
  select count(*) into v_bad from public.sales s
   where s.profit <> public.sale_profit_recomputed(s.id);
  perform public.test_assert('الربح المخزّن يطابق معادلة JS في كل الفواتير', v_bad = 0,
    v_bad || ' فاتورة مخالفة');

  /* paid ≤ total في كل فاتورة */
  perform public.test_assert('لا فاتورة مدفوعها أكبر من إجماليها',
    not exists (select 1 from public.sales where paid > total));

  /* الرصيد المشتق = مجموع الحركات لكل صنف */
  perform public.test_assert('الرصيد المشتق لا ينحرف عن دفتر الحركات',
    not exists (
      select 1 from public.products p
      where p.opening + coalesce((select sum(case m.type when 'out' then -m.qty else m.qty end)
                                  from public.stock_movements m where m.product_id = p.id),0)
            <> (select stock from public.product_stock where id = p.id)));

  /* هوية الديون: granted = collected + outstanding (في الفترة) */
  perform public.test_assert('هوية الديون: ممنوح = محصّل + متبقٍ',
    abs(d.granted - (d.down_paid + d.collected + d.range_outstanding)) < 0.001,
    d.granted || ' = ' || d.down_paid || ' + ' || d.collected || ' + ' || d.range_outstanding);

  /* لا باركود مكرر */
  perform public.test_assert('لا باركود مكرر',
    not exists (select barcode from public.products where barcode is not null
                group by barcode having count(*) > 1));

  perform public.test_info('الرصيد النهائي للصندوق', c.expected::text || ' د.ل');
  perform public.test_info('مكوّنات الصندوق',
    'نقدي ' || c.cash_collected || ' · مقدمات ' || c.credit_down_payment
    || ' · ديون ' || c.debt_cash || ' · إيداعات ' || c.other_in
    || ' · استرداد ' || c.refunds || ' · مصروفات ' || c.exp_cash
    || ' · سحوبات ' || c.other_out);
  perform public.test_info('خارج الصندوق', c.not_in_cash::text || ' د.ل (بطاقة + دين غير محصّل)');
  perform public.test_identity('الفحص الختامي');
end $$;

\echo ''
\echo '── السيناريو 16: المُرحَّل ضمن مدى يومي (سلوك cash.js نفسه) ──'
do $$
declare d record; c_all record; v_today_from timestamptz;
begin
  perform public.as_admin();
  /* من أول اليوم بتوقيت المحل — كما تحسبه الواجهة عبر HS.date.dayRange */
  v_today_from := date_trunc('day', now() at time zone public.store_tz()) at time zone public.store_tz();

  select * into d from public.cash_summary(v_today_from, 'infinity'::timestamptz);
  select * into c_all from public.cash_summary('-infinity','infinity');

  perform public.test_assert('المُرحَّل = كل ما قبل بداية اليوم (يشمل الرصيد الافتتاحي 2500)',
    d.carried >= 2500, d.carried::text || ' د.ل');
  perform public.test_assert('الرصيد = المُرحَّل + حركة اليوم',
    abs(d.expected - (d.carried + d.inflow - d.outflow)) < 0.001,
    d.expected || ' = ' || d.carried || ' + ' || d.inflow || ' − ' || d.outflow);
  perform public.test_assert('الرصيد في المدى اليومي = الرصيد على كل التاريخ',
    abs(d.expected - c_all.expected) < 0.001, d.expected::text || ' مقابل ' || c_all.expected::text);
  perform public.test_assert('حركة اليوم كلها مسجّلة (لا شيء ضائع بين المرحّل واليومي)',
    d.cash_collected + d.credit_down_payment + d.debt_cash + d.other_in
      + d.refunds + d.exp_cash + d.other_out >= 0
    and d.not_in_cash >= 0,
    'نقدي اليوم ' || d.cash_collected || ' · خارج الصندوق اليوم ' || d.not_in_cash);

  /* المُرحَّل لا يتغيّر بتكرار القراءة — أي لا يُحسب من حقل متراكم */
  declare
    d2 record;
  begin
    select * into d2 from public.cash_summary(v_today_from, 'infinity'::timestamptz);
    perform public.test_assert('المُرحَّل ثابت بين قراءتين متتاليتين', d2.carried = d.carried,
      d.carried::text || ' = ' || d2.carried::text);
  end;
end $$;

reset role;
select public.test_info('انتهت سيناريوهات الصندوق', (select count(*)::text || ' فحصًا' from tests.log));
