// 第 4 站 · 叶惠美（Yeh Hui-Mei, 2003）·「以父之名」· 白天的哥特教堂 · 彩色玻璃
// 白天：阳光从窗外斜射进来（从右上往左下），透过彩色玻璃在浅色石墙和地面投下彩色光斑；铅条细；整体明亮通透。
// 构图（视差由远到近）：
//   0.35 后墙：浅色石砌墙、壁柱、肋拱、一排尖拱高窗（几何花窗 + 抽象纹样，原创），定格处是一扇巨大的花窗（两尖窗 + 玫瑰窗）
//   0.6  远处地面   0.75 束柱与拱券（墙面、柱身上有静止的彩色光斑）
//   1    石板地面：随光柱移动的彩色光斑；空中的光柱（带浮尘）
//   1.3  前景：浅色橡木长椅的椅端
// 人物：平时是漫画化 + 光斑叠色（走进光柱时，彩色光落在他身上）；
// 梗（第 9–12 拍）：第 9 拍强拍他走进巨大花窗的投影里定格，被细铅条切成一块块彩色玻璃；
//   第 11 拍（第 3 小节第 3 拍）一束阳光从玫瑰窗直射下来打在他身上，玻璃被照透、浮尘闪亮，浮尘在他头顶聚成一圈又散开；
//   第 13 拍强拍恢复原样继续走。
// 所有纹样原创，不对应任何真实教堂的窗，也不对应 MV 画面。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { strip, drawStrip, stripRange } from '../kit/strip.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { circle, ellipse, poly, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { GAG, B } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk, FIGURE_H, ANCHORS } from '../rig/walker.js';
import { registerStyle, comicBase, smoothColor, sobel, lumaArray, outline, rgbf, clone, sstep } from '../rig/styles.js';

const ST = stationByN(4);

// ---------- 调色板 ----------
const STONE = '#efe9dc', STONE_M = '#e3dbcb', STONE_D = '#d2c7b3', STONE_L = '#f7f3ea', JOINT = '#c9bda7';
const LEAD = '#3c3a44', INK = '#3c3a44';
const BLUE = '#3b7cc2', BLUE_D = '#2f6fb0', RUBY = '#cc4434', AMBER = '#efbe52', GREEN = '#44a573', PURPLE = '#8259ad';
const PALE1 = '#f1f3ea', PALE2 = '#f6edd3', PALE3 = '#e1ecf3', SKY = '#a6cbe8', ROSE = '#e8968a', SUN = '#fff3cf';
const OAK = '#e0c597', OAK_D = '#b8935f';

const P_FAR = 0.35, P_BFLOOR = 0.6, P_PIER = 0.75, P_FG = 1.3;
const WALL_BOT = 740;          // 后墙墙脚
const SL = 0.75;               // 光线斜率：往上每 1 单位，往右 0.75 单位（阳光从右上照进来）
const LW = 1.5;                // 铅条宽（单位，≈ 1.6px）

// 梗的拍点
const T_GLASS = GAG;           // 第 9 拍（第 3 小节强拍）：变成彩色玻璃
const T_SUN = B(3, 3);         // 第 11 拍（第 3 小节第 3 拍）：一束阳光打下来
const T_BACK = GAG + 4;        // 第 13 拍：恢复原样

// ---------- 人物画风 ----------
// 平时：漫画化（白天室内，暖一点的墨色）；光斑叠色在 drawFigure 里按光柱位置加
registerStyle('s04-comic', (I) => comicBase(I, { levels: 4, keep: 0.2, lw: 2.2, inner: 0.55, ink: '#25222a' }));

// 梗：白天的彩色玻璃——浅色亮玻璃、细铅条；脸和手是暖色玻璃 + 赭色描画的五官（像玻璃上的彩绘）
registerStyle('s04-glass', (I) => {
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
      const s = seeds[k]; if (!s) continue;
      const d = (s[0] - x) ** 2 + (s[1] - y) ** 2;
      if (d < d1) { d2 = d1; d1 = d; k1 = k; } else if (d < d2) d2 = d;
    }
    near[i] = k1; d1a[i] = Math.sqrt(d1); d2a[i] = Math.sqrt(d2);
  }
  const isSkin = (i) => I.r[i] > 0.38 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
  // 每块玻璃：平均亮度、皮肤占比、平均高度（按人物上下范围归一：头发 / 上衣 / 裤子 / 鞋各用一组颜色，像一扇设计过的人像窗）
  let top = h, bot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (I.a[y * w + x] > 0.5) { top = Math.min(top, y); bot = Math.max(bot, y); }
  const stats = new Map();
  for (let i = 0; i < n; i++) {
    if (I.a[i] < 0.5) continue;
    let s = stats.get(near[i]);
    if (!s) { s = [0, 0, 0, 0]; stats.set(near[i], s); }
    s[0] += L[i]; s[1]++; if (isSkin(i)) s[2]++; s[3] += Math.floor(i / w);
  }
  const pickW = (t, list) => { let acc = 0; const tot = list.reduce((a, c) => a + c[1], 0); for (const [c, wt] of list) { acc += wt / tot; if (t < acc) return c; } return list[list.length - 1][0]; };
  const REGION = {
    hair: [[PURPLE, 3], ['#5a4a9e', 2], [BLUE_D, 2]],
    shirt: [[BLUE, 4], ['#4f8fd0', 3], [BLUE_D, 2], ['#2f8f8b', 1.2], [SKY, 0.8]],
    pants: [[PURPLE, 3], ['#6b52a8', 2], [BLUE_D, 1.5], ['#9a6cc0', 1]],
    shoes: [[RUBY, 3], [AMBER, 1]],
  };
  const col = new Map();
  for (const [k, s] of stats) {
    const l = s[0] / s[1], skin = s[2] / s[1] > 0.45, t = hash2(k, 7, 41);
    const yn = (s[3] / s[1] - top) / Math.max(1, bot - top);
    let c;
    if (skin) c = pickW(t, [['#f6dc9c', 3], ['#f8ead0', 2], ['#efc47e', 2], ['#f2c9a8', 1]]);
    else {
      const reg = yn < 0.15 ? 'hair' : yn < 0.5 ? 'shirt' : yn < 0.93 ? 'pants' : 'shoes';
      c = pickW(t, REGION[reg]);
      if (l > 0.5) c = mix(c, '#ffffff', 0.3);        // 原图的亮处：浅一点的玻璃
    }
    col.set(k, { c: rgbf(c), l });
  }
  const lead = rgbf(LEAD), paint = rgbf('#6a4330');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (I.a[i] < 0.02) continue;
    const C = col.get(near[i]) || { c: rgbf(BLUE), l: 0.2 };
    // 玻璃质感：块中心略亮、块内沿用原图明暗做一点起伏、细小的气泡纹
    const glow = 0.92 + 0.14 * (1 - Math.min(1, d1a[i] / cell));
    const tone = 1 + Math.max(-0.12, Math.min(0.12, (L[i] - C.l) * 0.6));
    const ripple = 1 + (noise2(x * 0.11, y * 0.05, 33) - 0.5) * 0.12;
    const k = glow * tone * ripple;
    let r = Math.min(1, C.c[0] * k), g = Math.min(1, C.c[1] * k), bl = Math.min(1, C.c[2] * k);
    // 细铅条
    const ld = sstep(1.0, 2.0, d2a[i] - d1a[i]);
    r = lead[0] + (r - lead[0]) * ld; g = lead[1] + (g - lead[1]) * ld; bl = lead[2] + (bl - lead[2]) * ld;
    // 彩绘线：皮肤上描五官，其余处描主要的结构线（胳膊和身体的分界、衣褶）
    const skin = isSkin(i);
    const e = skin ? sstep(0.22, 0.5, E[i]) * 0.9 : sstep(0.5, 0.85, E[i]) * 0.85;
    const pc = skin ? paint : lead;
    r += (pc[0] - r) * e; g += (pc[1] - g) * e; bl += (pc[2] - bl) * e;
    O.r[i] = r; O.g[i] = g; O.b[i] = bl;
    O.a[i] = I.a[i] > 0.5 ? 1 : I.a[i];
  }
  outline(O, I.a, 2.0, lead);
  return O;
});

