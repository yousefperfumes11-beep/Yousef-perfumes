/* ═══════════════════════════════════════════════════════════
   auth.js — الدخول الحقيقي عبر Supabase Auth (بلا مكتبات)
   الموقع يعتمد حسابًا واحدًا فقط: أول حساب يُنشأ يصبح المدير،
   وبعده تُرفض أي محاولة لإنشاء حساب آخر (القفل في قاعدة البيانات
   نفسها: trigger على auth.users، فلا يُتجاوز من الواجهة).
   وضع التطوير: window.HS_DEV_NO_AUTH = true يعيد الدخول التجريبي
   المحلي (تستعمله أدوات الفحص في tools/ فقط).
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS = window.HS || {};
  var cfg = window.HS_CONFIG || {};
  var KEY = "hs-auth-v1";
  var dev = !!window.HS_DEV_NO_AUTH;
  var session = null;
  var timer = null;

  function load() {
    try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { session = null; }
  }
  function persist() {
    try {
      if (session) localStorage.setItem(KEY, JSON.stringify(session));
      else localStorage.removeItem(KEY);
    } catch (e) { /* التخزين غير متاح: تبقى الجلسة في الذاكرة فقط */ }
  }
  function now() { return Math.floor(Date.now() / 1000); }
  function configured() { return !!(cfg.supabaseUrl && cfg.supabaseKey); }

  function call(method, path, body, token) {
    if (!configured()) {
      return Promise.resolve({ ok: false, status: 0, data: null, notConfigured: true });
    }
    var headers = {
      "apikey": cfg.supabaseKey,
      "Content-Type": "application/json",
      "Authorization": "Bearer " + (token || cfg.supabaseKey)
    };
    return fetch(cfg.supabaseUrl + path, {
      method: method, headers: headers, body: body ? JSON.stringify(body) : undefined
    }).then(function (res) {
      return res.text().then(function (txt) {
        var data = null;
        try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = null; }
        return { ok: res.ok, status: res.status, data: data };
      });
    }).catch(function () {
      return { ok: false, status: 0, data: null, network: true };
    });
  }

  var SINGLE_MSG = "هذا الموقع يقبل حسابًا واحدًا فقط ولا يمكن إنشاء حساب آخر";

  function arError(r) {
    if (r.notConfigured) return "لم يُضبط مفتاح Supabase بعد. ضعه في assets/js/config.js";
    if (r.network) return "تعذّر الاتصال بالخادم، تحقق من الإنترنت وحاول مرة أخرى";
    var d = r.data || {};
    var code = String(d.error_code || d.code || "");
    var msg = String(d.msg || d.message || d.error_description || d.error || "");
    if (/SINGLE_ACCOUNT/i.test(msg) || code === "user_already_exists" || /already registered/i.test(msg)) return SINGLE_MSG;
    if (code === "invalid_credentials" || /invalid login credentials/i.test(msg)) return "البريد الإلكتروني أو كلمة المرور غير صحيحة";
    if (code === "email_not_confirmed" || /not confirmed/i.test(msg)) return "أكّد بريدك الإلكتروني أولًا من الرسالة المرسلة إليك ثم سجّل الدخول";
    if (code === "weak_password" || /password/i.test(msg) && /(short|least|weak)/i.test(msg)) return "كلمة المرور ضعيفة، استعمل 8 أحرف على الأقل";
    if (code === "email_address_invalid" || /invalid.*email|email.*invalid/i.test(msg)) return "البريد الإلكتروني غير صالح";
    if (code === "signup_disabled" || /signups? (not allowed|disabled)/i.test(msg)) return "التسجيل مغلق في إعدادات Supabase";
    if (r.status === 429 || /rate limit/i.test(code + msg)) return "محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة";
    if (/database error saving new user/i.test(msg)) return SINGLE_MSG;
    return "تعذّر إتمام العملية" + (msg ? " (" + msg + ")" : "");
  }

  function setSession(d) {
    session = {
      access_token: d.access_token,
      refresh_token: d.refresh_token,
      expires_at: d.expires_at || (now() + (d.expires_in || 3600)),
      user: d.user || (session && session.user) || null
    };
    persist();
    schedule();
  }

  function schedule() {
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (session && session.expires_at - now() < 600) HS.auth.refresh();
    }, 60000);
  }

  HS.auth = {
    dev: dev,
    configured: configured,

    /** هل يوجد حساب مسجّل؟ يحدد هل تظهر شاشة الإنشاء أم الدخول */
    ownerExists: function () {
      return call("POST", "/rest/v1/rpc/owner_exists", {}).then(function (r) {
        if (!r.ok) return { ok: false, error: arError(r) };
        return { ok: true, exists: r.data === true };
      });
    },

    signUp: function (email, password, fullName) {
      return HS.auth.ownerExists().then(function (o) {
        if (!o.ok) return o;
        if (o.exists) return { ok: false, error: SINGLE_MSG, exists: true };
        return call("POST", "/auth/v1/signup", {
          email: email, password: password, data: { full_name: fullName }
        }).then(function (r) {
          if (!r.ok) return { ok: false, error: arError(r) };
          var d = r.data || {};
          if (d.access_token) { setSession(d); return { ok: true, session: true }; }
          return { ok: true, session: false, needsConfirm: true };
        });
      });
    },

    signIn: function (email, password) {
      return call("POST", "/auth/v1/token?grant_type=password", { email: email, password: password })
        .then(function (r) {
          if (!r.ok) return { ok: false, error: arError(r) };
          setSession(r.data);
          return { ok: true };
        });
    },

    refresh: function () {
      if (!session || !session.refresh_token) return Promise.resolve(false);
      return call("POST", "/auth/v1/token?grant_type=refresh_token", { refresh_token: session.refresh_token })
        .then(function (r) {
          if (r.ok) { setSession(r.data); return true; }
          if (r.status === 400 || r.status === 401 || r.status === 403) {
            session = null; persist();
            if (HS.store && HS.store.isLoggedIn()) {
              HS.store.logout();
              if (HS.router) HS.router.go("/login", null, { replace: true });
            }
          }
          return false;
        });
    },

    signOut: function () {
      var tok = session && session.access_token;
      session = null; persist();
      if (timer) { clearInterval(timer); timer = null; }
      if (!tok) return Promise.resolve();
      return call("POST", "/auth/v1/logout", null, tok).then(function () {});
    },

    /** استعادة الجلسة عند فتح الصفحة والتأكد أنها ما زالت صالحة */
    restore: function () {
      if (dev) return Promise.resolve(true);
      load();
      if (!session || !session.access_token) return Promise.resolve(false);
      var step = session.expires_at - now() < 60 ? HS.auth.refresh() : Promise.resolve(true);
      return step.then(function (ok) {
        if (!ok || !session) return false;
        return call("GET", "/auth/v1/user", null, session.access_token).then(function (r) {
          if (r.network) { schedule(); return true; }     /* بلا إنترنت: أبقِ الجلسة */
          if (!r.ok) { session = null; persist(); return false; }
          session.user = r.data;
          persist(); schedule();
          return true;
        });
      });
    },

    isAuthed: function () { return dev || !!(session && session.access_token); },
    user: function () { return session ? session.user : null; },

    /** يربط حساب Supabase الوحيد بمستخدم المتجر المحلي ويفتح الجلسة */
    bindLocal: function () {
      var u = session && session.user;
      if (!u || !HS.store || !HS.store.openSession) return null;
      var meta = u.user_metadata || {};
      return HS.store.openSession({ email: u.email, name: meta.full_name });
    },

    /** يُستدعى من الإقلاع: يستعيد الجلسة ثم يشغّل الواجهة */
    init: function (done) {
      HS.auth.restore().then(function (ok) {
        if (dev) { done(); return; }
        if (ok) HS.auth.bindLocal();
        else if (HS.store && HS.store.isLoggedIn()) HS.store.logout();
        done();
      }, function () { done(); });
    }
  };
})();
