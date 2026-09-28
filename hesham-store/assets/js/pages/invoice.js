/* ═══════════════════════════════════════════════════════════
   pages/invoice.js — عرض الفاتورة، الإيصال القابل للطباعة،
   السداد الجزئي، والإرجاع.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  /** يبني HTML الإيصال */
  function receiptHTML(sale, opt) {
    opt = opt || {};
    var st = HS.store.state;
    var s = st.settings;
    var cashier = HS.store.user(sale.cashierId);
    var cust = sale.customerId ? HS.store.customer(sale.customerId) : null;
    var rate = Number(s.taxRate) || 0;

    return '<div class="receipt" id="receiptDoc">' +
      '<div class="receipt__head">' +
        '<div class="receipt__store">' +
          '<span class="brand__mark" style="inline-size:44px;block-size:44px;font-size:var(--fs-xl)" aria-hidden="true">' + HS.esc((s.storeName || "ه")[0].replace(/[^\u0600-\u06FF\w]/g, "") || "ه") + '</span>' +
          '<div><div class="receipt__name">' + HS.esc(s.storeName || HS.STORE_NAME) + '</div>' +
          '<div class="receipt__meta">' + HS.esc(s.branch || "") + '<br>' + HS.esc(s.address || "") + '<br>' +
          'هاتف: <span class="ltr">' + HS.esc(HS.ui.phone(s.phone)) + '</span>' +
          (s.taxNumber ? '<br>الرقم الضريبي: <span class="ltr">' + HS.esc(s.taxNumber) + '</span>' : "") + '</div></div>' +
        '</div>' +
        '<div class="receipt__no">' +
          '<div class="receipt__noLbl">رقم الفاتورة</div>' +
          '<div class="receipt__noVal">' + HS.esc(sale.number) + '</div>' +
          '<div class="receipt__meta" style="margin-block-start:var(--sp-2);text-align:end">' + HS.fmt.date(sale.date, "long") + '<br>' + HS.fmt.time(sale.date) + '</div>' +
        '</div>' +
      '</div>' +

      '<div class="receipt__parties">' +
        '<div><div class="receipt__partyLbl">العميل</div>' +
          '<div class="fw-600">' + HS.esc(sale.customerName) + '</div>' +
          (cust ? '<div class="receipt__meta"><span class="ltr">' + HS.esc(HS.ui.phone(cust.phone)) + '</span><br>' + HS.esc(cust.city) + '</div>' : '<div class="receipt__meta">عملية نقدية</div>') +
        '</div>' +
        '<div><div class="receipt__partyLbl">الكاشير</div>' +
          '<div class="fw-600">' + HS.esc(cashier ? cashier.name : "غير محدد") + '</div>' +
          '<div class="receipt__meta">' + HS.esc(cashier ? cashier.role : "") + '</div>' +
        '</div>' +
        '<div><div class="receipt__partyLbl">طريقة الدفع</div>' +
          '<div class="fw-600">' + HS.esc(HS.store.payMethod(sale.method).name) + '</div>' +
          '<div class="receipt__meta">الحالة: ' + HS.esc(HS.ui.saleStatusLabel(sale.status)) + '</div>' +
        '</div>' +
      '</div>' +

      '<table class="table" style="margin-block-start:var(--sp-4)">' +
        '<thead><tr><th style="width:32px">#</th><th>الصنف</th><th class="num">الكمية</th><th class="num">السعر</th>' +
        (sale.discount ? '<th class="num">الخصم</th>' : "") + '<th class="num">الإجمالي</th></tr></thead>' +
        '<tbody>' + sale.items.map(function (it, i) {
          var lineTotal = HS.round(it.qty * it.price - (it.discount || 0), 3);
          return '<tr><td class="text-3">' + HS.fmt.int(i + 1) + '</td>' +
            '<td><div class="fw-500">' + HS.esc(it.name) + '</div>' +
            '<div class="fs-xs text-3">' +
              [it.brand, it.unit].filter(Boolean).map(HS.esc).join(" · ") +
              (it.barcode ? ' · <span class="ltr" style="font-variant-numeric:tabular-nums">' + HS.esc(it.barcode) + '</span>' : "") +
            '</div></td>' +
            '<td class="num">' + HS.fmt.int(it.qty) + '</td>' +
            '<td class="num">' + HS.fmt.money(it.price) + '</td>' +
            (sale.discount ? '<td class="num">' + (it.discount ? "− " + HS.fmt.money(it.discount) : "—") + '</td>' : "") +
            '<td class="num fw-600">' + HS.fmt.money(lineTotal) + '</td></tr>';
        }).join("") + '</tbody>' +
      '</table>' +

      '<div class="receipt__totals">' +
        row("المجموع", HS.fmt.money(sale.subtotal)) +
        (sale.discount ? row("الخصم", "− " + HS.fmt.money(sale.discount), "var(--danger-text)") : "") +
        (rate ? row("الضريبة (" + HS.fmt.num(rate) + "٪)", HS.fmt.money(sale.tax)) : "") +
        '<div class="sum-row sum-row--total" style="margin-block-start:var(--sp-3)"><span class="sum-row__k">الإجمالي المستحق</span>' +
        '<span class="sum-row__v" style="color:var(--text)">' + HS.fmt.money(sale.total) + '</span></div>' +
        row("المدفوع", HS.fmt.money(sale.paid)) +
        (sale.change ? row("الباقي", HS.fmt.money(sale.change)) : "") +
        (sale.total - sale.paid > 0.001 ? row("المتبقي", HS.fmt.money(sale.total - sale.paid), "var(--danger-text)") : "") +
      '</div>' +

      (sale.note ? '<div class="alert alert--neutral" style="margin-block-start:var(--sp-5)">' + HS.icon("note", 16) + '<span>' + HS.esc(sale.note) + '</span></div>' : "") +
      (sale.status === "returned" ? '<div class="alert alert--danger" style="margin-block-start:var(--sp-5)">' + HS.icon("undo", 16) +
        '<span><b>فاتورة مرتجعة</b>' + (sale.returnReason ? ' · السبب: ' + HS.esc(sale.returnReason) : "") + '</span></div>' : "") +

      (s.showBarcodeOnReceipt ? '<div class="receipt__barcode">' + HS.barcode.svg(sale.number, { height: 40, moduleWidth: 1.4, fontSize: 10 }) + '</div>' : "") +

      '<div class="receipt__foot">' +
        HS.esc(s.receiptFooter || "") + '<br>' +
        '<span class="ltr">' + HS.esc(sale.number) + '</span> · أُصدرت ' + HS.fmt.dateTime(sale.date) +
      '</div>' +
    '</div>';

    function row(k, v, color) {
      return '<div class="sum-row"><span class="sum-row__k">' + k + '</span>' +
        '<span class="sum-row__v"' + (color ? ' style="color:' + color + '"' : "") + '>' + v + '</span></div>';
    }
  }
  HS.receiptHTML = receiptHTML;

  /** طباعة فاتورة عبر طبقة طباعة مخصّصة */
  HS.pages.invoice = {};
  HS.pages.invoice.print = function (saleId) {
    var sale = HS.store.sale(saleId);
    if (!sale) { HS.ui.toast({ type: "danger", title: "الفاتورة غير موجودة" }); return; }
    var holder = HS.$("#printRoot");
    holder.innerHTML = receiptHTML(sale);
    document.body.setAttribute("data-printing", "receipt");
    var done = function () {
      document.body.removeAttribute("data-printing");
      holder.innerHTML = "";
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    setTimeout(function () {
      window.print();
      /* احتياط إن لم يُطلق afterprint */
      setTimeout(done, 1200);
    }, 60);
  };

  /** نافذة الإيصال بعد إتمام البيع */
  HS.pages.invoice.receiptModal = function (saleId) {
    var sale = HS.store.sale(saleId);
    if (!sale) return;
    var m = HS.ui.modal({
      title: "تمت عملية البيع",
      sub: sale.number + " · " + HS.fmt.money(sale.total),
      size: "lg",
      body: receiptHTML(sale),
      footer: '<button type="button" class="btn btn--ghost" data-action="goto" data-href="#/sales/' + HS.esc(sale.id) + '">' +
                '<span class="btn__icon">' + HS.icon("external", 16) + '</span><span class="btn__label">فتح صفحة الفاتورة</span></button>' +
              '<span class="grow"></span>' +
              '<button type="button" class="btn btn--secondary" data-modal-close>إغلاق</button>' +
              '<button type="button" class="btn btn--primary" id="printNow">' +
                '<span class="btn__icon">' + HS.icon("print", 16) + '</span><span class="btn__label">طباعة الإيصال</span></button>',
      onMount: function (api) {
        api.root.querySelector("#printNow").addEventListener("click", function () { HS.pages.invoice.print(saleId); });
      }
    });
    return m;
  };

  /** نافذة السداد على فاتورة آجلة */
  HS.pages.invoice.payModal = function (saleId) {
    var sale = HS.store.sale(saleId);
    if (!sale) return;
    var due = HS.round(sale.total - sale.paid, 3);
    if (due <= 0) { HS.ui.toast({ type: "info", title: "هذه الفاتورة مسدّدة بالكامل" }); return; }
    var m = HS.ui.modal({
      title: "تسجيل سداد", sub: sale.number + " · المستحق " + HS.fmt.money(due), size: "sm",
      body: '<div class="stack">' +
        '<div class="form-grid">' +
          HS.ui.field({ name: "amount", label: "المبلغ المسدَّد", type: "number", value: due.toFixed(HS.store.state.settings.decimals), min: 0, max: due, step: "0.001", suffix: HS.store.state.settings.currency, attrs: ' data-autofocus inputmode="decimal"' }) +
          HS.ui.field({ name: "method", label: "طريقة السداد", type: "select", value: "cash", options: HS.data.PAY_METHODS.map(function (p) { return { value: p.id, label: p.name }; }) }) +
          HS.ui.field({ name: "note", label: "ملاحظة", type: "text", placeholder: "اختياري", span2: true }) +
        '</div>' +
        '<div class="chips">' +
          [0.25, 0.5, 0.75, 1].map(function (f) {
            return '<button type="button" class="chip" data-frac="' + f + '">' + (f === 1 ? "كامل المبلغ" : HS.fmt.pct(f, 0)) + '</button>';
          }).join("") +
        '</div></div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button><button type="button" class="btn btn--primary" id="doPay">تسجيل السداد</button>'
    });
    var inp = m.body.querySelector('[name="amount"]');
    m.body.querySelectorAll("[data-frac]").forEach(function (b) {
      b.addEventListener("click", function () {
        inp.value = HS.round(due * Number(b.getAttribute("data-frac")), 3).toFixed(HS.store.state.settings.decimals);
      });
    });
    m.root.querySelector("#doPay").addEventListener("click", function () {
      var amount = Number(inp.value) || 0;
      var method = m.body.querySelector('[name="method"]').value;
      var res = HS.store.paySale(saleId, amount, method);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر التسجيل", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({ type: "success", icon: "check-circle", title: "سُجّل سداد " + HS.fmt.money(res.paid), msg: "المتبقي على الفاتورة: " + HS.fmt.money(res.sale.total - res.sale.paid) });
      HS.router.refresh();
    });
  };

  /* ─────────── صفحة الفاتورة ─────────── */
  HS.pages.invoice = Object.assign(HS.pages.invoice, {
    render: function (root, ctx) {
      var sale = HS.store.sale(ctx.params.id);
      if (!sale) {
        HS.ui.setHeader({ title: "الفاتورة", crumbs: [{ label: "المبيعات", href: "#/sales" }, { label: "غير موجودة" }] });
        root.innerHTML = '<div class="card page-enter">' + HS.ui.empty({
          icon: "x-circle", title: "الفاتورة غير موجودة",
          text: "ربما حُذفت أو أن الرابط غير صحيح.",
          action: '<a class="btn btn--primary" href="#/sales"><span class="btn__label">العودة إلى سجل المبيعات</span></a>'
        }) + '</div>';
        return;
      }

      HS.ui.setHeader({
        title: "الفاتورة " + sale.number,
        sub: HS.fmt.dateTime(sale.date) + " · " + sale.customerName,
        crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المبيعات", href: "#/sales" }, { label: sale.number }]
      });

      var profit = HS.store.saleProfit(sale);
      var units = HS.sum(sale.items, function (i) { return i.qty; });
      var canRefund = HS.store.can("sales_refund");
      var canPay = sale.total - sale.paid > 0.001;

      root.innerHTML = '<div class="stack page-enter">' +
        '<div class="row-wrap no-print">' +
          '<a class="btn btn--secondary btn--sm" href="#/sales"><span class="btn__icon">' + HS.icon("arrow-right", 15) + '</span><span class="btn__label">كل الفواتير</span></a>' +
          '<span class="grow"></span>' +
          '<button type="button" class="btn btn--secondary btn--sm" data-action="inv-copy" data-id="' + sale.id + '"><span class="btn__icon">' + HS.icon("copy", 15) + '</span><span class="btn__label">نسخ الرقم</span></button>' +
          (canPay ? '<button type="button" class="btn btn--soft btn--sm" data-action="inv-pay" data-id="' + sale.id + '"><span class="btn__icon">' + HS.icon("cash", 15) + '</span><span class="btn__label">تسجيل سداد</span></button>' : "") +
          (canRefund && sale.status !== "returned" ? '<button type="button" class="btn btn--danger-soft btn--sm" data-action="inv-return" data-id="' + sale.id + '"><span class="btn__icon">' + HS.icon("undo", 15) + '</span><span class="btn__label">إرجاع</span></button>' : "") +
          '<button type="button" class="btn btn--primary btn--sm" data-action="inv-print" data-id="' + sale.id + '"><span class="btn__icon">' + HS.icon("print", 15) + '</span><span class="btn__label">طباعة</span></button>' +
        '</div>' +

        '<div class="stat-strip no-print">' +
          HS.ui.statMini("الإجمالي", HS.fmt.money(sale.total), HS.ui.saleStatusLabel(sale.status)) +
          HS.ui.statMini("عدد الأصناف", HS.fmt.int(sale.items.length) + " أسطر", HS.fmt.int(units) + " وحدة") +
          HS.ui.statMini("الربح", HS.fmt.money(profit), "هامش " + HS.fmt.pct(sale.total ? profit / sale.total : 0, 1)) +
          HS.ui.statMini("المدفوع", HS.fmt.money(sale.paid), canPay ? "المتبقي " + HS.fmt.money(sale.total - sale.paid) : "مسدّدة") +
          HS.ui.statMini("طريقة الدفع", HS.esc(HS.store.payMethod(sale.method).name), sale.customerId ? "مرتبطة بعميل" : "زبون نقدي") +
        '</div>' +

        receiptHTML(sale) +
      '</div>';

      HS.icons.hydrate(root);
    }
  });

  HS.action("inv-print", function (btn) { HS.pages.invoice.print(btn.getAttribute("data-id")); });
  HS.action("inv-pay", function (btn) { HS.pages.invoice.payModal(btn.getAttribute("data-id")); });
  HS.action("inv-copy", function (btn) {
    var sale = HS.store.sale(btn.getAttribute("data-id"));
    if (!sale) return;
    HS.ui.copy(sale.number).then(function (ok) {
      HS.ui.toast({ type: ok ? "success" : "danger", icon: ok ? "copy" : "alert", title: ok ? "نُسخ رقم الفاتورة" : "تعذّر النسخ", msg: ok ? sale.number : "", duration: 2600 });
    });
  });
  HS.action("inv-return", function (btn) {
    var id = btn.getAttribute("data-id");
    var sale = HS.store.sale(id);
    if (!sale) return;
    HS.ui.prompt({
      title: "إرجاع الفاتورة " + sale.number,
      sub: "ستُعاد الأصناف إلى المخزون ويُصفَّر المبلغ المحصّل.",
      label: "سبب الإرجاع", placeholder: "مثال: تلف في التغليف، طلب العميل",
      okLabel: "تأكيد الإرجاع", hint: "لا يمكن التراجع عن هذه العملية بعد تنفيذها."
    }).then(function (reason) {
      if (reason == null) return;
      var res = HS.store.returnSale(id, reason);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الإرجاع", msg: res.error }); return; }
      HS.ui.toast({ type: "success", icon: "undo", title: "أُرجعت الفاتورة", msg: "عادت " + HS.fmt.int(HS.sum(sale.items, function (i) { return i.qty; })) + " وحدة إلى المخزون." });
      HS.router.refresh();
    });
  });
})();