// ---------- 尖拱与花窗纹样（原创） ----------
/** 等边尖拱的窗洞：左上角 (x, y) 是尖顶所在的包围盒，宽 w、高 h。 */
function lancet(x, y, w, h) {
  const p = new Path2D();
  const sy = y + w * 0.866;
  p.moveTo(x, y + h); p.lineTo(x, sy);
  p.arc(x + w, sy, w, Math.PI, Math.PI * 4 / 3);
  p.arc(x, sy, w, -Math.PI / 3, 0);
  p.lineTo(x + w, y + h); p.closePath();
  return p;
}
const shade = (hex, k) => (k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k));
function glassFill(ctx, path, c, seed) {
  ctx.fillStyle = shade(c, (hash2(seed, 3, 77) - 0.5) * 0.16);
  ctx.fill(path);
}
function leadStroke(ctx, path, lw = LW) { ctx.strokeStyle = LEAD; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke(path); }
/** 窗框的彩色边带：沿尖拱内侧一圈小块（蓝红相间），再描两道铅条。 */
function borderBand(ctx, x, y, w, h, cols, seed) {
  const outer = lancet(x, y, w, h), inner = lancet(x + 8, y + 9, w - 16, h - 16);
  ctx.save();
  ctx.clip(outer);
  ctx.fillStyle = cols[0]; ctx.fill(outer);
  ctx.setLineDash([9, 9]); ctx.lineWidth = 9; ctx.strokeStyle = cols[1]; ctx.lineDashOffset = seed;
  const mid = lancet(x + 4, y + 4.5, w - 8, h - 8); ctx.stroke(mid);
  ctx.setLineDash([]);
  // 分块的铅条：每隔 9 单位一道短线
  ctx.strokeStyle = LEAD; ctx.lineWidth = LW * 0.8; ctx.setLineDash([1.2, 7.8]); ctx.lineDashOffset = seed; ctx.lineWidth = 9; ctx.stroke(mid);
  ctx.setLineDash([]);
  ctx.restore();
  leadStroke(ctx, outer); leadStroke(ctx, inner);
  return inner;
}

/** 纹样一：菱形格子（浅色素玻璃）+ 交点上的小色块 + 彩色边带。 */
function quarry(ctx, x, y, w, h, v = 0) {
  const R = rng('s04-quarry', v);
  const accent = [[RUBY, BLUE], [BLUE, AMBER], [GREEN, RUBY]][v % 3];
  const inner = borderBand(ctx, x, y, w, h, accent, v * 5);
  ctx.save(); ctx.clip(inner);
  const dx = (w - 16) / 3, dy = dx * 1.5;
  for (let j = -1; j < (h / dy) * 2 + 2; j++) for (let i = -1; i < 5; i++) {
    const cx = x + 8 + (i + (j % 2 ? 0.5 : 0)) * dx, cy = y + j * dy / 2;
    const p = new Path2D(); p.moveTo(cx, cy - dy / 2); p.lineTo(cx + dx / 2, cy); p.lineTo(cx, cy + dy / 2); p.lineTo(cx - dx / 2, cy); p.closePath();
    const t = R();
    glassFill(ctx, p, t < 0.4 ? PALE1 : t < 0.7 ? PALE2 : t < 0.9 ? PALE3 : SKY, i * 31 + j);
    leadStroke(ctx, p);
  }
  // 交点的小方块
  for (let j = 0; j < (h / dy) * 2 + 2; j += 2) for (let i = 0; i < 4; i++) {
    const cx = x + 8 + i * dx + dx / 2, cy = y + j * dy / 2 + dy / 2;
    const p = new Path2D(); p.rect(cx - 4, cy - 4, 8, 8);
    glassFill(ctx, p, (i + j / 2) % 2 ? accent[1] : AMBER, i + j);
    leadStroke(ctx, p, LW * 0.8);
  }
  ctx.restore();
}
/** 纹样二：蓝底上一列圆形纹章，每个纹章是放射状的彩色花瓣（抽象，不画人物故事）。 */
function medallion(ctx, x, y, w, h, v = 0) {
  const R = rng('s04-med', v);
  const inner = borderBand(ctx, x, y, w, h, [AMBER, RUBY], v * 7);
  ctx.save(); ctx.clip(inner);
  // 蓝底：小方块马赛克
  const q = 12;
  for (let yy = y; yy < y + h; yy += q) for (let xx = x + 8; xx < x + w - 8; xx += q) {
    const p = new Path2D(); p.rect(xx, yy, q, q);
    const t = R();
    glassFill(ctx, p, t < 0.75 ? BLUE : t < 0.9 ? BLUE_D : RUBY, xx * 3 + yy);
    leadStroke(ctx, p, LW * 0.7);
  }
  const r = (w - 16) * 0.42, cx = x + w / 2;
  const sets = [[RUBY, AMBER, GREEN], [GREEN, AMBER, PURPLE], [PURPLE, PALE2, RUBY]];
  let k = 0;
  for (let cy = y + w * 0.75; cy < y + h - r * 0.8; cy += r * 2.35, k++) {
    const [c1, c2, c3] = sets[(k + v) % 3];
    const ring = new Path2D(); ring.arc(cx, cy, r, 0, TAU);
    glassFill(ctx, ring, c1, k);
    const N = 8;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * TAU + k * 0.2, a1 = a0 + TAU / N;
      const p = new Path2D(); p.arc(cx, cy, r * 0.82, a0, a1); p.arc(cx, cy, r * 0.42, a1, a0, true); p.closePath();
      glassFill(ctx, p, i % 2 ? c2 : c3, i + k * 9);
      leadStroke(ctx, p);
    }
    const hub = new Path2D(); hub.arc(cx, cy, r * 0.42, 0, TAU);
    glassFill(ctx, hub, c2 === AMBER ? PALE2 : AMBER, k + 50);
    leadStroke(ctx, hub);
    const dot = new Path2D(); dot.arc(cx, cy, r * 0.16, 0, TAU);
    glassFill(ctx, dot, RUBY, k + 60); leadStroke(ctx, dot);
    leadStroke(ctx, ring);
  }
  ctx.restore();
}
/** 纹样三：抽象的流动色带（竖向波纹分区）+ 横向的箍条 + 点缀的小圆。 */
function ribbon(ctx, x, y, w, h, v = 0) {
  const R = rng('s04-rib', v);
  const inner = borderBand(ctx, x, y, w, h, [GREEN, AMBER], v * 3);
  ctx.save(); ctx.clip(inner);
  const cols = [[SKY, GREEN, AMBER, PURPLE, ROSE], [AMBER, RUBY, PALE2, BLUE, GREEN], [PALE3, BLUE, AMBER, GREEN, RUBY]][v % 3];
  const bands = 4;
  const edge = (k, yy) => x + 8 + ((w - 16) * k) / bands + (k > 0 && k < bands ? Math.sin(yy * 0.045 + k * 1.7 + v) * 8 : 0);
  const bar = 34;
  for (let yy = y; yy < y + h; yy += bar) {
    for (let k = 0; k < bands; k++) {
      const p = new Path2D();
      const N = 6;
      for (let s = 0; s <= N; s++) { const t = yy + (bar * s) / N; s ? p.lineTo(edge(k, t), t) : p.moveTo(edge(k, t), t); }
      for (let s = N; s >= 0; s--) { const t = yy + (bar * s) / N; p.lineTo(edge(k + 1, t), t); }
      p.closePath();
      glassFill(ctx, p, cols[(k + Math.floor((yy - y) / bar) * 2 + Math.floor(R() * 1.4)) % cols.length], k * 13 + yy);
      leadStroke(ctx, p);
    }
  }
  for (let i = 0; i < 6; i++) {
    const p = new Path2D(); p.arc(x + 14 + R() * (w - 28), y + w * 0.5 + R() * (h - w * 0.6), 5 + R() * 3, 0, TAU);
    glassFill(ctx, p, i % 2 ? RUBY : PALE2, i); leadStroke(ctx, p);
  }
  ctx.restore();
}
/** 玫瑰窗：中心圆 + 八瓣内环 + 外圈八个小圆叶。 */
function roseWindow(ctx, cx, cy, r) {
  const disk = new Path2D(); disk.arc(cx, cy, r, 0, TAU);
  ctx.save(); ctx.clip(disk);
  glassFill(ctx, disk, BLUE, 1);
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU - Math.PI / 2;
    const foil = new Path2D(); foil.arc(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74, r * 0.22, 0, TAU);
    glassFill(ctx, foil, [GREEN, AMBER, PURPLE, AMBER][i % 4], i + 10); leadStroke(ctx, foil);
    const fc = new Path2D(); fc.arc(cx + Math.cos(a) * r * 0.74, cy + Math.sin(a) * r * 0.74, r * 0.08, 0, TAU);
    glassFill(ctx, fc, RUBY, i + 20); leadStroke(ctx, fc);
    // 外圈小三角
    const a2 = a + Math.PI / N;
    const tri = new Path2D(); tri.moveTo(cx + Math.cos(a2) * r * 0.98, cy + Math.sin(a2) * r * 0.98);
    tri.lineTo(cx + Math.cos(a2 - 0.18) * r * 0.62, cy + Math.sin(a2 - 0.18) * r * 0.62); tri.lineTo(cx + Math.cos(a2 + 0.18) * r * 0.62, cy + Math.sin(a2 + 0.18) * r * 0.62); tri.closePath();
    glassFill(ctx, tri, RUBY, i + 30); leadStroke(ctx, tri);
  }
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * TAU - Math.PI / 2 + Math.PI / N, a1 = a0 + TAU / N;
    const p = new Path2D(); p.arc(cx, cy, r * 0.48, a0, a1); p.arc(cx, cy, r * 0.2, a1, a0, true); p.closePath();
    glassFill(ctx, p, i % 2 ? RUBY : SKY, i + 40); leadStroke(ctx, p);
  }
  const hub = new Path2D(); hub.arc(cx, cy, r * 0.2, 0, TAU);
  glassFill(ctx, hub, AMBER, 50); leadStroke(ctx, hub);
  const eye = new Path2D(); eye.arc(cx, cy, r * 0.08, 0, TAU);
  glassFill(ctx, eye, PALE2, 51); leadStroke(ctx, eye);
  ctx.restore();
  leadStroke(ctx, disk);
}
/** 巨大的花窗（定格处）：两扇尖窗 + 上方玫瑰窗，浅石窗棂。原点：外框包围盒左上角。 */
const GIANT = { w: 300, h: 540, rose: [150, 150, 78], l: [[16, 262, 120, 278], [164, 262, 120, 278]] };
function giantWindow(ctx, x, y, glassOnly = false) {
  const { w, h } = GIANT;
  const outer = lancet(x, y, w, h);
  ctx.save(); ctx.clip(outer);
  // 窗棂间的小块玻璃（蓝、红小方块）
  const q = 13;
  for (let yy = y; yy < y + h; yy += q) for (let xx = x; xx < x + w; xx += q) {
    const p = new Path2D(); p.rect(xx, yy, q, q);
    const t = hash2(xx, yy, 5);
    glassFill(ctx, p, t < 0.7 ? BLUE : t < 0.85 ? RUBY : AMBER, xx + yy);
    leadStroke(ctx, p, LW * 0.7);
  }
  medallion(ctx, x + GIANT.l[0][0], y + GIANT.l[0][1], GIANT.l[0][2], GIANT.l[0][3], 1);
  ribbon(ctx, x + GIANT.l[1][0], y + GIANT.l[1][1], GIANT.l[1][2], GIANT.l[1][3], 2);
  roseWindow(ctx, x + GIANT.rose[0], y + GIANT.rose[1], GIANT.rose[2]);
  ctx.restore();
  if (glassOnly) return;
  // 浅石窗棂：外框、玫瑰窗圈、两扇尖窗的框、中梃
  const bar = (path, lw) => {
    ctx.strokeStyle = STONE_D; ctx.lineWidth = lw + 3; ctx.stroke(path);
    ctx.strokeStyle = STONE_L; ctx.lineWidth = lw; ctx.stroke(path);
  };
  const ring = new Path2D(); ring.arc(x + GIANT.rose[0], y + GIANT.rose[1], GIANT.rose[2] + 4, 0, TAU);
  bar(ring, 9);
  for (const [lx, ly, lw2, lh] of GIANT.l) bar(lancet(x + lx - 4, y + ly - 4, lw2 + 8, lh + 8), 8);
  bar(outer, 12);
}

