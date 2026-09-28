#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════
#  run_tests.sh — كل الاختبارات بأمر واحد
# ═══════════════════════════════════════════════════════════════════
#  1) قاعدة البيانات: هجرات 001–008 على قاعدة نظيفة
#  2) سيناريوهات الصندوق والمخزون والديون      (tests/20)
#  3) مصفوفة الصلاحيات RLS لكل دور × كل جدول   (tests/30)
#  4) تسابق جهازين على العملية نفسها          (tests/40)
#  5) حزم الواجهة الأربع كما هي بلا تعديل      (tools/*.js)
#
#  الاستعمال:
#    bash supabase/tests/run_tests.sh              # الكل
#    bash supabase/tests/run_tests.sh --db-only    # القاعدة وحدها
#    bash supabase/tests/run_tests.sh --js-only    # الواجهة وحدها
#    DB=youssef_test bash supabase/tests/run_tests.sh
#
#  يتطلب Postgres محليًا. على Supabase الحقيقي تُطبَّق الهجرات نفسها
#  عبر supabase db push، أما tests/00_local_stubs.sql فمحلي حصراً.
# ═══════════════════════════════════════════════════════════════════
set -u
cd "$(dirname "$0")/../.." || exit 1
ROOT="$(pwd)"
DB="${DB:-youssef_dev}"
PGVER="${PGVER:-17}"
MODE="all"
case "${1:-}" in --db-only) MODE="db" ;; --js-only) MODE="js" ;; esac

G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'
hr() { printf '%s\n' "────────────────────────────────────────────────────────"; }
head_() { printf '\n%s%s%s\n' "$B" "$1" "$N"; hr; }
FAILED=0

# ─────────── 1) القاعدة ───────────
if [ "$MODE" != "js" ]; then
  head_ "1/5  تشغيل مجموعة Postgres وتهيئة قاعدة اختبار نظيفة"
  if ! pg_isready -q 2>/dev/null; then
    sudo -n pg_ctlcluster "$PGVER" main start 2>/dev/null || pg_ctlcluster "$PGVER" main start 2>/dev/null
    sleep 2
  fi
  pg_isready -q && echo "  ✓ المجموعة جاهزة" || { echo "  ✗ لا توجد مجموعة Postgres"; exit 1; }

  dropdb --if-exists "$DB" 2>/dev/null
  createdb -O "$(whoami)" "$DB" && echo "  ✓ قاعدة جديدة: $DB"

  head_ "2/5  تطبيق الهجرات بالترتيب"
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_local_stubs.sql \
    && echo "  ✓ 00_local_stubs.sql (محلي — لا يُرفع إلى Supabase)" || { echo "  ✗ البديل المحلي"; FAILED=1; }
  for f in supabase/migrations/*.sql; do
    if psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$f" 2>/tmp/mig.err; then
      echo "  ✓ $(basename "$f")"
    else
      echo "  ✗ $(basename "$f")"; head -5 /tmp/mig.err; FAILED=1; break
    fi
  done
  TABLES=$(psql -d "$DB" -tAc "select count(*) from pg_tables where schemaname='public'")
  FUNCS=$(psql -d "$DB" -tAc "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.proname not like 'armor%'")
  RLS=$(psql -d "$DB" -tAc "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity")
  POL=$(psql -d "$DB" -tAc "select count(*) from pg_policies where schemaname='public'")
  echo "  · $TABLES جدولًا · $RLS منها مفعّلة عليه RLS · $POL سياسة · $FUNCS دالة"

  head_ "3/5  تجهيز البيانات واختبار سيناريوهات الصندوق"
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/10_seed_fixture.sql >/tmp/t10.log 2>&1 \
    && echo "  ✓ 10_seed_fixture.sql" || { echo "  ✗ التجهيز"; grep -i error /tmp/t10.log | head -3; FAILED=1; }
  psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/20_cashbox_scenarios.sql >/tmp/t20.log 2>&1
  [ $? -eq 0 ] && echo "  ✓ 20_cashbox_scenarios.sql" || { echo "  ✗ السيناريوهات"; grep -iE "error" /tmp/t20.log | head -3; FAILED=1; }

  head_ "4/5  مصفوفة الصلاحيات ثم تسابق الجهازين"
  psql -d "$DB" -v ON_ERROR_STOP=1 -f supabase/tests/30_rls_matrix.sql >/tmp/t30.log 2>&1
  [ $? -eq 0 ] && echo "  ✓ 30_rls_matrix.sql" || { echo "  ✗ المصفوفة"; grep -iE "error" /tmp/t30.log | head -3; FAILED=1; }
  bash supabase/tests/40_concurrency.sh "$DB" >/tmp/t40.log 2>&1
  [ $? -eq 0 ] && echo "  ✓ 40_concurrency.sh" || { echo "  ✗ التسابق"; FAILED=1; }
  grep -E '✗' /tmp/t20.log /tmp/t30.log /tmp/t40.log 2>/dev/null | sed 's/^/  /' | head -20

  head_ "نتيجة اختبارات القاعدة"
  psql -d "$DB" -c "select kind as \"الناتج\", count(*) as \"العدد\" from tests.log group by kind order by kind desc"
  psql -d "$DB" -tAc "select name || coalesce(' — ' || extra, '') from tests.log where kind='fail' limit 15" | sed 's/^/  ✗ /'
  DBFAIL=$(psql -d "$DB" -tAc "select count(*) from tests.log where kind='fail'")
  DBPASS=$(psql -d "$DB" -tAc "select count(*) from tests.log where kind='pass'")
  [ "$DBFAIL" = "0" ] || FAILED=1
  echo "  القاعدة: $DBPASS نجح · $DBFAIL فشل"
fi

# ─────────── 2) الواجهة ───────────
if [ "$MODE" != "db" ]; then
  head_ "5/5  حزم الواجهة الأربع (بلا تعديل عليها)"
  if [ ! -d node_modules/jsdom ]; then
    echo "  · jsdom غير مثبّت — npm install --no-audit --no-fund"
    npm install --no-audit --no-fund >/tmp/npm.log 2>&1 || { echo "  ✗ تعذّر التثبيت"; tail -3 /tmp/npm.log; FAILED=1; }
  fi
  for suite in smoke uitest cashcheck spec; do
    out=$(node "tools/$suite.js" 2>&1); code=$?
    tail=$(printf '%s' "$out" | grep -E "[0-9]+/[0-9]+|نجح|فشل|خطأ|PASS|FAIL|✓|✗" | tail -2 | tr '\n' ' ')
    if [ $code -eq 0 ]; then echo "  ${G}✓${N} tools/$suite.js — ${tail:-ok}";
    else echo "  ${R}✗${N} tools/$suite.js — ${tail:-فشل}"; printf '%s\n' "$out" | tail -6 | sed 's/^/      /'; FAILED=1; fi
  done
fi

# ─────────── الخلاصة ───────────
head_ "الخلاصة"
if [ "$FAILED" -eq 0 ]; then
  printf '  %sكل الاختبارات خضراء%s\n' "$G" "$N"
else
  printf '  %sهناك فشل — راجع ما سبق%s\n' "$R" "$N"
fi
hr
exit "$FAILED"
