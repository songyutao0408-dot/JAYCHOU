// 第 15 站 · 最伟大的作品（Greatest Works of Art, 2022）·「还在流浪」· 公路旅行 · 复古明信片
// 20 世纪中叶旅行明信片的一般风格：胶印插画，饱和但略褪色的天蓝、橙、薄荷绿、奶油黄；
// 规则网点（15° 网角，点的大小随明暗变）；色版相对深蓝灰细线版向右下错开一点（套色不准）；
// 四周一圈白色明信片边，角上磨损泛黄、一道折痕；全画面一层淡淡的纸色和颗粒。
// 构图：天空网点 → 积云 → 远山 → 橙色台地 → 原野（风车、水塔、空白广告牌）→ 电线杆
//       → 路边（邮筒 + 明信片架、流线型加油站、棕榈、汽车旅馆 + 灯泡箭头立牌、路牌、仙人掌、栅栏）→ 路肩 + 柏油路。
//       招牌、路牌、车牌、邮票都不写字。
// 次要动作：第 4.6–7.8 拍一辆原创复古敞篷小车从他身后超过他（司机挥手），没停。
// 梗：第 8 拍末一只巨大的橡皮图章从上方压下；第 9 拍强拍「啪」盖在定格的他身上（画面一震、纸面一凹）；
//     第 10 拍图章抬起，邮戳（双圈 +「2022」+ 波浪注销线）留在他身上；第 10.5 拍一张无字邮票贴到右上角；
//     第 11、12 拍缩小的图章再「啪啪」两下（邮票上、天空里各一枚小邮戳）；第 13–16 拍邮戳跟着他走。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip, stripRange } from '../kit/strip.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2, fbm } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, keyframes, TAU } from '../kit/math.js';
import { font, SANS } from '../kit/text.js';
import { GAG, stationSection } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker } from '../rig/walker.js';
import { registerStyle, comicBase, luma, rgbf } from '../rig/styles.js';

const ST = stationByN(15);

// ---------- 调色板 ----------
const PAPER = '#fbf5e6', CREAM = '#f6e3a1', CREAM_L = '#fbeec6';
const SKY = '#8ccbe2', SKY_L = '#cfe9ee', SKY_D = '#3c9cc6';
const ORANGE = '#eba36d', ORANGE_D = '#cf7656', RUST = '#a9524a', SUN = '#f2b552';
const MINT = '#9fd8bf', MINT_D = '#5fae94', MINT_DD = '#3f8c78';
const CORAL = '#e2654c', CORAL_D = '#b8483a', YEL = '#f5cf5a';
const NAVY = '#2c4a6c', INK = '#2f4152', LAV = '#b9c4e4', LAV_D = '#8e9fd0';
const SAND = '#efd6a0', SAND_D = '#d9b77a', ASPH = '#a3b1b8', ASPH_D = '#7f919c';
const WOOD = '#b98150', WOOD_L = '#dcae78', WOOD_D = '#8a5a36', CHROME = '#dfe6ea';
const POST_INK = '#d0322a'; // 邮戳：复古红

const P_SKY = 0.02, P_CLOUD = 0.05, P_FAR = 0.07, P_MESA = 0.14, P_PLAIN = 0.3, P_POLE = 0.6;
const REG = [2.2, 1.5]; // 套色错位（色版相对线版）
const LW = 2.2;         // 线版线宽（单位）
const BORDER = 22;      // 明信片白边（单位）

// ---------- 时间点（段内拍位） ----------
const T_CAR = [GAG - 3.4, GAG - 0.2];  // 第 5.6–8.8 拍：小车从身后超过他
const T_SHADOW = GAG - 0.8;            // 第 8.2 拍：图章的影子落到他身上
const T_DROP = GAG - 0.5;              // 第 8.5 拍起图章加速压下
const T_HIT = GAG;                     // 第 9 拍（第 3 小节强拍）：「啪」
const T_LIFT = [GAG + 1, GAG + 1.4];   // 第 10 拍：抬起
const T_STAMP = GAG + 1.5;             // 第 10.5 拍：邮票贴到右上角
const T_HIT2 = GAG + 2, T_HIT3 = GAG + 3; // 第 11、12 拍：两枚小邮戳
const T_OFF = GAG + 3.6;               // 小图章飞走

// ---------- 邮戳几何（单位） ----------
const PM_R = 84, PM_WAVE = 236, PM_ROT = -0.17;
const PM_OFF = { stand: [14, -335], walk: [-14, -332] }; // 相对脚下：胸口
const SMALL = 0.62;                                        // 小邮戳 / 小图章的缩放
const SPOT_A = { x: 1176, y: 150, rot: 0.1 };              // 邮票上
const SPOT_B = { x: 842, y: 262, rot: -0.08 };             // 天空里
const STAMP_POS = { x: 1268, y: 140, rot: 0.07 };          // 邮票

// ---------- 基础：形状 ----------
const pathOf = (fn) => { const p = new Path2D(); fn(p); return p; };
const rectP = (x, y, w, h) => pathOf((p) => p.rect(x, y, w, h));
const ellP = (x, y, rx, ry, rot = 0) => pathOf((p) => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));
const circP = (x, y, r) => ellP(x, y, r, r);
const polyP = (pts, close = true) => pathOf((p) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); });
function rrPath(p, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  p.moveTo(x + rr, y); p.arcTo(x + w, y, x + w, y + h, rr); p.arcTo(x + w, y + h, x, y + h, rr);
  p.arcTo(x, y + h, x, y, rr); p.arcTo(x, y, x + w, y, rr); p.closePath();
}
const rrP = (x, y, w, h, r) => pathOf((p) => rrPath(p, x, y, w, h, r));
function starPath(p, cx, cy, r, n = 5, inner = 0.45, rot = 0) {
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + rot + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
    i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath();
}
const starP = (cx, cy, r, rot = 0) => pathOf((p) => starPath(p, cx, cy, r, 5, 0.45, rot));

/**
 * 胶印网点：在 path 里按 15° 网角铺圆点，点的半径随 tone(x, y)（0..1）变。
 * bounds = [x, y, w, h] 限定计算范围（一次 fill，烘焙阶段用）。
 */
function halftone(ctx, path, color, tone, bounds, { step = 6, angle = 0.26, rmax = 0.64 } = {}) {
  const [bx, by, bw, bh] = bounds;
  const c = Math.cos(angle), s = Math.sin(angle);
  // 旋转网格坐标 (u, v)：x = u·c − v·s，y = u·s + v·c
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
    const t = tone(x, y);
    if (t <= 0.015) continue;
    const r = Math.sqrt(Math.min(1, t)) * step * rmax;
    ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
}

/** 明信片式的形状：色版错开一点（可带网点阴影），再描深蓝灰细线。 */
function pc(ctx, path, fill, { line = LW, reg = 1, ink = INK, dots = null, alpha = 0.85 } = {}) {
  if (fill) {
    ctx.save();
    if (reg) ctx.translate(REG[0] * reg, REG[1] * reg);
    ctx.fillStyle = fill; ctx.fill(path);
    if (dots) halftone(ctx, path, dots.color, dots.tone || (() => dots.t ?? 0.35), dots.bounds, dots.opts || {});
    ctx.restore();
  }
  if (line) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.lineWidth = line; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path);
    ctx.restore();
  }
}
const dotsIn = (color, t, bounds, opts) => ({ color, t, bounds, opts });

/** 纸面颗粒（烘焙阶段叠在印好的颜色上，source-atop，空白处不脏）。 */
function grainTile() {
  return memo('s15-grain', () => {
    const S = 256, c = makeCanvas(S, S), x = c.getContext('2d'), im = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const h = hash2(i, j, 15), k = (j * S + i) * 4;
      if (h < 0.03) { im.data[k] = 255; im.data[k + 1] = 250; im.data[k + 2] = 236; im.data[k + 3] = 120; }
      else if (h > 0.975) { im.data[k] = 60; im.data[k + 1] = 70; im.data[k + 2] = 84; im.data[k + 3] = 46; }
    }
    x.putImageData(im, 0, 0);
    return c;
  });
}
function grainOver(ctx, x0, y0, w, h, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}

// ---------- 天空 ----------
function skyLayer() {
  return strip('s15-sky', P_SKY, (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(0, 0, 0, 810);
    g.addColorStop(0, '#95cfe4'); g.addColorStop(0.5, SKY_L); g.addColorStop(0.85, '#f1efdc'); g.addColorStop(1, CREAM_L);
    ctx.fillStyle = g; ctx.fillRect(x0, 0, x1 - x0, 810);
    halftone(ctx, rectP(x0, 0, x1 - x0, 560), SKY_D, (x, y) => 0.4 * Math.pow(Math.max(0, 1 - y / 540), 1.3), [x0, 0, x1 - x0, 560], { step: 6.5 });
  }, { y0: 0, y1: 810 });
}

// ---------- 积云 ----------
function cloudPath(cx, cy, w, R) {
  const p = new Path2D();
  const n = 5 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = cx - w / 2 + t * w;
    const r = (0.22 + 0.2 * Math.sin(Math.PI * t) + R() * 0.08) * w * 0.5;
    p.ellipse(x, cy - r * 0.5, r, r * 0.9, 0, 0, TAU);
  }
  for (let i = 0; i < 2; i++) { const r = w * (0.17 + R() * 0.06); p.ellipse(cx + (R() - 0.5) * w * 0.4, cy - w * 0.22 - r * 0.3, r, r * 0.85, 0, 0, TAU); }
  p.rect(cx - w / 2, cy - 4, w, 8);
  p.ellipse(cx, cy, w / 2, 10, 0, 0, TAU);
  return p;
}
function cloudLayer() {
  return strip('s15-cloud', P_CLOUD, (ctx, x0, x1) => {
    const R = rng('s15-cloud');
    for (let x = x0 + 60; x < x1; x += 420 + R() * 260) {
      const w = 240 + R() * 200, cy = 170 + R() * 190;
      const p = cloudPath(x, cy, w, R);
      ctx.save(); ctx.translate(REG[0], REG[1]);
      ctx.fillStyle = '#fffaf0'; ctx.fill(p);
      const top = cy - w * 0.5;
      halftone(ctx, p, '#f0c7a0', (xx, yy) => 0.75 * smoothstep(cy - w * 0.2, cy + 8, yy), [x - w / 2 - 60, top - 20, w + 120, w * 0.6], { step: 5 });
      halftone(ctx, p, LAV_D, (xx, yy) => 0.5 * smoothstep(cy - 14, cy + 10, yy), [x - w / 2 - 60, cy - 30, w + 120, 50], { step: 5, angle: 0.8 });
      ctx.restore();
    }
  }, { y0: 0, y1: 520 });
}