// 纹样表：后墙上的窗依次用这几种
const DESIGNS = [
  (c, x, y, w, h) => quarry(c, x, y, w, h, 0),
  (c, x, y, w, h) => medallion(c, x, y, w, h, 0),
  (c, x, y, w, h) => ribbon(c, x, y, w, h, 0),
  (c, x, y, w, h) => quarry(c, x, y, w, h, 1),
  (c, x, y, w, h) => ribbon(c, x, y, w, h, 1),
  (c, x, y, w, h) => medallion(c, x, y, w, h, 2),
];
const WIN = { w: 104, top: 168, h: 410 };

/** 光斑用的低分辨率纹样（放大后自然变柔，铅条成了淡淡的影子）。 */
function lightPattern(kind) {
  return memo(`s04-pat|${kind}`, () => {
    const giant = kind === 'giant';
    const w = giant ? 75 : 26, h = giant ? 135 : 104;
    const c = makeCanvas(w, h), g = c.getContext('2d');
    if (giant) { g.scale(w / GIANT.w, h / GIANT.h); giantWindow(g, 0, 0, true); }
    else { g.scale(w / WIN.w, h / WIN.h); DESIGNS[kind % DESIGNS.length](g, 0, 0, WIN.w, WIN.h); }
    // 柔化：光斑边缘是软的，铅条只剩淡淡的影子
    const pad = 4, o = makeCanvas(w + pad * 2, h + pad * 2), og = o.getContext('2d');
    og.filter = 'blur(1.3px)';
    og.drawImage(c, pad, pad);
    return o;
  });
}
/** 把纹样贴进一条斜的带子：u 横跨宽度 w，v 从 y0 到 y1；fx 是带子在 fy 高度时的中心。 */
function bandTransform(ctx, img, fx, fy, w, y0, y1) {
  const H = y1 - y0;
  ctx.transform(w / img.width, 0, (-SL * H) / img.height, H / img.height, fx - w / 2 + SL * (fy - y0), y0);
}
/** 光：先正片叠底（染色），再相加（提亮）。 */
function castLight(ctx, draw, tint, add) {
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = tint; draw(); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = add; draw(); ctx.restore();
}

