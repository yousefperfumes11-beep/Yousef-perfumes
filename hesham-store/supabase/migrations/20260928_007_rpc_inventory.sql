/* ═══════════════════════════════════════════════════════════════════
   007 — دوال المخزون والمشتريات
   ═══════════════════════════════════════════════════════════════════
     adjust_stock    ← HS.store.adjustStock     store.js:795-812
     receive_purchase← HS.store.receivePurchase store.js:~905
     cancel_purchase ← purchases.js:455         (كان يعدّل الحالة مباشرة)
     pay_supplier    ← purchases.js:420-424     (كان يعدّل الحالة مباشرة)
     soft_delete_product / restore_product ← القرار 13 (تليين الحذف)

   القرار 7 = مطابقة: receive_purchase **لا يحدّث التكلفة** ولا متوسطها،
   لأن الكود الحالي لا يفعل ذلك (يتحقق منه البرومت صراحة).
   القرار 15 = مطابقة: دفعة المورد **لا تمسّ الصندوق**.
   ═══════════════════════════════════════════════════════════════════ */

/** تسوية جرد: حركة adjust + سبب (الرصيد مشتق من الحركات) */
create or replace function public.adjust_stock(
  p_product_id uuid, p_delta numeric, p_reason text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_name text; v_delta numeric; v_id bigint; v_stock numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('inventory_adjust') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تعديل أرصدة المخزون»' using errcode = '42501';
  end if;

  select p.name || coalesce(' · ' || p.size_label, '') into v_name
    from public.products p where p.id = p_product_id;
  if v_name is null then
    raise exception 'NOT_FOUND: الصنف غير موجود' using errcode = 'P0002';
  end if;

  v_delta := round(coalesce(p_delta, 0));
  if v_delta = 0 then
    raise exception 'NO_CHANGE: لا يوجد تغيير في الكمية' using errcode = '22023';
  end if;

  insert into public.stock_movements
    (product_id, type, qty, reason, ref_type, ref_id, actor_id)
  values (p_product_id, 'adjust', v_delta,
          coalesce(nullif(trim(coalesce(p_reason, '')), ''),
                   case when v_delta > 0 then 'زيادة جرد' else 'نقص جرد' end),
          'adjust', 'ADJ-' || floor(random() * 900 + 100)::int::text, v_actor)
  returning id into v_id;

  select coalesce(ps.stock, 0) into v_stock from public.product_stock ps where ps.id = p_product_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'adjust_stock', 'stock_movements', v_id::text,
          jsonb_build_object('product', v_name, 'delta', v_delta, 'stock', v_stock));

  return jsonb_build_object('ok', true, 'movementId', v_id, 'delta', v_delta,
                            'product', v_name, 'stock', v_stock);
end $$;

