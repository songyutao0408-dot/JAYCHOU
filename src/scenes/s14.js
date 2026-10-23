// 第 14 站 · 周杰伦的床边故事（Jay Chou's Bedtime Stories, 2016）·「前世情人」· 温馨的父女场景 · 童书绘本水彩
// 整幅画是绘本里的一页：暖色水彩纸、柔和的湿画法、边缘积色、彩铅细线勾边；黄昏前的暖光，造型都圆润可爱。
// 构图（视差由远到近）：
//   0.03 天空：粉紫 → 杏 → 奶油黄的湿画法渐变、气球一样圆鼓鼓的云、山后低垂的暖阳
//   0.12 远山：两排圆润的远山，山脊上一串棒棒糖小树和小房子
//   0.3  近丘：绿色丘陵、田垄、树篱、圆树、小路
//   0.5  小镇：一排绘本小房子，窗里亮着暖灯
//   0.8  小院：白色矮篱笆、花圃；定格处左边是晾衣绳（爸爸的大衬衫挨着小裙子），右后方是家（亮灯的窗、烟囱），最右一棵挂秋千的大树
//   1    沙土小路；小板凳 + 一摞绘本（定格时在他右前方）
//   1.3  前景花草
//   固定：纸纹、四周晕开的页边、装订阴影、页码位置的小月牙（不写数字）
// 人物：s14-wc（暖色水彩 + 暖棕彩铅描边）。小女孩是原创的（圆脸、两个小辫、条纹衫 + 珊瑚红背带裙）。
// 梗：第 5–8 拍她举着纸皇冠从右边小跑过来，跳上板凳上的那摞书；第 9 拍强拍他定格，皇冠「啪」地落在他头顶，冒出小星星；
//     第 10–12 拍她跳下来拍手、转圈；第 13–16 拍他戴着皇冠走向右边（皇冠跟着走路帧的头顶），她挥手。
// 第 14→15 站：transitionOut 撕页——右上角翘起、强拍上整页被撕走，对折再对折成明信片，转着飞进第 15 站。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K, W as CW, H as CH } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { makeCanvas, memo, baked } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { GAG, stationSection } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk, frameIndex, FIGURE_H, ANCHORS } from '../rig/walker.js';
import { registerStyle, watercolor, outline, rgbf } from '../rig/styles.js';
import {
  WC_PAPER, wash, skyWash, dab, glow, dryBrush, blobPts, roughPoly, wcPaper, paperTooth, deckle, drawWcCard,
} from '../kit/watercolor.js';

const ST = stationByN(14);
const TAU = Math.PI * 2;

// 人物：暖色水彩，暗部用暖梅子色（黑衣保留透明感），外面一道暖棕彩铅细描边
registerStyle('s14-wc', (I) => {
  const O = watercolor(I, ['#4a3b4e', '#77606b', '#d4a898', '#fbf1e4'], 0.7);
  outline(O, I.a, 1.6, rgbf('#5b4048'));
  return O;
});

// ---------- 调色板 ----------
const PAPER = WC_PAPER.warm;
const INK = '#5a3f3a', ACCENT = '#d9734e', PENCIL = '#6e4e44';
const SKY = [[0, '#e8bcc0'], [0.3, '#f2cbb0'], [0.62, '#f8dfb6'], [1, '#fcefd6']];
const WALLS = ['#f4cf72', '#f2b08a', '#eea7a2', '#f6e6c4', '#bcd9b8', '#f3d9a0'];
const ROOFS = ['#d46a50', '#a8687a', '#b9785a', '#c9705e'];
const LIT = '#ffe3a0';
const FLOWERS = ['#f08aa6', '#f6c445', '#ffffff', '#e86a5a', '#c7a4dc', '#f4a3a8'];
const SKIN = '#f7d3bb', SKIN_E = '#e3a58c', CHEEK = '#f19a8c', HAIR = '#7a5040', HAIR_E = '#5b3a2e';
const DRESS = '#e0705a', DRESS_E = '#c0503e', SHIRT = '#fdf3dc', STRIPE = '#9cc0dc', RIBBON = '#f2c14e', SHOE = '#b8483e';

const P_SKY = 0.03, P_FAR = 0.12, P_HILL = 0.3, P_TOWN = 0.5, P_YARD = 0.8, P_FORE = 1.3;
const FENCE_TOP = 694, FENCE_BASE = 774, YARD_BASE = 742;
const GROUND_Y = 795;                 // 小女孩和板凳站的地方（比他走的路面略靠后）
const STOOL_SCREEN = 426;             // 定格时板凳中心的画面 x
const STOOL_H = 94, BOOKS_H = 78, STACK_H = STOOL_H + BOOKS_H, TOP_Y = GROUND_Y - STACK_H;
const SEAT = 22;                      // 皇冠下沿压在头顶下多少单位（盖住头顶的弧）
const ARM = 138;                      // 小女孩胳膊最长能伸多长（伸直）

// ---------- 梗的拍点 ----------
const T = {
  RUN0: GAG - 3.9,    // 第 5 拍：从右边跑进来
  HOP0: GAG - 1.55,   // 跳上书摞
  HOP1: GAG - 1.1,
  REACH0: GAG - 0.75, // 踮脚、把皇冠举到他头顶上方
  HOVER: GAG - 0.16,
  LAND: GAG,          // 第 9 拍强拍：皇冠落在他头顶
  REL: GAG + 0.12,    // 松手
  DOWN0: GAG + 0.62,  // 从书摞上跳下来
  DOWN1: GAG + 1,     // 第 10 拍落地
  SPIN0: GAG + 2,     // 第 11 拍转圈
  SPIN1: GAG + 3,
  WAVE: GAG + 4,      // 第 13 拍起挥手
};

// ---------- 小工具 ----------
const pathOf = (pts, close = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; };
/** 彩铅线：一遍实线 + 一遍错开一点的淡线。 */
function pencil(ctx, path, { color = PENCIL, w = 1.6, a = 0.85 } = {}) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = color;
  ctx.globalAlpha *= a; ctx.lineWidth = w; ctx.stroke(path);
  ctx.globalAlpha *= 0.45; ctx.lineWidth = w * 0.6; ctx.translate(0.8, -0.6); ctx.stroke(path);
  ctx.restore();
}
/** 每帧可用的「水彩块」：平涂 + 贴着内沿的积色 + 彩铅勾线。 */
function part(ctx, path, fill, edge, { lw = 1.5, line = true, ew = 5, ea = 0.45 } = {}) {
  ctx.fillStyle = fill; ctx.fill(path);
  ctx.save(); ctx.clip(path); ctx.strokeStyle = edge; ctx.globalAlpha *= ea; ctx.lineWidth = ew; ctx.stroke(path); ctx.restore();
  if (line) pencil(ctx, path, { w: lw });
}
function capsuleP(p, a, b, ra, rb = ra) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6, nx = -dy / L, ny = dx / L, ang = Math.atan2(dy, dx);
  p.moveTo(a[0] + nx * ra, a[1] + ny * ra);
  p.lineTo(b[0] + nx * rb, b[1] + ny * rb);
  p.arc(b[0], b[1], rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  p.lineTo(a[0] - nx * ra, a[1] - ny * ra);
  p.arc(a[0], a[1], ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
  p.closePath();
  return p;
}
const ellP = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); return p; };
function starP(cx, cy, r, rot = 0, n = 5, inner = 0.48) {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * inner : r;
    i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath();
  return p;
}
function heartP(cx, cy, s) {
  const p = new Path2D();
  p.moveTo(cx, cy + s * 0.9);
  p.bezierCurveTo(cx - s * 1.3, cy, cx - s * 0.8, cy - s * 1.1, cx, cy - s * 0.35);
  p.bezierCurveTo(cx + s * 0.8, cy - s * 1.1, cx + s * 1.3, cy, cx, cy + s * 0.9);
  p.closePath();
  return p;
}
const WASH = (o) => ({ px: K, soft: 1, edge: 0.9, edgeW: 3, vary: 0.3, grain: 0.3, ...o });

// ---------- 天空 ----------
function cloudShape(cx, cy, w, seed) {
  const R = rng('s14-cl', seed), p = new Path2D();
  p.ellipse(cx, cy, w * 0.5, w * 0.16, 0, 0, TAU);
  const n = 4 + Math.floor(R() * 2);
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1) - 0.5, bx = cx + t * w * 0.72, r = w * (0.15 + R() * 0.08) * (1 - Math.abs(t) * 0.7);
    p.moveTo(bx + r, cy - r * 0.45); p.arc(bx, cy - r * 0.45, r, 0, TAU);
  }
  return { path: p, bbox: [cx - w * 0.56, cy - w * 0.42, cx + w * 0.56, cy + w * 0.2] };
}
function skyLayer(c8) {
  return strip('s14-sky', P_SKY, (ctx, x0, x1) => {
    skyWash(ctx, x0, 0, x1, 760, SKY, { px: K, seed: 14, bands: 6, blooms: 3, grain: 0.12 });
    // 山后的暖阳（定格时在他右后方）
    const sx = 1060 + c8 * P_SKY;
    glow(ctx, sx, 560, 560, '#fff2cc', 0.7);
    wash(ctx, blobPts(sx, 560, 70, 70, { seed: 3, rough: 0.04, n: 40 }), WASH({ color: '#fff6da', color2: '#ffe3ad', alpha: 0.95, soft: 3, edge: 0.6, edgeW: 4, edgeColor: '#f3c27e', vary: 0.15, grain: 0.1, seed: 5 }));
    // 气球一样圆鼓鼓的云
    const R = rng('s14-clouds');
    for (let i = 0; i < 10; i++) {
      const cx = x0 + ((i + 0.2 + R() * 0.6) / 10) * (x1 - x0), cy = 90 + R() * 250, w = 170 + R() * 160;
      const S = cloudShape(cx, cy, w, i);
      wash(ctx, S, WASH({ color: '#fffaf2', color2: '#f6d8cf', grad: [0, cy - w * 0.35, 0, cy + w * 0.18], alpha: 0.95, soft: 2.5, edge: 1, edgeW: 4, edgeColor: '#e3b1ae', vary: 0.22, grain: 0.12, seed: 30 + i }));
    }
    // 彩铅小鸟
    for (let i = 0; i < 4; i++) {
      const bx = x0 + R() * (x1 - x0), by = 150 + R() * 200, s = 7 + R() * 5;
      dryBrush(ctx, [[bx - s, by - s * 0.5], [bx, by], [bx + s, by - s * 0.6]], { width: 1.8, color: PENCIL, alpha: 0.7, passes: 2, dry: 0.05, seed: i, wobble: 0.3 });
    }
  }, { y0: 0, y1: 760 });
}

// ---------- 远山、近丘 ----------
function ridge(x0, x1, base, amp, f, seed, y1) {
  const top = [];
  for (let x = x0; x <= x1 + 12; x += 12) {
    const s = 0.5 + 0.5 * Math.sin(x * f + seed);
    top.push([x, base - amp * (0.35 + 0.65 * Math.pow(s, 1.5)) - amp * 0.35 * (noise2(x * 0.004, seed, 140) - 0.5)]);
  }
  return { top, pts: [...top, [x1 + 12, y1], [x0, y1]] };
}
function lollipop(ctx, x, y, r, col, seed) {
  dryBrush(ctx, [[x, y], [x, y - r * 1.4]], { width: Math.max(1.2, r * 0.25), color: '#8a6a4e', alpha: 0.8, passes: 1, dry: 0.05, seed });
  dab(ctx, x, y - r * 1.9, r, col, { alpha: 0.95, edge: 0.6, seed, rough: 0.12, edgeColor: mix(col, '#4a5a2a', 0.4) });
}
function farLayer() {
  return strip('s14-far', P_FAR, (ctx, x0, x1) => {
    const A = ridge(x0, x1, 560, 120, 0.0042, 2, 740);
    wash(ctx, roughPoly(A.pts, { amp: 1.5, step: 12, seed: 1 }), WASH({ color: '#d9d5a8', color2: '#f2e2c2', grad: [0, 440, 0, 700], alpha: 0.9, soft: 2.5, edge: 0.8, edgeW: 4, edgeColor: '#b8b585', vary: 0.35, grain: 0.2, seed: 11 }));
    const R = rng('s14-far');
    for (let i = 0; i < A.top.length; i += 3 + Math.floor(R() * 5)) {
      const [x, y] = A.top[i];
      if (R() < 0.5) lollipop(ctx, x, y + 6, 4 + R() * 3, '#a7b77c', i);
    }
    const B = ridge(x0, x1, 628, 90, 0.0061, 5, 740);
    wash(ctx, roughPoly(B.pts, { amp: 1.5, step: 12, seed: 2 }), WASH({ color: '#c5cd95', color2: '#e9e0b8', grad: [0, 540, 0, 720], alpha: 0.92, soft: 2, edge: 0.9, edgeW: 4, edgeColor: '#9fae74', vary: 0.35, grain: 0.22, seed: 12 }));
    for (let i = 0; i < B.top.length; i += 4 + Math.floor(R() * 6)) {
      const [x, y] = B.top[i];
      const k = R();
      if (k < 0.45) lollipop(ctx, x, y + 8, 5 + R() * 4, '#93ad6f', i + 100);
      else if (k < 0.6) {
        // 远处的小房子：一个色点 + 红屋顶
        ctx.fillStyle = '#fbf0dc'; ctx.fillRect(x - 7, y + 2, 14, 11);
        ctx.fillStyle = '#d46a50'; ctx.beginPath(); ctx.moveTo(x - 9, y + 3); ctx.lineTo(x, y - 6); ctx.lineTo(x + 9, y + 3); ctx.fill();
      }
    }
    wash(ctx, [[x0, 640], [x1, 640], [x1, 740], [x0, 740]], WASH({ color: '#f6e6c8', color2: '#f8ead0', alpha: 0.55, soft: 16, edge: 0, vary: 0.4, grain: 0, seed: 13 }));
  }, { y0: 400, y1: 740 });
}
function hillLayer() {
  return strip('s14-hill', P_HILL, (ctx, x0, x1) => {
    const A = ridge(x0, x1, 640, 80, 0.0035, 9, 760);
    const pts = roughPoly(A.pts, { amp: 1.5, step: 12, seed: 3 });
    wash(ctx, pts, WASH({ color: '#b6cc86', color2: '#cfd99c', grad: [0, 560, 0, 740], alpha: 0.95, soft: 1.5, edge: 1, edgeW: 4, edgeColor: '#8ea767', vary: 0.35, grain: 0.3, seed: 21 }));
    // 田垄条纹 + 树篱
    ctx.save(); ctx.clip(pathOf(pts));
    const R = rng('s14-fields');
    for (let x = x0 - 200; x < x1; x += 140 + R() * 120) {
      const w = 60 + R() * 70, dark = R() < 0.5;
      ctx.fillStyle = rgba(dark ? '#95b26e' : '#e3e2a6', 0.32);
      ctx.beginPath(); ctx.moveTo(x, 760); ctx.lineTo(x + 120, 540); ctx.lineTo(x + 120 + w, 540); ctx.lineTo(x + w, 760); ctx.fill();
      for (let k = 0; k < 9; k++) dab(ctx, x + w + k * 13 * (120 / 220) + 4, 750 - k * 24, 6 + R() * 3, '#86a462', { alpha: 0.8, edge: 0.5, seed: k + Math.round(x), rough: 0.2 });
    }
    ctx.restore();
    // 蜿蜒的小路
    const road = [];
    for (let x = x0; x < x1; x += 20) road.push([x, 700 + Math.sin(x * 0.006) * 22]);
    dryBrush(ctx, road, { width: 9, color: '#f3e3bd', alpha: 0.85, passes: 2, dry: 0.08, seed: 4, wobble: 0.6 });
    // 圆树
    for (let i = 0; i < A.top.length; i += 6 + Math.floor(R() * 10)) {
      const [x, y] = A.top[i];
      const r = 14 + R() * 10;
      lollipop(ctx, x, y + 26 + R() * 30, r, R() < 0.5 ? '#8fb06c' : '#a4c27a', i + 300);
    }
  }, { y0: 520, y1: 760 });
}

