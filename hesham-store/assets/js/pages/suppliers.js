/* ═══════════════════════════════════════════════════════════
   pages/suppliers.js — دليل الموردين
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 12, sort: "name", dir: "asc" };

  HS.pages.suppliers = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "all";
    var focus = ctx.query.focus || "";
    var canEdit = HS.store.can("purchases_manage");

    HS.ui.setHeader({
      title: "الموردون",
      sub: "بيانات التواصل وشروط السداد وأرصدة الذمم لكل مورد.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "الموردون" }],
      hidePeriod: true
    });

    function stats(s) {
      var pos = st.purchases.filter(function (p) { return p.supplierId === s.id; });
      var received = pos.filter(function (p) { return p.status === "received"; });
      var products = st.products.filter(function (p) { return p.supplierId === s.id; });
      return {
        orders: pos.length,
        received: received.length,
        spend: HS.round(HS.sum(received, function (p) { return p.total; }), 3),
        paid: HS.round(HS.sum(pos, function (p) { return p.paid || 0; }), 3),
        products: products.length,
        last: pos.length ? pos.map(function (p) { return p.date; }).sort().slice(-1)[0] : null,
        leadTime: received.length ? HS.round(HS.avg(received.map(function (p) {
          return Math.max(0, HS.date.daysBetween(p.date, p.receivedAt || p.expectedDate));
        })), 1) : null
      };
    }

    var all = st.suppliers.map(function (s) { return Object.assign({}, s, { _s: stats(s) }); });

    var counts = {
      all: all.length,
      active: all.filter(function (s) { return s.active; }).length,
      owing: all.filter(function (s) { return s.balance > 0; }).length
    };

    var list = all.filter(function (s) {
      if (tab === "active" && !s.active) return false;
      if (tab === "inactive" && s.active) return false;
      if (tab === "owing" && s.balance <= 0) return false;
      if (focus && s.focus !== focus) return false;
      if (ls.q && !HS.matches(s.name + " " + s.contact + " " + s.phone + " " + s.city + " " + HS.store.cat(s.focus).name, ls.q)) return false;
      return true;
    });

    list = HS.sortBy(list, ls.sort === "balance" ? function (s) { return s.balance; }
      : ls.sort === "spend" ? function (s) { return s._s.spend; }
      : ls.sort === "rating" ? function (s) { return s.rating; }
      : ls.sort === "orders" ? function (s) { return s._s.orders; }
      : function (s) { return s.name; }, ls.dir);

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || focus || tab !== "all");

    var tabs = [
      { id: "all", label: "كل الموردين", count: counts.all },
      { id: "active", label: "نشط", count: counts.active },
      { id: "owing", label: "لهم ذمم", count: counts.owing },
      { id: "inactive", label: "موقوف", count: all.filter(function (s) { return !s.active; }).length }
    ];

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("عدد الموردين", HS.fmt.int(counts.all), counts.active + " نشط") +
        HS.ui.statMini("إجمالي المشتريات المستلمة", HS.fmt.money(HS.round(HS.sum(all, function (s) { return s._s.spend; }), 3)), HS.fmt.int(HS.sum(all, function (s) { return s._s.received; })) + " أمرًا") +
        HS.ui.statMini("ذمم مستحقة للموردين", HS.fmt.money(HS.round(HS.sum(all, function (s) { return s.balance; }), 3)), counts.owing + " مورد") +
        HS.ui.statMini("متوسط التقييم", HS.fmt.num(HS.round(HS.avg(all.map(function (s) { return s.rating; })), 1), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " / 5", "من " + HS.fmt.int(all.length) + " تقييمًا") +
        HS.ui.statMini("متوسط مدة التوريد", HS.fmt.num(HS.round(HS.avg(all.map(function (s) { return s._s.leadTime; }).filter(function (v) { return v != null; })), 1), { maximumFractionDigits: 1 }) + " يومًا", "من تاريخ الأمر إلى الاستلام") +
      '</section>' +

      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
        HS.ui.toolbar({
          q: ls.q, placeholder: "بحث بالاسم أو مسؤول التواصل أو الهاتف…",
          filters: HS.ui.select({ name: "focus", label: "التخصص", value: focus, options: [{ value: "", label: "كل التخصصات" }].concat(st.categories.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; })) }) +
            (filtersActive ? '<button type="button" class="chip" data-action="sup-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
          actions:
            '<button type="button" class="btn btn--sm btn--secondary" data-action="sup-export"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
            (canEdit ? '<button type="button" class="btn btn--sm btn--primary" data-action="sup-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">مورد جديد</span></button>' : "")
        }) +
        HS.ui.table([
          { key: "name", label: "المورد", sortable: true, render: function (s) {
              return '<span class="row-2"><span class="thumb" aria-hidden="true">🚚</span>' +
                '<span style="min-width:0"><span class="truncate fw-600" style="display:block">' + HS.esc(s.name) + '</span>' +
                '<span class="fs-xs text-3" style="display:block">' + HS.esc(s.contact) + ' · ' + HS.esc(s.city) + '</span></span></span>';
            } },
          { key: "phone", label: "الهاتف", width: "146px", render: function (s) {
              return '<a class="ltr fs-sm" href="tel:' + HS.esc(s.phone) + '">' + HS.esc(HS.ui.phone(s.phone)) + '</a>';
            } },
          { key: "focus", label: "التخصص", width: "164px", render: function (s) {
              var c = HS.store.cat(s.focus);
              return '<span class="fs-sm">' + HS.esc(c.emoji + " " + c.name) + '</span>';
            } },
          { key: "terms", label: "شروط السداد", width: "128px", align: "center", render: function (s) {
              return s.termsDays ? HS.ui.badge("آجل " + HS.fmt.int(s.termsDays) + " يومًا", "badge--outline") : HS.ui.badge("نقدًا", "badge--neutral");
            } },
          { key: "rating", label: "التقييم", sortable: true, width: "116px", align: "center", render: function (s) {
              return '<span class="row-2" title="' + HS.fmt.num(s.rating, { maximumFractionDigits: 1 }) + ' من 5">' + HS.icon("star", 14) +
                '<span class="fw-600 tabular">' + HS.fmt.num(s.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '</span></span>';
            } },
          { key: "orders", label: "الأوامر", sortable: true, align: "num", width: "112px", render: function (s) {
              return HS.fmt.int(s._s.orders) + ' <span class="text-3 fs-xs">/ ' + HS.fmt.int(s._s.products) + ' صنف</span>';
            } },
          { key: "spend", label: "المشتريات", sortable: true, align: "num", width: "132px", render: function (s) { return HS.fmt.money(s._s.spend); } },
          { key: "balance", label: "الرصيد المستحق", sortable: true, align: "num", width: "146px", render: function (s) {
              return s.balance > 0.001
                ? '<span class="fw-700 text-danger">' + HS.fmt.money(s.balance) + '</span>'
                : '<span class="text-success fs-sm">مسدّد</span>';
            } },
          { key: "status", label: "", align: "center", width: "86px", render: function (s) {
              return s.active ? HS.ui.badge("نشط", "badge--success") : HS.ui.badge("موقوف", "badge--neutral");
            } },
          { key: "actions", label: "", align: "center", width: "120px", render: function (s) {
              return '<span class="table__actions">' +
                HS.ui.iconBtn("sup-view", "eye", "عرض البطاقة", { id: s.id }) +
                (canEdit ? HS.ui.iconBtn("sup-po", "truck", "أمر شراء لهذا المورد", { id: s.id }) +
                           HS.ui.iconBtn("sup-menu", "more", "إجراءات", { id: s.id }) : "") +
              '</span>';
            } }
        ], paged, {
          sort: { key: ls.sort, dir: ls.dir },
          rowAttrs: function (s) { return ' data-selectable="true" data-action="sup-view" data-id="' + s.id + '"'; },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "truck",
            title: filtersActive ? "لا موردون مطابقون" : "لا موردون في هذا التبويب",
            text: filtersActive ? "جرّب مصطلحًا آخر أو أزل مرشّح التخصص." : "أضف موردًا لتتمكن من إنشاء أوامر شراء.",
            action: filtersActive
              ? '<button type="button" class="btn btn--secondary btn--sm" data-action="sup-clear">إزالة المرشّحات</button>'
              : (canEdit ? '<button type="button" class="btn btn--primary btn--sm" data-action="sup-new">إضافة مورد</button>' : "")
          }),
          foot: paged.length ? ["", "", "", "", "",
            HS.fmt.int(HS.sum(paged, function (s) { return s._s.orders; })) + " أمرًا",
            HS.fmt.money(HS.sum(paged, function (s) { return s._s.spend; })),
            '<span class="fw-700">' + HS.fmt.money(HS.sum(paged, function (s) { return s.balance; })) + '</span>', "", ""] : null
        }) +
        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);
    var fSel = root.querySelector('.toolbar select[name="focus"]');
    if (fSel) fSel.addEventListener("change", function () { ctx.setQuery({ focus: fSel.value || null, page: null }); });
  };

  /* ═══════════ النموذج ═══════════ */
  function supplierForm(s) {
    var st = HS.store.state;
    var isNew = !s;
    var v = s || { name: "", contact: "", phone: "", city: st.settings.city || "طرابلس", focus: st.categories[0].id, rating: 4, termsDays: 0, balance: 0, active: true };

    var m = HS.ui.modal({
      title: isNew ? "إضافة مورد" : "تعديل بيانات المورد",
      sub: isNew ? "سيظهر في قائمة الموردين عند إنشاء أوامر الشراء" : v.name,
      size: "lg",
      body: '<div class="form-grid">' +
        HS.ui.field({ name: "name", label: "اسم المورد / الشركة", value: v.name, required: true, span2: true, attrs: ' data-autofocus autocomplete="organization"', placeholder: "مثال: شركة الأفق للاتصالات والتقنية" }) +
        HS.ui.field({ name: "contact", label: "مسؤول التواصل", value: v.contact, autocomplete: "name", placeholder: "اسم الشخص" }) +
        HS.ui.field({ name: "phone", label: "رقم الهاتف", value: v.phone, attrs: ' dir="ltr" autocomplete="tel" inputmode="tel"', placeholder: "0913000000" }) +
        HS.ui.field({ name: "city", label: "المدينة", type: "select", value: v.city, options: HS.data.CITIES.map(function (c) { return { value: c, label: c }; }) }) +
        HS.ui.field({ name: "focus", label: "التخصص الرئيسي", type: "select", value: v.focus, options: st.categories.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; }) }) +
        HS.ui.field({ name: "termsDays", label: "مدة السداد الآجل (أيام)", type: "number", value: v.termsDays, min: 0, max: 180, step: 1, inputmode: "numeric", hint: "صفر تعني الدفع نقدًا عند الاستلام" }) +
        HS.ui.field({ name: "rating", label: "التقييم", type: "number", value: v.rating, min: 1, max: 5, step: "0.5", inputmode: "decimal", suffix: "/ 5" }) +
        HS.ui.field({ name: "balance", label: "الرصيد الافتتاحي المستحق", type: "number", value: v.balance, min: 0, step: "0.001", suffix: st.settings.currency, inputmode: "decimal", hint: "ذمم سابقة على بدء الاستخدام" }) +
        '<div class="field span-2">' + HS.ui.field({ name: "active", type: "switch", value: v.active, checkLabel: "المورد نشط ويمكن إنشاء أوامر شراء له" }) + '</div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="supSave"><span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">' + (isNew ? "إضافة المورد" : "حفظ التعديلات") + '</span></button>'
    });

    m.root.querySelector("#supSave").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      if (!String(vals.name).trim()) { HS.ui.fieldError(m.body, "name", "اسم المورد مطلوب"); ok = false; }
      var digits = String(vals.phone).replace(/\D/g, "");
      if (vals.phone && (digits.length < 9 || digits.length > 11)) { HS.ui.fieldError(m.body, "phone", "رقم الهاتف غير مكتمل (9–11 رقمًا)"); ok = false; }
      var dup = st.suppliers.filter(function (x) { return (!s || x.id !== s.id) && HS.normalizeAr(x.name) === HS.normalizeAr(String(vals.name).trim()); })[0];
      if (dup) { HS.ui.fieldError(m.body, "name", "يوجد مورد بنفس الاسم"); ok = false; }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }

      var res = HS.store.saveSupplier({
        name: String(vals.name).trim(), contact: vals.contact, phone: vals.phone,
        city: vals.city, focus: vals.focus, termsDays: Math.max(0, Math.round(Number(vals.termsDays) || 0)),
        rating: Math.min(5, Math.max(1, Number(vals.rating) || 4)),
        balance: HS.round(Number(vals.balance) || 0, 3),
        active: vals.active
      }, s ? s.id : null);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({ type: "success", icon: isNew ? "plus" : "check", title: (isNew ? "أُضيف المورد " : "حُدّث ") + "«" + res.record.name + "»" });
      HS.router.refresh();
    });
  }

  /* ═══════════ الإجراءات ═══════════ */
  HS.action("sup-new", function () { supplierForm(null); });
  HS.action("sup-edit", function (btn) {
    HS.ui.closePop();
    var s = HS.store.supplier(btn.getAttribute("data-id"));
    if (s) supplierForm(s);
  });
  HS.action("sup-view", function (btn) {
    var s = HS.store.supplier(btn.getAttribute("data-id"));
    if (!s) return;
    var st = HS.store.state;
    var pos = st.purchases.filter(function (p) { return p.supplierId === s.id; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var prods = st.products.filter(function (p) { return p.supplierId === s.id; });
    var received = pos.filter(function (p) { return p.status === "received"; });
    var spend = HS.round(HS.sum(received, function (p) { return p.total; }), 3);
    var paid = HS.round(HS.sum(pos, function (p) { return p.paid || 0; }), 3);

    HS.ui.modal({
      title: s.name,
      sub: s.contact + " · " + s.city,
      size: "lg",
      body: '<div class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("الأوامر", HS.fmt.int(pos.length), received.length + " مُستلم") +
          HS.ui.statMini("قيمة المشتريات", HS.fmt.money(spend), "المدفوع " + HS.fmt.money(paid)) +
          HS.ui.statMini("الرصيد المستحق", HS.fmt.money(s.balance), s.termsDays ? "آجل " + s.termsDays + " يومًا" : "نقدًا") +
          HS.ui.statMini("الأصناف المورّدة", HS.fmt.int(prods.length), "في الكتالوج") +
        '</div>' +
        HS.ui.kv([
          ["الهاتف", '<a class="ltr" href="tel:' + HS.esc(s.phone) + '">' + HS.esc(HS.ui.phone(s.phone)) + '</a>'],
          ["التخصص", HS.esc(HS.store.cat(s.focus).emoji + " " + HS.store.cat(s.focus).name)],
          ["التقييم", HS.fmt.num(s.rating, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " من 5"],
          ["الحالة", s.active ? HS.ui.badge("نشط", "badge--success") : HS.ui.badge("موقوف", "badge--neutral")],
          ["مسجّل منذ", HS.fmt.date(s.createdAt)]
        ]) +
        '<section><h3 class="fs-md fw-600" style="margin-block-end:var(--sp-2)">أوامر الشراء</h3>' +
        (pos.length ? '<div class="card" style="box-shadow:none"><div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "number", label: "الرقم", width: "150px", render: function (p) { return '<span class="ltr fw-600">' + HS.esc(p.number) + '</span>'; } },
            { key: "date", label: "التاريخ", width: "124px", render: function (p) { return HS.fmt.date(p.date); } },
            { key: "items", label: "الأصناف", align: "num", width: "88px", render: function (p) { return HS.fmt.int(p.items.length); } },
            { key: "total", label: "القيمة", align: "num", width: "126px", render: function (p) { return HS.fmt.money(p.total); } },
            { key: "status", label: "الحالة", align: "center", render: function (p) { return HS.ui.poStatus(p.status); } }
          ], pos.slice(0, 12)) + '</div></div>' +
          (pos.length > 12 ? '<p class="fs-xs text-3" style="margin-block-start:var(--sp-2)">يعرض آخر 12 أمرًا من أصل ' + HS.fmt.int(pos.length) + '.</p>' : "")
          : HS.ui.empty({ icon: "truck", title: "لا أوامر شراء", text: "لم يُنشأ أي أمر لهذا المورد بعد.", action: '<button type="button" class="btn btn--sm btn--primary" data-action="sup-po" data-id="' + s.id + '">إنشاء أمر شراء</button>' })) +
        '</section>' +
        (prods.length ? '<section><h3 class="fs-md fw-600" style="margin-block:var(--sp-4) var(--sp-2)">أصناف يورّدها</h3>' +
          '<div class="chips">' + prods.slice(0, 14).map(function (p) {
            return '<span class="chip">' + HS.esc(p.emoji || "📦") + ' ' + HS.esc(p.name) + ' <span class="fs-2xs text-3">' + HS.fmt.money(p.cost) + '</span></span>';
          }).join("") + (prods.length > 14 ? '<span class="chip">+' + HS.fmt.int(prods.length - 14) + ' أخرى</span>' : "") + '</div></section>' : "") +
      '</div>',
      footer: '<button type="button" class="btn btn--ghost" data-modal-close>إغلاق</button><span class="grow"></span>' +
        (HS.store.can("purchases_manage") ? '<button type="button" class="btn btn--secondary" data-modal-close data-action="sup-edit" data-id="' + s.id + '"><span class="btn__icon">' + HS.icon("pencil", 15) + '</span><span class="btn__label">تعديل</span></button>' +
        '<button type="button" class="btn btn--primary" data-modal-close data-action="sup-po" data-id="' + s.id + '"><span class="btn__icon">' + HS.icon("truck", 15) + '</span><span class="btn__label">أمر شراء</span></button>' : "")
    });
  });
  HS.action("sup-po", function (btn) {
    HS.ui.closePop();
    var s = HS.store.supplier(btn.getAttribute("data-id"));
    if (!s) return;
    var prods = HS.store.state.products.filter(function (p) { return p.supplierId === s.id; });
    var preset = prods.filter(function (p) { return p.stock <= p.minStock; }).slice(0, 6).map(function (p) {
      return { productId: p.id, qty: Math.max(1, (p.minStock * 3) - p.stock) };
    });
    HS.router.go("/purchases", { tab: null });
    setTimeout(function () { HS.pages.purchases.openForm(null, preset.length ? preset : (prods[0] ? [{ productId: prods[0].id, qty: 10 }] : null)); }, 60);
  });
  HS.action("sup-menu", function (btn) {
    var s = HS.store.supplier(btn.getAttribute("data-id"));
    if (!s) return;
    HS.ui.pop(btn,
      HS.ui.popItem("عرض البطاقة", "eye", "sup-view", { id: s.id }) +
      HS.ui.popItem("أمر شراء جديد", "truck", "sup-po", { id: s.id }) +
      HS.ui.popItem("تعديل البيانات", "pencil", "sup-edit", { id: s.id }) +
      HS.ui.popItem("نسخ رقم الهاتف", "copy", "sup-copy-phone", { id: s.id }) +
      '<div class="pop__sep"></div>' +
      HS.ui.popItem(s.active ? "إيقاف المورد" : "تنشيط المورد", s.active ? "eye-off" : "eye", "sup-toggle", { id: s.id }) +
      HS.ui.popItem("حذف المورد", "trash", "sup-delete", { id: s.id }, "pop__item--danger")
    );
  });
  HS.action("sup-copy-phone", function (btn) {
    var s = HS.store.supplier(btn.getAttribute("data-id"));
    HS.ui.closePop();
    if (!s) return;
    HS.ui.copy(s.phone).then(function (ok) {
      HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "copy" : "alert", title: ok ? "نُسخ الرقم" : "تعذّر النسخ", msg: ok ? HS.ui.phone(s.phone) : "", duration: 2400 });
    });
  });
  HS.action("sup-toggle", function (btn) {
    var id = btn.getAttribute("data-id");
    var s = HS.store.supplier(id);
    if (!s) return;
    HS.ui.closePop();
    HS.store.saveSupplier({ active: !s.active }, id);
    HS.ui.toast({
      type: "info", icon: s.active ? "eye" : "eye-off",
      title: (s.active ? "نُشّط " : "أُوقف ") + "«" + s.name + "»",
      actions: [{ label: "تراجع", onClick: function () { HS.store.saveSupplier({ active: !s.active }, id); HS.router.refresh(); } }]
    });
    HS.router.refresh();
  });
  HS.action("sup-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var s = HS.store.supplier(id);
    if (!s) return;
    HS.ui.closePop();
    var usedBy = HS.store.state.purchases.filter(function (p) { return p.supplierId === id; }).length;
    var prods = HS.store.state.products.filter(function (p) { return p.supplierId === id; }).length;
    HS.ui.confirm({
      title: "حذف «" + s.name + "»؟", danger: true, icon: "trash", okLabel: "حذف",
      html: (usedBy || prods
        ? '<p>هذا المورد مرتبط بـ <b>' + HS.fmt.int(usedBy) + '</b> أمر شراء و<b>' + HS.fmt.int(prods) + '</b> صنفًا في الكتالوج. الحذف يزيله من القوائم لكن الروابط القديمة ستظهر كـ«مورد محذوف».</p>'
        : '<p>لا توجد أوامر شراء أو أصناف مرتبطة بهذا المورد.</p>') +
        (s.balance > 0.001 ? '<p class="text-danger fw-600" style="margin-block-start:var(--sp-2)">لديه رصيد مستحق ' + HS.fmt.money(s.balance) + ' — يُفضَّل تسويته قبل الحذف.</p>' : "")
    }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deleteSupplier(id);
      if (!res.ok) return;
      HS.ui.toast({ type: "success", icon: "trash", title: "حُذف المورد «" + s.name + "»", duration: 6000, actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("sup-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, focus: null, page: null, sort: null, dir: null });
  });
  HS.action("sup-export", function () {
    var st = HS.store.state;
    var rows = st.suppliers.map(function (s) {
      var pos = st.purchases.filter(function (p) { return p.supplierId === s.id; });
      return {
        "الاسم": s.name, "مسؤول التواصل": s.contact, "الهاتف": s.phone, "المدينة": s.city,
        "التخصص": HS.store.cat(s.focus).name, "شروط السداد": s.termsDays ? "آجل " + s.termsDays + " يومًا" : "نقدًا",
        "التقييم": s.rating, "عدد الأوامر": pos.length,
        "قيمة المشتريات": HS.round(HS.sum(pos.filter(function (p) { return p.status === "received"; }), function (p) { return p.total; }), 3),
        "الرصيد المستحق": s.balance, "الحالة": s.active ? "نشط" : "موقوف"
      };
    });
    var ok = HS.download("الموردون-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّر الموردون" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " موردًا" : "" });
  });
})();