/** استلام أمر شراء: يزيد المخزون بحركات in — بلا تغيير تكلفة (القرار 7) */
create or replace function public.receive_purchase(p_po_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_po public.purchases; v_n int;
begin
  v_actor := public.require_actor();
  if not public.has_perm('purchases_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «إدارة المشتريات»' using errcode = '42501';
  end if;

  select * into v_po from public.purchases where id = p_po_id for update;
  if not found then
    raise exception 'NOT_FOUND: طلب الشراء غير موجود' using errcode = 'P0002';
  end if;
  if v_po.status = 'received' then
    raise exception 'ALREADY_RECEIVED: تم استلام هذا الطلب مسبقًا' using errcode = '22023';
  end if;
  if v_po.status = 'cancelled' then
    raise exception 'CANCELLED: لا يمكن استلام أمر ملغى' using errcode = '22023';
  end if;

  update public.purchases set status = 'received', received_at = now() where id = p_po_id;

  insert into public.stock_movements
    (product_id, type, qty, reason, ref_type, ref_id, actor_id)
  select i.product_id, 'in', i.qty, 'استلام مشتريات', 'purchase', v_po.number, v_actor
  from public.purchase_items i
  where i.purchase_id = p_po_id and i.product_id is not null;

  get diagnostics v_n = row_count;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'receive_purchase', 'purchases', p_po_id::text,
          jsonb_build_object('status', v_po.status),
          jsonb_build_object('status', 'received', 'lines', v_n));

  return jsonb_build_object('ok', true, 'purchaseId', p_po_id, 'number', v_po.number, 'lines', v_n);
end $$;

/** إلغاء أمر شراء — كان يعدّل الحالة مباشرة في purchases.js:455 */
create or replace function public.cancel_purchase(p_po_id uuid, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid; v_po public.purchases;
begin
  v_actor := public.require_actor();
  if not public.has_perm('purchases_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «إدارة المشتريات»' using errcode = '42501';
  end if;
  select * into v_po from public.purchases where id = p_po_id for update;
  if not found then raise exception 'NOT_FOUND: طلب الشراء غير موجود' using errcode = 'P0002'; end if;
  if v_po.status = 'received' then
    raise exception 'ALREADY_RECEIVED: لا يُلغى أمر مستلم — أرجِع أصنافه بتسوية مخزون' using errcode = '22023';
  end if;
  update public.purchases set status = 'cancelled', note = trim(coalesce(note,'') || coalesce(' — إلغاء: ' || p_reason, ''))
   where id = p_po_id;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'cancel_purchase', 'purchases', p_po_id::text,
          jsonb_build_object('status', v_po.status), jsonb_build_object('status','cancelled'));
  return jsonb_build_object('ok', true, 'purchaseId', p_po_id, 'previousStatus', v_po.status);
end $$;

/** دفعة لمورد — مطابقة: تزيد مدفوع الأمر ولا تمسّ الصندوق (القرار 15) */
create or replace function public.pay_supplier(
  p_purchase_id uuid, p_amount numeric,
  p_method public.pay_method default 'cash', p_note text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_po public.purchases; v_pay numeric; v_id uuid; v_supplier uuid;
begin
  v_actor := public.require_actor();
  if not public.has_perm('purchases_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «إدارة المشتريات»' using errcode = '42501';
  end if;

  select * into v_po from public.purchases where id = p_purchase_id for update;
  if not found then raise exception 'NOT_FOUND: طلب الشراء غير موجود' using errcode = 'P0002'; end if;

  v_pay := public.round3(coalesce(p_amount, 0));
  if v_pay <= 0 then raise exception 'BAD_AMOUNT: أدخل مبلغًا موجبًا' using errcode = '22023'; end if;
  if v_po.paid + v_pay > v_po.total + 0.001 then
    raise exception 'OVER_TOTAL: المبلغ أكبر من المتبقي على الأمر' using errcode = '22023';
  end if;

  v_supplier := v_po.supplier_id;
  update public.purchases set paid = public.round3(paid + v_pay) where id = p_purchase_id;

  insert into public.supplier_payments (supplier_id, purchase_id, amount, method, note, actor_id)
  values (v_supplier, p_purchase_id, v_pay, coalesce(p_method,'cash'), coalesce(p_note,''), v_actor)
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'pay_supplier', 'supplier_payments', v_id::text,
          jsonb_build_object('po', v_po.number, 'amount', v_pay, 'method', coalesce(p_method,'cash'),
                             'inCashbox', false));

  return jsonb_build_object('ok', true, 'paymentId', v_id, 'amount', v_pay,
                            'poPaid', public.round3(v_po.paid + v_pay),
                            'poTotal', v_po.total, 'inCashbox', false);
end $$;

/** تليين الحذف (القرار 13): يبقى التاريخ والأرباح سليمة */
create or replace function public.soft_delete_product(p_product_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid; v_name text; v_stock numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('products_edit') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تعديل المنتجات والأسعار»' using errcode = '42501';
  end if;
  select p.name || coalesce(' · ' || p.size_label, '') into v_name
    from public.products p where p.id = p_product_id for update;
  if v_name is null then raise exception 'NOT_FOUND: الصنف غير موجود' using errcode = 'P0002'; end if;

  update public.products set active = false, deleted_at = now() where id = p_product_id;
  select coalesce(ps.stock,0) into v_stock from public.product_stock ps where ps.id = p_product_id;

  return jsonb_build_object('ok', true, 'product', v_name, 'stock', v_stock,
                            'restorable', true);
end $$;

/** التراجع عن التليين — بديل undo() في الذاكرة */
create or replace function public.restore_product(p_product_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare v_actor uuid; v_name text;
begin
  v_actor := public.require_actor();
  if not public.has_perm('products_edit') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تعديل المنتجات والأسعار»' using errcode = '42501';
  end if;
  update public.products set active = true, deleted_at = null
   where id = p_product_id
   returning name || coalesce(' · ' || size_label, '') into v_name;
  if v_name is null then raise exception 'NOT_FOUND: الصنف غير موجود' using errcode = 'P0002'; end if;
  return jsonb_build_object('ok', true, 'product', v_name);
end $$;

grant execute on function public.adjust_stock(uuid, numeric, text) to authenticated;
grant execute on function public.receive_purchase(uuid) to authenticated;
grant execute on function public.cancel_purchase(uuid, text) to authenticated;
grant execute on function public.pay_supplier(uuid, numeric, public.pay_method, text) to authenticated;
grant execute on function public.soft_delete_product(uuid) to authenticated;
grant execute on function public.restore_product(uuid) to authenticated;