// ---------- 后墙（0.35） ----------
const gagCam = (env) => Math.round(env.camAt(GAG));
/** 巨大花窗在后墙层里的位置：定格时它的中心在画面 x ≈ 585（玫瑰窗正好对着他）。 */
const giantX = (gc) => 585 + gc * P_FAR;
function farLayer(gc) {
  return strip(`s04-far-${gc}`, P_FAR, (ctx, x0, x1) => {
    const R = rng('s04-far');
    const GX = giantX(gc);
    // 墙面：浅石，石块错缝
    ctx.fillStyle = STONE; ctx.fillRect(x0, 0, x1 - x0, WALL_BOT);
    const ch = 44;
    for (let row = 0, y = 130; y < WALL_BOT; row++, y += ch) {
      const off = row % 2 ? 37 : 0;
      for (let x = x0 - 74 + off; x < x1; x += 74) {
        const t = hash2(Math.round(x), row, 11);
        ctx.fillStyle = rgba(t < 0.5 ? '#ffffff' : '#cbbfa8', 0.06 + 0.1 * hash2(Math.round(x), row, 12));
        ctx.fillRect(x + 1, y + 1, 72, ch - 2);
      }
      ctx.fillStyle = rgba(JOINT, 0.55); ctx.fillRect(x0, y, x1 - x0, 1.4);
      for (let x = x0 - 74 + off; x < x1; x += 74) ctx.fillRect(x, y, 1.4, ch);
    }
    // 柱位：巨大花窗占一个 400 宽的开间，两边是 330 宽的普通开间
    const shafts = [], bays = [];
    for (let k = 0; ; k++) { const sx = GX + 200 + k * 330; if (sx > x1 + 200) break; shafts.push(sx); bays.push(sx + 165); }
    for (let k = 0; ; k++) { const sx = GX - 200 - k * 330; if (sx < x0 - 200) break; shafts.push(sx); bays.push(sx - 165); }
    // 拱顶：墙肋（尖券）之上是略暗的拱顶面
    ctx.fillStyle = STONE_M; ctx.fillRect(x0, 0, x1 - x0, 150);
    const archOver = (a, b2, apex) => {
      const p = new Path2D();
      p.moveTo(a, 150); p.bezierCurveTo(a, 150 - (150 - apex) * 0.55, a + (b2 - a) * 0.28, apex + 6, (a + b2) / 2, apex);
      p.bezierCurveTo(a + (b2 - a) * 0.72, apex + 6, b2, 150 - (150 - apex) * 0.55, b2, 150);
      p.closePath();
      return p;
    };
    const sorted = shafts.slice().sort((a, b2) => a - b2);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const p = archOver(sorted[i], sorted[i + 1], sorted[i + 1] - sorted[i] > 360 ? -10 : 22);
      ctx.fillStyle = STONE; ctx.fill(p);
      ctx.strokeStyle = STONE_D; ctx.lineWidth = 9; ctx.stroke(p);
      ctx.strokeStyle = STONE_L; ctx.lineWidth = 3.5; ctx.stroke(p);
    }
    // 拱顶上的斜肋
    ctx.strokeStyle = rgba('#bfb29b', 0.6); ctx.lineWidth = 5;
    for (const sx of sorted) { ctx.beginPath(); ctx.moveTo(sx, 140); ctx.quadraticCurveTo(sx + 30, 40, sx + 120, -10); ctx.moveTo(sx, 140); ctx.quadraticCurveTo(sx - 30, 40, sx - 120, -10); ctx.stroke(); }
    // 窗下的盲券带
    ctx.fillStyle = STONE_M; ctx.fillRect(x0, 612, x1 - x0, 116);
    for (let x = x0; x < x1; x += 56) {
      const p = lancet(x + 7, 626, 42, 120);
      ctx.fillStyle = rgba('#b9ac94', 0.35); ctx.fill(p);
      ctx.save(); ctx.translate(-2.5, -2); ctx.fillStyle = STONE; ctx.fill(p); ctx.restore();
      // 三叶饰
      ctx.strokeStyle = rgba('#a89a80', 0.7); ctx.lineWidth = 1.6;
      for (const [dx2, dy2] of [[-7, 0], [7, 0], [0, -9]]) { ctx.beginPath(); ctx.arc(x + 28 + dx2 - 2.5, 660 + dy2, 6, 0, TAU); ctx.stroke(); }
    }
    ctx.fillStyle = STONE_L; ctx.fillRect(x0, 606, x1 - x0, 8);
    ctx.fillStyle = rgba('#b3a68e', 0.6); ctx.fillRect(x0, 614, x1 - x0, 2);
    // 墙脚线脚
    ctx.fillStyle = STONE_D; ctx.fillRect(x0, 724, x1 - x0, 16);
    ctx.fillStyle = STONE_L; ctx.fillRect(x0, 722, x1 - x0, 4);
    // 普通高窗
    bays.forEach((bx, i) => {
      if (bx < x0 - 120 || bx > x1 + 120) return;
      const x = bx - WIN.w / 2, k = ((Math.round(bx / 330) % DESIGNS.length) + DESIGNS.length) % DESIGNS.length;
      // 窗洞斜面（亮）+ 右侧阴影
      const splay = lancet(x - 16, WIN.top - 18, WIN.w + 32, WIN.h + 18);
      ctx.fillStyle = STONE_L; ctx.fill(splay);
      ctx.save(); ctx.clip(splay); ctx.fillStyle = rgba('#c2b59d', 0.45); ctx.fillRect(x - 16, WIN.top - 30, 14, WIN.h + 40); ctx.restore();
      ctx.strokeStyle = rgba('#b0a289', 0.8); ctx.lineWidth = 2; ctx.stroke(splay);
      DESIGNS[k](ctx, x, WIN.top, WIN.w, WIN.h);
      // 窗台
      ctx.fillStyle = STONE_D; ctx.fillRect(x - 20, WIN.top + WIN.h, WIN.w + 40, 10);
      ctx.fillStyle = STONE_L; ctx.fillRect(x - 20, WIN.top + WIN.h, WIN.w + 40, 3);
    });
    // 巨大花窗
    {
      const x = GX - GIANT.w / 2, y = 64;
      const splay = lancet(x - 26, y - 26, GIANT.w + 52, GIANT.h + 26);
      ctx.fillStyle = STONE_L; ctx.fill(splay);
      ctx.strokeStyle = rgba('#b0a289', 0.9); ctx.lineWidth = 2.5; ctx.stroke(splay);
      const splay2 = lancet(x - 12, y - 12, GIANT.w + 24, GIANT.h + 12);
      ctx.strokeStyle = rgba('#b0a289', 0.6); ctx.lineWidth = 1.5; ctx.stroke(splay2);
      giantWindow(ctx, x, y);
      ctx.fillStyle = STONE_D; ctx.fillRect(x - 30, y + GIANT.h, GIANT.w + 60, 12);
      ctx.fillStyle = STONE_L; ctx.fillRect(x - 30, y + GIANT.h, GIANT.w + 60, 4);
    }
    // 壁柱（细圆柱）：亮面朝右（阳光从右上来）
    for (const sx of sorted) {
      const g = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0);
      g.addColorStop(0, '#d3c8b4'); g.addColorStop(0.55, STONE_L); g.addColorStop(1, '#e9e2d4');
      ctx.fillStyle = g; ctx.fillRect(sx - 12, 150, 24, WALL_BOT - 150);
      ctx.fillStyle = STONE_L; poly(ctx, [[sx - 22, 132], [sx + 22, 132], [sx + 14, 152], [sx - 14, 152]]); ctx.fill();
      ctx.fillStyle = STONE_D; ctx.fillRect(sx - 24, 126, 48, 8);
      ctx.fillStyle = STONE_D; ctx.fillRect(sx - 18, 712, 36, 28);
    }
    // 墙上的彩色光斑（从对面窗户投过来的，静止）
    for (let x = x0 + 80; x < x1; x += 260 + R() * 220) {
      if (Math.abs(x - GX) < 220) continue;
      const img = lightPattern(Math.floor(R() * DESIGNS.length));
      const yb = 560 + R() * 140, w = 60 + R() * 40;
      castLight(ctx, () => { ctx.save(); bandTransform(ctx, img, x, yb, w, yb - 150, yb); ctx.drawImage(img, 0, 0); ctx.restore(); }, 0.32, 0.28);
    }
  }, { y0: 0, y1: WALL_BOT + 2 });
}

// ---------- 远处地面（0.6）、近处石板地面（1） ----------
function backFloorLayer() {
  return strip('s04-bfloor', P_BFLOOR, (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(0, 736, 0, 802);
    g.addColorStop(0, '#d8cebb'); g.addColorStop(1, '#e2d9c7');
    ctx.fillStyle = g; ctx.fillRect(x0, 736, x1 - x0, 68);
    ctx.fillStyle = rgba(JOINT, 0.6);
    for (const y of [752, 772]) ctx.fillRect(x0, y, x1 - x0, 1.2);
    for (let x = x0; x < x1; x += 130) { ctx.fillRect(x + (Math.round(x / 130) % 2) * 40, 752, 1.2, 20); ctx.fillRect(x + 70, 772, 1.2, 30); }
  }, { y0: 734, y1: 804 });
}
function floorLayer() {
  return strip('s04-floor', 1, (ctx, x0, x1) => {
    const R = rng('s04-floor');
    ctx.fillStyle = '#ddd3c1'; ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1000 - ROAD_Y + 2);
    const rows = [[800, 828], [828, 866], [866, 922], [922, 1000]];
    rows.forEach(([a, b2], r) => {
      let x = x0 - R() * 140;
      while (x < x1) {
        const w = 120 + (b2 - a) * 2.6 + R() * 80;
        ctx.fillStyle = mix('#e4dbca', '#cfc4af', R() * 0.6);
        ctx.fillRect(x + 1.5, a + 1.5, w - 3, b2 - a - 3);
        ctx.fillStyle = rgba('#ffffff', 0.22); ctx.fillRect(x + 3, a + 2, w - 8, 2);
        if (R() > 0.55) { ctx.fillStyle = rgba('#a89a80', 0.1); ellipse(ctx, x + R() * w, a + (b2 - a) * R(), 16 + R() * 22, 3 + R() * 5); ctx.fill(); }
        ctx.fillStyle = rgba('#a3957c', 0.7); ctx.fillRect(x, a, 1.8, b2 - a);
        x += w;
      }
      ctx.fillStyle = rgba('#a3957c', 0.6); ctx.fillRect(x0, b2 - 1, x1 - x0, 1.8);
    });
    // 和后墙地面的交界：一道浅色的台阶边
    ctx.fillStyle = '#ece5d7'; ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 4);
  }, { y0: ROAD_Y - 4, y1: 1000 });
}

