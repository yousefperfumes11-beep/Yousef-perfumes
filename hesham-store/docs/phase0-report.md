# المرحلة 0 — تقرير الفهم: «يوسف للعطور» نحو خلفية حقيقية

> **حالة المرحلة:** تحليل فقط. **لم يُكتب أي سطر تنفيذي** (لا هجرة، لا `config.js`، لا `HS.repo`) التزامًا بالبند 6 من البرومت.
> **ما قُرئ فعلًا:** `store.js` (1311 سطرًا) و`data.js` و`lib.js` و`pos.js` و`cash.js` و`users.js` و`purchases.js` و`customers.js` و`settings.js` و`sales.js` و`products.js` و`reports.js`، إضافة إلى تشغيل التطبيق في jsdom لاستخراج **أشكال السجلات الحقيقية** لا المخمَّنة.
> **المرجع عند الخلاف:** الكود. وكل فرق بينه وبين البرومت موثّق في القسم 7 مع الملف والسطر.

---

## 1. ملخص تنفيذي (5 أسطر)

1. التطبيق **مصدري الأحداث فعلًا** في أهم مكانين: المخزون يُشتق من `opening + Σ movements`، والصندوق يُشتق من إسقاط `cashEvents()` على أربع مجموعات — وهذا يطابق معماريتك المقترحة ويقلّل خطر المرحلة 1 كثيرًا.
2. لكن `cash_events` في الكود **إسقاط محسوب لا جدول مخزّن**؛ تخزينه جدولًا يخلق خطر انحراف، وأقترح بديلًا مكافئًا في الضمان (القسم 4.3 والقرار 11).
3. توجد **8 تعارضات جوهرية** بين البرومت والكود (صلاحيات البائع، أسماء الحالات `unpaid` لا `debt`، حقل `opening` المفقود، `tax` المفقود، مسارا تحصيل الدين، ذمم الموردين، الحذف النهائي للمنتج، والطوابع الزمنية بلا منطقة) — كلها في القسم 7 مع توصيتي لكل واحد.
4. أربعة مواضع في الصفحات **تعدّل الحالة مباشرة ثم تنادي `save()`** متجاوزة `HS.store` (دفعات الموردين، إلغاء أمر شراء، تراجع قيد الدين، مزامنة الرصيد الافتتاحي) — وهي أخطر ما سيقع في الوضع البعيد إن لم تُحوَّل إلى RPC.
5. الاختبارات الأربعة **خضراء الآن** (0/0، 52/52، 0، كلها ناجحة)، وقد أصلحتُ مساراتها الثابتة في الجولة السابقة فصارت تعمل من أي مجلد — أثبتُّ ذلك بتشغيلها من `/`.

---

## 2. الجرد الكامل لواجهة `HS.store` العامة

**77 مفتاحًا عامًا** + 15 دالة داخل `cart` + 2 داخل `ui`. هذا كل ما تعرفه الصفحات، وهو العقد الذي يجب ألا يتغيّر شكله.

### 2.1 الحالة والتهيئة (7) — **هنا يكمن أكبر تغيير معماري**

| الدالة | التوقيع | ملاحظة حرجة للوضع البعيد |
|---|---|---|
| `state` | getter | يعيد الكائن الحي `S` — الصفحات تقرأ منه مباشرة. الكاش المحلي يجب أن يبقى **نفس الشكل** |
| `load(opts)` | `{force?}` | **ينادي `HS.data.generate()` في كل إقلاع** (store.js:121)، وإذا كانت البيانات «قديمة» (`isStale`، ≥ يوم) **يعيد التوليد ويدمج عمل المستخدم** (`mergeUserWork`). في الوضع البعيد يجب تعطيل هذا المسار بالكامل |
| `save()` | — | يكتب الحالة **كلها ككتلة واحدة** في `localStorage` تحت مفتاح `hesham-store:v3`. نُدعى 36 مرة داخل store.js و5 مرات من الصفحات. في الوضع البعيد يصبح «دفع الفروقات»، لا كتابة كتلة |
| `reset(keepSettings)` | — | **يعيد توليد بيانات تجريبية ببذر عشوائي**. في الوضع البعيد = عملية إدارية خطيرة عبر Edge Function فقط |
| `importJSON(text)` | — | **يستبدل الحالة كلها** بعد تحقق من 6 مفاتيح. في الوضع البعيد = ترحيل جماعي عبر خادم، لا كتابة من العميل |
| `exportJSON()` | — | يعيد `{exportedAt, store}` — يصلح صيغة ترحيل كما ذكرت |
| `storageSize()` | — | خاص بـ localStorage؛ في الوضع البعيد يعيد حجم الكاش |

### 2.2 الجلسة والمصادقة (4)

`login(username, password)` — **لا توجد كلمات مرور مخزّنة**: أي كلمة ≥ 4 أحرف تنجح (store.js:990). يعيد `{ok, user}` أو `{ok:false, error}`.
`logout()` · `isLoggedIn()` · `currentUser()`.
`can(perm)` — **المدير يتجاوز كل الفحوص**؛ وغيره يُفحص مصفوفة `u.permissions` (store.js:214-218).

### 2.3 محددات قراءة (14) — تُخدم من الكاش بلا تغيير

`cat` · `product` · `customer` · `supplier` · `user` · `sale` · `purchase` · `expenseCat` · `payMethod` · `creditAccount(c)` · `label(p)` · `byBarcode(code)` · `barcodeTaken(code, exceptId)` · `paymentsOf(customerId)`

> `byBarcode` يبحث في `barcode` **وأيضًا في `sku` إن كان رقميًا فقط** — سلوك يجب الحفاظ عليه في RPC البحث.

### 2.4 كتالوج مشتق (2) — تُخدم من الكاش أو من استعلام تجميعي

`brands()` → `[{name, count}]` مشتقة من المنتجات (لا جدول ماركات في البيانات) · `sizes()` → أحجام موجودة مرتبة بـ `sizeNum`.

### 2.5 الفترات (3)

