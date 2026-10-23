// 第 1 站 · Jay（Jay, 2000）·「可爱女人」· 糖果色小镇 · 会动的贴纸
// 画风：糖果色彩色插画，主色粉、天蓝、奶黄，天空是蜜桃色渐变；每样东西都像一张贴纸：白色贴纸描边 + 轻微投影。
// 构图（视差，从远到近）：天空（不动）→ 贴纸云 0.05 → 粉彩山丘 0.12 → 远处小房子 0.25 → 一排糖果小店（含「橱窗店」）0.4
//       → 人行道道具（拐杖糖路灯、棒棒糖树、花箱、邮筒、消防栓）1 → 人行道、路沿、淡紫马路。
//       所有图层都用「按槽位重复的贴纸」程序化摆放，镜头拉远多少都能铺满画面（第 4 小节的拉远拉回要用）。
// 主角是一架圆滚滚的玩具直升机（第 1–4 小节都在画面里）：
//   第 1 小节  像小狗一样跟着他（每拍一跳、尾巴上的爱心尾翼摇来摇去）；橱窗里站着一个女孩剪影
//   第 2 小节  在他头顶绕圈、飘出小爱心；橱窗楼上四个小窗每拍弹出一个女孩小剪影（害羞 / 抱猫 / 玻璃气泡 / 眨眼吐舌）
//   第 3 小节  （他定格站立、镜头停住）直升机变大降落在马路上，橱窗里的女孩和从店门出来的男孩两个剪影跳进机舱；
//             拔地升空、穿过云层，天空从蜜桃色变成深紫、星星亮起、出现旋转的银河；直升机飞进银河，像冰淇淋一样化掉，
//             化成一条旋转的彩色星河
//   第 4 小节  天色回到白天，星河拉成横跨天空的一道彩虹星带，一部分星星聚成「星座直升机」（螺旋桨星点在转）继续跟着他；
//             一颗星星掉下来落在他面前、弹一下；一片小树叶落在他头顶；镜头猛地拉远（他缩成顶着树叶的蚂蚁）再拉回；
//             最后 2 拍下一道画框（糖果贴纸框）出现。
// 人物：画风 s01-candy（漫画化底层 + 糖果色调：深紫靛衣服、蜜桃肤色）+ 白色贴纸描边（figureRim）。
// 画面里不写字：招牌、橱窗只有图形。所有配角都是原创剪影。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { mix, rgba } from '../kit/color.js';
import { circle, ellipse, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, keyframes, TAU } from '../kit/math.js';
import { GAG, STATION } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk, frameIndex, FIGURE_H } from '../rig/walker.js';
import { registerStyle, comicBase, rgbf } from '../rig/styles.js';
import { SANS } from '../kit/text.js';

const ST = stationByN(1);

// ---------- 调色板 ----------
const PINK = '#ff8fbf', PINK_L = '#ffc4de', PINK_D = '#ec5f9c';
const BLUE = '#8fd6ff', BLUE_L = '#c9eeff', BLUE_D = '#46ade6';
const CREAM = '#fff0b0', CREAM_L = '#fff9e0', CREAM_D = '#ffd469';
const MINT = '#9ee8c4', MINT_D = '#4fc493', LILAC = '#cdb6ff', LILAC_D = '#9a7fe2', PEACH = '#ffc3a6';
const WHITE = '#ffffff', PLUM = '#5a3570', INK = '#4a2c63', SIL = '#4b2f73', SIL_L = '#7c5aa8';
const SHADOW = 'rgba(122,72,150,0.24)';
const NIGHT_TINT = 'rgba(58,30,122,0.36)';
const GLOW = '#ffe9a6';
const CANDY = [PINK, BLUE, CREAM_D, MINT, LILAC, PEACH];
const DAY_SKY = [[0, '#ffb3a6'], [0.42, '#ffc9b2'], [0.78, '#ffdfc6'], [1, '#fff0dc']];
const NIGHT_SKY = [[0, '#34206f'], [0.45, '#5a39a8'], [0.8, '#a05cc4'], [1, '#f19ac6']];

// ---------- 时间点（段内拍位，只用拍位） ----------
const LEAVE = STATION.leave[0];          // 第 13 拍：走向下一道画框
const T_GIRLS = [GAG - 4, GAG - 3, GAG - 2, GAG - 1]; // 第 5–8 拍：四个小窗每拍弹出一个女孩
const T_LAND = GAG + 0.55;               // 直升机降落在马路上
const T_DOOR = [GAG + 0.25, GAG + 1.35]; // 店门开 / 关
const T_HOP_G = [GAG + 0.65, GAG + 1.05]; // 女孩剪影跳进机舱
const T_HOP_B = [GAG + 0.8, GAG + 1.2];   // 男孩剪影跳进机舱
const T_LIFT = GAG + 1.3;                // 拔地升空
const T_UP = GAG + 2.1;                  // 穿出云层
const T_IN = GAG + 2.75;                 // 飞进银河中心，开始融化
const T_GONE = GAG + 3.5;                // 化完
const T_RIVER = GAG + 2.95;              // 星河开始流出
const T_DROP = [LEAVE + 0.02, LEAVE + 0.4]; // 一颗星星掉下来
const T_LEAF = [LEAVE + 0.25, LEAVE + 0.82]; // 小树叶落在他头顶
const T_ZOOM = [LEAVE + 0.85, LEAVE + 1.12, LEAVE + 1.42, LEAVE + 1.85]; // 拉远 → 停一下 → 拉回（第 15 拍前结束）
const ZMIN = 0.065;

const G = [930, 160];   // 银河中心（画面单位）
const LAND = [700, 838]; // 直升机降落时机身中心（起落架落在马路 y≈948，不压右下角的歌名牌）
const LAND_S = 1.45;
const BX = 640;          // 定格时「橱窗店」中心的画面 x
const SHOP_BASE = 778;
const P_SHOP = 0.4;

const nightAt = (b) => smoothstep(GAG + 1.6, GAG + 2.5, b) * (1 - smoothstep(LEAVE, LEAVE + 0.9, b));
function zoomAt(b) {
  const [a, c, d, e] = T_ZOOM;
  if (b <= a || b >= e) return 1;
  const L = Math.log(ZMIN);
  return Math.exp(keyframes([[a, 0], [c, L, ease.out], [d, L], [e, 0, ease.inOut]], b));
}

// ---------- 小工具 ----------
const P = (f) => { const p = new Path2D(); f(p); return p; };
const ellP = (x, y, rx, ry, rot = 0) => P((p) => p.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU));
const rrP = (x, y, w, h, r) => P((p) => { if (p.roundRect) p.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else p.rect(x, y, w, h); });
const polyP = (pts) => P((p) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); });
function heartP(s) {
  return P((p) => {
    p.moveTo(0, s * 0.95);
    p.bezierCurveTo(-s * 1.25, s * 0.15, -s * 0.95, -s * 0.95, 0, -s * 0.4);
    p.bezierCurveTo(s * 0.95, -s * 0.95, s * 1.25, s * 0.15, 0, s * 0.95);
    p.closePath();
  });
}
function starP(r, ri = 0.48, n = 5) {
  return P((p) => {
    for (let i = 0; i < n * 2; i++) {
      const a = -Math.PI / 2 + (i / (n * 2)) * TAU, rr = i % 2 ? r * ri : r;
      i ? p.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : p.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    p.closePath();
  });
}
function sparkleP(r) {
  const q = r * 0.2;
  return P((p) => {
    p.moveTo(0, -r); p.quadraticCurveTo(q, -q, r, 0); p.quadraticCurveTo(q, q, 0, r);
    p.quadraticCurveTo(-q, q, -r, 0); p.quadraticCurveTo(-q, -q, 0, -r); p.closePath();
  });
}

/** 贴纸画法：parts = [[Path2D, fill], ...]。先整体投影，再整体白边，最后上色（白边只出现在外轮廓）。 */
function sticker(ctx, parts, { rim = 5, shadow = true, sh = [4, 6], rimColor = WHITE } = {}) {
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (shadow) {
    ctx.save(); ctx.translate(sh[0], sh[1]);
    ctx.fillStyle = SHADOW; ctx.strokeStyle = SHADOW; ctx.lineWidth = rim * 2;
    for (const [p] of parts) { ctx.stroke(p); ctx.fill(p); }
    ctx.restore();
  }
  if (rim > 0) {
    ctx.fillStyle = rimColor; ctx.strokeStyle = rimColor; ctx.lineWidth = rim * 2;
    for (const [p] of parts) { ctx.stroke(p); ctx.fill(p); }
  }
  for (const [p, f] of parts) { if (f) { ctx.fillStyle = f; ctx.fill(p); } }
  ctx.restore();
}

/**
 * 预烘焙一张贴纸图：draw(g, night, tint) 在局部单位坐标里作画（锚点在 (0,0)），
 * 之后自动加白色贴纸描边和投影。night=true 时烘焙夜景版（draw 里在上色后调用 tint() 压暗，再画亮着的窗）。
 */
function bakeSticker(key, box, draw, { res = 1, rim = 6, sh = [5, 7], night = false } = {}) {
  return memo(`s01-st|${key}|${night ? 'n' : 'd'}|${res}`, () => {
    const [x0, y0, x1, y1] = box;
    const pad = rim + Math.max(sh[0], sh[1]) + 4;
    const s = K * res;
    const W = Math.ceil((x1 - x0 + 2 * pad) * s), H = Math.ceil((y1 - y0 + 2 * pad) * s);
    const A = makeCanvas(W, H), g = A.getContext('2d');
    g.scale(s, s); g.translate(pad - x0, pad - y0);
    let tinted = false;
    const tint = () => {
      tinted = true;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop';
      g.fillStyle = NIGHT_TINT; g.fillRect(0, 0, W, H); g.restore();
    };
    draw(g, night, tint);
    if (night && !tinted) tint();
    // 白色描边：把轮廓向外扩 rim
    const sil = makeCanvas(W, H), sg = sil.getContext('2d');
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      for (const r of [rim * s, rim * s * 0.55]) sg.drawImage(A, Math.cos(a) * r, Math.sin(a) * r);
    }
    sg.globalCompositeOperation = 'source-in';
    sg.fillStyle = night ? '#d6c6f4' : WHITE; sg.fillRect(0, 0, W, H);
    const out = makeCanvas(W, H), o = out.getContext('2d');
    o.drawImage(sil, sh[0] * s, sh[1] * s);
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = SHADOW; o.fillRect(0, 0, W, H);
    o.globalCompositeOperation = 'source-over';
    o.drawImage(sil, 0, 0);
    o.drawImage(A, 0, 0);
    return { c: out, x0: x0 - pad, y0: y0 - pad, w: W / s, h: H / s };
  });
}
const drawSt = (ctx, S, x, y, sc = 1) => ctx.drawImage(S.c, x + S.x0 * sc, y + S.y0 * sc, S.w * sc, S.h * sc);
/** 白天版 + 按夜色叠一层夜景版。 */
function drawDN(ctx, make, x, y, N, sc = 1) {
  drawSt(ctx, make(false), x, y, sc);
  if (N > 0.002) { ctx.save(); ctx.globalAlpha *= N; drawSt(ctx, make(true), x, y, sc); ctx.restore(); }
}

// ---------- 图层与镜头拉远 ----------
/** 视差 p 的图层在镜头拉远（地面缩放 Z）时的缩放：越远的层缩得越少。 */
const layerZ = (p, Z) => 1 / (1 + p * (1 / Z - 1));
function inLayer(ctx, p, Z, fn) {
  const zp = layerZ(p, Z);
  ctx.save();
  if (zp !== 1) { ctx.translate(CHAR_X, ROAD_Y); ctx.scale(zp, zp); ctx.translate(-CHAR_X, -ROAD_Y); }
  fn(CHAR_X + (X_MIN - CHAR_X) / zp, CHAR_X + (X_MAX - CHAR_X) / zp, ROAD_Y - ROAD_Y / zp, ROAD_Y + 200 / zp, zp);
  ctx.restore();
}
/** 按槽位重复：第 k 个槽位的层内 x = k·step；回调拿到画面 x（未缩放前）。 */
function slots(x0, x1, shift, step, pad, fn) {
  const k0 = Math.floor((x0 + shift - pad) / step), k1 = Math.ceil((x1 + shift + pad) / step);
  for (let k = k0; k <= k1; k++) fn(k, k * step - shift);
}

// ---------- 天空 ----------
function skyGrad(ctx, stops) {
  const g = ctx.createLinearGradient(0, 0, 0, 820);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}
