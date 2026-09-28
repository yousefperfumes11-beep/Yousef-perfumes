/* ═══════════════════════════════════════════════════════════════════
   005 — دوال المبيعات الذرّية
   ═══════════════════════════════════════════════════════════════════
   كل دالة security definer مع search_path مثبّت، وتتحقق من صلاحية
   المستدعي داخليًا. لا يمكن للواجهة كتابة sales أو sale_items أو
   stock_movements مباشرة (لا سياسات RLS لها — انظر 004).

   النقل حرفي عن:
     create_sale  ← HS.store.checkout   store.js:574-660 + منطق pos.js:463-474
     return_sale  ← HS.store.returnSale store.js:666-690
     pay_invoice  ← HS.store.paySale    store.js:692-711
   ═══════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   create_sale(payload jsonb) → jsonb

   الشكل المقبول (مطابق لما ترسله نقطة البيع):
   {
     "items": [{"productId":"uuid","qty":2,"price":560,"discount":0}],
     "method": "cash" | "card" | "credit",
     "paid": 560,                  // اختياري: دين → 0، وغيره → الإجمالي
     "customerId": "uuid"|null,
     "note": "",
     "discount": 0                 // خصم على الفاتورة كلها
   }

   في معاملة واحدة:
     1) تتحقق من الجلسة والصلاحية (pos_sell، وpos_discount عند وجود خصم)
     2) تقفل صفوف الأصناف (for update) ثم **تعيد التحقق من الرصيد**
        — حماية لا يوفّرها الكود الحالي: checkout لا يفحص الرصيد، بل
        تفحصه cart.add فقط، فيمكن لجهازين بيع آخر وحدة معًا
     3) تحسب subtotal/discount/tax/total بنفس معادلة JS حرفيًا
     4) تولّد رقم الفاتورة من sequence (لا من العميل)
     5) تنزّل المخزون بحركات out وتحسب الربح؛ والذمة تُشتقّ تلقائيًا
   ──────────────────────────────────────────────────────────────── */
