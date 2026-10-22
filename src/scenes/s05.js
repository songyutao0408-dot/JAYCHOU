// 第 5 站 · 七里香（Common Jasmine Orange, 2004）·「止战之殇」· 废墟里的白鸽 · 铅笔速写 + 色彩晕开
// 浅米色速写纸，浅灰铅笔线；画面明亮，没有大面积暗色。
// 构图：远处断续的城市轮廓 → 炸断的墙（砖缝、窗洞、钢筋）、倒下的路牌 → 碎石路（裂缝）、
//       废墟里的旧玩具熊、地上一顶旧钢盔 → 前景碎砖堆。
// 贯穿细节：他每迈一步，脚下的裂缝里冒出一朵小彩花（全站唯一一直有颜色的东西）。
// 梗：第 9 拍强拍（第 3 小节），钢盔里飞出一只白鸽；鸽子飞过的地方，颜色像水彩一样从画面中间晕开——
//     墙上长出绿藤、天空变淡蓝，两拍内整幅画从灰色速写变成彩色；第 11–12 拍他站在彩色里，第 13–16 拍走向下一道画框，身后保持彩色。
// 铅笔线与水彩用 p5.brush 画（烘焙成视差长条），每帧的小物件用 kit/sketch.js 的手绘线。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { drawStrip } from '../kit/strip.js';
import { sketchStrip, washStrip, sketchPoly, sketchEllipse, sketchLine, sketchHatch, ellipsePts } from '../kit/sketch.js';
import { paperTexture } from '../kit/paper.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { circle, ellipse, roundRect, poly } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker } from '../rig/walker.js';
import { K } from '../main/layout.js';

const ST = stationByN(5);
const PAPER = '#f3ecdc', PAPER_D = '#ebe2cf', LEAD = '#8a847a', LEAD_D = '#5f5a52', LEAD_L = '#b4ada1';
const P_FAR = 0.3, P_MID = 0.7, P_FG = 1.25;
const FAR_BASE = 600;
const BLOOM = [GAG, GAG + 2]; // 第 9～10 拍：颜色晕开（两拍）
const HELMET_SX = 560;        // 定格时钢盔在画面上的位置（单位）
const BEAR_SX = 1010;
const SIGN_SX = 860;

// ---------- 小工具 ----------
const R0 = (k) => rng('s05', k);
function jag(x0, x1, yBase, hMin, hMax, R, step = [18, 46]) {
  // 断墙的锯齿顶
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
const fillPoly = (ctx, pts, color) => { poly(ctx, pts); ctx.fillStyle = color; ctx.fill(); };
function bPoly(B, pts, closed = true) {
  // p5.brush 画多边形轮廓：逐边画线（不闭合时只画折线）
  const n = pts.length, segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) { const a = pts[i], b = pts[(i + 1) % n]; B.line(a[0], a[1], b[0], b[1]); }
}
function bWash(B, pts, color, alpha = 110, bleed = 0.18) {
  B.noStroke();
  B.fill(color, alpha);
  B.fillBleed(bleed, 'out');
  B.polygon(pts);
  B.noFill();
}

// ---------- 几何（确定性，各层共用） ----------
function farGeo() {
  const R = R0('far'), out = [];
  const [x0, x1] = [-1100, 3000];
  for (let x = x0; x < x1;) {
    const w = 70 + R() * 150, h = 50 + R() * 170;
    out.push({ x, w, h, pts: jag(x, x + w, FAR_BASE, h * 0.75, h, R, [14, 34]), wins: Math.floor(R() * 6) });
    x += w + 10 + R() * 60;
  }
  return out;
}
function midGeo(c5) {
  const R = R0('mid'), walls = [];
  for (let x = -1500; x < 3600;) {
    const w = 220 + R() * 200, h = 200 + R() * 170, base = 790;
    // 让定格时画面中间（钢盔、人物后面）留出一块空地
    const sx = x - c5 * P_MID;
    if (sx > 180 && sx < 760) { x += 140; continue; }
    walls.push({ x, w, h, base, pts: jag(x, x + w, base, h * 0.55, h, R, [22, 60]),
      win: R() < 0.7 ? { x: x + w * (0.25 + R() * 0.3), y: base - h * 0.62, w: 46 + R() * 20, h: 70 + R() * 20 } : null,
      brick: { x: x + w * R() * 0.4, y: base - h * (0.2 + R() * 0.3), w: w * 0.45, h: 70 },
      rebar: R() < 0.6, seed: Math.floor(R() * 1000) });
    x += w + 260 + R() * 420;
  }
  const sign = { x: SIGN_SX + c5 * P_MID };
  return { walls, sign };
}
function groundGeo(c5) {
  const R = R0('ground'), stones = [], cracks = [];
  for (let x = -1200; x < 3600; x += 24 + R() * 60) {
    const y = ROAD_Y + 16 + R() * 170, r = 4 + R() * 13;
    const n = 6, pts = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + R() * 0.4; pts.push([x + Math.cos(a) * r * (0.7 + R() * 0.5), y + Math.sin(a) * r * 0.6 * (0.7 + R() * 0.5)]); }
    stones.push({ pts, brick: R() < 0.25 });
  }
  for (let x = -1200; x < 3600; x += 120 + R() * 180) {
    const pts = [[x, ROAD_Y + 4]];
    let cx = x, cy = ROAD_Y + 4;
    const n = 4 + Math.floor(R() * 4);
    for (let k = 0; k < n; k++) { cx += 10 + R() * 30; cy += 8 + R() * 22; pts.push([cx, cy]); }
    cracks.push(pts);
  }
  return { stones, cracks, bear: { x: BEAR_SX + c5 } };
}