function daySky() {
  return memo('s01-daysky', () => {
    const w = X_MAX - X_MIN, c = makeCanvas(w * K * 0.5, 1000 * K * 0.5), g = c.getContext('2d');
    g.scale(K * 0.5, K * 0.5); g.translate(-X_MIN, 0);
    g.fillStyle = skyGrad(g, DAY_SKY); g.fillRect(X_MIN, 0, w, 1000);
    // 一团暖光（太阳在画外右上）
    const r = g.createRadialGradient(1250, -60, 10, 1250, -60, 900);
    r.addColorStop(0, 'rgba(255,248,214,0.85)'); r.addColorStop(1, 'rgba(255,248,214,0)');
    g.fillStyle = r; g.fillRect(X_MIN, 0, w, 1000);
    return c;
  });
}
function nightSky() {
  return memo('s01-nightsky', () => {
    const w = X_MAX - X_MIN, c = makeCanvas(w * K * 0.6, 1000 * K * 0.6), g = c.getContext('2d');
    g.scale(K * 0.6, K * 0.6); g.translate(-X_MIN, 0);
    g.fillStyle = skyGrad(g, NIGHT_SKY); g.fillRect(X_MIN, 0, w, 1000);
    const R = rng('s01-neb');
    // 糖果色星云：粉、薄荷、奶黄、天蓝的柔光团（把深紫托亮）
    g.globalCompositeOperation = 'screen';
    const nebs = [[60, 260, 520, '#ff7fc8', 0.55], [520, 120, 480, '#7fe4f2', 0.42], [980, 300, 560, '#ffd27a', 0.38], [1250, 90, 420, '#ff9fd8', 0.5],
      [-250, 120, 420, '#b38bff', 0.5], [300, 480, 620, '#ff9ac0', 0.45], [820, 560, 600, '#8fe0ff', 0.32]];
    for (const [x, y, r, col, a] of nebs) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(col, a)); rg.addColorStop(0.55, rgba(col, a * 0.4)); rg.addColorStop(1, rgba(col, 0));
      g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 340; i++) {
      const x = X_MIN + R() * w, y = R() * 760, r = 0.8 + R() * R() * 3.2;
      g.fillStyle = rgba(R() < 0.7 ? '#ffffff' : R() < 0.5 ? '#ffe6a6' : '#ffd0ec', 0.6 + R() * 0.4);
      circle(g, x, y, r); g.fill();
    }
    return c;
  });
}
// 夜里一闪一闪的星
const TWINK = Array.from({ length: 26 }, (_, i) => [X_MIN + hash2(i, 1, 51) * (X_MAX - X_MIN), 30 + hash2(i, 2, 51) * 520, 7 + hash2(i, 3, 51) * 10, hash2(i, 4, 51)])
  .filter(([x, y]) => !(x < 0 && y < 260));

// ---------- 云 ----------
function cloudSprite(v, night) {
  return bakeSticker(`cloud${v}`, [-170, -95, 170, 30], (g, nt, tint) => {
    const R = rng('s01-cloud', v);
    const parts = [];
    const n = 4 + (v % 3);
    for (let i = 0; i < n; i++) {
      const x = -120 + (i / (n - 1)) * 240, r = 34 + R() * 30 * (1 - Math.abs(i / (n - 1) - 0.5));
      parts.push([x, -r * 0.55 + 6, r]);
    }
    const body = P((p) => { for (const [x, y, r] of parts) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); } p.rect(-120, -20, 240, 40); });
    g.save(); g.beginPath(); g.rect(-200, -200, 400, 220); g.clip();
    g.fillStyle = WHITE; g.fill(body);
    g.clip(body);
    g.fillStyle = '#f6e6ff'; g.fillRect(-200, -2, 400, 40);
    g.fillStyle = 'rgba(255,214,232,0.7)'; ellipse(g, -40, 6, 120, 14); g.fill();
    g.restore();
    if (nt) tint();
  }, { rim: 4, sh: [3, 6], night });
}

// ---------- 远处：粉彩山丘 ----------
function hillSprite(v, night) {
  return bakeSticker(`hill${v}`, [-470, -200, 470, 90], (g, nt, tint) => {
    const R = rng('s01-hill', v);
    const cols = [[MINT, '#c6f3dc'], [PINK_L, '#ffe0ec'], [LILAC, '#e6dbff']];
    for (let j = 0; j < 3; j++) {
      const [c1, c2] = cols[(v + j) % 3];
      const cx = -300 + j * 300 + (R() - 0.5) * 80, hh = 110 + R() * 80, ww = 260 + R() * 80;
      const p = P((q) => { q.moveTo(cx - ww, 90); q.bezierCurveTo(cx - ww * 0.55, -hh * 1.3, cx + ww * 0.55, -hh * 1.3, cx + ww, 90); q.closePath(); });
      const gr = g.createLinearGradient(0, -hh, 0, 90); gr.addColorStop(0, c2); gr.addColorStop(1, c1);
      g.fillStyle = gr; g.fill(p);
      g.strokeStyle = WHITE; g.lineWidth = 4; g.stroke(p);
      // 小圆树
      for (let k = 0; k < 4; k++) {
        const tx = cx + (R() - 0.5) * ww * 0.9, ty = -hh * 0.35 + R() * hh * 0.6;
        g.fillStyle = mix(c1, '#3fae7d', 0.35); circle(g, tx, ty, 9 + R() * 6); g.fill();
        g.fillStyle = rgba(WHITE, 0.6); circle(g, tx - 3, ty - 3, 3); g.fill();
      }
    }
    if (nt) tint();
  }, { rim: 3, sh: [3, 4], night });
}

// ---------- 远处小房子（被空气冲淡一点） ----------
function farHouseSprite(v, night) {
  const R0 = rng('s01-fh-size', v);
  const w = 100 + R0() * 70, h = 110 + R0() * 90;
  return bakeSticker(`fh${v}`, [-w / 2 - 22, -h - 80, w / 2 + 22, 50], (g, nt, tint) => {
    const R = rng('s01-fh', v);
    const haze = (c) => mix(c, '#ffe2cc', 0.35);
    const wall = haze([PINK_L, BLUE_L, CREAM, '#d9f5e6', '#eadfff'][v % 5]);
    const roof = haze([PINK, BLUE_D, PINK_D, LILAC_D, MINT_D][(v + 2) % 5]);
    g.fillStyle = wall; roundRect(g, -w / 2, -h, w, h + 50, 8); g.fill();
    const rt = R() < 0.6;
    g.fillStyle = roof;
    if (rt) { g.beginPath(); g.moveTo(-w / 2 - 14, -h + 4); g.lineTo(0, -h - 62); g.lineTo(w / 2 + 14, -h + 4); g.closePath(); g.fill(); }
    else { g.beginPath(); g.arc(0, -h + 2, w * 0.4, Math.PI, 0); g.closePath(); g.fill(); }
    const wins = [];
    const nx = w > 140 ? 3 : 2;
    for (let i = 0; i < nx; i++) for (let j = 0; j < 2; j++) {
      const ww = 18, wx = -w / 2 + (w / nx) * (i + 0.5) - ww / 2, wy = -h + 22 + j * 46;
      if (wy + 30 > -10) continue;
      wins.push([wx, wy, ww, 26]);
      g.fillStyle = haze(BLUE); roundRect(g, wx, wy, ww, 26, 7); g.fill();
    }
    if (nt) { tint(); g.fillStyle = GLOW; for (const [x, y, a, c] of wins) { if (hash2(x | 0, y | 0, v) < 0.6) { roundRect(g, x, y, a, c, 7); g.fill(); } } }
  }, { rim: 4, sh: [3, 4], night });
}

// ---------- 糖果小店 ----------
const SHOP_N = 6;
function shopDims(v) { const R = rng('s01-shop-size', v); return [250 + R() * 80, 290 + R() * 90]; }
function shopSprite(v, night) {
  const [w, h] = shopDims(v);
  return bakeSticker(`shop${v}`, [-w / 2 - 20, -h - 90, w / 2 + 20, 30], (g, nt, tint) => {
    const R = rng('s01-shop', v);
    const wall = [PINK_L, BLUE_L, CREAM, '#c9f2de', '#e4d6ff', '#ffd9c6'][v];
    const trim = [PINK_D, BLUE_D, CREAM_D, MINT_D, LILAC_D, '#ff9a7a'][v];
    const aw = [PINK, BLUE, PINK, BLUE, MINT, LILAC][v];
    // 墙（向下多画一截，拉远时不露缝）
    g.fillStyle = wall; roundRect(g, -w / 2, -h, w, h + 30, 14); g.fill();
    g.fillStyle = rgba(PLUM, 0.07); g.fillRect(w / 2 - 22, -h + 8, 22, h + 22);
    // 屋顶
    const roof = v % 3;
    g.fillStyle = trim;
    if (roof === 0) {
      roundRect(g, -w / 2 - 10, -h - 16, w + 20, 26, 10); g.fill();
      g.fillStyle = WHITE;
      for (let x = -w / 2 - 4; x < w / 2 + 6; x += 22) { g.beginPath(); g.arc(x + 11, -h + 10, 11, 0, Math.PI); g.fill(); }
    } else if (roof === 1) {
      g.beginPath(); g.moveTo(-w / 2 - 16, -h + 6); g.lineTo(0, -h - 80); g.lineTo(w / 2 + 16, -h + 6); g.closePath(); g.fill();
      g.fillStyle = WHITE; circle(g, 0, -h - 30, 15); g.fill();
      g.fillStyle = BLUE; circle(g, 0, -h - 30, 10); g.fill();
    } else {
      g.beginPath(); g.arc(0, -h + 4, w * 0.36, Math.PI, 0); g.closePath(); g.fill();
      g.fillStyle = rgba(WHITE, 0.55); g.beginPath(); g.arc(-w * 0.1, -h - w * 0.12, w * 0.12, Math.PI * 1.1, Math.PI * 1.7); g.lineWidth = 6; g.strokeStyle = rgba(WHITE, 0.6); g.stroke();
      g.fillStyle = CREAM_D; circle(g, 0, -h - w * 0.36 - 6, 9); g.fill();
    }
    // 楼上窗
    const wins = [];
    const nw = w > 300 ? 3 : 2;
    for (let i = 0; i < nw; i++) {
      const ww = 52, wx = -w / 2 + (w / nw) * (i + 0.5) - ww / 2, wy = -h + 42;
      wins.push([wx, wy, ww, 70]);
      g.fillStyle = WHITE; roundRect(g, wx - 6, wy - 6, ww + 12, 82, 26); g.fill();
      g.fillStyle = BLUE_L; roundRect(g, wx, wy, ww, 70, 22); g.fill();
      g.strokeStyle = rgba(WHITE, 0.9); g.lineWidth = 5; g.beginPath(); g.moveTo(wx + 12, wy + 50); g.lineTo(wx + 30, wy + 16); g.stroke();
      // 花箱
      g.fillStyle = trim; roundRect(g, wx - 8, wy + 74, ww + 16, 14, 6); g.fill();
      for (let k = 0; k < 4; k++) { g.fillStyle = CANDY[(k + v) % CANDY.length]; circle(g, wx + 2 + k * 16, wy + 72, 6); g.fill(); }
    }
    // 空白招牌：只有一个小图形
    const sy = -h + 140;
    g.fillStyle = WHITE; roundRect(g, -w * 0.32, sy, w * 0.64, 40, 20); g.fill();
    g.fillStyle = CREAM_L; roundRect(g, -w * 0.32 + 5, sy + 5, w * 0.64 - 10, 30, 15); g.fill();
    g.save(); g.translate(0, sy + 20);
    const icon = R() * 3 | 0;
    if (icon === 0) { g.fillStyle = PINK_D; g.fill(heartP(11)); }
    else if (icon === 1) { g.fillStyle = CREAM_D; g.fill(starP(13)); }
    else { g.fillStyle = BLUE_D; circle(g, 0, -3, 10); g.fill(); g.fillStyle = '#e8b277'; g.beginPath(); g.moveTo(-8, 2); g.lineTo(8, 2); g.lineTo(0, 16); g.closePath(); g.fill(); }
    g.restore();
    // 遮阳篷（条纹 + 扇贝边）
    const ay = -150, aw0 = -w / 2 + 8, aw1 = w / 2 - 8;
    g.save();
    const awn = P((p) => { p.moveTo(aw0, ay - 18); p.lineTo(aw1, ay - 18); p.lineTo(aw1 + 10, ay + 18); const n = 8, st = (aw1 - aw0 + 20) / n; for (let k = 0; k < n; k++) { const ex = aw1 + 10 - k * st; p.quadraticCurveTo(ex - st / 2, ay + 34, ex - st, ay + 18); } p.closePath(); });
    g.fillStyle = WHITE; g.fill(awn); g.clip(awn);
    g.fillStyle = aw; const st = (aw1 - aw0 + 20) / 8;
    for (let k = 0; k < 8; k += 2) g.fillRect(aw0 - 10 + k * st, ay - 20, st, 60);
    g.restore();
    // 店面：橱窗 + 门
    const fy = ay + 34;
    const door = R() < 0.5 ? -1 : 1;
    const dx = door * (w / 2 - 60);
    g.fillStyle = WHITE; roundRect(g, -w / 2 + 16, fy, w - 32, -fy - 4, 10); g.fill();
    const gx0 = door < 0 ? dx + 40 : -w / 2 + 26, gx1 = door < 0 ? w / 2 - 26 : dx - 40;
    g.fillStyle = BLUE_L; roundRect(g, gx0, fy + 10, gx1 - gx0, -fy - 34, 8); g.fill();
    wins.push([gx0, fy + 10, gx1 - gx0, -fy - 34]);
    // 橱窗里的糖果（只有图形）
    for (let k = 0; k < 3; k++) {
      const cx = gx0 + (gx1 - gx0) * (k + 0.5) / 3, cy = -40;
      g.fillStyle = WHITE; roundRect(g, cx - 18, cy, 36, 10, 4); g.fill();
      if ((k + v) % 2) { g.fillStyle = CANDY[(k * 2 + v) % 6]; circle(g, cx, cy - 22, 17); g.fill(); g.strokeStyle = WHITE; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy - 22, 9, 0, 4.5); g.stroke(); g.fillStyle = WHITE; g.fillRect(cx - 2, cy - 6, 4, 8); }
      else { g.fillStyle = PINK_L; roundRect(g, cx - 16, cy - 26, 32, 26, 6); g.fill(); g.fillStyle = WHITE; roundRect(g, cx - 18, cy - 32, 36, 10, 5); g.fill(); g.fillStyle = PINK_D; circle(g, cx, cy - 36, 5); g.fill(); }
    }
    g.strokeStyle = rgba(WHITE, 0.85); g.lineWidth = 6;
    g.beginPath(); g.moveTo(gx0 + 14, -30); g.lineTo(gx0 + 50, fy + 14); g.stroke();
    g.fillStyle = trim; roundRect(g, dx - 30, fy + 8, 60, -fy - 8, 26); g.fill();
    g.fillStyle = BLUE_L; circle(g, dx, fy + 40, 13); g.fill();
    g.fillStyle = CREAM_D; circle(g, dx + door * -18, -60, 4); g.fill();
    if (nt) {
      tint();
      for (const [x, y, ww, hh] of wins) {
        g.fillStyle = rgba(GLOW, 0.95); roundRect(g, x, y, ww, hh, Math.min(22, ww / 2)); g.fill();
        g.fillStyle = rgba('#ffffff', 0.5); roundRect(g, x + 4, y + 4, ww - 8, hh * 0.35, Math.min(18, ww / 2)); g.fill();
      }
    }
  }, { rim: 6, sh: [5, 7], night });
}