// ---------- 远山 ----------
function farLayer() {
  return strip('s15-far', P_FAR, (ctx, x0, x1) => {
    const p = new Path2D();
    p.moveTo(x0, 800);
    for (let x = x0; x <= x1; x += 8) p.lineTo(x, 610 - fbm(x / 260, 0.3, 151, 4) * 170 + 60);
    p.lineTo(x1, 800); p.closePath();
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = LAV; ctx.fill(p);
    halftone(ctx, p, LAV_D, (x, y) => 0.25 + 0.2 * noise2(x / 90, y / 60, 152), [x0, 420, x1 - x0, 380], { step: 5.5, angle: 0.8 });
    ctx.restore();
    grainOver(ctx, x0, 400, x1 - x0, 400, 0.6);
  }, { y0: 400, y1: 800 });
}

// ---------- 台地 ----------
function mesa(ctx, x, w, h, R) {
  const base = 760, top = base - h, tw = w * (0.4 + R() * 0.18);
  const lx = x - tw / 2, rx = x + tw / 2;
  const shoulder = top + h * (0.5 + R() * 0.12);
  // 轮廓：山脚碎石坡 → 陡崖 → 有几处缺口的平顶 → 陡崖 → 碎石坡
  const pts = [[x - w / 2, base + 40], [x - w * 0.34, shoulder + (base - shoulder) * 0.45], [lx - w * 0.06, shoulder], [lx - 3, top + h * 0.14], [lx + 3, top + 3]];
  const nTop = 3 + Math.floor(R() * 3);
  for (let k = 1; k < nTop; k++) {
    const px = lerp(lx + 3, rx - 3, k / nTop);
    if (R() < 0.45) { pts.push([px - 6, top + R() * 3]); pts.push([px - 2, top + 6 + R() * 10]); pts.push([px + 6, top + 6 + R() * 8]); pts.push([px + 10, top + R() * 3]); }
    else pts.push([px, top + R() * 4]);
  }
  pts.push([rx - 3, top + 3], [rx + 3, top + h * 0.12], [rx + w * 0.07, shoulder], [x + w * 0.36, shoulder + (base - shoulder) * 0.45], [x + w / 2, base + 40]);
  const body = polyP(pts);
  pc(ctx, body, '#efb27f', { line: 1.4, alpha: 0.55 });
  // 背光面（右侧）：赭红 + 网点
  const shade = polyP([[x + tw * 0.2, top + 2], [rx + 3, top], [rx + w * 0.08, shoulder], [x + w / 2 + 4, base + 44], [x + tw * 0.02, base + 44], [x + tw * 0.14, shoulder]]);
  ctx.save(); ctx.clip(body);
  pc(ctx, shade, '#d98a68', { line: 0, dots: dotsIn(RUST, 0.26, [x - w / 2, top - 10, w, h + 60], { step: 5 }) });
  // 岩层
  ctx.strokeStyle = rgba('#fbe2b8', 0.7); ctx.lineWidth = 2.2;
  for (let k = 1; k < 4; k++) {
    const yy = top + (shoulder - top) * (k / 4) + R() * 6;
    ctx.beginPath(); ctx.moveTo(lx - 20, yy); ctx.lineTo(x + tw * 0.12, yy + 2); ctx.stroke();
  }
  // 山脚碎石坡：网点
  halftone(ctx, body, RUST, (xx, yy) => 0.26 * smoothstep(shoulder, base, yy), [x - w / 2, shoulder, w, base - shoulder + 40], { step: 5 });
  ctx.restore();
}
function mesaLayer() {
  return strip('s15-mesa', P_MESA, (ctx, x0, x1) => {
    const R = rng('s15-mesa');
    for (let x = x0 + 100; x < x1; x += 380 + R() * 420) {
      const kind = R();
      if (kind < 0.25) mesa(ctx, x, 170 + R() * 60, 170 + R() * 70, R); // 孤峰
      else mesa(ctx, x, 300 + R() * 260, 120 + R() * 110, R);
    }
    // 空气透视：山脚一层淡淡的雾
    ctx.save(); ctx.globalCompositeOperation = 'source-atop';
    const hz = ctx.createLinearGradient(0, 560, 0, 780); hz.addColorStop(0, rgba(SKY_L, 0)); hz.addColorStop(1, rgba('#f3ead6', 0.45));
    ctx.fillStyle = hz; ctx.fillRect(x0, 380, x1 - x0, 440); ctx.restore();
    grainOver(ctx, x0, 380, x1 - x0, 440, 0.7);
  }, { y0: 380, y1: 820 });
}

// ---------- 原野：沙地、灌木、风车、水塔、空白广告牌 ----------
function windmill(ctx, x) {
  const base = 742, top = base - 190;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x - 24, base); ctx.lineTo(x - 5, top); ctx.lineTo(x + 5, top); ctx.lineTo(x + 24, base);
  for (let k = 1; k < 5; k++) { const y = base - (base - top) * k / 5, w = 24 - 19 * k / 5; ctx.moveTo(x - w, y); ctx.lineTo(x + w, y - (base - top) / 5); }
  ctx.stroke();
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU;
    pc(ctx, polyP([[x, top], [x + Math.cos(a - 0.12) * 46, top + Math.sin(a - 0.12) * 46], [x + Math.cos(a + 0.12) * 46, top + Math.sin(a + 0.12) * 46]]), k % 2 ? PAPER : CORAL, { line: 1.2 });
  }
  pc(ctx, polyP([[x + 6, top - 4], [x + 52, top - 14], [x + 52, top + 10], [x + 6, top + 4]]), CORAL, { line: 1.2 });
}
function waterTower(ctx, x) {
  const base = 742;
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
  ctx.beginPath();
  for (const dx of [-30, -10, 10, 30]) { ctx.moveTo(x + dx * 1.2, base); ctx.lineTo(x + dx * 0.8, base - 120); }
  ctx.moveTo(x - 34, base - 40); ctx.lineTo(x + 34, base - 80); ctx.moveTo(x + 34, base - 40); ctx.lineTo(x - 34, base - 80);
  ctx.stroke();
  const tank = pathOf((p) => { p.moveTo(x - 38, base - 120); p.lineTo(x - 38, base - 178); p.quadraticCurveTo(x, base - 214, x + 38, base - 178); p.lineTo(x + 38, base - 120); p.quadraticCurveTo(x, base - 108, x - 38, base - 120); p.closePath(); });
  pc(ctx, tank, CREAM, { line: 1.8, dots: dotsIn(SAND_D, 0.35, [x - 40, base - 220, 80, 110]) });
  ctx.save(); ctx.clip(tank); ctx.fillStyle = CORAL; ctx.fillRect(x - 40, base - 158, 80, 10); ctx.restore();
}
function billboard(ctx, x) {
  const base = 742;
  ctx.fillStyle = INK;
  for (const dx of [-60, 60]) ctx.fillRect(x + dx - 3, base - 80, 6, 80);
  const board = rectP(x - 110, base - 170, 220, 96);
  pc(ctx, board, PAPER, { line: 2 });
  pc(ctx, starP(x - 46, base - 122, 34), SUN, { line: 1.6 });
  pc(ctx, polyP([[x - 2, base - 132], [x + 52, base - 132], [x + 52, base - 146], [x + 90, base - 122], [x + 52, base - 98], [x + 52, base - 112], [x - 2, base - 112]]), CORAL, { line: 1.6 });
}
function shrub(ctx, x, y, r, R) {
  const p = pathOf((q) => { for (let k = 0; k < 4; k++) q.ellipse(x + (k - 1.5) * r * 0.55, y - r * (0.5 + 0.25 * Math.sin(k * 2.1)), r * 0.55, r * 0.5, 0, 0, TAU); });
  pc(ctx, p, MINT, { line: 1.2, alpha: 0.6, dots: dotsIn(MINT_D, 0.4, [x - r * 1.6, y - r * 1.4, r * 3.2, r * 1.6], { step: 4.5 }) });
}
function plainLayer() {
  return strip('s15-plain', P_PLAIN, (ctx, x0, x1) => {
    const R = rng('s15-plain');
    const ground = pathOf((p) => { p.moveTo(x0, 820); for (let x = x0; x <= x1; x += 10) p.lineTo(x, 716 - 14 * Math.sin(x / 230) - 10 * noise2(x / 120, 0, 31)); p.lineTo(x1, 820); p.closePath(); });
    ctx.save(); ctx.translate(REG[0], REG[1]);
    ctx.fillStyle = SAND; ctx.fill(ground);
    halftone(ctx, ground, MINT_D, (x, y) => 0.38 * smoothstep(0.45, 0.75, noise2(x / 160, y / 40, 33)), [x0, 690, x1 - x0, 130], { step: 5 });
    halftone(ctx, ground, SAND_D, (x, y) => 0.25, [x0, 690, x1 - x0, 130], { step: 5, angle: 0.8 });
    ctx.restore();
    for (let x = x0 + 200; x < x1; x += 700 + R() * 600) {
      const k = R();
      if (k < 0.33) windmill(ctx, x); else if (k < 0.62) waterTower(ctx, x); else billboard(ctx, x);
    }
    for (let x = x0; x < x1; x += 60 + R() * 120) shrub(ctx, x, 748 + R() * 40, 12 + R() * 12, R);
    grainOver(ctx, x0, 540, x1 - x0, 280, 0.7);
  }, { y0: 540, y1: 820 });
}