// ---------- 束柱与拱券（0.75） ----------
const pierXs = (gc) => { const out = []; const [x0, x1] = stripRange(P_PIER); for (let x = -150 + gc * P_PIER - 1050 * 8; x < x1 + 300; x += 1050) if (x > x0 - 300) out.push(x); return out; };
function pierLayer(gc) {
  return strip(`s04-pier-${gc}`, P_PIER, (ctx, x0, x1) => {
    const R = rng('s04-pier');
    for (const px of pierXs(gc)) {
      // 拱券：从柱头两侧升起、出画
      for (const dir of [-1, 1]) {
        const p = new Path2D();
        p.moveTo(px + dir * 40, 236);
        p.bezierCurveTo(px + dir * 50, 110, px + dir * 170, 10, px + dir * 420, -40);
        ctx.strokeStyle = STONE_D; ctx.lineWidth = 78; ctx.stroke(p);
        ctx.strokeStyle = dir > 0 ? STONE_L : STONE; ctx.lineWidth = 70; ctx.stroke(p);
        ctx.strokeStyle = rgba('#b5a88f', 0.8); ctx.lineWidth = 2;
        for (const o of [-22, 6, 26]) { ctx.save(); ctx.translate(dir * o * 0.6, o * 0.5); ctx.stroke(p); ctx.restore(); }
      }
      // 柱身：中间粗圆柱 + 两侧细柱；右侧亮、左侧暗
      const shaft = (cx, hw) => {
        const g = ctx.createLinearGradient(cx - hw, 0, cx + hw, 0);
        g.addColorStop(0, '#cbbfa9'); g.addColorStop(0.35, '#e2d9c8'); g.addColorStop(0.75, STONE_L); g.addColorStop(1, '#ebe4d6');
        ctx.fillStyle = g; ctx.fillRect(cx - hw, 230, hw * 2, 520);
        ctx.fillStyle = rgba('#8f8370', 0.35); ctx.fillRect(cx - hw, 230, 1.6, 520);
      };
      shaft(px - 46, 15); shaft(px + 46, 15); shaft(px, 34);
      // 柱头：一圈叶饰 + 方形顶板
      ctx.fillStyle = STONE_L; poly(ctx, [[px - 72, 214], [px + 72, 214], [px + 58, 244], [px - 58, 244]]); ctx.fill();
      ctx.strokeStyle = rgba('#a89a80', 0.8); ctx.lineWidth = 2;
      for (let k = -3; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(px + k * 18, 242); ctx.quadraticCurveTo(px + k * 18 - 6, 226, px + k * 18 + 4, 220); ctx.stroke(); }
      ctx.fillStyle = STONE_D; ctx.fillRect(px - 80, 204, 160, 12);
      ctx.fillStyle = STONE_L; ctx.fillRect(px - 80, 204, 160, 3);
      // 柱础
      ctx.fillStyle = STONE_M; ctx.fillRect(px - 76, 748, 152, 46);
      ctx.fillStyle = STONE_L; ctx.fillRect(px - 64, 736, 128, 14); ctx.fillRect(px - 76, 748, 152, 4);
      ctx.fillStyle = rgba('#a3957c', 0.6); ctx.fillRect(px - 76, 792, 152, 2);
      // 柱身上静止的彩色光斑
      const img = lightPattern(Math.floor(R() * DESIGNS.length));
      const yb = 520 + R() * 120;
      castLight(ctx, () => { ctx.save(); ctx.beginPath(); ctx.rect(px - 62, 240, 124, 500); ctx.clip(); bandTransform(ctx, img, px + 10, yb, 70, yb - 180, yb); ctx.drawImage(img, 0, 0); ctx.restore(); }, 0.38, 0.3);
    }
  }, { y0: -60, y1: 800 });
}

// ---------- 光柱：随地面（视差 1）移动 ----------
// 每道光柱在某一拍正好扫过他的上半身；hit 是那一拍。巨大花窗的投影在第 9 拍罩住他。
const BEAMS = [
  { hit: -3.6, w: 120, fy: 860, k: 0 }, { hit: -1.4, w: 140, fy: 832, k: 1 }, { hit: 0.9, w: 120, fy: 878, k: 2 },
  { hit: 3.0, w: 150, fy: 846, k: 3 }, { hit: 5.1, w: 132, fy: 868, k: 4 },
  { hit: GAG, w: 300, fy: 836, k: 'giant', giant: true },
  { hit: 14.4, w: 134, fy: 862, k: 1 }, { hit: 16.4, w: 150, fy: 836, k: 3 }, { hit: 18.6, w: 124, fy: 872, k: 2 },
];
const TORSO_Y = 560, FIG_DX = 14;
function beamsFor(env) {
  // 普通光柱：在 hit 那一拍正好照在他胸口；巨大花窗的投影：在第 9 拍正好罩住他的脚下
  return memo('s04-beams', () => BEAMS.map((bm, i) => ({
    ...bm, L: env.camAt(bm.hit) + CHAR_X + FIG_DX - (bm.giant ? 0 : SL * (bm.fy - TORSO_Y)), d: bm.giant ? 130 : 64,
    a: bm.giant ? 1 : [0.75, 1, 0.55, 0.9, 0.65, 1, 0.6, 0.85, 0.7][i % 9],
  })));
}
const beamAt = (bm, cam) => bm.L - cam; // 光斑中心在画面上的 x
function drawFloorPatch(ctx, bm, cam, gain, drift = 0) {
  const img = lightPattern(bm.k);
  const fx = beamAt(bm, cam) + drift;
  if (fx < X_MIN - 400 || fx > X_MAX + 400) return;
  castLight(ctx, () => { ctx.save(); bandTransform(ctx, img, fx, bm.fy, bm.w * 1.2, bm.fy - bm.d / 2, bm.fy + bm.d / 2); ctx.drawImage(img, 0, 0); ctx.restore(); }, 0.5 * gain, 0.45 * gain);
}
/** 空中的光柱：几层由宽到窄的半透明带子叠起来，边缘是软的；上端淡出。 */
function drawShaft(ctx, bm, cam, alpha) {
  const fx = beamAt(bm, cam);
  const y1 = bm.fy - bm.d / 2, y0 = -60;
  const xAt = (y) => fx + SL * (bm.fy - y);
  if (xAt(y1) - bm.w > X_MAX + 100 || xAt(y0) + bm.w < X_MIN - 100) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(xAt(y0), y0, xAt(y1), y1);
  g.addColorStop(0, rgba(SUN, 0)); g.addColorStop(0.4, rgba(SUN, 0.022 * alpha)); g.addColorStop(1, rgba(SUN, 0.05 * alpha));
  ctx.fillStyle = g;
  for (const k of [1.3, 1.0, 0.75, 0.5]) {
    const hw = (bm.w * k) / 2;
    poly(ctx, [[xAt(y0) - hw, y0], [xAt(y0) + hw, y0], [xAt(y1) + hw, y1], [xAt(y1) - hw, y1]]); ctx.fill();
  }
  // 带一点颜色的光（玻璃的颜色顺着光柱往下拖）
  const img = lightPattern(bm.k);
  ctx.globalAlpha = 0.07 * alpha;
  ctx.save(); bandTransform(ctx, img, fx, bm.fy, bm.w, 260, y1); ctx.drawImage(img, 0, 0); ctx.restore();
  ctx.restore();
}
/** 光柱里的浮尘：浅底上用暖金色小点 + 白芯，才看得见。 */
function mote(ctx, x, y, r, al) {
  ctx.fillStyle = rgba('#e0a93a', 0.55 * al); circle(ctx, x, y, r * 1.5); ctx.fill();
  ctx.fillStyle = rgba('#fffdf2', al); circle(ctx, x, y, r * 0.8); ctx.fill();
}
function drawMotes(ctx, bm, cam, b, alpha, n = 14, seed = 0) {
  const fx = beamAt(bm, cam);
  for (let i = 0; i < n; i++) {
    const v = ((hash2(i, seed, 61) + b * 0.025 * (0.5 + hash2(i, seed, 62))) % 1);
    const y = lerp(140, bm.fy - 40, v);
    const u = hash2(i, seed, 63) - 0.5 + Math.sin(b * 0.9 + i * 2.1) * 0.06;
    const x = fx + SL * (bm.fy - y) + u * bm.w * 0.8;
    const tw = Math.max(0, Math.sin(b * 2.6 + i * 1.7));
    if (tw < 0.05) continue;
    mote(ctx, x, y, 0.9 + hash2(i, seed, 64) * 1.1, 0.75 * alpha * tw);
  }
}

// 梗的强弱曲线
const glassOn = (b) => b >= T_GLASS && b < T_BACK;
const sunAmt = (b) => smoothstep(T_SUN - 0.04, T_SUN + 0.06, b) * (1 - 0.35 * smoothstep(T_SUN + 0.3, T_SUN + 1.2, b)) * (1 - smoothstep(T_BACK - 0.1, T_BACK + 0.4, b));
const giantGain = (b) => 1 + 0.5 * smoothstep(T_GLASS - 0.1, T_GLASS + 0.15, b) * (1 - smoothstep(T_BACK, T_BACK + 1, b));

// ---------- 人物身上的光：把光柱的纹样只画在人物轮廓里，再叠到画面上 ----------
let scratch = null;
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
    minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py);
  }
  minX = Math.max(0, Math.floor(minX)); minY = Math.max(0, Math.floor(minY));
  maxX = Math.min(ctx.canvas.width, Math.ceil(maxX)); maxY = Math.min(ctx.canvas.height, Math.ceil(maxY));
  const w = maxX - minX, h = maxY - minY;
  if (w < 2 || h < 2) return;
  const c = scratchCanvas(w, h), oc = c.getContext('2d');
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.globalCompositeOperation = 'source-over'; oc.globalAlpha = 1;
  oc.clearRect(0, 0, w, h);
  oc.setTransform(T.a, T.b, T.c, T.d, T.e - minX, T.f - minY);
  oc.save();
  oc.scale(1 / (fig.scale * fig.sx), 1 / fig.scale);
  oc.translate(-fig.x, -fig.y);
  paint(oc);
  oc.restore();
  oc.globalCompositeOperation = 'destination-in';
  drawWalker(oc, { ...fig, rim: null });
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (tint > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = tint; ctx.drawImage(c, 0, 0, w, h, minX, minY, w, h); }
  if (add > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = add; ctx.drawImage(c, 0, 0, w, h, minX, minY, w, h); }
  ctx.restore();
}