// ---------- 远景 ----------
function farLines(env) {
  const g = farGeo();
  return sketchStrip('s05-far', P_FAR, {
    y0: 300, y1: 640,
    fills: (ctx) => { for (const b of g) fillPoly(ctx, b.pts, PAPER); },
    lines: (B) => {
      B.set('2H', LEAD_L, 0.9);
      for (const b of g) {
        bPoly(B, b.pts.slice(1, -1), false);
        B.line(b.x, FAR_BASE - 2, b.x, b.pts[1][1]); B.line(b.x + b.w, FAR_BASE - 2, b.x + b.w, b.pts[b.pts.length - 2][1]);
        for (let k = 0; k < b.wins; k++) {
          const wx = b.x + 10 + ((k * 37) % Math.max(20, b.w - 26)), wy = FAR_BASE - 30 - ((k * 53) % Math.max(30, b.h * 0.6));
          B.rect(wx, wy, 10, 14);
        }
      }
      B.set('2H', LEAD_L, 0.8);
      B.line(-1100, FAR_BASE, 3000, FAR_BASE);
    },
  });
}
function farWash() {
  const g = farGeo();
  return washStrip('s05-farw', P_FAR, {
    y0: 300, y1: 640,
    wash: (B) => { g.forEach((b, i) => bWash(B, b.pts, ['#b9b4d6', '#c3d3e2', '#d4c6dc'][i % 3], 70, 0.12)); },
  });
}

