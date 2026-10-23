// 第 13 站 · 哎呦，不错哦（Aiyo, Not Bad, 2014）·「鞋子特大号」· 蜡笔画的小镇 · 儿童蜡笔画
// 一张小朋友的蜡笔画：白画纸，顶上一条蓝天、角上一个笑脸太阳，歪房子、棒棒糖树、比房子还高的向日葵，
// 底下一条绿草地和土黄小路。所有东西都是「蜡笔」：来回的之字形涂色（涂出线外 / 没涂满）、歪歪扭扭的两遍描边、纸纹颗粒。
//
// 逐格抖动（boiling line）：每一层预先烘焙 3 个版本（布局相同、抖动种子不同），按量化后的格轮换。
// 量化：quantize = 10，人物取帧、抖动、太阳、小鸟、小狗、星星都按每秒约 10 次更新；
//       镜头平移（env.cam + 本站额外位移 X）不量化。硬切用未量化的拍位 env.gb − sec.start，正好落在拍上。
// 梗（第 9–12 拍）：第 9 拍强拍，他脚下那一截（约身高 14%）逐行放大成两只特大号蜡笔鞋；
//     第 10 拍穿着大鞋走一步（走路帧），一步跨过半个画面：人物先冲出去，本站额外镜头位移 X 在约 1.35 拍内追上 900 单位；
//     第 11 拍落地，地面一震、蜡笔线猛抖、跳出星星和尘土；第 12 拍鞋子「嘭」地缩回；第 13 拍起继续走。
//     额外位移 X 一直保留到本站结束（共用镜头在它上面接着走），所以不回退、不跳；画框和下一站的位置与本站镜头无关。
// 原创配角：小狗（棕色、黑耳朵、斑点）、扎辫子的小女孩（红裙、蓝气球）、「m」字小鸟。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K, W as PX_W, H as PX_H } from '../main/layout.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2, noise1 } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, keyframes, TAU } from '../kit/math.js';
import { GAG, STATION, quantizeBeats } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { activeWalk, frameIndex, FIGURE_H } from '../rig/walker.js';
import { registerStyle, styledFrame, smoothColor, sobel, lumaArray, outline, rgbf, luma, clone, sstep } from '../rig/styles.js';
import { paperTexture } from '../kit/paper.js';
import { SANS } from '../kit/text.js';

const ST = stationByN(13);
const HZ = 10;

// ---------- 调色板（蜡笔盒） ----------
const PAPER = '#fffcf3';
const SKY = '#4fa3e8', SKY_L = '#8fc8f5';
const SUN = '#ffd43b', SUN_O = '#f7902a';
const GRASS = '#5cbf4a', GRASS_D = '#2f8f3e', GRASS_L = '#a9e34b';
const RED = '#e8402e', PINK = '#ff86ad', PINK_L = '#ffc2d6', ORANGE = '#ff922b', YELLOW = '#ffd43b';
const PURPLE = '#7b5cd6', LILAC = '#b197fc', BLUE = '#3b7dd8', BLUE_L = '#74c0fc';
const BROWN = '#9b5a2c', BROWN_L = '#c8823f', BROWN_D = '#5e3415';
const PATH = '#f3c477', PATH_D = '#c98a3a';
const INK = '#2b2580', INK_D = '#221c5e';
const GRAY = '#868e96';

// ---------- 时间（段内拍位） ----------
const T_POP = GAG;                 // 第 9 拍：鞋子放大
const T_JUMP = GAG + 1;            // 第 10 拍：一大步
const T_LAND = GAG + 2;            // 第 11 拍：落地
const T_SHRINK = GAG + 3;          // 第 12 拍：鞋子缩回
const LEAVE = STATION.leave[0];    // 第 13 拍：继续走
const STRIDE = 900;                // 一步跨过半个画面（单位）
const CATCH = 1.35;                // 额外镜头位移追上人物用的拍数
const F_BIG = 2.9;                 // 大鞋放大倍数
const SLICE = 0.13;                // 脚下那一截占身高的比例

/** 未量化的段内拍位：硬切都用它。 */
const rawB = (env) => env.gb - env.sec.start;
/** 量化一格是多少拍：由节拍网格推出（找第一个量化后大于 0 的拍位），不写死秒数。 */
let stepMemo = null;
function qStep() {
  const probe = quantizeBeats(64, HZ);
  if (stepMemo && stepMemo.probe === probe) return stepMemo.step;
  let lo = 0, hi = 4;
  for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (quantizeBeats(m, HZ) > 0) hi = m; else lo = m; }
  stepMemo = { probe, step: hi };
  return hi;
}
/** 量化拍位 → 第几格（整数）。 */
const frameOf = (bq) => Math.round(bq / qStep());
/** 逐格抖动用哪个版本（0..2，相邻两格一定不同）。 */
const boilOf = (bq) => ((frameOf(bq) % 3) + 3) % 3;
const boilRaw = (b) => boilOf(quantizeBeats(b, HZ));

// ======================================================================
// 额外镜头位移、人物的一大步、地面一震
// ======================================================================
/** 本站额外镜头位移（单位，不量化）：第 10 拍起 0 → 900，之后一直保留。 */
const extraCam = (rb) => STRIDE * ease.inOut(clamp((rb - T_JUMP) / CATCH));
/** 人物在世界里走过的额外距离：一拍内走完 900。 */
const strideW = (rb) => STRIDE * ease.inOut(clamp(rb - T_JUMP));
/** 地面一震：落地后按量化格上下抖、逐渐减弱；放大鞋子时轻轻一震。 */
function shakeY(b, rb) {
  let a = 0, k = 0;
  const tl = rb - T_LAND, tp = rb - T_POP, ts = rb - T_SHRINK;
  if (tl >= 0 && tl < 0.8) { a = 15 * (1 - tl / 0.8); k = Math.max(0, frameOf(b) - frameOf(T_LAND)); }
  else if (tp >= 0 && tp < 0.35) { a = 6 * (1 - tp / 0.35); k = Math.max(0, frameOf(b) - frameOf(T_POP)); }
  else if (ts >= 0 && ts < 0.3) { a = 4 * (1 - ts / 0.3); k = Math.max(0, frameOf(b) - frameOf(T_SHRINK)); }
  return a ? (k % 2 ? -0.7 : 1) * a : 0;
}
/** 蜡笔线猛抖一下：每层独立的随机小位移（落地、放大时）。 */
function jolt(b, rb, layer) {
  const tl = rb - T_LAND, tp = rb - T_POP;
  const a = tl >= 0 && tl < 0.55 ? 5 * (1 - tl / 0.55) : tp >= 0 && tp < 0.3 ? 3 : 0;
  if (!a) return [0, 0];
  const f = frameOf(b);
  return [(hash2(f, layer, 1301) - 0.5) * 2 * a, (hash2(f, layer, 1302) - 0.5) * 2 * a];
}
/** 大鞋放大倍数（量化格硬切，带过冲）。 */
function feetScale(b, rb) {
  if (rb < T_POP) return 1;
  if (rb < T_SHRINK) {
    const k = Math.max(0, frameOf(b) - frameOf(T_POP));
    return [2.2, 3.3, 2.65, 3.0, F_BIG][Math.min(4, k)];
  }
  const k = Math.max(0, frameOf(b) - frameOf(T_SHRINK));
  return [2.0, 0.86, 1.08, 1][Math.min(3, k)];
}
/** 梗里人物的姿势与位置。 */
function gagFigure(b, rb) {
  const t = clamp(rb - T_JUMP);
  const inStride = rb >= T_JUMP && rb < T_LAND;
  const dx = strideW(rb) - extraCam(rb);
  const dy = inStride ? -120 * Math.sin(Math.PI * t) : 0;
  // 起跳前往后一仰，空中前倾，落地站直
  const rot = rb >= T_JUMP - 0.3 && rb < T_JUMP ? -0.05 : inStride ? 0.1 * Math.sin(Math.PI * t) : 0;
  return { pose: inStride ? 'walk' : 'stand', dx, dy, rot };
}

// ======================================================================
// 蜡笔笔触（单位坐标）
// ======================================================================
function resample(pts, closed, step) {
  const P = closed ? [...pts, pts[0]] : pts;
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  }
  out.push(P[P.length - 1]);
  return out;
}
/** 歪歪扭扭：沿法线方向加低频噪声 + 一点高频抖动。 */
function wob(pts, closed, seed, amp, { step = 7, freq = 0.03, over = 0 } = {}) {
  const R = resample(pts, closed, step);
  const out = [];
  let s = 0;
  for (let i = 0; i < R.length; i++) {
    const a = R[Math.max(0, i - 1)], c = R[Math.min(R.length - 1, i + 1)];
    let nx = -(c[1] - a[1]), ny = c[0] - a[0];
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl; ny /= nl;
    if (i) s += Math.hypot(R[i][0] - R[i - 1][0], R[i][1] - R[i - 1][1]);
    const o = noise1(s * freq, seed) * amp + (hash2(i, 7, seed) - 0.5) * amp * 0.4;
    out.push([R[i][0] + nx * o, R[i][1] + ny * o]);
  }
  // 封闭图形：收笔时多画一小段，和起笔叠在一起（孩子画圈常这样）
  if (closed && over) for (let i = 1; i <= over && i < out.length; i++) out.push([out[i][0] + amp * 0.5, out[i][1] + amp * 0.4]);
  return out;
}
function tracePts(g, q) {
  g.beginPath();
  q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
}
/** 蜡笔描边：两遍对不齐的歪线。 */
function cline(g, pts, { c = INK, w = 4, closed = false, seed = 1, amp = 1.8, alpha = 0.95, passes = 2, step = 7 } = {}) {
  g.save();
  g.strokeStyle = c; g.lineCap = 'round'; g.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    const q = wob(pts, closed, seed + p * 31, amp * (p ? 1.4 : 1), { over: closed ? 3 : 0, step });
    g.globalAlpha = alpha * (p ? 0.55 : 1);
    g.lineWidth = w * (p ? 0.6 : 1);
    tracePts(g, q);
    g.stroke();
  }
  g.restore();
}
/** 蜡笔涂色：剪进一个歪的轮廓里，来回的之字形笔触；偶尔漏掉一条（留白）。 */
function cfill(g, pts, { c, seed = 1, ang = -0.5, gap = 5.5, w = 6.5, alpha = 0.86, amp = 3.2, skip = 0.05 } = {}) {
  const q = wob(pts, true, seed + 101, amp, { step: 9, freq: 0.05 });
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, Rr = Math.hypot(x1 - x0, y1 - y0) / 2 + 8;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  g.save();
  tracePts(g, q); g.closePath(); g.clip();
  g.strokeStyle = c; g.lineWidth = w; g.globalAlpha *= alpha; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  let first = true, k = 0;
  for (let v = -Rr; v <= Rr; v += gap, k++) {
    if (noise1(v * 0.05, seed + 7) > 1 - skip * 2.2) { first = true; continue; }
    const u = (k % 2 ? 1 : -1) * Rr * (0.92 + 0.08 * hash2(k, 1, seed));
    const vv = v + (hash2(k, 3, seed) - 0.5) * gap * 0.4;
    const X = cx + u * ca - vv * sa, Y = cy + u * sa + vv * ca;
    if (first) g.moveTo(X, Y); else g.lineTo(X, Y);
    first = false;
  }
  g.stroke();
  g.restore();
}
/** 涂色 + 描边。 */
function shape(g, pts, fill, line, seed, o = {}) {
  if (fill) cfill(g, pts, { c: fill, seed, ...o.fill });
  if (line) cline(g, pts, { c: line, closed: true, seed: seed + 3, ...o.line });
}
const ellPts = (cx, cy, rx, ry, n = 22, rot = 0) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry;
  return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
});

