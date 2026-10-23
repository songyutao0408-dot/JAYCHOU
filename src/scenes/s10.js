// 第 10 站 · 跨时代（The Era, 2010）·「雨下一整晚」· 傍晚蓝调时刻的城市雨街 · 透明水彩晕染
// 湿画法、边缘积色、纸纹透出；蓝调时刻也要透亮：天空从钴蓝渐到蓝紫和一抹暖橙余晖，大量留白和浅色。
// 构图（视差由远到近）：
//   0.04 天空：湿画法渐变 + 横向晕开的色带 + 回流花
//   0.25 远景楼群：边缘晕开、下半化进薄雾，零星暖黄亮窗
//   0.6  对街的店铺：立面、亮窗、遮阳篷、暖光橱窗、霓虹招牌（只有色块和光晕，不写字）、路灯、行道树
//   0.85 车道：湿沥青、车道线（车从这里驶过）
//   1    他走的人行道：湿路面、路缘、水洼
//   0.6  倒影层：霓虹、橱窗、路灯在湿路面上的彩色竖向倒影（跟着各自的物体平移）
//   1.2  雨：细而淡的斜雨丝 + 路面上的小水圈（每帧画）
// 人物：透明水彩（watercolor-cool）+ 暖白轮廓光（像路灯照出的边）；他撑一把珊瑚红的伞，伞跟着他走路时前面那只手。
// 梗：第 9 拍强拍一颗大雨点砸在伞上——雨水把颜料晕开：整幅画的颜色向下流淌、边缘化开，伞化成一滩颜色淌到他脚边；
//     第 10 拍颜色倒流回去、伞恢复原形；第 11–12 拍他站在雨里，伞上雨珠滚到伞骨尖、挂住、滴落。
// 第 5–8 拍一辆车从右往左驶过车道，车灯的倒影在湿路面上扫过；第 13–16 拍另一辆车往右开，尾灯拖出红色倒影。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { makeCanvas, memo, baked } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk, frameIndex, FIGURE_H, ANCHORS } from '../rig/walker.js';
import { registerStyle, watercolor } from '../rig/styles.js';
import {
  wash, skyWash, dab, glow, dryBrush, streak, wetRoad, blobPts, roughPoly,
  paperTooth, deckle, captureUnits, runDown, drawWcCard, drawWcFrame, wcDisc,
} from '../kit/watercolor.js';

const ST = stationByN(10);

// 人物：在 watercolor-cool 的基础上把暗部压深一档，蓝调背景前轮廓更清楚（画风不变，仍是透明水彩）
registerStyle('s10-wc', (I) => watercolor(I, ['#1c2a3d', '#3b5779', '#8aa5c2', '#e4ebf1'], 0.75));

// ---------- 调色板 ----------
const PAPER = '#f5f3ee';
const INK = '#27364a';                       // 标题、描线的深蓝
const SKY = [[0, '#56739f'], [0.22, '#7f9cc6'], [0.5, '#aab3da'], [0.78, '#dcbcca'], [1, '#f2c7a4']];
const FAR = ['#8d9bc3', '#9a9fc9', '#a3a9cf', '#8fa3c6'];
const FACADE = ['#7486b0', '#8a85b2', '#6f8aac', '#9a8eb6', '#b59a9c', '#7c93b4'];
const NEON = ['#f08a6a', '#e65f9a', '#5fc7d9', '#f2d16b'];
const WARM = '#ffe2a3', SHOP = '#fbe5b8', LAMP = '#fff1c8';
const UMB = '#e9654f', UMB_L = '#f59b7c', UMB_D = '#b8432f';
const HEAD = '#fff1c8', TAIL = '#ec5a62';

const P_SKY = 0.04, P_FAR = 0.25, P_MID = 0.6, P_STREET = 0.85, P_RAIN = 1.2;
const MID_BASE = 702, STREET_Y0 = 714, CURB_Y = 794, LANE_Y = 786;

// 梗的拍点
const T_DROP = GAG - 0.4;     // 大雨点开始落下
const T_MELT = GAG;           // 第 9 拍（第 3 小节强拍）：颜料晕开
const T_BACK = GAG + 1;       // 第 10 拍：倒流回去
const T_BEADS = GAG + 2;      // 第 11–12 拍：伞上雨珠滚落
const MELT_IN = 0.6, MELT_OUT = 0.65, UMB_IN = 0.65, UMB_OUT = 0.7;

/** 整幅画流淌的程度（0..1）。 */
function meltAmt(b) {
  if (b < T_MELT || b > T_BACK + MELT_OUT) return 0;
  const up = ease.out(clamp((b - T_MELT) / MELT_IN));
  const down = ease.inOut(clamp((b - T_BACK) / MELT_OUT));
  return up * (1 - down);
}
/** 伞化开的进度（0 = 伞，1 = 一滩颜色）。 */
function umbMelt(b) {
  if (b < T_MELT || b > T_BACK + UMB_OUT) return 0;
  const up = ease.inOut(clamp((b - T_MELT) / UMB_IN));
  const down = ease.inOut(clamp((b - T_BACK) / UMB_OUT));
  return Math.min(up, 1 - down);
}

// ---------- 几何：对街的店铺（层内坐标，确定性） ----------
const R0 = (...k) => rng('s10', ...k);
function midGeo(c9) {
  return memo(`s10-mid|${Math.round(c9)}`, () => {
    const [x0, x1] = [X_MIN - 520 * P_MID - 300, X_MAX + 2700 * P_MID + 300];
    const R = R0('mid');
    const blds = [];
    for (let x = x0; x < x1;) {
      const w = 230 + R() * 230, top = 150 + R() * 220;
      const neonKind = R();
      blds.push({
        x, w, top, color: FACADE[Math.floor(R() * FACADE.length)], seed: Math.floor(R() * 1000),
        awning: R() < 0.7 ? NEON[Math.floor(R() * 4)] : null,
        neon: neonKind < 0.32 ? 'bar' : neonKind < 0.62 ? 'blade' : neonKind < 0.82 ? 'disc' : null,
        neonColor: NEON[Math.floor(R() * 4)], lit: R(),
      });
      x += w + (R() < 0.3 ? 40 + R() * 90 : 4 + R() * 10);
    }
    // 路灯：一盏放在定格时他身后右侧（画面 x ≈ 540）
    const lamps = [];
    const lx0 = 540 + c9 * P_MID;
    for (let x = lx0 - 3 * 640; x < x1; x += 640) lamps.push({ x: x + (x === lx0 ? 0 : (hash2(Math.round(x), 3, 10) - 0.5) * 80) });
    const trees = [];
    for (const l of lamps) if (hash2(Math.round(l.x), 5, 10) < 0.7) trees.push({ x: l.x + 300 + (hash2(Math.round(l.x), 6, 10) - 0.5) * 80, h: 240 + hash2(Math.round(l.x), 7, 10) * 80, seed: Math.round(l.x) });
    return { blds, lamps, trees };
  });
}
function neonShape(B) {
  // 招牌的位置和形状（层内坐标）：横条挂在遮阳篷上方；竖条从立面伸出来；圆牌挂在墙角
  const { x, w } = B;
  if (B.neon === 'bar') return { kind: 'bar', x: x + w * 0.2, y: 440, w: w * 0.6, h: 42 };
  if (B.neon === 'blade') return { kind: 'blade', x: x + w - 46, y: Math.max(B.top + 40, 260), w: 34, h: 170 };
  if (B.neon === 'disc') return { kind: 'disc', x: x + w * 0.72, y: 455, w: 64, h: 64 };
  return null;
}
function neonPath(N) {
  const p = new Path2D();
  if (N.kind === 'disc') p.arc(N.x + N.w / 2, N.y + N.h / 2, N.w / 2, 0, Math.PI * 2);
  else p.roundRect(N.x, N.y, N.w, N.h, Math.min(N.w, N.h) * 0.35);
  return p;
}
const neonCenter = (N) => [N.x + N.w / 2, N.y + N.h / 2];

