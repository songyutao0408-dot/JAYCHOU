// 第 7 站 · 依然范特西（Still Fantasy, 2006）·「夜的第七章」· 维多利亚街头的浅灰薄雾，侦探 · 铜版画
// 19 世纪铜版插图：米黄纸、棕褐油墨，细密的交叉排线和刻刀线条；雾用纸色留白和渐淡的排线表现，不压暗画面；煤气灯有暖黄光晕。
// 构图：横向排线的夜空 + 雾里的月亮 → 远处的街屋、烟囱、钟楼（越低越被雾吃掉）→ 中景连排街屋（凸窗、台阶、铸铁栏杆）
//       → 人行道、路缘石、鹅卵石路（灯下有积水倒影）；煤气灯立在人行道后沿；左侧前景是原创侦探（猎鹿帽、披肩斗篷、单片眼镜、海象胡）。
// 梗：第 5–8 拍侦探从左边悄悄跟上来，手托下巴若有所思；第 9 拍强拍他在一盏煤气灯下定格，灯一亮，
//     一只巨大的放大镜从画外（下方）甩上来；第 10–12 拍镜片对准他耳朵上的入耳式耳机，镜片里把人物局部放大约 2.2 倍、用更细的排线重画；
//     第 13 拍放大镜收回，侦探点点头；第 13–16 拍他走向下一道画框（雕版书页边框）。
import { X_MIN, X_MAX, ROAD_Y, K } from '../main/layout.js';
import { strip, drawStrip, stripRange } from '../kit/strip.js';
import { paperTexture } from '../kit/paper.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { circle, ellipse } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, pulse, TAU } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { ANCHORS, FIGURE_H, activeWalk, frameIndex } from '../rig/walker.js';
import { registerStyle, styledFrame, smoothColor, sobel, lumaArray, outline, rgbf, clone } from '../rig/styles.js';

const ST = stationByN(7);
// 调色板：纸、油墨（深 / 中 / 淡 / 远）、雾、煤气灯
const PAPER = '#efe3c4', PAPER_HI = '#f7efdc', INK = '#5a3a22', INK_M = '#7a5a3c', INK_L = '#9a7a58', INK_F = '#b59d79';
const FOG = '#f4ecd9', GAS = '#f4c65a', GLOW = '#f8dc8c', LIT = '#f3d68c';
const FACADE = mix(PAPER, '#d9c49a', 0.45), ROOF = mix(PAPER, '#b89c74', 0.5);
const P_SKY = 0.05, P_FAR = 0.25, P_MIST_A = 0.4, P_MID = 0.6, P_MIST_B = 0.8;
const BASE = 778;           // 中景街屋的墙根
const LAMP_Y = ROAD_Y - 3;  // 煤气灯立在人行道后沿（人物脚下基线稍后）
const LAMP_GAG_X = 470;     // 定格时那盏灯在画面上的位置（人物 x ≈ 322 的右后方）
const LAMP_GAP = 820;

// ---------- 刻线：按形状的实际外接框排线（etch.hatch 会扫过整个对角线方块，长条形状上很浪费） ----------
/**
 * 在 path 里画一组平行刻线。width(x, y) → 线宽（≤ 0.05 时断开），线宽按 1/8 分档、同档合并成一条路径再描。
 * bounds = [x, y, w, h]：形状的外接框（必须给）。
 */
function engrave(ctx, path, { bounds, angle = 0, gap = 6, color = INK, width = () => 1, wobble = 0.8, step = 8, seed = 1, alpha = 1 }) {
  const [bx, by, bw, bh] = bounds;
  const c = Math.cos(angle), s = Math.sin(angle);
  let t0 = Infinity, t1 = -Infinity, d0 = Infinity, d1 = -Infinity;
  for (const [x, y] of [[bx, by], [bx + bw, by], [bx, by + bh], [bx + bw, by + bh]]) {
    const t = x * c + y * s, d = -x * s + y * c;
    t0 = Math.min(t0, t); t1 = Math.max(t1, t); d0 = Math.min(d0, d); d1 = Math.max(d1, d);
  }
  ctx.save();
  if (path) ctx.clip(path);
  ctx.strokeStyle = color;
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const dStart = Math.floor(d0 / gap) * gap;
  for (let d = dStart; d <= d1 + gap; d += gap) {
    let prev = null, curW = -1, open = false;
    for (let t = t0 - step; t <= t1 + step; t += step) {
      const dd = d + (noise2(t * 0.01, d * 0.05, seed) - 0.5) * 2 * wobble;
      const x = c * t - s * dd, y = s * t + c * dd;
      if (prev) {
        let w = width((x + prev[0]) / 2, (y + prev[1]) / 2);
        w = Math.round(w * 8) / 8;
        if (w <= 0.05) {
          if (open) { ctx.stroke(); open = false; }
          curW = -1;
        } else {
          if (w !== curW) {
            if (open) ctx.stroke();
            ctx.beginPath(); ctx.lineWidth = w; curW = w; ctx.moveTo(prev[0], prev[1]); open = true;
          }
          ctx.lineTo(x, y);
        }
      }
      prev = [x, y];
    }
    if (open) ctx.stroke();
  }
  ctx.restore();
}
const rectPath = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };
function line(ctx, x0, y0, x1, y1, w = 1, color = INK) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
}
// 动态元素（侦探、放大镜手柄）用的排线贴图：平铺的 45° 线 / 交叉线 / 格纹
function tile(kind, color = INK, lw = 1.1, gap = 4, size = 32) {
  return memo(`s07-tile|${kind}|${color}|${lw}|${gap}|${size}`, () => {
    const c = makeCanvas(size, size);
    const g = c.getContext('2d');
    g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'square';
    const diag = (sgn) => { for (let k = -size; k <= 2 * size; k += gap) { g.beginPath(); g.moveTo(k, sgn > 0 ? 0 : size); g.lineTo(k + size, sgn > 0 ? size : 0); g.stroke(); } };
    if (kind === 'diag' || kind === 'cross') diag(1);
    if (kind === 'cross') diag(-1);
    if (kind === 'check') {
      for (let k = 0; k < size; k += gap) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, size); g.stroke(); g.beginPath(); g.moveTo(0, k + 0.5); g.lineTo(size, k + 0.5); g.stroke(); }
      g.lineWidth = lw * 2.2; for (let k = 0; k < size; k += gap * 4) { g.beginPath(); g.moveTo(k + 1, 0); g.lineTo(k + 1, size); g.stroke(); g.beginPath(); g.moveTo(0, k + 1); g.lineTo(size, k + 1); g.stroke(); }
    }
    if (kind === 'vert') for (let k = 0; k < size; k += gap) { g.beginPath(); g.moveTo(k + 0.5, 0); g.lineTo(k + 0.5, size); g.stroke(); }
    return c;
  });
}
/** 填一个底色，再叠一层排线贴图。 */
function fillEngraved(ctx, path, base, kind, o = {}) {
  ctx.fillStyle = base; ctx.fill(path);
  ctx.fillStyle = ctx.createPattern(tile(kind, o.color || INK, o.lw || 1.1, o.gap || 4), 'repeat');
  ctx.fill(path);
}

// ---------- 纸 + 夜空（横向排线，向下渐淡成雾；月亮留白） ----------
const MOON = [1010, 150, 50];
function skyLayer() {
  return strip('s07-sky', P_SKY, (ctx, x0, x1) => {
    const H = 470;
    engrave(ctx, rectPath(x0, 0, x1 - x0, H), {
      bounds: [x0, 0, x1 - x0, H], angle: 0, gap: 5.2, color: INK_L, wobble: 0.6, step: 7, seed: 11,
      width: (x, y) => {
        const fade = 1 - smoothstep(30, 400, y);
        const d = Math.hypot(x - MOON[0], y - MOON[1]);
        const halo = smoothstep(MOON[2] + 8, MOON[2] + 120, d);
        return 1.35 * fade * halo * (0.65 + 0.7 * noise2(x * 0.004, y * 0.03, 3));
      },
    });
    // 月亮：留白的圆，细线勾边，右侧几道弧线排线（雾里只看得见一半）
    const [mx, my, mr] = MOON;
    ctx.strokeStyle = INK_L; ctx.lineWidth = 1.2;
    circle(ctx, mx, my, mr); ctx.stroke();
    const moon = new Path2D(); moon.arc(mx, my, mr, 0, TAU);
    engrave(ctx, moon, { bounds: [mx - mr, my - mr, 2 * mr, 2 * mr], angle: 1.2, gap: 3.6, color: INK_F, wobble: 0.4, step: 4, seed: 5,
      width: (x, y) => 0.9 * smoothstep(mx + mr * 0.05, mx + mr * 0.9, x + (y - my) * 0.3) });
    for (const [cx, cy, r] of [[mx - 14, my - 10, 8], [mx + 8, my + 16, 6], [mx - 20, my + 22, 4]]) { ctx.lineWidth = 0.8; circle(ctx, cx, cy, r); ctx.stroke(); }
  }, { y0: 0, y1: 480 });
}

