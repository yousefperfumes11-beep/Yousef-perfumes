/* ═══════════════════════════════════════════════════════════
   pages/settings.js — الإعدادات
   هوية المحل، المالية، المخزون، الإيصال، المظهر، البيانات، وعن النظام.
   التغييرات تُطبَّق فورًا على التنسيق والألوان.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var SECTIONS = [
    { id: "identity", label: "هوية المحل", icon: "store" },
    { id: "financial", label: "المالية والضرائب", icon: "wallet" },
    { id: "inventory", label: "المخزون", icon: "layers" },
    { id: "receipt", label: "الإيصال والطباعة", icon: "receipt" },
    { id: "appearance", label: "المظهر", icon: "sliders" },
    { id: "data", label: "البيانات والنسخ الاحتياطي", icon: "database" },
    { id: "about", label: "عن النظام", icon: "info" }
  ];

  HS.pages.settings = function (root, ctx) {
    var st = HS.store.state;
    var s = st.settings;
    var sec = ctx.query.tab || "identity";
    if (!SECTIONS.some(function (x) { return x.id === sec; })) sec = "identity";
    var canManage = HS.store.can("settings_manage");

    HS.ui.setHeader({
      title: "الإعدادات",
      sub: "تُحفظ التغييرات في هذا المتصفح فقط وتُطبَّق على كل الشاشات فورًا.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "الإعدادات" }],
      hidePeriod: true
    });

    var body = "";
    if (sec === "identity") body = identity();
    else if (sec === "financial") body = financial();
    else if (sec === "inventory") body = inventory();
    else if (sec === "receipt") body = receipt();
    else if (sec === "appearance") body = appearance();
    else if (sec === "data") body = dataSection();
    else body = about();

    root.innerHTML = '<div class="settings page-enter">' +
      '<nav class="settings__nav card" aria-label="أقسام الإعدادات"><div class="card__body" style="padding:var(--sp-2)">' +
        SECTIONS.map(function (x) {
          return '<a class="settings__navBtn" href="#/settings?tab=' + x.id + '" aria-current="' + (x.id === sec) + '">' +
            HS.icon(x.icon, 17) + '<span>' + HS.esc(x.label) + '</span></a>';
        }).join("") +
      '</div></nav>' +
      '<div class="stack">' + body + '</div>' +
    '</div>';

    HS.icons.hydrate(root);
    bindForms(root, sec);

    if (!canManage && sec !== "appearance" && sec !== "about") {
      HS.ui.toast({ type: "warning", icon: "lock", title: "وضع قراءة فقط", msg: "ليس لديك صلاحية «إدارة إعدادات النظام» — الحقول معطّلة.", duration: 5200 });
    }

    /* ═══════════ ١) الهوية ═══════════ */
    function identity() {
      return formCard({
        title: "هوية المحل", sub: "تظهر في الشريط الجانبي وشاشة الدخول ورأس الفاتورة والإيصال",
        action: "set-save-identity",
        fields: '<div class="form-grid">' +
          HS.ui.field({ name: "storeName", label: "اسم المحل", value: s.storeName, required: true, span2: true, disabled: !canManage, hint: "يظهر في كل مكان في الواجهة" }) +
          HS.ui.field({ name: "branch", label: "اسم الفرع", value: s.branch, disabled: !canManage }) +
          HS.ui.field({ name: "activity", label: "نشاط المحل", value: s.activity, disabled: !canManage, hint: "يظهر في شاشة الدخول، مثل: عطور أصلية · ماركات عالمية وشرقية" }) +
          HS.ui.field({ name: "owner", label: "اسم المالك", value: s.owner, disabled: !canManage, autocomplete: "name" }) +
          HS.ui.field({ name: "phone", label: "هاتف المحل", value: s.phone, disabled: !canManage, attrs: ' dir="ltr" autocomplete="tel" inputmode="tel"' }) +
          HS.ui.field({ name: "taxNumber", label: "الرقم الضريبي", value: s.taxNumber, disabled: !canManage, attrs: ' dir="ltr" autocomplete="off"' }) +
          HS.ui.field({ name: "address", label: "العنوان", value: s.address, disabled: !canManage, span2: true, autocomplete: "street-address" }) +
          HS.ui.field({ name: "city", label: "المدينة", type: "select", value: s.city || "طرابلس", disabled: !canManage, options: HS.data.CITIES.map(function (c) { return { value: c, label: c }; }) }) +
          HS.ui.field({ name: "workHours", label: "ساعات العمل", value: s.workHours || "9:00 ص — 10:00 م", disabled: !canManage, hint: "تظهر في تذييل الإيصال" }) +
        '</div>',
        preview: '<div class="receipt" style="max-width:340px;margin-inline:auto">' +
          '<div class="receipt__head"><div class="receipt__store">' +
            '<span class="brand__mark" style="inline-size:40px;block-size:40px" aria-hidden="true">' + HS.esc((s.storeName || "ه")[0]) + '</span>' +
            '<div><div class="receipt__name">' + HS.esc(s.storeName) + '</div>' +
            '<div class="receipt__meta">' + HS.esc(s.branch) + '<br>' + HS.esc(s.address) + '<br>هاتف: <span class="ltr">' + HS.esc(HS.ui.phone(s.phone)) + '</span>' +
            (s.taxNumber ? '<br>الرقم الضريبي: <span class="ltr">' + HS.esc(s.taxNumber) + '</span>' : "") + '</div></div></div></div>' +
          '<div class="receipt__foot">' + HS.esc(s.receiptFooter) + '</div></div>'
      });
    }

    /* ═══════════ ٢) المالية ═══════════ */
    function financial() {
      return formCard({
        title: "المالية والضرائب", sub: "العملة ودقتها والأرقام ونسبة الضريبة وسلوك الائتمان",
        action: "set-save-financial",
        fields: '<div class="form-grid">' +
          HS.ui.field({ name: "currency", label: "رمز العملة", value: s.currency, disabled: !canManage, hint: "يظهر بعد كل مبلغ" }) +
          HS.ui.field({ name: "currencyCode", label: "رمز العملة الدولي", value: s.currencyCode, disabled: !canManage, attrs: ' dir="ltr"' }) +
          HS.ui.field({ name: "decimals", label: "عدد الخانات العشرية", type: "select", value: s.decimals, disabled: !canManage, options: [{ value: 0, label: "بدون كسور (12)" }, { value: 2, label: "خانتان (12.50)" }, { value: 3, label: "ثلاث خانات (12.500) — المعتاد في ليبيا" }], hint: "الدينار الليبي يُقسم إلى 1000 درهم" }) +
          HS.ui.field({ name: "numerals", label: "شكل الأرقام", type: "select", value: s.numerals, disabled: !canManage, options: [{ value: "latin", label: "أرقام لاتينية (1234)" }, { value: "arabic", label: "أرقام عربية (١٢٣٤)" }] }) +
          HS.ui.field({ name: "dateFormat", label: "أسلوب التاريخ", type: "select", value: s.dateFormat, disabled: !canManage, options: [{ value: "short", label: "مختصر (٢٧ سبتمبر ٢٠٢٦)" }, { value: "long", label: "مفصّل (السبت، ٢٧ سبتمبر ٢٠٢٦)" }] }) +
          HS.ui.field({ name: "taxRate", label: "نسبة الضريبة", type: "number", value: s.taxRate, min: 0, max: 50, step: "0.5", suffix: "٪", disabled: !canManage, inputmode: "decimal", hint: "صفر تعني أسعارًا شاملة بلا ضريبة مضافة" }) +
          HS.ui.field({ name: "invoicePrefix", label: "بادئة رقم الفاتورة", value: s.invoicePrefix, disabled: !canManage, attrs: ' dir="ltr"', hint: "مثال: INV تُنتج INV-2026-0148" }) +
          HS.ui.field({ name: "defaultDiscount", label: "الخصم الافتراضي", type: "number", value: s.defaultDiscount, min: 0, max: 100, step: "0.5", suffix: "٪", disabled: !canManage, inputmode: "decimal" }) +
          HS.ui.field({ name: "maxCreditDays", label: "أقصى مدة للدين", type: "number", value: s.maxCreditDays, min: 0, max: 365, step: 1, suffix: "يومًا", disabled: !canManage, inputmode: "numeric", hint: "تُحتسب الديون المتأخرة على أساسها" }) +
          HS.ui.field({ name: "cashOpening", label: "الرصيد الافتتاحي للصندوق", type: "number", value: s.cashOpening, min: 0, step: "0.001", suffix: s.currency, disabled: !canManage, inputmode: "decimal", hint: "ما كان في الدرج عند بدء استخدام النظام — يظهر كأول قيد في سجل الصندوق" }) +
        '</div>' +
        '<div class="setting-row" style="margin-block-start:var(--sp-3)">' +
          '<div class="setting-row__body"><div class="setting-row__k">السماح بالبيع عند نفاد المخزون</div>' +
          '<div class="setting-row__d">يُمكّن الكاشير من إتمام فاتورة برصيد سالب. يُستحسن إبقاؤه مغلقًا لضبط المخزون.</div></div>' +
          '<div class="setting-row__ctl">' + HS.ui.field({ name: "allowNegativeStock", type: "switch", value: s.allowNegativeStock, checkLabel: "مسموح", disabled: !canManage }) + '</div>' +
        '</div>',
        preview: '<div class="card" style="box-shadow:none"><div class="card__body">' +
          '<div class="fs-xs text-3" style="margin-block-end:var(--sp-2)">معاينة التنسيق</div>' +
          HS.ui.kv([
            ["مبلغ صحيح", HS.fmt.money(1250)],
            ["مبلغ بكسور", HS.fmt.money(47.253)],
            ["نسبة", HS.fmt.pct(0.1875, 1)],
            ["تاريخ مختصر", HS.fmt.date(new Date())],
            ["تاريخ مفصّل", HS.fmt.date(new Date(), "long")],
            ["مبلغ مضغوط", HS.fmt.moneyShort(184500)]
          ]) +
          (Number(s.taxRate) > 0 ? '<div class="alert alert--info" style="margin-block-start:var(--sp-4)">' + HS.icon("info", 16) +
            '<span>فاتورة بقيمة ' + HS.fmt.money(100) + ' ستُحسب ضريبتها ' + HS.fmt.money(100 * Number(s.taxRate) / 100) + ' ليصبح الإجمالي ' + HS.fmt.money(100 + 100 * Number(s.taxRate) / 100) + '.</span></div>'
            : '<div class="alert alert--neutral" style="margin-block-start:var(--sp-4)">' + HS.icon("percent", 16) + '<span>الضريبة صفر: الأسعار تُعرض كما هي بلا إضافة.</span></div>') +
        '</div></div>'
      });
    }

    /* ═══════════ ٣) المخزون ═══════════ */
    function inventory() {
      var alerts = HS.store.stockAlertCount();
      return formCard({
        title: "المخزون والتنبيهات", sub: "حدود التنبيه الافتراضية وسلوك الجرد",
        action: "set-save-inventory",
        fields: '<div class="form-grid">' +
          HS.ui.field({ name: "lowStockThreshold", label: "حد التنبيه الافتراضي", type: "number", value: s.lowStockThreshold, min: 0, max: 500, step: 1, suffix: "وحدة", disabled: !canManage, inputmode: "numeric", hint: "يُستخدم للصنف الجديد ما لم يُحدد حد خاص به" }) +
          HS.ui.field({ name: "reorderMultiple", label: "مضاعف طلب إعادة التوريد", type: "number", value: s.reorderMultiple || 3, min: 1, max: 12, step: 1, suffix: "× الحد الأدنى", disabled: !canManage, inputmode: "numeric", hint: "الكمية المقترحة في أوامر الشراء = الحد الأدنى × هذا الرقم − الرصيد" }) +
        '</div>' +
        '<div class="alert alert--' + (alerts ? "warning" : "success") + '" style="margin-block-start:var(--sp-4)">' +
          HS.icon(alerts ? "alert" : "check-circle", 17) +
          '<span>' + (alerts
            ? 'يوجد حاليًا <b>' + HS.fmt.int(HS.store.outOfStock().length) + '</b> صنفًا نافدًا و<b>' + HS.fmt.int(HS.store.lowStock().length) + '</b> تحت الحد الأدنى. <a class="link" href="#/inventory?tab=alerts">معالجتها الآن</a>'
            : "لا تنبيهات مخزون حالية — كل الأصناف فوق حدودها.") + '</span></div>' +
        '<div class="setting-row" style="margin-block-start:var(--sp-3)">' +
          '<div class="setting-row__body"><div class="setting-row__k">إظهار تنبيه المخزون في الشريط العلوي</div>' +
          '<div class="setting-row__d">شارة بجانب جرس التنبيهات تُظهر عدد الأصناف التي تحتاج إعادة طلب.</div></div>' +
          '<div class="setting-row__ctl">' + HS.ui.field({ name: "showStockAlert", type: "switch", value: s.showStockAlert !== false, checkLabel: "مفعّل", disabled: !canManage }) + '</div>' +
        '</div>',
        preview: '<div class="card" style="box-shadow:none"><div class="card__body">' +
          '<div class="fs-xs text-3" style="margin-block-end:var(--sp-2)">أدنى خمسة أرصدة حاليًا</div>' +
          '<div class="list">' + HS.store.lowStock().concat(HS.store.outOfStock()).slice(0, 5).map(function (p) {
            return '<div class="list__item" style="padding-block:var(--sp-2)">' +
              '<span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "📦") + '</span>' +
              '<span class="list__body"><span class="list__title">' + HS.esc(p.name) + '</span>' +
              '<span class="list__meta">الحد ' + HS.fmt.int(p.minStock) + ' · المقترح طلبه ' + HS.fmt.int(Math.max(0, p.minStock * (Number(s.reorderMultiple) || 3) - p.stock)) + '</span></span>' +
              '<span class="list__aside">' + HS.ui.stockBadge(p) + '</span></div>';
          }).join("") || '<p class="fs-sm text-3">لا أصناف تحت الحد الأدنى.</p>' + '</div>' +
        '</div></div>'
      });
    }

    /* ═══════════ ٤) الإيصال ═══════════ */
    function receipt() {
      return formCard({
        title: "الإيصال والطباعة", sub: "نص التذييل والباركود وهامش الطباعة",
        action: "set-save-receipt",
        fields: '<div class="form-grid">' +
          HS.ui.field({ name: "receiptFooter", label: "نص تذييل الإيصال", type: "textarea", value: s.receiptFooter, rows: 3, span2: true, disabled: !canManage, hint: "يظهر في نهاية كل إيصال وفاتورة" }) +
          HS.ui.field({ name: "receiptWidth", label: "عرض ورق الإيصال", type: "select", value: s.receiptWidth || "80mm", disabled: !canManage, options: [{ value: "58mm", label: "58 ملم — طابعة صغيرة" }, { value: "80mm", label: "80 ملم — المعتاد" }, { value: "A4", label: "A4 — فاتورة كاملة" }] }) +
          HS.ui.field({ name: "receiptCopies", label: "عدد النسخ عند الطباعة", type: "number", value: s.receiptCopies || 1, min: 1, max: 3, step: 1, disabled: !canManage, inputmode: "numeric" }) +
        '</div>' +
        '<div class="setting-row" style="margin-block-start:var(--sp-3)">' +
          '<div class="setting-row__body"><div class="setting-row__k">طباعة باركود رقم الفاتورة</div>' +
          '<div class="setting-row__d">يُضاف رمز Code 128 لرقم الفاتورة في نهاية الإيصال ليسهل استرجاعها بالماسح.</div></div>' +
          '<div class="setting-row__ctl">' + HS.ui.field({ name: "showBarcodeOnReceipt", type: "switch", value: s.showBarcodeOnReceipt, checkLabel: "مفعّل", disabled: !canManage }) + '</div>' +
        '</div>' +
        '<div class="setting-row">' +
          '<div class="setting-row__body"><div class="setting-row__k">فتح نافذة الطباعة تلقائيًا بعد البيع</div>' +
          '<div class="setting-row__d">يعرض الإيصال في نافذة مع زر طباعة مباشرة بعد إتمام الدفع.</div></div>' +
          '<div class="setting-row__ctl">' + HS.ui.field({ name: "autoReceiptAfterSale", type: "switch", value: s.autoReceiptAfterSale !== false, checkLabel: "مفعّل", disabled: !canManage }) + '</div>' +
        '</div>',
        preview: '<div class="receipt" style="max-width:' + (s.receiptWidth === "58mm" ? "260px" : "340px") + ';margin-inline:auto">' +
          '<div class="receipt__head"><div class="receipt__store"><div><div class="receipt__name">' + HS.esc(s.storeName) + '</div>' +
          '<div class="receipt__meta">' + HS.esc(s.branch) + '<br>' + HS.esc(s.address) + '</div></div></div>' +
          '<div class="receipt__no"><div class="receipt__noLbl">رقم الفاتورة</div><div class="receipt__noVal">INV-2026-0148</div></div></div>' +
          '<table class="table" style="margin-block-start:var(--sp-4)"><thead><tr><th>الصنف</th><th class="num">الكمية</th><th class="num">الإجمالي</th></tr></thead>' +
          '<tbody><tr><td>أرز بسمتي هندي 5 كغ</td><td class="num">2</td><td class="num">' + HS.fmt.money(125) + '</td></tr>' +
          '<tr><td>زيت زيتون بلدي 1 لتر</td><td class="num">1</td><td class="num">' + HS.fmt.money(48) + '</td></tr></tbody></table>' +
          '<div class="receipt__totals">' +
            '<div class="sum-row"><span class="sum-row__k">المجموع</span><span class="sum-row__v">' + HS.fmt.money(173) + '</span></div>' +
            (Number(s.taxRate) ? '<div class="sum-row"><span class="sum-row__k">الضريبة</span><span class="sum-row__v">' + HS.fmt.money(173 * Number(s.taxRate) / 100) + '</span></div>' : "") +
            '<div class="sum-row sum-row--total"><span class="sum-row__k">الإجمالي</span><span class="sum-row__v">' + HS.fmt.money(173 * (1 + Number(s.taxRate) / 100)) + '</span></div>' +
          '</div>' +
          (s.showBarcodeOnReceipt ? '<div class="receipt__barcode">' + HS.barcode.svg("INV-2026-0148", { height: 40, moduleWidth: 1.4, fontSize: 10 }) + '</div>' : "") +
          '<div class="receipt__foot">' + HS.esc(s.receiptFooter) + '</div>' +
        '</div>'
      });
    }

    /* ═══════════ ٥) المظهر ═══════════ */
    function appearance() {
      var accents = [
        { id: "emerald", label: "زمردي", swatch: "#0d7a55" },
        { id: "petrol", label: "بترولي", swatch: "#0f6d78" },
        { id: "brick", label: "قرميدي", swatch: "#9c4a35" },
        { id: "olive", label: "زيتوني", swatch: "#5f6f2e" }
      ];
      return '<article class="card"><div class="card__head"><div><h2 class="card__title">المظهر</h2>' +
        '<p class="card__sub">يُطبَّق فورًا ويُحفظ في هذا المتصفح</p></div></div>' +
        '<div class="card__body">' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">السمة</div>' +
        '<div class="setting-row__d">الوضع الداكن يخفّض وهج الشاشة في المحل مساءً.</div></div>' +
        '<div class="setting-row__ctl"><div class="seg" role="group" aria-label="السمة">' +
          '<button type="button" class="seg__btn" data-action="set-theme" data-theme="light" aria-pressed="' + (s.theme !== "dark") + '">' + HS.icon("sun", 15) + ' فاتح</button>' +
          '<button type="button" class="seg__btn" data-action="set-theme" data-theme="dark" aria-pressed="' + (s.theme === "dark") + '">' + HS.icon("moon", 15) + ' داكن</button>' +
        '</div></div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">كثافة الواجهة</div>' +
        '<div class="setting-row__d">«مضغوط» يعرض صفوفًا أكثر في الجدول — مناسب للشاشات الصغيرة وسرعة العمل.</div></div>' +
        '<div class="setting-row__ctl"><div class="seg" role="group" aria-label="الكثافة">' +
          '<button type="button" class="seg__btn" data-action="set-density" data-density="cozy" aria-pressed="' + (s.density !== "compact") + '">مريح</button>' +
          '<button type="button" class="seg__btn" data-action="set-density" data-density="compact" aria-pressed="' + (s.density === "compact") + '">مضغوط</button>' +
        '</div></div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">اللون الأساسي</div>' +
        '<div class="setting-row__d">يؤثر على الأزرار والروابط والمخططات مع الحفاظ على تباين كافٍ للقراءة.</div></div>' +
        '<div class="setting-row__ctl"><div class="swatches">' +
          accents.map(function (a) {
            return '<button type="button" class="swatch" data-action="set-accent" data-accent="' + a.id + '" aria-pressed="' + ((s.accent || "emerald") === a.id) + '" ' +
              'aria-label="اللون ' + a.label + '" title="' + a.label + '" style="--sw:' + a.swatch + '"></button>';
          }).join("") +
        '</div></div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">اختصارات لوحة المفاتيح</div>' +
        '<div class="setting-row__d">تُعطّل كل الاختصارات إن كانت تتعارض مع قارئ شاشة أو إضافة في متصفحك.</div></div>' +
        '<div class="setting-row__ctl">' + HS.ui.field({ name: "shortcuts", type: "switch", value: s.shortcuts !== false, checkLabel: "مفعّلة", attrs: ' data-set-flag="shortcuts"' }) + '</div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">الحركات والانتقالات</div>' +
        '<div class="setting-row__d">إيقافها يحترم أيضًا تفضيل النظام «تقليل الحركة».</div></div>' +
        '<div class="setting-row__ctl">' + HS.ui.field({ name: "motion", type: "switch", value: s.motion !== false, checkLabel: "مفعّلة", attrs: ' data-set-flag="motion"' }) + '</div></div>' +

        '</div></article>';
    }

    /* ═══════════ ٦) البيانات ═══════════ */
    function dataSection() {
      var size = HS.store.storageSize();
      return '<article class="card"><div class="card__head"><div><h2 class="card__title">البيانات المحلية</h2>' +
        '<p class="card__sub">كل شيء محفوظ في هذا المتصفح — لا خادم ولا حساب سحابي</p></div></div>' +
        '<div class="card__body">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("حجم البيانات", HS.fmt.num(Math.round(size / 1024)) + " ك.ب", "في تخزين المتصفح") +
          HS.ui.statMini("الأصناف", HS.fmt.int(st.products.length), HS.fmt.int(st.categories.length) + " أقسام") +
          HS.ui.statMini("الفواتير", HS.fmt.int(st.sales.filter(function (x) { return x.status !== "held"; }).length), HS.fmt.int(st.movements.length) + " حركة مخزون") +
          HS.ui.statMini("العملاء والموردون", HS.fmt.int(st.customers.length + st.suppliers.length), HS.fmt.int(st.users.length) + " مستخدمون") +
          HS.ui.statMini("أُنشئت البيانات", HS.fmt.rel(st.generatedAt), "مرساة " + HS.fmt.date(st.anchorDate)) +
        '</div>' +
        '<div class="row-wrap" style="margin-block-start:var(--sp-5)">' +
          '<button type="button" class="btn btn--secondary" data-action="set-export-json"><span class="btn__icon">' + HS.icon("download", 16) + '</span><span class="btn__label">تنزيل نسخة احتياطية (JSON)</span></button>' +
          '<label class="btn btn--secondary"><span class="btn__icon">' + HS.icon("upload", 16) + '</span><span class="btn__label">استيراد نسخة</span>' +
            '<input type="file" accept="application/json,.json" id="importFile" class="sr-only"></label>' +
          '<button type="button" class="btn btn--secondary" data-action="set-regen"><span class="btn__icon">' + HS.icon("refresh", 16) + '</span><span class="btn__label">توليد بيانات جديدة</span></button>' +
        '</div>' +
        '<div class="alert alert--neutral" style="margin-block-start:var(--sp-4)">' + HS.icon("info", 16) +
          '<span>تنظيف بيانات المتصفح أو استخدام وضع التصفح الخاص يحذف كل شيء. نزّل نسخة احتياطية بين الحين والآخر.</span></div>' +
        '</div></article>' +

        '<article class="card danger-zone"><div class="card__head"><div><h2 class="card__title">منطقة الخطر</h2>' +
        '<p class="card__sub">عمليات لا يمكن التراجع عنها بعد تنفيذها</p></div></div>' +
        '<div class="card__body">' +
        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">إعادة توليد البيانات التجريبية</div>' +
        '<div class="setting-row__d">ينشئ مجموعة جديدة كليًا (مبيعات ومخزون وعملاء) ويحذف ما أضفته. الإعدادات تبقى كما هي.</div></div>' +
        '<div class="setting-row__ctl"><button type="button" class="btn btn--secondary" data-action="set-reset-keep" ' + (canManage ? "" : "disabled") + '>إعادة التوليد</button></div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">إعادة ضبط النظام بالكامل</div>' +
        '<div class="setting-row__d">يعيد كل شيء إلى حالة المصنع: البيانات والإعدادات والمظهر.</div></div>' +
        '<div class="setting-row__ctl"><button type="button" class="btn btn--danger-soft" data-action="set-reset-all" ' + (canManage ? "" : "disabled") + '>إعادة الضبط</button></div></div>' +

        '<div class="setting-row"><div class="setting-row__body"><div class="setting-row__k">مسح كل البيانات من المتصفح</div>' +
        '<div class="setting-row__d">يحذف التخزين المحلي ويغلق الجلسة. عند إعادة الفتح تُولَّد بيانات تجريبية جديدة.</div></div>' +
        '<div class="setting-row__ctl"><button type="button" class="btn btn--danger" data-action="set-wipe" ' + (canManage ? "" : "disabled") + '>مسح نهائي</button></div></div>' +
        '</div></article>';
    }

    /* ═══════════ ٧) عن النظام ═══════════ */
    function about() {
      var shortcuts = [
        ["/", "التركيز على البحث في أي شاشة"],
        ["Ctrl/⌘ + K", "فتح البحث العام"],
        ["N · D · P · S", "نقطة البيع · لوحة التحكم · الأصناف · المبيعات"],
        ["I · R", "المخزون · التقارير"],
        ["T", "تبديل السمة الفاتحة/الداكنة"],
        ["[", "طيّ الشريط الجانبي أو فرده"],
        ["Esc", "إغلاق النافذة أو القائمة المفتوحة"]
      ];
      return '<article class="card"><div class="card__head"><div><h2 class="card__title">' + HS.esc(HS.STORE_NAME) + '</h2>' +
        '<p class="card__sub">نظام إدارة متجر ونقطة بيع يعمل بالكامل في المتصفح' +
        (s.activity ? ' · ' + HS.esc(s.activity) : "") + '</p></div>' +
        HS.ui.badge("الإصدار " + HS.VERSION, "badge--primary") +
        '</div><div class="card__body">' +
        '<div class="grid-main" style="gap:var(--sp-5)">' +
          '<div class="stack">' +
            '<p class="fs-md text-2" style="line-height:var(--lh-loose)">نظام متكامل لإدارة المبيعات والمخزون والمشتريات والعملاء والمصروفات، ' +
            'مبني بـ HTML وCSS وJavaScript خالصة بلا أي إطار عمل ولا خطوة بناء ولا خادم. ' +
            'افتح <code>index.html</code> مباشرة أو ارفعه على أي استضافة ثابتة وسيعمل كما هو.</p>' +
            HS.ui.kv([
              ["الواجهة", "عربية بالكامل، اتجاه من اليمين إلى اليسار"],
              ["البيانات", "تجريبية مولّدة محليًا ببذرة ثابتة — لا خادم ولا قاعدة بيانات"],
              ["التخزين", "localStorage في هذا المتصفح فقط"],
              ["المصادقة", "واجهة فقط: أي كلمة من 4 أحرف فأكثر تُقبل"],
              ["الرسوم البيانية", "SVG مرسومة يدويًا بلا مكتبات"],
              ["الباركود", "Code 128-B وEAN-13 مولّدة محليًا"],
              ["الخط", "IBM Plex Sans Arabic مع بديل من خطوط النظام"],
              ["العملة", HS.esc(s.currency) + " (" + HS.esc(s.currencyCode) + ") — " + HS.fmt.int(s.decimals) + " خانات عشرية"]
            ]) +
          '</div>' +
          '<div class="stack">' +
            '<h3 class="fs-md fw-600">اختصارات لوحة المفاتيح</h3>' +
            '<div class="list">' + shortcuts.map(function (k) {
              return '<div class="list__item" style="padding-block:var(--sp-2)">' +
                '<kbd class="kbd">' + HS.esc(k[0]) + '</kbd>' +
                '<span class="list__body"><span class="list__title" style="font-weight:400">' + HS.esc(k[1]) + '</span></span></div>';
            }).join("") + '</div>' +
            '<h3 class="fs-md fw-600" style="margin-block-start:var(--sp-4)">ما لا يفعله هذا النظام</h3>' +
            '<ul class="bullets fs-sm text-2">' +
              '<li>لا يتصل بأي خادم ولا يرسل بياناتك إلى أي جهة.</li>' +
              '<li>لا يخزّن كلمات مرور ولا يتحقق من هوية حقيقية.</li>' +
              '<li>لا يشغّل طابعة أو درج نقود أو قارئ باركود فعليًا — الطباعة عبر نافذة المتصفح، والمسح محاكاة أو إدخال يدوي.</li>' +
              '<li>لا يزامن البيانات بين الأجهزة؛ استخدم النسخة الاحتياطية JSON للنقل.</li>' +
            '</ul>' +
          '</div>' +
        '</div></div></article>';
    }

    /* ═══════════ مساعد البطاقة ═══════════ */
    function formCard(o) {
      return '<article class="card"><div class="card__head"><div><h2 class="card__title">' + HS.esc(o.title) + '</h2>' +
        '<p class="card__sub">' + HS.esc(o.sub) + '</p></div></div>' +
        '<div class="card__body"><form id="settingsForm" novalidate><div class="grid-main" style="gap:var(--sp-5);align-items:start">' +
          '<div>' + o.fields + '</div>' +
          (o.preview ? '<div><div class="fs-xs text-3 fw-600" style="margin-block-end:var(--sp-2)">معاينة حيّة</div>' + o.preview + '</div>' : "") +
        '</div></form></div>' +
        '<div class="card__foot spread">' +
          '<span class="fs-xs text-3" id="settingsHint">لم تُجرَ تغييرات</span>' +
          '<div class="row-2">' +
            '<button type="button" class="btn btn--secondary" data-action="set-revert">تراجع</button>' +
            '<button type="button" class="btn btn--primary" data-action="' + o.action + '" id="settingsSave" ' + (canManage ? "" : "disabled") + '>' +
            '<span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">حفظ التغييرات</span></button>' +
          '</div>' +
        '</div></article>';
    }
  };

  /* ═══════════ الربط ═══════════ */
  function bindForms(root, sec) {
    var form = root.querySelector("#settingsForm");
    if (!form) {
      /* أقسام بلا نموذج: المظهر والبيانات وعن النظام */
      root.querySelectorAll("[data-set-flag]").forEach(function (el) {
        el.addEventListener("change", function () {
          var patch = {};
          patch[el.getAttribute("data-set-flag")] = el.checked;
          HS.store.updateSettings(patch);
          if (el.getAttribute("data-set-flag") === "motion") document.body.setAttribute("data-motion", el.checked ? "on" : "off");
          HS.ui.toast({ type: "success", icon: "check", title: "حُفظ التغيير", duration: 2000 });
        });
      });
      var file = root.querySelector("#importFile");
      if (file) file.addEventListener("change", function () { importFromFile(file); });
      return;
    }

    var hint = root.querySelector("#settingsHint");
    form.addEventListener("input", function () {
      if (hint) { hint.textContent = "تغييرات غير محفوظة"; hint.className = "fs-xs text-warning fw-600"; }
    });
    form.addEventListener("submit", function (ev) { ev.preventDefault(); });
    form.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" && ev.target.tagName !== "TEXTAREA") {
        ev.preventDefault();
        var btn = root.querySelector("#settingsSave");
        if (btn && !btn.disabled) btn.click();
      }
    });
  }

  function collect(form) {
    var vals = HS.ui.formValues(form);
    var out = {};
    Object.keys(vals).forEach(function (k) {
      var v = vals[k];
      if (typeof v === "string") v = v.trim();
      out[k] = v;
    });
    return out;
  }

  function saveSettings(patch, form) {
    HS.store.updateSettings(patch);
    if (form) {
      var hint = form.closest(".card").querySelector("#settingsHint");
      if (hint) { hint.textContent = "حُفظت التغييرات"; hint.className = "fs-xs text-success fw-600"; }
    }
  }

  /**
   * يوائم قيد «الرصيد الافتتاحي» في سجل الصندوق مع الإعداد.
   * إن لم يوجد القيد (بيانات مستوردة مثلًا) يُنشأ في أقدم تاريخ متاح.
   */
  function syncOpeningCash(amount) {
    var st = HS.store.state;
    st.cashEntries = st.cashEntries || [];
    var open = st.cashEntries.filter(function (e) { return e.id === "cash-open"; })[0];
    if (open) {
      if (Math.abs((open.amount || 0) - amount) < 0.0005) return;
      open.amount = amount;
      open.type = "in";
      open.reason = "رصيد افتتاحي للصندوق";
      open._edited = true;
    } else {
      var dates = st.sales.map(function (x) { return x.date; }).concat(st.movements.map(function (m) { return m.date; })).sort();
      st.cashEntries.push({
        id: "cash-open",
        date: HS.date.toStamp(dates.length ? HS.date.addDays(HS.date.toDate(dates[0]), -1) : new Date()),
        type: "in", amount: amount, reason: "رصيد افتتاحي للصندوق",
        userId: st.session.userId || "u-1", _local: true
      });
    }
    HS.store.save();
    HS.bus.emit("cash:change", { reason: "opening" });
  }

  function saveAction(kind) {
    return function (btn) {
      var form = HS.$("#settingsForm");
      if (!form) return;
      HS.ui.clearErrors(form);
      var v = collect(form);

      if (kind === "identity") {
        if (!v.storeName) { HS.ui.fieldError(form, "storeName", "اسم المحل مطلوب — يظهر في كل الشاشات"); HS.ui.focusFirstError(form); return; }
        if (v.phone && String(v.phone).replace(/\D/g, "").length < 9) { HS.ui.fieldError(form, "phone", "رقم الهاتف غير مكتمل"); HS.ui.focusFirstError(form); return; }
        saveSettings({
          storeName: v.storeName, branch: v.branch, activity: v.activity, owner: v.owner, phone: v.phone,
          taxNumber: v.taxNumber, address: v.address, city: v.city, workHours: v.workHours
        }, form);
        HS.app.renderBrand && HS.app.renderBrand();
      }

      if (kind === "financial") {
        var cashOpen = Math.max(0, HS.round(Number(v.cashOpening) || 0, 3));
        var dec = parseInt(v.decimals, 10);
        if (isNaN(dec) || dec < 0 || dec > 3) { HS.ui.fieldError(form, "decimals", "اختر 0 أو 2 أو 3"); HS.ui.focusFirstError(form); return; }
        var tax = Number(v.taxRate);
        if (isNaN(tax) || tax < 0 || tax > 50) { HS.ui.fieldError(form, "taxRate", "النسبة يجب أن تكون بين 0 و50"); HS.ui.focusFirstError(form); return; }
        saveSettings({
          currency: v.currency || "د.ل", currencyCode: (v.currencyCode || "LYD").toUpperCase(),
          decimals: dec, numerals: v.numerals, dateFormat: v.dateFormat, taxRate: tax,
          invoicePrefix: (v.invoicePrefix || "INV").toUpperCase(),
          defaultDiscount: HS.clamp(Number(v.defaultDiscount) || 0, 0, 100),
          maxCreditDays: HS.clamp(Math.round(Number(v.maxCreditDays) || 0), 0, 365),
          cashOpening: cashOpen,
          allowNegativeStock: !!v.allowNegativeStock
        }, form);
        /* الرصيد الافتتاحي ليس رقمًا للعرض فقط: هو أول قيد في سجل الصندوق */
        syncOpeningCash(cashOpen);
      }

      if (kind === "inventory") {
        saveSettings({
          lowStockThreshold: HS.clamp(Math.round(Number(v.lowStockThreshold) || 0), 0, 500),
          reorderMultiple: HS.clamp(Math.round(Number(v.reorderMultiple) || 3), 1, 12),
          showStockAlert: !!v.showStockAlert
        }, form);
      }

      if (kind === "receipt") {
        saveSettings({
          receiptFooter: v.receiptFooter, receiptWidth: v.receiptWidth,
          receiptCopies: HS.clamp(Math.round(Number(v.receiptCopies) || 1), 1, 3),
          showBarcodeOnReceipt: !!v.showBarcodeOnReceipt,
          autoReceiptAfterSale: !!v.autoReceiptAfterSale
        }, form);
      }

      HS.ui.toast({ type: "success", icon: "save", title: "حُفظت الإعدادات", msg: "طُبّقت التغييرات على كل الشاشات." });
      setTimeout(function () { HS.router.refresh(); }, 260);
    };
  }

  HS.action("set-save-identity", saveAction("identity"));
  HS.action("set-save-financial", saveAction("financial"));
  HS.action("set-save-inventory", saveAction("inventory"));
  HS.action("set-save-receipt", saveAction("receipt"));
  HS.action("set-revert", function () { HS.router.refresh(); HS.ui.toast({ type: "info", icon: "undo", title: "أُلغيت التغييرات غير المحفوظة", duration: 2400 }); });

  HS.action("set-theme", function (btn) {
    var t = btn.getAttribute("data-theme");
    HS.store.updateSettings({ theme: t });
    HS.app.applyTheme(t);
    HS.router.refresh();
    HS.ui.toast({ type: "info", icon: t === "dark" ? "moon" : "sun", title: t === "dark" ? "الوضع الداكن" : "الوضع الفاتح", duration: 2000 });
  });
  HS.action("set-density", function (btn) {
    var d = btn.getAttribute("data-density");
    HS.store.updateSettings({ density: d });
    HS.app.applyDensity(d);
    HS.router.refresh();
    HS.ui.toast({ type: "info", icon: "sliders", title: d === "compact" ? "كثافة مضغوطة" : "كثافة مريحة", duration: 2000 });
  });
  HS.action("set-accent", function (btn) {
    var a = btn.getAttribute("data-accent");
    HS.store.updateSettings({ accent: a });
    HS.app.applyAccent(a);
    HS.router.refresh();
    HS.ui.toast({ type: "info", icon: "sparkle", title: "طُبّق اللون الجديد", duration: 2000 });
  });

  HS.action("set-export-json", function () {
    var json = HS.store.exportJSON();
    var ok = HS.download(HS.STORE_NAME.replace(/\s+/g, "-") + "-نسخة-" + HS.date.toISO(new Date()) + ".json", json);
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "database" : "alert", title: ok ? "نُزّلت النسخة الاحتياطية" : "تعذّر التنزيل", msg: ok ? HS.fmt.num(Math.round(json.length / 1024)) + " ك.ب" : "" });
  });

  function importFromFile(input) {
    var f = input.files && input.files[0];
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) {
      HS.ui.toast({ type: "danger", icon: "alert", title: "الملف كبير جدًا", msg: "الحد الأقصى 25 م.ب." });
      input.value = "";
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || "");
      HS.ui.confirm({
        title: "استيراد نسخة احتياطية؟", tone: "warn", icon: "upload", okLabel: "استبدال البيانات",
        html: '<p>سيُستبدل كل ما في المتصفح حاليًا بمحتوى الملف <b>' + HS.esc(f.name) + '</b> (' + HS.fmt.num(Math.round(f.size / 1024)) + ' ك.ب).</p>' +
              '<p class="text-danger fs-sm" style="margin-block-start:var(--sp-2)">نزّل نسخة من بياناتك الحالية أولًا إن كنت تحتاجها.</p>'
      }).then(function (ok) {
        input.value = "";
        if (!ok) return;
        var res = HS.store.importJSON(text);
        if (!res.ok) { HS.ui.toast({ type: "danger", icon: "x-circle", title: "فشل الاستيراد", msg: res.error, duration: 7000 }); return; }
        HS.app.applyTheme(res.state.settings.theme);
        HS.app.applyDensity(res.state.settings.density);
        HS.app.applyAccent(res.state.settings.accent);
        HS.ui.toast({ type: "success", icon: "upload", title: "استُوردت البيانات", msg: HS.fmt.int(res.state.products.length) + " صنفًا و" + HS.fmt.int(res.state.sales.length) + " فاتورة." });
        HS.router.refresh();
      });
    };
    reader.onerror = function () {
      input.value = "";
      HS.ui.toast({ type: "danger", icon: "alert", title: "تعذّرت قراءة الملف" });
    };
    reader.readAsText(f, "utf-8");
  }
  HS.pages.settings.importFromFile = importFromFile;

  HS.action("set-regen", function () {
    HS.ui.confirm({
      title: "توليد بيانات تجريبية جديدة؟", tone: "warn", icon: "refresh", okLabel: "توليد",
      html: '<p>سيُنشأ سجل مبيعات ومخزون وعملاء جديد تمامًا، وتُحذف كل الإضافات التي أجريتها. <b>الإعدادات والمظهر تبقى كما هي.</b></p>'
    }).then(function (ok) {
      if (!ok) return;
      HS.store.reset(true);
      HS.ui.toast({ type: "success", icon: "refresh", title: "وُلّدت بيانات جديدة", msg: HS.fmt.int(HS.store.state.sales.length) + " فاتورة و" + HS.fmt.int(HS.store.state.products.length) + " صنفًا." });
      HS.router.refresh();
    });
  });

  HS.action("set-reset-keep", function () { HS.actions["set-regen"](); });

  HS.action("set-reset-all", function () {
    HS.ui.confirm({
      title: "إعادة ضبط النظام بالكامل؟", danger: true, icon: "alert", okLabel: "إعادة الضبط",
      html: '<p>ستُحذف البيانات <b>والإعدادات</b> ويعود كل شيء إلى حالة المصنع: اسم المحل، العملة، المظهر، وكل السجلات.</p>'
    }).then(function (ok) {
      if (!ok) return;
      HS.store.reset(false);
      var s = HS.store.state.settings;
      HS.app.applyTheme(s.theme); HS.app.applyDensity(s.density); HS.app.applyAccent(s.accent);
      HS.ui.toast({ type: "success", icon: "refresh", title: "أُعيد ضبط النظام" });
      HS.router.go("/");
    });
  });

  HS.action("set-wipe", function () {
    HS.ui.confirm({
      title: "مسح كل البيانات من المتصفح؟", danger: true, icon: "trash", okLabel: "مسح نهائي",
      html: '<p>هذه العملية <b>لا يمكن التراجع عنها</b>. سيُحذف التخزين المحلي وتُغلق الجلسة الحالية.</p>' +
            '<p class="fs-sm text-3" style="margin-block-start:var(--sp-2)">نزّل نسخة احتياطية أولًا إن كنت قد تحتاج هذه البيانات.</p>',
      extra: '<a class="btn btn--secondary btn--sm" href="#" data-action="set-export-json" style="margin-block-start:var(--sp-3)"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تنزيل نسخة احتياطية الآن</span></a>'
    }).then(function (ok) {
      if (!ok) return;
      HS.storage.clear && HS.storage.clear();
      try { localStorage.removeItem("hesham-store:v1"); } catch (e) {}
      HS.store.logout();
      location.hash = "#/login";
      location.reload();
    });
  });
})();