// ---------- 纸纹颗粒：蜡笔在纸纹上留下的小白点（destination-out） ----------
function grainTile() {
  return memo('s13-grain', () => {
    const T = 256, c = makeCanvas(T, T), g = c.getContext('2d');
    const im = g.createImageData(T, T);
    // 四角混合，做成可平铺的各向异性纸纹（横向纤维）
    const f = (x, y) => noise2(x * 0.22, y * 0.62, 1310) * 0.65 + noise2(x * 0.06, y * 0.11, 1312) * 0.35;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const v = (f(x, y) * (T - x) * (T - y) + f(x - T, y) * x * (T - y) + f(x, y - T) * (T - x) * y + f(x - T, y - T) * x * y) / (T * T);
      const sp = hash2(x, y, 1311);
      const a = clamp((v - 0.5) * 3.4) * 0.9 + (sp > 0.94 ? 0.55 : 0);
      im.data[(y * T + x) * 4 + 3] = 255 * Math.min(1, a);
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
function applyGrain(g, w, h, amount = 1) {
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-out';
  g.globalAlpha = amount;
  g.fillStyle = g.createPattern(grainTile(), 'repeat');
  g.fillRect(0, 0, w, h);
  g.restore();
}

// ---------- 视差层（本站自己烘焙：覆盖到镜头 + 额外位移 900） ----------
const CAM0 = -600, CAM1 = 3150;
function layer(key, p, v, y0, y1, draw, res = 1) {
  const x0 = Math.floor(X_MIN + CAM0 * p) - 30, x1 = Math.ceil(X_MAX + CAM1 * p) + 30;
  const s = K * res;
  const canvas = baked(`s13|${key}|${v}`, (x1 - x0) * s, (y1 - y0) * s, (g, c) => {
    g.save(); g.scale(s, s); g.translate(-x0, -y0);
    draw(g, x0, x1, v);
    g.restore();
    applyGrain(g, c.width, c.height);
  });
  return { canvas, x0, x1, y0, y1, p };
}
function drawLayer(ctx, L, cam, dx = 0, dy = 0) {
  ctx.drawImage(L.canvas, L.x0 - cam * L.p + dx, L.y0 + dy, L.x1 - L.x0, L.y1 - L.y0);
}
/** 小物件：以中心为原点画，烘焙成图（带纸纹颗粒）。 */
function sprite(key, wU, hU, draw, res = 1.25) {
  return memo(`s13-spr|${key}`, () => {
    const s = K * res, c = makeCanvas(wU * s, hU * s), g = c.getContext('2d');
    g.scale(s, s); g.translate(wU / 2, hU / 2);
    draw(g);
    applyGrain(g, c.width, c.height, 0.8);
    return { c, w: wU, h: hU };
  });
}
function drawSpr(ctx, S, x, y, { rot = 0, flip = false, sc = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  if (flip || sc !== 1) ctx.scale(flip ? -sc : sc, sc);
  ctx.drawImage(S.c, -S.w / 2, -S.h / 2, S.w, S.h);
  ctx.restore();
}

// ======================================================================
// 画纸、天空带、太阳、云、小鸟、彩虹
// ======================================================================
const paper = () => paperTexture(PX_W, PX_H, { base: PAPER, seed: 1313, amount: 0.7, fibers: 120 });

const P_SKY = 0;
function skyLayer(v) {
  return layer('sky', P_SKY, v, 0, 160, (g, x0, x1) => {
    const top = [], R = rng('s13', 'sky');
    const pts = [[x0, -10], [x1, -10]];
    for (let x = x1; x >= x0; x -= 40) pts.push([x, 104 + noise1(x * 0.004, 1320) * 16 + R() * 6]);
    cfill(g, pts, { c: SKY, seed: 1321 + v * 977, ang: 0.08, gap: 6, w: 8, alpha: 0.8, amp: 5, skip: 0.06 });
    // 再涂一层浅一点的，颜色不匀
    cfill(g, pts.map(([x, y]) => [x, y * 0.85]), { c: SKY_L, seed: 1322 + v * 977, ang: -0.12, gap: 9, w: 6, alpha: 0.45, amp: 4 });
    void top;
  }, 0.8);
}

const SUN_X = 1190, SUN_Y = 168, SUN_R = 70;
function sunBody(v) {
  return sprite(`sun|${v}`, 220, 220, (g) => {
    const s = 1340 + v * 977;
    shape(g, ellPts(0, 0, SUN_R, SUN_R * 0.97, 26), SUN, SUN_O, s, { fill: { gap: 5, w: 7, ang: 0.6 }, line: { w: 6 } });
  });
}
function sunRays(v) {
  return sprite(`sunrays|${v}`, 360, 360, (g) => {
    const s = 1350 + v * 977;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, r0 = SUN_R + 18, r1 = SUN_R + (i % 2 ? 46 : 74);
      cline(g, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], { c: i % 2 ? SUN_O : SUN, w: 7, seed: s + i, amp: 2.5 });
    }
  });
}
/** 太阳的脸：smile 笑；wow 吓一跳（圆眼睛、O 嘴）；wink 眨眼。 */
function sunFace(kind, v) {
  return sprite(`sunface|${kind}|${v}`, 160, 160, (g) => {
    const s = 1360 + v * 977;
    const eye = (x) => (kind === 'wow'
      ? cline(g, ellPts(x, -14, 9, 11, 12), { c: INK_D, w: 4, closed: true, seed: s + x })
      : shape(g, ellPts(x, -14, 5, 7, 10), INK_D, null, s + x, { fill: { gap: 3, w: 4 } }));
    eye(-22);
    if (kind === 'wink') cline(g, [[12, -14], [22, -18], [32, -14]], { c: INK_D, w: 4, seed: s + 5 });
    else eye(22);
    // 红脸蛋
    for (const x of [-38, 38]) cfill(g, ellPts(x, 8, 10, 7, 10), { c: '#ff6b6b', seed: s + x + 9, gap: 3, w: 4, alpha: 0.7 });
    if (kind === 'wow') shape(g, ellPts(0, 22, 11, 14, 14), '#c92a2a', INK_D, s + 20, { fill: { gap: 3, w: 4 }, line: { w: 4 } });
    else cline(g, Array.from({ length: 9 }, (_, i) => { const a = 0.15 * Math.PI + (i / 8) * 0.7 * Math.PI; return [Math.cos(a) * 30, 2 + Math.sin(a) * 26]; }), { c: INK_D, w: 5, seed: s + 30 });
  });
}
function drawSun(ctx, b, rb, dy) {
  const v = boilOf(b);
  const surprised = rb >= T_POP && rb < T_SHRINK + 0.5;
  const bounce = rb >= T_LAND && rb < T_LAND + 0.6 ? -14 * Math.sin(Math.PI * (rb - T_LAND) / 0.6) : 0;
  const y = SUN_Y + dy * 0.5 + bounce;
  const spin = Math.round(b * 4) * 0.04 + (surprised ? 0.12 * (frameOf(b) % 2) : 0);
  drawSpr(ctx, sunRays(v), SUN_X, y, { rot: spin, sc: surprised ? 1.12 : 1 });
  drawSpr(ctx, sunBody(v), SUN_X, y);
  const kind = surprised ? 'wow' : b >= LEAVE + 1 && b < LEAVE + 1.8 ? 'wink' : 'smile';
  drawSpr(ctx, sunFace(kind, v), SUN_X, y + 4);
}

// 云：棉花糖（上面一圈圆鼓包、下面平平的），浅粉 / 浅蓝，只涂一半
function cloudPts(w, h, nb, seed) {
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI + (i / 40) * Math.PI; // 上半圈
    const bump = Math.abs(Math.sin(((a - Math.PI) / Math.PI) * nb * Math.PI)) * 0.28;
    pts.push([Math.cos(a) * w * (1 + bump * 0.4), Math.sin(a) * h * (1 + bump) + hash2(i, 1, seed) * 2]);
  }
  pts.push([w * 0.95, h * 0.32], [-w * 0.95, h * 0.32]);
  return pts;
}
const CLOUDS = [
  { x: -180, y: 230, w: 120, h: 50, nb: 4, c: PINK_L, o: PINK },
  { x: 380, y: 196, w: 95, h: 42, nb: 3, c: '#d0ebff', o: BLUE_L },
  { x: 820, y: 262, w: 135, h: 54, nb: 5, c: PINK_L, o: PINK },
  { x: 1350, y: 210, w: 110, h: 46, nb: 4, c: '#d0ebff', o: BLUE_L },
  { x: 1800, y: 250, w: 100, h: 44, nb: 3, c: '#fff3bf', o: ORANGE },
];
function cloudSpr(i, v) {
  const C = CLOUDS[i];
  return sprite(`cloud|${i}|${v}`, C.w * 2.6 + 30, C.h * 2.8 + 30, (g) => {
    const s = 1370 + i * 17 + v * 977;
    const pts = cloudPts(C.w, C.h, C.nb, s);
    cfill(g, pts.map(([x, y]) => [x * 0.86, y * 0.8 + 4]), { c: C.c, seed: s, gap: 7, w: 7, alpha: 0.85, ang: 0.3, skip: 0.18 });
    cline(g, pts, { c: C.o, w: 5, closed: true, seed: s + 2 });
  });
}
const P_CLOUD = 0.06, CLOUD_SPAN = 2400;
function drawClouds(ctx, b, cam, dy) {
  const v = boilOf(b);
  CLOUDS.forEach((C, i) => {
    let x = C.x - cam * P_CLOUD - b * 5;
    x = ((x - X_MIN + 300) % CLOUD_SPAN + CLOUD_SPAN) % CLOUD_SPAN + X_MIN - 300;
    if (x < X_MIN - 300 || x > X_MAX + 300) return;
    drawSpr(ctx, cloudSpr(i, v), x, C.y + dy * 0.4);
  });
}

// 「m」字小鸟，两种翅膀姿势
function birdSpr(pose, v) {
  return sprite(`bird|${pose}|${v}`, 90, 60, (g) => {
    const s = 1380 + v * 977 + pose * 5;
    const up = pose === 0 ? 1 : 0.25;
    const L = Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [-34 + t * 34, -16 * up * Math.sin(Math.PI * t) + t * 6]; });
    const Rw = Array.from({ length: 7 }, (_, i) => { const t = i / 6; return [t * 34, 6 - t * 6 - 16 * up * Math.sin(Math.PI * t)]; });
    cline(g, L, { c: '#3d3d5c', w: 4.5, seed: s, amp: 1.2 });
    cline(g, Rw, { c: '#3d3d5c', w: 4.5, seed: s + 1, amp: 1.2 });
  });
}
const BIRDS = [{ x: 140, y: 300, ph: 0 }, { x: 250, y: 255, ph: 1 }, { x: 600, y: 330, ph: 2 }];
function drawBirds(ctx, b, rb, dy) {
  const v = boilOf(b), f = frameOf(b);
  const scare = rb >= T_LAND && rb < T_LAND + 1.2 ? ease.out(clamp((rb - T_LAND) / 0.5)) : rb >= T_LAND + 1.2 ? 1 : 0;
  BIRDS.forEach((B, i) => {
    const x = B.x + b * 22 + i * 5 + scare * 40 * (i + 1);
    const y = B.y + Math.sin(b * 1.4 + B.ph) * 12 - scare * 60 + dy * 0.3;
    if (x > X_MAX + 60) return;
    const pose = ((f + B.ph) >> (scare > 0 && scare < 1 ? 0 : 1)) % 2;
    drawSpr(ctx, birdSpr(pose, v), x, y, { sc: 0.9 + 0.1 * i });
  });
}