// ---------- 天空 ----------
function skyLayer() {
  return strip('s10-sky', P_SKY, (ctx, x0, x1) => {
    skyWash(ctx, x0, 0, x1, 730, SKY, { px: K, seed: 3, bands: 8, blooms: 4, grain: 0.18 });
    // 几片低垂的雨云：蓝紫色，湿边
    const R = R0('cloud');
    for (let i = 0; i < 9; i++) {
      const cx = x0 + R() * (x1 - x0), cy = 70 + R() * 260, rx = 140 + R() * 220;
      wash(ctx, blobPts(cx, cy, rx, rx * (0.2 + R() * 0.12), { seed: i + 3, rough: 0.28 }), { color: R() < 0.5 ? '#7f88b4' : '#9a93bd', color2: '#b9b4d6', alpha: 0.38, px: K, soft: 9, edge: 0.6, edgeW: 5, vary: 0.5, grain: 0.2, seed: 20 + i, blend: 'multiply' });
    }
  }, { y0: 0, y1: 730 });
}

// ---------- 远景楼群 ----------
function farLayer() {
  return strip('s10-far', P_FAR, (ctx, x0, x1) => {
    const R = R0('far');
    for (let x = x0 - 40; x < x1;) {
      const w = 90 + R() * 160, top = 200 + R() * 240;
      const pts = [[x, 712], [x, top + 14], [x + w * 0.1, top], [x + w * 0.9, top], [x + w, top + 10], [x + w, 712]];
      if (R() < 0.25) pts.splice(3, 0, [x + w * 0.45, top - 50 - R() * 50], [x + w * 0.55, top - 50 - R() * 50]); // 塔楼
      const col = FAR[Math.floor(R() * FAR.length)];
      wash(ctx, roughPoly(pts, { amp: 2, step: 10, seed: Math.round(x) }), { color: col, color2: '#cfc8e0', grad: [0, top, 0, 690], alpha: 0.7, px: K, soft: 2.2, edge: 0.8, edgeW: 3, vary: 0.45, grain: 0.25, seed: Math.round(x) % 97, blend: 'multiply' });
      // 零星亮窗
      const n = Math.floor(R() * 7);
      for (let k = 0; k < n; k++) dab(ctx, x + 12 + R() * (w - 24), top + 20 + R() * (560 - top), 3.2 + R() * 1.6, WARM, { alpha: 0.85, edge: 0.3, seed: k + Math.round(x), rough: 0.25 });
      x += w + R() * 30;
    }
    // 楼脚的薄雾
    wash(ctx, [[x0, 560], [x1, 560], [x1, 720], [x0, 720]], { color: '#e3dbe8', color2: '#efe4e6', alpha: 0.55, px: K, soft: 16, edge: 0, vary: 0.5, grain: 0, seed: 7 });
  }, { y0: 120, y1: 730 });
}