// ---------- 橱窗店（第 1–3 小节的女孩剪影都在这里） ----------
const PANES = [-165, -55, 55, 165];
const PANE_Y = [-350, -238];        // 楼上四个小窗（局部 y）
const DISP = [-130, 235, -205, -32]; // 橱窗：x0, x1, y0, y1
const DOOR = [-262, -168, -200];     // 店门：x0, x1, 顶
const DGIRL = -10;                   // 橱窗里女孩剪影站的位置（局部 x）
function boutiqueSprite(night) {
  return bakeSticker('boutique', [-320, -470, 320, 30], (g, nt, tint) => {
    // 墙
    g.fillStyle = PINK_L; roundRect(g, -300, -410, 600, 440, 18); g.fill();
    g.fillStyle = rgba(PLUM, 0.06); g.fillRect(270, -400, 30, 430);
    // 楼层腰线
    g.fillStyle = WHITE; g.fillRect(-300, -222, 600, 10);
    // 顶上的拱形装饰 + 爱心
    g.fillStyle = PINK; g.beginPath(); g.moveTo(-310, -400); g.lineTo(310, -400); g.lineTo(310, -420); g.lineTo(-310, -420); g.fill();
    g.beginPath(); g.arc(0, -416, 64, Math.PI, 0); g.closePath(); g.fill();
    g.fillStyle = WHITE; for (let x = -300; x <= 300; x += 24) { g.beginPath(); g.arc(x, -400, 10, 0, Math.PI); g.fill(); }
    g.save(); g.translate(0, -440); g.fillStyle = WHITE; g.fill(heartP(26)); g.fillStyle = PINK_D; g.fill(heartP(19)); g.restore();
    // 楼上四个拱窗（底色各不相同）
    const paneCol = [PINK_L, '#d4f7e6', BLUE_L, CREAM_L];
    PANES.forEach((x, i) => {
      g.fillStyle = WHITE; roundRect(g, x - 48, PANE_Y[0] - 6, 96, PANE_Y[1] - PANE_Y[0] + 12, 46); g.fill();
      g.fillStyle = paneCol[i]; roundRect(g, x - 41, PANE_Y[0], 82, PANE_Y[1] - PANE_Y[0], 40); g.fill();
      g.fillStyle = [PINK, MINT, BLUE, CREAM_D][i]; roundRect(g, x - 50, PANE_Y[1] + 6, 100, 14, 6); g.fill();
    });
    // 遮阳篷
    const ay = -232;
    const awn = P((p) => { p.moveTo(DISP[0] - 18, ay - 4); p.lineTo(DISP[1] + 18, ay - 4); p.lineTo(DISP[1] + 30, ay + 26); const n = 9, st = (DISP[1] - DISP[0] + 60) / n; for (let k = 0; k < n; k++) { const ex = DISP[1] + 30 - k * st; p.quadraticCurveTo(ex - st / 2, ay + 44, ex - st, ay + 26); } p.closePath(); });
    g.save(); g.fillStyle = WHITE; g.fill(awn); g.clip(awn);
    g.fillStyle = BLUE; const st = (DISP[1] - DISP[0] + 60) / 9;
    for (let k = 0; k < 10; k += 2) g.fillRect(DISP[0] - 30 + k * st, ay - 10, st, 60);
    g.restore();
    // 橱窗
    g.fillStyle = WHITE; roundRect(g, DISP[0] - 10, DISP[2] - 6, DISP[1] - DISP[0] + 20, DISP[3] - DISP[2] + 18, 14); g.fill();
    const gr = g.createLinearGradient(0, DISP[2], 0, DISP[3]); gr.addColorStop(0, '#e3f6ff'); gr.addColorStop(1, '#ffe6f2');
    g.fillStyle = gr; roundRect(g, DISP[0], DISP[2], DISP[1] - DISP[0], DISP[3] - DISP[2], 10); g.fill();
    // 小展台
    g.fillStyle = CREAM_D; roundRect(g, DGIRL - 46, DISP[3] - 18, 92, 16, 6); g.fill();
    g.fillStyle = WHITE; roundRect(g, DGIRL - 50, DISP[3] - 22, 100, 7, 3); g.fill();
    // 橱窗右边：一排小礼物盒
    for (let k = 0; k < 3; k++) {
      const x = 120 + k * 36, y = DISP[3] - 4;
      g.fillStyle = CANDY[k + 1]; roundRect(g, x - 15, y - 30, 30, 30, 4); g.fill();
      g.fillStyle = WHITE; g.fillRect(x - 3, y - 30, 6, 30); g.fillRect(x - 15, y - 18, 30, 5);
      g.fillStyle = PINK_D; circle(g, x - 6, y - 33, 5); g.fill(); circle(g, x + 6, y - 33, 5); g.fill();
    }
    // 底座
    g.fillStyle = PINK; roundRect(g, DISP[0] - 10, DISP[3] + 10, DISP[1] - DISP[0] + 20, 26, 6); g.fill();
    // 店门
    g.fillStyle = WHITE; roundRect(g, DOOR[0] - 8, DOOR[2] - 8, DOOR[1] - DOOR[0] + 16, -DOOR[2] + 10, 40); g.fill();
    g.fillStyle = MINT; roundRect(g, DOOR[0], DOOR[2], DOOR[1] - DOOR[0], -DOOR[2], 34); g.fill();
    g.fillStyle = BLUE_L; circle(g, (DOOR[0] + DOOR[1]) / 2, DOOR[2] + 44, 18); g.fill();
    g.fillStyle = CREAM_D; circle(g, DOOR[1] - 14, -92, 5); g.fill();
    g.fillStyle = PINK; roundRect(g, DOOR[0] - 14, -6, DOOR[1] - DOOR[0] + 28, 12, 4); g.fill();
    if (nt) {
      tint();
      PANES.forEach((x) => { g.fillStyle = rgba(GLOW, 0.92); roundRect(g, x - 41, PANE_Y[0], 82, PANE_Y[1] - PANE_Y[0], 40); g.fill(); });
      g.fillStyle = rgba(GLOW, 0.9); roundRect(g, DISP[0], DISP[2], DISP[1] - DISP[0], DISP[3] - DISP[2], 10); g.fill();
      g.fillStyle = rgba(GLOW, 0.8); circle(g, (DOOR[0] + DOOR[1]) / 2, DOOR[2] + 44, 18); g.fill();
    }
  }, { rim: 7, sh: [5, 8], night });
}

// ---------- 人行道道具 ----------
const NEAR_TYPES = ['lamp', 'lolly', 'planter', 'hydrant', 'mailbox'];
function nearSprite(type, night) {
  const boxes = { lamp: [-60, -440, 60, 20], lolly: [-90, -360, 90, 20], planter: [-70, -50, 70, 20], hydrant: [-40, -90, 40, 20], mailbox: [-40, -170, 40, 20] };
  return bakeSticker(`near-${type}`, boxes[type], (g, nt, tint) => {
    if (type === 'lamp') {
      // 拐杖糖路灯
      g.save();
      const pole = P((p) => { p.moveTo(-9, 10); p.lineTo(-9, -340); p.arc(26, -340, 35, Math.PI, 0); p.lineTo(70, -338); p.lineTo(52, -338); p.arc(26, -340, 26, 0, Math.PI, true); p.lineTo(9, 10); p.closePath(); });
      g.fillStyle = WHITE; g.fill(pole); g.clip(pole);
      g.strokeStyle = PINK_D; g.lineWidth = 14;
      for (let y = 20; y > -420; y -= 40) { g.beginPath(); g.moveTo(-20, y); g.lineTo(20, y - 26); g.stroke(); }
      g.beginPath(); g.arc(26, -340, 30, Math.PI, Math.PI * 1.5); g.stroke(); g.beginPath(); g.arc(26, -340, 30, Math.PI * 1.65, Math.PI * 1.95); g.stroke();
      g.restore();
      g.fillStyle = CREAM_D; roundRect(g, 46, -332, 30, 12, 5); g.fill();
      g.fillStyle = CREAM_L; ellipse(g, 61, -300, 22, 24); g.fill();
      g.fillStyle = rgba(WHITE, 0.9); ellipse(g, 54, -308, 6, 9); g.fill();
      g.fillStyle = PINK; roundRect(g, -18, -12, 36, 22, 6); g.fill();
      if (nt) {
        tint();
        const rg = g.createRadialGradient(61, -300, 2, 61, -300, 60);
        rg.addColorStop(0, rgba(GLOW, 1)); rg.addColorStop(0.4, rgba(GLOW, 0.6)); rg.addColorStop(1, rgba(GLOW, 0));
        g.fillStyle = rg; circle(g, 61, -300, 60); g.fill();
      }
    } else if (type === 'lolly') {
      // 棒棒糖树
      g.fillStyle = '#f4d7b0'; roundRect(g, -8, -230, 16, 240, 6); g.fill();
      g.fillStyle = MINT; ellipse(g, 0, 4, 46, 10); g.fill();
      g.fillStyle = PINK_L; circle(g, 0, -280, 72); g.fill();
      g.strokeStyle = PINK_D; g.lineWidth = 15; g.beginPath();
      for (let i = 0; i <= 80; i++) { const a = (i / 80) * TAU * 2.6, r = 6 + (i / 80) * 58; const x = Math.cos(a) * r, y = -280 + Math.sin(a) * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.stroke();
      g.fillStyle = rgba(WHITE, 0.75); ellipse(g, -30, -312, 14, 8, -0.6); g.fill();
      g.fillStyle = BLUE; g.save(); g.translate(0, -206); g.beginPath(); g.moveTo(0, 0); g.lineTo(-24, -12); g.lineTo(-24, 12); g.closePath(); g.moveTo(0, 0); g.lineTo(24, -12); g.lineTo(24, 12); g.closePath(); g.fill(); circle(g, 0, 0, 6); g.fill(); g.restore();
    } else if (type === 'planter') {
      g.fillStyle = PINK; roundRect(g, -62, -42, 124, 50, 10); g.fill();
      g.fillStyle = WHITE; for (let k = -2; k <= 2; k++) { circle(g, k * 24, -18, 5); g.fill(); }
      g.fillStyle = '#8fd8a8'; roundRect(g, -58, -50, 116, 12, 6); g.fill();
    } else if (type === 'hydrant') {
      g.fillStyle = MINT; roundRect(g, -20, -70, 40, 74, 10); g.fill();
      g.beginPath(); g.arc(0, -70, 22, Math.PI, 0); g.fill();
      g.fillStyle = MINT_D; roundRect(g, -32, -52, 64, 14, 6); g.fill(); roundRect(g, -26, -4, 52, 10, 4); g.fill();
      g.fillStyle = INK; circle(g, -7, -34, 3); g.fill(); circle(g, 7, -34, 3); g.fill();
      g.fillStyle = rgba(PINK, 0.8); ellipse(g, -12, -25, 5, 3); g.fill(); ellipse(g, 12, -25, 5, 3); g.fill();
    } else {
      g.fillStyle = '#9aa6c9'; g.fillRect(-5, -80, 10, 84);
      g.fillStyle = BLUE; roundRect(g, -32, -160, 64, 82, 26); g.fill();
      g.fillStyle = BLUE_D; roundRect(g, -20, -132, 40, 6, 3); g.fill();
      g.save(); g.translate(0, -104); g.fillStyle = WHITE; g.fill(heartP(10)); g.restore();
    }
  }, { rim: 5, sh: [5, 7], night });
}
// 花箱里的郁金香：随风摆（直升机起飞时被吹得东倒西歪）
function tulips(ctx, x, y, b, wind, N) {
  for (let k = 0; k < 5; k++) {
    const bx = x - 44 + k * 22, h = 38 + (k % 2) * 12;
    const a = 0.08 * Math.sin(b * Math.PI + k + x * 0.01) + wind * (0.9 + 0.3 * Math.sin(b * 9 + k));
    const tx = bx + Math.sin(a) * h, ty = y - 46 - Math.cos(a) * h;
    ctx.strokeStyle = mix('#4fc493', '#5a4a8a', 0.35 * N); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx, y - 46); ctx.quadraticCurveTo(bx, y - 46 - h * 0.5, tx, ty); ctx.stroke();
    const col = mix([PINK_D, CREAM_D, '#ff7a6e', LILAC_D, BLUE_D][k], '#5a4a8a', 0.3 * N);
    ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
    const p = P((q) => { q.moveTo(-10, -4); q.lineTo(-10, -18); q.lineTo(-4, -12); q.lineTo(0, -20); q.lineTo(4, -12); q.lineTo(10, -18); q.lineTo(10, -4); q.quadraticCurveTo(10, 8, 0, 8); q.quadraticCurveTo(-10, 8, -10, -4); q.closePath(); });
    sticker(ctx, [[p, col]], { rim: 2.5, shadow: false });
    ctx.restore();
  }
}

// ---------- 草地上的小树和小房子（只在镜头拉远时看得见） ----------
function treeSprite(v, night) {
  return bakeSticker(`tree${v}`, [-60, -160, 60, 10], (g) => {
    g.fillStyle = '#e8b98c'; roundRect(g, -7, -60, 14, 66, 5); g.fill();
    g.fillStyle = [MINT, PINK_L, '#b9efd2'][v]; circle(g, 0, -100, 52); g.fill();
    g.fillStyle = rgba(WHITE, 0.6); circle(g, -18, -118, 12); g.fill();
    g.fillStyle = [PINK_D, CREAM_D, BLUE_D][v]; for (let k = 0; k < 4; k++) { circle(g, Math.cos(k * 1.7) * 30, -100 + Math.sin(k * 1.7) * 26, 6); g.fill(); }
  }, { rim: 5, sh: [5, 7], night });
}

