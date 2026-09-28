#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  40_concurrency.sh — تسابق جهازين على العملية نفسها
# ═══════════════════════════════════════════════════════════════════
#  مطلب البرومت: «يفتح التطبيق جهازان فيبيعان آخر وحدة في اللحظة
#  نفسها: واحد ينجح والآخر يُرفض برسالة مفهومة».
#
#  كل سباق جلستا psql متوازيتان؛ الأولى تحبس القفل ثانيةً واحدة
#  (pg_sleep داخل المعاملة) حتى تدخل الثانية فعلًا في التسابق لا بعده.
#
#  الاستعمال:  bash supabase/tests/40_concurrency.sh [dbname]
# ═══════════════════════════════════════════════════════════════════
set -u
DB="${1:-youssef_dev}"
PSQL="psql -d $DB -X -q -tA -v ON_ERROR_STOP=0"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

ADMIN='11111111-1111-1111-1111-111111111111'
SELLER='22222222-2222-2222-2222-222222222222'
PROD_B='bbbbbbbb-0000-0000-0000-00000000000b'   # آخر وحدة
PROD_A='bbbbbbbb-0000-0000-0000-00000000000a'
CUST='cccccccc-0000-0000-0000-000000000001'

PASS=0; FAIL=0
say()  { printf '  ✓ %s — %s\n' "$1" "$2"; PASS=$((PASS+1)); }
bad()  { printf '  ✗ %s — %s\n' "$1" "$2"; FAIL=$((FAIL+1)); }
log()  { $PSQL -c "select public.test_assert('$1', $2, \$q\$$3\$q\$)" >/dev/null 2>&1; }

# جلسة بدور العميل الحقيقي وهوية بائع
sess() { echo "set role authenticated; select set_config('app.uid','$SELLER',false);"; }

echo ''
echo '── السباق 1: جهازان يبيعان آخر وحدة ──'
# تحضير حتمي: رصيد «ب» وحدة واحدة بالضبط، و«أ» يكفي لبقية السباقات
$PSQL -c "update public.products set opening = 1 where id = '$PROD_B';
          delete from public.stock_movements where product_id = '$PROD_B';
          update public.products set opening = 50 where id = '$PROD_A';
          delete from public.stock_movements where product_id = '$PROD_A';" >/dev/null 2>&1
BEFORE=$($PSQL -c "select stock from public.product_stock where id='$PROD_B'")
SALE="{\"items\":[{\"productId\":\"$PROD_B\",\"qty\":1}],\"method\":\"cash\"}"

( $PSQL -c "$(sess) begin; select public.create_sale('$SALE'::jsonb) -> 'sale' ->> 'number'; select pg_sleep(1.5); commit;" >"$TMP/a" 2>&1 ) &
sleep 0.4
( $PSQL -c "$(sess) select public.create_sale('$SALE'::jsonb) -> 'sale' ->> 'number';" >"$TMP/b" 2>&1 ) &
wait

A=$(cat "$TMP/a"); B=$(cat "$TMP/b")
OK=0; DENIED=0
for out in "$A" "$B"; do
  case "$out" in
    *NOT_ENOUGH_STOCK*) DENIED=$((DENIED+1)) ;;
    *INV-*|*ERROR*)     : ;;
  esac
  echo "$out" | grep -qE '^[A-Z]+-[0-9]{4}-[0-9]{4}$' && OK=$((OK+1))
done
AFTER=$($PSQL -c "select stock from public.product_stock where id='$PROD_B'")

if [ "$OK" -eq 1 ]; then say 'سباق آخر وحدة' 'نجحت عملية واحدة بالضبط'; else bad 'سباق آخر وحدة' "نجحت $OK عملية"; fi
if [ "$DENIED" -eq 1 ]; then say 'رفض الثانية' "$(echo "$B" | grep -o 'NOT_ENOUGH_STOCK.*' | head -c 70)"; else bad 'رفض الثانية' "رُفضت $DENIED"; fi
if [ "$AFTER" = "0.000" ] || [ "$AFTER" = "0" ]; then say 'الرصيد بعد السباق' "صفر (كان $BEFORE)"; else bad 'الرصيد بعد السباق' "$AFTER"; fi
if [ "$(printf '%s' "$AFTER" | cut -d. -f1)" -ge 0 ]; then say 'لم ينزل الرصيد تحت الصفر' "$AFTER"; else bad 'لم ينزل الرصيد تحت الصفر' "$AFTER"; fi

