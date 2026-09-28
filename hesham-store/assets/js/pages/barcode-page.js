/* ═══════════════════════════════════════════════════════════
   pages/barcode.js — واجهة الباركود
   ١) توليد وطباعة ملصقات الأصناف
   ٢) توليد رمز من أي نص (Code 128 / EAN-13) وتصديره
   ٣) محاكاة الماسح الضوئي مع سجل المسح
   كل التوليد محلي في المتصفح: لا خدمة خارجية ولا اتصال شبكي.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var SIZES = {
    small: { cols: 4, label: "صغير (4 في الصف)", h: "10mm" },
    medium: { cols: 3, label: "متوسط (3 في الصف)", h: "12mm" },
    large: { cols: 2, label: "كبير (2 في الصف)", h: "16mm" }
  };

  var scanLog = [];
  var selected = {};

  /** الرمز المعتمد للصنف: الباركود EAN-13 أولًا، ثم الرمز الداخلي */
  function prodCode(p) { return (p && (p.barcode || p.sku)) || ""; }
  /** يرسم الرمز بالصيغة الصحيحة: EAN-13 للأرقام الثلاثة عشر، وإلا Code128 */
  function codeSVG(code, opt) {
    var digits = String(code || "").replace(/\D/g, "");
    if (digits.length === 13) return HS.barcode.ean13svg(digits, opt);
    return HS.barcode.svg(code, opt);
  }
  /** اسم الصنف كما يُعرض: الاسم والحجم */
  function labelName(p) { return HS.store.label(p); }

  HS.pages.barcode = function (root, ctx) {
    var st = HS.store.state;
    var tab = ctx.query.tab || "labels";
    var size = ctx.query.size || "medium";
    var showPrice = ctx.query.price !== "0";
    var showStore = ctx.query.store !== "0";
    var showCode = ctx.query.code !== "0";
    var copies = Math.max(1, Math.min(12, parseInt(ctx.query.copies, 10) || 1));

    HS.ui.setHeader({
      title: "الباركود",
      sub: "توليد الرموز وطباعة الملصقات ومحاكاة الماسح الضوئي — كل شيء يعمل داخل المتصفح.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "الباركود" }],
      hidePeriod: true
    });

    var tabs = [
      { id: "labels", label: "ملصقات الأصناف", icon: "tag" },
      { id: "generate", label: "توليد رمز", icon: "barcode" },
      { id: "scan", label: "محاكاة الماسح", icon: "scan" }
    ];

    var html = '<div class="stack page-enter">' +
      '<section class="card"><div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div></section>';

    if (tab === "labels") html += labelsTab();
    else if (tab === "generate") html += generateTab();
    else html += scanTab();

    html += '</div>';
    root.innerHTML = html;
    HS.icons.hydrate(root);

    /* ═══════════ ١) الملصقات ═══════════ */
    function labelsTab() {
      var q = ctx.query.q || "";
      var cat = ctx.query.cat || "";
      var products = st.products.filter(function (p) {
        if (cat && p.category !== cat) return false;
        if (q && !HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " + (p.sku || ""), q)) return false;
        return true;
      });
      var sel = Object.keys(selected).filter(function (k) { return selected[k]; });
      var selCount = sel.length;
      var totalLabels = selCount * copies;

      var preview = sel.slice(0, 8).map(function (id) {
        var p = HS.store.product(id);
        if (!p) return "";
        return labelHTML(p, { copies: 1 });
      }).join("");

      return '<div class="grid-main" style="align-items:start">' +
        /* ── عمود الاختيار ── */
        '<section class="card"><div class="card__head">' +
          '<div><h2 class="card__title">اختر الأصناف</h2>' +
          '<p class="card__sub">' + HS.fmt.int(selCount) + ' محدد من ' + HS.fmt.int(products.length) + ' معروض</p></div>' +
          '<div class="row-2">' +
            '<button type="button" class="btn btn--sm btn--ghost" data-action="bc-sel-all">تحديد الكل</button>' +
            '<button type="button" class="btn btn--sm btn--ghost" data-action="bc-sel-none">إلغاء الكل</button>' +
          '</div></div>' +
          HS.ui.toolbar({
            q: q, placeholder: "ابحث عن صنف لإضافته…", searchName: "q",
            filters: HS.ui.select({ name: "cat", label: "القسم", value: cat, options: [{ value: "", label: "كل الأقسام" }].concat(st.categories.map(function (c) { return { value: c.id, label: c.name }; })) })
          }) +
          '<div class="card__body" style="max-height:min(58vh,560px);overflow-y:auto;padding-block:var(--sp-2)">' +
          '<div class="list">' +
          (products.length ? products.map(function (p) {
            return '<label class="list__item list__item--check check" for="sel-' + p.id + '">' +
              '<input type="checkbox" id="sel-' + p.id + '" data-sel="' + p.id + '"' + (selected[p.id] ? " checked" : "") + '>' +
              '<span class="check__box" aria-hidden="true"></span>' +
              '<span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "📦") + '</span>' +
              '<span class="list__body"><span class="list__title">' + HS.esc(labelName(p)) + '</span>' +
              '<span class="list__meta">' + HS.esc(p.brand || "بدون ماركة") + ' · <span class="ltr" style="font-variant-numeric:tabular-nums">' + HS.esc(prodCode(p)) + '</span></span></span>' +
              '<span class="list__aside"><span class="fw-600 tabular fs-sm">' + HS.fmt.money(p.price) + '</span></span>' +
            '</label>';
          }).join("") : HS.ui.empty({ icon: "search", title: "لا أصناف مطابقة", text: "امسح البحث أو اختر قسمًا آخر." })) +
          '</div></div>' +
          '<div class="card__foot spread"><span class="fs-xs text-3">التحديد يبقى محفوظًا أثناء التنقل بين التبويبات.</span>' +
          (selCount ? '<button type="button" class="btn btn--sm btn--ghost text-danger" data-action="bc-sel-none">إفراغ التحديد</button>' : "") +
          '</div>' +
        '</section>' +

        /* ── عمود الخيارات والمعاينة ── */
        '<section class="stack">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">خيارات الملصق</h2>' +
          '<p class="card__sub">تُطبَع على ورق A4 عادي أو طابعة ملصقات حرارية</p></div></div>' +
          '<div class="card__body"><div class="form-grid">' +
            HS.ui.field({ name: "size", label: "مقاس الملصق", type: "select", value: size, options: Object.keys(SIZES).map(function (k) { return { value: k, label: SIZES[k].label }; }), attrs: ' data-bc-opt="size"' }) +
            HS.ui.field({ name: "copies", label: "عدد النسخ لكل صنف", type: "number", value: copies, min: 1, max: 12, step: 1, inputmode: "numeric", attrs: ' data-bc-opt="copies"' }) +
          '</div>' +
          '<div class="row-2" style="gap:var(--sp-5);flex-wrap:wrap;margin-block-start:var(--sp-4)">' +
            HS.ui.field({ name: "showStore", type: "checkbox", value: showStore, checkLabel: "اسم المحل", attrs: ' data-bc-flag="store"' }) +
            HS.ui.field({ name: "showPrice", type: "checkbox", value: showPrice, checkLabel: "سعر البيع", attrs: ' data-bc-flag="price"' }) +
            HS.ui.field({ name: "showCode", type: "checkbox", value: showCode, checkLabel: "الباركود نصيًا", attrs: ' data-bc-flag="code"' }) +
          '</div></div>' +
          '<div class="card__foot spread">' +
            '<span class="fs-sm text-2">' + (selCount ? '<b>' + HS.fmt.int(totalLabels) + '</b> ملصقًا جاهزًا للطباعة' : "لم يُحدد أي صنف بعد") + '</span>' +
            '<div class="row-2">' +
              '<button type="button" class="btn btn--secondary btn--sm" data-action="bc-low" ' + (HS.store.lowStock().length ? "" : "disabled") + '>' +
              '<span class="btn__icon">' + HS.icon("alert", 15) + '</span><span class="btn__label">تحديد النواقص</span></button>' +
              '<button type="button" class="btn btn--primary btn--sm" data-action="bc-print"' + (selCount ? "" : " disabled") + '>' +
              '<span class="btn__icon">' + HS.icon("print", 15) + '</span><span class="btn__label">طباعة الملصقات</span></button>' +
            '</div>' +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">معاينة</h2>' +
          '<p class="card__sub">' + (selCount > 8 ? "أول 8 ملصقات من " + HS.fmt.int(selCount) : HS.fmt.int(selCount) + " ملصقًا") + '</p></div></div>' +
          '<div class="card__body">' +
          (selCount ? '<div class="barcode-sheet" style="--label-cols:' + SIZES[size].cols + '">' + preview + '</div>' :
            HS.ui.empty({ icon: "tag", title: "لا معاينة بعد", text: "حدّد صنفًا واحدًا على الأقل من القائمة لعرض شكل الملصق." })) +
          '</div></article>' +
        '</section>' +
      '</div>';
    }

    function labelHTML(p, opt) {
      opt = opt || {};
      var code = prodCode(p);
      var svg = codeSVG(code, { height: 52, moduleWidth: 1.6, text: false, quiet: 6 });
      return '<div class="blabel">' +
        (showStore ? '<span class="blabel__store">' + HS.esc(st.settings.storeName) + '</span>' : "") +
        '<span class="blabel__name">' + HS.esc(labelName(p)) + '</span>' +
        (p.brand ? '<span class="blabel__brand">' + HS.esc(p.brand) + '</span>' : "") +
        svg +
        (showCode ? '<span class="blabel__code ltr">' + HS.esc(code) + '</span>' : "") +
        (showPrice ? '<span class="blabel__price">' + HS.fmt.money(p.price) + '</span>' : "") +
      '</div>';
    }
    HS.pages.barcode._labelHTML = labelHTML;

    /* ═══════════ ٢) توليد رمز ═══════════ */
    function generateTab() {
      var text = ctx.query.text || "";
      var fmt = ctx.query.fmt || "code128";
      var mw = parseInt(ctx.query.mw, 10) || 2;
      var hh = parseInt(ctx.query.hh, 10) || 62;

      var preview = "";
      var info = "";
      if (text) {
        if (fmt === "ean13") {
          var digits = String(text).replace(/\D/g, "");
          if (!digits) {
            info = '<span class="alert alert--danger">' + HS.icon("x-circle", 16) + '<span>EAN-13 يقبل الأرقام فقط. أدخل 12 أو 13 رقمًا.</span></span>';
          } else {
            var ean = HS.barcode.ean13(digits);
            preview = HS.barcode.ean13svg(ean, { height: hh, moduleWidth: mw, text: true, fontSize: 12 });
            var supplied = digits.length === 13 ? digits[12] : null;
            info = '<span class="alert ' + (supplied && supplied !== ean[12] ? "alert--warning" : "alert--success") + '">' +
              HS.icon(supplied && supplied !== ean[12] ? "alert" : "check-circle", 16) +
              '<span>رمز EAN-13 · <b class="ltr">' + HS.esc(ean) + '</b> · خانة التحقق <b>' + HS.fmt.int(ean[12]) + '</b>' +
              (supplied && supplied !== ean[12] ? ' — الرقم المُدخل كان <b>' + HS.esc(supplied) + '</b> وصُحّح تلقائيًا.' : "") +
              '</span></span>';
          }
        } else {
          preview = HS.barcode.svg(text, { height: hh, moduleWidth: mw, text: true, fontSize: 12 });
          var enc = HS.barcode.encode(text);
          info = '<span class="alert alert--neutral">' + HS.icon("info", 16) + '<span>Code 128-B · <b>' + HS.fmt.int(text.length) + '</b> حرفًا · رقم التحقق <b>' + HS.fmt.int(enc.check) + '</b> · عرض الرمز <b>' + HS.fmt.int(enc.modules) + '</b> وحدة</span></span>';
        }
      } else {
        preview = '<div class="scan-box"><div class="scan-box__laser" aria-hidden="true"></div>' +
          '<div class="text-3 fs-sm">اكتب نصًا أو رمزًا في الحقل لتوليد الباركود.</div></div>';
      }

      var samples = st.products.slice(0, 6).map(function (p) {
        return '<button type="button" class="chip" data-action="bc-sample" data-text="' + HS.esc(prodCode(p)) + '">' + HS.esc(prodCode(p)) + '</button>';
      }).join("");

      return '<div class="grid-main" style="align-items:start">' +
        '<section class="card"><div class="card__head"><div><h2 class="card__title">توليد رمز</h2>' +
        '<p class="card__sub">يدعم Code 128-B للنصوص والرموز، وEAN-13 للأرقام</p></div></div>' +
        '<div class="card__body"><div class="stack">' +
          HS.ui.field({ name: "text", label: "النص أو الرمز", value: text, placeholder: "مثال: 6110043", attrs: ' data-autofocus dir="ltr" autocomplete="off" data-bc-text', hint: "يُحدَّث تلقائيًا أثناء الكتابة" }) +
          '<div class="form-grid">' +
            HS.ui.field({ name: "fmt", label: "نوع الرمز", type: "select", value: fmt, options: [{ value: "code128", label: "Code 128-B" }, { value: "ean13", label: "EAN-13" }], attrs: ' data-bc-opt="fmt"' }) +
            HS.ui.field({ name: "mw", label: "عرض الوحدة (بكسل)", type: "number", value: mw, min: 1, max: 4, step: 1, inputmode: "numeric", attrs: ' data-bc-opt="mw"' }) +
            HS.ui.field({ name: "hh", label: "ارتفاع الرمز (بكسل)", type: "number", value: hh, min: 24, max: 160, step: 2, inputmode: "numeric", attrs: ' data-bc-opt="hh"' }) +
          '</div>' +
          '<div><span class="field__label">أمثلة جاهزة من الكتالوج</span><div class="chips">' + samples +
            '<button type="button" class="chip" data-action="bc-sample" data-text="' + HS.esc(HS.store.state.settings.invoicePrefix + "-2026-0148") + '">رقم فاتورة</button>' +
          '</div></div>' +
        '</div></div>' +
        '<div class="card__foot spread">' +
          '<span class="fs-xs text-3">التصدير لا يحتاج اتصالًا بالإنترنت.</span>' +
          '<div class="row-2">' +
            '<button type="button" class="btn btn--secondary btn--sm" data-action="bc-copy-code"' + (text ? "" : " disabled") + '><span class="btn__icon">' + HS.icon("copy", 15) + '</span><span class="btn__label">نسخ الرمز</span></button>' +
            '<button type="button" class="btn btn--secondary btn--sm" data-action="bc-download" data-kind="svg"' + (text ? "" : " disabled") + '><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">SVG</span></button>' +
            '<button type="button" class="btn btn--primary btn--sm" data-action="bc-download" data-kind="png"' + (text ? "" : " disabled") + '><span class="btn__icon">' + HS.icon("file", 15) + '</span><span class="btn__label">PNG</span></button>' +
          '</div>' +
        '</div></section>' +

        '<section class="card"><div class="card__head"><div><h2 class="card__title">المعاينة</h2>' +
        '<p class="card__sub">الخلفية بيضاء لضمان قراءة الماسح</p></div></div>' +
        '<div class="card__body">' +
          '<div class="blabel" id="bcPreview" style="align-items:center">' + (preview || "") + '</div>' +
          (info ? '<div style="margin-block-start:var(--sp-4)">' + info + '</div>' : "") +
        '</div></section>' +
      '</div>';
    }

    /* ═══════════ ٣) محاكاة الماسح ═══════════ */
    function scanTab() {
      var last = scanLog[0];
      var okCount = scanLog.filter(function (e) { return e.ok; }).length;
      var cartCount = scanLog.filter(function (e) { return e.added; }).length;

      return '<div class="grid-main" style="align-items:start">' +
        '<section class="card"><div class="card__head"><div><h2 class="card__title">محاكاة الماسح الضوئي</h2>' +
        '<p class="card__sub">يحاكي سلوك قارئ الباركود: يدخل الرمز ثم Enter تلقائيًا</p></div></div>' +
        '<div class="card__body"><div class="scan-box" id="scanSim">' +
          '<div class="scan-box__laser" aria-hidden="true"></div>' +
          '<div>' +
            '<div class="fw-600 fs-md" id="simTitle">' + (last ? (last.ok ? "آخر عملية ناجحة" : "آخر عملية فاشلة") : "جاهز للمسح") + '</div>' +
            '<div class="fs-sm text-3" id="simSub" style="margin-block-start:2px">' +
              (last ? (last.ok ? HS.esc(last.name) + " · " + HS.fmt.money(last.price) : "«" + HS.esc(last.code) + "» غير معروف") : "اضغط «مسح صنف عشوائي» أو اكتب رمزًا يدويًا") +
            '</div>' +
          '</div>' +
          (last && last.ok ? '<div class="blabel" style="max-width:340px;margin-inline:auto">' + HS.barcode.svg(last.code, { height: 46, moduleWidth: 1.5, text: true, fontSize: 11 }) + '</div>' : "") +
          '<div class="row-2" style="flex-wrap:wrap;justify-content:center">' +
            '<button type="button" class="btn btn--primary" data-action="bc-sim-scan"><span class="btn__icon">' + HS.icon("scan", 16) + '</span><span class="btn__label">مسح صنف عشوائي</span></button>' +
            '<button type="button" class="btn btn--secondary" data-action="bc-sim-bad"><span class="btn__icon">' + HS.icon("x-circle", 16) + '</span><span class="btn__label">مسح رمز خاطئ</span></button>' +
            (last && last.ok ? '<button type="button" class="btn btn--soft" data-action="bc-sim-add" data-code="' + HS.esc(last.code) + '"><span class="btn__icon">' + HS.icon("cart", 16) + '</span><span class="btn__label">إضافة إلى السلة</span></button>' : "") +
          '</div>' +
          '<div class="input-wrap" style="max-width:340px;margin-inline:auto;width:100%">' +
            '<span class="input-wrap__icon">' + HS.icon("hash", 16) + '</span>' +
            '<input class="input" id="simInput" type="text" dir="ltr" autocomplete="off" placeholder="أو اكتب الرمز ثم Enter" aria-label="إدخال الرمز يدويًا" style="text-align:center">' +
          '</div>' +
        '</div></div>' +
        '<div class="card__foot spread"><span class="fs-xs text-3">' + HS.fmt.int(okCount) + ' مسحًا ناجحًا · ' + HS.fmt.int(cartCount) + ' أُضيفت للسلة · ' + HS.fmt.int(scanLog.length - okCount) + ' فشل</span>' +
        (scanLog.length ? '<button type="button" class="btn btn--sm btn--ghost" data-action="bc-sim-clear">مسح السجل</button>' : "") +
        '</div></section>' +

        '<section class="card"><div class="card__head"><div><h2 class="card__title">سجل المسح</h2>' +
        '<p class="card__sub">الجلسة الحالية فقط</p></div></div>' +
        '<div class="card__body" style="padding-block:var(--sp-2);max-height:min(60vh,560px);overflow-y:auto">' +
        (scanLog.length ? '<div class="timeline">' + scanLog.map(function (e) {
          return '<div class="timeline__item">' +
            '<span class="timeline__dot timeline__dot--' + (e.ok ? (e.added ? "in" : "in") : "out") + '" aria-hidden="true"></span>' +
            '<div class="timeline__body"><div class="timeline__title">' +
              (e.ok ? HS.esc(e.name) : '<span class="text-danger">رمز غير معروف</span>') +
              (e.added ? ' ' + HS.ui.badge("أُضيف للسلة", "badge--success") : "") + '</div>' +
            '<div class="timeline__meta ltr" style="text-align:right">' + HS.esc(e.code) + '</div>' +
            '<div class="timeline__meta">' + HS.fmt.time(e.at) + (e.ok ? " · " + HS.fmt.money(e.price) + " · رصيد " + HS.fmt.int(e.stock) : "") + '</div>' +
            '</div></div>';
        }).join("") + '</div>' : HS.ui.empty({ icon: "scan", title: "لا عمليات مسح بعد", text: "ابدأ بمسح صنف عشوائي لتجربة السلوك." })) +
        '</div></section>' +
      '</div>';
    }

    /* ═══════════ التفاعل ═══════════ */
    root.querySelectorAll("[data-sel]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        selected[cb.getAttribute("data-sel")] = cb.checked;
        HS.router.refresh();
      });
    });
    root.querySelectorAll("[data-bc-opt]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {}; patch[el.getAttribute("data-bc-opt")] = el.value;
        ctx.setQuery(patch, { replace: true });
      });
    });
    root.querySelectorAll("[data-bc-flag]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {}; patch[el.getAttribute("data-bc-flag")] = el.checked ? null : "0";
        ctx.setQuery(patch, { replace: true });
      });
    });
    var txt = root.querySelector("[data-bc-text]");
    if (txt) {
      txt.addEventListener("input", HS.debounce(function () { ctx.setQuery({ text: txt.value || null }, { replace: true }); }, 420));
      txt.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); ctx.setQuery({ text: txt.value || null }, { replace: true }); } });
    }
    var sim = root.querySelector("#simInput");
    if (sim) {
      sim.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); doSimScan(sim.value); sim.value = ""; }
      });
      setTimeout(function () { sim.focus(); }, 90);
    }
    var catSel = root.querySelector('.toolbar select[name="cat"]');
    if (catSel) catSel.addEventListener("change", function () { ctx.setQuery({ cat: catSel.value || null }); });
  };

  /* ═══════════ مساعدات مشتركة ═══════════ */
  function doSimScan(code) {
    var st = HS.store.state;
    var v = String(code || "").trim();
    var at = new Date().toISOString();
    var digits = v.replace(/\D/g, "");
    var p = (digits && HS.store.byBarcode(digits)) ||
            st.products.filter(function (x) { return x.sku === v; })[0] ||
            st.products.filter(function (x) { return HS.matches(x.name + " " + (x.brand || "") + " " + (x.size || ""), v); })[0];
    if (!v) return;
    if (!p) {
      scanLog.unshift({ ok: false, code: v, at: at });
      HS.ui.toast({ type: "danger", icon: "x-circle", title: "رمز غير معروف", msg: "«" + v + "» غير مسجّل في الكتالوج." });
    } else {
      scanLog.unshift({ ok: true, code: prodCode(p), name: labelName(p), price: p.price, stock: p.stock, productId: p.id, at: at });
      HS.ui.toast({ type: p.stock > 0 ? "success" : "warning", icon: p.stock > 0 ? "check-circle" : "alert", title: labelName(p), msg: (p.brand ? p.brand + " · " : "") + HS.fmt.money(p.price) + " · الرصيد " + HS.fmt.int(p.stock) + " " + (p.unit || "عبوة") });
    }
    scanLog = scanLog.slice(0, 40);
    HS.router.refresh();
  }
  HS.pages.barcode.doSimScan = doSimScan;

  function sheetHTML(ids, opts) {
    var st = HS.store.state;
    var sz = SIZES[opts.size] || SIZES.medium;
    var out = [];
    ids.forEach(function (id) {
      var p = HS.store.product(id);
      if (!p) return;
      for (var i = 0; i < (opts.copies || 1); i++) {
        var code = prodCode(p);
        out.push('<div class="blabel">' +
          (opts.store !== false ? '<span class="blabel__store">' + HS.esc(st.settings.storeName) + '</span>' : "") +
          '<span class="blabel__name">' + HS.esc(labelName(p)) + '</span>' +
          (p.brand ? '<span class="blabel__brand">' + HS.esc(p.brand) + '</span>' : "") +
          codeSVG(code, { height: 52, moduleWidth: 1.6, text: false, quiet: 6 }) +
          (opts.code !== false ? '<span class="blabel__code ltr">' + HS.esc(code) + '</span>' : "") +
          (opts.price !== false ? '<span class="blabel__price">' + HS.fmt.money(p.price) + '</span>' : "") +
        '</div>');
      }
    });
    return '<div class="barcode-sheet" style="--label-cols:' + sz.cols + ';--label-h:' + sz.h + '">' + out.join("") + '</div>';
  }
  HS.pages.barcode.sheetHTML = sheetHTML;

  /** يفتح نافذة الملصقات مع أصناف محددّة مسبقًا */
  HS.pages.barcode.openLabels = function (ids) {
    (ids || []).forEach(function (id) { selected[id] = true; });
    HS.router.go("/barcode", { tab: "labels" });
  };

  function printLabels(ids, opts) {
    if (!ids.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لم يُحدد أي صنف" }); return; }
    var holder = HS.$("#printRoot");
    holder.innerHTML = sheetHTML(ids, opts);
    document.body.setAttribute("data-printing", "labels");
    var done = function () {
      document.body.removeAttribute("data-printing");
      holder.innerHTML = "";
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(function () { window.print(); setTimeout(done, 1200); }, 80);
  }
  HS.pages.barcode.printLabels = printLabels;

  /* ═══════════ الإجراءات ═══════════ */
  HS.action("bc-sel-all", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    var st = HS.store.state;
    var q = ctx.query.q || "", cat = ctx.query.cat || "";
    st.products.forEach(function (p) {
      if (cat && p.category !== cat) return;
      if (q && !HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " + (p.sku || ""), q)) return;
      selected[p.id] = true;
    });
    HS.router.refresh();
    HS.ui.toast({ type: "info", icon: "check", title: "حُدّدت كل الأصناف المعروضة", duration: 2400 });
  });
  HS.action("bc-sel-none", function () { selected = {}; HS.router.refresh(); });
  HS.action("bc-low", function () {
    selected = {};
    HS.store.lowStock().concat(HS.store.outOfStock()).forEach(function (p) { selected[p.id] = true; });
    var n = Object.keys(selected).length;
    HS.router.refresh();
    HS.ui.toast({ type: "info", icon: "alert", title: "حُدّدت أصناف النواقص", msg: HS.fmt.int(n) + " صنفًا تحت الحد الأدنى أو نافدة." });
  });
  HS.action("bc-print", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    var ids = Object.keys(selected).filter(function (k) { return selected[k]; });
    printLabels(ids, {
      size: ctx.query.size || "medium",
      copies: Math.max(1, parseInt(ctx.query.copies, 10) || 1),
      store: ctx.query.store !== "0",
      price: ctx.query.price !== "0",
      code: ctx.query.code !== "0"
    });
  });

  HS.action("bc-sample", function (btn) {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ text: btn.getAttribute("data-text") });
  });
  HS.action("bc-copy-code", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    var t = ctx.query.text || "";
    if (!t) return;
    var code = ctx.query.fmt === "ean13" ? (t.replace(/\D/g, "") ? HS.barcode.ean13(t.replace(/\D/g, "")) : t) : t;
    HS.ui.copy(code).then(function (ok) {
      HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "copy" : "alert", title: ok ? "نُسخ الرمز" : "تعذّر النسخ", msg: ok ? code : "", duration: 2400 });
    });
  });
  HS.action("bc-download", function (btn) {
    var ctx = HS.router.current(); if (!ctx) return;
    var kind = btn.getAttribute("data-kind");
    var t = ctx.query.text || "";
    if (!t) return;
    var svg;
    if (ctx.query.fmt === "ean13") {
      var digits = t.replace(/\D/g, "");
      if (!digits) { HS.ui.toast({ type: "danger", icon: "alert", title: "رمز غير صالح", msg: "EAN-13 يقبل الأرقام فقط." }); return; }
      svg = HS.barcode.ean13svg(HS.barcode.ean13(digits), { height: parseInt(ctx.query.hh, 10) || 62, moduleWidth: parseInt(ctx.query.mw, 10) || 2, text: true, fontSize: 12 });
    } else {
      svg = HS.barcode.svg(t, { height: parseInt(ctx.query.hh, 10) || 62, moduleWidth: parseInt(ctx.query.mw, 10) || 2, text: true, fontSize: 12 });
    }
    if (kind === "svg") {
      var ok = HS.download("barcode-" + t.replace(/[^\w-]/g, "_") + ".svg", svg);
      HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "نُزّل الملف" : "تعذّر التنزيل", msg: ok ? "صيغة SVG متجهية قابلة للتكبير" : "" });
      return;
    }
    svgToPng(svg, 3).then(function (blob) {
      if (!blob) { HS.ui.toast({ type: "danger", icon: "alert", title: "تعذّر تحويل الصورة", msg: "متصفحك منع الرسم على Canvas. استخدم صيغة SVG." }); return; }
      var url = URL.createObjectURL(blob);
      var a = HS.el("a", { attrs: { href: url, download: "barcode-" + t.replace(/[^\w-]/g, "_") + ".png" } });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      HS.ui.toast({ type: "success", icon: "download", title: "نُزّلت الصورة", msg: "PNG بدقة مضاعفة ثلاث مرات" });
    });
  });

  function svgToPng(svg, scale) {
    return new Promise(function (resolve) {
      try {
        var box = HS.el("div");
        box.innerHTML = svg;
        var node = box.querySelector("svg");
        if (!node) return resolve(null);
        var w = parseInt(node.getAttribute("width"), 10) || 300;
        var h = parseInt(node.getAttribute("height"), 10) || 80;
        node.setAttribute("width", w); node.setAttribute("height", h);
        var src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(node));
        var img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement("canvas");
            c.width = w * scale; c.height = h * scale;
            var g = c.getContext("2d");
            g.fillStyle = "#ffffff"; g.fillRect(0, 0, c.width, c.height);
            g.drawImage(img, 0, 0, c.width, c.height);
            c.toBlob(function (b) { resolve(b); }, "image/png");
          } catch (e) { resolve(null); }
        };
        img.onerror = function () { resolve(null); };
        img.src = src;
      } catch (e) { resolve(null); }
    });
  }

  HS.action("bc-sim-scan", function () {
    var st = HS.store.state;
    var pool = st.products.filter(function (p) { return p.active; });
    if (!pool.length) return;
    var p = pool[Math.floor(Math.random() * pool.length)];
    var box = HS.$("#scanSim");
    if (box) { box.setAttribute("data-flash", "ok"); setTimeout(function () { box.removeAttribute("data-flash"); }, 620); }
    doSimScan(prodCode(p));
  });
  HS.action("bc-sim-bad", function () {
    /* باركود غير مسجّل: 13 رقمًا ببادئة غير مستعملة */
    var bad = HS.barcode.ean13("9999" + String(Math.floor(1000 + Math.random() * 8999)) + String(Math.floor(1000 + Math.random() * 8999)));
    if (HS.store.barcodeTaken(bad)) bad = "ZZ-" + bad;
    doSimScan(bad);
  });
  HS.action("bc-sim-add", function (btn) {
    var code = btn.getAttribute("data-code");
    var p = HS.store.byBarcode(String(code).replace(/\D/g, "")) ||
            HS.store.state.products.filter(function (x) { return x.sku === code; })[0];
    if (!p) return;
    var res = HS.store.cart.add(p.id, 1);
    if (!res.ok) { HS.ui.toast({ type: "warning", icon: "alert", title: "تعذّرت الإضافة", msg: res.error }); return; }
    if (scanLog[0] && scanLog[0].code === code) scanLog[0].added = true;
    HS.ui.toast({
      type: "success", icon: "cart", title: "أُضيف «" + labelName(p) + "» إلى السلة",
      actions: [{ label: "الذهاب إلى نقطة البيع", onClick: function () { HS.router.go("/pos"); }, cls: "btn--soft" }]
    });
    HS.router.refresh();
  });
  HS.action("bc-sim-clear", function () { scanLog = []; HS.router.refresh(); });
})();