// ---------- 前景：橡木长椅的椅端（1.3） ----------
const PEW_GROUPS = [-2700, -1900, -1100, -260, 1000, 1820, 2640, 3460];
function pewEnd(ctx, x) {
  // 椅端侧板：圆肩 + 后角一个小圆头，板上刻一个小尖拱
  const top = 884, W2 = 44;
  const p = new Path2D();
  p.moveTo(x - W2, 1010); p.lineTo(x - W2, top + 4);
  p.quadraticCurveTo(x - W2, top - 10, x - W2 + 16, top - 10);
  p.lineTo(x + W2 - 22, top - 6);
  p.quadraticCurveTo(x + W2, top - 2, x + W2, top + 26); p.lineTo(x + W2, 1010); p.closePath();
  const g = ctx.createLinearGradient(x - W2, 0, x + W2, 0);
  g.addColorStop(0, '#ead3a6'); g.addColorStop(0.6, OAK); g.addColorStop(1, '#cfae7a');
  ctx.fillStyle = g; ctx.fill(p);
  ctx.strokeStyle = rgba('#94733f', 0.85); ctx.lineWidth = 1.8; ctx.stroke(p);
  circle(ctx, x - W2 + 12, top - 16, 9); ctx.fillStyle = '#e6cc9c'; ctx.fill(); ctx.stroke();
  const panel = lancet(x - 20, top + 22, 40, 130);
  ctx.fillStyle = rgba('#b18c56', 0.3); ctx.fill(panel);
  ctx.strokeStyle = rgba('#94733f', 0.6); ctx.lineWidth = 1.3; ctx.stroke(panel);
  ctx.strokeStyle = rgba('#fff6e2', 0.6); ctx.beginPath(); ctx.moveTo(x - W2 + 4, top + 6); ctx.lineTo(x - W2 + 4, 1000); ctx.stroke();
}
function drawPews(ctx, cam, gc) {
  for (const g0 of PEW_GROUPS) {
    const gx = g0 + (gc - cam) * P_FG;
    if (gx < X_MIN - 600 || gx > X_MAX + 200) continue;
    // 椅背顶的扶手和座板边沿（在椅端后面连成一排）
    ctx.fillStyle = '#d9bc8a'; ctx.fillRect(gx - 30, 900, 360, 12);
    ctx.fillStyle = '#cfb07c'; ctx.fillRect(gx - 30, 948, 360, 14);
    ctx.fillStyle = rgba('#94733f', 0.55); ctx.fillRect(gx - 30, 912, 360, 2); ctx.fillRect(gx - 30, 962, 360, 2);
    for (let k = 0; k < 3; k++) pewEnd(ctx, gx + k * 150);
  }
}

// ---------- 梗：阳光从玫瑰窗直射下来 ----------
function sunBeam(ctx, b, env, a) {
  // 定格时镜头停住：玫瑰窗中心（画面）→ 他的胸口
  const gc = gagCam(env);
  const rx = giantX(gc) - env.cam * P_FAR + (GIANT.rose[0] - GIANT.w / 2), ry = 64 + GIANT.rose[1];
  // 光线穿过他的胸口，一直落到地上
  const cx = CHAR_X + FIG_DX, cy = TORSO_Y - 60;
  const ty = ROAD_Y + 30, tx = rx + ((cx - rx) * (ty - ry)) / (cy - ry);
  const dx = tx - rx, dy = ty - ry, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const w0 = 80, w1 = 300;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // 几层由宽到窄的光带叠起来：边缘软、中间亮；穿过他以后渐渐淡下去
  const tc = (cy - ry) / dy;
  const layer = (k, a0, a1, col) => {
    const g = ctx.createLinearGradient(rx, ry, tx, ty);
    g.addColorStop(0, rgba(col, a0 * a)); g.addColorStop(tc, rgba(col, a1 * a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    const h0 = (w0 * k) / 2, h1 = (w1 * k) / 2;
    poly(ctx, [[rx + nx * h0, ry + ny * h0], [tx + nx * h1, ty + ny * h1], [tx - nx * h1, ty - ny * h1], [rx - nx * h0, ry - ny * h0]]); ctx.fill();
  };
  layer(1.25, 0.1, 0.07, SUN); layer(1, 0.14, 0.1, SUN); layer(0.72, 0.16, 0.1, '#fff0c0'); layer(0.45, 0.18, 0.1, '#ffffff'); layer(0.22, 0.2, 0.08, '#ffffff');
  // 他脚下一圈暖光
  const px = cx - 20, py = ROAD_Y + 14;
  const pg = ctx.createRadialGradient(px, py, 4, px, py, 200);
  pg.addColorStop(0, rgba('#fff2c8', 0.4 * a)); pg.addColorStop(1, rgba('#fff2c8', 0));
  ctx.fillStyle = pg; ctx.save(); ctx.translate(0, py); ctx.scale(1, 0.25); ctx.translate(0, -py); circle(ctx, px, py, 200); ctx.fill(); ctx.restore();
  ctx.restore();
  // 浮尘：闪亮的小点和十字星（暖金色 + 白芯）
  for (let i = 0; i < 54; i++) {
    const t = (hash2(i, 5, 71) + (b - T_SUN) * 0.05 * (0.4 + hash2(i, 6, 71))) % 1;
    const u = (hash2(i, 7, 71) - 0.5) * lerp(w0, w1, t) * 0.9;
    const x = rx + dx * t + nx * u + Math.sin(b * 1.3 + i) * 4, y = ry + dy * t + ny * u;
    const tw = Math.max(0, Math.sin(b * 5.2 + i * 2.3));
    const al = a * (0.3 + 0.7 * tw);
    mote(ctx, x, y, 1.1 + hash2(i, 8, 71) * 1.3, al);
    if (tw > 0.75 && hash2(i, 9, 71) > 0.5) {
      const r = 5 + 7 * tw;
      ctx.strokeStyle = rgba('#d99a2b', 0.7 * al); ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.95 * al); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    }
  }
}
/** 浮尘在他头顶聚成一圈，又散开（第 11.4–12.6 拍）。 */
function dustRing(ctx, b, fig) {
  const k = smoothstep(T_SUN + 0.35, T_SUN + 0.95, b) * (1 - smoothstep(T_BACK - 0.6, T_BACK - 0.1, b));
  if (k <= 0) return;
  const hx = fig.x + ANCHORS.stand.headTop[0] - 4, hy = fig.y + ANCHORS.stand.headTop[1] - 26;
  ctx.save();
  const N = 22;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + b * 0.6;
    const sx = hx + (hash2(i, 1, 81) - 0.5) * 260, sy = hy + 90 + (hash2(i, 2, 81) - 0.3) * 220; // 散开时的位置（在光柱里）
    const x = lerp(sx, hx + Math.cos(a) * 46, ease.inOut(k)), y = lerp(sy, hy + Math.sin(a) * 9, ease.inOut(k));
    const tw = 0.6 + 0.4 * Math.sin(b * 6 + i * 1.9);
    mote(ctx, x, y, 2 + (i % 3) * 0.5, tw * Math.min(1, k * 1.5));
  }
  ctx.restore();
}