// ---------- 小镇 ----------
function windowLit(ctx, x, y, w, h, seed, round = false) {
  const p = new Path2D();
  if (round) p.arc(x + w / 2, y + h / 2, w / 2, 0, TAU); else p.roundRect(x, y, w, h, Math.min(w, h) * 0.18);
  glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.6, '#ffd98a', 0.3);
  part(ctx, p, LIT, '#f2b65a', { lw: 1.3, ew: 3, ea: 0.6 });
  ctx.save(); ctx.strokeStyle = rgba(PENCIL, 0.7); ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(x + w / 2, y + 2); ctx.lineTo(x + w / 2, y + h - 2); ctx.moveTo(x + 2, y + h / 2); ctx.lineTo(x + w - 2, y + h / 2); ctx.stroke();
  ctx.restore();
}
function cottage(ctx, x, base, w, h, wall, roof, seed) {
  const top = base - h, rh = w * (0.4 + 0.22 * hash2(seed, 1, 5));
  if (hash2(seed, 2, 5) < 0.6) {
    const cx = x + w * 0.66;
    wash(ctx, [[cx, top - rh * 0.75], [cx + 16, top - rh * 0.75], [cx + 16, top], [cx, top]], WASH({ color: '#c0644f', alpha: 0.95, soft: 0.6, edge: 0.6, seed }));
  }
  const wp = roughPoly([[x, base], [x, top], [x + w, top], [x + w, base]], { amp: 1.1, step: 9, seed });
  wash(ctx, wp, WASH({ color: wall, color2: mix(wall, '#e9a77a', 0.22), alpha: 0.97, soft: 0.8, lift: 0.25, seed }));
  pencil(ctx, pathOf(wp), { w: 1.3, a: 0.7 });
  const rp = hash2(seed, 3, 5) < 0.5
    ? roughPoly([[x - 10, top + 4], [x + w / 2, top - rh], [x + w + 10, top + 4]], { amp: 1.2, step: 9, seed: seed + 1 })
    : roughPoly([[x - 10, top + 4], [x + 6, top - rh * 0.75], [x + w / 2, top - rh], [x + w - 6, top - rh * 0.75], [x + w + 10, top + 4]], { amp: 1.2, step: 9, seed: seed + 1 });
  wash(ctx, rp, WASH({ color: roof, color2: mix(roof, '#ffffff', 0.15), alpha: 0.97, soft: 0.8, edge: 1.1, seed: seed + 2 }));
  pencil(ctx, pathOf(rp), { w: 1.3, a: 0.7 });
  const nw = w > 130 ? 2 : 1;
  for (let k = 0; k < nw; k++) {
    const wx = x + (w * (k + 1)) / (nw + 1) - 12;
    windowLit(ctx, wx, top + h * 0.22, 24, 28, seed + k, hash2(seed, k, 9) < 0.25);
  }
  // 门
  const dx = x + w * (hash2(seed, 4, 5) < 0.5 ? 0.18 : 0.62), dw = 22;
  const dp = new Path2D(); dp.moveTo(dx, base); dp.lineTo(dx, base - 34); dp.arc(dx + dw / 2, base - 34, dw / 2, Math.PI, 0); dp.lineTo(dx + dw, base); dp.closePath();
  part(ctx, dp, mix(roof, '#6aa3b0', 0.55), mix(roof, '#3a5a6a', 0.4), { lw: 1.2, ew: 3 });
}
function townLayer(c8) {
  return strip('s14-town', P_TOWN, (ctx, x0, x1) => {
    wash(ctx, roughPoly([[x0, 682], [x1, 682], [x1, 742], [x0, 742]], { amp: 3, step: 20, seed: 4 }), WASH({ color: '#bcd38f', color2: '#a9c97c', alpha: 0.95, soft: 1.5, edge: 0.7, vary: 0.35, seed: 31 }));
    const R = rng('s14-town');
    for (let x = x0 + R() * 60; x < x1;) {
      const w = 96 + R() * 80, h = 74 + R() * 60, base = 690 + R() * 8;
      cottage(ctx, x, base, w, h, WALLS[Math.floor(R() * WALLS.length)], ROOFS[Math.floor(R() * ROOFS.length)], Math.floor(R() * 9999));
      // 房子之间：圆灌木 / 棒棒糖树
      const gx = x + w + 20 + R() * 40;
      if (R() < 0.6) lollipop(ctx, gx, base + 2, 16 + R() * 10, R() < 0.5 ? '#8fb06c' : '#9cbc72', Math.round(gx));
      for (let k = 0; k < 3; k++) dab(ctx, x + R() * w, base + 2, 9 + R() * 7, '#9cbc72', { alpha: 0.95, edge: 0.6, seed: k + Math.round(x), rough: 0.2, edgeColor: '#6f8a4e' });
      x += w + 50 + R() * 120;
    }
  }, { y0: 330, y1: 745 });
}

// ---------- 小院（定格时：晾衣绳、家、秋千树） ----------
const HOME_X = 820, LINE_L = -330, LINE_R = 70, TREE_X = 1170;
function yardGeo(c8) { const o = c8 * P_YARD; return { home: HOME_X + o, ll: LINE_L + o, lr: LINE_R + o, tree: TREE_X + o, cat: 182 + o }; }

