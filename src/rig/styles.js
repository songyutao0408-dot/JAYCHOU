// 人物帧序列的画风转换（逐像素，结果按「套/帧/画风」缓存，所以仍是时间的纯函数）。
// 所有站先统一做一层漫画化（平滑 → 色块简化 → 描边），降低真人感；再叠加各站自己的处理。
// 第 16 站电影感厚涂保留更多原貌。
import { makeCanvas, memo } from '../kit/canvas.js';
import { hexToRgb } from '../kit/color.js';
import { hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';

/** 各站使用的人物画风。 */
export const STATION_STYLE = {
  1: 'halftone', 2: 'relief', 3: 'ink', 4: 'stained', 5: 'sketch', 6: 'pen', 7: 'etching', 8: 'film',
  9: 'litho', 10: 'watercolor-cool', 11: 'puppet', 12: 'nianhua', 13: 'crayon', 14: 'watercolor-warm',
  15: 'postcard', 16: 'cinematic',
};
export const STYLE_LABEL = {
  none: '原样', comic: '漫画化底层', pencil: '铅笔纸面', halftone: '漫画网点', relief: '浮雕', ink: '水墨', stained: '彩色玻璃',
  woodcut: '木刻', sketch: '铅笔素描', 'sketch-color': '素描上色', pen: '钢笔排线', etching: '铜版排线', film: '老胶片', litho: '石版', 'watercolor-cool': '水彩（冷）',
  puppet: '皮影', nianhua: '年画', crayon: '蜡笔', 'watercolor-warm': '水彩（暖）', postcard: '明信片', cinematic: '电影感厚涂',
};

// ---------- 基础：浮点图像 ----------
function fromImage(src) {
  const w = src.width, h = src.height;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0);
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const I = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
  for (let i = 0; i < n; i++) {
    I.r[i] = d[i * 4] / 255; I.g[i] = d[i * 4 + 1] / 255; I.b[i] = d[i * 4 + 2] / 255; I.a[i] = d[i * 4 + 3] / 255;
  }
  return I;
}
function toCanvas(I) {
  const c = makeCanvas(I.w, I.h);
  const ctx = c.getContext('2d');
  const im = ctx.createImageData(I.w, I.h);
  const d = im.data;
  for (let i = 0; i < I.w * I.h; i++) {
    d[i * 4] = I.r[i] * 255; d[i * 4 + 1] = I.g[i] * 255; d[i * 4 + 2] = I.b[i] * 255; d[i * 4 + 3] = I.a[i] * 255;
  }
  ctx.putImageData(im, 0, 0);
  return c;
}
const clone = (I) => ({ w: I.w, h: I.h, r: I.r.slice(), g: I.g.slice(), b: I.b.slice(), a: I.a.slice() });
const luma = (I, i) => 0.299 * I.r[i] + 0.587 * I.g[i] + 0.114 * I.b[i];
const rgbf = (hex) => hexToRgb(hex).map((v) => v / 255);
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** 可分离的盒式模糊（多次近似高斯）。 */
function blur(ch, w, h, r, passes = 2) {
  if (r < 1) return ch.slice();
  let src = ch.slice(), tmp = new Float32Array(ch.length);
  const R = Math.round(r), win = 2 * R + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      let acc = 0; const o = y * w;
      for (let x = -R; x <= R; x++) acc += src[o + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc / win;
        acc += src[o + Math.min(w - 1, x + R + 1)] - src[o + Math.max(0, x - R)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -R; y <= R; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc / win;
        acc += tmp[Math.min(h - 1, y + R + 1) * w + x] - tmp[Math.max(0, y - R) * w + x];
      }
    }
  }
  return src;
}
/** 带透明度的平滑：预乘后模糊再还原，边缘不发灰。 */
function smoothColor(I, r) {
  const n = I.w * I.h;
  const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
  for (let i = 0; i < n; i++) { pr[i] = I.r[i] * I.a[i]; pg[i] = I.g[i] * I.a[i]; pb[i] = I.b[i] * I.a[i]; }
  const br = blur(pr, I.w, I.h, r), bg = blur(pg, I.w, I.h, r), bb = blur(pb, I.w, I.h, r), ba = blur(I.a, I.w, I.h, r);
  const O = clone(I);
  for (let i = 0; i < n; i++) if (ba[i] > 0.01) { O.r[i] = br[i] / ba[i]; O.g[i] = bg[i] / ba[i]; O.b[i] = bb[i] / ba[i]; }
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

// ---------- 漫画化底层：平滑 → 色块简化 → 描边 ----------
/**
 * levels：亮度分几档；keep：保留原图细节的比例；lw：外轮廓粗细（像素）；inner：内部线条阈值（越大线越少）
 */
export function comicBase(src, { levels = 4, keep = 0.18, lw = 2.2, inner = 0.55, ink = '#141110', smooth = 2 } = {}) {
  const S = smoothColor(src, smooth);
  const O = clone(S);
  const n = S.w * S.h;
  const G = 0.55; // 在 gamma 空间里分档，暗部（黑衣服）也能分出层次
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
  // 内部线条：平滑后亮度的边缘；皮肤区域（脸、手）用更细的图、更低的阈值，保住五官
  const L = lumaArray(S, G);
  const E = sobel(L, S.w, S.h);
  const F = sobel(lumaArray(smoothColor(src, 0.6), G), S.w, S.h);
  const ic = rgbf(ink);
  for (let i = 0; i < n; i++) {
    if (S.a[i] < 0.5) continue;
    const skin = src.r[i] > 0.38 && src.r[i] > src.g[i] && src.g[i] > src.b[i] && src.r[i] - src.b[i] > 0.1;
    const e = skin ? sstep(inner * 0.55, inner * 0.55 + 0.3, F[i]) * 0.85 : sstep(inner, inner + 0.35, E[i]);
    if (e > 0) { O.r[i] += (ic[0] - O.r[i]) * e; O.g[i] += (ic[1] - O.g[i]) * e; O.b[i] += (ic[2] - O.b[i]) * e; }
  }
  // 外轮廓：把透明度向外扩一圈，扩出来的部分涂成墨色
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
  // 原有的半透明边缘也压成墨色，轮廓更干净
  for (let i = 0; i < D.length; i++) {
    if (alpha[i] > 0.02 && alpha[i] < 0.9) {
      const t = 1 - alpha[i];
      O.r[i] += (ic[0] - O.r[i]) * t; O.g[i] += (ic[1] - O.g[i]) * t; O.b[i] += (ic[2] - O.b[i]) * t;
      O.a[i] = Math.max(O.a[i], 0.95);
    }
  }
}

// ---------- 各站处理 ----------
function mapTone(I, stops) {
  // 按亮度在若干颜色之间插值（stops：从暗到亮的 hex 列表）
  const C = stops.map(rgbf), n = C.length - 1;
  for (let i = 0; i < I.w * I.h; i++) {
    if (I.a[i] < 0.01) continue;
    const l = Math.min(0.9999, Math.max(0, luma(I, i))) * n;
    const k = Math.floor(l), t = l - k;
    const c = mixc(C[k], C[k + 1], t);
    I.r[i] = c[0]; I.g[i] = c[1]; I.b[i] = c[2];
  }
  return I;
}
function hatchStyle(src, { paper, ink, angle1 = 0.8, angle2 = -0.8, gap = 5, solid = 0.1, l1 = 0.62, l2 = 0.38, edge = 0.45, lw = 2, jitter = 0.6, halo = null, haloW = 4 }) {
  // 刻线 / 排线：外轮廓 + 内部边缘 + 按暗度叠两组平行线，最暗处实涂
  const S = smoothColor(src, 1.5);
  const O = clone(S);
  const L = lumaArray(S, 0.6);
  const E = sobel(L, S.w, S.h);
  const P = rgbf(paper), K = rgbf(ink);
  const c1 = Math.cos(angle1), s1 = Math.sin(angle1), c2 = Math.cos(angle2), s2 = Math.sin(angle2);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const i = y * S.w + x;
    if (S.a[i] < 0.02) continue;
    const l = L[i];
    const wob = noise2(x * 0.08, y * 0.08, 5) * jitter * gap;
    const h1 = Math.abs(((x * c1 + y * s1 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l1 * 0.32);
    const h2 = Math.abs(((x * c2 + y * s2 + wob) % gap + gap) % gap - gap / 2) < gap * (0.5 - l / l2 * 0.36);
    let on = l < solid || (l < l1 && h1) || (l < l2 && h2) || E[i] > edge;
    const c = on ? K : P;
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
    O.a[i] = S.a[i] > 0.5 ? 1 : S.a[i];
  }
  outline(O, src.a, lw, K);
  // 木刻里主体外缘常留一圈浅色「让刀」，把人物和满是刻线的背景分开
  if (halo) outline(O, O.a.slice(), haloW, rgbf(halo));
  return O;
}

// 铅笔素描：纸色垫底（挡住背景线条）+ 边缘线 + 暗部斜向排线 + 铅笔颗粒。color=true 时先铺一层水彩。
function sketchStyle(I, color) {
  const S = smoothColor(I, 1.2);
  const O = clone(S);
  const n = S.w * S.h;
  const L = lumaArray(S, 0.6);
  const E = sobel(L, S.w, S.h);
  const F = sobel(lumaArray(smoothColor(I, 0.6), 0.6), S.w, S.h);
  const paper = rgbf('#f6efe0'), lead = rgbf('#4f4a44'), indigo = rgbf('#8592ad');
  const W = color ? smoothColor(I, 3) : null;
  const A = blur(I.a, S.w, S.h, 3);
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const i = y * S.w + x;
    if (I.a[i] < 0.02) continue;
    let base = paper;
    if (color) {
      // 水彩：原色向纸色提亮；黑衣服画成靛蓝色的淡彩；边缘积一点色
      let c = [W.r[i], W.g[i], W.b[i]];
      const l = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      c = mixc(c, paper, 0.4);
      if (l < 0.3) c = mixc(indigo, c, l / 0.3);
      const pool = Math.max(0, 0.75 - A[i]) * 0.5;
      base = mixc(c, [c[0] * 0.8, c[1] * 0.8, c[2] * 0.85], pool);
      const g = (noise2(x * 0.3, y * 0.3, 41) - 0.5) * 0.08;
      base = [base[0] + g, base[1] + g, base[2] + g];
    }
    const l = L[i];
    const skin = I.r[i] > 0.38 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
    // 线：外形边缘 + 内部边缘（皮肤处更细的边保五官）
    let ink = Math.max(sstep(0.5, 0.95, E[i]), skin ? sstep(0.3, 0.6, F[i]) * 0.9 : 0);
    // 暗部排线（45° 一组，更暗处再加一组反向）
    const g1 = ((x + y) % 5 + 5) % 5 < 1.1, g2 = ((x - y) % 6 + 6) % 6 < 1.0;
    if (l < 0.42 && g1) ink = Math.max(ink, 0.55 * (1 - l / 0.42) + 0.25);
    if (l < 0.2 && g2) ink = Math.max(ink, 0.5);
    ink *= 0.75 + 0.35 * noise2(x * 0.5, y * 0.5, 17); // 铅笔颗粒
    ink = Math.min(1, ink) * (color ? 0.85 : 1);
    O.r[i] = base[0] + (lead[0] - base[0]) * ink;
    O.g[i] = base[1] + (lead[1] - base[1]) * ink;
    O.b[i] = base[2] + (lead[2] - base[2]) * ink;
    O.a[i] = I.a[i] > 0.5 ? (color ? 1 : 0.94) : I.a[i];
  }
  outline(O, I.a, 1.3, lead);
  return O;
}

const STYLES = {
  none: (I) => I,
  comic: (I) => comicBase(I),
  sketch: (I) => sketchStyle(I, false),
  'sketch-color': (I) => sketchStyle(I, true),
  pencil: (I) => {
    const O = comicBase(I, { levels: 5, keep: 0.3, lw: 1.4, ink: '#3a3129' });
    const P = rgbf('#efe6d2');
    for (let i = 0; i < O.w * O.h; i++) { O.r[i] += (P[0] - O.r[i]) * 0.42; O.g[i] += (P[1] - O.g[i]) * 0.42; O.b[i] += (P[2] - O.b[i]) * 0.42; }
    return O;
  },
  halftone: (I) => {
    // 漫画网点：灰阶 + 网点 + 粗黑描边
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
        // 45° 网格上的圆点，暗处点大
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
    // 浮雕：砂岩色调 + 由轮廓推出的凹凸光影
    const O = mapTone(comicBase(I, { levels: 3, keep: 0.1, lw: 1.6, ink: '#5a3f22' }), ['#6b4a2b', '#b08550', '#e3c999']);
    const A = blur(I.a, O.w, O.h, 3);
    for (let y = 1; y < O.h - 1; y++) for (let x = 1; x < O.w - 1; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      const e = (A[i - O.w - 1] - A[i + O.w + 1]) * 1.8; // 光从左上
      O.r[i] = Math.min(1, Math.max(0, O.r[i] + e)); O.g[i] = Math.min(1, Math.max(0, O.g[i] + e)); O.b[i] = Math.min(1, Math.max(0, O.b[i] + e * 0.8));
    }
    return O;
  },
  ink: (I) => {
    // 水墨：三档墨色 + 晕开的边 + 毛笔描边
    const O = comicBase(I, { levels: 3, keep: 0.05, lw: 2.4, inner: 0.6, ink: '#151514', smooth: 3 });
    mapTone(O, ['#1a1a19', '#5d5c58', '#a9a69c', '#e9e5da']);
    const R = blur(O.r, O.w, O.h, 2), A = blur(O.a, O.w, O.h, 2);
    for (let i = 0; i < O.w * O.h; i++) {
      const v = O.r[i] * 0.55 + R[i] * 0.45;
      O.r[i] = O.g[i] = v; O.b[i] = v * 0.98;
      O.a[i] = Math.max(O.a[i] * 0.92, A[i] * 0.8);
    }
    return O;
  },
  stained: (I) => {
    // 彩色玻璃：抖动网格的小块（取块内平均亮度映射到玻璃色）+ 铅条
    const O = comicBase(I, { levels: 4, keep: 0.1, lw: 3, ink: '#0b0b10' });
    const cell = 16, w = O.w, h = O.h;
    const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3; // 网格：gx、gy 从 -1 开始
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
        const s = seeds[k]; if (!s) continue;
        const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
        if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
      }
      near[i] = k1; first[i] = Math.sqrt(d1); second[i] = Math.sqrt(d2);
    }
    const sum = new Map();
    for (let i = 0; i < w * h; i++) {
      if (O.a[i] < 0.5) continue;
      const s = sum.get(near[i]) || [0, 0];
      s[0] += luma(O, i); s[1]++;
      sum.set(near[i], s);
    }
    const glass = ['#14204f', '#1f4aa8', '#7b2a6e', '#c1832a', '#e8c25a'].map(rgbf);
    for (let i = 0; i < w * h; i++) {
      if (O.a[i] < 0.02) continue;
      const s = sum.get(near[i]);
      const l = s ? s[0] / s[1] : 0.2;
      const k = Math.min(glass.length - 1, Math.floor(l * glass.length * 1.1));
      const lead = second[i] - first[i] < 1.6;
      const isEdge = O.r[i] < 0.08 && O.g[i] < 0.08 && O.b[i] < 0.1;
      const c = lead || isEdge ? [0.04, 0.04, 0.06] : glass[k];
      const v = 0.85 + 0.15 * noise2(i % w * 0.2, (i / w) * 0.2, 9);
      O.r[i] = c[0] * v; O.g[i] = c[1] * v; O.b[i] = c[2] * v;
    }
    return O;
  },
  woodcut: (I) => hatchStyle(comicBase(I, { levels: 3, keep: 0, lw: 0 }), { paper: '#8d887e', ink: '#0e0d0c', angle1: 0.15, angle2: 0.15, gap: 6, solid: 0.2, l1: 0.7, l2: 0.01, edge: 0.6, lw: 2.6, jitter: 1.2, halo: '#b3ada1', haloW: 5 }),
  pen: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: '#f3f1ea', ink: '#151515', gap: 4, solid: 0.06, l1: 0.6, l2: 0.32, edge: 0.4, lw: 1.6 }),
  etching: (I) => hatchStyle(comicBase(I, { levels: 4, keep: 0.2, lw: 0 }), { paper: '#d8cdb4', ink: '#2a2219', angle1: 0.5, angle2: -1.1, gap: 3.4, solid: 0.05, l1: 0.66, l2: 0.36, edge: 0.4, lw: 1.4, jitter: 0.3 }),
  film: (I) => {
    // 老胶片：高反差灰阶 + 微微泛黄
    const O = comicBase(I, { levels: 5, keep: 0.3, lw: 1.8 });
    for (let i = 0; i < O.w * O.h; i++) {
      const l = Math.pow(luma(O, i), 0.9);
      const v = sstep(0.02, 0.95, l);
      O.r[i] = v * 0.98 + 0.02; O.g[i] = v * 0.94 + 0.02; O.b[i] = v * 0.84 + 0.02;
    }
    return O;
  },
  litho: (I) => {
    // 石版海报：三色套印 + 颗粒
    const O = comicBase(I, { levels: 3, keep: 0, lw: 2.6, ink: '#2b2a3a' });
    const C = ['#2b2a3a', '#d0533c', '#efe0bf'].map(rgbf);
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i) + (hash2(x, y, 7) - 0.5) * 0.18;
      const c = l < 0.24 ? C[0] : l < 0.42 ? C[1] : C[2];
      O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
    }
    return O;
  },
  'watercolor-cool': (I) => watercolor(I, ['#27364a', '#4f6f93', '#9db7cf', '#eef2f4'], 0.75),
  'watercolor-warm': (I) => watercolor(I, ['#5a4a5e', '#b07f78', '#e6b8a2', '#fbf1e4'], 0.7),
  puppet: (I) => {
    // 皮影：半透明的染色皮件，亮处镂出雕花小孔，深色粗轮廓
    const O = comicBase(I, { levels: 3, keep: 0, lw: 3, ink: '#2a120a' });
    const dark = rgbf('#3a1d10'), mid = rgbf('#9c3d1e'), lite = rgbf('#e08a3c');
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i);
      let c = l < 0.18 ? dark : l < 0.5 ? mixc(dark, mid, (l - 0.18) / 0.32) : mixc(mid, lite, Math.min(1, (l - 0.5) / 0.4));
      const cell = 9, cx = (x % cell) - cell / 2, cy = (y % cell) - cell / 2;
      const hole = l > 0.3 && cx * cx + cy * cy < (l - 0.2) * 24;
      O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
      O.a[i] = hole ? 0 : Math.min(O.a[i], 0.93);
    }
    return O;
  },
  nianhua: (I) => {
    // 木版年画：平涂饱和色 + 粗黑线
    const O = comicBase(I, { levels: 3, keep: 0, lw: 3.2, inner: 0.45 });
    const C = ['#1d1612', '#2a3f7a', '#e0a77a', '#f4d9b8'].map(rgbf);
    for (let i = 0; i < O.w * O.h; i++) {
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i);
      const c = l < 0.1 ? C[0] : l < 0.26 ? C[1] : l < 0.5 ? C[2] : C[3];
      O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
    }
    return O;
  },
  crayon: (I) => {
    // 儿童蜡笔：三色、斜向笔触留白、粗而抖的轮廓
    const O = comicBase(I, { levels: 3, keep: 0, lw: 3.4, ink: '#2b2b6e', smooth: 3 });
    const C = ['#3a3a8c', '#8cc06a', '#f2a33a', '#fbe3b8'].map(rgbf);
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      const l = luma(O, i);
      const c = l < 0.12 ? [0.17, 0.17, 0.43] : l < 0.3 ? C[0] : l < 0.45 ? C[2] : C[3];
      const streak = noise2((x + y) * 0.9, (x - y) * 0.05, 11);
      const gap = streak > 0.72 ? 0.6 : 0;
      O.r[i] = c[0] + (1 - c[0]) * gap; O.g[i] = c[1] + (1 - c[1]) * gap; O.b[i] = c[2] + (1 - c[2]) * gap;
    }
    return O;
  },
  postcard: (I) => {
    // 复古明信片：青橙双色 + 细网点 + 套色错位
    const O = comicBase(I, { levels: 4, keep: 0.15, lw: 1.8, ink: '#3a2c24' });
    mapTone(O, ['#3a2c24', '#2f6f7e', '#d6843a', '#f0e2c4']);
    const shifted = O.r.slice();
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      const j = y * O.w + Math.max(0, x - 2);
      const u = (x + y) / 3.2, w2 = (x - y) / 3.2;
      const d = Math.hypot(u - Math.round(u), w2 - Math.round(w2));
      const dot = d < 0.38 ? 0.94 : 1;
      O.r[i] = shifted[j] * dot; O.g[i] *= dot; O.b[i] *= dot;
    }
    return O;
  },
  cinematic: (I) => {
    // 电影感厚涂：保留更多原貌，轻微色块化；冷色调 + 右侧（路灯一侧）暖色轮廓光
    const O = comicBase(I, { levels: 7, keep: 0.5, lw: 1.2, inner: 0.9, smooth: 1.5 });
    const warm = rgbf('#f0b25a');
    for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w - 4; x++) {
      const i = y * O.w + x;
      if (O.a[i] < 0.01) continue;
      // 冷调
      O.r[i] *= 0.86; O.g[i] *= 0.93; O.b[i] = Math.min(1, O.b[i] * 1.08 + 0.02);
      // 轮廓光：只在人物右侧（路灯一侧）紧贴边缘的几个像素
      if (I.a[i] > 0.5) {
        const d = I.a[i + 1] < 0.5 ? 1 : I.a[i + 2] < 0.5 ? 0.75 : I.a[i + 3] < 0.5 ? 0.4 : 0;
        if (d > 0) { const k = d * 0.75; O.r[i] += (warm[0] - O.r[i]) * k; O.g[i] += (warm[1] - O.g[i]) * k; O.b[i] += (warm[2] - O.b[i]) * k; }
      }
    }
    return O;
  },
};