// ---------- 标题卡、磁带、画框里用的小花窗 ----------
function quatrefoil(ctx, cx, cy, r, cols, lw = 1.4) {
  // 四叶小窗：四个彩色花瓣 + 中心小圆，细铅条
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    const p = new Path2D(); p.arc(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48, r * 0.46, 0, TAU);
    ctx.fillStyle = cols[i % cols.length]; ctx.fill(p);
    ctx.strokeStyle = LEAD; ctx.lineWidth = lw; ctx.stroke(p);
  }
  const c = new Path2D(); c.arc(cx, cy, r * 0.3, 0, TAU);
  ctx.fillStyle = AMBER; ctx.fill(c); ctx.strokeStyle = LEAD; ctx.lineWidth = lw; ctx.stroke(c);
}
function stoneCard(ctx, x, y, w, h, { corners = true, r = 10 } = {}) {
  ctx.save();
  ctx.shadowColor = 'rgba(70,55,30,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  roundRect(ctx, x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w * 0.3, y + h);
  g.addColorStop(0, '#f7f3ea'); g.addColorStop(1, '#ebe3d3');
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#a2967f'; ctx.lineWidth = 2; ctx.stroke();
  roundRect(ctx, x + 7, y + 7, w - 14, h - 14, Math.max(2, r - 5));
  ctx.strokeStyle = rgba(LEAD, 0.55); ctx.lineWidth = 1.5; ctx.stroke();
  if (corners) {
    const cr = 13;
    quatrefoil(ctx, x + 22, y + 22, cr, [BLUE, RUBY]);
    quatrefoil(ctx, x + w - 22, y + 22, cr, [GREEN, AMBER]);
    quatrefoil(ctx, x + 22, y + h - 22, cr, [PURPLE, SKY]);
    quatrefoil(ctx, x + w - 22, y + h - 22, cr, [RUBY, BLUE]);
    // 角花之间细细的铅条花边
    ctx.strokeStyle = rgba(LEAD, 0.45); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x + 40, y + 22); ctx.lineTo(x + w - 40, y + 22); ctx.moveTo(x + 40, y + h - 22); ctx.lineTo(x + w - 40, y + h - 22); ctx.stroke();
  }
  ctx.restore();
}
function glassCassette(ctx, cx, cy, s, spin) {
  const w = 200 * s, h = 128 * s;
  ctx.save();
  ctx.translate(cx, cy);
  roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  g.addColorStop(0, '#f6f1e6'); g.addColorStop(1, '#e4dccb');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 2.5 * s; ctx.strokeStyle = LEAD; ctx.stroke();
  // 标签纸（无字）：上沿一排小彩色玻璃
  roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 10 * s, w - 28 * s, 70 * s, 5 * s);
  ctx.fillStyle = '#fbf8f0'; ctx.fill(); ctx.lineWidth = 1.6 * s; ctx.stroke();
  const cols = [BLUE, RUBY, AMBER, GREEN, PURPLE, SKY];
  const n = 12, sw = (w - 40 * s) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = cols[i % cols.length];
    ctx.fillRect(-w / 2 + 20 * s + i * sw, -h / 2 + 16 * s, sw, 9 * s);
  }
  ctx.strokeStyle = LEAD; ctx.lineWidth = 1.1 * s;
  ctx.strokeRect(-w / 2 + 20 * s, -h / 2 + 16 * s, n * sw, 9 * s);
  for (let i = 1; i < n; i++) { ctx.beginPath(); ctx.moveTo(-w / 2 + 20 * s + i * sw, -h / 2 + 16 * s); ctx.lineTo(-w / 2 + 20 * s + i * sw, -h / 2 + 25 * s); ctx.stroke(); }
  // 窗口：一小块彩色玻璃（铅条分块），磁带卷从玻璃后面透出来
  const wx = -56 * s, wy = -h / 2 + 32 * s, ww = 112 * s, wh = 40 * s;
  ctx.save();
  roundRect(ctx, wx, wy, ww, wh, 18 * s); ctx.clip();
  const pcs = [[0, 0, 0.3, 0.5, SKY], [0.3, 0, 0.4, 0.5, AMBER], [0.7, 0, 0.3, 0.5, ROSE], [0, 0.5, 0.22, 0.5, GREEN], [0.22, 0.5, 0.56, 0.5, PALE3], [0.78, 0.5, 0.22, 0.5, PURPLE]];
  for (const [u, v, du, dv, c] of pcs) { ctx.fillStyle = c; ctx.fillRect(wx + u * ww, wy + v * wh, du * ww, dv * wh); }
  ctx.strokeStyle = LEAD; ctx.lineWidth = 1.3 * s;
  for (const [u, v, du, dv] of pcs) ctx.strokeRect(wx + u * ww, wy + v * wh, du * ww, dv * wh);
  ctx.restore();
  roundRect(ctx, wx, wy, ww, wh, 18 * s); ctx.lineWidth = 2 * s; ctx.strokeStyle = LEAD; ctx.stroke();
  // 磁带卷 + 转轮
  for (const sx of [-1, 1]) {
    const rx = sx * 34 * s, ry = wy + wh / 2;
    circle(ctx, rx, ry, (sx < 0 ? 17 : 12) * s); ctx.fillStyle = rgba('#5a4636', 0.75); ctx.fill();
    circle(ctx, rx, ry, 9.5 * s); ctx.fillStyle = '#f6f1e6'; ctx.fill(); ctx.lineWidth = 1.6 * s; ctx.strokeStyle = LEAD; ctx.stroke();
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
    ctx.fillStyle = LEAD;
    for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(-1.3 * s, -8.5 * s, 2.6 * s, 4.5 * s); }
    ctx.restore();
  }
  // 底部梯形 + 小孔
  ctx.beginPath();
  ctx.moveTo(-60 * s, h / 2); ctx.lineTo(-48 * s, h / 2 - 30 * s); ctx.lineTo(48 * s, h / 2 - 30 * s); ctx.lineTo(60 * s, h / 2);
  ctx.lineWidth = 2 * s; ctx.strokeStyle = LEAD; ctx.stroke();
  for (const sx of [-1, 1]) { circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s); ctx.fillStyle = LEAD; ctx.fill(); }
  ctx.restore();
}

