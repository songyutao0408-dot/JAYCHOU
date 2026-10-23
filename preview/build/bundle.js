// 自动生成：node tools/build.mjs —— 请勿手改，源码在 src/。
(() => {
  // src/main/layout.js
  var W = 1920;
  var H = 1080;
  var K = H / 1e3;
  var OX = (W - 1e3 * K) / 2;
  var X_MIN = -OX / K;
  var X_MAX = 1e3 + OX / K;
  var ROAD_Y = 800;
  var CHAR_X = 322;
  function applyUnits(ctx) {
    ctx.translate(OX, 0);
    ctx.scale(K, K);
  }

  // src/beat/config.js
  var BPM = 127;
  var FIRST_DOWNBEAT = 0;
  var BEATS_PER_BAR = 4;
  var STATION_BARS = 4;
  var SECTIONS = [
    { id: "intro", bars: 3 },
    ...Array.from({ length: 16 }, (_, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, bars: STATION_BARS, station: i + 1 })),
    { id: "outro", bars: 6 }
  ];

  // src/beat/time.js
  var grid = { bpm: BPM, firstDownbeat: FIRST_DOWNBEAT };
  function setGrid({ bpm, firstDownbeat } = {}) {
    if (Number.isFinite(bpm) && bpm > 0) grid.bpm = bpm;
    if (Number.isFinite(firstDownbeat) && firstDownbeat >= 0) grid.firstDownbeat = firstDownbeat;
  }
  var beatSec = () => 60 / grid.bpm;
  var B = (bar, beat = 1) => (bar - 1) * BEATS_PER_BAR + (beat - 1);
  var SB = (n) => n - 1;
  var STATION = (() => {
    const N = STATION_BARS * BEATS_PER_BAR;
    return { beats: N, enter: [0, 4], walk: [4, N - 8], gag: [N - 8, N - 4], leave: [N - 4, N] };
  })();
  var GAG = STATION.gag[0];
  var acc = 0;
  var sections = SECTIONS.map((s) => {
    const start = acc;
    acc += s.bars * BEATS_PER_BAR;
    return { ...s, start, beats: s.bars * BEATS_PER_BAR, end: acc };
  });
  var TOTAL_BEATS = acc;
  var sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));
  var stationSection = (n) => sections.find((s) => s.station === n);
  var duration = () => grid.firstDownbeat + TOTAL_BEATS * beatSec();
  function beatAt(t) {
    const b = (t - grid.firstDownbeat) / beatSec();
    return Math.min(Math.max(b, 0), TOTAL_BEATS);
  }
  var timeAtBeat = (gb) => grid.firstDownbeat + gb * beatSec();
  function sectionAt(gb) {
    for (const s of sections) if (gb < s.end) return s;
    return sections[sections.length - 1];
  }
  function barBeatLabel(gb) {
    const bar = Math.floor(gb / BEATS_PER_BAR) + 1;
    const beat = Math.floor(gb % BEATS_PER_BAR) + 1;
    return `${bar}:${beat}`;
  }
  function quantizeBeats(b, hz) {
    const s = b * beatSec();
    return Math.floor(s * hz + 1e-6) / hz / beatSec();
  }

  // src/kit/canvas.js
  var cache = /* @__PURE__ */ new Map();
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function baked(key, w, h, draw) {
    let c = cache.get(key);
    if (!c) {
      c = makeCanvas(w, h);
      draw(c.getContext("2d"), c);
      cache.set(key, c);
    }
    return c;
  }
  function memo(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }

  // src/kit/rng.js
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function() {
      a = a + 1831565813 >>> 0;
      let t = a;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function rng(...keys) {
    const r = mulberry32(hashStr(keys.join("|")));
    const f = () => r();
    f.range = (a, b) => a + (b - a) * r();
    f.int = (a, b) => Math.floor(a + (b - a + 1) * r());
    f.pick = (arr) => arr[Math.floor(r() * arr.length)];
    f.sign = () => r() < 0.5 ? -1 : 1;
    f.gauss = () => {
      const u = 1 - r(), v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    return f;
  }
  function hash2(x, y, seed = 0) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647) | 0;
    h = Math.imul(h ^ h >>> 13, 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }

  // src/kit/noise.js
  var fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function noise2(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = fade(xf), v = fade(yf);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
    const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, seed = 0, oct = 4) {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise2(x * f, y * f, seed + i * 17);
      n += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / n;
  }

  // src/kit/color.js
  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  var rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  function mix(a, b, t) {
    const A = hexToRgb(a), Bc = hexToRgb(b);
    return rgbToHex(A.map((x, i) => x + (Bc[i] - x) * t));
  }
  function rgba(hex, a = 1) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }
  var luminance = (hex) => {
    const [r, g, b] = hexToRgb(hex);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  var readableOn = (bg, dark, light = "#f4efe4") => luminance(bg) < 0.42 ? light : dark;

  // src/kit/paper.js
  function paperTexture(w, h, { base = "#efe6d2", seed = 1, amount = 1, fibers = 260 } = {}) {
    return baked(`paper|${w}|${h}|${base}|${seed}|${amount}|${fibers}`, w, h, (ctx) => {
      const [r0, g0, b0] = hexToRgb(base);
      const sw = Math.ceil(w / 8), sh = Math.ceil(h / 8);
      const small = document.createElement("canvas");
      small.width = sw;
      small.height = sh;
      const sctx = small.getContext("2d");
      const img = sctx.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const n = fbm(x / 22, y / 22, seed, 4) - 0.5;
        const k = 1 + n * 0.09 * amount;
        const i = (y * sw + x) * 4;
        img.data[i] = r0 * k;
        img.data[i + 1] = g0 * k;
        img.data[i + 2] = b0 * k * 0.995;
        img.data[i + 3] = 255;
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(small, 0, 0, w, h);
      const T = 256;
      const tile2 = document.createElement("canvas");
      tile2.width = T;
      tile2.height = T;
      const tctx = tile2.getContext("2d");
      const ti = tctx.createImageData(T, T);
      const R = rng("grain", seed);
      for (let i = 0; i < T * T; i++) {
        const v = R() < 0.5 ? 0 : 255;
        ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = v;
        ti.data[i * 4 + 3] = R() * 16 * amount;
      }
      tctx.putImageData(ti, 0, 0);
      ctx.fillStyle = ctx.createPattern(tile2, "repeat");
      ctx.fillRect(0, 0, w, h);
      const F = rng("fiber", seed);
      ctx.lineCap = "round";
      for (let i = 0; i < fibers * amount; i++) {
        const x = F() * w, y = F() * h, a = F() * Math.PI * 2, L = 6 + F() * 26;
        ctx.strokeStyle = F() < 0.5 ? "rgba(90,70,40,0.07)" : "rgba(255,255,255,0.10)";
        ctx.lineWidth = 0.6 + F() * 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + F() * 4, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
        ctx.stroke();
      }
    });
  }

  // src/kit/brush.js
  var glCanvas = null;
  var cache2 = /* @__PURE__ */ new Map();
  var brushAvailable = () => typeof window !== "undefined" && !!window.brush;
  function bakeBrush(key, w, h, draw) {
    if (cache2.has(key)) return cache2.get(key);
    const out = makeCanvas(w, h);
    const B2 = brushAvailable() ? window.brush : null;
    if (B2) {
      if (!glCanvas) glCanvas = document.createElement("canvas");
      glCanvas.width = Math.round(w);
      glCanvas.height = Math.round(h);
      B2.load(glCanvas);
      B2.clear();
      const gl = glCanvas.getContext("webgl2");
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      const seed = hashStr(key);
      B2.seed(seed);
      B2.noiseSeed(seed);
      B2.push();
      B2.translate(-w / 2, -h / 2);
      draw(B2);
      B2.pop();
      B2.render();
      out.getContext("2d").drawImage(glCanvas, 0, 0);
    }
    cache2.set(key, out);
    return out;
  }

  // src/kit/text.js
  var SERIF = "SerifSC";
  var SANS = "SansSC";
  var MIN_TEXT_PX = 36;
  function font(ctx, px, { family = SERIF, weight = 400, italic = false } = {}) {
    ctx.font = `${italic ? "italic " : ""}${weight} ${px}px "${family}", serif`;
  }
  async function loadEmbeddedFonts() {
    const list = typeof window !== "undefined" && window.__FONTS || [];
    for (const f of list) {
      const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
      const face = new FontFace(f.family, bin.buffer, { weight: String(f.weight) });
      await face.load();
      document.fonts.add(face);
    }
    return list.length;
  }

  // src/kit/shapes.js
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  }
  function ellipse(ctx, x, y, rx, ry, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2);
  }
  function poly(ctx, pts, close = true) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (close) ctx.closePath();
  }
  function smoothPath(ctx, pts, close = false) {
    ctx.beginPath();
    if (pts.length < 2) return;
    const n = pts.length;
    const P2 = (i) => close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    ctx.moveTo(pts[0][0], pts[0][1]);
    const segs = close ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P2(i - 1), p1 = P2(i), p2 = P2(i + 1), p3 = P2(i + 2);
      ctx.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6,
        p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6,
        p2[1] - (p3[1] - p1[1]) / 6,
        p2[0],
        p2[1]
      );
    }
    if (close) ctx.closePath();
  }

  // src/kit/math.js
  var clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  var lerp = (a, b, t) => a + (b - a) * t;
  var invLerp = (a, b, x) => b === a ? 0 : (x - a) / (b - a);
  var smoothstep = (a, b, x) => {
    const t = clamp(invLerp(a, b, x));
    return t * t * (3 - 2 * t);
  };
  var ease = {
    inOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    out: (t) => 1 - Math.pow(1 - t, 3),
    in: (t) => t * t * t,
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1
  };
  function keyframes(keys, x, easeFn = (t) => t) {
    if (x <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (x <= keys[i][0]) {
        const [x0, y0] = keys[i - 1], [x1, y1] = keys[i];
        return lerp(y0, y1, (keys[i][2] || easeFn)(invLerp(x0, x1, x)));
      }
    }
    return keys[keys.length - 1][1];
  }
  var pulse = (a, b, x) => {
    const t = clamp(invLerp(a, b, x));
    return Math.sin(Math.PI * t);
  };
  var TAU = Math.PI * 2;

  // src/rig/styles.js
  var STATION_STYLE = {
    1: "halftone",
    2: "relief",
    3: "ink",
    4: "stained",
    5: "sketch",
    6: "pen",
    7: "etching",
    8: "film",
    9: "litho",
    10: "watercolor-cool",
    11: "puppet",
    12: "nianhua",
    13: "crayon",
    14: "watercolor-warm",
    15: "postcard",
    16: "cinematic"
  };
  var STYLE_LABEL = {
    none: "\u539F\u6837",
    comic: "\u6F2B\u753B\u5316\u5E95\u5C42",
    pencil: "\u94C5\u7B14\u7EB8\u9762",
    halftone: "\u6F2B\u753B\u7F51\u70B9",
    relief: "\u6D6E\u96D5",
    ink: "\u6C34\u58A8",
    stained: "\u5F69\u8272\u73BB\u7483",
    woodcut: "\u6728\u523B",
    sketch: "\u94C5\u7B14\u7D20\u63CF",
    "sketch-color": "\u7D20\u63CF\u4E0A\u8272",
    pen: "\u94A2\u7B14\u6392\u7EBF",
    etching: "\u94DC\u7248\u6392\u7EBF",
    film: "\u8001\u80F6\u7247",
    litho: "\u77F3\u7248",
    "watercolor-cool": "\u6C34\u5F69\uFF08\u51B7\uFF09",
    puppet: "\u76AE\u5F71",
    nianhua: "\u5E74\u753B",
    crayon: "\u8721\u7B14",
    "watercolor-warm": "\u6C34\u5F69\uFF08\u6696\uFF09",
    postcard: "\u660E\u4FE1\u7247",
    cinematic: "\u7535\u5F71\u611F\u539A\u6D82"
  };
  function fromImage(src) {
    const w = src.width, h = src.height;
    const c = makeCanvas(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    const n = w * h;
    const I = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      I.r[i] = d[i * 4] / 255;
      I.g[i] = d[i * 4 + 1] / 255;
      I.b[i] = d[i * 4 + 2] / 255;
      I.a[i] = d[i * 4 + 3] / 255;
    }
    return I;
  }
  function toCanvas(I) {
    const c = makeCanvas(I.w, I.h);
    const ctx = c.getContext("2d");
    const im = ctx.createImageData(I.w, I.h);
    const d = im.data;
    for (let i = 0; i < I.w * I.h; i++) {
      d[i * 4] = I.r[i] * 255;
      d[i * 4 + 1] = I.g[i] * 255;
      d[i * 4 + 2] = I.b[i] * 255;
      d[i * 4 + 3] = I.a[i] * 255;
    }
    ctx.putImageData(im, 0, 0);
    return c;
  }
  var clone = (I) => ({ w: I.w, h: I.h, r: I.r.slice(), g: I.g.slice(), b: I.b.slice(), a: I.a.slice() });
  var luma = (I, i) => 0.299 * I.r[i] + 0.587 * I.g[i] + 0.114 * I.b[i];
  var rgbf = (hex) => hexToRgb(hex).map((v) => v / 255);
  var mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  var sstep = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  function blur(ch, w, h, r, passes = 2) {
    if (r < 1) return ch.slice();
    let src = ch.slice(), tmp = new Float32Array(ch.length);
    const R = Math.round(r), win = 2 * R + 1;
    for (let p = 0; p < passes; p++) {
      for (let y = 0; y < h; y++) {
        let acc2 = 0;
        const o = y * w;
        for (let x = -R; x <= R; x++) acc2 += src[o + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) {
          tmp[o + x] = acc2 / win;
          acc2 += src[o + Math.min(w - 1, x + R + 1)] - src[o + Math.max(0, x - R)];
        }
      }
      for (let x = 0; x < w; x++) {
        let acc2 = 0;
        for (let y = -R; y <= R; y++) acc2 += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) {
          src[y * w + x] = acc2 / win;
          acc2 += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x];
        }
      }
    }
    return src;
  }
  function smoothColor(I, r) {
    const n = I.w * I.h;
    const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pr[i] = I.r[i] * I.a[i];
      pg[i] = I.g[i] * I.a[i];
      pb[i] = I.b[i] * I.a[i];
    }
    const br = blur(pr, I.w, I.h, r), bg = blur(pg, I.w, I.h, r), bb = blur(pb, I.w, I.h, r), ba = blur(I.a, I.w, I.h, r);
    const O = clone(I);
    for (let i = 0; i < n; i++) if (ba[i] > 0.01) {
      O.r[i] = br[i] / ba[i];
      O.g[i] = bg[i] / ba[i];
      O.b[i] = bb[i] / ba[i];
    }
    return O;
  }
  function sobel(L, w, h) {
    const M2 = new Float32Array(w * h);
    const at = (x, y) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      M2[y * w + x] = Math.hypot(gx, gy);
    }
    return M2;
  }
  function lumaArray(I, gamma = 1) {
    const L = new Float32Array(I.w * I.h);
    for (let i = 0; i < L.length; i++) L[i] = Math.pow(Math.max(0, luma(I, i)), gamma);
    return L;
  }
  function comicBase(src, { levels = 4, keep = 0.18, lw = 2.2, inner = 0.55, ink = "#141110", smooth = 2 } = {}) {
    const S = smoothColor(src, smooth);
    const O = clone(S);
    const n = S.w * S.h;
    const G = 0.55;
    for (let i = 0; i < n; i++) {
      if (S.a[i] < 0.01) continue;
      const l = Math.max(1e-4, luma(S, i));
      const lp = Math.pow(l, G);
      const q = Math.min(1, Math.max(0.04, Math.round(lp * levels) / levels));
      const lq = Math.pow(q, 1 / G);
      const k = Math.min(3, lq / l);
      O.r[i] = Math.min(1, S.r[i] * k) * (1 - keep) + src.r[i] * keep;
      O.g[i] = Math.min(1, S.g[i] * k) * (1 - keep) + src.g[i] * keep;
      O.b[i] = Math.min(1, S.b[i] * k) * (1 - keep) + src.b[i] * keep;
    }
    const L = lumaArray(S, G);
    const E = sobel(L, S.w, S.h);
    const F = sobel(lumaArray(smoothColor(src, 0.6), G), S.w, S.h);
    const ic = rgbf(ink);
    for (let i = 0; i < n; i++) {
      if (S.a[i] < 0.5) continue;
      const skin = src.r[i] > 0.38 && src.r[i] > src.g[i] && src.g[i] > src.b[i] && src.r[i] - src.b[i] > 0.1;
      const e = skin ? sstep(inner * 0.55, inner * 0.55 + 0.3, F[i]) * 0.85 : sstep(inner, inner + 0.35, E[i]);
      if (e > 0) {
        O.r[i] += (ic[0] - O.r[i]) * e;
        O.g[i] += (ic[1] - O.g[i]) * e;
        O.b[i] += (ic[2] - O.b[i]) * e;
      }
    }
    if (lw > 0) outline(O, src.a, lw, ic);
    return O;
  }
  function outline(O, alpha, lw, ic) {
    const D = blur(alpha, O.w, O.h, lw, 1);
    for (let i = 0; i < D.length; i++) {
      const ring = sstep(0.06, 0.3, D[i]) * (1 - alpha[i]);
      if (ring <= 0) continue;
      const a0 = O.a[i];
      const na = a0 + ring * (1 - a0);
      O.r[i] = (O.r[i] * a0 + ic[0] * ring * (1 - a0)) / na;
      O.g[i] = (O.g[i] * a0 + ic[1] * ring * (1 - a0)) / na;
      O.b[i] = (O.b[i] * a0 + ic[2] * ring * (1 - a0)) / na;
      O.a[i] = na;
    }
    for (let i = 0; i < D.length; i++) {
      if (alpha[i] > 0.02 && alpha[i] < 0.9) {
        const t = 1 - alpha[i];
        O.r[i] += (ic[0] - O.r[i]) * t;
        O.g[i] += (ic[1] - O.g[i]) * t;
        O.b[i] += (ic[2] - O.b[i]) * t;
        O.a[i] = Math.max(O.a[i], 0.95);
      }
    }
  }
  function mapTone(I, stops) {
    const C = stops.map(rgbf), n = C.length - 1;
    for (let i = 0; i < I.w * I.h; i++) {
      if (I.a[i] < 0.01) continue;
      const l = Math.min(0.9999, Math.max(0, luma(I, i))) * n;
      const k = Math.floor(l), t = l - k;
      const c = mixc(C[k], C[k + 1], t);
      I.r[i] = c[0];
      I.g[i] = c[1];
      I.b[i] = c[2];
    }
    return I;
  }
  function hatchStyle(src, { paper: paper2, ink, angle1 = 0.8, angle2 = -0.8, gap = 5, solid = 0.1, l1 = 0.62, l2 = 0.38, edge = 0.45, lw = 2, jitter = 0.6, halo = null, haloW = 4 }) {
    const S = smoothColor(src, 1.5);
    const O = clone(S);
    const L = lumaArray(S, 0.6);
    const E = sobel(L, S.w, S.h);
    const P2 = rgbf(paper2), K2 = rgbf(ink);
    const c1 = Math.cos(angle1), s1 = Math.sin(angle1), c2 = Math.cos(angle2), s2 = Math.sin(angle2);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const i = y * S.w + x;
      if (S.a[i] < 0.02) continue;
      const l = L[i];
      const wob = noise2(x * 0.08, y * 0.08, 5) * jitter * gap;
      const h1 = Math.abs(((x * c1 + y * s1 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l1 * 0.32);
      const h2 = Math.abs(((x * c2 + y * s2 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l2 * 0.36);
      let on = l < solid || l < l1 && h1 || l < l2 && h2 || E[i] > edge;
      const c = on ? K2 : P2;
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
      O.a[i] = S.a[i] > 0.5 ? 1 : S.a[i];
    }
    outline(O, src.a, lw, K2);
    if (halo) outline(O, O.a.slice(), haloW, rgbf(halo));
    return O;
  }
  function sketchStyle(I, color) {
    const S = smoothColor(I, 1.2);
    const O = clone(S);
    const n = S.w * S.h;
    const L = lumaArray(S, 0.6);
    const E = sobel(L, S.w, S.h);
    const F = sobel(lumaArray(smoothColor(I, 0.6), 0.6), S.w, S.h);
    const paper2 = rgbf("#f6efe0"), lead = rgbf("#4f4a44"), indigo = rgbf("#8592ad");
    const W2 = color ? smoothColor(I, 3) : null;
    const A = blur(I.a, S.w, S.h, 3);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const i = y * S.w + x;
      if (I.a[i] < 0.02) continue;
      let base = paper2;
      if (color) {
        let c = [W2.r[i], W2.g[i], W2.b[i]];
        const l2 = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
        c = mixc(c, paper2, 0.4);
        if (l2 < 0.3) c = mixc(indigo, c, l2 / 0.3);
        const pool = Math.max(0, 0.75 - A[i]) * 0.5;
        base = mixc(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.85], pool);
        const g = (noise2(x * 0.3, y * 0.3, 41) - 0.5) * 0.08;
        base = [base[0] + g, base[1] + g, base[2] + g];
      }
      const l = L[i];
      const skin = I.r[i] > 0.38 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
      let ink = Math.max(sstep(0.5, 0.95, E[i]), skin ? sstep(0.3, 0.6, F[i]) * 0.9 : 0);
      const g1 = ((x + y) % 5 + 5) % 5 < 1.1, g2 = ((x - y) % 6 + 6) % 6 < 1;
      if (l < 0.42 && g1) ink = Math.max(ink, 0.55 * (1 - l / 0.42) + 0.25);
      if (l < 0.2 && g2) ink = Math.max(ink, 0.5);
      ink *= 0.75 + 0.35 * noise2(x * 0.5, y * 0.5, 17);
      ink = Math.min(1, ink) * (color ? 0.85 : 1);
      O.r[i] = base[0] + (lead[0] - base[0]) * ink;
      O.g[i] = base[1] + (lead[1] - base[1]) * ink;
      O.b[i] = base[2] + (lead[2] - base[2]) * ink;
      O.a[i] = I.a[i] > 0.5 ? color ? 1 : 0.94 : I.a[i];
    }
    outline(O, I.a, color ? 1.6 : 2.6, rgbf("#35312c"));
    return O;
  }
  var STYLES = {
    none: (I) => I,
    comic: (I) => comicBase(I),
    sketch: (I) => sketchStyle(I, false),
    "sketch-color": (I) => sketchStyle(I, true),
    pencil: (I) => {
      const O = comicBase(I, { levels: 5, keep: 0.3, lw: 1.4, ink: "#3a3129" });
      const P2 = rgbf("#efe6d2");
      for (let i = 0; i < O.w * O.h; i++) {
        O.r[i] += (P2[0] - O.r[i]) * 0.42;
        O.g[i] += (P2[1] - O.g[i]) * 0.42;
        O.b[i] += (P2[2] - O.b[i]) * 0.42;
      }
      return O;
    },
    halftone: (I) => {
      const O = comicBase(I, { levels: 4, keep: 0.1, lw: 2.6, inner: 0.5 });
      const cell = 5;
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const l = luma(O, i);
        let v;
        if (l < 0.13) v = 0.07;
        else if (l > 0.93) v = 0.98;
        else {
          const u = (x + y) / cell, w2 = (x - y) / cell;
          const du = u - Math.round(u), dw = w2 - Math.round(w2);
          const d = Math.hypot(du, dw);
          v = d < Math.sqrt(Math.max(0, 1 - l)) * 0.58 ? 0.08 : 0.97;
        }
        O.r[i] = O.g[i] = O.b[i] = v;
      }
      return O;
    },
    relief: (I) => {
      const O = mapTone(comicBase(I, { levels: 3, keep: 0.1, lw: 1.6, ink: "#5a3f22" }), ["#6b4a2b", "#b08550", "#e3c999"]);
      const A = blur(I.a, O.w, O.h, 3);
      for (let y = 1; y < O.h - 1; y++) for (let x = 1; x < O.w - 1; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const e = (A[i - O.w - 1] - A[i + O.w + 1]) * 1.8;
        O.r[i] = Math.min(1, Math.max(0, O.r[i] + e));
        O.g[i] = Math.min(1, Math.max(0, O.g[i] + e));
        O.b[i] = Math.min(1, Math.max(0, O.b[i] + e * 0.8));
      }
      return O;
    },
    ink: (I) => {
      const O = comicBase(I, { levels: 3, keep: 0.05, lw: 2.4, inner: 0.6, ink: "#151514", smooth: 3 });
      mapTone(O, ["#1a1a19", "#5d5c58", "#a9a69c", "#e9e5da"]);
      const R = blur(O.r, O.w, O.h, 2), A = blur(O.a, O.w, O.h, 2);
      for (let i = 0; i < O.w * O.h; i++) {
        const v = O.r[i] * 0.55 + R[i] * 0.45;
        O.r[i] = O.g[i] = v;
        O.b[i] = v * 0.98;
        O.a[i] = Math.max(O.a[i] * 0.92, A[i] * 0.8);
      }
      return O;
    },
    stained: (I) => {
      const O = comicBase(I, { levels: 4, keep: 0.1, lw: 3, ink: "#0b0b10" });
      const cell = 16, w = O.w, h = O.h;
      const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3;
      const seeds = [];
      for (let gy = -1; gy < gh - 1; gy++) for (let gx = -1; gx < gw - 1; gx++) {
        seeds.push([(gx + 0.15 + hash2(gx, gy, 3) * 0.7) * cell, (gy + 0.15 + hash2(gx, gy, 4) * 0.7) * cell]);
      }
      const near = new Int32Array(w * h), second = new Float32Array(w * h), first = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        let d1 = 1e9, d2 = 1e9, k1 = 0;
        const cx = Math.floor(x / cell) + 1, cy = Math.floor(y / cell) + 1;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const k = (cy + oy) * gw + (cx + ox);
          const s = seeds[k];
          if (!s) continue;
          const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
          if (d < d1) {
            d2 = d1;
            d1 = d;
            k1 = k;
          } else if (d < d2) d2 = d;
        }
        near[i] = k1;
        first[i] = Math.sqrt(d1);
        second[i] = Math.sqrt(d2);
      }
      const sum = /* @__PURE__ */ new Map();
      for (let i = 0; i < w * h; i++) {
        if (O.a[i] < 0.5) continue;
        const s = sum.get(near[i]) || [0, 0];
        s[0] += luma(O, i);
        s[1]++;
        sum.set(near[i], s);
      }
      const glass = ["#14204f", "#1f4aa8", "#7b2a6e", "#c1832a", "#e8c25a"].map(rgbf);
      for (let i = 0; i < w * h; i++) {
        if (O.a[i] < 0.02) continue;
        const s = sum.get(near[i]);
        const l = s ? s[0] / s[1] : 0.2;
        const k = Math.min(glass.length - 1, Math.floor(l * glass.length * 1.1));
        const lead = second[i] - first[i] < 1.6;
        const isEdge = O.r[i] < 0.08 && O.g[i] < 0.08 && O.b[i] < 0.1;
        const c = lead || isEdge ? [0.04, 0.04, 0.06] : glass[k];
        const v = 0.85 + 0.15 * noise2(i % w * 0.2, i / w * 0.2, 9);
        O.r[i] = c[0] * v;
        O.g[i] = c[1] * v;
        O.b[i] = c[2] * v;
      }
      return O;
    },
    woodcut: (I) => hatchStyle(comicBase(I, { levels: 3, keep: 0, lw: 0 }), { paper: "#8d887e", ink: "#0e0d0c", angle1: 0.15, angle2: 0.15, gap: 6, solid: 0.2, l1: 0.7, l2: 0.01, edge: 0.6, lw: 2.6, jitter: 1.2, halo: "#b3ada1", haloW: 5 }),
    // 第 6 站：白纸上的蓝黑墨水钢笔画
    pen: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: "#fbfaf6", ink: "#1f2a44", gap: 4, solid: 0.06, l1: 0.6, l2: 0.32, edge: 0.4, lw: 1.6 }),
    // 第 7 站：米黄纸、棕褐油墨的铜版画
    etching: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: "#efe3c4", ink: "#5a3a22", angle1: 0.5, angle2: -1.1, gap: 3.4, solid: 0.05, l1: 0.66, l2: 0.36, edge: 0.4, lw: 1.4, jitter: 0.3 }),
    film: (I) => {
      const O = comicBase(I, { levels: 5, keep: 0.3, lw: 1.8 });
      for (let i = 0; i < O.w * O.h; i++) {
        const l = Math.pow(luma(O, i), 0.9);
        const v = sstep(0.02, 0.95, l);
        O.r[i] = v * 0.98 + 0.02;
        O.g[i] = v * 0.94 + 0.02;
        O.b[i] = v * 0.84 + 0.02;
      }
      return O;
    },
    litho: (I) => {
      const O = comicBase(I, { levels: 3, keep: 0, lw: 2.6, ink: "#2b2a3a" });
      const C = ["#2b2a3a", "#d0533c", "#efe0bf"].map(rgbf);
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const l = luma(O, i) + (hash2(x, y, 7) - 0.5) * 0.18;
        const c = l < 0.24 ? C[0] : l < 0.42 ? C[1] : C[2];
        O.r[i] = c[0];
        O.g[i] = c[1];
        O.b[i] = c[2];
      }
      return O;
    },
    "watercolor-cool": (I) => watercolor(I, ["#27364a", "#4f6f93", "#9db7cf", "#eef2f4"], 0.75),
    "watercolor-warm": (I) => watercolor(I, ["#5a4a5e", "#b07f78", "#e6b8a2", "#fbf1e4"], 0.7),
    puppet: (I) => {
      const O = comicBase(I, { levels: 3, keep: 0, lw: 3, ink: "#2a120a" });
      const dark = rgbf("#3a1d10"), mid = rgbf("#9c3d1e"), lite = rgbf("#e08a3c");
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const l = luma(O, i);
        let c = l < 0.18 ? dark : l < 0.5 ? mixc(dark, mid, (l - 0.18) / 0.32) : mixc(mid, lite, Math.min(1, (l - 0.5) / 0.4));
        const cell = 9, cx = x % cell - cell / 2, cy = y % cell - cell / 2;
        const hole = l > 0.3 && cx * cx + cy * cy < (l - 0.2) * 24;
        O.r[i] = c[0];
        O.g[i] = c[1];
        O.b[i] = c[2];
        O.a[i] = hole ? 0 : Math.min(O.a[i], 0.93);
      }
      return O;
    },
    nianhua: (I) => {
      const O = comicBase(I, { levels: 3, keep: 0, lw: 3.2, inner: 0.45 });
      const C = ["#1d1612", "#2a3f7a", "#e0a77a", "#f4d9b8"].map(rgbf);
      for (let i = 0; i < O.w * O.h; i++) {
        if (O.a[i] < 0.01) continue;
        const l = luma(O, i);
        const c = l < 0.1 ? C[0] : l < 0.26 ? C[1] : l < 0.5 ? C[2] : C[3];
        O.r[i] = c[0];
        O.g[i] = c[1];
        O.b[i] = c[2];
      }
      return O;
    },
    crayon: (I) => {
      const O = comicBase(I, { levels: 3, keep: 0, lw: 3.4, ink: "#2b2b6e", smooth: 3 });
      const C = ["#3a3a8c", "#8cc06a", "#f2a33a", "#fbe3b8"].map(rgbf);
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const l = luma(O, i);
        const c = l < 0.12 ? [0.17, 0.17, 0.43] : l < 0.3 ? C[0] : l < 0.45 ? C[2] : C[3];
        const streak2 = noise2((x + y) * 0.9, (x - y) * 0.05, 11);
        const gap = streak2 > 0.72 ? 0.6 : 0;
        O.r[i] = c[0] + (1 - c[0]) * gap;
        O.g[i] = c[1] + (1 - c[1]) * gap;
        O.b[i] = c[2] + (1 - c[2]) * gap;
      }
      return O;
    },
    postcard: (I) => {
      const O = comicBase(I, { levels: 4, keep: 0.15, lw: 1.8, ink: "#3a2c24" });
      mapTone(O, ["#3a2c24", "#2f6f7e", "#d6843a", "#f0e2c4"]);
      const shifted = O.r.slice();
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        const j = y * O.w + Math.max(0, x - 2);
        const u = (x + y) / 3.2, w2 = (x - y) / 3.2;
        const d = Math.hypot(u - Math.round(u), w2 - Math.round(w2));
        const dot = d < 0.38 ? 0.94 : 1;
        O.r[i] = shifted[j] * dot;
        O.g[i] *= dot;
        O.b[i] *= dot;
      }
      return O;
    },
    cinematic: (I) => {
      const O = comicBase(I, { levels: 7, keep: 0.5, lw: 1.2, inner: 0.9, smooth: 1.5 });
      const warm = rgbf("#eef3f6");
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w - 4; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        O.r[i] = O.r[i] * 0.92 + 0.03;
        O.g[i] = O.g[i] * 0.95 + 0.03;
        O.b[i] = Math.min(1, O.b[i] * 1.02 + 0.05);
        if (I.a[i] > 0.5) {
          const d = I.a[i + 1] < 0.5 ? 1 : I.a[i + 2] < 0.5 ? 0.75 : I.a[i + 3] < 0.5 ? 0.4 : 0;
          if (d > 0) {
            const k = d * 0.75;
            O.r[i] += (warm[0] - O.r[i]) * k;
            O.g[i] += (warm[1] - O.g[i]) * k;
            O.b[i] += (warm[2] - O.b[i]) * k;
          }
        }
      }
      return O;
    }
  };
  function watercolor(I, stops, light) {
    const S = smoothColor(I, 3);
    const O = comicBase(S, { levels: 4, keep: 0.25, lw: 0, inner: 0.9, smooth: 2 });
    mapTone(O, stops);
    const A = blur(I.a, O.w, O.h, 2);
    const Ab = blur(I.a, O.w, O.h, 5);
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (A[i] < 0.01) continue;
      const edge = Math.max(0, A[i] - Ab[i]) * 1.6;
      const gran = (noise2(x * 0.35, y * 0.35, 21) - 0.5) * 0.12;
      const k = 1 - edge * 0.35 + gran;
      O.r[i] = Math.min(1, O.r[i] * k + (1 - light) * 0.04);
      O.g[i] = Math.min(1, O.g[i] * k);
      O.b[i] = Math.min(1, O.b[i] * k);
      O.a[i] = Math.min(1, A[i] * 1.05) * (0.88 + 0.12 * noise2(x * 0.05, y * 0.05, 22));
    }
    return O;
  }
  function registerStyle(name, fn) {
    STYLES[name] = fn;
  }
  function styledFrame(key, src, style) {
    if (!style || style === "none") return src;
    return memo(`fig|${key}|${style}`, () => {
      const fn = STYLES[style] || STYLES.comic;
      return toCanvas(fn(fromImage(src)));
    });
  }
  var STYLE_NAMES = Object.keys(STYLES);

  // src/rig/walker.js
  var FIGURE_H = 500;
  var ANCHORS = {
    stand: { shoulder: [30, -423], handR: [58, -226], handL: [-23, -235], headTop: [0, -507], ear: [25, -465] },
    walk: { shoulder: [-19, -421], hand: [32, -250], headTop: [-5, -494], ear: [-1, -454] }
  };
  var DEFAULT_SET = "side";
  var sets = {};
  var active = null;
  async function loadWalkSets() {
    const raw2 = typeof window !== "undefined" && window.__WALK || {};
    const load = (src) => new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    for (const [name, s] of Object.entries(raw2)) {
      sets[name] = { name, meta: s.meta, frames: await Promise.all(s.frames.map(load)), stand: await load(s.stand) };
    }
    return Object.keys(sets);
  }
  var walkSetNames = () => Object.keys(sets);
  function useWalkSet(name) {
    active = sets[name] || sets[DEFAULT_SET] || Object.values(sets)[0] || null;
    return active ? walkSpeedOf(active.meta) : 105;
  }
  var activeWalk = () => active;
  function walkSpeedOf(meta) {
    const s = FIGURE_H / meta.personHeight;
    return meta.footSpeedPxPerFrame * (meta.frames / 2) * s;
  }
  function frameIndex(phase) {
    const m = active.meta;
    const k = m.strikes[1], P2 = m.frames;
    const c = (phase % 2 + 2) % 2;
    const f = c < 1 ? c * k : k + (c - 1) * (P2 - k);
    return Math.min(P2 - 1, Math.floor(f + 1e-6));
  }
  function drawWalker(ctx, o = {}) {
    if (!active) return;
    const m = active.meta;
    const s = FIGURE_H / m.personHeight;
    const stand = o.pose === "stand";
    const idx = stand ? -1 : o.frame ?? frameIndex(o.phase || 0);
    const src = stand ? active.stand : active.frames[idx];
    if (!src) return;
    const key = `${active.name}/${stand ? "stand" : idx}`;
    const img = styledFrame(key, src, o.style);
    ctx.save();
    if (o.lean) ctx.rotate(o.lean);
    ctx.imageSmoothingQuality = "high";
    if (o.rim) {
      const halo = rimFrame(key, img, o.rim.color || "#fff6e0", o.rim.width || 5);
      ctx.globalAlpha *= o.rim.alpha ?? 0.9;
      ctx.drawImage(halo, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
      ctx.globalAlpha /= o.rim.alpha ?? 0.9;
    }
    ctx.drawImage(img, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
    ctx.restore();
  }
  function rimFrame(key, img, color, width) {
    return memo(`rim|${key}|${img.width}|${color}|${width}`, () => {
      const w = img.width, h = img.height;
      const c = makeCanvas(w, h);
      const ctx = c.getContext("2d");
      const steps = 16;
      for (let i = 0; i < steps; i++) {
        const a = i / steps * Math.PI * 2;
        for (const r of [width, width * 0.5]) ctx.drawImage(img, Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.globalCompositeOperation = "source-in";
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, w, h);
      return c;
    });
  }

  // src/scenes/intro.js
  var PAPER = "#efe6d2";
  var INK = "#3a3129";
  var LEAD = "#4a4038";
  var DECK = { x: 260, y: 230, w: 600, h: 380 };
  var BAY = { x: 310, y: 270, w: 380, h: 250 };
  var CAS = { w: 330, h: 210 };
  var CAS_REST = { x: BAY.x + (BAY.w - CAS.w) / 2, y: BAY.y + 22 };
  var LABEL = { dx: 22, dy: 16, w: CAS.w - 44, h: 106 };
  var COUNTER = { x: 716, y: 280, w: 120, h: 60 };
  var T_CLICK = B(2, 1);
  var T_SUB1 = B(2, 3);
  var T_SUB2 = B(3, 1);
  var T_OUT = B(3, 1);
  var SUBTITLES = ["2000 \u5E74\uFF0C\u4ED6\u51FA\u53D1\u4E86\u3002", "\u524D\u9762\u662F\u5341\u516D\u5F20\u4E13\u8F91\u3002"];
  var FIG_STYLE = "pencil";
  function deckStrokes() {
    return bakeBrush("intro-deck", DECK.w * K + 20, DECK.h * K + 20, (Bx) => {
      const s = K, o = 10;
      Bx.set("HB", INK, 1.3);
      Bx.rect(o, o, DECK.w * s, DECK.h * s);
      Bx.set("HB", INK, 1);
      Bx.rect(o + (BAY.x - DECK.x) * s, o + (BAY.y - DECK.y) * s, BAY.w * s, BAY.h * s);
      Bx.rect(o + (COUNTER.x - DECK.x) * s, o + (COUNTER.y - DECK.y) * s, COUNTER.w * s, COUNTER.h * s);
      for (let i = 0; i < 6; i++) Bx.rect(o + (60 + i * 66) * s, o + 300 * s, 54 * s, 46 * s);
      Bx.circle(o + 520 * s, o + 170 * s, 30 * s);
      Bx.circle(o + 520 * s, o + 270 * s, 22 * s);
      Bx.set("2B", INK, 0.8);
      Bx.line(o + 20 * s, o + 280 * s, o + (DECK.w - 20) * s, o + 280 * s);
    });
  }
  function cassetteStrokes() {
    return bakeBrush("intro-cassette", CAS.w * K + 20, CAS.h * K + 20, (Bx) => {
      const s = K, o = 10;
      Bx.set("HB", INK, 1.2);
      Bx.rect(o, o, CAS.w * s, CAS.h * s);
      Bx.set("HB", INK, 0.9);
      Bx.rect(o + LABEL.dx * s, o + LABEL.dy * s, LABEL.w * s, LABEL.h * s);
      Bx.rect(o + 110 * s, o + 140 * s, 110 * s, 36 * s);
      Bx.circle(o + 130 * s, o + 158 * s, 14 * s);
      Bx.circle(o + 200 * s, o + 158 * s, 14 * s);
      Bx.line(o + 80 * s, o + CAS.h * s, o + 100 * s, o + 186 * s);
      Bx.line(o + 100 * s, o + 186 * s, o + 230 * s, o + 186 * s);
      Bx.line(o + 230 * s, o + 186 * s, o + 250 * s, o + CAS.h * s);
    });
  }
  function roadStrokes() {
    return bakeBrush("intro-road", 3600 * K, 60, (Bx) => {
      Bx.set("HB", LEAD, 1.4);
      Bx.line(0, 20, 3600 * K, 20);
      Bx.set("HB", LEAD, 0.6);
      for (let i = 0; i < 70; i++) {
        const x = 40 + i * 55 * K;
        Bx.line(x, 34, x - 26, 50);
      }
    });
  }
  function cassetteY(b) {
    const drop = keyframes([[0, -300], [B(1, 2), -250], [T_CLICK - 0.15, CAS_REST.y - 10]], b, ease.inOut);
    if (b < T_CLICK - 0.15) return drop;
    const u = b - T_CLICK;
    if (u < 0) return lerp(CAS_REST.y - 10, CAS_REST.y + 4, (u + 0.15) / 0.15);
    return CAS_REST.y + 4 * Math.exp(-u * 9) * Math.cos(u * 30);
  }
  var intro = {
    id: "intro",
    station: null,
    figureStyle: FIG_STYLE,
    figureAdjust(b, env) {
      if (b < T_OUT) return { hidden: true };
      const e = ease.inOut(clamp((b - T_OUT) / 1.15));
      const lx = CAS_REST.x + LABEL.dx + LABEL.w * 0.5 - env.cam;
      const ly = CAS_REST.y + LABEL.dy + LABEL.h - 6;
      return {
        dx: lerp(lx - CHAR_X, 0, e),
        dy: lerp(ly - ROAD_Y, 0, e) - Math.sin(Math.PI * e) * 70,
        scale: lerp(0.17, 1, e)
      };
    },
    drawBack(ctx, b, env) {
      const cam = env.cam;
      const pw = Math.ceil((X_MAX - X_MIN + 1600) * K), ph = Math.ceil(1e3 * K);
      const paper2 = paperTexture(pw, ph, { base: PAPER, seed: 7 });
      ctx.drawImage(paper2, X_MIN - cam * 1, 0, pw / K, ph / K);
      ctx.save();
      ctx.translate(-cam, 0);
      roundRect(ctx, DECK.x, DECK.y, DECK.w, DECK.h, 6);
      ctx.fillStyle = mix(PAPER, "#b9ab94", 0.35);
      ctx.fill();
      ctx.fillStyle = mix(PAPER, "#4a4038", 0.55);
      ctx.fillRect(BAY.x, BAY.y, BAY.w, BAY.h);
      ctx.fillStyle = "#2b2622";
      ctx.fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h);
      drawCounter(ctx, b);
      ctx.fillStyle = mix(PAPER, "#ffffff", 0.4);
      for (let i = 0; i < 6; i++) ctx.fillRect(DECK.x + 60 + i * 66, DECK.y + 300, 54, 46);
      const pressed = smoothstep(T_CLICK, T_CLICK + 0.2, b);
      ctx.fillStyle = rgba("#c0392b", 0.25 + 0.4 * pressed);
      ctx.fillRect(DECK.x + 60 + 66 * 1, DECK.y + 300 + 6 * pressed, 54, 46 - 6 * pressed);
      const ds = deckStrokes();
      ctx.drawImage(ds, DECK.x - 10 / K, DECK.y - 10 / K, ds.width / K, ds.height / K);
      const cy = cassetteY(b);
      ctx.save();
      ctx.translate(CAS_REST.x, cy);
      roundRect(ctx, 0, 0, CAS.w, CAS.h, 10);
      ctx.fillStyle = mix(PAPER, "#d9cdb6", 0.6);
      ctx.fill();
      ctx.fillStyle = mix(PAPER, "#ffffff", 0.55);
      ctx.fillRect(LABEL.dx, LABEL.dy, LABEL.w, LABEL.h);
      ctx.fillStyle = rgba("#c0392b", 0.55);
      ctx.fillRect(LABEL.dx, LABEL.dy + 12, LABEL.w, 8);
      ctx.strokeStyle = rgba(INK, 0.35);
      ctx.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.moveTo(LABEL.dx + 14, LABEL.dy + 40 + i * 18);
        ctx.lineTo(LABEL.dx + 80, LABEL.dy + 40 + i * 18);
        ctx.stroke();
      }
      const spin = Math.max(0, b - T_CLICK) * (Math.PI / 2);
      for (const [x, r] of [[130, 22], [200, 16]]) {
        circle(ctx, x, 158, r);
        ctx.fillStyle = "#5a4a3c";
        ctx.fill();
        ctx.save();
        ctx.translate(x, 158);
        ctx.rotate(spin);
        ctx.fillStyle = PAPER;
        for (let i = 0; i < 3; i++) {
          ctx.rotate(Math.PI * 2 / 3);
          ctx.fillRect(-2, -11, 4, 6);
        }
        ctx.restore();
      }
      const cs = cassetteStrokes();
      ctx.drawImage(cs, -10 / K, -10 / K, cs.width / K, cs.height / K);
      if (b < T_OUT) {
        ctx.save();
        ctx.translate(LABEL.dx + LABEL.w * 0.5, LABEL.dy + LABEL.h - 6);
        ctx.scale(0.17, 0.17);
        drawWalker(ctx, { pose: "stand", style: FIG_STYLE });
        ctx.restore();
      }
      ctx.restore();
      const ck = 1 - smoothstep(T_CLICK, T_CLICK + 0.6, b);
      if (b >= T_CLICK && ck > 0) {
        ctx.strokeStyle = rgba(INK, ck);
        ctx.lineWidth = 3;
        const L = 18 + 22 * (1 - ck);
        for (const [x, y, dx, dy] of [[0, 0, -1, -1], [CAS.w, 0, 1, -1], [0, CAS.h, -1, 1], [CAS.w, CAS.h, 1, 1]]) {
          const px = CAS_REST.x + x, py = CAS_REST.y + y;
          ctx.beginPath();
          ctx.moveTo(px + dx * 10, py + dy * 10);
          ctx.lineTo(px + dx * (10 + L), py + dy * (10 + L));
          ctx.stroke();
        }
      }
      const rs = roadStrokes();
      ctx.drawImage(rs, 80, ROAD_Y - 20 / K, rs.width / K, rs.height / K);
      ctx.restore();
    },
    drawFront(ctx, b) {
      const out = 1 - smoothstep(B(3, 3), B(3, 4), b);
      const a1 = smoothstep(T_SUB1, T_SUB1 + 0.7, b) * out;
      const a2 = smoothstep(T_SUB2, T_SUB2 + 0.7, b) * out;
      ctx.save();
      ctx.textAlign = "center";
      font(ctx, 54, { family: SERIF, weight: 400 });
      ctx.fillStyle = rgba(INK, a1);
      ctx.fillText(SUBTITLES[0], 500, 892);
      font(ctx, 54, { family: SERIF, weight: 700 });
      ctx.fillStyle = rgba(INK, a2);
      ctx.fillText(SUBTITLES[1], 500, 960);
      ctx.restore();
    }
  };
  function drawCounter(ctx, b) {
    const v = Math.max(0, b - T_CLICK) * 3.2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(COUNTER.x + 6, COUNTER.y + 6, COUNTER.w - 12, COUNTER.h - 12);
    ctx.clip();
    font(ctx, 40, { family: SANS, weight: 700 });
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const cw = (COUNTER.w - 12) / 3;
    for (let d = 0; d < 3; d++) {
      const place = Math.pow(10, 2 - d);
      const val = v / place;
      const digit = Math.floor(val) % 10;
      const frac = d === 2 ? val - Math.floor(val) : Math.max(0, v % place - (place - 1));
      const x = COUNTER.x + 6 + cw * (d + 0.5), y = COUNTER.y + COUNTER.h / 2;
      ctx.fillStyle = "#efe6d2";
      ctx.fillText(String(digit), x, y - frac * 44);
      ctx.fillText(String((digit + 1) % 10), x, y + 44 - frac * 44);
    }
    ctx.restore();
  }

  // src/kit/strip.js
  var CAM_MIN = -520;
  var CAM_MAX = 2700;
  function strip(key, p, draw, { y0 = 0, y1 = 1e3, res = 1 } = {}) {
    const x0 = Math.floor(X_MIN + CAM_MIN * p) - 20, x1 = Math.ceil(X_MAX + CAM_MAX * p) + 20;
    const s = K * res;
    const canvas = baked(`strip|${key}|${p}|${y0}|${y1}|${res}`, (x1 - x0) * s, (y1 - y0) * s, (ctx) => {
      ctx.scale(s, s);
      ctx.translate(-x0, -y0);
      draw(ctx, x0, x1);
    });
    return { canvas, x0, x1, y0, y1, p };
  }
  function drawStrip(ctx, S, cam) {
    ctx.drawImage(S.canvas, S.x0 - cam * S.p, S.y0, S.x1 - S.x0, S.y1 - S.y0);
  }
  var stripRange = (p) => [Math.floor(X_MIN + CAM_MIN * p) - 20, Math.ceil(X_MAX + CAM_MAX * p) + 20];

  // src/data/stations.js
  var raw = [
    [2e3, "Jay", "Jay", "\u53EF\u7231\u5973\u4EBA", "\u9752\u6625\u8857\u89D2", "\u6F2B\u753B\u7F51\u70B9\u5206\u955C", "\u4ED6\u4E00\u56DE\u5934\uFF08\u5B9A\u683C\u6362\u6210\u6B63\u9762\u7AD9\u7ACB\u5E27\uFF09\uFF0C\u80CC\u666F\u77AC\u95F4\u94FA\u6EE1\u5C11\u5973\u6F2B\u753B\u95EA\u5149\u82B1\u6735\uFF0C\u4E0B\u4E00\u62CD\u590D\u539F", ["#f4efe4", "#c9c2b4", "#26232a", "#e8467c"]],
    [2001, "\u8303\u7279\u897F", "Fantasy", "\u7231\u5728\u897F\u5143\u524D", "\u53E4\u5DF4\u6BD4\u4F26\u57CE\u5899", "\u4E24\u6CB3\u6D41\u57DF\u6D6E\u96D5", "\u6D6E\u96D5\u91CC\u4EBA\u4EBA\u4FA7\u8EAB\u884C\u8FDB\uFF0C\u53EA\u6709\u5B9A\u683C\u7684\u4ED6\u6B63\u9762\u7AD9\u7740\uFF1B\u4E0B\u4E00\u62CD\u4ED6\u4E5F\u88AB\u8FEB\u4FA7\u7740\u8EAB\u5B50\u7EE7\u7EED\u8D70", ["#e7d3a8", "#c49a5c", "#4a3320", "#2f6fb0"]],
    [2002, "\u516B\u5EA6\u7A7A\u95F4", "The Eight Dimensions", "\u7237\u7237\u6CE1\u7684\u8336", "\u5C71\u95F4\u8336\u68DA", "\u6C34\u58A8", "\u8001\u4EBA\u659F\u8336\uFF0C\u8336\u6C34\u5012\u6210\u4E00\u9053\u58A8\u7EBF\u4E00\u8DEF\u6D41\u5230\u8DEF\u4E0A\uFF0C\u4ED6\u8E29\u7740\u58A8\u7EBF\u8D70", ["#f2eee3", "#a9a69c", "#1d1d1b", "#7a8c5a"]],
    [2003, "\u53F6\u60E0\u7F8E", "Yeh Hui-Mei", "\u4EE5\u7236\u4E4B\u540D", "\u767D\u5929\u7684\u54E5\u7279\u6559\u5802\uFF1A\u9633\u5149\u900F\u8FC7\u5F69\u8272\u73BB\u7483\uFF0C\u5728\u6D45\u8272\u77F3\u5899\u548C\u5730\u9762\u6295\u4E0B\u5F69\u8272\u5149\u6591", "\u5F69\u8272\u73BB\u7483\uFF08\u767D\u5929\u3001\u94C5\u6761\u7EC6\uFF09", "\u4ED6\u8D70\u8FDB\u7A97\u683C\uFF0C\u88AB\u7EC6\u94C5\u6761\u5207\u6210\u4E00\u5757\u5757\u5F69\u8272\u73BB\u7483\uFF0C\u5F3A\u62CD\u4E0A\u4E00\u675F\u9633\u5149\u6253\u4E0B", ["#efe9dc", "#c9b99a", "#3c3a44", "#d9a73a"]],
    [2004, "\u4E03\u91CC\u9999", "Common Jasmine Orange", "\u6B62\u6218\u4E4B\u6B87", "\u5E9F\u589F\u91CC\u7684\u767D\u9E3D", "\u94C5\u7B14\u901F\u5199 + \u8272\u5F69\u6655\u5F00", "\u94A2\u76D4\u91CC\u98DE\u51FA\u4E00\u53EA\u767D\u9E3D\uFF0C\u9E3D\u5B50\u98DE\u8FC7\u7684\u5730\u65B9\u989C\u8272\u50CF\u6C34\u5F69\u4E00\u6837\u6655\u5F00\uFF0C\u4E24\u62CD\u5185\u6574\u5E45\u753B\u4ECE\u7070\u8272\u901F\u5199\u53D8\u6210\u5F69\u8272", ["#f3ecdc", "#b4ada1", "#5f5a52", "#8fb8d8"]],
    [2005, "\u5341\u4E00\u6708\u7684\u8427\u90A6", "November's Chopin", "\u591C\u66F2", "\u6708\u591C\u91CC\u7684\u4E00\u67B6\u94A2\u7434\uFF08\u5927\u800C\u4EAE\u7684\u6708\u4EAE\uFF09", "\u767D\u7EB8\u84DD\u9ED1\u58A8\u6C34\u94A2\u7B14\u753B\uFF08\u591C\u8272\u53EA\u7528\u5929\u7A7A\u7A00\u758F\u6392\u7EBF\uFF09", "\u7434\u76D6\u4E0A\u7684\u4E4C\u9E26\u6392\u6210\u4E00\u884C\u97F3\u7B26\uFF0C\u5F3A\u62CD\u4E0A\u540C\u65F6\u626D\u5934", ["#fbfaf6", "#c9d0dc", "#1f2a44", "#6c7a96"]],
    [2006, "\u4F9D\u7136\u8303\u7279\u897F", "Still Fantasy", "\u591C\u7684\u7B2C\u4E03\u7AE0", "\u7EF4\u591A\u5229\u4E9A\u6D45\u7070\u8584\u96FE\uFF0C\u4FA6\u63A2\uFF0C\u7164\u6C14\u706F\u6696\u9EC4\u5149\u6655", "\u94DC\u7248\u753B\uFF08\u7C73\u9EC4\u7EB8\u3001\u68D5\u8910\u6CB9\u58A8\uFF09", "\u4E00\u53EA\u653E\u5927\u955C\u4ECE\u753B\u5916\u4F38\u8FDB\u6765\uFF0C\u5BF9\u51C6\u4ED6\u8033\u6735\u4E0A\u7684\u8033\u673A", ["#efe3c4", "#c9b48e", "#5a3a22", "#e8b54a"]],
    [2007, "\u6211\u5F88\u5FD9", "On the Run!", "\u6700\u957F\u7684\u7535\u5F71", "\u8001\u7535\u5F71\u9662\uFF1A\u53D1\u5149\u7684\u94F6\u5E55\u5360\u753B\u9762\u5927\u90E8\u5206\uFF0C\u89C2\u4F17\u526A\u5F71\u53EA\u5728\u5E95\u90E8\u4E00\u7A84\u6761", "\u80F6\u7247\u5212\u75D5 + 4:3 \u753B\u5E45", "\u753B\u5E45\u7A81\u7136\u7F29\u6210 4:3\uFF0C\u4ED6\u8D70\u5728\u94F6\u5E55\u91CC\uFF0C\u524D\u6392\u89C2\u4F17\u526A\u5F71\u4E00\u8D77\u626D\u5934", ["#f2ead2", "#cfc3a4", "#2a2622", "#e8d9b0"]],
    [2008, "\u9B54\u6770\u5EA7", "Capricorn", "\u4E54\u514B\u53D4\u53D4", "\u9A6C\u620F\u56E2\u5C0F\u4E11", "19 \u4E16\u7EAA\u77F3\u7248\u753B\u6D77\u62A5", "\u5C0F\u4E11\u9012\u6765\u4E00\u53EA\u6C14\u7403\uFF0C\u5B9A\u683C\u7684\u4ED6\u88AB\u6574\u4E2A\u5E26\u7740\u98D8\u8D77\u534A\u62CD\uFF0C\u5F3A\u62CD\u843D\u56DE", ["#efe0bf", "#d0533c", "#2b2a3a", "#2f7d6d"]],
    [2010, "\u8DE8\u65F6\u4EE3", "The Era", "\u96E8\u4E0B\u4E00\u6574\u665A", "\u508D\u665A\u84DD\u8C03\u65F6\u523B\u7684\u57CE\u5E02\u8857\u9053\uFF0C\u8DEF\u9762\u6620\u7740\u9713\u8679\u548C\u8F66\u706F\u7684\u5F69\u8272\u5012\u5F71", "\u900F\u660E\u6C34\u5F69\u6655\u67D3", "\u96E8\u6C34\u628A\u989C\u6599\u6655\u5F00\uFF0C\u8FDE\u4ED6\u7684\u4F1E\u90FD\u5316\u6210\u4E00\u6EE9\u989C\u8272\uFF0C\u4E0B\u4E00\u62CD\u6536\u56DE", ["#dfe8f2", "#8fb0d4", "#3c5577", "#f08a6a"]],
    [2011, "\u60CA\u53F9\u53F7", "Wow!", "\u76AE\u5F71\u620F", "\u4E2D\u56FD\u53E4\u4EE3\u76AE\u5F71\u620F", "\u76AE\u5F71", "\u6CB9\u706F\u4E00\u6643\uFF0C\u4ED6\u7684\u76AE\u5F71\uFF08\u540C\u4E00\u5E27\u526A\u5F71\uFF09\u4E00\u5206\u4E3A\u4E09\u5DE6\u53F3\u9519\u5F00\uFF0C\u5F3A\u62CD\u4E0A\u5408\u56DE\u4E00\u4E2A", ["#f0c77a", "#c46a2c", "#3a1d10", "#b8322a"]],
    [2012, "\u5341\u4E8C\u65B0\u4F5C", "Opus 12", "\u7EA2\u5C18\u5BA2\u6808", "\u6B66\u4FA0\u5BA2\u6808", "\u6728\u7248\u5E74\u753B", "\u5E97\u5C0F\u4E8C\u628A\u4ED6\u5F53\u6210\u5927\u4FA0\uFF0C\u62B1\u62F3\u4F5C\u63D6", ["#f1e3c4", "#d4a02f", "#2d1f18", "#c23b2b"]],
    [2014, "\u54CE\u5466\uFF0C\u4E0D\u9519\u54E6", "Aiyo, Not Bad", "\u978B\u5B50\u7279\u5927\u53F7", "\u8721\u7B14\u753B\u7684\u5C0F\u9547", "\u513F\u7AE5\u8721\u7B14\u753B", "\u6BD4\u4F8B\u5168\u9519\uFF0C\u4ED6\u811A\u4E0B\u90A3\u4E00\u622A\u88AB\u5355\u72EC\u653E\u5927\u6210\u7279\u5927\u53F7\u978B\u5B50\uFF0C\u4E00\u6B65\u8DE8\u8FC7\u534A\u4E2A\u753B\u9762", ["#fbf7ec", "#8cc06a", "#3a3a8c", "#f2a33a"]],
    [2016, "\u5468\u6770\u4F26\u7684\u5E8A\u8FB9\u6545\u4E8B", "Jay Chou's Bedtime Stories", "\u524D\u4E16\u60C5\u4EBA", "\u6E29\u99A8\u7684\u7236\u5973\u573A\u666F", "\u7AE5\u4E66\u7ED8\u672C\u6C34\u5F69", "\u5C0F\u5973\u5B69\u8E2E\u811A\u7ED9\u5B9A\u683C\u7AD9\u7740\u7684\u4ED6\u6234\u4E0A\u4E00\u9876\u7EB8\u7687\u51A0", ["#fbf1e4", "#e6b8a2", "#5a4a5e", "#e8c25a"]],
    [2022, "\u6700\u4F1F\u5927\u7684\u4F5C\u54C1", "Greatest Works of Art", "\u8FD8\u5728\u6D41\u6D6A", "\u516C\u8DEF\u65C5\u884C", "\u590D\u53E4\u660E\u4FE1\u7247", "\u4E00\u4E2A\u90AE\u6233\u300C\u556A\u300D\u5730\u76D6\u5728\u4ED6\u8EAB\u4E0A\uFF0C\u65E5\u671F 2022", ["#f0e2c4", "#5aa0b4", "#3a2c24", "#d6643a"]],
    [2026, "\u592A\u9633\u4E4B\u5B50", "Children of the Sun", "\u90A3\u5929\u4E0B\u96E8\u4E86", "\u767D\u5929\u9635\u96E8\u91CC\u7684\u57CE\u5E02\u8857\u8FB9\u516C\u4EA4\u7AD9\u53F0\uFF0C\u4E00\u7537\u4E00\u5973\u5404\u6491\u4E00\u628A\u989C\u8272\u9C9C\u660E\u7684\u4F1E\u7B49\u8F66", "\u7535\u5F71\u611F\u539A\u6D82\u63D2\u753B\uFF08\u767D\u5929\u3001\u660E\u4EAE\u7684\u6D45\u7070\u5929\u7A7A\u3001\u67D4\u548C\u5747\u5300\u7684\u5149\uFF09", "\u516C\u4EA4\u8F66\u9A76\u8FC7\u6E85\u8D77\u6C34\u82B1\uFF0C\u4E24\u628A\u4F1E\u5728\u5F3A\u62CD\u4E0A\u540C\u65F6\u4E00\u6B6A", ["#e7ebee", "#a9b6c0", "#3d4a56", "#e8553f"]]
  ];
  var EN_CHECKED = new Set(Array.from({ length: 16 }, (_, i) => i + 1));
  var STATIONS = raw.map(([year, albumZh, albumEn, song, scene, style, gag, palette], i) => {
    const n = i + 1;
    return {
      n,
      id: `s${String(n).padStart(2, "0")}`,
      year,
      albumZh,
      albumEn,
      enChecked: EN_CHECKED.has(n),
      song,
      scene,
      style,
      gag,
      palette,
      player: n <= 5 ? "cassette" : n <= 12 ? "cd" : "phone"
    };
  });
  var stationByN = (n) => STATIONS[n - 1];

  // src/scenes/s01.js
  var ST = stationByN(1);
  var PAPER2 = "#fbfaf6";
  var INK2 = "#151515";
  var DARK = "#3a3a3a";
  var T_CAN = GAG - 3;
  var T_FLOWER = [GAG, GAG + 1];
  var T_PANEL = [GAG + 1, GAG + 2];
  var T_SWEAT = GAG + 1.5;
  var T_CAT = GAG + 3;
  var T_OUT2 = GAG + 4;
  var GX = { poleA: -1100, mirror: -620, kiosk: -360, vm: 70, tree: 700, poleB: 1010, bike: 1520, poleC: 3100 };
  var BASE = ROAD_Y - 2;
  function toneTile(S, level, color) {
    return memo(`s01-tile|${S}|${level.toFixed(3)}|${color}`, () => {
      const c = makeCanvas(S, S);
      const g = c.getContext("2d");
      const r = Math.min(S * 0.36, S * Math.sqrt(level / (2 * Math.PI)));
      g.fillStyle = color;
      g.beginPath();
      for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) {
        g.moveTo(x + r, y);
        g.arc(x, y, r, 0, TAU);
      }
      g.fill();
      return c;
    });
  }
  var tone = (ctx, level, { S = 8, color = INK2 } = {}) => ctx.createPattern(toneTile(S, level, color), "repeat");
  function toneGrad(ctx, x0, y0, x1, y1, f, { S = 8, color = INK2 } = {}) {
    ctx.fillStyle = color;
    ctx.beginPath();
    const h = S / 2;
    const ax = Math.floor(x0 / S) * S, ay = Math.floor(y0 / h) * h;
    for (let j = 0, y = ay; y <= y1; j++, y += h) {
      for (let x = ax + (Math.round(y / h) % 2 ? h : 0); x <= x1; x += S) {
        const l = f(x, y);
        if (l <= 0.01) continue;
        const r = Math.min(S * 0.4, S * Math.sqrt(Math.min(1, l) / (2 * Math.PI)));
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, TAU);
      }
    }
    ctx.fill();
  }
  var pen = (ctx, w = 2, c = INK2) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
  };
  function seg(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  function inked(ctx, p, { fill = PAPER2, lv = 0, w = 2.2 } = {}) {
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill(p);
    }
    if (lv > 0) {
      ctx.fillStyle = tone(ctx, lv);
      ctx.fill(p);
    }
    if (w > 0) {
      pen(ctx, w);
      ctx.stroke(p);
    }
  }
  var rectP = (x, y, w, h) => {
    const p = new Path2D();
    p.rect(x, y, w, h);
    return p;
  };
  function sparkle(ctx, x, y, r, w = 1.6) {
    const p = new Path2D();
    const q = r * 0.16;
    p.moveTo(x, y - r);
    p.quadraticCurveTo(x + q, y - q, x + r, y);
    p.quadraticCurveTo(x + q, y + q, x, y + r);
    p.quadraticCurveTo(x - q, y + q, x - r, y);
    p.quadraticCurveTo(x - q, y - q, x, y - r);
    ctx.fillStyle = PAPER2;
    ctx.fill(p);
    pen(ctx, w);
    ctx.stroke(p);
  }
  function petalPath(s) {
    const p = new Path2D();
    p.moveTo(0, 6 * s);
    p.quadraticCurveTo(-7.5 * s, 0, -4 * s, -6 * s);
    p.lineTo(0, -3.4 * s);
    p.lineTo(4 * s, -6 * s);
    p.quadraticCurveTo(7.5 * s, 0, 0, 6 * s);
    return p;
  }
  function petal(ctx, x, y, s, rot, w = 1.2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const p = petalPath(s);
    ctx.fillStyle = PAPER2;
    ctx.fill(p);
    pen(ctx, w);
    ctx.stroke(p);
    ctx.restore();
  }
  function blossom(ctx, x, y, r, rot = 0, w = 1.3) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const p = new Path2D();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU;
      const cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55;
      p.moveTo(cx + r * 0.48, cy);
      p.arc(cx, cy, r * 0.48, 0, TAU);
    }
    ctx.fillStyle = PAPER2;
    ctx.fill(p);
    pen(ctx, w);
    ctx.stroke(p);
    ctx.fillStyle = PAPER2;
    circle(ctx, 0, 0, r * 0.42);
    ctx.fill();
    ctx.fillStyle = INK2;
    circle(ctx, 0, 0, r * 0.16);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU + 0.6;
      circle(ctx, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.06 + 0.4);
      ctx.fill();
    }
    ctx.restore();
  }
  function bubble(ctx, x, y, r) {
    ctx.fillStyle = rgba(PAPER2, 0.7);
    circle(ctx, x, y, r);
    ctx.fill();
    pen(ctx, 1.5);
    ctx.stroke();
    pen(ctx, Math.max(1.2, r * 0.12));
    ctx.beginPath();
    ctx.arc(x, y, r * 0.68, Math.PI * 1.1, Math.PI * 1.45);
    ctx.stroke();
    ctx.fillStyle = INK2;
    circle(ctx, x + r * 0.42, y + r * 0.4, Math.max(1, r * 0.07));
    ctx.fill();
  }
  function leaf(ctx, x, y, L, a) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    const p = new Path2D();
    p.moveTo(0, 0);
    p.quadraticCurveTo(L * 0.5, -L * 0.32, L, 0);
    p.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0);
    inked(ctx, p, { lv: 0.4, w: 1.6 });
    pen(ctx, 1.1);
    seg(ctx, L * 0.08, 0, L * 0.9, 0);
    ctx.restore();
  }
  function rose(ctx, x, y, r, R) {
    ctx.save();
    ctx.translate(x, y);
    for (let k = 0; k < 2; k++) {
      const a = R() * TAU;
      leaf(ctx, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.95, a);
    }
    ctx.rotate(R() * TAU);
    const n = 5, p = new Path2D();
    for (let i = 0; i <= n; i++) {
      const a = i / n * TAU;
      if (!i) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else {
        const am = (i - 0.5) / n * TAU;
        p.quadraticCurveTo(Math.cos(am) * r * 1.3, Math.sin(am) * r * 1.3, Math.cos(a) * r, Math.sin(a) * r);
      }
    }
    ctx.fillStyle = PAPER2;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = tone(ctx, 0.3);
    circle(ctx, r * 0.55, r * 0.55, r * 0.95);
    ctx.fill();
    ctx.restore();
    pen(ctx, 2);
    ctx.stroke(p);
    pen(ctx, 1.8);
    ctx.beginPath();
    ctx.arc(0, r * 0.08, r * 0.62, Math.PI * 0.05, Math.PI * 0.95);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -r * 0.04, r * 0.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const th = i / 60 * TAU * 2.2, rr = r * 0.44 * (1 - i / 66);
      const px = Math.cos(th) * rr, py = Math.sin(th) * rr * 0.85;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    pen(ctx, 1.5);
    ctx.stroke();
    ctx.restore();
  }
  function skyLayer() {
    const w = X_MAX - X_MIN;
    return baked("s01-sky", w * K, 330 * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-X_MIN, 0);
      toneGrad(ctx, X_MIN, 0, X_MAX, 320, (x, y) => 0.3 * Math.pow(Math.max(0, 1 - y / 280), 1.8), { S: 9, color: DARK });
    });
  }
  function cloudPath(cx, cy, w, h, R) {
    const p = new Path2D();
    const n = 4 + Math.floor(R() * 3);
    p.moveTo(cx - w / 2, cy);
    for (let i = 0; i < n; i++) {
      const a = cx - w / 2 + i / n * w, b2 = cx - w / 2 + (i + 1) / n * w;
      const bh = h * (0.7 + 0.6 * R()) * (i === 0 || i === n - 1 ? 0.65 : 1);
      p.bezierCurveTo(a - 10, cy - bh, b2 + 10, cy - bh, b2, cy);
    }
    p.closePath();
    return p;
  }
  function cloudLayer() {
    return strip("s01-cloud", 0.05, (ctx, x0, x1) => {
      const R = rng("s01-cloud");
      for (let x = x0 + 80; x < x1; x += 420 + R() * 380) {
        const y = 150 + R() * 140, w = 180 + R() * 200, h = 34 + R() * 26;
        const p = cloudPath(x, y, w, h, R);
        ctx.fillStyle = PAPER2;
        ctx.fill(p);
        ctx.save();
        ctx.clip(p);
        ctx.fillStyle = tone(ctx, 0.14);
        ctx.fillRect(x - w, y - h * 0.35, w * 2, h);
        ctx.restore();
        pen(ctx, 1.8);
        ctx.stroke(p);
        pen(ctx, 1.1);
        ctx.beginPath();
        ctx.arc(x - w * 0.12, y - h * 0.3, h * 0.35, Math.PI * 1.1, Math.PI * 1.7);
        ctx.stroke();
      }
    }, { y0: 40, y1: 330 });
  }
  function farLayer() {
    return strip("s01-far", 0.22, (ctx, x0, x1) => {
      const R = rng("s01-far");
      for (let x = x0 - 40; x < x1; ) {
        const w = 90 + R() * 160, top = 360 + R() * 140;
        const p = rectP(x, top, w, 800 - top);
        inked(ctx, p, { lv: 0.08 + R() * 0.1, w: 1.4 });
        ctx.fillStyle = PAPER2;
        for (let wy = top + 16; wy < 560; wy += 28) for (let wx = x + 12; wx < x + w - 18; wx += 24) if (R() > 0.3) ctx.fillRect(wx, wy, 11, 13);
        const r = R();
        if (r < 0.3) {
          const tx = x + 20 + R() * (w - 60);
          inked(ctx, rectP(tx, top - 34, 34, 24), { lv: 0.2, w: 1.3 });
          pen(ctx, 1.2);
          seg(ctx, tx + 4, top - 10, tx + 4, top);
          seg(ctx, tx + 30, top - 10, tx + 30, top);
        } else if (r < 0.55) {
          const ax = x + w * (0.3 + R() * 0.4);
          pen(ctx, 1.2);
          seg(ctx, ax, top, ax, top - 46);
          seg(ctx, ax - 14, top - 36, ax + 14, top - 36);
          seg(ctx, ax - 9, top - 26, ax + 9, top - 26);
        }
        x += w + (R() < 0.3 ? 16 + R() * 40 : 0);
      }
    }, { y0: 300, y1: 800 });
  }
  function midLayer() {
    return strip("s01-mid", 0.55, (ctx, x0, x1) => {
      const R = rng("s01-mid");
      for (let x = x0 - 60; x < x1; ) {
        const W2 = 230 + R() * 140, top = 430 + R() * 60;
        inked(ctx, rectP(x, top, W2, 800 - top), { w: 2 });
        inked(ctx, rectP(x - 5, top - 12, W2 + 10, 12), { lv: 0.32, w: 1.8 });
        const nw = W2 > 300 ? 3 : 2, ww = (W2 - 40 - (nw - 1) * 20) / nw;
        for (let i = 0; i < nw; i++) {
          const wx = x + 20 + i * (ww + 20), wy = top + 22;
          inked(ctx, rectP(wx, wy, ww, 74), { lv: 0.22, w: 1.8 });
          ctx.save();
          ctx.beginPath();
          ctx.rect(wx, wy, ww, 74);
          ctx.clip();
          pen(ctx, 5, PAPER2);
          seg(ctx, wx + ww * 0.25, wy + 80, wx + ww * 0.75, wy - 6);
          pen(ctx, 2.4, PAPER2);
          seg(ctx, wx + ww * 0.55, wy + 80, wx + ww * 0.95, wy + 10);
          ctx.restore();
          pen(ctx, 1.2);
          seg(ctx, wx + ww / 2, wy, wx + ww / 2, wy + 74);
          if (R() < 0.35) {
            const ax = wx + ww - 44;
            inked(ctx, rectP(ax, wy + 82, 44, 26), { w: 1.4 });
            pen(ctx, 1);
            circle(ctx, ax + 30, wy + 95, 8);
            ctx.stroke();
            seg(ctx, ax + 5, wy + 88, ax + 16, wy + 88);
            seg(ctx, ax + 5, wy + 94, ax + 16, wy + 94);
          }
        }
        const sy = top + 112;
        inked(ctx, rectP(x + 12, sy, W2 - 24, 46), { w: 2.2 });
        pen(ctx, 1);
        ctx.strokeRect(x + 19, sy + 7, W2 - 38, 32);
        if (R() < 0.5) {
          ctx.fillStyle = tone(ctx, 0.3);
          ctx.fillRect(x + 19, sy + 7, (W2 - 38) * 0.18, 32);
        }
        const ay0 = top + 176, ay1 = ay0 + 50;
        const aw = new Path2D();
        aw.moveTo(x + 10, ay0);
        aw.lineTo(x + W2 - 10, ay0);
        aw.lineTo(x + W2 + 4, ay1);
        const sc = Math.max(4, Math.round((W2 + 8) / 30)), step = (W2 + 8) / sc;
        for (let k = 0; k < sc; k++) {
          const ex = x + W2 + 4 - k * step;
          aw.quadraticCurveTo(ex - step / 2, ay1 + 14, ex - step, ay1);
        }
        aw.closePath();
        ctx.fillStyle = PAPER2;
        ctx.fill(aw);
        ctx.save();
        ctx.clip(aw);
        ctx.fillStyle = tone(ctx, 0.42);
        for (let k = 0; k < sc; k += 2) ctx.fillRect(x - 4 + k * step, ay0, step, 70);
        ctx.restore();
        pen(ctx, 2);
        ctx.stroke(aw);
        const fy = ay1 + 12;
        if (R() < 0.5) {
          inked(ctx, rectP(x + 16, fy, W2 - 32, 800 - fy), { lv: 0.06, w: 1.8 });
          pen(ctx, 1);
          for (let y = fy + 8; y < 800; y += 8) seg(ctx, x + 16, y, x + W2 - 16, y);
          ctx.fillStyle = INK2;
          ctx.fillRect(x + W2 / 2 - 10, 790, 20, 4);
        } else {
          inked(ctx, rectP(x + 16, fy, W2 - 32, 800 - fy), { lv: 0.26, w: 1.8 });
          ctx.save();
          ctx.beginPath();
          ctx.rect(x + 16, fy, W2 - 32, 800 - fy);
          ctx.clip();
          pen(ctx, 7, PAPER2);
          seg(ctx, x + 40, 800, x + 100, fy - 4);
          pen(ctx, 3, PAPER2);
          seg(ctx, x + 90, 800, x + 140, fy - 4);
          ctx.restore();
          pen(ctx, 1.6);
          seg(ctx, x + W2 * 0.62, fy, x + W2 * 0.62, 800);
          pen(ctx, 2);
          seg(ctx, x + W2 * 0.62 - 8, fy + 50, x + W2 * 0.62 - 8, fy + 70);
        }
        x += W2;
        if (R() < 0.35) {
          const gw = 34 + R() * 30;
          const p = rectP(x, top + 30, gw, 770 - top);
          ctx.fillStyle = PAPER2;
          ctx.fill(p);
          ctx.save();
          ctx.clip(p);
          toneGrad(ctx, x, top + 30, x + gw, 800, (xx, yy) => 0.5 - (yy - top) / 900, { S: 7 });
          ctx.restore();
          pen(ctx, 1.6);
          ctx.stroke(p);
          x += gw;
        }
      }
      pen(ctx, 2);
      seg(ctx, x0, 800, x1, 800);
    }, { y0: 400, y1: 802 });
  }
  var CROSS = [250, 610];
  function groundLayer() {
    return strip("s01-ground", 1, (ctx, x0, x1) => {
      const R = rng("s01-ground");
      ctx.fillStyle = PAPER2;
      ctx.fillRect(x0, 786, x1 - x0, 214);
      ctx.fillStyle = tone(ctx, 0.3);
      ctx.fillRect(x0, 786, x1 - x0, 14);
      pen(ctx, 2.2);
      seg(ctx, x0, 800, x1, 800);
      toneGrad(ctx, x0, 803, x1, 834, (x, y) => 0.24 * (1 - (y - 803) / 31), { S: 7 });
      const rows = [800, 821, 847, 880];
      pen(ctx, 1.2);
      for (let i = 0; i < rows.length; i++) {
        const ya = rows[i], yb = i + 1 < rows.length ? rows[i + 1] : 900;
        if (i) seg(ctx, x0, ya, x1, ya);
        const tw = 60 + (ya - 800) * 1.4;
        for (let x = x0 + i % 2 * tw * 0.5 - R() * 10; x < x1; x += tw) seg(ctx, x, ya, x + (yb - ya) * 0.12, yb);
      }
      pen(ctx, 2);
      seg(ctx, x0, 900, x1, 900);
      ctx.fillStyle = tone(ctx, 0.16);
      ctx.fillRect(x0, 910, x1 - x0, 13);
      pen(ctx, 1.4);
      seg(ctx, x0, 910, x1, 910);
      pen(ctx, 2);
      seg(ctx, x0, 923, x1, 923);
      ctx.fillStyle = tone(ctx, 0.32, { S: 7 });
      ctx.fillRect(x0, 924, x1 - x0, 76);
      const [c0, c1] = CROSS;
      ctx.fillStyle = PAPER2;
      ctx.fillRect(c0 - 10, 902, c1 - c0 + 20, 21);
      pen(ctx, 1.4);
      seg(ctx, c0 - 10, 902, c0 - 10, 923);
      seg(ctx, c1 + 10, 902, c1 + 10, 923);
      for (const [a, b] of [[930, 941], [951, 965], [977, 996]]) {
        const p = rectP(c0, a, c1 - c0, b - a);
        ctx.fillStyle = PAPER2;
        ctx.fill(p);
        pen(ctx, 1.2);
        ctx.stroke(p);
      }
      for (let x = x0 + R() * 200; x < x1; x += 160 + R() * 260) {
        const y = 810 + R() * 80;
        pen(ctx, 1);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 8, y + 3);
        ctx.lineTo(x + 13, y + 1);
        ctx.lineTo(x + 20, y + 5);
        ctx.stroke();
      }
    }, { y0: 784, y1: 1e3 });
  }
  function sprite(key, w, h, draw) {
    const c = baked(`s01-sp|${key}`, w * K, h * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(w / 2, h - 24);
      draw(ctx);
    });
    return { c, w, h };
  }
  var drawSprite = (ctx, S, x, y) => ctx.drawImage(S.c, x - S.w / 2, y - (S.h - 24), S.w, S.h);
  function groundShadow(ctx, w) {
    ctx.fillStyle = tone(ctx, 0.4);
    ellipse(ctx, 0, 4, w, 10);
    ctx.fill();
  }
  function kioskSprite() {
    return sprite("kiosk", 520, 560, (ctx) => {
      groundShadow(ctx, 230);
      const W2 = 200;
      inked(ctx, rectP(-W2, -400, 2 * W2, 400), { w: 0 });
      inked(ctx, rectP(-W2, -175, 2 * W2, 175), { lv: 0.2, w: 2 });
      pen(ctx, 1.2);
      for (let x = -W2 + 50; x < W2; x += 50) seg(ctx, x, -165, x, -10);
      const open = rectP(-130, -380, 260, 186);
      inked(ctx, open, { lv: 0.55, w: 2 });
      inked(ctx, (() => {
        const p = new Path2D();
        p.ellipse(-10, -318, 34, 18, 0, Math.PI, 0);
        p.closePath();
        return p;
      })(), { lv: 0.3, w: 1.8 });
      inked(ctx, (() => {
        const p = new Path2D();
        p.moveTo(-44, -320);
        p.lineTo(-74, -314);
        p.lineTo(-44, -308);
        p.closePath();
        return p;
      })(), { fill: INK2, w: 1.2 });
      const paper2 = new Path2D();
      paper2.moveTo(-80, -312);
      paper2.lineTo(64, -318);
      paper2.lineTo(70, -200);
      paper2.lineTo(-76, -196);
      paper2.closePath();
      inked(ctx, paper2, { w: 1.8 });
      ctx.save();
      ctx.clip(paper2);
      ctx.fillStyle = tone(ctx, 0.35);
      ctx.fillRect(-70, -300, 56, 34);
      ctx.fillRect(4, -300, 54, 18);
      ctx.fillRect(-70, -250, 30, 40);
      pen(ctx, 1);
      seg(ctx, -4, -312, -2, -196);
      ctx.fillStyle = tone(ctx, 0.12);
      ctx.fillRect(4, -276, 54, 70);
      ctx.fillRect(-36, -258, 28, 52);
      ctx.restore();
      for (const hx of [-82, 68]) {
        ctx.fillStyle = PAPER2;
        ellipse(ctx, hx, -262, 9, 12);
        ctx.fill();
        pen(ctx, 1.4);
        ctx.stroke();
      }
      inked(ctx, rectP(-W2 - 12, -196, 2 * W2 + 24, 16), { w: 2 });
      for (const sx of [-170, 80]) {
        for (let k = 0; k < 4; k++) {
          inked(ctx, rectP(sx + k % 2 * 3, -212 + k * 0 - k * 4, 86, 6), { w: 1.1 });
        }
      }
      const R = rng("s01-kiosk");
      for (const px of [-W2 + 6, W2 - 64]) {
        for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 2; c2++) {
          const mx = px + c2 * 30, my = -372 + r2 * 58;
          const p = rectP(mx, my, 26, 48);
          inked(ctx, p, { lv: 0.1 + R() * 0.4, w: 1.2 });
          ctx.fillStyle = PAPER2;
          if (R() < 0.5) {
            circle(ctx, mx + 13, my + 28, 7);
            ctx.fill();
            pen(ctx, 0.9);
            ctx.stroke();
          } else {
            ctx.fillRect(mx + 3, my + 4, 20, 8);
          }
        }
      }
      pen(ctx, 2.4);
      ctx.strokeRect(-W2, -400, 2 * W2, 400);
      inked(ctx, rectP(-W2 - 34, -440, 2 * W2 + 68, 40), { lv: 0.36, w: 2.2 });
      pen(ctx, 3, PAPER2);
      seg(ctx, -W2 - 30, -434, W2 + 30, -434);
      inked(ctx, rectP(-150, -500, 300, 58), { w: 2.4 });
      pen(ctx, 1.1);
      ctx.strokeRect(-142, -492, 284, 42);
    });
  }
  var SLOT = { x: -96, y: -98, w: 132, h: 46 };
  function vmSprite() {
    return sprite("vm", 320, 520, (ctx) => {
      groundShadow(ctx, 150);
      inked(ctx, (() => {
        const p = new Path2D();
        p.moveTo(120, -436);
        p.lineTo(142, -424);
        p.lineTo(142, 0);
        p.lineTo(120, 0);
        p.closePath();
        return p;
      })(), { lv: 0.42, w: 2 });
      const body = new Path2D();
      body.roundRect ? body.roundRect(-120, -444, 240, 444, 10) : body.rect(-120, -444, 240, 444);
      inked(ctx, body, { w: 0 });
      ctx.fillStyle = tone(ctx, 0.3);
      ctx.fillRect(-120, -436, 240, 22);
      const disp = rectP(-104, -404, 164, 196);
      inked(ctx, disp, { lv: 0.12, w: 2 });
      for (let r2 = 0; r2 < 3; r2++) {
        const yb = -346 + r2 * 64;
        for (let i = 0; i < 5; i++) {
          const cx = -88 + i * 31;
          const p = new Path2D();
          if ((i + r2) % 2) {
            p.rect(cx - 9, yb - 40, 18, 40);
          } else {
            p.moveTo(cx - 9, yb);
            p.lineTo(cx - 9, yb - 28);
            p.quadraticCurveTo(cx - 9, yb - 36, cx - 4, yb - 40);
            p.lineTo(cx - 4, yb - 48);
            p.lineTo(cx + 4, yb - 48);
            p.lineTo(cx + 4, yb - 40);
            p.quadraticCurveTo(cx + 9, yb - 36, cx + 9, yb - 28);
            p.lineTo(cx + 9, yb);
            p.closePath();
          }
          inked(ctx, p, { w: 1.3 });
          ctx.save();
          ctx.clip(p);
          ctx.fillStyle = tone(ctx, [0.5, 0.25, 0.4][(i + r2 * 2) % 3]);
          ctx.fillRect(cx - 10, yb - 26, 20, 14);
          ctx.restore();
          inked(ctx, (() => {
            const q = new Path2D();
            q.roundRect ? q.roundRect(cx - 7, yb + 6, 14, 7, 2) : q.rect(cx - 7, yb + 6, 14, 7);
            return q;
          })(), { w: 1 });
        }
      }
      inked(ctx, rectP(70, -404, 38, 196), { w: 1.8 });
      ctx.fillStyle = INK2;
      ctx.fillRect(84, -384, 10, 24);
      inked(ctx, rectP(76, -340, 26, 12), { lv: 0.5, w: 1.2 });
      circle(ctx, 89, -300, 8);
      inked(ctx, (() => {
        const p = new Path2D();
        p.arc(89, -300, 8, 0, TAU);
        return p;
      })(), { w: 1.4 });
      inked(ctx, rectP(78, -262, 22, 36), { lv: 0.3, w: 1.2 });
      const ad = rectP(-104, -196, 212, 80);
      inked(ctx, ad, { w: 1.8 });
      ctx.save();
      ctx.clip(ad);
      ctx.fillStyle = tone(ctx, 0.35);
      for (let k = -4; k < 10; k++) {
        ctx.beginPath();
        ctx.moveTo(-104 + k * 34, -116);
        ctx.lineTo(-104 + k * 34 + 16, -116);
        ctx.lineTo(-104 + k * 34 + 96, -196);
        ctx.lineTo(-104 + k * 34 + 80, -196);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      inked(ctx, rectP(SLOT.x, SLOT.y, SLOT.w, SLOT.h), { fill: INK2, w: 2 });
      inked(ctx, rectP(SLOT.x, SLOT.y, SLOT.w, 12), { lv: 0.5, w: 1.4 });
      inked(ctx, rectP(-120, -30, 240, 30), { lv: 0.28, w: 1.8 });
      pen(ctx, 2.6);
      ctx.stroke(body);
    });
  }
  function poleSprite() {
    return sprite("pole", 240, 900, (ctx) => {
      groundShadow(ctx, 30);
      const p = new Path2D();
      p.moveTo(-16, 0);
      p.lineTo(-10, -860);
      p.lineTo(10, -860);
      p.lineTo(16, 0);
      p.closePath();
      inked(ctx, p, { w: 0 });
      ctx.save();
      ctx.clip(p);
      ctx.fillStyle = tone(ctx, 0.4);
      ctx.fillRect(1, -870, 20, 880);
      ctx.restore();
      pen(ctx, 2.2);
      ctx.stroke(p);
      for (const [y, L] of [[-770, 96], [-712, 70]]) {
        inked(ctx, rectP(-L, y, 2 * L, 9), { lv: 0.3, w: 1.8 });
        for (const x of [-L + 8, 0, L - 8]) {
          if (!x && y > -760) continue;
          inked(ctx, (() => {
            const q = new Path2D();
            q.roundRect ? q.roundRect(x - 5, y - 13, 10, 13, 3) : q.rect(x - 5, y - 13, 10, 13);
            return q;
          })(), { w: 1.3 });
        }
      }
      pen(ctx, 1.6);
      seg(ctx, -60, -761, -14, -730);
      seg(ctx, 60, -761, 14, -730);
      const tr = new Path2D();
      tr.roundRect ? tr.roundRect(16, -600, 46, 86, 8) : tr.rect(16, -600, 46, 86);
      inked(ctx, tr, { w: 2 });
      ctx.save();
      ctx.clip(tr);
      toneGrad(ctx, 16, -600, 62, -514, (x) => 0.05 + (x - 16) / 46 * 0.45, { S: 6 });
      ctx.restore();
      pen(ctx, 2);
      ctx.stroke(tr);
      pen(ctx, 1.4);
      seg(ctx, 16, -580, 12, -580);
      seg(ctx, 16, -530, 12, -530);
      seg(ctx, 30, -600, 30, -640);
      seg(ctx, 48, -600, 48, -650);
      pen(ctx, 2.2);
      for (let y = -170, s = 1; y > -680; y -= 46, s = -s) seg(ctx, s * 12, y, s * 26, y);
      inked(ctx, rectP(-12, -330, 24, 40), { w: 1.4 });
    });
  }
  var WIRE = [[-88, -770], [0, -770], [88, -770], [-62, -712], [62, -712]];
  function treeSprite() {
    return sprite("tree", 700, 800, (ctx) => {
      groundShadow(ctx, 90);
      const R = rng("s01-tree");
      const trunk = new Path2D();
      trunk.moveTo(-30, 0);
      trunk.bezierCurveTo(-24, -120, -34, -220, -14, -330);
      trunk.lineTo(10, -330);
      trunk.bezierCurveTo(4, -220, 16, -110, 28, 0);
      trunk.closePath();
      inked(ctx, trunk, { lv: 0.5, w: 2.4 });
      pen(ctx, 1.2, PAPER2);
      for (let y = -40; y > -310; y -= 34) seg(ctx, -14 + R() * 6, y, 2 + R() * 8, y - 6);
      const blobs2 = [[-230, -360, 105], [-120, -470, 150], [60, -540, 165], [210, -430, 140], [-30, -360, 120], [130, -330, 95], [-60, -650, 120], [160, -680, 105], [-230, -560, 100]];
      pen(ctx, 9);
      ctx.strokeStyle = INK2;
      for (const [bx, by] of blobs2) {
        ctx.lineWidth = 6 + R() * 6;
        ctx.beginPath();
        ctx.moveTo(-2, -320);
        ctx.quadraticCurveTo((bx - 2) * 0.4, -340 + (by + 320) * 0.3, bx * 0.8, by * 0.95);
        ctx.stroke();
      }
      for (const [bx, by, r] of blobs2) {
        const p = new Path2D();
        const n = 11;
        const pt = (a, rr) => [bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.82];
        p.moveTo(...pt(0, r));
        for (let i = 1; i <= n; i++) {
          const a = i / n * TAU, am = (i - 0.5) / n * TAU;
          p.quadraticCurveTo(...pt(am, r * (1.16 + 0.06 * Math.sin(i * 3.1 + bx))), ...pt(a, r));
        }
        p.closePath();
        ctx.fillStyle = PAPER2;
        ctx.fill(p);
        ctx.save();
        ctx.clip(p);
        toneGrad(ctx, bx - r * 1.3, by - r, bx + r * 1.3, by + r * 1.2, (x, y) => 0.3 * smoothstep(by + r * 0.05, by + r * 0.95, y), { S: 7 });
        ctx.restore();
        pen(ctx, 2);
        ctx.stroke(p);
      }
      for (let k = 0; k < 70; k++) {
        const [bx, by, r] = blobs2[k % blobs2.length];
        const a = R() * TAU, rr = Math.sqrt(R()) * r * 0.85;
        blossom(ctx, bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.8, 6 + R() * 5, R() * TAU, 1.1);
      }
    });
  }
  function bikeSprite() {
    return sprite("bike", 360, 260, (ctx) => {
      groundShadow(ctx, 130);
      const wheel = (x) => {
        pen(ctx, 5);
        circle(ctx, x, -62, 60);
        ctx.stroke();
        pen(ctx, 1.2);
        circle(ctx, x, -62, 52);
        ctx.stroke();
        pen(ctx, 0.9);
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * TAU;
          seg(ctx, x, -62, x + Math.cos(a) * 52, -62 + Math.sin(a) * 52);
        }
        ctx.fillStyle = INK2;
        circle(ctx, x, -62, 5);
        ctx.fill();
        pen(ctx, 2.4);
        ctx.beginPath();
        ctx.arc(x, -62, 68, Math.PI * 1.08, Math.PI * 1.9);
        ctx.stroke();
      };
      wheel(-100);
      wheel(100);
      pen(ctx, 5);
      ctx.beginPath();
      ctx.moveTo(-100, -62);
      ctx.lineTo(-6, -62);
      ctx.lineTo(-40, -170);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-6, -62);
      ctx.quadraticCurveTo(30, -70, 74, -176);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-100, -62);
      ctx.lineTo(-40, -160);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(100, -62);
      ctx.lineTo(80, -190);
      ctx.stroke();
      pen(ctx, 4);
      ctx.beginPath();
      ctx.moveTo(80, -190);
      ctx.quadraticCurveTo(70, -214, 48, -206);
      ctx.stroke();
      inked(ctx, (() => {
        const p = new Path2D();
        p.ellipse(-44, -178, 26, 8, -0.08, 0, TAU);
        return p;
      })(), { fill: INK2, w: 1 });
      const bk = new Path2D();
      bk.moveTo(92, -206);
      bk.lineTo(160, -206);
      bk.lineTo(152, -150);
      bk.lineTo(98, -150);
      bk.closePath();
      inked(ctx, bk, { lv: 0.08, w: 2 });
      pen(ctx, 1);
      for (let x = 102; x < 158; x += 10) seg(ctx, x, -206, x - 2, -150);
      seg(ctx, 94, -178, 156, -178);
      ctx.fillStyle = INK2;
      circle(ctx, -6, -62, 11);
      ctx.fill();
      pen(ctx, 3);
      seg(ctx, -6, -62, 12, -40);
      seg(ctx, -6, -62, -24, -84);
      pen(ctx, 2.4);
      seg(ctx, -20, -60, -34, 0);
    });
  }
  function mirrorSprite() {
    return sprite("mirror", 200, 640, (ctx) => {
      groundShadow(ctx, 22);
      inked(ctx, rectP(-5, -500, 10, 500), { lv: 0.3, w: 1.6 });
      pen(ctx, 2);
      seg(ctx, -5, -505, 0, -520);
      const m = new Path2D();
      m.ellipse(0, -548, 54, 58, 0, 0, TAU);
      ctx.fillStyle = PAPER2;
      ctx.fill(m);
      ctx.save();
      ctx.clip(m);
      toneGrad(ctx, -60, -610, 60, -490, (x, y) => 0.08 + Math.max(0, (x + y + 548) / 120) * 0.35, { S: 6 });
      pen(ctx, 6, PAPER2);
      seg(ctx, -34, -540, -6, -588);
      pen(ctx, 3, PAPER2);
      seg(ctx, -24, -520, 6, -572);
      ctx.restore();
      pen(ctx, 8);
      ctx.stroke(m);
      pen(ctx, 2, PAPER2);
      ctx.beginPath();
      ctx.ellipse(0, -548, 54, 58, 0, Math.PI * 1.15, Math.PI * 1.45);
      ctx.stroke();
      inked(ctx, (() => {
        const p = new Path2D();
        p.ellipse(0, -604, 46, 14, 0, Math.PI, 0);
        p.closePath();
        return p;
      })(), { lv: 0.4, w: 1.8 });
    });
  }
  function cat(ctx, x, y, awake) {
    ctx.save();
    ctx.translate(x, y);
    const body = new Path2D();
    body.ellipse(4, -22, 48, 23, 0, 0, TAU);
    inked(ctx, body, { w: 2 });
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = tone(ctx, 0.45);
    for (const sx of [-6, 14, 34]) {
      ctx.beginPath();
      ctx.moveTo(sx, -46);
      ctx.lineTo(sx + 10, -46);
      ctx.lineTo(sx + 4, -26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const tail = new Path2D();
    tail.moveTo(46, -14);
    tail.quadraticCurveTo(66, 0, 40, 2);
    tail.quadraticCurveTo(10, 4, -20, 0);
    pen(ctx, 7);
    ctx.stroke(tail);
    pen(ctx, 4, PAPER2);
    ctx.stroke(tail);
    const hx = -40, hy = awake ? -46 : -24;
    const head = new Path2D();
    head.ellipse(hx, hy, 22, 19, 0, 0, TAU);
    const ears = new Path2D();
    ears.moveTo(hx - 20, hy - 8);
    ears.lineTo(hx - 18, hy - (awake ? 30 : 24));
    ears.lineTo(hx - 6, hy - 16);
    ears.closePath();
    ears.moveTo(hx + 4, hy - 17);
    ears.lineTo(hx + 14, hy - (awake ? 32 : 26));
    ears.lineTo(hx + 20, hy - 8);
    ears.closePath();
    inked(ctx, ears, { lv: 0.4, w: 2 });
    inked(ctx, head, { w: 2 });
    pen(ctx, 1.6);
    if (awake) {
      for (const ex of [-10, 6]) {
        ctx.fillStyle = PAPER2;
        circle(ctx, hx + ex, hy - 2, 5.5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = INK2;
        circle(ctx, hx + ex + 2.2, hy - 2, 2.6);
        ctx.fill();
      }
      seg(ctx, hx - 2, hy + 7, hx + 2, hy + 7);
      pen(ctx, 1);
      seg(ctx, hx + 16, hy + 4, hx + 32, hy + 1);
      seg(ctx, hx + 16, hy + 8, hx + 32, hy + 9);
      seg(ctx, hx - 18, hy + 4, hx - 32, hy + 1);
    } else {
      for (const ex of [-10, 6]) {
        ctx.beginPath();
        ctx.arc(hx + ex, hy - 1, 4.5, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
      pen(ctx, 1);
      seg(ctx, hx - 18, hy + 5, hx - 32, hy + 3);
    }
    ctx.restore();
  }
  var HALO = [CHAR_X, 480];
  function shoujoLayer() {
    const w = X_MAX - X_MIN;
    return baked("s01-shoujo", w * K, 1e3 * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-X_MIN, 0);
      const R = rng("s01-shoujo");
      ctx.fillStyle = PAPER2;
      ctx.fillRect(X_MIN, 0, w, 1e3);
      const dn = (x, y) => Math.hypot((x - HALO[0]) / 1e3, (y - HALO[1]) / 660);
      toneGrad(ctx, X_MIN, 0, X_MAX, 1e3, (x, y) => 0.6 * smoothstep(0.4, 1.12, dn(x, y)), { S: 8, color: DARK });
      ctx.fillStyle = PAPER2;
      for (let i = 0; i < 96; i++) {
        const a = i / 96 * TAU + R() * 0.04, r0 = 300 + R() * 260, r1 = 1600, hw = 3e-3 + R() * 9e-3;
        poly(ctx, [[HALO[0] + Math.cos(a) * r0, HALO[1] + Math.sin(a) * r0], [HALO[0] + Math.cos(a - hw) * r1, HALO[1] + Math.sin(a - hw) * r1], [HALO[0] + Math.cos(a + hw) * r1, HALO[1] + Math.sin(a + hw) * r1]]);
        ctx.fill();
      }
      const free = (x, y, r) => !(x > 170 - r && x < 470 + r && y > 250 - r && y < 830 + r) && !(x < -20 + r && y < 250 + r);
      const roses = [
        [-300, 400, 66],
        [-190, 560, 54],
        [-330, 730, 82],
        [-170, 880, 66],
        [-10, 970, 62],
        [90, 760, 44],
        [560, 960, 58],
        [720, 870, 76],
        [900, 960, 62],
        [1080, 890, 56],
        [1260, 960, 70],
        [1320, 760, 78],
        [1170, 650, 56],
        [1330, 560, 58],
        [1240, 400, 70],
        [1340, 220, 62],
        [1180, 110, 72],
        [990, 70, 54],
        [800, 60, 58],
        [630, 120, 48],
        [-110, 320, 44],
        [580, 300, 40],
        [700, 640, 46],
        [-300, 990, 50]
      ];
      for (const [x, y, r] of roses) rose(ctx, x, y, r, R);
      for (let k = 0; k < 400 && k >= 0; k++) {
        const x = X_MIN + R() * w, y = R() * 1e3, r = 9 + R() * 14;
        if (!free(x, y, r)) continue;
        const t = R();
        if (t < 0.32) blossom(ctx, x, y, r, R() * TAU);
        else if (t < 0.6) bubble(ctx, x, y, r * (0.5 + R() * 1.6));
        else if (t < 0.88) petal(ctx, x, y, 1.4 + R() * 1.4, R() * TAU);
        else sparkle(ctx, x, y, r * 1.4, 1.3);
      }
    });
  }
  var TWINKLES = Array.from({ length: 16 }, (_, i) => {
    const a = hash2(i, 1, 101) * TAU, d = 0.55 + hash2(i, 2, 101) * 0.45;
    return [HALO[0] + Math.cos(a) * d * 900, HALO[1] + Math.sin(a) * d * 520, 16 + hash2(i, 3, 101) * 22, hash2(i, 4, 101)];
  }).filter(([x, y]) => !(x > 150 && x < 490 && y > 230 && y < 840) && !(x < 0 && y < 260));
  function drawShoujo(ctx, b) {
    const t = b - T_FLOWER[0];
    const pop = 1.07 - 0.07 * ease.out(clamp(t / 0.14));
    ctx.save();
    ctx.translate(HALO[0], HALO[1]);
    ctx.scale(pop, pop);
    ctx.translate(-HALO[0], -HALO[1]);
    ctx.drawImage(shoujoLayer(), X_MIN, 0, X_MAX - X_MIN, 1e3);
    ctx.restore();
    for (const [x, y, r, ph] of TWINKLES) {
      const k = 0.45 + 0.55 * Math.abs(Math.sin(TAU * (t * 1.5 + ph)));
      sparkle(ctx, x, y, r * k, 1.8);
      pen(ctx, 1.2);
      seg(ctx, x - r * 1.5 * k, y, x - r * 1.05 * k, y);
      seg(ctx, x + r * 1.05 * k, y, x + r * 1.5 * k, y);
    }
    for (let i = 0; i < 6; i++) {
      const a = -1.9 + i * 0.32, rr = 230 + i % 2 * 40;
      const k = 0.5 + 0.5 * Math.abs(Math.sin(TAU * (t * 2 + i * 0.17)));
      sparkle(ctx, CHAR_X + Math.cos(a) * rr * 0.9, 520 + Math.sin(a) * rr, (8 + i % 3 * 4) * k, 1.4);
    }
  }
  function drawPetals(ctx, b, treeX) {
    for (let i = 0; i < 22; i++) {
      const P2 = 3.2 + hash2(i, 1, 7) * 2.4;
      const t = (b + hash2(i, 2, 7) * P2) / P2 % 1;
      const tt = t < 0 ? t + 1 : t;
      const x0 = treeX + (hash2(i, 3, 7) - 0.5) * 560, y0 = BASE - 660 + hash2(i, 4, 7) * 260;
      const x = x0 - tt * (180 + hash2(i, 5, 7) * 160) + Math.sin(tt * TAU * 1.3 + i) * 26;
      const y = lerp(y0, BASE + 60 + hash2(i, 6, 7) * 120, tt);
      if (x < X_MIN - 20 || x > X_MAX + 20) continue;
      petal(ctx, x, y, 1.3 + hash2(i, 7, 7) * 0.6, tt * 9 + i);
    }
  }
  var PANELS = [
    { t: T_PANEL[0], q: [[808, 58], [1092, 58], [1070, 322], [808, 322]], draw: drawGirl },
    { t: T_PANEL[1], q: [[1106, 58], [1366, 58], [1366, 322], [1084, 322]], draw: drawUncle }
  ];
  function drawPanel(ctx, P2, b) {
    if (b < P2.t || b >= T_OUT2 + 0.4) return;
    const pin = ease.out(clamp((b - P2.t) / 0.12));
    const out = ease.in(clamp((b - T_OUT2) / 0.35));
    const cx = (P2.q[0][0] + P2.q[1][0]) / 2, cy = (P2.q[0][1] + P2.q[2][1]) / 2;
    const path = new Path2D();
    P2.q.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();
    ctx.save();
    ctx.translate(out * 700, 0);
    ctx.translate(cx, cy);
    ctx.scale(1.14 - 0.14 * pin, 1.14 - 0.14 * pin);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha *= clamp(pin * 3);
    pen(ctx, 16, PAPER2);
    ctx.stroke(path);
    ctx.fillStyle = PAPER2;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    P2.draw(ctx, b - P2.t);
    ctx.restore();
    pen(ctx, 4.5);
    ctx.stroke(path);
    ctx.restore();
  }
  function speedLinesH(ctx, x0, y0, x1, y1, seed) {
    pen(ctx, 1.4);
    for (let i = 0; i < 26; i++) {
      const y = y0 + (y1 - y0) * hash2(i, 1, seed), L = (x1 - x0) * (0.3 + 0.6 * hash2(i, 2, seed));
      const xs = x1 - L * hash2(i, 3, seed) * 0.4;
      ctx.lineWidth = 0.8 + hash2(i, 4, seed) * 1.6;
      seg(ctx, xs - L, y, xs, y);
    }
  }
  function drawGirl(ctx, t) {
    ctx.fillStyle = tone(ctx, 0.12);
    ctx.fillRect(800, 50, 300, 280);
    ctx.fillStyle = PAPER2;
    ctx.fillRect(800, 50, 300, 120);
    speedLinesH(ctx, 800, 60, 1100, 190, 21);
    const turn = ease.out(clamp(t / 0.2));
    const hx = 958 - 6 * turn, hy = 178;
    const back = new Path2D();
    back.moveTo(842, 330);
    back.quadraticCurveTo(850, 252, 930, 240);
    back.lineTo(1e3, 240);
    back.quadraticCurveTo(1066, 252, 1078, 330);
    back.closePath();
    inked(ctx, back, { w: 2.2 });
    const collar = new Path2D();
    collar.moveTo(904, 244);
    collar.lineTo(1022, 244);
    collar.lineTo(1034, 306);
    collar.lineTo(894, 306);
    collar.closePath();
    inked(ctx, collar, { fill: INK2, w: 2 });
    pen(ctx, 3, PAPER2);
    seg(ctx, 902, 292, 1026, 292);
    seg(ctx, 900, 282, 1028, 282);
    const tail = new Path2D();
    tail.moveTo(1e3, 150);
    tail.bezierCurveTo(1050 + 20 * turn, 150, 1070 + 14 * turn, 210, 1046 + 26 * turn, 262);
    tail.bezierCurveTo(1040, 214, 1022, 186, 992, 182);
    tail.closePath();
    inked(ctx, tail, { fill: INK2, w: 2 });
    pen(ctx, 1.8, PAPER2);
    ctx.beginPath();
    ctx.moveTo(1018, 166);
    ctx.quadraticCurveTo(1046, 182, 1048, 220);
    ctx.stroke();
    pen(ctx, 1.4);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(1004, 196, 66 + k * 12, -0.5, 0.55);
      ctx.stroke();
    }
    const hair = new Path2D();
    hair.ellipse(hx + 6, hy - 6, 56, 60, 0, 0, TAU);
    inked(ctx, hair, { fill: INK2, w: 2 });
    const face = new Path2D();
    face.moveTo(hx - 44, hy - 16);
    face.quadraticCurveTo(hx - 50, hy + 30, hx - 22, hy + 52);
    face.quadraticCurveTo(hx + 4, hy + 60, hx + 18, hy + 34);
    face.quadraticCurveTo(hx + 10, hy - 10, hx - 44, hy - 16);
    face.closePath();
    inked(ctx, face, { w: 2 });
    ctx.fillStyle = INK2;
    poly(ctx, [[hx - 50, hy - 24], [hx - 40, hy + 4], [hx - 30, hy - 14], [hx - 20, hy + 2], [hx - 8, hy - 14], [hx + 4, hy + 4], [hx + 14, hy - 20], [hx - 6, hy - 46]]);
    ctx.fill();
    pen(ctx, 2.4, PAPER2);
    ctx.beginPath();
    ctx.ellipse(hx + 8, hy - 24, 40, 18, -0.15, Math.PI * 1.05, Math.PI * 1.9);
    ctx.stroke();
    ctx.fillStyle = PAPER2;
    circle(ctx, 1e3, 160, 7);
    ctx.fill();
    pen(ctx, 1.6);
    ctx.stroke();
    ctx.fillStyle = INK2;
    ellipse(ctx, hx - 30, hy + 14, 4.5, 6.5);
    ctx.fill();
    ellipse(ctx, hx - 6, hy + 14, 4.5, 6.5);
    ctx.fill();
    pen(ctx, 1.6);
    seg(ctx, hx - 36, hy + 2, hx - 24, hy + 1);
    seg(ctx, hx - 12, hy + 1, hx, hy + 2);
    seg(ctx, hx - 20, hy + 38, hx - 12, hy + 38);
  }
  function drawUncle(ctx, t) {
    ctx.fillStyle = tone(ctx, 0.2);
    ctx.fillRect(1080, 50, 300, 280);
    pen(ctx, 1);
    for (let i = 0; i < 18; i++) {
      const x = 1090 + i * 16;
      seg(ctx, x, 50, x + 30, 330);
    }
    const turn = ease.out(clamp(t / 0.2));
    const hx = 1218 - 10 * turn, hy = 168;
    const head = new Path2D();
    head.ellipse(hx, hy, 50, 56, 0, 0, TAU);
    inked(ctx, head, { w: 2.2 });
    const crown = new Path2D();
    crown.ellipse(hx + 4, hy - 34, 56, 34, 0, Math.PI, 0);
    crown.closePath();
    inked(ctx, crown, { lv: 0.35, w: 2.2 });
    const bill = new Path2D();
    bill.moveTo(hx - 50, hy - 36);
    bill.quadraticCurveTo(hx - 92, hy - 30, hx - 96, hy - 22);
    bill.lineTo(hx - 46, hy - 26);
    bill.closePath();
    inked(ctx, bill, { fill: INK2, w: 1.6 });
    for (const ex of [-26, 8]) {
      const g = new Path2D();
      g.ellipse(hx + ex, hy - 4, 16, 12, 0, 0, TAU);
      inked(ctx, g, { lv: 0.18, w: 2.4 });
      pen(ctx, 3, PAPER2);
      seg(ctx, hx + ex - 8, hy + 4, hx + ex + 4, hy - 12);
    }
    pen(ctx, 2);
    seg(ctx, hx - 10, hy - 5, hx - 8, hy - 5);
    ctx.fillStyle = INK2;
    ellipse(ctx, hx - 12, hy + 26, 20, 7);
    ctx.fill();
    const np = new Path2D();
    np.moveTo(1094, 232);
    np.lineTo(1360, 222);
    np.lineTo(1372, 334);
    np.lineTo(1088, 334);
    np.closePath();
    inked(ctx, np, { w: 2.2 });
    ctx.save();
    ctx.clip(np);
    ctx.fillStyle = tone(ctx, 0.4);
    ctx.fillRect(1108, 244, 70, 40);
    ctx.fillRect(1250, 240, 90, 22);
    ctx.fillStyle = tone(ctx, 0.15);
    ctx.fillRect(1190, 246, 48, 80);
    ctx.fillRect(1108, 292, 70, 40);
    ctx.fillRect(1250, 270, 90, 60);
    pen(ctx, 1);
    seg(ctx, 1184, 236, 1186, 334);
    seg(ctx, 1244, 232, 1246, 334);
    ctx.restore();
    for (const hx2 of [1100, 1350]) {
      ctx.fillStyle = PAPER2;
      ellipse(ctx, hx2, 250, 12, 16);
      ctx.fill();
      pen(ctx, 1.8);
      ctx.stroke();
    }
  }
  function sweat(ctx, fig, b) {
    if (b < T_SWEAT || b >= T_OUT2) return;
    const k = ease.outBack(clamp((b - T_SWEAT) / 0.18));
    const slide = (b - T_SWEAT) * 9;
    const a = ANCHORS.stand.headTop;
    const x = fig.x + (a[0] + 66) * fig.scale, y = fig.y + (a[1] + 44) * fig.scale + slide;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k * 1.35, k * 1.35);
    const p = new Path2D();
    p.moveTo(0, -24);
    p.bezierCurveTo(6, -8, 15, 2, 15, 12);
    p.arc(0, 12, 15, 0, Math.PI);
    p.bezierCurveTo(-15, 2, -6, -8, 0, -24);
    p.closePath();
    ctx.fillStyle = PAPER2;
    ctx.fill(p);
    pen(ctx, 3);
    ctx.stroke(p);
    pen(ctx, 2.2);
    ctx.beginPath();
    ctx.arc(0, 12, 9, Math.PI * 0.15, Math.PI * 0.55);
    ctx.stroke();
    ctx.restore();
  }
  function focusLines(ctx, b) {
    const k = 1 - smoothstep(0.05, 0.6, b);
    if (b < 0 || k <= 0) return;
    ctx.save();
    ctx.fillStyle = rgba(INK2, 0.9 * k);
    const C = [CHAR_X + 30, 520];
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * TAU + hash2(i, 1, 33) * 0.05;
      const r0 = 560 + hash2(i, 2, 33) * 260 + (1 - k) * 160, r1 = 1700, hw = 2e-3 + hash2(i, 3, 33) * 7e-3;
      poly(ctx, [[C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0], [C[0] + Math.cos(a - hw) * r1, C[1] + Math.sin(a - hw) * r1], [C[0] + Math.cos(a + hw) * r1, C[1] + Math.sin(a + hw) * r1]]);
      ctx.fill();
    }
    ctx.restore();
  }
  var M = 12;
  function pageBorder(ctx) {
    const p = new Path2D();
    p.rect(X_MIN - 10, -10, X_MAX - X_MIN + 20, 1020);
    p.rect(X_MIN + M, M, X_MAX - X_MIN - 2 * M, 1e3 - 2 * M);
    ctx.fillStyle = PAPER2;
    ctx.fill(p, "evenodd");
    pen(ctx, 3.5);
    ctx.strokeRect(X_MIN + M, M, X_MAX - X_MIN - 2 * M, 1e3 - 2 * M);
  }
  var s01 = {
    id: "s01",
    station: ST,
    // 漫画里人物压在网点上时的「白边」：保证经过灰网点马路、售货机、树干时也拉得开
    figureRim: { color: PAPER2, width: 6, alpha: 1 },
    freezeBeat: GAG + 0.5,
    // Outro 展墙定格在少女漫画闪光那一拍
    drawBack(ctx, b, env) {
      if (b >= T_FLOWER[0] && b < T_FLOWER[1]) {
        drawShoujo(ctx, b);
        return;
      }
      const cam = env.cam, cg = env.camAt(GAG);
      const X = (gx) => gx + cg - cam;
      ctx.fillStyle = PAPER2;
      ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 1e3);
      ctx.drawImage(skyLayer(), X_MIN, 0, X_MAX - X_MIN, 330);
      drawStrip(ctx, cloudLayer(), cam);
      drawStrip(ctx, farLayer(), cam);
      drawStrip(ctx, midLayer(), cam);
      drawStrip(ctx, groundLayer(), cam);
      const vis = (x, w) => x > X_MIN - w && x < X_MAX + w;
      if (vis(X(GX.mirror), 120)) drawSprite(ctx, mirrorSprite(), X(GX.mirror), BASE);
      if (vis(X(GX.kiosk), 280)) drawSprite(ctx, kioskSprite(), X(GX.kiosk), BASE);
      const vx = X(GX.vm);
      if (vis(vx, 200)) {
        const sh = b >= T_CAN && b < T_CAN + 0.3 ? Math.sin((b - T_CAN) * 60) * 3 * (1 - (b - T_CAN) / 0.3) : 0;
        drawSprite(ctx, vmSprite(), vx + sh, BASE);
        if (b >= T_CAN) {
          const cx = vx + sh + SLOT.x + 40, cy = BASE + SLOT.y + SLOT.h - 12;
          const drop = ease.in(clamp((b - T_CAN) / 0.08));
          const can = new Path2D();
          can.roundRect ? can.roundRect(cx - 26, cy - 11 - (1 - drop) * 20, 52, 22, 6) : can.rect(cx - 26, cy - 11, 52, 22);
          inked(ctx, can, { w: 1.6 });
          ctx.save();
          ctx.clip(can);
          ctx.fillStyle = tone(ctx, 0.45);
          ctx.fillRect(cx - 8, cy - 40, 16, 60);
          ctx.restore();
          const k = 1 - smoothstep(T_CAN + 0.25, T_CAN + 0.7, b);
          if (k > 0) {
            ctx.save();
            ctx.globalAlpha *= k;
            pen(ctx, 2.4);
            const sx0 = vx + sh + SLOT.x, sy0 = BASE + SLOT.y;
            for (const [ax, ay, dx, dy] of [[-6, 10, -26, -8], [-6, 26, -30, 4], [-2, 44, -24, 18], [SLOT.w + 6, 10, 26, -8], [SLOT.w + 6, 26, 30, 4], [SLOT.w + 2, 44, 24, 18]]) {
              seg(ctx, sx0 + ax, sy0 + ay, sx0 + ax + dx, sy0 + ay + dy);
            }
            ctx.restore();
          }
        }
        cat(ctx, vx + sh - 34, BASE - 444, b >= T_CAT && b < T_OUT2 + 1.5);
      }
      if (vis(X(GX.tree), 360)) drawSprite(ctx, treeSprite(), X(GX.tree), BASE);
      if (vis(X(GX.bike), 200)) drawSprite(ctx, bikeSprite(), X(GX.bike), BASE + 6);
      const poles = [GX.poleA, GX.poleB, GX.poleC].map(X);
      for (let i = 0; i + 1 < poles.length; i++) {
        const a = poles[i], c = poles[i + 1];
        if (c < X_MIN - 200 || a > X_MAX + 200) continue;
        WIRE.forEach(([dx, dy], k) => {
          pen(ctx, k < 3 ? 1.8 : 1.3);
          const y = BASE + dy - 10, sag = 70 + k * 12;
          ctx.beginPath();
          ctx.moveTo(a + dx, y);
          ctx.quadraticCurveTo((a + c) / 2 + dx, y + sag * 2, c + dx, y);
          ctx.stroke();
        });
      }
      for (const x of poles) if (vis(x, 150)) drawSprite(ctx, poleSprite(), x, BASE);
      drawPetals(ctx, b, X(GX.tree));
    },
    drawFront(ctx, b, env) {
      focusLines(ctx, b);
      if (b >= T_FLOWER[1] && b < T_FLOWER[1] + 2.6) {
        const t = (b - T_FLOWER[1]) / 2.6;
        petal(ctx, lerp(CHAR_X + 170, CHAR_X - 150, t) + Math.sin(t * TAU * 1.2) * 34, lerp(240, 700, t), 2.6, t * 7, 1.6);
      }
      sweat(ctx, env.figure(), b);
      for (const P2 of PANELS) drawPanel(ctx, P2, b);
      pageBorder(ctx);
    },
    drawFrame(ctx, R) {
      const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
      ctx.save();
      pen(ctx, 1);
      for (let i = 0; i < 18; i++) {
        const yy = y - t + (h + 2 * t) * hash2(i, 1, 11), L = (90 + 260 * hash2(i, 2, 11)) * s, x0 = x + w + t + (20 + 40 * hash2(i, 3, 11)) * s;
        ctx.lineWidth = Math.max(1, (1.5 + 3.5 * hash2(i, 4, 11)) * s);
        seg(ctx, x0, yy, x0 + L, yy);
      }
      const o = 16 * s, S = Math.max(4, Math.round(9 * s));
      const sh = new Path2D();
      sh.rect(x - t + o, y - t + o, w + 2 * t, h + 2 * t);
      sh.rect(x - t, y - t, w + 2 * t, h + 2 * t);
      ctx.fillStyle = tone(ctx, 0.55, { S });
      ctx.fill(sh, "evenodd");
      const band = new Path2D();
      band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
      band.rect(x, y, w, h);
      ctx.fillStyle = PAPER2;
      ctx.fill(band, "evenodd");
      pen(ctx, Math.max(1, 3 * s));
      ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
      pen(ctx, Math.max(1.5, 7 * s));
      ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
      ctx.fillStyle = tone(ctx, 0.4, { S });
      ctx.fillRect(x - t * 0.7, y - t * 0.7, t * 0.4, t * 0.4);
      ctx.fillRect(x + w + t * 0.3, y + h + t * 0.3, t * 0.4, t * 0.4);
      ctx.restore();
    },
    cardStyle: {
      ink: INK2,
      accent: INK2,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        ctx.save();
        ctx.fillStyle = INK2;
        ctx.fillRect(x + 10, y + 10, w, h);
        ctx.fillStyle = PAPER2;
        ctx.fillRect(x, y, w, h);
        ctx.beginPath();
        ctx.rect(x + 16, y + 18, 16, h - 36);
        ctx.save();
        ctx.clip();
        toneGrad(ctx, x + 12, y + 14, x + 36, y + h - 14, (xx, yy) => 0.15 + 0.6 * (yy - y) / h, { S: 7 });
        ctx.restore();
        pen(ctx, 1.5);
        ctx.strokeRect(x + 16, y + 18, 16, h - 36);
        pen(ctx, 5);
        ctx.strokeRect(x, y, w, h);
        pen(ctx, 1.4);
        for (let i = 0; i < 5; i++) seg(ctx, x + w - 70 + i * 4, y + 14 + i * 7, x + w - 14, y + 14 + i * 7);
        ctx.restore();
      }
    },
    playerStyle: {
      plate: PAPER2,
      ink: INK2,
      noteColor: INK2,
      backdrop: false,
      family: SANS,
      plateDraw(ctx, x, y, w, h) {
        const tail = new Path2D();
        tail.moveTo(x + w - 46, y + h - 14);
        tail.lineTo(x + w + 34, y + h + 12);
        tail.lineTo(x + w - 20, y + h - 34);
        tail.closePath();
        const bub = new Path2D();
        bub.roundRect ? bub.roundRect(x, y, w, h, h / 2) : bub.rect(x, y, w, h);
        pen(ctx, 8);
        ctx.stroke(tail);
        ctx.stroke(bub);
        ctx.fillStyle = PAPER2;
        ctx.fill(tail);
        ctx.fill(bub);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        const w = 200 * s, h = 128 * s;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.fillStyle = INK2;
        roundRect(ctx, -w / 2 + 9, -h / 2 + 9, w, h, 10 * s);
        ctx.fill();
        roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
        ctx.fillStyle = PAPER2;
        ctx.fill();
        pen(ctx, 3.5 * s);
        ctx.stroke();
        roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 12 * s, w - 28 * s, 66 * s, 5 * s);
        ctx.save();
        ctx.clip();
        toneGrad(ctx, -w / 2, -h / 2, w / 2, 20 * s, (x) => 0.05 + 0.4 * clamp((x + w / 2) / w), { S: 6 });
        ctx.restore();
        pen(ctx, 2.2 * s);
        ctx.stroke();
        ctx.fillStyle = INK2;
        ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 22 * s, w - 28 * s, 6 * s);
        roundRect(ctx, -52 * s, -h / 2 + 34 * s, 104 * s, 34 * s, 16 * s);
        ctx.fillStyle = INK2;
        ctx.fill();
        for (const sx of [-1, 1]) {
          const rx = sx * 34 * s, ry = -h / 2 + 51 * s;
          ctx.fillStyle = PAPER2;
          circle(ctx, rx, ry, 10 * s);
          ctx.fill();
          pen(ctx, 1.6 * s);
          ctx.stroke();
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(spin * (sx < 0 ? 1 : 1.3));
          ctx.fillStyle = INK2;
          for (let i = 0; i < 6; i++) {
            ctx.rotate(TAU / 6);
            ctx.fillRect(-1.4 * s, -9 * s, 2.8 * s, 4.5 * s);
          }
          pen(ctx, 1.6 * s, PAPER2);
          ctx.beginPath();
          ctx.arc(0, 0, 14 * s, 0, 1.1);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(0, 0, 14 * s, Math.PI, Math.PI + 1.1);
          ctx.stroke();
          ctx.restore();
        }
        ctx.beginPath();
        ctx.moveTo(-60 * s, h / 2);
        ctx.lineTo(-48 * s, h / 2 - 30 * s);
        ctx.lineTo(48 * s, h / 2 - 30 * s);
        ctx.lineTo(60 * s, h / 2);
        ctx.closePath();
        ctx.fillStyle = tone(ctx, 0.3, { S: 6 });
        ctx.fill();
        pen(ctx, 2.4 * s);
        ctx.stroke();
        ctx.fillStyle = INK2;
        for (const sx of [-1, 1]) {
          circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s);
          ctx.fill();
        }
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
          circle(ctx, sx * (w / 2 - 8 * s), sy * (h / 2 - 8 * s), 2.6 * s);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  };

  // src/main/frame.js
  function drawDefaultFrame(ctx, rect, s, o = {}) {
    const { gold = "#c9a24a", dark = "#5e4520", light = "#f3dc8e" } = o;
    const t = 64 * s;
    const { x, y, w, h } = rect;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    const outer = [x - t, y - t, w + 2 * t, h + 2 * t];
    const sides = [
      { pts: [[x - t, y - t], [x + w + t, y - t], [x + w, y], [x, y]], c: light },
      { pts: [[x + w + t, y - t], [x + w + t, y + h + t], [x + w, y + h], [x + w, y]], c: gold },
      { pts: [[x + w + t, y + h + t], [x - t, y + h + t], [x, y + h], [x + w, y + h]], c: dark },
      { pts: [[x - t, y + h + t], [x - t, y - t], [x, y], [x, y + h]], c: mix(gold, light, 0.4) }
    ];
    for (const sd of sides) {
      ctx.beginPath();
      sd.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
      ctx.closePath();
      ctx.fillStyle = sd.c;
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(70,45,10,0.55)";
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.strokeRect(x - t * 0.62, y - t * 0.62, w + t * 1.24, h + t * 1.24);
    ctx.strokeStyle = "rgba(255,240,190,0.6)";
    ctx.strokeRect(x - t * 0.3, y - t * 0.3, w + t * 0.6, h + t * 0.6);
    ctx.lineWidth = Math.max(1, 5 * s);
    ctx.strokeStyle = dark;
    ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
    ctx.strokeStyle = "rgba(40,25,5,0.8)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeRect(...outer);
    ctx.fillStyle = light;
    for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) {
      ctx.beginPath();
      ctx.arc(cx, cy, t * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = dark;
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.stroke();
    }
    ctx.restore();
  }

  // src/scenes/s02.js
  var ST2 = stationByN(2);
  var SAND = "#e7d3a8";
  var OCHRE = "#c49a5c";
  var BROWN = "#4a3320";
  var LAPIS = "#2f6fb0";
  var LAPIS_D = "#1d4580";
  var LAPIS_DD = "#13305c";
  var GOLD = "#e2b850";
  var CREAM = "#f4e6c4";
  var CLAY = "#d6b07a";
  var WALL_TOP = 330;
  var BAND1 = [346, 372];
  var LIONS = [384, 520];
  var BAND2 = [530, 554];
  var RELIEF = [566, 772];
  var PLINTH = 772;
  var P_WALL = 0.85;
  var P_FAR = 0.22;
  var P_FG = 1.3;
  function farLayer2() {
    return strip("s02-far", P_FAR, (ctx, x0, x1) => {
      const R = rng("s02-far");
      const c1 = mix(SAND, OCHRE, 0.5), c2 = mix(OCHRE, BROWN, 0.25);
      ctx.fillStyle = mix(SAND, OCHRE, 0.35);
      ctx.fillRect(x0, 300, x1 - x0, 60);
      for (let x = x0; x < x1; x += 34) ctx.fillRect(x, 288, 20, 14);
      for (let zx = x0 + 120; zx < x1; zx += 760 + R() * 300) {
        const w = 260 + R() * 80, steps = 5;
        for (let i = 0; i < steps; i++) {
          const ww = w * (1 - i * 0.17), hh = 34;
          const yb = 330 - i * hh;
          ctx.fillStyle = i % 2 ? c1 : mix(c1, c2, 0.4);
          ctx.fillRect(zx - ww / 2, yb - hh, ww, hh);
          ctx.fillStyle = rgba(BROWN, 0.18);
          ctx.fillRect(zx + ww / 2 - ww * 0.22, yb - hh, ww * 0.22, hh);
        }
        ctx.fillStyle = mix(c1, "#ffffff", 0.15);
        poly(ctx, [[zx - 16, 330], [zx + 16, 330], [zx + 8, 330 - steps * 34], [zx - 8, 330 - steps * 34]]);
        ctx.fill();
      }
      for (let px = x0 + 40; px < x1; px += 140 + R() * 220) {
        const h = 90 + R() * 70, lean = (R() - 0.5) * 18;
        ctx.strokeStyle = c2;
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(px, 340);
        ctx.quadraticCurveTo(px + lean * 0.3, 340 - h / 2, px + lean, 340 - h);
        ctx.stroke();
        ctx.fillStyle = c2;
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * 0.48;
          const L = 40 + R() * 16;
          const tx = px + lean, ty = 340 - h;
          smoothPath(ctx, [[tx, ty], [tx + Math.cos(a - 0.25) * L * 0.6, ty + Math.sin(a - 0.25) * L * 0.6 - 4], [tx + Math.cos(a) * L, ty + Math.sin(a) * L + 10], [tx + Math.cos(a + 0.15) * L * 0.6, ty + Math.sin(a + 0.15) * L * 0.6 + 4]], true);
          ctx.fill();
        }
      }
    }, { y0: 150, y1: 380 });
  }
  function rosette(ctx, x, y, r, petal2, center) {
    ctx.fillStyle = petal2;
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      ellipse(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.22, a);
      ctx.fill();
    }
    circle(ctx, x, y, r * 0.3);
    ctx.fillStyle = center;
    ctx.fill();
  }
  function lion(ctx, x, y, s, R) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const body = [[-80, -40], [-40, -58], [20, -56], [52, -66], [74, -60], [92, -44], [96, -28], [80, -22], [62, -26], [58, -8], [62, 30], [50, 34], [44, 2], [10, 4], [-20, 2], [-30, 34], [-44, 34], [-42, 0], [-70, -4], [-92, -20], [-112, -46], [-104, -50], [-84, -32]];
    const draw = (dx, dy, col) => {
      ctx.save();
      ctx.translate(dx, dy);
      smoothPath(ctx, body, true);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.restore();
    };
    draw(3, 4, rgba("#0b1f3f", 0.55));
    draw(0, 0, GOLD);
    ctx.fillStyle = "#c9742c";
    smoothPath(ctx, [[30, -58], [52, -70], [74, -64], [80, -40], [70, -20], [52, -16], [36, -30]], true);
    ctx.fill();
    ctx.strokeStyle = rgba("#7a3f12", 0.8);
    ctx.lineWidth = 2;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(40 + k * 6, -56 + k * 2);
      ctx.quadraticCurveTo(46 + k * 6, -40, 40 + k * 7, -24);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(CREAM, 0.7);
    smoothPath(ctx, [[-40, -8], [10, -6], [40, -10], [10, 2], [-30, 0]], true);
    ctx.fill();
    ctx.strokeStyle = "#3d2410";
    ctx.lineWidth = 2.6;
    smoothPath(ctx, body, true);
    ctx.stroke();
    ctx.fillStyle = "#3d2410";
    circle(ctx, 82, -46, 3);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(96, -30);
    ctx.lineTo(84, -32);
    ctx.stroke();
    ctx.restore();
  }
  function wallLayer() {
    return strip("s02-wall", P_WALL, (ctx, x0, x1) => {
      const R = rng("s02-wall");
      ctx.fillStyle = LAPIS_D;
      ctx.fillRect(x0, WALL_TOP, x1 - x0, PLINTH - WALL_TOP + 30);
      const bw = 46, bh = 22;
      for (let row = 0, y = WALL_TOP; y < PLINTH; row++, y += bh) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = x0 - bw + off; x < x1; x += bw) {
          const t = hash2(Math.round(x), row, 4);
          const base = t < 0.33 ? LAPIS : t < 0.75 ? mix(LAPIS, LAPIS_D, 0.45) : mix(LAPIS, "#5b8fd0", 0.35);
          ctx.fillStyle = base;
          ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
          ctx.fillStyle = rgba("#cfe2ff", 0.18 + 0.12 * hash2(Math.round(x), row, 5));
          ctx.fillRect(x + 3, y + 3, bw - 10, 2.5);
          if (hash2(Math.round(x), row, 6) > 0.8) {
            ctx.fillStyle = rgba("#0c2347", 0.25);
            ctx.fillRect(x + 6 + hash2(row, Math.round(x), 7) * 20, y + 8, 10, 6);
          }
        }
      }
      for (let x = x0; x < x1; x += 72) {
        ctx.fillStyle = LAPIS_D;
        poly(ctx, [
          [x + 6, WALL_TOP],
          [x + 6, WALL_TOP - 16],
          [x + 14, WALL_TOP - 16],
          [x + 14, WALL_TOP - 32],
          [x + 22, WALL_TOP - 32],
          [x + 22, WALL_TOP - 46],
          [x + 46, WALL_TOP - 46],
          [x + 46, WALL_TOP - 32],
          [x + 54, WALL_TOP - 32],
          [x + 54, WALL_TOP - 16],
          [x + 62, WALL_TOP - 16],
          [x + 62, WALL_TOP]
        ]);
        ctx.fill();
        ctx.fillStyle = rgba("#cfe2ff", 0.22);
        ctx.fillRect(x + 22, WALL_TOP - 46, 24, 3);
        ctx.fillRect(x + 6, WALL_TOP - 16, 8, 3);
      }
      for (const [a, b] of [BAND1, BAND2]) {
        ctx.fillStyle = LAPIS_DD;
        ctx.fillRect(x0, a, x1 - x0, b - a);
        ctx.fillStyle = GOLD;
        ctx.fillRect(x0, a, x1 - x0, 3);
        ctx.fillRect(x0, b - 3, x1 - x0, 3);
        for (let x = x0 + 20; x < x1; x += 40) rosette(ctx, x, (a + b) / 2, 10, CREAM, GOLD);
      }
      for (let x = x0 + 150; x < x1; x += 330) lion(ctx, x, LIONS[1] - 34, 0.9 + R() * 0.04, R);
      ctx.fillStyle = mix(BROWN, OCHRE, 0.3);
      ctx.fillRect(x0, PLINTH, x1 - x0, 30);
      ctx.fillStyle = rgba("#000000", 0.18);
      ctx.fillRect(x0, PLINTH, x1 - x0, 5);
    }, { y0: 270, y1: 810 });
  }
  var FIG_GAP = 210;
  var OFFERINGS = ["jar", "lyre", "basket", "branch"];
  function reliefFigure(ctx, x, pose, item, frontal = false) {
    const base = RELIEF[1] - 6, H2 = 186;
    const top = base - H2;
    ctx.save();
    ctx.translate(x, 0);
    const shade2 = (path, dx = 2.5, dy = 3) => {
      ctx.save();
      ctx.translate(dx, dy);
      ctx.fillStyle = rgba("#6b4a2b", 0.45);
      ctx.fill(path);
      ctx.restore();
      ctx.fillStyle = mix(SAND, "#f6e9cc", 0.25);
      ctx.fill(path);
      ctx.strokeStyle = rgba("#7a5a34", 0.9);
      ctx.lineWidth = 1.6;
      ctx.stroke(path);
    };
    const stride = pose ? 26 : 12;
    const legs = new Path2D();
    legs.moveTo(-6, base - 46);
    legs.lineTo(-6 - stride, base - 4);
    legs.lineTo(-6 - stride + 16, base - 4);
    legs.lineTo(2, base - 46);
    legs.moveTo(6, base - 46);
    legs.lineTo(10 + stride, base - 4);
    legs.lineTo(26 + stride, base - 4);
    legs.lineTo(16, base - 46);
    shade2(legs);
    const robe = new Path2D();
    robe.moveTo(-22, top + 66);
    robe.lineTo(24, top + 64);
    robe.lineTo(30 + stride * 0.3, base - 40);
    robe.lineTo(-26 - stride * 0.3, base - 40);
    robe.closePath();
    shade2(robe);
    ctx.strokeStyle = rgba("#7a5a34", 0.8);
    ctx.lineWidth = 1.2;
    for (let k = -24; k <= 28; k += 5) {
      ctx.beginPath();
      ctx.moveTo(k, base - 42);
      ctx.lineTo(k + 1, base - 34);
      ctx.stroke();
    }
    const armB = new Path2D();
    armB.rect(-18, top + 70, 10, 52);
    shade2(armB);
    const head = new Path2D();
    if (!frontal) {
      head.moveTo(-14, top + 22);
      head.lineTo(-14, top + 50);
      head.lineTo(-2, top + 60);
      head.lineTo(14, top + 52);
      head.lineTo(18, top + 40);
      head.lineTo(22, top + 36);
      head.lineTo(16, top + 30);
      head.lineTo(14, top + 18);
      head.closePath();
    } else {
      head.ellipse(0, top + 40, 17, 22, 0, 0, Math.PI * 2);
    }
    shade2(head);
    const hat = new Path2D();
    hat.rect(-16, top + 2, 30, 20);
    shade2(hat);
    ctx.strokeStyle = rgba("#7a5a34", 0.8);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(-16, top + 7 + k * 5);
      ctx.lineTo(14, top + 7 + k * 5);
      ctx.stroke();
    }
    const beard = new Path2D();
    if (!frontal) {
      beard.moveTo(-4, top + 50);
      beard.lineTo(14, top + 50);
      beard.lineTo(10, top + 74);
      beard.lineTo(-6, top + 72);
      beard.closePath();
    } else {
      beard.moveTo(-14, top + 50);
      beard.lineTo(14, top + 50);
      beard.lineTo(8, top + 76);
      beard.lineTo(-8, top + 76);
      beard.closePath();
    }
    shade2(beard);
    ctx.strokeStyle = rgba("#7a5a34", 0.7);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(frontal ? -10 : -2, top + 56 + k * 6);
      ctx.lineTo(frontal ? 10 : 12, top + 56 + k * 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#5a3b1c";
    if (!frontal) {
      ellipse(ctx, 8, top + 34, 4.5, 2.2);
      ctx.fill();
    } else {
      for (const ex of [-7, 7]) {
        ellipse(ctx, ex, top + 36, 5, 3);
        ctx.fillStyle = "#fbf1da";
        ctx.fill();
        ctx.strokeStyle = "#5a3b1c";
        ctx.lineWidth = 1.2;
        ctx.stroke();
        circle(ctx, ex - 2.5, top + 36, 1.8);
        ctx.fillStyle = "#5a3b1c";
        ctx.fill();
      }
    }
    const armF = new Path2D();
    armF.moveTo(10, top + 72);
    armF.lineTo(36, top + 92);
    armF.lineTo(32, top + 100);
    armF.lineTo(6, top + 84);
    armF.closePath();
    shade2(armF);
    const off = new Path2D();
    if (item === "jar") {
      off.ellipse(42, top + 86, 12, 15, 0, 0, Math.PI * 2);
      off.rect(36, top + 66, 12, 8);
    } else if (item === "lyre") {
      off.moveTo(34, top + 104);
      off.lineTo(30, top + 60);
      off.lineTo(36, top + 60);
      off.lineTo(40, top + 98);
      off.lineTo(56, top + 98);
      off.lineTo(60, top + 58);
      off.lineTo(66, top + 58);
      off.lineTo(62, top + 104);
      off.closePath();
    } else if (item === "basket") {
      off.moveTo(30, top + 82);
      off.lineTo(60, top + 82);
      off.lineTo(54, top + 100);
      off.lineTo(36, top + 100);
      off.closePath();
    } else {
      off.moveTo(36, top + 96);
      off.lineTo(46, top + 40);
      off.lineTo(52, top + 42);
      off.lineTo(42, top + 96);
      off.closePath();
      off.ellipse(52, top + 46, 10, 6, -0.6, 0, Math.PI * 2);
      off.ellipse(46, top + 60, 10, 6, 0.6, 0, Math.PI * 2);
    }
    shade2(off);
    ctx.restore();
  }
  function reliefLayer(pose) {
    return strip(`s02-relief-${pose}`, P_WALL, (ctx, x0, x1) => {
      const g = ctx.createLinearGradient(0, RELIEF[0], 0, RELIEF[1]);
      g.addColorStop(0, mix(SAND, OCHRE, 0.25));
      g.addColorStop(1, mix(SAND, OCHRE, 0.5));
      ctx.fillStyle = g;
      ctx.fillRect(x0, RELIEF[0], x1 - x0, RELIEF[1] - RELIEF[0]);
      ctx.strokeStyle = rgba("#8a6a3f", 0.18);
      ctx.lineWidth = 1;
      for (let y = RELIEF[0] + 4; y < RELIEF[1]; y += 5) {
        ctx.beginPath();
        for (let x = x0; x < x1; x += 40) {
          const yy = y + (noise2(x * 0.01, y * 0.1, 3) - 0.5) * 3;
          x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = rgba("#6b4a2b", 0.35);
      ctx.fillRect(x0, RELIEF[0], x1 - x0, 4);
      ctx.fillStyle = rgba("#fff3d6", 0.35);
      ctx.fillRect(x0, RELIEF[1] - 4, x1 - x0, 4);
      let i = 0;
      for (let x = x0 + 60; x < x1; x += FIG_GAP, i++) reliefFigure(ctx, x, (pose + i) % 2, OFFERINGS[i % OFFERINGS.length]);
    }, { y0: RELIEF[0] - 4, y1: RELIEF[1] + 4 });
  }
  function roadLayer() {
    return strip("s02-road", 1, (ctx, x0, x1) => {
      const R = rng("s02-road");
      ctx.fillStyle = mix(SAND, "#ffffff", 0.12);
      ctx.fillRect(x0, ROAD_Y, x1 - x0, 1e3 - ROAD_Y);
      ctx.fillStyle = mix(OCHRE, BROWN, 0.35);
      ctx.fillRect(x0, ROAD_Y, x1 - x0, 12);
      const rows = [[812, 846], [846, 896], [896, 964], [964, 1e3]];
      rows.forEach(([a, b], r) => {
        let x = x0 - R() * 120;
        while (x < x1) {
          const w = 110 + (b - a) * 2.2 + R() * 90;
          const t = R();
          ctx.fillStyle = mix(mix(SAND, "#f6ead1", 0.4), OCHRE, 0.12 + t * 0.2);
          ctx.fillRect(x + 2, a + 2, w - 4, b - a - 4);
          ctx.fillStyle = rgba("#fff8e8", 0.35);
          ctx.fillRect(x + 4, a + 3, w - 10, 2);
          if (R() > 0.6) {
            ctx.fillStyle = rgba(BROWN, 0.08);
            ellipse(ctx, x + R() * w, a + (b - a) * R(), 14 + R() * 20, 4 + R() * 5);
            ctx.fill();
          }
          ctx.fillStyle = rgba(BROWN, 0.45);
          ctx.fillRect(x, a, 2.5, b - a);
          x += w;
        }
        ctx.fillStyle = rgba(BROWN, 0.35);
        ctx.fillRect(x0, b - 1.5, x1 - x0, 2.5);
      });
    }, { y0: ROAD_Y - 2, y1: 1e3 });
  }
  var glanceIndex = (env) => {
    const cam = env.camAt(GAG);
    const want = 560 + cam * P_WALL;
    const [x0] = stripRange(P_WALL);
    const i = Math.round((want - (x0 + 60)) / FIG_GAP);
    return { i, x: x0 + 60 + i * FIG_GAP };
  };
  var s02 = {
    id: "s02",
    station: ST2,
    // 沙色人物贴在沙色浮雕上：加一圈深褐色描边（像浮雕的阴刻线），保证反差
    figureRim: { color: "#3d2712", width: 4, alpha: 0.9 },
    figureAdjust(b) {
      const E = GAG + 4;
      if (b >= E - 0.3 && b < E) return { pose: "stand", sx: lerp(1, 0.12, ease.inOut((b - (E - 0.3)) / 0.3)) };
      if (b >= E && b < E + 0.15) return { sx: lerp(1.12, 1, (b - E) / 0.15) };
      return null;
    },
    drawBack(ctx, b, env) {
      const cam = env.cam;
      const g = ctx.createLinearGradient(0, 0, 0, 380);
      g.addColorStop(0, "#c99a62");
      g.addColorStop(0.55, "#e9c58c");
      g.addColorStop(1, "#f6e2b6");
      ctx.fillStyle = g;
      ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 380);
      const sx = 980 - cam * 0.03;
      const sg = ctx.createRadialGradient(sx, 210, 10, sx, 210, 230);
      sg.addColorStop(0, rgba("#fff4d6", 0.95));
      sg.addColorStop(0.25, rgba("#fbe6b5", 0.6));
      sg.addColorStop(1, rgba("#fbe6b5", 0));
      ctx.fillStyle = sg;
      ctx.fillRect(sx - 240, 0, 480, 400);
      circle(ctx, sx, 210, 62);
      ctx.fillStyle = "#fbeccb";
      ctx.fill();
      for (let k2 = 0; k2 < 5; k2++) {
        const cx = ((k2 * 620 - cam * 0.08) % 2600 + 2600) % 2600 + X_MIN - 300, cy = 90 + k2 * 37, L = 220 + k2 * 40;
        for (let j = 0; j < 4; j++) {
          const ex = cx + j * L * 0.28, ew = L * (0.35 + 0.1 * (j % 2)), eh = 7 + j % 3 * 3;
          const cg = ctx.createRadialGradient(ex, cy, 1, ex, cy, ew);
          cg.addColorStop(0, rgba("#fff3dc", 0.5));
          cg.addColorStop(1, rgba("#fff3dc", 0));
          ctx.fillStyle = cg;
          ctx.save();
          ctx.translate(ex, cy);
          ctx.scale(1, eh / ew);
          ctx.translate(-ex, -cy);
          circle(ctx, ex, cy, ew);
          ctx.fill();
          ctx.restore();
        }
      }
      drawStrip(ctx, farLayer2(), cam);
      drawStrip(ctx, wallLayer(), cam);
      const pose = Math.floor(env.gb + 1e-6) % 2;
      drawStrip(ctx, reliefLayer(pose), cam);
      const k = smoothstep(GAG + 0.8, GAG + 1, b) * (1 - smoothstep(GAG + 3.4, GAG + 3.6, b));
      if (k > 0.5) {
        const { i, x } = glanceIndex(env);
        const sxp = x - cam * P_WALL;
        ctx.save();
        ctx.beginPath();
        ctx.rect(sxp - 30, RELIEF[0] + 4, 64, 92);
        ctx.clip();
        ctx.fillStyle = mix(SAND, OCHRE, 0.3);
        ctx.fillRect(sxp - 30, RELIEF[0] + 4, 64, 92);
        reliefFigure(ctx, sxp, (pose + i) % 2, OFFERINGS[(i % 4 + 4) % 4], true);
        ctx.restore();
      }
      drawStrip(ctx, roadLayer(), cam);
      ctx.fillStyle = rgba("#fff3d0", 0.5);
      for (let k2 = 0; k2 < 26; k2++) {
        const px = ((hash2(k2, 1, 2) * 2200 - cam * 0.9 + b * 18 * (0.5 + hash2(k2, 2, 2))) % 2200 + 2200) % 2200 + X_MIN;
        const py = 380 + hash2(k2, 3, 2) * 380 + Math.sin(b * 1.3 + k2) * 10;
        circle(ctx, px, py, 1.2 + hash2(k2, 4, 2) * 1.6);
        ctx.fill();
      }
    },
    drawFront(ctx, b, env) {
      const cam = env.cam, c4 = env.camAt(GAG);
      const items = [[-260, "jar"], [1240, "frond"], [2100, "jar"]];
      for (const [sx0, kind] of items) {
        const x = sx0 + c4 * P_FG - cam * P_FG;
        if (x < X_MIN - 200 || x > X_MAX + 200) continue;
        if (kind === "jar") {
          ctx.fillStyle = rgba("#000", 0.25);
          ellipse(ctx, x + 10, 992, 90, 14);
          ctx.fill();
          smoothPath(ctx, [[x - 40, 860], [x - 70, 910], [x - 66, 970], [x - 30, 996], [x + 30, 996], [x + 66, 970], [x + 70, 910], [x + 40, 860]], true);
          const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
          g.addColorStop(0, "#8a4f24");
          g.addColorStop(0.4, "#c77a3a");
          g.addColorStop(1, "#5e3418");
          ctx.fillStyle = g;
          ctx.fill();
          ctx.fillStyle = "#6e3c19";
          ctx.fillRect(x - 34, 846, 68, 16);
          ctx.strokeStyle = rgba(CREAM, 0.6);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x - 64, 930);
          ctx.lineTo(x + 64, 930);
          ctx.stroke();
        } else {
          ctx.fillStyle = "#5c6b2e";
          for (let k = 0; k < 6; k++) {
            const a = -2.3 + k * 0.32;
            smoothPath(ctx, [[x, 1010], [x + Math.cos(a) * 160, 1010 + Math.sin(a) * 240], [x + Math.cos(a + 0.06) * 300, 1010 + Math.sin(a + 0.06) * 330], [x + Math.cos(a + 0.12) * 160, 1010 + Math.sin(a + 0.12) * 240]], true);
            ctx.fill();
          }
        }
      }
    },
    drawFrame(ctx, R, env) {
      drawDefaultFrame(ctx, R, R.s, { gold: "#c9a06a", dark: "#5e4022", light: "#efd8a8" });
    },
    cardStyle: {
      ink: BROWN,
      accent: LAPIS,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        ctx.save();
        ctx.shadowColor = "rgba(40,20,0,0.35)";
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        roundRect(ctx, x, y, w, h, 26);
        const g = ctx.createLinearGradient(x, y, x, y + h);
        g.addColorStop(0, "#e2c08b");
        g.addColorStop(1, CLAY);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.shadowColor = "transparent";
        ctx.strokeStyle = rgba(BROWN, 0.5);
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = rgba(BROWN, 0.55);
        const wedge = (wx, wy, r) => {
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + 9, wy - 3 + r);
          ctx.lineTo(wx + 9, wy + 3 + r);
          ctx.closePath();
          ctx.fill();
        };
        for (let wx = x + 22; wx < x + w - 22; wx += 15) {
          wedge(wx, y + 14, wx * 7 % 3 - 1);
          wedge(wx, y + h - 14, wx * 5 % 3 - 1);
        }
        ctx.fillStyle = LAPIS;
        ctx.fillRect(x + 22, y + 30, 6, h - 60);
        ctx.restore();
      }
    },
    playerStyle: {
      plate: CLAY,
      ink: BROWN,
      noteColor: LAPIS,
      palette: { body: "#d8b47e", label: CREAM, window: LAPIS_D, accent: LAPIS, tape: "#6b4a2b", ink: BROWN }
    }
  };

  // src/kit/ink.js
  var INK3 = {
    paper: "#f4efe2",
    // 宣纸
    jiao: "#1b1a17",
    // 焦墨
    nong: "#33312c",
    // 浓墨
    zhong: "#6f6c64",
    // 中（重）墨
    dan: "#a9a598",
    // 淡墨
    qing: "#d3cfc3",
    // 清墨
    huaqing: "#7d9aa3",
    // 花青
    zheshi: "#d2b48c",
    // 淡赭石
    seal: "#b8402e"
    // 印章红（朱砂）
  };
  function xuanPaper(w, h, { base = INK3.paper, seed = 3, amount = 1 } = {}) {
    w = Math.round(w);
    h = Math.round(h);
    return baked(`xuan|${w}|${h}|${base}|${seed}|${amount}`, w, h, (ctx) => {
      const [r0, g0, b0] = hexToRgb(base);
      const sw = Math.ceil(w / 10), sh = Math.ceil(h / 10);
      const small = makeCanvas(sw, sh);
      const sctx = small.getContext("2d");
      const img = sctx.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const n = fbm(x / 18, y / 18, seed, 4) - 0.5;
        const m = fbm(x / 4.5, y / 4.5, seed + 9, 2) - 0.5;
        const k = 1 + (n * 0.055 + m * 0.025) * amount;
        const i = (y * sw + x) * 4;
        img.data[i] = r0 * k;
        img.data[i + 1] = g0 * k;
        img.data[i + 2] = b0 * (k - 4e-3);
        img.data[i + 3] = 255;
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(small, 0, 0, w, h);
      const T = 192;
      const tile2 = makeCanvas(T, T);
      const tctx = tile2.getContext("2d");
      const ti = tctx.createImageData(T, T);
      const R = rng("xuan-grain", seed);
      for (let i = 0; i < T * T; i++) {
        const v = R() < 0.55 ? 255 : 120;
        ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = v;
        ti.data[i * 4 + 3] = R() * 12 * amount;
      }
      tctx.putImageData(ti, 0, 0);
      ctx.fillStyle = ctx.createPattern(tile2, "repeat");
      ctx.fillRect(0, 0, w, h);
      const F = rng("xuan-fiber", seed);
      ctx.lineCap = "round";
      const nF = Math.round(w * h / 9e3 * amount);
      for (let i = 0; i < nF; i++) {
        const x = F() * w, y = F() * h, a = F() * Math.PI * 2, L = 14 + F() * 60;
        const bend = (F() - 0.5) * L * 0.6;
        ctx.strokeStyle = F() < 0.6 ? "rgba(120,100,70,0.06)" : "rgba(255,255,250,0.22)";
        ctx.lineWidth = 0.5 + F() * 0.7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * L * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L);
        ctx.stroke();
      }
      const nS = Math.round(w * h / 6e4 * amount);
      for (let i = 0; i < nS; i++) {
        ctx.fillStyle = `rgba(90,75,50,${0.08 + F() * 0.12})`;
        ctx.beginPath();
        ctx.ellipse(F() * w, F() * h, 0.6 + F() * 1.4, 0.4 + F() * 0.8, F() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
  function resample(pts, d = 3) {
    const out = [pts[0]];
    let carry = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const L = Math.hypot(bx - ax, by - ay);
      let s = d - carry;
      while (s <= L) {
        const t = s / L;
        out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
        s += d;
      }
      carry = L - (s - d);
    }
    const last = pts[pts.length - 1];
    const tail = out[out.length - 1];
    if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > d * 0.3) out.push(last);
    return out;
  }
  function normals(P2) {
    const N = [];
    for (let i = 0; i < P2.length; i++) {
      const a = P2[Math.max(0, i - 1)], b = P2[Math.min(P2.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      N.push([-dy / L, dx / L]);
    }
    return N;
  }
  var profile = (t, [a, m, z]) => t < 0.18 ? lerp(a, m, smoothstep(0, 0.18, t)) : t > 0.65 ? lerp(m, z, smoothstep(0.65, 1, t)) : m;
  function bristleStroke(ctx, pts, o = {}) {
    const { width = 6, color = INK3.jiao, alpha = 0.9, bristles = 8, dry = 0.2, seed = 1, taper = [0.45, 1, 0.35], wet = 0, px = 1, spacing = 2.2 } = o;
    if (pts.length < 2) return;
    const P2 = resample(pts, spacing);
    if (P2.length < 2) return;
    const N = normals(P2);
    const n = P2.length;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    if (wet > 0) {
      ctx.filter = `blur(${Math.max(0.5, wet * px)}px)`;
      ctx.globalAlpha = alpha * 0.32;
      ctx.lineWidth = width * 1.15;
      ctx.beginPath();
      P2.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.stroke();
      ctx.filter = "none";
    }
    const S = [0];
    for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]));
    const total = S[n - 1] || 1;
    const bw = Math.max(0.35, width / bristles * 1.7);
    for (let j = 0; j < bristles; j++) {
      const off = bristles === 1 ? 0 : j / (bristles - 1) - 0.5;
      const edge = Math.abs(off) * 2;
      ctx.globalAlpha = alpha * (0.55 + 0.45 * hash2(j, 1, seed));
      ctx.lineWidth = bw * (0.7 + 0.6 * hash2(j, 2, seed));
      const jx = (hash2(j, 3, seed) - 0.5) * width * 0.12;
      ctx.beginPath();
      let down = false;
      for (let i = 0; i < n; i++) {
        const t = S[i] / total;
        const w = width * profile(t, taper);
        const dd = dry * (0.25 + 0.75 * t) * (0.6 + 0.6 * edge);
        const gap = dd > 0 && noise2(S[i] / 9 + j * 13.7, j * 3.3 + seed * 0.71, seed + j) < dd;
        if (gap) {
          down = false;
          continue;
        }
        const x = P2[i][0] + N[i][0] * (off * w + jx), y = P2[i][1] + N[i][1] * (off * w + jx);
        if (!down) {
          ctx.moveTo(x, y);
          down = true;
        } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function blobPath(cx, cy, rx, ry, { seed = 1, rough = 0.18, n = 28, rot = 0 } = {}) {
    const p = new Path2D();
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 1 + rough * (noise2(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7 - seed, seed) - 0.5) * 2;
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      const X = cx + x * Math.cos(rot) - y * Math.sin(rot), Y = cy + x * Math.sin(rot) + y * Math.cos(rot);
      i ? p.lineTo(X, Y) : p.moveTo(X, Y);
    }
    p.closePath();
    return p;
  }
  function inkDot(ctx, x, y, r, { color = INK3.jiao, alpha = 0.9, seed = 1, bleed = 0.35, ry = null, rot = 0, px = 1, rough = 0.22 } = {}) {
    if (r <= 0.05) return;
    ctx.save();
    ctx.fillStyle = color;
    if (bleed > 0) {
      ctx.globalAlpha = alpha * 0.28;
      ctx.fill(blobPath(x, y, r * (1 + bleed), (ry ?? r) * (1 + bleed), { seed: seed + 5, rough: rough * 1.4, rot }));
    }
    ctx.globalAlpha = alpha;
    ctx.fill(blobPath(x, y, r, ry ?? r, { seed, rough, rot }));
    ctx.restore();
  }
  function mossDots(ctx, pts, { gap = 26, size = 4, color = INK3.jiao, alpha = 0.85, seed = 7, chance = 0.6 } = {}) {
    const P2 = resample(pts, gap);
    P2.forEach(([x, y], i) => {
      if (hash2(i, 1, seed) > chance) return;
      const k = 1 + Math.floor(hash2(i, 2, seed) * 3);
      for (let j = 0; j < k; j++) {
        const dx = (hash2(i, 10 + j, seed) - 0.5) * gap * 0.7, dy = (hash2(i, 20 + j, seed) - 0.6) * size * 1.6;
        const s = size * (0.6 + hash2(i, 30 + j, seed) * 0.7);
        inkDot(ctx, x + dx, y + dy, s * 1.4, { ry: s * 0.75, rot: (hash2(i, 40 + j, seed) - 0.5) * 0.6, color, alpha, seed: seed + i * 7 + j, bleed: 0.25 });
      }
    });
  }
  function ridge(x0, x1, { base = 600, height = 260, seed = 1, step = 6, peaks = 2.2, rough = 0.18, steep = 1.6 } = {}) {
    const R = rng("ridge", seed);
    const P2 = [];
    const n = Math.max(2, Math.round((x1 - x0) / 1e3 * peaks) + 2);
    for (let i = 0; i < n; i++) {
      P2.push({ x: lerp(x0, x1, (i + R() * 0.8 - 0.4) / (n - 1)), h: height * (0.45 + 0.55 * R()), w: (x1 - x0) / n * (0.45 + R() * 0.5) });
    }
    const out = [];
    for (let x = x0; x <= x1 + step; x += step) {
      let h = 0;
      for (const p of P2) {
        const d = (x - p.x) / p.w;
        h = Math.max(h, p.h * Math.exp(-Math.pow(Math.abs(d), steep) * 1.4));
      }
      h *= 1 - rough + rough * 2 * fbm(x / 140, 0.3, seed, 4);
      h += (fbm(x / 38, 2.1, seed + 3, 3) - 0.5) * height * 0.06;
      out.push([Math.min(x, x1), base - Math.max(height * 0.06, h)]);
    }
    return out;
  }
  function washShape(ctx, pts, { color = INK3.dan, alpha = 0.8, top = null, fadeY = null, blur: blur2 = 3, edge = 0.25, edgeW = 3, px = 1, seed = 1 } = {}) {
    let ymin = Infinity, ymax = -Infinity;
    for (const [, y] of pts) {
      ymin = Math.min(ymin, y);
      ymax = Math.max(ymax, y);
    }
    const y0 = top ?? ymin, y1 = fadeY ?? ymax;
    const [r, g, b] = hexToRgb(color);
    const gr = ctx.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gr.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.55})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    const path = new Path2D();
    pts.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
    path.closePath();
    ctx.save();
    if (blur2 > 0) ctx.filter = `blur(${blur2 * px}px)`;
    ctx.fillStyle = gr;
    ctx.fill(path);
    ctx.filter = "none";
    if (edge > 0) {
      ctx.globalAlpha = edge;
      ctx.strokeStyle = gr;
      ctx.lineWidth = edgeW;
      ctx.lineJoin = "round";
      if (blur2 > 0) ctx.filter = `blur(${blur2 * 0.35 * px}px)`;
      ctx.stroke(path);
      ctx.filter = "none";
    }
    ctx.restore();
    return path;
  }
  function mountain(ctx, x0, x1, o = {}) {
    const { base = 600, height = 260, color = INK3.dan, alpha = 0.7, fadeY = base, seed = 1, peaks = 2.2, layers = 3, cun = 0, moss = 0, px = 1, blur: blur2 = 3, steep = 1.6, rough = 0.18 } = o;
    const top = ridge(x0, x1, { base, height, seed, peaks, steep, rough });
    const ymin = Math.min(...top.map((p) => p[1]));
    for (let k = 0; k < layers; k++) {
      const sink = k * height * 0.07;
      const pts = top.map(([x, y]) => [x, y + sink * (0.6 + 0.8 * fbm(x / 90, k + 0.5, seed + 11, 2))]);
      pts.push([x1, fadeY + 40], [x0, fadeY + 40]);
      washShape(ctx, pts, { color, alpha: alpha * (k ? 0.5 : 1), top: ymin + sink, fadeY, blur: blur2 * (k ? 1.6 : 1), edge: k ? 0 : 0.35, px, seed: seed + k });
    }
    if (cun > 0) cunStrokes(ctx, top, { base: fadeY, color: mix(color, INK3.jiao, 0.45), density: cun, seed: seed + 21, px });
    if (moss > 0) mossDots(ctx, top.map(([x, y]) => [x, y + 3]), { gap: 30 / moss, size: 3.6, color: mix(color, INK3.jiao, 0.7), seed: seed + 31, chance: 0.45 });
    return top;
  }
  function cunStrokes(ctx, top, { base = 800, color = INK3.zhong, density = 1, seed = 5, px = 1, alpha = 0.55, len = 0.45 } = {}) {
    const R = rng("cun", seed);
    const x0 = top[0][0], x1 = top[top.length - 1][0];
    const yAt = (x) => {
      const i = clamp(Math.round((x - x0) / (x1 - x0) * (top.length - 1)), 0, top.length - 1);
      return top[i][1];
    };
    const count = Math.round((x1 - x0) / 100 * density);
    for (let k = 0; k < count; k++) {
      const x = lerp(x0, x1, R());
      const y = yAt(x);
      const slope = (yAt(x + 12) - yAt(x - 12)) / 24;
      const H2 = (base - y) * len * (0.4 + R() * 0.8);
      if (H2 < 8) continue;
      const pts = [];
      const sx = clamp(-slope * 0.6, -0.8, 0.8);
      for (let s = 0; s <= 6; s++) {
        const t = s / 6;
        pts.push([x + sx * H2 * t + Math.sin(t * 3 + k) * 4, y + 4 + H2 * t]);
      }
      bristleStroke(ctx, pts, { width: 3 + R() * 4, color, alpha: alpha * (0.6 + R() * 0.4), bristles: 5, dry: 0.45, seed: seed + k, taper: [0.8, 1, 0.15], px });
    }
  }
  function mistBand(ctx, x0, x1, y, h, { color = INK3.paper, alpha = 0.95 } = {}) {
    const [r, g, b] = hexToRgb(color);
    const gr = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
    gr.addColorStop(0.45, `rgba(${r},${g},${b},${alpha})`);
    gr.addColorStop(0.6, `rgba(${r},${g},${b},${alpha})`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(x0, y - h / 2, x1 - x0, h);
  }
  function pine(ctx, x, y, h, { seed = 1, color = INK3.nong, alpha = 0.85, lean = 0.15, px = 1 } = {}) {
    const R = rng("pine", seed);
    const trunk = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8;
      trunk.push([x + Math.sin(t * 2.6 + seed) * h * 0.05 + lean * h * t, y - h * t]);
    }
    bristleStroke(ctx, trunk, { width: h * 0.06, color, alpha, bristles: 6, dry: 0.35, seed, taper: [1, 0.8, 0.35], px });
    const tiers = 3 + Math.floor(R() * 2);
    for (let k = 0; k < tiers; k++) {
      const t = 0.45 + k / tiers * 0.55;
      const [tx, ty] = trunk[Math.round(t * 8)];
      const side = k % 2 ? 1 : -1;
      const w = h * (0.32 - 0.18 * (k / tiers)) * (0.8 + R() * 0.4);
      bristleStroke(ctx, [[tx, ty], [tx + side * w * 0.6, ty - h * 0.03], [tx + side * w, ty + h * 0.01]], { width: h * 0.022, color, alpha, bristles: 3, dry: 0.3, seed: seed + k * 3 + 1, px });
      for (let j = 0; j < 5; j++) {
        const u = j / 4;
        const cx = tx + side * w * (0.15 + u * 0.95), cy = ty - h * 0.04 - Math.sin(u * Math.PI) * h * 0.04;
        inkDot(ctx, cx, cy, w * 0.22, { ry: h * 0.045, color, alpha: alpha * 0.85, seed: seed * 31 + k * 7 + j, bleed: 0.3, rough: 0.35 });
      }
    }
    const [hx, hy] = trunk[8];
    inkDot(ctx, hx, hy - h * 0.02, h * 0.12, { ry: h * 0.05, color, alpha: alpha * 0.9, seed: seed + 99, bleed: 0.3, rough: 0.35 });
  }
  function bamboo(ctx, x, y, h, { seed = 1, color = INK3.nong, alpha = 0.8, stems = 3, px = 1 } = {}) {
    const R = rng("bamboo", seed);
    for (let s = 0; s < stems; s++) {
      const bx = x + (s - (stems - 1) / 2) * h * 0.07 + (R() - 0.5) * h * 0.04;
      const hh = h * (0.7 + R() * 0.3), lean = (R() - 0.5) * 0.25;
      const tone2 = s % 2 ? mix(color, INK3.paper, 0.35) : color;
      let yy = y, xx = bx;
      const segs = 5 + Math.floor(R() * 2);
      for (let k = 0; k < segs; k++) {
        const L = hh / segs;
        const nx = xx + lean * L, ny = yy - L;
        bristleStroke(ctx, [[xx, yy - 2], [nx, ny + 3]], { width: h * 0.022, color: tone2, alpha, bristles: 4, dry: 0.15, seed: seed + s * 13 + k, taper: [1.1, 0.9, 1.15], px });
        bristleStroke(ctx, [[nx - h * 0.014, ny + 1], [nx + h * 0.014, ny - 1]], { width: 2.2, color: INK3.jiao, alpha: alpha * 0.9, bristles: 2, dry: 0, seed: seed + k, px });
        xx = nx;
        yy = ny;
        if (k >= segs - 3 && R() < 0.85) {
          const dir = R() < 0.5 ? -1 : 1;
          const nL = 2 + Math.floor(R() * 3);
          for (let j = 0; j < nL; j++) {
            const a = (dir < 0 ? Math.PI : 0) + dir * (0.35 + j * 0.28 + (R() - 0.5) * 0.2) * -1 + (dir < 0 ? -0.15 : 0.15);
            const len = h * (0.09 + R() * 0.06);
            bambooLeaf(ctx, xx, yy, a + Math.PI * 0.08 * dir, len, { color: tone2, alpha: alpha * 0.95, seed: seed * 7 + j });
          }
        }
      }
    }
  }
  function bambooLeaf(ctx, x, y, a, len, { color = INK3.nong, alpha = 0.85, seed = 1 } = {}) {
    const w = len * 0.17;
    const c = Math.cos(a), s = Math.sin(a);
    const bend = (hash2(seed, 1, 3) - 0.5) * len * 0.25;
    const P2 = (u, v) => [x + c * u - s * v, y + s * u + c * v];
    const p = new Path2D();
    const p0 = P2(0, 0), p1 = P2(len * 0.35, -w + bend * 0.3), p2 = P2(len, bend), p3 = P2(len * 0.4, w * 0.7 + bend * 0.3);
    p.moveTo(...p0);
    p.quadraticCurveTo(...p1, ...p2);
    p.quadraticCurveTo(...p3, ...p0);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fill(p);
    ctx.restore();
  }
  function grassTuft(ctx, x, y, h, { seed = 1, color = INK3.zhong, alpha = 0.7, blades = 6, spread = 0.9, px = 1 } = {}) {
    for (let k = 0; k < blades; k++) {
      const a = -Math.PI / 2 + (k / Math.max(1, blades - 1) - 0.5) * spread + (hash2(k, 1, seed) - 0.5) * 0.3;
      const L = h * (0.55 + hash2(k, 2, seed) * 0.5);
      const bend = (hash2(k, 3, seed) - 0.5) * 0.6;
      const pts = [];
      for (let s = 0; s <= 5; s++) {
        const t = s / 5, aa = a + bend * t;
        pts.push([x + Math.cos(aa) * L * t + (k - blades / 2) * 1.5, y + Math.sin(aa) * L * t]);
      }
      bristleStroke(ctx, pts, { width: 2.6 + hash2(k, 4, seed) * 2, color, alpha, bristles: 3, dry: 0.2, seed: seed + k, taper: [1, 0.7, 0.05], px });
    }
  }
  function rock(ctx, x, y, w, h, { seed = 1, color = INK3.zhong, alpha = 0.8, px = 1 } = {}) {
    const R = rng("rock", seed);
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const yy = y - h * Math.sin(Math.PI * t) ** 0.6 * (0.75 + R() * 0.35);
      pts.push([x - w / 2 + w * t, yy]);
    }
    const shape = [...pts, [x + w / 2, y], [x - w / 2, y]];
    washShape(ctx, shape, { color: mix(color, INK3.paper, 0.45), alpha: alpha * 0.55, top: y - h, fadeY: y + 6, blur: 1.5, edge: 0, px });
    bristleStroke(ctx, pts, { width: Math.max(3, h * 0.07), color, alpha, bristles: 6, dry: 0.35, seed, taper: [0.9, 1, 0.5], px });
    for (let k = 0; k < 2; k++) {
      const t = 0.3 + R() * 0.4;
      const top = pts[Math.round(t * n)];
      bristleStroke(ctx, [[top[0], top[1] + 4], [top[0] + (R() - 0.5) * w * 0.2, top[1] + h * 0.45], [top[0] + (R() - 0.5) * w * 0.25, y - 2]], { width: Math.max(2.5, h * 0.05), color, alpha: alpha * 0.6, bristles: 4, dry: 0.5, seed: seed + k + 7, taper: [0.9, 0.8, 0.1], px });
    }
    mossDots(ctx, pts.slice(2, 7), { gap: Math.max(10, w / 5), size: Math.max(2, h * 0.06), color: INK3.jiao, seed: seed + 3, chance: 0.5 });
  }
  function ribbonPath(pts, widthAt) {
    const N = normals(pts);
    const L = [], Rr = [];
    pts.forEach(([x, y], i) => {
      const w = widthAt(i, i / (pts.length - 1)) / 2;
      L.push([x + N[i][0] * w, y + N[i][1] * w]);
      Rr.push([x - N[i][0] * w, y - N[i][1] * w]);
    });
    const p = new Path2D();
    L.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    for (let i = Rr.length - 1; i >= 0; i--) p.lineTo(Rr[i][0], Rr[i][1]);
    p.closePath();
    return p;
  }
  function inkRibbon(ctx, pts, { width = 12, vary = 0.35, color = INK3.jiao, seed = 1, px = 1, bleed = 4, dry = 0.35, taper = 40 } = {}) {
    const P2 = resample(pts, 3);
    const S = [0];
    for (let i = 1; i < P2.length; i++) S.push(S[i - 1] + Math.hypot(P2[i][0] - P2[i - 1][0], P2[i][1] - P2[i - 1][1]));
    const total = S[S.length - 1] || 1;
    const ends = (i) => taper > 0 ? Math.sqrt(clamp(Math.min(S[i], total - S[i]) / taper)) : 1;
    const wAt = (i) => width * (1 + vary * (fbm(S[i] / 90, 0.5, seed, 3) - 0.5) * 2.2) * Math.max(0.12, ends(i));
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.filter = `blur(${bleed * px}px)`;
    ctx.fill(ribbonPath(P2, (i) => wAt(i) + bleed * 1.6));
    ctx.filter = `blur(${0.6 * px}px)`;
    ctx.globalAlpha = 0.9;
    const core = ribbonPath(P2, (i) => wAt(i));
    ctx.fill(core);
    ctx.filter = "none";
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = INK3.jiao;
    ctx.lineWidth = 1.2;
    ctx.stroke(core);
    if (dry > 0) {
      ctx.strokeStyle = INK3.paper;
      ctx.lineCap = "round";
      for (let j = 0; j < 5; j++) {
        const off = (j / 4 - 0.5) * 0.7;
        ctx.globalAlpha = 0.5 + 0.3 * hash2(j, 1, seed);
        ctx.lineWidth = 0.7 + hash2(j, 2, seed) * 1.1;
        ctx.beginPath();
        let down = false;
        const N = normals(P2);
        for (let i = 0; i < P2.length; i++) {
          const on = noise2(S[i] / 46 + j * 5.1, j * 1.7, seed + 40) < dry * 0.75;
          if (!on) {
            down = false;
            continue;
          }
          const w = wAt(i);
          const x = P2[i][0] + N[i][0] * off * w, y = P2[i][1] + N[i][1] * off * w;
          if (!down) {
            ctx.moveTo(x, y);
            down = true;
          } else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  var quadAt = (p0, p1, p2, t) => {
    const u = 1 - t;
    return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
  };
  function inkStream(ctx, p0, p1, p2, t0, t1, { w0 = 5, w1 = 7, color = INK3.jiao, alpha = 0.92, wobble = 2, phase = 0, seed = 1 } = {}) {
    if (t1 - t0 < 2e-3) return;
    const n = Math.max(4, Math.ceil((t1 - t0) * 48));
    const P2 = [];
    for (let i = 0; i <= n; i++) {
      const t = lerp(t0, t1, i / n);
      const [x, y] = quadAt(p0, p1, p2, t);
      P2.push([x + Math.sin(t * 17 + phase * 6.3) * wobble * t, y]);
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fill(ribbonPath(P2, (i, u) => lerp(w0, w1, lerp(t0, t1, u)) * (1 + 0.18 * Math.sin(u * 23 + phase * 9 + seed))));
    const a = P2[0], z = P2[P2.length - 1];
    ctx.beginPath();
    ctx.arc(a[0], a[1], lerp(w0, w1, t0) / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(z[0], z[1], lerp(w0, w1, t1) * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  function sealStamp(ctx, x, y, size, { color = INK3.seal, seed = 1, rot = -0.04, alpha = 0.92 } = {}) {
    const s = size / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.globalAlpha *= alpha;
    const p = new Path2D();
    const c = [[-s, -s], [s, -s], [s, s], [-s, s]];
    c.forEach(([cx, cy], i) => {
      const jx = (hash2(i, 1, seed) - 0.5) * size * 0.04, jy = (hash2(i, 2, seed) - 0.5) * size * 0.04;
      i ? p.lineTo(cx + jx, cy + jy) : p.moveTo(cx + jx, cy + jy);
    });
    p.closePath();
    ctx.fillStyle = color;
    ctx.fill(p);
    ctx.strokeStyle = INK3.paper;
    ctx.fillStyle = INK3.paper;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1, size * 0.07);
    ctx.strokeRect(-s * 0.78, -s * 0.78, s * 1.56, s * 1.56);
    ctx.beginPath();
    ctx.moveTo(-s * 0.62, s * 0.18);
    ctx.lineTo(-s * 0.25, -s * 0.42);
    ctx.lineTo(0, -s * 0.05);
    ctx.lineTo(s * 0.22, -s * 0.3);
    ctx.lineTo(s * 0.62, s * 0.18);
    ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k < 2; k++) {
      const yy = s * (0.4 + k * 0.2);
      ctx.moveTo(-s * 0.6, yy);
      for (let u = 0; u <= 4; u++) ctx.quadraticCurveTo(-s * 0.6 + (u + 0.5) * s * 0.3, yy - s * 0.1 * (u % 2 ? -1 : 1), -s * 0.6 + (u + 1) * s * 0.3, yy);
    }
    ctx.lineWidth = Math.max(0.8, size * 0.05);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s * 0.42, -s * 0.5, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    for (let k = 0; k < 14; k++) {
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc((hash2(k, 5, seed) - 0.5) * size * 0.98, (hash2(k, 6, seed) - 0.5) * size * 0.98, size * (8e-3 + hash2(k, 7, seed) * 0.02), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function paperCard(w, h, { seed = 1, seal = true, sealSize = 46, border = INK3.nong, key = "" } = {}) {
    const pad = 24;
    w = Math.round(w);
    h = Math.round(h);
    const canvas = baked(`inkcard|${key}|${w}|${h}|${seed}|${seal}|${sealSize}`, w + pad * 2, h + pad * 2, (ctx) => {
      ctx.translate(pad, pad);
      const edge = new Path2D();
      const pts = [];
      const n = 80;
      for (let i = 0; i < n; i++) {
        const t = i / n;
        let x, y;
        if (t < 0.25) {
          x = t / 0.25 * w;
          y = 0;
        } else if (t < 0.5) {
          x = w;
          y = (t - 0.25) / 0.25 * h;
        } else if (t < 0.75) {
          x = w - (t - 0.5) / 0.25 * w;
          y = h;
        } else {
          x = 0;
          y = h - (t - 0.75) / 0.25 * h;
        }
        const j = (noise2(i * 0.9, 0.5, seed) - 0.5) * 5;
        pts.push([x + (y === 0 || y === h ? 0 : j), y + (x === 0 || x === w ? 0 : j)]);
      }
      pts.forEach(([x, y], i) => i ? edge.lineTo(x, y) : edge.moveTo(x, y));
      edge.closePath();
      ctx.save();
      ctx.shadowColor = "rgba(60,45,25,0.22)";
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 5;
      ctx.fillStyle = INK3.paper;
      ctx.fill(edge);
      ctx.restore();
      ctx.save();
      ctx.clip(edge);
      ctx.drawImage(xuanPaper(w, h, { seed: seed + 50, amount: 1.1 }), 0, 0);
      ctx.fillStyle = rgba(INK3.dan, 0.08);
      ctx.fill(blobPath(w * 0.8, h * 0.75, w * 0.35, h * 0.4, { seed, rough: 0.3 }));
      ctx.restore();
      const m = 12;
      const sides = [[[m, m], [w - m, m + 1]], [[w - m, m - 2], [w - m + 1, h - m]], [[w - m + 2, h - m], [m, h - m - 1]], [[m, h - m + 2], [m - 1, m]]];
      sides.forEach(([a, b], i) => bristleStroke(ctx, [a, [(a[0] + b[0]) / 2 + (hash2(i, 1, seed) - 0.5) * 3, (a[1] + b[1]) / 2 + (hash2(i, 2, seed) - 0.5) * 3], b], { width: 4.2, color: border, alpha: 0.85, bristles: 6, dry: 0.42, seed: seed + i * 5, taper: [1, 0.85, 0.5], spacing: 1.6 }));
      if (seal) sealStamp(ctx, w - m - sealSize * 0.55 - 6, m + sealSize * 0.55 + 6, sealSize, { seed: seed + 9 });
    });
    return { canvas, pad };
  }
  function handscrollFrame(ctx, R, { silk = "#dfe2d6", silkDark = "#c9cdbf", wood = "#4a3426", knob = "#efeadb", seal = true } = {}) {
    const t = 64 * R.s, { x, y, w, h } = R;
    const s = R.s;
    ctx.save();
    ctx.fillStyle = "rgba(40,35,25,0.14)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 0.95, w * 0.55, t * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    const band = new Path2D();
    band.rect(x - t, y - t * 0.8, w + 2 * t, h + t * 1.6);
    band.rect(x, y, w, h);
    ctx.fillStyle = silk;
    ctx.fill(band, "evenodd");
    ctx.save();
    ctx.clip(band, "evenodd");
    ctx.strokeStyle = rgba(silkDark, 0.9);
    ctx.lineWidth = Math.max(0.6, 1.4 * s);
    const step = 46 * s;
    if (step > 4) {
      for (let yy = y - t * 0.8 + step * 0.5, r = 0; yy < y + h + t * 0.8; yy += step * 0.75, r++) {
        for (let xx = x - t + r % 2 * step * 0.5; xx < x + w + t; xx += step) {
          ctx.beginPath();
          ctx.arc(xx, yy, step * 0.16, Math.PI, Math.PI * 2);
          ctx.arc(xx + step * 0.2, yy, step * 0.1, Math.PI, Math.PI * 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
    ctx.strokeStyle = INK3.nong;
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.strokeRect(x - 1.5 * s, y - 1.5 * s, w + 3 * s, h + 3 * s);
    ctx.strokeStyle = INK3.zheshi;
    ctx.lineWidth = Math.max(1, 5 * s);
    ctx.strokeRect(x - 9 * s, y - 9 * s, w + 18 * s, h + 18 * s);
    ctx.strokeStyle = rgba(INK3.nong, 0.7);
    ctx.lineWidth = Math.max(0.8, 1.6 * s);
    ctx.strokeRect(x - t, y - t * 0.8, w + 2 * t, h + t * 1.6);
    for (const side of [-1, 1]) {
      const cx = side < 0 ? x - t - 14 * s : x + w + t + 14 * s;
      const rw = 30 * s, top = y - t * 0.8 - 18 * s, bot = y + h + t * 0.8 + 18 * s;
      const g = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
      g.addColorStop(0, mix(wood, "#000000", 0.3));
      g.addColorStop(0.35, mix(wood, "#ffffff", 0.25));
      g.addColorStop(1, mix(wood, "#000000", 0.45));
      ctx.fillStyle = g;
      ctx.fillRect(cx - rw / 2, top, rw, bot - top);
      for (const [ky, dir] of [[top, -1], [bot, 1]]) {
        const kg = ctx.createLinearGradient(cx - rw * 0.6, 0, cx + rw * 0.6, 0);
        kg.addColorStop(0, "#cfc9b6");
        kg.addColorStop(0.4, knob);
        kg.addColorStop(1, "#b9b29c");
        ctx.fillStyle = kg;
        ctx.beginPath();
        ctx.ellipse(cx, ky + dir * 12 * s, rw * 0.62, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = rgba(INK3.nong, 0.6);
        ctx.lineWidth = Math.max(0.6, 1.2 * s);
        ctx.stroke();
      }
    }
    if (seal && t > 8) sealStamp(ctx, x + w + t * 0.5, y + h * 0.08 + t * 0.1, t * 0.42, { seed: 77 });
    ctx.restore();
  }

  // src/scenes/s03.js
  var ST3 = stationByN(3);
  var PX = K;
  var P_SKY = 0.03;
  var P_FAR1 = 0.1;
  var P_FAR2 = 0.2;
  var P_MIST = 0.3;
  var P_MID = 0.45;
  var P_NEAR = 0.8;
  var P_FG2 = 1.3;
  var TABLE = { x0: 585, x1: 800, top: 668 };
  var MAN_X = 852;
  var MAN_BASE = 792;
  var LAND_X = 496;
  var LINE_L = CHAR_X - 96;
  var CUP_X = 640;
  var SHED = { x0: 500, x1: 1090, eave: 432 };
  var FLAG_X = 1150;
  var T_LIFT = [GAG - 3.2, GAG - 1.4];
  var T_TILT = [GAG - 0.75, GAG - 0.45];
  var T_SPOUT = GAG - 0.5;
  var T_LAND = GAG;
  var T_FEET = GAG + 1.5;
  var T_AHEAD = [GAG + 0.9, GAG + 3];
  var T_STOP = GAG + 3.1;
  var T_REST = [GAG + 3.3, GAG + 4.1];
  var T_NOD = [GAG + 4.1, GAG + 4.9];
  var R0 = (k) => rng("s03", k);
  var lineY = (x) => ROAD_Y + 11 + Math.sin(x / 131) * 4.5 + (fbm(x / 190, 0.4, 33, 3) - 0.5) * 12;
  function skyLayer2() {
    return strip("s03-sky", P_SKY, (ctx, x0, x1) => {
      ctx.save();
      ctx.filter = `blur(${6 * PX}px)`;
      ctx.fillStyle = rgba("#e7c39a", 0.42);
      ctx.beginPath();
      ctx.arc(1130, 150, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.filter = "none";
      ctx.restore();
    }, { y0: 40, y1: 300 });
  }
  function far1Layer() {
    return strip("s03-far1", P_FAR1, (ctx, x0, x1) => {
      mountain(ctx, x0, x1, { base: 600, height: 330, color: mix(INK3.qing, INK3.huaqing, 0.35), alpha: 0.75, fadeY: 600, seed: 11, peaks: 2.4, layers: 2, px: PX, blur: 4, steep: 1.3 });
    }, { y0: 160, y1: 660 });
  }
  function far2Layer() {
    return strip("s03-far2", P_FAR2, (ctx, x0, x1) => {
      const top = mountain(ctx, x0, x1, { base: 660, height: 250, color: mix(INK3.dan, INK3.huaqing, 0.3), alpha: 0.72, fadeY: 650, seed: 23, peaks: 3.2, layers: 3, px: PX, blur: 3, steep: 1.5 });
      const R = R0("far2pine");
      for (let i = 8; i < top.length - 8; i += 9) {
        const [x, y] = top[i];
        if (y < top[i - 6][1] && y < top[i + 6][1] && R() < 0.7) for (let k = 0; k < 3; k++) inkDot(ctx, x - 8 + k * 8 + R() * 4, y - 4 - R() * 6, 3 + R() * 2, { ry: 5 + R() * 3, color: mix(INK3.zhong, INK3.huaqing, 0.25), alpha: 0.75, seed: i * 3 + k, bleed: 0.3 });
      }
    }, { y0: 300, y1: 700 });
  }
  function mistLayer() {
    return strip("s03-mist", P_MIST, (ctx, x0, x1) => {
      mistBand(ctx, x0, x1, 650, 90, { alpha: 0.9 });
      ctx.save();
      ctx.filter = `blur(${10 * PX}px)`;
      ctx.fillStyle = rgba(INK3.paper, 0.85);
      const R = R0("mist");
      for (let x = x0; x < x1; x += 160 + R() * 220) ctx.fill(blobPath(x, 600 + R() * 50, 120 + R() * 140, 18 + R() * 16, { seed: x, rough: 0.3 }));
      ctx.restore();
    }, { y0: 520, y1: 720 });
  }
  function midLayer2(cg) {
    return strip("s03-mid", P_MID, (ctx, x0, x1) => {
      const color = mix(INK3.zhong, INK3.huaqing, 0.12);
      const top = mountain(ctx, x0, x1, { base: 760, height: 210, color, alpha: 0.62, fadeY: 760, seed: 37, peaks: 2.6, layers: 3, px: PX, blur: 2.2, steep: 1.9, cun: 2.6, moss: 0.3, rough: 0.25 });
      const R = R0("midpine");
      for (let i = 12; i < top.length - 12; i += 6) {
        const [x, y] = top[i];
        const sx = x - cg * P_MID;
        if (sx > 150 && sx < 470) continue;
        if (y <= top[i - 10][1] && y <= top[i + 10][1] && R() < 0.85) pine(ctx, x + (R() - 0.5) * 20, y + 6, 70 + R() * 50, { seed: i, color: INK3.nong, alpha: 0.82, lean: (R() - 0.5) * 0.4, px: PX });
      }
      mistBand(ctx, x0, x1, 772, 70, { alpha: 0.8 });
    }, { y0: 420, y1: 810 });
  }
  function nearLayer(cg) {
    return strip("s03-near", P_NEAR, (ctx, x0, x1) => {
      const R = R0("near");
      const pts = [];
      for (let x = x0; x <= x1; x += 8) pts.push([x, 742 - 26 * fbm(x / 210, 0.2, 51, 3) - 14 * Math.sin(x / 330)]);
      washShape(ctx, [...pts, [x1, 805], [x0, 805]], { color: mix(INK3.zheshi, INK3.dan, 0.4), alpha: 0.35, fadeY: 805, blur: 3, edge: 0.4, px: PX });
      bristleStroke(ctx, pts.filter((_, i) => i % 3 === 0), { width: 3.5, color: INK3.zhong, alpha: 0.55, bristles: 6, dry: 0.55, seed: 52, px: PX, spacing: 3 });
      for (let x = x0 + 80; x < x1; x += 260 + R() * 320) {
        const sx = x - cg * P_NEAR;
        if (sx > 120 && sx < 1120) continue;
        const kind = R();
        if (kind < 0.35) rock(ctx, x, 798, 80 + R() * 70, 46 + R() * 34, { seed: Math.round(x), color: INK3.zhong, px: PX });
        else if (kind < 0.7) bamboo(ctx, x, 796, 240 + R() * 120, { seed: Math.round(x), color: INK3.nong, alpha: 0.75, stems: 2 + Math.floor(R() * 2), px: PX });
        else {
          grassTuft(ctx, x, 798, 40 + R() * 30, { seed: Math.round(x), px: PX });
          rock(ctx, x + 50, 798, 50, 26, { seed: Math.round(x) + 1, px: PX });
        }
      }
      for (let x = x0; x < x1; x += 170 + R() * 260) grassTuft(ctx, x, 800, 22 + R() * 22, { seed: Math.round(x) + 7, color: INK3.zhong, alpha: 0.6, blades: 4 + Math.floor(R() * 3), px: PX });
    }, { y0: 480, y1: 812 });
  }
  function roadLayer2() {
    return strip("s03-road", 1, (ctx, x0, x1) => {
      const g = ctx.createLinearGradient(0, ROAD_Y, 0, 1e3);
      g.addColorStop(0, rgba(INK3.zheshi, 0.42));
      g.addColorStop(0.35, rgba(INK3.zheshi, 0.16));
      g.addColorStop(1, rgba(INK3.zheshi, 0.05));
      ctx.fillStyle = g;
      ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1e3 - ROAD_Y + 2);
      const R = R0("road");
      for (let x = x0; x < x1; ) {
        const L = 120 + R() * 260;
        const pts = [];
        for (let u = 0; u <= L; u += 20) pts.push([x + u, ROAD_Y + 1 + Math.sin((x + u) / 47) * 1.5]);
        bristleStroke(ctx, pts, { width: 3.4, color: INK3.zhong, alpha: 0.55, bristles: 6, dry: 0.55, seed: Math.round(x), taper: [0.7, 1, 0.3], px: PX });
        x += L + 20 + R() * 60;
      }
      for (let x = x0; x < x1; x += 70 + R() * 130) {
        const y = ROAD_Y + 30 + R() * 160, L = 40 + R() * 110;
        bristleStroke(ctx, [[x, y], [x + L * 0.5, y + (R() - 0.5) * 4], [x + L, y + (R() - 0.5) * 6]], { width: 3 + R() * 3, color: INK3.dan, alpha: 0.45, bristles: 5, dry: 0.65, seed: Math.round(x) + 3, taper: [0.8, 1, 0.1], px: PX });
      }
      for (let x = x0; x < x1; x += 40 + R() * 90) inkDot(ctx, x, ROAD_Y + 20 + R() * 170, 2 + R() * 3.5, { ry: 1.4 + R() * 2, color: INK3.zhong, alpha: 0.6, seed: Math.round(x), bleed: 0.2 });
      for (let x = x0; x < x1; x += 300) bristleStroke(ctx, [[x, 975], [x + 140, 972], [x + 290, 976]], { width: 4, color: INK3.dan, alpha: 0.35, bristles: 5, dry: 0.6, seed: Math.round(x) + 9, px: PX });
    }, { y0: ROAD_Y - 6, y1: 1e3 });
  }
  var SHED_BOX = { x0: 440, x1: 1290, y0: 200, y1: 812 };
  function shedImage(part) {
    const { x0, x1, y0, y1 } = SHED_BOX;
    return baked(`s03-shed-${part}`, (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-x0, -y0);
      if (part === "back") shedBack(ctx);
      else shedFront(ctx);
    });
  }
  function shedBack(ctx) {
    const o = { px: PX };
    bamboo(ctx, 1040, MAN_BASE - 10, 380, { seed: 301, color: mix(INK3.zhong, INK3.huaqing, 0.15), alpha: 0.6, stems: 3, ...o });
    bamboo(ctx, 560, MAN_BASE - 10, 300, { seed: 307, color: mix(INK3.dan, INK3.huaqing, 0.2), alpha: 0.55, stems: 2, ...o });
    for (const x of [600, 1010]) bristleStroke(ctx, [[x, MAN_BASE - 14], [x + 2, SHED.eave - 40]], { width: 9, color: INK3.zhong, alpha: 0.65, bristles: 6, dry: 0.25, seed: x, taper: [1, 0.9, 1], ...o });
    ctx.save();
    ctx.filter = `blur(${4 * PX}px)`;
    ctx.fillStyle = rgba(INK3.dan, 0.25);
    ctx.fill(blobPath(800, MAN_BASE + 4, 300, 12, { seed: 3, rough: 0.2 }));
    ctx.restore();
    const sx = 965;
    const stove = [[sx - 34, MAN_BASE], [sx - 28, MAN_BASE - 92], [sx + 28, MAN_BASE - 92], [sx + 34, MAN_BASE]];
    washShape(ctx, [...stove], { color: mix(INK3.zheshi, INK3.zhong, 0.35), alpha: 0.55, blur: 1, edge: 0, ...o });
    bristleStroke(ctx, stove, { width: 4, color: INK3.nong, alpha: 0.85, bristles: 6, dry: 0.35, seed: 41, ...o });
    ctx.save();
    ctx.filter = `blur(${5 * PX}px)`;
    ctx.fillStyle = rgba("#d9824e", 0.55);
    ctx.beginPath();
    ctx.ellipse(sx, MAN_BASE - 38, 13, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    bristleStroke(ctx, [[sx - 16, MAN_BASE - 40], [sx + 16, MAN_BASE - 40]], { width: 3, color: INK3.nong, alpha: 0.7, bristles: 3, ...o });
    inkDot(ctx, sx, MAN_BASE - 112, 26, { ry: 20, color: mix(INK3.zhong, INK3.zheshi, 0.25), alpha: 0.85, seed: 5, bleed: 0.2, rough: 0.08 });
    bristleStroke(ctx, [[sx - 8, MAN_BASE - 132], [sx + 8, MAN_BASE - 132]], { width: 5, color: INK3.jiao, alpha: 0.9, bristles: 3, ...o });
    bristleStroke(ctx, [[520, MAN_BASE - 46], [575, MAN_BASE - 48]], { width: 7, color: INK3.nong, alpha: 0.8, bristles: 6, dry: 0.3, seed: 61, ...o });
    for (const x of [527, 567]) bristleStroke(ctx, [[x, MAN_BASE - 44], [x + (x < 540 ? -3 : 3), MAN_BASE]], { width: 4, color: INK3.nong, alpha: 0.8, bristles: 4, seed: x, ...o });
  }
  function shedFront(ctx) {
    const o = { px: PX };
    for (const x of [SHED.x0 + 14, SHED.x1 - 18]) {
      bristleStroke(ctx, [[x, ROAD_Y - 4], [x - 2, SHED.eave - 30]], { width: 12, color: INK3.nong, alpha: 0.85, bristles: 8, dry: 0.3, seed: x + 1, taper: [1.1, 0.9, 1], ...o });
      for (let y = ROAD_Y - 90; y > SHED.eave; y -= 92) bristleStroke(ctx, [[x - 8, y], [x + 7, y - 2]], { width: 2.5, color: INK3.jiao, alpha: 0.85, bristles: 2, ...o });
    }
    const roof2 = [[SHED.x0 - 60, SHED.eave + 6], [SHED.x0 + 70, SHED.eave - 120], [SHED.x1 - 40, SHED.eave - 150], [SHED.x1 + 70, SHED.eave - 8]];
    const roofPts = [...roof2, [SHED.x1 + 50, SHED.eave + 8], [SHED.x0 - 40, SHED.eave + 18]];
    washShape(ctx, roofPts, { color: mix(INK3.zheshi, INK3.dan, 0.55), alpha: 0.5, top: SHED.eave - 150, fadeY: SHED.eave + 40, blur: 1.5, edge: 0, ...o });
    const R = R0("thatch");
    for (let k = 0; k < 70; k++) {
      const u = R();
      const tx = lerp(roof2[1][0], roof2[2][0], u), ty = lerp(roof2[1][1], roof2[2][1], u);
      const bx = lerp(SHED.x0 - 50, SHED.x1 + 60, u) + (R() - 0.5) * 30, by = SHED.eave + 6 + R() * 16;
      const s = 0.1 + R() * 0.25;
      bristleStroke(ctx, [[lerp(tx, bx, s), lerp(ty, by, s)], [lerp(tx, bx, 0.6) + (R() - 0.5) * 10, lerp(ty, by, 0.6)], [bx, by]], { width: 5 + R() * 6, color: R() < 0.3 ? INK3.nong : INK3.zhong, alpha: 0.5 + R() * 0.35, bristles: 6, dry: 0.5, seed: k + 400, taper: [0.5, 1, 0.3], ...o });
    }
    bristleStroke(ctx, [roof2[1], [lerp(roof2[1][0], roof2[2][0], 0.5), lerp(roof2[1][1], roof2[2][1], 0.5) - 6], roof2[2]], { width: 10, color: INK3.jiao, alpha: 0.85, bristles: 9, dry: 0.35, seed: 71, taper: [0.6, 1, 0.5], ...o });
    bristleStroke(ctx, [[SHED.x0 - 30, SHED.eave + 10], [SHED.x1 + 40, SHED.eave + 2]], { width: 7, color: INK3.nong, alpha: 0.85, bristles: 7, dry: 0.25, seed: 73, ...o });
    const { x0, x1, top } = TABLE;
    const slab = [[x0 - 8, top], [x1 + 8, top - 2], [x1 + 6, top + 14], [x0 - 6, top + 15]];
    washShape(ctx, slab, { color: mix(INK3.zheshi, INK3.zhong, 0.5), alpha: 0.75, blur: 0.8, edge: 0, ...o });
    bristleStroke(ctx, [[x0 - 8, top], [x1 + 8, top - 2]], { width: 4.5, color: INK3.jiao, alpha: 0.9, bristles: 7, dry: 0.25, seed: 81, ...o });
    bristleStroke(ctx, [[x0 - 6, top + 15], [x1 + 6, top + 14]], { width: 3, color: INK3.nong, alpha: 0.8, bristles: 5, dry: 0.3, seed: 82, ...o });
    for (const x of [x0 + 14, x1 - 14]) bristleStroke(ctx, [[x, top + 14], [x + (x < 700 ? -5 : 5), MAN_BASE + 2]], { width: 9, color: INK3.nong, alpha: 0.85, bristles: 6, dry: 0.3, seed: x + 7, taper: [1, 0.9, 0.8], ...o });
    washShape(ctx, [[x0 + 22, top + 15], [x1 - 22, top + 15], [x1 - 26, top + 52], [x0 + 26, top + 52]], { color: INK3.dan, alpha: 0.3, blur: 1.2, edge: 0, ...o });
    const cy = top - 1;
    inkDot(ctx, CUP_X, cy, 17, { ry: 3.5, color: INK3.dan, alpha: 0.6, seed: 91, bleed: 0.2, rough: 0.05 });
    const cup = [[CUP_X - 14, cy - 26], [CUP_X + 14, cy - 26], [CUP_X + 9, cy - 3], [CUP_X - 9, cy - 3]];
    washShape(ctx, cup, { color: INK3.paper, alpha: 1, blur: 0, edge: 0, ...o });
    bristleStroke(ctx, [cup[0], cup[3], cup[2], cup[1]], { width: 2.6, color: INK3.nong, alpha: 0.9, bristles: 3, dry: 0.1, seed: 92, ...o });
    ctx.save();
    ctx.strokeStyle = INK3.nong;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.ellipse(CUP_X, cy - 26, 14, 3.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    const c2 = CUP_X + 46;
    washShape(ctx, [[c2 - 9, cy - 22], [c2 + 9, cy - 22], [c2 + 13, cy - 2], [c2 - 13, cy - 2]], { color: INK3.qing, alpha: 0.8, blur: 0, edge: 0, ...o });
    bristleStroke(ctx, [[c2 - 13, cy - 2], [c2 - 9, cy - 22], [c2 + 9, cy - 22], [c2 + 13, cy - 2]], { width: 2.4, color: INK3.nong, alpha: 0.85, bristles: 3, seed: 93, ...o });
  }
  var SHOULDER = [-14, -246];
  var UPPER = 72;
  var FORE = 72;
  var ROBE = "#d6d1c4";
  function manBody() {
    const w = 220, h = 380;
    return baked("s03-man", w * K, h * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(110, 370);
      const o = { px: PX };
      washShape(ctx, [[18, -236], [40, -230], [44, -150], [24, -146]], { color: mix(ROBE, INK3.dan, 0.5), alpha: 0.9, blur: 0.6, edge: 0, ...o });
      const robe = [[-30, -258], [6, -264], [34, -252], [56, -214], [62, -150], [60, -60], [66, 0], [-52, 0], [-50, -80], [-48, -170], [-40, -236]];
      washShape(ctx, robe, { color: ROBE, alpha: 0.95, top: -264, fadeY: 30, blur: 0.8, edge: 0, ...o });
      ctx.save();
      ctx.globalAlpha = 0.5;
      washShape(ctx, robe.slice(2, 7).concat([[30, -40], [20, -200]]), { color: INK3.dan, alpha: 0.55, blur: 2.5, edge: 0, ...o });
      ctx.restore();
      bristleStroke(ctx, [[6, -264], [34, -252], [56, -214], [62, -150], [60, -60], [66, 0]], { width: 5.5, color: INK3.nong, alpha: 0.85, bristles: 7, dry: 0.3, seed: 201, taper: [0.8, 1, 0.5], ...o });
      bristleStroke(ctx, [[-40, -236], [-48, -170], [-50, -80], [-52, 0]], { width: 5, color: INK3.nong, alpha: 0.85, bristles: 7, dry: 0.35, seed: 202, taper: [0.9, 1, 0.4], ...o });
      bristleStroke(ctx, [[10, -140], [14, -80], [8, -20]], { width: 3, color: INK3.zhong, alpha: 0.6, bristles: 4, dry: 0.5, seed: 203, ...o });
      bristleStroke(ctx, [[-20, -130], [-24, -70]], { width: 2.6, color: INK3.zhong, alpha: 0.5, bristles: 4, dry: 0.5, seed: 204, ...o });
      bristleStroke(ctx, [[-30, -256], [-6, -214], [8, -206]], { width: 4, color: INK3.nong, alpha: 0.85, bristles: 5, dry: 0.2, seed: 205, ...o });
      bristleStroke(ctx, [[-50, -158], [6, -152], [60, -158]], { width: 14, color: INK3.jiao, alpha: 0.9, bristles: 9, dry: 0.25, seed: 206, taper: [1, 1, 0.9], ...o });
      bristleStroke(ctx, [[-30, -150], [-36, -110], [-32, -92]], { width: 6, color: INK3.nong, alpha: 0.85, bristles: 5, dry: 0.3, seed: 207, taper: [1, 0.8, 0.4], ...o });
      const hx = -22, hy = -298;
      ctx.save();
      ctx.fillStyle = mix(INK3.paper, INK3.zheshi, 0.45);
      ctx.fill(blobPath(hx, hy, 29, 33, { seed: 3, rough: 0.05 }));
      ctx.fillStyle = rgba(INK3.dan, 0.7);
      ctx.fill(blobPath(hx + 16, hy - 4, 15, 27, { seed: 4, rough: 0.12 }));
      ctx.restore();
      bristleStroke(ctx, [[hx - 10, hy - 32], [hx + 14, hy - 33], [hx + 28, hy - 14], [hx + 27, hy + 12], [hx + 14, hy + 30]], { width: 3.4, color: INK3.nong, alpha: 0.9, bristles: 4, dry: 0.15, seed: 211, ...o });
      bristleStroke(ctx, [[hx - 10, hy - 32], [hx - 26, hy - 20], [hx - 30, hy - 6]], { width: 3, color: INK3.nong, alpha: 0.9, bristles: 4, dry: 0.15, seed: 212, ...o });
      bristleStroke(ctx, [[hx - 29, hy - 6], [hx - 37, hy + 5], [hx - 27, hy + 8]], { width: 3, color: INK3.nong, alpha: 0.9, bristles: 3, seed: 213, ...o });
      inkDot(ctx, hx + 6, hy - 40, 11, { ry: 9, color: INK3.jiao, alpha: 0.9, seed: 214, bleed: 0.25 });
      bristleStroke(ctx, [[hx - 12, hy - 36], [hx + 24, hy - 46]], { width: 2.4, color: mix(INK3.zheshi, INK3.nong, 0.5), alpha: 0.9, bristles: 2, ...o });
      bristleStroke(ctx, [[hx + 6, hy - 6], [hx + 12, hy - 2], [hx + 10, hy + 8], [hx + 5, hy + 9]], { width: 2.2, color: INK3.nong, alpha: 0.8, bristles: 3, ...o });
      bristleStroke(ctx, [[hx - 22, hy - 6], [hx - 16, hy - 10], [hx - 10, hy - 6]], { width: 2.6, color: INK3.jiao, alpha: 0.95, bristles: 3, ...o });
      ctx.save();
      ctx.fillStyle = INK3.paper;
      const brow = new Path2D();
      brow.moveTo(hx - 6, hy - 18);
      brow.quadraticCurveTo(hx - 30, hy - 22, hx - 44, hy + 2);
      brow.quadraticCurveTo(hx - 30, hy - 12, hx - 8, hy - 12);
      brow.closePath();
      ctx.fill(brow);
      ctx.restore();
      bristleStroke(ctx, [[hx - 6, hy - 18], [hx - 30, hy - 21], [hx - 44, hy + 2]], { width: 2, color: INK3.dan, alpha: 0.9, bristles: 3, ...o });
      const beard = new Path2D();
      beard.moveTo(hx - 32, hy + 10);
      beard.quadraticCurveTo(hx - 46, hy + 50, hx - 40, hy + 96);
      beard.quadraticCurveTo(hx - 30, hy + 60, hx - 6, hy + 24);
      beard.closePath();
      ctx.save();
      ctx.fillStyle = INK3.paper;
      ctx.fill(beard);
      ctx.restore();
      for (let k = 0; k < 4; k++) bristleStroke(ctx, [[hx - 30 + k * 5, hy + 12 + k * 3], [hx - 40 + k * 3, hy + 52], [hx - 40 + k * 1.5, hy + 92 - k * 6]], { width: 1.6, color: INK3.dan, alpha: 0.85, bristles: 2, dry: 0.2, seed: 220 + k, ...o });
      bristleStroke(ctx, [[hx - 30, hy + 12], [hx - 22, hy + 16], [hx - 14, hy + 14]], { width: 2, color: INK3.zhong, alpha: 0.8, bristles: 2, ...o });
    });
  }
  function elbowFor(hand) {
    const [sx, sy] = SHOULDER;
    const dx = hand[0] - sx, dy = hand[1] - sy;
    const d = Math.min(UPPER + FORE - 0.5, Math.hypot(dx, dy));
    const a = Math.atan2(dy, dx);
    const c = clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
    const e = a - Math.acos(c);
    return [sx + Math.cos(e) * UPPER, sy + Math.sin(e) * UPPER];
  }
  var HAND_REST = [-82, -214];
  var HAND_UP = [-142, -276];
  function handAt(b) {
    if (b < T_REST[0]) {
      const u2 = ease.inOut(smoothstep(T_LIFT[0], T_LIFT[1], b));
      const lift = [lerp(HAND_REST[0], HAND_UP[0], u2), lerp(HAND_REST[1], HAND_UP[1], u2) - Math.sin(u2 * Math.PI) * 18];
      const pour = smoothstep(T_LAND, T_LAND + 0.3, b) * (1 - smoothstep(T_STOP - 0.3, T_STOP, b));
      return [lift[0] + Math.sin(b * 9.4) * 2 * pour, lift[1] - pour * 10 + Math.sin(b * 6.3) * 2.5 * pour];
    }
    const u = ease.inOut(smoothstep(T_REST[0], T_REST[1], b));
    return [lerp(HAND_UP[0], HAND_REST[0], u), lerp(HAND_UP[1] - 10, HAND_REST[1], u) - Math.sin(u * Math.PI) * 14];
  }
  var tiltAt = (b) => -0.62 * smoothstep(T_TILT[0], T_TILT[1], b) * (1 - smoothstep(T_STOP - 0.1, T_STOP + 0.3, b));
  var SPOUT = [-74, 24];
  function kettle(ctx) {
    const k = baked("s03-kettle", 140 * K, 130 * K, (c) => {
      c.scale(K, K);
      c.translate(96, 16);
      const o = { px: PX };
      c.save();
      c.fillStyle = mix(INK3.zhong, INK3.zheshi, 0.3);
      c.fill(blobPath(0, 64, 37, 31, { seed: 8, rough: 0.04 }));
      c.globalAlpha = 0.6;
      c.fillStyle = INK3.nong;
      c.fill(blobPath(10, 72, 26, 22, { seed: 9, rough: 0.1 }));
      c.restore();
      bristleStroke(c, [[-24, 52], [-14, 42], [0, 38]], { width: 4, color: INK3.paper, alpha: 0.7, bristles: 3, dry: 0.4, seed: 2, ...o });
      const sp = new Path2D();
      sp.moveTo(-30, 66);
      sp.quadraticCurveTo(-52, 58, SPOUT[0], SPOUT[1] + 2);
      sp.lineTo(SPOUT[0] + 4, SPOUT[1] - 4);
      sp.quadraticCurveTo(-48, 44, -32, 50);
      sp.closePath();
      c.fillStyle = INK3.nong;
      c.fill(sp);
      bristleStroke(c, [[-18, 36], [0, 31], [18, 36]], { width: 4, color: INK3.jiao, alpha: 0.9, bristles: 4, ...o });
      inkDot(c, 0, 27, 5, { color: INK3.jiao, seed: 3, bleed: 0.1 });
      bristleStroke(c, [[-28, 44], [-24, 12], [-8, 0], [8, 0], [24, 12], [28, 44]], { width: 5, color: INK3.jiao, alpha: 0.9, bristles: 5, dry: 0.25, seed: 4, ...o });
    });
    ctx.drawImage(k, -96, -16, 140, 130);
  }
  function drawMan(ctx, b, x, y) {
    const breath = Math.sin(b * Math.PI) * 1.2;
    const nod = Math.sin(Math.PI * smoothstep(T_NOD[0], T_NOD[1], b)) * 0.06;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-nod);
    ctx.translate(0, breath * 0.3);
    ctx.drawImage(manBody(), -110, -370, 220, 380);
    const hand = handAt(b), elbow = elbowFor(hand);
    const tilt = tiltAt(b);
    const nrm = (a, c2) => {
      const dx = c2[0] - a[0], dy = c2[1] - a[1], L = Math.hypot(dx, dy) || 1;
      return [-dy / L, dx / L];
    };
    let n1 = nrm(SHOULDER, elbow), n2 = nrm(elbow, hand);
    if (n1[1] > 0) n1 = [-n1[0], -n1[1]];
    if (n2[1] > 0) n2 = [-n2[0], -n2[1]];
    const ne = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
    const P2 = (q, n, w) => [q[0] + n[0] * w, q[1] + n[1] * w];
    const wrist = [hand[0] + (elbow[0] - hand[0]) * 0.12, hand[1] + (elbow[1] - hand[1]) * 0.12];
    const topEdge = [P2(SHOULDER, n1, 17), P2(elbow, ne, 14), P2(wrist, n2, 12)];
    const cuffLow = [wrist[0] - n2[0] * 22 + 4, wrist[1] + 30];
    const botEdge = [P2(SHOULDER, n1, -18), P2(elbow, ne, -16), [lerp(elbow[0], cuffLow[0], 0.55), Math.max(elbow[1], cuffLow[1]) + 8], cuffLow];
    const sl = new Path2D();
    [...topEdge, ...botEdge.slice().reverse()].forEach(([px, py], i) => i ? sl.lineTo(px, py) : sl.moveTo(px, py));
    sl.closePath();
    ctx.save();
    ctx.fillStyle = ROBE;
    ctx.fill(sl);
    ctx.fillStyle = rgba(INK3.dan, 0.35);
    ctx.fill(blobPath(elbow[0], elbow[1] + 8, 16, 12, { seed: 8, rough: 0.2 }));
    ctx.restore();
    bristleStroke(ctx, topEdge, { width: 3.6, color: INK3.nong, alpha: 0.9, bristles: 4, dry: 0.25, seed: 502, spacing: 3 });
    bristleStroke(ctx, botEdge, { width: 3.6, color: INK3.nong, alpha: 0.9, bristles: 4, dry: 0.3, seed: 503, spacing: 3 });
    bristleStroke(ctx, [topEdge[2], cuffLow], { width: 3, color: INK3.nong, alpha: 0.85, bristles: 3, dry: 0.2, seed: 504, spacing: 3 });
    ctx.save();
    ctx.translate(hand[0], hand[1]);
    ctx.rotate(tilt);
    kettle(ctx);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = mix(INK3.paper, INK3.zheshi, 0.45);
    ctx.fill(blobPath(hand[0] + 1, hand[1] - 1, 9, 8, { seed: 6, rough: 0.1 }));
    ctx.restore();
    bristleStroke(ctx, [[hand[0] - 7, hand[1] - 8], [hand[0] - 10, hand[1] + 2], [hand[0] - 3, hand[1] + 7], [hand[0] + 8, hand[1] + 5]], { width: 2.2, color: INK3.nong, alpha: 0.9, bristles: 2, spacing: 2 });
    ctx.restore();
    const c = Math.cos(tilt - nod), s = Math.sin(tilt - nod);
    const hx = hand[0] * Math.cos(-nod) - (hand[1] + breath * 0.3) * Math.sin(-nod), hy = hand[0] * Math.sin(-nod) + (hand[1] + breath * 0.3) * Math.cos(-nod);
    return [x + hx + SPOUT[0] * c - SPOUT[1] * s, y + hy + SPOUT[0] * s + SPOUT[1] * c];
  }
  function linePts(cg, cEnd) {
    const xa = LINE_L + cg, xb = cEnd + X_MAX + 260;
    const pts = [];
    for (let x = xa; x <= xb; x += 6) pts.push([x, lineY(x - cg)]);
    return pts;
  }
  function lineLayer(env) {
    const cg = env.camAt(GAG), cEnd = env.camAt(16.5);
    return strip("s03-inkline", 1, (ctx, x0, x1) => {
      const pts = linePts(cg, cEnd).filter(([x]) => x > x0 && x < x1);
      inkRibbon(ctx, pts, { width: 17, vary: 0.55, seed: 7, px: PX, bleed: 4, dry: 0.55, taper: 60 });
      inkDot(ctx, LAND_X + cg, lineY(LAND_X) + 1, 30, { ry: 9, seed: 31, bleed: 0.5, alpha: 0.9 });
      inkDot(ctx, CHAR_X + cg - 10, lineY(CHAR_X - 10) + 1, 22, { ry: 6, seed: 32, bleed: 0.5, alpha: 0.75 });
    }, { y0: ROAD_Y - 20, y1: ROAD_Y + 45 });
  }
  function lineEnds(b, env) {
    if (b < T_LAND) return null;
    const left = lerp(LAND_X, LINE_L, ease.out(smoothstep(T_LAND, T_FEET, b)));
    const grow = lerp(LAND_X, X_MAX + 90, ease.inOut(smoothstep(T_AHEAD[0], T_AHEAD[1], b)));
    const ahead = b >= T_AHEAD[1] ? env.cam - env.camAt(GAG) + X_MAX + 90 : -Infinity;
    const spread = 30 * ease.out(smoothstep(T_LAND, T_LAND + 0.25, b));
    return [Math.min(left, LAND_X - spread), Math.max(grow, ahead, LAND_X + spread)];
  }
  function drawInkLine(ctx, b, env) {
    const E = lineEnds(b, env);
    if (!E) return;
    const off = env.camAt(GAG) - env.cam;
    const S = lineLayer(env);
    const xa = E[0] + off - (E[0] <= LINE_L + 1 ? 30 : 0), xb = E[1] + off;
    ctx.save();
    ctx.beginPath();
    ctx.rect(xa, ROAD_Y - 30, xb - xa, 90);
    ctx.clip();
    drawStrip(ctx, S, env.cam);
    ctx.restore();
    if (b < T_FEET + 0.15) {
      const k = 1 - smoothstep(T_FEET - 0.1, T_FEET + 0.15, b);
      inkDot(ctx, E[0] + off, lineY(E[0]) - 0.5, 9 * k + 2, { ry: 6.5 * k + 1.5, seed: Math.floor(b * 8), bleed: 0.3 });
    }
    if (b < T_AHEAD[1] + 0.2 && b > T_AHEAD[0]) inkDot(ctx, xb, lineY(E[1]) - 0.5, 10, { ry: 7, seed: Math.floor(b * 8) + 3, bleed: 0.3 });
  }
  function drawSplash(ctx, b, env) {
    if (b < T_LAND) return;
    const off = env.camAt(GAG) - env.cam;
    const u = clamp((b - T_LAND) / 0.32);
    for (let k = 0; k < 16; k++) {
      const dir = hash2(k, 1, 3) < 0.5 ? -1 : 1;
      const dist2 = 20 + hash2(k, 2, 3) * 110;
      const hgt = 30 + hash2(k, 3, 3) * 70;
      const fx = LAND_X + dir * dist2 * ease.out(u), fy = lineY(LAND_X) + (hash2(k, 4, 3) - 0.3) * 26 - Math.sin(Math.PI * u) * hgt;
      const r = 2 + hash2(k, 5, 3) * 4.5;
      inkDot(ctx, fx + off, fy, r * (u < 1 ? 1 : 1.25), { ry: u < 1 ? r : r * 0.55, seed: k + 60, bleed: 0.25, alpha: 0.88 });
    }
  }
  function drawSteps(ctx, b, env) {
    for (let k = GAG + 4; k < 17; k++) {
      if (b < k) break;
      const u = clamp((b - k) / 0.3);
      const wx = env.camAt(k) + CHAR_X + 62;
      const sx = wx - env.cam;
      if (sx < X_MIN - 40 || sx > X_MAX + 40) continue;
      for (let j = 0; j < 6; j++) {
        const dir = j % 2 ? 1 : -1;
        const fx = sx + dir * (10 + hash2(k, j, 9) * 40) * ease.out(u), fy = lineY(wx - env.camAt(GAG)) - Math.sin(Math.PI * u) * (12 + hash2(j, k, 9) * 24) + hash2(k, j + 7, 9) * 8;
        const r = 1.6 + hash2(k, j + 3, 9) * 2.6;
        inkDot(ctx, fx, fy, r, { ry: u < 1 ? r : r * 0.6, seed: k * 10 + j, bleed: 0.2, alpha: 0.85 });
      }
    }
  }
  var circle2 = (ctx, x, y, r) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  function drawBirds(ctx, b, cam) {
    for (let k = 0; k < 3; k++) {
      const x = 700 + k * 80 + b * 40 - cam * 0.05, y = 300 + k % 2 * 30 + Math.sin(b * 1.3 + k) * 8;
      const flap = Math.sin(b * Math.PI * 2 + k * 1.7);
      if (x < X_MIN - 30 || x > X_MAX + 30) continue;
      ctx.save();
      ctx.strokeStyle = INK3.nong;
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(x - 12, y - 4 * flap);
      ctx.quadraticCurveTo(x - 5, y - 6 * flap - 2, x, y);
      ctx.quadraticCurveTo(x + 5, y - 6 * flap - 2, x + 12, y - 4 * flap);
      ctx.stroke();
      ctx.restore();
    }
  }
  function drawSteam(ctx, b, x, y) {
    ctx.save();
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      const ph = (b * 0.55 + k / 3) % 1;
      const a = Math.sin(Math.PI * ph) * 0.55;
      ctx.strokeStyle = rgba(INK3.dan, a);
      ctx.lineWidth = 3 - ph * 1.5;
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const t = s / 12;
        const yy = y - 10 - (ph * 70 + t * 70);
        const xx = x + (k - 1) * 8 + Math.sin(t * 5 + b * 2 + k) * (6 + t * 10);
        s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawFlag(ctx, b, x) {
    const top = 248, cross = 268;
    bristleStroke(ctx, [[x, ROAD_Y - 6], [x + 3, top]], { width: 9, color: INK3.nong, alpha: 0.85, bristles: 6, dry: 0.3, seed: 601, taper: [1, 0.9, 0.7], spacing: 4 });
    ctx.save();
    ctx.strokeStyle = INK3.nong;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x + 2, cross);
    ctx.lineTo(x + 92, cross - 6);
    ctx.stroke();
    const W2 = 84, H2 = 200;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push([x + 6 + W2 * t, cross - 6 * t + 3]);
    }
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      pts.push([x + 6 + W2 + Math.sin(b * 2.6 + t * 3) * 6 * t + t * 4, cross + H2 * t]);
    }
    for (let i = 10; i >= 0; i--) {
      const t = i / 10;
      pts.push([x + 6 + W2 * t + Math.sin(b * 2.6 + 3 + t * 2) * 7, cross + H2 + Math.sin(b * 3.1 + t * 6) * 5 * t - 6 * t]);
    }
    for (let i = 12; i >= 0; i--) {
      const t = i / 12;
      pts.push([x + 6 + Math.sin(b * 2.6 + t * 2) * 3 * t, cross + H2 * t]);
    }
    const p = new Path2D();
    pts.forEach(([px, py], i) => i ? p.lineTo(px, py) : p.moveTo(px, py));
    p.closePath();
    ctx.fillStyle = "#efe8d6";
    ctx.fill(p);
    ctx.clip(p);
    ctx.fillStyle = rgba(INK3.seal, 0.85);
    ctx.fillRect(x, cross - 10, W2 + 20, 18);
    ctx.fillStyle = rgba(INK3.dan, 0.18);
    ctx.fillRect(x + W2 * 0.55, cross, W2, H2 + 20);
    const cx = x + 6 + W2 / 2 + Math.sin(b * 2.6 + 1.5) * 3, cy = cross + 112;
    ctx.fillStyle = rgba(INK3.nong, 0.85);
    ctx.fill(blobPath(cx + 2, cy, 22, 17, { seed: 12, rough: 0.05 }));
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy + 2);
    ctx.quadraticCurveTo(cx - 30, cy - 2, cx - 36, cy - 16);
    ctx.lineTo(cx - 31, cy - 17);
    ctx.quadraticCurveTo(cx - 26, cy - 8, cx - 14, cy - 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 9, cy - 21, 22, 5);
    circle2(ctx, cx + 2, cy - 24, 4);
    ctx.strokeStyle = rgba(INK3.nong, 0.85);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx + 24, cy - 1, 9, -1.3, 1.3);
    ctx.stroke();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = rgba(INK3.zhong, 0.7);
    ctx.beginPath();
    ctx.moveTo(cx + 2, cy - 32);
    ctx.bezierCurveTo(cx - 8, cy - 44, cx + 12, cy - 52, cx + 2, cy - 66);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = rgba(INK3.nong, 0.8);
    ctx.lineWidth = 2.2;
    ctx.stroke(p);
    ctx.restore();
  }
  function fgLayer(cg) {
    return strip("s03-fg", P_FG2, (ctx, x0, x1) => {
      const R = R0("fg");
      for (let x = x0 + 100; x < x1; x += 380 + R() * 420) {
        const sx = x - cg * P_FG2;
        if (sx > 40 && sx < 1100) continue;
        grassTuft(ctx, x, 1010, 90 + R() * 60, { seed: Math.round(x), color: INK3.zhong, alpha: 0.55, blades: 7, spread: 1.4, px: PX });
        grassTuft(ctx, x + 40, 1012, 60 + R() * 40, { seed: Math.round(x) + 1, color: INK3.dan, alpha: 0.5, blades: 5, spread: 1.2, px: PX });
      }
    }, { y0: 840, y1: 1030 });
  }
  function inkCassette(ctx, cx, cy, s, spin) {
    const w = 200 * s, h = 128 * s;
    const body = baked("s03-cassette", w + 40, h + 40, (c) => {
      c.translate(20 + w / 2, 20 + h / 2);
      c.save();
      c.shadowColor = "rgba(60,45,25,0.22)";
      c.shadowBlur = 12;
      c.shadowOffsetY = 4;
      c.fillStyle = INK3.paper;
      c.fill(blobPath(0, 0, w / 2 + 2, h / 2 + 2, { seed: 5, rough: 0.012, n: 60 }));
      c.restore();
      const rect = (x0, y0, x1, y1, o) => bristleStroke(c, [[x0, y0], [x1, y0 + 1], [x1 - 1, y1], [x0 + 1, y1 - 1], [x0, y0 + 2]], o);
      rect(-w / 2 + 4, -h / 2 + 4, w / 2 - 4, h / 2 - 4, { width: 4.5, color: INK3.jiao, alpha: 0.9, bristles: 7, dry: 0.35, seed: 11, spacing: 1.6, taper: [1, 0.9, 0.7] });
      c.save();
      c.fillStyle = rgba(INK3.dan, 0.28);
      c.fill(blobPath(0, -h / 2 + 46, w / 2 - 20, 30, { seed: 7, rough: 0.05 }));
      c.restore();
      rect(-w / 2 + 16, -h / 2 + 14, w / 2 - 16, -h / 2 + 78, { width: 2.6, color: INK3.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 12, spacing: 1.6 });
      sealStamp(c, w / 2 - 30, -h / 2 + 28, 18, { seed: 5 });
      c.save();
      c.fillStyle = INK3.paper;
      c.fill(blobPath(0, -h / 2 + 51, 50, 15, { seed: 8, rough: 0.03 }));
      c.restore();
      bristleStroke(c, [[-50, -h / 2 + 36], [50, -h / 2 + 36], [52, -h / 2 + 66], [-50, -h / 2 + 66], [-50, -h / 2 + 37]], { width: 2.4, color: INK3.nong, alpha: 0.85, bristles: 3, seed: 13, spacing: 1.6 });
      bristleStroke(c, [[-60, h / 2 - 4], [-48, h / 2 - 30], [48, h / 2 - 30], [60, h / 2 - 4]], { width: 3, color: INK3.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 14, spacing: 1.6 });
      for (const sx of [-1, 1]) inkDot(c, sx * 30, h / 2 - 15, 4.5, { color: INK3.jiao, seed: 15 + sx, bleed: 0.2 });
    });
    ctx.drawImage(body, cx - w / 2 - 20, cy - h / 2 - 20);
    for (const sx of [-1, 1]) {
      const rx = cx + sx * 34 * s, ry = cy - h / 2 + 51 * s;
      ctx.save();
      ctx.fillStyle = rgba(INK3.nong, 0.85);
      ctx.beginPath();
      ctx.arc(rx, ry, (sx < 0 ? 15 : 11) * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = INK3.paper;
      ctx.beginPath();
      ctx.arc(rx, ry, 8 * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(rx, ry);
      ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
      ctx.strokeStyle = INK3.jiao;
      ctx.lineWidth = 2.4 * s;
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, -3 * s);
        ctx.lineTo(0, -7.5 * s);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
  var s03 = {
    id: "s03",
    station: ST3,
    figureStyle: "ink",
    // 人物（墨色）在中墨山坡、竹丛前：加一圈宣纸色留白边，保证轮廓反差
    figureRim: { color: "#f7f3e8", width: 5, alpha: 0.95 },
    freezeBeat: GAG + 2.5,
    // Outro 展墙：墨线已经铺开，老人还在倒
    drawBack(ctx, b, env) {
      const cam = env.cam, cg = env.camAt(GAG);
      const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1e3 * K);
      ctx.drawImage(xuanPaper(pw, ph, { seed: 3 }), X_MIN, 0, X_MAX - X_MIN, 1e3);
      drawStrip(ctx, skyLayer2(), cam);
      drawBirds(ctx, b, cam);
      drawStrip(ctx, far1Layer(), cam);
      drawStrip(ctx, far2Layer(), cam);
      drawStrip(ctx, mistLayer(), cam - b * 10 / P_MIST);
      drawStrip(ctx, midLayer2(cg), cam);
      drawStrip(ctx, nearLayer(cg), cam);
      drawStrip(ctx, roadLayer2(), cam);
      const off = cg - cam;
      if (SHED_BOX.x1 + off > X_MIN && SHED_BOX.x0 + off < X_MAX + 60) {
        const { x0, x1, y0, y1 } = SHED_BOX;
        ctx.drawImage(shedImage("back"), x0 + off, y0, x1 - x0, y1 - y0);
        drawSteam(ctx, b, 965 + off, MAN_BASE - 134);
        const tip = drawMan(ctx, b, MAN_X + off, MAN_BASE);
        ctx.drawImage(shedImage("front"), x0 + off, y0, x1 - x0, y1 - y0);
        drawFlag(ctx, b, FLAG_X + off);
        drawInkLine(ctx, b, env);
        drawSplash(ctx, b, env);
        if (b >= T_SPOUT && b < T_STOP + 0.5) {
          const p2 = [LAND_X + off, lineY(LAND_X) - 2];
          const p1 = [lerp(tip[0], p2[0], 0.62), tip[1] + 8];
          const t1 = b < T_LAND ? ease.in(clamp((b - T_SPOUT) / (T_LAND - T_SPOUT))) : 1;
          const t0 = b < T_STOP ? 0 : ease.in(clamp((b - T_STOP) / 0.45));
          inkStream(ctx, tip, p1, p2, t0, t1, { w0: 6, w1: 10, wobble: 2.5, phase: b, seed: 3 });
        }
      } else {
        drawInkLine(ctx, b, env);
      }
    },
    drawFront(ctx, b, env) {
      drawSteps(ctx, b, env);
      drawStrip(ctx, fgLayer(env.camAt(GAG)), env.cam);
    },
    drawFrame(ctx, R) {
      handscrollFrame(ctx, R);
    },
    cardStyle: {
      ink: INK3.jiao,
      accent: INK3.seal,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        const { canvas, pad } = paperCard(w, h, { seed: 31, sealSize: 44, key: "s03-card" });
        ctx.drawImage(canvas, x - pad, y - pad);
      }
    },
    playerStyle: {
      ink: INK3.jiao,
      noteColor: INK3.seal,
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        const { canvas, pad } = paperCard(w, h, { seed: 41, seal: false, key: "s03-plate" });
        ctx.drawImage(canvas, x - pad, y - pad);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        inkCassette(ctx, cx, cy, s, spin);
      }
    }
  };

  // src/scenes/s04.js
  var ST4 = stationByN(4);
  var STONE = "#efe9dc";
  var STONE_M = "#e3dbcb";
  var STONE_D = "#d2c7b3";
  var STONE_L = "#f7f3ea";
  var JOINT = "#c9bda7";
  var LEAD2 = "#3c3a44";
  var INK4 = "#3c3a44";
  var BLUE = "#3b7cc2";
  var BLUE_D = "#2f6fb0";
  var RUBY = "#cc4434";
  var AMBER = "#efbe52";
  var GREEN = "#44a573";
  var PURPLE = "#8259ad";
  var PALE1 = "#f1f3ea";
  var PALE2 = "#f6edd3";
  var PALE3 = "#e1ecf3";
  var SKY = "#a6cbe8";
  var ROSE = "#e8968a";
  var SUN = "#fff3cf";
  var OAK = "#e0c597";
  var P_FAR3 = 0.35;
  var P_BFLOOR = 0.6;
  var P_PIER = 0.75;
  var P_FG3 = 1.3;
  var WALL_BOT = 740;
  var SL = 0.75;
  var LW = 1.5;
  var T_GLASS = GAG;
  var T_SUN = B(3, 3);
  var T_BACK = GAG + 4;
  registerStyle("s04-comic", (I) => comicBase(I, { levels: 4, keep: 0.2, lw: 2.2, inner: 0.55, ink: "#25222a" }));
  registerStyle("s04-glass", (I) => {
    const w = I.w, h = I.h, n = w * h;
    const S = smoothColor(I, 2);
    const L = lumaArray(S, 0.55);
    const E = sobel(lumaArray(smoothColor(I, 0.8), 0.55), w, h);
    const O = clone(S);
    const cell = 15;
    const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3;
    const seeds = [];
    for (let gy = -1; gy < gh - 1; gy++) for (let gx = -1; gx < gw - 1; gx++) {
      seeds.push([(gx + 0.15 + hash2(gx, gy, 31) * 0.7) * cell, (gy + 0.15 + hash2(gx, gy, 32) * 0.7) * cell]);
    }
    const near = new Int32Array(n), d1a = new Float32Array(n), d2a = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let d1 = 1e9, d2 = 1e9, k1 = 0;
      const cx = Math.floor(x / cell) + 1, cy = Math.floor(y / cell) + 1;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const k = (cy + oy) * gw + (cx + ox);
        const s = seeds[k];
        if (!s) continue;
        const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
        if (d < d1) {
          d2 = d1;
          d1 = d;
          k1 = k;
        } else if (d < d2) d2 = d;
      }
      near[i] = k1;
      d1a[i] = Math.sqrt(d1);
      d2a[i] = Math.sqrt(d2);
    }
    const isSkin = (i) => I.r[i] > 0.38 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
    let top = h, bot = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (I.a[y * w + x] > 0.5) {
      top = Math.min(top, y);
      bot = Math.max(bot, y);
    }
    const stats = /* @__PURE__ */ new Map();
    for (let i = 0; i < n; i++) {
      if (I.a[i] < 0.5) continue;
      let s = stats.get(near[i]);
      if (!s) {
        s = [0, 0, 0, 0];
        stats.set(near[i], s);
      }
      s[0] += L[i];
      s[1]++;
      if (isSkin(i)) s[2]++;
      s[3] += Math.floor(i / w);
    }
    const pickW = (t, list) => {
      let acc2 = 0;
      const tot = list.reduce((a, c) => a + c[1], 0);
      for (const [c, wt] of list) {
        acc2 += wt / tot;
        if (t < acc2) return c;
      }
      return list[list.length - 1][0];
    };
    const REGION = {
      hair: [[PURPLE, 3], ["#5a4a9e", 2], [BLUE_D, 2]],
      shirt: [[BLUE, 4], ["#4f8fd0", 3], [BLUE_D, 2], ["#2f8f8b", 1.2], [SKY, 0.8]],
      pants: [[PURPLE, 3], ["#6b52a8", 2], [BLUE_D, 1.5], ["#9a6cc0", 1]],
      shoes: [[RUBY, 3], [AMBER, 1]]
    };
    const col = /* @__PURE__ */ new Map();
    for (const [k, s] of stats) {
      const l = s[0] / s[1], skin = s[2] / s[1] > 0.45, t = hash2(k, 7, 41);
      const yn = (s[3] / s[1] - top) / Math.max(1, bot - top);
      let c;
      if (skin) c = pickW(t, [["#f6dc9c", 3], ["#f8ead0", 2], ["#efc47e", 2], ["#f2c9a8", 1]]);
      else {
        const reg = yn < 0.15 ? "hair" : yn < 0.5 ? "shirt" : yn < 0.93 ? "pants" : "shoes";
        c = pickW(t, REGION[reg]);
        if (l > 0.5) c = mix(c, "#ffffff", 0.3);
      }
      col.set(k, { c: rgbf(c), l });
    }
    const lead = rgbf(LEAD2), paint = rgbf("#6a4330");
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (I.a[i] < 0.02) continue;
      const C = col.get(near[i]) || { c: rgbf(BLUE), l: 0.2 };
      const glow2 = 0.92 + 0.14 * (1 - Math.min(1, d1a[i] / cell));
      const tone2 = 1 + Math.max(-0.12, Math.min(0.12, (L[i] - C.l) * 0.6));
      const ripple = 1 + (noise2(x * 0.11, y * 0.05, 33) - 0.5) * 0.12;
      const k = glow2 * tone2 * ripple;
      let r = Math.min(1, C.c[0] * k), g = Math.min(1, C.c[1] * k), bl = Math.min(1, C.c[2] * k);
      const ld = sstep(1, 2, d2a[i] - d1a[i]);
      r = lead[0] + (r - lead[0]) * ld;
      g = lead[1] + (g - lead[1]) * ld;
      bl = lead[2] + (bl - lead[2]) * ld;
      const skin = isSkin(i);
      const e = skin ? sstep(0.22, 0.5, E[i]) * 0.9 : sstep(0.5, 0.85, E[i]) * 0.85;
      const pc2 = skin ? paint : lead;
      r += (pc2[0] - r) * e;
      g += (pc2[1] - g) * e;
      bl += (pc2[2] - bl) * e;
      O.r[i] = r;
      O.g[i] = g;
      O.b[i] = bl;
      O.a[i] = I.a[i] > 0.5 ? 1 : I.a[i];
    }
    outline(O, I.a, 2, lead);
    return O;
  });
  function lancet(x, y, w, h) {
    const p = new Path2D();
    const sy = y + w * 0.866;
    p.moveTo(x, y + h);
    p.lineTo(x, sy);
    p.arc(x + w, sy, w, Math.PI, Math.PI * 4 / 3);
    p.arc(x, sy, w, -Math.PI / 3, 0);
    p.lineTo(x + w, y + h);
    p.closePath();
    return p;
  }
  var shade = (hex, k) => k >= 0 ? mix(hex, "#ffffff", k) : mix(hex, "#000000", -k);
  function glassFill(ctx, path, c, seed) {
    ctx.fillStyle = shade(c, (hash2(seed, 3, 77) - 0.5) * 0.16);
    ctx.fill(path);
  }
  function leadStroke(ctx, path, lw = LW) {
    ctx.strokeStyle = LEAD2;
    ctx.lineWidth = lw;
    ctx.lineJoin = "round";
    ctx.stroke(path);
  }
  function borderBand(ctx, x, y, w, h, cols, seed) {
    const outer = lancet(x, y, w, h), inner = lancet(x + 8, y + 9, w - 16, h - 16);
    ctx.save();
    ctx.clip(outer);
    ctx.fillStyle = cols[0];
    ctx.fill(outer);
    ctx.setLineDash([9, 9]);
    ctx.lineWidth = 9;
    ctx.strokeStyle = cols[1];
    ctx.lineDashOffset = seed;
    const mid = lancet(x + 4, y + 4.5, w - 8, h - 8);
    ctx.stroke(mid);
    ctx.setLineDash([]);
    ctx.strokeStyle = LEAD2;
    ctx.lineWidth = LW * 0.8;
    ctx.setLineDash([1.2, 7.8]);
    ctx.lineDashOffset = seed;
    ctx.lineWidth = 9;
    ctx.stroke(mid);
    ctx.setLineDash([]);
    ctx.restore();
    leadStroke(ctx, outer);
    leadStroke(ctx, inner);
    return inner;
  }
  function quarry(ctx, x, y, w, h, v = 0) {
    const R = rng("s04-quarry", v);
    const accent = [[RUBY, BLUE], [BLUE, AMBER], [GREEN, RUBY]][v % 3];
    const inner = borderBand(ctx, x, y, w, h, accent, v * 5);
    ctx.save();
    ctx.clip(inner);
    const dx = (w - 16) / 3, dy = dx * 1.5;
    for (let j = -1; j < h / dy * 2 + 2; j++) for (let i = -1; i < 5; i++) {
      const cx = x + 8 + (i + (j % 2 ? 0.5 : 0)) * dx, cy = y + j * dy / 2;
      const p = new Path2D();
      p.moveTo(cx, cy - dy / 2);
      p.lineTo(cx + dx / 2, cy);
      p.lineTo(cx, cy + dy / 2);
      p.lineTo(cx - dx / 2, cy);
      p.closePath();
      const t = R();
      glassFill(ctx, p, t < 0.4 ? PALE1 : t < 0.7 ? PALE2 : t < 0.9 ? PALE3 : SKY, i * 31 + j);
      leadStroke(ctx, p);
    }
    for (let j = 0; j < h / dy * 2 + 2; j += 2) for (let i = 0; i < 4; i++) {
      const cx = x + 8 + i * dx + dx / 2, cy = y + j * dy / 2 + dy / 2;
      const p = new Path2D();
      p.rect(cx - 4, cy - 4, 8, 8);
      glassFill(ctx, p, (i + j / 2) % 2 ? accent[1] : AMBER, i + j);
      leadStroke(ctx, p, LW * 0.8);
    }
    ctx.restore();
  }
  function medallion(ctx, x, y, w, h, v = 0) {
    const R = rng("s04-med", v);
    const inner = borderBand(ctx, x, y, w, h, [AMBER, RUBY], v * 7);
    ctx.save();
    ctx.clip(inner);
    const q = 12;
    for (let yy = y; yy < y + h; yy += q) for (let xx = x + 8; xx < x + w - 8; xx += q) {
      const p = new Path2D();
      p.rect(xx, yy, q, q);
      const t = R();
      glassFill(ctx, p, t < 0.75 ? BLUE : t < 0.9 ? BLUE_D : RUBY, xx * 3 + yy);
      leadStroke(ctx, p, LW * 0.7);
    }
    const r = (w - 16) * 0.42, cx = x + w / 2;
    const sets2 = [[RUBY, AMBER, GREEN], [GREEN, AMBER, PURPLE], [PURPLE, PALE2, RUBY]];
    let k = 0;
    for (let cy = y + w * 0.75; cy < y + h - r * 0.8; cy += r * 2.35, k++) {
      const [c1, c2, c3] = sets2[(k + v) % 3];
      const ring = new Path2D();
      ring.arc(cx, cy, r, 0, TAU);
      glassFill(ctx, ring, c1, k);
      const N = 8;
      for (let i = 0; i < N; i++) {
        const a0 = i / N * TAU + k * 0.2, a1 = a0 + TAU / N;
        const p = new Path2D();
        p.arc(cx, cy, r * 0.82, a0, a1);
        p.arc(cx, cy, r * 0.42, a1, a0, true);
        p.closePath();
        glassFill(ctx, p, i % 2 ? c2 : c3, i + k * 9);
        leadStroke(ctx, p);
      }
      const hub = new Path2D();
      hub.arc(cx, cy, r * 0.42, 0, TAU);
      glassFill(ctx, hub, c2 === AMBER ? PALE2 : AMBER, k + 50);
      leadStroke(ctx, hub);
      const dot = new Path2D();
      dot.arc(cx, cy, r * 0.16, 0, TAU);
      glassFill(ctx, dot, RUBY, k + 60);
      leadStroke(ctx, dot);
      leadStroke(ctx, ring);
    }
    ctx.restore();
  }
  function ribbon(ctx, x, y, w, h, v = 0) {
    const R = rng("s04-rib", v);
    const inner = borderBand(ctx, x, y, w, h, [GREEN, AMBER], v * 3);
    ctx.save();
    ctx.clip(inner);
    const cols = [[SKY, GREEN, AMBER, PURPLE, ROSE], [AMBER, RUBY, PALE2, BLUE, GREEN], [PALE3, BLUE, AMBER, GREEN, RUBY]][v % 3];
    const bands = 4;
    const edge = (k, yy) => x + 8 + (w - 16) * k / bands + (k > 0 && k < bands ? Math.sin(yy * 0.045 + k * 1.7 + v) * 8 : 0);
    const bar = 34;
    for (let yy = y; yy < y + h; yy += bar) {
      for (let k = 0; k < bands; k++) {
        const p = new Path2D();
        const N = 6;
        for (let s = 0; s <= N; s++) {
          const t = yy + bar * s / N;
          s ? p.lineTo(edge(k, t), t) : p.moveTo(edge(k, t), t);
        }
        for (let s = N; s >= 0; s--) {
          const t = yy + bar * s / N;
          p.lineTo(edge(k + 1, t), t);
        }
        p.closePath();
        glassFill(ctx, p, cols[(k + Math.floor((yy - y) / bar) * 2 + Math.floor(R() * 1.4)) % cols.length], k * 13 + yy);
        leadStroke(ctx, p);
      }
    }
    for (let i = 0; i < 6; i++) {
      const p = new Path2D();
      p.arc(x + 14 + R() * (w - 28), y + w * 0.5 + R() * (h - w * 0.6), 5 + R() * 3, 0, TAU);
      glassFill(ctx, p, i % 2 ? RUBY : PALE2, i);
      leadStroke(ctx, p);
    }
    ctx.restore();
  }
  function roseWindow(ctx, cx, cy, r) {
    const disk = new Path2D();
    disk.arc(cx, cy, r, 0, TAU);
    ctx.save();
    ctx.clip(disk);
    glassFill(ctx, disk, BLUE, 1);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU - Math.PI / 2;
      const foil = new Path2D();
      foil.arc(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74, r * 0.22, 0, TAU);
      glassFill(ctx, foil, [GREEN, AMBER, PURPLE, AMBER][i % 4], i + 10);
      leadStroke(ctx, foil);
      const fc = new Path2D();
      fc.arc(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74, r * 0.08, 0, TAU);
      glassFill(ctx, fc, RUBY, i + 20);
      leadStroke(ctx, fc);
      const a2 = a + Math.PI / N;
      const tri = new Path2D();
      tri.moveTo(cx + Math.cos(a2) * r * 0.98, cy + Math.sin(a2) * r * 0.98);
      tri.lineTo(cx + Math.cos(a2 - 0.18) * r * 0.62, cy + Math.sin(a2 - 0.18) * r * 0.62);
      tri.lineTo(cx + Math.cos(a2 + 0.18) * r * 0.62, cy + Math.sin(a2 + 0.18) * r * 0.62);
      tri.closePath();
      glassFill(ctx, tri, RUBY, i + 30);
      leadStroke(ctx, tri);
    }
    for (let i = 0; i < N; i++) {
      const a0 = i / N * TAU - Math.PI / 2 + Math.PI / N, a1 = a0 + TAU / N;
      const p = new Path2D();
      p.arc(cx, cy, r * 0.48, a0, a1);
      p.arc(cx, cy, r * 0.2, a1, a0, true);
      p.closePath();
      glassFill(ctx, p, i % 2 ? RUBY : SKY, i + 40);
      leadStroke(ctx, p);
    }
    const hub = new Path2D();
    hub.arc(cx, cy, r * 0.2, 0, TAU);
    glassFill(ctx, hub, AMBER, 50);
    leadStroke(ctx, hub);
    const eye = new Path2D();
    eye.arc(cx, cy, r * 0.08, 0, TAU);
    glassFill(ctx, eye, PALE2, 51);
    leadStroke(ctx, eye);
    ctx.restore();
    leadStroke(ctx, disk);
  }
  var GIANT = { w: 300, h: 540, rose: [150, 150, 78], l: [[16, 262, 120, 278], [164, 262, 120, 278]] };
  function giantWindow(ctx, x, y, glassOnly = false) {
    const { w, h } = GIANT;
    const outer = lancet(x, y, w, h);
    ctx.save();
    ctx.clip(outer);
    const q = 13;
    for (let yy = y; yy < y + h; yy += q) for (let xx = x; xx < x + w; xx += q) {
      const p = new Path2D();
      p.rect(xx, yy, q, q);
      const t = hash2(xx, yy, 5);
      glassFill(ctx, p, t < 0.7 ? BLUE : t < 0.85 ? RUBY : AMBER, xx + yy);
      leadStroke(ctx, p, LW * 0.7);
    }
    medallion(ctx, x + GIANT.l[0][0], y + GIANT.l[0][1], GIANT.l[0][2], GIANT.l[0][3], 1);
    ribbon(ctx, x + GIANT.l[1][0], y + GIANT.l[1][1], GIANT.l[1][2], GIANT.l[1][3], 2);
    roseWindow(ctx, x + GIANT.rose[0], y + GIANT.rose[1], GIANT.rose[2]);
    ctx.restore();
    if (glassOnly) return;
    const bar = (path, lw) => {
      ctx.strokeStyle = STONE_D;
      ctx.lineWidth = lw + 3;
      ctx.stroke(path);
      ctx.strokeStyle = STONE_L;
      ctx.lineWidth = lw;
      ctx.stroke(path);
    };
    const ring = new Path2D();
    ring.arc(x + GIANT.rose[0], y + GIANT.rose[1], GIANT.rose[2] + 4, 0, TAU);
    bar(ring, 9);
    for (const [lx, ly, lw2, lh] of GIANT.l) bar(lancet(x + lx - 4, y + ly - 4, lw2 + 8, lh + 8), 8);
    bar(outer, 12);
  }
  var DESIGNS = [
    (c, x, y, w, h) => quarry(c, x, y, w, h, 0),
    (c, x, y, w, h) => medallion(c, x, y, w, h, 0),
    (c, x, y, w, h) => ribbon(c, x, y, w, h, 0),
    (c, x, y, w, h) => quarry(c, x, y, w, h, 1),
    (c, x, y, w, h) => ribbon(c, x, y, w, h, 1),
    (c, x, y, w, h) => medallion(c, x, y, w, h, 2)
  ];
  var WIN = { w: 104, top: 168, h: 410 };
  function lightPattern(kind) {
    return memo(`s04-pat|${kind}`, () => {
      const giant = kind === "giant";
      const w = giant ? 75 : 26, h = giant ? 135 : 104;
      const c = makeCanvas(w, h), g = c.getContext("2d");
      if (giant) {
        g.scale(w / GIANT.w, h / GIANT.h);
        giantWindow(g, 0, 0, true);
      } else {
        g.scale(w / WIN.w, h / WIN.h);
        DESIGNS[kind % DESIGNS.length](g, 0, 0, WIN.w, WIN.h);
      }
      const pad = 4, o = makeCanvas(w + pad * 2, h + pad * 2), og = o.getContext("2d");
      og.filter = "blur(1.3px)";
      og.drawImage(c, pad, pad);
      return o;
    });
  }
  function bandTransform(ctx, img, fx, fy, w, y0, y1) {
    const H2 = y1 - y0;
    ctx.transform(w / img.width, 0, -SL * H2 / img.height, H2 / img.height, fx - w / 2 + SL * (fy - y0), y0);
  }
  function castLight(ctx, draw, tint, add) {
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = tint;
    draw();
    ctx.restore();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = add;
    draw();
    ctx.restore();
  }
  var gagCam = (env) => Math.round(env.camAt(GAG));
  var giantX = (gc) => 585 + gc * P_FAR3;
  function farLayer3(gc) {
    return strip(`s04-far-${gc}`, P_FAR3, (ctx, x0, x1) => {
      const R = rng("s04-far");
      const GX2 = giantX(gc);
      ctx.fillStyle = STONE;
      ctx.fillRect(x0, 0, x1 - x0, WALL_BOT);
      const ch = 44;
      for (let row = 0, y = 130; y < WALL_BOT; row++, y += ch) {
        const off = row % 2 ? 37 : 0;
        for (let x = x0 - 74 + off; x < x1; x += 74) {
          const t = hash2(Math.round(x), row, 11);
          ctx.fillStyle = rgba(t < 0.5 ? "#ffffff" : "#cbbfa8", 0.06 + 0.1 * hash2(Math.round(x), row, 12));
          ctx.fillRect(x + 1, y + 1, 72, ch - 2);
        }
        ctx.fillStyle = rgba(JOINT, 0.55);
        ctx.fillRect(x0, y, x1 - x0, 1.4);
        for (let x = x0 - 74 + off; x < x1; x += 74) ctx.fillRect(x, y, 1.4, ch);
      }
      const shafts = [], bays = [];
      for (let k = 0; ; k++) {
        const sx = GX2 + 200 + k * 330;
        if (sx > x1 + 200) break;
        shafts.push(sx);
        bays.push(sx + 165);
      }
      for (let k = 0; ; k++) {
        const sx = GX2 - 200 - k * 330;
        if (sx < x0 - 200) break;
        shafts.push(sx);
        bays.push(sx - 165);
      }
      ctx.fillStyle = STONE_M;
      ctx.fillRect(x0, 0, x1 - x0, 150);
      const archOver = (a, b2, apex) => {
        const p = new Path2D();
        p.moveTo(a, 150);
        p.bezierCurveTo(a, 150 - (150 - apex) * 0.55, a + (b2 - a) * 0.28, apex + 6, (a + b2) / 2, apex);
        p.bezierCurveTo(a + (b2 - a) * 0.72, apex + 6, b2, 150 - (150 - apex) * 0.55, b2, 150);
        p.closePath();
        return p;
      };
      const sorted = shafts.slice().sort((a, b2) => a - b2);
      for (let i = 0; i + 1 < sorted.length; i++) {
        const p = archOver(sorted[i], sorted[i + 1], sorted[i + 1] - sorted[i] > 360 ? -10 : 22);
        ctx.fillStyle = STONE;
        ctx.fill(p);
        ctx.strokeStyle = STONE_D;
        ctx.lineWidth = 9;
        ctx.stroke(p);
        ctx.strokeStyle = STONE_L;
        ctx.lineWidth = 3.5;
        ctx.stroke(p);
      }
      ctx.strokeStyle = rgba("#bfb29b", 0.6);
      ctx.lineWidth = 5;
      for (const sx of sorted) {
        ctx.beginPath();
        ctx.moveTo(sx, 140);
        ctx.quadraticCurveTo(sx + 30, 40, sx + 120, -10);
        ctx.moveTo(sx, 140);
        ctx.quadraticCurveTo(sx - 30, 40, sx - 120, -10);
        ctx.stroke();
      }
      ctx.fillStyle = STONE_M;
      ctx.fillRect(x0, 612, x1 - x0, 116);
      for (let x = x0; x < x1; x += 56) {
        const p = lancet(x + 7, 626, 42, 120);
        ctx.fillStyle = rgba("#b9ac94", 0.35);
        ctx.fill(p);
        ctx.save();
        ctx.translate(-2.5, -2);
        ctx.fillStyle = STONE;
        ctx.fill(p);
        ctx.restore();
        ctx.strokeStyle = rgba("#a89a80", 0.7);
        ctx.lineWidth = 1.6;
        for (const [dx2, dy2] of [[-7, 0], [7, 0], [0, -9]]) {
          ctx.beginPath();
          ctx.arc(x + 28 + dx2 - 2.5, 660 + dy2, 6, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.fillStyle = STONE_L;
      ctx.fillRect(x0, 606, x1 - x0, 8);
      ctx.fillStyle = rgba("#b3a68e", 0.6);
      ctx.fillRect(x0, 614, x1 - x0, 2);
      ctx.fillStyle = STONE_D;
      ctx.fillRect(x0, 724, x1 - x0, 16);
      ctx.fillStyle = STONE_L;
      ctx.fillRect(x0, 722, x1 - x0, 4);
      bays.forEach((bx, i) => {
        if (bx < x0 - 120 || bx > x1 + 120) return;
        const x = bx - WIN.w / 2, k = (Math.round(bx / 330) % DESIGNS.length + DESIGNS.length) % DESIGNS.length;
        const splay = lancet(x - 16, WIN.top - 18, WIN.w + 32, WIN.h + 18);
        ctx.fillStyle = STONE_L;
        ctx.fill(splay);
        ctx.save();
        ctx.clip(splay);
        ctx.fillStyle = rgba("#c2b59d", 0.45);
        ctx.fillRect(x - 16, WIN.top - 30, 14, WIN.h + 40);
        ctx.restore();
        ctx.strokeStyle = rgba("#b0a289", 0.8);
        ctx.lineWidth = 2;
        ctx.stroke(splay);
        DESIGNS[k](ctx, x, WIN.top, WIN.w, WIN.h);
        ctx.fillStyle = STONE_D;
        ctx.fillRect(x - 20, WIN.top + WIN.h, WIN.w + 40, 10);
        ctx.fillStyle = STONE_L;
        ctx.fillRect(x - 20, WIN.top + WIN.h, WIN.w + 40, 3);
      });
      {
        const x = GX2 - GIANT.w / 2, y = 64;
        const splay = lancet(x - 26, y - 26, GIANT.w + 52, GIANT.h + 26);
        ctx.fillStyle = STONE_L;
        ctx.fill(splay);
        ctx.strokeStyle = rgba("#b0a289", 0.9);
        ctx.lineWidth = 2.5;
        ctx.stroke(splay);
        const splay2 = lancet(x - 12, y - 12, GIANT.w + 24, GIANT.h + 12);
        ctx.strokeStyle = rgba("#b0a289", 0.6);
        ctx.lineWidth = 1.5;
        ctx.stroke(splay2);
        giantWindow(ctx, x, y);
        ctx.fillStyle = STONE_D;
        ctx.fillRect(x - 30, y + GIANT.h, GIANT.w + 60, 12);
        ctx.fillStyle = STONE_L;
        ctx.fillRect(x - 30, y + GIANT.h, GIANT.w + 60, 4);
      }
      for (const sx of sorted) {
        const g = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
        g.addColorStop(0, "#d3c8b4");
        g.addColorStop(0.55, STONE_L);
        g.addColorStop(1, "#e9e2d4");
        ctx.fillStyle = g;
        ctx.fillRect(sx - 12, 150, 24, WALL_BOT - 150);
        ctx.fillStyle = STONE_L;
        poly(ctx, [[sx - 22, 132], [sx + 22, 132], [sx + 14, 152], [sx - 14, 152]]);
        ctx.fill();
        ctx.fillStyle = STONE_D;
        ctx.fillRect(sx - 24, 126, 48, 8);
        ctx.fillStyle = STONE_D;
        ctx.fillRect(sx - 18, 712, 36, 28);
      }
      for (let x = x0 + 80; x < x1; x += 260 + R() * 220) {
        if (Math.abs(x - GX2) < 220) continue;
        const img = lightPattern(Math.floor(R() * DESIGNS.length));
        const yb = 560 + R() * 140, w = 60 + R() * 40;
        castLight(ctx, () => {
          ctx.save();
          bandTransform(ctx, img, x, yb, w, yb - 150, yb);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }, 0.32, 0.28);
      }
    }, { y0: 0, y1: WALL_BOT + 2 });
  }
  function backFloorLayer() {
    return strip("s04-bfloor", P_BFLOOR, (ctx, x0, x1) => {
      const g = ctx.createLinearGradient(0, 736, 0, 802);
      g.addColorStop(0, "#d8cebb");
      g.addColorStop(1, "#e2d9c7");
      ctx.fillStyle = g;
      ctx.fillRect(x0, 736, x1 - x0, 68);
      ctx.fillStyle = rgba(JOINT, 0.6);
      for (const y of [752, 772]) ctx.fillRect(x0, y, x1 - x0, 1.2);
      for (let x = x0; x < x1; x += 130) {
        ctx.fillRect(x + Math.round(x / 130) % 2 * 40, 752, 1.2, 20);
        ctx.fillRect(x + 70, 772, 1.2, 30);
      }
    }, { y0: 734, y1: 804 });
  }
  function floorLayer() {
    return strip("s04-floor", 1, (ctx, x0, x1) => {
      const R = rng("s04-floor");
      ctx.fillStyle = "#ddd3c1";
      ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1e3 - ROAD_Y + 2);
      const rows = [[800, 828], [828, 866], [866, 922], [922, 1e3]];
      rows.forEach(([a, b2], r) => {
        let x = x0 - R() * 140;
        while (x < x1) {
          const w = 120 + (b2 - a) * 2.6 + R() * 80;
          ctx.fillStyle = mix("#e4dbca", "#cfc4af", R() * 0.6);
          ctx.fillRect(x + 1.5, a + 1.5, w - 3, b2 - a - 3);
          ctx.fillStyle = rgba("#ffffff", 0.22);
          ctx.fillRect(x + 3, a + 2, w - 8, 2);
          if (R() > 0.55) {
            ctx.fillStyle = rgba("#a89a80", 0.1);
            ellipse(ctx, x + R() * w, a + (b2 - a) * R(), 16 + R() * 22, 3 + R() * 5);
            ctx.fill();
          }
          ctx.fillStyle = rgba("#a3957c", 0.7);
          ctx.fillRect(x, a, 1.8, b2 - a);
          x += w;
        }
        ctx.fillStyle = rgba("#a3957c", 0.6);
        ctx.fillRect(x0, b2 - 1, x1 - x0, 1.8);
      });
      ctx.fillStyle = "#ece5d7";
      ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 4);
    }, { y0: ROAD_Y - 4, y1: 1e3 });
  }
  var pierXs = (gc) => {
    const out = [];
    const [x0, x1] = stripRange(P_PIER);
    for (let x = -150 + gc * P_PIER - 1050 * 8; x < x1 + 300; x += 1050) if (x > x0 - 300) out.push(x);
    return out;
  };
  function pierLayer(gc) {
    return strip(`s04-pier-${gc}`, P_PIER, (ctx, x0, x1) => {
      const R = rng("s04-pier");
      for (const px of pierXs(gc)) {
        for (const dir of [-1, 1]) {
          const p = new Path2D();
          p.moveTo(px + dir * 40, 236);
          p.bezierCurveTo(px + dir * 50, 110, px + dir * 170, 10, px + dir * 420, -40);
          ctx.strokeStyle = STONE_D;
          ctx.lineWidth = 78;
          ctx.stroke(p);
          ctx.strokeStyle = dir > 0 ? STONE_L : STONE;
          ctx.lineWidth = 70;
          ctx.stroke(p);
          ctx.strokeStyle = rgba("#b5a88f", 0.8);
          ctx.lineWidth = 2;
          for (const o of [-22, 6, 26]) {
            ctx.save();
            ctx.translate(dir * o * 0.6, o * 0.5);
            ctx.stroke(p);
            ctx.restore();
          }
        }
        const shaft = (cx, hw) => {
          const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
          g.addColorStop(0, "#cbbfa9");
          g.addColorStop(0.35, "#e2d9c8");
          g.addColorStop(0.75, STONE_L);
          g.addColorStop(1, "#ebe4d6");
          ctx.fillStyle = g;
          ctx.fillRect(cx - hw, 230, hw * 2, 520);
          ctx.fillStyle = rgba("#8f8370", 0.35);
          ctx.fillRect(cx - hw, 230, 1.6, 520);
        };
        shaft(px - 46, 15);
        shaft(px + 46, 15);
        shaft(px, 34);
        ctx.fillStyle = STONE_L;
        poly(ctx, [[px - 72, 214], [px + 72, 214], [px + 58, 244], [px - 58, 244]]);
        ctx.fill();
        ctx.strokeStyle = rgba("#a89a80", 0.8);
        ctx.lineWidth = 2;
        for (let k = -3; k <= 3; k++) {
          ctx.beginPath();
          ctx.moveTo(px + k * 18, 242);
          ctx.quadraticCurveTo(px + k * 18 - 6, 226, px + k * 18 + 4, 220);
          ctx.stroke();
        }
        ctx.fillStyle = STONE_D;
        ctx.fillRect(px - 80, 204, 160, 12);
        ctx.fillStyle = STONE_L;
        ctx.fillRect(px - 80, 204, 160, 3);
        ctx.fillStyle = STONE_M;
        ctx.fillRect(px - 76, 748, 152, 46);
        ctx.fillStyle = STONE_L;
        ctx.fillRect(px - 64, 736, 128, 14);
        ctx.fillRect(px - 76, 748, 152, 4);
        ctx.fillStyle = rgba("#a3957c", 0.6);
        ctx.fillRect(px - 76, 792, 152, 2);
        const img = lightPattern(Math.floor(R() * DESIGNS.length));
        const yb = 520 + R() * 120;
        castLight(ctx, () => {
          ctx.save();
          ctx.beginPath();
          ctx.rect(px - 62, 240, 124, 500);
          ctx.clip();
          bandTransform(ctx, img, px + 10, yb, 70, yb - 180, yb);
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }, 0.38, 0.3);
      }
    }, { y0: -60, y1: 800 });
  }
  var BEAMS = [
    { hit: -3.6, w: 120, fy: 860, k: 0 },
    { hit: -1.4, w: 140, fy: 832, k: 1 },
    { hit: 0.9, w: 120, fy: 878, k: 2 },
    { hit: 3, w: 150, fy: 846, k: 3 },
    { hit: 5.1, w: 132, fy: 868, k: 4 },
    { hit: GAG, w: 300, fy: 836, k: "giant", giant: true },
    { hit: 14.4, w: 134, fy: 862, k: 1 },
    { hit: 16.4, w: 150, fy: 836, k: 3 },
    { hit: 18.6, w: 124, fy: 872, k: 2 }
  ];
  var TORSO_Y = 560;
  var FIG_DX = 14;
  function beamsFor(env) {
    return memo("s04-beams", () => BEAMS.map((bm, i) => ({
      ...bm,
      L: env.camAt(bm.hit) + CHAR_X + FIG_DX - (bm.giant ? 0 : SL * (bm.fy - TORSO_Y)),
      d: bm.giant ? 130 : 64,
      a: bm.giant ? 1 : [0.75, 1, 0.55, 0.9, 0.65, 1, 0.6, 0.85, 0.7][i % 9]
    })));
  }
  var beamAt = (bm, cam) => bm.L - cam;
  function drawFloorPatch(ctx, bm, cam, gain, drift = 0) {
    const img = lightPattern(bm.k);
    const fx = beamAt(bm, cam) + drift;
    if (fx < X_MIN - 400 || fx > X_MAX + 400) return;
    castLight(ctx, () => {
      ctx.save();
      bandTransform(ctx, img, fx, bm.fy, bm.w * 1.2, bm.fy - bm.d / 2, bm.fy + bm.d / 2);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
    }, 0.5 * gain, 0.45 * gain);
  }
  function drawShaft(ctx, bm, cam, alpha) {
    const fx = beamAt(bm, cam);
    const y1 = bm.fy - bm.d / 2, y0 = -60;
    const xAt = (y) => fx + SL * (bm.fy - y);
    if (xAt(y1) - bm.w > X_MAX + 100 || xAt(y0) + bm.w < X_MIN - 100) return;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(xAt(y0), y0, xAt(y1), y1);
    g.addColorStop(0, rgba(SUN, 0));
    g.addColorStop(0.4, rgba(SUN, 0.022 * alpha));
    g.addColorStop(1, rgba(SUN, 0.05 * alpha));
    ctx.fillStyle = g;
    for (const k of [1.3, 1, 0.75, 0.5]) {
      const hw = bm.w * k / 2;
      poly(ctx, [[xAt(y0) - hw, y0], [xAt(y0) + hw, y0], [xAt(y1) + hw, y1], [xAt(y1) - hw, y1]]);
      ctx.fill();
    }
    const img = lightPattern(bm.k);
    ctx.globalAlpha = 0.07 * alpha;
    ctx.save();
    bandTransform(ctx, img, fx, bm.fy, bm.w, 260, y1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
    ctx.restore();
  }
  function mote(ctx, x, y, r, al) {
    ctx.fillStyle = rgba("#e0a93a", 0.55 * al);
    circle(ctx, x, y, r * 1.5);
    ctx.fill();
    ctx.fillStyle = rgba("#fffdf2", al);
    circle(ctx, x, y, r * 0.8);
    ctx.fill();
  }
  function drawMotes(ctx, bm, cam, b, alpha, n = 14, seed = 0) {
    const fx = beamAt(bm, cam);
    for (let i = 0; i < n; i++) {
      const v = (hash2(i, seed, 61) + b * 0.025 * (0.5 + hash2(i, seed, 62))) % 1;
      const y = lerp(140, bm.fy - 40, v);
      const u = hash2(i, seed, 63) - 0.5 + Math.sin(b * 0.9 + i * 2.1) * 0.06;
      const x = fx + SL * (bm.fy - y) + u * bm.w * 0.8;
      const tw = Math.max(0, Math.sin(b * 2.6 + i * 1.7));
      if (tw < 0.05) continue;
      mote(ctx, x, y, 0.9 + hash2(i, seed, 64) * 1.1, 0.75 * alpha * tw);
    }
  }
  var glassOn = (b) => b >= T_GLASS && b < T_BACK;
  var sunAmt = (b) => smoothstep(T_SUN - 0.04, T_SUN + 0.06, b) * (1 - 0.35 * smoothstep(T_SUN + 0.3, T_SUN + 1.2, b)) * (1 - smoothstep(T_BACK - 0.1, T_BACK + 0.4, b));
  var giantGain = (b) => 1 + 0.5 * smoothstep(T_GLASS - 0.1, T_GLASS + 0.15, b) * (1 - smoothstep(T_BACK, T_BACK + 1, b));
  var scratch = null;
  function scratchCanvas(w, h) {
    if (!scratch || scratch.width < w || scratch.height < h) scratch = makeCanvas(Math.max(w, scratch ? scratch.width : 0), Math.max(h, scratch ? scratch.height : 0));
    return scratch;
  }
  function figureLight(ctx, fig, env, paint, tint, add) {
    const A = activeWalk();
    if (!A) return;
    const m = A.meta, s = FIGURE_H / m.personHeight;
    const T = ctx.getTransform();
    const lx0 = -m.anchorX * s - 30, ly0 = -m.baseY * s - 30, lx1 = (m.width - m.anchorX) * s + 30, ly1 = (m.height - m.baseY) * s + 30;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (const [x, y] of [[lx0, ly0], [lx1, ly0], [lx0, ly1], [lx1, ly1]]) {
      const px = T.a * x + T.c * y + T.e, py = T.b * x + T.d * y + T.f;
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
    minX = Math.max(0, Math.floor(minX));
    minY = Math.max(0, Math.floor(minY));
    maxX = Math.min(ctx.canvas.width, Math.ceil(maxX));
    maxY = Math.min(ctx.canvas.height, Math.ceil(maxY));
    const w = maxX - minX, h = maxY - minY;
    if (w < 2 || h < 2) return;
    const c = scratchCanvas(w, h), oc = c.getContext("2d");
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.globalCompositeOperation = "source-over";
    oc.globalAlpha = 1;
    oc.clearRect(0, 0, w, h);
    oc.setTransform(T.a, T.b, T.c, T.d, T.e - minX, T.f - minY);
    oc.save();
    oc.scale(1 / (fig.scale * fig.sx), 1 / fig.scale);
    oc.translate(-fig.x, -fig.y);
    paint(oc);
    oc.restore();
    oc.globalCompositeOperation = "destination-in";
    drawWalker(oc, { ...fig, rim: null });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (tint > 0) {
      ctx.globalCompositeOperation = "multiply";
      ctx.globalAlpha = tint;
      ctx.drawImage(c, 0, 0, w, h, minX, minY, w, h);
    }
    if (add > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = add;
      ctx.drawImage(c, 0, 0, w, h, minX, minY, w, h);
    }
    ctx.restore();
  }
  var PEW_GROUPS = [-2700, -1900, -1100, -260, 1e3, 1820, 2640, 3460];
  function pewEnd(ctx, x) {
    const top = 884, W2 = 44;
    const p = new Path2D();
    p.moveTo(x - W2, 1010);
    p.lineTo(x - W2, top + 4);
    p.quadraticCurveTo(x - W2, top - 10, x - W2 + 16, top - 10);
    p.lineTo(x + W2 - 22, top - 6);
    p.quadraticCurveTo(x + W2, top - 2, x + W2, top + 26);
    p.lineTo(x + W2, 1010);
    p.closePath();
    const g = ctx.createLinearGradient(x - W2, 0, x + W2, 0);
    g.addColorStop(0, "#ead3a6");
    g.addColorStop(0.6, OAK);
    g.addColorStop(1, "#cfae7a");
    ctx.fillStyle = g;
    ctx.fill(p);
    ctx.strokeStyle = rgba("#94733f", 0.85);
    ctx.lineWidth = 1.8;
    ctx.stroke(p);
    circle(ctx, x - W2 + 12, top - 16, 9);
    ctx.fillStyle = "#e6cc9c";
    ctx.fill();
    ctx.stroke();
    const panel = lancet(x - 20, top + 22, 40, 130);
    ctx.fillStyle = rgba("#b18c56", 0.3);
    ctx.fill(panel);
    ctx.strokeStyle = rgba("#94733f", 0.6);
    ctx.lineWidth = 1.3;
    ctx.stroke(panel);
    ctx.strokeStyle = rgba("#fff6e2", 0.6);
    ctx.beginPath();
    ctx.moveTo(x - W2 + 4, top + 6);
    ctx.lineTo(x - W2 + 4, 1e3);
    ctx.stroke();
  }
  function drawPews(ctx, cam, gc) {
    for (const g0 of PEW_GROUPS) {
      const gx = g0 + (gc - cam) * P_FG3;
      if (gx < X_MIN - 600 || gx > X_MAX + 200) continue;
      ctx.fillStyle = "#d9bc8a";
      ctx.fillRect(gx - 30, 900, 360, 12);
      ctx.fillStyle = "#cfb07c";
      ctx.fillRect(gx - 30, 948, 360, 14);
      ctx.fillStyle = rgba("#94733f", 0.55);
      ctx.fillRect(gx - 30, 912, 360, 2);
      ctx.fillRect(gx - 30, 962, 360, 2);
      for (let k = 0; k < 3; k++) pewEnd(ctx, gx + k * 150);
    }
  }
  function sunBeam(ctx, b, env, a) {
    const gc = gagCam(env);
    const rx = giantX(gc) - env.cam * P_FAR3 + (GIANT.rose[0] - GIANT.w / 2), ry = 64 + GIANT.rose[1];
    const cx = CHAR_X + FIG_DX, cy = TORSO_Y - 60;
    const ty = ROAD_Y + 30, tx = rx + (cx - rx) * (ty - ry) / (cy - ry);
    const dx = tx - rx, dy = ty - ry, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
    const w0 = 80, w1 = 300;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const tc = (cy - ry) / dy;
    const layer = (k, a0, a1, col) => {
      const g = ctx.createLinearGradient(rx, ry, tx, ty);
      g.addColorStop(0, rgba(col, a0 * a));
      g.addColorStop(tc, rgba(col, a1 * a));
      g.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = g;
      const h0 = w0 * k / 2, h1 = w1 * k / 2;
      poly(ctx, [[rx + nx * h0, ry + ny * h0], [tx + nx * h1, ty + ny * h1], [tx - nx * h1, ty - ny * h1], [rx - nx * h0, ry - ny * h0]]);
      ctx.fill();
    };
    layer(1.25, 0.1, 0.07, SUN);
    layer(1, 0.14, 0.1, SUN);
    layer(0.72, 0.16, 0.1, "#fff0c0");
    layer(0.45, 0.18, 0.1, "#ffffff");
    layer(0.22, 0.2, 0.08, "#ffffff");
    const px = cx - 20, py = ROAD_Y + 14;
    const pg = ctx.createRadialGradient(px, py, 4, px, py, 200);
    pg.addColorStop(0, rgba("#fff2c8", 0.4 * a));
    pg.addColorStop(1, rgba("#fff2c8", 0));
    ctx.fillStyle = pg;
    ctx.save();
    ctx.translate(0, py);
    ctx.scale(1, 0.25);
    ctx.translate(0, -py);
    circle(ctx, px, py, 200);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    for (let i = 0; i < 54; i++) {
      const t = (hash2(i, 5, 71) + (b - T_SUN) * 0.05 * (0.4 + hash2(i, 6, 71))) % 1;
      const u = (hash2(i, 7, 71) - 0.5) * lerp(w0, w1, t) * 0.9;
      const x = rx + dx * t + nx * u + Math.sin(b * 1.3 + i) * 4, y = ry + dy * t + ny * u;
      const tw = Math.max(0, Math.sin(b * 5.2 + i * 2.3));
      const al = a * (0.3 + 0.7 * tw);
      mote(ctx, x, y, 1.1 + hash2(i, 8, 71) * 1.3, al);
      if (tw > 0.75 && hash2(i, 9, 71) > 0.5) {
        const r = 5 + 7 * tw;
        ctx.strokeStyle = rgba("#d99a2b", 0.7 * al);
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r);
        ctx.lineTo(x, y + r);
        ctx.stroke();
        ctx.strokeStyle = rgba("#ffffff", 0.95 * al);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - r, y);
        ctx.lineTo(x + r, y);
        ctx.moveTo(x, y - r);
        ctx.lineTo(x, y + r);
        ctx.stroke();
      }
    }
  }
  function dustRing(ctx, b, fig) {
    const k = smoothstep(T_SUN + 0.35, T_SUN + 0.95, b) * (1 - smoothstep(T_BACK - 0.6, T_BACK - 0.1, b));
    if (k <= 0) return;
    const hx = fig.x + ANCHORS.stand.headTop[0] - 4, hy = fig.y + ANCHORS.stand.headTop[1] - 26;
    ctx.save();
    const N = 22;
    for (let i = 0; i < N; i++) {
      const a = i / N * TAU + b * 0.6;
      const sx = hx + (hash2(i, 1, 81) - 0.5) * 260, sy = hy + 90 + (hash2(i, 2, 81) - 0.3) * 220;
      const x = lerp(sx, hx + Math.cos(a) * 46, ease.inOut(k)), y = lerp(sy, hy + Math.sin(a) * 9, ease.inOut(k));
      const tw = 0.6 + 0.4 * Math.sin(b * 6 + i * 1.9);
      mote(ctx, x, y, 2 + i % 3 * 0.5, tw * Math.min(1, k * 1.5));
    }
    ctx.restore();
  }
  function quatrefoil(ctx, cx, cy, r, cols, lw = 1.4) {
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * TAU + Math.PI / 4;
      const p = new Path2D();
      p.arc(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.46, 0, TAU);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fill(p);
      ctx.strokeStyle = LEAD2;
      ctx.lineWidth = lw;
      ctx.stroke(p);
    }
    const c = new Path2D();
    c.arc(cx, cy, r * 0.3, 0, TAU);
    ctx.fillStyle = AMBER;
    ctx.fill(c);
    ctx.strokeStyle = LEAD2;
    ctx.lineWidth = lw;
    ctx.stroke(c);
  }
  function stoneCard(ctx, x, y, w, h, { corners = true, r = 10 } = {}) {
    ctx.save();
    ctx.shadowColor = "rgba(70,55,30,0.25)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    roundRect(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
    g.addColorStop(0, "#f7f3ea");
    g.addColorStop(1, "#ebe3d3");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "#a2967f";
    ctx.lineWidth = 2;
    ctx.stroke();
    roundRect(ctx, x + 7, y + 7, w - 14, h - 14, Math.max(2, r - 5));
    ctx.strokeStyle = rgba(LEAD2, 0.55);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (corners) {
      const cr = 13;
      quatrefoil(ctx, x + 22, y + 22, cr, [BLUE, RUBY]);
      quatrefoil(ctx, x + w - 22, y + 22, cr, [GREEN, AMBER]);
      quatrefoil(ctx, x + 22, y + h - 22, cr, [PURPLE, SKY]);
      quatrefoil(ctx, x + w - 22, y + h - 22, cr, [RUBY, BLUE]);
      ctx.strokeStyle = rgba(LEAD2, 0.45);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x + 40, y + 22);
      ctx.lineTo(x + w - 40, y + 22);
      ctx.moveTo(x + 40, y + h - 22);
      ctx.lineTo(x + w - 40, y + h - 22);
      ctx.stroke();
    }
    ctx.restore();
  }
  function glassCassette(ctx, cx, cy, s, spin) {
    const w = 200 * s, h = 128 * s;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
    const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    g.addColorStop(0, "#f6f1e6");
    g.addColorStop(1, "#e4dccb");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 2.5 * s;
    ctx.strokeStyle = LEAD2;
    ctx.stroke();
    roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 10 * s, w - 28 * s, 70 * s, 5 * s);
    ctx.fillStyle = "#fbf8f0";
    ctx.fill();
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    const cols = [BLUE, RUBY, AMBER, GREEN, PURPLE, SKY];
    const n = 12, sw = (w - 40 * s) / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(-w / 2 + 20 * s + i * sw, -h / 2 + 16 * s, sw, 9 * s);
    }
    ctx.strokeStyle = LEAD2;
    ctx.lineWidth = 1.1 * s;
    ctx.strokeRect(-w / 2 + 20 * s, -h / 2 + 16 * s, n * sw, 9 * s);
    for (let i = 1; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 20 * s + i * sw, -h / 2 + 16 * s);
      ctx.lineTo(-w / 2 + 20 * s + i * sw, -h / 2 + 25 * s);
      ctx.stroke();
    }
    const wx = -56 * s, wy = -h / 2 + 32 * s, ww = 112 * s, wh = 40 * s;
    ctx.save();
    roundRect(ctx, wx, wy, ww, wh, 18 * s);
    ctx.clip();
    const pcs = [[0, 0, 0.3, 0.5, SKY], [0.3, 0, 0.4, 0.5, AMBER], [0.7, 0, 0.3, 0.5, ROSE], [0, 0.5, 0.22, 0.5, GREEN], [0.22, 0.5, 0.56, 0.5, PALE3], [0.78, 0.5, 0.22, 0.5, PURPLE]];
    for (const [u, v, du, dv, c] of pcs) {
      ctx.fillStyle = c;
      ctx.fillRect(wx + u * ww, wy + v * wh, du * ww, dv * wh);
    }
    ctx.strokeStyle = LEAD2;
    ctx.lineWidth = 1.3 * s;
    for (const [u, v, du, dv] of pcs) ctx.strokeRect(wx + u * ww, wy + v * wh, du * ww, dv * wh);
    ctx.restore();
    roundRect(ctx, wx, wy, ww, wh, 18 * s);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = LEAD2;
    ctx.stroke();
    for (const sx of [-1, 1]) {
      const rx = sx * 34 * s, ry = wy + wh / 2;
      circle(ctx, rx, ry, (sx < 0 ? 17 : 12) * s);
      ctx.fillStyle = rgba("#5a4636", 0.75);
      ctx.fill();
      circle(ctx, rx, ry, 9.5 * s);
      ctx.fillStyle = "#f6f1e6";
      ctx.fill();
      ctx.lineWidth = 1.6 * s;
      ctx.strokeStyle = LEAD2;
      ctx.stroke();
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
      ctx.fillStyle = LEAD2;
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.fillRect(-1.3 * s, -8.5 * s, 2.6 * s, 4.5 * s);
      }
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-60 * s, h / 2);
    ctx.lineTo(-48 * s, h / 2 - 30 * s);
    ctx.lineTo(48 * s, h / 2 - 30 * s);
    ctx.lineTo(60 * s, h / 2);
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = LEAD2;
    ctx.stroke();
    for (const sx of [-1, 1]) {
      circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s);
      ctx.fillStyle = LEAD2;
      ctx.fill();
    }
    ctx.restore();
  }
  var s04 = {
    id: "s04",
    station: ST4,
    figureStyle: "s04-comic",
    freezeBeat: T_SUN + 0.8,
    figureAdjust(b) {
      if (glassOn(b)) return { style: "s04-glass" };
      return null;
    },
    drawBack(ctx, b, env) {
      const cam = env.cam, gc = gagCam(env);
      drawStrip(ctx, farLayer3(gc), cam);
      drawStrip(ctx, backFloorLayer(), cam);
      drawStrip(ctx, floorLayer(), cam);
      const beams = beamsFor(env);
      const drift = b > GAG ? -10 * Math.min(4, b - GAG) : 0;
      for (const bm of beams) drawFloorPatch(ctx, bm, cam, bm.giant ? giantGain(b) * (1 + 0.12 * Math.sin((b - GAG) * 1.6) * (glassOn(b) ? 1 : 0)) : 1, bm.giant ? drift : 0);
      drawStrip(ctx, pierLayer(gc), cam);
      const calm = 1 - 0.6 * sunAmt(b);
      for (const bm of beams) {
        const a = (bm.giant ? 0.45 + 0.35 * smoothstep(GAG - 1.2, GAG, b) * (1 - smoothstep(T_BACK, T_BACK + 1.4, b)) : bm.a) * calm;
        drawShaft(ctx, bm, cam, a);
        drawMotes(ctx, bm, cam, b, a, bm.giant ? 22 : 10, bm.hit * 10);
      }
      const flash = smoothstep(GAG - 0.05, GAG + 0.05, b) * (1 - smoothstep(GAG + 0.1, GAG + 0.9, b)) + sunAmt(b) * 0.5;
      if (flash > 0.01) {
        const x = giantX(gc) - cam * P_FAR3 - GIANT.w / 2;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.28 * flash;
        ctx.fillStyle = SUN;
        ctx.fill(lancet(x, 64, GIANT.w, GIANT.h));
        ctx.restore();
      }
    },
    drawFigure(ctx, fig, b, env) {
      drawWalker(ctx, fig);
      const cam = env.cam;
      const glass = glassOn(b);
      if (!glass) {
        const beams = beamsFor(env).filter((bm) => Math.abs(beamAt(bm, cam) + SL * (bm.fy - TORSO_Y) - fig.x) < bm.w / 2 + 160);
        if (beams.length) {
          figureLight(ctx, fig, env, (oc) => {
            for (const bm of beams) {
              const img = lightPattern(bm.k);
              const g = bm.giant ? giantGain(b) : 1;
              oc.save();
              oc.globalAlpha = Math.min(1, g);
              bandTransform(oc, img, beamAt(bm, cam), bm.fy, bm.w, 140, bm.fy);
              oc.drawImage(img, 0, 0);
              oc.restore();
            }
          }, 0.5, 0.55);
        }
      }
      const flip = (1 - smoothstep(T_GLASS, T_GLASS + 0.2, b)) * (b >= T_GLASS ? 0.25 : 0) + (1 - smoothstep(T_BACK, T_BACK + 0.2, b)) * (b >= T_BACK ? 0.2 : 0);
      const sun = glass ? sunAmt(b) : 0;
      if (flip > 0.01) figureLight(ctx, fig, env, (oc) => {
        oc.fillStyle = "#fff6dc";
        oc.fillRect(fig.x - 400, fig.y - 700, 800, 800);
      }, 0, flip);
      if (sun > 0.01) figureLight(ctx, fig, env, (oc) => {
        oc.save();
        oc.translate(fig.x, fig.y);
        drawWalker(oc, { ...fig, rim: null });
        oc.restore();
      }, 0, 0.55 * sun);
    },
    drawFront(ctx, b, env) {
      const cam = env.cam, gc = gagCam(env);
      const a = sunAmt(b);
      if (a > 0.01) {
        const fx = CHAR_X + FIG_DX + 80, fy = 520;
        const g = ctx.createRadialGradient(fx, fy, 160, fx, fy, 1300);
        g.addColorStop(0, rgba("#d8ccb6", 0));
        g.addColorStop(0.35, rgba("#cdbfa6", 0.45 * a));
        g.addColorStop(1, rgba("#b9aa90", 0.7 * a));
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = g;
        ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 1e3);
        ctx.restore();
        sunBeam(ctx, b, env, a);
      }
      if (glassOn(b)) dustRing(ctx, b, env.figure());
      drawPews(ctx, cam, gc);
    },
    drawFrame(ctx, R) {
      const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
      ctx.save();
      ctx.fillStyle = "rgba(90,70,40,0.16)";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU);
      ctx.fill();
      const gh = w * 0.42;
      const ax = x + w / 2, ay = y - t - gh;
      const gable = new Path2D();
      gable.moveTo(x - t * 0.6, y - t + 2);
      gable.lineTo(ax, ay);
      gable.lineTo(x + w + t * 0.6, y - t + 2);
      gable.closePath();
      ctx.fillStyle = STONE_M;
      ctx.fill(gable);
      ctx.strokeStyle = "#a2967f";
      ctx.lineWidth = Math.max(1, 2.5 * s);
      ctx.stroke(gable);
      ctx.save();
      ctx.clip(gable);
      ctx.strokeStyle = rgba("#b5a88f", 0.9);
      ctx.lineWidth = Math.max(1, 1.6 * s);
      const g2 = new Path2D();
      g2.moveTo(x + t * 0.3, y - t);
      g2.lineTo(ax, ay + gh * 0.16);
      g2.lineTo(x + w - t * 0.3, y - t);
      ctx.stroke(g2);
      ctx.restore();
      ctx.fillStyle = STONE_L;
      ctx.strokeStyle = "#a2967f";
      ctx.lineWidth = Math.max(0.8, 1.4 * s);
      for (const dir of [-1, 1]) {
        const bx0 = dir < 0 ? x - t * 0.6 : x + w + t * 0.6, by0 = y - t;
        for (let k2 = 1; k2 < 9; k2++) {
          const f = k2 / 9, cxk = bx0 + (ax - bx0) * f, cyk = by0 + (ay - by0) * f;
          circle(ctx, cxk - dir * t * 0.05, cyk - t * 0.16, t * 0.15);
          ctx.fill();
          ctx.stroke();
        }
      }
      for (const [fx2, fy2] of [[0, -0.35], [-0.22, -0.18], [0.22, -0.18], [0, 0]]) {
        circle(ctx, ax + fx2 * t, ay + fy2 * t - t * 0.2, t * 0.17);
        ctx.fill();
        ctx.stroke();
      }
      const rr = Math.min(gh * 0.18, 110 * s);
      ctx.save();
      ctx.translate(ax, y - t - gh * 0.36);
      ctx.scale(rr / 80, rr / 80);
      ctx.beginPath();
      ctx.arc(0, 0, 92, 0, TAU);
      ctx.fillStyle = STONE_L;
      ctx.fill();
      roseWindow(ctx, 0, 0, 80);
      ctx.restore();
      const sides = [
        { pts: [[x - t, y - t], [x + w + t, y - t], [x + w, y], [x, y]], c: STONE_L },
        { pts: [[x + w + t, y - t], [x + w + t, y + h + t], [x + w, y + h], [x + w, y]], c: STONE_M },
        { pts: [[x + w + t, y + h + t], [x - t, y + h + t], [x, y + h], [x + w, y + h]], c: STONE_D },
        { pts: [[x - t, y + h + t], [x - t, y - t], [x, y], [x, y + h]], c: STONE }
      ];
      for (const sd of sides) {
        poly(ctx, sd.pts);
        ctx.fillStyle = sd.c;
        ctx.fill();
      }
      ctx.strokeStyle = rgba("#a2967f", 0.9);
      ctx.lineWidth = Math.max(1, 1.6 * s);
      ctx.strokeRect(x - t * 0.66, y - t * 0.66, w + t * 1.32, h + t * 1.32);
      ctx.strokeRect(x - t * 0.33, y - t * 0.33, w + t * 0.66, h + t * 0.66);
      ctx.strokeStyle = "#8f8370";
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
      const gb = t * 0.12;
      const cols = [BLUE, RUBY, AMBER, GREEN];
      const seg2 = Math.max(8, 40 * s);
      ctx.lineWidth = gb;
      for (let i = 0, px = x - t * 0.5; px < x + w + t * 0.5; px += seg2, i++) {
        ctx.strokeStyle = cols[i % 4];
        ctx.beginPath();
        ctx.moveTo(px, y - t * 0.5);
        ctx.lineTo(Math.min(px + seg2, x + w + t * 0.5), y - t * 0.5);
        ctx.stroke();
      }
      for (let i = 0, py = y - t * 0.5; py < y + h + t * 0.5; py += seg2, i++) {
        for (const sx of [x - t * 0.5, x + w + t * 0.5]) {
          ctx.strokeStyle = cols[(i + (sx > x ? 2 : 0)) % 4];
          ctx.beginPath();
          ctx.moveTo(sx, py);
          ctx.lineTo(sx, Math.min(py + seg2, y + h + t * 0.5));
          ctx.stroke();
        }
      }
      ctx.strokeStyle = LEAD2;
      ctx.lineWidth = Math.max(0.6, 1.2 * s);
      ctx.strokeRect(x - t * 0.5 - gb / 2, y - t * 0.5 - gb / 2, w + t + gb, h + t + gb);
      ctx.strokeRect(x - t * 0.5 + gb / 2, y - t * 0.5 + gb / 2, w + t - gb, h + t - gb);
      const k = clamp((0.99 - s) / 0.09);
      if (k > 0) {
        const rise = h * 0.42 * k;
        for (const dir of [-1, 1]) {
          const ex = dir < 0 ? x : x + w;
          const p = new Path2D();
          p.moveTo(ex, y);
          p.lineTo(ex, y + rise);
          p.bezierCurveTo(ex, y + rise * 0.35, x + w / 2 - dir * w * 0.12, y + rise * 0.12, x + w / 2, y);
          p.closePath();
          ctx.fillStyle = dir < 0 ? STONE : STONE_M;
          ctx.fill(p);
          ctx.strokeStyle = "#a2967f";
          ctx.lineWidth = Math.max(1, 2 * s);
          ctx.stroke(p);
          const q = Math.min(rise * 0.32, 46 * s);
          if (q > 3) quatrefoil(ctx, ex - dir * w * 0.1, y + rise * 0.3, q, dir < 0 ? [BLUE, RUBY] : [GREEN, AMBER], Math.max(0.6, 1.2 * s));
        }
      }
      for (const px of [x - t / 2, x + w + t / 2]) {
        const ph = t * 2.2;
        poly(ctx, [[px - t * 0.32, y - t], [px, y - t - ph], [px + t * 0.32, y - t]]);
        ctx.fillStyle = STONE_L;
        ctx.fill();
        ctx.strokeStyle = "#a2967f";
        ctx.lineWidth = Math.max(1, 1.5 * s);
        ctx.stroke();
        ctx.fillStyle = STONE_D;
        for (let k2 = 1; k2 < 4; k2++) {
          circle(ctx, px + (k2 % 2 ? -1 : 1) * t * 0.22 * (1 - k2 / 4), y - t - ph * k2 / 4, t * 0.06);
          ctx.fill();
        }
      }
      ctx.restore();
    },
    cardStyle: {
      ink: INK4,
      accent: BLUE_D,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        stoneCard(ctx, x, y, w, h);
      }
    },
    playerStyle: {
      plate: STONE,
      ink: INK4,
      noteColor: RUBY,
      backdrop: true,
      palette: { body: "#f2ede3", label: "#fbf8f0", window: SKY, accent: BLUE, tape: "#6b5a4a", ink: LEAD2 },
      plateDraw(ctx, x, y, w, h) {
        stoneCard(ctx, x, y, w, h, { corners: false, r: 8 });
        const cols = [BLUE, RUBY, AMBER, GREEN, PURPLE];
        const n = Math.max(4, Math.round((w - 28) / 22)), sw = (w - 28) / n;
        ctx.save();
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.fillRect(x + 14 + i * sw, y + h - 15, sw, 5);
        }
        ctx.strokeStyle = LEAD2;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 14, y + h - 15, w - 28, 5);
        ctx.restore();
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        glassCassette(ctx, cx, cy, s, spin);
      }
    }
  };

  // src/kit/sketch.js
  function sketchStrip(key, p, { fills, lines, y0 = 0, y1 = 1e3 }) {
    const [x0, x1] = stripRange(p);
    const w = (x1 - x0) * K, h = (y1 - y0) * K;
    const brushLayer = lines ? brushStrip(`${key}|lines`, x0, y0, w, h, lines, x1) : null;
    const canvas = baked(`sketch|${key}|${p}`, w, h, (ctx) => {
      ctx.save();
      ctx.scale(K, K);
      ctx.translate(-x0, -y0);
      if (fills) fills(ctx, x0, x1);
      ctx.restore();
      if (brushLayer) ctx.drawImage(brushLayer, 0, 0);
    });
    return { canvas, x0, x1, y0, y1, p };
  }
  function washStrip(key, p, { wash: wash2, y0 = 0, y1 = 1e3 }) {
    const [x0, x1] = stripRange(p);
    const w = (x1 - x0) * K, h = (y1 - y0) * K;
    const canvas = brushStrip(`${key}|wash`, x0, y0, w, h, wash2, x1);
    return { canvas, x0, x1, y0, y1, p };
  }
  function brushStrip(key, x0, y0, w, h, draw, x1) {
    return bakeBrush(`bstrip|${key}`, w, h, (B2) => {
      B2.scale(K, K);
      B2.translate(-x0, -y0);
      draw(B2, x0, x1);
    });
  }
  var jit = (i, k, seed, amp) => (hash2(i, k, seed) - 0.5) * 2 * amp;
  function sketchPoly(ctx, pts, { close = true, seed = 1, color = "#5c564e", width = 1.6, passes = 2, jitter = 1.2, over = 5, alpha = 0.85 } = {}) {
    const n = pts.length, segs = close ? n : n - 1;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = "round";
    for (let p = 0; p < passes; p++) {
      ctx.globalAlpha *= p ? alpha * 0.7 : alpha;
      ctx.lineWidth = width * (p ? 0.7 : 1);
      for (let i = 0; i < segs; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
        const ux = dx / L, uy = dy / L;
        const o1 = over * (0.3 + hash2(i, p, seed + 7)), o2 = over * (0.3 + hash2(i, p, seed + 8));
        const ax = a[0] - ux * o1 + jit(i, p * 4, seed, jitter), ay = a[1] - uy * o1 + jit(i, p * 4 + 1, seed, jitter);
        const bx = b[0] + ux * o2 + jit(i, p * 4 + 2, seed, jitter), by = b[1] + uy * o2 + jit(i, p * 4 + 3, seed, jitter);
        const mx = (ax + bx) / 2 + jit(i, p * 4 + 9, seed, jitter * 1.4), my = (ay + by) / 2 + jit(i, p * 4 + 10, seed, jitter * 1.4);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx, my, bx, by);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function ellipsePts(cx, cy, rx, ry, n = 28, rot = 0, a0 = 0, a1 = Math.PI * 2) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + (a1 - a0) * i / n;
      const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  }
  function sketchEllipse(ctx, cx, cy, rx, ry, o = {}) {
    sketchPoly(ctx, ellipsePts(cx, cy, rx, ry, 24, o.rot || 0), { ...o, close: false, over: 2 });
  }
  var sketchLine = (ctx, a, b, o = {}) => sketchPoly(ctx, [a, b], { ...o, close: false });
  function sketchHatch(ctx, x, y, w, h, { angle = 0.9, gap = 6, color = "#7a746a", width = 1, alpha = 0.6, seed = 3 } = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha *= alpha;
    const c = Math.cos(angle), s = Math.sin(angle), D = Math.hypot(w, h);
    let i = 0;
    for (let d = -D; d <= D; d += gap, i++) {
      const cx = x + w / 2 - s * d, cy = y + h / 2 + c * d;
      ctx.beginPath();
      ctx.moveTo(cx - c * D + jit(i, 1, seed, 1.5), cy - s * D + jit(i, 2, seed, 1.5));
      ctx.lineTo(cx + c * D + jit(i, 3, seed, 1.5), cy + s * D + jit(i, 4, seed, 1.5));
      ctx.stroke();
    }
    ctx.restore();
  }

  // src/scenes/s05.js
  var ST5 = stationByN(5);
  var PAPER3 = "#f3ecdc";
  var PAPER_D = "#ebe2cf";
  var LEAD3 = "#8a847a";
  var LEAD_D = "#5f5a52";
  var LEAD_L = "#b4ada1";
  var P_FAR4 = 0.3;
  var P_MID2 = 0.7;
  var P_FG4 = 1.25;
  var FAR_BASE = 600;
  var BLOOM = [GAG, GAG + 2];
  var HELMET_SX = 560;
  var BEAR_SX = 1010;
  var SIGN_SX = 860;
  var R02 = (k) => rng("s05", k);
  function jag(x0, x1, yBase, hMin, hMax, R, step = [18, 46]) {
    const pts = [[x0, yBase]];
    let x = x0;
    pts.push([x0, yBase - lerp(hMin, hMax, R())]);
    while (x < x1) {
      x = Math.min(x1, x + lerp(step[0], step[1], R()));
      pts.push([x, yBase - lerp(hMin, hMax, R())]);
    }
    pts.push([x1, yBase]);
    return pts;
  }
  var fillPoly = (ctx, pts, color) => {
    poly(ctx, pts);
    ctx.fillStyle = color;
    ctx.fill();
  };
  function bPoly(B2, pts, closed = true) {
    const n = pts.length, segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      B2.line(a[0], a[1], b[0], b[1]);
    }
  }
  function bWash(B2, pts, color, alpha = 110, bleed = 0.18) {
    B2.noStroke();
    B2.fill(color, alpha);
    B2.fillBleed(bleed, "out");
    B2.polygon(pts);
    B2.noFill();
  }
  function farGeo() {
    const R = R02("far"), out = [];
    const [x0, x1] = [-1100, 3e3];
    for (let x = x0; x < x1; ) {
      const w = 70 + R() * 150, h = 50 + R() * 170;
      out.push({ x, w, h, pts: jag(x, x + w, FAR_BASE, h * 0.75, h, R, [14, 34]), wins: Math.floor(R() * 6) });
      x += w + 10 + R() * 60;
    }
    return out;
  }
  function midGeo(c5) {
    const R = R02("mid"), walls = [];
    for (let x = -1500; x < 3600; ) {
      const w = 220 + R() * 200, h = 200 + R() * 170, base = 790;
      const sx = x - c5 * P_MID2;
      if (sx > 180 && sx < 760) {
        x += 140;
        continue;
      }
      walls.push({
        x,
        w,
        h,
        base,
        pts: jag(x, x + w, base, h * 0.55, h, R, [22, 60]),
        win: R() < 0.7 ? { x: x + w * (0.25 + R() * 0.3), y: base - h * 0.62, w: 46 + R() * 20, h: 70 + R() * 20 } : null,
        brick: { x: x + w * R() * 0.4, y: base - h * (0.2 + R() * 0.3), w: w * 0.45, h: 70 },
        rebar: R() < 0.6,
        seed: Math.floor(R() * 1e3)
      });
      x += w + 260 + R() * 420;
    }
    const sign = { x: SIGN_SX + c5 * P_MID2 };
    return { walls, sign };
  }
  function groundGeo(c5) {
    const R = R02("ground"), stones = [], cracks = [];
    for (let x = -1200; x < 3600; x += 24 + R() * 60) {
      const y = ROAD_Y + 16 + R() * 170, r = 4 + R() * 13;
      const n = 6, pts = [];
      for (let k = 0; k < n; k++) {
        const a = k / n * Math.PI * 2 + R() * 0.4;
        pts.push([x + Math.cos(a) * r * (0.7 + R() * 0.5), y + Math.sin(a) * r * 0.6 * (0.7 + R() * 0.5)]);
      }
      stones.push({ pts, brick: R() < 0.25 });
    }
    for (let x = -1200; x < 3600; x += 120 + R() * 180) {
      const pts = [[x, ROAD_Y + 4]];
      let cx = x, cy = ROAD_Y + 4;
      const n = 4 + Math.floor(R() * 4);
      for (let k = 0; k < n; k++) {
        cx += 10 + R() * 30;
        cy += 8 + R() * 22;
        pts.push([cx, cy]);
      }
      cracks.push(pts);
    }
    return { stones, cracks, bear: { x: BEAR_SX + c5 } };
  }
  function farLines(env) {
    const g = farGeo();
    return sketchStrip("s05-far", P_FAR4, {
      y0: 300,
      y1: 640,
      fills: (ctx) => {
        for (const b of g) fillPoly(ctx, b.pts, PAPER3);
      },
      lines: (B2) => {
        B2.set("2H", LEAD_L, 0.9);
        for (const b of g) {
          bPoly(B2, b.pts.slice(1, -1), false);
          B2.line(b.x, FAR_BASE - 2, b.x, b.pts[1][1]);
          B2.line(b.x + b.w, FAR_BASE - 2, b.x + b.w, b.pts[b.pts.length - 2][1]);
          for (let k = 0; k < b.wins; k++) {
            const wx = b.x + 10 + k * 37 % Math.max(20, b.w - 26), wy = FAR_BASE - 30 - k * 53 % Math.max(30, b.h * 0.6);
            B2.rect(wx, wy, 10, 14);
          }
        }
        B2.set("2H", LEAD_L, 0.8);
        B2.line(-1100, FAR_BASE, 3e3, FAR_BASE);
      }
    });
  }
  function farWash() {
    const g = farGeo();
    return washStrip("s05-farw", P_FAR4, {
      y0: 300,
      y1: 640,
      wash: (B2) => {
        g.forEach((b, i) => bWash(B2, b.pts, ["#b9b4d6", "#c3d3e2", "#d4c6dc"][i % 3], 70, 0.12));
      }
    });
  }
  function signPts(s) {
    const top = [s.x + 70, 650], foot = [s.x - 110, 782];
    return { top, foot, plate: ellipsePts(top[0] + 26, top[1] - 18, 44, 44, 20) };
  }
  function midLines(env) {
    const g = midGeo(env.camAt(GAG));
    return sketchStrip("s05-mid", P_MID2, {
      y0: 300,
      y1: 820,
      fills: (ctx, x0, x1) => {
        ctx.fillStyle = PAPER3;
        ctx.fillRect(x0, 640, x1 - x0, 180);
        for (const w of g.walls) {
          fillPoly(ctx, w.pts, PAPER_D);
          if (w.win) {
            ctx.fillStyle = mix(PAPER_D, "#d8cdb8", 0.6);
            roundRect(ctx, w.win.x, w.win.y, w.win.w, w.win.h, w.win.w / 2);
            ctx.fill();
          }
        }
      },
      lines: (B2, x0, x1) => {
        const R = R02("midlines");
        B2.set("2H", LEAD_L, 0.7);
        for (let x = x0; x < x1; x += 90 + R() * 160) {
          const y = 660 + R() * 120;
          B2.line(x, y, x + 30 + R() * 80, y + (R() - 0.5) * 6);
        }
        for (const w of g.walls) {
          B2.set("HB", LEAD3, 1.1);
          bPoly(B2, w.pts.slice(1, -1), false);
          B2.line(w.x, w.base, w.x, w.pts[1][1]);
          B2.line(w.x + w.w, w.base, w.x + w.w, w.pts[w.pts.length - 2][1]);
          B2.set("2H", LEAD3, 0.8);
          const bk = w.brick;
          for (let r = 0; r < 4; r++) {
            const yy = bk.y + r * 17;
            B2.line(bk.x, yy, bk.x + bk.w * (0.6 + R() * 0.4), yy);
            for (let xx = bk.x + r % 2 * 18; xx < bk.x + bk.w * 0.8; xx += 36) B2.line(xx, yy, xx, yy + 17);
          }
          if (w.win) {
            const { x, y, w: ww, h } = w.win;
            B2.set("HB", LEAD3, 0.9);
            B2.spline([[x, y + h], [x, y + ww / 2], [x + ww / 2, y], [x + ww, y + ww / 2], [x + ww, y + h]], 0.6);
            B2.line(x, y + h, x + ww, y + h);
            B2.set("2H", LEAD_L, 0.7);
            for (let k = 6; k < ww + h; k += 9) B2.line(x + Math.max(0, k - h), y + Math.min(h, k), x + Math.min(ww, k), y + Math.max(ww * 0.4, k - ww));
          }
          B2.set("2H", LEAD3, 0.8);
          let cx = w.x + w.w * (0.5 + R() * 0.3), cy = w.pts[3] ? w.pts[3][1] + 10 : w.base - w.h * 0.8;
          for (let k = 0; k < 5; k++) {
            const nx = cx + (R() - 0.5) * 30, ny = cy + 18 + R() * 20;
            B2.line(cx, cy, nx, ny);
            cx = nx;
            cy = ny;
          }
          if (w.rebar) {
            B2.set("HB", LEAD_D, 0.8);
            const t = w.pts[2];
            B2.line(t[0], t[1], t[0] + 14, t[1] - 46);
            B2.line(t[0] + 10, t[1] + 2, t[0] + 30, t[1] - 36);
          }
          B2.set("2H", LEAD3, 0.8);
          for (let k = 0; k < 5; k++) {
            const bx = w.x - 30 + R() * (w.w + 60);
            B2.rect(bx, w.base - 10 - R() * 6, 16 + R() * 14, 10);
          }
        }
        const s = signPts(g.sign);
        B2.set("HB", LEAD_D, 1.2);
        B2.line(s.foot[0], s.foot[1], s.top[0], s.top[1]);
        B2.line(s.foot[0] + 8, s.foot[1] + 4, s.top[0] + 6, s.top[1] + 6);
        bPoly(B2, s.plate, true);
        B2.set("HB", LEAD3, 1);
        const [px, py] = [s.top[0] + 26, s.top[1] - 18];
        B2.line(px - 22, py + 14, px + 18, py - 16);
        B2.line(px + 18, py - 16, px + 2, py - 16);
        B2.line(px + 18, py - 16, px + 16, py);
      }
    });
  }
  function midWash(env) {
    const g = midGeo(env.camAt(GAG));
    return washStrip("s05-midw", P_MID2, {
      y0: 300,
      y1: 820,
      wash: (B2, x0, x1) => {
        const R = R02("midwash");
        bWash(B2, [[x0, 650], [x1, 650], [x1, 800], [x0, 800]], "#e3d2ae", 70, 0.08);
        for (const w of g.walls) {
          bWash(B2, w.pts, R() < 0.5 ? "#e9b98f" : "#ecc9a2", 120, 0.2);
          const bk = w.brick;
          bWash(B2, [[bk.x, bk.y], [bk.x + bk.w * 0.9, bk.y], [bk.x + bk.w * 0.8, bk.y + 66], [bk.x, bk.y + 66]], "#d27f5c", 120, 0.15);
          if (w.win) bWash(B2, ellipsePts(w.win.x + w.win.w / 2, w.win.y + w.win.h / 2, w.win.w / 2, w.win.h / 2, 14), "#9fc3df", 110, 0.1);
        }
        const s = signPts(g.sign);
        bWash(B2, s.plate, "#6f9fd0", 150, 0.08);
        for (const w of g.walls) {
          for (let v = 0; v < 4; v++) {
            let x = w.x + 20 + R() * (w.w - 40), y = w.base;
            const top = w.base - w.h * (0.45 + R() * 0.45);
            const pts = [[x, y]];
            while (y > top) {
              y -= 26;
              x += Math.sin(y * 0.05 + v) * 14;
              pts.push([x, y]);
            }
            B2.set("cpencil", "#3f7a2e", 1.8);
            B2.spline(pts, 0.5);
            for (let k = 1; k < pts.length; k++) {
              const [lx, ly] = pts[k], sd = k % 2 ? 1 : -1;
              bWash(B2, ellipsePts(lx + sd * 15, ly, 16, 9, 8, sd * 0.6), k % 3 ? "#6fb84c" : "#4f9a3a", 220, 0.08);
              if (k % 2) bWash(B2, ellipsePts(lx - sd * 10, ly - 10, 11, 7, 8, -sd * 0.5), "#8fcf68", 200, 0.08);
            }
          }
        }
      }
    });
  }
  function bearPts(x) {
    const y = ROAD_Y - 6;
    return {
      body: ellipsePts(x, y - 40, 40, 44, 18),
      head: ellipsePts(x + 6, y - 104, 32, 29, 16),
      earL: ellipsePts(x - 18, y - 128, 12, 12, 10),
      earR: ellipsePts(x + 30, y - 126, 11, 11, 10),
      armL: ellipsePts(x - 40, y - 46, 14, 22, 10, 0.5),
      armR: ellipsePts(x + 40, y - 40, 14, 22, 10, -0.6),
      legL: ellipsePts(x - 22, y - 8, 20, 13, 10),
      legR: ellipsePts(x + 26, y - 6, 20, 13, 10),
      snout: ellipsePts(x + 20, y - 96, 13, 10, 10),
      patch: [[x - 14, y - 56], [x + 6, y - 60], [x + 8, y - 40], [x - 12, y - 38]],
      eye: [x + 12, y - 110],
      nose: [x + 30, y - 98]
    };
  }
  function groundLines(env) {
    const g = groundGeo(env.camAt(GAG));
    return sketchStrip("s05-ground", 1, {
      y0: ROAD_Y - 150,
      y1: 1e3,
      fills: (ctx, x0, x1) => {
        ctx.fillStyle = PAPER3;
        ctx.fillRect(x0, ROAD_Y, x1 - x0, 1e3 - ROAD_Y);
        const b = bearPts(g.bear.x);
        for (const k of ["armL", "legL", "body", "legR", "head", "earL", "earR", "armR"]) fillPoly(ctx, b[k], PAPER_D);
      },
      lines: (B2, x0, x1) => {
        B2.set("HB", LEAD3, 1.2);
        B2.line(x0, ROAD_Y, x1, ROAD_Y);
        B2.set("2H", LEAD3, 0.8);
        for (const c of g.cracks) bPoly(B2, c, false);
        for (const s of g.stones) {
          B2.set(s.brick ? "HB" : "2H", s.brick ? LEAD3 : LEAD_L, 0.8);
          bPoly(B2, s.pts, true);
        }
        const R = R02("glines");
        B2.set("2H", LEAD_L, 0.6);
        for (let x = x0; x < x1; x += 60 + R() * 120) {
          const y = ROAD_Y + 40 + R() * 150;
          B2.line(x, y, x + 40 + R() * 70, y + (R() - 0.5) * 4);
        }
        const b = bearPts(g.bear.x);
        B2.set("HB", LEAD_D, 0.9);
        for (const k of ["armL", "legL", "body", "legR", "head", "earL", "earR", "armR", "snout"]) bPoly(B2, b[k], true);
        B2.set("2H", LEAD3, 0.8);
        bPoly(B2, b.patch, true);
        for (let k = 0; k < 4; k++) B2.line(b.patch[0][0] + 4 + k * 5, b.patch[0][1] - 4, b.patch[0][0] + 4 + k * 5, b.patch[0][1] + 4);
        B2.set("pen", LEAD_D, 0.9);
        B2.circle(b.eye[0], b.eye[1], 3.5);
        B2.circle(b.nose[0], b.nose[1], 4);
        B2.set("2H", LEAD_D, 0.7);
        B2.line(b.eye[0] - 22, b.eye[1] + 2, b.eye[0] - 14, b.eye[1] + 6);
        B2.line(b.eye[0] - 22, b.eye[1] + 6, b.eye[0] - 14, b.eye[1] + 2);
      }
    });
  }
  function groundWash(env) {
    const g = groundGeo(env.camAt(GAG));
    return washStrip("s05-groundw", 1, {
      y0: ROAD_Y - 150,
      y1: 1e3,
      wash: (B2, x0, x1) => {
        bWash(B2, [[x0, ROAD_Y], [x1, ROAD_Y], [x1, 1e3], [x0, 1e3]], "#dcc9a3", 80, 0.06);
        for (const s of g.stones) bWash(B2, s.pts, s.brick ? "#d98a62" : "#b9b6c4", 150, 0.05);
        const R = R02("grass");
        for (const c of g.cracks) {
          const [gx, gy] = c[Math.floor(c.length / 2)];
          bWash(B2, ellipsePts(gx, gy, 22 + R() * 14, 7, 10), "#9ccb6e", 150, 0.15);
        }
        const b = bearPts(g.bear.x);
        for (const k of ["armL", "legL", "body", "legR", "head", "earL", "earR", "armR"]) bWash(B2, b[k], "#c98a55", 160, 0.12);
        bWash(B2, b.snout, "#efd0a8", 160, 0.1);
        bWash(B2, b.patch, "#7fa6d6", 170, 0.05);
      }
    });
  }
  function fgLines(env) {
    const c5 = env.camAt(GAG);
    const piles = [-260 + c5 * P_FG4, 1330 + c5 * P_FG4, 2600 + c5 * P_FG4];
    const R = R02("fg");
    const chunks = [];
    for (const px of piles) for (let k = 0; k < 9; k++) {
      const x = px + (R() - 0.5) * 300, y = 940 + R() * 70, w = 40 + R() * 60, h = 22 + R() * 26, a = (R() - 0.5) * 0.5;
      const pts = [[-w / 2, -h / 2], [w / 2, -h / 2 + R() * 6], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)]);
      chunks.push({ pts, brick: R() < 0.5 });
    }
    return {
      lines: sketchStrip("s05-fg", P_FG4, {
        y0: 880,
        y1: 1060,
        fills: (ctx) => {
          for (const c of chunks) fillPoly(ctx, c.pts, PAPER_D);
        },
        lines: (B2) => {
          B2.set("HB", LEAD_D, 1.1);
          for (const c of chunks) bPoly(B2, c.pts, true);
        }
      }),
      wash: washStrip("s05-fgw", P_FG4, { y0: 880, y1: 1060, wash: (B2) => {
        for (const c of chunks) bWash(B2, c.pts, c.brick ? "#d98a62" : "#c2bdb2", 150, 0.08);
      } })
    };
  }
  function dovePath(t) {
    const P2 = [[HELMET_SX + 26, ROAD_Y + 2], [HELMET_SX + 10, 520], [760, 240], [1300, 70]];
    const u = 1 - t;
    return [0, 1].map((i) => u * u * u * P2[0][i] + 3 * u * u * t * P2[1][i] + 3 * u * t * t * P2[2][i] + t * t * t * P2[3][i]);
  }
  var DOVE_T = (b) => ease.out(clamp((b - BLOOM[0]) / 1.7));
  function blobPath2(path, cx, cy, r, seed, b) {
    const n = 56;
    for (let i = 0; i <= n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 1 + 0.16 * (noise2(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + b * 0.15, 61) - 0.5) * 2;
      const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
      i ? path.lineTo(x, y) : path.moveTo(x, y);
    }
    path.closePath();
  }
  function bloomPath(b, grow = 0) {
    if (b < BLOOM[0]) return null;
    if (b >= BLOOM[1]) return "all";
    const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
    const p = new Path2D();
    blobPath2(p, HELMET_SX, ROAD_Y - 40, 40 + 2e3 * ease.inOut(t) + grow, 3, b);
    if (grow === "main") return p;
    const dt = DOVE_T(b);
    for (let s = 0; s <= 10; s++) {
      const ts = s / 10 * dt;
      const age = b - (BLOOM[0] + ts * 1.2);
      if (age <= 0) continue;
      const [x, y] = dovePath(ts);
      blobPath2(p, x, y, 30 + 520 * Math.min(1, age) + grow, s * 7.3, b);
    }
    return p;
  }
  function coverage(b, x, y) {
    if (b < BLOOM[0]) return 0;
    if (b >= BLOOM[1]) return 1;
    const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
    let best = 2e3 * ease.inOut(t) + 40 - Math.hypot(x - HELMET_SX, y - (ROAD_Y - 40));
    const dt = DOVE_T(b);
    for (let s = 0; s <= 10; s++) {
      const ts = s / 10 * dt, age = b - (BLOOM[0] + ts * 1.2);
      if (age <= 0) continue;
      const [dx, dy] = dovePath(ts);
      best = Math.max(best, 30 + 520 * Math.min(1, age) - Math.hypot(x - dx, y - dy));
    }
    return smoothstep(-60, 120, best);
  }
  function withBloom(ctx, b, draw) {
    const m = bloomPath(b);
    if (!m) return;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    if (m === "all") {
      draw();
      ctx.restore();
      return;
    }
    const outer = bloomPath(b, 34);
    ctx.save();
    ctx.clip(outer);
    ctx.globalAlpha = 0.4;
    draw();
    ctx.restore();
    ctx.save();
    ctx.clip(m);
    draw();
    ctx.restore();
    const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
    const r = 40 + 2e3 * ease.inOut(t);
    const edge = new Path2D();
    blobPath2(edge, HELMET_SX, ROAD_Y - 40, r, 3, b);
    ctx.strokeStyle = rgba("#a9b9c8", 0.25 * smoothstep(250, 700, r));
    ctx.lineWidth = 6;
    ctx.stroke(edge);
    ctx.restore();
  }
  var FLOWER_COLS = ["#f28aa5", "#f7c948", "#7fb7e8", "#f59b5a", "#c58fe0"];
  function flower(ctx, x, y, s, col, seed) {
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = "#5f9a45";
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-4, -12, 0, -26);
    ctx.stroke();
    ctx.fillStyle = "#7fbf5e";
    ellipse(ctx, 6, -12, 7, 3.5, -0.6);
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + seed;
      ellipse(ctx, Math.cos(a) * 8, -30 + Math.sin(a) * 8, 7, 5, a);
      ctx.fillStyle = col;
      ctx.fill();
    }
    circle(ctx, 0, -30, 4.5);
    ctx.fillStyle = "#fbe6a0";
    ctx.fill();
    sketchEllipse(ctx, 0, -30, 14, 14, { seed: seed * 10, color: LEAD_D, width: 1, jitter: 1.4, passes: 1, alpha: 0.6 });
    ctx.restore();
  }
  function drawFlowers(ctx, b, env) {
    for (let k = 0; k < 16; k++) {
      if (k >= GAG && k < GAG + 4) continue;
      if (b < k) break;
      const wx = env.camAt(k) + CHAR_X + 92 + (hash2(k, 1, 5) - 0.5) * 14;
      const sx = wx - env.cam;
      if (sx < X_MIN - 60 || sx > X_MAX + 60) continue;
      const pop = ease.outBack(clamp((b - k) / 0.35));
      flower(ctx, sx, ROAD_Y + 6 + hash2(k, 2, 5) * 10, pop * (1.5 + hash2(k, 3, 5) * 0.4), FLOWER_COLS[k % FLOWER_COLS.length], k * 1.3);
    }
  }
  function helmet(ctx, x, y, rock3, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.35 + rock3);
    const dome = ellipsePts(0, 0, 58, 44, 22, 0, Math.PI, Math.PI * 2);
    const rim = ellipsePts(0, 0, 70, 12, 22);
    poly(ctx, [...dome, [58, 0], [-58, 0]]);
    ctx.fillStyle = PAPER_D;
    ctx.fill();
    if (color > 0) {
      ctx.globalAlpha = color;
      poly(ctx, dome);
      ctx.fillStyle = "#9aa77a";
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = color > 0 ? mix(PAPER_D, "#6f7a55", color * 0.6) : "#ddd3bf";
    ctx.fill();
    sketchPoly(ctx, dome, { close: false, seed: 51, color: LEAD_D, width: 1.6 });
    sketchPoly(ctx, rim, { close: false, seed: 52, color: LEAD_D, width: 1.4, over: 1 });
    sketchHatch(ctx, 10, -40, 46, 38, { angle: 1.1, gap: 7, color: LEAD3, alpha: 0.5, seed: 53 });
    sketchEllipse(ctx, -20, -24, 6, 4, { seed: 54, color: LEAD_D, width: 1, passes: 1 });
    sketchLine(ctx, [-38, -10], [-24, -30], { seed: 55, color: LEAD3, width: 1 });
    sketchPoly(ctx, [[-50, 2], [-40, 22], [-10, 26], [6, 12]], { close: false, seed: 56, color: LEAD_D, width: 1.3 });
    ctx.restore();
  }
  function dove(ctx, x, y, s, flap, facing = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * facing, s);
    const body = [[-34, 2], [-18, -10], [10, -12], [24, -20], [38, -18], [50, -10], [42, -6], [30, 6], [4, 14], [-24, 10], [-48, 18], [-44, 4]];
    const wa = -1.1 + flap * 2;
    const wing = [[-6, -6], [-14 + Math.cos(wa) * 22, -6 + Math.sin(wa) * 46], [-30 + Math.cos(wa) * 40, -6 + Math.sin(wa) * 62], [-24, 0], [12, -2]];
    for (const p of [body, wing]) {
      poly(ctx, p);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    sketchPoly(ctx, body, { seed: 71, color: LEAD_D, width: 1.6 / s, over: 2 });
    sketchPoly(ctx, wing, { seed: 72, color: LEAD_D, width: 1.4 / s, over: 2 });
    for (let k = 0; k < 3; k++) sketchLine(ctx, [-8 - k * 7, -4], [-16 + Math.cos(wa) * 20 * (0.4 + k * 0.18) - k * 6, -6 + Math.sin(wa) * 40 * (0.4 + k * 0.18)], { seed: 73 + k, color: LEAD3, width: 1 / s, passes: 1 });
    circle(ctx, 38, -14, 2.2);
    ctx.fillStyle = LEAD_D;
    ctx.fill();
    poly(ctx, [[49, -12], [58, -9], [49, -7]]);
    ctx.fillStyle = "#e0a060";
    ctx.fill();
    ctx.restore();
  }
  function paperCard2(ctx, x, y, w, h, seed) {
    ctx.save();
    ctx.fillStyle = "rgba(90,80,60,0.12)";
    ctx.fillRect(x + 6, y + 8, w, h);
    ctx.fillStyle = "#fbf6ea";
    ctx.fillRect(x, y, w, h);
    sketchPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed, color: LEAD_D, width: 1.8, jitter: 1.6, over: 8 });
    sketchHatch(ctx, x + w - 18, y + 8, 14, h - 16, { gap: 5, color: LEAD3, alpha: 0.45, seed: seed + 1 });
    for (const [tx, ty, a] of [[x + 18, y - 6, -0.3], [x + w - 40, y + h - 10, -0.25]]) {
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(a);
      ctx.fillStyle = "rgba(236,226,196,0.85)";
      ctx.fillRect(-22, -9, 50, 18);
      sketchPoly(ctx, [[-22, -9], [28, -9], [28, 9], [-22, 9]], { seed: seed + 2, color: LEAD_L, width: 1, passes: 1 });
      ctx.restore();
    }
    ctx.restore();
  }
  function sketchCassette(ctx, kind, cx, cy, s, spin) {
    const w = 200 * s, h = 128 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "#fbf6ea";
    roundRect(ctx, -w / 2, -h / 2, w, h, 10);
    ctx.fill();
    const S = (pts, seed, wd = 1.8) => sketchPoly(ctx, pts, { seed, color: LEAD_D, width: wd, jitter: 1.2, over: 5 });
    S([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 81, 2);
    S([[-w / 2 + 14, -h / 2 + 12], [w / 2 - 14, -h / 2 + 12], [w / 2 - 14, -h / 2 + 78], [-w / 2 + 14, -h / 2 + 78]], 82, 1.4);
    S([[-52, -h / 2 + 34], [52, -h / 2 + 34], [52, -h / 2 + 68], [-52, -h / 2 + 68]], 83, 1.4);
    sketchHatch(ctx, -50, -h / 2 + 36, 100, 30, { gap: 5, color: LEAD3, alpha: 0.35, seed: 84 });
    for (const sx of [-1, 1]) {
      const rx = sx * 34, ry = -h / 2 + 51;
      ctx.fillStyle = "#fbf6ea";
      circle(ctx, rx, ry, 11);
      ctx.fill();
      sketchEllipse(ctx, rx, ry, 11, 11, { seed: 85 + sx, color: LEAD_D, width: 1.4 });
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(spin);
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.strokeStyle = LEAD_D;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(0, -9);
        ctx.stroke();
      }
      ctx.restore();
    }
    S([[-60, h / 2], [-48, h / 2 - 30], [48, h / 2 - 30], [60, h / 2]], 87, 1.4);
    for (const sx of [-1, 1]) sketchEllipse(ctx, sx * 30, h / 2 - 14, 5, 5, { seed: 88 + sx, color: LEAD_D, width: 1.2, passes: 1 });
    ctx.restore();
  }
  var s05 = {
    id: "s05",
    station: ST5,
    freezeBeat: GAG + 3,
    // Outro 展墙里定格成已经上色的样子
    drawFigure(ctx, fig, b, env) {
      drawWalker(ctx, { ...fig, style: "sketch" });
      const k = coverage(b, CHAR_X, ROAD_Y - 260);
      if (k > 0) {
        ctx.save();
        ctx.globalAlpha *= k;
        drawWalker(ctx, { ...fig, style: "sketch-color" });
        ctx.restore();
      }
    },
    drawBack(ctx, b, env) {
      const cam = env.cam;
      const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1e3 * K);
      ctx.drawImage(paperTexture(pw, ph, { base: PAPER3, seed: 55, amount: 0.7, fibers: 160 }), X_MIN, 0, X_MAX - X_MIN, 1e3);
      ctx.save();
      ctx.strokeStyle = rgba(LEAD_L, 0.55);
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      for (let k = 0; k < 6; k++) {
        const cx = ((k * 470 - cam * 0.05) % 2400 + 2400) % 2400 + X_MIN - 200, cy = 110 + k % 3 * 70;
        for (let j = 0; j < 3; j++) {
          ctx.beginPath();
          ctx.arc(cx + j * 40, cy - j % 2 * 10, 30 + j * 6, Math.PI * 1.05, Math.PI * 1.95);
          ctx.stroke();
        }
      }
      ctx.restore();
      withBloom(ctx, b, () => {
        const g = ctx.createLinearGradient(0, 0, 0, 640);
        g.addColorStop(0, "#9fcbea");
        g.addColorStop(0.7, "#cfe6f2");
        g.addColorStop(1, "#eef4f4");
        ctx.fillStyle = g;
        ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 660);
      });
      for (const [lines, wash2] of [[farLines(env), farWash()], [midLines(env), midWash(env)], [groundLines(env), groundWash(env)]]) {
        drawStrip(ctx, lines, cam);
        withBloom(ctx, b, () => drawStrip(ctx, wash2, cam));
      }
      const hx = HELMET_SX + env.camAt(BLOOM[0]) - cam;
      const u = b - BLOOM[0];
      const rock3 = u > 0 ? 0.22 * Math.exp(-u * 5) * Math.sin(u * 22) : 0;
      helmet(ctx, hx, ROAD_Y + 4, rock3, coverage(b, hx, ROAD_Y));
      drawFlowers(ctx, b, env);
    },
    drawFront(ctx, b, env) {
      const cam = env.cam;
      const fg = fgLines(env);
      drawStrip(ctx, fg.lines, cam);
      withBloom(ctx, b, () => drawStrip(ctx, fg.wash, cam));
      if (b >= BLOOM[0] - 0.02 && b < BLOOM[0] + 1.8) {
        const t = DOVE_T(b);
        const [x, y] = dovePath(t);
        const [x2] = dovePath(Math.min(1, t + 0.02));
        dove(ctx, x, y, 1.15 + t * 0.2, b * 3.2 % 1, x2 >= x ? 1 : -1);
      }
    },
    drawFrame(ctx, R) {
      const t = 64 * R.s, { x, y, w, h } = R;
      ctx.save();
      const band = new Path2D();
      band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
      band.rect(x, y, w, h);
      ctx.fillStyle = "#efdcbc";
      ctx.fill(band, "evenodd");
      const o = { color: LEAD_D, width: Math.max(1, 2 * R.s), jitter: 1.5 * R.s, over: 10 * R.s };
      sketchPoly(ctx, [[x - t, y - t], [x + w + t, y - t], [x + w + t, y + h + t], [x - t, y + h + t]], { ...o, seed: 91 });
      sketchPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, seed: 92 });
      sketchPoly(ctx, [[x - t * 0.5, y - t * 0.5], [x + w + t * 0.5, y - t * 0.5], [x + w + t * 0.5, y + h + t * 0.5], [x - t * 0.5, y + h + t * 0.5]], { ...o, seed: 93, width: Math.max(1, 1.2 * R.s) });
      ctx.restore();
    },
    cardStyle: {
      ink: "#3b3732",
      accent: "#8c867b",
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        paperCard2(ctx, x, y, w, h, 101);
      }
    },
    playerStyle: {
      ink: "#3b3732",
      noteColor: "#8c867b",
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        paperCard2(ctx, x, y, w, h, 111);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        sketchCassette(ctx, kind, cx, cy, s, spin);
      }
    }
  };

  // src/scenes/s06.js
  var ST6 = stationByN(6);
  var PAPER4 = "#fbfaf6";
  var CARD = "#fefdf9";
  var INK5 = "#1f2a44";
  var INK_M = "#4a5674";
  var INK_L = "#7a869e";
  var MOON_C = "#ffffff";
  var P_SKY2 = 0.04;
  var P_FAR5 = 0.3;
  var P_MID3 = 0.7;
  var P_FG5 = 1.3;
  var MOON = { x: 1010, y: 215, r: 165 };
  var PIANO_X = 500;
  var PARAPET = 690;
  var CLEAR = [230, 1130];
  var N_CROW = 7;
  var LAND0 = GAG - 3.5;
  var LAND_STEP = 0.5;
  var FLY_T = 0.9;
  var TURN = [GAG, GAG + 2];
  var TAKEOFF = GAG + 4.6;
  var FLY_OFF = 2.3;
  var R03 = (k) => rng("s06", k);
  function wobbly(pts, { seed = 1, wob = 0.45, step = 12, close = false } = {}) {
    const out = [];
    const n = pts.length, segs = close ? n : n - 1;
    let acc2 = 0;
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
      const nx = -dy / L, ny = dx / L;
      const m = Math.max(1, Math.ceil(L / step));
      for (let k = i ? 1 : 0; k <= m; k++) {
        const t = k / m;
        const d = (noise2((acc2 + t * L) / 34, seed * 1.37, seed) - 0.5) * 2 * wob;
        out.push([a[0] + dx * t + nx * d, a[1] + dy * t + ny * d]);
      }
      acc2 += L;
    }
    return out;
  }
  function tracePath(ctx, pts, close) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    if (close) ctx.closePath();
  }
  function pen2(ctx, pts, { w = 1.2, color = INK5, alpha = 1, seed = 1, wob = 0.45, step = 12, close = false, fill = null } = {}) {
    const q = wob > 0 ? wobbly(pts, { seed, wob, step, close }) : pts;
    ctx.save();
    tracePath(ctx, q, close);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (w > 0) {
      ctx.globalAlpha *= alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
    ctx.restore();
  }
  function spline(pts, per = 8) {
    const n = pts.length, out = [];
    const P2 = (i) => pts[Math.max(0, Math.min(n - 1, i))];
    for (let i = 0; i < n - 1; i++) {
      const p0 = P2(i - 1), p1 = P2(i), p2 = P2(i + 1), p3 = P2(i + 2);
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[n - 1]);
    return out;
  }
  function hatch(ctx, clip, box, { angle = 0.8, gap = 6, w = 0.9, color = INK5, alpha = 0.8, seed = 1, wob = 0.5, breaks = 0.12 } = {}) {
    const [bx, by, bw, bh] = box;
    ctx.save();
    if (clip) ctx.clip(clip);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.globalAlpha *= alpha;
    ctx.lineCap = "round";
    const c = Math.cos(angle), s = Math.sin(angle), D = Math.hypot(bw, bh) / 2 + 4, cx = bx + bw / 2, cy = by + bh / 2;
    ctx.beginPath();
    let i = 0;
    for (let d = -D; d <= D; d += gap, i++) {
      const jd = d + (hash2(i, 1, seed) - 0.5) * gap * 0.35;
      const px = cx - s * jd, py = cy + c * jd;
      const cut = hash2(i, 2, seed) < breaks ? lerp(-0.6, 0.6, hash2(i, 3, seed)) * D : null;
      const spans = cut === null ? [[-D, D]] : [[-D, cut - 3], [cut + 3 + hash2(i, 4, seed) * 8, D]];
      for (const [u0, u1] of spans) {
        const m = (hash2(i, 5, seed) - 0.5) * 2 * wob;
        ctx.moveTo(px + c * u0, py + s * u0);
        ctx.quadraticCurveTo(px + c * (u0 + u1) / 2 - s * m, py + s * (u0 + u1) / 2 + c * m, px + c * u1, py + s * u1);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  var polyPath = (pts) => {
    const p = new Path2D();
    pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    p.closePath();
    return p;
  };
  var rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  var ellPts = (cx, cy, rx, ry, n = 24, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + (a1 - a0) * i / n;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });
  function skyLayer3(cg) {
    const MX = MOON.x + cg * P_SKY2, MY = MOON.y, MR = MOON.r;
    return strip("s06-sky", P_SKY2, (ctx, x0, x1) => {
      const R = R03("sky");
      const clip = new Path2D();
      clip.rect(x0, 0, x1 - x0, 700);
      clip.arc(MX, MY, MR * 1.2, 0, Math.PI * 2);
      ctx.save();
      ctx.clip(clip, "evenodd");
      ctx.strokeStyle = INK5;
      ctx.lineCap = "round";
      const row = (y, pass) => {
        const t = y / 600;
        let x = x0 - R() * 120;
        while (x < x1) {
          const L = 34 + R() * 120;
          const mx = x + L / 2;
          const d = Math.hypot(mx - MX, y - MY) / MR;
          const keep = smoothstep(1.15, 2.4, d) * (0.85 - 0.8 * smoothstep(0.3, 0.95, t)) * (pass ? 1 - smoothstep(0.05, 0.36, t) : 1);
          if (R() < keep) {
            const slope = -0.03 + (R() - 0.5) * 0.02;
            ctx.globalAlpha = 0.5 + R() * 0.3;
            ctx.lineWidth = 0.8 + R() * 0.35;
            const q = wobbly([[x, y], [x + L, y + slope * L]], { seed: Math.floor(x * 7 + y), wob: 0.7, step: 16 });
            tracePath(ctx, q, false);
            ctx.stroke();
          }
          x += L + 14 + R() * 30 * (1 + t * 3);
        }
      };
      for (let y = 5; y < 600; ) {
        row(y, 0);
        y += lerp(8, 26, Math.pow(y / 600, 0.65)) * (0.8 + R() * 0.4);
      }
      for (let y = 9; y < 230; ) {
        row(y, 1);
        y += lerp(10, 18, y / 230) * (0.85 + R() * 0.3);
      }
      ctx.restore();
      for (const [k, a, seg2] of [[1.08, 0.55, 0], [1.2, 0.32, 1]]) {
        const n = seg2 ? 14 : 1;
        for (let i = 0; i < n; i++) {
          const a0 = i / n * Math.PI * 2 + R() * 0.2, a1 = a0 + (seg2 ? Math.PI * 2 / n * (0.45 + R() * 0.3) : Math.PI * 2);
          pen2(ctx, ellPts(MX, MY, MR * k, MR * k, seg2 ? 6 : 90, a0, a1), { w: 0.9, alpha: a, seed: 30 + i, wob: 0.5, color: INK_M });
        }
      }
      pen2(ctx, ellPts(MX, MY, MR, MR, 120), { w: 1.5, fill: MOON_C, seed: 7, wob: 0.6, step: 10, close: true });
      pen2(ctx, ellPts(MX, MY, MR * 0.92, MR * 0.92, 24, 0.15, 1.35), { w: 0.9, alpha: 0.4, color: INK_M, seed: 8, wob: 0.4 });
      pen2(ctx, ellPts(MX, MY, MR * 0.86, MR * 0.86, 16, 0.4, 1.1), { w: 0.8, alpha: 0.25, color: INK_M, seed: 9, wob: 0.4 });
      const RS = R03("stars");
      for (let i = 0; i < 46; i++) {
        const x = x0 + RS() * (x1 - x0), y = 20 + Math.pow(RS(), 1.4) * 430;
        if (Math.hypot(x - MX, y - MY) < MR * 1.45) continue;
        const s = 3 + RS() * 5;
        ctx.fillStyle = PAPER4;
        ctx.beginPath();
        ctx.arc(x, y, s * 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = INK5;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(x - s, y);
        ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s);
        ctx.lineTo(x, y + s);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }, { y0: 0, y1: 700 });
  }
  var TWINKLE = Array.from({ length: 7 }, (_, i) => ({ x: X_MIN + 120 + hash2(i, 1, 66) * (X_MAX - X_MIN - 240), y: 40 + hash2(i, 2, 66) * 300, ph: hash2(i, 3, 66) }));
  function drawTwinkles(ctx, b, cam) {
    for (const s of TWINKLE) {
      const x = s.x - cam * P_SKY2;
      if (Math.hypot(x - MOON.x, s.y - MOON.y) < MOON.r * 1.5) continue;
      const u = ((b + s.ph * 4) % 1 + 1) % 1;
      const k = Math.exp(-u * 5);
      const L = 4 + 9 * k;
      ctx.save();
      ctx.fillStyle = PAPER4;
      ctx.beginPath();
      ctx.arc(x, s.y, L * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK5;
      ctx.lineWidth = 1.1;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x - L, s.y);
      ctx.lineTo(x + L, s.y);
      ctx.moveTo(x, s.y - L);
      ctx.lineTo(x, s.y + L);
      const d = L * 0.45;
      ctx.moveTo(x - d, s.y - d);
      ctx.lineTo(x + d, s.y + d);
      ctx.moveTo(x - d, s.y + d);
      ctx.lineTo(x + d, s.y - d);
      ctx.globalAlpha = 0.9;
      ctx.stroke();
      ctx.restore();
    }
  }
  function farLayer4() {
    return strip("s06-far", P_FAR5, (ctx, x0, x1) => {
      const R = R03("far");
      const BASE4 = 700;
      const o = (seed) => ({ w: 1.05, color: INK_L, seed, wob: 0.35, fill: PAPER4, close: true });
      let x = x0 - 40, i = 0;
      while (x < x1) {
        const kind = R();
        i++;
        if (kind < 0.07) {
          const w2 = 46 + R() * 14, h2 = 150 + R() * 60, sh = 120 + R() * 50, cx = x + w2 / 2;
          pen2(ctx, [[x, BASE4], [x, BASE4 - h2], [x + w2, BASE4 - h2], [x + w2, BASE4]], o(i));
          pen2(ctx, [[x - 4, BASE4 - h2], [cx, BASE4 - h2 - sh], [x + w2 + 4, BASE4 - h2]], o(i + 500));
          hatch(ctx, polyPath([[cx, BASE4 - h2 - sh], [x + w2 + 4, BASE4 - h2], [cx, BASE4 - h2]]), [x, BASE4 - h2 - sh, w2 + 8, sh], { angle: 1.25, gap: 4.5, color: INK_L, w: 0.8, alpha: 0.7, seed: i });
          pen2(ctx, [[cx, BASE4 - h2 - sh], [cx, BASE4 - h2 - sh - 16]], { w: 1, color: INK_L, wob: 0 });
          const wy = BASE4 - h2 + 22;
          const arch = [[cx - 9, wy + 34], ...ellPts(cx, wy + 9, 9, 9, 8, Math.PI, Math.PI * 2), [cx + 9, wy + 34]];
          pen2(ctx, arch, { ...o(i + 900), fill: null, close: true });
          hatch(ctx, polyPath(arch), [cx - 10, wy, 20, 36], { angle: 1.1, gap: 3, color: INK_L, w: 0.8, seed: i + 3 });
          x += w2 + 10 + R() * 30;
          continue;
        }
        if (kind < 0.12) {
          const w2 = 120 + R() * 50, h2 = 80 + R() * 40, cx = x + w2 / 2, dr = w2 * 0.34;
          pen2(ctx, [[x, BASE4], [x, BASE4 - h2], [x + w2, BASE4 - h2], [x + w2, BASE4]], o(i));
          const dome = [[cx - dr, BASE4 - h2], ...ellPts(cx, BASE4 - h2, dr, dr * 0.9, 20, Math.PI, Math.PI * 2)];
          pen2(ctx, dome, o(i + 200));
          hatch(ctx, polyPath(dome), [cx, BASE4 - h2 - dr, dr, dr], { angle: 1.4, gap: 4, color: INK_L, w: 0.8, alpha: 0.6, seed: i });
          pen2(ctx, rectPts(cx - 5, BASE4 - h2 - dr * 0.9 - 18, 10, 18), o(i + 300));
          for (let k = 0; k < 4; k++) {
            const wx = x + 14 + k * (w2 - 28) / 3.2;
            pen2(ctx, rectPts(wx, BASE4 - h2 + 20, 9, 24), { ...o(i + 40 + k), fill: null });
          }
          x += w2 + 6 + R() * 26;
          continue;
        }
        const w = 64 + R() * 120, h = 56 + R() * 110, rh = 26 + R() * 46;
        const top = BASE4 - h;
        const roofKind = R();
        let roof2;
        if (roofKind < 0.45) roof2 = [[x - 4, top], [x + w / 2, top - rh], [x + w + 4, top]];
        else if (roofKind < 0.75) roof2 = [[x - 4, top], [x + w * 0.2, top - rh], [x + w * 0.8, top - rh], [x + w + 4, top]];
        else roof2 = [[x - 2, top], [x + w + 2, top]];
        const body = [[x, BASE4], [x, top], ...roof2.slice(1, -1), [x + w, top], [x + w, BASE4]];
        if (R() < 0.65) {
          const cx = x + w * (0.25 + R() * 0.5), ch = rh + 18 + R() * 20;
          pen2(ctx, rectPts(cx - 7, top - ch, 14, ch), o(i + 700));
          pen2(ctx, rectPts(cx - 9, top - ch - 5, 18, 6), o(i + 710));
          if (R() < 0.5) pen2(ctx, spline([[cx, top - ch - 8], [cx + 6, top - ch - 22], [cx - 2, top - ch - 34], [cx + 8, top - ch - 50], [cx + 4, top - ch - 64]], 5), { w: 0.8, color: INK_L, alpha: 0.6, seed: i + 720 });
        }
        pen2(ctx, body, o(i));
        if (roof2.length > 2) {
          hatch(ctx, polyPath([...roof2, [x + w + 4, top]]), [x - 4, top - rh, w + 8, rh], { angle: roofKind < 0.45 ? 2.2 : 1.57, gap: 5, color: INK_L, w: 0.8, alpha: 0.55, seed: i + 5 });
          pen2(ctx, roof2, { w: 1.1, color: INK_L, seed: i + 6, wob: 0.3 });
        }
        const cols = Math.max(1, Math.floor(w / 34)), rows = Math.max(1, Math.floor(h / 46));
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
          if (R() < 0.3) continue;
          const wx = x + w / cols * (c + 0.5) - 6, wy = top + 14 + r * 44;
          if (wy + 18 > BASE4 - 6) continue;
          const pts = rectPts(wx, wy, 12, 18);
          pen2(ctx, pts, { w: 0.9, color: INK_L, seed: i * 31 + r * 7 + c, wob: 0.25, close: true });
          if (R() < 0.35) hatch(ctx, polyPath(pts), [wx, wy, 12, 18], { angle: 0.9, gap: 2.6, color: INK_L, w: 0.8, seed: i + c + r });
          else pen2(ctx, [[wx + 6, wy], [wx + 6, wy + 18]], { w: 0.7, color: INK_L, alpha: 0.7, wob: 0 });
        }
        x += w + (R() < 0.35 ? -8 : 6 + R() * 34);
      }
    }, { y0: 330, y1: 720 });
  }
  function midGeo2(cg) {
    const R = R03("mid"), items = [];
    let lamp2 = true;
    for (let x = -900; x < 3900; ) {
      const sx = x - cg * P_MID3;
      if (sx > CLEAR[0] && sx < CLEAR[1]) {
        x += 90;
        continue;
      }
      items.push({ x, kind: lamp2 ? "lamp" : "tree", seed: Math.floor(R() * 1e3), h: R() });
      lamp2 = !lamp2 || R() < 0.2;
      x += 300 + R() * 260;
    }
    return items;
  }
  function lamp(ctx, x, seed) {
    const top = 430;
    pen2(ctx, [[x - 4, PARAPET + 10], [x - 3, top + 30], [x + 3, top + 30], [x + 4, PARAPET + 10]], { w: 1.1, color: INK_M, fill: PAPER4, seed, wob: 0.25, close: true });
    for (const y of [top + 40, top + 120, 610]) pen2(ctx, [[x - 7, y], [x + 7, y]], { w: 1.1, color: INK_M, seed: seed + y, wob: 0.2 });
    pen2(ctx, [[x - 16, top + 52], [x + 16, top + 52]], { w: 1.1, color: INK_M, seed: seed + 3, wob: 0.2 });
    const glass = [[x - 15, top - 22], [x + 15, top - 22], [x + 9, top + 22], [x - 9, top + 22]];
    pen2(ctx, [[x - 20, top - 22], [x, top - 40], [x + 20, top - 22]], { w: 1.2, color: INK_M, fill: PAPER4, seed: seed + 4, close: true });
    hatch(ctx, polyPath([[x, top - 40], [x + 20, top - 22], [x, top - 22]]), [x, top - 41, 21, 20], { angle: 1.2, gap: 2.8, color: INK_M, w: 0.8, seed });
    pen2(ctx, glass, { w: 1.1, color: INK_M, fill: "#ffffff", seed: seed + 5, close: true });
    pen2(ctx, [[x, top - 22], [x, top + 22]], { w: 0.7, color: INK_M, alpha: 0.6, wob: 0 });
    pen2(ctx, [[x - 9, top + 22], [x - 5, top + 30], [x + 5, top + 30], [x + 9, top + 22]], { w: 1.1, color: INK_M, fill: PAPER4, seed: seed + 6, close: true });
    pen2(ctx, [[x, top - 40], [x, top - 50]], { w: 1.1, color: INK_M, wob: 0 });
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * Math.PI * 2 + 0.13;
      const r0 = 32 + hash2(k, 1, seed) * 4, r1 = r0 + 7 + hash2(k, 2, seed) * 8;
      pen2(ctx, [[x + Math.cos(a) * r0, top + Math.sin(a) * r0], [x + Math.cos(a) * r1, top + Math.sin(a) * r1]], { w: 0.9, color: INK_M, alpha: 0.6, wob: 0 });
    }
  }
  function tree(ctx, x, seed, hk) {
    const R = rng("s06-tree", seed);
    const base = PARAPET + 12, h = 170 + hk * 80;
    const lean = (R() - 0.5) * 30;
    const topPt = [x + lean, base - h];
    const left = spline([[x - 13, base], [x - 9 + lean * 0.4, base - h * 0.5], [topPt[0] - 6, topPt[1]]], 6);
    const right = spline([[x + 13, base], [x + 8 + lean * 0.4, base - h * 0.5], [topPt[0] + 6, topPt[1]]], 6);
    const trunk = [...left, ...right.slice().reverse()];
    pen2(ctx, trunk, { w: 0, fill: PAPER4, wob: 0, close: true });
    hatch(ctx, polyPath(trunk), [x - 16 + Math.min(0, lean), base - h, 18, h], { angle: 1.5, gap: 3.4, color: INK_M, w: 0.8, alpha: 0.7, seed });
    pen2(ctx, left, { w: 1.2, color: INK_M, seed: seed + 1 });
    pen2(ctx, right, { w: 1.2, color: INK_M, seed: seed + 2 });
    const branch = (bx, by, ang, len, w, depth) => {
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      const mx = (bx + ex) / 2 + (R() - 0.5) * len * 0.25, my = (by + ey) / 2 + (R() - 0.5) * len * 0.25;
      pen2(ctx, spline([[bx, by], [mx, my], [ex, ey]], 4), { w, color: INK_M, seed: Math.floor(R() * 999), wob: 0.3, step: 8 });
      if (depth <= 0) return;
      const n = R() < 0.3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const da = (k - (n - 1) / 2) * (0.5 + R() * 0.35) + (R() - 0.5) * 0.25;
        branch(ex, ey, ang + da, len * (0.62 + R() * 0.16), Math.max(0.6, w * 0.72), depth - 1);
      }
    };
    branch(topPt[0], topPt[1] + 4, -Math.PI / 2 - 0.55, 60 + R() * 20, 2.6, 5);
    branch(topPt[0], topPt[1] + 2, -Math.PI / 2 + 0.5, 60 + R() * 20, 2.6, 5);
    branch(topPt[0], topPt[1], -Math.PI / 2 + (R() - 0.5) * 0.3, 54, 2.4, 4);
    branch(x - 6, base - h * 0.62, Math.PI + 0.55, 44, 1.6, 3);
  }
  function midLayer3(cg) {
    const items = midGeo2(cg);
    return strip("s06-mid", P_MID3, (ctx, x0, x1) => {
      for (const it of items) {
        if (it.x < x0 - 200 || it.x > x1 + 200) continue;
        if (it.kind === "tree") tree(ctx, it.x, it.seed, it.h);
      }
      for (const it of items) if (it.kind === "lamp" && it.x > x0 - 60 && it.x < x1 + 60) lamp(ctx, it.x, it.seed);
      const RAIL0 = 646, RAIL1 = PARAPET - 4;
      ctx.save();
      ctx.strokeStyle = INK_M;
      ctx.lineCap = "round";
      ctx.lineWidth = 0.9;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (let x = x0, i = 0; x < x1; x += 13, i++) {
        const j = (hash2(i, 1, 61) - 0.5) * 0.8;
        ctx.moveTo(x + j, RAIL1);
        ctx.lineTo(x - j, RAIL0 - 4);
      }
      ctx.stroke();
      ctx.fillStyle = INK_M;
      for (let x = x0; x < x1; x += 13) {
        ctx.beginPath();
        ctx.moveTo(x - 2.4, RAIL0 - 3);
        ctx.lineTo(x, RAIL0 - 10);
        ctx.lineTo(x + 2.4, RAIL0 - 3);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      pen2(ctx, [[x0, RAIL0 + 6], [x1, RAIL0 + 6]], { w: 1.2, color: INK_M, seed: 62, step: 30 });
      pen2(ctx, [[x0, RAIL1 - 8], [x1, RAIL1 - 8]], { w: 1.2, color: INK_M, seed: 63, step: 30 });
      for (let x = x0 + 40; x < x1; x += 156) {
        pen2(ctx, rectPts(x - 5, RAIL0 - 2, 10, RAIL1 - RAIL0 + 2), { w: 1.1, color: INK_M, fill: PAPER4, seed: Math.floor(x), wob: 0.2, close: true });
        pen2(ctx, ellPts(x, RAIL0 - 9, 6.5, 6.5, 12), { w: 1.1, color: INK_M, fill: PAPER4, seed: Math.floor(x) + 1, wob: 0.2, close: true });
      }
      const wall = rectPts(x0, PARAPET, x1 - x0, 40);
      pen2(ctx, wall, { w: 0, fill: PAPER4, wob: 0, close: true });
      pen2(ctx, [[x0, PARAPET], [x1, PARAPET]], { w: 1.3, color: INK_M, seed: 64, step: 26 });
      pen2(ctx, [[x0, PARAPET + 7], [x1, PARAPET + 7]], { w: 1, color: INK_M, seed: 65, step: 26 });
      pen2(ctx, [[x0, PARAPET + 38], [x1, PARAPET + 38]], { w: 1.1, color: INK_M, seed: 66, step: 26 });
      const R = R03("wall");
      for (let x = x0; x < x1; x += 52 + R() * 26) pen2(ctx, [[x, PARAPET + 7], [x + (R() - 0.5) * 2, PARAPET + 22]], { w: 0.8, color: INK_M, alpha: 0.7, wob: 0 });
      for (let x = x0 + 30; x < x1; x += 52 + R() * 26) pen2(ctx, [[x, PARAPET + 22], [x, PARAPET + 38]], { w: 0.8, color: INK_M, alpha: 0.7, wob: 0 });
      pen2(ctx, [[x0, PARAPET + 22], [x1, PARAPET + 22]], { w: 0.7, color: INK_M, alpha: 0.5, seed: 67, step: 30 });
      hatch(ctx, polyPath(rectPts(x0, PARAPET + 24, x1 - x0, 14)), [x0, PARAPET + 24, x1 - x0, 14], { angle: 0.05, gap: 3.6, color: INK_M, w: 0.7, alpha: 0.4, seed: 68, breaks: 0.5 });
    }, { y0: 290, y1: 732 });
  }
  var ROWS = [736, 747, 760, 776, 797, 822, 853, 892, 940, 998];
  function groundLayer2() {
    return strip("s06-ground", 1, (ctx, x0, x1) => {
      ctx.fillStyle = PAPER4;
      ctx.fillRect(x0, 726, x1 - x0, 274);
      const R = R03("ground");
      ROWS.forEach((y, i) => {
        const t = i / (ROWS.length - 1);
        const gapH = i ? y - ROWS[i - 1] : 10;
        const alpha = lerp(0.35, 0.8, t);
        let x = x0 - R() * 60;
        while (x < x1) {
          const L = 60 + R() * 220 * (1 + t);
          if (R() < 0.82) pen2(ctx, [[x, y + (R() - 0.5) * 1.5], [x + L, y + (R() - 0.5) * 1.5]], { w: lerp(0.8, 1.25, t), alpha, seed: Math.floor(x + y), wob: 0.5, step: 20 });
          x += L + 10 + R() * 40 * (1 + t);
        }
        const sp = gapH * 2.6 + 14;
        for (let xx = x0 + i % 2 * sp * 0.5; xx < x1; xx += sp * (0.8 + R() * 0.4)) {
          if (R() < 0.45) continue;
          const lean = (xx - 500) * 6e-4 * gapH;
          pen2(ctx, [[xx, y - gapH + 2], [xx + lean, y - 2]], { w: lerp(0.7, 1, t), alpha: alpha * 0.8, wob: 0 });
        }
        for (let k = 0; k < (x1 - x0) / 140; k++) {
          const px = x0 + R() * (x1 - x0), py = y - R() * gapH;
          ctx.fillStyle = INK5;
          ctx.globalAlpha = alpha * 0.7;
          ctx.beginPath();
          ctx.arc(px, py, 0.8 + R() * 0.7, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });
    }, { y0: 722, y1: 1e3 });
  }
  var CASE_T = 522;
  var CASE_B = 612;
  var LID_EDGE = [[100, 507], [170, 486], [240, 476], [310, 452], [380, 440], [450, 410], [520, 392], [572, 362], [604, 350]];
  var LID_PTS = spline(LID_EDGE, 10);
  function lidY(x) {
    for (let i = 1; i < LID_PTS.length; i++) {
      const [ax, ay] = LID_PTS[i - 1], [bx, by] = LID_PTS[i];
      if (x <= bx) return lerp(ay, by, clamp((x - ax) / (bx - ax || 1)));
    }
    return LID_PTS[LID_PTS.length - 1][1];
  }
  var CROWS = Array.from({ length: N_CROW }, (_, i) => ({
    rx: 136 + i * 72,
    s: [1.08, 1.2, 1.02, 1.24, 1.06, 1.16, 1.22][i],
    crouch: [0.25, 0, 0.55, 0, 0.35, 0.1, 0][i],
    neck: [0, 4, 0, 7, 0, 2, 5][i],
    land: LAND0 + i * LAND_STEP
  }));
  function pianoImage() {
    const BX0 = -150, BX1 = 650, BY0 = 300, BY1 = 830;
    const canvas = baked("s06-piano", (BX1 - BX0) * K, (BY1 - BY0) * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-BX0, -BY0);
      const shadow = polyPath([[-120, 808], [-60, 796], [604, 792], [640, 800], [560, 816], [-90, 818]]);
      hatch(ctx, shadow, [-130, 790, 780, 30], { angle: 0.02, gap: 3.2, w: 0.9, alpha: 0.55, seed: 601, breaks: 0.4 });
      const bench2 = [[-112, 676], [-30, 676], [-28, 690], [-114, 690]];
      for (const lx of [-98, -40]) pen2(ctx, [[lx, 690], [lx + 2, 788], [lx + 7, 788], [lx + 6, 690]], { w: 1, color: INK_M, fill: PAPER4, seed: 610 + lx, close: true, wob: 0.2 });
      for (const lx of [-106, -32]) pen2(ctx, [[lx, 690], [lx - 1, 794], [lx + 6, 794], [lx + 7, 690]], { w: 1.2, fill: PAPER4, seed: 620 + lx, close: true, wob: 0.2 });
      pen2(ctx, [[-104, 760], [-26, 760]], { w: 1, seed: 630, wob: 0.2 });
      pen2(ctx, bench2, { w: 1.4, fill: PAPER4, seed: 631, close: true, wob: 0.3 });
      hatch(ctx, polyPath(bench2), [-115, 676, 90, 14], { angle: 0.75, gap: 3, w: 0.8, alpha: 0.8, seed: 632 });
      pen2(ctx, [[-110, 678], [-32, 678]], { w: 2, color: "#ffffff", alpha: 0.9, wob: 0.2 });
      pen2(ctx, [[92, CASE_B], [106, CASE_B], [102, 778], [95, 778]], { w: 1, color: INK_M, fill: PAPER4, seed: 640, close: true, wob: 0.2 });
      const tail = spline([[604, 350], [618, 372], [622, 440], [614, CASE_T]], 6);
      const lid = [[96, CASE_T], [100, 507], ...LID_PTS.slice(1), ...tail.slice(1)];
      pen2(ctx, lid, { w: 0, fill: "#fefefc", wob: 0, close: true });
      const lidP = polyPath(lid);
      ctx.save();
      ctx.clip(lidP);
      const sh = new Path2D();
      sh.moveTo(96, CASE_T);
      for (let x = 100; x <= 620; x += 20) sh.lineTo(x, lerp(CASE_T, lidY(Math.min(604, x)), 0.42));
      sh.lineTo(620, CASE_T);
      sh.closePath();
      hatch(ctx, sh, [96, 380, 530, 150], { angle: -0.62, gap: 5.5, w: 0.85, alpha: 0.55, seed: 650, breaks: 0.25 });
      ctx.restore();
      pen2(ctx, LID_PTS.map(([x, y]) => [x + 1, y + 7]).filter(([x]) => x < 600), { w: 0.9, alpha: 0.7, seed: 652 });
      pen2(ctx, lid, { w: 1.6, seed: 651, close: true, wob: 0.35 });
      const stickTop = [334, lidY(334) + 3];
      pen2(ctx, [[312, CASE_T - 1], stickTop], { w: 2.2, seed: 660, wob: 0.15 });
      pen2(ctx, [[317, CASE_T - 1], [stickTop[0] + 4, stickTop[1] + 1]], { w: 0.8, alpha: 0.6, seed: 661, wob: 0.15 });
      const desk = [[58, CASE_T], [70, CASE_T], [104, 446], [93, 442]];
      pen2(ctx, desk, { w: 1.3, fill: PAPER4, seed: 670, close: true, wob: 0.2 });
      hatch(ctx, polyPath(desk), [58, 440, 48, 84], { angle: -1.2, gap: 3, w: 0.7, alpha: 0.7, seed: 671 });
      const caseOutline = [[58, CASE_T], [574, CASE_T], ...spline([[574, CASE_T], [606, CASE_T + 10], [618, (CASE_T + CASE_B) / 2], [606, CASE_B - 10], [574, CASE_B]], 6).slice(1), [58, CASE_B]];
      pen2(ctx, caseOutline, { w: 1.7, fill: "#fefefc", seed: 680, close: true, wob: 0.35 });
      ctx.save();
      ctx.clip(polyPath(caseOutline));
      hatch(ctx, polyPath([[56, CASE_T + 48], [640, CASE_T + 48], [640, CASE_B + 2], [56, CASE_B + 2]]), [56, CASE_T + 46, 584, 50], { angle: 1.5, gap: 4.2, w: 0.85, alpha: 0.7, seed: 681, breaks: 0.3 });
      hatch(ctx, polyPath([[56, CASE_B - 14], [640, CASE_B - 14], [640, CASE_B + 2], [56, CASE_B + 2]]), [56, CASE_B - 16, 584, 20], { angle: 0.06, gap: 3.2, w: 0.8, alpha: 0.6, seed: 682 });
      ctx.restore();
      pen2(ctx, [[60, CASE_T + 8], [586, CASE_T + 8]], { w: 0.9, alpha: 0.75, seed: 683, step: 24 });
      pen2(ctx, [[60, CASE_B - 7], [592, CASE_B - 7]], { w: 0.9, alpha: 0.75, seed: 684, step: 24 });
      const cheek = [[0, 530], [58, 530], [58, 568], [4, 568]];
      pen2(ctx, cheek, { w: 1.5, fill: "#fefefc", seed: 690, close: true, wob: 0.25 });
      hatch(ctx, polyPath([[2, 552], [58, 552], [58, 568], [4, 568]]), [0, 550, 60, 20], { angle: 1.5, gap: 3, w: 0.8, alpha: 0.75, seed: 691 });
      pen2(ctx, [[2, 530], [10, 516], [58, 516], [58, 530]], { w: 1.3, fill: "#fefefc", seed: 692, close: true, wob: 0.2 });
      for (let k = 0; k < 6; k++) {
        const kx = 14 + k * 7;
        ctx.fillStyle = INK5;
        ctx.fillRect(kx, 524, 3.4, 5);
      }
      pen2(ctx, [[10, 530], [58, 530]], { w: 1, seed: 693, wob: 0.1 });
      for (const [lx, sd] of [[62, 700], [540, 710]]) {
        const leg = [[lx, CASE_B], [lx + 26, CASE_B], [lx + 21, 782], [lx + 5, 782]];
        pen2(ctx, leg, { w: 1.4, fill: "#fefefc", seed: sd, close: true, wob: 0.2 });
        hatch(ctx, polyPath([[lx, CASE_B], [lx + 9, CASE_B], [lx + 10, 782], [lx + 5, 782]]), [lx, CASE_B, 12, 170], { angle: 1.52, gap: 2.8, w: 0.8, alpha: 0.8, seed: sd + 1 });
        pen2(ctx, [[lx - 2, CASE_B + 10], [lx + 28, CASE_B + 10]], { w: 1.2, seed: sd + 2, wob: 0.1 });
        pen2(ctx, ellPts(lx + 13, 789, 8, 8, 14), { w: 1.3, fill: PAPER4, seed: sd + 3, close: true, wob: 0.1 });
        ctx.fillStyle = INK5;
        ctx.beginPath();
        ctx.arc(lx + 13, 789, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      pen2(ctx, spline([[156, CASE_B], [146, 660], [158, 720], [154, 760]], 6), { w: 1.3, seed: 720 });
      pen2(ctx, spline([[188, CASE_B], [198, 660], [186, 720], [190, 760]], 6), { w: 1.3, seed: 721 });
      for (let k = 0; k < 4; k++) pen2(ctx, [[160 + k * 7, CASE_B + 6], [162 + k * 7, 756]], { w: 0.8, alpha: 0.75, seed: 722 + k, wob: 0.15 });
      pen2(ctx, rectPts(142, 756, 62, 14), { w: 1.3, fill: "#fefefc", seed: 730, close: true, wob: 0.15 });
      hatch(ctx, polyPath(rectPts(142, 763, 62, 7)), [142, 762, 62, 9], { angle: 0.04, gap: 2.4, w: 0.7, alpha: 0.8, seed: 731 });
      for (const dy of [0, 4]) pen2(ctx, [[142, 762 + dy], [118, 764 + dy]], { w: 1.8, seed: 732 + dy, wob: 0.1 });
    });
    return { canvas, x0: BX0, y0: BY0, w: BX1 - BX0, h: BY1 - BY0 };
  }
  var CROW_BODY = [[12, -46], [17, -37], [15, -26], [9, -17], [-1, -13], [-11, -12], [-21, -8], [-33, -1], [-36, -7], [-25, -19], [-17, -33], [-7, -45], [2, -51]];
  function crowStand(ctx, x, y, { s = 1, head = 1, crouch = 0, neck = 0, sq = 0, seed = 1, shout = 0 } = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * (1 + 0.1 * crouch + sq * 0.12), s * (1 - 0.14 * crouch - sq * 0.16));
    ctx.strokeStyle = INK5;
    ctx.lineCap = "round";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-3, -14);
    ctx.lineTo(-5, 0);
    ctx.moveTo(-11, 0);
    ctx.lineTo(1, 0);
    ctx.moveTo(5, -15);
    ctx.lineTo(6, 0);
    ctx.moveTo(1, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();
    ctx.fillStyle = INK5;
    tracePath(ctx, wobbly(CROW_BODY, { seed, wob: 0.5, step: 8, close: true }), true);
    ctx.fill();
    const hx = 6 + 3 * head, hy = -57 - neck;
    ctx.beginPath();
    ctx.moveTo(-4, -44);
    ctx.lineTo(hx - 8, hy + 2);
    ctx.lineTo(hx + 8, hy + 2);
    ctx.lineTo(16, -40);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx + 5 * head, hy - 6);
    ctx.quadraticCurveTo(hx + 17 * head, hy - 5, hx + 23 * head, hy + 1);
    ctx.lineTo(hx + 6 * head, hy + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAPER4;
    ctx.beginPath();
    ctx.arc(hx + 4 * head, hy - 3, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER4;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx + 9 * head, hy + 0.5);
    ctx.lineTo(hx + 18 * head, hy + 0.5);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-26, -13);
    ctx.quadraticCurveTo(-16, -30, 2, -40);
    ctx.stroke();
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      ctx.moveTo(-20 + k * 7, -11 - k * 4);
      ctx.lineTo(-14 + k * 7, -19 - k * 4);
    }
    ctx.moveTo(-33, -4);
    ctx.lineTo(-24, -9);
    ctx.stroke();
    if (shout > 0) {
      ctx.strokeStyle = INK5;
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = shout;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (k - 1) * 0.55 - head * 0.35;
        const r0 = 16, r1 = 16 + 10 * shout;
        ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0);
        ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  function crowFly(ctx, x, y, { s = 1, flap = 0, dir = 1, seed = 1 } = {}) {
    const u = Math.cos(flap * Math.PI * 2);
    const wing = (k) => [[10, -5], [6, -5 - 26 * u * k], [-4, -5 - 46 * u * k], [-12, -5 - 56 * u * k], [-17, -5 - 50 * u * k], [-21, -5 - 44 * u * k], [-24, -5 - 36 * u * k], [-12, -3]];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * dir, s);
    ctx.rotate(-0.12);
    ctx.fillStyle = INK5;
    ctx.save();
    ctx.translate(4, -2);
    tracePath(ctx, wing(0.8), true);
    ctx.fill();
    ctx.restore();
    const body = [[-24, -2], [-10, -8], [8, -9], [18, -7], [20, 2], [6, 6], [-12, 5], [-24, 3]];
    tracePath(ctx, wobbly(body, { seed, wob: 0.4, step: 8, close: true }), true);
    ctx.fill();
    tracePath(ctx, [[-22, -3], [-40, -9], [-43, -1], [-40, 7], [-22, 4]], true);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(23, -6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(27, -10);
    ctx.quadraticCurveTo(36, -9, 41, -4);
    ctx.lineTo(28, -2);
    ctx.closePath();
    ctx.fill();
    tracePath(ctx, wing(1), true);
    ctx.fill();
    ctx.fillStyle = PAPER4;
    ctx.beginPath();
    ctx.arc(26, -8, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PAPER4;
    ctx.lineWidth = 1.2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(4, -6 - 18 * u);
    ctx.lineTo(-8, -6 - 36 * u);
    ctx.stroke();
    ctx.restore();
  }
  var bez = (P2, t) => {
    const v = 1 - t;
    return [0, 1].map((j) => v * v * P2[0][j] + 2 * v * t * P2[1][j] + t * t * P2[2][j]);
  };
  function drawCrows(ctx, b, env) {
    const off = env.camAt(GAG) - env.cam;
    const looking = b >= TURN[0] && b < TURN[1];
    CROWS.forEach((c, i) => {
      const fx = PIANO_X + c.rx + off, fy = lidY(c.rx) + 1;
      if (b < c.land - FLY_T) return;
      const seed = 800 + i;
      if (b < c.land) {
        const t = (b - (c.land - FLY_T)) / FLY_T;
        const P2 = [[fx - 250, -90], [fx - 210, fy - 210], [fx, fy - 22]];
        const [x, y] = bez(P2, ease.out(t));
        crowFly(ctx, x, y, { s: c.s, flap: b * 3.4 + i * 0.3, seed });
        return;
      }
      if (i === N_CROW - 1 && b >= TAKEOFF - 0.18) {
        if (b < TAKEOFF) {
          crowStand(ctx, fx, fy, { s: c.s, crouch: 0.9, neck: 0, seed });
          return;
        }
        const t = (b - TAKEOFF) / FLY_OFF;
        if (t > 1) return;
        const P2 = [[fx + 6, fy - 30], [fx + 70, fy - 250], [fx + 520, fy - 560]];
        const [x, y] = bez(P2, ease.in(t) * 0.35 + t * 0.65);
        crowFly(ctx, x, y, { s: c.s * (1 + t * 0.15), flap: (b - TAKEOFF) * 3.8, seed });
        return;
      }
      const since = b - c.land;
      const sq = since < 0.32 ? Math.sin(Math.PI * since / 0.32) : 0;
      const shout = looking ? Math.max(0, 1 - (b - TURN[0]) / 0.45) : 0;
      const jerk = looking && b - TURN[0] < 0.12 ? -2 : 0;
      crowStand(ctx, fx, fy + jerk, { s: c.s, head: looking ? -1 : 1, crouch: c.crouch, neck: c.neck, sq, seed, shout });
    });
  }
  function figureShadow(ctx) {
    ctx.save();
    ctx.strokeStyle = INK5;
    ctx.lineCap = "round";
    for (let k = 0; k < 6; k++) {
      const y = ROAD_Y + 2 + k * 2.6;
      const L = 120 - k * 15;
      ctx.globalAlpha = 0.5 - k * 0.05;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(CHAR_X + 30 - k * 6, y);
      ctx.lineTo(CHAR_X + 30 - L - k * 4, y + 1);
      ctx.stroke();
    }
    ctx.restore();
  }
  function fgLayer2(cg) {
    return strip("s06-fg", P_FG5, (ctx, x0, x1) => {
      const R = R03("fg");
      for (let x = x0 + 60; x < x1; x += 260 + R() * 300) {
        const sx = x - cg * P_FG5;
        if (sx > 150 && sx < 520) continue;
        const y = 978 + R() * 16;
        pen2(ctx, [[x - 60, y + 4], [x - 20, y - 2], [x + 50, y - 1], [x + 80, y + 6]], { w: 1.4, seed: Math.floor(x), wob: 0.5 });
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * 0.22 + (R() - 0.5) * 0.15, L = 18 + R() * 26;
          const bx = x + (k - 3) * 3;
          pen2(ctx, spline([[bx, y], [bx + Math.cos(a) * L * 0.5 + (R() - 0.5) * 4, y + Math.sin(a) * L * 0.5], [bx + Math.cos(a) * L, y + Math.sin(a) * L]], 4), { w: 1.2, seed: Math.floor(x) + k, wob: 0.2 });
        }
        for (let k = 0; k < 4; k++) {
          ctx.fillStyle = INK5;
          ctx.beginPath();
          ctx.arc(x - 40 + R() * 110, y + 6 + R() * 6, 1 + R(), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }, { y0: 930, y1: 1e3 });
  }
  function penRect(ctx, x, y, w, h, o) {
    pen2(ctx, rectPts(x, y, w, h), { ...o, close: true });
  }
  function penCard(ctx, x, y, w, h, seed, staff) {
    ctx.save();
    const sh = new Path2D();
    sh.rect(x + 10, y + h, w, 10);
    sh.rect(x + w, y + 10, 10, h);
    hatch(ctx, sh, [x, y, w + 12, h + 12], { angle: -0.8, gap: 3.4, w: 1, alpha: 0.6, seed });
    ctx.fillStyle = CARD;
    ctx.fillRect(x, y, w, h);
    penRect(ctx, x, y, w, h, { w: 2.6, seed: seed + 1, wob: 0.5, step: 18 });
    penRect(ctx, x + 7, y + 7, w - 14, h - 14, { w: 1.2, seed: seed + 2, wob: 0.4, step: 18 });
    if (staff) {
      const sx0 = x + w - 200, sx1 = x + w - 22, sy = y + h - 33, g = 4.2;
      for (let k = 0; k < 5; k++) pen2(ctx, [[sx0, sy + k * g], [sx1, sy + k * g]], { w: 0.9, alpha: 0.85, seed: seed + 10 + k, wob: 0.25, step: 30 });
      pen2(ctx, [[sx1, sy], [sx1, sy + 4 * g]], { w: 1.4, wob: 0 });
      pen2(ctx, [[sx0, sy], [sx0, sy + 4 * g]], { w: 1, wob: 0 });
      ctx.fillStyle = INK5;
      const notes = [[sx0 + 34, sy + 3 * g], [sx0 + 72, sy + 1.5 * g], [sx0 + 104, sy + 2.5 * g], [sx0 + 142, sy + 1 * g]];
      notes.forEach(([nx, ny], k) => {
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(-0.4);
        ctx.beginPath();
        ctx.ellipse(0, 0, 3.9, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = INK5;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(nx + 4, ny - 1);
        ctx.lineTo(nx + 4, ny - 15);
        ctx.stroke();
        if (k === 1) {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(nx + 4, ny - 15);
          ctx.lineTo(notes[2][0] + 4, notes[2][1] - 15);
          ctx.stroke();
        }
        if (k === 3) {
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(nx + 4, ny - 15);
          ctx.quadraticCurveTo(nx + 12, ny - 10, nx + 10, ny - 4);
          ctx.stroke();
        }
      });
    }
    ctx.restore();
  }
  function penCD(ctx, cx, cy, s, spin) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    const sh = new Path2D();
    sh.arc(7, 8, r, 0, Math.PI * 2);
    sh.arc(0, 0, r, 0, Math.PI * 2);
    hatch(ctx, sh, [-r, -r, 2 * r + 10, 2 * r + 10], { angle: -0.8, gap: 3.2, w: 1, alpha: 0.6, seed: 900 });
    ctx.fillStyle = CARD;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(spin);
    const wedge = new Path2D();
    wedge.moveTo(0, 0);
    wedge.arc(0, 0, r * 0.95, -0.42, 0.42);
    wedge.closePath();
    const ring = new Path2D();
    ring.arc(0, 0, r * 0.95, 0, Math.PI * 2);
    ring.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.save();
    ctx.clip(ring, "evenodd");
    hatch(ctx, wedge, [-r, -r, 2 * r, 2 * r], { angle: 0.3, gap: 3, w: 1, alpha: 0.85, seed: 901, wob: 0.3 });
    ctx.restore();
    ctx.strokeStyle = INK5;
    ctx.lineCap = "round";
    for (const [rr, a0, a1, w] of [[0.84, 2.3, 3.3, 1.2], [0.74, 2.5, 3.1, 1], [0.84, 4.6, 5.2, 1], [0.55, 3.9, 4.9, 0.9]]) {
      ctx.lineWidth = w * s;
      ctx.beginPath();
      ctx.arc(0, 0, r * rr, a0, a1);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * (0.4 + k * 0.045), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    pen2(ctx, ellPts(0, 0, r, r, 60), { w: 2.6 * s, seed: 902, wob: 0.4, close: true });
    pen2(ctx, ellPts(0, 0, r * 0.27, r * 0.27, 24), { w: 1.6 * s, seed: 903, wob: 0.3, close: true, fill: CARD });
    const hole = ellPts(0, 0, r * 0.1, r * 0.1, 16);
    pen2(ctx, hole, { w: 1.3 * s, seed: 904, wob: 0.2, close: true, fill: "#ffffff" });
    hatch(ctx, polyPath(hole), [-r * 0.1, -r * 0.1, r * 0.2, r * 0.2], { angle: 0.8, gap: 2.2, w: 0.9, alpha: 0.8, seed: 905 });
    ctx.restore();
  }
  function penFrame(ctx, R) {
    const s = R.s, t = 46 * s, { x, y, w, h } = R;
    ctx.save();
    const band = new Path2D();
    band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
    band.rect(x, y, w, h);
    ctx.fillStyle = PAPER4;
    ctx.fill(band, "evenodd");
    const shade2 = new Path2D();
    shade2.moveTo(x + w + t, y - t);
    shade2.lineTo(x + w + t, y + h + t);
    shade2.lineTo(x - t, y + h + t);
    shade2.lineTo(x, y + h);
    shade2.lineTo(x + w, y + h);
    shade2.lineTo(x + w, y);
    shade2.closePath();
    hatch(ctx, shade2, [x - t, y - t, w + 2 * t, h + 2 * t], { angle: -0.8, gap: Math.max(2.5, 5 * s), w: Math.max(0.7, 1.1 * s), alpha: 0.55, seed: 950, wob: 0.6 * s, breaks: 0 });
    const o = { seed: 951, wob: 0.8 * s, step: 40 * s, color: INK5 };
    penRect(ctx, x - t, y - t, w + 2 * t, h + 2 * t, { ...o, w: Math.max(1.2, 2.6 * s) });
    penRect(ctx, x - t * 0.62, y - t * 0.62, w + t * 1.24, h + t * 1.24, { ...o, seed: 952, w: Math.max(0.8, 1.1 * s) });
    penRect(ctx, x - t * 0.5, y - t * 0.5, w + t, h + t, { ...o, seed: 953, w: Math.max(0.6, 0.8 * s), alpha: 0.7 });
    penRect(ctx, x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s, { ...o, seed: 954, w: Math.max(1.2, 2.4 * s) });
    for (const [cx, cy, sx, sy] of [[x - t * 0.26, y - t * 0.26, 1, 1], [x + w + t * 0.26, y - t * 0.26, -1, 1], [x - t * 0.26, y + h + t * 0.26, 1, -1], [x + w + t * 0.26, y + h + t * 0.26, -1, -1]]) {
      const q = [];
      for (let k = 0; k <= 16; k++) {
        const a = k * 0.45, rr = t * 0.2 * (1 - k / 22);
        q.push([cx + sx * Math.cos(a) * rr, cy + sy * Math.sin(a) * rr]);
      }
      pen2(ctx, q, { w: Math.max(0.8, 1.3 * s), seed: 960, wob: 0 });
    }
    ctx.restore();
  }
  var s06 = {
    id: "s06",
    station: ST6,
    figureStyle: "pen",
    freezeBeat: GAG + 1.5,
    // Outro 展墙：乌鸦正扭头看他
    drawBack(ctx, b, env) {
      const cam = env.cam, cg = env.camAt(GAG);
      const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1e3 * K);
      ctx.drawImage(paperTexture(pw, ph, { base: PAPER4, seed: 66, amount: 0.45, fibers: 90 }), X_MIN, 0, X_MAX - X_MIN, 1e3);
      drawStrip(ctx, skyLayer3(cg), cam);
      drawTwinkles(ctx, b, cam);
      drawStrip(ctx, farLayer4(), cam);
      drawStrip(ctx, midLayer3(cg), cam);
      drawStrip(ctx, groundLayer2(), cam);
      const P2 = pianoImage();
      const px = PIANO_X + cg - cam;
      if (px + P2.x0 < X_MAX && px + P2.x0 + P2.w > X_MIN) ctx.drawImage(P2.canvas, px + P2.x0, P2.y0, P2.w, P2.h);
      figureShadow(ctx);
      drawCrows(ctx, b, env);
    },
    drawFront(ctx, b, env) {
      drawStrip(ctx, fgLayer2(env.camAt(GAG)), env.cam);
    },
    drawFrame(ctx, R) {
      penFrame(ctx, R);
    },
    cardStyle: {
      ink: INK5,
      accent: INK_M,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        penCard(ctx, x, y, w, h, 101, true);
      }
    },
    playerStyle: {
      ink: INK5,
      noteColor: INK5,
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        penCard(ctx, x, y, w, h, 111, false);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        penCD(ctx, cx, cy, s, spin);
      }
    }
  };

  // src/scenes/s07.js
  var ST7 = stationByN(7);
  var PAPER5 = "#efe3c4";
  var PAPER_HI = "#f7efdc";
  var INK6 = "#5a3a22";
  var INK_M2 = "#7a5a3c";
  var INK_L2 = "#9a7a58";
  var INK_F = "#b59d79";
  var FOG = "#f4ecd9";
  var GAS = "#f4c65a";
  var GLOW = "#f8dc8c";
  var LIT = "#f3d68c";
  var FACADE = mix(PAPER5, "#d9c49a", 0.45);
  var ROOF = mix(PAPER5, "#b89c74", 0.5);
  var P_SKY3 = 0.05;
  var P_FAR6 = 0.25;
  var P_MIST_A = 0.4;
  var P_MID4 = 0.6;
  var P_MIST_B = 0.8;
  var BASE2 = 778;
  var LAMP_Y = ROAD_Y - 3;
  var LAMP_GAG_X = 470;
  var LAMP_GAP = 820;
  function engrave(ctx, path, { bounds, angle = 0, gap = 6, color = INK6, width = () => 1, wobble = 0.8, step = 8, seed = 1, alpha = 1 }) {
    const [bx, by, bw, bh] = bounds;
    const c = Math.cos(angle), s = Math.sin(angle);
    let t0 = Infinity, t1 = -Infinity, d0 = Infinity, d1 = -Infinity;
    for (const [x, y] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) {
      const t = x * c + y * s, d = -x * s + y * c;
      t0 = Math.min(t0, t);
      t1 = Math.max(t1, t);
      d0 = Math.min(d0, d);
      d1 = Math.max(d1, d);
    }
    ctx.save();
    if (path) ctx.clip(path);
    ctx.strokeStyle = color;
    ctx.globalAlpha *= alpha;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dStart = Math.floor(d0 / gap) * gap;
    for (let d = dStart; d <= d1 + gap; d += gap) {
      let prev = null, curW = -1, open = false;
      for (let t = t0 - step; t <= t1 + step; t += step) {
        const dd = d + (noise2(t * 0.01, d * 0.05, seed) - 0.5) * 2 * wobble;
        const x = c * t - s * dd, y = s * t + c * dd;
        if (prev) {
          let w = width((x + prev[0]) / 2, (y + prev[1]) / 2);
          w = Math.round(w * 8) / 8;
          if (w <= 0.05) {
            if (open) {
              ctx.stroke();
              open = false;
            }
            curW = -1;
          } else {
            if (w !== curW) {
              if (open) ctx.stroke();
              ctx.beginPath();
              ctx.lineWidth = w;
              curW = w;
              ctx.moveTo(prev[0], prev[1]);
              open = true;
            }
            ctx.lineTo(x, y);
          }
        }
        prev = [x, y];
      }
      if (open) ctx.stroke();
    }
    ctx.restore();
  }
  var rectPath = (x, y, w, h) => {
    const p = new Path2D();
    p.rect(x, y, w, h);
    return p;
  };
  function line(ctx, x0, y0, x1, y1, w = 1, color = INK6) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  function tile(kind, color = INK6, lw = 1.1, gap = 4, size = 32) {
    return memo(`s07-tile|${kind}|${color}|${lw}|${gap}|${size}`, () => {
      const c = makeCanvas(size, size);
      const g = c.getContext("2d");
      g.strokeStyle = color;
      g.lineWidth = lw;
      g.lineCap = "square";
      const diag = (sgn) => {
        for (let k = -size; k <= 2 * size; k += gap) {
          g.beginPath();
          g.moveTo(k, sgn > 0 ? 0 : size);
          g.lineTo(k + size, sgn > 0 ? size : 0);
          g.stroke();
        }
      };
      if (kind === "diag" || kind === "cross") diag(1);
      if (kind === "cross") diag(-1);
      if (kind === "check") {
        for (let k = 0; k < size; k += gap) {
          g.beginPath();
          g.moveTo(k + 0.5, 0);
          g.lineTo(k + 0.5, size);
          g.stroke();
          g.beginPath();
          g.moveTo(0, k + 0.5);
          g.lineTo(size, k + 0.5);
          g.stroke();
        }
        g.lineWidth = lw * 2.2;
        for (let k = 0; k < size; k += gap * 4) {
          g.beginPath();
          g.moveTo(k + 1, 0);
          g.lineTo(k + 1, size);
          g.stroke();
          g.beginPath();
          g.moveTo(0, k + 1);
          g.lineTo(size, k + 1);
          g.stroke();
        }
      }
      if (kind === "vert") for (let k = 0; k < size; k += gap) {
        g.beginPath();
        g.moveTo(k + 0.5, 0);
        g.lineTo(k + 0.5, size);
        g.stroke();
      }
      return c;
    });
  }
  function fillEngraved(ctx, path, base, kind, o = {}) {
    ctx.fillStyle = base;
    ctx.fill(path);
    ctx.fillStyle = ctx.createPattern(tile(kind, o.color || INK6, o.lw || 1.1, o.gap || 4), "repeat");
    ctx.fill(path);
  }
  var MOON2 = [1010, 150, 50];
  function skyLayer4() {
    return strip("s07-sky", P_SKY3, (ctx, x0, x1) => {
      const H2 = 470;
      engrave(ctx, rectPath(x0, 0, x1 - x0, H2), {
        bounds: [x0, 0, x1 - x0, H2],
        angle: 0,
        gap: 5.2,
        color: INK_L2,
        wobble: 0.6,
        step: 7,
        seed: 11,
        width: (x, y) => {
          const fade2 = 1 - smoothstep(30, 400, y);
          const d = Math.hypot(x - MOON2[0], y - MOON2[1]);
          const halo = smoothstep(MOON2[2] + 8, MOON2[2] + 120, d);
          return 1.35 * fade2 * halo * (0.65 + 0.7 * noise2(x * 4e-3, y * 0.03, 3));
        }
      });
      const [mx, my, mr] = MOON2;
      ctx.strokeStyle = INK_L2;
      ctx.lineWidth = 1.2;
      circle(ctx, mx, my, mr);
      ctx.stroke();
      const moon = new Path2D();
      moon.arc(mx, my, mr, 0, TAU);
      engrave(ctx, moon, {
        bounds: [mx - mr, my - mr, 2 * mr, 2 * mr],
        angle: 1.2,
        gap: 3.6,
        color: INK_F,
        wobble: 0.4,
        step: 4,
        seed: 5,
        width: (x, y) => 0.9 * smoothstep(mx + mr * 0.05, mx + mr * 0.9, x + (y - my) * 0.3)
      });
      for (const [cx, cy, r] of [[mx - 14, my - 10, 8], [mx + 8, my + 16, 6], [mx - 20, my + 22, 4]]) {
        ctx.lineWidth = 0.8;
        circle(ctx, cx, cy, r);
        ctx.stroke();
      }
    }, { y0: 0, y1: 480 });
  }
  function chimneys(p, x, w, top, R, scale = 1) {
    const n = 1 + Math.floor(R() * 2.4);
    const pots = [];
    for (let i = 0; i < n; i++) {
      const cw = (16 + R() * 18) * scale, chh = (24 + R() * 36) * scale;
      const cx = x + 10 + R() * Math.max(10, w - 20 - cw);
      p.rect(cx, top - chh, cw, chh + 2);
      p.rect(cx - 3 * scale, top - chh - 5 * scale, cw + 6 * scale, 5 * scale);
      const k = 1 + Math.floor(R() * 3);
      for (let j = 0; j < k; j++) {
        const px = cx + (j + 0.5) * (cw / k) - 2.5 * scale;
        p.rect(px, top - chh - 13 * scale, 5 * scale, 9 * scale);
        pots.push(px);
      }
    }
    return pots;
  }
  function farLayer5() {
    return strip("s07-far", P_FAR6, (ctx, x0, x1) => {
      const R = rng("s07-far");
      const fill = mix(PAPER5, "#cbb189", 0.32);
      const items = [];
      let x = x0 - 60;
      while (x < x1 + 60) {
        const r = R();
        const p = new Path2D();
        if (r < 0.06) {
          const w = 60;
          p.rect(x, 250, w, 560);
          p.rect(x - 9, 192, w + 18, 64);
          p.moveTo(x - 12, 194);
          p.lineTo(x + w / 2, 96);
          p.lineTo(x + w + 12, 194);
          p.closePath();
          p.rect(x + w / 2 - 1.5, 76, 3, 22);
          items.push({ p, b: [x - 12, 76, w + 24, 730], clock: [x + w / 2, 224, 20] });
          x += w + 40 + R() * 60;
        } else if (r < 0.11) {
          const w = 170, tw = 46, tx = x + 20;
          p.rect(x, 440, w, 370);
          p.moveTo(x - 6, 442);
          p.lineTo(x + w / 2 + 20, 380);
          p.lineTo(x + w + 6, 442);
          p.closePath();
          p.rect(tx, 300, tw, 500);
          p.moveTo(tx - 4, 302);
          p.lineTo(tx + tw / 2, 132);
          p.lineTo(tx + tw + 4, 302);
          p.closePath();
          items.push({ p, b: [x - 6, 132, w + 12, 680], arch: [tx + tw / 2, 330] });
          x += w + 20 + R() * 40;
        } else {
          const w = 90 + R() * 150, top = 370 + R() * 120;
          p.rect(x, top, w, 810 - top);
          const roof2 = R();
          let peak2 = top;
          if (roof2 < 0.35) {
            p.moveTo(x - 4, top + 1);
            p.lineTo(x + w / 2, top - 46);
            p.lineTo(x + w + 4, top + 1);
            p.closePath();
            peak2 = top - 46;
          } else if (roof2 < 0.6) {
            p.moveTo(x + 2, top + 1);
            p.lineTo(x + 14, top - 30);
            p.lineTo(x + w - 14, top - 30);
            p.lineTo(x + w - 2, top + 1);
            p.closePath();
            peak2 = top - 30;
          }
          chimneys(p, x, w, peak2 + (roof2 < 0.35 ? 18 : 0), R, 0.9);
          items.push({ p, b: [x - 6, peak2 - 90, w + 12, 900 - peak2], win: R() < 0.75 ? [x, top, w] : null, seed: Math.floor(R() * 1e3) });
          x += w + (R() < 0.25 ? 14 + R() * 50 : 0);
        }
      }
      items.forEach((it, i) => {
        ctx.fillStyle = fill;
        ctx.fill(it.p);
        engrave(ctx, it.p, {
          bounds: it.b,
          angle: Math.PI / 2,
          gap: 4.4,
          color: INK_F,
          wobble: 0.5,
          step: 10,
          seed: 20 + i,
          width: (xx, yy) => 1.1 * (1 - smoothstep(470, 770, yy))
        });
        ctx.strokeStyle = INK_F;
        ctx.lineWidth = 1.1;
        ctx.stroke(it.p);
        if (it.clock) {
          const [cx, cy, cr] = it.clock;
          ctx.fillStyle = PAPER_HI;
          circle(ctx, cx, cy, cr);
          ctx.fill();
          ctx.stroke();
          for (let k = 0; k < 12; k++) {
            const a = k / 12 * TAU;
            line(ctx, cx + Math.cos(a) * cr * 0.72, cy + Math.sin(a) * cr * 0.72, cx + Math.cos(a) * cr * 0.92, cy + Math.sin(a) * cr * 0.92, 1, INK_F);
          }
          line(ctx, cx, cy, cx + 3, cy - cr * 0.6, 1.4, INK_F);
          line(ctx, cx, cy, cx + cr * 0.45, cy + 3, 1.4, INK_F);
        }
        if (it.arch) {
          ctx.fillStyle = LIT;
          const [ax, ay] = it.arch;
          ctx.fillRect(ax - 6, ay, 12, 22);
          ctx.strokeRect(ax - 6, ay, 12, 22);
        }
        if (it.win) {
          const [wx, top, w] = it.win;
          const W2 = rng("s07-farwin", it.seed);
          for (let yy = top + 22; yy < 640; yy += 42) for (let xx = wx + 14; xx < wx + w - 16; xx += 26) {
            if (W2() < 0.22) {
              ctx.fillStyle = LIT;
              ctx.fillRect(xx, yy, 8, 13);
            } else if (W2() < 0.6) {
              ctx.strokeStyle = INK_F;
              ctx.lineWidth = 0.8;
              ctx.strokeRect(xx, yy, 8, 13);
            }
          }
        }
      });
      ctx.globalCompositeOperation = "source-atop";
      const g = ctx.createLinearGradient(0, 300, 0, 760);
      g.addColorStop(0, rgba(FOG, 0.05));
      g.addColorStop(0.55, rgba(FOG, 0.3));
      g.addColorStop(1, rgba(FOG, 0.92));
      ctx.fillStyle = g;
      ctx.fillRect(x0, 60, x1 - x0, 760);
      ctx.globalCompositeOperation = "source-over";
    }, { y0: 60, y1: 810 });
  }
  function sash(ctx, cx, wy, ww, wh, lit, seed, hood) {
    const x = cx - ww / 2;
    ctx.fillStyle = PAPER_HI;
    ctx.fillRect(x - 6, wy - 6, ww + 12, wh + 12);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 6, wy - 6, ww + 12, wh + 12);
    const glass = rectPath(x, wy, ww, wh);
    if (lit) {
      ctx.fillStyle = LIT;
      ctx.fill(glass);
      engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: Math.PI / 2, gap: 3.6, color: "#c79a52", width: () => 0.6, wobble: 0.2, step: 6, seed });
    } else {
      ctx.fillStyle = mix(PAPER5, INK6, 0.18);
      ctx.fill(glass);
      engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: 0.75, gap: 3.2, color: INK6, width: () => 0.85, wobble: 0.3, step: 5, seed });
      engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: -0.75, gap: 3.8, color: INK6, width: (xx, yy) => 0.7 * smoothstep(wy + wh * 0.2, wy + wh, yy + (xx - x) * 0.4), wobble: 0.3, step: 5, seed: seed + 1 });
    }
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(x, wy, ww, wh);
    line(ctx, x, wy + wh / 2, x + ww, wy + wh / 2, 1.6);
    line(ctx, cx, wy, cx, wy + wh, 0.9);
    line(ctx, x + 1, wy + 2, x + ww - 1, wy + 2, 2.4, rgba(INK6, 0.7));
    line(ctx, x + 2, wy + 1, x + 2, wy + wh - 1, 2, rgba(INK6, 0.5));
    ctx.fillStyle = PAPER_HI;
    ctx.fillRect(x - 9, wy + wh + 6, ww + 18, 6);
    ctx.strokeRect(x - 9, wy + wh + 6, ww + 18, 6);
    line(ctx, x - 7, wy + wh + 14, x + ww + 7, wy + wh + 14, 0.8, INK_L2);
    if (hood === "ped") {
      const p = new Path2D();
      p.moveTo(x - 12, wy - 8);
      p.lineTo(cx, wy - 28);
      p.lineTo(x + ww + 12, wy - 8);
      p.closePath();
      ctx.fillStyle = PAPER_HI;
      ctx.fill(p);
      ctx.lineWidth = 1.1;
      ctx.stroke(p);
      engrave(ctx, p, { bounds: [x - 12, wy - 28, ww + 24, 20], angle: 0, gap: 3, color: INK6, width: (xx, yy) => yy > wy - 12 ? 0.7 : 0, wobble: 0.2, step: 5, seed });
    } else {
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, wy - 4, ww / 2 + 8, Math.PI, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, wy - 4, ww / 2 + 3, Math.PI, 0);
      ctx.stroke();
      ctx.fillStyle = PAPER_HI;
      ctx.fillRect(cx - 4, wy - ww / 2 - 13, 8, 10);
      ctx.strokeRect(cx - 4, wy - ww / 2 - 13, 8, 10);
    }
  }
  function railings(ctx, xa, xb) {
    const top = BASE2 - 46;
    line(ctx, xa, top, xb, top, 2);
    line(ctx, xa, top + 6, xb, top + 6, 1);
    line(ctx, xa, BASE2 - 8, xb, BASE2 - 8, 1.6);
    for (let x = xa + 4; x < xb - 2; x += 10) {
      line(ctx, x, top - 4, x, BASE2, 1.3);
      ctx.fillStyle = INK6;
      ctx.beginPath();
      ctx.moveTo(x - 2.6, top - 4);
      ctx.lineTo(x, top - 11);
      ctx.lineTo(x + 2.6, top - 4);
      ctx.closePath();
      ctx.fill();
    }
  }
  function townhouse(ctx, x, w, top, R, seed) {
    const H2 = BASE2 - top;
    const facade = rectPath(x, top, w, H2);
    ctx.fillStyle = FACADE;
    ctx.fill(facade);
    engrave(ctx, facade, { bounds: [x, top, w, H2], angle: 0, gap: 7.5, color: INK_L2, width: () => 0.5, wobble: 0.3, step: 12, seed });
    const pil = rectPath(x + w - 18, top, 18, H2);
    ctx.fillStyle = mix(FACADE, INK6, 0.12);
    ctx.fill(pil);
    engrave(ctx, pil, { bounds: [x + w - 18, top, 18, H2], angle: 1.05, gap: 3.2, color: INK6, width: () => 0.8, wobble: 0.3, step: 6, seed: seed + 2 });
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.2;
    ctx.stroke(facade);
    ctx.stroke(pil);
    const roof2 = new Path2D();
    roof2.moveTo(x + 2, top - 14);
    roof2.lineTo(x + 24, top - 86);
    roof2.lineTo(x + w - 24, top - 86);
    roof2.lineTo(x + w - 2, top - 14);
    roof2.closePath();
    ctx.fillStyle = ROOF;
    ctx.fill(roof2);
    engrave(ctx, roof2, { bounds: [x, top - 90, w, 80], angle: 0, gap: 9, color: INK6, width: () => 0.9, wobble: 0.3, step: 8, seed: seed + 3 });
    engrave(ctx, roof2, { bounds: [x, top - 90, w, 80], angle: 1.3, gap: 3.6, color: INK6, width: () => 0.6, wobble: 0.3, step: 6, seed: seed + 4 });
    ctx.lineWidth = 1.3;
    ctx.stroke(roof2);
    const stack = new Path2D();
    chimneys(stack, x + w * 0.1, w * 0.8, top - 84, R, 1.15);
    ctx.fillStyle = FACADE;
    ctx.fill(stack);
    engrave(ctx, stack, { bounds: [x, top - 200, w, 120], angle: 0, gap: 6, color: INK6, width: () => 0.7, wobble: 0.2, step: 8, seed: seed + 5 });
    engrave(ctx, stack, { bounds: [x, top - 200, w, 120], angle: 1.1, gap: 3.5, color: INK6, width: (xx) => 0.8 * smoothstep(0.4, 0.9, (xx - x) % 40 / 40), wobble: 0.3, step: 5, seed: seed + 6 });
    ctx.lineWidth = 1.2;
    ctx.stroke(stack);
    const nd = w > 280 ? 2 : 1;
    for (let i = 0; i < nd; i++) {
      const dx = x + w * ((i + 1) / (nd + 1)) - 16;
      const d = new Path2D();
      d.rect(dx, top - 72, 32, 44);
      d.moveTo(dx - 5, top - 72);
      d.lineTo(dx + 16, top - 92);
      d.lineTo(dx + 37, top - 72);
      d.closePath();
      ctx.fillStyle = FACADE;
      ctx.fill(d);
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.1;
      ctx.stroke(d);
      sashSmall(ctx, dx + 7, top - 66, 18, 30, R() < 0.3, seed + 7 + i);
    }
    ctx.fillStyle = PAPER_HI;
    ctx.fillRect(x - 6, top - 16, w + 12, 16);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.3;
    ctx.strokeRect(x - 6, top - 16, w + 12, 16);
    for (let dx = x; dx < x + w; dx += 9) {
      ctx.fillStyle = INK6;
      ctx.fillRect(dx, top, 4, 6);
    }
    line(ctx, x - 6, top + 8, x + w + 6, top + 8, 0.8);
    const n = w > 290 ? 3 : 2;
    const floorsY = [top + 46, top + 196];
    floorsY.forEach((wy, f) => {
      if (wy + 110 > BASE2 - 190) return;
      for (let i = 0; i < n; i++) {
        const cx = x + (w - 18) * ((i + 0.5) / n);
        sash(ctx, cx, wy, 42, f === 0 ? 96 : 84, R() < 0.3, seed + 10 + f * 5 + i, f === 0 ? "ped" : "arch");
      }
      line(ctx, x, wy + (f === 0 ? 132 : 120), x + w, wy + (f === 0 ? 132 : 120), 1, INK6);
    });
    const doorLeft = R() < 0.5;
    const dcx = doorLeft ? x + 52 : x + w - 70;
    const dTop = BASE2 - 44 - 128, dw = 52;
    const door = rectPath(dcx - dw / 2, dTop, dw, 128);
    ctx.fillStyle = mix(PAPER5, INK6, 0.4);
    ctx.fill(door);
    engrave(ctx, door, { bounds: [dcx - dw / 2, dTop, dw, 128], angle: Math.PI / 2, gap: 2.8, color: INK6, width: () => 0.9, wobble: 0.2, step: 6, seed: seed + 20 });
    ctx.strokeStyle = PAPER_HI;
    ctx.lineWidth = 1.1;
    for (const [px, py] of [[-18, 12], [3, 12], [-18, 66], [3, 66]]) ctx.strokeRect(dcx + px, dTop + py, 15, 46);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ctx.stroke(door);
    ctx.fillStyle = LIT;
    ctx.beginPath();
    ctx.arc(dcx, dTop, dw / 2, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const a = Math.PI + k / 6 * Math.PI;
      line(ctx, dcx, dTop, dcx + Math.cos(a) * dw / 2, dTop + Math.sin(a) * dw / 2, 0.8);
    }
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(dcx, dTop, dw / 2 + 8, Math.PI, 0);
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      const sw = dw + 20 + k * 16, sy = BASE2 - 44 + k * 14.7;
      ctx.fillStyle = PAPER_HI;
      ctx.fillRect(dcx - sw / 2, sy, sw, 14.7);
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.1;
      ctx.strokeRect(dcx - sw / 2, sy, sw, 14.7);
      line(ctx, dcx - sw / 2 + 2, sy + 12, dcx + sw / 2 - 2, sy + 12, 1.6, rgba(INK6, 0.55));
    }
    const bw = Math.min(150, w - 150), bx = doorLeft ? x + w - 30 - bw : x + 24, bTop = BASE2 - 176;
    const front = rectPath(bx + 18, bTop, bw - 36, 132);
    const sideL = new Path2D();
    sideL.moveTo(bx, bTop + 8);
    sideL.lineTo(bx + 18, bTop);
    sideL.lineTo(bx + 18, bTop + 132);
    sideL.lineTo(bx, bTop + 124);
    sideL.closePath();
    const sideR = new Path2D();
    sideR.moveTo(bx + bw, bTop + 8);
    sideR.lineTo(bx + bw - 18, bTop);
    sideR.lineTo(bx + bw - 18, bTop + 132);
    sideR.lineTo(bx + bw, bTop + 124);
    sideR.closePath();
    const bayLit = R() < 0.55;
    for (const [p, a] of [[front, 0], [sideL, 1], [sideR, 2]]) {
      ctx.fillStyle = bayLit && a === 0 ? LIT : mix(PAPER5, INK6, a === 2 ? 0.3 : 0.15);
      ctx.fill(p);
      engrave(ctx, p, { bounds: [bx, bTop, bw, 132], angle: a === 0 ? bayLit ? Math.PI / 2 : 0.8 : Math.PI / 2, gap: a === 2 ? 2.6 : 3.4, color: bayLit && a === 0 ? "#c79a52" : INK6, width: () => bayLit && a === 0 ? 0.6 : 0.8, wobble: 0.2, step: 6, seed: seed + 30 + a });
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.4;
      ctx.stroke(p);
    }
    for (let k = 1; k < 3; k++) line(ctx, bx + 18 + (bw - 36) * k / 3, bTop, bx + 18 + (bw - 36) * k / 3, bTop + 132, 1.4);
    line(ctx, bx + 18, bTop + 50, bx + bw - 18, bTop + 50, 1.2);
    ctx.fillStyle = PAPER_HI;
    ctx.fillRect(bx - 6, bTop - 14, bw + 12, 14);
    ctx.strokeRect(bx - 6, bTop - 14, bw + 12, 14);
    ctx.fillStyle = FACADE;
    ctx.fillRect(bx - 2, bTop + 132, bw + 4, BASE2 - bTop - 132);
    ctx.strokeRect(bx - 2, bTop + 132, bw + 4, BASE2 - bTop - 132);
    const gap0 = dcx - (dw + 52) / 2, gap1 = dcx + (dw + 52) / 2;
    railings(ctx, x, gap0);
    railings(ctx, gap1, x + w);
    line(ctx, x, top - 16, x, BASE2, 2);
  }
  function sashSmall(ctx, x, y, w, h, lit, seed) {
    const g = rectPath(x, y, w, h);
    ctx.fillStyle = lit ? LIT : mix(PAPER5, INK6, 0.2);
    ctx.fill(g);
    if (!lit) engrave(ctx, g, { bounds: [x, y, w, h], angle: 0.8, gap: 3, color: INK6, width: () => 0.8, wobble: 0.2, step: 5, seed });
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
    line(ctx, x, y + h / 2, x + w, y + h / 2, 1);
  }
  function farLamp(ctx, x, y, sc) {
    const g = ctx.createRadialGradient(x, y - LAMP.head * sc, 2, x, y - LAMP.head * sc, 120 * sc);
    g.addColorStop(0, rgba(GLOW, 0.75));
    g.addColorStop(0.3, rgba(GLOW, 0.3));
    g.addColorStop(1, rgba(GLOW, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - 120 * sc, y - LAMP.head * sc - 120 * sc, 240 * sc, 240 * sc);
    ctx.drawImage(lampSprite(), x - LAMP.bx * sc, y - LAMP.by * sc, LAMP.w * sc, LAMP.h * sc);
  }
  function midLayer4() {
    return strip("s07-mid", P_MID4, (ctx, x0, x1) => {
      const R = rng("s07-mid");
      ctx.fillStyle = mix(PAPER5, "#d6c29a", 0.35);
      ctx.fillRect(x0, BASE2 - 2, x1 - x0, 1e3 - BASE2);
      let x = x0 - 80, k = 0, since = 0;
      while (x < x1 + 40) {
        if (since >= 2 && R() < 0.45) {
          const gw = 190 + R() * 90;
          ctx.save();
          ctx.globalAlpha = 0.85;
          farLamp(ctx, x + gw * 0.55, BASE2 - 30, 0.45);
          ctx.restore();
          line(ctx, x, BASE2 - 30, x + gw, BASE2 - 30, 0.8, INK_F);
          x += gw;
          since = 0;
          continue;
        }
        const w = 250 + R() * 90, top = 268 + R() * 70;
        townhouse(ctx, x, w, top, R, 100 + k * 37);
        x += w;
        k++;
        since++;
        if (R() < 0.15) {
          const aw = 34 + R() * 20;
          const a = rectPath(x, 380, aw, BASE2 - 380);
          ctx.fillStyle = mix(PAPER5, INK6, 0.22);
          ctx.fill(a);
          engrave(ctx, a, { bounds: [x, 380, aw, BASE2 - 380], angle: 0.9, gap: 3, color: INK6, width: (xx, yy) => 0.9 * (1 - smoothstep(560, 760, yy)), wobble: 0.3, step: 6, seed: k });
          x += aw;
        }
      }
      line(ctx, x0, BASE2, x1, BASE2, 1.6);
      ctx.globalCompositeOperation = "source-atop";
      const g = ctx.createLinearGradient(0, 160, 0, 800);
      g.addColorStop(0, rgba(FOG, 0.1));
      g.addColorStop(0.5, rgba(FOG, 0.22));
      g.addColorStop(0.85, rgba(FOG, 0.5));
      g.addColorStop(1, rgba(FOG, 0.62));
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, x1 - x0, 1e3);
      ctx.globalCompositeOperation = "source-over";
    }, { y0: 60, y1: 810 });
  }
  var lampXs = (cg) => {
    const [a, b] = stripRange(1);
    const xs = [];
    const base = LAMP_GAG_X + cg;
    for (let k = Math.floor((a - base) / LAMP_GAP) - 1; base + k * LAMP_GAP < b + 100; k++) xs.push(base + k * LAMP_GAP);
    return xs;
  };
  function cobble(ctx, x, y, w, h, tone2, R) {
    const j = () => (R() - 0.5) * h * 0.22;
    const c = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]];
    const p = new Path2D();
    for (let i = 0; i < 4; i++) {
      const a = c[i], b2 = c[(i + 1) % 4], m = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2];
      i ? p.quadraticCurveTo(a[0], a[1], m[0], m[1]) : p.moveTo(m[0], m[1]);
      if (i === 3) {
        const m0 = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2];
        p.quadraticCurveTo(c[0][0], c[0][1], m0[0], m0[1]);
      }
    }
    p.closePath();
    ctx.fillStyle = tone2;
    ctx.fill(p);
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 0.8;
    for (let k = 1; k <= 3; k++) {
      ctx.save();
      ctx.translate(-k * h * 0.07, -k * h * 0.1);
      ctx.globalAlpha = 0.7 - k * 0.15;
      ctx.stroke(p);
      ctx.restore();
    }
    ctx.restore();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.1;
    ctx.stroke(p);
  }
  function roadLayer3(cg) {
    return strip("s07-road", 1, (ctx, x0, x1) => {
      const R = rng("s07-road");
      ctx.fillStyle = mix(PAPER5, "#e2d1ad", 0.5);
      ctx.fillRect(x0, ROAD_Y - 14, x1 - x0, 50);
      engrave(ctx, rectPath(x0, ROAD_Y - 14, x1 - x0, 50), { bounds: [x0, ROAD_Y - 14, x1 - x0, 50], angle: 0, gap: 4, color: INK_L2, width: (x, y2) => 0.55 * smoothstep(ROAD_Y + 4, ROAD_Y + 34, y2), wobble: 0.4, step: 10, seed: 3 });
      for (let x = Math.floor(x0 / 86) * 86; x < x1; x += 86) line(ctx, x, ROAD_Y - 14, x - 8, ROAD_Y + 36, 1, INK_L2);
      line(ctx, x0, ROAD_Y + 11, x1, ROAD_Y + 11, 0.8, INK_L2);
      line(ctx, x0, ROAD_Y - 14, x1, ROAD_Y - 14, 1.4, INK_M2);
      const ky = ROAD_Y + 36;
      ctx.fillStyle = PAPER_HI;
      ctx.fillRect(x0, ky, x1 - x0, 16);
      engrave(ctx, rectPath(x0, ky + 5, x1 - x0, 11), { bounds: [x0, ky + 5, x1 - x0, 11], angle: 0, gap: 2.6, color: INK6, width: () => 0.8, wobble: 0.2, step: 10, seed: 4 });
      line(ctx, x0, ky, x1, ky, 1.6);
      line(ctx, x0, ky + 5, x1, ky + 5, 0.9);
      line(ctx, x0, ky + 16, x1, ky + 16, 1.6);
      for (let x = Math.floor(x0 / 118) * 118 + 30; x < x1; x += 118) line(ctx, x, ky, x, ky + 16, 1);
      let y = ky + 17;
      while (y < 1004) {
        const h = 10 + (y - ky) * 0.1;
        let x = x0 - R() * h * 2;
        while (x < x1) {
          const w = h * (1.2 + R() * 1.1);
          cobble(ctx, x + 1.6, y + 1.4, w - 3.2, h - 2.8, R() < 0.5 ? PAPER5 : mix(PAPER5, "#dcc9a2", 0.6), R);
          x += w;
        }
        y += h;
      }
      lampXs(cg).forEach((lx, i) => {
        const cy = 928 + i % 2 * 16, rx = 150 + i % 3 * 26;
        const E = [[lx + 20, cy, rx, 34], [lx - rx * 0.45, cy + 14, rx * 0.55, 22], [lx + rx * 0.7, cy - 8, rx * 0.5, 20]];
        const pud = new Path2D();
        for (const [ex, ey, erx, ery] of E) {
          pud.moveTo(ex + erx, ey);
          pud.ellipse(ex, ey, erx, ery, 0, 0, TAU);
        }
        const bx = lx - rx * 1.05, bw = rx * 2.4, by = cy - 40, bh = 80;
        const inside = (x, y2) => Math.max(...E.map(([ex, ey, erx, ery]) => 1 - Math.hypot((x - ex) / erx, (y2 - ey) / ery)));
        ctx.save();
        ctx.clip(pud);
        const wg = ctx.createLinearGradient(0, by, 0, by + bh);
        wg.addColorStop(0, rgba(PAPER_HI, 0.55));
        wg.addColorStop(1, rgba(PAPER_HI, 0.8));
        ctx.fillStyle = wg;
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
        engrave(ctx, pud, {
          bounds: [bx, by, bw, bh],
          angle: 0,
          gap: 3.2,
          color: INK_M2,
          wobble: 0.25,
          step: 7,
          seed: 40 + i,
          width: (x, yy) => {
            const e = inside(x, yy);
            const lit = smoothstep(8, 40, Math.abs(x - lx));
            return 0.9 * smoothstep(0.02, 0.3, e) * (0.25 + 0.75 * lit) * (noise2(x * 0.025, yy * 0.3, 9) > 0.4 ? 1 : 0);
          }
        });
        for (let yy = cy - 26; yy < cy + 30; yy += 4.5) {
          const ww = 2.5 + 3.5 * noise2(yy * 0.3, i, 2);
          line(ctx, lx - ww + Math.sin(yy * 0.5) * 2, yy, lx + ww + Math.sin(yy * 0.5) * 2, yy, 1.2, INK6);
        }
      });
      const g = ctx.createLinearGradient(0, ROAD_Y - 16, 0, 940);
      g.addColorStop(0, rgba(FOG, 0.5));
      g.addColorStop(0.35, rgba(FOG, 0.28));
      g.addColorStop(1, rgba(FOG, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x0, ROAD_Y - 16, x1 - x0, 1e3 - ROAD_Y + 16);
    }, { y0: ROAD_Y - 18, y1: 1e3 });
  }
  var LAMP = { w: 120, h: 690, bx: 60, by: 676, head: 540 };
  function lampSprite() {
    const res = 1.6 * K;
    return baked("s07-lamp", LAMP.w * res, LAMP.h * res, (ctx) => {
      ctx.scale(res, res);
      ctx.translate(LAMP.bx, LAMP.by);
      ctx.lineJoin = "round";
      const plinth = new Path2D();
      plinth.moveTo(-24, 0);
      plinth.lineTo(-24, -54);
      plinth.lineTo(-15, -74);
      plinth.lineTo(15, -74);
      plinth.lineTo(24, -54);
      plinth.lineTo(24, 0);
      plinth.closePath();
      ctx.fillStyle = mix(PAPER5, INK6, 0.3);
      ctx.fill(plinth);
      engrave(ctx, plinth, { bounds: [-26, -76, 52, 78], angle: Math.PI / 2, gap: 2.6, color: INK6, width: (x) => 0.6 + 0.6 * smoothstep(-20, 20, x), wobble: 0.2, step: 4, seed: 1 });
      engrave(ctx, plinth, { bounds: [-26, -76, 52, 78], angle: 0.6, gap: 3.2, color: INK6, width: (x) => 0.9 * smoothstep(0, 22, x), wobble: 0.2, step: 4, seed: 2 });
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.6;
      ctx.stroke(plinth);
      line(ctx, -24, -54, 24, -54, 1.2);
      const col = new Path2D();
      col.moveTo(-10, -74);
      col.lineTo(-6, -500);
      col.lineTo(6, -500);
      col.lineTo(10, -74);
      col.closePath();
      ctx.fillStyle = mix(PAPER5, INK6, 0.25);
      ctx.fill(col);
      engrave(ctx, col, { bounds: [-11, -500, 22, 428], angle: Math.PI / 2, gap: 2.4, color: INK6, width: (x) => 0.5 + 0.9 * smoothstep(-6, 8, x), wobble: 0.15, step: 8, seed: 3 });
      ctx.lineWidth = 1.5;
      ctx.stroke(col);
      for (const [yy, ww] of [[-150, 14], [-160, 12], [-470, 11], [-500, 12]]) {
        ctx.fillStyle = PAPER_HI;
        ctx.fillRect(-ww, yy - 4, 2 * ww, 7);
        ctx.strokeRect(-ww, yy - 4, 2 * ww, 7);
      }
      line(ctx, -36, -486, 36, -486, 3);
      for (const sx of [-1, 1]) {
        ctx.fillStyle = INK6;
        circle(ctx, sx * 38, -486, 4);
        ctx.fill();
      }
      const cone = new Path2D();
      cone.moveTo(-8, -504);
      cone.lineTo(-24, -516);
      cone.lineTo(24, -516);
      cone.lineTo(8, -504);
      cone.closePath();
      ctx.fillStyle = mix(PAPER5, INK6, 0.35);
      ctx.fill(cone);
      ctx.stroke(cone);
      const glass = new Path2D();
      glass.moveTo(-24, -516);
      glass.lineTo(-34, -590);
      glass.lineTo(34, -590);
      glass.lineTo(24, -516);
      glass.closePath();
      const gg = ctx.createRadialGradient(0, -548, 2, 0, -548, 40);
      gg.addColorStop(0, "#fff6d6");
      gg.addColorStop(0.45, "#fbe3a0");
      gg.addColorStop(1, GAS);
      ctx.fillStyle = gg;
      ctx.fill(glass);
      ctx.fillStyle = "#fffbe9";
      ellipse(ctx, 0, -546, 5, 9);
      ctx.fill();
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.8;
      ctx.stroke(glass);
      for (const t of [0.24, 0.76]) line(ctx, lerp(-24, 24, t), -516, lerp(-34, 34, t), -590, 1.6);
      line(ctx, -29, -553, 29, -553, 0.8, rgba(INK6, 0.6));
      const cap = new Path2D();
      cap.moveTo(-42, -590);
      cap.quadraticCurveTo(-30, -616, 0, -630);
      cap.quadraticCurveTo(30, -616, 42, -590);
      cap.closePath();
      ctx.fillStyle = mix(PAPER5, INK6, 0.3);
      ctx.fill(cap);
      engrave(ctx, cap, { bounds: [-44, -632, 88, 44], angle: Math.PI / 2, gap: 2.6, color: INK6, width: (x) => 0.5 + 0.8 * smoothstep(-30, 40, x), wobble: 0.2, step: 4, seed: 6 });
      ctx.lineWidth = 1.6;
      ctx.stroke(cap);
      ctx.fillStyle = PAPER_HI;
      circle(ctx, 0, -636, 6);
      ctx.fill();
      ctx.stroke();
      line(ctx, 0, -642, 0, -662, 2);
      line(ctx, -36, -590, -44, -582, 1.4);
      line(ctx, 36, -590, 44, -582, 1.4);
    });
  }
  var lampHead = (x) => [x, LAMP_Y - LAMP.head];
  function lampGlow(ctx, x, y, k) {
    const r = 200 * (0.85 + 0.35 * k);
    const g = ctx.createRadialGradient(x, y, 6, x, y, r);
    g.addColorStop(0, rgba("#fff3cc", Math.min(1, 0.95 * k)));
    g.addColorStop(0.16, rgba(GLOW, Math.min(1, 0.72 * k)));
    g.addColorStop(0.5, rgba(GLOW, 0.26 * k));
    g.addColorStop(1, rgba(GLOW, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  var flare = (b) => smoothstep(GAG - 0.06, GAG + 0.04, b) * (1 - 0.6 * smoothstep(GAG + 0.3, GAG + 2.5, b)) * (1 - smoothstep(GAG + 3.8, GAG + 4.6, b));
  function drawLamps(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG);
    const gagX = LAMP_GAG_X + cg;
    lampXs(cg).forEach((wx, i) => {
      const x = wx - cam;
      if (x < X_MIN - 260 || x > X_MAX + 260) return;
      const [hx, hy] = lampHead(x);
      const isGag = Math.abs(wx - gagX) < 1;
      const k = 0.9 + 0.12 * (noise2(b * 2.1, i * 3.7, 4) - 0.5) + (isGag ? 0.55 * flare(b) : 0);
      ctx.save();
      ctx.translate(x + 20, ROAD_Y + 10);
      ctx.scale(1, 0.16);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
      g.addColorStop(0, rgba(GLOW, 0.5 * k));
      g.addColorStop(1, rgba(GLOW, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-260, -260, 520, 520);
      ctx.restore();
      const rg = ctx.createLinearGradient(0, 880, 0, 990);
      rg.addColorStop(0, rgba(GLOW, 0));
      rg.addColorStop(0.4, rgba(GLOW, 0.45 * k));
      rg.addColorStop(1, rgba(GLOW, 0));
      ctx.fillStyle = rg;
      ellipse(ctx, x + 2, 935, 16 + 6 * k, 60);
      ctx.fill();
      lampGlow(ctx, hx, hy, k);
      ctx.drawImage(lampSprite(), x - LAMP.bx, LAMP_Y - LAMP.by, LAMP.w, LAMP.h);
    });
  }
  var MIST_W = 2400;
  function mistTex(seed, h) {
    const res = 0.5 * K;
    return baked(`s07-mist|${seed}|${h}`, MIST_W * res, h * res, (ctx) => {
      ctx.scale(res, res);
      const R = rng("s07-mist", seed);
      for (let i = 0; i < 70; i++) {
        const x = R() * MIST_W, y = h * (0.3 + 0.4 * R()), rx = 120 + R() * 240, ry = rx * (0.16 + 0.12 * R());
        for (const dx of [-MIST_W, 0, MIST_W]) {
          ctx.save();
          ctx.translate(x + dx, y);
          ctx.scale(1, ry / rx);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
          g.addColorStop(0, rgba(FOG, 0.3));
          g.addColorStop(0.6, rgba(FOG, 0.14));
          g.addColorStop(1, rgba(FOG, 0));
          ctx.fillStyle = g;
          ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
          ctx.restore();
        }
      }
    });
  }
  function drawMist(ctx, seed, y, h, off, alpha) {
    const tex = mistTex(seed, h);
    let x = X_MIN - (off % MIST_W + MIST_W) % MIST_W;
    ctx.save();
    ctx.globalAlpha = alpha;
    for (; x < X_MAX; x += MIST_W) ctx.drawImage(tex, x, y, MIST_W, h);
    ctx.restore();
  }
  var DS = 1.05;
  var HEAD_S = 1.2;
  var DET_Y = 612;
  var DET_GAG_X = -150;
  var SHOULDER2 = [112, 118];
  var T_DET = [GAG - 4, GAG - 2.5];
  function detX(b, env) {
    if (b < T_DET[0]) return -900;
    if (b < T_DET[1]) return lerp(-680, -195, ease.out((b - T_DET[0]) / (T_DET[1] - T_DET[0])));
    if (b < GAG) return lerp(-195, DET_GAG_X, smoothstep(T_DET[1], GAG, b));
    if (b < GAG + 4) return DET_GAG_X;
    return DET_GAG_X - (env.cam - env.camAt(GAG + 4)) * 1.3;
  }
  var nodAt = (b) => 0.16 * (pulse(GAG + 4.2, GAG + 4.6, b) + pulse(GAG + 4.65, GAG + 5.05, b));
  function rimRight(ctx, path, w = 4, dx = -3, alpha = 0.9) {
    ctx.save();
    ctx.clip(path);
    ctx.translate(dx, 0);
    ctx.strokeStyle = rgba(PAPER_HI, alpha);
    ctx.lineWidth = w;
    ctx.stroke(path);
    ctx.restore();
  }
  function shadeLeft(ctx, path, xSplit, kind = "cross", gap = 3.6) {
    ctx.save();
    ctx.clip(path);
    ctx.beginPath();
    ctx.rect(-400, -400, 400 + xSplit, 1200);
    ctx.clip();
    ctx.fillStyle = ctx.createPattern(tile(kind, INK6, 1.1, gap), "repeat");
    ctx.fill(path);
    ctx.restore();
  }
  function detectiveBody(ctx) {
    const coat = new Path2D();
    coat.moveTo(-112, 40);
    coat.lineTo(-138, 380);
    coat.lineTo(150, 380);
    coat.lineTo(118, 40);
    coat.closePath();
    fillEngraved(ctx, coat, "#6a4b31", "cross", { gap: 3.6, lw: 1.2 });
    line(ctx, 120, 220, 132, 380, 2, rgba(PAPER_HI, 0.7));
    ctx.strokeStyle = PAPER_HI;
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      circle(ctx, 106, 262 + k * 44, 4.5);
      ctx.stroke();
    }
    const cape = new Path2D();
    cape.moveTo(-36, -6);
    cape.bezierCurveTo(-92, -2, -126, 28, -136, 86);
    cape.bezierCurveTo(-144, 140, -150, 190, -156, 236);
    const hem = [[-156, 236], [-104, 246], [-50, 236], [6, 248], [62, 236], [114, 244], [150, 228]];
    for (let i = 1; i < hem.length; i++) {
      const [ax, ay] = hem[i - 1], [bx2, by2] = hem[i];
      cape.quadraticCurveTo((ax + bx2) / 2, Math.max(ay, by2) + 10, bx2, by2);
    }
    cape.bezierCurveTo(146, 170, 134, 90, 112, 40);
    cape.bezierCurveTo(96, 12, 66, -4, 34, -6);
    cape.quadraticCurveTo(0, -12, -36, -6);
    cape.closePath();
    fillEngraved(ctx, cape, "#957251", "diag", { gap: 3.8, lw: 1 });
    shadeLeft(ctx, cape, -10, "cross", 3.6);
    for (const [x0, y0, cx, cy, x1, y1] of [[-80, 30, -110, 120, -116, 236], [-30, 20, -50, 140, -48, 240], [30, 20, 40, 130, 34, 244], [80, 34, 100, 130, 110, 240]]) {
      ctx.strokeStyle = rgba(INK6, 0.75);
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(cx, cy, x1, y1);
      ctx.stroke();
      ctx.strokeStyle = rgba(PAPER_HI, 0.5);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0 + 7, y0 + 2);
      ctx.quadraticCurveTo(cx + 8, cy, x1 + 8, y1 - 2);
      ctx.stroke();
    }
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2.2;
    ctx.stroke(cape);
    rimRight(ctx, cape, 5, -4, 0.85);
    const collar = new Path2D();
    collar.moveTo(-50, -2);
    collar.lineTo(-62, -66);
    collar.quadraticCurveTo(-34, -44, -12, -8);
    collar.closePath();
    fillEngraved(ctx, collar, "#7a5a3c", "cross", { gap: 3.2 });
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.8;
    ctx.stroke(collar);
    const shirt = new Path2D();
    shirt.moveTo(-16, -22);
    shirt.lineTo(46, -20);
    shirt.lineTo(44, 8);
    shirt.lineTo(-12, 6);
    shirt.closePath();
    ctx.fillStyle = PAPER_HI;
    ctx.fill(shirt);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ctx.stroke(shirt);
    const tie = new Path2D();
    tie.moveTo(26, -4);
    tie.lineTo(48, -12);
    tie.lineTo(46, 12);
    tie.closePath();
    tie.moveTo(26, -4);
    tie.lineTo(8, -12);
    tie.lineTo(10, 10);
    tie.closePath();
    ctx.fillStyle = "#4e3420";
    ctx.fill(tie);
  }
  function detectiveHead(ctx, b, { nod = 0, tilt = 0, squint = 0 }) {
    const a = nod + tilt, pivot = [8, -8];
    ctx.save();
    ctx.translate(...pivot);
    ctx.rotate(a);
    ctx.scale(HEAD_S, HEAD_S);
    ctx.translate(-pivot[0], -pivot[1]);
    const face = new Path2D();
    face.moveTo(-34, -6);
    face.bezierCurveTo(-50, -30, -58, -62, -52, -92);
    face.lineTo(50, -102);
    face.bezierCurveTo(57, -94, 59, -88, 57, -80);
    face.quadraticCurveTo(54, -74, 61, -71);
    face.bezierCurveTo(76, -70, 93, -64, 90, -50);
    face.bezierCurveTo(88, -41, 76, -41, 68, -45);
    face.lineTo(66, -34);
    face.quadraticCurveTo(71, -28, 67, -20);
    face.bezierCurveTo(70, -10, 62, -2, 46, -3);
    face.quadraticCurveTo(30, 0, 18, 6);
    face.closePath();
    ctx.fillStyle = "#dcbf98";
    ctx.fill(face);
    ctx.fillStyle = ctx.createPattern(tile("diag", INK_M2, 0.8, 4.5), "repeat");
    ctx.fill(face);
    shadeLeft(ctx, face, 6, "cross", 3.4);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2.2;
    ctx.stroke(face);
    rimRight(ctx, face, 3.4, -3, 0.95);
    const chop = new Path2D();
    chop.moveTo(-6, -84);
    chop.quadraticCurveTo(-12, -40, 18, -14);
    chop.quadraticCurveTo(30, -30, 30, -44);
    chop.quadraticCurveTo(12, -54, 8, -84);
    chop.closePath();
    ctx.fillStyle = "#6d4c30";
    ctx.fill(chop);
    ctx.strokeStyle = rgba(PAPER_HI, 0.55);
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      ctx.moveTo(-2 + k * 4, -78 + k * 6);
      ctx.quadraticCurveTo(4 + k * 4, -50 + k * 4, 14 + k * 3, -24 + k);
      ctx.stroke();
    }
    ctx.fillStyle = "#dcbf98";
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ellipse(ctx, -18, -60, 9, 14, 0.1);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-17, -60, 5, -1.2, 1.4);
    ctx.stroke();
    const mus = new Path2D();
    mus.moveTo(56, -47);
    mus.bezierCurveTo(70, -52, 90, -48, 95, -28);
    mus.quadraticCurveTo(88, -32, 84, -24);
    mus.quadraticCurveTo(78, -32, 70, -24);
    mus.quadraticCurveTo(62, -32, 52, -28);
    mus.quadraticCurveTo(48, -40, 56, -47);
    mus.closePath();
    ctx.fillStyle = "#4e3420";
    ctx.fill(mus);
    ctx.strokeStyle = rgba(PAPER_HI, 0.7);
    ctx.lineWidth = 1;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(60 + k * 6, -46);
      ctx.quadraticCurveTo(66 + k * 6, -38, 60 + k * 6.5, -28);
      ctx.stroke();
    }
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ctx.stroke(mus);
    line(ctx, 38, -88, 60, -91, 4.5, INK6);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, -79 + squint);
    ctx.quadraticCurveTo(50, -82, 56, -79 + squint * 0.5);
    ctx.stroke();
    ctx.strokeStyle = PAPER_HI;
    ctx.lineWidth = 2.6;
    circle(ctx, 50, -78, 11);
    ctx.stroke();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.1;
    circle(ctx, 50, -78, 13);
    ctx.stroke();
    circle(ctx, 50, -78, 9);
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = rgba(PAPER_HI, 0.9);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(40, -72);
    ctx.quadraticCurveTo(14, -20, 28, 30);
    ctx.stroke();
    ctx.setLineDash([]);
    const crown = new Path2D();
    crown.moveTo(-58, -80);
    crown.bezierCurveTo(-64, -152, 60, -160, 62, -96);
    crown.quadraticCurveTo(0, -106, -58, -80);
    crown.closePath();
    fillEngraved(ctx, crown, "#b08c66", "check", { gap: 4, lw: 0.8 });
    shadeLeft(ctx, crown, -10, "diag", 3.4);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.2;
    for (const k of [-0.62, 0, 0.62]) {
      ctx.beginPath();
      ctx.moveTo(0, -146);
      ctx.quadraticCurveTo(k * 40, -126, k * 66, -98 + Math.abs(k) * 10);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    ctx.stroke(crown);
    rimRight(ctx, crown, 3, -3, 0.8);
    const brimF = new Path2D();
    brimF.moveTo(46, -100);
    brimF.quadraticCurveTo(88, -106, 110, -90);
    brimF.quadraticCurveTo(86, -86, 50, -92);
    brimF.closePath();
    const brimB = new Path2D();
    brimB.moveTo(-52, -84);
    brimB.quadraticCurveTo(-86, -84, -104, -66);
    brimB.quadraticCurveTo(-80, -70, -54, -76);
    brimB.closePath();
    for (const p of [brimF, brimB]) {
      fillEngraved(ctx, p, "#8a6646", "cross", { gap: 3.2 });
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.8;
      ctx.stroke(p);
    }
    ctx.fillStyle = "#b08c66";
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.4;
    for (const sx of [-1, 1]) {
      ellipse(ctx, sx * 11, -150, 11, 6, sx * 0.5);
      ctx.fill();
      ctx.stroke();
    }
    circle(ctx, 0, -149, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    const cx = (52 - pivot[0]) * HEAD_S, cy = (-4 - pivot[1]) * HEAD_S;
    return [pivot[0] + cx * Math.cos(a) - cy * Math.sin(a), pivot[1] + cx * Math.sin(a) + cy * Math.cos(a)];
  }
  function thinkingArm(ctx, chin, tap) {
    const el = [120, 190];
    const hand = [chin[0] + 4, chin[1] + 14];
    const sleeve = () => {
      ctx.beginPath();
      ctx.moveTo(...el);
      ctx.quadraticCurveTo(hand[0] + 24, (el[1] + hand[1]) / 2 + 20, hand[0] + 4, hand[1] + 18);
    };
    ctx.lineCap = "round";
    sleeve();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 40;
    ctx.stroke();
    ctx.strokeStyle = "#7a5a3c";
    ctx.lineWidth = 35;
    ctx.stroke();
    ctx.strokeStyle = ctx.createPattern(tile("cross", INK6, 1.1, 3.6), "repeat");
    ctx.stroke();
    ctx.strokeStyle = rgba(PAPER_HI, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(el[0] + 17, el[1] - 6);
    ctx.quadraticCurveTo(hand[0] + 42, (el[1] + hand[1]) / 2 + 12, hand[0] + 20, hand[1] + 16);
    ctx.stroke();
    ctx.fillStyle = PAPER_HI;
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    ellipse(ctx, hand[0] + 4, hand[1] + 20, 19, 7, -0.2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#e1cba3";
    ellipse(ctx, hand[0], hand[1] + 6, 17, 14, -0.3);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(hand[0] - 8 + k * 6, hand[1] - 4);
      ctx.lineTo(hand[0] - 6 + k * 6, hand[1] + 6);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.lineWidth = 8.5;
    ctx.strokeStyle = INK6;
    ctx.beginPath();
    ctx.moveTo(hand[0] + 8, hand[1] - 2);
    ctx.lineTo(hand[0] + 10 - tap * 3, hand[1] - 24 - tap * 7);
    ctx.stroke();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#e1cba3";
    ctx.stroke();
  }
  var RL = 128;
  var GRIP = [RL + 22, RL + 330];
  var HAND_AT = RL + 250;
  var A_DOWN = 1.32;
  var T_IN = [GAG - 0.25, GAG + 0.06];
  var T_SCAN = [GAG + 0.2, GAG + 0.95];
  var T_OUT3 = [GAG + 4, GAG + 4.38];
  function lensState(b, env, fig) {
    if (b < T_IN[0] || b > T_OUT3[1]) return null;
    const S = [detX(b, env) + SHOULDER2[0] * DS, DET_Y + SHOULDER2[1] * DS];
    const E = [fig.x + (ANCHORS.stand.ear[0] - 9) * fig.scale, fig.y + (ANCHORS.stand.ear[1] + 3) * fig.scale];
    const P0 = [fig.x - 14, fig.y - 380];
    const F = [fig.x + 4, fig.y - 450];
    const polar = (P2) => [Math.atan2(P2[1] - S[1], P2[0] - S[0]), Math.hypot(P2[0] - S[0], P2[1] - S[1])];
    let C, M2;
    if (b < T_SCAN[0]) {
      const [a1, L] = polar(P0);
      const a = lerp(A_DOWN, a1, ease.outBack(clamp((b - T_IN[0]) / (T_IN[1] - T_IN[0]))));
      C = [S[0] + Math.cos(a) * L, S[1] + Math.sin(a) * L];
      M2 = 1.5;
    } else if (b < T_SCAN[1]) {
      const t = (b - T_SCAN[0]) / (T_SCAN[1] - T_SCAN[0]);
      const u = ease.inOut(t);
      C = [lerp(lerp(P0[0], F[0], u), lerp(F[0], E[0], u), u), lerp(lerp(P0[1], F[1], u), lerp(F[1], E[1], u), u)];
      M2 = lerp(1.5, 2.2, ease.inOut(clamp(t * 1.15)));
    } else {
      const nudge = pulse(GAG + 1, GAG + 1.3, b) + pulse(GAG + 2, GAG + 2.3, b) + pulse(GAG + 3, GAG + 3.3, b);
      C = [E[0] + Math.sin(b * 2.3) * 2 - nudge * 4, E[1] + Math.cos(b * 1.9) * 1.6 + nudge * 3];
      M2 = 2.2 + 0.08 * nudge;
      if (b > T_OUT3[0]) {
        const [a1, L] = polar(C);
        const a = lerp(a1, A_DOWN, ease.in((b - T_OUT3[0]) / (T_OUT3[1] - T_OUT3[0])));
        C = [S[0] + Math.cos(a) * L, S[1] + Math.sin(a) * L];
      }
    }
    return { C, M: M2, S };
  }
  var LC = { x: 70, y: 0, w: 240, h: 210, k: 2.2 };
  function cropUp(I, { x, y, w, h, k }) {
    const W2 = Math.round(w * k), H2 = Math.round(h * k), n = W2 * H2;
    const O = { w: W2, h: H2, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    const at = (xx, yy) => Math.min(I.h - 1, Math.max(0, yy)) * I.w + Math.min(I.w - 1, Math.max(0, xx));
    for (let j = 0; j < H2; j++) {
      const sy = y + (j + 0.5) / k - 0.5, y0 = Math.floor(sy), fy = sy - y0;
      for (let i = 0; i < W2; i++) {
        const sx = x + (i + 0.5) / k - 0.5, x0 = Math.floor(sx), fx = sx - x0;
        const idx = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
        const wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
        let r = 0, g = 0, bb = 0, a = 0;
        for (let q = 0; q < 4; q++) {
          const aw = I.a[idx[q]] * wt[q];
          r += I.r[idx[q]] * aw;
          g += I.g[idx[q]] * aw;
          bb += I.b[idx[q]] * aw;
          a += aw;
        }
        const o = j * W2 + i;
        if (a > 1e-4) {
          O.r[o] = r / a;
          O.g[o] = g / a;
          O.b[o] = bb / a;
        }
        O.a[o] = a;
      }
    }
    return O;
  }
  var EARBUD = [201, 54, 9, 12];
  function lensEngrave(I, earbud) {
    const C = cropUp(I, LC), k = LC.k;
    const S = smoothColor(C, 1.6);
    const L = lumaArray(S, 0.8);
    const E = sobel(lumaArray(smoothColor(C, 3.2), 0.7), S.w, S.h);
    const P2 = rgbf(PAPER_HI), Kk = rgbf(INK6);
    const O = clone(S);
    const g = 3.5;
    const dirs = [[0.5, 0.12, 0.62], [-1.05, 0.42, 0.46], [1.45, 0.7, 0.26]].map(([a, d0, span]) => [Math.cos(a), Math.sin(a), d0, span]);
    const [ex, ey, erx, ery] = earbud ? [(earbud[0] - LC.x) * k, (earbud[1] - LC.y) * k, earbud[2] * k, earbud[3] * k] : [0, 0, 0, 0];
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const i = y * S.w + x;
      if (S.a[i] < 0.02) continue;
      let l = L[i];
      let bud = false;
      if (earbud) {
        const q = ((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2;
        if (q < 1 && l < 0.62) {
          l = 0.02;
          bud = true;
        }
      }
      const d = 1 - l;
      const wob = (noise2(x * 0.04, y * 0.04, 7) - 0.5) * 1.6;
      let on = d > 0.94 || E[i] > 0.3;
      for (const [c, s, d0, span] of dirs) {
        if (on) break;
        const u = ((x * c + y * s + wob) / g % 1 + 1) % 1;
        const dist2 = Math.min(u, 1 - u) * 2;
        on = dist2 < clamp((d - d0) / span) * 0.92;
      }
      const col = on ? Kk : P2;
      O.r[i] = col[0];
      O.g[i] = col[1];
      O.b[i] = col[2];
      O.a[i] = S.a[i] > 0.5 ? 1 : S.a[i];
      if (bud && ((x - ex + erx * 0.3) / erx) ** 2 + ((y - ey + ery * 0.35) / ery) ** 2 < 0.05) {
        O.r[i] = P2[0];
        O.g[i] = P2[1];
        O.b[i] = P2[2];
      }
    }
    outline(O, C.a, 2.6, Kk);
    return O;
  }
  registerStyle("s07-lens", (I) => lensEngrave(I, null));
  registerStyle("s07-lens-stand", (I) => lensEngrave(I, EARBUD));
  function drawLensFigure(ctx, fig) {
    const W2 = activeWalk();
    if (!W2) return;
    const m = W2.meta, sc = FIGURE_H / m.personHeight;
    const stand = fig.pose === "stand";
    const idx = stand ? -1 : frameIndex(fig.phase || 0);
    const src = stand ? W2.stand : W2.frames[idx];
    if (!src) return;
    const img = styledFrame(`${W2.name}/${stand ? "stand" : idx}`, src, stand ? "s07-lens-stand" : "s07-lens");
    const s = sc * fig.scale;
    ctx.drawImage(img, fig.x + (LC.x - m.anchorX) * s, fig.y + (LC.y - m.baseY) * s, LC.w * s, LC.h * s);
  }
  function drawMagnifier(ctx, b, env, L) {
    const { C, M: M2, S } = L;
    const fig = env.figure();
    const ang = Math.atan2(S[1] - C[1], S[0] - C[0]);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    const P2 = (d, o = 0) => [C[0] + ux * d - uy * o, C[1] + uy * d + ux * o];
    const grip = new Path2D();
    const prof = [[GRIP[0], 9], [GRIP[0] + 16, 9], [GRIP[0] + 24, 14], [GRIP[0] + 110, 17], [GRIP[1] - 20, 15], [GRIP[1], 11]];
    prof.forEach(([d, r], i) => {
      const [x, y] = P2(d, -r);
      i ? grip.lineTo(x, y) : grip.moveTo(x, y);
    });
    for (let i = prof.length - 1; i >= 0; i--) {
      const [x, y] = P2(prof[i][0], prof[i][1]);
      grip.lineTo(x, y);
    }
    grip.closePath();
    fillEngraved(ctx, grip, "#a07a52", "diag", { gap: 3.4, lw: 1 });
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2;
    ctx.stroke(grip);
    for (const d of [GRIP[0] + 18, GRIP[0] + 30, GRIP[1] - 26]) {
      const [ax, ay] = P2(d, -16), [bx2, by2] = P2(d, 16);
      line(ctx, ax, ay, bx2, by2, 1.8);
    }
    {
      const [ax, ay] = P2(GRIP[0] + 34, -12), [bx2, by2] = P2(GRIP[1] - 30, -12);
      line(ctx, ax, ay, bx2, by2, 2, rgba(PAPER_HI, 0.8));
    }
    {
      const [ax, ay] = P2(RL + 2), [bx2, by2] = P2(GRIP[0] + 2);
      ctx.lineCap = "butt";
      line(ctx, ax, ay, bx2, by2, 20, INK6);
      line(ctx, ax, ay, bx2, by2, 15, "#c9ab7c");
      ctx.lineCap = "round";
    }
    const H2 = P2(HAND_AT);
    ctx.lineCap = "round";
    {
      const mx = (S[0] + H2[0]) / 2 - uy * 0, my = (S[1] + H2[1]) / 2;
      const sag = 22, Q = [mx + Math.sin(ang) * sag * 0, my + sag];
      const sleeve = () => {
        ctx.beginPath();
        ctx.moveTo(...S);
        ctx.quadraticCurveTo(Q[0], Q[1], H2[0] + ux * 26, H2[1] + uy * 26);
      };
      sleeve();
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 44;
      ctx.stroke();
      ctx.strokeStyle = "#8a6646";
      ctx.lineWidth = 39;
      ctx.stroke();
      ctx.strokeStyle = ctx.createPattern(tile("diag", INK6, 1.1, 3.6), "repeat");
      ctx.stroke();
      ctx.save();
      ctx.translate(0, 9);
      ctx.strokeStyle = ctx.createPattern(tile("cross", INK6, 1, 3.4), "repeat");
      ctx.lineWidth = 20;
      sleeve();
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = rgba(PAPER_HI, 0.75);
      ctx.lineWidth = 2;
      ctx.save();
      ctx.translate(0, -17);
      sleeve();
      ctx.stroke();
      ctx.restore();
      const cu = [H2[0] + ux * 30, H2[1] + uy * 30];
      ctx.save();
      ctx.translate(...cu);
      ctx.rotate(ang);
      ctx.fillStyle = PAPER_HI;
      ctx.strokeStyle = INK6;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 22, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    const mag = smoothstep(T_IN[1] - 0.06, T_SCAN[0] + 0.1, b) * (1 - smoothstep(T_OUT3[0], T_OUT3[0] + 0.12, b));
    ctx.save();
    ctx.beginPath();
    ctx.arc(C[0], C[1], RL, 0, TAU);
    ctx.clip();
    ctx.fillStyle = rgba(PAPER_HI, 0.3 + 0.7 * mag);
    ctx.fillRect(C[0] - RL, C[1] - RL, 2 * RL, 2 * RL);
    if (mag > 0.01) {
      ctx.save();
      ctx.globalAlpha = mag;
      ctx.translate(C[0], C[1]);
      ctx.scale(M2, M2);
      ctx.translate(-C[0], -C[1]);
      const [lx, ly] = lampHead(LAMP_GAG_X + env.camAt(GAG) - env.cam);
      lampGlow(ctx, lx, ly, 0.9 + 0.5 * flare(b));
      ctx.strokeStyle = rgba(INK_L2, 0.22);
      ctx.lineWidth = 0.45;
      for (let yy = Math.floor((C[1] - RL) / 3.5) * 3.5; yy < C[1] + RL; yy += 3.5) {
        const n0 = noise2(yy * 0.13, 1, 31);
        if (n0 < 0.45) continue;
        const xa = C[0] - RL + (noise2(yy * 0.3, 2, 31) - 0.2) * RL, xb = xa + RL * (0.3 + n0);
        ctx.beginPath();
        ctx.moveTo(xa, yy);
        ctx.lineTo(xb, yy);
        ctx.stroke();
      }
      drawLensFigure(ctx, fig);
      ctx.restore();
    }
    const vg = ctx.createRadialGradient(C[0], C[1], RL * 0.7, C[0], C[1], RL);
    vg.addColorStop(0, rgba(INK6, 0));
    vg.addColorStop(1, rgba(INK6, 0.22));
    ctx.fillStyle = vg;
    ctx.fillRect(C[0] - RL, C[1] - RL, 2 * RL, 2 * RL);
    ctx.restore();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 24;
    circle(ctx, C[0], C[1], RL + 9);
    ctx.stroke();
    ctx.strokeStyle = "#c9ab7c";
    ctx.lineWidth = 19;
    ctx.stroke();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1;
    for (let k = 0; k < 96; k++) {
      const a = k / 96 * TAU;
      const shade2 = smoothstep(-0.2, 0.8, Math.sin(a - 0.6));
      if (shade2 < 0.15 && k % 2) continue;
      ctx.globalAlpha = 0.35 + 0.6 * shade2;
      line(ctx, C[0] + Math.cos(a) * (RL + 1), C[1] + Math.sin(a) * (RL + 1), C[0] + Math.cos(a) * (RL + 17), C[1] + Math.sin(a) * (RL + 17), 1);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = rgba(PAPER_HI, 0.9);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(C[0], C[1], RL + 13, Math.PI * 1.05, Math.PI * 1.55);
    ctx.stroke();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.6;
    circle(ctx, C[0], C[1], RL);
    ctx.stroke();
    circle(ctx, C[0], C[1], RL + 20);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,252,240,0.85)";
    ctx.lineCap = "round";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(C[0], C[1], RL * 0.8, Math.PI * 1.08, Math.PI * 1.36);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(C[0], C[1], RL * 0.8, Math.PI * 1.43, Math.PI * 1.5);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255,252,240,0.5)";
    ctx.beginPath();
    ctx.arc(C[0], C[1], RL * 0.62, Math.PI * 1.15, Math.PI * 1.3);
    ctx.stroke();
    const glint = pulse(T_SCAN[1] - 0.05, T_SCAN[1] + 0.45, b);
    if (glint > 0) {
      const gx = C[0] - RL * 0.55, gy = C[1] - RL * 0.6, r = 26 * glint;
      ctx.fillStyle = "rgba(255,252,238,0.95)";
      ctx.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * TAU, rr = k % 2 ? r * 0.18 : r;
        ctx.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#d9c29a";
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(...H2);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 22, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(-12 + k * 9, -20);
      ctx.quadraticCurveTo(-16 + k * 9, 0, -12 + k * 9, 20);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawDetective(ctx, b, env) {
    const X = detX(b, env);
    if (X < X_MIN - 300) return;
    const sneak = b < GAG ? Math.abs(Math.sin(b * Math.PI)) * 7 * (1 - smoothstep(GAG - 1, GAG, b)) : 0;
    const tilt = b < GAG ? 0.05 * Math.sin(b * Math.PI * 0.5) : -0.06 * smoothstep(GAG, GAG + 0.6, b) * (1 - smoothstep(GAG + 4, GAG + 4.3, b));
    ctx.save();
    ctx.translate(X, DET_Y - sneak);
    ctx.scale(DS, DS);
    detectiveBody(ctx);
    const chin = detectiveHead(ctx, b, { nod: nodAt(b), tilt, squint: b >= GAG && b < GAG + 4 ? -2 : 0 });
    thinkingArm(ctx, chin, Math.max(0, Math.sin(b * Math.PI * 2)) * (b < GAG ? 1 : 0));
    ctx.restore();
  }
  var s07 = {
    id: "s07",
    station: ST7,
    figureStyle: "etching",
    freezeBeat: GAG + 2,
    // Outro 展墙：放大镜正对着耳机
    drawBack(ctx, b, env) {
      const cam = env.cam, cg = env.camAt(GAG);
      const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1e3 * K);
      ctx.drawImage(paperTexture(pw, ph, { base: PAPER5, seed: 7, amount: 1.1 }), X_MIN, 0, X_MAX - X_MIN, 1e3);
      drawStrip(ctx, skyLayer4(), cam);
      drawStrip(ctx, farLayer5(), cam);
      drawMist(ctx, 1, 420, 280, cam * P_MIST_A + b * 9, 0.6);
      drawStrip(ctx, midLayer4(), cam);
      drawMist(ctx, 2, 560, 260, cam * P_MIST_B + b * 14, 0.75);
      drawStrip(ctx, roadLayer3(cg), cam);
      drawLamps(ctx, b, env);
    },
    drawFront(ctx, b, env) {
      if (b < T_DET[0] - 0.5 || b > 16.5) return;
      drawDetective(ctx, b, env);
      const L = lensState(b, env, env.figure());
      if (L) drawMagnifier(ctx, b, env, L);
    },
    drawFrame(ctx, R) {
      bookFrame(ctx, R);
    },
    cardStyle: {
      ink: INK6,
      accent: "#8a4f22",
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        const pad = 18;
        const c = baked(`s07-card|${Math.round(w)}|${h}`, w + 2 * pad, h + 2 * pad, (g) => {
          g.translate(pad, pad);
          engravedPlate(g, w, h, 1);
        });
        ctx.drawImage(c, x - pad, y - pad);
      }
    },
    playerStyle: {
      ink: INK6,
      noteColor: "#8a4f22",
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        const pad = 14;
        const c = baked(`s07-plate|${Math.round(w)}|${h}`, w + 2 * pad, h + 2 * pad, (g) => {
          g.translate(pad, pad);
          engravedPlate(g, w, h, 0.7);
        });
        ctx.drawImage(c, x - pad, y - pad);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        engravedCD(ctx, cx, cy, s, spin);
      }
    }
  };
  function engravedPlate(g, w, h, k) {
    g.drawImage(paperTexture(Math.ceil(w), Math.ceil(h), { base: PAPER_HI, seed: 17, amount: 0.8, fibers: 40 }), 0, 0);
    g.fillStyle = rgba(INK6, 0.6);
    for (let yy = 8; yy < h + 7; yy += 3.2) g.fillRect(w, yy, 7, 1.1);
    for (let xx = 8; xx < w + 7; xx += 3.2) g.fillRect(xx, h, 1.1, 7);
    g.strokeStyle = INK6;
    g.lineWidth = 3.2 * k + 0.6;
    g.strokeRect(1.5, 1.5, w - 3, h - 3);
    const m = 9 * k + 3, rr = 10 * k + 4;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(m + rr, m);
    g.lineTo(w - m - rr, m);
    g.arc(w - m, m, rr, Math.PI, Math.PI / 2, true);
    g.lineTo(w - m, h - m - rr);
    g.arc(w - m, h - m, rr, -Math.PI / 2, Math.PI, true);
    g.lineTo(m + rr, h - m);
    g.arc(m, h - m, rr, 0, -Math.PI / 2, true);
    g.lineTo(m, m + rr);
    g.arc(m, m, rr, Math.PI / 2, 0, true);
    g.closePath();
    g.stroke();
    for (const [cx, cy, a] of [[m, m, 0], [w - m, m, Math.PI / 2], [w - m, h - m, Math.PI], [m, h - m, -Math.PI / 2]]) {
      g.save();
      g.translate(cx, cy);
      g.rotate(a);
      g.fillStyle = INK6;
      g.beginPath();
      g.arc(0, 0, 2.6 * k + 1, 0, TAU);
      g.fill();
      g.lineWidth = 1;
      for (let p = 0; p < 4; p++) {
        g.save();
        g.rotate(p * Math.PI / 2 + Math.PI / 4);
        g.beginPath();
        g.ellipse(0, -(3.2 * k + 2.4), 1.6 * k + 0.8, 2.6 * k + 1.2, 0, 0, TAU);
        g.stroke();
        g.restore();
      }
      g.beginPath();
      g.moveTo(rr * 0.9, 3);
      g.quadraticCurveTo(rr * 1.8, 9 * k, rr * 2.6, 4);
      g.stroke();
      g.beginPath();
      g.moveTo(3, rr * 0.9);
      g.quadraticCurveTo(9 * k, rr * 1.8, 4, rr * 2.6);
      g.stroke();
      g.restore();
    }
    for (const yy of [m, h - m]) {
      g.save();
      g.translate(w / 2, yy);
      g.fillStyle = PAPER_HI;
      g.beginPath();
      g.moveTo(-7, 0);
      g.lineTo(0, -4);
      g.lineTo(7, 0);
      g.lineTo(0, 4);
      g.closePath();
      g.fill();
      g.strokeStyle = INK6;
      g.lineWidth = 1.1;
      g.stroke();
      g.restore();
    }
  }
  function engravedCD(ctx, cx, cy, s, spin) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.save();
    ctx.beginPath();
    ctx.arc(6 * s, 7 * s, r, 0, TAU);
    ctx.clip();
    ctx.strokeStyle = rgba(INK6, 0.5);
    ctx.lineWidth = 1;
    for (let t = -r; t < r * 2; t += 3.2) {
      ctx.beginPath();
      ctx.moveTo(t - r, -r);
      ctx.lineTo(t + r, r * 1.2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = PAPER_HI;
    circle(ctx, 0, 0, r);
    ctx.fill();
    const gaps = [[-2.5, -1.75], [0.55, 1.2]];
    ctx.strokeStyle = INK6;
    ctx.lineCap = "butt";
    for (let rr = r * 0.3; rr < r - 3; rr += 2.7 * s) {
      const t = (rr - r * 0.3) / (r * 0.7);
      ctx.lineWidth = 0.55 + 0.5 * t;
      let a0 = gaps[0][1];
      for (const [g0, g1] of [gaps[1], [gaps[0][0] + TAU, gaps[0][1] + TAU]]) {
        const shrink = 0.12 + 0.18 * Math.sin(rr * 0.7);
        ctx.beginPath();
        ctx.arc(0, 0, rr, a0 + shrink, g0 - shrink);
        ctx.stroke();
        a0 = g1;
      }
    }
    ctx.rotate(spin);
    ctx.lineWidth = 1.6;
    circle(ctx, 0, 0, r * 0.62);
    ctx.stroke();
    ctx.lineWidth = 0.9;
    for (let k = 0; k < 36; k++) {
      const a = k / 36 * TAU;
      line(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, Math.cos(a) * r * 0.69, Math.sin(a) * r * 0.69, 0.9);
    }
    ctx.fillStyle = INK6;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU, rr = k % 2 ? 3 * s : 8 * s;
      ctx.lineTo(r * 0.8 + Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAPER_HI;
    circle(ctx, 0, 0, r * 0.27);
    ctx.fill();
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 1.4;
    ctx.stroke();
    for (let rr = r * 0.14; rr < r * 0.26; rr += 2.2 * s) {
      ctx.lineWidth = 0.7;
      circle(ctx, 0, 0, rr);
      ctx.stroke();
    }
    ctx.fillStyle = INK6;
    circle(ctx, 0, 0, r * 0.09);
    ctx.fill();
    ctx.rotate(-spin);
    ctx.strokeStyle = INK6;
    ctx.lineWidth = 2.6 * s;
    circle(ctx, 0, 0, r);
    ctx.stroke();
    ctx.lineWidth = 1;
    circle(ctx, 0, 0, r - 4 * s);
    ctx.stroke();
    ctx.restore();
  }
  function bookFrame(ctx, R) {
    const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
    ctx.save();
    ctx.fillStyle = rgba(INK6, 0.16);
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU);
    ctx.fill();
    const band = new Path2D();
    band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
    band.rect(x, y, w, h);
    ctx.fillStyle = PAPER5;
    ctx.fill(band, "evenodd");
    ctx.fillStyle = rgba(PAPER_HI, 0.6);
    ctx.fill(band, "evenodd");
    ctx.strokeStyle = INK6;
    ctx.lineWidth = Math.max(1, 5 * s);
    ctx.strokeRect(x - t + 2.5 * s, y - t + 2.5 * s, w + 2 * t - 5 * s, h + 2 * t - 5 * s);
    ctx.lineWidth = Math.max(0.6, 1.4 * s);
    ctx.strokeRect(x - t + 10 * s, y - t + 10 * s, w + 2 * t - 20 * s, h + 2 * t - 20 * s);
    ctx.lineWidth = Math.max(0.6, 1.4 * s);
    ctx.strokeRect(x - 10 * s, y - 10 * s, w + 20 * s, h + 20 * s);
    ctx.lineWidth = Math.max(1, 4 * s);
    ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
    const mid = t / 2, amp = 8 * s, per = 34 * s;
    const sides = [
      [x - mid, y - mid, x + w + mid, y - mid],
      [x + w + mid, y - mid, x + w + mid, y + h + mid],
      [x + w + mid, y + h + mid, x - mid, y + h + mid],
      [x - mid, y + h + mid, x - mid, y - mid]
    ];
    ctx.lineWidth = Math.max(0.6, 1.5 * s);
    for (const [ax, ay, bx2, by2] of sides) {
      const len = Math.hypot(bx2 - ax, by2 - ay), ux = (bx2 - ax) / len, uy = (by2 - ay) / len;
      const n = Math.max(2, Math.round(len / per));
      for (const ph of [0, Math.PI]) {
        ctx.beginPath();
        for (let i = 0; i <= n * 12; i++) {
          const d = i / (n * 12) * len, o = Math.sin(d / len * n * TAU + ph) * amp;
          const px = ax + ux * d - uy * o, py = ay + uy * d + ux * o;
          i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
      ctx.fillStyle = INK6;
      for (let i = 1; i < n * 2; i++) {
        const d = i / (n * 2) * len;
        ctx.beginPath();
        ctx.arc(ax + ux * d, ay + uy * d, Math.max(0.8, 2 * s), 0, TAU);
        ctx.fill();
      }
    }
    for (const [cx, cy] of [[x - mid, y - mid], [x + w + mid, y - mid], [x - mid, y + h + mid], [x + w + mid, y + h + mid]]) {
      const q = t * 0.42;
      ctx.fillStyle = PAPER_HI;
      ctx.fillRect(cx - q, cy - q, 2 * q, 2 * q);
      ctx.lineWidth = Math.max(0.8, 2 * s);
      ctx.strokeRect(cx - q, cy - q, 2 * q, 2 * q);
      ctx.lineWidth = Math.max(0.6, 1.2 * s);
      for (let p = 0; p < 8; p++) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(p / 8 * TAU);
        ctx.beginPath();
        ctx.ellipse(0, -q * 0.45, q * 0.16, q * 0.36, 0, 0, TAU);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = INK6;
      ctx.beginPath();
      ctx.arc(cx, cy, q * 0.18, 0, TAU);
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.strokeStyle = rgba(INK6, 0.45);
    ctx.lineWidth = Math.max(0.5, 1 * s);
    for (let k = 0; k < 4; k++) {
      const o = (3 + k * 3.2) * s;
      ctx.globalAlpha = 1 - k * 0.22;
      ctx.beginPath();
      ctx.moveTo(x, y + o);
      ctx.lineTo(x + w, y + o);
      ctx.moveTo(x + o, y);
      ctx.lineTo(x + o, y + h);
      ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }

  // src/scenes/s08.js
  var ST8 = stationByN(8);
  var G0 = "#2a2622";
  var G1 = "#4d463d";
  var G2 = "#776e61";
  var G3 = "#9d9483";
  var G4 = "#bdb4a0";
  var G5 = "#d3cbb7";
  var G6 = "#e2dbc8";
  var G7 = "#efe9d8";
  var LIGHT = "#fff8e4";
  var CREAM2 = "#f2ead2";
  var VELVET_D = "#4a0e12";
  var VELVET_L = "#c0413f";
  var GOLD2 = "#c9a45a";
  var WALL = "#221a17";
  var SIL = "#1b1715";
  var NIGHT = "#120f0e";
  var T_PULL = [SB(5), SB(9)];
  var T_43 = [GAG, STATION.leave[0]];
  var T_TURN = [SB(11), STATION.leave[0]];
  var T_PUSH = [STATION.leave[0] + 0.2, STATION.leave[0] + 2.6];
  var T_HAT = [SB(5) + 0.4, SB(8) + 0.6];
  var ZF = 0.84;
  var CAM_A = [500, 250];
  var zoomAt = (rb) => keyframes([[T_PULL[0], 1], [T_PULL[1], ZF, ease.inOut], [T_PUSH[0], ZF], [T_PUSH[1], 1, ease.inOut]], rb);
  var pullAt = (Z) => clamp((1 - Z) / (1 - ZF));
  var rawB = (env) => env.gb - env.sec.start;
  function camera(ctx, Z) {
    ctx.translate(CAM_A[0], CAM_A[1]);
    ctx.scale(Z, Z);
    ctx.translate(-CAM_A[0], -CAM_A[1]);
  }
  var toView = (wx, wy, Z) => [CAM_A[0] + (wx - CAM_A[0]) * Z, CAM_A[1] + (wy - CAM_A[1]) * Z];
  var frameNo = (b) => Math.round(b * 1e3);
  var weave = (b) => {
    const q = frameNo(b);
    return [(hash2(q, 1, 801) - 0.5) * 2.2, (hash2(q, 2, 801) - 0.5) * 3.2];
  };
  function flickerAt(b) {
    const q = frameNo(b);
    let f = (hash2(q, 3, 802) - 0.5) * 0.09;
    const r = hash2(q, 4, 802);
    if (r < 0.05) f = 0.13;
    else if (r < 0.08) f = -0.1;
    return f;
  }
  var FILM_W = X_MAX - X_MIN;
  var BASE3 = ROAD_Y - 40;
  var PROP_Y = ROAD_Y - 14;
  var P_CLOUD = 0.05;
  var P_FAR7 = 0.25;
  var P_MID5 = 0.68;
  var P_NEAR2 = 1;
  function skyImg() {
    return baked("s08-sky", 64, 420, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 420);
      g.addColorStop(0, "#e2dbc8");
      g.addColorStop(0.6, "#ebe5d3");
      g.addColorStop(1, "#f1ecdd");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 420);
    });
  }
  function cloudLayer2() {
    return strip("s08-cloud", P_CLOUD, (ctx, x0, x1) => {
      const R = rng("s08-cloud");
      for (let x = x0 + 60; x < x1; x += R.range(380, 640)) {
        const y = R.range(70, 190), w = R.range(220, 380), h = R.range(30, 50);
        ctx.fillStyle = rgba("#f7f2e6", 0.9);
        for (let k = 0; k < 5; k++) {
          ellipse(ctx, x + (k - 2) * w * 0.17, y - k % 2 * h * 0.4, w * 0.2, h * (0.7 + 0.3 * (k % 2)));
          ctx.fill();
        }
        ctx.fillStyle = rgba("#d9d2bf", 0.6);
        ellipse(ctx, x, y + h * 0.55, w * 0.42, h * 0.2);
        ctx.fill();
      }
    }, { y0: 0, y1: 300 });
  }
  function farLayer6() {
    return strip("s08-far", P_FAR7, (ctx, x0, x1) => {
      const R = rng("s08-far");
      const C = ["#d6cebb", "#cfc7b3", "#dbd4c2"];
      for (let x = x0 - 60; x < x1; ) {
        const w = R.range(80, 200), top = R.range(170, 360);
        ctx.fillStyle = R.pick(C);
        ctx.fillRect(x, top, w, 720 - top);
        const kind = R();
        if (kind < 0.22) {
          poly(ctx, [[x - 6, top], [x + w / 2, top - w * 0.35], [x + w + 6, top]]);
          ctx.fill();
        } else if (kind < 0.32) {
          ctx.beginPath();
          ctx.arc(x + w / 2, top, w * 0.32, Math.PI, 0);
          ctx.fill();
          ctx.fillRect(x + w / 2 - 2, top - w * 0.32 - 26, 4, 26);
        } else if (kind < 0.42) {
          const tx = x + w * 0.3;
          ctx.fillRect(tx, top - 60, 50, 44);
          poly(ctx, [[tx - 4, top - 60], [tx + 25, top - 84], [tx + 54, top - 60]]);
          ctx.fill();
          ctx.fillRect(tx + 6, top - 16, 3, 16);
          ctx.fillRect(tx + 41, top - 16, 3, 16);
        }
        for (let k = 0; k < R.int(0, 2); k++) {
          const cx = x + R.range(10, w - 20);
          ctx.fillRect(cx, top - R.range(20, 40), 12, 40);
        }
        ctx.fillStyle = rgba("#a89f8c", 0.35);
        for (let yy = top + 24; yy < 700; yy += 34) for (let xx = x + 12; xx < x + w - 14; xx += 24) if (R() < 0.6) ctx.fillRect(xx, yy, 9, 14);
        x += w + R.range(-24, 8);
      }
      const g = ctx.createLinearGradient(0, 300, 0, 720);
      g.addColorStop(0, rgba("#efe9d8", 0));
      g.addColorStop(1, rgba("#efe9d8", 0.75));
      ctx.fillStyle = g;
      ctx.fillRect(x0, 300, x1 - x0, 420);
    }, { y0: 80, y1: 720 });
  }
  function awning(ctx, x, y, w, h, dark, light) {
    const n = Math.max(4, Math.round(w / 28)), sw = w / n;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? light : dark;
      poly(ctx, [[x + i * sw, y], [x + (i + 1) * sw, y], [x + (i + 1) * sw + 6, y + h], [x + i * sw + 6, y + h]]);
      ctx.fill();
    }
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i % 2 ? light : dark;
      ctx.beginPath();
      ctx.arc(x + i * sw + sw / 2 + 6, y + h, sw / 2, 0, Math.PI);
      ctx.fill();
    }
    ctx.strokeStyle = G1;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
    ctx.stroke();
    ctx.fillStyle = rgba(G0, 0.12);
    ctx.fillRect(x + 6, y + h + sw / 2, w, 22);
  }
  function upperWindow(ctx, x, y, w, h, R) {
    ctx.fillStyle = G6;
    ctx.fillRect(x - 6, y - 8, w + 12, h + 18);
    ctx.fillStyle = G2;
    ctx.fillRect(x, y, w, h);
    if (R() < 0.6) {
      ctx.fillStyle = G5;
      const cw = w * R.range(0.25, 0.45);
      ctx.fillRect(x, y, cw, h);
      ctx.fillRect(x + w - cw * 0.6, y, cw * 0.6, h);
    }
    ctx.fillStyle = rgba(G6, 0.35);
    poly(ctx, [[x + w * 0.5, y], [x + w * 0.75, y], [x + w * 0.35, y + h], [x + w * 0.1, y + h]]);
    ctx.fill();
    ctx.strokeStyle = G6;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y + h);
    ctx.moveTo(x, y + h * 0.42);
    ctx.lineTo(x + w, y + h * 0.42);
    ctx.stroke();
    ctx.fillStyle = G4;
    ctx.fillRect(x - 10, y + h + 6, w + 20, 7);
    ctx.strokeStyle = rgba(G1, 0.6);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
  }
  function building(ctx, x, w, top, R) {
    const face = R.pick(["#d9d1bd", "#cfc6b1", "#e0d9c6", "#c7bea9"]);
    ctx.fillStyle = face;
    ctx.fillRect(x, top, w, BASE3 - top);
    ctx.strokeStyle = rgba(G3, 0.22);
    ctx.lineWidth = 1;
    for (let y = top + 30; y < BASE3 - 200; y += 18) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y);
      ctx.stroke();
    }
    ctx.fillStyle = G4;
    ctx.fillRect(x - 8, top - 4, w + 16, 22);
    ctx.fillStyle = G7;
    ctx.fillRect(x - 8, top - 4, w + 16, 5);
    ctx.fillStyle = rgba(G1, 0.35);
    ctx.fillRect(x - 4, top + 18, w + 8, 5);
    for (let dx = 8; dx < w; dx += 22) {
      ctx.fillStyle = G3;
      ctx.fillRect(x + dx, top + 18, 8, 9);
    }
    const cols = Math.max(2, Math.floor((w - 40) / 90)), floors = Math.floor((BASE3 - 250 - top - 40) / 120);
    const ww = 46, gap = (w - cols * ww) / (cols + 1);
    for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) upperWindow(ctx, x + gap + c * (ww + gap), top + 56 + f * 120, ww, 74, R);
    const sy = BASE3 - 238;
    ctx.fillStyle = G6;
    ctx.fillRect(x + 14, sy, w - 28, 40);
    ctx.strokeStyle = G1;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x + 14, sy, w - 28, 40);
    ctx.strokeStyle = rgba(G2, 0.7);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + 20, sy + 6, w - 40, 28);
    awning(ctx, x + 10, sy + 48, w - 26, 42, G2, G6);
    const doorW = 56, doorX = R() < 0.5 ? x + 26 : x + w - 26 - doorW;
    const winX0 = doorX === x + 26 ? doorX + doorW + 14 : x + 26, winX1 = doorX === x + 26 ? x + w - 26 : doorX - 14;
    ctx.fillStyle = G1;
    ctx.fillRect(winX0 - 4, BASE3 - 140, winX1 - winX0 + 8, 136);
    ctx.fillStyle = G3;
    ctx.fillRect(winX0, BASE3 - 136, winX1 - winX0, 112);
    ctx.fillStyle = rgba(G6, 0.45);
    for (let k = 0; k < 2; k++) {
      const px = winX0 + (winX1 - winX0) * (0.2 + 0.4 * k);
      poly(ctx, [[px, BASE3 - 136], [px + 30, BASE3 - 136], [px - 20, BASE3 - 24], [px - 50, BASE3 - 24]]);
      ctx.fill();
    }
    ctx.fillStyle = G4;
    ctx.fillRect(winX0 - 6, BASE3 - 24, winX1 - winX0 + 12, 24);
    ctx.fillStyle = rgba(G1, 0.5);
    for (let px = winX0 + 20; px < winX1 - 20; px += R.range(36, 60)) {
      const hh = R.range(20, 50);
      roundRect(ctx, px, BASE3 - 24 - hh, R.range(10, 22), hh, 4);
      ctx.fill();
    }
    ctx.fillStyle = G1;
    ctx.fillRect(doorX, BASE3 - 150, doorW, 150);
    ctx.fillStyle = G3;
    ctx.fillRect(doorX + 8, BASE3 - 140, doorW - 16, 60);
    ctx.fillStyle = G6;
    circle(ctx, doorX + doorW - 12, BASE3 - 70, 3.5);
    ctx.fill();
    ctx.fillStyle = rgba(G7, 0.6);
    ctx.fillRect(x, top + 20, 6, BASE3 - top - 20);
    ctx.fillStyle = rgba(G2, 0.35);
    ctx.fillRect(x + w - 6, top + 20, 6, BASE3 - top - 20);
  }
  function midLayer5() {
    return strip("s08-mid", P_MID5, (ctx, x0, x1) => {
      const R = rng("s08-mid");
      for (let x = x0 - 40; x < x1; ) {
        const w = R.range(250, 400), top = R.range(170, 300);
        building(ctx, x, w, top, R);
        x += w;
        if (R() < 0.3) {
          const gw = R.range(40, 70);
          ctx.fillStyle = "#e4ddcb";
          ctx.fillRect(x, 330, gw, BASE3 - 330);
          ctx.fillStyle = rgba(G3, 0.4);
          ctx.fillRect(x, BASE3 - 60, gw, 60);
          x += gw;
        }
      }
    }, { y0: 140, y1: BASE3 + 2 });
  }
  function lampPost(ctx, x) {
    ctx.fillStyle = G1;
    ctx.fillRect(x - 5, 360, 10, PROP_Y - 360);
    poly(ctx, [[x - 18, PROP_Y], [x + 18, PROP_Y], [x + 11, PROP_Y - 46], [x - 11, PROP_Y - 46]]);
    ctx.fill();
    ctx.fillRect(x - 9, 560, 18, 12);
    ctx.fillRect(x - 8, 700, 16, 10);
    ctx.fillStyle = G0;
    poly(ctx, [[x - 22, 330], [x + 22, 330], [x + 14, 300], [x - 14, 300]]);
    ctx.fill();
    ctx.fillStyle = G6;
    poly(ctx, [[x - 18, 330], [x + 18, 330], [x + 14, 380], [x - 14, 380]]);
    ctx.fill();
    ctx.strokeStyle = G0;
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 16, 330, 32, 50);
    ctx.beginPath();
    ctx.moveTo(x, 330);
    ctx.lineTo(x, 380);
    ctx.stroke();
    ctx.fillStyle = G0;
    ctx.fillRect(x - 18, 380, 36, 8);
    ctx.beginPath();
    ctx.arc(x, 300, 7, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 26, 420, 52, 5);
  }
  function bench(ctx, x) {
    ctx.fillStyle = G1;
    const y = PROP_Y - 52;
    for (const dx of [-62, 62]) {
      ctx.fillRect(x + dx - 4, y, 8, 52);
    }
    ctx.fillStyle = G2;
    for (let k = 0; k < 3; k++) ctx.fillRect(x - 80, y - 54 + k * 16, 160, 9);
    ctx.fillRect(x - 84, y, 168, 10);
    ctx.fillStyle = G1;
    ctx.fillRect(x - 84, y + 10, 168, 4);
  }
  function hydrant(ctx, x) {
    ctx.fillStyle = G1;
    const y = PROP_Y - 56;
    roundRect(ctx, x - 14, y, 28, 52, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y + 2, 15, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 24, y + 16, 48, 10);
    ctx.fillRect(x - 18, y + 50, 36, 6);
    ctx.fillStyle = G4;
    ctx.fillRect(x - 10, y + 2, 3, 46);
  }
  function pillarBox(ctx, x) {
    const y = PROP_Y - 106;
    ctx.fillStyle = G1;
    roundRect(ctx, x - 22, y, 44, 104, 6);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 26, 14, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = G0;
    ctx.fillRect(x - 14, y + 26, 28, 5);
    ctx.fillStyle = G3;
    ctx.fillRect(x - 17, y + 2, 3, 98);
    ctx.fillStyle = G0;
    ctx.fillRect(x - 26, y + 98, 52, 8);
  }
  function nearLayer2(gc) {
    return strip(`s08-near|${Math.round(gc)}`, P_NEAR2, (ctx, x0, x1) => {
      const R = rng("s08-near");
      ctx.fillStyle = "#dad3c0";
      ctx.fillRect(x0, BASE3 - 2, x1 - x0, 860 - BASE3 + 2);
      ctx.strokeStyle = rgba(G3, 0.6);
      ctx.lineWidth = 1.5;
      for (let x = x0; x < x1; x += 84) {
        ctx.beginPath();
        ctx.moveTo(x, BASE3);
        ctx.lineTo(x - 30, 856);
        ctx.stroke();
      }
      for (const yy of [784, 820]) {
        ctx.beginPath();
        ctx.moveTo(x0, yy);
        ctx.lineTo(x1, yy);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(G2, 0.25);
      ctx.fillRect(x0, BASE3 - 2, x1 - x0, 6);
      ctx.fillStyle = "#e6e0ce";
      ctx.fillRect(x0, 856, x1 - x0, 10);
      ctx.fillStyle = G2;
      ctx.fillRect(x0, 866, x1 - x0, 6);
      ctx.fillStyle = "#c3baa6";
      ctx.fillRect(x0, 872, x1 - x0, 140);
      for (let row = 0, y = 880; y < 1010; row++) {
        const h = 9 + row * 2.4, w = h * 2.1;
        for (let x = x0 - row % 2 * w * 0.5; x < x1; x += w + 3) {
          ctx.fillStyle = mix("#cdc5b1", "#b3aa96", hash2(Math.round(x), row, 803));
          ellipse(ctx, x + w / 2, y + h / 2, w / 2, h / 2);
          ctx.fill();
        }
        y += h + 3;
      }
      ctx.fillStyle = "#e8e2d0";
      ctx.fillRect(x0, 930, x1 - x0, 4);
      ctx.fillRect(x0, 968, x1 - x0, 5);
      ctx.fillStyle = rgba(G1, 0.5);
      ctx.fillRect(x0, 934, x1 - x0, 2);
      ctx.fillRect(x0, 973, x1 - x0, 2);
      const gx = CHAR_X + gc;
      const free = (x, r) => Math.abs(x - gx) > r;
      for (let x = x0 + 120; x < x1; x += R.range(620, 820)) if (free(x, 230)) lampPost(ctx, x);
      const R2 = rng("s08-near-props");
      for (let x = x0 + 420; x < x1; x += R2.range(520, 900)) {
        if (!free(x, 260)) continue;
        const k = R2();
        if (k < 0.4) bench(ctx, x);
        else if (k < 0.7) hydrant(ctx, x);
        else pillarBox(ctx, x);
      }
    }, { y0: 280, y1: 1010 });
  }
  function rollingHat(ctx, b) {
    if (b < T_HAT[0] || b > T_HAT[1]) return;
    const t = (b - T_HAT[0]) / (T_HAT[1] - T_HAT[0]);
    const x = lerp(X_MAX + 80, X_MIN - 120, t);
    const hop = Math.abs(Math.sin(t * TAU * 3.2)) * 26;
    const y = 896 - hop;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-t * TAU * 2.6);
    ctx.fillStyle = G0;
    ellipse(ctx, 0, 14, 46, 11);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, 10, 30, 36, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = G2;
    ctx.fillRect(-30, 2, 60, 7);
    ctx.fillStyle = rgba(G6, 0.6);
    ellipse(ctx, -12, -12, 7, 12, -0.4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba(G0, 0.18);
    ellipse(ctx, x, 908, 40 - hop * 0.4, 6);
    ctx.fill();
  }
  function drawFilm(ctx, b, env) {
    const cam = env.cam;
    const gc = env.camAt(GAG);
    const [wx, wy] = weave(b);
    ctx.save();
    ctx.translate(wx, wy);
    ctx.drawImage(skyImg(), X_MIN - 10, -10, FILM_W + 20, 440);
    drawStrip(ctx, cloudLayer2(), cam);
    drawStrip(ctx, farLayer6(), cam);
    drawStrip(ctx, midLayer5(), cam);
    drawStrip(ctx, nearLayer2(gc), cam);
    rollingHat(ctx, b);
    ctx.restore();
  }
  var SCRATCHES = (() => {
    const R = rng("s08-scratch");
    const out = [];
    for (let i = 0; i < 46; i++) {
      const s = R.range(-2.5, 16.6), L = R.range(0.5, 2.6);
      const full = R() < 0.65;
      out.push({
        s,
        e: s + L,
        x: R.range(X_MIN + 30, X_MAX - 30),
        drift: R.range(-90, 90),
        w: R.range(0.9, 2.8),
        light: R() < 0.62,
        y0: full ? -10 : R.range(0, 500),
        y1: full ? 1010 : R.range(480, 1010),
        bend: R.range(-8, 8)
      });
    }
    return out;
  })();
  function drawScratches(ctx, b) {
    const q = frameNo(b);
    SCRATCHES.forEach((S, i) => {
      if (b < S.s || b >= S.e) return;
      if (hash2(q, i, 804) < 0.18) return;
      const t = (b - S.s) / (S.e - S.s);
      const x = S.x + S.drift * t + (hash2(q, i, 805) - 0.5) * 5;
      ctx.strokeStyle = S.light ? rgba(LIGHT, 0.75) : rgba(G0, 0.5);
      ctx.lineWidth = S.w;
      ctx.beginPath();
      ctx.moveTo(x, S.y0);
      ctx.quadraticCurveTo(x + S.bend, (S.y0 + S.y1) / 2, x + S.bend * 0.4, S.y1);
      ctx.stroke();
    });
    const n = Math.floor(hash2(q, 9, 806) * 3);
    for (let k = 0; k < n; k++) {
      const x = lerp(X_MIN + 40, X_MAX - 40, hash2(q, k, 807)), y = hash2(q, k, 808) * 800, L = 60 + hash2(q, k, 809) * 240;
      ctx.strokeStyle = hash2(q, k, 810) < 0.5 ? rgba(LIGHT, 0.6) : rgba(G0, 0.4);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (hash2(q, k, 811) - 0.5) * 10, y + L);
      ctx.stroke();
    }
  }
  function drawDust(ctx, b) {
    const q = frameNo(b);
    const n = 3 + Math.floor(hash2(q, 1, 812) * 6);
    for (let k = 0; k < n; k++) {
      const x = lerp(X_MIN + 20, X_MAX - 20, hash2(q, k, 813)), y = lerp(20, 980, hash2(q, k, 814));
      const kind = hash2(q, k, 815), r = 1.5 + hash2(q, k, 816) * 5;
      if (kind < 0.45) {
        ctx.fillStyle = rgba(G0, 0.75);
        ctx.beginPath();
        for (let j = 0; j < 6; j++) {
          const a = j / 6 * TAU, rr = r * (0.6 + 0.6 * hash2(q * 7 + k, j, 817));
          j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        }
        ctx.closePath();
        ctx.fill();
      } else if (kind < 0.75) {
        ctx.fillStyle = rgba(LIGHT, 0.85);
        circle(ctx, x, y, r * 0.7);
        ctx.fill();
      } else {
        const L = 30 + r * 12, a = hash2(q, k, 818) * TAU;
        ctx.strokeStyle = rgba(G0, 0.65);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x + Math.cos(a) * L, y + Math.sin(a) * L, x + Math.cos(a + 2) * L, y + Math.sin(a + 2) * L, x + Math.cos(a + 1) * L * 0.8, y + Math.sin(a + 1) * L * 0.8);
        ctx.stroke();
      }
    }
  }
  function leaderBlip(ctx, x, y, r, sweep, alpha) {
    ctx.save();
    ctx.strokeStyle = rgba(G0, alpha);
    ctx.lineWidth = Math.max(1.5, r * 0.08);
    circle(ctx, x, y, r);
    ctx.stroke();
    circle(ctx, x, y, r * 0.78);
    ctx.stroke();
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - r * 1.25, y);
    ctx.lineTo(x + r * 1.25, y);
    ctx.moveTo(x, y - r * 1.25);
    ctx.lineTo(x, y + r * 1.25);
    ctx.stroke();
    ctx.fillStyle = rgba(G0, alpha * 0.45);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 0.78, -Math.PI / 2, -Math.PI / 2 + sweep);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  function drawBlips(ctx, b) {
    const q = frameNo(b);
    if (hash2(q, 1, 819) < 0.09) {
      const x = lerp(X_MIN + 120, X_MAX - 120, hash2(q, 2, 819)), y = lerp(80, 560, hash2(q, 3, 819));
      leaderBlip(ctx, x, y, 22 + hash2(q, 4, 819) * 26, hash2(q, 5, 819) * TAU, 0.55);
    }
    for (const cb of [SB(14), SB(15)]) {
      if (b >= cb && b < cb + 0.22) {
        const x = X_MAX - 150, y = 120;
        ctx.fillStyle = rgba(LIGHT, 0.7);
        circle(ctx, x, y, 34);
        ctx.fill();
        ctx.fillStyle = rgba(G0, 0.85);
        circle(ctx, x, y, 27);
        ctx.fill();
        ctx.fillStyle = rgba(G2, 0.6);
        circle(ctx, x - 6, y - 7, 9);
        ctx.fill();
      }
    }
  }
  function vignetteImg() {
    return baked("s08-vignette", 480, 270, (ctx) => {
      const g = ctx.createRadialGradient(240, 128, 40, 240, 135, 300);
      g.addColorStop(0, rgba(LIGHT, 0.1));
      g.addColorStop(0.45, rgba(G0, 0));
      g.addColorStop(0.8, rgba(G0, 0.16));
      g.addColorStop(1, rgba(G0, 0.42));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 480, 270);
    });
  }
  function drawFilmFX(ctx, b) {
    ctx.drawImage(vignetteImg(), X_MIN, 0, FILM_W, 1e3);
    drawScratches(ctx, b);
    drawDust(ctx, b);
    drawBlips(ctx, b);
    const f = flickerAt(b);
    ctx.save();
    if (f < 0) {
      ctx.fillStyle = rgba(G0, -f);
      ctx.fillRect(X_MIN - 10, -10, FILM_W + 20, 1020);
    } else if (f > 0) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = rgba("#fff4d8", f * 0.55);
      ctx.fillRect(X_MIN - 10, -10, FILM_W + 20, 1020);
    }
    ctx.restore();
  }
  function grainTile(i) {
    return memo(`s08-grain|${i}`, () => {
      const S = 256, c = makeCanvas(S, S), g = c.getContext("2d");
      const im = g.createImageData(S, S);
      const R = rng("s08-grain", i);
      for (let p = 0; p < S * S; p++) {
        const v = R();
        if (v < 0.22) {
          const l = R() < 0.5 ? 20 : 250;
          im.data[p * 4] = l;
          im.data[p * 4 + 1] = l * 0.96;
          im.data[p * 4 + 2] = l * 0.86;
          im.data[p * 4 + 3] = 20 + R() * 46;
        }
      }
      g.putImageData(im, 0, 0);
      return c;
    });
  }
  function drawGrain(ctx, b, x0 = X_MIN, x1 = X_MAX) {
    const q = frameNo(b);
    const pat = ctx.createPattern(grainTile(Math.floor(hash2(q, 1, 820) * 4)), "repeat");
    ctx.save();
    ctx.translate(hash2(q, 2, 820) * 240, hash2(q, 3, 820) * 240);
    ctx.fillStyle = pat;
    ctx.fillRect(x0 - 260, -260, x1 - x0 + 520, 1520);
    ctx.restore();
  }
  var TH = { x0: -700, y0: -110, x1: 1700, y1: 1300 };
  var MASK = 14;
  function velvet(ctx, x, y, w, h, { period = 42, litSide = 0 } = {}) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    const n = Math.max(8, Math.round(w / period * 6));
    for (let i = 0; i <= n; i++) {
      const t = i / n, ph = t * w / period;
      const v2 = 0.5 + 0.5 * Math.sin(ph * TAU);
      const lit = litSide ? Math.pow(litSide > 0 ? t : 1 - t, 2.2) : 0;
      g.addColorStop(t, mix(mix(VELVET_D, VELVET_L, v2 * 0.85), "#e0705a", lit * 0.45 * v2));
    }
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
    const v = ctx.createLinearGradient(0, y, 0, y + h);
    v.addColorStop(0, rgba("#1a0506", 0.45));
    v.addColorStop(0.25, rgba("#1a0506", 0));
    v.addColorStop(0.85, rgba("#1a0506", 0.1));
    v.addColorStop(1, rgba("#1a0506", 0.55));
    ctx.fillStyle = v;
    ctx.fillRect(x, y, w, h);
  }
  function theaterImg() {
    const { x0, y0, x1, y1 } = TH;
    return baked("s08-theater", (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-x0, -y0);
      ctx.fillStyle = WALL;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.save();
      ctx.shadowColor = "rgba(255,238,200,0.5)";
      ctx.shadowBlur = 140 * K;
      ctx.fillStyle = "#6a5a48";
      ctx.fillRect(X_MIN, 0, FILM_W, 1e3);
      ctx.shadowColor = "rgba(255,238,200,0.35)";
      ctx.shadowBlur = 50 * K;
      ctx.fillRect(X_MIN, 0, FILM_W, 1e3);
      ctx.restore();
      const sy = 1e3 + MASK;
      ctx.fillStyle = "#3a2a20";
      ctx.fillRect(x0, sy, x1 - x0, 90);
      const g = ctx.createLinearGradient(0, sy, 0, sy + 90);
      g.addColorStop(0, rgba("#a07a52", 0.85));
      g.addColorStop(0.12, rgba("#6a4c34", 0.6));
      g.addColorStop(1, rgba("#1a1210", 0.4));
      ctx.fillStyle = g;
      ctx.fillRect(x0, sy, x1 - x0, 90);
      ctx.fillStyle = NIGHT;
      ctx.fillRect(x0, sy + 90, x1 - x0, y1 - sy - 90);
      velvet(ctx, x0, y0, X_MIN - MASK - x0 + 2, 1140 - y0, { litSide: 1 });
      velvet(ctx, X_MAX + MASK - 2, y0, x1 - X_MAX - MASK + 2, 1140 - y0, { litSide: -1 });
      for (const [a, c] of [[x0, X_MIN - MASK], [X_MAX + MASK, x1]]) {
        ctx.fillStyle = rgba("#12090a", 0.5);
        for (let x = a; x < c; x += 42) {
          ctx.beginPath();
          ctx.ellipse(x + 21, 1140, 24, 10, 0, 0, Math.PI);
          ctx.fill();
        }
      }
      const vy = -18;
      const val = new Path2D();
      val.moveTo(x0, y0);
      val.lineTo(x1, y0);
      val.lineTo(x1, vy - 14);
      for (let x = x1; x > x0; x -= 120) val.quadraticCurveTo(x - 60, vy + 6, x - 120, vy - 14);
      val.closePath();
      ctx.save();
      ctx.clip(val);
      velvet(ctx, x0, y0, x1 - x0, vy - y0 + 10, { period: 60 });
      ctx.restore();
      ctx.strokeStyle = GOLD2;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, vy - 14);
      for (let x = x1; x > x0; x -= 120) ctx.quadraticCurveTo(x - 60, vy + 6, x - 120, vy - 14);
      ctx.stroke();
      ctx.strokeStyle = rgba(GOLD2, 0.8);
      ctx.lineWidth = 2;
      for (let x = x0; x < x1; x += 120) {
        ctx.beginPath();
        ctx.moveTo(x, vy - 50);
        ctx.lineTo(x + 120, vy - 50);
        ctx.stroke();
      }
      const m = new Path2D();
      m.rect(X_MIN - MASK, -MASK, FILM_W + 2 * MASK, 1e3 + 2 * MASK);
      m.rect(X_MIN, 0, FILM_W, 1e3);
      ctx.fillStyle = "#0c0a09";
      ctx.fill(m, "evenodd");
      ctx.strokeStyle = rgba("#8a7a62", 0.5);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(X_MIN - MASK, -MASK, FILM_W + 2 * MASK, 1e3 + 2 * MASK);
    });
  }
  function drawTheater(ctx) {
    const { x0, y0, x1, y1 } = TH;
    ctx.drawImage(theaterImg(), x0, y0, x1 - x0, y1 - y0);
  }
  function drawBeam(ctx, b, amt, Z) {
    if (amt <= 0.01) return;
    const [ax, ay] = [500, -380];
    const [lx, ty] = toView(X_MIN, 0, Z), [rx, by] = toView(X_MAX, 1e3, Z);
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rays = [[0.08, 0.2, 0.05], [0.3, 0.42, 0.035], [0.55, 0.62, 0.05], [0.74, 0.9, 0.04], [0.2, 0.8, 0.025]];
    for (const [u0, u1, a] of rays) {
      const g = ctx.createLinearGradient(0, ay, 0, by);
      g.addColorStop(0, rgba(LIGHT, a * 1.6 * amt));
      g.addColorStop(0.45, rgba(LIGHT, a * amt));
      g.addColorStop(1, rgba(LIGHT, 0));
      ctx.fillStyle = g;
      poly(ctx, [[ax - 20, ay], [ax + 20, ay], [lerp(lx, rx, u1), by], [lerp(lx, rx, u0), by]]);
      ctx.fill();
    }
    for (let i = 0; i < 40; i++) {
      const u = hash2(i, 1, 821), v = (hash2(i, 2, 821) + b * 0.03 * (0.4 + hash2(i, 3, 821))) % 1;
      const y = lerp(ty - 30, by - 60, v);
      const x = lerp(ax, lerp(lx, rx, u), clamp((y - ay) / (by - ay))) + Math.sin(b * 0.8 + i) * 8;
      const tw = Math.max(0, Math.sin(b * 2.2 + i * 1.7));
      if (tw < 0.1) continue;
      ctx.fillStyle = rgba("#fff2cc", 0.55 * tw * amt);
      circle(ctx, x, y, 1.4 + hash2(i, 4, 821) * 1.6);
      ctx.fill();
    }
    ctx.restore();
  }
  var ROWS2 = [
    { y: 860, r: 32, seatY: 902, seatW: 118, people: [
      { x: -330, t: "bob" },
      { x: -175, t: "cap" },
      { x: -20, t: "bald" },
      { x: 132, t: "bun" },
      { x: 290, t: "afro" },
      { x: 690, t: "pony" },
      { x: 842, t: "bowler" },
      { x: 1e3, t: "bob" },
      { x: 1150, t: "cap" },
      { x: 1300, t: "bun" }
    ] },
    { y: 932, r: 50, seatY: 990, seatW: 190, people: [
      { x: -380, t: "bowler" },
      { x: -160, t: "bun" },
      { x: 60, t: "cap" },
      { x: 270, t: "kid" },
      { x: 470, t: "glasses" },
      { x: 680, t: "popcorn" },
      { x: 900, t: "pony" },
      { x: 1110, t: "afro" },
      { x: 1330, t: "bald" }
    ] }
  ];
  function ell(P2, x, y, rx, ry, rot = 0, a0 = 0, a1 = TAU) {
    P2.moveTo(x + Math.cos(rot) * Math.cos(a0) * rx - Math.sin(rot) * Math.sin(a0) * ry, y + Math.sin(rot) * Math.cos(a0) * rx + Math.cos(rot) * Math.sin(a0) * ry);
    P2.ellipse(x, y, rx, ry, rot, a0, a1);
    P2.closePath();
  }
  function personShapes(x, y, r, t, front, b) {
    const body = new Path2D();
    body.moveTo(x - r * 1.55, y + r * 3.4);
    body.bezierCurveTo(x - r * 1.6, y + r * 1.4, x - r * 0.9, y + r * 1.15, x - r * 0.38, y + r * 0.95);
    body.lineTo(x - r * 0.36, y + r * 0.6);
    body.lineTo(x + r * 0.36, y + r * 0.6);
    body.lineTo(x + r * 0.38, y + r * 0.95);
    body.bezierCurveTo(x + r * 0.9, y + r * 1.15, x + r * 1.6, y + r * 1.4, x + r * 1.55, y + r * 3.4);
    body.closePath();
    const head = new Path2D();
    ell(head, x, y, r * 0.86, r, 0, 0, TAU);
    for (const s of [-1, 1]) ell(head, x + s * r * 0.86, y + r * 0.08, r * 0.17, r * 0.27, 0, 0, TAU);
    const extra = new Path2D();
    if (t === "bun") ell(extra, x + (front ? 0 : r * 0.12), y - r * 1, r * 0.42, r * 0.36, 0, 0, TAU);
    if (t === "afro") ell(extra, x, y - r * 0.18, r * 1.3, r * 1.15, 0, 0, TAU);
    if (t === "bob") ell(extra, x, y - r * 0.1, r * 1.04, r * 1.06, 0, 0, TAU);
    if (t === "cap") {
      ell(extra, x, y - r * 0.55, r * 0.98, r * 0.55, 0, Math.PI, 0);
      if (front) ell(extra, x, y - r * 0.5, r * 1.18, r * 0.2, 0, 0, Math.PI);
      else extra.rect(x - r * 0.98, y - r * 0.58, r * 1.96, r * 0.14);
    }
    if (t === "bowler") {
      ell(extra, x, y - r * 0.6, r * 0.8, r * 0.75, 0, Math.PI, 0);
      ell(extra, x, y - r * 0.58, r * 1.25, r * 0.16, 0, 0, TAU);
    }
    if (t === "kid") {
      for (const s of [-1, 1]) ell(extra, x + s * r * 1.02, y - r * 0.35, r * 0.34, r * 0.24, s * 0.5, 0, TAU);
      ell(extra, x, y - r * 1.05, r * 0.42, r * 0.22, 0, 0, TAU);
    }
    if (t === "pony" && !front) {
      extra.moveTo(x - r * 0.12, y - r * 0.2);
      extra.quadraticCurveTo(x + r * 0.05, y + r * 1.4, x - r * 0.05, y + r * 1.9);
      extra.quadraticCurveTo(x + r * 0.35, y + r * 1.2, x + r * 0.2, y - r * 0.2);
      extra.closePath();
    }
    if (t === "pony" && front) ell(extra, x - r * 0.95, y + r * 0.6, r * 0.22, r * 0.5, 0.3, 0, TAU);
    const shapes = [body, head, extra];
    let popTop = null;
    if (t === "popcorn") {
      const up = !front && Math.floor(b / 2) % 2 === 1 ? -r * 0.35 : 0;
      const px = x + r * 1.35, py = y + r * 0.9 + up;
      const pop = new Path2D();
      pop.moveTo(px - r * 0.42, py - r * 0.5);
      pop.lineTo(px + r * 0.42, py - r * 0.5);
      pop.lineTo(px + r * 0.3, py + r * 0.6);
      pop.lineTo(px - r * 0.3, py + r * 0.6);
      pop.closePath();
      shapes.push(pop);
      popTop = [px, py - r * 0.5];
    }
    return { shapes, popTop };
  }
  function drawFace(ctx, x, y, r, t) {
    const kid = t === "kid";
    ctx.fillStyle = "#41372f";
    ellipse(ctx, x, y + r * 0.12, r * 0.68, r * 0.8);
    ctx.fill();
    if (t === "bob" || kid) {
      ctx.fillStyle = SIL;
      ctx.beginPath();
      ctx.ellipse(x, y - r * 0.32, r * 0.8, r * 0.45, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(x - r * 0.8, y - r * 0.34, r * 1.6, r * 0.12);
    }
    if (t === "bowler" || t === "cap") {
      ctx.fillStyle = SIL;
      ctx.fillRect(x - r * 0.75, y - r * 0.62, r * 1.5, r * 0.22);
    }
    const ey = y + r * 0.08, ex = r * 0.3, er = kid ? r * 0.2 : r * 0.15;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#f4ead2";
      ellipse(ctx, x + s * ex, ey, er, er * 0.82);
      ctx.fill();
      ctx.fillStyle = SIL;
      circle(ctx, x + s * ex, ey + er * 0.1, er * 0.5);
      ctx.fill();
    }
    if (t === "glasses" || t === "bald") {
      ctx.strokeStyle = rgba("#e8dcbf", 0.9);
      ctx.lineWidth = Math.max(1.4, r * 0.05);
      for (const s of [-1, 1]) {
        circle(ctx, x + s * ex, ey, er * 1.9);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(x - ex + er * 1.9, ey);
      ctx.lineTo(x + ex - er * 1.9, ey);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(SIL, 0.9);
    ctx.lineWidth = Math.max(1.2, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x - r * 0.14, y + r * 0.55);
    ctx.lineTo(x + r * 0.14, y + r * 0.55);
    ctx.stroke();
  }
  function seatRow(ctx, row) {
    const { seatY, seatW } = row;
    ctx.fillStyle = "#141010";
    for (let i = -1; i < 14; i++) {
      const cx = -560 + i * (seatW + 34);
      roundRect(ctx, cx - seatW / 2, seatY, seatW, 200, seatW * 0.22);
      ctx.fill();
    }
  }
  function drawAudience(ctx, b, rb, pull, flick) {
    if (pull <= 1e-3) return;
    const rise = (1 - ease.out(pull)) * 330;
    const front = rb >= T_TURN[0] && rb < T_TURN[1];
    const rim = clamp(pull * (1 + flick * 2.5));
    ctx.save();
    ctx.translate(0, rise);
    ctx.fillStyle = NIGHT;
    ctx.fillRect(X_MIN - 10, 960, X_MAX - X_MIN + 20, 400);
    ROWS2.forEach((row, ri) => {
      const people = row.people.map((P2, i) => {
        const kid = P2.t === "kid";
        const r = kid ? row.r * 0.82 : row.r, y = kid ? row.y + row.r * 0.4 : row.y;
        const x = P2.x + (front ? 0 : (hash2(Math.floor(b * 2), i + ri * 20, 822) - 0.5) * 3);
        return { x, y, r, t: P2.t, ...personShapes(x, y, r, P2.t, front, b) };
      });
      if (rim > 0.01) {
        ctx.save();
        ctx.translate(0, -Math.max(1.6, row.r * 0.07));
        ctx.fillStyle = rgba("#efe2c4", 0.85 * rim);
        for (const P2 of people) for (const p of P2.shapes) ctx.fill(p);
        ctx.restore();
      }
      ctx.fillStyle = SIL;
      for (const P2 of people) for (const p of P2.shapes) ctx.fill(p);
      for (const P2 of people) {
        if (P2.popTop) {
          const [px, py] = P2.popTop;
          ctx.fillStyle = rgba("#efe2c4", 0.85);
          for (let k = 0; k < 5; k++) {
            circle(ctx, px - P2.r * 0.34 + k * P2.r * 0.17, py - P2.r * 0.06 - k % 2 * P2.r * 0.08, P2.r * 0.1);
            ctx.fill();
          }
        }
        if (front) drawFace(ctx, P2.x, P2.y, P2.r, P2.t);
      }
      if (ri === 0) seatRow(ctx, row);
    });
    ctx.restore();
  }
  var BAR_W = (FILM_W - 1e3 * 4 / 3) / 2;
  function barImg(side) {
    return baked(`s08-bar|${side}`, (BAR_W + 30) * K, 1e3 * K, (ctx) => {
      ctx.scale(K, K);
      const inner = side < 0 ? BAR_W : 30;
      ctx.fillStyle = "#0b0a09";
      if (side < 0) ctx.fillRect(0, 0, BAR_W, 1e3);
      else ctx.fillRect(30, 0, BAR_W, 1e3);
      ctx.fillStyle = "#0b0a09";
      ctx.beginPath();
      ctx.moveTo(inner, 0);
      for (let y = 0; y <= 1e3; y += 8) ctx.lineTo(inner + (side < 0 ? 1 : -1) * (2 + 5 * hash2(y, 1, 823)), y);
      ctx.lineTo(inner, 1e3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = rgba("#5a524a", 0.6);
      ctx.lineWidth = 1.6;
      const ex = side < 0 ? BAR_W - 9 : 39;
      ctx.beginPath();
      ctx.moveTo(ex, 0);
      ctx.lineTo(ex, 1e3);
      ctx.stroke();
      const R = rng("s08-bar", side);
      for (let i = 0; i < 520; i++) {
        const x = side < 0 ? R() * BAR_W : 30 + R() * BAR_W, y = R() * 1e3;
        ctx.fillStyle = rgba("#d8d0bc", 0.05 + R() * 0.18);
        circle(ctx, x, y, 0.5 + R() * 1.4);
        ctx.fill();
      }
    });
  }
  function drawBars(ctx, b) {
    const q = frameNo(b);
    ctx.drawImage(barImg(-1), X_MIN - 2, 0, BAR_W + 30, 1e3);
    ctx.drawImage(barImg(1), X_MAX - BAR_W - 30 + 2, 0, BAR_W + 30, 1e3);
    ctx.fillStyle = "#0b0a09";
    ctx.fillRect(X_MIN - 12, -10, 12, 1020);
    ctx.fillRect(X_MAX, -10, 12, 1020);
    const pitch = 66, off = frameNo(b) * 0.37 % pitch;
    for (const [x0] of [[X_MIN + 40], [X_MAX - 40 - 34]]) {
      for (let y = -pitch + off; y < 1e3 + pitch; y += pitch) {
        ctx.fillStyle = rgba("#3a342e", 0.95);
        roundRect(ctx, x0, y, 34, 44, 6);
        ctx.fill();
        ctx.fillStyle = rgba("#b8ae98", 0.35);
        roundRect(ctx, x0 + 3, y + 3, 28, 38, 5);
        ctx.fill();
      }
    }
    for (let k = 0; k < 6; k++) {
      const left = hash2(q, k, 824) < 0.5;
      const x = left ? X_MIN + hash2(q, k, 825) * BAR_W : X_MAX - BAR_W + hash2(q, k, 825) * BAR_W, y = hash2(q, k, 826) * 1e3;
      ctx.fillStyle = rgba("#e8e0cc", 0.5);
      circle(ctx, x, y, 1 + hash2(q, k, 827) * 2.2);
      ctx.fill();
    }
  }
  var inGag43 = (rb) => rb >= T_43[0] && rb < T_43[1];
  var s08 = {
    id: "s08",
    station: ST8,
    quantize: 10,
    // 老胶片：高反差灰阶、微泛黄；外面一圈很淡的暖白「光晕」（像老片的光渗），保证和街景拉得开
    figureStyle: "film",
    figureRim: { color: "#f6efdc", width: 3, alpha: 0.5 },
    freezeBeat: SB(11) + 0.5,
    // Outro 展墙：4:3 画幅 + 观众扭头看向我们
    figureAdjust(b, env) {
      const rb = rawB(env), Z = zoomAt(rb);
      const [wx, wy] = weave(b);
      const [vx, vy] = toView(CHAR_X + wx, ROAD_Y + wy, Z);
      const o = { scale: Z, dx: vx - CHAR_X, dy: vy - ROAD_Y };
      if (rb >= GAG && rb < STATION.leave[0]) o.pose = "stand";
      else if (rb >= STATION.leave[0] && b < STATION.leave[0]) o.pose = "walk";
      return o;
    },
    drawBack(ctx, b, env) {
      const rb = rawB(env), Z = zoomAt(rb);
      ctx.save();
      camera(ctx, Z);
      if (Z < 0.999) drawTheater(ctx);
      ctx.save();
      ctx.beginPath();
      ctx.rect(X_MIN, 0, FILM_W, 1e3);
      ctx.clip();
      drawFilm(ctx, b, env);
      ctx.restore();
      ctx.restore();
    },
    drawFront(ctx, b, env) {
      const rb = rawB(env), Z = zoomAt(rb), pull = pullAt(Z);
      const flick = flickerAt(b);
      ctx.save();
      camera(ctx, Z);
      ctx.save();
      ctx.beginPath();
      ctx.rect(X_MIN, 0, FILM_W, 1e3);
      ctx.clip();
      drawFilmFX(ctx, b);
      ctx.restore();
      ctx.restore();
      if (pull > 1e-3) {
        drawBeam(ctx, b, pull, Z);
        drawAudience(ctx, b, rb, pull, flick);
      }
      if (inGag43(rb)) drawBars(ctx, b);
      drawGrain(ctx, b);
    },
    drawFrame(ctx, R) {
      const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
      ctx.save();
      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, y + h + t * 1.6, w * 0.55, t * 0.5, 0, 0, TAU);
      ctx.fill();
      const band = new Path2D();
      const ext = w * 0.6 + t;
      band.rect(x - t, y - t * 1.45, w + 2 * t + ext, h + t * 2.9);
      band.rect(x, y, w, h);
      ctx.fillStyle = "#15120f";
      ctx.fill(band, "evenodd");
      ctx.fillStyle = "#2c2824";
      ctx.fillRect(x + w + t, y, ext - t * 0.2, h);
      ctx.fillStyle = "rgba(239,233,216,0.06)";
      ctx.fillRect(x + w + t + t * 0.4, y + t * 0.4, ext - t, h - t * 0.8);
      const pw = t * 0.5, ph = t * 0.62, pitch = t * 0.95;
      ctx.fillStyle = "#e9e1cc";
      for (let px = x - t + t * 0.3; px < x + w + t + ext - pw; px += pitch) {
        for (const py of [y - t * 1.45 + t * 0.32, y + h + t * 1.45 - t * 0.32 - ph]) {
          roundRect(ctx, px, py, pw, ph, Math.max(1, t * 0.1));
          ctx.fill();
        }
      }
      ctx.strokeStyle = "rgba(239,233,216,0.55)";
      ctx.lineWidth = Math.max(1, 2 * s);
      ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
      ctx.strokeStyle = "rgba(239,233,216,0.18)";
      ctx.lineWidth = Math.max(1, 1.2 * s);
      for (let i = 0; i < 6; i++) {
        const sx = x - t + (w + 2 * t + ext) * hash2(i, 1, 828);
        ctx.beginPath();
        ctx.moveTo(sx, y - t * 1.45);
        ctx.lineTo(sx + 4 * s, y + h + t * 1.45);
        ctx.stroke();
      }
      ctx.restore();
    },
    cardStyle: {
      ink: CREAM2,
      accent: CREAM2,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        intertitle(ctx, x, y, w, h, true);
      }
    },
    playerStyle: {
      plate: "#14110f",
      ink: CREAM2,
      noteColor: CREAM2,
      backdrop: true,
      palette: { disc: "#efe7d4", shine1: "#ffffff", shine2: "#cfc6b0", accent: "#8a8274", hub: "#f6f0e0", hole: "#2a2622", ink: "#2a2622" },
      plateDraw(ctx, x, y, w, h) {
        intertitle(ctx, x, y, w, h, false);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        filmCD(ctx, cx, cy, s, spin);
      }
    }
  };
  function intertitle(ctx, x, y, w, h, corners) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = "rgba(16,14,12,0.96)";
    ctx.fillRect(x, y, w, h);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = rgba(CREAM2, 0.95);
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
    ctx.strokeStyle = rgba(CREAM2, 0.55);
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 15, y + 15, w - 30, h - 30);
    if (corners) {
      ctx.fillStyle = CREAM2;
      for (const [cx, cy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) {
        poly(ctx, [[cx, cy - 7], [cx + 7, cy], [cx, cy + 7], [cx - 7, cy]]);
        ctx.fill();
      }
      ctx.strokeStyle = rgba(CREAM2, 0.8);
      ctx.lineWidth = 1.5;
      for (const yy of [y + 9, y + h - 9]) {
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 40, yy + (yy < y + h / 2 ? 8 : -8));
        ctx.lineTo(x + w / 2 + 40, yy + (yy < y + h / 2 ? 8 : -8));
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  function filmCD(ctx, cx, cy, s, spin) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    circle(ctx, 0, 0, r);
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      g.addColorStop(0, "#efe7d4");
      g.addColorStop(0.12, "#ffffff");
      g.addColorStop(0.25, "#e6ddc8");
      g.addColorStop(0.5, "#efe7d4");
      g.addColorStop(0.62, "#fbf6ea");
      g.addColorStop(0.75, "#d9cfb9");
      g.addColorStop(1, "#efe7d4");
      ctx.fillStyle = g;
    } else ctx.fillStyle = "#efe7d4";
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = G0;
    ctx.stroke();
    ctx.strokeStyle = rgba(G2, 0.35);
    ctx.lineWidth = 1 * s;
    for (const k of [0.92, 0.84, 0.76]) {
      circle(ctx, 0, 0, r * k);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(G1, 0.8);
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(r * 0.55, -3 * s, 8 * s, 6 * s);
      ctx.restore();
    }
    ctx.fillStyle = G0;
    ellipse(ctx, r * 0.42, 0, 6 * s, 4 * s);
    ctx.fill();
    circle(ctx, 0, 0, r * 0.26);
    ctx.fillStyle = "#f6f0e0";
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = G0;
    ctx.stroke();
    circle(ctx, 0, 0, r * 0.1);
    ctx.fillStyle = G0;
    ctx.fill();
    ctx.restore();
  }

  // src/kit/etch.js
  function grainPattern(ctx, { color = "20,18,30", density = 0.12, size = 256, seed = 7, alpha = 0.35 } = {}) {
    const tile2 = memo(`grain|${color}|${density}|${size}|${seed}|${alpha}`, () => {
      const c = makeCanvas(size, size);
      const x = c.getContext("2d");
      const im = x.createImageData(size, size);
      const R = rng("grain", seed);
      const [r, g, b] = color.split(",").map(Number);
      for (let i = 0; i < size * size; i++) {
        if (R() < density) {
          im.data[i * 4] = r;
          im.data[i * 4 + 1] = g;
          im.data[i * 4 + 2] = b;
          im.data[i * 4 + 3] = 255 * alpha * (0.4 + 0.6 * R());
        }
      }
      x.putImageData(im, 0, 0);
      return c;
    });
    return ctx.createPattern(tile2, "repeat");
  }
  function stipple(ctx, path, { color = "#2b2a3a", tone: tone2 = () => 0.5, density = 0.012, r = 1.4, seed = 5, bounds = [-2e3, -200, 6e3, 1400] } = {}) {
    const [bx, by, bw, bh] = bounds;
    const R = rng("stipple", seed);
    const n = Math.round(bw * bh * density);
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = color;
    for (let i = 0; i < n; i++) {
      const x = bx + R() * bw, y = by + R() * bh;
      if (R() > 1 - tone2(x, y)) continue;
      ctx.beginPath();
      ctx.arc(x, y, r * (0.6 + 0.6 * R()), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // src/scenes/s09.js
  var ST9 = stationByN(9);
  var CREAM3 = "#efe0bf";
  var PAPER6 = "#f4e8cc";
  var RED = "#d0533c";
  var RED_D = "#a63a2a";
  var NAVY = "#2b2a3a";
  var TEAL = "#2f7d6d";
  var MUSTARD = "#e2a93b";
  var P_TENT = 0.35;
  var P_STANDS = 0.55;
  var P_RING = 0.85;
  var P_POLE = 0.92;
  var REG = [3, 2];
  function litho(ctx, path, fill, { line: line2 = 3, stroke = NAVY } = {}) {
    ctx.save();
    ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
    if (line2) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = line2;
      ctx.lineJoin = "round";
      ctx.stroke(path);
    }
  }
  function star(cx, cy, r, n = 5) {
    const p = new Path2D();
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r * 0.45 : r;
      i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    p.closePath();
    return p;
  }
  function grain(ctx, x0, y0, w, h, alpha = 0.35) {
    ctx.save();
    ctx.fillStyle = grainPattern(ctx, { color: "43,42,58", density: 0.1, alpha, seed: 9 });
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
  }
  function tentLayer() {
    return strip("s09-tent", P_TENT, (ctx, x0, x1) => {
      const W2 = 74;
      for (let x = Math.floor(x0 / W2) * W2; x < x1; x += W2) {
        const red = Math.round(x / W2) % 2 === 0;
        const p = new Path2D();
        p.moveTo(x + 6, 120);
        p.quadraticCurveTo(x + 2, 400, x - 4, 720);
        p.lineTo(x + W2 - 4, 720);
        p.quadraticCurveTo(x + W2 + 2, 400, x + W2 + 6, 120);
        p.closePath();
        ctx.fillStyle = red ? RED : PAPER6;
        ctx.fill(p);
      }
      const g = ctx.createLinearGradient(0, 100, 0, 720);
      g.addColorStop(0, rgba(NAVY, 0.55));
      g.addColorStop(0.5, rgba(NAVY, 0.12));
      g.addColorStop(1, rgba(NAVY, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x0, 100, x1 - x0, 620);
      stipple(ctx, (() => {
        const p = new Path2D();
        p.rect(x0, 100, x1 - x0, 300);
        return p;
      })(), { color: NAVY, density: 4e-3, r: 1.6, tone: (x, y) => 1 - (y - 100) / 320, bounds: [x0, 100, x1 - x0, 300] });
      ctx.fillStyle = NAVY;
      ctx.fillRect(x0, 0, x1 - x0, 150);
      const val = new Path2D();
      val.moveTo(x0, 140);
      for (let x = x0; x < x1; x += 90) val.quadraticCurveTo(x + 45, 214, x + 90, 140);
      val.lineTo(x1, 0);
      val.lineTo(x0, 0);
      val.closePath();
      litho(ctx, val, RED_D);
      ctx.strokeStyle = MUSTARD;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0, 140);
      for (let x = x0; x < x1; x += 90) ctx.quadraticCurveTo(x + 45, 214, x + 90, 140);
      ctx.stroke();
      for (let x = x0 + 45; x < x1; x += 90) {
        ctx.strokeStyle = MUSTARD;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, 178);
        ctx.lineTo(x, 214);
        ctx.stroke();
        circle(ctx, x, 218, 7);
        ctx.fillStyle = MUSTARD;
        ctx.fill();
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      const flags = [TEAL, MUSTARD, RED, PAPER6];
      for (const [yy, span, sag] of [[250, 520, 60], [320, 640, 80]]) {
        for (let x = x0 - span / 2 + yy * 3 % span; x < x1; x += span) {
          ctx.strokeStyle = NAVY;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(x, yy);
          ctx.quadraticCurveTo(x + span / 2, yy + sag * 2, x + span, yy);
          ctx.stroke();
          for (let k = 1; k < 12; k++) {
            const t = k / 12, fx = x + span * t, fy = yy + sag * 4 * t * (1 - t);
            const p = new Path2D();
            p.moveTo(fx - 16, fy);
            p.lineTo(fx + 16, fy);
            p.lineTo(fx, fy + 36);
            p.closePath();
            litho(ctx, p, flags[(k + Math.round(x)) % 4], { line: 2 });
          }
        }
      }
      grain(ctx, x0, 0, x1 - x0, 720, 0.3);
    }, { y0: 0, y1: 720 });
  }
  function standsLayer() {
    return strip("s09-stands", P_STANDS, (ctx, x0, x1) => {
      const R = rng("s09-stands");
      for (let row = 0; row < 4; row++) {
        const y = 470 + row * 46;
        const bench2 = new Path2D();
        bench2.rect(x0, y + 26, x1 - x0, 20);
        litho(ctx, bench2, row % 2 ? "#6c4a3a" : "#7d5644", { line: 2 });
        for (let x = x0 + R() * 30; x < x1; x += 34 + R() * 16) {
          if (R() < 0.12) continue;
          const h = 30 + R() * 10;
          const head = new Path2D();
          head.ellipse(x, y + 18 - h * 0.5, 13, 15, 0, 0, Math.PI * 2);
          head.rect(x - 17, y + 20 - h * 0.2, 34, 30);
          ctx.fillStyle = mix(NAVY, "#5d5a7a", 0.2 + 0.4 * R());
          ctx.fill(head);
          if (R() < 0.18) {
            ctx.fillStyle = NAVY;
            ctx.fillRect(x - 15, y - h * 0.5 - 4, 30, 6);
            ctx.fillRect(x - 9, y - h * 0.5 - 20, 18, 18);
          }
        }
      }
      const rail = new Path2D();
      rail.rect(x0, 646, x1 - x0, 16);
      litho(ctx, rail, RED, { line: 2.5 });
      for (let x = x0; x < x1; x += 46) {
        const p = new Path2D();
        p.rect(x, 660, 10, 40);
        litho(ctx, p, MUSTARD, { line: 2 });
      }
      grain(ctx, x0, 440, x1 - x0, 270, 0.25);
    }, { y0: 400, y1: 710 });
  }
  function ringLayer() {
    return strip("s09-ring", P_RING, (ctx, x0, x1) => {
      const R = rng("s09-ring");
      const wall = new Path2D();
      wall.rect(x0, 700, x1 - x0, 98);
      litho(ctx, wall, RED, { line: 3 });
      const band = new Path2D();
      band.rect(x0, 700, x1 - x0, 20);
      litho(ctx, band, NAVY, { line: 0 });
      ctx.fillStyle = MUSTARD;
      ctx.fillRect(x0, 716, x1 - x0, 4);
      for (let x = x0 + 40; x < x1; x += 110) litho(ctx, star(x, 760, 20), MUSTARD, { line: 2 });
      for (let x = x0 + 300; x < x1; x += 760 + R() * 300) {
        const top = new Path2D();
        top.ellipse(x, 640, 70, 18, 0, 0, Math.PI * 2);
        const side = new Path2D();
        side.moveTo(x - 70, 640);
        side.lineTo(x - 70, 700);
        side.ellipse(x, 700, 70, 18, 0, Math.PI, 0, true);
        side.lineTo(x + 70, 640);
        side.closePath();
        litho(ctx, side, TEAL);
        ctx.save();
        ctx.clip(side);
        ctx.fillStyle = PAPER6;
        for (let k = -3; k < 4; k++) ctx.fillRect(x + k * 24 - 6, 640, 12, 80);
        ctx.restore();
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 3;
        ctx.stroke(side);
        litho(ctx, top, MUSTARD);
        litho(ctx, star(x, 676, 16), RED, { line: 2 });
      }
      grain(ctx, x0, 600, x1 - x0, 210, 0.3);
    }, { y0: 600, y1: 810 });
  }
  function poleLayer() {
    return strip("s09-pole", P_POLE, (ctx, x0, x1) => {
      for (let x = x0 + 900; x < x1; x += 1500) {
        const p = new Path2D();
        p.rect(x - 22, 0, 44, 700);
        litho(ctx, p, NAVY, { line: 0 });
        ctx.save();
        ctx.clip(p);
        ctx.strokeStyle = MUSTARD;
        ctx.lineWidth = 12;
        for (let y = -60; y < 760; y += 70) {
          ctx.beginPath();
          ctx.moveTo(x - 30, y);
          ctx.lineTo(x + 30, y + 40);
          ctx.stroke();
        }
        ctx.restore();
        ctx.strokeStyle = NAVY;
        ctx.lineWidth = 3;
        ctx.strokeRect(x - 22, 0, 44, 700);
      }
    }, { y0: 0, y1: 710 });
  }
  function floorLayer2() {
    return strip("s09-floor", 1, (ctx, x0, x1) => {
      const g = ctx.createLinearGradient(0, ROAD_Y, 0, 1e3);
      g.addColorStop(0, "#e9cf98");
      g.addColorStop(1, "#d6b67a");
      ctx.fillStyle = g;
      ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1e3 - ROAD_Y + 2);
      const p = new Path2D();
      p.rect(x0, ROAD_Y, x1 - x0, 200);
      stipple(ctx, p, { color: "#8a6a3a", density: 0.01, r: 1.5, tone: () => 0.45, bounds: [x0, ROAD_Y, x1 - x0, 200] });
      ctx.strokeStyle = PAPER6;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(x0, 905);
      for (let x = x0; x < x1; x += 60) ctx.lineTo(x, 905 + Math.sin(x * 4e-3) * 6);
      ctx.stroke();
      ctx.fillStyle = NAVY;
      ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 5);
      grain(ctx, x0, ROAD_Y, x1 - x0, 200, 0.28);
    }, { y0: ROAD_Y - 4, y1: 1e3 });
  }
  var BALLOON_COLS = [TEAL, MUSTARD, RED, "#7a5aa6"];
  function balloon(ctx, x, y, col, r = 34, sway = 0) {
    const p = new Path2D();
    p.ellipse(x, y, r * 0.86, r, sway, 0, Math.PI * 2);
    litho(ctx, p, col, { line: 2.6 });
    ctx.fillStyle = rgba(PAPER6, 0.75);
    ellipse(ctx, x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.28, -0.5);
    ctx.fill();
    const k = new Path2D();
    k.moveTo(x - 5, y + r - 1);
    k.lineTo(x + 5, y + r - 1);
    k.lineTo(x, y + r + 8);
    k.closePath();
    litho(ctx, k, col, { line: 2 });
  }
  function string(ctx, ax, ay, bx, by, wob = 0) {
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.quadraticCurveTo((ax + bx) / 2 + wob, (ay + by) / 2, bx, by);
    ctx.stroke();
  }
  function clown(ctx, x, b, { reach = 0, laugh = 0, hold = 3 }) {
    const y = ROAD_Y;
    const bob = Math.abs(Math.sin(b * Math.PI)) * 6;
    ctx.save();
    ctx.translate(x, y - bob * 0.3);
    for (const [dx, up] of [[-46, 0], [40, bob]]) {
      const s = new Path2D();
      s.ellipse(dx + 18, -14 - up, 58, 20, 0, 0, Math.PI * 2);
      litho(ctx, s, RED);
    }
    const legs = new Path2D();
    legs.moveTo(-58, -30);
    legs.lineTo(-38, -250);
    legs.lineTo(36, -250);
    legs.lineTo(56, -30);
    legs.lineTo(16, -30);
    legs.lineTo(0, -200);
    legs.lineTo(-18, -30);
    legs.closePath();
    ctx.save();
    ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = PAPER6;
    ctx.fill(legs);
    ctx.clip(legs);
    for (let yy = -260; yy < 0; yy += 44) for (let xx = -80; xx < 80; xx += 44) {
      const d = new Path2D();
      d.moveTo(xx, yy);
      d.lineTo(xx + 22, yy + 22);
      d.lineTo(xx, yy + 44);
      d.lineTo(xx - 22, yy + 22);
      d.closePath();
      ctx.fillStyle = (xx + yy) / 44 % 2 ? RED : TEAL;
      ctx.fill(d);
    }
    ctx.restore();
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 3;
    ctx.stroke(legs);
    const body = new Path2D();
    body.moveTo(-62, -250);
    body.quadraticCurveTo(-74, -340, -50, -400);
    body.lineTo(50, -400);
    body.quadraticCurveTo(76, -340, 62, -250);
    body.closePath();
    litho(ctx, body, TEAL);
    for (const [px, py] of [[0, -360], [0, -320], [0, -280]]) {
      circle(ctx, px, py, 7);
      ctx.fillStyle = MUSTARD;
      ctx.fill();
      ctx.strokeStyle = NAVY;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    const ra = lerp(0.35, -0.95, ease.inOut(reach));
    ctx.save();
    ctx.translate(-52, -380);
    ctx.rotate(ra);
    const arm = new Path2D();
    arm.rect(-14, 0, 28, 150);
    litho(ctx, arm, MUSTARD);
    const glove = new Path2D();
    glove.ellipse(0, 162, 22, 18, 0, 0, Math.PI * 2);
    litho(ctx, glove, PAPER6);
    ctx.restore();
    ctx.save();
    ctx.translate(54, -380);
    ctx.rotate(-0.35 + Math.sin(b * Math.PI) * 0.04);
    const arm2 = new Path2D();
    arm2.rect(-14, -150, 28, 150);
    litho(ctx, arm2, MUSTARD);
    const glove2 = new Path2D();
    glove2.ellipse(0, -162, 20, 18, 0, 0, Math.PI * 2);
    litho(ctx, glove2, PAPER6);
    ctx.restore();
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + k / 8 * Math.PI;
      const p = new Path2D();
      p.ellipse(Math.cos(a) * 52, -402 + Math.sin(a) * 6 + 6, 22, 14, a, 0, Math.PI * 2);
      litho(ctx, p, PAPER6, { line: 2.2 });
    }
    for (const sx of [-1, 1]) {
      const h = new Path2D();
      h.ellipse(sx * 42, -452, 22, 18, sx * 0.4, 0, Math.PI * 2);
      litho(ctx, h, "#e07a2c", { line: 2 });
    }
    const face = new Path2D();
    face.ellipse(0, -458, 40, 46, 0, 0, Math.PI * 2);
    litho(ctx, face, PAPER6);
    ctx.strokeStyle = NAVY;
    ctx.lineWidth = 3;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * 15, -472, 10, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      circle(ctx, sx * 15, -466, 4);
      ctx.fillStyle = NAVY;
      ctx.fill();
    }
    const mouth = new Path2D();
    const open = 6 + laugh * 18;
    mouth.moveTo(-26, -440);
    mouth.quadraticCurveTo(0, -428 + open, 26, -440);
    mouth.quadraticCurveTo(0, -432, -26, -440);
    mouth.closePath();
    litho(ctx, mouth, RED, { line: 2.4 });
    const nose = new Path2D();
    nose.ellipse(0, -452, 11, 10, 0, 0, Math.PI * 2);
    litho(ctx, nose, RED, { line: 2.2 });
    const hat = new Path2D();
    hat.moveTo(-34, -494);
    hat.lineTo(14, -600);
    hat.lineTo(34, -494);
    hat.closePath();
    litho(ctx, hat, MUSTARD);
    ctx.save();
    ctx.clip(hat);
    ctx.fillStyle = RED;
    for (let k = 0; k < 4; k++) ctx.fillRect(-40, -520 - k * 26, 90, 9);
    ctx.restore();
    litho(ctx, (() => {
      const p = new Path2D();
      p.arc(14, -604, 12, 0, Math.PI * 2);
      return p;
    })(), RED, { line: 2.2 });
    ctx.restore();
  }
  var T_REACH = [GAG - 1.5, GAG];
  var T_GIVE = GAG;
  var T_RISE = [GAG + 2.5, GAG + 3.8];
  var T_LAND2 = GAG + 4;
  var T_LET = GAG + 5.2;
  var s09 = {
    id: "s09",
    station: ST9,
    // 深蓝人物站在深蓝观众席前：加一圈米白描边（海报套印的白边），保证反差
    figureRim: { color: CREAM3, width: 6, alpha: 1 },
    figureAdjust(b) {
      if (b >= T_RISE[0] && b < T_LAND2) {
        const up = b < T_RISE[1] ? ease.out((b - T_RISE[0]) / (T_RISE[1] - T_RISE[0])) : 1 - ease.in((b - T_RISE[1]) / (T_LAND2 - T_RISE[1]));
        return { pose: "stand", dy: -150 * up, rotate: Math.sin((b - T_RISE[0]) * 9) * 0.04 * up };
      }
      if (b >= T_LAND2 && b < T_LAND2 + 0.12) return { sx: 1.06, dy: 0 };
      return null;
    },
    drawBack(ctx, b, env) {
      const cam = env.cam;
      drawStrip(ctx, tentLayer(), cam);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const [sx, ph] of [[60, 0], [760, 1.7], [1300, 3.1]]) {
        const ang = Math.sin(b * 0.35 + ph) * 0.35;
        const bx = sx - cam * 0.2, by = 130;
        const ex = bx + Math.sin(ang) * 900, ey = by + Math.cos(ang) * 900;
        const nx = Math.cos(ang) * 190, ny = -Math.sin(ang) * 190;
        const g = ctx.createLinearGradient(bx, by, ex, ey);
        g.addColorStop(0, rgba("#fff6d8", 0.28));
        g.addColorStop(1, rgba("#fff6d8", 0));
        ctx.fillStyle = g;
        poly(ctx, [[bx - 14, by], [bx + 14, by], [ex + nx, ey + ny], [ex - nx, ey - ny]]);
        ctx.fill();
      }
      ctx.restore();
      drawStrip(ctx, standsLayer(), cam);
      drawStrip(ctx, poleLayer(), cam);
      drawStrip(ctx, ringLayer(), cam);
      drawStrip(ctx, floorLayer2(), cam);
      const c5 = env.camAt(T_GIVE);
      const cx = 690 + c5 - cam;
      if (cx > X_MIN - 200 && cx < X_MAX + 200) {
        const reach = smoothstep(T_REACH[0], T_REACH[1], b) * (1 - smoothstep(GAG + 1, GAG + 1.5, b));
        const laugh = smoothstep(T_RISE[0], T_RISE[1], b) * (1 - smoothstep(T_LAND2 + 0.5, T_LAND2 + 1, b)) + Math.max(0, Math.sin(b * Math.PI * 2)) * 0.15;
        ctx.fillStyle = rgba(NAVY, 0.25);
        ellipse(ctx, cx + 4, ROAD_Y + 4, 120, 16);
        ctx.fill();
        const holdX = cx + 54 + 150 * Math.sin(0.35), holdY = ROAD_Y - 380 - 150 * Math.cos(0.35);
        const n = b < T_GIVE ? 4 : 3;
        for (let k = 0; k < n; k++) {
          const bx = holdX + (k - 1.5) * 46 + Math.sin(b * 1.4 + k) * 8, by = holdY - 190 - k % 2 * 46;
          string(ctx, holdX, holdY - 16, bx, by + 40, Math.sin(b + k) * 10);
          balloon(ctx, bx, by, BALLOON_COLS[k + (4 - n)], 36, Math.sin(b + k) * 0.08);
        }
        clown(ctx, cx, b, { reach, laugh });
      }
    },
    drawFront(ctx, b, env) {
      if (b < T_REACH[0] || b > T_LET + 2) return;
      const fig = env.figure();
      const c5 = env.camAt(T_GIVE);
      const cx = 690 + c5 - env.cam;
      let hx, hy;
      if (b < T_GIVE) {
        const ra = lerp(0.35, -0.95, ease.inOut(smoothstep(T_REACH[0], T_REACH[1], b)));
        hx = cx - 52 - Math.sin(ra) * 162;
        hy = ROAD_Y - 380 + Math.cos(ra) * 162;
      } else if (b < T_LET) {
        const a = fig.pose === "stand" ? ANCHORS.stand.handR : ANCHORS.walk.hand;
        hx = fig.x + a[0] * fig.scale;
        hy = fig.y + a[1] * fig.scale;
      } else {
        const a = ANCHORS.walk.hand, t = b - T_LET;
        hx = fig.x + a[0] - t * 60;
        hy = fig.y + a[1] - t * t * 260 - t * 120;
      }
      const lift = b >= T_RISE[0] && b < T_LAND2 ? 1 : 0;
      const bx = hx + 34 + Math.sin(b * 1.7) * 14, by = hy - 370 - lift * 30;
      string(ctx, hx, hy, bx, by + 42, Math.sin(b * 2) * 18);
      balloon(ctx, bx, by, MUSTARD, 44 + lift * 4, Math.sin(b * 1.7) * 0.1);
      const dust = smoothstep(T_LAND2, T_LAND2 + 0.05, b) * (1 - smoothstep(T_LAND2 + 0.1, T_LAND2 + 0.5, b));
      if (dust > 0) {
        ctx.fillStyle = rgba("#c9a46a", 0.8 * dust);
        for (let k = 0; k < 9; k++) {
          const t = (b - T_LAND2) * 3;
          circle(ctx, fig.x + (k - 4) * 22 * (1 + t), ROAD_Y - 6 - Math.sin(k) * 10 * t - 8 * t, 5 + k % 3);
          ctx.fill();
        }
      }
    },
    drawFrame(ctx, R) {
      const t = 64 * R.s, { x, y, w, h } = R;
      const band = new Path2D();
      band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
      band.rect(x, y, w, h);
      ctx.fillStyle = NAVY;
      ctx.fill(band, "evenodd");
      ctx.strokeStyle = RED;
      ctx.lineWidth = Math.max(1, 8 * R.s);
      ctx.strokeRect(x - t * 0.35, y - t * 0.35, w + t * 0.7, h + t * 0.7);
      ctx.strokeStyle = MUSTARD;
      ctx.lineWidth = Math.max(1, 3 * R.s);
      ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
      for (const [sx, sy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2], [x + w / 2, y - t / 2], [x + w / 2, y + h + t / 2]]) {
        ctx.fillStyle = MUSTARD;
        ctx.fill(star(sx, sy, t * 0.34));
      }
    },
    cardStyle: {
      ink: PAPER6,
      accent: MUSTARD,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        ctx.save();
        const tail = (dir) => {
          const ex = dir < 0 ? x - 34 : x + w + 34, bx2 = dir < 0 ? x + 6 : x + w - 6;
          const p = new Path2D();
          p.moveTo(bx2, y + 30);
          p.lineTo(ex, y + 30);
          p.lineTo(ex + dir * -18, y + h / 2 + 15);
          p.lineTo(ex, y + h + 4);
          p.lineTo(bx2, y + h + 4);
          p.closePath();
          litho(ctx, p, RED_D, { line: 3 });
        };
        tail(-1);
        tail(1);
        const main = new Path2D();
        main.rect(x, y, w, h);
        litho(ctx, main, RED, { line: 3.5 });
        ctx.strokeStyle = MUSTARD;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
        for (const [sx, sy] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]) {
          ctx.fillStyle = MUSTARD;
          ctx.fill(star(sx, sy, 9));
        }
        ctx.restore();
      }
    },
    playerStyle: {
      plate: RED,
      ink: PAPER6,
      noteColor: MUSTARD,
      palette: { disc: PAPER6, shine1: "#ffffff", shine2: MUSTARD, accent: TEAL, hub: MUSTARD, hole: NAVY, ink: NAVY },
      plateDraw(ctx, x, y, w, h) {
        const p = new Path2D();
        p.rect(x, y, w, h);
        litho(ctx, p, RED, { line: 3 });
      }
    }
  };

  // src/kit/watercolor.js
  var WC_PAPER = { cool: "#f5f3ee", warm: "#fbf4e6", white: "#fbfaf6" };
  var scratches = {};
  function scratch2(name, w, h) {
    w = Math.max(1, Math.ceil(w));
    h = Math.max(1, Math.ceil(h));
    const bw = Math.ceil(w / 128) * 128, bh = Math.ceil(h / 128) * 128;
    const key = `${name}|${bw}|${bh}`;
    let c = scratches[key];
    if (!c) {
      c = makeCanvas(bw, bh);
      scratches[key] = c;
    }
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
    g.filter = "none";
    g.clearRect(0, 0, w + 2, h + 2);
    return c;
  }
  function pnoise(x, y, P2, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const f = (t) => t * t * (3 - 2 * t);
    const m = (v2) => (v2 % P2 + P2) % P2;
    const h = (a2, b2) => hash2(m(a2), m(b2), seed);
    const u = f(xf), v = f(yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function cloudTile(seed = 1) {
    return memo(`wc-cloud|${seed}`, () => {
      const T = 256, c = makeCanvas(T, T), g = c.getContext("2d"), im = g.createImageData(T, T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        let s = 0, a = 0.5, n = 0;
        for (let o = 0; o < 4; o++) {
          const P2 = 4 << o;
          s += a * pnoise(x / T * P2, y / T * P2, P2, seed + o * 13);
          n += a;
          a *= 0.5;
        }
        const v = smoothstep(0.35, 0.75, s / n);
        const i = (y * T + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = 255;
        im.data[i + 3] = v * 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    });
  }
  function grainTile2(seed = 1, dark = false) {
    return memo(`wc-grain|${seed}|${dark}`, () => {
      const T = 192, c = makeCanvas(T, T), g = c.getContext("2d"), im = g.createImageData(T, T);
      for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
        const t = pnoise(x / 3, y / 3, T / 3, seed) * 0.65 + pnoise(x / 8, y / 8, T / 8, seed + 3) * 0.2 + hash2(x, y, seed + 5) * 0.15;
        const v = dark ? smoothstep(0.66, 0.95, t) * 0.8 : smoothstep(0.58, 0.92, 1 - t);
        const i = (y * T + x) * 4;
        const col = dark ? 0 : 255;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = col;
        im.data[i + 3] = v * 255;
      }
      g.putImageData(im, 0, 0);
      return c;
    });
  }
  function patternFor(g, tile2, seed, scale = 1) {
    const p = g.createPattern(tile2, "repeat");
    if (p.setTransform) p.setTransform(new DOMMatrix().translate(hash2(seed, 1, 77) * 256, hash2(seed, 2, 77) * 256).scale(scale));
    return p;
  }
  function wcPaper(w, h, { base = WC_PAPER.cool, seed = 4, amount = 1 } = {}) {
    w = Math.round(w);
    h = Math.round(h);
    return baked(`wcpaper|${w}|${h}|${base}|${seed}|${amount}`, w, h, (ctx) => {
      const [r0, g0, b0] = hexToRgb(base);
      const sw = Math.ceil(w / 10), sh = Math.ceil(h / 10);
      const small = makeCanvas(sw, sh), sctx = small.getContext("2d"), img = sctx.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const n = fbm(x / 20, y / 20, seed, 4) - 0.5;
        const k = 1 + n * 0.05 * amount;
        const i = (y * sw + x) * 4;
        img.data[i] = r0 * k;
        img.data[i + 1] = g0 * k;
        img.data[i + 2] = b0 * k;
        img.data[i + 3] = 255;
      }
      sctx.putImageData(img, 0, 0);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(small, 0, 0, w, h);
      drawTooth(ctx, w, h, seed, 0.55 * amount);
    });
  }
  function drawTooth(ctx, w, h, seed, amount) {
    ctx.save();
    ctx.globalAlpha = 0.08 * amount;
    ctx.fillStyle = patternFor(ctx, grainTile2(seed, true), seed);
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.5 * amount;
    ctx.fillStyle = patternFor(ctx, grainTile2(seed + 1, false), seed + 1);
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }
  function paperTooth(w, h, { seed = 7, amount = 1 } = {}) {
    w = Math.round(w);
    h = Math.round(h);
    return baked(`wctooth|${w}|${h}|${seed}|${amount}`, w, h, (ctx) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.09 * amount;
      ctx.fillStyle = patternFor(ctx, grainTile2(seed, true), seed);
      ctx.fillRect(0, 0, w, h);
      const sw = Math.ceil(w / 16), sh = Math.ceil(h / 16);
      const small = makeCanvas(sw, sh), sg = small.getContext("2d"), im = sg.createImageData(sw, sh);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
        const v = 255 - (fbm(x / 9, y / 9, seed + 3, 3) - 0.3) * 40 * amount;
        const i = (y * sw + x) * 4;
        im.data[i] = im.data[i + 1] = im.data[i + 2] = clamp(v, 200, 255);
        im.data[i + 3] = 255;
      }
      sg.putImageData(im, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(small, 0, 0, w, h);
    });
  }
  function deckle(w, h, { color = WC_PAPER.cool, seed = 9, sides = { top: 18, right: 26, bottom: 46, left: 26 } } = {}) {
    w = Math.round(w);
    h = Math.round(h);
    return baked(`wcdeckle|${w}|${h}|${color}|${seed}|${JSON.stringify(sides)}`, w, h, (ctx) => {
      const edge = (n, len, depth, s) => {
        const pts = [];
        for (let i = 0; i <= n; i++) {
          const t = i / n;
          const d = depth * (0.35 + 0.9 * fbm(t * 9, s, seed + s, 3)) + depth * 0.5 * Math.max(0, noise2(t * 31, s, seed + 9) - 0.6);
          pts.push([t * len, d]);
        }
        return pts;
      };
      const side = (depth, len, tf, s) => {
        if (!depth) return;
        const pts = edge(90, len, depth, s);
        ctx.save();
        tf();
        ctx.beginPath();
        ctx.moveTo(0, -4);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(len, -4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = mix(color, "#7a8aa6", 0.35);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1));
        ctx.stroke();
        ctx.restore();
      };
      ctx.filter = "blur(0.6px)";
      side(sides.top, w, () => {
      }, 1);
      side(sides.bottom, w, () => {
        ctx.translate(w, h);
        ctx.rotate(Math.PI);
      }, 2);
      side(sides.left, h, () => {
        ctx.translate(0, h);
        ctx.rotate(-Math.PI / 2);
      }, 3);
      side(sides.right, h, () => {
        ctx.translate(w, 0);
        ctx.rotate(Math.PI / 2);
      }, 4);
      ctx.filter = "none";
    });
  }
  function blobPts(cx, cy, rx, ry, { seed = 1, rough = 0.18, n = 32, rot = 0 } = {}) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const k = 1 + rough * ((noise2(Math.cos(a) * 1.7 + seed * 3.1, Math.sin(a) * 1.7, seed) - 0.5) * 2 + (hash2(i, seed, 41) - 0.5) * 0.5);
      const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
      pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
    }
    return pts;
  }
  function roughPoly(pts, { amp = 3, step = 8, seed = 1, closed = true } = {}) {
    const out = [];
    const n = pts.length, segs = closed ? n : n - 1;
    let s = 0;
    for (let i = 0; i < segs; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      const L = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / L, ny = (bx - ax) / L;
      const k = Math.max(1, Math.round(L / step));
      for (let j = 0; j < k; j++) {
        const t = j / k, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
        const d = (noise2(s * 0.13, seed * 1.3, seed) - 0.5) * 2 * amp + (hash2(s, seed, 9) - 0.5) * amp * 0.5;
        out.push([x + nx * d, y + ny * d]);
        s++;
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  var bboxOf = (pts) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) {
      if (x < x0) x0 = x;
      if (y < y0) y0 = y;
      if (x > x1) x1 = x;
      if (y > y1) y1 = y;
    }
    return [x0, y0, x1, y1];
  };
  var pathOf = (pts) => {
    const p = new Path2D();
    pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    p.closePath();
    return p;
  };
  function wash(ctx, shape, o = {}) {
    const {
      color = "#7f93b8",
      color2 = null,
      alpha = 0.85,
      blend = "source-over",
      px = 1,
      soft = 0.8,
      edge = 0.7,
      edgeW = 4,
      vary = 0.3,
      grain: grain2 = 0.3,
      blooms = 0,
      seed = 1,
      lift = 0
    } = o;
    const edgeColor = o.edgeColor || mix(color, "#1e2a44", 0.28);
    const isPts = Array.isArray(shape);
    const path = isPts ? pathOf(shape) : shape.path;
    const [bx0, by0, bx1, by1] = isPts ? bboxOf(shape) : shape.bbox;
    const pad = Math.ceil(soft * 3 + edgeW * 2 + 4);
    const w = Math.ceil((bx1 - bx0) * px) + pad * 2, h = Math.ceil((by1 - by0) * px) + pad * 2;
    if (w < 2 || h < 2 || w > 8e3 || h > 8e3) return;
    const toLocal = (g) => g.setTransform(px, 0, 0, px, pad - bx0 * px, pad - by0 * px);
    const A = scratch2("wA", w, h), ga = A.getContext("2d");
    toLocal(ga);
    if (color2) {
      const [gx0, gy0, gx1, gy1] = o.grad || [bx0, by0, bx0, by1];
      const gr = ga.createLinearGradient(gx0, gy0, gx1, gy1);
      gr.addColorStop(0, color);
      gr.addColorStop(1, color2);
      ga.fillStyle = gr;
    } else ga.fillStyle = color;
    ga.fill(path);
    ga.setTransform(1, 0, 0, 1, 0, 0);
    const Bc = scratch2("wB", w, h), gb = Bc.getContext("2d");
    if (soft > 0) gb.filter = `blur(${soft}px)`;
    gb.drawImage(A, 0, 0, w, h, 0, 0, w, h);
    gb.filter = "none";
    if (vary > 0) {
      gb.globalCompositeOperation = "destination-out";
      gb.globalAlpha = vary * 0.55;
      gb.fillStyle = patternFor(gb, cloudTile(seed % 7), seed, 1.6);
      gb.fillRect(0, 0, w, h);
    }
    if (lift > 0) {
      gb.globalCompositeOperation = "destination-out";
      gb.globalAlpha = lift;
      const r = Math.max(w, h) * 0.55;
      const rg = gb.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, r);
      rg.addColorStop(0, "rgba(0,0,0,0.8)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      gb.fillStyle = rg;
      gb.fillRect(0, 0, w, h);
    }
    if (blooms > 0) {
      const R = rng("wc-bloom", seed);
      for (let i = 0; i < blooms; i++) {
        const cx = pad + R() * (w - 2 * pad), cy = pad + R() * (h - 2 * pad);
        const r = Math.min(w, h) * (0.12 + R() * 0.22);
        const bp = pathOf(blobPts(cx, cy, r, r * (0.7 + R() * 0.4), { seed: seed * 7 + i, rough: 0.32, n: 28 }));
        gb.globalCompositeOperation = "destination-out";
        gb.globalAlpha = 0.35;
        gb.filter = `blur(${Math.max(1, r * 0.15)}px)`;
        gb.fill(bp);
        gb.filter = "none";
        gb.globalCompositeOperation = "source-atop";
        gb.globalAlpha = 0.5;
        gb.strokeStyle = edgeColor;
        gb.lineWidth = Math.max(1, r * 0.05);
        gb.stroke(bp);
      }
    }
    if (edge > 0) {
      const E = scratch2("wE", w, h), ge = E.getContext("2d");
      ge.drawImage(A, 0, 0, w, h, 0, 0, w, h);
      ge.globalCompositeOperation = "destination-out";
      ge.filter = `blur(${edgeW}px)`;
      ge.drawImage(A, 0, 0, w, h, 0, 0, w, h);
      ge.filter = "none";
      ge.globalCompositeOperation = "source-in";
      ge.fillStyle = edgeColor;
      ge.fillRect(0, 0, w, h);
      gb.globalCompositeOperation = "source-atop";
      for (let e = edge; e > 0; e -= 1) {
        gb.globalAlpha = Math.min(1, e);
        gb.drawImage(E, 0, 0, w, h, 0, 0, w, h);
      }
    }
    if (grain2 > 0) {
      gb.globalCompositeOperation = "destination-out";
      gb.globalAlpha = grain2 * 0.45;
      gb.fillStyle = patternFor(gb, grainTile2(seed % 5, false), seed);
      gb.fillRect(0, 0, w, h);
      gb.globalCompositeOperation = "source-atop";
      gb.globalAlpha = grain2 * 0.07;
      gb.fillStyle = patternFor(gb, grainTile2(seed % 5 + 11, true), seed + 3);
      gb.fillRect(0, 0, w, h);
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.globalCompositeOperation = blend;
    ctx.drawImage(Bc, 0, 0, w, h, bx0 - pad / px, by0 - pad / px, w / px, h / px);
    ctx.restore();
  }
  function skyWash(ctx, x0, y0, x1, y1, stops, { px = 1, seed = 3, bands = 7, blooms = 4, grain: grain2 = 0.25 } = {}) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (const [t, c] of stops) g.addColorStop(t, c);
    ctx.save();
    ctx.fillStyle = g;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    const colorAt = (t) => {
      for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0] || 1));
      return stops[stops.length - 1][1];
    };
    const R = rng("wc-sky", seed);
    for (let i = 0; i < bands; i++) {
      const t = (i + 0.5) / bands + (R() - 0.5) * 0.08;
      const y = y0 + (y1 - y0) * t, hh = (y1 - y0) * (0.08 + R() * 0.1);
      const pts = [];
      const n = 40;
      for (let k = 0; k <= n; k++) {
        const x = x0 + (x1 - x0) * k / n;
        pts.push([x, y - hh / 2 + (noise2(k * 0.35, i, seed) - 0.5) * hh * 0.9]);
      }
      for (let k = n; k >= 0; k--) {
        const x = x0 + (x1 - x0) * k / n;
        pts.push([x, y + hh / 2 + (noise2(k * 0.35, i + 50, seed) - 0.5) * hh * 0.9]);
      }
      const c = colorAt(clamp(t + (R() < 0.5 ? -0.12 : 0.12)));
      wash(ctx, pts, { color: c, alpha: 0.35 + R() * 0.2, px, soft: 10 + R() * 14, edge: R() < 0.4 ? 0.5 : 0, edgeW: 6, vary: 0.5, grain: 0, seed: seed * 11 + i });
    }
    for (let i = 0; i < blooms; i++) {
      const x = x0 + R() * (x1 - x0), y = y0 + (y1 - y0) * (0.1 + R() * 0.6), r = (y1 - y0) * (0.08 + R() * 0.1);
      const c = colorAt(clamp((y - y0) / (y1 - y0)));
      wash(ctx, blobPts(x, y, r * 1.8, r, { seed: seed + i * 5, rough: 0.3 }), { color: mix(c, "#ffffff", 0.35), alpha: 0.5, px, soft: 3, edge: 1.2, edgeW: 5, edgeColor: mix(c, "#2a3a5a", 0.25), vary: 0.2, grain: 0, seed: seed + i });
    }
    if (grain2 > 0) {
      ctx.save();
      ctx.globalAlpha = grain2;
      ctx.fillStyle = patternFor(ctx, grainTile2(seed, false), seed, 1 / px);
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.restore();
    }
  }
  function dab(ctx, x, y, r, color, { alpha = 0.8, edge = 0.5, seed = 1, rough = 0.2, ry = null, rot = 0, n = 16, edgeColor = null } = {}) {
    const p = pathOf(blobPts(x, y, r, ry ?? r, { seed, rough, n, rot }));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.fillStyle = color;
    ctx.fill(p);
    if (edge > 0) {
      ctx.globalAlpha = Math.min(1, ctx.globalAlpha * edge);
      ctx.strokeStyle = edgeColor || mix(color, "#1e2a44", 0.3);
      ctx.lineWidth = Math.max(0.6, r * 0.12);
      ctx.stroke(p);
    }
    ctx.restore();
  }
  function glow(ctx, x, y, r, color, a = 0.6, { blend = "screen", core = 0.15 } = {}) {
    if (a <= 2e-3 || r <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = blend;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(core, rgba(color, a * 0.7));
    g.addColorStop(0.5, rgba(color, a * 0.22));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }
  function dryBrush(ctx, pts, { width = 4, color = "#41516e", alpha = 0.8, passes = 3, dry = 0.35, seed = 1, wobble = 1.2 } = {}) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = color;
    for (let p = 0; p < passes; p++) {
      const R = rng("wc-dry", seed, p);
      ctx.globalAlpha = alpha * (p ? 0.45 : 0.85);
      ctx.lineWidth = width * (p ? 0.45 + R() * 0.3 : 1);
      const dash = [];
      if (dry > 0) for (let k = 0; k < 12; k++) dash.push(width * (2 + R() * 14 * (1 - dry)), width * R() * 4 * dry);
      ctx.setLineDash(dash);
      ctx.lineDashOffset = R() * 40;
      ctx.beginPath();
      pts.forEach(([x, y], i) => {
        const jx = (hash2(i, p, seed) - 0.5) * wobble * 2, jy = (hash2(i, p + 7, seed) - 0.5) * wobble * 2;
        i ? ctx.lineTo(x + jx, y + jy) : ctx.moveTo(x + jx, y + jy);
      });
      ctx.stroke();
    }
    ctx.restore();
  }
  function streak(ctx, x, y0, y1, { w = 20, color = "#f08a6a", alpha = 0.8, seed = 1, wobble = 6, gap = 7, taper = 0.5, fade: fade2 = 0.85 } = {}) {
    ctx.save();
    ctx.fillStyle = color;
    const L = y1 - y0;
    let i = 0;
    for (let y = y0; y < y1; y += gap * (0.6 + hash2(i, 3, seed) * 0.8), i++) {
      const t = (y - y0) / L;
      if (hash2(i, 1, seed) < t * 0.45) continue;
      const ww = w * (1 + taper * t) * (0.35 + 0.9 * noise2(y * 0.05, seed, seed + 2));
      const cx = x + Math.sin(y * 0.09 + seed) * wobble * (0.4 + t) + (hash2(i, 2, seed) - 0.5) * wobble;
      ctx.globalAlpha = alpha * (1 - fade2 * t) * (0.55 + 0.45 * hash2(i, 4, seed));
      ctx.beginPath();
      ctx.ellipse(cx, y, ww / 2, gap * (0.22 + hash2(i, 5, seed) * 0.25), 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  function wetRoad(ctx, x0, x1, y0, y1, { top = "#9fb0cc", bottom = "#c4cbe0", ripple = "#7f8fb0", lights = "#eef1f6", px = 1, seed = 5, density = 1 } = {}) {
    wash(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { color: top, color2: bottom, alpha: 1, px, soft: 0.5, edge: 0, vary: 0.35, grain: 0.35, seed });
    const R = rng("wc-road", seed);
    const n = Math.round((x1 - x0) * (y1 - y0) / 2600 * density);
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < n; i++) {
      const y = y0 + Math.pow(R(), 0.8) * (y1 - y0), x = x0 + R() * (x1 - x0);
      const t = (y - y0) / (y1 - y0);
      const len = 20 + R() * 90 * (0.5 + t);
      const light = R() < 0.45;
      ctx.strokeStyle = light ? lights : ripple;
      ctx.globalAlpha = (light ? 0.45 : 0.22) * (0.4 + R() * 0.6);
      ctx.lineWidth = (light ? 1.5 : 2.2) * (0.6 + t * 1.2) * (0.6 + R() * 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + len / 2, y + (R() - 0.5) * 3, x + len, y + (R() - 0.5) * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function captureUnits(key, draw, res = 1) {
    const w = Math.round((X_MAX - X_MIN) * K * res), h = Math.round(1e3 * K * res);
    const c = memo(`wc-cap|${key}|${w}|${h}`, () => makeCanvas(w, h));
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, w, h);
    g.setTransform(K * res, 0, 0, K * res, -X_MIN * K * res, 0);
    draw(g);
    g.setTransform(1, 0, 0, 1, 0, 0);
    return c;
  }
  function runDown(ctx, src, rect, amount, { run = 0.22, cols = 4, copies = 5, seed = 3, paper: paper2 = WC_PAPER.cool, sink = 0, px = K } = {}) {
    const { x, y, w, h } = rect;
    const SW = src.width, SH = src.height;
    const sw = Math.ceil(w * px / 3), sh = Math.ceil(h * px / 3);
    const half = scratch2("run-half", sw, sh), gh = half.getContext("2d");
    gh.imageSmoothingQuality = "low";
    gh.drawImage(src, 0, 0, SW, SH, 0, 0, sw, sh);
    const out = scratch2("run-out", sw, sh), go = out.getContext("2d");
    const maxD = sh * run * amount;
    const prof = (c) => {
      const u = c / (sw / cols);
      const lo = noise2(u * 0.07, 0.5, seed);
      const hi = noise2(u * 0.6, 3.5, seed + 1);
      return 0.3 + 0.5 * lo + 0.55 * Math.pow(hi, 3) + 0.25 * Math.pow(noise2(u * 1.7, 7.5, seed + 2), 4);
    };
    for (let c = 0; c < sw; c += cols) {
      const d = maxD * prof(c);
      for (let k = 1; k <= copies; k++) {
        go.globalAlpha = 1 / k;
        const off = d * (k - 1) / (copies - 1);
        go.drawImage(half, c, 0, cols, sh, c, off, cols, sh);
      }
    }
    ctx.save();
    const over = clamp(amount * 1.15);
    if (over < 0.98) {
      const dy = maxD * sink * (h / sh);
      ctx.fillStyle = paper2;
      ctx.fillRect(x, y, w, dy + 1);
      ctx.globalAlpha = 1;
      ctx.drawImage(src, 0, 0, SW, SH, x, y + dy, w, h);
    }
    ctx.globalAlpha = over;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(out, 0, 0, sw, sh, x, y, w, h);
    ctx.restore();
  }
  function wcCard(w, h, { paper: paper2 = WC_PAPER.white, color = "#7fa3cc", color2 = null, seed = 1, inset = 30, shadow = true } = {}) {
    w = Math.round(w);
    h = Math.round(h);
    const pad = 24;
    return baked(`wccard|${w}|${h}|${paper2}|${color}|${color2}|${seed}|${inset}|${shadow}`, w + pad * 2, h + pad * 2, (ctx) => {
      ctx.translate(pad, pad);
      const outline2 = roughPoly([[0, 0], [w, 0], [w, h], [0, h]], { amp: 2.2, step: 10, seed });
      if (shadow) {
        ctx.save();
        ctx.filter = "blur(6px)";
        ctx.globalAlpha = 0.22;
        ctx.translate(4, 7);
        ctx.fillStyle = "#2a3550";
        ctx.fill(pathOf(outline2));
        ctx.restore();
      }
      const P2 = wcPaper(w + 4, h + 4, { base: paper2, seed: seed + 2, amount: 0.9 });
      ctx.save();
      ctx.clip(pathOf(outline2));
      ctx.drawImage(P2, -2, -2);
      const ring = new Path2D();
      const outer = roughPoly([[-10, -10], [w + 10, -10], [w + 10, h + 10], [-10, h + 10]], { amp: 2, step: 12, seed: seed + 1 });
      const inner = roughPoly([[inset, inset * 0.8], [w - inset, inset * 0.8], [w - inset, h - inset * 0.8], [inset, h - inset * 0.8]], { amp: inset * 0.35, step: 14, seed: seed + 5 });
      outer.forEach(([x, y], i) => i ? ring.lineTo(x, y) : ring.moveTo(x, y));
      ring.closePath();
      inner.forEach(([x, y], i) => i ? ring.lineTo(x, y) : ring.moveTo(x, y));
      ring.closePath();
      const tmp = makeCanvas(w + 40, h + 40), gt = tmp.getContext("2d");
      gt.translate(20, 20);
      gt.fillStyle = color;
      gt.fill(ring, "evenodd");
      if (color2) {
        gt.globalCompositeOperation = "source-atop";
        const g2 = gt.createRadialGradient(w, h, 0, w, h, Math.max(w, h) * 0.6);
        g2.addColorStop(0, rgba(color2, 0.9));
        g2.addColorStop(1, rgba(color2, 0));
        gt.fillStyle = g2;
        gt.fillRect(-20, -20, w + 40, h + 40);
        gt.globalCompositeOperation = "source-over";
      }
      ctx.filter = `blur(${inset * 0.28}px)`;
      ctx.globalAlpha = 0.55;
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(tmp, -20, -20);
      ctx.filter = "none";
      ctx.globalAlpha = 0.28;
      ctx.strokeStyle = mix(color, "#1e2a44", 0.3);
      ctx.lineWidth = 1.6;
      ctx.stroke(pathOf(roughPoly([[inset * 0.55, inset * 0.45], [w - inset * 0.55, inset * 0.45], [w - inset * 0.55, h - inset * 0.45], [inset * 0.55, h - inset * 0.45]], { amp: inset * 0.3, step: 14, seed: seed + 5 })));
      ctx.restore();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = mix(color, "#1e2a44", 0.4);
      ctx.lineWidth = 1.2;
      ctx.stroke(pathOf(outline2));
    });
  }
  function drawWcCard(ctx, x, y, w, h, o = {}) {
    ctx.drawImage(wcCard(w, h, o), x - 24, y - 24);
  }
  function wcFrameImage({ W: W2 = W, H: H2 = H, t = 64, paper: paper2 = WC_PAPER.cool, colors = ["#9ab6d8", "#c5b4dc", "#f2c3a6"], seed = 21 } = {}) {
    return baked(`wcframe|${W2}|${H2}|${t}|${paper2}|${colors.join()}|${seed}`, W2 + 2 * t, H2 + 2 * t, (ctx) => {
      ctx.translate(t, t);
      const band = new Path2D();
      const outer = roughPoly([[-t, -t], [W2 + t, -t], [W2 + t, H2 + t], [-t, H2 + t]], { amp: 3, step: 16, seed });
      const inner = roughPoly([[0, 0], [W2, 0], [W2, H2], [0, H2]], { amp: 2.5, step: 14, seed: seed + 1 });
      outer.forEach(([x, y], i) => i ? band.lineTo(x, y) : band.moveTo(x, y));
      band.closePath();
      inner.forEach(([x, y], i) => i ? band.lineTo(x, y) : band.moveTo(x, y));
      band.closePath();
      ctx.save();
      ctx.clip(band, "evenodd");
      ctx.drawImage(wcPaper(W2 + 2 * t, H2 + 2 * t, { base: paper2, seed: seed + 3 }), -t, -t);
      const R = rng("wc-frame", seed);
      const sides = [
        (u) => [lerp(-t, W2 + t, u), -t * 0.5],
        (u) => [W2 + t * 0.5, lerp(-t, H2 + t, u)],
        (u) => [lerp(W2 + t, -t, u), H2 + t * 0.5],
        (u) => [-t * 0.5, lerp(H2 + t, -t, u)]
      ];
      sides.forEach((f, si) => {
        for (let k = 0; k < 3; k++) {
          const u0 = R() * 0.35, u1 = 0.65 + R() * 0.35, off = (R() - 0.5) * t * 0.5, wd = t * (0.35 + R() * 0.35);
          const pts = [];
          for (let i = 0; i <= 30; i++) {
            const u = lerp(u0, u1, i / 30), [x, y] = f(u);
            const n = (noise2(u * 6, k + si * 3, seed) - 0.5) * t * 0.35;
            pts.push(si % 2 ? [x + off + n, y] : [x, y + off + n]);
          }
          const top = [], bot = [];
          pts.forEach(([x, y], i) => {
            const ww = wd * (0.5 + 0.5 * Math.sin(i / 30 * Math.PI)) * (0.8 + 0.4 * noise2(i * 0.3, k, seed + si));
            if (si % 2) {
              top.push([x - ww / 2, y]);
              bot.push([x + ww / 2, y]);
            } else {
              top.push([x, y - ww / 2]);
              bot.push([x, y + ww / 2]);
            }
          });
          wash(ctx, [...top, ...bot.reverse()], { color: colors[(si + k) % colors.length], alpha: 0.5 + R() * 0.2, px: 1, soft: 2.5, edge: 0.9, edgeW: 3, vary: 0.4, grain: 0.35, seed: seed + si * 10 + k, blend: "multiply" });
        }
      });
      for (const [cx, cy] of [[-t / 2, -t / 2], [W2 + t / 2, -t / 2], [W2 + t / 2, H2 + t / 2], [-t / 2, H2 + t / 2]]) {
        wash(ctx, blobPts(cx, cy, t * 0.55, t * 0.5, { seed: seed + cx, rough: 0.3 }), { color: colors[Math.abs(Math.round(cx + cy)) % colors.length], alpha: 0.55, px: 1, soft: 2, edge: 1.3, edgeW: 4, vary: 0.3, grain: 0.3, seed: seed + 5, blend: "multiply" });
      }
      ctx.restore();
      dryBrush(ctx, [...inner, inner[0]], { width: 2.4, color: mix(colors[0], "#2a3a5a", 0.45), alpha: 0.55, passes: 2, dry: 0.4, seed: seed + 9, wobble: 0.8 });
      dryBrush(ctx, [...outer, outer[0]], { width: 2, color: mix(colors[0], "#2a3a5a", 0.3), alpha: 0.4, passes: 1, dry: 0.5, seed: seed + 10, wobble: 0.8 });
    });
  }
  function drawWcFrame(ctx, R, o = {}) {
    const t = 64;
    const img = wcFrameImage({ ...o, t });
    const s = R.s;
    ctx.save();
    ctx.fillStyle = "rgba(40,55,90,0.12)";
    ctx.beginPath();
    ctx.ellipse(R.x + R.w / 2, R.y + R.h + t * s * 0.9, R.w * 0.55, t * s * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, R.x - t * s, R.y - t * s, img.width * (R.w / (img.width - 2 * t)), img.height * (R.h / (img.height - 2 * t)));
    ctx.restore();
  }
  function wcDisc(r, { colors = ["#7fa8d8", "#e58fb0", "#f2d16b", "#6fc7d6"], paper: paper2 = WC_PAPER.white, ink = "#27364a", seed = 31 } = {}) {
    const pad = 10, S = Math.ceil(r * 2 + pad * 2);
    return baked(`wcdisc|${r}|${colors.join()}|${paper2}|${ink}|${seed}`, S, S, (ctx) => {
      const c = S / 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fillStyle = paper2;
      ctx.fill();
      ctx.clip();
      ctx.drawImage(wcPaper(S, S, { base: paper2, seed }), 0, 0);
      const n = colors.length * 2;
      for (let i = 0; i < n; i++) {
        const a0 = i / n * Math.PI * 2 - 0.12, a1 = (i + 1) / n * Math.PI * 2 + 0.12;
        const pts = [];
        for (let k = 0; k <= 16; k++) {
          const a = lerp(a0, a1, k / 16);
          const rr = r * (0.9 + (noise2(a * 3, i, seed) - 0.5) * 0.06);
          pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]);
        }
        for (let k = 16; k >= 0; k--) {
          const a = lerp(a0, a1, k / 16);
          const rr = r * (0.5 + (noise2(a * 3, i + 9, seed) - 0.5) * 0.08);
          pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]);
        }
        wash(ctx, pts, { color: colors[i % colors.length], alpha: 0.62, px: 1, soft: 2.2, edge: 0.9, edgeW: 2.5, vary: 0.35, grain: 0.3, seed: seed + i, blend: "multiply" });
      }
      wash(ctx, blobPts(c, c, r * 0.36, r * 0.36, { seed, rough: 0.05, n: 36 }), { color: mix(colors[0], "#ffffff", 0.55), alpha: 0.6, px: 1, soft: 1, edge: 0.6, edgeW: 2, vary: 0.2, grain: 0.2, seed: seed + 50 });
      ctx.restore();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(c, c, r - 1, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(c, c, r * 0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(c, c, r * 0.1, 0, Math.PI * 2);
      ctx.fillStyle = mix(paper2, "#9fb2cc", 0.6);
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });
  }

  // src/scenes/s10.js
  var ST10 = stationByN(10);
  registerStyle("s10-wc", (I) => watercolor(I, ["#1c2a3d", "#3b5779", "#8aa5c2", "#e4ebf1"], 0.75));
  var PAPER7 = "#f5f3ee";
  var INK7 = "#27364a";
  var SKY2 = [[0, "#56739f"], [0.22, "#7f9cc6"], [0.5, "#aab3da"], [0.78, "#dcbcca"], [1, "#f2c7a4"]];
  var FAR = ["#8d9bc3", "#9a9fc9", "#a3a9cf", "#8fa3c6"];
  var FACADE2 = ["#7486b0", "#8a85b2", "#6f8aac", "#9a8eb6", "#b59a9c", "#7c93b4"];
  var NEON = ["#f08a6a", "#e65f9a", "#5fc7d9", "#f2d16b"];
  var WARM = "#ffe2a3";
  var SHOP = "#fbe5b8";
  var LAMP2 = "#fff1c8";
  var UMB = "#e9654f";
  var UMB_L = "#f59b7c";
  var UMB_D = "#b8432f";
  var HEAD = "#fff1c8";
  var TAIL = "#ec5a62";
  var P_SKY4 = 0.04;
  var P_FAR8 = 0.25;
  var P_MID6 = 0.6;
  var P_STREET = 0.85;
  var P_RAIN = 1.2;
  var MID_BASE = 702;
  var STREET_Y0 = 714;
  var CURB_Y = 794;
  var LANE_Y = 786;
  var T_DROP = GAG - 0.4;
  var T_MELT = GAG;
  var T_BACK2 = GAG + 1;
  var T_BEADS = GAG + 2;
  var MELT_IN = 0.6;
  var MELT_OUT = 0.65;
  var UMB_IN = 0.65;
  var UMB_OUT = 0.7;
  function meltAmt(b) {
    if (b < T_MELT || b > T_BACK2 + MELT_OUT) return 0;
    const up = ease.out(clamp((b - T_MELT) / MELT_IN));
    const down = ease.inOut(clamp((b - T_BACK2) / MELT_OUT));
    return up * (1 - down);
  }
  function umbMelt(b) {
    if (b < T_MELT || b > T_BACK2 + UMB_OUT) return 0;
    const up = ease.inOut(clamp((b - T_MELT) / UMB_IN));
    const down = ease.inOut(clamp((b - T_BACK2) / UMB_OUT));
    return Math.min(up, 1 - down);
  }
  var R04 = (...k) => rng("s10", ...k);
  function midGeo3(c9) {
    return memo(`s10-mid|${Math.round(c9)}`, () => {
      const [x0, x1] = [X_MIN - 520 * P_MID6 - 300, X_MAX + 2700 * P_MID6 + 300];
      const R = R04("mid");
      const blds = [];
      for (let x = x0; x < x1; ) {
        const w = 230 + R() * 230, top = 150 + R() * 220;
        const neonKind = R();
        blds.push({
          x,
          w,
          top,
          color: FACADE2[Math.floor(R() * FACADE2.length)],
          seed: Math.floor(R() * 1e3),
          awning: R() < 0.7 ? NEON[Math.floor(R() * 4)] : null,
          neon: neonKind < 0.32 ? "bar" : neonKind < 0.62 ? "blade" : neonKind < 0.82 ? "disc" : null,
          neonColor: NEON[Math.floor(R() * 4)],
          lit: R()
        });
        x += w + (R() < 0.3 ? 40 + R() * 90 : 4 + R() * 10);
      }
      const lamps = [];
      const lx0 = 540 + c9 * P_MID6;
      for (let x = lx0 - 3 * 640; x < x1; x += 640) lamps.push({ x: x + (x === lx0 ? 0 : (hash2(Math.round(x), 3, 10) - 0.5) * 80) });
      const trees = [];
      for (const l of lamps) if (hash2(Math.round(l.x), 5, 10) < 0.7) trees.push({ x: l.x + 300 + (hash2(Math.round(l.x), 6, 10) - 0.5) * 80, h: 240 + hash2(Math.round(l.x), 7, 10) * 80, seed: Math.round(l.x) });
      return { blds, lamps, trees };
    });
  }
  function neonShape(B2) {
    const { x, w } = B2;
    if (B2.neon === "bar") return { kind: "bar", x: x + w * 0.2, y: 440, w: w * 0.6, h: 42 };
    if (B2.neon === "blade") return { kind: "blade", x: x + w - 46, y: Math.max(B2.top + 40, 260), w: 34, h: 170 };
    if (B2.neon === "disc") return { kind: "disc", x: x + w * 0.72, y: 455, w: 64, h: 64 };
    return null;
  }
  function neonPath(N) {
    const p = new Path2D();
    if (N.kind === "disc") p.arc(N.x + N.w / 2, N.y + N.h / 2, N.w / 2, 0, Math.PI * 2);
    else p.roundRect(N.x, N.y, N.w, N.h, Math.min(N.w, N.h) * 0.35);
    return p;
  }
  var neonCenter = (N) => [N.x + N.w / 2, N.y + N.h / 2];
  function skyLayer5() {
    return strip("s10-sky", P_SKY4, (ctx, x0, x1) => {
      skyWash(ctx, x0, 0, x1, 730, SKY2, { px: K, seed: 3, bands: 8, blooms: 4, grain: 0.18 });
      const R = R04("cloud");
      for (let i = 0; i < 9; i++) {
        const cx = x0 + R() * (x1 - x0), cy = 70 + R() * 260, rx = 140 + R() * 220;
        wash(ctx, blobPts(cx, cy, rx, rx * (0.2 + R() * 0.12), { seed: i + 3, rough: 0.28 }), { color: R() < 0.5 ? "#7f88b4" : "#9a93bd", color2: "#b9b4d6", alpha: 0.38, px: K, soft: 9, edge: 0.6, edgeW: 5, vary: 0.5, grain: 0.2, seed: 20 + i, blend: "multiply" });
      }
    }, { y0: 0, y1: 730 });
  }
  function farLayer7() {
    return strip("s10-far", P_FAR8, (ctx, x0, x1) => {
      const R = R04("far");
      for (let x = x0 - 40; x < x1; ) {
        const w = 90 + R() * 160, top = 200 + R() * 240;
        const pts = [[x, 712], [x, top + 14], [x + w * 0.1, top], [x + w * 0.9, top], [x + w, top + 10], [x + w, 712]];
        if (R() < 0.25) pts.splice(3, 0, [x + w * 0.45, top - 50 - R() * 50], [x + w * 0.55, top - 50 - R() * 50]);
        const col = FAR[Math.floor(R() * FAR.length)];
        wash(ctx, roughPoly(pts, { amp: 2, step: 10, seed: Math.round(x) }), { color: col, color2: "#cfc8e0", grad: [0, top, 0, 690], alpha: 0.7, px: K, soft: 2.2, edge: 0.8, edgeW: 3, vary: 0.45, grain: 0.25, seed: Math.round(x) % 97, blend: "multiply" });
        const n = Math.floor(R() * 7);
        for (let k = 0; k < n; k++) dab(ctx, x + 12 + R() * (w - 24), top + 20 + R() * (560 - top), 3.2 + R() * 1.6, WARM, { alpha: 0.85, edge: 0.3, seed: k + Math.round(x), rough: 0.25 });
        x += w + R() * 30;
      }
      wash(ctx, [[x0, 560], [x1, 560], [x1, 720], [x0, 720]], { color: "#e3dbe8", color2: "#efe4e6", alpha: 0.55, px: K, soft: 16, edge: 0, vary: 0.5, grain: 0, seed: 7 });
    }, { y0: 120, y1: 730 });
  }
  function midLayer6(env) {
    const G = midGeo3(env.camAt(GAG));
    return strip("s10-mid", P_MID6, (ctx, x0, x1) => {
      wash(ctx, [[x0, MID_BASE - 4], [x1, MID_BASE - 4], [x1, STREET_Y0 + 6], [x0, STREET_Y0 + 6]], { color: "#b4bcd6", alpha: 0.95, px: K, soft: 1, edge: 0.5, vary: 0.3, grain: 0.3, seed: 2 });
      for (const B2 of G.blds) {
        if (B2.x + B2.w < x0 - 50 || B2.x > x1 + 50) continue;
        const { x, w, top } = B2;
        const pts = [[x, MID_BASE], [x, top + 8], [x + 6, top], [x + w - 6, top], [x + w, top + 8], [x + w, MID_BASE]];
        wash(ctx, roughPoly(pts, { amp: 1.6, step: 9, seed: B2.seed }), { color: B2.color, color2: mix(B2.color, "#d7cde0", 0.35), alpha: 0.88, px: K, soft: 1.2, edge: 1, edgeW: 3, vary: 0.4, grain: 0.35, blooms: B2.seed % 3 === 0 ? 1 : 0, seed: B2.seed });
        dryBrush(ctx, [[x + 2, top + 14], [x + w - 2, top + 14]], { width: 3, color: mix(B2.color, INK7, 0.45), alpha: 0.55, passes: 2, dry: 0.4, seed: B2.seed });
        const R = R04("win", B2.seed);
        const cols = Math.max(2, Math.floor((w - 40) / 52)), gx = (w - 40) / cols;
        for (let y = top + 40; y < 450; y += 64) for (let c = 0; c < cols; c++) {
          const wx = x + 20 + c * gx + gx / 2 - 12, lit = R() < 0.3 + B2.lit * 0.25;
          const wp = roughPoly([[wx, y], [wx + 24, y], [wx + 24, y + 32], [wx, y + 32]], { amp: 0.8, step: 6, seed: B2.seed + c + y });
          ctx.beginPath();
          wp.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
          ctx.closePath();
          ctx.fillStyle = lit ? WARM : rgba(mix(B2.color, INK7, 0.3), 0.55);
          ctx.fill();
          ctx.strokeStyle = rgba(mix(B2.color, INK7, 0.5), 0.45);
          ctx.lineWidth = 1.2;
          ctx.stroke();
          if (lit) glow(ctx, wx + 12, y + 16, 34, "#ffd89a", 0.25);
        }
        const sx0 = x + 22, sx1 = x + w - 70;
        if (sx1 - sx0 > 60) {
          const sp = roughPoly([[sx0, 556], [sx1, 556], [sx1, 694], [sx0, 694]], { amp: 1.2, step: 8, seed: B2.seed + 5 });
          wash(ctx, sp, { color: SHOP, color2: "#f6cf98", alpha: 0.98, px: K, soft: 1.5, edge: 0.6, edgeW: 3, edgeColor: "#c99a6a", vary: 0.3, grain: 0.2, seed: B2.seed + 5 });
          const R2 = R04("shop", B2.seed);
          for (let k = 0; k < 3; k++) {
            const px = sx0 + 20 + R2() * (sx1 - sx0 - 40);
            dab(ctx, px, 640 + R2() * 20, 16 + R2() * 10, "#b79fb8", { alpha: 0.45, ry: 40 + R2() * 14, edge: 0.4, seed: B2.seed + k });
          }
          dryBrush(ctx, [[sx0, 556], [sx0, 694]], { width: 3, color: mix(B2.color, INK7, 0.4), alpha: 0.6, passes: 2, seed: B2.seed + 6 });
          dryBrush(ctx, [[(sx0 + sx1) / 2, 556], [(sx0 + sx1) / 2, 694]], { width: 2.4, color: mix(B2.color, INK7, 0.4), alpha: 0.5, passes: 2, seed: B2.seed + 7 });
          glow(ctx, (sx0 + sx1) / 2, 625, (sx1 - sx0) * 0.75, "#ffd7a0", 0.3);
          wash(ctx, [[sx1 + 12, 570], [x + w - 16, 570], [x + w - 16, 700], [sx1 + 12, 700]], { color: mix(B2.color, INK7, 0.35), alpha: 0.7, px: K, soft: 1, edge: 0.7, vary: 0.3, grain: 0.3, seed: B2.seed + 8 });
        }
        if (B2.awning) {
          const ap = roughPoly([[x + 10, 512], [x + w - 10, 512], [x + w + 4, 552], [x - 4, 552]], { amp: 1.2, step: 8, seed: B2.seed + 9 });
          wash(ctx, ap, { color: B2.awning, color2: mix(B2.awning, "#ffffff", 0.3), alpha: 0.85, px: K, soft: 1, edge: 1.1, edgeW: 3, vary: 0.35, grain: 0.3, seed: B2.seed + 9 });
          for (let ax = x; ax < x + w; ax += 34) dab(ctx, ax + 17, 554, 15, B2.awning, { alpha: 0.75, ry: 8, edge: 0.6, seed: ax, rough: 0.1 });
        }
        const N = neonShape(B2);
        if (N) {
          const [cx, cy] = neonCenter(N);
          glow(ctx, cx, cy, Math.max(N.w, N.h) * 1.6 + 80, B2.neonColor, 0.6);
          const p = neonPath(N);
          ctx.save();
          ctx.fillStyle = rgba(mix(B2.neonColor, "#ffffff", 0.12), 0.92);
          ctx.fill(p);
          ctx.lineWidth = 5;
          ctx.strokeStyle = mix(B2.neonColor, "#ffffff", 0.35);
          ctx.stroke(p);
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#fffaf0";
          ctx.stroke(p);
          ctx.strokeStyle = "#fffaf0";
          ctx.lineWidth = 3.4;
          ctx.lineCap = "round";
          ctx.beginPath();
          if (N.kind === "bar") for (let k = 0; k < 4; k++) {
            const u = N.x + 18 + k * (N.w - 36) / 3;
            ctx.moveTo(u - 10, cy + 6);
            ctx.lineTo(u, cy - 8);
            ctx.lineTo(u + 10, cy + 6);
          }
          else if (N.kind === "blade") for (let k = 0; k < 4; k++) {
            const v = N.y + 26 + k * (N.h - 52) / 3;
            ctx.moveTo(cx - 8, v);
            ctx.arc(cx, v, 8, Math.PI, Math.PI * 2);
          }
          else {
            ctx.moveTo(cx + 18, cy);
            ctx.arc(cx, cy, 18, 0, Math.PI * 2);
            ctx.moveTo(cx + 6, cy);
            ctx.arc(cx, cy, 6, 0, Math.PI * 2);
          }
          ctx.stroke();
          ctx.restore();
          if (N.kind === "blade") dryBrush(ctx, [[N.x + N.w, N.y + 20], [x + w, N.y + 20]], { width: 3, color: INK7, alpha: 0.6, passes: 1, seed: B2.seed });
        }
      }
      for (const T of G.trees) {
        if (T.x < x0 - 200 || T.x > x1 + 200) continue;
        dryBrush(ctx, [[T.x, MID_BASE + 6], [T.x - 4, MID_BASE - T.h * 0.5], [T.x + 6, MID_BASE - T.h * 0.8]], { width: 9, color: "#5b5f7e", alpha: 0.8, passes: 3, dry: 0.25, seed: T.seed });
        const R = R04("tree", T.seed);
        for (let k = 0; k < 7; k++) {
          const cx = T.x + (R() - 0.5) * 170, cy = MID_BASE - T.h + (R() - 0.3) * 120, r = 50 + R() * 50;
          wash(ctx, blobPts(cx, cy, r, r * 0.8, { seed: T.seed + k, rough: 0.3 }), { color: ["#86aaa6", "#9cbcb0", "#7f9fb0", "#a9c4b4"][k % 4], alpha: 0.55, px: K, soft: 2.5, edge: 1.1, edgeW: 3, vary: 0.45, grain: 0.35, seed: T.seed + k, blend: "multiply" });
        }
      }
      for (const L of G.lamps) {
        if (L.x < x0 - 200 || L.x > x1 + 200) continue;
        const sd = Math.round(L.x);
        dryBrush(ctx, [[L.x, MID_BASE + 8], [L.x, 330], [L.x + 4, 300], [L.x + 34, 286]], { width: 7, color: "#3f4c6b", alpha: 0.85, passes: 3, dry: 0.2, seed: sd });
        dryBrush(ctx, [[L.x - 12, MID_BASE + 8], [L.x + 12, MID_BASE + 8]], { width: 8, color: "#3f4c6b", alpha: 0.8, passes: 2, seed: sd + 1 });
        wash(ctx, [[L.x + 18, 280], [L.x + 58, 280], [L.x + 50, 300], [L.x + 26, 300]], { color: "#46557a", alpha: 0.9, px: K, soft: 0.6, edge: 0.6, vary: 0.2, grain: 0.2, seed: sd });
        glow(ctx, L.x + 38, 310, 190, "#ffe2a6", 0.55);
        dab(ctx, L.x + 38, 304, 11, LAMP2, { alpha: 1, ry: 6, edge: 0.2, seed: sd });
      }
    }, { y0: 60, y1: 730 });
  }
  function streetLayer() {
    return strip("s10-street", P_STREET, (ctx, x0, x1) => {
      wetRoad(ctx, x0, x1, STREET_Y0, CURB_Y + 8, { top: "#8f9cbd", bottom: "#a4afcc", ripple: "#6f7ea3", lights: "#e6eaf3", px: K, seed: 11, density: 1.2 });
      for (let x = x0 - x0 % 200; x < x1; x += 200) {
        dryBrush(ctx, [[x, 760], [x + 98, 760]], { width: 5, color: "#eef1f6", alpha: 0.85, passes: 2, dry: 0.3, seed: Math.round(x), wobble: 0.6 });
      }
    }, { y0: STREET_Y0 - 4, y1: CURB_Y + 10 });
  }
  function roadLayer4(env) {
    const c9 = env.camAt(GAG);
    return strip("s10-road", 1, (ctx, x0, x1) => {
      wash(ctx, [[x0, CURB_Y - 2], [x1, CURB_Y - 2], [x1, 808], [x0, 808]], { color: "#c6cbdc", color2: "#b4bbd2", alpha: 1, px: K, soft: 0.6, edge: 0.6, edgeW: 2, vary: 0.3, grain: 0.4, seed: 4 });
      dryBrush(ctx, [[x0, CURB_Y - 1], [x1, CURB_Y - 1]], { width: 2, color: "#6f7fa3", alpha: 0.6, passes: 2, dry: 0.3, seed: 5 });
      wetRoad(ctx, x0, x1, 806, 1e3, { top: "#a7b3cf", bottom: "#c9cfe2", ripple: "#7c8bb0", lights: "#f0f2f8", px: K, seed: 12 });
      const R = R04("tiles");
      for (let y of [846, 902, 968]) dryBrush(ctx, [[x0, y], [x1, y]], { width: 1.6, color: "#8090b2", alpha: 0.28, passes: 1, dry: 0.55, seed: y });
      for (let x = x0; x < x1; x += 150 + R() * 40) dryBrush(ctx, [[x, 810], [x - 40, 1e3]], { width: 1.4, color: "#8090b2", alpha: 0.2, passes: 1, dry: 0.6, seed: Math.round(x) });
      const puddles = [];
      for (let x = x0 + 200; x < x1; x += 380 + R() * 420) puddles.push([x, 860 + R() * 110, 70 + R() * 90]);
      puddles.push([CHAR_X + 130 + c9, 842, 190]);
      for (const [px, py, r] of puddles) {
        wash(ctx, blobPts(px, py, r, r * 0.16, { seed: Math.round(px), rough: 0.22 }), { color: "#e4e4f0", color2: "#f2dccf", grad: [px - r, py, px + r, py], alpha: 0.75, px: K, soft: 1.2, edge: 1, edgeW: 3, edgeColor: "#8794b6", vary: 0.3, grain: 0.2, seed: Math.round(px) % 31 });
      }
    }, { y0: CURB_Y - 6, y1: 1e3 });
  }
  function reflLayer(env) {
    const G = midGeo3(env.camAt(GAG));
    return strip("s10-refl", P_MID6, (ctx, x0, x1) => {
      for (const B2 of G.blds) {
        if (B2.x + B2.w < x0 - 50 || B2.x > x1 + 50) continue;
        wash(ctx, [[B2.x + 6, STREET_Y0 + 2], [B2.x + B2.w - 6, STREET_Y0 + 2], [B2.x + B2.w - 30, 930], [B2.x + 30, 930]], { color: B2.color, color2: "#c3c8dc", alpha: 0.16, px: K, soft: 14, edge: 0, vary: 0.5, grain: 0, seed: B2.seed });
      }
      for (const B2 of G.blds) {
        if (B2.x + B2.w < x0 - 50 || B2.x > x1 + 50) continue;
        const sx0 = B2.x + 22, sx1 = B2.x + B2.w - 70;
        if (sx1 - sx0 > 60) for (let k = 0; k < 2; k++) streak(ctx, lerp(sx0, sx1, 0.3 + k * 0.4), STREET_Y0 + 4, 985, { w: (sx1 - sx0) * 0.3, color: "#ffd99c", alpha: 0.42, seed: B2.seed + k, wobble: 5, gap: 6, taper: 0.4 });
        const N = neonShape(B2);
        if (N) streak(ctx, neonCenter(N)[0], STREET_Y0 + 2, 995, { w: Math.max(18, N.w * 0.7), color: B2.neonColor, alpha: 0.8, seed: B2.seed + 9, wobble: 7, gap: 6, taper: 0.6, fade: 0.7 });
      }
      for (const L of G.lamps) streak(ctx, L.x + 38, STREET_Y0 + 2, 990, { w: 22, color: LAMP2, alpha: 0.85, seed: Math.round(L.x), wobble: 5, gap: 5, taper: 0.8, fade: 0.75 });
    }, { y0: STREET_Y0 - 2, y1: 1e3 });
  }
  var CAR_L = 560;
  function carImage(color) {
    const pad = 30, w = (CAR_L + pad * 2) * K, h = (220 + pad) * K;
    return baked(`s10-car|${color}`, w, h, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(pad, 210);
      const body = roughPoly([[10, -36], [0, -66], [8, -96], [120, -112], [186, -168], [232, -188], [382, -188], [442, -158], [520, -120], [556, -106], [560, -62], [552, -36]], { amp: 1.2, step: 10, seed: 3 });
      wash(ctx, body, { color, color2: mix(color, "#2d3a5c", 0.3), alpha: 0.95, px: K, soft: 1, edge: 1.1, edgeW: 3, vary: 0.4, grain: 0.35, lift: 0.5, seed: 5 });
      for (const win of [[[196, -160], [238, -180], [302, -180], [302, -120], [162, -120]], [[314, -180], [378, -180], [428, -150], [432, -120], [314, -120]]]) {
        wash(ctx, roughPoly(win, { amp: 0.8, step: 8, seed: 7 }), { color: "#cfd6ea", color2: "#a9b4d2", alpha: 0.95, px: K, soft: 0.8, edge: 0.8, edgeW: 2, vary: 0.4, grain: 0.3, seed: 8 });
      }
      dryBrush(ctx, [[300, -118], [300, -50]], { width: 2, color: mix(color, INK7, 0.5), alpha: 0.6, passes: 1, seed: 9 });
      dryBrush(ctx, [[60, -70], [540, -70]], { width: 1.6, color: mix(color, "#ffffff", 0.4), alpha: 0.5, passes: 1, seed: 10 });
      for (const wx of [118, 444]) {
        wash(ctx, blobPts(wx, -40, 44, 44, { seed: wx, rough: 0.05, n: 28 }), { color: "#3c4766", alpha: 0.95, px: K, soft: 0.6, edge: 0.6, vary: 0.2, grain: 0.3, seed: wx });
        dab(ctx, wx, -40, 18, "#9aa6c4", { alpha: 0.9, edge: 0.5, seed: wx + 1, rough: 0.05 });
      }
      dab(ctx, 8, -84, 10, HEAD, { alpha: 1, ry: 7, edge: 0.4, seed: 1 });
      dab(ctx, 552, -96, 8, TAIL, { alpha: 1, ry: 10, edge: 0.4, seed: 2 });
    });
  }
  function drawCar(ctx, x, dir, color) {
    const img = carImage(color), pad = 30;
    const w = img.width / K, h = img.height / K;
    ctx.save();
    ctx.translate(x, LANE_Y);
    if (dir > 0) ctx.scale(-1, 1);
    ctx.fillStyle = "rgba(60,72,110,0.25)";
    ctx.beginPath();
    ctx.ellipse(CAR_L / 2, 4, CAR_L * 0.55, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, -pad, -210, w, h);
    const g = ctx.createLinearGradient(0, 0, -520, 0);
    g.addColorStop(0, rgba(HEAD, 0.55));
    g.addColorStop(1, rgba(HEAD, 0));
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, -90);
    ctx.lineTo(-520, -170);
    ctx.lineTo(-520, 10);
    ctx.lineTo(4, -76);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const head = dir < 0 ? x + 8 : x - 8, tail = dir < 0 ? x + 552 : x - 552;
    streak(ctx, head, LANE_Y + 2, 1e3, { w: 30, color: HEAD, alpha: 0.95, seed: 31, wobble: 6, gap: 5, taper: 0.9, fade: 0.6 });
    streak(ctx, tail, LANE_Y + 2, 960, { w: 22, color: TAIL, alpha: 0.75, seed: 32, wobble: 5, gap: 5, taper: 0.7, fade: 0.75 });
    glow(ctx, head + dir * 200, 880, 260, HEAD, 0.28);
  }
  var CARS = [
    { from: 3.9, to: 8, x0: X_MAX + 80, x1: X_MIN - 680, dir: -1, color: "#3f7b93" },
    { from: 12.3, to: 16.5, x0: X_MIN - 80, x1: X_MAX + 680, dir: 1, color: "#c9894f" }
  ];
  function drawRain(ctx, b, cam, k = 1) {
    const span = X_MAX - X_MIN + 200;
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 190 * k; i++) {
      const sp = 1100 + hash2(i, 1, 10) * 600, len = 26 + hash2(i, 2, 10) * 40;
      const y = (hash2(i, 3, 10) * 1200 + b * sp) % 1200 - 120;
      const x = ((hash2(i, 4, 10) * span - cam * P_RAIN + y * 0.18) % span + span) % span + X_MIN - 100;
      const light = i % 3 !== 0;
      ctx.strokeStyle = light ? "rgba(248,250,255,0.42)" : "rgba(70,92,132,0.24)";
      ctx.lineWidth = light ? 1.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - len * 0.18, y + len);
      ctx.stroke();
    }
    for (let i = 0; i < 36; i++) {
      const ph = ((b * 1.3 + hash2(i, 5, 10)) % 1 + 1) % 1, cyc = Math.floor(b * 1.3 + hash2(i, 5, 10));
      const wx = hash2(i, cyc, 11) * span, y = 812 + hash2(i, cyc, 12) * 180;
      const x = ((wx - cam) % span + span) % span + X_MIN - 100;
      const s1 = 0.5 + (y - 800) / 220;
      ctx.strokeStyle = `rgba(240,244,250,${(0.55 * (1 - ph)).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + ph * 18 * s1, (1.5 + ph * 4) * s1, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  var UR = 178;
  var UH = 100;
  var APEX_Y = -640;
  var STAND_HAND = ANCHORS.stand.handR;
  var STAND_APEX = [20, APEX_Y + 6];
  function canopyPts() {
    return memo("s10-canopy-pts", () => {
      const top = [], hem = [];
      for (let i = 0; i <= 36; i++) {
        const t = -1 + 2 * i / 36;
        top.push([UR * t, UH * (1 - Math.pow(1 - t * t, 0.62))]);
      }
      const tipY = (t) => UH + 14 * (1 - t * t);
      for (let i = 1; i < 36; i++) {
        const t = 1 - 2 * i / 36;
        const seg2 = (t + 1) / 0.5, f = seg2 - Math.floor(seg2);
        const y = tipY(t) - 14 * Math.sin(Math.PI * f);
        hem.push([UR * t * 0.985, y]);
      }
      return [...top, ...hem];
    });
  }
  var TIPS = [-1, -0.5, 0, 0.5, 1].map((t) => [UR * t, UH + 14 * (1 - t * t)]);
  function canopyImage() {
    const pad = 40, x0 = -UR - pad, y0 = -40 - pad, w = (2 * UR + 2 * pad) * K, h = (UH + 60 + 2 * pad) * K;
    const img = baked("s10-canopy", w, h, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-x0, -y0);
      const P2 = canopyPts();
      wash(ctx, P2, { color: UMB_L, color2: UMB, grad: [-UR, -10, UR * 0.6, UH], alpha: 0.97, px: K, soft: 0.8, edge: 1.3, edgeW: 3, edgeColor: UMB_D, vary: 0.4, grain: 0.3, lift: 0.35, seed: 61 });
      for (const [a, b2] of [[0, 1], [2, 3]]) {
        const tA = TIPS[a], tB = TIPS[b2];
        const panel = [[0, 0], ...canopyPts().slice(0, 37).filter(([x]) => x >= tA[0] && x <= tB[0]), tB, [lerp(tA[0], tB[0], 0.5), Math.max(tA[1], tB[1]) - 12], tA];
        wash(ctx, panel, { color: UMB, alpha: 0.38, px: K, soft: 1.5, edge: 0.6, edgeW: 2, edgeColor: UMB_D, vary: 0.5, grain: 0.2, seed: 70 + a, blend: "multiply" });
      }
      for (const [tx, ty] of TIPS) dryBrush(ctx, [[0, 2], [tx * 0.55, ty * 0.45 - 4], [tx, ty]], { width: 1.8, color: "#9b3a2e", alpha: 0.6, passes: 2, dry: 0.3, seed: 80 + Math.round(tx), wobble: 0.6 });
      dryBrush(ctx, [[0, 4], [0, -24]], { width: 4, color: "#3b3346", alpha: 0.9, passes: 2, dry: 0.1, seed: 90 });
    });
    return { img, x0, y0, w: w / K, h: h / K };
  }
  function handTrack() {
    const W2 = activeWalk();
    if (!W2) return null;
    return memo(`s10-hand|${W2.name}`, () => {
      const m = W2.meta, sc = FIGURE_H / m.personHeight;
      const raw2 = W2.frames.map((im) => {
        if (!im) return [...ANCHORS.walk.hand];
        const c = makeCanvas(m.width, m.height), g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(im, 0, 0);
        const ya = Math.round(m.baseY - 300 / sc), yb = Math.round(m.baseY - 205 / sc);
        const d = g.getImageData(0, ya, m.width, yb - ya).data;
        let bx = -1, by = 0;
        for (let y = 0; y < yb - ya; y++) for (let x = m.width - 1; x > bx; x--) if (d[(y * m.width + x) * 4 + 3] > 140) {
          bx = x;
          by = y;
          break;
        }
        if (bx < 0) return [...ANCHORS.walk.hand];
        return [(bx - 6 - m.anchorX) * sc, (by + ya + 8 - m.baseY) * sc];
      });
      const n = raw2.length;
      return raw2.map((_, i) => {
        let sx = 0, sy = 0, sw = 0;
        for (let k = -2; k <= 2; k++) {
          const p = raw2[(i + k + n) % n], wt = 3 - Math.abs(k);
          sx += p[0] * wt;
          sy += p[1] * wt;
          sw += wt;
        }
        return [sx / sw, sy / sw];
      });
    });
  }
  function umbrellaPose(fig) {
    if (fig.pose === "stand") {
      const [hx2, hy2] = STAND_HAND, [ax2, ay2] = STAND_APEX;
      return { hand: [hx2, hy2], apex: [ax2, ay2], ang: Math.atan2(-(hx2 - ax2), hy2 - ay2) };
    }
    const tr = handTrack();
    const [hx, hy] = tr ? tr[frameIndex(fig.phase || 0)] : ANCHORS.walk.hand;
    const ax = 6 + (hx - 30) * 0.3, ay = APEX_Y + (hy + 250) * 0.25;
    return { hand: [hx, hy], apex: [ax, ay], ang: Math.atan2(-(hx - ax), hy - ay) };
  }
  var rotP = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  function drawShaft2(ctx, hand, apex, alpha = 1) {
    if (alpha <= 0.01) return;
    const [hx, hy] = hand, [ax, ay] = apex;
    const dx = hx - ax, dy = hy - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#3b3346";
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(hx + ux * 22, hy + uy * 22);
    ctx.stroke();
    ctx.strokeStyle = "#8a5a3c";
    ctx.lineWidth = 8;
    const ex = hx + ux * 22, ey = hy + uy * 22;
    ctx.beginPath();
    ctx.moveTo(hx - ux * 14, hy - uy * 14);
    ctx.lineTo(ex, ey);
    ctx.quadraticCurveTo(ex + ux * 22, ey + uy * 22, ex - uy * 18 + ux * 10, ey + ux * 18 + uy * 10);
    ctx.stroke();
    ctx.restore();
  }
  function drawCanopy(ctx, apex, ang, alpha = 1) {
    const C = canopyImage();
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(apex[0], apex[1]);
    ctx.rotate(ang);
    ctx.drawImage(C.img, C.x0, C.y0, C.w, C.h);
    ctx.restore();
  }
  var MELT_STEPS = 24;
  var STREAM_X = 135;
  function meltShapes() {
    return memo("s10-melt-shapes", () => {
      const { apex, ang } = umbrellaPose({ pose: "stand" });
      const S0 = canopyPts().map((p) => {
        const [x, y] = rotP(p, ang);
        return [x + apex[0], y + apex[1]];
      });
      const n = S0.length, ys = S0.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const S1 = S0.map(([x, y], i) => {
        const hem = i > 36, hsh = hash2(i, 1, 51);
        const sag = hem ? 70 + 300 * Math.pow(hsh, 2.2) : 40 + 40 * hsh;
        return [x * 1.06 + 2, y + sag];
      });
      const S2 = S0.map((_, i) => {
        const th = i <= 36 ? Math.PI + Math.PI * (i / 36) : Math.PI * ((i - 36) / (n - 36));
        const r = 1 + (noise2(Math.cos(th) * 2, Math.sin(th) * 2, 52) - 0.5) * 0.25;
        return [130 + Math.cos(th) * 205 * r, 10 + Math.sin(th) * 22 * r];
      });
      const H2 = S0.map(([, y]) => (y - y0) / (y1 - y0 || 1));
      return { S0, S1, S2, H: H2 };
    });
  }
  function meltPts(u) {
    const { S0, S1, S2, H: H2 } = meltShapes();
    const p1 = ease.inOut(clamp(u / 0.4));
    return S0.map((a, i) => {
      const b1 = S1[i];
      const x = lerp(a[0], b1[0], p1), y = lerp(a[1], b1[1], p1);
      const t2 = clamp((u - 0.3 - (1 - H2[i]) * 0.25) / 0.45);
      const e = t2 * t2 * (3 - 2 * t2);
      const xx = lerp(x, S2[i][0], e), squeeze = Math.pow(Math.sin(Math.PI * e), 0.6) * 0.92;
      return [lerp(xx, STREAM_X + (xx - STREAM_X) * 0.1, squeeze), lerp(y, S2[i][1], e)];
    });
  }
  function meltImage(k) {
    const P0 = meltPts(k / (MELT_STEPS - 1)), { apex } = umbrellaPose({ pose: "stand" });
    const x0 = Math.min(...P0.map((p) => p[0]), STAND_HAND[0]) - 30, x1 = Math.max(...P0.map((p) => p[0]), STAND_HAND[0]) + 30;
    const y0 = Math.min(...P0.map((p) => p[1]), apex[1]) - 30, y1 = Math.min(60, Math.max(...P0.map((p) => p[1]), STAND_HAND[1]) + 230);
    const img = baked(`s10-melt|${k}`, (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-x0, -y0);
      const u = k / (MELT_STEPS - 1);
      const P2 = meltPts(u);
      wash(ctx, P2, { color: UMB_L, color2: UMB, alpha: 0.95, px: K, soft: 1 + u * 3, edge: 1.4, edgeW: 3 + u * 3, edgeColor: UMB_D, vary: 0.45, grain: 0.3, blooms: u > 0.3 ? 2 : 0, seed: 100 + k });
      if (u > 0.05 && u < 0.9) {
        ctx.save();
        ctx.lineCap = "round";
        for (let i = 38; i < P2.length; i += 5) {
          const len = (40 + 160 * hash2(i, 2, 53)) * Math.sin(Math.PI * clamp((u - 0.05) / 0.85));
          const [px, py] = P2[i];
          const end = Math.min(py + len, 4);
          if (end <= py) continue;
          ctx.strokeStyle = rgba(UMB, 0.75);
          ctx.lineWidth = 3 + 4 * hash2(i, 3, 53);
          ctx.beginPath();
          ctx.moveTo(px, py - 4);
          ctx.lineTo(px + 1, end);
          ctx.stroke();
          ctx.fillStyle = rgba(UMB_D, 0.8);
          ctx.beginPath();
          ctx.arc(px + 1, end, ctx.lineWidth * 0.8, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      const { apex: apex2 } = umbrellaPose({ pose: "stand" });
      const top = [lerp(apex2[0], STAND_HAND[0], clamp(u * 1.4)), lerp(apex2[1], STAND_HAND[1], clamp(u * 1.4))];
      drawShaft2(ctx, STAND_HAND, top, 1 - smoothstep(0.2, 0.65, u));
    });
    return { img, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  function drawUmbrella(ctx, fig, b, part) {
    const u = umbMelt(b);
    if (u > 1e-3 && fig.pose === "stand") {
      const k = Math.round(u * (MELT_STEPS - 1));
      if (part === "front" === u < 0.62) {
        const M2 = meltImage(k);
        ctx.drawImage(M2.img, M2.x0, M2.y0, M2.w, M2.h);
      }
      if (part === "front" && u < 0.18) {
        const P3 = umbrellaPose(fig);
        drawCanopy(ctx, P3.apex, P3.ang, 1 - u / 0.18);
      }
      return;
    }
    if (part !== "front") return;
    const P2 = umbrellaPose(fig);
    drawShaft2(ctx, P2.hand, P2.apex);
    drawCanopy(ctx, P2.apex, P2.ang);
    drawUmbrellaRain(ctx, fig, b, P2);
  }
  function drawUmbrellaRain(ctx, fig, b, P2) {
    const toFig = (p) => {
      const [x, y] = rotP(p, P2.ang);
      return [x + P2.apex[0], y + P2.apex[1]];
    };
    ctx.save();
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const ph = ((b * 3 + hash2(i, 1, 60)) % 1 + 1) % 1, cyc = Math.floor(b * 3 + hash2(i, 1, 60));
      const t = (hash2(i, cyc, 61) - 0.5) * 1.8;
      const [x, y] = toFig([UR * t, UH * (1 - Math.pow(1 - t * t, 0.62)) - 3]);
      ctx.strokeStyle = `rgba(250,250,255,${(0.8 * (1 - ph)).toFixed(3)})`;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, 3 + ph * 10, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
    const drop = (x, y, r, a = 1) => {
      ctx.globalAlpha = a;
      ctx.fillStyle = "rgba(214,228,246,0.9)";
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(52,74,112,0.75)";
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    };
    if (fig.pose === "stand" && b >= T_BEADS - 0.1 && b < T_BEADS + 2.2) {
      const tips = [4, 0, 3, 1, 4];
      for (let k = 0; k < 5; k++) {
        const s0 = T_BEADS + k * 0.36, tt = b - s0;
        if (tt < 0) continue;
        const tip = TIPS[tips[k]], start = [tip[0] * 0.12, UH * 0.05 + 2];
        const roll = clamp(tt / 0.5), hang = tt - 0.5, r = 4.5 + k % 2;
        if (roll < 1) {
          const e = roll * roll;
          const lx = lerp(start[0], tip[0], e);
          const t = lx / UR, ly = Math.abs(tip[0]) > UR * 0.9 ? UH * (1 - Math.pow(1 - Math.min(1, t * t), 0.62)) : lerp(start[1], tip[1], e);
          const [x, y] = toFig([lx, ly - 4]);
          drop(x, y, r);
        } else if (hang < 0.28) {
          const [x, y] = toFig([tip[0], tip[1] + 3 + hang * 14]);
          drop(x, y, r * (1 + hang * 1.2));
        } else {
          const ft = (hang - 0.28) / 0.32;
          const [x, y0] = toFig([tip[0], tip[1] + 7]);
          const y = y0 + ft * ft * -y0;
          if (ft < 1) {
            ctx.strokeStyle = "rgba(214,228,246,0.9)";
            ctx.lineWidth = r * 1.2;
            ctx.beginPath();
            ctx.moveTo(x, y - 12);
            ctx.lineTo(x, y);
            ctx.stroke();
            drop(x, y, r * 0.8);
          } else if (ft < 1.8) {
            const sp = (ft - 1) / 0.8;
            ctx.strokeStyle = `rgba(240,244,250,${(0.9 * (1 - sp)).toFixed(3)})`;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.ellipse(x, 0, 6 + sp * 22, 2 + sp * 4, 0, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      }
    } else if (fig.pose !== "stand") {
      const b0 = Math.floor(b), tt = b - b0;
      if (tt < 0.5) {
        const tip = TIPS[hash2(b0, 1, 62) < 0.5 ? 0 : 1];
        const [x, y0] = toFig([tip[0], tip[1] + 6]);
        const y = y0 + (tt / 0.5) ** 2 * -y0;
        ctx.strokeStyle = "rgba(214,228,246,0.85)";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x - tt * 150, y - 10);
        ctx.lineTo(x - tt * 150, y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  var reflCanvas = null;
  function drawReflection(ctx, fig, b) {
    const RX0 = -260, RX1 = 360, RH = 200;
    const w = Math.ceil((RX1 - RX0) * K), h = Math.ceil(RH * K);
    if (!reflCanvas) reflCanvas = makeCanvas(w, h);
    const g = reflCanvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.globalAlpha = 1;
    g.clearRect(0, 0, w, h);
    g.setTransform(K, 0, 0, -K, -RX0 * K, 0);
    drawWalker(g, { ...fig, rim: null });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-in";
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(0,0,0,0.42)");
    gr.addColorStop(0.6, "rgba(0,0,0,0.12)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    const band = 6;
    for (let y = 0; y < h; y += band) {
      const dx = Math.sin(y * 0.21 + b * 5) * (1.5 + y / h * 5);
      ctx.drawImage(reflCanvas, 0, y, w, band, RX0 + dx, 4 + y / K, w / K, band / K);
    }
  }
  function drawBigDrop(ctx, b, env) {
    if (b < T_DROP || b > T_MELT + 0.45) return;
    const fig = env.figure();
    const [ax, ay] = STAND_APEX;
    const tx = fig.x + ax * fig.scale, ty = fig.y + (ay - 6) * fig.scale;
    ctx.save();
    if (b < T_MELT) {
      const t = (b - T_DROP) / (T_MELT - T_DROP);
      const y = lerp(-60, ty, t * t), x = tx + (1 - t) * 30;
      ctx.fillStyle = "rgba(200,218,242,0.95)";
      ctx.strokeStyle = "rgba(40,62,104,0.85)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y - 34);
      ctx.quadraticCurveTo(x + 12, y - 4, x, y + 6);
      ctx.quadraticCurveTo(x - 12, y - 4, x, y - 34);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x - 3, y - 6, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const t = (b - T_MELT) / 0.45;
      ctx.strokeStyle = `rgba(235,242,252,${(0.95 * (1 - t)).toFixed(3)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(tx, ty, 10 + t * 70, 4 + t * 16, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(214,228,246,${(1 - t).toFixed(3)})`;
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.05 + k / 8 * 0.9), d = 20 + t * 90;
        ctx.beginPath();
        ctx.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.7 + t * t * 60, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
  function paintBack(ctx, b, env) {
    const cam = env.cam;
    drawStrip(ctx, skyLayer5(), cam);
    drawStrip(ctx, farLayer7(), cam);
    drawStrip(ctx, midLayer6(env), cam);
    const G = midGeo3(env.camAt(GAG));
    const beatK = Math.exp(-((b % 1 + 1) % 1) * 4);
    for (const B2 of G.blds) {
      const N = neonShape(B2);
      if (!N) continue;
      const [cx, cy] = neonCenter(N), sx = cx - cam * P_MID6;
      if (sx < X_MIN - 200 || sx > X_MAX + 200) continue;
      glow(ctx, sx, cy, Math.max(N.w, N.h) + 70, B2.neonColor, 0.12 + 0.18 * beatK);
    }
    drawStrip(ctx, streetLayer(), cam);
    drawStrip(ctx, roadLayer4(env), cam);
    drawStrip(ctx, reflLayer(env), cam);
    for (const C of CARS) {
      if (b < C.from || b > C.to) continue;
      const t = (b - C.from) / (C.to - C.from);
      drawCar(ctx, lerp(C.x0, C.x1, t), C.dir, C.color);
    }
  }
  var s10 = {
    id: "s10",
    station: ST10,
    figureStyle: "s10-wc",
    // 蓝调背景前黑衣容易贴色：暖白轮廓光（像路灯照出来的边，也像水彩里留出的纸白）
    figureRim: { color: "#fff3dc", width: 5, alpha: 1 },
    freezeBeat: GAG + 3,
    // Outro 展墙：伞已复原，雨珠正从伞尖滴落
    drawFigure(ctx, fig, b, env) {
      if (fig.pose === "walk" || fig.pose === "stand") drawReflection(ctx, fig, b);
      drawUmbrella(ctx, fig, b, "back");
      const m = meltAmt(b);
      if (m > 0.01) {
        ctx.save();
        for (let k = 1; k <= 1; k++) {
          ctx.globalAlpha = 0.28 * m;
          ctx.save();
          ctx.translate(0, 26 * m);
          drawWalker(ctx, { ...fig, rim: null });
          ctx.restore();
        }
        ctx.restore();
      }
      drawWalker(ctx, fig);
      drawUmbrella(ctx, fig, b, "front");
    },
    drawBack(ctx, b, env) {
      const m = meltAmt(b);
      if (m < 2e-3) {
        paintBack(ctx, b, env);
        return;
      }
      const S = captureUnits("s10", (g) => paintBack(g, b, env), 0.5);
      runDown(ctx, S, { x: X_MIN, y: 0, w: X_MAX - X_MIN, h: 1e3 }, m, { run: 0.24, seed: 7, paper: PAPER7, copies: 4 });
    },
    drawFront(ctx, b, env) {
      drawBigDrop(ctx, b, env);
      drawRain(ctx, b, env.cam);
      const pw = Math.round((X_MAX - X_MIN) * K), ph = Math.round(1e3 * K);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      ctx.drawImage(paperTooth(pw, ph, { seed: 7, amount: 0.9 }), X_MIN, 0, X_MAX - X_MIN, 1e3);
      ctx.restore();
      ctx.drawImage(deckle(pw, ph, { color: PAPER7, seed: 9, sides: { top: 0, right: 22, bottom: 40, left: 22 } }), X_MIN, 0, X_MAX - X_MIN, 1e3);
    },
    drawFrame(ctx, R) {
      drawWcFrame(ctx, R, { paper: "#f7f5f0", colors: ["#8fb0d8", "#c7b3dc", "#f2c3a6", "#9fd0d8"], seed: 21 });
    },
    cardStyle: {
      ink: INK7,
      accent: "#c4553b",
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        drawWcCard(ctx, x, y, w, h, { paper: "#fbfaf6", color: "#6f97c8", color2: "#e3a3bd", seed: 3, inset: 34 });
      }
    },
    playerStyle: {
      ink: INK7,
      noteColor: "#c4553b",
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        drawWcCard(ctx, x, y, w, h, { paper: "#fbfaf6", color: "#6f97c8", seed: 5, inset: 20 });
      },
      drawPlayer(ctx, kind, cx, cy, sc, spin) {
        const r = 78;
        const D = wcDisc(r, { colors: ["#7fa8d8", "#e58fb0", "#f2d16b", "#6fc7d6"], paper: "#fbfaf6", ink: INK7, seed: 31 });
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(sc, sc);
        ctx.fillStyle = "rgba(40,55,90,0.16)";
        ctx.beginPath();
        ctx.ellipse(4, 8, r, r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.rotate(spin);
        ctx.drawImage(D, -D.width / 2, -D.height / 2);
        ctx.restore();
      }
    }
  };

  // src/scenes/s11.js
  var ST11 = stationByN(11);
  var SCREEN = "#fff4dc";
  var OUT = "#2a1409";
  var BLACK = "#24130b";
  var RED2 = "#b3311f";
  var RED_D2 = "#86231a";
  var YEL = "#e2a63e";
  var YEL_L = "#f0c96e";
  var GRN = "#3d7a45";
  var GRN_D = "#2b5a3a";
  var TEAL2 = "#2f7568";
  var HIDE = "#d6a058";
  var HIDE_L = "#efcf8c";
  var BRASS = "#d8a743";
  var ROD = "#3a1f10";
  var LACQ = "#6e2114";
  var LACQ_D = "#3e130b";
  var WOOD = "#8a4a26";
  var WOOD_L = "#b8763e";
  var GOLD3 = "#d4a24c";
  var SHADOW = "#5a3018";
  var SCR = { y0: 34, y1: 892 };
  var GROUND_END = SCR.y1 - ROAD_Y;
  var SCH_SX = 840;
  var LAMP_X = 520;
  var LAMP_Y2 = 236;
  var LEAVE = STATION.leave[0];
  var T_HORSE = [SB(5) - 0.2, SB(8) + 0.7];
  var T_FLIP = SB(14);
  var rawB2 = (env) => env.gb - env.sec.start;
  var frameNo2 = (b) => Math.round(b * 1e3);
  function swing(b, rb) {
    if (rb < GAG) return 0;
    const x = Math.max(0, b - GAG);
    if (rb < LEAVE) return Math.cos(Math.PI * x) * keyframes([[-0.3, 0.7], [0.02, 0.75], [0.12, 1.15], [0.3, 1]], b - GAG);
    const t = rb - LEAVE;
    return t < 0.9 ? Math.cos(Math.PI * x) * 0.3 * (1 - t / 0.9) : 0;
  }
  function lampAt(b, rb) {
    const q = frameNo2(b);
    const sw = swing(b, rb);
    const x = LAMP_X + (noise2(b * 0.9, 0.3, 1101) - 0.5) * 36 + (hash2(q, 1, 1102) - 0.5) * 10 + sw * 250;
    const tilt = (hash2(q, 2, 1102) - 0.5) * 0.22 + (noise2(b * 1.7, 0.7, 1103) - 0.5) * 0.3 - sw * 0.85;
    const size = 1 + (hash2(q, 4, 1102) - 0.5) * 0.16 + Math.abs(sw) * 0.25;
    let f = (hash2(q, 3, 1102) - 0.5) * 0.05 - 0.06 * Math.abs(sw);
    const d9 = rb - GAG, d13 = rb - LEAVE;
    if (d9 >= 0 && d9 < 0.14) f += 0.3;
    else if (d9 >= 0.14 && d9 < 0.75) f -= 0.2 * (1 - (d9 - 0.14) / 0.61);
    if (d13 >= 0 && d13 < 0.55) f += 0.2 * (1 - d13 / 0.55);
    return { x, tilt, size, f, sw };
  }
  var shadowShift = (L, depth) => -(L.x - LAMP_X) * depth;
  function mottle() {
    return memo("s11-mottle", () => {
      const S = 192, c = makeCanvas(S, S), g = c.getContext("2d");
      const im = g.createImageData(S, S);
      const f = (x, y) => fbm(x / 30, y / 30, 1111, 3);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const v = (f(x, y) * (S - x) * (S - y) + f(x - S, y) * x * (S - y) + f(x, y - S) * (S - x) * y + f(x - S, y - S) * x * y) / (S * S);
        const p = (y * S + x) * 4;
        const fiber = hash2(x >> 1, y, 1112) < 0.05 ? 0.12 : 0;
        im.data[p] = 40;
        im.data[p + 1] = 18;
        im.data[p + 2] = 6;
        im.data[p + 3] = 255 * Math.min(0.5, Math.max(0, (v - 0.42) * 1.1) + fiber);
      }
      g.putImageData(im, 0, 0);
      return c;
    });
  }
  function leather(g, path, fill, { line: line2 = 2.4, rim = 4, cut = null, edge = OUT, tex = 0.55, union = false } = {}) {
    g.save();
    if (union) {
      g.lineWidth = line2 * 2;
      g.strokeStyle = edge;
      g.lineJoin = "round";
      g.stroke(path);
      rim = 0;
      line2 = 0;
    }
    g.fillStyle = fill;
    g.fill(path);
    if (tex) {
      g.save();
      g.clip(path);
      g.globalAlpha = tex;
      g.fillStyle = g.createPattern(mottle(), "repeat");
      g.fill(path);
      g.restore();
    }
    if (cut) {
      g.save();
      g.clip(path);
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "#000";
      g.strokeStyle = "#000";
      g.lineCap = "round";
      g.lineJoin = "round";
      cut(g);
      g.restore();
    }
    if (rim) {
      g.lineWidth = rim;
      g.strokeStyle = fill;
      g.stroke(path);
    }
    if (line2) {
      g.lineWidth = line2;
      g.strokeStyle = edge;
      g.lineJoin = "round";
      g.stroke(path);
    }
    g.restore();
  }
  var cutDot = (g, x, y, r) => {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  };
  var cutRing = (g, x, y, r, w) => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.stroke();
  };
  var cutDiamond = (g, x, y, r) => {
    g.beginPath();
    g.moveTo(x, y - r);
    g.lineTo(x + r, y);
    g.lineTo(x, y + r);
    g.lineTo(x - r, y);
    g.closePath();
    g.fill();
  };
  function cutLine(g, pts, w) {
    g.lineWidth = w;
    g.beginPath();
    pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.stroke();
  }
  function cutGrid(x0, y0, x1, y1, sp, fn, stagger = true) {
    for (let j = 0, y = y0; y <= y1; y += sp, j++) for (let x = x0 + (stagger && j % 2 ? sp / 2 : 0); x <= x1; x += sp) fn(x, y, j);
  }
  function cutCoin(g, x, y, r) {
    cutRing(g, x, y, r, Math.max(1.2, r * 0.22));
    g.fillRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56);
  }
  function cutMeander(g, x, y, s, w) {
    cutLine(g, [[x, y + s], [x, y], [x + s, y], [x + s, y + s * 0.78], [x + s * 0.24, y + s * 0.78], [x + s * 0.24, y + s * 0.26], [x + s * 0.74, y + s * 0.26], [x + s * 0.74, y + s * 0.54]], w);
  }
  function cutSpiral(g, cx, cy, r, turns, w, dir = 1) {
    const pts = [];
    for (let t = 0; t <= 1; t += 0.03) {
      const a = dir * t * turns * TAU, rr = r * (1 - t * 0.85);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    cutLine(g, pts, w);
  }
  function cutLeaf(g, x, y, l, wd, a) {
    g.beginPath();
    g.ellipse(x, y, l, wd, a, 0, TAU);
    g.fill();
  }
  function cutPetals(g, cx, cy, r, n, l, wd, a0 = 0) {
    for (let i = 0; i < n; i++) {
      const a = a0 + i / n * TAU;
      cutLeaf(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, l, wd, a);
    }
  }
  function rivet(g, x, y, r) {
    g.save();
    g.fillStyle = OUT;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = BRASS;
    g.beginPath();
    g.arc(x, y, r * 0.72, 0, TAU);
    g.fill();
    g.fillStyle = "#fbe6a8";
    g.beginPath();
    g.arc(x - r * 0.25, y - r * 0.25, r * 0.28, 0, TAU);
    g.fill();
    g.restore();
  }
  function rodShadow(ctx, x, y, dx, w = 4) {
    ctx.save();
    ctx.strokeStyle = rgba(ROD, 0.72);
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx, GROUND_END);
    ctx.stroke();
    ctx.restore();
    rivet(ctx, x, y, w * 1.3);
  }
  function pieceOn(ctx, ox, oy, bb, draw, alpha = 0.93) {
    const c = pieceCanvas(bb, draw);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(c, ox + bb[0], oy + bb[1], bb[2] - bb[0], bb[3] - bb[1]);
    ctx.restore();
  }
  function pieceCanvas(bb, draw) {
    const c = makeCanvas((bb[2] - bb[0]) * K, (bb[3] - bb[1]) * K);
    const g = c.getContext("2d");
    g.scale(K, K);
    g.translate(-bb[0], -bb[1]);
    draw(g);
    return c;
  }
  function partCanvas(key, bb, draw) {
    return memo(`s11-part|${key}`, () => pieceCanvas(bb, draw));
  }
  function drawPart(ctx, key, bb, draw, alpha = 0.94) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.drawImage(partCanvas(key, bb, draw), bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
    ctx.restore();
  }
  var P = (fn) => {
    const p = new Path2D();
    fn(p);
    return p;
  };
  function blobs(list) {
    return P((p) => {
      for (const [x, y, r] of list) {
        p.moveTo(x + r, y);
        p.arc(x, y, r, 0, TAU);
      }
    });
  }
  function screenImg() {
    const w = X_MAX - X_MIN;
    return baked("s11-screen", w * K, 1e3 * K, (g) => {
      g.scale(K, K);
      g.translate(-X_MIN, 0);
      g.fillStyle = SCREEN;
      g.fillRect(X_MIN, 0, w, 1e3);
      g.strokeStyle = rgba("#c9a46a", 0.06);
      g.lineWidth = 0.6;
      for (let x = X_MIN; x < X_MAX; x += 3.2) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 1e3);
        g.stroke();
      }
      for (let y = 0; y < 1e3; y += 3.4) {
        g.beginPath();
        g.moveTo(X_MIN, y);
        g.lineTo(X_MAX, y);
        g.stroke();
      }
      const R = rng("s11-cloth");
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rgba("#b88a4c", 0.025 + R() * 0.04);
        ellipse(g, R.range(X_MIN, X_MAX), R.range(0, 1e3), R.range(6, 40), R.range(3, 14));
        g.fill();
      }
      for (const sx of [-60, 470, 1010]) {
        g.strokeStyle = rgba("#b58a52", 0.22);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(sx, 0);
        g.lineTo(sx, 1e3);
        g.stroke();
        g.strokeStyle = rgba("#ffffff", 0.5);
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(sx + 2.4, 0);
        g.lineTo(sx + 2.4, 1e3);
        g.stroke();
      }
      let gr = g.createLinearGradient(0, SCR.y0, 0, SCR.y0 + 40);
      gr.addColorStop(0, rgba("#6a3a18", 0.35));
      gr.addColorStop(1, rgba("#6a3a18", 0));
      g.fillStyle = gr;
      g.fillRect(X_MIN, SCR.y0, w, 40);
      gr = g.createLinearGradient(0, SCR.y1 - 24, 0, SCR.y1);
      gr.addColorStop(0, rgba("#6a3a18", 0));
      gr.addColorStop(1, rgba("#6a3a18", 0.25));
      g.fillStyle = gr;
      g.fillRect(X_MIN, SCR.y1 - 24, w, 24);
    });
  }
  var LM = { x0: -1100, x1: 2100, cy: 340 };
  function lightMap() {
    const s = 0.25 * K;
    return baked("s11-light", (LM.x1 - LM.x0) * s, (SCR.y1 - SCR.y0) * s, (g) => {
      g.scale(s, s);
      g.translate(-LM.x0, -SCR.y0);
      g.save();
      g.translate(LAMP_X, LM.cy);
      g.scale(1, 0.64);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1250);
      gr.addColorStop(0, "#ffffff");
      gr.addColorStop(0.3, "#fff7e8");
      gr.addColorStop(0.55, "#f9e3b8");
      gr.addColorStop(0.78, "#ebc187");
      gr.addColorStop(1, "#d39858");
      g.fillStyle = gr;
      g.fillRect(-3e3, -3e3, 6e3, 6e3);
      g.restore();
    });
  }
  function drawLampGlow(ctx, L) {
    const x = L.x, y = LAMP_Y2;
    ctx.save();
    let gr = ctx.createRadialGradient(x, y + 20, 0, x, y + 20, 300 * L.size);
    gr.addColorStop(0, rgba("#fffef6", 1));
    gr.addColorStop(0.12, rgba("#fff0bf", 0.95));
    gr.addColorStop(0.35, rgba("#ffd98a", 0.55));
    gr.addColorStop(0.7, rgba("#ffcf7a", 0.16));
    gr.addColorStop(1, rgba("#ffcf7a", 0));
    ctx.fillStyle = gr;
    ctx.fillRect(x - 320, y - 300, 640, 640);
    ctx.translate(x, y + 30);
    ctx.rotate(L.tilt);
    ctx.scale(L.size, L.size);
    gr = ctx.createRadialGradient(0, -14, 2, 0, -10, 44);
    gr.addColorStop(0, rgba("#ffffff", 1));
    gr.addColorStop(0.5, rgba("#fff3c4", 0.95));
    gr.addColorStop(1, rgba("#ffc65a", 0));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.bezierCurveTo(16, -40, 22, -12, 18, 2);
    ctx.bezierCurveTo(14, 16, -14, 16, -18, 2);
    ctx.bezierCurveTo(-22, -12, -16, -40, 0, -70);
    ctx.fill();
    ctx.restore();
  }
  function drawLight(ctx, L) {
    const w = X_MAX - X_MIN, h = SCR.y1 - SCR.y0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(X_MIN, SCR.y0, w, h);
    ctx.clip();
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(lightMap(), LM.x0 + (L.x - LAMP_X), SCR.y0, LM.x1 - LM.x0, h);
    ctx.globalCompositeOperation = "source-over";
    if (L.f < 0) {
      ctx.fillStyle = rgba("#4a2410", -L.f);
      ctx.fillRect(X_MIN, SCR.y0, w, h);
    } else if (L.f > 0) {
      ctx.globalCompositeOperation = "screen";
      ctx.fillStyle = rgba("#fff0c8", L.f);
      ctx.fillRect(X_MIN, SCR.y0, w, h);
    }
    ctx.restore();
  }
  function stageImg() {
    const w = X_MAX - X_MIN;
    return baked("s11-stage", w * K, 1e3 * K, (g) => {
      g.scale(K, K);
      g.translate(-X_MIN, 0);
      let gr = g.createLinearGradient(0, 0, 0, SCR.y0);
      gr.addColorStop(0, LACQ_D);
      gr.addColorStop(0.5, LACQ);
      gr.addColorStop(1, LACQ_D);
      g.fillStyle = gr;
      g.fillRect(X_MIN, 0, w, SCR.y0);
      g.strokeStyle = GOLD3;
      g.lineWidth = 1.6;
      for (const y of [4, SCR.y0 - 4]) {
        g.beginPath();
        g.moveTo(X_MIN, y);
        g.lineTo(X_MAX, y);
        g.stroke();
      }
      g.lineWidth = 1.5;
      g.strokeStyle = rgba(GOLD3, 0.85);
      for (let x = X_MIN + 8; x < X_MAX; x += 36) {
        const s = 14, y = 10;
        g.beginPath();
        g.moveTo(x, y + s);
        g.lineTo(x, y);
        g.lineTo(x + s, y);
        g.lineTo(x + s, y + s * 0.78);
        g.lineTo(x + s * 0.24, y + s * 0.78);
        g.lineTo(x + s * 0.24, y + s * 0.3);
        g.lineTo(x + s * 0.7, y + s * 0.3);
        g.stroke();
        g.fillStyle = GOLD3;
        circle(g, x + 27, 17, 2.2);
        g.fill();
      }
      g.fillStyle = LACQ_D;
      for (let x = X_MIN; x < X_MAX; x += 22) {
        g.beginPath();
        g.arc(x + 11, SCR.y0, 11, 0, Math.PI);
        g.fill();
      }
      g.strokeStyle = rgba(GOLD3, 0.7);
      g.lineWidth = 1.2;
      for (let x = X_MIN; x < X_MAX; x += 22) {
        g.beginPath();
        g.arc(x + 11, SCR.y0, 8, 0.2, Math.PI - 0.2);
        g.stroke();
      }
      for (const side of [-1, 1]) {
        g.save();
        if (side > 0) {
          g.translate(X_MAX + X_MIN, 0);
          g.scale(-1, 1);
        }
        const x0 = X_MIN + 20;
        const br = P((p) => {
          p.moveTo(x0, SCR.y0);
          p.lineTo(x0 + 190, SCR.y0);
          p.bezierCurveTo(x0 + 150, SCR.y0 + 10, x0 + 120, SCR.y0 + 26, x0 + 104, SCR.y0 + 48);
          p.bezierCurveTo(x0 + 80, SCR.y0 + 40, x0 + 60, SCR.y0 + 60, x0 + 58, SCR.y0 + 84);
          p.bezierCurveTo(x0 + 34, SCR.y0 + 86, x0 + 16, SCR.y0 + 110, x0 + 14, SCR.y0 + 150);
          p.lineTo(x0, SCR.y0 + 150);
          p.closePath();
        });
        g.fillStyle = LACQ;
        g.fill(br);
        g.save();
        g.clip(br);
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = "#000";
        g.strokeStyle = "#000";
        g.lineCap = "round";
        cutSpiral(g, x0 + 66, SCR.y0 + 22, 14, 1.3, 3.2);
        cutSpiral(g, x0 + 30, SCR.y0 + 58, 12, 1.3, 3, -1);
        cutSpiral(g, x0 + 14, SCR.y0 + 104, 7, 1.2, 2.4);
        cutLeaf(g, x0 + 120, SCR.y0 + 12, 22, 4, 0);
        g.restore();
        g.strokeStyle = GOLD3;
        g.lineWidth = 1.8;
        g.stroke(br);
        g.restore();
      }
      for (const x of [X_MIN, X_MAX - 22]) {
        gr = g.createLinearGradient(x, 0, x + 22, 0);
        gr.addColorStop(0, LACQ_D);
        gr.addColorStop(0.45, LACQ);
        gr.addColorStop(1, LACQ_D);
        g.fillStyle = gr;
        g.fillRect(x, 0, 22, 1e3);
        g.strokeStyle = rgba(GOLD3, 0.8);
        g.lineWidth = 1.2;
        g.strokeRect(x + 5, SCR.y0 + 4, 12, SCR.y1 - SCR.y0 - 8);
      }
      gr = g.createLinearGradient(0, SCR.y1, 0, SCR.y1 + 18);
      gr.addColorStop(0, "#e6b06a");
      gr.addColorStop(0.3, WOOD_L);
      gr.addColorStop(1, WOOD);
      g.fillStyle = gr;
      g.fillRect(X_MIN, SCR.y1, w, 18);
      gr = g.createLinearGradient(0, SCR.y1 + 18, 0, 1e3);
      gr.addColorStop(0, "#5a1c10");
      gr.addColorStop(1, LACQ_D);
      g.fillStyle = gr;
      g.fillRect(X_MIN, SCR.y1 + 18, w, 1e3 - SCR.y1 - 18);
      g.fillStyle = rgba("#000000", 0.35);
      g.fillRect(X_MIN, SCR.y1 + 18, w, 4);
      for (let x = X_MIN + 30; x < X_MAX - 60; x += 250) {
        roundRect(g, x, SCR.y1 + 34, 220, 56, 8);
        g.fillStyle = rgba("#2a0a05", 0.35);
        g.fill();
        g.strokeStyle = GOLD3;
        g.lineWidth = 1.6;
        g.stroke();
        g.strokeStyle = rgba(GOLD3, 0.9);
        g.lineWidth = 2;
        circle(g, x + 110, SCR.y1 + 62, 16);
        g.stroke();
        g.strokeRect(x + 104, SCR.y1 + 56, 12, 12);
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(x + 110 + s * 26, SCR.y1 + 62);
          g.lineTo(x + 110 + s * 90, SCR.y1 + 62);
          g.stroke();
          circle(g, x + 110 + s * 96, SCR.y1 + 62, 4);
          g.stroke();
        }
      }
    });
  }
  var P_FAR12 = 0.12;
  var P_FAR22 = 0.4;
  var P_NEAR3 = 1;
  function softLayer(ctx, x0, x1, y0, y1, blurPx, alpha, draw) {
    const c = makeCanvas((x1 - x0) * K, (y1 - y0) * K);
    const g = c.getContext("2d");
    g.scale(K, K);
    g.translate(-x0, -y0);
    draw(g);
    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.globalAlpha = alpha;
    ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
  function far1Layer2() {
    return strip("s11-far1", P_FAR12, (ctx, x0, x1) => {
      softLayer(ctx, x0, x1, 120, 880, 16, 0.2, (g) => {
        const R = rng("s11-far1");
        g.fillStyle = SHADOW;
        g.beginPath();
        g.moveTo(x0, 880);
        for (let x = x0; x <= x1; x += 6) {
          const h = 150 + 170 * Math.pow(Math.abs(Math.sin(x * 42e-4 + 0.6)), 1.6) + 70 * noise2(x * 6e-3, 0.5, 1121);
          g.lineTo(x, 800 - h);
        }
        g.lineTo(x1, 880);
        g.closePath();
        g.fill();
        for (let x = x0 + 100; x < x1; x += R.range(500, 760)) {
          const y = R.range(170, 260);
          for (let k = 0; k < 4; k++) {
            ellipse(g, x + k * 60, y - k % 2 * 16, 70, 26);
            g.fill();
          }
        }
      });
    }, { y0: 120, y1: 880 });
  }
  function far2Layer2() {
    return strip("s11-far2", P_FAR22, (ctx, x0, x1) => {
      softLayer(ctx, x0, x1, 300, 880, 3.5, 0.32, (g) => {
        const R = rng("s11-far2");
        g.fillStyle = SHADOW;
        g.fillRect(x0, 712, x1 - x0, 170);
        for (let x = x0; x < x1; x += 30) g.fillRect(x, 700, 18, 14);
        for (let x = x0 + 80; x < x1; ) {
          const k = R();
          if (k < 0.34) {
            const w = R.range(150, 200);
            g.fillRect(x, 640, w, 80);
            roof(g, x + w / 2, 640, w * 0.72, 40);
            g.fillRect(x + w * 0.2, 590, w * 0.6, 40);
            roof(g, x + w / 2, 590, w * 0.56, 34);
            x += w + R.range(120, 260);
          } else if (k < 0.6) {
            const w = R.range(60, 80);
            for (let i = 0; i < 6; i++) {
              const ww = w * (1 - i * 0.1), y = 712 - i * 44;
              g.fillRect(x - ww * 0.35, y - 34, ww * 0.7, 34);
              roof(g, x, y - 34, ww * 0.7, 18);
            }
            g.fillRect(x - 2, 712 - 6 * 44 - 40, 4, 44);
            x += R.range(200, 330);
          } else {
            for (let i = 0; i < 4; i++) {
              circle(g, x + i * 26 - 40, 680 - i % 2 * 30, R.range(30, 46));
              g.fill();
            }
            x += R.range(180, 300);
          }
        }
        g.save();
        g.globalCompositeOperation = "destination-out";
        for (let x = x0; x < x1; x += 22) for (const y of [610, 660]) if (hash2(Math.round(x), y, 1122) < 0.35) g.fillRect(x, y, 8, 12);
        g.restore();
      });
    }, { y0: 300, y1: 880 });
  }
  function roof(g, cx, y, w, h) {
    g.beginPath();
    g.moveTo(cx - w / 2 - w * 0.18, y - h * 0.15);
    g.quadraticCurveTo(cx - w * 0.3, y - h * 0.2, cx - w * 0.12, y - h);
    g.lineTo(cx + w * 0.12, y - h);
    g.quadraticCurveTo(cx + w * 0.3, y - h * 0.2, cx + w / 2 + w * 0.18, y - h * 0.15);
    g.lineTo(cx + w / 2, y);
    g.lineTo(cx - w / 2, y);
    g.closePath();
    g.fill();
  }
  function drawGround(ctx, x0, x1) {
    const top = (x) => ROAD_Y + 1.5 * Math.sin(x * 0.05) + 1.5 * Math.sin(x * 0.013);
    pieceOn(ctx, 0, 0, [x0, 770, x1, 910], (g) => {
      const band = P((p) => {
        p.moveTo(x0, 910);
        for (let x = x0; x <= x1; x += 8) p.lineTo(x, top(x));
        p.lineTo(x1, 910);
        p.closePath();
      });
      leather(g, band, GRN, {
        line: 2.6,
        cut: (c) => {
          for (let x = x0; x < x1; x += 30) {
            c.lineWidth = 2.6;
            c.beginPath();
            c.arc(x, 838, 12, Math.PI * 1.05, Math.PI * 1.95);
            c.stroke();
          }
          for (let x = x0 + 15; x < x1; x += 30) {
            c.lineWidth = 2;
            c.beginPath();
            c.arc(x, 826, 7, Math.PI * 1.1, Math.PI * 1.9);
            c.stroke();
          }
          for (let x = x0 + 7; x < x1; x += 15) cutDot(c, x, 812, 1.8);
          cutLine(c, [[x0, 850], [x1, 850]], 2.4);
        }
      });
      const lower = P((p) => p.rect(x0, 856, x1 - x0, 60));
      leather(g, lower, YEL, { line: 2, rim: 0, cut: (c) => {
        for (let x = x0 + 13; x < x1; x += 26) cutCoin(c, x, 874, 8);
      } });
      const R = rng("s11-grass");
      for (let x = x0 + 20; x < x1; x += R.range(40, 110)) {
        const n = R.int(3, 5), y = top(x) + 2;
        const blade = P((p) => {
          for (let k = 0; k < n; k++) {
            const bx = x + (k - n / 2) * 7, l = R.range(14, 30), lean = R.range(-0.5, 0.5);
            p.moveTo(bx - 3, y);
            p.quadraticCurveTo(bx + lean * l * 0.3, y - l * 0.6, bx + lean * l, y - l);
            p.quadraticCurveTo(bx + 1, y - l * 0.4, bx + 3, y);
            p.closePath();
          }
        });
        leather(g, blade, R() < 0.5 ? GRN_D : GRN, { line: 1.4, rim: 0, tex: 0 });
        if (R() < 0.18) {
          const f = blobs([[x + 6, y - 30, 7]]);
          leather(g, f, R() < 0.5 ? RED2 : YEL, { line: 1.4, rim: 0, tex: 0, cut: (c) => cutDot(c, x + 6, y - 30, 2.4) });
        }
      }
    }, 0.95);
  }
  function willow(g, R) {
    const trunk = P((p) => {
      p.moveTo(-30, 0);
      p.bezierCurveTo(-20, -90, -36, -170, -14, -250);
      p.bezierCurveTo(-40, -300, -80, -330, -112, -352);
      p.lineTo(-98, -364);
      p.bezierCurveTo(-60, -342, -22, -312, -2, -284);
      p.bezierCurveTo(10, -322, 30, -352, 52, -374);
      p.lineTo(64, -364);
      p.bezierCurveTo(40, -330, 22, -290, 16, -246);
      p.bezierCurveTo(30, -160, 14, -80, 34, 0);
      p.closePath();
    });
    leather(g, trunk, HIDE, { cut: (c) => {
      for (let i = 0; i < 9; i++) {
        const y = -30 - i * 26;
        cutLine(c, [[-14 + i % 2 * 8, y], [-4 + i % 2 * 8, y - 14], [-10 + i % 2 * 8, y - 22]], 2.2);
      }
      cutRing(c, 4, -150, 7, 2.4);
      cutDot(c, 4, -150, 2);
    } });
    for (let x = -230; x <= 150; x += 22) {
      const y0 = -320 + Math.abs(x + 40) * 0.25, L = R.range(130, 210), bend = R.range(-14, 14);
      g.strokeStyle = GRN_D;
      g.lineWidth = 2.6;
      g.beginPath();
      g.moveTo(x, y0);
      g.quadraticCurveTo(x + bend, y0 + L * 0.5, x + bend * 0.4, y0 + L);
      g.stroke();
      for (let t = 0.15; t < 1; t += 0.11) {
        const lx = x + bend * (2 * t * (1 - t)) + bend * 0.4 * t * t, ly = y0 + L * t, s = t * 22 % 2 < 1 ? 1 : -1;
        g.save();
        g.translate(lx, ly);
        g.rotate(s * 0.7);
        g.fillStyle = GRN;
        ellipse(g, s * 6, 0, 8, 3);
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 1;
        g.stroke();
        g.restore();
      }
    }
    const crown = blobs([[-120, -380, 70], [-40, -412, 82], [52, -396, 70], [-178, -330, 56], [112, -340, 56], [-84, -340, 62], [22, -346, 62]]);
    leather(g, crown, GRN, { union: true, cut: (c) => cutGrid(-260, -500, 180, -280, 19, (x, y, j) => cutLeaf(c, x, y, 7.5, 2.6, j % 2 ? -0.6 : 0.6)) });
  }
  function rock2(g, R, w, h, col) {
    const pts = [];
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU, r = 0.78 + 0.3 * R();
      pts.push([Math.cos(a) * w * 0.5 * r, -h * 0.5 + Math.sin(a) * h * 0.5 * r]);
    }
    smoothPath(g, pts, true);
    const body = new Path2D();
    body.addPath(P((p) => {
      p.moveTo(pts[0][0], pts[0][1]);
    }));
    const path = P((p) => {
      const n = pts.length, Q = (i) => pts[(i + n) % n];
      p.moveTo(Q(0)[0], Q(0)[1]);
      for (let i = 0; i < n; i++) {
        const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
        p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
      }
      p.closePath();
    });
    const holes = [[R.range(-0.2, 0.1), R.range(0.5, 0.65), 0.13], [R.range(0.1, 0.25), R.range(0.25, 0.4), 0.09], [R.range(-0.3, -0.15), R.range(0.25, 0.4), 0.07]];
    leather(g, path, col, { cut: (c) => {
      for (const [hx, hy, hr] of holes) {
        c.beginPath();
        c.ellipse(hx * w, -hy * h, hr * w, hr * h * 0.9, R.range(-0.5, 0.5), 0, TAU);
        c.fill();
      }
      for (let i = 0; i < 6; i++) {
        const y = -h * R.range(0.1, 0.9), x = w * R.range(-0.35, 0.3);
        cutLine(c, [[x, y], [x + 16, y - 6], [x + 30, y + 2]], 2);
      }
    } });
    ellipse(g, 0, 0, 0, 0);
  }
  function pavilion(g) {
    const base = P((p) => p.rect(-200, -42, 400, 42));
    leather(g, base, HIDE, { cut: (c) => {
      for (let y = -32; y < 0; y += 14) for (let x = -196 + (y % 28 ? 0 : 20); x < 200; x += 40) c.fillRect(x, y, 34, 2.4);
    } });
    for (const x of [-150, 0, 150]) {
      const col = P((p) => p.rect(x - 9, -282, 18, 242));
      leather(g, col, RED2, { rim: 2, cut: (c) => {
        cutLine(c, [[x, -270], [x, -60]], 2.4);
      } });
    }
    for (const [a, b2] of [[-141, -9], [9, 141]]) {
      const rail = P((p) => p.rect(a, -112, b2 - a, 70));
      leather(g, rail, GRN, { cut: (c) => {
        for (let x = a + 6; x < b2 - 20; x += 26) {
          cutMeander(c, x, -100, 18, 2.6);
          cutMeander(c, x, -72, 18, 2.6);
        }
      } });
      const top = P((p) => p.rect(a - 4, -120, b2 - a + 8, 10));
      leather(g, top, RED2, { rim: 0, line: 1.8 });
    }
    const hang = P((p) => {
      p.moveTo(-160, -300);
      p.lineTo(160, -300);
      p.lineTo(160, -276);
      p.lineTo(140, -264);
      p.lineTo(-140, -264);
      p.lineTo(-160, -276);
      p.closePath();
    });
    leather(g, hang, YEL, { cut: (c) => {
      for (let x = -150; x < 150; x += 16) cutDiamond(c, x + 8, -284, 5.5);
    } });
    const rf = P((p) => {
      p.moveTo(-262, -332);
      p.quadraticCurveTo(-232, -304, -196, -300);
      p.lineTo(196, -300);
      p.quadraticCurveTo(232, -304, 262, -332);
      p.quadraticCurveTo(110, -330, 14, -432);
      p.lineTo(-14, -432);
      p.quadraticCurveTo(-110, -330, -262, -332);
      p.closePath();
    });
    leather(g, rf, BLACK, { cut: (c) => {
      for (let x = -180; x <= 180; x += 15) {
        const t = Math.abs(x) / 196;
        cutLine(c, [[x * 0.98, -306], [x * (0.25 + 0.6 * (1 - t)), -330 - 90 * (1 - t) ** 1.6]], 2);
      }
    } });
    const eave = P((p) => {
      p.moveTo(-262, -332);
      p.quadraticCurveTo(-232, -304, -196, -300);
      p.lineTo(196, -300);
      p.quadraticCurveTo(232, -304, 262, -332);
      p.quadraticCurveTo(236, -316, 196, -312);
      p.lineTo(-196, -312);
      p.quadraticCurveTo(-236, -316, -262, -332);
      p.closePath();
    });
    leather(g, eave, YEL, { rim: 0, line: 1.6, cut: (c) => {
      for (let x = -190; x < 196; x += 14) cutDot(c, x, -306, 2.2);
    } });
    const fin = P((p) => {
      p.moveTo(-12, -432);
      p.quadraticCurveTo(-18, -452, 0, -462);
      p.quadraticCurveTo(18, -452, 12, -432);
      p.closePath();
      p.moveTo(9, -474);
      p.arc(0, -474, 9, 0, TAU);
    });
    leather(g, fin, YEL, { rim: 0, line: 1.8 });
    for (const x of [-150, 0, 150]) {
      rivet(g, x, -282, 4);
      rivet(g, x, -48, 4);
    }
  }
  function tower(g) {
    const base = P((p) => p.rect(-150, -40, 300, 40));
    leather(g, base, HIDE, { cut: (c) => {
      for (let x = -140; x < 140; x += 30) c.fillRect(x, -26, 22, 3);
    } });
    const w1 = P((p) => p.rect(-120, -230, 240, 190));
    leather(g, w1, RED2, { cut: (c) => {
      c.fillRect(-28, -180, 56, 138);
      for (const x of [-100, 48]) {
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(x + 4 + i * 13, -186 + j * 22, 9, 17);
      }
    } });
    const door = P((p) => p.rect(-28, -180, 56, 138));
    leather(g, door, YEL, { line: 1.8, rim: 0, cut: (c) => {
      cutLine(c, [[0, -176], [0, -46]], 2);
      for (let y = -164; y < -50; y += 24) {
        cutCoin(c, -14, y, 6);
        cutCoin(c, 14, y, 6);
      }
    } });
    const r1 = P((p) => {
      p.moveTo(-196, -246);
      p.quadraticCurveTo(-170, -228, -140, -226);
      p.lineTo(140, -226);
      p.quadraticCurveTo(170, -228, 196, -246);
      p.quadraticCurveTo(120, -250, 96, -290);
      p.lineTo(-96, -290);
      p.quadraticCurveTo(-120, -250, -196, -246);
      p.closePath();
    });
    leather(g, r1, BLACK, { cut: (c) => {
      for (let x = -150; x <= 150; x += 14) cutLine(c, [[x, -232], [x * 0.66, -284]], 1.8);
    } });
    const rail = P((p) => p.rect(-110, -322, 220, 32));
    leather(g, rail, GRN, { cut: (c) => {
      for (let x = -104; x < 100; x += 24) cutMeander(c, x, -316, 18, 2.4);
    } });
    const w2 = P((p) => p.rect(-86, -460, 172, 138));
    leather(g, w2, RED2, { cut: (c) => {
      for (const x of [-70, 14]) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(x + i * 14, -440 + j * 26, 10, 20);
    } });
    const r2 = P((p) => {
      p.moveTo(-170, -470);
      p.quadraticCurveTo(-140, -452, -110, -452);
      p.lineTo(110, -452);
      p.quadraticCurveTo(140, -452, 170, -470);
      p.quadraticCurveTo(60, -480, 12, -560);
      p.lineTo(-12, -560);
      p.quadraticCurveTo(-60, -480, -170, -470);
      p.closePath();
    });
    leather(g, r2, BLACK, { cut: (c) => {
      for (let x = -130; x <= 130; x += 14) cutLine(c, [[x, -458], [x * 0.35, -540]], 1.8);
    } });
    const fin = P((p) => {
      p.moveTo(-10, -560);
      p.quadraticCurveTo(-16, -580, 0, -590);
      p.quadraticCurveTo(16, -580, 10, -560);
      p.closePath();
    });
    leather(g, fin, YEL, { rim: 0, line: 1.6 });
    for (const s of [-1, 1]) {
      const b = blobs([[s * 192, -236, 7]]);
      leather(g, b, YEL, { rim: 0, line: 1.4 });
    }
  }
  function bridge(g) {
    const q = (t, a, c) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * a;
    const deck = (t) => [lerp(-290, 290, t), q(t, 0, -210)];
    const inner = (t) => [lerp(-236, 236, t), q(t, 0, -150)];
    const arch = P((p) => {
      for (let i = 0; i <= 40; i++) {
        const [x, y] = deck(i / 40);
        i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      for (let i = 40; i >= 0; i--) {
        const [x, y] = inner(i / 40);
        p.lineTo(x, y);
      }
      p.closePath();
    });
    leather(g, arch, HIDE, { cut: (c) => {
      for (let i = 1; i < 20; i++) {
        const [x1, y1] = deck(i / 20), [x2, y2] = inner(i / 20);
        cutLine(c, [[lerp(x1, x2, 0.25), lerp(y1, y2, 0.25)], [lerp(x1, x2, 0.75), lerp(y1, y2, 0.75)]], 2);
      }
    } });
    const rail = P((p) => {
      for (let i = 0; i <= 40; i++) {
        const [x, y] = deck(0.06 + i / 40 * 0.88);
        i ? p.lineTo(x, y - 40) : p.moveTo(x, y - 40);
      }
      for (let i = 40; i >= 0; i--) {
        const [x, y] = deck(0.06 + i / 40 * 0.88);
        p.lineTo(x, y);
      }
      p.closePath();
    });
    leather(g, rail, RED2, { cut: (c) => {
      for (let i = 0; i < 12; i++) {
        const t0 = 0.08 + i / 12 * 0.84, t1 = t0 + 0.84 / 12 - 0.015;
        const [a, ay] = deck(t0 + 0.01), [b2, by] = deck(t1);
        c.beginPath();
        c.moveTo(a + 4, ay - 30);
        c.lineTo(b2 - 2, by - 30);
        c.lineTo(b2 - 2, by - 8);
        c.lineTo(a + 4, ay - 8);
        c.closePath();
        c.fill();
      }
    } });
    for (let i = 0; i <= 12; i++) {
      const [x, y] = deck(0.07 + i / 12 * 0.84);
      const post = P((p) => {
        p.rect(x - 4, y - 50, 8, 48);
        p.moveTo(x + 6, y - 52);
        p.arc(x, y - 52, 6, 0, TAU);
      });
      leather(g, post, YEL, { rim: 0, line: 1.4, tex: 0 });
    }
  }
  function bamboo2(g, R) {
    for (let k = 0; k < 4; k++) {
      const x = -50 + k * 32 + R.range(-6, 6), h = R.range(330, 440), lean = R.range(-0.08, 0.08);
      const stalk = P((p) => {
        p.moveTo(x - 6, 0);
        p.lineTo(x - 5 + lean * h, -h);
        p.lineTo(x + 5 + lean * h, -h);
        p.lineTo(x + 6, 0);
        p.closePath();
      });
      leather(g, stalk, k % 2 ? GRN : GRN_D, { rim: 1.5, line: 1.6, cut: (c) => {
        for (let y = -40; y > -h; y -= 46) cutLine(c, [[x - 6 + lean * -y, y], [x + 6 + lean * -y, y]], 2);
      } });
    }
    for (let i = 0; i < 9; i++) {
      const cx = R.range(-110, 110), cy = R.range(-420, -170), a0 = R.range(-0.4, 0.4);
      const leaves = P((p) => {
        for (let k = 0; k < 4; k++) {
          const a = a0 + (k - 1.5) * 0.45 + Math.PI * 0.12;
          const L = R.range(48, 66);
          const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.5 + L * 0.35, nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7;
          p.moveTo(cx, cy);
          p.quadraticCurveTo((cx + ex) / 2 + nx, (cy + ey) / 2 + ny, ex, ey);
          p.quadraticCurveTo((cx + ex) / 2 - nx, (cy + ey) / 2 - ny, cx, cy);
        }
      });
      leather(g, leaves, i % 3 ? GRN : "#6f9a3c", { rim: 0, line: 1.4, tex: 0 });
    }
  }
  function peony(g, R) {
    const lv = P((p) => {
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.45, L = R.range(40, 60), x = Math.cos(a) * L, y = -10 + Math.sin(a) * L;
        p.moveTo(0, -6);
        p.quadraticCurveTo(x * 0.4 - 12, y * 0.6, x, y);
        p.quadraticCurveTo(x * 0.6 + 12, y * 0.4, 0, -6);
      }
    });
    leather(g, lv, GRN, { line: 1.6, rim: 0, cut: (c) => {
      for (let k = 0; k < 6; k++) {
        const a = -Math.PI / 2 + (k - 2.5) * 0.45;
        cutLine(c, [[0, -8], [Math.cos(a) * 34, -10 + Math.sin(a) * 34]], 1.6);
      }
    } });
    for (const [fx, fy, fr, col] of [[-22, -66, 22, RED2], [24, -78, 18, YEL]]) {
      const fl = blobs([[fx, fy, fr], ...Array.from({ length: 6 }, (_, i) => [fx + Math.cos(i) * fr * 0.85, fy + Math.sin(i) * fr * 0.85, fr * 0.5])]);
      leather(g, fl, col, { line: 1.6, union: true, cut: (c) => {
        cutPetals(c, fx, fy, fr * 0.62, 7, fr * 0.22, fr * 0.08);
        cutDot(c, fx, fy, fr * 0.16);
      } });
    }
  }
  function cloud(g, col, s = 1) {
    const c0 = blobs([[0, 0, 34 * s], [-42 * s, 8 * s, 26 * s], [42 * s, 8 * s, 26 * s], [-76 * s, 18 * s, 15 * s], [76 * s, 18 * s, 15 * s]]);
    leather(g, c0, col, { union: true, cut: (c) => {
      cutSpiral(c, 0, 0, 24 * s, 1.4, 3);
      cutSpiral(c, -42 * s, 8 * s, 17 * s, 1.3, 2.6, -1);
      cutSpiral(c, 42 * s, 8 * s, 17 * s, 1.3, 2.6);
      cutLine(c, [[-80 * s, 30 * s], [80 * s, 30 * s]], 2);
    } });
  }
  function nearLayer3(gc) {
    return strip(`s11-near|${Math.round(gc)}`, P_NEAR3, (ctx, x0, x1) => {
      const at = (sx) => sx + gc;
      const R = rng("s11-near");
      for (const [sx, y, col, s] of [[-1500, 170, YEL, 1], [-930, 130, RED2, 0.85], [-420, 200, YEL, 1.1], [110, 120, RED2, 0.8], [760, 150, YEL, 1], [1450, 190, RED2, 0.9], [2050, 140, YEL, 1.05], [2700, 175, RED2, 0.9]]) {
        pieceOn(ctx, at(sx), y, [-110 * s, -50 * s, 110 * s, 50 * s], (g) => cloud(g, col, s), 0.9);
      }
      pieceOn(ctx, at(-1880), ROAD_Y, [-110, -140, 110, 6], (g) => rock2(g, rng("s11-rock", 0), 190, 130, HIDE));
      pieceOn(ctx, at(-1560), ROAD_Y, [-210, -600, 210, 6], (g) => tower(g));
      pieceOn(ctx, at(-1230), ROAD_Y, [-90, -140, 90, 6], (g) => peony(g, rng("s11-peony", 0)));
      pieceOn(ctx, at(-860), ROAD_Y, [-300, -280, 300, 6], (g) => bridge(g));
      pieceOn(ctx, at(-470), ROAD_Y, [-130, -470, 130, 6], (g) => bamboo2(g, rng("s11-bamboo", 0)));
      pieceOn(ctx, at(-170), ROAD_Y, [-270, -500, 200, 6], (g) => willow(g, rng("s11-willow", 0)));
      pieceOn(ctx, at(-300), ROAD_Y, [-80, -100, 80, 6], (g) => rock2(g, rng("s11-rock", 1), 130, 80, YEL));
      pieceOn(ctx, at(640), ROAD_Y, [-90, -140, 90, 6], (g) => peony(g, rng("s11-peony", 1)));
      pieceOn(ctx, at(1200), ROAD_Y, [-270, -490, 270, 6], (g) => pavilion(g));
      pieceOn(ctx, at(1590), ROAD_Y, [-120, -180, 120, 6], (g) => rock2(g, rng("s11-rock", 2), 200, 160, HIDE));
      pieceOn(ctx, at(1830), ROAD_Y, [-130, -470, 130, 6], (g) => bamboo2(g, rng("s11-bamboo", 1)));
      pieceOn(ctx, at(2250), ROAD_Y, [-270, -500, 200, 6], (g) => willow(g, rng("s11-willow", 1)));
      pieceOn(ctx, at(2620), ROAD_Y, [-210, -600, 210, 6], (g) => tower(g));
      R();
      drawGround(ctx, x0, x1);
    }, { y0: 60, y1: 910 });
  }
  var SCH_BODY = [-96, -350, 96, 6];
  var SCH_HEAD = [-50, -446, 92, -326];
  var SCH_ARM = [-40, -24, 40, 132];
  var SCH_SHOULDER = [-18, -314];
  var SCH_NECK = [-2, -338];
  function scholarBody(g) {
    const back = P((p) => {
      p.moveTo(16, -320);
      p.quadraticCurveTo(52, -270, 58, -190);
      p.lineTo(78, -176);
      p.lineTo(30, -170);
      p.quadraticCurveTo(26, -250, 6, -300);
      p.closePath();
    });
    leather(g, back, GRN_D, { cut: (c) => cutSpiral(c, 40, -220, 12, 1.3, 2.4) });
    const robe = P((p) => {
      p.moveTo(-8, -336);
      p.quadraticCurveTo(-30, -332, -38, -316);
      p.lineTo(-44, -250);
      p.bezierCurveTo(-46, -160, -54, -80, -72, -22);
      p.lineTo(-76, -14);
      p.lineTo(66, -14);
      p.bezierCurveTo(54, -90, 44, -180, 40, -262);
      p.bezierCurveTo(40, -300, 32, -324, 12, -336);
      p.closePath();
    });
    leather(g, robe, TEAL2, { cut: (c) => {
      cutSpiral(c, -6, -282, 13, 1.4, 2.6);
      cutSpiral(c, 14, -150, 15, 1.4, 2.6, -1);
      cutSpiral(c, -30, -92, 13, 1.4, 2.6);
      cutLine(c, [[-20, -196], [-28, -40]], 2);
      cutLine(c, [[18, -190], [30, -40]], 2);
      cutGrid(-40, -180, 40, -120, 16, (x, y) => cutDot(c, x, y, 1.6));
    } });
    const collar = P((p) => {
      p.moveTo(-10, -336);
      p.lineTo(4, -336);
      p.lineTo(-22, -258);
      p.lineTo(-34, -262);
      p.closePath();
    });
    leather(g, collar, YEL_L, { rim: 0, line: 1.6 });
    const belt = P((p) => {
      p.moveTo(-46, -232);
      p.lineTo(44, -232);
      p.lineTo(44, -216);
      p.lineTo(-48, -216);
      p.closePath();
      p.moveTo(-14, -218);
      p.lineTo(-4, -218);
      p.lineTo(-8, -120);
      p.lineTo(-18, -120);
      p.closePath();
    });
    leather(g, belt, RED2, { rim: 0, line: 1.8, cut: (c) => {
      for (let x = -40; x < 40; x += 12) cutDiamond(c, x, -224, 3);
    } });
    const tassel = blobs([[-13, -112, 7]]);
    leather(g, tassel, YEL, { rim: 0, line: 1.4 });
    const hem = P((p) => {
      p.moveTo(-70, -40);
      p.lineTo(58, -40);
      p.lineTo(66, -14);
      p.lineTo(-76, -14);
      p.closePath();
    });
    leather(g, hem, YEL, { rim: 0, line: 1.8, cut: (c) => {
      for (let x = -64; x < 60; x += 16) cutCoin(c, x, -27, 5.5);
    } });
    const shoes = P((p) => {
      p.moveTo(-80, -2);
      p.quadraticCurveTo(-86, -14, -70, -14);
      p.lineTo(-40, -14);
      p.lineTo(-40, 0);
      p.closePath();
      p.moveTo(14, -14);
      p.lineTo(46, -14);
      p.lineTo(52, 0);
      p.lineTo(14, 0);
      p.closePath();
    });
    leather(g, shoes, BLACK, { rim: 0, line: 1.6 });
    rivet(g, -6, -224, 4.2);
  }
  function scholarHead(g) {
    for (const [dy, len] of [[0, 1], [10, 0.86]]) {
      const rb = P((p) => {
        p.moveTo(18, -414 + dy);
        p.bezierCurveTo(40, -404 + dy, 46, -380 + dy, 58 * len + 8, -350 + dy * 2);
        p.lineTo(70 * len + 8, -342 + dy * 2);
        p.bezierCurveTo(56, -378 + dy, 46, -398 + dy, 20, -402 + dy);
        p.closePath();
      });
      leather(g, rb, BLACK, { rim: 0, line: 1.4, cut: (c) => {
        cutDot(c, 40, -392 + dy, 1.8);
        cutDot(c, 52, -372 + dy, 1.8);
      } });
    }
    const face = P((p) => {
      p.moveTo(6, -338);
      p.lineTo(-12, -338);
      p.bezierCurveTo(-16, -344, -22, -346, -26, -350);
      p.quadraticCurveTo(-31, -352, -29, -357);
      p.lineTo(-32, -361);
      p.lineTo(-29, -365);
      p.lineTo(-33, -369);
      p.lineTo(-41, -375);
      p.lineTo(-32, -382);
      p.quadraticCurveTo(-30, -389, -32, -394);
      p.quadraticCurveTo(-28, -406, -12, -410);
      p.bezierCurveTo(10, -412, 24, -394, 20, -362);
      p.lineTo(10, -346);
      p.closePath();
    });
    g.save();
    g.fillStyle = HIDE_L;
    g.fill(face);
    g.save();
    g.clip(face);
    g.globalCompositeOperation = "destination-out";
    g.beginPath();
    g.ellipse(-10, -376, 17, 25, 0.1, 0, TAU);
    g.fill();
    g.restore();
    g.lineWidth = 2.4;
    g.strokeStyle = OUT;
    g.stroke(face);
    g.lineCap = "round";
    g.strokeStyle = OUT;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-32, -389);
    g.quadraticCurveTo(-20, -394, -6, -390);
    g.stroke();
    g.lineWidth = 2.2;
    g.beginPath();
    g.moveTo(-30, -381);
    g.quadraticCurveTo(-22, -385, -12, -381);
    g.quadraticCurveTo(-20, -378, -30, -381);
    g.stroke();
    g.fillStyle = OUT;
    circle(g, -22, -381.5, 1.8);
    g.fill();
    g.lineWidth = 1.8;
    g.beginPath();
    g.moveTo(-29, -362);
    g.lineTo(-24, -362);
    g.stroke();
    g.beginPath();
    g.moveTo(4, -376);
    g.quadraticCurveTo(12, -372, 6, -362);
    g.stroke();
    g.restore();
    const cap = P((p) => {
      p.moveTo(-30, -398);
      p.lineTo(-26, -428);
      p.quadraticCurveTo(0, -440, 22, -426);
      p.lineTo(26, -380);
      p.quadraticCurveTo(12, -392, -8, -400);
      p.closePath();
    });
    leather(g, cap, BLACK, { cut: (c) => {
      cutLine(c, [[-24, -414], [20, -414]], 1.8);
      cutDiamond(c, -2, -424, 3.5);
    } });
  }
  function scholarArm(g) {
    const hand = P((p) => {
      p.moveTo(-7, 104);
      p.quadraticCurveTo(-10, 122, 0, 126);
      p.quadraticCurveTo(10, 122, 8, 104);
      p.closePath();
    });
    leather(g, hand, HIDE_L, { rim: 0, line: 1.6, tex: 0 });
    const sleeve = P((p) => {
      p.moveTo(-15, -10);
      p.quadraticCurveTo(-26, 50, -32, 96);
      p.lineTo(30, 104);
      p.quadraticCurveTo(22, 46, 15, -10);
      p.quadraticCurveTo(0, -20, -15, -10);
      p.closePath();
    });
    leather(g, sleeve, TEAL2, { cut: (c) => {
      cutSpiral(c, -2, 48, 11, 1.3, 2.4);
      cutLine(c, [[-6, 4], [-12, 80]], 1.8);
    } });
    const cuff = P((p) => {
      p.moveTo(-30, 86);
      p.lineTo(30, 92);
      p.lineTo(30, 104);
      p.lineTo(-32, 96);
      p.closePath();
    });
    leather(g, cuff, YEL, { rim: 0, line: 1.6 });
    rivet(g, 0, 0, 4.6);
  }
  function fan(ctx, dir, span) {
    const r0 = 12, r1 = 78;
    ctx.save();
    ctx.rotate(dir);
    const a0 = -span / 2 - Math.PI / 2, a1 = span / 2 - Math.PI / 2;
    if (span > 0.15) {
      const face = new Path2D();
      face.arc(0, 0, r1, a0, a1);
      face.arc(0, 0, r0 + 18, a1, a0, true);
      face.closePath();
      ctx.globalAlpha *= 0.94;
      ctx.fillStyle = span > 0.3 ? YEL_L : RED2;
      ctx.fill(face);
      const band = new Path2D();
      band.arc(0, 0, r1, a0, a1);
      band.arc(0, 0, r1 - 11, a1, a0, true);
      band.closePath();
      ctx.fillStyle = RED2;
      ctx.fill(band);
      ctx.strokeStyle = rgba("#fff6dc", 0.9);
      ctx.lineWidth = 1.6;
      for (let i = 1; i < 11; i++) {
        const a = lerp(a0, a1, i / 11);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * (r0 + 20), Math.sin(a) * (r0 + 20));
        ctx.lineTo(Math.cos(a) * (r1 - 12), Math.sin(a) * (r1 - 12));
        ctx.stroke();
      }
      ctx.fillStyle = RED2;
      for (const [u, v] of [[0.3, 0.6], [0.55, 0.72], [0.7, 0.5]]) {
        const a = lerp(a0, a1, u), rr = lerp(r0 + 20, r1 - 12, v);
        circle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 3.6);
        ctx.fill();
      }
      ctx.strokeStyle = OUT;
      ctx.lineWidth = 2;
      ctx.stroke(face);
    }
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    for (const a of [a0, a1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      ctx.stroke();
    }
    ctx.restore();
    rivet(ctx, 0, 0, 3.4);
  }
  function scholarPose(b, rb) {
    const q = frameNo2(b);
    const startled = rb >= GAG && rb < LEAVE;
    let lean = (hash2(q, 5, 1131) - 0.5) * 0.015, arm, span = 2.1, nod = (hash2(q, 6, 1131) - 0.5) * 0.04;
    if (rb < GAG) arm = 1.95 + 0.3 * Math.sin(TAU * b);
    else if (startled) {
      arm = 2.05 + 0.32 * Math.sin(TAU * 2 * b);
      lean += 0.12;
      nod -= 0.08;
    } else {
      arm = 1.75;
      span = 0.2;
    }
    const hop = rb >= T_FLIP ? -6 * Math.abs(Math.sin(Math.PI * 2 * b)) : 0;
    return { lean, arm, span, nod, hop, flip: rb >= T_FLIP ? -1 : 1 };
  }
  function drawScholar(ctx, x, b, rb) {
    const S = scholarPose(b, rb);
    ctx.save();
    ctx.translate(x, ROAD_Y + S.hop);
    ctx.scale(S.flip, 1);
    const hx = SCH_SHOULDER[0] - Math.sin(S.arm) * 118, hy = SCH_SHOULDER[1] + Math.cos(S.arm) * 118;
    ctx.save();
    ctx.rotate(S.lean);
    drawPart(ctx, "sch-body", SCH_BODY, scholarBody);
    ctx.save();
    ctx.translate(SCH_NECK[0], SCH_NECK[1]);
    ctx.rotate(S.nod);
    ctx.translate(-SCH_NECK[0], -SCH_NECK[1]);
    drawPart(ctx, "sch-head", SCH_HEAD, scholarHead);
    ctx.restore();
    ctx.save();
    ctx.translate(SCH_SHOULDER[0], SCH_SHOULDER[1]);
    ctx.rotate(S.arm);
    drawPart(ctx, "sch-arm", SCH_ARM, scholarArm);
    ctx.translate(0, 118);
    fan(ctx, -0.9 - (S.arm - 1.95) * 0.6, S.span);
    ctx.restore();
    ctx.restore();
    const rot = (px, py) => [px * Math.cos(S.lean) - py * Math.sin(S.lean), px * Math.sin(S.lean) + py * Math.cos(S.lean)];
    const [nx, ny] = rot(SCH_NECK[0] + 8, SCH_NECK[1] + 16), [ax, ay] = rot(hx, hy);
    rodShadow(ctx, nx, ny, 120);
    rodShadow(ctx, ax, ay, 210, 3.4);
    ctx.restore();
  }
  var HORSE_BODY = [-232, -392, 196, -140];
  var HORSE_LEG = [-24, -12, 24, 196];
  var LEGS = [[-80, -192, "f"], [-62, -194, "f"], [70, -196, "h"], [88, -192, "h"]];
  function horseBody(g) {
    const tail = P((p) => {
      p.moveTo(104, -236);
      p.bezierCurveTo(150, -250, 176, -214, 186, -150);
      p.lineTo(170, -150);
      p.bezierCurveTo(160, -196, 140, -214, 108, -214);
      p.closePath();
    });
    leather(g, tail, BLACK, { rim: 0, line: 1.6, cut: (c) => {
      cutLine(c, [[130, -228], [166, -166]], 2);
      cutLine(c, [[122, -220], [150, -160]], 1.6);
    } });
    const body = P((p) => {
      p.moveTo(-96, -246);
      p.bezierCurveTo(-40, -270, 50, -266, 104, -246);
      p.bezierCurveTo(130, -230, 126, -186, 106, -172);
      p.bezierCurveTo(60, -158, -20, -160, -84, -170);
      p.bezierCurveTo(-112, -186, -112, -222, -96, -246);
      p.closePath();
      p.moveTo(-70, -240);
      p.lineTo(-120, -330);
      p.bezierCurveTo(-128, -350, -146, -360, -158, -354);
      p.lineTo(-210, -304);
      p.quadraticCurveTo(-218, -290, -204, -284);
      p.lineTo(-176, -288);
      p.lineTo(-136, -300);
      p.lineTo(-104, -196);
      p.closePath();
      p.moveTo(-140, -356);
      p.lineTo(-136, -384);
      p.lineTo(-124, -360);
      p.closePath();
    });
    leather(g, body, YEL, { cut: (c) => {
      cutGrid(40, -240, 104, -184, 15, (x, y) => cutCoin(c, x, y, 5.5));
      cutLine(c, [[-110, -306], [-86, -236]], 2.2);
      cutLine(c, [[-98, -312], [-74, -244]], 1.6);
      c.beginPath();
      c.ellipse(-162, -334, 7, 3.2, -0.5, 0, TAU);
      c.fill();
      cutDot(c, -202, -298, 2.4);
      cutLine(c, [[-90, -186], [60, -178]], 1.6);
    } });
    const mane = P((p) => {
      p.moveTo(-150, -358);
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, x = lerp(-140, -66, t), y = lerp(-362, -252, t);
        p.lineTo(x + 14 + i % 2 * 8, y - 6 + i % 2 * 6);
      }
      p.lineTo(-62, -244);
      p.lineTo(-120, -332);
      p.closePath();
    });
    leather(g, mane, BLACK, { rim: 0, line: 1.4 });
    const cloth = P((p) => {
      p.moveTo(-52, -258);
      p.lineTo(46, -256);
      p.lineTo(42, -196);
      p.quadraticCurveTo(-4, -186, -50, -196);
      p.closePath();
    });
    leather(g, cloth, RED2, { cut: (c) => {
      cutGrid(-40, -244, 36, -206, 16, (x, y) => cutCoin(c, x, y, 5));
    } });
    const trim = P((p) => {
      p.moveTo(-50, -200);
      p.quadraticCurveTo(-4, -190, 42, -200);
      p.lineTo(42, -190);
      p.quadraticCurveTo(-4, -180, -50, -190);
      p.closePath();
      for (let x = -46; x < 42; x += 12) {
        p.moveTo(x, -188);
        p.lineTo(x + 3, -176);
        p.lineTo(x + 6, -188);
      }
    });
    leather(g, trim, YEL, { rim: 0, line: 1.2, tex: 0 });
    const seat = P((p) => {
      p.moveTo(-40, -258);
      p.quadraticCurveTo(-30, -280, -14, -270);
      p.quadraticCurveTo(4, -262, 20, -270);
      p.quadraticCurveTo(34, -278, 38, -256);
      p.closePath();
    });
    leather(g, seat, BLACK, { rim: 0, line: 1.4 });
    g.strokeStyle = RED_D2;
    g.lineWidth = 3.2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-142, -346);
    g.lineTo(-152, -306);
    g.moveTo(-184, -310);
    g.lineTo(-196, -292);
    g.stroke();
    const tas = blobs([[-104, -214, 10], [-110, -200, 7]]);
    leather(g, tas, RED2, { rim: 0, line: 1.4, cut: (c) => cutDot(c, -104, -214, 3) });
  }
  function horseLeg(g, kind) {
    const hind = kind === "h";
    const leg = P((p) => {
      p.moveTo(-14, 0);
      p.quadraticCurveTo(hind ? -24 : -18, 50, -9, 110);
      p.lineTo(-8, 162);
      p.lineTo(9, 162);
      p.lineTo(8, 112);
      p.quadraticCurveTo(hind ? 24 : 18, 50, 14, 0);
      p.quadraticCurveTo(0, -10, -14, 0);
      p.closePath();
    });
    leather(g, leg, YEL, { line: 2, rim: 2, cut: (c) => {
      cutLine(c, [[0, 20], [-2, 90]], 1.8);
    } });
    const hoof = P((p) => {
      p.moveTo(-11, 160);
      p.lineTo(11, 160);
      p.lineTo(14, 182);
      p.lineTo(-12, 182);
      p.closePath();
    });
    leather(g, hoof, BLACK, { rim: 0, line: 1.4, tex: 0 });
    rivet(g, 0, 0, 4.4);
  }
  function drawHorse(ctx, x, b) {
    const t = (b - T_HORSE[0]) * 2.2;
    const bob = -9 * Math.abs(Math.sin(Math.PI * t));
    ctx.save();
    ctx.translate(x, ROAD_Y - 6 + bob);
    ctx.rotate(Math.sin(TAU * t) * 0.03);
    const ang = (k) => {
      const [, , kind] = LEGS[k];
      return kind === "f" ? 0.55 * Math.sin(TAU * t + k * 0.6) : -0.5 * Math.sin(TAU * t + 0.4 + k * 0.6);
    };
    const leg = (k, a) => {
      const [lx, ly, kind] = LEGS[k];
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(ang(k));
      drawPart(ctx, `horse-leg-${kind}`, HORSE_LEG, (g) => horseLeg(g, kind), a);
      ctx.restore();
    };
    leg(1, 0.75);
    leg(3, 0.75);
    drawPart(ctx, "horse-body", HORSE_BODY, horseBody);
    leg(0, 0.94);
    leg(2, 0.94);
    rodShadow(ctx, -96, -282, 140);
    rodShadow(ctx, 92, -224, 200);
    ctx.restore();
  }
  function puppetize(I) {
    const w = I.w, h = I.h, n = w * h;
    let top = h, bot = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (I.a[y * w + x] > 0.5) {
      if (y < top) top = y;
      if (y > bot) bot = y;
    }
    const PH = Math.max(1, bot - top);
    const S = smoothColor(I, 1.6);
    const L = lumaArray(S, 0.55);
    const E = sobel(L, w, h);
    const F = sobel(lumaArray(smoothColor(I, 0.6), 0.55), w, h);
    const In = blur(I.a, w, h, 5, 2);
    const O = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
    const C = { hair: rgbf(BLACK), red: rgbf(RED2), redD: rgbf(RED_D2), grn: rgbf(TEAL2), grnD: rgbf(GRN_D), yel: rgbf(YEL_L), skin: rgbf(HIDE_L), ink: rgbf(OUT) };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (I.a[i] < 0.02) continue;
      const fy = (y - top) / PH;
      const skin = S.r[i] > 0.36 && S.r[i] > S.g[i] && S.g[i] > S.b[i] && S.r[i] - S.b[i] > 0.1;
      const l = L[i];
      let c, a = 0.97, region = "hair";
      if (skin) {
        c = C.skin;
        a = 0.78;
        region = "skin";
      } else if (fy < 0.115) c = C.hair;
      else if (fy < 0.53) {
        region = "shirt";
        c = l > 0.62 ? C.yel : mixc(C.redD, C.red, sstep(0.05, 0.4, l));
      } else if (fy < 0.905) {
        region = "pants";
        c = mixc(C.grnD, C.grn, sstep(0.05, 0.4, l));
      } else {
        region = "shoe";
        c = C.hair;
      }
      const m = 1 + (noise2(x * 0.09, y * 0.09, 1141) - 0.5) * 0.16;
      c = [c[0] * m, c[1] * m, c[2] * m];
      let hole = false;
      if (In[i] > 0.985) {
        if (region === "shirt" && fy > 0.17 && fy < 0.5) {
          const sp = 15, u = (x % sp + sp) % sp - sp / 2, v = ((y + Math.floor(x / sp) % 2 * 7) % sp + sp) % sp - sp / 2, d = Math.hypot(u, v);
          hole = d > 3.6 && d < 5.4 || Math.abs(u) < 1.2 && Math.abs(v) < 1.2;
        } else if (region === "pants" && fy < 0.88) {
          const sp = 12, row = Math.floor(y / sp), u = ((x + row % 2 * 6) % sp + sp) % sp - sp / 2, v = (y % sp + sp) % sp - sp / 2;
          hole = Math.abs(u) + Math.abs(v) < 2.8;
        } else if (region === "hair" && fy > 0.025) {
          hole = ((x * 0.55 + y) % 8 + 8) % 8 < 1.1;
        }
      }
      const e = skin ? sstep(0.28, 0.58, F[i]) : sstep(0.6, 1.05, E[i]);
      if (e > 0.25) {
        hole = false;
        a = Math.max(a, 0.96);
      }
      c = mixc(c, C.ink, Math.min(1, e));
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
      O.a[i] = hole ? 0 : Math.min(a, I.a[i] < 0.9 ? 1 : a);
    }
    for (const fy of [0.215, 0.5, 0.735]) {
      const y = Math.round(top + fy * PH);
      const runs = [];
      let s0 = -1;
      for (let x = 0; x <= w; x++) {
        const on = x < w && I.a[y * w + x] > 0.5;
        if (on && s0 < 0) s0 = x;
        if (!on && s0 >= 0) {
          if (x - s0 >= 18) runs.push([s0, x]);
          s0 = -1;
        }
      }
      runs.sort((p, q) => q[1] - q[0] - (p[1] - p[0]));
      for (const [r0, r1] of runs.slice(0, fy > 0.6 ? 2 : 1)) stampRivet(O, Math.round((r0 + r1) / 2), y, 5.5);
    }
    outline(O, I.a, 3.4, C.ink);
    return O;
  }
  function stampRivet(O, cx, cy, r) {
    const brass = rgbf(BRASS), ink = rgbf(OUT), hi = rgbf("#fbe6a8");
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      if (x < 0 || y < 0 || x >= O.w || y >= O.h) continue;
      const d = Math.hypot(x - cx, y - cy), i = y * O.w + x;
      if (d > r) continue;
      const c = d > r - 1.6 ? ink : Math.hypot(x - cx + r * 0.3, y - cy + r * 0.3) < r * 0.3 ? hi : brass;
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
      O.a[i] = 1;
    }
  }
  registerStyle("s11-puppet", (I) => puppetize(I));
  var ghostStyle = (tint, k) => (I) => {
    const O = puppetize(I), T = rgbf(tint);
    for (let i = 0; i < O.w * O.h; i++) {
      if (O.a[i] < 0.01) continue;
      const l = 0.299 * O.r[i] + 0.587 * O.g[i] + 0.114 * O.b[i], kk = k * (l < 0.12 ? 0.35 : 1);
      O.r[i] += (T[0] - O.r[i]) * kk;
      O.g[i] += (T[1] - O.g[i]) * kk;
      O.b[i] += (T[2] - O.b[i]) * kk;
    }
    return O;
  };
  registerStyle("s11-ghost-r", ghostStyle("#e04a2a", 0.55));
  registerStyle("s11-ghost-c", ghostStyle("#1f9a92", 0.55));
  function ghosts(b, rb) {
    if (rb < GAG || rb >= LEAVE) return null;
    const x = b - GAG;
    const pop = keyframes([[-0.3, 0.55], [0.02, 0.6], [0.12, 1.14], [0.3, 1]], x);
    const sw = swing(b, rb);
    return { spread: 150 * pop * (0.9 + 0.1 * Math.abs(sw)), drift: -sw * 46 * pop, tilt: -sw * 0.045 * pop };
  }
  function manPuppet(ctx, fig, style) {
    drawWalker(ctx, { ...fig, style, rim: null });
    const stand = fig.pose === "stand", A = stand ? ANCHORS.stand : ANCHORS.walk;
    ctx.save();
    if (fig.lean) ctx.rotate(fig.lean);
    rodShadow(ctx, A.shoulder[0] - 6, A.shoulder[1] + 18, 170);
    if (stand) rodShadow(ctx, A.handR[0] - 4, A.handR[1] + 6, 230, 3.4);
    ctx.restore();
  }
  var s11 = {
    id: "s11",
    station: ST11,
    quantize: 10,
    figureStyle: "s11-puppet",
    freezeBeat: GAG + 1.5,
    // Outro 展墙：三个影子散开
    figureAdjust(b, env) {
      const rb = rawB2(env);
      if (rb >= GAG && rb < LEAVE) return { pose: "stand" };
      if (rb >= LEAVE && b < LEAVE) return { pose: "walk" };
      return null;
    },
    drawFigure(ctx, fig, b, env) {
      const G = ghosts(b, rawB2(env));
      if (!G) {
        manPuppet(ctx, fig, "s11-puppet");
        return;
      }
      for (const [dx, style, rot] of [[-G.spread + G.drift * 1.3, "s11-ghost-r", G.tilt], [G.spread + G.drift * 0.7, "s11-ghost-c", -G.tilt * 0.8]]) {
        ctx.save();
        ctx.globalCompositeOperation = "multiply";
        ctx.globalAlpha *= 0.72;
        ctx.translate(dx, 0);
        ctx.rotate(rot);
        manPuppet(ctx, fig, style);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(G.drift * 0.3, 0);
      manPuppet(ctx, fig, "s11-puppet");
      ctx.restore();
    },
    drawBack(ctx, b, env) {
      const rb = rawB2(env), cam = env.cam, gc = env.camAt(GAG);
      const L = lampAt(b, rb);
      ctx.drawImage(screenImg(), X_MIN, 0, X_MAX - X_MIN, 1e3);
      drawLampGlow(ctx, L);
      drawStrip(ctx, far1Layer2(), cam - shadowShift(L, 0.3) / P_FAR12);
      drawStrip(ctx, far2Layer2(), cam - shadowShift(L, 0.12) / P_FAR22);
      drawStrip(ctx, nearLayer3(gc), cam - shadowShift(L, 0.015));
      if (b >= T_HORSE[0] && b <= T_HORSE[1]) {
        const x = lerp(X_MAX + 240, X_MIN - 260, (b - T_HORSE[0]) / (T_HORSE[1] - T_HORSE[0]));
        drawHorse(ctx, x, b);
      }
      const sx = (rb < T_FLIP ? SCH_SX + gc - cam : SCH_SX + gc - env.camAt(T_FLIP) + (b - T_FLIP) * 26) + shadowShift(L, 0.015);
      if (sx > X_MIN - 200 && sx < X_MAX + 200) drawScholar(ctx, sx, b, rb);
    },
    drawFront(ctx, b, env) {
      const L = lampAt(b, rawB2(env));
      drawLight(ctx, L);
      ctx.drawImage(stageImg(), X_MIN, 0, X_MAX - X_MIN, 1e3);
    },
    drawFrame(ctx, R) {
      stageFrame(ctx, R);
    },
    cardStyle: {
      ink: OUT,
      accent: RED2,
      bar: false,
      bgDraw(ctx, x, y, w, h) {
        const { canvas, pad } = leatherPlate("card", w, h, { lobes: true, border: true });
        ctx.drawImage(canvas, x - pad, y - pad);
      }
    },
    playerStyle: {
      ink: OUT,
      noteColor: RED2,
      backdrop: false,
      plateDraw(ctx, x, y, w, h) {
        const { canvas, pad } = leatherPlate("plate", w, h, { lobes: false, border: false });
        ctx.drawImage(canvas, x - pad, y - pad);
      },
      drawPlayer(ctx, kind, cx, cy, s, spin) {
        puppetCD(ctx, cx, cy, s, spin);
      }
    }
  };
  function leatherPlate(key, w, h, { lobes, border }) {
    const pad = 30;
    const canvas = memo(`s11-plate|${key}|${Math.round(w)}|${Math.round(h)}`, () => {
      const c = makeCanvas(w + pad * 2, h + pad * 2), g = c.getContext("2d");
      g.translate(pad, pad);
      const path = new Path2D();
      if (lobes) {
        path.rect(0, 0, w, h);
        for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) {
          path.moveTo(cx + 20, cy);
          path.arc(cx, cy, 20, 0, TAU);
        }
      } else {
        path.moveTo(16, 0);
        path.lineTo(w - 16, 0);
        path.quadraticCurveTo(w + 14, 0, w + 14, h / 2);
        path.quadraticCurveTo(w + 14, h, w - 16, h);
        path.lineTo(16, h);
        path.quadraticCurveTo(-14, h, -14, h / 2);
        path.quadraticCurveTo(-14, 0, 16, 0);
        path.closePath();
      }
      g.save();
      g.shadowColor = "rgba(60,25,8,0.35)";
      g.shadowBlur = 14;
      g.shadowOffsetY = 4;
      g.lineWidth = 6;
      g.strokeStyle = OUT;
      g.lineJoin = "round";
      g.stroke(path);
      g.restore();
      g.fillStyle = "#f3d9a0";
      g.fill(path);
      g.save();
      g.clip(path);
      g.globalAlpha = 0.35;
      g.fillStyle = g.createPattern(mottle(), "repeat");
      g.fill(path);
      g.restore();
      g.save();
      g.clip(path);
      g.globalCompositeOperation = "destination-out";
      g.fillStyle = "#000";
      g.strokeStyle = "#000";
      g.lineCap = "round";
      if (border) {
        for (let x = 34; x < w - 26; x += 22) {
          cutDot(g, x, 12, 3.6);
          cutDot(g, x, h - 12, 3.6);
        }
        for (let y = 34; y < h - 26; y += 22) {
          cutDot(g, 12, y, 3.6);
          cutDot(g, w - 12, y, 3.6);
        }
        g.lineWidth = 2;
        g.strokeRect(22, 22, w - 44, h - 44);
      } else {
        for (let x = 22; x < w - 14; x += 20) {
          cutDot(g, x, 9, 2.8);
          cutDot(g, x, h - 9, 2.8);
        }
        for (const ex of [-2, w + 2]) cutSpiral(g, ex, h / 2, 9, 1.3, 2.4);
      }
      if (lobes) for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) cutSpiral(g, cx + (cx ? 4 : -4), cy + (cy ? 4 : -4), 12, 1.3, 2.6, cx ? -1 : 1);
      g.restore();
      if (lobes) for (const [cx, cy] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) rivet(g, cx + (cx < w / 2 ? 14 : -14), cy + (cy < h / 2 ? 14 : -14), 5);
      return c;
    });
    return { canvas, pad };
  }
  function cdImg(r) {
    return memo(`s11-cd|${Math.round(r)}`, () => {
      const S = Math.ceil(r * 2 + 8), c = makeCanvas(S, S), g = c.getContext("2d");
      g.translate(S / 2, S / 2);
      const ring = (r0, r1) => {
        const p = new Path2D();
        p.arc(0, 0, r1, 0, TAU);
        p.moveTo(r0, 0);
        p.arc(0, 0, r0, 0, TAU, true);
        return p;
      };
      const outer = new Path2D();
      for (let i = 0; i <= 96; i++) {
        const a = i / 96 * TAU, rr = r * (0.95 + 0.05 * Math.cos(a * 12));
        i ? outer.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : outer.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      outer.closePath();
      outer.moveTo(r * 0.64, 0);
      outer.arc(0, 0, r * 0.64, 0, TAU, true);
      const cut = (path, fn) => {
        g.save();
        g.clip(path, "evenodd");
        g.globalCompositeOperation = "destination-out";
        g.fillStyle = "#000";
        g.strokeStyle = "#000";
        g.lineCap = "round";
        fn(g);
        g.restore();
      };
      g.fillStyle = RED2;
      g.fill(outer, "evenodd");
      cut(outer, (c2) => {
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * TAU;
          cutLeaf(c2, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.11, r * 0.04, a);
          cutDot(c2, Math.cos(a + TAU / 24) * r * 0.86, Math.sin(a + TAU / 24) * r * 0.86, r * 0.025);
        }
      });
      g.lineWidth = 2.6;
      g.strokeStyle = OUT;
      g.stroke(outer);
      const mid = ring(r * 0.34, r * 0.64);
      g.fillStyle = YEL;
      g.fill(mid, "evenodd");
      cut(mid, (c2) => {
        for (let i = 0; i < 9; i++) {
          const a = i / 9 * TAU;
          cutCoin(c2, Math.cos(a) * r * 0.49, Math.sin(a) * r * 0.49, r * 0.085);
        }
      });
      g.lineWidth = 2;
      g.strokeStyle = OUT;
      g.stroke(mid);
      const core = ring(r * 0.12, r * 0.34);
      g.fillStyle = TEAL2;
      g.fill(core, "evenodd");
      cut(core, (c2) => {
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * TAU;
          cutLine(c2, [[Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16], [Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3]], 2.2);
        }
      });
      g.lineWidth = 2;
      g.strokeStyle = OUT;
      g.stroke(core);
      rivet(g, 0, 0, r * 0.12);
      return c;
    });
  }
  function puppetCD(ctx, cx, cy, s, spin) {
    const r = 82 * s;
    ctx.save();
    const ex = cx + 34, ey = cy + 240, ang = Math.atan2(ey - cy, ex - cx), len = Math.hypot(ex - cx, ey - cy);
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    const gr = ctx.createLinearGradient(0, -6, 0, 6);
    gr.addColorStop(0, "#e8c27a");
    gr.addColorStop(0.5, "#b98f48");
    gr.addColorStop(1, "#7a5a2a");
    ctx.fillStyle = gr;
    ctx.fillRect(0, -5.5, len, 11);
    ctx.strokeStyle = OUT;
    ctx.lineWidth = 1.6;
    ctx.strokeRect(0, -5.5, len, 11);
    ctx.fillStyle = "#6a4a20";
    for (let d = 40; d < len; d += 64) ctx.fillRect(d, -6.5, 4, 13);
    ctx.restore();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    const img = cdImg(r);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  }
  function stageFrame(ctx, R) {
    const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
    ctx.save();
    ctx.fillStyle = "rgba(30,10,4,0.22)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 1.1, w * 0.55, t * 0.5, 0, 0, TAU);
    ctx.fill();
    const band = new Path2D();
    band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
    band.rect(x, y, w, h);
    const gr = ctx.createLinearGradient(x - t, y - t, x + w + t, y + h + t);
    gr.addColorStop(0, "#8a2a18");
    gr.addColorStop(0.5, LACQ);
    gr.addColorStop(1, LACQ_D);
    ctx.fillStyle = gr;
    ctx.fill(band, "evenodd");
    ctx.strokeStyle = GOLD3;
    ctx.lineWidth = Math.max(1, 3 * s);
    ctx.strokeRect(x - t * 0.82, y - t * 0.82, w + t * 1.64, h + t * 1.64);
    ctx.strokeRect(x - 5 * s, y - 5 * s, w + 10 * s, h + 10 * s);
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeStyle = rgba(GOLD3, 0.9);
    const m = t * 0.34, step = t * 0.62;
    const meander = (mx, my) => {
      ctx.beginPath();
      ctx.moveTo(mx, my + m);
      ctx.lineTo(mx, my);
      ctx.lineTo(mx + m, my);
      ctx.lineTo(mx + m, my + m * 0.78);
      ctx.lineTo(mx + m * 0.24, my + m * 0.78);
      ctx.lineTo(mx + m * 0.24, my + m * 0.3);
      ctx.lineTo(mx + m * 0.7, my + m * 0.3);
      ctx.stroke();
    };
    for (let mx = x - t * 0.6; mx < x + w + t * 0.4; mx += step) {
      meander(mx, y - t * 0.62);
      meander(mx, y + h + t * 0.28);
    }
    for (let my = y; my < y + h - m; my += step) {
      meander(x - t * 0.62, my);
      meander(x + w + t * 0.28, my);
    }
    for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) {
      ctx.fillStyle = LACQ_D;
      ctx.beginPath();
      ctx.arc(cx, cy, t * 0.44, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = GOLD3;
      ctx.lineWidth = Math.max(1, 2.4 * s);
      ctx.stroke();
      ctx.beginPath();
      for (let k = 0; k <= 30; k++) {
        const tt = k / 30, a = tt * 1.4 * TAU, rr = t * 0.32 * (1 - tt * 0.85);
        k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(20,6,2,0.8)";
    ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
    ctx.restore();
  }

  // src/scenes/s12.js
  var ST12 = stationByN(12);
  var PAPER8 = "#f7ecd2";
  var PAPER22 = "#f3e0b4";
  var INK8 = "#1d1612";
  var RED3 = "#d8352a";
  var RED_D3 = "#a8261f";
  var PINK = "#f07c98";
  var PINK_L = "#f8b3c2";
  var YEL2 = "#f6c234";
  var YEL_L2 = "#fbe08a";
  var GRN2 = "#2f9a57";
  var GRN_L = "#8fcf7e";
  var IND = "#2c4f9c";
  var IND_L = "#9cb8e0";
  var STONE2 = "#eadcbc";
  var STONE_D2 = "#d8c59c";
  var WALL2 = "#fbf4e2";
  var WOOD2 = "#8a4b28";
  var SKIN = "#f8d3ac";
  var WHITE = "#fffaf0";
  var P_SKY5 = 0.04;
  var P_MTN = 0.12;
  var P_CITY = 0.24;
  var P_TREE = 0.5;
  var P_FG6 = 1.3;
  var REG2 = [2.4, 1.8];
  var LW2 = 3.2;
  var INN = { x0: 455, x1: 1565 };
  var PILLARS = [462, 602, 800, 1e3, 1200, 1400, 1558];
  var DOOR_X = 701;
  var FLAG_X2 = 438;
  var W_STAND = 578;
  var DINER_A = 905;
  var DINER_B = 1100;
  var KEEPER = 1300;
  var HOOKS = [532, 1e3, 1160, 1480];
  var INN_BOX = { x0: 380, x1: 1650, y0: 150, y1: 806 };
  var T_POP = [GAG - 3.6, GAG - 2.9];
  var T_TROT = [GAG - 2.9, GAG - 0.5];
  var T_SALUTE = GAG;
  var T_RISE_A = [GAG + 0.7, GAG + 1];
  var T_RISE_B = [GAG + 1.2, GAG + 1.5];
  var T_JAR = [GAG + 1.55, GAG + 2];
  var T_SWEAT2 = [GAG + 2.6, GAG + 4.1];
  var T_SIT = [GAG + 4.7, GAG + 5.4];
  var pathOf2 = (fn) => {
    const p = new Path2D();
    fn(p);
    return p;
  };
  var rectP2 = (x, y, w, h) => pathOf2((p) => p.rect(x, y, w, h));
  var ellP = (x, y, rx, ry, rot = 0) => pathOf2((p) => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));
  var circP = (x, y, r) => ellP(x, y, r, r);
  var polyP = (pts, close = true) => pathOf2((p) => {
    pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    if (close) p.closePath();
  });
  function nh(ctx, path, fill, { line: line2 = LW2, reg = 1, ink = INK8 } = {}) {
    if (fill) {
      ctx.save();
      if (reg) ctx.translate(REG2[0] * reg, REG2[1] * reg);
      ctx.fillStyle = fill;
      ctx.fill(path);
      ctx.restore();
    }
    if (line2) {
      ctx.lineWidth = line2;
      ctx.strokeStyle = ink;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(path);
    }
  }
  function nhUnion(ctx, path, fill, { line: line2 = LW2, under = PAPER8 } = {}) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK8;
    ctx.lineWidth = line2 * 2;
    ctx.stroke(path);
    ctx.fillStyle = under;
    ctx.fill(path);
    ctx.clip(path);
    ctx.translate(REG2[0], REG2[1]);
    ctx.fillStyle = fill;
    ctx.fill(path);
    ctx.restore();
  }
  function strokeLine(ctx, pts, w = LW2, color = INK8) {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
  }
  function tubeP(pts, radii) {
    const p = new Path2D(), n = pts.length, L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      L.push([pts[i][0] - dy * radii[i], pts[i][1] + dx * radii[i]]);
      R.push([pts[i][0] + dy * radii[i], pts[i][1] - dx * radii[i]]);
    }
    const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
    p.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) p.lineTo(L[i][0], L[i][1]);
    const e = n - 1, ae = ang(pts[e - 1], pts[e]);
    p.arc(pts[e][0], pts[e][1], radii[e], ae + Math.PI / 2, ae - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) p.lineTo(R[i][0], R[i][1]);
    const a0 = ang(pts[0], pts[1]);
    p.arc(pts[0][0], pts[0][1], radii[0], a0 - Math.PI / 2, a0 + Math.PI / 2, true);
    p.closePath();
    return p;
  }
  function woodTile() {
    return memo("s12-woodtile", () => {
      const S = 256, c = makeCanvas(S, S), x = c.getContext("2d"), im = x.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const v = Math.sin(TAU * (23 * j / S + 0.9 * Math.sin(TAU * (3 * i / S + j / S)) + 0.3 * Math.sin(TAU * (7 * i / S + 5 * j / S))));
        const gate = 0.5 + 0.5 * Math.sin(TAU * (2 * i / S + 3 * j / S)) * Math.sin(TAU * (5 * j / S - i / S));
        const h = hash2(i, j, 12);
        const k = (j * S + i) * 4;
        if (h < 0.035) {
          im.data[k] = 255;
          im.data[k + 1] = 248;
          im.data[k + 2] = 230;
          im.data[k + 3] = 150;
        } else {
          const a = (v > 0.9 ? (v - 0.9) * 4 : 0) * 0.32 * gate + (h > 0.965 ? 0.35 : 0);
          im.data[k] = 40;
          im.data[k + 1] = 22;
          im.data[k + 2] = 14;
          im.data[k + 3] = a * 255;
        }
      }
      x.putImageData(im, 0, 0);
      return c;
    });
  }
  function inkTexture(ctx, x0, y0, w, h, alpha = 0.55) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.createPattern(woodTile(), "repeat");
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
  }
  function huiwen(ctx, x, y, len, h, color, lw = h * 0.13) {
    const u = h * 1.05, n = Math.max(1, Math.floor(len / u)), o = x + (len - n * u) / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = "miter";
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const ox = o + i * u;
      ctx.moveTo(ox, y + h);
      ctx.lineTo(ox, y);
      ctx.lineTo(ox + 0.82 * u, y);
      ctx.lineTo(ox + 0.82 * u, y + 0.72 * h);
      ctx.lineTo(ox + 0.3 * u, y + 0.72 * h);
      ctx.lineTo(ox + 0.3 * u, y + 0.34 * h);
      ctx.lineTo(ox + 0.58 * u, y + 0.34 * h);
    }
    ctx.moveTo(o, y + h);
    ctx.lineTo(o + n * u, y + h);
    ctx.stroke();
    ctx.restore();
  }
  function tuanhua(ctx, cx, cy, r, { n = 8, petal: petal2 = PINK, inner = RED3, leaf: leaf2 = GRN2, core = YEL2, lw = 2, rot = 0, reg = 0.6 } = {}) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * TAU / n;
      nh(ctx, ellP(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, r * 0.34, r * 0.12, a), leaf2, { line: lw, reg });
    }
    for (let i = 0; i < n; i++) {
      const a = i * TAU / n;
      nh(ctx, ellP(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.36, r * 0.24, a), petal2, { line: lw, reg });
    }
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) * TAU / n;
      nh(ctx, ellP(Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27, r * 0.17, r * 0.1, a), inner, { line: lw * 0.8, reg });
    }
    nh(ctx, circP(0, 0, r * 0.16), core, { line: lw, reg });
    ctx.restore();
  }
  function spiral(ctx, cx, cy, r, { turns = 1.25, a0 = 2.4, dir = 1, lw = 2 } = {}) {
    ctx.strokeStyle = INK8;
    ctx.lineWidth = lw;
    ctx.lineCap = "round";
    ctx.beginPath();
    for (let i = 0; i <= 28; i++) {
      const t = i / 28, a = a0 + dir * t * turns * TAU, rr = r * (1 - t * 0.78);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  var CLOUD_LOBES = [[-58, 6, 22], [-26, -12, 31], [16, -18, 28], [50, -2, 22], [4, 10, 24], [-34, 12, 18]];
  function xiangyun(ctx, x, y, s, fill, { lw = LW2, flip = 1 } = {}) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(flip * s, s);
    const p = new Path2D();
    for (const [dx, dy, r] of CLOUD_LOBES) {
      p.moveTo(dx + r, dy);
      p.arc(dx, dy, r, 0, TAU);
    }
    p.moveTo(60, 14);
    p.quadraticCurveTo(100, 22, 128, 6);
    p.quadraticCurveTo(110, 26, 60, 30);
    p.closePath();
    const L = lw / s;
    nhUnion(ctx, p, fill, { line: L });
    for (const [dx, dy, r, d] of [[-26, -12, 31, 1], [16, -18, 28, -1], [-58, 6, 22, 1], [50, -2, 22, -1]]) spiral(ctx, dx, dy + 2, r * 0.62, { dir: d, lw: L * 0.75, a0: d > 0 ? 2.6 : 0.6 });
    ctx.restore();
  }
  var paper = () => paperTexture(Math.ceil((X_MAX - X_MIN) * K), Math.ceil(1e3 * K), { base: PAPER8, seed: 12, amount: 1.1 });
  function skyLayer6() {
    return strip("s12-sky", P_SKY5, (ctx, x0, x1) => {
      const sx = 1010 + 1250 * P_SKY5;
      nh(ctx, circP(sx, 128, 66), YEL_L2, { line: LW2 });
      nh(ctx, circP(sx, 128, 50), RED3, { line: LW2 });
      ctx.fillStyle = rgba(YEL_L2, 0.85);
      ctx.beginPath();
      ctx.ellipse(sx - 18, 110, 12, 7, -0.6, 0, TAU);
      ctx.fill();
      const R = rng("s12-sky");
      const cols = [IND_L, PINK_L, YEL_L2, "#bfe0c8"];
      let i = 0;
      for (let x = x0 + 60; x < x1; x += 300 + R() * 240) {
        const y = 70 + R() * 150, s = 0.55 + R() * 0.35;
        if (Math.abs(x - sx) < 160 && y < 220) continue;
        xiangyun(ctx, x, y, s, cols[i++ % cols.length], { flip: R() < 0.5 ? -1 : 1 });
      }
      inkTexture(ctx, x0, 0, x1 - x0, 300, 0.5);
    }, { y0: 0, y1: 300 });
  }
  function peak(ctx, cx, base, w, h, cols, R) {
    const lean = (R() - 0.5) * 0.25 * w;
    const p = new Path2D();
    p.moveTo(cx - w / 2, base);
    p.bezierCurveTo(cx - w * 0.36, base - h * 0.5, cx - w * 0.24 + lean, base - h * 1.04, cx + lean * 0.5, base - h);
    p.bezierCurveTo(cx + w * 0.24 + lean, base - h * 0.98, cx + w * 0.36, base - h * 0.48, cx + w / 2, base);
    p.closePath();
    ctx.save();
    ctx.translate(REG2[0], REG2[1]);
    ctx.fillStyle = cols[2];
    ctx.fill(p);
    ctx.clip(p);
    const band = (y, color) => {
      const q = new Path2D();
      q.moveTo(cx - w, base - h - 20);
      q.lineTo(cx + w, base - h - 20);
      for (let k = 0; k <= 12; k++) {
        const xx = cx + w - k / 12 * 2 * w;
        q.lineTo(xx, y + Math.sin(k * 1.7 + cx * 0.01) * 8);
      }
      q.closePath();
      ctx.fillStyle = color;
      ctx.fill(q);
    };
    band(base - h * 0.45, cols[1]);
    band(base - h * 0.78, cols[0]);
    ctx.restore();
    nh(ctx, p, null, { line: LW2 });
    ctx.strokeStyle = INK8;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    for (const k of [-1, 1]) {
      const sx = cx + lean * 0.45 + k * w * 0.09, sy = base - h * 0.84;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(sx + k * w * 0.05, sy + h * 0.12, sx + k * w * 0.1, sy + h * 0.2);
      ctx.stroke();
    }
  }
  function mountainLayer() {
    return strip("s12-mtn", P_MTN, (ctx, x0, x1) => {
      const R = rng("s12-mtn");
      const rows = [
        { base: 560, w: [300, 420], h: [200, 260], cols: ["#6f95d0", "#7cc3a4", "#d3ecc6"] },
        { base: 590, w: [240, 340], h: [130, 190], cols: ["#4f9a6f", "#86ca7a", "#e3f1bd"] }
      ];
      for (const row of rows) {
        let x = x0 - 80 + R() * 100;
        while (x < x1 + 120) {
          const w = row.w[0] + R() * (row.w[1] - row.w[0]), h = row.h[0] + R() * (row.h[1] - row.h[0]);
          peak(ctx, x, row.base, w, h, row.cols, R);
          x += w * (0.5 + R() * 0.25);
        }
      }
      for (let x = x0 + 40; x < x1; x += 260 + R() * 160) xiangyun(ctx, x, 470 + R() * 30, 0.5 + R() * 0.2, WHITE, { flip: R() < 0.5 ? -1 : 1 });
      inkTexture(ctx, x0, 260, x1 - x0, 360, 0.55);
    }, { y0: 260, y1: 600 });
  }
  function eaveRoof(ctx, xa, xb, ridgeY, eaveY, { flare: flare2 = 36, inset = 0.22, color = IND, ridge: ridge2 = GRN2, lw = LW2 } = {}) {
    const w = xb - xa, ra = xa + w * inset, rb = xb - w * inset;
    const p = new Path2D();
    p.moveTo(ra, ridgeY);
    p.lineTo(rb, ridgeY);
    p.quadraticCurveTo(xb - w * 0.04, eaveY - (eaveY - ridgeY) * 0.25, xb + flare2, eaveY - flare2 * 0.8);
    p.quadraticCurveTo(xb - flare2 * 0.4, eaveY + 2, xb - flare2 * 1.6, eaveY);
    p.lineTo(xa + flare2 * 1.6, eaveY);
    p.quadraticCurveTo(xa + flare2 * 0.4, eaveY + 2, xa - flare2, eaveY - flare2 * 0.8);
    p.quadraticCurveTo(xa + w * 0.04, eaveY - (eaveY - ridgeY) * 0.25, ra, ridgeY);
    p.closePath();
    nh(ctx, p, color, { line: lw });
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = rgba(INK8, 0.75);
    ctx.lineWidth = Math.max(1, lw * 0.4);
    const n = Math.round(w / 16);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      ctx.beginPath();
      ctx.moveTo(lerp(ra, rb, t), ridgeY);
      ctx.lineTo(lerp(xa - flare2 * 0.4, xb + flare2 * 0.4, t), eaveY + 4);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = YEL2;
    for (let x = xa + flare2 * 1.2; x < xb - flare2 * 1.2; x += 15) {
      ctx.beginPath();
      ctx.arc(x, eaveY - 3, Math.max(1.5, lw * 0.75), 0, TAU);
      ctx.fill();
    }
    const rh = Math.max(6, (eaveY - ridgeY) * 0.14);
    nh(ctx, rectP2(ra - 6, ridgeY - rh, rb - ra + 12, rh), ridge2, { line: lw });
    ctx.strokeStyle = YEL2;
    ctx.lineWidth = Math.max(1.5, lw * 0.6);
    ctx.beginPath();
    ctx.moveTo(ra - 2, ridgeY - rh * 0.55);
    ctx.lineTo(rb + 2, ridgeY - rh * 0.55);
    ctx.stroke();
    for (const [x, d] of [[ra - 6, -1], [rb + 6, 1]]) {
      nh(ctx, circP(x + d * rh * 0.3, ridgeY - rh * 1.3, rh * 0.75), YEL2, { line: lw * 0.8 });
      spiral(ctx, x + d * rh * 0.3, ridgeY - rh * 1.3, rh * 0.55, { dir: d, lw: lw * 0.6 });
    }
    return p;
  }
  function cityLayer() {
    return strip("s12-city", P_CITY, (ctx, x0, x1) => {
      const WALLC = "#f2cd8f", BRICK = "#cf9f5f";
      const body = rectP2(x0 - 10, 500, x1 - x0 + 20, 110);
      nh(ctx, body, WALLC, { line: LW2 });
      ctx.strokeStyle = BRICK;
      ctx.lineWidth = 1.6;
      for (let y = 520; y < 610; y += 18) {
        ctx.beginPath();
        ctx.moveTo(x0, y);
        ctx.lineTo(x1, y);
        ctx.stroke();
        for (let x = x0 + y / 18 % 2 * 20; x < x1; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + 18);
          ctx.stroke();
        }
      }
      for (let x = x0; x < x1; x += 30) nh(ctx, rectP2(x, 486, 17, 15), WALLC, { line: 2.4 });
      const towers = [];
      for (let x = 140 + 1250 * P_CITY - 1150; x < x1 + 200; x += 1150) towers.push(x);
      for (const tx of towers) {
        if (tx < x0 - 200) continue;
        nh(ctx, rectP2(tx - 150, 470, 300, 140), WALLC, { line: LW2 });
        for (let x = tx - 150; x < tx + 150; x += 30) nh(ctx, rectP2(x, 457, 17, 14), WALLC, { line: 2.4 });
        nh(ctx, rectP2(tx - 108, 400, 216, 58), PAPER8, { line: LW2 });
        for (let k = 0; k < 6; k++) nh(ctx, rectP2(tx - 104 + k * 40, 400, 10, 58), RED3, { line: 2 });
        nh(ctx, rectP2(tx - 112, 446, 224, 12), RED_D3, { line: 2.4 });
        eaveRoof(ctx, tx - 140, tx + 140, 372, 404, { flare: 22, inset: 0.18, lw: 2.6 });
        nh(ctx, rectP2(tx - 72, 338, 144, 36), PAPER8, { line: 2.6 });
        for (let k = 0; k < 4; k++) nh(ctx, rectP2(tx - 68 + k * 44, 338, 9, 36), RED3, { line: 2 });
        eaveRoof(ctx, tx - 108, tx + 108, 290, 342, { flare: 24, inset: 0.24, lw: 2.6 });
      }
      inkTexture(ctx, x0, 280, x1 - x0, 340, 0.5);
    }, { y0: 270, y1: 620 });
  }
  function canopy(ctx, cx, cy, r, fill, R, dots) {
    const p = new Path2D();
    const n = 5 + Math.floor(R() * 3);
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + R() * 0.4, d = r * (0.45 + R() * 0.2), rr = r * (0.42 + R() * 0.18);
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7;
      p.moveTo(x + rr, y);
      p.arc(x, y, rr, 0, TAU);
    }
    p.moveTo(cx + r * 0.6, cy);
    p.arc(cx, cy, r * 0.6, 0, TAU);
    nhUnion(ctx, p, fill, { line: 2.8 });
    if (dots) {
      ctx.save();
      ctx.clip(p);
      for (let k = 0; k < 26; k++) {
        const a = R() * TAU, d = R() * r * 0.95;
        const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.75;
        ctx.fillStyle = dots[k % dots.length];
        ctx.beginPath();
        ctx.arc(x, y, 3.5 + R() * 3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function treeLayer() {
    return strip("s12-trees", P_TREE, (ctx, x0, x1) => {
      const R = rng("s12-trees");
      for (let x = x0 + R() * 60; x < x1; x += 120 + R() * 150) {
        const peach = R() < 0.4, r = 46 + R() * 26, cy = 520 + R() * 30;
        nh(ctx, polyP([[x - 6, 780], [x - 4, cy + 10], [x + 4, cy + 10], [x + 7, 780]]), WOOD2, { line: 2.4 });
        canopy(ctx, x, cy, r, peach ? PINK_L : "#5fb36a", R, peach ? [PINK, RED3] : ["#3f9a55", GRN_L]);
      }
      inkTexture(ctx, x0, 420, x1 - x0, 380, 0.5);
    }, { y0: 420, y1: 800 });
  }
  function tileCoping(ctx, xa, xb, y) {
    nh(ctx, rectP2(xa - 6, y, xb - xa + 12, 18), IND, { line: 2.6 });
    nh(ctx, rectP2(xa - 2, y - 8, xb - xa + 4, 9), "#3d5f9e", { line: 2.2 });
    ctx.strokeStyle = INK8;
    ctx.lineWidth = 1.6;
    for (let x = xa; x < xb; x += 13) {
      ctx.beginPath();
      ctx.arc(x + 6, y + 18, 5, 0, Math.PI);
      ctx.stroke();
    }
  }
  function wallSeg(ctx, xa, xb, R) {
    nh(ctx, rectP2(xa, 600, xb - xa, 192), WALL2, { line: LW2, reg: 0 });
    nh(ctx, rectP2(xa, 768, xb - xa, 24), STONE_D2, { line: 2.4 });
    tileCoping(ctx, xa, xb, 584);
    for (let x = xa + 120 + R() * 80; x < xb - 100; x += 300 + R() * 200) {
      const kind = Math.floor(R() * 3);
      let p;
      if (kind === 0) p = circP(x, 668, 34);
      else if (kind === 1) p = pathOf2((q) => {
        q.moveTo(x - 48, 690);
        q.arc(x, 712, 52, Math.PI * 1.22, Math.PI * 1.78);
        q.lineTo(x + 24, 700);
        q.arc(x, 712, 26, Math.PI * 1.78, Math.PI * 1.22, true);
        q.closePath();
      });
      else p = rectP2(x - 30, 640, 60, 54);
      nh(ctx, p, PAPER22, { line: 7, ink: GRN2, reg: 0 });
      ctx.save();
      ctx.clip(p);
      ctx.strokeStyle = GRN2;
      ctx.lineWidth = 2.4;
      for (let k = -80; k < 80; k += 12) {
        ctx.beginPath();
        ctx.moveTo(x + k, 620);
        ctx.lineTo(x + k + 60, 720);
        ctx.moveTo(x + k, 720);
        ctx.lineTo(x + k + 60, 620);
        ctx.stroke();
      }
      ctx.restore();
      nh(ctx, p, null, { line: 2 });
    }
  }
  function jar(ctx, cx, yb, h, body = "#b8692e") {
    const w = h * 0.86;
    const p = new Path2D();
    p.moveTo(cx - w * 0.22, yb - h);
    p.lineTo(cx + w * 0.22, yb - h);
    p.quadraticCurveTo(cx + w * 0.62, yb - h * 0.8, cx + w * 0.5, yb - h * 0.35);
    p.quadraticCurveTo(cx + w * 0.42, yb, cx + w * 0.28, yb);
    p.lineTo(cx - w * 0.28, yb);
    p.quadraticCurveTo(cx - w * 0.42, yb, cx - w * 0.5, yb - h * 0.35);
    p.quadraticCurveTo(cx - w * 0.62, yb - h * 0.8, cx - w * 0.22, yb - h);
    p.closePath();
    nh(ctx, p, body, { line: 2.6 });
    nh(ctx, ellP(cx, yb - h, w * 0.3, h * 0.1), RED3, { line: 2.2 });
    nh(ctx, polyP([[cx, yb - h * 0.72], [cx + h * 0.18, yb - h * 0.52], [cx, yb - h * 0.32], [cx - h * 0.18, yb - h * 0.52]]), RED3, { line: 2 });
    ctx.strokeStyle = rgba(YEL_L2, 0.9);
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(cx - w * 0.2, yb - h * 0.55, h * 0.22, 3.4, 4.3);
    ctx.stroke();
  }
  function jarStack(ctx, x) {
    for (const [dx, yb, h] of [[-48, 792, 56], [0, 792, 60], [48, 792, 56], [-24, 738, 52], [24, 738, 52], [0, 688, 48]]) jar(ctx, x + dx, yb, h);
  }
  function willow2(ctx, x, R) {
    const top = 452;
    nh(ctx, polyP([[x - 14, 800], [x - 8, 640], [x - 20, 520], [x - 4, top], [x + 8, top], [x + 4, 540], [x + 12, 640], [x + 14, 800]]), WOOD2, { line: LW2 });
    const strands = [];
    for (let k = 0; k < 30; k++) {
      const sx = x + (R() - 0.5) * 150, sy = top + R() * 40 - 10;
      const ex = sx + (sx - x) * 0.6 + (R() - 0.5) * 30, ey = 620 + R() * 110;
      strands.push([sx, sy, (sx + ex) / 2 + (sx - x) * 0.5, sy - 30, ex, ey]);
    }
    for (const [w, c] of [[6.4, INK8], [3.4, "#4caf5f"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.lineCap = "round";
      for (const [sx, sy, cx, cy, ex, ey] of strands) {
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();
      }
    }
    canopy(ctx, x, top - 8, 70, "#5fb36a", R, ["#3f9a55", GRN_L]);
  }
  function shop(ctx, xa, xb, R, kind) {
    const w = xb - xa;
    nh(ctx, rectP2(xa + 10, 520, w - 20, 272), PAPER22, { line: LW2, reg: 0 });
    nh(ctx, rectP2(xa, 768, w, 24), STONE_D2, { line: 2.4 });
    const aw = pathOf2((p) => {
      p.moveTo(xa - 10, 540);
      p.lineTo(xb + 10, 540);
      p.lineTo(xb + 22, 582);
      for (let x = xb + 22; x > xa - 22; x -= 30) p.quadraticCurveTo(x - 15, 598, x - 30, 582);
      p.closePath();
    });
    nh(ctx, aw, IND, { line: LW2 });
    ctx.save();
    ctx.translate(REG2[0], REG2[1]);
    ctx.clip(aw);
    ctx.fillStyle = WHITE;
    for (let x = xa - 10; x < xb + 20; x += 30) ctx.fillRect(x, 536, 12, 70);
    ctx.restore();
    nh(ctx, aw, null, { line: LW2 });
    eaveRoof(ctx, xa - 20, xb + 20, 448, 514, { flare: 26, inset: 0.16, lw: LW2 });
    nh(ctx, rectP2(xa + 4, 512, w - 8, 28), RED_D3, { line: 2.6 });
    for (const px of [xa + 8, xb - 8]) nh(ctx, rectP2(px - 9, 598, 18, 192), RED3, { line: 2.6 });
    nh(ctx, rectP2(xa + 30, 700, w - 60, 92), YEL2, { line: LW2 });
    huiwen(ctx, xa + 40, 712, w - 80, 16, RED3, 2.6);
    nh(ctx, rectP2(xa + 24, 690, w - 48, 12), WOOD2, { line: 2.6 });
    if (kind === 0) {
      for (const cx of [xa + w * 0.32, xa + w * 0.66]) for (let k = 0; k < 3; k++) nh(ctx, rectP2(cx - 34, 668 - k * 22, 68, 22), "#e3b867", { line: 2.4 });
      for (const cx of [xa + w * 0.32, xa + w * 0.66]) nh(ctx, ellP(cx, 602, 36, 9), "#e3b867", { line: 2.4 });
    } else {
      const cols = [PINK, GRN_L, YEL_L2, IND_L, RED3];
      for (let k = 0; k < 5; k++) nh(ctx, ellP(xa + 60 + k * (w - 120) / 4, 664, 22, 24), cols[k], { line: 2.4 });
      for (let k = 0; k < 4; k++) nh(ctx, ellP(xa + 82 + k * (w - 120) / 4, 624, 20, 22), cols[(k + 2) % 5], { line: 2.4 });
    }
    for (const lx of [xa + 40, xb - 40]) {
      strokeLine(ctx, [[lx, 590], [lx, 604]], 2);
      nh(ctx, ellP(lx, 626, 17, 21), RED3, { line: 2.4 });
      nh(ctx, rectP2(lx - 8, 602, 16, 5), YEL2, { line: 1.6 });
    }
  }
  function streetLayer2(cg) {
    return strip("s12-street", 1, (ctx, x0, x1) => {
      const R = rng("s12-street");
      const fx = (x2) => x2 + cg;
      const skipA = fx(INN.x0 + 10), skipB = fx(INN.x1 - 10);
      const shops = [[fx(-1520), fx(-1200), 0], [fx(-700), fx(-420), 1], [fx(1860), fx(2160), 0], [fx(2700), fx(3e3), 1]];
      const cuts = [[skipA, skipB], ...shops.map(([a, b]) => [a, b])].sort((a, b) => a[0] - b[0]);
      let x = x0;
      for (const [a, b] of cuts) {
        if (a > x) wallSeg(ctx, x, a, R);
        x = Math.max(x, b);
      }
      if (x < x1) wallSeg(ctx, x, x1, R);
      shops.forEach(([a, b, k]) => shop(ctx, a, b, R, k));
      for (const w of [-1e3, 100, 1720, 2480]) willow2(ctx, fx(w), R);
      for (const j of [-820, -150, 2330]) jarStack(ctx, fx(j));
      inkTexture(ctx, x0, 380, x1 - x0, 420, 0.5);
    }, { y0: 380, y1: 800 });
  }
  function roadLayer5() {
    return strip("s12-road", 1, (ctx, x0, x1) => {
      const R = rng("s12-road");
      nh(ctx, rectP2(x0, 800, x1 - x0, 200), STONE2, { line: 0, reg: 0 });
      const rows = [[800, 828], [828, 864], [864, 910], [910, 966], [966, 1004]];
      const tints = [STONE2, "#efe3c6", "#e3d2ad", "#f2e6cb", "#e6d8b8"];
      for (const [ya, yb] of rows) {
        let x = x0 - R() * 100;
        while (x < x1) {
          const w = (yb - ya) * (2.4 + R() * 1.6);
          nh(ctx, rectP2(x, ya, w, yb - ya), tints[Math.floor(R() * tints.length)], { line: 2.2, reg: 0.6 });
          if (R() < 0.12) {
            ctx.strokeStyle = GRN2;
            ctx.lineWidth = 2.2;
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(x + 2 + k * 3, yb);
              ctx.lineTo(x - 2 + k * 5, yb - 9);
              ctx.stroke();
            }
          }
          x += w;
        }
      }
      ctx.fillStyle = INK8;
      ctx.fillRect(x0, 798, x1 - x0, 4.5);
      inkTexture(ctx, x0, 800, x1 - x0, 200, 0.45);
    }, { y0: 796, y1: 1e3 });
  }
  function blossom2(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const p = new Path2D();
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU;
      p.moveTo(Math.cos(a) * r * 0.55 + r * 0.45, Math.sin(a) * r * 0.55);
      p.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.45, 0, TAU);
    }
    nhUnion(ctx, p, PINK_L, { line: 2.2 });
    nh(ctx, circP(0, 0, r * 0.28), RED3, { line: 1.6, reg: 0.4 });
    ctx.fillStyle = YEL2;
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * TAU + 0.6;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 1.8, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function fgLayer3(cg) {
    return strip("s12-fg", P_FG6, (ctx, x0, x1) => {
      const R = rng("s12-fg");
      for (const bx of [1240, -900, 2300, 3300]) {
        const x = bx + cg * P_FG6;
        if (x < x0 - 300 || x > x1 + 300) continue;
        const pts = [[x + 120, -20], [x + 40, 70], [x - 40, 130], [x - 140, 170]];
        ctx.strokeStyle = INK8;
        ctx.lineWidth = 15;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        ctx.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]);
        ctx.stroke();
        ctx.strokeStyle = WOOD2;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.moveTo(...pts[0]);
        ctx.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]);
        ctx.stroke();
        const twigs = [[x + 30, 80, x - 10, 200], [x - 60, 140, x - 70, 230], [x + 70, 30, x + 110, 120]];
        for (const [ax, ay, bx2, by] of twigs) {
          ctx.strokeStyle = INK8;
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx2, by);
          ctx.stroke();
          ctx.strokeStyle = WOOD2;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx2, by);
          ctx.stroke();
        }
        for (let k = 0; k < 13; k++) {
          const t = R();
          const tw = twigs[k % 3];
          const px = k < 6 ? lerp(x + 100, x - 130, t) : lerp(tw[0], tw[2], t), py = k < 6 ? lerp(-10, 165, t) + (R() - 0.5) * 30 : lerp(tw[1], tw[3], t);
          blossom2(ctx, px + (R() - 0.5) * 20, py, 13 + R() * 8, R() * TAU);
        }
        for (let k = 0; k < 6; k++) nh(ctx, ellP(x - 100 + R() * 220, 20 + R() * 180, 10, 5, R() * TAU), GRN2, { line: 2 });
      }
      inkTexture(ctx, x0, 0, x1 - x0, 260, 0.4);
    }, { y0: 0, y1: 260 });
  }
  function innImage(part) {
    const B2 = INN_BOX;
    return baked(`s12-inn-${part}`, (B2.x1 - B2.x0) * K, (B2.y1 - B2.y0) * K, (ctx) => {
      ctx.scale(K, K);
      ctx.translate(-B2.x0, -B2.y0);
      if (part === "back") innBack(ctx);
      else innFront(ctx);
      inkTexture(ctx, B2.x0, B2.y0, B2.x1 - B2.x0, B2.y1 - B2.y0, 0.5);
    });
  }
  function innBack(ctx) {
    nh(ctx, rectP2(470, 548, 1090, 240), "#f9e7b8", { line: LW2, reg: 0 });
    nh(ctx, rectP2(470, 760, 1090, 28), "#e7cf9f", { line: 2.4, reg: 0 });
    for (let k = 0; k < 3; k++) {
      const x = 628 + k * 50;
      nh(ctx, rectP2(x, 592, 48, 168), PAPER8, { line: 2.6 });
      nh(ctx, rectP2(x + 5, 598, 38, 156), WHITE, { line: 1.6, reg: 0 });
    }
    for (const [x, y, r] of [[662, 650, 18], [716, 628, 22], [742, 690, 16], [690, 706, 14]]) {
      for (const [dx, dy, a] of [[-16, 10, -0.6], [16, 12, 0.6], [0, 18, 1.5]]) nh(ctx, ellP(x + dx, y + dy, r * 0.7, r * 0.3, a), GRN2, { line: 1.8, reg: 0.5 });
      tuanhua(ctx, x, y, r, { n: 7, petal: PINK, inner: RED3, leaf: PINK_L, core: YEL2, lw: 1.6, reg: 0.5 });
    }
    strokeLine(ctx, [[700, 760], [700, 720], [690, 690]], 2.4, GRN2);
    for (const x of [870, 1070]) {
      nh(ctx, rectP2(x, 578, 70, 104), IND_L, { line: 2.4 });
      nh(ctx, rectP2(x + 8, 590, 54, 78), PAPER8, { line: 1.6, reg: 0 });
      nh(ctx, polyP([[x + 10, 660], [x + 26, 618], [x + 40, 660]]), "#7cc3a4", { line: 1.6 });
      nh(ctx, polyP([[x + 28, 664], [x + 44, 630], [x + 60, 664]]), "#6f95d0", { line: 1.6 });
      nh(ctx, circP(x + 48, 606, 6), RED3, { line: 1.4 });
      nh(ctx, rectP2(x - 4, 574, 78, 6), WOOD2, { line: 1.6 });
    }
    nh(ctx, rectP2(1212, 566, 184, 124), "#e9c98c", { line: 2.6, reg: 0 });
    for (const y of [612, 662]) nh(ctx, rectP2(1212, y, 184, 8), WOOD2, { line: 2.2 });
    for (let k = 0; k < 4; k++) jar(ctx, 1236 + k * 44, 612, 36, k % 2 ? "#c2773a" : "#a95f2a");
    for (let k = 0; k < 4; k++) jar(ctx, 1236 + k * 44, 662, 36, k % 2 ? "#a95f2a" : "#c2773a");
  }
  function table(ctx, cx) {
    nh(ctx, rectP2(cx - 66, 708, 132, 12), RED_D3, { line: 2.6 });
    nh(ctx, rectP2(cx - 58, 720, 116, 14), RED3, { line: 2.4 });
    for (const lx of [cx - 56, cx + 47]) nh(ctx, rectP2(lx, 734, 9, 52), RED_D3, { line: 2.2 });
    nh(ctx, pathOf2((p) => {
      p.moveTo(cx - 48, 698);
      p.quadraticCurveTo(cx - 34, 716, cx - 20, 698);
      p.closePath();
    }), WHITE, { line: 2 });
    strokeLine(ctx, [[cx - 47, 701], [cx - 21, 701]], 2.4, IND);
    nh(ctx, rectP2(cx - 6, 698, 10, 10), WHITE, { line: 1.8 });
    nh(ctx, ellP(cx + 34, 696, 16, 12), IND_L, { line: 2 });
    strokeLine(ctx, [[cx + 18, 694], [cx + 8, 686]], 2.6);
    nh(ctx, ellP(cx + 34, 683, 6, 3), IND, { line: 1.6 });
  }
  function innFront(ctx) {
    nh(ctx, rectP2(440, 786, 1140, 14), STONE_D2, { line: 2.6 });
    nh(ctx, rectP2(612, 782, 178, 10), STONE2, { line: 2.2 });
    nh(ctx, rectP2(470, 700, 126, 86), PAPER22, { line: 2.6, reg: 0 });
    nh(ctx, rectP2(480, 712, 106, 62), YEL_L2, { line: 2 });
    tuanhua(ctx, 533, 743, 22, { lw: 1.6 });
    const win = rectP2(470, 566, 126, 134);
    nh(ctx, win, PAPER8, { line: 0, reg: 0 });
    ctx.save();
    ctx.clip(win);
    ctx.strokeStyle = RED_D3;
    ctx.lineWidth = 2.6;
    for (let k = -140; k < 160; k += 18) {
      ctx.beginPath();
      ctx.moveTo(470 + k, 566);
      ctx.lineTo(600 + k, 700);
      ctx.moveTo(600 + k, 566);
      ctx.lineTo(470 + k, 700);
      ctx.stroke();
    }
    ctx.restore();
    nh(ctx, win, null, { line: 7, ink: RED3 });
    nh(ctx, win, null, { line: 2 });
    nh(ctx, rectP2(1406, 556, 152, 230), WALL2, { line: 2.6, reg: 0 });
    const moon = circP(1482, 652, 52);
    nh(ctx, moon, PAPER22, { line: 0, reg: 0 });
    ctx.save();
    ctx.clip(moon);
    ctx.strokeStyle = GRN2;
    ctx.lineWidth = 2.6;
    for (let k = -60; k <= 60; k += 15) {
      ctx.beginPath();
      ctx.moveTo(1482 + k, 596);
      ctx.lineTo(1482 + k, 710);
      ctx.moveTo(1424, 652 + k);
      ctx.lineTo(1540, 652 + k);
      ctx.stroke();
    }
    ctx.restore();
    nh(ctx, moon, null, { line: 10, ink: GRN2 });
    nh(ctx, moon, null, { line: 2.2 });
    nh(ctx, circP(1482, 652, 57), null, { line: 2.2 });
    table(ctx, 910);
    table(ctx, 1105);
    nh(ctx, rectP2(1218, 696, 174, 90), RED3, { line: LW2 });
    nh(ctx, rectP2(1226, 702, 158, 18), YEL2, { line: 2 });
    huiwen(ctx, 1230, 704, 150, 13, RED3, 2.2);
    tuanhua(ctx, 1305, 752, 24, { lw: 1.8 });
    nh(ctx, rectP2(1208, 684, 194, 14), WOOD2, { line: 2.6 });
    nh(ctx, rectP2(1330, 662, 58, 22), RED_D3, { line: 2.4 });
    ctx.strokeStyle = INK8;
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(1336 + k * 9.5, 664);
      ctx.lineTo(1336 + k * 9.5, 682);
      ctx.stroke();
    }
    for (let k = 0; k < 6; k++) for (const y of [668, 677]) {
      ctx.fillStyle = k % 2 ? YEL2 : YEL_L2;
      ctx.beginPath();
      ctx.ellipse(1336 + k * 9.5, y, 4, 2.6, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
    for (const [a, b] of [[811, 989], [1011, 1189]]) {
      nh(ctx, rectP2(a, 750, b - a, 28), YEL_L2, { line: 2.2 });
      huiwen(ctx, a + 4, 754, b - a - 8, 18, RED3, 2.6);
      nh(ctx, rectP2(a - 4, 742, b - a + 8, 9), RED3, { line: 2.4 });
      nh(ctx, rectP2(a - 4, 777, b - a + 8, 9), RED3, { line: 2.4 });
    }
    for (const d of [-1, 1]) {
      const xo = DOOR_X + d * 87, xi = DOOR_X + d * 61;
      nh(ctx, polyP([[xo, 566], [xi, 574], [xi, 770], [xo, 780]]), RED3, { line: 2.6 });
      ctx.fillStyle = YEL2;
      for (let r = 0; r < 7; r++) for (let c = 0; c < 2; c++) {
        const t = (c + 0.6) / 2.4;
        ctx.beginPath();
        ctx.arc(lerp(xo, xi, t), 596 + r * 26 + t * 4, 2.6, 0, TAU);
        ctx.fill();
      }
    }
    for (const px of PILLARS) {
      nh(ctx, rectP2(px - 11, 556, 22, 230), RED3, { line: 2.8 });
      nh(ctx, rectP2(px - 17, 772, 34, 14), STONE_D2, { line: 2.2 });
      nh(ctx, rectP2(px - 15, 552, 30, 10), GRN2, { line: 2.2 });
    }
    for (const px of [602, 800]) {
      nh(ctx, rectP2(px - 16, 590, 32, 162), RED3, { line: 2.6 });
      nh(ctx, rectP2(px - 11, 595, 22, 152), null, { line: 2, ink: YEL2 });
      nh(ctx, circP(px, 600, 3), YEL2, { line: 0 });
    }
    ctx.lineCap = "round";
    for (const [w, c] of [[14, INK8], [9, RED3]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(612, 564);
      ctx.quadraticCurveTo(656, 600, DOOR_X, 578);
      ctx.quadraticCurveTo(746, 600, 790, 564);
      ctx.stroke();
    }
    tuanhua(ctx, DOOR_X, 582, 20, { n: 8, petal: RED3, inner: PINK, leaf: YEL2, core: YEL2, lw: 1.8 });
    for (const x of [612, 790]) nh(ctx, polyP([[x, 564], [x - 10, 600], [x + 10, 600]]), RED3, { line: 2 });
    const eave = pathOf2((p) => {
      p.moveTo(452, 502);
      p.lineTo(1568, 502);
      p.quadraticCurveTo(1590, 520, 1612, 526);
      p.quadraticCurveTo(1586, 548, 1548, 550);
      p.lineTo(472, 550);
      p.quadraticCurveTo(434, 548, 408, 526);
      p.quadraticCurveTo(430, 520, 452, 502);
      p.closePath();
    });
    nh(ctx, eave, IND, { line: LW2 });
    ctx.save();
    ctx.clip(eave);
    ctx.strokeStyle = rgba(INK8, 0.7);
    ctx.lineWidth = 1.4;
    for (let x = 440; x < 1600; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, 502);
      ctx.lineTo(x + (x - 1010) * 0.04, 552);
      ctx.stroke();
    }
    ctx.restore();
    nh(ctx, rectP2(470, 544, 1080, 9), RED_D3, { line: 2.2 });
    ctx.fillStyle = YEL2;
    for (let x = 478; x < 1546; x += 14) {
      ctx.beginPath();
      ctx.arc(x, 548, 2.4, 0, TAU);
      ctx.fill();
    }
    nh(ctx, rectP2(486, 342, 1048, 102), PAPER22, { line: LW2, reg: 0 });
    const UP = [486, 642, 798, 954, 1110, 1266, 1422, 1534];
    for (let k = 0; k < UP.length - 1; k++) {
      const a = UP[k] + 14, b = UP[k + 1] - 14;
      const w2 = rectP2(a, 356, b - a, 76);
      nh(ctx, w2, PAPER8, { line: 0, reg: 0 });
      ctx.save();
      ctx.clip(w2);
      ctx.strokeStyle = RED_D3;
      ctx.lineWidth = 2.2;
      for (let x = a; x < b; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 356);
        ctx.lineTo(x, 432);
        ctx.stroke();
      }
      for (let y = 356; y < 432; y += 16) {
        ctx.beginPath();
        ctx.moveTo(a, y);
        ctx.lineTo(b, y);
        ctx.stroke();
      }
      ctx.restore();
      nh(ctx, w2, null, { line: 6, ink: RED3 });
      nh(ctx, w2, null, { line: 2 });
    }
    for (const px of UP) nh(ctx, rectP2(px - 8, 342, 16, 102), RED3, { line: 2.4 });
    nh(ctx, rectP2(472, 452, 1076, 44), YEL_L2, { line: 2.4 });
    huiwen(ctx, 478, 458, 1064, 32, RED3, 3.6);
    nh(ctx, rectP2(466, 442, 1088, 12), RED3, { line: 2.6 });
    nh(ctx, rectP2(466, 494, 1088, 10), RED3, { line: 2.4 });
    for (const px of [472, 650, 830, 1010, 1190, 1370, 1548]) {
      nh(ctx, rectP2(px - 7, 436, 14, 68), RED_D3, { line: 2.2 });
      nh(ctx, circP(px, 432, 7), YEL2, { line: 2 });
    }
    nh(ctx, rectP2(DOOR_X - 118, 348, 236, 82), YEL2, { line: LW2 });
    nh(ctx, rectP2(DOOR_X - 106, 358, 212, 62), IND, { line: 2.4 });
    tuanhua(ctx, DOOR_X, 389, 24, { petal: YEL2, inner: RED3, leaf: YEL_L2, core: RED3, lw: 1.8 });
    for (const d of [-1, 1]) {
      xiangyun(ctx, DOOR_X + d * 66, 392, 0.3, YEL_L2, { flip: -d, lw: 1.8 });
    }
    eaveRoof(ctx, 440, 1580, 236, 340, { flare: 44, inset: 0.15, lw: 3.6 });
    nh(ctx, polyP([[1010, 184], [996, 214], [1024, 214]]), RED3, { line: 2.4 });
    nh(ctx, circP(1010, 212, 12), YEL2, { line: 2.4 });
  }
  function lantern(ctx, x, y, r, swing2) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(swing2);
    strokeLine(ctx, [[0, 0], [0, 10]], 2.2);
    const h = r * 1.15;
    nh(ctx, ellP(0, 14 + h, r, h), RED3, { line: 2.8 });
    ctx.strokeStyle = INK8;
    ctx.lineWidth = 1.6;
    for (const k of [0.32, 0.68]) {
      ctx.beginPath();
      ctx.ellipse(0, 14 + h, r * k, h, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(YEL_L2, 0.8);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(-r * 0.2, 14 + h, r * 0.6, 3.5, 4.4);
    ctx.stroke();
    nh(ctx, rectP2(-r * 0.5, 8, r, 8), YEL2, { line: 2 });
    nh(ctx, rectP2(-r * 0.5, 12 + 2 * h, r, 8), YEL2, { line: 2 });
    ctx.strokeStyle = YEL2;
    ctx.lineWidth = 2.4;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(k * 3, 20 + 2 * h);
      ctx.lineTo(k * 4, 20 + 2 * h + r * 0.9);
      ctx.stroke();
    }
    ctx.restore();
  }
  function wineFlag(ctx, b, px) {
    const top = 104;
    nh(ctx, rectP2(px - 5, top, 10, 800 - top), WOOD2, { line: 2.6 });
    nh(ctx, circP(px, top - 6, 9), YEL2, { line: 2.2 });
    nh(ctx, rectP2(px - 152, top + 18, 152, 8), WOOD2, { line: 2.2 });
    const xa = px - 146, xb = px - 12, ya = top + 26, yb = top + 176;
    const wav = (y, side) => Math.sin(b * Math.PI + y * 0.035 + side) * 7 * ((y - ya) / (yb - ya));
    const outline2 = (inset) => {
      const p = new Path2D();
      p.moveTo(xa + inset, ya + inset);
      p.lineTo(xb - inset, ya + inset);
      for (let y = ya + inset; y <= yb - inset; y += 10) p.lineTo(xb - inset + wav(y, 0), y);
      const n = 6;
      for (let k = 0; k <= n; k++) {
        const x = lerp(xb - inset, xa + inset, k / n);
        const w = wav(yb, 0.5) * (1 - k / n) + wav(yb, 1) * (k / n);
        if (inset === 0 && k < n) {
          const xm = lerp(xb, xa, (k + 0.5) / n);
          p.lineTo(x + w, yb);
          p.lineTo(xm + w, yb + 22);
        } else p.lineTo(x + w, yb - inset);
      }
      for (let y = yb - inset; y >= ya + inset; y -= 10) p.lineTo(xa + inset + wav(y, 1), y);
      p.closePath();
      return p;
    };
    nh(ctx, outline2(0), RED3, { line: LW2 });
    nh(ctx, outline2(16), PAPER22, { line: 2.2 });
    for (const [dx, ph] of [[0, 0], [12, 1.3]]) {
      const sx = px - 14 + dx;
      const p = new Path2D();
      p.moveTo(sx, top + 26);
      for (let k = 1; k <= 8; k++) {
        const y = top + 26 + k * 24;
        p.lineTo(sx + 8 + Math.sin(b * Math.PI + k * 0.6 + ph) * 6 * (k / 8), y);
      }
      ctx.lineCap = "round";
      ctx.strokeStyle = INK8;
      ctx.lineWidth = 9;
      ctx.stroke(p);
      ctx.strokeStyle = dx ? GRN2 : YEL2;
      ctx.lineWidth = 5;
      ctx.stroke(p);
    }
  }
  function doll(ctx, x, y, o) {
    const s = o.s || 1, lw = LW2 / s * (o.lwk || 1), thin = lw * 0.6;
    const bow = o.bow || 0;
    const hip = [Math.max(0, bow) * 16, -150];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    if (o.legs !== "none") {
      const ph = o.legs === "run" ? o.step || 0 : null;
      const leg = (hx2, fx, lift, near) => {
        const knee = [lerp(hx2, fx, 0.5) - (lift ? 10 : 0), -78 - lift * 0.6];
        nh(ctx, tubeP([[hx2, -150], knee, [fx, -14 - lift]], [20, 16, 13]), o.pants || "#2b2522", { line: lw });
        if (o.legs !== "none" && o.wraps !== false) {
          nh(ctx, tubeP([knee.map((v, i) => i ? v + 18 : v), [fx, -18 - lift]], [14, 13]), WHITE, { line: lw * 0.8 });
          ctx.strokeStyle = INK8;
          ctx.lineWidth = thin;
          for (let k = 1; k < 4; k++) {
            const t = k / 4;
            const yy = lerp(knee[1] + 18, -18 - lift, t), xx = lerp(knee[0], fx, t);
            ctx.beginPath();
            ctx.moveTo(xx - 12, yy - 4);
            ctx.lineTo(xx + 12, yy + 3);
            ctx.stroke();
          }
        }
        nh(ctx, ellP(fx - 9, -7 - lift, 23, 9.5), INK8, { line: lw * 0.6, reg: 0 });
        strokeLine(ctx, [[fx - 30, -2 - lift], [fx + 12, -2 - lift]], thin, WHITE);
      };
      if (ph === null) {
        leg(14, 18, 0, false);
        leg(-10, -22, 0, true);
      } else {
        const a = Math.sin(ph * TAU);
        leg(14, 18 - a * 26, Math.max(0, -Math.cos(ph * TAU)) * 18, false);
        leg(-10, -22 + a * 26, Math.max(0, Math.cos(ph * TAU)) * 18, true);
      }
    }
    ctx.translate(hip[0], hip[1]);
    ctx.rotate(-bow);
    const SN = [-30, -122], SF = [22, -124];
    const armPose = {
      side: { near: [[-42, -74], [-44, -34]], far: [[30, -72], [32, -34]] },
      fist: { near: [[-60, -100], [-66, -86]], far: [[-14, -88], [-54, -84]] },
      open: { near: [[-66, -118], [-96, -146]], far: [[46, -128], [72, -156]] },
      hold: { near: [[-80, -92], [-120, -112]], far: [[-14, -96], [-48, -118]] },
      table: { near: [[-46, -72], [-68, -60]], far: [[10, -76], [-40, -62]] }
    };
    let AP = armPose[o.arms] || armPose.side;
    if (o.arms === "run") {
      const a = Math.sin((o.step || 0) * TAU);
      AP = { near: [[-40 + a * 14, -76], [-46 + a * 30, -40]], far: [[30 - a * 14, -76], [34 - a * 30, -40]] };
    }
    const sleeve = (S, E, H2) => {
      nh(ctx, tubeP([S, E, H2], [17, 15, 13]), o.coat, { line: lw });
      const d = [H2[0] - E[0], H2[1] - E[1]], L = Math.hypot(d[0], d[1]) || 1;
      nh(ctx, ellP(H2[0] - d[0] / L * 6, H2[1] - d[1] / L * 6, 13, 9, Math.atan2(d[1], d[0]) + Math.PI / 2), o.trim, { line: lw * 0.7 });
    };
    const hand = (H2) => nh(ctx, circP(H2[0], H2[1], 11), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
    sleeve(SF, AP.far[0], AP.far[1]);
    if (o.arms !== "fist" && o.arms !== "hold") hand(AP.far[1]);
    if (o.towel !== void 0) {
      ctx.save();
      ctx.translate(16, -138);
      ctx.rotate(o.towel);
      const t = polyP([[-8, -6], [16, -4], [40, 76], [18, 82]]);
      nh(ctx, t, WHITE, { line: lw });
      strokeLine(ctx, [[23, 62], [41, 58]], thin * 1.6, IND);
      strokeLine(ctx, [[21, 70], [39, 66]], thin * 1.6, IND);
      ctx.restore();
    }
    const coat = new Path2D();
    coat.moveTo(-52, 22);
    coat.quadraticCurveTo(-62, -40, -48, -96);
    coat.quadraticCurveTo(-40, -128, -16, -140);
    coat.lineTo(14, -142);
    coat.quadraticCurveTo(40, -132, 44, -98);
    coat.quadraticCurveTo(50, -40, 48, 22);
    coat.closePath();
    nh(ctx, coat, o.coat, { line: lw });
    ctx.save();
    ctx.clip(coat);
    ctx.strokeStyle = o.trim;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-12, -144);
    ctx.quadraticCurveTo(-34, -80, -30, 26);
    ctx.stroke();
    ctx.fillStyle = o.trim;
    ctx.fillRect(-60, 14, 120, 10);
    if (o.sash) {
      ctx.fillStyle = o.sash;
      ctx.fillRect(-60, -10, 120, 18);
    }
    ctx.restore();
    ctx.strokeStyle = INK8;
    ctx.lineWidth = thin;
    ctx.beginPath();
    ctx.moveTo(-6, -144);
    ctx.quadraticCurveTo(-28, -80, -24, 24);
    ctx.stroke();
    if (o.sash) {
      ctx.beginPath();
      ctx.moveTo(-58, -10);
      ctx.lineTo(50, -10);
      ctx.moveTo(-58, 8);
      ctx.lineTo(50, 8);
      ctx.stroke();
      nh(ctx, polyP([[-34, 6], [-46, 44], [-30, 40], [-24, 6]]), o.sash, { line: thin * 1.2 });
    }
    nh(ctx, coat, null, { line: lw });
    nh(ctx, polyP([[-16, -141], [-4, -126], [8, -142]]), WHITE, { line: thin * 1.2 });
    const HC = [-8, -190];
    nh(ctx, ellP(22, -188, 8, 11), o.face || SKIN, { line: thin * 1.2, reg: 0.5 });
    nh(ctx, ellP(HC[0], HC[1], 47, 45), o.face || SKIN, { line: lw, reg: 0.5 });
    if (o.hat === "cap") {
      const cap = pathOf2((p) => {
        p.moveTo(-54, -198);
        p.quadraticCurveTo(-52, -250, -6, -250);
        p.quadraticCurveTo(40, -250, 42, -196);
        p.quadraticCurveTo(-6, -212, -54, -198);
        p.closePath();
      });
      nh(ctx, cap, "#2b2522", { line: lw, reg: 0 });
      strokeLine(ctx, [[-52, -201], [-6, -214], [40, -199]], thin * 1.4, RED3);
      strokeLine(ctx, [[-6, -248], [-6, -213]], thin, "#5b4a40");
      strokeLine(ctx, [[-30, -244], [-26, -210]], thin, "#5b4a40");
      nh(ctx, circP(-6, -254, 8), RED3, { line: thin * 1.3 });
    } else if (o.hat === "kerchief") {
      const k = pathOf2((p) => {
        p.moveTo(-56, -194);
        p.quadraticCurveTo(-54, -248, -4, -246);
        p.quadraticCurveTo(44, -244, 44, -190);
        p.quadraticCurveTo(-6, -214, -56, -194);
        p.closePath();
      });
      nh(ctx, k, INK8, { line: lw, reg: 0 });
      nh(ctx, polyP([[40, -206], [70, -190], [62, -170], [40, -192]]), INK8, { line: thin, reg: 0 });
    } else if (o.hat === "scholar") {
      nh(ctx, polyP([[-50, -200], [-46, -262], [36, -262], [40, -198], [-6, -212]]), IND, { line: lw });
      strokeLine(ctx, [[-48, -232], [38, -232]], thin, IND_L);
      for (const dy of [0, 16]) nh(ctx, polyP([[38, -230 + dy], [70, -214 + dy], [64, -204 + dy], [38, -216 + dy]]), IND, { line: thin });
    } else if (o.hat === "round") {
      nh(ctx, pathOf2((p) => {
        p.moveTo(-52, -204);
        p.quadraticCurveTo(-48, -252, -6, -252);
        p.quadraticCurveTo(36, -252, 40, -202);
        p.closePath();
      }), RED_D3, { line: lw });
      nh(ctx, rectP2(-54, -210, 96, 12), INK8, { line: thin, reg: 0 });
      nh(ctx, circP(-6, -256, 7), YEL2, { line: thin });
    }
    nh(ctx, polyP([[10, -206], [24, -204], [20, -182], [12, -186]]), INK8, { line: 0, reg: 0 });
    ctx.fillStyle = rgba(PINK, 0.85);
    ctx.beginPath();
    ctx.ellipse(-42, -174, 10, 8, 0, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(4, -176, 10, 8, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = INK8;
    ctx.lineWidth = thin * 1.25;
    for (const ex of [-36, -8]) {
      ctx.beginPath();
      ctx.arc(ex, -190, 7, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex, -206, 9, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(-52, -190);
    ctx.quadraticCurveTo(-60, -180, -50, -176);
    ctx.stroke();
    if (o.beard === "full") {
      nh(ctx, pathOf2((p) => {
        p.moveTo(-56, -178);
        p.quadraticCurveTo(-50, -132, -18, -128);
        p.quadraticCurveTo(14, -134, 18, -170);
        p.quadraticCurveTo(-10, -150, -56, -178);
        p.closePath();
      }), INK8, { line: 0, reg: 0 });
    }
    if (o.beard === "mustache") {
      for (const d of [-1, 1]) nh(ctx, pathOf2((p) => {
        p.moveTo(-36, -172);
        p.quadraticCurveTo(-36 + d * 14, -170, -36 + d * 22, -150);
        p.quadraticCurveTo(-36 + d * 10, -164, -36, -168);
        p.closePath();
      }), INK8, { line: 0, reg: 0 });
    }
    const mouth = pathOf2((p) => {
      p.moveTo(-40, -166);
      p.quadraticCurveTo(-30, -150, -18, -166);
      p.closePath();
    });
    nh(ctx, mouth, RED3, { line: thin * 1.2, reg: 0.4 });
    if (o.jar) jar(ctx, -84, -78, 86);
    sleeve(SN, AP.near[0], AP.near[1]);
    if (o.arms === "fist") {
      nh(ctx, circP(-66, -88, 12.5), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
      nh(ctx, ellP(-58, -84, 12, 15, 0.3), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
      ctx.strokeStyle = INK8;
      ctx.lineWidth = thin;
      for (const dy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.moveTo(-70, -88 + dy);
        ctx.lineTo(-62, -88 + dy);
        ctx.stroke();
      }
    } else hand(AP.near[1]);
    if (o.arms === "hold") hand(AP.far[1]);
    if (o.towel !== void 0) nh(ctx, polyP([[-6, -146], [16, -146], [8, -104], [-12, -108]]), WHITE, { line: lw * 0.9 });
    ctx.restore();
    const hx = o.arms === "fist" ? -62 : AP.near[1][0], hy = o.arms === "fist" ? -86 : AP.near[1][1];
    const c = Math.cos(-bow), sn = Math.sin(-bow);
    return [x + (hip[0] + hx * c - hy * sn) * s, y + (hip[1] + hx * sn + hy * c) * s];
  }
  function bowAt(b) {
    if (b < T_SALUTE) return -0.18 * smoothstep(GAG - 0.5, GAG - 0.1, b);
    const k = Math.floor(b), u = b - k;
    const deep = 0.66, rest = 0.2;
    if (k === T_SALUTE) {
      if (u < 0.08) return lerp(-0.18, 0.62, ease.out(u / 0.08));
      if (u < 0.86) return lerp(0.62, rest, ease.inOut((u - 0.08) / 0.78));
      return lerp(rest, deep, ease.in((u - 0.86) / 0.14));
    }
    if (u < 0.72) return lerp(deep, rest, ease.inOut(u / 0.72));
    if (u < 0.86) return rest;
    return lerp(rest, deep, ease.in((u - 0.86) / 0.14));
  }
  function waiterState(b) {
    const base = { s: 0.98, coat: GRN2, trim: YEL2, sash: RED3, pants: "#2b2522", hat: "cap", towel: 0 };
    if (b < T_POP[0]) return null;
    if (b < T_POP[1]) {
      const t = (b - T_POP[0]) / (T_POP[1] - T_POP[0]);
      return { ...base, fx: DOOR_X, y: lerp(784, 800, ease.out(t)) - Math.sin(Math.PI * t) * 34, s: lerp(0.8, 0.98, ease.out(t)), arms: "open", legs: "stand", towel: -0.3 * Math.sin(Math.PI * t) };
    }
    if (b < T_TROT[1]) {
      const t = (b - T_TROT[0]) / (T_TROT[1] - T_TROT[0]);
      const step = (b - T_TROT[0]) * 2;
      return { ...base, fx: lerp(DOOR_X, W_STAND + 20, t), y: 800 - Math.abs(Math.sin(step * Math.PI)) * 12, arms: "run", legs: "run", step, bow: 0.12, towel: Math.sin(step * TAU) * 0.35 - 0.2 };
    }
    if (b < T_SALUTE) {
      const t = smoothstep(T_TROT[1], T_SALUTE, b);
      return { ...base, fx: lerp(W_STAND + 20, W_STAND, ease.out(t)), y: 800, arms: "open", legs: "stand", bow: bowAt(b), towel: 0.25 * t };
    }
    const bw = bowAt(b);
    return { ...base, fx: W_STAND, y: 800, arms: "fist", legs: "stand", bow: bw, towel: -bw * 0.5 + 0.1 };
  }
  var riseOf = (b, R) => smoothstep(R[0], R[1], b) * (1 - smoothstep(T_SIT[0], T_SIT[1], b));
  var smallBow = (b, k0) => {
    if (b < k0) return 0;
    const u = b - Math.floor(b);
    return u < 0.7 ? 0.28 * (1 - ease.inOut(u / 0.7)) : 0.28 * ease.in((u - 0.7) / 0.3);
  };
  function salutePop(ctx, b, hx, hy) {
    const u = b - T_SALUTE;
    if (u < 0 || u > 0.8) return;
    const grow = ease.out(clamp(u / 0.22)), fade2 = 1 - smoothstep(0.35, 0.8, u);
    ctx.save();
    ctx.globalAlpha = fade2;
    const n = 12, r0 = 16 + 6 * grow, r1 = 30 + 40 * grow;
    const star2 = new Path2D();
    for (let k = 0; k < n * 2; k++) {
      const a = k * Math.PI / n + 0.2, r = k % 2 ? r0 : r1;
      k ? star2.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r) : star2.moveTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
    }
    star2.closePath();
    nh(ctx, star2, YEL2, { line: 3 });
    nh(ctx, circP(hx, hy, r0 * 0.9), WHITE, { line: 0, reg: 0 });
    ctx.strokeStyle = INK8;
    ctx.lineCap = "round";
    for (let k = 0; k < 10; k++) {
      const a = k / 10 * TAU + 0.5, d0 = r1 + 6 + u * 70, d1 = d0 + 30 * (1 - u);
      ctx.lineWidth = 5 - k % 2 * 2;
      ctx.beginPath();
      ctx.moveTo(hx + Math.cos(a) * d0, hy + Math.sin(a) * d0);
      ctx.lineTo(hx + Math.cos(a) * d1, hy + Math.sin(a) * d1);
      ctx.stroke();
    }
    const cs = 0.22 + 0.16 * grow;
    xiangyun(ctx, hx - 70 - 40 * grow, hy - 60 - 30 * grow, cs, PINK_L, { flip: -1, lw: 2.6 });
    xiangyun(ctx, hx + 10 + 30 * grow, hy - 96 - 34 * grow, cs, IND_L, { lw: 2.6 });
    ctx.restore();
  }
  function bowArcs(ctx, b, wx) {
    if (b < T_SALUTE + 1) return;
    const u = b - Math.floor(b);
    if (u > 0.4) return;
    ctx.save();
    ctx.globalAlpha = 1 - u / 0.4;
    ctx.strokeStyle = INK8;
    ctx.lineWidth = 3.4;
    ctx.lineCap = "round";
    for (const r of [70, 92]) {
      ctx.beginPath();
      ctx.arc(wx + 6, 800 - 150, r + u * 30, -2, -1.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  function heroGlow(ctx, b) {
    const u = b - T_SALUTE;
    if (u < 0 || u > 1.2) return;
    const k = ease.out(clamp(u / 0.25)) * (1 - smoothstep(0.6, 1.2, u));
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    const cx = CHAR_X + 6, cy = ROAD_Y - 330;
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU, da = 0.1;
      const r0 = 170, r1 = 230 + 80 * k + i % 2 * 36;
      ctx.fillStyle = i % 2 ? YEL_L2 : YEL2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - da) * r0, cy + Math.sin(a - da) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a + da) * r0, cy + Math.sin(a + da) * r0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = INK8;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.restore();
  }
  function sweatDrop(ctx, b, fig) {
    const k = smoothstep(T_SWEAT2[0], T_SWEAT2[0] + 0.15, b) * (1 - smoothstep(T_SWEAT2[1] - 0.2, T_SWEAT2[1], b));
    if (k <= 0 || fig.pose !== "stand") return;
    const a = ANCHORS.stand.ear;
    const slide = smoothstep(T_SWEAT2[0], T_SWEAT2[1], b) * 18;
    const x = fig.x + (a[0] + 24) * fig.scale, y = fig.y + (a[1] + 8) * fig.scale + slide;
    ctx.save();
    ctx.globalAlpha = k;
    const p = pathOf2((q) => {
      q.moveTo(x, y - 26);
      q.quadraticCurveTo(x + 16, y - 2, x + 12, y + 8);
      q.arc(x, y + 6, 12, 0.2, Math.PI - 0.2);
      q.quadraticCurveTo(x - 16, y - 2, x, y - 26);
      q.closePath();
    });
    nh(ctx, p, IND_L, { line: 3 });
    ctx.fillStyle = WHITE;
    ctx.beginPath();
    ctx.ellipse(x - 4, y + 2, 3, 5, 0.3, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  registerStyle("s12-nianhua", (I) => {
    const O = comicBase(I, { levels: 6, keep: 0.2, lw: 4.6, inner: 0.36, ink: INK8 });
    const pal = [INK8, "#203d7e", "#5b82c6", "#e8ab82", "#f8d6b0", PAPER8].map(rgbf);
    const n = O.w * O.h, cls = new Int8Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i);
      const skin = O.r[i] - O.b[i] > 0.07 && l > 0.22;
      cls[i] = l < 0.075 ? 0 : skin ? l < 0.5 ? 3 : 4 : l < 0.24 ? 1 : l < 0.5 ? 2 : 5;
    }
    const DX = 2, DY = 2, paperC = rgbf(PAPER8);
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (cls[i] < 0) continue;
      let c;
      if (cls[i] === 0) c = pal[0];
      else {
        const j = Math.max(0, y - DY) * O.w + Math.max(0, x - DX);
        c = cls[j] > 0 ? pal[cls[j]] : cls[j] === 0 ? pal[cls[i]] : paperC;
      }
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
    }
    return O;
  });
  function cardBg(ctx, x, y, w, h) {
    ctx.save();
    const band = 18;
    nh(ctx, rectP2(x, y, w, h), RED3, { line: 3.4 });
    huiwen(ctx, x + 3, y + 3, w - 6, band - 6, YEL2, 2.2);
    huiwen(ctx, x + 3, y + h - band + 3, w - 6, band - 6, YEL2, 2.2);
    for (const sx of [x + 3, x + w - band + 3]) {
      ctx.save();
      ctx.translate(sx + band - 6, y + band);
      ctx.rotate(Math.PI / 2);
      huiwen(ctx, 0, 0, h - 2 * band, band - 6, YEL2, 2.2);
      ctx.restore();
    }
    nh(ctx, rectP2(x + band, y + band, w - 2 * band, h - 2 * band), PAPER8, { line: 3, reg: 0.8 });
    ctx.strokeStyle = rgba(GRN2, 0.9);
    ctx.lineWidth = 2.4;
    ctx.strokeRect(x + band + 6, y + band + 6, w - 2 * band - 12, h - 2 * band - 12);
    for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) tuanhua(ctx, cx, cy, 22, { lw: 1.8 });
    ctx.restore();
  }
  function nianhuaCD(ctx, kind, cx, cy, s, spin) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    nh(ctx, circP(0, 0, r), YEL_L2, { line: 3.4 * s });
    ctx.rotate(spin);
    const ring = pathOf2((p) => {
      p.arc(0, 0, r * 0.9, 0, TAU);
      p.moveTo(r * 0.66, 0);
      p.arc(0, 0, r * 0.66, 0, TAU, true);
    });
    nh(ctx, ring, RED3, { line: 2.4 * s });
    ctx.fillStyle = YEL2;
    for (let k = 0; k < 18; k++) {
      const a = k / 18 * TAU;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.78 + REG2[0], Math.sin(a) * r * 0.78 + REG2[1], 3.2 * s, 0, TAU);
      ctx.fill();
    }
    nh(ctx, ellP(r * 0.78, 0, 9 * s, 6 * s), GRN2, { line: 2 * s, reg: 0 });
    tuanhua(ctx, 0, 0, r * 0.6, { lw: 1.8 * s });
    nh(ctx, circP(0, 0, r * 0.12), YEL2, { line: 2 * s, reg: 0 });
    nh(ctx, circP(0, 0, r * 0.05), INK8, { line: 0, reg: 0 });
    ctx.restore();
  }
  function plate(ctx, x, y, w, h) {
    nh(ctx, rectP2(x, y, w, h), RED3, { line: 3.4 });
    nh(ctx, rectP2(x + 7, y + 7, w - 14, h - 14), YEL_L2, { line: 2.2, reg: 0.8 });
    for (const sx of [x, x + w]) nh(ctx, circP(sx, y + h / 2, 9), YEL2, { line: 2.2 });
  }
  function nianhuaFrame(ctx, R) {
    const t = 64 * R.s, { x, y, w, h } = R, lw = Math.max(1, 3 * R.s);
    ctx.save();
    ctx.fillStyle = "rgba(40,20,10,0.16)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU);
    ctx.fill();
    const ringP = (o, i) => pathOf2((p) => {
      p.rect(x - o, y - o, w + 2 * o, h + 2 * o);
      p.rect(x - i, y - i, w + 2 * i, h + 2 * i);
    });
    ctx.save();
    ctx.translate(2 * R.s, 1.5 * R.s);
    ctx.fillStyle = RED3;
    ctx.fill(ringP(t, t * 0.3), "evenodd");
    ctx.fillStyle = GRN2;
    ctx.fill(ringP(t * 0.3, 0), "evenodd");
    ctx.restore();
    const bh = t * 0.42, bo = t * 0.86;
    huiwen(ctx, x - bo, y - bo, w + 2 * bo, bh, YEL2, Math.max(1, 2.8 * R.s));
    huiwen(ctx, x - bo, y + h + bo - bh, w + 2 * bo, bh, YEL2, Math.max(1, 2.8 * R.s));
    for (const [sx, dir] of [[x - bo, 1], [x + w + bo, -1]]) {
      ctx.save();
      ctx.translate(sx, dir > 0 ? y + h + bo : y - bo);
      ctx.rotate(-dir * Math.PI / 2);
      huiwen(ctx, 0, 0, h + 2 * bo, bh, YEL2, Math.max(1, 2.8 * R.s));
      ctx.restore();
    }
    ctx.fillStyle = PINK_L;
    const step = Math.max(10, 40 * R.s), m = t * 0.15;
    for (let px = x; px < x + w; px += step) {
      ctx.beginPath();
      ctx.arc(px, y - m, Math.max(1, 3.5 * R.s), 0, TAU);
      ctx.arc(px, y + h + m, Math.max(1, 3.5 * R.s), 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = INK8;
    ctx.lineWidth = lw;
    ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
    ctx.strokeRect(x - t * 0.3, y - t * 0.3, w + t * 0.6, h + t * 0.6);
    ctx.lineWidth = lw * 1.4;
    ctx.strokeRect(x, y, w, h);
    for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) tuanhua(ctx, cx, cy, t * 0.7, { lw: Math.max(1, 2.2 * R.s) });
    for (const cy of [y - t / 2, y + h + t / 2]) xiangyun(ctx, x + w / 2, cy, t / 70, WHITE, { lw: Math.max(1, 2.4 * R.s) });
    ctx.restore();
  }
  var s12 = {
    id: "s12",
    station: ST12,
    figureStyle: "s12-nianhua",
    // 年画人物外的一圈纸白留边：在红柱、靛蓝雨棚、绿树前也拉得开
    figureRim: { color: PAPER8, width: 5, alpha: 1 },
    freezeBeat: GAG + 2.1,
    // Outro 展墙：店小二深躬、食客拱手、掌柜捧酒
    drawBack(ctx, b, env) {
      const cam = env.cam, cg = env.camAt(GAG), off = cg - cam;
      ctx.drawImage(paper(), X_MIN, 0, X_MAX - X_MIN, 1e3);
      drawStrip(ctx, skyLayer6(), cam);
      drawStrip(ctx, mountainLayer(), cam);
      drawStrip(ctx, cityLayer(), cam);
      drawStrip(ctx, treeLayer(), cam);
      drawStrip(ctx, streetLayer2(cg), cam);
      drawStrip(ctx, roadLayer5(), cam);
      heroGlow(ctx, b);
      const B2 = INN_BOX;
      if (B2.x1 + off > X_MIN && B2.x0 + off < X_MAX) {
        ctx.drawImage(innImage("back"), B2.x0 + off, B2.y0, B2.x1 - B2.x0, B2.y1 - B2.y0);
        const ra = riseOf(b, T_RISE_A), rb = riseOf(b, T_RISE_B);
        doll(ctx, DINER_A + off, 742 + 150 * 0.56 - ra * 48, { s: 0.56, lwk: 0.8, coat: IND, trim: YEL2, face: "#ef9a78", hat: "kerchief", beard: "full", legs: "none", arms: ra > 0.5 ? "fist" : "table", bow: ra > 0.5 ? smallBow(b, T_RISE_A[1]) : 0 });
        doll(ctx, DINER_B + off, 742 + 150 * 0.56 - rb * 46, { s: 0.56, lwk: 0.8, coat: PINK, trim: GRN2, hat: "scholar", legs: "none", arms: rb > 0.5 ? "fist" : "table", bow: rb > 0.5 ? smallBow(b + 0.5, T_RISE_B[1] + 0.5) : 0 });
        const jk = smoothstep(T_JAR[0], T_JAR[1], b);
        const jarUp = jk > 0 ? ease.outBack(jk) : 0;
        if (jk > 0) doll(ctx, KEEPER + off, 786 - jarUp * 26, { s: 0.56, lwk: 0.8, coat: RED_D3, trim: YEL2, hat: "round", beard: "mustache", legs: "none", arms: "hold", jar: true, bow: -0.08 * jarUp });
        else doll(ctx, KEEPER + off, 786, { s: 0.56, lwk: 0.8, coat: RED_D3, trim: YEL2, hat: "round", beard: "mustache", legs: "none", arms: "table" });
        ctx.drawImage(innImage("front"), B2.x0 + off, B2.y0, B2.x1 - B2.x0, B2.y1 - B2.y0);
        if (jk > 0.6) {
          const tw = Math.abs(Math.sin((b - T_JAR[1]) * Math.PI * 2));
          for (const [dx, dy, r] of [[-84, -96, 13], [-22, -118, 9]]) {
            const sx = KEEPER + off + dx, sy = 786 - jarUp * 26 + dy - 70;
            const st = new Path2D();
            for (let k = 0; k < 8; k++) {
              const a = k * Math.PI / 4, rr = (k % 2 ? 0.35 : 1) * r * (0.6 + 0.4 * tw);
              k ? st.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr) : st.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
            }
            st.closePath();
            nh(ctx, st, YEL2, { line: 2 });
          }
        }
        HOOKS.forEach((hx, i) => lantern(ctx, hx + off, 553, 20, Math.sin(b * Math.PI + i * 0.8) * 0.07));
        for (const [hx, i] of [[424, 5], [1596, 6]]) lantern(ctx, hx + off, 316, 26, Math.sin(b * Math.PI + i) * 0.06);
      }
      if (FLAG_X2 + off > X_MIN - 20 && FLAG_X2 + off - 160 < X_MAX) wineFlag(ctx, b, FLAG_X2 + off);
      const W2 = waiterState(b);
      if (W2) {
        const wx = W2.fx + off;
        if (wx > X_MIN - 150 && wx < X_MAX + 150) {
          ctx.fillStyle = rgba("#8a6a3a", 0.25);
          ctx.beginPath();
          ctx.ellipse(wx, 801, 56 * W2.s, 9, 0, 0, TAU);
          ctx.fill();
          const turn = b > GAG + 4 && wx < CHAR_X - 70;
          ctx.save();
          if (turn) {
            ctx.translate(2 * wx, 0);
            ctx.scale(-1, 1);
          }
          const hand = doll(ctx, wx, W2.y, W2);
          bowArcs(ctx, b, wx);
          ctx.restore();
          salutePop(ctx, b, hand[0], hand[1]);
        }
      }
    },
    drawFront(ctx, b, env) {
      drawStrip(ctx, fgLayer3(env.camAt(GAG)), env.cam);
      sweatDrop(ctx, b, env.figure());
    },
    drawFrame(ctx, R) {
      nianhuaFrame(ctx, R);
    },
    cardStyle: { ink: INK8, accent: RED3, bar: false, bgDraw: (ctx, x, y, w, h) => cardBg(ctx, x, y, w, h) },
    playerStyle: {
      ink: INK8,
      noteColor: RED3,
      backdrop: false,
      plateDraw: (ctx, x, y, w, h) => plate(ctx, x, y, w, h),
      drawPlayer: (ctx, kind, cx, cy, s, spin) => nianhuaCD(ctx, kind, cx, cy, s, spin)
    }
  };

  // src/scenes/placeholder.js
  function placeholderScene(st) {
    const [bg, mid, ink, acc2] = st.palette;
    const dark = ["#1c2140", "#2a2622", "#1b2230", "#5b5852"].includes(bg);
    const far = mix(bg, mid, 0.35), near = mix(mid, ink, 0.25), road = mix(mid, ink, 0.45);
    function layer(ctx, cam, parallax, spacing, seedKey, drawOne) {
      const off = cam * parallax;
      const i0 = Math.floor((X_MIN + off) / spacing) - 1, i1 = Math.ceil((X_MAX + off) / spacing) + 1;
      for (let i = i0; i <= i1; i++) drawOne(i * spacing - off, rng(st.id, seedKey, i));
    }
    return {
      id: st.id,
      station: st,
      drawBack(ctx, b, env) {
        const cam = env.cam;
        const g = ctx.createLinearGradient(0, 0, 0, ROAD_Y);
        g.addColorStop(0, mix(bg, mid, dark ? 0.15 : 0.05));
        g.addColorStop(1, mix(bg, mid, dark ? 0.45 : 0.3));
        ctx.fillStyle = g;
        ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, ROAD_Y + 2);
        layer(ctx, cam, 0.2, 230, "far", (x, R) => {
          const h = R.range(120, 260);
          ctx.fillStyle = far;
          roundRect(ctx, x, ROAD_Y - 120 - h, R.range(120, 200), h + 130, 18);
          ctx.fill();
        });
        layer(ctx, cam, 0.55, 310, "mid", (x, R) => {
          const h = R.range(150, 300);
          ctx.fillStyle = mix(far, near, 0.55);
          poly(ctx, [[x, ROAD_Y], [x + 40, ROAD_Y - h], [x + 110, ROAD_Y - h + 30], [x + 150, ROAD_Y]]);
          ctx.fill();
        });
        ctx.save();
        font(ctx, 46, { family: SANS, weight: 700 });
        ctx.textAlign = "center";
        ctx.fillStyle = rgba(readableOn(bg, ink), 0.55);
        ctx.fillText(`\u5360\u4F4D \xB7 \u7B2C ${st.n} \u7AD9 \xB7 ${st.style}`, 690, 150);
        font(ctx, 40, { family: SERIF, weight: 400 });
        ctx.fillText(`\u573A\u666F\uFF1A${st.scene}`, 690, 205);
        ctx.restore();
        ctx.fillStyle = road;
        ctx.fillRect(X_MIN - 2, ROAD_Y, X_MAX - X_MIN + 4, 1e3 - ROAD_Y + 2);
        ctx.fillStyle = mix(road, ink, 0.35);
        ctx.fillRect(X_MIN - 2, ROAD_Y, X_MAX - X_MIN + 4, 6);
        layer(ctx, cam, 1, 120, "dash", (x) => {
          ctx.fillStyle = rgba(bg, 0.55);
          ctx.fillRect(x, ROAD_Y + 60, 60, 8);
        });
        layer(ctx, cam, 1, 520, "post", (x, R) => {
          ctx.fillStyle = near;
          ctx.fillRect(x, ROAD_Y - 260, 16, 262);
          circle(ctx, x + 8, ROAD_Y - 268, 22);
          ctx.fillStyle = acc2;
          ctx.fill();
        });
      },
      drawFront(ctx, b, env) {
        const k = smoothstep(GAG - 0.15, GAG + 0.1, b) * (1 - smoothstep(GAG + 4 - 0.2, GAG + 4, b));
        if (k <= 0.01) return;
        const pul = 1 + [0, 1, 2, 3].reduce((a, k2) => a + 0.08 * pulse(GAG + k2, GAG + k2 + 1, b), 0);
        ctx.save();
        ctx.globalAlpha = k;
        ctx.translate(CHAR_X, ROAD_Y - 190);
        ctx.scale(pul, pul);
        ctx.strokeStyle = acc2;
        ctx.lineWidth = 8;
        for (let i = 0; i < 12; i++) {
          const a = i / 12 * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 210, Math.sin(a) * 210);
          ctx.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
          ctx.stroke();
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = k;
        font(ctx, 38, { family: SANS, weight: 700 });
        const lines = wrap(ctx, `\u7B2C 3 \u5C0F\u8282\u7684\u6897\uFF1A${st.gag}`, 760);
        const x = 520, y = 470;
        roundRect(ctx, x - 24, y - 54, 808, lines.length * 52 + 40, 12);
        ctx.fillStyle = rgba(mix(bg, "#ffffff", 0.5), 0.92);
        ctx.fill();
        ctx.strokeStyle = acc2;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.fillStyle = ink;
        lines.forEach((l, i) => ctx.fillText(l, x, y + i * 52));
        ctx.restore();
      }
    };
  }
  function wrap(ctx, str, maxW) {
    const out = [];
    let line2 = "";
    for (const ch of str) {
      if (ctx.measureText(line2 + ch).width > maxW) {
        out.push(line2);
        line2 = ch;
      } else line2 += ch;
    }
    if (line2) out.push(line2);
    return out;
  }

  // src/scenes/s13.js
  var s13 = placeholderScene(stationByN(13));

  // src/scenes/s14.js
  var s14 = placeholderScene(stationByN(14));

  // src/scenes/s15.js
  var ST13 = stationByN(15);
  var PAPER9 = "#fbf5e6";
  var CREAM4 = "#f6e3a1";
  var CREAM_L = "#fbeec6";
  var SKY3 = "#8ccbe2";
  var SKY_L = "#cfe9ee";
  var SKY_D = "#3c9cc6";
  var ORANGE = "#eba36d";
  var ORANGE_D = "#cf7656";
  var RUST = "#a9524a";
  var SUN2 = "#f2b552";
  var MINT = "#9fd8bf";
  var MINT_D = "#5fae94";
  var MINT_DD = "#3f8c78";
  var CORAL = "#e2654c";
  var CORAL_D = "#b8483a";
  var YEL3 = "#f5cf5a";
  var NAVY2 = "#2c4a6c";
  var INK9 = "#2f4152";
  var LAV = "#b9c4e4";
  var LAV_D = "#8e9fd0";
  var SAND2 = "#efd6a0";
  var SAND_D = "#d9b77a";
  var ASPH = "#a3b1b8";
  var ASPH_D = "#7f919c";
  var WOOD3 = "#b98150";
  var WOOD_L2 = "#dcae78";
  var WOOD_D = "#8a5a36";
  var CHROME = "#dfe6ea";
  var POST_INK = "#d0322a";
  var P_SKY6 = 0.02;
  var P_CLOUD2 = 0.05;
  var P_FAR9 = 0.07;
  var P_MESA = 0.14;
  var P_PLAIN = 0.3;
  var P_POLE2 = 0.6;
  var REG3 = [2.2, 1.5];
  var LW3 = 2.2;
  var BORDER = 22;
  var T_CAR = [GAG - 3.4, GAG - 0.2];
  var T_SHADOW = GAG - 0.8;
  var T_DROP2 = GAG - 0.5;
  var T_HIT = GAG;
  var T_LIFT2 = [GAG + 1, GAG + 1.4];
  var T_STAMP = GAG + 1.5;
  var T_HIT2 = GAG + 2;
  var T_HIT3 = GAG + 3;
  var T_OFF = GAG + 3.6;
  var PM_R = 84;
  var PM_WAVE = 236;
  var PM_ROT = -0.17;
  var PM_OFF = { stand: [14, -335], walk: [-14, -332] };
  var SMALL = 0.62;
  var SPOT_A = { x: 1176, y: 150, rot: 0.1 };
  var SPOT_B = { x: 842, y: 262, rot: -0.08 };
  var STAMP_POS = { x: 1268, y: 140, rot: 0.07 };
  var pathOf3 = (fn) => {
    const p = new Path2D();
    fn(p);
    return p;
  };
  var rectP3 = (x, y, w, h) => pathOf3((p) => p.rect(x, y, w, h));
  var ellP2 = (x, y, rx, ry, rot = 0) => pathOf3((p) => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));
  var circP2 = (x, y, r) => ellP2(x, y, r, r);
  var polyP2 = (pts, close = true) => pathOf3((p) => {
    pts.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y));
    if (close) p.closePath();
  });
  function rrPath(p, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    p.moveTo(x + rr, y);
    p.arcTo(x + w, y, x + w, y + h, rr);
    p.arcTo(x + w, y + h, x, y + h, rr);
    p.arcTo(x, y + h, x, y, rr);
    p.arcTo(x, y, x + w, y, rr);
    p.closePath();
  }
  var rrP = (x, y, w, h, r) => pathOf3((p) => rrPath(p, x, y, w, h, r));
  function starPath(p, cx, cy, r, n = 5, inner = 0.45, rot = 0) {
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + rot + i * Math.PI / n, rr = i % 2 ? r * inner : r;
      i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    p.closePath();
  }
  var starP = (cx, cy, r, rot = 0) => pathOf3((p) => starPath(p, cx, cy, r, 5, 0.45, rot));
  function halftone(ctx, path, color, tone2, bounds, { step = 6, angle = 0.26, rmax = 0.64 } = {}) {
    const [bx, by, bw, bh] = bounds;
    const c = Math.cos(angle), s = Math.sin(angle);
    const cs = [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]].map(([x, y]) => [x * c + y * s, -x * s + y * c]);
    const u0 = Math.floor(Math.min(...cs.map((q) => q[0])) / step) * step, u1 = Math.max(...cs.map((q) => q[0]));
    const v0 = Math.floor(Math.min(...cs.map((q) => q[1])) / step) * step, v1 = Math.max(...cs.map((q) => q[1]));
    ctx.save();
    ctx.clip(path);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let v = v0; v <= v1; v += step) for (let u = u0; u <= u1; u += step) {
      const x = u * c - v * s, y = u * s + v * c;
      if (x < bx - step || x > bx + bw + step || y < by - step || y > by + bh + step) continue;
      const t = tone2(x, y);
      if (t <= 0.015) continue;
      const r = Math.sqrt(Math.min(1, t)) * step * rmax;
      ctx.moveTo(x + r, y);
      ctx.arc(x, y, r, 0, TAU);
    }
    ctx.fill();
    ctx.restore();
  }
  function pc(ctx, path, fill, { line: line2 = LW3, reg = 1, ink = INK9, dots = null, alpha = 0.85 } = {}) {
    if (fill) {
      ctx.save();
      if (reg) ctx.translate(REG3[0] * reg, REG3[1] * reg);
      ctx.fillStyle = fill;
      ctx.fill(path);
      if (dots) halftone(ctx, path, dots.color, dots.tone || (() => dots.t ?? 0.35), dots.bounds, dots.opts || {});
      ctx.restore();
    }
    if (line2) {
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.lineWidth = line2;
      ctx.strokeStyle = ink;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke(path);
      ctx.restore();
    }
  }
  var dotsIn = (color, t, bounds, opts) => ({ color, t, bounds, opts });
  function grainTile3() {
    return memo("s15-grain", () => {
      const S = 256, c = makeCanvas(S, S), x = c.getContext("2d"), im = x.createImageData(S, S);
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const h = hash2(i, j, 15), k = (j * S + i) * 4;
        if (h < 0.03) {
          im.data[k] = 255;
          im.data[k + 1] = 250;
          im.data[k + 2] = 236;
          im.data[k + 3] = 120;
        } else if (h > 0.975) {
          im.data[k] = 60;
          im.data[k + 1] = 70;
          im.data[k + 2] = 84;
          im.data[k + 3] = 46;
        }
      }
      x.putImageData(im, 0, 0);
      return c;
    });
  }
  function grainOver(ctx, x0, y0, w, h, alpha = 1) {
    ctx.save();
    ctx.globalCompositeOperation = "source-atop";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = ctx.createPattern(grainTile3(), "repeat");
    ctx.fillRect(x0, y0, w, h);
    ctx.restore();
  }
  function skyLayer7() {
    return strip("s15-sky", P_SKY6, (ctx, x0, x1) => {
      const g = ctx.createLinearGradient(0, 0, 0, 810);
      g.addColorStop(0, "#95cfe4");
      g.addColorStop(0.5, SKY_L);
      g.addColorStop(0.85, "#f1efdc");
      g.addColorStop(1, CREAM_L);
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, x1 - x0, 810);
      halftone(ctx, rectP3(x0, 0, x1 - x0, 560), SKY_D, (x, y) => 0.4 * Math.pow(Math.max(0, 1 - y / 540), 1.3), [x0, 0, x1 - x0, 560], { step: 6.5 });
    }, { y0: 0, y1: 810 });
  }
  function cloudPath2(cx, cy, w, R) {
    const p = new Path2D();
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), x = cx - w / 2 + t * w;
      const r = (0.22 + 0.2 * Math.sin(Math.PI * t) + R() * 0.08) * w * 0.5;
      p.ellipse(x, cy - r * 0.5, r, r * 0.9, 0, 0, TAU);
    }
    for (let i = 0; i < 2; i++) {
      const r = w * (0.17 + R() * 0.06);
      p.ellipse(cx + (R() - 0.5) * w * 0.4, cy - w * 0.22 - r * 0.3, r, r * 0.85, 0, 0, TAU);
    }
    p.rect(cx - w / 2, cy - 4, w, 8);
    p.ellipse(cx, cy, w / 2, 10, 0, 0, TAU);
    return p;
  }
  function cloudLayer3() {
    return strip("s15-cloud", P_CLOUD2, (ctx, x0, x1) => {
      const R = rng("s15-cloud");
      for (let x = x0 + 60; x < x1; x += 420 + R() * 260) {
        const w = 240 + R() * 200, cy = 170 + R() * 190;
        const p = cloudPath2(x, cy, w, R);
        ctx.save();
        ctx.translate(REG3[0], REG3[1]);
        ctx.fillStyle = "#fffaf0";
        ctx.fill(p);
        const top = cy - w * 0.5;
        halftone(ctx, p, "#f0c7a0", (xx, yy) => 0.75 * smoothstep(cy - w * 0.2, cy + 8, yy), [x - w / 2 - 60, top - 20, w + 120, w * 0.6], { step: 5 });
        halftone(ctx, p, LAV_D, (xx, yy) => 0.5 * smoothstep(cy - 14, cy + 10, yy), [x - w / 2 - 60, cy - 30, w + 120, 50], { step: 5, angle: 0.8 });
        ctx.restore();
      }
    }, { y0: 0, y1: 520 });
  }
  function farLayer8() {
    return strip("s15-far", P_FAR9, (ctx, x0, x1) => {
      const p = new Path2D();
      p.moveTo(x0, 800);
      for (let x = x0; x <= x1; x += 8) p.lineTo(x, 610 - fbm(x / 260, 0.3, 151, 4) * 170 + 60);
      p.lineTo(x1, 800);
      p.closePath();
      ctx.save();
      ctx.translate(REG3[0], REG3[1]);
      ctx.fillStyle = LAV;
      ctx.fill(p);
      halftone(ctx, p, LAV_D, (x, y) => 0.25 + 0.2 * noise2(x / 90, y / 60, 152), [x0, 420, x1 - x0, 380], { step: 5.5, angle: 0.8 });
      ctx.restore();
      grainOver(ctx, x0, 400, x1 - x0, 400, 0.6);
    }, { y0: 400, y1: 800 });
  }
  function mesa(ctx, x, w, h, R) {
    const base = 760, top = base - h, tw = w * (0.4 + R() * 0.18);
    const lx = x - tw / 2, rx = x + tw / 2;
    const shoulder = top + h * (0.5 + R() * 0.12);
    const pts = [[x - w / 2, base + 40], [x - w * 0.34, shoulder + (base - shoulder) * 0.45], [lx - w * 0.06, shoulder], [lx - 3, top + h * 0.14], [lx + 3, top + 3]];
    const nTop = 3 + Math.floor(R() * 3);
    for (let k = 1; k < nTop; k++) {
      const px = lerp(lx + 3, rx - 3, k / nTop);
      if (R() < 0.45) {
        pts.push([px - 6, top + R() * 3]);
        pts.push([px - 2, top + 6 + R() * 10]);
        pts.push([px + 6, top + 6 + R() * 8]);
        pts.push([px + 10, top + R() * 3]);
      } else pts.push([px, top + R() * 4]);
    }
    pts.push([rx - 3, top + 3], [rx + 3, top + h * 0.12], [rx + w * 0.07, shoulder], [x + w * 0.36, shoulder + (base - shoulder) * 0.45], [x + w / 2, base + 40]);
    const body = polyP2(pts);
    pc(ctx, body, "#efb27f", { line: 1.4, alpha: 0.55 });
    const shade2 = polyP2([[x + tw * 0.2, top + 2], [rx + 3, top], [rx + w * 0.08, shoulder], [x + w / 2 + 4, base + 44], [x + tw * 0.02, base + 44], [x + tw * 0.14, shoulder]]);
    ctx.save();
    ctx.clip(body);
    pc(ctx, shade2, "#d98a68", { line: 0, dots: dotsIn(RUST, 0.26, [x - w / 2, top - 10, w, h + 60], { step: 5 }) });
    ctx.strokeStyle = rgba("#fbe2b8", 0.7);
    ctx.lineWidth = 2.2;
    for (let k = 1; k < 4; k++) {
      const yy = top + (shoulder - top) * (k / 4) + R() * 6;
      ctx.beginPath();
      ctx.moveTo(lx - 20, yy);
      ctx.lineTo(x + tw * 0.12, yy + 2);
      ctx.stroke();
    }
    halftone(ctx, body, RUST, (xx, yy) => 0.26 * smoothstep(shoulder, base, yy), [x - w / 2, shoulder, w, base - shoulder + 40], { step: 5 });
    ctx.restore();
  }
  function mesaLayer() {
    return strip("s15-mesa", P_MESA, (ctx, x0, x1) => {
      const R = rng("s15-mesa");
      for (let x = x0 + 100; x < x1; x += 380 + R() * 420) {
        const kind = R();
        if (kind < 0.25) mesa(ctx, x, 170 + R() * 60, 170 + R() * 70, R);
        else mesa(ctx, x, 300 + R() * 260, 120 + R() * 110, R);
      }
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";
      const hz = ctx.createLinearGradient(0, 560, 0, 780);
      hz.addColorStop(0, rgba(SKY_L, 0));
      hz.addColorStop(1, rgba("#f3ead6", 0.45));
      ctx.fillStyle = hz;
      ctx.fillRect(x0, 380, x1 - x0, 440);
      ctx.restore();
      grainOver(ctx, x0, 380, x1 - x0, 440, 0.7);
    }, { y0: 380, y1: 820 });
  }
  function windmill(ctx, x) {
    const base = 742, top = base - 190;
    ctx.strokeStyle = INK9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 24, base);
    ctx.lineTo(x - 5, top);
    ctx.lineTo(x + 5, top);
    ctx.lineTo(x + 24, base);
    for (let k = 1; k < 5; k++) {
      const y = base - (base - top) * k / 5, w = 24 - 19 * k / 5;
      ctx.moveTo(x - w, y);
      ctx.lineTo(x + w, y - (base - top) / 5);
    }
    ctx.stroke();
    for (let k = 0; k < 14; k++) {
      const a = k / 14 * TAU;
      pc(ctx, polyP2([[x, top], [x + Math.cos(a - 0.12) * 46, top + Math.sin(a - 0.12) * 46], [x + Math.cos(a + 0.12) * 46, top + Math.sin(a + 0.12) * 46]]), k % 2 ? PAPER9 : CORAL, { line: 1.2 });
    }
    pc(ctx, polyP2([[x + 6, top - 4], [x + 52, top - 14], [x + 52, top + 10], [x + 6, top + 4]]), CORAL, { line: 1.2 });
  }
  function waterTower(ctx, x) {
    const base = 742;
    ctx.strokeStyle = INK9;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (const dx of [-30, -10, 10, 30]) {
      ctx.moveTo(x + dx * 1.2, base);
      ctx.lineTo(x + dx * 0.8, base - 120);
    }
    ctx.moveTo(x - 34, base - 40);
    ctx.lineTo(x + 34, base - 80);
    ctx.moveTo(x + 34, base - 40);
    ctx.lineTo(x - 34, base - 80);
    ctx.stroke();
    const tank = pathOf3((p) => {
      p.moveTo(x - 38, base - 120);
      p.lineTo(x - 38, base - 178);
      p.quadraticCurveTo(x, base - 214, x + 38, base - 178);
      p.lineTo(x + 38, base - 120);
      p.quadraticCurveTo(x, base - 108, x - 38, base - 120);
      p.closePath();
    });
    pc(ctx, tank, CREAM4, { line: 1.8, dots: dotsIn(SAND_D, 0.35, [x - 40, base - 220, 80, 110]) });
    ctx.save();
    ctx.clip(tank);
    ctx.fillStyle = CORAL;
    ctx.fillRect(x - 40, base - 158, 80, 10);
    ctx.restore();
  }
  function billboard(ctx, x) {
    const base = 742;
    ctx.fillStyle = INK9;
    for (const dx of [-60, 60]) ctx.fillRect(x + dx - 3, base - 80, 6, 80);
    const board = rectP3(x - 110, base - 170, 220, 96);
    pc(ctx, board, PAPER9, { line: 2 });
    pc(ctx, starP(x - 46, base - 122, 34), SUN2, { line: 1.6 });
    pc(ctx, polyP2([[x - 2, base - 132], [x + 52, base - 132], [x + 52, base - 146], [x + 90, base - 122], [x + 52, base - 98], [x + 52, base - 112], [x - 2, base - 112]]), CORAL, { line: 1.6 });
  }
  function shrub(ctx, x, y, r, R) {
    const p = pathOf3((q) => {
      for (let k = 0; k < 4; k++) q.ellipse(x + (k - 1.5) * r * 0.55, y - r * (0.5 + 0.25 * Math.sin(k * 2.1)), r * 0.55, r * 0.5, 0, 0, TAU);
    });
    pc(ctx, p, MINT, { line: 1.2, alpha: 0.6, dots: dotsIn(MINT_D, 0.4, [x - r * 1.6, y - r * 1.4, r * 3.2, r * 1.6], { step: 4.5 }) });
  }
  function plainLayer() {
    return strip("s15-plain", P_PLAIN, (ctx, x0, x1) => {
      const R = rng("s15-plain");
      const ground = pathOf3((p) => {
        p.moveTo(x0, 820);
        for (let x = x0; x <= x1; x += 10) p.lineTo(x, 716 - 14 * Math.sin(x / 230) - 10 * noise2(x / 120, 0, 31));
        p.lineTo(x1, 820);
        p.closePath();
      });
      ctx.save();
      ctx.translate(REG3[0], REG3[1]);
      ctx.fillStyle = SAND2;
      ctx.fill(ground);
      halftone(ctx, ground, MINT_D, (x, y) => 0.38 * smoothstep(0.45, 0.75, noise2(x / 160, y / 40, 33)), [x0, 690, x1 - x0, 130], { step: 5 });
      halftone(ctx, ground, SAND_D, (x, y) => 0.25, [x0, 690, x1 - x0, 130], { step: 5, angle: 0.8 });
      ctx.restore();
      for (let x = x0 + 200; x < x1; x += 700 + R() * 600) {
        const k = R();
        if (k < 0.33) windmill(ctx, x);
        else if (k < 0.62) waterTower(ctx, x);
        else billboard(ctx, x);
      }
      for (let x = x0; x < x1; x += 60 + R() * 120) shrub(ctx, x, 748 + R() * 40, 12 + R() * 12, R);
      grainOver(ctx, x0, 540, x1 - x0, 280, 0.7);
    }, { y0: 540, y1: 820 });
  }
  function poleLayer2(cF) {
    return strip("s15-pole", P_POLE2, (ctx, x0, x1) => {
      const off = 62 + cF * P_POLE2;
      const k0 = Math.floor((x0 - off) / 520) - 1, k1 = Math.ceil((x1 - off) / 520) + 1;
      const xs = [];
      for (let k = k0; k <= k1; k++) xs.push(off + k * 520);
      const tops = [300, 318, 336];
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = rgba(INK9, 0.8);
      for (let i = 0; i < xs.length - 1; i++) for (const [j, yy] of tops.entries()) {
        const a = xs[i] + (j === 1 ? 0 : (j - 1) * 38), b = xs[i + 1] + (j === 1 ? 0 : (j - 1) * 38);
        ctx.beginPath();
        ctx.moveTo(a, yy);
        ctx.quadraticCurveTo((a + b) / 2, yy + 46, b, yy);
        ctx.stroke();
      }
      for (const x of xs) {
        pc(ctx, rectP3(x - 7, 280, 14, 528), WOOD3, { line: 1.6, dots: dotsIn(WOOD_D, 0.4, [x - 8, 280, 16, 530], { step: 4 }) });
        pc(ctx, rectP3(x - 50, 296, 100, 9), WOOD_D, { line: 1.4 });
        pc(ctx, rectP3(x - 34, 314, 68, 8), WOOD_D, { line: 1.4 });
        for (const dx of [-38, 0, 38]) {
          ctx.fillStyle = "#e6f0f2";
          ctx.beginPath();
          ctx.ellipse(x + dx, 296, 4, 6, 0, 0, TAU);
          ctx.fill();
        }
      }
      const R = rng("s15-birds");
      for (let i = 0; i < xs.length - 1; i++) if (R() < 0.45) {
        const n = 2 + Math.floor(R() * 3), t0 = 0.25 + R() * 0.3;
        for (let k = 0; k < n; k++) {
          const t = t0 + k * 0.05, a = xs[i] - 38, b = xs[i + 1] - 38;
          const x = lerp(a, b, t), y = 300 + 46 * 2 * t * (1 - t) * 1 - 2;
          ctx.fillStyle = INK9;
          ctx.beginPath();
          ctx.ellipse(x, y - 6, 6, 5, 0, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(x + 5, y - 11, 3.4, 0, TAU);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - 5, y - 6);
          ctx.lineTo(x - 12, y - 1);
          ctx.lineTo(x - 4, y - 3);
          ctx.fill();
        }
      }
    }, { y0: 250, y1: 810 });
  }
  function mailbox(ctx, x) {
    pc(ctx, rectP3(x - 7, 700, 14, 100), NAVY2, { line: 1.6 });
    const box = pathOf3((p) => {
      p.moveTo(x - 38, 712);
      p.lineTo(x - 38, 640);
      p.arc(x, 640, 38, Math.PI, 0);
      p.lineTo(x + 38, 712);
      p.closePath();
    });
    pc(ctx, box, "#3f86b8", { dots: dotsIn(NAVY2, 0.3, [x - 40, 600, 80, 114]) });
    pc(ctx, rrP(x - 22, 642, 44, 7, 3), NAVY2, { line: 1.2, reg: 0 });
    pc(ctx, starP(x, 684, 11), PAPER9, { line: 1.2 });
    pc(ctx, rectP3(x - 42, 710, 84, 8), NAVY2, { line: 1.4 });
  }
  function postcardRack(ctx, x) {
    pc(ctx, rectP3(x - 4, 560, 8, 240), INK9, { line: 0 });
    pc(ctx, ellP2(x, 796, 34, 6), INK9, { line: 0 });
    const cols = [[SKY3, ORANGE], [MINT, CORAL], [CREAM4, SKY_D], [ORANGE, MINT_D], [SKY_L, CORAL]];
    for (let row = 0; row < 3; row++) for (let k = -2; k <= 2; k++) {
      const y = 576 + row * 64, cx = x + k * 26, w = 22 * (1 - Math.abs(k) * 0.18), h = 32;
      const [a, b2] = cols[(row * 3 + k + 7) % cols.length];
      pc(ctx, rectP3(cx - w / 2, y, w, h), PAPER9, { line: 1, reg: 0 });
      pc(ctx, rectP3(cx - w / 2 + 3, y + 3, w - 6, h * 0.55), a, { line: 0 });
      ctx.fillStyle = b2;
      ctx.fillRect(cx - w / 2 + 3, y + 3 + h * 0.55, w - 6, h * 0.3);
    }
    ctx.strokeStyle = INK9;
    ctx.lineWidth = 1.4;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      ctx.moveTo(x - 66, 610 + row * 64);
      ctx.lineTo(x + 66, 610 + row * 64);
      ctx.stroke();
    }
    pc(ctx, circP2(x, 552, 9), CORAL, { line: 1.4 });
  }
  function gasStation(ctx, x) {
    const bx = x, bw = 190, top = 640;
    pc(ctx, rectP3(bx - 66, 360, 12, 440), INK9, { line: 0 });
    pc(ctx, circP2(bx - 60, 360, 58), PAPER9, { line: 2.4 });
    pc(ctx, circP2(bx - 60, 360, 46), CORAL, { line: 1.6, dots: dotsIn(CORAL_D, 0.3, [bx - 110, 310, 100, 100]) });
    pc(ctx, starP(bx - 60, 364, 32), YEL3, { line: 1.6 });
    const body = pathOf3((p) => {
      p.moveTo(bx, 800);
      p.lineTo(bx, top + 50);
      p.arcTo(bx, top, bx + 50, top, 50);
      p.lineTo(bx + bw, top);
      p.lineTo(bx + bw, 800);
      p.closePath();
    });
    pc(ctx, body, PAPER9, { dots: dotsIn(SAND_D, 0.22, [bx, top, bw, 160]) });
    ctx.save();
    ctx.clip(body);
    ctx.fillStyle = MINT;
    ctx.fillRect(bx - 4, top, bw + 8, 26);
    ctx.fillStyle = CORAL;
    for (const dy of [34, 42, 50]) ctx.fillRect(bx - 4, top + dy, bw + 8, 3);
    ctx.restore();
    pc(ctx, rectP3(bx + 22, 690, 92, 70), SKY_L, { line: 2, dots: dotsIn(SKY_D, 0.25, [bx + 22, 690, 92, 70]) });
    ctx.strokeStyle = rgba("#ffffff", 0.85);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(bx + 40, 756);
    ctx.lineTo(bx + 76, 694);
    ctx.moveTo(bx + 62, 756);
    ctx.lineTo(bx + 90, 708);
    ctx.stroke();
    pc(ctx, rectP3(bx + 132, 700, 40, 100), CORAL, { line: 2 });
    pc(ctx, circP2(bx + 164, 752, 3), YEL3, { line: 0 });
    const cx0 = bx + bw, cx1 = bx + bw + 230;
    pc(ctx, rectP3(cx1 - 30, 620, 12, 180), PAPER9, { line: 1.6 });
    pc(ctx, polyP2([[cx0 - 10, 604], [cx1 + 18, 596], [cx1 + 18, 626], [cx0 - 10, 634]]), PAPER9, { line: 2 });
    pc(ctx, polyP2([[cx0 - 10, 622], [cx1 + 18, 614], [cx1 + 18, 626], [cx0 - 10, 634]]), ORANGE, { line: 1.4 });
    for (const px of [cx0 + 60, cx0 + 150]) {
      pc(ctx, rectP3(px - 4, 790, 48, 10), INK9, { line: 0 });
      pc(ctx, rrP(px, 690, 40, 104, 8), CORAL, { dots: dotsIn(CORAL_D, 0.3, [px + 22, 690, 20, 104]) });
      pc(ctx, circP2(px + 20, 722, 12), PAPER9, { line: 1.4 });
      ctx.strokeStyle = INK9;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px + 20, 722);
      ctx.lineTo(px + 27, 716);
      ctx.stroke();
      pc(ctx, circP2(px + 20, 672, 18), PAPER9, { line: 1.6 });
      pc(ctx, starP(px + 20, 673, 10), CORAL, { line: 0 });
      ctx.strokeStyle = NAVY2;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.moveTo(px + 40, 740);
      ctx.quadraticCurveTo(px + 64, 770, px + 52, 712);
      ctx.stroke();
    }
    for (let k = 0; k < 3; k++) pc(ctx, ellP2(bx - 22, 788 - k * 16, 22, 9), INK9, { line: 1.2 });
  }
  function palm(ctx, x, h = 540, lean = 0.12) {
    const base = 800, tx = x + Math.sin(lean) * h, ty = base - h;
    const trunk = pathOf3((p) => {
      p.moveTo(x - 13, base);
      p.quadraticCurveTo(x - 6 + (tx - x) * 0.3, base - h * 0.55, tx - 6, ty + 8);
      p.lineTo(tx + 6, ty + 8);
      p.quadraticCurveTo(x + 6 + (tx - x) * 0.3, base - h * 0.55, x + 13, base);
      p.closePath();
    });
    pc(ctx, trunk, WOOD_L2, { dots: dotsIn(WOOD_D, 0.35, [x - 20, ty, tx - x + 40, h], { step: 4 }) });
    ctx.save();
    ctx.clip(trunk);
    ctx.strokeStyle = rgba(WOOD_D, 0.8);
    ctx.lineWidth = 1.6;
    for (let y = base - 14; y > ty; y -= 16) {
      ctx.beginPath();
      ctx.moveTo(x - 30, y);
      ctx.lineTo(x + 140, y - 4);
      ctx.stroke();
    }
    ctx.restore();
    const fronds = [-2.9, -2.4, -1.9, -1.35, -0.8, -0.3, 0.2];
    for (const [i, a] of fronds.entries()) {
      const L = 120 + i % 2 * 26;
      const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + 34;
      const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.5 - 18;
      const nx = -Math.sin(a) * 18, ny = Math.cos(a) * 18;
      const f = pathOf3((p) => {
        p.moveTo(tx, ty);
        p.quadraticCurveTo(mx + nx, my + ny, ex, ey);
        p.quadraticCurveTo(mx - nx, my - ny - 8, tx, ty);
        p.closePath();
      });
      pc(ctx, f, i % 2 ? MINT_D : MINT, { line: 1.6, dots: dotsIn(MINT_DD, 0.28, [tx - 170, ty - 120, 340, 220], { step: 4.5 }) });
    }
    pc(ctx, circP2(tx - 6, ty + 10, 8), WOOD_D, { line: 1 });
    pc(ctx, circP2(tx + 8, ty + 12, 7), WOOD_D, { line: 1 });
  }
  function motel(ctx, x) {
    const ox = x, ow = 190, wx = x + ow, ww = 600;
    pc(ctx, rectP3(ox, 610, ow, 190), CREAM_L, { dots: dotsIn(SAND_D, 0.2, [ox, 610, ow, 190]) });
    pc(ctx, polyP2([[ox - 20, 600], [ox + ow + 10, 600], [ox + ow + 10, 618], [ox - 20, 618]]), ORANGE, { line: 2 });
    pc(ctx, rectP3(ox + 18, 650, 104, 90), SKY_L, { line: 2, dots: dotsIn(SKY_D, 0.25, [ox + 18, 650, 104, 90]) });
    ctx.strokeStyle = rgba("#ffffff", 0.85);
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(ox + 34, 734);
    ctx.lineTo(ox + 70, 656);
    ctx.stroke();
    pc(ctx, rectP3(ox + 138, 690, 38, 110), MINT_D, { line: 2 });
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k % 2 ? PAPER9 : CORAL;
      ctx.fillRect(ox + 10 + k * 26, 624, 26, 16);
    }
    pc(ctx, polyP2([[ox + 6, 640], [ox + 136, 640], [ox + 128, 618], [ox + 14, 618]]), null, { line: 1.6 });
    pc(ctx, rectP3(wx, 650, ww, 150), PAPER9, { dots: dotsIn(SAND_D, 0.16, [wx, 650, ww, 150]) });
    pc(ctx, rectP3(wx - 6, 632, ww + 16, 20), ORANGE, { line: 2, dots: dotsIn(ORANGE_D, 0.3, [wx, 632, ww + 16, 20]) });
    for (let k = 0; k < 5; k++) {
      const ux = wx + 20 + k * 116;
      pc(ctx, rectP3(ux, 694, 40, 106), CORAL, { line: 1.8, dots: dotsIn(CORAL_D, 0.25, [ux + 26, 694, 14, 106]) });
      pc(ctx, circP2(ux + 32, 748, 3), YEL3, { line: 0 });
      pc(ctx, rectP3(ux + 56, 690, 46, 46), SKY_L, { line: 1.8 });
      pc(ctx, rectP3(ux + 56, 690, 46, 14), MINT, { line: 1.2 });
      pc(ctx, rectP3(ux + 6, 672, 28, 12), CREAM4, { line: 1.2 });
      pc(ctx, rectP3(ux + 102 - 2, 652, 6, 148), PAPER9, { line: 1.2 });
    }
    const cxl = wx + ww - 60;
    ctx.strokeStyle = INK9;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cxl - 30, 800);
    ctx.lineTo(cxl + 4, 768);
    ctx.moveTo(cxl + 30, 800);
    ctx.lineTo(cxl - 4, 768);
    ctx.stroke();
    pc(ctx, polyP2([[cxl - 34, 770], [cxl + 26, 770], [cxl + 34, 742], [cxl + 22, 740], [cxl + 16, 762], [cxl - 34, 762]]), MINT, { line: 1.6 });
  }
  function saguaro(ctx, x, h = 230, R) {
    const base = 800, w = 26;
    const p = new Path2D();
    rrPath(p, x - w / 2, base - h, w, h + 4, w / 2);
    const arms = [[-1, 0.42, 0.3], [1, 0.55, 0.26]];
    for (const [dir, at, len] of arms) {
      const ay = base - h * at, ax = x + dir * w * 0.3;
      rrPath(p, Math.min(ax, ax + dir * 46), ay - 12, 46, 22, 11);
      rrPath(p, ax + dir * 46 - 11, ay - h * len, 22, h * len + 10, 11);
    }
    pc(ctx, p, "#6fb48f", { dots: dotsIn(MINT_DD, 0.32, [x - 80, base - h, 160, h], { step: 4.5 }) });
    ctx.save();
    ctx.clip(p);
    ctx.strokeStyle = rgba("#d8f0e0", 0.7);
    ctx.lineWidth = 1.4;
    for (const dx of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, base);
      ctx.lineTo(x + dx, base - h + 6);
      ctx.stroke();
    }
    ctx.restore();
  }
  function shieldSign(ctx, x) {
    pc(ctx, rectP3(x - 4, 640, 8, 160), CHROME, { line: 1.4 });
    const s = pathOf3((p) => {
      p.moveTo(x - 34, 590);
      p.lineTo(x + 34, 590);
      p.lineTo(x + 32, 626);
      p.quadraticCurveTo(x + 22, 652, x, 664);
      p.quadraticCurveTo(x - 22, 652, x - 32, 626);
      p.closePath();
    });
    pc(ctx, s, PAPER9, { line: 3 });
    pc(ctx, rectP3(x - 30, 594, 60, 12), NAVY2, { line: 0 });
    pc(ctx, starP(x, 632, 16), CORAL, { line: 1.2 });
  }
  function diamondSign(ctx, x) {
    pc(ctx, rectP3(x - 4, 650, 8, 150), CHROME, { line: 1.4 });
    pc(ctx, polyP2([[x, 580], [x + 44, 624], [x, 668], [x - 44, 624]]), YEL3, { line: 2.6 });
    ctx.strokeStyle = INK9;
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x - 6, 650);
    ctx.bezierCurveTo(x - 24, 630, x + 22, 622, x + 4, 602);
    ctx.stroke();
    pc(ctx, polyP2([[x - 8, 600], [x + 12, 590], [x + 12, 612]]), INK9, { line: 0, reg: 0 });
  }
  function fence(ctx, xa, xb) {
    ctx.strokeStyle = rgba(INK9, 0.8);
    ctx.lineWidth = 1.4;
    for (const y of [748, 770]) {
      ctx.beginPath();
      ctx.moveTo(xa, y);
      for (let x = xa; x <= xb; x += 70) ctx.quadraticCurveTo(x + 35, y + 5, x + 70, y);
      ctx.stroke();
    }
    for (let x = xa; x <= xb + 1; x += 70) pc(ctx, polyP2([[x - 4, 800], [x - 5, 732], [x + 5, 730], [x + 4, 800]]), WOOD3, { line: 1.2 });
  }
  function roadsideLayer(cF) {
    return strip("s15-roadside", 1, (ctx, x0, x1) => {
      const at = (sF) => sF + cF;
      const R = rng("s15-roadside");
      for (let x = x0; x < x1; x += 90 + R() * 140) shrub(ctx, x, 800, 14 + R() * 10, R);
      shieldSign(ctx, at(-1480));
      saguaro(ctx, at(-1250), 250, R);
      saguaro(ctx, at(-1110), 150, R);
      fence(ctx, at(-1020), at(-740));
      mailbox(ctx, at(-640));
      postcardRack(ctx, at(-530));
      gasStation(ctx, at(-330));
      palm(ctx, at(150), 520, 0.1);
      motel(ctx, at(600));
      saguaro(ctx, at(1470), 170, R);
      shieldSign(ctx, at(1580));
      saguaro(ctx, at(1800), 260, R);
      fence(ctx, at(1900), at(2320));
      diamondSign(ctx, at(2140));
      saguaro(ctx, at(2420), 200, R);
      grainOver(ctx, x0, 200, x1 - x0, 610, 0.8);
    }, { y0: 200, y1: 806 });
  }
  function roadLayer6() {
    return strip("s15-road", 1, (ctx, x0, x1) => {
      ctx.fillStyle = SAND2;
      ctx.fillRect(x0, 794, x1 - x0, 50);
      halftone(ctx, rectP3(x0, 794, x1 - x0, 50), SAND_D, (x, y) => 0.3 + 0.25 * noise2(x / 50, y / 20, 41), [x0, 794, x1 - x0, 50], { step: 4.5 });
      const R = rng("s15-pebbles");
      for (let x = x0; x < x1; x += 16 + R() * 40) {
        ctx.fillStyle = R() < 0.5 ? WOOD_L2 : "#c9b48a";
        ctx.beginPath();
        ctx.ellipse(x, 806 + R() * 34, 2 + R() * 3, 1.5 + R() * 1.5, 0, 0, TAU);
        ctx.fill();
      }
      const g = ctx.createLinearGradient(0, 842, 0, 1e3);
      g.addColorStop(0, "#b5c1c6");
      g.addColorStop(1, ASPH);
      ctx.fillStyle = g;
      ctx.fillRect(x0, 842, x1 - x0, 160);
      halftone(ctx, rectP3(x0, 842, x1 - x0, 160), ASPH_D, (x, y) => 0.18 + 0.12 * (y - 842) / 158, [x0, 842, x1 - x0, 160], { step: 5.5 });
      ctx.fillStyle = PAPER9;
      ctx.fillRect(x0, 852, x1 - x0, 6);
      ctx.fillStyle = INK9;
      ctx.fillRect(x0, 842, x1 - x0, 2);
      for (let x = Math.floor(x0 / 150) * 150; x < x1; x += 150) {
        ctx.save();
        ctx.translate(REG3[0], REG3[1]);
        ctx.fillStyle = YEL3;
        ctx.fillRect(x, 934, 80, 9);
        ctx.restore();
      }
      grainOver(ctx, x0, 790, x1 - x0, 210, 0.9);
    }, { y0: 790, y1: 1e3 });
  }
  function arrowSign(ctx, x, b) {
    pc(ctx, rectP3(x - 7, 330, 14, 470), NAVY2, { line: 1.6 });
    pc(ctx, rrP(x - 52, 330, 104, 150, 10), PAPER9, { line: 2.4, dots: dotsIn(SAND_D, 0.18, [x - 52, 330, 104, 150]) });
    pc(ctx, rrP(x - 42, 340, 84, 130, 6), null, { line: 1.4 });
    pc(ctx, starP(x, 300, 30, Math.sin(b * Math.PI) * 0.15), YEL3, { line: 1.8 });
    const arrow = pathOf3((p) => {
      p.moveTo(x + 40, 440);
      p.quadraticCurveTo(x + 150, 470, x + 70, 540);
      p.lineTo(x - 30, 560);
      p.lineTo(x - 26, 532);
      p.lineTo(x - 92, 572);
      p.lineTo(x - 18, 600);
      p.lineTo(x - 22, 578);
      p.lineTo(x + 86, 556);
      p.quadraticCurveTo(x + 176, 470, x + 52, 424);
      p.closePath();
    });
    pc(ctx, arrow, CORAL, { line: 2.4, dots: dotsIn(CORAL_D, 0.28, [x - 100, 420, 290, 190]) });
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      const q = [(1 - t) ** 2 * (x + 46) + 2 * (1 - t) * t * (x + 162) + t * t * (x + 78), (1 - t) ** 2 * 432 + 2 * (1 - t) * t * 470 + t * t * 548];
      pts.push(q);
    }
    for (let k = 1; k <= 4; k++) pts.push([lerp(x + 78, x - 22, k / 4), lerp(548, 568, k / 4)]);
    const ph = Math.floor(b * 2);
    pts.forEach(([px, py], i) => {
      const on = ((i - ph) % 3 + 3) % 3 === 0;
      ctx.fillStyle = on ? "#fff3b0" : rgba(CREAM4, 0.9);
      ctx.beginPath();
      ctx.arc(px, py, on ? 5.5 : 4, 0, TAU);
      ctx.fill();
      if (on) {
        ctx.fillStyle = rgba("#fff6c8", 0.35);
        ctx.beginPath();
        ctx.arc(px, py, 11, 0, TAU);
        ctx.fill();
      }
    });
  }
  function car(ctx, x, y, s, roll, wave) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = rgba(NAVY2, 0.2);
    ctx.beginPath();
    ctx.ellipse(6, 2, 218, 11, 0, 0, TAU);
    ctx.fill();
    pc(ctx, rrP(-196, -148, 70, 44, 6), MINT, { line: 2, dots: dotsIn(MINT_D, 0.3, [-196, -148, 70, 44]) });
    ctx.fillStyle = WOOD_D;
    ctx.fillRect(-176, -148, 6, 44);
    ctx.fillRect(-152, -148, 6, 44);
    pc(ctx, rrP(-104, -150, 40, 56, 10), CREAM4, { line: 1.6 });
    pc(ctx, rrP(-28, -148, 40, 54, 10), CREAM4, { line: 1.6 });
    pc(ctx, rrP(-14, -160, 30, 48, 10), "#f3a46c", { line: 1.6 });
    pc(ctx, ellP2(4, -184, 17, 19), "#f1c4a0", { line: 1.6 });
    pc(ctx, ellP2(2, -198, 32, 7), "#f2d27a", { line: 1.6 });
    pc(ctx, pathOf3((p) => {
      p.moveTo(-14, -199);
      p.quadraticCurveTo(-12, -220, 4, -220);
      p.quadraticCurveTo(18, -220, 18, -199);
      p.closePath();
    }), "#f2d27a", { line: 1.6 });
    ctx.fillStyle = CORAL;
    ctx.fillRect(-14, -204, 32, 5);
    pc(ctx, rrP(6, -190, 15, 7, 3), INK9, { line: 0, reg: 0 });
    ctx.save();
    ctx.translate(-2, -152);
    ctx.rotate(-1.9 - 0.35 * wave);
    pc(ctx, rrP(-6, 0, 12, 46, 6), "#f1c4a0", { line: 1.4 });
    pc(ctx, circP2(0, 50, 9), "#f1c4a0", { line: 1.4 });
    ctx.restore();
    pc(ctx, polyP2([[38, -102], [62, -158], [70, -156], [50, -100]]), rgba(SKY_L, 0.85), { line: 2 });
    const body = pathOf3((p) => {
      p.moveTo(-206, -40);
      p.lineTo(-212, -80);
      p.quadraticCurveTo(-214, -100, -192, -106);
      p.lineTo(-150, -118);
      p.lineTo(-124, -102);
      p.lineTo(40, -102);
      p.quadraticCurveTo(150, -100, 198, -84);
      p.quadraticCurveTo(216, -78, 214, -50);
      p.lineTo(210, -36);
      p.quadraticCurveTo(202, -26, 182, -26);
      p.lineTo(-188, -26);
      p.quadraticCurveTo(-206, -28, -206, -40);
      p.closePath();
    });
    pc(ctx, body, CORAL, { line: 2.4, dots: dotsIn(CORAL_D, 0.35, [-216, -120, 432, 96]) });
    ctx.save();
    ctx.clip(body);
    ctx.save();
    ctx.translate(REG3[0], REG3[1]);
    ctx.fillStyle = CREAM_L;
    ctx.beginPath();
    ctx.moveTo(-200, -74);
    ctx.quadraticCurveTo(-40, -82, 150, -66);
    ctx.lineTo(150, -60);
    ctx.quadraticCurveTo(-40, -70, -200, -62);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = rgba("#ffffff", 0.5);
    ctx.fillRect(-120, -98, 150, 4);
    ctx.restore();
    for (const wx of [-128, 128]) {
      ctx.fillStyle = INK9;
      ctx.beginPath();
      ctx.arc(wx, -26, 44, Math.PI, 0);
      ctx.fill();
      ctx.save();
      ctx.translate(wx, -32);
      pc(ctx, circP2(0, 0, 34), "#2b3440", { line: 0, reg: 0 });
      pc(ctx, circP2(0, 0, 24), PAPER9, { line: 0, reg: 0 });
      pc(ctx, circP2(0, 0, 17), CHROME, { line: 1.4, reg: 0 });
      ctx.rotate(roll);
      ctx.strokeStyle = rgba(INK9, 0.8);
      ctx.lineWidth = 2.2;
      for (let k = 0; k < 3; k++) {
        ctx.rotate(TAU / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 14);
        ctx.stroke();
      }
      ctx.restore();
    }
    pc(ctx, rrP(196, -48, 26, 14, 6), CHROME, { line: 1.8 });
    pc(ctx, rrP(-220, -50, 22, 14, 6), CHROME, { line: 1.8 });
    pc(ctx, ellP2(206, -70, 7, 9), "#fff6c8", { line: 1.4 });
    pc(ctx, ellP2(-206, -88, 5, 9), CORAL_D, { line: 1.2 });
    ctx.restore();
  }
  function carState(b, env) {
    if (b < T_CAR[0] || b > T_CAR[1]) return null;
    const t = (b - T_CAR[0]) / (T_CAR[1] - T_CAR[0]);
    const sx = lerp(X_MIN - 300, X_MAX + 320, t * t * 0.35 + t * 0.65);
    const travel = sx + env.cam;
    return { x: sx, y: 936, s: 1, roll: travel / 34, wave: Math.max(0, Math.sin(clamp((t - 0.3) / 0.4) * Math.PI)) * (0.6 + 0.4 * Math.sin(b * TAU * 2)) };
  }
  function exhaust(ctx, c, b) {
    for (let k = 0; k < 3; k++) {
      const age = (b * 2 + k / 3) % 1;
      const px = c.x - 230 - age * 120, py = c.y - 40 - age * 30;
      ctx.fillStyle = rgba(PAPER9, 0.85 * (1 - age));
      ctx.beginPath();
      ctx.arc(px, py, 10 + age * 18, 0, TAU);
      ctx.fill();
    }
  }
  function postmark(key, r, waveLen, seed) {
    const S = 1.7, pad = 30;
    const x0 = -r - pad, x1 = r + 16 + waveLen + pad, y0 = -r - pad, y1 = r + pad;
    const cv = baked(`s15-pm|${key}|${r}|${waveLen}|${seed}`, (x1 - x0) * S, (y1 - y0) * S, (c) => {
      c.scale(S, S);
      c.translate(-x0, -y0);
      c.strokeStyle = POST_INK;
      c.fillStyle = POST_INK;
      c.lineCap = "round";
      c.lineWidth = r * 0.085;
      c.beginPath();
      c.arc(0, 0, r, 0, TAU);
      c.stroke();
      c.lineWidth = r * 0.05;
      c.beginPath();
      c.arc(0, 0, r * 0.76, 0, TAU);
      c.stroke();
      font(c, r * 0.56, { family: SANS, weight: 700 });
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText("2022", 0, r * 0.05);
      for (const sy of [-1, 1]) {
        c.beginPath();
        starPath(c, 0, sy * r * 0.5, r * 0.11, 5, 0.45);
        c.fill();
      }
      c.lineWidth = r * 0.04;
      for (const sx of [-1, 1]) {
        c.beginPath();
        c.moveTo(sx * r * 0.58, -r * 0.33);
        c.lineTo(sx * r * 0.7, -r * 0.33);
        c.moveTo(sx * r * 0.58, r * 0.37);
        c.lineTo(sx * r * 0.7, r * 0.37);
        c.stroke();
      }
      c.lineWidth = r * 0.075;
      for (let k = 0; k < 5; k++) {
        const yy = (k - 2) * r * 0.3, xa = r + 16 + (k === 0 || k === 4 ? 14 : 0);
        c.beginPath();
        for (let x = xa; x <= r + 16 + waveLen; x += 3) c.lineTo(x, yy + Math.sin((x - xa) / (r * 0.62) * TAU) * r * 0.07);
        c.stroke();
      }
      const R = rng("s15-pm", seed);
      for (let k = 0; k < 9; k++) {
        const a = R() * TAU, d = r * (1.12 + R() * 0.35);
        c.beginPath();
        c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.8 + R() * 2.4, 0, TAU);
        c.fill();
      }
      c.globalCompositeOperation = "destination-out";
      const n = Math.round((x1 - x0) * (y1 - y0) * 0.02);
      for (let k = 0; k < n; k++) {
        const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
        c.globalAlpha = 0.5 + R() * 0.5;
        c.beginPath();
        c.arc(x, y, 0.5 + R() * 1.5, 0, TAU);
        c.fill();
      }
      c.globalAlpha = 1;
      const g = c.createLinearGradient(r * 0.6, 0, r + 16 + waveLen, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.62)");
      c.fillStyle = g;
      c.fillRect(r * 0.6, y0, x1 - r * 0.6, y1 - y0);
      const ga = R() * TAU;
      const g2 = c.createRadialGradient(Math.cos(ga) * r * 0.8, Math.sin(ga) * r * 0.8, 0, Math.cos(ga) * r * 0.8, Math.sin(ga) * r * 0.8, r * 0.7);
      g2.addColorStop(0, "rgba(0,0,0,0.55)");
      g2.addColorStop(1, "rgba(0,0,0,0)");
      c.fillStyle = g2;
      c.fillRect(x0, y0, x1 - x0, y1 - y0);
      for (let k = 0; k < 3; k++) {
        const a = R() * TAU;
        c.save();
        c.translate(Math.cos(a) * r, Math.sin(a) * r);
        c.rotate(a);
        c.fillRect(-r * 0.08, -r * 0.03 - R() * r * 0.05, r * 0.16, r * 0.1);
        c.restore();
      }
      c.globalCompositeOperation = "source-atop";
      for (let k = 0; k < 6; k++) {
        const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
        const gg = c.createRadialGradient(x, y, 0, x, y, r * 0.5);
        gg.addColorStop(0, "rgba(110,14,18,0.45)");
        gg.addColorStop(1, "rgba(110,14,18,0)");
        c.fillStyle = gg;
        c.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
    });
    return { cv, x0, y0, w: x1 - x0, h: y1 - y0 };
  }
  var bigMark = () => postmark("big", PM_R, PM_WAVE, 1);
  var smallMark = (k) => postmark(`small${k}`, PM_R * SMALL, PM_WAVE * SMALL * 0.8, 2 + k);
  function drawMark(ctx, M2, x, y, rot, alpha = 1, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(scale, scale);
    ctx.globalAlpha *= alpha;
    ctx.drawImage(M2.cv, M2.x0, M2.y0, M2.w, M2.h);
    ctx.restore();
  }
  var FACE = { x0: -PM_R - 30, x1: PM_R + 16 + PM_WAVE + 26, d: 60, H: 74 };
  function rubberStamp(ctx, x, y, rot, s, squash = 0) {
    const { x0, x1, d, H: H2 } = FACE, fc = (x0 + x1) / 2, w = x1 - x0;
    const h = H2 * (1 - squash * 0.35);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    const neckTop = -d - h - 150 * (1 - squash * 0.25);
    pc(ctx, rrP(fc - 24, neckTop, 48, -d - h - neckTop + 8, 10), WOOD_L2, { line: 2.4, dots: dotsIn(WOOD_D, 0.35, [fc + 4, neckTop, 22, 170], { step: 4 }) });
    pc(ctx, rrP(fc - 32, -d - h - 26, 64, 22, 8), CHROME, { line: 2 });
    pc(ctx, ellP2(fc, neckTop - 40, 74, 58), CORAL, { line: 2.6, dots: dotsIn(CORAL_D, 0.4, [fc, neckTop - 100, 80, 120]) });
    ctx.fillStyle = rgba("#ffe2c8", 0.8);
    ctx.beginPath();
    ctx.ellipse(fc - 26, neckTop - 62, 20, 11, -0.5, 0, TAU);
    ctx.fill();
    const topFace = rrP(x0, -d - h, w, 2 * d, 26);
    pc(ctx, topFace, WOOD_L2, { line: 2.6, dots: dotsIn(WOOD3, 0.3, [x0, -d - h, w, 2 * d]) });
    ctx.save();
    ctx.clip(topFace);
    ctx.strokeStyle = rgba(WOOD_D, 0.6);
    ctx.lineWidth = 2;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(x0, -d - h + 14 + k * 18);
      ctx.bezierCurveTo(x0 + w * 0.3, -d - h + 6 + k * 18, x0 + w * 0.6, -d - h + 26 + k * 18, x1, -d - h + 12 + k * 18);
      ctx.stroke();
    }
    ctx.restore();
    const front = pathOf3((p) => {
      p.moveTo(x0, d - h - 26);
      p.lineTo(x0, d - 26 - 14);
      p.quadraticCurveTo(x0, d - 14, x0 + 26, d - 14);
      p.lineTo(x1 - 26, d - 14);
      p.quadraticCurveTo(x1, d - 14, x1, d - 40);
      p.lineTo(x1, d - h - 26);
      p.quadraticCurveTo(x1, d - h, x1 - 26, d - h);
      p.lineTo(x0 + 26, d - h);
      p.quadraticCurveTo(x0, d - h, x0, d - h - 26);
      p.closePath();
    });
    pc(ctx, front, WOOD3, { line: 2.6, dots: dotsIn(WOOD_D, 0.42, [x0, d - h - 30, w, h + 20]) });
    ctx.fillStyle = CHROME;
    ctx.fillRect(x0 + 8, d - h * 0.55, w - 16, 7);
    const rub = rrP(x0 + 6, d - 18, w - 12, 18, 8);
    pc(ctx, rub, "#7a2b26", { line: 2.2 });
    ctx.save();
    ctx.clip(rub);
    ctx.fillStyle = rgba(POST_INK, 0.85);
    ctx.fillRect(x0, d - 8, w, 12);
    ctx.restore();
    ctx.restore();
  }
  function stampPose(b) {
    const C = chest("stand");
    if (b >= T_DROP2 && b < T_LIFT2[1]) {
      let y = C.y, rot = PM_ROT, squash = 0;
      if (b < T_HIT) {
        const t = (b - T_DROP2) / (T_HIT - T_DROP2);
        y = C.y - 1e3 * (1 - t * t);
        rot = PM_ROT - 0.16 * (1 - t);
      } else if (b < T_LIFT2[0]) {
        squash = Math.exp(-(b - T_HIT) * 14) * (b - T_HIT < 0.05 ? (b - T_HIT) / 0.05 : 1);
        const rock3 = smoothstep(T_HIT + 0.2, T_HIT + 0.35, b) * (1 - smoothstep(T_LIFT2[0] - 0.15, T_LIFT2[0], b));
        rot += 0.035 * Math.sin((b - T_HIT - 0.2) * TAU * 2) * rock3;
      } else {
        const t = (b - T_LIFT2[0]) / (T_LIFT2[1] - T_LIFT2[0]);
        y = C.y - 1100 * ease.in(t);
        rot = PM_ROT + 0.2 * t;
      }
      return { x: C.x, y, rot, s: 1, squash };
    }
    if (b >= T_STAMP && b < T_OFF + 0.5) {
      const x = keyframes([[T_HIT2 + 0.25, SPOT_A.x], [T_HIT3 - 0.2, SPOT_B.x, ease.inOut]], b);
      const rot = keyframes([[T_HIT2 + 0.25, SPOT_A.rot], [T_HIT3 - 0.2, SPOT_B.rot, ease.inOut]], b);
      const base = b < T_HIT2 + 0.5 ? SPOT_A.y : SPOT_B.y;
      const lift = keyframes([[T_STAMP, -700], [T_HIT2, 0, ease.in], [T_HIT2 + 0.15, 0], [T_HIT2 + 0.45, -150, ease.out], [T_HIT3 - 0.35, -150], [T_HIT3, 0, ease.in], [T_HIT3 + 0.18, 0], [T_OFF + 0.5, -900, ease.in]], b);
      const hit = b >= T_HIT3 ? T_HIT3 : T_HIT2;
      const squash = b >= hit ? Math.exp(-(b - hit) * 14) * Math.min(1, (b - hit) / 0.05) : 0;
      return { x, y: base + lift, rot, s: SMALL, squash };
    }
    return null;
  }
  function jolt(b) {
    let dx = 0, dy = 0, k = 1, cx = 0, cy = 0;
    const C = chest("stand");
    for (const [t0, A, px, py] of [[T_HIT, 1, C.x + (FACE.x0 + FACE.x1) / 2 * 0.9, C.y], [T_HIT2, 0.32, SPOT_A.x, SPOT_A.y], [T_HIT3, 0.32, SPOT_B.x, SPOT_B.y]]) {
      const t = b - t0;
      if (t < 0 || t > 0.8) continue;
      const e = Math.exp(-t * 7) * A;
      dy += Math.sin(t * 42) * 8 * e;
      dx += Math.sin(t * 33 + 1) * 4 * e;
      k = 1 - 0.022 * Math.exp(-t * 9) * A;
      cx = px;
      cy = py;
    }
    return { dx, dy, k, cx, cy, on: k !== 1 || dx !== 0 || dy !== 0 };
  }
  function applyJolt(ctx, J) {
    if (!J.on) return;
    ctx.translate(J.dx, J.dy);
    ctx.translate(J.cx, J.cy);
    ctx.scale(J.k, J.k);
    ctx.translate(-J.cx, -J.cy);
  }
  function chest(pose) {
    const o = PM_OFF[pose];
    return { x: CHAR_X + o[0], y: ROAD_Y + o[1] };
  }
  function dent(ctx, b) {
    const t = b - T_HIT;
    if (t < 0 || t > 1.6) return;
    const k = t < 1 ? 1 : 1 - (t - 1) / 0.6;
    const C = chest("stand"), fc = (FACE.x0 + FACE.x1) / 2;
    ctx.save();
    ctx.translate(C.x, C.y);
    ctx.rotate(PM_ROT);
    ctx.translate(fc, 0);
    ctx.scale(1.55, 1);
    const g = ctx.createRadialGradient(0, 0, 120, 0, 0, 230);
    g.addColorStop(0, rgba(NAVY2, 0));
    g.addColorStop(0.25, rgba(NAVY2, 0.16 * k));
    g.addColorStop(0.55, rgba(NAVY2, 0.05 * k));
    g.addColorStop(0.75, rgba("#ffffff", 0.14 * k));
    g.addColorStop(1, rgba("#ffffff", 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 232, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  function burst(ctx, b, t0, x, y, rot, s) {
    const t = b - t0;
    if (t < 0 || t > 0.4) return;
    const k = 1 - t / 0.4, fc = (FACE.x0 + FACE.x1) / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(s, s);
    ctx.translate(fc, 0);
    const R = rng("s15-burst", t0);
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU + R() * 0.2, r0 = 260 + t * 260, r1 = r0 + 50 + 40 * k;
      ctx.strokeStyle = i % 2 ? rgba(CORAL, k) : rgba(NAVY2, k);
      ctx.lineWidth = 9 * k + 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.55);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(POST_INK, 0.9 * k);
    for (let i = 0; i < 16; i++) {
      const a = R() * TAU, d = 200 + R() * 80 + t * (300 + R() * 300);
      ctx.beginPath();
      ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.5, 3 + R() * 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  function postageStamp() {
    const w = 128, h = 154, S = 2.2, pad = 8;
    return baked("s15-postage", (w + 2 * pad) * S, (h + 2 * pad) * S, (c) => {
      c.scale(S, S);
      c.translate(pad, pad);
      const pr = 5, step = 13;
      const edge = new Path2D();
      edge.rect(0, 0, w, h);
      c.fillStyle = "rgba(40,50,60,0.25)";
      c.fillRect(3, 4, w, h);
      c.fillStyle = PAPER9;
      c.fill(edge);
      c.globalCompositeOperation = "destination-out";
      for (let x = step / 2; x < w; x += step) for (const y of [0, h]) {
        c.beginPath();
        c.arc(x, y, pr, 0, TAU);
        c.fill();
      }
      for (let y = step / 2; y < h; y += step) for (const x of [0, w]) {
        c.beginPath();
        c.arc(x, y, pr, 0, TAU);
        c.fill();
      }
      c.globalCompositeOperation = "source-over";
      const ix = 13, iy = 13, iw = w - 26, ih = h - 26;
      c.save();
      c.beginPath();
      c.rect(ix, iy, iw, ih);
      c.clip();
      const g = c.createLinearGradient(0, iy, 0, iy + ih);
      g.addColorStop(0, "#f6c46a");
      g.addColorStop(0.6, "#f9e3a8");
      g.addColorStop(1, CREAM_L);
      c.fillStyle = g;
      c.fillRect(ix, iy, iw, ih);
      const sx = ix + iw * 0.55, sy = iy + ih * 0.58;
      c.fillStyle = rgba(ORANGE, 0.55);
      for (let k = 0; k < 16; k++) {
        const a = k / 16 * TAU;
        c.beginPath();
        c.moveTo(sx, sy);
        c.arc(sx, sy, 120, a, a + TAU / 32);
        c.closePath();
        c.fill();
      }
      c.fillStyle = CORAL;
      c.beginPath();
      c.arc(sx, sy, 22, 0, TAU);
      c.fill();
      c.fillStyle = ORANGE_D;
      c.beginPath();
      c.moveTo(ix, iy + ih);
      c.lineTo(ix, iy + ih * 0.72);
      c.lineTo(ix + 18, iy + ih * 0.7);
      c.lineTo(ix + 26, iy + ih * 0.78);
      c.lineTo(ix + 70, iy + ih * 0.8);
      c.lineTo(ix + iw, iy + ih * 0.76);
      c.lineTo(ix + iw, iy + ih);
      c.fill();
      c.fillStyle = "#3f8c78";
      c.fillRect(ix, iy + ih * 0.86, iw, ih * 0.14);
      c.strokeStyle = NAVY2;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(ix + 30, iy + ih * 0.9);
      c.quadraticCurveTo(ix + 26, iy + ih * 0.6, ix + 36, iy + ih * 0.36);
      c.stroke();
      c.fillStyle = NAVY2;
      for (const a of [-2.8, -2.2, -1.5, -0.9, -0.3]) {
        c.beginPath();
        c.ellipse(ix + 36 + Math.cos(a) * 16, iy + ih * 0.36 + Math.sin(a) * 9 + 6, 18, 4.5, a, 0, TAU);
        c.fill();
      }
      c.restore();
      c.strokeStyle = NAVY2;
      c.lineWidth = 1.6;
      c.strokeRect(ix, iy, iw, ih);
    });
  }
  function drawPostage(ctx, b) {
    if (b < T_STAMP - 0.35) return;
    const t = clamp((b - (T_STAMP - 0.35)) / 0.35);
    const e = ease.out(t);
    const x = lerp(STAMP_POS.x + 260, STAMP_POS.x, e), y = lerp(STAMP_POS.y - 220, STAMP_POS.y, e);
    const rot = lerp(0.9, STAMP_POS.rot, e);
    const slap = b >= T_STAMP ? 1 + 0.12 * Math.exp(-(b - T_STAMP) * 16) : 1 + 0.25 * (1 - t);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(slap, slap);
    ctx.drawImage(postageStamp(), -72, -85, 144, 170);
    ctx.restore();
  }
  function postcardOverlay() {
    const W2 = (X_MAX - X_MIN) * K, H2 = 1e3 * K;
    return baked("s15-overlay", W2, H2, (c) => {
      c.scale(K, K);
      c.translate(-X_MIN, 0);
      const ix0 = X_MIN + BORDER, iy0 = BORDER, iw = X_MAX - X_MIN - 2 * BORDER, ih = 1e3 - 2 * BORDER;
      c.fillStyle = rgba(PAPER9, 0.1);
      c.fillRect(ix0, iy0, iw, ih);
      c.fillStyle = c.createPattern(grainTile3(), "repeat");
      c.globalAlpha = 0.55;
      c.fillRect(ix0, iy0, iw, ih);
      c.globalAlpha = 1;
      for (const [cx, cy] of [[X_MIN, 0], [X_MAX, 0], [X_MIN, 1e3], [X_MAX, 1e3]]) {
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, 170);
        g.addColorStop(0, "rgba(176,132,70,0.26)");
        g.addColorStop(1, "rgba(176,132,70,0)");
        c.fillStyle = g;
        c.fillRect(cx - 170, cy - 170, 340, 340);
      }
      const p = new Path2D();
      p.rect(X_MIN - 10, -10, X_MAX - X_MIN + 20, 1020);
      rrPath(p, ix0, iy0, iw, ih, 4);
      c.fillStyle = PAPER9;
      c.fill(p, "evenodd");
      c.fillStyle = c.createPattern(grainTile3(), "repeat");
      c.fill(p, "evenodd");
      for (const [cx, cy] of [[X_MIN, 0], [X_MAX, 0], [X_MIN, 1e3], [X_MAX, 1e3]]) {
        c.save();
        c.clip(p, "evenodd");
        const g = c.createRadialGradient(cx, cy, 0, cx, cy, 90);
        g.addColorStop(0, "rgba(160,120,62,0.35)");
        g.addColorStop(1, "rgba(160,120,62,0)");
        c.fillStyle = g;
        c.fillRect(cx - 90, cy - 90, 180, 180);
        c.restore();
      }
      c.strokeStyle = "rgba(60,70,84,0.28)";
      c.lineWidth = 1.2;
      c.stroke(pathOf3((q) => rrPath(q, ix0, iy0, iw, ih, 4)));
      const R = rng("s15-wear");
      for (const [cx, cy, sx, sy] of [[ix0, iy0, 1, 1], [ix0 + iw, iy0, -1, 1], [ix0, iy0 + ih, 1, -1], [ix0 + iw, iy0 + ih, -1, -1]]) {
        for (let k = 0; k < 70; k++) {
          const d = Math.pow(R(), 2.2) * 60, a = R() * Math.PI / 2;
          const x = cx + sx * Math.cos(a) * d, y = cy + sy * Math.sin(a) * d;
          c.fillStyle = rgba(PAPER9, 0.5 + R() * 0.5);
          c.beginPath();
          c.ellipse(x, y, 0.6 + R() * 2.6, 0.5 + R() * 1.4, R() * 3, 0, TAU);
          c.fill();
        }
      }
      c.strokeStyle = "rgba(255,255,255,0.55)";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(X_MIN, 1e3 - 120);
      c.lineTo(X_MIN + 120, 1e3);
      c.stroke();
      c.strokeStyle = "rgba(80,70,60,0.18)";
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(X_MIN + 2, 1e3 - 124);
      c.lineTo(X_MIN + 124, 1002);
      c.stroke();
    });
  }
  var FIG_LINE = "#1f2d3d";
  registerStyle("s15-postcard", (I) => {
    const O = comicBase(I, { levels: 6, keep: 0.2, lw: 3.2, inner: 0.42, ink: FIG_LINE });
    const pal = [FIG_LINE, "#2f4c6e", "#56799e", "#9ab6cc", "#d9906e", "#f3c9a4", "#f6ecd6"].map(rgbf);
    const n = O.w * O.h, cls = new Int8Array(n).fill(-1);
    for (let i = 0; i < n; i++) {
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i);
      const skin = O.r[i] - O.b[i] > 0.07 && l > 0.22;
      cls[i] = l < 0.07 ? 0 : skin ? l < 0.5 ? 4 : 5 : l < 0.2 ? 1 : l < 0.42 ? 2 : l < 0.7 ? 3 : 6;
    }
    const DX = 2, DY = 1, paperC = rgbf(PAPER9);
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (cls[i] < 0) continue;
      let c;
      if (cls[i] === 0) c = pal[0];
      else {
        const j = Math.max(0, y - DY) * O.w + Math.max(0, x - DX);
        c = cls[j] > 0 ? pal[cls[j]] : cls[j] === 0 ? pal[cls[i]] : paperC;
        const cj = cls[j];
        if (cj === 1 || cj === 2 || cj === 4) {
          const u = (x + y) / 4.2, v = (x - y) / 4.2;
          const d = Math.hypot(u - Math.round(u), v - Math.round(v));
          if (d < (cj === 1 ? 0.36 : 0.28)) c = [c[0] * 0.78, c[1] * 0.8, c[2] * 0.84];
        }
      }
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
    }
    return O;
  });
  function airmailBorder(ctx, x, y, w, h, band) {
    ctx.save();
    const ring = new Path2D();
    ring.rect(x, y, w, h);
    ring.rect(x + band, y + band, w - 2 * band, h - 2 * band);
    ctx.clip(ring, "evenodd");
    ctx.fillStyle = PAPER9;
    ctx.fillRect(x, y, w, h);
    const cols = ["#d6453a", PAPER9, "#2f5f9a", PAPER9];
    const u = 15;
    for (let k = -Math.ceil(h / u) - 2, i = 0; k * u < w + h; k++, i++) {
      ctx.fillStyle = cols[(k % 4 + 4) % 4];
      ctx.beginPath();
      ctx.moveTo(x + k * u, y + h);
      ctx.lineTo(x + k * u + h, y);
      ctx.lineTo(x + (k + 1) * u + h, y);
      ctx.lineTo(x + (k + 1) * u, y + h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  function cardBg2(ctx, x, y, w, h) {
    ctx.save();
    ctx.shadowColor = "rgba(40,50,70,0.28)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = PAPER9;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
    airmailBorder(ctx, x, y, w, h, 14);
    ctx.save();
    ctx.fillStyle = CREAM_L;
    ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
    ctx.fillStyle = ctx.createPattern(grainTile3(), "repeat");
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = NAVY2;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 22, y + 22, w - 44, h - 44);
    ctx.strokeStyle = rgba(INK9, 0.5);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = CORAL;
    ctx.beginPath();
    starPath(ctx, x + w - 40, y + 44, 12);
    ctx.fill();
    ctx.restore();
  }
  function stampEdgePath(x, y, w, h, pr, step) {
    const p = new Path2D();
    const nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(h / step));
    const sx = w / nx, sy = h / ny;
    p.moveTo(x, y);
    for (let i = 0; i < nx; i++) {
      const cx = x + (i + 0.5) * sx;
      p.lineTo(cx - pr, y);
      p.arc(cx, y, pr, Math.PI, 0, true);
    }
    p.lineTo(x + w, y);
    for (let i = 0; i < ny; i++) {
      const cy = y + (i + 0.5) * sy;
      p.lineTo(x + w, cy - pr);
      p.arc(x + w, cy, pr, -Math.PI / 2, Math.PI / 2, true);
    }
    p.lineTo(x + w, y + h);
    for (let i = nx - 1; i >= 0; i--) {
      const cx = x + (i + 0.5) * sx;
      p.lineTo(cx + pr, y + h);
      p.arc(cx, y + h, pr, 0, Math.PI, true);
    }
    p.lineTo(x, y + h);
    for (let i = ny - 1; i >= 0; i--) {
      const cy = y + (i + 0.5) * sy;
      p.lineTo(x, cy + pr);
      p.arc(x, cy, pr, Math.PI / 2, -Math.PI / 2, true);
    }
    p.closePath();
    return p;
  }
  function songPlate(ctx, x, y, w, h) {
    ctx.save();
    const p = stampEdgePath(x, y, w, h, 5, 16);
    ctx.shadowColor = "rgba(40,50,70,0.25)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = PAPER9;
    ctx.fill(p);
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = 2.2;
    ctx.strokeRect(x + 11, y + 11, w - 22, h - 22);
    ctx.restore();
  }
  function postcardPhone(ctx, kind, cx, cy, s, spin, P2, gb) {
    const w = 120 * s, h = 220 * s;
    const sec = stationSection(15);
    const prog = clamp(0.06 + 0.88 * ((gb - sec.start) / sec.beats));
    ctx.save();
    ctx.translate(cx, cy);
    const body = rrP(-w / 2, -h / 2, w, h, 20 * s);
    ctx.save();
    ctx.translate(2 * s, 1.5 * s);
    ctx.fillStyle = MINT;
    ctx.fill(body);
    halftone(ctx, body, MINT_D, (x) => 0.15 + 0.4 * smoothstep(0, w / 2, x), [-w / 2, -h / 2, w, h], { step: 4.5 });
    ctx.restore();
    ctx.lineWidth = 2.6 * s;
    ctx.strokeStyle = INK9;
    ctx.stroke(body);
    ctx.shadowColor = "transparent";
    const scr = rrP(-w / 2 + 9 * s, -h / 2 + 22 * s, w - 18 * s, h - 46 * s, 10 * s);
    ctx.fillStyle = PAPER9;
    ctx.fill(scr);
    ctx.lineWidth = 1.8 * s;
    ctx.stroke(scr);
    ctx.fillStyle = INK9;
    ctx.fillRect(-14 * s, -h / 2 + 10 * s, 28 * s, 4 * s);
    ctx.beginPath();
    ctx.arc(0, h / 2 - 12 * s, 5 * s, 0, TAU);
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();
    ctx.save();
    ctx.clip(scr);
    const g = ctx.createLinearGradient(0, -h / 2 + 22 * s, 0, -h / 2 + 130 * s);
    g.addColorStop(0, SKY3);
    g.addColorStop(1, CREAM_L);
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2 + 22 * s, w, 108 * s);
    ctx.translate(0, -h / 2 + 76 * s);
    ctx.rotate(spin);
    ctx.fillStyle = rgba(ORANGE, 0.6);
    for (let k = 0; k < 12; k++) {
      const a = k / 12 * TAU;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 70 * s, a, a + TAU / 24);
      ctx.closePath();
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 36 * s, 0, TAU);
    ctx.fillStyle = CORAL;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = INK9;
    ctx.stroke();
    for (const r of [16, 23, 30]) {
      ctx.beginPath();
      ctx.arc(0, 0, r * s, 0, TAU);
      ctx.lineWidth = 1 * s;
      ctx.strokeStyle = rgba("#ffffff", 0.35);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 11 * s, 0, TAU);
    ctx.fillStyle = YEL3;
    ctx.fill();
    ctx.beginPath();
    starPath(ctx, 0, -25 * s, 6 * s);
    ctx.fillStyle = PAPER9;
    ctx.fill();
    ctx.restore();
    const by = h / 2 - 76 * s, bw = 84 * s;
    ctx.fillStyle = rgba(INK9, 0.22);
    ctx.fillRect(-bw / 2, by, bw, 5 * s);
    ctx.fillStyle = CORAL;
    ctx.fillRect(-bw / 2, by, bw * prog, 5 * s);
    ctx.beginPath();
    ctx.arc(-bw / 2 + bw * prog, by + 2.5 * s, 6 * s, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 1.4 * s;
    ctx.strokeStyle = INK9;
    ctx.stroke();
    ctx.fillStyle = NAVY2;
    const yb = h / 2 - 46 * s;
    ctx.beginPath();
    ctx.moveTo(-7 * s, yb - 11 * s);
    ctx.lineTo(11 * s, yb);
    ctx.lineTo(-7 * s, yb + 11 * s);
    ctx.closePath();
    ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 26 * s, yb - 7 * s);
      ctx.lineTo(sx * 36 * s, yb);
      ctx.lineTo(sx * 26 * s, yb + 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(sx * 37 * s - 1.5 * s, yb - 7 * s, 3 * s, 14 * s);
    }
    ctx.restore();
  }
  function postcardFrame(ctx, R) {
    const t = 64 * R.s, { x, y, w, h } = R;
    ctx.save();
    ctx.fillStyle = "rgba(40,50,70,0.16)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU);
    ctx.fill();
    const outer = stampEdgePath(x - t, y - t, w + 2 * t, h + 2 * t, t * 0.13, t * 0.42);
    outer.rect(x, y, w, h);
    ctx.shadowColor = "rgba(40,50,70,0.25)";
    ctx.shadowBlur = 12 * R.s;
    ctx.shadowOffsetY = 4 * R.s;
    ctx.fillStyle = PAPER9;
    ctx.fill(outer, "evenodd");
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = NAVY2;
    ctx.lineWidth = Math.max(1, 3 * R.s);
    ctx.strokeRect(x - 2 * R.s, y - 2 * R.s, w + 4 * R.s, h + 4 * R.s);
    ctx.setLineDash([14 * R.s, 9 * R.s]);
    ctx.strokeStyle = CORAL;
    ctx.lineWidth = Math.max(1, 3 * R.s);
    ctx.strokeRect(x - t * 0.5, y - t * 0.5, w + t, h + t);
    ctx.setLineDash([]);
    ctx.fillStyle = CORAL;
    for (const [sx, sy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) {
      ctx.beginPath();
      starPath(ctx, sx, sy, t * 0.28);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(POST_INK, 0.75);
    ctx.lineWidth = Math.max(1, 4 * R.s);
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const yy = y - t * 0.78 + k * t * 0.2, xa = x + w - t * 4.4, xb = x + w + t * 0.2;
      ctx.beginPath();
      for (let px = xa; px <= xb; px += 4) ctx.lineTo(px, yy + Math.sin((px - xa) / (t * 0.5) * TAU) * t * 0.05);
      ctx.stroke();
    }
    ctx.restore();
  }
  var s15 = {
    id: "s15",
    station: ST13,
    figureStyle: "s15-postcard",
    // 明信片人物外的一圈纸白（套印留边）：在浅天空和沙色原野前也稳稳拉开反差
    figureRim: { color: PAPER9, width: 4, alpha: 1 },
    freezeBeat: GAG + 3.9,
    // Outro 展墙：大邮戳在身上，邮票和两枚小邮戳都已盖好
    figureAdjust(b) {
      const J = jolt(b);
      if (!J.on) return null;
      return { dx: J.dx + (J.cx - CHAR_X) * (1 - J.k), dy: J.dy + (J.cy - ROAD_Y) * (1 - J.k), scale: J.k };
    },
    drawBack(ctx, b, env) {
      const cam = env.cam, cF = env.camAt(GAG);
      ctx.save();
      applyJolt(ctx, jolt(b));
      ctx.fillStyle = SKY_L;
      ctx.fillRect(X_MIN - 30, -30, X_MAX - X_MIN + 60, 1060);
      drawStrip(ctx, skyLayer7(), cam);
      drawStrip(ctx, cloudLayer3(), cam - b * 3 / P_CLOUD2);
      drawStrip(ctx, farLayer8(), cam);
      drawStrip(ctx, mesaLayer(), cam);
      drawStrip(ctx, plainLayer(), cam);
      drawStrip(ctx, poleLayer2(cF), cam);
      drawStrip(ctx, roadsideLayer(cF), cam);
      const sx = 1190 + cF - cam;
      if (sx > X_MIN - 200 && sx < X_MAX + 200) arrowSign(ctx, sx, b);
      drawStrip(ctx, roadLayer6(), cam);
      ctx.restore();
    },
    drawFigure(ctx, fig, b, env) {
      drawWalker(ctx, fig);
      if (b < T_LIFT2[0]) return;
      const pose = fig.pose === "stand" ? "stand" : "walk";
      const o = PM_OFF[pose];
      const a = 1 - 0.3 * smoothstep(GAG + 4, GAG + 8, b);
      ctx.save();
      if (fig.lean) ctx.rotate(fig.lean);
      drawMark(ctx, bigMark(), o[0], o[1], PM_ROT, 0.95 * a);
      ctx.restore();
    },
    drawFront(ctx, b, env) {
      const J = jolt(b);
      ctx.save();
      applyJolt(ctx, J);
      const c = carState(b, env);
      if (c) {
        exhaust(ctx, c, b);
        car(ctx, c.x, c.y, c.s, c.roll, c.wave);
      }
      if (b >= T_SHADOW && b < T_HIT) {
        const k = smoothstep(T_SHADOW, T_HIT, b), C2 = chest("stand"), fc = (FACE.x0 + FACE.x1) / 2;
        ctx.save();
        ctx.translate(C2.x, C2.y);
        ctx.rotate(PM_ROT);
        ctx.fillStyle = rgba(NAVY2, 0.28 * k);
        ctx.beginPath();
        ctx.ellipse(fc, 0, (FACE.x1 - FACE.x0) * (0.75 + 0.5 * (1 - k)) / 2, 90 * (0.75 + 0.5 * (1 - k)), 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      dent(ctx, b);
      drawPostage(ctx, b);
      if (b >= T_HIT2) drawMark(ctx, smallMark(0), SPOT_A.x, SPOT_A.y, SPOT_A.rot, 0.92);
      if (b >= T_HIT3) drawMark(ctx, smallMark(1), SPOT_B.x, SPOT_B.y, SPOT_B.rot, 0.92);
      const S = stampPose(b);
      if (S) rubberStamp(ctx, S.x, S.y, S.rot, S.s, S.squash);
      const C = chest("stand");
      burst(ctx, b, T_HIT, C.x, C.y, PM_ROT, 1);
      burst(ctx, b, T_HIT2, SPOT_A.x, SPOT_A.y, SPOT_A.rot, SMALL);
      burst(ctx, b, T_HIT3, SPOT_B.x, SPOT_B.y, SPOT_B.rot, SMALL);
      ctx.restore();
      ctx.drawImage(postcardOverlay(), X_MIN, 0, X_MAX - X_MIN, 1e3);
    },
    drawFrame(ctx, R) {
      postcardFrame(ctx, R);
    },
    cardStyle: { ink: NAVY2, accent: CORAL, bar: false, bgDraw: (ctx, x, y, w, h) => cardBg2(ctx, x, y, w, h) },
    playerStyle: {
      ink: NAVY2,
      noteColor: CORAL,
      backdrop: true,
      plateDraw: (ctx, x, y, w, h) => songPlate(ctx, x, y, w, h),
      drawPlayer: (ctx, kind, cx, cy, s, spin, P2, gb) => postcardPhone(ctx, kind, cx, cy, s, spin, P2, gb)
    }
  };

  // src/scenes/s16.js
  var s16 = placeholderScene(stationByN(16));

  // src/scenes/index.js
  var SCENES = { intro, s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s13, s14, s15, s16 };

  // src/main/walk.js
  var DOWNBEATS = sections.filter((s) => s.station).map((s) => s.start);
  var FREEZE = STATION.gag;
  var BOOST_FROM = -0.55;
  var BOOST_LEN = 0.8;
  var BOOST_AMP = 0.45;
  var RAMP = 0.2;
  var speed = 105;
  var table2 = null;
  var RES = 64;
  function setWalkSpeed(v) {
    speed = v;
    table2 = null;
  }
  function boost(gb) {
    for (const D of DOWNBEATS) {
      const x = gb - (D + BOOST_FROM);
      if (x >= 0 && x <= BOOST_LEN) return Math.sin(Math.PI * x / BOOST_LEN) ** 2;
    }
    return 0;
  }
  function pauseAmount(gb) {
    for (const D of DOWNBEATS) {
      const x = gb - D;
      if (x < FREEZE[0] - RAMP || x > FREEZE[1] + RAMP) continue;
      if (x < FREEZE[0]) return (x - (FREEZE[0] - RAMP)) / RAMP;
      if (x > FREEZE[1]) return 1 - (x - FREEZE[1]) / RAMP;
      return 1;
    }
    return 0;
  }
  var rate = (gb) => speed * (1 + BOOST_AMP * boost(gb)) * (1 - pauseAmount(gb));
  function build() {
    const n = Math.ceil((TOTAL_BEATS + 8) * RES);
    table2 = new Float64Array(n + 1);
    let acc2 = 0;
    for (let i = 0; i < n; i++) {
      table2[i] = acc2;
      acc2 += rate((i + 0.5) / RES) / RES;
    }
    table2[n] = acc2;
  }
  function dist(gb) {
    if (!table2) build();
    if (gb <= 0) return speed * gb;
    const x = gb * RES, i = Math.floor(x);
    if (i >= table2.length - 1) return table2[table2.length - 1] + speed * (gb - (table2.length - 1) / RES);
    return table2[i] + (table2[i + 1] - table2[i]) * (x - i);
  }

  // src/main/camera.js
  var PUSH_AMOUNT = 0.035;
  function pushAt(gb) {
    for (const D of DOWNBEATS) {
      const u = gb - D;
      if (u >= 0 && u < 1.4) {
        const t = clamp(u / 1.4);
        return t < 0.18 ? ease.out(t / 0.18) : 1 - ease.inOut((t - 0.18) / 0.82);
      }
    }
    return 0;
  }

  // src/main/figure.js
  var WALK_START = 8;
  function figureState(gb, env = {}) {
    const b = gb - (env.sec ? env.sec.start : 0);
    const frozen = !!(env.sec && env.sec.station && b >= FREEZE[0] && b < FREEZE[1]);
    return {
      pose: frozen ? "stand" : "walk",
      phase: Math.max(0, gb - WALK_START),
      // 循环内拍位：第 3 小节强拍起，偶数拍和奇数拍各落一只脚
      lean: 0.06 * boost(gb)
    };
  }

  // src/hud/titlecard.js
  var cardIn = (b, N = STATION.beats) => ease.out(clamp(b / 1.1)) * (1 - smoothstep(N - 0.75, N - 0.15, b));
  function drawTitleCard(ctx, st, b, style = {}) {
    const k = cardIn(b);
    if (k <= 1e-3) return;
    const S = {
      bg: st.palette[0],
      ink: readableOn(st.palette[0], st.palette[2]),
      accent: st.palette[3],
      border: readableOn(st.palette[0], st.palette[2], st.palette[1]),
      family: SERIF,
      enFamily: SERIF,
      radius: 6,
      opacity: 0.94,
      ...style
    };
    const zhPx = 60, enPx = Math.max(MIN_TEXT_PX, 36), yrPx = 36;
    ctx.save();
    font(ctx, zhPx, { family: S.family, weight: 700 });
    const wZh = ctx.measureText(st.albumZh).width;
    font(ctx, enPx, { family: S.enFamily, weight: 400, italic: true });
    const wEn = ctx.measureText(st.albumEn).width;
    const w = Math.max(wZh, wEn + 130) + 72;
    const h = 196;
    const x = 56 - (1 - k) * 60, y = 48;
    ctx.globalAlpha = k;
    if (S.bgDraw) {
      S.bgDraw(ctx, x, y, w, h, b);
    } else {
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, S.radius);
      ctx.fillStyle = rgba(S.bg, S.opacity);
      ctx.fill();
      ctx.shadowColor = "transparent";
      ctx.lineWidth = 3;
      ctx.strokeStyle = S.border;
      ctx.stroke();
    }
    ctx.fillStyle = S.accent;
    if (S.bar !== false) ctx.fillRect(x + 20, y + 26, 7, h - 52);
    ctx.fillStyle = S.ink;
    ctx.textBaseline = "alphabetic";
    font(ctx, zhPx, { family: S.family, weight: 700 });
    ctx.fillText(st.albumZh, x + 44, y + 86);
    font(ctx, enPx, { family: S.enFamily, weight: 400, italic: true });
    ctx.fillText(st.albumEn, x + 44, y + 140);
    font(ctx, yrPx, { family: SANS, weight: 700 });
    ctx.textAlign = "right";
    ctx.fillStyle = S.accent;
    ctx.fillText(String(st.year), x + w - 26, y + 140);
    ctx.restore();
  }

  // src/hud/players.js
  var playerIn = (b, N = STATION.beats) => ease.outBack(clamp((b - 0.5) / 1.1)) * (1 - smoothstep(N - 0.75, N - 0.15, b));
  var spinAt = (gb) => gb * (TAU / 4);
  function drawCassette(ctx, cx, cy, s, spin, P2) {
    const w = 200 * s, h = 128 * s;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
    ctx.fillStyle = P2.body;
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = P2.ink;
    ctx.stroke();
    roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 12 * s, w - 28 * s, 66 * s, 5 * s);
    ctx.fillStyle = P2.label;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P2.accent;
    ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 22 * s, w - 28 * s, 7 * s);
    roundRect(ctx, -52 * s, -h / 2 + 34 * s, 104 * s, 34 * s, 16 * s);
    ctx.fillStyle = P2.window;
    ctx.fill();
    ctx.stroke();
    for (const sx of [-1, 1]) {
      const rx = sx * 34 * s, ry = -h / 2 + 51 * s;
      circle(ctx, rx, ry, (sx < 0 ? 16 : 11) * s);
      ctx.fillStyle = P2.tape;
      ctx.fill();
      circle(ctx, rx, ry, 9 * s);
      ctx.fillStyle = P2.body;
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.fillStyle = P2.ink;
        ctx.fillRect(-1.4 * s, -8 * s, 2.8 * s, 4.5 * s);
      }
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(-60 * s, h / 2);
    ctx.lineTo(-48 * s, h / 2 - 30 * s);
    ctx.lineTo(48 * s, h / 2 - 30 * s);
    ctx.lineTo(60 * s, h / 2);
    ctx.stroke();
    for (const sx of [-1, 1]) {
      circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s);
      ctx.fillStyle = P2.ink;
      ctx.fill();
    }
    ctx.restore();
  }
  function drawCD(ctx, cx, cy, s, spin, P2) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    circle(ctx, 0, 0, r);
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      g.addColorStop(0, P2.disc);
      g.addColorStop(0.15, P2.shine1);
      g.addColorStop(0.3, P2.disc);
      g.addColorStop(0.55, P2.shine2);
      g.addColorStop(0.7, P2.disc);
      g.addColorStop(1, P2.disc);
      ctx.fillStyle = g;
    } else ctx.fillStyle = P2.disc;
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = P2.ink;
    ctx.stroke();
    circle(ctx, 0, 0, r * 0.62);
    ctx.lineWidth = 9 * s;
    ctx.strokeStyle = rgba(P2.accent, 0.8);
    ctx.stroke();
    ctx.fillStyle = P2.accent;
    ellipse(ctx, r * 0.78, 0, 7 * s, 4 * s);
    ctx.fill();
    circle(ctx, 0, 0, r * 0.26);
    ctx.fillStyle = P2.hub;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = P2.ink;
    ctx.stroke();
    circle(ctx, 0, 0, r * 0.1);
    ctx.fillStyle = P2.hole;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawPhone(ctx, cx, cy, s, spin, P2, progress = 0.3) {
    const w = 120 * s, h = 220 * s;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -w / 2, -h / 2, w, h, 18 * s);
    ctx.fillStyle = P2.ink;
    ctx.fill();
    roundRect(ctx, -w / 2 + 7 * s, -h / 2 + 7 * s, w - 14 * s, h - 14 * s, 13 * s);
    ctx.fillStyle = P2.screen;
    ctx.fill();
    ctx.save();
    ctx.translate(0, -h / 2 + 76 * s);
    ctx.rotate(spin);
    circle(ctx, 0, 0, 40 * s);
    ctx.fillStyle = P2.disc;
    ctx.fill();
    for (let i = 1; i < 4; i++) {
      circle(ctx, 0, 0, (14 + i * 7) * s);
      ctx.lineWidth = 1 * s;
      ctx.strokeStyle = rgba("#ffffff", 0.18);
      ctx.stroke();
    }
    circle(ctx, 0, 0, 13 * s);
    ctx.fillStyle = P2.accent;
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", 0.85);
    ctx.fillRect(-2 * s, -38 * s, 4 * s, 12 * s);
    ctx.restore();
    const by = h / 2 - 66 * s;
    roundRect(ctx, -44 * s, by, 88 * s, 5 * s, 2.5 * s);
    ctx.fillStyle = rgba(P2.fg, 0.25);
    ctx.fill();
    roundRect(ctx, -44 * s, by, 88 * s * progress, 5 * s, 2.5 * s);
    ctx.fillStyle = P2.accent;
    ctx.fill();
    circle(ctx, -44 * s + 88 * s * progress, by + 2.5 * s, 5 * s);
    ctx.fill();
    ctx.fillStyle = P2.fg;
    const yb = h / 2 - 34 * s;
    ctx.beginPath();
    ctx.moveTo(-6 * s, yb - 10 * s);
    ctx.lineTo(10 * s, yb);
    ctx.lineTo(-6 * s, yb + 10 * s);
    ctx.closePath();
    ctx.fill();
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * 26 * s, yb - 7 * s);
      ctx.lineTo(sx * 36 * s, yb);
      ctx.lineTo(sx * 26 * s, yb + 7 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(sx * 37 * s - 1.5 * s, yb - 7 * s, 3 * s, 14 * s);
    }
    ctx.restore();
  }
  function playerPalette(st) {
    const [bg, mid, ink, acc2] = st.palette;
    return {
      body: mix(bg, "#ffffff", 0.25),
      label: mix(bg, "#ffffff", 0.6),
      ink,
      accent: acc2,
      window: mix(ink, mid, 0.5),
      tape: mix(ink, "#5a3a2a", 0.5),
      disc: mix(mid, "#d8dde2", 0.6),
      shine1: "#f4f7ff",
      shine2: mix(acc2, "#ffffff", 0.5),
      hub: mix(bg, "#ffffff", 0.4),
      hole: bg,
      screen: mix(ink, "#202630", 0.6),
      fg: "#f2f2f2"
    };
  }
  function drawPlayerKind(ctx, kind, cx, cy, s, spin, P2, gb = 0) {
    if (kind === "cassette") drawCassette(ctx, cx, cy, s, spin, P2);
    else if (kind === "cd") drawCD(ctx, cx, cy, s, spin, P2);
    else drawPhone(ctx, cx, cy, s, spin, P2, 0.2 + gb / 64 % 0.7);
  }
  function drawPlayerHUD(ctx, st, b, gb, W2, H2, style = {}) {
    const k = playerIn(b);
    if (k <= 1e-3) return;
    const P2 = { ...playerPalette(st), ...style.palette || {} };
    const s = 1;
    const cx = W2 - 60 - (st.player === "phone" ? 60 : st.player === "cd" ? 80 : 100);
    const cy = H2 - 60 - (st.player === "phone" ? 110 : st.player === "cd" ? 80 : 64);
    ctx.save();
    ctx.globalAlpha = clamp(k);
    ctx.translate(cx, cy);
    ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
    ctx.translate(-cx, -cy);
    if (style.backdrop !== false) {
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;
    }
    if (style.drawPlayer) style.drawPlayer(ctx, st.player, cx, cy, s, spinAt(gb), P2, gb);
    else drawPlayerKind(ctx, st.player, cx, cy, s, spinAt(gb), P2, gb);
    ctx.shadowColor = "transparent";
    const px = 52;
    font(ctx, px, { family: style.family || SERIF, weight: 700 });
    const tw = ctx.measureText(st.song).width;
    const left = st.player === "phone" ? cx - 90 : st.player === "cd" ? cx - 110 : cx - 125;
    const ty = cy + 18;
    const plate2 = style.plate || st.palette[0];
    const ink = style.ink || readableOn(plate2, st.palette[2]);
    if (style.plateDraw) style.plateDraw(ctx, left - tw - 52, ty - 58, tw + 64, 80);
    else {
      roundRect(ctx, left - tw - 52, ty - 58, tw + 64, 80, 8);
      ctx.fillStyle = rgba(plate2, 0.9);
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = ink;
      ctx.stroke();
    }
    ctx.fillStyle = ink;
    ctx.textAlign = "right";
    ctx.fillText(st.song, left - 12, ty);
    ctx.fillStyle = style.noteColor || st.palette[3];
    circle(ctx, left - tw - 34, ty - 12, 5);
    ctx.fill();
    ctx.fillRect(left - tw - 30, ty - 38, 3, 26);
    ctx.restore();
  }

  // src/hud/subtitle.js
  function drawSubtitle(ctx, str, x, y, alpha, { px = 56, color = "#2a241d", family = SERIF, weight = 400, shadow = null } = {}) {
    if (alpha <= 1e-3) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    font(ctx, px, { family, weight });
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    if (shadow) {
      ctx.shadowColor = rgba(shadow, 0.6);
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // src/main/outro.js
  var OUTRO_LINES = ["2000\u20142026\uFF0C\u5341\u516D\u5F20\u4E13\u8F91\u3002", "\u4E0B\u4E00\u7AD9\uFF0C\u672A\u5B8C\u5F85\u7EED\u3002"];
  var COLS = 4;
  var ROWS3 = 4;
  var GAP = 16;
  var GRID_W = W * 0.85;
  var CELL_W = (GRID_W - GAP * (COLS - 1)) / COLS;
  var CELL_H = CELL_W * 9 / 16;
  var GRID_H = CELL_H * ROWS3 + GAP * (ROWS3 - 1);
  var LEFT = (W - GRID_W) / 2;
  var TOP = 34;
  var FREEZE_B = GAG + 1.5;
  var CACHE_SCALE = 2 / 3;
  function cellRect(n) {
    const i = n - 1, c = i % COLS, r = Math.floor(i / COLS);
    return { x: LEFT + c * (CELL_W + GAP), y: TOP + r * (CELL_H + GAP), w: CELL_W, h: CELL_H };
  }
  function freezeImage(n, gbFreeze) {
    return memo(`freeze|${n}|${gbFreeze.toFixed(4)}`, () => {
      const c = makeCanvas(W * CACHE_SCALE, H * CACHE_SCALE);
      const ctx = c.getContext("2d");
      ctx.scale(CACHE_SCALE, CACHE_SCALE);
      drawSection(ctx, stationSection(n), gbFreeze, { stand: true });
      return c;
    });
  }
  var liveCanvas = null;
  function drawOutro(ctx, gb) {
    const sec = sectionById.outro;
    const ob = gb - sec.start;
    const PULL = B(3, 1);
    const u = ease.inOut(clamp(ob / PULL));
    const r16 = cellRect(16);
    const S0 = W / r16.w;
    const s = Math.exp(lerp(Math.log(S0), 0, u));
    const w = (1 / s - 1 / S0) / (1 - 1 / S0);
    const c0 = [r16.x + r16.w / 2, r16.y + r16.h / 2];
    const cx = lerp(c0[0], W / 2, w), cy = lerp(c0[1], H / 2, w);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    const wall = paperTexture(W, H, { base: "#e4ddd0", seed: 21, amount: 0.8, fibers: 120 });
    ctx.drawImage(wall, -W * 2, -H * 2, W * 5, H * 5);
    for (const st of STATIONS) {
      const R = cellRect(st.n);
      const sx = (R.x - cx) * s + W / 2, sy = (R.y - cy) * s + H / 2;
      if (sx > W || sy > H || sx + R.w * s < 0 || sy + R.h * s < 0) continue;
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(R.x + 4, R.y + 6, R.w, R.h);
      ctx.fillStyle = "#2c2723";
      ctx.fillRect(R.x - 5, R.y - 5, R.w + 10, R.h + 10);
      let img;
      if (st.n === 16 && ob < PULL) {
        if (!liveCanvas) liveCanvas = makeCanvas(W, H);
        const lc = liveCanvas.getContext("2d");
        lc.setTransform(1, 0, 0, 1, 0, 0);
        drawSection(lc, stationSection(16), gb);
        img = liveCanvas;
      } else if (st.n === 16) {
        img = freezeImage(16, sec.start + PULL);
      } else {
        const sc = SCENES[stationSection(st.n).id];
        img = freezeImage(st.n, stationSection(st.n).start + (sc.freezeBeat ?? FREEZE_B));
      }
      ctx.drawImage(img, R.x, R.y, R.w, R.h);
      const STOP = B(5, 1);
      const spinGb = Math.min(gb, sec.start + STOP);
      const settle = ob > STOP ? 0.12 * Math.exp(-(ob - STOP) * 7) * Math.sin((ob - STOP) * 26) : 0;
      const ps = st.player === "phone" ? 0.3 : 0.36;
      const px = R.x + R.w - (st.player === "phone" ? 26 : 36), py = R.y + R.h - (st.player === "phone" ? 40 : 30);
      const appear = smoothstep(B(1, 3), B(2, 3), ob);
      if (appear > 0) {
        ctx.save();
        ctx.globalAlpha = appear;
        drawPlayerKind(ctx, st.player, px, py, ps, spinAt(spinGb) + settle, playerPalette(st), spinGb);
        ctx.restore();
      }
    }
    ctx.restore();
    const y = TOP + GRID_H + (H - TOP - GRID_H) / 2 + 18;
    const a1 = smoothstep(B(3, 1), B(3, 1) + 0.8, ob) * (1 - smoothstep(B(5, 4), B(6, 1), ob));
    const a2 = smoothstep(B(6, 1), B(6, 1) + 0.8, ob);
    drawSubtitle(ctx, OUTRO_LINES[0], W / 2, y, a1, { px: 50, color: "#2a241d" });
    drawSubtitle(ctx, OUTRO_LINES[1], W / 2, y, a2, { px: 50, color: "#2a241d", weight: 700 });
  }

  // src/main/film.js
  var CHAR_PX = OX + CHAR_X * K;
  var ROAD_PX = ROAD_Y * K;
  var LEAD4 = 2;
  var TAIL2 = 0.4;
  var sceneOf = (sec) => SCENES[sec.id];
  var renderFlags = { hideFigure: false };
  var camDist = (gb) => dist(Math.max(gb, WALK_START));
  function envFor(sec, gb, extra = {}) {
    const scene = sceneOf(sec);
    let b = gb - sec.start;
    if (scene.quantize) b = quantizeBeats(b, scene.quantize);
    const st = sec.station ? stationByN(sec.station) : null;
    return {
      sec,
      scene,
      st,
      gb,
      b,
      gbq: sec.start + b,
      cam: camDist(gb) - camDist(sec.start),
      // 镜头平移不量化
      /** 段内第 b 拍时镜头的位置（场景用来把布景放在梗发生时的画面位置上） */
      camAt: (bb) => camDist(sec.start + bb) - camDist(sec.start),
      /** 人物这一帧画在哪、什么姿势：{ x, y, scale, pose, ... }（前景层把东西挂到人物身上时用） */
      figure() {
        return figurePlacement(this);
      },
      ...extra
    };
  }
  function drawSceneLayers(ctx, env, { back = true, front = true } = {}) {
    const { scene, b } = env;
    ctx.save();
    applyUnits(ctx);
    guard(scene, () => {
      if (back) scene.drawBack(ctx, b, env);
      if (front && scene.drawFront) scene.drawFront(ctx, b, env);
    }, ctx);
    ctx.restore();
  }
  var reported = /* @__PURE__ */ new Set();
  function guard(scene, fn, ctx) {
    try {
      return fn();
    } catch (e) {
      if (!reported.has(scene.id)) {
        reported.add(scene.id);
        console.error(`[${scene.id}] \u6E32\u67D3\u51FA\u9519\uFF1A`, e && e.stack ? e.stack : e);
      }
      if (ctx) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "rgba(200,0,0,0.85)";
        ctx.fillRect(40, 300, 900, 90);
        ctx.fillStyle = "#fff";
        ctx.font = "40px sans-serif";
        ctx.fillText(`${scene.id} \u6E32\u67D3\u51FA\u9519\uFF1A${String(e && e.message).slice(0, 40)}`, 60, 360);
        ctx.restore();
      }
      return void 0;
    }
  }
  function drawFigureFor(ctx, env, { forceStand = false } = {}) {
    const { scene, b } = env;
    const fig = figurePlacement(env, { forceStand });
    if (fig.hidden || renderFlags.hideFigure) return;
    ctx.save();
    applyUnits(ctx);
    ctx.translate(fig.x, fig.y);
    if (fig.sx !== 1 || fig.scale !== 1) ctx.scale(fig.scale * fig.sx, fig.scale);
    if (fig.alpha !== void 0) ctx.globalAlpha = fig.alpha;
    guard(scene, () => scene.drawFigure ? scene.drawFigure(ctx, fig, b, env) : drawWalker(ctx, fig), ctx);
    ctx.restore();
  }
  function figurePlacement(env, { forceStand = false } = {}) {
    const { scene, sec, b } = env;
    const adj = scene.figureAdjust && scene.figureAdjust(b, env) || {};
    const st = figureState(env.gbq, env);
    forceStand = forceStand || !!env.forceStand;
    return {
      hidden: !!adj.hidden,
      x: CHAR_X + (adj.dx || 0),
      y: ROAD_Y + (adj.dy || 0),
      scale: adj.scale || 1,
      sx: adj.sx || 1,
      alpha: adj.alpha,
      pose: forceStand ? "stand" : adj.pose || st.pose,
      phase: st.phase,
      lean: st.lean + (adj.rotate || 0),
      style: adj.style || scene.figureStyle || (sec.station ? STATION_STYLE[sec.station] : "comic"),
      rim: adj.rim !== void 0 ? adj.rim : scene.figureRim || null
    };
  }
  function drawSection(ctx, sec, gb, { figure = true, stand = false } = {}) {
    const env = envFor(sec, gb, { forceStand: stand });
    drawSceneLayers(ctx, env, { front: false });
    if (figure) drawFigureFor(ctx, env, { forceStand: stand });
    drawSceneLayers(ctx, env, { back: false });
    return env;
  }
  function transitionAt(gb) {
    for (const s of sections) {
      if (!s.station) continue;
      const x = gb - s.start;
      if (x >= -LEAD4 && x < TAIL2) {
        const prev = sections[sections.indexOf(s) - 1];
        return { prev, next: s, x };
      }
    }
    return null;
  }
  function frameRect(x) {
    const lin2 = (t) => t;
    const E = keyframes([[-LEAD4, W + 90], [-0.5, CHAR_PX + 90, ease.inOut], [0, CHAR_PX, lin2], [TAIL2, 0, ease.out]], x);
    const s = keyframes([[-LEAD4, 0.36], [-0.5, 0.74, ease.inOut], [0, 0.9, lin2], [TAIL2, 1, ease.out]], x);
    return { E, s, x: E, y: ROAD_PX * (1 - s), w: W * s, h: H * s };
  }
  function zoomAbout(ctx, z, ax, ay) {
    ctx.translate(ax, ay);
    ctx.scale(z, z);
    ctx.translate(-ax, -ay);
  }
  function renderAt(ctx, t) {
    renderBeat(ctx, beatAt(t));
  }
  function renderBeat(ctx, gb) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (gb >= sectionById.outro.start) {
      drawOutro(ctx, gb);
      return;
    }
    const z = 1 + PUSH_AMOUNT * pushAt(gb);
    ctx.save();
    zoomAbout(ctx, z, CHAR_PX, ROAD_PX - 180 * K);
    const tr = transitionAt(gb);
    if (!tr) {
      drawSection(ctx, sectionAt(gb), gb);
    } else {
      drawTransition(ctx, tr, gb);
    }
    ctx.restore();
    drawHUD(ctx, gb);
  }
  function drawTransition(ctx, tr, gb) {
    const { prev, next, x } = tr;
    const R = frameRect(x);
    const envPrev = envFor(prev, gb);
    const envNext = envFor(next, gb);
    if (envPrev.scene.transitionOut) {
      const done = guard(envPrev.scene, () => envPrev.scene.transitionOut(ctx, {
        x,
        R,
        envPrev,
        envNext,
        gb,
        drawSceneLayers,
        drawFigureFor,
        drawDefaultFrame
      }), ctx);
      if (done) return;
    }
    drawSceneLayers(ctx, envPrev, { front: false });
    drawSceneLayers(ctx, envPrev, { back: false });
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.x, R.y, R.w, R.h);
    ctx.clip();
    ctx.translate(R.E, ROAD_PX * (1 - R.s));
    ctx.scale(R.s, R.s);
    drawSceneLayers(ctx, envNext);
    ctx.restore();
    const sc = envPrev.scene;
    if (sc.drawFrame) sc.drawFrame(ctx, R, envPrev);
    else drawDefaultFrame(ctx, R, R.s);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, Math.max(0, R.E), H);
    ctx.clip();
    drawFigureFor(ctx, envPrev);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(R.E, 0, W - R.E, H);
    ctx.clip();
    drawFigureFor(ctx, envNext);
    ctx.restore();
  }
  function drawHUD(ctx, gb) {
    for (const s of sections) {
      if (!s.station) continue;
      const b = gb - s.start;
      if (b < 0 || b > s.beats) continue;
      const st = stationByN(s.station);
      const scene = sceneOf(s);
      drawTitleCard(ctx, st, b, scene.cardStyle || {});
      drawPlayerHUD(ctx, st, b, gb, W, H, scene.playerStyle || {});
    }
  }

  // src/main/preview.js
  function setupPreview(p, canvas, ctx) {
    document.body.classList.add("preview");
    const stage = document.getElementById("stage");
    stage.appendChild(canvas);
    const $ = (id) => document.getElementById(id);
    const ui = {
      play: $("play"),
      seek: $("seek"),
      time: $("time"),
      beat: $("beat"),
      station: $("station"),
      prev: $("prev"),
      next: $("next"),
      audioName: $("audioName"),
      offset: $("offset"),
      bpm: $("bpm"),
      metro: $("metro"),
      drop: $("drop"),
      fps: $("fps")
    };
    const audio = new Audio();
    let hasAudio = false;
    let playing = false;
    let t = 0;
    let lastWall = 0;
    let audioStartOffset = 0;
    ui.offset.value = grid.firstDownbeat;
    ui.bpm.value = grid.bpm;
    ui.seek.max = duration();
    ui.seek.step = 1 / 60;
    const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(2).padStart(5, "0")}`;
    function sectionName(gb) {
      const sec = sectionAt(gb);
      if (sec.id === "intro") return "Intro";
      if (sec.id === "outro") return "Outro";
      const st = stationByN(sec.station);
      return `\u7B2C ${st.n} \u7AD9 \xB7 ${st.albumZh} \xB7\u300C${st.song}\u300D`;
    }
    let frames = 0, fpsT = performance.now();
    function draw() {
      renderAt(ctx, t);
      const gb = beatAt(t);
      ui.time.textContent = `${fmt(t)} / ${fmt(duration())}`;
      ui.beat.textContent = barBeatLabel(gb);
      ui.station.textContent = sectionName(gb);
      if (document.activeElement !== ui.seek) ui.seek.value = t;
      const frac = gb % 1;
      const strong = Math.floor(gb) % 4 === 0;
      ui.metro.style.opacity = gb > 0 ? String(Math.max(0.15, 1 - frac * 3)) : "0.15";
      ui.metro.style.background = strong ? "#ff4d4d" : "#ffd24d";
      frames++;
      const now = performance.now();
      if (now - fpsT > 1e3) {
        ui.fps.textContent = `${frames} fps`;
        frames = 0;
        fpsT = now;
      }
    }
    function tick(now) {
      if (playing) {
        if (hasAudio) t = audio.currentTime + audioStartOffset;
        else t += (now - lastWall) / 1e3;
        lastWall = now;
        if (t >= duration()) {
          t = duration();
          setPlaying(false);
        }
        draw();
      }
      requestAnimationFrame(tick);
    }
    function setPlaying(v) {
      playing = v;
      ui.play.textContent = v ? "\u275A\u275A \u6682\u505C" : "\u25B6 \u64AD\u653E";
      lastWall = performance.now();
      if (hasAudio) {
        if (v) {
          audio.currentTime = Math.max(0, t - audioStartOffset);
          audio.play();
        } else audio.pause();
      }
    }
    function seek(nt) {
      t = Math.min(Math.max(0, nt), duration());
      if (hasAudio) audio.currentTime = Math.max(0, t - audioStartOffset);
      draw();
    }
    ui.play.onclick = () => setPlaying(!playing);
    ui.seek.oninput = () => seek(parseFloat(ui.seek.value));
    ui.prev.onclick = () => seek(t - 1 / 30);
    ui.next.onclick = () => seek(t + 1 / 30);
    ui.offset.onchange = () => {
      setGrid({ firstDownbeat: parseFloat(ui.offset.value) });
      ui.seek.max = duration();
      draw();
    };
    ui.bpm.onchange = () => {
      setGrid({ bpm: parseFloat(ui.bpm.value) });
      ui.seek.max = duration();
      draw();
    };
    document.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" && e.target.type !== "range") return;
      if (e.code === "Space") {
        e.preventDefault();
        setPlaying(!playing);
      }
      if (e.code === "ArrowLeft") seek(t - (e.shiftKey ? 1 : 1 / 30));
      if (e.code === "ArrowRight") seek(t + (e.shiftKey ? 1 : 1 / 30));
    });
    const loadAudio = (file) => {
      if (!file || !file.type.startsWith("audio")) return;
      audio.src = URL.createObjectURL(file);
      hasAudio = true;
      ui.audioName.textContent = `\u266A ${file.name}\uFF08\u53EA\u5728\u672C\u9875\u64AD\u653E\uFF0C\u4E0D\u4FDD\u5B58\uFF09`;
      setPlaying(false);
      seek(0);
    };
    window.addEventListener("dragover", (e) => {
      e.preventDefault();
      ui.drop.classList.add("on");
    });
    window.addEventListener("dragleave", () => ui.drop.classList.remove("on"));
    window.addEventListener("drop", (e) => {
      e.preventDefault();
      ui.drop.classList.remove("on");
      loadAudio(e.dataTransfer.files[0]);
    });
    $("audioFile").onchange = (e) => loadAudio(e.target.files[0]);
    $("resetGrid").onclick = () => {
      setGrid({ bpm: BPM, firstDownbeat: FIRST_DOWNBEAT });
      ui.offset.value = FIRST_DOWNBEAT;
      ui.bpm.value = BPM;
      draw();
    };
    draw();
    requestAnimationFrame(tick);
  }

  // src/main/sheets.js
  function contactSheet(ctx, canvas, { items, cols = 6, cellW = 400, title = "" }) {
    const cellH = Math.round(cellW * 9 / 16), labelH = 34, pad = 10, titleH = title ? 56 : 0;
    const rows = Math.ceil(items.length / cols);
    const sheet = makeCanvas(cols * (cellW + pad) + pad, titleH + rows * (cellH + labelH + pad) + pad);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#1a1a1a";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    if (title) {
      font(sc, 32, { family: SANS, weight: 700 });
      sc.fillStyle = "#eee";
      sc.fillText(title, pad + 4, 40);
    }
    items.forEach((it, i) => {
      if (it.beat !== void 0) renderBeat(ctx, it.beat);
      else renderAt(ctx, it.t);
      const x = pad + i % cols * (cellW + pad), y = titleH + pad + Math.floor(i / cols) * (cellH + labelH + pad);
      sc.imageSmoothingQuality = "high";
      sc.drawImage(canvas, x, y, cellW, cellH);
      font(sc, 22, { family: SANS, weight: 400 });
      sc.fillStyle = "#ddd";
      sc.fillText(it.label || "", x + 2, y + cellH + 25);
    });
    return sheet;
  }
  function styleCheck({ cell = 300, frame = 0 } = {}) {
    const W0 = activeWalk();
    const cols = 4, rows = 4, pad = 8, refW = 380, top = 64, ch = Math.round(cell * 1.25);
    const sheet = makeCanvas(refW + pad + cols * (cell + pad) + pad, top + rows * (ch + pad) + 44);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#202020";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    font(sc, 28, { family: SANS, weight: 700 });
    sc.fillStyle = "#eee";
    sc.fillText(`\u4EBA\u7269 \xD7 16 \u79CD\u753B\u98CE \xB7 \u7D20\u6750\uFF1A${W0 ? W0.meta.source : "\u65E0"} \xB7 \u6BCF\u683C\u5DE6\u4E3A\u8D70\u8DEF\u5E27\u3001\u53F3\u4E3A\u7AD9\u7ACB\u5E27`, 16, 42);
    const draw = (x, y, w, h, bg, style, label) => {
      sc.fillStyle = bg;
      sc.fillRect(x, y, w, h);
      sc.save();
      sc.beginPath();
      sc.rect(x, y, w, h);
      sc.clip();
      const k = Math.min(h, w * 1.25) * 0.9 / FIGURE_H;
      for (const [dx, pose] of [[0.3, "walk"], [0.72, "stand"]]) {
        sc.save();
        sc.translate(x + w * dx, y + (h + Math.min(h, w * 1.25)) / 2 - 10);
        sc.scale(k, k);
        drawWalker(sc, { pose, frame, style });
        sc.restore();
      }
      sc.restore();
      font(sc, 18, { family: SANS, weight: 700 });
      sc.fillStyle = "rgba(0,0,0,0.55)";
      sc.fillRect(x, y, w, 30);
      sc.fillStyle = "#fff";
      sc.fillText(label, x + 8, y + 22);
    };
    draw(pad, top, refW - pad, rows * (ch + pad) - pad, "#f3efe6", "none", "\u539F\u6837\uFF08\u62A0\u50CF\u540E\uFF09");
    STATIONS.forEach((st, i) => {
      const x = refW + pad + i % cols * (cell + pad), y = top + Math.floor(i / cols) * (ch + pad);
      const style = STATION_STYLE[st.n];
      draw(x, y, cell, ch, st.palette[0], style, `${st.n} ${STYLE_LABEL[style]}`);
    });
    font(sc, 18, { family: SANS, weight: 400 });
    sc.fillStyle = "#aaa";
    sc.fillText("\u6240\u6709\u7AD9\u5148\u7EDF\u4E00\u505A\u4E00\u5C42\u6F2B\u753B\u5316\uFF08\u5E73\u6ED1 + \u8272\u5757\u7B80\u5316 + \u63CF\u8FB9\uFF09\uFF0C\u518D\u53E0\u52A0\u5404\u7AD9\u5904\u7406\uFF1B\u7B2C 16 \u7AD9\u4FDD\u7559\u66F4\u591A\u539F\u8C8C\u3002\u5404\u7AD9\u6B63\u5F0F\u573A\u666F\u505A\u597D\u540E\u518D\u7EC6\u8C03\u3002", 16, sheet.height - 14);
    return sheet;
  }
  function walkSheet({ style = "none", cols = 10, scale = 0.62 } = {}) {
    const W0 = activeWalk();
    const P2 = W0.meta.frames, rows = Math.ceil(P2 / cols);
    const cw = 190, chh = Math.round(FIGURE_H * scale) + 70;
    const sheet = makeCanvas(cols * cw + 20, rows * chh + 60);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#f3efe6";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    font(sc, 24, { family: SANS, weight: 700 });
    sc.fillStyle = "#333";
    sc.fillText(`\u8D70\u8DEF\u5FAA\u73AF \xB7 ${W0.meta.source} \xB7 ${P2} \u5E27 = 2 \u62CD \xB7 \u2605 = \u843D\u5728\u62CD\u4E0A\u7684\u811A\u8DDF\u7740\u5730\u5E27\uFF08\u7B2C ${W0.meta.strikes.join("\u3001")} \u5E27\uFF09`, 12, 34);
    for (let i = 0; i < P2; i++) {
      const x0 = 10 + i % cols * cw + cw / 2, y0 = 60 + Math.floor(i / cols) * chh + chh - 40;
      sc.strokeStyle = "#999";
      sc.lineWidth = 2;
      sc.beginPath();
      sc.moveTo(x0 - cw / 2 + 6, y0);
      sc.lineTo(x0 + cw / 2 - 6, y0);
      sc.stroke();
      sc.save();
      sc.translate(x0, y0);
      sc.scale(scale, scale);
      drawWalker(sc, { frame: i, style });
      sc.restore();
      font(sc, 18, { family: SANS, weight: 400 });
      sc.fillStyle = W0.meta.strikes.includes(i) ? "#c0392b" : "#555";
      sc.fillText(`${W0.meta.strikes.includes(i) ? "\u2605 " : ""}${i}`, x0 - cw / 2 + 8, y0 + 26);
    }
    return sheet;
  }

  // src/main/entry.js
  var params = new URLSearchParams(location.search);
  var RENDER = params.has("render");
  function canvasToB64(canvas) {
    return canvas.toDataURL("image/png").split(",")[1];
  }
  new window.p5((p) => {
    p.setup = async () => {
      const cnv = p.createCanvas(W, H);
      p.pixelDensity(1);
      p.noLoop();
      const ctx = p.drawingContext;
      const canvas = cnv.elt;
      const nFonts = await loadEmbeddedFonts();
      await loadWalkSets();
      setWalkSpeed(useWalkSet(params.get("walk") || void 0));
      if (params.has("bpm")) setGrid({ bpm: parseFloat(params.get("bpm")) });
      if (params.has("offset")) setGrid({ firstDownbeat: parseFloat(params.get("offset")) });
      window.__film = {
        ready: true,
        W,
        H,
        info: () => ({
          duration: duration(),
          totalBeats: TOTAL_BEATS,
          bpm: grid.bpm,
          firstDownbeat: grid.firstDownbeat,
          sections: sections.map((s) => ({ ...s, t0: timeAtBeat(s.start), t1: timeAtBeat(s.end) })),
          stations: STATIONS,
          fonts: nFonts,
          walkSets: walkSetNames(),
          walk: activeWalk() && activeWalk().meta
        }),
        renderAt: (t) => renderAt(ctx, t),
        renderBeat: (gb) => renderBeat(ctx, gb),
        capture: (t, o = {}) => {
          if (o.beat !== void 0) renderBeat(ctx, o.beat);
          else renderAt(ctx, t);
          return canvasToB64(canvas);
        },
        contact: (o) => canvasToB64(contactSheet(ctx, canvas, o)),
        styleCheck: (o) => canvasToB64(styleCheck(o)),
        walkSheet: (o) => canvasToB64(walkSheet(o)),
        analyze: (beat) => analyzeFrame(ctx, canvas, beat),
        beatAt,
        timeAtBeat,
        setGrid
      };
      if (!RENDER) setupPreview(p, canvas, ctx);
      else renderAt(ctx, 0);
    };
  });
  var lin = (v) => v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  function analyzeFrame(ctx, canvas, beat) {
    const SW = 960, SH = 540;
    const small = document.createElement("canvas");
    small.width = SW;
    small.height = SH;
    const sc = small.getContext("2d", { willReadFrequently: true });
    renderBeat(ctx, beat);
    const png = canvas.toDataURL("image/png").split(",")[1];
    sc.drawImage(canvas, 0, 0, SW, SH);
    const A = sc.getImageData(0, 0, SW, SH).data;
    renderFlags.hideFigure = true;
    renderBeat(ctx, beat);
    renderFlags.hideFigure = false;
    sc.drawImage(canvas, 0, 0, SW, SH);
    const Bd = sc.getImageData(0, 0, SW, SH).data;
    const n = SW * SH;
    const Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const L = (d, i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255);
    let sum = 0;
    const mask = new Uint8Array(n);
    for (let p = 0; p < n; p++) {
      const i = p * 4;
      sum += Y(A, i);
      if (Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2]) > 30) mask[p] = 1;
    }
    const R = 12, ring = new Uint8Array(n);
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
      if (!mask[y * SW + x]) continue;
      for (let dy = -R; dy <= R; dy += 4) for (let dx = -R; dx <= R; dx += 4) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < SW && yy < SH) ring[yy * SW + xx] = 1;
      }
    }
    const LA = new Float32Array(n);
    for (let p = 0; p < n; p++) LA[p] = L(A, p * 4);
    const ratios = [];
    for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
      const p = y * SW + x;
      if (!mask[p] || mask[p - 1] && mask[p + 1] && mask[p - SW] && mask[p + SW]) continue;
      let os = 0, on = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
        const q = yy * SW + xx;
        if (!mask[q]) {
          os += LA[q];
          on++;
        }
      }
      if (!on) continue;
      const ol = os / on;
      let best = 1;
      for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
        const q = yy * SW + xx;
        if (!mask[q]) continue;
        const il = LA[q];
        best = Math.max(best, (Math.max(il, ol) + 0.05) / (Math.min(il, ol) + 0.05));
      }
      ratios.push(best);
    }
    ratios.sort((u, v) => u - v);
    const edge = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
    const weak = ratios.length ? ratios.filter((r) => r < 1.5).length / ratios.length : null;
    let fs = 0, fn = 0, bs = 0, bn = 0;
    for (let p = 0; p < n; p++) {
      if (mask[p]) {
        fs += L(A, p * 4);
        fn++;
      }
      if (ring[p]) {
        bs += L(Bd, p * 4);
        bn++;
      }
    }
    const fl = fn ? fs / fn : 0, bl = bn ? bs / bn : 0;
    const contrast = (Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05);
    return { mean: sum / n / 255, figurePx: fn, figureL: fl, backL: bl, contrast, edge, weak, png };
  }
})();
