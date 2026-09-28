/* ═══════════════════════════════════════════════════════════
   pages/purchases.js — أوامر الشراء
   قائمة + محرّر أصناف داخل نافذة + استلام (يغذّي المخزون) + سداد.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 12, sort: "date", dir: "desc" };
  var STATUS_LABEL = { draft: "مسودة", shipping: "قيد الشحن", received: "مُستلم", cancelled: "ملغى" };

  HS.pages.purchases = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "all";
    var supplierId = ctx.query.supplier || "";
    var from = ctx.query.from || "";
    var to = ctx.query.to || "";
    var canManage = HS.store.can("purchases_manage");

    HS.ui.setHeader({
      title: "المشتريات",
      sub: "أوامر الشراء من الموردين. الاستلام يضيف الكميات إلى المخزون تلقائيًا.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المشتريات" }],
      hidePeriod: true
    });

    var all = st.purchases.slice();
    var counts = { all: all.length };
    Object.keys(STATUS_LABEL).forEach(function (k) { counts[k] = all.filter(function (p) { return p.status === k; }).length; });

    var list = all.filter(function (p) {
      if (tab !== "all" && p.status !== tab) return false;
      if (supplierId && p.supplierId !== supplierId) return false;
      if (from && HS.date.toDate(p.date) < HS.date.startOfDay(from)) return false;
      if (to && HS.date.toDate(p.date) > HS.date.endOfDay(to)) return false;
      if (ls.q && !HS.matches(p.number + " " + p.supplierName + " " + p.items.map(function (i) { return i.name; }).join(" "), ls.q)) return false;
      return true;
    });

    list = HS.sortBy(list, ls.sort === "total" ? function (p) { return p.total; }
      : ls.sort === "number" ? function (p) { return p.number; }
      : ls.sort === "supplier" ? function (p) { return p.supplierName; }
      : ls.sort === "expected" ? function (p) { return p.expectedDate; }
      : function (p) { return p.date; }, ls.dir);

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || supplierId || from || to || tab !== "all");

    var sums = {
      total: HS.round(HS.sum(list.filter(function (p) { return p.status !== "cancelled"; }), function (p) { return p.total; }), 3),
      paid: HS.round(HS.sum(list, function (p) { return p.paid || 0; }), 3)
    };
    sums.due = HS.round(sums.total - sums.paid, 3);

    var incoming = list.filter(function (p) { return p.status === "shipping"; })
      .reduce(function (n, p) { return n + HS.sum(p.items, function (i) { return i.qty; }); }, 0);

    var tabs = [{ id: "all", label: "الكل", count: counts.all }]
      .concat(Object.keys(STATUS_LABEL).map(function (k) { return { id: k, label: STATUS_LABEL[k], count: counts[k] }; }));

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("قيمة المشتريات", HS.fmt.money(sums.total), HS.fmt.int(list.filter(function (p) { return p.status !== "cancelled"; }).length) + " أمرًا") +
        HS.ui.statMini("المدفوع للموردين", HS.fmt.money(sums.paid), HS.fmt.pct(sums.total ? sums.paid / sums.total : 0, 0) + " من الإجمالي") +
        HS.ui.statMini("مستحق للموردين", HS.fmt.money(sums.due), "ذمم قائمة") +
        HS.ui.statMini("وحدات في الطريق", "+" + HS.fmt.int(incoming), counts.shipping + " أمرًا قيد الشحن") +
        HS.ui.statMini("ذمم الموردين", HS.fmt.money(HS.round(HS.sum(st.suppliers, function (s) { return s.balance; }), 3)), st.suppliers.filter(function (s) { return s.balance > 0; }).length + " مورد") +
      '</section>' +

      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
        HS.ui.toolbar({
          q: ls.q, placeholder: "بحث برقم الأمر أو المورد أو الصنف…",
          filters:
            HS.ui.select({ name: "supplier", label: "المورد", value: supplierId, options: [{ value: "", label: "كل الموردين" }].concat(st.suppliers.map(function (s) { return { value: s.id, label: s.name }; })) }) +
            '<span class="row-2"><input class="input input--sm" type="date" name="from" value="' + HS.esc(from) + '" data-po-filter aria-label="من تاريخ">' +
            '<span class="text-3">—</span>' +
            '<input class="input input--sm" type="date" name="to" value="' + HS.esc(to) + '" data-po-filter aria-label="إلى تاريخ"></span>' +
            (filtersActive ? '<button type="button" class="chip" data-action="po-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
          actions:
            '<button type="button" class="btn btn--sm btn--secondary" data-action="po-export"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
            (canManage ? '<button type="button" class="btn btn--sm btn--primary" data-action="po-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">أمر شراء جديد</span></button>' : "")
        }) +
        HS.ui.table([
          { key: "number", label: "رقم الأمر", sortable: true, width: "150px", render: function (p) {
              return '<span class="fw-600 ltr" style="display:inline-block">' + HS.esc(p.number) + '</span>';
            } },
          { key: "date", label: "تاريخ الأمر", sortable: true, width: "128px", render: function (p) { return HS.fmt.date(p.date); } },
          { key: "expected", label: "الوصول المتوقع", sortable: true, width: "146px", render: function (p) {
              var late = p.status !== "received" && p.status !== "cancelled" && HS.date.toDate(p.expectedDate) < new Date();
              return '<span class="' + (late ? "text-danger fw-600" : "") + '">' + HS.fmt.date(p.expectedDate) + '</span>' +
                (late ? '<span class="fs-2xs text-danger" style="display:block">متأخر ' + HS.fmt.int(HS.date.daysBetween(p.expectedDate, new Date())) + ' يومًا</span>' : "");
            } },
          { key: "supplier", label: "المورد", sortable: true, render: function (p) {
              return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">🚚</span>' +
                '<span class="truncate">' + HS.esc(p.supplierName || "—") + '</span></span>';
            } },
          { key: "items", label: "الأصناف", align: "num", width: "118px", render: function (p) {
              return '<span title="' + HS.esc(p.items.map(function (i) { return i.name + " ×" + i.qty; }).join("، ")) + '">' +
                HS.fmt.int(p.items.length) + ' <span class="text-3 fs-xs">/ ' + HS.fmt.int(HS.sum(p.items, function (i) { return i.qty; })) + '</span></span>';
            } },
          { key: "total", label: "القيمة", sortable: true, align: "num", width: "128px", render: function (p) { return '<span class="fw-700">' + HS.fmt.money(p.total) + '</span>'; } },
          { key: "paid", label: "المدفوع", align: "num", width: "128px", render: function (p) {
              if (p.status === "cancelled") return '<span class="text-3">—</span>';
              var due = HS.round(p.total - (p.paid || 0), 3);
              return '<span>' + HS.fmt.money(p.paid || 0) + '</span>' +
                (due > 0.001 ? '<span class="fs-2xs text-danger" style="display:block">متبقٍ ' + HS.fmt.money(due) + '</span>' : '<span class="fs-2xs text-success" style="display:block">مسدّد</span>');
            } },
          { key: "status", label: "الحالة", align: "center", width: "124px", render: function (p) { return HS.ui.poStatus(p.status); } },
          { key: "actions", label: "", align: "center", width: "120px", render: function (p) {
              var acts = '<span class="table__actions">';
              if (canManage && p.status !== "received" && p.status !== "cancelled") acts += HS.ui.iconBtn("po-receive", "box-check", "استلام وتغذية المخزون", { id: p.id });
              if (canManage && p.status !== "cancelled" && p.total - (p.paid || 0) > 0.001) acts += HS.ui.iconBtn("po-pay", "cash", "تسجيل دفعة", { id: p.id });
              acts += HS.ui.iconBtn("po-menu", "more", "إجراءات", { id: p.id }) + '</span>';
              return acts;
            } }
        ], paged, {
          sort: { key: ls.sort, dir: ls.dir },
          rowAttrs: function (p) { return ' data-selectable="true" data-action="po-view" data-id="' + p.id + '"'; },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "truck",
            title: filtersActive ? "لا أوامر مطابقة" : "لا أوامر شراء في هذا التبويب",
            text: filtersActive ? "أزل بعض المرشّحات أو وسّع نطاق التاريخ." : "أنشئ أمر شراء لتتبّع البضاعة القادمة من الموردين.",
            action: filtersActive
              ? '<button type="button" class="btn btn--secondary btn--sm" data-action="po-clear">إزالة المرشّحات</button>'
              : (canManage ? '<button type="button" class="btn btn--primary btn--sm" data-action="po-new">أمر شراء جديد</button>' : "")
          }),
          foot: paged.length ? ["", "", "", "",
            HS.fmt.int(HS.sum(paged, function (p) { return HS.sum(p.items, function (i) { return i.qty; }); })) + " وحدة",
            '<span class="fw-700">' + HS.fmt.money(HS.sum(paged, function (p) { return p.total; })) + '</span>',
            HS.fmt.money(HS.sum(paged, function (p) { return p.paid || 0; })), "", ""] : null
        }) +
        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    root.querySelectorAll("[data-po-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {}; patch[el.name] = el.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
    var supSel = root.querySelector('.toolbar select[name="supplier"]');
    if (supSel) supSel.addEventListener("change", function () { ctx.setQuery({ supplier: supSel.value || null, page: null }); });
  };

  /* ═══════════════ محرّر أمر الشراء ═══════════════ */
  function poForm(po, presetLines) {
    var st = HS.store.state;
    var isNew = !po;
    var items = po ? po.items.map(function (l) { return { productId: l.productId, name: l.name, qty: l.qty, cost: l.cost }; })
                   : (presetLines || []).map(function (l) {
                       var p = HS.store.product(l.productId);
                       return { productId: l.productId, name: p ? p.name : "", qty: l.qty || 1, cost: p ? p.cost : 0 };
                     });

    var products = st.products.slice().sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); });

    var m = HS.ui.modal({
      title: isNew ? "أمر شراء جديد" : "تعديل الأمر " + po.number,
      sub: isNew ? "أضف الأصناف المطلوبة وكمياتها وتكلفة كل وحدة" : "الحالة الحالية: " + STATUS_LABEL[po.status],
      size: "lg",
      body:
        '<div class="stack">' +
          '<div class="form-grid">' +
            HS.ui.field({ name: "supplierId", label: "المورد", type: "select", value: po ? po.supplierId : "", required: true, placeholder: "اختر موردًا", options: st.suppliers.filter(function (s) { return s.active; }).map(function (s) { return { value: s.id, label: s.name + (s.termsDays ? " (آجل " + s.termsDays + " يومًا)" : "") }; }) }) +
            HS.ui.field({ name: "date", label: "تاريخ الأمر", type: "date", value: po ? po.date : HS.date.toISO(new Date()), required: true }) +
            HS.ui.field({ name: "expectedDate", label: "تاريخ الوصول المتوقع", type: "date", value: po ? po.expectedDate : HS.date.toISO(HS.date.addDays(new Date(), 6)) }) +
            HS.ui.field({ name: "status", label: "الحالة", type: "select", value: po ? po.status : "draft", options: Object.keys(STATUS_LABEL).filter(function (k) { return k !== "received" || !isNew; }).map(function (k) { return { value: k, label: STATUS_LABEL[k] }; }), hint: "الاستلام يُنفَّذ من زر «استلام» ليضيف الكميات للمخزون" }) +
            HS.ui.field({ name: "note", label: "ملاحظات", type: "textarea", value: po ? po.note : "", rows: 2, span2: true, placeholder: "شروط التسليم، رقم عرض السعر، ملاحظات للمورد…" }) +
          '</div>' +

          '<div class="card" style="box-shadow:none"><div class="card__head">' +
            '<div><h3 class="card__title">أصناف الأمر</h3><p class="card__sub" id="poLinesInfo"></p></div>' +
            '<button type="button" class="btn btn--sm btn--soft" id="poAddLine"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">إضافة صنف</span></button>' +
          '</div><div class="card__body card__body--flush">' +
            '<div id="poLines"></div>' +
          '</div><div class="card__foot spread">' +
            '<button type="button" class="btn btn--sm btn--ghost" id="poFillLow"><span class="btn__icon">' + HS.icon("alert", 15) + '</span><span class="btn__label">تعبئة من النواقص</span></button>' +
            '<span class="fw-700 fs-lg tabular" id="poTotal"></span>' +
          '</div></div>' +
        '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="poSave"><span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">' + (isNew ? "حفظ الأمر" : "حفظ التعديلات") + '</span></button>'
    });

    var linesBox = m.body.querySelector("#poLines");
    var totalBox = m.body.querySelector("#poTotal");
    var infoBox = m.body.querySelector("#poLinesInfo");

    function lineRow(l, idx) {
      return '<div class="po-line" data-idx="' + idx + '">' +
        '<select class="select select--sm po-line__prod" aria-label="الصنف">' +
          '<option value="">اختر صنفًا…</option>' +
          products.map(function (p) {
            return '<option value="' + p.id + '"' + (p.id === l.productId ? " selected" : "") + '>' + HS.esc(HS.store.label(p)) + (p.brand ? " — " + HS.esc(p.brand) : "") + '</option>';
          }).join("") +
        '</select>' +
        '<input class="input input--sm input--num po-line__qty" type="number" min="1" step="1" value="' + HS.fmt.int(l.qty || 1) + '" aria-label="الكمية" inputmode="numeric" placeholder="الكمية">' +
        '<input class="input input--sm input--num po-line__cost" type="number" min="0" step="0.001" value="' + (l.cost || 0) + '" aria-label="تكلفة الوحدة" inputmode="decimal" placeholder="التكلفة">' +
        '<span class="po-line__sum tabular" data-sum></span>' +
        '<button type="button" class="icon-btn icon-btn--sm icon-btn--danger po-line__del" aria-label="حذف السطر" title="حذف السطر">' + HS.icon("trash", 15) + '</button>' +
      '</div>';
    }

    function renderLines() {
      if (!items.length) {
        linesBox.innerHTML = '<div style="padding:var(--sp-6)">' + HS.ui.empty({
          icon: "box", title: "لا أصناف في الأمر",
          text: "أضف صنفًا يدويًا أو عبّئ القائمة من الأصناف الناقصة في المخزون.",
          action: '<button type="button" class="btn btn--sm btn--primary" id="poAddLineEmpty"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">إضافة صنف</span></button>'
        }) + '</div>';
        var b = linesBox.querySelector("#poAddLineEmpty");
        if (b) b.addEventListener("click", addLine);
      } else {
        linesBox.innerHTML =
          '<div class="po-line po-line--head" aria-hidden="true"><span>الصنف</span><span>الكمية</span><span>تكلفة الوحدة</span><span>الإجمالي</span><span></span></div>' +
          items.map(lineRow).join("");
      }
      bind();
      updateTotals();
      HS.icons.hydrate(linesBox);
    }

    function bind() {
      linesBox.querySelectorAll(".po-line").forEach(function (row) {
        var idx = parseInt(row.getAttribute("data-idx"), 10);
        var sel = row.querySelector(".po-line__prod");
        var qty = row.querySelector(".po-line__qty");
        var cost = row.querySelector(".po-line__cost");
        var del = row.querySelector(".po-line__del");
        if (!sel) return;
        sel.addEventListener("change", function () {
          var p = HS.store.product(sel.value);
          items[idx] = { productId: sel.value, name: p ? p.name : "", qty: Number(qty.value) || 1, cost: p ? p.cost : Number(cost.value) || 0 };
          if (p) cost.value = p.cost;
          updateTotals();
        });
        qty.addEventListener("input", function () { items[idx].qty = Math.max(0, Math.round(Number(qty.value) || 0)); updateTotals(); });
        cost.addEventListener("input", function () { items[idx].cost = Math.max(0, Number(cost.value) || 0); updateTotals(); });
        if (del) del.addEventListener("click", function () { items.splice(idx, 1); renderLines(); });
      });
    }

    function updateTotals() {
      var valid = items.filter(function (l) { return l.productId; });
      var total = HS.round(HS.sum(valid, function (l) { return l.qty * l.cost; }), 3);
      var units = HS.sum(valid, function (l) { return l.qty; });
      totalBox.textContent = HS.fmt.money(total);
      infoBox.textContent = valid.length ? HS.fmt.int(valid.length) + " أصناف · " + HS.fmt.int(units) + " وحدة" : "لم تُضف أصناف بعد";
      linesBox.querySelectorAll(".po-line").forEach(function (row) {
        var idx = parseInt(row.getAttribute("data-idx"), 10);
        var l = items[idx];
        var sum = row.querySelector("[data-sum]");
        if (sum && l) sum.textContent = HS.fmt.money(HS.round(l.qty * l.cost, 3));
      });
    }

    function addLine() {
      items.push({ productId: "", name: "", qty: 1, cost: 0 });
      renderLines();
      var sels = linesBox.querySelectorAll(".po-line__prod");
      if (sels.length) sels[sels.length - 1].focus();
    }

    m.body.querySelector("#poAddLine").addEventListener("click", addLine);
    m.body.querySelector("#poFillLow").addEventListener("click", function () {
      var need = HS.store.lowStock().concat(HS.store.outOfStock());
      if (!need.length) { HS.ui.toast({ type: "info", icon: "check-circle", title: "لا نواقص في المخزون" }); return; }
      var added = 0;
      need.forEach(function (p) {
        if (items.some(function (l) { return l.productId === p.id; })) return;
        items.push({ productId: p.id, name: p.name, qty: Math.max(1, (p.minStock * 3) - p.stock), cost: p.cost });
        added++;
      });
      renderLines();
      HS.ui.toast({ type: added ? "success" : "info", icon: "layers", title: added ? "أُضيفت " + HS.fmt.int(added) + " أصناف ناقصة" : "كل النواقص موجودة في القائمة بالفعل", duration: 3200 });
    });

    renderLines();

    m.root.querySelector("#poSave").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      if (!vals.supplierId) { HS.ui.fieldError(m.body, "supplierId", "اختر المورد"); ok = false; }
      var valid = items.filter(function (l) { return l.productId && l.qty > 0; });
      if (!valid.length) { HS.ui.toast({ type: "danger", icon: "alert", title: "أضف صنفًا واحدًا على الأقل", msg: "أمر الشراء بلا أصناف لا معنى له." }); ok = false; }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }

      var btn = m.root.querySelector("#poSave");
      btn.setAttribute("data-loading", "true");
      HS.sleep(320).then(function () {
        var res = HS.store.savePurchase({
          supplierId: vals.supplierId,
          supplierName: (HS.store.supplier(vals.supplierId) || {}).name || "",
          date: vals.date, expectedDate: vals.expectedDate, status: vals.status,
          note: vals.note, items: valid
        }, po ? po.id : null);
        btn.removeAttribute("data-loading");
        if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
        m.close(true);
        HS.ui.toast({
          type: "success", icon: isNew ? "plus" : "check",
          title: (isNew ? "أُنشئ أمر الشراء " : "حُدّث الأمر ") + res.purchase.number,
          msg: HS.fmt.int(valid.length) + " أصناف بقيمة " + HS.fmt.money(res.purchase.total)
        });
        HS.router.refresh();
      });
    });
    return m;
  }
  HS.pages.purchases.openForm = function (po, presetLines) { poForm(po, presetLines); };

  /* ═══════════════ الإجراءات ═══════════════ */
  HS.action("po-new", function () { poForm(null, null); });
  HS.action("po-view", function (trg) {
    var id = trg.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    var supplier = HS.store.supplier(po.supplierId);
    HS.ui.modal({
      title: "أمر الشراء " + po.number,
      sub: STATUS_LABEL[po.status] + " · " + HS.fmt.date(po.date),
      size: "lg",
      body: '<div class="stack">' +
        '<div class="row-wrap">' + HS.ui.poStatus(po.status) +
          (po.status !== "received" && po.status !== "cancelled" && HS.date.toDate(po.expectedDate) < new Date()
            ? HS.ui.badge("متأخر عن الموعد", "badge--danger") : "") +
        '</div>' +
        HS.ui.kv([
          ["المورد", supplier ? HS.esc(supplier.name) + ' · <span class="ltr">' + HS.esc(HS.ui.phone(supplier.phone)) + '</span>' : HS.esc(po.supplierName || "—")],
          ["تاريخ الأمر", HS.fmt.date(po.date)],
          ["الوصول المتوقع", HS.fmt.date(po.expectedDate)],
          ["المدفوع", HS.fmt.money(po.paid || 0) + " من " + HS.fmt.money(po.total)],
          ["المتبقي", '<span class="' + (po.total - (po.paid || 0) > 0.001 ? "text-danger fw-600" : "text-success") + '">' + HS.fmt.money(HS.round(po.total - (po.paid || 0), 3)) + '</span>'],
          ["ملاحظات", po.note ? HS.esc(po.note) : '<span class="text-3">—</span>']
        ]) +
        '<div class="card" style="box-shadow:none"><div class="card__body card__body--flush">' +
        HS.ui.table([
          { key: "name", label: "الصنف", render: function (l) {
              var p = HS.store.product(l.productId);
              return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (p ? (p.emoji || "📦") : "📦") + '</span>' +
                '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(l.name) + '</span>' +
                (p ? '<span class="fs-xs text-3" style="display:block">الرصيد الحالي ' + HS.fmt.int(p.stock) + ' ' + HS.esc(p.unit) + '</span>' : "") + '</span></span>';
            } },
          { key: "qty", label: "الكمية", align: "num", width: "96px", render: function (l) { return HS.fmt.int(l.qty); } },
          { key: "cost", label: "تكلفة الوحدة", align: "num", width: "132px", render: function (l) { return HS.fmt.money(l.cost); } },
          { key: "sum", label: "الإجمالي", align: "num", width: "132px", render: function (l) { return '<span class="fw-600">' + HS.fmt.money(HS.round(l.qty * l.cost, 3)) + '</span>'; } }
        ], po.items, {
          foot: ["", HS.fmt.int(HS.sum(po.items, function (l) { return l.qty; })) + " وحدة", "", '<span class="fw-700">' + HS.fmt.money(po.total) + '</span>']
        }) +
        '</div></div></div>',
      footer: '<button type="button" class="btn btn--ghost" data-modal-close>إغلاق</button><span class="grow"></span>' +
        (HS.store.can("purchases_manage") && po.status !== "received" && po.status !== "cancelled"
          ? '<button type="button" class="btn btn--secondary" data-modal-close data-action="po-edit" data-id="' + po.id + '"><span class="btn__icon">' + HS.icon("pencil", 15) + '</span><span class="btn__label">تعديل</span></button>' +
            '<button type="button" class="btn btn--primary" data-modal-close data-action="po-receive" data-id="' + po.id + '"><span class="btn__icon">' + HS.icon("box-check", 15) + '</span><span class="btn__label">استلام</span></button>'
          : "")
    });
  });
  HS.action("po-edit", function (btn) {
    var po = HS.store.purchase(btn.getAttribute("data-id"));
    if (!po) return;
    if (po.status === "received") {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا يمكن تعديل أمر مُستلم", msg: "الكميات دخلت المخزون بالفعل. استخدم تسوية جرد لتصحيح أي فرق." });
      return;
    }
    poForm(po, null);
  });
  HS.action("po-receive", function (btn) {
    var id = btn.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    HS.ui.confirm({
      title: "استلام الأمر " + po.number + "؟",
      tone: "info", icon: "box-check", okLabel: "تأكيد الاستلام",
      html: '<p>ستُضاف <b>' + HS.fmt.int(HS.sum(po.items, function (l) { return l.qty; })) + '</b> وحدة إلى المخزون موزّعة على <b>' + HS.fmt.int(po.items.length) + '</b> أصناف، بقيمة <b>' + HS.fmt.money(po.total) + '</b>.</p>' +
            '<p class="fs-sm text-3" style="margin-block-start:var(--sp-2)">يُسجَّل لكل صنف حركة دخول بمرجع رقم الأمر.</p>'
    }).then(function (ok) {
      if (!ok) return;
      var before = {};
      po.items.forEach(function (l) { var p = HS.store.product(l.productId); if (p) before[l.productId] = p.stock; });
      var res = HS.store.receivePurchase(id);
      if (!res.ok) { HS.ui.toast({ type: "danger", icon: "alert", title: "تعذّر الاستلام", msg: res.error }); return; }
      HS.ui.toast({
        type: "success", icon: "box-check", title: "استُلم الأمر " + po.number, duration: 6500,
        msg: "أُضيفت " + HS.fmt.int(HS.sum(po.items, function (l) { return l.qty; })) + " وحدة إلى المخزون.",
        actions: [{ label: "عرض الأرصدة", onClick: function () { HS.router.go("/inventory", { tab: "levels" }); } }]
      });
      HS.router.refresh();
    });
  });
  HS.action("po-pay", function (btn) {
    var id = btn.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    var due = HS.round(po.total - (po.paid || 0), 3);
    var m = HS.ui.modal({
      title: "دفعة للمورد", sub: po.number + " · المستحق " + HS.fmt.money(due), size: "sm",
      body: '<div class="stack"><div class="form-grid">' +
        HS.ui.field({ name: "amount", label: "المبلغ", type: "number", value: due.toFixed(HS.store.state.settings.decimals), min: 0, max: due, step: "0.001", suffix: HS.store.state.settings.currency, attrs: ' data-autofocus inputmode="decimal"' }) +
        HS.ui.field({ name: "method", label: "طريقة الدفع", type: "select", value: "card", options: HS.data.PAY_METHODS.map(function (p) { return { value: p.id, label: p.name }; }) }) +
        '</div><div class="chips">' + [0.25, 0.5, 1].map(function (f) {
          return '<button type="button" class="chip" data-frac="' + f + '">' + (f === 1 ? "كامل المستحق" : HS.fmt.pct(f, 0)) + '</button>';
        }).join("") + '</div></div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button><button type="button" class="btn btn--primary" id="poDoPay">تسجيل الدفعة</button>'
    });
    var inp = m.body.querySelector('[name="amount"]');
    m.body.querySelectorAll("[data-frac]").forEach(function (b) {
      b.addEventListener("click", function () { inp.value = HS.round(due * Number(b.getAttribute("data-frac")), 3).toFixed(HS.store.state.settings.decimals); });
    });
    m.root.querySelector("#poDoPay").addEventListener("click", function () {
      var amount = Number(inp.value) || 0;
      if (amount <= 0) { HS.ui.fieldError(m.body, "amount", "أدخل مبلغًا أكبر من صفر"); return; }
      if (amount > due + 0.001) { HS.ui.fieldError(m.body, "amount", "المبلغ أكبر من المستحق (" + HS.fmt.money(due) + ")"); return; }
      po.paid = HS.round((po.paid || 0) + amount, 3);
      po._edited = true;
      var sup = HS.store.supplier(po.supplierId);
      if (sup) sup.balance = HS.round(Math.max(0, sup.balance - amount), 3);
      HS.store.save();
      HS.bus.emit("purchase:updated", po);
      m.close(true);
      HS.ui.toast({ type: "success", icon: "cash", title: "سُجّلت دفعة " + HS.fmt.money(amount), msg: "المتبقي على الأمر: " + HS.fmt.money(HS.round(po.total - po.paid, 3)) });
      HS.router.refresh();
    });
  });
  HS.action("po-menu", function (btn) {
    var id = btn.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    var html = HS.ui.popItem("عرض التفاصيل", "receipt", "po-view", { id: id });
    if (HS.store.can("purchases_manage")) {
      if (po.status !== "received" && po.status !== "cancelled") html += HS.ui.popItem("استلام وتغذية المخزون", "box-check", "po-receive", { id: id });
      if (po.status !== "received" && po.status !== "cancelled") html += HS.ui.popItem("تعديل الأمر", "pencil", "po-edit", { id: id });
      if (po.status === "draft" || po.status === "shipping") html += HS.ui.popItem("إلغاء الأمر", "x-circle", "po-cancel", { id: id }, "pop__item--danger");
      html += '<div class="pop__sep"></div>' + HS.ui.popItem("حذف الأمر", "trash", "po-delete", { id: id }, "pop__item--danger");
    }
    HS.ui.pop(btn, html);
  });
  HS.action("po-cancel", function (btn) {
    var id = btn.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    HS.ui.closePop();
    HS.ui.confirm({
      title: "إلغاء الأمر " + po.number + "؟", tone: "warn", icon: "x-circle", okLabel: "إلغاء الأمر",
      text: "لن تُضاف أي كميات إلى المخزون، ويبقى الأمر في السجل للحاجة."
    }).then(function (ok) {
      if (!ok) return;
      var prev = po.status;
      po.status = "cancelled"; po._edited = true;
      HS.store.save(); HS.bus.emit("purchase:updated", po);
      HS.ui.toast({ type: "info", icon: "x-circle", title: "أُلغي الأمر " + po.number, actions: [{ label: "تراجع", onClick: function () { po.status = prev; HS.store.save(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("po-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var po = HS.store.purchase(id);
    if (!po) return;
    HS.ui.closePop();
    if (po.status === "received") {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا يمكن حذف أمر مُستلم", msg: "كمياته دخلت المخزون. احذفه فقط إن كنت ستصحّح الأرصدة يدويًا." });
      return;
    }
    HS.ui.confirm({ title: "حذف الأمر " + po.number + "؟", danger: true, icon: "trash", okLabel: "حذف", text: "سيُحذف نهائيًا من السجل." }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deletePurchase(id);
      if (!res.ok) return;
      HS.ui.toast({ type: "success", icon: "trash", title: "حُذف الأمر " + po.number, duration: 6000, actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("po-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, supplier: null, from: null, to: null, page: null, sort: null, dir: null });
  });
  HS.action("po-export", function () {
    var rows = HS.store.state.purchases.map(function (p) {
      return {
        "رقم الأمر": p.number, "التاريخ": p.date, "الوصول المتوقع": p.expectedDate,
        "المورد": p.supplierName, "عدد الأصناف": p.items.length,
        "الوحدات": HS.sum(p.items, function (i) { return i.qty; }),
        "القيمة": p.total, "المدفوع": p.paid || 0, "المتبقي": HS.round(p.total - (p.paid || 0), 3),
        "الحالة": STATUS_LABEL[p.status] || p.status, "ملاحظات": p.note || ""
      };
    });
    if (!rows.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لا أوامر للتصدير" }); return; }
    var ok = HS.download("المشتريات-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّرت المشتريات" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " أمرًا" : "" });
  });
})();