// ---------- 电线杆 ----------
function poleLayer(cF) {
  return strip('s15-pole', P_POLE, (ctx, x0, x1) => {
    // 定格时（镜头 cF）电线杆在画面 x = 62 + 520k，不落在他正后方
    const off = 62 + cF * P_POLE;
    const k0 = Math.floor((x0 - off) / 520) - 1, k1 = Math.ceil((x1 - off) / 520) + 1;
    const xs = []; for (let k = k0; k <= k1; k++) xs.push(off + k * 520);
    const tops = [300, 318, 336];
    ctx.lineWidth = 1.6; ctx.strokeStyle = rgba(INK, 0.8);
    for (let i = 0; i < xs.length - 1; i++) for (const [j, yy] of tops.entries()) {
      const a = xs[i] + (j === 1 ? 0 : (j - 1) * 38), b = xs[i + 1] + (j === 1 ? 0 : (j - 1) * 38);
      ctx.beginPath(); ctx.moveTo(a, yy); ctx.quadraticCurveTo((a + b) / 2, yy + 46, b, yy); ctx.stroke();
    }
    for (const x of xs) {
      pc(ctx, rectP(x - 7, 280, 14, 528), WOOD, { line: 1.6, dots: dotsIn(WOOD_D, 0.4, [x - 8, 280, 16, 530], { step: 4 }) });
      pc(ctx, rectP(x - 50, 296, 100, 9), WOOD_D, { line: 1.4 });
      pc(ctx, rectP(x - 34, 314, 68, 8), WOOD_D, { line: 1.4 });
      for (const dx of [-38, 0, 38]) { ctx.fillStyle = '#e6f0f2'; ctx.beginPath(); ctx.ellipse(x + dx, 296, 4, 6, 0, 0, TAU); ctx.fill(); }
    }
    // 电线上停几只小鸟
    const R = rng('s15-birds');
    for (let i = 0; i < xs.length - 1; i++) if (R() < 0.45) {
      const n = 2 + Math.floor(R() * 3), t0 = 0.25 + R() * 0.3;
      for (let k = 0; k < n; k++) {
        const t = t0 + k * 0.05, a = xs[i] - 38, b = xs[i + 1] - 38;
        const x = lerp(a, b, t), y = 300 + 46 * 2 * t * (1 - t) * 1 - 2;
        ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(x, y - 6, 6, 5, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 5, y - 11, 3.4, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - 5, y - 6); ctx.lineTo(x - 12, y - 1); ctx.lineTo(x - 4, y - 3); ctx.fill();
      }
    }
  }, { y0: 250, y1: 810 });
}

// ---------- 路边道具（单位坐标，地面 y = 800） ----------
function mailbox(ctx, x) {
  pc(ctx, rectP(x - 7, 700, 14, 100), NAVY, { line: 1.6 });
  const box = pathOf((p) => { p.moveTo(x - 38, 712); p.lineTo(x - 38, 640); p.arc(x, 640, 38, Math.PI, 0); p.lineTo(x + 38, 712); p.closePath(); });
  pc(ctx, box, '#3f86b8', { dots: dotsIn(NAVY, 0.3, [x - 40, 600, 80, 114]) });
  pc(ctx, rrP(x - 22, 642, 44, 7, 3), NAVY, { line: 1.2, reg: 0 });
  pc(ctx, starP(x, 684, 11), PAPER, { line: 1.2 });
  pc(ctx, rectP(x - 42, 710, 84, 8), NAVY, { line: 1.4 });
}
function postcardRack(ctx, x) {
  pc(ctx, rectP(x - 4, 560, 8, 240), INK, { line: 0 });
  pc(ctx, ellP(x, 796, 34, 6), INK, { line: 0 });
  const cols = [[SKY, ORANGE], [MINT, CORAL], [CREAM, SKY_D], [ORANGE, MINT_D], [SKY_L, CORAL]];
  for (let row = 0; row < 3; row++) for (let k = -2; k <= 2; k++) {
    const y = 576 + row * 64, cx = x + k * 26, w = 22 * (1 - Math.abs(k) * 0.18), h = 32;
    const [a, b2] = cols[(row * 3 + k + 7) % cols.length];
    pc(ctx, rectP(cx - w / 2, y, w, h), PAPER, { line: 1, reg: 0 });
    pc(ctx, rectP(cx - w / 2 + 3, y + 3, w - 6, h * 0.55), a, { line: 0 });
    ctx.fillStyle = b2; ctx.fillRect(cx - w / 2 + 3, y + 3 + h * 0.55, w - 6, h * 0.3);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (let row = 0; row < 3; row++) { ctx.beginPath(); ctx.moveTo(x - 66, 610 + row * 64); ctx.lineTo(x + 66, 610 + row * 64); ctx.stroke(); }
  pc(ctx, circP(x, 552, 9), CORAL, { line: 1.4 });
}
function gasStation(ctx, x) {
  // x：楼的左沿。流线型小楼 + 雨棚 + 两台油泵 + 圆形星星立牌
  const bx = x, bw = 190, top = 640;
  // 立牌
  pc(ctx, rectP(bx - 66, 360, 12, 440), INK, { line: 0 });
  pc(ctx, circP(bx - 60, 360, 58), PAPER, { line: 2.4 });
  pc(ctx, circP(bx - 60, 360, 46), CORAL, { line: 1.6, dots: dotsIn(CORAL_D, 0.3, [bx - 110, 310, 100, 100]) });
  pc(ctx, starP(bx - 60, 364, 32), YEL, { line: 1.6 });
  // 楼
  const body = pathOf((p) => { p.moveTo(bx, 800); p.lineTo(bx, top + 50); p.arcTo(bx, top, bx + 50, top, 50); p.lineTo(bx + bw, top); p.lineTo(bx + bw, 800); p.closePath(); });
  pc(ctx, body, PAPER, { dots: dotsIn(SAND_D, 0.22, [bx, top, bw, 160]) });
  ctx.save(); ctx.clip(body);
  ctx.fillStyle = MINT; ctx.fillRect(bx - 4, top, bw + 8, 26);
  ctx.fillStyle = CORAL; for (const dy of [34, 42, 50]) ctx.fillRect(bx - 4, top + dy, bw + 8, 3);
  ctx.restore();
  pc(ctx, rectP(bx + 22, 690, 92, 70), SKY_L, { line: 2, dots: dotsIn(SKY_D, 0.25, [bx + 22, 690, 92, 70]) });
  ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(bx + 40, 756); ctx.lineTo(bx + 76, 694); ctx.moveTo(bx + 62, 756); ctx.lineTo(bx + 90, 708); ctx.stroke();
  pc(ctx, rectP(bx + 132, 700, 40, 100), CORAL, { line: 2 });
  pc(ctx, circP(bx + 164, 752, 3), YEL, { line: 0 });
  // 雨棚
  const cx0 = bx + bw, cx1 = bx + bw + 230;
  pc(ctx, rectP(cx1 - 30, 620, 12, 180), PAPER, { line: 1.6 });
  pc(ctx, polyP([[cx0 - 10, 604], [cx1 + 18, 596], [cx1 + 18, 626], [cx0 - 10, 634]]), PAPER, { line: 2 });
  pc(ctx, polyP([[cx0 - 10, 622], [cx1 + 18, 614], [cx1 + 18, 626], [cx0 - 10, 634]]), ORANGE, { line: 1.4 });
  // 油泵
  for (const px of [cx0 + 60, cx0 + 150]) {
    pc(ctx, rectP(px - 4, 790, 48, 10), INK, { line: 0 });
    pc(ctx, rrP(px, 690, 40, 104, 8), CORAL, { dots: dotsIn(CORAL_D, 0.3, [px + 22, 690, 20, 104]) });
    pc(ctx, circP(px + 20, 722, 12), PAPER, { line: 1.4 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(px + 20, 722); ctx.lineTo(px + 27, 716); ctx.stroke();
    pc(ctx, circP(px + 20, 672, 18), PAPER, { line: 1.6 });
    pc(ctx, starP(px + 20, 673, 10), CORAL, { line: 0 });
    ctx.strokeStyle = NAVY; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(px + 40, 740); ctx.quadraticCurveTo(px + 64, 770, px + 52, 712); ctx.stroke();
  }
  // 轮胎堆
  for (let k = 0; k < 3; k++) pc(ctx, ellP(bx - 22, 788 - k * 16, 22, 9), INK, { line: 1.2 });
}
function palm(ctx, x, h = 540, lean = 0.12) {
  const base = 800, tx = x + Math.sin(lean) * h, ty = base - h;
  const trunk = pathOf((p) => {
    p.moveTo(x - 13, base); p.quadraticCurveTo(x - 6 + (tx - x) * 0.3, base - h * 0.55, tx - 6, ty + 8);
    p.lineTo(tx + 6, ty + 8); p.quadraticCurveTo(x + 6 + (tx - x) * 0.3, base - h * 0.55, x + 13, base); p.closePath();
  });
  pc(ctx, trunk, WOOD_L, { dots: dotsIn(WOOD_D, 0.35, [x - 20, ty, tx - x + 40, h], { step: 4 }) });
  ctx.save(); ctx.clip(trunk); ctx.strokeStyle = rgba(WOOD_D, 0.8); ctx.lineWidth = 1.6;
  for (let y = base - 14; y > ty; y -= 16) { ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x + 140, y - 4); ctx.stroke(); }
  ctx.restore();
  const fronds = [-2.9, -2.4, -1.9, -1.35, -0.8, -0.3, 0.2];
  for (const [i, a] of fronds.entries()) {
    const L = 120 + (i % 2) * 26;
    const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L * 0.6 + 34;
    const mx = tx + Math.cos(a) * L * 0.5, my = ty + Math.sin(a) * L * 0.5 - 18;
    const nx = -Math.sin(a) * 18, ny = Math.cos(a) * 18;
    const f = pathOf((p) => { p.moveTo(tx, ty); p.quadraticCurveTo(mx + nx, my + ny, ex, ey); p.quadraticCurveTo(mx - nx, my - ny - 8, tx, ty); p.closePath(); });
    pc(ctx, f, i % 2 ? MINT_D : MINT, { line: 1.6, dots: dotsIn(MINT_DD, 0.28, [tx - 170, ty - 120, 340, 220], { step: 4.5 }) });
  }
  pc(ctx, circP(tx - 6, ty + 10, 8), WOOD_D, { line: 1 }); pc(ctx, circP(tx + 8, ty + 12, 7), WOOD_D, { line: 1 });
}
function motel(ctx, x) {
  // x：办公室左沿。办公室 + 一排客房
  const ox = x, ow = 190, wx = x + ow, ww = 600;
  // 办公室
  pc(ctx, rectP(ox, 610, ow, 190), CREAM_L, { dots: dotsIn(SAND_D, 0.2, [ox, 610, ow, 190]) });
  pc(ctx, polyP([[ox - 20, 600], [ox + ow + 10, 600], [ox + ow + 10, 618], [ox - 20, 618]]), ORANGE, { line: 2 });
  pc(ctx, rectP(ox + 18, 650, 104, 90), SKY_L, { line: 2, dots: dotsIn(SKY_D, 0.25, [ox + 18, 650, 104, 90]) });
  ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(ox + 34, 734); ctx.lineTo(ox + 70, 656); ctx.stroke();
  pc(ctx, rectP(ox + 138, 690, 38, 110), MINT_D, { line: 2 });
  for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? PAPER : CORAL; ctx.fillRect(ox + 10 + k * 26, 624, 26, 16); }
  pc(ctx, polyP([[ox + 6, 640], [ox + 136, 640], [ox + 128, 618], [ox + 14, 618]]), null, { line: 1.6 });
  // 客房
  pc(ctx, rectP(wx, 650, ww, 150), PAPER, { dots: dotsIn(SAND_D, 0.16, [wx, 650, ww, 150]) });
  pc(ctx, rectP(wx - 6, 632, ww + 16, 20), ORANGE, { line: 2, dots: dotsIn(ORANGE_D, 0.3, [wx, 632, ww + 16, 20]) });
  for (let k = 0; k < 5; k++) {
    const ux = wx + 20 + k * 116;
    pc(ctx, rectP(ux, 694, 40, 106), CORAL, { line: 1.8, dots: dotsIn(CORAL_D, 0.25, [ux + 26, 694, 14, 106]) });
    pc(ctx, circP(ux + 32, 748, 3), YEL, { line: 0 });
    pc(ctx, rectP(ux + 56, 690, 46, 46), SKY_L, { line: 1.8 });
    pc(ctx, rectP(ux + 56, 690, 46, 14), MINT, { line: 1.2 }); // 窗帘
    pc(ctx, rectP(ux + 6, 672, 28, 12), CREAM, { line: 1.2 });  // 空白门牌
    pc(ctx, rectP(ux + 102 - 2, 652, 6, 148), PAPER, { line: 1.2 }); // 檐柱
  }
  // 门口一张躺椅
  const cxl = wx + ww - 60;
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cxl - 30, 800); ctx.lineTo(cxl + 4, 768); ctx.moveTo(cxl + 30, 800); ctx.lineTo(cxl - 4, 768); ctx.stroke();
  pc(ctx, polyP([[cxl - 34, 770], [cxl + 26, 770], [cxl + 34, 742], [cxl + 22, 740], [cxl + 16, 762], [cxl - 34, 762]]), MINT, { line: 1.6 });
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
  pc(ctx, p, '#6fb48f', { dots: dotsIn(MINT_DD, 0.32, [x - 80, base - h, 160, h], { step: 4.5 }) });
  ctx.save(); ctx.clip(p); ctx.strokeStyle = rgba('#d8f0e0', 0.7); ctx.lineWidth = 1.4;
  for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(x + dx, base); ctx.lineTo(x + dx, base - h + 6); ctx.stroke(); }
  ctx.restore();
}
function shieldSign(ctx, x) {
  pc(ctx, rectP(x - 4, 640, 8, 160), CHROME, { line: 1.4 });
  const s = pathOf((p) => { p.moveTo(x - 34, 590); p.lineTo(x + 34, 590); p.lineTo(x + 32, 626); p.quadraticCurveTo(x + 22, 652, x, 664); p.quadraticCurveTo(x - 22, 652, x - 32, 626); p.closePath(); });
  pc(ctx, s, PAPER, { line: 3 });
  pc(ctx, rectP(x - 30, 594, 60, 12), NAVY, { line: 0 });
  pc(ctx, starP(x, 632, 16), CORAL, { line: 1.2 });
}
function diamondSign(ctx, x) {
  pc(ctx, rectP(x - 4, 650, 8, 150), CHROME, { line: 1.4 });
  pc(ctx, polyP([[x, 580], [x + 44, 624], [x, 668], [x - 44, 624]]), YEL, { line: 2.6 });
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 6, 650); ctx.bezierCurveTo(x - 24, 630, x + 22, 622, x + 4, 602); ctx.stroke();
  pc(ctx, polyP([[x - 8, 600], [x + 12, 590], [x + 12, 612]]), INK, { line: 0, reg: 0 });
}
function fence(ctx, xa, xb) {
  ctx.strokeStyle = rgba(INK, 0.8); ctx.lineWidth = 1.4;
  for (const y of [748, 770]) { ctx.beginPath(); ctx.moveTo(xa, y); for (let x = xa; x <= xb; x += 70) ctx.quadraticCurveTo(x + 35, y + 5, x + 70, y); ctx.stroke(); }
  for (let x = xa; x <= xb + 1; x += 70) pc(ctx, polyP([[x - 4, 800], [x - 5, 732], [x + 5, 730], [x + 4, 800]]), WOOD, { line: 1.2 });
}

