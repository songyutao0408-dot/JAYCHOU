// 第 8 站 · 我很忙（On the Run!, 2007）·「最长的电影」· 老电影院 · 胶片划痕 + 4:3 画幅
// 整站是一部「无声黑白片」：银幕里放着一条浅灰调的老街（原创，不是任何真实电影），他就走在银幕里。
// 胶片质感：颗粒、竖向划痕（会跳、会断）、灰尘与毛发、偶尔的闪烁、片头倒数式的圆圈小斑点、换卷提示圆点、片门晃动。
// 画面按每秒约 10 次更新（quantize），镜头（平移、后退、推回）不量化。
//
// 结构（「世界坐标」= 银幕上的放映画面正好是 x ∈ [X_MIN, X_MAX]、y ∈ [0, 1000]，和普通场景单位一致）：
//   镜头缩放 Z（以 CAM_A 为中心）：第 1–4 拍 Z = 1（银幕铺满画面，看到的就是电影）；
//   第 5–8 拍镜头慢慢后退到 Z = ZF，露出银幕边、黑色遮幅、两侧红丝绒幕布（窄边）、顶上的帷幔，底部一窄条观众剪影；
//   第 9 拍强拍画幅突然缩成 4:3（左右黑边，带胶片颗粒和片孔）；第 11 拍观众一起扭头看向我们（同帧换成正脸）；
//   第 13 拍恢复 16:9、观众扭回去，镜头推回银幕里，他走向下一道画框（胶片画格 + 片孔）。
// 人物跟着镜头缩放（figureAdjust 的 scale / dx / dy），始终「在银幕里」。
// 观众剪影是镜头后退时从画面下方升上来的（离镜头近，后退时才进入画面），头部压在银幕下沿上，形成剪影。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { rgba, mix } from '../kit/color.js';
import { circle, ellipse, poly, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, keyframes, TAU } from '../kit/math.js';
import { GAG, STATION, SB } from '../beat/time.js';
import { stationByN } from '../data/stations.js';

const ST = stationByN(8);

// ---------- 调色板 ----------
// 黑白片灰阶（微暖）
const G0 = '#2a2622', G1 = '#4d463d', G2 = '#776e61', G3 = '#9d9483', G4 = '#bdb4a0', G5 = '#d3cbb7', G6 = '#e2dbc8', G7 = '#efe9d8';
const SCREEN = '#f2ead2', LIGHT = '#fff8e4', CREAM = '#f2ead2';
const VELVET = '#8a1f24', VELVET_D = '#4a0e12', VELVET_L = '#c0413f', GOLD = '#c9a45a';
const WALL = '#221a17', SIL = '#1b1715', NIGHT = '#120f0e';

// ---------- 时间（段内拍位） ----------
const T_PULL = [SB(5), SB(9)];          // 第 5–8 拍：镜头慢慢后退
const T_43 = [GAG, STATION.leave[0]];   // 第 9 拍强拍 → 第 13 拍：4:3 画幅
const T_TURN = [SB(11), STATION.leave[0]]; // 第 11 拍：观众一起扭头；第 13 拍扭回去
const T_PUSH = [STATION.leave[0] + 0.2, STATION.leave[0] + 2.6]; // 第 13–15 拍：镜头推回银幕里
const T_HAT = [SB(5) + 0.4, SB(8) + 0.6]; // 第 5–8 拍：银幕里一顶礼帽被风吹着滚过街面（次要小动作）

// ---------- 镜头：后退 / 推回 ----------
const ZF = 0.84;              // 后退到底时银幕的缩放
const CAM_A = [500, 250];     // 缩放中心：后退到底时银幕上沿在 y≈40，下沿在 y≈880
const zoomAt = (rb) => keyframes([[T_PULL[0], 1], [T_PULL[1], ZF, ease.inOut], [T_PUSH[0], ZF], [T_PUSH[1], 1, ease.inOut]], rb);
const pullAt = (Z) => clamp((1 - Z) / (1 - ZF));
/** 未量化的段内拍位：硬切（4:3、扭头、定格）都用它，保证正好落在强拍上。 */
const rawB = (env) => env.gb - env.sec.start;
function camera(ctx, Z) {
  ctx.translate(CAM_A[0], CAM_A[1]);
  ctx.scale(Z, Z);
  ctx.translate(-CAM_A[0], -CAM_A[1]);
}
const toView = (wx, wy, Z) => [CAM_A[0] + (wx - CAM_A[0]) * Z, CAM_A[1] + (wy - CAM_A[1]) * Z];

/** 每个量化帧一个整数编号（量化后的拍位彼此不同），用来给颗粒、划痕取随机数。 */
const frameNo = (b) => Math.round(b * 1000);
/** 片门晃动：每个量化帧放映画面轻微上下左右跳一下。 */
const weave = (b) => { const q = frameNo(b); return [(hash2(q, 1, 801) - 0.5) * 2.2, (hash2(q, 2, 801) - 0.5) * 3.2]; };
/** 闪烁：每个量化帧亮度略有起伏，偶尔一下明显的闪白 / 压暗。 */
function flickerAt(b) {
  const q = frameNo(b);
  let f = (hash2(q, 3, 802) - 0.5) * 0.09;
  const r = hash2(q, 4, 802);
  if (r < 0.05) f = 0.13; else if (r < 0.08) f = -0.1;
  return f;
}

const FILM_W = X_MAX - X_MIN;
const BASE = ROAD_Y - 40; // 楼房底边（他走在人行道中间，街面道具靠墙放在他身后）
const PROP_Y = ROAD_Y - 14; // 街面道具的落地线

// ======================================================================
// 银幕里的老街（黑白片），视差长条
// ======================================================================
const P_CLOUD = 0.05, P_FAR = 0.25, P_MID = 0.68, P_NEAR = 1;

function skyImg() {
  return baked('s08-sky', 64, 420, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 420);
    g.addColorStop(0, '#e2dbc8'); g.addColorStop(0.6, '#ebe5d3'); g.addColorStop(1, '#f1ecdd');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 420);
  });
}
function cloudLayer() {
  return strip('s08-cloud', P_CLOUD, (ctx, x0, x1) => {
    const R = rng('s08-cloud');
    for (let x = x0 + 60; x < x1; x += R.range(380, 640)) {
      const y = R.range(70, 190), w = R.range(220, 380), h = R.range(30, 50);
      ctx.fillStyle = rgba('#f7f2e6', 0.9);
      for (let k = 0; k < 5; k++) { ellipse(ctx, x + (k - 2) * w * 0.17, y - (k % 2) * h * 0.4, w * 0.2, h * (0.7 + 0.3 * (k % 2))); ctx.fill(); }
      ctx.fillStyle = rgba('#d9d2bf', 0.6); ellipse(ctx, x, y + h * 0.55, w * 0.42, h * 0.2); ctx.fill();
    }
  }, { y0: 0, y1: 300 });
}