// ---------- 中景：断墙、路牌、藤蔓 ----------
function signPts(s) {
  const top = [s.x + 70, 650], foot = [s.x - 110, 782];
  return { top, foot, plate: ellipsePts(top[0] + 26, top[1] - 18, 44, 44, 20) };
}
function midLines(env) {
  const g = midGeo(env.camAt(GAG));
  return sketchStrip('s05-mid', P_MID, {
    y0: 300, y1: 820,
    fills: (ctx, x0, x1) => {
      // 远处的废墟地面（纸色，挡住远景下沿）
      ctx.fillStyle = PAPER; ctx.fillRect(x0, 640, x1 - x0, 180);
      for (const w of g.walls) {
        fillPoly(ctx, w.pts, PAPER_D);
        if (w.win) { ctx.fillStyle = mix(PAPER_D, '#d8cdb8', 0.6); roundRect(ctx, w.win.x, w.win.y, w.win.w, w.win.h, w.win.w / 2); ctx.fill(); }
      }
    },
    lines: (B, x0, x1) => {
      const R = R0('midlines');
      // 远处地面的几笔
      B.set('2H', LEAD_L, 0.7);
      for (let x = x0; x < x1; x += 90 + R() * 160) { const y = 660 + R() * 120; B.line(x, y, x + 30 + R() * 80, y + (R() - 0.5) * 6); }
      for (const w of g.walls) {
        B.set('HB', LEAD, 1.1);
        bPoly(B, w.pts.slice(1, -1), false);
        B.line(w.x, w.base, w.x, w.pts[1][1]); B.line(w.x + w.w, w.base, w.x + w.w, w.pts[w.pts.length - 2][1]);
        B.set('2H', LEAD, 0.8);
        // 露出的砖：几排短线
        const bk = w.brick;
        for (let r = 0; r < 4; r++) {
          const yy = bk.y + r * 17;
          B.line(bk.x, yy, bk.x + bk.w * (0.6 + R() * 0.4), yy);
          for (let xx = bk.x + (r % 2) * 18; xx < bk.x + bk.w * 0.8; xx += 36) B.line(xx, yy, xx, yy + 17);
        }
        // 窗洞 + 洞里的排线
        if (w.win) {
          const { x, y, w: ww, h } = w.win;
          B.set('HB', LEAD, 0.9);
          B.spline([[x, y + h], [x, y + ww / 2], [x + ww / 2, y], [x + ww, y + ww / 2], [x + ww, y + h]], 0.6);
          B.line(x, y + h, x + ww, y + h);
          B.set('2H', LEAD_L, 0.7);
          for (let k = 6; k < ww + h; k += 9) B.line(x + Math.max(0, k - h), y + Math.min(h, k), x + Math.min(ww, k), y + Math.max(ww * 0.4, k - ww));
        }
        // 裂缝
        B.set('2H', LEAD, 0.8);
        let cx = w.x + w.w * (0.5 + R() * 0.3), cy = w.pts[3] ? w.pts[3][1] + 10 : w.base - w.h * 0.8;
        for (let k = 0; k < 5; k++) { const nx = cx + (R() - 0.5) * 30, ny = cy + 18 + R() * 20; B.line(cx, cy, nx, ny); cx = nx; cy = ny; }
        // 钢筋
        if (w.rebar) { B.set('HB', LEAD_D, 0.8); const t = w.pts[2]; B.line(t[0], t[1], t[0] + 14, t[1] - 46); B.line(t[0] + 10, t[1] + 2, t[0] + 30, t[1] - 36); }
        // 墙脚的碎块
        B.set('2H', LEAD, 0.8);
        for (let k = 0; k < 5; k++) { const bx = w.x - 30 + R() * (w.w + 60); B.rect(bx, w.base - 10 - R() * 6, 16 + R() * 14, 10); }
      }
      // 倒下的路牌：歪倒的杆子 + 圆牌（只画箭头，不写字）
      const s = signPts(g.sign);
      B.set('HB', LEAD_D, 1.2);
      B.line(s.foot[0], s.foot[1], s.top[0], s.top[1]);
      B.line(s.foot[0] + 8, s.foot[1] + 4, s.top[0] + 6, s.top[1] + 6);
      bPoly(B, s.plate, true);
      B.set('HB', LEAD, 1);
      const [px, py] = [s.top[0] + 26, s.top[1] - 18];
      B.line(px - 22, py + 14, px + 18, py - 16); B.line(px + 18, py - 16, px + 2, py - 16); B.line(px + 18, py - 16, px + 16, py);
    },
  });
}
function midWash(env) {
  const g = midGeo(env.camAt(GAG));
  return washStrip('s05-midw', P_MID, {
    y0: 300, y1: 820,
    wash: (B, x0, x1) => {
      const R = R0('midwash');
      bWash(B, [[x0, 650], [x1, 650], [x1, 800], [x0, 800]], '#e3d2ae', 70, 0.08);
      for (const w of g.walls) {
        bWash(B, w.pts, R() < 0.5 ? '#e9b98f' : '#ecc9a2', 120, 0.2);
        const bk = w.brick;
        bWash(B, [[bk.x, bk.y], [bk.x + bk.w * 0.9, bk.y], [bk.x + bk.w * 0.8, bk.y + 66], [bk.x, bk.y + 66]], '#d27f5c', 120, 0.15);
        if (w.win) bWash(B, ellipsePts(w.win.x + w.win.w / 2, w.win.y + w.win.h / 2, w.win.w / 2, w.win.h / 2, 14), '#9fc3df', 110, 0.1);
      }
      const s = signPts(g.sign);
      bWash(B, s.plate, '#6f9fd0', 150, 0.08);
      // 藤蔓：从墙脚爬上墙（只在彩色里出现）
      for (const w of g.walls) {
        for (let v = 0; v < 4; v++) {
          let x = w.x + 20 + R() * (w.w - 40), y = w.base;
          const top = w.base - w.h * (0.45 + R() * 0.45);
          const pts = [[x, y]];
          while (y > top) { y -= 26; x += Math.sin(y * 0.05 + v) * 14; pts.push([x, y]); }
          B.set('cpencil', '#3f7a2e', 1.8);
          B.spline(pts, 0.5);
          for (let k = 1; k < pts.length; k++) {
            const [lx, ly] = pts[k], sd = k % 2 ? 1 : -1;
            bWash(B, ellipsePts(lx + sd * 15, ly, 16, 9, 8, sd * 0.6), k % 3 ? '#6fb84c' : '#4f9a3a', 220, 0.08);
            if (k % 2) bWash(B, ellipsePts(lx - sd * 10, ly - 10, 11, 7, 8, -sd * 0.5), '#8fcf68', 200, 0.08);
          }
        }
      }
    },
  });
}