// ---------- 远景：街屋、烟囱、钟楼、教堂尖顶（越往下越被雾吃掉） ----------
function chimneys(p, x, w, top, R, scale = 1) {
  const n = 1 + Math.floor(R() * 2.4);
  const pots = [];
  for (let i = 0; i < n; i++) {
    const cw = (16 + R() * 18) * scale, chh = (24 + R() * 36) * scale;
    const cx = x + 10 + R() * Math.max(10, w - 20 - cw);
    p.rect(cx, top - chh, cw, chh + 2);
    p.rect(cx - 3 * scale, top - chh - 5 * scale, cw + 6 * scale, 5 * scale);
    const k = 1 + Math.floor(R() * 3);
    for (let j = 0; j < k; j++) { const px = cx + (j + 0.5) * (cw / k) - 2.5 * scale; p.rect(px, top - chh - 13 * scale, 5 * scale, 9 * scale); pots.push(px); }
  }
  return pots;
}
function farLayer() {
  return strip('s07-far', P_FAR, (ctx, x0, x1) => {
    const R = rng('s07-far');
    const fill = mix(PAPER, '#cbb189', 0.32);
    const items = [];
    let x = x0 - 60;
    while (x < x1 + 60) {
      const r = R();
      const p = new Path2D();
      if (r < 0.06) {
        // 钟楼：塔身、钟层、尖顶（钟面只有刻度，没有数字）
        const w = 60;
        p.rect(x, 250, w, 560);
        p.rect(x - 9, 192, w + 18, 64);
        p.moveTo(x - 12, 194); p.lineTo(x + w / 2, 96); p.lineTo(x + w + 12, 194); p.closePath();
        p.rect(x + w / 2 - 1.5, 76, 3, 22);
        items.push({ p, b: [x - 12, 76, w + 24, 730], clock: [x + w / 2, 224, 20] });
        x += w + 40 + R() * 60;
      } else if (r < 0.11) {
        // 教堂：中殿 + 塔 + 尖顶
        const w = 170, tw = 46, tx = x + 20;
        p.rect(x, 440, w, 370);
        p.moveTo(x - 6, 442); p.lineTo(x + w / 2 + 20, 380); p.lineTo(x + w + 6, 442); p.closePath();
        p.rect(tx, 300, tw, 500);
        p.moveTo(tx - 4, 302); p.lineTo(tx + tw / 2, 132); p.lineTo(tx + tw + 4, 302); p.closePath();
        items.push({ p, b: [x - 6, 132, w + 12, 680], arch: [tx + tw / 2, 330] });
        x += w + 20 + R() * 40;
      } else {
        const w = 90 + R() * 150, top = 370 + R() * 120;
        p.rect(x, top, w, 810 - top);
        const roof = R();
        let peak = top;
        if (roof < 0.35) { p.moveTo(x - 4, top + 1); p.lineTo(x + w / 2, top - 46); p.lineTo(x + w + 4, top + 1); p.closePath(); peak = top - 46; }
        else if (roof < 0.6) { p.moveTo(x + 2, top + 1); p.lineTo(x + 14, top - 30); p.lineTo(x + w - 14, top - 30); p.lineTo(x + w - 2, top + 1); p.closePath(); peak = top - 30; }
        chimneys(p, x, w, peak + (roof < 0.35 ? 18 : 0), R, 0.9);
        items.push({ p, b: [x - 6, peak - 90, w + 12, 900 - peak], win: R() < 0.75 ? [x, top, w] : null, seed: Math.floor(R() * 1000) });
        x += w + (R() < 0.25 ? 14 + R() * 50 : 0);
      }
    }
    items.forEach((it, i) => {
      ctx.fillStyle = fill; ctx.fill(it.p);
      engrave(ctx, it.p, { bounds: it.b, angle: Math.PI / 2, gap: 4.4, color: INK_F, wobble: 0.5, step: 10, seed: 20 + i,
        width: (xx, yy) => 1.1 * (1 - smoothstep(470, 770, yy)) });
      ctx.strokeStyle = INK_F; ctx.lineWidth = 1.1; ctx.stroke(it.p);
      if (it.clock) {
        const [cx, cy, cr] = it.clock;
        ctx.fillStyle = PAPER_HI; circle(ctx, cx, cy, cr); ctx.fill(); ctx.stroke();
        for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; line(ctx, cx + Math.cos(a) * cr * 0.72, cy + Math.sin(a) * cr * 0.72, cx + Math.cos(a) * cr * 0.92, cy + Math.sin(a) * cr * 0.92, 1, INK_F); }
        line(ctx, cx, cy, cx + 3, cy - cr * 0.6, 1.4, INK_F); line(ctx, cx, cy, cx + cr * 0.45, cy + 3, 1.4, INK_F);
      }
      if (it.arch) { ctx.fillStyle = LIT; const [ax, ay] = it.arch; ctx.fillRect(ax - 6, ay, 12, 22); ctx.strokeRect(ax - 6, ay, 12, 22); }
      if (it.win) {
        const [wx, top, w] = it.win;
        const W2 = rng('s07-farwin', it.seed);
        for (let yy = top + 22; yy < 640; yy += 42) for (let xx = wx + 14; xx < wx + w - 16; xx += 26) {
          if (W2() < 0.22) { ctx.fillStyle = LIT; ctx.fillRect(xx, yy, 8, 13); }
          else if (W2() < 0.6) { ctx.strokeStyle = INK_F; ctx.lineWidth = 0.8; ctx.strokeRect(xx, yy, 8, 13); }
        }
      }
    });
    // 雾：只盖在已经画了东西的地方，越往下越浓，房脚整个化进纸色
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 300, 0, 760);
    g.addColorStop(0, rgba(FOG, 0.05)); g.addColorStop(0.55, rgba(FOG, 0.3)); g.addColorStop(1, rgba(FOG, 0.92));
    ctx.fillStyle = g; ctx.fillRect(x0, 60, x1 - x0, 760);
    ctx.globalCompositeOperation = 'source-over';
  }, { y0: 60, y1: 810 });
}

