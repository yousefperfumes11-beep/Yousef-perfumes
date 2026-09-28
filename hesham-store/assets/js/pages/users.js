/* ═══════════════════════════════════════════════════════════
   pages/users.js — المستخدمون والصلاحيات
   إدارة واجهة فقط: لا كلمات مرور حقيقية ولا جلسات خادم.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var ROLES = ["مدير", "كاشير", "مشرف مخزن", "محاسب"];
  var STATUSES = ["متاح", "مشغول", "في إجازة", "غير متصل"];
  var STATUS_TONE = { "متاح": "badge--success", "مشغول": "badge--warning", "في إجازة": "badge--info", "غير متصل": "badge--neutral" };

  HS.pages.users = function (root, ctx) {
    var st = HS.store.state;
    var tab = ctx.query.tab || "all";
    var role = ctx.query.role || "";
    var q = ctx.query.q || "";
    var canManage = HS.store.can("users_manage");
    var me = HS.store.currentUser();

    HS.ui.setHeader({
      title: "المستخدمون",
      sub: "حسابات الفريق وأدوارهم والصلاحيات المرتبطة بكل دور. الدخول تجريبي بلا خادم.",
      crumbs: [{ label: "الرئيسية", href: "#/" }, { label: "المستخدمون" }],
      hidePeriod: true
    });

    function stats(u) {
      var sales = st.sales.filter(function (s) { return s.cashierId === u.id && s.status !== "held"; });
      return {
        sales: sales.length,
        revenue: HS.round(HS.sum(sales.filter(function (s) { return s.status !== "returned"; }), function (s) { return s.total; }), 3)
      };
    }

    var all = st.users.map(function (u) { return Object.assign({}, u, { _s: stats(u) }); });
    var counts = {
      all: all.length,
      active: all.filter(function (u) { return u.active; }).length,
      inactive: all.filter(function (u) { return !u.active; }).length,
      admins: all.filter(function (u) { return u.role === "مدير"; }).length
    };

    var list = all.filter(function (u) {
      if (tab === "active" && !u.active) return false;
      if (tab === "inactive" && u.active) return false;
      if (tab === "admins" && u.role !== "مدير") return false;
      if (role && u.role !== role) return false;
      if (q && !HS.matches(u.name + " " + u.username + " " + u.role + " " + (u.phone || ""), q)) return false;
      return true;
    });
    list = HS.sortBy(list, function (u) { return u.name; }, "asc");

    var tabs = [
      { id: "all", label: "كل المستخدمين", count: counts.all },
      { id: "active", label: "نشط", count: counts.active },
      { id: "admins", label: "مديرون", count: counts.admins },
      { id: "inactive", label: "موقوف", count: counts.inactive }
    ];

    var roleBreakdown = ROLES.map(function (r) {
      var us = all.filter(function (u) { return u.role === r; });
      return { role: r, count: us.length, perms: (HS.data.ROLE_PERMS[r] || []).length, revenue: HS.round(HS.sum(us, function (u) { return u._s.revenue; }), 3) };
    });

    root.innerHTML = '<div class="stack page-enter">' +
      '<section class="stat-strip no-print">' +
        HS.ui.statMini("عدد الحسابات", HS.fmt.int(counts.all), counts.active + " نشط") +
        HS.ui.statMini("مديرون", HS.fmt.int(counts.admins), "صلاحيات كاملة") +
        HS.ui.statMini("أدوار معرّفة", HS.fmt.int(ROLES.length), HS.fmt.int(HS.data.PERMISSIONS.length) + " صلاحية") +
        HS.ui.statMini("فواتير الفريق", HS.fmt.int(HS.sum(all, function (u) { return u._s.sales; })), HS.fmt.money(HS.round(HS.sum(all, function (u) { return u._s.revenue; }), 3)) + " إيرادًا") +
        HS.ui.statMini("حسابك", me ? HS.esc(me.name) : "غير مسجّل", me ? me.role + " · " + HS.fmt.int((me.permissions || []).length) + " صلاحية" : "") +
      '</section>' +

      '<section class="grid-main" style="align-items:start">' +
        '<div class="card">' +
          '<div class="card__body" style="padding-block:var(--sp-3)">' + HS.ui.tabs(tabs, tab) + '</div>' +
          HS.ui.toolbar({
            q: q, placeholder: "بحث بالاسم أو اسم الدخول…", searchName: "q",
            filters: HS.ui.select({ name: "role", label: "الدور", value: role, options: [{ value: "", label: "كل الأدوار" }].concat(ROLES.map(function (r) { return { value: r, label: r }; })) }),
            actions: canManage ? '<button type="button" class="btn btn--sm btn--primary" data-action="usr-new"><span class="btn__icon">' + HS.icon("plus", 15) + '</span><span class="btn__label">مستخدم جديد</span></button>' : ""
          }) +
          '<div class="card__body card__body--flush">' +
          (list.length ? '<div class="list" style="padding:0 var(--sp-4)">' + list.map(function (u) {
            var isMe = me && u.id === me.id;
            return '<div class="list__item" style="padding-block:var(--sp-3)">' +
              '<span style="position:relative;flex:0 0 auto">' + HS.ui.avatar(u.name, (u.active ? "" : "avatar--alt") + " avatar--lg") +
                '<span class="usr-dot usr-dot--' + (u.active ? (u.status === "متاح" ? "on" : u.status === "غير متصل" ? "off" : "busy") : "off") + '" title="' + HS.esc(u.status) + '" aria-hidden="true"></span></span>' +
              '<span class="list__body">' +
                '<span class="list__title">' + HS.esc(u.name) + (isMe ? ' ' + HS.ui.badge("أنت", "badge--primary") : "") + (!u.active ? ' ' + HS.ui.badge("موقوف", "badge--neutral") : "") + '</span>' +
                '<span class="list__meta"><span class="ltr">@' + HS.esc(u.username) + '</span> · ' + HS.esc(u.role) + ' · ' + HS.fmt.int((u.permissions || []).length) + ' صلاحية' +
                  (u.phone ? ' · <span class="ltr">' + HS.esc(HS.ui.phone(u.phone)) + '</span>' : "") + '</span>' +
                '<span class="list__meta">' + HS.fmt.int(u._s.sales) + ' فاتورة · ' + HS.fmt.money(u._s.revenue) + ' إيرادًا · آخر دخول ' + (u.lastLogin ? HS.fmt.rel(u.lastLogin) : "لم يسجّل") + '</span>' +
              '</span>' +
              '<span class="list__aside row-2">' +
                HS.ui.badge(u.status, STATUS_TONE[u.status] || "badge--neutral") +
                HS.ui.iconBtn("usr-view", "eye", "عرض الصلاحيات", { id: u.id }) +
                (canManage ? HS.ui.iconBtn("usr-menu", "more", "إجراءات", { id: u.id }) : "") +
              '</span>' +
            '</div>';
          }).join("") + '</div>' :
          HS.ui.empty({
            icon: "users", title: "لا مستخدمون مطابقون",
            text: "غيّر البحث أو المرشّح لعرض حسابات أخرى.",
            action: '<button type="button" class="btn btn--secondary btn--sm" data-action="usr-clear">إزالة المرشّحات</button>'
          })) +
          '</div>' +
        '</div>' +

        '<div class="stack">' +
          '<article class="card"><div class="card__head"><div><h2 class="card__title">الأدوار والصلاحيات</h2>' +
          '<p class="card__sub">كل دور يحمل مجموعة صلاحيات جاهزة</p></div></div>' +
          '<div class="card__body card__body--flush">' +
          HS.ui.table([
            { key: "r", label: "الدور", render: function (r) { return '<span class="row-2">' + HS.icon(r.role === "مدير" ? "shield" : r.role === "كاشير" ? "cart" : r.role === "محاسب" ? "calculator" : "box", 15) + '<span class="fw-600">' + HS.esc(r.role) + '</span></span>'; } },
            { key: "u", label: "المستخدمون", align: "num", width: "96px", render: function (r) { return HS.fmt.int(r.count); } },
            { key: "p", label: "الصلاحيات", align: "num", width: "96px", render: function (r) { return HS.fmt.int(r.perms) + ' <span class="text-3 fs-xs">/ ' + HS.fmt.int(HS.data.PERMISSIONS.length) + '</span>'; } },
            { key: "a", label: "", align: "center", width: "76px", render: function (r) { return HS.ui.iconBtn("usr-role", "eye", "عرض صلاحيات الدور", { role: r.role }); } }
          ], roleBreakdown) +
          '</div></article>' +

          '<article class="card"><div class="card__head"><div><h2 class="card__title">كيف تعمل الصلاحيات</h2>' +
          '<p class="card__sub">قواعد مطبّقة في الواجهة</p></div></div>' +
          '<div class="card__body"><div class="list">' +
            rule("إخفاء لا تعطيل فقط", "الأزرار والجداول التي لا تملك صلاحيتها تُخفى أو تُعطَّل مع توضيح السبب عند المحاولة.") +
            rule("الدور يحدد الافتراضي", "اختيار دور جديد يعيد ضبط الصلاحيات إلى مجموعة الدور، ثم يمكنك تخصيصها يدويًا.") +
            rule("لا حذف للحساب الحالي", "لا يمكنك حذف الحساب الذي تستخدمه الآن، ولا تعطيل آخر مدير في النظام.") +
            rule("الدخول تجريبي", "أي اسم مستخدم موجود مع كلمة مرور من 4 أحرف فأكثر يكفي — لا خادم ولا تخزين لكلمات المرور.") +
          '</div></div></article>' +
        '</div>' +
      '</section>' +
    '</div>';

    HS.icons.hydrate(root);

    var rSel = root.querySelector('.toolbar select[name="role"]');
    if (rSel) rSel.addEventListener("change", function () { ctx.setQuery({ role: rSel.value || null }); });

    function rule(title, text) {
      return '<div class="list__item" style="align-items:flex-start"><span class="thumb thumb--sm" aria-hidden="true">' + HS.icon("shield", 14) + '</span>' +
        '<span class="list__body"><span class="list__title">' + HS.esc(title) + '</span>' +
        '<span class="list__meta" style="white-space:normal;line-height:var(--lh-snug)">' + HS.esc(text) + '</span></span></div>';
    }
  };

  /* ═══════════ النموذج ═══════════ */
  function userForm(u) {
    var st = HS.store.state;
    var isNew = !u;
    var v = u || { name: "", username: "", phone: "", role: "كاشير", status: "متاح", active: true, permissions: (HS.data.ROLE_PERMS["كاشير"] || []).slice() };
    var perms = (v.permissions || []).slice();

    var m = HS.ui.modal({
      title: isNew ? "إضافة مستخدم" : "تعديل المستخدم",
      sub: isNew ? "اختر الدور أولًا ثم خصّص الصلاحيات إن لزم" : v.name + " · " + v.role,
      size: "lg",
      body: '<div class="stack">' +
        '<div class="form-grid">' +
          HS.ui.field({ name: "name", label: "الاسم الكامل", value: v.name, required: true, attrs: ' data-autofocus autocomplete="name"', placeholder: "مثال: سالم العبيدي" }) +
          HS.ui.field({ name: "username", label: "اسم الدخول", value: v.username, required: true, attrs: ' dir="ltr" autocomplete="username" spellcheck="false"', placeholder: "salem", hint: "حروف إنجليزية صغيرة بلا مسافات" }) +
          HS.ui.field({ name: "phone", label: "رقم الهاتف", value: v.phone || "", attrs: ' dir="ltr" autocomplete="tel" inputmode="tel"', placeholder: "0913000000" }) +
          HS.ui.field({ name: "role", label: "الدور", type: "select", value: v.role, options: ROLES.map(function (r) { return { value: r, label: r }; }), hint: "تغيير الدور يعيد ضبط الصلاحيات" }) +
          HS.ui.field({ name: "status", label: "الحالة", type: "select", value: v.status, options: STATUSES.map(function (s) { return { value: s, label: s }; }) }) +
          '<div class="field span-2">' + HS.ui.field({ name: "active", type: "switch", value: v.active, checkLabel: "الحساب نشط ويمكنه تسجيل الدخول" }) + '</div>' +
        '</div>' +
        '<div>' +
          '<div class="spread" style="margin-block-end:var(--sp-2)"><span class="field__label" style="margin:0">الصلاحيات</span>' +
          '<span class="row-2"><button type="button" class="btn btn--sm btn--ghost" id="permAll">تحديد الكل</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" id="permNone">إلغاء الكل</button>' +
          '<button type="button" class="btn btn--sm btn--ghost" id="permRole">استعادة صلاحيات الدور</button></span></div>' +
          '<div class="perm-grid" id="permGrid">' + HS.data.PERMISSIONS.map(function (p) {
            return '<label class="perm check" for="perm-' + p[0] + '">' +
              '<input type="checkbox" id="perm-' + p[0] + '" data-perm="' + p[0] + '"' + (perms.indexOf(p[0]) >= 0 ? " checked" : "") + '>' +
              '<span class="check__box" aria-hidden="true"></span>' +
              '<span class="check__label">' + HS.esc(p[1]) + '</span></label>';
          }).join("") + '</div>' +
          '<p class="fs-xs text-3" style="margin-block-start:var(--sp-2)" id="permCount"></p>' +
        '</div>' +
        '<div class="alert alert--neutral">' + HS.icon("lock", 16) +
          '<span>كلمة المرور في هذا النظام التجريبي غير مخزّنة: أي كلمة من 4 أحرف فأكثر تكفي للدخول باسم المستخدم أعلاه.</span></div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إلغاء</button>' +
              '<button type="button" class="btn btn--primary" id="usrSave"><span class="btn__icon">' + HS.icon("save", 16) + '</span><span class="btn__label">' + (isNew ? "إضافة المستخدم" : "حفظ التعديلات") + '</span></button>'
    });

    var roleSel = m.body.querySelector('[name="role"]');
    var countEl = m.body.querySelector("#permCount");
    function readPerms() {
      return Array.prototype.slice.call(m.body.querySelectorAll("[data-perm]")).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-perm"); });
    }
    function updCount() {
      var n = readPerms().length;
      countEl.textContent = HS.fmt.int(n) + " من " + HS.fmt.int(HS.data.PERMISSIONS.length) + " صلاحيات محددة";
    }
    function applyRole(r) {
      var set = HS.data.ROLE_PERMS[r] || [];
      m.body.querySelectorAll("[data-perm]").forEach(function (c) { c.checked = set.indexOf(c.getAttribute("data-perm")) >= 0; });
      updCount();
    }
    roleSel.addEventListener("change", function () { applyRole(roleSel.value); });
    m.body.querySelectorAll("[data-perm]").forEach(function (c) { c.addEventListener("change", updCount); });
    m.body.querySelector("#permAll").addEventListener("click", function () { m.body.querySelectorAll("[data-perm]").forEach(function (c) { c.checked = true; }); updCount(); });
    m.body.querySelector("#permNone").addEventListener("click", function () { m.body.querySelectorAll("[data-perm]").forEach(function (c) { c.checked = false; }); updCount(); });
    m.body.querySelector("#permRole").addEventListener("click", function () { applyRole(roleSel.value); });
    updCount();

    m.root.querySelector("#usrSave").addEventListener("click", function () {
      var vals = HS.ui.formValues(m.body);
      HS.ui.clearErrors(m.body);
      var ok = true;
      if (!String(vals.name).trim()) { HS.ui.fieldError(m.body, "name", "الاسم مطلوب"); ok = false; }
      var uname = String(vals.username).trim().toLowerCase().replace(/\s+/g, "");
      if (!/^[a-z0-9._-]{3,20}$/.test(uname)) { HS.ui.fieldError(m.body, "username", "اسم الدخول: 3–20 حرفًا إنجليزيًا صغيرًا أو رقمًا بلا مسافات"); ok = false; }
      var dupU = st.users.filter(function (x) { return (!u || x.id !== u.id) && x.username === uname; })[0];
      if (dupU) { HS.ui.fieldError(m.body, "username", "اسم الدخول مستخدم بالفعل بواسطة " + dupU.name); ok = false; }
      var digits = String(vals.phone).replace(/\D/g, "");
      if (vals.phone && (digits.length < 9 || digits.length > 11)) { HS.ui.fieldError(m.body, "phone", "رقم الهاتف غير مكتمل"); ok = false; }

      var newPerms = readPerms();
      var admins = st.users.filter(function (x) { return x.role === "مدير" && x.active; });
      var losingAdmin = u && u.role === "مدير" && u.active && (vals.role !== "مدير" || !vals.active);
      if (losingAdmin && admins.length <= 1) {
        HS.ui.fieldError(m.body, "role", "لا يمكن تجريد آخر مدير نشط من دوره — أضف مديرًا آخر أولًا.");
        ok = false;
      }
      if (vals.role === "مدير" && newPerms.length < HS.data.PERMISSIONS.length) {
        newPerms = HS.data.PERMISSIONS.map(function (p) { return p[0]; });
      }
      if (!newPerms.length) { HS.ui.toast({ type: "warning", icon: "shield", title: "لم تحدد أي صلاحية", msg: "سيتمكن المستخدم من الدخول لكن بلا أي شاشة." }); }
      if (!ok) { HS.ui.focusFirstError(m.body); return; }

      var res = HS.store.saveUser({
        name: String(vals.name).trim(), username: uname, phone: vals.phone,
        role: vals.role, status: vals.status, active: vals.active, permissions: newPerms
      }, u ? u.id : null);
      if (!res.ok) { HS.ui.toast({ type: "danger", title: "تعذّر الحفظ", msg: res.error }); return; }
      m.close(true);
      HS.ui.toast({ type: "success", icon: isNew ? "plus" : "check", title: (isNew ? "أُضيف المستخدم " : "حُدّث ") + "«" + res.record.name + "»", msg: res.record.role + " · " + HS.fmt.int(newPerms.length) + " صلاحية" });
      HS.router.refresh();
    });
  }

  /* ═══════════ الإجراءات ═══════════ */
  HS.action("usr-new", function () { userForm(null); });
  HS.action("usr-edit", function (btn) {
    HS.ui.closePop();
    var u = HS.store.user(btn.getAttribute("data-id"));
    if (u) userForm(u);
  });
  HS.action("usr-view", function (btn) {
    var u = HS.store.user(btn.getAttribute("data-id"));
    if (!u) return;
    var me = HS.store.currentUser();
    var perms = u.permissions || [];
    HS.ui.modal({
      title: u.name,
      sub: "@" + u.username + " · " + u.role,
      size: "lg",
      body: '<div class="stack">' +
        '<div class="stat-strip">' +
          HS.ui.statMini("الدور", HS.esc(u.role), u.status) +
          HS.ui.statMini("الفواتير", HS.fmt.int(st().sales.filter(function (s) { return s.cashierId === u.id && s.status !== "held"; }).length), "منذ بدء البيانات") +
          HS.ui.statMini("الإيراد المحقق", HS.fmt.money(HS.round(HS.sum(st().sales.filter(function (s) { return s.cashierId === u.id && s.status !== "held" && s.status !== "returned"; }), function (s) { return s.total; }), 3))) +
          HS.ui.statMini("الصلاحيات", HS.fmt.int(perms.length) + " / " + HS.fmt.int(HS.data.PERMISSIONS.length), u.active ? "حساب نشط" : "حساب موقوف") +
        '</div>' +
        HS.ui.kv([
          ["الهاتف", u.phone ? '<a class="ltr" href="tel:' + HS.esc(u.phone) + '">' + HS.esc(HS.ui.phone(u.phone)) + '</a>' : '<span class="text-3">—</span>'],
          ["آخر دخول", u.lastLogin ? HS.fmt.dateTime(u.lastLogin) + " (" + HS.fmt.rel(u.lastLogin) + ")" : "لم يسجّل دخولًا"],
          ["مسجّل منذ", HS.fmt.date(u.createdAt)],
          ["الحالة", HS.ui.badge(u.status, STATUS_TONE[u.status] || "badge--neutral")]
        ]) +
        '<div><span class="field__label">الصلاحيات</span><div class="perm-grid">' +
          HS.data.PERMISSIONS.map(function (p) {
            var has = perms.indexOf(p[0]) >= 0;
            return '<span class="perm perm--static" data-has="' + has + '">' +
              HS.icon(has ? "check-circle" : "x-circle", 15) + '<span>' + HS.esc(p[1]) + '</span></span>';
          }).join("") +
        '</div></div>' +
      '</div>',
      footer: '<button type="button" class="btn btn--ghost" data-modal-close>إغلاق</button><span class="grow"></span>' +
        (me && me.id !== u.id && HS.store.can("users_manage")
          ? '<button type="button" class="btn btn--primary" data-modal-close data-action="usr-edit" data-id="' + u.id + '"><span class="btn__icon">' + HS.icon("pencil", 15) + '</span><span class="btn__label">تعديل</span></button>'
          : (me && me.id === u.id ? '<span class="fs-xs text-3">هذا حسابك الحالي — عدّله من شاشة الإعدادات أو اطلب من مدير آخر.</span>' : ""))
    });
    function st() { return HS.store.state; }
  });
  HS.action("usr-role", function (btn) {
    var role = btn.getAttribute("data-role");
    var perms = HS.data.ROLE_PERMS[role] || [];
    HS.ui.modal({
      title: "صلاحيات دور «" + role + "»",
      sub: HS.fmt.int(perms.length) + " من " + HS.fmt.int(HS.data.PERMISSIONS.length) + " صلاحيات",
      size: "sm",
      body: '<div class="perm-grid">' + HS.data.PERMISSIONS.map(function (p) {
        var has = perms.indexOf(p[0]) >= 0;
        return '<span class="perm perm--static" data-has="' + has + '">' + HS.icon(has ? "check-circle" : "x-circle", 15) + '<span>' + HS.esc(p[1]) + '</span></span>';
      }).join("") + '</div>',
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إغلاق</button>'
    });
  });
  HS.action("usr-menu", function (btn) {
    var u = HS.store.user(btn.getAttribute("data-id"));
    if (!u) return;
    var me = HS.store.currentUser();
    var isMe = me && me.id === u.id;
    HS.ui.pop(btn,
      HS.ui.popItem("عرض الصلاحيات", "eye", "usr-view", { id: u.id }) +
      HS.ui.popItem("تعديل البيانات", "pencil", "usr-edit", { id: u.id }) +
      HS.ui.popItem("فواتير هذا المستخدم", "receipt", "usr-sales", { id: u.id }) +
      '<div class="pop__sep"></div>' +
      HS.ui.popItem(u.active ? "إيقاف الحساب" : "تنشيط الحساب", u.active ? "eye-off" : "eye", "usr-toggle", { id: u.id }) +
      HS.ui.popItem("إعادة تعيين كلمة المرور", "lock", "usr-reset", { id: u.id }) +
      (isMe ? "" : HS.ui.popItem("حذف المستخدم", "trash", "usr-delete", { id: u.id }, "pop__item--danger"))
    );
  });
  HS.action("usr-sales", function (btn) {
    HS.ui.closePop();
    var u = HS.store.user(btn.getAttribute("data-id"));
    if (!u) return;
    var sales = HS.store.state.sales.filter(function (s) { return s.cashierId === u.id && s.status !== "held"; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 40);
    HS.ui.modal({
      title: "فواتير «" + u.name + "»",
      sub: HS.fmt.int(sales.length) + " فاتورة معروضة من الأحدث",
      size: "lg",
      body: sales.length ? '<div class="card" style="box-shadow:none"><div class="card__body card__body--flush">' +
        HS.ui.table([
          { key: "n", label: "الفاتورة", width: "150px", render: function (s) { return '<a href="#/sales/' + s.id + '" class="ltr fw-600">' + HS.esc(s.number) + '</a>'; } },
          { key: "d", label: "التاريخ", width: "132px", render: function (s) { return HS.fmt.date(s.date); } },
          { key: "c", label: "العميل", render: function (s) { return '<span class="truncate">' + HS.esc(s.customerName) + '</span>'; } },
          { key: "t", label: "الإجمالي", align: "num", width: "132px", render: function (s) { return '<span class="fw-600">' + HS.fmt.money(s.total) + '</span>'; } },
          { key: "s", label: "الحالة", align: "center", width: "124px", render: function (s) { return HS.ui.saleStatus(s.status); } }
        ], sales) + '</div></div>'
        : HS.ui.empty({ icon: "receipt", title: "لا فواتير لهذا المستخدم" }),
      footer: '<button type="button" class="btn btn--secondary" data-modal-close>إغلاق</button>'
    });
  });
  HS.action("usr-toggle", function (btn) {
    var id = btn.getAttribute("data-id");
    var u = HS.store.user(id);
    if (!u) return;
    HS.ui.closePop();
    var me = HS.store.currentUser();
    if (me && me.id === id && u.active) {
      HS.ui.toast({ type: "warning", icon: "lock", title: "لا يمكنك إيقاف حسابك الحالي", msg: "أوقف الحساب من مستخدم آخر له صلاحية الإدارة." });
      return;
    }
    if (u.active && u.role === "مدير" && HS.store.state.users.filter(function (x) { return x.role === "مدير" && x.active; }).length <= 1) {
      HS.ui.toast({ type: "warning", icon: "shield", title: "لا يمكن إيقاف آخر مدير نشط", msg: "عيّن مديرًا آخر أولًا حتى لا يفقد النظام إدارة الصلاحيات." });
      return;
    }
    HS.store.saveUser({ active: !u.active }, id);
    HS.ui.toast({
      type: "info", icon: u.active ? "eye" : "eye-off",
      title: (u.active ? "نُشّط حساب " : "أُوقف حساب ") + "«" + u.name + "»",
      msg: u.active ? "يمكنه تسجيل الدخول مجددًا." : "لن يتمكن من تسجيل الدخول.",
      actions: [{ label: "تراجع", onClick: function () { HS.store.saveUser({ active: !u.active }, id); HS.router.refresh(); } }]
    });
    HS.router.refresh();
  });
  HS.action("usr-reset", function (btn) {
    var u = HS.store.user(btn.getAttribute("data-id"));
    HS.ui.closePop();
    if (!u) return;
    var tmp = "hs-" + Math.random().toString(36).slice(2, 8);
    HS.ui.confirm({
      title: "إعادة تعيين كلمة مرور «" + u.name + "»؟",
      tone: "warn", icon: "lock", okLabel: "توليد كلمة مؤقتة",
      html: '<p>هذا النظام تجريبي ولا يخزّن كلمات مرور، لذا ستُولَّد كلمة مؤقتة لعرضها عليك فقط.</p>' +
            '<p class="ltr" style="margin-block-start:var(--sp-3);font-family:var(--font-mono);font-size:var(--fs-lg);text-align:center;background:var(--surface-2);padding:var(--sp-3);border-radius:var(--r-sm)">' + HS.esc(tmp) + '</p>'
    }).then(function (ok) {
      if (!ok) return;
      HS.ui.toast({ type: "success", icon: "lock", title: "كلمة المرور المؤقتة: " + tmp, msg: "سلّمها للمستخدم «" + u.name + "» — لا تُحفظ في أي مكان.", duration: 9000, actions: [{ label: "نسخ", onClick: function () { HS.ui.copy(tmp); } }] });
    });
  });
  HS.action("usr-delete", function (btn) {
    var id = btn.getAttribute("data-id");
    var u = HS.store.user(id);
    if (!u) return;
    HS.ui.closePop();
    var sales = HS.store.state.sales.filter(function (s) { return s.cashierId === id; }).length;
    HS.ui.confirm({
      title: "حذف «" + u.name + "»؟", danger: true, icon: "trash", okLabel: "حذف",
      html: (sales ? '<p>أصدر هذا المستخدم <b>' + HS.fmt.int(sales) + '</b> فاتورة. الحذف لا يمس الفواتير لكن اسم الكاشير سيظهر كـ«غير محدد».</p>'
                   : '<p>لا فواتير مرتبطة بهذا الحساب.</p>') +
        (u.role === "مدير" ? '<p class="text-warning" style="margin-block-start:var(--sp-2)">' + HS.icon("shield", 15) + ' هذا حساب مدير — تأكد من وجود مدير آخر قبل الحذف.</p>' : "")
    }).then(function (ok) {
      if (!ok) return;
      var res = HS.store.deleteUser(id);
      if (!res.ok) { HS.ui.toast({ type: "danger", icon: "lock", title: "تعذّر الحذف", msg: res.error }); return; }
      HS.ui.toast({ type: "success", icon: "trash", title: "حُذف المستخدم «" + u.name + "»", duration: 6000, actions: [{ label: "تراجع", onClick: function () { res.undo(); HS.router.refresh(); } }] });
      HS.router.refresh();
    });
  });
  HS.action("usr-clear", function () {
    var ctx = HS.router.current(); if (!ctx) return;
    ctx.setQuery({ q: null, tab: null, role: null });
  });
})();
