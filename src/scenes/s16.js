// 第 16 站 · 太阳之子（Children of the Sun, 2026）·「那天下雨了」· 白天阵雨里的城市街边公交站台 · 电影感厚涂插画
// 全片最后一站，也是最精致的一张。白天的阵雨：明亮的浅灰天空、柔和均匀的光、空气透视；大笔触色块 + 鬃毛笔痕。
// 和第 10 站（傍晚蓝调、透明水彩、霓虹倒影）拉开：这里是白天、厚涂、冷灰调里只有两把伞是最亮的颜色。
// 构图（视差由远到近）：
//   0.03 天空：浅灰云层，右上方透出更亮的天光（太阳在云后）
//   0.18 远景楼群：空气透视，越远越浅越冷；楼脚化进雨雾
//   0.35 中远景：中高层楼，窗格反着天光
//   0.6  对街：店面、雨棚、行道树、红绿灯杆、远处撑伞的行人
//   0.85 车道：湿沥青、车道线、路边积水；对街在湿路面上的倒影（0.6）
//   1    站台：玻璃顶棚的候车亭（金属框、玻璃上的水珠和水流痕）、长椅、灯箱、无字的线路牌；湿人行道映出站台、行人和天空
//   每帧：公交车、女主角、两把伞、水花、三层雨丝、地上的雨圈、顶棚滴水、玻璃上的水流、体积光、画布纹理
// 男女主角：他（绿幕帧序列，cinematic 画风）撑明黄的伞；她（原创厚涂造型：米色风衣、灰绿百褶裙、短靴、齐肩深棕发）撑珊瑚红的伞。
// 梗：第 5–8 拍公交车从远处开来、越来越大，并向路边靠；第 9 拍强拍车轮压过路边积水，溅起一大片水花，两把伞以手为轴同时歪 −18°，
//     之后 1.5 拍弹性回正；第 10–12 拍水花落下、涟漪扩散、车开走；第 13–16 拍他撑着伞走向结尾，雨渐小、云后透出阳光。
// 结尾接 Outro：Outro 前 8 拍第 16 格是活的（b 16–24）——镜头 1.5 拍内缓停，他在画面里再走几步，第 19 拍停下站定，
//     第 24 拍（Outro 第 3 小节强拍）定格，和展墙里的定格图完全一致。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { makeCanvas, memo, baked } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { hexToRgb } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, keyframes } from '../kit/math.js';
import { roundRect, smoothPath } from '../kit/shapes.js';
import { GAG, STATION, stationSection } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk, frameIndex, FIGURE_H, ANCHORS } from '../rig/walker.js';

const ST = stationByN(16);
const END = STATION.beats;              // 第 16 拍结束（段内拍位 16）
const SEC = () => stationSection(16);

// ---------- 调色板 ----------
const INK = '#2f3a44';                  // 标题卡、歌名的深灰
const UMB_HIM = '#f2c230', UMB_HER = '#e8553f';
const BUS = '#2f7fb8';
const P_SKY = 0.03, P_FAR = 0.18, P_MF = 0.35, P_MID = 0.6, P_ROAD = 0.85;
const MID_BASE = 702, ROAD_Y0 = 704, CURB_Y = 790;

// ---------- 布局（定格时的画面位置，单位） ----------
const HER_X = 748, HER_Y = 796;         // 她站在他右边，略靠后
const SH_X0 = -360, SH_X1 = 128;        // 候车亭（顶棚左右端）
const POLE_X = 1010;                    // 线路牌
const PUD0 = 130, PUD1 = 604;           // 路边积水（车轮压过的地方）

// ---------- 颜色工具（烘焙时用） ----------
const C = (h) => hexToRgb(h);
const css = (c, a = 1) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const WHITE = [255, 255, 255], DEEP = [24, 30, 38];
const tone = (c, t) => (t >= 0 ? mixC(c, WHITE, t) : mixC(c, DEEP, -t));
const jit = (c, R, amt = 0.05) => {
  const t = (R() - 0.5) * 2 * amt, k = (R() - 0.5) * amt * 50;
  return tone([c[0] + k, c[1] + k * 0.2, c[2] - k * 0.5], t);
};
const R0 = (...k) => rng('s16', ...k);