// ---------- 中景：连排街屋（凸窗、台阶、铸铁栏杆） ----------
function sash(ctx, cx, wy, ww, wh, lit, seed, hood) {
  const x = cx - ww / 2;
  // 窗套（浅色石框）
  ctx.fillStyle = PAPER_HI; ctx.fillRect(x - 6, wy - 6, ww + 12, wh + 12);
  ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x - 6, wy - 6, ww + 12, wh + 12);
  const glass = rectPath(x, wy, ww, wh);
  if (lit) {
    ctx.fillStyle = LIT; ctx.fill(glass);
    engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: Math.PI / 2, gap: 3.6, color: '#c79a52', width: () => 0.6, wobble: 0.2, step: 6, seed });
  } else {
    ctx.fillStyle = mix(PAPER, INK, 0.18); ctx.fill(glass);
    engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: 0.75, gap: 3.2, color: INK, width: () => 0.85, wobble: 0.3, step: 5, seed });
    engrave(ctx, glass, { bounds: [x, wy, ww, wh], angle: -0.75, gap: 3.8, color: INK, width: (xx, yy) => 0.7 * smoothstep(wy + wh * 0.2, wy + wh, yy + (xx - x) * 0.4), wobble: 0.3, step: 5, seed: seed + 1 });
  }
  // 窗框、窗芯（上下推拉窗：中间横档 + 各一根竖芯）
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(x, wy, ww, wh);
  line(ctx, x, wy + wh / 2, x + ww, wy + wh / 2, 1.6);
  line(ctx, cx, wy, cx, wy + wh, 0.9);
  // 窗洞里的阴影：上沿、左沿一道粗线
  line(ctx, x + 1, wy + 2, x + ww - 1, wy + 2, 2.4, rgba(INK, 0.7));
  line(ctx, x + 2, wy + 1, x + 2, wy + wh - 1, 2, rgba(INK, 0.5));
  // 窗台
  ctx.fillStyle = PAPER_HI; ctx.fillRect(x - 9, wy + wh + 6, ww + 18, 6); ctx.strokeRect(x - 9, wy + wh + 6, ww + 18, 6);
  line(ctx, x - 7, wy + wh + 14, x + ww + 7, wy + wh + 14, 0.8, INK_L);
  // 窗楣：三角山花或拱形
  if (hood === 'ped') {
    const p = new Path2D(); p.moveTo(x - 12, wy - 8); p.lineTo(cx, wy - 28); p.lineTo(x + ww + 12, wy - 8); p.closePath();
    ctx.fillStyle = PAPER_HI; ctx.fill(p); ctx.lineWidth = 1.1; ctx.stroke(p);
    engrave(ctx, p, { bounds: [x - 12, wy - 28, ww + 24, 20], angle: 0, gap: 3, color: INK, width: (xx, yy) => (yy > wy - 12 ? 0.7 : 0), wobble: 0.2, step: 5, seed });
  } else {
    ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, wy - 4, ww / 2 + 8, Math.PI, 0); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, wy - 4, ww / 2 + 3, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = PAPER_HI; ctx.fillRect(cx - 4, wy - ww / 2 - 13, 8, 10); ctx.strokeRect(cx - 4, wy - ww / 2 - 13, 8, 10); // 拱心石
  }
}
function railings(ctx, xa, xb) {
  const top = BASE - 46;
  line(ctx, xa, top, xb, top, 2);
  line(ctx, xa, top + 6, xb, top + 6, 1);
  line(ctx, xa, BASE - 8, xb, BASE - 8, 1.6);
  for (let x = xa + 4; x < xb - 2; x += 10) {
    line(ctx, x, top - 4, x, BASE, 1.3);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.moveTo(x - 2.6, top - 4); ctx.lineTo(x, top - 11); ctx.lineTo(x + 2.6, top - 4); ctx.closePath(); ctx.fill();
  }
}
function townhouse(ctx, x, w, top, R, seed) {
  const H = BASE - top;
  const facade = rectPath(x, top, w, H);
  ctx.fillStyle = FACADE; ctx.fill(facade);
  // 砖缝：细横线
  engrave(ctx, facade, { bounds: [x, top, w, H], angle: 0, gap: 7.5, color: INK_L, width: () => 0.5, wobble: 0.3, step: 12, seed });
  // 右侧壁柱的阴影：斜向排线
  const pil = rectPath(x + w - 18, top, 18, H);
  ctx.fillStyle = mix(FACADE, INK, 0.12); ctx.fill(pil);
  engrave(ctx, pil, { bounds: [x + w - 18, top, 18, H], angle: 1.05, gap: 3.2, color: INK, width: () => 0.8, wobble: 0.3, step: 6, seed: seed + 2 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke(facade); ctx.stroke(pil);
  // 屋顶：复折式石板瓦 + 老虎窗 + 烟囱
  const roof = new Path2D();
  roof.moveTo(x + 2, top - 14); roof.lineTo(x + 24, top - 86); roof.lineTo(x + w - 24, top - 86); roof.lineTo(x + w - 2, top - 14); roof.closePath();
  ctx.fillStyle = ROOF; ctx.fill(roof);
  engrave(ctx, roof, { bounds: [x, top - 90, w, 80], angle: 0, gap: 9, color: INK, width: () => 0.9, wobble: 0.3, step: 8, seed: seed + 3 });
  engrave(ctx, roof, { bounds: [x, top - 90, w, 80], angle: 1.3, gap: 3.6, color: INK, width: () => 0.6, wobble: 0.3, step: 6, seed: seed + 4 });
  ctx.lineWidth = 1.3; ctx.stroke(roof);
  const stack = new Path2D();
  chimneys(stack, x + w * 0.1, w * 0.8, top - 84, R, 1.15);
  ctx.fillStyle = FACADE; ctx.fill(stack);
  engrave(ctx, stack, { bounds: [x, top - 200, w, 120], angle: 0, gap: 6, color: INK, width: () => 0.7, wobble: 0.2, step: 8, seed: seed + 5 });
  engrave(ctx, stack, { bounds: [x, top - 200, w, 120], angle: 1.1, gap: 3.5, color: INK, width: (xx) => 0.8 * smoothstep(0.4, 0.9, ((xx - x) % 40) / 40), wobble: 0.3, step: 5, seed: seed + 6 });
  ctx.lineWidth = 1.2; ctx.stroke(stack);
  // 老虎窗
  const nd = w > 280 ? 2 : 1;
  for (let i = 0; i < nd; i++) {
    const dx = x + w * ((i + 1) / (nd + 1)) - 16;
    const d = new Path2D(); d.rect(dx, top - 72, 32, 44); d.moveTo(dx - 5, top - 72); d.lineTo(dx + 16, top - 92); d.lineTo(dx + 37, top - 72); d.closePath();
    ctx.fillStyle = FACADE; ctx.fill(d); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke(d);
    sashSmall(ctx, dx + 7, top - 66, 18, 30, R() < 0.3, seed + 7 + i);
  }
  // 檐口：一条浅色挑檐 + 齿饰
  ctx.fillStyle = PAPER_HI; ctx.fillRect(x - 6, top - 16, w + 12, 16); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.strokeRect(x - 6, top - 16, w + 12, 16);
  for (let dx = x; dx < x + w; dx += 9) { ctx.fillStyle = INK; ctx.fillRect(dx, top, 4, 6); }
  line(ctx, x - 6, top + 8, x + w + 6, top + 8, 0.8);
  // 楼上的窗：两层，每层 2–3 扇
  const n = w > 290 ? 3 : 2;
  const floorsY = [top + 46, top + 196];
  floorsY.forEach((wy, f) => {
    if (wy + 110 > BASE - 190) return;
    for (let i = 0; i < n; i++) {
      const cx = x + (w - 18) * ((i + 0.5) / n);
      sash(ctx, cx, wy, 42, f === 0 ? 96 : 84, R() < 0.3, seed + 10 + f * 5 + i, f === 0 ? 'ped' : 'arch');
    }
    line(ctx, x, wy + (f === 0 ? 132 : 120), x + w, wy + (f === 0 ? 132 : 120), 1, INK);
  });
  // 一层：门 + 凸窗
  const doorLeft = R() < 0.5;
  const dcx = doorLeft ? x + 52 : x + w - 70;
  const dTop = BASE - 44 - 128, dw = 52;
  const door = rectPath(dcx - dw / 2, dTop, dw, 128);
  ctx.fillStyle = mix(PAPER, INK, 0.4); ctx.fill(door);
  engrave(ctx, door, { bounds: [dcx - dw / 2, dTop, dw, 128], angle: Math.PI / 2, gap: 2.8, color: INK, width: () => 0.9, wobble: 0.2, step: 6, seed: seed + 20 });
  ctx.strokeStyle = PAPER_HI; ctx.lineWidth = 1.1;
  for (const [px, py] of [[-18, 12], [3, 12], [-18, 66], [3, 66]]) ctx.strokeRect(dcx + px, dTop + py, 15, 46);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(door);
  // 扇形气窗
  ctx.fillStyle = LIT; ctx.beginPath(); ctx.arc(dcx, dTop, dw / 2, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  for (let k = 1; k < 6; k++) { const a = Math.PI + (k / 6) * Math.PI; line(ctx, dcx, dTop, dcx + Math.cos(a) * dw / 2, dTop + Math.sin(a) * dw / 2, 0.8); }
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(dcx, dTop, dw / 2 + 8, Math.PI, 0); ctx.stroke();
  // 台阶
  for (let k = 0; k < 3; k++) {
    const sw = dw + 20 + k * 16, sy = BASE - 44 + k * 14.7;
    ctx.fillStyle = PAPER_HI; ctx.fillRect(dcx - sw / 2, sy, sw, 14.7);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.strokeRect(dcx - sw / 2, sy, sw, 14.7);
    line(ctx, dcx - sw / 2 + 2, sy + 12, dcx + sw / 2 - 2, sy + 12, 1.6, rgba(INK, 0.55));
  }
  // 凸窗（三面）
  const bw = Math.min(150, w - 150), bx = doorLeft ? x + w - 30 - bw : x + 24, bTop = BASE - 176;
  const front = rectPath(bx + 18, bTop, bw - 36, 132);
  const sideL = new Path2D(); sideL.moveTo(bx, bTop + 8); sideL.lineTo(bx + 18, bTop); sideL.lineTo(bx + 18, bTop + 132); sideL.lineTo(bx, bTop + 124); sideL.closePath();
  const sideR = new Path2D(); sideR.moveTo(bx + bw, bTop + 8); sideR.lineTo(bx + bw - 18, bTop); sideR.lineTo(bx + bw - 18, bTop + 132); sideR.lineTo(bx + bw, bTop + 124); sideR.closePath();
  const bayLit = R() < 0.55;
  for (const [p, a] of [[front, 0], [sideL, 1], [sideR, 2]]) {
    ctx.fillStyle = bayLit && a === 0 ? LIT : mix(PAPER, INK, a === 2 ? 0.3 : 0.15); ctx.fill(p);
    engrave(ctx, p, { bounds: [bx, bTop, bw, 132], angle: a === 0 ? (bayLit ? Math.PI / 2 : 0.8) : Math.PI / 2, gap: a === 2 ? 2.6 : 3.4, color: bayLit && a === 0 ? '#c79a52' : INK, width: () => (bayLit && a === 0 ? 0.6 : 0.8), wobble: 0.2, step: 6, seed: seed + 30 + a });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke(p);
  }
  for (let k = 1; k < 3; k++) line(ctx, bx + 18 + ((bw - 36) * k) / 3, bTop, bx + 18 + ((bw - 36) * k) / 3, bTop + 132, 1.4);
  line(ctx, bx + 18, bTop + 50, bx + bw - 18, bTop + 50, 1.2);
  ctx.fillStyle = PAPER_HI; ctx.fillRect(bx - 6, bTop - 14, bw + 12, 14); ctx.strokeRect(bx - 6, bTop - 14, bw + 12, 14);
  ctx.fillStyle = FACADE; ctx.fillRect(bx - 2, bTop + 132, bw + 4, BASE - bTop - 132); ctx.strokeRect(bx - 2, bTop + 132, bw + 4, BASE - bTop - 132);
  // 栏杆（台阶处断开）
  const gap0 = dcx - (dw + 52) / 2, gap1 = dcx + (dw + 52) / 2;
  railings(ctx, x, gap0); railings(ctx, gap1, x + w);
  // 和隔壁之间的分户墙线
  line(ctx, x, top - 16, x, BASE, 2);
}
function sashSmall(ctx, x, y, w, h, lit, seed) {
  const g = rectPath(x, y, w, h);
  ctx.fillStyle = lit ? LIT : mix(PAPER, INK, 0.2); ctx.fill(g);
  if (!lit) engrave(ctx, g, { bounds: [x, y, w, h], angle: 0.8, gap: 3, color: INK, width: () => 0.8, wobble: 0.2, step: 5, seed });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, w, h); line(ctx, x, y + h / 2, x + w, y + h / 2, 1);
}
function farLamp(ctx, x, y, sc) {
  // 小巷深处的一盏远灯（缩小的煤气灯 + 一团淡光）
  const g = ctx.createRadialGradient(x, y - LAMP.head * sc, 2, x, y - LAMP.head * sc, 120 * sc);
  g.addColorStop(0, rgba(GLOW, 0.75)); g.addColorStop(0.3, rgba(GLOW, 0.3)); g.addColorStop(1, rgba(GLOW, 0));
  ctx.fillStyle = g; ctx.fillRect(x - 120 * sc, y - LAMP.head * sc - 120 * sc, 240 * sc, 240 * sc);
  ctx.drawImage(lampSprite(), x - LAMP.bx * sc, y - LAMP.by * sc, LAMP.w * sc, LAMP.h * sc);
}
function midLayer() {
  return strip('s07-mid', P_MID, (ctx, x0, x1) => {
    const R = rng('s07-mid');
    // 墙根前的一条采光井 / 人行道后沿
    ctx.fillStyle = mix(PAPER, '#d6c29a', 0.35); ctx.fillRect(x0, BASE - 2, x1 - x0, 1000 - BASE);
    let x = x0 - 80, k = 0, since = 0;
    while (x < x1 + 40) {
      if (since >= 2 && R() < 0.45) {
        // 路口：让开一段，远处的街屋和钟楼从雾里露出来；路口深处立一盏远灯
        const gw = 190 + R() * 90;
        ctx.save(); ctx.globalAlpha = 0.85; farLamp(ctx, x + gw * 0.55, BASE - 30, 0.45); ctx.restore();
        line(ctx, x, BASE - 30, x + gw, BASE - 30, 0.8, INK_F);
        x += gw; since = 0;
        continue;
      }
      const w = 250 + R() * 90, top = 268 + R() * 70;
      townhouse(ctx, x, w, top, R, 100 + k * 37);
      x += w; k++; since++;
      if (R() < 0.15) {
        // 偶尔一条窄巷：深一点的排线，雾从巷子里漫出来
        const aw = 34 + R() * 20;
        const a = rectPath(x, 380, aw, BASE - 380);
        ctx.fillStyle = mix(PAPER, INK, 0.22); ctx.fill(a);
        engrave(ctx, a, { bounds: [x, 380, aw, BASE - 380], angle: 0.9, gap: 3, color: INK, width: (xx, yy) => 0.9 * (1 - smoothstep(560, 760, yy)), wobble: 0.3, step: 6, seed: k });
        x += aw;
      }
    }
    line(ctx, x0, BASE, x1, BASE, 1.6);
    // 薄雾：整体蒙一层纸色，越靠近地面越浓
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 160, 0, 800);
    g.addColorStop(0, rgba(FOG, 0.1)); g.addColorStop(0.5, rgba(FOG, 0.22)); g.addColorStop(0.85, rgba(FOG, 0.5)); g.addColorStop(1, rgba(FOG, 0.62));
    ctx.fillStyle = g; ctx.fillRect(x0, 0, x1 - x0, 1000);
    ctx.globalCompositeOperation = 'source-over';
  }, { y0: 60, y1: 810 });
}

// ---------- 路面：人行道石板、路缘石、鹅卵石，灯下有积水倒影 ----------
const lampXs = (cg) => {
  const [a, b] = stripRange(1);
  const xs = [];
  const base = LAMP_GAG_X + cg;
  for (let k = Math.floor((a - base) / LAMP_GAP) - 1; base + k * LAMP_GAP < b + 100; k++) xs.push(base + k * LAMP_GAP);
  return xs;
};
function cobble(ctx, x, y, w, h, tone, R) {
  // 不太规整的圆角石块：四个角各抖一点，边中点做二次曲线
  const j = () => (R() - 0.5) * h * 0.22;
  const c = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]];
  const p = new Path2D();
  for (let i = 0; i < 4; i++) {
    const a = c[i], b2 = c[(i + 1) % 4], m = [(a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2];
    i ? p.quadraticCurveTo(a[0], a[1], m[0], m[1]) : p.moveTo(m[0], m[1]);
    if (i === 3) { const m0 = [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2]; p.quadraticCurveTo(c[0][0], c[0][1], m0[0], m0[1]); }
  }
  p.closePath();
  ctx.fillStyle = tone; ctx.fill(p);
  // 下半边的刻线阴影：沿石块轮廓往左上错开描几遍（只留在石块里面）
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8;
  for (let k = 1; k <= 3; k++) { ctx.save(); ctx.translate(-k * h * 0.07, -k * h * 0.1); ctx.globalAlpha = 0.7 - k * 0.15; ctx.stroke(p); ctx.restore(); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke(p);
}
function roadLayer(cg) {
  return strip('s07-road', 1, (ctx, x0, x1) => {
    const R = rng('s07-road');
    // 人行道：石板
    ctx.fillStyle = mix(PAPER, '#e2d1ad', 0.5); ctx.fillRect(x0, ROAD_Y - 14, x1 - x0, 50);
    engrave(ctx, rectPath(x0, ROAD_Y - 14, x1 - x0, 50), { bounds: [x0, ROAD_Y - 14, x1 - x0, 50], angle: 0, gap: 4, color: INK_L, width: (x, y) => 0.55 * smoothstep(ROAD_Y + 4, ROAD_Y + 34, y), wobble: 0.4, step: 10, seed: 3 });
    for (let x = Math.floor(x0 / 86) * 86; x < x1; x += 86) line(ctx, x, ROAD_Y - 14, x - 8, ROAD_Y + 36, 1, INK_L);
    line(ctx, x0, ROAD_Y + 11, x1, ROAD_Y + 11, 0.8, INK_L);
    line(ctx, x0, ROAD_Y - 14, x1, ROAD_Y - 14, 1.4, INK_M);
    // 路缘石
    const ky = ROAD_Y + 36;
    ctx.fillStyle = PAPER_HI; ctx.fillRect(x0, ky, x1 - x0, 16);
    engrave(ctx, rectPath(x0, ky + 5, x1 - x0, 11), { bounds: [x0, ky + 5, x1 - x0, 11], angle: 0, gap: 2.6, color: INK, width: () => 0.8, wobble: 0.2, step: 10, seed: 4 });
    line(ctx, x0, ky, x1, ky, 1.6); line(ctx, x0, ky + 5, x1, ky + 5, 0.9); line(ctx, x0, ky + 16, x1, ky + 16, 1.6);
    for (let x = Math.floor(x0 / 118) * 118 + 30; x < x1; x += 118) line(ctx, x, ky, x, ky + 16, 1);
    // 鹅卵石：一行比一行大（透视）
    let y = ky + 17;
    while (y < 1004) {
      const h = 10 + (y - ky) * 0.1;
      let x = x0 - R() * h * 2;
      while (x < x1) {
        const w = h * (1.2 + R() * 1.1);
        cobble(ctx, x + 1.6, y + 1.4, w - 3.2, h - 2.8, R() < 0.5 ? PAPER : mix(PAPER, '#dcc9a2', 0.6), R);
        x += w;
      }
      y += h;
    }
    // 积水：每盏灯下一片，压淡石头、横向反光刻线、灯的倒影
    lampXs(cg).forEach((lx, i) => {
      // 不规则的一摊水：三个扁椭圆拼起来
      const cy = 928 + (i % 2) * 16, rx = 150 + (i % 3) * 26;
      const E = [[lx + 20, cy, rx, 34], [lx - rx * 0.45, cy + 14, rx * 0.55, 22], [lx + rx * 0.7, cy - 8, rx * 0.5, 20]];
      const pud = new Path2D();
      for (const [ex, ey, erx, ery] of E) { pud.moveTo(ex + erx, ey); pud.ellipse(ex, ey, erx, ery, 0, 0, TAU); }
      const bx = lx - rx * 1.05, bw = rx * 2.4, by = cy - 40, bh = 80;
      const inside = (x, y) => Math.max(...E.map(([ex, ey, erx, ery]) => 1 - Math.hypot((x - ex) / erx, (y - ey) / ery)));
      ctx.save(); ctx.clip(pud);
      const wg = ctx.createLinearGradient(0, by, 0, by + bh);
      wg.addColorStop(0, rgba(PAPER_HI, 0.55)); wg.addColorStop(1, rgba(PAPER_HI, 0.8));
      ctx.fillStyle = wg; ctx.fillRect(bx, by, bw, bh);
      ctx.restore();
      // 水面：横向刻线（灯柱倒影正下方留白，像反光）
      engrave(ctx, pud, { bounds: [bx, by, bw, bh], angle: 0, gap: 3.2, color: INK_M, wobble: 0.25, step: 7, seed: 40 + i,
        width: (x, yy) => { const e = inside(x, yy); const lit = smoothstep(8, 40, Math.abs(x - lx)); return 0.9 * smoothstep(0.02, 0.3, e) * (0.25 + 0.75 * lit) * (noise2(x * 0.025, yy * 0.3, 9) > 0.4 ? 1 : 0); } });
      // 倒影里的灯柱：竖向断续的短横线
      for (let yy = cy - 26; yy < cy + 30; yy += 4.5) {
        const ww = 2.5 + 3.5 * noise2(yy * 0.3, i, 2);
        line(ctx, lx - ww + Math.sin(yy * 0.5) * 2, yy, lx + ww + Math.sin(yy * 0.5) * 2, yy, 1.2, INK);
      }
    });
    // 地面的雾：靠近人行道一侧更浓
    const g = ctx.createLinearGradient(0, ROAD_Y - 16, 0, 940);
    g.addColorStop(0, rgba(FOG, 0.5)); g.addColorStop(0.35, rgba(FOG, 0.28)); g.addColorStop(1, rgba(FOG, 0));
    ctx.fillStyle = g; ctx.fillRect(x0, ROAD_Y - 16, x1 - x0, 1000 - ROAD_Y + 16);
  }, { y0: ROAD_Y - 18, y1: 1000 });
}

// ---------- 煤气灯（贴图）+ 暖黄光晕 ----------
const LAMP = { w: 120, h: 690, bx: 60, by: 676, head: 540 };
function lampSprite() {
  const res = 1.6 * K;
  return baked('s07-lamp', LAMP.w * res, LAMP.h * res, (ctx) => {
    ctx.scale(res, res); ctx.translate(LAMP.bx, LAMP.by);
    ctx.lineJoin = 'round';
    // 底座
    const plinth = new Path2D();
    plinth.moveTo(-24, 0); plinth.lineTo(-24, -54); plinth.lineTo(-15, -74); plinth.lineTo(15, -74); plinth.lineTo(24, -54); plinth.lineTo(24, 0); plinth.closePath();
    ctx.fillStyle = mix(PAPER, INK, 0.3); ctx.fill(plinth);
    engrave(ctx, plinth, { bounds: [-26, -76, 52, 78], angle: Math.PI / 2, gap: 2.6, color: INK, width: (x) => 0.6 + 0.6 * smoothstep(-20, 20, x), wobble: 0.2, step: 4, seed: 1 });
    engrave(ctx, plinth, { bounds: [-26, -76, 52, 78], angle: 0.6, gap: 3.2, color: INK, width: (x) => 0.9 * smoothstep(0, 22, x), wobble: 0.2, step: 4, seed: 2 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(plinth);
    line(ctx, -24, -54, 24, -54, 1.2);
    // 柱身（上细下粗，竖向凹槽）
    const col = new Path2D(); col.moveTo(-10, -74); col.lineTo(-6, -500); col.lineTo(6, -500); col.lineTo(10, -74); col.closePath();
    ctx.fillStyle = mix(PAPER, INK, 0.25); ctx.fill(col);
    engrave(ctx, col, { bounds: [-11, -500, 22, 428], angle: Math.PI / 2, gap: 2.4, color: INK, width: (x) => 0.5 + 0.9 * smoothstep(-6, 8, x), wobble: 0.15, step: 8, seed: 3 });
    ctx.lineWidth = 1.5; ctx.stroke(col);
    for (const [yy, ww] of [[-150, 14], [-160, 12], [-470, 11], [-500, 12]]) { ctx.fillStyle = PAPER_HI; ctx.fillRect(-ww, yy - 4, 2 * ww, 7); ctx.strokeRect(-ww, yy - 4, 2 * ww, 7); }
    // 架梯子的横担
    line(ctx, -36, -486, 36, -486, 3);
    for (const sx of [-1, 1]) { ctx.fillStyle = INK; circle(ctx, sx * 38, -486, 4); ctx.fill(); }
    // 灯笼：倒锥底、四面玻璃（看得见三面）、帽、顶饰
    const cone = new Path2D(); cone.moveTo(-8, -504); cone.lineTo(-24, -516); cone.lineTo(24, -516); cone.lineTo(8, -504); cone.closePath();
    ctx.fillStyle = mix(PAPER, INK, 0.35); ctx.fill(cone); ctx.stroke(cone);
    const glass = new Path2D(); glass.moveTo(-24, -516); glass.lineTo(-34, -590); glass.lineTo(34, -590); glass.lineTo(24, -516); glass.closePath();
    const gg = ctx.createRadialGradient(0, -548, 2, 0, -548, 40);
    gg.addColorStop(0, '#fff6d6'); gg.addColorStop(0.45, '#fbe3a0'); gg.addColorStop(1, GAS);
    ctx.fillStyle = gg; ctx.fill(glass);
    // 火苗
    ctx.fillStyle = '#fffbe9'; ellipse(ctx, 0, -546, 5, 9); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(glass);
    for (const t of [0.24, 0.76]) line(ctx, lerp(-24, 24, t), -516, lerp(-34, 34, t), -590, 1.6);
    line(ctx, -29, -553, 29, -553, 0.8, rgba(INK, 0.6));
    const cap = new Path2D(); cap.moveTo(-42, -590); cap.quadraticCurveTo(-30, -616, 0, -630); cap.quadraticCurveTo(30, -616, 42, -590); cap.closePath();
    ctx.fillStyle = mix(PAPER, INK, 0.3); ctx.fill(cap);
    engrave(ctx, cap, { bounds: [-44, -632, 88, 44], angle: Math.PI / 2, gap: 2.6, color: INK, width: (x) => 0.5 + 0.8 * smoothstep(-30, 40, x), wobble: 0.2, step: 4, seed: 6 });
    ctx.lineWidth = 1.6; ctx.stroke(cap);
    ctx.fillStyle = PAPER_HI; circle(ctx, 0, -636, 6); ctx.fill(); ctx.stroke();
    line(ctx, 0, -642, 0, -662, 2);
    // 灯笼下沿两个小挂钩
    line(ctx, -36, -590, -44, -582, 1.4); line(ctx, 36, -590, 44, -582, 1.4);
  });
}
const lampHead = (x) => [x, LAMP_Y - LAMP.head];
function lampGlow(ctx, x, y, k) {
  const r = 200 * (0.85 + 0.35 * k);
  const g = ctx.createRadialGradient(x, y, 6, x, y, r);
  g.addColorStop(0, rgba('#fff3cc', Math.min(1, 0.95 * k)));
  g.addColorStop(0.16, rgba(GLOW, Math.min(1, 0.72 * k)));
  g.addColorStop(0.5, rgba(GLOW, 0.26 * k));
  g.addColorStop(1, rgba(GLOW, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}
/** 第 9 拍强拍：定格那盏灯猛地一亮，之后慢慢回落。 */
const flare = (b) => smoothstep(GAG - 0.06, GAG + 0.04, b) * (1 - 0.6 * smoothstep(GAG + 0.3, GAG + 2.5, b)) * (1 - smoothstep(GAG + 3.8, GAG + 4.6, b));
function drawLamps(ctx, b, env) {
  const cam = env.cam, cg = env.camAt(GAG);
  const gagX = LAMP_GAG_X + cg;
  lampXs(cg).forEach((wx, i) => {
    const x = wx - cam;
    if (x < X_MIN - 260 || x > X_MAX + 260) return;
    const [hx, hy] = lampHead(x);
    const isGag = Math.abs(wx - gagX) < 1;
    const k = 0.9 + 0.12 * (noise2(b * 2.1, i * 3.7, 4) - 0.5) + (isGag ? 0.55 * flare(b) : 0);
    // 地上的一圈暖光
    ctx.save(); ctx.translate(x + 20, ROAD_Y + 10); ctx.scale(1, 0.16);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 260);
    g.addColorStop(0, rgba(GLOW, 0.5 * k)); g.addColorStop(1, rgba(GLOW, 0));
    ctx.fillStyle = g; ctx.fillRect(-260, -260, 520, 520); ctx.restore();
    // 积水里的倒影：一条竖向的暖光
    const rg = ctx.createLinearGradient(0, 880, 0, 990);
    rg.addColorStop(0, rgba(GLOW, 0)); rg.addColorStop(0.4, rgba(GLOW, 0.45 * k)); rg.addColorStop(1, rgba(GLOW, 0));
    ctx.fillStyle = rg; ellipse(ctx, x + 2, 935, 16 + 6 * k, 60); ctx.fill();
    lampGlow(ctx, hx, hy, k);
    ctx.drawImage(lampSprite(), x - LAMP.bx, LAMP_Y - LAMP.by, LAMP.w, LAMP.h);
  });
}

// ---------- 雾带（每帧缓慢漂移） ----------
const MIST_W = 2400;
function mistTex(seed, h) {
  const res = 0.5 * K;
  return baked(`s07-mist|${seed}|${h}`, MIST_W * res, h * res, (ctx) => {
    ctx.scale(res, res);
    const R = rng('s07-mist', seed);
    for (let i = 0; i < 70; i++) {
      const x = R() * MIST_W, y = h * (0.3 + 0.4 * R()), rx = 120 + R() * 240, ry = rx * (0.16 + 0.12 * R());
      for (const dx of [-MIST_W, 0, MIST_W]) {
        ctx.save(); ctx.translate(x + dx, y); ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, rgba(FOG, 0.3)); g.addColorStop(0.6, rgba(FOG, 0.14)); g.addColorStop(1, rgba(FOG, 0));
        ctx.fillStyle = g; ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx); ctx.restore();
      }
    }
  });
}
function drawMist(ctx, seed, y, h, off, alpha) {
  const tex = mistTex(seed, h);
  let x = X_MIN - (((off % MIST_W) + MIST_W) % MIST_W);
  ctx.save(); ctx.globalAlpha = alpha;
  for (; x < X_MAX; x += MIST_W) ctx.drawImage(tex, x, y, MIST_W, h);
  ctx.restore();
}

// ---------- 原创侦探：猎鹿帽（格纹）、披肩斗篷、单片眼镜、海象胡、大圆鼻子 ----------
const DS = 1.05;            // 前景里的侦探比人物大一点
const HEAD_S = 1.2;         // 头再放大一点（漫画式的大头，帽子和胡子更醒目）
const DET_Y = 612;          // 脖根在画面上的高度
const DET_GAG_X = -150;     // 定格时脖根的 x
const SHOULDER = [112, 118]; // 拿放大镜那只胳膊从斗篷前襟伸出来的位置（局部坐标）
const T_DET = [GAG - 4, GAG - 2.5]; // 第 5–6.5 拍：从左边悄悄跟进画面
function detX(b, env) {
  if (b < T_DET[0]) return -900;
  if (b < T_DET[1]) return lerp(-680, -195, ease.out((b - T_DET[0]) / (T_DET[1] - T_DET[0])));
  if (b < GAG) return lerp(-195, DET_GAG_X, smoothstep(T_DET[1], GAG, b));
  if (b < GAG + 4) return DET_GAG_X;
  return DET_GAG_X - (env.cam - env.camAt(GAG + 4)) * 1.3; // 第 13 拍起他留在原地，随前景层滑出画面
}
/** 点头：第 13 拍收回放大镜后点两下 */
const nodAt = (b) => 0.16 * (pulse(GAG + 4.2, GAG + 4.6, b) + pulse(GAG + 4.65, GAG + 5.05, b));
/** 灯在右边：沿形状右侧的边刻一道纸色亮边（形状内侧）。 */
function rimRight(ctx, path, w = 4, dx = -3, alpha = 0.9) {
  ctx.save(); ctx.clip(path); ctx.translate(dx, 0); ctx.strokeStyle = rgba(PAPER_HI, alpha); ctx.lineWidth = w; ctx.stroke(path); ctx.restore();
}
/** 只在形状的左（背光）半边叠一层交叉线。 */
function shadeLeft(ctx, path, xSplit, kind = 'cross', gap = 3.6) {
  ctx.save(); ctx.clip(path); ctx.beginPath(); ctx.rect(-400, -400, 400 + xSplit, 1200); ctx.clip();
  ctx.fillStyle = ctx.createPattern(tile(kind, INK, 1.1, gap), 'repeat'); ctx.fill(path); ctx.restore();
}
function detectiveBody(ctx) {
  // 局部坐标：原点在脖根，面朝右（灯在右边）
  const coat = new Path2D();
  coat.moveTo(-112, 40); coat.lineTo(-138, 380); coat.lineTo(150, 380); coat.lineTo(118, 40); coat.closePath();
  fillEngraved(ctx, coat, '#6a4b31', 'cross', { gap: 3.6, lw: 1.2 });
  line(ctx, 120, 220, 132, 380, 2, rgba(PAPER_HI, 0.7));
  ctx.strokeStyle = PAPER_HI; ctx.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) { circle(ctx, 106, 262 + k * 44, 4.5); ctx.stroke(); }
  // 披肩斗篷：肩上一层钟形短斗篷，下摆起伏
  const cape = new Path2D();
  cape.moveTo(-36, -6); cape.bezierCurveTo(-92, -2, -126, 28, -136, 86); cape.bezierCurveTo(-144, 140, -150, 190, -156, 236);
  const hem = [[-156, 236], [-104, 246], [-50, 236], [6, 248], [62, 236], [114, 244], [150, 228]];
  for (let i = 1; i < hem.length; i++) { const [ax, ay] = hem[i - 1], [bx2, by2] = hem[i]; cape.quadraticCurveTo((ax + bx2) / 2, Math.max(ay, by2) + 10, bx2, by2); }
  cape.bezierCurveTo(146, 170, 134, 90, 112, 40); cape.bezierCurveTo(96, 12, 66, -4, 34, -6); cape.quadraticCurveTo(0, -12, -36, -6); cape.closePath();
  fillEngraved(ctx, cape, '#957251', 'diag', { gap: 3.8, lw: 1 });
  shadeLeft(ctx, cape, -10, 'cross', 3.6);
  // 斗篷的褶：从肩上散开的几道刻线（深）+ 亮边
  for (const [x0, y0, cx, cy, x1, y1] of [[-80, 30, -110, 120, -116, 236], [-30, 20, -50, 140, -48, 240], [30, 20, 40, 130, 34, 244], [80, 34, 100, 130, 110, 240]]) {
    ctx.strokeStyle = rgba(INK, 0.75); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(cx, cy, x1, y1); ctx.stroke();
    ctx.strokeStyle = rgba(PAPER_HI, 0.5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x0 + 7, y0 + 2); ctx.quadraticCurveTo(cx + 8, cy, x1 + 8, y1 - 2); ctx.stroke();
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(cape);
  rimRight(ctx, cape, 5, -4, 0.85);
  // 竖起的后领
  const collar = new Path2D(); collar.moveTo(-50, -2); collar.lineTo(-62, -66); collar.quadraticCurveTo(-34, -44, -12, -8); collar.closePath();
  fillEngraved(ctx, collar, '#7a5a3c', 'cross', { gap: 3.2 }); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(collar);
  // 白色立领 + 深色领结（把头和斗篷分开）
  const shirt = new Path2D(); shirt.moveTo(-16, -22); shirt.lineTo(46, -20); shirt.lineTo(44, 8); shirt.lineTo(-12, 6); shirt.closePath();
  ctx.fillStyle = PAPER_HI; ctx.fill(shirt); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(shirt);
  const tie = new Path2D(); tie.moveTo(26, -4); tie.lineTo(48, -12); tie.lineTo(46, 12); tie.closePath(); tie.moveTo(26, -4); tie.lineTo(8, -12); tie.lineTo(10, 10); tie.closePath();
  ctx.fillStyle = '#4e3420'; ctx.fill(tie);
}
/** 头（含帽子），局部坐标原点在脖根；返回下巴的位置（托下巴的手跟着它）。 */
function detectiveHead(ctx, b, { nod = 0, tilt = 0, squint = 0 }) {
  const a = nod + tilt, pivot = [8, -8];
  ctx.save();
  ctx.translate(...pivot); ctx.rotate(a); ctx.scale(HEAD_S, HEAD_S); ctx.translate(-pivot[0], -pivot[1]);
  // 脸（侧面）：后脑、额头、凹下去的鼻梁、大圆鼻头、被胡子盖住的嘴、圆下巴
  const face = new Path2D();
  face.moveTo(-34, -6);
  face.bezierCurveTo(-50, -30, -58, -62, -52, -92);
  face.lineTo(50, -102);
  face.bezierCurveTo(57, -94, 59, -88, 57, -80);
  face.quadraticCurveTo(54, -74, 61, -71);
  face.bezierCurveTo(76, -70, 93, -64, 90, -50);
  face.bezierCurveTo(88, -41, 76, -41, 68, -45);
  face.lineTo(66, -34);
  face.quadraticCurveTo(71, -28, 67, -20);
  face.bezierCurveTo(70, -10, 62, -2, 46, -3);
  face.quadraticCurveTo(30, 0, 18, 6);
  face.closePath();
  ctx.fillStyle = '#dcbf98'; ctx.fill(face);
  ctx.fillStyle = ctx.createPattern(tile('diag', INK_M, 0.8, 4.5), 'repeat'); ctx.fill(face);
  shadeLeft(ctx, face, 6, 'cross', 3.4);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke(face);
  rimRight(ctx, face, 3.4, -3, 0.95);
  // 鬓角（羊排式络腮）：沿下颌一条深色毛
  const chop = new Path2D(); chop.moveTo(-6, -84); chop.quadraticCurveTo(-12, -40, 18, -14); chop.quadraticCurveTo(30, -30, 30, -44); chop.quadraticCurveTo(12, -54, 8, -84); chop.closePath();
  ctx.fillStyle = '#6d4c30'; ctx.fill(chop);
  ctx.strokeStyle = rgba(PAPER_HI, 0.55); ctx.lineWidth = 1;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(-2 + k * 4, -78 + k * 6); ctx.quadraticCurveTo(4 + k * 4, -50 + k * 4, 14 + k * 3, -24 + k); ctx.stroke(); }
  // 耳朵
  ctx.fillStyle = '#dcbf98'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ellipse(ctx, -18, -60, 9, 14, 0.1); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-17, -60, 5, -1.2, 1.4); ctx.stroke();
  // 海象胡：一大团下垂的胡子盖住嘴，刻出浅色须线
  const mus = new Path2D();
  mus.moveTo(56, -47); mus.bezierCurveTo(70, -52, 90, -48, 95, -28); mus.quadraticCurveTo(88, -32, 84, -24); mus.quadraticCurveTo(78, -32, 70, -24); mus.quadraticCurveTo(62, -32, 52, -28); mus.quadraticCurveTo(48, -40, 56, -47); mus.closePath();
  ctx.fillStyle = '#4e3420'; ctx.fill(mus);
  ctx.strokeStyle = rgba(PAPER_HI, 0.7); ctx.lineWidth = 1;
  for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(60 + k * 6, -46); ctx.quadraticCurveTo(66 + k * 6, -38, 60 + k * 6.5, -28); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke(mus);
  // 浓眉、眯着的眼、单片眼镜和链子
  line(ctx, 38, -88, 60, -91, 4.5, INK);
  ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(44, -79 + squint); ctx.quadraticCurveTo(50, -82, 56, -79 + squint * 0.5); ctx.stroke();
  ctx.strokeStyle = PAPER_HI; ctx.lineWidth = 2.6; circle(ctx, 50, -78, 11); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.1; circle(ctx, 50, -78, 13); ctx.stroke(); circle(ctx, 50, -78, 9); ctx.stroke();
  ctx.setLineDash([2, 3]); ctx.strokeStyle = rgba(PAPER_HI, 0.9); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(40, -72); ctx.quadraticCurveTo(14, -20, 28, 30); ctx.stroke(); ctx.setLineDash([]);
  // 猎鹿帽：格纹帽顶 + 前后两片硬帽檐 + 顶上系起来的护耳
  const crown = new Path2D(); crown.moveTo(-58, -80); crown.bezierCurveTo(-64, -152, 60, -160, 62, -96); crown.quadraticCurveTo(0, -106, -58, -80); crown.closePath();
  fillEngraved(ctx, crown, '#b08c66', 'check', { gap: 4, lw: 0.8 });
  shadeLeft(ctx, crown, -10, 'diag', 3.4);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
  for (const k of [-0.62, 0, 0.62]) { ctx.beginPath(); ctx.moveTo(0, -146); ctx.quadraticCurveTo(k * 40, -126, k * 66, -98 + Math.abs(k) * 10); ctx.stroke(); }
  ctx.lineWidth = 2; ctx.stroke(crown);
  rimRight(ctx, crown, 3, -3, 0.8);
  const brimF = new Path2D(); brimF.moveTo(46, -100); brimF.quadraticCurveTo(88, -106, 110, -90); brimF.quadraticCurveTo(86, -86, 50, -92); brimF.closePath();
  const brimB = new Path2D(); brimB.moveTo(-52, -84); brimB.quadraticCurveTo(-86, -84, -104, -66); brimB.quadraticCurveTo(-80, -70, -54, -76); brimB.closePath();
  for (const p of [brimF, brimB]) { fillEngraved(ctx, p, '#8a6646', 'cross', { gap: 3.2 }); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke(p); }
  ctx.fillStyle = '#b08c66'; ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (const sx of [-1, 1]) { ellipse(ctx, sx * 11, -150, 11, 6, sx * 0.5); ctx.fill(); ctx.stroke(); }
  circle(ctx, 0, -149, 4); ctx.fill(); ctx.stroke();
  ctx.restore();
  // 下巴位置（旋转后）
  const cx = (52 - pivot[0]) * HEAD_S, cy = (-4 - pivot[1]) * HEAD_S;
  return [pivot[0] + cx * Math.cos(a) - cy * Math.sin(a), pivot[1] + cx * Math.sin(a) + cy * Math.cos(a)];
}
function thinkingArm(ctx, chin, tap) {
  // 托着下巴的手：前臂从斗篷前襟里伸出来，竖在胸前，拳头抵着下巴，食指点着脸颊
  const el = [120, 190];
  const hand = [chin[0] + 4, chin[1] + 14];
  const sleeve = () => { ctx.beginPath(); ctx.moveTo(...el); ctx.quadraticCurveTo(hand[0] + 24, (el[1] + hand[1]) / 2 + 20, hand[0] + 4, hand[1] + 18); };
  ctx.lineCap = 'round';
  sleeve(); ctx.strokeStyle = INK; ctx.lineWidth = 40; ctx.stroke();
  ctx.strokeStyle = '#7a5a3c'; ctx.lineWidth = 35; ctx.stroke();
  ctx.strokeStyle = ctx.createPattern(tile('cross', INK, 1.1, 3.6), 'repeat'); ctx.stroke();
  ctx.strokeStyle = rgba(PAPER_HI, 0.75); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(el[0] + 17, el[1] - 6); ctx.quadraticCurveTo(hand[0] + 42, (el[1] + hand[1]) / 2 + 12, hand[0] + 20, hand[1] + 16); ctx.stroke();
  // 袖口 + 手套
  ctx.fillStyle = PAPER_HI; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
  ellipse(ctx, hand[0] + 4, hand[1] + 20, 19, 7, -0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e1cba3';
  ellipse(ctx, hand[0], hand[1] + 6, 17, 14, -0.3); ctx.fill(); ctx.stroke();
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hand[0] - 8 + k * 6, hand[1] - 4); ctx.lineTo(hand[0] - 6 + k * 6, hand[1] + 6); ctx.lineWidth = 1; ctx.stroke(); }
  ctx.lineWidth = 8.5; ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(hand[0] + 8, hand[1] - 2); ctx.lineTo(hand[0] + 10 - tap * 3, hand[1] - 24 - tap * 7); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = '#e1cba3'; ctx.stroke();
}

