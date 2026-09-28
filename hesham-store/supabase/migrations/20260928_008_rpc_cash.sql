/* ═══════════════════════════════════════════════════════════════════
   008 — دوال الصندوق والإعدادات النقدية
   ═══════════════════════════════════════════════════════════════════
     add_cash_entry   ← HS.store.addCashEntry      store.js:1218-1236
     delete_cash_entry← HS.store.deleteCashEntry   store.js:1238-1245 (تليين)
     set_opening_cash ← syncOpeningCash            settings.js:404-427
     record_cash_count← «جرد الصندوق»              cash.js:374-427

   القرار 5: الصندوق يُشتق ولا يُخزَّن. الجدول المخزّن الوحيد هنا هو
   cash_entries للقيود اليدوية (إيداع/سحب/رصيد افتتاحي/فرق جرد).
   القرار 8: لا وردية ولا إغلاق يومي في الكود الحالي — الموجود جرد
   يقارن المعدود بالرصيد المتوقع **على كل التاريخ** range("all").
   ═══════════════════════════════════════════════════════════════════ */

/** إيداع أو سحب يدوي */
create or replace function public.add_cash_entry(
  p_direction public.cash_direction,
  p_amount    numeric,
  p_reason    text default null,
  p_ts        timestamptz default null,
  p_kind      text default null
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_amt numeric; v_reason text; v_id uuid; v_expected numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('cash_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «الإيداع والسحب من الصندوق»'
      using errcode = '42501';
  end if;

  v_amt := public.round3(coalesce(p_amount, 0));
  if v_amt <= 0 then
    raise exception 'BAD_AMOUNT: أدخل مبلغًا موجبًا' using errcode = '22023';
  end if;

  v_reason := coalesce(nullif(trim(coalesce(p_reason, '')), ''),
                       case when p_direction = 'out' then 'سحب من الصندوق'
                            else 'إيداع في الصندوق' end);

  insert into public.cash_entries (direction, amount, reason, kind, actor_id, created_at)
  values (p_direction, v_amt, v_reason,
          /* الأنواع المسموحة في الصندوق (قرار 2): deposit/withdraw/opening/count_diff —
             القيد اليدوي بلا نوع صريح يُصنَّف حسب اتجاهه، كما تفعل الواجهة اليوم */
          case
            when p_kind in ('opening','count_diff','deposit','withdraw') then p_kind
            when p_direction = 'out' then 'withdraw'
            else 'deposit'
          end,
          v_actor, coalesce(p_ts, now()))
  returning id into v_id;

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'entryId', v_id, 'amount', v_amt,
                            'direction', p_direction, 'reason', v_reason,
                            'expected', v_expected);
end $$;

/** حذف قيد يدوي — تليين حتى يبقى الأثر في audit_log (بديل undo في الذاكرة) */
create or replace function public.delete_cash_entry(p_entry_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_rec public.cash_entries; v_expected numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('cash_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «الإيداع والسحب من الصندوق»'
      using errcode = '42501';
  end if;

  select * into v_rec from public.cash_entries where id = p_entry_id and deleted_at is null for update;
  if not found then
    raise exception 'NOT_FOUND: العملية غير موجودة' using errcode = 'P0002';
  end if;
  if v_rec.kind = 'opening' then
    raise exception 'OPENING_LOCKED: الرصيد الافتتاحي لا يُحذف — عدّله من الإعدادات'
      using errcode = '22023';
  end if;

  update public.cash_entries set deleted_at = now() where id = p_entry_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (v_actor, 'delete_cash_entry', 'cash_entries', p_entry_id::text, to_jsonb(v_rec));

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'entryId', p_entry_id, 'expected', v_expected);
end $$;

/**
 * الرصيد الافتتاحي: قيد واحد فريد (فهرس جزئي في 002).
 * مطابق لسلوك settings.js — تغييره يوائم القيد نفسه لا adds قيدًا جديدًا.
 */
create or replace function public.set_opening_cash(p_amount numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_amt numeric; v_id uuid; v_prev numeric; v_expected numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('settings_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «إدارة إعدادات النظام»' using errcode = '42501';
  end if;

  v_amt := public.round3(greatest(0, coalesce(p_amount, 0)));

  select amount, id into v_prev, v_id from public.cash_entries
   where kind = 'opening' and deleted_at is null
   for update;

  if found then
    if abs(v_prev - v_amt) < 0.0005 then
      select expected into v_expected
        from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);
      return jsonb_build_object('ok', true, 'unchanged', true, 'amount', v_amt,
                                'expected', v_expected);
    end if;
    update public.cash_entries set amount = v_amt where id = v_id;
  else
    insert into public.cash_entries (direction, amount, reason, kind, actor_id, created_at)
    values ('in', v_amt, 'رصيد افتتاحي للصندوق', 'opening', v_actor,
            coalesce((select min(created_at) - interval '1 day' from public.sales), now()))
    returning id into v_id;
  end if;

  update public.settings
     set data = jsonb_set(data, '{cashOpening}', to_jsonb(v_amt)),
         updated_at = now(), updated_by = v_actor
   where id = 1;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (v_actor, 'set_opening_cash', 'cash_entries', v_id::text,
          jsonb_build_object('amount', v_prev), jsonb_build_object('amount', v_amt));

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'entryId', v_id, 'amount', v_amt,
                            'previous', v_prev, 'expected', v_expected);
end $$;

/**
 * جرد الصندوق — مطابقة لـ cash.js:374-427.
 * يقارن المبلغ المعدود بالرصيد المتوقع على **كل التاريخ**،
 * ويسجّل الفرق قيدًا يدويًا من نوع count_diff.
 */
create or replace function public.record_cash_count(p_actual numeric, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_actual numeric; v_expected numeric; v_diff numeric; v_id uuid;
  v_reason text;
begin
  v_actor := public.require_actor();
  if not public.has_perm('cash_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «الإيداع والسحب من الصندوق»'
      using errcode = '42501';
  end if;

  v_actual := public.round3(coalesce(p_actual, -1));
  if v_actual < 0 then
    raise exception 'BAD_AMOUNT: أدخل المبلغ المعدود' using errcode = '22023';
  end if;

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);
  v_diff := public.round3(v_actual - v_expected);

  if abs(v_diff) < 0.001 then
    return jsonb_build_object('ok', true, 'matched', true, 'actual', v_actual,
                              'expected', v_expected, 'diff', 0);
  end if;

  v_reason := (case when v_diff > 0 then 'زيادة جرد الصندوق' else 'عجز جرد الصندوق' end)
              || coalesce(' — ' || nullif(trim(coalesce(p_note, '')), ''), '');

  insert into public.cash_entries (direction, amount, reason, kind, actor_id, created_at)
  values ((case when v_diff > 0 then 'in' else 'out' end)::public.cash_direction,
          abs(v_diff), v_reason, 'count_diff', v_actor, now())
  returning id into v_id;

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'matched', false, 'actual', v_actual,
                            'diff', v_diff, 'entryId', v_id, 'reason', v_reason,
                            'expected', v_expected);
end $$;

grant execute on function public.add_cash_entry(public.cash_direction, numeric, text, timestamptz, text) to authenticated;
grant execute on function public.delete_cash_entry(uuid) to authenticated;
grant execute on function public.set_opening_cash(numeric) to authenticated;
grant execute on function public.record_cash_count(numeric, text) to authenticated;

/**
 * حذف مصروف — تليين (deleted_at)، مطابقةً لزر الحذف في صفحة المصروفات.
 * cash_events يرشّح deleted_at is null فيخرج المبلغ من الصندوق فورًا،
 * ويبقى السجل قابلاً للاسترجاع ومقروءًا في التدقيق.
 */
create or replace function public.delete_expense(p_expense_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_rec public.expenses; v_expected numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('expenses_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تسجيل المصروفات»' using errcode = '42501';
  end if;

  select * into v_rec from public.expenses
   where id = p_expense_id and deleted_at is null for update;
  if not found then
    raise exception 'NOT_FOUND: المصروف غير موجود' using errcode = 'P0002';
  end if;

  update public.expenses set deleted_at = now() where id = p_expense_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, before)
  values (v_actor, 'delete_expense', 'expenses', p_expense_id::text, to_jsonb(v_rec));

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'expenseId', p_expense_id,
                            'amount', v_rec.amount, 'method', v_rec.method,
                            'expected', v_expected);
end $$;

/** تراجع عن حذف مصروف — بلا أثر نقدي إن كان الحذف لم يغيّر شيئًا */
create or replace function public.restore_expense(p_expense_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid; v_rec public.expenses; v_expected numeric;
begin
  v_actor := public.require_actor();
  if not public.has_perm('expenses_manage') then
    raise exception 'FORBIDDEN: ليست لديك صلاحية «تسجيل المصروفات»' using errcode = '42501';
  end if;

  select * into v_rec from public.expenses
   where id = p_expense_id and deleted_at is not null for update;
  if not found then
    raise exception 'NOT_FOUND: لا يوجد مصروف محذوف بهذا المعرّف' using errcode = 'P0002';
  end if;

  update public.expenses set deleted_at = null where id = p_expense_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (v_actor, 'restore_expense', 'expenses', p_expense_id::text, to_jsonb(v_rec));

  select expected into v_expected
    from public.cash_summary('-infinity'::timestamptz, 'infinity'::timestamptz);

  return jsonb_build_object('ok', true, 'expenseId', p_expense_id, 'expected', v_expected);
end $$;

grant execute on function public.delete_expense(uuid) to authenticated;
grant execute on function public.restore_expense(uuid) to authenticated;