/** 路边一层（视差 1）。sF：定格时的画面 x；层内 x = sF + cF。 */
function roadsideLayer(cF) {
  return strip('s15-roadside', 1, (ctx, x0, x1) => {
    const at = (sF) => sF + cF;
    const R = rng('s15-roadside');
    // 地面上的小灌木（先画，在道具后面）
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

// ---------- 路面 ----------
function roadLayer() {
  return strip('s15-road', 1, (ctx, x0, x1) => {
    // 沙土路肩（他走在这里）
    ctx.fillStyle = SAND; ctx.fillRect(x0, 794, x1 - x0, 50);
    halftone(ctx, rectP(x0, 794, x1 - x0, 50), SAND_D, (x, y) => 0.3 + 0.25 * noise2(x / 50, y / 20, 41), [x0, 794, x1 - x0, 50], { step: 4.5 });
    const R = rng('s15-pebbles');
    for (let x = x0; x < x1; x += 16 + R() * 40) { ctx.fillStyle = R() < 0.5 ? WOOD_L : '#c9b48a'; ctx.beginPath(); ctx.ellipse(x, 806 + R() * 34, 2 + R() * 3, 1.5 + R() * 1.5, 0, 0, TAU); ctx.fill(); }
    // 柏油路
    const g = ctx.createLinearGradient(0, 842, 0, 1000);
    g.addColorStop(0, '#b5c1c6'); g.addColorStop(1, ASPH);
    ctx.fillStyle = g; ctx.fillRect(x0, 842, x1 - x0, 160);
    halftone(ctx, rectP(x0, 842, x1 - x0, 160), ASPH_D, (x, y) => 0.18 + 0.12 * (y - 842) / 158, [x0, 842, x1 - x0, 160], { step: 5.5 });
    ctx.fillStyle = PAPER; ctx.fillRect(x0, 852, x1 - x0, 6);
    ctx.fillStyle = INK; ctx.fillRect(x0, 842, x1 - x0, 2);
    for (let x = Math.floor(x0 / 150) * 150; x < x1; x += 150) {
      ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = YEL; ctx.fillRect(x, 934, 80, 9); ctx.restore();
    }
    grainOver(ctx, x0, 790, x1 - x0, 210, 0.9);
  }, { y0: 790, y1: 1000 });
}

// ---------- 动态：汽车旅馆的灯泡箭头立牌 ----------
function arrowSign(ctx, x, b) {
  pc(ctx, rectP(x - 7, 330, 14, 470), NAVY, { line: 1.6 });
  pc(ctx, rrP(x - 52, 330, 104, 150, 10), PAPER, { line: 2.4, dots: dotsIn(SAND_D, 0.18, [x - 52, 330, 104, 150]) });
  pc(ctx, rrP(x - 42, 340, 84, 130, 6), null, { line: 1.4 });
  pc(ctx, starP(x, 300, 30, Math.sin(b * Math.PI) * 0.15), YEL, { line: 1.8 });
  // 回旋镖式的大箭头：从牌子右下甩出，指向左下的办公室
  const arrow = pathOf((p) => {
    p.moveTo(x + 40, 440); p.quadraticCurveTo(x + 150, 470, x + 70, 540); p.lineTo(x - 30, 560); p.lineTo(x - 26, 532); p.lineTo(x - 92, 572);
    p.lineTo(x - 18, 600); p.lineTo(x - 22, 578); p.lineTo(x + 86, 556); p.quadraticCurveTo(x + 176, 470, x + 52, 424); p.closePath();
  });
  pc(ctx, arrow, CORAL, { line: 2.4, dots: dotsIn(CORAL_D, 0.28, [x - 100, 420, 290, 190]) });
  // 灯泡：每半拍追逐一格
  const pts = [];
  for (let k = 0; k <= 12; k++) { const t = k / 12; const q = [(1 - t) ** 2 * (x + 46) + 2 * (1 - t) * t * (x + 162) + t * t * (x + 78), (1 - t) ** 2 * 432 + 2 * (1 - t) * t * 470 + t * t * 548]; pts.push(q); }
  for (let k = 1; k <= 4; k++) pts.push([lerp(x + 78, x - 22, k / 4), lerp(548, 568, k / 4)]);
  const ph = Math.floor(b * 2);
  pts.forEach(([px, py], i) => {
    const on = ((i - ph) % 3 + 3) % 3 === 0;
    ctx.fillStyle = on ? '#fff3b0' : rgba(CREAM, 0.9);
    ctx.beginPath(); ctx.arc(px, py, on ? 5.5 : 4, 0, TAU); ctx.fill();
    if (on) { ctx.fillStyle = rgba('#fff6c8', 0.35); ctx.beginPath(); ctx.arc(px, py, 11, 0, TAU); ctx.fill(); }
  });
}

// ---------- 动态：原创复古敞篷小车（朝右，原点在两轮之间的地面） ----------
function car(ctx, x, y, s, roll, wave) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = rgba(NAVY, 0.2); ctx.beginPath(); ctx.ellipse(6, 2, 218, 11, 0, 0, TAU); ctx.fill();
  // 后备箱上绑着的行李箱
  pc(ctx, rrP(-196, -148, 70, 44, 6), MINT, { line: 2, dots: dotsIn(MINT_D, 0.3, [-196, -148, 70, 44]) });
  ctx.fillStyle = WOOD_D; ctx.fillRect(-176, -148, 6, 44); ctx.fillRect(-152, -148, 6, 44);
  // 座椅靠背 + 司机（草帽、墨镜、围巾，原创）
  pc(ctx, rrP(-104, -150, 40, 56, 10), CREAM, { line: 1.6 });
  pc(ctx, rrP(-28, -148, 40, 54, 10), CREAM, { line: 1.6 });
  pc(ctx, rrP(-14, -160, 30, 48, 10), '#f3a46c', { line: 1.6 });           // 上身（橙色衬衫）
  pc(ctx, ellP(4, -184, 17, 19), '#f1c4a0', { line: 1.6 });                 // 脸
  pc(ctx, ellP(2, -198, 32, 7), '#f2d27a', { line: 1.6 });                  // 草帽沿
  pc(ctx, pathOf((p) => { p.moveTo(-14, -199); p.quadraticCurveTo(-12, -220, 4, -220); p.quadraticCurveTo(18, -220, 18, -199); p.closePath(); }), '#f2d27a', { line: 1.6 });
  ctx.fillStyle = CORAL; ctx.fillRect(-14, -204, 32, 5);                    // 帽带
  pc(ctx, rrP(6, -190, 15, 7, 3), INK, { line: 0, reg: 0 });               // 墨镜
  // 挥手的胳膊
  ctx.save(); ctx.translate(-2, -152); ctx.rotate(-1.9 - 0.35 * wave);
  pc(ctx, rrP(-6, 0, 12, 46, 6), '#f1c4a0', { line: 1.4 });
  pc(ctx, circP(0, 50, 9), '#f1c4a0', { line: 1.4 });
  ctx.restore();
  // 风挡
  pc(ctx, polyP([[38, -102], [62, -158], [70, -156], [50, -100]]), rgba(SKY_L, 0.85), { line: 2 });
  // 车身
  const body = pathOf((p) => {
    p.moveTo(-206, -40); p.lineTo(-212, -80); p.quadraticCurveTo(-214, -100, -192, -106);
    p.lineTo(-150, -118); p.lineTo(-124, -102); p.lineTo(40, -102);
    p.quadraticCurveTo(150, -100, 198, -84); p.quadraticCurveTo(216, -78, 214, -50);
    p.lineTo(210, -36); p.quadraticCurveTo(202, -26, 182, -26); p.lineTo(-188, -26);
    p.quadraticCurveTo(-206, -28, -206, -40); p.closePath();
  });
  pc(ctx, body, CORAL, { line: 2.4, dots: dotsIn(CORAL_D, 0.35, [-216, -120, 432, 96]) });
  ctx.save(); ctx.clip(body);
  ctx.save(); ctx.translate(REG[0], REG[1]);
  ctx.fillStyle = CREAM_L;
  ctx.beginPath(); ctx.moveTo(-200, -74); ctx.quadraticCurveTo(-40, -82, 150, -66); ctx.lineTo(150, -60); ctx.quadraticCurveTo(-40, -70, -200, -62); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.fillStyle = rgba('#ffffff', 0.5); ctx.fillRect(-120, -98, 150, 4);
  ctx.restore();
  // 轮拱 + 轮子（白边轮胎，滚动）
  for (const wx of [-128, 128]) {
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(wx, -26, 44, Math.PI, 0); ctx.fill();
    ctx.save(); ctx.translate(wx, -32);
    pc(ctx, circP(0, 0, 34), '#2b3440', { line: 0, reg: 0 });
    pc(ctx, circP(0, 0, 24), PAPER, { line: 0, reg: 0 });
    pc(ctx, circP(0, 0, 17), CHROME, { line: 1.4, reg: 0 });
    ctx.rotate(roll);
    ctx.strokeStyle = rgba(INK, 0.8); ctx.lineWidth = 2.2;
    for (let k = 0; k < 3; k++) { ctx.rotate(TAU / 3); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 14); ctx.stroke(); }
    ctx.restore();
  }
  // 镀铬保险杠、车灯、尾灯
  pc(ctx, rrP(196, -48, 26, 14, 6), CHROME, { line: 1.8 });
  pc(ctx, rrP(-220, -50, 22, 14, 6), CHROME, { line: 1.8 });
  pc(ctx, ellP(206, -70, 7, 9), '#fff6c8', { line: 1.4 });
  pc(ctx, ellP(-206, -88, 5, 9), CORAL_D, { line: 1.2 });
  ctx.restore();
}
function carState(b, env) {
  if (b < T_CAR[0] || b > T_CAR[1]) return null;
  const t = (b - T_CAR[0]) / (T_CAR[1] - T_CAR[0]);
  // 画面 x：从左边画外追上来，超过他（第 6.4 拍左右并排），开出右边画外
  const sx = lerp(X_MIN - 300, X_MAX + 320, t * t * 0.35 + t * 0.65);
  const travel = sx + env.cam; // 世界里走过的距离（轮子滚动）
  return { x: sx, y: 936, s: 1, roll: travel / 34, wave: Math.max(0, Math.sin(clamp((t - 0.3) / 0.4) * Math.PI)) * (0.6 + 0.4 * Math.sin(b * TAU * 2)) };
}
function exhaust(ctx, c, b) {
  for (let k = 0; k < 3; k++) {
    const age = ((b * 2 + k / 3) % 1);
    const px = c.x - 230 - age * 120, py = c.y - 40 - age * 30;
    ctx.fillStyle = rgba(PAPER, 0.85 * (1 - age));
    ctx.beginPath(); ctx.arc(px, py, 10 + age * 18, 0, TAU); ctx.fill();
  }
}

// ---------- 邮戳（预先烘焙：双圈 + 2022 + 星星 + 波浪注销线；再打出漏印和按压不匀） ----------
function postmark(key, r, waveLen, seed) {
  const S = 1.7, pad = 30;
  const x0 = -r - pad, x1 = r + 16 + waveLen + pad, y0 = -r - pad, y1 = r + pad;
  const cv = baked(`s15-pm|${key}|${r}|${waveLen}|${seed}`, (x1 - x0) * S, (y1 - y0) * S, (c) => {
    c.scale(S, S); c.translate(-x0, -y0);
    c.strokeStyle = POST_INK; c.fillStyle = POST_INK; c.lineCap = 'round';
    c.lineWidth = r * 0.085; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    c.lineWidth = r * 0.05; c.beginPath(); c.arc(0, 0, r * 0.76, 0, TAU); c.stroke();
    font(c, r * 0.56, { family: SANS, weight: 700 });
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('2022', 0, r * 0.05);
    for (const sy of [-1, 1]) { c.beginPath(); starPath(c, 0, sy * r * 0.5, r * 0.11, 5, 0.45); c.fill(); }
    // 两侧短横（日戳的格线）
    c.lineWidth = r * 0.04;
    for (const sx of [-1, 1]) { c.beginPath(); c.moveTo(sx * r * 0.58, -r * 0.33); c.lineTo(sx * r * 0.7, -r * 0.33); c.moveTo(sx * r * 0.58, r * 0.37); c.lineTo(sx * r * 0.7, r * 0.37); c.stroke(); }
    // 波浪注销线
    c.lineWidth = r * 0.075;
    for (let k = 0; k < 5; k++) {
      const yy = (k - 2) * r * 0.3, xa = r + 16 + (k === 0 || k === 4 ? 14 : 0);
      c.beginPath();
      for (let x = xa; x <= r + 16 + waveLen; x += 3) c.lineTo(x, yy + Math.sin((x - xa) / (r * 0.62) * TAU) * r * 0.07);
      c.stroke();
    }
    const R = rng('s15-pm', seed);
    // 溅出的几点印泥
    for (let k = 0; k < 9; k++) { const a = R() * TAU, d = r * (1.12 + R() * 0.35); c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.8 + R() * 2.4, 0, TAU); c.fill(); }
    // 漏印与按压不匀
    c.globalCompositeOperation = 'destination-out';
    const n = Math.round((x1 - x0) * (y1 - y0) * 0.02);
    for (let k = 0; k < n; k++) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); c.globalAlpha = 0.5 + R() * 0.5; c.beginPath(); c.arc(x, y, 0.5 + R() * 1.5, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
    const g = c.createLinearGradient(r * 0.6, 0, r + 16 + waveLen, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.62)');
    c.fillStyle = g; c.fillRect(r * 0.6, y0, x1 - r * 0.6, y1 - y0);
    const ga = R() * TAU;
    const g2 = c.createRadialGradient(Math.cos(ga) * r * 0.8, Math.sin(ga) * r * 0.8, 0, Math.cos(ga) * r * 0.8, Math.sin(ga) * r * 0.8, r * 0.7);
    g2.addColorStop(0, 'rgba(0,0,0,0.55)'); g2.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g2; c.fillRect(x0, y0, x1 - x0, y1 - y0);
    for (let k = 0; k < 3; k++) { // 圈上几处断口
      const a = R() * TAU;
      c.save(); c.translate(Math.cos(a) * r, Math.sin(a) * r); c.rotate(a); c.fillRect(-r * 0.08, -r * 0.03 - R() * r * 0.05, r * 0.16, r * 0.1); c.restore();
    }
    // 印泥积墨：几块更深的斑
    c.globalCompositeOperation = 'source-atop';
    for (let k = 0; k < 6; k++) { const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0); const gg = c.createRadialGradient(x, y, 0, x, y, r * 0.5); gg.addColorStop(0, 'rgba(110,14,18,0.45)'); gg.addColorStop(1, 'rgba(110,14,18,0)'); c.fillStyle = gg; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
  });
  return { cv, x0, y0, w: x1 - x0, h: y1 - y0 };
}
const bigMark = () => postmark('big', PM_R, PM_WAVE, 1);
const smallMark = (k) => postmark(`small${k}`, PM_R * SMALL, PM_WAVE * SMALL * 0.8, 2 + k);
function drawMark(ctx, M, x, y, rot, alpha = 1, scale = 1) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(scale, scale);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(M.cv, M.x0, M.y0, M.w, M.h);
  ctx.restore();
}

