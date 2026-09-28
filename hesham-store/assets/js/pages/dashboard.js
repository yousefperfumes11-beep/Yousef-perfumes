/* ═══════════════════════════════════════════════════════════
   pages/dashboard.js — لوحة التحكم
   وضع «Operate»: المسح البصري والاتساق قبل التعبير.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  function delta(d) { return d; }

  HS.pages.dashboard = function (root, ctx) {
    var st = HS.store.state;
    var period = st.ui.period || "30d";
    var range = HS.store.range(period);
    var k = HS.store.kpis(range);
    var metric = ctx.query.metric || "revenue";

    var today = HS.store.range("today");
    var kt = HS.store.kpis(today);
    /* الصندوق: رصيد الدرج الآن وحركة اليوم — أرقام حقيقية لا تقديرية */
    var cashAll = HS.store.cash(HS.store.range("all"));
    var cashToday = HS.store.cash(today);
    var debtsToday = HS.store.debts(today);
    var expToday = HS.round(HS.sum(HS.store.inRange(st.expenses, today), function (e) { return e.amount; }), 3);

    HS.ui.setHeader({
      title: "لوحة التحكم",
      sub: "نظرة على أداء " + st.settings.storeName + " خلال " + range.label.toLowerCase() +
           " (" + HS.fmt.date(range.from) + " إلى " + HS.fmt.date(range.to) + ")",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "لوحة التحكم" }]
    });

    /* ── سلاسل المخططات ── */
    var dailyRev = HS.store.daily(range);
    var dailyProfitSeries = HS.store.daily(range, function (s) {
      if (s.status === "returned") return 0;
      return s.total - HS.sum(s.items, function (it) { return it.qty * (it.cost || 0); });
    });
    var dailyCount = HS.store.daily(range, function (s) { return s.status === "returned" ? 0 : 1; });

    var seriesMap = {
      revenue: { s: dailyRev, name: "الإيرادات", color: "var(--primary)", fmt: function (v) { return HS.fmt.moneyShort(v); } },
      profit: { s: dailyProfitSeries, name: "صافي الربح", color: "var(--success)", fmt: function (v) { return HS.fmt.moneyShort(v); } },
      count: { s: dailyCount, name: "عدد الفواتير", color: "var(--info)", fmt: function (v) { return HS.fmt.int(v); } }
    };
    var active = seriesMap[metric] || seriesMap.revenue;

    var lineChart = HS.chart.line({
      labels: active.s.labels,
      series: [{ name: active.name, values: active.s.values, color: active.color, area: true }],
      height: 268,
      yFormat: active.fmt,
      showDots: active.s.labels.length <= 32,
      ariaLabel: "مخطط " + active.name + " خلال " + range.label
    });

    var cats = HS.store.byCategory(range).slice(0, 7);
    var catTotal = HS.sum(cats, function (c) { return c.revenue; });
    var donut = HS.chart.donut({
      data: cats.map(function (c, i) { return { label: c.name, value: c.revenue, color: c.color || HS.chart.palette[i] }; }),
      size: 196,
      center: HS.fmt.moneyShort(catTotal),
      centerSub: "إجمالي الفترة",
      centerSize: 19,
      ariaLabel: "توزيع الإيرادات حسب القسم"
    });

    var top = HS.store.topProducts(range, 7);
    var methods = HS.store.byMethod(range);
    var methodTotal = HS.sum(methods, function (m) { return m.value; });

    var low = HS.store.lowStock().slice(0, 6);
    var oos = HS.store.outOfStock().slice(0, 6);
    var over = HS.store.overdue().slice(0, 5);

    var recent = st.sales.filter(function (s) { return s.status !== "held"; }).slice(0, 9);

    var hours = HS.store.byHour(range).filter(function (b) { return b.value > 0 || b.count > 0; });

    /* ═══════ البناء ═══════ */
    var html = '<div class="dash page-enter">';

    /* ── شريط اليوم ── */
    html += '<section class="card" aria-label="ملخص اليوم"><div class="card__body" style="display:flex;gap:var(--sp-6);flex-wrap:wrap;align-items:center">' +
      '<div class="row-2" style="gap:var(--sp-3)"><span style="color:var(--primary)">' + HS.icon("store", 22) + '</span>' +
      '<div><div class="fw-600">' + HS.esc(st.settings.storeName) + '</div>' +
      '<div class="fs-xs text-3">' + HS.esc(st.settings.branch) + ' · ' + HS.esc(st.settings.address) + '</div></div></div>' +
      '<div class="row" style="gap:var(--sp-6);flex-wrap:wrap;margin-inline-start:auto">' +
        miniToday("مبيعات اليوم", HS.fmt.money(kt.revenue), kt.invoices + " فاتورة · " + kt.units + " وحدة") +
        miniToday("ربح اليوم", HS.fmt.money(kt.profit), "هامش " + HS.fmt.pct(kt.margin, 1)) +
        miniToday("مصروفات اليوم", HS.fmt.money(expToday), expToday > 0 ? "مُقيّدة في الفترة" : "لا مصروفات بعد") +
        miniToday("صافي اليوم", HS.fmt.money(HS.round(kt.profit - expToday, 3)), "الربح بعد المصروفات") +
        miniToday("نقد دخل الصندوق اليوم", HS.fmt.money(cashToday.inflow), HS.fmt.int(cashToday.inCount) + " عملية · خرج " + HS.fmt.money(cashToday.outflow)) +
        miniToday("ديون حُصّلت اليوم", HS.fmt.money(debtsToday.totalCollected), debtsToday.collectedCount + " عملية سداد") +
      '</div></div></section>';

    /* ── مؤشرات الأداء ── */
    html += '<section class="grid-kpi stagger" aria-label="مؤشرات الأداء">';
    html += HS.ui.kpi({
      label: "إجمالي المبيعات", value: HS.fmt.money(k.revenue), icon: "cash", iconColor: "var(--primary)",
      delta: delta(k.revenueDelta), note: "مقابل " + HS.fmt.money(k.prevRevenue) + " في الفترة السابقة",
      spark: HS.chart.spark(dailyRev.values, { color: "var(--primary)", width: 220, height: 32 }), accent: true
    });
    html += HS.ui.kpi({
      label: "صافي الربح", value: HS.fmt.money(k.profit), icon: "trending-up", iconColor: "var(--success)",
      delta: delta(k.profitDelta), note: "هامش " + HS.fmt.pct(k.margin, 1) + " · بعد المصروفات " + HS.fmt.money(k.net),
      spark: HS.chart.spark(dailyProfitSeries.values, { color: "var(--success)", width: 220, height: 32 })
    });
    html += HS.ui.kpi({
      label: "عدد الفواتير", value: HS.fmt.int(k.invoices), icon: "receipt", iconColor: "var(--info)",
      delta: delta(k.invoicesDelta), note: "متوسط " + HS.fmt.money(k.avgBasket) + " للفاتورة"
    });
    html += HS.ui.kpi({
      label: "الأصناف المباعة", value: HS.fmt.int(k.units), icon: "box", iconColor: "var(--accent)",
      delta: delta(k.unitsDelta), note: HS.fmt.num(k.avgItems, { maximumFractionDigits: 1 }) + " صنف في الفاتورة · " + HS.fmt.int(k.returns) + " مرتجع"
    });
    html += HS.ui.kpi({
      label: "الرصيد النقدي في الصندوق", value: HS.fmt.money(cashAll.expected), icon: "cash", iconColor: "var(--warning)",
      href: "#/cash",
      note: "خارج الصندوق " + HS.fmt.money(HS.round(HS.store.cash(range).notInCash, 3)) + " (بطاقة ودين)"
    });
    html += '</section>';

    /* ── المخطط الرئيسي + الدائري ── */
    html += '<section class="grid-main">';

    html += '<article class="card"><div class="card__head">' +
      '<div><h2 class="card__title">اتجاه المبيعات</h2>' +
      '<p class="card__sub">' + HS.esc(range.label) + ' · ' + HS.fmt.int(active.s.labels.length) + ' يومًا</p></div>' +
      '<div class="seg seg--sm" role="group" aria-label="مقياس المخطط">' +
        ["revenue", "profit", "count"].map(function (m) {
          var lbl = m === "revenue" ? "الإيرادات" : m === "profit" ? "الأرباح" : "الفواتير";
          return '<button type="button" class="seg__btn" data-action="dash-metric" data-metric="' + m + '" aria-pressed="' + (m === metric) + '">' + lbl + '</button>';
        }).join("") +
      '</div></div>' +
      '<div class="card__body"><div class="chart-box" data-chart="main">' + lineChart.html + '</div>' +
      summaryStrip(active.s.values) +
      '</div></article>';

    html += '<article class="card"><div class="card__head">' +
      '<div><h2 class="card__title">الإيرادات حسب القسم</h2>' +
      '<p class="card__sub">' + HS.fmt.int(cats.length) + ' أقسام نشطة</p></div>' +
      '<button type="button" class="icon-btn icon-btn--sm" data-action="goto" data-href="#/reports" aria-label="التقارير التفصيلية" title="التقارير التفصيلية">' + HS.icon("external", 16) + '</button>' +
      '</div><div class="card__body">' +
      '<div class="center" style="gap:var(--sp-4)"><div class="chart-box" style="max-width:196px">' + donut.html + '</div></div>' +
      '<div class="list" style="margin-block-start:var(--sp-4)">' +
      cats.slice(0, 6).map(function (c) {
        var share = catTotal ? c.revenue / catTotal : 0;
        return '<div class="list__item" style="padding-block:var(--sp-2)">' +
          '<span class="thumb" style="inline-size:30px;block-size:30px;font-size:15px" aria-hidden="true">' + (c.emoji || "📦") + '</span>' +
          '<span class="list__body"><span class="list__title">' + HS.esc(c.name) + '</span>' +
          '<span class="list__meta">' + HS.fmt.pct(share, 1) + ' من الإيرادات · ' + HS.fmt.int(c.units) + ' وحدة</span></span>' +
          '<span class="list__aside fw-600 tabular fs-sm">' + HS.fmt.money(c.revenue) + '</span></div>';
      }).join("") +
      '</div></div></article>';
    html += '</section>';

    /* ── الصف الثالث: أعلى المنتجات، طرق الدفع، تنبيهات المخزون ── */
    html += '<section class="grid-3 stagger">';

    html += '<article class="card"><div class="card__head"><div><h2 class="card__title">الأكثر مبيعًا</h2>' +
      '<p class="card__sub">حسب الكمية المباعة</p></div></div><div class="card__body">' +
      (top.length ? '<div class="rank">' + HS.chart.hbar(top.map(function (t) { return { label: t.name, value: t.qty }; }), {
        format: function (v) { return HS.fmt.int(v) + " وحدة"; }
      }) + '</div>' : HS.ui.empty({ icon: "inbox", title: "لا مبيعات في هذه الفترة" })) +
      '</div><div class="card__foot spread"><span class="fs-xs text-3">' + HS.fmt.int(top.length) + ' من أصل ' + HS.fmt.int(st.products.length) + ' صنفًا</span>' +
      '<button type="button" class="link" data-action="goto" data-href="#/reports?tab=products">التقرير الكامل</button></div></article>';

    html += '<article class="card"><div class="card__head"><div><h2 class="card__title">طرق الدفع</h2>' +
      '<p class="card__sub">توزيع قيمة المبيعات</p></div></div><div class="card__body">' +
      (methods.length ? methods.map(function (m) {
        var share = methodTotal ? m.value / methodTotal : 0;
        return '<div style="margin-block-end:var(--sp-3)">' +
          '<div class="spread fs-sm" style="margin-block-end:var(--sp-1)">' +
          '<span class="row-2"><span style="inline-size:9px;block-size:9px;border-radius:2px;background:' + m.color + '" aria-hidden="true"></span>' + HS.esc(m.name) + '</span>' +
          '<span class="tabular fw-600">' + HS.fmt.money(m.value) + ' <span class="text-3 fw-400">(' + HS.fmt.pct(share, 0) + ')</span></span></div>' +
          '<div class="progress"><span class="progress__fill" style="width:' + (share * 100).toFixed(1) + '%;background:' + m.color + '"></span></div></div>';
      }).join("") : HS.ui.empty({ icon: "wallet", title: "لا مدفوعات في هذه الفترة" })) +
      (methods.length ? '<p class="fs-2xs text-3" style="margin-block-start:var(--sp-2);padding-block-start:var(--sp-2);border-block-start:1px solid var(--border-soft)">' +
        'دخل الصندوق منها <b class="tabular">' + HS.fmt.money(HS.round(HS.store.cash(range).cashCollected + HS.store.cash(range).creditDownPayment, 3)) + '</b> نقدًا، ' +
        'و<b class="tabular">' + HS.fmt.money(HS.store.cash(range).cardSales) + '</b> بالبطاقة خارج الصندوق، ' +
        'و<b class="tabular">' + HS.fmt.money(HS.store.cash(range).creditOutstanding) + '</b> دين لم يُحصّل بعد.</p>' : "") +
      '</div><div class="card__foot spread"><span class="fs-xs text-3">ثلاث طرق فقط: نقدي · بطاقة · دين</span>' +
      '<button type="button" class="link" data-action="goto" data-href="#/cash">تقرير الصندوق</button></div></article>';

    var alertItems = oos.map(function (p) {
      return { p: p, tone: "danger", label: "نفد" };
    }).concat(low.map(function (p) { return { p: p, tone: "warning", label: "منخفض" }; }));

    html += '<article class="card"><div class="card__head"><div><h2 class="card__title">تنبيهات المخزون</h2>' +
      '<p class="card__sub">' + HS.fmt.int(oos.length) + ' نافد · ' + HS.fmt.int(low.length) + ' تحت الحد</p></div>' +
      '<button type="button" class="btn btn--sm btn--soft" data-action="goto" data-href="#/inventory?tab=low">' +
      '<span class="btn__icon">' + HS.icon("layers", 15) + '</span><span class="btn__label">معالجة</span></button></div>' +
      '<div class="card__body" style="padding-block:var(--sp-2)">' +
      (alertItems.length ? '<div class="list">' + alertItems.slice(0, 7).map(function (a) {
        return '<div class="list__item">' +
          '<span class="thumb" aria-hidden="true">' + (a.p.emoji || "📦") + '</span>' +
          '<span class="list__body"><span class="list__title">' + HS.esc(a.p.name) + '</span>' +
          '<span class="list__meta">الحد الأدنى ' + HS.fmt.int(a.p.minStock) + ' ' + HS.esc(a.p.unit) + '</span></span>' +
          '<span class="list__aside">' + HS.ui.badge(HS.fmt.int(a.p.stock) + " " + a.label, a.tone === "danger" ? "badge--danger" : "badge--warning") + '</span></div>';
      }).join("") + '</div>' : HS.ui.empty({ icon: "check-circle", title: "المخزون بحالة جيدة", text: "لا توجد أصناف تحت الحد الأدنى للطلب." })) +
      '</div></article>';
    html += '</section>';

    /* ── الصف الرابع: ساعات الذروة + الديون ── */
    html += '<section class="grid-main">';

    html += '<article class="card"><div class="card__head"><div><h2 class="card__title">أحدث الفواتير</h2>' +
      '<p class="card__sub">آخر ' + HS.fmt.int(recent.length) + ' عمليات</p></div>' +
      '<button type="button" class="btn btn--sm btn--secondary" data-action="goto" data-href="#/sales">' +
      '<span class="btn__label">كل المبيعات</span><span class="btn__icon">' + HS.icon("chevron-left", 15) + '</span></button></div>' +
      '<div class="card__body card__body--flush">' +
      HS.ui.table([
        { key: "number", label: "رقم الفاتورة", render: function (s) {
            return '<a href="#/sales/' + HS.esc(s.id) + '" class="fw-600 ltr" style="display:inline-block">' + HS.esc(s.number) + '</a>';
          }, width: "150px" },
        { key: "date", label: "التاريخ", render: function (s) {
            return '<span class="fs-sm">' + HS.fmt.date(s.date) + '</span><span class="fs-xs text-3" style="display:block">' + HS.fmt.time(s.date) + '</span>';
          }, width: "130px" },
        { key: "customer", label: "العميل", render: function (s) {
            return '<span class="row-2">' + HS.ui.avatar(s.customerName, "avatar--sm") +
              '<span class="truncate">' + HS.esc(s.customerName) + '</span></span>';
          } },
        { key: "items", label: "الأصناف", align: "num", render: function (s) { return HS.fmt.int(HS.sum(s.items, function (i) { return i.qty; })); }, width: "80px" },
        { key: "method", label: "الدفع", render: function (s) { return HS.ui.badge(HS.store.payMethod(s.method).name, "badge--outline"); }, width: "110px" },
        { key: "status", label: "الحالة", align: "center", render: function (s) { return HS.ui.saleStatus(s.status); }, width: "120px" },
        { key: "total", label: "الإجمالي", align: "num", render: function (s) { return '<span class="fw-700">' + HS.fmt.money(s.total) + '</span>'; }, width: "130px" }
      ], recent, {
        rowAttrs: function (s) { return ' data-selectable="true" data-action="goto" data-href="#/sales/' + HS.esc(s.id) + '"'; },
        empty: HS.ui.empty({ icon: "receipt", title: "لا فواتير بعد", text: "ابدأ عملية بيع من نقطة البيع." })
      }) +
      '</div></article>';

    html += '<article class="stack" style="gap:var(--sp-4)">';

    /* ساعات الذروة */
    if (hours.length) {
      var hourChart = HS.chart.bar({
        labels: hours.map(function (h) { return HS.fmt.int(h.h) + ""; }),
        series: [{ name: "المبيعات", values: hours.map(function (h) { return h.value; }), color: "var(--accent)" }],
        height: 158, compact: true, maxBar: 22,
        yFormat: function (v) { return HS.fmt.moneyShort(v); },
        ariaLabel: "توزيع المبيعات على ساعات اليوم"
      });
      html += '<article class="card"><div class="card__head"><div><h2 class="card__title">ساعات الذروة</h2>' +
        '<p class="card__sub">أعلى ساعة: ' + HS.fmt.int(peakHour(hours).h) + ':00</p></div></div>' +
        '<div class="card__body"><div class="chart-box">' + hourChart.html + '</div>' +
        '<p class="fs-xs text-3" style="margin-block-start:var(--sp-2)">الساعات معروضة بتوقيت المحل.</p></div></article>';
    }

    /* الديون المستحقة */
    html += '<article class="card"><div class="card__head"><div><h2 class="card__title">ديون مستحقة</h2>' +
      '<p class="card__sub">' + HS.fmt.int(over.length) + ' فواتير تجاوزت ' + HS.fmt.int(st.settings.maxCreditDays) + ' يومًا</p></div></div>' +
      '<div class="card__body" style="padding-block:var(--sp-2)">' +
      (over.length ? '<div class="list">' + over.map(function (o) {
        return '<div class="list__item">' +
          '<span class="list__body"><span class="list__title">' + HS.esc(o.sale.customerName) + '</span>' +
          '<span class="list__meta ltr" style="text-align:right">' + HS.esc(o.sale.number) + ' · متأخرة ' + HS.fmt.int(o.age) + ' يومًا</span></span>' +
          '<span class="list__aside fw-700 text-danger tabular">' + HS.fmt.money(o.due) + '</span></div>';
      }).join("") + '</div>' :
      HS.ui.empty({ icon: "check-circle", title: "لا ديون متأخرة", text: "كل فواتير الدين ضمن المدة المتفق عليها." })) +
      '</div></article>';

    html += '</article></section>';
    html += '</div>';

    root.innerHTML = html;
    HS.icons.hydrate(root);

    /* تلميحات المخطط */
    var mainBox = root.querySelector('[data-chart="main"]');
    if (mainBox) {
      HS.chart.attachTip(mainBox, function (hit) {
        var i = parseInt(hit.getAttribute("data-i"), 10);
        var lbl = active.s.labels[i];
        var v = active.s.values[i];
        var day = active.s.days ? active.s.days[i] : null;
        var cnt = dailyCount.values[i];
        return '<div class="chart-tip__lbl">' + HS.esc(day ? HS.fmt.date(day) : lbl) + '</div>' +
          '<div class="fw-600">' + HS.esc(active.fmt(v)) + '</div>' +
          '<div class="chart-tip__lbl">' + HS.fmt.int(cnt) + ' فاتورة</div>';
      });
    }

    function miniToday(label, value, note) {
      return '<div><div class="fs-xs text-3">' + HS.esc(label) + '</div>' +
        '<div class="fw-700 fs-lg tabular" style="letter-spacing:var(--tr-sm)">' + value + '</div>' +
        (note ? '<div class="fs-2xs text-3" style="font-size:var(--fs-2xs)">' + HS.esc(note) + '</div>' : "") + '</div>';
    }
    function summaryStrip(vals) {
      var total = HS.sum(vals);
      var max = Math.max.apply(null, vals.concat([0]));
      var maxIdx = vals.indexOf(max);
      var avg = vals.length ? total / vals.length : 0;
      var activeDays = vals.filter(function (v) { return v > 0; }).length;
      return '<div class="row" style="gap:var(--sp-6);flex-wrap:wrap;margin-block-start:var(--sp-4);padding-block-start:var(--sp-3);border-block-start:1px solid var(--border-soft)">' +
        strip("الإجمالي", HS.fmt.money(total)) +
        strip("اليومي المتوسط", HS.fmt.money(avg)) +
        strip("أعلى يوم", HS.fmt.money(max), active.s.labels[maxIdx]) +
        strip("أيام بها مبيعات", HS.fmt.int(activeDays) + " / " + HS.fmt.int(vals.length)) +
        '</div>';
    }
    function strip(k, v, note) {
      return '<div><div class="fs-xs text-3">' + HS.esc(k) + '</div>' +
        '<div class="fw-700 tabular" style="font-size:var(--fs-base)">' + v + '</div>' +
        (note ? '<div class="text-3" style="font-size:var(--fs-2xs)">' + HS.esc(note) + '</div>' : "") + '</div>';
    }
    function peakHour(hs) {
      return hs.slice().sort(function (a, b) { return b.value - a.value; })[0] || { h: 0 };
    }
  };

  HS.action("dash-metric", function (btn) {
    HS.router.setQuery({ metric: btn.getAttribute("data-metric") }, { replace: true });
  });
})();
