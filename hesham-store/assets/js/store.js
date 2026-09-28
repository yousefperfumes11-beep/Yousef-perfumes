/* ═══════════════════════════════════════════════════════════
   store.js — الحالة المركزية: تحميل، حفظ، محددات، إحصاءات محسوبة،
   وكل عمليات الإضافة والتعديل والحذف. كل شيء محلي في الذاكرة
   مع نسخ احتياطي في localStorage. لا خادم ولا API.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;
  var KEY = "hesham-store:v3";
  /* الإصدارات السابقة كانت لمجال بيانات مختلف — تُهمَل ولا تُدمج */
  var LEGACY_KEYS = ["hesham-store:v1", "hesham-store:v2"];

  var S = null;   /* الحالة */

  /* ─────────── إعادة الحساب المشتق ─────────── */

  /** يعيد حساب أرصدة المنتجات من سجل الحركات */
  function recomputeStock() {
    var bal = {};
    S.products.forEach(function (p) { bal[p.id] = Number(p.opening) || 0; });
    S.movements.forEach(function (m) {
      if (bal[m.productId] == null) return;
      if (m.type === "out") bal[m.productId] -= m.qty;
      else if (m.type === "in" || m.type === "return") bal[m.productId] += m.qty;
      else if (m.type === "adjust") bal[m.productId] += m.qty;
    });
    S.products.forEach(function (p) {
      p.stock = Math.max(0, Math.round((bal[p.id] || 0) * 1000) / 1000);
    });
  }

  /** يعيد حساب إجماليات العملاء من المبيعات */
  function recomputeCustomers() {
    S.customers.forEach(function (c) {
      var own = S.sales.filter(function (s) { return s.customerId === c.id && s.status !== "returned" && s.status !== "held"; });
      c.visits = own.length;
      c.totalSpent = HS.round(HS.sum(own, function (s) { return s.total; }), 3);
      /* المدفوع يُشتقّ من سجل الدفعات، لا يُخزَّن مكررًا */
      var own = (S.payments || []).filter(function (p) { return p.customerId === c.id; });
      c.totalPaid = HS.round(HS.sum(own.filter(function (p) { return p.amount > 0; }),
        function (p) { return p.amount; }), 3);
      c.totalCharged = HS.round(HS.sum(own.filter(function (p) { return p.kind === "charge"; }),
        function (p) { return Math.abs(p.amount); }), 3);
      c.lastVisit = own.length ? own.slice().sort(byDateAsc).pop().date : null;
    });
  }

  function byDateAsc(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }

  /* المجموعات التي تحرّك المال: أي تغيير فيها يستدعي تحديث شاشة الصندوق */
  var MONEY_COLL = { expenses: 1, payments: 1, cashEntries: 1, sales: 1 };
  function notifyCash(coll) { if (MONEY_COLL[coll]) HS.bus.emit("cash:change", { coll: coll }); }
  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }

  /* ─────────── التهيئة والتحميل ─────────── */

  function normalize(raw) {
    var d = HS.data.defaults();
    raw.settings = Object.assign({}, d, raw.settings || {});
    raw.session = raw.session || { userId: null, since: null };
    raw.carts = raw.carts || { active: [], held: [] };
    raw.ui = Object.assign({ collapsed: false, drawer: false, period: "30d", lastRoute: "#/" }, raw.ui || {});
    ["products", "customers", "suppliers", "users", "sales", "purchases", "movements", "expenses", "categories", "payments", "cashEntries"].forEach(function (k) {
      if (!Array.isArray(raw[k])) raw[k] = [];
    });
    return raw;
  }

  /** هل البيانات قديمة بحيث صارت الرسوم البيانية فارغة؟ */
  function isStale(raw) {
    if (!raw || !raw.anchorDate) return true;
    var age = HS.date.daysBetween(HS.date.toDate(raw.anchorDate), new Date());
    return age >= 1;
  }

  /**
   * يدمج ما أنشأه أو عدّله المستخدم فوق مجموعة مولّدة حديثًا،
   * حتى لا يفقد عمله عند تحديث البيانات التجريبية.
   */
  function mergeUserWork(fresh, old) {
    fresh.settings = Object.assign({}, fresh.settings, old.settings || {});
    fresh.session = old.session || fresh.session;
    fresh.carts = old.carts || fresh.carts;
    fresh.ui = Object.assign({}, fresh.ui, old.ui || {});

    ["products", "customers", "suppliers", "users"].forEach(function (coll) {
      (old[coll] || []).forEach(function (rec) {
        if (!rec) return;
        if (rec._local) { fresh[coll].push(rec); return; }
        if (!rec._edited) return;
        var i = -1;
        for (var j = 0; j < fresh[coll].length; j++) if (fresh[coll][j].id === rec.id) { i = j; break; }
        if (i >= 0) {
          var merged = Object.assign({}, fresh[coll][i], rec);
          merged.opening = fresh[coll][i].opening;   /* الرصيد يُعاد حسابه من الحركات */
          fresh[coll][i] = merged;
        }
      });
    });

    ["sales", "purchases", "expenses", "movements", "payments", "cashEntries"].forEach(function (coll) {
      (old[coll] || []).forEach(function (rec) {
        if (rec && rec._local) fresh[coll].push(rec);
      });
    });

    fresh.sales.sort(byDateDesc);
    fresh.movements.sort(byDateAsc);
    fresh.expenses.sort(byDateDesc);
    return fresh;
  }

  HS.store = {
    get state() { return S; },

    /** تحميل من التخزين أو توليد جديد */
    load: function (opts) {
      opts = opts || {};
      LEGACY_KEYS.forEach(function (k) { HS.storage.clear(k); });
      var raw = opts.force ? null : HS.storage.get(KEY, null);
      var fresh = HS.data.generate({ today: new Date() });
      if (raw && !isStale(raw)) {
        S = normalize(raw);
      } else if (raw && isStale(raw)) {
        S = normalize(mergeUserWork(fresh, normalize(raw)));
        recomputeStock();
        recomputeCustomers();
        S.anchorDate = fresh.anchorDate;
        S.generatedAt = fresh.generatedAt;
      } else {
        S = normalize(fresh);
      }
      recomputeStock();
      recomputeCustomers();
      HS.defaults = S.settings;
      HS.clearFormatCache();
      HS.store.save();
      return S;
    },

    save: function () { return HS.storage.set(KEY, S); },

    /** إعادة توليد البيانات التجريبية من الصفر (مع الإبقاء على الإعدادات) */
    reset: function (keepSettings) {
      var settings = keepSettings ? S.settings : HS.data.defaults();
      var theme = S.settings.theme, density = S.settings.density;
      S = normalize(HS.data.generate({ today: new Date(), seed: (Math.random() * 1e9) | 0 }));
      S.settings = keepSettings ? Object.assign({}, settings, { theme: theme, density: density }) : S.settings;
      recomputeStock();
      recomputeCustomers();
      HS.defaults = S.settings;
      HS.clearFormatCache();
      HS.store.save();
      HS.bus.emit("state:reset");
      return S;
    },

    /** استيراد نسخة احتياطية من ملف JSON محلي */
    importJSON: function (text) {
      var raw;
      try { raw = JSON.parse(text); }
      catch (e) { return { ok: false, error: "الملف ليس بصيغة JSON صالحة" }; }
      if (!raw || typeof raw !== "object") return { ok: false, error: "محتوى الملف غير مفهوم" };
      /* نسخ التصدير تُغلَّف في {exportedAt, store} — نفكّ الغلاف إن وُجد */
      if (raw.store && typeof raw.store === "object") raw = raw.store;
      var need = ["products", "sales", "customers", "suppliers", "categories", "settings"];
      for (var i = 0; i < need.length; i++) {
        if (!Array.isArray(raw[need[i]]) && typeof raw[need[i]] !== "object") {
          return { ok: false, error: "الملف لا يحتوي على «" + need[i] + "» — يبدو أنه ليس نسخة من هذا النظام" };
        }
      }
      var keepTheme = S ? S.settings.theme : "light";
      var keepDensity = S ? S.settings.density : "cozy";
      var keepAccent = S ? S.settings.accent : "emerald";
      S = normalize(raw);
      S.settings.theme = S.settings.theme || keepTheme;
      S.settings.density = S.settings.density || keepDensity;
      S.settings.accent = S.settings.accent || keepAccent;
      recomputeStock();
      recomputeCustomers();
      HS.defaults = S.settings;
      HS.clearFormatCache();
      HS.store.save();
      HS.bus.emit("state:reset", S);
      return { ok: true, state: S };
    },

    /** حجم البيانات المخزّنة بالبايت (تقريبي) */
    storageSize: function () {
      try { return JSON.stringify(S || {}).length; } catch (e) { return 0; }
    },

    /* ═══════════ محددات ═══════════ */
    cat: function (id) {
      var c = S.categories.filter(function (x) { return x.id === id; })[0];
      return c || { id: id, name: id, emoji: "📦", color: "var(--text-3)" };
    },
    product: function (id) { return S.products.filter(function (p) { return p.id === id; })[0] || null; },
    customer: function (id) { return S.customers.filter(function (c) { return c.id === id; })[0] || null; },
    supplier: function (id) { return S.suppliers.filter(function (s) { return s.id === id; })[0] || null; },
    user: function (id) { return S.users.filter(function (u) { return u.id === id; })[0] || null; },
    sale: function (id) { return S.sales.filter(function (s) { return s.id === id; })[0] || null; },
    purchase: function (id) { return S.purchases.filter(function (p) { return p.id === id; })[0] || null; },
    expenseCat: function (id) {
      return HS.data.EXPENSE_CATS.filter(function (c) { return c.id === id; })[0] || { id: id, name: id, emoji: "📦" };
    },
    /** هل الحساب حساب دين؟ يقبل التسمية القديمة «آجل» من بيانات محفوظة */
    creditAccount: function (c) { return !!c && (c.accountType === "دين" || c.accountType === "آجل"); },

    payMethod: function (id) {
      return HS.data.PAY_METHODS.filter(function (m) { return m.id === id; })[0] || { id: id, name: id };
    },
    currentUser: function () { return S.session.userId ? HS.store.user(S.session.userId) : null; },
    can: function (perm) {
      var u = HS.store.currentUser();
      if (!u) return false;
      return u.role === "مدير" || (u.permissions || []).indexOf(perm) !== -1;
    },

    /* ═══════════ الفترات ═══════════ */
    periods: [
      { id: "today", name: "اليوم", days: 0 },
      { id: "7d", name: "٧ أيام", days: 7 },
      { id: "30d", name: "٣٠ يومًا", days: 30 },
      { id: "90d", name: "٩٠ يومًا", days: 90 },
      { id: "all", name: "الكل", days: 9999 }
    ],
    /** يعيد {from, to, label} لفترة معرّفة */
    range: function (periodId, custom) {
      var today = HS.date.today();
      if (custom && custom.from && custom.to) {
        return { from: HS.date.startOfDay(custom.from), to: HS.date.endOfDay(custom.to), label: "فترة مخصصة" };
      }
      var p = HS.store.periods.filter(function (x) { return x.id === periodId; })[0] || HS.store.periods[2];
      if (p.id === "today") return { from: today, to: HS.date.endOfDay(today), label: p.name };
      if (p.id === "all") {
        var dates = S.sales.map(function (s) { return HS.date.toDate(s.date); });
        var min = dates.length ? new Date(Math.min.apply(null, dates)) : HS.date.addDays(today, -90);
        return { from: HS.date.startOfDay(min), to: HS.date.endOfDay(today), label: p.name };
      }
      return { from: HS.date.startOfDay(HS.date.addDays(today, -(p.days - 1))), to: HS.date.endOfDay(today), label: p.name };
    },
    inRange: function (items, range) {
      return items.filter(function (x) {
        var t = HS.date.toDate(x.date).getTime();
        return t >= range.from.getTime() && t <= range.to.getTime();
      });
    },

    /* ═══════════ إحصاءات محسوبة ═══════════ */

    /** مبيعات الفترة، مستثنية المرتجع والمعلّق */
    salesOf: function (range) {
      return HS.store.inRange(S.sales, range).filter(function (s) { return s.status !== "held"; });
    },
    validSalesOf: function (range) {
      return HS.store.salesOf(range).filter(function (s) { return s.status !== "returned"; });
    },

    /** ربح فاتورة واحدة = Σ(الكمية × (سعر البيع − التكلفة)) − خصم الفاتورة.
        يجب أن تتطابق مع kpis() التي تحسب الإيراد صافيًا من الخصم. */
    saleProfit: function (sale) {
      if (!sale) return 0;
      var gross = HS.sum(sale.items || [], function (i) { return i.qty * (i.price - (i.cost || 0)); });
      return HS.round(gross - (Number(sale.discount) || 0), 3);
    },

    kpis: function (range) {
      var cur = HS.store.salesOf(range);
      var valid = cur.filter(function (s) { return s.status !== "returned"; });
      var returned = cur.filter(function (s) { return s.status === "returned"; });
      var revenue = HS.sum(valid, function (s) { return s.total; });
      var cogs = HS.sum(valid, function (s) {
        return HS.sum(s.items, function (it) { return it.qty * (it.cost || 0); });
      });
      var profit = revenue - cogs;

      var expenses = HS.sum(HS.store.inRange(S.expenses, range), function (e) { return e.amount; });
      var units = HS.sum(valid, function (s) { return HS.sum(s.items, function (it) { return it.qty; }); });
      var baskets = valid.length;

      /* الفترة السابقة للمقارنة */
      var span = Math.max(1, HS.date.daysBetween(range.from, range.to) + 1);
      var prev = { from: HS.date.addDays(range.from, -span), to: HS.date.startOfDay(HS.date.addDays(range.from, -1)) };
      var prevValid = HS.store.salesOf(prev).filter(function (s) { return s.status !== "returned"; });
      var prevRevenue = HS.sum(prevValid, function (s) { return s.total; });
      var prevBaskets = prevValid.length;
      var prevProfit = prevRevenue - HS.sum(prevValid, function (s) {
        return HS.sum(s.items, function (it) { return it.qty * (it.cost || 0); });
      });
      var prevUnits = HS.sum(prevValid, function (s) { return HS.sum(s.items, function (it) { return it.qty; }); });

      var delta = function (a, b) { return b > 0 ? (a - b) / b : (a > 0 ? 1 : 0); };

      return {
        revenue: HS.round(revenue, 3),
        prevRevenue: HS.round(prevRevenue, 3),
        revenueDelta: delta(revenue, prevRevenue),
        profit: HS.round(profit, 3),
        prevProfit: HS.round(prevProfit, 3),
        profitDelta: delta(profit, prevProfit),
        margin: revenue > 0 ? profit / revenue : 0,
        cogs: HS.round(cogs, 3),
        expenses: HS.round(expenses, 3),
        net: HS.round(profit - expenses, 3),
        invoices: baskets,
        prevInvoices: prevBaskets,
        invoicesDelta: delta(baskets, prevBaskets),
        units: units,
        prevUnits: prevUnits,
        unitsDelta: delta(units, prevUnits),
        avgBasket: baskets ? revenue / baskets : 0,
        avgItems: baskets ? units / baskets : 0,
        returns: returned.length,
        returnsValue: HS.round(HS.sum(returned, function (s) { return s.total; }), 3),
        discounts: HS.round(HS.sum(valid, function (s) { return s.discount; }), 3),
        outstanding: HS.round(HS.sum(cur.filter(function (s) { return s.status === "unpaid" || s.status === "partial"; }), function (s) { return s.total - s.paid; }), 3),
        activeCustomers: HS.uniq(valid.map(function (s) { return s.customerId; }).filter(Boolean)).length,
        newCustomers: HS.store.inRange(S.customers.map(function (c) { return { date: c.createdAt, id: c.id }; }), range).length,
        span: span
      };
    },

    /** سلسلة يومية للمخططات */
    daily: function (range, valueFn) {
      var days = HS.date.range(range.from, range.to);
      var map = {};
      days.forEach(function (d) { map[HS.date.toISO(d)] = 0; });
      HS.store.salesOf(range).forEach(function (s) {
        var k = HS.date.toISO(s.date);
        if (map[k] == null) return;
        map[k] += valueFn ? valueFn(s) : (s.status === "returned" ? 0 : s.total);
      });
      return {
        labels: days.map(function (d) { return HS.fmt.dateShort(d); }),
        isoLabels: days.map(function (d) { return HS.date.toISO(d); }),
        values: days.map(function (d) { return HS.round(map[HS.date.toISO(d)], 3); }),
        days: days
      };
    },

    /** تجميع حسب قسم */
    byCategory: function (range) {
      var acc = {};
      HS.store.validSalesOf(range).forEach(function (s) {
        s.items.forEach(function (it) {
          var p = HS.store.product(it.productId);
          var cid = p ? p.category : "other";
          acc[cid] = acc[cid] || { revenue: 0, units: 0, profit: 0 };
          acc[cid].revenue += it.qty * it.price;
          acc[cid].profit += it.qty * (it.price - (it.cost || 0));
          acc[cid].units += it.qty;
        });
      });
      var out = Object.keys(acc).map(function (cid) {
        var c = HS.store.cat(cid);
        return { id: cid, name: c.name, emoji: c.emoji, color: c.color, revenue: HS.round(acc[cid].revenue, 3), units: acc[cid].units, profit: HS.round(acc[cid].profit, 3) };
      });
      return out.sort(function (a, b) { return b.revenue - a.revenue; });
    },

    /** أعلى المنتجات مبيعًا */
    topProducts: function (range, n) {
      var acc = {};
      HS.store.validSalesOf(range).forEach(function (s) {
        s.items.forEach(function (it) {
          acc[it.productId] = acc[it.productId] || { qty: 0, revenue: 0, profit: 0 };
          acc[it.productId].qty += it.qty;
          acc[it.productId].revenue += it.qty * it.price;
          acc[it.productId].profit += it.qty * (it.price - (it.cost || 0));
        });
      });
      var out = Object.keys(acc).map(function (pid) {
        var p = HS.store.product(pid);
        return {
          id: pid, name: p ? p.name : "صنف محذوف", emoji: p ? p.emoji : "📦",
          qty: acc[pid].qty, revenue: HS.round(acc[pid].revenue, 3), profit: HS.round(acc[pid].profit, 3),
          stock: p ? p.stock : 0, unit: p ? p.unit : ""
        };
      });
      return out.sort(function (a, b) { return b.qty - a.qty; }).slice(0, n || 8);
    },

    /** توزيع طرق الدفع: القيمة وعدد العمليات */
    byMethod: function (range) {
      var acc = {};
      HS.store.validSalesOf(range).forEach(function (s) {
        if (!acc[s.method]) acc[s.method] = { value: 0, count: 0 };
        acc[s.method].value += s.total;
        acc[s.method].count++;
      });
      return HS.data.PAY_METHODS.map(function (m, i) {
        var a = acc[m.id] || { value: 0, count: 0 };
        return {
          id: m.id, name: m.name, emoji: m.emoji,
          value: HS.round(a.value, 3), count: a.count,
          color: HS.chart.palette[i % HS.chart.palette.length]
        };
      }).filter(function (x) { return x.value > 0 || x.count > 0; });
    },

    /** توزيع المبيعات على ساعات اليوم */
    byHour: function (range) {
      var buckets = [];
      for (var h = 7; h <= 22; h++) buckets.push({ h: h, value: 0, count: 0 });
      HS.store.validSalesOf(range).forEach(function (s) {
        var hh = new Date(s.date).getHours();
        var b = buckets.filter(function (x) { return x.h === hh; })[0];
        if (b) { b.value += s.total; b.count++; }
      });
      return buckets;
    },

    /** توزيع على أيام الأسبوع، مرتّبًا من السبت كما هو معتاد محليًا */
    byWeekday: function (range) {
      var names = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      var acc = names.map(function (n) { return { name: n, label: n, value: 0, total: 0, count: 0, avg: 0 }; });
      HS.store.validSalesOf(range).forEach(function (s) {
        var a = acc[new Date(s.date).getDay()];
        if (a) { a.value += s.total; a.count++; }
      });
      /* عدد مرات وقوع اليوم داخل الفترة، لحساب متوسط صادق لا قسمة على 7 */
      var span = Math.max(1, HS.date.daysBetween(range.from, range.to) + 1);
      HS.date.range(range.from, range.to).forEach(function (d) {
        var a = acc[d.getDay()];
        if (a) a.occurrences = (a.occurrences || 0) + 1;
      });
      acc.forEach(function (a) {
        a.total = HS.round(a.value, 3);
        a.value = HS.round(a.value, 3);
        var occ = a.occurrences || Math.max(1, Math.floor(span / 7));
        a.avg = HS.round(a.value / occ, 3);
      });
      return [acc[6], acc[0], acc[1], acc[2], acc[3], acc[4], acc[5]];
    },

    /** قيمة المخزون الحالية */
    inventoryValue: function () {
      return HS.round(HS.sum(S.products, function (p) { return p.stock * p.cost; }), 3);
    },
    retailValue: function () {
      return HS.round(HS.sum(S.products, function (p) { return p.stock * p.price; }), 3);
    },
    lowStock: function () {
      var th = Number(S.settings.lowStockThreshold) || 0;
      return S.products.filter(function (p) { return p.active && p.stock > 0 && (p.stock <= p.minStock || p.stock <= th); });
    },
    outOfStock: function () {
      return S.products.filter(function (p) { return p.active && p.stock <= 0; });
    },
    stockAlertCount: function () { return HS.store.lowStock().length + HS.store.outOfStock().length; },

    /** ديون العملاء المتأخرة */
    overdue: function () {
      var limit = Number(S.settings.maxCreditDays) || 30;
      var out = [];
      S.sales.forEach(function (s) {
        if (s.status !== "unpaid" && s.status !== "partial") return;
        var age = HS.date.daysBetween(HS.date.toDate(s.date), new Date());
        if (age > limit) out.push({ sale: s, age: age, due: HS.round(s.total - s.paid, 3) });
      });
      return out.sort(function (a, b) { return b.age - a.age; });
    },

    /** تنبيهات للشريط العلوي والشريط الجانبي */
    notifications: function () {
      var out = [];
      var oos = HS.store.outOfStock();
      var low = HS.store.lowStock();
      if (oos.length) out.push({ id: "oos", level: "danger", icon: "x-circle", title: oos.length + " أصناف نفدت من المخزون", msg: oos.slice(0, 3).map(function (p) { return p.name; }).join("، ") + (oos.length > 3 ? " وغيرها" : ""), route: "#/inventory?filter=out" });
      if (low.length) out.push({ id: "low", level: "warning", icon: "alert", title: low.length + " صنفًا تحت حد الطلب", msg: low.slice(0, 3).map(function (p) { return p.name + " (" + HS.fmt.int(p.stock) + ")"; }).join("، ") + (low.length > 3 ? " وغيرها" : ""), route: "#/inventory?filter=low" });

      var od = HS.store.overdue();
      if (od.length) out.push({
        id: "overdue", level: "danger", icon: "clock",
        title: od.length + " فاتورة دين تجاوزت مدة السداد",
        msg: "إجمالي مستحق " + HS.fmt.money(HS.sum(od, function (x) { return x.due; })),
        route: "#/sales?status=unpaid"
      });

      var shipping = S.purchases.filter(function (p) { return p.status === "shipping"; });
      if (shipping.length) out.push({ id: "ship", level: "info", icon: "truck", title: shipping.length + " طلبات شراء قيد الشحن", msg: shipping[0].supplierName + " · " + shipping[0].number, route: "#/purchases?status=shipping" });

      var held = S.sales.filter(function (s) { return s.status === "held"; });
      if (held.length) out.push({ id: "held", level: "info", icon: "pause", title: held.length + " فواتير معلّقة بانتظار العميل", msg: held[0].number + " · " + HS.fmt.money(held[0].total), route: "#/pos" });

      var overLimit = S.customers.filter(function (c) { return c.creditLimit && c.balance > c.creditLimit; });
      if (overLimit.length) out.push({ id: "limit", level: "warning", icon: "shield", title: overLimit.length + " عملاء تجاوزوا حد الائتمان", msg: overLimit.map(function (c) { return c.name; }).join("، "), route: "#/customers?filter=over" });

      return out;
    },

    /* ═══════════ عمليات: المبيعات ونقطة البيع ═══════════ */

    cart: {
      items: function () { return S.carts.active; },
      add: function (productId, qty, opts) {
        opts = opts || {};
        var p = HS.store.product(productId);
        if (!p) return { ok: false, error: "الصنف غير موجود" };
        var q = Math.max(1, Number(qty) || 1);
        if (!S.settings.allowNegativeStock && p.stock <= 0) return { ok: false, error: "«" + p.name + "» غير متوفر في المخزون" };
        var line = S.carts.active.filter(function (l) { return l.productId === productId; })[0];
        if (line) {
          var next = line.qty + q;
          if (!S.settings.allowNegativeStock && next > p.stock) {
            if (opts.force) next = p.stock; else return { ok: false, error: "المتاح من «" + p.name + "» هو " + HS.fmt.int(p.stock) + " " + p.unit + " فقط", partial: true };
          }
          line.qty = next;
        } else {
          if (!S.settings.allowNegativeStock && q > p.stock) q = opts.force ? p.stock : q;
          S.carts.active.push({
            productId: p.id, name: HS.store.label(p), unit: p.unit, emoji: p.emoji,
            brand: p.brand || "", size: p.size || "",
            qty: q, price: opts.price != null ? opts.price : p.price, cost: p.cost, discount: 0
          });
        }
        HS.store.save();
        HS.bus.emit("cart:change");
        return { ok: true, product: p, qty: q };
      },
      setQty: function (productId, qty) {
        var line = S.carts.active.filter(function (l) { return l.productId === productId; })[0];
        if (!line) return;
        var p = HS.store.product(productId);
        var q = HS.clamp(Math.round(Number(qty) || 0), 0, S.settings.allowNegativeStock ? 9999 : (p ? p.stock : 9999));
        if (q <= 0) HS.store.cart.remove(productId);
        else { line.qty = q; HS.store.save(); HS.bus.emit("cart:change"); }
      },
      setPrice: function (productId, price) {
        var line = S.carts.active.filter(function (l) { return l.productId === productId; })[0];
        if (!line) return;
        line.price = Math.max(0, Number(price) || 0);
        HS.store.save(); HS.bus.emit("cart:change");
      },
      setLineDiscount: function (productId, value) {
        var line = S.carts.active.filter(function (l) { return l.productId === productId; })[0];
        if (!line) return;
        line.discount = Math.max(0, Number(value) || 0);
        HS.store.save(); HS.bus.emit("cart:change");
      },
      remove: function (productId) {
        S.carts.active = S.carts.active.filter(function (l) { return l.productId !== productId; });
        HS.store.save(); HS.bus.emit("cart:change");
      },
      clear: function () { S.carts.active = []; HS.store.save(); HS.bus.emit("cart:change"); },
      count: function () { return HS.sum(S.carts.active, function (l) { return l.qty; }); },
      lines: function () { return S.carts.active.length; },
      subtotal: function () {
        return HS.round(HS.sum(S.carts.active, function (l) { return l.qty * l.price - (l.discount || 0); }), 3);
      },
      cost: function () { return HS.round(HS.sum(S.carts.active, function (l) { return l.qty * (l.cost || 0); }), 3); },
      hold: function (note) {
        if (!S.carts.active.length) return null;
        var id = "hold-" + Date.now().toString(36);
        S.carts.held.push({ id: id, note: note || "", items: S.carts.active.slice(), at: new Date().toISOString() });
        S.carts.active = [];
        HS.store.save(); HS.bus.emit("cart:change");
        return id;
      },
      held: function () { return S.carts.held; },
      resume: function (id) {
        var h = S.carts.held.filter(function (x) { return x.id === id; })[0];
        if (!h) return false;
        S.carts.active = h.items.slice();
        S.carts.held = S.carts.held.filter(function (x) { return x.id !== id; });
        HS.store.save(); HS.bus.emit("cart:change");
        return true;
      },
      dropHeld: function (id) {
        S.carts.held = S.carts.held.filter(function (x) { return x.id !== id; });
        HS.store.save(); HS.bus.emit("cart:change");
      }
    },

    /** إتمام عملية بيع: ينشئ فاتورة ويخصم المخزون ويحدّث دين العميل */
    checkout: function (payload) {
      payload = payload || {};
      var items = S.carts.active.slice();
      if (!items.length) return { ok: false, error: "السلة فارغة" };

      var now = new Date();
      var seq = S.sales.length + 1;
      var number = (S.settings.invoicePrefix || "INV") + "-" + now.getFullYear() + "-" + String(1000 + seq).slice(-4);
      /* ضمان عدم التكرار */
      var guard = 0;
      while (S.sales.some(function (s) { return s.number === number; }) && guard++ < 500) {
        seq++; number = (S.settings.invoicePrefix || "INV") + "-" + now.getFullYear() + "-" + String(1000 + seq).slice(-4);
      }

      var subtotal = HS.round(HS.sum(items, function (l) { return l.qty * l.price; }), 3);
      var lineDisc = HS.round(HS.sum(items, function (l) { return l.discount || 0; }), 3);
      var orderDisc = HS.round(Number(payload.discount) || 0, 3);
      var taxable = HS.sum(items, function (l) {
        var p = HS.store.product(l.productId);
        return (p && p.taxable === false) ? 0 : l.qty * l.price - (l.discount || 0);
      });
      var rate = Number(S.settings.taxRate) || 0;
      var tax = HS.round((taxable / Math.max(subtotal - lineDisc, 1)) * Math.max(subtotal - lineDisc - orderDisc, 0) * (rate / 100), 3);
      var total = HS.round(Math.max(0, subtotal - lineDisc - orderDisc + tax), 3);

      var method = payload.method || "cash";
      var sale = {
        id: "s-" + Date.now().toString(36) + "-" + Math.floor(Math.random() * 1e4),
        number: number,
        date: HS.date.toStamp(now),
        customerId: payload.customerId || null,
        customerName: payload.customerId ? (HS.store.customer(payload.customerId) || {}).name || "زبون نقدي" : "زبون نقدي",
        items: items.map(function (l) {
          var lp = HS.store.product(l.productId) || {};
          return {
            productId: l.productId, name: l.name, unit: l.unit,
            brand: l.brand || lp.brand || "", size: l.size || lp.size || "",
            barcode: lp.barcode || "",
            qty: l.qty, price: l.price, cost: l.cost, discount: l.discount || 0
          };
        }),
        subtotal: subtotal,
        discount: HS.round(lineDisc + orderDisc, 3),
        tax: tax,
        total: total,
        paid: (function () {
          /* البيع بالدين لا يُعدّ مبلغًا محصّلًا ما لم يدفع العميل جزءًا وقت البيع */
          var given = payload.paid != null ? Number(payload.paid) : (method === "credit" ? 0 : total);
          return payload.status === "unpaid" ? 0 : HS.round(HS.clamp(given, 0, total), 3);
        })(),
        change: HS.round(Math.max(0, (Number(payload.paid) || (method === "credit" ? 0 : total)) - total), 3),
        method: method,
        status: payload.status || "paid",
        cashierId: (S.session.userId) || "u-1",
        note: payload.note || "",
        _local: true
      };

      S.sales.unshift(sale);

      /* خصم المخزون وتسجيل الحركة */
      items.forEach(function (l) {
        S.movements.push({
          id: "m-" + sale.id + "-" + l.productId,
          date: sale.date, productId: l.productId, type: "out", qty: l.qty,
          reason: "بيع", ref: sale.number, userId: sale.cashierId, _local: true
        });
      });

      /* دين العميل */
      if (sale.customerId && sale.status !== "paid") {
        var c = HS.store.customer(sale.customerId);
        if (c) c.balance = HS.round(c.balance + (sale.total - sale.paid), 3);
      } else if (sale.customerId && sale.method === "credit") {
        var c2 = HS.store.customer(sale.customerId);
        if (c2) c2.balance = HS.round(c2.balance + (sale.total - sale.paid), 3);
      }

      S.carts.active = [];
      recomputeStock();
      recomputeCustomers();
      HS.store.save();
      HS.bus.emit("sale:created", sale);
      HS.bus.emit("cash:change", { reason: "sale" });
      HS.bus.emit("cart:change");
      return { ok: true, sale: sale };
    },

    /** إرجاع فاتورة: يعيد الأصناف للمخزون ويعيد المبلغ */
    returnSale: function (saleId, reason) {
      var s = HS.store.sale(saleId);
      if (!s) return { ok: false, error: "الفاتورة غير موجودة" };
      if (s.status === "returned") return { ok: false, error: "هذه الفاتورة مرتجعة مسبقًا" };
      s.status = "returned";
      s.returnReason = reason || "";
      s.returnedAt = new Date().toISOString();
      s.items.forEach(function (l) {
        S.movements.push({
          id: "m-ret-" + s.id + "-" + l.productId, date: HS.date.toStamp(new Date()),
          productId: l.productId, type: "return", qty: l.qty,
          reason: "إرجاع من العميل", ref: s.number, userId: S.session.userId || "u-1", _local: true
        });
      });
      if (s.customerId && (s.status === "unpaid" || s.paid < s.total)) {
        var c = HS.store.customer(s.customerId);
        if (c) c.balance = Math.max(0, HS.round(c.balance - (s.total - s.paid), 3));
      }
      recomputeStock();
      HS.store.save();
      HS.bus.emit("sale:returned", s);
      HS.bus.emit("cash:change", { reason: "return" });
      return { ok: true, sale: s };
    },

    /** تسديد دفعة على فاتورة دين */
    paySale: function (saleId, amount, method) {
      var s = HS.store.sale(saleId);
      if (!s) return { ok: false, error: "الفاتورة غير موجودة" };
      var due = s.total - s.paid;
      var pay = HS.clamp(HS.round(Number(amount) || 0, 3), 0, due);
      if (pay <= 0) return { ok: false, error: "المبلغ غير صالح" };
      s.paid = HS.round(s.paid + pay, 3);
      s.method = method || s.method;
      s.status = s.paid >= s.total ? "paid" : "partial";
      if (s.customerId) {
        var c = HS.store.customer(s.customerId);
        if (c) c.balance = Math.max(0, HS.round(c.balance - pay, 3));
      }
      HS.store.save();
      HS.bus.emit("sale:paid", s);
      HS.bus.emit("cash:change", { reason: "settle" });
      return { ok: true, sale: s, paid: pay };
    },

    /* ═══════════ عمليات: المنتجات ═══════════ */
    saveProduct: function (data, id) {
      var isNew = !id;
      var p = isNew ? { id: "p-" + Date.now().toString(36), _local: true, createdAt: HS.date.toStamp(new Date()), opening: 0 } : HS.store.product(id);
      if (!p) return { ok: false, error: "الصنف غير موجود" };
      var name = String(data.name || "").trim();
      var brand = String(data.brand || "").trim();
      var size = String(data.size || "").trim();
      var barcode = String(data.barcode || "").replace(/[^0-9]/g, "");
      if (!name) return { ok: false, error: "اسم العطر مطلوب" };

      /* الباركود عنصر أساسي: لا يجوز أن يتكرر بين صنفَين، وكل حجم له باركوده */
      if (barcode) {
        if (barcode.length !== 13) return { ok: false, error: "الباركود يجب أن يكون 13 رقمًا (EAN-13)" };
        var clash = S.products.filter(function (x) { return x.barcode === barcode && x.id !== p.id; })[0];
        if (clash) return { ok: false, error: "هذا الباركود مستعمل مسبقًا في: " + HS.store.label(clash) };
      }

      Object.assign(p, {
        name: name,
        brand: brand,
        size: size,
        sizeNum: Number(String(size).replace(/[^0-9.]/g, "")) || 0,
        category: data.category || (HS.data.CATEGORIES[0] || {}).id || "men",
        unit: data.unit || "عبوة",
        price: HS.round(Number(data.price) || 0, 3),
        cost: HS.round(Number(data.cost) || 0, 3),
        minStock: Math.max(0, Math.round(Number(data.minStock) || 0)),
        supplierId: data.supplierId || null,
        emoji: data.emoji || "🧴",
        active: data.active !== false && data.active !== "false",
        taxable: data.taxable !== false && data.taxable !== "false"
      });
      if (data.sku) p.sku = String(data.sku).trim();
      if (!p.sku) p.sku = "YP" + String(1000 + S.products.length + 1).slice(-4);
      /* باركود مولَّد تلقائيًا إن تُرك فارغًا، مع ضمان عدم التكرار */
      if (!barcode) {
        var n = S.products.length + 1, g = 0;
        do {
          barcode = HS.barcode.ean13("6251" + String(10000 + (p.sizeNum || 0)).slice(-4) + String(1000 + n + g).slice(-4));
          g++;
        } while (S.products.some(function (x) { return x.barcode === barcode && x.id !== p.id; }) && g < 900);
      }
      p.barcode = barcode;
      if (!isNew) p._edited = true;

      if (isNew) {
        /* الصنف الجديد يبدأ برصيد افتتاحي صفر، وكميته الأولى تُسجَّل كحركة دخول
           حتى لا تُحتسب مرتين (مرة في opening ومرة في الحركات). */
        var opening = Math.max(0, Math.round(Number(data.stock) || 0));
        p.opening = 0;
        p.stock = opening;
        S.products.unshift(p);
        if (opening > 0) {
          S.movements.push({
            id: "m-init-" + p.id, date: HS.date.toStamp(new Date()), productId: p.id,
            type: "in", qty: opening, reason: "رصيد افتتاحي", ref: "INIT", userId: S.session.userId || "u-1", _local: true
          });
        }
      } else if (data.stock != null && Math.round(Number(data.stock)) !== Math.round(p.stock)) {
        HS.store.adjustStock(p.id, Number(data.stock) - p.stock, "تعديل من شاشة المنتج");
      }
      HS.store.save();
      HS.bus.emit(isNew ? "product:created" : "product:updated", p);
      return { ok: true, product: p };
    },

    deleteProduct: function (id) {
      var i = -1;
      for (var j = 0; j < S.products.length; j++) if (S.products[j].id === id) { i = j; break; }
      if (i < 0) return { ok: false, error: "الصنف غير موجود" };
      var removed = S.products.splice(i, 1)[0];
      HS.store.save();
      HS.bus.emit("product:deleted", removed);
      return { ok: true, product: removed, index: i, undo: function () {
        S.products.splice(Math.min(i, S.products.length), 0, removed);
        HS.store.save(); HS.bus.emit("product:created", removed);
      } };
    },

    adjustStock: function (productId, delta, reason) {
      var p = HS.store.product(productId);
      if (!p) return { ok: false, error: "الصنف غير موجود" };
      var d = Math.round(Number(delta) || 0);
      if (!d) return { ok: false, error: "لا يوجد تغيير في الكمية" };
      S.movements.push({
        id: "m-adj-" + Date.now().toString(36), date: HS.date.toStamp(new Date()),
        productId: p.id, type: "adjust", qty: d,
        reason: reason || (d > 0 ? "زيادة جرد" : "نقص جرد"),
        ref: "ADJ-" + String(Math.floor(Math.random() * 900) + 100),
        userId: S.session.userId || "u-1", _local: true
      });
      recomputeStock();
      HS.store.save();
      HS.bus.emit("stock:changed", p);
      return { ok: true, product: p, delta: d };
    },

    /* ═══════════ عمليات: المشتريات ═══════════ */
    savePurchase: function (data, id) {
      var isNew = !id;
      var po = isNew ? { id: "po-" + Date.now().toString(36), _local: true } : HS.store.purchase(id);
      if (!po) return { ok: false, error: "طلب الشراء غير موجود" };
      var seq = S.purchases.length + 1;
      Object.assign(po, {
        number: data.number || ("PO-" + new Date().getFullYear() + "-" + String(200 + seq).slice(-3)),
        date: data.date || HS.date.toISO(new Date()),
        expectedDate: data.expectedDate || HS.date.toISO(HS.date.addDays(new Date(), 5)),
        supplierId: data.supplierId || null,
        supplierName: data.supplierId ? (HS.store.supplier(data.supplierId) || {}).name || "" : (data.supplierName || ""),
        items: data.items || [],
        total: HS.round(HS.sum(data.items || [], function (l) { return l.qty * l.cost; }), 3),
        status: data.status || "draft",
        note: data.note || ""
      });
      po.paid = po.paid || 0;
      if (!isNew) po._edited = true;
      if (isNew) S.purchases.unshift(po);
      HS.store.save();
      HS.bus.emit(isNew ? "purchase:created" : "purchase:updated", po);
      return { ok: true, purchase: po };
    },

    receivePurchase: function (id) {
      var po = HS.store.purchase(id);
      if (!po) return { ok: false, error: "طلب الشراء غير موجود" };
      if (po.status === "received") return { ok: false, error: "تم استلام هذا الطلب مسبقًا" };
      po.status = "received";
      po.receivedAt = HS.date.toStamp(new Date());
      po.items.forEach(function (l) {
        S.movements.push({
          id: "m-po-" + po.id + "-" + l.productId, date: po.receivedAt,
          productId: l.productId, type: "in", qty: l.qty,
          reason: "استلام مشتريات", ref: po.number, userId: S.session.userId || "u-1", _local: true
        });
      });
      recomputeStock();
      HS.store.save();
      HS.bus.emit("purchase:received", po);
      return { ok: true, purchase: po };
    },

    deletePurchase: function (id) {
      var i = -1;
      for (var j = 0; j < S.purchases.length; j++) if (S.purchases[j].id === id) { i = j; break; }
      if (i < 0) return { ok: false };
      var removed = S.purchases.splice(i, 1)[0];
      HS.store.save(); HS.bus.emit("purchase:deleted", removed);
      return { ok: true, undo: function () { S.purchases.splice(Math.min(i, S.purchases.length), 0, removed); HS.store.save(); HS.bus.emit("purchase:created", removed); } };
    },

    /* ═══════════ عمليات: العملاء والموردين والمستخدمين ═══════════ */
    _saveEntity: function (coll, data, id, prefix, defaults) {
      var isNew = !id;
      var rec = isNew ? Object.assign({ id: prefix + "-" + Date.now().toString(36), _local: true, createdAt: HS.date.toStamp(new Date()) }, defaults || {}) :
        S[coll].filter(function (x) { return x.id === id; })[0];
      if (!rec) return { ok: false, error: "السجل غير موجود" };
      Object.assign(rec, data);
      if (!isNew) rec._edited = true;
      if (isNew) S[coll].unshift(rec);
      HS.store.save();
      HS.bus.emit(coll.slice(0, -1) + (isNew ? ":created" : ":updated"), rec);
      notifyCash(coll);
      return { ok: true, record: rec };
    },
    _deleteEntity: function (coll, id) {
      var i = -1;
      for (var j = 0; j < S[coll].length; j++) if (S[coll][j].id === id) { i = j; break; }
      if (i < 0) return { ok: false };
      var removed = S[coll].splice(i, 1)[0];
      HS.store.save();
      HS.bus.emit(coll.slice(0, -1) + ":deleted", removed);
      notifyCash(coll);
      return { ok: true, undo: function () {
        S[coll].splice(Math.min(i, S[coll].length), 0, removed);
        HS.store.save(); notifyCash(coll);
      } };
    },
    saveCustomer: function (d, id) { return HS.store._saveEntity("customers", d, id, "c", { balance: 0, totalSpent: 0, visits: 0, active: true, creditLimit: 0, note: "" }); },
    deleteCustomer: function (id) { return HS.store._deleteEntity("customers", id); },
    saveSupplier: function (d, id) { return HS.store._saveEntity("suppliers", d, id, "sup", { balance: 0, active: true, rating: 4, termsDays: 0 }); },
    deleteSupplier: function (id) { return HS.store._deleteEntity("suppliers", id); },
    saveUser: function (d, id) { return HS.store._saveEntity("users", d, id, "u", { active: true, permissions: [], status: "متاح" }); },
    deleteUser: function (id) {
      if (id === S.session.userId) return { ok: false, error: "لا يمكنك حذف الحساب الذي تستخدمه الآن" };
      return HS.store._deleteEntity("users", id);
    },

    /**
     * سداد من عميل: يخفض ذمته ويُسجَّل في دفتر مدفوعات مستقل
     * لا في حركة المخزون، حتى لا تختلط الأموال بالبضاعة.
     */
    customerPayment: function (customerId, amount, method, note, date) {
      var c = HS.store.customer(customerId);
      if (!c) return { ok: false, error: "العميل غير موجود" };
      var pay = HS.round(Number(amount) || 0, 3);
      if (!(pay > 0)) return { ok: false, error: "أدخل مبلغًا موجبًا" };
      if (pay > 0 && pay > c.balance + 0.001) return { ok: false, error: "المبلغ أكبر من الرصيد المستحق" };
      c.balance = HS.round(Math.max(0, c.balance - pay), 3);
      var rec = {
        id: "pay-" + Date.now().toString(36),
        date: HS.date.toStamp(date ? HS.date.toDate(date) : new Date()),
        customerId: c.id, customerName: c.name,
        amount: pay, method: method || "cash", note: note || "",
        userId: S.session.userId || "u-1", _local: true
      };
      S.payments.unshift(rec);
      HS.store.save();
      HS.bus.emit("customer:paid", c);
      HS.bus.emit("cash:change", { reason: "payment" });
      return { ok: true, amount: pay, customer: c, payment: rec };
    },

    /** دين يُضاف يدويًا على عميل: بضاعة أُخذت بلا فاتورة، أو رصيد سابق على النظام.
        يُخزَّن كقيد سالب في سجل الدفعات حتى لا يُحتسب قبضًا ولا يدخل الصندوق. */
    addDebt: function (customerId, amount, note, date) {
      var c = HS.store.customer(customerId);
      if (!c) return { ok: false, error: "العميل غير موجود" };
      var amt = HS.round(Number(amount) || 0, 3);
      if (!(amt > 0)) return { ok: false, error: "أدخل مبلغًا موجبًا" };
      var rec = {
        id: "chg-" + Date.now().toString(36),
        kind: "charge",
        date: HS.date.toStamp(date ? HS.date.toDate(date) : new Date()),
        customerId: c.id, customerName: c.name,
        amount: -amt,
        method: "none",
        note: String(note || "").trim() || "دين مضاف يدويًا",
        userId: S.session.userId || "u-1", _local: true
      };
      var before = c.balance || 0;
      c.balance = HS.round(before + amt, 3);
      S.payments.unshift(rec);
      HS.store.save();
      HS.bus.emit("customer:charged", c);
      return {
        ok: true, amount: amt, customer: c, charge: rec,
        undo: function () {
          var i = S.payments.indexOf(rec);
          if (i >= 0) S.payments.splice(i, 1);
          c.balance = before;
          HS.store.save();
        }
      };
    },

    /** مدفوعات عميل مرتبة من الأحدث */
    paymentsOf: function (customerId) {
      return (S.payments || []).filter(function (p) { return p.customerId === customerId; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    },

    /* ═══════════ عمليات: المصروفات ═══════════ */
    saveExpense: function (d, id) {
      /* التاريخ والمبلغ إلزاميان منطقيًا: مصروف بلا تاريخ يختفي من كل التقارير */
      d = Object.assign({}, d || {});
      if (!d.date) d.date = HS.date.toStamp(new Date());
      var amt = HS.round(Number(d.amount) || 0, 3);
      if (!(amt > 0)) return { ok: false, error: "أدخل مبلغًا موجبًا" };
      d.amount = amt;
      if (!d.category) d.category = (HS.data.EXPENSE_CATS[0] || {}).id || "other";
      return HS.store._saveEntity("expenses", d, id, "e", { method: "cash", recurring: false });
    },
    deleteExpense: function (id) { return HS.store._deleteEntity("expenses", id); },

    /* ═══════════ عمليات: الإعدادات والجلسة ═══════════ */
    updateSettings: function (patch) {
      Object.assign(S.settings, patch || {});
      HS.defaults = S.settings;
      HS.clearFormatCache();
      HS.store.save();
      HS.bus.emit("settings:changed", S.settings);
      return S.settings;
    },
    login: function (username, password) {
      var u = S.users.filter(function (x) { return x.username === String(username || "").trim().toLowerCase(); })[0];
      if (!u) return { ok: false, error: "لا يوجد مستخدم بهذا الاسم" };
      if (!u.active) return { ok: false, error: "هذا الحساب موقوف، راجع مدير النظام" };
      /* واجهة فقط: أي كلمة مرور من 4 أحرف فأكثر تُقبل */
      if (!password || String(password).length < 4) return { ok: false, error: "كلمة المرور قصيرة جدًا (4 أحرف على الأقل)" };
      S.session.userId = u.id;
      S.session.since = new Date().toISOString();
      S.session.username = u.username;
      u.lastLogin = HS.date.toStamp(new Date());
      HS.store.save();
      HS.bus.emit("session:start", u);
      return { ok: true, user: u };
    },
    logout: function () {
      var u = HS.store.currentUser();
      S.session = { userId: null, since: null };
      HS.store.save();
      HS.bus.emit("session:end", u);
    },
    isLoggedIn: function () { return !!S.session.userId; },

    /* ═══════════ حالة الواجهة ═══════════ */
    ui: {
      set: function (patch) { Object.assign(S.ui, patch || {}); HS.store.save(); HS.bus.emit("ui:change", S.ui); },
      get: function () { return S.ui; }
    },

    /** تصدير نسخة من البيانات كملف JSON محلي */
    /* ═══════════ الباركود والأحجام والماركات ═══════════ */

    /** اسم العرض: اسم العطر مع حجمه، لأن كل حجم صنف مستقل */
    label: function (p) {
      if (!p) return "";
      return p.name + (p.size ? " · " + p.size : "");
    },

    /** البحث بالباركود — المسار الأساسي في نقطة البيع */
    byBarcode: function (code) {
      var c = String(code || "").replace(/[^0-9]/g, "");
      if (!c) return null;
      return S.products.filter(function (p) {
        return p.barcode === c || (!/\D/.test(String(p.sku || "")) && String(p.sku) === c);
      })[0] || null;
    },

    /** هل هذا الباركود محجوز لصنف آخر؟ */
    barcodeTaken: function (code, exceptId) {
      var c = String(code || "").replace(/[^0-9]/g, "");
      return S.products.filter(function (p) { return p.barcode === c && p.id !== exceptId; })[0] || null;
    },

    /** الماركات الموجودة فعلًا في الكتالوج، مرتبة بعدد أصنافها */
    brands: function () {
      var acc = {};
      S.products.forEach(function (p) { if (p.brand) acc[p.brand] = (acc[p.brand] || 0) + 1; });
      return Object.keys(acc).sort(function (a, b) {
        return acc[b] - acc[a] || a.localeCompare(b, "ar");
      }).map(function (b) { return { name: b, count: acc[b] }; });
    },

    /** الأحجام الموجودة فعلًا، مرتبة تصاعديًا */
    sizes: function () {
      var acc = {};
      S.products.forEach(function (p) { if (p.size) acc[p.size] = p.sizeNum || 0; });
      return Object.keys(acc).sort(function (a, b) { return acc[a] - acc[b]; });
    },

    /* ═══════════ الصندوق النقدي ═══════════
       الصندوق يُبنى من «أحداث نقدية» مؤرّخة، لا من جداول منفصلة.
       كل حدث له تاريخ ومبلغ موجّه (+ دخول / − خروج)، والرصيد هو
       مجموع الأحداث. هذا يضمن أن سجل الصندوق والإجماليات لا يختلفان
       أبدًا، وأن إلغاء عملية يعكس أثرها بدقة.

       القاعدة: الصندوق يتأثر بالنقد المحصّل فعليًا فقط.
       مبيعات البطاقة والدين خارج الصندوق، والدين يدخل عند تحصيله. */
    cashEvents: function (from, to) {
      var inR = function (d) {
        return !!d && HS.store.inRange([{ date: d }], { from: from, to: to }).length > 0;
      };
      var ev = [];
      var push = function (e) { if (inR(e.date)) ev.push(e); };

      (S.sales || []).forEach(function (s) {
        if (s.status === "held") return;
        var m = s.method || "cash";
        var amt = HS.round(s.paid || 0, 3);
        /* 1) القبض وقت البيع: النقدي كاملًا، ومن الدين مقدمته إن وُجدت */
        if (amt > 0 && (m === "cash" || m === "credit")) {
          push({
            date: s.date, dir: "in", amount: amt, kind: m === "cash" ? "sale" : "downpayment",
            ref: s.number, method: "cash", saleId: s.id,
            label: m === "cash" ? "بيع نقدي — " + s.number : "مقدمة على دين — " + s.number,
            detail: s.customerName
          });
        }
        /* 2) الاسترداد عند إلغاء العملية */
        if (s.status === "returned" && amt > 0 && (m === "cash" || m === "credit")) {
          push({
            date: s.returnedAt || s.date, dir: "out", amount: amt, kind: "refund",
            ref: s.number, method: "cash", saleId: s.id,
            label: "إلغاء عملية بيع — استرداد — " + s.number,
            detail: s.returnReason || s.customerName
          });
        }
      });

      /* 3) سداد الديون نقدًا */
      (S.payments || []).forEach(function (p) {
        if ((p.method || "cash") !== "cash") return;
        if (!(p.amount > 0)) return;      /* قيد دين مضاف: لم تتحرك أموال */
        push({
          date: p.date, dir: "in", amount: HS.round(p.amount, 3), kind: "debt",
          ref: p.customerName, method: "cash", paymentId: p.id,
          label: "سداد دين — " + p.customerName, detail: p.note || ""
        });
      });

      /* 4) المصروفات النقدية */
      (S.expenses || []).forEach(function (e) {
        if ((e.method || "cash") !== "cash") return;
        var cat = (HS.data.EXPENSE_CATS.filter(function (c) { return c.id === e.category; })[0] || {}).name || e.category;
        push({
          date: e.date, dir: "out", amount: HS.round(e.amount, 3), kind: "expense",
          ref: cat, method: "cash", expenseId: e.id,
          label: "مصروف نقدي — " + cat, detail: e.note || ""
        });
      });

      /* 5) الإيداع والسحب اليدوي */
      (S.cashEntries || []).forEach(function (e) {
        push({
          date: e.date, dir: e.type === "out" ? "out" : "in", amount: HS.round(e.amount, 3),
          kind: e.type === "out" ? "withdraw" : "deposit",
          ref: e.reason, method: "cash", id: e.id,
          label: e.reason, detail: ""
        });
      });

      ev.sort(byDateAsc);
      var bal = 0;
      ev.forEach(function (e) {
        bal = HS.round(bal + (e.dir === "out" ? -e.amount : e.amount), 3);
        e.balance = bal;
      });
      return ev;
    },

    /** الرصيد النقدي المُرحَّل قبل بداية الفترة */
    cashCarried: function (range) {
      var prev = HS.store.cashEvents(new Date(0), new Date(range.from.getTime() - 1));
      return prev.length ? prev[prev.length - 1].balance : 0;
    },

    /** ملخص الصندوق لفترة: ما دخل وما خرج والرصيد المتوقع */
    cash: function (range) {
      var sumBy = function (list, method, f) {
        return HS.round(HS.sum(list.filter(function (x) { return (x.method || "cash") === method; }), f), 3);
      };
      var saleTotal = function (s) { return s.total; };
      var salePaid = function (s) { return s.paid || 0; };

      var inPeriod = HS.store.salesOf(range);
      var valid = inPeriod.filter(function (s) { return s.status !== "returned"; });

      /* قيم المبيعات حسب الطريقة — للعرض، لا لأثر الصندوق */
      var cashSales = sumBy(valid, "cash", saleTotal);
      var cardSales = sumBy(valid, "card", saleTotal);
      var creditSales = sumBy(valid, "credit", saleTotal);
      var countBy = function (method) {
        return valid.filter(function (x) { return (x.method || "cash") === method; }).length;
      };

      /* أحداث الصندوق الفعلية */
      var ev = HS.store.cashEvents(range.from, range.to);
      var of = function (kind, dir) {
        return HS.round(HS.sum(ev.filter(function (e) { return e.kind === kind && (!dir || e.dir === dir); }),
          function (e) { return e.amount; }), 3);
      };
      var cashCollected = of("sale", "in");
      var creditDownPayment = of("downpayment", "in");
      var debtCash = of("debt", "in");
      var otherIn = of("deposit", "in");
      var refunds = of("refund", "out");
      var expCash = of("expense", "out");
      var otherOut = of("withdraw", "out");

      var carried = HS.store.cashCarried(range);
      var inflow = HS.round(cashCollected + creditDownPayment + debtCash + otherIn, 3);
      var outflow = HS.round(refunds + expCash + otherOut, 3);
      var net = HS.round(inflow - outflow, 3);

      /* ما حُقّق من مبيعات لكنه ليس في الصندوق */
      var payments = HS.store.inRange(S.payments, range);
      var debtCard = HS.round(HS.sum(payments.filter(function (p) {
        return p.amount > 0 && (p.method || "cash") !== "cash";
      }), function (p) { return p.amount; }), 3);
      var expenses = HS.store.inRange(S.expenses, range);
      var expOther = HS.round(HS.sum(expenses.filter(function (e) { return (e.method || "cash") !== "cash"; }),
        function (e) { return e.amount; }), 3);

      return {
        carried: carried,
        cashSales: cashSales, cashCollected: cashCollected,
        cardSales: cardSales,
        creditSales: creditSales, creditDownPayment: creditDownPayment,
        creditOutstanding: HS.round(creditSales - creditDownPayment, 3),
        debtCash: debtCash, debtCard: debtCard, debtTotal: HS.round(debtCash + debtCard, 3),
        expCash: expCash, expOther: expOther, expTotal: HS.round(expCash + expOther, 3),
        refunds: refunds, otherIn: otherIn, otherOut: otherOut,
        inflow: inflow, outflow: outflow, net: net,
        expected: HS.round(carried + net, 3),
        notInCash: HS.round(cardSales + (creditSales - creditDownPayment) + debtCard + expOther, 3),
        cashSalesCount: countBy("cash"),
        cardSalesCount: countBy("card"),
        creditSalesCount: countBy("credit"),
        inCount: ev.filter(function (e) { return e.dir === "in"; }).length,
        outCount: ev.filter(function (e) { return e.dir === "out"; }).length,
        events: ev.length,
        count: valid.length
      };
    },

    /** سجل الصندوق: كل حركة نقدية مرتبة زمنيًا مع الرصيد المتراكم */
    cashLedger: function (range) {
      var carried = HS.store.cashCarried(range);
      var rows = HS.store.cashEvents(range.from, range.to).map(function (e) {
        return Object.assign({}, e);
      });
      var bal = carried;
      rows.forEach(function (r) {
        bal = HS.round(bal + (r.dir === "out" ? -r.amount : r.amount), 3);
        r.balance = bal;
      });
      return rows;
    },

    /** إيداع أو سحب يدوي من الصندوق */
    addCashEntry: function (d) {
      var amount = HS.round(Number(d && d.amount) || 0, 3);
      if (!(amount > 0)) return { ok: false, error: "أدخل مبلغًا موجبًا" };
      var rec = {
        id: "cash-" + Date.now().toString(36),
        date: HS.date.toStamp(d && d.date ? HS.date.toDate(d.date) : new Date()),
        type: d && d.type === "out" ? "out" : "in",
        amount: amount,
        reason: String((d && d.reason) || "").trim() || (d && d.type === "out" ? "سحب من الصندوق" : "إيداع في الصندوق"),
        userId: S.session.userId || "u-1",
        _local: true
      };
      S.cashEntries = S.cashEntries || [];
      S.cashEntries.unshift(rec);
      HS.store.save();
      HS.bus.emit("cash:change", rec);
      return { ok: true, entry: rec };
    },

    deleteCashEntry: function (id) {
      var i = (S.cashEntries || []).filter(function (e) { return e.id === id; })[0];
      if (!i) return { ok: false, error: "العملية غير موجودة" };
      var undo = function () { S.cashEntries.unshift(i); HS.store.save(); HS.bus.emit("cash:change"); };
      S.cashEntries = S.cashEntries.filter(function (e) { return e.id !== id; });
      HS.store.save();
      HS.bus.emit("cash:change");
      return { ok: true, undo: undo };
    },

    /* ═══════════ الديون ═══════════ */
    debts: function (range) {
      var sales = HS.store.salesOf(range).filter(function (s) {
        return s.method === "credit" && s.status !== "returned";
      });
      var salesGranted = HS.round(HS.sum(sales, function (s) { return s.total; }), 3);
      var downPaid = HS.round(HS.sum(sales, function (s) { return s.paid || 0; }), 3);
      var payRows = HS.store.inRange(S.payments, range);
      var payments = payRows.filter(function (p) { return p.amount > 0; });
      var collected = HS.round(HS.sum(payments, function (p) { return p.amount; }), 3);
      /* ديون أُضيفت يدويًا (بضاعة بلا فاتورة أو رصيد سابق) — تُعدّ دينًا ممنوحًا */
      var chargeRows = payRows.filter(function (p) { return p.kind === "charge"; });
      var chargesGranted = HS.round(HS.sum(chargeRows, function (p) { return Math.abs(p.amount); }), 3);
      var granted = HS.round(salesGranted + chargesGranted, 3);

      var unpaid = sales.filter(function (s) { return s.status === "unpaid"; });
      var partial = sales.filter(function (s) { return s.status === "partial"; });
      var settled = sales.filter(function (s) { return s.status === "paid"; });

      var debtors = S.customers.filter(function (c) { return (c.balance || 0) > 0.001; })
        .sort(function (a, b) { return b.balance - a.balance; })
        .map(function (c) {
          return {
            id: c.id, name: c.name, phone: c.phone, city: c.city,
            balance: HS.round(c.balance, 3),
            totalPaid: HS.round(c.totalPaid || 0, 3),
            creditLimit: c.creditLimit || 0,
            overLimit: !!(c.creditLimit && c.balance > c.creditLimit),
            lastVisit: c.lastVisit || null
          };
        });

      return {
        granted: granted,
        salesGranted: salesGranted,
        chargesGranted: chargesGranted,
        chargeCount: chargeRows.length,
        downPaid: downPaid,
        collected: collected,
        collectedCount: payments.length,
        totalCollected: HS.round(downPaid + collected, 3),
        rangeOutstanding: HS.round(granted - downPaid - collected, 3),
        outstandingNow: HS.round(HS.sum(S.customers, function (c) { return c.balance || 0; }), 3),
        unpaidCount: unpaid.length,
        unpaidValue: HS.round(HS.sum(unpaid, function (s) { return s.total - (s.paid || 0); }), 3),
        partialCount: partial.length,
        partialValue: HS.round(HS.sum(partial, function (s) { return s.total - (s.paid || 0); }), 3),
        settledCount: settled.length,
        settledValue: HS.round(HS.sum(settled, function (s) { return s.total; }), 3),
        debtors: debtors,
        overdue: HS.store.overdue ? HS.store.overdue() : []
      };
    },

    exportJSON: function () {
      return JSON.stringify({ exportedAt: new Date().toISOString(), store: S }, null, 2);
    }
  };
})();