create or replace function public.create_sale(payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor       uuid;
  v_method      public.pay_method;
  v_customer    uuid;
  v_customer_nm text;
  v_note        text;
  v_order_disc  numeric;
  v_rate        numeric  := 0;
  v_prefix      text     := 'INV';
  v_allow_neg   boolean  := false;
  v_ids         uuid[];
  v_subtotal    numeric  := 0;
  v_line_disc   numeric  := 0;
  v_taxable     numeric  := 0;
  v_tax         numeric  := 0;
  v_total       numeric;
  v_given       numeric;
  v_paid        numeric;
  v_change      numeric;
  v_status      public.sale_status;
  v_profit      numeric  := 0;
  v_number      text;
  v_seq         bigint;
  v_sale_id     uuid;
  v_year        text;
  v_items       jsonb    := '[]'::jsonb;   /* البنود بعد التحقق — متغير محلي لا جدول مشترك */
  v_price       numeric;
  r             record;
  v_guard       int := 0;
begin
  v_actor := public.require_actor();

  if not public.has_perm('pos_sell') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «إتمام عمليات البيع»'
      using errcode = '42501';
  end if;

  if coalesce(jsonb_array_length(payload -> 'items'), 0) = 0 then
    raise exception 'EMPTY_CART: السلة فارغة' using errcode = '22023';
  end if;

  begin
    v_method := coalesce(nullif(payload ->> 'method', ''), 'cash')::public.pay_method;
  exception when invalid_text_representation then
    raise exception 'BAD_METHOD: طريقة الدفع غير معروفة — المقبول نقدي أو بطاقة أو دين'
      using errcode = '22023';
  end;

  v_customer   := nullif(payload ->> 'customerId', '')::uuid;
  v_note       := coalesce(payload ->> 'note', '');
  v_order_disc := public.round3(coalesce((payload ->> 'discount')::numeric, 0));

  if v_order_disc < 0 then
    raise exception 'BAD_DISCOUNT: الخصم لا يمكن أن يكون سالبًا' using errcode = '22023';
  end if;
  if v_order_disc > 0 and not public.has_perm('pos_discount') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «منح خصم على الفاتورة»'
      using errcode = '42501';
  end if;

  select coalesce((data ->> 'taxRate')::numeric, 0),
         coalesce(nullif(data ->> 'invoicePrefix', ''), 'INV'),
         coalesce((data ->> 'allowNegativeStock')::boolean, false)
    into v_rate, v_prefix, v_allow_neg
    from public.settings where id = 1;

  if v_customer is not null then
    select c.name into v_customer_nm from public.customers c
     where c.id = v_customer and c.active;
    if v_customer_nm is null then
      raise exception 'NO_CUSTOMER: العميل غير موجود أو موقوف' using errcode = '22023';
    end if;
  else
    v_customer_nm := 'زبون نقدي';
  end if;

  /* ── المرحلة 1: قفل صفوف الأصناف بترتيب ثابت ──
     يجب أن يكون القفل عبارةً مستقلة تسبق قراءة الأرصدة. السبب دقيق
     وظهر في اختبار التسابق 40: تحت READ COMMITTED تأخذ العبارة لقطة
     واحدة عند بدايتها، فإذا حُبست على قفل صفٍّ ثم أُتمّت العملية الأخرى،
     فإن الاستعلام الفرعي الذي يحسب الرصيد داخل العبارة نفسها يظل يقرأ
     اللقطة القديمة — فينجح بيعان لآخر وحدة وينزل الرصيد تحت الصفر.
     عبارة ثانية = لقطة جديدة ترى ما أتمّه الجهاز الآخر فعلًا.
     والترتيب الثابت (order by id) يقلّل احتمال deadlock بين جهازين. */
  select array_agg(distinct nullif(i ->> 'productId', '')::uuid
                   order by nullif(i ->> 'productId', '')::uuid)
    into v_ids
    from jsonb_array_elements(payload -> 'items') as i;

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'EMPTY_CART: السلة فارغة' using errcode = '22023';
  end if;

  perform p.id
    from public.products p
   where p.id = any (v_ids)
   for update of p;

  /* ── المرحلة 2: التحقق من الرصيد والجمع (الأقفال معنا، واللقطة جديدة) ──
     price اختياري من العميل لأن الكاشير يستطيع تعديل سعر السطر
     (HS.store.cart.setPrice)؛ أما التكلفة فمن القاعدة دائمًا.
     الرصيد يُحسب باستعلام فرعي لا بالانضمام إلى عرض فيه تجميع،
     لأن FOR UPDATE لا يعمل مع التجميع. */
  for r in
    select p.id, p.name, p.brand, p.size_label, p.unit, p.barcode,
           p.cost as db_cost, p.price as db_price, p.taxable as db_taxable,
           p.active as db_active,
           p.opening + coalesce((
             select sum(case m.type when 'out' then -m.qty else m.qty end)
             from public.stock_movements m where m.product_id = p.id), 0) as stock,
           req.qty, req.req_price, req.line_discount
      from jsonb_array_elements(payload -> 'items') as i
      join lateral (
        select nullif(i ->> 'productId', '')::uuid               as product_id,
               greatest(0, coalesce((i ->> 'qty')::numeric, 0))  as qty,
               nullif(i ->> 'price', '')::numeric                as req_price,
               public.round3(coalesce((i ->> 'discount')::numeric, 0)) as line_discount
      ) req on true
      join public.products p on p.id = req.product_id
      for update of p
  loop
    if r.qty <= 0 then
      raise exception 'BAD_QTY: الكمية يجب أن تكون أكبر من صفر' using errcode = '22023';
    end if;
    if not r.db_active then
      raise exception 'INACTIVE_PRODUCT: الصنف «%» موقوف', r.name using errcode = '22023';
    end if;
    /* نفس رسالة cart.add في store.js:505 */
    if not v_allow_neg and r.stock < r.qty then
      raise exception 'NOT_ENOUGH_STOCK: المتاح من «%» هو % % فقط',
        r.name, trim_scale(r.stock), r.unit using errcode = '22023';
    end if;

    v_price := coalesce(r.req_price, r.db_price);

    v_subtotal  := v_subtotal + (r.qty * v_price);
    v_line_disc := v_line_disc + r.line_discount;
    if r.db_taxable then
      v_taxable := v_taxable + (r.qty * v_price - r.line_discount);
    end if;
    v_profit := v_profit + (r.qty * (v_price - r.db_cost));

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'productId', r.id,
      'name', r.name || coalesce(' · ' || r.size_label, ''),
      'brand', r.brand, 'size', r.size_label, 'unit', r.unit, 'barcode', r.barcode,
      'qty', r.qty, 'price', v_price, 'cost', r.db_cost, 'discount', r.line_discount));
  end loop;

  if jsonb_array_length(v_items) = 0 then
    raise exception 'EMPTY_CART: السلة فارغة' using errcode = '22023';
  end if;

  v_subtotal  := public.round3(v_subtotal);
  v_line_disc := public.round3(v_line_disc);

  /* معادلة الضريبة حرفيًا كما في store.js:599 */
  v_tax := public.round3(
    (v_taxable / greatest(v_subtotal - v_line_disc, 1))
    * greatest(v_subtotal - v_line_disc - v_order_disc, 0)
    * (v_rate / 100.0)
  );
  v_total := public.round3(greatest(0, v_subtotal - v_line_disc - v_order_disc + v_tax));

  /* المدفوع: دين → 0 إلا ما دُفع وقت البيع (store.js:619-623) */
  v_given := coalesce(nullif(payload ->> 'paid', '')::numeric,
                      case when v_method = 'credit' then 0 else v_total end);
  v_paid  := public.round3(least(greatest(v_given, 0), v_total));
  v_change := public.round3(greatest(0, v_given - v_total));

  /* الحالة: منطق pos.js:464-466 نفسه */
  v_status := case
    when v_method = 'credit' and v_paid <= 0.0009 then 'unpaid'::public.sale_status
    when v_paid + 0.0009 < v_total                then 'partial'::public.sale_status
    else 'paid'::public.sale_status
  end;

  /* الربح = Σ qty×(price−cost) − خصم الفاتورة (store.js:259) */
  v_profit := public.round3(v_profit - (v_line_disc + v_order_disc));

  /* ── رقم الفاتورة من التسلسل: PREFIX-YYYY-NNNN (القرار 18) ── */
  v_year := to_char(now() at time zone public.store_tz(), 'YYYY');
  loop
    v_seq := nextval('public.sale_number_seq');
    v_number := v_prefix || '-' || v_year || '-' || right((1000 + v_seq)::text, 4);
    exit when not exists (select 1 from public.sales s where s.number = v_number);
    v_guard := v_guard + 1;
    if v_guard > 500 then
      raise exception 'NUMBERING: تعذّر توليد رقم فاتورة غير مكرر';
    end if;
  end loop;

  insert into public.sales (number, seller_id, customer_id, customer_name, status,
                            payment_method, subtotal, discount, tax, total, paid,
                            change_due, profit, note, created_at)
  values (v_number, v_actor, v_customer, v_customer_nm, v_status, v_method,
          v_subtotal, public.round3(v_line_disc + v_order_disc), v_tax, v_total,
          v_paid, v_change, v_profit, v_note, now())
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, product_id, name_snapshot, brand, size_label,
                                 unit, barcode, qty, unit_price, unit_cost,
                                 line_discount, line_total)
  select v_sale_id, (i ->> 'productId')::uuid, i ->> 'name', i ->> 'brand', i ->> 'size',
         i ->> 'unit', i ->> 'barcode', (i ->> 'qty')::numeric,
         (i ->> 'price')::numeric, (i ->> 'cost')::numeric, (i ->> 'discount')::numeric,
         public.round3((i ->> 'qty')::numeric * (i ->> 'price')::numeric
                       - (i ->> 'discount')::numeric)
  from jsonb_array_elements(v_items) as i;

  /* تنزيل المخزون بحركات out — الرصيد مشتق منها (store.js:635-641) */
  insert into public.stock_movements (product_id, type, qty, reason, ref_type, ref_id, actor_id)
  select (i ->> 'productId')::uuid, 'out', (i ->> 'qty')::numeric, 'بيع', 'sale', v_number, v_actor
  from jsonb_array_elements(v_items) as i;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'create_sale', 'sales', v_sale_id::text,
          jsonb_build_object('number', v_number, 'total', v_total, 'paid', v_paid,
                             'method', v_method, 'status', v_status, 'profit', v_profit));

  return jsonb_build_object(
    'ok', true,
    'sale', (select jsonb_build_object(
               'id', s.id, 'number', s.number, 'status', s.status,
               'method', s.payment_method, 'subtotal', s.subtotal,
               'discount', s.discount, 'tax', s.tax, 'total', s.total,
               'paid', s.paid, 'change', s.change_due, 'profit', s.profit,
               'customerId', s.customer_id, 'customerName', s.customer_name,
               'date', s.created_at, 'note', s.note,
               'items', (select jsonb_agg(jsonb_build_object(
                            'productId', i.product_id, 'name', i.name_snapshot,
                            'brand', i.brand, 'size', i.size_label, 'unit', i.unit,
                            'barcode', i.barcode, 'qty', i.qty, 'price', i.unit_price,
                            'cost', i.unit_cost, 'discount', i.line_discount)
                            order by i.id)
                         from public.sale_items i where i.sale_id = s.id))
             from public.sales s where s.id = v_sale_id)
  );
