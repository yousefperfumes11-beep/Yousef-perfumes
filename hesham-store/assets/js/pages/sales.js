/* ═══════════════════════════════════════════════════════════
   pages/sales.js — سجل المبيعات: تبويبات الحالة، المرشّحات،
   الترتيب، الترقيم، والتصدير. كل الحالة محفوظة في العنوان.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 15, sort: "date", dir: "desc" };

  HS.pages.sales = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "all";
    var method = ctx.query.method || "";
    var customerId = ctx.query.customer || "";
    var from = ctx.query.from || "";
    var to = ctx.query.to || "";
    var minTotal = Number(ctx.query.min) || 0;

    HS.ui.setHeader({
      title: "سجل المبيعات",
      sub: "كل الفواتير الصادرة مع حالات الدفع والمرتجعات. المرشّحات محفوظة في الرابط.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المبيعات" }]
    });

    var all = st.sales.filter(function (s) { return s.status !== "held"; });

    /* ── المرشّحات ── */
    var list = all.filter(function (s) {
      if (tab !== "all" && s.status !== tab) return false;
      if (method && s.method !== method) return false;
      if (customerId && s.customerId !== customerId) return false;
      if (from && HS.date.toDate(s.date) < HS.date.startOfDay(from)) return false;
      if (to && HS.date.toDate(s.date) > HS.date.endOfDay(to)) return false;
      if (minTotal && s.total < minTotal) return false;
      if (ls.q && !HS.matches(s.number + " " + s.customerName + " " + s.items.map(function (i) { return i.name; }).join(" "), ls.q)) return false;
      return true;
    });

    /* ── الترتيب ── */
    var keyFn = {
      date: function (s) { return s.date; },
      total: function (s) { return s.total; },
      number: function (s) { return s.number; },
      customer: function (s) { return s.customerName; },
      items: function (s) { return HS.sum(s.items, function (i) { return i.qty; }); },
      profit: function (s) { return HS.store.saleProfit(s); }
    }[ls.sort] || function (s) { return s.date; };
    list = HS.sortBy(list, keyFn, ls.dir);

    /* ── الإحصاءات المحسوبة على النتيجة المفلترة ── */
    var totals = {
      count: list.length,
      revenue: HS.round(HS.sum(list.filter(function (s) { return s.status !== "returned"; }), function (s) { return s.total; }), 3),
      profit: HS.round(HS.sum(list.filter(function (s) { return s.status !== "returned"; }), function (s) {
        return HS.store.saleProfit(s);
      }), 3),
      discounts: HS.round(HS.sum(list, function (s) { return s.discount; }), 3),
      outstanding: HS.round(HS.sum(list, function (s) { return (s.status === "unpaid" || s.status === "partial") ? s.total - s.paid : 0; }), 3),
      returned: list.filter(function (s) { return s.status === "returned"; }).length,
      units: HS.sum(list.filter(function (s) { return s.status !== "returned"; }), function (s) { return HS.sum(s.items, function (i) { return i.qty; }); })
    };

    var counts = {
      all: all.length,
      paid: all.filter(function (s) { return s.status === "paid"; }).length,
      partial: all.filter(function (s) { return s.status === "partial"; }).length,
      unpaid: all.filter(function (s) { return s.status === "unpaid"; }).length,
      returned: all.filter(function (s) { return s.status === "returned"; }).length
    };

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || method || customerId || from || to || minTotal || tab !== "all");

    var tabs = [
      { id: "all", label: "الكل", count: counts.all },
      { id: "paid", label: "مدفوعة", count: counts.paid },
      { id: "partial", label: "جزئية", count: counts.partial },
      { id: "unpaid", label: "بالدين — غير محصّلة", count: counts.unpaid },
      { id: "returned", label: "مرتجعة", count: counts.returned }
    ];

    var columns = [
      { key: "number", label: "الفاتورة", sortable: true, width: "142px", render: function (s) {
          return '<a href="#/sales/' + HS.esc(s.id) + '" class="fw-600 ltr" style="display:inline-block">' + HS.esc(s.number) + '</a>';
        } },
      { key: "date", label: "التاريخ", sortable: true, width: "138px", render: function (s) {
          return '<span>' + HS.fmt.date(s.date) + '</span><span class="fs-xs text-3" style="display:block">' + HS.fmt.time(s.date) + '</span>';
        } },
      { key: "customer", label: "العميل", sortable: true, render: function (s) {
          return '<span class="row-2">' + HS.ui.avatar(s.customerName, "avatar--sm") + '<span class="truncate">' + HS.esc(s.customerName) + '</span></span>';
        } },
      { key: "items", label: "الأصناف", sortable: true, align: "num", width: "86px", render: function (s) {
          var u = HS.sum(s.items, function (i) { return i.qty; });
          return '<span title="' + HS.esc(s.items.map(function (i) { return i.name + " ×" + i.qty; }).join("، ")) + '">' +
            HS.fmt.int(s.items.length) + ' <span class="text-3 fs-xs">/ ' + HS.fmt.int(u) + '</span></span>';
        } },
      { key: "method", label: "الدفع", width: "118px", render: function (s) { return HS.ui.badge(HS.store.payMethod(s.method).name, "badge--outline"); } },
      { key: "discount", label: "الخصم", align: "num", width: "96px", render: function (s) {
          return s.discount ? '<span class="text-danger">' + HS.fmt.money(s.discount) + '</span>' : '<span class="text-3">—</span>';
        } },
      { key: "total", label: "الإجمالي", sortable: true, align: "num", width: "126px", render: function (s) {
          return '<span class="fw-700">' + HS.fmt.money(s.total) + '</span>';
        } },
      { key: "profit", label: "الربح", sortable: true, align: "num", width: "116px", hide: !HS.store.can("reports_view"), render: function (s) {
          var p = HS.store.saleProfit(s);
          return '<span class="' + (p >= 0 ? "text-success" : "text-danger") + '">' + HS.fmt.money(p) + '</span>';
        } },
      { key: "status", label: "الحالة", align: "center", sortable: false, width: "128px", render: function (s) { return HS.ui.saleStatus(s.status); } },
      { key: "actions", label: "", align: "center", width: "106px", render: function (s) {
          var due = s.total - s.paid;
          return '<span class="table__actions">' +
            (due > 0.001 && s.status !== "returned" ? HS.ui.iconBtn("inv-pay", "cash", "تسجيل سداد", { id: s.id }) : "") +
            HS.ui.iconBtn("inv-print", "print", "طباعة", { id: s.id }) +
            HS.ui.iconBtn("inv-menu", "more", "إجراءات أخرى", { id: s.id }) +
            '</span>';
        } }
    ];

    root.innerHTML = '<div class="stack page-enter">' +

      '<section class="stat-strip no-print">' +
        HS.ui.statMini("عدد الفواتير", HS.fmt.int(totals.count), filtersActive ? "من النتيجة المفلترة" : "الإجمالي الكلي") +
        HS.ui.statMini("قيمة المبيعات", HS.fmt.money(totals.revenue), "بعد استبعاد المرتجع") +
        HS.ui.statMini("صافي الربح", HS.fmt.money(totals.profit), "هامش " + HS.fmt.pct(totals.revenue ? totals.profit / totals.revenue : 0, 1)) +
        HS.ui.statMini("الخصومات الممنوحة", HS.fmt.money(totals.discounts), HS.fmt.int(totals.units) + " وحدة مباعة") +
        HS.ui.statMini("مستحق غير محصّل", HS.fmt.money(totals.outstanding), HS.fmt.int(totals.returned) + " فاتورة مرتجعة") +
      '</section>' +

      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +

        HS.ui.toolbar({
          q: ls.q, placeholder: "بحث برقم الفاتورة أو اسم العميل أو الصنف…",
          filters:
            HS.ui.select({ name: "method", label: "طريقة الدفع", value: method, options: [{ value: "", label: "كل الطرق" }].concat(HS.data.PAY_METHODS.map(function (m) { return { value: m.id, label: m.name }; })) }) +
            HS.ui.select({ name: "customer", label: "العميل", value: customerId, options: [{ value: "", label: "كل العملاء" }].concat(st.customers.map(function (c) { return { value: c.id, label: c.name }; })) }) +
            '<span class="row-2"><input class="input input--sm" type="date" name="from" value="' + HS.esc(from) + '" data-filter aria-label="من تاريخ">' +
            '<span class="text-3">—</span>' +
            '<input class="input input--sm" type="date" name="to" value="' + HS.esc(to) + '" data-filter aria-label="إلى تاريخ"></span>' +
            '<input class="input input--sm input--num" type="number" name="min" min="0" step="1" value="' + (minTotal || "") + '" data-filter placeholder="أدنى إجمالي" aria-label="أدنى إجمالي" style="max-width:132px">' +
            (filtersActive ? '<button type="button" class="chip" data-action="sales-clear">' + HS.icon("x", 13) + ' إزالة المرشّحات</button>' : ""),
          actions:
            '<button type="button" class="btn btn--sm btn--secondary" data-action="sales-export">' +
            '<span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير CSV</span></button>' +
            '<a class="btn btn--sm btn--primary" href="#/pos"><span class="btn__icon">' + HS.icon("cart", 15) + '</span><span class="btn__label">بيع جديد</span></a>'
        }) +

        HS.ui.table(columns, paged, {
          sort: { key: ls.sort, dir: ls.dir },
          rowAttrs: function (s) { return ' data-selectable="true" data-action="goto" data-href="#/sales/' + HS.esc(s.id) + '"'; },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "receipt",
            title: filtersActive ? "لا فواتير مطابقة للمرشّحات" : "لا فواتير مسجّلة بعد",
            text: filtersActive ? "جرّب توسيع نطاق التاريخ أو إزالة بعض المرشّحات." : "ابدأ أول عملية بيع من نقطة البيع.",
            action: filtersActive
              ? '<button type="button" class="btn btn--secondary btn--sm" data-action="sales-clear">إزالة المرشّحات</button>'
              : '<a class="btn btn--primary btn--sm" href="#/pos">فتح نقطة البيع</a>'
          }),
          foot: paged.length ? (function () {
            var f = ["", "", '<span class="text-3 fw-500">إجمالي الصفحة (' + HS.fmt.int(paged.length) + ')</span>',
              HS.fmt.int(HS.sum(paged, function (s) { return HS.sum(s.items, function (i) { return i.qty; }); })),
              "", HS.fmt.money(HS.sum(paged, function (s) { return s.discount; })),
              '<span class="fw-700">' + HS.fmt.money(HS.sum(paged, function (s) { return s.total; })) + '</span>'];
            if (HS.store.can("reports_view")) f.push(HS.fmt.money(HS.round(HS.sum(paged, HS.store.saleProfit), 3)));
            f.push("", "");
            return f;
          })() : null
        }) +

        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    /* ── التفاعل ── */
    root.querySelectorAll("[data-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {};
        root.querySelectorAll("[data-filter]").forEach(function (x) { patch[x.name] = x.value || null; });
        patch.page = null;
        ctx.setQuery(patch);
      });
    });
  };

  HS.action("tab", function (btn) {
    var ctx = HS.router.current();
    if (!ctx) return;
    ctx.setQuery({ tab: btn.getAttribute("data-tab"), page: null });
  });

  HS.action("sort", function (btn) {
    var ctx = HS.router.current();
    if (!ctx) return;
    var key = btn.getAttribute("data-key");
    var cur = ctx.query.sort;
    var dir = ctx.query.dir || "desc";
    if (cur === key) dir = dir === "asc" ? "desc" : "asc";
    else { dir = key === "date" || key === "customer" || key === "number" ? "desc" : "desc"; }
    ctx.setQuery({ sort: key, dir: dir, page: null });
  });

  HS.action("page", function (btn) {
    var ctx = HS.router.current();
    if (!ctx) return;
    var p = parseInt(btn.getAttribute("data-page"), 10);
    if (!p || p < 1) return;
    ctx.setQuery({ page: p > 1 ? p : null });
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  HS.action("sales-clear", function () {
    var ctx = HS.router.current();
    if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, method: null, customer: null, from: null, to: null, min: null, page: null, sort: null, dir: null });
  });

  HS.action("sales-export", function () {
    var ctx = HS.router.current();
    if (!ctx) return;
    var st = HS.store.state;
    var tab = ctx.query.tab || "all";
    var rows = st.sales.filter(function (s) { return s.status !== "held" && (tab === "all" || s.status === tab); });
    if (!rows.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لا بيانات للتصدير" }); return; }
    var csv = HS.toCSV(rows.map(function (s) {
      return {
        "رقم الفاتورة": s.number,
        "التاريخ": s.date,
        "العميل": s.customerName,
        "عدد الأصناف": s.items.length,
        "الوحدات": HS.sum(s.items, function (i) { return i.qty; }),
        "المجموع": s.subtotal,
        "الخصم": s.discount,
        "الضريبة": s.tax,
        "الإجمالي": s.total,
        "المدفوع": s.paid,
        "طريقة الدفع": HS.store.payMethod(s.method).name,
        "الحالة": HS.ui.saleStatusLabel(s.status),
        "الكاشير": (HS.store.user(s.cashierId) || {}).name || ""
      };
    }));
    var ok = HS.download("مبيعات-" + HS.date.toISO(new Date()) + ".csv", csv);
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّر الملف" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " فاتورة بصيغة CSV" : "المتصفح منع التنزيل." });
  });

  HS.action("inv-menu", function (btn) {
    var id = btn.getAttribute("data-id");
    var sale = HS.store.sale(id);
    if (!sale) return;
    var html =
      HS.ui.popItem("عرض الفاتورة", "receipt", "goto", { href: "#/sales/" + sale.id }) +
      HS.ui.popItem("طباعة الإيصال", "print", "inv-print", { id: id }) +
      HS.ui.popItem("نسخ رقم الفاتورة", "copy", "inv-copy", { id: id }) +
      (sale.status !== "returned" && HS.store.can("sales_refund") ? '<div class="pop__sep"></div>' + HS.ui.popItem("إرجاع الفاتورة", "undo", "inv-return", { id: id }, "pop__item--danger") : "");
    HS.ui.pop(btn, html);
  });
})();