// ---------- 橡皮图章（原点 = 印面圆心，沿邮戳方向） ----------
const FACE = { x0: -PM_R - 30, x1: PM_R + 16 + PM_WAVE + 26, d: 60, H: 74 };
function rubberStamp(ctx, x, y, rot, s, squash = 0) {
  const { x0, x1, d, H } = FACE, fc = (x0 + x1) / 2, w = x1 - x0;
  const h = H * (1 - squash * 0.35);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  // 手柄：颈 + 红漆圆钮
  const neckTop = -d - h - 150 * (1 - squash * 0.25);
  pc(ctx, rrP(fc - 24, neckTop, 48, -d - h - neckTop + 8, 10), WOOD_L, { line: 2.4, dots: dotsIn(WOOD_D, 0.35, [fc + 4, neckTop, 22, 170], { step: 4 }) });
  pc(ctx, rrP(fc - 32, -d - h - 26, 64, 22, 8), CHROME, { line: 2 });
  pc(ctx, ellP(fc, neckTop - 40, 74, 58), CORAL, { line: 2.6, dots: dotsIn(CORAL_D, 0.4, [fc, neckTop - 100, 80, 120]) });
  ctx.fillStyle = rgba('#ffe2c8', 0.8); ctx.beginPath(); ctx.ellipse(fc - 26, neckTop - 62, 20, 11, -0.5, 0, TAU); ctx.fill();
  // 木块：顶面 + 正面
  const topFace = rrP(x0, -d - h, w, 2 * d, 26);
  pc(ctx, topFace, WOOD_L, { line: 2.6, dots: dotsIn(WOOD, 0.3, [x0, -d - h, w, 2 * d]) });
  ctx.save(); ctx.clip(topFace); ctx.strokeStyle = rgba(WOOD_D, 0.6); ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(x0, -d - h + 14 + k * 18); ctx.bezierCurveTo(x0 + w * 0.3, -d - h + 6 + k * 18, x0 + w * 0.6, -d - h + 26 + k * 18, x1, -d - h + 12 + k * 18); ctx.stroke(); }
  ctx.restore();
  const front = pathOf((p) => { p.moveTo(x0, d - h - 26); p.lineTo(x0, d - 26 - 14); p.quadraticCurveTo(x0, d - 14, x0 + 26, d - 14); p.lineTo(x1 - 26, d - 14); p.quadraticCurveTo(x1, d - 14, x1, d - 40); p.lineTo(x1, d - h - 26); p.quadraticCurveTo(x1, d - h, x1 - 26, d - h); p.lineTo(x0 + 26, d - h); p.quadraticCurveTo(x0, d - h, x0, d - h - 26); p.closePath(); });
  pc(ctx, front, WOOD, { line: 2.6, dots: dotsIn(WOOD_D, 0.42, [x0, d - h - 30, w, h + 20]) });
  ctx.fillStyle = CHROME; ctx.fillRect(x0 + 8, d - h * 0.55, w - 16, 7);
  // 橡胶章面（沾着红印泥）
  const rub = rrP(x0 + 6, d - 18, w - 12, 18, 8);
  pc(ctx, rub, '#7a2b26', { line: 2.2 });
  ctx.save(); ctx.clip(rub); ctx.fillStyle = rgba(POST_INK, 0.85); ctx.fillRect(x0, d - 8, w, 12); ctx.restore();
  ctx.restore();
}