// 远景：浅灰的城市剪影（屋顶、烟囱、圆顶、水塔），雾气让它很淡
function farLayer() {
  return strip('s08-far', P_FAR, (ctx, x0, x1) => {
    const R = rng('s08-far');
    const C = ['#d6cebb', '#cfc7b3', '#dbd4c2'];
    for (let x = x0 - 60; x < x1;) {
      const w = R.range(80, 200), top = R.range(170, 360);
      ctx.fillStyle = R.pick(C);
      ctx.fillRect(x, top, w, 720 - top);
      const kind = R();
      if (kind < 0.22) { poly(ctx, [[x - 6, top], [x + w / 2, top - w * 0.35], [x + w + 6, top]]); ctx.fill(); }
      else if (kind < 0.32) { ctx.beginPath(); ctx.arc(x + w / 2, top, w * 0.32, Math.PI, 0); ctx.fill(); ctx.fillRect(x + w / 2 - 2, top - w * 0.32 - 26, 4, 26); }
      else if (kind < 0.42) { // 水塔
        const tx = x + w * 0.3;
        ctx.fillRect(tx, top - 60, 50, 44); poly(ctx, [[tx - 4, top - 60], [tx + 25, top - 84], [tx + 54, top - 60]]); ctx.fill();
        ctx.fillRect(tx + 6, top - 16, 3, 16); ctx.fillRect(tx + 41, top - 16, 3, 16);
      }
      // 烟囱
      for (let k = 0; k < R.int(0, 2); k++) { const cx = x + R.range(10, w - 20); ctx.fillRect(cx, top - R.range(20, 40), 12, 40); }
      // 窗点
      ctx.fillStyle = rgba('#a89f8c', 0.35);
      for (let yy = top + 24; yy < 700; yy += 34) for (let xx = x + 12; xx < x + w - 14; xx += 24) if (R() < 0.6) ctx.fillRect(xx, yy, 9, 14);
      x += w + R.range(-24, 8);
    }
    // 雾：越往下越白
    const g = ctx.createLinearGradient(0, 300, 0, 720);
    g.addColorStop(0, rgba('#efe9d8', 0)); g.addColorStop(1, rgba('#efe9d8', 0.75));
    ctx.fillStyle = g; ctx.fillRect(x0, 300, x1 - x0, 420);
  }, { y0: 80, y1: 720 });
}

// 中景：一排老式店面（招牌全空白，不写字）
function awning(ctx, x, y, w, h, dark, light) {
  const n = Math.max(4, Math.round(w / 28)), sw = w / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? light : dark;
    poly(ctx, [[x + i * sw, y], [x + (i + 1) * sw, y], [x + (i + 1) * sw + 6, y + h], [x + i * sw + 6, y + h]]); ctx.fill();
  }
  // 荷叶边
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i % 2 ? light : dark;
    ctx.beginPath(); ctx.arc(x + i * sw + sw / 2 + 6, y + h, sw / 2, 0, Math.PI); ctx.fill();
  }
  ctx.strokeStyle = G1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke();
  ctx.fillStyle = rgba(G0, 0.12); ctx.fillRect(x + 6, y + h + sw / 2, w, 22);
}
function upperWindow(ctx, x, y, w, h, R) {
  ctx.fillStyle = G6; ctx.fillRect(x - 6, y - 8, w + 12, h + 18);           // 窗套
  ctx.fillStyle = G2; ctx.fillRect(x, y, w, h);                              // 玻璃
  // 窗帘（半拉）
  if (R() < 0.6) { ctx.fillStyle = G5; const cw = w * R.range(0.25, 0.45); ctx.fillRect(x, y, cw, h); ctx.fillRect(x + w - cw * 0.6, y, cw * 0.6, h); }
  // 玻璃反光
  ctx.fillStyle = rgba(G6, 0.35); poly(ctx, [[x + w * 0.5, y], [x + w * 0.75, y], [x + w * 0.35, y + h], [x + w * 0.1, y + h]]); ctx.fill();
  ctx.strokeStyle = G6; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.moveTo(x, y + h * 0.42); ctx.lineTo(x + w, y + h * 0.42); ctx.stroke();
  ctx.fillStyle = G4; ctx.fillRect(x - 10, y + h + 6, w + 20, 7);          // 窗台
  ctx.strokeStyle = rgba(G1, 0.6); ctx.lineWidth = 1.5; ctx.strokeRect(x, y, w, h);
}
function building(ctx, x, w, top, R) {
  const face = R.pick(['#d9d1bd', '#cfc6b1', '#e0d9c6', '#c7bea9']);
  ctx.fillStyle = face; ctx.fillRect(x, top, w, BASE - top);
  // 砖缝 / 石缝（很淡）
  ctx.strokeStyle = rgba(G3, 0.22); ctx.lineWidth = 1;
  for (let y = top + 30; y < BASE - 200; y += 18) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.stroke(); }
  // 檐口
  ctx.fillStyle = G4; ctx.fillRect(x - 8, top - 4, w + 16, 22);
  ctx.fillStyle = G7; ctx.fillRect(x - 8, top - 4, w + 16, 5);
  ctx.fillStyle = rgba(G1, 0.35); ctx.fillRect(x - 4, top + 18, w + 8, 5);
  for (let dx = 8; dx < w; dx += 22) { ctx.fillStyle = G3; ctx.fillRect(x + dx, top + 18, 8, 9); }
  // 楼上的窗
  const cols = Math.max(2, Math.floor((w - 40) / 90)), floors = Math.floor((BASE - 250 - top - 40) / 120);
  const ww = 46, gap = (w - cols * ww) / (cols + 1);
  for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) upperWindow(ctx, x + gap + c * (ww + gap), top + 56 + f * 120, ww, 74, R);
  // 底层店面：空白招牌、条纹遮阳篷、大橱窗、门
  const sy = BASE - 238;
  ctx.fillStyle = G6; ctx.fillRect(x + 14, sy, w - 28, 40);
  ctx.strokeStyle = G1; ctx.lineWidth = 2.5; ctx.strokeRect(x + 14, sy, w - 28, 40);
  ctx.strokeStyle = rgba(G2, 0.7); ctx.lineWidth = 1.2; ctx.strokeRect(x + 20, sy + 6, w - 40, 28);
  awning(ctx, x + 10, sy + 48, w - 26, 42, G2, G6);
  const doorW = 56, doorX = R() < 0.5 ? x + 26 : x + w - 26 - doorW;
  const winX0 = doorX === x + 26 ? doorX + doorW + 14 : x + 26, winX1 = doorX === x + 26 ? x + w - 26 : doorX - 14;
  ctx.fillStyle = G1; ctx.fillRect(winX0 - 4, BASE - 140, winX1 - winX0 + 8, 136);
  ctx.fillStyle = G3; ctx.fillRect(winX0, BASE - 136, winX1 - winX0, 112);
  ctx.fillStyle = rgba(G6, 0.45);
  for (let k = 0; k < 2; k++) { const px = winX0 + (winX1 - winX0) * (0.2 + 0.4 * k); poly(ctx, [[px, BASE - 136], [px + 30, BASE - 136], [px - 20, BASE - 24], [px - 50, BASE - 24]]); ctx.fill(); }
  ctx.fillStyle = G4; ctx.fillRect(winX0 - 6, BASE - 24, winX1 - winX0 + 12, 24);
  // 橱窗里几样东西的影子（帽架、瓶子）
  ctx.fillStyle = rgba(G1, 0.5);
  for (let px = winX0 + 20; px < winX1 - 20; px += R.range(36, 60)) { const hh = R.range(20, 50); roundRect(ctx, px, BASE - 24 - hh, R.range(10, 22), hh, 4); ctx.fill(); }
  ctx.fillStyle = G1; ctx.fillRect(doorX, BASE - 150, doorW, 150);
  ctx.fillStyle = G3; ctx.fillRect(doorX + 8, BASE - 140, doorW - 16, 60);
  ctx.fillStyle = G6; circle(ctx, doorX + doorW - 12, BASE - 70, 3.5); ctx.fill();
  // 左右壁柱
  ctx.fillStyle = rgba(G7, 0.6); ctx.fillRect(x, top + 20, 6, BASE - top - 20);
  ctx.fillStyle = rgba(G2, 0.35); ctx.fillRect(x + w - 6, top + 20, 6, BASE - top - 20);
}
function midLayer() {
  return strip('s08-mid', P_MID, (ctx, x0, x1) => {
    const R = rng('s08-mid');
    for (let x = x0 - 40; x < x1;) {
      const w = R.range(250, 400), top = R.range(170, 300);
      building(ctx, x, w, top, R);
      x += w;
      if (R() < 0.3) { // 两楼之间一条窄巷：更浅的远处
        const gw = R.range(40, 70);
        ctx.fillStyle = '#e4ddcb'; ctx.fillRect(x, 330, gw, BASE - 330);
        ctx.fillStyle = rgba(G3, 0.4); ctx.fillRect(x, BASE - 60, gw, 60);
        x += gw;
      }
    }
  }, { y0: 140, y1: BASE + 2 });
}