/** 一笔厚涂：中心 (x, y)，长 len、宽 wid、方向 ang；起笔圆、收笔略收，带几道鬃毛痕。 */
function pstroke(ctx, x, y, len, wid, ang, c, a, R, br = 0.55) {
  const hl = len / 2, hw = wid / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.globalAlpha = a;
  ctx.fillStyle = css(c);
  const j = () => (R() - 0.5) * hw * 0.3;
  ctx.beginPath();
  ctx.moveTo(-hl + hw * 0.4, -hw + j());
  ctx.lineTo(hl * (0.8 + R() * 0.12), -hw * 0.8 + j());
  ctx.quadraticCurveTo(hl * (1 + R() * 0.05), 0, hl * (0.8 + R() * 0.12), hw * 0.8 + j());
  ctx.lineTo(-hl + hw * 0.4, hw + j());
  ctx.quadraticCurveTo(-hl - hw * 0.35, 0, -hl + hw * 0.4, -hw + j());
  ctx.fill();
  if (br > 0 && wid > 3) {
    const n = Math.min(8, Math.max(2, Math.round(wid / 4)));
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const v = -hw * 0.8 + (i + 0.5) * ((1.6 * hw) / n) + (R() - 0.5) * hw * 0.15;
      ctx.strokeStyle = css(tone(c, (R() - 0.5) * 0.24));
      ctx.globalAlpha = a * br * (0.35 + R() * 0.65);
      ctx.lineWidth = Math.max(0.5, ((hw * 1.6) / n) * (0.25 + R() * 0.35));
      ctx.beginPath();
      ctx.moveTo(-hl + hw * 0.3 + R() * len * 0.15, v);
      ctx.lineTo(hl * (0.9 - R() * 0.4), v + (R() - 0.5) * hw * 0.2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 用厚涂笔触铺满一块区域：先按 col(x, y) 的竖向渐变垫底，再在区域里撒笔触（裁在区域内）。 */
function paintArea(ctx, path, box, col, o = {}) {
  const { R, density = 1, len = [30, 70], wid = [8, 18], ang = 0, angJ = 0.25, a = [0.45, 0.85], jt = 0.05, br = 0.5, base = true, n = null } = o;
  const [x0, y0, x1, y1] = box;
  ctx.save();
  ctx.clip(path);
  if (base) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    for (let k = 0; k <= 4; k++) g.addColorStop(k / 4, css(col((x0 + x1) / 2, lerp(y0, y1, k / 4))));
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  }
  const N = n ?? Math.round((((x1 - x0) * (y1 - y0)) / 900) * density);
  for (let i = 0; i < N; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
    pstroke(ctx, x, y, lerp(len[0], len[1], R()), lerp(wid[0], wid[1], R()), ang + (R() - 0.5) * 2 * angJ, jit(col(x, y), R, jt), lerp(a[0], a[1], R()), R, br);
  }
  ctx.restore();
}
const rectPath = (x0, y0, x1, y1) => { const p = new Path2D(); p.rect(x0, y0, x1 - x0, y1 - y0); return p; };
const polyPath = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const vgrad = (stops) => (x, y) => {
  // stops: [[y, rgb], ...]，y 递增
  if (y <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) if (y <= stops[i][0]) return mixC(stops[i - 1][1], stops[i][1], (y - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return stops[stops.length - 1][1];
};
function softGlow(ctx, x, y, r, c, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, css(c, a)); g.addColorStop(0.5, css(c, a * 0.35)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
}

// ---------- 拍点 ----------
const T_HIT = GAG;                      // 第 9 拍强拍：两把伞一歪，水幕正好扬到最高处
const T_WET = T_HIT - 0.24;             // 前轮压进积水（比强拍早 1/4 拍：强拍上水幕正好扬到伞的高度）
const TILT = (-18 * Math.PI) / 180;
/** 两把伞的歪斜（弧度）：强拍上到位，停一下，之后 1.5 拍弹性回正。 */
function tiltAt(b) {
  const t = b - T_HIT;
  if (t < -0.14 || t > 1.7) return 0;
  if (t < 0) return TILT * ease.in(smoothstep(-0.14, 0, t) ** 0.7);
  const hold = 0.12;
  if (t < hold) return TILT;
  const u = t - hold;
  return TILT * Math.exp(-2.9 * u) * Math.cos(u * Math.PI * 2 * 0.95) * (1 - smoothstep(1.3, 1.58, t));
}
/** 风（她的头发、裙摆）：平时轻轻的，车驶过时一阵大风。 */
const gustAt = (b) => smoothstep(T_HIT - 0.5, T_HIT + 0.05, b) * (1 - smoothstep(T_HIT + 0.4, T_HIT + 2.2, b));
/** 雨势与阳光：第 13 拍起雨渐小、云后透出阳光（一直延续到 Outro 定格）。 */
/** 他从她身边经过时，她把伞往后一让（第 14–16 拍）。 */
const courtesyAt = (b) => -0.16 * smoothstep(GAG + 5.2, GAG + 6.0, b) * (1 - smoothstep(GAG + 7.2, END + 1.2, b));
const sunAt = (b) => smoothstep(GAG + 4.5, END + 3.5, b);
const rainAt = (b) => 1 - 0.68 * smoothstep(GAG + 5, END + 4, b);

// ---------- 镜头：本站结束后（Outro 前 8 拍第 16 格还是活的）镜头 1.5 拍内缓停，他在画面里继续走 ----------
const DECEL = 1.5, STOP_B = END + 3;
function camOf(env, b = env.b) {
  if (b <= END) return env.camAt(b);
  const c16 = env.camAt(END), v = env.camAt(END) - env.camAt(END - 1);
  const u = Math.min(b - END, DECEL);
  return c16 + v * (u - (u * u) / (2 * DECEL));
}

// ---------- 天空 ----------
function skyLayer(env) {
  const c9 = env.camAt(GAG);
  return strip('s16-sky', P_SKY, (ctx, x0, x1) => {
    const R = R0('sky');
    const col = vgrad([[0, C('#cfd8df')], [180, C('#dbe2e7')], [420, C('#e8ecee')], [640, C('#f0f1ef')], [740, C('#f2f2ef')]]);
    paintArea(ctx, rectPath(x0, 0, x1, 740), [x0, 0, x1, 740], col, { R, density: 0.35, len: [120, 260], wid: [26, 54], ang: -0.06, angJ: 0.08, a: [0.25, 0.5], jt: 0.035, br: 0.35 });
    // 云后的亮处（太阳在云后，定格时在画面右上）
    const sx = 1040 + c9 * P_SKY;
    softGlow(ctx, sx, 110, 760, C('#fbfaf2'), 0.85);
    softGlow(ctx, sx, 90, 300, C('#fffdf4'), 0.8);
    // 云团：暗部在下、亮边朝向光源
    for (let i = 0; i < 26; i++) {
      const cx = x0 + R() * (x1 - x0), cy = 40 + R() * 420, w = 220 + R() * 420, h = 40 + R() * 70;
      const near = Math.max(0, 1 - Math.hypot(cx - sx, cy - 110) / 900);
      const dark = mixC(C('#c3ccd4'), C('#e2e6e8'), near * 0.8 + cy / 1400);
      const light = mixC(C('#eef0f0'), C('#fdfcf6'), near);
      for (let k = 0; k < 22; k++) {
        const u = R() - 0.5, v = R() - 0.5;
        const px = cx + u * w, py = cy + v * h * 1.2 + Math.abs(u) * h * 0.6;
        const c = v > 0.05 ? dark : light;
        pstroke(ctx, px, py, 80 + R() * 160, 18 + R() * 30, -0.05 + (R() - 0.5) * 0.12, jit(c, R, 0.03), 0.18 + R() * 0.3, R, 0.3);
      }
    }
    // 远处的雨幕：很淡的斜纹
    ctx.save();
    ctx.lineCap = 'round';
    for (let i = 0; i < 260; i++) {
      const x = x0 + R() * (x1 - x0), y = 120 + R() * 600, L = 60 + R() * 160;
      ctx.strokeStyle = css(C('#aeb9c2'), 0.06 + R() * 0.06);
      ctx.lineWidth = 1 + R() * 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * 0.16, y + L); ctx.stroke();
    }
    ctx.restore();
  }, { y0: 0, y1: 740 });
}

/** 雨快停时云层右上方裂开的一块：淡蓝的天、被阳光照亮的云边、云后的太阳（随阳光渐显）。 */
function clearLayer(env) {
  const c9 = env.camAt(GAG);
  return strip('s16-clear', P_SKY, (ctx) => {
    const R = R0('clear');
    const cx = 1130 + c9 * P_SKY, cy = 120;
    // 云隙：不规则的一块，边缘柔
    const gap = new Path2D();
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2, r = 1 + (noise2(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 41) - 0.5) * 0.55;
      const x = cx + Math.cos(a) * 330 * r, y = cy + Math.sin(a) * 120 * r;
      k ? gap.lineTo(x, y) : gap.moveTo(x, y);
    }
    gap.closePath();
    ctx.save();
    ctx.filter = 'blur(10px)';
    const g = ctx.createLinearGradient(0, cy - 140, 0, cy + 140);
    g.addColorStop(0, '#93bddf'); g.addColorStop(0.6, '#b9d5ea'); g.addColorStop(1, '#dce9f1');
    ctx.fillStyle = g; ctx.fill(gap);
    ctx.restore();
    // 云边被照亮：一圈暖白的笔触
    for (let k = 0; k < 140; k++) {
      const a = R() * Math.PI * 2, r = 1 + (noise2(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 41) - 0.5) * 0.55;
      const x = cx + Math.cos(a) * 330 * r * (1.02 + R() * 0.12), y = cy + Math.sin(a) * 120 * r * (1.02 + R() * 0.2);
      pstroke(ctx, x, y, 40 + R() * 70, 10 + R() * 16, Math.atan2(Math.sin(a) * 120, Math.cos(a) * 330) + Math.PI / 2 + (R() - 0.5) * 0.4, jit(C(R() < 0.5 ? '#fff6e2' : '#fbe9c8'), R, 0.03), 0.45 + R() * 0.4, R, 0.4);
    }
    // 太阳：藏在云隙左下角的云边后面，只露出一团亮光
    softGlow(ctx, cx - 150, cy + 40, 260, C('#fffbea'), 1);
    softGlow(ctx, cx - 150, cy + 40, 90, C('#ffffff'), 1);
  }, { y0: 0, y1: 420 });
}

// ---------- 远景、中远景楼群（空气透视） ----------
function cityLayer(key, p, { top: [tLo, tHi], wid: [wLo, wHi], cols, haze, win, base = 712, seed }) {
  return strip(key, p, (ctx, x0, x1) => {
    const R = R0(key, seed);
    for (let x = x0 - 60; x < x1;) {
      const w = wLo + R() * (wHi - wLo), top = tLo + R() * (tHi - tLo);
      const c = jit(C(cols[Math.floor(R() * cols.length)]), R, 0.025);
      const pts = [[x, base], [x, top + 6], [x + w, top + 6], [x + w, base]];
      // 屋顶：平顶、退台、尖顶、天线
      const kind = R();
      if (kind < 0.25) pts.splice(2, 0, [x + w * 0.25, top - 30 - R() * 40], [x + w * 0.7, top - 30 - R() * 40]);
      else if (kind < 0.4) pts.splice(2, 0, [x + w * 0.5, top - 40 - R() * 70]);
      else if (kind < 0.6) pts.splice(2, 0, [x + w * 0.15, top - 18], [x + w * 0.6, top - 18], [x + w * 0.6, top + 6]);
      const path = polyPath(pts);
      const col = vgrad([[top - 80, tone(c, 0.06)], [base - 140, c], [base, tone(c, 0.12)]]);
      paintArea(ctx, path, [x - 4, top - 120, x + w + 4, base], col, { R, density: 0.9, len: [26, 60], wid: [7, 14], ang: Math.PI / 2, angJ: 0.08, a: [0.35, 0.7], jt: 0.025, br: 0.3 });
      // 朝光的一侧（右）亮一条
      ctx.save(); ctx.clip(path);
      ctx.fillStyle = css(tone(c, 0.22), 0.55);
      ctx.fillRect(x + w - Math.max(4, w * 0.08), top - 120, Math.max(4, w * 0.08), base - top + 120);
      // 窗格：横向的淡色带 + 零星亮窗
      if (win) {
        for (let y = top + 18; y < base - 20; y += win.gap) {
          ctx.fillStyle = css(tone(c, -0.08), win.a);
          ctx.fillRect(x + 6, y, w - 12, win.gap * 0.42);
          for (let wx = x + 10; wx < x + w - 14; wx += win.cw) {
            const r = R();
            if (r < 0.05) { ctx.fillStyle = css(C('#f3e7c8'), 0.75); ctx.fillRect(wx, y, win.cw * 0.55, win.gap * 0.42); }
            else if (r < 0.25) { ctx.fillStyle = css(tone(c, 0.2), 0.45); ctx.fillRect(wx, y, win.cw * 0.55, win.gap * 0.42); }
          }
        }
      }
      ctx.restore();
      x += w + (R() < 0.3 ? 10 + R() * 50 : 2);
    }
    // 楼脚的雨雾
    const g = ctx.createLinearGradient(0, base - haze[0], 0, base);
    g.addColorStop(0, css(C('#eef0ef'), 0)); g.addColorStop(1, css(C('#eef0ef'), haze[1]));
    ctx.fillStyle = g;
    ctx.fillRect(x0, base - haze[0], x1 - x0, haze[0] + 4);
  }, { y0: 120, y1: base + 4 });
}
const farLayer = () => cityLayer('s16-far', P_FAR, { top: [240, 470], wid: [70, 170], cols: ['#c6ced4', '#c0c9d0', '#cad1d6', '#bcc6cd'], haze: [300, 0.92], win: { gap: 22, cw: 18, a: 0.16 }, seed: 1 });
const midFarLayer = () => cityLayer('s16-mf', P_MF, { top: [300, 520], wid: [120, 260], cols: ['#b3bec6', '#aab6bf', '#b9c1c6', '#b2b8bb'], haze: [220, 0.78], win: { gap: 30, cw: 26, a: 0.22 }, seed: 2 });

// ---------- 对街：店面、雨棚、行道树、红绿灯、远处撑伞的行人 ----------
const FAC = ['#b7b1a8', '#a8adb1', '#c3b9ab', '#9fa8ae', '#b4a597', '#a9b2ac', '#bdb6b0'];
const AWN = ['#6f9693', '#b4806c', '#c3a764', '#8394ad', '#9c8a7f', '#7e9a86'];
function midGeo(c9) {
  return memo(`s16-mid|${Math.round(c9)}`, () => {
    const [x0, x1] = [X_MIN - 520 * P_MID - 300, X_MAX + 2700 * P_MID + 300];
    const R = R0('midgeo');
    const blds = [];
    for (let x = x0; x < x1;) {
      const w = 230 + R() * 220, top = 150 + R() * 210;
      blds.push({ x, w, top, color: FAC[Math.floor(R() * FAC.length)], seed: Math.floor(R() * 1000), awning: R() < 0.75 ? AWN[Math.floor(R() * AWN.length)] : null });
      x += w + (R() < 0.25 ? 30 + R() * 70 : 3 + R() * 8);
    }
    const trees = [];
    for (let x = x0 + 180; x < x1; x += 470 + R() * 160) trees.push({ x, h: 250 + R() * 90, seed: Math.floor(R() * 1000) });
    const light = 1180 + c9 * P_MID;  // 红绿灯杆：定格时在画面右侧
    const people = [];
    for (let x = x0 + 300; x < x1; x += 520 + R() * 600) people.push({ x, c: ['#4f5d6e', '#d8d2c6', '#7d6f8a', '#5f7a74'][Math.floor(R() * 4)], seed: Math.floor(R() * 1000), dir: R() < 0.5 ? -1 : 1 });
    return { blds, trees, light, people };
  });
}
function midLayer(env) {
  const G = midGeo(env.camAt(GAG));
  return strip('s16-mid', P_MID, (ctx, x0, x1) => {
    const R = R0('mid');
    for (const B of G.blds) {
      if (B.x + B.w < x0 - 60 || B.x > x1 + 60) continue;
      const { x, w, top } = B, c = C(B.color);
      const path = polyPath([[x, MID_BASE], [x, top + 10], [x + 8, top], [x + w - 8, top], [x + w, top + 10], [x + w, MID_BASE]]);
      paintArea(ctx, path, [x, top, x + w, MID_BASE], vgrad([[top, tone(c, 0.1)], [520, c], [MID_BASE, tone(c, -0.05)]]), { R, density: 1.6, len: [24, 60], wid: [8, 18], ang: Math.PI / 2, angJ: 0.12, a: [0.35, 0.8], jt: 0.075, br: 0.5 });
      // 天光从右上来：立面右侧亮一点、左下暗一点
      ctx.save(); ctx.clip(path);
      const lg = ctx.createLinearGradient(x, top, x + w, MID_BASE);
      lg.addColorStop(0, css(DEEP, 0.08)); lg.addColorStop(0.6, css(DEEP, 0)); lg.addColorStop(1, css(WHITE, 0.12));
      ctx.fillStyle = lg; ctx.fillRect(x, top, w, MID_BASE - top);
      ctx.restore();
      // 檐口与楼层线
      ctx.fillStyle = css(tone(c, 0.3), 0.8); ctx.fillRect(x + 4, top + 14, w - 8, 5);
      ctx.fillStyle = css(tone(c, -0.18), 0.5); ctx.fillRect(x + 4, top + 19, w - 8, 3);
      // 楼上的窗：映着天光
      const cols = Math.max(2, Math.floor((w - 40) / 62)), gx = (w - 40) / cols;
      for (let y = top + 46; y < 470; y += 74) for (let k = 0; k < cols; k++) {
        const wx = x + 20 + k * gx + gx / 2 - 17;
        const g = ctx.createLinearGradient(0, y, 0, y + 46);
        g.addColorStop(0, css(C('#e4e9ec'))); g.addColorStop(1, css(C('#8f9ca6')));
        ctx.fillStyle = g; ctx.fillRect(wx, y, 34, 46);
        if (R() < 0.12) { ctx.fillStyle = css(C('#f1e3c0'), 0.8); ctx.fillRect(wx + 2, y + 18, 30, 26); }
        ctx.fillStyle = css(tone(c, -0.3), 0.55); ctx.fillRect(wx + 16, y, 2, 46); ctx.fillRect(wx, y + 20, 34, 2);
        ctx.fillStyle = css(tone(c, 0.35), 0.8); ctx.fillRect(wx - 3, y + 46, 40, 4);
        pstroke(ctx, wx + 12, y + 14, 20, 4, -0.9, C('#ffffff'), 0.35, R, 0);
      }
      // 底层店面：暖色的室内光
      const sx0 = x + 20, sx1 = x + w - 76;
      if (sx1 - sx0 > 70) {
        const g = ctx.createLinearGradient(0, 566, 0, 692);
        g.addColorStop(0, css(C('#f4ead3'))); g.addColorStop(1, css(C('#d8c9ab')));
        ctx.fillStyle = g; ctx.fillRect(sx0, 566, sx1 - sx0, 126);
        for (let k = 0; k < 5; k++) { // 店里的货架、人影：几块模糊色块
          const px = sx0 + 16 + R() * (sx1 - sx0 - 32);
          pstroke(ctx, px, 640 + R() * 30, 26 + R() * 30, 18 + R() * 16, Math.PI / 2, jit(C('#a99c8a'), R, 0.08), 0.45, R, 0.3);
        }
        for (let k = 0; k < 3; k++) pstroke(ctx, sx0 + R() * (sx1 - sx0), 610 + R() * 50, 70, 10, -1.0, C('#ffffff'), 0.28, R, 0.2);
        ctx.fillStyle = css(tone(c, -0.35), 0.75);
        ctx.fillRect(sx0 - 3, 566, 4, 126); ctx.fillRect(sx1 - 1, 566, 4, 126); ctx.fillRect((sx0 + sx1) / 2, 566, 3, 126);
        // 门
        ctx.fillStyle = css(tone(c, -0.28)); ctx.fillRect(sx1 + 14, 580, x + w - sx1 - 30, 112);
        ctx.fillStyle = css(C('#cfd5d8'), 0.5); ctx.fillRect(sx1 + 20, 588, x + w - sx1 - 42, 50);
        // 招牌：无字的色块
        ctx.fillStyle = css(tone(c, -0.12)); ctx.fillRect(sx0, 532, sx1 - sx0, 26);
      }
      // 雨棚
      if (B.awning) {
        const a = C(B.awning);
        const ap = polyPath([[x + 8, 538], [x + w - 8, 538], [x + w + 6, 576], [x - 6, 576]]);
        paintArea(ctx, ap, [x - 6, 538, x + w + 6, 580], vgrad([[538, tone(a, 0.12)], [576, tone(a, -0.12)]]), { R, density: 2, len: [16, 34], wid: [6, 10], ang: 0.1, angJ: 0.2, a: [0.4, 0.8], jt: 0.05, br: 0.4 });
        ctx.fillStyle = css(tone(a, 0.45), 0.7); ctx.fillRect(x + 8, 538, w - 16, 3);   // 湿亮的上沿
        ctx.fillStyle = css(tone(a, -0.25)); ctx.fillRect(x - 6, 576, w + 12, 7);
      }
    }
    // 对街人行道
    ctx.fillStyle = css(C('#c1c8cc')); ctx.fillRect(x0, MID_BASE - 2, x1 - x0, 10);
    ctx.fillStyle = css(C('#e3e7e9'), 0.6); ctx.fillRect(x0, MID_BASE - 2, x1 - x0, 2);
    // 行道树
    for (const T of G.trees) {
      if (T.x < x0 - 220 || T.x > x1 + 220) continue;
      const RT = R0('tree', T.seed);
      pstroke(ctx, T.x, MID_BASE - T.h * 0.3, T.h * 0.62, 9, Math.PI / 2 + 0.03, C('#5f6964'), 0.95, RT, 0.4);
      // 树冠：先铺几团柔和的底色，再一层层点上圆一些的笔触（暗部在下、亮部在右上）
      const cy0 = MID_BASE - T.h;
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * Math.PI * 2, gx = T.x + Math.cos(a) * 62, gy = cy0 + Math.sin(a) * 34 + 6;
        const g = ctx.createRadialGradient(gx, gy, 4, gx, gy, 78);
        g.addColorStop(0, css(C('#8a9e90'), 0.75)); g.addColorStop(1, css(C('#8a9e90'), 0));
        ctx.fillStyle = g; ctx.fillRect(gx - 80, gy - 80, 160, 160);
      }
      for (let pass = 0; pass < 3; pass++) for (let k = 0; k < 60; k++) {
        const a = RT() * Math.PI * 2, r = Math.sqrt(RT()) * (1 - pass * 0.18);
        const cx = T.x + Math.cos(a) * r * 118, cy = cy0 + Math.sin(a) * r * 74 - pass * 6;
        const lightK = clamp(0.35 - (cy - cy0) / 140 + (cx - T.x) / 300 + pass * 0.18);
        const c = mixC(C('#677b70'), C('#b4c4b0'), lightK);
        const sz = 7 + RT() * 8, an = RT() * Math.PI;
        ctx.globalAlpha = 0.45 + RT() * 0.4;
        ctx.fillStyle = css(jit(c, RT, 0.05));
        ctx.beginPath(); ctx.ellipse(cx, cy, sz, sz * (0.6 + RT() * 0.3), an, 0, Math.PI * 2); ctx.fill();
        if (RT() < 0.25) { ctx.fillStyle = css(tone(c, 0.25), 0.6); ctx.beginPath(); ctx.ellipse(cx + 2, cy - 2, sz * 0.4, sz * 0.25, an, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
    // 红绿灯杆（绿灯亮着，小小的一点）
    {
      const lx = G.light;
      if (lx > x0 - 100 && lx < x1 + 100) {
        ctx.fillStyle = css(C('#5b656c')); ctx.fillRect(lx - 4, 330, 8, MID_BASE - 330);
        ctx.fillRect(lx - 4, 340, 90, 7);
        roundRect(ctx, lx + 70, 330, 28, 74, 6); ctx.fillStyle = css(C('#4c555c')); ctx.fill();
        for (const [k, c, on] of [[0, '#b8675c', 0], [1, '#c9ad5e', 0], [2, '#5fd39a', 1]]) {
          ctx.beginPath(); ctx.arc(lx + 84, 344 + k * 22, 7.5, 0, Math.PI * 2);
          ctx.fillStyle = css(on ? C(c) : tone(C(c), -0.45)); ctx.fill();
          if (on) softGlow(ctx, lx + 84, 388, 34, C('#9af0c4'), 0.6);
        }
      }
    }
    // 远处撑伞的行人（很小、很淡）
    for (const P of G.people) {
      if (P.x < x0 - 60 || P.x > x1 + 60) continue;
      const RP = R0('ppl', P.seed), c = C(P.c), x = P.x, y = MID_BASE + 2;
      pstroke(ctx, x - 4, y - 32, 62, 9, Math.PI / 2 + 0.06, C('#4d545a'), 0.9, RP, 0.2);
      pstroke(ctx, x + 6, y - 32, 62, 9, Math.PI / 2 - 0.06, C('#4d545a'), 0.9, RP, 0.2);
      pstroke(ctx, x, y - 92, 74, 30, Math.PI / 2, tone(C('#7d8790'), RP() * 0.2), 0.95, RP, 0.3);
      ctx.beginPath(); ctx.arc(x + 2, y - 138, 10, 0, Math.PI * 2); ctx.fillStyle = css(C('#6b5e57')); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x, y - 160, 46, 22, 0, Math.PI, 0); ctx.fillStyle = css(c, 0.95); ctx.fill();
      ctx.fillStyle = css(tone(c, 0.35), 0.7); ctx.fillRect(x - 30, y - 176, 30, 3);
      ctx.fillStyle = css(C('#3d4248')); ctx.fillRect(x - 1, y - 160, 2, 30);
    }
  }, { y0: 120, y1: MID_BASE + 10 });
}

// ---------- 车道 + 对街倒影 + 路边积水 ----------
function roadLayer(env) {
  const c9 = env.camAt(GAG);
  return strip('s16-road', P_ROAD, (ctx, x0, x1) => {
    const R = R0('road');
    const col = vgrad([[ROAD_Y0, C('#9aa4ab')], [740, C('#8a949c')], [CURB_Y, C('#7c8790')]]);
    paintArea(ctx, rectPath(x0, ROAD_Y0, x1, CURB_Y + 6), [x0, ROAD_Y0, x1, CURB_Y + 6], col, { R, density: 2.2, len: [40, 120], wid: [3, 8], ang: 0, angJ: 0.03, a: [0.3, 0.7], jt: 0.07, br: 0.3 });
    // 车道线：被雨水洇开的白色虚线
    for (let x = x0 - (((x0 % 240) + 240) % 240); x < x1; x += 240) pstroke(ctx, x + 60, 748, 120, 4.5, 0.004, C('#e9ecee'), 0.8, R, 0.3);
    ctx.fillStyle = css(C('#dde2e5'), 0.65); ctx.fillRect(x0, ROAD_Y0 + 6, x1 - x0, 2.5);
    // 路边积水（车轮压过的地方）：映着天光
    const px0 = PUD0 + c9 * P_ROAD, px1 = PUD1 + c9 * P_ROAD;
    const pp = new Path2D();
    pp.moveTo(px0, CURB_Y - 2);
    for (let k = 0; k <= 24; k++) { const t = k / 24; pp.lineTo(lerp(px0, px1, t), CURB_Y - 2 - (10 + 6 * noise2(t * 5, 1, 3)) * Math.sin(Math.PI * t) ** 0.5); }
    pp.lineTo(px1, CURB_Y + 6); pp.lineTo(px0, CURB_Y + 6); pp.closePath();
    paintArea(ctx, pp, [px0, CURB_Y - 20, px1, CURB_Y + 6], vgrad([[CURB_Y - 18, C('#eef1f2')], [CURB_Y + 6, C('#cfd6db')]]), { R, density: 3, len: [30, 80], wid: [2, 5], ang: 0, angJ: 0.02, a: [0.3, 0.7], jt: 0.03, br: 0.2 });
    // 其他小水洼
    for (let x = x0 + 100; x < x1; x += 300 + R() * 400) {
      const y = 712 + R() * 70, w = 60 + R() * 110;
      ctx.beginPath(); ctx.ellipse(x, y, w, 3 + R() * 4, 0, 0, Math.PI * 2); ctx.fillStyle = css(C('#dfe4e7'), 0.55); ctx.fill();
    }
  }, { y0: ROAD_Y0 - 2, y1: CURB_Y + 8 });
}
/** 对街在湿路面上的倒影（跟对街一起平移）：把对街长条上下翻转、模糊、压暗一点，叠在车道上。 */
function roadReflLayer(env) {
  const M = midLayer(env);
  return strip('s16-roadrefl', P_MID, (ctx, x0, x1) => {
    ctx.save();
    ctx.filter = 'blur(3px)';
    ctx.globalAlpha = 0.42;
    ctx.translate(0, 2 * ROAD_Y0);
    ctx.scale(1, -1);
    ctx.drawImage(M.canvas, M.x0, M.y0, M.x1 - M.x0, M.y1 - M.y0);
    ctx.restore();
    // 往下渐隐 + 横向水纹（亮的细线）
    const R = R0('rr');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    const g = ctx.createLinearGradient(0, ROAD_Y0, 0, CURB_Y);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = g; ctx.fillRect(x0, ROAD_Y0, x1 - x0, CURB_Y - ROAD_Y0);
    ctx.restore();
    for (let i = 0; i < (x1 - x0) / 6; i++) {
      const x = x0 + R() * (x1 - x0), y = ROAD_Y0 + 6 + R() * (CURB_Y - ROAD_Y0 - 8);
      ctx.fillStyle = css(C('#e8ecee'), 0.12 + R() * 0.2);
      ctx.fillRect(x, y, 10 + R() * 40, 1.2);
    }
  }, { y0: ROAD_Y0, y1: CURB_Y + 2 });
}

// ---------- 候车亭、线路牌（与人物同一深度，定格时在画面左侧） ----------
const ROOF_Y = (x) => lerp(248, 258, (x - SH_X0) / (SH_X1 - SH_X0));  // 顶棚上沿，往右略低（水往右流）
const POSTS = [-318, 92];
function shelterGeo(c9) {
  const o = c9;   // p = 1
  return { o, x0: SH_X0 + o, x1: SH_X1 + o, posts: POSTS.map((x) => x + o), pole: POLE_X + o };
}
function propsLayer(env) {
  const G = shelterGeo(env.camAt(GAG));
  return strip('s16-props', 1, (ctx) => {
    const R = R0('props');
    const { o } = G;
    ctx.save();
    ctx.translate(o, 0);
    const METAL = C('#5d6b76');
    // 背板玻璃：透着后面的车道和对街（淡淡的冷白），挂着水珠和流痕
    const gx0 = POSTS[0] + 8, gx1 = POSTS[1] - 8, gy0 = 300, gy1 = 742;
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, css(C('#f4f7f9'), 0.42)); g.addColorStop(0.5, css(C('#dfe6ea'), 0.22)); g.addColorStop(1, css(C('#eef2f4'), 0.36));
    ctx.fillStyle = g; ctx.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    for (let k = 0; k < 5; k++) pstroke(ctx, lerp(gx0, gx1, 0.1 + k * 0.2), 480, 300, 26, -1.05, C('#ffffff'), 0.13, R, 0.3);
    for (let k = 0; k < 120; k++) {   // 水珠
      const x = gx0 + R() * (gx1 - gx0), y = gy0 + R() * (gy1 - gy0), r = 1.2 + R() * 2.6;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = css(C('#7d8b96'), 0.35); ctx.fill();
      ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    }
    for (let k = 0; k < 9; k++) {      // 流痕
      let x = gx0 + 20 + R() * (gx1 - gx0 - 40), y = gy0 + R() * 120;
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y);
      const L = 120 + R() * 260;
      for (let s = 0; s < L; s += 12) { x += (noise2(s * 0.05, k, 9) - 0.5) * 4; ctx.lineTo(x, y + s); }
      ctx.stroke();
    }
    // 灯箱（左端）：只有柔和的色块，不写字、不放图
    {
      const bx0 = -306, bx1 = -178, by0 = 330, by1 = 716;
      ctx.fillStyle = css(METAL); ctx.fillRect(bx0 - 8, by0 - 8, bx1 - bx0 + 16, by1 - by0 + 16);
      const lg = ctx.createLinearGradient(0, by0, 0, by1);
      lg.addColorStop(0, css(C('#f7f4ec'))); lg.addColorStop(0.55, css(C('#e9ece6'))); lg.addColorStop(1, css(C('#dde6e6')));
      ctx.fillStyle = lg; ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      ctx.save(); ctx.beginPath(); ctx.rect(bx0, by0, bx1 - bx0, by1 - by0); ctx.clip();
      // 抽象的色域：两道柔和的弧形色带（不是图像、不写字）
      for (const [cy, c, a] of [[640, '#a9cbc6', 0.8], [700, '#7fb0ab', 0.8], [560, '#f3d9b8', 0.7]]) {
        ctx.fillStyle = css(C(c), a);
        ctx.beginPath(); ctx.ellipse((bx0 + bx1) / 2 + 20, cy + 60, 140, 90, -0.15, 0, Math.PI * 2); ctx.fill();
      }
      for (let k = 0; k < 26; k++) pstroke(ctx, bx0 + R() * (bx1 - bx0), by0 + 180 + R() * 200, 40 + R() * 30, 10 + R() * 8, -0.12 + (R() - 0.5) * 0.2, jit(C('#bcd6d0'), R, 0.06), 0.3, R, 0.3);
      ctx.restore();
      softGlow(ctx, (bx0 + bx1) / 2, by0 + 120, 160, C('#ffffff'), 0.5);
    }
    // 长椅
    {
      const WOOD = C('#a47c5b');
      // 金属框：椅腿 + 靠背支架
      ctx.fillStyle = css(METAL);
      for (const lx of [-150, 66]) { ctx.fillRect(lx, 660, 7, 84); ctx.fillRect(lx + 2, 596, 5, 66); }
      ctx.fillRect(-152, 742, 226, 4);
      // 座板：上面亮、正面暗，有厚度
      const sp = polyPath([[-168, 652], [86, 652], [92, 662], [-162, 662]]);
      ctx.fillStyle = css(tone(WOOD, 0.22)); ctx.fill(sp);
      ctx.fillStyle = css(tone(WOOD, -0.18)); ctx.fillRect(-162, 662, 254, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-160, 653, 240, 1.6);
      // 靠背两条木板
      for (const y of [600, 622]) { ctx.fillStyle = css(WOOD); ctx.fillRect(-166, y, 254, 13); ctx.fillStyle = css(tone(WOOD, 0.25)); ctx.fillRect(-166, y, 254, 3); }
      for (let k = 0; k < 14; k++) pstroke(ctx, -150 + R() * 230, 600 + R() * 70, 50, 3, 0, tone(WOOD, (R() - 0.5) * 0.3), 0.35, R, 0.2);
      // 椅子下一只躲雨的猫（团成一团）
      const cx = 10, cy = 740;
      ctx.fillStyle = css(C('#6f665e'));
      ctx.beginPath(); ctx.ellipse(cx, cy - 14, 24, 15, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx + 20, cy - 22, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 14, cy - 28); ctx.lineTo(cx + 16, cy - 38); ctx.lineTo(cx + 21, cy - 30); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx + 22, cy - 29); ctx.lineTo(cx + 27, cy - 37); ctx.lineTo(cx + 29, cy - 27); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = css(C('#6f665e')); ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - 20, cy - 6); ctx.quadraticCurveTo(cx - 6, cy + 2, cx + 14, cy - 3); ctx.stroke();
      ctx.fillStyle = css(C('#9a9087'), 0.8); ctx.beginPath(); ctx.ellipse(cx - 2, cy - 22, 14, 5, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = css(C('#2f2a26')); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx + 22, cy - 23); ctx.lineTo(cx + 26, cy - 23); ctx.stroke();
    }
    // 立柱
    for (const px of POSTS) {
      const pg = ctx.createLinearGradient(px - 9, 0, px + 9, 0);
      pg.addColorStop(0, css(tone(METAL, -0.2))); pg.addColorStop(0.35, css(tone(METAL, 0.35))); pg.addColorStop(1, css(tone(METAL, -0.1)));
      ctx.fillStyle = pg; ctx.fillRect(px - 9, ROOF_Y(px) + 10, 18, 800 - ROOF_Y(px) - 6);
      ctx.fillStyle = css(tone(METAL, -0.3)); ctx.fillRect(px - 13, 790, 26, 8);
    }
    // 顶棚：金属边框 + 玻璃（从下面看是一条透亮的带子）
    {
      const top = (x) => ROOF_Y(x), bot = (x) => ROOF_Y(x) + 24;
      const p = polyPath([[SH_X0, top(SH_X0)], [SH_X1, top(SH_X1)], [SH_X1, bot(SH_X1)], [SH_X0, bot(SH_X0)]]);
      const rg = ctx.createLinearGradient(0, 245, 0, 285);
      rg.addColorStop(0, css(C('#f7fafb'), 0.95)); rg.addColorStop(1, css(C('#c9d3da'), 0.85));
      ctx.fillStyle = rg; ctx.fill(p);
      ctx.save(); ctx.clip(p);
      for (let k = 0; k < 40; k++) pstroke(ctx, SH_X0 + R() * (SH_X1 - SH_X0), 262 + R() * 14, 40 + R() * 70, 4, 0.02, R() < 0.5 ? C('#ffffff') : C('#aebbc4'), 0.45, R, 0.2);
      ctx.restore();
      ctx.strokeStyle = css(tone(METAL, -0.15)); ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(SH_X0, top(SH_X0)); ctx.lineTo(SH_X1, top(SH_X1)); ctx.stroke();
      ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(SH_X0, bot(SH_X0)); ctx.lineTo(SH_X1, bot(SH_X1)); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(SH_X0, top(SH_X0) + 2.5); ctx.lineTo(SH_X1, top(SH_X1) + 2.5); ctx.stroke();
      // 顶棚下的横梁
      ctx.fillStyle = css(METAL); ctx.fillRect(SH_X0 + 20, bot(SH_X0) - 1, SH_X1 - SH_X0 - 40, 6);
    }
    // 线路牌：杆 + 无字的色块牌（线路色条、圆点、箭头）
    {
      const x = POLE_X;
      const pg = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
      pg.addColorStop(0, css(C('#5a656d'))); pg.addColorStop(0.4, css(C('#a5afb6'))); pg.addColorStop(1, css(C('#59646c')));
      ctx.fillStyle = pg; ctx.fillRect(x - 6, 250, 12, 548);
      ctx.fillStyle = css(C('#47515a')); ctx.fillRect(x - 10, 790, 20, 8);
      // 牌子
      roundRect(ctx, x - 52, 262, 104, 150, 8); ctx.fillStyle = css(C('#3f6f8e')); ctx.fill();
      roundRect(ctx, x - 46, 268, 92, 138, 5); ctx.fillStyle = css(C('#f1f3f2')); ctx.fill();
      ctx.beginPath(); ctx.arc(x - 26, 290, 13, 0, Math.PI * 2); ctx.fillStyle = css(C('#3f6f8e')); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 32, 288, 12, 4);   // 车形的抽象记号：一横
      const bars = ['#d76b52', '#4f97a8', '#d9b14a', '#7b8fb6'];
      bars.forEach((c, k) => {
        const y = 318 + k * 20;
        ctx.fillStyle = css(C(c)); roundRect(ctx, x - 38, y, 22, 12, 3); ctx.fill();
        ctx.fillStyle = css(C('#c7ccd0')); ctx.fillRect(x - 10, y + 4, 44, 4);
      });
      ctx.fillStyle = css(C('#3f6f8e'));    // 箭头
      ctx.beginPath(); ctx.moveTo(x + 6, 284); ctx.lineTo(x + 30, 284); ctx.lineTo(x + 30, 278); ctx.lineTo(x + 40, 290); ctx.lineTo(x + 30, 302); ctx.lineTo(x + 30, 296); ctx.lineTo(x + 6, 296); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x - 46, 268, 92, 4);
      // 时刻表小盒（无字：几条浅色横线）
      roundRect(ctx, x - 30, 470, 60, 84, 5); ctx.fillStyle = css(C('#4a5761')); ctx.fill();
      ctx.fillStyle = css(C('#e9eef0')); ctx.fillRect(x - 24, 476, 48, 72);
      for (let k = 0; k < 6; k++) { ctx.fillStyle = css(C('#b9c2c8')); ctx.fillRect(x - 18, 486 + k * 10, 36 - (k % 3) * 8, 3); }
    }
    // 垃圾桶（深绿）
    {
      const x = 1180;
      const tg = ctx.createLinearGradient(x - 26, 0, x + 26, 0);
      tg.addColorStop(0, css(C('#3d5249'))); tg.addColorStop(0.4, css(C('#6d8578'))); tg.addColorStop(1, css(C('#34463e')));
      roundRect(ctx, x - 26, 700, 52, 96, 6); ctx.fillStyle = tg; ctx.fill();
      ctx.fillStyle = css(C('#2d3a34')); ctx.fillRect(x - 30, 696, 60, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(x - 28, 697, 56, 2);
    }
    ctx.restore();
  }, { y0: 236, y1: 802 });
}