// ---------- 放大镜 ----------
const RL = 128;                 // 镜片半径
const GRIP = [RL + 22, RL + 330]; // 手柄在镜轴上的起止（离镜心的距离）
const HAND_AT = RL + 250;
const A_DOWN = 1.32;            // 收在画外（下方）时的角度
const T_IN = [GAG - 0.25, GAG + 0.06];   // 第 9 拍强拍：从画外（下方）甩上来，正好落在强拍
const T_SCAN = [GAG + 0.2, GAG + 0.95];  // 从胸口往上扫到耳朵
const T_OUT = [GAG + 4, GAG + 4.38];     // 第 13 拍收回
/** 放大镜在拍位 b 的状态：镜心 C、放大倍数 M、胳膊根 S。 */
function lensState(b, env, fig) {
  if (b < T_IN[0] || b > T_OUT[1]) return null;
  const S = [detX(b, env) + SHOULDER[0] * DS, DET_Y + SHOULDER[1] * DS];
  // 对准耳机：镜心稍偏左一点，耳机落在镜片中心偏右，镜片里还看得见半张脸
  const E = [fig.x + (ANCHORS.stand.ear[0] - 9) * fig.scale, fig.y + (ANCHORS.stand.ear[1] + 3) * fig.scale];
  const P0 = [fig.x - 14, fig.y - 380]; // 胸口
  const F = [fig.x + 4, fig.y - 450];   // 脸
  const polar = (P) => [Math.atan2(P[1] - S[1], P[0] - S[0]), Math.hypot(P[0] - S[0], P[1] - S[1])];
  let C, M;
  if (b < T_SCAN[0]) {
    const [a1, L] = polar(P0);
    const a = lerp(A_DOWN, a1, ease.outBack(clamp((b - T_IN[0]) / (T_IN[1] - T_IN[0]))));
    C = [S[0] + Math.cos(a) * L, S[1] + Math.sin(a) * L];
    M = 1.5;
  } else if (b < T_SCAN[1]) {
    const t = (b - T_SCAN[0]) / (T_SCAN[1] - T_SCAN[0]);
    const u = ease.inOut(t);
    // 胸口 → 脸 → 耳朵（二次曲线，像在找东西）
    C = [lerp(lerp(P0[0], F[0], u), lerp(F[0], E[0], u), u), lerp(lerp(P0[1], F[1], u), lerp(F[1], E[1], u), u)];
    M = lerp(1.5, 2.2, ease.inOut(clamp(t * 1.15)));
  } else {
    // 对准耳机：轻轻悬停；第 10、11、12 拍上镜片往耳朵一凑
    const nudge = pulse(GAG + 1, GAG + 1.3, b) + pulse(GAG + 2, GAG + 2.3, b) + pulse(GAG + 3, GAG + 3.3, b);
    C = [E[0] + Math.sin(b * 2.3) * 2 - nudge * 4, E[1] + Math.cos(b * 1.9) * 1.6 + nudge * 3];
    M = 2.2 + 0.08 * nudge;
    if (b > T_OUT[0]) {
      const [a1, L] = polar(C);
      const a = lerp(a1, A_DOWN, ease.in((b - T_OUT[0]) / (T_OUT[1] - T_OUT[0])));
      C = [S[0] + Math.cos(a) * L, S[1] + Math.sin(a) * L];
    }
  }
  return { C, M, S };
}