// ---------- 地面：碎石路、裂缝、玩具熊 ----------
function bearPts(x) {
  const y = ROAD_Y - 6;
  return {
    body: ellipsePts(x, y - 40, 40, 44, 18), head: ellipsePts(x + 6, y - 104, 32, 29, 16),
    earL: ellipsePts(x - 18, y - 128, 12, 12, 10), earR: ellipsePts(x + 30, y - 126, 11, 11, 10),
    armL: ellipsePts(x - 40, y - 46, 14, 22, 10, 0.5), armR: ellipsePts(x + 40, y - 40, 14, 22, 10, -0.6),
    legL: ellipsePts(x - 22, y - 8, 20, 13, 10), legR: ellipsePts(x + 26, y - 6, 20, 13, 10),
    snout: ellipsePts(x + 20, y - 96, 13, 10, 10), patch: [[x - 14, y - 56], [x + 6, y - 60], [x + 8, y - 40], [x - 12, y - 38]],
    eye: [x + 12, y - 110], nose: [x + 30, y - 98],
  };
}
function groundLines(env) {
  const g = groundGeo(env.camAt(GAG));
  return sketchStrip('s05-ground', 1, {
    y0: ROAD_Y - 150, y1: 1000,
    fills: (ctx, x0, x1) => {
      ctx.fillStyle = PAPER; ctx.fillRect(x0, ROAD_Y, x1 - x0, 1000 - ROAD_Y);
      const b = bearPts(g.bear.x);
      for (const k of ['armL', 'legL', 'body', 'legR', 'head', 'earL', 'earR', 'armR']) fillPoly(ctx, b[k], PAPER_D);
    },
    lines: (B, x0, x1) => {
      B.set('HB', LEAD, 1.2);
      B.line(x0, ROAD_Y, x1, ROAD_Y);
      B.set('2H', LEAD, 0.8);
      for (const c of g.cracks) bPoly(B, c, false);
      for (const s of g.stones) { B.set(s.brick ? 'HB' : '2H', s.brick ? LEAD : LEAD_L, 0.8); bPoly(B, s.pts, true); }
      // 路面几道横向铅笔线，表现地面
      const R = R0('glines');
      B.set('2H', LEAD_L, 0.6);
      for (let x = x0; x < x1; x += 60 + R() * 120) { const y = ROAD_Y + 40 + R() * 150; B.line(x, y, x + 40 + R() * 70, y + (R() - 0.5) * 4); }
      // 玩具熊
      const b = bearPts(g.bear.x);
      B.set('HB', LEAD_D, 0.9);
      for (const k of ['armL', 'legL', 'body', 'legR', 'head', 'earL', 'earR', 'armR', 'snout']) bPoly(B, b[k], true);
      B.set('2H', LEAD, 0.8);
      bPoly(B, b.patch, true);
      for (let k = 0; k < 4; k++) B.line(b.patch[0][0] + 4 + k * 5, b.patch[0][1] - 4, b.patch[0][0] + 4 + k * 5, b.patch[0][1] + 4); // 缝线
      B.set('pen', LEAD_D, 0.9);
      B.circle(b.eye[0], b.eye[1], 3.5); B.circle(b.nose[0], b.nose[1], 4);
      B.set('2H', LEAD_D, 0.7);
      B.line(b.eye[0] - 22, b.eye[1] + 2, b.eye[0] - 14, b.eye[1] + 6); B.line(b.eye[0] - 22, b.eye[1] + 6, b.eye[0] - 14, b.eye[1] + 2); // 掉了的那只眼：缝成叉
    },
  });
}
function groundWash(env) {
  const g = groundGeo(env.camAt(GAG));
  return washStrip('s05-groundw', 1, {
    y0: ROAD_Y - 150, y1: 1000,
    wash: (B, x0, x1) => {
      bWash(B, [[x0, ROAD_Y], [x1, ROAD_Y], [x1, 1000], [x0, 1000]], '#dcc9a3', 80, 0.06);
      for (const s of g.stones) bWash(B, s.pts, s.brick ? '#d98a62' : '#b9b6c4', 150, 0.05);
      const R = R0('grass');
      for (const c of g.cracks) { const [gx, gy] = c[Math.floor(c.length / 2)]; bWash(B, ellipsePts(gx, gy, 22 + R() * 14, 7, 10), '#9ccb6e', 150, 0.15); }
      const b = bearPts(g.bear.x);
      for (const k of ['armL', 'legL', 'body', 'legR', 'head', 'earL', 'earR', 'armR']) bWash(B, b[k], '#c98a55', 160, 0.12);
      bWash(B, b.snout, '#efd0a8', 160, 0.1);
      bWash(B, b.patch, '#7fa6d6', 170, 0.05);
    },
  });
}