function home(ctx, cx) {
  const L = cx - 200, Rr = cx + 190, top = 470;
  // 烟囱（在屋顶后面）
  wash(ctx, roughPoly([[cx + 92, 318], [cx + 132, 318], [cx + 132, 420], [cx + 92, 420]], { amp: 1, step: 8, seed: 70 }), WASH({ color: '#c0644f', color2: '#a9553f', alpha: 0.97, seed: 70 }));
  dryBrush(ctx, [[cx + 86, 318], [cx + 138, 318]], { width: 7, color: '#8f4a3a', alpha: 0.9, passes: 2, dry: 0.05, seed: 71 });
  // 墙
  const wp = roughPoly([[L, YARD_BASE], [L, top], [Rr, top], [Rr, YARD_BASE]], { amp: 1.2, step: 10, seed: 72 });
  wash(ctx, wp, WASH({ color: '#f4cf72', color2: '#efbb5e', alpha: 0.98, soft: 1, edge: 1, edgeW: 4, lift: 0.35, blooms: 1, seed: 72 }));
  pencil(ctx, pathOf(wp), { w: 1.7 });
  // 屋顶：陡峭的人字顶，圆圆的檐
  const rp = roughPoly([[L - 34, top + 14], [cx - 5, 292], [Rr + 34, top + 14]], { amp: 1.4, step: 10, seed: 73 });
  wash(ctx, rp, WASH({ color: '#d46a50', color2: '#c95a44', alpha: 0.98, soft: 1, edge: 1.2, edgeW: 4, lift: 0.3, seed: 73 }));
  ctx.save(); ctx.clip(pathOf(rp));
  ctx.strokeStyle = rgba('#9a3f2e', 0.45); ctx.lineWidth = 2;
  for (let y = 330, r = 0; y < top + 14; y += 24, r++) {
    ctx.beginPath();
    for (let x = L - 40 + (r % 2) * 13; x < Rr + 40; x += 26) { ctx.moveTo(x, y); ctx.arc(x + 13, y, 13, Math.PI, 0, true); }
    ctx.stroke();
  }
  ctx.restore();
  pencil(ctx, pathOf(rp), { w: 1.7 });
  // 阁楼圆窗
  windowLit(ctx, cx - 37, 360, 64, 64, 74, true);
  pencil(ctx, ellP(cx - 5, 392, 36, 36), { w: 2 });
  // 楼下大窗：暖灯、粉色窗帘、窗下花箱、薄荷色百叶
  for (const sx of [L + 12, L + 132]) {
    const sp = roughPoly([[sx, 516], [sx + 26, 516], [sx + 26, 630], [sx, 630]], { amp: 0.8, step: 8, seed: sx });
    wash(ctx, sp, WASH({ color: '#8fc0ae', alpha: 0.95, soft: 0.6, seed: 75 }));
    pencil(ctx, pathOf(sp), { w: 1.3 });
    pencil(ctx, heartP(sx + 13, 548, 5), { w: 1.2 });
  }
  windowLit(ctx, L + 40, 516, 90, 114, 76);
  for (const [a, b] of [[L + 40, L + 62], [L + 108, L + 130]]) wash(ctx, [[a, 518], [b, 518], [b + (a < L + 80 ? -6 : 6), 628], [a, 628]], WASH({ color: '#eea3a3', alpha: 0.8, soft: 1, edge: 0.8, seed: a }));
  // 屋里的台灯：灯罩 + 光
  glow(ctx, L + 85, 596, 60, '#ffe2a0', 0.5);
  wash(ctx, [[L + 74, 588], [L + 96, 588], [L + 100, 604], [L + 70, 604]], WASH({ color: '#f6a46e', alpha: 0.95, seed: 77 }));
  const box = roughPoly([[L + 26, 632], [L + 146, 632], [L + 140, 656], [L + 32, 656]], { amp: 0.8, step: 8, seed: 78 });
  wash(ctx, box, WASH({ color: '#b9785a', alpha: 0.97, seed: 78 }));
  pencil(ctx, pathOf(box), { w: 1.3 });
  for (let k = 0; k < 9; k++) dab(ctx, L + 34 + k * 13, 628 - (k % 2) * 6, 7, FLOWERS[k % FLOWERS.length], { alpha: 0.95, edge: 0.7, seed: k + 80, edgeColor: '#a0505a' });
  // 门：绿色圆顶门、门上小圆窗、门把手；门灯
  const dx = cx + 18, dw = 74;
  const dp = new Path2D(); dp.moveTo(dx, YARD_BASE); dp.lineTo(dx, 590); dp.arc(dx + dw / 2, 590, dw / 2, Math.PI, 0); dp.lineTo(dx + dw, YARD_BASE); dp.closePath();
  wash(ctx, { path: dp, bbox: [dx, 553, dx + dw, YARD_BASE] }, WASH({ color: '#6aa3b0', color2: '#5a91a0', alpha: 0.97, lift: 0.3, seed: 79 }));
  pencil(ctx, dp, { w: 1.6 });
  windowLit(ctx, dx + dw / 2 - 12, 572, 24, 24, 81, true);
  dab(ctx, dx + dw - 14, 668, 5, '#f2c14e', { alpha: 1, edge: 0.7, seed: 82 });
  glow(ctx, cx + 116, 566, 90, '#ffe0a0', 0.55);
  dab(ctx, cx + 116, 566, 9, '#fff1c8', { alpha: 1, edge: 0.5, seed: 83, edgeColor: '#d9a050' });
  // 右边小窗
  windowLit(ctx, Rr - 60, 520, 40, 56, 84);
  // 台阶
  const step = roughPoly([[dx - 12, YARD_BASE - 6], [dx + dw + 12, YARD_BASE - 6], [dx + dw + 12, YARD_BASE + 8], [dx - 12, YARD_BASE + 8]], { amp: 0.8, step: 8, seed: 85 });
  wash(ctx, step, WASH({ color: '#d9cbb6', alpha: 0.97, seed: 85 }));
  // 墙边的蜀葵
  for (const hx of [L - 16, Rr + 12]) {
    dryBrush(ctx, [[hx, YARD_BASE], [hx + 3, 560]], { width: 4, color: '#7fa45a', alpha: 0.9, passes: 2, dry: 0.05, seed: hx });
    for (let k = 0; k < 6; k++) dab(ctx, hx + (k % 2 ? 7 : -5), 575 + k * 26, 10 - k * 0.6, k % 2 ? '#f08aa6' : '#f4a3a8', { alpha: 0.95, edge: 0.7, seed: k + hx, edgeColor: '#b4506a' });
  }
}
const CLOTHES = [
  // [t, 形状, 颜色]：爸爸的大衬衫挨着小女孩的小裙子和一对小袜子
  [0.2, [[-60, 0], [-92, 30], [-78, 50], [-52, 32], [-50, 130], [50, 130], [52, 32], [78, 50], [92, 30], [60, 0], [16, 0], [0, 16], [-16, 0]], '#9cc3dd'],
  [0.47, [[-18, 0], [-24, 18], [-38, 82], [38, 82], [24, 18], [18, 0], [8, 0], [0, 9], [-8, 0]], '#e88a72'],
  [0.62, [[-6, 0], [6, 0], [6, 30], [16, 34], [16, 42], [-6, 42]], '#f2c14e'],
  [0.69, [[-6, 0], [6, 0], [6, 30], [16, 34], [16, 42], [-6, 42]], '#f4a3a8'],
  [0.85, [[-30, 0], [30, 0], [30, 80], [-30, 80]], '#a8d4c0'],
];
function clothesline(ctx, l, r) {
  for (const x of [l, r]) {
    dryBrush(ctx, [[x, FENCE_BASE], [x, 470]], { width: 7, color: '#9a6a4a', alpha: 0.95, passes: 3, dry: 0.05, seed: Math.round(x) });
    dryBrush(ctx, [[x - 18, 474], [x + 18, 474]], { width: 6, color: '#9a6a4a', alpha: 0.95, passes: 2, dry: 0.05, seed: Math.round(x) + 1 });
  }
  const ly = (t) => 478 + 44 * 4 * t * (1 - t);
  const line = [];
  for (let i = 0; i <= 20; i++) { const t = i / 20; line.push([lerp(l, r, t), ly(t)]); }
  dryBrush(ctx, line, { width: 1.8, color: PENCIL, alpha: 0.8, passes: 2, dry: 0.02, seed: 90, wobble: 0.3 });
  CLOTHES.forEach(([t, shape, col], i) => {
    const hx = lerp(l, r, t), hy = ly(t) + 1;
    const pts = roughPoly(shape.map(([x, y]) => [hx + x, hy + y]), { amp: 0.8, step: 8, seed: 91 + i });
    wash(ctx, pts, WASH({ color: col, color2: mix(col, '#ffffff', 0.25), alpha: 0.95, lift: 0.3, seed: 91 + i }));
    if (i === 4) { ctx.save(); ctx.clip(pathOf(pts)); ctx.fillStyle = rgba('#ffffff', 0.6); for (let k = 0; k < 3; k++) ctx.fillRect(hx - 32, hy + 14 + k * 22, 64, 6); ctx.restore(); }
    if (i === 0) for (let k = 0; k < 4; k++) dab(ctx, hx, hy + 30 + k * 22, 2.4, '#ffffff', { alpha: 0.9, edge: 0.6, seed: k });
    pencil(ctx, pathOf(pts), { w: 1.4 });
    // 夹子
    const pins = i === 0 ? [-40, 40] : [0];
    for (const px of pins) { ctx.fillStyle = '#c98a5a'; ctx.fillRect(hx + px - 3, hy - 7, 6, 14); }
  });
}
function swingTree(ctx, tx) {
  const trunk = roughPoly([[tx - 22, FENCE_BASE], [tx - 14, 520], [tx - 40, 498], [tx - 150, 494], [tx - 150, 510], [tx - 34, 520], [tx - 10, 470], [tx + 12, 470], [tx + 20, FENCE_BASE]], { amp: 1.4, step: 10, seed: 95 });
  wash(ctx, trunk, WASH({ color: '#a0724f', color2: '#8a6040', alpha: 0.97, seed: 95 }));
  pencil(ctx, pathOf(trunk), { w: 1.6 });
  const R = rng('s14-tree');
  const cols = ['#93b86a', '#a9c77a', '#86ad62', '#b2cf84'];
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU, cx = tx - 20 + Math.cos(a) * 110 * (0.6 + R() * 0.4), cy = 390 + Math.sin(a) * 70 * (0.6 + R() * 0.4), r = 70 + R() * 40;
    wash(ctx, blobPts(cx, cy, r, r * 0.85, { seed: 96 + k, rough: 0.2 }), WASH({ color: cols[k % 4], alpha: 0.9, soft: 2, edge: 1.1, edgeW: 4, edgeColor: '#7fa05a', vary: 0.35, seed: 96 + k }));
  }
  for (let k = 0; k < 7; k++) dab(ctx, tx - 120 + R() * 200, 330 + R() * 120, 6, '#e86a5a', { alpha: 0.9, edge: 0.6, seed: k + 120 });
}
function fence(ctx, x0, x1, gate) {
  ctx.save();
  // 两道横杆
  for (const y of [714, 752]) {
    const p = new Path2D(); p.rect(x0, y - 5, x1 - x0, 10);
    ctx.fillStyle = '#fff3e0'; ctx.fill(p);
    ctx.strokeStyle = rgba(PENCIL, 0.6); ctx.lineWidth = 1.3; ctx.stroke(p);
  }
  for (let x = Math.floor(x0 / 30) * 30; x < x1; x += 30) {
    if (gate && x > gate[0] && x < gate[1]) continue;
    const j = (hash2(Math.round(x), 1, 33) - 0.5) * 4, h = FENCE_TOP + j;
    const p = new Path2D(); p.moveTo(x - 8, FENCE_BASE); p.lineTo(x - 8, h + 8); p.quadraticCurveTo(x, h - 6, x + 8, h + 8); p.lineTo(x + 8, FENCE_BASE); p.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(p);
    ctx.save(); ctx.clip(p); ctx.fillStyle = rgba('#e3c9a8', 0.6); ctx.fillRect(x + 3, h - 10, 6, FENCE_BASE - h + 10); ctx.restore();
    pencil(ctx, p, { w: 1.3, a: 0.75 });
  }
  ctx.restore();
}
function yardLayer(c8) {
  const G = yardGeo(c8);
  return strip('s14-yard', P_YARD, (ctx, x0, x1) => {
    // 草坪
    wash(ctx, roughPoly([[x0, 712], [x1, 712], [x1, 790], [x0, 790]], { amp: 3, step: 20, seed: 6 }), WASH({ color: '#a9c97c', color2: '#b8d28a', alpha: 0.98, soft: 1.5, edge: 0.7, vary: 0.35, seed: 41 }));
    // 远离定格画面的地方：树和灌木
    const R = rng('s14-yard');
    for (let x = x0 + 100; x < x1; x += 380 + R() * 380) {
      if (x > G.ll - 260 && x < G.tree + 320) continue;
      const r = 60 + R() * 40;
      dryBrush(ctx, [[x, FENCE_BASE], [x, FENCE_BASE - 200]], { width: 12, color: '#9a6a4a', alpha: 0.9, passes: 3, dry: 0.05, seed: Math.round(x) });
      for (let k = 0; k < 4; k++) wash(ctx, blobPts(x + (k - 1.5) * r * 0.5, FENCE_BASE - 230 - (k % 2) * 40, r * 0.8, r * 0.7, { seed: k + Math.round(x), rough: 0.2 }), WASH({ color: ['#93b86a', '#a9c77a', '#86ad62'][k % 3], alpha: 0.85, soft: 2, edge: 1.1, edgeColor: '#7fa05a', vary: 0.35, seed: k + Math.round(x) }));
    }
    clothesline(ctx, G.ll, G.lr);
    home(ctx, G.home);
    swingTree(ctx, G.tree);
    fence(ctx, x0, x1, [G.home + 8, G.home + 102]);
    // 猫蹲的那根粗一点的篱笆柱
    const pp = roughPoly([[G.cat - 16, FENCE_BASE], [G.cat - 16, FENCE_TOP - 12], [G.cat + 16, FENCE_TOP - 12], [G.cat + 16, FENCE_BASE]], { amp: 0.6, step: 8, seed: 50 });
    wash(ctx, pp, WASH({ color: '#f6e8d0', alpha: 1, soft: 0.6, seed: 50 }));
    pencil(ctx, pathOf(pp), { w: 1.4 });
    // 篱笆前的花圃
    for (let x = x0 + 20; x < x1; x += 34 + R() * 30) {
      const n = 2 + Math.floor(R() * 3);
      for (let k = 0; k < 3; k++) dab(ctx, x + (k - 1) * 10, FENCE_BASE + 2 - R() * 6, 8, '#86ad62', { alpha: 0.9, edge: 0.5, seed: k + Math.round(x), ry: 5, edgeColor: '#5f8040' });
      for (let k = 0; k < n; k++) {
        const fx = x + (R() - 0.5) * 30, fy = FENCE_BASE - 10 - R() * 26;
        dryBrush(ctx, [[fx, FENCE_BASE], [fx, fy]], { width: 1.6, color: '#7fa45a', alpha: 0.85, passes: 1, dry: 0, seed: k });
        const col = FLOWERS[Math.floor(R() * FLOWERS.length)];
        dab(ctx, fx, fy, 5 + R() * 3, col, { alpha: 0.95, edge: 0.7, seed: k + Math.round(x), rough: 0.25, edgeColor: mix(col, '#7a3a3a', 0.4) });
        dab(ctx, fx, fy, 1.6, '#f2b03a', { alpha: 1, edge: 0, seed: k });
      }
    }
  }, { y0: 200, y1: 792 });
}

// ---------- 路 ----------
function groundLayer() {
  return strip('s14-ground', 1, (ctx, x0, x1) => {
    wash(ctx, [[x0, 752], [x1, 752], [x1, 800], [x0, 800]], WASH({ color: '#a7c97a', color2: '#b6d088', alpha: 1, soft: 1, edge: 0, vary: 0.35, seed: 51 }));
    const top = [], bot = [];
    for (let x = x0; x <= x1 + 12; x += 12) { top.push([x, 781 + (noise2(x * 0.01, 1, 52) - 0.5) * 8]); bot.push([x, 874 + (noise2(x * 0.008, 2, 52) - 0.5) * 12]); }
    wash(ctx, roughPoly([[x0, 870], [x1, 870], [x1, 1000], [x0, 1000]], { amp: 2, step: 20, seed: 53 }), WASH({ color: '#a5ca78', color2: '#93ba68', alpha: 1, soft: 1, edge: 0, vary: 0.35, grain: 0.3, seed: 53 }));
    const path = [...top, ...bot.reverse()];
    wash(ctx, path, WASH({ color: '#f2dbb0', color2: '#e7c896', alpha: 1, soft: 1.2, edge: 1, edgeW: 4, edgeColor: '#cfa772', vary: 0.35, grain: 0.35, seed: 54 }));
    const R = rng('s14-ground');
    for (let i = 0; i < (x1 - x0) / 26; i++) {
      const x = x0 + R() * (x1 - x0), y = 790 + R() * 76;
      dab(ctx, x, y, 2 + R() * 3, R() < 0.5 ? '#d9b98a' : '#e9d2aa', { alpha: 0.8, edge: 0.7, seed: i, ry: 1.5 + R() * 2, edgeColor: '#a88a60' });
    }
    // 草叶和小花
    for (let i = 0; i < (x1 - x0) / 9; i++) {
      const x = x0 + R() * (x1 - x0), y = 878 + R() * 120, h = 8 + R() * 12;
      dryBrush(ctx, [[x, y], [x + (R() - 0.5) * 6, y - h]], { width: 1.5, color: R() < 0.5 ? '#7fa45a' : '#6f944e', alpha: 0.6, passes: 1, dry: 0, seed: i });
    }
    for (let i = 0; i < (x1 - x0) / 34; i++) {
      const x = x0 + R() * (x1 - x0), y = 890 + R() * 100, col = FLOWERS[Math.floor(R() * FLOWERS.length)];
      dab(ctx, x, y, 3 + R() * 2.5, col, { alpha: 0.95, edge: 0.6, seed: i + 7, edgeColor: mix(col, '#7a3a3a', 0.4) });
    }
    for (let x = x0; x < x1; x += 10) dryBrush(ctx, [[x, 784 + (noise2(x * 0.01, 1, 52) - 0.5) * 8], [x + 3, 772 + R() * 4]], { width: 1.4, color: '#7fa45a', alpha: 0.55, passes: 1, dry: 0, seed: Math.round(x) });
  }, { y0: 745, y1: 1000 });
}
function foreLayer(c8) {
  return strip('s14-fore', P_FORE, (ctx, x0, x1) => {
    const R = rng('s14-fore');
    const spots = [];
    for (let x = x0 + 300; x < x1; x += 700 + R() * 700) spots.push(x);
    spots.push(-250 + c8 * P_FORE);
    for (const x of spots) {
      for (let k = 0; k < 9; k++) {
        const bx = x + (R() - 0.5) * 120, h = 50 + R() * 70;
        dryBrush(ctx, [[bx, 1004], [bx + (R() - 0.5) * 30, 1004 - h]], { width: 4, color: R() < 0.5 ? '#7fa45a' : '#93b86a', alpha: 0.9, passes: 2, dry: 0, seed: k + Math.round(x) });
      }
      for (let k = 0; k < 5; k++) {
        const col = FLOWERS[Math.floor(R() * FLOWERS.length)];
        dab(ctx, x + (R() - 0.5) * 110, 940 - R() * 50, 11 + R() * 5, col, { alpha: 0.95, edge: 0.7, seed: k + Math.round(x), rough: 0.25, edgeColor: mix(col, '#7a3a3a', 0.4) });
      }
    }
  }, { y0: 860, y1: 1004 });
}

