// 水彩共用渲染（第 10 站建立，第 14 站复用）。全部是 Canvas2D、确定性（只用 seed，不用 Math.random），
// 适合在 strip / baked 里预烘焙；标了「每帧可用」的函数足够便宜，可以每帧画。
// 调色板不写死：所有颜色都由调用方传入（第 10 站冷色蓝调，第 14 站暖色绘本）。
//
//   纸        wcPaper(w, h, o)                      水彩纸（冷压纸的颗粒 + 斑驳 + 纤维，像素尺寸，缓存）
//             paperTooth(w, h, o)                   纸纹叠加层（白底灰颗粒，用 multiply 叠在整幅画上，「纸纹透出」）
//             deckle(w, h, o)                       毛边留白：画面四周不规则的纸白（像颜料没刷到边）
//   形状      blobPts(cx, cy, rx, ry, o)            噪声轮廓的水渍 / 色团
//             roughPoly(pts, o)                     多边形边缘加抖动（水彩的不齐边）
//   晕染      wash(ctx, shape, o)                   核心：一块透明水彩（湿边、边缘积色、颜料斑驳、颗粒、回流花）
//             skyWash(ctx, x0, y0, x1, y1, stops, o) 湿画法渐变天空：竖向渐变 + 横向晕开的色带 + 回流花
//             dab(ctx, x, y, r, color, o)           小色点（亮窗、树叶）：带积色边，不用离屏，每帧可用
//             glow(ctx, x, y, r, color, a)          光晕（screen 叠加），每帧可用
//   笔触      dryBrush(ctx, pts, o)                 干笔：断续、带飞白的线（灯杆、窗框、画框）
//             streak(ctx, x, y0, y1, o)             湿路面上的竖向倒影色带（被水纹打断的横向碎笔）
//             wetRoad(ctx, x0, x1, y0, y1, o)       湿路面底色：渐变 + 横向水纹 + 留白高光
//   效果      runDown(ctx, src, rect, amount, o)    颜料流淌：整张图按列向下拖出色痕（每帧可用，低分辨率）
//             captureUnits(key, draw)               把一段单位坐标的绘制先画进离屏全屏画布（给 runDown 用）
//   装裱      wcCard(w, h, o)                       水彩纸卡片（标题卡 / 歌名签），四周晕染边，缓存
//             wcFrameImage(o) / drawWcFrame(ctx, R, o)  水彩刷出的画框（离场画框，像素坐标）
//             wcDisc(r, o)                          水彩色环的 CD 盘面（缓存）
//
// 坐标：函数在 ctx 当前变换下作画，长度用当前坐标系的单位。用到离屏 / 模糊的函数需要 o.px（每单位多少像素），
// 在 strip 里作画时传 K（1.08），像素坐标作画时传 1。
import { baked, makeCanvas, memo } from './canvas.js';
import { hash2, rng } from './rng.js';
import { noise2, fbm } from './noise.js';
import { mix, rgba, hexToRgb } from './color.js';
import { clamp, lerp, smoothstep } from './math.js';
import { K, X_MIN, X_MAX, W as CANVAS_W, H as CANVAS_H } from '../main/layout.js';

/** 常用纸色（调用方也可以自己给）。 */
export const WC_PAPER = { cool: '#f5f3ee', warm: '#fbf4e6', white: '#fbfaf6' };