// ---------- 前景碎砖堆 ----------
function fgLines(env) {
  const c5 = env.camAt(GAG);
  const piles = [-260 + c5 * P_FG, 1330 + c5 * P_FG, 2600 + c5 * P_FG];
  const R = R0('fg');
  const chunks = [];
  for (const px of piles) for (let k = 0; k < 9; k++) {
    const x = px + (R() - 0.5) * 300, y = 940 + R() * 70, w = 40 + R() * 60, h = 22 + R() * 26, a = (R() - 0.5) * 0.5;
    const pts = [[-w / 2, -h / 2], [w / 2, -h / 2 + R() * 6], [w / 2, h / 2], [-w / 2, h / 2]].map(([u, v]) => [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)]);
    chunks.push({ pts, brick: R() < 0.5 });
  }
  return {
    lines: sketchStrip('s05-fg', P_FG, {
      y0: 880, y1: 1060,
      fills: (ctx) => { for (const c of chunks) fillPoly(ctx, c.pts, PAPER_D); },
      lines: (B) => { B.set('HB', LEAD_D, 1.1); for (const c of chunks) bPoly(B, c.pts, true); },
    }),
    wash: washStrip('s05-fgw', P_FG, { y0: 880, y1: 1060, wash: (B) => { for (const c of chunks) bWash(B, c.pts, c.brick ? '#d98a62' : '#c2bdb2', 150, 0.08); } }),
  };
}

