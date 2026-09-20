/* SOFIA — photo frames
   Every <figure class="ph ..."> gets a .frame around its photo. Graphic effects (classes)
   need extra layers (copies, strips, torn paper, date stamp) — they are built here,
   before the flipbook starts. Vintage effects (data-fx) are drawn by fotolab.js. */
(function () {
  "use strict";

  function has(el, cls) { return el.classList.contains(cls); }

  function copyOf(img, cls) {
    var c = img.cloneNode(false);
    c.className = cls || "";
    c.alt = "";
    c.setAttribute("aria-hidden", "true");
    return c;
  }

  // deterministic random, so a torn edge looks the same on every visit
  function random(seed) {
    var s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return function () {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  function tornEdge(seed, amp, step) {
    var r = random(seed);
    var pts = [];
    var x, y;
    for (x = 0; x <= 100; x += step) pts.push([x, r() * amp]);
    for (y = step; y <= 100; y += step) pts.push([100 - r() * amp, y]);
    for (x = 100 - step; x >= 0; x -= step) pts.push([x, 100 - r() * amp]);
    for (y = 100 - step; y > 0; y -= step) pts.push([r() * amp, y]);
    return "polygon(" + pts.map(function (p) {
      return p[0].toFixed(2) + "% " + p[1].toFixed(2) + "%";
    }).join(", ") + ")";
  }

  var STRIP_SHIFT = [-2.2, 1.4, -0.6, 2.6, -1.5, 0.9, -2.8, 1.8]; // in % of page width

  function build(fig, index) {
    var imgs = Array.prototype.slice.call(fig.querySelectorAll("img"));
    if (!imgs.length || fig.querySelector(".frame")) return;
    var base = imgs[0];

    var frame = document.createElement("div");
    frame.className = "frame";
    var holder = frame;

    if (has(fig, "fx-halftone")) {
      holder = document.createElement("div");
      holder.className = "ht";
      frame.appendChild(holder);
    }
    imgs.forEach(function (img) {
      img.draggable = false;
      holder.appendChild(img);
    });

    if (has(fig, "fx-glow") || has(fig, "fx-ghost") || has(fig, "fx-mirror")) {
      holder.appendChild(copyOf(base, "fx-layer"));
    }

    if (has(fig, "fx-strips")) {
      var n = parseInt(fig.getAttribute("data-strips"), 10) || 6;
      for (var k = 0; k < n; k++) {
        var strip = document.createElement("div");
        strip.className = "strip";
        strip.style.left = (k * 100) / n + "%";
        strip.style.width = 100 / n + "%";
        strip.style.setProperty("--dy", STRIP_SHIFT[k % STRIP_SHIFT.length]);
        var piece = copyOf(base);
        piece.style.width = n * 100 + "%";
        piece.style.left = -k * 100 + "%";
        strip.appendChild(piece);
        frame.appendChild(strip);
      }
      base.hidden = true;
    }

    // vintage effects are drawn by fotolab.js — the figure's data-fx goes to its main photo
    if (fig.hasAttribute("data-fx")) {
      if (!base.hasAttribute("data-fx")) base.setAttribute("data-fx", fig.getAttribute("data-fx"));
      fig.classList.add("fx-pending");
    }

    // film date stamp: data-date="'26 9 17"
    if (fig.hasAttribute("data-date")) {
      var stamp = document.createElement("span");
      stamp.className = "date" + (has(fig, "date-v") ? " date--v" : "") + (has(fig, "date-up") ? " date--up" : "");
      stamp.setAttribute("aria-hidden", "true");
      var txt = fig.getAttribute("data-date");
      if (txt.charAt(0) === "'") {
        var tick = document.createElement("i");
        tick.className = "tick";
        stamp.appendChild(tick);
        txt = txt.slice(1);
      }
      stamp.appendChild(document.createTextNode(txt));
      frame.appendChild(stamp);
    }

    if (has(fig, "edge-torn")) {
      var seed = (parseInt(fig.getAttribute("data-seed"), 10) || index + 1) * 7919;
      var paper = document.createElement("div");
      paper.className = "paper";
      paper.style.clipPath = tornEdge(seed + 17, 2.6, 2.5);
      fig.appendChild(paper);
      frame.style.clipPath = tornEdge(seed, 1.8, 2);
    }

    fig.appendChild(frame);
  }

  var book = document.getElementById("book");
  if (!book) return;
  var figs = book.querySelectorAll(".ph");
  for (var i = 0; i < figs.length; i++) build(figs[i], i);
})();
