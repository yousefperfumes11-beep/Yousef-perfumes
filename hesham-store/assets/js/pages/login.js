/* ═══════════════════════════════════════════════════════════
   pages/login.js — إنشاء الحساب الوحيد (أول مرة) ثم تسجيل الدخول
   الوضع يُحدَّد من قاعدة البيانات: إن لم يوجد حساب تظهر شاشة الإنشاء،
   وإن وُجد تظهر شاشة الدخول فقط، ولا يمكن إنشاء حساب آخر.
   في وضع التطوير (HS_DEV_NO_AUTH) يبقى الدخول التجريبي المحلي.
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
    var nameInp = HS.$("#signupName");
    var pass2Inp = HS.$("#signupPass2");
    var alert = HS.$("#loginAlert");
    var submit = HS.$("#loginSubmit");
    var toggle = HS.$("#togglePass");
    var caps = HS.$("#capsHint");
    var title = HS.$("#authTitle");
    var sub = HS.$("#authSub");
    var demoBox = HS.$("#authDemo");
    var rowBox = HS.$(".auth__row");
    var note = HS.$("#authNote");
    var signupFields = HS.$$("[data-mode='signup']");
    var userLabel = HS.$("label[for='loginUser']");
    var dev = HS.auth.dev;
    var mode = dev ? "demo" : "loading";

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

    var nameEl = HS.$(".auth__name");
    if (nameEl) nameEl.textContent = st.settings.storeName || HS.STORE_NAME;

    function fail(msg, focusPass) {
      alert.hidden = false;
      alert.innerHTML = HS.icon("alert", 16) + "<span>" + HS.esc(msg) + "</span>";
      if (focusPass !== false && mode !== "error") { passInp.focus(); passInp.select(); }
    }
    function clearFail() { alert.hidden = true; alert.textContent = ""; }
    function clearFieldErrors() {
      ["loginUser", "loginPass", "signupName", "signupPass2"].forEach(function (n) {
        HS.ui.fieldError(form, n, null);
      });
    }
    function busy(v) {
      if (v) submit.setAttribute("data-loading", "true"); else submit.removeAttribute("data-loading");
      submit.disabled = !!v;
    }
    function setLabel(t) {
      var l = submit.querySelector(".btn__label");
      if (l) l.textContent = t;
    }

    /* ─── ضبط الشاشة حسب الوضع ─── */
    function applyMode(m) {
      mode = m;
      var signup = m === "signup";
      signupFields.forEach(function (f) { f.hidden = !signup; });
      if (demoBox) demoBox.hidden = !dev;
      if (rowBox) rowBox.hidden = !dev;
      if (note) note.hidden = true;

      if (dev) return;

      userInp.type = "email";
      userInp.placeholder = "name@example.com";
      userInp.setAttribute("autocomplete", "email");
      if (userLabel) userLabel.textContent = "البريد الإلكتروني";
      passInp.setAttribute("autocomplete", signup ? "new-password" : "current-password");

      if (m === "signup") {
        title.textContent = "إنشاء حساب المدير";
        sub.textContent = "هذا الحساب هو الوحيد المسموح به في الموقع، ولن يمكن إنشاء حساب آخر بعده.";
        setLabel("إنشاء الحساب");
        submit.disabled = false;
        if (note) {
          note.hidden = false;
          note.textContent = "احتفظ ببريدك وكلمة مرورك في مكان آمن. كلمة المرور 8 أحرف على الأقل.";
        }
        setTimeout(function () { nameInp.focus(); }, 60);
      } else if (m === "login") {
        title.textContent = "تسجيل الدخول";
        sub.textContent = "أدخل بريدك وكلمة مرورك للوصول إلى لوحة التحكم.";
        setLabel("دخول");
        submit.disabled = false;
        setTimeout(function () { userInp.focus(); }, 60);
      } else if (m === "loading") {
        title.textContent = "جارٍ التحضير…";
        sub.textContent = "لحظة من فضلك.";
        setLabel("دخول");
        submit.disabled = true;
      } else if (m === "error") {
        title.textContent = "تعذّر الاتصال";
        sub.textContent = "لا يمكن تحديد حالة الموقع الآن.";
        setLabel("إعادة المحاولة");
        submit.disabled = false;
      }
    }

    function detect() {
      applyMode("loading");
      clearFail();
      HS.auth.ownerExists().then(function (r) {
        if (!r.ok) { applyMode("error"); fail(r.error, false); return; }
        applyMode(r.exists ? "login" : "signup");
      });
    }

    function enter(msg) {
      HS.auth.bindLocal();
      var u = HS.store.currentUser();
      passInp.value = ""; if (pass2Inp) pass2Inp.value = "";
      HS.ui.toast({
        type: "success", icon: "check-circle",
        title: "أهلًا " + (u ? u.name.split(" ")[0] : ""),
        msg: msg
      });
      var next = (ctx.query && ctx.query.next) || "";
      var target = next && next.charAt(0) === "/" ? next : "/";
      HS.router.go(target, null, { replace: true });
    }

    /* ─── الدخول التجريبي المحلي (للتطوير والفحص فقط) ─── */
    function demoSubmit() {
      var u = userInp.value.trim(), p = passInp.value;
      var bad = false;
      if (!u) { HS.ui.fieldError(form, "loginUser", "اسم المستخدم مطلوب"); bad = true; }
      if (!p) { HS.ui.fieldError(form, "loginPass", "كلمة المرور مطلوبة"); bad = true; }
      if (bad) { HS.ui.focusFirstError(form); return; }
      busy(true);
      HS.sleep(520).then(function () {
        var res = HS.store.login(u, p);
        busy(false);
        if (!res.ok) { fail(res.error); return; }
        passInp.value = "";
        HS.ui.toast({
          type: "success", icon: "check-circle", title: "أهلًا " + res.user.name,
          msg: "تم تسجيل الدخول كـ" + res.user.role + ". البيانات المعروضة تجريبية."
        });
        var next = (ctx.query && ctx.query.next) || "";
        HS.router.go(next && next.charAt(0) === "/" ? next : "/", null, { replace: true });
      });
    }

    function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }

    function doSubmit(ev) {
      if (ev) ev.preventDefault();
      clearFail();
      clearFieldErrors();

      if (mode === "demo") { demoSubmit(); return; }
      if (mode === "error") { detect(); return; }
      if (mode === "loading") return;

      var email = userInp.value.trim().toLowerCase();
      var pass = passInp.value;
      var bad = false;

      if (!email) { HS.ui.fieldError(form, "loginUser", "البريد الإلكتروني مطلوب"); bad = true; }
      else if (!validEmail(email)) { HS.ui.fieldError(form, "loginUser", "صيغة البريد غير صحيحة"); bad = true; }
      if (!pass) { HS.ui.fieldError(form, "loginPass", "كلمة المرور مطلوبة"); bad = true; }

      if (mode === "signup") {
        var fullName = nameInp.value.trim();
        if (fullName.length < 2) { HS.ui.fieldError(form, "signupName", "الاسم الكامل مطلوب"); bad = true; }
        if (pass && pass.length < 8) { HS.ui.fieldError(form, "loginPass", "كلمة المرور 8 أحرف على الأقل"); bad = true; }
        if (pass && pass2Inp.value !== pass) { HS.ui.fieldError(form, "signupPass2", "كلمتا المرور غير متطابقتين"); bad = true; }
        if (bad) { HS.ui.focusFirstError(form); return; }

        busy(true);
        HS.auth.signUp(email, pass, fullName).then(function (r) {
          busy(false);
          if (!r.ok) {
            if (r.exists) { applyMode("login"); }
            fail(r.error, false);
            return;
          }
          if (r.needsConfirm) {
            applyMode("login");
            HS.ui.toast({
              type: "info", icon: "info", title: "أُنشئ الحساب",
              msg: "أرسلنا رسالة تأكيد إلى بريدك. أكّده ثم سجّل الدخول.", duration: 9000
            });
            return;
          }
          enter("أُنشئ حساب المدير وتم تسجيل دخولك. هذا الحساب الوحيد في الموقع.");
        });
        return;
      }

      if (bad) { HS.ui.focusFirstError(form); return; }
      busy(true);
      HS.auth.signIn(email, pass).then(function (r) {
        busy(false);
        if (!r.ok) { fail(r.error); return; }
        enter("تم تسجيل الدخول بنجاح.");
      });
    }

    on(form, "submit", doSubmit);

    on(toggle, "click", function () {
      var show = passInp.type === "password";
      passInp.type = show ? "text" : "password";
      if (pass2Inp) pass2Inp.type = show ? "text" : "password";
      toggle.setAttribute("data-icon", show ? "eye-off" : "eye");
      toggle.setAttribute("aria-label", show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور");
      toggle.setAttribute("aria-pressed", show ? "true" : "false");
      HS.icons.hydrate(toggle);
      passInp.focus();
    });

    function capsCheck(ev) {
      if (typeof ev.getModifierState !== "function") return;
      caps.hidden = !ev.getModifierState("CapsLock");
    }
    on(passInp, "keyup", capsCheck);
    on(passInp, "keydown", capsCheck);
    on(passInp, "blur", function () { caps.hidden = true; });

    HS.$$(".auth__quick [data-user]").forEach(function (b) {
      on(b, "click", function () {
        userInp.value = b.getAttribute("data-user");
        passInp.value = "1234";
        clearFail();
        passInp.focus();
      });
    });

    if (dev) {
      applyMode("demo");
      setTimeout(function () { userInp.focus(); }, 60);
    } else {
      detect();
    }

    return {
      unmount: function () {
        handlers.forEach(function (h) { h[0].removeEventListener(h[1], h[2]); });
        handlers = [];
        clearFail();
      }
    };
  };
})();