// ---------- 色彩晕开：从钢盔开始、沿着鸽子飞过的路径扩散 ----------
function dovePath(t) {
  // 0..1 → 画面单位坐标（三次贝塞尔：钢盔口 → 斜上方 → 画面右上方飞出）
  const P = [[HELMET_SX + 26, ROAD_Y + 2], [HELMET_SX + 10, 520], [760, 240], [1300, 70]];
  const u = 1 - t;
  return [0, 1].map((i) => u * u * u * P[0][i] + 3 * u * u * t * P[1][i] + 3 * u * t * t * P[2][i] + t * t * t * P[3][i]);
}
const DOVE_T = (b) => ease.out(clamp((b - BLOOM[0]) / 1.7));
function blobPath(path, cx, cy, r, seed, b) {
  const n = 56;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + 0.16 * (noise2(Math.cos(a) * 1.6 + seed, Math.sin(a) * 1.6 + b * 0.15, 61) - 0.5) * 2;
    const x = cx + Math.cos(a) * r * k, y = cy + Math.sin(a) * r * k;
    i ? path.lineTo(x, y) : path.moveTo(x, y);
  }
  path.closePath();
}
/** 当前的晕染区域（null = 还没开始；'all' = 已经铺满）。grow 外扩量用于画羽化边。 */
function bloomPath(b, grow = 0) {
  if (b < BLOOM[0]) return null;
  if (b >= BLOOM[1]) return 'all';
  const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
  const p = new Path2D();
  blobPath(p, HELMET_SX, ROAD_Y - 40, 40 + 2000 * ease.inOut(t) + grow, 3, b);
  if (grow === 'main') return p;
  // 鸽子飞过留下的色团
  const dt = DOVE_T(b);
  for (let s = 0; s <= 10; s++) {
    const ts = (s / 10) * dt;
    const age = b - (BLOOM[0] + ts * 1.2);
    if (age <= 0) continue;
    const [x, y] = dovePath(ts);
    blobPath(p, x, y, 30 + 520 * Math.min(1, age) + grow, s * 7.3, b);
  }
  return p;
}
function coverage(b, x, y) {
  // 某一点被颜色覆盖的程度（给人物、钢盔的淡入用），按离晕染边的距离估计
  if (b < BLOOM[0]) return 0;
  if (b >= BLOOM[1]) return 1;
  const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
  let best = 2000 * ease.inOut(t) + 40 - Math.hypot(x - HELMET_SX, y - (ROAD_Y - 40));
  const dt = DOVE_T(b);
  for (let s = 0; s <= 10; s++) {
    const ts = (s / 10) * dt, age = b - (BLOOM[0] + ts * 1.2);
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
  ctx.globalCompositeOperation = 'multiply';
  if (m === 'all') { draw(); ctx.restore(); return; }
  // 羽化：外圈淡一点，内圈完整
  const outer = bloomPath(b, 34);
  ctx.save(); ctx.clip(outer); ctx.globalAlpha = 0.4; draw(); ctx.restore();
  ctx.save(); ctx.clip(m); draw(); ctx.restore();
  // 水彩边缘积色：只描主色团的外缘
  const t = (b - BLOOM[0]) / (BLOOM[1] - BLOOM[0]);
  const r = 40 + 2000 * ease.inOut(t);
  const edge = new Path2D();
  blobPath(edge, HELMET_SX, ROAD_Y - 40, r, 3, b);
  ctx.strokeStyle = rgba('#a9b9c8', 0.25 * smoothstep(250, 700, r)); ctx.lineWidth = 6;
  ctx.stroke(edge);
  ctx.restore();
}

// ---------- 每步一朵花 ----------
const FLOWER_COLS = ['#f28aa5', '#f7c948', '#7fb7e8', '#f59b5a', '#c58fe0'];
function flower(ctx, x, y, s, col, seed) {
  if (s <= 0.01) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // 茎从裂缝里钻出来
  ctx.strokeStyle = '#5f9a45'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -12, 0, -26); ctx.stroke();
  ctx.fillStyle = '#7fbf5e'; ellipse(ctx, 6, -12, 7, 3.5, -0.6); ctx.fill();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + seed;
    ellipse(ctx, Math.cos(a) * 8, -30 + Math.sin(a) * 8, 7, 5, a); ctx.fillStyle = col; ctx.fill();
  }
  circle(ctx, 0, -30, 4.5); ctx.fillStyle = '#fbe6a0'; ctx.fill();
  sketchEllipse(ctx, 0, -30, 14, 14, { seed: seed * 10, color: LEAD_D, width: 1, jitter: 1.4, passes: 1, alpha: 0.6 });
  ctx.restore();
}
function drawFlowers(ctx, b, env) {
  // 每个拍点（走路时一拍一步）在前脚落地处冒一朵花；定格的第 9–12 拍不冒
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

// ---------- 钢盔、白鸽 ----------
function helmet(ctx, x, y, rock, color) {
  // 侧倒在地上的旧钢盔，口朝右上
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35 + rock);
  const dome = ellipsePts(0, 0, 58, 44, 22, 0, Math.PI, Math.PI * 2);
  const rim = ellipsePts(0, 0, 70, 12, 22);
  poly(ctx, [...dome, [58, 0], [-58, 0]]); ctx.fillStyle = PAPER_D; ctx.fill();
  if (color > 0) { ctx.globalAlpha = color; poly(ctx, dome); ctx.fillStyle = '#9aa77a'; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.beginPath(); ctx.ellipse(0, 0, 70, 12, 0, 0, Math.PI * 2); ctx.fillStyle = color > 0 ? mix(PAPER_D, '#6f7a55', color * 0.6) : '#ddd3bf'; ctx.fill();
  sketchPoly(ctx, dome, { close: false, seed: 51, color: LEAD_D, width: 1.6 });
  sketchPoly(ctx, rim, { close: false, seed: 52, color: LEAD_D, width: 1.4, over: 1 });
  sketchHatch(ctx, 10, -40, 46, 38, { angle: 1.1, gap: 7, color: LEAD, alpha: 0.5, seed: 53 });
  // 凹痕与弹痕
  sketchEllipse(ctx, -20, -24, 6, 4, { seed: 54, color: LEAD_D, width: 1, passes: 1 });
  sketchLine(ctx, [-38, -10], [-24, -30], { seed: 55, color: LEAD, width: 1 });
  // 垂下的帽带
  sketchPoly(ctx, [[-50, 2], [-40, 22], [-10, 26], [6, 12]], { close: false, seed: 56, color: LEAD_D, width: 1.3 });
  ctx.restore();
}
function dove(ctx, x, y, s, flap, facing = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);
  const body = [[-34, 2], [-18, -10], [10, -12], [24, -20], [38, -18], [50, -10], [42, -6], [30, 6], [4, 14], [-24, 10], [-48, 18], [-44, 4]];
  const wa = -1.1 + flap * 2.0;
  const wing = [[-6, -6], [-14 + Math.cos(wa) * 22, -6 + Math.sin(wa) * 46], [-30 + Math.cos(wa) * 40, -6 + Math.sin(wa) * 62], [-24, 0], [12, -2]];
  for (const p of [body, wing]) { poly(ctx, p); ctx.fillStyle = '#ffffff'; ctx.fill(); }
  sketchPoly(ctx, body, { seed: 71, color: LEAD_D, width: 1.6 / s, over: 2 });
  sketchPoly(ctx, wing, { seed: 72, color: LEAD_D, width: 1.4 / s, over: 2 });
  for (let k = 0; k < 3; k++) sketchLine(ctx, [-8 - k * 7, -4], [-16 + Math.cos(wa) * 20 * (0.4 + k * 0.18) - k * 6, -6 + Math.sin(wa) * 40 * (0.4 + k * 0.18)], { seed: 73 + k, color: LEAD, width: 1 / s, passes: 1 });
  circle(ctx, 38, -14, 2.2); ctx.fillStyle = LEAD_D; ctx.fill();
  poly(ctx, [[49, -12], [58, -9], [49, -7]]); ctx.fillStyle = '#e0a060'; ctx.fill();
  ctx.restore();
}