`periods` (ثابت: today/7d/30d/90d/all) · `range(periodId, custom)` → `{from, to, label}` · `inRange(items, range)`.

### 2.6 الإحصاءات المشتقة (17) — **قائمة ما يجب أن تخدمه الـ views أو الكاش**

`salesOf` · `validSalesOf` (يستثني `returned` و`held`) · `saleProfit(sale)` · `kpis(range)` · `daily(range, valueFn)` · `byCategory` · `topProducts` · `byMethod` · `byHour` · `byWeekday` · `inventoryValue` · `retailValue` · `lowStock` · `outOfStock` · `stockAlertCount` · `overdue` · `notifications`.

`kpis(range)` يعيد 15 حقلًا: `revenue, prevRevenue, revenueDelta, profit, prevProfit, profitDelta, margin, cogs, expenses, net, invoices, prevInvoices, invoicesDelta, units, prevUnits` — وكلها **محسوبة من الفواتير الصالحة فقط** (المرتجعة تُستثنى من الإيراد والربح).

`saleProfit(sale) = Σ qty × (price − cost) − discount` — **الربح غير مخزّن في أي سجل**.

### 2.7 الصندوق (6)

| الدالة | ماذا تفعل |
|---|---|
| `cashEvents(from, to)` | **إسقاط محسوب** يبني أحداثًا من: المبيعات (القبض وقت البيع + الاسترداد عند الإرجاع)، الدفعات النقدية، المصروفات النقدية، القيود اليدوية — ثم يرتّبها ويحسب `balance` متراكمًا (store.js:1061-1131) |
| `cashCarried(range)` | آخر رصيد قبل `range.from` |
| `cash(range)` | 27 حقلًا: `carried, cashSales, cashCollected, cardSales, creditSales, creditDownPayment, creditOutstanding, debtCash, debtCard, debtTotal, expCash, expOther, expTotal, refunds, otherIn, otherOut, inflow, outflow, net, expected, notInCash, cashSalesCount, cardSalesCount, creditSalesCount, inCount, outCount, events, count` |
| `cashLedger(range)` | صفوف السجل مع الرصيد المتراكم |
| `addCashEntry(d)` | قيد يدوي `{type: in|out, amount, reason, date?}` → `{ok, entry}` |
| `deleteCashEntry(id)` | → `{ok, undo}` (التراجع دالة في الذاكرة) |

**أنواع الأحداث السبعة** (كما في cash.js:15-21): `sale` · `downpayment` · `debt` · `deposit` · `expense` · `withdraw` · `refund`.

**المعادلة المُختبَرة:**
```
expected = carried + cashCollected + creditDownPayment + debtCash + otherIn
         − refunds − expCash − otherOut
```

### 2.8 الديون (1)

`debts(range)` → 20 حقلًا، أهمها تعريفان **مختلفان ومتعايشان** للمستحق:
- `rangeOutstanding = granted − downPaid − collected` (من الفواتير داخل الفترة)
- `outstandingNow = Σ customers.balance` (من حسابات العملاء)
- `granted = salesGranted + chargesGranted` (فواتير الدين + القيود اليدوية)

كلاهما مُختبَر في `tools/cashcheck.js`، فيجب أن يبقى الاثنان في القاعدة (views)، لا واحدًا.

### 2.9 السلة (15 دالة) — **تبقى محلية بالكامل**

`items, add, setQty, setPrice, setLineDiscount, remove, clear, count, lines, subtotal, cost, hold, held, resume, dropHeld`

> `add` يتحقق من الرصيد ومن `allowNegativeStock` ويعيد رسائل عربية جاهزة. السلة المعلّقة في `S.carts.held` — **لا توجد فاتورة بحالة `held` في البيانات** (تحققت: 420 paid، 81 partial، 36 unpaid، 11 returned، وصفر held).

### 2.10 العمليات المُغيِّرة (22) — جدول التحويل إلى RPC

| الدالة | تلمس | مخزون | صندوق | ذمم | الحدث | الوضع البعيد المقترح |
|---|---|---|---|---|---|---|
| `checkout(payload)` | sales, movements, products, customers, carts | ✔ ينزل | ✔ (نقدي/مقدمة) | ✔ (دين) | `sale:created`, `cash:change`, `cart:change` | **RPC `create_sale`** — ذرّية، مع قفل صفوف وإعادة تحقق من الرصيد |
| `returnSale(id, reason)` | sales, movements, customers | ✔ يعود | ✔ استرداد | ✔ تنقص | `sale:returned`, `cash:change` | **RPC `return_sale`** |
| `paySale(id, amount, method)` | sales, customers | — | ✔ **بأثر رجعي** | ✔ | `sale:paid`, `cash:change` | **RPC `pay_invoice`** (انظر القرار 12) |
| `customerPayment(id, amount, method, note, date)` | payments, customers | — | ✔ (نقدي فقط) | ✔ | `customer:paid`, `cash:change` | **RPC `collect_debt`** |
| `addDebt(id, amount, note, date)` | payments (`kind:"charge"`, amount سالب), customers | — | ✘ | ✔ تزيد | `customer:charged` | **RPC `add_debt_charge`** |
| `adjustStock(id, delta, reason)` | movements, products | ✔ تسوية | — | — | `stock:changed` | **RPC `adjust_stock`** |
| `saveProduct(data, id)` | products, movements (رصيد افتتاحي/تعديل) | ✔ أحيانًا | — | — | `product:created/updated` | كتابة مباشرة + RLS (إداري) — مع تحقق الباركود في القاعدة |
| `deleteProduct(id)` | products (splice) | — | — | — | `product:deleted` + `undo()` | **تليين إلى soft delete** (القرار 18) |
| `savePurchase(data, id)` | purchases | — | — | — | `purchase:created/updated` | كتابة مباشرة + RLS |
| `receivePurchase(id)` | purchases, movements, products | ✔ يزيد | — | — | `purchase:received` | **RPC `receive_purchase`** — **لا يحدّث التكلفة إطلاقًا** (القرار 9) |
| `deletePurchase(id)` | purchases | — | — | — | `purchase:deleted` + `undo()` | soft delete |
| `saveCustomer` / `deleteCustomer` | customers | — | — | (balance) | `customer:*` | كتابة مباشرة + RLS |
| `saveSupplier` / `deleteSupplier` | suppliers | — | — | — | `supplier:*` | كتابة مباشرة + RLS |
| `saveUser` / `deleteUser` | users | — | — | — | `user:*` | **Edge Function** (تمسّ Auth) |
| `saveExpense(d, id)` / `deleteExpense(id)` | expenses | — | ✔ (نقدي) | — | `expense:*`, `cash:change` | كتابة مباشرة + RLS، والأثر النقدي يظهر عبر الإسقاط |
| `updateSettings(patch)` | settings | — | (افتتاحي) | — | `settings:changed` | كتابة مباشرة (إداري) — **عدا الرصيد الافتتاحي** فهو RPC |
| `_saveEntity` / `_deleteEntity` | أي مجموعة | — | — | — | — | داخليتان: توليد `id` ببادئة + `_local` + `createdAt`، والحذف يعيد `undo()` |