// 彩虹（远处天上，视差很小）
const P_RAIN = 0.12;
function rainbowLayer(v) {
  return layer('rainbow', P_RAIN, v, 140, 640, (g) => {
    const cx = 980, cy = 640, cols = [RED, ORANGE, YELLOW, GRASS, BLUE, PURPLE];
    cols.forEach((c, i) => {
      const r = 390 - i * 17;
      const pts = Array.from({ length: 40 }, (_, k) => { const a = Math.PI + (k / 39) * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
      cline(g, pts, { c, w: 15, seed: 1390 + i + v * 977, amp: 2.5, alpha: 0.82, passes: 2, step: 10 });
    });
  }, 0.8);
}

// ======================================================================
// 远景：三角形雪山 + 圆滚滚的山丘
// ======================================================================
const P_FAR = 0.25;
function farLayer(v) {
  return layer('far', P_FAR, v, 380, 800, (g, x0, x1) => {
    const R = rng('s13', 'far');
    const J = 1400 + v * 977;
    let i = 0;
    for (let x = x0 - 100; x < x1 + 100; x += R.range(260, 420), i++) {
      const w = R.range(280, 420), h = R.range(190, 280), base = 730, px = x + w * R.range(0.4, 0.6);
      const col = R.pick([LILAC, '#91a7ff', '#9775fa']);
      const tri = [[x, base], [px, base - h], [x + w, base]];
      shape(g, tri, col, mix(col, INK, 0.45), J + i * 7, { fill: { ang: 0.9, gap: 6.5 }, line: { w: 5 } });
      // 锯齿雪顶：留白 + 白蜡笔，描一圈锯齿
      const ch = h * 0.3, l = [lerp(px, x, ch / h), base - h + ch], r = [lerp(px, x + w, ch / h), base - h + ch];
      const zig = [l];
      for (let k = 1; k < 5; k++) zig.push([lerp(l[0], r[0], k / 5), l[1] + (k % 2 ? -14 : 6)]);
      zig.push(r);
      const cap = [[px, base - h], ...zig.slice().reverse()];
      cfill(g, cap, { c: '#ffffff', seed: J + i * 7 + 3, gap: 4, w: 6, alpha: 1, amp: 1.5 });
      cline(g, zig, { c: mix(col, INK, 0.45), w: 4, seed: J + i * 7 + 4 });
      cline(g, [[l[0], l[1]], [px, base - h], [r[0], r[1]]], { c: mix(col, INK, 0.45), w: 5, seed: J + i * 7 + 5 });
    }
    // 山丘
    i = 0;
    for (let x = x0 - 300; x < x1 + 300; x += R.range(330, 520), i++) {
      const w = R.range(380, 600), h = R.range(130, 180), base = 800;
      const col = i % 2 ? GRASS_L : '#8ce99a';
      const pts = Array.from({ length: 26 }, (_, k) => { const a = Math.PI + (k / 25) * Math.PI; return [x + Math.cos(a) * w / 2, base + Math.sin(a) * h]; });
      shape(g, pts, col, GRASS_D, J + 200 + i * 7, { fill: { ang: -0.25, gap: 6.5, w: 7 }, line: { w: 5 } });
      // 山丘上的小棒棒糖树
      if (R() < 0.7) {
        const tx = x + R.range(-0.25, 0.25) * w, ty = base - h * 0.92 + Math.abs(tx - x) / (w / 2) * h * 0.4;
        cline(g, [[tx, ty], [tx, ty - 30]], { c: BROWN, w: 5, seed: J + 300 + i });
        shape(g, ellPts(tx, ty - 44, 18, 17, 14), GRASS_D, mix(GRASS_D, INK, 0.4), J + 310 + i, { fill: { gap: 4, w: 5 }, line: { w: 3.5 } });
      }
    }
  }, 0.85);
}

// ======================================================================
// 小镇：歪房子、棒棒糖树、向日葵、篱笆
// ======================================================================
const P_TOWN = 0.55;
const WALLS = [RED, YELLOW, BLUE_L, PINK, ORANGE, '#69db7c', LILAC];
const ROOFS = [RED, PURPLE, BROWN, BLUE, GRASS_D, '#e64980'];
function house(g, x, base, R, J) {
  const w = R.range(165, 245), h = R.range(150, 230);
  const wall = R.pick(WALLS);
  let roof = R.pick(ROOFS);
  if (roof === wall) roof = PURPLE;
  const j = () => R.range(-9, 9);
  const tl = [x + j(), base - h + j()], tr = [x + w + j(), base - h + j()];
  const body = [[x, base], [x + w, base + j() * 0.4], tr, tl];
  shape(g, body, wall, mix(wall, INK, 0.55), J, { fill: { ang: R.range(-0.9, -0.3), gap: 5.5, w: 7 }, line: { w: 5 } });
  // 屋顶：三角或梯形，比墙宽一点
  const over = R.range(14, 30), rh = R.range(85, 135), peak = [x + w * R.range(0.38, 0.62), base - h - rh];
  const roofPts = R() < 0.75 ? [[tl[0] - over, tl[1] + 4], peak, [tr[0] + over, tr[1] + 4]]
    : [[tl[0] - over, tl[1] + 4], [peak[0] - w * 0.25, peak[1] + 20], [peak[0] + w * 0.25, peak[1] + 20], [tr[0] + over, tr[1] + 4]];
  // 烟囱（先画，屋顶盖住一截）
  if (R() < 0.75) {
    const cx = lerp(peak[0], tr[0], 0.55), cy = lerp(peak[1], tr[1], 0.55);
    const chim = [[cx - 14, cy + 10], [cx - 14, cy - 58], [cx + 14, cy - 60], [cx + 14, cy + 10]];
    shape(g, chim, BROWN_L, BROWN_D, J + 5, { fill: { gap: 4, w: 5 }, line: { w: 4 } });
    // 螺旋烟
    const sp = [];
    for (let k = 0; k < 34; k++) { const t = k / 33, a = t * 3.2 * TAU; sp.push([cx + 6 + t * 70 + Math.cos(a) * (8 + t * 12), cy - 70 - t * 110 + Math.sin(a) * (8 + t * 12)]); }
    cline(g, sp, { c: '#adb5bd', w: 4, seed: J + 6, amp: 1.2, step: 5 });
  }
  shape(g, roofPts, roof, mix(roof, INK, 0.5), J + 10, { fill: { ang: R.range(0.3, 1.1), gap: 5, w: 7 }, line: { w: 5.5 } });
  // 门
  const dw = R.range(42, 58), dh = R.range(70, 92), dx = x + w * R.range(0.18, 0.62);
  const door = [[dx, base], [dx, base - dh + 18], [dx + dw * 0.2, base - dh + 3], [dx + dw * 0.5, base - dh], [dx + dw * 0.8, base - dh + 3], [dx + dw, base - dh + 18], [dx + dw, base]];
  const dcol = R.pick([BROWN, BLUE, RED, PURPLE]);
  shape(g, door, dcol === wall ? BROWN : dcol, INK_D, J + 20, { fill: { gap: 4.5, w: 6, ang: 1.3 }, line: { w: 4 } });
  shape(g, ellPts(dx + dw * 0.78, base - dh * 0.45, 4.5, 4.5, 8), YELLOW, INK_D, J + 22, { fill: { gap: 3, w: 4 }, line: { w: 2.5 } });
  // 窗：方格十字，浅蓝或亮黄；一扇窗可能有窗帘
  const nw = w > 200 ? 2 : 1;
  for (let k = 0; k < nw; k++) {
    const ws = R.range(40, 52);
    let wx = x + w * (nw === 1 ? (dx - x > w * 0.4 ? 0.12 : 0.62) : k ? 0.68 : 0.08);
    if (Math.abs(wx + ws / 2 - (dx + dw / 2)) < (ws + dw) / 2 + 6) wx = dx - x > w / 2 ? x + 10 : x + w - ws - 10;
    const wy = base - h + R.range(28, 48);
    const win = [[wx, wy], [wx + ws, wy + R.range(-4, 4)], [wx + ws, wy + ws], [wx, wy + ws]];
    const lit = R() < 0.4;
    shape(g, win, lit ? '#ffe066' : '#a5d8ff', INK_D, J + 30 + k, { fill: { gap: 4, w: 5.5, ang: 0.2 }, line: { w: 4 } });
    cline(g, [[wx + ws / 2, wy + 2], [wx + ws / 2, wy + ws - 2]], { c: INK_D, w: 3.5, seed: J + 40 + k });
    cline(g, [[wx + 2, wy + ws / 2], [wx + ws - 2, wy + ws / 2]], { c: INK_D, w: 3.5, seed: J + 50 + k });
    if (R() < 0.35) for (const s of [-1, 1]) cfill(g, [[wx + ws / 2 + s * ws / 2, wy], [wx + ws / 2 + s * 4, wy], [wx + ws / 2 + s * ws / 2, wy + ws * 0.7]], { c: PINK, seed: J + 60 + k + s, gap: 3, w: 4 });
  }
  return w;
}
function lollipopTree(g, x, base, R, J) {
  const th = R.range(90, 140), r = R.range(52, 74);
  const trunk = [[x - 10, base], [x - 9, base - th], [x + 9, base - th], [x + 11, base]];
  shape(g, trunk, BROWN, BROWN_D, J, { fill: { gap: 4, w: 6, ang: 1.4 }, line: { w: 4 } });
  const cy = base - th - r * 0.75;
  const crown = R() < 0.5 ? ellPts(x, cy, r, r * 0.92, 24)
    : Array.from({ length: 30 }, (_, k) => { const a = (k / 30) * TAU, rr = r * (1 + 0.12 * Math.abs(Math.sin(a * 3.5))); return [x + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9]; });
  const gc = R.pick([GRASS, GRASS_D, '#40c057']);
  shape(g, crown, gc, mix(gc, INK, 0.5), J + 3, { fill: { gap: 5.5, w: 7, ang: R.range(-1, 1) }, line: { w: 5 } });
  if (R() < 0.6) for (let k = 0; k < 5; k++) {
    const a = R() * TAU, rr = R() * r * 0.7;
    shape(g, ellPts(x + Math.cos(a) * rr, cy + Math.sin(a) * rr, 7, 7, 9), RED, '#a61e1e', J + 10 + k, { fill: { gap: 3, w: 4 }, line: { w: 2.5 } });
  }
  return r * 2;
}
function sunflower(g, x, base, R, J, h) {
  h = h || R.range(300, 380);
  const top = [x + R.range(-12, 12), base - h];
  cline(g, [[x, base], [lerp(x, top[0], 0.5) + 8, base - h * 0.5], top], { c: GRASS_D, w: 8, seed: J });
  for (const s of [-1, 1]) {
    const ly = base - h * R.range(0.3, 0.5), lx = x + s * 4;
    shape(g, [[lx, ly], [lx + s * 30, ly - 26], [lx + s * 62, ly - 18], [lx + s * 30, ly + 4]], GRASS, GRASS_D, J + 3 + s, { fill: { gap: 4, w: 5 }, line: { w: 3.5 } });
  }
  const pr = R.range(40, 52);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * TAU + R() * 0.1;
    const cx = top[0] + Math.cos(a) * pr * 0.95, cy = top[1] + Math.sin(a) * pr * 0.95;
    shape(g, ellPts(cx, cy, pr * 0.52, pr * 0.24, 12, a), YELLOW, SUN_O, J + 10 + k, { fill: { gap: 3.5, w: 5, ang: a }, line: { w: 3.5 } });
  }
  shape(g, ellPts(top[0], top[1], pr * 0.62, pr * 0.62, 18), BROWN, BROWN_D, J + 30, { fill: { gap: 4, w: 6 }, line: { w: 4 } });
  for (let k = 0; k < 7; k++) { const a = R() * TAU, rr = R() * pr * 0.4; cline(g, [[top[0] + Math.cos(a) * rr, top[1] + Math.sin(a) * rr], [top[0] + Math.cos(a) * rr + 3, top[1] + Math.sin(a) * rr + 2]], { c: BROWN_D, w: 4, seed: J + 40 + k }); }
  return pr * 2.5;
}
function fence(g, x, base, n, R, J) {
  const col = R.pick([ORANGE, BROWN_L, RED]);
  for (let k = 0; k < n; k++) {
    const px = x + k * 30, ph = 78 + R.range(-8, 8);
    cline(g, [[px, base], [px, base - ph], [px + 11, base - ph - 16], [px + 22, base - ph], [px + 22, base], [px, base]], { c: col, w: 4, seed: J + k });
  }
  for (const yy of [base - 24, base - 58]) cline(g, [[x - 8, yy + R.range(-3, 3)], [x + n * 30 + 2, yy + R.range(-3, 3)]], { c: col, w: 4.5, seed: J + 90 + yy });
  return n * 30;
}
function townLayer(v) {
  return layer('town', P_TOWN, v, 250, 800, (g, x0, x1) => {
    const R = rng('s13', 'town');
    const J0 = 1500 + v * 977;
    let x = x0 - 60, i = 0, last = '';
    while (x < x1 + 60) {
      const base = 770 + R.range(-8, 10);
      const r = R();
      const Ji = J0 + i * 101;
      const RR = rng('s13', 'town', i);
      let w;
      const kind = last !== 'house' && r < 0.62 ? 'house' : r < 0.82 ? 'tree' : r < 0.92 ? 'flower' : 'fence';
      if (kind === 'house') w = house(g, x, base, RR, Ji);
      else if (kind === 'tree') { w = lollipopTree(g, x + 70, base, RR, Ji); x += 70 - w / 2; }
      else if (kind === 'flower') { w = sunflower(g, x + 40, base + 20, RR, Ji); x += 40 - w / 2; }
      else w = fence(g, x, base + 8, RR.int(4, 7), RR, Ji);
      last = kind;
      x += w + R.range(18, 70);
      i++;
    }
  });
}

// ======================================================================
// 地面：草地 + 土黄小路 + 小石子、花（他走的这一层，p = 1）
// ======================================================================
const P_GROUND = 1;
const GTOP = 752, PTOP = 784, PBOT = 846;
function tulip(g, x, y, col, J, s = 1) {
  cline(g, [[x, y], [x + 2, y - 70 * s]], { c: '#237032', w: 6 * s, seed: J });
  shape(g, [[x - 4, y - 18 * s], [x - 26 * s, y - 50 * s], [x - 8 * s, y - 40 * s]], GRASS, GRASS_D, J + 1, { fill: { gap: 3, w: 4 }, line: { w: 3 } });
  const cy = y - 70 * s;
  const cup = [[x - 15 * s, cy - 30 * s], [x - 7 * s, cy - 20 * s], [x + 1, cy - 32 * s], [x + 9 * s, cy - 20 * s], [x + 17 * s, cy - 30 * s], [x + 18 * s, cy - 12 * s], [x + 13 * s, cy - 1 * s], [x + 2, cy + 4 * s], [x - 11 * s, cy - 1 * s], [x - 16 * s, cy - 12 * s]];
  shape(g, cup, col, mix(col, INK, 0.5), J + 2, { fill: { gap: 3.5, w: 5, ang: 1.2 }, line: { w: 3.5 } });
}
function daisy(g, x, y, J) {
  cline(g, [[x, y], [x - 1, y - 40]], { c: GRASS_D, w: 4, seed: J });
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * TAU;
    shape(g, ellPts(x + Math.cos(a) * 11, y - 46 + Math.sin(a) * 11, 8, 4.5, 10, a), '#ffffff', '#adb5bd', J + 2 + k, { fill: { gap: 3, w: 4 }, line: { w: 2.2 } });
  }
  shape(g, ellPts(x, y - 46, 6, 6, 10), YELLOW, SUN_O, J + 20, { fill: { gap: 3, w: 4 }, line: { w: 2.5 } });
}
function groundLayer(v) {
  return layer('ground', P_GROUND, v, 700, 1000, (g, x0, x1) => {
    const R = rng('s13', 'ground');
    const J = 1600 + v * 977;
    // 草地（分段涂，免得一笔太长）
    const SEG = 600;
    for (let sx = x0 - 20, k = 0; sx < x1 + 20; sx += SEG, k++) {
      const top = [];
      for (let x = sx - 10; x <= sx + SEG + 10; x += 30) top.push([x, GTOP + noise1(x * 0.006, 1601) * 8]);
      const pts = [...top, [sx + SEG + 10, 1010], [sx - 10, 1010]];
      cfill(g, pts, { c: GRASS, seed: J + k * 13, ang: -0.1, gap: 6, w: 9, alpha: 0.9, amp: 3, skip: 0 });
      cfill(g, pts.map(([x, y]) => [x, Math.max(y, 880)]), { c: '#40c057', seed: J + k * 13 + 5, ang: 0.12, gap: 11, w: 6, alpha: 0.4, amp: 3, skip: 0 });
      cline(g, top, { c: GRASS_D, w: 5.5, seed: J + k * 13 + 7 });
      // 小路
      const pt = [], pb = [];
      for (let x = sx - 10; x <= sx + SEG + 10; x += 30) { pt.push([x, PTOP + noise1(x * 0.008, 1602) * 5]); pb.push([x, PBOT + noise1(x * 0.007, 1603) * 7]); }
      cfill(g, [...pt, ...pb.slice().reverse()], { c: PATH, seed: J + k * 13 + 9, ang: 0.12, gap: 5.5, w: 8, alpha: 0.95, amp: 2, skip: 0.04 });
      cline(g, pt, { c: PATH_D, w: 4.5, seed: J + k * 13 + 10 });
      cline(g, pb, { c: PATH_D, w: 4.5, seed: J + k * 13 + 11 });
    }
    // 小路上的石子
    for (let x = x0; x < x1; x += R.range(60, 150)) {
      const y = R.range(PTOP + 12, PBOT - 8), r = R.range(5, 10);
      shape(g, ellPts(x, y, r * 1.3, r, 10), R() < 0.5 ? '#ced4da' : '#e9b77d', GRAY, J + Math.round(x), { fill: { gap: 3, w: 4 }, line: { w: 2.5 } });
    }
    // 草：「v」字
    for (let x = x0; x < x1; x += R.range(40, 110)) {
      const y = R() < 0.4 ? GTOP + R.range(0, 6) : R.range(PBOT + 20, 990);
      const s = R.range(0.8, 1.3);
      cline(g, [[x - 9 * s, y - 16 * s], [x - 3 * s, y], [x, y - 20 * s], [x + 4 * s, y], [x + 11 * s, y - 15 * s]], { c: GRASS_D, w: 3.5, seed: J + 400 + Math.round(x) });
    }
    // 花：郁金香、雏菊（草地下半截）
    for (let x = x0; x < x1; x += R.range(90, 220)) {
      const y = R.range(900, 990);
      if (R() < 0.6) tulip(g, x, y, R.pick([RED, PINK, ORANGE, PURPLE, YELLOW]), J + 700 + Math.round(x), R.range(0.75, 1));
      else daisy(g, x, y, J + 700 + Math.round(x));
    }
  });
}