end $$;

/* ────────────────────────────────────────────────────────────────
   return_sale — مطابقة لـ HS.store.returnSale
   تعيد المخزون، ويخرج النقد من الصندوق عبر حدث refund المشتق،
   والذمة تنقص تلقائيًا لأن المرتجع مستثنى من الاشتقاق.
   ──────────────────────────────────────────────────────────────── */
create or replace function public.return_sale(p_sale_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid;
  v_sale  public.sales;
begin
  v_actor := public.require_actor();
  if not public.has_perm('sales_refund') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تعديل وإلغاء العمليات»'
      using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'NOT_FOUND: الفاتورة غير موجودة' using errcode = 'P0002';
  end if;
  if v_sale.status = 'returned' then
    raise exception 'ALREADY_RETURNED: هذه الفاتورة مرتجعة مسبقًا' using errcode = '22023';
  end if;

  update public.sales
     set status = 'returned',
         return_reason = coalesce(p_reason, ''),
         returned_at = now()
   where id = p_sale_id;

  insert into public.stock_movements (product_id, type, qty, reason, ref_type, ref_id, actor_id)
  select i.product_id, 'return', i.qty, 'إرجاع من العميل', 'return', v_sale.number, v_actor
  from public.sale_items i
  where i.sale_id = p_sale_id and i.product_id is not null;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'return_sale', 'sales', p_sale_id::text,
          jsonb_build_object('status', v_sale.status, 'paid', v_sale.paid),
          jsonb_build_object('status', 'returned', 'reason', coalesce(p_reason, '')));

  return jsonb_build_object('ok', true, 'saleId', p_sale_id, 'number', v_sale.number,
                            'refunded', case when v_sale.payment_method in ('cash','credit')
                                             then v_sale.paid else 0 end);