/** 图章在第几拍在哪：{x, y, rot, s, squash}（画面单位），没有就 null。 */
function stampPose(b) {
  const C = chest('stand');
  if (b >= T_DROP && b < T_LIFT[1]) {
    let y = C.y, rot = PM_ROT, squash = 0;
    if (b < T_HIT) { const t = (b - T_DROP) / (T_HIT - T_DROP); y = C.y - 1000 * (1 - t * t); rot = PM_ROT - 0.16 * (1 - t); }
    else if (b < T_LIFT[0]) {
      squash = Math.exp(-(b - T_HIT) * 14) * (b - T_HIT < 0.05 ? (b - T_HIT) / 0.05 : 1);
      const rock = smoothstep(T_HIT + 0.2, T_HIT + 0.35, b) * (1 - smoothstep(T_LIFT[0] - 0.15, T_LIFT[0], b));
      rot += 0.035 * Math.sin((b - T_HIT - 0.2) * TAU * 2) * rock;
    } else { const t = (b - T_LIFT[0]) / (T_LIFT[1] - T_LIFT[0]); y = C.y - 1100 * ease.in(t); rot = PM_ROT + 0.2 * t; }
    return { x: C.x, y, rot, s: 1, squash };
  }
  if (b >= T_STAMP && b < T_OFF + 0.5) {
    // 缩小的图章：落到邮票上 → 跳到天空 → 飞走
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

// ---------- 「啪」：一震、一凹 ----------
function jolt(b) {
  let dx = 0, dy = 0, k = 1, cx = 0, cy = 0;
  const C = chest('stand');
  for (const [t0, A, px, py] of [[T_HIT, 1, C.x + (FACE.x0 + FACE.x1) / 2 * 0.9, C.y], [T_HIT2, 0.32, SPOT_A.x, SPOT_A.y], [T_HIT3, 0.32, SPOT_B.x, SPOT_B.y]]) {
    const t = b - t0;
    if (t < 0 || t > 0.8) continue;
    const e = Math.exp(-t * 7) * A;
    dy += Math.sin(t * 42) * 8 * e; dx += Math.sin(t * 33 + 1) * 4 * e;
    k = 1 - 0.022 * Math.exp(-t * 9) * A;
    cx = px; cy = py;
  }
  return { dx, dy, k, cx, cy, on: k !== 1 || dx !== 0 || dy !== 0 };
}
function applyJolt(ctx, J) {
  if (!J.on) return;
  ctx.translate(J.dx, J.dy);
  ctx.translate(J.cx, J.cy); ctx.scale(J.k, J.k); ctx.translate(-J.cx, -J.cy);
}
/** 定格时人物胸口（邮戳圆心）的画面位置。 */
function chest(pose) { const o = PM_OFF[pose]; return { x: CHAR_X + o[0], y: ROAD_Y + o[1] }; }

/** 纸面一凹：落点四周一圈阴影 + 亮边。 */
function dent(ctx, b) {
  const t = b - T_HIT;
  if (t < 0 || t > 1.6) return;
  const k = t < 1 ? 1 : 1 - (t - 1) / 0.6;
  const C = chest('stand'), fc = (FACE.x0 + FACE.x1) / 2;
  ctx.save();
  ctx.translate(C.x, C.y); ctx.rotate(PM_ROT); ctx.translate(fc, 0); ctx.scale(1.55, 1);
  const g = ctx.createRadialGradient(0, 0, 120, 0, 0, 230);
  g.addColorStop(0, rgba(NAVY, 0)); g.addColorStop(0.25, rgba(NAVY, 0.16 * k)); g.addColorStop(0.55, rgba(NAVY, 0.05 * k)); g.addColorStop(0.75, rgba('#ffffff', 0.14 * k)); g.addColorStop(1, rgba('#ffffff', 0));
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 232, 0, TAU); ctx.fill();
  ctx.restore();
}
/** 冲击线 + 飞溅的印泥点。 */
function burst(ctx, b, t0, x, y, rot, s) {
  const t = b - t0;
  if (t < 0 || t > 0.4) return;
  const k = 1 - t / 0.4, fc = (FACE.x0 + FACE.x1) / 2;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s); ctx.translate(fc, 0);
  const R = rng('s15-burst', t0);
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + R() * 0.2, r0 = 260 + t * 260, r1 = r0 + 50 + 40 * k;
    ctx.strokeStyle = i % 2 ? rgba(CORAL, k) : rgba(NAVY, k); ctx.lineWidth = 9 * k + 2;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0 * 0.55); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1 * 0.55); ctx.stroke();
  }
  ctx.fillStyle = rgba(POST_INK, 0.9 * k);
  for (let i = 0; i < 16; i++) {
    const a = R() * TAU, d = (200 + R() * 80) + t * (300 + R() * 300);
    ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d * 0.5, 3 + R() * 4, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ---------- 邮票（无字：太阳光芒、棕榈、台地） ----------
function postageStamp() {
  const w = 128, h = 154, S = 2.2, pad = 8;
  return baked('s15-postage', (w + 2 * pad) * S, (h + 2 * pad) * S, (c) => {
    c.scale(S, S); c.translate(pad, pad);
    // 齿孔边：白纸 + 一圈半圆缺口
    const pr = 5, step = 13;
    const edge = new Path2D(); edge.rect(0, 0, w, h);
    c.fillStyle = 'rgba(40,50,60,0.25)'; c.fillRect(3, 4, w, h);
    c.fillStyle = PAPER; c.fill(edge);
    c.globalCompositeOperation = 'destination-out';
    for (let x = step / 2; x < w; x += step) for (const y of [0, h]) { c.beginPath(); c.arc(x, y, pr, 0, TAU); c.fill(); }
    for (let y = step / 2; y < h; y += step) for (const x of [0, w]) { c.beginPath(); c.arc(x, y, pr, 0, TAU); c.fill(); }
    c.globalCompositeOperation = 'source-over';
    const ix = 13, iy = 13, iw = w - 26, ih = h - 26;
    c.save(); c.beginPath(); c.rect(ix, iy, iw, ih); c.clip();
    const g = c.createLinearGradient(0, iy, 0, iy + ih); g.addColorStop(0, '#f6c46a'); g.addColorStop(0.6, '#f9e3a8'); g.addColorStop(1, CREAM_L);
    c.fillStyle = g; c.fillRect(ix, iy, iw, ih);
    const sx = ix + iw * 0.55, sy = iy + ih * 0.58;
    c.fillStyle = rgba(ORANGE, 0.55);
    for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; c.beginPath(); c.moveTo(sx, sy); c.arc(sx, sy, 120, a, a + TAU / 32); c.closePath(); c.fill(); }
    c.fillStyle = CORAL; c.beginPath(); c.arc(sx, sy, 22, 0, TAU); c.fill();
    c.fillStyle = ORANGE_D; c.beginPath(); c.moveTo(ix, iy + ih); c.lineTo(ix, iy + ih * 0.72); c.lineTo(ix + 18, iy + ih * 0.7); c.lineTo(ix + 26, iy + ih * 0.78); c.lineTo(ix + 70, iy + ih * 0.8); c.lineTo(ix + iw, iy + ih * 0.76); c.lineTo(ix + iw, iy + ih); c.fill();
    c.fillStyle = '#3f8c78'; c.fillRect(ix, iy + ih * 0.86, iw, ih * 0.14);
    c.strokeStyle = NAVY; c.lineWidth = 3; c.beginPath(); c.moveTo(ix + 30, iy + ih * 0.9); c.quadraticCurveTo(ix + 26, iy + ih * 0.6, ix + 36, iy + ih * 0.36); c.stroke();
    c.fillStyle = NAVY;
    for (const a of [-2.8, -2.2, -1.5, -0.9, -0.3]) { c.beginPath(); c.ellipse(ix + 36 + Math.cos(a) * 16, iy + ih * 0.36 + Math.sin(a) * 9 + 6, 18, 4.5, a, 0, TAU); c.fill(); }
    c.restore();
    c.strokeStyle = NAVY; c.lineWidth = 1.6; c.strokeRect(ix, iy, iw, ih);
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
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(slap, slap);
  ctx.drawImage(postageStamp(), -72, -85, 144, 170);
  ctx.restore();
}

// ---------- 明信片白边 + 角上磨损 + 全画面一层淡纸色和颗粒（按画面烘焙一次） ----------
function postcardOverlay() {
  const W = (X_MAX - X_MIN) * K, H = 1000 * K;
  return baked('s15-overlay', W, H, (c) => {
    c.scale(K, K); c.translate(-X_MIN, 0);
    const ix0 = X_MIN + BORDER, iy0 = BORDER, iw = X_MAX - X_MIN - 2 * BORDER, ih = 1000 - 2 * BORDER;
    // 褪色：整幅画一层很淡的纸色 + 颗粒
    c.fillStyle = rgba(PAPER, 0.1); c.fillRect(ix0, iy0, iw, ih);
    c.fillStyle = c.createPattern(grainTile(), 'repeat'); c.globalAlpha = 0.55; c.fillRect(ix0, iy0, iw, ih); c.globalAlpha = 1;
    // 四角泛黄
    for (const [cx, cy] of [[X_MIN, 0], [X_MAX, 0], [X_MIN, 1000], [X_MAX, 1000]]) {
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 170);
      g.addColorStop(0, 'rgba(176,132,70,0.26)'); g.addColorStop(1, 'rgba(176,132,70,0)');
      c.fillStyle = g; c.fillRect(cx - 170, cy - 170, 340, 340);
    }
    // 白边
    const p = new Path2D(); p.rect(X_MIN - 10, -10, X_MAX - X_MIN + 20, 1020); rrPath(p, ix0, iy0, iw, ih, 4);
    c.fillStyle = PAPER; c.fill(p, 'evenodd');
    c.fillStyle = c.createPattern(grainTile(), 'repeat'); c.fill(p, 'evenodd');
    for (const [cx, cy] of [[X_MIN, 0], [X_MAX, 0], [X_MIN, 1000], [X_MAX, 1000]]) {
      c.save(); c.clip(p, 'evenodd');
      const g = c.createRadialGradient(cx, cy, 0, cx, cy, 90);
      g.addColorStop(0, 'rgba(160,120,62,0.35)'); g.addColorStop(1, 'rgba(160,120,62,0)');
      c.fillStyle = g; c.fillRect(cx - 90, cy - 90, 180, 180);
      c.restore();
    }
    c.strokeStyle = 'rgba(60,70,84,0.28)'; c.lineWidth = 1.2; c.stroke(pathOf((q) => rrPath(q, ix0, iy0, iw, ih, 4)));
    // 画面四角磨掉的白点
    const R = rng('s15-wear');
    for (const [cx, cy, sx, sy] of [[ix0, iy0, 1, 1], [ix0 + iw, iy0, -1, 1], [ix0, iy0 + ih, 1, -1], [ix0 + iw, iy0 + ih, -1, -1]]) {
      for (let k = 0; k < 70; k++) {
        const d = Math.pow(R(), 2.2) * 60, a = R() * Math.PI / 2;
        const x = cx + sx * Math.cos(a) * d, y = cy + sy * Math.sin(a) * d;
        c.fillStyle = rgba(PAPER, 0.5 + R() * 0.5);
        c.beginPath(); c.ellipse(x, y, 0.6 + R() * 2.6, 0.5 + R() * 1.4, R() * 3, 0, TAU); c.fill();
      }
    }
    // 左下角一道折痕
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(X_MIN, 1000 - 120); c.lineTo(X_MIN + 120, 1000); c.stroke();
    c.strokeStyle = 'rgba(80,70,60,0.18)'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(X_MIN + 2, 1000 - 124); c.lineTo(X_MIN + 124, 1002); c.stroke();
  });
}

// ---------- 人物画风：手工上色明信片（褪色靛蓝 + 桃色皮肤 + 套色错位 + 细网点） ----------
const FIG_LINE = '#1f2d3d';
registerStyle('s15-postcard', (I) => {
  const O = comicBase(I, { levels: 6, keep: 0.2, lw: 3.2, inner: 0.42, ink: FIG_LINE });
  const pal = [FIG_LINE, '#2f4c6e', '#56799e', '#9ab6cc', '#d9906e', '#f3c9a4', '#f6ecd6'].map(rgbf);
  const n = O.w * O.h, cls = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (O.a[i] < 0.01) continue;
    const l = luma(O, i);
    const skin = O.r[i] - O.b[i] > 0.07 && l > 0.22;
    cls[i] = l < 0.07 ? 0 : skin ? (l < 0.5 ? 4 : 5) : l < 0.2 ? 1 : l < 0.42 ? 2 : l < 0.7 ? 3 : 6;
  }
  const DX = 2, DY = 1, paperC = rgbf(PAPER);
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
    const i = y * O.w + x;
    if (cls[i] < 0) continue;
    let c;
    if (cls[i] === 0) c = pal[0];
    else {
      const j = Math.max(0, y - DY) * O.w + Math.max(0, x - DX);
      c = cls[j] > 0 ? pal[cls[j]] : cls[j] === 0 ? pal[cls[i]] : paperC;
      // 网点：45° 细网，暗部（1、2、4 档）点上深一档的墨
      const cj = cls[j];
      if (cj === 1 || cj === 2 || cj === 4) {
        const u = (x + y) / 4.2, v = (x - y) / 4.2;
        const d = Math.hypot(u - Math.round(u), v - Math.round(v));
        if (d < (cj === 1 ? 0.36 : 0.28)) c = [c[0] * 0.78, c[1] * 0.8, c[2] * 0.84];
      }
    }
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
  }
  return O;
});

