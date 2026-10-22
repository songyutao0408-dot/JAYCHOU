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
    [2e3, "Jay", "Jay", "\u53EF\u7231\u5973\u4EBA", "\u9752\u6625\u8857\u89D2", "\u6F2B\u753B\u7F51\u70B9\u5206\u955C", "\u4ED6\u4E00\u56DE\u5934\uFF08\u5B9A\u683C\u6362\u6210\u6B63\u9762\u7AD9\u7ACB\u5E27\uFF09\uFF0C\u80CC\u666F\u77AC\u95F4\u94FA\u6EE1\u5C11\u5973\u6F2B\u753B\u95EA\u5149\u82B1\u6735\uFF0C\u4E0B\u4E00\u62CD\u590D\u539F", ["#f4efe4", "#c9c2b4", "#26232a", "#e8467c"]],
    [2001, "\u8303\u7279\u897F", "Fantasy", "\u7231\u5728\u897F\u5143\u524D", "\u53E4\u5DF4\u6BD4\u4F26\u57CE\u5899", "\u4E24\u6CB3\u6D41\u57DF\u6D6E\u96D5", "\u6D6E\u96D5\u91CC\u4EBA\u4EBA\u4FA7\u8EAB\u884C\u8FDB\uFF0C\u53EA\u6709\u5B9A\u683C\u7684\u4ED6\u6B63\u9762\u7AD9\u7740\uFF1B\u4E0B\u4E00\u62CD\u4ED6\u4E5F\u88AB\u8FEB\u4FA7\u7740\u8EAB\u5B50\u7EE7\u7EED\u8D70", ["#e7d3a8", "#c49a5c", "#4a3320", "#2f6fb0"]],
    [2002, "\u516B\u5EA6\u7A7A\u95F4", "The Eight Dimensions", "\u7237\u7237\u6CE1\u7684\u8336", "\u5C71\u95F4\u8336\u68DA", "\u6C34\u58A8", "\u8001\u4EBA\u659F\u8336\uFF0C\u8336\u6C34\u5012\u6210\u4E00\u9053\u58A8\u7EBF\u4E00\u8DEF\u6D41\u5230\u8DEF\u4E0A\uFF0C\u4ED6\u8E29\u7740\u58A8\u7EBF\u8D70", ["#f2eee3", "#a9a69c", "#1d1d1b", "#7a8c5a"]],
    [2003, "\u53F6\u60E0\u7F8E", "Ye Hui Mei", "\u4EE5\u7236\u4E4B\u540D", "\u54E5\u7279\u6559\u5802", "\u5F69\u8272\u73BB\u7483", "\u4ED6\u8D70\u8FDB\u7A97\u683C\uFF0C\u88AB\u94C5\u6761\u5207\u6210\u4E00\u5757\u5757\u5F69\u8272\u73BB\u7483\uFF0C\u5F3A\u62CD\u4E0A\u4E00\u675F\u5149\u6253\u4E0B", ["#1c2140", "#3b5fa8", "#0c0d14", "#d9a73a"]],
    [2004, "\u4E03\u91CC\u9999", "Common Jasmine Orange", "\u6B62\u6218\u4E4B\u6B87", "\u785D\u70DF\u91CC\u7684\u767D\u9E3D", "\u9ED1\u767D\u6728\u523B\u7248\u753B", "\u4E00\u53EA\u767D\u9E3D\u843D\u5728\u4ED6\u80A9\u4E0A\uFF0C\u662F\u6574\u5E45\u753B\u91CC\u552F\u4E00\u7684\u767D", ["#5b5852", "#2c2a27", "#0e0d0c", "#f6f4ee"]],
    [2005, "\u5341\u4E00\u6708\u7684\u8427\u90A6", "November's Chopin", "\u591C\u66F2", "\u6708\u591C\u91CC\u7684\u4E00\u67B6\u94A2\u7434", "\u9ED1\u767D\u94A2\u7B14\u753B", "\u7434\u76D6\u4E0A\u7684\u4E4C\u9E26\u6392\u6210\u4E00\u884C\u97F3\u7B26\uFF0C\u5F3A\u62CD\u4E0A\u540C\u65F6\u626D\u5934", ["#f3f1ea", "#9b9890", "#151515", "#6c7a96"]],
    [2006, "\u4F9D\u7136\u8303\u7279\u897F", "Still Fantasy", "\u591C\u7684\u7B2C\u4E03\u7AE0", "\u7EF4\u591A\u5229\u4E9A\u96FE\u591C\uFF0C\u4FA6\u63A2", "\u94DC\u7248\u753B", "\u4E00\u53EA\u653E\u5927\u955C\u4ECE\u753B\u5916\u4F38\u8FDB\u6765\uFF0C\u5BF9\u51C6\u4ED6\u8033\u6735\u4E0A\u7684\u8033\u673A", ["#d8cdb4", "#8a7b62", "#2a2219", "#7d5a36"]],
    [2007, "\u6211\u5F88\u5FD9", "On the Run!", "\u6700\u957F\u7684\u7535\u5F71", "\u8001\u7535\u5F71\u9662", "\u80F6\u7247\u5212\u75D5 + 4:3 \u753B\u5E45", "\u753B\u5E45\u7A81\u7136\u7F29\u6210 4:3\uFF0C\u4ED6\u8D70\u5728\u94F6\u5E55\u91CC\uFF0C\u524D\u6392\u89C2\u4F17\u526A\u5F71\u4E00\u8D77\u626D\u5934", ["#2a2622", "#8f8576", "#0d0c0b", "#e8d9b0"]],
    [2008, "\u9B54\u6770\u5EA7", "Capricorn", "\u4E54\u514B\u53D4\u53D4", "\u9A6C\u620F\u56E2\u5C0F\u4E11", "19 \u4E16\u7EAA\u77F3\u7248\u753B\u6D77\u62A5", "\u5C0F\u4E11\u9012\u6765\u4E00\u53EA\u6C14\u7403\uFF0C\u5B9A\u683C\u7684\u4ED6\u88AB\u6574\u4E2A\u5E26\u7740\u98D8\u8D77\u534A\u62CD\uFF0C\u5F3A\u62CD\u843D\u56DE", ["#efe0bf", "#d0533c", "#2b2a3a", "#2f7d6d"]],
    [2010, "\u8DE8\u65F6\u4EE3", "The Era", "\u96E8\u4E0B\u4E00\u6574\u665A", "\u57CE\u5E02\u591C\u96E8", "\u6C34\u5F69\u6655\u67D3", "\u96E8\u6C34\u628A\u989C\u6599\u6655\u5F00\uFF0C\u8FDE\u4ED6\u7684\u4F1E\u90FD\u5316\u6210\u4E00\u6EE9\u989C\u8272\uFF0C\u4E0B\u4E00\u62CD\u6536\u56DE", ["#e9eef2", "#7f9bb5", "#27364a", "#e0a24f"]],
    [2011, "\u60CA\u53F9\u53F7", "Exclamation Point", "\u8FF7\u9B42\u66F2", "\u4E2D\u56FD\u53E4\u4EE3\u76AE\u5F71\u620F", "\u76AE\u5F71", "\u6CB9\u706F\u4E00\u6643\uFF0C\u4ED6\u7684\u76AE\u5F71\uFF08\u540C\u4E00\u5E27\u526A\u5F71\uFF09\u4E00\u5206\u4E3A\u4E09\u5DE6\u53F3\u9519\u5F00\uFF0C\u5F3A\u62CD\u4E0A\u5408\u56DE\u4E00\u4E2A", ["#f0c77a", "#c46a2c", "#3a1d10", "#b8322a"]],
    [2012, "\u5341\u4E8C\u65B0\u4F5C", "Opus 12", "\u7EA2\u5C18\u5BA2\u6808", "\u6B66\u4FA0\u5BA2\u6808", "\u6728\u7248\u5E74\u753B", "\u5E97\u5C0F\u4E8C\u628A\u4ED6\u5F53\u6210\u5927\u4FA0\uFF0C\u62B1\u62F3\u4F5C\u63D6", ["#f1e3c4", "#d4a02f", "#2d1f18", "#c23b2b"]],
    [2014, "\u54CE\u5466\uFF0C\u4E0D\u9519\u54E6", "Aiyo, Not Bad", "\u978B\u5B50\u7279\u5927\u53F7", "\u8721\u7B14\u753B\u7684\u5C0F\u9547", "\u513F\u7AE5\u8721\u7B14\u753B", "\u6BD4\u4F8B\u5168\u9519\uFF0C\u4ED6\u811A\u4E0B\u90A3\u4E00\u622A\u88AB\u5355\u72EC\u653E\u5927\u6210\u7279\u5927\u53F7\u978B\u5B50\uFF0C\u4E00\u6B65\u8DE8\u8FC7\u534A\u4E2A\u753B\u9762", ["#fbf7ec", "#8cc06a", "#3a3a8c", "#f2a33a"]],
    [2016, "\u5468\u6770\u4F26\u7684\u5E8A\u8FB9\u6545\u4E8B", "Bedtime Stories", "\u524D\u4E16\u60C5\u4EBA", "\u6E29\u99A8\u7684\u7236\u5973\u573A\u666F", "\u7AE5\u4E66\u7ED8\u672C\u6C34\u5F69", "\u5C0F\u5973\u5B69\u8E2E\u811A\u7ED9\u5B9A\u683C\u7AD9\u7740\u7684\u4ED6\u6234\u4E0A\u4E00\u9876\u7EB8\u7687\u51A0", ["#fbf1e4", "#e6b8a2", "#5a4a5e", "#e8c25a"]],
    [2022, "\u6700\u4F1F\u5927\u7684\u4F5C\u54C1", "Greatest Works of Art", "\u8FD8\u5728\u6D41\u6D6A", "\u516C\u8DEF\u65C5\u884C", "\u590D\u53E4\u660E\u4FE1\u7247", "\u4E00\u4E2A\u90AE\u6233\u300C\u556A\u300D\u5730\u76D6\u5728\u4ED6\u8EAB\u4E0A\uFF0C\u65E5\u671F 2022", ["#f0e2c4", "#5aa0b4", "#3a2c24", "#d6643a"]],
    [2026, "\u592A\u9633\u4E4B\u5B50", "Children of the Sun", "\u90A3\u5929\u4E0B\u96E8\u4E86", "\u96E8\u591C\u516C\u4EA4\u7AD9\u53F0\uFF0C\u4E00\u7537\u4E00\u5973\u5404\u6253\u4E00\u628A\u4F1E", "\u7535\u5F71\u611F\u539A\u6D82\u63D2\u753B\uFF0C\u8DEF\u706F\u6696\u5149\u5BF9\u51B7\u96E8", "\u516C\u4EA4\u8F66\u9A76\u8FC7\u6E85\u8D77\u6C34\u82B1\uFF0C\u4E24\u628A\u4F1E\u5728\u5F3A\u62CD\u4E0A\u540C\u65F6\u4E00\u6B6A\uFF08\u4ED6\u7684\u4F1E\u753B\u5728\u7AD9\u7ACB\u5E27\u7684\u624B\u4E0A\uFF09", ["#1b2230", "#3d5670", "#0a0e15", "#f0b25a"]]
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

  // src/rig/styles.js
  var STATION_STYLE = {
    1: "halftone",
    2: "relief",
    3: "ink",
    4: "stained",
    5: "woodcut",
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
    const M = new Float32Array(w * h);
    const at = (x, y) => L[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      M[y * w + x] = Math.hypot(gx, gy);
    }
    return M;
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
  function hatchStyle(src, { paper, ink, angle1 = 0.8, angle2 = -0.8, gap = 5, solid = 0.1, l1 = 0.62, l2 = 0.38, edge = 0.45, lw = 2, jitter = 0.6 }) {
    const S = smoothColor(src, 1.5);
    const O = clone(S);
    const L = lumaArray(S, 0.6);
    const E = sobel(L, S.w, S.h);
    const P = rgbf(paper), K2 = rgbf(ink);
    const c1 = Math.cos(angle1), s1 = Math.sin(angle1), c2 = Math.cos(angle2), s2 = Math.sin(angle2);
    for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
      const i = y * S.w + x;
      if (S.a[i] < 0.02) continue;
      const l = L[i];
      const wob = noise2(x * 0.08, y * 0.08, 5) * jitter * gap;
      const h1 = Math.abs(((x * c1 + y * s1 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l1 * 0.32);
      const h2 = Math.abs(((x * c2 + y * s2 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l2 * 0.36);
      let on = l < solid || l < l1 && h1 || l < l2 && h2 || E[i] > edge;
      const c = on ? K2 : P;
      O.r[i] = c[0];
      O.g[i] = c[1];
      O.b[i] = c[2];
      O.a[i] = S.a[i] > 0.5 ? 1 : S.a[i];
    }
    outline(O, src.a, lw, K2);
    return O;
  }
  var STYLES = {
    none: (I) => I,
    comic: (I) => comicBase(I),
    pencil: (I) => {
      const O = comicBase(I, { levels: 5, keep: 0.3, lw: 1.4, ink: "#3a3129" });
      const P = rgbf("#efe6d2");
      for (let i = 0; i < O.w * O.h; i++) {
        O.r[i] += (P[0] - O.r[i]) * 0.42;
        O.g[i] += (P[1] - O.g[i]) * 0.42;
        O.b[i] += (P[2] - O.b[i]) * 0.42;
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
    woodcut: (I) => hatchStyle(comicBase(I, { levels: 3, keep: 0, lw: 0 }), { paper: "#8d887e", ink: "#0e0d0c", angle1: 0.15, angle2: 0.15, gap: 6, solid: 0.2, l1: 0.7, l2: 0.01, edge: 0.6, lw: 2.6, jitter: 1.2 }),
    pen: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: "#f3f1ea", ink: "#151515", gap: 4, solid: 0.06, l1: 0.6, l2: 0.32, edge: 0.4, lw: 1.6 }),
    etching: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: "#d8cdb4", ink: "#2a2219", angle1: 0.5, angle2: -1.1, gap: 3.4, solid: 0.05, l1: 0.66, l2: 0.36, edge: 0.4, lw: 1.4, jitter: 0.3 }),
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
        const streak = noise2((x + y) * 0.9, (x - y) * 0.05, 11);
        const gap = streak > 0.72 ? 0.6 : 0;
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
      const warm = rgbf("#f0b25a");
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w - 4; x++) {
        const i = y * O.w + x;
        if (O.a[i] < 0.01) continue;
        O.r[i] *= 0.86;
        O.g[i] *= 0.93;
        O.b[i] = Math.min(1, O.b[i] * 1.08 + 0.02);
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
    const k = m.strikes[1], P = m.frames;
    const c = (phase % 2 + 2) % 2;
    const f = c < 1 ? c * k : k + (c - 1) * (P - k);
    return Math.min(P - 1, Math.floor(f + 1e-6));
  }
  function drawWalker(ctx, o = {}) {
    if (!active) return;
    const m = active.meta;
    const s = FIGURE_H / m.personHeight;
    const stand = o.pose === "stand";
    const idx = stand ? -1 : o.frame ?? frameIndex(o.phase || 0);
    const src = stand ? active.stand : active.frames[idx];
    if (!src) return;
    const img = styledFrame(`${active.name}/${stand ? "stand" : idx}`, src, o.style);
    ctx.save();
    if (o.lean) ctx.rotate(o.lean);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
    ctx.restore();
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

  // src/scenes/index.js
  var SCENES = { intro };
  for (const st of STATIONS) SCENES[st.id] = placeholderScene(st);

  // src/main/walk.js
  var DOWNBEATS = sections.filter((s) => s.station).map((s) => s.start);
  var FREEZE = [SB(5), SB(7)];
  var BOOST_FROM = -0.55;
  var BOOST_LEN = 0.8;
  var BOOST_AMP = 0.45;
  var RAMP = 0.2;
  var speed = 105;
  var table = null;
  var RES = 64;
  function setWalkSpeed(v) {
    speed = v;
    table = null;
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
    table = new Float64Array(n + 1);
    let acc2 = 0;
    for (let i = 0; i < n; i++) {
      table[i] = acc2;
      acc2 += rate((i + 0.5) / RES) / RES;
    }
    table[n] = acc2;
  }
  function dist(gb) {
    if (!table) build();
    if (gb <= 0) return speed * gb;
    const x = gb * RES, i = Math.floor(x);
    if (i >= table.length - 1) return table[table.length - 1] + speed * (gb - (table.length - 1) / RES);
    return table[i] + (table[i + 1] - table[i]) * (x - i);
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
  function drawFigureFor(ctx, env, { forceStand = false } = {}) {
    const { scene, sec, b } = env;
    const adj = scene.figureAdjust && scene.figureAdjust(b, env) || {};
    if (adj.hidden) return;
    const st = figureState(env.gbq, env);
    const fig = {
      pose: forceStand ? "stand" : adj.pose || st.pose,
      phase: st.phase,
      lean: st.lean + (adj.rotate || 0),
      style: adj.style || scene.figureStyle || (sec.station ? STATION_STYLE[sec.station] : "comic")
    };
    ctx.save();
    applyUnits(ctx);
    ctx.translate(CHAR_X + (adj.dx || 0), ROAD_Y + (adj.dy || 0));
    if (adj.scale) ctx.scale(adj.scale, adj.scale);
    if (adj.alpha !== void 0) ctx.globalAlpha = adj.alpha;
    if (scene.drawFigure) scene.drawFigure(ctx, fig, b, env);
    else drawWalker(ctx, fig);
    ctx.restore();
  }
  function drawSection(ctx, sec, gb, { figure = true, stand = false } = {}) {
    const env = envFor(sec, gb);
    drawSceneLayers(ctx, env, { front: false });
    if (figure) drawFigureFor(ctx, env, { forceStand: stand });
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
    const P = W0.meta.frames, rows = Math.ceil(P / cols);
    const cw = 190, chh = Math.round(FIGURE_H * scale) + 70;
    const sheet = makeCanvas(cols * cw + 20, rows * chh + 60);
    const sc = sheet.getContext("2d");
    sc.fillStyle = "#f3efe6";
    sc.fillRect(0, 0, sheet.width, sheet.height);
    font(sc, 24, { family: SANS, weight: 700 });
    sc.fillStyle = "#333";
    sc.fillText(`\u8D70\u8DEF\u5FAA\u73AF \xB7 ${W0.meta.source} \xB7 ${P} \u5E27 = 2 \u62CD \xB7 \u2605 = \u843D\u5728\u62CD\u4E0A\u7684\u811A\u8DDF\u7740\u5730\u5E27\uFF08\u7B2C ${W0.meta.strikes.join("\u3001")} \u5E27\uFF09`, 12, 34);
    for (let i = 0; i < P; i++) {
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
        beatAt,
        timeAtBeat,
        setGrid
      };
      if (!RENDER) setupPreview(p, canvas, ctx);
      else renderAt(ctx, 0);
    };
  });
})();