// ---------- 地面：人行道、路沿、马路、草地 ----------
const SIDE0 = 776, CURB = 886, ROAD0 = 900, ROAD1 = 1062, LAWN = 1078;
function drawGround(ctx, x0, x1, y1, zp, cam, N) {
  const c = (h) => (N > 0.002 ? mix(h, '#5a3f96', 0.36 * N) : h);
  ctx.fillStyle = c('#fff1dc'); ctx.fillRect(x0, SIDE0, x1 - x0, CURB - SIDE0);
  ctx.fillStyle = c('#ffe0e6'); ctx.fillRect(x0, SIDE0, x1 - x0, 10);
  // 方砖缝
  if (zp > 0.2) {
    ctx.strokeStyle = c('#ffd0dc'); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x0, 832); ctx.lineTo(x1, 832); ctx.stroke();
    const k0 = Math.floor((x0 + cam) / 84), k1 = Math.ceil((x1 + cam) / 84);
    ctx.beginPath();
    for (let k = k0; k <= k1; k++) {
      const x = k * 84 - cam;
      ctx.moveTo(x, 788); ctx.lineTo(x - 6, 832);
      ctx.moveTo(x + 42, 832); ctx.lineTo(x + 34, CURB);
    }
    ctx.stroke();
    // 小圆点花砖
    ctx.fillStyle = c('#ffc6d8');
    for (let k = k0; k <= k1; k += 2) { circle(ctx, k * 84 - cam + 40, 810, 4); ctx.fill(); }
  }
  // 路沿
  ctx.fillStyle = c(PINK); ctx.fillRect(x0, CURB, x1 - x0, ROAD0 - CURB);
  ctx.fillStyle = c(WHITE); ctx.fillRect(x0, CURB, x1 - x0, 4);
  // 马路（淡紫）+ 奶黄虚线
  ctx.fillStyle = c('#d7c6f2'); ctx.fillRect(x0, ROAD0, x1 - x0, ROAD1 - ROAD0);
  ctx.fillStyle = c('#cbb7ec'); ctx.fillRect(x0, ROAD0, x1 - x0, 10);
  ctx.fillStyle = c(CREAM_L);
  const d0 = Math.floor((x0 + cam) / 150), d1 = Math.ceil((x1 + cam) / 150);
  for (let k = d0; k <= d1; k++) { roundRect(ctx, k * 150 - cam, 974, 76, 10, 5); ctx.fill(); }
  // 再往下：草地（只有拉远时看得见）
  if (y1 > ROAD1) {
    ctx.fillStyle = c(CREAM_D); ctx.fillRect(x0, ROAD1, x1 - x0, LAWN - ROAD1);
    ctx.fillStyle = c('#bff0d6'); ctx.fillRect(x0, LAWN, x1 - x0, y1 - LAWN + 10);
    if (zp < 0.95) {
      // 两排整整齐齐的小圆树（只在镜头拉远时露出来）
      for (let j = 0; j < 4; j++) {
        const yy = LAWN + 700 + j * 760;
        if (yy - 300 > y1) break;
        const step = 520 + j * 60;
        const k0 = Math.floor((x0 + cam) / step) - 1, k1 = Math.ceil((x1 + cam) / step) + 1;
        for (let k = k0; k <= k1; k++) {
          const x = k * step - cam + (j % 2) * step * 0.5;
          drawSt(ctx, treeSprite(((k + j) % 3 + 3) % 3, false), x, yy, 2.2);
        }
      }
    }
  }
}

// ---------- 剪影（原创） ----------
function silhouette(ctx, kind, H = 150, o = {}) {
  // 局部坐标：脚下 (0,0)，高 H。kind: 'girl' | 'boy'
  const s = H / 150;
  ctx.save(); ctx.scale(s, s);
  const parts = [];
  if (kind === 'girl') {
    parts.push([ellP(0, -128, 15, 16), SIL]);
    parts.push([ellP(-17, -136, 9, 17, 0.5), SIL]); // 马尾
    parts.push([polyP([[-6, -114], [6, -114], [9, -104], [-9, -104]]), SIL]);
    parts.push([P((p) => { p.moveTo(-11, -108); p.lineTo(11, -108); p.lineTo(28, -52); p.quadraticCurveTo(0, -44, -28, -52); p.closePath(); }), SIL]);
    parts.push([P((p) => { p.moveTo(-10, -104); p.lineTo(-22, -70); p.lineTo(-15, -68); p.lineTo(-4, -98); p.closePath(); }), SIL]);
    parts.push([P((p) => { p.moveTo(10, -104); p.lineTo(22, -70); p.lineTo(15, -68); p.lineTo(4, -98); p.closePath(); }), SIL]);
    parts.push([rrP(-12, -52, 7, 48, 3), SIL]);
    parts.push([rrP(5, -52, 7, 48, 3), SIL]);
    parts.push([ellP(-9, -3, 9, 5), SIL]);
    parts.push([ellP(10, -3, 9, 5), SIL]);
    parts.push([P((p) => { p.moveTo(-10, -148); p.lineTo(-24, -156); p.lineTo(-22, -142); p.closePath(); p.moveTo(-10, -148); p.lineTo(2, -158); p.lineTo(4, -144); p.closePath(); }), PINK]);
  } else {
    parts.push([ellP(0, -134, 15, 16), SIL]);
    parts.push([P((p) => { p.moveTo(-16, -138); p.lineTo(-12, -156); p.lineTo(-4, -150); p.lineTo(2, -160); p.lineTo(8, -151); p.lineTo(17, -154); p.lineTo(16, -136); p.closePath(); }), SIL]);
    parts.push([polyP([[-6, -120], [6, -120], [8, -110], [-8, -110]]), SIL]);
    parts.push([rrP(-17, -114, 34, 56, 9), SIL]);
    parts.push([P((p) => { p.moveTo(-15, -110); p.lineTo(-26, -70); p.lineTo(-19, -67); p.lineTo(-8, -100); p.closePath(); }), SIL]);
    parts.push([P((p) => { p.moveTo(15, -110); p.lineTo(26, -70); p.lineTo(19, -67); p.lineTo(8, -100); p.closePath(); }), SIL]);
    parts.push([rrP(-15, -62, 13, 60, 4), SIL]);
    parts.push([rrP(2, -62, 13, 60, 4), SIL]);
    parts.push([ellP(-9, -3, 10, 5), SIL]);
    parts.push([ellP(10, -3, 10, 5), SIL]);
    parts.push([rrP(-16, -150, 32, 7, 3), BLUE]); // 帽檐一样的发带
  }
  sticker(ctx, parts, { rim: 4 / s, shadow: o.shadow !== false, sh: [3 / s, 4 / s] });
  ctx.restore();
}