// 前景：画面底边几丛大郁金香、草丛（p = 1.3，稀疏）
const P_FRONT = 1.3;
function frontLayer(v) {
  return layer('front', P_FRONT, v, 820, 1000, (g, x0, x1) => {
    const R = rng('s13', 'front');
    const J = 1700 + v * 977;
    for (let x = x0 + 200; x < x1; x += R.range(700, 1100)) {
      for (let k = 0; k < 3; k++) tulip(g, x + k * 34 + R.range(-6, 6), 1010, R.pick([RED, PINK, PURPLE, ORANGE]), J + Math.round(x) + k * 11, R.range(1.4, 1.8));
      for (let k = 0; k < 4; k++) {
        const gx = x - 50 + k * 50, s = R.range(1.6, 2.2);
        cline(g, [[gx - 12 * s, 990 - 26 * s], [gx - 4 * s, 1000], [gx, 990 - 32 * s], [gx + 5 * s, 1000], [gx + 15 * s, 990 - 24 * s]], { c: GRASS_D, w: 6, seed: J + 50 + Math.round(gx) });
      }
    }
  });
}

// ======================================================================
// 配角：小狗、扎辫子的小女孩（孩子画的样子）
// ======================================================================
/** 小狗：朝右；pose: 0/1 跑步两帧、'sit'、'jump'。原点在身体中间，脚在 y = +48。 */
function dogSpr(pose, v) {
  return sprite(`dog|${pose}|${v}`, 190, 150, (g) => {
    const J = 1800 + v * 977;
    const sit = pose === 'sit', jump = pose === 'jump';
    const tilt = sit ? -0.32 : jump ? -0.1 : 0;
    g.save();
    if (sit) g.translate(-10, 10);
    g.rotate(tilt);
    // 尾巴
    const wag = pose === 1 ? 1 : pose === 'sit' ? -0.4 : 0;
    cline(g, [[-44, -2], [-58, -16 - wag * 6], [-64 - wag * 4, -34]], { c: BROWN_D, w: 5, seed: J });
    // 腿
    const legs = jump ? [[-32, 18, -50, 40], [-22, 18, -36, 44], [24, 18, 46, 34], [32, 18, 56, 28]]
      : sit ? [[-30, 18, -14, 40], [-20, 18, -2, 42], [26, 18, 30, 52], [34, 18, 40, 52]]
        : pose === 0 ? [[-32, 18, -44, 48], [-20, 18, -10, 48], [22, 18, 12, 48], [32, 18, 44, 48]]
          : [[-32, 18, -26, 48], [-20, 18, -28, 48], [22, 18, 30, 48], [32, 18, 24, 48]];
    legs.forEach(([a, b2, c, d], k) => cline(g, [[a, b2], [c, d]], { c: BROWN_D, w: 6, seed: J + 5 + k }));
    // 身体 + 斑点
    shape(g, ellPts(-4, 6, 48, 24, 22), BROWN_L, BROWN_D, J + 10, { fill: { gap: 4, w: 5.5, ang: -0.3 }, line: { w: 4.5 } });
    shape(g, ellPts(-18, 0, 11, 8, 10), BROWN_D, null, J + 12, { fill: { gap: 3, w: 4 } });
    shape(g, ellPts(14, 12, 8, 6, 10), BROWN_D, null, J + 13, { fill: { gap: 3, w: 4 } });
    g.restore();
    // 头（坐着时不跟身体一起歪）
    const hx = sit ? 34 : 46, hy = sit ? -40 : -22;
    shape(g, ellPts(hx, hy, 24, 22, 18), BROWN_L, BROWN_D, J + 20, { fill: { gap: 4, w: 5.5 }, line: { w: 4.5 } });
    shape(g, [[hx - 14, hy - 18], [hx - 30, hy - 8], [hx - 26, hy + 18], [hx - 12, hy + 6]], '#343a40', '#212529', J + 22, { fill: { gap: 3, w: 4.5 }, line: { w: 3.5 } });
    shape(g, ellPts(hx + 22, hy + 2, 6, 5, 10), '#212529', null, J + 24, { fill: { gap: 3, w: 4 } });
    const eyeR = jump ? 5 : 3.5;
    shape(g, ellPts(hx + 6, hy - 6, eyeR, eyeR + 1, 10), '#212529', null, J + 26, { fill: { gap: 2.5, w: 3.5 } });
    if (jump) cline(g, ellPts(hx + 14, hy + 12, 5, 6, 10), { c: '#212529', w: 3, closed: true, seed: J + 28 });
    else {
      cline(g, [[hx + 4, hy + 10], [hx + 12, hy + 14], [hx + 20, hy + 10]], { c: '#212529', w: 3, seed: J + 28 });
      shape(g, ellPts(hx + 13, hy + 18, 4, 6, 10), '#ff6b6b', null, J + 29, { fill: { gap: 2.5, w: 3.5 } });
    }
  });
}
/** 小女孩：正面；pose: 'stand' | 'jump' | 'clap' | 'wave0' | 'wave1'。原点在中间，脚在 y = +130。 */
function girlSpr(pose, v) {
  return sprite(`girl|${pose}|${v}`, 220, 300, (g) => {
    const J = 1900 + v * 977;
    const SKIN = '#ffc9a0', SKIN_O = '#e8590c', HAIR = '#8f4a1d', DRESS = RED;
    // 腿和鞋
    for (const s of [-1, 1]) {
      const spread = pose === 'jump' ? 10 : 0;
      cline(g, [[s * 13, 66], [s * (15 + spread), 118]], { c: SKIN_O, w: 5, seed: J + s });
      shape(g, ellPts(s * (19 + spread), 124, 12, 6, 10), '#343a40', '#212529', J + 3 + s, { fill: { gap: 3, w: 4 }, line: { w: 3 } });
    }
    // 胳膊（先画，裙子盖住肩膀）
    const arm = (s, hx, hy) => {
      cline(g, [[s * 14, -22], [hx, hy]], { c: SKIN_O, w: 5, seed: J + 10 + s });
      shape(g, ellPts(hx, hy, 7, 7, 10), SKIN, SKIN_O, J + 12 + s, { fill: { gap: 3, w: 4 }, line: { w: 2.5 } });
    };
    // 左手（画面左侧，s = -1）拿气球线
    if (pose === 'jump') { arm(-1, -58, -78); arm(1, 58, -80); }
    else if (pose === 'clap') { arm(-1, -6, -4); arm(1, 6, -4); }
    else if (pose === 'wave0' || pose === 'wave1') { arm(-1, -50, 22); arm(1, pose === 'wave0' ? 62 : 44, pose === 'wave0' ? -76 : -92); }
    else { arm(-1, -50, 22); arm(1, 44, 30); }
    // 三角裙 + 白点
    const dress = [[-12, -38], [12, -38], [52, 70], [-52, 70]];
    shape(g, dress, DRESS, '#a61e1e', J + 20, { fill: { gap: 4.5, w: 6, ang: -0.6 }, line: { w: 4.5 } });
    for (const [dx, dy] of [[-18, 30], [16, 12], [6, 50], [-2, -6], [28, 52]]) cfill(g, ellPts(dx, dy, 5, 5, 8), { c: '#ffffff', seed: J + 30 + dx, gap: 2.5, w: 3.5, alpha: 1 });
    // 头：脸、头发、两个辫子 + 蝴蝶结
    for (const s of [-1, 1]) {
      shape(g, ellPts(s * 40, -76, 15, 18, 14), HAIR, '#5c2b0c', J + 40 + s, { fill: { gap: 3.5, w: 5 }, line: { w: 3.5 } });
      shape(g, [[s * 30, -96], [s * 20, -110], [s * 30, -104], [s * 42, -112], [s * 34, -96]], PINK, '#c2255c', J + 44 + s, { fill: { gap: 2.5, w: 3.5 }, line: { w: 2.5 } });
    }
    shape(g, ellPts(0, -78, 32, 34, 22), SKIN, SKIN_O, J + 50, { fill: { gap: 4, w: 5 }, line: { w: 4 } });
    shape(g, [[-33, -82], [-28, -104], [-10, -114], [12, -113], [28, -104], [33, -84], [16, -98], [-4, -96], [-20, -94]], HAIR, '#5c2b0c', J + 52, { fill: { gap: 3.5, w: 5, ang: 0.4 }, line: { w: 3.5 } });
    const wow = pose === 'jump';
    for (const s of [-1, 1]) {
      if (wow) cline(g, ellPts(s * 11, -78, 4.5, 5.5, 10), { c: '#212529', w: 3, closed: true, seed: J + 60 + s });
      else shape(g, ellPts(s * 11, -78, 3.2, 4, 8), '#212529', null, J + 60 + s, { fill: { gap: 2, w: 3 } });
      cfill(g, ellPts(s * 20, -64, 6, 4, 8), { c: '#ff8787', seed: J + 64 + s, gap: 2.5, w: 3.5, alpha: 0.8 });
    }
    if (wow) cline(g, ellPts(0, -58, 5, 6.5, 10), { c: '#a61e1e', w: 3, closed: true, seed: J + 70 });
    else cline(g, [[-10, -62], [-4, -56], [4, -56], [10, -62]], { c: '#a61e1e', w: 3.5, seed: J + 70 });
  });
}
function balloonSpr(v) {
  return sprite(`balloon|${v}`, 110, 130, (g) => {
    const J = 1990 + v * 977;
    const pts = Array.from({ length: 24 }, (_, k) => { const a = (k / 24) * TAU; return [Math.cos(a) * 36, Math.sin(a) * 42 * (Math.sin(a) > 0 ? 1.08 : 1)]; });
    shape(g, pts, BLUE_L, BLUE, J, { fill: { gap: 4, w: 6, ang: 0.8 }, line: { w: 4 } });
    cline(g, [[-16, -18], [-10, -28]], { c: '#ffffff', w: 6, seed: J + 2 });
    shape(g, [[-6, 46], [6, 46], [0, 38]], BLUE, BLUE, J + 4, { fill: { gap: 2, w: 3 }, line: { w: 2.5 } });
  });
}