// ---------- 标题卡、播放器（铅笔速写） ----------
function paperCard(ctx, x, y, w, h, seed) {
  ctx.save();
  ctx.fillStyle = 'rgba(90,80,60,0.12)'; ctx.fillRect(x + 6, y + 8, w, h); // 纸的影子
  ctx.fillStyle = '#fbf6ea'; ctx.fillRect(x, y, w, h);
  sketchPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { seed, color: LEAD_D, width: 1.8, jitter: 1.6, over: 8 });
  sketchHatch(ctx, x + w - 18, y + 8, 14, h - 16, { gap: 5, color: LEAD, alpha: 0.45, seed: seed + 1 });
  // 两条胶带
  for (const [tx, ty, a] of [[x + 18, y - 6, -0.3], [x + w - 40, y + h - 10, -0.25]]) {
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
    ctx.fillStyle = 'rgba(236,226,196,0.85)'; ctx.fillRect(-22, -9, 50, 18);
    sketchPoly(ctx, [[-22, -9], [28, -9], [28, 9], [-22, 9]], { seed: seed + 2, color: LEAD_L, width: 1, passes: 1 });
    ctx.restore();
  }
  ctx.restore();
}
function sketchCassette(ctx, kind, cx, cy, s, spin) {
  const w = 200 * s, h = 128 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#fbf6ea'; roundRect(ctx, -w / 2, -h / 2, w, h, 10); ctx.fill();
  const S = (pts, seed, wd = 1.8) => sketchPoly(ctx, pts, { seed, color: LEAD_D, width: wd, jitter: 1.2, over: 5 });
  S([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], 81, 2);
  S([[-w / 2 + 14, -h / 2 + 12], [w / 2 - 14, -h / 2 + 12], [w / 2 - 14, -h / 2 + 78], [-w / 2 + 14, -h / 2 + 78]], 82, 1.4);
  S([[-52, -h / 2 + 34], [52, -h / 2 + 34], [52, -h / 2 + 68], [-52, -h / 2 + 68]], 83, 1.4);
  sketchHatch(ctx, -50, -h / 2 + 36, 100, 30, { gap: 5, color: LEAD, alpha: 0.35, seed: 84 });
  for (const sx of [-1, 1]) {
    const rx = sx * 34, ry = -h / 2 + 51;
    ctx.fillStyle = '#fbf6ea'; circle(ctx, rx, ry, 11); ctx.fill();
    sketchEllipse(ctx, rx, ry, 11, 11, { seed: 85 + sx, color: LEAD_D, width: 1.4 });
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(spin);
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.strokeStyle = LEAD_D; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(0, -9); ctx.stroke(); }
    ctx.restore();
  }
  S([[-60, h / 2], [-48, h / 2 - 30], [48, h / 2 - 30], [60, h / 2]], 87, 1.4);
  for (const sx of [-1, 1]) sketchEllipse(ctx, sx * 30, h / 2 - 14, 5, 5, { seed: 88 + sx, color: LEAD_D, width: 1.2, passes: 1 });
  ctx.restore();
}

