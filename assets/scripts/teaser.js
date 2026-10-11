/* Hero explorer: check a stream to see what it measures on one clip.
   All overlays are outputs of the released SEAM checkpoint on this clip. */
(function () {
  "use strict";
  var root = document.getElementById("stream-explorer");
  if (!root) return;

  var STREAMS = [
    { id: "spectrum", name: "Spatial spectrum", kind: "Low-level artifacts", color: "#4a3aa7",
      text: "How much energy each frame has at every spatial frequency. The gray band is the range real footage occupies; the hatched region is a high-frequency band we discard because it mostly encodes resolution and compression." },
    { id: "semantic", name: "Semantic spatial", kind: "Learned representations", color: "#eb6834",
      text: "A frozen encoder reads each patch of the frame. Orange marks patches that sit farthest from typical patches of real footage." },
    { id: "motion", name: "Motion coherence", kind: "Physical plausibility", color: "#0f8f8f",
      text: "Arrows follow each patch to its best match in the next frame, shown where the match is confident. Real motion carries neighbors along together; regenerated frames often don't." },
    { id: "change", name: "Semantic change", kind: "Physical plausibility", color: "#2a78d6",
      text: "Blue marks patches whose features changed in an unusual way from one frame to the next." }
  ];

  fetch("assets/data/teaser.json").then(function (r) { return r.json(); }).then(init)
    .catch(function () { root.textContent = "Interactive example unavailable."; });

  function el(tag, cls, parent) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

  function init(D) {
    var T = D.frames.length, G = D.grid;
    var state = { f: 0, on: {}, playing: !window.matchMedia("(prefers-reduced-motion: reduce)").matches };
    D.frames.forEach(function (src) { new Image().src = src; });

    root.innerHTML = "";
    var stage = el("div", "se-stage", root);
    stage.style.aspectRatio = String(D.aspect);
    var img = el("img", "se-frame", stage);
    img.alt = "A frame from an AI-generated video of a corgi in a park";
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
    svg.setAttribute("viewBox", "0 0 300 96"); svg.setAttribute("role", "img");
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

    function draw() {
      var dpr = window.devicePixelRatio || 1, w = stage.clientWidth, h = stage.clientHeight;
      if (!w) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (state.on.semantic) heat(D.spatial[state.f], "#eb6834", 0.35);
      if (state.on.change) heat(D.change[Math.min(state.f, T - 2)], "#2a78d6", 0.35);
      if (state.on.motion) arrows();
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
        '<text x="2" y="95" class="se-t">low frequency</text>' +
        '<text x="298" y="95" text-anchor="end" class="se-t">high</text>';
    }

    function render() {
      img.src = D.frames[state.f];
      dotEls.forEach(function (d, i) { d.classList.toggle("on", i === state.f); });
      play.textContent = state.playing ? "Pause" : "Play";
      play.setAttribute("aria-label", state.playing ? "Pause the clip" : "Play the clip");
      var any = false;
      noteList.innerHTML = "";
      STREAMS.forEach(function (s) {
        if (!state.on[s.id]) return;
        any = true;
        var n = el("div", "se-note", noteList);
        n.style.setProperty("--c", s.color);
        var b = el("b", "", n); b.textContent = s.name + ". ";
        n.appendChild(document.createTextNode(s.text));
      });
      if (!any) {
        var e = el("div", "se-note empty", noteList);
        e.textContent = "Check a stream to see what it measures on this clip.";
      }
      plotWrap.style.display = state.on.spectrum ? "block" : "none";
      if (state.on.spectrum) drawSpectrum();
      draw();
    }

    state.on.semantic = true; STREAMS[1].cb.checked = true;
    render();
  }
})();