// ---------- 对街：店铺、霓虹、路灯、树 ----------
function midLayer(env) {
  const G = midGeo(env.camAt(GAG));
  return strip('s10-mid', P_MID, (ctx, x0, x1) => {
    // 对街人行道
    wash(ctx, [[x0, MID_BASE - 4], [x1, MID_BASE - 4], [x1, STREET_Y0 + 6], [x0, STREET_Y0 + 6]], { color: '#b4bcd6', alpha: 0.95, px: K, soft: 1, edge: 0.5, vary: 0.3, grain: 0.3, seed: 2 });
    for (const B of G.blds) {
      if (B.x + B.w < x0 - 50 || B.x > x1 + 50) continue;
      const { x, w, top } = B;
      const pts = [[x, MID_BASE], [x, top + 8], [x + 6, top], [x + w - 6, top], [x + w, top + 8], [x + w, MID_BASE]];
      wash(ctx, roughPoly(pts, { amp: 1.6, step: 9, seed: B.seed }), { color: B.color, color2: mix(B.color, '#d7cde0', 0.35), alpha: 0.88, px: K, soft: 1.2, edge: 1.0, edgeW: 3, vary: 0.4, grain: 0.35, blooms: B.seed % 3 === 0 ? 1 : 0, seed: B.seed });
      // 檐口
      dryBrush(ctx, [[x + 2, top + 14], [x + w - 2, top + 14]], { width: 3, color: mix(B.color, INK, 0.45), alpha: 0.55, passes: 2, dry: 0.4, seed: B.seed });
      // 楼上的窗：一部分亮着暖光
      const R = R0('win', B.seed);
      const cols = Math.max(2, Math.floor((w - 40) / 52)), gx = (w - 40) / cols;
      for (let y = top + 40; y < 450; y += 64) for (let c = 0; c < cols; c++) {
        const wx = x + 20 + c * gx + gx / 2 - 12, lit = R() < 0.3 + B.lit * 0.25;
        const wp = roughPoly([[wx, y], [wx + 24, y], [wx + 24, y + 32], [wx, y + 32]], { amp: 0.8, step: 6, seed: B.seed + c + y });
        ctx.beginPath(); wp.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.closePath();
        ctx.fillStyle = lit ? WARM : rgba(mix(B.color, INK, 0.3), 0.55); ctx.fill();
        ctx.strokeStyle = rgba(mix(B.color, INK, 0.5), 0.45); ctx.lineWidth = 1.2; ctx.stroke();
        if (lit) glow(ctx, wx + 12, y + 16, 34, '#ffd89a', 0.25);
      }
      // 橱窗：暖光
      const sx0 = x + 22, sx1 = x + w - 70;
      if (sx1 - sx0 > 60) {
        const sp = roughPoly([[sx0, 556], [sx1, 556], [sx1, 694], [sx0, 694]], { amp: 1.2, step: 8, seed: B.seed + 5 });
        wash(ctx, sp, { color: SHOP, color2: '#f6cf98', alpha: 0.98, px: K, soft: 1.5, edge: 0.6, edgeW: 3, edgeColor: '#c99a6a', vary: 0.3, grain: 0.2, seed: B.seed + 5 });
        // 店里的人影和货架：几块淡紫的色块
        const R2 = R0('shop', B.seed);
        for (let k = 0; k < 3; k++) {
          const px = sx0 + 20 + R2() * (sx1 - sx0 - 40);
          dab(ctx, px, 640 + R2() * 20, 16 + R2() * 10, '#b79fb8', { alpha: 0.45, ry: 40 + R2() * 14, edge: 0.4, seed: B.seed + k });
        }
        dryBrush(ctx, [[sx0, 556], [sx0, 694]], { width: 3, color: mix(B.color, INK, 0.4), alpha: 0.6, passes: 2, seed: B.seed + 6 });
        dryBrush(ctx, [[(sx0 + sx1) / 2, 556], [(sx0 + sx1) / 2, 694]], { width: 2.4, color: mix(B.color, INK, 0.4), alpha: 0.5, passes: 2, seed: B.seed + 7 });
        glow(ctx, (sx0 + sx1) / 2, 625, (sx1 - sx0) * 0.75, '#ffd7a0', 0.3);
        // 门
        wash(ctx, [[sx1 + 12, 570], [x + w - 16, 570], [x + w - 16, 700], [sx1 + 12, 700]], { color: mix(B.color, INK, 0.35), alpha: 0.7, px: K, soft: 1, edge: 0.7, vary: 0.3, grain: 0.3, seed: B.seed + 8 });
      }
      // 遮阳篷
      if (B.awning) {
        const ap = roughPoly([[x + 10, 512], [x + w - 10, 512], [x + w + 4, 552], [x - 4, 552]], { amp: 1.2, step: 8, seed: B.seed + 9 });
        wash(ctx, ap, { color: B.awning, color2: mix(B.awning, '#ffffff', 0.3), alpha: 0.85, px: K, soft: 1, edge: 1.1, edgeW: 3, vary: 0.35, grain: 0.3, seed: B.seed + 9 });
        // 篷边的扇贝
        for (let ax = x; ax < x + w; ax += 34) dab(ctx, ax + 17, 554, 15, B.awning, { alpha: 0.75, ry: 8, edge: 0.6, seed: ax, rough: 0.1 });
      }
      // 霓虹：色块 + 白芯 + 光晕（不写字）
      const N = neonShape(B);
      if (N) {
        const [cx, cy] = neonCenter(N);
        glow(ctx, cx, cy, Math.max(N.w, N.h) * 1.6 + 80, B.neonColor, 0.6);
        const p = neonPath(N);
        ctx.save();
        ctx.fillStyle = rgba(mix(B.neonColor, '#ffffff', 0.12), 0.92); ctx.fill(p);
        ctx.lineWidth = 5; ctx.strokeStyle = mix(B.neonColor, '#ffffff', 0.35); ctx.stroke(p);
        ctx.lineWidth = 2; ctx.strokeStyle = '#fffaf0'; ctx.stroke(p);
        // 招牌里的几何纹样（亮线），代替文字
        ctx.strokeStyle = '#fffaf0'; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
        ctx.beginPath();
        if (N.kind === 'bar') for (let k = 0; k < 4; k++) { const u = N.x + 18 + k * (N.w - 36) / 3; ctx.moveTo(u - 10, cy + 6); ctx.lineTo(u, cy - 8); ctx.lineTo(u + 10, cy + 6); }
        else if (N.kind === 'blade') for (let k = 0; k < 4; k++) { const v = N.y + 26 + k * (N.h - 52) / 3; ctx.moveTo(cx - 8, v); ctx.arc(cx, v, 8, Math.PI, Math.PI * 2); }
        else { ctx.moveTo(cx + 18, cy); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.moveTo(cx + 6, cy); ctx.arc(cx, cy, 6, 0, Math.PI * 2); }
        ctx.stroke();
        ctx.restore();
        if (N.kind === 'blade') dryBrush(ctx, [[N.x + N.w, N.y + 20], [x + w, N.y + 20]], { width: 3, color: INK, alpha: 0.6, passes: 1, seed: B.seed });
      }
    }
    // 行道树：几团湿笔
    for (const T of G.trees) {
      if (T.x < x0 - 200 || T.x > x1 + 200) continue;
      dryBrush(ctx, [[T.x, MID_BASE + 6], [T.x - 4, MID_BASE - T.h * 0.5], [T.x + 6, MID_BASE - T.h * 0.8]], { width: 9, color: '#5b5f7e', alpha: 0.8, passes: 3, dry: 0.25, seed: T.seed });
      const R = R0('tree', T.seed);
      for (let k = 0; k < 7; k++) {
        const cx = T.x + (R() - 0.5) * 170, cy = MID_BASE - T.h + (R() - 0.3) * 120, r = 50 + R() * 50;
        wash(ctx, blobPts(cx, cy, r, r * 0.8, { seed: T.seed + k, rough: 0.3 }), { color: ['#86aaa6', '#9cbcb0', '#7f9fb0', '#a9c4b4'][k % 4], alpha: 0.55, px: K, soft: 2.5, edge: 1.1, edgeW: 3, vary: 0.45, grain: 0.35, seed: T.seed + k, blend: 'multiply' });
      }
    }
    // 路灯
    for (const L of G.lamps) {
      if (L.x < x0 - 200 || L.x > x1 + 200) continue;
      const sd = Math.round(L.x);
      dryBrush(ctx, [[L.x, MID_BASE + 8], [L.x, 330], [L.x + 4, 300], [L.x + 34, 286]], { width: 7, color: '#3f4c6b', alpha: 0.85, passes: 3, dry: 0.2, seed: sd });
      dryBrush(ctx, [[L.x - 12, MID_BASE + 8], [L.x + 12, MID_BASE + 8]], { width: 8, color: '#3f4c6b', alpha: 0.8, passes: 2, seed: sd + 1 });
      wash(ctx, [[L.x + 18, 280], [L.x + 58, 280], [L.x + 50, 300], [L.x + 26, 300]], { color: '#46557a', alpha: 0.9, px: K, soft: 0.6, edge: 0.6, vary: 0.2, grain: 0.2, seed: sd });
      glow(ctx, L.x + 38, 310, 190, '#ffe2a6', 0.55);
      dab(ctx, L.x + 38, 304, 11, LAMP, { alpha: 1, ry: 6, edge: 0.2, seed: sd });
    }
  }, { y0: 60, y1: 730 });
}

// ---------- 车道 ----------
function streetLayer() {
  return strip('s10-street', P_STREET, (ctx, x0, x1) => {
    wetRoad(ctx, x0, x1, STREET_Y0, CURB_Y + 8, { top: '#8f9cbd', bottom: '#a4afcc', ripple: '#6f7ea3', lights: '#e6eaf3', px: K, seed: 11, density: 1.2 });
    // 车道线：纸白留出来的虚线
    for (let x = x0 - (x0 % 200); x < x1; x += 200) {
      dryBrush(ctx, [[x, 760], [x + 98, 760]], { width: 5, color: '#eef1f6', alpha: 0.85, passes: 2, dry: 0.3, seed: Math.round(x), wobble: 0.6 });
    }
  }, { y0: STREET_Y0 - 4, y1: CURB_Y + 10 });
}