// 近景：人行道、路沿、石子路面、煤气路灯、长椅、消防栓、邮筒（都不写字）
function lampPost(ctx, x) {
  ctx.fillStyle = G1;
  ctx.fillRect(x - 5, 360, 10, PROP_Y - 360);
  poly(ctx, [[x - 18, PROP_Y], [x + 18, PROP_Y], [x + 11, PROP_Y - 46], [x - 11, PROP_Y - 46]]); ctx.fill();
  ctx.fillRect(x - 9, 560, 18, 12); ctx.fillRect(x - 8, 700, 16, 10);
  // 灯笼
  ctx.fillStyle = G0; poly(ctx, [[x - 22, 330], [x + 22, 330], [x + 14, 300], [x - 14, 300]]); ctx.fill();
  ctx.fillStyle = G6; poly(ctx, [[x - 18, 330], [x + 18, 330], [x + 14, 380], [x - 14, 380]]); ctx.fill();
  ctx.strokeStyle = G0; ctx.lineWidth = 3; ctx.strokeRect(x - 16, 330, 32, 50);
  ctx.beginPath(); ctx.moveTo(x, 330); ctx.lineTo(x, 380); ctx.stroke();
  ctx.fillStyle = G0; ctx.fillRect(x - 18, 380, 36, 8); ctx.beginPath(); ctx.arc(x, 300, 7, Math.PI, 0); ctx.fill();
  // 横杆（以前点灯人靠梯子用的）
  ctx.fillRect(x - 26, 420, 52, 5);
}
function bench(ctx, x) {
  ctx.fillStyle = G1;
  const y = PROP_Y - 52;
  for (const dx of [-62, 62]) { ctx.fillRect(x + dx - 4, y, 8, 52); }
  ctx.fillStyle = G2;
  for (let k = 0; k < 3; k++) ctx.fillRect(x - 80, y - 54 + k * 16, 160, 9);
  ctx.fillRect(x - 84, y, 168, 10);
  ctx.fillStyle = G1; ctx.fillRect(x - 84, y + 10, 168, 4);
}
function hydrant(ctx, x) {
  ctx.fillStyle = G1;
  const y = PROP_Y - 56;
  roundRect(ctx, x - 14, y, 28, 52, 6); ctx.fill();
  ctx.beginPath(); ctx.arc(x, y + 2, 15, Math.PI, 0); ctx.fill();
  ctx.fillRect(x - 24, y + 16, 48, 10); ctx.fillRect(x - 18, y + 50, 36, 6);
  ctx.fillStyle = G4; ctx.fillRect(x - 10, y + 2, 3, 46);
}
function pillarBox(ctx, x) {
  const y = PROP_Y - 106;
  ctx.fillStyle = G1; roundRect(ctx, x - 22, y, 44, 104, 6); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x, y + 2, 26, 14, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = G0; ctx.fillRect(x - 14, y + 26, 28, 5);
  ctx.fillStyle = G3; ctx.fillRect(x - 17, y + 2, 3, 98);
  ctx.fillStyle = G0; ctx.fillRect(x - 26, y + 98, 52, 8);
}
function nearLayer(gc) {
  return strip(`s08-near|${Math.round(gc)}`, P_NEAR, (ctx, x0, x1) => {
    const R = rng('s08-near');
    // 人行道
    ctx.fillStyle = '#dad3c0'; ctx.fillRect(x0, BASE - 2, x1 - x0, 860 - BASE + 2);
    ctx.strokeStyle = rgba(G3, 0.6); ctx.lineWidth = 1.5;
    for (let x = x0; x < x1; x += 84) { ctx.beginPath(); ctx.moveTo(x, BASE); ctx.lineTo(x - 30, 856); ctx.stroke(); }
    for (const yy of [784, 820]) { ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x1, yy); ctx.stroke(); }
    ctx.fillStyle = rgba(G2, 0.25); ctx.fillRect(x0, BASE - 2, x1 - x0, 6);
    // 路沿
    ctx.fillStyle = '#e6e0ce'; ctx.fillRect(x0, 856, x1 - x0, 10);
    ctx.fillStyle = G2; ctx.fillRect(x0, 866, x1 - x0, 6);
    // 石子路面：一排排椭圆石块，越近越大
    ctx.fillStyle = '#c3baa6'; ctx.fillRect(x0, 872, x1 - x0, 140);
    for (let row = 0, y = 880; y < 1010; row++) {
      const h = 9 + row * 2.4, w = h * 2.1;
      for (let x = x0 - (row % 2) * w * 0.5; x < x1; x += w + 3) {
        ctx.fillStyle = mix('#cdc5b1', '#b3aa96', hash2(Math.round(x), row, 803));
        ellipse(ctx, x + w / 2, y + h / 2, w / 2, h / 2); ctx.fill();
      }
      y += h + 3;
    }
    // 电车轨道（两道亮线）
    ctx.fillStyle = '#e8e2d0'; ctx.fillRect(x0, 930, x1 - x0, 4); ctx.fillRect(x0, 968, x1 - x0, 5);
    ctx.fillStyle = rgba(G1, 0.5); ctx.fillRect(x0, 934, x1 - x0, 2); ctx.fillRect(x0, 973, x1 - x0, 2);
    // 街面道具：避开定格时他站的位置（画面 x ≈ CHAR_X）
    const gx = CHAR_X + gc;
    const free = (x, r) => Math.abs(x - gx) > r;
    for (let x = x0 + 120; x < x1; x += R.range(620, 820)) if (free(x, 230)) lampPost(ctx, x);
    const R2 = rng('s08-near-props');
    for (let x = x0 + 420; x < x1; x += R2.range(520, 900)) {
      if (!free(x, 260)) continue;
      const k = R2();
      if (k < 0.4) bench(ctx, x); else if (k < 0.7) hydrant(ctx, x); else pillarBox(ctx, x);
    }
  }, { y0: 280, y1: 1010 });
}

/** 第 5–8 拍：一顶礼帽被风吹着，从右往左滚过街面（银幕里的小插曲）。 */
function rollingHat(ctx, b) {
  if (b < T_HAT[0] || b > T_HAT[1]) return;
  const t = (b - T_HAT[0]) / (T_HAT[1] - T_HAT[0]);
  const x = lerp(X_MAX + 80, X_MIN - 120, t);
  const hop = Math.abs(Math.sin(t * TAU * 3.2)) * 26;
  const y = 896 - hop;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-t * TAU * 2.6);
  ctx.fillStyle = G0;
  ellipse(ctx, 0, 14, 46, 11); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 10, 30, 36, 0, Math.PI, 0); ctx.fill();
  ctx.fillStyle = G2; ctx.fillRect(-30, 2, 60, 7);
  ctx.fillStyle = rgba(G6, 0.6); ellipse(ctx, -12, -12, 7, 12, -0.4); ctx.fill();
  ctx.restore();
  // 地上的影子
  ctx.fillStyle = rgba(G0, 0.18); ellipse(ctx, x, 908, 40 - hop * 0.4, 6); ctx.fill();
}

