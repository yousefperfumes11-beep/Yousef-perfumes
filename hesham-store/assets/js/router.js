/* ═══════════════════════════════════════════════════════════
   router.js — موجّه عبر التجزئة (#).
   يعمل من file:// مباشرة بلا خادم، ويحفظ الفلاتر والترتيب
   والصفحات في العنوان حتى تعمل المشاركة والتحديث والرجوع.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  var ROUTES = [
    { path: "/",             page: "dashboard",  title: "لوحة التحكم" },
    { path: "/pos",          page: "pos",        title: "نقطة البيع" },
    { path: "/sales",        page: "sales",      title: "المبيعات" },
    { path: "/sales/:id",    page: "invoice",    title: "الفاتورة" },
    { path: "/products",     page: "products",   title: "المنتجات" },
    { path: "/inventory",    page: "inventory",  title: "المخزون" },
    { path: "/barcode",      page: "barcode",    title: "الباركود" },
    { path: "/purchases",    page: "purchases",  title: "المشتريات" },
    { path: "/suppliers",    page: "suppliers",  title: "الموردون" },
    { path: "/customers",    page: "customers",  title: "العملاء والديون" },
    { path: "/cash",         page: "cash",       title: "الصندوق" },
    { path: "/expenses",     page: "expenses",   title: "المصروفات" },
    { path: "/reports",      page: "reports",    title: "التقارير والإحصائيات" },
    { path: "/users",        page: "users",      title: "المستخدمون والصلاحيات" },
    { path: "/settings",     page: "settings",   title: "إعدادات النظام" },
    { path: "/login",        page: "login",      title: "تسجيل الدخول", public: true }
  ];

  var current = null;
  var cleanup = null;
  var suppressHashEvent = false;

  function parse(hash) {
    var raw = String(hash || "").replace(/^#/, "");
    if (!raw) raw = "/";
    var qi = raw.indexOf("?");
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var qs = qi >= 0 ? raw.slice(qi + 1) : "";
    var query = {};
    if (qs) {
      qs.split("&").forEach(function (pair) {
        if (!pair) return;
        var eq = pair.indexOf("=");
        var k = eq >= 0 ? decodeURIComponent(pair.slice(0, eq)) : decodeURIComponent(pair);
        var v = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1).replace(/\+/g, " ")) : "";
        query[k] = v;
      });
    }
    if (path !== "/" && path.charAt(path.length - 1) === "/") path = path.slice(0, -1);
    return { path: path, query: query };
  }

  function match(path) {
    for (var i = 0; i < ROUTES.length; i++) {
      var r = ROUTES[i];
      var rp = r.path.split("/").filter(Boolean);
      var pp = path.split("/").filter(Boolean);
      if (rp.length !== pp.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < rp.length; j++) {
        if (rp[j][0] === ":") params[rp[j].slice(1)] = decodeURIComponent(pp[j]);
        else if (rp[j] !== pp[j]) { ok = false; break; }
      }
      if (ok) return { route: r, params: params };
    }
    return null;
  }

  /**
   * يستبدل العنوان دون إضافة سجل.
   * history.replaceState يرمي SecurityError على صفحات file:// في بعض
   * المتصفحات، لذا نقلبه إلى تعيين location.hash مباشرة — وهو يعمل دائمًا.
   * يُعيد true إن تم الاستبدال بلا حدث hashchange (فنرسم يدويًا).
   */
  function replaceHash(hash) {
    try {
      if (window.history && history.replaceState) {
        suppressHashEvent = true;
        history.replaceState(null, "", hash);
        return true;
      }
    } catch (e) { /* file:// أو سياسة أمان: نتراجع */ }
    suppressHashEvent = false;
    if (location.hash !== hash) location.hash = hash;   /* سيُطلق hashchange فيرسم */
    else HS.router.render();
    return false;
  }

  function buildHash(path, query) {
    var qs = Object.keys(query || {}).filter(function (k) {
      return query[k] != null && query[k] !== "";
    }).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(query[k]); }).join("&");
    return "#" + path + (qs ? "?" + qs : "");
  }

  HS.router = {
    routes: ROUTES,

    start: function () {
      window.addEventListener("hashchange", function () {
        if (suppressHashEvent) { suppressHashEvent = false; return; }
        HS.router.render();
      });
      HS.router.render();
    },

    current: function () { return current; },

    go: function (path, query, opts) {
      var hash = buildHash(path, query);
      if (opts && opts.replace) {
        if (replaceHash(hash)) HS.router.render();
      } else {
        location.hash = hash;
      }
    },

    /** يبني رابطًا مع المحافظة على الاستعلام الحالي */
    href: function (path, query) { return buildHash(path, query); },

    /** يدمج مفاتيح في استعلام المسار الحالي ويعيد الرسم */
    setQuery: function (patch, opts) {
      if (!current) return;
      var q = Object.assign({}, current.query);
      Object.keys(patch || {}).forEach(function (k) {
        var v = patch[k];
        if (v == null || v === "") delete q[k]; else q[k] = v;
      });
      var hash = buildHash(current.path, q);
      if (opts && opts.replace) {
        if (replaceHash(hash)) HS.router.render();
      } else {
        location.hash = hash;
      }
    },

    /** إعادة رسم الصفحة الحالية (بعد تغيير البيانات مثلًا) */
    refresh: function (opts) {
      HS.router.render(opts);
    },

    render: function (opts) {
      opts = opts || {};
      var parsed = parse(location.hash);
      var m = match(parsed.path);

      if (!m) {
        HS.router.go("/", null, { replace: true });
        return;
      }

      /* حارس الدخول */
      var loggedIn = !!(HS.store && HS.store.isLoggedIn() && (!HS.auth || HS.auth.isAuthed()));
      if (!m.route.public && !loggedIn) {
        HS.router.go("/login", { next: parsed.path === "/" ? "" : parsed.path }, { replace: true });
        return;
      }
      if (m.route.page === "login" && loggedIn) {
        HS.router.go("/", null, { replace: true });
        return;
      }

      /* إظهار/إخفاء الهيكل */
      var isLogin = m.route.page === "login";
      HS.$("#authScreen").hidden = !isLogin;
      HS.$("#app").hidden = isLogin;
      if (isLogin) { document.title = "تسجيل الدخول · " + HS.STORE_NAME; }

      var mod = HS.pages[m.route.page];
      if (!mod) { HS.router.go("/", null, { replace: true }); return; }

      /* تنظيف الصفحة السابقة */
      if (typeof cleanup === "function") { try { cleanup(); } catch (e) {} }
      cleanup = null;

      current = {
        route: m.route,
        page: m.route.page,
        path: parsed.path,
        params: m.params,
        query: parsed.query,
        setQuery: function (patch, o) { HS.router.setQuery(patch, o); },
        title: m.route.title
      };

      /* إن كان المستخدم يكتب في حقل بحث، نحتفظ بموضعه بعد إعادة الرسم */
      var typing = null;
      var act = document.activeElement;
      if (act && act.hasAttribute && act.hasAttribute("data-search-input")) {
        typing = { value: act.value, start: act.selectionStart, end: act.selectionEnd };
      }

      var root = HS.$("#main");
      if (!isLogin) {
        root.innerHTML = "";
        root.scrollTop = 0;
        if (!typing) window.scrollTo({ top: 0, behavior: "auto" });
      }

      var ctx = current;
      var result;
      try {
        result = typeof mod === "function" ? mod(root, ctx) : mod.render(root, ctx);
      } catch (err) {
        console.error("[HS] فشل رسم الصفحة", m.route.page, err);
        root.innerHTML = HS.ui.empty({
          icon: "alert",
          title: "تعذّر عرض هذه الصفحة",
          text: String(err && err.message ? err.message : err),
          action: '<button type="button" class="btn btn--secondary" onclick="location.hash=\'#/\'">العودة إلى لوحة التحكم</button>'
        });
        return;
      }

      if (result && typeof result.unmount === "function") cleanup = result.unmount;
      if (result && typeof result === "function") cleanup = result;

      HS.icons.hydrate(document);

      /* إعادة التركيز وموضع المؤشر إلى حقل البحث الذي كان يكتب فيه المستخدم */
      if (typing) {
        var again = HS.$("[data-search-input]");
        if (again) {
          if (again.value !== typing.value) again.value = typing.value;
          again.focus();
          try { again.setSelectionRange(typing.start, typing.end); } catch (e) {}
        }
      }

      HS.bus.emit("route:render", ctx);

      /* تحديث التنقل النشط */
      HS.$$(".nav__link").forEach(function (a) {
        var href = a.getAttribute("href") || "";
        var base = href.split("?")[0];
        var active = base === "#" + parsed.path ||
          (base !== "#/" && parsed.path.indexOf(base.slice(1)) === 0);
        if (active) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
      });

      /* حفظ آخر مسار للعودة بعد الدخول */
      if (!isLogin && HS.store) HS.store.ui.set({ lastRoute: location.hash });
    },

    /** قراءة حالة الفرز/الترقيم من الاستعلام بشكل موحّد */
    listState: function (ctx, defaults) {
      var d = defaults || {};
      return {
        q: ctx.query.q || "",
        page: Math.max(1, parseInt(ctx.query.page, 10) || 1),
        per: parseInt(ctx.query.per, 10) || d.per || 12,
        sort: ctx.query.sort || d.sort || "",
        dir: ctx.query.dir === "asc" ? "asc" : "desc"
      };
    }
  };
})();
