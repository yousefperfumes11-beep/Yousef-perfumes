/* ═══════════════════════════════════════════════════════════
   pages/expenses.js — المصروفات التشغيلية
   سجل + ملخّص شهري + توزيع حسب البند + مقارنة بالإيرادات.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 15, sort: "date", dir: "desc" };

  HS.pages.expenses = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var cat = ctx.query.cat || "";
    var method = ctx.query.method || "";
    var from = ctx.query.from || "";
    var to = ctx.query.to || "";
    var canEdit = HS.store.can("expenses_manage");

    HS.ui.setHeader({
      title: "المصروفات",
      sub: "كل ما يُصرف على تشغيل المحل خارج تكلفة البضاعة: إيجار، رواتب، خدمات، صيانة.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المصروفات" }],
      hidePeriod: true
    });

    var all = st.expenses.slice();

    var list = all.filter(function (e) {
      if (cat && e.category !== cat) return false;
      if (method && e.method !== method) return false;
      if (from && HS.date.toDate(e.date) < HS.date.startOfDay(from)) return false;
      if (to && HS.date.toDate(e.date) > HS.date.endOfDay(to)) return false;
      if (ls.q && !HS.matches((e.note || "") + " " + HS.store.expenseCat(e.category).name + " " + ((HS.store.user(e.userId) || {}).name || ""), ls.q)) return false;
      return true;
    });
    list = HS.sortBy(list, ls.sort === "amount" ? function (e) { return e.amount; } : function (e) { return e.date; }, ls.dir);

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || cat || method || from || to);

    /* ── مجاميع ── */
    var thisMonth = new Date(); thisMonth.setDate(1);
    var monthExp = HS.round(HS.sum(all.filter(function (e) { return HS.date.toDate(e.date) >= thisMonth; }), function (e) { return e.amount; }), 3);
    var last30 = HS.store.range("30d");
    var exp30 = HS.round(HS.sum(HS.store.inRange(all, last30), function (e) { return e.amount; }), 3);
    var k30 = HS.store.kpis(last30);
    var recurring = HS.round(HS.sum(all.filter(function (e) { return e.recurring; }), function (e) { return e.amount; }), 3);

    /* أشهر متاحة في البيانات */
    var byMonth = {};
    all.forEach(function (e) {
      var d = HS.date.toDate(e.date);
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      byMonth[key] = (byMonth[key] || 0) + e.amount;
    });
    var monthKeys = Object.keys(byMonth).sort();
    var monthLabels = monthKeys.map(function (k) { return HS.fmt.month(k + "-01"); });

    /* توزيع حسب البند */
    var byCat = HS.data.EXPENSE_CATS.map(function (c, i) {
      var items = all.filter(function (e) { return e.category === c.id; });
      return {
        id: c.id, name: c.name, emoji: c.emoji, color: HS.chart.palette[i % HS.chart.palette.length],
        total: HS.round(HS.sum(items, function (e) { return e.amount; }), 3),
        count: items.length,
        last: items.length ? items.map(function (e) { return e.date; }).sort().slice(-1)[0] : null
      };
    }).filter(function (c) { return c.count > 0; }).sort(function (a, b) { return b.total - a.total; });
    var catTotal = HS.round(HS.sum(byCat, function (c) { return c.total; }), 3);

    /* إيرادات مقابل مصروفات شهريًا */
    var revByMonth = {};
    HS.store.state.sales.forEach(function (s) {
      if (s.status === "held" || s.status === "returned") return;
      var d = HS.date.toDate(s.date);
      var key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      revByMonth[key] = (revByMonth[key] || 0) + s.total;
    });

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("مصروفات هذا الشهر", HS.fmt.money(monthExp), HS.fmt.month(thisMonth)) +
        HS.ui.statMini("آخر 30 يومًا", HS.fmt.money(exp30), HS.fmt.pct(k30.revenue ? exp30 / k30.revenue : 0, 1) + " من الإيرادات") +
        HS.ui.statMini("صافي الربح بعد المصروفات", HS.fmt.money(k30.net), "أرباح " + HS.fmt.money(k30.profit) + " − مصروفات") +
        HS.ui.statMini("بنود ثابتة متكررة", HS.fmt.money(recurring), HS.fmt.int(all.filter(function (e) { return e.recurring; }).length) + " عملية") +
        HS.ui.statMini("أكبر بند", byCat.length ? HS.esc(byCat[0].emoji + " " + byCat[0].name) : "—", byCat.length ? HS.fmt.money(byCat[0].total) : "") +
      '</section>' +

      '<section class="grid-main">' +
        '<article class="card"><div class="card__head"><div><h2 class="card__title">المصروفات مقابل الإيرادات</h2>' +
        '<p class="card__sub">مقارنة شهرية</p></div></div><div class="card__body">' +
        (monthKeys.length ? '<div class="chart-box">' + HS.chart.bar({
          labels: monthLabels,
          series: [
            { name: "الإيرادات", values: monthKeys.map(function (k) { return HS.round(revByMonth[k] || 0, 3); }), color: "var(--primary)" },
            { name: "المصروفات", values: monthKeys.map(function (k) { return HS.round(byMonth[k] || 0, 3); }), color: "var(--danger)" }
          ],
          height: 232, yFormat: function (v) { return HS.fmt.moneyShort(v); },
          ariaLabel: "مقارنة الإيرادات والمصروفات شهريًا"
        }).html + '</div>' + HS.chart.legend([
          { label: "الإيرادات", color: "var(--primary)" },
          { label: "المصروفات", color: "var(--danger)" }
        ]) : HS.ui.empty({ icon: "wallet", title: "لا بيانات شهرية كافية" })) +
        '</div></article>' +

        '<article class="card"><div class="card__head"><div><h2 class="card__title">التوزيع حسب البند</h2>' +
        '<p class="card__sub">إجمالي ' + HS.fmt.money(catTotal) + '</p></div></div><div class="card__body">' +
        (byCat.length ? '<div class="center" style="gap:var(--sp-4)"><div class="chart-box" style="max-width:180px">' +
          HS.chart.donut({ data: byCat.map(function (c) { return { label: c.name, value: c.total, color: c.color }; }), size: 180, center: HS.fmt.moneyShort(catTotal), centerSub: HS.fmt.int(byCat.length) + " بنود", centerSize: 18, ariaLabel: "توزيع المصروفات حسب البند" }).html +
          '</div></div>' +
          '<div class="list" style="margin-block-start:var(--sp-4)">' + byCat.map(function (c) {
            var share = catTotal ? c.total / catTotal : 0;
            return '<div class="list__item" style="padding-block:var(--sp-2)">' +
              '<span class="thumb thumb--sm" aria-hidden="true">' + c.emoji + '</span>' +
              '<span class="list__body"><span class="list__title">' + HS.esc(c.name) + '</span>' +
              '<span class="list__meta">' + HS.fmt.int(c.count) + " عملية · " + HS.fmt.pct(share, 1) + (c.last ? " · آخرها " + HS.fmt.rel(c.last) : "") + '</span>' +
              '<span class="progress rank__bar"><span class="progress__fill" style="width:' + (share * 100).toFixed(1) + '%;background:' + c.color + '"></span></span></span>' +
              '<span class="list__aside fw-600 tabular fs-sm">' + HS.fmt.money(c.total) + '</span></div>';
          }).join("") + '</div>'
          : HS.ui.empty({ icon: "wallet", title: "لا مصروفات مسجّلة" })) +
        '</div></article>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card__head"><div><h2 class="card__title">سجل المصروفات</h2>' +
        '<p class="card__sub">' + HS.fmt.int(list.length) + " عملية" + (filtersActive ? " بعد الترشيح" : "") + '</p></div></div>' +
        HS.ui.toolbar({
          q: ls.q, placeholder: "بحث في البيان أو البند أو المستخدم…",
          filters:
            HS.ui.select({ name: "cat", label: "البند", value: cat, options: [{ value: "", label: "كل البنود" }].concat(HS.data.EXPENSE_CATS.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; })) }) +
            HS.ui.select({ name: "method", label: "طريقة الدفع", value: method, options: [{ value: "", label: "كل الطرق" }].concat(HS.data.PAY_METHODS.map(function (m) { return { value: m.id, label: m.name }; })) }) +
            '<span class="row-2"><input class="input input--sm" type="date" name="from" value="' + HS.esc(from) + '" data-exp-filter aria-label="من تاريخ">' +
            '<span class="text-3">—</span>' +
            '<input class="input input--sm" type="date" name="to" value="' + HS.esc(to) + '" data-exp-filter aria-label="إلى تاريخ"></span>' +
            (filtersActive ? '<button type="button" class="chip" data-action="exp-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
          actions:
            '<button type="button" class="btn btn--sm btn--secondary" data-action="exp-export"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
            (canEdit ? '<button type="button" class="btn btn--sm btn--primary" data-action="exp-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">مصروف جديد</span></button>' : "")
        }) +
        HS.ui.table([
          { key: "date", label: "التاريخ", sortable: true, width: "132px", render: function (e) { return HS.fmt.date(e.date); } },
          { key: "category", label: "البند", width: "186px", render: function (e) {
              var c = HS.store.expenseCat(e.category);
              return '<span class="row-2"><span class="thumb thumb--sm" aria-hidden="true">' + c.emoji + '</span><span class="truncate">' + HS.esc(c.name) + '</span></span>';
            } },
          { key: "note", label: "البيان", render: function (e) {
              return '<span class="truncate" title="' + HS.esc(e.note || "") + '">' + HS.esc(e.note || "—") + '</span>';
            } },
          { key: "method", label: "الدفع", width: "124px", render: function (e) { return HS.ui.badge(HS.store.payMethod(e.method).name, "badge--outline"); } },
          { key: "recurring", label: "", width: "92px", align: "center", render: function (e) {
              return e.recurring ? HS.ui.badge("ثابت", "badge--info") : "";
            } },
          { key: "amount", label: "المبلغ", sortable: true, align: "num", width: "140px", render: function (e) {
              return '<span class="fw-700 text-danger">' + HS.fmt.money(e.amount) + '</span>';
            } },
          { key: "user", label: "سجّله", width: "140px", render: function (e) {
              var u = HS.store.user(e.userId);
              return u ? '<span class="row-2">' + HS.ui.avatar(u.name, "avatar--xs") + '<span class="fs-sm truncate">' + HS.esc(u.name) + '</span></span>' : '<span class="text-3">—</span>';
            } },
          { key: "actions", label: "", align: "center", width: "96px", render: function (e) {
              return canEdit ? '<span class="table__actions">' +
                HS.ui.iconBtn("exp-edit", "pencil", "تعديل", { id: e.id }) +
                HS.ui.iconBtn("exp-delete", "trash", "حذف", { id: e.id }, "icon-btn--danger") +
              '</span>' : "";
            } }
        ], paged, {
          sort: { key: ls.sort, dir: ls.dir },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "wallet",
            title: filtersActive ? "لا مصروفات مطابقة" : "لا مصروفات مسجّلة",
            text: filtersActive ? "أزل بعض المرشّحات أو وسّع نطاق التاريخ." : "سجّل أول مصروف لتتبّع تكلفة التشغيل مقابل الإيرادات.",
            action: canEdit ? '<button type="button" class="btn btn--primary btn--sm" data-action="exp-new">تسجيل مصروف</button>' : ""
          }),
          foot: paged.length ? ["", "", '<span class="text-3 fw-500">إجمالي الصفحة</span>', "", "",
            '<span class="fw-700 text-danger">' + HS.fmt.money(HS.sum(paged, function (e) { return e.amount; })) + '</span>', "", ""] : null
        }) +
        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    root.querySelectorAll("[data-exp-filter]").forEach(function (el) {
      el.addEventListener("change", function () {
        var patch = {}; patch[el.name] = el.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
    root.querySelectorAll(".toolbar select").forEach(function (sel) {
      if (sel.hasAttribute("data-exp-filter")) return;
      sel.addEventListener("change", function () {
        var patch = {}; patch[sel.name] = sel.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
  };

  /* ═══════════ النموذج ═══════════ */
  function expenseForm(e) {
    var st = HS.store.state;
    var isNew = !e;
    var v = e || { date: HS.date.toISO(new Date()), category: "other", amount: 0, note: "", method: "cash", recurring: false };
    var m = HS.ui.modal({
      title: isNew ? "تسجيل مصروف" : "تعديل المصروف",
      sub: isNew ? "يُحتسب ضمن تكلفة التشغيل في التقارير" : HS.store.expenseCat(e.category).name,
      size: "sm",
      body: '<div class="form-grid">' +
        HS.ui.field({ name: "category", label: "البند", type: "select", value: v.category, options: HS.data.EXPENSE_CATS.map(function (c) { return { value: c.id, label: c.emoji + " " + c.name }; }) }) +
        HS.ui.field({ name: "date", label: "التاريخ", type: "date", value: v.date, required: true }) +
        HS.ui.field({ name: "amount", label: "المبلغ", type: "number", value: v.amount, min: 0, step: "0.001", suffix: st.settings.currency, required: true, attrs: ' data-autofocus inputmode="decimal"' }) +
        HS.ui.field({ name: "method", label: "طريقة الدفع", type: "select", value: v.method, options: HS.data.PAY_METHODS.map(function (p) { return { value: p.id, label: p.name }; }) }) +
        HS.ui.field({ name: "note", label: "البيان", type: "text", value: v.note, span2: true, placeholder: "مثال: فاتورة الكهرباء عن شهر …" }) +
        '<div class="field span-2">' + HS.ui.field({ name: "recurring", type: "switch", value: v.recurring, checkLabel: "مصروف ثابت يتكرر شهريًا" }) + '</div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="expSave"><span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">حفظ</span></button>'
    });
    m.root.querySelector("#expSave").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      if (!(Number(vals.amount) > 0)) { HS.ui.fieldError(m.body, "amount", "أدخل مبلغًا أكبر من صفر"); ok = false; }
      if (!vals.date) { HS.ui.fieldError(m.body, "date", "حدد التاريخ"); ok = false; }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }
      var res = HS.store.saveExpense({
        date: vals.date, category: vals.category, amount: HS.round(Number(vals.amount), 3),
        note: vals.note, method: vals.method, recurring: vals.recurring,
        userId: st.session.userId || "u-1"
      }, e ? e.id : null);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({ type: "success", icon: isNew ? "plus" : "check", title: (isNew ? "سُجّل مصروف " : "حُدّث المصروف بـ") + HS.fmt.money(res.record.amount), msg: HS.store.expenseCat(res.record.category).name });
      HS.router.refresh();
    });
  }

  HS.action("exp-new", function () { expenseForm(null); });
  HS.action("exp-edit", function (btn) {
    var e = HS.store.state.expenses.filter(function (x) { return x.id === btn.getAttribute("data-id"); })[0];
    if (e) expenseForm(e);
  });
  HS.action("exp-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var e = HS.store.state.expenses.filter(function (x) { return x.id === id; })[0];
    if (!e) return;
    HS.ui.confirm({
      title: "حذف المصروف؟", danger: true, icon: "trash", okLabel: "حذف",
      text: HS.store.expenseCat(e.category).name + " بقيمة " + HS.fmt.money(e.amount) + " بتاريخ " + HS.fmt.date(e.date) + "."
    }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deleteExpense(id);
      if (!res.ok) return;
      HS.ui.toast({ type: "success", icon: "trash", title: "حُذف المصروف", duration: 6000, actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("exp-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, cat: null, method: null, from: null, to: null, page: null, sort: null, dir: null });
  });
  HS.action("exp-export", function () {
    var rows = HS.store.state.expenses.map(function (e) {
      var u = HS.store.user(e.userId);
      return {
        "التاريخ": e.date, "البند": HS.store.expenseCat(e.category).name, "البيان": e.note || "",
        "المبلغ": e.amount, "طريقة الدفع": HS.store.payMethod(e.method).name,
        "ثابت": e.recurring ? "نعم" : "لا", "سجّله": u ? u.name : ""
      };
    });
    if (!rows.length) { HS.ui.toast({ type: "warning", icon: "alert", title: "لا مصروفات للتصدير" }); return; }
    var ok = HS.download("المصروفات-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّرت المصروفات" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " عملية" : "" });
  });
})();