/** 小狗在画面上的位置、姿势（单位；raw / 量化拍位）。 */
const DOG_X = CHAR_X + 300, DOG_BACK = CHAR_X - 200;
function dogState(b, rb, C, camGag) {
  const f = frameOf(b), run = f % 2;
  if (rb < 4.4) return null;
  if (rb < 6.6) return { x: lerp(X_MAX + 140, DOG_X, ease.out(clamp((b - 4.4) / 2.2))), pose: run, flip: true, hop: 0 };
  if (rb < T_POP) return { x: DOG_X, pose: run, flip: false, hop: (f % 2) * 4 };
  // 定格以后：钉在世界里（镜头额外位移时会滑出画面）
  const xw = DOG_X + 14 + camGag - C;
  if (rb < T_POP + 0.6) return { x: xw, pose: 'jump', flip: rb > T_POP + 0.3, hop: 70 * Math.sin((Math.PI * (b - T_POP)) / 0.6) };
  if (rb < T_LAND + 0.6) return { x: xw, pose: 'sit', flip: rb < T_JUMP + 0.5, hop: 0 };
  // 追上来
  const xs = DOG_X + 14 - STRIDE;
  if (rb < T_SHRINK + 0.7) return { x: lerp(xs, DOG_BACK, ease.inOut(clamp((b - T_LAND - 0.6) / 1.1))), pose: run, flip: false, hop: (f % 2) * 10 };
  if (rb < LEAVE) return { x: DOG_BACK, pose: 'sit', flip: false, hop: 0 };
  return { x: DOG_BACK, pose: run, flip: false, hop: (f % 2) * 4 };
}
const GIRL_X = 1000;
function girlState(b, rb) {
  const f = frameOf(b);
  if (rb < T_LAND) return 'stand';
  if (rb < T_LAND + 0.45) return 'jump';
  if (rb < T_SHRINK) return 'stand';
  if (rb < LEAVE) return (f >> 1) % 2 ? 'clap' : 'stand';
  return (f >> 1) % 2 ? 'wave0' : 'wave1';
}
function drawCast(ctx, b, rb, C, camGag, dy) {
  const v = boilOf(b);
  // 小女孩 + 气球
  const gx = GIRL_X + camGag + STRIDE - C;
  if (gx > X_MIN - 150 && gx < X_MAX + 150) {
    const pose = girlState(b, rb);
    const hop = pose === 'jump' ? -40 * Math.sin((Math.PI * (rb - T_LAND)) / 0.45) : 0;
    const gy = ROAD_Y - 8 - 130 + hop + dy;
    const hand = [gx - 50, gy + 22];
    const sway = noise1(b * 0.5, 1995) * 0.25 + (rb >= T_LAND && rb < T_LAND + 0.8 ? 0.35 * Math.sin((rb - T_LAND) * 12) * (1 - (rb - T_LAND) / 0.8) : 0);
    const L = 150, bx = hand[0] + Math.sin(sway) * L, by = hand[1] - Math.cos(sway) * L;
    ctx.save();
    ctx.strokeStyle = '#495057'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(hand[0], hand[1]);
    ctx.quadraticCurveTo(hand[0] + Math.sin(sway) * L * 0.5 + 10 * Math.sin(b * 3), hand[1] - L * 0.5, bx, by + 44);
    ctx.stroke(); ctx.restore();
    drawSpr(ctx, balloonSpr(v), bx, by, { rot: sway * 0.6 });
    drawSpr(ctx, girlSpr(pose, v), gx, gy);
  }
  // 小狗
  const D = dogState(b, rb, C, camGag);
  if (D && D.x > X_MIN - 120 && D.x < X_MAX + 120) drawSpr(ctx, dogSpr(D.pose, v), D.x, ROAD_Y - 46 - D.hop + dy, { flip: D.flip });
}

