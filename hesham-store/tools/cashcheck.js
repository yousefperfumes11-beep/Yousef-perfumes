/* ═══════════════════════════════════════════════════════════
   فحص منطق الصندوق والديون والباركود.
   يتحقق من الثابت الأهم: آخر رصيد في سجل الصندوق == الرصيد المتوقع.
   الاستعمال: node tools/cashcheck.js
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
const log = (k, m) => { const l = `[${k}] ${m}`; if (k === "error") errors.push(l); console.log(l); };

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => { if (!/Could not load|Not implemented: navigation/i.test(String(e.message || e))) log("error", "jsdom: " + e.message); });
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
    w.addEventListener("error", (e) => log("error", "onerror: " + ((e.error && e.error.stack) || e.message)));
  }
});
const { window } = dom;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const money = (v) => window.HS.fmt.money(v);

function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name + (extra ? " — " + extra : ""));
  else log("error", name + (extra ? " — " + extra : ""));
}

(async () => {
  const HS = () => window.HS;
  for (let i = 0; i < 200 && !(window.HS && window.HS.store && window.HS.store.state); i++) await wait(50);
  await wait(400);
  const S = HS().store.state;

  console.log("\n── نموذج المنتج: ماركة وحجم وباركود ──");
  check("كل صنف له باركود من 13 رقمًا", S.products.every((p) => /^\d{13}$/.test(p.barcode || "")));
  check("لا تكرار في الباركود", new Set(S.products.map((p) => p.barcode)).size === S.products.length,
    S.products.length + " صنفًا");
  check("كل صنف له ماركة", S.products.every((p) => !!p.brand));
  check("البحث بالباركود يجد الصنف", (() => {
    const p = S.products[7];
    return HS().store.byBarcode(p.barcode) === p;
  })());
  check("الباركود المكرر مرفوض", (() => {
    const dup = S.products[0];
    const res = HS().store.saveProduct({ name: "نسخة مكررة", barcode: dup.barcode, price: 10, cost: 5, category: dup.category });
    return res.ok === false && /مستعمل/.test(res.error || "");
  })(), HS().store.saveProduct({ name: "x", barcode: S.products[0].barcode, price: 1, cost: 1 }).error);
  check("الباركود الناقص مرفوض", HS().store.saveProduct({ name: "ناقص", barcode: "12345", price: 10, cost: 5 }).ok === false);
  check("كل حجم صنف مستقل", (() => {
    const groups = {};
    S.products.forEach((p) => { (groups[p.brand + "|" + p.name] = groups[p.brand + "|" + p.name] || []).push(p); });
    const multi = Object.keys(groups).filter((k) => groups[k].length > 1);
    return multi.length > 0 && multi.every((k) => {
      const g = groups[k];
      return new Set(g.map((p) => p.barcode)).size === g.length &&
             new Set(g.map((p) => p.price)).size === g.length;
    });
  })(), (function () {
    const g = {};
    S.products.forEach((p) => { (g[p.brand + " " + p.name] = g[p.brand + " " + p.name] || []).push(p.size); });
    const k = Object.keys(g).filter((x) => g[x].length > 1)[0];
    return k + " → " + g[k].join("، ");
  })());
  check("التسمية تجمع الاسم والحجم", HS().store.label(S.products[0]).includes(S.products[0].name));

  console.log("\n── الصندوق ──");
  for (const period of ["today", "7d", "30d", "90d"]) {
    const R = HS().store.range(period);
    const c = HS().store.cash(R);
    const L = HS().store.cashLedger(R);
    const last = L.length ? L[L.length - 1].balance : c.carried;
    check("رصيد السجل == الرصيد المتوقع (" + period + ")", Math.abs(last - c.expected) < 0.01,
      money(c.expected));
    check("المقبوضات − المدفوعات == الصافي (" + period + ")",
      Math.abs((c.inflow - c.outflow) - c.net) < 0.01);
    check("مبيعات البطاقة خارج الصندوق (" + period + ")",
      Math.abs(c.expected - (c.carried + c.cashCollected + c.creditDownPayment + c.debtCash + c.otherIn - c.expCash - c.otherOut - c.refunds)) < 0.01);
    if (period === "30d") {
      console.log("    مقبوضات نقدية " + money(c.cashCollected) + " · سداد ديون " + money(c.debtCash) +
        " · مصروفات نقدية " + money(c.expCash) + " · مُرحَّل " + money(c.carried) +
        " · الرصيد المتوقع " + money(c.expected));
      console.log("    خارج الصندوق: بطاقة " + money(c.cardSales) + " · دين غير محصّل " +
        money(c.creditSales - c.creditDownPayment) + " · مصروفات غير نقدية " + money(c.expOther));
    }
  }

  console.log("\n── ترابط العمليات ──");
  const p0 = S.products.filter((p) => p.stock > 3)[0];
  const before = { stock: p0.stock, cash: HS().store.cash(HS().store.range("all")).expected };
  HS().store.cart.add(p0.id, 1);
  const cashSale = HS().store.checkout({ method: "cash", paid: p0.price });
  check("البيع النقدي يخصم المخزون", p0.stock === before.stock - 1);
  const afterCash = HS().store.cash(HS().store.range("all"));
  check("البيع النقدي يزيد الصندوق", Math.abs(afterCash.expected - (before.cash + p0.price)) < 0.01,
    money(afterCash.expected - before.cash));

  HS().store.cart.add(p0.id, 1);
  const cardSale = HS().store.checkout({ method: "card", paid: p0.price });
  const afterCard = HS().store.cash(HS().store.range("all"));
  check("بيع البطاقة يخصم المخزون", p0.stock === before.stock - 2);
  check("بيع البطاقة لا يدخل الصندوق", Math.abs(afterCard.expected - afterCash.expected) < 0.01);

  const debtor = S.customers.filter((c) => HS().store.creditAccount(c))[0];
  const balBefore = debtor.balance;
  HS().store.cart.add(p0.id, 1);
  const creditSale = HS().store.checkout({ method: "credit", customerId: debtor.id });
  const afterCredit = HS().store.cash(HS().store.range("all"));
  check("بيع الدين يخصم المخزون", p0.stock === before.stock - 3);
  check("بيع الدين لا يدخل الصندوق", Math.abs(afterCredit.expected - afterCard.expected) < 0.01);
  check("بيع الدين يسجَّل مديونية", Math.abs(debtor.balance - (balBefore + creditSale.sale.total)) < 0.01,
    money(debtor.balance));
  check("المحصَّل في فاتورة الدين صفر", creditSale.sale.paid === 0);

  const pay = HS().store.customerPayment(debtor.id, creditSale.sale.total, "cash", "سداد كامل");
  const afterPay = HS().store.cash(HS().store.range("all"));
  check("سداد الدين يخفض المديونية", Math.abs(debtor.balance - balBefore) < 0.01);
  check("سداد الدين يدخل الصندوق", Math.abs(afterPay.expected - (afterCredit.expected + creditSale.sale.total)) < 0.01);
  check("الدفعة مربوطة بسجل العميل", HS().store.paymentsOf(debtor.id)[0].id === pay.payment.id);

  const exp = HS().store.saveExpense({ amount: 250, category: "rent", method: "cash", note: "فحص" });
  const afterExp = HS().store.cash(HS().store.range("all"));
  check("المصروف النقدي يخفض الصندوق", Math.abs((afterExp.expected - afterPay.expected) + 250) < 0.01);
  const expCard = HS().store.saveExpense({ amount: 400, category: "utilities", method: "card", note: "فحص بطاقة" });
  const afterExpCard = HS().store.cash(HS().store.range("all"));
  check("المصروف بالبطاقة لا يمس الصندوق", Math.abs(afterExpCard.expected - afterExp.expected) < 0.01);

  const ret = HS().store.returnSale(cashSale.sale.id, "فحص الإلغاء");
  const afterRet = HS().store.cash(HS().store.range("all"));
  check("إلغاء البيع يعيد الكمية للمخزون", p0.stock === before.stock - 2);
  check("إلغاء البيع النقدي يخرج المبلغ من الصندوق",
    Math.abs((afterRet.expected - afterExpCard.expected) + cashSale.sale.paid) < 0.01,
    "الفرق " + money(afterRet.expected - afterExpCard.expected) + " والمتوقع −" + money(cashSale.sale.paid) +
    " · محصَّل الفاتورة " + money(cashSale.sale.paid) + " · حالتها " + cashSale.sale.status);
  check("الإلغاء لا يمسّ الأرباح المحتسبة من الفواتير الصالحة",
    HS().store.salesOf(HS().store.range("all")).filter((s) => s.id === cashSale.sale.id)[0].status === "returned");

  console.log("\n── الأرباح ──");
  const R = HS().store.range("30d");
  const k = HS().store.kpis(R);
  /* الخصم على مستوى الفاتورة يُخصم من الربح، فلا يُحتسب ربحًا على أصنافه */
  const manualProfit = HS().store.validSalesOf(R).reduce((a, s) =>
    a - (s.discount || 0) + s.items.reduce((b, it) => b + it.qty * (it.price - (it.cost || 0)), 0), 0);
  check("ربح العملية = مجموع أرباح أصنافها − الخصم", Math.abs(manualProfit - (k.revenue - k.cogs)) < 0.5,
    money(k.profit) + " · هامش " + HS().fmt.pct(k.margin, 1));
  const byDay = HS().store.daily(R);
  check("الأرباح تُعرض حسب اليوم", byDay.values.length > 20 && byDay.values.some((v) => v > 0));

  console.log("\n── الديون ──");
  const d = HS().store.debts(R);
  check("إجمالي الديون = المحصّل + المتبقي (في الفترة)",
    Math.abs(d.granted - (d.downPaid + d.collected + d.rangeOutstanding)) < 1,
    money(d.granted));
  check("حالات الدين مصنّفة", d.unpaidCount + d.partialCount + d.settledCount > 0,
    `مستحق ${d.unpaidCount} · جزئي ${d.partialCount} · مسدد ${d.settledCount}`);
  check("قائمة المدينين مرتبة", d.debtors.length > 0 && d.debtors[0].balance >= d.debtors[d.debtors.length - 1].balance);

  await wait(200);
  console.log("\n════════════════════════════════════════");
  console.log("الأخطاء: " + errors.length);
  if (errors.length) console.log("\n" + errors.join("\n"));
  console.log("════════════════════════════════════════");
  process.exit(errors.length ? 1 : 0);
})();