echo ''
echo '── السباق 2: تسلسل أرقام الفواتير ──'
SALE_A="{\"items\":[{\"productId\":\"$PROD_A\",\"qty\":1}],\"method\":\"cash\"}"
( $PSQL -c "$(sess) begin; select public.create_sale('$SALE_A'::jsonb) -> 'sale' ->> 'number'; select pg_sleep(0.8); commit;" >"$TMP/n1" 2>&1 ) &
( $PSQL -c "set role authenticated; select set_config('app.uid','$ADMIN',false); begin; select public.create_sale('$SALE_A'::jsonb) -> 'sale' ->> 'number'; select pg_sleep(0.8); commit;" >"$TMP/n2" 2>&1 ) &
wait
N1=$(grep -oE '^[A-Z]+-[0-9]{4}-[0-9]{4}$' "$TMP/n1" | head -1)
N2=$(grep -oE '^[A-Z]+-[0-9]{4}-[0-9]{4}$' "$TMP/n2" | head -1)
DUP=$($PSQL -c "select count(*) - count(distinct number) from public.sales")
if [ -n "$N1" ] && [ -n "$N2" ] && [ "$N1" != "$N2" ]; then say 'رقمان مختلفان' "$N1 · $N2"; else bad 'رقمان مختلفان' "$N1 · $N2"; fi
if [ "$DUP" = "0" ]; then say 'لا رقم مكرر في الفواتير كلها' "تكرارات = $DUP"; else bad 'لا رقم مكرر' "$DUP"; fi

echo ''
echo '── السباق 3: تحصيل الدين نفسه مرتين ──'
$PSQL -c "set role authenticated; select set_config('app.uid','$ADMIN',false); select public.create_sale('{\"items\":[{\"productId\":\"$PROD_A\",\"qty\":1}],\"method\":\"credit\",\"customerId\":\"$CUST\"}'::jsonb)" >/dev/null 2>&1
$PSQL -c "set role authenticated; select set_config('app.uid','$ADMIN',false); select public.collect_debt('$CUST', (select balance from public.customer_balances where id='$CUST') - 150, 'cash', 'تصفير جزئي')" >/dev/null 2>&1
BAL=$($PSQL -c "select balance from public.customer_balances where id='$CUST'")
COLLECT="select public.collect_debt('$CUST', $BAL, 'cash', 'سباق التحصيل')"
( $PSQL -c "$(sess) begin; $COLLECT; select pg_sleep(1.2); commit;" >"$TMP/c1" 2>&1 ) &
sleep 0.4
( $PSQL -c "$(sess) $COLLECT;" >"$TMP/c2" 2>&1 ) &
wait
COK=$(cat "$TMP/c1" "$TMP/c2" | grep -c '"ok": true')
CBAD=$(cat "$TMP/c1" "$TMP/c2" | grep -c 'OVER_BALANCE')
BAL2=$($PSQL -c "select balance from public.customer_balances where id='$CUST'")
if [ "$COK" -eq 1 ]; then say 'تحصيل واحد نجح من اثنين' "الرصيد $BAL → $BAL2"; else bad 'تحصيل واحد نجح' "نجح $COK"; fi
if [ "$CBAD" -eq 1 ]; then say 'الثاني رُفض بالرصيد' 'OVER_BALANCE'; else bad 'الثاني رُفض' "$CBAD"; fi
if [ "$BAL2" = "0.000" ] || [ "$BAL2" = "0" ]; then say 'الرصيد صفر لا سالب' "$BAL2"; else bad 'الرصيد صفر لا سالب' "$BAL2"; fi