// ======================================================================
// 梗的特效：嘭（尘云 + 放射线）、速度线、星星、尘土
// ======================================================================
function starSpr(col, v) {
  return sprite(`star|${col}|${v}`, 70, 70, (g) => {
    const pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 11 : 26; return [Math.cos(a) * r, Math.sin(a) * r]; });
    shape(g, pts, col, mix(col, INK, 0.5), 2000 + v * 977 + col.length, { fill: { gap: 3.5, w: 5 }, line: { w: 3.5 } });
  });
}
function puffSpr(v, k) {
  return sprite(`puff|${k}|${v}`, 150, 120, (g) => {
    const pts = Array.from({ length: 30 }, (_, i) => { const a = (i / 30) * TAU, r = 40 * (1 + 0.16 * Math.abs(Math.sin(a * 3 + k))); return [Math.cos(a) * r * 1.3, Math.sin(a) * r * 0.9]; });
    shape(g, pts, '#f1e3cf', '#b08968', 2050 + v * 977 + k * 7, { fill: { gap: 6, w: 6, skip: 0.25 }, line: { w: 4 } });
  });
}
/** 嘭：脚边一圈尘云 + 放射短线（t: 0..1）。 */
function drawPop(ctx, b, x, y, t, big) {
  if (t < 0 || t > 1) return;
  const v = boilOf(b);
  const k = ease.out(t);
  ctx.save();
  ctx.globalAlpha = 1 - smoothstep(0.55, 1, t);
  for (let i = 0; i < 4; i++) {
    const s = (i % 2 ? 1 : -1) * (i < 2 ? 1 : 1.7);
    drawSpr(ctx, puffSpr(v, i), x + s * (big ? 120 : 70) * (0.6 + 0.6 * k), y - 20 - (i < 2 ? 0 : 26) * k, { sc: (big ? 1 : 0.7) * (0.5 + 0.6 * k) });
  }
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 5;
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI, r0 = (big ? 190 : 110) * (0.6 + 0.5 * k), r1 = r0 + 40 + 10 * (i % 2);
    const j = (hash2(i, frameOf(b), 2060) - 0.5) * 6;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0 + j, y - 60 + Math.sin(a) * r0 * 0.8); ctx.lineTo(x + Math.cos(a) * r1 - j, y - 60 + Math.sin(a) * r1 * 0.8); ctx.stroke();
  }
  ctx.restore();
}
/** 一大步时身后的蜡笔速度线（人物身后，画在背景层上）。 */
function drawSpeed(ctx, b, rb, fx, fy) {
  const t = rb - T_JUMP;
  if (t < 0.05 || t > 1.05) return;
  const a = t < 0.9 ? 1 : 1 - (t - 0.9) / 0.15;
  const f = frameOf(b);
  ctx.save();
  ctx.globalAlpha = 0.85 * a;
  ctx.lineCap = 'round';
  [[-430, 3], [-330, 2], [-250, 1], [-180, 0]].forEach(([yy, i]) => {
    const len = 260 + 80 * hash2(i, f, 2070), x1 = fx - 150 - 30 * hash2(i, f, 2071);
    const y = fy + yy + (hash2(i, f, 2072) - 0.5) * 10;
    cline(ctx, [[x1 - len, y + 6], [x1 - len * 0.5, y + 2 + 4 * hash2(i, f, 2073)], [x1, y]], { c: [BLUE, PURPLE, ORANGE, PINK][i], w: 8, seed: 2080 + f * 7 + i, amp: 3, passes: 2 });
  });
  ctx.restore();
}
const STAR_COLS = [YELLOW, PINK, BLUE_L, ORANGE, YELLOW, '#69db7c', YELLOW];
/** 落地：星星从两只大鞋下跳出、画弧落下；尘土团往两边滚。 */
function drawLanding(ctx, b, rb, xLand, C, Cland) {
  const t = rb - T_LAND;
  if (t < 0 || t > 1.4) return;
  const v = boilOf(b), tq = Math.max(0, b - T_LAND);
  const shift = -(C - Cland);
  // 尘土
  if (t < 0.9) {
    ctx.save();
    ctx.globalAlpha = 1 - smoothstep(0.5, 0.9, t);
    for (let i = 0; i < 4; i++) {
      const s = i % 2 ? 1 : -1, far = i < 2 ? 1 : 1.6;
      drawSpr(ctx, puffSpr(v, i + 4), xLand + shift + s * (150 + 120 * ease.out(clamp(tq / 0.7)) * far), ROAD_Y - 22 - (i < 2 ? 0 : 18), { sc: 0.6 + 0.5 * ease.out(clamp(tq / 0.6)) });
    }
    ctx.restore();
  }
  // 星星
  STAR_COLS.forEach((col, i) => {
    const s = i % 2 ? 1 : -1, R = rng('s13', 'star', i);
    const vx = s * R.range(160, 330), vy = -R.range(420, 640), gr = 900;
    const tt = tq * 1.15;
    const x = xLand + shift + s * 120 + vx * tt, y = ROAD_Y - 30 + vy * tt + gr * tt * tt;
    if (y > ROAD_Y + 60) return;
    ctx.save();
    ctx.globalAlpha = 1 - smoothstep(1.1, 1.4, t);
    drawSpr(ctx, starSpr(col, v), x, y, { rot: tq * s * 5 + i, sc: 0.75 + 0.35 * R() });
    ctx.restore();
  });
}

// ======================================================================
// 人物：蜡笔画风 + 局部放大的大鞋
// ======================================================================
registerStyle('s13-crayon', (I) => {
  const w = I.w, h = I.h, n = w * h;
  const S = smoothColor(I, 2.5);
  const O = clone(S);
  let top = h, bot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (I.a[y * w + x] > 0.5) { top = Math.min(top, y); bot = Math.max(bot, y); }
  const span = Math.max(1, bot - top);
  const L = lumaArray(S, 0.55), E = sobel(L, w, h);
  const F = sobel(lumaArray(smoothColor(I, 0.6), 0.55), w, h);
  const C = {
    hair: rgbf('#2d2470'), shirt: rgbf('#4646b8'), shirtL: rgbf('#6c6cd8'), pants: rgbf('#2e2a86'), pantsL: rgbf('#4a44a8'),
    shoe: rgbf('#241d52'), skin: rgbf('#f7b98a'), skinL: rgbf('#fcd7b0'), skinD: rgbf('#e0946a'), light: rgbf('#ece6ff'), ink: rgbf(INK_D), paper: rgbf(PAPER),
  };
  const mixc3 = (a, b2, t) => [a[0] + (b2[0] - a[0]) * t, a[1] + (b2[1] - a[1]) * t, a[2] + (b2[2] - a[2]) * t];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (S.a[i] < 0.01) continue;
    const yn = (y - top) / span;
    const l = luma(S, i);
    const skin = I.r[i] > 0.36 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
    let c;
    if (skin) c = l > 0.62 ? C.skinL : l > 0.4 ? C.skin : C.skinD;
    else if (l > 0.52) c = C.light;
    else {
      const sh = mixc3(C.shirt, C.shirtL, sstep(0.16, 0.3, l));
      const pa = mixc3(C.pants, C.pantsL, sstep(0.14, 0.28, l));
      c = yn < 0.13 ? C.hair : yn > 0.93 ? C.shoe : mixc3(sh, pa, sstep(0.49, 0.55, yn));
    }
    // 斜向来回的蜡笔笔触留白 + 纸纹小白点
    const streak = noise2((x + y) * 0.5, (x - y) * 0.035, 1311);
    const gap = Math.max(streak > 0.66 ? 0.62 * sstep(0.66, 0.74, streak) : 0, hash2(x, y, 1312) > 0.92 ? 0.45 : 0);
    c = mixc3(c, C.paper, gap * (skin ? 0.5 : 1));
    const e = skin ? sstep(0.17, 0.47, F[i]) * 0.85 : sstep(0.55, 0.9, E[i]) * 0.9;
    c = mixc3(c, C.ink, e);
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
  }
  outline(O, I.a, 3.8, C.ink);
  return O;
});