function watercolor(I, stops, light) {
  // 水彩：大幅平滑 → 映射到调色板 → 边缘积色 → 颗粒 → 羽化的边
  const S = smoothColor(I, 3);
  const O = comicBase(S, { levels: 4, keep: 0.25, lw: 0, inner: 0.9, smooth: 2 });
  mapTone(O, stops);
  const A = blur(I.a, O.w, O.h, 2);
  const Ab = blur(I.a, O.w, O.h, 5);
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
    const i = y * O.w + x;
    if (A[i] < 0.01) continue;
    const edge = Math.max(0, A[i] - Ab[i]) * 1.6;      // 边缘积色
    const gran = (noise2(x * 0.35, y * 0.35, 21) - 0.5) * 0.12;
    const k = 1 - edge * 0.35 + gran;
    O.r[i] = Math.min(1, O.r[i] * k + (1 - light) * 0.04); O.g[i] = Math.min(1, O.g[i] * k); O.b[i] = Math.min(1, O.b[i] * k);
    O.a[i] = Math.min(1, A[i] * 1.05) * (0.88 + 0.12 * noise2(x * 0.05, y * 0.05, 22));
  }
  return O;
}

/** 处理后的帧（按 key 缓存）。 */
export function styledFrame(key, src, style) {
  if (!style || style === 'none') return src;
  return memo(`fig|${key}|${style}`, () => {
    const fn = STYLES[style] || STYLES.comic;
    return toCanvas(fn(fromImage(src)));
  });
}
export const STYLE_NAMES = Object.keys(STYLES);