// 镜片里的人物：人物帧裁出头部一块，先放大 2.2 倍，再用更细的三层排线（按明暗）重画（按帧缓存）
const LC = { x: 70, y: 0, w: 240, h: 210, k: 2.2 };
function cropUp(I, { x, y, w, h, k }) {
  const W = Math.round(w * k), H = Math.round(h * k), n = W * H;
  const O = { w: W, h: H, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
  const at = (xx, yy) => Math.min(I.h - 1, Math.max(0, yy)) * I.w + Math.min(I.w - 1, Math.max(0, xx));
  for (let j = 0; j < H; j++) {
    const sy = y + (j + 0.5) / k - 0.5, y0 = Math.floor(sy), fy = sy - y0;
    for (let i = 0; i < W; i++) {
      const sx = x + (i + 0.5) / k - 0.5, x0 = Math.floor(sx), fx = sx - x0;
      const idx = [at(x0, y0), at(x0 + 1, y0), at(x0, y0 + 1), at(x0 + 1, y0 + 1)];
      const wt = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      let r = 0, g = 0, bb = 0, a = 0;
      for (let q = 0; q < 4; q++) { const aw = I.a[idx[q]] * wt[q]; r += I.r[idx[q]] * aw; g += I.g[idx[q]] * aw; bb += I.b[idx[q]] * aw; a += aw; }
      const o = j * W + i;
      if (a > 1e-4) { O.r[o] = r / a; O.g[o] = g / a; O.b[o] = bb / a; }
      O.a[o] = a;
    }
  }
  return O;
}
// 站立帧里耳机的位置（源图像素：耳朵右沿那一小块深色）→ 只在这里把深色压成实墨，让放大后一眼看得出是耳机
const EARBUD = [201, 54, 9, 12];
function lensEngrave(I, earbud) {
  const C = cropUp(I, LC), k = LC.k;
  const S = smoothColor(C, 1.6);
  const L = lumaArray(S, 0.8);
  const E = sobel(lumaArray(smoothColor(C, 3.2), 0.7), S.w, S.h);
  const P = rgbf(PAPER_HI), Kk = rgbf(INK);
  const O = clone(S);
  const g = 3.5;
  const dirs = [[0.5, 0.12, 0.62], [-1.05, 0.42, 0.46], [1.45, 0.7, 0.26]].map(([a, d0, span]) => [Math.cos(a), Math.sin(a), d0, span]);
  const [ex, ey, erx, ery] = earbud ? [(earbud[0] - LC.x) * k, (earbud[1] - LC.y) * k, earbud[2] * k, earbud[3] * k] : [0, 0, 0, 0];
  for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w; x++) {
    const i = y * S.w + x;
    if (S.a[i] < 0.02) continue;
    let l = L[i];
    let bud = false;
    if (earbud) {
      const q = ((x - ex) / erx) ** 2 + ((y - ey) / ery) ** 2;
      if (q < 1 && l < 0.62) { l = 0.02; bud = true; }
    }
    const d = 1 - l;
    const wob = (noise2(x * 0.04, y * 0.04, 7) - 0.5) * 1.6;
    let on = d > 0.94 || E[i] > 0.3;
    for (const [c, s, d0, span] of dirs) {
      if (on) break;
      const u = (((x * c + y * s + wob) / g) % 1 + 1) % 1;
      const dist = Math.min(u, 1 - u) * 2; // 0 在刻线中心
      on = dist < clamp((d - d0) / span) * 0.92;
    }
    const col = on ? Kk : P;
    O.r[i] = col[0]; O.g[i] = col[1]; O.b[i] = col[2];
    O.a[i] = S.a[i] > 0.5 ? 1 : S.a[i];
    if (bud && ((x - ex + erx * 0.3) / erx) ** 2 + ((y - ey + ery * 0.35) / ery) ** 2 < 0.05) { O.r[i] = P[0]; O.g[i] = P[1]; O.b[i] = P[2]; } // 耳机上一点高光
  }
  outline(O, C.a, 2.6, Kk);
  return O;
}
registerStyle('s07-lens', (I) => lensEngrave(I, null));
registerStyle('s07-lens-stand', (I) => lensEngrave(I, EARBUD));
function drawLensFigure(ctx, fig) {
  const W = activeWalk();
  if (!W) return;
  const m = W.meta, sc = FIGURE_H / m.personHeight;
  const stand = fig.pose === 'stand';
  const idx = stand ? -1 : frameIndex(fig.phase || 0);
  const src = stand ? W.stand : W.frames[idx];
  if (!src) return;
  const img = styledFrame(`${W.name}/${stand ? 'stand' : idx}`, src, stand ? 's07-lens-stand' : 's07-lens');
  const s = sc * fig.scale;
  ctx.drawImage(img, fig.x + (LC.x - m.anchorX) * s, fig.y + (LC.y - m.baseY) * s, LC.w * s, LC.h * s);
}
function drawMagnifier(ctx, b, env, L) {
  const { C, M, S } = L;
  const fig = env.figure();
  const ang = Math.atan2(S[1] - C[1], S[0] - C[0]); // 从镜心指向肩
  const ux = Math.cos(ang), uy = Math.sin(ang);
  const P = (d, o = 0) => [C[0] + ux * d - uy * o, C[1] + uy * d + ux * o];
  // 手柄：车削木柄（两头细、中间粗，几道箍），排线阴影
  const grip = new Path2D();
  const prof = [[GRIP[0], 9], [GRIP[0] + 16, 9], [GRIP[0] + 24, 14], [GRIP[0] + 110, 17], [GRIP[1] - 20, 15], [GRIP[1], 11]];
  prof.forEach(([d, r], i) => { const [x, y] = P(d, -r); i ? grip.lineTo(x, y) : grip.moveTo(x, y); });
  for (let i = prof.length - 1; i >= 0; i--) { const [x, y] = P(prof[i][0], prof[i][1]); grip.lineTo(x, y); }
  grip.closePath();
  fillEngraved(ctx, grip, '#a07a52', 'diag', { gap: 3.4, lw: 1 });
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(grip);
  for (const d of [GRIP[0] + 18, GRIP[0] + 30, GRIP[1] - 26]) { const [ax, ay] = P(d, -16), [bx2, by2] = P(d, 16); line(ctx, ax, ay, bx2, by2, 1.8); }
  { const [ax, ay] = P(GRIP[0] + 34, -12), [bx2, by2] = P(GRIP[1] - 30, -12); line(ctx, ax, ay, bx2, by2, 2, rgba(PAPER_HI, 0.8)); }
  // 镜颈（金属箍）
  { const [ax, ay] = P(RL + 2), [bx2, by2] = P(GRIP[0] + 2); ctx.lineCap = 'butt'; line(ctx, ax, ay, bx2, by2, 20, INK); line(ctx, ax, ay, bx2, by2, 15, '#c9ab7c'); ctx.lineCap = 'round'; }
  // 胳膊（斗篷袖子）+ 手套握住手柄
  const H = P(HAND_AT);
  ctx.lineCap = 'round';
  {
    // 袖子：从斗篷前襟伸出，微微下垂的一段弧，靠手那头收细，套一圈白袖口
    const mx = (S[0] + H[0]) / 2 - uy * 0, my = (S[1] + H[1]) / 2;
    const sag = 22, Q = [mx + Math.sin(ang) * sag * 0, my + sag];
    const sleeve = () => { ctx.beginPath(); ctx.moveTo(...S); ctx.quadraticCurveTo(Q[0], Q[1], H[0] + ux * 26, H[1] + uy * 26); };
    sleeve(); ctx.strokeStyle = INK; ctx.lineWidth = 44; ctx.stroke();
    ctx.strokeStyle = '#8a6646'; ctx.lineWidth = 39; ctx.stroke();
    ctx.strokeStyle = ctx.createPattern(tile('diag', INK, 1.1, 3.6), 'repeat'); ctx.stroke();
    ctx.save(); ctx.translate(0, 9); ctx.strokeStyle = ctx.createPattern(tile('cross', INK, 1, 3.4), 'repeat'); ctx.lineWidth = 20; sleeve(); ctx.stroke(); ctx.restore();
    ctx.strokeStyle = rgba(PAPER_HI, 0.75); ctx.lineWidth = 2; ctx.save(); ctx.translate(0, -17); sleeve(); ctx.stroke(); ctx.restore();
    const cu = [H[0] + ux * 30, H[1] + uy * 30];
    ctx.save(); ctx.translate(...cu); ctx.rotate(ang);
    ctx.fillStyle = PAPER_HI; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(0, 0, 8, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // 镜片：先画放大后的画面（甩进来、收回去的时候是一块透明玻璃，对上人物以后才「看清」）
  const mag = smoothstep(T_IN[1] - 0.06, T_SCAN[0] + 0.1, b) * (1 - smoothstep(T_OUT[0], T_OUT[0] + 0.12, b));
  ctx.save();
  ctx.beginPath(); ctx.arc(C[0], C[1], RL, 0, TAU); ctx.clip();
  ctx.fillStyle = rgba(PAPER_HI, 0.3 + 0.7 * mag); ctx.fillRect(C[0] - RL, C[1] - RL, 2 * RL, 2 * RL);
  if (mag > 0.01) {
    ctx.save();
    ctx.globalAlpha = mag;
    ctx.translate(C[0], C[1]); ctx.scale(M, M); ctx.translate(-C[0], -C[1]);
    const [lx, ly] = lampHead(LAMP_GAG_X + env.camAt(GAG) - env.cam);
    lampGlow(ctx, lx, ly, 0.9 + 0.5 * flare(b));
    // 放大后的薄雾：几道断续的淡横线
    ctx.strokeStyle = rgba(INK_L, 0.22); ctx.lineWidth = 0.45;
    for (let yy = Math.floor((C[1] - RL) / 3.5) * 3.5; yy < C[1] + RL; yy += 3.5) {
      const n0 = noise2(yy * 0.13, 1, 31);
      if (n0 < 0.45) continue;
      const xa = C[0] - RL + (noise2(yy * 0.3, 2, 31) - 0.2) * RL, xb = xa + RL * (0.3 + n0);
      ctx.beginPath(); ctx.moveTo(xa, yy); ctx.lineTo(xb, yy); ctx.stroke();
    }
    drawLensFigure(ctx, fig);
    ctx.restore();
  }
  // 玻璃：边缘一圈淡淡的暗角
  const vg = ctx.createRadialGradient(C[0], C[1], RL * 0.7, C[0], C[1], RL);
  vg.addColorStop(0, rgba(INK, 0)); vg.addColorStop(1, rgba(INK, 0.22));
  ctx.fillStyle = vg; ctx.fillRect(C[0] - RL, C[1] - RL, 2 * RL, 2 * RL);
  ctx.restore();
  // 镜框：粗黄铜圈，刻出滚花
  ctx.strokeStyle = INK; ctx.lineWidth = 24; circle(ctx, C[0], C[1], RL + 9); ctx.stroke();
  ctx.strokeStyle = '#c9ab7c'; ctx.lineWidth = 19; ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * TAU;
    const shade = smoothstep(-0.2, 0.8, Math.sin(a - 0.6)); // 右下暗
    if (shade < 0.15 && k % 2) continue;
    ctx.globalAlpha = 0.35 + 0.6 * shade;
    line(ctx, C[0] + Math.cos(a) * (RL + 1), C[1] + Math.sin(a) * (RL + 1), C[0] + Math.cos(a) * (RL + 17), C[1] + Math.sin(a) * (RL + 17), 1);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(PAPER_HI, 0.9); ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(C[0], C[1], RL + 13, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.6; circle(ctx, C[0], C[1], RL); ctx.stroke(); circle(ctx, C[0], C[1], RL + 20); ctx.stroke();
  // 镜片高光：左上两道弧 + 对准时的一下闪光
  ctx.strokeStyle = 'rgba(255,252,240,0.85)'; ctx.lineCap = 'round';
  ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(C[0], C[1], RL * 0.8, Math.PI * 1.08, Math.PI * 1.36); ctx.stroke();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(C[0], C[1], RL * 0.8, Math.PI * 1.43, Math.PI * 1.5); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,252,240,0.5)'; ctx.beginPath(); ctx.arc(C[0], C[1], RL * 0.62, Math.PI * 1.15, Math.PI * 1.3); ctx.stroke();
  const glint = pulse(T_SCAN[1] - 0.05, T_SCAN[1] + 0.45, b);
  if (glint > 0) {
    const gx = C[0] - RL * 0.55, gy = C[1] - RL * 0.6, r = 26 * glint;
    ctx.fillStyle = 'rgba(255,252,238,0.95)';
    ctx.beginPath();
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU, rr = k % 2 ? r * 0.18 : r; ctx.lineTo(gx + Math.cos(a) * rr, gy + Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill();
  }
  // 握柄的手套（压在手柄上）
  ctx.fillStyle = '#d9c29a'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
  ctx.save(); ctx.translate(...H); ctx.rotate(ang);
  ctx.beginPath(); ctx.ellipse(0, 0, 26, 22, 0, 0, TAU); ctx.fill(); ctx.stroke();
  for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(-12 + k * 9, -20); ctx.quadraticCurveTo(-16 + k * 9, 0, -12 + k * 9, 20); ctx.lineWidth = 1.2; ctx.stroke(); }
  ctx.restore();
}

function drawDetective(ctx, b, env) {
  const X = detX(b, env);
  if (X < X_MIN - 300) return;
  const sneak = b < GAG ? Math.abs(Math.sin(b * Math.PI)) * 7 * (1 - smoothstep(GAG - 1, GAG, b)) : 0; // 踮着脚跟踪
  const tilt = b < GAG ? 0.05 * Math.sin(b * Math.PI * 0.5) : -0.06 * smoothstep(GAG, GAG + 0.6, b) * (1 - smoothstep(GAG + 4, GAG + 4.3, b));
  ctx.save();
  ctx.translate(X, DET_Y - sneak);
  ctx.scale(DS, DS);
  detectiveBody(ctx);
  const chin = detectiveHead(ctx, b, { nod: nodAt(b), tilt, squint: b >= GAG && b < GAG + 4 ? -2 : 0 });
  thinkingArm(ctx, chin, Math.max(0, Math.sin(b * Math.PI * 2)) * (b < GAG ? 1 : 0));
  ctx.restore();
}

// ---------- 场景 ----------
export const s07 = {
  id: 's07',
  station: ST,
  figureStyle: 'etching',
  freezeBeat: GAG + 2, // Outro 展墙：放大镜正对着耳机
  drawBack(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG);
    const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1000 * K);
    ctx.drawImage(paperTexture(pw, ph, { base: PAPER, seed: 7, amount: 1.1 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawStrip(ctx, skyLayer(), cam);
    drawStrip(ctx, farLayer(), cam);
    drawMist(ctx, 1, 420, 280, cam * P_MIST_A + b * 9, 0.6);
    drawStrip(ctx, midLayer(), cam);
    drawMist(ctx, 2, 560, 260, cam * P_MIST_B + b * 14, 0.75);
    drawStrip(ctx, roadLayer(cg), cam);
    drawLamps(ctx, b, env);
  },
  drawFront(ctx, b, env) {
    if (b < T_DET[0] - 0.5 || b > 16.5) return;
    drawDetective(ctx, b, env);
    const L = lensState(b, env, env.figure());
    if (L) drawMagnifier(ctx, b, env, L);
  },
  drawFrame(ctx, R) { bookFrame(ctx, R); },
  cardStyle: {
    ink: INK, accent: '#8a4f22', bar: false,
    bgDraw(ctx, x, y, w, h) {
      const pad = 18;
      const c = baked(`s07-card|${Math.round(w)}|${h}`, w + 2 * pad, h + 2 * pad, (g) => { g.translate(pad, pad); engravedPlate(g, w, h, 1); });
      ctx.drawImage(c, x - pad, y - pad);
    },
  },
  playerStyle: {
    ink: INK, noteColor: '#8a4f22', backdrop: false,
    plateDraw(ctx, x, y, w, h) {
      const pad = 14;
      const c = baked(`s07-plate|${Math.round(w)}|${h}`, w + 2 * pad, h + 2 * pad, (g) => { g.translate(pad, pad); engravedPlate(g, w, h, 0.7); });
      ctx.drawImage(c, x - pad, y - pad);
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) { engravedCD(ctx, cx, cy, s, spin); },
  },
};

// ---------- 标题卡 / 歌名底板：铜版插图页的标题框（双线 + 角花） ----------
function engravedPlate(g, w, h, k) {
  g.drawImage(paperTexture(Math.ceil(w), Math.ceil(h), { base: PAPER_HI, seed: 17, amount: 0.8, fibers: 40 }), 0, 0);
  // 右下的刻线投影
  g.fillStyle = rgba(INK, 0.6);
  for (let yy = 8; yy < h + 7; yy += 3.2) g.fillRect(w, yy, 7, 1.1);
  for (let xx = 8; xx < w + 7; xx += 3.2) g.fillRect(xx, h, 1.1, 7);
  // 外粗线 + 内细线
  g.strokeStyle = INK;
  g.lineWidth = 3.2 * k + 0.6; g.strokeRect(1.5, 1.5, w - 3, h - 3);
  const m = 9 * k + 3, rr = 10 * k + 4;
  g.lineWidth = 1.2;
  // 内框：四角内凹的圆角
  g.beginPath();
  g.moveTo(m + rr, m); g.lineTo(w - m - rr, m); g.arc(w - m, m, rr, Math.PI, Math.PI / 2, true);
  g.lineTo(w - m, h - m - rr); g.arc(w - m, h - m, rr, -Math.PI / 2, Math.PI, true);
  g.lineTo(m + rr, h - m); g.arc(m, h - m, rr, 0, -Math.PI / 2, true);
  g.lineTo(m, m + rr); g.arc(m, m, rr, Math.PI / 2, 0, true);
  g.closePath(); g.stroke();
  // 角花：小玫瑰 + 两片叶
  for (const [cx, cy, a] of [[m, m, 0], [w - m, m, Math.PI / 2], [w - m, h - m, Math.PI], [m, h - m, -Math.PI / 2]]) {
    g.save(); g.translate(cx, cy); g.rotate(a);
    g.fillStyle = INK; g.beginPath(); g.arc(0, 0, 2.6 * k + 1, 0, TAU); g.fill();
    g.lineWidth = 1;
    for (let p = 0; p < 4; p++) { g.save(); g.rotate(p * Math.PI / 2 + Math.PI / 4); g.beginPath(); g.ellipse(0, -(3.2 * k + 2.4), 1.6 * k + 0.8, 2.6 * k + 1.2, 0, 0, TAU); g.stroke(); g.restore(); }
    g.beginPath(); g.moveTo(rr * 0.9, 3); g.quadraticCurveTo(rr * 1.8, 9 * k, rr * 2.6, 4); g.stroke();
    g.beginPath(); g.moveTo(3, rr * 0.9); g.quadraticCurveTo(9 * k, rr * 1.8, 4, rr * 2.6); g.stroke();
    g.restore();
  }
  // 上下沿正中的一个小饰（菱形 + 两道短线）
  for (const yy of [m, h - m]) {
    g.save(); g.translate(w / 2, yy);
    g.fillStyle = PAPER_HI; g.beginPath(); g.moveTo(-7, 0); g.lineTo(0, -4); g.lineTo(7, 0); g.lineTo(0, 4); g.closePath(); g.fill();
    g.strokeStyle = INK; g.lineWidth = 1.1; g.stroke();
    g.restore();
  }
}

// ---------- CD：铜版线稿，盘面同心圆排线，反光处留白 ----------
function engravedCD(ctx, cx, cy, s, spin) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  // 右下的刻线投影
  ctx.save(); ctx.beginPath(); ctx.arc(6 * s, 7 * s, r, 0, TAU); ctx.clip();
  ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 1;
  for (let t = -r; t < r * 2; t += 3.2) { ctx.beginPath(); ctx.moveTo(t - r, -r); ctx.lineTo(t + r, r * 1.2); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = PAPER_HI; circle(ctx, 0, 0, r); ctx.fill();
  // 同心圆刻线：两块反光处（固定在画面上，不随盘转）断开
  const gaps = [[-2.5, -1.75], [0.55, 1.2]];
  ctx.strokeStyle = INK; ctx.lineCap = 'butt';
  for (let rr = r * 0.3; rr < r - 3; rr += 2.7 * s) {
    const t = (rr - r * 0.3) / (r * 0.7);
    ctx.lineWidth = 0.55 + 0.5 * t;
    let a0 = gaps[0][1];
    for (const [g0, g1] of [gaps[1], [gaps[0][0] + TAU, gaps[0][1] + TAU]]) {
      // 反光边上的线渐渐变短，看起来像光晕
      const shrink = 0.12 + 0.18 * Math.sin(rr * 0.7);
      ctx.beginPath(); ctx.arc(0, 0, rr, a0 + shrink, g0 - shrink); ctx.stroke();
      a0 = g1;
    }
  }
  // 转起来看得见的东西：印刷面一圈刻线环 + 一个偏心的小星
  ctx.rotate(spin);
  ctx.lineWidth = 1.6; circle(ctx, 0, 0, r * 0.62); ctx.stroke();
  ctx.lineWidth = 0.9;
  for (let k = 0; k < 36; k++) { const a = (k / 36) * TAU; line(ctx, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, Math.cos(a) * r * 0.69, Math.sin(a) * r * 0.69, 0.9); }
  ctx.fillStyle = INK; ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU, rr = k % 2 ? 3 * s : 8 * s; ctx.lineTo(r * 0.8 + Math.cos(a) * rr, Math.sin(a) * rr); }
  ctx.closePath(); ctx.fill();
  // 中心
  ctx.fillStyle = PAPER_HI; circle(ctx, 0, 0, r * 0.27); ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
  for (let rr = r * 0.14; rr < r * 0.26; rr += 2.2 * s) { ctx.lineWidth = 0.7; circle(ctx, 0, 0, rr); ctx.stroke(); }
  ctx.fillStyle = INK; circle(ctx, 0, 0, r * 0.09); ctx.fill();
  ctx.rotate(-spin);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.6 * s; circle(ctx, 0, 0, r); ctx.stroke();
  ctx.lineWidth = 1; circle(ctx, 0, 0, r - 4 * s); ctx.stroke();
  ctx.restore();
}

// ---------- 离场画框：雕版书页边框（像素坐标） ----------
function bookFrame(ctx, R) {
  const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
  ctx.save();
  // 投在路面上的影子
  ctx.fillStyle = rgba(INK, 0.16);
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
  const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
  ctx.fillStyle = PAPER; ctx.fill(band, 'evenodd');
  ctx.fillStyle = rgba(PAPER_HI, 0.6); ctx.fill(band, 'evenodd');
  ctx.strokeStyle = INK;
  // 外：粗 + 细两道线
  ctx.lineWidth = Math.max(1, 5 * s); ctx.strokeRect(x - t + 2.5 * s, y - t + 2.5 * s, w + 2 * t - 5 * s, h + 2 * t - 5 * s);
  ctx.lineWidth = Math.max(0.6, 1.4 * s); ctx.strokeRect(x - t + 10 * s, y - t + 10 * s, w + 2 * t - 20 * s, h + 2 * t - 20 * s);
  // 内：细 + 粗两道线
  ctx.lineWidth = Math.max(0.6, 1.4 * s); ctx.strokeRect(x - 10 * s, y - 10 * s, w + 20 * s, h + 20 * s);
  ctx.lineWidth = Math.max(1, 4 * s); ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
  // 中间一条绞索纹（两条交错的正弦线 + 交点小圆点）
  const mid = t / 2, amp = 8 * s, per = 34 * s;
  const sides = [
    [x - mid, y - mid, x + w + mid, y - mid], [x + w + mid, y - mid, x + w + mid, y + h + mid],
    [x + w + mid, y + h + mid, x - mid, y + h + mid], [x - mid, y + h + mid, x - mid, y - mid],
  ];
  ctx.lineWidth = Math.max(0.6, 1.5 * s);
  for (const [ax, ay, bx2, by2] of sides) {
    const len = Math.hypot(bx2 - ax, by2 - ay), ux = (bx2 - ax) / len, uy = (by2 - ay) / len;
    const n = Math.max(2, Math.round(len / per));
    for (const ph of [0, Math.PI]) {
      ctx.beginPath();
      for (let i = 0; i <= n * 12; i++) {
        const d = (i / (n * 12)) * len, o = Math.sin((d / len) * n * TAU + ph) * amp;
        const px = ax + ux * d - uy * o, py = ay + uy * d + ux * o;
        i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.fillStyle = INK;
    for (let i = 1; i < n * 2; i++) { const d = (i / (n * 2)) * len; ctx.beginPath(); ctx.arc(ax + ux * d, ay + uy * d, Math.max(0.8, 2 * s), 0, TAU); ctx.fill(); }
  }
  // 四角：方块里一朵刻线玫瑰
  for (const [cx, cy] of [[x - mid, y - mid], [x + w + mid, y - mid], [x - mid, y + h + mid], [x + w + mid, y + h + mid]]) {
    const q = t * 0.42;
    ctx.fillStyle = PAPER_HI; ctx.fillRect(cx - q, cy - q, 2 * q, 2 * q);
    ctx.lineWidth = Math.max(0.8, 2 * s); ctx.strokeRect(cx - q, cy - q, 2 * q, 2 * q);
    ctx.lineWidth = Math.max(0.6, 1.2 * s);
    for (let p = 0; p < 8; p++) {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate((p / 8) * TAU);
      ctx.beginPath(); ctx.ellipse(0, -q * 0.45, q * 0.16, q * 0.36, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(cx, cy, q * 0.18, 0, TAU); ctx.fill();
  }
  // 内沿上、左两边一道刻线阴影（书页压凹的感觉）
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = Math.max(0.5, 1 * s);
  for (let k = 0; k < 4; k++) {
    const o = (3 + k * 3.2) * s;
    ctx.globalAlpha = 1 - k * 0.22;
    ctx.beginPath(); ctx.moveTo(x, y + o); ctx.lineTo(x + w, y + o); ctx.moveTo(x + o, y); ctx.lineTo(x + o, y + h); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}