echo ''
echo '── السباق 4: تسديد الفاتورة نفسها مرتين ──'
SID=$($PSQL -c "set role authenticated; select set_config('app.uid','$ADMIN',false); select public.create_sale('{\"items\":[{\"productId\":\"$PROD_A\",\"qty\":1}],\"method\":\"credit\",\"customerId\":\"$CUST\"}'::jsonb) -> 'sale' ->> 'id'" | tail -1)
PAY="select public.pay_invoice('$SID', 150, 'cash')"
( $PSQL -c "$(sess) begin; $PAY; select pg_sleep(1.2); commit;" >"$TMP/p1" 2>&1 ) &
sleep 0.4
( $PSQL -c "$(sess) $PAY;" >"$TMP/p2" 2>&1 ) &
wait
POK=$(cat "$TMP/p1" "$TMP/p2" | grep -c '"ok": true')
PAID=$($PSQL -c "select paid || '/' || total from public.sales where id='$SID'")
OVER=$($PSQL -c "select count(*) from public.sales where paid > total")
if [ "$POK" -eq 1 ]; then say 'تسديد واحد نجح من اثنين' "مدفوع/إجمالي = $PAID"; else bad 'تسديد واحد نجح' "نجح $POK ($PAID)"; fi
if [ "$OVER" = "0" ]; then say 'لا فاتورة مدفوعها تجاوز إجماليها' "$OVER"; else bad 'تجاوز المدفوع' "$OVER"; fi

echo ''
echo '── ثوابت بعد كل السباقات ──'
NEG=$($PSQL -c "select count(*) from public.product_stock where stock < 0")
IDENT=$($PSQL -c "select count(*) from public.cash_summary('-infinity','infinity') c where abs(c.expected - (c.carried + c.inflow - c.outflow)) >= 0.001")
ITEMS=$($PSQL -c "select count(*) from public.sales s where not exists (select 1 from public.sale_items i where i.sale_id = s.id)")
ORPHAN=$($PSQL -c "select count(*) from public.stock_movements m where m.ref_type='sale' and not exists (select 1 from public.sales s where s.number = m.ref_id)")
[ "$NEG" = "0" ]    && say 'لا رصيد مخزون سالب' "$NEG"    || bad 'رصيد سالب' "$NEG"
[ "$IDENT" = "0" ]  && say 'معادلة الصندوق ما تزال ثابتة' "$IDENT" || bad 'معادلة الصندوق' "$IDENT"
[ "$ITEMS" = "0" ]  && say 'لا فاتورة بلا أصناف (ذرية الكتابة)' "$ITEMS" || bad 'فاتورة بلا أصناف' "$ITEMS"
[ "$ORPHAN" = "0" ] && say 'لا حركة مخزون يتيمة' "$ORPHAN" || bad 'حركة يتيمة' "$ORPHAN"

# تُسجَّل النتائج في سجل الاختبار نفسه حتى تجمعها run_tests.sh
$PSQL -c "select public.test_assert('سباق آخر وحدة: عملية واحدة تنجح', $([ "$OK" -eq 1 ] && echo true || echo false), 'نجحت $OK من 2')" >/dev/null 2>&1
$PSQL -c "select public.test_assert('سباق التحصيل: تحصيل واحد ينجح', $([ "$COK" -eq 1 ] && echo true || echo false), 'الرصيد $BAL → $BAL2')" >/dev/null 2>&1
$PSQL -c "select public.test_assert('سباق التسديد: تسديد واحد ينجح', $([ "$POK" -eq 1 ] && echo true || echo false), 'مدفوع/إجمالي $PAID')" >/dev/null 2>&1
$PSQL -c "select public.test_assert('سباق الأرقام: لا تكرار في أرقام الفواتير', $([ "$DUP" = "0" ] && echo true || echo false), 'تكرارات $DUP')" >/dev/null 2>&1
$PSQL -c "select public.test_assert('ثوابت السباقات: لا رصيد سالب ولا فاتورة بلا أصناف', $([ "$NEG" = "0" ] && [ "$ITEMS" = "0" ] && [ "$ORPHAN" = "0" ] && echo true || echo false), 'سالب $NEG · بلا أصناف $ITEMS · يتيمة $ORPHAN')" >/dev/null 2>&1
$PSQL -c "select public.test_assert('ثوابت السباقات: معادلة الصندوق', $([ "$IDENT" = "0" ] && echo true || echo false), 'انحراف $IDENT')" >/dev/null 2>&1

echo ''
echo "النتيجة: $PASS نجح · $FAIL فشل"
[ "$FAIL" -eq 0 ]
