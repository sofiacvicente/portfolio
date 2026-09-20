/* SOFIA — photo lab
   Vintage effects drawn in the browser, so any photo you drop into img/ gets them.
   Use:  <figure class="ph" data-fx="booth"> … </figure>
   Effects: film · booth · bw · dissolve · motion · streak
   Options (on the same figure): data-dir="left|right" (dissolve / motion), data-strength="0.5–1.5" */
(function () {
  "use strict";

  var book = document.getElementById("book");
  if (!book) return;
  var jobs = Array.prototype.slice.call(book.querySelectorAll("img[data-fx]"));
  if (!jobs.length) return;
  document.documentElement.classList.add("lab-on");

  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  /* ------------------------------------------------------------ helpers */
  function random(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function luma(d, n) {
    var L = new Float32Array(n);
    for (var i = 0, j = 0; i < n; i++, j += 4) L[i] = 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];
    return L;
  }
  function boxH(src, w, h, r) {
    r = Math.max(1, Math.round(r));
    var out = new Float32Array(src.length), inv = 1 / (2 * r + 1);
    for (var y = 0; y < h; y++) {
      var row = y * w, acc = 0, k;
      for (k = -r; k <= r; k++) acc += src[row + (k < 0 ? 0 : k >= w ? w - 1 : k)];
      for (var x = 0; x < w; x++) {
        out[row + x] = acc * inv;
        var a = x + r + 1, b = x - r;
        acc += src[row + (a >= w ? w - 1 : a)] - src[row + (b < 0 ? 0 : b)];
      }
    }
    return out;
  }
  function boxV(src, w, h, r) {
    r = Math.max(1, Math.round(r));
    var out = new Float32Array(src.length), inv = 1 / (2 * r + 1);
    for (var x = 0; x < w; x++) {
      var acc = 0, k;
      for (k = -r; k <= r; k++) acc += src[(k < 0 ? 0 : k >= h ? h - 1 : k) * w + x];
      for (var y = 0; y < h; y++) {
        out[y * w + x] = acc * inv;
        var a = y + r + 1, b = y - r;
        acc += src[(a >= h ? h - 1 : a) * w + x] - src[(b < 0 ? 0 : b) * w + x];
      }
    }
    return out;
  }
  function blur(src, w, h, r) { // ~gaussian
    return boxV(boxH(boxV(boxH(src, w, h, r), w, h, r), w, h, r), w, h, r);
  }
  function smear(src, w, h, r, passes) { // horizontal only
    for (var p = 0; p < passes; p++) src = boxH(src, w, h, r);
    return src;
  }
  function lut(stops) { // [[pos 0–1, [r,g,b]], …] → 256×3 gradient map
    var t = new Uint8ClampedArray(768);
    for (var i = 0; i < 256; i++) {
      var v = i / 255, k = 0;
      while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
      var a = stops[k], b = stops[k + 1];
      var f = Math.min(1, Math.max(0, (v - a[0]) / (b[0] - a[0])));
      for (var c = 0; c < 3; c++) t[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * f;
    }
    return t;
  }
  function grain(R, amount) { return (R() + R() - 1) * amount; }
  function vig(x, y, w, h) {
    var dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
    return dx * dx * 0.55 + dy * dy * 0.45;
  }
  function normalise(L, n, target) { // shift mean brightness so every photo reacts alike
    var sum = 0;
    for (var i = 0; i < n; i += 7) sum += L[i];
    var mean = sum / Math.ceil(n / 7), shift = target - mean;
    for (i = 0; i < n; i++) L[i] += shift * 0.7;
  }
  function writeMapped(d, n, V, table) {
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      var v = V[i] < 0 ? 0 : V[i] > 255 ? 255 : V[i] | 0;
      d[j] = table[v * 3]; d[j + 1] = table[v * 3 + 1]; d[j + 2] = table[v * 3 + 2];
    }
  }

  /* ------------------------------------------------------------ effects */
  var FX = {};

  // faded colour film: lifted blacks, warm highlights, green shadows, halation, grain
  FX.film = function (d, w, h, o, R) {
    var n = w * h, L = luma(d, n), hi = new Float32Array(n), i, x, y, j;
    for (i = 0; i < n; i++) hi[i] = L[i] > 185 ? L[i] - 185 : 0;
    hi = blur(hi, w, h, w * 0.012);
    var s = o.strength;
    for (y = 0, i = 0, j = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++, j += 4) {
        var r = d[j], g = d[j + 1], b = d[j + 2], l = L[i] / 255;
        r = 18 + r * 0.87 + 7 * l;
        g = 15 + g * 0.87 + 9 * (1 - l) * (1 - l);
        b = 24 + b * 0.76;
        var m = 0.299 * r + 0.587 * g + 0.114 * b;
        r = m + (r - m) * 0.84; g = m + (g - m) * 0.84; b = m + (b - m) * 0.84;
        var hv = hi[i] * s;
        r += hv * 0.75; g += hv * 0.3; b += hv * 0.1;
        var v = 1 - 0.32 * vig(x, y, w, h), gr = grain(R, 20 * s);
        d[j] = r * v + gr; d[j + 1] = g * v + gr; d[j + 2] = b * v + gr;
      }
    }
  };

  // photobooth print: soft sepia, lifted blacks, strong vignette, grain (dust is drawn after)
  var SEPIA = lut([[0, [34, 23, 16]], [0.3, [92, 67, 49]], [0.62, [170, 142, 113]], [0.85, [222, 204, 176]], [1, [246, 238, 222]]]);
  FX.booth = function (d, w, h, o, R) {
    var n = w * h, L = luma(d, n), i, x, y;
    normalise(L, n, 132);
    var soft = blur(L, w, h, w * 0.004);
    var V = new Float32Array(n);
    for (y = 0, i = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++) {
        var l = L[i] * 0.55 + soft[i] * 0.45;
        l = 28 + l * 0.82;
        var light = 1.04 - 0.1 * (x / w + y / h) * 0.5;
        V[i] = l * light * (1 - 0.5 * vig(x, y, w, h)) + grain(R, 15 * o.strength);
      }
    }
    writeMapped(d, n, V, SEPIA);
  };

  // classic black & white film
  var SILVER = lut([[0, [14, 14, 14]], [0.5, [128, 127, 124]], [1, [246, 244, 238]]]);
  FX.bw = function (d, w, h, o, R) {
    var n = w * h, V = new Float32Array(n), i, x, y, j;
    for (i = 0, j = 0; i < n; i++, j += 4) V[i] = 0.3 * d[j] + 0.6 * d[j + 1] + 0.1 * d[j + 2];
    normalise(V, n, 124);
    for (y = 0, i = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++) {
        var t = Math.min(1, Math.max(0, V[i] / 255));
        t = t * 0.4 + t * t * (3 - 2 * t) * 0.6;
        V[i] = t * 255 * (1 - 0.28 * vig(x, y, w, h)) + grain(R, 26 * o.strength);
      }
    }
    writeMapped(d, n, V, SILVER);
  };

  // dissolving grunge: hard grain + dark pixels dragged sideways
  var INK = lut([[0, [18, 18, 18]], [1, [237, 236, 232]]]);
  FX.dissolve = function (d, w, h, o, R) {
    var n = w * h, L = luma(d, n), S = new Float32Array(n), i, x, y;
    normalise(L, n, 150);
    for (i = 0; i < n; i++) L[i] = (L[i] - 128) * 1.45 + 128;
    var left = o.dir !== "right", scale = 1000 / w, edge = o.edge;
    for (y = 0; y < h; y++) {
      var row = y * w, decay = (0.35 + 5 * R() * R()) * scale / o.strength, acc = 255;
      var jitter = (R() - 0.5) * 0.5 + Math.sin(y * 0.05) * 0.06;
      if (left) {
        for (x = w - 1; x >= 0; x--) { acc = Math.min(L[row + x], acc + decay); S[row + x] = acc; }
      } else {
        for (x = 0; x < w; x++) { acc = Math.min(L[row + x], acc + decay); S[row + x] = acc; }
      }
      for (x = 0; x < w; x++) {
        var fx = left ? x / w : 1 - x / w;
        var m = (edge - fx) / 0.32 + 0.5 + jitter;
        m = m < 0 ? 0 : m > 1 ? 1 : m;
        var v = L[row + x] + (S[row + x] - L[row + x]) * m;
        v += (R() - 0.5) * 130;
        L[row + x] = (v - 128) * 2.1 + 128;
      }
    }
    writeMapped(d, n, L, INK);
  };

  // motion blur with echoes and heavy grain (black & white)
  var FOG = lut([[0, [22, 22, 23]], [1, [238, 238, 236]]]);
  FX.motion = function (d, w, h, o, R) {
    var n = w * h, L = luma(d, n), i, x, y;
    normalise(L, n, 140);
    var B = smear(L, w, h, w * 0.018, 3);
    var dir = o.dir === "left" ? -1 : 1, st = o.strength;
    var s1 = Math.round(w * 0.06 * st) * dir, s2 = s1 * 2, s3 = s1 * 3;
    var V = new Float32Array(n);
    for (y = 0; y < h; y++) {
      var row = y * w;
      for (x = 0; x < w; x++) {
        var base = L[row + x] * 0.5 + B[row + x] * 0.5;
        var x1 = x - s1, x2 = x - s2, x3 = x - s3;
        var e1 = x1 >= 0 && x1 < w ? 255 - (255 - B[row + x1]) * 0.72 : 255;
        var e2 = x2 >= 0 && x2 < w ? 255 - (255 - B[row + x2]) * 0.5 : 255;
        var e3 = x3 >= 0 && x3 < w ? 255 - (255 - B[row + x3]) * 0.3 : 255;
        var v = Math.min(base, e1, e2, e3);
        V[row + x] = 22 + v * 0.86 + grain(R, 46);
      }
    }
    writeMapped(d, n, V, FOG);
  };

  // long exposure on film: light streaks, olive shadows, halation, grain
  FX.streak = function (d, w, h, o, R) {
    var n = w * h, Rc = new Float32Array(n), Gc = new Float32Array(n), Bc = new Float32Array(n);
    var L = luma(d, n), i, x, y, j;
    for (i = 0, j = 0; i < n; i++, j += 4) { Rc[i] = d[j]; Gc[i] = d[j + 1]; Bc[i] = d[j + 2]; }
    var r = w * 0.045 * o.strength;
    Rc = smear(Rc, w, h, r, 3); Gc = smear(Gc, w, h, r, 3); Bc = smear(Bc, w, h, r, 3);
    var hi = new Float32Array(n);
    for (i = 0; i < n; i++) hi[i] = L[i] > 150 ? (L[i] - 150) * 1.7 : 0;
    hi = smear(hi, w, h, w * 0.12 * o.strength, 2);
    var halo = boxV(hi, w, h, w * 0.01);
    for (y = 0, i = 0, j = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++, j += 4) {
        var rr = Rc[i] * 0.8 + d[j] * 0.2, gg = Gc[i] * 0.8 + d[j + 1] * 0.2, bb = Bc[i] * 0.8 + d[j + 2] * 0.2;
        rr = rr * 0.72 + 8; gg = gg * 0.84 + 13; bb = bb * 0.6 + 10;
        var m = 0.299 * rr + 0.587 * gg + 0.114 * bb;
        rr = m + (rr - m) * 0.62; gg = m + (gg - m) * 0.62; bb = m + (bb - m) * 0.62;
        rr += hi[i] * 0.55 + halo[i] * 0.35; gg += hi[i] * 0.48; bb += hi[i] * 0.3;
        var v = 1 - 0.55 * vig(x, y, w, h), gr = grain(R, 30);
        d[j] = rr * v + gr + (R() - 0.5) * 8;
        d[j + 1] = gg * v + gr;
        d[j + 2] = bb * v + gr + (R() - 0.5) * 8;
      }
    }
  };

  function dust(ctx, w, h, R) {
    var k = Math.max(w, h) / 1000, i;
    ctx.save();
    for (i = 0; i < 26; i++) {
      ctx.fillStyle = R() < 0.7 ? "rgba(250,244,232," + (0.35 + R() * 0.5) + ")" : "rgba(30,20,12," + (0.25 + R() * 0.4) + ")";
      ctx.beginPath();
      ctx.arc(R() * w, R() * h, (0.6 + R() * 2.2) * k, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.lineCap = "round";
    for (i = 0; i < 3; i++) {
      var x = R() * w, y = R() * h, len = (30 + R() * 70) * k;
      ctx.strokeStyle = "rgba(245,238,225," + (0.2 + R() * 0.25) + ")";
      ctx.lineWidth = (0.6 + R() * 0.8) * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + (R() - 0.5) * len, y + len * 0.5, x + (R() - 0.5) * len * 0.6, y + len);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------ runner */
  function limitFor(img) {
    var fig = img.closest(".ph");
    var cap = coarse ? 1100 : 1500;
    if (!fig || fig.classList.contains("ph--full")) return cap;
    var wv = parseFloat(getComputedStyle(fig).getPropertyValue("--w")) || 100;
    if (fig.closest(".booth-strip")) wv = 30;
    return Math.min(cap, Math.round(cap * Math.max(0.35, wv / 70)));
  }

  function run(img) {
    return new Promise(function (resolve) {
      var name = img.getAttribute("data-fx");
      var fx = FX[name];
      var src = img.getAttribute("data-src") || img.getAttribute("src");
      if (!fx || !src) { resolve(); return; }
      var fig = img.closest(".ph") || img;
      var opts = {
        dir: fig.getAttribute("data-dir") || img.getAttribute("data-dir") || "left",
        strength: parseFloat(fig.getAttribute("data-strength") || img.getAttribute("data-strength")) || 1,
        edge: parseFloat(fig.getAttribute("data-edge") || img.getAttribute("data-edge")) || 0.55
      };
      var probe = new Image();
      probe.onload = function () {
        try {
          var nw = probe.naturalWidth, nh = probe.naturalHeight;
          var s = Math.min(1, limitFor(img) / Math.max(nw, nh));
          var w = Math.max(1, Math.round(nw * s)), h = Math.max(1, Math.round(nh * s));
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          var ctx = canvas.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(probe, 0, 0, w, h);
          var data = ctx.getImageData(0, 0, w, h);
          var R = random(hash(src + "|" + name + "|" + opts.dir));
          fx(data.data, w, h, opts, R);
          ctx.putImageData(data, 0, 0);
          if (name === "booth") dust(ctx, w, h, R);
          var url = canvas.toDataURL("image/jpeg", 0.9);
          // the photo and its copies (strips, ghost, mirror…) all get the result
          var targets = Array.prototype.filter.call(fig.querySelectorAll("img"), function (el) {
            return el === img || el.getAttribute("src") === src;
          });
          var waiting = targets.length;
          targets.forEach(function (el) {
            el.addEventListener("load", function () {
              el.classList.add("fx-done");
              if (--waiting === 0) fig.classList.remove("fx-pending");
            }, { once: true });
            el.setAttribute("data-src", src);
            el.src = url;
          });
        } catch (err) {
          fail(); // e.g. opened from file:// — CSS fallback look
        }
        resolve();
      };
      function fail() { fig.classList.remove("fx-pending"); fig.classList.add("fx-failed"); }
      probe.onerror = function () { fail(); resolve(); };
      probe.src = src;
    });
  }

  var queue = Promise.resolve();
  jobs.forEach(function (img) {
    queue = queue.then(function () { return run(img); })
      .then(function () { return new Promise(function (r) { setTimeout(r, 0); }); });
  });
})();