// ---------- 场景 ----------
export const s04 = {
  id: 's04',
  station: ST,
  figureStyle: 's04-comic',
  freezeBeat: T_SUN + 0.8,
  figureAdjust(b) {
    if (glassOn(b)) return { style: 's04-glass' };
    return null;
  },
  drawBack(ctx, b, env) {
    const cam = env.cam, gc = gagCam(env);
    drawStrip(ctx, farLayer(gc), cam);
    drawStrip(ctx, backFloorLayer(), cam);
    drawStrip(ctx, floorLayer(), cam);
    // 地面上的彩色光斑
    const beams = beamsFor(env);
    // 定格时巨大花窗的投影慢慢流转（光斑缓缓往左挪一点、明暗起伏）
    const drift = b > GAG ? -10 * Math.min(4, b - GAG) : 0;
    for (const bm of beams) drawFloorPatch(ctx, bm, cam, bm.giant ? giantGain(b) * (1 + 0.12 * Math.sin((b - GAG) * 1.6) * (glassOn(b) ? 1 : 0)) : 1, bm.giant ? drift : 0);
    drawStrip(ctx, pierLayer(gc), cam);
    // 空中的光柱 + 浮尘（巨大花窗的光柱在定格前后最亮）；第 11 拍那束阳光打下时，别的光柱让一让
    const calm = 1 - 0.6 * sunAmt(b);
    for (const bm of beams) {
      const a = (bm.giant ? 0.45 + 0.35 * smoothstep(GAG - 1.2, GAG, b) * (1 - smoothstep(T_BACK, T_BACK + 1.4, b)) : bm.a) * calm;
      drawShaft(ctx, bm, cam, a);
      drawMotes(ctx, bm, cam, b, a, bm.giant ? 22 : 10, bm.hit * 10);
    }
    // 定格：巨大花窗本身亮一下
    const flash = smoothstep(GAG - 0.05, GAG + 0.05, b) * (1 - smoothstep(GAG + 0.1, GAG + 0.9, b)) + sunAmt(b) * 0.5;
    if (flash > 0.01) {
      const x = giantX(gc) - cam * P_FAR - GIANT.w / 2;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.28 * flash;
      ctx.fillStyle = SUN; ctx.fill(lancet(x, 64, GIANT.w, GIANT.h));
      ctx.restore();
    }
  },
  drawFigure(ctx, fig, b, env) {
    drawWalker(ctx, fig);
    const cam = env.cam;
    const glass = glassOn(b);
    if (!glass) {
      // 走进光柱时，彩色光落在他身上
      const beams = beamsFor(env).filter((bm) => Math.abs(beamAt(bm, cam) + SL * (bm.fy - TORSO_Y) - fig.x) < bm.w / 2 + 160);
      if (beams.length) {
        figureLight(ctx, fig, env, (oc) => {
          for (const bm of beams) {
            const img = lightPattern(bm.k);
            const g = bm.giant ? giantGain(b) : 1;
            oc.save(); oc.globalAlpha = Math.min(1, g); bandTransform(oc, img, beamAt(bm, cam), bm.fy, bm.w, 140, bm.fy); oc.drawImage(img, 0, 0); oc.restore();
          }
        }, 0.5, 0.55);
      }
    }
    // 变成玻璃 / 变回来的一下闪光，和第 11 拍阳光把玻璃照透
    const flip = (1 - smoothstep(T_GLASS, T_GLASS + 0.2, b)) * (b >= T_GLASS ? 0.25 : 0) + (1 - smoothstep(T_BACK, T_BACK + 0.2, b)) * (b >= T_BACK ? 0.2 : 0);
    const sun = glass ? sunAmt(b) : 0;
    if (flip > 0.01) figureLight(ctx, fig, env, (oc) => { oc.fillStyle = '#fff6dc'; oc.fillRect(fig.x - 400, fig.y - 700, 800, 800); }, 0, flip);
    // 阳光把玻璃照透：把玻璃人自己再相加一遍（颜色变亮但不发白）
    if (sun > 0.01) figureLight(ctx, fig, env, (oc) => { oc.save(); oc.translate(fig.x, fig.y); drawWalker(oc, { ...fig, rim: null }); oc.restore(); }, 0, 0.55 * sun);
  },
  drawFront(ctx, b, env) {
    const cam = env.cam, gc = gagCam(env);
    const a = sunAmt(b);
    if (a > 0.01) {
      // 阳光打下来时四周稍微压暗一点（像聚光），光束才显得出来
      const fx = CHAR_X + FIG_DX + 80, fy = 520;
      const g = ctx.createRadialGradient(fx, fy, 160, fx, fy, 1300);
      g.addColorStop(0, rgba('#d8ccb6', 0)); g.addColorStop(0.35, rgba('#cdbfa6', 0.45 * a)); g.addColorStop(1, rgba('#b9aa90', 0.7 * a));
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = g; ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 1000); ctx.restore();
      sunBeam(ctx, b, env, a);
    }
    if (glassOn(b)) dustRing(ctx, b, env.figure());
    drawPews(ctx, cam, gc);
  },
  drawFrame(ctx, R) {
    // 浅石雕尖拱门框：石框 + 上角拱肩（尖拱开口）+ 山花里的小玫瑰窗 + 两侧小尖塔
    const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
    ctx.save();
    ctx.fillStyle = 'rgba(90,70,40,0.16)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
    // 山花：陡的尖顶三角，两条斜边上一排卷叶（小圆凸），顶上一个十字花形的尖顶饰；里面一扇玫瑰窗
    const gh = w * 0.42;
    const ax = x + w / 2, ay = y - t - gh;
    const gable = new Path2D(); gable.moveTo(x - t * 0.6, y - t + 2); gable.lineTo(ax, ay); gable.lineTo(x + w + t * 0.6, y - t + 2); gable.closePath();
    ctx.fillStyle = STONE_M; ctx.fill(gable);
    ctx.strokeStyle = '#a2967f'; ctx.lineWidth = Math.max(1, 2.5 * s); ctx.stroke(gable);
    ctx.save(); ctx.clip(gable);
    ctx.strokeStyle = rgba('#b5a88f', 0.9); ctx.lineWidth = Math.max(1, 1.6 * s);
    const g2 = new Path2D(); g2.moveTo(x + t * 0.3, y - t); g2.lineTo(ax, ay + gh * 0.16); g2.lineTo(x + w - t * 0.3, y - t); ctx.stroke(g2);
    ctx.restore();
    ctx.fillStyle = STONE_L; ctx.strokeStyle = '#a2967f'; ctx.lineWidth = Math.max(0.8, 1.4 * s);
    for (const dir of [-1, 1]) {
      const bx0 = dir < 0 ? x - t * 0.6 : x + w + t * 0.6, by0 = y - t;
      for (let k = 1; k < 9; k++) {
        const f = k / 9, cxk = bx0 + (ax - bx0) * f, cyk = by0 + (ay - by0) * f;
        circle(ctx, cxk - dir * t * 0.05, cyk - t * 0.16, t * 0.15); ctx.fill(); ctx.stroke();
      }
    }
    for (const [fx2, fy2] of [[0, -0.35], [-0.22, -0.18], [0.22, -0.18], [0, 0]]) { circle(ctx, ax + fx2 * t, ay + fy2 * t - t * 0.2, t * 0.17); ctx.fill(); ctx.stroke(); }
    const rr = Math.min(gh * 0.18, 110 * s);
    ctx.save(); ctx.translate(ax, y - t - gh * 0.36); ctx.scale(rr / 80, rr / 80);
    ctx.beginPath(); ctx.arc(0, 0, 92, 0, TAU); ctx.fillStyle = STONE_L; ctx.fill();
    roseWindow(ctx, 0, 0, 80); ctx.restore();
    // 石框四边（右、下边背光略暗）
    const sides = [
      { pts: [[x - t, y - t], [x + w + t, y - t], [x + w, y], [x, y]], c: STONE_L },
      { pts: [[x + w + t, y - t], [x + w + t, y + h + t], [x + w, y + h], [x + w, y]], c: STONE_M },
      { pts: [[x + w + t, y + h + t], [x - t, y + h + t], [x, y + h], [x + w, y + h]], c: STONE_D },
      { pts: [[x - t, y + h + t], [x - t, y - t], [x, y], [x, y + h]], c: STONE },
    ];
    for (const sd of sides) { poly(ctx, sd.pts); ctx.fillStyle = sd.c; ctx.fill(); }
    ctx.strokeStyle = rgba('#a2967f', 0.9); ctx.lineWidth = Math.max(1, 1.6 * s);
    ctx.strokeRect(x - t * 0.66, y - t * 0.66, w + t * 1.32, h + t * 1.32);
    ctx.strokeRect(x - t * 0.33, y - t * 0.33, w + t * 0.66, h + t * 0.66);
    ctx.strokeStyle = '#8f8370'; ctx.lineWidth = Math.max(1, 2 * s); ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
    // 框沿一圈细细的彩色玻璃
    const gb = t * 0.12;
    const cols = [BLUE, RUBY, AMBER, GREEN];
    const seg = Math.max(8, 40 * s);
    ctx.lineWidth = gb;
    for (let i = 0, px = x - t * 0.5; px < x + w + t * 0.5; px += seg, i++) {
      ctx.strokeStyle = cols[i % 4]; ctx.beginPath(); ctx.moveTo(px, y - t * 0.5); ctx.lineTo(Math.min(px + seg, x + w + t * 0.5), y - t * 0.5); ctx.stroke();
    }
    for (let i = 0, py = y - t * 0.5; py < y + h + t * 0.5; py += seg, i++) {
      for (const sx of [x - t * 0.5, x + w + t * 0.5]) { ctx.strokeStyle = cols[(i + (sx > x ? 2 : 0)) % 4]; ctx.beginPath(); ctx.moveTo(sx, py); ctx.lineTo(sx, Math.min(py + seg, y + h + t * 0.5)); ctx.stroke(); }
    }
    ctx.strokeStyle = LEAD; ctx.lineWidth = Math.max(0.6, 1.2 * s);
    ctx.strokeRect(x - t * 0.5 - gb / 2, y - t * 0.5 - gb / 2, w + t + gb, h + t + gb);
    ctx.strokeRect(x - t * 0.5 + gb / 2, y - t * 0.5 + gb / 2, w + t - gb, h + t - gb);
    // 上角拱肩：把开口做成尖拱（画框快铺满画面时收起来）
    const k = clamp((0.99 - s) / 0.09);
    if (k > 0) {
      const rise = h * 0.42 * k;
      for (const dir of [-1, 1]) {
        const ex = dir < 0 ? x : x + w;
        const p = new Path2D();
        p.moveTo(ex, y); p.lineTo(ex, y + rise);
        p.bezierCurveTo(ex, y + rise * 0.35, x + w / 2 - dir * w * 0.12, y + rise * 0.12, x + w / 2, y);
        p.closePath();
        ctx.fillStyle = dir < 0 ? STONE : STONE_M; ctx.fill(p);
        ctx.strokeStyle = '#a2967f'; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke(p);
        const q = Math.min(rise * 0.32, 46 * s);
        if (q > 3) quatrefoil(ctx, ex - dir * w * 0.1, y + rise * 0.3, q, dir < 0 ? [BLUE, RUBY] : [GREEN, AMBER], Math.max(0.6, 1.2 * s));
      }
    }
    // 两侧小尖塔
    for (const px of [x - t / 2, x + w + t / 2]) {
      const ph = t * 2.2;
      poly(ctx, [[px - t * 0.32, y - t], [px, y - t - ph], [px + t * 0.32, y - t]]);
      ctx.fillStyle = STONE_L; ctx.fill(); ctx.strokeStyle = '#a2967f'; ctx.lineWidth = Math.max(1, 1.5 * s); ctx.stroke();
      ctx.fillStyle = STONE_D;
      for (let k2 = 1; k2 < 4; k2++) { circle(ctx, px + (k2 % 2 ? -1 : 1) * t * 0.22 * (1 - k2 / 4), y - t - ph * k2 / 4, t * 0.06); ctx.fill(); }
    }
    ctx.restore();
  },
  cardStyle: {
    ink: INK, accent: BLUE_D, bar: false,
    bgDraw(ctx, x, y, w, h) { stoneCard(ctx, x, y, w, h); },
  },
  playerStyle: {
    plate: STONE, ink: INK, noteColor: RUBY, backdrop: true,
    palette: { body: '#f2ede3', label: '#fbf8f0', window: SKY, accent: BLUE, tape: '#6b5a4a', ink: LEAD },
    plateDraw(ctx, x, y, w, h) {
      stoneCard(ctx, x, y, w, h, { corners: false, r: 8 });
      // 底边一条细细的彩色玻璃
      const cols = [BLUE, RUBY, AMBER, GREEN, PURPLE];
      const n = Math.max(4, Math.round((w - 28) / 22)), sw = (w - 28) / n;
      ctx.save();
      for (let i = 0; i < n; i++) { ctx.fillStyle = cols[i % cols.length]; ctx.fillRect(x + 14 + i * sw, y + h - 15, sw, 5); }
      ctx.strokeStyle = LEAD; ctx.lineWidth = 1; ctx.strokeRect(x + 14, y + h - 15, w - 28, 5);
      ctx.restore();
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) { glassCassette(ctx, cx, cy, s, spin); },
  },
};
