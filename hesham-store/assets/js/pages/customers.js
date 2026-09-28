/* ═══════════════════════════════════════════════════════════
   pages/customers.js — دليل العملاء والديون
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var DEFAULTS = { per: 12, sort: "spent", dir: "desc" };

  /**
   * حالة الدين كما يحددها المطلوب:
   * مستحق بالكامل (لم يُدفع منه شيء) · مدفوع جزئيًا · مسدد · لا دين.
   */
  function debtStatus(c) {
    var st = HS.store.state;
    var hasCredit = (c.totalCharged || 0) > 0.001 || st.sales.some(function (s) {
      return s.customerId === c.id && s.method === "credit" && s.status !== "returned" && s.status !== "held";
    });
    if ((c.balance || 0) <= 0.001) {
      return hasCredit ? { id: "settled", label: "مسدد", cls: "badge--success" }
                       : { id: "none", label: "لا دين", cls: "badge--neutral" };
    }
    var partPaid = (c.totalPaid || 0) > 0.001 || st.sales.some(function (s) {
      return s.customerId === c.id && s.status === "partial";
    });
    return partPaid ? { id: "partial", label: "مدفوع جزئيًا", cls: "badge--warning" }
                    : { id: "due", label: "مستحق بالكامل", cls: "badge--danger" };
  }
  HS.pages.customers = { debtStatus: debtStatus };

  HS.pages.customers.render = function (root, ctx) {
    var st = HS.store.state;
    var ls = HS.router.listState(ctx, DEFAULTS);
    var tab = ctx.query.tab || "all";
    var city = ctx.query.city || "";
    var dstat = ctx.query.dstat || "";
    var canEdit = HS.store.can("customers_edit");
    var canDebt = HS.store.can("debts_manage");
    var dsum = HS.store.debts(HS.store.range(st.ui.period || "30d"));

    HS.ui.setHeader({
      title: "العملاء والديون",
      sub: "بطاقات العملاء، أرصدة الديون وحالاتها، سجل المشتريات والدفعات، وإضافة دين أو سداد جزئي أو تسوية كاملة.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "العملاء والديون" }],
      hidePeriod: false
    });

    function stats(c) {
      var sales = st.sales.filter(function (s) { return s.customerId === c.id && s.status !== "held" && s.status !== "returned"; });
      var last = sales.length ? sales.map(function (s) { return s.date; }).sort().slice(-1)[0] : null;
      var last90 = sales.filter(function (s) { return HS.date.toDate(s.date) >= HS.date.addDays(new Date(), -90); });
      return {
        orders: sales.length,
        spent: HS.round(HS.sum(sales, function (s) { return s.total; }), 3),
        last: last,
        last90: HS.round(HS.sum(last90, function (s) { return s.total; }), 3),
        due: HS.round(HS.sum(sales.filter(function (s) { return s.status === "unpaid" || s.status === "partial"; }), function (s) { return s.total - s.paid; }), 3)
      };
    }

    var all = st.customers.map(function (c) { return Object.assign({}, c, { _s: stats(c) }); });

    var counts = {
      all: all.length,
      credit: all.filter(function (c) { return HS.store.creditAccount(c); }).length,
      owing: all.filter(function (c) { return c.balance > 0.001; }).length,
      overLimit: all.filter(function (c) { return c.creditLimit && c.balance > c.creditLimit; }).length
    };

    var list = all.filter(function (c) {
      if (tab === "credit" && !HS.store.creditAccount(c)) return false;
      if (tab === "cash" && HS.store.creditAccount(c)) return false;
      if (tab === "owing" && c.balance <= 0.001) return false;
      if (dstat && debtStatus(c).id !== dstat) return false;
      if (tab === "over" && !(c.creditLimit && c.balance > c.creditLimit)) return false;
      if (tab === "inactive" && c.active) return false;
      if (city && c.city !== city) return false;
      if (ls.q && !HS.matches(c.name + " " + c.phone + " " + c.city + " " + (c.note || ""), ls.q)) return false;
      return true;
    });

    list = HS.sortBy(list, ls.sort === "balance" ? function (c) { return c.balance; }
      : ls.sort === "visits" ? function (c) { return c.visits; }
      : ls.sort === "name" ? function (c) { return c.name; }
      : ls.sort === "last" ? function (c) { return c._s.last || ""; }
      : function (c) { return c._s.spent; }, ls.dir);

    var paged = HS.ui.paginate(list, ls.page, ls.per);
    var filtersActive = !!(ls.q || city || dstat || tab !== "all");
    var totalDue = HS.round(HS.sum(all, function (c) { return c.balance; }), 3);

    var tabs = [
      { id: "all", label: "كل العملاء", count: counts.all },
      { id: "credit", label: "حسابات دين", count: counts.credit },
      { id: "owing", label: "عليهم ديون", count: counts.owing },
      { id: "over", label: "تجاوزوا الحد", count: counts.overLimit },
      { id: "cash", label: "نقدي", count: all.filter(function (c) { return !HS.store.creditAccount(c); }).length },
      { id: "inactive", label: "موقوف", count: all.filter(function (c) { return !c.active; }).length }
    ];

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("عدد العملاء", HS.fmt.int(counts.all), counts.credit + " حساب دين") +
        HS.ui.statMini("إجمالي المشتريات", HS.fmt.money(HS.round(HS.sum(all, function (c) { return c._s.spent; }), 3)), HS.fmt.int(HS.sum(all, function (c) { return c._s.orders; })) + " فاتورة") +
        HS.ui.statMini("الديون المستحقة الآن", HS.fmt.money(totalDue), counts.owing + " عميل · " + HS.fmt.int(all.filter(function (c) { return debtStatus(c).id === "due"; }).length) + " مستحق بالكامل") +
        HS.ui.statMini("ديون نشأت في الفترة", HS.fmt.money(dsum.granted), dsum.chargeCount ? HS.fmt.int(dsum.chargeCount) + " منها مضاف يدويًا" : "من فواتير الدين") +
        HS.ui.statMini("محصَّل في الفترة", HS.fmt.money(dsum.totalCollected), HS.fmt.int(dsum.collectedCount) + " عملية سداد") +
        HS.ui.statMini("متوسط إنفاق العميل", HS.fmt.money(HS.round(HS.avg(all.map(function (c) { return c._s.spent; })), 3)), "على كل الفترة") +
        HS.ui.statMini("تجاوزوا الحد الائتماني", HS.fmt.int(counts.overLimit), counts.overLimit ? "يحتاج متابعة" : "لا تجاوزات") +
      '</section>' +

      '<section class="card">' +
        '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
        HS.ui.toolbar({
          q: ls.q, placeholder: "بحث بالاسم أو الهاتف أو المدينة…",
          filters: HS.ui.select({ name: "city", label: "المدينة", value: city, options: [{ value: "", label: "كل المدن" }].concat(HS.uniq(all.map(function (c) { return c.city; })).sort().map(function (c) { return { value: c, label: c }; })) }) +
            HS.ui.select({ name: "dstat", label: "حالة الدين", value: dstat, options: [
              { value: "", label: "كل حالات الدين" },
              { value: "due", label: "مستحق بالكامل" },
              { value: "partial", label: "مدفوع جزئيًا" },
              { value: "settled", label: "مسدد" },
              { value: "none", label: "لا دين عليه" }
            ] }) +
            (filtersActive ? '<button type="button" class="chip" data-action="cus-clear">' + HS.icon("x", 13) + ' إزالة</button>' : ""),
          actions:
            '<button type="button" class="btn btn--sm btn--secondary" data-action="cus-export"><span class="btn__icon">' + HS.icon("download", 15) + '</span><span class="btn__label">تصدير</span></button>' +
            (canEdit ? '<button type="button" class="btn btn--sm btn--primary" data-action="cus-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">عميل جديد</span></button>' : "")
        }) +
        HS.ui.table([
          { key: "name", label: "العميل", sortable: true, render: function (c) {
              return '<span class="row-2">' + HS.ui.avatar(c.name) +
                '<span style="min-width:0"><span class="truncate fw-600" style="display:block">' + HS.esc(c.name) + '</span>' +
                '<span class="fs-xs text-3" style="display:block">' + HS.esc(c.city) + (c.note ? ' · ' + HS.esc(c.note) : "") + '</span></span></span>';
            } },
          { key: "phone", label: "الهاتف", width: "146px", render: function (c) {
              return '<a class="ltr fs-sm" href="tel:' + HS.esc(c.phone) + '">' + HS.esc(HS.ui.phone(c.phone)) + '</a>';
            } },
          { key: "type", label: "نوع الحساب", width: "118px", align: "center", render: function (c) {
              return HS.store.creditAccount(c) ? HS.ui.badge("حساب دين", "badge--warning") : HS.ui.badge("نقدي", "badge--neutral");
            } },
          { key: "visits", label: "الزيارات", sortable: true, align: "num", width: "96px", render: function (c) { return HS.fmt.int(c.visits); } },
          { key: "spent", label: "إجمالي المشتريات", sortable: true, align: "num", width: "154px", render: function (c) {
              return '<span class="fw-600">' + HS.fmt.money(c._s.spent) + '</span>' +
                (c._s.last ? '<span class="fs-2xs text-3" style="display:block">آخر زيارة ' + HS.fmt.rel(c._s.last) + '</span>' : "");
            } },
          { key: "balance", label: "الدين المستحق", sortable: true, align: "num", width: "186px", render: function (c) {
              var ds = debtStatus(c);
              var over = c.creditLimit && c.balance > c.creditLimit;
              return '<span style="min-width:0">' +
                '<span class="fw-700 ' + (c.balance > 0.001 ? (over ? "text-danger" : "") : "text-success") + '">' +
                  (c.balance > 0.001 ? HS.fmt.money(c.balance) : "0,000") + '</span>' +
                '<span style="display:block;margin-block-start:3px">' + HS.ui.badge(ds.label, ds.cls) + '</span>' +
                (c.creditLimit && c.balance > 0.001 ? '<span class="fs-2xs ' + (over ? "text-danger" : "text-3") + '" style="display:block">' +
                  (over ? "تجاوز الحد " + HS.fmt.money(c.creditLimit) : "من حد " + HS.fmt.money(c.creditLimit)) + '</span>' : "") +
                '</span>';
            } },
          { key: "status", label: "", align: "center", width: "86px", render: function (c) {
              return c.active ? HS.ui.badge("نشط", "badge--success") : HS.ui.badge("موقوف", "badge--neutral");
            } },
          { key: "actions", label: "", align: "center", width: "120px", render: function (c) {
              return '<span class="table__actions">' +
                HS.ui.iconBtn("cus-view", "eye", "عرض البطاقة", { id: c.id }) +
                (canDebt && c.balance > 0.001 ? HS.ui.iconBtn("cus-pay", "cash", "تسجيل سداد", { id: c.id }) : "") +
                (canDebt ? HS.ui.iconBtn("cus-debt", "receipt", "إضافة دين", { id: c.id }) : "") +
                (canEdit ? HS.ui.iconBtn("cus-menu", "more", "إجراءات", { id: c.id }) : "") +
              '</span>';
            } }
        ], paged, {
          sort: { key: ls.sort, dir: ls.dir },
          rowAttrs: function (c) { return ' data-selectable="true" data-action="cus-view" data-id="' + c.id + '"'; },
          empty: HS.ui.empty({
            icon: filtersActive ? "search" : "users",
            title: filtersActive ? "لا عملاء مطابقون" : "لا عملاء في هذا التبويب",
            text: filtersActive ? "جرّب البحث بالهاتف أو أزل مرشّح المدينة." : "أضف عميلًا لتتمكن من البيع بالدين وربط الفواتير.",
            action: filtersActive
              ? '<button type="button" class="btn btn--secondary btn--sm" data-action="cus-clear">إزالة المرشّحات</button>'
              : (canEdit ? '<button type="button" class="btn btn--primary btn--sm" data-action="cus-new">إضافة عميل</button>' : "")
          }),
          foot: paged.length ? ["", "", "",
            HS.fmt.int(HS.sum(paged, function (c) { return c.visits; })) + " زيارة",
            HS.fmt.money(HS.sum(paged, function (c) { return c._s.spent; })),
            '<span class="fw-700">' + HS.fmt.money(HS.sum(paged, function (c) { return c.balance; })) + '</span>', "", ""] : null
        }) +
        HS.ui.pager({ page: ls.page, per: ls.per, total: list.length }) +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);
    root.querySelectorAll('.toolbar select[data-filter]').forEach(function (sel) {
      sel.addEventListener("change", function () {
        var patch = {}; patch[sel.name] = sel.value || null; patch.page = null;
        ctx.setQuery(patch);
      });
    });
  };

  /* ═══════════ النموذج ═══════════ */
  function customerForm(c) {
    var st = HS.store.state;
    var isNew = !c;
    var v = c || { name: "", phone: "", city: "طرابلس", accountType: "نقدي", creditLimit: 0, balance: 0, note: "", active: true };

    var m = HS.ui.modal({
      title: isNew ? "إضافة عميل" : "تعديل بيانات العميل",
      sub: isNew ? "يمكن ربط فواتير الدين بالعميل لمتابعة ديونه" : v.name,
      size: "lg",
      body: '<div class="form-grid">' +
        HS.ui.field({ name: "name", label: "اسم العميل", value: v.name, required: true, span2: true, attrs: ' data-autofocus autocomplete="name"', placeholder: "مثال: مطعم الشاطئ للوجبات السريعة" }) +
        HS.ui.field({ name: "phone", label: "رقم الهاتف", value: v.phone, attrs: ' dir="ltr" autocomplete="tel" inputmode="tel"', placeholder: "0913000000" }) +
        HS.ui.field({ name: "city", label: "المدينة", type: "select", value: v.city, options: HS.data.CITIES.map(function (x) { return { value: x, label: x }; }) }) +
        HS.ui.field({ name: "accountType", label: "نوع الحساب", type: "select", value: v.accountType, options: [{ value: "نقدي", label: "نقدي — يدفع عند الشراء نقدًا أو بالبطاقة" }, { value: "دين", label: "دين — له حد ائتماني ويُباع بالدين" }], hint: "حساب الدين يظهر في نقطة البيع مع تنبيه بالرصيد" }) +
        HS.ui.field({ name: "creditLimit", label: "الحد الائتماني", type: "number", value: v.creditLimit, min: 0, step: "1", suffix: st.settings.currency, inputmode: "decimal", hint: "صفر يعني بلا سقف" }) +
        HS.ui.field({ name: "balance", label: isNew ? "رصيد افتتاحي مستحق" : "الرصيد الحالي", type: "number", value: v.balance, min: 0, step: "0.001", suffix: st.settings.currency, inputmode: "decimal", hint: isNew ? "ديون سابقة قبل بدء الاستخدام" : "يتغيّر تلقائيًا من الفواتير والسداد" }) +
        HS.ui.field({ name: "note", label: "ملاحظات", type: "textarea", value: v.note, rows: 2, span2: true, placeholder: "مواعيد الفوترة، طريقة السداد المعتادة…" }) +
        '<div class="field span-2">' + HS.ui.field({ name: "active", type: "switch", value: v.active, checkLabel: "العميل نشط ويظهر في نقطة البيع" }) + '</div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="cusSave"><span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">' + (isNew ? "إضافة العميل" : "حفظ التعديلات") + '</span></button>'
    });

    m.root.querySelector("#cusSave").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      if (!String(vals.name).trim()) { HS.ui.fieldError(m.body, "name", "اسم العميل مطلوب"); ok = false; }
      var digits = String(vals.phone).replace(/\D/g, "");
      if (vals.phone && (digits.length < 9 || digits.length > 11)) { HS.ui.fieldError(m.body, "phone", "رقم الهاتف غير مكتمل (9–11 رقمًا)"); ok = false; }
      var dup = st.customers.filter(function (x) { return (!c || x.id !== c.id) && HS.normalizeAr(x.name) === HS.normalizeAr(String(vals.name).trim()); })[0];
      if (dup) { HS.ui.fieldError(m.body, "name", "يوجد عميل بنفس الاسم"); ok = false; }
      if (vals.accountType === "دين" && !Number(vals.creditLimit)) {
        HS.ui.fieldError(m.body, "creditLimit", "حدد حدًا ائتمانيًا لحساب الدين (أو اتركه 0 بلا سقف مع تأكيد)");
        ok = false;
      }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }

      var res = HS.store.saveCustomer({
        name: String(vals.name).trim(), phone: vals.phone, city: vals.city,
        accountType: vals.accountType, creditLimit: HS.round(Number(vals.creditLimit) || 0, 3),
        balance: HS.round(Number(vals.balance) || 0, 3), note: vals.note, active: vals.active
      }, c ? c.id : null);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({ type: "success", icon: isNew ? "plus" : "check", title: (isNew ? "أُضيف العميل " : "حُدّث ") + "«" + res.record.name + "»" });
      HS.router.refresh();
    });
  }

  /* ═══════════ الإجراءات ═══════════ */
  HS.action("cus-new", function () { customerForm(null); });
  HS.action("cus-edit", function (btn) {
    HS.ui.closePop();
    var c = HS.store.customer(btn.getAttribute("data-id"));
    if (c) customerForm(c);
  });
  HS.action("cus-view", function (btn) {
    var c = HS.store.customer(btn.getAttribute("data-id"));
    if (!c) return;
    var st = HS.store.state;
    var canEdit = HS.store.can("customers_edit");
    var sales = st.sales.filter(function (s) { return s.customerId === c.id && s.status !== "held"; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var valid = sales.filter(function (s) { return s.status !== "returned"; });
    var spent = HS.round(HS.sum(valid, function (s) { return s.total; }), 3);
    var due = HS.round(HS.sum(valid.filter(function (s) { return s.status === "unpaid" || s.status === "partial"; }), function (s) { return s.total - s.paid; }), 3);
    var range90 = HS.store.range("90d");
    var last90 = HS.round(HS.sum(valid.filter(function (s) { return HS.store.inRange([s], range90).length; }), function (s) { return s.total; }), 3);
    var payments = HS.store.paymentsOf(c.id);

    HS.ui.modal({
      title: c.name,
      sub: c.city + " · " + (HS.store.creditAccount(c) ? "حساب دين" : "حساب نقدي"),
      size: "lg",
      body: '<div class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("الفواتير", HS.fmt.int(sales.length), sales.length ? "آخرها " + HS.fmt.date(sales[0].date) : "لا فواتير") +
          HS.ui.statMini("إجمالي المشتريات", HS.fmt.money(spent), "آخر 90 يومًا " + HS.fmt.money(last90)) +
          HS.ui.statMini("الدين المتبقي", HS.fmt.money(c.balance), (function () {
            var ds = debtStatus(c);
            return ds.label + (c.totalCharged > 0.001 ? " · منه " + HS.fmt.money(c.totalCharged) + " مضاف يدويًا" : "");
          })()) +
          HS.ui.statMini("إجمالي المسدَّد", HS.fmt.money(c.totalPaid || 0), HS.fmt.int(payments.filter(function (x) { return x.amount > 0; }).length) + " عملية سداد") +
          HS.ui.statMini("الحد الائتماني", c.creditLimit ? HS.fmt.money(c.creditLimit) : "بلا سقف", c.creditLimit ? "المستخدم " + HS.fmt.pct(c.balance / c.creditLimit, 0) : "") +
        '</div>' +
        HS.ui.kv([
          ["الهاتف", '<a class="ltr" href="tel:' + HS.esc(c.phone) + '">' + HS.esc(HS.ui.phone(c.phone)) + '</a>'],
          ["المدينة", HS.esc(c.city)],
          ["الزيارات المسجّلة", HS.fmt.int(c.visits)],
          ["حالة الدين", (function () { var ds = debtStatus(c); return HS.ui.badge(ds.label, ds.cls); })()],
          ["الحالة", c.active ? HS.ui.badge("نشط", "badge--success") : HS.ui.badge("موقوف", "badge--neutral")],
          ["عميل منذ", HS.fmt.date(c.createdAt)],
          ["ملاحظات", c.note ? HS.esc(c.note) : '<span class="text-3">—</span>']
        ]) +
        (c.creditLimit ? '<div><span class="field__label">استخدام الحد الائتماني</span>' +
          '<div class="progress" style="height:8px"><span class="progress__fill" style="width:' + Math.min(100, (c.balance / c.creditLimit) * 100).toFixed(1) + '%;background:' + (c.balance > c.creditLimit ? "var(--danger)" : "var(--primary)") + '"></span></div>' +
          '<div class="spread fs-xs text-3" style="margin-block-start:var(--sp-1)"><span>' + HS.fmt.money(c.balance) + ' مستخدم</span><span>' + HS.fmt.money(Math.max(0, c.creditLimit - c.balance)) + ' متاح</span></div></div>' : "") +
        '<section><h3 class="fs-md fw-600" style="margin-block:var(--sp-2)">الفواتير</h3>' +
        (sales.length ? '<div class="card" style="box-shadow:none"><div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "number", label: "الرقم", width: "150px", render: function (s) { return '<a href="#/sales/' + s.id + '" class="ltr fw-600">' + HS.esc(s.number) + '</a>'; } },
            { key: "date", label: "التاريخ", width: "124px", render: function (s) { return HS.fmt.date(s.date); } },
            { key: "items", label: "الأصناف", align: "num", width: "88px", render: function (s) { return HS.fmt.int(s.items.length); } },
            { key: "total", label: "الإجمالي", align: "num", width: "126px", render: function (s) { return HS.fmt.money(s.total); } },
            { key: "paid", label: "المدفوع", align: "num", width: "126px", render: function (s) { return HS.fmt.money(s.paid); } },
            { key: "status", label: "الحالة", align: "center", render: function (s) { return HS.ui.saleStatus(s.status); } }
          ], sales.slice(0, 12)) + '</div></div>' +
          (sales.length > 12 ? '<p class="fs-xs text-3" style="margin-block-start:var(--sp-2)">يعرض آخر 12 فاتورة من أصل ' + HS.fmt.int(sales.length) + '. <a class="link" href="#/sales?customer=' + encodeURIComponent(c.id) + '">عرض الكل في سجل المبيعات</a></p>' : "")
          : HS.ui.empty({ icon: "receipt", title: "لا فواتير لهذا العميل", text: "اربط فاتورة بالعميل من نقطة البيع لتظهر هنا." })) +
        '</section>' +
        (payments.length ? '<section><h3 class="fs-md fw-600" style="margin-block:var(--sp-4) var(--sp-2)">سجل السداد والديون المضافة</h3>' +
          '<div class="list">' + payments.slice(0, 10).map(function (pm) {
            var u = HS.store.user(pm.userId);
            var charge = pm.kind === "charge";
            var amt = Math.abs(pm.amount);
            return '<div class="list__item">' +
              '<span class="thumb thumb--sm" aria-hidden="true">' + HS.icon(charge ? "receipt" : pm.method === "card" ? "card" : "cash", 15) + '</span>' +
              '<span class="list__body"><span class="list__title">' + (charge ? "دين مضاف — " : "سداد — ") + HS.fmt.money(amt) +
                (charge ? "" : " · " + HS.esc(HS.store.payMethod(pm.method).name) + (pm.method === "cash" ? " (دخل الصندوق)" : " (خارج الصندوق)")) + '</span>' +
              '<span class="list__meta">' + HS.fmt.date(pm.date) + (pm.note ? " · " + HS.esc(pm.note) : "") + (u ? " · " + HS.esc(u.name) : "") + '</span></span>' +
              '<span class="list__aside fw-600 tabular ' + (charge ? "text-danger" : "text-success") + '">' + (charge ? "+ " : "− ") + HS.fmt.money(amt) + '</span></div>';
          }).join("") + '</div>' +
          '<p class="fs-xs text-3" style="margin-block-start:var(--sp-2)">إجمالي المسدَّد ' + HS.fmt.money(HS.round(HS.sum(payments.filter(function (x) { return x.amount > 0; }), function (x) { return x.amount; }), 3)) +
            ' عبر ' + HS.fmt.int(payments.filter(function (x) { return x.amount > 0; }).length) + ' عملية' +
            (c.totalCharged > 0.001 ? ' · ديون مضافة ' + HS.fmt.money(c.totalCharged) : "") + ' · المتبقي ' + HS.fmt.money(c.balance) + '.</p>' +
        '</section>' : "") +
      '</div>',
      footer: '<button type="button" class="btn btn--ghost" data-modal-close>إغلاق</button><span class="grow"></span>' +
        (HS.store.can("debts_manage") ? '<button type="button" class="btn btn--ghost" data-modal-close data-action="cus-debt" data-id="' + c.id + '"><span class="btn__icon">' + HS.icon("receipt", 15) + '</span><span class="btn__label">إضافة دين</span></button>' : "") +
        (c.balance > 0.001 && HS.store.can("debts_manage") ? '<button type="button" class="btn btn--secondary" data-modal-close data-action="cus-pay" data-id="' + c.id + '"><span class="btn__icon">' + HS.icon("cash", 15) + '</span><span class="btn__label">تسجيل سداد</span></button>' : "") +
        (canEdit ? '<button type="button" class="btn btn--primary" data-modal-close data-action="cus-edit" data-id="' + c.id + '"><span class="btn__icon">' + HS.icon("pencil", 15) + '</span><span class="btn__label">تعديل</span></button>' : "")
    });
  });
  HS.action("cus-pay", function (btn) {
    HS.ui.closePop();
    var c = HS.store.customer(btn.getAttribute("data-id"));
    if (!c) return;
    if (c.balance <= 0.001) { HS.ui.toast({ type: "info", icon: "check-circle", title: "لا رصيد مستحق على هذا العميل" }); return; }
    var m = HS.ui.modal({
      title: "تسجيل سداد من «" + c.name + "»",
      sub: "الرصيد المستحق " + HS.fmt.money(c.balance),
      size: "sm",
      body: '<div class="stack"><div class="form-grid">' +
        HS.ui.field({ name: "amount", label: "المبلغ", type: "number", value: c.balance.toFixed(HS.store.state.settings.decimals), min: 0, max: c.balance, step: "0.001", suffix: HS.store.state.settings.currency, attrs: ' data-autofocus inputmode="decimal"' }) +
        HS.ui.field({ name: "method", label: "طريقة السداد", type: "select", value: "cash", options: HS.data.PAY_METHODS.filter(function (p) { return p.id !== "credit"; }).map(function (p) { return { value: p.id, label: p.name + (p.id === "cash" ? " — يدخل الصندوق" : " — خارج الصندوق") }; }) }) +
        HS.ui.field({ name: "date", label: "تاريخ السداد", type: "date", value: HS.date.toISO(new Date()) }) +
        HS.ui.field({ name: "note", label: "ملاحظة", type: "text", span2: true, placeholder: "اختياري" }) +
        '</div><div class="chips">' + [0.25, 0.5, 1].map(function (f) {
          return '<button type="button" class="chip" data-frac="' + f + '">' + (f === 1 ? "كامل الرصيد (تسوية)" : HS.fmt.pct(f, 0)) + '</button>';
        }).join("") + '</div>' +
        '<div class="alert alert--neutral" id="payBox" role="status"></div></div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button><button type="button" class="btn btn--primary" id="cusDoPay"><span class="btn__icon">' + HS.icon("check", 16) + '</span><span class="btn__label">تسجيل السداد</span></button>'
    });
    var inp = m.body.querySelector('[name="amount"]');
    var methSel = m.body.querySelector('[name="method"]');
    var payBox = m.body.querySelector("#payBox");
    function updPayBox() {
      var amt = Number(inp.value) || 0;
      var meth = methSel.value;
      var rest = HS.round(c.balance - amt, 3);
      if (!(amt > 0)) { payBox.className = "alert alert--neutral"; payBox.innerHTML = HS.icon("info", 16) + "<span>أدخل المبلغ لرؤية الأثر على الدين والصندوق.</span>"; return; }
      if (amt > c.balance + 0.001) { payBox.className = "alert alert--danger"; payBox.innerHTML = HS.icon("alert", 16) + "<span>المبلغ أكبر من الدين المستحق (" + HS.fmt.money(c.balance) + ").</span>"; return; }
      payBox.className = "alert " + (rest <= 0.001 ? "alert--success" : "alert--info");
      payBox.innerHTML = HS.icon(rest <= 0.001 ? "check-circle" : "info", 16) + "<span>" +
        (rest <= 0.001 ? "تسوية كاملة: يصبح الدين <b>صفرًا</b>." : "سداد جزئي: يتبقى على العميل <b>" + HS.fmt.money(rest) + "</b>.") +
        (meth === "cash"
          ? " المبلغ <b>يدخل الصندوق النقدي</b> فورًا."
          : " المبلغ مدفوع بالبطاقة و<b>لا يدخل الصندوق النقدي</b>.") +
        "</span>";
    }
    inp.addEventListener("input", updPayBox);
    methSel.addEventListener("change", updPayBox);
    updPayBox();
    m.body.querySelectorAll("[data-frac]").forEach(function (b) {
      b.addEventListener("click", function () {
        inp.value = HS.round(c.balance * Number(b.getAttribute("data-frac")), 3).toFixed(HS.store.state.settings.decimals);
        updPayBox();
      });
    });
    m.root.querySelector("#cusDoPay").addEventListener("click", function () {
      var amount = Number(inp.value) || 0;
      var method = m.body.querySelector('[name="method"]').value;
      var note = m.body.querySelector('[name="note"]').value.trim();
      var pdate = m.body.querySelector('[name="date"]').value;
      if (amount <= 0) { HS.ui.fieldError(m.body, "amount", "أدخل مبلغًا أكبر من صفر"); return; }
      if (amount > c.balance + 0.001) { HS.ui.fieldError(m.body, "amount", "المبلغ أكبر من الرصيد المستحق (" + HS.fmt.money(c.balance) + ")"); return; }
      var before = c.balance;
      var res = HS.store.customerPayment(c.id, amount, method, note, pdate);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر التسجيل", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({
        type: "success", icon: "cash", title: "سُجّل سداد " + HS.fmt.money(amount), duration: 6500,
        msg: "دين «" + c.name + "»: " + HS.fmt.money(before) + " ← " + HS.fmt.money(c.balance) +
             (c.balance <= 0.001 ? " (سُوّي بالكامل)" : " (سداد جزئي)") +
             (method === "cash" ? " · دخل الصندوق النقدي" : " · بالبطاقة، خارج الصندوق"),
        actions: [{ label: "تراجع", onClick: function () {
          c.balance = before;
          var i = HS.store.state.payments.indexOf(res.payment);
          if (i >= 0) HS.store.state.payments.splice(i, 1);
          HS.store.save();
          HS.router.refresh();
        } }]
      });
      HS.router.refresh();
    });
  });
  HS.action("cus-debt", function (btn) {
    HS.ui.closePop();
    var c = HS.store.customer(btn.getAttribute("data-id"));
    if (!c) return;
    if (!HS.store.can("debts_manage")) {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا تملك صلاحية إدارة الديون" });
      return;
    }
    var m = HS.ui.modal({
      title: "إضافة دين على «" + c.name + "»",
      sub: "الرصيد الحالي " + HS.fmt.money(c.balance || 0),
      size: "sm",
      body: '<div class="stack">' +
        '<p class="alert alert--neutral">' + HS.icon("info", 16) +
          '<span>يستعمل لبضاعة أُخذت بلا فاتورة أو لرصيد سابق على النظام. الدين المضاف <b>لا يدخل الصندوق</b> ولا يُحتسب ربحًا — المال يدخل عند السداد فقط.</span></p>' +
        '<div class="form-grid">' +
          HS.ui.field({ name: "amount", label: "مبلغ الدين", type: "number", min: 0, step: "0.001", required: true, suffix: HS.store.state.settings.currency, inputmode: "decimal", attrs: ' data-autofocus' }) +
          HS.ui.field({ name: "date", label: "تاريخ الدين", type: "date", value: HS.date.toISO(new Date()) }) +
          HS.ui.field({ name: "note", label: "السبب / البيان", type: "text", span2: true, placeholder: "مثال: عطور أُخذت للأعراس، رصيد مرحَّل" }) +
        '</div>' +
        '<div class="alert alert--warning" id="debtBox" role="status">أدخل المبلغ لرؤية الرصيد الجديد.</div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="doAddDebt"><span class="btn__icon">' + HS.icon("plus", 16) + '</span><span class="btn__label">إضافة الدين</span></button>',
      onMount: function (api) {
        var amtEl = api.body.querySelector('[name="amount"]');
        var box = api.body.querySelector("#debtBox");
        function upd() {
          var v = Number(amtEl.value) || 0;
          if (!(v > 0)) { box.className = "alert alert--warning"; box.textContent = "أدخل المبلغ لرؤية الرصيد الجديد."; return; }
          var after = HS.round((c.balance || 0) + v, 3);
          box.className = "alert " + (c.creditLimit && after > c.creditLimit ? "alert--danger" : "alert--info");
          box.innerHTML = HS.icon(c.creditLimit && after > c.creditLimit ? "alert" : "info", 16) +
            "<span>يصبح الدين <b>" + HS.fmt.money(after) + "</b>" +
            (c.creditLimit && after > c.creditLimit ? " — سيتجاوز الحد الائتماني " + HS.fmt.money(c.creditLimit) + "." : ".") + "</span>";
        }
        amtEl.addEventListener("input", upd);
        api.root.querySelector("#doAddDebt").addEventListener("click", function () {
          var v = HS.ui.formValues(api.body);
          var amount = Number(v.amount);
          if (!(amount > 0)) { HS.ui.fieldError(api.body, "amount", "أدخل مبلغًا موجبًا"); HS.ui.focusFirstError(api.body); return; }
          var res = HS.store.addDebt(c.id, amount, v.note, v.date);
          if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّرت الإضافة", msg: res.error }); return; }
          m.close(true);
          HS.ui.toast({
            type: "success", icon: "receipt", title: "أُضيف دين " + HS.fmt.money(amount), duration: 7000,
            msg: "دين «" + c.name + "» صار " + HS.fmt.money(c.balance) + " — لم يدخل الصندوق.",
            actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }]
          });
          HS.router.refresh();
        });
      }
    });
  });

  HS.action("cus-menu", function (btn) {
    var c = HS.store.customer(btn.getAttribute("data-id"));
    if (!c) return;
    HS.ui.pop(btn,
      HS.ui.popItem("عرض البطاقة", "eye", "cus-view", { id: c.id }) +
      HS.ui.popItem("بيع جديد لهذا العميل", "cart", "cus-sell", { id: c.id }) +
      (c.balance > 0.001 && HS.store.can("debts_manage") ? HS.ui.popItem("تسجيل سداد", "cash", "cus-pay", { id: c.id }) : "") +
      (HS.store.can("debts_manage") ? HS.ui.popItem("إضافة دين يدوي", "receipt", "cus-debt", { id: c.id }) : "") +
      HS.ui.popItem("فواتير العميل", "receipt", "cus-invoices", { id: c.id }) +
      HS.ui.popItem("تعديل البيانات", "pencil", "cus-edit", { id: c.id }) +
      '<div class="pop__sep"></div>' +
      HS.ui.popItem(c.active ? "إيقاف العميل" : "تنشيط العميل", c.active ? "eye-off" : "eye", "cus-toggle", { id: c.id }) +
      HS.ui.popItem("حذف العميل", "trash", "cus-delete", { id: c.id }, "pop__item--danger")
    );
  });
  HS.action("cus-sell", function (btn) {
    HS.ui.closePop();
    HS.router.go("/pos", { customer: btn.getAttribute("data-id") });
  });
  HS.action("cus-invoices", function (btn) {
    HS.ui.closePop();
    HS.router.go("/sales", { customer: btn.getAttribute("data-id") });
  });
  HS.action("cus-toggle", function (btn) {
    var id = btn.getAttribute("data-id");
    var c = HS.store.customer(id);
    if (!c) return;
    HS.ui.closePop();
    HS.store.saveCustomer({ active: !c.active }, id);
    HS.ui.toast({
      type: "info", icon: c.active ? "eye" : "eye-off",
      title: (c.active ? "نُشّط " : "أُوقف ") + "«" + c.name + "»",
      msg: c.active ? "سيظهر في قائمة عملاء نقطة البيع." : "",
      actions: [{ label: "تراجع", onClick: function () { HS.store.saveCustomer({ active: !c.active }, id); HS.router.refresh(); } }]
    });
    HS.router.refresh();
  });
  HS.action("cus-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var c = HS.store.customer(id);
    if (!c) return;
    HS.ui.closePop();
    var st = HS.store.state;
    var used = st.sales.filter(function (s) { return s.customerId === id; }).length;
    HS.ui.confirm({
      title: "حذف «" + c.name + "»؟", danger: true, icon: "trash", okLabel: "حذف",
      html: (used ? '<p>لديه <b>' + HS.fmt.int(used) + '</b> فاتورة في السجل. الحذف لا يمس الفواتير القديمة لكن اسمه سيظهر كـ«عميل محذوف» في تفاصيلها.</p>'
                  : '<p>لا فواتير مرتبطة بهذا العميل.</p>') +
        (c.balance > 0.001 ? '<p class="text-danger fw-600" style="margin-block-start:var(--sp-2)">عليه رصيد مستحق ' + HS.fmt.money(c.balance) + ' — ينبغي تحصيله أو تسويته أولًا.</p>' : "")
    }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deleteCustomer(id);
      if (!res.ok) return;
      HS.ui.toast({ type: "success", icon: "trash", title: "حُذف العميل «" + c.name + "»", duration: 6000, actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("cus-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, city: null, dstat: null, page: null, sort: null, dir: null });
  });
  HS.action("cus-export", function () {
    var st = HS.store.state;
    var rows = st.customers.map(function (c) {
      var sales = st.sales.filter(function (s) { return s.customerId === c.id && s.status !== "held" && s.status !== "returned"; });
      return {
        "الاسم": c.name, "الهاتف": c.phone, "المدينة": c.city, "نوع الحساب": c.accountType,
        "الحد الائتماني": c.creditLimit, "الرصيد المستحق": c.balance,
        "عدد الفواتير": sales.length, "إجمالي المشتريات": HS.round(HS.sum(sales, function (s) { return s.total; }), 3),
        "الزيارات": c.visits, "الحالة": c.active ? "نشط" : "موقوف", "ملاحظات": c.note || ""
      };
    });
    var ok = HS.download("العملاء-" + HS.date.toISO(new Date()) + ".csv", HS.toCSV(rows));
    HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "download" : "alert", title: ok ? "صُدّر العملاء" : "تعذّر التصدير", msg: ok ? HS.fmt.int(rows.length) + " عميلًا" : "" });
  });
})();
