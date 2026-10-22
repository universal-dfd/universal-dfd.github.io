/* Alternative hero teasers.
   TeaserAlt.mountPortholes(root, base): two round clips with a movable lens.
   TeaserAlt.mountStories(root, base):   a four-clip "real or AI?" game in a phone.
   Every overlay is an output of the released SEAM checkpoint on the centre square of each clip. */
(function () {
  "use strict";
  var STREAMS = {
    fine:   { name: "Fine detail", short: "Detail", color: "#4a3aa7", key: "ll_spatial", angle: -135,
      text: "Smooth areas are subtracted, leaving fine texture. The model reads it as one fingerprint for the whole frame, so the lens shows its input, not a verdict.",
      cap: "Smooth areas removed, fine texture left." },
    patch:  { name: "Unusual patches", short: "Patches", color: "#eb6834", key: "sem_spatial", angle: -45,
      text: "A frozen vision model describes every small tile. Warmer tiles sit further from tiles of real footage. Real clips have odd tiles too.",
      cap: "Warmer tiles sit further from real footage." },
    move:   { name: "Movement", short: "Motion", color: "#0f8f8f", key: "ll_temporal", angle: 45,
      text: "Each tile is matched to its best neighbour in the next frame. Arrows fade where the match is unsure.",
      cap: "Arrows show where each tile moves next." },
    change: { name: "Change", short: "Change", color: "#2a78d6", key: "sem_temporal", angle: 135,
      text: "Each tile is compared with the next frame (the double image). Blue tiles changed unusually.",
      cap: "Blue tiles changed unusually between frames." }
  };
  var ORDER = ["fine", "patch", "move", "change"], G = 14, T = 8;

  function el(tag, cls, parent) { var n = document.createElement(tag); if (cls) n.className = cls; if (parent) parent.appendChild(n); return n; }
  function ns(tag, attrs, parent) { var n = document.createElementNS("http://www.w3.org/2000/svg", tag); for (var k in attrs) n.setAttribute(k, attrs[k]); if (parent) parent.appendChild(n); return n; }
  function pol(r, a) { var t = a * Math.PI / 180; return [50 + r * Math.cos(t), 50 + r * Math.sin(t)]; }
  function arcPath(r, a0, a1) { var p0 = pol(r, a0), p1 = pol(r, a1); return "M" + p0[0] + " " + p0[1] + " A" + r + " " + r + " 0 " + ((a1 - a0) > 180 ? 1 : 0) + " 1 " + p1[0] + " " + p1[1]; }
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function fmt(v) { return v < 0.005 ? "0.00" : v.toFixed(2); }
  function getJSON(u) { return fetch(u).then(function (r) { return r.json(); }); }
  function pctAbove(ref, p) { var n = 0; for (var i = 0; i < ref.length; i++) if (ref[i] < p) n++; return Math.round(100 * n / ref.length); }
  function loadImgs(dir, names, onload) { return names.map(function (f) { var im = new Image(); im.onload = onload; im.src = dir + f; return im; }); }
  function visible(root) { return root.offsetParent !== null && !document.hidden; }

  /* what one lens shows, drawn into ctx over a square canvas of side S */
  function drawLens(ctx, S, dpr, clip, f, mode, lx, ly, LR) {
    var d = clip.d, pr = Math.min(f, T - 2), s = STREAMS[mode], cx = lx * S, cy = ly * S, R = LR * S;
    var base = clip.frames[f]; if (base && base.complete) ctx.drawImage(base, 0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.clip();
    function heat(vals, color) {
      var col = hex(color), ox = clip.heat.getContext("2d"), id = ox.createImageData(G, G);
      for (var k = 0; k < G * G; k++) { var a = Math.max(0, Math.min(1, (vals[k] - 0.35) / 0.65)); id.data[k * 4] = col[0]; id.data[k * 4 + 1] = col[1]; id.data[k * 4 + 2] = col[2]; id.data[k * 4 + 3] = Math.round(255 * 0.85 * Math.pow(a, 1.15)); }
      ox.putImageData(id, 0, 0); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high"; ctx.drawImage(clip.heat, 0, 0, S, S);
    }
    if (mode === "fine") {
      var rs = clip.resid[f]; if (rs && rs.complete) { ctx.imageSmoothingEnabled = false; ctx.drawImage(rs, 0, 0, S, S); ctx.imageSmoothingEnabled = true; }
      ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgb(205,195,255)"; ctx.fillRect(0, 0, S, S); ctx.globalCompositeOperation = "source-over";
    } else if (mode === "patch") {
      ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(0, 0, S, S); heat(d.spatial[f], s.color);
      ctx.strokeStyle = "rgba(0,0,0,.14)"; ctx.lineWidth = dpr; ctx.beginPath();
      for (var g = 1; g < G; g++) { ctx.moveTo(g * S / G, 0); ctx.lineTo(g * S / G, S); ctx.moveTo(0, g * S / G); ctx.lineTo(S, g * S / G); } ctx.stroke();
    } else if (mode === "change") {
      var nx = clip.frames[pr + 1]; if (nx && nx.complete) { ctx.globalAlpha = 0.5; ctx.drawImage(nx, 0, 0, S, S); ctx.globalAlpha = 1; }
      heat(d.change[pr], s.color);
    } else {
      ctx.fillStyle = "rgba(15,20,25,.35)"; ctx.fillRect(0, 0, S, S);
      var cell = S / G; ctx.lineCap = "round";
      for (var k = 0; k < G * G; k++) {
        var x0 = (k % G + 0.5) * cell, y0 = (Math.floor(k / G) + 0.5) * cell;
        if (Math.hypot(x0 - cx, y0 - cy) > R + cell) continue;
        var dy = d.disp[pr][k][0], dx = d.disp[pr][k][1], conf = d.conf[pr][k], al = Math.max(0.2, Math.min(1, (conf - 0.7) / 0.25));
        var ex = x0 + dx * cell * 1.15, ey = y0 + dy * cell * 1.15, ang = Math.atan2(ey - y0, ex - x0), hl = 5 * dpr, len = Math.hypot(ex - x0, ey - y0);
        ctx.globalAlpha = al;
        [["rgba(255,255,255,.95)", 3.4], [s.color, 1.8]].forEach(function (pass) {
          ctx.strokeStyle = pass[0]; ctx.lineWidth = pass[1] * dpr; ctx.beginPath();
          if (len < 0.5) { ctx.arc(x0, y0, 1.5 * dpr, 0, 6.3); } else {
            ctx.moveTo(x0, y0); ctx.lineTo(ex, ey);
            ctx.moveTo(ex, ey); ctx.lineTo(ex - hl * Math.cos(ang - 0.5), ey - hl * Math.sin(ang - 0.5));
            ctx.moveTo(ex, ey); ctx.lineTo(ex - hl * Math.cos(ang + 0.5), ey - hl * Math.sin(ang + 0.5));
          }
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.lineWidth = 4.5 * dpr; ctx.strokeStyle = "#fff"; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.5 * dpr, 0, 2 * Math.PI); ctx.lineWidth = 2.2 * dpr; ctx.strokeStyle = s.color; ctx.stroke();
  }

  function loadClip(dir) {
    return getJSON(dir + "data.json").then(function (d) { return { d: d, dir: dir, heat: (function () { var c = document.createElement("canvas"); c.width = c.height = G; return c; })() }; });
  }

  /* ======================= circle lens ======================= */
  function mountPortholes(root, base) {
    root.innerHTML = ""; root.classList.add("tzb");
    var CL = [{ id: "ai", label: "AI-generated" }, { id: "real", label: "Real" }];
    Promise.all([loadClip(base + "ai/"), loadClip(base + "real/"), getJSON(base + "ref.json")]).then(function (r) { init([r[0], r[1]], r[2]); })
      .catch(function () { root.textContent = "Interactive example unavailable."; });

    function init(clips, ref) {
      var st = { f: 0, mode: "fine", lx: 0.62, ly: 0.46, playing: !matchMedia("(prefers-reduced-motion: reduce)").matches }, LR = 0.25;
      var stage = el("div", "tzb-stage", root);
      var P = clips.map(function (c, i) {
        var host = el("div", "tzb-ph " + CL[i].id, stage), svg = ns("svg", { "class": "ring", viewBox: "0 0 100 100" }, host);
        var frame = el("div", "tzb-frame", host), canvas = el("canvas", "", frame);
        el("div", "tzb-tag", host).textContent = CL[i].label;
        var rank = el("div", "tzb-rank", host), pct = pctAbove(ref, c.d.prob);
        rank.innerHTML = i === 0 ? (pct >= 100 ? "scores <b>higher than all " + ref.length + "</b> real clips" : "scores higher than <b>" + pct + "%</b> of real clips")
                                  : "scores like real footage: higher than <b>" + pct + "%</b> of real clips";
        var arcs = {};
        ORDER.forEach(function (k) {
          var s = STREAMS[k], g = ns("g", { "class": "arc", tabindex: 0, role: "button", "aria-label": s.name + " stream, score " + fmt(c.d.parts[s.key]) }, svg), a0 = s.angle - 35, a1 = s.angle + 35;
          ns("path", { "class": "track", d: arcPath(46, a0, a1) }, g);
          ns("path", { "class": "fill", d: arcPath(46, a0, a0 + 70 * Math.max(c.d.parts[s.key], 0.012)), stroke: s.color }, g);
          ns("path", { "class": "hit", d: arcPath(46, a0, a1) }, g);
          g.addEventListener("click", function () { st.mode = k; render(); });
          g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); st.mode = k; render(); } });
          arcs[k] = g;
        });
        c.frames = loadImgs(c.dir, c.d.frames, draw); c.resid = loadImgs(c.dir, c.d.resid, draw);
        var p = { c: c, canvas: canvas, ctx: canvas.getContext("2d"), frame: frame, svg: svg, arcs: arcs };
        frame.addEventListener("pointermove", function (e) { move(p, e); });
        frame.addEventListener("pointerdown", function (e) { frame.setPointerCapture(e.pointerId); move(p, e); });
        return p;
      });
      var info = el("div", "tzb-info", root), title = el("div", "tzb-title", info), vals = el("div", "tzb-vals", info), text = el("p", "tzb-text", info);
      var bar = el("div", "tzb-bar", root), play = el("button", "tzb-play", bar); play.type = "button";
      var dots = el("div", "tzb-dots", bar), dotEls = [];
      for (var i = 0; i < T; i++) (function (i) { var b = el("button", "tzb-dot", dots); b.type = "button"; b.setAttribute("aria-label", "Show frame " + (i + 1)); b.addEventListener("click", function () { st.playing = false; st.f = i; render(); }); dotEls.push(b); })(i);
      el("p", "tzb-hint", root).textContent = "Slide the lens over a clip. Click a ring to change the view.";
      play.addEventListener("click", function () { st.playing = !st.playing; render(); });
      setInterval(function () { if (st.playing && visible(root)) { st.f = (st.f + 1) % T; render(); } }, 760);

      function move(p, e) {
        var r = p.canvas.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height, dx = u - 0.5, dy = v - 0.5, m = 0.48, d = Math.hypot(dx, dy);
        if (d > m) { u = 0.5 + dx * m / d; v = 0.5 + dy * m / d; } st.lx = u; st.ly = v; draw();
      }
      function layout() { var w = root.clientWidth || 520, D = Math.max(150, Math.min(300, w * 0.46)); root.style.setProperty("--D", D + "px"); stage.style.setProperty("--D", D + "px"); stage.querySelectorAll(".tzb-ph").forEach(function (n) { n.style.setProperty("--D", D + "px"); }); }
      function draw() {
        if (!root.offsetParent) return;
        P.forEach(function (p) {
          var dpr = window.devicePixelRatio || 1, S = Math.round(p.frame.clientWidth * dpr); if (!S) return;
          if (p.canvas.width !== S) p.canvas.width = p.canvas.height = S;
          p.ctx.clearRect(0, 0, S, S); drawLens(p.ctx, S, dpr, p.c, st.f, st.mode, st.lx, st.ly, LR);
        });
      }
      function render() {
        var s = STREAMS[st.mode];
        title.textContent = s.name; title.style.color = s.color; text.textContent = s.text;
        vals.innerHTML = P.map(function (p, i) { return "<span><i>" + CL[i].label + "</i>" + fmt(p.c.d.parts[s.key]) + "</span>"; }).join("");
        P.forEach(function (p) { p.svg.classList.add("has-on"); ORDER.forEach(function (k) { p.arcs[k].classList.toggle("on", k === st.mode); }); });
        dotEls.forEach(function (b, i) { b.classList.toggle("on", i === st.f); });
        play.textContent = st.playing ? "Pause" : "Play"; draw();
      }
      layout(); render();
      if (window.ResizeObserver) new ResizeObserver(function () { layout(); draw(); }).observe(root); else window.addEventListener("resize", function () { layout(); draw(); });
      root._tzRedraw = function () { layout(); render(); };
    }
  }

  /* ======================= stories ======================= */
  function mountStories(root, base) {
    root.innerHTML = ""; root.classList.add("tzc");
    Promise.all([getJSON(base + "meta.json"), getJSON(base + "ref.json")]).then(function (rs) {
      var meta = rs[0], ref = rs[1], thr = ref[Math.floor(0.9 * ref.length)];
      return Promise.all(meta.clips.map(function (m) { return loadClip(base + m.id + "/").then(function (c) { c.m = m; return c; }); })).then(function (clips) { init(meta, clips, ref, thr); });
    }).catch(function () { root.textContent = "Interactive example unavailable."; });

    function init(meta, clips, ref, thr) {
      var st = { i: 0, phase: "guess", answers: [], mode: "fine", f: 0, lx: 0.55, ly: 0.5 }, LR = 0.26, timer = null, canvas = null, ctx = null, barFill = null, N = clips.length;
      clips.forEach(function (c) { c.frames = loadImgs(c.dir, c.d.frames, drawC); c.resid = loadImgs(c.dir, c.d.resid, drawC); });
      var bubbles = el("div", "tzc-bubbles", root), tally = el("div", "tzc-tally", root), wrap = el("div", "tzc-wrap", root);
      var phone = el("div", "tzc-phone", wrap), screen = el("div", "tzc-screen", phone);
      var flagged = function (c) { return c.d.prob > thr; };

      function ring(c, answered, svg) {
        svg.innerHTML = "";
        if (!answered) {
          var defs = ns("defs", {}, svg), g = ns("linearGradient", { id: "tzg" + c.m.id, x1: "0", y1: "1", x2: "1", y2: "0" }, defs);
          [["0", "#f9ce34"], ["0.5", "#ee2a7b"], ["1", "#6228d7"]].forEach(function (s) { ns("stop", { offset: s[0], "stop-color": s[1] }, g); });
          ns("circle", { cx: 50, cy: 50, r: 46, fill: "none", stroke: "url(#tzg" + c.m.id + ")", "stroke-width": 4.5 }, svg);
        } else ORDER.forEach(function (k) {
          var a = STREAMS[k].angle, v = Math.max(c.d.parts[STREAMS[k].key], 0.02);
          ns("path", { d: arcPath(46, a - 40, a + 40), fill: "none", stroke: "rgba(0,0,0,.12)", "stroke-width": 4.5, "stroke-linecap": "round" }, svg);
          ns("path", { d: arcPath(46, a - 40, a - 40 + 80 * v), fill: "none", stroke: STREAMS[k].color, "stroke-width": 4.5, "stroke-linecap": "round" }, svg);
        });
      }
      function renderBubbles() {
        bubbles.innerHTML = "";
        clips.forEach(function (c, i) {
          var b = el("button", "tzc-bubble" + (i === st.i && st.phase !== "end" ? " now" : "") + (i > st.answers.length ? " locked" : ""), bubbles); b.type = "button"; b.setAttribute("aria-label", "Clip " + (i + 1));
          ring(c, i < st.answers.length, ns("svg", { viewBox: "0 0 100 100" }, b));
          var im = el("img", "", b); im.src = c.dir + "f0.jpg"; im.alt = ""; el("span", "n", b).textContent = i + 1;
          b.addEventListener("click", function () { if (i <= st.answers.length && i !== st.i) { st.i = i; st.phase = i < st.answers.length ? "reveal" : "guess"; st.f = 0; renderAll(); } });
        });
      }
      function renderTally() { var you = 0; st.answers.forEach(function (a, i) { if ((a === "ai") === (clips[i].m.kind === "ai")) you++; }); tally.innerHTML = "<i>You</i>" + you + " / " + st.answers.length; }
      function renderAll() { renderBubbles(); renderTally(); renderScreen(); }
      function start() { st.i = 0; st.phase = "guess"; st.answers = []; renderAll(); }

      function renderScreen() {
        clearInterval(timer); screen.innerHTML = ""; canvas = null;
        if (st.phase === "end") return endView();
        var c = clips[st.i], bg = el("div", "tzc-bg", screen); bg.style.backgroundImage = "url(" + c.dir + "f0.jpg)";
        var bars = el("div", "tzc-topbars", screen);
        if (st.phase === "guess") barFill = el("b", "", el("i", "", bars));
        else ORDER.forEach(function (k) { var b = el("b", "", el("i", "", bars)); b.style.background = STREAMS[k].color; setTimeout(function () { b.style.transition = "width 1s ease"; b.style.width = Math.max(4, 100 * c.d.parts[STREAMS[k].key]) + "%"; }, 80); });
        var head = el("div", "tzc-head", screen), av = el("img", "", head); av.src = c.dir + "f0.jpg"; av.alt = "";
        el("span", "", head).textContent = "clip_" + (st.i + 1); el("small", "", head).textContent = (st.i + 1) + " of " + N;
        st.phase === "guess" ? guessView(c) : revealView(c);
      }
      function guessView(c) {
        var media = el("div", "tzc-media", screen), v = el("video", "", media);
        v.src = c.dir + "clip.mp4"; v.muted = true; v.loop = true; v.autoplay = true; v.playsInline = true; v.setAttribute("playsinline", "");
        el("div", "tzc-pause", media).textContent = "Paused";
        media.addEventListener("click", function () { if (v.paused) { v.play(); media.classList.remove("paused"); } else { v.pause(); media.classList.add("paused"); } });
        v.addEventListener("timeupdate", function () { if (barFill && v.duration) barFill.style.width = (100 * v.currentTime / v.duration) + "%"; });
        var bot = el("div", "tzc-bottom", screen); el("p", "tzc-q", bot).textContent = "Real, or AI-generated?";
        var g = el("div", "tzc-guess", bot), a = el("button", "real", g), b = el("button", "ai", g); a.type = b.type = "button"; a.textContent = "Real"; b.textContent = "AI-generated";
        a.addEventListener("click", function () { answer("real"); }); b.addEventListener("click", function () { answer("ai"); });
        el("div", "tzc-tiny", bot).textContent = "Tap the clip to pause.";
      }
      function answer(a) { st.answers[st.i] = a; st.phase = "reveal"; st.f = 0; renderAll(); }
      function revealView(c) {
        var ai = c.m.kind === "ai", you = st.answers[st.i], right = (you === "ai") === ai, fl = flagged(c), seamRight = fl === ai;
        var port = el("div", "tzc-port", screen), disc = el("div", "tzc-disc", port); canvas = el("canvas", "", disc); ctx = canvas.getContext("2d");
        disc.addEventListener("pointermove", moveLens); disc.addEventListener("pointerdown", function (e) { disc.setPointerCapture(e.pointerId); moveLens(e); });
        var facts = el("div", "tzc-facts", screen), t = el("div", "tzc-fact " + (ai ? "aiS" : "realS"), facts);
        t.innerHTML = "<b>" + (ai ? "AI-generated" : "Real") + "</b>" + (ai ? "made by " + c.m.generator + "<br>" : "") + "you " + (right ? "got it" : "missed it");
        var sm = el("div", "tzc-fact seam", facts);
        sm.innerHTML = "<b>SEAM</b>higher than " + pctAbove(ref, c.d.prob) + "% of real clips<br><span class='v " + (seamRight ? "ok" : "bad") + "'>" + (fl ? "flags it" : "reads it as real") + "</span>";
        var bot = el("div", "tzc-bottom", screen), chips = el("div", "tzc-chips", bot);
        ORDER.forEach(function (k) {
          var ch = el("button", "tzc-chip" + (k === st.mode ? " on" : ""), chips); ch.type = "button"; ch.style.borderColor = STREAMS[k].color;
          ch.innerHTML = STREAMS[k].short + "<i><b style='width:" + Math.max(3, 100 * c.d.parts[STREAMS[k].key]) + "%;background:" + STREAMS[k].color + "'></b></i>";
          ch.addEventListener("click", function () { st.mode = k; renderScreen(); });
        });
        el("p", "tzc-capt", bot).textContent = STREAMS[st.mode].cap;
        var nx = el("button", "tzc-btn", bot); nx.type = "button"; nx.textContent = st.i < N - 1 ? "Next story" : "See results";
        nx.addEventListener("click", function () { if (st.i < N - 1) { st.i++; st.phase = st.i < st.answers.length ? "reveal" : "guess"; st.f = 0; } else st.phase = "end"; renderAll(); });
        timer = setInterval(function () { if (visible(root)) { st.f = (st.f + 1) % T; drawC(); } }, 800); drawC();
      }
      function moveLens(e) {
        var r = canvas.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height, dx = u - 0.5, dy = v - 0.5, m = 0.47, d = Math.hypot(dx, dy);
        if (d > m) { u = 0.5 + dx * m / d; v = 0.5 + dy * m / d; } st.lx = u; st.ly = v; drawC();
      }
      function drawC() {
        if (!canvas || st.phase !== "reveal" || !root.offsetParent) return;
        var dpr = window.devicePixelRatio || 1, S = Math.round(canvas.clientWidth * dpr); if (!S) return;
        if (canvas.width !== S) canvas.width = canvas.height = S;
        ctx.clearRect(0, 0, S, S); drawLens(ctx, S, dpr, clips[st.i], st.f, st.mode, st.lx, st.ly, LR);
      }
      function endView() {
        var you = 0; clips.forEach(function (c, i) { if ((st.answers[i] === "ai") === (c.m.kind === "ai")) you++; });
        var bg = el("div", "tzc-bg", screen); bg.style.backgroundImage = "url(" + clips[0].dir + "f0.jpg)"; bg.style.filter = "blur(30px) brightness(.45)";
        var e = el("div", "tzc-end", screen); el("h2", "", e).textContent = "You got";
        el("div", "tzc-big", e).textContent = you + " / " + N;
        var rows = el("div", "tzc-rows", e);
        clips.forEach(function (c, i) { var ok = (st.answers[i] === "ai") === (c.m.kind === "ai"), d = el("div", "", rows); d.innerHTML = "<img src='" + c.dir + "f0.jpg' alt=''>" + (c.m.kind === "ai" ? "AI" : "real") + "<br><span class='" + (ok ? "y" : "n") + "'>" + (ok ? "✓" : "✗") + "</span>"; });
        el("p", "tzc-note", e).textContent = "These four were hand-picked: SEAM gets them right. Across " + (meta.n_ai + meta.n_real) + " held-out clips it flags about " + Math.round(meta.tpr * 100) + "% of AI clips at this setting, and 10% of real ones.";
        var b = el("button", "tzc-btn", e); b.type = "button"; b.textContent = "Play again"; b.style.maxWidth = "200px"; b.addEventListener("click", start);
      }
      start();
      root._tzRedraw = function () { drawC(); };
    }
  }

  window.TeaserAlt = { mountPortholes: mountPortholes, mountStories: mountStories };

  /* the variant switch: A original explorer, B circle lens, C stories. ?teaser=a|b|c opens one directly. */
  function initSwitch() {
    var sw = document.getElementById("tz-switch"); if (!sw) return;
    var EYE = { a: "See the four streams on an example video", b: "Slide a lens over two clips", c: "Can you tell which clip is AI?" };
    var CREDIT = { a: "", b: "", c: " Hand-picked examples." };
    var eye = document.getElementById("tz-eyebrow"), credit = document.getElementById("tz-credit"), mounted = {};
    var panes = { a: document.getElementById("stream-explorer"), b: document.getElementById("tz-b"), c: document.getElementById("tz-c") };
    var BASE = "assets/teaser_alt/";
    function show(v) {
      Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== v; });
      sw.querySelectorAll("button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-v") === v); });
      eye.textContent = EYE[v]; credit.firstChild.nodeValue = "Example clips: "; credit.lastChild.nodeValue = " (CC BY 4.0), trimmed." + CREDIT[v];
      if (v === "b" && !mounted.b) { mounted.b = true; mountPortholes(panes.b, BASE + "portholes/"); }
      if (v === "c" && !mounted.c) { mounted.c = true; mountStories(panes.c, BASE + "stories/"); }
      if (panes[v]._tzRedraw) setTimeout(panes[v]._tzRedraw, 0);
      try { history.replaceState(null, "", v === "a" ? location.pathname : "?teaser=" + v); } catch (e) {}
    }
    sw.addEventListener("click", function (e) { var b = e.target.closest("button"); if (b) show(b.getAttribute("data-v")); });
    var q = (new URLSearchParams(location.search).get("teaser") || "").toLowerCase();
    var map = { a: "a", original: "a", b: "b", lens: "b", circle: "b", c: "c", stories: "c", story: "c" };
    show(map[q] || "a");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initSwitch); else initSwitch();
})();