// ---------- 湿人行道：映着天光、候车亭和线路牌的倒影 ----------
function walkLayer(env) {
  const props = propsLayer(env);
  const c9 = env.camAt(GAG);
  return strip('s16-walk', 1, (ctx, x0, x1) => {
    const R = R0('walk');
    // 路缘石
    const cg = ctx.createLinearGradient(0, CURB_Y - 4, 0, 800);
    cg.addColorStop(0, css(C('#e4e8ea'))); cg.addColorStop(0.35, css(C('#c8cfd3'))); cg.addColorStop(1, css(C('#a6afb5')));
    ctx.fillStyle = cg; ctx.fillRect(x0, CURB_Y - 4, x1 - x0, 804 - CURB_Y + 4);
    for (let x = x0; x < x1; x += 160) { ctx.fillStyle = css(C('#9aa3aa'), 0.6); ctx.fillRect(x, CURB_Y - 3, 2, 12); }
    // 人行道：近处更亮（映着天）
    const col = vgrad([[800, C('#a9b3ba')], [860, C('#b9c2c8')], [1000, C('#cdd4d8')]]);
    paintArea(ctx, rectPath(x0, 800, x1, 1000), [x0, 800, x1, 1000], col, { R, density: 1.6, len: [60, 160], wid: [6, 16], ang: 0, angJ: 0.04, a: [0.3, 0.65], jt: 0.06, br: 0.35 });
    // 天光：几片大的亮斑（水膜）
    for (let x = x0; x < x1; x += 120 + R() * 200) {
      const y = 830 + R() * 160, w = 80 + R() * 220;
      for (let k = 0; k < 6; k++) pstroke(ctx, x + (R() - 0.5) * w, y + (R() - 0.5) * 16, w * (0.4 + R() * 0.5), 6 + R() * 10, 0, C('#e7ecee'), 0.25 + R() * 0.25, R, 0.2);
    }
    // 地砖缝
    for (const y of [842, 906, 984]) { ctx.fillStyle = css(C('#7f8a92'), 0.35); ctx.fillRect(x0, y, x1 - x0, 1.6); }
    for (let x = x0 - (((x0 % 190) + 190) % 190); x < x1; x += 190) {
      ctx.strokeStyle = css(C('#7f8a92'), 0.3); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, 800); ctx.lineTo(x - 46, 1000); ctx.stroke();
    }
    // 候车亭、线路牌的倒影（上下翻转、模糊、淡）
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 798, x1 - x0, 202); ctx.clip();
    ctx.filter = 'blur(2.5px)';
    ctx.globalAlpha = 0.38;
    ctx.translate(0, 2 * 798);
    ctx.scale(1, -1);
    ctx.drawImage(props.canvas, props.x0, props.y0, props.x1 - props.x0, props.y1 - props.y0);
    ctx.restore();
    // 他们脚前的大水洼（映着天，最亮）
    for (const [cx, cy, rx, ry] of [[530 + c9, 878, 300, 26], [-120 + c9, 950, 220, 22], [1220 + c9, 920, 160, 18]]) {
      const pp = new Path2D();
      for (let k = 0; k <= 40; k++) {
        const a = (k / 40) * Math.PI * 2, r = 1 + (noise2(Math.cos(a) * 1.5, Math.sin(a) * 1.5, Math.round(cx) % 97) - 0.5) * 0.35;
        const px = cx + Math.cos(a) * rx * r, py = cy + Math.sin(a) * ry * r;
        k ? pp.lineTo(px, py) : pp.moveTo(px, py);
      }
      pp.closePath();
      paintArea(ctx, pp, [cx - rx * 1.3, cy - ry * 1.3, cx + rx * 1.3, cy + ry * 1.3], vgrad([[cy - ry, C('#e2e7ea')], [cy + ry, C('#ccd4d9')]]), { R, density: 5, len: [30, 90], wid: [3, 7], ang: 0, angJ: 0.03, a: [0.25, 0.5], jt: 0.03, br: 0.2 });
      ctx.strokeStyle = css(C('#8a959d'), 0.22); ctx.lineWidth = 1.2; ctx.stroke(pp);
    }
  }, { y0: CURB_Y - 6, y1: 1000 });
}