### 2.11 ما يبقى محليًا ولا يزامَن أبدًا

`ui.set/ui.get` (collapsed, drawer, period, lastRoute) · `carts` (active + held) · `session` · **و`theme` و`density` و`accent` من settings** — وإلا تصارع جهازان على سمة واحدة (القرار 27).

---

## 3. أربعة مواضع تعدّل الحالة خارج `HS.store` (خطر صامت)

هذه تُعدّل الكائنات مباشرة ثم تنادي `HS.store.save()` — في الوضع البعيد **لن تصل إلى الخادم** وستضيع بصمت:

| # | الموضع | ما يحدث |
|---|---|---|
| 1 | `purchases.js:420-424` | **دفعة لمورد**: `po.paid += amount` و`sup.balance −= amount` ثم `save()`. لا توجد دالة `HS.store.paySupplier` إطلاقًا، و**لا أثر على الصندوق** |
| 2 | `purchases.js:455-457` | إلغاء أمر شراء: `po.status = "cancelled"` مباشرة + تراجع في toast |
| 3 | `customers.js:396-399` | تراجع عن قيد دين: `c.balance = before` و`payments.splice(...)` مباشرة |
| 4 | `settings.js:427` | `syncOpeningCash` (أضفتها في الجولة السابقة): تعدّل قيد `cash-open` في `cashEntries` ثم `save()` + `cash:change` |

---

## 4. مخطط البيانات النهائي المقترح (معدَّل بعد قراءة الكود)

### 4.1 ما غيّرته في اقتراحك ولماذا

| اقتراح البرومت | التعديل | السبب من الكود |
|---|---|---|
| `sales.status ('paid'\|'partial'\|'debt'\|'held'\|'returned')` | **`('paid','partial','unpaid','returned')`** | الكود والروابط والاختبارات كلها تستعمل `unpaid` (`#/sales?tab=unpaid`، store.js:622,677). ولا توجد أي فاتورة بحالة `held` — السلة المعلّقة كيان منفصل |
| `sales` بلا `tax` | **إضافة `tax numeric(14,3)`** | checkout يحسب الضريبة ويخزّنها (store.js:600-625)؛ حاليًا `taxRate=0` وكل الأصناف `taxable=false` فتبدو خاملة لكنها حية |
| `sales.profit` عمود | **يبقى عمودًا مولَّدًا في `create_sale`** | الربح اليوم محسوب بـ `saleProfit` = Σ qty×(price−cost) − discount. تخزينه مقبول بشرط أن يُشتق خادميًا ويُصفَّر عند الإرجاع |
| `products.low_stock_threshold` | الاسم **`min_stock`** مع إبقاء `low_stock_threshold` كاسم بديل في الإعدادات | الحقل في الكود `p.minStock`، وهناك إعداد عام منفصل `settings.lowStockThreshold` |
| `products` بلا `opening` | **إضافة `opening numeric(14,3) not null default 0`** | المخزون **مشتق**: `stock = opening + Σ movements` (store.js:18-31). بلا `opening` لا يمكن إعادة بناء الرصيد |
| `products.brand_id → brands` | **`brand text`** + جدول مرجعي `brands(name, prefix, country)` | المنتجات تخزّن الماركة نصًا حرًا، و`HS.store.brands()` تشتق القائمة، و`BRAND_ROWS` تُستعمل فقط لاقتراح بادئة EAN-13 (products.js:23-28). FK يُلزم تعديل 4 صفحات |
| `stock_movements.delta` موقّع | **`type ('in','out','adjust','return') + qty numeric`** | الكود يستعمل `type` + `qty` موجب (store.js:18-31). الإبقاء عليهما يمنع خطأ تحويل الإشارة |
| `cash_events` جدول مخزّن | **دالة/عرض SQL `cash_events(from,to)`** + جدول `cash_entries` لليدوي فقط | الإسقاط اليوم لا يمكن أن ينحرف لأنه محسوب. التخزين يُلزم كل مسار نقدي بتذكر الكتابة (القرار 11) |
| `profiles.role ('admin','seller')` | **`role text`** بقيم عربية: `مدير، بائع، مشرف مخزن، محاسب` + **`permissions text[]`** | `can()` يفحص `u.permissions` ويتجاوز للمدير؛ و`ROLE_PERMS` فيه 4 أدوار (data.js:292-298) |
| — | **إضافة `customer_accounts` أو عمود `balance` مشتق** | `customers.balance` اليوم **مُجمَّع يدويًا لا مشتقًا** (`recomputeCustomers` لا يعيد حسابه) — انظر القرار 14 |
| — | **إضافة `supplier_payments`** أو توثيق أنها معلوماتية | الدفع للمورد موجود في الصفحة (purchases.js:420) ولا جدول له في اقتراحك |
| `settings` صف JSON | ✔ مع **فصل تفضيلات الجهاز** | `settings` فيه 24 مفتاحًا منها `theme/density/accent` وهي لكل مستخدم لا للمحل |