/** 局部放大：脚下那一截逐行放大（越往下越大），上身原比例、被顶高。按（帧、倍数）缓存。 */
function bigFeet(key, img, F, m) {
  const Fq = Math.round(F * 20) / 20;
  return memo(`s13-big|${key}|${Fq}|${img.width}`, () => {
    const k = img.width / m.width; // 画风处理后的图和原帧同尺寸
    const y0 = Math.round((m.baseY - SLICE * m.personHeight) * k), yBase = m.baseY * k, H = img.height, Wd = img.width;
    const rowS = (y) => { const t = clamp((y - y0) / (yBase - y0)); return 1 + (Fq - 1) * sstep(0.3, 0.52, t); };
    let extra = 0;
    for (let y = y0; y < H; y++) extra += rowS(y + 0.5) - 1;
    const Fx = Fq * 0.86;
    const ax = m.anchorX * k;
    const outW = Math.ceil(Wd * Math.max(1, Fx) + 8), outH = Math.ceil(H + extra + 4);
    const AX = ax * Math.max(1, Fx) + 4;
    const c = makeCanvas(outW, outH), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, Wd, y0, AX - ax, 0, Wd, y0);
    let yo = y0, by = 0;
    for (let y = y0; y < H; y++) {
      const s = rowS(y + 0.5), sx = 1 + (s - 1) * (Fx - 1) / Math.max(1e-3, Fq - 1);
      g.drawImage(img, 0, y, Wd, 1, AX - ax * sx, yo, Wd * sx, s + 0.8);
      yo += s;
      if (y < yBase) by = yo - (y + 1 - yBase) * s;
    }
    // 放大的那一截重新「涂」一遍：边缘收成干净的粗蜡笔轮廓、不透明；斜向笔触换成浅一档的蓝紫（不透出背景）；
    // 鞋底一道白蜡笔（孩子画鞋都会画白鞋底），像用粗蜡笔画的大鞋
    if (Fq > 1.05) {
      const ry = Math.max(0, y0 - 2), rh = outH - ry;
      const im = g.getImageData(0, ry, outW, rh), d = im.data;
      const ink = rgbf(INK_D).map((x) => x * 255), lite = rgbf('#6a64d0').map((x) => x * 255), sole = rgbf('#f8f9fa').map((x) => x * 255);
      const soleH = (5 + 3.2 * Fq) * k;
      const blend = Math.min(1, (Fq - 1) / 1.2);
      // 每一列鞋子的最低点：鞋底沿着它画（两只鞋高低不同也能对上）
      const low = new Int32Array(outW).fill(-1);
      for (let x = 0; x < outW; x++) for (let yy = rh - 1; yy >= 0; yy--) if (d[(yy * outW + x) * 4 + 3] > 140) { low[x] = ry + yy; break; }
      for (let yy = 0; yy < rh; yy++) {
        const Y = ry + yy, inS = sstep(y0, y0 + 24, Y) * blend;
        for (let x = 0; x < outW; x++) {
          const p = (yy * outW + x) * 4, a = d[p + 3] / 255;
          if (a < 0.08) continue;
          if (a < 0.5) { // 毛边 → 深靛轮廓
            const t = inS;
            d[p] += (ink[0] - d[p]) * t; d[p + 1] += (ink[1] - d[p + 1]) * t; d[p + 2] += (ink[2] - d[p + 2]) * t;
            d[p + 3] = 255 * (a + (1 - a) * t * sstep(0.08, 0.3, a));
            continue;
          }
          d[p + 3] = 255 * (a + (1 - a) * inS);
          const lum = (d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11) / 255;
          if (lum > 0.55 || inS <= 0) continue; // 皮肤、白色纸缝保留
          let c = null, t = 0;
          const ly = low[x];
          if (ly > y0 + 30 && Y > ly - soleH && Y < ly - 2.5 * k && lum < 0.45) { c = Y < ly - soleH + 2.2 * k ? ink : sole; t = 0.95; }
          else {
            const st = noise2((x + Y) * 0.22, (x - Y) * 0.016, 1321);
            if (st > 0.6) { c = lite; t = 0.75 * sstep(0.6, 0.7, st); }
          }
          if (c) { t *= inS; d[p] += (c[0] - d[p]) * t; d[p + 1] += (c[1] - d[p + 1]) * t; d[p + 2] += (c[2] - d[p + 2]) * t; }
        }
      }
      g.putImageData(im, 0, ry);
    }
    return { c, ax: AX / k, by: by / k, sw: outW / k, sh: outH / k };
  });
}
function drawMan(ctx, fig, b, rb) {
  const A = activeWalk();
  if (!A) return;
  const m = A.meta, s = FIGURE_H / m.personHeight;
  let idx = -1;
  if (fig.pose !== 'stand') idx = rb >= T_JUMP && rb < T_LAND ? frameIndex(1 + clamp(b - T_JUMP) * 0.999) : frameIndex(fig.phase || 0);
  const src = idx < 0 ? A.stand : A.frames[idx];
  if (!src) return;
  const key = `${A.name}/${idx < 0 ? 'stand' : idx}`;
  const img = styledFrame(key, src, fig.style);
  const F = feetScale(b, rb);
  ctx.save();
  if (fig.lean) ctx.rotate(fig.lean);
  ctx.imageSmoothingQuality = 'high';
  if (Math.abs(F - 1) > 0.02) {
    const Bf = bigFeet(key, img, F, m);
    ctx.drawImage(Bf.c, -Bf.ax * s, -Bf.by * s, Bf.sw * s, Bf.sh * s);
  } else ctx.drawImage(img, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
  ctx.restore();
}

// ======================================================================
// 场景
// ======================================================================
function camOf(env) { return env.cam + extraCam(rawB(env)); }

export const s13 = {
  id: 's13',
  station: ST,
  quantize: HZ,
  figureStyle: 's13-crayon',
  freezeBeat: GAG + 2.55, // Outro 展墙：落地后，大鞋 + 星星
  figureAdjust(b, env) {
    const rb = rawB(env);
    const sy = shakeY(b, rb);
    if (rb >= GAG && rb < LEAVE) {
      const G = gagFigure(b, rb);
      return { pose: G.pose, dx: G.dx, dy: G.dy + sy, rotate: G.rot };
    }
    if (rb >= LEAVE && b < LEAVE) return { pose: 'walk' };
    return null;
  },
  drawFigure(ctx, fig, b, env) { drawMan(ctx, fig, b, rawB(env)); },
  drawBack(ctx, b, env) {
    const rb = rawB(env), C = camOf(env), camGag = env.camAt(GAG);
    const v = boilOf(b), dy = shakeY(b, rb);
    ctx.drawImage(paper(), X_MIN, 0, X_MAX - X_MIN, 1000);
    let j = jolt(b, rb, 1);
    drawLayer(ctx, skyLayer(v), C, j[0], j[1] + dy * 0.3);
    j = jolt(b, rb, 2);
    drawLayer(ctx, rainbowLayer(v), C, j[0], j[1] + dy * 0.4);
    drawClouds(ctx, b, C, dy);
    drawSun(ctx, b, rb, dy);
    drawBirds(ctx, b, rb, dy);
    j = jolt(b, rb, 3);
    drawLayer(ctx, farLayer(v), C, j[0], j[1] + dy * 0.6);
    j = jolt(b, rb, 4);
    drawLayer(ctx, townLayer(v), C, j[0], j[1] + dy * 0.85);
    j = jolt(b, rb, 5);
    drawLayer(ctx, groundLayer(v), C, j[0], j[1] + dy);
    drawCast(ctx, b, rb, C, camGag, dy);
    if (rb >= T_JUMP && rb < T_LAND + 0.1) {
      const G = gagFigure(b, rb);
      drawSpeed(ctx, b, rb, CHAR_X + G.dx, ROAD_Y + G.dy);
    }
  },
  drawFront(ctx, b, env) {
    const rb = rawB(env), C = camOf(env), dy = shakeY(b, rb);
    const v = boilOf(b);
    const fx = CHAR_X + gagFigure(b, rb).dx;
    if (rb >= T_POP && rb < T_POP + 0.7) drawPop(ctx, b, fx, ROAD_Y, (b - T_POP + qStep()) / 0.7, true);
    if (rb >= T_SHRINK && rb < T_SHRINK + 0.6) drawPop(ctx, b, fx, ROAD_Y, (b - T_SHRINK + qStep()) / 0.6, false);
    if (rb >= T_LAND) {
      const Cl = env.cam + extraCam(T_LAND);
      drawLanding(ctx, b, rb, CHAR_X + strideW(T_LAND) - extraCam(T_LAND), C, Cl);
    }
    const j = jolt(b, rb, 6);
    drawLayer(ctx, frontLayer(v), C, j[0], j[1] + dy);
  },
  drawFrame(ctx, R, env) { crayonFrame(ctx, R, boilOf(env.b)); },
  cardStyle: {
    ink: INK, accent: RED, bar: false, family: SANS,
    bgDraw(ctx, x, y, w, h, b) { cardBg(ctx, x, y, w, h, boilRaw(b)); },
  },
  playerStyle: {
    ink: INK, noteColor: RED, backdrop: false, family: SANS,
    plateDraw(ctx, x, y, w, h) { plateBg(ctx, x, y, w, h); },
    drawPlayer(ctx, kind, cx, cy, s, spin, P, gb) { crayonPhone(ctx, cx, cy, gb); },
  },
};

// ======================================================================
// 标题卡、歌名底板、手机、离场画框（像素坐标）
// ======================================================================
/** 像素空间里的小图：在 (w, h) 的透明画布上画，带纸纹颗粒。 */
function pxSprite(key, w, h, draw, grain = 0.8) {
  return memo(`s13-px|${key}|${Math.round(w)}|${Math.round(h)}`, () => {
    const c = makeCanvas(w, h), g = c.getContext('2d');
    draw(g);
    if (grain) applyGrain(g, c.width, c.height, grain);
    return c;
  });
}
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
/** 标题卡：白画纸卡片（不加颗粒），一圈多色蜡笔边，角上一颗星、一颗心，顶上一条纸胶带。 */
function cardBg(ctx, x, y, w, h, v) {
  const pad = 30;
  const paperC = pxSprite(`card-paper|${v}`, w + pad * 2, h + pad * 2, (g) => {
    g.save();
    g.shadowColor = 'rgba(60,40,20,0.22)'; g.shadowBlur = 14; g.shadowOffsetY = 5;
    g.fillStyle = PAPER;
    tracePts(g, wob(rectPts(pad, pad, w, h), true, 2100 + v * 977, 2.5, { step: 20 })); g.closePath(); g.fill();
    g.restore();
  }, 0);
  const deco = pxSprite(`card-deco|${v}`, w + pad * 2, h + pad * 2, (g) => {
    const J = 2110 + v * 977;
    const cols = [RED, ORANGE, YELLOW, GRASS, BLUE, PURPLE];
    const P = [[pad + 8, pad + 8], [pad + w - 8, pad + 8], [pad + w - 8, pad + h - 8], [pad + 8, pad + h - 8]];
    // 每条边分几段，换颜色
    let ci = 0;
    for (let e = 0; e < 4; e++) {
      const a = P[e], bb = P[(e + 1) % 4], n = e % 2 ? 2 : 3;
      for (let k = 0; k < n; k++) {
        const t0 = k / n - 0.02, t1 = (k + 1) / n + 0.02;
        cline(g, [[lerp(a[0], bb[0], t0), lerp(a[1], bb[1], t0)], [lerp(a[0], bb[0], t1), lerp(a[1], bb[1], t1)]], { c: cols[ci++ % 6], w: 7, seed: J + ci, amp: 2.2 });
      }
    }
    // 星星（右上角）、心（左下角）
    const sx = pad + w - 34, sy = pad + 30;
    const star = Array.from({ length: 10 }, (_, k) => { const an = -Math.PI / 2 + (k * Math.PI) / 5, r = k % 2 ? 7 : 16; return [sx + Math.cos(an) * r, sy + Math.sin(an) * r]; });
    shape(g, star, YELLOW, SUN_O, J + 50, { fill: { gap: 2.5, w: 4 }, line: { w: 3 } });
    const hx = pad + 24, hy = pad + h - 26;
    const heart = Array.from({ length: 24 }, (_, k) => { const t = (k / 24) * TAU; return [hx + 0.75 * 16 * Math.sin(t) ** 3, hy - 0.75 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t))]; });
    shape(g, heart, PINK, '#c2255c', J + 60, { fill: { gap: 2.5, w: 4 }, line: { w: 3 } });
  });
  // 纸胶带
  ctx.save();
  ctx.drawImage(paperC, x - pad, y - pad);
  ctx.drawImage(deco, x - pad, y - pad);
  ctx.translate(x + w * 0.5, y + 2);
  ctx.rotate(-0.04);
  ctx.fillStyle = 'rgba(255,255,255,0.62)';
  ctx.fillRect(-60, -14, 120, 28);
  ctx.restore();
}
/** 歌名底板：一条白纸条，橙色蜡笔歪边，两端各一小段纸胶带。 */
function plateBg(ctx, x, y, w, h) {
  const pad = 24;
  const c = pxSprite('plate', w + pad * 2, h + pad * 2, (g) => {
    g.save();
    g.shadowColor = 'rgba(60,40,20,0.2)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.fillStyle = PAPER;
    tracePts(g, wob(rectPts(pad, pad, w, h), true, 2200, 2, { step: 20 })); g.closePath(); g.fill();
    g.restore();
  }, 0);
  const d = pxSprite('plate-deco', w + pad * 2, h + pad * 2, (g) => {
    cline(g, rectPts(pad + 6, pad + 6, w - 12, h - 12), { c: ORANGE, w: 6, closed: true, seed: 2210, amp: 2.2 });
    cline(g, [[pad + 70, pad + h - 14], [pad + w - 24, pad + h - 16]], { c: PINK, w: 4, seed: 2212, amp: 2 });
  });
  ctx.drawImage(c, x - pad, y - pad);
  ctx.drawImage(d, x - pad, y - pad);
  ctx.save();
  ctx.fillStyle = 'rgba(116,192,252,0.45)';
  for (const [tx, r] of [[x - 4, -0.5], [x + w + 4, 0.5]]) { ctx.save(); ctx.translate(tx, y + 8); ctx.rotate(r); ctx.fillRect(-22, -10, 44, 20); ctx.restore(); }
  ctx.restore();
}
/** 蜡笔画的手机：紫色机身、浅黄屏幕（歪的），转动的彩虹圆盘、跳动的音波、走动的进度条、播放键。 */
const PH_W = 136, PH_H = 236;
function phoneBody(v) {
  return pxSprite(`phone|${v}`, PH_W + 40, PH_H + 40, (g) => {
    const J = 2300 + v * 977;
    g.translate(20, 20);
    const body = [];
    const r = 22;
    for (let k = 0; k <= 36; k++) {
      const q = Math.floor(k / 9), t = ((k % 9) / 8) * (Math.PI / 2), a = -Math.PI + q * (Math.PI / 2) + t;
      const cx = q === 0 ? r : q === 1 ? PH_W - r : q === 2 ? PH_W - r : r, cy = q === 0 ? r : q === 1 ? r : q === 2 ? PH_H - r : PH_H - r;
      if (k < 36) body.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    shape(g, body, PURPLE, INK_D, J, { fill: { gap: 5, w: 7, ang: 0.9 }, line: { w: 5 } });
    const scr = [[12, 26], [PH_W - 13, 24], [PH_W - 11, PH_H - 26], [13, PH_H - 24]];
    cfill(g, scr, { c: '#fff3bf', seed: J + 5, gap: 4, w: 6, ang: 0.15, alpha: 1, amp: 1.5 });
    cfill(g, scr, { c: '#ffffff', seed: J + 6, gap: 7, w: 4, ang: -0.4, alpha: 0.6, amp: 1.5 });
    cline(g, scr, { c: INK_D, w: 3.5, closed: true, seed: J + 7 });
    cline(g, [[PH_W / 2 - 14, 13], [PH_W / 2 + 14, 13]], { c: '#212529', w: 4, seed: J + 8 });
    shape(g, ellPts(PH_W / 2 + 26, 13, 3.5, 3.5, 8), '#212529', null, J + 9, { fill: { gap: 2, w: 3 } });
  });
}
function phoneDisc(v) {
  return pxSprite(`phdisc|${v}`, 100, 100, (g) => {
    const J = 2350 + v * 977;
    g.translate(50, 50);
    [RED, ORANGE, YELLOW, GRASS, BLUE].forEach((c, i) => cline(g, ellPts(0, 0, 40 - i * 6.5, 40 - i * 6.5, 22), { c, w: 6, closed: true, seed: J + i, amp: 1.2, passes: 1 }));
    shape(g, ellPts(0, 0, 8, 8, 10), PINK, INK_D, J + 9, { fill: { gap: 2, w: 3 }, line: { w: 2.5 } });
    cline(g, [[0, -38], [0, -14]], { c: '#ffffff', w: 4, seed: J + 10 });
  });
}
function crayonPhone(ctx, cx, cy, gb) {
  const gq = quantizeBeats(gb, HZ), v = boilOf(gq), f = frameOf(gq);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.05);
  ctx.translate(-PH_W / 2, -PH_H / 2);
  ctx.drawImage(phoneBody(v), -20, -20);
  // 圆盘（每格转一点）
  ctx.save();
  ctx.translate(PH_W / 2, 78);
  ctx.rotate(gq * (TAU / 4));
  const d = phoneDisc(v);
  ctx.drawImage(d, -50, -50);
  ctx.restore();
  // 音波：7 根柱子，每格跳
  ctx.lineCap = 'round';
  for (let i = 0; i < 7; i++) {
    const beatPulse = 1 - (gq % 1);
    const hgt = 6 + 20 * hash2(i, f, 2360) * (0.5 + 0.5 * beatPulse);
    const x = 28 + i * 13.5, y = 152;
    ctx.strokeStyle = [RED, ORANGE, YELLOW, GRASS, BLUE, PURPLE, PINK][i];
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(x + (hash2(i, f, 2361) - 0.5) * 2, y); ctx.lineTo(x + (hash2(i, f, 2362) - 0.5) * 3, y - hgt); ctx.stroke();
  }
  // 进度条
  const prog = 0.15 + ((gq / 64) % 0.75);
  ctx.strokeStyle = '#ced4da'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(24, 176); ctx.lineTo(PH_W - 24, 175); ctx.stroke();
  ctx.strokeStyle = PINK; ctx.lineWidth = 6;
  const px = 24 + (PH_W - 48) * prog;
  ctx.beginPath(); ctx.moveTo(24, 176); ctx.lineTo(px, 175.5 + (hash2(f, 1, 2363) - 0.5) * 2); ctx.stroke();
  ctx.fillStyle = RED;
  ctx.beginPath(); ctx.arc(px, 175.5, 7, 0, TAU); ctx.fill();
  // 播放键 + 前后
  const yb = 204;
  ctx.fillStyle = INK_D; ctx.strokeStyle = INK_D; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  const jj = (k) => (hash2(k, f, 2364) - 0.5) * 1.6;
  ctx.beginPath(); ctx.moveTo(PH_W / 2 - 8 + jj(1), yb - 12); ctx.lineTo(PH_W / 2 + 12 + jj(2), yb); ctx.lineTo(PH_W / 2 - 8 + jj(3), yb + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (const s of [-1, 1]) {
    const bx = PH_W / 2 + s * 38;
    ctx.beginPath(); ctx.moveTo(bx - s * 6, yb - 8); ctx.lineTo(bx + s * 6, yb); ctx.lineTo(bx - s * 6, yb + 8); ctx.closePath(); ctx.fill();
    ctx.fillRect(bx + s * 7 - 1.5, yb - 8, 3, 16);
  }
  ctx.restore();
}
/** 离场画框：孩子画的画框——四边粗粗的多色蜡笔带，之字形涂色，四角大星星。先按 s = 1 烘焙，再整体缩放。 */
const FR_T = 74, FR_PAD = 40, FR_RES = 0.75;
function frameImg(v) {
  const t = FR_T, p = FR_PAD;
  const Wf = PX_W + 2 * (t + p), Hf = PX_H + 2 * (t + p);
  return baked(`s13-frame|${v}`, Wf * FR_RES, Hf * FR_RES, (g, c) => {
    g.scale(FR_RES, FR_RES);
    const J = 2400 + v * 977;
    const x = t + p, y = t + p, w = PX_W, h = PX_H;
    const sides = [
      { pts: [[x - t, y - t], [x + w + t, y - t], [x + w, y], [x, y]], c: RED, ang: 1.2 },
      { pts: [[x + w + t, y - t], [x + w + t, y + h + t], [x + w, y + h], [x + w, y]], c: ORANGE, ang: 0.3 },
      { pts: [[x + w + t, y + h + t], [x - t, y + h + t], [x, y + h], [x + w, y + h]], c: GRASS, ang: 1.1 },
      { pts: [[x - t, y + h + t], [x - t, y - t], [x, y], [x, y + h]], c: BLUE, ang: 0.4 },
    ];
    sides.forEach((S, i) => cfill(g, S.pts, { c: S.c, seed: J + i * 11, ang: S.ang, gap: 10, w: 13, alpha: 0.9, amp: 6, skip: 0.08 }));
    cline(g, rectPts(x - t, y - t, w + 2 * t, h + 2 * t), { c: INK_D, w: 9, closed: true, seed: J + 50, amp: 4, step: 14 });
    cline(g, rectPts(x - 3, y - 3, w + 6, h + 6), { c: INK_D, w: 8, closed: true, seed: J + 51, amp: 4, step: 14 });
    // 中间一道彩色小点（孩子在画框上点点）
    const dots = [YELLOW, PINK, '#ffffff', LILAC];
    for (let k = 0, d = 0; d < 2 * (w + h) + 8 * t; d += 70, k++) {
      let px, py; const per = 2 * (w + 2 * t) + 2 * (h + 2 * t), q = d % per, W2 = w + t, H2 = h + t;
      if (q < W2) { px = x - t / 2 + q; py = y - t / 2; } else if (q < W2 + H2) { px = x + w + t / 2; py = y - t / 2 + (q - W2); } else if (q < 2 * W2 + H2) { px = x + w + t / 2 - (q - W2 - H2); py = y + h + t / 2; } else { px = x - t / 2; py = y + h + t / 2 - (q - 2 * W2 - H2); }
      shape(g, ellPts(px, py, 9, 9, 10), dots[k % 4], null, J + 100 + k, { fill: { gap: 3, w: 5, alpha: 0.95 } });
    }
    // 四角大星星
    [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]].forEach(([sx, sy], i) => {
      const star = Array.from({ length: 10 }, (_, k) => { const an = -Math.PI / 2 + (k * Math.PI) / 5 + i * 0.2, r = k % 2 ? 26 : 64; return [sx + Math.cos(an) * r, sy + Math.sin(an) * r]; });
      shape(g, star, YELLOW, SUN_O, J + 200 + i * 7, { fill: { gap: 6, w: 9 }, line: { w: 7 } });
    });
    applyGrain(g, c.width, c.height, 0.9);
  });
}
function crayonFrame(ctx, R, v) {
  const { x, y, s } = R, t = FR_T, p = FR_PAD;
  const img = frameImg(v);
  ctx.save();
  ctx.drawImage(img, x - (t + p) * s, y - (t + p) * s, (PX_W + 2 * (t + p)) * s, (PX_H + 2 * (t + p)) * s);
  ctx.restore();
}
void rgba; void keyframes;
