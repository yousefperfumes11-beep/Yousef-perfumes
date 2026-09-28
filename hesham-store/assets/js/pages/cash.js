/* ═══════════════════════════════════════════════════════════
   pages/cash.js — الصندوق النقدي
   يفصل بوضوح بين «الربح المحقق» و«النقد المحصّل فعليًا»:
   مبيعات البطاقة والدين خارج الصندوق، والدين يدخل عند تحصيله.
   كل الأرقام تُشتقّ من سجل أحداث واحد، فلا يمكن أن تختلف.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 20, sort: "date", dir: "desc" };

  var KINDS = [
    { id: "sale", name: "بيع نقدي", emoji: "💵" },
    { id: "downpayment", name: "مقدمة على دين", emoji: "🧾" },
    { id: "debt", name: "سداد دين", emoji: "🤝" },
    { id: "deposit", name: "إيداع", emoji: "⬇️" },
    { id: "expense", name: "مصروف نقدي", emoji: "📤" },
    { id: "withdraw", name: "سحب / توريد", emoji: "🏦" },
    { id: "refund", name: "استرداد إلغاء بيع", emoji: "↩️" }
  ];
  function kindName(id) { return (KINDS.filter(function (k) { return k.id === id; })[0] || { name: id }).name; }

  HS.pages.cash = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "summary";
    var kind = ctx.query.kind || "";
    var dir = ctx.query.dir2 || "";
    var canManage = HS.store.can("cash_manage");

    var range = HS.store.range(st.ui.period || "30d");
    var c = HS.store.cash(range);

    HS.ui.setHeader({
      title: "الصندوق",
      sub: "الرصيد النقدي الفعلي: ما دخل الدرج وما خرج منه. مبيعات البطاقة والدين لا تدخل هنا إلا عند تحصيلها.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "الصندوق" }]
    });

    /* ═══════════ الملخص ═══════════ */
    function summary() {
      var daily = dailyCash(range);
      var inflowParts = [
        { label: "مبيعات نقدية", value: c.cashCollected },
        { label: "سداد ديون", value: c.debtCash },
        { label: "مقدمات على الديون", value: c.creditDownPayment },
        { label: "إيداعات", value: c.otherIn }
      ].filter(function (x) { return x.value > 0; });
      var outflowParts = [
        { label: "مصروفات نقدية", value: c.expCash },
        { label: "سحب وتوريد للمصرف", value: c.otherOut },
        { label: "استرداد مبيعات ملغاة", value: c.refunds }
      ].filter(function (x) { return x.value > 0; });

      return '' +
        /* ── المؤشرات ── */
        '<section class="kpi-grid stagger" aria-label="مؤشرات الصندوق">' +
          HS.ui.kpi({
            label: "الرصيد النقدي المتوقع", value: HS.fmt.money(c.expected), accent: true,
            icon: "cash", iconColor: "var(--primary)",
            note: "مُرحَّل " + HS.fmt.money(c.carried) + " + صافي الفترة " + HS.fmt.money(c.net)
          }) +
          HS.ui.kpi({
            label: "إجمالي المقبوضات النقدية", value: HS.fmt.money(c.inflow),
            icon: "arrow-down-circle", iconColor: "var(--success)",
            note: HS.fmt.int(c.inCount) + " عملية دخول · " + HS.fmt.int(c.cashSalesCount) + " فاتورة نقدية"
          }) +
          HS.ui.kpi({
            label: "إجمالي المدفوعات النقدية", value: HS.fmt.money(c.outflow),
            icon: "arrow-up-circle", iconColor: "var(--danger)",
            note: HS.fmt.int(c.outCount) + " عملية خروج"
          }) +
          HS.ui.kpi({
            label: "صافي حركة الصندوق", value: HS.fmt.money(c.net),
            icon: c.net >= 0 ? "trending-up" : "trending-down",
            iconColor: c.net >= 0 ? "var(--success)" : "var(--danger)",
            note: "خلال " + HS.esc(range.label)
          }) +
        '</section>' +

        '<div class="grid-main">' +
          /* ── تفصيل الحركة ── */
          '<section class="card"><div class="card__head"><div>' +
            '<h2 class="card__title">حركة الصندوق</h2>' +
            '<p class="card__sub">' + HS.esc(range.label) + ' — من ' + HS.fmt.date(range.from) + ' إلى ' + HS.fmt.date(range.to) + '</p>' +
          '</div>' +
            '<div class="row-2" style="gap:var(--sp-2)">' +
              (canManage ? '<button type="button" class="btn btn--sm btn--secondary" data-action="cash-count">' +
                '<span class="btn__icon">' + HS.icon("clipboard", 15) + '</span><span class="btn__label">جرد الصندوق</span></button>' : "") +
              '<button type="button" class="btn btn--sm btn--primary" data-action="cash-add">' +
                '<span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">إيداع / سحب</span></button>' +
            '</div>' +
          '</div><div class="card__body">' +
            '<div class="cash-cols">' +
              '<div class="stack">' +
                '<h3 class="fs-sm fw-600 text-2">ما دخل الصندوق</h3>' +
                (inflowParts.length ? '<div class="stack" style="gap:var(--sp-2)">' + inflowParts.map(function (x) {
                  return cashRow(x.label, x.value, c.inflow, "var(--success)");
                }).join("") + '</div>' : emptyLine("لا مقبوضات")) +
                '<div class="cash-total cash-total--in"><span>الإجمالي</span><b>' + HS.fmt.money(c.inflow) + '</b></div>' +
              '</div>' +
              '<div class="stack">' +
                '<h3 class="fs-sm fw-600 text-2">ما خرج من الصندوق</h3>' +
                (outflowParts.length ? '<div class="stack" style="gap:var(--sp-2)">' + outflowParts.map(function (x) {
                  return cashRow(x.label, x.value, c.outflow, "var(--danger)");
                }).join("") + '</div>' : emptyLine("لا مدفوعات")) +
                '<div class="cash-total cash-total--out"><span>الإجمالي</span><b>' + HS.fmt.money(c.outflow) + '</b></div>' +
              '</div>' +
            '</div>' +
          '</div></section>' +

          /* ── خارج الصندوق ── */
          '<section class="card"><div class="card__head"><div>' +
            '<h2 class="card__title">خارج الصندوق</h2>' +
            '<p class="card__sub">حققت إيرادات لكنها لم تدخل الدرج النقدي</p>' +
          '</div><span class="badge badge--info">' + HS.fmt.money(c.notInCash) + '</span></div>' +
          '<div class="card__body"><div class="stack">' +
            HS.ui.statMini("مبيعات بالبطاقة", HS.fmt.money(c.cardSales), "تُحصّل عبر المصرف، لا تُعدّ في الصندوق") +
            HS.ui.statMini("مبيعات بالدين غير محصّلة", HS.fmt.money(c.creditOutstanding), "تدخل الصندوق عند السداد فقط") +
            HS.ui.statMini("سداد ديون بالبطاقة", HS.fmt.money(c.debtCard), "خارج الدرج النقدي") +
            HS.ui.statMini("مصروفات غير نقدية", HS.fmt.money(c.expOther), "تحويل أو بطاقة") +
            '<p class="alert alert--neutral" style="margin-block-start:var(--sp-3)">' + HS.icon("info", 16) +
              '<span>الربح يُحتسب من كل المبيعات مهما كانت طريقة الدفع، أما الصندوق فيعكس النقد المحصّل فعليًا فقط. ' +
              'الاثنان رقمَان مختلفان وكلاهما صحيح.</span></p>' +
          '</div></div></section>' +
        '</div>' +

        /* ── اليومية ── */
        '<section class="card"><div class="card__head"><div>' +
          '<h2 class="card__title">يومية الصندوق</h2>' +
          '<p class="card__sub">صافي النقد لكل يوم في الفترة</p>' +
        '</div>' +
          '<button type="button" class="btn btn--sm btn--ghost" data-action="cash-print">' +
            '<span class="btn__icon">' + HS.icon("printer", 15) + '</span><span class="btn__label">طباعة تقرير الصندوق</span></button>' +
        '</div><div class="card__body">' +
          (daily.length ?
            '<div class="chart-box">' + HS.chart.bar({
              labels: daily.map(function (d) { return d.label; }),
              series: [
                { name: "مقبوضات", values: daily.map(function (d) { return d.in; }), color: "var(--success)" },
                { name: "مدفوعات", values: daily.map(function (d) { return d.out; }), color: "var(--danger)" }
              ],
              height: 218, compact: true, maxBar: 26,
              yFormat: function (v) { return HS.fmt.moneyShort(v); },
              ariaLabel: "مقبوضات ومدفوعات الصندوق يوميًا"
            }).html + '</div>' +
            HS.chart.legend([
              { label: "مقبوضات نقدية", color: "var(--success)" },
              { label: "مدفوعات نقدية", color: "var(--danger)" }
            ]) +
            '<div style="margin-block-start:var(--sp-4)">' +
              HS.ui.table([
                { key: "date", label: "اليوم", render: function (d) { return '<span class="fw-500">' + HS.fmt.date(d.date, "medium") + '</span>'; } },
                { key: "in", label: "مقبوضات", align: "num", render: function (d) { return d.in ? '<span class="text-success fw-600">+' + HS.fmt.money(d.in) + '</span>' : '<span class="text-3">—</span>'; } },
                { key: "out", label: "مدفوعات", align: "num", render: function (d) { return d.out ? '<span class="text-danger fw-600">−' + HS.fmt.money(d.out) + '</span>' : '<span class="text-3">—</span>'; } },
                { key: "net", label: "الصافي", align: "num", render: function (d) { return '<span class="fw-700 ' + (d.net >= 0 ? "text-success" : "text-danger") + '">' + (d.net >= 0 ? "+" : "−") + HS.fmt.money(Math.abs(d.net)) + '</span>'; } },
                { key: "balance", label: "الرصيد في نهاية اليوم", align: "num", render: function (d) { return '<span class="fw-600">' + HS.fmt.money(d.balance) + '</span>'; } }
              ], daily.slice().reverse(), {
                foot: ["<b>الإجمالي</b>",
                  '<b class="text-success">' + HS.fmt.money(c.inflow) + '</b>',
                  '<b class="text-danger">' + HS.fmt.money(c.outflow) + '</b>',
                  '<b class="' + (c.net >= 0 ? "text-success" : "text-danger") + '">' + (c.net >= 0 ? "+" : "−") + HS.fmt.money(Math.abs(c.net)) + '</b>',
                  '<b>' + HS.fmt.money(c.expected) + '</b>']
              }) +
            '</div>'
            : HS.ui.empty({ icon: "cash", title: "لا حركة نقدية في هذه الفترة", text: "وسّع الفترة الزمنية من الشريط العلوي لعرض حركة الصندوق." })) +
        '</div></section>';
    }

    function cashRow(label, value, total, color) {
      var pct = total > 0 ? value / total : 0;
      return '<div class="cash-row">' +
        '<div class="cash-row__head"><span class="cash-row__k">' + HS.esc(label) + '</span>' +
        '<span class="cash-row__v">' + HS.fmt.money(value) + '</span></div>' +
        '<div class="cash-row__track"><span style="inline-size:' + HS.fmt.pct(pct, 1).replace(/[^\d.]/g, "") + '%;background:' + color + '"></span></div>' +
        '<span class="cash-row__pct">' + HS.fmt.pct(pct, 1) + '</span>' +
      '</div>';
    }
    function emptyLine(text) { return '<p class="text-3 fs-sm">' + HS.esc(text) + '</p>'; }

    /* ═══════════ سجل الحركات ═══════════ */
    function ledger() {
      var rows = HS.store.cashLedger(range).filter(function (e) {
        if (kind && e.kind !== kind) return false;
        if (dir && e.dir !== dir) return false;
        if (ls.q && !HS.matches(e.label + " " + (e.ref || "") + " " + (e.detail || ""), ls.q)) return false;
        return true;
      });
      rows = HS.sortBy(rows, ls.sort === "amount" ? function (e) { return e.amount; }
        : ls.sort === "balance" ? function (e) { return e.balance; } : function (e) { return e.date; }, ls.dir);

      var paged = HS.ui.paginate(rows, ls.page, ls.per);
      var filtersActive = !!(ls.q || kind || dir);
      var counts = {};
      HS.store.cashLedger(range).forEach(function (e) { counts[e.kind] = (counts[e.kind] || 0) + 1; });

      var tabsList = [{ id: "", label: "الكل", count: HS.store.cashLedger(range).length }]
        .concat(KINDS.filter(function (k) { return counts[k.id]; })
          .map(function (k) { return { id: k.id, label: k.name, count: counts[k.id] }; }));

      return '' +
        HS.ui.tabs(tabsList, kind) +
        HS.ui.toolbar({
          q: ls.q, placeholder: "ابحث في البيان أو المرجع…",
          filters:
            HS.ui.select({ name: "dir2", value: dir, label: "الاتجاه", options: [
              { value: "", label: "الدخول والخروج" },
              { value: "in", label: "الدخول فقط" },
              { value: "out", label: "الخروج فقط" }
            ] }) +
            HS.ui.select({ name: "per", value: String(ls.per), label: "عدد الصفوف", options: [15, 20, 30, 50].map(function (n) {
              return { value: String(n), label: n + " صفًا" };
            }) }),
          actions:
            '<button type="button" class="btn btn--sm btn--ghost" data-action="cash-export">' +
              '<span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير CSV</span></button>' +
            (canManage ? '<button type="button" class="btn btn--sm btn--secondary" data-action="cash-add">' +
              '<span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">إيداع / سحب</span></button>' : "")
        }) +
        HS.ui.table([
          { key: "date", label: "التاريخ والوقت", sortable: true, width: "168px", render: function (e) {
              return '<span>' + HS.fmt.date(e.date) + '</span><span class="fs-xs text-3" style="display:block">' + HS.fmt.time(e.date) + '</span>';
            } },
          { key: "kind", label: "النوع", width: "150px", render: function (e) {
              return HS.ui.badge(kindName(e.kind), e.dir === "in" ? "badge--success" : "badge--danger");
            } },
          { key: "label", label: "البيان", render: function (e) {
              return '<span style="min-width:0"><span class="truncate fw-500" style="display:block">' + HS.esc(e.label) + '</span>' +
                (e.detail ? '<span class="fs-xs text-3 truncate" style="display:block">' + HS.esc(e.detail) + '</span>' : "") + '</span>';
            } },
          { key: "ref", label: "المرجع", width: "140px", render: function (e) {
              return e.saleId ? '<a href="#/sales/' + HS.esc(e.saleId) + '" class="ltr fw-500">' + HS.esc(e.ref || "") + '</a>'
                : '<span class="fs-sm text-2">' + HS.esc(e.ref || "—") + '</span>';
            } },
          { key: "amount", label: "دخول", sortable: true, align: "num", width: "124px", render: function (e) {
              return e.dir === "in" ? '<span class="text-success fw-600">+' + HS.fmt.money(e.amount) + '</span>' : '<span class="text-3">—</span>';
            } },
          { key: "out", label: "خروج", align: "num", width: "124px", render: function (e) {
              return e.dir === "out" ? '<span class="text-danger fw-600">−' + HS.fmt.money(e.amount) + '</span>' : '<span class="text-3">—</span>';
            } },
          { key: "balance", label: "الرصيد", sortable: true, align: "num", width: "132px", render: function (e) {
              return '<span class="fw-600">' + HS.fmt.money(e.balance) + '</span>';
            } },
          { key: "actions", label: "", align: "center", width: "48px", render: function (e) {
              return e.id && canManage ? HS.ui.iconBtn("cash-del", "trash", "حذف العملية", { id: e.id }, "icon-btn--danger") : "";
            } }
        ], paged, {
          sort: { key: ls.sort, dir: ls.dir },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "cash",
            title: filtersActive ? "لا حركات مطابقة" : "لا حركة نقدية في هذه الفترة",
            text: filtersActive ? "أزل المرشّحات أو وسّع نطاق البحث." : "غيّر الفترة من الشريط العلوي لعرض حركة أطول.",
            action: filtersActive ? '<button type="button" class="btn btn--secondary btn--sm" data-action="cash-clear">إزالة المرشّحات</button>' : ""
          }),
          foot: paged.length ? ["<b>صافي الصفحة</b>", "", "", "",
            '<b class="text-success">+' + HS.fmt.money(HS.round(HS.sum(paged.filter(function (e) { return e.dir === "in"; }), function (e) { return e.amount; }), 3)) + '</b>',
            '<b class="text-danger">−' + HS.fmt.money(HS.round(HS.sum(paged.filter(function (e) { return e.dir === "out"; }), function (e) { return e.amount; }), 3)) + '</b>',
            "", ""] : null
        }) +
        HS.ui.pager({ page: ls.page, per: ls.per, total: rows.length });
    }

    /* ═══════════ الرسم ═══════════ */
    var tabs = [
      { id: "summary", label: "تقرير الصندوق" },
      { id: "ledger", label: "سجل الحركات", count: c.events }
    ];

    root.innerHTML = '<div class="page-enter">' +
      '<div class="card" style="margin-block-end:var(--sp-4)"><div class="card__body" style="padding-block:var(--sp-3)">' +
        HS.ui.tabs(tabs, tab) +
      '</div></div>' +
      (tab === "ledger" ? ledger() : summary()) +
    '</div>';

    /* ── أحداث الصفحة ── */
    root.querySelectorAll("[data-filter]").forEach(function (sel) {
      sel.addEventListener("change", function () {
        var patch = {}; patch[sel.getAttribute("data-filter")] = sel.value || null;
        if (sel.getAttribute("data-filter") !== "per") patch.page = null;
        ctx.setQuery(patch);
      });
    });

    /* ═══════════ يومية الصندوق ═══════════ */
    function dailyCash(rg) {
      var ev = HS.store.cashEvents(rg.from, rg.to);
      var byDay = {};
      var carried = HS.store.cashCarried(rg);
      var days = HS.date.range(rg.from, rg.to);
      days.forEach(function (d) { byDay[HS.date.toISO(d)] = { date: d, in: 0, out: 0 }; });
      ev.forEach(function (e) {
        var k = HS.date.toISO(e.date);
        if (!byDay[k]) byDay[k] = { date: HS.date.toDate(e.date), in: 0, out: 0 };
        if (e.dir === "in") byDay[k].in = HS.round(byDay[k].in + e.amount, 3);
        else byDay[k].out = HS.round(byDay[k].out + e.amount, 3);
      });
      var bal = carried;
      return Object.keys(byDay).sort().map(function (k) {
        var d = byDay[k];
        bal = HS.round(bal + d.in - d.out, 3);
        return { date: d.date, label: HS.fmt.date(d.date, "short"), in: d.in, out: d.out, net: HS.round(d.in - d.out, 3), balance: bal };
      });
    }

    /* ═══════════ الإجراءات ═══════════ */
    HS.action("cash-clear", function () { ctx.setQuery({ q: null, kind: null, dir2: null, page: null }); });

    HS.action("cash-add", function () {
      var body = '<div class="form-grid">' +
        '<div class="field span-2"><div class="seg seg--full" role="group" aria-label="نوع العملية">' +
          '<button type="button" class="seg__btn" data-cashdir="in" aria-pressed="true">إيداع في الصندوق</button>' +
          '<button type="button" class="seg__btn" data-cashdir="out" aria-pressed="false">سحب من الصندوق</button>' +
        '</div></div>' +
        HS.ui.field({ name: "amount", label: "المبلغ", type: "number", min: 0, step: "0.001", required: true, suffix: st.settings.currency, inputmode: "decimal", attrs: ' data-autofocus' }) +
        HS.ui.field({ name: "date", label: "التاريخ", type: "date", value: HS.date.toISO(new Date()) }) +
        HS.ui.field({ name: "reason", label: "البيان", span2: true, placeholder: "مثال: توريد إلى المصرف، سلفة موظف، إيداع من صاحب المحل", hint: "يظهر في سجل الصندوق وفي التقارير" }) +
      '</div>';
      var dirNow = "in";
      var m = HS.ui.modal({
        title: "عملية صندوق يدوية",
        sub: "الإيداع يزيد الرصيد النقدي والسحب ينقصه",
        body: body,
        footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
                '<button type="button" class="btn btn--primary" id="cashSave"><span class="btn__icon">' + HS.icon("check", 16) + '</span><span class="btn__label">تسجيل العملية</span></button>',
        onMount: function (api) {
          api.body.querySelectorAll("[data-cashdir]").forEach(function (b) {
            b.addEventListener("click", function () {
              dirNow = b.getAttribute("data-cashdir");
              api.body.querySelectorAll("[data-cashdir]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
            });
          });
          api.root.querySelector("#cashSave").addEventListener("click", function () {
            var v = HS.ui.formValues(api.body);
            var amount = Number(v.amount);
            if (!(amount > 0)) { HS.ui.fieldError(api.body, "amount", "أدخل مبلغًا موجبًا"); HS.ui.focusFirstError(api.body); return; }
            var res = HS.store.addCashEntry({ type: dirNow, amount: amount, reason: v.reason, date: v.date });
            if (!res.ok) { HS.ui.toast({ type: "danger", title: res.error }); return; }
            m.close(true);
            HS.ui.toast({
              type: "success", icon: "cash",
              title: dirNow === "in" ? "أُضيف إيداع" : "سُجّل سحب",
              msg: HS.fmt.money(amount) + " — الرصيد المتوقع صار " + HS.fmt.money(HS.store.cash(HS.store.range("all")).expected)
            });
            setTimeout(function () { HS.router.refresh(); }, 220);
          });
        }
      });
    });

    HS.action("cash-del", function (btn) {
      var id = btn.getAttribute("data-id");
      var entry = (st.cashEntries || []).filter(function (e) { return e.id === id; })[0];
      if (!entry) { HS.ui.toast({ type: "danger", title: "العملية غير موجودة" }); return; }
      HS.ui.confirm({
        title: "حذف عملية من الصندوق",
        tone: "warn",
        html: '<p>سيُحذف <b>' + HS.esc(entry.reason) + '</b> بمبلغ <b>' + HS.fmt.money(entry.amount) + '</b> من سجل الصندوق، وسيتغيّر الرصيد المتوقع تبعًا لذلك.</p>'
      }).then(function (yes) {
        if (!yes) return;
        var res = HS.store.deleteCashEntry(id);
        if (!res.ok) { HS.ui.toast({ type: "danger", title: res.error || "تعذّر الحذف" }); return; }
        HS.ui.toast({
          type: "success", icon: "trash", title: "حُذفت العملية",
          actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }]
        });
        HS.router.refresh();
      });
    });

    HS.action("cash-count", function () {
      var now = HS.store.cash(HS.store.range("all"));
      var m = HS.ui.modal({
        title: "جرد الصندوق",
        sub: "عدّ النقد الموجود فعليًا وقارنه بالرصيد المتوقع",
        body: '<div class="stack">' +
          '<div class="alert alert--info">' + HS.icon("info", 16) +
            '<span>الرصيد المتوقع حسب العمليات: <b>' + HS.fmt.money(now.expected) + '</b></span></div>' +
          '<div class="form-grid">' +
            HS.ui.field({ name: "actual", label: "المبلغ المعدود فعليًا", type: "number", min: 0, step: "0.001", required: true, suffix: st.settings.currency, inputmode: "decimal", attrs: ' data-autofocus' }) +
            HS.ui.field({ name: "reason", label: "ملاحظة الجرد", placeholder: "مثال: جرد نهاية اليوم" }) +
          '</div>' +
          '<div class="alert alert--neutral" id="diffBox" role="status">أدخل المبلغ المعدود لعرض الفرق.</div>' +
        '</div>',
        footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
                '<button type="button" class="btn btn--primary" id="doCount"><span class="btn__icon">' + HS.icon("check", 16) + '</span><span class="btn__label">تسجيل الفرق</span></button>',
        onMount: function (api) {
          var inp = api.body.querySelector('[name="actual"]');
          var box = api.body.querySelector("#diffBox");
          function upd() {
            var v = Number(inp.value);
            if (!(v >= 0) || inp.value === "") { box.className = "alert alert--neutral"; box.textContent = "أدخل المبلغ المعدود لعرض الفرق."; return; }
            var diff = HS.round(v - now.expected, 3);
            box.className = "alert " + (Math.abs(diff) < 0.001 ? "alert--success" : diff > 0 ? "alert--info" : "alert--warning");
            box.innerHTML = HS.icon(Math.abs(diff) < 0.001 ? "check-circle" : "alert", 16) +
              '<span>' + (Math.abs(diff) < 0.001 ? "الصندوق مطابق تمامًا."
                : diff > 0 ? "زيادة في الصندوق مقدارها <b>" + HS.fmt.money(diff) + "</b>"
                : "عجز في الصندوق مقداره <b>" + HS.fmt.money(Math.abs(diff)) + "</b>") + '</span>';
          }
          inp.addEventListener("input", upd);
          api.root.querySelector("#doCount").addEventListener("click", function () {
            var v = HS.ui.formValues(api.body);
            var actual = Number(v.actual);
            if (!(actual >= 0) || v.actual === "") { HS.ui.fieldError(api.body, "actual", "أدخل المبلغ المعدود"); return; }
            var diff = HS.round(actual - now.expected, 3);
            if (Math.abs(diff) < 0.001) {
              m.close(true);
              HS.ui.toast({ type: "success", icon: "check-circle", title: "الصندوق مطابق", msg: "لا فرق بين المعدود والمتوقع." });
              return;
            }
            HS.store.addCashEntry({
              type: diff > 0 ? "in" : "out",
              amount: Math.abs(diff),
              reason: (diff > 0 ? "زيادة جرد الصندوق" : "عجز جرد الصندوق") + (v.reason ? " — " + v.reason : "")
            });
            m.close(true);
            HS.ui.toast({
              type: diff > 0 ? "success" : "warning", icon: "clipboard",
              title: "سُجّل فرق الجرد",
              msg: (diff > 0 ? "زيادة " : "عجز ") + HS.fmt.money(Math.abs(diff)) + " — الرصيد صار " + HS.fmt.money(HS.store.cash(HS.store.range("all")).expected)
            });
            setTimeout(function () { HS.router.refresh(); }, 220);
          });
        }
      });
    });

    HS.action("cash-export", function () {
      var rows = HS.store.cashLedger(range).map(function (e) {
        return {
          "التاريخ": HS.fmt.date(e.date), "الوقت": HS.fmt.time(e.date),
          "النوع": kindName(e.kind), "البيان": e.label, "المرجع": e.ref || "",
          "دخول": e.dir === "in" ? e.amount : "", "خروج": e.dir === "out" ? e.amount : "",
          "الرصيد": e.balance
        };
      });
      if (!rows.length) { HS.ui.toast({ type: "info", title: "لا حركات للتصدير في هذه الفترة" }); return; }
      var ok = HS.download("الصندوق-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
      HS.ui.toast({ type: ok ? "success" : "danger", icon: "download", title: ok ? "صُدّر سجل الصندوق" : "تعذّر التصدير", msg: rows.length + " حركة نقدية" });
    });

    HS.action("cash-print", function () { HS.pages.cash.print(range); });

    /* تحديث عند تغيّر الصندوق من شاشة أخرى */
    var off = HS.bus.on("cash:change", function () { HS.router.refresh(); });
    return { unmount: off };
  };

  /* ═══════════ طباعة تقرير الصندوق (A4) ═══════════ */
  HS.pages.cash.print = function (range) {
    var c = HS.store.cash(range);
    var s = HS.store.state.settings;
    var rows = HS.store.cashLedger(range);
    var holder = HS.$("#printRoot");
    holder.innerHTML =
      '<div class="print-report">' +
        '<header class="print-report__head">' +
          '<div><h1>' + HS.esc(s.storeName) + '</h1>' +
          '<p>' + HS.esc(s.branch || "") + ' · ' + HS.esc(s.address || "") + '</p>' +
          '<p>هاتف: <span dir="ltr">' + HS.esc(s.phone || "") + '</span></p></div>' +
          '<div class="print-report__title"><h2>تقرير الصندوق</h2>' +
          '<p>' + HS.esc(range.label) + ' — من ' + HS.fmt.date(range.from) + ' إلى ' + HS.fmt.date(range.to) + '</p>' +
          '<p>طُبع في ' + HS.fmt.dateTime(new Date()) + '</p></div>' +
        '</header>' +
        '<table class="print-report__sum"><tbody>' +
          '<tr><td>رصيد مُرحَّل قبل الفترة</td><td>' + HS.fmt.money(c.carried) + '</td></tr>' +
          '<tr><td>مبيعات نقدية محصّلة</td><td>' + HS.fmt.money(c.cashCollected) + '</td></tr>' +
          '<tr><td>سداد ديون نقدًا</td><td>' + HS.fmt.money(c.debtCash) + '</td></tr>' +
          '<tr><td>مقدمات على الديون</td><td>' + HS.fmt.money(c.creditDownPayment) + '</td></tr>' +
          '<tr><td>إيداعات</td><td>' + HS.fmt.money(c.otherIn) + '</td></tr>' +
          '<tr><td>مصروفات نقدية</td><td>−' + HS.fmt.money(c.expCash) + '</td></tr>' +
          '<tr><td>سحب وتوريد للمصرف</td><td>−' + HS.fmt.money(c.otherOut) + '</td></tr>' +
          '<tr><td>استرداد مبيعات ملغاة</td><td>−' + HS.fmt.money(c.refunds) + '</td></tr>' +
          '<tr class="print-report__total"><td>الرصيد النقدي المتوقع</td><td>' + HS.fmt.money(c.expected) + '</td></tr>' +
        '</tbody></table>' +
        '<p class="print-report__note">خارج الصندوق: مبيعات بطاقة ' + HS.fmt.money(c.cardSales) +
          ' · ديون غير محصّلة ' + HS.fmt.money(c.creditOutstanding) +
          ' · مصروفات غير نقدية ' + HS.fmt.money(c.expOther) + '</p>' +
        '<h3>سجل الحركات (' + rows.length + ')</h3>' +
        '<table class="print-report__tbl"><thead><tr>' +
          '<th>التاريخ</th><th>النوع</th><th>البيان</th><th>دخول</th><th>خروج</th><th>الرصيد</th>' +
        '</tr></thead><tbody>' +
          (rows.length ? rows.map(function (e) {
            return '<tr><td>' + HS.fmt.date(e.date) + ' ' + HS.fmt.time(e.date) + '</td>' +
              '<td>' + HS.esc(kindName(e.kind)) + '</td>' +
              '<td>' + HS.esc(e.label) + '</td>' +
              '<td>' + (e.dir === "in" ? HS.fmt.money(e.amount) : "") + '</td>' +
              '<td>' + (e.dir === "out" ? HS.fmt.money(e.amount) : "") + '</td>' +
              '<td>' + HS.fmt.money(e.balance) + '</td></tr>';
          }).join("") : '<tr><td colspan="6">لا حركات في هذه الفترة</td></tr>') +
        '</tbody></table>' +
        '<footer class="print-report__foot">' +
          '<span>توقيع المسؤول: ............................</span>' +
          '<span>توقيع صاحب المحل: ............................</span>' +
        '</footer>' +
      '</div>';
    document.body.setAttribute("data-printing", "report");
    var done = function () {
      document.body.removeAttribute("data-printing");
      holder.innerHTML = "";
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(function () { window.print(); setTimeout(done, 1200); }, 60);
  };
})();
