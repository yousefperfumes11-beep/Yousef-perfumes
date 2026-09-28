/* ═══════════════════════════════════════════════════════════
   أداة فحص محلية: تشغّل التطبيق داخل jsdom، تعبر كل المسارات،
   وتطبع كل خطأ يظهر في الطرفية. ليست جزءًا من التطبيق.
   الاستعمال: node tools/smoke.js
   ═══════════════════════════════════════════════════════════ */
/** يحمّل jsdom من أول مسار متاح — التطوير فقط، والتطبيق نفسه لا يحتاجه */
function loadJsdom() {
  var candidates = [
    "jsdom",
    require("path").join(__dirname, "..", "node_modules", "jsdom"),
    "/tmp/node_modules/jsdom"
  ];
  for (var i = 0; i < candidates.length; i++) {
    try { return require(candidates[i]); } catch (e) { /* نحو المسار التالي */ }
  }
  console.error("تعذّر تحميل jsdom. ثبّته أولًا داخل مجلد المشروع:\n  npm install");
  process.exit(1);
}
const { JSDOM, VirtualConsole } = loadJsdom();

const path = require("path");
const fs = require("fs");
const ROOT = path.join(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const URL = "file://" + INDEX;
const errors = [];
const warns = [];

function log(kind, msg) {
  const line = `[${kind}] ${msg}`;
  (kind === "error" ? errors : warns).push(line);
  console.log(line);
}

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const m = String(e.message || e);
  if (/Could not load|not implemented|Error: Not implemented/i.test(m) && /CSSStyleSheet|canvas|print/i.test(m)) return warns.push("[warn] " + m);
  log("error", "jsdomError: " + (e.stack || m));
});
vc.on("error", (...a) => log("error", "console.error: " + a.map(String).join(" ")));
vc.on("warn", (...a) => log("warn", "console.warn: " + a.map(String).join(" ")));

const HTML = fs.readFileSync(INDEX, "utf8");

const dom = new JSDOM(HTML, {
  url: URL,
  resources: "usable",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.matchMedia = window.matchMedia || function (q) {
      return { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } };
    };
    window.print = function () {};
    window.scrollTo = function () {};
    window.URL.createObjectURL = () => "blob:mock";
    window.URL.revokeObjectURL = () => {};
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.HTMLCanvasElement.prototype.getContext = function () { return null; };
    Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { get() { return 900; }, configurable: true });
    Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { get() { return 44; }, configurable: true });
    window.addEventListener("error", (e) => log("error", "window.onerror: " + ((e.error && e.error.stack) || e.message)));
    window.addEventListener("unhandledrejection", (e) => log("error", "unhandledrejection: " + ((e.reason && e.reason.stack) || e.reason)));
  }
});

const { window } = dom;
const doc = window.document;