### 4.2 مخطط الحقول الحقيقي (مستخرج من سجلات حيّة، لا من التخمين)

```
product  (21 حقلًا): id, sku, barcode, name, brand, category, size, sizeNum, unit,
                     price, cost, stock(مشتق), minStock, opening, supplierId, emoji,
                     active, taxable, popularity, createdAt, _seed/_local/_edited
sale     (16 حقلًا): id, number, date, customerId, customerName(لقطة), items[],
                     subtotal, discount, tax, total, paid, method, status,
                     cashierId, note, _seed  ← لا profit ولا remaining (مشتقان)
sale.item (9 حقول): productId, name, brand, size, unit, qty, price, cost, discount
movement  (9 حقول): id, date, productId, type, qty, reason, ref, userId, _seed
customer (16 حقلًا): id, name, phone, city, accountType("دين"/"نقدي"), balance,
                     creditLimit, totalSpent, totalPaid, totalCharged, visits,
                     lastVisit, note, active, createdAt
payment  (10 حقول): id, date, customerId, customerName, amount, method, saleId(فارغ دائمًا),
                     note, userId  + kind:"charge" للقيود السالبة فقط
expense   (9 حقول): id, date, category, amount, note, method, userId, recurring
purchase (12 حقلًا): id, number, date(تاريخ فقط!), expectedDate, supplierId, supplierName,
                     items[{productId,name,qty,cost}], total, paid, status, note
cashEntry (7 حقول): id, date, type(in/out), amount, reason, userId
supplier (12 حقلًا): id, name, contact, phone, city, focus, rating, balance, termsDays, active
user     (11 حقلًا): id, name, username, role, status(نص حر: "دوام صباحي"), active,
                     permissions[], phone, lastLogin, createdAt
category  (4 حقول): id, name, emoji, color
settings (24 مفتاحًا): storeName, activity, branch, owner, phone, address, taxNumber,
                     currency, currencyCode, decimals, numerals, dateFormat, taxRate,
                     lowStockThreshold, cashOpening, receiptFooter, showBarcodeOnReceipt,
                     defaultDiscount, allowNegativeStock, maxCreditDays, invoicePrefix,
                     theme*, density*, accent*   (* = لكل جهاز/مستخدم)
```

### 4.3 مسودة DDL (للمراجعة — ليست ملف هجرة بعد)