/** 银幕上的放映画面（世界坐标 = 胶片画面坐标）。 */
function drawFilm(ctx, b, env) {
  const cam = env.cam;
  const gc = env.camAt(GAG);
  const [wx, wy] = weave(b);
  ctx.save();
  ctx.translate(wx, wy);
  ctx.drawImage(skyImg(), X_MIN - 10, -10, FILM_W + 20, 440);
  drawStrip(ctx, cloudLayer(), cam);
  drawStrip(ctx, farLayer(), cam);
  drawStrip(ctx, midLayer(), cam);
  drawStrip(ctx, nearLayer(gc), cam);
  rollingHat(ctx, b);
  ctx.restore();
}

// ======================================================================
// 胶片效果：划痕、灰尘、毛发、倒数式圆圈斑点、换卷提示、闪烁、暗角、颗粒
// ======================================================================
const SCRATCHES = (() => {
  const R = rng('s08-scratch');
  const out = [];
  for (let i = 0; i < 46; i++) {
    const s = R.range(-2.5, 16.6), L = R.range(0.5, 2.6);
    const full = R() < 0.65;
    out.push({ s, e: s + L, x: R.range(X_MIN + 30, X_MAX - 30), drift: R.range(-90, 90), w: R.range(0.9, 2.8),
      light: R() < 0.62, y0: full ? -10 : R.range(0, 500), y1: full ? 1010 : R.range(480, 1010), bend: R.range(-8, 8) });
  }
  return out;
})();
function drawScratches(ctx, b) {
  const q = frameNo(b);
  SCRATCHES.forEach((S, i) => {
    if (b < S.s || b >= S.e) return;
    if (hash2(q, i, 804) < 0.18) return; // 划痕时有时无
    const t = (b - S.s) / (S.e - S.s);
    const x = S.x + S.drift * t + (hash2(q, i, 805) - 0.5) * 5;
    ctx.strokeStyle = S.light ? rgba(LIGHT, 0.75) : rgba(G0, 0.5);
    ctx.lineWidth = S.w;
    ctx.beginPath(); ctx.moveTo(x, S.y0); ctx.quadraticCurveTo(x + S.bend, (S.y0 + S.y1) / 2, x + S.bend * 0.4, S.y1); ctx.stroke();
  });
  // 每帧都不一样的短划痕
  const n = Math.floor(hash2(q, 9, 806) * 3);
  for (let k = 0; k < n; k++) {
    const x = lerp(X_MIN + 40, X_MAX - 40, hash2(q, k, 807)), y = hash2(q, k, 808) * 800, L = 60 + hash2(q, k, 809) * 240;
    ctx.strokeStyle = hash2(q, k, 810) < 0.5 ? rgba(LIGHT, 0.6) : rgba(G0, 0.4); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (hash2(q, k, 811) - 0.5) * 10, y + L); ctx.stroke();
  }
}
function drawDust(ctx, b) {
  const q = frameNo(b);
  const n = 3 + Math.floor(hash2(q, 1, 812) * 6);
  for (let k = 0; k < n; k++) {
    const x = lerp(X_MIN + 20, X_MAX - 20, hash2(q, k, 813)), y = lerp(20, 980, hash2(q, k, 814));
    const kind = hash2(q, k, 815), r = 1.5 + hash2(q, k, 816) * 5;
    if (kind < 0.45) { // 黑点（不规则）
      ctx.fillStyle = rgba(G0, 0.75);
      ctx.beginPath();
      for (let j = 0; j < 6; j++) { const a = (j / 6) * TAU, rr = r * (0.6 + 0.6 * hash2(q * 7 + k, j, 817)); j ? ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      ctx.closePath(); ctx.fill();
    } else if (kind < 0.75) { // 白点
      ctx.fillStyle = rgba(LIGHT, 0.85); circle(ctx, x, y, r * 0.7); ctx.fill();
    } else { // 毛发：一根弯弯的线
      const L = 30 + r * 12, a = hash2(q, k, 818) * TAU;
      ctx.strokeStyle = rgba(G0, 0.65); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + Math.cos(a) * L, y + Math.sin(a) * L, x + Math.cos(a + 2) * L, y + Math.sin(a + 2) * L, x + Math.cos(a + 1) * L * 0.8, y + Math.sin(a + 1) * L * 0.8);
      ctx.stroke();
    }
  }
}
/** 片头倒数式的小斑点：一个圆圈 + 十字线 + 扫过的扇形，只出现一帧。 */
function leaderBlip(ctx, x, y, r, sweep, alpha) {
  ctx.save();
  ctx.strokeStyle = rgba(G0, alpha); ctx.lineWidth = Math.max(1.5, r * 0.08);
  circle(ctx, x, y, r); ctx.stroke();
  circle(ctx, x, y, r * 0.78); ctx.stroke();
  ctx.lineWidth = Math.max(1, r * 0.05);
  ctx.beginPath(); ctx.moveTo(x - r * 1.25, y); ctx.lineTo(x + r * 1.25, y); ctx.moveTo(x, y - r * 1.25); ctx.lineTo(x, y + r * 1.25); ctx.stroke();
  ctx.fillStyle = rgba(G0, alpha * 0.45);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r * 0.78, -Math.PI / 2, -Math.PI / 2 + sweep); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawBlips(ctx, b) {
  const q = frameNo(b);
  if (hash2(q, 1, 819) < 0.09) {
    const x = lerp(X_MIN + 120, X_MAX - 120, hash2(q, 2, 819)), y = lerp(80, 560, hash2(q, 3, 819));
    leaderBlip(ctx, x, y, 22 + hash2(q, 4, 819) * 26, hash2(q, 5, 819) * TAU, 0.55);
  }
  // 换卷提示：右上角一个带亮圈的黑圆点，第 14、15 拍前后各闪一帧（这一卷快放完了）
  for (const cb of [SB(14), SB(15)]) {
    if (b >= cb && b < cb + 0.22) {
      const x = X_MAX - 150, y = 120;
      ctx.fillStyle = rgba(LIGHT, 0.7); circle(ctx, x, y, 34); ctx.fill();
      ctx.fillStyle = rgba(G0, 0.85); circle(ctx, x, y, 27); ctx.fill();
      ctx.fillStyle = rgba(G2, 0.6); circle(ctx, x - 6, y - 7, 9); ctx.fill();
    }
  }
}
function vignetteImg() {
  return baked('s08-vignette', 480, 270, (ctx) => {
    const g = ctx.createRadialGradient(240, 128, 40, 240, 135, 300);
    g.addColorStop(0, rgba(LIGHT, 0.10)); g.addColorStop(0.45, rgba(G0, 0)); g.addColorStop(0.8, rgba(G0, 0.16)); g.addColorStop(1, rgba(G0, 0.42));
    ctx.fillStyle = g; ctx.fillRect(0, 0, 480, 270);
  });
}
function drawFilmFX(ctx, b) {
  ctx.drawImage(vignetteImg(), X_MIN, 0, FILM_W, 1000);
  drawScratches(ctx, b);
  drawDust(ctx, b);
  drawBlips(ctx, b);
  const f = flickerAt(b);
  ctx.save();
  if (f < 0) { ctx.fillStyle = rgba(G0, -f); ctx.fillRect(X_MIN - 10, -10, FILM_W + 20, 1020); }
  else if (f > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = rgba('#fff4d8', f * 0.55); ctx.fillRect(X_MIN - 10, -10, FILM_W + 20, 1020); }
  ctx.restore();
}