function tick() { return new Promise((r) => setTimeout(r, 0)); }
function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  /* انتظر تحميل كل السكربتات ثم إقلاع التطبيق */
  for (let i = 0; i < 80 && !window.HS; i++) await wait(50);
  if (!window.HS) { console.log("HS لم يُحمَّل"); process.exit(1); }
  for (let i = 0; i < 60 && !(window.HS.app && window.HS.store.state); i++) await wait(50);
  await wait(300);

  const HS = window.HS;
  console.log("الحالة: " + HS.store.state.products.length + " صنفًا، " + HS.store.state.sales.length + " فاتورة");

  const goto = (h) => { window.location.hash = h; window.dispatchEvent(new window.HashChangeEvent("hashchange")); };

  async function step(name, fn) {
    try { await fn(); await tick(); }
    catch (e) { log("error", `${name}: ${e.stack}`); }
  }

  /* ── الدخول ── */
  await step("الدخول التجريبي", () => {
    const r = HS.store.login("youssef", "1234");
    if (!r.ok) throw new Error("فشل الدخول: " + r.error);
    HS.bus.emit("session:start", r.user);
    HS.router.go("/", null, { replace: true });
  });
  await wait(120);

  const st = HS.store.state;
  const routes = ["/", "/pos", "/sales", "/sales/" + st.sales[0].id, "/products", "/inventory",
    "/barcode", "/purchases", "/suppliers", "/customers", "/cash", "/expenses", "/reports", "/users", "/settings"];
  const tabs = {
    "/sales": ["all", "paid", "partial", "unpaid", "returned"],
    "/inventory": ["movements", "levels", "alerts"],
    "/barcode": ["labels", "generate", "scan"],
    "/purchases": ["all", "draft", "shipping", "received", "cancelled"],
    "/suppliers": ["all", "active", "owing", "inactive"],
    "/customers": ["all", "credit", "owing", "over", "cash", "inactive"],
    "/reports": ["overview", "sales", "products", "customers", "cash", "inventory", "purchases", "export"],
    "/settings": ["identity", "financial", "inventory", "receipt", "appearance", "data", "about"],
    "/products": ["all", "active", "inactive", "low", "out"],
    "/cash": ["summary", "ledger"]
  };

  console.log("\n── عبور المسارات ──");
  for (const r of routes) {
    await step("مسار " + r, () => goto("#" + r));
    const t = tabs[r];
    if (t) for (const x of t) await step(`${r}?tab=${x}`, () => goto(`#${r}?tab=${x}`));
  }

  const queries = [
    "#/sales?q=عود&page=2", "#/sales?method=cash&customer=" + st.customers[0].id,
    "#/sales?from=2026-08-01&to=2026-09-01", "#/sales?min=200&sort=total&dir=asc",
    "#/products?q=عود&cat=men&view=cards", "#/products?sort=price&dir=asc&per=5",
    "#/inventory?product=" + st.products[0].id + "&type=in",
    "#/barcode?text=" + st.products[0].barcode + "&fmt=ean13", "#/barcode?text=YOUSSEF-30ML&mw=3&hh=80", "#/barcode?size=small&copies=3",
    "#/dashboard?metric=profit", "#/dashboard?metric=count",
    "#/pos?q=مسك&cat=women&sort=price-asc", "#/pos?disc=5&customer=" + st.customers[1].id,
    "#/cash?tab=ledger", "#/cash?kind=sale", "#/cash?dir2=out&per=15",
    "#/settings?tab=data", "#/reports?tab=products", "#/reports?tab=customers"
  ];
  console.log("\n── مرشّحات واستعلامات ──");
  for (const q of queries) await step("استعلام " + q, () => goto(q));

  console.log("\n── حجم المحتوى ──");
  for (const r of routes) {
    await step("فحص " + r, () => {
      goto("#" + r);
      const main = doc.querySelector("#main");
      if (!main) throw new Error("لا يوجد #main");
      const html = main.innerHTML;
      if (html.length < 500) log("error", `${r}: المحتوى صغير (${html.length})`);
      const bad = (html.match(/undefined|NaN|\[object Object\]/g) || []).length;
      if (bad) log("error", `${r}: ${bad} قيمة undefined/NaN في النص`);
      /* السلة الفارغة وشاشة الملصقات قبل التحديد حالتان طبيعيتان لا خلل فيهما */
      const emptyOk = ["/settings", "/pos", "/barcode"];
      if (main.querySelectorAll(".empty").length && !emptyOk.includes(r)) log("warn", `${r}: حالة فارغة`);
      console.log(`  ${r}: ${html.length} حرفًا`);
    });
    await wait(20);
  }

  console.log("\n── سيناريوهات التفاعل ──");

  await step("إضافة صنف إلى السلة وإتمام البيع", () => {
    goto("#/pos");
    HS.store.cart.clear();
    const p = HS.store.state.products.filter((x) => x.stock > 5)[0];
    const before = p.stock;
    let res = HS.store.cart.add(p.id, 2);
    if (!res.ok) throw new Error("cart.add: " + res.error);
    res = HS.store.checkout({ method: "cash", paid: 9999, customerId: null, status: "paid", note: "فحص آلي", discount: 0 });
    if (!res.ok) throw new Error("checkout: " + res.error);
    if (p.stock !== before - 2) throw new Error(`الرصيد لم يتغير: ${before} → ${p.stock}`);
    if (!res.sale.number) throw new Error("لا رقم للفاتورة");
    console.log(`  ✓ فاتورة ${res.sale.number} بقيمة ${res.sale.total} — الرصيد ${before} → ${p.stock}`);
    /* صفحة الفاتورة */
    goto("#/sales/" + res.sale.id);
    if (!doc.querySelector("#main").innerHTML.includes(res.sale.number)) throw new Error("صفحة الفاتورة لا تعرض الرقم");
    /* الإيصال */
    const rec = HS.receiptHTML(res.sale);
    if (!rec.includes("receipt__totals")) throw new Error("الإيصال ناقص");
  });

  await step("إرجاع فاتورة", () => {
    const sale = HS.store.state.sales[0];
    const before = HS.store.product(sale.items[0].productId).stock;
    const res = HS.store.returnSale(sale.id, "فحص آلي");
    if (!res.ok) throw new Error("returnSale: " + res.error);
    const after = HS.store.product(sale.items[0].productId).stock;
    if (after <= before) throw new Error("المرتجع لم يُعد الكميات");
    console.log(`  ✓ أُرجعت ${sale.number} — عاد ${after - before} وحدة`);
  });

  await step("إنشاء وتعديل وحذف صنف", () => {
    const n0 = HS.store.state.products.length;
    let r = HS.store.saveProduct({ name: "صنف الفحص الآلي", category: "grocery", unit: "قطعة", price: 12.5, cost: 8, minStock: 5, stock: 20, emoji: "🧪", active: true }, null);
    if (!r.ok) throw new Error("saveProduct: " + r.error);
    if (HS.store.state.products.length !== n0 + 1) throw new Error("لم يُضف الصنف");
    const id = r.product.id;
    r = HS.store.saveProduct({ name: "صنف الفحص المعدّل", price: 15, stock: 12 }, id);
    if (!r.ok || r.product.price !== 15) throw new Error("التعديل فشل");
    if (Math.round(r.product.stock) !== 12) throw new Error("الرصيد لم يُحدَّث: " + r.product.stock);
    const d = HS.store.deleteProduct(id);
    if (!d.ok) throw new Error("الحذف فشل");
    d.undo();
    if (!HS.store.product(id)) throw new Error("التراجع عن الحذف فشل");
    HS.store.deleteProduct(id);
    console.log("  ✓ إضافة/تعديل/حذف/تراجع تعمل");
  });

  await step("تسوية مخزون واستلام أمر شراء", () => {
    const p = HS.store.state.products[0];
    const before = p.stock;
    HS.store.adjustStock(p.id, 7, "فحص آلي");
    if (p.stock !== before + 7) throw new Error("التسوية لم تُطبق");
    const po = HS.store.state.purchases.filter((x) => x.status === "shipping")[0];
    if (po) {
      const t = po.items.map((l) => ({ id: l.productId, before: HS.store.product(l.productId).stock }));
      const r = HS.store.receivePurchase(po.id);
      if (!r.ok) throw new Error("receivePurchase: " + r.error);
      t.forEach((x) => {
        const line = po.items.filter((l) => l.productId === x.id)[0];
        const now = HS.store.product(x.id).stock;
        if (now !== x.before + line.qty) throw new Error(`${x.id}: ${x.before} + ${line.qty} ≠ ${now}`);
      });
      console.log(`  ✓ استُلم ${po.number} وأُضيفت كمياته`);
    }
  });

  await step("عميل: إضافة وسداد", () => {
    const r = HS.store.saveCustomer({ name: "عميل الفحص الآلي", phone: "0913000000", city: "طرابلس", accountType: "دين", creditLimit: 1000, balance: 400 }, null);
    if (!r.ok) throw new Error("saveCustomer: " + r.error);
    const c = r.record;
    const pay = HS.store.customerPayment(c.id, 150, "cash", "فحص");
    if (!pay.ok) throw new Error("customerPayment: " + pay.error);
    if (Math.abs(c.balance - 250) > 0.01) throw new Error("الرصيد خاطئ: " + c.balance);
    if (!HS.store.paymentsOf(c.id).length) throw new Error("لم يُسجّل في دفتر المدفوعات");
    HS.store.deleteCustomer(c.id);
    console.log("  ✓ إضافة عميل وسداد ذمة");
  });

  await step("مصروفات ومشتريات", () => {
    const n0 = HS.store.state.expenses.length;
    const r = HS.store.saveExpense({ date: "2026-09-20", category: "other", amount: 123.5, note: "فحص", method: "cash" }, null);
    if (!r.ok || HS.store.state.expenses.length !== n0 + 1) throw new Error("saveExpense");
    HS.store.deleteExpense(r.record.id);
    const p = HS.store.savePurchase({ supplierId: HS.store.state.suppliers[0].id, items: [{ productId: HS.store.state.products[0].id, name: HS.store.state.products[0].name, qty: 5, cost: 3 }], status: "draft" }, null);
    if (!p.ok || p.purchase.total !== 15) throw new Error("savePurchase: " + JSON.stringify(p.purchase && p.purchase.total));
    HS.store.deletePurchase(p.purchase.id);
    console.log("  ✓ مصروف وأمر شراء");
  });

  await step("الإحصاءات محسوبة", () => {
    const range = HS.store.range("30d");
    const k = HS.store.kpis(range);
    if (!(k.revenue > 0)) throw new Error("الإيراد صفر في 30 يومًا");
    if (!HS.store.daily(range).labels.length) throw new Error("السلسلة اليومية فارغة");
    if (!HS.store.byCategory(range).length) throw new Error("التوزيع حسب القسم فارغ");
    if (!HS.store.topProducts(range, 5).length) throw new Error("أعلى الأصناف فارغة");
    if (!HS.store.byMethod(range).length) throw new Error("طرق الدفع فارغة");
    if (!HS.store.byHour(range).length) throw new Error("الساعات فارغة");
    if (!HS.store.byWeekday(range).length) throw new Error("أيام الأسبوع فارغة");
    console.log(`  ✓ إيراد 30 يومًا ${HS.fmt.money(k.revenue)} · هامش ${HS.fmt.pct(k.margin, 1)} · ${k.invoices} فاتورة`);
  });

  await step("الباركود", () => {
    const svg = HS.barcode.svg("HS10004", { height: 50, moduleWidth: 2 });
    if (!svg.startsWith("<svg") || !svg.includes("rect")) throw new Error("SVG الباركود خاطئ");
    const ean = HS.barcode.ean13("611004300001");
    if (ean.length !== 13) throw new Error("EAN-13 خاطئ: " + ean);
    const esvg = HS.barcode.ean13svg(ean, { height: 50 });
    if (!esvg.includes("<svg")) throw new Error("EAN-13 svg خاطئ");
    if (HS.barcode.ean13bits(ean).length !== 95) throw new Error("طول الوحدات ≠ 95");
    /* تحقّق من رمز EAN-13 معروف: 4006381333931 */
    if (HS.barcode.ean13("400638133393") !== "4006381333931") throw new Error("خانة تحقق EAN خاطئة: " + HS.barcode.ean13("400638133393"));
    console.log("  ✓ Code128 وEAN-13 (" + ean + ")");
  });

  await step("النوافذ والتنبيهات", () => {
    const m = HS.ui.modal({ title: "فحص", body: "<p>محتوى</p>", footer: "" });
    if (!doc.querySelector(".modal-backdrop")) throw new Error("النافذة لم تُفتح");
    m.close(true);
    HS.ui.toast({ type: "success", title: "فحص", msg: "رسالة" });
    if (!doc.querySelector(".toast")) throw new Error("التنبيه لم يظهر");
  });

  await step("التصدير", () => {
    const csv = HS.toCSV([{ "الاسم": "تجربة, بفاصلة إنجليزية", "الرقم": 1.5 }]);
    /* العلامة BOM تُضاف في HS.download لأن toCSV تُستخدم أيضًا للعرض */
    if (!csv.includes('"تجربة, بفاصلة إنجليزية"')) throw new Error("الفواصل غير مقتبسة: " + csv);
    const json = HS.store.exportJSON();
    const parsed = JSON.parse(json);
    const inner = parsed.store || parsed;
    if (inner.products.length !== HS.store.state.products.length) throw new Error("JSON ناقص");
    /* الاستيراد يجب أن يقبل نفس الصيغة المُصدَّرة */
    const imp = HS.store.importJSON(json);
    if (!imp.ok) throw new Error("importJSON رفض ملف التصدير: " + imp.error);
    if (imp.state.products.length !== inner.products.length) throw new Error("الاستيراد فقد أصنافًا");
    const bad = HS.store.importJSON("{ هذا ليس json");
    if (bad.ok) throw new Error("importJSON قبل ملفًا تالفًا");
    console.log("  ✓ CSV وJSON (تصدير ثم استيراد)");
  });

  await step("تغيير الإعدادات", () => {
    HS.store.updateSettings({ storeName: "متجر الفحص", decimals: 2, taxRate: 5, theme: "dark", density: "compact", accent: "petrol", numerals: "arabic" });
    const shaped = HS.fmt.money(12.3456);
    if (!/[٠-٩]/.test(shaped)) log("warn", "الأرقام العربية لم تُطبق: " + shaped);
    HS.store.updateSettings({ storeName: HS.STORE_NAME, decimals: 3, taxRate: 0, theme: "light", density: "cozy", accent: "emerald", numerals: "latin" });
    console.log("  ✓ إعدادات مطبّقة ومُستعادة");
  });

  await step("إعادة توليد البيانات", () => {
    const n0 = HS.store.state.sales.length;
    HS.store.reset(true);
    if (!HS.store.state.sales.length) throw new Error("لا مبيعات بعد إعادة التوليد");
    goto("#/");
    console.log(`  ✓ ${n0} → ${HS.store.state.sales.length} فاتورة`);
  });

  await wait(200);
  console.log("\n════════════════════════════════════════");
  console.log("الأخطاء: " + errors.length + "   التحذيرات: " + warns.length);
  if (errors.length) { console.log("\n" + errors.join("\n")); }
  console.log("════════════════════════════════════════");
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.log("فشل الفاحص: " + e.stack); process.exit(2); });