```sql
-- الأرقام: numeric(14,3) لأن الدينار الليبي يُعرض بثلاث خانات (settings.decimals = 3)
-- المنطقة المرجعية: Africa/Tripoli. كل الطوابع المخزّنة اليوم "naive" بلا إزاحة.

create type sale_status    as enum ('paid','partial','unpaid','returned');
create type pay_method     as enum ('cash','card','credit');
create type movement_type  as enum ('in','out','adjust','return');
create type po_status      as enum ('draft','shipping','received','cancelled');
create type user_role      as enum ('مدير','بائع','مشرف مخزن','محاسب');

create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text unique not null,
  full_name   text not null,
  role        user_role not null default 'بائع',
  permissions text[] not null default '{}',
  status_note text,                 -- "دوام صباحي"
  phone       text,
  active      boolean not null default true,
  prefs       jsonb not null default '{}'::jsonb,   -- theme/density/accent: لكل مستخدم
  last_login  timestamptz,
  created_at  timestamptz not null default now()
);

create table categories (id text primary key, name text not null, emoji text, color text, sort int);
create table brands     (name text primary key, prefix text, country text);   -- مرجعي لاقتراح EAN-13

create table products (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,
  barcode      text unique,                 -- EAN-13؛ يمنع التكرار كما في saveProduct
  name         text not null,
  brand        text,                        -- نص حر (مطابقة للكود)
  category_id  text references categories(id),
  size_label   text,                        -- "100 مل"
  size_num     numeric(10,2) default 0,     -- للترتيب
  unit         text not null default 'عبوة',
  cost         numeric(14,3) not null default 0,
  price        numeric(14,3) not null default 0,
  opening      numeric(14,3) not null default 0,   -- ★ أساس اشتقاق الرصيد
  min_stock    int not null default 0,
  supplier_id  uuid,
  emoji        text,
  taxable      boolean not null default false,
  active       boolean not null default true,      -- الحذف = تليين
  created_at   timestamptz not null default now(),
  check (cost >= 0), check (price >= 0)
);
-- لا قيد check (stock >= 0) هنا: الرصيد مشتق، وallowNegativeStock إعداد قائم (القرار 9)

create table stock_movements (
  id          bigint generated always as identity primary key,
  product_id  uuid not null references products(id),
  type        movement_type not null,
  qty         numeric(14,3) not null check (qty <> 0),
  reason      text,
  ref_type    text,                    -- 'sale'|'return'|'purchase'|'adjust'|'init'
  ref_id      text,                    -- رقم الفاتورة/الأمر (كما في m.ref اليوم)
  actor_id    uuid references profiles(id),
  created_at  timestamptz not null default now()
);
create index on stock_movements (product_id, created_at);

-- الرصيد المشتق بدل عمود قابل للانحراف:
create view product_stock as
  select p.id,
         p.opening + coalesce(sum(case m.type
             when 'out' then -m.qty else m.qty end), 0) as stock
  from products p left join stock_movements m on m.product_id = p.id
  group by p.id, p.opening;

create table customers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null, phone text, city text,
  account_type text not null default 'نقدي' check (account_type in ('نقدي','دين')),
  credit_limit numeric(14,3) not null default 0,
  note         text, active boolean not null default true,
  created_at   timestamptz not null default now()
);
-- balance مشتق (القرار 14):
create view customer_balances as
  select c.id,
    coalesce((select sum(s.total - s.paid) from sales s
              where s.customer_id = c.id and s.method='credit' and s.status<>'returned'), 0)
    + coalesce((select sum(-p.amount) from customer_payments p
              where p.customer_id = c.id and p.amount < 0), 0)
    - coalesce((select sum(p.amount) from customer_payments p
              where p.customer_id = c.id and p.amount > 0), 0) as balance
  from customers c;

create table sales (
  id           uuid primary key default gen_random_uuid(),
  number       text unique not null,        -- من sequence: INV-2026-1546
  seller_id    uuid references profiles(id),
  customer_id  uuid references customers(id),
  customer_name text not null,              -- لقطة كما اليوم
  status       sale_status not null,
  payment_method pay_method not null,
  subtotal     numeric(14,3) not null,
  discount     numeric(14,3) not null default 0,
  tax          numeric(14,3) not null default 0,   -- ★ كان مفقودًا في الاقتراح
  total        numeric(14,3) not null,
  paid         numeric(14,3) not null default 0,
  profit       numeric(14,3) not null default 0,   -- مولَّد خادميًا
  note         text,
  return_reason text, returned_at timestamptz,
  created_at   timestamptz not null,        -- ★ تاريخ العملية (منطقة طرابلس)، لا now() فقط
  check (paid >= 0), check (paid <= total), check (discount >= 0)
);
create table sale_items (
  id bigint generated always as identity primary key,
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name_snapshot text not null, brand text, size_label text, unit text,
  barcode text,
  qty numeric(14,3) not null check (qty > 0),
  unit_price numeric(14,3) not null, unit_cost numeric(14,3) not null,
  line_discount numeric(14,3) not null default 0,
  line_total numeric(14,3) not null
);
create index on sales (created_at); create index on sales (customer_id);

create table customer_payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  amount numeric(14,3) not null,          -- سالب = قيد دين (kind='charge')
  kind text not null default 'payment' check (kind in ('payment','charge')),
  method pay_method,                       -- 'none' غير ممكن كـ enum → null للقيود
  sale_id uuid references sales(id),       -- للتوزيع المستقبلي (اليوم فارغ دائمًا)
  note text, actor_id uuid references profiles(id),
  created_at timestamptz not null
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null, amount numeric(14,3) not null check (amount > 0),
  method pay_method not null default 'cash', note text, recurring boolean default false,
  actor_id uuid references profiles(id), created_at timestamptz not null
);

create table cash_entries (            -- اليدوي فقط: إيداع/سحب/فرق جرد/رصيد افتتاحي
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('in','out')),
  amount numeric(14,3) not null check (amount > 0),
  reason text not null, kind text not null default 'manual'
        check (kind in ('deposit','withdraw','opening','count_diff')),
  actor_id uuid references profiles(id), created_at timestamptz not null
);

-- ★ الصندوق: إسقاط مطابق لـ cashEvents() في JS — لا يمكن أن ينحرف
create function cash_events(from_ts timestamptz, to_ts timestamptz)
returns table (ts timestamptz, direction text, amount numeric, kind text,
               ref text, sale_id uuid, actor_id uuid, label text) …
--   1) مبيعات: paid>0 وmethod in (cash, credit) → kind = sale | downpayment
--   2) مرتجع: status='returned' وpaid>0 → kind = refund (خروج) بتاريخ returned_at
--   3) دفعات العملاء النقدية الموجبة → kind = debt
--   4) المصروفات النقدية → kind = expense (خروج)
--   5) القيود اليدوية → deposit | withdraw
create view cashbox as select … ;   -- carried/inflow/outflow/expected/not_in_cash

create table suppliers (…); create table purchases (… status po_status …);
create table purchase_items (…);
create table supplier_payments (id, purchase_id null, supplier_id, amount, method, note, actor_id, created_at);
create table settings (id int primary key default 1 check (id = 1), data jsonb not null);
create table audit_log (id bigint identity primary key, actor_id uuid, action text,
  entity text, entity_id text, before jsonb, after jsonb, created_at timestamptz default now());

create sequence sale_number_seq;   -- رقم الفاتورة يُولَّد خادميًا فقط
```

### 4.4 مصفوفة RLS المطابقة للواقع الحالي

مبنية على خريطة `can()` الفعلية المستخرجة من الصفحات (28 موضعًا)، لا على افتراض:

| الجدول | بائع | مشرف مخزن | محاسب | مدير |
|---|---|---|---|---|
| `products` قراءة | ✔ (يرى التكلفة اليوم) | ✔ | ✔ | ✔ |
| `products` كتابة | ✔ **اليوم** (`products_edit`) | ✔ | ✘ | ✔ |
| `stock_movements` | عبر RPC فقط | عبر RPC | ✘ | عبر RPC |
| `sales`/`sale_items` قراءة | ✔ | ✔ | ✔ | ✔ |
| `sales` كتابة | **ممنوع مباشرة** — عبر `create_sale`/`return_sale` | ممنوع | `return_sale` (`sales_refund`) | ✔ |
| `customers` قراءة/كتابة | قراءة ✔ / كتابة ✘ (`customers_edit` غير معرّف — القرار 3) | ✘ | ✔ | ✔ |
| `customer_payments` | ✔ (`debts_manage`) | ✘ | ✔ | ✔ |
| `expenses` | ✔ (`expenses_manage`) | ✘ | ✔ | ✔ |
| `cash_entries` | ✔ **اليوم** (`cash_manage`) | ✘ | ✔ | ✔ |
| `purchases` | ✘ | ✔ (`purchases_manage`) | ✘ | ✔ |
| `settings` | قراءة ✔ / كتابة ✘ | قراءة | قراءة | ✔ |
| `profiles` | قراءة ذاتي | ذاتي | ذاتي | ✔ (`users_manage`) |
| عمود الربح/التكلفة | **مرئي اليوم** | مرئي | مرئي | مرئي |

> **النتيجة الأهم:** البرومت يفترض أن البائع لا يعدّل الأسعار ولا يرى الأرباح. **الكود يقول العكس تمامًا** (القرار 1 و2).

---

