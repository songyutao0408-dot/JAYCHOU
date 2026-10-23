// 第 12 站 · 十二新作（Opus 12, 2012）·「红尘客栈」· 武侠客栈 · 木版年画
// 杨柳青 / 桃花坞一类年画的一般风格：粗黑木刻线（主版）+ 平涂饱和色（大红、桃红、明黄、翠绿、靛蓝），
// 色版比线版向右下错开一点（套色不准），色块上有木纹和印刷不匀的颗粒；暖白纸。
// 构图：纸 + 红日祥云 → 青绿远山 → 城墙城楼 → 桃树绿树 → 粉墙黛瓦的街市（柳树、酒坛、小铺）
//       → 两层客栈（飞檐、匾额、酒旗、红灯笼、大堂里的食客和掌柜）→ 石板路 → 偶尔垂下的桃花枝。
//       酒旗、匾额、灯笼、对联都不写字（空白或纹样）。
// 原创配角：店小二（瓜皮小帽、翠绿短褂、红腰带、白绑腿、肩搭白毛巾、圆脸腮红眯眼笑）、
//       食客甲（红脸络腮胡、黑头巾）、食客乙（桃红袍书生）、掌柜（圆帽八字胡）。
// 梗：第 5.5 拍店小二从客栈门里蹦出来，小碎步迎上；第 9 拍强拍他定格，店小二「啪」地抱拳作揖
//     （速度线 + 明黄光芒 + 小祥云）；之后每拍深鞠一躬；第 10 拍食客起身拱手，第 11 拍掌柜捧出一坛酒，
//     第 12 拍他头边冒一滴汗；第 13–16 拍他走向下一道画框，店小二还在身后作揖。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, makeCanvas, memo } from '../kit/canvas.js';
import { paperTexture } from '../kit/paper.js';
import { rng, hash2 } from '../kit/rng.js';
import { rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { ANCHORS } from '../rig/walker.js';
import { registerStyle, comicBase, luma, rgbf } from '../rig/styles.js';

const ST = stationByN(12);

// ---------- 调色板 ----------
const PAPER = '#f7ecd2', PAPER2 = '#f3e0b4', INK = '#1d1612';
const RED = '#d8352a', RED_D = '#a8261f', PINK = '#f07c98', PINK_L = '#f8b3c2';
const YEL = '#f6c234', YEL_L = '#fbe08a', GRN = '#2f9a57', GRN_L = '#8fcf7e';
const IND = '#2c4f9c', IND_L = '#9cb8e0', STONE = '#eadcbc', STONE_D = '#d8c59c';
const WALL = '#fbf4e2', WOOD = '#8a4b28', SKIN = '#f8d3ac', WHITE = '#fffaf0';

const P_SKY = 0.04, P_MTN = 0.12, P_CITY = 0.24, P_TREE = 0.5, P_FG = 1.3;
const REG = [2.4, 1.8]; // 套色错位（色版相对线版）
const LW = 3.2;         // 主版线宽（单位）

// ---------- 定格时（第 9–12 拍）的画面位置（单位） ----------
const INN = { x0: 455, x1: 1565 };
const PILLARS = [462, 602, 800, 1000, 1200, 1400, 1558];
const DOOR_X = 701;        // 大门正中
const FLAG_X = 438;        // 酒旗杆
const W_STAND = 578;       // 店小二作揖的位置
const DINER_A = 905, DINER_B = 1100, KEEPER = 1300;
const HOOKS = [532, 1000, 1160, 1480]; // 一层檐下的灯笼
const INN_BOX = { x0: 380, x1: 1650, y0: 150, y1: 806 };

// ---------- 时间点（段内拍位） ----------
const T_POP = [GAG - 3.6, GAG - 2.9];    // 第 5.4–6.1 拍：从门里蹦出来
const T_TROT = [GAG - 2.9, GAG - 0.5];   // 小碎步迎上来
const T_SALUTE = GAG;                    // 第 9 拍（第 3 小节强拍）：「啪」
const T_RISE_A = [GAG + 0.7, GAG + 1];   // 第 10 拍：食客甲起身
const T_RISE_B = [GAG + 1.2, GAG + 1.5]; // 食客乙起身
const T_JAR = [GAG + 1.55, GAG + 2];     // 第 11 拍：掌柜捧出酒坛
const T_SWEAT = [GAG + 2.6, GAG + 4.1];  // 第 12 拍：一滴汗
const T_SIT = [GAG + 4.7, GAG + 5.4];    // 食客坐回

// ---------- 基础：年画式的形状（色版错开 + 黑线） ----------
const pathOf = (fn) => { const p = new Path2D(); fn(p); return p; };
const rectP = (x, y, w, h) => pathOf((p) => p.rect(x, y, w, h));
const ellP = (x, y, rx, ry, rot = 0) => pathOf((p) => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));
const circP = (x, y, r) => ellP(x, y, r, r);
const polyP = (pts, close = true) => pathOf((p) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); });

/** 色块错开一点再描主版黑线。reg：错位倍数（0 = 不错位）。 */
function nh(ctx, path, fill, { line = LW, reg = 1, ink = INK } = {}) {
  if (fill) {
    ctx.save();
    if (reg) ctx.translate(REG[0] * reg, REG[1] * reg);
    ctx.fillStyle = fill; ctx.fill(path);
    ctx.restore();
  }
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); }
}
/** 多个圆拼成的形状（祥云、树冠）：只描外轮廓，色版错开但不出界。 */
function nhUnion(ctx, path, fill, { line = LW, under = PAPER } = {}) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.lineWidth = line * 2; ctx.stroke(path);
  ctx.fillStyle = under; ctx.fill(path);
  ctx.clip(path);
  ctx.translate(REG[0], REG[1]); ctx.fillStyle = fill; ctx.fill(path);
  ctx.restore();
}
function strokeLine(ctx, pts, w = LW, color = INK) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}
/** 粗细两端圆头的「管子」（袖子、裤腿），返回 Path2D。 */
function tubeP(pts, radii) {
  const p = new Path2D(), n = pts.length, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
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

// ---------- 木纹与印刷不匀：叠在已经印上的颜色上（source-atop，纸面不脏） ----------
function woodTile() {
  return memo('s12-woodtile', () => {
    const S = 256, c = makeCanvas(S, S), x = c.getContext('2d'), im = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      // 横向木纹：对 i、j 都是周期的，平铺无接缝
      const v = Math.sin(TAU * ((23 * j) / S + 0.9 * Math.sin(TAU * ((3 * i) / S + j / S)) + 0.3 * Math.sin(TAU * ((7 * i) / S + (5 * j) / S))));
      const gate = 0.5 + 0.5 * Math.sin(TAU * ((2 * i) / S + (3 * j) / S)) * Math.sin(TAU * ((5 * j) / S - i / S)); // 木纹断断续续
      const h = hash2(i, j, 12);
      const k = (j * S + i) * 4;
      if (h < 0.035) { im.data[k] = 255; im.data[k + 1] = 248; im.data[k + 2] = 230; im.data[k + 3] = 150; } // 漏印的白点
      else {
        const a = (v > 0.9 ? (v - 0.9) * 4 : 0) * 0.32 * gate + (h > 0.965 ? 0.35 : 0);
        im.data[k] = 40; im.data[k + 1] = 22; im.data[k + 2] = 14; im.data[k + 3] = a * 255;
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  });
}
function inkTexture(ctx, x0, y0, w, h, alpha = 0.55) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(woodTile(), 'repeat');
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}

// ---------- 纹样：回纹、团花、祥云 ----------
/** 回纹带：从 (x, y) 起向右长 len、高 h。 */
function huiwen(ctx, x, y, len, h, color, lw = h * 0.13) {
  const u = h * 1.05, n = Math.max(1, Math.floor(len / u)), o = x + (len - n * u) / 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ox = o + i * u;
    ctx.moveTo(ox, y + h); ctx.lineTo(ox, y); ctx.lineTo(ox + 0.82 * u, y); ctx.lineTo(ox + 0.82 * u, y + 0.72 * h);
    ctx.lineTo(ox + 0.3 * u, y + 0.72 * h); ctx.lineTo(ox + 0.3 * u, y + 0.34 * h); ctx.lineTo(ox + 0.58 * u, y + 0.34 * h);
  }
  ctx.moveTo(o, y + h); ctx.lineTo(o + n * u, y + h);
  ctx.stroke();
  ctx.restore();
}
/** 团花：叶、外瓣、内瓣、花心。 */
function tuanhua(ctx, cx, cy, r, { n = 8, petal = PINK, inner = RED, leaf = GRN, core = YEL, lw = 2, rot = 0, reg = 0.6 } = {}) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  for (let i = 0; i < n; i++) { const a = ((i + 0.5) * TAU) / n; nh(ctx, ellP(Math.cos(a) * r * 0.68, Math.sin(a) * r * 0.68, r * 0.34, r * 0.12, a), leaf, { line: lw, reg }); }
  for (let i = 0; i < n; i++) { const a = (i * TAU) / n; nh(ctx, ellP(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5, r * 0.36, r * 0.24, a), petal, { line: lw, reg }); }
  for (let i = 0; i < n; i++) { const a = ((i + 0.5) * TAU) / n; nh(ctx, ellP(Math.cos(a) * r * 0.27, Math.sin(a) * r * 0.27, r * 0.17, r * 0.1, a), inner, { line: lw * 0.8, reg }); }
  nh(ctx, circP(0, 0, r * 0.16), core, { line: lw, reg });
  ctx.restore();
}
function spiral(ctx, cx, cy, r, { turns = 1.25, a0 = 2.4, dir = 1, lw = 2 } = {}) {
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, a = a0 + dir * t * turns * TAU, rr = r * (1 - t * 0.78);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}
const CLOUD_LOBES = [[-58, 6, 22], [-26, -12, 31], [16, -18, 28], [50, -2, 22], [4, 10, 24], [-34, 12, 18]];
/** 祥云：几团卷云拼成，底下拖一道云尾。 */
function xiangyun(ctx, x, y, s, fill, { lw = LW, flip = 1 } = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flip * s, s);
  const p = new Path2D();
  for (const [dx, dy, r] of CLOUD_LOBES) { p.moveTo(dx + r, dy); p.arc(dx, dy, r, 0, TAU); }
  // 云尾
  p.moveTo(60, 14); p.quadraticCurveTo(100, 22, 128, 6); p.quadraticCurveTo(110, 26, 60, 30); p.closePath();
  const L = lw / s;
  nhUnion(ctx, p, fill, { line: L });
  for (const [dx, dy, r, d] of [[-26, -12, 31, 1], [16, -18, 28, -1], [-58, 6, 22, 1], [50, -2, 22, -1]]) spiral(ctx, dx, dy + 2, r * 0.62, { dir: d, lw: L * 0.75, a0: d > 0 ? 2.6 : 0.6 });
  ctx.restore();
}