end $$;

/* ────────────────────────────────────────────────────────────────
   pay_invoice — مطابقة لـ HS.store.paySale (القرار 6: بلا توزيع)

   ⚠ سلوك محفوظ من الكود الحالي وموثّق في تقرير المرحلة 0 (بند 12):
   لأن حدث القبض مشتق من sales.paid بتاريخ البيع، فإن تسديد فاتورة
   قديمة **يضيف النقد إلى الصندوق بتاريخ البيع الأصلي** لا بتاريخ
   اليوم. وتغيير طريقة الدفع إلى «بطاقة» يُخرج النقد المحتسب سابقًا.
   القرار كان «مطابقة»، فنُقل السلوك كما هو وسُجّل في audit_log.
   ──────────────────────────────────────────────────────────────── */
create or replace function public.pay_invoice(p_sale_id uuid, p_amount numeric,
                                              p_method public.pay_method default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor  uuid;
  v_sale   public.sales;
  v_due    numeric;
  v_pay    numeric;
  v_status public.sale_status;
begin
  v_actor := public.require_actor();
  if not public.has_perm('debts_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تسجيل الديون والدفعات»'
      using errcode = '42501';
  end if;

  select * into v_sale from public.sales where id = p_sale_id for update;
  if not found then
    raise exception 'NOT_FOUND: الفاتورة غير موجودة' using errcode = 'P0002';
  end if;
  if v_sale.status = 'returned' then
    raise exception 'RETURNED: لا يمكن تسديد فاتورة مرتجعة' using errcode = '22023';
  end if;

  v_due := public.round3(v_sale.total - v_sale.paid);
  v_pay := public.round3(least(greatest(coalesce(p_amount, 0), 0), v_due));
  if v_pay <= 0 then
    raise exception 'BAD_AMOUNT: المبلغ غير صالح' using errcode = '22023';
  end if;

  v_status := case when public.round3(v_sale.paid + v_pay) >= v_sale.total
                   then 'paid'::public.sale_status
                   else 'partial'::public.sale_status end;

  update public.sales
     set paid = public.round3(paid + v_pay),
         payment_method = coalesce(p_method, payment_method),
         status = v_status
   where id = p_sale_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'pay_invoice', 'sales', p_sale_id::text,
          jsonb_build_object('paid', v_sale.paid, 'status', v_sale.status,
                             'method', v_sale.payment_method),
          jsonb_build_object('paid', public.round3(v_sale.paid + v_pay), 'status', v_status,
                             'method', coalesce(p_method, v_sale.payment_method)));

  return jsonb_build_object('ok', true, 'saleId', p_sale_id, 'paid', v_pay,
                            'remaining', public.round3(v_due - v_pay), 'status', v_status);
end $$;

grant execute on function public.create_sale(jsonb)          to authenticated;
grant execute on function public.return_sale(uuid, text)     to authenticated;
grant execute on function public.pay_invoice(uuid, numeric, public.pay_method) to authenticated;