// ---------- 纸（固定在画面上） ----------
function ornament() {
  return baked('s14-ornament', 120 * 2, 60 * 2, (ctx) => {
    ctx.scale(2, 2);
    const moon = new Path2D(); moon.arc(60, 30, 16, 0, TAU); moon.arc(67, 25, 14, 0, TAU, true);
    wash(ctx, { path: moon, bbox: [44, 14, 76, 46] }, { color: '#f6d36a', color2: '#f2b84a', alpha: 1, px: 2, soft: 0.6, edge: 1, edgeW: 2, edgeColor: '#d9962c', vary: 0.2, grain: 0.2, seed: 3 });
    pencil(ctx, moon, { w: 1.2 });
    for (const [x, y, r] of [[28, 30, 7], [94, 26, 6]]) { const s = starP(x, y, r); ctx.fillStyle = '#f6c84c'; ctx.fill(s); pencil(ctx, s, { w: 1 }); }
    ctx.fillStyle = rgba(PENCIL, 0.6); for (const [x, y] of [[14, 32], [108, 30]]) { ctx.beginPath(); ctx.arc(x, y, 1.6, 0, TAU); ctx.fill(); }
  });
}
function paperOverlay(ctx) {
  const pw = Math.round((X_MAX - X_MIN) * K), ph = Math.round(1000 * K);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(paperTooth(pw, ph, { seed: 14, amount: 0.8 }), X_MIN, 0, X_MAX - X_MIN, 1000);
  // 装订阴影（左边）
  const g = ctx.createLinearGradient(X_MIN, 0, X_MIN + 80, 0);
  g.addColorStop(0, rgba('#c9ab84', 0.45)); g.addColorStop(1, rgba('#c9ab84', 0));
  ctx.fillStyle = g; ctx.fillRect(X_MIN, 0, 80, 1000);
  ctx.restore();
  ctx.drawImage(deckle(pw, ph, { color: PAPER, seed: 14, sides: { top: 12, right: 26, bottom: 46, left: 30 } }), X_MIN, 0, X_MAX - X_MIN, 1000);
  // 页码的位置：一个小月牙 + 两颗小星星（不写数字）
  ctx.drawImage(ornament(), 500 - 40, 966, 80, 40);
}

// ---------- 纸皇冠 ----------
const CROWN_PTS = [[-37, 0], [37, 0], [37, -26], [39, -54], [27.7, -30], [18.5, -60], [9.2, -31], [0, -67], [-9.2, -31], [-18.5, -60], [-27.7, -30], [-39, -54], [-37, -26]];
const CS = 3, CPAD = 14;
function crownImage() {
  const x0 = -46 - CPAD, y0 = -76 - CPAD, w = 92 + 2 * CPAD, h = 82 + 2 * CPAD;
  const img = baked('s14-crown', w * CS, h * CS, (ctx) => {
    ctx.scale(CS, CS); ctx.translate(-x0, -y0);
    const pts = roughPoly(CROWN_PTS, { amp: 0.5, step: 5, seed: 7 });
    wash(ctx, pts, { color: '#f7cf55', color2: '#f0ac36', alpha: 1, px: CS, soft: 0.8, edge: 1.3, edgeW: 5, edgeColor: '#d48c26', vary: 0.3, grain: 0.25, lift: 0.4, seed: 8 });
    const P = pathOf(pts);
    ctx.save(); ctx.clip(P);
    ctx.strokeStyle = rgba('#c47a1e', 0.55); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-40, -25); ctx.lineTo(40, -25); ctx.moveTo(-40, -4); ctx.lineTo(40, -4); ctx.stroke();
    ctx.restore();
    // 贴纸星星（亮片）
    [[-21, -14, '#f08aa6'], [0, -15, '#7fb4dc'], [21, -14, '#e86a5a']].forEach(([x, y, c], i) => { const s = starP(x, y, 7.5, i * 0.2); ctx.fillStyle = c; ctx.fill(s); pencil(ctx, s, { w: 0.8 }); });
    pencil(ctx, P, { w: 1.3, color: '#8a5a2a' });
    // 尖上的小绒球
    [[-39, -56, '#f08aa6'], [-18.5, -62, '#7fb4dc'], [0, -69, '#f6e27a'], [18.5, -62, '#f08aa6'], [39, -56, '#7fb4dc']].forEach(([x, y, c]) => { const p = ellP(x, y, 5, 5); ctx.fillStyle = c; ctx.fill(p); pencil(ctx, p, { w: 0.8 }); });
    // 亮晶晶的小点
    ctx.fillStyle = '#ffffff';
    for (const [x, y] of [[-30, -40], [-10, -44], [12, -40], [30, -36], [-4, -22], [10, -8], [-14, -6]]) { ctx.beginPath(); ctx.arc(x, y, 1.1, 0, TAU); ctx.fill(); }
  });
  return { img, x0, y0, w, h };
}
function drawCrown(ctx, x, y, rot = 0, sx = 1, sy = 1) {
  const C = crownImage();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
  ctx.drawImage(C.img, C.x0, C.y0, C.w, C.h);
  ctx.restore();
}

// ---------- 他的头顶（从站立帧、每一帧走路图里量出来） ----------
function headTrack() {
  const Wk = activeWalk();
  if (!Wk) return null;
  return memo(`s14-head|${Wk.name}`, () => {
    const m = Wk.meta, sc = FIGURE_H / m.personHeight;
    const measure = (im, fb) => {
      if (!im) return fb;
      const c = makeCanvas(m.width, m.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, m.width, Math.round(m.height * 0.3)).data, w = m.width;
      let top = -1;
      for (let y = 0; y < m.height * 0.3 && top < 0; y++) { let n = 0; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) n++; if (n >= 3) top = y; }
      if (top < 0) return fb;
      const ry = Math.min(Math.round(m.height * 0.3) - 1, top + 24);
      let a = -1, b = -1;
      for (let x = 0; x < w; x++) if (d[(ry * w + x) * 4 + 3] > 128) { if (a < 0) a = x; b = x; }
      return [((a + b) / 2 - m.anchorX) * sc, (top - m.baseY) * sc];
    };
    const raw = Wk.frames.map((im) => measure(im, ANCHORS.walk.headTop));
    const n = raw.length;
    const walk = raw.map((_, i) => {
      let sx = 0, sy = 0, sw = 0;
      for (let k = -1; k <= 1; k++) { const p = raw[(i + k + n) % n], wt = 2 - Math.abs(k); sx += p[0] * wt; sy += p[1] * wt; sw += wt; }
      return [sx / sw, sy / sw];
    });
    return { walk, stand: measure(Wk.stand, ANCHORS.stand.headTop) };
  });
}
const standHead = () => { const H = headTrack(); return H ? H.stand : ANCHORS.stand.headTop; };
const stoolWX = (env) => STOOL_SCREEN + env.camAt(GAG);

/** 皇冠在哪：null（还没出现）| { mode: 'girl' } | { mode: 'screen', x, y, rot } | { mode: 'head', local: [x, y], rot, sx, sy }。 */
function crownPose(b, env, fig) {
  if (b < T.RUN0) return null;
  if (b < T.REACH0) return { mode: 'girl' };
  if (b < T.LAND && fig.pose !== 'stand') {
    const sX = stoolWX(env) - env.cam, [hx, hy] = standHead();
    const A0 = [-4, -342], A2 = [CHAR_X + hx - STOOL_SCREEN, ROAD_Y + hy + SEAT - TOP_Y], A1 = [A2[0] + 24, A2[1] - 12];
    let p;
    if (b < T.HOVER) { const e = ease.inOut(clamp((b - T.REACH0) / (T.HOVER - T.REACH0))); p = [lerp(A0[0], A1[0], e), lerp(A0[1], A1[1], e) - 26 * Math.sin(Math.PI * e)]; }
    else { const e = ease.in(clamp((b - T.HOVER) / (T.LAND - T.HOVER))); p = [lerp(A1[0], A2[0], e), lerp(A1[1], A2[1], e)]; }
    return { mode: 'screen', x: sX + p[0], y: TOP_Y + p[1], rot: -0.08 };
  }
  // 戴在他头上
  const H = headTrack();
  let head;
  if (fig.pose === 'stand') head = standHead();
  else head = H ? H.walk[frameIndex(fig.phase || 0)] : ANCHORS.walk.headTop;
  const t = b - T.LAND;
  let rot = -0.1;
  if (t >= 0) rot += 0.22 * Math.exp(-5.5 * t) * Math.sin(16 * t);
  for (const [tb, amp] of [[T.DOWN1, 0.07], [T.SPIN1 + 0.7, 0.06]]) { const u = b - tb; if (u >= 0 && u < 1.2) rot += amp * Math.exp(-5 * u) * Math.sin(15 * u); }
  if (fig.pose !== 'stand') rot += 0.035 * Math.sin((fig.phase || 0) * Math.PI);
  const sy = t >= 0 && t < 0.7 ? 1 - 0.17 * Math.exp(-9 * t) * Math.cos(14 * t) : 1;
  return { mode: 'head', local: [head[0] + 2, head[1] + SEAT], rot, sx: 1 / Math.sqrt(sy), sy };
}
/** 皇冠顶在画面上的位置（星星、闪光用）。 */
function crownTopScreen(b, env) {
  const fig = env.figure(), C = crownPose(b, env, fig);
  if (!C || C.mode !== 'head') return null;
  const lean = fig.lean || 0, [lx, ly] = [C.local[0], C.local[1] - 66];
  return [fig.x + (lx * Math.cos(lean) - ly * Math.sin(lean)) * fig.scale, fig.y + (lx * Math.sin(lean) + ly * Math.cos(lean)) * fig.scale];
}

