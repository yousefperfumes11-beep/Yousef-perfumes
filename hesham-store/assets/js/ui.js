/* ═══════════════════════════════════════════════════════════
   ui.js — مكوّنات الواجهة القابلة لإعادة الاستخدام:
   نوافذ، إشعارات، تأكيد، جداول، ترقيم، نماذج، حالات فارغة،
   قوائم منبثقة، وبطاقات المؤشرات.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.ui = {};

  /* ═══════════════ الشريط العلوي ═══════════════ */
  HS.ui.setHeader = function (o) {
    o = o || {};
    var t = HS.$("#pageTitle"), s = HS.$("#pageSub"), c = HS.$("#crumbs");
    if (t) t.textContent = o.title || "";
    if (s) { s.textContent = o.sub || ""; s.hidden = !o.sub; }
    if (c) {
      c.innerHTML = (o.crumbs || []).map(function (cr, i, arr) {
        var last = i === arr.length - 1;
        return last
          ? '<span aria-current="page">' + HS.esc(cr.label) + '</span>'
          : '<a href="' + HS.esc(cr.href || "#/") + '">' + HS.esc(cr.label) + '</a><span class="crumbs__sep" aria-hidden="true">/</span>';
      }).join("");
    }
    if (o.title) document.title = o.title + " · " + HS.STORE_NAME;
    else document.title = HS.STORE_NAME;
    var seg = HS.$("#periodSeg");
    if (seg) seg.hidden = o.hidePeriod === true;
  };

  /* ═══════════════ شارات الحالة ═══════════════ */
  var SALE_STATUS = {
    paid:     { label: "مدفوعة",  cls: "badge--success", icon: "check-circle" },
    partial:  { label: "مدفوعة جزئيًا", cls: "badge--warning", icon: "clock" },
    unpaid:   { label: "غير محصّلة", cls: "badge--danger",  icon: "alert" },
    returned: { label: "مرتجعة",  cls: "badge--neutral", icon: "undo" },
    held:     { label: "معلّقة",  cls: "badge--info",    icon: "pause" }
  };
  var PO_STATUS = {
    received:  { label: "مستلمة",     cls: "badge--success", icon: "box-check" },
    shipping:  { label: "قيد الشحن",  cls: "badge--info",    icon: "truck" },
    draft:     { label: "مسودة",      cls: "badge--neutral", icon: "file" },
    cancelled: { label: "ملغاة",      cls: "badge--danger",  icon: "x-circle" }
  };
  var MOVE_TYPE = {
    in:      { label: "إضافة",   cls: "badge--success", icon: "arrow-down" },
    out:     { label: "صرف",     cls: "badge--danger",  icon: "arrow-up" },
    adjust:  { label: "تسوية",   cls: "badge--warning", icon: "sliders" },
    return:  { label: "مرتجع",   cls: "badge--info",    icon: "undo" },
    payment: { label: "سداد",    cls: "badge--primary", icon: "cash" }
  };

  HS.ui.badge = function (label, cls, icon) {
    return '<span class="badge ' + (cls || "badge--neutral") + '">' +
      (icon ? HS.icon(icon, 12) : "") + HS.esc(label) + '</span>';
  };
  HS.ui.saleStatus = function (st) {
    var m = SALE_STATUS[st] || SALE_STATUS.paid;
    return '<span class="badge ' + m.cls + ' badge--dot">' + HS.esc(m.label) + '</span>';
  };
  HS.ui.poStatus = function (st) {
    var m = PO_STATUS[st] || PO_STATUS.draft;
    return '<span class="badge ' + m.cls + '">' + HS.icon(m.icon, 12) + HS.esc(m.label) + '</span>';
  };
  HS.ui.moveType = function (t) {
    var m = MOVE_TYPE[t] || MOVE_TYPE.adjust;
    return '<span class="badge ' + m.cls + '">' + HS.icon(m.icon, 12) + HS.esc(m.label) + '</span>';
  };
  HS.ui.saleStatusLabel = function (st) { return (SALE_STATUS[st] || {}).label || st; };

  /**
   * شارة رصيد: الرقم أولًا (فهو المعلومة المطلوبة)،
   * والتنبيه يظهر فقط عندما يكون الرصيد منخفضًا أو نافدًا.
   */
  HS.ui.stockBadge = function (p) {
    var stock = Number(p.stock) || 0;
    var min = Number(p.minStock) || 0;
    var num = '<span class="fw-600 ' + (stock <= 0 ? "text-danger" : stock <= min ? "text-warning" : "") + '">' + HS.fmt.int(stock) +
      (p.unit ? ' <span class="text-3 fw-400 fs-xs">' + HS.esc(p.unit) + '</span>' : "") + '</span>';
    if (stock <= 0) return '<span class="row-2" style="justify-content:flex-end">' + num + HS.ui.badge("نفد", "badge--danger") + '</span>';
    if (stock <= min) return '<span class="row-2" style="justify-content:flex-end">' + num + HS.ui.badge("منخفض", "badge--warning") + '</span>';
    return num;
  };

  HS.ui.avatar = function (name, cls) {
    var n = String(name || "").trim();
    var parts = n.split(/\s+/);
    var initials = (parts[0] ? parts[0][0] : "") + (parts[1] ? parts[1][0] : "");
    return '<span class="avatar ' + (cls || "") + '" aria-hidden="true">' + HS.esc(initials || "؟") + '</span>';
  };

  /* ═══════════════ بطاقات المؤشرات ═══════════════ */
  HS.ui.kpi = function (o) {
    var d = o.delta;
    var dCls = d == null ? "" : d > 0.001 ? "delta--up" : d < -0.001 ? "delta--down" : "delta--flat";
    var dIcon = d == null ? "" : d > 0.001 ? "arrow-up" : d < -0.001 ? "arrow-down" : "minus";
    var dGood = o.invert ? (d != null && d < 0) : (d != null && d > 0);
    var tag = o.href ? "a" : "article";
    return '<' + tag + (o.href ? ' href="' + HS.esc(o.href) + '"' : "") +
      ' class="kpi' + (o.accent ? " kpi--accent" : "") + (o.href ? " kpi--link" : "") + '"' +
      (o.href ? ' aria-label="' + HS.esc(o.label) + " — فتح التفاصيل" : "") + '>' +
      '<div class="kpi__top">' +
        '<span class="kpi__label">' + HS.esc(o.label) + '</span>' +
        (o.icon ? '<span style="color:' + (o.iconColor || "var(--text-3)") + '">' + HS.icon(o.icon, 17) + '</span>' : "") +
      '</div>' +
      '<div class="kpi__value">' + o.value + (o.suffix ? '<small>' + HS.esc(o.suffix) + '</small>' : "") + '</div>' +
      (o.spark ? '<div class="kpi__spark">' + o.spark + '</div>' : "") +
      '<div class="kpi__foot">' +
        (d != null ? '<span class="delta ' + (dGood ? "delta--up" : dCls === "delta--flat" ? "delta--flat" : "delta--down") + '">' +
          HS.icon(dIcon, 13) + HS.fmt.pct(Math.abs(d), 1) + '</span>' : "") +
        '<span class="truncate">' + HS.esc(o.note || "") + '</span>' +
        (o.href ? '<span class="kpi__go">' + HS.icon("chevron-left", 14) + '</span>' : "") +
      '</div>' +
    '</' + tag + '>';
  };

  HS.ui.statMini = function (label, value, hint) {
    return '<div class="stat-mini"><div class="stat-mini__k">' + HS.esc(label) + '</div>' +
      '<div class="stat-mini__v">' + value + '</div>' +
      (hint ? '<div class="fs-xs text-3">' + HS.esc(hint) + '</div>' : "") + '</div>';
  };

  /* ═══════════════ الجداول ═══════════════ */
  /**
   * columns: [{key,label,render(row),align,sortable,width,cls,hide}]
   * opt: {rows, empty, sort:{key,dir}, onSortAttr, selectable, rowAttrs, foot}
   */
  HS.ui.table = function (columns, rows, opt) {
    opt = opt || {};
    var cols = columns.filter(function (c) { return !c.hide; });
    if (!rows || !rows.length) {
      return '<div class="table-wrap"><table class="table table--stack"><tbody><tr><td>' +
        (opt.empty || HS.ui.empty()) + '</td></tr></tbody></table></div>';
    }
    var sort = opt.sort || {};
    var head = cols.map(function (c) {
      var align = c.align === "num" ? ' class="num"' : c.align === "center" ? ' class="center"' : "";
      var w = c.width ? ' style="width:' + c.width + '"' : "";
      if (!c.sortable) return '<th' + align + w + ' scope="col">' + HS.esc(c.label) + '</th>';
      var active = sort.key === c.key;
      var dir = active ? sort.dir : "none";
      var icon = active ? (sort.dir === "asc" ? "arrow-up" : "arrow-down") : "sort";
      return '<th' + align + w + ' scope="col" aria-sort="' + (active ? (sort.dir === "asc" ? "ascending" : "descending") : "none") + '">' +
        '<button type="button" class="table__sort" data-action="sort" data-key="' + HS.esc(c.key) + '" data-dir="' + dir + '">' +
        HS.esc(c.label) + HS.icon(icon, 13) + '</button></th>';
    }).join("");

    var body = rows.map(function (row, ri) {
      var attrs = "";
      if (opt.rowAttrs) attrs = opt.rowAttrs(row, ri) || "";
      return '<tr' + attrs + '>' + cols.map(function (c) {
        var align = c.align === "num" ? ' class="num ' + (c.cls || "") + '"' : c.align === "center" ? ' class="center ' + (c.cls || "") + '"' : (c.cls ? ' class="' + c.cls + '"' : "");
        var val = c.render ? c.render(row, ri) : HS.esc(row[c.key]);
        return '<td' + align + ' data-label="' + HS.esc(c.label || "") + '">' + val + '</td>';
      }).join("") + '</tr>';
    }).join("");

    var foot = opt.foot ? '<tfoot><tr>' + cols.map(function (c, i) {
      var v = opt.foot[i];
      var align = c.align === "num" ? ' class="num"' : c.align === "center" ? ' class="center"' : "";
      return '<td' + align + ' data-label="">' + (v == null ? "" : v) + '</td>';
    }).join("") + '</tr></tfoot>' : "";

    return '<div class="table-wrap"><table class="table table--stack">' +
      '<thead><tr>' + head + '</tr></thead>' +
      '<tbody>' + body + '</tbody>' + foot + '</table></div>';
  };

  /* ═══════════════ الترقيم ═══════════════ */
  HS.ui.pager = function (o) {
    var page = o.page, per = o.per, total = o.total;
    var pages = Math.max(1, Math.ceil(total / per));
    if (total === 0) return "";
    var from = (page - 1) * per + 1, to = Math.min(total, page * per);

    var btns = [];
    btns.push('<button type="button" class="pager__btn" data-action="page" data-page="' + (page - 1) + '"' + (page <= 1 ? " disabled" : "") + ' aria-label="الصفحة السابقة">' + HS.icon("chevron-right", 15) + '</button>');
    var list = HS.ui._pageList(page, pages);
    list.forEach(function (p) {
      if (p === "…") btns.push('<span class="pager__gap">…</span>');
      else btns.push('<button type="button" class="pager__btn" data-action="page" data-page="' + p + '"' +
        (p === page ? ' aria-current="page"' : "") + '>' + HS.fmt.int(p) + '</button>');
    });
    btns.push('<button type="button" class="pager__btn" data-action="page" data-page="' + (page + 1) + '"' + (page >= pages ? " disabled" : "") + ' aria-label="الصفحة التالية">' + HS.icon("chevron-left", 15) + '</button>');

    return '<div class="pager">' +
      '<span class="pager__info">عرض ' + HS.fmt.int(from) + '–' + HS.fmt.int(to) + ' من ' + HS.fmt.int(total) + '</span>' +
      '<nav class="pager__btns" aria-label="التنقل بين الصفحات">' + btns.join("") + '</nav>' +
      '</div>';
  };
  HS.ui._pageList = function (cur, total) {
    if (total <= 7) { var a = []; for (var i = 1; i <= total; i++) a.push(i); return a; }
    var out = [1];
    if (cur > 3) out.push("…");
    for (var j = Math.max(2, cur - 1); j <= Math.min(total - 1, cur + 1); j++) out.push(j);
    if (cur < total - 2) out.push("…");
    out.push(total);
    return out;
  };

  /** يقطّع المصفوفة حسب الصفحة */
  HS.ui.paginate = function (arr, page, per) {
    var p = Math.max(1, page);
    return arr.slice((p - 1) * per, p * per);
  };

  /* ═══════════════ الحالات الفارغة والهياكل ═══════════════ */
  HS.ui.empty = function (o) {
    o = o || {};
    return '<div class="empty">' +
      '<span class="empty__icon">' + HS.icon(o.icon || "inbox", 26) + '</span>' +
      '<span class="empty__title">' + HS.esc(o.title || "لا توجد بيانات") + '</span>' +
      (o.text ? '<span class="empty__text">' + HS.esc(o.text) + '</span>' : "") +
      (o.action || "") +
      '</div>';
  };

  HS.ui.skeletonTable = function (rows, cols) {
    var out = '<div class="card__body">';
    for (var i = 0; i < (rows || 6); i++) {
      out += '<div class="row" style="gap:var(--sp-4);margin-block-end:var(--sp-3)">';
      for (var j = 0; j < (cols || 5); j++) {
        out += '<div class="skeleton sk-line" style="flex:' + (j === 0 ? 2 : 1) + ';height:14px;margin:0"></div>';
      }
      out += '</div>';
    }
    return out + '</div>';
  };

  HS.ui.skeletonCards = function (n) {
    var out = '<div class="grid-kpi">';
    for (var i = 0; i < (n || 4); i++) out += '<div class="skeleton sk-card"></div>';
    return out + '</div>';
  };

  /* ═══════════════ النماذج ═══════════════ */
  /**
   * حقل إدخال. o: {label,name,type,value,required,hint,error,options,rows,
   *   placeholder,min,max,step,autocomplete,disabled,suffix,icon,attrs,cls}
   */
  HS.ui.field = function (o) {
    o = o || {};
    var type = o.type || "text";
    var id = o.id || ("f-" + (o.name || Math.random().toString(36).slice(2)));
    var req = o.required ? '<span class="req" aria-hidden="true">*</span>' : "";
    var lbl = o.label === false ? "" :
      '<label class="field__label" for="' + id + '">' + HS.esc(o.label || "") + req + '</label>';
    var ctl = "";
    var common = 'id="' + id + '" name="' + HS.esc(o.name || id) + '"' +
      (o.required ? ' required' : "") +
      (o.disabled ? ' disabled' : "") +
      (o.readonly ? ' readonly' : "") +
      (o.placeholder ? ' placeholder="' + HS.esc(o.placeholder) + '"' : "") +
      (o.autocomplete ? ' autocomplete="' + HS.esc(o.autocomplete) + '"' : "") +
      (o.attrs || "");

    if (type === "select") {
      ctl = '<select class="select ' + (o.cls || "") + '" ' + common + '>' +
        (o.placeholder ? '<option value="">' + HS.esc(o.placeholder) + '</option>' : "") +
        (o.options || []).map(function (op) {
          var v = typeof op === "object" ? op.value : op;
          var t = typeof op === "object" ? op.label : op;
          return '<option value="' + HS.esc(v) + '"' + (String(v) === String(o.value) ? " selected" : "") + '>' + HS.esc(t) + '</option>';
        }).join("") + '</select>';
    } else if (type === "textarea") {
      ctl = '<textarea class="textarea ' + (o.cls || "") + '" ' + common + ' rows="' + (o.rows || 3) + '">' + HS.esc(o.value || "") + '</textarea>';
    } else if (type === "checkbox" || type === "switch") {
      var checked = o.value ? " checked" : "";
      ctl = '<label class="' + (type === "switch" ? "switch" : "check") + '">' +
        '<input type="checkbox" ' + common + checked + '>' +
        (type === "switch" ? '<span class="switch__track"><span class="switch__thumb"></span></span>' : '<span class="check__box" aria-hidden="true"></span>') +
        '<span class="' + (type === "switch" ? "switch__label" : "check__label") + '">' + HS.esc(o.checkLabel || o.label || "") + '</span>' +
        '</label>';
      if (type === "checkbox" || type === "switch") lbl = "";
    } else {
      var inp = '<input class="input ' + (o.cls || "") + (type === "number" ? " input--num" : "") + '" type="' + type + '" ' + common +
        (o.value != null && o.value !== "" ? ' value="' + HS.esc(o.value) + '"' : "") +
        (o.min != null ? ' min="' + o.min + '"' : "") +
        (o.max != null ? ' max="' + o.max + '"' : "") +
        (o.step != null ? ' step="' + o.step + '"' : "") +
        (o.inputmode ? ' inputmode="' + o.inputmode + '"' : "") +
        (o.dir ? ' dir="' + o.dir + '"' : "") +
        (o.spellcheck === false ? ' spellcheck="false"' : "") + '>';
      ctl = (o.icon || o.suffix)
        ? '<div class="input-wrap' + (o.suffix ? " input-wrap--suffix" : "") + '">' +
          (o.icon ? '<span class="input-wrap__icon">' + HS.icon(o.icon, 16) + '</span>' : "") + inp +
          (o.suffix ? '<span class="input-wrap__suffix">' + HS.esc(o.suffix) + '</span>' : "") + '</div>'
        : inp;
    }

    return '<div class="field' + (o.span2 ? " span-2" : "") + '" data-field="' + HS.esc(o.name || id) + '"' +
      (o.error ? ' data-invalid="true"' : "") + '>' +
      lbl + ctl +
      (o.hint && !o.error ? '<span class="field__hint">' + HS.esc(o.hint) + '</span>' : "") +
      '<span class="field__error"' + (o.error ? "" : " hidden") + '>' + HS.icon("alert", 13) + '<span>' + HS.esc(o.error || "") + '</span></span>' +
      '</div>';
  };

  /** يجمع قيم نموذج إلى كائن */
  HS.ui.formValues = function (form) {
    var out = {};
    HS.$$("input,select,textarea", form).forEach(function (el) {
      if (!el.name) return;
      if (el.type === "checkbox") out[el.name] = el.checked;
      else if (el.type === "radio") { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  };

  /** يعرض خطأ تحت حقل ويؤشّر عليه */
  HS.ui.fieldError = function (form, name, msg) {
    /* نجد غلاف الحقل بأي ترميز: data-field ثم المعرّف ثم اسم الحقل */
    var wrap = form.querySelector('[data-field="' + name + '"]');
    var inp = null;
    if (!wrap) {
      inp = form.querySelector("#" + name) || form.querySelector('[name="' + name + '"]');
      wrap = inp ? inp.closest(".field") : null;
    }
    if (!wrap) return;
    if (!inp) inp = wrap.querySelector("input,select,textarea");
    var e = wrap.querySelector(".field__error");
    if (msg) {
      wrap.setAttribute("data-invalid", "true");
      if (e) {
        e.hidden = false;
        var sp = e.querySelector("span");
        if (sp) sp.textContent = msg; else e.textContent = msg;
        if (inp && e.id) inp.setAttribute("aria-describedby", e.id);
      }
      if (inp) inp.setAttribute("aria-invalid", "true");
    } else {
      wrap.removeAttribute("data-invalid");
      if (e) e.hidden = true;
      if (inp) { inp.removeAttribute("aria-invalid"); inp.removeAttribute("aria-describedby"); }
    }
  };
  HS.ui.clearErrors = function (form) {
    HS.$$("[data-invalid]", form).forEach(function (w) { w.removeAttribute("data-invalid"); });
    HS.$$(".field__error", form).forEach(function (e) { e.hidden = true; });
    HS.$$("[aria-invalid]", form).forEach(function (e) { e.removeAttribute("aria-invalid"); });
  };
  /** يزيل خطأ حقل واحد بالاسم */
  HS.ui.clearError = function (form, name) { HS.ui.fieldError(form, name, ""); };
  /** يركز أول حقل فيه خطأ */
  HS.ui.focusFirstError = function (form) {
    var w = form.querySelector('[data-invalid="true"] input, [data-invalid="true"] select, [data-invalid="true"] textarea');
    if (w) { w.focus(); w.scrollIntoView({ block: "center", behavior: "smooth" }); return true; }
    return false;
  };

  /* ═══════════════ النوافذ المنبثقة ═══════════════ */
  var modalStack = [];

  /**
   * HS.ui.modal({title, sub, body, footer, size, onMount, onClose, dismissible})
   * يعيد {close, root, body, footer}
   */
  HS.ui.MODAL_EXIT_MS = 200;

  /* Escape يغلق أعلى نافذة وTab يحبس التركيز داخلها — حتى لو كان
     التركيز خارج النافذة (نقرة على الخلفية مثلًا). */
  document.addEventListener("keydown", function (ev) {
    if (!modalStack.length) return;
    var api = modalStack[modalStack.length - 1];
    if (ev.key === "Escape" && api.dismissible !== false) {
      ev.preventDefault(); ev.stopPropagation();
      api.close(null);
      return;
    }
    if (ev.key === "Tab" && api.root && api.root.contains(document.activeElement)) {
      HS.focus.trap(api.root, ev);
    }
  }, true);

  HS.ui.modal = function (o) {
    o = o || {};
    var root = HS.$("#modalRoot");
    var backdrop = HS.el("div.modal-backdrop", { attrs: { "data-open": "false" } });
    var modal = HS.el("div.modal" + (o.size ? ".modal--" + o.size : ""), {
      attrs: { role: "dialog", "aria-modal": "true", "aria-label": o.title || "نافذة" }
    });

    var head = "";
    if (o.title !== false) {
      head = '<div class="modal__head"><div class="grow" style="min-width:0">' +
        '<h2 class="modal__title">' + HS.esc(o.title || "") + '</h2>' +
        (o.sub ? '<p class="modal__sub">' + HS.esc(o.sub) + '</p>' : "") +
        '</div>' +
        '<button type="button" class="icon-btn" data-modal-close aria-label="إغلاق النافذة">' + HS.icon("x", 18) + '</button></div>';
    }
    var bodyCls = "modal__body" + (o.flush ? " modal__body--flush" : "");
    modal.innerHTML = head +
      '<div class="' + bodyCls + '">' + (o.body || "") + '</div>' +
      (o.footer != null ? '<div class="modal__foot">' + o.footer + '</div>' : "");

    backdrop.appendChild(modal);
    root.appendChild(backdrop);

    /* فتح بحركة: ننتظر الإطار التالي حتى يعمل الانتقال */
    requestAnimationFrame(function () { backdrop.setAttribute("data-open", "true"); });

    var prevFocus = document.activeElement;
    var api = {
      root: modal,
      dismissible: o.dismissible !== false,
      body: modal.querySelector(".modal__body"),
      footer: modal.querySelector(".modal__foot"),
      backdrop: backdrop,
      close: function (result) {
        if (api._closed) return;
        api._closed = true;
        backdrop.setAttribute("data-open", "false");
        document.body.removeAttribute("data-modal-open");
        var idx = modalStack.indexOf(api);
        if (idx >= 0) modalStack.splice(idx, 1);
        if (!modalStack.length) document.body.removeAttribute("data-modal-open");
        if (prevFocus && prevFocus.focus && document.contains(prevFocus)) prevFocus.focus();
        if (o.onClose) o.onClose(result);
        /* الإزالة بعد انتهاء حركة الخروج، ولا تُلغى أبدًا */
        setTimeout(function () { HS.remove(backdrop); }, HS.ui.MODAL_EXIT_MS);
      }
    };

    backdrop.addEventListener("click", function (ev) {
      if (ev.target === backdrop && o.dismissible !== false) api.close(null);
    });
    modal.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-modal-close]")) api.close(null);
    });
    backdrop.addEventListener("keydown", function (ev) {
      if (ev.key === "Tab") HS.focus.trap(modal, ev);
    });

    modalStack.push(api);
    document.body.setAttribute("data-modal-open", "true");

    if (o.onMount) o.onMount(api);
    /* نقل التركيز إلى أول عنصر قابل للتركيز داخل النافذة */
    var first = modal.querySelector("[data-autofocus]") || HS.focus.first(modal);
    if (first) setTimeout(function () { first.focus(); }, 30);

    return api;
  };

  /** نافذة تأكيد تُعيد Promise<boolean> */
  HS.ui.confirm = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var iconCls = o.tone === "warn" ? " confirm__icon--warn" : o.tone === "info" ? " confirm__icon--info" : "";
      var m = HS.ui.modal({
        size: "sm",
        title: false,
        body: '<div class="confirm">' +
          '<span class="confirm__icon' + iconCls + '">' + HS.icon(o.icon || "alert", 26) + '</span>' +
          '<h2 class="confirm__title">' + HS.esc(o.title || "هل أنت متأكد؟") + '</h2>' +
          '<p class="confirm__text">' + (o.html || HS.esc(o.text || "")) + '</p>' +
          (o.extra || "") +
          '</div>',
        footer: '<button type="button" class="btn btn--secondary" data-modal-close>' + HS.esc(o.cancelLabel || "إلغاء") + '</button>' +
                '<button type="button" class="btn ' + (o.danger === false ? "btn--primary" : "btn--danger") + '" data-confirm-ok>' + HS.esc(o.okLabel || "تأكيد") + '</button>',
        onClose: function (res) { resolve(res === true); }
      });
      m.root.querySelector("[data-confirm-ok]").addEventListener("click", function () { m.close(true); });
    });
  };

  /** نافذة إدخال سريعة تُعيد Promise<string|null> */
  HS.ui.prompt = function (o) {
    o = o || {};
    return new Promise(function (resolve) {
      var m = HS.ui.modal({
        size: "sm", title: o.title || "إدخال", sub: o.sub,
        body: HS.ui.field({ name: "value", label: o.label || "", type: o.type || "text", value: o.value || "", placeholder: o.placeholder, hint: o.hint, span2: true, attrs: ' data-autofocus' }),
        footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
                '<button type="button" class="btn btn--primary" data-ok>' + HS.esc(o.okLabel || "حفظ") + '</button>',
        onClose: function (res) { resolve(res == null ? null : res); }
      });
      function submit() {
        var inp = m.body.querySelector("input,textarea,select");
        m.close(inp ? inp.value : "");
      }
      m.root.querySelector("[data-ok]").addEventListener("click", submit);
      m.body.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { ev.preventDefault(); submit(); } });
    });
  };

  /* ═══════════════ الإشعارات ═══════════════ */
  var TOAST_ICON = { success: "check-circle", danger: "x-circle", warning: "alert", info: "info" };

  /**
   * HS.ui.toast({type,title,msg,duration,actions:[{label,onClick,cls}]})
   */
  HS.ui.toast = function (o) {
    if (typeof o === "string") o = { title: o };
    o = o || {};
    var type = o.type || "success";
    var dur = o.duration != null ? o.duration : 4200;
    var root = HS.$("#toastRoot");
    if (!root) return { close: function () {} };

    var node = HS.el("div.toast.toast--" + type, { attrs: { role: "status" } });
    node.innerHTML =
      '<span class="toast__icon">' + HS.icon(o.icon || TOAST_ICON[type] || "info", 18) + '</span>' +
      '<div class="toast__body">' +
        (o.title ? '<div class="toast__title">' + HS.esc(o.title) + '</div>' : "") +
        (o.msg ? '<div class="toast__msg">' + (o.html ? o.msg : HS.esc(o.msg)) + '</div>' : "") +
        ((o.actions && o.actions.length) ? '<div class="toast__actions"></div>' : "") +
      '</div>' +
      '<button type="button" class="icon-btn icon-btn--sm" data-toast-close aria-label="إغلاق الإشعار">' + HS.icon("x", 15) + '</button>';

    if (dur > 0) {
      var bar = HS.el("span.toast__bar", { style: { color: "currentColor", animationDuration: dur + "ms" } });
      node.appendChild(bar);
    }
    root.appendChild(node);
    requestAnimationFrame(function () { node.setAttribute("data-open", "true"); });

    var timer = dur > 0 ? setTimeout(close, dur) : null;
    node.addEventListener("pointerenter", function () { if (timer) { clearTimeout(timer); timer = null; } });
    node.addEventListener("pointerleave", function () { if (!timer && dur > 0) timer = setTimeout(close, 1600); });
    node.querySelector("[data-toast-close]").addEventListener("click", close);

    if (o.actions && o.actions.length) {
      var wrap = node.querySelector(".toast__actions");
      o.actions.forEach(function (a) {
        var b = HS.el("button.btn.btn--sm." + (a.cls || "btn--secondary"), { text: a.label, attrs: { type: "button" } });
        b.addEventListener("click", function () { if (a.onClick) a.onClick(); close(); });
        wrap.appendChild(b);
      });
    }

    function close() {
      if (timer) { clearTimeout(timer); timer = null; }
      node.setAttribute("data-open", "false");
      setTimeout(function () { HS.remove(node); }, 260);
    }
    /* لا نكدّس أكثر من أربعة */
    var all = HS.$$(".toast", root);
    while (all.length > 4) { HS.remove(all.shift()); }

    return { close: close, el: node };
  };

  /* ═══════════════ القوائم المنبثقة ═══════════════ */
  var openPop = null;
  HS.ui.pop = function (anchor, contentOrNode, opt) {
    opt = opt || {};
    HS.ui.closePop();
    var pop = HS.el("div.pop" + (opt.wide ? ".pop--wide" : ""), { attrs: { role: "menu" } });
    if (typeof contentOrNode === "string") pop.innerHTML = contentOrNode;
    else pop.appendChild(contentOrNode);
    var wrap = anchor.parentNode;
    if (!wrap.classList.contains("pop-wrap")) {
      wrap = HS.el("div.pop-wrap");
      anchor.parentNode.insertBefore(wrap, anchor);
      wrap.appendChild(anchor);
    }
    wrap.appendChild(pop);
    requestAnimationFrame(function () { pop.setAttribute("data-open", "true"); });
    anchor.setAttribute("aria-expanded", "true");
    openPop = { pop: pop, anchor: anchor };
    if (opt.onMount) opt.onMount(pop);
    var first = HS.focus.first(pop);
    if (first) first.focus();
    return pop;
  };
  HS.ui.closePop = function () {
    if (!openPop) return;
    openPop.pop.setAttribute("data-open", "false");
    openPop.anchor.setAttribute("aria-expanded", "false");
    var p = openPop.pop;
    setTimeout(function () { HS.remove(p); }, 160);
    openPop = null;
  };
  document.addEventListener("click", function (ev) {
    if (!openPop) return;
    if (openPop.pop.contains(ev.target) || openPop.anchor.contains(ev.target)) return;
    HS.ui.closePop();
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && openPop) { HS.ui.closePop(); }
  });

  HS.ui.popItem = function (label, icon, action, data, cls) {
    var attrs = action ? ' data-action="' + HS.esc(action) + '"' : "";
    if (data) Object.keys(data).forEach(function (k) { attrs += ' data-' + k + '="' + HS.esc(data[k]) + '"'; });
    return '<button type="button" class="pop__item ' + (cls || "") + '"' + attrs + '>' +
      (icon ? HS.icon(icon, 16) : "") + '<span>' + HS.esc(label) + '</span></button>';
  };

  /* ═══════════════ أدوات صغيرة ═══════════════ */
  /** شريط أدوات الجدول: بحث + مرشّحات + أزرار */
  HS.ui.toolbar = function (o) {
    o = o || {};
    return '<div class="toolbar">' +
      (o.search !== false ? '<div class="toolbar__search"><div class="input-wrap input-wrap--sm">' +
        '<span class="input-wrap__icon">' + HS.icon("search", 14) + '</span>' +
        '<input class="input input--sm" type="search" name="' + HS.esc(o.searchName || "q") + '" ' +
        'value="' + HS.esc(o.q || "") + '" placeholder="' + HS.esc(o.placeholder || "بحث…") + '" ' +
        'autocomplete="off" data-search-input aria-label="' + HS.esc(o.placeholder || "بحث") + '">' +
        '</div></div>' : "") +
      (o.filters ? '<div class="toolbar__filters">' + o.filters + '</div>' : "") +
      '<span class="toolbar__spacer"></span>' +
      (o.actions || "") +
      '</div>';
  };

  /** منتقي مرشّح كقائمة منسدلة */
  HS.ui.select = function (o) {
    return '<select class="select select--sm" name="' + HS.esc(o.name) + '" data-filter aria-label="' + HS.esc(o.label || o.name) + '">' +
      (o.options || []).map(function (op) {
        var v = typeof op === "object" ? op.value : op;
        var t = typeof op === "object" ? op.label : op;
        return '<option value="' + HS.esc(v) + '"' + (String(v) === String(o.value) ? " selected" : "") + '>' + HS.esc(t) + '</option>';
      }).join("") + '</select>';
  };

  HS.ui.btn = function (o) {
    return '<button type="button" class="btn ' + (o.cls || "btn--secondary") + (o.sm ? " btn--sm" : "") + '"' +
      (o.action ? ' data-action="' + HS.esc(o.action) + '"' : "") +
      (o.data ? Object.keys(o.data).map(function (k) { return ' data-' + k + '="' + HS.esc(o.data[k]) + '"'; }).join("") : "") +
      (o.disabled ? " disabled" : "") + (o.title ? ' title="' + HS.esc(o.title) + '"' : "") + '>' +
      (o.icon ? '<span class="btn__icon">' + HS.icon(o.icon, 16) + '</span>' : "") +
      (o.label ? '<span class="btn__label">' + HS.esc(o.label) + '</span>' : "") + '</button>';
  };

  HS.ui.iconBtn = function (action, icon, label, data, cls) {
    var d = data ? Object.keys(data).map(function (k) { return ' data-' + k + '="' + HS.esc(data[k]) + '"'; }).join("") : "";
    return '<button type="button" class="icon-btn icon-btn--sm ' + (cls || "") + '" data-action="' + HS.esc(action) + '"' + d +
      ' aria-label="' + HS.esc(label) + '" title="' + HS.esc(label) + '">' + HS.icon(icon, 16) + '</button>';
  };

  /** وميض رقم بعد تحديثه */
  HS.ui.flash = function (node, up) {
    if (!node) return;
    node.classList.remove("flash-up", "flash-down");
    void node.offsetWidth;
    node.classList.add(up === false ? "flash-down" : "flash-up");
    setTimeout(function () { node.classList.remove("flash-up", "flash-down"); }, 750);
  };

  /** نسخ نص إلى الحافظة مع بديل عند الفشل */
  HS.ui.copy = function (text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
      }
    } catch (e) {}
    return Promise.resolve(fallback());
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text; ta.setAttribute("readonly", "");
        ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand("copy");
        HS.remove(ta);
        return ok;
      } catch (e) { return false; }
    }
  };

  /** تبويبات */
  HS.ui.tabs = function (tabs, active) {
    return '<div class="tabs" role="tablist">' + tabs.map(function (t) {
      var sel = String(t.id) === String(active);
      return '<button type="button" class="tab" role="tab" id="tab-' + HS.esc(t.id) + '" ' +
        'aria-selected="' + sel + '" tabindex="' + (sel ? "0" : "-1") + '" ' +
        'data-action="tab" data-tab="' + HS.esc(t.id) + '">' +
        HS.esc(t.label) + (t.count != null ? '<span class="tab__count">' + HS.fmt.int(t.count) + '</span>' : "") +
        '</button>';
    }).join("") + '</div>';
  };

  /** قائمة عناصر جاهزة */
  HS.ui.listItem = function (o) {
    return '<div class="list__item">' +
      (o.leading || "") +
      '<div class="list__body"><div class="list__title">' + o.title + '</div>' +
      (o.meta ? '<div class="list__meta">' + o.meta + '</div>' : "") + '</div>' +
      (o.aside ? '<div class="list__aside">' + o.aside + '</div>' : "") +
      '</div>';
  };

  HS.ui.kv = function (pairs) {
    return '<dl class="kv">' + pairs.map(function (p) {
      return '<dt>' + HS.esc(p[0]) + '</dt><dd>' + p[1] + '</dd>';
    }).join("") + '</dl>';
  };

  /** رقم هاتف مقروء محليًا */
  HS.ui.phone = function (p) {
    var d = String(p || "").replace(/\D/g, "");
    if (d.length === 10 && d.indexOf("09") === 0) return d.slice(0, 4) + " " + d.slice(4, 7) + " " + d.slice(7);
    return String(p || "");
  };
})();
