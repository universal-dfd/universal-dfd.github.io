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
    { id: "ai", label: "AI-generated", url: "assets/data/teaser_gen2.json", alt: "A frame from an AI-generated video of a couple walking under umbrellas down a rainy street at night" },
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
    var T = datasets[0].frames.length, G = datasets[0].grid;
    var state = { f: 0, on: {}, playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    datasets.forEach(function (ds) {
      ds._edge = {}; ds._win = {};
      ds._imgs = ds.frames.map(function (src) {
        var im = new Image(); im.onload = function () { ds._edge = {}; ds._win = {}; drawAll(); }; im.src = src; return im;
      });
    });

    root.innerHTML = "";
    var pair = el("div", "se-pair", root);
    var stages = CLIPS.map(function (c, i) {
      var col = el("div", "se-col", pair);
      var cap = el("div", "se-cap", col);
      var pill = el("span", "pill " + (c.id === "ai" ? "ai" : "real"), cap); pill.textContent = c.label;
      var stage = el("div", "se-stage", col);
      stage.style.aspectRatio = String(datasets[i].aspect);
      var img = el("img", "se-frame", stage); img.alt = c.alt;
      var canvas = el("canvas", "se-canvas", stage);
      return { ds: datasets[i], stage: stage, img: img, canvas: canvas, ctx: canvas.getContext("2d"), off: (function () { var o = document.createElement("canvas"); o.width = G; o.height = G; return o; })() };
    });

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
    el("span", "se-hint", bar).textContent = "8 frames from each clip";

    var chips = el("div", "se-chips", root);
    var notes = el("div", "se-notes", root);
    var noteList = el("div", "se-note-list", notes);

    /* "Semantic change" explainer: plain pixel difference vs. the model's change map, for the same pair of frames */
    var win = el("div", "se-window", root);
    var winHead = el("div", "se-win-head", win);
    [["Pixels that moved", "#6e6e6e"], ["Meaning that changed", "#2a78d6"]].forEach(function (c) {
      var pl = el("span", "se-win-pill", winHead); pl.textContent = c[0]; pl.style.borderColor = c[1];
    });
    var winGrid = el("div", "se-win-grid", win);
    var winPanels = stages.map(function (st, i) {
      var pair = { st: st, cv: [] };
      for (var j = 0; j < 2; j++) {
        var box = el("div", "se-win-box", winGrid); box.style.aspectRatio = String(st.ds.aspect);
        var cv = el("canvas", "se-win-canvas", box); pair.cv.push(cv);
        if (j === 0) { var tg = el("span", "se-win-tag", box); tg.textContent = CLIPS[i].id === "ai" ? "AI" : "Real"; }
      }
      return pair;
    });

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
    window.addEventListener("resize", drawAll);
    stages.forEach(function (st) { st.img.addEventListener("load", drawAll); });

    setInterval(function () {
      if (!state.playing || document.hidden) return;
      state.f = (state.f + 1) % T; render();
    }, 650);

    function heat(st, vals, color, lo) {
      var c = hex(color), id = st.off.getContext("2d").createImageData(G, G);
      for (var k = 0; k < G * G; k++) {
        var a = Math.max(0, Math.min(1, (vals[k] - lo) / (1 - lo)));
        id.data[k * 4] = c[0]; id.data[k * 4 + 1] = c[1]; id.data[k * 4 + 2] = c[2];
        id.data[k * 4 + 3] = Math.round(255 * 0.78 * Math.pow(a, 1.2));
      }
      st.off.getContext("2d").putImageData(id, 0, 0);
      st.ctx.imageSmoothingEnabled = true; st.ctx.imageSmoothingQuality = "high";
      st.ctx.drawImage(st.off, 0, 0, st.canvas.width, st.canvas.height);
    }

    /* motion in each quarter of the frame for one frame pair: the mean displacement of its confident patches
       (the most confident few if there are not enough). The solid middle arrow is the average of the four. */
    var NET_SCALE = 4.5; /* patches of arrow per patch of motion, exaggerated so it can be seen */
    function quadVectors(ds, p) {
      var h = G >> 1, out = [];
      [[0, 0], [0, 1], [1, 0], [1, 1]].forEach(function (q) {
        var items = [];
        for (var y = q[0] * h; y < (q[0] + 1) * h; y++) for (var x = q[1] * h; x < (q[1] + 1) * h; x++) {
          var k = y * G + x; items.push({ c: ds.conf[p][k], dy: ds.disp[p][k][0], dx: ds.disp[p][k][1] });
        }
        var good = items.filter(function (i) { return i.c >= 0.94; });
        if (good.length < 3) good = items.sort(function (a, b) { return b.c - a.c; }).slice(0, 8);
        var sx = 0, sy = 0;
        good.forEach(function (i) { sx += i.dx; sy += i.dy; });
        out.push({ dx: sx / good.length, dy: sy / good.length });
      });
      return out;
    }

    function netArrow(st) {
      var W = st.canvas.width, H = st.canvas.height, dpr = W / st.canvas.clientWidth, u = st.u, ctx = st.ctx;
      var cw = W / G, ch = H / G, hl = 11 * dpr * u, p = Math.min(state.f, T - 2);
      var quads = quadVectors(st.ds, p), mean = { dx: 0, dy: 0 };
      quads.forEach(function (q) { mean.dx += q.dx / 4; mean.dy += q.dy / 4; });
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      function vec(v) {
        var x = v.dx * NET_SCALE * cw, y = v.dy * NET_SCALE * ch, len = Math.hypot(x, y), cap = 0.3 * Math.min(W, H);
        if (len > cap) { x *= cap / len; y *= cap / len; }
        return { x: x, y: y };
      }
      function arrow(x0, y0, v, dashed) {
        var x1 = x0 + v.x, y1 = y0 + v.y, len = Math.hypot(v.x, v.y), ang = Math.atan2(v.y, v.x);
        var head = function () {
          if (len <= hl * 0.8) return;
          ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang - 0.45), y1 - hl * Math.sin(ang - 0.45));
          ctx.moveTo(x1, y1); ctx.lineTo(x1 - hl * Math.cos(ang + 0.45), y1 - hl * Math.sin(ang + 0.45));
        };
        [["rgba(255,255,255,0.95)", dashed ? 5 : 8], ["#0f8f8f", dashed ? 2.6 : 4.5]].forEach(function (pass) {
          ctx.strokeStyle = pass[0]; ctx.lineWidth = pass[1] * dpr * u;
          ctx.setLineDash(dashed ? [6 * dpr * u, 5 * dpr * u] : []);
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          ctx.setLineDash([]);
          ctx.beginPath(); head(); ctx.stroke();
        });
        return { x: x1, y: y1 };
      }
      [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]].forEach(function (a, i) {
        var v = vec(quads[i]); arrow(a[0] * W - v.x / 2, a[1] * H - v.y / 2, v, true);
      });
      var cx = W / 2, cy = H / 2, tip = arrow(cx, cy, vec(mean), false);
      ctx.beginPath(); ctx.arc(cx, cy, 4.5 * dpr * u, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2 * dpr * u; ctx.strokeStyle = "#0f8f8f"; ctx.stroke();
      return { x: tip.x / W, y: tip.y / H };
    }

    /* where the fine detail is: a Sobel edge map of the current frame, tinted purple */
    function edgeMap(st) {
      var key = state.f, ds = st.ds;
      if (ds._edge[key]) return ds._edge[key];
      var im = ds._imgs[state.f];
      if (!im || !im.complete || !im.naturalWidth) return null;
      var w = 160, h = Math.round(w / ds.aspect), c = document.createElement("canvas");
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
      return (ds._edge[key] = { canvas: out, x: bx, y: by });
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

    function annotate(st, motionTip) {
      var W = st.canvas.width, H = st.canvas.height, dpr = W / st.canvas.clientWidth, u = st.u, D = st.ds, ctx = st.ctx;
      var fs = Math.max(8.5, 13.5 * u * 0.75) * dpr;
      ctx.font = "700 " + fs + "px Charter, Georgia, serif";
      ctx.textBaseline = "middle";
      var targets = [];
      STREAMS.forEach(function (s) {
        if (!state.on[s.id]) return;
        var t = null;
        if (s.id === "semantic") t = hotspot(D.spatial[state.f]);
        else if (s.id === "change") t = hotspot(D.change[Math.min(state.f, T - 2)]);
        else if (s.id === "motion") t = motionTip;
        else if (s.id === "spectrum") { var e = edgeMap(st); t = e && { x: e.x, y: e.y }; }
        if (t) targets.push({ s: s, x: t.x * W, y: t.y * H });
      });
      /* pills stack in two columns at the frame edges, ordered by height, so they never overlap */
      var padX = fs * 0.7, ph = fs * 1.95, gap = fs * 0.5, edge = fs * 0.7;
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
        ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 3 * dpr * u; ctx.stroke();
        ctx.strokeStyle = t.s.color; ctx.lineWidth = 1.5 * dpr * u; ctx.stroke();
        ctx.beginPath(); ctx.arc(t.x, t.y, 4.5 * dpr * u, 0, 2 * Math.PI);
        ctx.fillStyle = "#fff"; ctx.fill(); ctx.lineWidth = 2 * dpr * u; ctx.strokeStyle = t.s.color; ctx.stroke();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, t.w, ph, ph / 2); else ctx.rect(px, py, t.w, ph);
        ctx.fillStyle = "rgba(255,255,255,0.58)"; ctx.fill();
        ctx.lineWidth = 1.5 * dpr; ctx.strokeStyle = t.s.color; ctx.stroke();
        ctx.fillStyle = "#111"; ctx.fillText(t.s.label, px + padX, py + ph / 2 + dpr * 0.5);
      });
    }

    function drawStage(st) {
      var dpr = window.devicePixelRatio || 1, w = st.stage.clientWidth, h = st.stage.clientHeight, D = st.ds;
      if (!w) return;
      st.u = Math.max(0.62, Math.min(1, w / 340));
      st.canvas.width = Math.round(w * dpr); st.canvas.height = Math.round(h * dpr);
      st.ctx.clearRect(0, 0, st.canvas.width, st.canvas.height);
      if (state.on.spectrum) {
        var e = edgeMap(st);
        if (e) { st.ctx.imageSmoothingEnabled = true; st.ctx.imageSmoothingQuality = "high"; st.ctx.drawImage(e.canvas, 0, 0, st.canvas.width, st.canvas.height); }
      }
      if (state.on.semantic) heat(st, D.spatial[state.f], "#eb6834", 0.35);
      if (state.on.change) heat(st, D.change[Math.min(state.f, T - 2)], "#2a78d6", 0.35);
      var tip = state.on.motion ? netArrow(st) : null;
      annotate(st, tip);
    }
    /* grayscale base + pixel-difference mask for frames p -> p+1, at low resolution, cached */
    function winMaps(ds, p) {
      if (ds._win[p]) return ds._win[p];
      var a = ds._imgs[p], b = ds._imgs[p + 1];
      if (!a || !b || !a.complete || !b.complete || !a.naturalWidth || !b.naturalWidth) return null;
      var w = 240, h = Math.round(w / ds.aspect), i;
      function px(im) { var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.drawImage(im, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; }
      var d0 = px(a), d1 = px(b), lum1 = new Float32Array(w * h), diff = new Float32Array(w * h);
      for (i = 0; i < w * h; i++) {
        var l0 = 0.299 * d0[i * 4] + 0.587 * d0[i * 4 + 1] + 0.114 * d0[i * 4 + 2];
        lum1[i] = 0.299 * d1[i * 4] + 0.587 * d1[i * 4 + 1] + 0.114 * d1[i * 4 + 2];
        diff[i] = Math.abs(lum1[i] - l0);
      }
      var sorted = Array.prototype.slice.call(diff).sort(function (x, y) { return x - y; }), p97 = sorted[Math.floor(sorted.length * 0.97)] || 1;
      var base = document.createElement("canvas"); base.width = w; base.height = h;
      var bx = base.getContext("2d"), bid = bx.createImageData(w, h);
      var dm = document.createElement("canvas"); dm.width = w; dm.height = h;
      var dx = dm.getContext("2d"), did = dx.createImageData(w, h);
      for (i = 0; i < w * h; i++) {
        bid.data[i * 4] = lum1[i] * 0.45 + 11; bid.data[i * 4 + 1] = lum1[i] * 0.45 + 13; bid.data[i * 4 + 2] = lum1[i] * 0.45 + 17; bid.data[i * 4 + 3] = 255;
        did.data[i * 4] = did.data[i * 4 + 1] = did.data[i * 4 + 2] = 255;
        did.data[i * 4 + 3] = Math.round(255 * 0.92 * Math.pow(Math.min(1, diff[i] / p97), 0.9));
      }
      bx.putImageData(bid, 0, 0); dx.putImageData(did, 0, 0);
      return (ds._win[p] = { base: base, diff: dm });
    }

    function drawWindow() {
      var on = !!state.on.change;
      win.classList.toggle("on", on);
      if (!on) return;
      var dpr = window.devicePixelRatio || 1, p = Math.min(state.f, T - 2);
      winPanels.forEach(function (pn) {
        var ds = pn.st.ds, m = winMaps(ds, p);
        if (!m) return;
        pn.cv.forEach(function (cv, j) {
          var w = cv.parentNode.clientWidth, h = cv.parentNode.clientHeight;
          if (!w) return;
          cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
          var cx = cv.getContext("2d"); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high";
          cx.drawImage(m.base, 0, 0, cv.width, cv.height);
          if (j === 0) cx.drawImage(m.diff, 0, 0, cv.width, cv.height);
          else {
            var o = pn.st.off, ox = o.getContext("2d"), id = ox.createImageData(G, G), c = hex("#2a78d6");
            for (var k = 0; k < G * G; k++) {
              var a = Math.max(0, Math.min(1, (ds.change[p][k] - 0.35) / 0.65));
              id.data[k * 4] = c[0]; id.data[k * 4 + 1] = c[1]; id.data[k * 4 + 2] = c[2]; id.data[k * 4 + 3] = Math.round(255 * 0.9 * Math.pow(a, 1.1));
            }
            ox.putImageData(id, 0, 0); cx.drawImage(o, 0, 0, cv.width, cv.height);
          }
        });
      });
    }
    function drawAll() { stages.forEach(drawStage); drawWindow(); }

    function render() {
      stages.forEach(function (st) { st.img.src = st.ds.frames[state.f]; });
      dotEls.forEach(function (d, i) { d.classList.toggle("on", i === state.f); });
      play.textContent = state.playing ? "Pause" : "Play";
      play.setAttribute("aria-label", state.playing ? "Pause both clips" : "Play both clips");
      var any = STREAMS.some(function (s) { return state.on[s.id]; });
      noteList.innerHTML = "";
      if (!any) {
        var e = el("div", "se-note empty", noteList);
        e.textContent = "Check a stream to mark it on both frames.";
      }
      drawAll();
    }

    state.on.spectrum = true; STREAMS[0].cb.checked = true;
    render();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawAll);
  }
})();