// ---------- 纸 ----------
const paper = () => paperTexture(Math.ceil((X_MAX - X_MIN) * K), Math.ceil(1000 * K), { base: PAPER, seed: 12, amount: 1.1 });

// ---------- 天空：红日、祥云 ----------
function skyLayer() {
  return strip('s12-sky', P_SKY, (ctx, x0, x1) => {
    // 红日（右上）
    const sx = 1010 + 1250 * P_SKY;
    nh(ctx, circP(sx, 128, 66), YEL_L, { line: LW });
    nh(ctx, circP(sx, 128, 50), RED, { line: LW });
    ctx.fillStyle = rgba(YEL_L, 0.85); ctx.beginPath(); ctx.ellipse(sx - 18, 110, 12, 7, -0.6, 0, TAU); ctx.fill();
    const R = rng('s12-sky');
    const cols = [IND_L, PINK_L, YEL_L, '#bfe0c8'];
    let i = 0;
    for (let x = x0 + 60; x < x1; x += 300 + R() * 240) {
      const y = 70 + R() * 150, s = 0.55 + R() * 0.35;
      if (Math.abs(x - sx) < 160 && y < 220) continue;
      xiangyun(ctx, x, y, s, cols[i++ % cols.length], { flip: R() < 0.5 ? -1 : 1 });
    }
    inkTexture(ctx, x0, 0, x1 - x0, 300, 0.5);
  }, { y0: 0, y1: 300 });
}

// ---------- 青绿远山 ----------
function peak(ctx, cx, base, w, h, cols, R) {
  const lean = (R() - 0.5) * 0.25 * w;
  const p = new Path2D();
  p.moveTo(cx - w / 2, base);
  p.bezierCurveTo(cx - w * 0.36, base - h * 0.5, cx - w * 0.24 + lean, base - h * 1.04, cx + lean * 0.5, base - h);
  p.bezierCurveTo(cx + w * 0.24 + lean, base - h * 0.98, cx + w * 0.36, base - h * 0.48, cx + w / 2, base);
  p.closePath();
  ctx.save();
  ctx.translate(REG[0], REG[1]);
  ctx.fillStyle = cols[2]; ctx.fill(p);
  ctx.clip(p);
  // 色带：上靛下绿，交界是起伏的线（平涂，不做渐变）
  const band = (y, color) => {
    const q = new Path2D();
    q.moveTo(cx - w, base - h - 20);
    q.lineTo(cx + w, base - h - 20);
    for (let k = 0; k <= 12; k++) { const xx = cx + w - (k / 12) * 2 * w; q.lineTo(xx, y + Math.sin(k * 1.7 + cx * 0.01) * 8); }
    q.closePath();
    ctx.fillStyle = color; ctx.fill(q);
  };
  band(base - h * 0.45, cols[1]);
  band(base - h * 0.78, cols[0]);
  ctx.restore();
  nh(ctx, p, null, { line: LW });
  // 皴线：几道从山顶垂下的弧线
  ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
  for (const k of [-1, 1]) {
    const sx = cx + lean * 0.45 + k * w * 0.09, sy = base - h * 0.84;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + k * w * 0.05, sy + h * 0.12, sx + k * w * 0.1, sy + h * 0.2); ctx.stroke();
  }
}
function mountainLayer() {
  return strip('s12-mtn', P_MTN, (ctx, x0, x1) => {
    const R = rng('s12-mtn');
    const rows = [
      { base: 560, w: [300, 420], h: [200, 260], cols: ['#6f95d0', '#7cc3a4', '#d3ecc6'] },
      { base: 590, w: [240, 340], h: [130, 190], cols: ['#4f9a6f', '#86ca7a', '#e3f1bd'] },
    ];
    for (const row of rows) {
      let x = x0 - 80 + R() * 100;
      while (x < x1 + 120) {
        const w = row.w[0] + R() * (row.w[1] - row.w[0]), h = row.h[0] + R() * (row.h[1] - row.h[0]);
        peak(ctx, x, row.base, w, h, row.cols, R);
        x += w * (0.5 + R() * 0.25);
      }
    }
    // 山腰的一道白云
    for (let x = x0 + 40; x < x1; x += 260 + R() * 160) xiangyun(ctx, x, 470 + R() * 30, 0.5 + R() * 0.2, WHITE, { flip: R() < 0.5 ? -1 : 1 });
    inkTexture(ctx, x0, 260, x1 - x0, 360, 0.55);
  }, { y0: 260, y1: 600 });
}

// ---------- 城墙、城楼 ----------
function eaveRoof(ctx, xa, xb, ridgeY, eaveY, { flare = 36, inset = 0.22, color = IND, ridge = GRN, lw = LW } = {}) {
  // 歇山 / 庑殿式的屋顶：脊、两侧斜脊、起翘的檐角
  const w = xb - xa, ra = xa + w * inset, rb = xb - w * inset;
  const p = new Path2D();
  p.moveTo(ra, ridgeY);
  p.lineTo(rb, ridgeY);
  p.quadraticCurveTo(xb - w * 0.04, eaveY - (eaveY - ridgeY) * 0.25, xb + flare, eaveY - flare * 0.8);
  p.quadraticCurveTo(xb - flare * 0.4, eaveY + 2, xb - flare * 1.6, eaveY);
  p.lineTo(xa + flare * 1.6, eaveY);
  p.quadraticCurveTo(xa + flare * 0.4, eaveY + 2, xa - flare, eaveY - flare * 0.8);
  p.quadraticCurveTo(xa + w * 0.04, eaveY - (eaveY - ridgeY) * 0.25, ra, ridgeY);
  p.closePath();
  nh(ctx, p, color, { line: lw });
  // 瓦垄
  ctx.save();
  ctx.clip(p);
  ctx.strokeStyle = rgba(INK, 0.75); ctx.lineWidth = Math.max(1, lw * 0.4);
  const n = Math.round(w / 16);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    ctx.beginPath(); ctx.moveTo(lerp(ra, rb, t), ridgeY); ctx.lineTo(lerp(xa - flare * 0.4, xb + flare * 0.4, t), eaveY + 4); ctx.stroke();
  }
  ctx.restore();
  // 檐口：瓦当一排黄点
  ctx.fillStyle = YEL;
  for (let x = xa + flare * 1.2; x < xb - flare * 1.2; x += 15) { ctx.beginPath(); ctx.arc(x, eaveY - 3, Math.max(1.5, lw * 0.75), 0, TAU); ctx.fill(); }
  // 正脊
  const rh = Math.max(6, (eaveY - ridgeY) * 0.14);
  nh(ctx, rectP(ra - 6, ridgeY - rh, rb - ra + 12, rh), ridge, { line: lw });
  ctx.strokeStyle = YEL; ctx.lineWidth = Math.max(1.5, lw * 0.6);
  ctx.beginPath(); ctx.moveTo(ra - 2, ridgeY - rh * 0.55); ctx.lineTo(rb + 2, ridgeY - rh * 0.55); ctx.stroke();
  // 脊头卷草
  for (const [x, d] of [[ra - 6, -1], [rb + 6, 1]]) {
    nh(ctx, circP(x + d * rh * 0.3, ridgeY - rh * 1.3, rh * 0.75), YEL, { line: lw * 0.8 });
    spiral(ctx, x + d * rh * 0.3, ridgeY - rh * 1.3, rh * 0.55, { dir: d, lw: lw * 0.6 });
  }
  return p;
}
function cityLayer() {
  return strip('s12-city', P_CITY, (ctx, x0, x1) => {
    const WALLC = '#f2cd8f', BRICK = '#cf9f5f';
    // 城墙
    const body = rectP(x0 - 10, 500, x1 - x0 + 20, 110);
    nh(ctx, body, WALLC, { line: LW });
    ctx.strokeStyle = BRICK; ctx.lineWidth = 1.6;
    for (let y = 520; y < 610; y += 18) {
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      for (let x = x0 + ((y / 18) % 2) * 20; x < x1; x += 40) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 18); ctx.stroke(); }
    }
    for (let x = x0; x < x1; x += 30) nh(ctx, rectP(x, 486, 17, 15), WALLC, { line: 2.4 });
    // 城楼（定格时一座在画面左后方）
    const towers = [];
    for (let x = 140 + 1250 * P_CITY - 1150; x < x1 + 200; x += 1150) towers.push(x);
    for (const tx of towers) {
      if (tx < x0 - 200) continue;
      nh(ctx, rectP(tx - 150, 470, 300, 140), WALLC, { line: LW });
      for (let x = tx - 150; x < tx + 150; x += 30) nh(ctx, rectP(x, 457, 17, 14), WALLC, { line: 2.4 });
      // 下层殿身
      nh(ctx, rectP(tx - 108, 400, 216, 58), PAPER, { line: LW });
      for (let k = 0; k < 6; k++) nh(ctx, rectP(tx - 104 + k * 40, 400, 10, 58), RED, { line: 2 });
      nh(ctx, rectP(tx - 112, 446, 224, 12), RED_D, { line: 2.4 });
      eaveRoof(ctx, tx - 140, tx + 140, 372, 404, { flare: 22, inset: 0.18, lw: 2.6 });
      // 上层
      nh(ctx, rectP(tx - 72, 338, 144, 36), PAPER, { line: 2.6 });
      for (let k = 0; k < 4; k++) nh(ctx, rectP(tx - 68 + k * 44, 338, 9, 36), RED, { line: 2 });
      eaveRoof(ctx, tx - 108, tx + 108, 290, 342, { flare: 24, inset: 0.24, lw: 2.6 });
    }
    inkTexture(ctx, x0, 280, x1 - x0, 340, 0.5);
  }, { y0: 270, y1: 620 });
}