// ---------- 小女孩（原创；矢量形状 + 积色 + 彩铅线，先画进离屏再加一层水彩颗粒） ----------
const GW = 440, GH = 540, GOX = 220, GOY = 480;
function girlBuf() { return memo('s14-girl-buf', () => makeCanvas(GW * K, GH * K)); }
function grainTile14() {
  return memo('s14-grain', () => {
    const N = 128, c = makeCanvas(N, N), g = c.getContext('2d'), im = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const v = noise2(x / 6, y / 6, 3) * 0.6 + hash2(x, y, 4) * 0.4;
      const i = (y * N + x) * 4;
      im.data[i] = 90; im.data[i + 1] = 55; im.data[i + 2] = 40; im.data[i + 3] = smoothstep(0.55, 0.95, v) * 255;
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
function arm(g, S, Hd) {
  let dx = Hd[0] - S[0], dy = Hd[1] - S[1], d = Math.hypot(dx, dy) || 1;
  if (d > ARM) { Hd = [S[0] + (dx / d) * ARM, S[1] + (dy / d) * ARM]; dx = Hd[0] - S[0]; dy = Hd[1] - S[1]; d = ARM; }
  const bend = Math.sqrt(Math.max(0, (ARM / 2) ** 2 - (d / 2) ** 2)) * 0.5;
  let nx = -dy / d, ny = dx / d;
  if (ny < 0) { nx = -nx; ny = -ny; }
  const E = [(S[0] + Hd[0]) / 2 + nx * bend, (S[1] + Hd[1]) / 2 + ny * bend];
  const p = new Path2D(); capsuleP(p, S, E, 8.5, 7.5); capsuleP(p, E, Hd, 7.5, 7);
  part(g, p, SKIN, SKIN_E, { lw: 1.3, ew: 4 });
  part(g, ellP(Hd[0], Hd[1], 10, 10), SKIN, SKIN_E, { lw: 1.3, ew: 4 });
  part(g, ellP(S[0], S[1] + 2, 15, 13), SHIRT, '#d9c7a8', { lw: 1.3, ew: 4 });
}
function leg(g, hip, foot, tip) {
  const p = new Path2D(); capsuleP(p, hip, [foot[0], foot[1] - 8], 8, 7);
  part(g, p, SKIN, SKIN_E, { lw: 1.3, ew: 4 });
  const s = new Path2D(); capsuleP(s, [foot[0], foot[1] - 26], [foot[0], foot[1] - 8], 8.5, 8.5);
  part(g, s, '#fffaf2', '#d9cfc0', { lw: 1.2, ew: 3 });
  part(g, ellP(foot[0] - 5, foot[1] - 6, 15, 8, tip ? -0.55 : 0), SHOE, '#8a2f2a', { lw: 1.3, ew: 3 });
}
function pigtail(g, bx, by, ang) {
  const cx = bx + Math.cos(ang) * 22, cy = by + Math.sin(ang) * 22;
  part(g, ellP(cx, cy, 24, 13, ang), HAIR, HAIR_E, { lw: 1.4, ew: 5 });
  const bow = new Path2D();
  const nx = Math.cos(ang + Math.PI / 2) * 9, ny = Math.sin(ang + Math.PI / 2) * 9;
  bow.moveTo(bx, by); bow.lineTo(bx + nx + Math.cos(ang) * 6, by + ny + Math.sin(ang) * 6); bow.lineTo(bx + nx - Math.cos(ang) * 6, by + ny - Math.sin(ang) * 6); bow.closePath();
  bow.moveTo(bx, by); bow.lineTo(bx - nx + Math.cos(ang) * 6, by - ny + Math.sin(ang) * 6); bow.lineTo(bx - nx - Math.cos(ang) * 6, by - ny - Math.sin(ang) * 6); bow.closePath();
  part(g, bow, RIBBON, '#d99a2a', { lw: 1.1, ew: 3 });
}
/** 画小女孩（局部坐标：脚下中点为原点，面朝左；P 见 girlState）。 */
function paintGirl(g, P) {
  const L = P.lift || 0, fl = (P.flare || 0) * 16, tail = P.tail || 0, bob = P.bob || 0;
  const H = [-6, -262 - L + bob];
  const SF = [-16, -194 - L], SB = [14, -196 - L];
  // 后面的小辫子、后面的胳膊
  pigtail(g, H[0] + 48, H[1] - 30, -0.35 - tail);
  if (P.hB) arm(g, SB, P.hB);
  // 胳膊举过头顶时，前面那只也画在头后面（不挡脸），皇冠盖在手上
  const armBehind = P.hF && P.hF[1] < -270 - L && P.hF[0] > -75;
  if (armBehind) arm(g, SF, P.hF);
  // 腿
  const hipF = [-9, -84 - L], hipB = [9, -84 - L];
  let fF = [-11, 0], fB = [11, 0];
  if (P.legs === 'run') { const ph = P.ph || 0; fF = [-20 * Math.sin(ph), -Math.max(0, Math.cos(ph)) * 16]; fB = [20 * Math.sin(ph), -Math.max(0, -Math.cos(ph)) * 16]; }
  else if (P.legs === 'tuck') { fF = [-16, -24]; fB = [12, -18]; }
  const tip = L > 3;
  leg(g, hipB, fB, tip); leg(g, hipF, fF, tip);
  // 衬衫、背带裙
  const torso = new Path2D(); torso.roundRect(-25, -208 - L, 50, 64, 16);
  g.fillStyle = SHIRT; g.fill(torso);
  g.save(); g.clip(torso); g.strokeStyle = rgba(STRIPE, 0.85); g.lineWidth = 2.6;
  for (let y = -204 - L; y < -144 - L; y += 8) { g.beginPath(); g.moveTo(-30, y); g.lineTo(30, y); g.stroke(); }
  g.restore();
  pencil(g, torso, { w: 1.3 });
  const yW = -150 - L, yH = -80 - L * 0.4;
  const sk = new Path2D();
  sk.moveTo(-26, yW); sk.quadraticCurveTo(-36 - fl * 0.3, yW + 30, -50 - fl, yH);
  for (let k = 0; k < 5; k++) { const a = lerp(-50 - fl, 48 + fl, k / 5), c = lerp(-50 - fl, 48 + fl, (k + 1) / 5); sk.quadraticCurveTo((a + c) / 2, yH + 9, c, yH); }
  sk.quadraticCurveTo(34 + fl * 0.3, yW + 30, 26, yW); sk.closePath();
  part(g, sk, DRESS, DRESS_E, { lw: 1.5, ew: 6 });
  const bib = new Path2D(); bib.roundRect(-19, -190 - L, 36, 46, 6);
  part(g, bib, DRESS, DRESS_E, { lw: 1.3, ew: 4 });
  g.save(); g.strokeStyle = DRESS; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-15, -188 - L); g.lineTo(-19, -205 - L); g.moveTo(13, -188 - L); g.lineTo(15, -205 - L); g.stroke(); g.restore();
  for (const bx of [-13, 11]) part(g, ellP(bx, -184 - L, 3.2, 3.2), '#fffaf2', '#d9cfc0', { lw: 0.9, ew: 2 });
  part(g, heartP(-1, -166 - L, 7), '#f6a9ad', '#e07a85', { lw: 1, ew: 2 });
  for (const cx of [-10, 10]) part(g, ellP(cx, -207 - L, 11, 6.5), '#ffffff', '#e2d6c4', { lw: 1.1, ew: 2 });
  // 头：后脑的头发、脸、耳朵、刘海、前面的小辫子
  pigtail(g, H[0] - 44, H[1] - 36, Math.PI + 0.45 + tail);
  part(g, ellP(H[0] + 8, H[1] - 6, 55, 55), HAIR, HAIR_E, { lw: 1.6, ew: 6 });
  part(g, ellP(H[0] - 6, H[1] + 8, 45, 43), SKIN, SKIN_E, { lw: 1.5, ew: 5 });
  const bang = pathOf([[-52, -6], [-48, -28], [-38, -40], [-30, -27], [-18, -44], [-10, -29], [2, -46], [12, -33], [24, -42], [30, -58], [-30, -62]].map(([x, y]) => [H[0] + x, H[1] + y]));
  part(g, bang, HAIR, HAIR_E, { lw: 1.4, ew: 4 });
  // 五官
  for (const [cx, r] of [[-40, 9], [4, 8]]) { g.fillStyle = rgba(CHEEK, 0.55); g.beginPath(); g.arc(H[0] + cx, H[1] + 20, r, 0, TAU); g.fill(); }
  g.save(); g.strokeStyle = '#3f2b2b'; g.fillStyle = '#3f2b2b'; g.lineWidth = 2.6; g.lineCap = 'round';
  for (const ex of [-30, -5]) {
    if (P.eyes === 'happy') { g.beginPath(); g.arc(H[0] + ex, H[1] + 6, 5.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else { g.beginPath(); g.ellipse(H[0] + ex, H[1] + 4, 4.2, 5.4, 0, 0, TAU); g.fill(); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(H[0] + ex - 1.4, H[1] + 2, 1.5, 0, TAU); g.fill(); g.fillStyle = '#3f2b2b'; }
  }
  const m = P.mouth || 0, mx = H[0] - 18, my = H[1] + 25;
  if (m > 0.35) {
    const mp = new Path2D(); mp.moveTo(mx - 8, my - 1); mp.quadraticCurveTo(mx, my + 4 + m * 9, mx + 8, my - 1); mp.closePath();
    part(g, mp, '#c4554a', '#8a2f2a', { lw: 1.2, ew: 2 });
  } else { g.lineWidth = 2; g.beginPath(); g.arc(mx, my - 4, 6, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
  g.restore();
  // 举着的皇冠、前面的胳膊
  if (P.crown) drawCrown(g, P.crown[0], P.crown[1], P.crown[2] || 0);
  if (P.hF && !armBehind) arm(g, SF, P.hF);
}
function drawGirl(ctx, gx, gy, P) {
  const c = girlBuf(), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, c.width, c.height);
  g.setTransform(K, 0, 0, K, GOX * K, GOY * K);
  g.scale(P.face ?? 1, P.sq ?? 1);
  paintGirl(g, P);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.16;
  g.fillStyle = g.createPattern(grainTile14(), 'repeat');
  g.fillRect(0, 0, c.width, c.height);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  ctx.drawImage(c, gx - GOX, gy - GOY, GW, GH);
}

/** 这一拍小女孩在哪、什么姿势。坐标：x, y 是脚下（画面单位）；手的位置是局部坐标（面朝左、未翻转）。 */
function girlState(b, env) {
  if (b < T.RUN0) return null;
  const sX = stoolWX(env) - env.cam;
  const S = { x: sX, y: TOP_Y, face: 1, sq: 1, lift: 0, legs: 'stand', eyes: 'open', mouth: 0.2, flare: 0, tail: 0, bob: 0, onStack: false, wobble: 0 };
  const over = (S) => { S.crown = [-4, -342 - S.lift, -0.05]; S.hF = [-42, -356 - S.lift]; S.hB = [36, -356 - S.lift]; };
  const toLocal = (S, x, y) => [(x - S.x) / (S.face || 1), (y - S.y) / (S.sq || 1)];
  if (b < T.HOP0) {
    const u = (b - T.RUN0) / (T.HOP0 - T.RUN0), ue = 1 - Math.pow(1 - u, 1.4);
    const w0 = X_MAX + 70 + env.camAt(T.RUN0), w1 = stoolWX(env) + 84;
    S.x = lerp(w0, w1, ue) - env.cam; S.y = GROUND_Y - Math.abs(Math.sin(b * 3 * Math.PI)) * 9;
    S.legs = 'run'; S.ph = b * 3 * Math.PI; S.tail = Math.sin(b * 6 * Math.PI) * 0.3; S.mouth = 0.7;
    over(S);
    return S;
  }
  if (b < T.HOP1) {
    const t = (b - T.HOP0) / (T.HOP1 - T.HOP0);
    if (t < 0.2) { S.x = sX + 84; S.y = GROUND_Y; S.sq = 1 - 0.12 * Math.sin((Math.PI / 2) * (t / 0.2)); }
    else { const e = (t - 0.2) / 0.8; S.x = sX + lerp(84, 0, e); S.y = lerp(GROUND_Y, TOP_Y, e) - 60 * Math.sin(Math.PI * e); S.legs = 'tuck'; S.tail = 0.4 * Math.sin(Math.PI * e); }
    S.mouth = 0.7;
    over(S);
    return S;
  }
  S.onStack = true;
  if (b < T.REACH0) {
    const t = b - T.HOP1;
    S.sq = 1 - 0.12 * Math.exp(-14 * t) * Math.cos(18 * t);
    S.wobble = 0.035 * Math.exp(-6 * t) * Math.sin(20 * t);
    S.mouth = 0.5;
    over(S);
    return S;
  }
  if (b < T.LAND) {
    // 踮脚、伸长胳膊，皇冠由人物层画（落在他头上之前不能被他的头挡住），手抓着皇冠的右边
    S.lift = 13 * ease.out(clamp((b - T.REACH0) / 0.3));
    S.mouth = 0.4;
    const C = crownPose(b, env, env.figure());
    const k = ease.inOut(clamp((b - T.REACH0) / 0.4));
    const o = [-4, -342 - S.lift];
    const cx = C.x - S.x, cy = C.y - S.y;
    S.hF = [lerp(o[0] - 42, cx + 40, k), lerp(o[1] - 14, cy - 22, k)];
    S.hB = [lerp(o[0] + 36, cx + 42, k), lerp(o[1] - 14, cy + 2, k)];
    S.wobble = 0.012 * Math.sin(b * 22);
    return S;
  }
  if (b < T.DOWN0) {
    S.lift = 13;
    const t = b - T.LAND;
    const [hx, hy] = standHead();
    const C = [CHAR_X + hx + 2, ROAD_Y + hy + SEAT];
    const gF = toLocal(S, C[0] + 40, C[1] - 22), gB = toLocal(S, C[0] + 42, C[1] + 2);
    const e = ease.out(clamp((t - 0.12) / 0.3));
    S.hF = [lerp(gF[0], -66, e), lerp(gF[1], -318 - 13, e)];
    S.hB = [lerp(gB[0], 62, e), lerp(gB[1], -324 - 13, e)];
    S.eyes = t > 0.2 ? 'happy' : 'open'; S.mouth = t > 0.15 ? 1 : 0.5;
    S.wobble = 0.02 * Math.exp(-6 * t) * Math.sin(20 * t);
    S.bob = -Math.abs(Math.sin(t * Math.PI * 4)) * 3 * (t > 0.2 ? 1 : 0);
    return S;
  }
  S.onStack = false;
  const gx = sX + 96;
  if (b < T.DOWN1) {
    const t = (b - T.DOWN0) / (T.DOWN1 - T.DOWN0);
    if (t < 0.15) { S.sq = 1 - 0.1 * Math.sin((Math.PI / 2) * (t / 0.15)); S.onStack = true; }
    else { const e = (t - 0.15) / 0.85; S.x = lerp(sX, gx, e); S.y = lerp(TOP_Y, GROUND_Y, e * e) - 46 * Math.sin(Math.PI * e); S.legs = 'tuck'; }
    S.hF = [-66, -330]; S.hB = [62, -336]; S.eyes = 'happy'; S.mouth = 1; S.tail = 0.4;
    return S;
  }
  S.x = gx; S.y = GROUND_Y; S.eyes = 'happy'; S.mouth = 0.9;
  if (b < T.SPIN0) {
    const t = b - T.DOWN1, s = Math.abs(Math.sin(2 * Math.PI * t));
    S.sq = t < 0.15 ? 1 - 0.1 * Math.sin(Math.PI * (t / 0.15)) : 1;
    S.hF = [-30 - 26 * s, -198 + 4 * s]; S.hB = [-22 + 34 * s, -200 - 6 * s];
    S.y -= (1 - s) * 5; S.tail = Math.sin(t * TAU * 2) * 0.15;
    return S;
  }
  if (b < T.SPIN1) {
    const u = ease.inOut((b - T.SPIN0) / (T.SPIN1 - T.SPIN0));
    S.face = Math.cos(TAU * u); S.flare = Math.sin(Math.PI * u); S.tail = Math.sin(Math.PI * u) * 0.8;
    S.hF = [-80, -214]; S.hB = [78, -214]; S.y -= 14 * Math.sin(Math.PI * u);
    return S;
  }
  if (b < T.WAVE) {
    const t = b - T.SPIN1;
    if (t < 0.6) { const s = Math.abs(Math.sin(4 * Math.PI * t)); S.hF = [-30 - 26 * s, -198 + 4 * s]; S.hB = [-22 + 34 * s, -200 - 6 * s]; S.y -= (1 - s) * 4; }
    else { const e = (t - 0.6) / 0.4; S.y -= 30 * Math.sin(Math.PI * e); S.hF = [-66, -330]; S.hB = [62, -336]; S.legs = e > 0.1 && e < 0.9 ? 'tuck' : 'stand'; S.tail = 0.3 * Math.sin(Math.PI * e); }
    return S;
  }
  // 挥手：他走过她身边时转身朝他挥
  const tp = smoothstep(CHAR_X + 70, CHAR_X - 10, S.x);
  S.face = Math.cos(Math.PI * tp);
  S.hF = [-50 + 16 * Math.sin(4 * Math.PI * b), -302 + 4 * Math.cos(4 * Math.PI * b)];
  S.hB = [12, -118];
  S.eyes = Math.sin(b * 3) > 0.6 ? 'open' : 'happy'; S.mouth = 0.8;
  return S;
}

// ---------- 板凳 + 一摞绘本 ----------
function stoolImage() {
  const x0 = -70, y0 = -110, w = 140, h = 120;
  const img = baked('s14-stool', w * 2, h * 2, (ctx) => {
    ctx.scale(2, 2); ctx.translate(-x0, -y0);
    for (const s of [-1, 1]) {
      const lp = roughPoly([[s * 34, -64], [s * 46, -64], [s * 56, 0], [s * 44, 0]], { amp: 0.5, step: 6, seed: 3 + s });
      wash(ctx, lp, { color: '#c95a46', alpha: 1, px: 2, soft: 0.5, edge: 1, edgeW: 3, vary: 0.3, grain: 0.3, seed: 4 + s });
      pencil(ctx, pathOf(lp), { w: 1.3 });
    }
    const ap = roughPoly([[-46, -84], [46, -84], [44, -58], [-44, -58]], { amp: 0.5, step: 6, seed: 5 });
    wash(ctx, ap, { color: '#d8664e', alpha: 1, px: 2, soft: 0.5, edge: 1, edgeW: 3, vary: 0.3, grain: 0.3, seed: 6 });
    pencil(ctx, pathOf(ap), { w: 1.3 });
    const hp = heartP(0, -72, 7); ctx.fillStyle = '#8a3a30'; ctx.fill(hp);
    const sp = roughPoly([[-56, -96], [56, -96], [56, -82], [-56, -82]], { amp: 0.5, step: 6, seed: 7 });
    wash(ctx, sp, { color: '#e2735a', color2: '#d0604a', alpha: 1, px: 2, soft: 0.5, edge: 1, edgeW: 3, vary: 0.3, grain: 0.3, lift: 0.4, seed: 8 });
    pencil(ctx, pathOf(sp), { w: 1.4 });
  });
  return { img, x0, y0, w, h };
}
function booksImage() {
  const x0 = -64, y0 = -90, w = 128, h = 96;
  const img = baked('s14-books', w * 2, h * 2, (ctx) => {
    ctx.scale(2, 2); ctx.translate(-x0, -y0);
    [[-50, 50, 0, 26, '#7fb0c9'], [-44, 46, 26, 24, '#f0b54a'], [-48, 40, 50, 28, '#9ac08a']].forEach(([a, c, y, t, col], i) => {
      const pts = roughPoly([[a, -y], [c, -y], [c, -y - t], [a, -y - t]], { amp: 0.5, step: 6, seed: 10 + i });
      wash(ctx, pts, { color: col, color2: mix(col, '#ffffff', 0.2), alpha: 1, px: 2, soft: 0.5, edge: 1.1, edgeW: 3, vary: 0.3, grain: 0.3, seed: 11 + i });
      // 书页的一侧（奶白 + 细线），书脊上的装饰条（不写字）
      ctx.fillStyle = '#fbf2de'; ctx.fillRect(c - 12, -y - t + 4, 10, t - 8);
      ctx.strokeStyle = rgba(PENCIL, 0.5); ctx.lineWidth = 0.8;
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(c - 12, -y - t + 4 + (k * (t - 8)) / 4); ctx.lineTo(c - 2, -y - t + 4 + (k * (t - 8)) / 4); ctx.stroke(); }
      ctx.fillStyle = rgba('#ffffff', 0.7); ctx.fillRect(a + 8, -y - t / 2 - 2, (c - a) * 0.4, 4);
      const st = starP(a + 14 + (c - a) * 0.5, -y - t / 2, 4.5); ctx.fillStyle = '#fff6d0'; ctx.fill(st);
      pencil(ctx, pathOf(pts), { w: 1.3 });
    });
  });
  return { img, x0, y0, w, h };
}

// ---------- 每帧画的小院动态 ----------
function yardLife(ctx, b, env) {
  const G = yardGeo(env.camAt(GAG)), off = env.cam * P_YARD;
  // 烟囱的烟
  const chx = G.home + 112 - off;
  for (let k = 0; k < 5; k++) {
    const ph = (((b * 0.45 + k / 5) % 1) + 1) % 1;
    const x = chx + ph * 46 + Math.sin(ph * 6 + k) * 8, y = 306 - ph * 160, r = 9 + ph * 24;
    const a = 0.6 * (1 - ph) * Math.min(1, ph * 6);
    dab(ctx, x, y, r, '#fffaf2', { alpha: a, edge: 0.5, seed: k, rough: 0.15, edgeColor: '#dcc8c0' });
  }
  // 秋千
  const tx = G.tree - off, th = 0.1 * Math.sin(b * Math.PI * 0.5 + 0.6);
  const A = [[tx - 128, 506], [tx - 62, 506]], Lr = 168;
  const seat = A.map(([x, y]) => [x + Math.sin(th) * Lr, y + Math.cos(th) * Lr]);
  ctx.save(); ctx.strokeStyle = rgba(PENCIL, 0.85); ctx.lineWidth = 1.6;
  ctx.beginPath(); A.forEach(([x, y], i) => { ctx.moveTo(x, y); ctx.lineTo(seat[i][0], seat[i][1]); }); ctx.stroke(); ctx.restore();
  const sp = new Path2D(); sp.roundRect(seat[0][0] - 10, seat[0][1] - 4, seat[1][0] - seat[0][0] + 20, 10, 4);
  part(ctx, sp, '#c98a5a', '#8a5a3a', { lw: 1.3, ew: 3 });
  // 篱笆柱上的猫
  drawCat(ctx, G.cat - off, FENCE_TOP - 12, b);
  // 两只蝴蝶
  for (let k = 0; k < 2; k++) {
    const wx = G.home - 330 + k * 420 - off + Math.sin(b * 1.3 + k * 2) * 60, wy = 690 + Math.sin(b * 2.1 + k) * 28 - k * 40;
    const f = Math.abs(Math.sin(b * Math.PI * 4 + k));
    const col = k ? '#f6c445' : '#f08aa6';
    ctx.save(); ctx.translate(wx, wy);
    for (const s of [-1, 1]) { const p = ellP(s * 6, -2, 7, 6 * (0.25 + f * 0.75), s * 0.5); part(ctx, p, col, mix(col, '#7a3a3a', 0.3), { lw: 0.9, ew: 2 }); }
    ctx.strokeStyle = PENCIL; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(0, 5); ctx.stroke();
    ctx.restore();
  }
}
function drawCat(ctx, x, y, b) {
  const alert = smoothstep(T.LAND - 0.05, T.LAND + 0.05, b) * (1 - smoothstep(T.LAND + 1.2, T.LAND + 1.8, b));
  const ORANGE = '#eaa25e', ORANGE_E = '#c87a3a';
  // 尾巴垂在柱子前面，慢慢摆
  const sw = Math.sin(b * Math.PI) * 10 + alert * 14;
  const tl = new Path2D(); tl.moveTo(x - 12, y - 6); tl.quadraticCurveTo(x - 24 + sw * 0.4, y + 22, x - 18 + sw, y + 46 - alert * 26);
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = ORANGE; ctx.lineWidth = 8; ctx.stroke(tl); ctx.restore();
  pencil(ctx, tl, { w: 1, a: 0.5 });
  part(ctx, ellP(x, y - 24, 21, 26), ORANGE, ORANGE_E, { lw: 1.3, ew: 4 });
  part(ctx, ellP(x + 6, y - 16, 10, 16), '#fbe8c8', '#e3c9a0', { lw: 0.9, ew: 2 });
  const hx = x + 8, hy = y - 58;
  const ears = new Path2D();
  const eh = 13 + alert * 5;
  ears.moveTo(hx - 15, hy - 6); ears.lineTo(hx - 11, hy - 6 - eh); ears.lineTo(hx - 2, hy - 13); ears.closePath();
  ears.moveTo(hx + 4, hy - 13); ears.lineTo(hx + 13, hy - 6 - eh); ears.lineTo(hx + 16, hy - 5); ears.closePath();
  part(ctx, ears, ORANGE, ORANGE_E, { lw: 1.1, ew: 3 });
  part(ctx, ellP(hx, hy, 18, 16), ORANGE, ORANGE_E, { lw: 1.3, ew: 4 });
  ctx.save();
  ctx.strokeStyle = rgba(ORANGE_E, 0.8); ctx.lineWidth = 2;
  ctx.beginPath(); for (const dx of [-5, 1, 7]) { ctx.moveTo(hx + dx, hy - 14); ctx.lineTo(hx + dx + 1, hy - 8); } ctx.stroke();
  ctx.fillStyle = '#3f2b2b';
  const er = 2.4 + alert * 2;
  for (const ex of [hx + 2, hx + 11]) { ctx.beginPath(); ctx.ellipse(ex, hy - 1, er, er + 0.8, 0, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#e88a8a'; ctx.beginPath(); ctx.arc(hx + 14, hy + 5, 2, 0, TAU); ctx.fill();
  ctx.restore();
}
function stoolAndGirl(ctx, b, env) {
  const sX = stoolWX(env) - env.cam;
  if (sX < X_MIN - 300 || sX > X_MAX + 300) { /* 板凳不在画面里 */ } else {
    const S0 = stoolImage(), Bk = booksImage();
    ctx.fillStyle = rgba('#8a5a40', 0.16); ctx.beginPath(); ctx.ellipse(sX, GROUND_Y + 2, 66, 8, 0, 0, TAU); ctx.fill();
    ctx.drawImage(S0.img, sX + S0.x0, GROUND_Y + S0.y0, S0.w, S0.h);
  }
  const G = girlState(b, env);
  const wob = G && G.onStack ? G.wobble : 0;
  const piv = [sX, GROUND_Y - STOOL_H];
  if (!(sX < X_MIN - 300 || sX > X_MAX + 300)) {
    const Bk = booksImage();
    ctx.save(); ctx.translate(piv[0], piv[1]); ctx.rotate(wob); ctx.drawImage(Bk.img, Bk.x0, Bk.y0, Bk.w, Bk.h); ctx.restore();
  }
  if (!G || G.x < X_MIN - 260 || G.x > X_MAX + 260) return;
  if (!G.onStack) {
    const hgt = clamp((GROUND_Y - G.y) / 80);
    ctx.fillStyle = rgba('#8a5a40', 0.18 * (1 - hgt * 0.6)); ctx.beginPath(); ctx.ellipse(G.x, GROUND_Y + 2, 36 * (1 - hgt * 0.3), 6, 0, 0, TAU); ctx.fill();
  }
  ctx.save();
  if (wob) { ctx.translate(piv[0], piv[1]); ctx.rotate(wob); ctx.translate(-piv[0], -piv[1]); }
  drawGirl(ctx, G.x, G.y, G);
  ctx.restore();
}

// ---------- 小星星、闪光 ----------
const STAR_COLS = ['#f6c445', '#f08aa6', '#7fb4dc', '#ffffff', '#f6c445', '#e86a5a', '#a6d49a'];
function drawStars(ctx, b, env) {
  const t = b - T.LAND;
  if (t < -0.01 || t > 9) return;
  const top = crownTopScreen(b, env);
  if (!top) return;
  if (t < 0.95) {
    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k - 3) * 0.44 + (hash2(k, 1, 77) - 0.5) * 0.2;
      const d = 18 + (100 + 40 * hash2(k, 2, 77)) * ease.out(clamp(t / 0.9));
      const x = top[0] + Math.cos(ang) * d, y = top[1] + 20 + Math.sin(ang) * d * 0.9 + 50 * t * t;
      const r = (9 + 5 * hash2(k, 3, 77)) * (1 - 0.45 * t), a = 1 - smoothstep(0.55, 0.95, t);
      ctx.save(); ctx.globalAlpha = a;
      const s = starP(x, y, r, t * 4 * (k % 2 ? 1 : -1));
      part(ctx, s, STAR_COLS[k], mix(STAR_COLS[k], '#a06a2a', 0.35), { lw: 1.1, ew: 2 });
      ctx.restore();
    }
  }
  // 每一拍皇冠尖上闪一下
  const bt = t - Math.floor(t);
  if (t >= 0.9 && bt < 0.35) {
    const s = Math.sin(Math.PI * (bt / 0.35)) * 13;
    const p = new Path2D();
    const [x, y] = [top[0] + 1, top[1] - 4];
    p.moveTo(x, y - s); p.quadraticCurveTo(x, y, x + s * 0.55, y); p.quadraticCurveTo(x, y, x, y + s); p.quadraticCurveTo(x, y, x - s * 0.55, y); p.quadraticCurveTo(x, y, x, y - s); p.closePath();
    ctx.fillStyle = '#fffbea'; ctx.fill(p);
    ctx.strokeStyle = rgba('#e0a03a', 0.8); ctx.lineWidth = 1; ctx.stroke(p);
  }
}

// =====================================================================
// 第 14→15 站：撕页转场（像素坐标）
// =====================================================================
const PEEL0 = -1, ZIP0 = -0.06;
const TEAR_POST = 0.4;    // 撕下之后的时长（拍）。共用代码把这一站的转场尾巴传进 o.tail 时按它来
const F_YANK = 0.2, F_FOLD1 = 0.44, F_FOLD2 = 0.66, PERSP = 0.18;
const HALF = CW / 2, MIDY = CH / 2;
const tearPts = () => memo('s14-tear-pts', () => {
  const pts = [], N = 182;
  for (let i = 0; i <= N; i++) {
    const y = -12 + ((CH + 24) * i) / N;
    const x = lerp(170, -100, y / CH) + (noise2(y * 0.01, 3, 141) - 0.5) * 36 + (hash2(i, 7, 142) - 0.5) * 9;
    pts.push([x, y]);
  }
  return pts;
});
const sheetPath = () => memo('s14-sheet-path', () => pathOf([...tearPts(), [CW + 30, CH + 30], [CW + 30, -30]]));
const stubPath = () => memo('s14-stub-path', () => pathOf([...tearPts(), [-30, CH + 30], [-30, -30]]));
/** 撕口的纸纤维：白色毛边 + 向外的细纤维（side = -1 纤维朝左，+1 朝右）。 */
function tornEdge(g, pts, side, upto = Infinity) {
  const P = pts.filter(([, y]) => y <= upto);
  if (P.length < 2) return;
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.strokeStyle = '#fffaf0'; g.lineWidth = 9; g.globalAlpha = 0.95;
  g.stroke(pathOf(P, false));
  g.lineWidth = 4; g.globalAlpha = 0.6;
  g.stroke(pathOf(P.map(([x, y], i) => [x - side * (4 + 3 * hash2(i, 3, 143)), y]), false));
  g.strokeStyle = rgba('#b8a080', 0.35); g.lineWidth = 1;
  g.stroke(pathOf(P.map(([x, y]) => [x - side * 4.5, y]), false));
  g.strokeStyle = '#fffaf0'; g.lineWidth = 1; g.globalAlpha = 0.85;
  g.beginPath();
  P.forEach(([x, y], i) => { if (i % 2) return; const l = 3 + 8 * hash2(i, 5, 144), a = (hash2(i, 6, 144) - 0.5) * 1.2; g.moveTo(x, y); g.lineTo(x + side * Math.cos(a) * l, y + Math.sin(a) * l); });
  g.stroke();
  g.restore();
}
function snapshot(envPrev, dsl) {
  return memo('s14-tear-snap', () => {
    const c = makeCanvas(CW, CH), g = c.getContext('2d');
    const sec = envPrev.sec;
    const e16 = { ...envPrev, b: 16, gb: sec.start + 16, gbq: sec.start + 16, cam: envPrev.camAt(16) };
    dsl(g, e16);
    return c;
  });
}
function sheetFront(snap) {
  return memo('s14-sheet-front', () => {
    const c = makeCanvas(CW, CH), g = c.getContext('2d');
    g.save(); g.clip(sheetPath()); g.drawImage(snap, 0, 0); tornEdge(g, tearPts(), -1); g.restore();
    tornEdge(g, tearPts(), -1);
    return c;
  });
}
function stubFront(snap) {
  return memo('s14-stub-front', () => {
    const c = makeCanvas(CW, CH), g = c.getContext('2d');
    g.save(); g.clip(stubPath()); g.drawImage(snap, 0, 0); tornEdge(g, tearPts(), 1); g.restore();
    tornEdge(g, tearPts(), 1);
    return c;
  });
}
function backPaper() {
  return memo('s14-back-paper', () => {
    const c = makeCanvas(CW, CH), g = c.getContext('2d');
    g.drawImage(wcPaper(CW, CH, { base: '#f4e8d2', seed: 61, amount: 1.2 }), 0, 0);
    // 正面的颜色隐约透过来
    const R = rng('s14-bleed');
    for (let i = 0; i < 9; i++) wash(g, blobPts(R() * CW, 200 + R() * 800, 120 + R() * 200, 60 + R() * 90, { seed: i, rough: 0.3 }), { color: ['#e8c88a', '#c9d79a', '#f2b6a6'][i % 3], alpha: 0.12, px: 1, soft: 12, edge: 0.3, edgeW: 6, vary: 0.5, grain: 0.2, seed: 60 + i, blend: 'multiply' });
    return c;
  });
}
function sheetBack() {
  return memo('s14-sheet-back', () => {
    const c = makeCanvas(CW, CH), g = c.getContext('2d');
    g.save(); g.clip(sheetPath()); g.drawImage(backPaper(), 0, 0); tornEdge(g, tearPts(), -1); g.restore();
    tornEdge(g, tearPts(), -1);
    return c;
  });
}
/** 明信片背面（四分之一页，HALF × MIDY）：格子线、邮票框、波浪邮戳；不写字。 */
function postcard() {
  return memo('s14-postcard', () => {
    const w = HALF, h = MIDY, c = makeCanvas(w, h), g = c.getContext('2d');
    g.drawImage(wcPaper(w, h, { base: '#f8efdc', seed: 88, amount: 1 }), 0, 0);
    const LINE = '#9b8573';
    dryBrush(g, [[26, 26], [w - 26, 26], [w - 26, h - 26], [26, h - 26], [26, 26]], { width: 2, color: LINE, alpha: 0.5, passes: 1, dry: 0.05, seed: 1, wobble: 0.4 });
    dryBrush(g, [[w * 0.52, 80], [w * 0.52, h - 70]], { width: 3, color: LINE, alpha: 0.85, passes: 2, dry: 0.04, seed: 2, wobble: 0.5 });
    for (let k = 0; k < 4; k++) dryBrush(g, [[w * 0.57, 290 + k * 52], [w - 60, 290 + k * 52]], { width: 2.4, color: LINE, alpha: 0.8, passes: 2, dry: 0.04, seed: 3 + k, wobble: 0.5 });
    // 邮票：齿孔边 + 里面一张小水彩（小路通向太阳）
    const sx = w - 200, sy = 54, sw = 140, sh = 170;
    g.fillStyle = '#fbf3e2'; g.fillRect(sx - 8, sy - 8, sw + 16, sh + 16);
    g.fillStyle = '#f8efdc';
    for (let x = sx - 8; x <= sx + sw + 8; x += 14) for (const y of [sy - 8, sy + sh + 8]) { g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); }
    for (let y = sy - 8; y <= sy + sh + 8; y += 14) for (const x of [sx - 8, sx + sw + 8]) { g.beginPath(); g.arc(x, y, 4.5, 0, TAU); g.fill(); }
    wash(g, [[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]], { color: '#f6d4b0', color2: '#f3e3bc', alpha: 1, px: 1, soft: 1, edge: 0.8, edgeW: 3, vary: 0.3, grain: 0.3, seed: 5 });
    wash(g, blobPts(sx + 92, sy + 66, 22, 22, { seed: 2, rough: 0.05 }), { color: '#f7c35a', alpha: 1, px: 1, soft: 1, edge: 1, edgeW: 3, vary: 0.2, grain: 0.2, seed: 6 });
    wash(g, [[sx, sy + 120], [sx + 40, sy + 96], [sx + 90, sy + 110], [sx + sw, sy + 92], [sx + sw, sy + sh], [sx, sy + sh]], { color: '#9cc070', alpha: 1, px: 1, soft: 1, edge: 1, edgeW: 3, vary: 0.3, grain: 0.3, seed: 7 });
    wash(g, [[sx + 62, sy + sh], [sx + 76, sy + 104], [sx + 82, sy + 104], [sx + 104, sy + sh]], { color: '#f2dbb0', alpha: 1, px: 1, soft: 0.8, edge: 0.8, edgeW: 2, vary: 0.2, grain: 0.2, seed: 8 });
    pencil(g, pathOf([[sx, sy], [sx + sw, sy], [sx + sw, sy + sh], [sx, sy + sh]]), { w: 1.6 });
    // 波浪邮戳（无字）
    g.save(); g.globalAlpha = 0.55;
    pencil(g, ellP(sx - 30, sy + 92, 58, 58), { w: 2.4, color: '#7a6a8a' });
    pencil(g, ellP(sx - 30, sy + 92, 46, 46), { w: 1.4, color: '#7a6a8a' });
    for (let k = 0; k < 4; k++) {
      const pts = [];
      for (let x = sx - 260; x < sx - 80; x += 8) pts.push([x, sy + 54 + k * 26 + Math.sin(x * 0.07) * 6]);
      pencil(g, pathOf(pts, false), { w: 2.2, color: '#7a6a8a' });
    }
    g.restore();
    // 左下角：一顶小纸皇冠的涂鸦和一颗小心
    drawCrown(g, 150, h - 80, -0.15, 1.3, 1.3);
    part(g, heartP(240, h - 110, 12), '#f4a3a8', '#e07a85', { lw: 1.2, ew: 3 });
    return c;
  });
}
const half = (key, src) => memo(`s14-half|${key}`, () => { const c = makeCanvas(HALF, MIDY), g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, HALF, MIDY); return c; });
const bufs = {};
const buf = (name) => (bufs[name] ||= makeCanvas(HALF, MIDY));
/** 被撕下的纸页的变换（相对 sheet 坐标 = 画面像素）。 */
function sheetM(f) {
  if (f <= F_YANK) { const u = ease.out(clamp(f / F_YANK)); return { s: 1 - 0.44 * u, rot: 0.07 * u, tx: 30 * u, ty: 22 * u }; }
  // 折的时候把纸页往画面里挪一点（不被右边裁掉）
  const v = ease.inOut(clamp((f - F_YANK) / (F_FOLD2 - F_YANK)));
  return { s: 0.56 - 0.06 * v, rot: 0.07 - 0.04 * v, tx: 30 - 270 * v, ty: 22 + 60 * v };
}
const applyM = (ctx, M) => { ctx.translate(CW + M.tx, M.ty); ctx.rotate(M.rot); ctx.scale(M.s, M.s); ctx.translate(-CW, 0); };
const mapM = (M, [x, y]) => { const X = (x - CW) * M.s, Y = y * M.s, c = Math.cos(M.rot), s = Math.sin(M.rot); return [CW + M.tx + X * c - Y * s, M.ty + X * s + Y * c]; };
function shadowPoly(ctx, M, pts) {
  const P = pts.map((p) => mapM(M, p));
  ctx.save();
  for (const [dx, dy, a] of [[18, 26, 0.12], [9, 13, 0.12], [4, 6, 0.1]]) { ctx.fillStyle = rgba('#3c2814', a); ctx.fill(pathOf(P.map(([x, y]) => [x + dx, y + dy]))); }
  ctx.restore();
}
/** 折角：A=(CW−a,0)、B=(CW,bb) 的折线外面那一角翻过来（纸背），返回 { T: 折线外的三角, flap: 翻过来的三角 }。 */
function cornerGeo(e) {
  const a = 620 * e, bb = 440 * e;
  const A = [CW - a, 0], B = [CW, bb], C = [CW, 0];
  const dx = B[0] - A[0], dy = B[1] - A[1], L2 = dx * dx + dy * dy || 1;
  const t = ((C[0] - A[0]) * dx + (C[1] - A[1]) * dy) / L2, Px = A[0] + t * dx, Py = A[1] + t * dy;
  const Cr = [2 * Px - C[0], 2 * Py - C[1]];
  return { A, B, C, Cr, T: pathOf([A, C, B]), flap: pathOf([A, Cr, B]) };
}
function drawFlap(ctx, geo) {
  const { A, B, Cr, flap } = geo;
  ctx.save();
  for (const [dx, dy, a] of [[-14, 16, 0.12], [-7, 8, 0.12]]) { ctx.fillStyle = rgba('#3c2814', a); ctx.fill(pathOf([A, [Cr[0] + dx, Cr[1] + dy], B])); }
  ctx.clip(flap);
  ctx.drawImage(backPaper(), 0, 0);
  const mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  const gr = ctx.createLinearGradient(mx, my, Cr[0], Cr[1]);
  gr.addColorStop(0, rgba('#7a5434', 0.28)); gr.addColorStop(0.35, rgba('#7a5434', 0.06)); gr.addColorStop(1, rgba('#ffffff', 0.12));
  ctx.fillStyle = gr; ctx.fillRect(Math.min(A[0], Cr[0]) - 10, -10, CW, Math.max(B[1], Cr[1]) + 20);
  ctx.restore();
  pencil(ctx, pathOf([A, Cr, B], false), { w: 1.6, a: 0.6 });
}
const flapAmt = (x) => 0.5 * smoothstep(PEEL0, -0.5, x) + 0.5 * ease.in(clamp((x + 0.5) / 0.46)) + (x > -0.5 ? 0.012 * Math.sin(x * 80) : 0);

function tearOut(ctx, o) {
  const { x, envPrev, envNext } = o;
  const dsl = o.drawSceneLayers, dff = o.drawFigureFor;
  const drawPrev = () => { dsl(ctx, envPrev, { front: false }); dff(ctx, envPrev); dsl(ctx, envPrev, { back: false }); };
  const drawNext = () => { dsl(ctx, envNext, { front: false }); dff(ctx, envNext); dsl(ctx, envNext, { back: false }); };
  if (x < PEEL0) { drawPrev(); return true; }
  const snap = snapshot(envPrev, dsl);   // 交界强拍那一刻的整页（不含人物），提前烘焙好
  if (x < 0) {
    const geo = cornerGeo(Math.max(0, flapAmt(x)));
    ctx.save(); ctx.clip(geo.T); dsl(ctx, envNext); ctx.restore();
    ctx.save();
    const page = new Path2D(); page.rect(-60, -60, CW + 120, CH + 120); page.addPath(geo.T);
    ctx.clip(page, 'evenodd');
    drawPrev();
    // 靠装订处的撕口：先慢慢往下裂，强拍前「刺啦」一下裂到底
    const depth = x < ZIP0 ? 150 * ease.out(clamp((x + 0.55) / (ZIP0 + 0.55))) : lerp(150, CH + 20, ease.in(clamp((x - ZIP0) / -ZIP0)));
    if (depth > 2) {
      const P = tearPts().filter(([, y]) => y <= depth);
      tornEdge(ctx, P, -1); tornEdge(ctx, P.map(([px, py]) => [px - 2, py]), 1);
      ctx.save(); ctx.strokeStyle = rgba('#4a3428', 0.75); ctx.lineWidth = 1.6; ctx.stroke(pathOf(P, false)); ctx.restore();
    }
    ctx.restore();
    drawFlap(ctx, geo);
    return true;
  }
  const POST = o.tail || TEAR_POST;
  const f = x / POST;
  drawNext();
  if (f >= 1) return true;
  // 残边掉下去
  const fs = clamp(f / 0.7);
  if (fs < 1) {
    ctx.save(); ctx.translate(0, 1300 * fs * fs); ctx.rotate(-0.3 * fs);
    ctx.drawImage(stubFront(snap), 0, 0);
    ctx.restore();
  }
  const M = sheetM(f);
  if (f < F_YANK) {
    // 「刷」地拽走：整页缩向右上、略转；折角在拉紧时展平
    const geo = cornerGeo(1 - ease.inOut(clamp(f / 0.16)));
    shadowPoly(ctx, M, [[170, 0], [CW, 0], [CW, CH], [-100, CH]]);
    ctx.save(); applyM(ctx, M);
    ctx.save();
    const page = new Path2D(); page.rect(-200, -60, CW + 260, CH + 120); page.addPath(geo.T); ctx.clip(page, 'evenodd');
    ctx.drawImage(sheetFront(snap), 0, 0);
    ctx.restore();
    drawFlap(ctx, geo);
    ctx.restore();
    // 人物：纸页范围内还是旧画风
    ctx.save();
    ctx.clip(pathOf([...tearPts(), [CW, CH + 12], [CW, -12]].map((p) => mapM(M, p))));
    dff(ctx, envPrev);
    ctx.restore();
    return true;
  }
  const front = half('front', sheetFront(snap)), back = half('back', sheetBack()), card = postcard();
  if (f < F_FOLD2) {
    // 先合成到半分辨率的纸页缓冲（sheet 坐标 × 0.5），再按纸页的变换画上去
    const SB = buf('sheet'), g = SB.getContext('2d'), FB = buf('flip'), gf = FB.getContext('2d');
    for (const c of [g, gf]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, HALF, MIDY); c.setTransform(0.5, 0, 0, 0.5, 0, 0); }
    const src = (c, img, sx, sy, sw, sh, dx, dy, dw, dh) => c.drawImage(img, sx / 2, sy / 2, Math.max(0.5, sw / 2), Math.max(0.5, sh / 2), dx, dy, dw, dh);
    const n = 20;
    let ext;
    if (f < F_FOLD1) {
      // 第一折：左半边沿中线翻到右半边上
      const phi = Math.PI * ease.inOut((f - F_YANK) / (F_FOLD1 - F_YANK)), c = Math.cos(phi), sn = Math.sin(phi);
      src(g, front, HALF, 0, HALF, CH, HALF, 0, HALF, CH);
      const img = c >= 0 ? front : back;
      for (let i = 0; i < n; i++) {
        const d0 = (HALF * i) / n, d1 = (HALF * (i + 1)) / n;
        const k0 = 1 + PERSP * (d0 / HALF) * sn, k1 = 1 + PERSP * (d1 / HALF) * sn, km = (k0 + k1) / 2;
        const X0 = HALF - d0 * c * k0, X1 = HALF - d1 * c * k1;
        const dw = Math.abs(X1 - X0); if (dw < 0.3) continue;
        src(gf, img, HALF - d1, 0, d1 - d0, CH, Math.min(X0, X1), MIDY - MIDY * km, dw + 0.8, CH * km);
      }
      if (c < 0) { g.fillStyle = rgba('#3c2814', 0.18 * sn + 0.08); g.fillRect(HALF, 0, HALF * -c + 14, CH); }
      ext = [[c > 0 ? HALF - HALF * c : HALF, 0], [CW, 0], [CW, CH], [c > 0 ? HALF - HALF * c : HALF, CH]];
      gf.setTransform(1, 0, 0, 1, 0, 0); gf.globalCompositeOperation = 'source-atop';
      gf.fillStyle = rgba('#5a3a20', c >= 0 ? (1 - c) * 0.3 : (1 + c) * 0.35); gf.fillRect(0, 0, HALF, MIDY);
    } else {
      // 第二折：下半边翻上来，露出明信片的背面
      const psi = Math.PI * ease.inOut((f - F_FOLD1) / (F_FOLD2 - F_FOLD1)), c = Math.cos(psi), sn = Math.sin(psi);
      const cx = CW * 0.75;
      src(g, front, HALF, 0, HALF, MIDY, HALF, 0, HALF, MIDY);
      g.save(); g.translate(CW, 0); g.scale(-1, 1); src(g, back, 0, 0, HALF, MIDY, 0, 0, HALF, MIDY); g.restore();
      for (let i = 0; i < n; i++) {
        const d0 = (MIDY * i) / n, d1 = (MIDY * (i + 1)) / n;
        const k0 = 1 + PERSP * (d0 / MIDY) * sn, k1 = 1 + PERSP * (d1 / MIDY) * sn, km = (k0 + k1) / 2;
        const Y0 = MIDY + d0 * c * k0, Y1 = MIDY + d1 * c * k1;
        const dh = Math.abs(Y1 - Y0); if (dh < 0.3) continue;
        const dy = Math.min(Y0, Y1), dx = cx - (CW / 4) * km, dw = (CW / 2) * km;
        if (c >= 0) {
          src(gf, front, HALF, MIDY + d0, HALF, d1 - d0, dx, dy, dw, dh + 0.8);
          gf.save(); gf.translate(cx, 0); gf.scale(-km, 1); gf.translate(-(CW - cx), 0);
          src(gf, back, 0, MIDY + d0, HALF, d1 - d0, 0, dy, HALF, dh + 0.8);
          gf.restore();
        } else {
          gf.drawImage(card, 0, MIDY - d1, HALF, d1 - d0, dx, dy, dw, dh + 0.8);
        }
      }
      if (c < 0) { g.fillStyle = rgba('#3c2814', 0.16 * sn + 0.06); g.fillRect(HALF, MIDY * (1 + c) - 14, HALF, MIDY * -c + 14); }
      const yb = c > 0 ? MIDY + MIDY * c : MIDY;
      ext = [[HALF, 0], [CW, 0], [CW, yb], [HALF, yb]];
      gf.setTransform(1, 0, 0, 1, 0, 0); gf.globalCompositeOperation = 'source-atop';
      gf.fillStyle = rgba('#5a3a20', c >= 0 ? (1 - c) * 0.3 : (1 + c) * 0.3); gf.fillRect(0, 0, HALF, MIDY);
    }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(FB, 0, 0);
    shadowPoly(ctx, M, ext);
    ctx.save(); applyM(ctx, M); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(SB, 0, 0, CW, CH); ctx.restore();
    return true;
  }
  // 明信片：转着飞进第 15 站的远处，变小消失
  const M2 = sheetM(F_FOLD2);
  const c0 = mapM(M2, [CW * 0.75, CH * 0.25]);
  const u = clamp((f - F_FOLD2) / (0.97 - F_FOLD2));
  const target = [CW * 0.66, CH * 0.44];
  const pe = ease.in(u);
  const px = lerp(c0[0], target[0], pe), py = lerp(c0[1], target[1], pe) - 120 * Math.sin(Math.PI * u);
  const k = lerp(1, 0.04, ease.in(u));
  const rot = M2.rot + TAU * 1.15 * ease.inOut(u);
  const fl = 0.7 + 0.3 * Math.cos(u * Math.PI * 5);
  const w = HALF * M2.s * k, h = MIDY * M2.s * k;
  if (u >= 1 || w < 2) return true;
  ctx.save();
  ctx.globalAlpha = 1 - smoothstep(0.82, 1, u);
  ctx.translate(px, py); ctx.rotate(rot); ctx.scale(fl, 1);
  ctx.fillStyle = rgba('#3c2814', 0.18); ctx.fillRect(-w / 2 + 10 * k, -h / 2 + 14 * k, w, h);
  ctx.drawImage(card, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}

// =====================================================================
// 手机（绘本水彩画的手机，界面虚构）
// =====================================================================
const PH_W = 120, PH_H = 220;
function phoneBody() {
  const S = 2, pad = 14, w = PH_W + 2 * pad, h = PH_H + 2 * pad;
  const img = baked('s14-phone', w * S, h * S, (ctx) => {
    ctx.scale(S, S); ctx.translate(pad + PH_W / 2, pad + PH_H / 2);
    const body = new Path2D(); body.roundRect(-PH_W / 2, -PH_H / 2, PH_W, PH_H, 20);
    wash(ctx, { path: body, bbox: [-PH_W / 2, -PH_H / 2, PH_W / 2, PH_H / 2] }, { color: '#f0b48c', color2: '#e8977a', alpha: 1, px: S, soft: 0.8, edge: 1.3, edgeW: 4, edgeColor: '#c46e52', vary: 0.3, grain: 0.3, lift: 0.4, seed: 3 });
    pencil(ctx, body, { w: 1.6 });
    const scr = new Path2D(); scr.roundRect(-PH_W / 2 + 8, -PH_H / 2 + 14, PH_W - 16, PH_H - 28, 12);
    wash(ctx, { path: scr, bbox: [-PH_W / 2 + 8, -PH_H / 2 + 14, PH_W / 2 - 8, PH_H / 2 - 14] }, { color: '#fff8ea', color2: '#fbefd6', alpha: 1, px: S, soft: 0.6, edge: 0.6, edgeW: 3, edgeColor: '#e0c8a8', vary: 0.2, grain: 0.2, seed: 4 });
    pencil(ctx, scr, { w: 1.2 });
    ctx.fillStyle = rgba(PENCIL, 0.7); ctx.fillRect(-12, -PH_H / 2 + 5, 24, 3);
    // 三个按钮
    const by = PH_H / 2 - 34;
    const tri = (x, dir, s) => { const p = new Path2D(); p.moveTo(x - dir * s * 0.6, by - s); p.lineTo(x + dir * s * 0.8, by); p.lineTo(x - dir * s * 0.6, by + s); p.closePath(); return p; };
    part(ctx, ellP(0, by, 15, 15), '#e2735a', '#c0503e', { lw: 1.2, ew: 3 });
    const play = tri(2, 1, 7); ctx.fillStyle = '#fff8ea'; ctx.fill(play);
    for (const s of [-1, 1]) { const p = tri(s * 34, s, 6); p.addPath(tri(s * 40, s, 6)); part(ctx, p, '#8a6a8a', '#5a4a5e', { lw: 1, ew: 2 }); }
  });
  return { img, w, h };
}
function phoneDisc() {
  const S = 2, r = 38;
  return baked('s14-phone-disc', (r * 2 + 8) * S, (r * 2 + 8) * S, (ctx) => {
    ctx.scale(S, S); ctx.translate(r + 4, r + 4);
    wash(ctx, blobPts(0, 0, r, r, { seed: 5, rough: 0.02, n: 48 }), { color: '#7d86c4', color2: '#5f6aa8', alpha: 1, px: S, soft: 0.6, edge: 1, edgeW: 3, edgeColor: '#4a5290', vary: 0.35, grain: 0.3, seed: 6 });
    const moon = new Path2D(); moon.arc(-6, -4, 17, 0, TAU); moon.arc(2, -10, 15, 0, TAU, true);
    ctx.fillStyle = '#f7d36a'; ctx.fill(moon);
    for (const [x, y, s] of [[16, 10, 5], [10, -22, 3.5], [-18, 18, 3]]) { ctx.fillStyle = '#fff3c4'; ctx.fill(starP(x, y, s)); }
    ctx.fillStyle = '#fff8ea'; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    pencil(ctx, ellP(0, 0, r, r), { w: 1.3 });
  });
}

export const s14 = {
  id: 's14',
  station: ST,
  figureStyle: 's14-wc',
  freezeBeat: GAG + 0.4, // Outro 展墙：皇冠刚落下，她站在书摞上两手举高，星星在飞
  drawFigure(ctx, fig, b, env) {
    ctx.save(); ctx.fillStyle = rgba('#8a5a40', 0.16); ctx.beginPath(); ctx.ellipse(10, 2, 74, 9, 0, 0, TAU); ctx.fill(); ctx.restore();
    drawWalker(ctx, fig);
    const C = crownPose(b, env, fig);
    if (!C || C.mode === 'girl') return;
    if (C.mode === 'screen') { drawCrown(ctx, (C.x - fig.x) / fig.scale, (C.y - fig.y) / fig.scale, C.rot); return; }
    ctx.save(); ctx.rotate(fig.lean || 0);
    drawCrown(ctx, C.local[0], C.local[1], C.rot, C.sx, C.sy);
    ctx.restore();
  },
  drawBack(ctx, b, env) {
    const cam = env.cam, c8 = env.camAt(GAG);
    drawStrip(ctx, skyLayer(c8), cam);
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, hillLayer(), cam);
    drawStrip(ctx, townLayer(c8), cam);
    drawStrip(ctx, yardLayer(c8), cam);
    yardLife(ctx, b, env);
    drawStrip(ctx, groundLayer(), cam);
    stoolAndGirl(ctx, b, env);
  },
  drawFront(ctx, b, env) {
    drawStrip(ctx, foreLayer(env.camAt(GAG)), env.cam);
    drawStars(ctx, b, env);
    paperOverlay(ctx);
  },
  transitionOut: tearOut,
  transitionTail: 1, // 建议：撕页之后需要约 1 拍（需要 film.js 读取它，见汇报）
  cardStyle: {
    ink: INK, accent: ACCENT, bar: false,
    bgDraw(ctx, x, y, w, h) {
      drawWcCard(ctx, x, y, w, h, { paper: '#fffaf0', color: '#efb08a', color2: '#eba3b8', seed: 14, inset: 32 });
      for (const [sx, sy, r] of [[x + 16, y + 18, 8], [x + w - 18, y + 20, 7], [x + 18, y + h - 18, 6], [x + w - 16, y + h - 16, 8]]) {
        const p = starP(sx, sy, r); ctx.fillStyle = '#f6c84c'; ctx.fill(p); pencil(ctx, p, { w: 1 });
      }
    },
  },
  playerStyle: {
    ink: INK, noteColor: ACCENT, backdrop: false,
    plateDraw(ctx, x, y, w, h) { drawWcCard(ctx, x, y, w, h, { paper: '#fffaf0', color: '#efb08a', seed: 15, inset: 20 }); },
    drawPlayer(ctx, kind, cx, cy, sc, spin, P, gb) {
      const B = phoneBody(), D = phoneDisc();
      const sec = stationSection(14), bb = gb - sec.start;
      const prog = 0.06 + 0.88 * clamp(bb / sec.beats);
      ctx.save();
      ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.fillStyle = rgba('#5a3a20', 0.16); ctx.beginPath(); ctx.roundRect(-PH_W / 2 + 6, -PH_H / 2 + 9, PH_W, PH_H, 20); ctx.fill();
      ctx.drawImage(B.img, -B.w / 2, -B.h / 2, B.w, B.h);
      ctx.save(); ctx.translate(0, -PH_H / 2 + 76); ctx.rotate(spin); ctx.drawImage(D, -42, -42, 84, 84); ctx.restore();
      // 进度条：彩铅线 + 走过的部分 + 一颗小心
      const y = PH_H / 2 - 66, x0 = -42, x1 = 42, xp = lerp(x0, x1, prog);
      ctx.strokeStyle = rgba(PENCIL, 0.55); ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.strokeStyle = '#e2735a'; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(xp, y); ctx.stroke();
      part(ctx, heartP(xp, y - 1, 6), '#e2735a', '#b8483e', { lw: 1, ew: 2 });
      ctx.restore();
    },
  },
};
