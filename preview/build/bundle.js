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
  var WALK_SPEED = 105;
  function applyUnits(ctx) {
    ctx.translate(OX, 0);
    ctx.scale(K, K);
  }

  // src/beat/config.js
  var BPM = 127;
  var FIRST_DOWNBEAT = 0;
  var BEATS_PER_BAR = 4;
  var SECTIONS = [
    { id: "intro", bars: 3 },
    ...Array.from({ length: 16 }, (_, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, bars: 2, station: i + 1 })),
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

  // src/data/stations.js
  var raw = [
    [2e3, "Jay", "Jay", "\u53EF\u7231\u5973\u4EBA", "\u9752\u6625\u8857\u89D2", "\u6F2B\u753B\u7F51\u70B9\u5206\u955C", "\u4ED6\u4E00\u56DE\u5934\uFF0C\u80CC\u666F\u77AC\u95F4\u94FA\u6EE1\u5C11\u5973\u6F2B\u753B\u95EA\u5149\u82B1\u6735\uFF0C\u4E0B\u4E00\u62CD\u590D\u539F", ["#f4efe4", "#c9c2b4", "#26232a", "#e8467c"]],
    [2001, "\u8303\u7279\u897F", "Fantasy", "\u7231\u5728\u897F\u5143\u524D", "\u53E4\u5DF4\u6BD4\u4F26\u57CE\u5899", "\u4E24\u6CB3\u6D41\u57DF\u6D6E\u96D5", "\u6D6E\u96D5\u91CC\u4EBA\u4EBA\u4FA7\u8EAB\u884C\u8FDB\uFF0C\u4ED6\u4E5F\u88AB\u8FEB\u4FA7\u7740\u8EAB\u5B50\u8D70", ["#e7d3a8", "#c49a5c", "#4a3320", "#2f6fb0"]],
    [2002, "\u516B\u5EA6\u7A7A\u95F4", "The Eight Dimensions", "\u7237\u7237\u6CE1\u7684\u8336", "\u5C71\u95F4\u8336\u68DA", "\u6C34\u58A8", "\u8001\u4EBA\u659F\u8336\uFF0C\u8336\u6C34\u5012\u6210\u4E00\u9053\u58A8\u7EBF\u4E00\u8DEF\u6D41\u5230\u8DEF\u4E0A\uFF0C\u4ED6\u8E29\u7740\u58A8\u7EBF\u8D70", ["#f2eee3", "#a9a69c", "#1d1d1b", "#7a8c5a"]],
    [2003, "\u53F6\u60E0\u7F8E", "Ye Hui Mei", "\u4EE5\u7236\u4E4B\u540D", "\u54E5\u7279\u6559\u5802", "\u5F69\u8272\u73BB\u7483", "\u4ED6\u8D70\u8FDB\u7A97\u683C\uFF0C\u88AB\u94C5\u6761\u5207\u6210\u4E00\u5757\u5757\u5F69\u8272\u73BB\u7483\uFF0C\u5F3A\u62CD\u4E0A\u4E00\u675F\u5149\u6253\u4E0B", ["#1c2140", "#3b5fa8", "#0c0d14", "#d9a73a"]],
    [2004, "\u4E03\u91CC\u9999", "Common Jasmine Orange", "\u6B62\u6218\u4E4B\u6B87", "\u785D\u70DF\u91CC\u7684\u767D\u9E3D", "\u9ED1\u767D\u6728\u523B\u7248\u753B", "\u4E00\u53EA\u767D\u9E3D\u843D\u5728\u4ED6\u80A9\u4E0A\uFF0C\u662F\u6574\u5E45\u753B\u91CC\u552F\u4E00\u7684\u767D", ["#5b5852", "#2c2a27", "#0e0d0c", "#f6f4ee"]],
    [2005, "\u5341\u4E00\u6708\u7684\u8427\u90A6", "November's Chopin", "\u591C\u66F2", "\u6708\u591C\u91CC\u7684\u4E00\u67B6\u94A2\u7434", "\u9ED1\u767D\u94A2\u7B14\u753B", "\u7434\u76D6\u4E0A\u7684\u4E4C\u9E26\u6392\u6210\u4E00\u884C\u97F3\u7B26\uFF0C\u5F3A\u62CD\u4E0A\u540C\u65F6\u626D\u5934", ["#f3f1ea", "#9b9890", "#151515", "#6c7a96"]],
    [2006, "\u4F9D\u7136\u8303\u7279\u897F", "Still Fantasy", "\u591C\u7684\u7B2C\u4E03\u7AE0", "\u7EF4\u591A\u5229\u4E9A\u96FE\u591C\uFF0C\u4FA6\u63A2", "\u94DC\u7248\u753B", "\u4E00\u53EA\u653E\u5927\u955C\u4ECE\u753B\u5916\u4F38\u8FDB\u6765\uFF0C\u5BF9\u51C6\u4ED6\u7684\u7EA2\u8033\u673A", ["#d8cdb4", "#8a7b62", "#2a2219", "#7d5a36"]],
    [2007, "\u6211\u5F88\u5FD9", "On the Run!", "\u6700\u957F\u7684\u7535\u5F71", "\u8001\u7535\u5F71\u9662", "\u80F6\u7247\u5212\u75D5 + 4:3 \u753B\u5E45", "\u753B\u5E45\u7A81\u7136\u7F29\u6210 4:3\uFF0C\u4ED6\u8D70\u5728\u94F6\u5E55\u91CC\uFF0C\u524D\u6392\u89C2\u4F17\u526A\u5F71\u4E00\u8D77\u626D\u5934", ["#2a2622", "#8f8576", "#0d0c0b", "#e8d9b0"]],
    [2008, "\u9B54\u6770\u5EA7", "Capricorn", "\u4E54\u514B\u53D4\u53D4", "\u9A6C\u620F\u56E2\u5C0F\u4E11", "19 \u4E16\u7EAA\u77F3\u7248\u753B\u6D77\u62A5", "\u5C0F\u4E11\u9012\u6765\u4E00\u53EA\u6C14\u7403\uFF0C\u4ED6\u88AB\u5E26\u5F97\u98D8\u8D77\u534A\u62CD\uFF0C\u5F3A\u62CD\u843D\u56DE", ["#efe0bf", "#d0533c", "#2b2a3a", "#2f7d6d"]],
    [2010, "\u8DE8\u65F6\u4EE3", "The Era", "\u96E8\u4E0B\u4E00\u6574\u665A", "\u57CE\u5E02\u591C\u96E8", "\u6C34\u5F69\u6655\u67D3", "\u96E8\u6C34\u628A\u989C\u6599\u6655\u5F00\uFF0C\u8FDE\u4ED6\u7684\u4F1E\u90FD\u5316\u6210\u4E00\u6EE9\u989C\u8272\uFF0C\u4E0B\u4E00\u62CD\u6536\u56DE", ["#e9eef2", "#7f9bb5", "#27364a", "#e0a24f"]],
    [2011, "\u60CA\u53F9\u53F7", "Exclamation Point", "\u8FF7\u9B42\u66F2", "\u4E2D\u56FD\u53E4\u4EE3\u76AE\u5F71\u620F", "\u76AE\u5F71", "\u6CB9\u706F\u4E00\u6643\uFF0C\u76AE\u5F71\u4E00\u5206\u4E3A\u4E09\uFF0C\u5F3A\u62CD\u4E0A\u5408\u56DE\u4E00\u4E2A", ["#f0c77a", "#c46a2c", "#3a1d10", "#b8322a"]],
    [2012, "\u5341\u4E8C\u65B0\u4F5C", "Opus 12", "\u7EA2\u5C18\u5BA2\u6808", "\u6B66\u4FA0\u5BA2\u6808", "\u6728\u7248\u5E74\u753B", "\u5E97\u5C0F\u4E8C\u628A\u4ED6\u5F53\u6210\u5927\u4FA0\uFF0C\u62B1\u62F3\u4F5C\u63D6", ["#f1e3c4", "#d4a02f", "#2d1f18", "#c23b2b"]],
    [2014, "\u54CE\u5466\uFF0C\u4E0D\u9519\u54E6", "Aiyo, Not Bad", "\u978B\u5B50\u7279\u5927\u53F7", "\u8721\u7B14\u753B\u7684\u5C0F\u9547", "\u513F\u7AE5\u8721\u7B14\u753B", "\u6BD4\u4F8B\u5168\u9519\uFF0C\u978B\u5B50\u753B\u5F97\u7279\u522B\u5927\uFF0C\u4E00\u6B65\u8DE8\u8FC7\u534A\u4E2A\u753B\u9762", ["#fbf7ec", "#8cc06a", "#3a3a8c", "#f2a33a"]],
    [2016, "\u5468\u6770\u4F26\u7684\u5E8A\u8FB9\u6545\u4E8B", "Bedtime Stories", "\u524D\u4E16\u60C5\u4EBA", "\u6E29\u99A8\u7684\u7236\u5973\u573A\u666F", "\u7AE5\u4E66\u7ED8\u672C\u6C34\u5F69", "\u5C0F\u5973\u5B69\u8E2E\u811A\u7ED9\u4ED6\u6234\u4E0A\u4E00\u9876\u7EB8\u7687\u51A0", ["#fbf1e4", "#e6b8a2", "#5a4a5e", "#e8c25a"]],
    [2022, "\u6700\u4F1F\u5927\u7684\u4F5C\u54C1", "Greatest Works of Art", "\u8FD8\u5728\u6D41\u6D6A", "\u516C\u8DEF\u65C5\u884C", "\u590D\u53E4\u660E\u4FE1\u7247", "\u4E00\u4E2A\u90AE\u6233\u300C\u556A\u300D\u5730\u76D6\u5728\u4ED6\u8EAB\u4E0A\uFF0C\u65E5\u671F 2022", ["#f0e2c4", "#5aa0b4", "#3a2c24", "#d6643a"]],
    [2026, "\u592A\u9633\u4E4B\u5B50", "Children of the Sun", "\u90A3\u5929\u4E0B\u96E8\u4E86", "\u96E8\u591C\u516C\u4EA4\u7AD9\u53F0\uFF0C\u4E00\u7537\u4E00\u5973\u5404\u6253\u4E00\u628A\u4F1E", "\u7535\u5F71\u611F\u539A\u6D82\u63D2\u753B\uFF0C\u8DEF\u706F\u6696\u5149\u5BF9\u51B7\u96E8", "\u516C\u4EA4\u8F66\u9A76\u8FC7\u6E85\u8D77\u6C34\u82B1\uFF0C\u4E24\u628A\u4F1E\u5728\u5F3A\u62CD\u4E0A\u540C\u65F6\u4E00\u6B6A", ["#1b2230", "#3d5670", "#0a0e15", "#f0b25a"]]
  ];
  var STATIONS = raw.map(([year, albumZh, albumEn, song, scene, style, gag, palette], i) => {
    const n = i + 1;
    return {
      n,
      id: `s${String(n).padStart(2, "0")}`,
      year,
      albumZh,
      albumEn,
      enChecked: false,
      song,
      scene,
      style,
      gag,
      palette,
      player: n <= 5 ? "cassette" : n <= 12 ? "cd" : "phone"
    };
  });
  var stationByN = (n) => STATIONS[n - 1];

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
  var HEADPHONE_RED = "#d8262e";
  var readableOn = (bg, dark, light = "#f4efe4") => luminance(bg) < 0.42 ? light : dark;

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
    const P = (i) => close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
    ctx.moveTo(pts[0][0], pts[0][1]);
    const segs = close ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
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
  function capsule(ctx, a, b, ra, rb = ra) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / L, ny = dx / L;
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra);
    ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb);
    ctx.arc(b[0], b[1], rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra);
    ctx.arc(a[0], a[1], ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
    ctx.closePath();
  }
  function tube(ctx, pts, radii) {
    const n = pts.length;
    const L = [], R = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      dx /= len;
      dy /= len;
      let r = radii[i];
      if (i > 0 && i < n - 1) {
        const d1 = [pts[i][0] - a[0], pts[i][1] - a[1]], d2 = [b[0] - pts[i][0], b[1] - pts[i][1]];
        const c = (d1[0] * d2[0] + d1[1] * d2[1]) / (Math.hypot(...d1) * Math.hypot(...d2) || 1);
        r /= Math.max(0.6, Math.sqrt((1 + c) / 2));
      }
      L.push([pts[i][0] - dy * r, pts[i][1] + dx * r]);
      R.push([pts[i][0] + dy * r, pts[i][1] - dx * r]);
    }
    const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
    ctx.beginPath();
    ctx.moveTo(L[0][0], L[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
    const e = n - 1, ae = ang(pts[e - 1], pts[e]);
    ctx.arc(pts[e][0], pts[e][1], radii[e], ae + Math.PI / 2, ae - Math.PI / 2, true);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    const a0 = ang(pts[0], pts[1]);
    ctx.arc(pts[0][0], pts[0][1], radii[0], a0 - Math.PI / 2, a0 + Math.PI / 2, true);
    ctx.closePath();
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
      // 占位阶段身体不按画风变色，头像也保持原样，保证肤色一致；正式场景再按画风处理（见 heads-check）
      figureStyle: () => ({ headTreatment: { type: "none" } }),
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
        ctx.fillText(`\u5360\u4F4D \xB7 \u7B2C ${st.n} \u7AD9 \xB7 ${st.style}`, 690, 330);
        font(ctx, 40, { family: SERIF, weight: 400 });
        ctx.fillText(`\u573A\u666F\uFF1A${st.scene}`, 690, 390);
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
        const k = smoothstep(SB(5) - 0.15, SB(5) + 0.1, b) * (1 - smoothstep(SB(7) - 0.2, SB(7), b));
        if (k <= 0.01) return;
        const pul = 1 + 0.08 * pulse(SB(5), SB(6), b) + 0.08 * pulse(SB(6), SB(7), b);
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
        const lines = wrap(ctx, `\u7B2C 2 \u5C0F\u8282\u7684\u6897\uFF1A${st.gag}`, 760);
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
    let line = "";
    for (const ch of str) {
      if (ctx.measureText(line + ch).width > maxW) {
        out.push(line);
        line = ch;
      } else line += ch;
    }
    if (line) out.push(line);
    return out;
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
      const tile = document.createElement("canvas");
      tile.width = T;
      tile.height = T;
      const tctx = tile.getContext("2d");
      const ti = tctx.createImageData(T, T);
      const R = rng("grain", seed);
      for (let i = 0; i < T * T; i++) {
        const v = R() < 0.5 ? 0 : 255;
        ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = v;
        ti.data[i * 4 + 3] = R() * 16 * amount;
      }
      tctx.putImageData(ti, 0, 0);
      ctx.fillStyle = ctx.createPattern(tile, "repeat");
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

  // src/rig/skeleton.js
  var BONES = {
    thigh: 80,
    shin: 78,
    ankle: 8,
    foot: 34,
    torso: 100,
    neck: 12,
    head: 62,
    upperArm: 60,
    forearm: 54,
    hand: 13
  };
  var HIP_H = BONES.thigh + BONES.shin + BONES.ankle - 4;
  var STANCE = 1.12;
  function legIK(hip, ankle, L1, L2) {
    let dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
    let d = Math.hypot(dx, dy);
    const maxD = (L1 + L2) * 0.999;
    if (d > maxD) {
      ankle = [hip[0] + dx / d * maxD, hip[1] + dy / d * maxD];
      dx = ankle[0] - hip[0];
      dy = ankle[1] - hip[1];
      d = maxD;
    }
    const th = Math.atan2(dy, dx);
    const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
    const knee = [hip[0] + L1 * Math.cos(th - a), hip[1] + L1 * Math.sin(th - a)];
    return { knee, ankle };
  }
  function footState(gb, offset, dist2, liftK) {
    const c = ((gb - offset) % 2 + 2) % 2;
    const plantBeat = gb - c;
    const half = (b0) => (dist2(b0 + STANCE) - dist2(b0)) / 2;
    if (c <= STANCE) {
      const x = half(plantBeat) - (dist2(gb) - dist2(plantBeat));
      const roll = c < 0.15 ? -0.25 * (1 - c / 0.15) : c > STANCE - 0.3 ? 0.45 * ((c - (STANCE - 0.3)) / 0.3) : 0;
      return { x, lift: 0, toe: roll, stance: true };
    }
    const liftBeat = plantBeat + STANCE;
    const x0 = half(plantBeat) - (dist2(liftBeat) - dist2(plantBeat));
    const x1 = half(plantBeat + 2);
    const u = (c - STANCE) / (2 - STANCE);
    const s = u * u * (3 - 2 * u);
    const lift = (Math.sin(Math.PI * u) * 22 + Math.sin(Math.PI * Math.min(1, u * 1.6)) * 6) * liftK;
    return { x: lerp(x0, x1, s), lift, toe: lerp(0.45, -0.25, s), stance: false };
  }
  function poseAt(gb, dist2, o = {}) {
    const { lean = 0.05, strideK = 1, bounce = 1, walking = true, armK = 1 } = o;
    const B2 = BONES;
    const frac = (gb % 1 + 1) % 1;
    const bob = walking ? (-Math.cos(frac * TAU) * 0.5 + 0.5) * 7 * bounce : 0;
    const hip = [0, -HIP_H - bob + 3];
    const near = walking ? footState(gb, 0, dist2, strideK) : { x: 6, lift: 0, toe: 0, stance: true };
    const far = walking ? footState(gb, 1, dist2, strideK) : { x: -6, lift: 0, toe: 0, stance: true };
    const leg = (f) => {
      const ankle = [hip[0] + f.x, -B2.ankle - f.lift];
      const { knee, ankle: a } = legIK(hip, ankle, B2.thigh, B2.shin);
      const toe = [a[0] + Math.cos(f.toe) * B2.foot * 0.78, a[1] + B2.ankle - 1 + Math.sin(f.toe) * B2.foot * 0.78];
      const heel = [a[0] - Math.cos(f.toe) * B2.foot * 0.22, a[1] + B2.ankle - 1 - Math.sin(f.toe) * B2.foot * 0.22];
      return { hip: [...hip], knee, ankle: a, toe, heel, stance: f.stance };
    };
    const legs = { near: leg(near), far: leg(far) };
    const tilt = lean + (walking ? Math.sin(frac * TAU) * 0.01 : 0);
    const up = [Math.sin(tilt), -Math.cos(tilt)];
    const chest = [hip[0] + up[0] * B2.torso * 0.62, hip[1] + up[1] * B2.torso * 0.62];
    const shoulder = [hip[0] + up[0] * B2.torso, hip[1] + up[1] * B2.torso];
    const neckTop = [shoulder[0] + up[0] * B2.neck + 3, shoulder[1] + up[1] * B2.neck];
    const headTilt = tilt * 0.5 + (walking ? Math.sin(frac * TAU + 0.6) * 0.012 : 0);
    const cNear = walking ? (gb % 2 + 2) % 2 : 0.5;
    const arm = (side) => {
      const ph = side === "near" ? cNear : cNear + 1;
      const swing = walking ? -Math.cos(Math.PI * ph) * 0.42 * strideK * armK : 0;
      const a1 = swing + tilt * 0.6;
      const bend = 0.22 + Math.max(0, swing) * 0.9;
      const sh = [shoulder[0] + (side === "near" ? 2 : -3), shoulder[1] + 4];
      const elbow = [sh[0] + Math.sin(a1) * B2.upperArm, sh[1] + Math.cos(a1) * B2.upperArm];
      const a2 = a1 + bend;
      const wrist = [elbow[0] + Math.sin(a2) * B2.forearm, elbow[1] + Math.cos(a2) * B2.forearm];
      const hand = [wrist[0] + Math.sin(a2) * B2.hand * 0.6, wrist[1] + Math.cos(a2) * B2.hand * 0.6];
      return { shoulder: sh, elbow, wrist, hand, angle: a2 };
    };
    const arms = { near: arm("near"), far: arm("far") };
    return { hip, chest, shoulder, neckTop, tilt, headTilt, up, legs, arms, gb };
  }

  // src/main/walk.js
  var DOWNBEATS = sections.filter((s) => s.station).map((s) => s.start);
  var BOOST_FROM = -0.55;
  var BOOST_LEN = 0.8;
  var BOOST_AMP = 0.45;
  var sin2Integral = (x, L) => x / 2 - L / (4 * Math.PI) * Math.sin(2 * Math.PI * x / L);
  function dist(gb) {
    let d = WALK_SPEED * gb;
    for (const D of DOWNBEATS) {
      const x = gb - (D + BOOST_FROM);
      if (x <= 0) break;
      d += WALK_SPEED * BOOST_AMP * sin2Integral(Math.min(x, BOOST_LEN), BOOST_LEN);
    }
    return d;
  }
  function boost(gb) {
    for (const D of DOWNBEATS) {
      const x = gb - (D + BOOST_FROM);
      if (x >= 0 && x <= BOOST_LEN) return Math.sin(Math.PI * x / BOOST_LEN) ** 2;
    }
    return 0;
  }

  // src/main/figure.js
  var WALK_START = 8;
  function figurePose(gb, look) {
    const walking = gb >= WALK_START;
    const g = walking ? gb : WALK_START;
    return poseAt(g, dist, {
      lean: 0.04 + look.posture + 0.13 * boost(gb),
      bounce: look.bounce,
      armK: look.armK,
      walking: true
    });
  }

  // src/rig/head.js
  var images = /* @__PURE__ */ new Map();
  var MAIN_HEAD = "three-quarter";
  var HEAD_BOX = 145;
  var HEAD_TILT = 12 * Math.PI / 180;
  var PLACEHOLDER_SCALE = 1.28;
  async function loadHeadAssets() {
    const list = typeof window !== "undefined" && window.__HEADS || {};
    await Promise.all(Object.entries(list).map(([k, src]) => new Promise((res) => {
      const im = new Image();
      im.onload = () => {
        images.set(k, im);
        res();
      };
      im.onerror = () => res();
      im.src = src;
    })));
    return images.size;
  }
  var headAssetKeys = () => [...images.keys()];
  function findHeadAsset(sceneId) {
    if (sceneId && images.has(sceneId)) return { key: sceneId, img: images.get(sceneId) };
    if (images.has(MAIN_HEAD)) return { key: MAIN_HEAD, img: images.get(MAIN_HEAD) };
    return null;
  }
  var PROC = 384;
  function lumOf(d, i) {
    return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
  }
  function processedHead(key, img, treatment) {
    const tkey = JSON.stringify(treatment || { type: "none" });
    return memo(`headproc|${key}|${tkey}`, () => {
      const type = treatment?.type || "none";
      if (type === "none") return img;
      const c = makeCanvas(PROC, PROC);
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, PROC, PROC);
      if (type === "fade") {
        ctx.globalCompositeOperation = "source-atop";
        ctx.globalAlpha = treatment.k ?? 0.4;
        ctx.fillStyle = treatment.toward || "#efe6d2";
        ctx.fillRect(0, 0, PROC, PROC);
        return c;
      }
      const im = ctx.getImageData(0, 0, PROC, PROC);
      const d = im.data;
      if (type === "tone" || type === "ink") {
        const pal = (treatment.palette || ["#222222", "#888888", "#eeeeee"]).map(hexToRgb);
        for (let i = 0; i < d.length; i += 4) {
          if (!d[i + 3]) continue;
          let l = lumOf(d, i);
          if (type === "ink") l = Math.pow(l, 0.8);
          const [a, b, t] = l < 0.5 ? [pal[0], pal[1], l / 0.5] : [pal[1], pal[2], (l - 0.5) / 0.5];
          const isRed = d[i] > 150 && d[i] > d[i + 1] * 1.8 && d[i] > d[i + 2] * 1.8;
          if (!isRed) for (let k = 0; k < 3; k++) d[i + k] = a[k] + (b[k] - a[k]) * t;
        }
        ctx.putImageData(im, 0, 0);
        if (type === "ink") {
          const blur = makeCanvas(PROC, PROC);
          const bctx = blur.getContext("2d");
          bctx.filter = "blur(3px)";
          bctx.drawImage(c, 0, 0);
          ctx.globalAlpha = 0.55;
          ctx.drawImage(blur, 0, 0);
          ctx.globalAlpha = 1;
        }
        return c;
      }
      if (type === "silhouette") {
        const col = hexToRgb(treatment.color || "#3a1d10");
        for (let y = 0; y < PROC; y++) for (let x = 0; x < PROC; x++) {
          const i = (y * PROC + x) * 4;
          if (d[i + 3] < 40) {
            d[i + 3] = 0;
            continue;
          }
          const l = lumOf(d, i);
          const cell = 9, cx = x % cell - cell / 2, cy = y % cell - cell / 2;
          const hole = l > 0.55 && cx * cx + cy * cy < (l - 0.45) * 26;
          d[i] = col[0];
          d[i + 1] = col[1];
          d[i + 2] = col[2];
          d[i + 3] = hole ? 0 : 235;
        }
        ctx.putImageData(im, 0, 0);
        return c;
      }
      if (type === "lines") {
        const col = hexToRgb(treatment.color || "#111111");
        const L = new Float32Array(PROC * PROC);
        const A = new Uint8Array(PROC * PROC);
        for (let i = 0; i < PROC * PROC; i++) {
          L[i] = lumOf(d, i * 4);
          A[i] = d[i * 4 + 3];
        }
        const out = ctx.createImageData(PROC, PROC);
        const o = out.data;
        const at = (x, y) => L[Math.min(PROC - 1, Math.max(0, y)) * PROC + Math.min(PROC - 1, Math.max(0, x))];
        for (let y = 0; y < PROC; y++) for (let x = 0; x < PROC; x++) {
          const i = y * PROC + x;
          if (A[i] < 40) continue;
          const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
          const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
          const edge = Math.hypot(gx, gy) > 0.55;
          const dark = 1 - L[i];
          const hatch = (x + y) % 6 < 1.6 && dark > 0.35 || (x - y + 600) % 6 < 1.4 && dark > 0.62;
          const edgeA = x === 0 || A[i - 1] < 40 || A[i + 1] < 40 || A[i - PROC] < 40 || A[i + PROC] < 40;
          const on = edge || hatch || edgeA;
          const k = i * 4;
          if (on) {
            o[k] = col[0];
            o[k + 1] = col[1];
            o[k + 2] = col[2];
            o[k + 3] = 255;
          } else {
            const p = treatment.paper ? hexToRgb(treatment.paper) : [255, 255, 255];
            o[k] = p[0];
            o[k + 1] = p[1];
            o[k + 2] = p[2];
            o[k + 3] = treatment.paper ? 255 : 0;
          }
        }
        ctx.putImageData(out, 0, 0);
        return c;
      }
      return c;
    });
  }
  var SKIN = "#f9c7a0";
  function drawPlaceholderHead(ctx, look, o = {}) {
    const { view = "side", ink = "#1d1b1a", lw = 2.6, skin = SKIN, flat = false, hairColor } = o;
    const hc = hairColor || look.colors.hair;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    if (view === "front") return drawFrontHead(ctx, look, { ink, lw, skin, hc, flat });
    const tq = view === "three-quarter";
    const face = tq ? [[-20, -20], [-27, -40], [-24, -66], [-6, -80], [16, -78], [28, -62], [29, -48], [27, -36], [20, -24], [8, -17], [-6, -15]] : [[-18, -18], [-26, -38], [-24, -64], [-8, -80], [14, -79], [26, -66], [29, -54], [33, -46], [29, -42], [29, -34], [25, -25], [14, -19], [0, -16]];
    smoothPath(ctx, face, true);
    ctx.fillStyle = skin;
    ctx.fill();
    if (!flat) {
      if ((look.stubble || 0) > 0) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = `rgba(70,64,60,${0.04 + look.stubble * 0.16})`;
        ellipse(ctx, 18, -24, 16, 10, -0.2);
        ctx.fill();
        for (let i = 0; i < 26 * look.stubble; i++) {
          const x = 4 + hash2(i, 1, 9) * 26, y = -32 + hash2(i, 2, 9) * 16;
          circle(ctx, x, y, 0.7);
          ctx.fillStyle = "rgba(40,36,34,0.45)";
          ctx.fill();
        }
        ctx.restore();
      }
      smoothPath(ctx, face, true);
    }
    ctx.stroke();
    ctx.fillStyle = hc;
    const v = look.hairVol;
    let hair;
    if (look.hair === "fringe") {
      hair = [[-27, -40], [-30, -60], [-20, -80], [0, -88 - 4 * v], [20, -84], [32, -70], [34, -58], [26, -62], [18, -58], [12, -66], [2, -68], [-12, -62], [-18, -50]];
    } else if (look.hair === "short") {
      hair = [[-26, -42], [-29, -62], [-18, -80], [2, -85 - 2 * v], [20, -80], [28, -70], [24, -67], [10, -72], [-6, -70], [-16, -60], [-20, -48]];
    } else {
      hair = [[-25, -38], [-31, -58], [-24, -78], [-4, -87 - 2 * v], [18, -83], [28, -73], [24, -70], [8, -76], [-8, -74], [-18, -64], [-20, -50]];
    }
    smoothPath(ctx, hair, true);
    ctx.fill();
    ctx.stroke();
    if (look.hair === "slick" || look.hair === "slick-grey") {
      ctx.save();
      ctx.lineWidth = lw * 0.5;
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      for (let k = 0; k < 3; k++) smoothPath(ctx, [[18 - k * 4, -79 + k * 2], [0 - k * 3, -82 + k * 3], [-18 - k, -70 + k * 3]]), ctx.stroke();
      ctx.restore();
    }
    const earX = tq ? -12 : -5;
    ellipse(ctx, earX, -45, 5.2, 7.6, -0.1);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.lineWidth = lw * 0.9;
    ctx.beginPath();
    ctx.ellipse(earX, -45, 5.2, 7.6, -0.1, Math.PI * 0.45, Math.PI * 1.75);
    ctx.stroke();
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath();
    ctx.arc(earX + 0.5, -45, 2.6, Math.PI * 0.6, Math.PI * 1.5);
    ctx.stroke();
    ctx.lineWidth = lw;
    ctx.fillStyle = hc;
    const sx = tq ? -6 : 1;
    smoothPath(ctx, [[sx - 16, -66], [sx + 9, -66], [sx + 8, -56], [sx + 5, -49], [sx + 2, -55], [sx - 10, -55]], true);
    ctx.fill();
    if ((look.grey || 0) > 0) {
      ctx.fillStyle = mixGrey(hc, look.grey * 0.75);
      smoothPath(ctx, [[-24, -58], [-14, -64], [-12, -56], [-20, -48]], true);
      ctx.fill();
    }
    const ex = tq ? 12 : 19;
    ctx.lineWidth = lw * 1.05;
    ctx.beginPath();
    ctx.moveTo(ex - 6, -58);
    ctx.quadraticCurveTo(ex, -61, ex + 6, -58.5);
    ctx.stroke();
    ctx.fillStyle = ink;
    ellipse(ctx, ex, -50, 2.4, 3.4);
    ctx.fill();
    if (tq) {
      ellipse(ctx, ex + 13, -50, 2, 3.2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ex + 8, -57.5);
      ctx.quadraticCurveTo(ex + 13, -60, ex + 18, -57.5);
      ctx.stroke();
    }
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(tq ? 22 : 24, -32);
    ctx.quadraticCurveTo(tq ? 18 : 21, -30.5, tq ? 14 : 17, -31.5);
    ctx.stroke();
    if (look.glasses) {
      ctx.lineWidth = lw * 0.6;
      roundRect(ctx, ex - 6, -55, 13, 10, 3);
      ctx.stroke();
      if (tq) {
        roundRect(ctx, ex + 8, -55, 11, 10, 3);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(ex - 6, -51);
      ctx.lineTo(-2, -50);
      ctx.stroke();
    }
  }
  function drawFrontHead(ctx, look, { ink, lw, skin, hc }) {
    const faceP = [[0, -16], [-18, -22], [-26, -40], [-27, -60], [-18, -78], [0, -84], [18, -78], [27, -60], [26, -40], [18, -22]];
    ellipse(ctx, -28, -46, 5, 8);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.stroke();
    ellipse(ctx, 28, -46, 5, 8);
    ctx.fill();
    ctx.stroke();
    smoothPath(ctx, faceP, true);
    ctx.fillStyle = skin;
    ctx.fill();
    if (look.stubble > 0) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = `rgba(70,64,60,${0.12 + look.stubble * 0.28})`;
      ellipse(ctx, 0, -24, 22, 12);
      ctx.fill();
      ctx.restore();
      smoothPath(ctx, faceP, true);
    }
    ctx.stroke();
    ctx.fillStyle = hc;
    const hair = look.hair === "fringe" ? [[-28, -46], [-30, -70], [-14, -88], [8, -88], [26, -76], [29, -54], [22, -64], [8, -68], [-6, -60], [-20, -62]] : look.hair === "short" ? [[-27, -50], [-28, -72], [-12, -86], [10, -86], [27, -72], [27, -50], [20, -66], [0, -70], [-20, -66]] : [[-27, -48], [-29, -72], [-12, -88], [12, -88], [29, -72], [27, -48], [22, -68], [0, -74], [-22, -68]];
    smoothPath(ctx, hair, true);
    ctx.fill();
    ctx.stroke();
    if (look.grey > 0) {
      ctx.fillStyle = mixGrey(hc, look.grey);
      for (const s of [-1, 1]) {
        smoothPath(ctx, [[s * 27, -60], [s * 24, -52], [s * 26, -44], [s * 29, -52]], true);
        ctx.fill();
      }
    }
    ctx.fillStyle = ink;
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 10, -50, 2.4, 3.4);
      ctx.fill();
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(s * 5, -58);
      ctx.quadraticCurveTo(s * 10, -61, s * 16, -58);
      ctx.stroke();
    }
    ctx.lineWidth = lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(-1, -46);
    ctx.lineTo(-2, -38);
    ctx.lineTo(1, -37);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -30);
    ctx.quadraticCurveTo(0, -28, 6, -30);
    ctx.stroke();
    if (look.glasses) {
      ctx.lineWidth = lw * 0.6;
      roundRect(ctx, -17, -55, 13, 10, 3);
      ctx.stroke();
      roundRect(ctx, 4, -55, 13, 10, 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -51);
      ctx.lineTo(4, -51);
      ctx.stroke();
    }
  }
  function mixGrey(hex, k) {
    const [r, g, b] = hexToRgb(hex);
    const G = [196, 194, 190];
    return `rgb(${r + (G[0] - r) * k},${g + (G[1] - g) * k},${b + (G[2] - b) * k})`;
  }
  function drawHead(ctx, look, o = {}) {
    const { sceneId, treatment, tilt = 0, skin = SKIN, ink = "#1d1b1a", lw = 1.2 } = o;
    const asset = findHeadAsset(sceneId);
    ctx.save();
    if (asset) {
      ctx.rotate(tilt + HEAD_TILT);
      const img = processedHead(asset.key, asset.img, treatment);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -HEAD_BOX / 2, -HEAD_BOX, HEAD_BOX, HEAD_BOX);
      ctx.restore();
      return true;
    }
    ctx.lineWidth = lw;
    ctx.strokeStyle = ink;
    capsule(ctx, [0, 0], [3, -14], 7.5, 7);
    ctx.fillStyle = skin;
    ctx.fill();
    ctx.stroke();
    ctx.translate(3, -8);
    ctx.rotate(tilt);
    ctx.scale(PLACEHOLDER_SCALE, PLACEHOLDER_SCALE);
    drawPlaceholderHead(ctx, look, { ...o, lw: lw / PLACEHOLDER_SCALE * 1.4 });
    ctx.restore();
    return false;
  }

  // src/rig/painter.js
  var add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
  var DEFAULT_STYLE = {
    ink: "#1a1514",
    lw: 1.2,
    // 与头像轮廓线粗细一致（头像约 7px/1024 × 145 单位 ≈ 1 单位）
    skin: null,
    // null = 用 LOOK 里与头像一致的肤色
    red: HEADPHONE_RED,
    color: (hex) => hex,
    // 颜色映射（比如单色画风把彩色压成灰阶）；肤色也走这里，保持与头像处理一致
    shade: 0.78,
    // 暗部 = 底色 × shade；设为 1 关闭明暗
    headTreatment: { type: "none" }
  };
  function drawFigure(ctx, pose, look, style = {}) {
    const S = { ...DEFAULT_STYLE, ...style };
    const C = (k) => S.color(look.colors[k]);
    const skin = S.skin || C("skin");
    const skinShade = S.skin ? darken(S.skin, 0.86) : C("skinShade");
    const shadeOf = (c) => S.shade >= 1 ? c : darken(c, S.shade);
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = S.ink;
    ctx.lineWidth = S.lw;
    const b = look.build;
    const f = [Math.cos(pose.tilt), Math.sin(pose.tilt)];
    const up = pose.up;
    const cel = (path, base, shade, dx = 3.5, dy = -2) => {
      path();
      ctx.fillStyle = shade;
      ctx.fill();
      if (shade !== base) {
        ctx.save();
        path();
        ctx.clip();
        ctx.translate(dx, dy);
        path();
        ctx.fillStyle = base;
        ctx.fill();
        ctx.restore();
      }
      path();
      ctx.stroke();
    };
    const shoe = (leg2) => {
      const { heel, toe, ankle } = leg2;
      const col = C("shoe"), sole = C("sole");
      const dx = toe[0] - heel[0], dy = toe[1] - heel[1];
      const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
      const nx = uy, ny = -ux;
      const h = 15;
      const pts = [
        add(heel, [nx, ny], 1),
        add(heel, [nx, ny], h * 0.95),
        add(ankle, [nx, ny], 9),
        [toe[0] + nx * h * 0.55 - ux * 6, toe[1] + ny * h * 0.55 - uy * 6],
        add(toe, [ux, uy], 3),
        add(toe, [nx, ny], 1)
      ];
      cel(() => smoothPath(ctx, pts, true), col, shadeOf(col), 2.5, -2.5);
      const soleP = [add(heel, [nx, ny], 4.5), add(heel, [ux, uy], -1.5), add(toe, [ux, uy], 3), add(toe, [nx, ny], 4.5)];
      poly(ctx, soleP);
      ctx.fillStyle = sole;
      ctx.fill();
      ctx.stroke();
    };
    const leg = (L, near) => {
      const pants = near ? C("pants") : darken(C("pants"), 0.82);
      cel(() => tube(ctx, [L.hip, L.knee, L.ankle], [15 * b, 12 * b, 10 * b]), pants, shadeOf(pants));
      shoe(L);
    };
    const arm = (A, near) => {
      const sleeve = near ? C("outer") : darken(C("outer"), 0.8);
      const hx = A.hand[0] + (A.hand[0] - A.wrist[0]) * 0.6, hy = A.hand[1] + (A.hand[1] - A.wrist[1]) * 0.6;
      const handC = near ? skin : darken(skin, 0.9);
      cel(() => ellipse(ctx, hx, hy, 9, 10.5, A.angle), handC, near ? skinShade : darken(skinShade, 0.9), 2.5, -2);
      const w2 = [A.elbow[0] + (A.wrist[0] - A.elbow[0]) * 0.96, A.elbow[1] + (A.wrist[1] - A.elbow[1]) * 0.96];
      cel(() => tube(ctx, [A.shoulder, A.elbow, w2], [13 * b, 11 * b, 10 * b]), sleeve, mix(sleeve, "#000000", 0.35));
      ctx.save();
      ctx.lineWidth = S.lw * 0.8;
      const d = [w2[0] - A.elbow[0], w2[1] - A.elbow[1]], dl = Math.hypot(...d) || 1;
      const n = [-d[1] / dl, d[0] / dl];
      const c0 = [w2[0] - d[0] / dl * 5, w2[1] - d[1] / dl * 5];
      ctx.beginPath();
      ctx.moveTo(c0[0] + n[0] * 10, c0[1] + n[1] * 10);
      ctx.lineTo(c0[0] - n[0] * 10, c0[1] - n[1] * 10);
      ctx.stroke();
      ctx.restore();
    };
    arm(pose.arms.far, false);
    leg(pose.legs.far, false);
    leg(pose.legs.near, true);
    const hip = pose.hip, sh = pose.shoulder, ch = pose.chest;
    const back = 25 * b, front = 23 * b;
    const hipB = add(add(hip, up, -8), f, -back + 1);
    const hipF = add(add(hip, up, -8), f, front - 1);
    const torso = [
      hipB,
      add(ch, f, -back - 1),
      add(add(sh, f, -back + 6), up, 4),
      add(sh, up, 9),
      add(add(sh, f, front - 4), up, 3),
      add(ch, f, front + 3),
      hipF
    ];
    const outer = C("outer");
    cel(() => smoothPath(ctx, torso, true), outer, mix(outer, "#000000", 0.35), 6, -3);
    ctx.save();
    smoothPath(ctx, torso, true);
    ctx.clip();
    torsoDetail(ctx, pose, S, C, f, up, front);
    ctx.restore();
    smoothPath(ctx, torso, true);
    ctx.stroke();
    const neckBase = add(sh, up, 6);
    const farCup = add(add(neckBase, f, -15), up, 2);
    const nearCup = add(add(neckBase, f, 13), up, 2);
    const band = () => {
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = S.ink;
      ctx.stroke();
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = S.red;
      ctx.stroke();
      ctx.strokeStyle = S.ink;
      ctx.lineWidth = S.lw;
    };
    ctx.beginPath();
    ctx.moveTo(farCup[0], farCup[1]);
    ctx.quadraticCurveTo(neckBase[0] - f[0] * 30 + up[0] * 22, neckBase[1] - f[1] * 30 + up[1] * 22, neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
    band();
    cel(() => ellipse(ctx, farCup[0], farCup[1], 8, 10.5, pose.tilt + 0.5), darken(S.red, 0.8), darken(S.red, 0.6), 2, -1.5);
    ctx.save();
    ctx.translate(neckBase[0], neckBase[1]);
    ctx.rotate(pose.tilt);
    ctx.translate(0, 5);
    drawHead(ctx, look, {
      sceneId: S.sceneId,
      treatment: S.headTreatment,
      tilt: pose.headTilt - pose.tilt,
      ink: S.ink,
      lw: S.lw,
      skin,
      hairColor: C("hair")
    });
    ctx.restore();
    const collar = [add(add(sh, f, -back + 8), up, 2), add(add(sh, f, -12), up, 15), add(add(sh, f, 2), up, 13), add(add(sh, f, 6), up, 4)];
    cel(() => smoothPath(ctx, collar, true), outer, mix(outer, "#000000", 0.35), 3, -1);
    ctx.beginPath();
    ctx.moveTo(neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
    ctx.quadraticCurveTo(nearCup[0] + up[0] * 16 + f[0] * 4, nearCup[1] + up[1] * 16 + f[1] * 4, nearCup[0], nearCup[1]);
    band();
    cel(() => ellipse(ctx, nearCup[0], nearCup[1], 9, 12, pose.tilt - 0.35), S.red, darken(S.red, 0.72), 2.5, -2);
    ellipse(ctx, nearCup[0] + 1.5, nearCup[1] - 1, 4.5, 6.5, pose.tilt - 0.35);
    ctx.fillStyle = darken(S.red, 0.62);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(nearCup[0], nearCup[1], 6.5, 9.5, pose.tilt - 0.35, -2.6, -1.6);
    ctx.stroke();
    ctx.strokeStyle = S.ink;
    ctx.lineWidth = S.lw;
    arm(pose.arms.near, true);
    ctx.restore();
  }
  function torsoDetail(ctx, pose, S, C, f, up, front) {
    const hip = pose.hip, sh = pose.shoulder;
    const tee = C("top");
    const strip = [add(add(hip, f, front - 11), up, -12), add(add(hip, f, front + 12), up, -12), add(add(sh, f, front + 12), up, 12), add(add(sh, f, front - 8), up, 12)];
    poly(ctx, strip);
    ctx.fillStyle = darken(tee, 0.86);
    ctx.fill();
    const lit = strip.map((p) => [p[0] + 2.5, p[1] - 1.5]);
    poly(ctx, lit);
    ctx.fillStyle = tee;
    ctx.fill();
    ctx.lineWidth = S.lw;
    ctx.strokeStyle = S.ink;
    ctx.beginPath();
    ctx.moveTo(...add(add(hip, f, front - 11), up, -10));
    ctx.lineTo(...add(add(sh, f, front - 8), up, 6));
    ctx.stroke();
    const outer2 = C("outer2");
    poly(ctx, [add(add(hip, f, -40), up, -10), add(add(hip, f, front - 10), up, -10), add(add(hip, f, front - 10), up, 4), add(add(hip, f, -40), up, 4)]);
    ctx.fillStyle = outer2;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(...add(add(hip, f, -40), up, 4));
    ctx.lineTo(...add(add(hip, f, front - 10), up, 4));
    ctx.stroke();
    ctx.lineWidth = S.lw * 0.8;
    ctx.beginPath();
    ctx.moveTo(...add(add(hip, f, 2), up, 34));
    ctx.lineTo(...add(add(hip, f, 10), up, 18));
    ctx.stroke();
  }
  function darken(hex, k) {
    if (!hex.startsWith("#")) return hex;
    const v = hex.replace("#", "");
    const r = parseInt(v.slice(0, 2), 16) * k, g = parseInt(v.slice(2, 4), 16) * k, b2 = parseInt(v.slice(4, 6), 16) * k;
    return "#" + [r, g, b2].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");
  }

  // src/rig/look.js
  var LOOK = {
    build: 1,
    posture: 5e-3,
    hair: "short",
    hairVol: 0.88,
    // 只用于占位头
    outfit: "jacket",
    shoes: "sneaker",
    bounce: 1,
    armK: 1,
    colors: {
      skin: "#f9c7a0",
      skinShade: "#e2a47e",
      top: "#f4f1ea",
      outer: "#24272e",
      outer2: "#33373f",
      pants: "#34405a",
      shoe: "#f2f0ea",
      sole: "#cfc9bc",
      hair: "#1b1918"
    }
  };

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
  var pencilStyle = {
    ink: INK,
    lw: 1.3,
    color: (hex) => mix(hex, PAPER, 0.42),
    headTreatment: { type: "fade", toward: PAPER, k: 0.42 }
  };
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
    figureStyle: () => pencilStyle,
    figureAdjust(b, env) {
      if (b < T_OUT) return { hidden: true };
      const e = ease.inOut(clamp((b - T_OUT) / 1.15));
      const lx = CAS_REST.x + LABEL.dx + LABEL.w * 0.5 - env.cam;
      const ly = CAS_REST.y + LABEL.dy + LABEL.h - 6;
      return {
        dx: lerp(lx - CHAR_X, 0, e),
        dy: lerp(ly - ROAD_Y, 0, e) - Math.sin(Math.PI * e) * 70,
        scale: lerp(0.24, 1, e)
      };
    },
    drawBack(ctx, b, env) {
      const cam = env.cam;
      const pw = Math.ceil((X_MAX - X_MIN + 1600) * K), ph = Math.ceil(1e3 * K);
      const paper = paperTexture(pw, ph, { base: PAPER, seed: 7 });
      ctx.drawImage(paper, X_MIN - cam * 1, 0, pw / K, ph / K);
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
        ctx.scale(0.24, 0.24);
        const pose = figurePose(WALK_START, LOOK);
        drawFigure(ctx, pose, LOOK, { ...pencilStyle, lw: 3 });
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

  // src/scenes/index.js
  var SCENES = { intro };
  for (const st of STATIONS) SCENES[st.id] = placeholderScene(st);

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

  // src/hud/titlecard.js
  var cardIn = (b) => ease.out(clamp(b / 1.1)) * (1 - smoothstep(7.25, 7.85, b));
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
    ctx.fillStyle = S.accent;
    ctx.fillRect(x + 20, y + 26, 7, h - 52);
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
  var playerIn = (b) => ease.outBack(clamp((b - 0.5) / 1.1)) * (1 - smoothstep(7.25, 7.85, b));
  var spinAt = (gb) => gb * (TAU / 4);
  function drawCassette(ctx, cx, cy, s, spin, P) {
    const w = 200 * s, h = 128 * s;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
    ctx.fillStyle = P.body;
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 12 * s, w - 28 * s, 66 * s, 5 * s);
    ctx.fillStyle = P.label;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = P.accent;
    ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 22 * s, w - 28 * s, 7 * s);
    roundRect(ctx, -52 * s, -h / 2 + 34 * s, 104 * s, 34 * s, 16 * s);
    ctx.fillStyle = P.window;
    ctx.fill();
    ctx.stroke();
    for (const sx of [-1, 1]) {
      const rx = sx * 34 * s, ry = -h / 2 + 51 * s;
      circle(ctx, rx, ry, (sx < 0 ? 16 : 11) * s);
      ctx.fillStyle = P.tape;
      ctx.fill();
      circle(ctx, rx, ry, 9 * s);
      ctx.fillStyle = P.body;
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
      for (let i = 0; i < 6; i++) {
        ctx.rotate(TAU / 6);
        ctx.fillStyle = P.ink;
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
      ctx.fillStyle = P.ink;
      ctx.fill();
    }
    ctx.restore();
  }
  function drawCD(ctx, cx, cy, s, spin, P) {
    const r = 78 * s;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    circle(ctx, 0, 0, r);
    const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
    if (g) {
      g.addColorStop(0, P.disc);
      g.addColorStop(0.15, P.shine1);
      g.addColorStop(0.3, P.disc);
      g.addColorStop(0.55, P.shine2);
      g.addColorStop(0.7, P.disc);
      g.addColorStop(1, P.disc);
      ctx.fillStyle = g;
    } else ctx.fillStyle = P.disc;
    ctx.fill();
    ctx.lineWidth = 3 * s;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    circle(ctx, 0, 0, r * 0.62);
    ctx.lineWidth = 9 * s;
    ctx.strokeStyle = rgba(P.accent, 0.8);
    ctx.stroke();
    ctx.fillStyle = P.accent;
    ellipse(ctx, r * 0.78, 0, 7 * s, 4 * s);
    ctx.fill();
    circle(ctx, 0, 0, r * 0.26);
    ctx.fillStyle = P.hub;
    ctx.fill();
    ctx.lineWidth = 2 * s;
    ctx.strokeStyle = P.ink;
    ctx.stroke();
    circle(ctx, 0, 0, r * 0.1);
    ctx.fillStyle = P.hole;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  function drawPhone(ctx, cx, cy, s, spin, P, progress = 0.3) {
    const w = 120 * s, h = 220 * s;
    ctx.save();
    ctx.translate(cx, cy);
    roundRect(ctx, -w / 2, -h / 2, w, h, 18 * s);
    ctx.fillStyle = P.ink;
    ctx.fill();
    roundRect(ctx, -w / 2 + 7 * s, -h / 2 + 7 * s, w - 14 * s, h - 14 * s, 13 * s);
    ctx.fillStyle = P.screen;
    ctx.fill();
    ctx.save();
    ctx.translate(0, -h / 2 + 76 * s);
    ctx.rotate(spin);
    circle(ctx, 0, 0, 40 * s);
    ctx.fillStyle = P.disc;
    ctx.fill();
    for (let i = 1; i < 4; i++) {
      circle(ctx, 0, 0, (14 + i * 7) * s);
      ctx.lineWidth = 1 * s;
      ctx.strokeStyle = rgba("#ffffff", 0.18);
      ctx.stroke();
    }
    circle(ctx, 0, 0, 13 * s);
    ctx.fillStyle = P.accent;
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", 0.85);
    ctx.fillRect(-2 * s, -38 * s, 4 * s, 12 * s);
    ctx.restore();
    const by = h / 2 - 66 * s;
    roundRect(ctx, -44 * s, by, 88 * s, 5 * s, 2.5 * s);
    ctx.fillStyle = rgba(P.fg, 0.25);
    ctx.fill();
    roundRect(ctx, -44 * s, by, 88 * s * progress, 5 * s, 2.5 * s);
    ctx.fillStyle = P.accent;
    ctx.fill();
    circle(ctx, -44 * s + 88 * s * progress, by + 2.5 * s, 5 * s);
    ctx.fill();
    ctx.fillStyle = P.fg;
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
  function drawPlayerKind(ctx, kind, cx, cy, s, spin, P, gb = 0) {
    if (kind === "cassette") drawCassette(ctx, cx, cy, s, spin, P);
    else if (kind === "cd") drawCD(ctx, cx, cy, s, spin, P);
    else drawPhone(ctx, cx, cy, s, spin, P, 0.2 + gb / 64 % 0.7);
  }
  function drawPlayerHUD(ctx, st, b, gb, W2, H2, style = {}) {
    const k = playerIn(b);
    if (k <= 1e-3) return;
    const P = { ...playerPalette(st), ...style.palette || {} };
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
    drawPlayerKind(ctx, st.player, cx, cy, s, spinAt(gb), P, gb);
    ctx.shadowColor = "transparent";
    const px = 52;
    font(ctx, px, { family: style.family || SERIF, weight: 700 });
    const tw = ctx.measureText(st.song).width;
    const left = st.player === "phone" ? cx - 90 : st.player === "cd" ? cx - 110 : cx - 125;
    const ty = cy + 18;
    roundRect(ctx, left - tw - 52, ty - 58, tw + 64, 80, 8);
    const plate = style.plate || st.palette[0];
    const ink = style.ink || readableOn(plate, st.palette[2]);
    ctx.fillStyle = rgba(plate, 0.9);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = ink;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.textAlign = "right";
    ctx.fillText(st.song, left - 12, ty);
    ctx.fillStyle = st.palette[3];
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
  var ROWS = 4;
  var GAP = 16;
  var GRID_W = W * 0.85;
  var CELL_W = (GRID_W - GAP * (COLS - 1)) / COLS;
  var CELL_H = CELL_W * 9 / 16;
  var GRID_H = CELL_H * ROWS + GAP * (ROWS - 1);
  var LEFT = (W - GRID_W) / 2;
  var TOP = 34;
  var FREEZE_B = SB(5.5);
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
      drawSection(ctx, stationSection(n), gbFreeze);
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
        img = freezeImage(st.n, stationSection(st.n).start + FREEZE_B);
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
  var LEAD2 = 2;
  var TAIL = 0.4;
  var sceneOf = (sec) => SCENES[sec.id];
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
      look: LOOK,
      ...extra
    };
  }
  function drawSceneLayers(ctx, env, { back = true, front = true } = {}) {
    const { scene, b } = env;
    ctx.save();
    applyUnits(ctx);
    if (back) scene.drawBack(ctx, b, env);
    if (front && scene.drawFront) scene.drawFront(ctx, b, env);
    ctx.restore();
  }
  function drawFigureFor(ctx, env) {
    const { scene, sec, look, b } = env;
    const adj = scene.figureAdjust && scene.figureAdjust(b, env) || {};
    if (adj.hidden) return;
    const pose = figurePose(env.gbq, look);
    const style = { sceneId: sec.id, ...scene.figureStyle ? scene.figureStyle(b, env) : {} };
    ctx.save();
    applyUnits(ctx);
    ctx.translate(CHAR_X + (adj.dx || 0), ROAD_Y + (adj.dy || 0));
    if (adj.scale) ctx.scale(adj.scale, adj.scale);
    if (adj.alpha !== void 0) ctx.globalAlpha = adj.alpha;
    if (scene.drawFigure) scene.drawFigure(ctx, pose, look, b, env, style);
    else drawFigure(ctx, pose, look, style);
    ctx.restore();
  }
  function drawSection(ctx, sec, gb, { figure = true } = {}) {
    const env = envFor(sec, gb);
    drawSceneLayers(ctx, env, { front: false });
    if (figure) drawFigureFor(ctx, env);
    drawSceneLayers(ctx, env, { back: false });
    return env;
  }
  function transitionAt(gb) {
    for (const s of sections) {
      if (!s.station) continue;
      const x = gb - s.start;
      if (x >= -LEAD2 && x < TAIL) {
        const prev = sections[sections.indexOf(s) - 1];
        return { prev, next: s, x };
      }
    }
    return null;
  }
  function frameRect(x) {
    const lin = (t) => t;
    const E = keyframes([[-LEAD2, W + 90], [-0.5, CHAR_PX + 90, ease.inOut], [0, CHAR_PX, lin], [TAIL, 0, ease.out]], x);
    const s = keyframes([[-LEAD2, 0.36], [-0.5, 0.74, ease.inOut], [0, 0.9, lin], [TAIL, 1, ease.out]], x);
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

  // src/rig/treatments.js
  var LINES = { 5: "#0e0d0c", 7: "#2a2219", 9: "#2b2a3a" };
  function headTreatmentFor(st) {
    const [bg, mid, ink] = st.palette;
    if (st.n === 11) return { type: "silhouette", color: "#3a1d10" };
    if (LINES[st.n]) return { type: "lines", color: LINES[st.n], paper: st.n === 5 ? "#f6f4ee" : mix(bg, "#ffffff", 0.3) };
    if (st.n === 3) return { type: "ink", palette: ["#1d1d1b", "#8d8a82", "#f2eee3"] };
    return { type: "tone", palette: [ink, mix(mid, "#e8c8a8", 0.5), mix(bg, "#ffffff", 0.5)] };
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
  function headsCheck({ cell = 300 } = {}) {
    const cols = 4, rows = 4, pad = 8, refW = 420, top = 64;
    const sheet = makeCanvas(refW + pad + cols * (cell + pad) + pad, top + rows * (cell + pad) + 44);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#202020";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    const src = findHeadAsset(null);
    font(sc, 28, { family: SANS, weight: 700 });
    sc.fillStyle = "#eee";
    sc.fillText(`\u6362\u5934\u5BF9\u7167\u8868 \xB7 \u7D20\u6750\uFF1A${src ? `assets/heads/${src.key}.png` : "\u6CA1\u6709\u7D20\u6750\uFF08\u539F\u521B\u5360\u4F4D\u5934\uFF09"} \xB7 \u5DF2\u6309\u8116\u5B50\u5E95\u90E8\u5411\u4E0B\u65CB\u8F6C 12\xB0`, 16, 42);
    const drawAt = (x, y, w, h, bg, treatment, sceneId, label) => {
      sc.fillStyle = bg;
      sc.fillRect(x, y, w, h);
      sc.save();
      sc.beginPath();
      sc.rect(x, y, w, h);
      sc.clip();
      const side = Math.min(w, h);
      sc.translate(x + w / 2 - side * 0.04, y + (h + side) / 2 - 6);
      const k = side * 0.95 / 160;
      sc.scale(k, k);
      drawHead(sc, LOOK, { sceneId, treatment });
      sc.restore();
      font(sc, 18, { family: SANS, weight: 700 });
      sc.fillStyle = "rgba(0,0,0,0.55)";
      sc.fillRect(x, y, w, 30);
      sc.fillStyle = "#fff";
      sc.fillText(label, x + 8, y + 22);
    };
    drawAt(pad, top, refW - pad, rows * (cell + pad) - pad, "#f3efe6", { type: "none" }, null, "\u539F\u56FE\uFF08\u4E0D\u5904\u7406\uFF09");
    STATIONS.forEach((st, i) => {
      const x = refW + pad + i % cols * (cell + pad), y = top + Math.floor(i / cols) * (cell + pad);
      const t = headTreatmentFor(st);
      const own = findHeadAsset(st.id);
      const tag = own && own.key === st.id ? " \xB7 \u4E13\u7528\u5934\u50CF" : "";
      drawAt(x, y, cell, cell, st.palette[0], t, st.id, `${st.n} ${st.style.slice(0, 9)} \xB7 ${t.type}${tag}`);
    });
    font(sc, 18, { family: SANS, weight: 400 });
    sc.fillStyle = "#aaa";
    sc.fillText("\u5904\u7406\u65B9\u5F0F\uFF1Atone \u8C03\u8272\u677F\u6620\u5C04\uFF08\u4FDD\u7559\u7EA2\u8272\uFF09\xB7 ink \u7070\u5EA6\u6655\u67D3 \xB7 lines \u523B\u7EBF\u6392\u7EBF \xB7 silhouette \u76AE\u5F71\u526A\u5F71 + \u9542\u7A7A\u3002\u5404\u7AD9\u6B63\u5F0F\u753B\u98CE\u505A\u597D\u540E\u4F1A\u518D\u7EC6\u8C03\u3002", 16, sheet.height - 14);
    return sheet;
  }
  function rigSheet({ cell = 300, phases = 8, gb0 = 20, scale = 1.25 } = {}) {
    const rowH = 600, left = 20;
    const sheet = makeCanvas(left + phases * cell + 20, rowH + 60);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#f3efe6";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    font(sc, 22, { family: SANS, weight: 700 });
    sc.fillStyle = "#333";
    for (let i = 0; i < phases; i++) sc.fillText(`\u7B2C ${(gb0 + i * 2 / phases).toFixed(2)} \u62CD`, left + i * cell + 90, 34);
    const y0 = 60 + rowH - 40;
    for (let i = 0; i < phases; i++) {
      const gb = gb0 + i * 2 / phases;
      const x0 = left + i * cell + cell / 2;
      sc.strokeStyle = "#999";
      sc.lineWidth = 2;
      sc.beginPath();
      sc.moveTo(x0 - cell / 2 + 6, y0);
      sc.lineTo(x0 + cell / 2 - 6, y0);
      sc.stroke();
      const off = dist(gb) * scale % 40;
      sc.fillStyle = "#bbb";
      for (let k = -4; k <= 4; k++) sc.fillRect(x0 + k * 40 - off, y0 + 4, 3, 10);
      sc.save();
      sc.translate(x0, y0);
      sc.scale(scale, scale);
      drawFigure(sc, figurePose(gb, LOOK), LOOK, {});
      sc.restore();
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
      const nHeads = await loadHeadAssets();
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
          heads: headAssetKeys()
        }),
        renderAt: (t) => renderAt(ctx, t),
        renderBeat: (gb) => renderBeat(ctx, gb),
        capture: (t, o = {}) => {
          if (o.beat !== void 0) renderBeat(ctx, o.beat);
          else renderAt(ctx, t);
          return canvasToB64(canvas);
        },
        contact: (o) => canvasToB64(contactSheet(ctx, canvas, o)),
        headsCheck: (o) => canvasToB64(headsCheck(o)),
        rigSheet: (o) => canvasToB64(rigSheet(o)),
        beatAt,
        timeAtBeat,
        setGrid
      };
      if (!RENDER) setupPreview(p, canvas, ctx);
      else renderAt(ctx, 0);
    };
  });
})();