// ---------- 内部：离屏草稿、可平铺噪声 ----------
const scratches = {};
function scratch(name, w, h) {
  // 按尺寸分档复用：草稿画布不能比需要的大太多，否则 blur 滤镜会按整张画布开图层，很慢
  w = Math.max(1, Math.ceil(w)); h = Math.max(1, Math.ceil(h));
  const bw = Math.ceil(w / 128) * 128, bh = Math.ceil(h / 128) * 128;
  const key = `${name}|${bw}|${bh}`;
  let c = scratches[key];
  if (!c) { c = makeCanvas(bw, bh); scratches[key] = c; }
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
  g.clearRect(0, 0, w + 2, h + 2);
  return c;
}
/** 周期为 P 的值噪声（平铺不接缝）。 */
function pnoise(x, y, P, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const f = (t) => t * t * (3 - 2 * t);
  const m = (v) => ((v % P) + P) % P;
  const h = (a, b) => hash2(m(a), m(b), seed);
  const u = f(xf), v = f(yf);
  const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** 可平铺的云状噪声块（alpha 通道），给颜料斑驳用。 */
function cloudTile(seed = 1) {
  return memo(`wc-cloud|${seed}`, () => {
    const T = 256, c = makeCanvas(T, T), g = c.getContext('2d'), im = g.createImageData(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let s = 0, a = 0.5, n = 0;
      for (let o = 0; o < 4; o++) { const P = 4 << o; s += a * pnoise((x / T) * P, (y / T) * P, P, seed + o * 13); n += a; a *= 0.5; }
      const v = smoothstep(0.35, 0.75, s / n);
      const i = (y * T + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = v * 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
/** 颗粒块：dark=false 为纸白斑点（颜料没沉进纸纹的地方），true 为颜料沉积的深色颗粒。 */
function grainTile(seed = 1, dark = false) {
  return memo(`wc-grain|${seed}|${dark}`, () => {
    const T = 192, c = makeCanvas(T, T), g = c.getContext('2d'), im = g.createImageData(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      // 冷压纸的「凸起」：细的周期噪声 + 一点高频（颗粒要细、要淡，粗了会显脏）
      const t = pnoise(x / 3, y / 3, T / 3, seed) * 0.65 + pnoise(x / 8, y / 8, T / 8, seed + 3) * 0.2 + hash2(x, y, seed + 5) * 0.15;
      const v = dark ? smoothstep(0.66, 0.95, t) * 0.8 : smoothstep(0.58, 0.92, 1 - t);
      const i = (y * T + x) * 4;
      const col = dark ? 0 : 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = col; im.data[i + 3] = v * 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
function patternFor(g, tile, seed, scale = 1) {
  const p = g.createPattern(tile, 'repeat');
  if (p.setTransform) p.setTransform(new DOMMatrix().translate(hash2(seed, 1, 77) * 256, hash2(seed, 2, 77) * 256).scale(scale));
  return p;
}

// ---------- 纸 ----------
/** 水彩纸（像素尺寸）：o.base 底色，o.seed，o.amount 纹理强度。 */
export function wcPaper(w, h, { base = WC_PAPER.cool, seed = 4, amount = 1 } = {}) {
  w = Math.round(w); h = Math.round(h);
  return baked(`wcpaper|${w}|${h}|${base}|${seed}|${amount}`, w, h, (ctx) => {
    const [r0, g0, b0] = hexToRgb(base);
    const sw = Math.ceil(w / 10), sh = Math.ceil(h / 10);
    const small = makeCanvas(sw, sh), sctx = small.getContext('2d'), img = sctx.createImageData(sw, sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const n = fbm(x / 20, y / 20, seed, 4) - 0.5;
      const k = 1 + n * 0.05 * amount;
      const i = (y * sw + x) * 4;
      img.data[i] = r0 * k; img.data[i + 1] = g0 * k; img.data[i + 2] = b0 * k; img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, w, h);
    drawTooth(ctx, w, h, seed, 0.55 * amount);
  });
}
function drawTooth(ctx, w, h, seed, amount) {
  ctx.save();
  ctx.globalAlpha = 0.08 * amount;
  ctx.fillStyle = patternFor(ctx, grainTile(seed, true), seed);
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 0.5 * amount;
  ctx.fillStyle = patternFor(ctx, grainTile(seed + 1, false), seed + 1);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
/** 纸纹叠加层（像素尺寸，白底）：用 multiply 叠在整幅画上，让纸的颗粒透出来。 */
export function paperTooth(w, h, { seed = 7, amount = 1 } = {}) {
  w = Math.round(w); h = Math.round(h);
  return baked(`wctooth|${w}|${h}|${seed}|${amount}`, w, h, (ctx) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.09 * amount;
    ctx.fillStyle = patternFor(ctx, grainTile(seed, true), seed);
    ctx.fillRect(0, 0, w, h);
    // 大块的纸面起伏
    const sw = Math.ceil(w / 16), sh = Math.ceil(h / 16);
    const small = makeCanvas(sw, sh), sg = small.getContext('2d'), im = sg.createImageData(sw, sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const v = 255 - (fbm(x / 9, y / 9, seed + 3, 3) - 0.3) * 40 * amount;
      const i = (y * sw + x) * 4;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = clamp(v, 200, 255); im.data[i + 3] = 255;
    }
    sg.putImageData(im, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(small, 0, 0, w, h);
  });
}
/** 四周的毛边留白（像素尺寸）：纸色、边缘不规则、向内渐隐。o.sides = { top, right, bottom, left } 各边宽度（像素）。 */
export function deckle(w, h, { color = WC_PAPER.cool, seed = 9, sides = { top: 18, right: 26, bottom: 46, left: 26 } } = {}) {
  w = Math.round(w); h = Math.round(h);
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
      ctx.beginPath(); ctx.moveTo(0, -4);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.lineTo(len, -4); ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.globalAlpha = 0.35; ctx.strokeStyle = mix(color, '#7a8aa6', 0.35); ctx.lineWidth = 1.2;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 1) : ctx.moveTo(x, y + 1))); ctx.stroke();
      ctx.restore();
    };
    ctx.filter = 'blur(0.6px)';
    side(sides.top, w, () => {}, 1);
    side(sides.bottom, w, () => { ctx.translate(w, h); ctx.rotate(Math.PI); }, 2);
    side(sides.left, h, () => { ctx.translate(0, h); ctx.rotate(-Math.PI / 2); }, 3);
    side(sides.right, h, () => { ctx.translate(w, 0); ctx.rotate(Math.PI / 2); }, 4);
    ctx.filter = 'none';
  });
}

// ---------- 形状 ----------
/** 水渍 / 色团的轮廓点：o.rough 不规则程度（0..0.5），o.n 点数，o.rot 旋转。 */
export function blobPts(cx, cy, rx, ry, { seed = 1, rough = 0.18, n = 32, rot = 0 } = {}) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rough * ((noise2(Math.cos(a) * 1.7 + seed * 3.1, Math.sin(a) * 1.7, seed) - 0.5) * 2 + (hash2(i, seed, 41) - 0.5) * 0.5);
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}
/** 多边形边缘重新采样后沿法线抖动（amp 单位，step 采样间距）。 */
export function roughPoly(pts, { amp = 3, step = 8, seed = 1, closed = true } = {}) {
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
const bboxOf = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};
const pathOf = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };

// ---------- 晕染 ----------
/**
 * 一块透明水彩。shape：点列 [[x,y]...]，或 { path: Path2D, bbox: [x0,y0,x1,y1] }。
 * o.color 主色；o.color2 渐变到的颜色（湿画法里两色互相渗）；o.grad = [x0,y0,x1,y1] 渐变方向（默认从上到下）
 * o.alpha 整体透明度；o.blend 合成方式（'source-over' | 'multiply'，叠色用 multiply 更透明）
 * o.px 每单位多少像素；o.soft 湿边模糊（像素）；o.edge 边缘积色强度（0..2）；o.edgeW 积色带宽（像素）；o.edgeColor
 * o.vary 颜料斑驳（0..1）；o.grain 纸纹留白颗粒（0..1）；o.blooms 回流花（花椰菜状的水渍）个数；o.lift 左上角提亮（0..1）
 */
export function wash(ctx, shape, o = {}) {
  const { color = '#7f93b8', color2 = null, alpha = 0.85, blend = 'source-over', px = 1, soft = 0.8, edge = 0.7, edgeW = 4,
    vary = 0.3, grain = 0.3, blooms = 0, seed = 1, lift = 0 } = o;
  const edgeColor = o.edgeColor || mix(color, '#1e2a44', 0.28);
  const isPts = Array.isArray(shape);
  const path = isPts ? pathOf(shape) : shape.path;
  const [bx0, by0, bx1, by1] = isPts ? bboxOf(shape) : shape.bbox;
  const pad = Math.ceil(soft * 3 + edgeW * 2 + 4);
  const w = Math.ceil((bx1 - bx0) * px) + pad * 2, h = Math.ceil((by1 - by0) * px) + pad * 2;
  if (w < 2 || h < 2 || w > 8000 || h > 8000) return;
  const toLocal = (g) => g.setTransform(px, 0, 0, px, pad - bx0 * px, pad - by0 * px);
  // A：清晰的形状（填色）
  const A = scratch('wA', w, h), ga = A.getContext('2d');
  toLocal(ga);
  if (color2) {
    const [gx0, gy0, gx1, gy1] = o.grad || [bx0, by0, bx0, by1];
    const gr = ga.createLinearGradient(gx0, gy0, gx1, gy1);
    gr.addColorStop(0, color); gr.addColorStop(1, color2);
    ga.fillStyle = gr;
  } else ga.fillStyle = color;
  ga.fill(path);
  ga.setTransform(1, 0, 0, 1, 0, 0);
  // B：湿边（轻微模糊）
  const Bc = scratch('wB', w, h), gb = Bc.getContext('2d');
  if (soft > 0) gb.filter = `blur(${soft}px)`;
  gb.drawImage(A, 0, 0, w, h, 0, 0, w, h);
  gb.filter = 'none';
  // 颜料斑驳：不均匀的浓淡
  if (vary > 0) {
    gb.globalCompositeOperation = 'destination-out';
    gb.globalAlpha = vary * 0.55;
    gb.fillStyle = patternFor(gb, cloudTile(seed % 7), seed, 1.6);
    gb.fillRect(0, 0, w, h);
  }
  // 左上提亮（湿时用纸巾吸掉一点颜料）
  if (lift > 0) {
    gb.globalCompositeOperation = 'destination-out';
    gb.globalAlpha = lift;
    const r = Math.max(w, h) * 0.55;
    const rg = gb.createRadialGradient(w * 0.32, h * 0.28, 0, w * 0.32, h * 0.28, r);
    rg.addColorStop(0, 'rgba(0,0,0,0.8)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
    gb.fillStyle = rg; gb.fillRect(0, 0, w, h);
  }
  // 回流花：浅色的芯 + 一圈深色的边
  if (blooms > 0) {
    const R = rng('wc-bloom', seed);
    for (let i = 0; i < blooms; i++) {
      const cx = pad + R() * (w - 2 * pad), cy = pad + R() * (h - 2 * pad);
      const r = Math.min(w, h) * (0.12 + R() * 0.22);
      const bp = pathOf(blobPts(cx, cy, r, r * (0.7 + R() * 0.4), { seed: seed * 7 + i, rough: 0.32, n: 28 }));
      gb.globalCompositeOperation = 'destination-out'; gb.globalAlpha = 0.35;
      gb.filter = `blur(${Math.max(1, r * 0.15)}px)`;
      gb.fill(bp);
      gb.filter = 'none';
      gb.globalCompositeOperation = 'source-atop'; gb.globalAlpha = 0.5;
      gb.strokeStyle = edgeColor; gb.lineWidth = Math.max(1, r * 0.05);
      gb.stroke(bp);
    }
  }
  // 边缘积色：清晰形状减去模糊形状 = 贴着边的一圈
  if (edge > 0) {
    const E = scratch('wE', w, h), ge = E.getContext('2d');
    ge.drawImage(A, 0, 0, w, h, 0, 0, w, h);
    ge.globalCompositeOperation = 'destination-out';
    ge.filter = `blur(${edgeW}px)`;
    ge.drawImage(A, 0, 0, w, h, 0, 0, w, h);
    ge.filter = 'none';
    ge.globalCompositeOperation = 'source-in';
    ge.fillStyle = edgeColor; ge.fillRect(0, 0, w, h);
    gb.globalCompositeOperation = 'source-atop';
    for (let e = edge; e > 0; e -= 1) { gb.globalAlpha = Math.min(1, e); gb.drawImage(E, 0, 0, w, h, 0, 0, w, h); }
  }
  // 纸纹：颗粒处颜料浅、凹处颜料沉
  if (grain > 0) {
    gb.globalCompositeOperation = 'destination-out';
    gb.globalAlpha = grain * 0.45;
    gb.fillStyle = patternFor(gb, grainTile(seed % 5, false), seed);
    gb.fillRect(0, 0, w, h);
    gb.globalCompositeOperation = 'source-atop';
    gb.globalAlpha = grain * 0.07;
    gb.fillStyle = patternFor(gb, grainTile(seed % 5 + 11, true), seed + 3);
    gb.fillRect(0, 0, w, h);
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.globalCompositeOperation = blend;
  ctx.drawImage(Bc, 0, 0, w, h, bx0 - pad / px, by0 - pad / px, w / px, h / px);
  ctx.restore();
}

/**
 * 湿画法渐变天空：stops = [[t, color], ...]（t 从 y0 到 y1 的 0..1）。
 * o.bands 横向晕开的色带个数；o.blooms 回流花个数；o.px；o.seed。
 */
export function skyWash(ctx, x0, y0, x1, y1, stops, { px = 1, seed = 3, bands = 7, blooms = 4, grain = 0.25 } = {}) {
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
  const R = rng('wc-sky', seed);
  // 横向色带：相邻颜色互相渗进去（湿画法），边缘软
  for (let i = 0; i < bands; i++) {
    const t = (i + 0.5) / bands + (R() - 0.5) * 0.08;
    const y = y0 + (y1 - y0) * t, hh = (y1 - y0) * (0.08 + R() * 0.1);
    const pts = [];
    const n = 40;
    for (let k = 0; k <= n; k++) { const x = x0 + ((x1 - x0) * k) / n; pts.push([x, y - hh / 2 + (noise2(k * 0.35, i, seed) - 0.5) * hh * 0.9]); }
    for (let k = n; k >= 0; k--) { const x = x0 + ((x1 - x0) * k) / n; pts.push([x, y + hh / 2 + (noise2(k * 0.35, i + 50, seed) - 0.5) * hh * 0.9]); }
    const c = colorAt(clamp(t + (R() < 0.5 ? -0.12 : 0.12)));
    wash(ctx, pts, { color: c, alpha: 0.35 + R() * 0.2, px, soft: 10 + R() * 14, edge: R() < 0.4 ? 0.5 : 0, edgeW: 6, vary: 0.5, grain: 0, seed: seed * 11 + i });
  }
  // 回流花（天空里花椰菜状的水渍）
  for (let i = 0; i < blooms; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + (y1 - y0) * (0.1 + R() * 0.6), r = (y1 - y0) * (0.08 + R() * 0.1);
    const c = colorAt(clamp((y - y0) / (y1 - y0)));
    wash(ctx, blobPts(x, y, r * 1.8, r, { seed: seed + i * 5, rough: 0.3 }), { color: mix(c, '#ffffff', 0.35), alpha: 0.5, px, soft: 3, edge: 1.2, edgeW: 5, edgeColor: mix(c, '#2a3a5a', 0.25), vary: 0.2, grain: 0, seed: seed + i });
  }
  if (grain > 0) {
    ctx.save();
    ctx.globalAlpha = grain;
    ctx.fillStyle = patternFor(ctx, grainTile(seed, false), seed, 1 / px);
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
  }
}

/** 小色点：噪声轮廓 + 积色边（每帧可用，不用离屏）。o.alpha、o.edge、o.seed、o.rough、o.ry、o.rot。 */
export function dab(ctx, x, y, r, color, { alpha = 0.8, edge = 0.5, seed = 1, rough = 0.2, ry = null, rot = 0, n = 16, edgeColor = null } = {}) {
  const p = pathOf(blobPts(x, y, r, ry ?? r, { seed, rough, n, rot }));
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color; ctx.fill(p);
  if (edge > 0) {
    ctx.globalAlpha = Math.min(1, ctx.globalAlpha * edge);
    ctx.strokeStyle = edgeColor || mix(color, '#1e2a44', 0.3);
    ctx.lineWidth = Math.max(0.6, r * 0.12);
    ctx.stroke(p);
  }
  ctx.restore();
}

/** 光晕（screen 叠加，中心 a、半径 r 处归零）。每帧可用。 */
export function glow(ctx, x, y, r, color, a = 0.6, { blend = 'screen', core = 0.15 } = {}) {
  if (a <= 0.002 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = blend;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a)); g.addColorStop(core, rgba(color, a * 0.7)); g.addColorStop(0.5, rgba(color, a * 0.22)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// ---------- 笔触 ----------
/** 干笔：沿折线画几遍断续、略错开的线，带飞白。o.width、o.color、o.alpha、o.passes、o.dry（0..1，越大断得越多）。 */
export function dryBrush(ctx, pts, { width = 4, color = '#41516e', alpha = 0.8, passes = 3, dry = 0.35, seed = 1, wobble = 1.2 } = {}) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  for (let p = 0; p < passes; p++) {
    const R = rng('wc-dry', seed, p);
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

/**
 * 湿路面上的竖向倒影：从 y0 往下到 y1，由一段段横向碎笔组成（被水纹打断），越往下越淡、越碎。
 * o.w 宽度；o.color；o.alpha；o.seed；o.wobble 左右摆；o.gap 碎笔间距；o.taper 往下变宽（倒影拉长散开）。
 */
export function streak(ctx, x, y0, y1, { w = 20, color = '#f08a6a', alpha = 0.8, seed = 1, wobble = 6, gap = 7, taper = 0.5, fade = 0.85 } = {}) {
  ctx.save();
  ctx.fillStyle = color;
  const L = y1 - y0;
  let i = 0;
  for (let y = y0; y < y1; y += gap * (0.6 + hash2(i, 3, seed) * 0.8), i++) {
    const t = (y - y0) / L;
    if (hash2(i, 1, seed) < t * 0.45) continue; // 往下越碎
    const ww = w * (1 + taper * t) * (0.35 + 0.9 * noise2(y * 0.05, seed, seed + 2));
    const cx = x + Math.sin(y * 0.09 + seed) * wobble * (0.4 + t) + (hash2(i, 2, seed) - 0.5) * wobble;
    ctx.globalAlpha = alpha * (1 - fade * t) * (0.55 + 0.45 * hash2(i, 4, seed));
    ctx.beginPath();
    ctx.ellipse(cx, y, ww / 2, gap * (0.22 + hash2(i, 5, seed) * 0.25), 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** 湿路面底色：o.top/o.bottom 渐变色，o.ripple 横向水纹颜色，o.lights 留白高光颜色，o.px，o.seed。 */
export function wetRoad(ctx, x0, x1, y0, y1, { top = '#9fb0cc', bottom = '#c4cbe0', ripple = '#7f8fb0', lights = '#eef1f6', px = 1, seed = 5, density = 1 } = {}) {
  wash(ctx, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], { color: top, color2: bottom, alpha: 1, px, soft: 0.5, edge: 0, vary: 0.35, grain: 0.35, seed });
  const R = rng('wc-road', seed);
  const n = Math.round(((x1 - x0) * (y1 - y0)) / 2600 * density);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const y = y0 + Math.pow(R(), 0.8) * (y1 - y0), x = x0 + R() * (x1 - x0);
    const t = (y - y0) / (y1 - y0);
    const len = 20 + R() * 90 * (0.5 + t);
    const light = R() < 0.45;
    ctx.strokeStyle = light ? lights : ripple;
    ctx.globalAlpha = (light ? 0.45 : 0.22) * (0.4 + R() * 0.6);
    ctx.lineWidth = (light ? 1.5 : 2.2) * (0.6 + t * 1.2) * (0.6 + R() * 0.8);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + len / 2, y + (R() - 0.5) * 3, x + len, y + (R() - 0.5) * 2); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 效果：颜料流淌 ----------
/**
 * 把一段单位坐标的绘制先画进一张离屏全屏画布（1920×1080 × res，单位 → 像素），返回画布。
 * res < 1 时更快（流淌时画面本来就是软的，用 0.5 足够）。每帧可用（同一个 key 复用同一张画布，不要嵌套调用）。
 */
export function captureUnits(key, draw, res = 1) {
  const w = Math.round((X_MAX - X_MIN) * K * res), h = Math.round(1000 * K * res);
  // 返回一张正好 w×h 的画布（runDown 按整张画布取图）
  const c = memo(`wc-cap|${key}|${w}|${h}`, () => makeCanvas(w, h));
  const g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(K * res, 0, 0, K * res, -X_MIN * K * res, 0);
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  return c;
}

/**
 * 颜料流淌（「雨水把颜料晕开」）：src 画布按列向下拖出色痕，边缘化开。amount 0..1（0 = 原样）。
 * rect = { x, y, w, h }：src 画到 ctx 的哪里（当前坐标系，o.px = 每单位像素，默认 K）。每帧可用：在 1/3 分辨率上做，
 * 列数约 160，每列用 1/k 透明度依次叠 n 份向下错开的拷贝 = 向下的方向模糊（色痕），再放大叠回去（放大本身就是晕开的软边）。
 * 流淌到顶（amount ≈ 1）时只画色痕，不再画清晰的原图。
 * o.run 最长流淌距离（rect 高度的比例）；o.cols 列宽（低分辨率像素）；o.copies 拷贝份数；o.seed；o.paper 露出来的纸色；
 * o.sink 原图整体下沉的比例（相对流淌距离）。
 */
export function runDown(ctx, src, rect, amount, { run = 0.22, cols = 4, copies = 5, seed = 3, paper = WC_PAPER.cool, sink = 0, px = K } = {}) {
  const { x, y, w, h } = rect;
  const SW = src.width, SH = src.height;
  const sw = Math.ceil((w * px) / 3), sh = Math.ceil((h * px) / 3);
  const half = scratch('run-half', sw, sh), gh = half.getContext('2d');
  gh.imageSmoothingQuality = 'low';
  gh.drawImage(src, 0, 0, SW, SH, 0, 0, sw, sh);
  const out = scratch('run-out', sw, sh), go = out.getContext('2d');
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
      const off = (d * (k - 1)) / (copies - 1);
      go.drawImage(half, c, 0, cols, sh, c, off, cols, sh);
    }
  }
  ctx.save();
  const over = clamp(amount * 1.15);
  if (over < 0.98) {
    // 原图略微下沉，上沿露出纸色
    const dy = maxD * sink * (h / sh);
    ctx.fillStyle = paper;
    ctx.fillRect(x, y, w, dy + 1);
    ctx.globalAlpha = 1;
    ctx.drawImage(src, 0, 0, SW, SH, x, y + dy, w, h);
  }
  // 色痕叠回去（低分辨率放大 → 边缘化开）
  ctx.globalAlpha = over;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(out, 0, 0, sw, sh, x, y, w, h);
  ctx.restore();
}

// ---------- 装裱 ----------
/**
 * 水彩纸卡片（像素尺寸，缓存）：纸色、毛边、四周晕染的边。
 * o.paper 纸色；o.color 边缘晕染色；o.color2 第二种晕染色（角上渗一点）；o.seed；o.inset 晕染向内深度（像素）。
 */
export function wcCard(w, h, { paper = WC_PAPER.white, color = '#7fa3cc', color2 = null, seed = 1, inset = 30, shadow = true } = {}) {
  w = Math.round(w); h = Math.round(h);
  const pad = 24;
  return baked(`wccard|${w}|${h}|${paper}|${color}|${color2}|${seed}|${inset}|${shadow}`, w + pad * 2, h + pad * 2, (ctx) => {
    ctx.translate(pad, pad);
    const outline = roughPoly([[0, 0], [w, 0], [w, h], [0, h]], { amp: 2.2, step: 10, seed });
    if (shadow) {
      ctx.save(); ctx.filter = 'blur(6px)'; ctx.globalAlpha = 0.22; ctx.translate(4, 7); ctx.fillStyle = '#2a3550'; ctx.fill(pathOf(outline)); ctx.restore();
    }
    // 纸
    const P = wcPaper(w + 4, h + 4, { base: paper, seed: seed + 2, amount: 0.9 });
    ctx.save(); ctx.clip(pathOf(outline)); ctx.drawImage(P, -2, -2);
    // 四周的晕染：外框环带，用湿边晕进来
    const ring = new Path2D();
    const outer = roughPoly([[-10, -10], [w + 10, -10], [w + 10, h + 10], [-10, h + 10]], { amp: 2, step: 12, seed: seed + 1 });
    const inner = roughPoly([[inset, inset * 0.8], [w - inset, inset * 0.8], [w - inset, h - inset * 0.8], [inset, h - inset * 0.8]], { amp: inset * 0.35, step: 14, seed: seed + 5 });
    outer.forEach(([x, y], i) => (i ? ring.lineTo(x, y) : ring.moveTo(x, y))); ring.closePath();
    inner.forEach(([x, y], i) => (i ? ring.lineTo(x, y) : ring.moveTo(x, y))); ring.closePath();
    const tmp = makeCanvas(w + 40, h + 40), gt = tmp.getContext('2d');
    gt.translate(20, 20);
    gt.fillStyle = color; gt.fill(ring, 'evenodd');
    if (color2) {
      gt.globalCompositeOperation = 'source-atop';
      const g2 = gt.createRadialGradient(w, h, 0, w, h, Math.max(w, h) * 0.6);
      g2.addColorStop(0, rgba(color2, 0.9)); g2.addColorStop(1, rgba(color2, 0));
      gt.fillStyle = g2; gt.fillRect(-20, -20, w + 40, h + 40);
      gt.globalCompositeOperation = 'source-over';
    }
    ctx.filter = `blur(${inset * 0.28}px)`;
    ctx.globalAlpha = 0.55;
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(tmp, -20, -20);
    ctx.filter = 'none';
    // 晕染的内沿：一圈淡淡的积色
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = mix(color, '#1e2a44', 0.3); ctx.lineWidth = 1.6;
    ctx.stroke(pathOf(roughPoly([[inset * 0.55, inset * 0.45], [w - inset * 0.55, inset * 0.45], [w - inset * 0.55, h - inset * 0.45], [inset * 0.55, h - inset * 0.45]], { amp: inset * 0.3, step: 14, seed: seed + 5 })));
    ctx.restore();
    // 毛边
    ctx.globalAlpha = 0.5; ctx.strokeStyle = mix(color, '#1e2a44', 0.4); ctx.lineWidth = 1.2;
    ctx.stroke(pathOf(outline));
  });
}
/** 画 wcCard（x, y 是卡片左上角）。 */
export function drawWcCard(ctx, x, y, w, h, o = {}) {
  ctx.drawImage(wcCard(w, h, o), x - 24, y - 24);
}

/**
 * 水彩刷出的画框（像素尺寸，缓存）：内沿 W×H（默认整幅画面），边宽 t（默认 64）。
 * 浅色纸底 + 几道不同颜色的湿笔沿边刷过 + 角上的水渍；内沿留出不规则的纸白。
 * o.paper；o.colors 刷色列表；o.seed。
 */
export function wcFrameImage({ W = CANVAS_W, H = CANVAS_H, t = 64, paper = WC_PAPER.cool, colors = ['#9ab6d8', '#c5b4dc', '#f2c3a6'], seed = 21 } = {}) {
  return baked(`wcframe|${W}|${H}|${t}|${paper}|${colors.join()}|${seed}`, W + 2 * t, H + 2 * t, (ctx) => {
    ctx.translate(t, t);
    const band = new Path2D();
    const outer = roughPoly([[-t, -t], [W + t, -t], [W + t, H + t], [-t, H + t]], { amp: 3, step: 16, seed });
    const inner = roughPoly([[0, 0], [W, 0], [W, H], [0, H]], { amp: 2.5, step: 14, seed: seed + 1 });
    outer.forEach(([x, y], i) => (i ? band.lineTo(x, y) : band.moveTo(x, y))); band.closePath();
    inner.forEach(([x, y], i) => (i ? band.lineTo(x, y) : band.moveTo(x, y))); band.closePath();
    ctx.save();
    ctx.clip(band, 'evenodd');
    ctx.drawImage(wcPaper(W + 2 * t, H + 2 * t, { base: paper, seed: seed + 3 }), -t, -t);
    // 沿四边的湿笔：每边两三笔，颜色交替，笔与笔之间互相渗
    const R = rng('wc-frame', seed);
    const sides = [
      (u) => [lerp(-t, W + t, u), -t * 0.5], (u) => [W + t * 0.5, lerp(-t, H + t, u)],
      (u) => [lerp(W + t, -t, u), H + t * 0.5], (u) => [-t * 0.5, lerp(H + t, -t, u)],
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
          const ww = wd * (0.5 + 0.5 * Math.sin((i / 30) * Math.PI)) * (0.8 + 0.4 * noise2(i * 0.3, k, seed + si));
          if (si % 2) { top.push([x - ww / 2, y]); bot.push([x + ww / 2, y]); } else { top.push([x, y - ww / 2]); bot.push([x, y + ww / 2]); }
        });
        wash(ctx, [...top, ...bot.reverse()], { color: colors[(si + k) % colors.length], alpha: 0.5 + R() * 0.2, px: 1, soft: 2.5, edge: 0.9, edgeW: 3, vary: 0.4, grain: 0.35, seed: seed + si * 10 + k, blend: 'multiply' });
      }
    });
    // 角上的水渍
    for (const [cx, cy] of [[-t / 2, -t / 2], [W + t / 2, -t / 2], [W + t / 2, H + t / 2], [-t / 2, H + t / 2]]) {
      wash(ctx, blobPts(cx, cy, t * 0.55, t * 0.5, { seed: seed + cx, rough: 0.3 }), { color: colors[Math.abs(Math.round(cx + cy)) % colors.length], alpha: 0.55, px: 1, soft: 2, edge: 1.3, edgeW: 4, vary: 0.3, grain: 0.3, seed: seed + 5, blend: 'multiply' });
    }
    ctx.restore();
    // 内沿一道细的干笔线
    dryBrush(ctx, [...inner, inner[0]], { width: 2.4, color: mix(colors[0], '#2a3a5a', 0.45), alpha: 0.55, passes: 2, dry: 0.4, seed: seed + 9, wobble: 0.8 });
    dryBrush(ctx, [...outer, outer[0]], { width: 2, color: mix(colors[0], '#2a3a5a', 0.3), alpha: 0.4, passes: 1, dry: 0.5, seed: seed + 10, wobble: 0.8 });
  });
}
/** 在转场里画水彩画框（R = { x, y, w, h, s }，像素坐标，内沿）。 */
export function drawWcFrame(ctx, R, o = {}) {
  const t = 64;
  const img = wcFrameImage({ ...o, t });
  const s = R.s;
  ctx.save();
  // 路面上的淡影子
  ctx.fillStyle = 'rgba(40,55,90,0.12)';
  ctx.beginPath(); ctx.ellipse(R.x + R.w / 2, R.y + R.h + t * s * 0.9, R.w * 0.55, t * s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, R.x - t * s, R.y - t * s, img.width * (R.w / (img.width - 2 * t)), img.height * (R.h / (img.height - 2 * t)));
  ctx.restore();
}

/**
 * 水彩色环的 CD 盘面（像素，缓存；中心在画布中心，半径 r）。
 * o.colors 色环的颜色（依次晕开、互相渗）；o.paper 盘面底色；o.ink 描线色。
 */
export function wcDisc(r, { colors = ['#7fa8d8', '#e58fb0', '#f2d16b', '#6fc7d6'], paper = WC_PAPER.white, ink = '#27364a', seed = 31 } = {}) {
  const pad = 10, S = Math.ceil(r * 2 + pad * 2);
  return baked(`wcdisc|${r}|${colors.join()}|${paper}|${ink}|${seed}`, S, S, (ctx) => {
    const c = S / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fillStyle = paper; ctx.fill();
    ctx.clip();
    ctx.drawImage(wcPaper(S, S, { base: paper, seed }), 0, 0);
    // 色环：一圈分段的湿笔，每段颜色不同、边缘互相渗
    const n = colors.length * 2;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - 0.12, a1 = ((i + 1) / n) * Math.PI * 2 + 0.12;
      const pts = [];
      for (let k = 0; k <= 16; k++) { const a = lerp(a0, a1, k / 16); const rr = r * (0.9 + (noise2(a * 3, i, seed) - 0.5) * 0.06); pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]); }
      for (let k = 16; k >= 0; k--) { const a = lerp(a0, a1, k / 16); const rr = r * (0.5 + (noise2(a * 3, i + 9, seed) - 0.5) * 0.08); pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]); }
      wash(ctx, pts, { color: colors[i % colors.length], alpha: 0.62, px: 1, soft: 2.2, edge: 0.9, edgeW: 2.5, vary: 0.35, grain: 0.3, seed: seed + i, blend: 'multiply' });
    }
    // 盘心一圈淡色
    wash(ctx, blobPts(c, c, r * 0.36, r * 0.36, { seed, rough: 0.05, n: 36 }), { color: mix(colors[0], '#ffffff', 0.55), alpha: 0.6, px: 1, soft: 1, edge: 0.6, edgeW: 2, vary: 0.2, grain: 0.2, seed: seed + 50 });
    ctx.restore();
    ctx.strokeStyle = ink; ctx.lineWidth = 2.2; ctx.globalAlpha = 0.85;
    ctx.beginPath(); ctx.arc(c, c, r - 1, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.4; ctx.globalAlpha = 0.6;
    ctx.beginPath(); ctx.arc(c, c, r * 0.26, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(c, c, r * 0.1, 0, Math.PI * 2); ctx.fillStyle = mix(paper, '#9fb2cc', 0.6); ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1.4; ctx.stroke();
  });
}
