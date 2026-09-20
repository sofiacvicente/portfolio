/* SOFIA — digital magazine
   Flipbook powered by page-flip (StPageFlip, MIT). Runs after effects.js. */
(function () {
  "use strict";

  var PAGE_W = 600;          // page proportions (3:4) — the real size comes from the screen
  var PAGE_H = 800;
  var RATIO = PAGE_W / PAGE_H;
  var MAX_SPREAD = 1500;     // widest the open magazine gets, in px

  var viewer = document.getElementById("viewer");
  var stage = document.getElementById("stage");
  var controls = document.getElementById("controls");
  var shift = document.getElementById("bookShift");
  var bookEl = document.getElementById("book");
  var prevBtn = document.getElementById("prev");
  var nextBtn = document.getElementById("next");
  var label = document.getElementById("pageLabel");
  var hint = document.getElementById("hint");

  if (!window.St || !bookEl) return;

  /* the shadow the book casts on whatever it is lying on */
  var floor = document.createElement("i");
  floor.className = "book-floor";
  floor.setAttribute("aria-hidden", "true");
  shift.insertBefore(floor, shift.firstChild);

  /* one light/shade layer per page, shown only while that sheet is in the air */
  Array.prototype.forEach.call(bookEl.querySelectorAll(".page"), function (p) {
    var sheen = document.createElement("i");
    sheen.className = "sheen";
    sheen.setAttribute("aria-hidden", "true");
    p.appendChild(sheen);
  });

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var coarse = window.matchMedia("(pointer: coarse)").matches;
  if (coarse && hint) hint.textContent = "swipe or tap to turn the pages";

  var book = null;

  /* Always a two-page spread — on the phone as on the desktop — sized to fit the stage. */
  function layout() {
    var cs = getComputedStyle(stage);
    var aw = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var ah = viewer.clientHeight - controls.offsetHeight - (hint ? hint.offsetHeight : 0) -
      parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

    var w = Math.max(160, Math.floor(Math.min(aw, ah * RATIO * 2, MAX_SPREAD)));

    shift.style.width = w + "px";
    // minWidth 1 keeps the library in landscape (two pages) at every screen width
    var minWidth = 1;
    if (book) book.getSettings().minWidth = minWidth;
    return minWidth;
  }

  var initialMinWidth = layout();
  // registered before the flipbook, so the size is right when it measures on resize
  window.addEventListener("resize", function () { layout(); if (book) updateStack(); });

  book = new St.PageFlip(bookEl, {
    width: PAGE_W,
    height: PAGE_H,
    size: "stretch",
    minWidth: initialMinWidth,
    maxWidth: 2000,
    minHeight: 100,
    maxHeight: 3000,
    showCover: true,
    usePortrait: false,   // never fall back to one page at a time
    mobileScrollSupport: true,
    maxShadowOpacity: 0.55,
    flippingTime: reduceMotion ? 350 : 900,
    swipeDistance: 30,
  });
  book.loadFromHTML(bookEl.querySelectorAll(".page"));

  /* How thick the read half and the unread half are, in px. Real magazines get
     visibly lighter on one side as you go through them. */
  function updateStack() {
    var n = book.getPageCount();
    if (n < 2) return;
    var read = book.getCurrentPageIndex() / (n - 1);
    var pageW = shift.clientWidth / (isLandscape() ? 2 : 1);
    var max = Math.max(4, Math.min(22, pageW * 0.036));
    shift.style.setProperty("--stack-l", (max * read).toFixed(1) + "px");
    shift.style.setProperty("--stack-r", (max * (1 - read)).toFixed(1) + "px");
  }

  /* The sheet in the air is the one drawn on top. It carries the curved shading,
     and it can change while you drag, so follow it frame by frame. */
  var turnRaf = 0;
  function paintTurning(on) {
    var items = bookEl.querySelectorAll(".stf__item");
    var top = null;
    var topZ = -1;
    var k;
    if (on) {
      for (k = 0; k < items.length; k++) {
        var z = parseInt(items[k].style.zIndex, 10) || 0;
        if (items[k].style.display !== "none" && z > topZ) { topZ = z; top = items[k]; }
      }
    }
    for (k = 0; k < items.length; k++) items[k].classList.toggle("is-turning", items[k] === top);
  }
  function markTurning(on) {
    if (turnRaf) { cancelAnimationFrame(turnRaf); turnRaf = 0; }
    if (!on) { paintTurning(false); return; }
    (function step() {
      paintTurning(true);
      turnRaf = requestAnimationFrame(step);
    })();
  }

  function pad(n) { return n < 10 ? "0" + n : String(n); }

  function isLandscape() { return book.getOrientation() === "landscape"; }

  function refreshUI() {
    var i = book.getCurrentPageIndex();
    var n = book.getPageCount();
    var text;
    if (i === 0) text = "Cover";
    else if (i === n - 1) text = "Back cover";
    else if (isLandscape()) text = pad(i + 1) + "–" + pad(i + 2) + " / " + pad(n);
    else text = pad(i + 1) + " / " + pad(n);
    label.textContent = text;
    prevBtn.disabled = i === 0;
    nextBtn.disabled = i === n - 1;
  }

  /* Closed magazine: slide the cover (or back cover) to the middle of the stage. */
  function setShift(which) {
    shift.classList.toggle("is-cover", which === "cover");
    shift.classList.toggle("is-back", which === "back");
  }
  function restingShift() {
    var i = book.getCurrentPageIndex();
    var n = book.getPageCount();
    setShift(i === 0 ? "cover" : i === n - 1 ? "back" : null);
  }

  var lastState = "read";
  book.on("changeState", function (e) {
    var state = e.data;
    // a click / button / key flip always completes, so start gliding to the centre right away
    if (state === "flipping" && lastState !== "user_fold") setShift(null);
    if (state === "read") restingShift();
    markTurning(state !== "read");
    lastState = state;
  });

  var startIndex = book.getCurrentPageIndex();
  book.on("flip", function (e) {
    refreshUI();
    restingShift();
    updateStack();
    if (hint && e.data !== startIndex) hint.classList.add("is-hidden");
  });

  book.on("changeOrientation", function () {
    shift.classList.toggle("is-landscape", isLandscape());
    refreshUI();
    updateStack();
  });

  shift.classList.toggle("is-landscape", isLandscape());
  restingShift();
  refreshUI();
  updateStack();
  requestAnimationFrame(function () { shift.classList.add("is-ready"); });

  prevBtn.addEventListener("click", function () { book.flipPrev(); });
  nextBtn.addEventListener("click", function () { book.flipNext(); });

  document.addEventListener("keydown", function (e) {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var tag = (e.target && e.target.tagName) || "";
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
    if (e.key === "ArrowRight" || e.key === "PageDown") { book.flipNext(); e.preventDefault(); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { book.flipPrev(); e.preventDefault(); }
    if (e.key === "Home") { book.flip(0); e.preventDefault(); }
  });

  // links with data-page="n" jump to a page (the cover is 0)
  bookEl.addEventListener("click", function (e) {
    var link = e.target.closest ? e.target.closest("a[data-page]") : null;
    if (!link) return;
    e.preventDefault();
    book.flip(Number(link.getAttribute("data-page")));
  });
})();
