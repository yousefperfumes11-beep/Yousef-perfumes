/* ═══════════════════════════════════════════════════════════
   pages/inventory.js — المخزون
   ثلاثة تبويبات: حركة المخزون، أرصدة الأصناف، والتنبيهات.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 20, sort: "date", dir: "desc" };

  HS.pages.inventory = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "movements";
    var type = ctx.query.type || "";
    var productId = ctx.query.product || "";
    var brand = ctx.query.brand || "";
    var size = ctx.query.size || "";
    var from = ctx.query.from || "";
    var to = ctx.query.to || "";
    var canAdjust = HS.store.can("inventory_adjust");

    HS.ui.setHeader({
      title: "المخزون",
      sub: "كل حركة دخول وخروج وتسوية، مع الأرصدة المحسوبة من الحركة لا من رقم ثابت.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المخزون" }],
      hidePeriod: true
    });

    var moves = st.movements.slice();
    var totals = {
      all: moves.length,
      in: moves.filter(function (m) { return m.type === "in"; }).length,
      out: moves.filter(function (m) { return m.type === "out"; }).length,
      adjust: moves.filter(function (m) { return m.type === "adjust"; }).length,
      inQty: HS.sum(moves.filter(function (m) { return m.type === "in"; }), function (m) { return m.qty; }),
      outQty: HS.sum(moves.filter(function (m) { return m.type === "out"; }), function (m) { return Math.abs(m.qty); }),
      adjQty: HS.sum(moves.filter(function (m) { return m.type === "adjust"; }), function (m) { return m.qty; })
    };

    var tabs = [
      { id: "movements", label: "حركة المخزون", count: totals.all },
      { id: "levels", label: "أرصدة الأصناف", count: st.products.length },
      { id: "alerts", label: "تنبيهات", count: HS.store.stockAlertCount() }
    ];

    var prodOptions = [{ value: "", label: "كل الأصناف" }].concat(
      HS.sortBy(st.products, function (p) { return HS.store.label(p); }, "asc")
        .map(function (p) { return { value: p.id, label: HS.store.label(p) + (p.brand ? " — " + p.brand : "") }; })
    );
    var brandOptions = [{ value: "", label: "كل الماركات" }].concat(HS.store.brands().map(function (b) {
      return { value: b.name, label: b.name + " (" + HS.fmt.int(b.count) + ")" };
    }));
    var sizeOptions = [{ value: "", label: "كل الأحجام" }].concat(HS.store.sizes().map(function (z) { return { value: z, label: z }; }));
    /** هل يطابق الصنف مرشّحَي الماركة والحجم؟ */
    function matchPS(p) {
      if (brand && p.brand !== brand) return false;
      if (size && p.size !== size) return false;
      return true;
    }

    var toolbarFilters =
      (tab === "movements"
        ? HS.ui.select({ name: "type", label: "نوع الحركة", value: type, options: [{ value: "", label: "كل الحركات" }, { value: "in", label: "دخول" }, { value: "out", label: "خروج" }, { value: "adjust", label: "تسوية" }] })
        : "") +
      HS.ui.select({ name: "brand", label: "الماركة", value: brand, options: brandOptions }) +
      HS.ui.select({ name: "size", label: "الحجم", value: size, options: sizeOptions }) +
      HS.ui.select({ name: "product", label: "الصنف", value: productId, options: prodOptions }) +
      '<span class="row-2"><input class="input input--sm" type="date" name="from" value="' + HS.esc(from) + '" data-inv-filter aria-label="من تاريخ">' +
      '<span class="text-3">—</span>' +
      '<input class="input input--sm" type="date" name="to" value="' + HS.esc(to) + '" data-inv-filter aria-label="إلى تاريخ"></span>';

    var filtersActive = !!(ls.q || type || productId || brand || size || from || to);

    var content;

    if (tab === "movements") {
      var list = moves.filter(function (m) {
        if (type && m.type !== type) return false;
        if (productId && m.productId !== productId) return false;
        if (from && HS.date.toDate(m.date) < HS.date.startOfDay(from)) return false;
        if (to && HS.date.toDate(m.date) > HS.date.endOfDay(to)) return false;
        var p = HS.store.product(m.productId);
        if (!matchPS(p || {})) return false;
        if (ls.q && !HS.matches((p ? p.name + " " + (p.brand || "") + " " + (p.size || "") + " " +
              (p.barcode || "") + " " + (p.sku || "") : "") + " " + (m.reason || "") + " " + (m.ref || ""), ls.q)) return false;
        return true;
      });
      list = HS.sortBy(list, function (m) { return m.date; }, ls.dir);
      var paged = HS.ui.paginate(list, ls.page, ls.per);

      content = HS.ui.toolbar({
        q: ls.q, placeholder: "بحث بالصنف أو السبب أو المرجع…",
        filters: toolbarFilters + (filtersActive ? '<button type="button" class="chip" data-action="inv-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
        actions: '<button type="button" class="btn btn--sm btn--secondary" data-action="inv-export-moves"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير الحركة</span></button>' +
                 (canAdjust ? '<button type="button" class="btn btn--sm btn--primary" data-action="inv-count"><span class="btn__icon">' + HS.icon("clipboard", 15) + '</span><span class="btn__label">بدء جرد</span></button>' : "")
      }) +
      HS.ui.table([
        { key: "date", label: "التاريخ", sortable: true, width: "140px", render: function (m) {
            return '<span>' + HS.fmt.date(m.date) + '</span><span class="fs-xs text-3" style="display:block">' + HS.fmt.time(m.date) + '</span>';
          } },
        { key: "type", label: "النوع", width: "104px", align: "center", render: function (m) { return HS.ui.moveType(m.type); } },
        { key: "product", label: "الصنف", render: function (m) {
            var p = HS.store.product(m.productId);
            return p ? '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "🧴") + '</span>' +
              '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(HS.store.label(p)) + '</span>' +
              '<span class="fs-xs text-3" style="display:block">' + HS.esc(p.brand || "—") + ' · <span class="ltr" style="font-variant-numeric:tabular-nums">' + HS.esc(p.barcode || p.sku || "") + '</span></span></span></span>'
              : '<span class="text-3">صنف محذوف</span>';
          } },
        { key: "qty", label: "الكمية", align: "num", width: "104px", render: function (m) {
            var sign = m.type === "out" ? "−" : m.type === "adjust" && m.qty < 0 ? "−" : "+";
            var cls = m.type === "out" || (m.type === "adjust" && m.qty < 0) ? "text-danger" : "text-success";
            return '<span class="fw-600 ' + cls + '">' + sign + HS.fmt.int(Math.abs(m.qty)) + '</span>';
          } },
        { key: "reason", label: "السبب", width: "190px", render: function (m) { return '<span class="fs-sm">' + HS.esc(m.reason || "—") + '</span>'; } },
        { key: "ref", label: "المرجع", width: "148px", render: function (m) {
            if (!m.ref) return '<span class="text-3">—</span>';
            var sale = st.sales.filter(function (s) { return s.number === m.ref; })[0];
            return sale ? '<a href="#/sales/' + sale.id + '" class="ltr fw-500">' + HS.esc(m.ref) + '</a>'
                        : '<span class="ltr fs-sm text-3">' + HS.esc(m.ref) + '</span>';
          } },
        { key: "user", label: "بواسطة", width: "132px", render: function (m) {
            var u = HS.store.user(m.userId);
            return u ? '<span class="row-2">' + HS.ui.avatar(u.name, "avatar--xs") + '<span class="fs-sm truncate">' + HS.esc(u.name) + '</span></span>' : '<span class="text-3">—</span>';
          } }
      ], paged, {
        sort: { key: ls.sort, dir: ls.dir },
        empty: HS.ui.empty({
          icon: filtersActive ? "search" : "layers",
          title: filtersActive ? "لا حركات مطابقة" : "لا حركات مخزون مسجّلة",
          text: filtersActive ? "وسّع نطاق التاريخ أو أزل مرشّح النوع." : "الحركات تُنشأ تلقائيًا من المبيعات والمشتريات والتسويات.",
          action: filtersActive ? '<button type="button" class="btn btn--secondary btn--sm" data-action="inv-clear">إزالة المرشّحات</button>' : ""
        }),
        foot: paged.length ? ["", "", '<span class="text-3 fw-500">صافي الصفحة</span>',
          '<span class="fw-700">' + (function () {
            var net = HS.sum(paged, function (m) { return m.type === "out" ? -Math.abs(m.qty) : m.type === "adjust" ? m.qty : Math.abs(m.qty); });
            return (net >= 0 ? "+" : "−") + HS.fmt.int(Math.abs(net));
          })() + '</span>', "", "", ""] : null
      }) +
      HS.ui.pager({ page: ls.page, per: ls.per, total: list.length });

    } else if (tab === "levels") {
      var prods = st.products.filter(function (p) {
        if (productId && p.id !== productId) return false;
        if (!matchPS(p)) return false;
        if (ls.q && !HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " + (p.sku || ""), ls.q)) return false;
        return true;
      }).map(function (p) {
        var ms = moves.filter(function (m) { return m.productId === p.id; });
        return {
          p: p,
          inQty: HS.sum(ms.filter(function (m) { return m.type === "in"; }), function (m) { return m.qty; }),
          outQty: HS.sum(ms.filter(function (m) { return m.type === "out"; }), function (m) { return Math.abs(m.qty); }),
          adjQty: HS.sum(ms.filter(function (m) { return m.type === "adjust"; }), function (m) { return m.qty; }),
          last: ms.length ? ms[ms.length - 1].date : p.createdAt
        };
      });
      prods = HS.sortBy(prods, ls.sort === "stock" ? function (x) { return x.p.stock; }
        : ls.sort === "value" ? function (x) { return x.p.stock * x.p.cost; }
        : ls.sort === "turn" ? function (x) { return x.outQty; }
        : function (x) { return x.p.name; }, ls.dir);
      var ppaged = HS.ui.paginate(prods, ls.page, ls.per);

      content = HS.ui.toolbar({
        q: ls.q, placeholder: "بحث عن صنف…",
        filters: toolbarFilters + (filtersActive ? '<button type="button" class="chip" data-action="inv-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
        actions: '<button type="button" class="btn btn--sm btn--secondary" data-action="inv-export-levels"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير الأرصدة</span></button>'
      }) +
      HS.ui.table([
        { key: "name", label: "الصنف", sortable: true, render: function (x) {
            return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (x.p.emoji || "🧴") + '</span>' +
              '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(HS.store.label(x.p)) + '</span>' +
              '<span class="fs-xs text-3" style="display:block">' + HS.esc(x.p.brand || "بدون ماركة") + ' · ' + HS.esc(HS.store.cat(x.p.category).name) + '</span></span></span>';
          } },
        { key: "opening", label: "افتتاحي", align: "num", width: "92px", render: function (x) { return '<span class="text-3">' + HS.fmt.int(x.p.opening || 0) + '</span>'; } },
        { key: "in", label: "دخول", align: "num", width: "88px", render: function (x) { return '<span class="text-success">+' + HS.fmt.int(x.inQty) + '</span>'; } },
        { key: "out", label: "خروج", align: "num", width: "88px", render: function (x) { return '<span class="text-danger">−' + HS.fmt.int(x.outQty) + '</span>'; } },
        { key: "adj", label: "تسوية", align: "num", width: "88px", render: function (x) {
            return x.adjQty ? '<span class="' + (x.adjQty > 0 ? "text-success" : "text-danger") + '">' + (x.adjQty > 0 ? "+" : "−") + HS.fmt.int(Math.abs(x.adjQty)) + '</span>' : '<span class="text-3">—</span>';
          } },
        { key: "stock", label: "الرصيد الحالي", sortable: true, align: "num", width: "134px", render: function (x) { return HS.ui.stockBadge(x.p); } },
        { key: "cover", label: "تغطية المبيعات", width: "150px", render: function (x) {
            var per = HS.store.range("30d");
            var sold = HS.sum(HS.store.validSalesOf(per).filter(function (s) {
              return s.items.some(function (i) { return i.productId === x.p.id; });
            }), function (s) { return HS.sum(s.items.filter(function (i) { return i.productId === x.p.id; }), function (i) { return i.qty; }); });
            var days = sold > 0 ? Math.floor(x.p.stock / (sold / 30)) : null;
            if (days == null) return '<span class="text-3 fs-sm">لا مبيعات مؤخرًا</span>';
            var tone = days < 7 ? "badge--danger" : days < 21 ? "badge--warning" : "badge--success";
            return HS.ui.badge(HS.fmt.int(days) + " يومًا", tone);
          } },
        { key: "value", label: "قيمة الرصيد", sortable: true, align: "num", width: "128px", render: function (x) { return HS.fmt.money(HS.round(x.p.stock * x.p.cost, 3)); } },
        { key: "actions", label: "", align: "center", width: "88px", render: function (x) {
            return canAdjust ? '<span class="table__actions">' + HS.ui.iconBtn("prod-adjust", "layers", "تعديل الرصيد", { id: x.p.id }) +
              HS.ui.iconBtn("inv-history", "clock", "سجل الصنف", { id: x.p.id }) + '</span>' : "";
          } }
      ], ppaged, {
        sort: { key: ls.sort, dir: ls.dir },
        empty: HS.ui.empty({ icon: "box", title: "لا أصناف", text: "غيّر المرشّحات لعرض الأرصدة." }),
        foot: ppaged.length ? ["", HS.fmt.int(HS.sum(ppaged, function (x) { return x.p.opening || 0; })),
          "+" + HS.fmt.int(HS.sum(ppaged, function (x) { return x.inQty; })),
          "−" + HS.fmt.int(HS.sum(ppaged, function (x) { return x.outQty; })),
          (function () { var n = HS.sum(ppaged, function (x) { return x.adjQty; }); return (n >= 0 ? "+" : "−") + HS.fmt.int(Math.abs(n)); })(),
          HS.fmt.int(HS.sum(ppaged, function (x) { return x.p.stock; })) + " وحدة", "",
          '<span class="fw-700">' + HS.fmt.money(HS.sum(ppaged, function (x) { return HS.round(x.p.stock * x.p.cost, 3); })) + '</span>', ""] : null
      }) +
      HS.ui.pager({ page: ls.page, per: ls.per, total: prods.length });

    } else {
      /* تنبيهات */
      var oos = HS.store.outOfStock();
      var low = HS.store.lowStock();
      var overstocked = st.products.filter(function (p) { return p.active && p.stock > p.minStock * 8; })
        .sort(function (a, b) { return (b.stock * b.cost) - (a.stock * a.cost); }).slice(0, 8);

      content = '<div class="stack" style="padding:var(--sp-4)">' +
        alertGroup("danger", "نفد من المخزون", oos, "لا يمكن بيع هذه الأصناف. أنشئ طلب شراء أو سجّل تسوية.") +
        alertGroup("warning", "تحت الحد الأدنى", low, "الكمية الحالية أقل من حد التنبيه المحدد للصنف.") +
        alertGroup("info", "تكدّس مخزون", overstocked, "أرصدة تفوق ثمانية أضعاف حد التنبيه — رأس مال راكد يستحق مراجعة.") +
        '</div>';

      function alertGroup(tone, title, items, text) {
        if (!items.length) return "";
        return '<section class="card"><div class="card__head">' +
          '<div><h2 class="card__title">' + HS.esc(title) + '</h2><p class="card__sub">' + HS.esc(text) + '</p></div>' +
          HS.ui.badge(HS.fmt.int(items.length) + " صنفًا", "badge--" + tone) +
          '</div><div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "name", label: "الصنف", render: function (p) {
                return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "🧴") + '</span>' +
                  '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(HS.store.label(p)) + '</span>' +
                  '<span class="fs-xs text-3" style="display:block">' + HS.esc(p.brand || "بدون ماركة") + ' · ' + HS.esc(HS.store.cat(p.category).name) + '</span></span></span>';
              } },
            { key: "stock", label: "الرصيد", align: "num", width: "120px", render: function (p) { return HS.ui.stockBadge(p); } },
            { key: "min", label: "الحد الأدنى", align: "num", width: "104px", render: function (p) { return HS.fmt.int(p.minStock); } },
            { key: "suggest", label: "الكمية المقترحة للطلب", align: "num", width: "168px", render: function (p) {
                var need = Math.max(0, (p.minStock * 3) - p.stock);
                return '<span class="fw-600">' + HS.fmt.int(need) + '</span> <span class="text-3 fs-xs">' + HS.esc(p.unit) + '</span>';
              } },
            { key: "supplier", label: "المورد المعتاد", width: "160px", render: function (p) {
                var s = p.supplierId ? HS.store.supplier(p.supplierId) : null;
                return s ? '<span class="fs-sm truncate">' + HS.esc(s.name) + '</span>' : '<span class="text-3">—</span>';
              } },
            { key: "actions", label: "", align: "center", width: "150px", render: function (p) {
                return '<span class="table__actions">' +
                  (p.supplierId ? HS.ui.iconBtn("inv-po", "truck", "إنشاء طلب شراء", { id: p.id }) : "") +
                  (canAdjust ? HS.ui.iconBtn("prod-adjust", "layers", "تعديل الرصيد", { id: p.id }) : "") +
                  '</span>';
              } }
          ], items, { rowAttrs: function (p) { return ' data-id="' + p.id + '"'; } }) +
          '</div></section>';
      }
    }

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("قيمة المخزون", HS.fmt.money(HS.store.inventoryValue()), "بسعر التكلفة") +
        HS.ui.statMini("قيمة التجزئة", HS.fmt.money(HS.store.retailValue()), "هامش " + HS.fmt.pct(HS.store.retailValue() ? (HS.store.retailValue() - HS.store.inventoryValue()) / HS.store.retailValue() : 0, 1)) +
        HS.ui.statMini("وحدات دخلت", "+" + HS.fmt.int(totals.inQty), totals.in + " حركة دخول") +
        HS.ui.statMini("وحدات خرجت", "−" + HS.fmt.int(totals.outQty), totals.out + " حركة بيع") +
        HS.ui.statMini("صافي التسويات", (totals.adjQty >= 0 ? "+" : "−") + HS.fmt.int(Math.abs(totals.adjQty)), totals.adjust + " حركة جرد") +
      '</section>' +
      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
        content +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    root.querySelectorAll("[data-inv-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {}; patch[el.name] = el.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
    root.querySelectorAll(".toolbar select").forEach(function (sel) {
      if (sel.hasAttribute("data-inv-filter")) return;
      sel.addEventListener("change", function () {
        var patch = {}; patch[sel.name] = sel.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
  };

  /* ═══════════ إجراءات المخزون ═══════════ */
  HS.action("inv-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, type: null, product: null, brand: null, size: null, from: null, to: null, page: null, sort: null, dir: null });
  });

  HS.action("inv-export-moves", function () {
    var rows = HS.store.state.movements.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (m) {
      var p = HS.store.product(m.productId);
      var u = HS.store.user(m.userId);
      return {
        "التاريخ": m.date, "النوع": m.type === "in" ? "دخول" : m.type === "out" ? "خروج" : "تسوية",
        "الصنف": p ? HS.store.label(p) : "(محذوف)", "الماركة": p ? (p.brand || "") : "",
        "الحجم": p ? (p.size || "") : "", "الباركود": p ? (p.barcode || "") : "", "الرمز الداخلي": p ? (p.sku || "") : "",
        "الكمية": m.qty, "السبب": m.reason || "", "المرجع": m.ref || "", "المستخدم": u ? u.name : ""
      };
    });
    if (!rows.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لا حركات للتصدير" }); return; }
    var ok = HS.download("حركة-المخزون-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّرت الحركة" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " حركة" : "" });
  });

  HS.action("inv-export-levels", function () {
    var rows = HS.store.state.products.map(function (p) {
      return {
        "الباركود": p.barcode || "", "الرمز الداخلي": p.sku || "",
        "الصنف": HS.store.label(p), "الماركة": p.brand || "", "الحجم": p.size || "",
        "القسم": HS.store.cat(p.category).name,
        "الرصيد الافتتاحي": p.opening || 0, "الرصيد الحالي": p.stock, "الوحدة": p.unit,
        "الحد الأدنى": p.minStock, "التكلفة": p.cost, "قيمة الرصيد": HS.round(p.stock * p.cost, 3),
        "سعر البيع": p.price, "قيمة التجزئة": HS.round(p.stock * p.price, 3)
      };
    });
    var ok = HS.download("ارصدة-المخزون-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّرت الأرصدة" : "تعذّر التصدير" });
  });

  HS.action("inv-history", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    var ms = HS.store.state.movements.filter(function (m) { return m.productId === id; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 60);

    HS.ui.modal({
      title: "سجل حركة «" + HS.store.label(p) + "»",
      sub: HS.fmt.int(ms.length) + " حركة · الرصيد الحالي " + HS.fmt.int(p.stock) + " " + p.unit,
      size: "lg",
      body: ms.length ? '<div class="timeline">' + ms.map(function (m) {
        var u = HS.store.user(m.userId);
        return '<div class="timeline__item timeline__item--' + m.type + '">' +
          '<span class="timeline__dot timeline__dot--' + m.type + '" aria-hidden="true"></span>' +
          '<div class="timeline__body"><div class="timeline__title">' +
            '<b class="' + (m.type === "out" ? "text-danger" : m.type === "adjust" && m.qty < 0 ? "text-danger" : "text-success") + '">' +
            (m.type === "out" || (m.type === "adjust" && m.qty < 0) ? "−" : "+") + HS.fmt.int(Math.abs(m.qty)) + ' ' + HS.esc(p.unit) + '</b>' +
            ' <span class="text-2">' + HS.esc(m.reason || "") + '</span></div>' +
          '<div class="timeline__meta">' + HS.fmt.date(m.date) + ' · ' + HS.fmt.time(m.date) +
            (m.ref ? ' · <span class="ltr">' + HS.esc(m.ref) + '</span>' : "") +
            (u ? ' · ' + HS.esc(u.name) : "") + '</div></div></div>';
      }).join("") + '</div>' : HS.ui.empty({ icon: "layers", title: "لا حركة لهذا الصنف" }),
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إغلاق</button>' +
              '<a class="btn btn--primary" href="#/inventory?product=' + encodeURIComponent(id) + '&tab=movements" data-modal-close>' +
              '<span class="btn__icon">' + HS.icon("external", 16) + '</span><span class="btn__label">عرض في شاشة الحركة</span></a>'
    });
  });

  HS.action("inv-po", function (btn) {
    var id = btn.getAttribute("data-id");
    var p = HS.store.product(id);
    if (!p) return;
    if (HS.pages.purchases && HS.pages.purchases.openForm) HS.pages.purchases.openForm(null, [{ productId: p.id, qty: Math.max(1, (p.minStock * 3) - p.stock) }]);
    else HS.router.go("/purchases");
  });

  HS.action("inv-count", function () {
    var st = HS.store.state;
    /* الأولوية للأصناف الأقرب إلى حد التنبيه: هي الأكثر احتمالًا للفرق */
    var cands = st.products.filter(function (p) { return p.active; }).slice().sort(function (a, b) {
      var ra = a.stock / Math.max(1, a.minStock), rb = b.stock / Math.max(1, b.minStock);
      return ra - rb;
    });
    var sample = cands.slice(0, 10);

    var m = HS.ui.modal({
      title: "جرد عيّنة من المخزون",
      sub: "أدخل العدد الفعلي، وسيُسجَّل الفرق كتسوية تلقائيًا.",
      size: "lg",
      body: '<div class="alert alert--info" style="margin-block-end:var(--sp-4)">' + HS.icon("info", 16) +
            '<span>عيّنة من <b>' + HS.fmt.int(sample.length) + '</b> أصناف من أصل ' + HS.fmt.int(cands.length) + '. اترك الحقل فارغًا لتخطّي الصنف.</span></div>' +
        '<div class="stack">' + sample.map(function (p, i) {
          return '<div class="row-2" style="gap:var(--sp-3);padding-block:var(--sp-2);border-block-end:1px solid var(--border-soft)">' +
            '<span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "📦") + '</span>' +
            '<span style="min-width:0;flex:1"><span class="fw-500 truncate" style="display:block">' + HS.esc(p.name) + '</span>' +
            '<span class="fs-xs text-3" style="display:block">النظام يقول: <b>' + HS.fmt.int(p.stock) + '</b> ' + HS.esc(p.unit) + '</span></span>' +
            '<input class="input input--sm input--num" type="number" step="1" min="0" data-count="' + p.id + '" data-system="' + p.stock + '" ' +
              'placeholder="العدد الفعلي" aria-label="العدد الفعلي من ' + HS.esc(p.name) + '" style="max-width:132px" inputmode="numeric">' +
            '</div>';
        }).join("") + '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="applyCount"><span class="btn__icon">' + HS.icon("check", 16) + '</span><span class="btn__label">تطبيق الفروقات</span></button>',
      onMount: function (api) {
        var first = api.body.querySelector("[data-count]");
        if (first) first.focus();
      }
    });

    m.root.querySelector("#applyCount").addEventListener("click", function () {
      var changes = [];
      m.body.querySelectorAll("[data-count]").forEach(function (inp) {
        if (inp.value === "" || inp.value == null) return;
        var actual = Math.round(Number(inp.value) || 0);
        var system = Number(inp.getAttribute("data-system"));
        if (actual === system) return;
        changes.push({ id: inp.getAttribute("data-count"), delta: actual - system, actual: actual, system: system });
      });
      if (!changes.length) {
        HS.ui.toast({ type: "info", icon: "info", title: "لا فروقات", msg: "كل الأعداد المُدخلة تطابق النظام." });
        return;
      }
      var undone = [];
      changes.forEach(function (c) {
        HS.store.adjustStock(c.id, c.delta, "فرق جرد");
        undone.push(c);
      });
      m.close(true);
      HS.ui.toast({
        type: "success", icon: "clipboard",
        title: "سُجّلت " + HS.fmt.int(changes.length) + " تسويات جرد",
        msg: changes.map(function (c) {
          var p = HS.store.product(c.id);
          return (p ? p.name : "") + ": " + (c.delta > 0 ? "+" : "") + HS.fmt.int(c.delta);
        }).join(" · "),
        duration: 7000,
        actions: [{ label: "تراجع عن الكل", onClick: function () {
          undone.forEach(function (c) { HS.store.adjustStock(c.id, -c.delta, "تراجع عن فرق جرد"); });
          HS.router.refresh();
        } }]
      });
      HS.router.refresh();
    });
  });
})();