// ---------- 他走的人行道 ----------
function roadLayer(env) {
  const c9 = env.camAt(GAG);
  return strip('s10-road', 1, (ctx, x0, x1) => {
    // 路缘石
    wash(ctx, [[x0, CURB_Y - 2], [x1, CURB_Y - 2], [x1, 808], [x0, 808]], { color: '#c6cbdc', color2: '#b4bbd2', alpha: 1, px: K, soft: 0.6, edge: 0.6, edgeW: 2, vary: 0.3, grain: 0.4, seed: 4 });
    dryBrush(ctx, [[x0, CURB_Y - 1], [x1, CURB_Y - 1]], { width: 2, color: '#6f7fa3', alpha: 0.6, passes: 2, dry: 0.3, seed: 5 });
    wetRoad(ctx, x0, x1, 806, 1000, { top: '#a7b3cf', bottom: '#c9cfe2', ripple: '#7c8bb0', lights: '#f0f2f8', px: K, seed: 12 });
    // 地砖缝：很淡的干笔
    const R = R0('tiles');
    for (let y of [846, 902, 968]) dryBrush(ctx, [[x0, y], [x1, y]], { width: 1.6, color: '#8090b2', alpha: 0.28, passes: 1, dry: 0.55, seed: y });
    for (let x = x0; x < x1; x += 150 + R() * 40) dryBrush(ctx, [[x, 810], [x - 40, 1000]], { width: 1.4, color: '#8090b2', alpha: 0.2, passes: 1, dry: 0.6, seed: Math.round(x) });
    // 水洼：映着天的浅色，边缘积色；定格处他脚边有一块大的
    const puddles = [];
    for (let x = x0 + 200; x < x1; x += 380 + R() * 420) puddles.push([x, 860 + R() * 110, 70 + R() * 90]);
    puddles.push([CHAR_X + 130 + c9, 842, 190]);
    for (const [px, py, r] of puddles) {
      wash(ctx, blobPts(px, py, r, r * 0.16, { seed: Math.round(px), rough: 0.22 }), { color: '#e4e4f0', color2: '#f2dccf', grad: [px - r, py, px + r, py], alpha: 0.75, px: K, soft: 1.2, edge: 1.0, edgeW: 3, edgeColor: '#8794b6', vary: 0.3, grain: 0.2, seed: Math.round(px) % 31 });
    }
  }, { y0: CURB_Y - 6, y1: 1000 });
}

// ---------- 倒影（跟着对街的物体平移，p = 0.6） ----------
function reflLayer(env) {
  const G = midGeo(env.camAt(GAG));
  return strip('s10-refl', P_MID, (ctx, x0, x1) => {
    // 楼的暗影：很淡的竖向晕染
    for (const B of G.blds) {
      if (B.x + B.w < x0 - 50 || B.x > x1 + 50) continue;
      wash(ctx, [[B.x + 6, STREET_Y0 + 2], [B.x + B.w - 6, STREET_Y0 + 2], [B.x + B.w - 30, 930], [B.x + 30, 930]], { color: B.color, color2: '#c3c8dc', alpha: 0.16, px: K, soft: 14, edge: 0, vary: 0.5, grain: 0, seed: B.seed });
    }
    for (const B of G.blds) {
      if (B.x + B.w < x0 - 50 || B.x > x1 + 50) continue;
      const sx0 = B.x + 22, sx1 = B.x + B.w - 70;
      if (sx1 - sx0 > 60) for (let k = 0; k < 2; k++) streak(ctx, lerp(sx0, sx1, 0.3 + k * 0.4), STREET_Y0 + 4, 985, { w: (sx1 - sx0) * 0.3, color: '#ffd99c', alpha: 0.42, seed: B.seed + k, wobble: 5, gap: 6, taper: 0.4 });
      const N = neonShape(B);
      if (N) streak(ctx, neonCenter(N)[0], STREET_Y0 + 2, 995, { w: Math.max(18, N.w * 0.7), color: B.neonColor, alpha: 0.8, seed: B.seed + 9, wobble: 7, gap: 6, taper: 0.6, fade: 0.7 });
    }
    for (const L of G.lamps) streak(ctx, L.x + 38, STREET_Y0 + 2, 990, { w: 22, color: LAMP, alpha: 0.85, seed: Math.round(L.x), wobble: 5, gap: 5, taper: 0.8, fade: 0.75 });
  }, { y0: STREET_Y0 - 2, y1: 1000 });
}

