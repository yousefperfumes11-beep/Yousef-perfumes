# مجلّد Supabase — ماذا فيه وكيف يُرفع

## الترتيب (إلزامي)

```
supabase/
├── migrations/           ← تُرفع إلى المشروع بالترتيب الرقمي
│   ├── 20260928_001_base.sql        الأنواع والصلاحيات ومنطقة التوقيت و round3()
│   ├── 20260928_002_tables.sql      19 جدولًا + تسلسلا الأرقام + بذر الإعدادات
│   ├── 20260928_003_derived.sql     العروض والدوال المشتقة (الصندوق والأرصدة والمخزون)
│   ├── 20260928_004_rls.sql         الهوية + RLS + 48 سياسة + حاجز التصعيد + المنح
│   ├── 20260928_005_rpc_sales.sql   create_sale · return_sale · pay_invoice
│   ├── 20260928_006_rpc_debts.sql   collect_debt · add_debt_charge
│   ├── 20260928_007_rpc_inventory.sql  المخزون والمشتريات والموردون والتليين
│   └── 20260928_008_rpc_cash.sql    الصندوق والجرد والإعدادات النقدية والمصروفات
└── tests/                ← محلي. لا يُرفع منه شيء إلى المشروع
    ├── 00_local_stubs.sql          بدائل auth.uid()/auth.role()/auth.jwt() للاختبار المحلي فقط
    ├── 10_seed_fixture.sql         هويات وأصناف وعملاء بأرقام معلومة + أدوات التقرير
    ├── 20_cashbox_scenarios.sql    16 سيناريو = جدول القسم 2 كاملًا
    ├── 30_rls_matrix.sql           4 أدوار × 17 جدولًا × 4 عمليات
    ├── 40_concurrency.sh           4 سباقات بجلسات متوازية
    └── run_tests.sh                الأمر الواحد
```

## الرفع إلى مشروع Supabase

```bash
supabase link --project-ref <REF>
supabase db push          # يطبّق migrations/ بالترتيب
```

أو يدويًا من SQL Editor في لوحة التحكم: افتح كل ملف **بترتيبه الرقمي** ونفّذه كاملًا.
كل الهجرات idempotent (`create or replace` / `drop policy if exists` / `on conflict`)
فإعادة تنفيذها آمنة.

> **`tests/00_local_stubs.sql` لا يُرفع أبدًا.** في Supabase دوال `auth.*` موجودة أصلًا،
> ورفع البديل يعني كسر الهوية الحقيقية.

## ما بعد الرفع مباشرة

1. أنشئ حساب المدير الأول (Auth → Add user) ثم صفّه في `profiles` بدور «مدير»
   وكل الصلاحيات — أو انتظر دالة الحافة في المرحلة 2.
2. اضبط التسلسلين على حجم بياناتك بعد الترحيل:
   ```sql
   select setval('sale_number_seq', (select count(*) from sales));
   select setval('po_number_seq',   (select count(*) from purchases));
   ```
3. تحقّق من أن `security_invoker` سارٍ على العروض الثلاثة:
   ```sql
   select c.relname, c.reloptions from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='v';
   ```
   (يتطلب Postgres 15+، وSupabase عليه.)

## الاختبار محليًا

```bash
bash supabase/tests/run_tests.sh          # قاعدة نظيفة ← هجرات ← اختبارات ← حزم الواجهة
bash supabase/tests/run_tests.sh --db-only
DB=youssef_test bash supabase/tests/run_tests.sh
```

يتطلب Postgres محليًا (اختُبر على 17.11) ودورًا superuser باسم مستخدمك الحالي.

## قواعد لا تُكسر في أي هجرة قادمة

* الصندوق **لا يُخزَّن** في أي حقل — يُشتق من `cash_events` دائمًا.
* `sales` و`sale_items` و`stock_movements` و`customer_payments` و`audit_log`
  **بلا `GRANT` كتابة** لدور `authenticated`؛ أي كتابة جديدة تمرّ عبر دالة
  `SECURITY DEFINER` تفحص الصلاحية داخلها وتكتب في `audit_log`.
* أي دالة تلمس رصيدًا مشتقًا (مخزون/ذمة) **تقفل الصف في عبارة مستقلة قبل القراءة**،
  وإلا قرأت لقطة قديمة تحت `READ COMMITTED` (تفصيلها في `docs/phase1-report.md` §4-ب-2).
* أي تعديل على `profiles` يمرّ عبر حاجز `trg_protect_profile`.
* رسائل الأخطاء عربية ومقروءة لبائع غير تقني، وبادئتها رمز إنجليزي
  (`NOT_ENOUGH_STOCK:` …) لتسهيل المعالجة في الواجهة.