// ---------- 标题卡、手机、画框（像素坐标） ----------
function airmailBorder(ctx, x, y, w, h, band) {
  ctx.save();
  const ring = new Path2D(); ring.rect(x, y, w, h); ring.rect(x + band, y + band, w - 2 * band, h - 2 * band);
  ctx.clip(ring, 'evenodd');
  ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
  const cols = ['#d6453a', PAPER, '#2f5f9a', PAPER];
  const u = 15;
  for (let k = -Math.ceil(h / u) - 2, i = 0; k * u < w + h; k++, i++) {
    ctx.fillStyle = cols[((k % 4) + 4) % 4];
    ctx.beginPath(); ctx.moveTo(x + k * u, y + h); ctx.lineTo(x + k * u + h, y); ctx.lineTo(x + (k + 1) * u + h, y); ctx.lineTo(x + (k + 1) * u, y + h); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function cardBg(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(40,50,70,0.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
  ctx.restore();
  airmailBorder(ctx, x, y, w, h, 14);
  ctx.save();
  ctx.fillStyle = CREAM_L; ctx.fillRect(x + 14, y + 14, w - 28, h - 28);
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat'); ctx.globalAlpha = 0.5; ctx.fillRect(x + 14, y + 14, w - 28, h - 28); ctx.globalAlpha = 1;
  ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.strokeRect(x + 22, y + 22, w - 44, h - 44);
  ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = CORAL; ctx.beginPath(); starPath(ctx, x + w - 40, y + 44, 12); ctx.fill();
  ctx.restore();
}
function stampEdgePath(x, y, w, h, pr, step) {
  // 齿孔边的外轮廓：沿四边一路咬出半圆缺口
  const p = new Path2D();
  const nx = Math.max(1, Math.round(w / step)), ny = Math.max(1, Math.round(h / step));
  const sx = w / nx, sy = h / ny;
  p.moveTo(x, y);
  for (let i = 0; i < nx; i++) { const cx = x + (i + 0.5) * sx; p.lineTo(cx - pr, y); p.arc(cx, y, pr, Math.PI, 0, true); }
  p.lineTo(x + w, y);
  for (let i = 0; i < ny; i++) { const cy = y + (i + 0.5) * sy; p.lineTo(x + w, cy - pr); p.arc(x + w, cy, pr, -Math.PI / 2, Math.PI / 2, true); }
  p.lineTo(x + w, y + h);
  for (let i = nx - 1; i >= 0; i--) { const cx = x + (i + 0.5) * sx; p.lineTo(cx + pr, y + h); p.arc(cx, y + h, pr, 0, Math.PI, true); }
  p.lineTo(x, y + h);
  for (let i = ny - 1; i >= 0; i--) { const cy = y + (i + 0.5) * sy; p.lineTo(x, cy + pr); p.arc(x, cy, pr, Math.PI / 2, -Math.PI / 2, true); }
  p.closePath();
  return p;
}
function songPlate(ctx, x, y, w, h) {
  ctx.save();
  const p = stampEdgePath(x, y, w, h, 5, 16);
  ctx.shadowColor = 'rgba(40,50,70,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = PAPER; ctx.fill(p);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = CORAL; ctx.lineWidth = 2.2; ctx.strokeRect(x + 11, y + 11, w - 22, h - 22);
  ctx.restore();
}
function postcardPhone(ctx, kind, cx, cy, s, spin, P, gb) {
  const w = 120 * s, h = 220 * s;
  const sec = stationSection(15);
  const prog = clamp(0.06 + 0.88 * ((gb - sec.start) / sec.beats));
  ctx.save();
  ctx.translate(cx, cy);
  // 机身：薄荷绿 + 网点阴影 + 套色错位
  const body = rrP(-w / 2, -h / 2, w, h, 20 * s);
  ctx.save(); ctx.translate(2 * s, 1.5 * s); ctx.fillStyle = MINT; ctx.fill(body);
  halftone(ctx, body, MINT_D, (x) => 0.15 + 0.4 * smoothstep(0, w / 2, x), [-w / 2, -h / 2, w, h], { step: 4.5 });
  ctx.restore();
  ctx.lineWidth = 2.6 * s; ctx.strokeStyle = INK; ctx.stroke(body);
  ctx.shadowColor = 'transparent';
  const scr = rrP(-w / 2 + 9 * s, -h / 2 + 22 * s, w - 18 * s, h - 46 * s, 10 * s);
  ctx.fillStyle = PAPER; ctx.fill(scr);
  ctx.lineWidth = 1.8 * s; ctx.stroke(scr);
  ctx.fillStyle = INK; ctx.fillRect(-14 * s, -h / 2 + 10 * s, 28 * s, 4 * s);
  ctx.beginPath(); ctx.arc(0, h / 2 - 12 * s, 5 * s, 0, TAU); ctx.lineWidth = 1.6 * s; ctx.stroke();
  // 屏幕上半：天蓝 + 转动的太阳光芒唱片
  ctx.save(); ctx.clip(scr);
  const g = ctx.createLinearGradient(0, -h / 2 + 22 * s, 0, -h / 2 + 130 * s);
  g.addColorStop(0, SKY); g.addColorStop(1, CREAM_L);
  ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2 + 22 * s, w, 108 * s);
  ctx.translate(0, -h / 2 + 76 * s); ctx.rotate(spin);
  ctx.fillStyle = rgba(ORANGE, 0.6);
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 70 * s, a, a + TAU / 24); ctx.closePath(); ctx.fill(); }
  ctx.beginPath(); ctx.arc(0, 0, 36 * s, 0, TAU); ctx.fillStyle = CORAL; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
  for (const r of [16, 23, 30]) { ctx.beginPath(); ctx.arc(0, 0, r * s, 0, TAU); ctx.lineWidth = 1 * s; ctx.strokeStyle = rgba('#ffffff', 0.35); ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 11 * s, 0, TAU); ctx.fillStyle = YEL; ctx.fill();
  ctx.beginPath(); starPath(ctx, 0, -25 * s, 6 * s); ctx.fillStyle = PAPER; ctx.fill();
  ctx.restore();
  // 进度条 + 按钮
  const by = h / 2 - 76 * s, bw = 84 * s;
  ctx.fillStyle = rgba(INK, 0.22); ctx.fillRect(-bw / 2, by, bw, 5 * s);
  ctx.fillStyle = CORAL; ctx.fillRect(-bw / 2, by, bw * prog, 5 * s);
  ctx.beginPath(); ctx.arc(-bw / 2 + bw * prog, by + 2.5 * s, 6 * s, 0, TAU); ctx.fill(); ctx.lineWidth = 1.4 * s; ctx.strokeStyle = INK; ctx.stroke();
  ctx.fillStyle = NAVY;
  const yb = h / 2 - 46 * s;
  ctx.beginPath(); ctx.moveTo(-7 * s, yb - 11 * s); ctx.lineTo(11 * s, yb); ctx.lineTo(-7 * s, yb + 11 * s); ctx.closePath(); ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(sx * 26 * s, yb - 7 * s); ctx.lineTo(sx * 36 * s, yb); ctx.lineTo(sx * 26 * s, yb + 7 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(sx * 37 * s - 1.5 * s, yb - 7 * s, 3 * s, 14 * s);
  }
  ctx.restore();
}
/** 离场画框：明信片白边 + 邮票齿孔外沿 + 深蓝细线、珊瑚红虚线、四角小星、右上角一组波浪注销线。 */
function postcardFrame(ctx, R) {
  const t = 64 * R.s, { x, y, w, h } = R;
  ctx.save();
  ctx.fillStyle = 'rgba(40,50,70,0.16)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
  const outer = stampEdgePath(x - t, y - t, w + 2 * t, h + 2 * t, t * 0.13, t * 0.42);
  outer.rect(x, y, w, h);
  ctx.shadowColor = 'rgba(40,50,70,0.25)'; ctx.shadowBlur = 12 * R.s; ctx.shadowOffsetY = 4 * R.s;
  ctx.fillStyle = PAPER; ctx.fill(outer, 'evenodd');
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = NAVY; ctx.lineWidth = Math.max(1, 3 * R.s); ctx.strokeRect(x - 2 * R.s, y - 2 * R.s, w + 4 * R.s, h + 4 * R.s);
  ctx.setLineDash([14 * R.s, 9 * R.s]); ctx.strokeStyle = CORAL; ctx.lineWidth = Math.max(1, 3 * R.s);
  ctx.strokeRect(x - t * 0.5, y - t * 0.5, w + t, h + t); ctx.setLineDash([]);
  ctx.fillStyle = CORAL;
  for (const [sx, sy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) { ctx.beginPath(); starPath(ctx, sx, sy, t * 0.28); ctx.fill(); }
  ctx.strokeStyle = rgba(POST_INK, 0.75); ctx.lineWidth = Math.max(1, 4 * R.s); ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    const yy = y - t * 0.78 + k * t * 0.2, xa = x + w - t * 4.4, xb = x + w + t * 0.2;
    ctx.beginPath(); for (let px = xa; px <= xb; px += 4) ctx.lineTo(px, yy + Math.sin((px - xa) / (t * 0.5) * TAU) * t * 0.05); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 场景 ----------
export const s15 = {
  id: 's15',
  station: ST,
  figureStyle: 's15-postcard',
  // 明信片人物外的一圈纸白（套印留边）：在浅天空和沙色原野前也稳稳拉开反差
  figureRim: { color: PAPER, width: 4, alpha: 1 },
  freezeBeat: GAG + 3.9, // Outro 展墙：大邮戳在身上，邮票和两枚小邮戳都已盖好
  figureAdjust(b) {
    const J = jolt(b);
    if (!J.on) return null;
    return { dx: J.dx + (J.cx - CHAR_X) * (1 - J.k), dy: J.dy + (J.cy - ROAD_Y) * (1 - J.k), scale: J.k };
  },
  drawBack(ctx, b, env) {
    const cam = env.cam, cF = env.camAt(GAG);
    ctx.save();
    applyJolt(ctx, jolt(b));
    ctx.fillStyle = SKY_L; ctx.fillRect(X_MIN - 30, -30, X_MAX - X_MIN + 60, 1060);
    drawStrip(ctx, skyLayer(), cam);
    drawStrip(ctx, cloudLayer(), cam - (b * 3) / P_CLOUD);
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, mesaLayer(), cam);
    drawStrip(ctx, plainLayer(), cam);
    drawStrip(ctx, poleLayer(cF), cam);
    drawStrip(ctx, roadsideLayer(cF), cam);
    const sx = 1190 + cF - cam;
    if (sx > X_MIN - 200 && sx < X_MAX + 200) arrowSign(ctx, sx, b);
    drawStrip(ctx, roadLayer(), cam);
    ctx.restore();
  },
  drawFigure(ctx, fig, b, env) {
    drawWalker(ctx, fig);
    // 邮戳：第 10 拍图章抬起后留在他身上，跟着他走；第 13 拍后慢慢淡到七成
    if (b < T_LIFT[0]) return;
    const pose = fig.pose === 'stand' ? 'stand' : 'walk';
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
    // 小车：从身后的近车道超过他
    const c = carState(b, env);
    if (c) { exhaust(ctx, c, b); car(ctx, c.x, c.y, c.s, c.roll, c.wave); }
    // 图章的影子先落到他身上
    if (b >= T_SHADOW && b < T_HIT) {
      const k = smoothstep(T_SHADOW, T_HIT, b), C = chest('stand'), fc = (FACE.x0 + FACE.x1) / 2;
      ctx.save(); ctx.translate(C.x, C.y); ctx.rotate(PM_ROT);
      ctx.fillStyle = rgba(NAVY, 0.28 * k);
      ctx.beginPath(); ctx.ellipse(fc, 0, (FACE.x1 - FACE.x0) * (0.75 + 0.5 * (1 - k)) / 2, 90 * (0.75 + 0.5 * (1 - k)), 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    dent(ctx, b);
    // 明信片表面：邮票 + 两枚小邮戳（固定在画面上）
    drawPostage(ctx, b);
    if (b >= T_HIT2) drawMark(ctx, smallMark(0), SPOT_A.x, SPOT_A.y, SPOT_A.rot, 0.92);
    if (b >= T_HIT3) drawMark(ctx, smallMark(1), SPOT_B.x, SPOT_B.y, SPOT_B.rot, 0.92);
    // 图章
    const S = stampPose(b);
    if (S) rubberStamp(ctx, S.x, S.y, S.rot, S.s, S.squash);
    const C = chest('stand');
    burst(ctx, b, T_HIT, C.x, C.y, PM_ROT, 1);
    burst(ctx, b, T_HIT2, SPOT_A.x, SPOT_A.y, SPOT_A.rot, SMALL);
    burst(ctx, b, T_HIT3, SPOT_B.x, SPOT_B.y, SPOT_B.rot, SMALL);
    ctx.restore();
    // 白边（整张明信片不随「一震」移动）
    ctx.drawImage(postcardOverlay(), X_MIN, 0, X_MAX - X_MIN, 1000);
  },
  drawFrame(ctx, R) { postcardFrame(ctx, R); },
  cardStyle: { ink: NAVY, accent: CORAL, bar: false, bgDraw: (ctx, x, y, w, h) => cardBg(ctx, x, y, w, h) },
  playerStyle: {
    ink: NAVY, noteColor: CORAL, backdrop: true,
    plateDraw: (ctx, x, y, w, h) => songPlate(ctx, x, y, w, h),
    drawPlayer: (ctx, kind, cx, cy, s, spin, P, gb) => postcardPhone(ctx, kind, cx, cy, s, spin, P, gb),
  },
};
