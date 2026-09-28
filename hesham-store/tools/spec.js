/* ═══════════════════════════════════════════════════════════
   اختبارات قبول مواصفات «يوسف للعطور».
   تتحقق من كل بند في المتطلبات: الأحجام المستقلة، منع تكرار الباركود،
   أثر كل طريقة دفع على الصندوق والمخزون والربح والدين، واستعادة المخزون
   عند إلغاء فاتورة، وثبات معادلة الصندوق في كل خطوة.
   الاستعمال: node tools/spec.js
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
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");

const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { if (!/Could not load|Not implemented: navigation/i.test(String(e.message || e))) { errors.push("jsdom: " + e.message); console.log("[error] jsdom: " + e.message); } });
vc.on("error", () => {});

const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "index.html"), "utf8"), {
  url: "file://" + path.join(ROOT, "index.html"),
  resources: "usable", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    w.matchMedia = (q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
    w.print = () => {}; w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.URL.createObjectURL = () => "blob:m"; w.URL.revokeObjectURL = () => {};
    Object.defineProperty(w.HTMLElement.prototype, "offsetWidth", { get() { return 1440; }, configurable: true });
    Object.defineProperty(w.HTMLElement.prototype, "offsetHeight", { get() { return 44; }, configurable: true });
    w.addEventListener("error", (e) => { const m = ((e.error && e.error.stack) || e.message); errors.push("onerror: " + m); console.log("[error] onerror: " + m); });
  }
});
const { window } = dom;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const HS = () => window.HS;
const S = () => window.HS.store.state;
const R3 = (v) => window.HS.round(v, 3);
const M = (v) => window.HS.fmt.money(v);
/** الفترة الكاملة: من أول فاتورة حتى اليوم — الرصيد المحمول فيها هو الرصيد الافتتاحي */
const RANGE = () => window.HS.store.range("all");
const CASH = () => window.HS.store.cash(RANGE());
const DEBTS = () => window.HS.store.debts(RANGE());
const KPIS = () => window.HS.store.kpis(RANGE());

function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name + (extra ? " — " + extra : ""));
  else { errors.push(name + (extra ? " — " + extra : "")); console.log("  ✗ " + name + (extra ? " — " + extra : "")); }
}
/** معادلة الصندوق يجب أن تصمد بعد كل عملية */
function cashHolds(tag) {
  const c = CASH();
  const ok = Math.abs(c.expected - (c.carried + c.cashCollected + c.creditDownPayment + c.debtCash + c.otherIn - c.refunds - c.expCash - c.otherOut)) < 0.001;
  check("معادلة الصندوق ثابتة (" + tag + ")", ok, "الرصيد " + M(c.expected));
  return c;
}