// ---------- 桃树、绿树 ----------
function canopy(ctx, cx, cy, r, fill, R, dots) {
  const p = new Path2D();
  const n = 5 + Math.floor(R() * 3);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * TAU + R() * 0.4, d = r * (0.45 + R() * 0.2), rr = r * (0.42 + R() * 0.18);
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.7;
    p.moveTo(x + rr, y); p.arc(x, y, rr, 0, TAU);
  }
  p.moveTo(cx + r * 0.6, cy); p.arc(cx, cy, r * 0.6, 0, TAU);
  nhUnion(ctx, p, fill, { line: 2.8 });
  if (dots) {
    ctx.save(); ctx.clip(p);
    for (let k = 0; k < 26; k++) {
      const a = R() * TAU, d = R() * r * 0.95;
      const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.75;
      ctx.fillStyle = dots[k % dots.length];
      ctx.beginPath(); ctx.arc(x, y, 3.5 + R() * 3, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
function treeLayer() {
  return strip('s12-trees', P_TREE, (ctx, x0, x1) => {
    const R = rng('s12-trees');
    for (let x = x0 + R() * 60; x < x1; x += 120 + R() * 150) {
      const peach = R() < 0.4, r = 46 + R() * 26, cy = 520 + R() * 30;
      nh(ctx, polyP([[x - 6, 780], [x - 4, cy + 10], [x + 4, cy + 10], [x + 7, 780]]), WOOD, { line: 2.4 });
      canopy(ctx, x, cy, r, peach ? PINK_L : '#5fb36a', R, peach ? [PINK, RED] : ['#3f9a55', GRN_L]);
    }
    inkTexture(ctx, x0, 420, x1 - x0, 380, 0.5);
  }, { y0: 420, y1: 800 });
}

// ---------- 街市：粉墙黛瓦、小铺、柳树、酒坛 ----------
function tileCoping(ctx, xa, xb, y) {
  nh(ctx, rectP(xa - 6, y, xb - xa + 12, 18), IND, { line: 2.6 });
  nh(ctx, rectP(xa - 2, y - 8, xb - xa + 4, 9), '#3d5f9e', { line: 2.2 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  for (let x = xa; x < xb; x += 13) { ctx.beginPath(); ctx.arc(x + 6, y + 18, 5, 0, Math.PI); ctx.stroke(); }
}
function wallSeg(ctx, xa, xb, R) {
  nh(ctx, rectP(xa, 600, xb - xa, 192), WALL, { line: LW, reg: 0 });
  nh(ctx, rectP(xa, 768, xb - xa, 24), STONE_D, { line: 2.4 });
  tileCoping(ctx, xa, xb, 584);
  // 花窗（扇面 / 圆 / 方）
  for (let x = xa + 120 + R() * 80; x < xb - 100; x += 300 + R() * 200) {
    const kind = Math.floor(R() * 3);
    let p;
    if (kind === 0) p = circP(x, 668, 34);
    else if (kind === 1) p = pathOf((q) => { q.moveTo(x - 48, 690); q.arc(x, 712, 52, Math.PI * 1.22, Math.PI * 1.78); q.lineTo(x + 24, 700); q.arc(x, 712, 26, Math.PI * 1.78, Math.PI * 1.22, true); q.closePath(); });
    else p = rectP(x - 30, 640, 60, 54);
    nh(ctx, p, PAPER2, { line: 7, ink: GRN, reg: 0 });
    ctx.save(); ctx.clip(p);
    ctx.strokeStyle = GRN; ctx.lineWidth = 2.4;
    for (let k = -80; k < 80; k += 12) { ctx.beginPath(); ctx.moveTo(x + k, 620); ctx.lineTo(x + k + 60, 720); ctx.moveTo(x + k, 720); ctx.lineTo(x + k + 60, 620); ctx.stroke(); }
    ctx.restore();
    nh(ctx, p, null, { line: 2 });
  }
}
function jar(ctx, cx, yb, h, body = '#b8692e') {
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
  // 封口红布 + 空白红签（菱形）
  nh(ctx, ellP(cx, yb - h, w * 0.3, h * 0.1), RED, { line: 2.2 });
  nh(ctx, polyP([[cx, yb - h * 0.72], [cx + h * 0.18, yb - h * 0.52], [cx, yb - h * 0.32], [cx - h * 0.18, yb - h * 0.52]]), RED, { line: 2 });
  ctx.strokeStyle = rgba(YEL_L, 0.9); ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx - w * 0.2, yb - h * 0.55, h * 0.22, 3.4, 4.3); ctx.stroke();
}
function jarStack(ctx, x) {
  for (const [dx, yb, h] of [[-48, 792, 56], [0, 792, 60], [48, 792, 56], [-24, 738, 52], [24, 738, 52], [0, 688, 48]]) jar(ctx, x + dx, yb, h);
}
function willow(ctx, x, R) {
  const top = 452;
  nh(ctx, polyP([[x - 14, 800], [x - 8, 640], [x - 20, 520], [x - 4, top], [x + 8, top], [x + 4, 540], [x + 12, 640], [x + 14, 800]]), WOOD, { line: LW });
  // 垂下的柳条：先描黑再上绿
  const strands = [];
  for (let k = 0; k < 30; k++) {
    const sx = x + (R() - 0.5) * 150, sy = top + R() * 40 - 10;
    const ex = sx + (sx - x) * 0.6 + (R() - 0.5) * 30, ey = 620 + R() * 110;
    strands.push([sx, sy, (sx + ex) / 2 + (sx - x) * 0.5, sy - 30, ex, ey]);
  }
  for (const [w, c] of [[6.4, INK], [3.4, '#4caf5f']]) {
    ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round';
    for (const [sx, sy, cx, cy, ex, ey] of strands) { ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(cx, cy, ex, ey); ctx.stroke(); }
  }
  // 树冠
  canopy(ctx, x, top - 8, 70, '#5fb36a', R, ['#3f9a55', GRN_L]);
}
function shop(ctx, xa, xb, R, kind) {
  const w = xb - xa;
  nh(ctx, rectP(xa + 10, 520, w - 20, 272), PAPER2, { line: LW, reg: 0 });
  nh(ctx, rectP(xa, 768, w, 24), STONE_D, { line: 2.4 });
  // 雨棚（靛蓝白条、荷叶边）
  const aw = pathOf((p) => { p.moveTo(xa - 10, 540); p.lineTo(xb + 10, 540); p.lineTo(xb + 22, 582); for (let x = xb + 22; x > xa - 22; x -= 30) p.quadraticCurveTo(x - 15, 598, x - 30, 582); p.closePath(); });
  nh(ctx, aw, IND, { line: LW });
  ctx.save(); ctx.translate(REG[0], REG[1]); ctx.clip(aw);
  ctx.fillStyle = WHITE; for (let x = xa - 10; x < xb + 20; x += 30) ctx.fillRect(x, 536, 12, 70);
  ctx.restore();
  nh(ctx, aw, null, { line: LW });
  eaveRoof(ctx, xa - 20, xb + 20, 448, 514, { flare: 26, inset: 0.16, lw: LW });
  nh(ctx, rectP(xa + 4, 512, w - 8, 28), RED_D, { line: 2.6 });
  for (const px of [xa + 8, xb - 8]) nh(ctx, rectP(px - 9, 598, 18, 192), RED, { line: 2.6 });
  // 柜台和货
  nh(ctx, rectP(xa + 30, 700, w - 60, 92), YEL, { line: LW });
  huiwen(ctx, xa + 40, 712, w - 80, 16, RED, 2.6);
  nh(ctx, rectP(xa + 24, 690, w - 48, 12), WOOD, { line: 2.6 });
  if (kind === 0) {
    // 蒸笼
    for (const cx of [xa + w * 0.32, xa + w * 0.66]) for (let k = 0; k < 3; k++) nh(ctx, rectP(cx - 34, 668 - k * 22, 68, 22), '#e3b867', { line: 2.4 });
    for (const cx of [xa + w * 0.32, xa + w * 0.66]) nh(ctx, ellP(cx, 602, 36, 9), '#e3b867', { line: 2.4 });
  } else {
    // 布匹
    const cols = [PINK, GRN_L, YEL_L, IND_L, RED];
    for (let k = 0; k < 5; k++) nh(ctx, ellP(xa + 60 + k * (w - 120) / 4, 664, 22, 24), cols[k], { line: 2.4 });
    for (let k = 0; k < 4; k++) nh(ctx, ellP(xa + 82 + k * (w - 120) / 4, 624, 20, 22), cols[(k + 2) % 5], { line: 2.4 });
  }
  // 挂着的小红灯笼（静止）
  for (const lx of [xa + 40, xb - 40]) {
    strokeLine(ctx, [[lx, 590], [lx, 604]], 2);
    nh(ctx, ellP(lx, 626, 17, 21), RED, { line: 2.4 });
    nh(ctx, rectP(lx - 8, 602, 16, 5), YEL, { line: 1.6 });
  }
}
function streetLayer(cg) {
  return strip('s12-street', 1, (ctx, x0, x1) => {
    const R = rng('s12-street');
    const fx = (x) => x + cg; // 定格画面坐标 → 层内坐标
    const skipA = fx(INN.x0 + 10), skipB = fx(INN.x1 - 10);
    const shops = [[fx(-1520), fx(-1200), 0], [fx(-700), fx(-420), 1], [fx(1860), fx(2160), 0], [fx(2700), fx(3000), 1]];
    // 粉墙铺满（客栈和小铺之外）
    const cuts = [[skipA, skipB], ...shops.map(([a, b]) => [a, b])].sort((a, b) => a[0] - b[0]);
    let x = x0;
    for (const [a, b] of cuts) { if (a > x) wallSeg(ctx, x, a, R); x = Math.max(x, b); }
    if (x < x1) wallSeg(ctx, x, x1, R);
    shops.forEach(([a, b, k]) => shop(ctx, a, b, R, k));
    for (const w of [-1000, 100, 1720, 2480]) willow(ctx, fx(w), R);
    for (const j of [-820, -150, 2330]) jarStack(ctx, fx(j));
    inkTexture(ctx, x0, 380, x1 - x0, 420, 0.5);
  }, { y0: 380, y1: 800 });
}

// ---------- 石板路 ----------
function roadLayer() {
  return strip('s12-road', 1, (ctx, x0, x1) => {
    const R = rng('s12-road');
    nh(ctx, rectP(x0, 800, x1 - x0, 200), STONE, { line: 0, reg: 0 });
    const rows = [[800, 828], [828, 864], [864, 910], [910, 966], [966, 1004]];
    const tints = [STONE, '#efe3c6', '#e3d2ad', '#f2e6cb', '#e6d8b8'];
    for (const [ya, yb] of rows) {
      let x = x0 - R() * 100;
      while (x < x1) {
        const w = (yb - ya) * (2.4 + R() * 1.6);
        nh(ctx, rectP(x, ya, w, yb - ya), tints[Math.floor(R() * tints.length)], { line: 2.2, reg: 0.6 });
        if (R() < 0.12) { ctx.strokeStyle = GRN; ctx.lineWidth = 2.2; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(x + 2 + k * 3, yb); ctx.lineTo(x - 2 + k * 5, yb - 9); ctx.stroke(); } }
        x += w;
      }
    }
    ctx.fillStyle = INK; ctx.fillRect(x0, 798, x1 - x0, 4.5);
    inkTexture(ctx, x0, 800, x1 - x0, 200, 0.45);
  }, { y0: 796, y1: 1000 });
}

// ---------- 前景：垂下的桃花枝 ----------
function blossom(ctx, x, y, r, rot) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const p = new Path2D();
  for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU; p.moveTo(Math.cos(a) * r * 0.55 + r * 0.45, Math.sin(a) * r * 0.55); p.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.45, 0, TAU); }
  nhUnion(ctx, p, PINK_L, { line: 2.2 });
  nh(ctx, circP(0, 0, r * 0.28), RED, { line: 1.6, reg: 0.4 });
  ctx.fillStyle = YEL; for (let k = 0; k < 5; k++) { const a = (k / 5) * TAU + 0.6; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 1.8, 0, TAU); ctx.fill(); }
  ctx.restore();
}
function fgLayer(cg) {
  return strip('s12-fg', P_FG, (ctx, x0, x1) => {
    const R = rng('s12-fg');
    for (const bx of [1240, -900, 2300, 3300]) {
      const x = bx + cg * P_FG;
      if (x < x0 - 300 || x > x1 + 300) continue;
      const pts = [[x + 120, -20], [x + 40, 70], [x - 40, 130], [x - 140, 170]];
      ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); ctx.stroke();
      ctx.strokeStyle = WOOD; ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(...pts[0]); ctx.bezierCurveTo(...pts[1], ...pts[2], ...pts[3]); ctx.stroke();
      const twigs = [[x + 30, 80, x - 10, 200], [x - 60, 140, x - 70, 230], [x + 70, 30, x + 110, 120]];
      for (const [ax, ay, bx2, by] of twigs) {
        ctx.strokeStyle = INK; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by); ctx.stroke();
        ctx.strokeStyle = WOOD; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by); ctx.stroke();
      }
      for (let k = 0; k < 13; k++) {
        const t = R();
        const tw = twigs[k % 3];
        const px = k < 6 ? lerp(x + 100, x - 130, t) : lerp(tw[0], tw[2], t), py = k < 6 ? lerp(-10, 165, t) + (R() - 0.5) * 30 : lerp(tw[1], tw[3], t);
        blossom(ctx, px + (R() - 0.5) * 20, py, 13 + R() * 8, R() * TAU);
      }
      for (let k = 0; k < 6; k++) nh(ctx, ellP(x - 100 + R() * 220, 20 + R() * 180, 10, 5, R() * TAU), GRN, { line: 2 });
    }
    inkTexture(ctx, x0, 0, x1 - x0, 260, 0.4);
  }, { y0: 0, y1: 260 });
}