// ---------- 车 ----------
const CAR_L = 560;
function carImage(color) {
  // 车头朝左（x = 0 是车头，y = 0 是地面），水彩烘焙
  const pad = 30, w = (CAR_L + pad * 2) * K, h = (220 + pad) * K;
  return baked(`s10-car|${color}`, w, h, (ctx) => {
    ctx.scale(K, K); ctx.translate(pad, 210);
    const body = roughPoly([[10, -36], [0, -66], [8, -96], [120, -112], [186, -168], [232, -188], [382, -188], [442, -158], [520, -120], [556, -106], [560, -62], [552, -36]], { amp: 1.2, step: 10, seed: 3 });
    wash(ctx, body, { color, color2: mix(color, '#2d3a5c', 0.3), alpha: 0.95, px: K, soft: 1, edge: 1.1, edgeW: 3, vary: 0.4, grain: 0.35, lift: 0.5, seed: 5 });
    for (const win of [[[196, -160], [238, -180], [302, -180], [302, -120], [162, -120]], [[314, -180], [378, -180], [428, -150], [432, -120], [314, -120]]]) {
      wash(ctx, roughPoly(win, { amp: 0.8, step: 8, seed: 7 }), { color: '#cfd6ea', color2: '#a9b4d2', alpha: 0.95, px: K, soft: 0.8, edge: 0.8, edgeW: 2, vary: 0.4, grain: 0.3, seed: 8 });
    }
    dryBrush(ctx, [[300, -118], [300, -50]], { width: 2, color: mix(color, INK, 0.5), alpha: 0.6, passes: 1, seed: 9 });
    dryBrush(ctx, [[60, -70], [540, -70]], { width: 1.6, color: mix(color, '#ffffff', 0.4), alpha: 0.5, passes: 1, seed: 10 });
    for (const wx of [118, 444]) {
      wash(ctx, blobPts(wx, -40, 44, 44, { seed: wx, rough: 0.05, n: 28 }), { color: '#3c4766', alpha: 0.95, px: K, soft: 0.6, edge: 0.6, vary: 0.2, grain: 0.3, seed: wx });
      dab(ctx, wx, -40, 18, '#9aa6c4', { alpha: 0.9, edge: 0.5, seed: wx + 1, rough: 0.05 });
    }
    dab(ctx, 8, -84, 10, HEAD, { alpha: 1, ry: 7, edge: 0.4, seed: 1 });
    dab(ctx, 552, -96, 8, TAIL, { alpha: 1, ry: 10, edge: 0.4, seed: 2 });
  });
}
/** 画一辆车：x 车头（画面单位），dir = -1 向左开（车头朝左），+1 向右开。 */
function drawCar(ctx, x, dir, color) {
  const img = carImage(color), pad = 30;
  const w = img.width / K, h = img.height / K;
  ctx.save();
  ctx.translate(x, LANE_Y);
  if (dir > 0) ctx.scale(-1, 1);
  // 车底下的湿影
  ctx.fillStyle = 'rgba(60,72,110,0.25)';
  ctx.beginPath(); ctx.ellipse(CAR_L / 2, 4, CAR_L * 0.55, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, -pad, -210, w, h);
  // 车灯光柱
  const g = ctx.createLinearGradient(0, 0, -520, 0);
  g.addColorStop(0, rgba(HEAD, 0.55)); g.addColorStop(1, rgba(HEAD, 0));
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(4, -90); ctx.lineTo(-520, -170); ctx.lineTo(-520, 10); ctx.lineTo(4, -76); ctx.closePath(); ctx.fill();
  ctx.restore();
  // 倒影：车灯和尾灯在湿路面上拖出竖向色带（画面坐标，不翻转）
  const head = dir < 0 ? x + 8 : x - 8, tail = dir < 0 ? x + 552 : x - 552;
  streak(ctx, head, LANE_Y + 2, 1000, { w: 30, color: HEAD, alpha: 0.95, seed: 31, wobble: 6, gap: 5, taper: 0.9, fade: 0.6 });
  streak(ctx, tail, LANE_Y + 2, 960, { w: 22, color: TAIL, alpha: 0.75, seed: 32, wobble: 5, gap: 5, taper: 0.7, fade: 0.75 });
  glow(ctx, head + dir * 200, 880, 260, HEAD, 0.28);
}
const CARS = [
  { from: 3.9, to: 8.0, x0: X_MAX + 80, x1: X_MIN - 680, dir: -1, color: '#3f7b93' },
  { from: 12.3, to: 16.5, x0: X_MIN - 80, x1: X_MAX + 680, dir: 1, color: '#c9894f' },
];

