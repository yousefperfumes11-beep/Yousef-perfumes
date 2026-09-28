/* ═══════════════════════════════════════════════════════════
   barcode.js — مولّد Code 128 (المجموعة B) مكتوب بالكامل هنا،
   بلا مكتبات خارجية. يُخرج SVG قابلًا للطباعة والقياس.
   ═══════════════════════════════════════════════════════════ */
(function () {
  "use strict";
  var HS = window.HS;

  /* جدول أنماط Code 128: كل رمز = 6 عروض (قضيب/فراغ بالتناوب)،
     ورمز التوقف = 7 عروض. الفهرس = قيمة الرمز.                    */
  var PATTERNS = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112123","112321","132121","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131",
    "211412",  /* 103 Start A */
    "211214",  /* 104 Start B */
    "211232",  /* 105 Start C */
    "2331112"  /* 106 Stop    */
  ];
  var START_B = 104, STOP = 106;

  /** قيمة الرمز لمحرف في المجموعة B */
  function charValue(ch) {
    var c = ch.charCodeAt(0);
    if (c < 32 || c > 126) return null;   /* خارج نطاق B */
    return c - 32;
  }

  /** يحسب رمز التحقق (mod 103) */
  HS.barcode = {};

  HS.barcode.checksum = function (text) {
    var values = [];
    for (var i = 0; i < text.length; i++) {
      var v = charValue(text[i]);
      if (v == null) throw new Error("محرف غير مدعوم في Code 128B: " + text[i]);
      values.push(v);
    }
    var sum = START_B;
    for (var j = 0; j < values.length; j++) sum += values[j] * (j + 1);
    return { check: sum % 103, values: values };
  };

  /**
   * يعيد قائمة الوحدات (modules) كسلسلة من القضبان.
   * كل عنصر: {x, w} بوحدات الموديول.
   */
  HS.barcode.encode = function (text) {
    text = String(text == null ? "" : text);
    if (!text.length) return { bars: [], modules: 0, check: 0 };
    var res = HS.barcode.checksum(text);
    var symbols = [START_B].concat(res.values, [res.check, STOP]);
    var bars = [];
    var x = 0;
    symbols.forEach(function (sym) {
      var pat = PATTERNS[sym];
      for (var k = 0; k < pat.length; k++) {
        var w = parseInt(pat[k], 10);
        if (k % 2 === 0) bars.push({ x: x, w: w });   /* المواضع الزوجية = قضبان */
        x += w;
      }
    });
    return { bars: bars, modules: x, check: res.check };
  };

  /**
   * يرسم SVG
   * opt: {height=52, moduleWidth=2, quiet=10, text=true, bg="#fff", fg="#111", fontSize=11}
   */
  HS.barcode.svg = function (text, opt) {
    opt = opt || {};
    var enc = HS.barcode.encode(text);
    if (!enc.modules) {
      return '<svg viewBox="0 0 200 52" aria-label="لا يوجد رمز"><text x="100" y="30" text-anchor="middle" font-size="11" fill="#999">لا يوجد رمز صالح</text></svg>';
    }
    var mw = opt.moduleWidth || 2;
    var h = opt.height || 52;
    var quiet = (opt.quiet != null ? opt.quiet : 10) * mw;
    var showText = opt.text !== false;
    var textH = showText ? (opt.fontSize || 11) + 5 : 0;
    var totalW = enc.modules * mw + quiet * 2;
    var totalH = h + textH;
    var bg = opt.bg || "#ffffff";
    var fg = opt.fg || "#111111";

    var s = '<svg xmlns="' + 'http://www.w3.org/2000/svg' + '" viewBox="0 0 ' + totalW + ' ' + totalH +
            '" width="' + totalW + '" height="' + totalH + '" role="img" aria-label="باركود ' + HS.esc(text) + '">';
    if (bg !== "none") s += '<rect width="' + totalW + '" height="' + totalH + '" fill="' + bg + '"/>';
    enc.bars.forEach(function (b) {
      s += '<rect x="' + (quiet + b.x * mw) + '" y="0" width="' + (b.w * mw) + '" height="' + h + '" fill="' + fg + '"/>';
    });
    if (showText) {
      s += '<text x="' + (totalW / 2) + '" y="' + (h + textH - 4) + '" text-anchor="middle" font-size="' + (opt.fontSize || 11) +
           '" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" letter-spacing="1.4" fill="' + fg + '">' + HS.esc(text) + '</text>';
    }
    s += '</svg>';
    return s;
  };

  /* ─────────── توليد رموز داخلية للمنتجات ─────────── */

  /** رمز منتج داخلي: HS-NNNN مع خانة تحقق */
  HS.barcode.makeSKU = function (n) {
    var body = "HS" + String(1000 + n).slice(-4);
    return body + HS.barcode.mod10(body.replace(/\D/g, ""));
  };

  /** خانة تحقق بالنمط العشري (Luhn) لسلاسل الأرقام */
  HS.barcode.mod10 = function (digits) {
    var sum = 0, alt = false;
    for (var i = digits.length - 1; i >= 0; i--) {
      var d = parseInt(digits[i], 10) || 0;
      if (alt) { d *= 2; if (d > 9) d -= 9; }
      sum += d; alt = !alt;
    }
    return String((10 - (sum % 10)) % 10);
  };

  /** EAN-13 كامل من 12 رقمًا */
  HS.barcode.ean13 = function (d12) {
    var s = String(d12).replace(/\D/g, "").slice(0, 12);
    while (s.length < 12) s = "0" + s;
    var sum = 0;
    for (var i = 0; i < 12; i++) sum += parseInt(s[i], 10) * (i % 2 === 0 ? 1 : 3);
    return s + String((10 - (sum % 10)) % 10);
  };

  /** هل النص يبدو باركودًا صالحًا؟ */
  HS.barcode.isValid = function (text) {
    var t = String(text || "").trim();
    if (!t.length || t.length > 40) return false;
    for (var i = 0; i < t.length; i++) if (charValue(t[i]) == null) return false;
    return true;
  };

  /**
   * يحوّل رقمًا عشوائيًا إلى سلسلة أعمدة تشبه الباركود (للزخرفة في شاشة المسح).
   * ليست ترميزًا حقيقيًا، بل مؤشر بصري.
   */
  HS.barcode.deco = function (seed, count) {
    var r = HS.rngHelpers(seed || 7);
    var out = [];
    for (var i = 0; i < (count || 48); i++) out.push(r.int(1, 3));
    return out;
  };

  /* ═══════════════ EAN-13 ═══════════════
     ترميز حقيقي وفق المواصفة: 95 وحدة، حراس بداية/وسط/نهاية،
     وستة أرقام يسارية بنمط تكافؤ يحدده الرقم الأول.           */

  var EAN_L = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
  var EAN_G = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
  var EAN_R = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
  var EAN_PARITY = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];

  /** يبني سلسلة الوحدات الثنائية (95 محرفًا) لرمز EAN-13 كامل */
  HS.barcode.ean13bits = function (code13) {
    var s = String(code13).replace(/\D/g, "");
    if (s.length !== 13) return null;
    var parity = EAN_PARITY[parseInt(s[0], 10)];
    var bits = "101";
    for (var i = 1; i <= 6; i++) {
      var d = parseInt(s[i], 10);
      bits += parity[i - 1] === "L" ? EAN_L[d] : EAN_G[d];
    }
    bits += "01010";
    for (var j = 7; j <= 12; j++) bits += EAN_R[parseInt(s[j], 10)];
    bits += "101";
    return bits;
  };

  /**
   * يرسم EAN-13 كـ SVG.
   * opt: {height=52, moduleWidth=2, quiet=8, text=true, fontSize=11, bg, fg}
   */
  HS.barcode.ean13svg = function (code, opt) {
    opt = opt || {};
    var s13 = HS.barcode.ean13(code);
    var bits = HS.barcode.ean13bits(s13);
    if (!bits) {
      return '<svg viewBox="0 0 200 52" role="img" aria-label="رمز غير صالح">' +
             '<text x="100" y="30" text-anchor="middle" font-size="11" fill="#999">أدخل 12 أو 13 رقمًا</text></svg>';
    }
    var mw = opt.moduleWidth || 2;
    var h = opt.height || 52;
    var quiet = (opt.quiet != null ? opt.quiet : 8) * mw;
    var showText = opt.text !== false;
    var fs = opt.fontSize || 11;
    var totalW = bits.length * mw + quiet * 2;
    var totalH = h + (showText ? fs + 6 : 0);
    var bg = opt.bg || "#ffffff";
    var fg = opt.fg || "#111111";

    var out = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + totalW + ' ' + totalH +
              '" width="' + totalW + '" height="' + totalH + '" role="img" aria-label="باركود EAN-13 ' + HS.esc(s13) + '">';
    if (bg !== "none") out += '<rect width="' + totalW + '" height="' + totalH + '" fill="' + bg + '"/>';

    /* القضبان: ندمج الوحدات المتجاورة ذات القيمة 1 */
    var i = 0;
    while (i < bits.length) {
      if (bits[i] === "1") {
        var j = i;
        while (j < bits.length && bits[j] === "1") j++;
        out += '<rect x="' + (quiet + i * mw) + '" y="0" width="' + ((j - i) * mw) + '" height="' + h + '" fill="' + fg + '"/>';
        i = j;
      } else i++;
    }
    if (showText) {
      var y = h + fs + 1;
      out += '<text x="' + (quiet + 1 * mw) + '" y="' + y + '" font-size="' + fs + '" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="' + fg + '">' + HS.esc(s13[0]) + '</text>';
      out += '<text x="' + (totalW / 2) + '" y="' + y + '" text-anchor="middle" font-size="' + fs + '" letter-spacing="2" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="' + fg + '">' + HS.esc(s13.slice(1, 7)) + '</text>';
      out += '<text x="' + (totalW - quiet - 1 * mw) + '" y="' + y + '" text-anchor="end" font-size="' + fs + '" letter-spacing="2" font-family="ui-monospace,SFMono-Regular,Menlo,monospace" fill="' + fg + '">' + HS.esc(s13.slice(7)) + '</text>';
    }
    out += '</svg>';
    return out;
  };
})();