## 5. قائمة RPCs المقترحة (بديل §4.2 في البرومت بعد المطابقة)

| RPC | التوقيع | الثوابت التي يجب أن يحفظها |
|---|---|---|
| `create_sale(payload jsonb)` | يعيد `{ok, sale}` | ينزّل المخزون بقفل صفوف (`for update`)، **يعيد التحقق من الرصيد** (اليوم `checkout` لا يتحقق — وحده `cart.add` يفعل)، يولّد الرقم من sequence، يحسب `profit` و`tax` بنفس معادلة JS، يسجّل القبض النقدي/المقدمة، يضيف الذمة للدين، ويرفض الخصم إن لم يملك المستدعي `pos_discount` |
| `return_sale(sale_id, reason)` | `{ok}` | حركات `return` لكل بند، استرداد نقدي بتاريخ `returned_at`، تصفير الربح في التقارير، خفض ذمة العميل بمقدار `total − paid` |
| `collect_debt(customer_id, amount, method, note, ts)` | `{ok, payment}` | مطابقة `customerPayment`: ترفض ما يزيد على الرصيد، تقبل تاريخًا مرجعيًا، تدخل الصندوق إن كانت نقدًا |
| `pay_invoice(sale_id, amount, method)` | `{ok}` | مطابقة `paySale` **بما فيها أثرها الرجعي على الصندوق** — أو منع تغيير `method` (القرار 12) |
| `add_debt_charge(customer_id, amount, note, ts)` | `{ok, undo_token}` | قيد سالب بلا أثر نقدي |
| `adjust_stock(product_id, delta, reason)` | `{ok}` | حركة `adjust` + سبب + مرجع |
| `receive_purchase(po_id)` | `{ok}` | حركات `in` لكل بند، ومنع الاستلام المزدوج، **بلا تغيير تكلفة** (مطابقة) |
| `record_cash_count(actual, note)` | `{ok, diff}` | مطابقة «جرد الصندوق» في cash.js:374-427 — الفرق يقاس على `range("all")` لا على يوم |
| `set_opening_cash(amount)` | `{ok}` | مطابقة `syncOpeningCash` في settings.js:404-427 |
| `pay_supplier(purchase_id, amount, method, note)` | `{ok}` | **قرار 15**: إما بلا أثر نقدي (مطابقة) أو كحدث `withdraw` |
| `admin_*` (Edge Functions) | — | إنشاء مستخدم، إيقافه، تغيير دوره، إعادة تعيين كلمة المرور، `reset`/`importJSON` — كلها بـ `service_role` من متغيرات الخادم |

`open_cash_session` / `close_cash_session`: **لا مقابل لهما في الكود** — لا يوجد مفهوم وردية أو إغلاق يومي. الموجود «جرد صندوق» يسجّل الفرق قيدًا يدويًا. إضافتهما ميزة جديدة (القرار 8).

---

## 6. ما تحققتُ منه بنفسي (أرقام حقيقية من تشغيل jsdom)

- حالات الفواتير: `paid 420 · partial 81 · unpaid 36 · returned 11 · held 0`
- طرق الدفع: `cash 350 · credit 120 · card 78`
- أنواع الحركات: `out 1195 · in 225 · adjust 20 · return 21`
- حالات أوامر الشراء: `received 29 · shipping 6 · draft 3`
- الدفعات: 49، منها `cash 31 · card 18`، و**صفر** منها يحمل `saleId`، وصفر من نوع `charge` في البيانات المولّدة
- المنتجات: 127، **كلها `taxable=false`**، وكلها لها `supplierId`؛ `taxRate = 0`؛ `allowNegativeStock = false`؛ `cashOpening = 2500`
- المورّدون: اثنان لهما رصيد بمجموع `10.524,926 د.ل` — **بلا أي عملية سداد في `HS.store`**
- الأدوار: `مدير 1 · بائع 3` (ودورَا «مشرف مخزن» و«محاسب» معرّفان في `ROLE_PERMS` بلا مستخدمين)
- `BRAND_ROWS[0] = {name:"Dior", prefix:"3125", country:"فرنسا"}`
- مثال طابع زمني: `2026-09-28T18:51:35` — **بلا إزاحة**، بينما `purchases.date = "2026-09-24"` تاريخ فقط (ويُقرأ UTC في JS!)

---

## 7. التعارضات والقرارات المطلوبة منك (28 بندًا، 8 منها جوهرية)

> **الجوهرية = ★** (توقف المرحلة 1 حتى تحسمها).