// ---------- 体积光：云后的太阳斜着照下来的几道光（固定在画面上，烘焙一次） ----------
function raysImage() {
  const res = 0.5, w = (X_MAX - X_MIN) * K * res, h = 1000 * K * res;
  return baked('s16-rays', w, h, (ctx) => {
    ctx.scale(K * res, K * res);
    ctx.translate(-X_MIN, 0);
    const R = R0('rays');
    const sx = 975, sy = 150;
    for (let i = 0; i < 9; i++) {
      const a = 1.95 + i * 0.085 + (R() - 0.5) * 0.04, wd = 0.02 + R() * 0.035, L = 1500;
      const g = ctx.createLinearGradient(sx, sy, sx + Math.cos(a) * L, sy + Math.sin(a) * L);
      g.addColorStop(0, 'rgba(255,251,236,0.9)'); g.addColorStop(0.45, 'rgba(255,250,236,0.45)'); g.addColorStop(1, 'rgba(255,250,236,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - wd) * L, sy + Math.sin(a - wd) * L);
      ctx.lineTo(sx + Math.cos(a + wd) * L, sy + Math.sin(a + wd) * L);
      ctx.closePath(); ctx.globalAlpha = 0.35 + R() * 0.5; ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
}
/** 体积光烘焙后再模糊一遍（只做一次，每帧直接画）。 */
function raysSoft() {
  const src = raysImage();
  return baked('s16-rays-soft', src.width, src.height, (ctx) => { ctx.filter = 'blur(6px)'; ctx.drawImage(src, 0, 0); });
}
function drawRays(ctx, a, b) {
  if (a <= 0.005) return;
  const img = raysSoft();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha = a;
  ctx.drawImage(img, X_MIN + Math.sin(b * 0.4) * 6, 0, X_MAX - X_MIN, 1000);
  ctx.restore();
}

// ---------- 画布纹理（固定在画面上） ----------
function canvasTexture() {
  const w = Math.round((X_MAX - X_MIN) * K * 0.5), h = Math.round(1000 * K * 0.5);
  return baked('s16-tex', w, h, (ctx, c) => {
    const im = ctx.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const weave = (Math.sin(x * 1.9) * Math.sin(y * 1.7)) * 10;
      const n = (hash2(x, y, 77) - 0.5) * 26 + (noise2(x * 0.03, y * 0.03, 78) - 0.5) * 30 + weave;
      const v = 128 + n;
      d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    ctx.putImageData(im, 0, 0);
  });
}

// ---------- 公交车（原创车型：圆润车头、大车窗、蓝白涂装，车身不写字） ----------
const BUS_L = 2400, BUS_H = 880, BUS_PAD = 60, BUS_RES = 0.62;
const WHEELS = [420, 1850];
function busImage(hazy) {
  const s = BUS_RES * K, w = (BUS_L + 2 * BUS_PAD) * s, h = (BUS_H + 2 * BUS_PAD) * s;
  return baked(`s16-bus|${hazy ? 1 : 0}`, w, h, (ctx, cv) => {
    if (hazy) {
      ctx.drawImage(busImage(false), 0, 0);
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = css(C('#dfe4e7'), 0.72);
      ctx.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    ctx.scale(s, s);
    ctx.translate(BUS_PAD, BUS_H + BUS_PAD);
    const R = R0('bus');
    const blue = C(BUS), white = C('#e8edf0'), glassT = C('#dce4e9'), glassB = C('#6f808d');
    // 车身外形（车头朝左）
    const body = new Path2D();
    body.moveTo(60, -70); body.lineTo(2380, -70);
    body.quadraticCurveTo(2400, -70, 2400, -100); body.lineTo(2400, -820);
    body.quadraticCurveTo(2400, -870, 2340, -872); body.lineTo(120, -872);
    body.quadraticCurveTo(40, -870, 26, -780);
    body.lineTo(8, -360); body.quadraticCurveTo(0, -240, 10, -150); body.quadraticCurveTo(18, -80, 60, -70);
    body.closePath();
    // 底色：下半蓝、上半白
    ctx.save(); ctx.clip(body);
    paintArea(ctx, rectPath(0, -880, 2400, -60), [0, -880, 2400, -60], vgrad([[-880, tone(white, 0.2)], [-760, white], [-440, tone(blue, 0.06)], [-60, tone(blue, -0.12)]]), { R, density: 0.5, len: [80, 200], wid: [14, 30], ang: 0, angJ: 0.03, a: [0.3, 0.6], jt: 0.04, br: 0.4 });
    ctx.fillStyle = css(white); ctx.fillRect(0, -880, 2400, 130);
    ctx.fillStyle = css(tone(white, -0.08)); ctx.fillRect(0, -760, 2400, 8);
    ctx.fillStyle = css(blue); ctx.fillRect(0, -470, 2400, 400);
    paintArea(ctx, rectPath(0, -470, 2400, -70), [0, -470, 2400, -70], vgrad([[-470, tone(blue, 0.12)], [-70, tone(blue, -0.18)]]), { R, density: 0.9, len: [90, 220], wid: [12, 26], ang: 0, angJ: 0.02, a: [0.35, 0.7], jt: 0.05, br: 0.45 });
    // 腰线：一条浅色细带
    ctx.fillStyle = css(tone(blue, 0.55)); ctx.fillRect(0, -476, 2400, 10);
    // 裙边
    ctx.fillStyle = css(C('#33404a')); ctx.fillRect(0, -140, 2400, 70);
    ctx.restore();
    // 侧窗：映着天光，几块乘客的模糊影子
    const glass = (x0, y0, x1, y1, pass) => {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, css(glassT)); g.addColorStop(0.55, css(mixC(glassT, glassB, 0.6))); g.addColorStop(1, css(glassB));
      roundRect(ctx, x0, y0, x1 - x0, y1 - y0, 14); ctx.fillStyle = g; ctx.fill();
      ctx.save(); ctx.clip();
      if (pass) { // 乘客：车窗里模糊的一团（不画成图标）
        const px = x0 + 50 + R() * (x1 - x0 - 100);
        for (let k = 0; k < 9; k++) pstroke(ctx, px + (R() - 0.5) * 50, y1 - 30 - R() * 70, 50 + R() * 40, 26 + R() * 18, Math.PI / 2 + (R() - 0.5) * 0.5, jit(C('#66737d'), R, 0.06), 0.3 + R() * 0.25, R, 0.4);
        for (let k = 0; k < 5; k++) pstroke(ctx, px + (R() - 0.5) * 16, y1 - 128 + (R() - 0.5) * 20, 30, 22, R() * 3, jit(C('#5d6a74'), R, 0.06), 0.35, R, 0.3);
      }
      for (let k = 0; k < 4; k++) pstroke(ctx, x0 + R() * (x1 - x0), y0 + (y1 - y0) * (0.15 + R() * 0.6), 160 + R() * 80, 30 + R() * 30, -0.7 + (R() - 0.5) * 0.2, C('#ffffff'), 0.1 + R() * 0.08, R, 0.5);
      ctx.restore();
      ctx.strokeStyle = css(C('#2a333b')); ctx.lineWidth = 8; ctx.stroke();
    };
    glass(40, -740, 300, -500, false);          // 前挡风（侧面看到的一角）
    glass(330, -740, 480, -150, false);          // 前门
    for (let x = 520; x < 2320; x += 300) {
      if (x > 1230 && x < 1450) continue;
      glass(x, -740, Math.min(x + 280, 2340), -500, R() < 0.55);
    }
    glass(1250, -740, 1430, -150, false);        // 中门
    // 门缝
    ctx.fillStyle = css(C('#2a333b')); ctx.fillRect(403, -740, 4, 590); ctx.fillRect(1338, -740, 4, 590);
    // 车头：大灯、转向灯、后视镜、空白的路牌屏（不写字）
    roundRect(ctx, 70, -860, 330, 70, 10); ctx.fillStyle = css(C('#2b3238')); ctx.fill();
    ctx.fillStyle = css(C('#3e4a52')); ctx.fillRect(84, -846, 302, 42);
    roundRect(ctx, 6, -300, 44, 66, 14); ctx.fillStyle = css(C('#fffbe6')); ctx.fill();
    roundRect(ctx, 6, -224, 34, 22, 8); ctx.fillStyle = css(C('#f2b34a')); ctx.fill();
    ctx.strokeStyle = css(C('#2b3238')); ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(40, -760); ctx.quadraticCurveTo(-20, -780, -40, -700); ctx.stroke();
    roundRect(ctx, -58, -720, 26, 90, 8); ctx.fillStyle = css(C('#2b3238')); ctx.fill();
    // 尾灯
    roundRect(ctx, 2378, -330, 18, 90, 6); ctx.fillStyle = css(C('#d4533f')); ctx.fill();
    // 车顶：亮的天光边
    ctx.save(); ctx.clip(body);
    pstroke(ctx, 1200, -866, 2300, 10, 0, C('#ffffff'), 0.7, R, 0.4);
    ctx.restore();
    ctx.strokeStyle = css(C('#29323a'), 0.8); ctx.lineWidth = 4; ctx.stroke(body);
    // 轮子：轮拱 + 轮胎 + 轮毂（运动模糊，不画辐条）
    for (const wx of WHEELS) {
      ctx.fillStyle = css(C('#232a30'));
      ctx.beginPath(); ctx.arc(wx, -110, 150, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(wx, -120, 120, 0, Math.PI * 2); ctx.fillStyle = css(C('#2b3137')); ctx.fill();
      const hg = ctx.createRadialGradient(wx - 15, -135, 5, wx, -120, 70);
      hg.addColorStop(0, css(C('#d9dee2'))); hg.addColorStop(0.6, css(C('#98a2aa'))); hg.addColorStop(1, css(C('#5f6a73')));
      ctx.beginPath(); ctx.arc(wx, -120, 66, 0, Math.PI * 2); ctx.fillStyle = hg; ctx.fill();
      ctx.beginPath(); ctx.arc(wx, -120, 20, 0, Math.PI * 2); ctx.fillStyle = css(C('#4a545c')); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(wx, -120, 112, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
    }
  });
}
// 车头 x（画面单位）、车轮着地的高度、缩放：远处开来、越来越大、并向路边靠；强拍压进积水，再加速开走
const BUS_X = [[T_WET - 3, 1330], [T_WET - 2, 1215], [T_WET - 1, 1040], [T_WET - 0.4, 800], [T_WET, 366], [T_WET + 0.5, -150], [T_WET + 1, -690], [T_WET + 2.4, -2600]];
const BUS_S = [[T_WET - 3, 0.17], [T_WET - 2, 0.22], [T_WET - 1, 0.32], [T_WET - 0.4, 0.45], [T_WET, 0.56, ease.out]];
const BUS_G = [[T_WET - 3, 712], [T_WET - 2, 722], [T_WET - 1, 742], [T_WET - 0.4, 770], [T_WET, 786, ease.out]];
function hermite(keys, x) {
  if (x <= keys[0][0]) return keys[0][1];
  const n = keys.length;
  if (x >= keys[n - 1][0]) return keys[n - 1][1];
  let i = 0;
  while (x > keys[i + 1][0]) i++;
  const [t0, p0] = keys[i], [t1, p1] = keys[i + 1], h = t1 - t0;
  const m = (k) => (k <= 0 ? (keys[1][1] - keys[0][1]) / (keys[1][0] - keys[0][0]) : k >= n - 1 ? (keys[n - 1][1] - keys[n - 2][1]) / (keys[n - 1][0] - keys[n - 2][0]) : (keys[k + 1][1] - keys[k - 1][1]) / (keys[k + 1][0] - keys[k - 1][0]));
  const t = (x - t0) / h, t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m(i) + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m(i + 1);
}
function busAt(b) {
  if (b < BUS_X[0][0] || b > BUS_X[BUS_X.length - 1][0]) return null;
  const x = hermite(BUS_X, b), s = keyframes(BUS_S, b), gy = keyframes(BUS_G, b);
  return { x, s, gy, wheel: (k) => x + WHEELS[k] * s };
}
function drawBus(ctx, b) {
  const B = busAt(b);
  if (!B) return;
  const { x, s, gy } = B;
  if (x > X_MAX + 40 || x + BUS_L * s < X_MIN - 40) return;
  const img = busImage(false), w = (BUS_L + 2 * BUS_PAD) * s, h = (BUS_H + 2 * BUS_PAD) * s;
  const haze = clamp(1 - (s - 0.17) / 0.39);
  // 车底的湿影 + 车在湿路面上的倒影
  ctx.save();
  ctx.beginPath(); ctx.rect(X_MIN, gy - 4, X_MAX - X_MIN, CURB_Y + 4 - gy + 4); ctx.clip();
  ctx.globalAlpha = 0.35;
  ctx.translate(0, 2 * gy);
  ctx.scale(1, -0.6);
  ctx.drawImage(img, x - BUS_PAD * s, gy - (BUS_H + BUS_PAD) * s, w, h);
  ctx.restore();
  ctx.fillStyle = 'rgba(40,50,60,0.28)';
  ctx.beginPath(); ctx.ellipse(x + BUS_L * s * 0.5, gy - 2, BUS_L * s * 0.52, 6 * s + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(img, x - BUS_PAD * s, gy - (BUS_H + BUS_PAD) * s, w, h);
  if (haze > 0.01) { ctx.globalAlpha = haze; ctx.drawImage(busImage(true), x - BUS_PAD * s, gy - (BUS_H + BUS_PAD) * s, w, h); ctx.globalAlpha = 1; }
  // 大灯的光晕和路面上的亮倒影
  const hx = x + 28 * s, hy = gy - 266 * s;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  softGlow(ctx, hx, hy, 70 * s + 26, C('#fff6d8'), 0.9);
  const g = ctx.createLinearGradient(0, gy, 0, gy + 160);
  g.addColorStop(0, 'rgba(255,246,214,0.55)'); g.addColorStop(1, 'rgba(255,246,214,0)');
  ctx.fillStyle = g;
  ctx.fillRect(hx - 9 * s - 4, gy, 18 * s + 8, 160);
  ctx.restore();
}

// ---------- 伞（厚涂烘焙：伞面明暗、相间的伞片、伞骨、透光的伞底、高光、水珠） ----------
const UMB = { him: { color: UMB_HIM, r: 178, h: 100 }, her: { color: UMB_HER, r: 164, h: 92 } };
function canopyPts(r, h) {
  const top = [], hem = [];
  for (let i = 0; i <= 36; i++) { const t = -1 + (2 * i) / 36; top.push([r * t, h * (1 - Math.pow(1 - t * t, 0.62))]); }
  for (let i = 1; i < 36; i++) {
    const t = 1 - (2 * i) / 36;
    const seg = (t + 1) / 0.5, f = seg - Math.floor(seg);
    hem.push([r * t * 0.985, h + 14 * (1 - t * t) - 13 * Math.sin(Math.PI * f)]);
  }
  return [...top, ...hem];
}
const tipsOf = (r, h) => [-1, -0.5, 0, 0.5, 1].map((t) => [r * t, h + 14 * (1 - t * t)]);
function canopyImage(who) {
  const U = UMB[who], pad = 40, x0 = -U.r - pad, y0 = -30 - pad, w = (2 * U.r + 2 * pad) * K, h = (U.h + 50 + 2 * pad) * K;
  const img = baked(`s16-canopy|${who}`, w, h, (ctx) => {
    ctx.scale(K, K); ctx.translate(-x0, -y0);
    const R = R0('canopy', who);
    const c = C(U.color), P = canopyPts(U.r, U.h), path = polyPath(P), tips = tipsOf(U.r, U.h);
    // 底色：左上受天光，右下偏深
    const g = ctx.createLinearGradient(-U.r * 0.6, -10, U.r * 0.7, U.h + 10);
    g.addColorStop(0, css(tone(c, 0.3))); g.addColorStop(0.45, css(c)); g.addColorStop(1, css(tone(c, -0.16)));
    ctx.fillStyle = g; ctx.fill(path);
    ctx.save(); ctx.clip(path);
    // 相间的伞片稍暗
    for (const [a, b2] of [[0, 1], [2, 3]]) {
      const tA = tips[a], tB = tips[b2];
      const panel = polyPath([[0, 0], ...P.slice(0, 37).filter(([x]) => x >= tA[0] && x <= tB[0]), tB, tA]);
      ctx.fillStyle = css(tone(c, -0.1), 0.45); ctx.fill(panel);
    }
    // 厚涂笔触：从伞顶往外放射
    for (let i = 0; i < 90; i++) {
      const t = (R() - 0.5) * 2, rr = 0.25 + R() * 0.75;
      const px = U.r * t * rr, py = U.h * (1 - Math.pow(1 - t * t, 0.62)) * 0.4 + U.h * rr * 0.65;
      const lightK = clamp(0.55 - t * 0.5 - rr * 0.2);
      pstroke(ctx, px, py, 26 + R() * 30, 9 + R() * 8, Math.atan2(py, px) + (R() - 0.5) * 0.3, jit(tone(c, lightK * 0.35 - 0.06), R, 0.04), 0.4 + R() * 0.35, R, 0.4);
    }
    // 伞底：透光的一圈（白天里伞面透着亮）
    const under = new Path2D();
    under.moveTo(tips[0][0], tips[0][1]);
    for (let i = 0; i <= 20; i++) { const t = -1 + (2 * i) / 20; under.lineTo(U.r * t * 0.985, U.h + 14 * (1 - t * t) - 13 * Math.abs(Math.sin(Math.PI * ((t + 1) / 0.5)))); }
    for (let i = 20; i >= 0; i--) { const t = -1 + (2 * i) / 20; under.lineTo(U.r * t * 0.96, U.h - 6 + 4 * (1 - t * t)); }
    under.closePath();
    ctx.fillStyle = css(tone(mixC(c, C('#fff3b0'), 0.25), 0.12), 0.75); ctx.fill(under);
    // 高光：左上一道柔和的亮弧
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 10;
    ctx.beginPath(); ctx.ellipse(-U.r * 0.05, U.h * 0.95, U.r * 0.78, U.h * 0.86, 0, Math.PI * 1.16, Math.PI * 1.42); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.ellipse(-U.r * 0.05, U.h * 0.95, U.r * 0.74, U.h * 0.8, 0, Math.PI * 1.2, Math.PI * 1.36); ctx.stroke();
    // 水珠
    for (let i = 0; i < 26; i++) {
      const t = (R() - 0.5) * 1.8, py = U.h * (1 - Math.pow(1 - t * t, 0.62)) + 6 + R() * U.h * 0.75, px = U.r * t * (0.4 + R() * 0.55), r = 1.4 + R() * 2.2;
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fillStyle = css(tone(c, -0.3), 0.5); ctx.fill();
      ctx.beginPath(); ctx.arc(px - r * 0.3, py - r * 0.35, r * 0.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill();
    }
    ctx.restore();
    // 伞骨 + 伞尖
    for (const [tx, ty] of tips) {
      ctx.strokeStyle = css(tone(c, -0.35), 0.75); ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(tx * 0.55, ty * 0.3 - 6, tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty + 2, 3.4, 0, Math.PI * 2); ctx.fillStyle = css(C('#3a3f45')); ctx.fill();
    }
    ctx.strokeStyle = css(tone(c, -0.4), 0.6); ctx.lineWidth = 1.6; ctx.stroke(path);
    ctx.fillStyle = css(C('#3a3f45')); ctx.fillRect(-2.5, -24, 5, 26);
    ctx.beginPath(); ctx.arc(0, -25, 4, 0, Math.PI * 2); ctx.fill();
  });
  return { img, x0, y0, w: w / K, h: h / K };
}
const rotP = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** 画一把伞：hand 手（握点）、apex 伞顶（局部坐标）；tilt 绕手旋转。handle：'hook' | 'straight'。 */
function drawUmbrella(ctx, who, hand, apex, tilt, b, handle) {
  const ap = [hand[0] + rotP([apex[0] - hand[0], apex[1] - hand[1]], tilt)[0], hand[1] + rotP([apex[0] - hand[0], apex[1] - hand[1]], tilt)[1]];
  const ang = Math.atan2(-(hand[0] - ap[0]), hand[1] - ap[1]);
  const [hx, hy] = hand, [ax, ay] = ap;
  const dx = hx - ax, dy = hy - ay, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
  ctx.save();
  ctx.lineCap = 'round';
  // 伞杆（金属，带一道高光）
  ctx.strokeStyle = '#3c4249'; ctx.lineWidth = 4.6;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(hx + ux * 18, hy + uy * 18); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(ax - uy * 1.2, ay + ux * 1.2); ctx.lineTo(hx - uy * 1.2, hy + ux * 1.2); ctx.stroke();
  // 伞柄
  const ex = hx + ux * 18, ey = hy + uy * 18;
  if (handle === 'hook') {
    ctx.strokeStyle = '#7b5a3e'; ctx.lineWidth = 8.5;
    ctx.beginPath(); ctx.moveTo(hx - ux * 14, hy - uy * 14); ctx.lineTo(ex, ey);
    ctx.quadraticCurveTo(ex + ux * 22, ey + uy * 22, ex - uy * 18 + ux * 10, ey + ux * 18 + uy * 10); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,230,200,0.4)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx - ux * 12 - uy * 2, hy - uy * 12 + ux * 2); ctx.lineTo(ex - uy * 2, ey + ux * 2); ctx.stroke();
  } else {
    ctx.strokeStyle = '#e9e1d2'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(hx - ux * 16, hy - uy * 16); ctx.lineTo(hx + ux * 26, hy + uy * 26); ctx.stroke();
    ctx.strokeStyle = '#b9ad98'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(hx + ux * 22 + uy * 3, hy + uy * 22 - ux * 3); ctx.lineTo(hx + ux * 26 + uy * 3, hy + uy * 26 - ux * 3); ctx.stroke();
  }
  // 伞面
  const Cn = canopyImage(who);
  ctx.translate(ax, ay);
  ctx.rotate(ang);
  ctx.drawImage(Cn.img, Cn.x0, Cn.y0, Cn.w, Cn.h);
  // 雨点打在伞面上溅开的小水花
  const U = UMB[who];
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const ph = (((b * 3.2 + hash2(i, who === 'him' ? 1 : 2, 60)) % 1) + 1) % 1, cyc = Math.floor(b * 3.2 + hash2(i, who === 'him' ? 1 : 2, 60));
    const t = (hash2(i, cyc, 61) - 0.5) * 1.8, x = U.r * t, y = U.h * (1 - Math.pow(1 - t * t, 0.62)) - 3;
    ctx.strokeStyle = `rgba(255,255,255,${(0.85 * (1 - ph)).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x, y, 2 + ph * 9, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
  }
  ctx.restore();
  return { apex: ap, ang };
}
/** 伞尖滴水：每拍从伞尖滴下几滴，落到地上（局部坐标，y = 0 是地面）。 */
function umbrellaDrips(ctx, who, P, b, rate = 1.6, extra = 0) {
  const U = UMB[who], tips = tipsOf(U.r, U.h);
  ctx.save();
  ctx.lineCap = 'round';
  const n = 2 + Math.round(extra * 3);
  for (let k = 0; k < n; k++) {
    const r = rate * (1 + extra * 2), cyc = Math.floor(b * r + hash2(k, 3, 62)), ph = b * r + hash2(k, 3, 62) - cyc;
    const tip = tips[[0, 4, 1, 3, 0][(((cyc + k) % 5) + 5) % 5]];
    const [x0, y0] = rotP(tip, P.ang); const tx = x0 + P.apex[0], ty = y0 + P.apex[1] + 4;
    if (ph < 0.25) { // 挂在伞尖、慢慢变大
      ctx.fillStyle = 'rgba(232,240,246,0.95)'; ctx.beginPath(); ctx.arc(tx, ty + ph * 8, 2 + ph * 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(70,90,110,0.35)'; ctx.beginPath(); ctx.arc(tx, ty + ph * 8, 2 + ph * 6, 0.2, Math.PI - 0.2); ctx.fill();
    } else {
      const f = (ph - 0.25) / 0.45;
      if (f < 1) {
        const y = ty + 4 + f * f * (-ty - 4);
        ctx.strokeStyle = 'rgba(226,236,244,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx, y - 12); ctx.lineTo(tx, y); ctx.stroke();
        ctx.strokeStyle = 'rgba(70,90,110,0.3)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tx + 1.5, y - 10); ctx.lineTo(tx + 1.5, y); ctx.stroke();
      } else {
        const sp = (f - 1) / 0.6;
        if (sp < 1) {
          ctx.strokeStyle = `rgba(240,245,250,${(0.85 * (1 - sp)).toFixed(3)})`; ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.ellipse(tx, 4, 4 + sp * 20, 1.5 + sp * 4, 0, 0, Math.PI * 2); ctx.stroke();
        }
      }
    }
  }
  ctx.restore();
}

// ---------- 他：伞跟手（走路时从帧里找手的位置） ----------
const HIM_APEX = [20, -634], HIM_HAND = ANCHORS.stand.handR;
function handTrack() {
  const W = activeWalk();
  if (!W) return null;
  return memo(`s16-hand|${W.name}`, () => {
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
function himPose(fig) {
  if (fig.pose === 'stand') return { hand: HIM_HAND, apex: HIM_APEX };
  const tr = handTrack();
  const [hx, hy] = tr ? tr[frameIndex(fig.phase || 0)] : ANCHORS.walk.hand;
  return { hand: [hx, hy], apex: [6 + (hx - 30) * 0.3, -640 + (hy + 250) * 0.25] };
}

// ---------- 倒影（离屏上下翻转，往下渐隐，横向水纹错开） ----------
let reflCanvas = null;
function drawReflection(ctx, draw, b, { x0 = -280, x1 = 380, h = 210, a = 0.42, seed = 0 } = {}) {
  const w = Math.ceil((x1 - x0) * K), hh = Math.ceil(h * K);
  if (!reflCanvas || reflCanvas.width < w || reflCanvas.height < hh) reflCanvas = makeCanvas(Math.max(w, reflCanvas ? reflCanvas.width : 0), Math.max(hh, reflCanvas ? reflCanvas.height : 0));
  const g = reflCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; g.filter = 'none';
  g.clearRect(0, 0, reflCanvas.width, reflCanvas.height);
  g.setTransform(K, 0, 0, -K, -x0 * K, 0);
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createLinearGradient(0, 0, 0, hh);
  gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.35})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, hh);
  g.globalCompositeOperation = 'source-over';
  const band = 5;
  for (let y = 0; y < hh; y += band) {
    const dx = Math.sin(y * 0.23 + b * 4.2 + seed) * (1 + (y / hh) * 4.5);
    ctx.drawImage(reflCanvas, 0, y, w, band, x0 + dx, 1 + y / K, w / K, band / K);
  }
}

// ---------- 女主角（原创：米色风衣、灰绿百褶裙、深色短靴、齐肩深棕发；侧身望着车来的方向） ----------
const HER_HAND = [27, -338], HER_APEX = [-14, -596];
const SKIN = C('#efcfb8'), SKIN_D = C('#d4a58e'), SKIN_L = C('#f8e4d4');
const HAIR = C('#3a2b26'), HAIR_L = C('#7a5d52');
const COAT = C('#d6c4a3'), COAT_L = C('#eee3cc'), COAT_D = C('#ad9a7b');
const SKIRT = C('#93a592'), BOOT = C('#4a3a31'), TIGHTS = C('#4c4442');
function fillShape(ctx, pts, fill, smooth = true) {
  if (smooth) smoothPath(ctx, pts, true);
  else { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
  ctx.fillStyle = fill;
  ctx.fill();
}
function lgrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [t, c, a = 1] of stops) g.addColorStop(t, css(c, a));
  return g;
}
/** 在当前路径里撒几笔（固定种子，每帧一样，不闪）。 */
function strokesIn(ctx, seed, box, col, n, o = {}) {
  const R = R0('her', seed), [x0, y0, x1, y1] = box;
  ctx.save();
  ctx.clip();
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * (x1 - x0), y = y0 + R() * (y1 - y0);
    pstroke(ctx, x, y, lerp(o.len?.[0] ?? 10, o.len?.[1] ?? 24, R()), lerp(o.wid?.[0] ?? 4, o.wid?.[1] ?? 8, R()), (o.ang ?? Math.PI / 2) + (R() - 0.5) * (o.angJ ?? 0.4), jit(col(x, y), R, o.jt ?? 0.05), lerp(o.a?.[0] ?? 0.3, o.a?.[1] ?? 0.6, R()), R, o.br ?? 0.4);
  }
  ctx.restore();
}
/** 她（不含伞），局部坐标：脚下中点为原点。b 用来做呼吸、风吹的细微动作。 */
function drawHer(ctx, b) {
  const breath = Math.sin((b / 4) * Math.PI * 2);
  const gust = gustAt(b);
  const wind = 0.5 + 0.5 * Math.sin(b * Math.PI * 0.9) + gust * 2.2;   // 头发、裙摆被风吹（风从右来，往左飘）
  const flutter = Math.sin(b * Math.PI * 3.1);
  const flinch = smoothstep(T_HIT - 0.15, T_HIT, b) * (1 - smoothstep(T_HIT + 0.4, T_HIT + 1.4, b));
  ctx.save();
  ctx.lineJoin = 'round';
  // 后面的头发（被风往左吹）
  ctx.save();
  ctx.translate(0, flinch * 4);
  const hb = (k) => -wind * k;
  fillShape(ctx, [[-4, -470], [-28, -462], [-40, -440], [-46 + hb(4), -410], [-52 + hb(9), -384], [-44 + hb(12), -372], [-30 + hb(8), -378], [-18 + hb(4), -372], [-10, -390], [6, -410], [14, -440]],
    lgrad(ctx, -40, -470, 10, -380, [[0, HAIR_L], [0.4, HAIR], [1, tone(HAIR, -0.2)]]));
  ctx.restore();
  // 腿和靴子
  fillShape(ctx, [[-14, -112], [3, -112], [3, -84], [1, -62], [0, -44], [-10, -44], [-12, -66], [-15, -88]], lgrad(ctx, -14, 0, 3, 0, [[0, tone(TIGHTS, -0.1)], [1, TIGHTS]]), false);
  fillShape(ctx, [[5, -112], [22, -112], [23, -86], [22, -62], [21, -44], [11, -44], [8, -66], [6, -88]], lgrad(ctx, 5, 0, 23, 0, [[0, tone(TIGHTS, 0.02)], [0.6, tone(TIGHTS, 0.14)], [1, TIGHTS]]), false);
  for (const [x0, toe] of [[-13, 10], [8, 34]]) {
    fillShape(ctx, [[x0, -50], [x0 + 15, -50], [x0 + 16, -16], [toe, -12], [toe + 6, -4], [toe + 4, 0], [x0 - 2, 0], [x0 - 2, -20]], lgrad(ctx, x0, -50, toe, 0, [[0, tone(BOOT, 0.12)], [1, tone(BOOT, -0.15)]]));
    ctx.fillStyle = css(C('#2a221d')); ctx.fillRect(x0 - 2, -3, toe + 8 - x0, 3);
    ctx.strokeStyle = 'rgba(255,240,225,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0 + 2, -46); ctx.lineTo(x0 + 3, -20); ctx.stroke();
  }
  // 百褶裙（下摆随风轻摆）
  ctx.save();
  ctx.translate(0, flinch * 3);
  const sk = [[-26, -182], [30, -182]];
  const hem = [];
  for (let k = 0; k <= 8; k++) {
    const t = k / 8, x = lerp(40, -38, t) + (-wind * 7 - flutter * 1.5) * (0.4 + t * 0.6);
    hem.push([x, -104 + Math.sin(t * Math.PI * 4 + b * 4) * 2.2 * (0.6 + gust)]);
  }
  const skirtPts = [...sk, [36, -140], ...hem, [-34, -140]];
  fillShape(ctx, skirtPts, lgrad(ctx, -30, -180, 34, -104, [[0, tone(SKIRT, 0.18)], [0.6, SKIRT], [1, tone(SKIRT, -0.15)]]), false);
  ctx.strokeStyle = css(tone(SKIRT, -0.22), 0.6); ctx.lineWidth = 1.4;
  for (let k = 1; k < 8; k++) { const [hx, hy] = hem[k]; ctx.beginPath(); ctx.moveTo(lerp(30, -26, k / 8), -176); ctx.lineTo(hx, hy); ctx.stroke(); }
  ctx.restore();
  // 风衣：身体随呼吸微微起伏
  ctx.save();
  ctx.translate(0, -180);
  ctx.scale(1, 1 + breath * 0.006 - flinch * 0.012);
  ctx.translate(0, 180 + flinch * 2);
  const coatTail = -wind * 3 + flutter * 0.8;
  const coat = [[-22, -386], [20, -388], [32, -366], [36, -340], [28, -306], [30, -270], [36, -224], [44, -170], [10, -166], [-20, -168], [-42 + coatTail, -172], [-38, -236], [-26, -300], [-32, -344]];
  fillShape(ctx, coat, lgrad(ctx, -40, -390, 40, -170, [[0, COAT_L], [0.45, COAT], [1, COAT_D]]));
  smoothPath(ctx, coat, true);
  strokesIn(ctx, 1, [-46, -392, 48, -164], (x, y) => mixC(COAT_L, COAT_D, clamp((x + 30) / 80 + (y + 390) / 600)), 60, { len: [16, 34], wid: [5, 9], ang: Math.PI / 2, angJ: 0.3, a: [0.25, 0.55] });
  // 褶皱、门襟、腰带、扣子
  ctx.strokeStyle = css(COAT_D, 0.85); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(24, -300); ctx.quadraticCurveTo(30, -240, 40, -172); ctx.stroke();
  ctx.strokeStyle = css(tone(COAT_D, -0.15), 0.5); ctx.lineWidth = 1.6;
  for (const [x0, x1] of [[-8, -14], [6, 4], [-26, -34]]) { ctx.beginPath(); ctx.moveTo(x0, -290); ctx.quadraticCurveTo(x0 - 2, -230, x1, -172); ctx.stroke(); }
  fillShape(ctx, [[-28, -306], [30, -310], [31, -294], [-27, -290]], css(tone(COAT, -0.2)), false);
  ctx.fillStyle = css(tone(COAT, 0.15), 0.6); ctx.fillRect(-26, -306, 54, 2);
  // 背光一侧（左）的暗面 + 袖子的褶
  ctx.save(); smoothPath(ctx, coat, true); ctx.clip();
  const bs = ctx.createLinearGradient(-44, 0, -10, 0);
  bs.addColorStop(0, css(COAT_D, 0.7)); bs.addColorStop(1, css(COAT_D, 0));
  ctx.fillStyle = bs; ctx.fillRect(-46, -392, 40, 230);
  ctx.restore();
  ctx.fillStyle = css(C('#8a7357')); ctx.fillRect(20, -307, 8, 14);
  for (const y of [-356, -330]) { ctx.beginPath(); ctx.arc(20, y, 2.6, 0, Math.PI * 2); ctx.fillStyle = css(C('#6b5644')); ctx.fill(); }
  // 领子（翻领）
  fillShape(ctx, [[-14, -390], [14, -392], [24, -376], [12, -350], [4, -372], [-8, -372]], lgrad(ctx, -14, -392, 24, -350, [[0, tone(COAT_L, 0.2)], [1, COAT]]));
  ctx.strokeStyle = css(COAT_D, 0.7); ctx.lineWidth = 1.3; smoothPath(ctx, [[-14, -390], [14, -392], [24, -376], [12, -350], [4, -372], [-8, -372]], true); ctx.stroke();
  // 斜挎小包（带子 + 包）
  ctx.strokeStyle = css(C('#6e5340')); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(14, -384); ctx.quadraticCurveTo(-4, -320, -30, -262); ctx.stroke();
  fillShape(ctx, [[-44, -270], [-14, -272], [-12, -238], [-42, -236]], lgrad(ctx, -44, -272, -12, -236, [[0, C('#a07a5d')], [1, C('#6e5340')]]), false);
  ctx.fillStyle = 'rgba(255,235,215,0.35)'; ctx.fillRect(-42, -270, 28, 2.5);
  // 围巾（浅奶白，一端垂在胸前，随风动）
  fillShape(ctx, [[-14, -398], [16, -400], [22, -384], [-12, -380]], lgrad(ctx, -14, -400, 22, -380, [[0, C('#fbf6ee')], [1, C('#ddd3c4')]]));
  const se = -wind * 2.5 + flutter;
  fillShape(ctx, [[12, -386], [22, -384], [24 + se * 0.5, -344], [18 + se, -326], [10 + se, -330], [10, -360]], lgrad(ctx, 10, -386, 24, -326, [[0, C('#f6f0e6')], [1, C('#d8cebf')]]));
  ctx.restore();
  // 手臂（近处的左臂：肘部下垂，前臂抬起握伞）
  const arm = [[14, -380], [30, -372], [34, -330], [26, -298], [40, -330], [36, -346], [24, -340], [18, -306], [6, -312], [10, -360]];
  fillShape(ctx, [[12, -382], [30, -374], [32, -340], [26, -300], [12, -300], [6, -340]], lgrad(ctx, 6, -382, 32, -300, [[0, COAT_L], [1, COAT_D]]));
  fillShape(ctx, [[14, -306], [26, -302], [38, -332], [30, -340]], lgrad(ctx, 14, -340, 38, -300, [[0, COAT], [1, COAT_D]]));
  void arm;
  ctx.fillStyle = css(tone(COAT_D, -0.1)); ctx.beginPath(); ctx.ellipse(34, -334, 6, 4, -0.9, 0, Math.PI * 2); ctx.fill();
  // 手（握着伞柄）
  fillShape(ctx, [[22, -344], [34, -348], [38, -336], [32, -328], [22, -330]], lgrad(ctx, 22, -348, 38, -328, [[0, SKIN_L], [1, SKIN_D]]));
  ctx.strokeStyle = css(SKIN_D, 0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(26, -340); ctx.lineTo(34, -341); ctx.moveTo(26, -335); ctx.lineTo(34, -336); ctx.stroke();
  // 头：侧脸朝右（望着车来的方向）
  ctx.save();
  ctx.translate(4, -410);
  ctx.rotate(-flinch * 0.06 + Math.sin(b * Math.PI * 0.5) * 0.01);
  ctx.translate(-4, 410 + flinch * 3);
  // 脖子
  fillShape(ctx, [[2, -412], [16, -414], [18, -392], [4, -390]], lgrad(ctx, 0, -414, 18, -390, [[0, SKIN_D], [1, tone(SKIN_D, -0.08)]]), false);
  // 脸
  const face = [[-8, -470], [18, -474], [28, -464], [32, -452], [32, -446], [38, -437], [37, -433], [33, -431], [34, -425], [32, -421], [33, -418], [30, -413], [28, -409], [18, -405], [8, -408], [-2, -418], [-8, -440]];
  fillShape(ctx, face, lgrad(ctx, -8, -474, 36, -405, [[0, SKIN_L], [0.55, SKIN], [1, SKIN_D]]), false);
  smoothPath(ctx, face, true);
  strokesIn(ctx, 2, [-8, -476, 40, -404], (x, y) => mixC(SKIN_L, SKIN_D, clamp((y + 470) / 70 - (x - 20) / 80)), 14, { len: [6, 12], wid: [3, 6], ang: 1.2, a: [0.2, 0.4], br: 0.2 });
  // 腮红、眉、眼、唇
  // 下颌、颧骨下的阴影，脸颊的亮面
  ctx.save(); smoothPath(ctx, face, true); ctx.clip();
  ctx.fillStyle = css(SKIN_D, 0.55);
  ctx.beginPath(); ctx.moveTo(-4, -420); ctx.quadraticCurveTo(12, -414, 26, -410); ctx.lineTo(30, -404); ctx.lineTo(-6, -400); ctx.closePath(); ctx.fill();
  softGlow(ctx, 20, -440, 10, SKIN_L, 0.7);
  ctx.restore();
  softGlow(ctx, 21, -428, 11, C('#eba596'), 0.5);
  ctx.strokeStyle = css(C('#5a4038')); ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(19, -451); ctx.quadraticCurveTo(26, -454, 31, -451); ctx.stroke();
  ctx.strokeStyle = css(C('#2e221e')); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(23, -443); ctx.quadraticCurveTo(28, -446, 32, -442); ctx.stroke();
  ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(32, -442); ctx.lineTo(35, -444); ctx.moveTo(31, -443); ctx.lineTo(33, -446); ctx.stroke();
  ctx.fillStyle = css(C('#3a2a24')); ctx.beginPath(); ctx.ellipse(29, -441, 2.1, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  fillShape(ctx, [[31.5, -423.5], [34.5, -423], [33.8, -420.5], [31.5, -420]], css(C('#cf8a80')), false);
  ctx.strokeStyle = css(C('#9e5c55'), 0.8); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(31, -421.8); ctx.lineTo(34.4, -421.7); ctx.stroke();
  ctx.strokeStyle = css(SKIN_D, 0.9); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(33, -432); ctx.quadraticCurveTo(31, -431, 30, -432); ctx.stroke();
  // 鼻梁、颧骨的高光
  ctx.strokeStyle = 'rgba(255,248,240,0.7)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(33, -447); ctx.lineTo(37, -436); ctx.stroke();
  // 前面的头发：头顶、刘海、耳后垂下的一缕（随风）
  const hairTop = [[-30, -452], [-24, -474], [-2, -484], [22, -480], [32, -466], [30, -458], [20, -462], [8, -456], [2, -440], [0, -420], [-8, -404], [-14 + hb(3), -392], [-24 + hb(5), -400], [-30, -420]];
  fillShape(ctx, hairTop, lgrad(ctx, -30, -484, 20, -400, [[0, HAIR_L], [0.35, tone(HAIR, 0.06)], [1, tone(HAIR, -0.15)]]));
  smoothPath(ctx, hairTop, true);
  strokesIn(ctx, 3, [-32, -486, 34, -390], (x, y) => mixC(HAIR_L, HAIR, clamp((y + 484) / 50)), 26, { len: [12, 26], wid: [2.5, 5], ang: 1.9, angJ: 0.5, a: [0.3, 0.6], br: 0.6 });
  // 发丝（几缕被风吹开）
  ctx.strokeStyle = css(HAIR, 0.85); ctx.lineWidth = 1.4;
  for (let k = 0; k < 6; k++) {
    const y0 = -470 + k * 12, sway = -wind * (3 + k * 1.5) + Math.sin(b * 5 + k) * 1.2;
    ctx.beginPath(); ctx.moveTo(-26, y0); ctx.quadraticCurveTo(-40 + sway * 0.5, y0 + 10, -46 + sway, y0 + 22 + k * 2); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(200,170,150,0.55)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-18, -478); ctx.quadraticCurveTo(4, -486, 20, -476); ctx.stroke();
  // 发丝的高光和走向
  ctx.lineWidth = 1;
  for (let k = 0; k < 7; k++) {
    ctx.strokeStyle = k % 2 ? 'rgba(150,115,100,0.55)' : 'rgba(25,18,15,0.45)';
    const x0 = -20 + k * 5;
    ctx.beginPath(); ctx.moveTo(x0, -480 + Math.abs(k - 3) * 1.5); ctx.quadraticCurveTo(x0 - 10, -455, x0 - 14 - k, -420 + k * 2); ctx.stroke();
  }
  ctx.restore();
  // 右侧（朝光的一边）一道很淡的天光轮廓
  ctx.restore();
}
/** 她在场景里的位置（画面单位）。 */
function herPlace(env, cam) {
  return { x: HER_X + env.camAt(GAG) - cam, y: HER_Y };
}
function drawHerAll(ctx, b, env, cam) {
  const P = herPlace(env, cam);
  if (P.x < X_MIN - 260 || P.x > X_MAX + 260) return;
  ctx.save();
  ctx.translate(P.x, P.y);
  // 倒影
  drawReflection(ctx, (g) => { drawHer(g, b); }, b, { x0: -80, x1: 90, h: 200, a: 0.4, seed: 3 });
  // 脚下的柔影
  const sg = ctx.createRadialGradient(4, 2, 2, 4, 2, 60);
  sg.addColorStop(0, 'rgba(50,60,70,0.35)'); sg.addColorStop(1, 'rgba(50,60,70,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(4, 2, 60, 9, 0, 0, Math.PI * 2); ctx.fill();
  // 伞先画：伞杆靠在她肩后，手握在伞柄上（手画在伞杆前面）
  const P2 = drawUmbrella(ctx, 'her', HER_HAND, HER_APEX, tiltAt(b) + courtesyAt(b), b, 'straight');
  drawHer(ctx, b);
  umbrellaDrips(ctx, 'her', P2, b + 0.37, 1.5, smoothstep(T_HIT + 0.2, T_HIT + 0.6, b) * (1 - smoothstep(T_HIT + 2, T_HIT + 3.5, b)));
  ctx.restore();
}

// ---------- 雨（三层：远处细而淡、近处长而清楚；方向一致略斜） ----------
const RAIN = [
  { n: 300, p: 0.9, len: [14, 26], w: 1.0, a: 0.36, sp: 1500, seed: 1 },
  { n: 170, p: 1.15, len: [30, 50], w: 1.6, a: 0.42, sp: 1900, seed: 2 },
  { n: 46, p: 1.6, len: [80, 130], w: 2.6, a: 0.42, sp: 2700, seed: 3 },
];
const SLANT = 0.17;
function drawRain(ctx, b, cam, amt) {
  const span = X_MAX - X_MIN + 260;
  ctx.save();
  ctx.lineCap = 'round';
  for (const L of RAIN) {
    const n = Math.round(L.n * amt);
    const light = new Path2D(), dark = new Path2D();
    for (let i = 0; i < n; i++) {
      const sp = L.sp * (0.85 + hash2(i, 1, L.seed) * 0.3), len = lerp(L.len[0], L.len[1], hash2(i, 2, L.seed));
      const y = ((hash2(i, 3, L.seed) * 1300 + b * sp) % 1300) - 150;
      const x = ((((hash2(i, 4, L.seed) * span - cam * L.p + y * SLANT) % span) + span) % span) + X_MIN - 130;
      light.moveTo(x, y); light.lineTo(x - len * SLANT, y + len);
      dark.moveTo(x + L.w * 0.9, y + 2); dark.lineTo(x + L.w * 0.9 - len * SLANT, y + len + 2);
    }
    ctx.lineWidth = L.w * 1.1; ctx.strokeStyle = `rgba(78,94,110,${(L.a * 0.4).toFixed(3)})`; ctx.stroke(dark);
    ctx.lineWidth = L.w; ctx.strokeStyle = `rgba(250,252,255,${L.a.toFixed(3)})`; ctx.stroke(light);
  }
  ctx.restore();
}
/** 地上的雨点：小水花（皇冠）+ 水圈（跟着路面平移）。 */
function drawGroundRain(ctx, b, cam, amt) {
  const span = X_MAX - X_MIN + 200;
  ctx.save();
  ctx.lineWidth = 1.3;
  const n = Math.round(60 * amt);
  for (let i = 0; i < n; i++) {
    const rate = 1.4, ph0 = b * rate + hash2(i, 5, 20), cyc = Math.floor(ph0), ph = ph0 - cyc;
    const road = i % 4 === 0;
    const p = road ? P_ROAD : 1;
    const wx = hash2(i, cyc, 21) * span, y = road ? 712 + hash2(i, cyc, 22) * 72 : 806 + hash2(i, cyc, 22) * 190;
    const x = ((((wx - cam * p) % span) + span) % span) + X_MIN - 100;
    const s1 = road ? 0.5 : 0.6 + (y - 800) / 240;
    ctx.strokeStyle = `rgba(244,247,250,${(0.7 * (1 - ph)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(x, y, (3 + ph * 20) * s1, (1 + ph * 4) * s1, 0, 0, Math.PI * 2); ctx.stroke();
    if (ph < 0.25) {  // 溅起的小皇冠
      const k = ph / 0.25;
      ctx.strokeStyle = `rgba(250,252,255,${(0.8 * (1 - k)).toFixed(3)})`;
      ctx.beginPath();
      for (const d of [-1, -0.4, 0.4, 1]) { ctx.moveTo(x + d * 2 * s1, y); ctx.lineTo(x + d * (4 + k * 6) * s1, y - (5 + k * 4) * s1 * (1.2 - Math.abs(d) * 0.4)); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 候车亭的水：顶棚上流动的水、前沿滴水、右端的一股细流 ----------
function drawShelterWater(ctx, b, env, cam) {
  const G = shelterGeo(env.camAt(GAG));
  const o = G.o - cam;
  if (SH_X1 + o < X_MIN - 50 || SH_X0 + o > X_MAX + 50) return;
  ctx.save();
  ctx.lineCap = 'round';
  // 顶棚玻璃上往右流的水（亮的短线）
  for (let i = 0; i < 26; i++) {
    const ph = (((b * 0.55 + hash2(i, 1, 70)) % 1) + 1) % 1;
    const x = lerp(SH_X0 + 10, SH_X1 - 8, ph) + o, y = ROOF_Y(x - o) + 8 + hash2(i, 2, 70) * 12;
    ctx.strokeStyle = `rgba(255,255,255,${(0.75 * Math.sin(Math.PI * ph)).toFixed(3)})`; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - 14, y - 0.3); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = `rgba(90,110,125,${(0.4 * Math.sin(Math.PI * ph)).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(x + 1, y + 1, 1.8, 0, Math.PI * 2); ctx.fill();
  }
  // 前沿滴水
  for (let i = 0; i < 9; i++) {
    const lx = lerp(SH_X0 + 30, SH_X1 - 40, (i + hash2(i, 3, 71) * 0.6) / 9), x = lx + o, y0 = ROOF_Y(lx) + 26;
    const cyc = b * (0.9 + hash2(i, 4, 71) * 0.6) + hash2(i, 5, 71), ph = cyc - Math.floor(cyc);
    if (ph < 0.35) { ctx.fillStyle = 'rgba(232,240,246,0.95)'; ctx.beginPath(); ctx.arc(x, y0 + ph * 6, 1.6 + ph * 5, 0, Math.PI * 2); ctx.fill(); }
    else {
      const f = (ph - 0.35) / 0.4;
      if (f < 1) {
        const y = y0 + 4 + f * f * (800 - y0);
        ctx.strokeStyle = 'rgba(232,240,246,0.9)'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(x, y - 14); ctx.lineTo(x, y); ctx.stroke();
      } else {
        const sp = (f - 1) / 0.6;
        ctx.strokeStyle = `rgba(240,245,250,${(0.8 * (1 - sp)).toFixed(3)})`; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.ellipse(x, 802, 4 + sp * 16, 1.5 + sp * 3, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
  // 右端排水：一股细流落到地上
  const sx = SH_X1 + o + 2, sy = ROOF_Y(SH_X1) + 14;
  ctx.strokeStyle = 'rgba(236,243,248,0.85)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sx, sy);
  for (let y = sy; y <= 800; y += 18) ctx.lineTo(sx + 3 + Math.sin(y * 0.05 - b * 9) * 1.6 + (y - sy) * 0.012, y);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(90,110,125,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx + 2.5, sy + 4); for (let y = sy + 4; y <= 798; y += 18) ctx.lineTo(sx + 5.5 + Math.sin(y * 0.05 - b * 9) * 1.6 + (y - sy) * 0.012, y); ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const ph = ((b * 2.4 + k / 3) % 1 + 1) % 1;
    ctx.strokeStyle = `rgba(245,248,250,${(0.85 * (1 - ph)).toFixed(3)})`; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.ellipse(sx + 12, 803, 5 + ph * 26, 1.5 + ph * 5, 0, 0, Math.PI * 2); ctx.stroke();
  }
  // 背板玻璃上慢慢往下爬的水珠
  for (let i = 0; i < 6; i++) {
    const lx = lerp(POSTS[0] + 30, POSTS[1] - 30, hash2(i, 6, 72)), ph = (((b * 0.22 + hash2(i, 7, 72)) % 1) + 1) % 1;
    const y = 310 + ph * 420, x = lx + o + Math.sin(ph * 9 + i) * 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y - 60 * Math.min(1, ph * 4)); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = 'rgba(110,128,140,0.5)'; ctx.beginPath(); ctx.arc(x, y + 1, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(x - 1, y - 0.5, 1.5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

// ---------- 水花（第 9 拍强拍：车轮压过路边积水） ----------
const G_ACC = 7000;  // 重力（单位/拍²）
function splashParticles() {
  return memo('s16-splash', () => {
    const P = [];
    const emit = (n, wheel, t0, t1, power, seed) => {
      for (let i = 0; i < n; i++) {
        const u = hash2(i, 1, seed), te = lerp(t0, t1, u);
        const B = busAt(te);
        if (!B) continue;
        const x0 = B.wheel(wheel) + (hash2(i, 2, seed) - 0.5) * 24;
        if (x0 < PUD0 - 10 || x0 > PUD1 + 10) continue;
        const k = 1 - u * 0.45;
        const vy = power * k * (0.55 + 0.45 * Math.pow(hash2(i, 3, seed), 0.6));
        const vx = (hash2(i, 4, seed) - 0.5) * 900 - 200;
        const z = Math.pow(hash2(i, 5, seed), 0.8);
        const r = 1.5 + hash2(i, 6, seed) * 2.4 + z * 2.6;
        P.push({ te, x0, vy, vx, z, r, T: (2 * vy) / G_ACC, seed: i });
      }
    };
    emit(220, 0, T_WET, T_WET + 0.45, 2700, 81);
    emit(90, 1, T_WET + 0.75, T_WET + 1.25, 1700, 82);
    return P;
  });
}
function particleAt(p, b) {
  const dt = b - p.te;
  if (dt < 0 || dt > p.T) return null;
  const hgt = p.vy * dt - 0.5 * G_ACC * dt * dt;
  const f = dt / p.T;
  const gy = lerp(784, 806 + p.z * 180, f);
  return { x: p.x0 + p.vx * dt, y: gy - hgt * (0.8 + p.z * 0.35), vx: p.vx, vy: -(p.vy - G_ACC * dt), f };
}
/** 水幕：车轮后面扬起的一片（画在人物后面）。 */
function drawSplashSheet(ctx, b) {
  if (b < T_WET - 0.02 || b > T_WET + 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  const heads = [];
  for (const [wheel, t0, t1, power] of [[0, T_WET, T_WET + 0.45, 2700], [1, T_WET + 0.75, T_WET + 1.25, 1700]]) {
    for (let k = 0; k <= 26; k++) {
      const te = lerp(t0, t1, k / 26);
      if (te > b) break;
      const B = busAt(te);
      if (!B) continue;
      const x0 = B.wheel(wheel);
      if (x0 < PUD0 || x0 > PUD1) continue;
      const vy = power * (1 - (k / 26) * 0.45) * (0.92 + hash2(k, wheel, 83) * 0.16), vx = -200 + (hash2(k, wheel, 84) - 0.5) * 700, T = (2 * vy) / G_ACC;
      const pts = [];
      for (let s = Math.max(te, b - 0.3); s <= b + 1e-6; s += 0.02) {
        const dt = s - te;
        if (dt > T) break;
        pts.push([x0 + vx * dt, 784 - (vy * dt - 0.5 * G_ACC * dt * dt) * 0.95]);
      }
      if (pts.length < 2) continue;
      const age = clamp((b - te) / T), fade = 1 - age * age;
      if (wheel === 0) heads.push([pts[pts.length - 1], x0, fade]);
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      const wd = 1 - age * 0.45;
      ctx.strokeStyle = `rgba(110,130,148,${(0.1 * fade).toFixed(3)})`; ctx.lineWidth = 58 * wd; ctx.stroke();
      ctx.strokeStyle = `rgba(228,237,243,${(0.2 * fade).toFixed(3)})`; ctx.lineWidth = 46 * wd; ctx.stroke();
      ctx.strokeStyle = `rgba(248,251,253,${(0.24 * fade).toFixed(3)})`; ctx.lineWidth = 20 * wd; ctx.stroke();
      // 浪头：最前面一小段亮白的笔触
      const [hx, hy] = pts[pts.length - 1], [px, py] = pts[Math.max(0, pts.length - 4)];
      ctx.strokeStyle = `rgba(255,255,255,${(0.85 * fade).toFixed(3)})`; ctx.lineWidth = 7 * wd;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(hx, hy); ctx.stroke();
    }
  }
  // 水幕的「身体」：各道水弧的顶端连成一片，模糊后半透明地铺上
  if (heads.length > 2) {
    ctx.save();
    ctx.filter = 'blur(7px)';
    ctx.beginPath();
    heads.forEach(([[x, y]], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    for (let i = heads.length - 1; i >= 0; i--) ctx.lineTo(heads[i][1], 786);
    ctx.closePath();
    const fa = heads.reduce((a, h) => a + h[2], 0) / heads.length;
    ctx.fillStyle = `rgba(236,243,247,${(0.42 * fa).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }
  // 车轮边上翻起的白浪
  const B = busAt(b);
  if (B) for (const wheel of [0, 1]) {
    const x = B.wheel(wheel);
    if (x < PUD0 || x > PUD1) continue;
    const s = B.s;
    ctx.fillStyle = 'rgba(244,248,250,0.85)';
    ctx.beginPath(); ctx.ellipse(x + 30 * s, 778, 150 * s, 40 * s, -0.25, Math.PI, Math.PI * 2); ctx.fill();
    softGlow(ctx, x, 760, 140, C('#ffffff'), 0.55);
  }
  ctx.restore();
}
/** 水滴（画在人物前面）+ 落地的水圈 + 水雾。 */
function drawSplashFront(ctx, b) {
  if (b < T_WET - 0.02 || b > T_WET + 3.6) return;
  const P = splashParticles();
  ctx.save();
  // 水雾
  const mist = smoothstep(T_WET - 0.02, T_WET + 0.2, b) * (1 - smoothstep(T_HIT + 0.4, T_HIT + 1.6, b));
  if (mist > 0.01) for (let k = 0; k < 7; k++) {
    const x = lerp(PUD0 + 20, PUD1 - 20, k / 6) - (b - T_WET) * 60, y = 700 - (b - T_WET) * 80 - hash2(k, 1, 90) * 120;
    softGlow(ctx, x, y, 130 + hash2(k, 2, 90) * 80, C('#ffffff'), 0.32 * mist);
  }
  for (const p of P) {
    const q = particleAt(p, b);
    if (q) {
      // 运动中的水滴：沿速度方向拉长的亮线（下面垫一道淡的暗边，浅色背景上也看得见）
      const sp = Math.hypot(q.vx, q.vy) || 1, ux = q.vx / sp, uy = q.vy / sp;
      const L = p.r * (0.8 + Math.min(2.6, sp / 900)), w = p.r * 0.95;
      const al = 1 - smoothstep(0.75, 1, q.f) * 0.5;
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(84,104,122,${(0.22 * al).toFixed(3)})`; ctx.lineWidth = w + 1.6;
      ctx.beginPath(); ctx.moveTo(q.x - ux * L + 0.8, q.y - uy * L + 1.2); ctx.lineTo(q.x + 0.8, q.y + 1.2); ctx.stroke();
      ctx.strokeStyle = `rgba(242,247,250,${(0.7 * al).toFixed(3)})`; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(q.x - ux * L, q.y - uy * L); ctx.lineTo(q.x, q.y); ctx.stroke();
      ctx.fillStyle = `rgba(255,255,255,${al.toFixed(3)})`; ctx.beginPath(); ctx.arc(q.x, q.y, w * 0.45, 0, Math.PI * 2); ctx.fill();
    } else if (b > p.te + p.T && b < p.te + p.T + 0.8 && p.seed % 2 === 0) {
      const sp = (b - p.te - p.T) / 0.8, x = p.x0 + p.vx * p.T, y = 806 + p.z * 180;
      ctx.strokeStyle = `rgba(242,246,250,${(0.8 * (1 - sp)).toFixed(3)})`; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(x, y, (4 + sp * 26) * (0.6 + p.z), (1.5 + sp * 5) * (0.6 + p.z), 0, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 他被溅湿：几颗水珠挂在身上慢慢往下滑 ----------
function drawWetDrops(ctx, b) {
  const t = b - (T_HIT + 0.45);
  if (t < 0 || b > GAG + 4) return;
  const fade = 1 - smoothstep(GAG + 3.4, GAG + 4, b);
  for (let i = 0; i < 9; i++) {
    const x = -22 + hash2(i, 1, 95) * 62, y0 = -380 + hash2(i, 2, 95) * 260, sl = Math.min(40, t * (8 + hash2(i, 3, 95) * 20));
    const r = 1.8 + hash2(i, 4, 95) * 1.6;
    // 水把布料洇深一道，水珠挂在下端
    ctx.strokeStyle = `rgba(8,12,18,${(0.3 * fade).toFixed(3)})`; ctx.lineWidth = r * 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 + sl); ctx.stroke();
    ctx.fillStyle = `rgba(200,214,226,${(0.75 * fade).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y0 + sl, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${fade.toFixed(3)})`; ctx.beginPath(); ctx.arc(x - r * 0.3, y0 + sl - r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
  }
}

// ---------- 标题卡、歌名底板：半透明浅灰磨砂玻璃，挂着水珠 ----------
let frostScratch = null;
function frostPanel(ctx, x, y, w, h, b, seed) {
  ctx.save();
  roundRect(ctx, x, y, w, h, 18);
  ctx.save();
  ctx.clip();
  // 磨砂：把底下的画面模糊一遍（像素坐标，按当前变换换算）
  const T = ctx.getTransform();
  const sx = x * T.a + T.e, sy = y * T.d + T.f, sw = w * T.a, sh = h * T.d;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const m = 24, cw = ctx.canvas.width, ch = ctx.canvas.height;
  const ax = Math.max(0, sx - m), ay = Math.max(0, sy - m), aw = Math.min(cw, sx + sw + m) - ax, ah = Math.min(ch, sy + sh + m) - ay;
  if (aw > 0 && ah > 0) {
    // 缩到 1/6 再放大：便宜的模糊
    const dw = Math.max(1, Math.round(aw / 6)), dh = Math.max(1, Math.round(ah / 6));
    if (!frostScratch || frostScratch.width < dw || frostScratch.height < dh) frostScratch = makeCanvas(Math.max(dw, 160), Math.max(dh, 60));
    const g = frostScratch.getContext('2d');
    g.clearRect(0, 0, frostScratch.width, frostScratch.height);
    g.imageSmoothingQuality = 'high';
    g.drawImage(ctx.canvas, ax, ay, aw, ah, 0, 0, dw, dh);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(frostScratch, 0, 0, dw, dh, ax, ay, aw, ah);
  }
  ctx.setTransform(T);
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, 'rgba(246,248,249,0.74)'); g.addColorStop(1, 'rgba(226,232,236,0.66)');
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // 玻璃上的反光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.moveTo(x + w * 0.55, y); ctx.lineTo(x + w * 0.72, y); ctx.lineTo(x + w * 0.5, y + h); ctx.lineTo(x + w * 0.33, y + h); ctx.closePath(); ctx.fill();
  // 水珠和流痕
  for (let i = 0; i < Math.round(w / 22); i++) {
    const px = x + 8 + hash2(i, 1, seed) * (w - 16), py = y + 6 + hash2(i, 2, seed) * (h - 12), r = 2 + hash2(i, 3, seed) ** 2 * 7;
    ctx.fillStyle = 'rgba(70,88,104,0.22)'; ctx.beginPath(); ctx.arc(px + 0.8, py + 1.2, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(240,245,248,0.55)'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(px - r * 0.35, py - r * 0.4, r * 0.38, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 2; i++) {
    const px = x + w * (0.82 + i * 0.1) - 30 * i, ph = (((b * 0.18 + hash2(i, 4, seed)) % 1) + 1) % 1, py = y + ph * (h - 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(px, y + 4); ctx.lineTo(px + 1, py); ctx.stroke();
    ctx.fillStyle = 'rgba(70,88,104,0.3)'; ctx.beginPath(); ctx.arc(px + 1.6, py + 1.5, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(245,248,250,0.9)'; ctx.beginPath(); ctx.arc(px + 1, py, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px - 0.6, py - 1.6, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  // 边：亮的内沿 + 浅的外沿
  roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 16.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
  roundRect(ctx, x, y, w, h, 18);
  ctx.strokeStyle = 'rgba(70,86,100,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

// ---------- 手机播放界面（浅色主题，伞色作强调色，屏幕上有雨滴；界面虚构、无 logo） ----------
function drawPhone16(ctx, cx, cy, s, spin, gb) {
  const sec = SEC();
  const b = gb - sec.start;
  const w = 128 * s, h = 232 * s;
  ctx.save();
  ctx.translate(cx, cy);
  // 影子
  ctx.fillStyle = 'rgba(40,52,64,0.22)';
  roundRect(ctx, -w / 2 + 6, -h / 2 + 10, w, h, 20 * s); ctx.fill();
  // 机身：浅银色
  const bg = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
  bg.addColorStop(0, '#f1f4f6'); bg.addColorStop(0.5, '#c9d0d6'); bg.addColorStop(1, '#e3e8eb');
  roundRect(ctx, -w / 2, -h / 2, w, h, 20 * s); ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = '#8f9aa3'; ctx.lineWidth = 1.5 * s; ctx.stroke();
  // 屏幕：浅色
  const sw = w - 12 * s, sh = h - 12 * s;
  roundRect(ctx, -sw / 2, -sh / 2, sw, sh, 15 * s);
  const sg = ctx.createLinearGradient(0, -sh / 2, 0, sh / 2);
  sg.addColorStop(0, '#fbfcfc'); sg.addColorStop(1, '#eaeef1');
  ctx.fillStyle = sg; ctx.fill();
  ctx.save(); ctx.clip();
  // 顶部小药丸
  roundRect(ctx, -16 * s, -sh / 2 + 7 * s, 32 * s, 8 * s, 4 * s); ctx.fillStyle = '#2f3a44'; ctx.fill();
  // 转动的圆盘：两把伞的颜色
  ctx.save();
  ctx.translate(0, -sh / 2 + 70 * s);
  ctx.fillStyle = 'rgba(40,52,64,0.15)'; ctx.beginPath(); ctx.arc(2 * s, 4 * s, 42 * s, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(spin);
  const dg = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
  if (dg) {
    dg.addColorStop(0, UMB_HIM); dg.addColorStop(0.24, '#f7d76a'); dg.addColorStop(0.5, UMB_HER); dg.addColorStop(0.74, '#f08a6e'); dg.addColorStop(1, UMB_HIM);
    ctx.fillStyle = dg;
  } else ctx.fillStyle = UMB_HER;
  ctx.beginPath(); ctx.arc(0, 0, 42 * s, 0, Math.PI * 2); ctx.fill();
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.arc(0, 0, (16 + i * 7) * s, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1 * s; ctx.stroke(); }
  ctx.beginPath(); ctx.arc(0, 0, 13 * s, 0, Math.PI * 2); ctx.fillStyle = '#f7f8f8'; ctx.fill();
  ctx.beginPath(); ctx.arc(0, 0, 3.5 * s, 0, Math.PI * 2); ctx.fillStyle = '#2f3a44'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(-2 * s, -40 * s, 4 * s, 11 * s);
  ctx.restore();
  // 两条浅灰的占位线（不写字）
  roundRect(ctx, -38 * s, 0 * s, 76 * s, 6 * s, 3 * s); ctx.fillStyle = '#b8c1c8'; ctx.fill();
  roundRect(ctx, -26 * s, 12 * s, 52 * s, 5 * s, 2.5 * s); ctx.fillStyle = '#d3d9dd'; ctx.fill();
  // 进度条（随拍子走）
  const prog = clamp(0.05 + (b / END) * 0.88, 0, 1);
  const by = 36 * s;
  roundRect(ctx, -44 * s, by, 88 * s, 5 * s, 2.5 * s); ctx.fillStyle = '#d5dbdf'; ctx.fill();
  roundRect(ctx, -44 * s, by, 88 * s * prog, 5 * s, 2.5 * s); ctx.fillStyle = UMB_HER; ctx.fill();
  ctx.beginPath(); ctx.arc(-44 * s + 88 * s * prog, by + 2.5 * s, 5.5 * s, 0, Math.PI * 2); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.strokeStyle = UMB_HER; ctx.lineWidth = 2 * s; ctx.stroke();
  // 按钮：上一首、暂停（正在播放）、下一首
  const yb = 72 * s;
  ctx.beginPath(); ctx.arc(0, yb, 17 * s, 0, Math.PI * 2); ctx.fillStyle = UMB_HIM; ctx.fill();
  ctx.fillStyle = '#2f3a44';
  ctx.fillRect(-6 * s, yb - 7 * s, 4 * s, 14 * s); ctx.fillRect(2 * s, yb - 7 * s, 4 * s, 14 * s);
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 32 * s, yb - 7 * s); ctx.lineTo(sx * 42 * s, yb); ctx.lineTo(sx * 32 * s, yb + 7 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(sx * 43 * s - 1.5 * s, yb - 7 * s, 3 * s, 14 * s);
  }
  // 屏幕上的雨滴（一颗慢慢往下滑）
  const drops = [[-36, -70, 4.5], [30, -88, 3], [42, -20, 5.5], [-20, 26, 3.5], [10, 96, 4], [-44, 70, 2.6], [24, -40, 2.4]];
  const slide = (((b * 0.25) % 1) + 1) % 1;
  drops.push([36, -60 + slide * 160, 4.2]);
  for (const [dx, dy, r] of drops) {
    const x = dx * s, y = dy * s, rr = r * s;
    if (dy > -60 && dx === 36) { ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(x, -60 * s); ctx.lineTo(x, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(80,98,114,0.25)'; ctx.beginPath(); ctx.arc(x + rr * 0.25, y + rr * 0.3, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(248,250,252,0.6)'; ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.beginPath(); ctx.arc(x - rr * 0.35, y - rr * 0.4, rr * 0.38, 0, Math.PI * 2); ctx.fill();
  }
  // 屏幕反光
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.moveTo(sw * 0.1, -sh / 2); ctx.lineTo(sw * 0.5, -sh / 2); ctx.lineTo(-sw * 0.5, sh * 0.1); ctx.lineTo(-sw * 0.5, -sh * 0.25); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
}

// ---------- 场景 ----------
export const s16 = {
  id: 's16',
  station: ST,
  figureStyle: 'cinematic',
  figureRim: { color: '#f3f6f8', width: 3, alpha: 0.55 },
  figureAdjust(b, env) {
    // 强拍上被溅了一下：整体轻轻一缩
    const fl = smoothstep(T_HIT - 0.1, T_HIT, b) * (1 - smoothstep(T_HIT + 0.15, T_HIT + 0.7, b));
    if (b <= END) return fl > 0.001 ? { scale: 1 - 0.025 * fl, sx: 1 + 0.045 * fl } : null;
    // Outro 前 8 拍：镜头缓停，他在画面里继续走；第 19 拍站定
    // 站定以后整个人不再移动（镜头也已经停了）
    const bb = Math.min(b, STOP_B);
    return { dx: env.camAt(bb) - camOf(env, bb), pose: b >= STOP_B ? 'stand' : undefined };
  },
  drawFigure(ctx, fig, b, env) {
    const P = himPose(fig);
    drawReflection(ctx, (g) => { drawWalker(g, { ...fig, rim: null }); const Q = himPose(fig); drawUmbrella(g, 'him', Q.hand, Q.apex, tiltAt(b), b, 'hook'); }, b, { x0: -280, x1: 380, h: 205, a: 0.45 });
    const sg = ctx.createRadialGradient(10, 2, 2, 10, 2, 90);
    sg.addColorStop(0, 'rgba(45,55,66,0.38)'); sg.addColorStop(1, 'rgba(45,55,66,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.ellipse(10, 2, 90, 11, 0, 0, Math.PI * 2); ctx.fill();
    // 站着时伞杆从他身后斜上去（不挡脸）；走路时伞在前面那只手上
    const stand = fig.pose === 'stand';
    let U = null;
    if (stand) U = drawUmbrella(ctx, 'him', P.hand, P.apex, tiltAt(b), b, 'hook');
    drawWalker(ctx, fig);
    if (stand) drawWetDrops(ctx, b);
    else U = drawUmbrella(ctx, 'him', P.hand, P.apex, 0, b, 'hook');
    umbrellaDrips(ctx, 'him', U, b, 1.7, fig.pose === 'stand' ? smoothstep(T_HIT + 0.2, T_HIT + 0.6, b) * (1 - smoothstep(T_HIT + 2, T_HIT + 3.5, b)) : 0);
  },
  drawBack(ctx, b, env) {
    const cam = camOf(env);
    const sun = sunAt(b);
    drawStrip(ctx, skyLayer(env), cam);
    if (sun > 0.01) {  // 云后透出阳光：云层裂开一块，露出淡蓝的天
      ctx.save(); ctx.globalAlpha = sun; drawStrip(ctx, clearLayer(env), cam); ctx.restore();
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      softGlow(ctx, 980, 160, 1000, C('#fff0c8'), 0.6 * sun);
      ctx.restore();
    }
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, midFarLayer(), cam);
    drawRays(ctx, 0.2 + 0.8 * sun, b);
    drawStrip(ctx, midLayer(env), cam);
    drawStrip(ctx, roadLayer(env), cam);
    drawStrip(ctx, roadReflLayer(env), cam);
    drawBus(ctx, b);
    drawSplashSheet(ctx, b);
    drawStrip(ctx, walkLayer(env), cam);
    drawStrip(ctx, propsLayer(env), cam);
    drawShelterWater(ctx, b, env, cam);
    drawHerAll(ctx, b, env, cam);
  },
  drawFront(ctx, b, env) {
    const cam = camOf(env);
    drawSplashFront(ctx, b);
    const amt = rainAt(b);
    drawGroundRain(ctx, b, cam, amt);
    drawRain(ctx, b, cam, amt);
    // 前景的体积光、雨雾（很淡）
    const sun = sunAt(b);
    if (sun > 0.01) drawRays(ctx, 0.32 * sun, b);
    if (sun > 0.01) { // 阳光出来：整体染一层暖
      ctx.save(); ctx.globalCompositeOperation = 'soft-light';
      ctx.fillStyle = css(C('#ffe2b0'), 0.35 * sun); ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
      ctx.restore();
    }
    // 画布纹理（进场时整幅画还在上一站的画框里、很小，省掉）
    if (b < 0.4) return;
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.45 * smoothstep(0.4, 1.2, b);
    ctx.drawImage(canvasTexture(), X_MIN, 0, X_MAX - X_MIN, 1000);
    ctx.restore();
  },
  cardStyle: {
    ink: INK, accent: '#d4472f', bar: false,
    bgDraw(ctx, x, y, w, h, b) {
      frostPanel(ctx, x, y, w, h, b, 11);
      // 两把伞的颜色：左边一道细的双色竖条
      roundRect(ctx, x + 20, y + 30, 7, (h - 60) / 2, 3.5); ctx.fillStyle = UMB_HIM; ctx.fill();
      roundRect(ctx, x + 20, y + 30 + (h - 60) / 2 + 4, 7, (h - 60) / 2 - 4, 3.5); ctx.fillStyle = UMB_HER; ctx.fill();
    },
  },
  playerStyle: {
    ink: INK, noteColor: UMB_HER, backdrop: false,
    plateDraw(ctx, x, y, w, h) { frostPanel(ctx, x, y, w, h, 0, 23); },
    drawPlayer(ctx, kind, cx, cy, sc, spin, P, gb) { drawPhone16(ctx, cx, cy, sc, spin, gb); },
  },
};