// 四个小窗里的女孩小剪影（胸像，局部原点在窗底中央）
function bustBase(hair) {
  const parts = [[P((p) => { p.moveTo(-34, 0); p.quadraticCurveTo(-34, -30, 0, -32); p.quadraticCurveTo(34, -30, 34, 0); p.closePath(); }), SIL],
    [rrP(-6, -40, 12, 12, 3), SIL], [ellP(0, -56, 18, 19), SIL]];
  return parts.concat(hair);
}
function drawBust(ctx, i, k, b) {
  // i: 0 害羞、1 抱猫、2 玻璃气泡、3 眨眼吐舌
  ctx.save();
  ctx.scale(k, k);
  if (i === 0) {
    const parts = bustBase([[ellP(-16, -72, 9, 9), SIL], [ellP(16, -72, 9, 9), SIL]]);
    parts.push([ellP(-16, -46, 8, 9), SIL_L], [ellP(16, -46, 8, 9), SIL_L]); // 两只手捂着脸
    sticker(ctx, parts, { rim: 3.5, sh: [2, 3] });
    ctx.fillStyle = rgba('#ff6fa8', 0.95); ellipse(ctx, -9, -50, 6, 3.5); ctx.fill(); ellipse(ctx, 9, -50, 6, 3.5); ctx.fill();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 7, -59, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
    ctx.strokeStyle = PINK_D; ctx.lineWidth = 2.4;
    for (let n = 0; n < 3; n++) { ctx.beginPath(); ctx.moveTo(22 + n * 6, -66); ctx.lineTo(18 + n * 6, -56); ctx.stroke(); }
  } else if (i === 1) {
    ctx.save(); ctx.translate(0, -30); ctx.rotate(-0.16); ctx.translate(0, 30);
    const parts = bustBase([[P((p) => { p.moveTo(-20, -56); p.quadraticCurveTo(-22, -82, 0, -78); p.quadraticCurveTo(24, -80, 21, -54); p.lineTo(24, -26); p.lineTo(12, -30); p.lineTo(-12, -30); p.lineTo(-24, -26); p.closePath(); }), SIL]]);
    sticker(ctx, parts, { rim: 3.5, sh: [2, 3] });
    ctx.restore();
    // 怀里的猫
    const cat = [[ellP(4, -14, 22, 13), SIL_L], [ellP(6, -26, 12, 11), SIL_L],
      [polyP([[-4, -32], [-2, -44], [4, -34]]), SIL_L], [polyP([[8, -34], [14, -44], [16, -31]]), SIL_L]];
    sticker(ctx, cat, { rim: 3, shadow: false });
    ctx.strokeStyle = WHITE; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(2, -27, 2.4, 0.2, Math.PI - 0.2); ctx.stroke(); ctx.beginPath(); ctx.arc(10, -27, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
    ctx.fillStyle = PINK; ctx.save(); ctx.translate(26, -78); ctx.fill(heartP(7 + 1.5 * Math.sin(b * Math.PI * 2))); ctx.restore();
  } else if (i === 2) {
    // 像玻璃气泡一样透明
    ctx.fillStyle = 'rgba(255,255,255,0.22)'; circle(ctx, 0, -42, 44); ctx.fill();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 3; ctx.stroke();
    const parts = bustBase([[ellP(0, -62, 20, 16), 'rgba(160,220,255,0.35)']]);
    ctx.save();
    for (const [p] of parts) { ctx.fillStyle = 'rgba(170,225,255,0.45)'; ctx.fill(p); }
    ctx.strokeStyle = WHITE; ctx.lineWidth = 2.6; for (const [p] of parts) ctx.stroke(p);
    ctx.restore();
    ctx.strokeStyle = rgba(WHITE, 0.95); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, -42, 36, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
    ctx.fillStyle = WHITE; circle(ctx, 22, -70, 3); ctx.fill();
    for (let n = 0; n < 3; n++) { const yy = -20 - ((b * 0.6 + n / 3) % 1) * 70; ctx.strokeStyle = rgba(WHITE, 0.9); ctx.lineWidth = 1.6; circle(ctx, 30 + n * 4 - 12, yy, 3 + n); ctx.stroke(); }
  } else {
    const parts = bustBase([[ellP(-20, -60, 8, 18, 0.5), SIL], [P((p) => { p.moveTo(-18, -66); p.quadraticCurveTo(0, -84, 19, -64); p.lineTo(10, -70); p.lineTo(-10, -70); p.closePath(); }), SIL]]);
    parts.push([polyP([[-12, -72], [-16, -86], [-5, -76]]), PINK_D], [polyP([[12, -72], [16, -86], [5, -76]]), PINK_D]); // 小恶魔角
    sticker(ctx, parts, { rim: 3.5, sh: [2, 3] });
    ctx.fillStyle = WHITE; ellipse(ctx, -7, -58, 2.6, 3.6); ctx.fill();
    ctx.strokeStyle = WHITE; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(5, -61); ctx.lineTo(10, -58); ctx.lineTo(5, -55); ctx.stroke();
    ctx.fillStyle = '#ff7aa8'; roundRect(ctx, -2, -48, 9, 10, 4); ctx.fill();
    ctx.fillStyle = CREAM_D; ctx.save(); ctx.translate(24, -66); ctx.rotate(b * 2); ctx.fill(sparkleP(7)); ctx.restore();
  }
  ctx.restore();
}

// ---------- 直升机 ----------
function heliBody() {
  return bakeSticker('heli', [-175, -82, 80, 82], (g) => {
    // 尾梁
    const boom = P((p) => { p.moveTo(-44, -8); p.lineTo(-150, -22); p.quadraticCurveTo(-158, -14, -150, -6); p.lineTo(-44, 16); p.closePath(); });
    g.fillStyle = CREAM; g.fill(boom);
    g.save(); g.clip(boom); g.fillStyle = PINK; for (const x of [-70, -100, -128]) g.fillRect(x, -30, 12, 60); g.restore();
    // 起落架
    g.fillStyle = CREAM_D;
    for (const sx of [-1, 1]) { g.save(); g.translate(sx * 26, 58); g.rotate(-sx * 0.25); roundRect(g, -4, -14, 8, 26, 4); g.fill(); g.restore(); }
    roundRect(g, -56, 66, 116, 10, 5); g.fill();
    g.beginPath(); g.arc(60, 62, 9, -Math.PI / 2, Math.PI / 2); g.lineWidth = 8; g.strokeStyle = CREAM_D; g.stroke();
    // 桅杆 + 桨毂
    g.fillStyle = CREAM_D; roundRect(g, -5, -66, 10, 16, 3); g.fill();
    g.fillStyle = CREAM; circle(g, 0, -68, 9); g.fill();
    // 机身：圆滚滚
    const gr = g.createRadialGradient(-22, -24, 6, 0, 0, 70);
    gr.addColorStop(0, '#ffd3e6'); gr.addColorStop(0.55, PINK); gr.addColorStop(1, '#f374ae');
    g.fillStyle = gr; ellipse(g, 0, 0, 62, 54); g.fill();
    g.save(); ellipse(g, 0, 0, 62, 54); g.clip(); g.fillStyle = CREAM_L; ellipse(g, 6, 50, 70, 22); g.fill(); g.restore();
    // 舱窗（乘客坐在这里）
    g.fillStyle = WHITE; ellipse(g, -12, -14, 40, 32); g.fill();
    g.fillStyle = '#bfeaff'; ellipse(g, -12, -14, 35, 27); g.fill();
    // 脸：在机头
    g.fillStyle = INK; ellipse(g, 38, 4, 4.2, 6); g.fill(); ellipse(g, 52, 2, 3.8, 5.6); g.fill();
    g.fillStyle = WHITE; circle(g, 39.5, 1.5, 1.6); g.fill(); circle(g, 53.2, -0.5, 1.4); g.fill();
    g.fillStyle = rgba('#ff5f9a', 0.6); ellipse(g, 34, 15, 6, 3.4); g.fill(); ellipse(g, 56, 13, 5, 3); g.fill();
    g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round'; g.beginPath(); g.arc(46, 11, 4, 0.2, Math.PI - 0.2); g.stroke();
  }, { res: 2, rim: 5, sh: [4, 6] });
}
/** 机舱里并肩坐着的两个剪影（局部坐标，已在舱窗位置）。 */
function seated(ctx, girl, boy) {
  ctx.save();
  ctx.beginPath(); ctx.ellipse(-12, -14, 35, 27, 0, 0, TAU); ctx.clip();
  if (girl) {
    ctx.fillStyle = SIL; circle(ctx, -24, -18, 10); ctx.fill(); ellipse(ctx, -24, 6, 14, 12); ctx.fill();
    ellipse(ctx, -33, -22, 5, 9, 0.5); ctx.fill();
    ctx.fillStyle = PINK; ctx.beginPath(); ctx.moveTo(-28, -28); ctx.lineTo(-36, -33); ctx.lineTo(-35, -24); ctx.closePath(); ctx.fill();
  }
  if (boy) {
    ctx.fillStyle = SIL; circle(ctx, 0, -20, 11); ctx.fill(); ellipse(ctx, 0, 6, 16, 12); ctx.fill();
    ctx.fillStyle = BLUE; roundRect(ctx, -11, -31, 22, 5, 2); ctx.fill();
  }
  ctx.restore();
  // 玻璃反光
  ctx.strokeStyle = rgba(WHITE, 0.9); ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(-12, -14, 28, 21, 0, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
}
/** 画直升机：局部坐标原点在机身中心。o = { girl, boy, wag, rotor, blur } */
function drawHeliLocal(ctx, b, o = {}) {
  // 尾翼爱心（摇尾巴）
  ctx.save(); ctx.translate(-152, -16); ctx.rotate(o.wag || 0);
  ctx.translate(-6, -10);
  sticker(ctx, [[heartP(18), PINK_D]], { rim: 4, sh: [3, 4] });
  ctx.restore();
  // 尾桨
  ctx.save(); ctx.translate(-150, -14); ctx.rotate(b * TAU * 2.4);
  ctx.fillStyle = BLUE; for (let i = 0; i < 3; i++) { ctx.rotate(TAU / 3); roundRect(ctx, -2.5, 0, 5, 15, 2.5); ctx.fill(); }
  ctx.fillStyle = WHITE; circle(ctx, 0, 0, 4); ctx.fill();
  ctx.restore();
  drawSt(ctx, heliBody(), 0, 0);
  seated(ctx, o.girl, o.boy);
  // 主旋翼：转得飞快（模糊圆盘 + 两片桨 + 速度弧线）
  ctx.save(); ctx.translate(0, -72);
  ctx.fillStyle = rgba(WHITE, 0.42); ellipse(ctx, 0, 0, 128, 13); ctx.fill();
  ctx.strokeStyle = rgba(WHITE, 0.9); ctx.lineWidth = 2.5; ctx.stroke();
  const a = b * TAU * 2.15;
  for (const k of [0, Math.PI]) {
    const L = 124 * Math.cos(a + k);
    ctx.fillStyle = BLUE_D;
    roundRect(ctx, Math.min(0, L), -5, Math.abs(L), 10, 5); ctx.fill();
  }
  ctx.strokeStyle = rgba(BLUE, 0.7); ctx.lineWidth = 3;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.ellipse(0, 0, 140, 20, 0, sx < 0 ? Math.PI * 0.85 : -Math.PI * 0.15, sx < 0 ? Math.PI * 1.1 : Math.PI * 0.1); ctx.stroke(); }
  ctx.fillStyle = CREAM_D; circle(ctx, 0, 0, 7); ctx.fill();
  ctx.restore();
}

/** 直升机在第 b 拍的位置（画面单位）、大小、朝向。 */
function heliAt(b) {
  if (b < GAG - 4) {
    // 第 1 小节：像小狗一样跟着他（每拍一跳）；进场时从左边追上来
    const fx = CHAR_X + 150 - 18 * Math.sin(Math.PI * b / 2);
    const enter = ease.out(clamp((b + 0.6) / 1.0));
    return { x: lerp(CHAR_X - 330, fx, enter), y: 190 - 26 * Math.abs(Math.sin(Math.PI * b)), s: 0.72, sx: 1, rot: 0.08 * Math.cos(Math.PI * b * 2) - 0.1 * (1 - enter), wag: 0.45 * Math.sin(b * TAU * 2) };
  }
  if (b < GAG) {
    // 第 2 小节：在他头顶绕一圈
    const th = ((b - (GAG - 4)) / 4) * TAU;
    const sx = th < Math.PI ? lerp(1, -1, smoothstep(0.3 * Math.PI, 0.7 * Math.PI, th)) : lerp(-1, 1, smoothstep(1.3 * Math.PI, 1.7 * Math.PI, th));
    return { x: CHAR_X + 30 + 120 * Math.cos(th), y: 190 - 52 * Math.sin(th), s: 0.72 * (1 - 0.16 * Math.sin(th)), sx, rot: -0.1 * Math.sin(th), wag: 0.4 * Math.sin(b * TAU * 2) };
  }
  if (b < T_LAND) {
    // 俯冲下来降落，变大
    const t = (b - GAG) / (T_LAND - GAG), e = ease.inOut(t);
    return { x: lerp(CHAR_X + 150, LAND[0], e), y: lerp(190, LAND[1], e) - 90 * Math.sin(Math.PI * e), s: lerp(0.72, LAND_S, ease.in(t)), sx: 1, rot: 0.25 * Math.sin(Math.PI * t), wag: 0.3 * Math.sin(b * TAU * 2) };
  }
  if (b < T_LIFT) {
    const u = b - T_LAND;
    const sq = u < 0.35 ? 0.1 * Math.exp(-u * 9) * Math.cos(u * 30) : 0;
    const pre = smoothstep(T_LIFT - 0.25, T_LIFT, b);
    return { x: LAND[0], y: LAND[1] + 6 * pre, s: LAND_S, sx: 1, sy: 1 - sq - 0.06 * pre, rot: 0, wag: 0.5 * Math.sin(b * TAU * 2.5) };
  }
  if (b < T_UP) {
    const t = (b - T_LIFT) / (T_UP - T_LIFT), e = ease.inOut(t);
    return { x: LAND[0] + 60 * Math.sin(Math.PI * t * 0.5), y: lerp(LAND[1] + 6, 205, e), s: lerp(LAND_S, 0.95, t), sx: 1, rot: -0.14 * Math.sin(Math.PI * t), wag: 0.4 * Math.sin(b * TAU * 2) };
  }
  if (b < T_IN) {
    // 绕一个弯飞进银河中心
    const t = (b - T_UP) / (T_IN - T_UP), e = ease.inOut(t);
    const c1 = [1060, 120], x0 = LAND[0] + 60;
    const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * c1[0] + e * e * G[0];
    const y = (1 - e) * (1 - e) * 205 + 2 * (1 - e) * e * c1[1] + e * e * G[1];
    return { x, y, s: lerp(0.95, 0.62, e), sx: 1, rot: 0.25 * Math.sin(Math.PI * e), wag: 0.4 * Math.sin(b * TAU * 2) };
  }
  const m = clamp((b - T_IN) / (T_GONE - T_IN));
  return { x: G[0], y: G[1], s: 0.62, sx: 1, rot: 0.06 * Math.sin((b - T_IN) * 5), wag: 0.3 * Math.sin(b * TAU * 2) * (1 - m), melt: m };
}
// 融化：先把直升机画进一张离屏图，再按列往下拉长、滴下来
const HB = { w: 360, h: 300, cx: 190, cy: 150 };
function heliBuf() { return memo('s01-heli-buf', () => makeCanvas(HB.w * 2, HB.h * 2)); }
function drawMelting(ctx, H, b) {
  // 像冰淇淋一样化掉：整架直升机往下塌、变宽，底下挂出一条条糖果色的「奶油」往下滴，最后淡出变成星河
  const c = heliBuf(), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
  g.setTransform(2, 0, 0, 2, HB.cx * 2, HB.cy * 2);
  drawHeliLocal(g, b, { girl: true, boy: true, wag: H.wag });
  const m = H.melt, k = ease.inOut(m);
  const alpha = 1 - smoothstep(0.62, 1, m);
  if (alpha <= 0) return;
  const BOT = 74; // 起落架底（局部）
  ctx.save();
  ctx.translate(H.x, H.y); ctx.rotate(H.rot); ctx.scale(H.s, H.s);
  ctx.globalAlpha *= alpha;
  // 底下的一摊（化开的奶油）
  const pud = P((p) => {
    const w = 80 + 90 * k;
    p.moveTo(-w, BOT); for (let i = 0; i <= 12; i++) { const x = -w + (i / 12) * 2 * w; p.lineTo(x, BOT + 6 + 6 * Math.sin(i * 1.7 + b * 4) * k); } p.lineTo(w, BOT); p.closePath();
  });
  const drips = [];
  for (let i = 0; i < 9; i++) {
    const h = hash2(i, 5, 11), x = -78 + i * 19 + (h - 0.5) * 8, L = k * (24 + 110 * h) + 2;
    const y0 = BOT - 40 * (1 - 0.6 * k) - 10;
    const r = 6 + 5 * h;
    drips.push([P((p) => { if (p.roundRect) p.roundRect(x - r * 0.75, y0, r * 1.5, L + 10, r * 0.75); else p.rect(x - r * 0.75, y0, r * 1.5, L + 10); p.moveTo(x + r, y0 + L + 10); p.arc(x, y0 + L + 10, r, 0, TAU); }), [PINK, CREAM, PINK_L, BLUE, PINK_D, CREAM_D, LILAC][i % 7]]);
  }
  if (k > 0.05) sticker(ctx, [[pud, PINK_L]].concat(drips), { rim: 3, sh: [2, 3] });
  // 塌下来的机身：以底部为锚，变矮变宽，再加一点左右晃的波浪
  ctx.save();
  ctx.translate(0, BOT); ctx.scale(1 + 0.4 * k, 1 - 0.5 * k); ctx.translate(0, -BOT);
  const N = 24, cw = HB.w / N;
  for (let i = 0; i < N; i++) {
    const dx = i * cw - HB.cx;
    const wob = k * 8 * Math.sin(i * 0.7 + b * 6);
    ctx.drawImage(c, i * cw * 2, 0, cw * 2 + 1, c.height, dx, -HB.cy + wob, cw + 0.5, HB.h);
  }
  ctx.restore();
  // 奶油上的高光
  ctx.strokeStyle = rgba(WHITE, 0.85 * k); ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(-10, BOT - 30, 54 * (1 + 0.3 * k), Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
  ctx.restore();
}
function drawHeli(ctx, b) {
  if (b >= T_GONE) return;
  const H = heliAt(b);
  if (H.melt !== undefined && H.melt > 0) { drawMelting(ctx, H, b); return; }
  ctx.save();
  ctx.translate(H.x, H.y); ctx.rotate(H.rot); ctx.scale(H.s * H.sx, H.s * (H.sy || 1));
  drawHeliLocal(ctx, b, { girl: b >= T_HOP_G[1], boy: b >= T_HOP_B[1], wag: H.wag });
  ctx.restore();
}

// 小爱心：第 2 小节每半拍从直升机飘出一颗；乘客坐好时再冒几颗
const HEARTS = [];
for (let k = 0; k < 8; k++) HEARTS.push({ t: GAG - 4 + k * 0.5, dx: 0, col: [PINK_D, '#ff6f91', PINK, '#ff9ec7'][k % 4] });
for (let k = 0; k < 5; k++) HEARTS.push({ t: T_HOP_B[1] + k * 0.06, dx: (k - 2) * 26, col: [PINK_D, '#ff6f91', PINK][k % 3], big: true });
function drawHearts(ctx, b) {
  for (let i = 0; i < HEARTS.length; i++) {
    const h = HEARTS[i], a = b - h.t;
    if (a < 0 || a > 1.7) continue;
    const H = heliAt(h.t);
    const x = H.x + h.dx * (1 + a) + 18 * Math.sin(a * 5 + i), y = H.y - 40 * H.s - a * (h.big ? 150 : 95);
    const k = ease.outBack(clamp(a / 0.22)) * (1 - smoothstep(1.2, 1.7, a));
    if (k <= 0) continue;
    ctx.save(); ctx.translate(x, y); ctx.rotate(0.25 * Math.sin(a * 4 + i)); ctx.scale(k, k);
    sticker(ctx, [[heartP(h.big ? 16 : 12), h.col]], { rim: 3.5, sh: [2, 3] });
    ctx.restore();
  }
}
// 起飞时螺旋桨吹起的彩色纸屑 / 花瓣
function drawConfetti(ctx, b) {
  const a = b - T_LIFT;
  if (a < -0.1 || a > 1.4) return;
  for (let i = 0; i < 34; i++) {
    const t = a - hash2(i, 1, 21) * 0.3;
    if (t < 0 || t > 1.1) continue;
    const ang = Math.PI + hash2(i, 2, 21) * Math.PI, sp = 260 + hash2(i, 3, 21) * 420;
    const x = LAND[0] + Math.cos(ang) * sp * ease.out(clamp(t / 0.9)) + Math.sin(t * 6 + i) * 20;
    const y = 930 + Math.sin(ang) * sp * 0.55 * ease.out(clamp(t / 0.9)) + t * t * 160;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 9 + i); ctx.globalAlpha *= 1 - smoothstep(0.75, 1.1, t);
    ctx.fillStyle = CANDY[i % 6];
    if (i % 3) roundRect(ctx, -7, -4, 14, 8, 3); else ctx.beginPath(), ctx.ellipse(0, 0, 8, 5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- 云层（第 3 小节直升机穿过去） ----------
const BANK = [[500, 250, 1.1, 0, 0], [700, 228, 1.3, 1, 0], [930, 240, 1.2, 2, 0], [1150, 262, 1.05, 3, 0],
  [600, 292, 1.15, 1, 1], [800, 286, 1.35, 0, 1], [1030, 300, 1.15, 2, 1]];
function drawBank(ctx, b, front) {
  const inA = smoothstep(GAG + 1.35, GAG + 1.7, b), out = smoothstep(GAG + 2.0, GAG + 2.6, b);
  if (inA <= 0 || out >= 1) return;
  const N = nightAt(b);
  for (const [x, y, sc, v, f] of BANK) {
    if (!!f !== front) continue;
    const dir = x < 760 ? -1 : 1;
    const xx = x + dir * (1 - inA) * 500 + dir * out * 420, yy = y + out * 80;
    ctx.save(); ctx.globalAlpha *= inA * (1 - out);
    drawSt(ctx, cloudSprite(v, false), xx, yy, sc);
    if (N > 0.01) { ctx.globalAlpha *= N; drawSt(ctx, cloudSprite(v, true), xx, yy, sc); }
    ctx.restore();
  }
}

// ---------- 银河、星河、星座直升机 ----------
function galaxyImg() {
  return memo('s01-galaxy', () => {
    const S = 640, c = makeCanvas(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const core = g.createRadialGradient(0, 0, 0, 0, 0, 300);
    core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(0.08, 'rgba(255,236,250,0.95)'); core.addColorStop(0.25, 'rgba(255,170,220,0.55)');
    core.addColorStop(0.55, 'rgba(170,140,255,0.22)'); core.addColorStop(1, 'rgba(120,90,220,0)');
    g.fillStyle = core; g.fillRect(-S / 2, -S / 2, S, S);
    const R = rng('s01-gal');
    const cols = ['#ffffff', '#ffd1ec', '#c8f1ff', '#fff2b8', '#d9c7ff', '#b8ffe0'];
    for (let arm = 0; arm < 3; arm++) {
      for (let i = 0; i < 520; i++) {
        const u = R(), a = arm * (TAU / 3) + u * 4.2 + (R() - 0.5) * 0.5, r = 18 + u * 285 + (R() - 0.5) * 30;
        g.fillStyle = rgba(cols[(R() * 6) | 0], 0.5 + R() * 0.5);
        circle(g, Math.cos(a) * r, Math.sin(a) * r, 0.8 + R() * 2.6 * (1 - u * 0.5)); g.fill();
      }
    }
    return c;
  });
}
function drawGalaxy(ctx, b) {
  const a = smoothstep(GAG + 1.95, GAG + 2.5, b) * (1 - smoothstep(LEAVE, LEAVE + 0.8, b));
  if (a <= 0) return;
  ctx.save();
  ctx.translate(G[0], G[1]); ctx.rotate(-0.28); ctx.scale(1, 0.48); ctx.rotate(b * 0.55);
  const s = 0.75 + 0.25 * ease.out(clamp((b - GAG - 1.95) / 0.8));
  ctx.globalAlpha *= a;
  ctx.globalCompositeOperation = 'screen';
  ctx.drawImage(galaxyImg(), -300 * s, -300 * s, 600 * s, 600 * s);
  ctx.restore();
}
// 星河：由 RN 颗糖果色星星组成。先绕着银河旋转成漩涡，第 4 小节拉成横跨天空的一道星带。
const RN = 150;
const arcPt = (u) => {
  const P0 = [-430, 430], P1 = [480, -150], P2 = [1440, 300];
  const v = 1 - u;
  return [v * v * P0[0] + 2 * v * u * P1[0] + u * u * P2[0], v * v * P0[1] + 2 * v * u * P1[1] + u * u * P2[1]];
};
function riverPos(i, b) {
  const u = i / RN, off = (hash2(i, 1, 61) - 0.5);
  const born = T_RIVER + 0.75 * u;
  // 漩涡
  const grow = clamp((b - born) / 0.5);
  const spin = (b - T_RIVER) * 1.1;
  const ang = spin + u * TAU * 1.7 + off * 0.4, r = (20 + u * 330 + off * 40) * ease.out(grow);
  const sp = [G[0] + Math.cos(ang) * r * Math.cos(-0.28) - Math.sin(ang) * r * 0.48 * Math.sin(-0.28), G[1] + Math.cos(ang) * r * Math.sin(-0.28) + Math.sin(ang) * r * 0.48 * Math.cos(-0.28)];
  const m = ease.inOut(clamp((b - LEAVE) / 0.95));
  if (m <= 0) return { p: sp, vis: grow > 0, u };
  // 星带：沿弧线慢慢流动
  const uu = (u + 0.05 * Math.max(0, b - LEAVE) + 1) % 1;
  const ap = arcPt(uu), d = 1e-3, ap2 = arcPt(Math.min(1, uu + d));
  const nx = -(ap2[1] - ap[1]), ny = ap2[0] - ap[0], nl = Math.hypot(nx, ny) || 1;
  const q = [ap[0] + (nx / nl) * off * 70, ap[1] + (ny / nl) * off * 70];
  return { p: [lerp(sp[0], q[0], m), lerp(sp[1], q[1], m)], vis: true, u };
}
function glowDot(col) {
  return memo(`s01-glow|${col}`, () => {
    const c = makeCanvas(64, 64), g = c.getContext('2d');
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, rgba(col, 0.9)); r.addColorStop(0.3, rgba(col, 0.45)); r.addColorStop(1, rgba(col, 0));
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    return c;
  });
}
const RIVER_COLS = [PINK, '#ffb07a', CREAM_D, MINT, BLUE, LILAC];
function drawRiver(ctx, b) {
  if (b < T_RIVER) return;
  const N = nightAt(b);
  const pts = [];
  for (let i = 0; i < RN; i++) { const r = riverPos(i, b); if (r.vis) pts.push([r.p, i]); }
  // 白天：先铺一条半透明的白色光带，星星像贴纸一样贴在上面
  const day = 1 - N;
  if (b >= LEAVE && day > 0.01) {
    const m = ease.inOut(clamp((b - LEAVE) / 0.95));
    ctx.save(); ctx.globalAlpha *= 0.4 * m * day; ctx.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = RIVER_COLS[k]; ctx.lineWidth = 24;
      ctx.beginPath();
      for (let j = 0; j <= 12; j++) { const p = arcPt(k / 6 + (j / 12) / 6); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(WHITE, 0.9); ctx.lineWidth = 10; ctx.beginPath();
    for (let j = 0; j <= 40; j++) { const p = arcPt(j / 40); j ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
    ctx.stroke();
    ctx.restore();
  }
  if (N > 0.01) {
    ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= N;
    for (const [[x, y], i] of pts) ctx.drawImage(glowDot(RIVER_COLS[i % 6]), x - 22, y - 22, 44, 44);
    ctx.restore();
  }
  for (const [[x, y], i] of pts) {
    const r = 4 + 4 * hash2(i, 2, 61), tw = 0.8 + 0.2 * Math.sin(b * 6 + i);
    ctx.save(); ctx.translate(x, y); ctx.rotate(b * 1.5 + i);
    const col = RIVER_COLS[i % 6];
    if (i % 4 === 0) sticker(ctx, [[starP(r * 1.9 * tw), col]], { rim: 2, shadow: false });
    else { ctx.fillStyle = WHITE; circle(ctx, 0, 0, r * tw + 1.6); ctx.fill(); ctx.fillStyle = col; circle(ctx, 0, 0, r * tw); ctx.fill(); }
    ctx.restore();
  }
}
// 星座直升机：第 4 小节由星河里的星星聚成，螺旋桨星点在转，像小狗一样继续跟着他
const CONST_NODES = (() => {
  const n = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + 0.3; n.push([Math.cos(a) * 62, Math.sin(a) * 52]); } // 0–5 机身
  n.push([-108, -10], [-158, -20], [-168, -44]);                                                               // 6–8 尾巴
  n.push([-50, 74], [58, 74]);                                                                                  // 9–10 起落架
  n.push([0, -74]);                                                                                             // 11 桨毂
  return n;
})();
function constAt(b) {
  return { x: CHAR_X + lerp(270, 140, smoothstep(LEAVE + 2, LEAVE + 3.6, b)) - 16 * Math.sin(Math.PI * b / 2), y: 245 - 16 * Math.abs(Math.sin(Math.PI * b)), s: 0.88, wag: 0.4 * Math.sin(b * TAU * 2) };
}
function drawConstellation(ctx, b) {
  const t0 = LEAVE + 0.25, t1 = LEAVE + 1.0;
  if (b < t0) return;
  const C = constAt(b), form = ease.inOut(clamp((b - t0) / (t1 - t0)));
  const N = nightAt(b);
  const ra = b * TAU * 1.7;
  const local = CONST_NODES.slice();
  local.push([124 * Math.cos(ra), -74], [124 * Math.cos(ra + Math.PI), -74]); // 12–13 螺旋桨两端（在转）
  const wagP = ([x, y]) => { const a = C.wag, dx = x + 108, dy = y + 10; return [-108 + dx * Math.cos(a) - dy * Math.sin(a), -10 + dx * Math.sin(a) + dy * Math.cos(a)]; };
  const toScr = ([x, y]) => [C.x + x * C.s, C.y + y * C.s];
  const scr = local.map((q, i) => {
    const tgt = toScr(i === 7 || i === 8 ? wagP(q) : q);
    const src = riverPos((i * 37) % RN, b).p;
    return [lerp(src[0], tgt[0], form), lerp(src[1], tgt[1], form)];
  });
  // 连线：圆滚滚的机身（椭圆）、尾梁、起落架、桅杆和转动的螺旋桨；白色光晕 + 紫色细线
  const lines = (g) => {
    g.beginPath();
    g.ellipse(C.x, C.y, 62 * C.s, 52 * C.s, 0, 0, TAU);
    const tl = [[-60, -4], [-108, -10]].map((q) => toScr(q)), t2 = toScr(wagP([-158, -20])), t3 = toScr(wagP([-168, -44]));
    g.moveTo(...tl[0]); g.lineTo(...tl[1]); g.lineTo(...t2); g.lineTo(...t3);
    g.moveTo(...toScr([-50, 74])); g.lineTo(...toScr([58, 74]));
    g.moveTo(...toScr([-24, 46])); g.lineTo(...toScr([-30, 74])); g.moveTo(...toScr([24, 46])); g.lineTo(...toScr([30, 74]));
    g.moveTo(...toScr([0, -52])); g.lineTo(...toScr([0, -74]));
    g.moveTo(...scr[12]); g.lineTo(...scr[13]);
  };
  ctx.save();
  ctx.globalAlpha *= form;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.fillStyle = rgba(WHITE, 0.28); ctx.beginPath(); ctx.ellipse(C.x, C.y, 62 * C.s, 52 * C.s, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(WHITE, 0.75); ctx.lineWidth = 9; lines(ctx); ctx.stroke();
  ctx.strokeStyle = N > 0.5 ? rgba('#fff4c2', 0.95) : rgba('#9a62d6', 0.9); ctx.lineWidth = 3.4; ctx.setLineDash([3, 9]); lines(ctx); ctx.stroke(); ctx.setLineDash([]);
  // 螺旋桨转过的轨迹
  const hub = toScr([0, -74]);
  ctx.strokeStyle = rgba(WHITE, 0.9); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(hub[0], hub[1], 124 * C.s, 12 * C.s, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  for (let i = 0; i < scr.length; i++) {
    const [x, y] = scr[i];
    const big = i >= 11;
    ctx.save(); ctx.translate(x, y); ctx.rotate(b * 2 + i);
    if (N > 0.01) { ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha *= N; ctx.drawImage(glowDot(CREAM_D), -18, -18, 36, 36); ctx.restore(); }
    sticker(ctx, [[starP(big ? 13 : 10.5), i >= 12 ? BLUE_D : i === 11 ? CREAM_D : i >= 6 && i <= 8 ? PINK_D : i >= 9 ? LILAC_D : PINK]], { rim: 3, sh: [2, 3] });
    ctx.restore();
  }
  // 小脸：和白天那架玩具直升机一样
  if (form > 0.6) {
    ctx.save(); ctx.globalAlpha *= (form - 0.6) / 0.4;
    const e1 = toScr([38, 4]), e2 = toScr([52, 2]);
    ctx.fillStyle = '#7a4aa8'; ellipse(ctx, e1[0], e1[1], 3.5, 5); ctx.fill(); ellipse(ctx, e2[0], e2[1], 3.2, 4.6); ctx.fill();
    ctx.restore();
  }
}

// ---------- 第 4 小节：掉下来的星星、小树叶 ----------
function starFace(ctx, r, col, squash = 1) {
  ctx.save(); ctx.scale(1 / Math.sqrt(squash), squash);
  sticker(ctx, [[starP(r, 0.52), col]], { rim: 4, sh: [3, 4] });
  ctx.fillStyle = INK; ellipse(ctx, -r * 0.2, -r * 0.05, r * 0.07, r * 0.11); ctx.fill(); ellipse(ctx, r * 0.2, -r * 0.05, r * 0.07, r * 0.11); ctx.fill();
  ctx.fillStyle = rgba('#ff5f9a', 0.65); ellipse(ctx, -r * 0.34, r * 0.14, r * 0.1, r * 0.06); ctx.fill(); ellipse(ctx, r * 0.34, r * 0.14, r * 0.1, r * 0.06); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = r * 0.05; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.1, 0.2, Math.PI - 0.2); ctx.stroke();
  ctx.restore();
}
const STAR_LAND = 610, STAR_Y = 836, STAR_R = 30;
/** 掉下来的星星：在地面图层里画（世界坐标 → 画面 x 由镜头决定）。 */
function drawFallenStar(ctx, b, env) {
  if (b < T_DROP[0] || b > STATION.beats + 1) return;
  const cL = env.camAt(T_DROP[1]);
  if (b < T_DROP[1]) {
    const t = (b - T_DROP[0]) / (T_DROP[1] - T_DROP[0]), e = ease.in(t);
    const p0 = riverPos(RN - 1 - 12, T_DROP[0]).p;
    const x = lerp(p0[0], STAR_LAND + cL - env.cam, t), y = lerp(p0[1], STAR_Y - STAR_R, e);
    // 拖尾
    for (let j = 1; j <= 7; j++) {
      const tj = Math.max(0, t - j * 0.035), xj = lerp(p0[0], STAR_LAND + cL - env.cam, tj), yj = lerp(p0[1], STAR_Y - STAR_R, ease.in(tj));
      ctx.save(); ctx.translate(xj, yj); ctx.scale(1 - j / 9, 1 - j / 9); ctx.fillStyle = CANDY[j % 6]; ctx.fill(sparkleP(12)); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(t * 5); starFace(ctx, STAR_R, CREAM_D); ctx.restore();
    return;
  }
  const u = b - T_DROP[1];
  const hop = u < 0.3 ? 80 * Math.sin(Math.PI * u / 0.3) : u < 0.48 ? 20 * Math.sin(Math.PI * (u - 0.3) / 0.18) : 0;
  const sq = u < 0.08 ? 0.72 : (u >= 0.3 && u < 0.34) ? 0.85 : 1;
  const x = STAR_LAND + cL - env.cam;
  ctx.save();
  // 落地时的小闪光
  if (u < 0.5) {
    const k = 1 - u / 0.5;
    for (let i = 0; i < 6; i++) { const a = -Math.PI * (0.1 + 0.8 * i / 5); ctx.save(); ctx.translate(x + Math.cos(a) * (40 + 60 * (1 - k)), STAR_Y + Math.sin(a) * (30 + 40 * (1 - k))); ctx.scale(k, k); ctx.fillStyle = CANDY[i]; ctx.fill(sparkleP(12)); ctx.restore(); }
  }
  ctx.fillStyle = 'rgba(122,72,150,0.2)'; ellipse(ctx, x, STAR_Y + 2, 30 * (1 - hop / 200), 6); ctx.fill();
  ctx.translate(x, STAR_Y - STAR_R * sq - hop); ctx.rotate(0.2 * Math.sin(u * 3));
  starFace(ctx, STAR_R, CREAM_D, sq);
  ctx.restore();
}
function leafPath() {
  return P((p) => { p.moveTo(-1, 0); p.quadraticCurveTo(0.2, -0.62, 1, -0.05); p.quadraticCurveTo(0.2, 0.5, -1, 0); p.closePath(); });
}
function drawLeaf(ctx, L, rot) {
  ctx.save(); ctx.rotate(rot); ctx.scale(L / 2, L / 2);
  const lw = 2 / (L / 2);
  sticker(ctx, [[leafPath(), '#6fd39a']], { rim: 1.6 * lw, sh: [0.6 * lw, 0.9 * lw] });
  ctx.strokeStyle = '#2f9a68'; ctx.lineWidth = 1.6 * lw; ctx.lineJoin = 'round'; ctx.stroke(leafPath());
  ctx.strokeStyle = '#2f9a68'; ctx.lineWidth = 1.2 * lw; ctx.beginPath(); ctx.moveTo(-0.9, 0); ctx.quadraticCurveTo(0.1, -0.12, 0.85, -0.06); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-1, 0); ctx.lineTo(-1.25, 0.12); ctx.stroke();
  ctx.restore();
}

// ---------- 他的头顶（从站立帧、每一帧走路图里量出来） ----------
function headTrack() {
  const Wk = activeWalk();
  if (!Wk) return null;
  return memo(`s01-head|${Wk.name}`, () => {
    const m = Wk.meta, sc = FIGURE_H / m.personHeight;
    const measure = (im) => {
      if (!im) return [0, -500];
      const c = makeCanvas(m.width, m.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const hh = Math.round(m.height * 0.3), d = g.getImageData(0, 0, m.width, hh).data, w = m.width;
      let top = -1;
      for (let y = 0; y < hh && top < 0; y++) { let n = 0; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 128) n++; if (n >= 3) top = y; }
      if (top < 0) return [0, -500];
      const ry = Math.min(hh - 1, top + 20);
      let a = -1, e = -1;
      for (let x = 0; x < w; x++) if (d[(ry * w + x) * 4 + 3] > 128) { if (a < 0) a = x; e = x; }
      return [((a + e) / 2 - m.anchorX) * sc, (top - m.baseY) * sc];
    };
    return { walk: Wk.frames.map(measure), stand: measure(Wk.stand) };
  });
}

// ---------- 人物画风：糖果色 ----------
registerStyle('s01-candy', (I) => {
  const O = comicBase(I, { levels: 4, keep: 0.12, lw: 2.8, inner: 0.5, ink: '#34204d' });
  const dark = ['#2a1d46', '#46387a', '#7e6fc0', '#cfc5f2', '#fff7ef'].map(rgbf);
  const skin = ['#b8695e', '#ee9f88', '#ffc9b0', '#ffe8da'].map(rgbf);
  const pick = (C, l) => { const t = Math.min(0.9999, Math.max(0, l)) * (C.length - 1), k = Math.floor(t), f = t - k; return [0, 1, 2].map((j) => C[k][j] + (C[k + 1][j] - C[k][j]) * f); };
  for (let i = 0; i < O.w * O.h; i++) {
    if (O.a[i] < 0.01 || I.a[i] < 0.5) continue;
    const l = 0.299 * O.r[i] + 0.587 * O.g[i] + 0.114 * O.b[i];
    const isSkin = I.r[i] > 0.36 && I.r[i] > I.g[i] && I.g[i] > I.b[i] && I.r[i] - I.b[i] > 0.1;
    const c = isSkin ? pick(skin, Math.min(1, l * 1.15)) : pick(dark, Math.pow(l, 0.85));
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
  }
  return O;
});

// ---------- 背景总装 ----------
const NEAR_STEP = 470;
function nearExcluded(lx, cG) { return lx > 380 + cG && lx < 1010 + cG; }
function drawClouds(ctx, b, env, Z, N) {
  // 云（0.05）
  inLayer(ctx, 0.05, Z, (x0, x1) => {
    const drift = b * 4;
    slots(x0, x1, env.cam * 0.05 - drift, 520, 260, (k, x) => {
      if (hash2(k, 1, 31) < 0.3) return;
      const y = 120 + hash2(k, 2, 31) * 170, v = (k % 4 + 4) % 4, sc = 0.8 + hash2(k, 3, 31) * 0.5;
      ctx.save(); ctx.globalAlpha *= 1 - 0.55 * N;
      drawSt(ctx, cloudSprite(v, false), x + hash2(k, 4, 31) * 160, y, sc);
      ctx.restore();
    });
  });
}
function drawWorld(ctx, b, env, Z, N) {
  const cam = env.cam, cG = env.camAt(GAG);
  // 山丘（0.12）
  inLayer(ctx, 0.12, Z, (x0, x1) => {
    slots(x0, x1, cam * 0.12, 820, 520, (k, x) => drawDN(ctx, (n) => hillSprite(((k % 3) + 3) % 3, n), x, 735, N));
  });
  // 远处小房子（0.25）
  inLayer(ctx, 0.25, Z, (x0, x1) => {
    slots(x0, x1, cam * 0.25, 190, 120, (k, x) => {
      if (hash2(k, 1, 41) < 0.3) return;
      drawDN(ctx, (n) => farHouseSprite(((k % 5) + 5) % 5, n), x + (hash2(k, 2, 41) - 0.5) * 50, 762, N);
    });
  });
  // 糖果小店 + 橱窗店（0.4）
  inLayer(ctx, P_SHOP, Z, (x0, x1) => {
    const bxl = BX + cG * P_SHOP; // 橱窗店的层内 x
    slots(x0, x1, cam * P_SHOP, 370, 220, (k, x) => {
      const lx = k * 370;
      if (Math.abs(lx - bxl) < 370 + 160) return;
      const v = ((k * 7) % SHOP_N + SHOP_N) % SHOP_N;
      drawDN(ctx, (n) => shopSprite(v, n), x + (hash2(k, 1, 43) - 0.5) * 40, SHOP_BASE, N);
    });
    const bx = bxl - cam * P_SHOP;
    if (bx > x0 - 400 && bx < x1 + 400) drawBoutique(ctx, b, bx, N);
  });
  // 人行道和道具（1）
  inLayer(ctx, 1, Z, (x0, x1, y0, y1, zp) => {
    drawGround(ctx, x0, x1, y1, zp, cam, N);
    const wind = (lx) => smoothstep(T_LIFT - 0.1, T_LIFT + 0.3, b) * (1 - smoothstep(T_LIFT + 0.6, T_UP + 0.3, b)) * Math.exp(-Math.abs(lx - cam - LAND[0]) / 520) * 0.9;
    slots(x0, x1, cam, NEAR_STEP, 160, (k, x) => {
      const lx = k * NEAR_STEP + (hash2(k, 1, 47) - 0.5) * 120;
      if (nearExcluded(lx, cG) || hash2(k, 2, 47) < 0.18) return;
      const sx = lx - cam;
      const type = NEAR_TYPES[Math.floor(hash2(k, 3, 47) * NEAR_TYPES.length)];
      drawDN(ctx, (n) => nearSprite(type, n), sx, 792, N);
      if (type === 'planter' && zp > 0.4) tulips(ctx, sx, 792, b, wind(lx), N);
    });
    // 他脚下的影子（不算在人物里）
    ctx.fillStyle = 'rgba(122,72,150,0.2)'; ellipse(ctx, CHAR_X + 10, ROAD_Y + 4, 80, 12); ctx.fill();
    drawFallenStar(ctx, b, env);
  });
}
function drawBoutique(ctx, b, bx, N) {
  const y = SHOP_BASE;
  drawDN(ctx, (n) => boutiqueSprite(n), bx, y, N);
  // 楼上四个小窗：第 5–8 拍每拍弹出一个女孩
  PANES.forEach((px, i) => {
    const t = b - T_GIRLS[i];
    if (t < 0) return;
    const k = ease.outBack(clamp(t / 0.28));
    ctx.save();
    ctx.beginPath(); roundRectPath(ctx, bx + px - 41, y + PANE_Y[0], 82, PANE_Y[1] - PANE_Y[0], 40); ctx.clip();
    ctx.translate(bx + px, y + PANE_Y[1] + 4 + (1 - clamp(t / 0.2)) * 30);
    drawBust(ctx, i, 0.98 * k, b);
    ctx.restore();
    // 弹出时一圈小闪光
    if (t < 0.5) {
      const q = 1 - t / 0.5;
      for (let j = 0; j < 5; j++) {
        const a = -Math.PI / 2 + (j - 2) * 0.55;
        ctx.save(); ctx.translate(bx + px + Math.cos(a) * (50 + 30 * (1 - q)), y + PANE_Y[0] + 20 + Math.sin(a) * (40 + 30 * (1 - q))); ctx.scale(q, q);
        ctx.fillStyle = CANDY[(i + j) % 6]; ctx.fill(sparkleP(11)); ctx.restore();
      }
    }
    ctx.save(); ctx.strokeStyle = rgba(WHITE, 0.8); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(bx + px - 26, y + PANE_Y[0] + 70); ctx.lineTo(bx + px - 10, y + PANE_Y[0] + 30); ctx.stroke(); ctx.restore();
  });
  // 橱窗里的女孩剪影（第 3 小节跳进机舱）
  if (b < T_HOP_G[0]) {
    ctx.save(); ctx.translate(bx + DGIRL, y + DISP[3] - 20);
    silhouette(ctx, 'girl', 150);
    ctx.restore();
  }
  // 店门：第 3 小节打开，男孩剪影走出来
  const op = smoothstep(T_DOOR[0], T_DOOR[0] + 0.2, b) * (1 - smoothstep(T_DOOR[1], T_DOOR[1] + 0.2, b));
  if (op > 0) {
    const dx0 = bx + DOOR[0], dw = DOOR[1] - DOOR[0];
    ctx.fillStyle = '#c99be0'; roundRectPath(ctx, dx0, y + DOOR[2], dw, -DOOR[2], 34); ctx.fill();
    ctx.fillStyle = rgba(GLOW, 0.5); roundRectPath(ctx, dx0 + 8, y + DOOR[2] + 8, dw - 16, -DOOR[2] - 8, 28); ctx.fill();
    if (b < T_HOP_B[0]) {
      const a = smoothstep(T_DOOR[0] + 0.1, T_DOOR[0] + 0.3, b);
      ctx.save(); ctx.globalAlpha *= a; ctx.translate(bx + (DOOR[0] + DOOR[1]) / 2, y - 2);
      silhouette(ctx, 'boy', 155, { shadow: false });
      ctx.restore();
    }
    // 打开的门板
    ctx.fillStyle = MINT; ctx.strokeStyle = WHITE; ctx.lineWidth = 5;
    const w2 = dw * (1 - 0.82 * op);
    roundRectPath(ctx, dx0 - 4, y + DOOR[2] + 4, w2, -DOOR[2] - 4, 20); ctx.fill(); ctx.stroke();
  }
  // 橱窗玻璃反光
  ctx.save(); ctx.strokeStyle = rgba(WHITE, 0.75); ctx.lineCap = 'round';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(bx + DISP[0] + 30, y + DISP[3] - 20); ctx.lineTo(bx + DISP[0] + 90, y + DISP[2] + 14); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(bx + DISP[0] + 80, y + DISP[3] - 20); ctx.lineTo(bx + DISP[0] + 130, y + DISP[2] + 30); ctx.stroke();
  ctx.restore();
}
function roundRectPath(ctx, x, y, w, h, r) { roundRect(ctx, x, y, w, h, r); }

// 跳进机舱的两个剪影（画面坐标，第 3 小节）
function drawHoppers(ctx, b) {
  const bx = BX, y = SHOP_BASE;
  const hop = (T, from, H0, kind) => {
    if (b < T[0] || b >= T[1]) return;
    const t = (b - T[0]) / (T[1] - T[0]);
    // 落点：舱窗中央（跳进去时缩小、淡出，随后舱里出现坐着的胸像）
    const to = [LAND[0] + (kind === 'boy' ? 0 : -24) * LAND_S, LAND[1] + 8 * LAND_S];
    const x = lerp(from[0], to[0], t), yy = lerp(from[1], to[1], t) - 190 * Math.sin(Math.PI * t);
    ctx.save(); ctx.translate(x, yy); ctx.rotate((kind === 'boy' ? 0.5 : -0.4) * Math.sin(Math.PI * t));
    ctx.globalAlpha *= 1 - smoothstep(0.78, 1, t);
    silhouette(ctx, kind, H0 * lerp(1, 0.32, ease.in(t)));
    ctx.restore();
  };
  hop(T_HOP_G, [bx + DGIRL, y + DISP[3] - 20], 150, 'girl');
  hop(T_HOP_B, [bx + (DOOR[0] + DOOR[1]) / 2, y - 2], 155, 'boy');
}

// ---------- 场景 ----------
export const s01 = {
  id: 's01',
  station: ST,
  figureStyle: 's01-candy',
  // 白色贴纸描边（窄一点，让里面的深色轮廓线也贴着背景，轮廓反差更稳）
  figureRim: { color: WHITE, width: 4, alpha: 1 },
  freezeBeat: T_IN - 0.2, // Outro 展墙：直升机正飞进旋转的银河、深紫夜空里星星亮着
  figureAdjust(b) {
    const z = zoomAt(b);
    return z !== 1 ? { scale: z } : null;
  },
  drawFigure(ctx, fig, b) {
    drawWalker(ctx, fig);
    // 第 4 小节：一片小树叶落在他头顶（画面上大小几乎不变：拉远时他缩成蚂蚁，叶子就显得特别大）
    if (b < T_LEAF[0]) return;
    const Hd = headTrack();
    const head = !Hd ? [0, -500] : fig.pose === 'stand' ? Hd.stand : Hd.walk[frameIndex(fig.phase || 0)];
    const sc = fig.scale || 1;
    const L = lerp(52, 60, 1 - sc) / sc;
    const t = clamp((b - T_LEAF[0]) / (T_LEAF[1] - T_LEAF[0]));
    const e = ease.inOut(t);
    const hx = head[0] + 6, hy = head[1] + 4;
    const x = lerp(hx + 150, hx, e) + 40 * Math.sin(t * 7) * (1 - e), y = lerp(hy - 420, hy, e);
    const rot = t < 1 ? 0.9 * Math.sin(t * 9) : -0.35 + 0.08 * Math.sin(b * Math.PI * 2);
    ctx.save(); ctx.rotate(fig.lean || 0); ctx.translate(x, y - 4 / sc); drawLeaf(ctx, L, rot); ctx.restore();
  },
  drawBack(ctx, b, env) {
    const N = nightAt(b), Z = zoomAt(b);
    // 天空（在无穷远，不跟着拉远）
    ctx.drawImage(daySky(), X_MIN, 0, X_MAX - X_MIN, 1000);
    if (N > 0.002) {
      ctx.save(); ctx.globalAlpha = N; ctx.drawImage(nightSky(), X_MIN, 0, X_MAX - X_MIN, 1000);
      for (const [x, y, r, ph] of TWINK) {
        const k = 0.4 + 0.6 * Math.abs(Math.sin(b * 2.4 + ph * TAU));
        ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.fillStyle = '#fff8dc'; ctx.fill(sparkleP(r)); ctx.restore();
      }
      ctx.restore();
    }
    drawClouds(ctx, b, env, Z, N);
    drawGalaxy(ctx, b);
    drawRiver(ctx, b);
    drawWorld(ctx, b, env, Z, N);
    drawConstellation(ctx, b);
    if (b < T_GONE) {
      drawBank(ctx, b, false);
      drawHearts(ctx, b);
      drawHeli(ctx, b);
      drawHoppers(ctx, b);
      drawBank(ctx, b, true);
    }
  },
  drawFront(ctx, b) {
    drawConfetti(ctx, b);
  },
  drawFrame(ctx, R) {
    // 下一道画框：一张糖果色贴纸框——粉色圆点宽边、白色贴纸描边、紫色投影，角上贴着爱心和星星
    const t = 64 * R.s, s = R.s, { x, y, w, h } = R;
    const r = 28 * s;
    ctx.save();
    const ring = (ox, oy, pad, rr) => {
      const q = new Path2D();
      if (q.roundRect) q.roundRect(x - t - pad + ox, y - t - pad + oy, w + 2 * t + 2 * pad, h + 2 * t + 2 * pad, rr); else q.rect(x - t - pad + ox, y - t - pad + oy, w + 2 * t + 2 * pad, h + 2 * t + 2 * pad);
      q.rect(x, y, w, h);
      return q;
    };
    ctx.fillStyle = 'rgba(122,72,150,0.28)'; ctx.fill(ring(10 * s, 14 * s, 0, r), 'evenodd');
    ctx.fillStyle = WHITE; ctx.fill(ring(0, 0, 9 * s, r + 9 * s), 'evenodd');
    const band = new Path2D();
    if (band.roundRect) band.roundRect(x - t, y - t, w + 2 * t, h + 2 * t, r); else band.rect(x - t, y - t, w + 2 * t, h + 2 * t);
    band.rect(x, y, w, h);
    ctx.fillStyle = PINK; ctx.fill(band, 'evenodd');
    ctx.save(); ctx.clip(band, 'evenodd');
    ctx.fillStyle = rgba(WHITE, 0.85);
    const gap = 30 * s, dr = Math.max(1, 6.5 * s);
    ctx.beginPath();
    for (let yy = y - t + gap / 2, j = 0; yy < y + h + t; yy += gap, j++) {
      for (let xx = x - t + (j % 2 ? gap : gap / 2); xx < x + w + t; xx += gap) {
        if (xx > x + 4 && xx < x + w - 4 && yy > y + 4 && yy < y + h - 4) continue;
        ctx.moveTo(xx + dr, yy); ctx.arc(xx, yy, dr, 0, TAU);
      }
    }
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = WHITE; ctx.lineWidth = Math.max(1.5, 7 * s); ctx.strokeRect(x - 3 * s, y - 3 * s, w + 6 * s, h + 6 * s);
    ctx.strokeStyle = PINK_D; ctx.lineWidth = Math.max(1, 3 * s); ctx.strokeRect(x - 7 * s, y - 7 * s, w + 14 * s, h + 14 * s);
    // 角上的贴纸
    ctx.save(); ctx.translate(x - t * 0.35, y - t * 0.35); ctx.rotate(-0.25); ctx.scale(s * 1.9, s * 1.9);
    sticker(ctx, [[heartP(16), PINK_D]], { rim: 3, sh: [2, 3] }); ctx.restore();
    ctx.save(); ctx.translate(x + w + t * 0.35, y + h + t * 0.3); ctx.rotate(0.2); ctx.scale(s * 1.9, s * 1.9);
    sticker(ctx, [[starP(17), CREAM_D]], { rim: 3, sh: [2, 3] }); ctx.restore();
    ctx.save(); ctx.translate(x + w + t * 0.4, y - t * 0.35); ctx.scale(s * 1.6, s * 1.6);
    sticker(ctx, [[ellP(0, 0, 13, 13), BLUE]], { rim: 3, sh: [2, 3] }); ctx.restore();
    ctx.restore();
  },
  cardStyle: {
    ink: '#5a2f6b', accent: PINK_D, bar: false, family: SANS, enFamily: SANS,
    bgDraw(ctx, x, y, w, h) {
      // 糖果贴纸卡：紫色投影、白色贴纸边、奶油底 + 淡粉圆点，角上一颗爱心贴纸
      ctx.save();
      ctx.fillStyle = 'rgba(122,72,150,0.28)'; roundRect(ctx, x + 8, y + 11, w, h, 30); ctx.fill();
      ctx.fillStyle = WHITE; roundRect(ctx, x - 8, y - 8, w + 16, h + 16, 34); ctx.fill();
      ctx.fillStyle = '#fff6dc'; roundRect(ctx, x, y, w, h, 26); ctx.fill();
      ctx.save(); roundRect(ctx, x, y, w, h, 26); ctx.clip();
      ctx.fillStyle = rgba(PINK, 0.22);
      for (let j = 0, yy = y + 14; yy < y + h; yy += 28, j++) for (let xx = x + (j % 2 ? 26 : 12); xx < x + w; xx += 28) { circle(ctx, xx, yy, 4.5); ctx.fill(); }
      ctx.fillStyle = BLUE_L; ctx.fillRect(x, y + h - 16, w, 16);
      ctx.fillStyle = PINK_L; ctx.fillRect(x, y + h - 16, w, 6);
      ctx.restore();
      ctx.strokeStyle = PINK; ctx.lineWidth = 3; roundRect(ctx, x + 7, y + 7, w - 14, h - 14, 20); ctx.stroke();
      ctx.save(); ctx.translate(x + w - 6, y + 4); ctx.rotate(0.3); ctx.scale(1.5, 1.5);
      sticker(ctx, [[heartP(14), PINK_D]], { rim: 3, sh: [2, 3] }); ctx.restore();
      ctx.save(); ctx.translate(x + w - 34, y + 14); ctx.rotate(-0.2);
      sticker(ctx, [[starP(10), CREAM_D]], { rim: 2.5, sh: [1.5, 2] }); ctx.restore();
      ctx.restore();
    },
  },
  playerStyle: {
    plate: '#ffe3f0', ink: '#5a2f6b', noteColor: PINK_D, backdrop: false, family: SANS,
    plateDraw(ctx, x, y, w, h) {
      ctx.save();
      ctx.fillStyle = 'rgba(122,72,150,0.28)'; roundRect(ctx, x + 6, y + 9, w, h, h / 2); ctx.fill();
      ctx.fillStyle = WHITE; roundRect(ctx, x - 7, y - 7, w + 14, h + 14, h / 2 + 7); ctx.fill();
      ctx.fillStyle = '#ffe3f0'; roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
      ctx.strokeStyle = PINK; ctx.lineWidth = 3; roundRect(ctx, x + 6, y + 6, w - 12, h - 12, h / 2 - 6); ctx.stroke();
      ctx.restore();
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) {
      // 糖果色磁带：天蓝外壳 + 白色贴纸边，奶黄标签纸上贴小爱心，粉色磁带卷在转
      const w = 200 * s, h = 128 * s;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.05);
      ctx.fillStyle = 'rgba(122,72,150,0.28)'; roundRect(ctx, -w / 2 + 7, -h / 2 + 10, w, h, 16 * s); ctx.fill();
      ctx.fillStyle = WHITE; roundRect(ctx, -w / 2 - 7, -h / 2 - 7, w + 14, h + 14, 20 * s); ctx.fill();
      ctx.fillStyle = BLUE; roundRect(ctx, -w / 2, -h / 2, w, h, 14 * s); ctx.fill();
      ctx.fillStyle = CREAM_L; roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 11 * s, w - 28 * s, 68 * s, 8 * s); ctx.fill();
      ctx.fillStyle = PINK; ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 20 * s, w - 28 * s, 7 * s);
      for (const hx of [-66, 66]) { ctx.save(); ctx.translate(hx * s, -h / 2 + 52 * s); ctx.fillStyle = PINK_D; ctx.fill(heartP(7 * s)); ctx.restore(); }
      ctx.fillStyle = '#6a4a86'; roundRect(ctx, -50 * s, -h / 2 + 35 * s, 100 * s, 34 * s, 17 * s); ctx.fill();
      for (const sx of [-1, 1]) {
        const rx = sx * 31 * s, ry = -h / 2 + 52 * s;
        ctx.fillStyle = PINK; circle(ctx, rx, ry, (sx < 0 ? 16 : 12) * s); ctx.fill();
        ctx.fillStyle = WHITE; circle(ctx, rx, ry, 9 * s); ctx.fill();
        ctx.save(); ctx.translate(rx, ry); ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
        ctx.fillStyle = PINK_D; for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); roundRect(ctx, -1.6 * s, -8 * s, 3.2 * s, 5 * s, 1.5 * s); ctx.fill(); }
        ctx.restore();
      }
      ctx.fillStyle = BLUE_D; ctx.beginPath(); ctx.moveTo(-58 * s, h / 2); ctx.lineTo(-46 * s, h / 2 - 28 * s); ctx.lineTo(46 * s, h / 2 - 28 * s); ctx.lineTo(58 * s, h / 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = CREAM_L; for (const sx of [-1, 1]) { circle(ctx, sx * 28 * s, h / 2 - 13 * s, 5 * s); ctx.fill(); }
      ctx.fillStyle = WHITE; for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(ctx, sx * (w / 2 - 9 * s), sy * (h / 2 - 9 * s), 3 * s); ctx.fill(); }
      ctx.restore();
    },
  },
};
