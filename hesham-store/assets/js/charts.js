/* ═══════════════════════════════════════════════════════════
   charts.js — رسوم SVG مكتوبة يدويًا، بلا مكتبات خارجية ولا CDN.
   line / area / bar / donut / spark / hbar
   كلها تستجيب للون الرموز الحالية، وتحترم prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  var NS = "http://www.w3.org/2000/svg";

  function reduced() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** مقياس خطي بسيط */
  function scale(d0, d1, r0, r1) {
    var span = (d1 - d0) || 1;
    return function (v) { return r0 + ((v - d0) / span) * (r1 - r0); };
  }

  /** حدود محور مقروءة: 0، 5، 10… بدل 4327.81 */
  function niceMax(v) {
    if (v <= 0) return 10;
    var exp = Math.floor(Math.log10(v));
    var base = Math.pow(10, exp);
    var n = v / base;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * base;
  }

  function ticks(max, count) {
    var out = [];
    for (var i = 0; i <= count; i++) out.push((max / count) * i);
    return out;
  }

  function path(points, smooth) {
    if (!points.length) return "";
    if (!smooth || points.length < 3) {
      return points.map(function (p, i) { return (i ? "L" : "M") + p[0].toFixed(2) + " " + p[1].toFixed(2); }).join(" ");
    }
    // منحنى monotone مبسّط: نقاط تحكم عند ثلث المسافة، بلا تجاوز
    var d = "M" + points[0][0].toFixed(2) + " " + points[0][1].toFixed(2);
    for (var i = 0; i < points.length - 1; i++) {
      var p0 = points[i], p1 = points[i + 1];
      var cx = (p0[0] + p1[0]) / 2;
      d += " C" + cx.toFixed(2) + " " + p0[1].toFixed(2) + "," + cx.toFixed(2) + " " + p1[1].toFixed(2) +
           "," + p1[0].toFixed(2) + " " + p1[1].toFixed(2);
    }
    return d;
  }

  /**
   * مخطط خطي/مساحي
   * opt: {labels:[], series:[{name,values,color,area}], height, yFormat, smooth, showDots, showGrid}
   */
  HS.chart = {};

  HS.chart.line = function (opt) {
    var W = 720, H = opt.height || 250;
    var pad = { t: 14, r: 14, b: 30, l: 52 };
    if (opt.compact) { pad = { t: 10, r: 8, b: 22, l: 40 }; }
    var labels = opt.labels || [];
    var series = opt.series || [];
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values.map(Number)); });
    var max = niceMax(Math.max.apply(null, all.concat([0])) * 1.08);
    var min = opt.zero === false ? Math.min.apply(null, all) * 0.92 : 0;
    if (min > 0 && opt.zero !== false) min = 0;

    var x = scale(0, Math.max(labels.length - 1, 1), pad.l, W - pad.r);
    var y = scale(min, max, H - pad.b, pad.t);
    var gid = "g" + Math.random().toString(36).slice(2, 8);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + HS.esc(opt.ariaLabel || "مخطط خطي") + '">';
    s += '<defs>';
    series.forEach(function (se, i) {
      var c = se.color || "var(--primary)";
      s += '<linearGradient id="' + gid + i + '" x1="0" y1="0" x2="0" y2="1">' +
           '<stop offset="0%" stop-color="' + c + '" stop-opacity=".22"/>' +
           '<stop offset="100%" stop-color="' + c + '" stop-opacity="0"/></linearGradient>';
    });
    s += '</defs>';

    // شبكة أفقية + تسميات المحور الصادي
    var t = ticks(max, opt.compact ? 3 : 4);
    t.forEach(function (v) {
      var yy = y(v);
      s += '<line x1="' + pad.l + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + yy.toFixed(1) +
           '" stroke="var(--grid-line)" stroke-width="1" />';
      if (!opt.hideYLabels) {
        s += '<text x="' + (pad.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="var(--text-3)" ' +
             'style="font-variant-numeric:tabular-nums">' + HS.esc(opt.yFormat ? opt.yFormat(v) : HS.fmt.num(v, { maximumFractionDigits: 0 })) + '</text>';
      }
    });

    // تسميات المحور السيني: نخفّفها حتى لا تتزاحم
    var stride = Math.max(1, Math.ceil(labels.length / (opt.compact ? 5 : 9)));
    labels.forEach(function (lb, i) {
      if (i % stride !== 0 && i !== labels.length - 1) return;
      s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - pad.b + 17) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' +
           HS.esc(lb) + '</text>';
    });

    series.forEach(function (se, si) {
      var pts = se.values.map(function (v, i) { return [x(i), y(Number(v))]; });
      var c = se.color || "var(--primary)";
      if (se.area !== false) {
        var fill = path(pts, opt.smooth !== false) +
          " L" + pts[pts.length - 1][0].toFixed(2) + " " + (H - pad.b) +
          " L" + pts[0][0].toFixed(2) + " " + (H - pad.b) + " Z";
        s += '<path d="' + fill + '" fill="url(#' + gid + si + ')" />';
      }
      s += '<path d="' + path(pts, opt.smooth !== false) + '" fill="none" stroke="' + c + '" stroke-width="' + (se.width || 2.2) +
           '" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />';
      if (opt.showDots && pts.length <= 40) {
        pts.forEach(function (p, i) {
          s += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6" fill="var(--surface)" stroke="' + c +
               '" stroke-width="1.8" data-i="' + i + '" data-s="' + si + '" />';
        });
      }
      // مناطق تفاعل غير مرئية للتلميح
      pts.forEach(function (p, i) {
        s += '<rect class="chart-hit" x="' + (p[0] - (W / Math.max(pts.length, 1)) / 2).toFixed(1) + '" y="' + pad.t +
             '" width="' + (W / Math.max(pts.length, 1)).toFixed(1) + '" height="' + (H - pad.t - pad.b) +
             '" fill="transparent" data-i="' + i + '" data-s="' + si + '" />';
      });
    });

    s += '</svg>';
    return { html: s, labels: labels, series: series, x: x, y: y, pad: pad, W: W, H: H };
  };

  /** مخطط أعمدة رأسية، يدعم مجموعات */
  HS.chart.bar = function (opt) {
    var W = opt.width || 720, H = opt.height || 240;
    var pad = { t: 14, r: 12, b: 34, l: 52 };
    if (opt.compact) pad = { t: 10, r: 8, b: 26, l: 42 };
    var labels = opt.labels || [];
    var series = opt.series || [];
    var stacked = !!opt.stacked;

    var maxes = labels.map(function (_, i) {
      if (stacked) return HS.sum(series, function (s) { return Number(s.values[i]) || 0; });
      return Math.max.apply(null, series.map(function (s) { return Number(s.values[i]) || 0; }).concat([0]));
    });
    var max = niceMax(Math.max.apply(null, maxes.concat([0])) * 1.06);
    var x = scale(0, labels.length, pad.l, W - pad.r);
    var y = scale(0, max, H - pad.b, pad.t);
    var band = (W - pad.l - pad.r) / Math.max(labels.length, 1);
    var bw = Math.min(band * 0.62, opt.maxBar || 42);
    var groupW = stacked ? bw : bw * series.length + 3 * (series.length - 1);

    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + HS.esc(opt.ariaLabel || "مخطط أعمدة") + '">';
    ticks(max, opt.compact ? 3 : 4).forEach(function (v) {
      var yy = y(v);
      s += '<line x1="' + pad.l + '" y1="' + yy.toFixed(1) + '" x2="' + (W - pad.r) + '" y2="' + yy.toFixed(1) + '" stroke="var(--grid-line)" />';
      if (!opt.hideYLabels) {
        s += '<text x="' + (pad.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end" font-size="10.5" fill="var(--text-3)" ' +
             'style="font-variant-numeric:tabular-nums">' + HS.esc(opt.yFormat ? opt.yFormat(v) : HS.fmt.num(v, { maximumFractionDigits: 0 })) + '</text>';
      }
    });

    labels.forEach(function (lb, i) {
      var cx = pad.l + band * i + band / 2;
      var baseY = H - pad.b;
      if (stacked) {
        var acc = 0;
        series.forEach(function (se, si) {
          var v = Number(se.values[i]) || 0;
          var h = (baseY - y(v + acc)) - (baseY - y(acc));
          var top = y(acc + v);
          acc += v;
          if (h <= 0.4) return;
          s += '<rect class="chart-hit" x="' + (cx - bw / 2).toFixed(1) + '" y="' + top.toFixed(1) + '" width="' + bw.toFixed(1) +
               '" height="' + Math.max(h, 0.6).toFixed(1) + '" rx="2.5" fill="' + (se.color || "var(--primary)") +
               '" data-i="' + i + '" data-s="' + si + '"/>';
        });
      } else {
        series.forEach(function (se, si) {
          var v = Number(se.values[i]) || 0;
          var h = baseY - y(v);
          var bx = cx - groupW / 2 + si * (bw + 3);
          if (h <= 0.4) {
            s += '<rect x="' + bx.toFixed(1) + '" y="' + (baseY - 1.5).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="1.5" rx="1" fill="' + (se.color || "var(--primary)") + '" opacity=".4"/>';
            return;
          }
          s += '<rect class="chart-hit" x="' + bx.toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + bw.toFixed(1) +
               '" height="' + h.toFixed(1) + '" rx="2.5" fill="' + (se.color || "var(--primary)") + '" data-i="' + i + '" data-s="' + si + '"/>';
        });
      }
      if (i % Math.max(1, Math.ceil(labels.length / (opt.compact ? 5 : 10))) === 0 || i === labels.length - 1) {
        s += '<text x="' + cx.toFixed(1) + '" y="' + (H - pad.b + 17) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + HS.esc(lb) + '</text>';
      }
    });
    s += '</svg>';
    return { html: s, labels: labels, series: series };
  };

  /** مخطط دائري (donut) مع مركز اختياري */
  HS.chart.donut = function (opt) {
    var size = opt.size || 200;
    var r = size / 2, inner = r * (opt.thickness != null ? opt.thickness : 0.62);
    var data = (opt.data || []).filter(function (d) { return Number(d.value) > 0; });
    var total = HS.sum(data, function (d) { return d.value; }) || 1;
    var a0 = -Math.PI / 2;
    var s = '<svg viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + HS.esc(opt.ariaLabel || "مخطط دائري") + '">';

    if (!data.length) {
      s += '<circle cx="' + r + '" cy="' + r + '" r="' + ((r + inner) / 2).toFixed(1) + '" fill="none" stroke="var(--surface-3)" stroke-width="' + (r - inner).toFixed(1) + '"/>';
    }

    data.forEach(function (d) {
      var frac = d.value / total;
      var a1 = a0 + frac * Math.PI * 2;
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      var gap = data.length > 1 ? 0.012 : 0;
      var sa = a0 + gap, ea = a1 - gap;
      if (ea <= sa) { sa = a0; ea = a1; }
      var p = function (ang, rad) { return [(r + rad * Math.cos(ang)).toFixed(2), (r + rad * Math.sin(ang)).toFixed(2)]; };
      var o1 = p(sa, r), o2 = p(ea, r), i1 = p(ea, inner), i2 = p(sa, inner);
      s += '<path class="chart-hit" data-label="' + HS.esc(d.label) + '" data-value="' + d.value + '" d="M' + o1.join(" ") +
           " A" + r + " " + r + " 0 " + large + " 1 " + o2.join(" ") +
           " L" + i1.join(" ") + " A" + inner + " " + inner + " 0 " + large + " 0 " + i2.join(" ") + ' Z" fill="' + (d.color || "var(--primary)") +
           '" stroke="var(--surface)" stroke-width="1.5"/>';
      a0 = a1;
    });

    if (opt.center) {
      s += '<text x="' + r + '" y="' + (r - 2) + '" text-anchor="middle" font-size="' + (opt.centerSize || 20) +
           '" font-weight="700" fill="var(--text)" style="font-variant-numeric:tabular-nums">' + HS.esc(opt.center) + '</text>';
      if (opt.centerSub) {
        s += '<text x="' + r + '" y="' + (r + 16) + '" text-anchor="middle" font-size="10.5" fill="var(--text-3)">' + HS.esc(opt.centerSub) + '</text>';
      }
    }
    s += '</svg>';
    return { html: s, total: total };
  };

  /** خط مصغّر داخل بطاقة مؤشر */
  HS.chart.spark = function (values, opt) {
    opt = opt || {};
    var W = opt.width || 160, H = opt.height || 34, p = 3;
    var vals = values.map(Number);
    var max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    if (max === min) { max = min + 1; }
    var x = scale(0, Math.max(vals.length - 1, 1), p, W - p);
    var y = scale(min, max, H - p, p);
    var pts = vals.map(function (v, i) { return [x(i), y(v)]; });
    var color = opt.color || "var(--primary)";
    var gid = "s" + Math.random().toString(36).slice(2, 8);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true" style="height:' + H + 'px">';
    s += '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
         '<stop offset="0%" stop-color="' + color + '" stop-opacity=".2"/>' +
         '<stop offset="100%" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>';
    var d = path(pts, true);
    s += '<path d="' + d + ' L' + pts[pts.length - 1][0].toFixed(1) + ' ' + H + ' L' + pts[0][0].toFixed(1) + ' ' + H + ' Z" fill="url(#' + gid + ')"/>';
    s += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
    s += '<circle cx="' + pts[pts.length - 1][0].toFixed(1) + '" cy="' + pts[pts.length - 1][1].toFixed(1) + '" r="2.4" fill="' + color + '"/>';
    s += '</svg>';
    return s;
  };

  /** أعمدة أفقية للترتيب */
  HS.chart.hbar = function (items, opt) {
    opt = opt || {};
    var max = Math.max.apply(null, items.map(function (i) { return Number(i.value) || 0; }).concat([1]));
    return items.map(function (it, idx) {
      var pctv = ((Number(it.value) || 0) / max) * 100;
      return '<div class="rank__item">' +
        '<span class="rank__n">' + HS.fmt.int(idx + 1) + '</span>' +
        '<span class="grow" style="min-width:0">' +
          '<span class="row spread" style="gap:var(--sp-2)">' +
            '<span class="truncate fw-500 fs-sm">' + HS.esc(it.label) + '</span>' +
            '<span class="fs-sm fw-600 tabular">' + HS.esc(opt.format ? opt.format(it.value) : HS.fmt.num(it.value)) + '</span>' +
          '</span>' +
          '<span class="progress rank__bar"><span class="progress__fill" style="width:' + pctv.toFixed(1) + '%;' +
            (it.color ? 'background:' + it.color : '') + '"></span></span>' +
        '</span>' +
        '<span class="sr-only"></span>' +
      '</div>';
    }).join("");
  };

  /**
   * يربط تلميحًا تفاعليًا بمخطط.
   * يستمع إلى حركة المؤشر على .chart-hit ويحدّث .chart-tip داخل الحاوية.
   */
  HS.chart.attachTip = function (container, buildTip) {
    if (!container || reduced()) return;
    var tip = container.querySelector(".chart-tip");
    if (!tip) {
      tip = HS.el("div.chart-tip");
      container.style.position = "relative";
      container.appendChild(tip);
    }
    var svg = container.querySelector("svg");
    if (!svg) return;

    function show(ev) {
      var hit = ev.target.closest ? ev.target.closest(".chart-hit") : null;
      if (!hit) { tip.setAttribute("data-open", "false"); return; }
      var text = buildTip(hit);
      if (!text) { tip.setAttribute("data-open", "false"); return; }
      tip.innerHTML = text;
      var box = container.getBoundingClientRect();
      var hb = hit.getBoundingClientRect();
      tip.style.left = (hb.left - box.left + hb.width / 2) + "px";
      tip.style.top = (hb.top - box.top + hb.height / 2) + "px";
      tip.setAttribute("data-open", "true");
    }
    svg.addEventListener("pointermove", show);
    svg.addEventListener("pointerleave", function () { tip.setAttribute("data-open", "false"); });
  };

  HS.chart.legend = function (items) {
    return '<div class="chart-legend">' + items.map(function (i) {
      return '<span class="chart-legend__item"><span class="chart-legend__sw" style="background:' + i.color + '"></span>' + HS.esc(i.label) + '</span>';
    }).join("") + '</div>';
  };

  /** لوحة ألوان متسقة مع الرموز */
  HS.chart.palette = [
    "var(--primary)", "var(--accent)", "var(--info)", "var(--warning)",
    "var(--success)", "var(--danger)", "color-mix(in srgb, var(--primary) 55%, var(--info))",
    "color-mix(in srgb, var(--accent) 60%, var(--warning))"
  ];
})();
