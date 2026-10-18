/* Tabs, "show all" buttons and the embedding explorer. */
(function () {
  "use strict";

  /* ---------------- tabs (gallery blocks) ---------------- */
  document.querySelectorAll(".tabs:not(.ex-tabs)").forEach(function (bar) {
    bar.addEventListener("click", function (e) {
      var btn = e.target.closest(".tab");
      if (!btn) return;
      var scope = bar.closest(".tab-scope");
      bar.querySelectorAll(".tab").forEach(function (b) {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-selected", b === btn ? "true" : "false");
      });
      scope.querySelectorAll(".tab-panel").forEach(function (p) {
        p.classList.toggle("active", p.id === btn.dataset.tab);
      });
    });
  });

  document.querySelectorAll(".show-more").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var more = document.querySelector("#" + btn.dataset.target + " .more");
      if (!more) return;
      more.hidden = !more.hidden;
      btn.textContent = more.hidden ? "Show all" : "Show fewer";
    });
  });

  /* ---------------- embedding explorer ---------------- */
  var BLUE = "#2a78d6", GREEN = "#1baf7a", PURPLE = "#4a3aa7",
      ORANGE = "#eb6834", RED = "#e34948", GOLD = "#eda100", INK = "#353535";

  var BUCKETS = [
    { label: "Training generator (Open-Sora)", short: "training-generator", color: BLUE, shape: "cross", members: ["ID"], step: 2 },
    { label: "Unseen open-source", short: "unseen open-source", color: GREEN, shape: "cross", members: ["HunyuanVideo", "AccVideo"], step: 3 },
    { label: "Unseen commercial", short: "unseen commercial", color: ORANGE, shape: "cross", members: ["Sora", "Gen2", "pika"], step: 4 },
    { label: "Real footage", short: "real footage", color: INK, shape: "circle", members: ["Real"], step: 1 }
  ];

  var EXPLORERS = {
    aigvd: {
      title: "AIGVDBench",
      views: [
        { id: "story", label: "Reveal", story: true, groups: BUCKETS },
        { id: "bucket", label: "Training / unseen / real", groups: BUCKETS },
        { id: "gen", label: "By generator", groups: [
          { label: "Training generator", color: BLUE, shape: "cross", members: ["ID"] },
          { label: "HunyuanVideo", color: GREEN, shape: "cross", members: ["HunyuanVideo"] },
          { label: "AccVideo", color: PURPLE, shape: "cross", members: ["AccVideo"] },
          { label: "Sora", color: RED, shape: "cross", members: ["Sora"] },
          { label: "Gen2", color: ORANGE, shape: "cross", members: ["Gen2"] },
          { label: "Pika", color: GOLD, shape: "cross", members: ["pika"] },
          { label: "Real", color: INK, shape: "circle", members: ["Real"] }
        ] }
      ]
    },
    slop: {
      title: "SLOP",
      views: [
        { id: "source", label: "By source", groups: [
          { label: "AI · Instagram", color: BLUE, shape: "circle", members: ["ai_instagram"] },
          { label: "AI · TikTok", color: GREEN, shape: "circle", members: ["ai_tiktok"] },
          { label: "AI · X", color: PURPLE, shape: "circle", members: ["ai_x"] },
          { label: "Real · Instagram", color: ORANGE, shape: "triangle", members: ["real_instagram"] },
          { label: "Real · TikTok", color: RED, shape: "triangle", members: ["real_tiktok"] },
          { label: "Real · X", color: GOLD, shape: "triangle", members: ["real_x"] }
        ] },
        { id: "label", label: "AI vs. real", groups: [
          { label: "AI", color: BLUE, shape: "circle", members: ["ai_instagram", "ai_tiktok", "ai_x"] },
          { label: "Real", color: ORANGE, shape: "triangle", members: ["real_instagram", "real_tiktok", "real_x"] }
        ] }
      ]
    }
  };

  var W = 760, H = 440, M = { l: 50, r: 16, t: 14, b: 42 };
  var NS = "http://www.w3.org/2000/svg";
  var STEPS = ["Real footage", "Training generator", "Unseen open-source", "Unseen commercial"];

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function h(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function niceTicks(lo, hi, count) {
    var span = hi - lo, raw = span / count, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var step = [1, 2, 5, 10].map(function (m) { return m * mag; })
      .find(function (s) { return s >= raw; });
    var out = [];
    for (var t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) out.push(+t.toFixed(6));
    return out;
  }

  function marker(shape, cx, cy, color, parent) {
    var n;
    if (shape === "circle") {
      n = el("circle", { cx: cx, cy: cy, r: 5.2, fill: color, "fill-opacity": 0.78, stroke: "#fff", "stroke-width": 0.8 }, parent);
    } else if (shape === "triangle") {
      var r = 6.6;
      n = el("path", { d: "M" + cx + " " + (cy - r) + "L" + (cx + r) + " " + (cy + r * 0.75) + "L" + (cx - r) + " " + (cy + r * 0.75) + "Z",
        fill: color, "fill-opacity": 0.78, stroke: "#fff", "stroke-width": 0.8 }, parent);
    } else {
      var d = 4.6;
      n = el("path", { d: "M" + (cx - d) + " " + (cy - d) + "L" + (cx + d) + " " + (cy + d) + "M" + (cx - d) + " " + (cy + d) + "L" + (cx + d) + " " + (cy - d),
        fill: "none", stroke: color, "stroke-width": 2, "stroke-linecap": "round", "stroke-opacity": 0.85 }, parent);
    }
    n.setAttribute("class", "pt");
    return n;
  }

  /* 95% confidence ellipse of a 2-D point set, and the share of other points inside it */
  function cloud(pts) {
    var n = pts.length, mx = 0, my = 0, i;
    pts.forEach(function (p) { mx += p[0]; my += p[1]; });
    mx /= n; my /= n;
    var sxx = 0, syy = 0, sxy = 0;
    pts.forEach(function (p) { var a = p[0] - mx, b = p[1] - my; sxx += a * a; syy += b * b; sxy += a * b; });
    sxx /= n - 1; syy /= n - 1; sxy /= n - 1;
    var det = sxx * syy - sxy * sxy, Q = 5.991;
    var tr = sxx + syy, disc = Math.sqrt(Math.max(0, tr * tr / 4 - det));
    var l1 = tr / 2 + disc, l2 = tr / 2 - disc;
    var ang = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    var path = [];
    for (i = 0; i <= 90; i++) {
      var t = 2 * Math.PI * i / 90, u = Math.sqrt(Q * l1) * Math.cos(t), v = Math.sqrt(Q * l2) * Math.sin(t);
      path.push([mx + u * Math.cos(ang) - v * Math.sin(ang), my + u * Math.sin(ang) + v * Math.cos(ang)]);
    }
    return {
      path: path,
      inside: function (p) {
        var a = p[0] - mx, b = p[1] - my;
        return (syy * a * a - 2 * sxy * a * b + sxx * b * b) / det <= Q;
      }
    };
  }

  function mount(root, key, points) {
    var spec = EXPLORERS[key];
    var state = { view: 0, hidden: {}, step: key === "aigvd" ? 4 : 0, playing: false, fresh: -1, played: false, timer: null };
    root.innerHTML = "";
    h("h3", "", root, spec.title);

    var tabbed = h("div", "tabbed", root);
    var bar = h("div", "tabs ex-tabs", tabbed);
    bar.setAttribute("role", "tablist");
    var body = h("div", "tab-body plot-wrap", tabbed);

    var story = h("div", "story-bar", body);
    var stepBtns = [];
    STEPS.forEach(function (name, i) {
      var b = h("button", "step", story);
      b.type = "button";
      b.innerHTML = '<span class="n">' + (i + 1) + "</span>" + name;
      b.addEventListener("click", function () { stopPlay(); setStep(i + 1, true); });
      stepBtns.push(b);
    });
    var playBtn = h("button", "play", story, "Play");
    playBtn.type = "button";
    var stat = h("div", "story-stat", body);

    var tip = h("div", "tip", body);
    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": spec.title + " clip embeddings projected to two dimensions with PCA" });
    body.appendChild(svg);
    var legend = h("div", "legend", body);

    var xs = points.map(function (p) { return p[0]; }), ys = points.map(function (p) { return p[1]; });
    function pad(a) { var lo = Math.min.apply(null, a), hi = Math.max.apply(null, a), p = (hi - lo) * 0.05; return [lo - p, hi + p]; }
    var xr = pad(xs), yr = pad(ys);
    function sx(v) { return M.l + (v - xr[0]) / (xr[1] - xr[0]) * (W - M.l - M.r); }
    function sy(v) { return H - M.b - (v - yr[0]) / (yr[1] - yr[0]) * (H - M.t - M.b); }

    var realCloud = null, inside = {};
    if (key === "aigvd") {
      var real = points.filter(function (p) { return p[2] === "Real"; });
      realCloud = cloud(real);
      BUCKETS.forEach(function (g, gi) {
        var pts = points.filter(function (p) { return g.members.indexOf(p[2]) >= 0; });
        inside[gi] = Math.round(100 * pts.filter(realCloud.inside).length / pts.length);
      });
    }

    function drawAxes() {
      niceTicks(xr[0], xr[1], 7).forEach(function (t) {
        el("line", { x1: sx(t), x2: sx(t), y1: M.t, y2: H - M.b, class: "gridline" }, svg);
        var tx = el("text", { x: sx(t), y: H - M.b + 17, "text-anchor": "middle" }, svg); tx.textContent = t;
      });
      niceTicks(yr[0], yr[1], 5).forEach(function (t) {
        el("line", { x1: M.l, x2: W - M.r, y1: sy(t), y2: sy(t), class: "gridline" }, svg);
        var tx = el("text", { x: M.l - 8, y: sy(t) + 4, "text-anchor": "end" }, svg); tx.textContent = t;
      });
      el("rect", { x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b, fill: "none", class: "axis" }, svg);
      var lx = el("text", { x: (M.l + W - M.r) / 2, y: H - 6, "text-anchor": "middle" }, svg); lx.textContent = "PC1";
      var ly = el("text", { x: 14, y: (M.t + H - M.b) / 2, "text-anchor": "middle",
        transform: "rotate(-90 14 " + ((M.t + H - M.b) / 2) + ")" }, svg); ly.textContent = "PC2";
    }

    function drawCloud() {
      var d = realCloud.path.map(function (p, i) { return (i ? "L" : "M") + sx(p[0]).toFixed(1) + " " + sy(p[1]).toFixed(1); }).join("") + "Z";
      el("path", { d: d, class: "cloud" }, svg);
      var top = realCloud.path.reduce(function (a, p) { return p[1] > a[1] ? p : a; }, realCloud.path[0]);
      var t = el("text", { x: sx(top[0]) - 12, y: sy(top[1]) + 14, class: "cloud-label", "text-anchor": "end" }, svg);
      t.textContent = "95% of real footage";
    }

    function countUp(node, to) {
      var from = 0, t0 = null;
      function frame(ts) {
        if (t0 === null) t0 = ts;
        var k = Math.min(1, (ts - t0) / 700), v = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        node.textContent = v + "%";
        if (k < 1) requestAnimationFrame(frame);
      }
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { node.textContent = to + "%"; return; }
      requestAnimationFrame(frame);
    }

    function visible(view, gi) {
      if (state.hidden[view.id + gi]) return false;
      return !view.story || state.step >= view.groups[gi].step;
    }

    function render() {
      var view = spec.views[state.view];
      body.classList.toggle("is-story", !!view.story);
      svg.innerHTML = "";
      drawAxes();
      if (view.story && state.step >= 1) drawCloud();
      var lookup = {};
      view.groups.forEach(function (g, gi) { g.members.forEach(function (m) { lookup[m] = gi; }); });
      view.groups.forEach(function (g, gi) {
        if (!visible(view, gi)) return;
        var idx = 0;
        points.forEach(function (p) {
          if (lookup[p[2]] !== gi) return;
          var n = marker(g.shape, sx(p[0]), sy(p[1]), g.color, svg);
          if (view.story && state.fresh === gi) {
            n.classList.add("enter");
            n.style.animationDelay = Math.min(idx * 9, 700) + "ms";
          }
          idx++;
          n.addEventListener("mousemove", function (e) {
            var r = body.getBoundingClientRect();
            tip.style.display = "block";
            tip.style.left = Math.min(e.clientX - r.left + 12, r.width - 150) + "px";
            tip.style.top = (e.clientY - r.top + 12) + "px";
            tip.innerHTML = "<b>" + g.label + "</b><br>" + p[2].replace(/_/g, " ") +
              "<br>PC1 " + p[0].toFixed(2) + " · PC2 " + p[1].toFixed(2);
          });
          n.addEventListener("mouseleave", function () { tip.style.display = "none"; });
        });
      });
      state.fresh = -1;

      stepBtns.forEach(function (b, i) { b.classList.toggle("on", i + 1 === state.step); b.classList.toggle("done", i + 1 < state.step); });
      story.style.display = view.story ? "flex" : "none";
      playBtn.textContent = state.playing ? "Pause" : (state.step >= 4 ? "Replay" : "Play");
      stat.style.display = view.story ? "block" : "none";

      legend.innerHTML = "";
      view.groups.forEach(function (g, gi) {
        if (view.story && state.step < g.step) return;
        var b = h("button", "", legend);
        b.type = "button";
        b.setAttribute("aria-pressed", state.hidden[view.id + gi] ? "false" : "true");
        var sw = h("span", "sw", b);
        sw.style.background = g.shape === "cross" ? "transparent" : g.color;
        sw.style.border = g.shape === "cross" ? "2px solid " + g.color : "0";
        sw.style.borderRadius = g.shape === "circle" ? "50%" : (g.shape === "cross" ? "2px" : "0");
        if (g.shape === "triangle") sw.style.clipPath = "polygon(50% 0, 100% 100%, 0 100%)";
        b.appendChild(document.createTextNode(g.label));
        b.addEventListener("click", function () {
          state.hidden[view.id + gi] = !state.hidden[view.id + gi];
          render();
        });
        legend.appendChild(b);
      });
    }

    function updateStat(animate) {
      var gi = state.step === 2 ? 0 : state.step === 3 ? 1 : state.step === 4 ? 2 : -1;
      if (gi < 0) {
        stat.innerHTML = '<span class="num">&nbsp;</span><span class="txt">The dashed outline holds 95% of real footage in this two-dimensional view.</span>';
        return;
      }
      stat.innerHTML = '<span class="num"></span><span class="txt"></span>';
      stat.querySelector(".txt").textContent = "of the " + BUCKETS[gi].short + " clips fall inside the cloud of real footage.";
      var num = stat.querySelector(".num");
      num.style.color = BUCKETS[gi].color;
      if (animate) countUp(num, inside[gi]); else num.textContent = inside[gi] + "%";
    }

    function setStep(n, animate) {
      var prev = state.step;
      state.step = n;
      state.fresh = n >= prev ? BUCKETS.findIndex(function (g) { return g.step === n; }) : -1;
      render();
      updateStat(animate);
    }

    function stopPlay() { state.playing = false; clearTimeout(state.timer); }
    function play() {
      stopPlay();
      state.playing = true;
      var s = 1;
      setStep(1, true);
      (function next() {
        state.timer = setTimeout(function () {
          if (!state.playing) return;
          s += 1;
          setStep(s, true);
          if (s < 4) next(); else { state.playing = false; render(); }
        }, 2300);
      })();
      render();
    }
    playBtn.addEventListener("click", function () { if (state.playing) { stopPlay(); render(); } else play(); });

    spec.views.forEach(function (v, i) {
      var b = h("button", "tab" + (i === 0 ? " active" : ""), bar, v.label);
      b.type = "button"; b.setAttribute("role", "tab");
      b.addEventListener("click", function () {
        stopPlay();
        state.view = i; state.fresh = -1;
        bar.querySelectorAll(".tab").forEach(function (x, j) { x.classList.toggle("active", j === i); });
        render();
        if (v.story) updateStat(false);
      });
    });

    render();
    if (key === "aigvd") {
      updateStat(false);
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting && !state.played && state.view === 0) {
            state.played = true; io.disconnect(); setTimeout(play, 500);
          }
        }, { threshold: 0.55 });
        io.observe(body);
      }
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var roots = document.querySelectorAll("[data-explorer]");
    if (!roots.length) return;
    fetch("assets/data/pca.json").then(function (r) { return r.json(); }).then(function (data) {
      roots.forEach(function (root) { mount(root, root.dataset.explorer, data[root.dataset.explorer]); });
    }).catch(function () {
      roots.forEach(function (root) { root.textContent = "Interactive plot unavailable."; });
    });
  });
})();

/* taxonomy video previews: load and play only while on screen */
(function () {
  var vids = document.querySelectorAll('video.tvid');
  if (!vids.length) return;
  function start(v) {
    if (!v.getAttribute('src')) v.src = v.getAttribute('data-src');
    var p = v.play(); if (p && p.catch) p.catch(function () {});
  }
  if (!('IntersectionObserver' in window)) { vids.forEach(start); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) start(e.target); else e.target.pause(); });
  }, { threshold: 0.25 });
  vids.forEach(function (v) { io.observe(v); });
})();