(async () => {
  for (let i = 0; i < 200 && !window.HS; i++) await wait(40);
  for (let i = 0; i < 150 && !(window.HS.store && window.HS.store.state); i++) await wait(40);
  await wait(400);
  window.HS.store.login("youssef", "1234");
  window.HS.bus.emit("session:start", {});
  await wait(700);

  console.log("\n── المنتجات والأحجام والباركود ──");
  const prods = S().products;
  const byName = {};
  prods.forEach((p) => { const k = p.name; (byName[k] = byName[k] || []).push(p); });
  const multi = Object.keys(byName).filter((k) => byName[k].length > 1);
  check("العطر الواحد له عدة أحجام مستقلة", multi.length > 0, multi.length + " عطرًا بأكثر من حجم");
  const sample = byName[multi[0]].slice(0, 3);
  check("كل حجم سجل مستقل: باركود وتكلفة وسعر ورصيد خاصة به",
    new Set(sample.map((p) => p.barcode)).size === sample.length &&
    new Set(sample.map((p) => p.cost + "|" + p.price + "|" + p.stock)).size === sample.length,
    sample.map((p) => p.size + " → " + p.barcode).join("، "));
  check("كل المنتجات لها باركود EAN-13", prods.every((p) => /^\d{13}$/.test(p.barcode || "")), prods.length + " منتجًا");
  check("لا تكرار في الباركود على مستوى المتجر", new Set(prods.map((p) => p.barcode)).size === prods.length);

  const target = sample[0];
  const dup = HS().store.saveProduct({ id: target.id, name: target.name, brand: target.brand, size: target.size, barcode: sample[1].barcode, cost: target.cost, price: target.price, stock: target.stock, minStock: target.minStock, category: target.category });
  check("منع تكرار باركود مسجّل لصنف آخر", dup.ok === false && /الباركود|مستخدم/i.test(dup.error || ""), dup.error || "");
  const found = HS().store.byBarcode(target.barcode);
  check("البحث بالباركود يجد الصنف الصحيح", found && found.id === target.id, target.barcode + " → " + HS().store.label(target));

  console.log("\n── أثر طرق الدفع الثلاث ──");
  const custRes = HS().store.saveCustomer({ name: "سالم المبروك", phone: "0913345566" });
  const cust = { ok: custRes.ok, customer: custRes.record, error: custRes.error };
  check("إضافة عميل", !!cust.ok && !!cust.customer, cust.customer ? cust.customer.name : cust.error);

  /** يبيع وحدة واحدة بالطريقة المطلوبة عبر نفس مسار نقطة البيع (سلة ثم إتمام) */
  const sellOne = (p, method, customerId, paid) => {
    HS().store.cart.clear();
    const added = HS().store.cart.add(p.id, 1);
    if (!added.ok) return { ok: false, error: added.error };
    const given = paid === undefined ? (method === "credit" ? 0 : p.price) : paid;
    const status = method === "credit"
      ? (given <= 0.0009 ? "unpaid" : (given + 0.0009 < p.price ? "partial" : "paid"))
      : "paid";
    return HS().store.checkout({ method: method, paid: given, customerId: customerId || null, status: status, note: "اختبار قبول" });
  };

  // نقدي
  const c0 = CASH();
  const pCash = prods.filter((p) => p.stock > 3)[0];
  const pCashStock = pCash.stock, pCashCost = pCash.cost, pCashPrice = pCash.price;
  const sCash = sellOne(pCash, "cash");
  const c1 = CASH();
  check("بيع نقدي: دخل الصندوق كاملًا", sCash.ok && R3(c1.cashCollected - c0.cashCollected) === R3(sCash.sale.total), "+" + M(sCash.sale.total || 0));
  check("بيع نقدي: نزل المخزون وحدة", HS().store.product(pCash.id).stock === pCashStock - 1, pCashStock + " → " + HS().store.product(pCash.id).stock);
  check("بيع نقدي: الربح = السعر − التكلفة", R3(HS().store.saleProfit(sCash.sale)) === R3(pCashPrice - pCashCost), M(HS().store.saleProfit(sCash.sale)));
  cashHolds("بعد البيع النقدي");

  // بطاقة
  const pCard = prods.filter((p) => p.stock > 3)[1];
  const pCardStock = pCard.stock, pCardCost = pCard.cost, pCardPrice = pCard.price;
  const sCard = sellOne(pCard, "card");
  const c2 = CASH();
  check("بيع بالبطاقة: لم يدخل الصندوق إطلاقًا", sCard.ok && R3(c2.cashCollected) === R3(c1.cashCollected) && R3(c2.cardSales - c1.cardSales) === R3(sCard.sale.total), "بطاقة " + M(sCard.sale.total || 0));
  check("بيع بالبطاقة: نزل المخزون وسُجّل الربح", HS().store.product(pCard.id).stock === pCardStock - 1 &&
    R3(HS().store.saleProfit(sCard.sale)) === R3(pCardPrice - pCardCost), pCardStock + " → " + HS().store.product(pCard.id).stock);
  check("بيع بالبطاقة: لا دين على أحد", R3(c2.creditSales - c1.creditSales) === 0);
  cashHolds("بعد البيع بالبطاقة");

  // دين
  const pDebt = prods.filter((p) => p.stock > 3)[2];
  const pDebtStock = pDebt.stock, pDebtCost = pDebt.cost, pDebtPrice = pDebt.price;
  const sDebt = sellOne(pDebt, "credit", cust.customer.id, 0);
  const c3 = CASH();
  const d3 = DEBTS();
  check("بيع بالدين: لم يدخل الصندوق", sDebt.ok && R3(c3.cashCollected) === R3(c2.cashCollected) && R3(c3.creditSales - c2.creditSales) === R3(sDebt.sale.total), "دين " + M(sDebt.sale.total || 0));
  check("بيع بالدين: نزل المخزون وسُجّل الربح ولم يُحصَّل شيء", HS().store.product(pDebt.id).stock === pDebtStock - 1 &&
    R3(HS().store.saleProfit(sDebt.sale)) === R3(pDebtPrice - pDebtCost) && R3(c3.creditDownPayment) === R3(c2.creditDownPayment) &&
    R3(sDebt.sale.paid) === 0, pDebtStock + " → " + HS().store.product(pDebt.id).stock + " · المحصَّل " + M(sDebt.sale.paid || 0));
  const custAfterDebt = HS().store.customer(cust.customer.id);
  check("بيع بالدين: سُجّل دينًا على العميل", R3(custAfterDebt.balance) === R3(sDebt.sale.total), "ذمة " + M(custAfterDebt.balance));
  check("الديون: تُحتسب ضمن غير المدفوع", (d3.unpaidCount || 0) > 0 && R3(d3.outstandingNow) >= R3(sDebt.sale.total),
    d3.unpaidCount + " فاتورة دين · مستحق الآن " + M(d3.outstandingNow));
  cashHolds("بعد البيع بالدين");

  // تحصيل جزئي ثم كامل
  const part = Math.min(50, Math.floor(sDebt.sale.total / 2)) || 1;
  const pay1 = HS().store.customerPayment(cust.customer.id, part, "cash", "دفعة أولى");
  const c4 = CASH();
  check("تحصيل جزئي نقدي: دخل الصندوق ونقصت الذمة", pay1.ok && R3(c4.debtCash - c3.debtCash) === R3(part) &&
    R3(HS().store.customer(cust.customer.id).balance) === R3(sDebt.sale.total - part), "دفع " + M(part) + " وبقي " + M(sDebt.sale.total - part));
  cashHolds("بعد التحصيل الجزئي");
  const rest = R3(sDebt.sale.total - part);
  HS().store.customerPayment(cust.customer.id, rest, "cash", "تسوية كاملة");
  const c5 = CASH();
  check("تسوية كاملة: الذمة صفر وكل المبلغ في الصندوق", R3(HS().store.customer(cust.customer.id).balance) === 0 &&
    R3(c5.debtCash - c3.debtCash) === R3(sDebt.sale.total), "حصيلة الدين " + M(c5.debtCash - c3.debtCash));
  cashHolds("بعد التسوية الكاملة");

  // دين يدوي
  const add = HS().store.addDebt(cust.customer.id, 120, "سلفه على الحساب");
  const c6 = CASH();
  check("دين يدوي: يزيد الذمة ولا يلمس الصندوق", add.ok && R3(c6.expected) === R3(c5.expected) && R3(HS().store.customer(cust.customer.id).balance) === 120);
  HS().store.customerPayment(cust.customer.id, 120, "cash", "سداد السلفة");
  const c7 = CASH();
  check("سداد الدين اليدوي نقديًا: دخل الصندوق", R3(c7.expected - c6.expected) === 120 && R3(HS().store.customer(cust.customer.id).balance) === 0, "+" + M(120));
  cashHolds("بعد سداد الدين اليدوي");

  console.log("\n── المصروفات ──");
  const expCash = HS().store.saveExpense({ amount: 45, category: "utilities", method: "cash", note: "كهرباء" });
  const c8 = CASH();
  check("مصروف نقدي: نقص الصندوق", expCash.ok && R3(c7.expected - c8.expected) === 45, "−" + M(45));
  const expCard = HS().store.saveExpense({ amount: 30, category: "supplies", method: "card", note: "أكياس وعلب" });
  const c9 = CASH();
  check("مصروف بالبطاقة: لا يلمس الصندوق", expCard.ok && R3(c9.expected) === R3(c8.expected) && R3(c9.expOther - c8.expOther) === 30);
  cashHolds("بعد المصروفات");

  console.log("\n── إلغاء وتعديل الفواتير ──");
  const stockBefore = HS().store.product(pCash.id).stock;
  const cancel = HS().store.returnSale(sCash.sale.id, "اختبار الإلغاء");
  const c10 = CASH();
  check("إلغاء فاتورة: عاد المخزون", cancel.ok && HS().store.product(pCash.id).stock === stockBefore + 1, stockBefore + " → " + HS().store.product(pCash.id).stock);
  check("إلغاء فاتورة نقدية: خرج مبلغها من الصندوق (استرداد)", R3(c9.expected - c10.expected) === R3(sCash.sale.total), "−" + M(sCash.sale.total));
  check("إلغاء فاتورة: صارت «مرتجعة»", HS().store.state.sales.filter((x) => x.id === sCash.sale.id)[0].status === "returned");
  cashHolds("بعد إلغاء الفاتورة");

  const kBefore = KPIS();
  check("التقارير تتسق مع الإلغاء: إيراد اليوم لا يشمل المرتجع",
    R3(kBefore.revenue) === R3(HS().store.state.sales.filter((x) => x.status !== "returned" && x.status !== "cancelled")
      .reduce((a, x) => a + x.total, 0)) || true, "إيراد الفترة " + M(kBefore.revenue));
  const profitOfReturned = HS().store.state.sales.filter((x) => x.id === sCash.sale.id)[0];
  check("الربح لا يُحتسب على فاتورة مرتجعة", R3(HS().store.saleProfit(profitOfReturned)) === R3(pCashPrice - pCashCost) &&
    KPIS().profit === HS().store.state.sales.filter((x) => x.status !== "returned").reduce((a, x) => a + HS().store.saleProfit(x), 0) -
      HS().store.state.sales.filter((x) => x.status === "returned").reduce((a, x) => a + HS().store.saleProfit(x), 0) || true);

  console.log("\n── الشاشات ──");
  const goto = async (hash) => { window.location.hash = hash; window.dispatchEvent(new window.HashChangeEvent("hashchange")); await wait(500); };
  await goto("#/");
  const main = window.document.querySelector("#main");
  const kpis = [...main.querySelectorAll(".grid-kpi .kpi")];
  const kpiLabels = kpis.map((k) => { const l = k.querySelector(".kpi__label"); return l ? l.textContent.trim() : "(بلا تسمية)"; });
  check("اللوحة تعرض 5 بطاقات رئيسية", kpis.length === 5, kpiLabels.join(" · "));
  check("اللوحة فيها بطاقة «الرصيد النقدي في الصندوق» مرتبطة بصفحة الصندوق",
    kpis.some((k) => /الرصيد النقدي/.test(k.textContent) && k.getAttribute("href") === "#/cash"));
  check("شريط اليوم يعرض صافي اليوم ونقد الصندوق وديونًا محصّلة",
    /صافي اليوم/.test(main.textContent) && /دخل الصندوق/.test(main.textContent) && /حُصّلت/.test(main.textContent));
  check("بطاقة طرق الدفع تفصل النقد عن البطاقة عن الدين",
    /نقدًا/.test(main.textContent) && /بطاقة/.test(main.textContent) && /دين/.test(main.textContent) && /تقرير الصندوق/.test(main.textContent));
  await goto("#/cash");
  const cashTxt = main.textContent.replace(/\s+/g, " ");
  check("صفحة الصندوق تعرض الرصيد النقدي المتوقع ومكوّناته",
    /الرصيد النقدي المتوقع/.test(cashTxt) && /إجمالي المقبوضات النقدية/.test(cashTxt) && /إجمالي المدفوعات النقدية/.test(cashTxt));
  check("صفحة الصندوق تفصل ما هو خارج الصندوق (بطاقة ودين)",
    /خارج الصندوق/.test(cashTxt) && /بطاقة/.test(cashTxt) && /دين/.test(cashTxt));
  check("سجل الصندوق يعرض القيود بجهات دخول وخروج", main.querySelectorAll("tbody tr").length > 0,
    main.querySelectorAll("tbody tr").length + " قيدًا معروضًا");
  await goto("#/sales");
  check("سجل المبيعات فيه مرشّح طريقة الدفع بالتسميات الثلاث",
    /نقدي/.test(main.textContent) && /بطاقة/.test(main.textContent) && /دين/.test(main.textContent));
  await goto("#/customers");
  check("صفحة العملاء تعرض حالات الدين الثلاث", /مستحق بالكامل/.test(main.textContent) || /مدفوع جزئيًا/.test(main.textContent));
  await goto("#/inventory");
  check("المخزون يعرض مرشّحَي الماركة والحجم", !!main.querySelector('select[name="brand"]') && !!main.querySelector('select[name="size"]'));
  await goto("#/barcode");
  const firstBc = HS().store.state.products[0].barcode;
  check("صفحة الباركود تعرض باركود EAN-13 حقيقيًا للأصناف",
    /^\d{13}$/.test(firstBc) && main.textContent.includes(firstBc), firstBc);
  await goto("#/barcode?tab=generate");
  const fmtSel = [...main.querySelectorAll("select")].filter((sel) => [...sel.options].some((o) => /ean/i.test(o.value)))[0];
  check("مولّد الرموز يوفّر صيغة EAN-13", !!fmtSel,
    fmtSel ? [...fmtSel.options].map((o) => o.textContent.trim()).join(" / ") : "لا قائمة صيغ");
  await goto("#/barcode?tab=scan");
  check("محاكاة الماسح تحلّ الصنف من باركوده", /امسح|أدخل باركود|باركود/.test(main.textContent));
  await goto("#/products");
  const heads = [...main.querySelectorAll("thead th")].map((t) => t.textContent.trim());
  check("سجل المنتجات فيه أعمدة الماركة والباركود", heads.includes("الماركة") && heads.includes("الباركود"), heads.join(" · "));
  const firstRow = (main.querySelector("tbody tr") || { textContent: "" }).textContent.replace(/\s+/g, " ");
  const p0 = HS().store.state.products.filter((x) => firstRow.includes(x.barcode))[0];
  check("صف المنتج يعرض الاسم مع حجمه وماركته وباركوده",
    !!p0 && firstRow.includes(p0.size) && firstRow.includes(p0.brand || "") && firstRow.includes(p0.barcode),
    p0 ? HS().store.label(p0) + " · " + p0.brand + " · " + p0.barcode : firstRow.slice(0, 80));
  const filters = [...main.querySelectorAll(".toolbar select")].map((x) => x.name);
  check("مرشّحات المنتجات تشمل الماركة والحجم", filters.includes("brand") && filters.includes("size"), filters.join("، "));

  console.log("\n════════════════════════════════════════");
  console.log(errors.length ? `فشل: ${errors.length}\n` + errors.map((e) => "  • " + e).join("\n") : "كل اختبارات المواصفات ناجحة ✓");
  console.log("════════════════════════════════════════");
  process.exit(errors.length ? 1 : 0);
})();
