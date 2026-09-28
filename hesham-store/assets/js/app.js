/* ═══════════════════════════════════════════════════════════
   app.js — الإقلاع: الشريط الجانبي، الشريط العلوي، المظهر،
   التنبيهات، البحث السريع، اختصارات لوحة المفاتيح، والساعة.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  /* ─────────── خريطة التنقل ─────────── */
  var NAV = [
    {
      label: "الرئيسية", items: [
        { href: "#/", label: "لوحة التحكم", icon: "dashboard", page: "dashboard" },
        { href: "#/pos", label: "نقطة البيع", icon: "cart", page: "pos", shortcut: "F2" }
      ]
    },
    {
      label: "المبيعات والأموال", items: [
        { href: "#/sales", label: "سجل المبيعات", icon: "receipt", page: "sales", badge: "unpaid" },
        { href: "#/cash", label: "الصندوق", icon: "cash", page: "cash" },
        { href: "#/customers", label: "العملاء والديون", icon: "users", page: "customers", badge: "debt" },
        { href: "#/expenses", label: "المصروفات", icon: "wallet", page: "expenses" }
      ]
    },
    {
      label: "المخزون", items: [
        { href: "#/products", label: "العطور والمنتجات", icon: "box", page: "products" },
        { href: "#/inventory", label: "حركات المخزون", icon: "layers", page: "inventory", badge: "stock" },
        { href: "#/barcode", label: "الباركود والملصقات", icon: "barcode", page: "barcode" },
        { href: "#/purchases", label: "المشتريات", icon: "bag", page: "purchases" },
        { href: "#/suppliers", label: "الموردون", icon: "truck", page: "suppliers" }
      ]
    },
    {
      label: "التقارير والنظام", items: [
        { href: "#/reports", label: "التقارير والإحصائيات", icon: "bar-chart", page: "reports" },
        { href: "#/users", label: "المستخدمون والصلاحيات", icon: "user-cog", page: "users" },
        { href: "#/settings", label: "إعدادات النظام", icon: "settings", page: "settings" }
      ]
    }
  ];

  /* ─────────── المظهر ─────────── */
  function applyTheme(theme) {
    var t = theme || HS.store.state.settings.theme || "light";
    document.documentElement.setAttribute("data-theme", t);
    var meta = HS.$("#metaThemeColor");
    if (meta) meta.setAttribute("content", t === "dark" ? "#12161a" : "#f5f4f0");
    var btn = HS.$("#themeBtn");
    if (btn) {
      btn.setAttribute("data-icon", t === "dark" ? "sun" : "moon");
      btn.setAttribute("aria-label", t === "dark" ? "التبديل إلى المظهر الفاتح" : "التبديل إلى المظهر الداكن");
      btn.setAttribute("title", t === "dark" ? "المظهر الفاتح (T)" : "المظهر الداكن (T)");
      HS.icons.hydrate(btn);
    }
  }
  function applyDensity(d) {
    document.documentElement.setAttribute("data-density", d === "compact" ? "compact" : "cozy");
  }
  function applyAccent(a) {
    document.documentElement.setAttribute("data-accent", a || "emerald");
  }
  /** اسم المحل في كل مواضعه: العنوان والشريط الجانبي وشاشة الدخول */
  function renderBrand() {
    var s = HS.store.state.settings;
    var name = s.storeName || HS.STORE_NAME;
    HS.STORE_NAME = name;
    document.title = name;
    var mark = (name.replace(/[^\u0600-\u06FF\w]/g, "") || "ه")[0];
    [[".brand__name", name], [".brand__mark", mark], [".auth__name", name]].forEach(function (pair) {
      HS.$$(pair[0]).forEach(function (el) { if (el.textContent !== pair[1]) el.textContent = pair[1]; });
    });
    var sub = HS.$(".brand__sub");
    if (sub && s.branch) sub.textContent = s.branch;
    HS.$$(".auth__brandMark").forEach(function (el) { el.textContent = mark; });
    var logo = HS.$("#authScreen .auth__mark");
    if (logo) logo.textContent = mark;
    var branchEl = HS.$(".auth__tag");
    if (branchEl) {
      branchEl.textContent = [s.branch, s.activity || "عطور أصلية · ماركات عالمية وشرقية"]
        .filter(Boolean).join(" · ");
    }
  }

  /** الحركات: إعداد يدوي فوق تفضيل النظام */
  function applyMotion(on) {
    document.body.setAttribute("data-motion", on === false ? "off" : "on");
  }

  HS.app = {};
  HS.app.applyTheme = applyTheme;
  HS.app.applyDensity = applyDensity;
  HS.app.applyAccent = applyAccent;
  HS.app.renderBrand = renderBrand;
  HS.app.applyMotion = applyMotion;

  /* ─────────── الشريط الجانبي ─────────── */
  function renderNav() {
    var nav = HS.$("#nav");
    var st = HS.store.state;
    var unpaid = st.sales.filter(function (s) { return s.status === "unpaid" || s.status === "partial"; }).length;
    var stockAlerts = HS.store.stockAlertCount();
    var debtors = st.customers.filter(function (c) { return (c.balance || 0) > 0.001; }).length;

    nav.innerHTML = NAV.map(function (g) {
      return '<div class="nav__group"><div class="nav__label" id="navg-' + HS.esc(g.label.replace(/\s/g, "")) + '">' + HS.esc(g.label) + '</div>' +
        '<ul role="list" aria-labelledby="navg-' + HS.esc(g.label.replace(/\s/g, "")) + '">' +
        g.items.map(function (it) {
          var badge = "";
          if (it.badge === "unpaid" && unpaid) badge = '<span class="nav__badge">' + HS.fmt.int(unpaid) + '</span>';
          if (it.badge === "stock" && stockAlerts) badge = '<span class="nav__badge">' + HS.fmt.int(stockAlerts) + '</span>';
          if (it.badge === "debt" && debtors) badge = '<span class="nav__badge">' + HS.fmt.int(debtors) + '</span>';
          return '<li><a class="nav__link" href="' + it.href + '" data-page="' + it.page + '">' +
            '<span class="nav__icon">' + HS.icon(it.icon, 19) + '</span>' +
            '<span class="nav__text">' + HS.esc(it.label) + '</span>' + badge + '</a></li>';
        }).join("") + '</ul></div>';
    }).join("");
  }

  function renderStockAlert() {
    var el = HS.$("#stockAlert");
    var n = HS.store.stockAlertCount();
    if (!n) { el.innerHTML = ""; el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<span>' + HS.icon("alert", 16) + '</span>' +
      '<span class="grow"><span class="stock-alert__n">' + HS.fmt.int(n) + '</span> صنفًا يحتاج إعادة طلب</span>' +
      '<span>' + HS.icon("chevron-left", 14) + '</span>';
    el.onclick = function () { location.hash = "#/inventory?tab=alerts"; };
  }

  function renderUser() {
    var u = HS.store.currentUser();
    if (!u) return;
    HS.$("#userName").textContent = u.name;
    HS.$("#userRole").textContent = u.role;
    HS.$("#userAvatar").textContent = (u.name.split(/\s+/)[0] || "ه")[0];
  }

  /* ─────────── الشريط العلوي ─────────── */
  function renderPeriodSeg() {
    var seg = HS.$("#periodSeg");
    var cur = HS.store.state.ui.period || "30d";
    seg.innerHTML = HS.store.periods.slice(1, 4).map(function (p) {
      return '<button type="button" class="seg__btn" data-action="period" data-period="' + p.id + '" aria-pressed="' + (p.id === cur) + '">' + HS.esc(p.name) + '</button>';
    }).join("");
  }

  function bellHTML() {
    var notes = HS.store.notifications();
    return '<div class="pop__head">التنبيهات (' + HS.fmt.int(notes.length) + ')</div>' +
      (notes.length ? notes.map(function (n) {
        var color = n.level === "danger" ? "var(--danger-text)" : n.level === "warning" ? "var(--warning-text)" : "var(--info-text)";
        return '<button type="button" class="pop__item" data-action="goto" data-href="' + HS.esc(n.route || "#/") + '" style="align-items:flex-start">' +
          '<span style="color:' + color + ';margin-block-start:2px">' + HS.icon(n.icon, 16) + '</span>' +
          '<span class="grow" style="min-width:0">' +
            '<span class="fw-600 fs-sm" style="display:block">' + HS.esc(n.title) + '</span>' +
            '<span class="fs-xs text-3 clamp-2" style="display:block">' + HS.esc(n.msg) + '</span>' +
          '</span></button>';
      }).join("") : '<div class="empty" style="padding:var(--sp-6)"><span class="empty__icon">' + HS.icon("check-circle", 24) + '</span><span class="empty__title">لا توجد تنبيهات</span></div>');
  }

  function renderBell() {
    var dot = HS.$("#bellDot");
    if (dot) dot.hidden = HS.store.notifications().length === 0;
  }

  function renderClock() {
    var el = HS.$("#clock");
    if (!el) return;
    var now = new Date();
    el.textContent = HS.fmt.weekday(now) + " · " + HS.fmt.date(now) + " · " + HS.fmt.time(now);
  }

  /* ─────────── البحث السريع ─────────── */
  function searchAll(q) {
    q = String(q || "").trim();
    if (!q) return [];
    var st = HS.store.state;
    var out = { products: [], customers: [], sales: [] };

    st.products.forEach(function (p) {
      if (out.products.length >= 6) return;
      if (HS.matches(p.name + " " + (p.brand || "") + " " + (p.size || "") + " " + (p.barcode || "") + " " +
                    (p.sku || "") + " " + HS.store.cat(p.category).name, q)) out.products.push(p);
    });
    st.customers.forEach(function (c) {
      if (out.customers.length >= 4) return;
      if (HS.matches(c.name + " " + c.phone + " " + c.city, q)) out.customers.push(c);
    });
    st.sales.forEach(function (s) {
      if (out.sales.length >= 4) return;
      if (HS.matches(s.number + " " + s.customerName, q)) out.sales.push(s);
    });
    return out;
  }

  function renderSearch(q) {
    var box = HS.$("#searchResults");
    q = String(q || "").trim();
    if (!q) { box.hidden = true; box.innerHTML = ""; return; }
    var r = searchAll(q);
    var total = r.products.length + r.customers.length + r.sales.length;
    if (!total) {
      box.hidden = false;
      box.innerHTML = '<div class="search-empty">لا نتائج لـ «' + HS.esc(q) + '»</div>';
      return;
    }
    var html = "";
    if (r.products.length) {
      html += '<div class="search-results__group">المنتجات</div>' + r.products.map(function (p) {
        return '<button type="button" class="search-item" data-action="goto" data-href="#/products?q=' + encodeURIComponent(p.name) + '">' +
          '<span class="thumb" style="inline-size:30px;block-size:30px;font-size:15px">' + (p.emoji || "📦") + '</span>' +
          '<span class="search-item__body"><span class="search-item__title">' + HS.esc(p.name) + '</span>' +
          '<span class="search-item__meta">' + HS.fmt.money(p.price) + ' · ' + HS.fmt.int(p.stock) + ' ' + HS.esc(p.unit) + '</span></span>' +
          HS.icon("chevron-left", 14) + '</button>';
      }).join("");
    }
    if (r.customers.length) {
      html += '<div class="search-results__group">العملاء</div>' + r.customers.map(function (c) {
        return '<button type="button" class="search-item" data-action="goto" data-href="#/customers?q=' + encodeURIComponent(c.name) + '">' +
          HS.ui.avatar(c.name, "avatar--sm avatar--alt") +
          '<span class="search-item__body"><span class="search-item__title">' + HS.esc(c.name) + '</span>' +
          '<span class="search-item__meta">' + HS.esc(HS.ui.phone(c.phone)) + ' · ' + HS.esc(c.city) + '</span></span>' +
          HS.icon("chevron-left", 14) + '</button>';
      }).join("");
    }
    if (r.sales.length) {
      html += '<div class="search-results__group">الفواتير</div>' + r.sales.map(function (s) {
        return '<button type="button" class="search-item" data-action="goto" data-href="#/sales/' + encodeURIComponent(s.id) + '">' +
          '<span class="thumb" style="inline-size:30px;block-size:30px">' + HS.icon("receipt", 15) + '</span>' +
          '<span class="search-item__body"><span class="search-item__title ltr" style="text-align:right">' + HS.esc(s.number) + '</span>' +
          '<span class="search-item__meta">' + HS.esc(s.customerName) + ' · ' + HS.fmt.money(s.total) + '</span></span>' +
          HS.icon("chevron-left", 14) + '</button>';
      }).join("");
    }
    box.hidden = false;
    box.innerHTML = html;
  }

  /* ─────────── الدرج (جوال) ─────────── */
  function setDrawer(open) {
    var app = HS.$("#app");
    var scrim = HS.$("#scrim");
    app.setAttribute("data-drawer", open ? "true" : "false");
    HS.store.ui.set({ drawer: open });
    if (open) {
      scrim.hidden = false;
      requestAnimationFrame(function () { scrim.setAttribute("data-open", "true"); });
      HS.$("#menuBtn").setAttribute("aria-expanded", "true");
      /* عزل بقية الصفحة عن التنقل بلوحة المفاتيح */
      HS.$(".main").setAttribute("inert", "");
      var first = HS.focus.first(HS.$("#sidebar"));
      if (first) first.focus();
    } else {
      scrim.setAttribute("data-open", "false");
      setTimeout(function () { scrim.hidden = true; }, 200);
      HS.$("#menuBtn").setAttribute("aria-expanded", "false");
      HS.$(".main").removeAttribute("inert");
    }
  }
  HS.app.setDrawer = setDrawer;

  function setCollapsed(v) {
    HS.$("#app").setAttribute("data-collapsed", v ? "true" : "false");
    HS.$("#collapseBtn").setAttribute("aria-pressed", v ? "true" : "false");
    HS.store.ui.set({ collapsed: !!v });
  }

  /* ─────────── الإجراءات العامة ─────────── */
  HS.action("goto", function (btn) {
    var href = btn.getAttribute("data-href");
    HS.ui.closePop();
    if (window.innerWidth <= 960) setDrawer(false);
    var box = HS.$("#searchResults"); if (box) { box.hidden = true; }
    var inp = HS.$("#globalSearch"); if (inp && document.activeElement === inp) inp.blur();
    if (href) location.hash = href;
  });

  HS.action("period", function (btn) {
    var p = btn.getAttribute("data-period");
    HS.store.ui.set({ period: p });
    renderPeriodSeg();
    HS.bus.emit("period:change", p);
    HS.router.refresh();
  });

  HS.action("demoLogin", function () {
    var u = HS.$("#loginUser"), p = HS.$("#loginPass");
    if (u) u.value = "youssef";
    if (p) p.value = "1234";
    var f = HS.$("#loginForm");
    if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event("submit", { cancelable: true }));
  });

  HS.action("forgot", function () {
    HS.ui.toast({
      type: "info", icon: "info", title: "هذه واجهة أمامية فقط",
      msg: "لا يوجد خادم لإرسال رابط الاستعادة. بيانات الدخول التجريبية: youssef / 1234",
      duration: 6000
    });
  });

  HS.action("userMenu", function (btn) {
    var u = HS.store.currentUser();
    if (!u) return;
    var html = '<div class="pop__head">' + HS.esc(u.name) + ' · ' + HS.esc(u.role) + '</div>' +
      HS.ui.popItem("الملف والصلاحيات", "user", "goto", { href: "#/users" }) +
      HS.ui.popItem("إعدادات النظام", "settings", "goto", { href: "#/settings" }) +
      '<div class="pop__sep"></div>' +
      '<div class="pop__head">المظهر</div>' +
      HS.ui.popItem(HS.store.state.settings.theme === "dark" ? "مظهر فاتح" : "مظهر داكن", HS.store.state.settings.theme === "dark" ? "sun" : "moon", "toggleTheme") +
      '<div class="pop__sep"></div>' +
      HS.ui.popItem("تسجيل الخروج", "logout", "logout", null, "pop__item--danger");
    HS.ui.pop(btn, html);
  });

  HS.action("toggleTheme", function () {
    var s = HS.store.state.settings;
    var next = s.theme === "dark" ? "light" : "dark";
    HS.store.updateSettings({ theme: next });
    applyTheme(next);
    HS.ui.closePop();
    HS.bus.emit("theme:change", next);
  });

  HS.action("logout", function () {
    HS.ui.closePop();
    HS.ui.confirm({
      title: "تسجيل الخروج",
      text: "سيتم إغلاق الجلسة الحالية والعودة إلى شاشة الدخول. السلة غير المكتملة تبقى محفوظة كمسودة.",
      okLabel: "خروج", danger: true, icon: "logout", tone: "warn"
    }).then(function (ok) {
      if (!ok) return;
      HS.store.logout();
      HS.router.go("/login", null, { replace: true });
      HS.ui.toast({ type: "info", icon: "logout", title: "تم تسجيل الخروج", msg: "إلى اللقاء" });
    });
  });

  /* ─────────── الإقلاع ─────────── */
  function boot() {
    HS.store.load();
    var st = HS.store.state;

    applyTheme(st.settings.theme);
    applyDensity(st.settings.density);
    applyAccent(st.settings.accent);
    applyMotion(st.settings.motion);
    renderBrand();

    renderNav();
    renderStockAlert();
    renderUser();
    renderPeriodSeg();
    renderBell();
    renderClock();
    setInterval(renderClock, 30000);

    HS.icons.hydrate(document);

    setCollapsed(st.ui.collapsed && window.innerWidth > 960);

    /* الشريط العلوي */
    HS.$("#menuBtn").addEventListener("click", function () { setDrawer(!st.ui.drawer || HS.$("#app").getAttribute("data-drawer") !== "true"); });
    HS.$("#sidebarClose").addEventListener("click", function () { setDrawer(false); });
    HS.$("#scrim").addEventListener("click", function () { setDrawer(false); });
    HS.$("#collapseBtn").addEventListener("click", function () {
      setCollapsed(HS.$("#app").getAttribute("data-collapsed") !== "true");
    });
    HS.$("#themeBtn").addEventListener("click", function () { HS.actions.toggleTheme(); });
    HS.$("#bellBtn").addEventListener("click", function (ev) {
      ev.stopPropagation();
      var btn = HS.$("#bellBtn");
      if (btn.getAttribute("aria-expanded") === "true") { HS.ui.closePop(); return; }
      renderBell();
      HS.ui.pop(btn, bellHTML(), { wide: true });
    });
    HS.$("#quickSale").addEventListener("click", function () {
      if (window.innerWidth <= 960) setDrawer(false);
      location.hash = "#/pos";
    });

    /* البحث السريع */
    var search = HS.$("#globalSearch");
    search.addEventListener("input", HS.debounce(function () { renderSearch(search.value); }, 180));
    search.addEventListener("focus", function () { if (search.value) renderSearch(search.value); });
    search.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        var q = search.value.trim();
        if (!q) return;
        var r = searchAll(q);
        search.blur(); HS.$("#searchResults").hidden = true;
        if (r.products.length === 1 && !r.customers.length && !r.sales.length) {
          location.hash = "#/products?q=" + encodeURIComponent(q);
        } else {
          location.hash = "#/products?q=" + encodeURIComponent(q);
        }
      }
      if (ev.key === "Escape") { search.value = ""; HS.$("#searchResults").hidden = true; search.blur(); }
    });
    document.addEventListener("click", function (ev) {
      var box = HS.$("#searchResults");
      if (!box || box.hidden) return;
      if (box.contains(ev.target) || ev.target === search) return;
      box.hidden = true;
    });

    /* اختصارات لوحة المفاتيح */
    HS.key("/", function (ev) { ev.preventDefault(); search.focus(); search.select(); });
    HS.key("mod+k", function (ev) { ev.preventDefault(); search.focus(); search.select(); });
    HS.key("t", function (ev) { ev.preventDefault(); HS.actions.toggleTheme(); });
    /* تنقّل سريع بالحروف — يعمل فقط بعد الدخول وخارج حقول الكتابة */
    function nav(key, hash) {
      HS.key(key, function (ev) {
        if (!HS.store.isLoggedIn()) return;
        ev.preventDefault();
        if (location.hash !== hash) location.hash = hash;
      });
    }
    nav("n", "#/pos");
    nav("d", "#/");
    nav("p", "#/products");
    nav("s", "#/sales");
    nav("i", "#/inventory");
    nav("r", "#/reports");
    HS.key("[", function (ev) {
      if (window.innerWidth > 960) { ev.preventDefault(); HS.$("#collapseBtn").click(); }
    });
    HS.key("escape", function () {
      if (HS.$("#app").getAttribute("data-drawer") === "true") setDrawer(false);
    });

    /* تحديثات عند تغيّر الحالة */
    HS.bus.on("state:reset", function () {
      renderBrand(); renderNav(); renderStockAlert(); renderBell(); renderPeriodSeg();
    });
    HS.bus.on("settings:changed", function (s) {
      applyTheme(s.theme); applyDensity(s.density); applyAccent(s.accent);
      applyMotion(s.motion);
      renderBrand();
      renderNav();
    });
    ["product:created", "product:updated", "product:deleted", "stock:changed",
     "sale:created", "sale:returned", "sale:paid", "purchase:received",
     "purchase:created", "purchase:updated", "purchase:deleted"].forEach(function (evt) {
      HS.bus.on(evt, function () { renderNav(); renderStockAlert(); renderBell(); });
    });

    /* إعادة الضبط عند تغيّر عرض النافذة */
    var onResize = HS.debounce(function () {
      if (window.innerWidth > 960 && HS.$("#app").getAttribute("data-drawer") === "true") setDrawer(false);
      if (window.innerWidth <= 960 && HS.$("#app").getAttribute("data-collapsed") === "true") setCollapsed(false);
    }, 150);
    window.addEventListener("resize", onResize);

    HS.router.start();

    /* ترحيب */
    if (HS.store.isLoggedIn()) {
      var u = HS.store.currentUser();
      if (u && !sessionStorage.getItem("hs-welcomed")) {
        sessionStorage.setItem("hs-welcomed", "1");
        HS.ui.toast({
          type: "success", icon: "sparkle", title: "أهلًا " + u.name.split(" ")[0],
          msg: "البيانات تجريبية ومحفوظة في متصفحك فقط.", duration: 4200
        });
      }
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