// ---------- 客栈（烘焙成两张：大堂里面 / 门面） ----------
function innImage(part) {
  const B = INN_BOX;
  return baked(`s12-inn-${part}`, (B.x1 - B.x0) * K, (B.y1 - B.y0) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-B.x0, -B.y0);
    if (part === 'back') innBack(ctx); else innFront(ctx);
    inkTexture(ctx, B.x0, B.y0, B.x1 - B.x0, B.y1 - B.y0, 0.5);
  });
}
function innBack(ctx) {
  // 大堂后墙、地面
  nh(ctx, rectP(470, 548, 1090, 240), '#f9e7b8', { line: LW, reg: 0 });
  nh(ctx, rectP(470, 760, 1090, 28), '#e7cf9f', { line: 2.4, reg: 0 });
  // 门里的屏风：牡丹
  for (let k = 0; k < 3; k++) {
    const x = 628 + k * 50;
    nh(ctx, rectP(x, 592, 48, 168), PAPER, { line: 2.6 });
    nh(ctx, rectP(x + 5, 598, 38, 156), WHITE, { line: 1.6, reg: 0 });
  }
  for (const [x, y, r] of [[662, 650, 18], [716, 628, 22], [742, 690, 16], [690, 706, 14]]) {
    for (const [dx, dy, a] of [[-16, 10, -0.6], [16, 12, 0.6], [0, 18, 1.5]]) nh(ctx, ellP(x + dx, y + dy, r * 0.7, r * 0.3, a), GRN, { line: 1.8, reg: 0.5 });
    tuanhua(ctx, x, y, r, { n: 7, petal: PINK, inner: RED, leaf: PINK_L, core: YEL, lw: 1.6, reg: 0.5 });
  }
  strokeLine(ctx, [[700, 760], [700, 720], [690, 690]], 2.4, GRN);
  // 挂画（无字的山水小景）
  for (const x of [870, 1070]) {
    nh(ctx, rectP(x, 578, 70, 104), IND_L, { line: 2.4 });
    nh(ctx, rectP(x + 8, 590, 54, 78), PAPER, { line: 1.6, reg: 0 });
    nh(ctx, polyP([[x + 10, 660], [x + 26, 618], [x + 40, 660]]), '#7cc3a4', { line: 1.6 });
    nh(ctx, polyP([[x + 28, 664], [x + 44, 630], [x + 60, 664]]), '#6f95d0', { line: 1.6 });
    nh(ctx, circP(x + 48, 606, 6), RED, { line: 1.4 });
    nh(ctx, rectP(x - 4, 574, 78, 6), WOOD, { line: 1.6 });
  }
  // 柜台后的货架和酒坛
  nh(ctx, rectP(1212, 566, 184, 124), '#e9c98c', { line: 2.6, reg: 0 });
  for (const y of [612, 662]) nh(ctx, rectP(1212, y, 184, 8), WOOD, { line: 2.2 });
  for (let k = 0; k < 4; k++) jar(ctx, 1236 + k * 44, 612, 36, k % 2 ? '#c2773a' : '#a95f2a');
  for (let k = 0; k < 4; k++) jar(ctx, 1236 + k * 44, 662, 36, k % 2 ? '#a95f2a' : '#c2773a');
}
function table(ctx, cx) {
  nh(ctx, rectP(cx - 66, 708, 132, 12), RED_D, { line: 2.6 });
  nh(ctx, rectP(cx - 58, 720, 116, 14), RED, { line: 2.4 });
  for (const lx of [cx - 56, cx + 47]) nh(ctx, rectP(lx, 734, 9, 52), RED_D, { line: 2.2 });
  // 碗、酒盅、茶壶
  nh(ctx, pathOf((p) => { p.moveTo(cx - 48, 698); p.quadraticCurveTo(cx - 34, 716, cx - 20, 698); p.closePath(); }), WHITE, { line: 2 });
  strokeLine(ctx, [[cx - 47, 701], [cx - 21, 701]], 2.4, IND);
  nh(ctx, rectP(cx - 6, 698, 10, 10), WHITE, { line: 1.8 });
  nh(ctx, ellP(cx + 34, 696, 16, 12), IND_L, { line: 2 });
  strokeLine(ctx, [[cx + 18, 694], [cx + 8, 686]], 2.6);
  nh(ctx, ellP(cx + 34, 683, 6, 3), IND, { line: 1.6 });
}
function innFront(ctx) {
  // 台基
  nh(ctx, rectP(440, 786, 1140, 14), STONE_D, { line: 2.6 });
  nh(ctx, rectP(612, 782, 178, 10), STONE, { line: 2.2 });
  // 左：花格窗间
  nh(ctx, rectP(470, 700, 126, 86), PAPER2, { line: 2.6, reg: 0 });
  nh(ctx, rectP(480, 712, 106, 62), YEL_L, { line: 2 });
  tuanhua(ctx, 533, 743, 22, { lw: 1.6 });
  const win = rectP(470, 566, 126, 134);
  nh(ctx, win, PAPER, { line: 0, reg: 0 });
  ctx.save(); ctx.clip(win);
  ctx.strokeStyle = RED_D; ctx.lineWidth = 2.6;
  for (let k = -140; k < 160; k += 18) { ctx.beginPath(); ctx.moveTo(470 + k, 566); ctx.lineTo(600 + k, 700); ctx.moveTo(600 + k, 566); ctx.lineTo(470 + k, 700); ctx.stroke(); }
  ctx.restore();
  nh(ctx, win, null, { line: 7, ink: RED });
  nh(ctx, win, null, { line: 2 });
  // 右：粉墙 + 月洞窗
  nh(ctx, rectP(1406, 556, 152, 230), WALL, { line: 2.6, reg: 0 });
  const moon = circP(1482, 652, 52);
  nh(ctx, moon, PAPER2, { line: 0, reg: 0 });
  ctx.save(); ctx.clip(moon);
  ctx.strokeStyle = GRN; ctx.lineWidth = 2.6;
  for (let k = -60; k <= 60; k += 15) { ctx.beginPath(); ctx.moveTo(1482 + k, 596); ctx.lineTo(1482 + k, 710); ctx.moveTo(1424, 652 + k); ctx.lineTo(1540, 652 + k); ctx.stroke(); }
  ctx.restore();
  nh(ctx, moon, null, { line: 10, ink: GRN });
  nh(ctx, moon, null, { line: 2.2 });
  nh(ctx, circP(1482, 652, 57), null, { line: 2.2 });
  // 两张桌子
  table(ctx, 910); table(ctx, 1105);
  // 柜台 + 算盘
  nh(ctx, rectP(1218, 696, 174, 90), RED, { line: LW });
  nh(ctx, rectP(1226, 702, 158, 18), YEL, { line: 2 });
  huiwen(ctx, 1230, 704, 150, 13, RED, 2.2);
  tuanhua(ctx, 1305, 752, 24, { lw: 1.8 });
  nh(ctx, rectP(1208, 684, 194, 14), WOOD, { line: 2.6 });
  nh(ctx, rectP(1330, 662, 58, 22), RED_D, { line: 2.4 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(1336 + k * 9.5, 664); ctx.lineTo(1336 + k * 9.5, 682); ctx.stroke(); }
  for (let k = 0; k < 6; k++) for (const y of [668, 677]) { ctx.fillStyle = k % 2 ? YEL : YEL_L; ctx.beginPath(); ctx.ellipse(1336 + k * 9.5, y, 4, 2.6, 0, 0, TAU); ctx.fill(); ctx.stroke(); }
  // 大堂栏杆
  for (const [a, b] of [[811, 989], [1011, 1189]]) {
    nh(ctx, rectP(a, 750, b - a, 28), YEL_L, { line: 2.2 });
    huiwen(ctx, a + 4, 754, b - a - 8, 18, RED, 2.6);
    nh(ctx, rectP(a - 4, 742, b - a + 8, 9), RED, { line: 2.4 });
    nh(ctx, rectP(a - 4, 777, b - a + 8, 9), RED, { line: 2.4 });
  }
  // 门扇（向两边敞开）
  for (const d of [-1, 1]) {
    const xo = DOOR_X + d * 87, xi = DOOR_X + d * 61;
    nh(ctx, polyP([[xo, 566], [xi, 574], [xi, 770], [xo, 780]]), RED, { line: 2.6 });
    ctx.fillStyle = YEL;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 2; c++) { const t = (c + 0.6) / 2.4; ctx.beginPath(); ctx.arc(lerp(xo, xi, t), 596 + r * 26 + t * 4, 2.6, 0, TAU); ctx.fill(); }
  }
  // 柱子
  for (const px of PILLARS) {
    nh(ctx, rectP(px - 11, 556, 22, 230), RED, { line: 2.8 });
    nh(ctx, rectP(px - 17, 772, 34, 14), STONE_D, { line: 2.2 });
    nh(ctx, rectP(px - 15, 552, 30, 10), GRN, { line: 2.2 });
  }
  // 对联板（不写字，只有金边）
  for (const px of [602, 800]) {
    nh(ctx, rectP(px - 16, 590, 32, 162), RED, { line: 2.6 });
    nh(ctx, rectP(px - 11, 595, 22, 152), null, { line: 2, ink: YEL });
    nh(ctx, circP(px, 600, 3), YEL, { line: 0 });
  }
  // 门楣上的红绸彩球
  ctx.lineCap = 'round';
  for (const [w, c] of [[14, INK], [9, RED]]) {
    ctx.strokeStyle = c; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(612, 564); ctx.quadraticCurveTo(656, 600, DOOR_X, 578); ctx.quadraticCurveTo(746, 600, 790, 564); ctx.stroke();
  }
  tuanhua(ctx, DOOR_X, 582, 20, { n: 8, petal: RED, inner: PINK, leaf: YEL, core: YEL, lw: 1.8 });
  for (const x of [612, 790]) nh(ctx, polyP([[x, 564], [x - 10, 600], [x + 10, 600]]), RED, { line: 2 });
  // 一层腰檐
  const eave = pathOf((p) => {
    p.moveTo(452, 502); p.lineTo(1568, 502);
    p.quadraticCurveTo(1590, 520, 1612, 526);
    p.quadraticCurveTo(1586, 548, 1548, 550); p.lineTo(472, 550);
    p.quadraticCurveTo(434, 548, 408, 526);
    p.quadraticCurveTo(430, 520, 452, 502); p.closePath();
  });
  nh(ctx, eave, IND, { line: LW });
  ctx.save(); ctx.clip(eave); ctx.strokeStyle = rgba(INK, 0.7); ctx.lineWidth = 1.4;
  for (let x = 440; x < 1600; x += 14) { ctx.beginPath(); ctx.moveTo(x, 502); ctx.lineTo(x + (x - 1010) * 0.04, 552); ctx.stroke(); }
  ctx.restore();
  nh(ctx, rectP(470, 544, 1080, 9), RED_D, { line: 2.2 });
  ctx.fillStyle = YEL; for (let x = 478; x < 1546; x += 14) { ctx.beginPath(); ctx.arc(x, 548, 2.4, 0, TAU); ctx.fill(); }
  // 二层：墙、窗、柱
  nh(ctx, rectP(486, 342, 1048, 102), PAPER2, { line: LW, reg: 0 });
  const UP = [486, 642, 798, 954, 1110, 1266, 1422, 1534];
  for (let k = 0; k < UP.length - 1; k++) {
    const a = UP[k] + 14, b = UP[k + 1] - 14;
    const w2 = rectP(a, 356, b - a, 76);
    nh(ctx, w2, PAPER, { line: 0, reg: 0 });
    ctx.save(); ctx.clip(w2); ctx.strokeStyle = RED_D; ctx.lineWidth = 2.2;
    for (let x = a; x < b; x += 16) { ctx.beginPath(); ctx.moveTo(x, 356); ctx.lineTo(x, 432); ctx.stroke(); }
    for (let y = 356; y < 432; y += 16) { ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke(); }
    ctx.restore();
    nh(ctx, w2, null, { line: 6, ink: RED });
    nh(ctx, w2, null, { line: 2 });
  }
  for (const px of UP) nh(ctx, rectP(px - 8, 342, 16, 102), RED, { line: 2.4 });
  // 栏杆（回纹）
  nh(ctx, rectP(472, 452, 1076, 44), YEL_L, { line: 2.4 });
  huiwen(ctx, 478, 458, 1064, 32, RED, 3.6);
  nh(ctx, rectP(466, 442, 1088, 12), RED, { line: 2.6 });
  nh(ctx, rectP(466, 494, 1088, 10), RED, { line: 2.4 });
  for (const px of [472, 650, 830, 1010, 1190, 1370, 1548]) {
    nh(ctx, rectP(px - 7, 436, 14, 68), RED_D, { line: 2.2 });
    nh(ctx, circP(px, 432, 7), YEL, { line: 2 });
  }
  // 匾额（靛蓝底、金边、一朵金团花，不写字）
  nh(ctx, rectP(DOOR_X - 118, 348, 236, 82), YEL, { line: LW });
  nh(ctx, rectP(DOOR_X - 106, 358, 212, 62), IND, { line: 2.4 });
  tuanhua(ctx, DOOR_X, 389, 24, { petal: YEL, inner: RED, leaf: YEL_L, core: RED, lw: 1.8 });
  for (const d of [-1, 1]) {
    xiangyun(ctx, DOOR_X + d * 66, 392, 0.3, YEL_L, { flip: -d, lw: 1.8 });
  }
  // 主屋顶
  eaveRoof(ctx, 440, 1580, 236, 340, { flare: 44, inset: 0.15, lw: 3.6 });
  // 正脊中间的宝珠火焰
  nh(ctx, polyP([[1010, 184], [996, 214], [1024, 214]]), RED, { line: 2.4 });
  nh(ctx, circP(1010, 212, 12), YEL, { line: 2.4 });
}

