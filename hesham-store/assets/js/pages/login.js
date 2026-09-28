/* ═══════════════════════════════════════════════════════════
   pages/login.js — شاشة الدخول (واجهة فقط، بلا تحقق حقيقي)
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  HS.pages = HS.pages || {};

  var handlers = [];
  function on(el, evt, fn) { if (el) { el.addEventListener(evt, fn); handlers.push([el, evt, fn]); } }

  HS.pages.login = function (root, ctx) {
    var form = HS.$("#loginForm");
    var userInp = HS.$("#loginUser");
    var passInp = HS.$("#loginPass");
    var alert = HS.$("#loginAlert");
    var submit = HS.$("#loginSubmit");
    var toggle = HS.$("#togglePass");
    var caps = HS.$("#capsHint");

    /* أرقام لوحة العلامة تُقرأ من البيانات الفعلية، لا تُخترَع */
    var st = HS.store.state;
    var pts = HS.$$(".auth__pointNum");
    var lbls = HS.$$(".auth__pointLbl");
    var today = HS.store.range("today");
    var todayCount = HS.store.salesOf(today).filter(function (s) { return s.status !== "held"; }).length;
    if (pts[0]) pts[0].textContent = HS.fmt.int(st.products.length);
    if (lbls[0]) lbls[0].textContent = "صنفًا في المخزون";
    if (pts[1]) pts[1].textContent = HS.fmt.int(todayCount);
    if (lbls[1]) lbls[1].textContent = "فاتورة اليوم";
    if (pts[2]) pts[2].textContent = HS.fmt.int(st.customers.length);
    if (lbls[2]) lbls[2].textContent = "عميلًا مسجّلًا";

    /* اسم المحل من الإعدادات */
    var nameEl = HS.$(".auth__name");
    if (nameEl) nameEl.textContent = st.settings.storeName || HS.STORE_NAME;

    function fail(msg) {
      alert.hidden = false;
      alert.innerHTML = HS.icon("alert", 16) + "<span>" + HS.esc(msg) + "</span>";
      passInp.focus();
      passInp.select();
    }
    function clearFail() { alert.hidden = true; alert.textContent = ""; }

    function doSubmit(ev) {
      if (ev) ev.preventDefault();
      clearFail();
      HS.ui.fieldError(form, "loginUser", null);
      HS.ui.fieldError(form, "loginPass", null);

      var u = userInp.value.trim();
      var p = passInp.value;

      var bad = false;
      if (!u) { HS.ui.fieldError(form, "loginUser", "اسم المستخدم مطلوب"); bad = true; }
      if (!p) { HS.ui.fieldError(form, "loginPass", "كلمة المرور مطلوبة"); bad = true; }
      if (bad) { HS.ui.focusFirstError(form); return; }

      submit.setAttribute("data-loading", "true");
      submit.disabled = true;

      /* تأخير قصير لإظهار حالة التحميل، بحد أدنى للظهور حتى لا يومض */
      HS.sleep(520).then(function () {
        var res = HS.store.login(u, p);
        submit.removeAttribute("data-loading");
        submit.disabled = false;
        if (!res.ok) {
          fail(res.error);
          return;
        }
        passInp.value = "";
        HS.ui.toast({
          type: "success", icon: "check-circle",
          title: "أهلًا " + res.user.name,
          msg: "تم تسجيل الدخول كـ" + res.user.role + ". البيانات المعروضة تجريبية."
        });
        var next = (ctx.query && ctx.query.next) || "";
        var target = next && next.charAt(0) === "/" ? next : "/";
        HS.router.go(target, null, { replace: true });
      });
    }

    on(form, "submit", doSubmit);

    on(toggle, "click", function () {
      var show = passInp.type === "password";
      passInp.type = show ? "text" : "password";
      toggle.setAttribute("data-icon", show ? "eye-off" : "eye");
      toggle.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      toggle.setAttribute("aria-pressed", show ? "true" : "false");
      HS.icons.hydrate(toggle);
      passInp.focus();
    });

    /* تنبيه Caps Lock */
    function capsCheck(ev) {
      if (typeof ev.getModifierState !== "function") return;
      caps.hidden = !ev.getModifierState("CapsLock");
    }
    on(passInp, "keyup", capsCheck);
    on(passInp, "keydown", capsCheck);
    on(passInp, "blur", function () { caps.hidden = true; });

    /* أزرار المستخدمين للتعبئة السريعة */
    var quick = HS.$$(".auth__quick [data-user]");
    quick.forEach(function (b) {
      on(b, "click", function () {
        userInp.value = b.getAttribute("data-user");
        passInp.value = "1234";
        clearFail();
        passInp.focus();
      });
    });

    setTimeout(function () { userInp.focus(); }, 60);

    return {
      unmount: function () {
        handlers.forEach(function (h) { h[0].removeEventListener(h[1], h[2]); });
        handlers = [];
        clearFail();
      }
    };
  };
})();
