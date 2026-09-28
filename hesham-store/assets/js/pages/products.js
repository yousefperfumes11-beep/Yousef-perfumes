/* ═══════════════════════════════════════════════════════════
   pages/products.js — العطور والأصناف
   كل حجم من نفس العطر صنف مستقل: له باركوده وتكلفته وسعره ورصيده.
   جدول/بطاقات، تبويبات حالة، بحث ومرشّحات (قسم/ماركة/حجم)،
   نموذج إضافة وتعديل مع منع تكرار الباركود، تعديل سريع للرصيد،
   وحذف مع تراجع.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 12, sort: "name", dir: "asc" };
  var UNITS = ["عبوة", "قارورة", "طقم", "علبة", "بخاخ", "قطعة"];
  var SIZE_PRESETS = ["3 مل", "6 مل", "10 مل", "12 مل", "20 مل", "30 مل", "50 مل", "60 مل", "75 مل",
    "80 مل", "90 مل", "100 مل", "105 مل", "125 مل", "150 مل", "200 مل", "250 مل", "500 مل",
    "20 غ", "40 غ", "50 غ"];
  var ADJUST_REASONS = ["زيادة جرد", "نقص جرد", "قارورة مكسورة أو تسريب", "عينة تجريبية (تستر)",
    "نقص وزن — تبخّر", "عيب صناعة — إرجاع للمورد", "مفقود", "هدية ترويجية", "تحويل من فرع"];

  function margin(p) { return p.price > 0 ? (p.price - p.cost) / p.price : 0; }
  function value(p) { return HS.round(p.stock * p.cost, 3); }
  function brandPrefix(name) { return HS.data.brandPrefix(name) || "6250"; }
  /** باركود مقترح غير مستعمل: بادئة الماركة + الحجم + تسلسل */
  function suggestBarcode(brand, sizeNum) {
    var n = HS.store.state.products.length + 1, g = 0, code;
    do {
      code = HS.barcode.ean13(brandPrefix(brand) + String(10000 + (sizeNum || 0)).slice(-4) + String(1000 + n + g).slice(-4));
      g++;
    } while (HS.store.barcodeTaken(code) && g < 900);
    return code;
  }
  /** هل الاسم والحجم معًا مستعملان في صنف آخر؟ */
  function sameNameSize(name, size, exceptId) {
    var n = HS.normalizeAr(String(name || "").trim()), z = HS.normalizeAr(String(size || "").trim());
    return HS.store.state.products.filter(function (x) {
      return x.id !== exceptId && HS.normalizeAr(x.name) === n && HS.normalizeAr(x.size || "") === z;
    })[0] || null;
  }

  HS.pages.products = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "all";
    var cat = ctx.query.cat || "";
    var brand = ctx.query.brand || "";
    var size = ctx.query.size || "";
    var sup = ctx.query.sup || "";
    var view = ctx.query.view || "table";
    var canEdit = HS.store.can("products_edit");

    var brands = HS.store.brands();
    var sizes = HS.store.sizes();

    HS.ui.setHeader({
      title: "العطور والأصناف",
      sub: HS.fmt.int(st.products.length) + " صنفًا · " + HS.fmt.int(brands.length) + " ماركة · " +
           HS.fmt.int(sizes.length) + " حجمًا · قيمة المخزون " + HS.fmt.money(HS.store.inventoryValue()),
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "العطور والأصناف" }],
      hidePeriod: true
    });

    var all = st.products.slice();
    var counts = {
      all: all.length,
      active: all.filter(function (p) { return p.active; }).length,
      inactive: all.filter(function (p) { return !p.active; }).length,
      low: HS.store.lowStock().length,
      out: HS.store.outOfStock().length
    };

    var list = all.filter(function (p) {
      if (tab === "active" && !p.active) return false;
      if (tab === "inactive" && p.active) return false;
      if (tab === "low" && !(p.active && p.stock > 0 && p.stock <= p.minStock)) return false;
      if (tab === "out" && p.stock > 0) return false;
      if (cat && p.category !== cat) return false;
      if (brand && p.brand !== brand) return false;
      if (size && p.size !== size) return false;
      if (sup && p.supplierId !== sup) return false;
      if (ls.q) {
        var supName = p.supplierId ? (HS.store.supplier(p.supplierId) || {}).name || "" : "";
        var hay = p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " +
                  (p.sku || "") + " " + HS.store.cat(p.category).name + " " + supName + " " + (p.unit || "");
        if (!HS.matches(hay, ls.q)) return false;
      }
      return true;
    });

    var keyFn = {
      name: function (p) { return p.name; },
      brand: function (p) { return p.brand || ""; },
      size: function (p) { return p.sizeNum || 0; },
      price: function (p) { return p.price; },
      cost: function (p) { return p.cost; },
      stock: function (p) { return p.stock; },
      value: value,
      margin: margin,
      category: function (p) { return HS.store.cat(p.category).name; }
    }[ls.sort] || function (p) { return p.name; };
    list = HS.sortBy(list, keyFn, ls.dir);

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || cat || brand || size || sup || tab !== "all");

    var tabs = [
      { id: "all", label: "كل الأصناف", count: counts.all },
      { id: "active", label: "نشط", count: counts.active },
      { id: "low", label: "مخزون منخفض", count: counts.low },
      { id: "out", label: "نافد", count: counts.out },
      { id: "inactive", label: "موقوف", count: counts.inactive }
    ];

    var catOptions = [{ value: "", label: "كل الأقسام" }].concat(st.categories.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; }));
    var brandOptions = [{ value: "", label: "كل الماركات" }].concat(brands.map(function (b) {
      return { value: b.name, label: b.name + " (" + HS.fmt.int(b.count) + ")" };
    }));
    var sizeOptions = [{ value: "", label: "كل الأحجام" }].concat(sizes.map(function (z) { return { value: z, label: z }; }));
    var supOptions = [{ value: "", label: "كل الموردين" }].concat(st.suppliers.map(function (s) { return { value: s.id, label: s.name }; }));

    var toolbar = HS.ui.toolbar({
      q: ls.q, placeholder: "بحث بالاسم أو الماركة أو الحجم أو الباركود…",
      filters:
        HS.ui.select({ name: "cat", label: "القسم", value: cat, options: catOptions }) +
        HS.ui.select({ name: "brand", label: "الماركة", value: brand, options: brandOptions }) +
        HS.ui.select({ name: "size", label: "الحجم", value: size, options: sizeOptions }) +
        (sup || view === "table" ? "" : "") +
        (filtersActive ? '<button type="button" class="chip" data-action="prod-clear">' + HS.icon("x", 13) + ' إزالة المرشّحات (' + HS.fmt.int(list.length) + ' نتيجة)</button>' : ""),
      actions:
        '<div class="seg seg--sm" role="group" aria-label="طريقة العرض">' +
          '<button type="button" class="seg__btn" data-action="prod-view" data-view="table" aria-pressed="' + (view === "table") + '" title="عرض جدولي">' + HS.icon("list", 15) + '</button>' +
          '<button type="button" class="seg__btn" data-action="prod-view" data-view="cards" aria-pressed="' + (view === "cards") + '" title="عرض بطاقات">' + HS.icon("grid", 15) + '</button>' +
        '</div>' +
        '<button type="button" class="btn btn--sm btn--secondary" data-action="prod-export"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
        (canEdit ? '<button type="button" class="btn btn--sm btn--primary" data-action="prod-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">صنف جديد</span></button>' : "")
    });

    var body;
    if (view === "cards") {
      body = paged.length
        ? '<div class="prod-cards">' + paged.map(function (p) {
            var c = HS.store.cat(p.category);
            return '<article class="card pcard-lg" data-id="' + p.id + '">' +
              '<div class="card__body">' +
                '<div class="row" style="align-items:flex-start;gap:var(--sp-3)">' +
                  '<span class="thumb thumb--lg" aria-hidden="true">' + (p.emoji || "🧴") + '</span>' +
                  '<div style="min-width:0;flex:1"><div class="fw-600 truncate">' + HS.esc(p.name) + '</div>' +
                  '<div class="fs-xs text-2 truncate">' + HS.esc((p.brand || "بدون ماركة") + (p.size ? " · " + p.size : "")) + '</div>' +
                  '<div class="fs-xs text-3 ltr" style="text-align:right;font-variant-numeric:tabular-nums">' + HS.esc(p.barcode || p.sku || "") + '</div>' +
                  '<div class="fs-xs text-3" style="margin-block-start:2px">' + HS.esc(c.emoji + " " + c.name) + '</div></div>' +
                  (p.active ? "" : HS.ui.badge("موقوف", "badge--neutral")) +
                '</div>' +
                '<div style="margin-block-start:var(--sp-3)">' + HS.ui.kv([
                  ["سعر البيع", '<span class="fw-700">' + HS.fmt.money(p.price) + '</span>'],
                  ["التكلفة", HS.fmt.money(p.cost)],
                  ["هامش الربح", '<span class="' + (margin(p) >= .25 ? "text-success" : margin(p) < .12 ? "text-danger" : "") + '">' + HS.fmt.pct(margin(p), 1) + '</span>'],
                  ["الرصيد", HS.ui.stockBadge(p)]
                ]) + '</div>' +
              '</div>' +
              '<div class="card__foot spread">' +
                '<span class="fs-xs text-3 truncate">' + (p.supplierId ? HS.esc((HS.store.supplier(p.supplierId) || {}).name || "مورد غير محدد") : "بدون مورد") + '</span>' +
                (canEdit ? '<span class="row-2">' +
                  HS.ui.iconBtn("prod-adjust", "layers", "تعديل الرصيد", { id: p.id }) +
                  HS.ui.iconBtn("prod-edit", "pencil", "تعديل", { id: p.id }) +
                  HS.ui.iconBtn("prod-label", "barcode", "طباعة ملصق", { id: p.id }) +
                '</span>' : "") +
              '</div></article>';
          }).join("") + '</div>'
        : emptyState(filtersActive);
    } else {
      body = HS.ui.table([
        { key: "name", label: "العطر / الصنف", sortable: true, render: function (p) {
            return '<span class="row-2" style="gap:var(--sp-3)">' +
              '<span class="thumb" aria-hidden="true">' + (p.emoji || "🧴") + '</span>' +
              '<span style="min-width:0"><span class="fw-600 truncate" style="display:block">' + HS.esc(p.name) + '</span>' +
              (p.size ? '<span class="fs-xs text-2" style="display:block">' + HS.esc(p.size) + '</span>' : "") +
              '</span></span>';
          } },
        { key: "brand", label: "الماركة", sortable: true, width: "140px", render: function (p) {
            return p.brand ? '<span class="truncate fs-sm fw-500">' + HS.esc(p.brand) + '</span>' : '<span class="text-3 fs-sm">—</span>';
          } },
        { key: "category", label: "القسم", sortable: true, width: "132px", render: function (p) {
            var c = HS.store.cat(p.category);
            return '<span class="fs-sm">' + HS.esc(c.emoji + " " + c.name) + '</span>';
          } },
        { key: "barcode", label: "الباركود", width: "132px", render: function (p) {
            return '<span class="fs-xs text-2 ltr" style="display:block;text-align:right;font-variant-numeric:tabular-nums">' + HS.esc(p.barcode || "—") + '</span>';
          } },
        { key: "cost", label: "التكلفة", sortable: true, align: "num", width: "108px", render: function (p) { return HS.fmt.money(p.cost); } },
        { key: "price", label: "سعر البيع", sortable: true, align: "num", width: "114px", render: function (p) { return '<span class="fw-600">' + HS.fmt.money(p.price) + '</span>'; } },
        { key: "margin", label: "الهامش", sortable: true, align: "num", width: "88px", render: function (p) {
            var m = margin(p);
            return '<span class="' + (m >= .25 ? "text-success" : m < .12 ? "text-danger" : "text-2") + '">' + HS.fmt.pct(m, 1) + '</span>';
          } },
        { key: "stock", label: "الرصيد", sortable: true, align: "num", width: "124px", render: function (p) { return HS.ui.stockBadge(p); } },
        { key: "value", label: "قيمة الرصيد", sortable: true, align: "num", width: "124px", render: function (p) { return HS.fmt.money(value(p)); } },
        { key: "status", label: "الحالة", align: "center", width: "88px", render: function (p) {
            return p.active ? HS.ui.badge("نشط", "badge--success") : HS.ui.badge("موقوف", "badge--neutral");
          } },
        { key: "actions", label: "", align: "center", width: "120px", render: function (p) {
            return '<span class="table__actions">' +
              HS.ui.iconBtn("prod-label", "barcode", "طباعة ملصق", { id: p.id }) +
              (canEdit ? HS.ui.iconBtn("prod-adjust", "layers", "تعديل الرصيد", { id: p.id }) +
                       HS.ui.iconBtn("prod-menu", "more", "إجراءات", { id: p.id }) : "") +
              '</span>';
          } }
      ], paged, {
        sort: { key: ls.sort, dir: ls.dir },
        rowAttrs: function (p) { return ' data-id="' + p.id + '"' + (canEdit ? ' data-selectable="true" data-action="prod-edit" data-id="' + p.id + '"' : ""); },
        empty: emptyState(filtersActive),
        foot: paged.length ? ["", "", "", "",
          HS.fmt.money(HS.round(HS.sum(paged, function (p) { return p.cost * p.stock; }), 3)), "", "",
          HS.fmt.int(HS.sum(paged, function (p) { return p.stock; })) + " وحدة",
          '<span class="fw-700">' + HS.fmt.money(HS.round(HS.sum(paged, value), 3)) + '</span>', "", ""] : null
      });
    }

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("أصناف نشطة", HS.fmt.int(counts.active), HS.fmt.int(counts.inactive) + " موقوف") +
        HS.ui.statMini("الماركات", HS.fmt.int(brands.length), HS.fmt.int(sizes.length) + " حجمًا مختلفًا") +
        HS.ui.statMini("قيمة المخزون بالتكلفة", HS.fmt.money(HS.store.inventoryValue()), HS.fmt.int(st.products.length) + " صنف") +
        HS.ui.statMini("قيمة البيع التجزئة", HS.fmt.money(HS.store.retailValue()), "الربح المتوقع " + HS.fmt.money(HS.round(HS.store.retailValue() - HS.store.inventoryValue(), 3))) +
        HS.ui.statMini("تحت الحد الأدنى", HS.fmt.int(counts.low), counts.out + " نافد تمامًا") +
        HS.ui.statMini("متوسط الهامش", HS.fmt.pct(HS.avg(all.map(margin)) || 0, 1), "على كل الكتالوج") +
      '</section>' +
      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
        toolbar + body +
        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    root.querySelectorAll(".toolbar select").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var patch = {}; patch[sel.name] = sel.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });

    function emptyState(f) {
      return HS.ui.empty({
        icon: f ? "search" : "box",
        title: f ? "لا أصناف مطابقة" : "لا أصناف في هذا التبويب",
        text: f ? "جرّب إزالة بعض المرشّحات أو البحث بالاسم أو الماركة أو الباركود." : "أضف صنفًا جديدًا ليظهر في الكتالوج وفي نقطة البيع.",
        action: f
          ? '<button type="button" class="btn btn--secondary btn--sm" data-action="prod-clear">إزالة المرشّحات</button>'
          : (canEdit ? '<button type="button" class="btn btn--primary btn--sm" data-action="prod-new">إضافة صنف</button>' : "")
      });
    }
  };

  /* ═══════════════ النماذج والإجراءات ═══════════════ */

  function productForm(p) {
    var st = HS.store.state;
    var isNew = !p;
    var v = p || {
      name: "", brand: "", size: "", barcode: "", category: st.categories[0].id, unit: "عبوة",
      cost: 0, price: 0, minStock: st.settings.lowStockThreshold, stock: 0, supplierId: "",
      emoji: "🧴", active: true, taxable: true
    };

    /* ماركات مسجّلة + ماركات الكتالوج المرجعي، بلا تكرار */
    var brandNames = (HS.data.BRANDS || []).slice();
    HS.store.brands().forEach(function (b) { if (brandNames.indexOf(b.name) < 0) brandNames.push(b.name); });
    brandNames.sort(function (a, b) { return a.localeCompare(b, "en"); });
    var sizeList = SIZE_PRESETS.slice();
    HS.store.sizes().forEach(function (z) { if (sizeList.indexOf(z) < 0) sizeList.push(z); });
    if (v.size && sizeList.indexOf(v.size) < 0) sizeList.push(v.size);

    var body =
      '<div class="form-grid">' +
        HS.ui.field({ name: "name", label: "اسم العطر / الصنف", value: v.name, required: true, span2: true, placeholder: "مثال: سوفاج أو دو تواليت", attrs: ' data-autofocus autocomplete="off"', hint: "الحجم يُسجَّل في حقل مستقل: كل حجم صنف بباركود ورصيد خاصّين" }) +
        HS.ui.field({ name: "brand", label: "الماركة", value: v.brand, placeholder: "مثال: Dior", attrs: ' autocomplete="off" list="brandList"', hint: "اكتب ماركة جديدة أو اختر من القائمة" }) +
        HS.ui.field({ name: "size", label: "الحجم", value: v.size, placeholder: "مثال: 100 مل", attrs: ' autocomplete="off" list="sizeList"', hint: "مل أو غ — مثال: 50 مل، 100 مل، 40 غ" }) +
        HS.ui.field({ name: "barcode", label: "الباركود (EAN-13)", value: v.barcode || "", span2: true, placeholder: isNew ? "13 رقمًا — يُولَّد تلقائيًا إن تُرك فارغًا" : (v.barcode || ""), hint: "لا يمكن تكرار الباركود بين صنفَين، وكل حجم له باركوده الخاص", attrs: ' dir="ltr" inputmode="numeric" autocomplete="off" maxlength="13" style="text-align:left;font-variant-numeric:tabular-nums;letter-spacing:.06em"' }) +
        '<div class="alert alert--neutral span-2" id="bcBox" role="status">' + HS.icon("info", 16) +
          '<span class="grow" id="bcBoxText">اختر الماركة والحجم ثم ولّد باركودًا مطابقًا لترقيم الماركة.</span>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-action="prod-genbc" style="flex:none">' +
          '<span class="btn__icon">' + HS.icon("barcode", 14) + '</span><span class="btn__label">توليد باركود</span></button>' +
        '</div>' +
        HS.ui.field({ name: "category", label: "القسم", type: "select", value: v.category, options: st.categories.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; }) }) +
        HS.ui.field({ name: "unit", label: "وحدة العدّ", type: "select", value: v.unit || "عبوة", options: (UNITS.indexOf(v.unit) >= 0 ? UNITS : [v.unit].concat(UNITS)).map(function (u) { return { value: u, label: u }; }) }) +
        HS.ui.field({ name: "cost", label: "سعر الشراء (التكلفة)", type: "number", value: v.cost, min: 0, step: "0.001", suffix: st.settings.currency, inputmode: "decimal", hint: "لكل حجم تكلفته الخاصة" }) +
        HS.ui.field({ name: "price", label: "سعر البيع", type: "number", value: v.price, min: 0, step: "0.001", suffix: st.settings.currency, required: true, inputmode: "decimal", hint: "يظهر في نقطة البيع وعلى الملصق" }) +
        HS.ui.field({ name: "minStock", label: "حد التنبيه (الرصيد الأدنى)", type: "number", value: v.minStock, min: 0, step: 1, inputmode: "numeric", hint: "يظهر تنبيه عند النزول تحته" }) +
        HS.ui.field({ name: "stock", label: isNew ? "الرصيد الافتتاحي" : "الرصيد الحالي", type: "number", value: v.stock, min: 0, step: 1, inputmode: "numeric", hint: isNew ? "يُسجَّل كحركة «رصيد افتتاحي»" : "التغيير يُسجَّل كحركة تسوية" }) +
        HS.ui.field({ name: "supplierId", label: "المورد", type: "select", value: v.supplierId || "", placeholder: "بدون مورد", options: st.suppliers.map(function (s) { return { value: s.id, label: s.name }; }) }) +
        HS.ui.field({ name: "emoji", label: "أيقونة الصنف", value: v.emoji, placeholder: "🧴", hint: "رمز تعبيري واحد" }) +
        '<div class="field span-2"><div class="row-2" style="gap:var(--sp-5);flex-wrap:wrap">' +
          HS.ui.field({ name: "active", label: "", type: "switch", value: v.active, checkLabel: "الصنف نشط ويظهر في نقطة البيع" }) +
          HS.ui.field({ name: "taxable", label: "", type: "switch", value: v.taxable, checkLabel: "خاضع للضريبة" }) +
        '</div></div>' +
      '</div>' +
      '<datalist id="brandList">' + brandNames.map(function (b) { return '<option value="' + HS.esc(b) + '"></option>'; }).join("") + '</datalist>' +
      '<datalist id="sizeList">' + sizeList.map(function (z) { return '<option value="' + HS.esc(z) + '"></option>'; }).join("") + '</datalist>' +
      '<div class="alert alert--neutral" id="marginBox" role="status"></div>';

    var m = HS.ui.modal({
      title: isNew ? "إضافة صنف جديد" : "تعديل الصنف",
      sub: isNew ? "البيانات تُحفظ محليًا في هذا المتصفح فقط" : HS.store.label(p),
      size: "lg",
      body: body,
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="saveProduct">' +
              '<span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">' + (isNew ? "إضافة الصنف" : "حفظ التعديلات") + '</span></button>',
      onMount: function (api) {
        var costEl = api.body.querySelector('[name="cost"]');
        var priceEl = api.body.querySelector('[name="price"]');
        var bcEl = api.body.querySelector('[name="barcode"]');
        var box = api.body.querySelector("#marginBox");
        var bcBox = api.body.querySelector("#bcBox");
        var bcText = api.body.querySelector("#bcBoxText");

        function upd() {
          var c = Number(costEl.value) || 0, pr = Number(priceEl.value) || 0;
          if (!pr) { box.className = "alert alert--neutral"; box.innerHTML = HS.icon("info", 16) + "<span>أدخل سعر البيع لرؤية هامش الربح.</span>"; return; }
          var mg = (pr - c) / pr;
          var gain = HS.round(pr - c, 3);
          box.className = "alert " + (mg < 0 ? "alert--danger" : mg < .12 ? "alert--warning" : "alert--success");
          box.innerHTML = HS.icon(mg < 0 ? "alert" : mg < .12 ? "info" : "trending-up", 16) +
            '<span>هامش الربح <b>' + HS.fmt.pct(mg, 1) + '</b> · الربح في الوحدة <b>' + HS.fmt.money(gain) + '</b>' +
            (mg < 0 ? " — البيع بخسارة." : mg < .12 ? " — هامش منخفض، راجع التكلفة أو السعر." : "") + '</span>';
        }

        /* فحص الباركود أثناء الكتابة: الطول والتكرار */
        function updBarcode() {
          var raw = String(bcEl.value || "").trim();
          if (!raw) {
            bcBox.className = "alert alert--neutral";
            bcText.textContent = "اتركه فارغًا ليُولَّد تلقائيًا، أو اكتب 13 رقمًا.";
            HS.ui.clearError(api.body, "barcode");
            return;
          }
          var digits = raw.replace(/[^0-9]/g, "");
          if (digits.length !== 13) {
            bcBox.className = "alert alert--warning";
            bcText.innerHTML = "الباركود <b>" + HS.fmt.int(digits.length) + "</b> رقمًا، والمطلوب 13 رقمًا (EAN-13).";
            return;
          }
          var clash = HS.store.barcodeTaken(digits, p ? p.id : null);
          if (clash) {
            bcBox.className = "alert alert--danger";
            bcText.innerHTML = "هذا الباركود مستعمل في <b>" + HS.esc(HS.store.label(clash)) + "</b> — لا يجوز تكراره.";
            return;
          }
          bcBox.className = "alert alert--success";
          bcText.innerHTML = HS.icon("check-circle", 15) + " <span>الباركود صالح وغير مستعمل.</span>";
        }

        costEl.addEventListener("input", upd);
        priceEl.addEventListener("input", upd);
        bcEl.addEventListener("input", updBarcode);
        upd(); updBarcode();
      }
    });

    m.root.querySelector("#saveProduct").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      var name = String(vals.name || "").trim();
      var size = String(vals.size || "").trim();
      var bc = String(vals.barcode || "").replace(/[^0-9]/g, "");

      if (!name) { HS.ui.fieldError(m.body, "name", "اسم العطر مطلوب"); ok = false; }
      if (!(Number(vals.price) > 0)) { HS.ui.fieldError(m.body, "price", "أدخل سعر بيع أكبر من صفر"); ok = false; }
      if (bc && bc.length !== 13) { HS.ui.fieldError(m.body, "barcode", "الباركود يجب أن يكون 13 رقمًا"); ok = false; }
      if (bc && HS.store.barcodeTaken(bc, p ? p.id : null)) {
        HS.ui.fieldError(m.body, "barcode", "هذا الباركود مستعمل في «" + HS.store.label(HS.store.barcodeTaken(bc, p ? p.id : null)) + "»");
        ok = false;
      }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }

      /* الاسم وحده لا يكفي: نفس العطر بحجم آخر صنف مستقل ومسموح */
      var dup = sameNameSize(name, size, p ? p.id : null);
      if (dup) {
        HS.ui.fieldError(m.body, "size", "يوجد صنف بنفس الاسم والحجم: «" + HS.store.label(dup) + "» — غيّر الحجم أو عدّل الصنف الموجود");
        HS.ui.focusFirstError(m.body);
        return;
      }

      var btn = m.root.querySelector("#saveProduct");
      btn.setAttribute("data-loading", "true");
      HS.sleep(300).then(function () {
        var res = HS.store.saveProduct({
          name: name, brand: vals.brand, size: size, barcode: bc,
          category: vals.category, unit: vals.unit || "عبوة",
          supplierId: vals.supplierId || null, cost: vals.cost, price: vals.price,
          minStock: vals.minStock, stock: vals.stock, emoji: (vals.emoji || "🧴").slice(0, 4),
          active: vals.active, taxable: vals.taxable
        }, p ? p.id : null);
        btn.removeAttribute("data-loading");
        if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
        m.close(true);
        HS.ui.toast({
          type: "success", icon: isNew ? "plus" : "check",
          title: (isNew ? "أُضيف " : "حُدّث ") + "«" + HS.store.label(res.product) + "»",
          msg: isNew
            ? "الرصيد " + HS.fmt.int(res.product.stock) + " " + (res.product.unit || "عبوة") + " · الباركود " + res.product.barcode
            : "سعر البيع " + HS.fmt.money(res.product.price) + " · الباركود " + res.product.barcode
        });
        if (isNew) HS.ui.flash(HS.$('[data-id="' + res.product.id + '"]'));
        else HS.router.refresh();
      });
    });
    return m;
  }

  HS.action("prod-new", function () { productForm(null); });
  HS.action("prod-edit", function (trg) {
    var id = trg.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    if (!HS.store.can("products_edit")) {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا تملك صلاحية التعديل", msg: "اطلب من المدير منحك صلاحية «تعديل المنتجات والأسعار»." });
      return;
    }
    productForm(p);
  });

  /* توليد باركود داخل نموذج الصنف المفتوح */
  HS.action("prod-genbc", function (btn) {
    var modal = btn.closest(".modal");
    if (!modal) return;
    var bcEl = modal.querySelector('[name="barcode"]');
    var brandEl = modal.querySelector('[name="brand"]');
    var sizeEl = modal.querySelector('[name="size"]');
    if (!bcEl) return;
    var sizeNum = Number(String(sizeEl.value || "").replace(/[^0-9.]/g, "")) || 0;
    var code = suggestBarcode(String(brandEl.value || "").trim(), sizeNum);
    bcEl.value = code;
    bcEl.dispatchEvent(new Event("input", { bubbles: true }));
    bcEl.focus();
    var bcBox = modal.querySelector("#bcBox");
    if (bcBox) {
      bcBox.className = "alert alert--info";
      var t = modal.querySelector("#bcBoxText");
      if (t) t.innerHTML = "وُلّد الباركود <b dir=\"ltr\">" + code + "</b> — راجعه ثم احفظ.";
    }
  });

  HS.action("prod-adjust", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    if (!HS.store.can("inventory_adjust")) {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا تملك صلاحية تعديل المخزون" });
      return;
    }
    var m = HS.ui.modal({
      title: "تعديل رصيد «" + HS.store.label(p) + "»",
      sub: "الرصيد الحالي " + HS.fmt.int(p.stock) + " " + (p.unit || "عبوة") + (p.brand ? " · " + p.brand : ""),
      size: "sm",
      body: '<div class="stack">' +
        '<div class="chips">' + [-10, -5, -1, 1, 5, 10, 25, 50].map(function (d) {
          return '<button type="button" class="chip" data-delta="' + d + '">' + (d > 0 ? "+" : "") + HS.fmt.int(d) + '</button>';
        }).join("") + '</div>' +
        '<div class="form-grid">' +
          HS.ui.field({ name: "delta", label: "مقدار التغيير", type: "number", value: 0, step: 1, suffix: p.unit || "عبوة", attrs: ' data-autofocus inputmode="numeric"', hint: "استخدم القيمة السالبة للنقص" }) +
          HS.ui.field({ name: "reason", label: "سبب التعديل", type: "select", value: ADJUST_REASONS[0], options: ADJUST_REASONS.map(function (r) { return { value: r, label: r }; }) }) +
        '</div></div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button><button type="button" class="btn btn--primary" id="doAdjust">تسجيل الحركة</button>'
    });
    var dEl = m.body.querySelector('[name="delta"]');
    m.body.querySelectorAll("[data-delta]").forEach(function (b) {
      b.addEventListener("click", function () { dEl.value = b.getAttribute("data-delta"); dEl.focus(); });
    });
    m.root.querySelector("#doAdjust").addEventListener("click", function () {
      var d = Math.round(Number(dEl.value) || 0);
      var reason = m.body.querySelector('[name="reason"]').value;
      if (!d) { HS.ui.fieldError(m.body, "delta", "أدخل مقدارًا غير صفري"); return; }
      var before = p.stock;
      var res = HS.store.adjustStock(id, d, reason);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر التعديل", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({
        type: "success", icon: "layers",
        title: "حُدّث رصيد «" + HS.store.label(p) + "»",
        msg: HS.fmt.int(before) + " ← " + HS.fmt.int(p.stock) + " " + (p.unit || "عبوة") + " (" + reason + ")",
        actions: [{ label: "تراجع", onClick: function () { HS.store.adjustStock(id, -d, "تراجع عن " + reason); HS.router.refresh(); } }]
      });
      HS.router.refresh();
    });
  });

  HS.action("prod-menu", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    var html =
      HS.ui.popItem("تعديل الصنف", "pencil", "prod-edit", { id: id }) +
      HS.ui.popItem("تعديل الرصيد", "layers", "prod-adjust", { id: id }) +
      HS.ui.popItem("طباعة ملصق باركود", "barcode", "prod-label", { id: id }) +
      HS.ui.popItem("بيع سريع من نقطة البيع", "cart", "prod-sell", { id: id }) +
      '<div class="pop__sep"></div>' +
      HS.ui.popItem(p.active ? "إيقاف الصنف" : "تنشيط الصنف", p.active ? "eye-off" : "eye", "prod-toggle", { id: id }) +
      HS.ui.popItem("حذف الصنف", "trash", "prod-delete", { id: id }, "pop__item--danger");
    HS.ui.pop(btn, html);
  });

  HS.action("prod-sell", function (btn) {
    var id = btn.getAttribute("data-id");
    HS.ui.closePop();
    HS.store.cart.add(id, 1);
    HS.router.go("/pos");
  });

  HS.action("prod-toggle", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    HS.ui.closePop();
    var res = HS.store.saveProduct(Object.assign({}, p, { active: !p.active }), id);
    if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر التغيير", msg: res.error }); return; }
    HS.ui.toast({
      type: "info", icon: p.active ? "eye" : "eye-off",
      title: (p.active ? "نُشّط " : "أُوقف ") + "«" + HS.store.label(p) + "»",
      msg: p.active ? "سيظهر الآن في نقطة البيع." : "لن يظهر في نقطة البيع بعد الآن.",
      actions: [{ label: "تراجع", onClick: function () { HS.store.saveProduct({ active: !p.active }, id); HS.router.refresh(); } }]
    });
    HS.router.refresh();
  });

  HS.action("prod-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    HS.ui.closePop();
    var usedIn = HS.store.state.sales.filter(function (s) {
      return s.items.some(function (i) { return i.productId === id; });
    }).length;
    HS.ui.confirm({
      title: "حذف «" + HS.store.label(p) + "»؟",
      tone: "warn", icon: "trash", okLabel: "حذف نهائي",
      html: '<p>سيُحذف الصنف من الكتالوج ومن نقطة البيع، ويتحرّر باركوده <b dir="ltr">' + HS.esc(p.barcode || "—") + '</b> لإعادة استعماله.</p>' +
        (usedIn ? '<p class="text-warning" style="margin-block-start:var(--sp-2)">' + HS.icon("alert", 15) + ' هذا الصنف وارد في <b>' + HS.fmt.int(usedIn) + '</b> فاتورة سابقة. الحذف لن يغيّر الفواتير القديمة لكنه سيخفي اسم الصنف من تفاصيلها.</p>' : "") +
        (p.stock > 0 ? '<p style="margin-block-start:var(--sp-2)">الرصيد الحالي <b>' + HS.fmt.int(p.stock) + ' ' + HS.esc(p.unit || "عبوة") + '</b> بقيمة <b>' + HS.fmt.money(HS.round(p.stock * p.cost, 3)) + '</b>.</p>' : "")
    }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deleteProduct(id);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحذف" }); return; }
      HS.ui.toast({
        type: "success", icon: "trash", title: "حُذف «" + HS.store.label(p) + "»",
        duration: 6000,
        actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }]
      });
      HS.router.refresh();
    });
  });

  HS.action("prod-label", function (btn) {
    var id = btn.getAttribute("data-id");
    HS.ui.closePop();
    if (HS.pages.barcode && HS.pages.barcode.openLabels) HS.pages.barcode.openLabels([id]);
    else HS.router.go("/barcode", { ids: id });
  });

  HS.action("prod-view", function (btn) { HS.router.setQuery({ view: btn.getAttribute("data-view"), page: null }); });
  HS.action("prod-clear", function () {
    var ctx = HS.router.current();
    if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, cat: null, brand: null, size: null, sup: null, page: null });
  });

  HS.action("prod-export", function () {
    var st = HS.store.state;
    var rows = st.products.map(function (p) {
      return {
        "الباركود": p.barcode || "", "الرمز الداخلي": p.sku || "",
        "اسم العطر": p.name, "الماركة": p.brand || "", "الحجم": p.size || "",
        "القسم": HS.store.cat(p.category).name, "الوحدة": p.unit || "عبوة",
        "سعر الشراء": p.cost, "سعر البيع": p.price,
        "هامش الربح ٪": HS.round(margin(p) * 100, 1),
        "الرصيد": p.stock, "الحد الأدنى": p.minStock,
        "قيمة الرصيد": value(p),
        "المورد": p.supplierId ? (HS.store.supplier(p.supplierId) || {}).name || "" : "",
        "تاريخ الإضافة": p.createdAt ? HS.fmt.date(p.createdAt) : "",
        "الحالة": p.active ? "نشط" : "موقوف"
      };
    });
    var ok = HS.download("العطور-والاصناف-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّر الكتالوج" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " صنفًا" : "" });
  });
})();