// ---------- 动态：灯笼、酒旗 ----------
function lantern(ctx, x, y, r, swing) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(swing);
  strokeLine(ctx, [[0, 0], [0, 10]], 2.2);
  const h = r * 1.15;
  nh(ctx, ellP(0, 14 + h, r, h), RED, { line: 2.8 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  for (const k of [0.32, 0.68]) { ctx.beginPath(); ctx.ellipse(0, 14 + h, r * k, h, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = rgba(YEL_L, 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-r * 0.2, 14 + h, r * 0.6, 3.5, 4.4); ctx.stroke();
  nh(ctx, rectP(-r * 0.5, 8, r, 8), YEL, { line: 2 });
  nh(ctx, rectP(-r * 0.5, 12 + 2 * h, r, 8), YEL, { line: 2 });
  ctx.strokeStyle = YEL; ctx.lineWidth = 2.4;
  for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.moveTo(k * 3, 20 + 2 * h); ctx.lineTo(k * 4, 20 + 2 * h + r * 0.9); ctx.stroke(); }
  ctx.restore();
}
function wineFlag(ctx, b, px) {
  const top = 104;
  nh(ctx, rectP(px - 5, top, 10, 800 - top), WOOD, { line: 2.6 });
  nh(ctx, circP(px, top - 6, 9), YEL, { line: 2.2 });
  nh(ctx, rectP(px - 152, top + 18, 152, 8), WOOD, { line: 2.2 });
  // 旗面：从横杆垂下，自由的一边随风摆
  const xa = px - 146, xb = px - 12, ya = top + 26, yb = top + 176;
  const wav = (y, side) => Math.sin(b * Math.PI + y * 0.035 + side) * 7 * ((y - ya) / (yb - ya));
  const outline = (inset) => {
    const p = new Path2D();
    p.moveTo(xa + inset, ya + inset);
    p.lineTo(xb - inset, ya + inset);
    for (let y = ya + inset; y <= yb - inset; y += 10) p.lineTo(xb - inset + wav(y, 0), y);
    // 下边：牙边（只有外圈有）
    const n = 6;
    for (let k = 0; k <= n; k++) {
      const x = lerp(xb - inset, xa + inset, k / n);
      const w = wav(yb, 0.5) * (1 - k / n) + wav(yb, 1) * (k / n);
      if (inset === 0 && k < n) {
        const xm = lerp(xb, xa, (k + 0.5) / n);
        p.lineTo(x + w, yb); p.lineTo(xm + w, yb + 22);
      } else p.lineTo(x + w, yb - inset);
    }
    for (let y = yb - inset; y >= ya + inset; y -= 10) p.lineTo(xa + inset + wav(y, 1), y);
    p.closePath();
    return p;
  };
  nh(ctx, outline(0), RED, { line: LW });
  nh(ctx, outline(16), PAPER2, { line: 2.2 });
  // 两条飘带
  for (const [dx, ph] of [[0, 0], [12, 1.3]]) {
    const sx = px - 14 + dx;
    const p = new Path2D();
    p.moveTo(sx, top + 26);
    for (let k = 1; k <= 8; k++) { const y = top + 26 + k * 24; p.lineTo(sx + 8 + Math.sin(b * Math.PI + k * 0.6 + ph) * 6 * (k / 8), y); }
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 9; ctx.stroke(p);
    ctx.strokeStyle = dx ? GRN : YEL; ctx.lineWidth = 5; ctx.stroke(p);
  }
}

// ---------- 年画小人（店小二、食客、掌柜）：面朝左，3/4 侧面 ----------
/**
 * o.s 缩放；o.bow 鞠躬角（弧度，向左躬）；o.arms：side | fist | open | run | hold | table；
 * o.legs：stand | run | none；o.step 跑步相位；o.coat / trim / sash / pants / face；o.hat：cap | kerchief | scholar | round；
 * o.beard：full | mustache；o.towel 毛巾摆角（undefined = 没有毛巾）；o.jar 手里捧着酒坛。
 * 返回手（拳）的位置（场景单位）。
 */
function doll(ctx, x, y, o) {
  const s = o.s || 1, lw = LW / s * (o.lwk || 1), thin = lw * 0.6;
  const bow = o.bow || 0;
  const hip = [Math.max(0, bow) * 16, -150];
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // 腿
  if (o.legs !== 'none') {
    const ph = o.legs === 'run' ? (o.step || 0) : null;
    const leg = (hx, fx, lift, near) => {
      const knee = [lerp(hx, fx, 0.5) - (lift ? 10 : 0), -78 - lift * 0.6];
      nh(ctx, tubeP([[hx, -150], knee, [fx, -14 - lift]], [20, 16, 13]), o.pants || '#2b2522', { line: lw });
      if (o.legs !== 'none' && o.wraps !== false) {
        nh(ctx, tubeP([knee.map((v, i) => (i ? v + 18 : v)), [fx, -18 - lift]], [14, 13]), WHITE, { line: lw * 0.8 });
        ctx.strokeStyle = INK; ctx.lineWidth = thin;
        for (let k = 1; k < 4; k++) { const t = k / 4; const yy = lerp(knee[1] + 18, -18 - lift, t), xx = lerp(knee[0], fx, t); ctx.beginPath(); ctx.moveTo(xx - 12, yy - 4); ctx.lineTo(xx + 12, yy + 3); ctx.stroke(); }
      }
      nh(ctx, ellP(fx - 9, -7 - lift, 23, 9.5), INK, { line: lw * 0.6, reg: 0 });
      strokeLine(ctx, [[fx - 30, -2 - lift], [fx + 12, -2 - lift]], thin, WHITE);
    };
    if (ph === null) { leg(14, 18, 0, false); leg(-10, -22, 0, true); }
    else {
      const a = Math.sin(ph * TAU);
      leg(14, 18 - a * 26, Math.max(0, -Math.cos(ph * TAU)) * 18, false);
      leg(-10, -22 + a * 26, Math.max(0, Math.cos(ph * TAU)) * 18, true);
    }
  }
  // 上身（绕胯转 bow）
  ctx.translate(hip[0], hip[1]);
  ctx.rotate(-bow);
  const SN = [-30, -122], SF = [22, -124];
  const armPose = {
    side: { near: [[-42, -74], [-44, -34]], far: [[30, -72], [32, -34]] },
    fist: { near: [[-60, -100], [-66, -86]], far: [[-14, -88], [-54, -84]] },
    open: { near: [[-66, -118], [-96, -146]], far: [[46, -128], [72, -156]] },
    hold: { near: [[-80, -92], [-120, -112]], far: [[-14, -96], [-48, -118]] },
    table: { near: [[-46, -72], [-68, -60]], far: [[10, -76], [-40, -62]] },
  };
  let AP = armPose[o.arms] || armPose.side;
  if (o.arms === 'run') {
    const a = Math.sin((o.step || 0) * TAU);
    AP = { near: [[-40 + a * 14, -76], [-46 + a * 30, -40]], far: [[30 - a * 14, -76], [34 - a * 30, -40]] };
  }
  const sleeve = (S, E, H) => {
    nh(ctx, tubeP([S, E, H], [17, 15, 13]), o.coat, { line: lw });
    const d = [H[0] - E[0], H[1] - E[1]], L = Math.hypot(d[0], d[1]) || 1;
    nh(ctx, ellP(H[0] - (d[0] / L) * 6, H[1] - (d[1] / L) * 6, 13, 9, Math.atan2(d[1], d[0]) + Math.PI / 2), o.trim, { line: lw * 0.7 });
  };
  const hand = (H) => nh(ctx, circP(H[0], H[1], 11), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
  // 远侧手臂
  sleeve(SF, AP.far[0], AP.far[1]);
  if (o.arms !== 'fist' && o.arms !== 'hold') hand(AP.far[1]);
  // 毛巾（背后那一片）
  if (o.towel !== undefined) {
    ctx.save(); ctx.translate(16, -138); ctx.rotate(o.towel);
    const t = polyP([[-8, -6], [16, -4], [40, 76], [18, 82]]);
    nh(ctx, t, WHITE, { line: lw });
    strokeLine(ctx, [[23, 62], [41, 58]], thin * 1.6, IND); strokeLine(ctx, [[21, 70], [39, 66]], thin * 1.6, IND);
    ctx.restore();
  }
  // 身子
  const coat = new Path2D();
  coat.moveTo(-52, 22);
  coat.quadraticCurveTo(-62, -40, -48, -96);
  coat.quadraticCurveTo(-40, -128, -16, -140);
  coat.lineTo(14, -142);
  coat.quadraticCurveTo(40, -132, 44, -98);
  coat.quadraticCurveTo(50, -40, 48, 22);
  coat.closePath();
  nh(ctx, coat, o.coat, { line: lw });
  ctx.save(); ctx.clip(coat);
  ctx.strokeStyle = o.trim; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(-12, -144); ctx.quadraticCurveTo(-34, -80, -30, 26); ctx.stroke();
  ctx.fillStyle = o.trim; ctx.fillRect(-60, 14, 120, 10);
  if (o.sash) { ctx.fillStyle = o.sash; ctx.fillRect(-60, -10, 120, 18); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = thin;
  ctx.beginPath(); ctx.moveTo(-6, -144); ctx.quadraticCurveTo(-28, -80, -24, 24); ctx.stroke();
  if (o.sash) {
    ctx.beginPath(); ctx.moveTo(-58, -10); ctx.lineTo(50, -10); ctx.moveTo(-58, 8); ctx.lineTo(50, 8); ctx.stroke();
    nh(ctx, polyP([[-34, 6], [-46, 44], [-30, 40], [-24, 6]]), o.sash, { line: thin * 1.2 });
  }
  nh(ctx, coat, null, { line: lw });
  // 领口
  nh(ctx, polyP([[-16, -141], [-4, -126], [8, -142]]), WHITE, { line: thin * 1.2 });
  // 头
  const HC = [-8, -190];
  nh(ctx, ellP(22, -188, 8, 11), o.face || SKIN, { line: thin * 1.2, reg: 0.5 });
  nh(ctx, ellP(HC[0], HC[1], 47, 45), o.face || SKIN, { line: lw, reg: 0.5 });
  // 帽子 / 头巾
  if (o.hat === 'cap') {
    const cap = pathOf((p) => { p.moveTo(-54, -198); p.quadraticCurveTo(-52, -250, -6, -250); p.quadraticCurveTo(40, -250, 42, -196); p.quadraticCurveTo(-6, -212, -54, -198); p.closePath(); });
    nh(ctx, cap, '#2b2522', { line: lw, reg: 0 });
    strokeLine(ctx, [[-52, -201], [-6, -214], [40, -199]], thin * 1.4, RED);
    strokeLine(ctx, [[-6, -248], [-6, -213]], thin, '#5b4a40');
    strokeLine(ctx, [[-30, -244], [-26, -210]], thin, '#5b4a40');
    nh(ctx, circP(-6, -254, 8), RED, { line: thin * 1.3 });
  } else if (o.hat === 'kerchief') {
    const k = pathOf((p) => { p.moveTo(-56, -194); p.quadraticCurveTo(-54, -248, -4, -246); p.quadraticCurveTo(44, -244, 44, -190); p.quadraticCurveTo(-6, -214, -56, -194); p.closePath(); });
    nh(ctx, k, INK, { line: lw, reg: 0 });
    nh(ctx, polyP([[40, -206], [70, -190], [62, -170], [40, -192]]), INK, { line: thin, reg: 0 });
  } else if (o.hat === 'scholar') {
    nh(ctx, polyP([[-50, -200], [-46, -262], [36, -262], [40, -198], [-6, -212]]), IND, { line: lw });
    strokeLine(ctx, [[-48, -232], [38, -232]], thin, IND_L);
    for (const dy of [0, 16]) nh(ctx, polyP([[38, -230 + dy], [70, -214 + dy], [64, -204 + dy], [38, -216 + dy]]), IND, { line: thin });
  } else if (o.hat === 'round') {
    nh(ctx, pathOf((p) => { p.moveTo(-52, -204); p.quadraticCurveTo(-48, -252, -6, -252); p.quadraticCurveTo(36, -252, 40, -202); p.closePath(); }), RED_D, { line: lw });
    nh(ctx, rectP(-54, -210, 96, 12), INK, { line: thin, reg: 0 });
    nh(ctx, circP(-6, -256, 7), YEL, { line: thin });
  }
  // 鬓角
  nh(ctx, polyP([[10, -206], [24, -204], [20, -182], [12, -186]]), INK, { line: 0, reg: 0 });
  // 脸：眯眼笑、两团腮红、圆鼻、张嘴笑
  ctx.fillStyle = rgba(PINK, 0.85);
  ctx.beginPath(); ctx.ellipse(-42, -174, 10, 8, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(4, -176, 10, 8, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = thin * 1.25;
  for (const ex of [-36, -8]) {
    ctx.beginPath(); ctx.arc(ex, -190, 7, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, -206, 9, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(-52, -190); ctx.quadraticCurveTo(-60, -180, -50, -176); ctx.stroke();
  if (o.beard === 'full') {
    nh(ctx, pathOf((p) => { p.moveTo(-56, -178); p.quadraticCurveTo(-50, -132, -18, -128); p.quadraticCurveTo(14, -134, 18, -170); p.quadraticCurveTo(-10, -150, -56, -178); p.closePath(); }), INK, { line: 0, reg: 0 });
  }
  if (o.beard === 'mustache') {
    for (const d of [-1, 1]) nh(ctx, pathOf((p) => { p.moveTo(-36, -172); p.quadraticCurveTo(-36 + d * 14, -170, -36 + d * 22, -150); p.quadraticCurveTo(-36 + d * 10, -164, -36, -168); p.closePath(); }), INK, { line: 0, reg: 0 });
  }
  const mouth = pathOf((p) => { p.moveTo(-40, -166); p.quadraticCurveTo(-30, -150, -18, -166); p.closePath(); });
  nh(ctx, mouth, RED, { line: thin * 1.2, reg: 0.4 });
  // 捧着的酒坛
  if (o.jar) jar(ctx, -84, -78, 86);
  // 近侧手臂
  sleeve(SN, AP.near[0], AP.near[1]);
  if (o.arms === 'fist') {
    // 抱拳：左手握拳、右手掌包住
    nh(ctx, circP(-66, -88, 12.5), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
    nh(ctx, ellP(-58, -84, 12, 15, 0.3), o.face || SKIN, { line: lw * 0.8, reg: 0.5 });
    ctx.strokeStyle = INK; ctx.lineWidth = thin;
    for (const dy of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(-70, -88 + dy); ctx.lineTo(-62, -88 + dy); ctx.stroke(); }
  } else hand(AP.near[1]);
  if (o.arms === 'hold') hand(AP.far[1]);
  // 毛巾（搭在肩前的一片）
  if (o.towel !== undefined) nh(ctx, polyP([[-6, -146], [16, -146], [8, -104], [-12, -108]]), WHITE, { line: lw * 0.9 });
  ctx.restore();
  // 拳的位置（场景单位）
  const hx = o.arms === 'fist' ? -62 : AP.near[1][0], hy = o.arms === 'fist' ? -86 : AP.near[1][1];
  const c = Math.cos(-bow), sn = Math.sin(-bow);
  return [x + (hip[0] + hx * c - hy * sn) * s, y + (hip[1] + hx * sn + hy * c) * s];
}

// ---------- 时间曲线 ----------
/** 鞠躬：第 9 拍「啪」一躬，之后每拍躬落在拍上（快落慢起）。 */
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
  const base = { s: 0.98, coat: GRN, trim: YEL, sash: RED, pants: '#2b2522', hat: 'cap', towel: 0 };
  if (b < T_POP[0]) return null;
  if (b < T_POP[1]) {
    const t = (b - T_POP[0]) / (T_POP[1] - T_POP[0]);
    return { ...base, fx: DOOR_X, y: lerp(784, 800, ease.out(t)) - Math.sin(Math.PI * t) * 34, s: lerp(0.8, 0.98, ease.out(t)), arms: 'open', legs: 'stand', towel: -0.3 * Math.sin(Math.PI * t) };
  }
  if (b < T_TROT[1]) {
    const t = (b - T_TROT[0]) / (T_TROT[1] - T_TROT[0]);
    const step = (b - T_TROT[0]) * 2;
    return { ...base, fx: lerp(DOOR_X, W_STAND + 20, t), y: 800 - Math.abs(Math.sin(step * Math.PI)) * 12, arms: 'run', legs: 'run', step, bow: 0.12, towel: Math.sin(step * TAU) * 0.35 - 0.2 };
  }
  if (b < T_SALUTE) {
    const t = smoothstep(T_TROT[1], T_SALUTE, b);
    return { ...base, fx: lerp(W_STAND + 20, W_STAND, ease.out(t)), y: 800, arms: 'open', legs: 'stand', bow: bowAt(b), towel: 0.25 * t };
  }
  const bw = bowAt(b);
  return { ...base, fx: W_STAND, y: 800, arms: 'fist', legs: 'stand', bow: bw, towel: -bw * 0.5 + 0.1 };
}
const riseOf = (b, R) => smoothstep(R[0], R[1], b) * (1 - smoothstep(T_SIT[0], T_SIT[1], b));
const smallBow = (b, k0) => {
  if (b < k0) return 0;
  const u = b - Math.floor(b);
  return u < 0.7 ? 0.28 * (1 - ease.inOut(u / 0.7)) : 0.28 * ease.in((u - 0.7) / 0.3);
};

// ---------- 梗的特效 ----------
function salutePop(ctx, b, hx, hy) {
  const u = b - T_SALUTE;
  if (u < 0 || u > 0.8) return;
  const grow = ease.out(clamp(u / 0.22)), fade = 1 - smoothstep(0.35, 0.8, u);
  ctx.save();
  ctx.globalAlpha = fade;
  // 明黄光芒（锯齿星）
  const n = 12, r0 = 16 + 6 * grow, r1 = 30 + 40 * grow;
  const star = new Path2D();
  for (let k = 0; k < n * 2; k++) { const a = (k * Math.PI) / n + 0.2, r = k % 2 ? r0 : r1; k ? star.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r) : star.moveTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r); }
  star.closePath();
  nh(ctx, star, YEL, { line: 3 });
  nh(ctx, circP(hx, hy, r0 * 0.9), WHITE, { line: 0, reg: 0 });
  // 黑色速度线
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * TAU + 0.5, d0 = r1 + 6 + u * 70, d1 = d0 + 30 * (1 - u);
    ctx.lineWidth = 5 - (k % 2) * 2;
    ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * d0, hy + Math.sin(a) * d0); ctx.lineTo(hx + Math.cos(a) * d1, hy + Math.sin(a) * d1); ctx.stroke();
  }
  // 两朵小祥云
  const cs = 0.22 + 0.16 * grow;
  xiangyun(ctx, hx - 70 - 40 * grow, hy - 60 - 30 * grow, cs, PINK_L, { flip: -1, lw: 2.6 });
  xiangyun(ctx, hx + 10 + 30 * grow, hy - 96 - 34 * grow, cs, IND_L, { lw: 2.6 });
  ctx.restore();
}
/** 每一躬：背上两道动作弧线。 */
function bowArcs(ctx, b, wx) {
  if (b < T_SALUTE + 1) return;
  const u = b - Math.floor(b);
  if (u > 0.4) return;
  ctx.save();
  ctx.globalAlpha = 1 - u / 0.4;
  ctx.strokeStyle = INK; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (const r of [70, 92]) { ctx.beginPath(); ctx.arc(wx + 6, 800 - 150, r + u * 30, -2.0, -1.2); ctx.stroke(); }
  ctx.restore();
}
/** 定格那一刻，他身后闪一下「大侠」光芒。 */
function heroGlow(ctx, b) {
  const u = b - T_SALUTE;
  if (u < 0 || u > 1.2) return;
  const k = ease.out(clamp(u / 0.25)) * (1 - smoothstep(0.6, 1.2, u));
  ctx.save();
  ctx.globalAlpha = 0.85 * k;
  const cx = CHAR_X + 6, cy = ROAD_Y - 330;
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU, da = 0.1;
    const r0 = 170, r1 = 230 + 80 * k + (i % 2) * 36;
    ctx.fillStyle = i % 2 ? YEL_L : YEL;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a - da) * r0, cy + Math.sin(a - da) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); ctx.lineTo(cx + Math.cos(a + da) * r0, cy + Math.sin(a + da) * r0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  }
  ctx.restore();
}
function sweatDrop(ctx, b, fig) {
  const k = smoothstep(T_SWEAT[0], T_SWEAT[0] + 0.15, b) * (1 - smoothstep(T_SWEAT[1] - 0.2, T_SWEAT[1], b));
  if (k <= 0 || fig.pose !== 'stand') return;
  const a = ANCHORS.stand.ear;
  const slide = smoothstep(T_SWEAT[0], T_SWEAT[1], b) * 18;
  const x = fig.x + (a[0] + 24) * fig.scale, y = fig.y + (a[1] + 8) * fig.scale + slide;
  ctx.save(); ctx.globalAlpha = k;
  const p = pathOf((q) => { q.moveTo(x, y - 26); q.quadraticCurveTo(x + 16, y - 2, x + 12, y + 8); q.arc(x, y + 6, 12, 0.2, Math.PI - 0.2); q.quadraticCurveTo(x - 16, y - 2, x, y - 26); q.closePath(); });
  nh(ctx, p, IND_L, { line: 3 });
  ctx.fillStyle = WHITE; ctx.beginPath(); ctx.ellipse(x - 4, y + 2, 3, 5, 0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

// ---------- 人物画风：年画（靛蓝平涂 + 套色错位） ----------
registerStyle('s12-nianhua', (I) => {
  const O = comicBase(I, { levels: 6, keep: 0.2, lw: 4.6, inner: 0.36, ink: INK });
  const pal = [INK, '#203d7e', '#5b82c6', '#e8ab82', '#f8d6b0', PAPER].map(rgbf);
  const n = O.w * O.h, cls = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (O.a[i] < 0.01) continue;
    const l = luma(O, i);
    const skin = O.r[i] - O.b[i] > 0.07 && l > 0.22;
    cls[i] = l < 0.075 ? 0 : skin ? (l < 0.5 ? 3 : 4) : l < 0.24 ? 1 : l < 0.5 ? 2 : 5;
  }
  const DX = 2, DY = 2, paperC = rgbf(PAPER);
  for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
    const i = y * O.w + x;
    if (cls[i] < 0) continue;
    let c;
    if (cls[i] === 0) c = pal[0];
    else {
      const j = Math.max(0, y - DY) * O.w + Math.max(0, x - DX);
      // 色版错开：外轮廓一侧露出一线纸白；里面的黑线底下还是色版
      c = cls[j] > 0 ? pal[cls[j]] : cls[j] === 0 ? pal[cls[i]] : paperC;
    }
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
  }
  return O;
});

// ---------- 标题卡、CD、画框（像素坐标） ----------
function cardBg(ctx, x, y, w, h) {
  ctx.save();
  const band = 18;
  nh(ctx, rectP(x, y, w, h), RED, { line: 3.4 });
  huiwen(ctx, x + 3, y + 3, w - 6, band - 6, YEL, 2.2);
  huiwen(ctx, x + 3, y + h - band + 3, w - 6, band - 6, YEL, 2.2);
  for (const sx of [x + 3, x + w - band + 3]) {
    ctx.save(); ctx.translate(sx + band - 6, y + band); ctx.rotate(Math.PI / 2); huiwen(ctx, 0, 0, h - 2 * band, band - 6, YEL, 2.2); ctx.restore();
  }
  nh(ctx, rectP(x + band, y + band, w - 2 * band, h - 2 * band), PAPER, { line: 3, reg: 0.8 });
  ctx.strokeStyle = rgba(GRN, 0.9); ctx.lineWidth = 2.4; ctx.strokeRect(x + band + 6, y + band + 6, w - 2 * band - 12, h - 2 * band - 12);
  for (const [cx, cy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) tuanhua(ctx, cx, cy, 22, { lw: 1.8 });
  ctx.restore();
}
function nianhuaCD(ctx, kind, cx, cy, s, spin) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  nh(ctx, circP(0, 0, r), YEL_L, { line: 3.4 * s });
  ctx.rotate(spin);
  const ring = pathOf((p) => { p.arc(0, 0, r * 0.9, 0, TAU); p.moveTo(r * 0.66, 0); p.arc(0, 0, r * 0.66, 0, TAU, true); });
  nh(ctx, ring, RED, { line: 2.4 * s });
  ctx.fillStyle = YEL;
  for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; ctx.beginPath(); ctx.arc(Math.cos(a) * r * 0.78 + REG[0], Math.sin(a) * r * 0.78 + REG[1], 3.2 * s, 0, TAU); ctx.fill(); }
  nh(ctx, ellP(r * 0.78, 0, 9 * s, 6 * s), GRN, { line: 2 * s, reg: 0 }); // 一片绿叶：看得出在转
  tuanhua(ctx, 0, 0, r * 0.6, { lw: 1.8 * s });
  nh(ctx, circP(0, 0, r * 0.12), YEL, { line: 2 * s, reg: 0 });
  nh(ctx, circP(0, 0, r * 0.05), INK, { line: 0, reg: 0 });
  ctx.restore();
}
function plate(ctx, x, y, w, h) {
  nh(ctx, rectP(x, y, w, h), RED, { line: 3.4 });
  nh(ctx, rectP(x + 7, y + 7, w - 14, h - 14), YEL_L, { line: 2.2, reg: 0.8 });
  for (const sx of [x, x + w]) nh(ctx, circP(sx, y + h / 2, 9), YEL, { line: 2.2 });
}
/** 离场画框：大红回纹带 + 翠绿细带 + 四角团花 + 上下祥云。 */
function nianhuaFrame(ctx, R) {
  const t = 64 * R.s, { x, y, w, h } = R, lw = Math.max(1, 3 * R.s);
  ctx.save();
  ctx.fillStyle = 'rgba(40,20,10,0.16)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
  const ringP = (o, i) => pathOf((p) => { p.rect(x - o, y - o, w + 2 * o, h + 2 * o); p.rect(x - i, y - i, w + 2 * i, h + 2 * i); });
  ctx.save(); ctx.translate(2 * R.s, 1.5 * R.s); ctx.fillStyle = RED; ctx.fill(ringP(t, t * 0.3), 'evenodd'); ctx.fillStyle = GRN; ctx.fill(ringP(t * 0.3, 0), 'evenodd'); ctx.restore();
  // 回纹
  const bh = t * 0.42, bo = t * 0.86;
  huiwen(ctx, x - bo, y - bo, w + 2 * bo, bh, YEL, Math.max(1, 2.8 * R.s));
  huiwen(ctx, x - bo, y + h + bo - bh, w + 2 * bo, bh, YEL, Math.max(1, 2.8 * R.s));
  for (const [sx, dir] of [[x - bo, 1], [x + w + bo, -1]]) {
    ctx.save(); ctx.translate(sx, dir > 0 ? y + h + bo : y - bo); ctx.rotate(-dir * Math.PI / 2); huiwen(ctx, 0, 0, h + 2 * bo, bh, YEL, Math.max(1, 2.8 * R.s)); ctx.restore();
  }
  // 翠绿细带上的桃红点
  ctx.fillStyle = PINK_L;
  const step = Math.max(10, 40 * R.s), m = t * 0.15;
  for (let px = x; px < x + w; px += step) { ctx.beginPath(); ctx.arc(px, y - m, Math.max(1, 3.5 * R.s), 0, TAU); ctx.arc(px, y + h + m, Math.max(1, 3.5 * R.s), 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = lw;
  ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
  ctx.strokeRect(x - t * 0.3, y - t * 0.3, w + t * 0.6, h + t * 0.6);
  ctx.lineWidth = lw * 1.4;
  ctx.strokeRect(x, y, w, h);
  // 四角团花、上下祥云
  for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) tuanhua(ctx, cx, cy, t * 0.7, { lw: Math.max(1, 2.2 * R.s) });
  for (const cy of [y - t / 2, y + h + t / 2]) xiangyun(ctx, x + w / 2, cy, t / 70, WHITE, { lw: Math.max(1, 2.4 * R.s) });
  ctx.restore();
}

// ---------- 场景 ----------
export const s12 = {
  id: 's12',
  station: ST,
  figureStyle: 's12-nianhua',
  // 年画人物外的一圈纸白留边：在红柱、靛蓝雨棚、绿树前也拉得开
  figureRim: { color: PAPER, width: 5, alpha: 1 },
  freezeBeat: GAG + 2.1, // Outro 展墙：店小二深躬、食客拱手、掌柜捧酒
  drawBack(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG), off = cg - cam;
    ctx.drawImage(paper(), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawStrip(ctx, skyLayer(), cam);
    drawStrip(ctx, mountainLayer(), cam);
    drawStrip(ctx, cityLayer(), cam);
    drawStrip(ctx, treeLayer(), cam);
    drawStrip(ctx, streetLayer(cg), cam);
    drawStrip(ctx, roadLayer(), cam);
    heroGlow(ctx, b);
    const B = INN_BOX;
    if (B.x1 + off > X_MIN && B.x0 + off < X_MAX) {
      ctx.drawImage(innImage('back'), B.x0 + off, B.y0, B.x1 - B.x0, B.y1 - B.y0);
      // 堂里的人：食客甲、食客乙、掌柜
      const ra = riseOf(b, T_RISE_A), rb = riseOf(b, T_RISE_B);
      doll(ctx, DINER_A + off, 742 + 150 * 0.56 - ra * 48, { s: 0.56, lwk: 0.8, coat: IND, trim: YEL, face: '#ef9a78', hat: 'kerchief', beard: 'full', legs: 'none', arms: ra > 0.5 ? 'fist' : 'table', bow: ra > 0.5 ? smallBow(b, T_RISE_A[1]) : 0 });
      doll(ctx, DINER_B + off, 742 + 150 * 0.56 - rb * 46, { s: 0.56, lwk: 0.8, coat: PINK, trim: GRN, hat: 'scholar', legs: 'none', arms: rb > 0.5 ? 'fist' : 'table', bow: rb > 0.5 ? smallBow(b + 0.5, T_RISE_B[1] + 0.5) : 0 });
      const jk = smoothstep(T_JAR[0], T_JAR[1], b);
      const jarUp = jk > 0 ? ease.outBack(jk) : 0;
      if (jk > 0) doll(ctx, KEEPER + off, 786 - jarUp * 26, { s: 0.56, lwk: 0.8, coat: RED_D, trim: YEL, hat: 'round', beard: 'mustache', legs: 'none', arms: 'hold', jar: true, bow: -0.08 * jarUp });
      else doll(ctx, KEEPER + off, 786, { s: 0.56, lwk: 0.8, coat: RED_D, trim: YEL, hat: 'round', beard: 'mustache', legs: 'none', arms: 'table' });
      ctx.drawImage(innImage('front'), B.x0 + off, B.y0, B.x1 - B.x0, B.y1 - B.y0);
      // 捧出的酒坛闪两颗小星
      if (jk > 0.6) {
        const tw = Math.abs(Math.sin((b - T_JAR[1]) * Math.PI * 2));
        for (const [dx, dy, r] of [[-84, -96, 13], [-22, -118, 9]]) {
          const sx = KEEPER + off + dx, sy = 786 - jarUp * 26 + dy - 70;
          const st = new Path2D();
          for (let k = 0; k < 8; k++) { const a = (k * Math.PI) / 4, rr = (k % 2 ? 0.35 : 1) * r * (0.6 + 0.4 * tw); k ? st.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr) : st.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
          st.closePath();
          nh(ctx, st, YEL, { line: 2 });
        }
      }
      // 灯笼：每拍轻晃
      HOOKS.forEach((hx, i) => lantern(ctx, hx + off, 553, 20, Math.sin(b * Math.PI + i * 0.8) * 0.07));
      for (const [hx, i] of [[424, 5], [1596, 6]]) lantern(ctx, hx + off, 316, 26, Math.sin(b * Math.PI + i) * 0.06);
    }
    if (FLAG_X + off > X_MIN - 20 && FLAG_X + off - 160 < X_MAX) wineFlag(ctx, b, FLAG_X + off);
    // 店小二
    const W = waiterState(b);
    if (W) {
      const wx = W.fx + off;
      if (wx > X_MIN - 150 && wx < X_MAX + 150) {
        ctx.fillStyle = rgba('#8a6a3a', 0.25); ctx.beginPath(); ctx.ellipse(wx, 801, 56 * W.s, 9, 0, 0, TAU); ctx.fill();
        // 他走过去以后，店小二转身朝着他的背影继续作揖
        const turn = b > GAG + 4 && wx < CHAR_X - 70;
        ctx.save();
        if (turn) { ctx.translate(2 * wx, 0); ctx.scale(-1, 1); }
        const hand = doll(ctx, wx, W.y, W);
        bowArcs(ctx, b, wx);
        ctx.restore();
        salutePop(ctx, b, hand[0], hand[1]);
      }
    }
  },
  drawFront(ctx, b, env) {
    drawStrip(ctx, fgLayer(env.camAt(GAG)), env.cam);
    sweatDrop(ctx, b, env.figure());
  },
  drawFrame(ctx, R) { nianhuaFrame(ctx, R); },
  cardStyle: { ink: INK, accent: RED, bar: false, bgDraw: (ctx, x, y, w, h) => cardBg(ctx, x, y, w, h) },
  playerStyle: {
    ink: INK, noteColor: RED, backdrop: false,
    plateDraw: (ctx, x, y, w, h) => plate(ctx, x, y, w, h),
    drawPlayer: (ctx, kind, cx, cy, s, spin) => nianhuaCD(ctx, kind, cx, cy, s, spin),
  },
};
