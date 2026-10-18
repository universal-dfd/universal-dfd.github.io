/* Hero explorer: check a stream to see what it measures on one clip.
   All overlays are outputs of the released SEAM checkpoint on this clip. */
(function () {
  "use strict";
  var root = document.getElementById("stream-explorer");
  if (!root) return;

  var STREAMS = [
    { id: "spectrum", name: "Spatial spectrum", kind: "Low-level artifacts", color: "#4a3aa7",
      label: "fine detail" },
    { id: "semantic", name: "Semantic spatial", kind: "Learned representations", color: "#eb6834",
      label: "unusual patches" },
    { id: "motion", name: "Motion coherence", kind: "Physical plausibility", color: "#0f8f8f",
      label: "movement" },
    { id: "change", name: "Semantic change", kind: "Physical plausibility", color: "#2a78d6",
      label: "change" }
  ];

  var CLIPS = [
    { id: "ai", label: "AI-generated", url: "assets/data/teaser.json", alt: "A frame from an AI-generated video of a corgi in a park" },
    { id: "real", label: "Real", url: "assets/data/teaser_real.json", alt: "A frame from a real video of a brown SUV on an open airfield, filmed by a moving camera" }
  ];

  Promise.all(CLIPS.map(function (c) { return fetch(c.url).then(function (r) { return r.json(); }); }))
    .then(init)
    .catch(function () { root.textContent = "Interactive example unavailable."; });

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

  function init(datasets) {
    var D = datasets[0], T = D.frames.length, G = D.grid;
    var state = { f: 0, clip: 0, on: {}, playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    var edgeCache = {};
    datasets.forEach(function (ds) {
      ds._imgs = ds.frames.map(function (src) {
        var im = new Image(); im.onload = function () { edgeCache = {}; draw(); }; im.src = src; return im;
      });
    });

    root.innerHTML = "";
    var tabs = el("div", "se-tabs", root);
    tabs.setAttribute("role", "tablist");
    var tabEls = CLIPS.map(function (c, i) {
      var b = el("button", "tab" + (i === 0 ? " active" : ""), tabs);
      b.type = "button"; b.textContent = c.label; b.setAttribute("role", "tab");
      b.addEventListener("click", function () { setClip(i); });
      return b;
    });
    var stage = el("div", "se-stage", root);
    stage.style.aspectRatio = String(D.aspect);
    var img = el("img", "se-frame", stage);
    img.alt = CLIPS[0].alt;
    var canvas = el("canvas", "se-canvas", stage);
    var ctx = canvas.getContext("2d");
    var off = document.createElement("canvas"); off.width = G; off.height = G;

    var bar = el("div", "se-bar", root);
    var play = el("button", "se-play", bar);
    play.type = "button";
    var dots = el("div", "se-dots", bar);
    var dotEls = [];
    for (var i = 0; i < T; i++) {
      (function (i) {
        var d = el("button", "se-dot", dots);
        d.type = "button"; d.setAttribute("aria-label", "Show frame " + (i + 1));
        d.addEventListener("click", function () { state.playing = false; state.f = i; render(); });
        dotEls.push(d);
      })(i);
    }
    el("span", "se-hint", bar).textContent = "8 frames from one clip";

    var chips = el("div", "se-chips", root);
    var notes = el("div", "se-notes", root);
    var plotWrap = el("div", "se-plot", notes);
    var plotHead = el("div", "se-plot-head", plotWrap);
    plotHead.textContent = "Frame spectrum vs. real footage";
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 300 112"); svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Radial frequency profile of the current frame against the range real footage occupies");
    plotWrap.appendChild(svg);
    var noteList = el("div", "se-note-list", notes);

    STREAMS.forEach(function (s) {
      var lab = el("label", "se-chip", chips);
      lab.style.setProperty("--c", s.color);
      var cb = el("input", "", lab); cb.type = "checkbox"; cb.value = s.id;
      var box = el("span", "se-box", lab);
      var txt = el("span", "se-chip-text", lab);
      el("span", "se-chip-name", txt).textContent = s.name;
      el("span", "se-chip-kind", txt).textContent = s.kind;
      cb.addEventListener("change", function () { state.on[s.id] = cb.checked; render(); });
      s.cb = cb;
    });

    play.addEventListener("click", function () { state.playing = !state.playing; render(); });
    window.addEventListener("resize", draw);
    img.addEventListener("load", draw);

    var timer = setInterval(function () {
      if (!state.playing || document.hidden) return;
      state.f = (state.f + 1) % T; render();
    }, 650);

    function setClip(i) {
      state.clip = i; state.f = 0;
      D = datasets[i]; T = D.frames.length; G = D.grid;
      off.width = G; off.height = G;
      stage.style.aspectRatio = String(D.aspect);
      img.alt = CLIPS[i].alt;
      tabEls.forEach(function (b, j) { b.classList.toggle("active", j === i); b.setAttribute("aria-selected", j === i ? "true" : "false"); });
      render();
    }

    function heat(vals, color, lo) {
      var c = hex(color), id = off.getContext("2d").createImageData(G, G);
      for (var k = 0; k < G * G; k++) {
        var a = Math.max(0, Math.min(1, (vals[k] - lo) / (1 - lo)));
        id.data[k * 4] = c[0]; id.data[k * 4 + 1] = c[1]; id.data[k * 4 + 2] = c[2];
        id.data[k * 4 + 3] = Math.round(255 * 0.78 * Math.pow(a, 1.2));
      }
      off.getContext("2d").putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
      ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
    }

    function arrows() {
      var p = Math.min(state.f, T - 2), W = canvas.width, H = canvas.height;
      var cw = W / G, ch = H / G, dpr = W / canvas.clientWidth;
      ctx.lineCap = "round";
      for (var k = 0; k < G * G; k++) {
        if (D.conf[p][k] < 0.94) continue;
        var dy = D.disp[p][k][0], dx = D.disp[p][k][1];
        if (!dx && !dy) continue;
        var x0 = (k % G + 0.5) * cw, y0 = (Math.floor(k / G) + 0.5) * ch;
        var x1 = x0 + dx * cw * 0.8, y1 = y0 + dy * ch * 0.8;
        var ang = Math.atan2(y1 - y0, x1 - x0), hl = 5 * dpr;
        ctx.beginPath();
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang - 0.5), y1 - hl * Math.sin(ang - 0.5));
        ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang + 0.5), y1 - hl * Math.sin(ang + 0.5));
        ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 3.2 * dpr; ctx.stroke();
        ctx.strokeStyle = "#0f8f8f"; ctx.lineWidth = 1.7 * dpr; ctx.stroke();
      }
    }

    /* where the fine detail is: a Sobel edge map of the current frame, tinted purple */
    function edgeMap() {
      var key = state.clip + ":" + state.f;
      if (edgeCache[key]) return edgeCache[key];
      var im = D._imgs[state.f];
      if (!im || !im.complete || !im.naturalWidth) return null;
      var w = 160, h = Math.round(w / D.aspect), c = document.createElement("canvas");
      c.width = w; c.height = h;
      var cx = c.getContext("2d"); cx.drawImage(im, 0, 0, w, h);
      var px = cx.getImageData(0, 0, w, h).data, g = new Float32Array(w * h), mag = new Float32Array(w * h), i, x, y;
      for (i = 0; i < w * h; i++) g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2];
      for (y = 1; y < h - 1; y++) for (x = 1; x < w - 1; x++) {
        var k = y * w + x,
            gx = g[k - w + 1] + 2 * g[k + 1] + g[k + w + 1] - g[k - w - 1] - 2 * g[k - 1] - g[k + w - 1],
            gy = g[k + w - 1] + 2 * g[k + w] + g[k + w + 1] - g[k - w - 1] - 2 * g[k - w] - g[k - w + 1];
        mag[k] = Math.sqrt(gx * gx + gy * gy);
      }
      var sorted = Array.prototype.slice.call(mag).sort(function (a, b) { return a - b; }), p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;
      var out = document.createElement("canvas"); out.width = w; out.height = h;
      var ox = out.getContext("2d"), id = ox.createImageData(w, h);
      for (i = 0; i < w * h; i++) {
        var a = Math.min(1, mag[i] / p95);
        id.data[i * 4] = 74; id.data[i * 4 + 1] = 58; id.data[i * 4 + 2] = 167;
        id.data[i * 4 + 3] = Math.round(255 * 0.8 * Math.pow(a, 1.4));
      }
      ox.putImageData(id, 0, 0);
      var cell = 10, best = -1, bx = 0.5, by = 0.5;
      for (y = 0; y + cell <= h; y += 5) for (x = 0; x + cell <= w; x += 5) {
        var sum = 0;
        for (var yy = 0; yy < cell; yy++) for (var xx = 0; xx < cell; xx++) sum += mag[(y + yy) * w + x + xx];
        if (sum > best) { best = sum; bx = (x + cell / 2) / w; by = (y + cell / 2) / h; }
      }
      return (edgeCache[key] = { canvas: out, x: bx, y: by });
    }

    /* the hottest 3x3 block of a G x G map, as a point in 0..1 */
    function hotspot(vals) {
      var best = -1, bx = 0.5, by = 0.5;
      for (var y = 0; y + 3 <= G; y++) for (var x = 0; x + 3 <= G; x++) {
        var sum = 0;
        for (var j = 0; j < 3; j++) for (var i = 0; i < 3; i++) sum += vals[(y + j) * G + x + i];
        if (sum > best) { best = sum; bx = (x + 1.5) / G; by = (y + 1.5) / G; }
      }
      return { x: bx, y: by };
    }

    /* midpoint of the longest confident arrow */
    function longestArrow() {
      var p = Math.min(state.f, T - 2), best = 0, pt = null;
      for (var k = 0; k < G * G; k++) {
        if (D.conf[p][k] < 0.94) continue;
        var dy = D.disp[p][k][0], dx = D.disp[p][k][1], len = Math.sqrt(dx * dx + dy * dy);
        if (len > best) { best = len; pt = { x: ((k % G) + 0.5 + dx * 0.4) / G, y: (Math.floor(k / G) + 0.5 + dy * 0.4) / G }; }
      }
      return pt;
    }

    function annotate() {
      var W = canvas.width, H = canvas.height, dpr = W / canvas.clientWidth;
      ctx.font = "700 " + 13.5 * dpr + "px Charter, Georgia, serif";
      ctx.textBaseline = "middle";
      var targets = [];
      STREAMS.forEach(function (s) {
        if (!state.on[s.id]) return;
        var t = null;
        if (s.id === "semantic") t = hotspot(D.spatial[state.f]);
        else if (s.id === "change") t = hotspot(D.change[Math.min(state.f, T - 2)]);
        else if (s.id === "motion") t = longestArrow();
        else if (s.id === "spectrum") { var e = edgeMap(); t = e && { x: e.x, y: e.y }; }
        if (t) targets.push({ s: s, x: t.x * W, y: t.y * H });
      });
      /* pills stack in two columns at the frame edges, ordered by height, so they never overlap */
      var padX = 10 * dpr, ph = 26 * dpr, gap = 7 * dpr, edge = 8 * dpr;
      targets.forEach(function (t) { t.w = ctx.measureText(t.s.label).width + 2 * padX; t.left = t.x < W * 0.5; });
      [true, false].forEach(function (leftSide) {
        var col = targets.filter(function (t) { return t.left === leftSide; }).sort(function (a, b) { return a.y - b.y; });
        col.forEach(function (t, i) {
          t.py = Math.max(edge, t.y - ph / 2);
          if (i && t.py < col[i - 1].py + ph + gap) t.py = col[i - 1].py + ph + gap;
        });
        var over = col.length ? col[col.length - 1].py + ph + edge - H : 0;
        if (over > 0) col.forEach(function (t) { t.py -= over; });
        col.forEach(function (t) { t.py = Math.max(edge, t.py); });
      });
      targets.forEach(function (t) {
        var px = t.left ? edge : W - t.w - edge, py = t.py;
        var ax = t.left ? px + t.w : px, ay = py + ph / 2;
        ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(ax, ay);
        ctx.strokeStyle = "rgba(255,255,255,0.95)"; ctx.lineWidth = 4 * dpr; ctx.stroke();
        ctx.strokeStyle = t.s.color; ctx.lineWidth = 2 * dpr; ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, 6 * dpr, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2.5 * dpr; ctx.strokeStyle = t.s.color; ctx.stroke();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, t.w, ph, 13 * dpr); else ctx.rect(px, py, t.w, ph);
        ctx.fillStyle = "rgba(255,255,255,0.96)"; ctx.fill();
        ctx.lineWidth = 2 * dpr; ctx.strokeStyle = t.s.color; ctx.stroke();
        ctx.fillStyle = "#111"; ctx.fillText(t.s.label, px + padX, py + ph / 2 + dpr);
      });
    }

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = stage.clientWidth, h = stage.clientHeight;
      if (!w) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (state.on.spectrum) {
        var e = edgeMap();
        if (e) { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(e.canvas, 0, 0, canvas.width, canvas.height); }
      }
      if (state.on.semantic) heat(D.spatial[state.f], "#eb6834", 0.35);
      if (state.on.change) heat(D.change[Math.min(state.f, T - 2)], "#2a78d6", 0.35);
      if (state.on.motion) arrows();
      annotate();
    }

    function drawSpectrum() {
      var n = D.cutoff, X = 300 / 64, lo = Infinity, hi = -Infinity, i;
      var spec = D.spectrum[state.f];
      for (i = 0; i < n; i++) {
        lo = Math.min(lo, D.band_mean[i] - 2 * D.band_std[i], spec[i]);
        hi = Math.max(hi, D.band_mean[i] + 2 * D.band_std[i], spec[i]);
      }
      var pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
      var sy = function (v) { return 90 - (v - lo) / (hi - lo) * 84; };
      var top = "", bot = "", line = "";
      for (i = 0; i < n; i++) {
        top += (i ? "L" : "M") + (i * X).toFixed(1) + " " + sy(D.band_mean[i] + 2 * D.band_std[i]).toFixed(1);
        line += (i ? "L" : "M") + (i * X).toFixed(1) + " " + sy(spec[i]).toFixed(1);
      }
      for (i = n - 1; i >= 0; i--) bot += "L" + (i * X).toFixed(1) + " " + sy(D.band_mean[i] - 2 * D.band_std[i]).toFixed(1);
      var cut = n * X;
      svg.innerHTML =
        '<defs><pattern id="se-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
        '<line x1="0" y1="0" x2="0" y2="5" stroke="#9aa1a7" stroke-width="1.2"/></pattern></defs>' +
        '<rect x="' + cut + '" y="4" width="' + (300 - cut) + '" height="86" fill="url(#se-hatch)" opacity="0.55"/>' +
        '<text x="' + (cut + (300 - cut) / 2) + '" y="50" text-anchor="middle" class="se-t">discarded</text>' +
        '<path d="' + top + bot + 'Z" fill="#9aa1a7" opacity="0.28"/>' +
        '<path d="' + line + '" fill="none" stroke="#4a3aa7" stroke-width="2.2" stroke-linejoin="round"/>' +
        '<line x1="0" y1="90" x2="300" y2="90" stroke="#8a9198" stroke-width="1"/>' +
        '<text x="2" y="106" class="se-t">low frequency</text>' +
        '<text x="298" y="106" text-anchor="end" class="se-t">high</text>';
    }

    function render() {
      img.src = D.frames[state.f];
      dotEls.forEach(function (d, i) { d.classList.toggle("on", i === state.f); });
      play.textContent = state.playing ? "Pause" : "Play";
      play.setAttribute("aria-label", state.playing ? "Pause the clip" : "Play the clip");
      var any = STREAMS.some(function (s) { return state.on[s.id]; });
      noteList.innerHTML = "";
      if (!any) {
        var e = el("div", "se-note empty", noteList);
        e.textContent = "Check a stream to mark it on the frame.";
      }
      plotWrap.style.display = state.on.spectrum ? "block" : "none";
      if (state.on.spectrum) drawSpectrum();
      draw();
    }

    state.on.semantic = true; STREAMS[1].cb.checked = true;
    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(draw);
  }
})();