| # | البرومت يقول | الكود يفعل (المرجع) | الأثر | توصيتي |
|---|---|---|---|---|
| ★1 | البائع لا يعدّل أسعارًا ولا تكاليف | دور `بائع` يملك `products_edit, inventory_adjust, cash_manage, debts_manage, expenses_manage, pos_discount` (data.js:294-295) | تشديد الصلاحيات يغيّر سلوكًا قائمًا وقد يكسر `uitest.js` (يفحص الحفظ بدخول بائع؟) | أشدّد في **الإنتاج** عبر `ROLE_PERMS` الجديد + RLS، وأبقي الوضع التجريبي كما هو؛ وأوثّق الفرق |
| ★2 | إخفاء `cost/profit` عن البائع إن كان النظام يخفيهما | **لا يخفيهما**: عمود الربح مشروط بـ `reports_view` فقط والبائع يملكه (sales.js:107,167)، وأعمدة التكلفة والهامش بلا شرط (products.js:189-191) | إضافة إخفاء = تغيير تصميم/سلوك | أنشئ view `products_public` و`sales_no_cost` وأربط البائع بهما — **بموافقتك الصريحة** لأنه تغيير مرئي |
| ★3 | — | `can("customers_edit")` مستعملة (customers.js:38,260) لكن **الصلاحية غير معرّفة** في `PERMISSIONS` | البائع لا يعدّل عميلًا اليوم (يفشل الفحص)، والمدير ينجح بالتجاوز | أضيف `customers_edit` للقائمة وأمنحها للبائع؟ أم أبقيها حكرًا على المدير؟ |
| ★4 | `status 'debt'` | `'unpaid'` في كل مكان (store.js:622,677 · sales.js:81 · `#/sales?tab=unpaid`) | تغييرها يكسر الصفحات والاختبارات | أبقي `unpaid` |
| ★5 | `cash_events` جدول مخزّن = المصدر الوحيد | `cashEvents()` **إسقاط محسوب** من 4 مجموعات (store.js:1061-1131) | الجدول المخزّن يمكن أن ينحرف؛ و`paySale` يغيّر حدثًا ماضيًا بأثر رجعي | دالة/عرض SQL مطابق + جدول `cash_entries` لليدوي. الضمان نفسه بلا خطر انحراف |
| ★6 | `collect_debt` يوزّع على الأقدم أولًا | **مساران منفصلان ولا توزيع**: `paySale` على الفاتورة (بلا قيد دفعات، وأثره النقدي **بأثر رجعي على تاريخ البيع**) و`customerPayment` على الحساب (لا يمسّ حالة الفاتورة) | التوزيع يغيّر تبويبات المبيعات وأرقام `debts()` والاختبارات | أنفّذ المسارين كما هما (`pay_invoice` + `collect_debt`)، والتوزيع ميزة مؤجلة. وأقترح **منع تغيير `method` في `paySale`** لأنه يحذف نقدًا محتسبًا بأثر رجعي |
| ★7 | `receive_purchase` يحدّث متوسط التكلفة «إن كان النظام يفعل» | **لا يفعل**: حركات `in` فقط (store.js:~905). `po.items[].cost` موجود لكن لا يُكتب على الصنف | إضافة متوسط تكلفة تغيّر الأرباح التاريخية | مطابقة: بلا تغيير تكلفة؛ وإن أردته فميزة مستقلة بقرار منفصل |
| ★8 | `open_cash_session`/`close_cash_session` «إن وُجد إغلاق يومي» | **لا يوجد**. الموجود «جرد الصندوق» يقارن المعدود بالمتوقع على `range("all")` ويسجّل الفرق قيدًا (cash.js:374-427) | الورديات ميزة جديدة تمسّ UI | أؤجلها؛ وأنفّذ `record_cash_count` المطابق |
| 9 | `check (stock >= 0)` | `recomputeStock` **يقصّ عند الصفر** `Math.max(0, …)` رغم وجود `allowNegativeStock` | رصيد سالب حقيقي يظهر صفرًا (انحراف قائم) | لا قيد؛ أتحقق داخل `create_sale`، وأخزّن القيمة المشتقة الحقيقية |
| 10 | `brand_id` FK | `brand` نص حر + `brands()` مشتقة | FK يُلزم تعديل 4 صفحات | نص حر + جدول مرجعي للبادئات |
| 11 | `sales.remaining` | غير موجود (`total − paid`) | — | عمود مولّد أو view |
| 12 | `products.low_stock_threshold` | `minStock` على الصنف + `lowStockThreshold` عام في الإعدادات | التباس اسمين | `min_stock` للصنف، والإعداد العام يبقى في `settings` |
| 13 | — | `deleteProduct` **حذف نهائي** مع `undo()` في الذاكرة | FK من `sale_items`/`stock_movements` → يتيم أو فشل | soft delete (`active=false`)؛ التراجع = إعادة تفعيل |
| 14 | `customers` بلا `balance` | `balance` **مُجمَّع يدويًا** ولا يُعاد حسابه (store.js:33-46) | الانحراف بين جهازين | أشتقه في SQL (view) وأبقي حقل الكاش للتوافق |
| 15 | لا ذكر لذمم الموردين | دفعة المورد في `purchases.js:420-424` **بلا أثر على الصندوق** وبلا دالة في store | قرار مالي حقيقي | مطابقة الآن (بلا أثر نقدي) + توثيق؛ وتحويلها إلى `withdraw` بقرار لاحق |
| 16 | — | 4 مواضع تعدّل الحالة مباشرة ثم `save()` (القسم 3) | ضياع صامت في الوضع البعيد | أحوّلها كلها إلى RPC في المرحلة 3 |
| 17 | الوضع التجريبي يبقى | `load()` **يولّد بيانات كل إقلاع** ويعيد التوليد يوميًا (`isStale`/`mergeUserWork`) | في الوضع البعيد يجب تعطيله كليًا | `HS.repo.remote.load()` لا ينادي `generate()` أبدًا، و`reset/importJSON` عبر Edge Function |
| 18 | رقم الفاتورة من sequence | يُولَّد في العميل من `S.sales.length + 1` مع حلقة تعارض (store.js:580-586) | تكرار حتمي بين جهازين | sequence ✔ — مع الحفاظ على الشكل `INV-2026-1546` لأن `uitest.js` يفحص `#/sales/s-…` |
| 19 | `timestamptz` | طوابع naive بلا إزاحة؛ `purchases.date` تاريخ فقط (يُقرأ UTC) | إزاحة محتملة 24 ساعة في التقارير | أفسّر كل naive على `Africa/Tripoli` صراحة عند الترحيل، وأبقي تنسيق `Intl` بلا تغيير |
| 20 | CSP تسمح بـ `self` + Supabase + CDN | التطبيق يعمل من `file://` (أصل `null`) | CSP موحّد يكسر الوضع التجريبي | سياساتان: واحدة للنشر وأخرى تُعطَّل على `file://`؛ و`_headers` لا يعمل على GitHub Pages (Netlify فقط) |
| 21 | `X-Content-Type-Options` و`Referrer-Policy` | — | لا يمكن إرسالهما بـ `<meta>` | أوثّق أنهما يحتاجان Netlify/`_headers` أو Cloudflare Pages |
| 22 | إزالة `tools/` من الرفع | `tools/` + `package.json` مرفوعان الآن | — | أنقلها إلى `dev/` أو أستثنيها بـ `.gitignore` — **لكنها معيار نجاحك**، فأقترح إبقاءها في المستودع واستبعادها من النشر فقط |
| 23 | «`ui.js` سطر 680 يستعمل `o.title` خامًا — حدّد من يستدعيه» | **تصحيح بعد الفحص:** السطر 680 هو `HS.ui.listItem` (لا `modal` ولا `confirm`)، وهو **كود ميت: صفر مستدعٍ** في المشروع كله. أما `HS.ui.modal` و`HS.ui.confirm` **فيهرّبان العنوان والعنوان الفرعي فعلًا** (`HS.esc(o.title)`، `HS.esc(o.sub)`)، لذلك `title: "حذف «" + c.name + "»؟"` في customers.js:506 وproducts.js:537 وsuppliers.js:319 آمن | لا مسار حقن من العناوين. السطح الحقيقي المتبقي هو `o.html` في `confirm` (11 موضعًا، يُمرَّر خامًا بالاتفاق) و41 إسناد `innerHTML` في الصفحات | أحذف `listItem` الميت أو أهرّبه دفاعًا، وأفحص المواضع الـ11 والـ41 موضعًا واحدًا واحدًا في المرحلة 5، مع اختبار `<img src=x onerror=…>` المطلوب. **فحصي الآن استهدافي لا شامل** — لم أعدّل شيئًا بعد |
| 24 | 8 أحرف لكلمة المرور | 4 أحرف (store.js:990) + زر «دخول تجريبي سريع» | — | 8 في الإنتاج، 4 في الوضع التجريبي، وإخفاء الزر عند وجود `config.js` |
| 25 | `pos.js` يفترض صلاحيات | **صفر فحص `can()` في pos.js** | `pos_sell`/`pos_discount` معرّفتان بلا استعمال | أفرض الخصم خادميًا في `create_sale` (لا الاعتماد على الواجهة) |
| 26 | المزامنة اللحظية | `checkout` متزامن ويعيد `{ok, sale}`، لكن **POS يلفّه أصلًا في `HS.sleep(380).then(...)` مع `data-loading`** (pos.js:460-475) | — | خبر جيد: تحويل البيع إلى `await` RPC لا يحتاج إعادة هيكلة؛ أقترح **حجبًا لا تفاؤلًا** للبيع وحده (الإيصال يُطبع فورًا) وتفاؤلية للباقي |
| 27 | `settings` صف واحد | 24 مفتاحًا منها `theme/density/accent` + `ui` + `carts` في نفس الكتلة | تصارع جهازين على السمة | `settings` للمحل (21 مفتاحًا)، والتفضيلات في `profiles.prefs`، و`ui`/`carts` محليتان دائمًا |
| 28 | لا async/await إلا للضرورة | الاختبارات على jsdom 20 (Node 20.20.2) | — | `HS.repo` يعيد وعودًا، و`HS.store` يبقى متزامنًا فوق كاش؛ لا `async` في الصفحات |

