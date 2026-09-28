/* ═══════════════════════════════════════════════════════════
   pages/pos.js — نقطة البيع
   شبكة أصناف + سلة + مسح باركود + نافذة دفع + إيصال.
   كل العملية محلية: الخصم من المخزون والحركات تتم في المتصفح.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var listeners = [];
  var heldModal = null;
  function on(el, evt, fn, opts) { if (el) { el.addEventListener(evt, fn, opts); listeners.push([el, evt, fn, opts]); } }
  function offAll() { listeners.forEach(function (l) { l[0].removeEventListener(l[1], l[2], l[3]); }); listeners = []; }
  function closeHeld() { if (heldModal) { try { heldModal.close(null); } catch (e) {} heldModal = null; } }

  HS.pages.pos = function (root, ctx) {
    var st = HS.store.state;
    var cat = ctx.query.cat || "";
    var q = ctx.query.q || "";
    var sort = ctx.query.sort || "popular";

    HS.ui.setHeader({
      title: "نقطة البيع",
      sub: "امسح الباركود أو اختر صنفًا، ثم أتمم الدفع. الفاتورة تُخصم من المخزون فورًا.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "نقطة البيع" }],
      hidePeriod: true
    });

    var cats = st.categories;
    var products = st.products.filter(function (p) { return p.active; });

    var counts = {};
    products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });

    root.innerHTML =
      '<div class="pos page-enter">' +
        '<div class="pos__catalog">' +
          scanBar() +
          '<div class="card" style="box-shadow:none;border-color:var(--border)"><div class="card__body" style="padding:var(--sp-3)">' +
            '<div class="chips" id="posCats">' +
              chip("", "الكل", products.length, !cat) +
              cats.map(function (c) { return chip(c.id, c.emoji + " " + c.name, counts[c.id] || 0, cat === c.id); }).join("") +
            '</div>' +
          '</div></div>' +
          '<div class="spread" style="gap:var(--sp-3);flex-wrap:wrap">' +
            '<span class="fs-sm text-3" id="posCount"></span>' +
            '<div class="row-2">' +
              HS.ui.select({ name: "sort", label: "ترتيب", value: sort, options: [
                { value: "popular", label: "الأكثر مبيعًا" },
                { value: "name", label: "الاسم" },
                { value: "price-asc", label: "السعر: من الأقل" },
                { value: "price-desc", label: "السعر: من الأعلى" },
                { value: "stock", label: "المتوفر أولًا" }
              ] }) +
              '<button type="button" class="btn btn--sm btn--ghost" data-action="pos-grid" title="تبديل طريقة العرض">' +
              '<span class="btn__icon">' + HS.icon("grid", 15) + '</span></button>' +
            '</div>' +
          '</div>' +
          '<div class="pos__grid" id="posGrid"></div>' +
        '</div>' +
        cartPanel() +
      '</div>' +
      '<button type="button" class="cart-fab" id="cartFab" data-action="pos-open-cart"></button>';

    function chip(id, label, count, active) {
      return '<button type="button" class="chip" data-action="pos-cat" data-cat="' + HS.esc(id) + '" aria-pressed="' + !!active + '">' +
        HS.esc(label) + '<span class="fs-2xs text-3">' + HS.fmt.int(count) + '</span></button>';
    }

    function scanBar() {
      var held = HS.store.cart.held().length;
      return '<div class="pos__scan" id="posScan">' +
        '<div class="input-wrap">' +
          '<span class="input-wrap__icon">' + HS.icon("scan", 18) + '</span>' +
          '<input class="input" id="scanInput" type="text" inputmode="latin" dir="ltr" autocomplete="off" ' +
          'placeholder="امسح الباركود أو اكتب اسم الصنف ثم Enter" aria-label="مسح الباركود أو البحث عن صنف" ' +
          'style="text-align:right;font-size:var(--fs-base)">' +
        '</div>' +
        '<button type="button" class="btn btn--secondary" data-action="pos-search-mode" title="بحث بالاسم">' +
        '<span class="btn__icon">' + HS.icon("search", 16) + '</span><span class="btn__label">بحث</span></button>' +
        (held ? '<button type="button" class="btn btn--soft" data-action="pos-held">' +
          '<span class="btn__icon">' + HS.icon("pause", 16) + '</span><span class="btn__label">الفواتير المعلّقة (' + HS.fmt.int(held) + ')</span></button>' : "") +
        '</div>';
    }

    function cartPanel() {
      return '<aside class="cart" id="cart" aria-label="سلة البيع الحالية"></aside>';
    }

    /* ─────────── شبكة الأصناف ─────────── */
    function visibleProducts() {
      var list = products.slice();
      if (cat) list = list.filter(function (p) { return p.category === cat; });
      if (q) list = list.filter(function (p) {
        return HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " + (p.sku || ""), q);
      });
      if (sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name, "ar"); });
      else if (sort === "price-asc") list.sort(function (a, b) { return a.price - b.price; });
      else if (sort === "price-desc") list.sort(function (a, b) { return b.price - a.price; });
      else if (sort === "stock") list.sort(function (a, b) { return b.stock - a.stock; });
      else list.sort(function (a, b) { return (b.popularity || 0) - (a.popularity || 0); });
      return list;
    }

    function renderGrid() {
      var grid = HS.$("#posGrid", root);
      var list = visibleProducts();
      HS.$("#posCount", root).textContent = HS.fmt.int(list.length) + " صنفًا معروضًا" +
        (cat ? " من " + HS.store.cat(cat).name : "") + (q ? " · نتائج «" + q + "»" : "");

      if (!list.length) {
        grid.innerHTML = '<div class="card" style="grid-column:1/-1">' + HS.ui.empty({
          icon: "search", title: "لا أصناف مطابقة",
          text: "جرّب مصطلحًا آخر أو أعد ضبط المرشّح.",
          action: '<button type="button" class="btn btn--secondary btn--sm" data-action="pos-reset">إعادة الضبط</button>'
        }) + '</div>';
        return;
      }
      grid.innerHTML = list.map(function (p) {
        var out = p.stock <= 0;
        var low = !out && p.stock <= p.minStock;
        var inCart = st.carts.active.filter(function (l) { return l.productId === p.id; })[0];
        return '<button type="button" class="pcard" data-action="pos-add" data-id="' + p.id + '"' + (out ? " disabled" : "") +
          ' aria-label="إضافة ' + HS.esc(HS.store.label(p)) + (p.brand ? ' من ' + HS.esc(p.brand) : '') + ' بسعر ' + HS.esc(HS.fmt.money(p.price)) + (out ? ' (غير متوفر)' : '') + '">' +
          (out ? '<span class="pcard__flag">' + HS.ui.badge("نفد", "badge--danger") + '</span>' :
           low ? '<span class="pcard__flag">' + HS.ui.badge(HS.fmt.int(p.stock) + " متبقٍ", "badge--warning") + '</span>' :
           inCart ? '<span class="pcard__flag">' + HS.ui.badge("×" + HS.fmt.int(inCart.qty), "badge--primary") + '</span>' : "") +
          '<span class="pcard__emoji" aria-hidden="true">' + (p.emoji || "🧴") + '</span>' +
          '<span class="pcard__name">' + HS.esc(p.name) + '</span>' +
          '<span class="pcard__brand truncate">' + HS.esc((p.brand || "بدون ماركة") + (p.size ? " · " + p.size : "")) + '</span>' +
          '<span class="pcard__foot"><span class="pcard__price">' + HS.fmt.money(p.price) + '</span>' +
          '<span class="pcard__stock' + (out ? " pcard__stock--out" : low ? " pcard__stock--low" : "") + '">' +
          HS.fmt.int(p.stock) + ' ' + HS.esc(p.unit || "عبوة") + '</span></span>' +
          '</button>';
      }).join("");
    }

    /* ─────────── السلة ─────────── */
    function cartTotals() {
      var items = st.carts.active;
      var subtotal = HS.round(HS.sum(items, function (l) { return l.qty * l.price; }), 3);
      var lineDisc = HS.round(HS.sum(items, function (l) { return l.discount || 0; }), 3);
      var orderDisc = Number(ctx.query.disc) || 0;
      var rate = Number(st.settings.taxRate) || 0;
      var taxBase = Math.max(0, subtotal - lineDisc - orderDisc);
      var tax = HS.round(taxBase * (rate / 100), 3);
      var total = HS.round(taxBase + tax, 3);
      var cost = HS.round(HS.sum(items, function (l) { return l.qty * (l.cost || 0); }), 3);
      return { subtotal: subtotal, lineDisc: lineDisc, orderDisc: orderDisc, tax: tax, total: total, cost: cost, profit: HS.round(taxBase - cost, 3) };
    }

    function renderCart() {
      var panel = HS.$("#cart", root);
      if (!panel) return;
      var items = st.carts.active;
      var t = cartTotals();
      var custId = ctx.query.customer || "";
      var cust = custId ? HS.store.customer(custId) : null;

      panel.innerHTML =
        '<div class="cart__head">' +
          '<h2 class="cart__title">' + HS.icon("cart", 18) + ' السلة الحالية' +
            (items.length ? '<span class="cart__count">' + HS.fmt.int(HS.store.cart.count()) + '</span>' : "") + '</h2>' +
          '<div class="row-2">' +
            (items.length ? HS.ui.iconBtn("pos-hold", "pause", "تعليق الفاتورة") + HS.ui.iconBtn("pos-clear", "trash", "تفريغ السلة", null, "icon-btn--danger") : "") +
            '<button type="button" class="icon-btn icon-btn--sm" id="cartClose" aria-label="إغلاق السلة" style="display:none">' + HS.icon("chevron-down", 16) + '</button>' +
          '</div>' +
        '</div>' +

        '<div class="cart__items" id="cartItems">' +
          (items.length ? items.map(function (l) {
            var p = HS.store.product(l.productId);
            var max = st.settings.allowNegativeStock ? 999 : (p ? p.stock : 99);
            var lineTotal = HS.round(l.qty * l.price - (l.discount || 0), 3);
            return '<div class="cart-item">' +
              '<div style="min-width:0;grid-column:1">' +
                '<div class="cart-item__name">' + HS.esc(l.name) + '</div>' +
                '<div class="cart-item__unit">' + HS.fmt.money(l.price) + ' / ' + HS.esc(l.unit) +
                  (l.discount ? ' · خصم ' + HS.fmt.money(l.discount) : "") +
                  (p && l.qty >= max ? ' · <span class="text-danger">الحد الأقصى</span>' : "") + '</div>' +
              '</div>' +
              '<div class="cart-item__total">' +
                '<span class="cart-item__sum">' + HS.fmt.money(lineTotal) + '</span>' +
                '<div class="row-2" style="gap:2px">' +
                  HS.ui.iconBtn("pos-line", "pencil", "تعديل سعر أو خصم السطر", { id: l.productId }) +
                  HS.ui.iconBtn("pos-del", "trash", "إزالة من السلة", { id: l.productId }, "icon-btn--danger") +
                '</div>' +
              '</div>' +
              '<div class="cart-item__qty">' +
                '<button type="button" class="qty-btn" data-action="pos-dec" data-id="' + l.productId + '" aria-label="إنقاص كمية ' + HS.esc(l.name) + '">' + HS.icon("minus", 14) + '</button>' +
                '<input class="qty-input" type="number" min="0" max="' + max + '" step="1" value="' + HS.fmt.int(l.qty) + '" ' +
                  'data-action-input="pos-qty" data-id="' + l.productId + '" aria-label="كمية ' + HS.esc(l.name) + '" inputmode="numeric">' +
                '<button type="button" class="qty-btn" data-action="pos-inc" data-id="' + l.productId + '"' + (l.qty >= max ? " disabled" : "") + ' aria-label="زيادة كمية ' + HS.esc(l.name) + '">' + HS.icon("plus", 14) + '</button>' +
              '</div>' +
            '</div>';
          }).join("") :
          HS.ui.empty({
            icon: "cart", title: "السلة فارغة",
            text: "امسح باركود صنف أو اختره من الشبكة لبدء فاتورة جديدة.",
            action: '<button type="button" class="btn btn--sm btn--secondary" data-action="pos-focus-scan">' + HS.icon("scan", 15) + ' تركيز على الماسح</button>'
          }).replace('class="empty"', 'class="empty cart__empty"')) +
        '</div>' +

        '<div class="cart__summary">' +
          '<div class="field" style="margin-block-end:var(--sp-3)">' +
            '<label class="field__label" for="cartCustomer">العميل</label>' +
            '<select class="select select--sm" id="cartCustomer" data-action-select="pos-customer">' +
              '<option value="">زبون نقدي</option>' +
              st.customers.filter(function (c) { return c.active; }).map(function (c) {
                return '<option value="' + c.id + '"' + (c.id === custId ? " selected" : "") + '>' + HS.esc(c.name) +
                  (HS.store.creditAccount(c) ? " (حساب دين)" : "") + '</option>';
              }).join("") +
            '</select>' +
            (cust && HS.store.creditAccount(cust) ? '<span class="field__hint">الرصيد الحالي: ' + HS.fmt.money(cust.balance) +
              (cust.creditLimit ? " · الحد: " + HS.fmt.money(cust.creditLimit) : "") + '</span>' : "") +
          '</div>' +
          sumRow("المجموع", HS.fmt.money(t.subtotal)) +
          (t.lineDisc ? sumRow("خصم الأصناف", "− " + HS.fmt.money(t.lineDisc), "text-danger") : "") +
          '<div class="sum-row"><span class="sum-row__k">خصم على الفاتورة' +
            '<button type="button" class="icon-btn icon-btn--sm" data-action="pos-discount" aria-label="تعيين خصم" title="تعيين خصم" style="inline-size:20px;block-size:20px">' + HS.icon("pencil", 13) + '</button></span>' +
            '<span class="sum-row__v">' + (t.orderDisc ? "− " + HS.fmt.money(t.orderDisc) : HS.fmt.money(0)) + '</span></div>' +
          (Number(st.settings.taxRate) ? sumRow("الضريبة (" + HS.fmt.num(st.settings.taxRate) + "٪)", HS.fmt.money(t.tax)) : "") +
          '<div class="sum-row sum-row--total"><span class="sum-row__k">الإجمالي</span><span class="sum-row__v" id="cartTotal">' + HS.fmt.money(t.total) + '</span></div>' +
          '<div class="sum-row" style="padding-block-start:var(--sp-2)"><span class="sum-row__k fs-xs text-3">الربح المتوقع</span>' +
            '<span class="sum-row__v fs-xs ' + (t.profit >= 0 ? "text-success" : "text-danger") + '">' + HS.fmt.money(t.profit) + '</span></div>' +
        '</div>' +

        '<div class="cart__actions">' +
          '<button type="button" class="btn btn--secondary" data-action="pos-hold"' + (items.length ? "" : " disabled") + '>' +
            '<span class="btn__icon">' + HS.icon("pause", 16) + '</span><span class="btn__label">تعليق</span></button>' +
          '<button type="button" class="btn btn--primary" data-action="pos-checkout"' + (items.length ? "" : " disabled") + ' id="checkoutBtn">' +
            '<span class="btn__icon">' + HS.icon("cash", 16) + '</span><span class="btn__label">إتمام الدفع</span></button>' +
        '</div>';

      /* زر الإغلاق يظهر على الجوال فقط */
      var close = HS.$("#cartClose", panel);
      if (close && window.innerWidth <= 960) close.style.display = "grid";
      if (close) close.addEventListener("click", function () { panel.setAttribute("data-open", "false"); });

      var fab = HS.$("#cartFab", root);
      if (fab) {
        fab.innerHTML = HS.icon("cart", 18) + '<span>' + HS.fmt.int(HS.store.cart.count()) + ' صنف</span><span class="fw-700">' + HS.fmt.money(t.total) + '</span>';
        fab.hidden = items.length === 0;
      }
      HS.icons.hydrate(panel);
    }

    function sumRow(k, v, cls) {
      return '<div class="sum-row"><span class="sum-row__k">' + k + '</span><span class="sum-row__v ' + (cls || "") + '">' + v + '</span></div>';
    }

    /* ─────────── المسح ─────────── */
    function doScan(value) {
      var v = String(value || "").trim();
      if (!v) return;
      var box = HS.$("#posScan", root);
      var found = null;

      /* الباركود هو المفتاح: مطابقة تامة أولًا، ثم الرمز الداخلي، ثم الاسم */
      var digits = v.replace(/[^0-9]/g, "");
      found = (digits && HS.store.byBarcode(digits)) || null;
      if (!found) found = products.filter(function (p) { return p.sku === v || String(p.sku || "").replace(/\D/g, "") === digits; })[0];
      if (!found) {
        var hits = products.filter(function (p) {
          return HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || ""), v);
        });
        if (hits.length === 1) found = hits[0];
        else if (hits.length > 1) {
          /* أكثر من نتيجة: نعرضها للاختيار بدل التخمين */
          flash("err");
          HS.ui.toast({ type: "warning", icon: "search", title: HS.fmt.int(hits.length) + " أصناف مطابقة", msg: "اختر الصنف المطلوب من القائمة.", actions: [{ label: "عرض النتائج", onClick: function () { HS.router.setQuery({ q: v }, { replace: true }); } }] });
          return;
        }
      }

      if (!found) {
        flash("err");
        HS.ui.toast({ type: "danger", icon: "x-circle", title: "لا يوجد صنف بهذا الباركود", msg: "«" + v + "» غير مسجّل. أضفه من شاشة العطور والأصناف ثم اطبع ملصقه.", duration: 4600 });
        return;
      }
      if (found.stock <= 0 && !st.settings.allowNegativeStock) {
        flash("err");
        HS.ui.toast({ type: "warning", icon: "alert", title: "«" + HS.store.label(found) + "» نافد من المخزون", msg: "أضف كمية من شاشة المخزون أو فعّل البيع بالسالب من الإعدادات.", duration: 4600 });
        return;
      }

      var res = HS.store.cart.add(found.id, 1);
      if (!res.ok) {
        flash("err");
        HS.ui.toast({ type: "warning", icon: "alert", title: "تعذّرت الإضافة", msg: res.error, duration: 3600 });
      } else {
        flash("ok");
        announceAdded(found);
      }
      var inp = HS.$("#scanInput", root);
      if (inp) { inp.value = ""; inp.focus(); }
    }

    /* إعلان صوتي/قارئ شاشة عند الإضافة */
    var live;
    function announceAdded(p) {
      if (!live) {
        live = HS.el("p.sr-only", { attrs: { "aria-live": "polite", role: "status" } });
        root.appendChild(live);
      }
      var line = st.carts.active.filter(function (l) { return l.productId === p.id; })[0];
      live.textContent = "أُضيف " + HS.store.label(p) + (p.brand ? " من " + p.brand : "") + "، الكمية " + (line ? line.qty : 1);
    }

    function flash(kind) {
      var box = HS.$("#posScan", root);
      if (!box) return;
      box.removeAttribute("data-flash");
      void box.offsetWidth;
      box.setAttribute("data-flash", kind);
      setTimeout(function () { box.removeAttribute("data-flash"); }, 620);
    }

    /* ─────────── نافذة الدفع ─────────── */
    function openPayment() {
      var items = st.carts.active;
      if (!items.length) {
        HS.ui.toast({ type: "warning", icon: "cart", title: "السلة فارغة", msg: "أضف صنفًا واحدًا على الأقل." });
        return;
      }
      var t = cartTotals();
      var custId = ctx.query.customer || "";

      var methods = HS.data.PAY_METHODS.map(function (m, i) {
        return '<button type="button" class="btn btn--secondary pay-method" data-method="' + m.id + '" aria-pressed="' + (m.id === "cash") + '" style="flex:1 1 130px;flex-direction:column;gap:var(--sp-1);min-height:64px">' +
          '<span>' + HS.icon(m.id === "cash" ? "cash" : m.id === "card" ? "card" : m.id === "credit" ? "receipt" : "database", 19) + '</span>' +
          '<span class="btn__label">' + HS.esc(m.name) + '</span></button>';
      }).join("");

      var quick = [t.total, HS.round(t.total * 2, 3), HS.round(Math.ceil(t.total / 10) * 10, 3), HS.round(Math.ceil(t.total / 50) * 50, 3)];
      quick = HS.uniq(quick.map(function (v) { return HS.round(v, 3); })).slice(0, 4);

      var m = HS.ui.modal({
        title: "إتمام الدفع",
        sub: HS.fmt.int(items.length) + " أصناف · " + HS.fmt.int(HS.store.cart.count()) + " وحدة",
        size: "lg",
        body:
          '<div class="stack">' +
            '<div class="card" style="box-shadow:none"><div class="card__body card__body--flush">' +
              HS.ui.table([
                { key: "name", label: "الصنف", render: function (l) { return '<span class="row-2"><span aria-hidden="true">' + (l.emoji || "📦") + '</span><span class="truncate">' + HS.esc(l.name) + '</span></span>'; } },
                { key: "qty", label: "الكمية", align: "num", render: function (l) { return HS.fmt.int(l.qty) + ' <span class="text-3 fs-xs">' + HS.esc(l.unit) + '</span>'; }, width: "92px" },
                { key: "price", label: "السعر", align: "num", render: function (l) { return HS.fmt.money(l.price); }, width: "104px" },
                { key: "sum", label: "الإجمالي", align: "num", render: function (l) { return '<span class="fw-600">' + HS.fmt.money(l.qty * l.price - (l.discount || 0)) + '</span>'; }, width: "118px" }
              ], items, {
                foot: ["", "", '<span class="text-3 fw-500">الإجمالي</span>', '<span class="fw-700" style="font-size:var(--fs-base);color:var(--primary-text)">' + HS.fmt.money(t.total) + '</span>']
              }) +
            '</div></div>' +

            '<div class="field"><span class="field__label">طريقة الدفع</span>' +
              '<div class="row-2" style="flex-wrap:wrap" id="payMethods">' + methods + '</div></div>' +

            '<div class="form-grid">' +
              HS.ui.field({ name: "paid", label: "المبلغ المستلم", type: "number", value: HS.round(t.total, 3).toFixed(st.settings.decimals), min: 0, step: "0.001", suffix: st.settings.currency, span2: false, attrs: ' data-autofocus inputmode="decimal"', hint: "للدفع بالدين يمكن تسجيل مقدمة نقدية وترك الباقي دينًا" }) +
              HS.ui.field({ name: "customerId", label: "العميل", type: "select", value: custId, placeholder: "زبون نقدي", options: st.customers.filter(function (c) { return c.active; }).map(function (c) { return { value: c.id, label: c.name + (HS.store.creditAccount(c) ? " (حساب دين)" : "") }; }) }) +
              HS.ui.field({ name: "note", label: "ملاحظة على الفاتورة", type: "text", placeholder: "اختياري", span2: true }) +
            '</div>' +

            '<div class="chips" id="quickCash">' + quick.map(function (v) {
              return '<button type="button" class="chip" data-action="pay-quick" data-amount="' + v + '">' + HS.fmt.money(v) + '</button>';
            }).join("") + '<button type="button" class="chip" data-action="pay-quick" data-amount="exact">المبلغ بالضبط</button></div>' +

            '<div class="alert alert--neutral" id="changeBox" role="status"></div>' +
          '</div>',
        footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
                '<button type="button" class="btn btn--primary btn--lg" id="confirmPay">' +
                '<span class="btn__icon">' + HS.icon("check", 17) + '</span><span class="btn__label">تأكيد وإصدار الفاتورة</span></button>',
        onMount: function (api) {
          var method = "cash";
          var paidInp = api.body.querySelector('[name="paid"]');
          var changeBox = api.body.querySelector("#changeBox");

          function updateChange() {
            var paid = Number(paidInp.value) || 0;
            var change = paid - t.total;
            if (method === "credit") {
              var down = HS.clamp(paid, 0, t.total);
              var rest = HS.round(t.total - down, 3);
              changeBox.className = "alert alert--warning";
              changeBox.innerHTML = HS.icon("receipt", 17) + '<span>' +
                (down > 0.0009
                  ? 'مقدمة نقدية <b>' + HS.fmt.money(down) + '</b> تدخل الصندوق الآن، والباقي <b>' + HS.fmt.money(rest) + '</b> يُسجَّل دينًا على العميل.'
                  : 'لا مبلغ محصّل الآن: إجمالي <b>' + HS.fmt.money(t.total) + '</b> يُسجَّل دينًا على العميل.') +
                ' الربح يُحتسب على الفاتورة كاملة، أما الصندوق فلا يدخله إلا ما قُبض نقدًا.' +
                '</span>';
            } else if (method === "card") {
              changeBox.className = "alert alert--info";
              changeBox.innerHTML = HS.icon("card", 17) + '<span>العملية مدفوعة بالبطاقة: <b>' + HS.fmt.money(t.total) + '</b> تُحصَّل عبر المصرف و<b>لا تدخل الصندوق النقدي</b>. الربح يُحتسب كالمعتاد.</span>';
            } else if (change < -0.0009) {
              changeBox.className = "alert alert--danger";
              changeBox.innerHTML = HS.icon("alert", 17) + '<span>المبلغ المستلم أقل من المطلوب بنقص <b>' + HS.fmt.money(Math.abs(change)) + '</b></span>';
            } else {
              changeBox.className = "alert alert--success";
              changeBox.innerHTML = HS.icon("check-circle", 17) + '<span>الباقي للعميل: <b style="font-size:var(--fs-lg)">' + HS.fmt.money(change) + '</b></span>';
            }
          }
          on(paidInp, "input", updateChange);

          api.body.querySelectorAll(".pay-method").forEach(function (b) {
            on(b, "click", function () {
              method = b.getAttribute("data-method");
              api.body.querySelectorAll(".pay-method").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
              var lbl = api.body.querySelector('[data-field="paid"] .field__label');
              if (method === "credit") {
                if (lbl) lbl.textContent = "المقدمة النقدية (اختياري)";
                paidInp.value = (0).toFixed(st.settings.decimals);
                var sel = api.body.querySelector('[name="customerId"]');
                if (sel && !sel.value) {
                  var creditCust = st.customers.filter(function (c) { return HS.store.creditAccount(c) && c.active; })[0];
                  if (creditCust) sel.value = creditCust.id;
                }
              } else {
                if (lbl) lbl.textContent = method === "card" ? "المبلغ المدفوع بالبطاقة" : "المبلغ المستلم نقدًا";
                paidInp.value = HS.round(t.total, 3).toFixed(st.settings.decimals);
              }
              updateChange();
            });
          });

          api._getMethod = function () { return method; };
          api._quickHandler = function (amount) {
            paidInp.value = amount === "exact" ? HS.round(t.total, 3).toFixed(st.settings.decimals) : Number(amount).toFixed(st.settings.decimals);
            updateChange();
          };
          HS.posPayModal = api;
          updateChange();
        }
      });

      var confirm = m.root.querySelector("#confirmPay");
      on(confirm, "click", function () {
        var paid = Number(m.body.querySelector('[name="paid"]').value) || 0;
        var method = m._getMethod();
        var customerId = m.body.querySelector('[name="customerId"]').value || null;
        var note = m.body.querySelector('[name="note"]').value.trim();

        if (method !== "credit" && paid + 0.0009 < t.total) {
          HS.ui.fieldError(m.body, "paid", "المبلغ المستلم أقل من الإجمالي المطلوب (" + HS.fmt.money(t.total) + ")");
          m.body.querySelector('[name="paid"]').focus();
          return;
        }
        if (method === "credit" && !customerId) {
          HS.ui.toast({ type: "danger", icon: "alert", title: "اختر عميلًا للبيع بالدين", msg: "البيع بالدين يتطلب ربط الفاتورة بعميل مسجّل." });
          m.body.querySelector('[name="customerId"]').focus();
          return;
        }
        if (method === "credit" && customerId) {
          var c = HS.store.customer(customerId);
          if (c && c.creditLimit && c.balance + t.total > c.creditLimit) {
            HS.ui.toast({ type: "warning", icon: "shield", title: "سيتجاوز الحد الائتماني", msg: "رصيد " + c.name + " سيصبح " + HS.fmt.money(c.balance + t.total) + " من حد " + HS.fmt.money(c.creditLimit) + ".", duration: 6000 });
          }
        }

        confirm.setAttribute("data-loading", "true");
        HS.sleep(380).then(function () {
          /* الدين: ما دُفع نقدًا مقدمة تدخل الصندوق، والباقي دين على العميل */
          var creditPaid = method === "credit" ? HS.clamp(paid, 0, t.total) : paid;
          var status = method === "credit"
            ? (creditPaid <= 0.0009 ? "unpaid" : (creditPaid + 0.0009 < t.total ? "partial" : "paid"))
            : (paid + 0.0009 < t.total ? "partial" : "paid");
          var res = HS.store.checkout({
            method: method,
            paid: creditPaid,
            customerId: customerId,
            status: status,
            note: note,
            discount: t.orderDisc
          });
          confirm.removeAttribute("data-loading");
          if (!res.ok) {
            HS.ui.toast({ type: "danger", title: "تعذّر إتمام البيع", msg: res.error });
            return;
          }
          m.close(true);
          ctx.setQuery({ disc: null }, { replace: true });
          afterSale(res.sale, paid - t.total);
        });
      });
    }

    function afterSale(sale, change) {
      /* رسالة تُوضّح ما دخل الصندوق وما لم يدخله — لا مجرد الإجمالي */
      var due = HS.round(sale.total - (sale.paid || 0), 3);
      var msg = "الإجمالي " + HS.fmt.money(sale.total);
      if (sale.method === "card") msg += " · مدفوعة بالبطاقة، خارج الصندوق النقدي";
      else if (sale.method === "credit") {
        if (sale.paid > 0.0009 && due > 0.0009) msg += " · مقدمة " + HS.fmt.money(sale.paid) + " دخلت الصندوق، و" + HS.fmt.money(due) + " دين على " + sale.customerName;
        else if (due > 0.0009) msg += " · دين على " + sale.customerName + " — لم يدخل الصندوق بعد";
      } else if (change > 0.001) msg += " · الباقي للعميل " + HS.fmt.money(change);
      else msg += " · دخل الصندوق نقدًا";
      HS.ui.toast({
        type: "success", icon: "check-circle",
        title: "تمت عملية البيع " + sale.number,
        msg: msg,
        duration: 6000,
        actions: [
          { label: "عرض الفاتورة", onClick: function () { location.hash = "#/sales/" + sale.id; }, cls: "btn--soft" },
          { label: "طباعة", onClick: function () { HS.pages.invoice.print(sale.id); } }
        ]
      });
      renderGrid();
      renderCart();
      var inp = HS.$("#scanInput", root);
      if (inp) inp.focus();
      /* فتح الإيصال مباشرة بعد البيع: السلوك المعتاد في نقاط البيع */
      HS.pages.invoice.receiptModal(sale.id);
    }

    /* ─────────── الربط ─────────── */
    renderGrid();
    renderCart();

    var scan = HS.$("#scanInput", root);
    on(scan, "keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        doScan(scan.value);
      } else if (ev.key === "Escape") { scan.value = ""; }
      else if (ev.key === "ArrowDown" && scan.value.trim().length >= 2) {
        /* نزول إلى شبكة الأصناف مع إبقاء ما كُتب كبحث */
        ev.preventDefault();
        HS.router.setQuery({ q: scan.value.trim() }, { replace: true });
      }
    });
    on(scan, "input", HS.debounce(function () {
      /* الكتابة في حقل الماسح تعمل كبحث فوري بعد توقف قصير */
      var v = scan.value.trim();
      if (v.length >= 2 && ctx.query.q !== v) HS.router.setQuery({ q: v }, { replace: true });
      if (!v && ctx.query.q) HS.router.setQuery({ q: null }, { replace: true });
    }, 520));

    var grid = HS.$("#posGrid", root);
    var cart = HS.$("#cart", root);

    on(root, "change", function (ev) {
      var sel = ev.target.closest("[data-action-select]");
      if (!sel) return;
      var act = sel.getAttribute("data-action-select");
      if (act === "pos-customer") {
        ctx.setQuery({ customer: sel.value || null }, { replace: true });
      } else if (act === "pos-sort") {
        ctx.setQuery({ sort: sel.value }, { replace: true });
      }
    });

    /* إدخال الكمية */
    on(root, "change", function (ev) {
      var inp = ev.target.closest('[data-action-input="pos-qty"]');
      if (!inp) return;
      HS.store.cart.setQty(inp.getAttribute("data-id"), inp.value);
      renderCart();
    });
    on(root, "keydown", function (ev) {
      var inp = ev.target.closest('[data-action-input="pos-qty"]');
      if (!inp) return;
      if (ev.key === "Enter") { ev.preventDefault(); HS.store.cart.setQty(inp.getAttribute("data-id"), inp.value); renderCart(); }
    });

    var offCart = HS.bus.on("cart:change", function () { renderCart(); renderGrid(); });
    var offCheckout = HS.bus.on("pos:checkout", openPayment);

    setTimeout(function () { if (scan && window.innerWidth > 960) scan.focus(); }, 80);

    return { unmount: function () {
      offAll();
      offCart(); offCheckout();
      HS.posPayModal = null;
      heldModal = null;
    } };
  };

  /* ─────────── إجراءات نقطة البيع ─────────── */
  HS.action("pos-add", function (btn) {
    var id = btn.getAttribute("data-id");
    var res = HS.store.cart.add(id, 1);
    if (!res.ok) HS.ui.toast({ type: "warning", icon: "alert", title: "تعذّرت الإضافة", msg: res.error, duration: 3400 });
  });
  HS.action("pos-inc", function (btn) {
    var id = btn.getAttribute("data-id");
    var line = HS.store.state.carts.active.filter(function (l) { return l.productId === id; })[0];
    if (!line) return;
    var res = HS.store.cart.add(id, 1);
    if (!res.ok) HS.ui.toast({ type: "warning", icon: "alert", title: "الحد الأقصى", msg: res.error, duration: 3200 });
  });
  HS.action("pos-dec", function (btn) {
    var id = btn.getAttribute("data-id");
    var line = HS.store.state.carts.active.filter(function (l) { return l.productId === id; })[0];
    if (!line) return;
    HS.store.cart.setQty(id, line.qty - 1);
  });
  HS.action("pos-del", function (btn) {
    var id = btn.getAttribute("data-id");
    var line = HS.store.state.carts.active.filter(function (l) { return l.productId === id; })[0];
    if (!line) return;
    HS.store.cart.remove(id);
    HS.ui.toast({
      type: "info", icon: "undo", title: "أُزيل «" + line.name + "» من السلة",
      duration: 4200,
      actions: [{ label: "تراجع", onClick: function () { HS.store.cart.add(id, line.qty, { price: line.price, force: true }); } }]
    });
  });
  HS.action("pos-clear", function () {
    var items = HS.store.state.carts.active.slice();
    if (!items.length) return;
    HS.ui.confirm({
      title: "تفريغ السلة", text: "سيُحذف " + HS.fmt.int(items.length) + " أصناف من السلة الحالية. لا يؤثر ذلك على المخزون.",
      okLabel: "تفريغ", danger: true, icon: "trash"
    }).then(function (ok) {
      if (!ok) return;
      HS.store.cart.clear();
      HS.ui.toast({ type: "info", icon: "undo", title: "أُفرغت السلة", actions: [{ label: "تراجع", onClick: function () { items.forEach(function (l) { HS.store.cart.add(l.productId, l.qty, { price: l.price, force: true }); }); } }] });
    });
  });
  HS.action("pos-hold", function () {
    var note = "";
    var id = HS.store.cart.hold(note);
    if (!id) { HS.ui.toast({ type: "warning", title: "السلة فارغة" }); return; }
    HS.ui.toast({ type: "info", icon: "pause", title: "عُلّقت الفاتورة", msg: "يمكنك استرجاعها في أي وقت من زر «الفواتير المعلّقة».", actions: [{ label: "تراجع", onClick: function () { HS.store.cart.resume(id); } }] });
    HS.router.refresh();
  });
  HS.action("pos-held", function (btn) {
    var held = HS.store.cart.held();
    if (!held.length) { HS.ui.toast({ type: "info", title: "لا فواتير معلّقة" }); return; }
    var m = HS.ui.modal({
      title: "الفواتير المعلّقة", sub: HS.fmt.int(held.length) + " سلة محفوظة مؤقتًا", size: "sm",
      body: '<div class="list">' + held.map(function (h) {
        var total = HS.round(HS.sum(h.items, function (l) { return l.qty * l.price; }), 3);
        return '<div class="list__item">' +
          '<span class="list__body"><span class="list__title">' + HS.fmt.int(h.items.length) + ' أصناف · ' + HS.fmt.money(total) + '</span>' +
          '<span class="list__meta">عُلّقت ' + HS.fmt.rel(h.at) + (h.note ? " · " + HS.esc(h.note) : "") + '</span></span>' +
          '<span class="row-2">' +
            HS.ui.btn({ label: "استرجاع", cls: "btn--soft btn--sm", action: "pos-resume", data: { id: h.id } }) +
            HS.ui.iconBtn("pos-drop", "trash", "حذف", { id: h.id }, "icon-btn--danger") +
          '</span></div>';
      }).join("") + '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إغلاق</button>'
    });
    heldModal = m;
  });
  HS.action("pos-resume", function (btn) {
    var id = btn.getAttribute("data-id");
    if (HS.store.state.carts.active.length) {
      HS.ui.confirm({
        title: "السلة الحالية غير فارغة", text: "استرجاع الفاتورة المعلّقة سيستبدل محتوى السلة الحالية. هل تريد المتابعة؟",
        okLabel: "استبدال", tone: "warn", icon: "swap"
      }).then(function (ok) {
        if (!ok) return;
        HS.store.cart.resume(id);
        closeHeld();
        HS.router.refresh();
      });
      return;
    }
    HS.store.cart.resume(id);
    closeHeld();
    HS.router.refresh();
  });
  HS.action("pos-drop", function (btn) {
    HS.store.cart.dropHeld(btn.getAttribute("data-id"));
    closeHeld();
    if (HS.store.cart.held().length) HS.actions["pos-held"]({ getAttribute: function () { return null; } });
    else HS.router.refresh();
  });
  HS.action("pos-checkout", function () {
    /* الصفحة تستمع لهذا الحدث وتفتح نافذة الدفع */
    HS.bus.emit("pos:checkout");
  });
  HS.action("pos-discount", function () {
    var ctx = HS.router.current();
    if (!ctx) return;
    var cur = Number(ctx.query.disc) || 0;
    HS.ui.prompt({
      title: "خصم على الفاتورة", sub: "يُطبَّق على الإجمالي قبل الضريبة",
      label: "قيمة الخصم (" + HS.store.state.settings.currency + ")", type: "number", value: cur || "",
      okLabel: "تطبيق", hint: "اتركه فارغًا أو صفرًا لإلغاء الخصم"
    }).then(function (v) {
      if (v == null) return;
      var n = Math.max(0, Number(v) || 0);
      ctx.setQuery({ disc: n ? n : null }, { replace: true });
      HS.ui.toast({ type: n ? "success" : "info", icon: "percent", title: n ? "طُبّق خصم " + HS.fmt.money(n) : "أُلغي الخصم" });
    });
  });
  HS.action("pos-line", function (btn) {
    var id = btn.getAttribute("data-id");
    var line = HS.store.state.carts.active.filter(function (l) { return l.productId === id; })[0];
    if (!line) return;
    var m = HS.ui.modal({
      title: "تعديل السطر", sub: line.name, size: "sm",
      body: '<div class="form-grid">' +
        HS.ui.field({ name: "price", label: "سعر الوحدة", type: "number", value: line.price, min: 0, step: "0.001", suffix: HS.store.state.settings.currency, attrs: ' data-autofocus inputmode="decimal"' }) +
        HS.ui.field({ name: "qty", label: "الكمية", type: "number", value: line.qty, min: 0, step: 1, suffix: line.unit, inputmode: "numeric" }) +
        HS.ui.field({ name: "discount", label: "خصم على السطر", type: "number", value: line.discount || 0, min: 0, step: "0.001", suffix: HS.store.state.settings.currency, span2: true, inputmode: "decimal" }) +
        '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button><button type="button" class="btn btn--primary" id="saveLine">حفظ</button>'
    });
    m.root.querySelector("#saveLine").addEventListener("click", function () {
      var price = Number(m.body.querySelector('[name="price"]').value) || 0;
      var qty = Math.round(Number(m.body.querySelector('[name="qty"]').value) || 0);
      var disc = Number(m.body.querySelector('[name="discount"]').value) || 0;
      HS.store.cart.setPrice(id, price);
      HS.store.cart.setLineDiscount(id, Math.min(disc, price * qty));
      if (qty !== line.qty) HS.store.cart.setQty(id, qty);
      m.close(true);
      HS.ui.toast({ type: "success", icon: "check", title: "حُدّث السطر" });
    });
  });
  HS.action("pos-cat", function (btn) {
    HS.router.setQuery({ cat: btn.getAttribute("data-cat") || null, page: null });
  });
  HS.action("pos-reset", function () { HS.router.setQuery({ q: null, cat: null, sort: null }); });
  HS.action("pos-search-mode", function () {
    var inp = HS.$("#scanInput");
    if (inp) { inp.focus(); inp.select(); }
  });
  HS.action("pos-focus-scan", function () { var i = HS.$("#scanInput"); if (i) i.focus(); });
  HS.action("pos-open-cart", function () {
    var c = HS.$("#cart");
    if (c) { c.setAttribute("data-open", "true"); var close = HS.$("#cartClose"); if (close) close.focus(); }
  });
  HS.action("pos-grid", function () {
    var g = HS.$("#posGrid");
    if (!g) return;
    var compact = g.style.gridTemplateColumns === "repeat(auto-fill, minmax(120px, 1fr))";
    g.style.gridTemplateColumns = compact ? "" : "repeat(auto-fill, minmax(120px, 1fr))";
    HS.ui.toast({ type: "info", icon: "grid", title: compact ? "عرض مريح" : "عرض مكثّف", duration: 2200 });
  });
  HS.action("pay-quick", function (btn) {
    if (HS.posPayModal && HS.posPayModal._quickHandler) HS.posPayModal._quickHandler(btn.getAttribute("data-amount"));
  });
})();