// ---------- 雨（每帧） ----------
function drawRain(ctx, b, cam, k = 1) {
  const span = X_MAX - X_MIN + 200;
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < 190 * k; i++) {
    const sp = 1100 + hash2(i, 1, 10) * 600, len = 26 + hash2(i, 2, 10) * 40;
    const y = ((hash2(i, 3, 10) * 1200 + b * sp) % 1200) - 120;
    const x = ((((hash2(i, 4, 10) * span - cam * P_RAIN + y * 0.18) % span) + span) % span) + X_MIN - 100;
    const light = i % 3 !== 0;
    ctx.strokeStyle = light ? 'rgba(248,250,255,0.42)' : 'rgba(70,92,132,0.24)';
    ctx.lineWidth = light ? 1.5 : 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.18, y + len); ctx.stroke();
  }
  // 路面上的小水圈（跟着路面平移）
  for (let i = 0; i < 36; i++) {
    const ph = (((b * 1.3 + hash2(i, 5, 10)) % 1) + 1) % 1, cyc = Math.floor(b * 1.3 + hash2(i, 5, 10));
    const wx = hash2(i, cyc, 11) * span, y = 812 + hash2(i, cyc, 12) * 180;
    const x = ((((wx - cam) % span) + span) % span) + X_MIN - 100;
    const s1 = 0.5 + (y - 800) / 220;
    ctx.strokeStyle = `rgba(240,244,250,${(0.55 * (1 - ph)).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(x, y, 4 + ph * 18 * s1, (1.5 + ph * 4) * s1, 0, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 伞 ----------
const UR = 178, UH = 100;          // 伞面半宽、拱高（伞的局部坐标：伞顶在原点，伞杆朝 +y）
const APEX_Y = -640;               // 伞顶高度（人物局部坐标）
const STAND_HAND = ANCHORS.stand.handR;
const STAND_APEX = [20, APEX_Y + 6];
/** 伞面轮廓（局部坐标）：上沿拱形从左到右，再沿扇贝形的下摆从右回到左。共 72 点。 */
function canopyPts() {
  return memo('s10-canopy-pts', () => {
    const top = [], hem = [];
    for (let i = 0; i <= 36; i++) { const t = -1 + (2 * i) / 36; top.push([UR * t, UH * (1 - Math.pow(1 - t * t, 0.62))]); }
    const tipY = (t) => UH + 14 * (1 - t * t);
    for (let i = 1; i < 36; i++) {
      const t = 1 - (2 * i) / 36;             // 1 → -1
      const seg = (t + 1) / 0.5, f = seg - Math.floor(seg);   // 每 0.5 一片伞面
      const y = tipY(t) - 14 * Math.sin(Math.PI * f);
      hem.push([UR * t * 0.985, y]);
    }
    return [...top, ...hem];
  });
}
const TIPS = [-1, -0.5, 0, 0.5, 1].map((t) => [UR * t, UH + 14 * (1 - t * t)]);
/** 伞面烘焙图（局部坐标，伞顶在图上 (pad, pad+top)）。 */
function canopyImage() {
  const pad = 40, x0 = -UR - pad, y0 = -40 - pad, w = (2 * UR + 2 * pad) * K, h = (UH + 60 + 2 * pad) * K;
  const img = baked('s10-canopy', w, h, (ctx) => {
    ctx.scale(K, K); ctx.translate(-x0, -y0);
    const P = canopyPts();
    wash(ctx, P, { color: UMB_L, color2: UMB, grad: [-UR, -10, UR * 0.6, UH], alpha: 0.97, px: K, soft: 0.8, edge: 1.3, edgeW: 3, edgeColor: UMB_D, vary: 0.4, grain: 0.3, lift: 0.35, seed: 61 });
    // 相间的伞面：再罩一层（叠色）
    for (const [a, b2] of [[0, 1], [2, 3]]) {
      const tA = TIPS[a], tB = TIPS[b2];
      const panel = [[0, 0], ...canopyPts().slice(0, 37).filter(([x]) => x >= tA[0] && x <= tB[0]), tB, [lerp(tA[0], tB[0], 0.5), Math.max(tA[1], tB[1]) - 12], tA];
      wash(ctx, panel, { color: UMB, alpha: 0.38, px: K, soft: 1.5, edge: 0.6, edgeW: 2, edgeColor: UMB_D, vary: 0.5, grain: 0.2, seed: 70 + a, blend: 'multiply' });
    }
    for (const [tx, ty] of TIPS) dryBrush(ctx, [[0, 2], [tx * 0.55, ty * 0.45 - 4], [tx, ty]], { width: 1.8, color: '#9b3a2e', alpha: 0.6, passes: 2, dry: 0.3, seed: 80 + Math.round(tx), wobble: 0.6 });
    dryBrush(ctx, [[0, 4], [0, -24]], { width: 4, color: '#3b3346', alpha: 0.9, passes: 2, dry: 0.1, seed: 90 });
  });
  return { img, x0, y0, w: w / K, h: h / K };
}

/** 走路帧里「前面那只手」的位置（人物局部坐标）：在手的高度带里找最靠前的不透明像素，前后帧平滑。 */
function handTrack() {
  const W = activeWalk();
  if (!W) return null;
  return memo(`s10-hand|${W.name}`, () => {
    const m = W.meta, sc = FIGURE_H / m.personHeight;
    const raw = W.frames.map((im) => {
      if (!im) return [...ANCHORS.walk.hand];
      const c = makeCanvas(m.width, m.height), g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(im, 0, 0);
      const ya = Math.round(m.baseY - 300 / sc), yb = Math.round(m.baseY - 205 / sc);
      const d = g.getImageData(0, ya, m.width, yb - ya).data;
      let bx = -1, by = 0;
      for (let y = 0; y < yb - ya; y++) for (let x = m.width - 1; x > bx; x--) if (d[(y * m.width + x) * 4 + 3] > 140) { bx = x; by = y; break; }
      if (bx < 0) return [...ANCHORS.walk.hand];
      return [(bx - 6 - m.anchorX) * sc, (by + ya + 8 - m.baseY) * sc];
    });
    const n = raw.length;
    return raw.map((_, i) => {
      let sx = 0, sy = 0, sw = 0;
      for (let k = -2; k <= 2; k++) { const p = raw[(i + k + n) % n], wt = 3 - Math.abs(k); sx += p[0] * wt; sy += p[1] * wt; sw += wt; }
      return [sx / sw, sy / sw];
    });
  });
}
/** 伞的姿态（人物局部坐标）：手、伞顶、伞面转角。 */
function umbrellaPose(fig) {
  if (fig.pose === 'stand') {
    const [hx, hy] = STAND_HAND, [ax, ay] = STAND_APEX;
    return { hand: [hx, hy], apex: [ax, ay], ang: Math.atan2(-(hx - ax), hy - ay) };
  }
  const tr = handTrack();
  const [hx, hy] = tr ? tr[frameIndex(fig.phase || 0)] : ANCHORS.walk.hand;
  const ax = 6 + (hx - 30) * 0.3, ay = APEX_Y + (hy + 250) * 0.25;
  return { hand: [hx, hy], apex: [ax, ay], ang: Math.atan2(-(hx - ax), hy - ay) };
}
const rotP = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

function drawShaft(ctx, hand, apex, alpha = 1) {
  if (alpha <= 0.01) return;
  const [hx, hy] = hand, [ax, ay] = apex;
  const dx = hx - ax, dy = hy - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3b3346'; ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx + ux * 22, hy + uy * 22); ctx.stroke();
  // J 形伞柄（木色）
  ctx.strokeStyle = '#8a5a3c'; ctx.lineWidth = 8;
  const ex = hx + ux * 22, ey = hy + uy * 22;
  ctx.beginPath(); ctx.moveTo(hx - ux * 14, hy - uy * 14); ctx.lineTo(ex, ey);
  ctx.quadraticCurveTo(ex + ux * 22, ey + uy * 22, ex - uy * 18 + ux * 10, ey + ux * 18 + uy * 10);
  ctx.stroke();
  ctx.restore();
}
function drawCanopy(ctx, apex, ang, alpha = 1) {
  const C = canopyImage();
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(apex[0], apex[1]);
  ctx.rotate(ang);
  ctx.drawImage(C.img, C.x0, C.y0, C.w, C.h);
  ctx.restore();
}

// ---------- 伞化开：形状 → 往下淌的颜料 → 一滩水（插值多边形，按进度烘焙成 24 张） ----------
const MELT_STEPS = 24;
const STREAM_X = 135;     // 颜料往下淌时那股细流的位置（人物局部 x）
function meltShapes() {
  return memo('s10-melt-shapes', () => {
    const { apex, ang } = umbrellaPose({ pose: 'stand' });
    const S0 = canopyPts().map((p) => { const [x, y] = rotP(p, ang); return [x + apex[0], y + apex[1]]; });
    const n = S0.length, ys = S0.map((p) => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const S1 = S0.map(([x, y], i) => {
      const hem = i > 36, hsh = hash2(i, 1, 51);
      const sag = hem ? 70 + 300 * Math.pow(hsh, 2.2) : 40 + 40 * hsh;
      return [x * 1.06 + 2, y + sag];
    });
    const S2 = S0.map((_, i) => {
      const th = i <= 36 ? Math.PI + Math.PI * (i / 36) : Math.PI * ((i - 36) / (n - 36));
      const r = 1 + (noise2(Math.cos(th) * 2, Math.sin(th) * 2, 52) - 0.5) * 0.25;
      return [130 + Math.cos(th) * 205 * r, 10 + Math.sin(th) * 22 * r];
    });
    const H = S0.map(([, y]) => (y - y0) / (y1 - y0 || 1)); // 0 = 伞顶，1 = 下摆
    return { S0, S1, S2, H };
  });
}
function meltPts(u) {
  const { S0, S1, S2, H } = meltShapes();
  const p1 = ease.inOut(clamp(u / 0.4));
  return S0.map((a, i) => {
    const b1 = S1[i];
    const x = lerp(a[0], b1[0], p1), y = lerp(a[1], b1[1], p1);
    const t2 = clamp((u - 0.3 - (1 - H[i]) * 0.25) / 0.45);
    const e = t2 * t2 * (3 - 2 * t2);
    // 往下淌的时候收成一股细流（贴着他身侧），落地再摊开成一滩
    const xx = lerp(x, S2[i][0], e), squeeze = Math.pow(Math.sin(Math.PI * e), 0.6) * 0.92;
    return [lerp(xx, STREAM_X + (xx - STREAM_X) * 0.1, squeeze), lerp(y, S2[i][1], e)];
  });
}
function meltImage(k) {
  const P0 = meltPts(k / (MELT_STEPS - 1)), { apex } = umbrellaPose({ pose: 'stand' });
  const x0 = Math.min(...P0.map((p) => p[0]), STAND_HAND[0]) - 30, x1 = Math.max(...P0.map((p) => p[0]), STAND_HAND[0]) + 30;
  const y0 = Math.min(...P0.map((p) => p[1]), apex[1]) - 30, y1 = Math.min(60, Math.max(...P0.map((p) => p[1]), STAND_HAND[1]) + 230);
  const img = baked(`s10-melt|${k}`, (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
    ctx.scale(K, K); ctx.translate(-x0, -y0);
    const u = k / (MELT_STEPS - 1);
    const P = meltPts(u);
    wash(ctx, P, { color: UMB_L, color2: UMB, alpha: 0.95, px: K, soft: 1 + u * 3, edge: 1.4, edgeW: 3 + u * 3, edgeColor: UMB_D, vary: 0.45, grain: 0.3, blooms: u > 0.3 ? 2 : 0, seed: 100 + k });
    // 往下滴的细流：从形状的下沿垂下来
    if (u > 0.05 && u < 0.9) {
      ctx.save();
      ctx.lineCap = 'round';
      for (let i = 38; i < P.length; i += 5) {
        const len = (40 + 160 * hash2(i, 2, 53)) * Math.sin(Math.PI * clamp((u - 0.05) / 0.85));
        const [px, py] = P[i];
        const end = Math.min(py + len, 4);
        if (end <= py) continue;
        ctx.strokeStyle = rgba(UMB, 0.75); ctx.lineWidth = 3 + 4 * hash2(i, 3, 53);
        ctx.beginPath(); ctx.moveTo(px, py - 4); ctx.lineTo(px + 1, end); ctx.stroke();
        ctx.fillStyle = rgba(UMB_D, 0.8); ctx.beginPath(); ctx.arc(px + 1, end, ctx.lineWidth * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // 伞杆也一起化掉：从上往下缩短、变淡
    const { apex } = umbrellaPose({ pose: 'stand' });
    const top = [lerp(apex[0], STAND_HAND[0], clamp(u * 1.4)), lerp(apex[1], STAND_HAND[1], clamp(u * 1.4))];
    drawShaft(ctx, STAND_HAND, top, 1 - smoothstep(0.2, 0.65, u));
  });
  return { img, x0, y0, w: x1 - x0, h: y1 - y0 };
}

/** 画伞（人物局部坐标，已经包含人物的位置和缩放）。part：'back'（贴地的部分，画在人物前面之前）| 'front'。 */
function drawUmbrella(ctx, fig, b, part) {
  const u = umbMelt(b);
  if (u > 0.001 && fig.pose === 'stand') {
    const k = Math.round(u * (MELT_STEPS - 1));
    // 还在上面往下淌时画在他前面；淌到地上以后画在他脚后（一滩颜色在他身后摊开）
    if ((part === 'front') === (u < 0.62)) { const M = meltImage(k); ctx.drawImage(M.img, M.x0, M.y0, M.w, M.h); }
    if (part === 'front' && u < 0.18) { const P = umbrellaPose(fig); drawCanopy(ctx, P.apex, P.ang, 1 - u / 0.18); }
    return;
  }
  if (part !== 'front') return;
  const P = umbrellaPose(fig);
  drawShaft(ctx, P.hand, P.apex);
  drawCanopy(ctx, P.apex, P.ang);
  drawUmbrellaRain(ctx, fig, b, P);
}
/** 伞上的雨：走路时雨点在伞面溅开、伞尖滴水；第 11–12 拍雨珠沿伞面滚到伞尖、挂住、滴落。 */
function drawUmbrellaRain(ctx, fig, b, P) {
  const toFig = (p) => { const [x, y] = rotP(p, P.ang); return [x + P.apex[0], y + P.apex[1]]; };
  ctx.save();
  ctx.lineCap = 'round';
  // 溅开的小雨点
  for (let i = 0; i < 6; i++) {
    const ph = (((b * 3 + hash2(i, 1, 60)) % 1) + 1) % 1, cyc = Math.floor(b * 3 + hash2(i, 1, 60));
    const t = (hash2(i, cyc, 61) - 0.5) * 1.8;
    const [x, y] = toFig([UR * t, UH * (1 - Math.pow(1 - t * t, 0.62)) - 3]);
    ctx.strokeStyle = `rgba(250,250,255,${(0.8 * (1 - ph)).toFixed(3)})`; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, 3 + ph * 10, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  }
  const drop = (x, y, r, a = 1) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(214,228,246,0.9)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(52,74,112,0.75)'; ctx.lineWidth = 1.3; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.32, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  };
  if (fig.pose === 'stand' && b >= T_BEADS - 0.1 && b < T_BEADS + 2.2) {
    // 第 11–12 拍：五颗雨珠，依次从伞顶附近滚到伞尖
    const tips = [4, 0, 3, 1, 4];
    for (let k = 0; k < 5; k++) {
      const s0 = T_BEADS + k * 0.36, tt = b - s0;
      if (tt < 0) continue;
      const tip = TIPS[tips[k]], start = [tip[0] * 0.12, UH * 0.05 + 2];
      const roll = clamp(tt / 0.5), hang = tt - 0.5, r = 4.5 + k % 2;
      if (roll < 1) {
        const e = roll * roll;
        const lx = lerp(start[0], tip[0], e);
        const t = lx / UR, ly = Math.abs(tip[0]) > UR * 0.9 ? UH * (1 - Math.pow(1 - Math.min(1, t * t), 0.62)) : lerp(start[1], tip[1], e);
        const [x, y] = toFig([lx, ly - 4]);
        drop(x, y, r);
      } else if (hang < 0.28) {
        const [x, y] = toFig([tip[0], tip[1] + 3 + hang * 14]);
        drop(x, y, r * (1 + hang * 1.2));
      } else {
        const ft = (hang - 0.28) / 0.32;
        const [x, y0] = toFig([tip[0], tip[1] + 7]);
        const y = y0 + ft * ft * (-y0);
        if (ft < 1) { ctx.strokeStyle = 'rgba(214,228,246,0.9)'; ctx.lineWidth = r * 1.2; ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x, y); ctx.stroke(); drop(x, y, r * 0.8); }
        else if (ft < 1.8) { const sp = (ft - 1) / 0.8; ctx.strokeStyle = `rgba(240,244,250,${(0.9 * (1 - sp)).toFixed(3)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, 0, 6 + sp * 22, 2 + sp * 4, 0, 0, Math.PI * 2); ctx.stroke(); }
      }
    }
  } else if (fig.pose !== 'stand') {
    // 走路时：每拍后沿伞尖滴下一滴，留在原地（世界里不动，所以相对他向后退）
    const b0 = Math.floor(b), tt = b - b0;
    if (tt < 0.5) {
      const tip = TIPS[hash2(b0, 1, 62) < 0.5 ? 0 : 1];
      const [x, y0] = toFig([tip[0], tip[1] + 6]);
      const y = y0 + (tt / 0.5) ** 2 * (-y0);
      ctx.strokeStyle = 'rgba(214,228,246,0.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x - tt * 150, y - 10); ctx.lineTo(x - tt * 150, y); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 人物和他的倒影 ----------
let reflCanvas = null;
function drawReflection(ctx, fig, b) {
  const RX0 = -260, RX1 = 360, RH = 200;
  const w = Math.ceil((RX1 - RX0) * K), h = Math.ceil(RH * K);
  if (!reflCanvas) reflCanvas = makeCanvas(w, h);
  const g = reflCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.clearRect(0, 0, w, h);
  g.setTransform(K, 0, 0, -K, -RX0 * K, 0);
  drawWalker(g, { ...fig, rim: null });
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  // 水纹：一条条横带左右错开
  const band = 6;
  for (let y = 0; y < h; y += band) {
    const dx = Math.sin(y * 0.21 + b * 5) * (1.5 + (y / h) * 5);
    ctx.drawImage(reflCanvas, 0, y, w, band, RX0 + dx, 4 + y / K, w / K, band / K);
  }
}

// ---------- 大雨点（第 9 拍强拍砸在伞上） ----------
function drawBigDrop(ctx, b, env) {
  if (b < T_DROP || b > T_MELT + 0.45) return;
  const fig = env.figure();
  const [ax, ay] = STAND_APEX;
  const tx = fig.x + ax * fig.scale, ty = fig.y + (ay - 6) * fig.scale;
  ctx.save();
  if (b < T_MELT) {
    const t = (b - T_DROP) / (T_MELT - T_DROP);
    const y = lerp(-60, ty, t * t), x = tx + (1 - t) * 30;
    ctx.fillStyle = 'rgba(200,218,242,0.95)'; ctx.strokeStyle = 'rgba(40,62,104,0.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.quadraticCurveTo(x + 12, y - 4, x, y + 6); ctx.quadraticCurveTo(x - 12, y - 4, x, y - 34); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 6, 2.6, 0, Math.PI * 2); ctx.fill();
  } else {
    const t = (b - T_MELT) / 0.45;
    ctx.strokeStyle = `rgba(235,242,252,${(0.95 * (1 - t)).toFixed(3)})`; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(tx, ty, 10 + t * 70, 4 + t * 16, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = `rgba(214,228,246,${(1 - t).toFixed(3)})`;
    for (let k = 0; k < 9; k++) {
      const a = Math.PI * (1.05 + (k / 8) * 0.9), d = 20 + t * 90;
      ctx.beginPath(); ctx.arc(tx + Math.cos(a) * d, ty + Math.sin(a) * d * 0.7 + t * t * 60, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

// ---------- 背景整体（流淌时先画进离屏，再按列向下拖） ----------
function paintBack(ctx, b, env) {
  const cam = env.cam;
  drawStrip(ctx, skyLayer(), cam);
  drawStrip(ctx, farLayer(), cam);
  drawStrip(ctx, midLayer(env), cam);
  // 霓虹随拍子轻轻一亮
  const G = midGeo(env.camAt(GAG));
  const beatK = Math.exp(-(((b % 1) + 1) % 1) * 4);
  for (const B of G.blds) {
    const N = neonShape(B);
    if (!N) continue;
    const [cx, cy] = neonCenter(N), sx = cx - cam * P_MID;
    if (sx < X_MIN - 200 || sx > X_MAX + 200) continue;
    glow(ctx, sx, cy, Math.max(N.w, N.h) + 70, B.neonColor, 0.12 + 0.18 * beatK);
  }
  drawStrip(ctx, streetLayer(), cam);
  drawStrip(ctx, roadLayer(env), cam);
  drawStrip(ctx, reflLayer(env), cam);
  for (const C of CARS) {
    if (b < C.from || b > C.to) continue;
    const t = (b - C.from) / (C.to - C.from);
    drawCar(ctx, lerp(C.x0, C.x1, t), C.dir, C.color);
  }
}

export const s10 = {
  id: 's10',
  station: ST,
  figureStyle: 's10-wc',
  // 蓝调背景前黑衣容易贴色：暖白轮廓光（像路灯照出来的边，也像水彩里留出的纸白）
  figureRim: { color: '#fff3dc', width: 5, alpha: 1 },
  freezeBeat: GAG + 3, // Outro 展墙：伞已复原，雨珠正从伞尖滴落
  drawFigure(ctx, fig, b, env) {
    if (fig.pose === 'walk' || fig.pose === 'stand') drawReflection(ctx, fig, b);
    drawUmbrella(ctx, fig, b, 'back');
    // 流淌时，他身上的颜色也往下淌一点
    const m = meltAmt(b);
    if (m > 0.01) {
      ctx.save();
      for (let k = 1; k <= 1; k++) { ctx.globalAlpha = 0.28 * m; ctx.save(); ctx.translate(0, 26 * m); drawWalker(ctx, { ...fig, rim: null }); ctx.restore(); }
      ctx.restore();
    }
    drawWalker(ctx, fig);
    drawUmbrella(ctx, fig, b, 'front');
  },
  drawBack(ctx, b, env) {
    const m = meltAmt(b);
    if (m < 0.002) { paintBack(ctx, b, env); return; }
    const S = captureUnits('s10', (g) => paintBack(g, b, env), 0.5);
    runDown(ctx, S, { x: X_MIN, y: 0, w: X_MAX - X_MIN, h: 1000 }, m, { run: 0.24, seed: 7, paper: PAPER, copies: 4 });

  },
  drawFront(ctx, b, env) {
    drawBigDrop(ctx, b, env);
    drawRain(ctx, b, env.cam);
    // 纸纹透出 + 四周毛边留白（固定在画面上，不随镜头平移）
    const pw = Math.round((X_MAX - X_MIN) * K), ph = Math.round(1000 * K);
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(paperTooth(pw, ph, { seed: 7, amount: 0.9 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    ctx.restore();
    ctx.drawImage(deckle(pw, ph, { color: PAPER, seed: 9, sides: { top: 0, right: 22, bottom: 40, left: 22 } }), X_MIN, 0, X_MAX - X_MIN, 1000);
  },
  drawFrame(ctx, R) {
    drawWcFrame(ctx, R, { paper: '#f7f5f0', colors: ['#8fb0d8', '#c7b3dc', '#f2c3a6', '#9fd0d8'], seed: 21 });
  },
  cardStyle: {
    ink: INK, accent: '#c4553b', bar: false,
    bgDraw(ctx, x, y, w, h) { drawWcCard(ctx, x, y, w, h, { paper: '#fbfaf6', color: '#6f97c8', color2: '#e3a3bd', seed: 3, inset: 34 }); },
  },
  playerStyle: {
    ink: INK, noteColor: '#c4553b', backdrop: false,
    plateDraw(ctx, x, y, w, h) { drawWcCard(ctx, x, y, w, h, { paper: '#fbfaf6', color: '#6f97c8', seed: 5, inset: 20 }); },
    drawPlayer(ctx, kind, cx, cy, sc, spin) {
      const r = 78;
      const D = wcDisc(r, { colors: ['#7fa8d8', '#e58fb0', '#f2d16b', '#6fc7d6'], paper: '#fbfaf6', ink: INK, seed: 31 });
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(sc, sc);
      ctx.fillStyle = 'rgba(40,55,90,0.16)'; ctx.beginPath(); ctx.ellipse(4, 8, r, r, 0, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(spin);
      ctx.drawImage(D, -D.width / 2, -D.height / 2);
      ctx.restore();
    },
  },
};