---

## 8. حالة الاختبارات (أرقام من تشغيل فعلي الآن)

| الأداة | النتيجة |
|---|---|
| `node tools/smoke.js` | **الأخطاء 0 · التحذيرات 0** (14 مسارًا + 12 سيناريو) |
| `node tools/uitest.js` | **52 / 52** ناجحة، 0 أخطاء |
| `node tools/cashcheck.js` | **الأخطاء 0** |
| `node tools/spec.js` | **كل اختبارات المواصفات ناجحة ✓** |
| إثبات النقل | `cd / && node /home/user/hesham-store/tools/spec.js` → ناجحة (لا مسارات ثابتة) |

**ملاحظة عن طلبك في البند 3:** تصحيح المسار الثابت إلى `path.join(__dirname, "..")` **تم فعلًا في الجولة السابقة** في `smoke.js` و`uitest.js` (كانا `cashcheck.js` و`spec.js` نسبيين أصلًا)، وأضفت محمّل `jsdom` متدرّج المسارات يطبع `npm install` بدل الانهيار.

### ما لم أستطع اختباره
- أي سلوك Supabase (لا مشروع، لا مفاتيح، لا MCP متصل في هذه البيئة) — لذلك **لم أكتب هجرة ولم أدّعِ صحة أي SQL**. المسودة في 4.3 للمراجعة فقط ولم تُنفَّذ على أي قاعدة.
- `get_advisors` / فحص RLS الفعلي — يحتاج اتصالًا بمشروعك.
- تحميل خطوط `woff2` وترخيصها (المرحلة 5).
- التزامن الحقيقي بين جهازين (يحتاج خادمًا حيًا).

---

## 9. ما أحتاجه منك للموافقة على الانتقال للمرحلة 1

1. **القرار 1 و2:** هل أشدّد دور البائع وأخفي عنه التكلفة/الربح (تغيير سلوكي مرئي)، أم أبقي المطابقة مع اليوم؟
2. **القرار 5:** `cash_events` كدالة/عرض SQL (توصيتي) أم جدول مخزّن كما في البرومت؟
3. **القرار 6:** هل أوزّع التحصيل على الأقدم أولًا (يغيّر أرقامًا قائمة) أم أنفّذ المسارين كما هما؟
4. **القرار 7 و8:** تأكيد أن `receive_purchase` بلا متوسط تكلفة، وأن الورديات مؤجلة.
5. **القرار 13:** الحذف النهائي للمنتج → تليين؟
6. **القرار 15:** ذمم الموردين — تبقى بلا أثر نقدي؟
7. **القرار 3:** تعريف `customers_edit` ومنحها لمن؟
8. **اسم المشروع/المستودع** ومجلد `supabase/` — أأنشئه داخل `hesham-store/` كما هو أم بعد إعادة تسمية؟

بعد موافقتك أبدأ المرحلة 1 بملفات هجرة مرقّمة + اختبارات SQL للسيناريوهات الثمانية، ولن أنتقل للمرحلة 2 قبل أن ينطبق رصيد الصندوق المحسوب من `cash_events` على جدولك في القسم 2 في كل سيناريو.
