/* ═══════════════════════════════════════════════════════════
   فحص تفاعلي: يحاكي نقرات المستخدم الحقيقية على الواجهة
   (لا يستدعي المتجر مباشرة) للتحقق من ربط الأحداث.
   الاستعمال: node tools/uitest.js
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

const errors = [];
function log(kind, msg) {
  const line = `[${kind}] ${msg}`;
  if (kind === "error") errors.push(line);
  console.log(line);
}

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  const m = String(e.message || e);
  if (/Could not load|Not implemented: navigation/i.test(m)) return;
  log("error", "jsdomError: " + (e.stack || m));
});
vc.on("error", (...a) => log("error", "console.error: " + a.map(String).join(" ")));

const path = require("path");
const INDEX = path.join(__dirname, "..", "index.html");
const dom = new JSDOM(fs.readFileSync(INDEX, "utf8"), {
  url: "file://" + INDEX,
  resources: "usable", runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    window.HS_DEV_NO_AUTH = true; /* الدخول التجريبي المحلي لأدوات الفحص فقط */
    window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } }));
    window.print = () => {}; window.scrollTo = () => {};
    window.URL.createObjectURL = () => "blob:mock"; window.URL.revokeObjectURL = () => {};
    window.HTMLElement.prototype.scrollIntoView = () => {};
    window.HTMLCanvasElement.prototype.getContext = () => null;
    Object.defineProperty(window.HTMLElement.prototype, "offsetWidth", { get() { return 1280; }, configurable: true });
    Object.defineProperty(window.HTMLElement.prototype, "offsetHeight", { get() { return 44; }, configurable: true });
    window.addEventListener("error", (e) => log("error", "onerror: " + ((e.error && e.error.stack) || e.message)));
    window.addEventListener("unhandledrejection", (e) => log("error", "unhandled: " + ((e.reason && e.reason.stack) || e.reason)));
  }
});
const { window } = dom;
const doc = window.document;
const HS = () => window.HS;
const $ = (sel, r) => (r || doc).querySelector(sel);
const $$ = (sel, r) => Array.from((r || doc).querySelectorAll(sel));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function click(el) {
  if (!el) throw new Error("لا عنصر للنقر");
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
}
function type(el, value) {
  if (!el) throw new Error("لا حقل للكتابة");
  el.value = value;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
function key(el, k) {
  el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
}
function act(name, data) {
  const sel = '[data-action="' + name + '"]' + (data ? Object.keys(data).map((k) => `[data-${k}="${data[k]}"]`).join("") : "");
  return $(sel);
}
function byAction(name) { return $$('[data-action="' + name + '"]'); }

let passed = 0;
async function it(name, fn) {
  try { await fn(); passed++; console.log("  ✓ " + name); }
  catch (e) { log("error", name + ": " + (e.stack || e.message)); }
}

async function main() {
  for (let i = 0; i < 100 && !window.HS; i++) await wait(50);
  for (let i = 0; i < 60 && !(window.HS.store && window.HS.store.state); i++) await wait(50);
  await wait(400);

  console.log("\n── شاشة الدخول ──");
  await it("شاشة الدخول ظاهرة والتطبيق مخفي", () => {
    if (!$("#authScreen")) throw new Error("لا شاشة دخول");
    if ($("#authScreen").hidden) throw new Error("شاشة الدخول مخفية");
    if (!$("#app").hidden) throw new Error("التطبيق ظاهر قبل الدخول");
    if (HS().store.isLoggedIn()) throw new Error("جلسة مفتوحة قبل الدخول");
  });
  await it("كلمة مرور قصيرة تُرفض بخطأ ظاهر", async () => {
    const f = $("#loginForm");
    type(f.querySelector("#loginUser"), "youssef");
    type(f.querySelector("#loginPass"), "12");
    f.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await wait(900);
    const al = $("#loginAlert");
    if (al.hidden || !al.textContent) throw new Error("لم يظهر خطأ كلمة المرور القصيرة");
    if (HS().store.isLoggedIn()) throw new Error("دخل بكلمة مرور من حرفين");
    if ($("#authScreen").hidden) throw new Error("غادر شاشة الدخول");
  });
  await it("حقل فارغ يُظهر خطأً تحت الحقل", async () => {
    const f = $("#loginForm");
    type(f.querySelector("#loginUser"), "");
    type(f.querySelector("#loginPass"), "");
    f.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
    await wait(200);
    if (!$("#loginUser-error").textContent) throw new Error("لا خطأ تحت اسم المستخدم");
    if (!$("#loginPass-error").textContent) throw new Error("لا خطأ تحت كلمة المرور");
  });
  await it("الدخول السريع بزر تجريبي يفتح التطبيق", async () => {
    const chip = $('[data-action="demoLogin"]');
    if (!chip) throw new Error("لا زر دخول سريع");
    click(chip);
    await wait(1200);
    if (!HS().store.isLoggedIn()) throw new Error("الجلسة لم تبدأ");
    if (!$("#app").hidden === false && $("#authScreen").hidden === false) throw new Error("لم ينتقل");
    if ($("#authScreen").hidden !== true) throw new Error("شاشة الدخول ما زالت ظاهرة");
  });

  console.log("\n── الهيكل العام ──");
  await it("الشريط الجانبي يعرض روابط التنقل", () => {
    const links = $$("#nav a[href^='#/']");
    if (links.length < 10) throw new Error("روابط ناقصة: " + links.length);
  });
  await it("زر الطي يغيّر حالة الشريط", () => {
    const before = $("#app").getAttribute("data-collapsed");
    click($("#collapseBtn"));
    if ($("#app").getAttribute("data-collapsed") === before) throw new Error("لم يتغير");
    click($("#collapseBtn"));
  });
  await it("زر السمة يقلب المظهر", () => {
    const before = doc.documentElement.getAttribute("data-theme");
    click($("#themeBtn"));
    if (doc.documentElement.getAttribute("data-theme") === before) throw new Error("لم تتغير السمة");
    click($("#themeBtn"));
  });
  await it("زر الدرج يفتحه ويغلقه", () => {
    click($("#menuBtn"));
    if ($("#app").getAttribute("data-drawer") !== "true") throw new Error("لم يفتح");
    key(doc.body, "Escape");
    if ($("#app").getAttribute("data-drawer") === "true") throw new Error("لم يغلق بـ Escape");
  });
  await it("جرس التنبيهات يفتح قائمة", () => {
    click($("#bellBtn"));
    if (!$(".popover, .pop")) throw new Error("لم تظهر القائمة");
    key(doc.body, "Escape");
  });
  await it("اسم المحل ظاهر في الواجهة", () => {
    const txt = doc.body.textContent;
    if (!txt.includes("يوسف للعطور")) throw new Error("الاسم غير ظاهر");
    if (!doc.title.includes("يوسف للعطور")) throw new Error("العنوان خاطئ: " + doc.title);
  });

  console.log("\n── لوحة التحكم ──");
  await it("المسار #/ يرسم مؤشرات ومخططات", () => {
    window.location.hash = "#/"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    const m = $("#main");
    if (!m.querySelector(".kpi")) throw new Error("لا مؤشرات");
    if (m.querySelectorAll("svg").length < 4) throw new Error("مخططات ناقصة: " + m.querySelectorAll("svg").length);
    if (!m.querySelector(".table")) throw new Error("لا جدول أحدث الفواتير");
  });
  await it("تبديل مقياس المخطط يعمل", async () => {
    click(act("dash-metric", { metric: "profit" }));
    await wait(60);
    if (!window.location.hash.includes("metric=profit")) throw new Error("لم يتغير الاستعلام");
    if (!$("#main").querySelector("svg")) throw new Error("المخطط اختفى");
    click(act("dash-metric", { metric: "revenue" }));
    await wait(60);
  });
  await it("محدد الفترة في الشريط العلوي يعمل", async () => {
    const seg = $('[data-action="period"]');
    if (!seg) throw new Error("لا محدد فترة");
    click(seg);
    await wait(60);
    if (!$("#main").innerHTML.length) throw new Error("الصفحة فارغة");
  });

  console.log("\n── نقطة البيع ──");
  await it("النقر على صنف يضيفه إلى السلة", async () => {
    window.location.hash = "#/pos"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    const card = $('.pcard:not([disabled])');
    if (!card) throw new Error("لا أصناف قابلة للنقر");
    const name = card.querySelector(".pcard__name").textContent;
    click(card);
    await wait(60);
    const items = $$("#cart .cart-item");
    if (!items.length) throw new Error("السلة لم تمتلئ");
    if (!items[0].textContent.includes(name.slice(0, 6))) throw new Error("الصنف الخطأ في السلة");
    if (!$("#cartTotal")) throw new Error("لا إجمالي في السلة");
  });
  await it("أزرار + و − تغيّر الكمية", async () => {
    const inc = act("pos-inc"); const dec = act("pos-dec");
    if (!inc || !dec) throw new Error("أزرار الكمية غير موجودة");
    const inp = $('.qty-input');
    const before = Number(inp.value.replace(/[^\d]/g, ""));
    click(inc); await wait(40);
    const after = Number($('.qty-input').value.replace(/[^\d]/g, ""));
    if (after !== before + 1) throw new Error(`الزيادة فشلت ${before} → ${after}`);
    click(act("pos-dec")); await wait(40);
    if (Number($('.qty-input').value.replace(/[^\d]/g, "")) !== before) throw new Error("الإنقاص فشل");
  });
  await it("البحث في حقل الماسح يصفّي الشبكة", async () => {
    const scan = $("#scanInput");
    type(scan, "عود");
    await wait(700);
    const count = $$(".pcard").length;
    if (!count) throw new Error("لا نتائج للبحث");
    if (count > 40) throw new Error("البحث لم يصفِّ: " + count);
    type(scan, "");
    await wait(700);
  });
  await it("الباركود الصحيح يضيف الصنف مباشرة", async () => {
    const p = HS().store.state.products.filter((x) => x.stock > 3 && !HS().store.state.carts.active.some((l) => l.productId === x.id))[0];
    const scan = $("#scanInput");
    scan.value = p.sku;
    key(scan, "Enter");
    await wait(80);
    if (!HS().store.state.carts.active.some((l) => l.productId === p.id)) throw new Error("لم يُضف " + p.sku);
    if (scan.value !== "") throw new Error("حقل الماسح لم يُفرَّغ");
  });
  await it("باركود خاطئ يُظهر تنبيه خطأ", async () => {
    const scan = $("#scanInput");
    scan.value = "ZZZ-000-XYZ";
    key(scan, "Enter");
    await wait(80);
    if (!$(".toast")) throw new Error("لم يظهر تنبيه");
  });
  await it("إتمام الدفع يفتح نافذة ثم يصدر فاتورة", async () => {
    const before = HS().store.state.sales.length;
    click(act("pos-checkout"));
    await wait(120);
    const modal = $(".modal");
    if (!modal) throw new Error("نافذة الدفع لم تُفتح");
    if (!modal.querySelector("#confirmPay")) throw new Error("زر التأكيد غير موجود");
    const total = HS().store.state.carts.active.reduce((a, l) => a + l.qty * l.price, 0);
    type(modal.querySelector('[name="paid"]'), String(Math.ceil(total) + 10));
    await wait(40);
    if (!modal.querySelector("#changeBox").textContent.includes("الباقي")) throw new Error("لم يُحسب الباقي");
    click(modal.querySelector("#confirmPay"));
    await wait(800);
    if (HS().store.state.sales.length !== before + 1) throw new Error("لم تُنشأ فاتورة");
    if (HS().store.state.carts.active.length) throw new Error("السلة لم تُفرَّغ بعد البيع");
  });
  await it("نافذة الإيصال تظهر بعد البيع وتُطبع", async () => {
    await wait(200);
    const m = $$(".modal").pop();
    if (!m || !m.querySelector(".receipt")) throw new Error("لم تظهر نافذة الإيصال");
    click(m.querySelector("#printNow"));
    await wait(120);
    click(m.querySelector("[data-modal-close]"));
    await wait(80);
  });
  await it("تعليق الفاتورة واسترجاعها", async () => {
    const card = $('.pcard:not([disabled])');
    click(card); await wait(60);
    click(act("pos-hold"));
    await wait(120);
    if (HS().store.state.carts.active.length) throw new Error("السلة لم تُفرَّغ بعد التعليق");
    if (!HS().store.cart.held().length) throw new Error("لم تُحفظ الفاتورة المعلّقة");
    window.location.hash = "#/pos"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    const heldBtn = act("pos-held");
    if (!heldBtn) throw new Error("زر الفواتير المعلّقة غير موجود");
    click(heldBtn); await wait(120);
    const resume = act("pos-resume");
    if (!resume) throw new Error("لا زر استرجاع");
    click(resume); await wait(200);
    if (!HS().store.state.carts.active.length) throw new Error("لم تُسترجع السلة");
    click(act("pos-clear")); await wait(120);
    const okBtn = $('[data-confirm-ok]');
    if (!okBtn) throw new Error("نافذة التأكيد لم تظهر");
    click(okBtn); await wait(120);
    if (HS().store.state.carts.active.length) throw new Error("السلة لم تُفرَّغ");
  });

  console.log("\n── سجل المبيعات ──");
  await it("التبويبات تغيّر النتائج", async () => {
    const tabs = () => $$('.tab[data-action="tab"], [data-action="tab"]');
    window.location.hash = "#/sales"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(320);
    const all = $$("#main tbody tr").length;
    if (tabs().length < 3) throw new Error("تبويبات ناقصة");
    /* بعد كل نقرة يُعاد رسم الصفحة، فالعقد القديمة تنفصل عن المستند — نعيد الاستعلام دائمًا */
    click(tabs()[4]); await wait(320);
    if (!window.location.hash.includes("tab=")) throw new Error("لم يتغير الاستعلام");
    click(tabs()[0]); await wait(320);
    const back = $$("#main tbody tr").length;
    if (back !== all) throw new Error(`العدد لم يعد كما كان: ${back} ≠ ${all}`);
  });
  await it("الترتيب بالنقر على رأس العمود", async () => {
    const th = $('#main [data-action="sort"]');
    if (!th) throw new Error("لا رؤوس قابلة للترتيب");
    click(th); await wait(80);
    if (!window.location.hash.includes("sort=")) throw new Error("لم يُسجَّل الترتيب");
    click(th); await wait(80);
    if (!window.location.hash.includes("dir=")) throw new Error("لم ينقلب الاتجاه");
  });
  await it("الترقيم ينتقل إلى الصفحة الثانية", async () => {
    const p2 = $('[data-action="page"][data-page="2"]');
    if (!p2) throw new Error("لا زر صفحة ثانية");
    click(p2); await wait(320);
    if (!window.location.hash.includes("page=2")) throw new Error("لم يتغير الرقم: " + window.location.hash);
    click($('[data-action="page"][data-page="1"]')); await wait(320);
  });
  await it("البحث يصفّي الجدول", async () => {
    const n0 = $$("#main tbody tr").length;
    /* حقل البحث يُعاد رسمه مع كل نتيجة، فلا نحتفظ بعقد قديم */
    const inp = () => $('#main [data-search-input]');
    if (!inp()) throw new Error("لا حقل بحث");
    /* رقم فاتورة بعينه: نتيجة واحدة حتمًا، فلا يتأثر الاختبار بحجم البيانات */
    const num = HS().store.state.sales[0].number;
    type(inp(), num); await wait(600);
    const n1 = $$("#main tbody tr").length;
    if (!(n1 < n0) || n1 !== 1) throw new Error(`البحث لم يصفِّ: ${n1} من ${n0} — الرقم ${num}`);
    type(inp(), ""); await wait(600);
    const n2 = $$("#main tbody tr").length;
    if (n2 !== n0) throw new Error(`مسح البحث لم يُعِد كل الصفوف: ${n2} ≠ ${n0}`);
  });
  await it("النقر على صف يفتح الفاتورة", async () => {
    const row = $('#main tbody tr[data-selectable]');
    if (!row) throw new Error("لا صفوف قابلة للنقر");
    click(row); await wait(120);
    if (!window.location.hash.match(/^#\/sales\/s-/)) throw new Error("لم ينتقل: " + window.location.hash);
    if (!$("#main").querySelector(".receipt")) throw new Error("صفحة الفاتورة لا تعرض الإيصال");
  });
  await it("قائمة إجراءات الصف تفتح وتنفّذ الطباعة", async () => {
    window.location.hash = "#/sales"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    const menu = act("inv-menu");
    if (!menu) throw new Error("لا قائمة إجراءات");
    click(menu); await wait(60);
    if (!$(".popover, .pop")) throw new Error("لم تفتح القائمة");
    const item = act("inv-print");
    if (!item) throw new Error("لا عنصر طباعة");
    click(item); await wait(120);
    if (doc.body.getAttribute("data-printing") !== "receipt") log("warn", "لم تُفعَّل طبقة الطباعة (ربما أُغلقت سريعًا)");
    await wait(1400);
  });

  console.log("\n── الأصناف ──");
  await it("نافذة صنف جديد تحفظ صنفًا", async () => {
    window.location.hash = "#/products"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    const n0 = HS().store.state.products.length;
    click(act("prod-new")); await wait(120);
    const m = $$(".modal").pop();
    if (!m) throw new Error("لم تُفتح النافذة");
    type(m.querySelector('[name="name"]'), "صنف الفحص التفاعلي");
    type(m.querySelector('[name="price"]'), "17.250");
    type(m.querySelector('[name="cost"]'), "11.500");
    type(m.querySelector('[name="stock"]'), "9");
    await wait(40);
    if (!m.querySelector("#marginBox").textContent.includes("هامش")) throw new Error("لم يُحسب الهامش");
    click(m.querySelector("#saveProduct"));
    await wait(600);
    if (HS().store.state.products.length !== n0 + 1) throw new Error("لم يُحفظ الصنف");
    const np = HS().store.state.products.filter((x) => x.name === "صنف الفحص التفاعلي")[0];
    if (np.stock !== 9) throw new Error("الرصيد خاطئ: " + np.stock);
    if (!np.sku) throw new Error("لم يُولَّد رمز");
    window.__testProductId = np.id;
  });
  await it("التحقق يمنع حفظ صنف بلا اسم", async () => {
    click(act("prod-new")); await wait(120);
    const m = $$(".modal").pop();
    type(m.querySelector('[name="price"]'), "5");
    click(m.querySelector("#saveProduct")); await wait(200);
    if (!m.querySelector('[data-invalid="true"]')) throw new Error("لم يظهر خطأ");
    key(doc.body, "Escape"); await wait(400);
    if ($(".modal-backdrop")) throw new Error("لم تُغلق بـ Escape");
  });
  await it("تعديل الرصيد من قائمة الإجراءات", async () => {
    const p = HS().store.product(window.__testProductId);
    const before = p.stock;
    window.location.hash = "#/products?q=" + encodeURIComponent("الفحص التفاعلي");
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(200);
    const btn = $(`[data-action="prod-adjust"][data-id="${p.id}"]`);
    if (!btn) throw new Error("لا زر تعديل رصيد");
    click(btn); await wait(120);
    const m = $$(".modal").pop();
    click(m.querySelector('[data-delta="10"]')); await wait(30);
    click(m.querySelector("#doAdjust")); await wait(200);
    if (p.stock !== before + 10) throw new Error(`الرصيد ${before} → ${p.stock}`);
  });
  await it("عرض البطاقات يعمل", async () => {
    window.location.hash = "#/products"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(250);
    click(act("prod-view", { view: "cards" }));
    await wait(120);
    if (!$(".prod-cards")) throw new Error("لم يظهر عرض البطاقات");
    if ($$(".pcard-lg").length < 2) throw new Error("بطاقات ناقصة: " + $$(".pcard-lg").length);
    click(act("prod-view", { view: "table" })); await wait(200);
  });
  await it("الحذف يطلب تأكيدًا ويتراجع", async () => {
    const p = HS().store.product(window.__testProductId);
    window.location.hash = "#/products?q=" + encodeURIComponent("الفحص التفاعلي");
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(200);
    click($(`[data-action="prod-menu"][data-id="${p.id}"]`)); await wait(120);
    const del = act("prod-delete");
    if (!del) throw new Error("لا عنصر حذف");
    click(del); await wait(120);
    if (!$('[data-confirm-ok]')) throw new Error("نافذة التأكيد لم تظهر");
    click($('[data-confirm-ok]')); await wait(400);
    if (HS().store.product(p.id)) throw new Error("لم يُحذف");
    const lastToast = $$(".toast").pop();
    const undo = lastToast ? Array.from(lastToast.querySelectorAll("button")).filter((b) => /تراجع/.test(b.textContent))[0] : null;
    if (!undo) throw new Error("لا زر تراجع في التنبيه");
    click(undo); await wait(400);
    if (!HS().store.product(p.id)) throw new Error("التراجع لم يُعد الصنف");
    HS().store.deleteProduct(p.id);
  });

  console.log("\n── المخزون والباركود ──");
  await it("تبويبات المخزون الثلاثة", async () => {
    window.location.hash = "#/inventory"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    for (const t of ["levels", "alerts", "movements"]) {
      window.location.hash = "#/inventory?tab=" + t;
      window.dispatchEvent(new window.HashChangeEvent("hashchange"));
      await wait(60);
      if ($("#main").innerHTML.length < 500) throw new Error("تبويب " + t + " فارغ");
    }
  });
  await it("الجرد يسجّل تسويات", async () => {
    window.location.hash = "#/inventory"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    if ($$(".modal").length) throw new Error("نافذة متبقية قبل الجرد");
    click(act("inv-count")); await wait(250);
    const m = $$(".modal").pop();
    const inputs = $$("[data-count]", m);
    if (!inputs.length) throw new Error("لا حقول جرد");
    const sys = Math.round(Number(inputs[0].getAttribute("data-system")));
    type(inputs[0], String(sys + 4));
    click(m.querySelector("#applyCount")); await wait(450);
    if ($$(".modal").length) throw new Error("النافذة لم تُغلق");
    const t = $$(".toast").pop();
    if (!t || !/تسويات جرد/.test(t.textContent)) throw new Error("لم يظهر تنبيه النجاح: " + (t && t.textContent));
  });
  await it("توليد رمز EAN-13 وعرضه", async () => {
    window.location.hash = "#/barcode?tab=generate"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    const inp = $("[data-bc-text]");
    if (!inp) throw new Error("لا حقل نص");
    type(inp, "400638133393"); await wait(600);
    if (!$("#bcPreview svg")) throw new Error("لم يُرسم الرمز");
    if (!$("#main").textContent.includes("EAN-13")) throw new Error("لا وصف للرمز");
  });
  await it("محاكاة الماسح تسجّل في السجل", async () => {
    window.location.hash = "#/barcode?tab=scan"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    click(act("bc-sim-scan")); await wait(120);
    if (!$("#main").textContent.includes("سجل المسح")) throw new Error("لا سجل");
    if (!$(".timeline__item")) throw new Error("لم تُسجَّل عملية المسح");
    click(act("bc-sim-bad")); await wait(120);
    if (!$("#main").textContent.includes("غير معروف")) throw new Error("لم يُسجَّل الفشل");
  });
  await it("اختيار أصناف وطباعة ملصقات", async () => {
    window.location.hash = "#/barcode?tab=labels"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    const boxes = $$("[data-sel]");
    if (boxes.length < 3) throw new Error("لا قائمة أصناف");
    boxes[0].checked = true; boxes[0].dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait(150);
    boxes2 = $$("[data-sel]");
    boxes2[1].checked = true; boxes2[1].dispatchEvent(new window.Event("change", { bubbles: true }));
    await wait(150);
    if (!$(".blabel")) throw new Error("لم تظهر معاينة الملصق");
    const printBtn = act("bc-print");
    if (printBtn.disabled) throw new Error("زر الطباعة معطّل");
    click(printBtn); await wait(200);
    if (doc.body.getAttribute("data-printing") !== "labels") log("warn", "طبقة طباعة الملصقات لم تُفعَّل");
    await wait(1400);
  });

  console.log("\n── المشتريات والجهات ──");
  await it("أمر شراء جديد بأصناف", async () => {
    window.location.hash = "#/purchases"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    const n0 = HS().store.state.purchases.length;
    click(act("po-new")); await wait(150);
    const m = $$(".modal").pop();
    const sup = m.querySelector('[name="supplierId"]');
    type(sup, HS().store.state.suppliers[0].id);
    click(m.querySelector("#poAddLine")); await wait(60);
    const line = m.querySelector(".po-line:not(.po-line--head)");
    if (!line) throw new Error("لم يُضف سطر");
    type(line.querySelector(".po-line__prod"), HS().store.state.products[0].id);
    type(line.querySelector(".po-line__qty"), "15");
    await wait(40);
    if (!m.querySelector("#poTotal").textContent) throw new Error("لم يُحسب الإجمالي");
    click(m.querySelector("#poSave")); await wait(600);
    if (HS().store.state.purchases.length !== n0 + 1) throw new Error("لم يُحفظ الأمر");
    window.__testPoId = HS().store.state.purchases[0].id;
  });
  await it("استلام الأمر يغذّي المخزون", async () => {
    const po = HS().store.purchase(window.__testPoId);
    po.status = "shipping";
    const p = HS().store.product(po.items[0].productId);
    const before = p.stock;
    window.location.hash = "#/purchases"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    const btn = $(`[data-action="po-receive"][data-id="${po.id}"]`);
    if (!btn) { click($(`[data-action="po-menu"][data-id="${po.id}"]`)); await wait(80); }
    click($(`[data-action="po-receive"][data-id="${po.id}"]`)); await wait(120);
    const ok = $('[data-confirm-ok]');
    if (!ok) throw new Error("نافذة تأكيد الاستلام لم تظهر");
    click(ok); await wait(300);
    if (p.stock !== before + po.items[0].qty) throw new Error(`المخزون ${before} → ${p.stock}`);
    HS().store.deletePurchase(po.id);
  });
  await it("بطاقة مورد وبطاقة عميل تفتحان", async () => {
    window.location.hash = "#/suppliers"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    click(act("sup-view")); await wait(600);
    if (!$$(".modal").pop()) throw new Error("لم تُفتح بطاقة المورد");
    key(doc.body, "Escape"); await wait(400);

    window.location.hash = "#/customers"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    click(act("cus-view")); await wait(700);
    const cm = $$(".modal").pop();
    if (!cm) throw new Error("لم تُفتح بطاقة العميل");
    if (!cm.textContent.includes("الفواتير")) throw new Error("البطاقة ناقصة");
    key(doc.body, "Escape"); await wait(400);
  });
  await it("سداد ذمة عميل من البطاقة", async () => {
    const c = HS().store.state.customers.filter((x) => x.balance > 100)[0];
    if (!c) throw new Error("لا عميل مدين للاختبار");
    const before = c.balance;
    window.location.hash = "#/customers?tab=owing"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    const btn = $(`[data-action="cus-pay"][data-id="${c.id}"]`);
    if (!btn) throw new Error("لا زر سداد");
    click(btn); await wait(150);
    const m = $$(".modal").pop();
    click(m.querySelector("#cusDoPay")); await wait(250);
    if (Math.abs(c.balance) > 0.01) throw new Error("الرصيد لم يُصفَّر: " + c.balance);
    if (c.balance === before) throw new Error("لم يتغير الرصيد");
    const lastToast = $$(".toast").pop();
    const undo = lastToast ? Array.from(lastToast.querySelectorAll("button")).filter((b) => /تراجع/.test(b.textContent))[0] : null;
    if (undo) { click(undo); await wait(150); }
  });

  console.log("\n── المصروفات والتقارير والمستخدمون والإعدادات ──");
  await it("تسجيل مصروف وحذفه", async () => {
    window.location.hash = "#/expenses"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(80);
    const n0 = HS().store.state.expenses.length;
    click(act("exp-new")); await wait(150);
    const m = $$(".modal").pop();
    type(m.querySelector('[name="amount"]'), "350.500");
    type(m.querySelector('[name="note"]'), "فحص تفاعلي");
    click(m.querySelector("#expSave")); await wait(300);
    if (HS().store.state.expenses.length !== n0 + 1) throw new Error("لم يُحفظ");
    const id = HS().store.state.expenses.filter((e) => e.note === "فحص تفاعلي")[0].id;
    click($(`[data-action="exp-delete"][data-id="${id}"]`)); await wait(120);
    click($('[data-confirm-ok]')); await wait(200);
    if (HS().store.state.expenses.some((e) => e.id === id)) throw new Error("لم يُحذف");
  });
  await it("تبويبات التقارير الستة تُرسم", async () => {
    for (const t of ["overview", "sales", "products", "customers", "purchases", "export"]) {
      window.location.hash = "#/reports?tab=" + t;
      window.dispatchEvent(new window.HashChangeEvent("hashchange"));
      await wait(90);
      const len = $("#main").innerHTML.length;
      if (len < 800) throw new Error("تقرير " + t + " صغير: " + len);
      if (/undefined|NaN/.test($("#main").textContent)) throw new Error("تقرير " + t + " فيه NaN/undefined");
    }
  });
  await it("تصدير تقرير يُنتج ملفًا", async () => {
    window.location.hash = "#/reports?tab=export"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(90);
    const btns = byAction("rep-export");
    if (btns.length < 5) throw new Error("أزرار التصدير ناقصة");
    click(btns[0]); await wait(120);
    if (!$(".toast")) throw new Error("لم يظهر تنبيه التصدير");
  });
  await it("المستخدمون: نافذة صلاحيات وحفظ دور", async () => {
    window.location.hash = "#/users"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(100);
    click(act("usr-view")); await wait(150);
    if (!$(".perm--static")) throw new Error("لا شبكة صلاحيات");
    key(doc.body, "Escape"); await wait(400);
    click(act("usr-new")); await wait(150);
    const m = $$(".modal").pop();
    type(m.querySelector('[name="name"]'), "مستخدم الفحص");
    type(m.querySelector('[name="username"]'), "testuser");
    type(m.querySelector('[name="role"]'), "محاسب");
    await wait(40);
    const checked = $$("[data-perm]", m).filter((c) => c.checked).length;
    if (!checked) throw new Error("لم تُضبط صلاحيات الدور");
    click(m.querySelector("#usrSave")); await wait(300);
    if (!HS().store.state.users.some((u) => u.username === "testuser")) throw new Error("لم يُحفظ المستخدم");
    const u = HS().store.state.users.filter((x) => x.username === "testuser")[0];
    HS().store.deleteUser(u.id);
  });
  await it("الإعدادات: حفظ هوية المحل يغيّر الاسم في كل مكان", async () => {
    window.location.hash = "#/settings?tab=identity"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    const form = $("#settingsForm");
    if (!form) throw new Error("لا نموذج");
    type(form.querySelector('[name="storeName"]'), "متجر الفحص التفاعلي");
    click(act("set-save-identity")); await wait(500);
    if (!$(".brand__name").textContent.includes("متجر الفحص")) throw new Error("الاسم لم يتغير في الشريط الجانبي: " + $(".brand__name").textContent);
    if (!doc.title.includes("متجر الفحص")) throw new Error("العنوان لم يتغير: " + doc.title);
    /* استعادة */
    window.location.hash = "#/settings?tab=identity"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(150);
    type($("#settingsForm").querySelector('[name="storeName"]'), "يوسف للعطور");
    click(act("set-save-identity")); await wait(500);
    if (!$(".brand__name").textContent.includes("يوسف")) throw new Error("لم يُستعد الاسم");
  });
  await it("الإعدادات المالية تغيّر تنسيق الأرقام", async () => {
    window.location.hash = "#/settings?tab=financial"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    type($("#settingsForm").querySelector('[name="taxRate"]'), "7.5");
    type($("#settingsForm").querySelector('[name="decimals"]'), "2");
    click(act("set-save-financial")); await wait(500);
    if (HS().store.state.settings.taxRate !== 7.5) throw new Error("لم تُحفظ الضريبة");
    if (!HS().fmt.money(1234.567).startsWith("1.234,57") && !/1[.,]234/.test(HS().fmt.money(1234.567))) log("warn", "تنسيق غير متوقع: " + HS().fmt.money(1234.567));
    window.location.hash = "#/settings?tab=financial"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(150);
    type($("#settingsForm").querySelector('[name="taxRate"]'), "0");
    type($("#settingsForm").querySelector('[name="decimals"]'), "3");
    click(act("set-save-financial")); await wait(400);
  });
  await it("أزرار المظهر تُطبَّق فورًا", async () => {
    window.location.hash = "#/settings?tab=appearance"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    click(act("set-theme", { theme: "dark" })); await wait(150);
    if (doc.documentElement.getAttribute("data-theme") !== "dark") throw new Error("لم تُطبَّق السمة");
    click(act("set-accent", { accent: "brick" })); await wait(150);
    if (doc.documentElement.getAttribute("data-accent") !== "brick") throw new Error("لم يُطبَّق اللون");
    click(act("set-density", { density: "compact" })); await wait(150);
    if (doc.documentElement.getAttribute("data-density") !== "compact") throw new Error("لم تُطبَّق الكثافة");
    click(act("set-theme", { theme: "light" })); await wait(100);
    click(act("set-accent", { accent: "emerald" })); await wait(100);
    click(act("set-density", { density: "cozy" })); await wait(100);
  });
  await it("مسار غير معروف يعرض صفحة 404", async () => {
    window.location.hash = "#/no-such-page"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    if (!$("#main").textContent.length) throw new Error("لا محتوى");
  });

  console.log("\n── اختصارات لوحة المفاتيح ──");
  await it("الاختصارات تنفّذ", async () => {
    window.location.hash = "#/"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(120);
    doc.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "t", bubbles: true }));
    await wait(120);
    if (doc.documentElement.getAttribute("data-theme") === "light") throw new Error("T لم يقلب السمة");
    doc.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "t", bubbles: true }));
    await wait(120);
    doc.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "n", bubbles: true }));
    await wait(150);
    if (!window.location.hash.startsWith("#/pos")) throw new Error("N لم ينقل لنقطة البيع: " + window.location.hash);
    doc.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "/", bubbles: true }));
    await wait(120);
  });
  await it("اختصار الحرف لا يعترض الكتابة في حقل", async () => {
    window.location.hash = "#/products"; window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    await wait(250);
    const theme0 = doc.documentElement.getAttribute("data-theme");
    const s = $('#main [data-search-input]');
    s.focus();
    s.dispatchEvent(new window.KeyboardEvent("keydown", { key: "t", bubbles: true, cancelable: true }));
    s.dispatchEvent(new window.KeyboardEvent("keydown", { key: "n", bubbles: true, cancelable: true }));
    await wait(150);
    if (doc.documentElement.getAttribute("data-theme") !== theme0) throw new Error("حرف T قلب السمة أثناء الكتابة");
    if (!window.location.hash.startsWith("#/products")) throw new Error("حرف N نقل الصفحة أثناء الكتابة: " + window.location.hash);
  });
  await it("حرف D خارج الحقول ينقل إلى لوحة التحكم", async () => {
    doc.body.dispatchEvent(new window.KeyboardEvent("keydown", { key: "d", bubbles: true, cancelable: true }));
    await wait(250);
    if (window.location.hash !== "#/") throw new Error("لم ينتقل: " + window.location.hash);
  });

  await wait(300);
  console.log("\n════════════════════════════════════════");
  console.log("نجح: " + passed + "   أخطاء: " + errors.length);
  if (errors.length) console.log("\n" + errors.join("\n"));
  console.log("════════════════════════════════════════");
  process.exit(errors.length ? 1 : 0);
}

main().catch((e) => { console.log("فشل الفاحص: " + e.stack); process.exit(2); });
