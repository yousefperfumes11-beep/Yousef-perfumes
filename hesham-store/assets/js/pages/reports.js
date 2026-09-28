/* ═══════════════════════════════════════════════════════════
   pages/reports.js — التقارير والإحصاءات
   ستة تقارير محسوبة من البيانات المحلية + مركز تصدير.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  function monthKey(d) {
    var x = HS.date.toDate(d);
    return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0");
  }

  HS.pages.reports = function (root, ctx) {
    var st = HS.store.state;
    var tab = ctx.query.tab || "overview";
    var period = st.ui.period || "30d";
    var range = HS.store.range(period);
    var k = HS.store.kpis(range);

    HS.ui.setHeader({
      title: "التقارير",
      sub: "أرقام محسوبة من البيانات المحلية للفترة: " + range.label + " (" + HS.fmt.date(range.from) + " → " + HS.fmt.date(range.to) + ")",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "التقارير" }]
    });

    var sales = HS.store.salesOf(range);
    var valid = sales.filter(function (s) { return s.status !== "returned"; });
    var returned = sales.filter(function (s) { return s.status === "returned"; });

    var tabs = [
      { id: "overview", label: "الأرباح والخسائر", icon: "bar-chart" },
      { id: "sales", label: "تحليل المبيعات", icon: "trending-up" },
      { id: "products", label: "أداء الأصناف", icon: "box" },
      { id: "customers", label: "العملاء والديون", icon: "users" },
      { id: "cash", label: "الصندوق", icon: "cash" },
      { id: "inventory", label: "المخزون", icon: "layers" },
      { id: "purchases", label: "المشتريات والموردون", icon: "truck" },
      { id: "export", label: "مركز التصدير", icon: "download" }
    ];

    var html = '<div class="stack page-enter">' +
      '<section class="card no-print"><div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div></section>';

    if (tab === "overview") html += overview();
    else if (tab === "sales") html += salesReport();
    else if (tab === "products") html += productsReport();
    else if (tab === "customers") html += customersReport();
    else if (tab === "cash") html += cashReport();
    else if (tab === "inventory") html += inventoryReport();
    else if (tab === "purchases") html += purchasesReport();
    else html += exportCenter();

    html += '</div>';
    root.innerHTML = html;
    HS.icons.hydrate(root);

    /* ═══════════ ١) الأرباح والخسائر ═══════════ */
    function overview() {
      var expenses = HS.round(HS.sum(HS.store.inRange(st.expenses, range), function (e) { return e.amount; }), 3);
      var net = HS.round(k.profit - expenses, 3);
      var discounts = k.discounts;

      /* مقارنة شهرية لثلاثة أشهر */
      var months = [];
      var cur = new Date(range.to.getFullYear(), range.to.getMonth(), 1);
      for (var i = 0; i < 3; i++) {
        var from = new Date(cur.getFullYear(), cur.getMonth() - (2 - i), 1);
        var to = new Date(from.getFullYear(), from.getMonth() + 1, 0);
        var mr = { from: HS.date.startOfDay(from), to: HS.date.endOfDay(to), label: HS.fmt.month(from) };
        var ms = HS.store.validSalesOf(mr);
        var mrev = HS.round(HS.sum(ms, function (s) { return s.total; }), 3);
        var mcogs = HS.round(HS.sum(ms, function (s) { return HS.sum(s.items, function (it) { return it.qty * (it.cost || 0); }); }), 3);
        var mexp = HS.round(HS.sum(HS.store.inRange(st.expenses, mr), function (e) { return e.amount; }), 3);
        months.push({ label: mr.label, revenue: mrev, cogs: mcogs, gross: HS.round(mrev - mcogs, 3), expenses: mexp, net: HS.round(mrev - mcogs - mexp, 3) });
      }

      return '<section class="stack">' +
        '<div class="grid-kpi stagger">' +
          HS.ui.kpi({ label: "الإيرادات", value: HS.fmt.money(k.revenue), icon: "cash", iconColor: "var(--primary)", delta: k.revenueDelta, note: HS.fmt.int(k.invoices) + " فاتورة · متوسط " + HS.fmt.money(k.avgBasket), accent: true }) +
          HS.ui.kpi({ label: "تكلفة البضاعة المباعة", value: HS.fmt.money(k.cogs), icon: "box", iconColor: "var(--warning)", note: HS.fmt.pct(k.revenue ? k.cogs / k.revenue : 0, 1) + " من الإيرادات" }) +
          HS.ui.kpi({ label: "مجمل الربح", value: HS.fmt.money(k.profit), icon: "trending-up", iconColor: "var(--success)", delta: k.profitDelta, note: "هامش " + HS.fmt.pct(k.margin, 1) }) +
          HS.ui.kpi({ label: "صافي الربح", value: HS.fmt.money(net), icon: net >= 0 ? "wallet" : "alert", iconColor: net >= 0 ? "var(--primary)" : "var(--danger)", note: "بعد خصم مصروفات " + HS.fmt.money(expenses), invert: net < 0 }) +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">قائمة الدخل</h2>' +
          '<p class="card__sub">' + HS.esc(range.label) + '</p></div>' +
          '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="rep-print-pl"><span class="btn__icon">' + HS.icon("print", 15) + '</span><span class="btn__label">طباعة</span></button>' +
          '</div><div class="card__body">' +
          '<div class="pl">' +
            plRow("إجمالي المبيعات", k.revenue, true) +
            plRow("المرتجعات", -k.returnsValue) +
            plRow("الخصومات الممنوحة", -discounts) +
            plRow("صافي المبيعات", HS.round(k.revenue - k.returnsValue, 3), false, true) +
            plRow("تكلفة البضاعة المباعة", -k.cogs) +
            plRow("مجمل الربح", k.profit, false, true) +
            plRow("المصروفات التشغيلية", -expenses) +
            plRow("صافي الربح", net, false, true, net >= 0) +
          '</div>' +
          '<div class="spread" style="margin-block-start:var(--sp-4);padding-block-start:var(--sp-3);border-block-start:1px solid var(--border-soft)">' +
            '<span class="fs-xs text-3">هامش صافي الربح</span>' +
            '<span class="fw-700 ' + (net >= 0 ? "text-success" : "text-danger") + '">' + HS.fmt.pct(k.revenue ? net / k.revenue : 0, 1) + '</span>' +
          '</div>' +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">مقارنة الأشهر الثلاثة</h2>' +
          '<p class="card__sub">إيرادات مقابل صافي ربح</p></div></div><div class="card__body">' +
          '<div class="chart-box">' + HS.chart.bar({
            labels: months.map(function (m) { return m.label; }),
            series: [
              { name: "الإيرادات", values: months.map(function (m) { return m.revenue; }), color: "var(--primary)" },
              { name: "مجمل الربح", values: months.map(function (m) { return m.gross; }), color: "var(--success)" },
              { name: "صافي الربح", values: months.map(function (m) { return m.net; }), color: "var(--accent)" }
            ],
            height: 214, yFormat: function (v) { return HS.fmt.moneyShort(v); },
            ariaLabel: "مقارنة الإيرادات والأرباح شهريًا"
          }).html + '</div>' +
          HS.chart.legend([{ label: "الإيرادات", color: "var(--primary)" }, { label: "مجمل الربح", color: "var(--success)" }, { label: "صافي الربح", color: "var(--accent)" }]) +
          '<div class="card" style="box-shadow:none;margin-block-start:var(--sp-4)"><div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "m", label: "الشهر", render: function (m) { return '<span class="fw-500">' + HS.esc(m.label) + '</span>'; } },
            { key: "rev", label: "الإيرادات", align: "num", width: "118px", render: function (m) { return HS.fmt.money(m.revenue); } },
            { key: "gross", label: "مجمل الربح", align: "num", width: "118px", render: function (m) { return HS.fmt.money(m.gross); } },
            { key: "exp", label: "المصروفات", align: "num", width: "112px", render: function (m) { return '<span class="text-danger">' + HS.fmt.money(m.expenses) + '</span>'; } },
            { key: "net", label: "الصافي", align: "num", width: "118px", render: function (m) {
                return '<span class="fw-700 ' + (m.net >= 0 ? "text-success" : "text-danger") + '">' + HS.fmt.money(m.net) + '</span>';
              } }
          ], months) + '</div></div>' +
          '</div></article>' +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">توزيع المصروفات</h2>' +
          '<p class="card__sub">خلال الفترة المحددة</p></div></div><div class="card__body">' +
          expenseBreakdown() +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">مؤشرات الصحة المالية</h2>' +
          '<p class="card__sub">قراءة سريعة للمخاطر</p></div></div><div class="card__body">' +
          '<div class="stack" style="gap:var(--sp-4)">' +
            gauge("نسبة المصروفات إلى الإيرادات", expenses / Math.max(1, k.revenue), .18, .3, true) +
            gauge("هامش مجمل الربح", k.margin, .18, .3, false) +
            gauge("نسبة المرتجعات", k.invoices ? k.returns / k.invoices : 0, .03, .07, true) +
            gauge("نسبة مبيعات الدين غير المحصّلة", k.revenue ? k.outstanding / k.revenue : 0, .12, .25, true) +
          '</div></div></article>' +
        '</div>' +
      '</section>';
    }

    function plRow(label, amount, isTop, isBold, positive) {
      var neg = amount < 0;
      var cls = isBold ? "pl__row--bold" : "";
      return '<div class="pl__row ' + cls + '"><span class="pl__k">' + HS.esc(label) + '</span>' +
        '<span class="pl__v ' + (neg ? "text-danger" : positive === true ? "text-success" : positive === false && amount < 0 ? "text-danger" : "") + '">' +
        (neg ? "−" : "") + HS.fmt.money(Math.abs(amount)) + '</span></div>';
    }

    function expenseBreakdown() {
      var items = HS.store.inRange(st.expenses, range);
      if (!items.length) return HS.ui.empty({ icon: "wallet", title: "لا مصروفات في هذه الفترة" });
      var groups = {};
      items.forEach(function (e) { groups[e.category] = (groups[e.category] || 0) + e.amount; });
      var rows = Object.keys(groups).map(function (id) {
        var c = HS.store.expenseCat(id);
        return { id: id, name: c.name, emoji: c.emoji, total: HS.round(groups[id], 3), count: items.filter(function (e) { return e.category === id; }).length };
      }).sort(function (a, b) { return b.total - a.total; });
      var total = HS.sum(rows, function (r) { return r.total; });
      return '<div class="chart-box" style="max-width:190px;margin-inline:auto">' +
        HS.chart.donut({
          data: rows.map(function (r, i) { return { label: r.name, value: r.total, color: HS.chart.palette[i % HS.chart.palette.length] }; }),
          size: 176, center: HS.fmt.moneyShort(total), centerSub: "مصروفات الفترة", centerSize: 17,
          ariaLabel: "توزيع مصروفات الفترة"
        }).html + '</div>' +
        HS.chart.legend(rows.map(function (r, i) { return { label: r.name, color: HS.chart.palette[i % HS.chart.palette.length] }; })) +
        '<div class="list" style="margin-block-start:var(--sp-3)">' + rows.map(function (r, i) {
          var share = total ? r.total / total : 0;
          return '<div class="list__item" style="padding-block:var(--sp-2)">' +
            '<span class="thumb thumb--sm" aria-hidden="true">' + r.emoji + '</span>' +
            '<span class="list__body"><span class="list__title">' + HS.esc(r.name) + '</span>' +
            '<span class="list__meta">' + HS.fmt.int(r.count) + " عملية · " + HS.fmt.pct(share, 1) + '</span></span>' +
            '<span class="list__aside fw-600 tabular fs-sm">' + HS.fmt.money(r.total) + '</span></div>';
        }).join("") + '</div>';
    }

    function gauge(label, value, good, bad, lowerIsBetter) {
      var pct = HS.clamp(value, 0, 1);
      var ok = lowerIsBetter ? value <= good : value >= good;
      var warn = lowerIsBetter ? value <= bad : value >= good * .7;
      var color = ok ? "var(--success)" : warn ? "var(--warning)" : "var(--danger)";
      return '<div><div class="spread fs-sm" style="margin-block-end:var(--sp-1)">' +
        '<span class="text-2">' + HS.esc(label) + '</span>' +
        '<span class="fw-700 tabular" style="color:' + color + '">' + HS.fmt.pct(value, 1) + '</span></div>' +
        '<div class="progress" style="height:8px"><span class="progress__fill" style="width:' + (pct * 100).toFixed(1) + '%;background:' + color + '"></span></div>' +
        '<div class="fs-2xs text-3" style="margin-block-start:2px">' +
          (ok ? "ضمن النطاق الجيد" : warn ? "يستحق المتابعة" : "يتطلب إجراءً") +
          " · المستهدف " + (lowerIsBetter ? "أقل من " + HS.fmt.pct(good, 0) : "أعلى من " + HS.fmt.pct(good, 0)) +
        '</div></div>';
    }

    /* ═══════════ ٢) تحليل المبيعات ═══════════ */
    function salesReport() {
      var daily = HS.store.daily(range);
      var byWeekday = HS.store.byWeekday(range);
      var byHour = HS.store.byHour(range);
      var byMethod = HS.store.byMethod(range);
      var methodTotal = HS.sum(byMethod, function (m) { return m.value; });

      var byCashier = {};
      valid.forEach(function (s) {
        var u = HS.store.user(s.cashierId);
        var name = u ? u.name : "غير محدد";
        if (!byCashier[name]) byCashier[name] = { name: name, count: 0, revenue: 0, profit: 0, units: 0 };
        byCashier[name].count++;
        byCashier[name].revenue += s.total;
        byCashier[name].units += HS.sum(s.items, function (i) { return i.qty; });
        byCashier[name].profit += HS.store.saleProfit(s);
      });
      var cashiers = Object.keys(byCashier).map(function (n) { return byCashier[n]; }).sort(function (a, b) { return b.revenue - a.revenue; });

      var dayTotals = daily.values;
      var best = dayTotals.indexOf(Math.max.apply(null, dayTotals.concat([0])));
      var worstIdx = -1, worstVal = Infinity;
      dayTotals.forEach(function (v, i) { if (v > 0 && v < worstVal) { worstVal = v; worstIdx = i; } });

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("عدد الفواتير", HS.fmt.int(k.invoices), HS.fmt.num(k.invoices / Math.max(1, k.span), { maximumFractionDigits: 1 }) + " في اليوم") +
          HS.ui.statMini("متوسط قيمة الفاتورة", HS.fmt.money(k.avgBasket), HS.fmt.num(k.avgItems, { maximumFractionDigits: 1 }) + " صنف للفاتورة") +
          HS.ui.statMini("أفضل يوم", daily.labels[best] || "—", HS.fmt.money(dayTotals[best] || 0)) +
          HS.ui.statMini("أضعف يوم", worstIdx >= 0 ? daily.labels[worstIdx] : "—", worstIdx >= 0 ? HS.fmt.money(worstVal) : "لا مبيعات") +
          HS.ui.statMini("المرتجعات", HS.fmt.int(k.returns), HS.fmt.money(k.returnsValue) + " قيمة") +
        '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">المبيعات اليومية</h2>' +
        '<p class="card__sub">' + HS.fmt.int(daily.labels.length) + ' يومًا · إجمالي ' + HS.fmt.money(HS.sum(dayTotals)) + '</p></div></div>' +
        '<div class="card__body"><div class="chart-box">' +
        HS.chart.line({
          labels: daily.labels,
          series: [{ name: "المبيعات", values: dayTotals, color: "var(--primary)", area: true }],
          height: 250, yFormat: function (v) { return HS.fmt.moneyShort(v); },
          showDots: daily.labels.length <= 32,
          ariaLabel: "المبيعات اليومية خلال الفترة"
        }).html + '</div></div></article>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">أداء أيام الأسبوع</h2>' +
          '<p class="card__sub">متوسط المبيعات لكل يوم</p></div></div><div class="card__body">' +
          (byWeekday.length ? '<div class="chart-box">' + HS.chart.bar({
            labels: byWeekday.map(function (d) { return d.label.slice(0, 3); }),
            series: [{ name: "المتوسط", values: byWeekday.map(function (d) { return d.avg; }), color: "var(--accent)" }],
            height: 196, yFormat: function (v) { return HS.fmt.moneyShort(v); },
            ariaLabel: "متوسط المبيعات حسب يوم الأسبوع"
          }).html + '</div>' +
          '<div class="card" style="box-shadow:none;margin-block-start:var(--sp-3)"><div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "d", label: "اليوم", render: function (d) { return '<span class="fw-500">' + HS.esc(d.label) + '</span>'; } },
            { key: "c", label: "الفواتير", align: "num", width: "92px", render: function (d) { return HS.fmt.int(d.count); } },
            { key: "avg", label: "المتوسط", align: "num", width: "124px", render: function (d) { return '<span class="fw-600">' + HS.fmt.money(d.avg) + '</span>'; } },
            { key: "total", label: "الإجمالي", align: "num", width: "128px", render: function (d) { return HS.fmt.money(d.total); } }
          ], byWeekday) + '</div></div>' : HS.ui.empty({ icon: "calendar", title: "لا بيانات كافية" })) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">التوزيع على ساعات اليوم</h2>' +
          '<p class="card__sub">أين تتركّز الحركة</p></div></div><div class="card__body">' +
          (byHour.length ? '<div class="chart-box">' + HS.chart.bar({
            labels: byHour.map(function (h) { return HS.fmt.int(h.h); }),
            series: [{ name: "المبيعات", values: byHour.map(function (h) { return h.value; }), color: "var(--info)" }],
            height: 196, maxBar: 20, yFormat: function (v) { return HS.fmt.moneyShort(v); },
            ariaLabel: "توزيع المبيعات على ساعات اليوم"
          }).html + '</div>' +
          '<p class="fs-xs text-3" style="margin-block-start:var(--sp-3)">ذروة الحركة عند الساعة <b>' +
            HS.fmt.int((byHour.slice().sort(function (a, b) { return b.value - a.value; })[0] || { h: 0 }).h) + ':00</b> — يُستحسن تعزيز الورديات في هذا الوقت.</p>'
          : HS.ui.empty({ icon: "clock", title: "لا بيانات كافية" })) +
          '</div></article>' +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">طرق الدفع</h2>' +
          '<p class="card__sub">قيمة وعدد العمليات</p></div></div><div class="card__body">' +
          (byMethod.length ? HS.ui.table([
            { key: "m", label: "الطريقة", render: function (m) {
                return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (m.id === "cash" ? "💵" : m.id === "card" ? "💳" : m.id === "credit" ? "🧾" : "🏦") + '</span><span class="fw-500">' + HS.esc(m.name) + '</span></span>';
              } },
            { key: "c", label: "العمليات", align: "num", width: "96px", render: function (m) { return HS.fmt.int(m.count); } },
            { key: "v", label: "القيمة", align: "num", width: "132px", render: function (m) { return '<span class="fw-600">' + HS.fmt.money(m.value) + '</span>'; } },
            { key: "s", label: "النسبة", align: "num", width: "96px", render: function (m) { return HS.fmt.pct(methodTotal ? m.value / methodTotal : 0, 1); } }
          ], byMethod) : HS.ui.empty({ icon: "wallet", title: "لا مدفوعات في الفترة" })) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">أداء الكاشير</h2>' +
          '<p class="card__sub">حسب الإيرادات المحققة</p></div></div><div class="card__body card__body--flush">' +
          (cashiers.length ? HS.ui.table([
            { key: "n", label: "المستخدم", render: function (c) { return '<span class="row-2">' + HS.ui.avatar(c.name, "avatar--sm") + '<span class="fw-500 truncate">' + HS.esc(c.name) + '</span></span>'; } },
            { key: "c", label: "الفواتير", align: "num", width: "96px", render: function (c) { return HS.fmt.int(c.count); } },
            { key: "u", label: "الوحدات", align: "num", width: "92px", render: function (c) { return HS.fmt.int(c.units); } },
            { key: "r", label: "الإيرادات", align: "num", width: "132px", render: function (c) { return '<span class="fw-600">' + HS.fmt.money(HS.round(c.revenue, 3)) + '</span>'; } },
            { key: "p", label: "الربح", align: "num", width: "126px", render: function (c) { return HS.fmt.money(HS.round(c.profit, 3)); } },
            { key: "a", label: "متوسط الفاتورة", align: "num", width: "132px", render: function (c) { return HS.fmt.money(HS.round(c.revenue / Math.max(1, c.count), 3)); } }
          ], cashiers) : HS.ui.empty({ icon: "users", title: "لا مبيعات في الفترة" })) +
          '</div></article>' +
        '</div>' +
      '</section>';
    }

    /* ═══════════ ٣) أداء الأصناف ═══════════ */
    function productsReport() {
      var rows = {};
      valid.forEach(function (s) {
        s.items.forEach(function (it) {
          if (!rows[it.productId]) rows[it.productId] = { id: it.productId, name: it.name, qty: 0, revenue: 0, cost: 0, discount: 0, orders: 0 };
          var r = rows[it.productId];
          r.qty += it.qty; r.revenue += it.qty * it.price; r.cost += it.qty * (it.cost || 0);
          r.discount += it.discount || 0; r.orders++;
        });
      });
      var list = Object.keys(rows).map(function (id) {
        var r = rows[id];
        var p = HS.store.product(id);
        return Object.assign(r, {
          profit: HS.round(r.revenue - r.cost - r.discount, 3),
          revenue: HS.round(r.revenue - r.discount, 3),
          margin: r.revenue > 0 ? (r.revenue - r.cost - r.discount) / r.revenue : 0,
          stock: p ? p.stock : 0, unit: p ? p.unit : "", emoji: p ? p.emoji : "📦",
          category: p ? HS.store.cat(p.category).name : "—", exists: !!p
        });
      }).sort(function (a, b) { return b.revenue - a.revenue; });

      var soldIds = HS.uniq(list.map(function (r) { return r.id; }));
      var neverSold = st.products.filter(function (p) { return p.active && soldIds.indexOf(p.id) < 0; })
        .sort(function (a, b) { return (b.stock * b.cost) - (a.stock * a.cost); });
      var deadValue = HS.round(HS.sum(neverSold, function (p) { return p.stock * p.cost; }), 3);

      var byCat = {};
      list.forEach(function (r) {
        if (!byCat[r.category]) byCat[r.category] = { name: r.category, qty: 0, revenue: 0, profit: 0, items: 0 };
        byCat[r.category].qty += r.qty;
        byCat[r.category].revenue += r.revenue;
        byCat[r.category].profit += r.profit;
        byCat[r.category].items++;
      });
      var catRows = Object.keys(byCat).map(function (n) { return byCat[n]; }).sort(function (a, b) { return b.revenue - a.revenue; });
      var totalRev = HS.sum(list, function (r) { return r.revenue; });

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("أصناف بيعت", HS.fmt.int(list.length), "من " + HS.fmt.int(st.products.length) + " في الكتالوج") +
          HS.ui.statMini("أصناف لم تُبع", HS.fmt.int(neverSold.length), "رأس مال راكد " + HS.fmt.money(deadValue)) +
          HS.ui.statMini("إجمالي الوحدات", HS.fmt.int(HS.sum(list, function (r) { return r.qty; })), "خلال " + HS.fmt.int(k.span) + " يومًا") +
          HS.ui.statMini("متوسط هامش الأصناف", HS.fmt.pct(HS.avg(list.map(function (r) { return r.margin; })), 1), "مرجّح بالبيع") +
          HS.ui.statMini("أعلى صنف إيرادًا", list.length ? HS.esc(list[0].name.slice(0, 18)) : "—", list.length ? HS.fmt.money(list[0].revenue) : "") +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">أعلى 10 أصناف بالإيراد</h2>' +
          '<p class="card__sub">حسب صافي المبيعات</p></div></div><div class="card__body">' +
          (list.length ? '<div class="rank">' + HS.chart.hbar(list.slice(0, 10).map(function (r) { return { label: r.name, value: r.revenue }; }), { format: function (v) { return HS.fmt.money(v); } }) + '</div>' : HS.ui.empty({ icon: "box", title: "لا مبيعات" })) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">الإيراد حسب القسم</h2>' +
          '<p class="card__sub">' + HS.fmt.int(catRows.length) + ' أقسام</p></div></div><div class="card__body card__body--flush">' +
          (catRows.length ? HS.ui.table([
            { key: "n", label: "القسم", render: function (c) { return '<span class="fw-500">' + HS.esc(c.name) + '</span>'; } },
            { key: "i", label: "أصناف", align: "num", width: "82px", render: function (c) { return HS.fmt.int(c.items); } },
            { key: "q", label: "وحدات", align: "num", width: "88px", render: function (c) { return HS.fmt.int(c.qty); } },
            { key: "r", label: "الإيراد", align: "num", width: "128px", render: function (c) { return '<span class="fw-600">' + HS.fmt.money(HS.round(c.revenue, 3)) + '</span>'; } },
            { key: "p", label: "الربح", align: "num", width: "122px", render: function (c) { return HS.fmt.money(HS.round(c.profit, 3)); } },
            { key: "s", label: "الحصة", align: "num", width: "88px", render: function (c) { return HS.fmt.pct(totalRev ? c.revenue / totalRev : 0, 1); } }
          ], catRows) : HS.ui.empty({ icon: "pie-chart", title: "لا بيانات" })) +
          '</div></article>' +
        '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">جدول أداء الأصناف</h2>' +
        '<p class="card__sub">كل الأصناف التي بيعت خلال الفترة</p></div>' +
        '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="rep-export" data-kind="products"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
        '</div><div class="card__body card__body--flush">' +
        HS.ui.table([
          { key: "n", label: "الصنف", render: function (r) {
              return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + r.emoji + '</span>' +
                '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(r.name) + '</span>' +
                '<span class="fs-xs text-3" style="display:block">' + HS.esc(r.category) + '</span></span></span>';
            } },
          { key: "o", label: "الفواتير", align: "num", width: "92px", render: function (r) { return HS.fmt.int(r.orders); } },
          { key: "q", label: "الوحدات", align: "num", width: "96px", render: function (r) { return HS.fmt.int(r.qty) + ' <span class="text-3 fs-xs">' + HS.esc(r.unit) + '</span>'; } },
          { key: "r", label: "الإيراد", align: "num", width: "128px", render: function (r) { return '<span class="fw-600">' + HS.fmt.money(r.revenue) + '</span>'; } },
          { key: "c", label: "التكلفة", align: "num", width: "124px", render: function (r) { return HS.fmt.money(HS.round(r.cost, 3)); } },
          { key: "p", label: "الربح", align: "num", width: "124px", render: function (r) { return '<span class="' + (r.profit >= 0 ? "text-success" : "text-danger") + '">' + HS.fmt.money(r.profit) + '</span>'; } },
          { key: "m", label: "الهامش", align: "num", width: "92px", render: function (r) {
              return '<span class="' + (r.margin >= .25 ? "text-success" : r.margin < .12 ? "text-danger" : "") + '">' + HS.fmt.pct(r.margin, 1) + '</span>';
            } },
          { key: "s", label: "الرصيد", align: "num", width: "96px", render: function (r) { return r.exists ? HS.fmt.int(r.stock) : '<span class="text-3">—</span>'; } }
        ], list.slice(0, 60), {
          foot: ["", HS.fmt.int(HS.sum(list, function (r) { return r.orders; })),
            HS.fmt.int(HS.sum(list, function (r) { return r.qty; })),
            '<span class="fw-700">' + HS.fmt.money(HS.round(totalRev, 3)) + '</span>',
            HS.fmt.money(HS.round(HS.sum(list, function (r) { return r.cost; }), 3)),
            '<span class="fw-700 text-success">' + HS.fmt.money(HS.round(HS.sum(list, function (r) { return r.profit; }), 3)) + '</span>', "", ""]
        }) +
        (list.length > 60 ? '<p class="fs-xs text-3" style="padding:var(--sp-3)">يعرض أول 60 صنفًا من أصل ' + HS.fmt.int(list.length) + '. صدّر الجدول كاملًا من مركز التصدير.</p>' : "") +
        '</div></article>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">أصناف لم تُبع</h2>' +
        '<p class="card__sub">مرشّحة للترويج أو الإيقاف — رأس مال مربوط بقيمة ' + HS.fmt.money(deadValue) + '</p></div></div>' +
        '<div class="card__body card__body--flush">' +
        (neverSold.length ? HS.ui.table([
          { key: "n", label: "الصنف", render: function (p) {
              return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + (p.emoji || "📦") + '</span>' +
                '<span class="truncate fw-500">' + HS.esc(p.name) + '</span></span>';
            } },
          { key: "c", label: "القسم", width: "150px", render: function (p) { return HS.esc(HS.store.cat(p.category).name); } },
          { key: "s", label: "الرصيد", align: "num", width: "108px", render: function (p) { return HS.fmt.int(p.stock) + ' <span class="text-3 fs-xs">' + HS.esc(p.unit) + '</span>'; } },
          { key: "v", label: "القيمة المرتبطة", align: "num", width: "140px", render: function (p) { return '<span class="fw-600">' + HS.fmt.money(HS.round(p.stock * p.cost, 3)) + '</span>'; } },
          { key: "a", label: "", align: "center", width: "112px", render: function (p) {
              return '<span class="table__actions">' + HS.ui.iconBtn("prod-label", "barcode", "طباعة ملصق", { id: p.id }) +
                HS.ui.iconBtn("prod-sell", "cart", "بيع سريع", { id: p.id }) + '</span>';
            } }
        ], neverSold.slice(0, 20)) : HS.ui.empty({ icon: "check-circle", title: "كل الأصناف النشطة بيعت خلال الفترة", text: "لا رأس مال راكدًا في المخزون." })) +
        '</div></article>' +
      '</section>';
    }

    /* ═══════════ ٤) العملاء والديون ═══════════ */
    function customersReport() {
      var byCust = {};
      valid.forEach(function (s) {
        var key = s.customerId || "walk-in";
        if (!byCust[key]) byCust[key] = { id: s.customerId, name: s.customerName, orders: 0, revenue: 0, units: 0, last: s.date };
        byCust[key].orders++;
        byCust[key].revenue += s.total;
        byCust[key].units += HS.sum(s.items, function (i) { return i.qty; });
        if (s.date > byCust[key].last) byCust[key].last = s.date;
      });
      var custRows = Object.keys(byCust).map(function (id) { return byCust[id]; })
        .sort(function (a, b) { return b.revenue - a.revenue; });
      var totalRev = HS.sum(custRows, function (r) { return r.revenue; });
      var walkIn = byCust["walk-in"];

      /* أعمار الديون */
      var buckets = [
        { label: "0–30 يومًا", min: 0, max: 30, value: 0, count: 0 },
        { label: "31–60 يومًا", min: 31, max: 60, value: 0, count: 0 },
        { label: "61–90 يومًا", min: 61, max: 90, value: 0, count: 0 },
        { label: "أكثر من 90 يومًا", min: 91, max: 1e9, value: 0, count: 0 }
      ];
      st.sales.forEach(function (s) {
        if (s.status !== "unpaid" && s.status !== "partial") return;
        var due = s.total - s.paid;
        if (due <= 0.001) return;
        var age = HS.date.daysBetween(s.date, new Date());
        var b = buckets.filter(function (x) { return age >= x.min && age <= x.max; })[0];
        if (b) { b.value = HS.round(b.value + due, 3); b.count++; }
      });
      var totalDue = HS.round(HS.sum(buckets, function (b) { return b.value; }), 3);

      var debtors = st.customers.filter(function (c) { return c.balance > 0.001; })
        .sort(function (a, b) { return b.balance - a.balance; });

      var newCust = HS.store.inRange(st.customers.map(function (c) { return { date: c.createdAt, id: c.id, name: c.name, city: c.city }; }), range);

      var D = HS.store.debts(range);
      var statusRows = [
        { label: "مستحق بالكامل", count: D.unpaidCount, value: D.unpaidValue, cls: "badge--danger", text: "لم يُحصَّل منه شيء" },
        { label: "مدفوع جزئيًا", count: D.partialCount, value: D.partialValue, cls: "badge--warning", text: "دفع جزءًا وبقي عليه" },
        { label: "مسدد", count: D.settledCount, value: D.settledValue, cls: "badge--success", text: "سُدّد كاملًا في الفترة" }
      ];

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("عملاء اشتروا", HS.fmt.int(custRows.filter(function (r) { return r.id; }).length), "خلال " + HS.fmt.int(k.span) + " يومًا") +
          HS.ui.statMini("عملاء جدد", HS.fmt.int(newCust.length), "سُجّلوا في الفترة") +
          HS.ui.statMini("مبيعات الزبائن النقديين", walkIn ? HS.fmt.money(HS.round(walkIn.revenue, 3)) : HS.fmt.money(0), walkIn ? HS.fmt.pct(totalRev ? walkIn.revenue / totalRev : 0, 0) + " من الإيراد" : "") +
          HS.ui.statMini("إجمالي الديون", HS.fmt.money(totalDue), debtors.length + " عميلًا مدينًا") +
          HS.ui.statMini("ديون متأخرة +90 يومًا", HS.fmt.money(buckets[3].value), buckets[3].count + " فاتورة") +
        '</div>' +

        /* ── تقرير الديون: ما نشأ، ما حُصّل، وما بقي ── */
        '<article class="card"><div class="card__head"><div><h2 class="card__title">حركة الديون في الفترة</h2>' +
          '<p class="card__sub">الفرق بين الربح المحقق والنقد المحصّل يظهر هنا بوضوح</p></div>' +
          '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="goto" data-href="#/customers?dstat=due"><span class="btn__label">متابعة التحصيل</span><span class="btn__icon">' + HS.icon("chevron-left", 15) + '</span></button>' +
        '</div><div class="card__body">' +
          '<div class="stat-strip">' +
            HS.ui.statMini("ديون نشأت", HS.fmt.money(D.granted), D.chargesGranted > 0 ? HS.fmt.money(D.salesGranted) + " من فواتير + " + HS.fmt.money(D.chargesGranted) + " مضاف يدويًا" : "كلها من فواتير الدين") +
            HS.ui.statMini("مقدمة وقت البيع", HS.fmt.money(D.downPaid), "دخلت الصندوق فورًا") +
            HS.ui.statMini("محصَّل لاحقًا", HS.fmt.money(D.collected), HS.fmt.int(D.collectedCount) + " عملية سداد") +
            HS.ui.statMini("إجمالي المحصَّل", HS.fmt.money(D.totalCollected), HS.fmt.pct(D.granted ? D.totalCollected / D.granted : 0, 1) + " من ديون الفترة") +
            HS.ui.statMini("غير محصَّل من الفترة", HS.fmt.money(D.rangeOutstanding), "والإجمالي القائم الآن " + HS.fmt.money(D.outstandingNow)) +
          '</div>' +
          '<div class="debt-status" style="margin-block-start:var(--sp-4)">' + statusRows.map(function (r) {
            return '<div class="debt-status__row">' +
              '<span class="debt-status__k">' + HS.ui.badge(r.label, r.cls) + '<span class="fs-xs text-3">' + HS.esc(r.text) + '</span></span>' +
              '<span class="debt-status__n">' + HS.fmt.int(r.count) + ' <span class="fs-xs text-3">فاتورة</span></span>' +
              '<span class="debt-status__v">' + HS.fmt.money(r.value) + '</span>' +
            '</div>';
          }).join("") + '</div>' +
          '<p class="alert alert--neutral" style="margin-block-start:var(--sp-4)">' + HS.icon("info", 16) +
            '<span>مبيعات الدين تُحتسب ضمن الإيراد والربح من يوم تسليم العطر، لكنها لا تدخل الصندوق إلا عند التحصيل. ' +
            'لذلك قد ترى ربحًا مرتفعًا ورصيد صندوق أقل — وهذا صحيح محاسبيًا.</span></p>' +
        '</div></article>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">أعلى 10 عملاء</h2>' +
          '<p class="card__sub">حسب قيمة المشتريات</p></div></div><div class="card__body">' +
          (custRows.filter(function (r) { return r.id; }).length
            ? '<div class="rank">' + HS.chart.hbar(custRows.filter(function (r) { return r.id; }).slice(0, 10).map(function (r) { return { label: r.name, value: HS.round(r.revenue, 3) }; }), { format: function (v) { return HS.fmt.money(v); } }) + '</div>'
            : HS.ui.empty({ icon: "users", title: "لا مبيعات مرتبطة بعملاء" })) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">أعمار الديون المستحقة</h2>' +
          '<p class="card__sub">كلما تقدّم العمر زادت خطورة التحصيل</p></div></div><div class="card__body">' +
          (totalDue > 0 ? '<div class="stack" style="gap:var(--sp-4)">' + buckets.map(function (b, i) {
            var share = totalDue ? b.value / totalDue : 0;
            var color = i === 0 ? "var(--success)" : i === 1 ? "var(--info)" : i === 2 ? "var(--warning)" : "var(--danger)";
            return '<div><div class="spread fs-sm" style="margin-block-end:var(--sp-1)">' +
              '<span class="text-2">' + HS.esc(b.label) + ' <span class="text-3 fs-xs">(' + HS.fmt.int(b.count) + ' فاتورة)</span></span>' +
              '<span class="fw-700 tabular">' + HS.fmt.money(b.value) + '</span></div>' +
              '<div class="progress" style="height:8px"><span class="progress__fill" style="width:' + (share * 100).toFixed(1) + '%;background:' + color + '"></span></div></div>';
          }).join("") + '</div>' : HS.ui.empty({ icon: "check-circle", title: "لا ديون مستحقة", text: "كل الفواتير مسدّدة." })) +
          '</div></article>' +
        '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">العملاء المدينون</h2>' +
        '<p class="card__sub">مرتّبون حسب حجم الدين</p></div>' +
        '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="goto" data-href="#/customers?tab=owing"><span class="btn__label">شاشة العملاء</span><span class="btn__icon">' + HS.icon("chevron-left", 15) + '</span></button>' +
        '</div><div class="card__body card__body--flush">' +
        (debtors.length ? HS.ui.table([
          { key: "n", label: "العميل", render: function (c) {
              return '<span class="row-2">' + HS.ui.avatar(c.name, "avatar--sm") + '<span class="truncate fw-500">' + HS.esc(c.name) + '</span></span>';
            } },
          { key: "city", label: "المدينة", width: "128px", render: function (c) { return HS.esc(c.city); } },
          { key: "p", label: "الهاتف", width: "146px", render: function (c) { return '<a class="ltr fs-sm" href="tel:' + HS.esc(c.phone) + '">' + HS.esc(HS.ui.phone(c.phone)) + '</a>'; } },
          { key: "b", label: "الرصيد", align: "num", width: "136px", render: function (c) { return '<span class="fw-700 text-danger">' + HS.fmt.money(c.balance) + '</span>'; } },
          { key: "l", label: "الحد الائتماني", align: "num", width: "136px", render: function (c) {
              return c.creditLimit ? HS.fmt.money(c.creditLimit) : '<span class="text-3">بلا سقف</span>';
            } },
          { key: "u", label: "الاستخدام", align: "num", width: "112px", render: function (c) {
              if (!c.creditLimit) return '<span class="text-3">—</span>';
              var pct = c.balance / c.creditLimit;
              return '<span class="' + (pct > 1 ? "text-danger fw-600" : pct > .8 ? "text-warning" : "text-2") + '">' + HS.fmt.pct(pct, 0) + '</span>';
            } },
          { key: "a", label: "", align: "center", width: "126px", render: function (c) {
              return '<span class="table__actions">' + HS.ui.iconBtn("cus-pay", "cash", "تسجيل سداد", { id: c.id }) +
                HS.ui.iconBtn("cus-view", "eye", "البطاقة", { id: c.id }) + '</span>';
            } }
        ], debtors, { foot: ["", "", '<span class="text-3 fw-500">الإجمالي</span>',
          '<span class="fw-700 text-danger">' + HS.fmt.money(HS.round(HS.sum(debtors, function (c) { return c.balance; }), 3)) + '</span>', "", "", ""] })
        : HS.ui.empty({ icon: "check-circle", title: "لا عملاء مدينين" })) +
        '</div></article>' +
      '</section>';
    }

    /* ═══════════ ٥) المشتريات والموردون ═══════════ */
    function purchasesReport() {
      var pos = HS.store.inRange(st.purchases, range).filter(function (p) { return p.status !== "cancelled"; });
      var bySup = {};
      pos.forEach(function (p) {
        var key = p.supplierId || "other";
        if (!bySup[key]) bySup[key] = { id: p.supplierId, name: p.supplierName || "غير محدد", orders: 0, units: 0, total: 0, paid: 0 };
        bySup[key].orders++;
        bySup[key].units += HS.sum(p.items, function (i) { return i.qty; });
        bySup[key].total += p.total;
        bySup[key].paid += p.paid || 0;
      });
      var supRows = Object.keys(bySup).map(function (id) { return bySup[id]; }).sort(function (a, b) { return b.total - a.total; });
      var grand = HS.round(HS.sum(supRows, function (r) { return r.total; }), 3);

      /* الأصناف الأكثر شراءً */
      var byItem = {};
      pos.forEach(function (p) {
        p.items.forEach(function (it) {
          if (!byItem[it.productId]) byItem[it.productId] = { name: it.name, qty: 0, cost: 0 };
          byItem[it.productId].qty += it.qty;
          byItem[it.productId].cost += it.qty * it.cost;
        });
      });
      var itemRows = Object.keys(byItem).map(function (id) { return Object.assign({ id: id }, byItem[id]); })
        .sort(function (a, b) { return b.cost - a.cost; });

      var received = pos.filter(function (p) { return p.status === "received"; });
      var shipping = pos.filter(function (p) { return p.status === "shipping"; });
      var late = shipping.filter(function (p) { return HS.date.toDate(p.expectedDate) < new Date(); });

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("قيمة المشتريات", HS.fmt.money(grand), HS.fmt.int(pos.length) + " أمرًا") +
          HS.ui.statMini("المدفوع", HS.fmt.money(HS.round(HS.sum(supRows, function (r) { return r.paid; }), 3)), HS.fmt.pct(grand ? HS.sum(supRows, function (r) { return r.paid; }) / grand : 0, 0) + " من الإجمالي") +
          HS.ui.statMini("مستلم", HS.fmt.int(received.length) + " أمرًا", HS.fmt.int(HS.sum(received, function (p) { return HS.sum(p.items, function (i) { return i.qty; }); })) + " وحدة دخلت المخزون") +
          HS.ui.statMini("في الطريق", HS.fmt.int(shipping.length) + " أمرًا", HS.fmt.money(HS.round(HS.sum(shipping, function (p) { return p.total; }), 3)) + " قيمة") +
          HS.ui.statMini("متأخرة عن الموعد", HS.fmt.int(late.length), late.length ? "تحتاج متابعة مع المورد" : "لا تأخيرات") +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">الإنفاق على الموردين</h2>' +
          '<p class="card__sub">حسب قيمة أوامر الشراء</p></div></div><div class="card__body">' +
          (supRows.length ? '<div class="rank">' + HS.chart.hbar(supRows.slice(0, 8).map(function (r) { return { label: r.name, value: HS.round(r.total, 3) }; }), { format: function (v) { return HS.fmt.money(v); } }) + '</div>' : HS.ui.empty({ icon: "truck", title: "لا مشتريات في الفترة" })) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">الأصناف الأكثر شراءً</h2>' +
          '<p class="card__sub">حسب قيمة التكلفة</p></div></div><div class="card__body">' +
          (itemRows.length ? '<div class="rank">' + HS.chart.hbar(itemRows.slice(0, 8).map(function (r) { return { label: r.name, value: HS.round(r.cost, 3) }; }), { format: function (v) { return HS.fmt.money(v); } }) + '</div>' : HS.ui.empty({ icon: "box", title: "لا أصناف مشتراه" })) +
          '</div></article>' +
        '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">تفصيل الموردين</h2>' +
        '<p class="card__sub">الفترة: ' + HS.esc(range.label) + '</p></div>' +
        '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="rep-export" data-kind="suppliers"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
        '</div><div class="card__body card__body--flush">' +
        (supRows.length ? HS.ui.table([
          { key: "n", label: "المورد", render: function (r) { return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">🚚</span><span class="truncate fw-500">' + HS.esc(r.name) + '</span></span>'; } },
          { key: "o", label: "الأوامر", align: "num", width: "92px", render: function (r) { return HS.fmt.int(r.orders); } },
          { key: "u", label: "الوحدات", align: "num", width: "96px", render: function (r) { return HS.fmt.int(r.units); } },
          { key: "t", label: "القيمة", align: "num", width: "132px", render: function (r) { return '<span class="fw-600">' + HS.fmt.money(HS.round(r.total, 3)) + '</span>'; } },
          { key: "p", label: "المدفوع", align: "num", width: "128px", render: function (r) { return HS.fmt.money(HS.round(r.paid, 3)); } },
          { key: "d", label: "المتبقي", align: "num", width: "128px", render: function (r) {
              var d = HS.round(r.total - r.paid, 3);
              return d > 0.001 ? '<span class="text-danger fw-600">' + HS.fmt.money(d) + '</span>' : '<span class="text-success fs-sm">مسدّد</span>';
            } },
          { key: "s", label: "الحصة", align: "num", width: "92px", render: function (r) { return HS.fmt.pct(grand ? r.total / grand : 0, 1); } }
        ], supRows, { foot: ["", HS.fmt.int(HS.sum(supRows, function (r) { return r.orders; })),
          HS.fmt.int(HS.sum(supRows, function (r) { return r.units; })),
          '<span class="fw-700">' + HS.fmt.money(grand) + '</span>',
          HS.fmt.money(HS.round(HS.sum(supRows, function (r) { return r.paid; }), 3)),
          '<span class="fw-700 text-danger">' + HS.fmt.money(HS.round(grand - HS.sum(supRows, function (r) { return r.paid; }), 3)) + '</span>', ""] })
        : HS.ui.empty({ icon: "truck", title: "لا مشتريات في الفترة", text: "غيّر الفترة من الشريط الأعلى لعرض مدى أطول." })) +
        '</div></article>' +
      '</section>';
    }

    /* ═══════════ ٦) الصندوق ═══════════ */
    function cashReport() {
      var C = HS.store.cash(range);
      var rows = [
        { k: "رصيد مُرحَّل قبل الفترة", v: C.carried, sign: "", note: "ما كان في الدرج قبل " + HS.fmt.date(range.from), tone: "" },
        { k: "مبيعات نقدية محصّلة", v: C.cashCollected, sign: "+", note: HS.fmt.int(C.cashSalesCount) + " فاتورة نقدية", tone: "in" },
        { k: "مقدمات على فواتير الدين", v: C.creditDownPayment, sign: "+", note: "دُفعت نقدًا وقت البيع", tone: "in" },
        { k: "سداد ديون نقدًا", v: C.debtCash, sign: "+", note: "تحصيل لاحق من العملاء", tone: "in" },
        { k: "إيداعات أخرى", v: C.otherIn, sign: "+", note: "قيود صندوق يدوية", tone: "in" },
        { k: "مصروفات نقدية", v: C.expCash, sign: "−", note: "إيجار، رواتب، خدمات…", tone: "out" },
        { k: "سحب وتوريد للمصرف", v: C.otherOut, sign: "−", note: "إخراج نقد من الدرج", tone: "out" },
        { k: "استرداد مبيعات ملغاة", v: C.refunds, sign: "−", note: "أُعيدت للعملاء نقدًا", tone: "out" }
      ].filter(function (r) { return r.v > 0.0009 || r.k.indexOf("مُرحَّل") >= 0; });

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("الرصيد النقدي المتوقع", HS.fmt.money(C.expected), "في الدرج الآن حسب العمليات") +
          HS.ui.statMini("مقبوضات الفترة", HS.fmt.money(C.inflow), HS.fmt.int(C.inCount) + " عملية دخول في السجل") +
          HS.ui.statMini("مدفوعات الفترة", HS.fmt.money(C.outflow), "مصروفات وسحوبات واستردادات") +
          HS.ui.statMini("صافي الحركة", HS.fmt.money(C.net), C.net >= 0 ? "زيادة في النقد" : "نقص في النقد") +
          HS.ui.statMini("أموال خارج الصندوق", HS.fmt.money(C.notInCash), "بطاقة ودين غير محصّل") +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">تسوية الصندوق</h2>' +
            '<p class="card__sub">' + HS.esc(range.label) + ' — من ' + HS.fmt.date(range.from) + ' إلى ' + HS.fmt.date(range.to) + '</p></div>' +
            '<div class="row-2 no-print">' +
              '<button type="button" class="btn btn--sm btn--ghost" data-action="goto" data-href="#/cash?tab=ledger"><span class="btn__label">سجل الحركات</span></button>' +
              '<button type="button" class="btn btn--sm btn--secondary" data-action="rep-print-cash"><span class="btn__icon">' + HS.icon("printer", 15) + '</span><span class="btn__label">طباعة</span></button>' +
            '</div>' +
          '</div><div class="card__body">' +
            '<div class="cash-recon">' + rows.map(function (r) {
              return '<div class="cash-recon__row' + (r.tone ? " cash-recon__row--" + r.tone : "") + '">' +
                '<span class="cash-recon__k">' + HS.esc(r.k) + ' <span class="fs-xs text-3">· ' + HS.esc(r.note) + '</span></span>' +
                '<span class="cash-recon__sign">' + (r.sign || "") + '</span>' +
                '<span class="cash-recon__v">' + HS.fmt.money(r.v) + '</span>' +
              '</div>';
            }).join("") +
              '<div class="cash-recon__row cash-recon__row--total">' +
                '<span class="cash-recon__k">الرصيد النقدي المتوقع</span><span class="cash-recon__sign">=</span>' +
                '<span class="cash-recon__v">' + HS.fmt.money(C.expected) + '</span>' +
              '</div>' +
            '</div>' +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">لماذا يختلف الصندوق عن المبيعات؟</h2>' +
            '<p class="card__sub">مبالغ حققت ربحًا لكنها ليست في الدرج</p></div></div>' +
          '<div class="card__body"><div class="stack">' +
            HS.ui.statMini("مبيعات بالبطاقة", HS.fmt.money(C.cardSales), "تُحوَّل إلى حساب المحل المصرفي") +
            HS.ui.statMini("ديون غير محصّلة", HS.fmt.money(C.creditOutstanding), "تدخل الصندوق عند السداد") +
            HS.ui.statMini("سداد ديون بالبطاقة", HS.fmt.money(C.debtCard), "لا يمرّ بالدرج") +
            HS.ui.statMini("مصروفات غير نقدية", HS.fmt.money(C.expOther), "دُفعت تحويلًا أو بالبطاقة") +
            '<p class="alert alert--info">' + HS.icon("info", 16) +
              '<span>إجمالي المبيعات في الفترة <b>' + HS.fmt.money(k.revenue) + '</b> وربحها <b>' + HS.fmt.money(k.profit) + '</b>، ' +
              'بينما دخل الصندوق منها <b>' + HS.fmt.money(C.cashCollected + C.creditDownPayment) + '</b> فقط.</span></p>' +
          '</div></div></article>' +
        '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">أكبر حركات الصندوق</h2>' +
          '<p class="card__sub">أعلى 12 عملية نقدية في الفترة</p></div></div>' +
          '<div class="card__body card__body--flush">' +
          (function () {
            var top = HS.store.cashLedger(range).slice().sort(function (a, b) { return b.amount - a.amount; }).slice(0, 12);
            return top.length ? HS.ui.table([
              { key: "date", label: "التاريخ", width: "150px", render: function (e) { return HS.fmt.date(e.date) + ' <span class="fs-xs text-3">' + HS.fmt.time(e.date) + '</span>'; } },
              { key: "label", label: "البيان", render: function (e) { return '<span class="truncate">' + HS.esc(e.label) + '</span>'; } },
              { key: "dir", label: "الاتجاه", align: "center", width: "118px", render: function (e) { return HS.ui.badge(e.dir === "in" ? "دخول" : "خروج", e.dir === "in" ? "badge--success" : "badge--danger"); } },
              { key: "amount", label: "المبلغ", align: "num", width: "140px", render: function (e) { return '<span class="fw-700 ' + (e.dir === "in" ? "text-success" : "text-danger") + '">' + (e.dir === "in" ? "+" : "−") + HS.fmt.money(e.amount) + '</span>'; } },
              { key: "balance", label: "الرصيد بعده", align: "num", width: "140px", render: function (e) { return HS.fmt.money(e.balance); } }
            ], top) : HS.ui.empty({ icon: "cash", title: "لا حركات نقدية في الفترة" });
          })() +
        '</div></article>' +
      '</section>';
    }

    /* ═══════════ ٧) المخزون ═══════════ */
    function inventoryReport() {
      var all = st.products;
      var costValue = HS.round(HS.sum(all, function (p) { return p.stock * p.cost; }), 3);
      var retailValue = HS.round(HS.sum(all, function (p) { return p.stock * p.price; }), 3);
      var units = HS.sum(all, function (p) { return p.stock; });
      var low = HS.store.lowStock();
      var out = HS.store.outOfStock();

      var byCat = st.categories.map(function (c) {
        var items = all.filter(function (p) { return p.category === c.id; });
        return {
          id: c.id, name: c.name, emoji: c.emoji, count: items.length,
          units: HS.sum(items, function (p) { return p.stock; }),
          cost: HS.round(HS.sum(items, function (p) { return p.stock * p.cost; }), 3),
          retail: HS.round(HS.sum(items, function (p) { return p.stock * p.price; }), 3),
          low: items.filter(function (p) { return p.stock > 0 && p.stock <= p.minStock; }).length,
          out: items.filter(function (p) { return p.stock <= 0; }).length
        };
      }).filter(function (c) { return c.count > 0; }).sort(function (a, b) { return b.cost - a.cost; });

      var byBrand = {};
      all.forEach(function (p) {
        var b = p.brand || "بدون ماركة";
        byBrand[b] = byBrand[b] || { name: b, count: 0, units: 0, cost: 0 };
        byBrand[b].count++; byBrand[b].units += p.stock;
        byBrand[b].cost = HS.round(byBrand[b].cost + p.stock * p.cost, 3);
      });
      var brandRows = Object.keys(byBrand).map(function (b) { return byBrand[b]; })
        .sort(function (a, b) { return b.cost - a.cost; });

      var movs = HS.store.inRange(st.movements, range);
      var movIn = movs.filter(function (m) { return m.type === "in"; });
      var movOut = movs.filter(function (m) { return m.type === "out"; });

      return '<section class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("قيمة المخزون بالتكلفة", HS.fmt.money(costValue), HS.fmt.int(all.length) + " صنفًا · " + HS.fmt.int(units) + " وحدة") +
          HS.ui.statMini("قيمة البيع التجزئة", HS.fmt.money(retailValue), "الربح المتوقع " + HS.fmt.money(HS.round(retailValue - costValue, 3))) +
          HS.ui.statMini("تحت الحد الأدنى", HS.fmt.int(low.length), "تحتاج إعادة طلب") +
          HS.ui.statMini("نافد تمامًا", HS.fmt.int(out.length), out.length ? "خسارة مبيعات محتملة" : "لا نفاد") +
          HS.ui.statMini("حركات الفترة", HS.fmt.int(movs.length), HS.fmt.int(movIn.length) + " دخول · " + HS.fmt.int(movOut.length) + " خروج") +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">المخزون حسب القسم</h2>' +
            '<p class="card__sub">القيمة بالتكلفة وسعر التجزئة</p></div></div>' +
            '<div class="card__body card__body--flush">' +
            HS.ui.table([
              { key: "name", label: "القسم", render: function (c) { return '<span class="fw-500">' + HS.esc(c.emoji + " " + c.name) + '</span>'; } },
              { key: "count", label: "أصناف", align: "num", width: "92px", render: function (c) { return HS.fmt.int(c.count); } },
              { key: "units", label: "وحدات", align: "num", width: "96px", render: function (c) { return HS.fmt.int(c.units); } },
              { key: "cost", label: "قيمة التكلفة", align: "num", width: "140px", render: function (c) { return HS.fmt.money(c.cost); } },
              { key: "retail", label: "قيمة التجزئة", align: "num", width: "140px", render: function (c) { return '<span class="fw-600">' + HS.fmt.money(c.retail) + '</span>'; } },
              { key: "alerts", label: "تنبيهات", align: "center", width: "116px", render: function (c) {
                  if (c.out) return HS.ui.badge(HS.fmt.int(c.out) + " نافد", "badge--danger");
                  if (c.low) return HS.ui.badge(HS.fmt.int(c.low) + " منخفض", "badge--warning");
                  return '<span class="text-3 fs-sm">—</span>';
                } }
            ], byCat, { foot: ["<b>الإجمالي</b>", '<b>' + HS.fmt.int(HS.sum(byCat, function (c) { return c.count; })) + '</b>',
              '<b>' + HS.fmt.int(units) + '</b>', '<b>' + HS.fmt.money(costValue) + '</b>', '<b>' + HS.fmt.money(retailValue) + '</b>', ""] }) +
            '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">أعلى الماركات قيمةً</h2>' +
            '<p class="card__sub">حسب قيمة المخزون بالتكلفة</p></div></div><div class="card__body">' +
            (brandRows.length ? '<div class="rank">' + HS.chart.hbar(brandRows.slice(0, 10).map(function (b) {
              return { label: b.name, value: b.cost };
            }), { format: function (v) { return HS.fmt.money(v); } }) + '</div>' +
            '<p class="fs-xs text-3" style="margin-block-start:var(--sp-3)">' + HS.fmt.int(brandRows.length) + ' ماركة في الكتالوج، أكبرها «' +
              HS.esc(brandRows[0].name) + '» بقيمة ' + HS.fmt.money(brandRows[0].cost) + '.</p>'
              : HS.ui.empty({ icon: "box", title: "لا مخزون" })) +
            '</div></article>' +
        '</div>' +

        '<div class="grid-main">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">أصناف تحت الحد الأدنى</h2>' +
            '<p class="card__sub">أعلاها رصيدًا أولًا — تحتاج إعادة طلب</p></div>' +
            '<button type="button" class="btn btn--sm btn--secondary no-print" data-action="goto" data-href="#/inventory?tab=alerts"><span class="btn__label">شاشة التنبيهات</span></button>' +
            '</div><div class="card__body card__body--flush">' +
            (low.length ? HS.ui.table([
              { key: "name", label: "الصنف", render: function (p) { return '<span class="truncate fw-500">' + HS.esc(HS.store.label(p)) + '</span>'; } },
              { key: "brand", label: "الماركة", width: "128px", render: function (p) { return '<span class="fs-sm truncate">' + HS.esc(p.brand || "—") + '</span>'; } },
              { key: "stock", label: "الرصيد", align: "num", width: "96px", render: function (p) { return HS.ui.stockBadge(p); } },
              { key: "min", label: "الحد", align: "num", width: "80px", render: function (p) { return HS.fmt.int(p.minStock); } },
              { key: "value", label: "قيمة النقص", align: "num", width: "132px", render: function (p) { return HS.fmt.money(HS.round(Math.max(0, p.minStock - p.stock) * p.cost, 3)); } }
            ], low.slice(0, 12)) : HS.ui.empty({ icon: "check-circle", title: "كل الأصناف فوق الحد الأدنى" })) +
            '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">أصناف نافدة</h2>' +
            '<p class="card__sub">رصيد صفر — مبيعات ضائعة حتى إعادة الطلب</p></div></div>' +
            '<div class="card__body card__body--flush">' +
            (out.length ? HS.ui.table([
              { key: "name", label: "الصنف", render: function (p) { return '<span class="truncate fw-500">' + HS.esc(HS.store.label(p)) + '</span>'; } },
              { key: "brand", label: "الماركة", width: "128px", render: function (p) { return '<span class="fs-sm truncate">' + HS.esc(p.brand || "—") + '</span>'; } },
              { key: "price", label: "سعر البيع", align: "num", width: "120px", render: function (p) { return HS.fmt.money(p.price); } }
            ], out.slice(0, 12)) : HS.ui.empty({ icon: "check-circle", title: "لا أصناف نافدة" })) +
            '</div></article>' +
        '</div>' +
      '</section>';
    }

    /* ═══════════ ٨) مركز التصدير ═══════════ */
    function exportCenter() {
      var canExport = HS.store.can("reports_export");
      var sets = [
        { kind: "sales", label: "المبيعات", icon: "receipt", count: st.sales.filter(function (s) { return s.status !== "held"; }).length, desc: "كل الفواتير بحالاتها وقيمها وطرق دفعها" },
        { kind: "products", label: "الأصناف وأداؤها", icon: "box", count: st.products.length, desc: "الكتالوج مع الأسعار والأرصدة والمبيعات خلال الفترة" },
        { kind: "inventory", label: "أرصدة المخزون", icon: "layers", count: st.movements.length, desc: "حركة الدخول والخروج والتسويات مع الرصيد المحسوب" },
        { kind: "customers", label: "العملاء والديون", icon: "users", count: st.customers.length, desc: "بطاقات العملاء وأرصدتهم وإجمالي مشترياتهم" },
        { kind: "debts", label: "تفصيل الديون", icon: "receipt", count: HS.store.inRange(st.payments, range).length + st.sales.filter(function (x) { return x.method === "credit"; }).length, desc: "كل فاتورة دين بمقدمتها ومتبقيها، وكل سداد ودين مضاف" },
        { kind: "cash", label: "سجل الصندوق", icon: "cash", count: HS.store.cashLedger(range).length, desc: "كل حركة نقدية دخولًا وخروجًا مع الرصيد التراكمي" },
        { kind: "suppliers", label: "الموردون والمشتريات", icon: "truck", count: st.suppliers.length, desc: "الموردون مع أوامر الشراء والمدفوعات" },
        { kind: "expenses", label: "المصروفات", icon: "wallet", count: st.expenses.length, desc: "كل بنود التشغيل خلال الفترة المسجّلة" }
      ];

      return '<section class="stack">' +
        '<div class="alert alert--info no-print">' + HS.icon("info", 17) +
          '<span>التصدير يعمل بالكامل داخل المتصفح: ملفات CSV بترميز UTF-8 مع علامة BOM حتى تُفتح الأعمدة العربية صحيحة في Excel، ونسخة JSON احتياطية لكل البيانات.</span></div>' +

        '<div class="grid-3 stagger">' + sets.map(function (s) {
          return '<article class="card"><div class="card__head">' +
            '<div class="row-2"><span class="thumb" aria-hidden="true">' + HS.icon(s.icon, 18) + '</span>' +
            '<div><h2 class="card__title">' + HS.esc(s.label) + '</h2>' +
            '<p class="card__sub">' + HS.fmt.int(s.count) + ' سجلًا</p></div></div></div>' +
            '<div class="card__body"><p class="fs-sm text-2">' + HS.esc(s.desc) + '</p></div>' +
            '<div class="card__foot spread">' +
              '<span class="fs-xs text-3">CSV · UTF-8</span>' +
              '<button type="button" class="btn btn--sm ' + (canExport ? "btn--primary" : "btn--secondary") + '" data-action="rep-export" data-kind="' + s.kind + '"' + (canExport ? "" : " disabled") + '>' +
              '<span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
            '</div></article>';
        }).join("") + '</div>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">نسخة احتياطية كاملة</h2>' +
        '<p class="card__sub">ملف JSON واحد يحتوي كل البيانات والإعدادات</p></div></div>' +
        '<div class="card__body">' +
          '<div class="row-wrap">' +
            '<button type="button" class="btn btn--secondary" data-action="rep-export" data-kind="json"><span class="btn__icon">' + HS.icon("database", 16) + '</span><span class="btn__label">تنزيل نسخة JSON</span></button>' +
            '<button type="button" class="btn btn--secondary" data-action="rep-print-pl"><span class="btn__icon">' + HS.icon("print", 16) + '</span><span class="btn__label">طباعة التقرير الحالي</span></button>' +
            '<span class="grow"></span>' +
            '<span class="fs-xs text-3">حجم البيانات التقريبي: ' + HS.fmt.num(Math.round(JSON.stringify(st).length / 1024)) + ' ك.ب</span>' +
          '</div>' +
          '<p class="fs-xs text-3" style="margin-block-start:var(--sp-3)">لا يوجد خادم: كل البيانات محفوظة في تخزين هذا المتصفح فقط. النسخة الاحتياطية هي وسيلتك الوحيدة لنقلها إلى جهاز آخر.</p>' +
        '</div></article>' +
      '</section>';
    }
  };

  /* ═══════════ التصدير ═══════════ */
  function exportSet(kind) {
    var st = HS.store.state;
    var range = HS.store.range(st.ui.period || "30d");
    var name = "", rows = [];

    if (kind === "json") {
      var json = HS.store.exportJSON();
      var ok = HS.download(HS.STORE_NAME.replace(/\s+/g, "-") + "-نسخة-احتياطية-" + HS.date.toISO(new Date()) + ".json", json);
      HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "database" : "alert", title: ok ? "نُزّلت النسخة الاحتياطية" : "تعذّر التنزيل", msg: ok ? "ملف JSON كامل بكل البيانات والإعدادات" : "المتصفح منع التنزيل." });
      return;
    }

    if (kind === "sales") {
      name = "المبيعات";
      rows = HS.store.inRange(st.sales.filter(function (s) { return s.status !== "held"; }), range)
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .map(function (s) {
          return {
            "رقم الفاتورة": s.number, "التاريخ": s.date, "العميل": s.customerName,
            "الأصناف": s.items.map(function (i) { return i.name + " ×" + i.qty; }).join(" | "),
            "الوحدات": HS.sum(s.items, function (i) { return i.qty; }),
            "المجموع": s.subtotal, "الخصم": s.discount, "الضريبة": s.tax, "الإجمالي": s.total,
            "المدفوع": s.paid, "المتبقي": HS.round(s.total - s.paid, 3),
            "طريقة الدفع": HS.store.payMethod(s.method).name, "الحالة": HS.ui.saleStatusLabel(s.status),
            "الربح": HS.store.saleProfit(s),
            "الكاشير": (HS.store.user(s.cashierId) || {}).name || ""
          };
        });
    } else if (kind === "products") {
      name = "اداء-الاصناف";
      var agg = {};
      HS.store.validSalesOf(range).forEach(function (s) {
        s.items.forEach(function (it) {
          if (!agg[it.productId]) agg[it.productId] = { name: it.name, qty: 0, revenue: 0, cost: 0, orders: 0 };
          agg[it.productId].qty += it.qty;
          agg[it.productId].revenue += it.qty * it.price - (it.discount || 0);
          agg[it.productId].cost += it.qty * (it.cost || 0);
          agg[it.productId].orders++;
        });
      });
      rows = st.products.map(function (p) {
        var a = agg[p.id] || { qty: 0, revenue: 0, cost: 0, orders: 0 };
        return {
          "الرمز": p.sku, "الصنف": p.name, "القسم": HS.store.cat(p.category).name, "الوحدة": p.unit,
          "التكلفة": p.cost, "سعر البيع": p.price, "الرصيد": p.stock, "الحد الأدنى": p.minStock,
          "قيمة الرصيد": HS.round(p.stock * p.cost, 3),
          "فواتير الفترة": a.orders, "وحدات الفترة": a.qty,
          "إيراد الفترة": HS.round(a.revenue, 3), "ربح الفترة": HS.round(a.revenue - a.cost, 3),
          "الحالة": p.active ? "نشط" : "موقوف"
        };
      });
    } else if (kind === "inventory") {
      name = "حركة-المخزون";
      rows = st.movements.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (m) {
        var p = HS.store.product(m.productId);
        return {
          "التاريخ": m.date, "النوع": m.type === "in" ? "دخول" : m.type === "out" ? "خروج" : "تسوية",
          "الصنف": p ? p.name : "(محذوف)", "الرمز": p ? p.sku : "", "الكمية": m.qty,
          "السبب": m.reason || "", "المرجع": m.ref || "", "المستخدم": (HS.store.user(m.userId) || {}).name || ""
        };
      });
    } else if (kind === "customers") {
      name = "العملاء";
      rows = st.customers.map(function (c) {
        var sales = st.sales.filter(function (s) { return s.customerId === c.id && s.status !== "held" && s.status !== "returned"; });
        return {
          "الاسم": c.name, "الهاتف": c.phone, "المدينة": c.city, "نوع الحساب": c.accountType,
          "الفواتير": sales.length, "إجمالي المشتريات": HS.round(HS.sum(sales, function (s) { return s.total; }), 3),
          "الرصيد المستحق": c.balance, "الحد الائتماني": c.creditLimit,
          "الزيارات": c.visits, "الحالة": c.active ? "نشط" : "موقوف"
        };
      });
    } else if (kind === "suppliers") {
      name = "الموردون";
      rows = st.suppliers.map(function (s) {
        var pos = st.purchases.filter(function (p) { return p.supplierId === s.id; });
        return {
          "الاسم": s.name, "مسؤول التواصل": s.contact, "الهاتف": s.phone, "المدينة": s.city,
          "التخصص": HS.store.cat(s.focus).name, "الأوامر": pos.length,
          "قيمة المشتريات": HS.round(HS.sum(pos, function (p) { return p.total; }), 3),
          "المدفوع": HS.round(HS.sum(pos, function (p) { return p.paid || 0; }), 3),
          "الرصيد المستحق": s.balance, "شروط السداد": s.termsDays, "التقييم": s.rating
        };
      });
    } else if (kind === "cash") {
      name = "الصندوق";
      var C0 = HS.store.cash(range);
      rows = [{
        "البيان": "رصيد مُرحَّل قبل الفترة", "المبلغ": C0.carried, "دخول": "", "خروج": "", "الرصيد": C0.carried
      }].concat(HS.store.cashLedger(range).map(function (e) {
        return {
          "البيان": e.label + (e.detail ? " — " + e.detail : ""),
          "المبلغ": e.amount,
          "دخول": e.dir === "in" ? e.amount : "",
          "خروج": e.dir === "out" ? e.amount : "",
          "الرصيد": e.balance
        };
      })).concat([{
        "البيان": "الرصيد النقدي المتوقع في نهاية الفترة", "المبلغ": C0.expected, "دخول": "", "خروج": "", "الرصيد": C0.expected
      }]);
    } else if (kind === "debts") {
      name = "الديون";
      rows = st.sales.filter(function (x) { return x.method === "credit" && x.status !== "held"; })
        .filter(function (x) { return HS.store.inRange([x], range).length; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; })
        .map(function (x) {
          return {
            "النوع": "فاتورة دين", "رقم/مرجع": x.number, "التاريخ": x.date,
            "العميل": x.customerName, "المبلغ الأصلي": x.total, "المقدمة": x.paid,
            "المتبقي": HS.round(x.total - x.paid, 3), "الحالة": HS.ui.saleStatusLabel(x.status),
            "طريقة الدفع": HS.store.payMethod(x.method).name, "الربح": HS.store.saleProfit(x)
          };
        })
        .concat(HS.store.inRange(st.payments, range).map(function (pm) {
          var charge = pm.kind === "charge";
          return {
            "النوع": charge ? "دين مضاف" : "سداد", "رقم/مرجع": pm.id,
            "التاريخ": pm.date, "العميل": pm.customerName,
            "المبلغ الأصلي": charge ? Math.abs(pm.amount) : "",
            "المقدمة": "", "المتبقي": "",
            "الحالة": charge ? "زيادة دين" : (pm.method === "cash" ? "دخل الصندوق" : "بطاقة — خارج الصندوق"),
            "طريقة الدفع": charge ? "—" : HS.store.payMethod(pm.method).name,
            "الربح": ""
          };
        }));
    } else if (kind === "expenses") {
      name = "المصروفات";
      rows = st.expenses.map(function (e) {
        return {
          "التاريخ": e.date, "البند": HS.store.expenseCat(e.category).name, "البيان": e.note || "",
          "المبلغ": e.amount, "طريقة الدفع": HS.store.payMethod(e.method).name,
          "ثابت": e.recurring ? "نعم" : "لا", "سجّله": (HS.store.user(e.userId) || {}).name || ""
        };
      });
    }

    if (!rows.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لا بيانات في هذا التقرير", msg: "جرّب تغيير الفترة من الشريط الأعلى." }); return; }
    var ok = HS.download(name + "-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّر التقرير" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " سجلًا بصيغة CSV" : "المتصفح منع التنزيل." });
  }

  HS.action("rep-export", function (btn) {
    if (!HS.store.can("reports_export")) {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا تملك صلاحية التصدير", msg: "اطلب من المدير منحك صلاحية «تصدير التقارير»." });
      return;
    }
    exportSet(btn.getAttribute("data-kind"));
  });

  HS.action("rep-print-cash", function () {
    var range = HS.store.range(HS.store.state.ui.period || "30d");
    if (HS.pages.cash && HS.pages.cash.print) HS.pages.cash.print(range);
    else HS.ui.toast({ type: "warning", icon: "alert", title: "تعذّرت الطباعة" });
  });

  HS.action("rep-print-pl", function () {
    HS.ui.toast({ type: "info", icon: "print", title: "جارٍ فتح نافذة الطباعة", msg: "يُطبع التقرير الحالي فقط بلا قوائم جانبية.", duration: 2200 });
    setTimeout(function () { window.print(); }, 320);
  });
})();