/** 胶片颗粒：几张预先算好的噪点贴图，每个量化帧换一张、换一个偏移。 */
function grainTile(i) {
  return memo(`s08-grain|${i}`, () => {
    const S = 256, c = makeCanvas(S, S), g = c.getContext('2d');
    const im = g.createImageData(S, S);
    const R = rng('s08-grain', i);
    for (let p = 0; p < S * S; p++) {
      const v = R();
      if (v < 0.22) { const l = R() < 0.5 ? 20 : 250; im.data[p * 4] = l; im.data[p * 4 + 1] = l * 0.96; im.data[p * 4 + 2] = l * 0.86; im.data[p * 4 + 3] = 20 + R() * 46; }
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
function drawGrain(ctx, b, x0 = X_MIN, x1 = X_MAX) {
  const q = frameNo(b);
  const pat = ctx.createPattern(grainTile(Math.floor(hash2(q, 1, 820) * 4)), 'repeat');
  ctx.save();
  ctx.translate(hash2(q, 2, 820) * 240, hash2(q, 3, 820) * 240);
  ctx.fillStyle = pat;
  ctx.fillRect(x0 - 260, -260, x1 - x0 + 520, 1520);
  ctx.restore();
}

// ======================================================================
// 电影院：墙、银幕光晕、红丝绒幕布、帷幔、黑色遮幅、舞台（世界坐标，烘焙）
// ======================================================================
const TH = { x0: -700, y0: -110, x1: 1700, y1: 1300 };
const MASK = 14; // 银幕黑色遮幅宽度
function velvet(ctx, x, y, w, h, { period = 42, litSide = 0 } = {}) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  const n = Math.max(8, Math.round((w / period) * 6));
  for (let i = 0; i <= n; i++) {
    const t = i / n, ph = (t * w) / period;
    const v = 0.5 + 0.5 * Math.sin(ph * TAU);
    const lit = litSide ? Math.pow(litSide > 0 ? t : 1 - t, 2.2) : 0;
    g.addColorStop(t, mix(mix(VELVET_D, VELVET_L, v * 0.85), '#e0705a', lit * 0.45 * v));
  }
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  // 上下暗一点
  const v = ctx.createLinearGradient(0, y, 0, y + h);
  v.addColorStop(0, rgba('#1a0506', 0.45)); v.addColorStop(0.25, rgba('#1a0506', 0)); v.addColorStop(0.85, rgba('#1a0506', 0.1)); v.addColorStop(1, rgba('#1a0506', 0.55));
  ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
}
function theaterImg() {
  const { x0, y0, x1, y1 } = TH;
  return baked('s08-theater', (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
    ctx.scale(K, K); ctx.translate(-x0, -y0);
    ctx.fillStyle = WALL; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // 银幕的光晕映在墙上
    ctx.save();
    ctx.shadowColor = 'rgba(255,238,200,0.5)'; ctx.shadowBlur = 140 * K;
    ctx.fillStyle = '#6a5a48'; ctx.fillRect(X_MIN, 0, FILM_W, 1000);
    ctx.shadowColor = 'rgba(255,238,200,0.35)'; ctx.shadowBlur = 50 * K;
    ctx.fillRect(X_MIN, 0, FILM_W, 1000);
    ctx.restore();
    // 舞台（银幕下方）：木台口，上沿被银幕照亮
    const sy = 1000 + MASK;
    ctx.fillStyle = '#3a2a20'; ctx.fillRect(x0, sy, x1 - x0, 90);
    const g = ctx.createLinearGradient(0, sy, 0, sy + 90);
    g.addColorStop(0, rgba('#a07a52', 0.85)); g.addColorStop(0.12, rgba('#6a4c34', 0.6)); g.addColorStop(1, rgba('#1a1210', 0.4));
    ctx.fillStyle = g; ctx.fillRect(x0, sy, x1 - x0, 90);
    ctx.fillStyle = NIGHT; ctx.fillRect(x0, sy + 90, x1 - x0, y1 - sy - 90);
    // 两侧红丝绒幕布（只露窄边），靠银幕的一侧被照亮
    velvet(ctx, x0, y0, X_MIN - MASK - x0 + 2, 1140 - y0, { litSide: 1 });
    velvet(ctx, X_MAX + MASK - 2, y0, x1 - X_MAX - MASK + 2, 1140 - y0, { litSide: -1 });
    // 幕布落地处的褶子
    for (const [a, c] of [[x0, X_MIN - MASK], [X_MAX + MASK, x1]]) {
      ctx.fillStyle = rgba('#12090a', 0.5);
      for (let x = a; x < c; x += 42) { ctx.beginPath(); ctx.ellipse(x + 21, 1140, 24, 10, 0, 0, Math.PI); ctx.fill(); }
    }
    // 顶上的帷幔：荷叶边 + 金色流苏（下沿在银幕上沿之上）
    const vy = -18;
    const val = new Path2D();
    val.moveTo(x0, y0); val.lineTo(x1, y0); val.lineTo(x1, vy - 14);
    for (let x = x1; x > x0; x -= 120) val.quadraticCurveTo(x - 60, vy + 6, x - 120, vy - 14);
    val.closePath();
    ctx.save(); ctx.clip(val); velvet(ctx, x0, y0, x1 - x0, vy - y0 + 10, { period: 60 }); ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x1, vy - 14); for (let x = x1; x > x0; x -= 120) ctx.quadraticCurveTo(x - 60, vy + 6, x - 120, vy - 14); ctx.stroke();
    ctx.strokeStyle = rgba(GOLD, 0.8); ctx.lineWidth = 2;
    for (let x = x0; x < x1; x += 120) { ctx.beginPath(); ctx.moveTo(x, vy - 50); ctx.lineTo(x + 120, vy - 50); ctx.stroke(); }
    // 黑色遮幅（银幕四周的黑边框）
    const m = new Path2D(); m.rect(X_MIN - MASK, -MASK, FILM_W + 2 * MASK, 1000 + 2 * MASK); m.rect(X_MIN, 0, FILM_W, 1000);
    ctx.fillStyle = '#0c0a09'; ctx.fill(m, 'evenodd');
    ctx.strokeStyle = rgba('#8a7a62', 0.5); ctx.lineWidth = 1.5; ctx.strokeRect(X_MIN - MASK, -MASK, FILM_W + 2 * MASK, 1000 + 2 * MASK);
  });
}
function drawTheater(ctx) {
  const { x0, y0, x1, y1 } = TH;
  ctx.drawImage(theaterImg(), x0, y0, x1 - x0, y1 - y0);
}

/** 放映光束：从画面后上方（放映室）射向银幕的几道光，带浮尘。只在镜头后退后出现。 */
function drawBeam(ctx, b, amt, Z) {
  if (amt <= 0.01) return;
  const [ax, ay] = [500, -380]; // 视图坐标里的光源（画面上方之外）
  const [lx, ty] = toView(X_MIN, 0, Z), [rx, by] = toView(X_MAX, 1000, Z);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rays = [[0.08, 0.2, 0.05], [0.3, 0.42, 0.035], [0.55, 0.62, 0.05], [0.74, 0.9, 0.04], [0.2, 0.8, 0.025]];
  for (const [u0, u1, a] of rays) {
    const g = ctx.createLinearGradient(0, ay, 0, by);
    g.addColorStop(0, rgba(LIGHT, a * 1.6 * amt)); g.addColorStop(0.45, rgba(LIGHT, a * amt)); g.addColorStop(1, rgba(LIGHT, 0));
    ctx.fillStyle = g;
    poly(ctx, [[ax - 20, ay], [ax + 20, ay], [lerp(lx, rx, u1), by], [lerp(lx, rx, u0), by]]); ctx.fill();
  }
  // 浮尘：光里的小亮点，按量化帧缓缓飘
  for (let i = 0; i < 40; i++) {
    const u = hash2(i, 1, 821), v = (hash2(i, 2, 821) + b * 0.03 * (0.4 + hash2(i, 3, 821))) % 1;
    const y = lerp(ty - 30, by - 60, v);
    const x = lerp(ax, lerp(lx, rx, u), clamp((y - ay) / (by - ay))) + Math.sin(b * 0.8 + i) * 8;
    const tw = Math.max(0, Math.sin(b * 2.2 + i * 1.7));
    if (tw < 0.1) continue;
    ctx.fillStyle = rgba('#fff2cc', 0.55 * tw * amt); circle(ctx, x, y, 1.4 + hash2(i, 4, 821) * 1.6); ctx.fill();
  }
  ctx.restore();
}

// ======================================================================
// 观众剪影（视图坐标；镜头后退时从画面下方升上来）
// ======================================================================
// 两排：后排（离银幕近、小）和前排（离我们近、大）。type 决定发型 / 帽子；都是原创的小剪影。
const ROWS = [
  { y: 860, r: 32, seatY: 902, seatW: 118, people: [
    { x: -330, t: 'bob' }, { x: -175, t: 'cap' }, { x: -20, t: 'bald' }, { x: 132, t: 'bun' }, { x: 290, t: 'afro' },
    { x: 690, t: 'pony' }, { x: 842, t: 'bowler' }, { x: 1000, t: 'bob' }, { x: 1150, t: 'cap' }, { x: 1300, t: 'bun' } ] },
  { y: 932, r: 50, seatY: 990, seatW: 190, people: [
    { x: -380, t: 'bowler' }, { x: -160, t: 'bun' }, { x: 60, t: 'cap' }, { x: 270, t: 'kid' }, { x: 470, t: 'glasses' },
    { x: 680, t: 'popcorn' }, { x: 900, t: 'pony' }, { x: 1110, t: 'afro' }, { x: 1330, t: 'bald' } ] },
];
/** 往 Path2D 里加一个椭圆（先 moveTo 到起点，避免和上一段连成一条线）。 */
function ell(P, x, y, rx, ry, rot = 0, a0 = 0, a1 = TAU) {
  P.moveTo(x + Math.cos(rot) * Math.cos(a0) * rx - Math.sin(rot) * Math.sin(a0) * ry, y + Math.sin(rot) * Math.cos(a0) * rx + Math.cos(rot) * Math.sin(a0) * ry);
  P.ellipse(x, y, rx, ry, rot, a0, a1);
  P.closePath();
}
/** 一个观众的剪影形状（肩、头、发型 / 帽子、爆米花桶）。front = 转过来看向我们。 */
function personShapes(x, y, r, t, front, b) {
  const body = new Path2D();
  // 肩膀 + 脖子
  body.moveTo(x - r * 1.55, y + r * 3.4);
  body.bezierCurveTo(x - r * 1.6, y + r * 1.4, x - r * 0.9, y + r * 1.15, x - r * 0.38, y + r * 0.95);
  body.lineTo(x - r * 0.36, y + r * 0.6); body.lineTo(x + r * 0.36, y + r * 0.6); body.lineTo(x + r * 0.38, y + r * 0.95);
  body.bezierCurveTo(x + r * 0.9, y + r * 1.15, x + r * 1.6, y + r * 1.4, x + r * 1.55, y + r * 3.4);
  body.closePath();
  const head = new Path2D();
  ell(head, x, y, r * 0.86, r, 0, 0, TAU);
  for (const s of [-1, 1]) ell(head, x + s * r * 0.86, y + r * 0.08, r * 0.17, r * 0.27, 0, 0, TAU); // 耳朵
  const extra = new Path2D();
  if (t === 'bun') ell(extra, x + (front ? 0 : r * 0.12), y - r * 1.0, r * 0.42, r * 0.36, 0, 0, TAU);
  if (t === 'afro') ell(extra, x, y - r * 0.18, r * 1.3, r * 1.15, 0, 0, TAU);
  if (t === 'bob') ell(extra, x, y - r * 0.1, r * 1.04, r * 1.06, 0, 0, TAU);
  if (t === 'cap') { ell(extra, x, y - r * 0.55, r * 0.98, r * 0.55, 0, Math.PI, 0); if (front) ell(extra, x, y - r * 0.5, r * 1.18, r * 0.2, 0, 0, Math.PI); else extra.rect(x - r * 0.98, y - r * 0.58, r * 1.96, r * 0.14); }
  if (t === 'bowler') { ell(extra, x, y - r * 0.6, r * 0.8, r * 0.75, 0, Math.PI, 0); ell(extra, x, y - r * 0.58, r * 1.25, r * 0.16, 0, 0, TAU); }
  if (t === 'kid') { for (const s of [-1, 1]) ell(extra, x + s * r * 1.02, y - r * 0.35, r * 0.34, r * 0.24, s * 0.5, 0, TAU); ell(extra, x, y - r * 1.05, r * 0.42, r * 0.22, 0, 0, TAU); }
  if (t === 'pony' && !front) { extra.moveTo(x - r * 0.12, y - r * 0.2); extra.quadraticCurveTo(x + r * 0.05, y + r * 1.4, x - r * 0.05, y + r * 1.9); extra.quadraticCurveTo(x + r * 0.35, y + r * 1.2, x + r * 0.2, y - r * 0.2); extra.closePath(); }
  if (t === 'pony' && front) ell(extra, x - r * 0.95, y + r * 0.6, r * 0.22, r * 0.5, 0.3, 0, TAU);
  const shapes = [body, head, extra];
  // 爆米花桶：举在肩旁，看片时每两拍往嘴边送一下（按量化帧），扭头时停住
  let popTop = null;
  if (t === 'popcorn') {
    const up = !front && Math.floor(b / 2) % 2 === 1 ? -r * 0.35 : 0;
    const px = x + r * 1.35, py = y + r * 0.9 + up;
    const pop = new Path2D();
    pop.moveTo(px - r * 0.42, py - r * 0.5); pop.lineTo(px + r * 0.42, py - r * 0.5); pop.lineTo(px + r * 0.3, py + r * 0.6); pop.lineTo(px - r * 0.3, py + r * 0.6); pop.closePath();
    shapes.push(pop);
    popTop = [px, py - r * 0.5];
  }
  return { shapes, popTop };
}
/** 正脸：脸被放映机的余光微微照亮，两只眼睛直直看向我们，嘴是一条不动声色的短线。 */
function drawFace(ctx, x, y, r, t) {
  const kid = t === 'kid';
  ctx.fillStyle = '#41372f';
  ellipse(ctx, x, y + r * 0.12, r * 0.68, r * 0.8); ctx.fill();
  if (t === 'bob' || kid) { ctx.fillStyle = SIL; ctx.beginPath(); ctx.ellipse(x, y - r * 0.32, r * 0.8, r * 0.45, 0, Math.PI, 0); ctx.fill(); ctx.fillRect(x - r * 0.8, y - r * 0.34, r * 1.6, r * 0.12); }
  if (t === 'bowler' || t === 'cap') { ctx.fillStyle = SIL; ctx.fillRect(x - r * 0.75, y - r * 0.62, r * 1.5, r * 0.22); }
  const ey = y + r * 0.08, ex = r * 0.3, er = kid ? r * 0.2 : r * 0.15;
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#f4ead2'; ellipse(ctx, x + s * ex, ey, er, er * 0.82); ctx.fill();
    ctx.fillStyle = SIL; circle(ctx, x + s * ex, ey + er * 0.1, er * 0.5); ctx.fill();
  }
  if (t === 'glasses' || t === 'bald') {
    ctx.strokeStyle = rgba('#e8dcbf', 0.9); ctx.lineWidth = Math.max(1.4, r * 0.05);
    for (const s of [-1, 1]) { circle(ctx, x + s * ex, ey, er * 1.9); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(x - ex + er * 1.9, ey); ctx.lineTo(x + ex - er * 1.9, ey); ctx.stroke();
  }
  ctx.strokeStyle = rgba(SIL, 0.9); ctx.lineWidth = Math.max(1.2, r * 0.05);
  ctx.beginPath(); ctx.moveTo(x - r * 0.14, y + r * 0.55); ctx.lineTo(x + r * 0.14, y + r * 0.55); ctx.stroke();
}
function seatRow(ctx, row) {
  // 前排的椅背：一排圆角顶的深色块（夹在两排人中间）
  const { seatY, seatW } = row;
  ctx.fillStyle = '#141010';
  for (let i = -1; i < 14; i++) {
    const cx = -560 + i * (seatW + 34);
    roundRect(ctx, cx - seatW / 2, seatY, seatW, 200, seatW * 0.22); ctx.fill();
  }
}
function drawAudience(ctx, b, rb, pull, flick) {
  if (pull <= 0.001) return;
  const rise = (1 - ease.out(pull)) * 330;
  const front = rb >= T_TURN[0] && rb < T_TURN[1];
  const rim = clamp(pull * (1 + flick * 2.5));
  ctx.save();
  ctx.translate(0, rise);
  ctx.fillStyle = NIGHT; ctx.fillRect(X_MIN - 10, 960, X_MAX - X_MIN + 20, 400);
  ROWS.forEach((row, ri) => {
    // 每个人随量化帧有一点点不安分的晃动，扭头时全体定住
    const people = row.people.map((P, i) => {
      const kid = P.t === 'kid';
      const r = kid ? row.r * 0.82 : row.r, y = kid ? row.y + row.r * 0.4 : row.y;
      const x = P.x + (front ? 0 : (hash2(Math.floor(b * 2), i + ri * 20, 822) - 0.5) * 3);
      return { x, y, r, t: P.t, ...personShapes(x, y, r, P.t, front, b) };
    });
    // 先画整排的背光亮边，再画整排剪影（亮边不会压到旁边的人）
    if (rim > 0.01) {
      ctx.save(); ctx.translate(0, -Math.max(1.6, row.r * 0.07)); ctx.fillStyle = rgba('#efe2c4', 0.85 * rim);
      for (const P of people) for (const p of P.shapes) ctx.fill(p);
      ctx.restore();
    }
    ctx.fillStyle = SIL;
    for (const P of people) for (const p of P.shapes) ctx.fill(p);
    for (const P of people) {
      if (P.popTop) {
        const [px, py] = P.popTop;
        ctx.fillStyle = rgba('#efe2c4', 0.85);
        for (let k = 0; k < 5; k++) { circle(ctx, px - P.r * 0.34 + k * P.r * 0.17, py - P.r * 0.06 - (k % 2) * P.r * 0.08, P.r * 0.1); ctx.fill(); }
      }
      if (front) drawFace(ctx, P.x, P.y, P.r, P.t);
    }
    if (ri === 0) seatRow(ctx, row);
  });
  ctx.restore();
}

// ======================================================================
// 4:3 画幅：左右黑边（带胶片边缘颗粒和片孔）
// ======================================================================
const BAR_W = (FILM_W - (1000 * 4) / 3) / 2; // ≈ 222 单位（1080p 下每边 240px）
function barImg(side) {
  return baked(`s08-bar|${side}`, (BAR_W + 30) * K, 1000 * K, (ctx) => {
    ctx.scale(K, K);
    // side = -1 左边：内沿在右；side = 1 右边：内沿在左
    const inner = side < 0 ? BAR_W : 30;
    ctx.fillStyle = '#0b0a09';
    if (side < 0) ctx.fillRect(0, 0, BAR_W, 1000); else ctx.fillRect(30, 0, BAR_W, 1000);
    // 不规整的片门内沿：一圈很窄的毛边 + 发灰的边线
    ctx.fillStyle = '#0b0a09';
    ctx.beginPath();
    ctx.moveTo(inner, 0);
    for (let y = 0; y <= 1000; y += 8) ctx.lineTo(inner + (side < 0 ? 1 : -1) * (2 + 5 * hash2(y, 1, 823)), y);
    ctx.lineTo(inner, 1000); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = rgba('#5a524a', 0.6); ctx.lineWidth = 1.6;
    const ex = side < 0 ? BAR_W - 9 : 39;
    ctx.beginPath(); ctx.moveTo(ex, 0); ctx.lineTo(ex, 1000); ctx.stroke();
    // 颗粒：黑底上的亮斑（底片上的灰尘印成白点）
    const R = rng('s08-bar', side);
    for (let i = 0; i < 520; i++) {
      const x = side < 0 ? R() * BAR_W : 30 + R() * BAR_W, y = R() * 1000;
      ctx.fillStyle = rgba('#d8d0bc', 0.05 + R() * 0.18); circle(ctx, x, y, 0.5 + R() * 1.4); ctx.fill();
    }
  });
}
function drawBars(ctx, b) {
  const q = frameNo(b);
  ctx.drawImage(barImg(-1), X_MIN - 2, 0, BAR_W + 30, 1000);
  ctx.drawImage(barImg(1), X_MAX - BAR_W - 30 + 2, 0, BAR_W + 30, 1000);
  ctx.fillStyle = '#0b0a09';
  ctx.fillRect(X_MIN - 12, -10, 12, 1020); ctx.fillRect(X_MAX, -10, 12, 1020);
  // 片孔：在黑边外侧一列，每个量化帧往下走一点（胶片在走）
  const pitch = 66, off = (frameNo(b) * 0.37) % pitch;
  for (const [x0] of [[X_MIN + 40], [X_MAX - 40 - 34]]) {
    for (let y = -pitch + off; y < 1000 + pitch; y += pitch) {
      ctx.fillStyle = rgba('#3a342e', 0.95); roundRect(ctx, x0, y, 34, 44, 6); ctx.fill();
      ctx.fillStyle = rgba('#b8ae98', 0.35); roundRect(ctx, x0 + 3, y + 3, 28, 38, 5); ctx.fill();
    }
  }
  // 每帧不同的几个亮点 / 细毛
  for (let k = 0; k < 6; k++) {
    const left = hash2(q, k, 824) < 0.5;
    const x = left ? X_MIN + hash2(q, k, 825) * BAR_W : X_MAX - BAR_W + hash2(q, k, 825) * BAR_W, y = hash2(q, k, 826) * 1000;
    ctx.fillStyle = rgba('#e8e0cc', 0.5); circle(ctx, x, y, 1 + hash2(q, k, 827) * 2.2); ctx.fill();
  }
}

// ======================================================================
// 场景
// ======================================================================
const inGag43 = (rb) => rb >= T_43[0] && rb < T_43[1];

export const s08 = {
  id: 's08',
  station: ST,
  quantize: 10,
  // 老胶片：高反差灰阶、微泛黄；外面一圈很淡的暖白「光晕」（像老片的光渗），保证和街景拉得开
  figureStyle: 'film',
  figureRim: { color: '#f6efdc', width: 3, alpha: 0.5 },
  freezeBeat: SB(11) + 0.5, // Outro 展墙：4:3 画幅 + 观众扭头看向我们
  figureAdjust(b, env) {
    const rb = rawB(env), Z = zoomAt(rb);
    const [wx, wy] = weave(b);
    const [vx, vy] = toView(CHAR_X + wx, ROAD_Y + wy, Z);
    const o = { scale: Z, dx: vx - CHAR_X, dy: vy - ROAD_Y };
    // 定格、恢复走路按未量化的拍位切换，正好落在第 9、13 拍强拍上
    if (rb >= GAG && rb < STATION.leave[0]) o.pose = 'stand';
    else if (rb >= STATION.leave[0] && b < STATION.leave[0]) o.pose = 'walk';
    return o;
  },
  drawBack(ctx, b, env) {
    const rb = rawB(env), Z = zoomAt(rb);
    ctx.save();
    camera(ctx, Z);
    if (Z < 0.999) drawTheater(ctx);
    ctx.save();
    ctx.beginPath(); ctx.rect(X_MIN, 0, FILM_W, 1000); ctx.clip();
    drawFilm(ctx, b, env);
    ctx.restore();
    ctx.restore();
  },
  drawFront(ctx, b, env) {
    const rb = rawB(env), Z = zoomAt(rb), pull = pullAt(Z);
    const flick = flickerAt(b);
    ctx.save();
    camera(ctx, Z);
    ctx.save();
    ctx.beginPath(); ctx.rect(X_MIN, 0, FILM_W, 1000); ctx.clip();
    drawFilmFX(ctx, b);
    ctx.restore();
    ctx.restore();
    if (pull > 0.001) {
      drawBeam(ctx, b, pull, Z);
      drawAudience(ctx, b, rb, pull, flick);
    }
    if (inGag43(rb)) drawBars(ctx, b);
    drawGrain(ctx, b);
  },
  drawFrame(ctx, R) {
    // 离场画框：一格胶片画格——黑色片基 + 上下两排片孔，右边还拖着下一格
    const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 1.6, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
    const band = new Path2D();
    const ext = w * 0.6 + t; // 右边拖着的下一格
    band.rect(x - t, y - t * 1.45, w + 2 * t + ext, h + t * 2.9);
    band.rect(x, y, w, h);
    ctx.fillStyle = '#15120f'; ctx.fill(band, 'evenodd');
    // 下一格：深灰的空画格
    ctx.fillStyle = '#2c2824'; ctx.fillRect(x + w + t, y, ext - t * 0.2, h);
    ctx.fillStyle = 'rgba(239,233,216,0.06)'; ctx.fillRect(x + w + t + t * 0.4, y + t * 0.4, ext - t, h - t * 0.8);
    // 片孔
    const pw = t * 0.5, ph = t * 0.62, pitch = t * 0.95;
    ctx.fillStyle = '#e9e1cc';
    for (let px = x - t + t * 0.3; px < x + w + t + ext - pw; px += pitch) {
      for (const py of [y - t * 1.45 + t * 0.32, y + h + t * 1.45 - t * 0.32 - ph]) { roundRect(ctx, px, py, pw, ph, Math.max(1, t * 0.1)); ctx.fill(); }
    }
    // 画格框线与片基上的划痕
    ctx.strokeStyle = 'rgba(239,233,216,0.55)'; ctx.lineWidth = Math.max(1, 2 * s);
    ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
    ctx.strokeStyle = 'rgba(239,233,216,0.18)'; ctx.lineWidth = Math.max(1, 1.2 * s);
    for (let i = 0; i < 6; i++) {
      const sx = x - t + (w + 2 * t + ext) * hash2(i, 1, 828);
      ctx.beginPath(); ctx.moveTo(sx, y - t * 1.45); ctx.lineTo(sx + 4 * s, y + h + t * 1.45); ctx.stroke();
    }
    ctx.restore();
  },
  cardStyle: {
    ink: CREAM, accent: CREAM, bar: false,
    bgDraw(ctx, x, y, w, h) { intertitle(ctx, x, y, w, h, true); },
  },
  playerStyle: {
    plate: '#14110f', ink: CREAM, noteColor: CREAM, backdrop: true,
    palette: { disc: '#efe7d4', shine1: '#ffffff', shine2: '#cfc6b0', accent: '#8a8274', hub: '#f6f0e0', hole: '#2a2622', ink: '#2a2622' },
    plateDraw(ctx, x, y, w, h) { intertitle(ctx, x, y, w, h, false); },
    drawPlayer(ctx, kind, cx, cy, s, spin) { filmCD(ctx, cx, cy, s, spin); },
  },
};

/** 老电影字幕卡：黑底、细白双线边框、四角小菱形装饰。 */
function intertitle(ctx, x, y, w, h, corners) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  ctx.fillStyle = 'rgba(16,14,12,0.96)'; ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = rgba(CREAM, 0.95); ctx.lineWidth = 2.2; ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
  ctx.strokeStyle = rgba(CREAM, 0.55); ctx.lineWidth = 1; ctx.strokeRect(x + 15, y + 15, w - 30, h - 30);
  if (corners) {
    ctx.fillStyle = CREAM;
    for (const [cx, cy] of [[x + 9, y + 9], [x + w - 9, y + 9], [x + 9, y + h - 9], [x + w - 9, y + h - 9]]) {
      poly(ctx, [[cx, cy - 7], [cx + 7, cy], [cx, cy + 7], [cx - 7, cy]]); ctx.fill();
    }
    // 上下边中间的一小段装饰线
    ctx.strokeStyle = rgba(CREAM, 0.8); ctx.lineWidth = 1.5;
    for (const yy of [y + 9, y + h - 9]) {
      ctx.beginPath(); ctx.moveTo(x + w / 2 - 40, yy + (yy < y + h / 2 ? 8 : -8)); ctx.lineTo(x + w / 2 + 40, yy + (yy < y + h / 2 ? 8 : -8)); ctx.stroke();
    }
  }
  ctx.restore();
}

/** CD：米白盘面、灰阶，盘面上几圈细纹和一道反光，转起来看得出。 */
function filmCD(ctx, cx, cy, s, spin) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  circle(ctx, 0, 0, r);
  const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
  if (g) {
    g.addColorStop(0, '#efe7d4'); g.addColorStop(0.12, '#ffffff'); g.addColorStop(0.25, '#e6ddc8'); g.addColorStop(0.5, '#efe7d4');
    g.addColorStop(0.62, '#fbf6ea'); g.addColorStop(0.75, '#d9cfb9'); g.addColorStop(1, '#efe7d4');
    ctx.fillStyle = g;
  } else ctx.fillStyle = '#efe7d4';
  ctx.fill();
  ctx.lineWidth = 3 * s; ctx.strokeStyle = G0; ctx.stroke();
  ctx.strokeStyle = rgba(G2, 0.35); ctx.lineWidth = 1 * s;
  for (const k of [0.92, 0.84, 0.76]) { circle(ctx, 0, 0, r * k); ctx.stroke(); }
  // 一圈像胶片片孔的小方块（无字），转动时看得出
  ctx.fillStyle = rgba(G1, 0.8);
  for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.save(); ctx.rotate(a); ctx.fillRect(r * 0.55, -3 * s, 8 * s, 6 * s); ctx.restore(); }
  ctx.fillStyle = G0; ellipse(ctx, r * 0.42, 0, 6 * s, 4 * s); ctx.fill();
  circle(ctx, 0, 0, r * 0.26); ctx.fillStyle = '#f6f0e0'; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = G0; ctx.stroke();
  circle(ctx, 0, 0, r * 0.1); ctx.fillStyle = G0; ctx.fill();
  ctx.restore();
}