export const s05 = {
  id: 's05',
  station: ST,
  freezeBeat: GAG + 3, // Outro 展墙里定格成已经上色的样子
  drawFigure(ctx, fig, b, env) {
    // 人物：铅笔素描；颜色晕到他身上时，淡入上了水彩的版本
    drawWalker(ctx, { ...fig, style: 'sketch' });
    const k = coverage(b, CHAR_X, ROAD_Y - 260);
    if (k > 0) {
      ctx.save();
      ctx.globalAlpha *= k;
      drawWalker(ctx, { ...fig, style: 'sketch-color' });
      ctx.restore();
    }
  },
  drawBack(ctx, b, env) {
    const cam = env.cam;
    // 纸
    const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1000 * K);
    ctx.drawImage(paperTexture(pw, ph, { base: PAPER, seed: 55, amount: 0.7, fibers: 160 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    // 天空：灰色速写时只有几笔云；晕开后是淡蓝
    ctx.save();
    ctx.strokeStyle = rgba(LEAD_L, 0.55); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const cx = ((k * 470 - cam * 0.05) % 2400 + 2400) % 2400 + X_MIN - 200, cy = 110 + (k % 3) * 70;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.arc(cx + j * 40, cy - (j % 2) * 10, 30 + j * 6, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
    }
    ctx.restore();
    withBloom(ctx, b, () => {
      const g = ctx.createLinearGradient(0, 0, 0, 640);
      g.addColorStop(0, '#9fcbea'); g.addColorStop(0.7, '#cfe6f2'); g.addColorStop(1, '#eef4f4');
      ctx.fillStyle = g; ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 660);
    });
    // 远景、中景、地面：先铅笔，再在晕染区域里叠水彩
    for (const [lines, wash] of [[farLines(env), farWash()], [midLines(env), midWash(env)], [groundLines(env), groundWash(env)]]) {
      drawStrip(ctx, lines, cam);
      withBloom(ctx, b, () => drawStrip(ctx, wash, cam));
    }
    // 钢盔：第 5 拍强拍鸽子钻出来时晃一下
    const hx = HELMET_SX + env.camAt(BLOOM[0]) - cam;
    const u = b - BLOOM[0];
    const rock = u > 0 ? 0.22 * Math.exp(-u * 5) * Math.sin(u * 22) : 0;
    helmet(ctx, hx, ROAD_Y + 4, rock, coverage(b, hx, ROAD_Y));
    drawFlowers(ctx, b, env);
  },
  drawFront(ctx, b, env) {
    const cam = env.cam;
    const fg = fgLines(env);
    drawStrip(ctx, fg.lines, cam);
    withBloom(ctx, b, () => drawStrip(ctx, fg.wash, cam));
    // 白鸽
    if (b >= BLOOM[0] - 0.02 && b < BLOOM[0] + 1.8) {
      const t = DOVE_T(b);
      const [x, y] = dovePath(t);
      const [x2] = dovePath(Math.min(1, t + 0.02));
      dove(ctx, x, y, 1.15 + t * 0.2, (b * 3.2) % 1, x2 >= x ? 1 : -1);
    }
  },
  drawFrame(ctx, R) {
    // 速写画框：纸色木框，铅笔双线 + 排线；这时画面已经上色，木框带一点淡彩
    const t = 64 * R.s, { x, y, w, h } = R;
    ctx.save();
    const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
    ctx.fillStyle = '#efdcbc'; ctx.fill(band, 'evenodd');
    const o = { color: LEAD_D, width: Math.max(1, 2 * R.s), jitter: 1.5 * R.s, over: 10 * R.s };
    sketchPoly(ctx, [[x - t, y - t], [x + w + t, y - t], [x + w + t, y + h + t], [x - t, y + h + t]], { ...o, seed: 91 });
    sketchPoly(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], { ...o, seed: 92 });
    sketchPoly(ctx, [[x - t * 0.5, y - t * 0.5], [x + w + t * 0.5, y - t * 0.5], [x + w + t * 0.5, y + h + t * 0.5], [x - t * 0.5, y + h + t * 0.5]], { ...o, seed: 93, width: Math.max(1, 1.2 * R.s) });
    ctx.restore();
  },
  cardStyle: {
    ink: '#3b3732', accent: '#8c867b', bar: false,
    bgDraw(ctx, x, y, w, h) { paperCard(ctx, x, y, w, h, 101); },
  },
  playerStyle: {
    ink: '#3b3732', noteColor: '#8c867b', backdrop: false,
    plateDraw(ctx, x, y, w, h) { paperCard(ctx, x, y, w, h, 111); },
    drawPlayer(ctx, kind, cx, cy, s, spin) { sketchCassette(ctx, kind, cx, cy, s, spin); },
  },
};
