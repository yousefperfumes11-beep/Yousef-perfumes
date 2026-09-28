/* ═══════════════════════════════════════════════════════════════════
   002 — الجداول الأساسية
   كل عمود مطابق لحقل حقيقي في الكود (مستخرج من سجلات حيّة، لا تخمين):
     product 21 حقلًا · sale 16 · movement 9 · customer 16 · payment 10
     expense 9 · purchase 12 · cashEntry 7 · supplier 12 · user 11

   الأرقام numeric(14,3) لأن الدينار الليبي يُعرض بثلاث خانات.
   القرارات المطبّقة هنا: 4 (unpaid لا debt) · 7 (tax عمود) · 8 (opening)
   10 (brand نص حر) · 11 (movement type+qty لا delta) · 13 (soft delete)
   ═══════════════════════════════════════════════════════════════════ */

/* ── المستخدمون ── */
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text not null,
  role          public.user_role not null default 'بائع',
  permissions   text[] not null default '{}',
  status_note   text,                      /* "دوام صباحي" — نص حر كما اليوم */
  phone         text,
  active        boolean not null default true,
  prefs         jsonb not null default '{}'::jsonb,  /* theme/density/accent: لكل مستخدم (القرار 27) */
  last_login    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists profiles_role_idx on public.profiles (role);

/* ── الأقسام (10) والمرجات المرجعية (27) ── */
create table if not exists public.categories (
  id     text primary key,
  name   text not null,
  emoji  text,
  color  text,
  sort   int not null default 0
);

/* مرجعي فقط: يُستعمل لاقتراح بادئة EAN-13 (products.js:23-28).
   الماركة على الصنف تبقى نصًا حرًا — القرار 10. */
create table if not exists public.brands (
  name    text primary key,
  prefix  text,
  country text
);

/* ── الموردون ── */
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  contact     text,
  phone       text,
  city        text,
  focus       text references public.categories(id),
  rating      numeric(3,1) not null default 0,
  terms_days  int not null default 0,
  active      boolean not null default true,
  note        text,
  created_at  timestamptz not null default now()
);

/* ── الأصناف: كل حجم صف مستقل ── */
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,
  barcode      text unique,                  /* EAN-13؛ saveProduct يمنع التكرار */
  name         text not null,
  brand        text,                         /* نص حر (القرار 10) */
  category_id  text references public.categories(id),
  size_label   text,                         /* "100 مل" */
  size_num     numeric(10,2) not null default 0,
  unit         text not null default 'عبوة',
  cost         numeric(14,3) not null default 0 check (cost >= 0),
  price        numeric(14,3) not null default 0 check (price >= 0),
  opening      numeric(14,3) not null default 0,   /* ★ أساس اشتقاق الرصيد (القرار 8) */
  min_stock    int not null default 0,
  supplier_id  uuid references public.suppliers(id),
  emoji        text,
  taxable      boolean not null default true,   /* saveProduct يجعل الجديد خاضعًا للضريبة (store.js:742) */
  popularity   numeric(6,4) not null default 0,    /* يستعملها pos.js:102 للترتيب */
  active       boolean not null default true,      /* الحذف = تليين (القرار 13) */
  deleted_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_active_idx  on public.products (active);
create index if not exists products_brand_idx   on public.products (brand);

/* ── حركات المخزون: المصدر الوحيد للرصيد ── */
create table if not exists public.stock_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references public.products(id),
  type        public.movement_type not null,
  qty         numeric(14,3) not null check (qty <> 0),
  reason      text,
  ref_type    text,               /* sale|return|purchase|adjust|init */
  ref_id      text,               /* رقم الفاتورة/الأمر — كما في m.ref اليوم */
  actor_id    uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);
create index if not exists movements_product_idx on public.stock_movements (product_id, created_at);
create index if not exists movements_created_idx on public.stock_movements (created_at);

