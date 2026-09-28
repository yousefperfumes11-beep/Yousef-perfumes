/* ═══════════════════════════════════════════════════════════
   lib.js — أدوات أساسية: DOM، تنسيق، تواريخ، مولّد عشوائي بذري،
   ناشر/مشترك، تخزين آمن، وتفويض الأحداث.
   سكربت تقليدي (لا ES modules) حتى يعمل عبر file:// مباشرة.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var HS = (window.HS = window.HS || {});
  HS.version = "1.0.0";
  HS.STORE_NAME = "يوسف للعطور";
  HS.VERSION = "1.1.0";

  /* ─────────── DOM ─────────── */
  HS.$ = function (sel, root) { return (root || document).querySelector(sel); };
  HS.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /** إنشاء عنصر من وسام مختصر: el('div.card#id', {text, html, attrs, style, on}, children) */
  HS.el = function (spec, props, children) {
    var parts = String(spec).split(/(?=[.#])/);
    var tag = parts.shift() || "div";
    var node = document.createElement(tag);
    parts.forEach(function (part) {
      if (!part) return;
      if (part[0] === ".") node.classList.add(part.slice(1));
      else if (part[0] === "#") node.id = part.slice(1);
    });
    props = props || {};
    if (props.text != null) node.textContent = props.text;
    if (props.html != null) node.innerHTML = props.html;
    if (props.attrs) Object.keys(props.attrs).forEach(function (k) {
      if (props.attrs[k] != null && props.attrs[k] !== false) node.setAttribute(k, props.attrs[k]);
    });
    if (props.style) Object.keys(props.style).forEach(function (k) { node.style[k] = props.style[k]; });
    if (props.on) Object.keys(props.on).forEach(function (k) { node.addEventListener(k, props.on[k]); });
    if (children) (Array.isArray(children) ? children : [children]).forEach(function (c) {
      if (c == null || c === false) return;
      node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c);
    });
    return node;
  };

  /** تهريب نص قبل وضعه في HTML */
  HS.esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };

  /** إزالة عقدة بأمان */
  HS.remove = function (node) { if (node && node.parentNode) node.parentNode.removeChild(node); };

  /* ─────────── الإعدادات الواعية (تُقرأ من store عند توفره) ─────────── */
  function settings() { return (HS.store && HS.store.state && HS.store.state.settings) || HS.defaults || {}; }

  HS.defaults = {
    currency: "د.ل",
    currencyCode: "LYD",
    decimals: 3,
    numerals: "latin",     // latin | arabic
    dateFormat: "short",   // short | long
    taxRate: 0,
    storeName: "يوسف للعطور",
    lowStockThreshold: 10
  };

  function locale() {
    var s = settings();
    return "ar-LY" + (s.numerals === "arabic" ? "" : "-u-nu-latn");
  }

  function digitShaper(str) {
    var s = settings();
    if (s.numerals !== "arabic") return str;
    // ضمان الأرقام المشرقية حتى لو تجاهلت البيئة طلب nu-arab
    return String(str).replace(/[0-9]/g, function (d) {
      return "٠١٢٣٤٥٦٧٨٩"[Number(d)];
    });
  }

  /* ─────────── التنسيق ─────────── */
  var numCache = {};
  function nf(key, opts) {
    if (!numCache[key]) {
      try { numCache[key] = new Intl.NumberFormat(locale(), opts); }
      catch (e) { numCache[key] = new Intl.NumberFormat("ar", opts); }
    }
    return numCache[key];
  }
  HS.clearFormatCache = function () { numCache = {}; };

  HS.fmt = {
    /** رقم مجرد */
    num: function (n, opts) {
      var o = opts || {};
      var v = Number(n);
      if (!isFinite(v)) v = 0;
      var key = "n" + JSON.stringify(o) + locale();
      return digitShaper(nf(key, o).format(v));
    },
    /** عدد صحيح بلا كسور */
    int: function (n) { return HS.fmt.num(Math.round(Number(n) || 0)); },
    /** مبلغ نقدي */
    money: function (n, opts) {
      var s = settings();
      var o = opts || {};
      var dec = o.decimals != null ? o.decimals : (s.decimals != null ? s.decimals : 3);
      var v = Number(n); if (!isFinite(v)) v = 0;
      var key = "m" + dec + locale();
      var out = nf(key, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
      return digitShaper(out) + " " + (s.currency || "د.ل");
    },
    /** مبلغ مضغوط للمساحات الضيقة */
    moneyShort: function (n) {
      var v = Number(n) || 0;
      var abs = Math.abs(v);
      if (abs >= 1000000) return HS.fmt.num(v / 1000000, { maximumFractionDigits: 1 }) + " م";
      if (abs >= 1000) return HS.fmt.num(v / 1000, { maximumFractionDigits: 1 }) + " ألف";
      return HS.fmt.money(v);
    },
    pct: function (n, dec) {
      return HS.fmt.num((Number(n) || 0) * 100, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec == null ? 1 : dec }) + "٪";
    },
    date: function (d, style) {
      var s = settings();
      var st = style || s.dateFormat || "short";
      var opts = st === "long"
        ? { weekday: "long", year: "numeric", month: "long", day: "numeric" }
        : { year: "numeric", month: "short", day: "numeric" };
      try { return digitShaper(new Intl.DateTimeFormat(locale(), opts).format(HS.date.toDate(d))); }
      catch (e) { return String(HS.date.toDate(d).toLocaleDateString()); }
    },
    dateShort: function (d) {
      try { return digitShaper(new Intl.DateTimeFormat(locale(), { month: "short", day: "numeric" }).format(HS.date.toDate(d))); }
      catch (e) { return ""; }
    },
    month: function (d) {
      try { return digitShaper(new Intl.DateTimeFormat(locale(), { year: "numeric", month: "long" }).format(HS.date.toDate(d))); }
      catch (e) { return ""; }
    },
    weekday: function (d) {
      try { return new Intl.DateTimeFormat(locale(), { weekday: "long" }).format(HS.date.toDate(d)); }
      catch (e) { return ""; }
    },
    time: function (d) {
      try { return digitShaper(new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit" }).format(HS.date.toDate(d))); }
      catch (e) { return ""; }
    },
    dateTime: function (d) { return HS.fmt.date(d) + " · " + HS.fmt.time(d); },
    /** «قبل ٣ ساعات» */
    rel: function (d) {
      var then = HS.date.toDate(d).getTime();
      var diff = Date.now() - then;
      var min = Math.round(diff / 60000);
      if (min < 1) return "الآن";
      if (min < 60) return "قبل " + HS.fmt.int(min) + " دقيقة";
      var hr = Math.round(min / 60);
      if (hr < 24) return "قبل " + HS.fmt.int(hr) + " ساعة";
      var day = Math.round(hr / 24);
      if (day === 1) return "أمس";
      if (day < 30) return "قبل " + HS.fmt.int(day) + " يوم";
      return HS.fmt.date(d);
    }
  };

  /* ─────────── التواريخ ─────────── */
  HS.date = {
    toDate: function (d) { return d instanceof Date ? d : new Date(d); },
    toISO: function (d) {
      var x = HS.date.toDate(d);
      var p = function (n) { return String(n).padStart(2, "0"); };
      return x.getFullYear() + "-" + p(x.getMonth() + 1) + "-" + p(x.getDate());
    },
    /** طابع زمني كامل بالتوقيت المحلي: YYYY-MM-DDTHH:mm:ss
        يُستخدم للسجلات التي يهمّ فيها وقت اليوم (فواتير، حركات، دفعات).
        بلا لاحقة منطقة زمنية حتى يُقرأ كتوقيت محلي في كل المتصفحات. */
    toStamp: function (d) {
      var x = HS.date.toDate(d);
      var p = function (n) { return String(n).padStart(2, "0"); };
      return HS.date.toISO(x) + "T" + p(x.getHours()) + ":" + p(x.getMinutes()) + ":" + p(x.getSeconds());
    },
    startOfDay: function (d) { var x = new Date(HS.date.toDate(d)); x.setHours(0, 0, 0, 0); return x; },
    endOfDay: function (d) { var x = new Date(HS.date.toDate(d)); x.setHours(23, 59, 59, 999); return x; },
    addDays: function (d, n) { var x = new Date(HS.date.toDate(d)); x.setDate(x.getDate() + n); return x; },
    addMonths: function (d, n) { var x = new Date(HS.date.toDate(d)); x.setMonth(x.getMonth() + n); return x; },
    daysBetween: function (a, b) {
      return Math.round((HS.date.startOfDay(b) - HS.date.startOfDay(a)) / 86400000);
    },
    /** سلسلة تواريخ من a إلى b شاملة */
    range: function (a, b) {
      var out = [], cur = HS.date.startOfDay(a), end = HS.date.startOfDay(b);
      var guard = 0;
      while (cur <= end && guard++ < 4000) { out.push(new Date(cur)); cur = HS.date.addDays(cur, 1); }
      return out;
    },
    isSameDay: function (a, b) { return HS.date.toISO(a) === HS.date.toISO(b); },
    today: function () { return HS.date.startOfDay(new Date()); }
  };

  /* ─────────── مولّد عشوائي بذري: بيانات ثابتة وواقعية بين التحديثات ─────────── */
  HS.rng = function (seed) {
    var t = (seed >>> 0) || 1;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };
  HS.rngHelpers = function (seed) {
    var r = HS.rng(seed);
    return {
      next: r,
      int: function (min, max) { return Math.floor(r() * (max - min + 1)) + min; },
      float: function (min, max, dec) {
        var v = r() * (max - min) + min;
        var p = Math.pow(10, dec == null ? 2 : dec);
        return Math.round(v * p) / p;
      },
      pick: function (arr) { return arr[Math.floor(r() * arr.length)]; },
      /** اختيار مرجّح: [[قيمة, وزن], ...] */
      weighted: function (pairs) {
        var total = pairs.reduce(function (s, p) { return s + p[1]; }, 0);
        var x = r() * total, acc = 0;
        for (var i = 0; i < pairs.length; i++) { acc += pairs[i][1]; if (x <= acc) return pairs[i][0]; }
        return pairs[pairs.length - 1][0];
      },
      shuffle: function (arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
      },
      /** احتمال بنسبة p */
      chance: function (p) { return r() < p; }
    };
  };

  /* ─────────── مصفوفات وكائنات ─────────── */
  /** المتوسط الحسابي، ويعيد 0 للمصفوفة الفارغة */
  HS.avg = function (arr, fn) {
    if (!arr || !arr.length) return 0;
    var vals = fn ? arr.map(fn) : arr;
    return HS.sum(vals, function (v) { return Number(v) || 0; }) / vals.length;
  };

  HS.sum = function (arr, fn) {
    return arr.reduce(function (s, x, i) { return s + (fn ? Number(fn(x, i)) || 0 : Number(x) || 0); }, 0);
  };
  HS.groupBy = function (arr, fn) {
    return arr.reduce(function (acc, x) {
      var k = typeof fn === "function" ? fn(x) : x[fn];
      (acc[k] = acc[k] || []).push(x);
      return acc;
    }, {});
  };
  HS.sortBy = function (arr, fn, dir) {
    var d = dir === "desc" ? -1 : 1;
    return arr.slice().sort(function (a, b) {
      var va = fn(a), vb = fn(b);
      if (typeof va === "string") return va.localeCompare(vb, "ar") * d;
      return ((va || 0) - (vb || 0)) * d;
    });
  };
  HS.uniq = function (arr) { return arr.filter(function (v, i) { return arr.indexOf(v) === i; }); };
  HS.chunk = function (arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  };
  HS.clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  HS.round = function (v, dec) { var p = Math.pow(10, dec || 0); return Math.round((Number(v) || 0) * p) / p; };
  HS.deepClone = function (o) {
    try { return JSON.parse(JSON.stringify(o)); }
    catch (e) { return o; }
  };
  HS.uid = function (prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  };

  /* ─────────── توقيت ─────────── */
  HS.debounce = function (fn, ms) {
    var t;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, ms || 200);
    };
  };
  HS.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  /** تأخير إظهار + حد أدنى للظهور حتى لا يومض المؤشر على الاستجابات السريعة */
  HS.withMinDuration = function (promise, minMs, delayMs) {
    var started = false;
    var delay = new Promise(function (r) {
      setTimeout(function () { started = true; r(); }, delayMs == null ? 160 : delayMs);
    });
    return Promise.race([delay, promise.then(function () { return HS.sleep(0); })]).then(function () {
      var elapsedGuard = started ? minMs || 320 : 0;
      return Promise.all([promise, HS.sleep(elapsedGuard)]);
    }).then(function (r) { return r[0]; });
  };

  /* ─────────── تخزين آمن: قد يرفض file:// أو الوضع الخاص ─────────── */
  HS.storage = (function () {
    var mem = {};
    var ok = false;
    try {
      var k = "__hs_test__";
      window.localStorage.setItem(k, "1");
      window.localStorage.removeItem(k);
      ok = true;
    } catch (e) { ok = false; }

    return {
      available: ok,
      get: function (key, fallback) {
        try {
          var raw = ok ? window.localStorage.getItem(key) : mem[key];
          return raw == null ? fallback : JSON.parse(raw);
        } catch (e) { return fallback; }
      },
      set: function (key, value) {
        try {
          var raw = JSON.stringify(value);
          if (ok) window.localStorage.setItem(key, raw); else mem[key] = raw;
          return true;
        } catch (e) { mem[key] = JSON.stringify(value); return false; }
      },
      remove: function (key) {
        try { if (ok) window.localStorage.removeItem(key); delete mem[key]; } catch (e) {}
      },
      /** مسح كل ما يخص هذا النظام */
      clear: function (prefix) {
        try {
          if (ok) {
            var kill = [];
            for (var i = 0; i < window.localStorage.length; i++) {
              var k = window.localStorage.key(i);
              if (k && (!prefix || k.indexOf(prefix) === 0)) kill.push(k);
            }
            kill.forEach(function (k) { window.localStorage.removeItem(k); });
          }
          Object.keys(mem).forEach(function (k) { if (!prefix || k.indexOf(prefix) === 0) delete mem[k]; });
          return true;
        } catch (e) { return false; }
      }
    };
  })();

  /* ─────────── ناشر / مشترك ─────────── */
  HS.bus = (function () {
    var map = {};
    return {
      on: function (evt, fn) { (map[evt] = map[evt] || []).push(fn); return function () { HS.bus.off(evt, fn); }; },
      off: function (evt, fn) {
        if (!map[evt]) return;
        map[evt] = map[evt].filter(function (f) { return f !== fn; });
      },
      emit: function (evt, payload) {
        (map[evt] || []).slice().forEach(function (fn) {
          try { fn(payload); } catch (e) { console.error("[HS] مستمع", evt, e); }
        });
      }
    };
  })();

  /* ─────────── تفويض الأحداث عبر data-action ───────────
     كل التفاعلات تُسجَّل هنا مرة واحدة على document، فلا حاجة
     لإعادة ربط المستمعات بعد كل رسم.                        */
  HS.actions = {};
  HS.action = function (name, fn) { HS.actions[name] = fn; };

  document.addEventListener("click", function (ev) {
    var trigger = ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!trigger) return;
    var name = trigger.getAttribute("data-action");
    var fn = HS.actions[name];
    if (!fn) return;
    var tag = trigger.tagName;
    if (tag === "BUTTON" && !trigger.getAttribute("type")) trigger.setAttribute("type", "button");
    /* الروابط والأزرار تمنع سلوكها الافتراضي؛ الصفوف والأغلفة لا تحتاج ذلك */
    if (tag === "BUTTON" || tag === "A") ev.preventDefault();
    if (trigger.hasAttribute("disabled") || trigger.getAttribute("aria-disabled") === "true") return;
    fn(trigger, ev);
  });

  /* ─────────── بحث موحّد لكل شريط أدوات ───────────
     حقل البحث واحد في كل الشاشات: يكتب في `q` من عنوان الصفحة،
     فيتشارك المرشّح مع الترتيب والترقيم في رابط واحد قابل للمشاركة. */
  HS.SEARCH_DEBOUNCE = 260;
  document.addEventListener("input", function (ev) {
    var inp = ev.target;
    if (!inp || !inp.hasAttribute || !inp.hasAttribute("data-search-input")) return;
    clearTimeout(inp.__hsSearch);
    inp.__hsSearch = setTimeout(function () {
      if (!HS.router || !HS.router.current()) return;
      var v = inp.value.trim();
      if ((HS.router.current().query.q || "") === v) return;
      HS.router.setQuery({ q: v || null, page: null }, { replace: true });
    }, HS.SEARCH_DEBOUNCE);
  });
  /* Enter في حقل البحث يرشّح فورًا بلا انتظار */
  document.addEventListener("keydown", function (ev) {
    if (ev.key !== "Enter") return;
    var inp = ev.target;
    if (!inp || !inp.hasAttribute || !inp.hasAttribute("data-search-input")) return;
    ev.preventDefault();
    clearTimeout(inp.__hsSearch);
    if (!HS.router || !HS.router.current()) return;
    var v = inp.value.trim();
    if ((HS.router.current().query.q || "") !== v) HS.router.setQuery({ q: v || null, page: null }, { replace: true });
  });

  /* ─────────── لوحة المفاتيح ─────────── */
  HS.keys = {};
  HS.key = function (combo, fn) { HS.keys[combo.toLowerCase()] = fn; };
  document.addEventListener("keydown", function (ev) {
    var parts = [];
    if (ev.ctrlKey || ev.metaKey) parts.push("mod");
    if (ev.shiftKey) parts.push("shift");
    if (ev.altKey) parts.push("alt");
    var k = ev.key.toLowerCase();
    parts.push(k);
    var combo = parts.join("+");
    var fn = HS.keys[combo];
    if (!fn) return;

    /* الحرف المفرد اختصارٌ فقط خارج حقول الإدخال، فلا يسرق الكتابة.
       Escape مستثنى: يجب أن يعمل والحقل مُركَّز ليغلق النافذة أو القائمة. */
    var bare = parts.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    if (bare && k !== "escape") {
      var t = ev.target;
      var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" ||
                         t.isContentEditable || (t.closest && t.closest("[contenteditable='true']")));
      if (typing) return;
    }
    fn(ev);
  });

  /* ─────────── إدارة التركيز ─────────── */
  HS.focus = {
    FOCUSABLE: 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
    first: function (root) {
      var els = HS.$$(HS.focus.FOCUSABLE, root).filter(function (e) { return e.offsetParent !== null || e === document.activeElement; });
      return els[0];
    },
    trap: function (root, ev) {
      var els = HS.$$(HS.focus.FOCUSABLE, root).filter(function (e) { return e.offsetParent !== null; });
      if (!els.length) return;
      var first = els[0], last = els[els.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    }
  };

  /* ─────────── تنزيل ملف (تصدير CSV محليًا، بلا خادم) ─────────── */
  HS.download = function (filename, text, mime) {
    try {
      var blob = new Blob(["\uFEFF" + text], { type: (mime || "text/csv") + ";charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(url); HS.remove(a); }, 400);
      return true;
    } catch (e) { return false; }
  };

  HS.toCSV = function (rows, columns) {
    var cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
    var esc = function (v) {
      var s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.map(esc).join(",")].concat(
      rows.map(function (r) {
        return cols.map(function (c) { return esc(typeof r === "object" ? r[c] : r); }).join(",");
      })
    ).join("\n");
  };

  /* ─────────── بحث نصي متسامح مع العربية ─────────── */
  HS.normalizeAr = function (s) {
    return String(s || "")
      .replace(/[\u064B-\u0652\u0670]/g, "")       // تشكيل
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه")
      .replace(/[ـ]/g, "")
      .toLowerCase().trim();
  };
  HS.matches = function (haystack, needle) {
    if (!needle) return true;
    return HS.normalizeAr(haystack).indexOf(HS.normalizeAr(needle)) !== -1;
  };
  HS.highlight = function (text, needle) {
    var safe = HS.esc(text);
    if (!needle) return safe;
    var n = HS.normalizeAr(needle);
    if (!n) return safe;
    var norm = HS.normalizeAr(text);
    var i = norm.indexOf(n);
    if (i === -1) return safe;
    // التطبيع قد يغيّر الأطوال، فنستخدم حدودًا تقريبية آمنة
    var start = Math.max(0, i), end = Math.min(text.length, i + needle.length);
    return HS.esc(text.slice(0, start)) + "<mark>" + HS.esc(text.slice(start, end)) + "</mark>" + HS.esc(text.slice(end));
  };
})();