/* ── العملاء ── */
create table if not exists public.customers (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  phone         text,
  city          text,
  account_type  text not null default 'نقدي' check (account_type in ('نقدي','دين')),
  credit_limit  numeric(14,3) not null default 0 check (credit_limit >= 0),
  note          text,
  active        boolean not null default true,
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists customers_name_idx on public.customers (name);

/* ── تسلسل أرقام الفواتير: يولَّد خادميًا فقط (القرار 18) ── */
create sequence if not exists public.sale_number_seq start 1;
create sequence if not exists public.po_number_seq   start 1;
/* عند استيراد بيانات قائمة اضبط التسلسل بعدها، مثال:
   select setval('public.sale_number_seq', (select count(*) from public.sales)); */

/* ── المبيعات ── */
create table if not exists public.sales (
  id             uuid primary key default gen_random_uuid(),
  number         text unique not null,
  seller_id      uuid references public.profiles(id),
  customer_id    uuid references public.customers(id),
  customer_name  text not null default 'زبون نقدي',      /* لقطة كما اليوم */
  status         public.sale_status not null,
  payment_method public.pay_method not null,
  subtotal       numeric(14,3) not null check (subtotal >= 0),
  discount       numeric(14,3) not null default 0 check (discount >= 0),
  tax            numeric(14,3) not null default 0 check (tax >= 0),
  total          numeric(14,3) not null check (total >= 0),
  paid           numeric(14,3) not null default 0 check (paid >= 0),
  change_due     numeric(14,3) not null default 0,        /* الباقي للعميل */
  profit         numeric(14,3) not null default 0,        /* مولَّد خادميًا (القرار 6) */
  note           text,
  return_reason  text,
  returned_at    timestamptz,
  created_at     timestamptz not null default now(),      /* تاريخ العملية بطرابلس */
  check (paid <= total)
);
create index if not exists sales_created_idx  on public.sales (created_at);
create index if not exists sales_customer_idx on public.sales (customer_id);
create index if not exists sales_status_idx   on public.sales (status);

create table if not exists public.sale_items (
  id             bigint generated always as identity primary key,
  sale_id        uuid not null references public.sales(id) on delete cascade,
  product_id     uuid references public.products(id) on delete set null,
  name_snapshot  text not null,        /* الاسم مع الحجم — HS.store.label */
  brand          text,
  size_label     text,
  unit           text,
  barcode        text,
  qty            numeric(14,3) not null check (qty > 0),
  unit_price     numeric(14,3) not null check (unit_price >= 0),
  unit_cost      numeric(14,3) not null check (unit_cost >= 0),
  line_discount  numeric(14,3) not null default 0,
  line_total     numeric(14,3) not null
);
create index if not exists sale_items_sale_idx    on public.sale_items (sale_id);
create index if not exists sale_items_product_idx on public.sale_items (product_id);

/* ── دفتر مدفوعات العملاء وقيود الدين ──
   amount سالب + kind='charge' = دين مضاف يدويًا (نفس حيلة الكود). */
create table if not exists public.customer_payments (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers(id),
  amount       numeric(14,3) not null check (amount <> 0),
  kind         text not null default 'payment' check (kind in ('payment','charge')),
  method       public.pay_method,              /* null للقيود: لا أموال تتحرك */
  sale_id      uuid references public.sales(id),
  note         text,
  actor_id     uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  check ((kind = 'charge') = (amount < 0))
);
create index if not exists payments_customer_idx on public.customer_payments (customer_id, created_at);
create index if not exists payments_created_idx  on public.customer_payments (created_at);

/* ── المصروفات ── */
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,
  amount      numeric(14,3) not null check (amount > 0),
  method      public.pay_method not null default 'cash',
  note        text,
  recurring   boolean not null default false,
  actor_id    uuid references public.profiles(id),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists expenses_created_idx on public.expenses (created_at);

/* ── القيود النقدية اليدوية: إيداع/سحب/رصيد افتتاحي/فرق جرد ──
   بقية أحداث الصندوق تُشتقّ ولا تُخزَّن (القرار 5). */
create table if not exists public.cash_entries (
  id          uuid primary key default gen_random_uuid(),
  direction   public.cash_direction not null,
  amount      numeric(14,3) not null check (amount > 0),
  reason      text not null,
  kind        text not null default 'manual'
              check (kind in ('deposit','withdraw','opening','count_diff')),
  actor_id    uuid references public.profiles(id),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists cash_entries_created_idx on public.cash_entries (created_at);
/* الرصيد الافتتاحي قيد واحد فريد — تطابق سلوك settings.js:404-427 */
create unique index if not exists cash_entries_one_opening
  on public.cash_entries (kind) where kind = 'opening' and deleted_at is null;

/* ── المشتريات ── */
create table if not exists public.purchases (
  id             uuid primary key default gen_random_uuid(),
  number         text unique not null,
  supplier_id    uuid references public.suppliers(id),
  supplier_name  text not null,
  status         public.po_status not null default 'draft',
  order_date     date not null,                 /* في الكود تاريخ فقط! */
  expected_date  date,
  total          numeric(14,3) not null default 0,
  paid           numeric(14,3) not null default 0 check (paid >= 0),
  note           text,
  received_at    timestamptz,
  deleted_at     timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id          bigint generated always as identity primary key,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id  uuid references public.products(id) on delete set null,
  name_snapshot text not null,
  qty         numeric(14,3) not null check (qty > 0),
  unit_cost   numeric(14,3) not null default 0
);

/* الدفع للمورد موجود في purchases.js:420-424 ولا يمسّ الصندوق — القرار 15: مطابقة */
create table if not exists public.supplier_payments (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers(id),
  purchase_id  uuid references public.purchases(id),
  amount       numeric(14,3) not null check (amount > 0),
  method       public.pay_method not null default 'cash',
  note         text,
  actor_id     uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

/* ── إعدادات المحل: صف واحد (21 مفتاح عمل، والتفضيلات في profiles.prefs) ── */
create table if not exists public.settings (
  id     int primary key default 1 check (id = 1),
  data   jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.settings (id, data) values (1, jsonb_build_object(
  'storeName','يوسف للعطور', 'activity','عطور أصلية · ماركات عالمية وشرقية',
  'branch','الفرع الرئيسي', 'owner','يوسف كريفة', 'phone','0913200118',
  'address','شارع الجمهورية', 'taxNumber','', 'city','طرابلس',
  'workHours','9:00 ص — 10:00 م',
  'currency','د.ل', 'currencyCode','LYD', 'decimals',3, 'numerals','latin',
  'dateFormat','short', 'taxRate',0, 'lowStockThreshold',3,
  'cashOpening',2500, 'receiptFooter','شكرًا لتسوقكم من يوسف للعطور',
  'showBarcodeOnReceipt',true, 'defaultDiscount',0, 'allowNegativeStock',false,
  'maxCreditDays',30, 'invoicePrefix','INV'
)) on conflict (id) do nothing;

/* ── سجل التدقيق ── */
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_created_idx on public.audit_log (created_at);
create index if not exists audit_entity_idx  on public.audit_log (entity, entity_id);
