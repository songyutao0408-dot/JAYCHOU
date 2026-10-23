// 第 11 站 · 惊叹号（Wow!, 2011）·「皮影戏」· 中国古代皮影戏 · 皮影
// 画面主体是一大幅被油灯从背后照亮的白幕布；所有景物和角色都是贴在幕布上的染色牛皮件：
// 半透明的红、黄、绿、黑，镂空雕花（铜钱纹、圆点、回纹、刀刻细线），关节处黄铜铆钉，角色带挑杆。
// 离幕布远的皮件影子更虚更淡（远山、城楼），贴着幕布的皮件锐利饱和。四周只露一圈窄窄的木戏台。
// 戏台框和幕布不动（p = 0），布景皮件从右往左滑过（像操纵者在幕后推着布景走）。
//
// 量化：quantize = 10，人物取帧、灯焰闪动、书生摇扇、马腿、三个影子的摇晃都按每秒约 10 次更新；
//       镜头平移（env.cam）不量化。硬切（定格、一分为三、合回一个、合扇、翻面）用未量化的拍位 env.gb − sec.start，
//       保证正好落在强拍上（同第 8 站）。
// 梗：第 9 拍强拍油灯猛地一晃，整块幕布的光一抖（一闪再一暗），他的皮影（同一帧站立剪影）一分为三左右散开，
//     左偏朱红、右偏青，半透明 multiply 叠上去；第 10–12 拍灯焰每拍摆到一头，三个影子跟着反向漂移、摇晃；
//     第 13 拍强拍合回一个，幕布一亮，书生「啪」地合上扇子；第 14 拍书生翻面，跟着往右走。
// 原创配角：挥扇书生（方巾飘带、青绿长衫、空脸侧面、折扇）、一匹皮影马（第 5–8 拍从他身后跑过）。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2, fbm } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { circle, ellipse, poly, roundRect, smoothPath } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, keyframes, TAU } from '../kit/math.js';
import { GAG, STATION, SB } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, ANCHORS } from '../rig/walker.js';
import { registerStyle, smoothColor, sobel, lumaArray, blur, outline, rgbf, mixc, sstep } from '../rig/styles.js';

const ST = stationByN(11);

// ---------- 调色板 ----------
const SCREEN = '#fff4dc';                      // 幕布
const OUT = '#2a1409';                         // 皮件描边（深褐）
const BLACK = '#24130b';                       // 黑皮
const RED = '#b3311f', RED_D = '#86231a';      // 朱红皮
const YEL = '#e2a63e', YEL_L = '#f0c96e';      // 黄皮
const GRN = '#3d7a45', GRN_D = '#2b5a3a', TEAL = '#2f7568'; // 绿皮、青皮
const HIDE = '#d6a058', HIDE_L = '#efcf8c';    // 本色牛皮
const BRASS = '#d8a743';                       // 铆钉
const ROD = '#3a1f10';                         // 挑杆的影子
const LACQ = '#6e2114', LACQ_D = '#3e130b', WOOD = '#8a4a26', WOOD_L = '#b8763e', GOLD = '#d4a24c'; // 戏台
const SHADOW = '#5a3018';                      // 远处虚影

// ---------- 版面 ----------
const SCR = { y0: 34, y1: 892 };               // 幕布上下沿（单位）；之外是木戏台
const GROUND_END = SCR.y1 - ROAD_Y;            // 挑杆画到幕布下沿为止（相对脚下）
const SCH_SX = 840;                            // 书生：定格时在画面上的 x
const LAMP_X = 520, LAMP_Y = 236;              // 油灯（幕后）在幕布上的亮斑

// ---------- 时间（段内拍位） ----------
const LEAVE = STATION.leave[0];                // 第 13 拍：合回一个、继续走
const T_HORSE = [SB(5) - 0.2, SB(8) + 0.7];    // 第 5–8 拍：皮影马从右往左跑过
const T_FLIP = SB(14);                         // 第 14 拍：书生翻面
/** 未量化的段内拍位：硬切都用它，保证正好落在强拍上。 */
const rawB = (env) => env.gb - env.sec.start;
/** 每个量化帧一个整数编号，给闪动取随机数。 */
const frameNo = (b) => Math.round(b * 1000);

// ======================================================================
// 油灯：平时轻轻闪；第 9 拍猛地一晃，之后每拍摆到一头，第 13 拍稳住
// ======================================================================
/** 灯焰摆动 −1..1（量化拍位 b 决定姿态，未量化拍位 rb 决定开始 / 结束）。 */
function swing(b, rb) {
  if (rb < GAG) return 0;
  const x = Math.max(0, b - GAG);
  if (rb < LEAVE) return Math.cos(Math.PI * x) * keyframes([[-0.3, 0.7], [0.02, 0.75], [0.12, 1.15], [0.3, 1]], b - GAG);
  const t = rb - LEAVE;
  return t < 0.9 ? Math.cos(Math.PI * x) * 0.3 * (1 - t / 0.9) : 0;
}
function lampAt(b, rb) {
  const q = frameNo(b);
  const sw = swing(b, rb);
  const x = LAMP_X + (noise2(b * 0.9, 0.3, 1101) - 0.5) * 36 + (hash2(q, 1, 1102) - 0.5) * 10 + sw * 250;
  const tilt = (hash2(q, 2, 1102) - 0.5) * 0.22 + (noise2(b * 1.7, 0.7, 1103) - 0.5) * 0.3 - sw * 0.85;
  const size = 1 + (hash2(q, 4, 1102) - 0.5) * 0.16 + Math.abs(sw) * 0.25;
  // 亮度：每格轻微闪动；第 9 拍一闪再一暗；第 13 拍一亮
  let f = (hash2(q, 3, 1102) - 0.5) * 0.05 - 0.06 * Math.abs(sw);
  const d9 = rb - GAG, d13 = rb - LEAVE;
  if (d9 >= 0 && d9 < 0.14) f += 0.3;
  else if (d9 >= 0.14 && d9 < 0.75) f -= 0.2 * (1 - (d9 - 0.14) / 0.61);
  if (d13 >= 0 && d13 < 0.55) f += 0.2 * (1 - d13 / 0.55);
  return { x, tilt, size, f, sw };
}
/** 离幕布越远的皮件，灯一动影子移得越多（depth：0 贴着幕布 … 0.3 很远）。 */
const shadowShift = (L, depth) => -(L.x - LAMP_X) * depth;

// ======================================================================
// 皮件绘制：染色 + 皮纹 + 镂空 + 留边 + 描边
// ======================================================================
/** 皮纹：深浅不匀的斑驳（可平铺）。 */
function mottle() {
  return memo('s11-mottle', () => {
    const S = 192, c = makeCanvas(S, S), g = c.getContext('2d');
    const im = g.createImageData(S, S);
    const f = (x, y) => fbm(x / 30, y / 30, 1111, 3);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = (f(x, y) * (S - x) * (S - y) + f(x - S, y) * x * (S - y) + f(x, y - S) * (S - x) * y + f(x - S, y - S) * x * y) / (S * S);
      const p = (y * S + x) * 4;
      const fiber = hash2(x >> 1, y, 1112) < 0.05 ? 0.12 : 0;
      im.data[p] = 40; im.data[p + 1] = 18; im.data[p + 2] = 6;
      im.data[p + 3] = 255 * Math.min(0.5, Math.max(0, (v - 0.42) * 1.1) + fiber);
    }
    g.putImageData(im, 0, 0);
    return c;
  });
}
/** 在 g 上画一块皮件：path 是 Path2D；cut(g) 在 destination-out 模式下刻出镂空。 */
function leather(g, path, fill, { line = 2.4, rim = 4, cut = null, edge = OUT, tex = 0.55, union = false } = {}) {
  g.save();
  // union：几个圆拼成的形状（云头、树冠）只描外轮廓——先描粗边再填色盖住里面的线
  if (union) { g.lineWidth = line * 2; g.strokeStyle = edge; g.lineJoin = 'round'; g.stroke(path); rim = 0; line = 0; }
  g.fillStyle = fill; g.fill(path);
  if (tex) { g.save(); g.clip(path); g.globalAlpha = tex; g.fillStyle = g.createPattern(mottle(), 'repeat'); g.fill(path); g.restore(); }
  if (cut) {
    g.save(); g.clip(path); g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; g.lineJoin = 'round';
    cut(g); g.restore();
  }
  if (rim) { g.lineWidth = rim; g.strokeStyle = fill; g.stroke(path); }
  if (line) { g.lineWidth = line; g.strokeStyle = edge; g.lineJoin = 'round'; g.stroke(path); }
  g.restore();
}
// ---- 镂空纹样（在 destination-out 模式下调用） ----
const cutDot = (g, x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
const cutRing = (g, x, y, r, w) => { g.lineWidth = w; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); };
const cutDiamond = (g, x, y, r) => { g.beginPath(); g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); g.closePath(); g.fill(); };
function cutLine(g, pts, w) { g.lineWidth = w; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke(); }
function cutGrid(x0, y0, x1, y1, sp, fn, stagger = true) {
  for (let j = 0, y = y0; y <= y1; y += sp, j++) for (let x = x0 + (stagger && j % 2 ? sp / 2 : 0); x <= x1; x += sp) fn(x, y, j);
}
/** 铜钱纹：一圈细环 + 中间方孔。 */
function cutCoin(g, x, y, r) {
  cutRing(g, x, y, r, Math.max(1.2, r * 0.22));
  g.fillRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56);
}
/** 回纹（方形螺旋）。 */
function cutMeander(g, x, y, s, w) {
  cutLine(g, [[x, y + s], [x, y], [x + s, y], [x + s, y + s * 0.78], [x + s * 0.24, y + s * 0.78], [x + s * 0.24, y + s * 0.26], [x + s * 0.74, y + s * 0.26], [x + s * 0.74, y + s * 0.54]], w);
}
/** 云头螺旋。 */
function cutSpiral(g, cx, cy, r, turns, w, dir = 1) {
  const pts = [];
  for (let t = 0; t <= 1; t += 0.03) { const a = dir * t * turns * TAU, rr = r * (1 - t * 0.85); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  cutLine(g, pts, w);
}
/** 柳叶形小孔。 */
function cutLeaf(g, x, y, l, wd, a) { g.beginPath(); g.ellipse(x, y, l, wd, a, 0, TAU); g.fill(); }
/** 花瓣一圈。 */
function cutPetals(g, cx, cy, r, n, l, wd, a0 = 0) {
  for (let i = 0; i < n; i++) { const a = a0 + (i / n) * TAU; cutLeaf(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r, l, wd, a); }
}
/** 黄铜铆钉。 */
function rivet(g, x, y, r) {
  g.save();
  g.fillStyle = OUT; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  g.fillStyle = BRASS; g.beginPath(); g.arc(x, y, r * 0.72, 0, TAU); g.fill();
  g.fillStyle = '#fbe6a8'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.28, 0, TAU); g.fill();
  g.restore();
}
/** 挑杆的影子：从 (x, y) 斜着伸到幕布下沿（相对脚下 y = GROUND_END）。 */
function rodShadow(ctx, x, y, dx, w = 4) {
  ctx.save();
  ctx.strokeStyle = rgba(ROD, 0.72); ctx.lineWidth = w; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, GROUND_END); ctx.stroke();
  ctx.restore();
  rivet(ctx, x, y, w * 1.3);
}
/** 在 ctx 的 (ox, oy) 处画一块皮件（独立画布，镂空只穿透它自己）。bb = 局部包围盒 [x0, y0, x1, y1]。 */
function pieceOn(ctx, ox, oy, bb, draw, alpha = 0.93) {
  const c = pieceCanvas(bb, draw);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(c, ox + bb[0], oy + bb[1], bb[2] - bb[0], bb[3] - bb[1]);
  ctx.restore();
}
function pieceCanvas(bb, draw) {
  const c = makeCanvas((bb[2] - bb[0]) * K, (bb[3] - bb[1]) * K);
  const g = c.getContext('2d');
  g.scale(K, K); g.translate(-bb[0], -bb[1]);
  draw(g);
  return c;
}
/** 烘焙一块会动的皮件（角色的部件），画的时候 ctx.drawImage(c, bb[0], bb[1], w, h)。 */
function partCanvas(key, bb, draw) {
  return memo(`s11-part|${key}`, () => pieceCanvas(bb, draw));
}
function drawPart(ctx, key, bb, draw, alpha = 0.94) {
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(partCanvas(key, bb, draw), bb[0], bb[1], bb[2] - bb[0], bb[3] - bb[1]);
  ctx.restore();
}
const P = (fn) => { const p = new Path2D(); fn(p); return p; };
/** 多个圆的并集（云头、树冠）。 */
function blobs(list) {
  return P((p) => { for (const [x, y, r] of list) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); } });
}

// ======================================================================
// 幕布、灯光、戏台框（都不动）
// ======================================================================
function screenImg() {
  const w = X_MAX - X_MIN;
  return baked('s11-screen', w * K, 1000 * K, (g) => {
    g.scale(K, K); g.translate(-X_MIN, 0);
    g.fillStyle = SCREEN; g.fillRect(X_MIN, 0, w, 1000);
    // 布纹：很淡的经纬线 + 斑驳
    g.strokeStyle = rgba('#c9a46a', 0.06); g.lineWidth = 0.6;
    for (let x = X_MIN; x < X_MAX; x += 3.2) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1000); g.stroke(); }
    for (let y = 0; y < 1000; y += 3.4) { g.beginPath(); g.moveTo(X_MIN, y); g.lineTo(X_MAX, y); g.stroke(); }
    const R = rng('s11-cloth');
    for (let i = 0; i < 900; i++) { g.fillStyle = rgba('#b88a4c', 0.025 + R() * 0.04); ellipse(g, R.range(X_MIN, X_MAX), R.range(0, 1000), R.range(6, 40), R.range(3, 14)); g.fill(); }
    // 几道接缝（几幅布缝在一起）
    for (const sx of [-60, 470, 1010]) {
      g.strokeStyle = rgba('#b58a52', 0.22); g.lineWidth = 2; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx, 1000); g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.5); g.lineWidth = 1.2; g.beginPath(); g.moveTo(sx + 2.4, 0); g.lineTo(sx + 2.4, 1000); g.stroke();
    }
    // 幕布被横楣、台沿压住的地方有一点阴影
    let gr = g.createLinearGradient(0, SCR.y0, 0, SCR.y0 + 40);
    gr.addColorStop(0, rgba('#6a3a18', 0.35)); gr.addColorStop(1, rgba('#6a3a18', 0));
    g.fillStyle = gr; g.fillRect(X_MIN, SCR.y0, w, 40);
    gr = g.createLinearGradient(0, SCR.y1 - 24, 0, SCR.y1);
    gr.addColorStop(0, rgba('#6a3a18', 0)); gr.addColorStop(1, rgba('#6a3a18', 0.25));
    g.fillStyle = gr; g.fillRect(X_MIN, SCR.y1 - 24, w, 24);
  });
}
// 灯光（multiply 叠在整块幕布上）：中心近白，四角偏橙
const LM = { x0: -1100, x1: 2100, cy: 340 };
function lightMap() {
  const s = 0.25 * K;
  return baked('s11-light', (LM.x1 - LM.x0) * s, (SCR.y1 - SCR.y0) * s, (g) => {
    g.scale(s, s); g.translate(-LM.x0, -SCR.y0);
    g.save(); g.translate(LAMP_X, LM.cy); g.scale(1, 0.64);
    const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1250);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.3, '#fff7e8'); gr.addColorStop(0.55, '#f9e3b8');
    gr.addColorStop(0.78, '#ebc187'); gr.addColorStop(1, '#d39858');
    g.fillStyle = gr; g.fillRect(-3000, -3000, 6000, 6000);
    g.restore();
  });
}
/** 透过幕布看到的灯焰亮斑（画在皮件之前：皮件挡在灯和我们之间）。 */
function drawLampGlow(ctx, L) {
  const x = L.x, y = LAMP_Y;
  ctx.save();
  let gr = ctx.createRadialGradient(x, y + 20, 0, x, y + 20, 300 * L.size);
  gr.addColorStop(0, rgba('#fffef6', 1)); gr.addColorStop(0.12, rgba('#fff0bf', 0.95)); gr.addColorStop(0.35, rgba('#ffd98a', 0.55));
  gr.addColorStop(0.7, rgba('#ffcf7a', 0.16)); gr.addColorStop(1, rgba('#ffcf7a', 0));
  ctx.fillStyle = gr; ctx.fillRect(x - 320, y - 300, 640, 640);
  // 灯焰：一滴倒挂的火苗，随摆动倾斜
  ctx.translate(x, y + 30); ctx.rotate(L.tilt); ctx.scale(L.size, L.size);
  gr = ctx.createRadialGradient(0, -14, 2, 0, -10, 44);
  gr.addColorStop(0, rgba('#ffffff', 1)); gr.addColorStop(0.5, rgba('#fff3c4', 0.95)); gr.addColorStop(1, rgba('#ffc65a', 0));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.moveTo(0, -70); ctx.bezierCurveTo(16, -40, 22, -12, 18, 2); ctx.bezierCurveTo(14, 16, -14, 16, -18, 2); ctx.bezierCurveTo(-22, -12, -16, -40, 0, -70); ctx.fill();
  ctx.restore();
}
function drawLight(ctx, L) {
  const w = X_MAX - X_MIN, h = SCR.y1 - SCR.y0;
  ctx.save();
  ctx.beginPath(); ctx.rect(X_MIN, SCR.y0, w, h); ctx.clip();
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightMap(), LM.x0 + (L.x - LAMP_X), SCR.y0, LM.x1 - LM.x0, h);
  ctx.globalCompositeOperation = 'source-over';
  if (L.f < 0) { ctx.fillStyle = rgba('#4a2410', -L.f); ctx.fillRect(X_MIN, SCR.y0, w, h); }
  else if (L.f > 0) { ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = rgba('#fff0c8', L.f); ctx.fillRect(X_MIN, SCR.y0, w, h); }
  ctx.restore();
}

/** 木戏台：雕花漆木横楣、两角雀替、两侧窄柱、底部台沿（画在最前面，挡住挑杆末端）。 */
function stageImg() {
  const w = X_MAX - X_MIN;
  return baked('s11-stage', w * K, 1000 * K, (g) => {
    g.scale(K, K); g.translate(-X_MIN, 0);
    // 横楣
    let gr = g.createLinearGradient(0, 0, 0, SCR.y0);
    gr.addColorStop(0, LACQ_D); gr.addColorStop(0.5, LACQ); gr.addColorStop(1, LACQ_D);
    g.fillStyle = gr; g.fillRect(X_MIN, 0, w, SCR.y0);
    g.strokeStyle = GOLD; g.lineWidth = 1.6;
    for (const y of [4, SCR.y0 - 4]) { g.beginPath(); g.moveTo(X_MIN, y); g.lineTo(X_MAX, y); g.stroke(); }
    g.lineWidth = 1.5; g.strokeStyle = rgba(GOLD, 0.85);
    for (let x = X_MIN + 8; x < X_MAX; x += 36) {
      const s = 14, y = 10;
      g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y); g.lineTo(x + s, y); g.lineTo(x + s, y + s * 0.78); g.lineTo(x + s * 0.24, y + s * 0.78); g.lineTo(x + s * 0.24, y + s * 0.3); g.lineTo(x + s * 0.7, y + s * 0.3); g.stroke();
      g.fillStyle = GOLD; circle(g, x + 27, 17, 2.2); g.fill();
    }
    // 横楣下的荷叶边
    g.fillStyle = LACQ_D;
    for (let x = X_MIN; x < X_MAX; x += 22) { g.beginPath(); g.arc(x + 11, SCR.y0, 11, 0, Math.PI); g.fill(); }
    g.strokeStyle = rgba(GOLD, 0.7); g.lineWidth = 1.2;
    for (let x = X_MIN; x < X_MAX; x += 22) { g.beginPath(); g.arc(x + 11, SCR.y0, 8, 0.2, Math.PI - 0.2); g.stroke(); }
    // 两角雀替（雕花木托，镂空）
    for (const side of [-1, 1]) {
      g.save();
      if (side > 0) { g.translate(X_MAX + X_MIN, 0); g.scale(-1, 1); }
      const x0 = X_MIN + 20;
      const br = P((p) => { p.moveTo(x0, SCR.y0); p.lineTo(x0 + 190, SCR.y0); p.bezierCurveTo(x0 + 150, SCR.y0 + 10, x0 + 120, SCR.y0 + 26, x0 + 104, SCR.y0 + 48);
        p.bezierCurveTo(x0 + 80, SCR.y0 + 40, x0 + 60, SCR.y0 + 60, x0 + 58, SCR.y0 + 84); p.bezierCurveTo(x0 + 34, SCR.y0 + 86, x0 + 16, SCR.y0 + 110, x0 + 14, SCR.y0 + 150); p.lineTo(x0, SCR.y0 + 150); p.closePath(); });
      g.fillStyle = LACQ; g.fill(br);
      g.save(); g.clip(br); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round';
      cutSpiral(g, x0 + 66, SCR.y0 + 22, 14, 1.3, 3.2); cutSpiral(g, x0 + 30, SCR.y0 + 58, 12, 1.3, 3, -1); cutSpiral(g, x0 + 14, SCR.y0 + 104, 7, 1.2, 2.4);
      cutLeaf(g, x0 + 120, SCR.y0 + 12, 22, 4, 0); g.restore();
      g.strokeStyle = GOLD; g.lineWidth = 1.8; g.stroke(br);
      g.restore();
    }
    // 两侧窄柱
    for (const x of [X_MIN, X_MAX - 22]) {
      gr = g.createLinearGradient(x, 0, x + 22, 0);
      gr.addColorStop(0, LACQ_D); gr.addColorStop(0.45, LACQ); gr.addColorStop(1, LACQ_D);
      g.fillStyle = gr; g.fillRect(x, 0, 22, 1000);
      g.strokeStyle = rgba(GOLD, 0.8); g.lineWidth = 1.2; g.strokeRect(x + 5, SCR.y0 + 4, 12, SCR.y1 - SCR.y0 - 8);
    }
    // 台沿：上面一道被灯照亮的木条，下面是漆木裙板（描金框 + 铜钱纹）
    gr = g.createLinearGradient(0, SCR.y1, 0, SCR.y1 + 18);
    gr.addColorStop(0, '#e6b06a'); gr.addColorStop(0.3, WOOD_L); gr.addColorStop(1, WOOD);
    g.fillStyle = gr; g.fillRect(X_MIN, SCR.y1, w, 18);
    gr = g.createLinearGradient(0, SCR.y1 + 18, 0, 1000);
    gr.addColorStop(0, '#5a1c10'); gr.addColorStop(1, LACQ_D);
    g.fillStyle = gr; g.fillRect(X_MIN, SCR.y1 + 18, w, 1000 - SCR.y1 - 18);
    g.fillStyle = rgba('#000000', 0.35); g.fillRect(X_MIN, SCR.y1 + 18, w, 4);
    for (let x = X_MIN + 30; x < X_MAX - 60; x += 250) {
      roundRect(g, x, SCR.y1 + 34, 220, 56, 8); g.fillStyle = rgba('#2a0a05', 0.35); g.fill();
      g.strokeStyle = GOLD; g.lineWidth = 1.6; g.stroke();
      g.strokeStyle = rgba(GOLD, 0.9); g.lineWidth = 2;
      circle(g, x + 110, SCR.y1 + 62, 16); g.stroke(); g.strokeRect(x + 104, SCR.y1 + 56, 12, 12);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + 110 + s * 26, SCR.y1 + 62); g.lineTo(x + 110 + s * 90, SCR.y1 + 62); g.stroke(); circle(g, x + 110 + s * 96, SCR.y1 + 62, 4); g.stroke(); }
    }
  });
}

// ======================================================================
// 远影：离幕布远的皮件，影子大、虚、淡
// ======================================================================
const P_FAR1 = 0.12, P_FAR2 = 0.4, P_NEAR = 1;
function softLayer(ctx, x0, x1, y0, y1, blurPx, alpha, draw) {
  const c = makeCanvas((x1 - x0) * K, (y1 - y0) * K);
  const g = c.getContext('2d');
  g.scale(K, K); g.translate(-x0, -y0);
  draw(g);
  ctx.save(); ctx.filter = `blur(${blurPx}px)`; ctx.globalAlpha = alpha;
  ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
function far1Layer() {
  return strip('s11-far1', P_FAR1, (ctx, x0, x1) => {
    softLayer(ctx, x0, x1, 120, 880, 16, 0.2, (g) => {
      const R = rng('s11-far1');
      g.fillStyle = SHADOW;
      // 远山：几座圆润的峰连成一片
      g.beginPath(); g.moveTo(x0, 880);
      for (let x = x0; x <= x1; x += 6) {
        const h = 150 + 170 * Math.pow(Math.abs(Math.sin(x * 0.0042 + 0.6)), 1.6) + 70 * noise2(x * 0.006, 0.5, 1121);
        g.lineTo(x, 800 - h);
      }
      g.lineTo(x1, 880); g.closePath(); g.fill();
      // 长云
      for (let x = x0 + 100; x < x1; x += R.range(500, 760)) {
        const y = R.range(170, 260);
        for (let k = 0; k < 4; k++) { ellipse(g, x + k * 60, y - (k % 2) * 16, 70, 26); g.fill(); }
      }
    });
  }, { y0: 120, y1: 880 });
}
function far2Layer() {
  return strip('s11-far2', P_FAR2, (ctx, x0, x1) => {
    softLayer(ctx, x0, x1, 300, 880, 3.5, 0.32, (g) => {
      const R = rng('s11-far2');
      g.fillStyle = SHADOW;
      // 城墙（带垛口）
      g.fillRect(x0, 712, x1 - x0, 170);
      for (let x = x0; x < x1; x += 30) g.fillRect(x, 700, 18, 14);
      // 城楼、塔、圆树
      for (let x = x0 + 80; x < x1;) {
        const k = R();
        if (k < 0.34) { // 城楼：台基 + 两重檐
          const w = R.range(150, 200);
          g.fillRect(x, 640, w, 80);
          roof(g, x + w / 2, 640, w * 0.72, 40); g.fillRect(x + w * 0.2, 590, w * 0.6, 40); roof(g, x + w / 2, 590, w * 0.56, 34);
          x += w + R.range(120, 260);
        } else if (k < 0.6) { // 塔
          const w = R.range(60, 80);
          for (let i = 0; i < 6; i++) { const ww = w * (1 - i * 0.1), y = 712 - i * 44; g.fillRect(x - ww * 0.35, y - 34, ww * 0.7, 34); roof(g, x, y - 34, ww * 0.7, 18); }
          g.fillRect(x - 2, 712 - 6 * 44 - 40, 4, 44);
          x += R.range(200, 330);
        } else { // 一团树
          for (let i = 0; i < 4; i++) { circle(g, x + i * 26 - 40, 680 - (i % 2) * 30, R.range(30, 46)); g.fill(); }
          x += R.range(180, 300);
        }
      }
      // 窗洞（镂空，糊开后是浅光斑）
      g.save(); g.globalCompositeOperation = 'destination-out';
      for (let x = x0; x < x1; x += 22) for (const y of [610, 660]) if (hash2(Math.round(x), y, 1122) < 0.35) g.fillRect(x, y, 8, 12);
      g.restore();
    });
  }, { y0: 300, y1: 880 });
}
/** 飞檐屋顶（远影用，实心）。 */
function roof(g, cx, y, w, h) {
  g.beginPath();
  g.moveTo(cx - w / 2 - w * 0.18, y - h * 0.15);
  g.quadraticCurveTo(cx - w * 0.3, y - h * 0.2, cx - w * 0.12, y - h);
  g.lineTo(cx + w * 0.12, y - h);
  g.quadraticCurveTo(cx + w * 0.3, y - h * 0.2, cx + w / 2 + w * 0.18, y - h * 0.15);
  g.lineTo(cx + w / 2, y); g.lineTo(cx - w / 2, y); g.closePath(); g.fill();
}

// ======================================================================
// 贴在幕布上的皮件布景（p = 1）
// ======================================================================
/** 地面：一长条镂空的绿色皮件 + 黄色边带（他踩在 ROAD_Y 上）。 */
function drawGround(ctx, x0, x1) {
  const top = (x) => ROAD_Y + 1.5 * Math.sin(x * 0.05) + 1.5 * Math.sin(x * 0.013);
  pieceOn(ctx, 0, 0, [x0, 770, x1, 910], (g) => {
    const band = P((p) => { p.moveTo(x0, 910); for (let x = x0; x <= x1; x += 8) p.lineTo(x, top(x)); p.lineTo(x1, 910); p.closePath(); });
    leather(g, band, GRN, {
      line: 2.6,
      cut: (c) => {
        for (let x = x0; x < x1; x += 30) { c.lineWidth = 2.6; c.beginPath(); c.arc(x, 838, 12, Math.PI * 1.05, Math.PI * 1.95); c.stroke(); }
        for (let x = x0 + 15; x < x1; x += 30) { c.lineWidth = 2; c.beginPath(); c.arc(x, 826, 7, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
        for (let x = x0 + 7; x < x1; x += 15) cutDot(c, x, 812, 1.8);
        cutLine(c, [[x0, 850], [x1, 850]], 2.4);
      },
    });
    // 下面的黄边带：铜钱纹
    const lower = P((p) => p.rect(x0, 856, x1 - x0, 60));
    leather(g, lower, YEL, { line: 2, rim: 0, cut: (c) => { for (let x = x0 + 13; x < x1; x += 26) cutCoin(c, x, 874, 8); } });
    // 草叶与小花
    const R = rng('s11-grass');
    for (let x = x0 + 20; x < x1; x += R.range(40, 110)) {
      const n = R.int(3, 5), y = top(x) + 2;
      const blade = P((p) => {
        for (let k = 0; k < n; k++) {
          const bx = x + (k - n / 2) * 7, l = R.range(14, 30), lean = R.range(-0.5, 0.5);
          p.moveTo(bx - 3, y); p.quadraticCurveTo(bx + lean * l * 0.3, y - l * 0.6, bx + lean * l, y - l); p.quadraticCurveTo(bx + 1, y - l * 0.4, bx + 3, y); p.closePath();
        }
      });
      leather(g, blade, R() < 0.5 ? GRN_D : GRN, { line: 1.4, rim: 0, tex: 0 });
      if (R() < 0.18) { const f = blobs([[x + 6, y - 30, 7]]); leather(g, f, R() < 0.5 ? RED : YEL, { line: 1.4, rim: 0, tex: 0, cut: (c) => cutDot(c, x + 6, y - 30, 2.4) }); }
    }
  }, 0.95);
}

/** 垂柳。 */
function willow(g, R) {
  const trunk = P((p) => {
    p.moveTo(-30, 0); p.bezierCurveTo(-20, -90, -36, -170, -14, -250);
    p.bezierCurveTo(-40, -300, -80, -330, -112, -352); p.lineTo(-98, -364);
    p.bezierCurveTo(-60, -342, -22, -312, -2, -284);
    p.bezierCurveTo(10, -322, 30, -352, 52, -374); p.lineTo(64, -364);
    p.bezierCurveTo(40, -330, 22, -290, 16, -246);
    p.bezierCurveTo(30, -160, 14, -80, 34, 0); p.closePath();
  });
  leather(g, trunk, HIDE, { cut: (c) => {
    for (let i = 0; i < 9; i++) { const y = -30 - i * 26; cutLine(c, [[-14 + (i % 2) * 8, y], [-4 + (i % 2) * 8, y - 14], [-10 + (i % 2) * 8, y - 22]], 2.2); }
    cutRing(c, 4, -150, 7, 2.4); cutDot(c, 4, -150, 2);
  } });
  // 柳丝（先画，树冠盖住上端）
  for (let x = -230; x <= 150; x += 22) {
    const y0 = -320 + Math.abs(x + 40) * 0.25, L = R.range(130, 210), bend = R.range(-14, 14);
    g.strokeStyle = GRN_D; g.lineWidth = 2.6;
    g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + bend, y0 + L * 0.5, x + bend * 0.4, y0 + L); g.stroke();
    for (let t = 0.15; t < 1; t += 0.11) {
      const lx = x + bend * (2 * t * (1 - t)) + bend * 0.4 * t * t, ly = y0 + L * t, s = t * 22 % 2 < 1 ? 1 : -1;
      g.save(); g.translate(lx, ly); g.rotate(s * 0.7);
      g.fillStyle = GRN; ellipse(g, s * 6, 0, 8, 3); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.stroke();
      g.restore();
    }
  }
  const crown = blobs([[-120, -380, 70], [-40, -412, 82], [52, -396, 70], [-178, -330, 56], [112, -340, 56], [-84, -340, 62], [22, -346, 62]]);
  leather(g, crown, GRN, { union: true, cut: (c) => cutGrid(-260, -500, 180, -280, 19, (x, y, j) => cutLeaf(c, x, y, 7.5, 2.6, j % 2 ? -0.6 : 0.6)) });
}
/** 太湖石。 */
function rock(g, R, w, h, col) {
  const pts = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU, r = 0.78 + 0.3 * R();
    pts.push([Math.cos(a) * w * 0.5 * r, -h * 0.5 + Math.sin(a) * h * 0.5 * r]);
  }
  smoothPath(g, pts, true);
  const body = new Path2D(); body.addPath(P((p) => { p.moveTo(pts[0][0], pts[0][1]); }));
  const path = P((p) => {
    const n = pts.length, Q = (i) => pts[(i + n) % n];
    p.moveTo(Q(0)[0], Q(0)[1]);
    for (let i = 0; i < n; i++) {
      const p0 = Q(i - 1), p1 = Q(i), p2 = Q(i + 1), p3 = Q(i + 2);
      p.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
    }
    p.closePath();
  });
  const holes = [[R.range(-0.2, 0.1), R.range(0.5, 0.65), 0.13], [R.range(0.1, 0.25), R.range(0.25, 0.4), 0.09], [R.range(-0.3, -0.15), R.range(0.25, 0.4), 0.07]];
  leather(g, path, col, { cut: (c) => {
    for (const [hx, hy, hr] of holes) { c.beginPath(); c.ellipse(hx * w, -hy * h, hr * w, hr * h * 0.9, R.range(-0.5, 0.5), 0, TAU); c.fill(); }
    for (let i = 0; i < 6; i++) { const y = -h * R.range(0.1, 0.9), x = w * R.range(-0.35, 0.3); cutLine(c, [[x, y], [x + 16, y - 6], [x + 30, y + 2]], 2); }
  } });
  ellipse(g, 0, 0, 0, 0);
}
/** 亭子：台基、红柱、绿色回纹栏杆、黄色挂落、黑瓦飞檐、宝顶。 */
function pavilion(g) {
  // 台基
  const base = P((p) => p.rect(-200, -42, 400, 42));
  leather(g, base, HIDE, { cut: (c) => { for (let y = -32; y < 0; y += 14) for (let x = -196 + (y % 28 ? 0 : 20); x < 200; x += 40) c.fillRect(x, y, 34, 2.4); } });
  // 柱
  for (const x of [-150, 0, 150]) {
    const col = P((p) => p.rect(x - 9, -282, 18, 242));
    leather(g, col, RED, { rim: 2, cut: (c) => { cutLine(c, [[x, -270], [x, -60]], 2.4); } });
  }
  // 栏杆（两段）
  for (const [a, b2] of [[-141, -9], [9, 141]]) {
    const rail = P((p) => p.rect(a, -112, b2 - a, 70));
    leather(g, rail, GRN, { cut: (c) => { for (let x = a + 6; x < b2 - 20; x += 26) { cutMeander(c, x, -100, 18, 2.6); cutMeander(c, x, -72, 18, 2.6); } } });
    const top = P((p) => p.rect(a - 4, -120, b2 - a + 8, 10));
    leather(g, top, RED, { rim: 0, line: 1.8 });
  }
  // 挂落
  const hang = P((p) => { p.moveTo(-160, -300); p.lineTo(160, -300); p.lineTo(160, -276); p.lineTo(140, -264); p.lineTo(-140, -264); p.lineTo(-160, -276); p.closePath(); });
  leather(g, hang, YEL, { cut: (c) => { for (let x = -150; x < 150; x += 16) cutDiamond(c, x + 8, -284, 5.5); } });
  // 屋顶：内凹的坡、两头起翘
  const rf = P((p) => {
    p.moveTo(-262, -332); p.quadraticCurveTo(-232, -304, -196, -300); p.lineTo(196, -300); p.quadraticCurveTo(232, -304, 262, -332);
    p.quadraticCurveTo(110, -330, 14, -432); p.lineTo(-14, -432); p.quadraticCurveTo(-110, -330, -262, -332); p.closePath();
  });
  leather(g, rf, BLACK, { cut: (c) => {
    for (let x = -180; x <= 180; x += 15) { const t = Math.abs(x) / 196; cutLine(c, [[x * 0.98, -306], [x * (0.25 + 0.6 * (1 - t)), -330 - 90 * (1 - t) ** 1.6]], 2); }
  } });
  const eave = P((p) => { p.moveTo(-262, -332); p.quadraticCurveTo(-232, -304, -196, -300); p.lineTo(196, -300); p.quadraticCurveTo(232, -304, 262, -332); p.quadraticCurveTo(236, -316, 196, -312); p.lineTo(-196, -312); p.quadraticCurveTo(-236, -316, -262, -332); p.closePath(); });
  leather(g, eave, YEL, { rim: 0, line: 1.6, cut: (c) => { for (let x = -190; x < 196; x += 14) cutDot(c, x, -306, 2.2); } });
  // 宝顶
  const fin = P((p) => { p.moveTo(-12, -432); p.quadraticCurveTo(-18, -452, 0, -462); p.quadraticCurveTo(18, -452, 12, -432); p.closePath(); p.moveTo(9, -474); p.arc(0, -474, 9, 0, TAU); });
  leather(g, fin, YEL, { rim: 0, line: 1.8 });
  for (const x of [-150, 0, 150]) { rivet(g, x, -282, 4); rivet(g, x, -48, 4); }
}
/** 两层楼阁。 */
function tower(g) {
  const base = P((p) => p.rect(-150, -40, 300, 40));
  leather(g, base, HIDE, { cut: (c) => { for (let x = -140; x < 140; x += 30) c.fillRect(x, -26, 22, 3); } });
  // 一层
  const w1 = P((p) => p.rect(-120, -230, 240, 190));
  leather(g, w1, RED, { cut: (c) => {
    c.fillRect(-28, -180, 56, 138); // 门洞
    for (const x of [-100, 48]) { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(x + 4 + i * 13, -186 + j * 22, 9, 17); }
  } });
  const door = P((p) => p.rect(-28, -180, 56, 138));
  leather(g, door, YEL, { line: 1.8, rim: 0, cut: (c) => { cutLine(c, [[0, -176], [0, -46]], 2); for (let y = -164; y < -50; y += 24) { cutCoin(c, -14, y, 6); cutCoin(c, 14, y, 6); } } });
  // 一层屋檐
  const r1 = P((p) => { p.moveTo(-196, -246); p.quadraticCurveTo(-170, -228, -140, -226); p.lineTo(140, -226); p.quadraticCurveTo(170, -228, 196, -246); p.quadraticCurveTo(120, -250, 96, -290); p.lineTo(-96, -290); p.quadraticCurveTo(-120, -250, -196, -246); p.closePath(); });
  leather(g, r1, BLACK, { cut: (c) => { for (let x = -150; x <= 150; x += 14) cutLine(c, [[x, -232], [x * 0.66, -284]], 1.8); } });
  // 平座栏杆
  const rail = P((p) => p.rect(-110, -322, 220, 32));
  leather(g, rail, GRN, { cut: (c) => { for (let x = -104; x < 100; x += 24) cutMeander(c, x, -316, 18, 2.4); } });
  // 二层
  const w2 = P((p) => p.rect(-86, -460, 172, 138));
  leather(g, w2, RED, { cut: (c) => { for (const x of [-70, 14]) for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.fillRect(x + i * 14, -440 + j * 26, 10, 20); } });
  // 顶层屋顶
  const r2 = P((p) => { p.moveTo(-170, -470); p.quadraticCurveTo(-140, -452, -110, -452); p.lineTo(110, -452); p.quadraticCurveTo(140, -452, 170, -470); p.quadraticCurveTo(60, -480, 12, -560); p.lineTo(-12, -560); p.quadraticCurveTo(-60, -480, -170, -470); p.closePath(); });
  leather(g, r2, BLACK, { cut: (c) => { for (let x = -130; x <= 130; x += 14) cutLine(c, [[x, -458], [x * 0.35, -540]], 1.8); } });
  const fin = P((p) => { p.moveTo(-10, -560); p.quadraticCurveTo(-16, -580, 0, -590); p.quadraticCurveTo(16, -580, 10, -560); p.closePath(); });
  leather(g, fin, YEL, { rim: 0, line: 1.6 });
  // 檐角挂的小铃（黄）
  for (const s of [-1, 1]) { const b = blobs([[s * 192, -236, 7]]); leather(g, b, YEL, { rim: 0, line: 1.4 }); }
}
/** 拱桥（桥身 + 红色栏杆）。 */
function bridge(g) {
  const q = (t, a, c) => (1 - t) * (1 - t) * a + 2 * t * (1 - t) * c + t * t * a; // 对称二次曲线（两端同高）
  const deck = (t) => [lerp(-290, 290, t), q(t, 0, -210)];
  const inner = (t) => [lerp(-236, 236, t), q(t, 0, -150)];
  const arch = P((p) => {
    for (let i = 0; i <= 40; i++) { const [x, y] = deck(i / 40); i ? p.lineTo(x, y) : p.moveTo(x, y); }
    for (let i = 40; i >= 0; i--) { const [x, y] = inner(i / 40); p.lineTo(x, y); }
    p.closePath();
  });
  leather(g, arch, HIDE, { cut: (c) => { for (let i = 1; i < 20; i++) { const [x1, y1] = deck(i / 20), [x2, y2] = inner(i / 20); cutLine(c, [[lerp(x1, x2, 0.25), lerp(y1, y2, 0.25)], [lerp(x1, x2, 0.75), lerp(y1, y2, 0.75)]], 2); } } });
  const rail = P((p) => {
    for (let i = 0; i <= 40; i++) { const [x, y] = deck(0.06 + i / 40 * 0.88); i ? p.lineTo(x, y - 40) : p.moveTo(x, y - 40); }
    for (let i = 40; i >= 0; i--) { const [x, y] = deck(0.06 + i / 40 * 0.88); p.lineTo(x, y); }
    p.closePath();
  });
  leather(g, rail, RED, { cut: (c) => {
    for (let i = 0; i < 12; i++) { const t0 = 0.08 + (i / 12) * 0.84, t1 = t0 + 0.84 / 12 - 0.015; const [a, ay] = deck(t0 + 0.01), [b2, by] = deck(t1);
      c.beginPath(); c.moveTo(a + 4, ay - 30); c.lineTo(b2 - 2, by - 30); c.lineTo(b2 - 2, by - 8); c.lineTo(a + 4, ay - 8); c.closePath(); c.fill(); }
  } });
  for (let i = 0; i <= 12; i++) { const [x, y] = deck(0.07 + (i / 12) * 0.84); const post = P((p) => { p.rect(x - 4, y - 50, 8, 48); p.moveTo(x + 6, y - 52); p.arc(x, y - 52, 6, 0, TAU); }); leather(g, post, YEL, { rim: 0, line: 1.4, tex: 0 }); }
}
/** 竹丛。 */
function bamboo(g, R) {
  for (let k = 0; k < 4; k++) {
    const x = -50 + k * 32 + R.range(-6, 6), h = R.range(330, 440), lean = R.range(-0.08, 0.08);
    const stalk = P((p) => { p.moveTo(x - 6, 0); p.lineTo(x - 5 + lean * h, -h); p.lineTo(x + 5 + lean * h, -h); p.lineTo(x + 6, 0); p.closePath(); });
    leather(g, stalk, k % 2 ? GRN : GRN_D, { rim: 1.5, line: 1.6, cut: (c) => { for (let y = -40; y > -h; y -= 46) cutLine(c, [[x - 6 + lean * -y, y], [x + 6 + lean * -y, y]], 2); } });
  }
  for (let i = 0; i < 9; i++) {
    const cx = R.range(-110, 110), cy = R.range(-420, -170), a0 = R.range(-0.4, 0.4);
    const leaves = P((p) => { for (let k = 0; k < 4; k++) { const a = a0 + (k - 1.5) * 0.45 + Math.PI * 0.12; const L = R.range(48, 66);
      const ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.5 + L * 0.35, nx = -Math.sin(a) * 7, ny = Math.cos(a) * 7;
      p.moveTo(cx, cy); p.quadraticCurveTo((cx + ex) / 2 + nx, (cy + ey) / 2 + ny, ex, ey); p.quadraticCurveTo((cx + ex) / 2 - nx, (cy + ey) / 2 - ny, cx, cy); } });
    leather(g, leaves, i % 3 ? GRN : '#6f9a3c', { rim: 0, line: 1.4, tex: 0 });
  }
}
/** 牡丹（地上的一小丛）。 */
function peony(g, R) {
  const lv = P((p) => { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.45, L = R.range(40, 60), x = Math.cos(a) * L, y = -10 + Math.sin(a) * L;
    p.moveTo(0, -6); p.quadraticCurveTo(x * 0.4 - 12, y * 0.6, x, y); p.quadraticCurveTo(x * 0.6 + 12, y * 0.4, 0, -6); } });
  leather(g, lv, GRN, { line: 1.6, rim: 0, cut: (c) => { for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + (k - 2.5) * 0.45; cutLine(c, [[0, -8], [Math.cos(a) * 34, -10 + Math.sin(a) * 34]], 1.6); } } });
  for (const [fx, fy, fr, col] of [[-22, -66, 22, RED], [24, -78, 18, YEL]]) {
    const fl = blobs([[fx, fy, fr], ...Array.from({ length: 6 }, (_, i) => [fx + Math.cos(i) * fr * 0.85, fy + Math.sin(i) * fr * 0.85, fr * 0.5])]);
    leather(g, fl, col, { line: 1.6, union: true, cut: (c) => { cutPetals(c, fx, fy, fr * 0.62, 7, fr * 0.22, fr * 0.08); cutDot(c, fx, fy, fr * 0.16); } });
  }
}
/** 如意云头。 */
function cloud(g, col, s = 1) {
  const c0 = blobs([[0, 0, 34 * s], [-42 * s, 8 * s, 26 * s], [42 * s, 8 * s, 26 * s], [-76 * s, 18 * s, 15 * s], [76 * s, 18 * s, 15 * s]]);
  leather(g, c0, col, { union: true, cut: (c) => {
    cutSpiral(c, 0, 0, 24 * s, 1.4, 3); cutSpiral(c, -42 * s, 8 * s, 17 * s, 1.3, 2.6, -1); cutSpiral(c, 42 * s, 8 * s, 17 * s, 1.3, 2.6);
    cutLine(c, [[-80 * s, 30 * s], [80 * s, 30 * s]], 2);
  } });
}

/** 布景皮件长条（定格时他左右各约 330 单位内不放高的皮件）。gc = 第 9 拍时的镜头位置。 */
function nearLayer(gc) {
  return strip(`s11-near|${Math.round(gc)}`, P_NEAR, (ctx, x0, x1) => {
    const at = (sx) => sx + gc; // 定格时的画面 x → 层内 x
    const R = rng('s11-near');
    // 高处的如意云头
    for (const [sx, y, col, s] of [[-1500, 170, YEL, 1], [-930, 130, RED, 0.85], [-420, 200, YEL, 1.1], [110, 120, RED, 0.8], [760, 150, YEL, 1], [1450, 190, RED, 0.9], [2050, 140, YEL, 1.05], [2700, 175, RED, 0.9]]) {
      pieceOn(ctx, at(sx), y, [-110 * s, -50 * s, 110 * s, 50 * s], (g) => cloud(g, col, s), 0.9);
    }
    // 远一点的（定格前已经走过的）布景
    pieceOn(ctx, at(-1880), ROAD_Y, [-110, -140, 110, 6], (g) => rock(g, rng('s11-rock', 0), 190, 130, HIDE));
    pieceOn(ctx, at(-1560), ROAD_Y, [-210, -600, 210, 6], (g) => tower(g));
    pieceOn(ctx, at(-1230), ROAD_Y, [-90, -140, 90, 6], (g) => peony(g, rng('s11-peony', 0)));
    pieceOn(ctx, at(-860), ROAD_Y, [-300, -280, 300, 6], (g) => bridge(g));
    pieceOn(ctx, at(-470), ROAD_Y, [-130, -470, 130, 6], (g) => bamboo(g, rng('s11-bamboo', 0)));
    pieceOn(ctx, at(-170), ROAD_Y, [-270, -500, 200, 6], (g) => willow(g, rng('s11-willow', 0)));
    pieceOn(ctx, at(-300), ROAD_Y, [-80, -100, 80, 6], (g) => rock(g, rng('s11-rock', 1), 130, 80, YEL));
    // 定格时他右边：小牡丹、亭子（书生站在亭前）
    pieceOn(ctx, at(640), ROAD_Y, [-90, -140, 90, 6], (g) => peony(g, rng('s11-peony', 1)));
    pieceOn(ctx, at(1200), ROAD_Y, [-270, -490, 270, 6], (g) => pavilion(g));
    // 之后走过的
    pieceOn(ctx, at(1590), ROAD_Y, [-120, -180, 120, 6], (g) => rock(g, rng('s11-rock', 2), 200, 160, HIDE));
    pieceOn(ctx, at(1830), ROAD_Y, [-130, -470, 130, 6], (g) => bamboo(g, rng('s11-bamboo', 1)));
    pieceOn(ctx, at(2250), ROAD_Y, [-270, -500, 200, 6], (g) => willow(g, rng('s11-willow', 1)));
    pieceOn(ctx, at(2620), ROAD_Y, [-210, -600, 210, 6], (g) => tower(g));
    R();
    drawGround(ctx, x0, x1);
  }, { y0: 60, y1: 910 });
}

// ======================================================================
// 原创角色：挥扇书生（朝左；局部坐标原点在脚下）
// ======================================================================
const SCH_BODY = [-96, -350, 96, 6], SCH_HEAD = [-50, -446, 92, -326], SCH_ARM = [-40, -24, 40, 132];
const SCH_SHOULDER = [-18, -314], SCH_NECK = [-2, -338];
function scholarBody(g) {
  // 后面那只袖子（垂着）
  const back = P((p) => { p.moveTo(16, -320); p.quadraticCurveTo(52, -270, 58, -190); p.lineTo(78, -176); p.lineTo(30, -170); p.quadraticCurveTo(26, -250, 6, -300); p.closePath(); });
  leather(g, back, GRN_D, { cut: (c) => cutSpiral(c, 40, -220, 12, 1.3, 2.4) });
  // 长衫
  const robe = P((p) => {
    p.moveTo(-8, -336); p.quadraticCurveTo(-30, -332, -38, -316); p.lineTo(-44, -250);
    p.bezierCurveTo(-46, -160, -54, -80, -72, -22); p.lineTo(-76, -14); p.lineTo(66, -14);
    p.bezierCurveTo(54, -90, 44, -180, 40, -262); p.bezierCurveTo(40, -300, 32, -324, 12, -336); p.closePath();
  });
  leather(g, robe, TEAL, { cut: (c) => {
    cutSpiral(c, -6, -282, 13, 1.4, 2.6); cutSpiral(c, 14, -150, 15, 1.4, 2.6, -1); cutSpiral(c, -30, -92, 13, 1.4, 2.6);
    cutLine(c, [[-20, -196], [-28, -40]], 2); cutLine(c, [[18, -190], [30, -40]], 2);
    cutGrid(-40, -180, 40, -120, 16, (x, y) => cutDot(c, x, y, 1.6));
  } });
  // 交领
  const collar = P((p) => { p.moveTo(-10, -336); p.lineTo(4, -336); p.lineTo(-22, -258); p.lineTo(-34, -262); p.closePath(); });
  leather(g, collar, YEL_L, { rim: 0, line: 1.6 });
  // 腰带 + 垂下的绦带
  const belt = P((p) => { p.moveTo(-46, -232); p.lineTo(44, -232); p.lineTo(44, -216); p.lineTo(-48, -216); p.closePath(); p.moveTo(-14, -218); p.lineTo(-4, -218); p.lineTo(-8, -120); p.lineTo(-18, -120); p.closePath(); });
  leather(g, belt, RED, { rim: 0, line: 1.8, cut: (c) => { for (let x = -40; x < 40; x += 12) cutDiamond(c, x, -224, 3); } });
  const tassel = blobs([[-13, -112, 7]]); leather(g, tassel, YEL, { rim: 0, line: 1.4 });
  // 下摆的黄边
  const hem = P((p) => { p.moveTo(-70, -40); p.lineTo(58, -40); p.lineTo(66, -14); p.lineTo(-76, -14); p.closePath(); });
  leather(g, hem, YEL, { rim: 0, line: 1.8, cut: (c) => { for (let x = -64; x < 60; x += 16) cutCoin(c, x, -27, 5.5); } });
  // 鞋
  const shoes = P((p) => { p.moveTo(-80, -2); p.quadraticCurveTo(-86, -14, -70, -14); p.lineTo(-40, -14); p.lineTo(-40, 0); p.closePath(); p.moveTo(14, -14); p.lineTo(46, -14); p.lineTo(52, 0); p.lineTo(14, 0); p.closePath(); });
  leather(g, shoes, BLACK, { rim: 0, line: 1.6 });
  rivet(g, -6, -224, 4.2);
}
function scholarHead(g) {
  // 飘带（方巾后面两条）
  for (const [dy, len] of [[0, 1], [10, 0.86]]) {
    const rb = P((p) => { p.moveTo(18, -414 + dy); p.bezierCurveTo(40, -404 + dy, 46, -380 + dy, 58 * len + 8, -350 + dy * 2); p.lineTo(70 * len + 8, -342 + dy * 2); p.bezierCurveTo(56, -378 + dy, 46, -398 + dy, 20, -402 + dy); p.closePath(); });
    leather(g, rb, BLACK, { rim: 0, line: 1.4, cut: (c) => { cutDot(c, 40, -392 + dy, 1.8); cutDot(c, 52, -372 + dy, 1.8); } });
  }
  // 脸（侧面朝左）：空脸，只留一圈皮和五官刻线
  const face = P((p) => {
    p.moveTo(6, -338); p.lineTo(-12, -338); p.bezierCurveTo(-16, -344, -22, -346, -26, -350);
    p.quadraticCurveTo(-31, -352, -29, -357); p.lineTo(-32, -361); p.lineTo(-29, -365); p.lineTo(-33, -369); p.lineTo(-41, -375);
    p.lineTo(-32, -382); p.quadraticCurveTo(-30, -389, -32, -394); p.quadraticCurveTo(-28, -406, -12, -410);
    p.bezierCurveTo(10, -412, 24, -394, 20, -362); p.lineTo(10, -346); p.closePath();
  });
  g.save();
  g.fillStyle = HIDE_L; g.fill(face);
  g.save(); g.clip(face); g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.ellipse(-10, -376, 17, 25, 0.1, 0, TAU); g.fill(); g.restore();
  g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(face);
  // 五官：长眉、细长的眼、鼻梁、嘴（皮影空脸的刻线）
  g.lineCap = 'round'; g.strokeStyle = OUT;
  g.lineWidth = 3; g.beginPath(); g.moveTo(-32, -389); g.quadraticCurveTo(-20, -394, -6, -390); g.stroke();
  g.lineWidth = 2.2; g.beginPath(); g.moveTo(-30, -381); g.quadraticCurveTo(-22, -385, -12, -381); g.quadraticCurveTo(-20, -378, -30, -381); g.stroke();
  g.fillStyle = OUT; circle(g, -22, -381.5, 1.8); g.fill();
  g.lineWidth = 1.8; g.beginPath(); g.moveTo(-29, -362); g.lineTo(-24, -362); g.stroke();
  g.beginPath(); g.moveTo(4, -376); g.quadraticCurveTo(12, -372, 6, -362); g.stroke(); // 耳
  g.restore();
  // 方巾
  const cap = P((p) => { p.moveTo(-30, -398); p.lineTo(-26, -428); p.quadraticCurveTo(0, -440, 22, -426); p.lineTo(26, -380); p.quadraticCurveTo(12, -392, -8, -400); p.closePath(); });
  leather(g, cap, BLACK, { cut: (c) => { cutLine(c, [[-24, -414], [20, -414]], 1.8); cutDiamond(c, -2, -424, 3.5); } });
}
function scholarArm(g) {
  // 原点在肩（铆钉），向下垂；宽袖 + 黄袖口 + 手
  const hand = P((p) => { p.moveTo(-7, 104); p.quadraticCurveTo(-10, 122, 0, 126); p.quadraticCurveTo(10, 122, 8, 104); p.closePath(); });
  leather(g, hand, HIDE_L, { rim: 0, line: 1.6, tex: 0 });
  const sleeve = P((p) => { p.moveTo(-15, -10); p.quadraticCurveTo(-26, 50, -32, 96); p.lineTo(30, 104); p.quadraticCurveTo(22, 46, 15, -10); p.quadraticCurveTo(0, -20, -15, -10); p.closePath(); });
  leather(g, sleeve, TEAL, { cut: (c) => { cutSpiral(c, -2, 48, 11, 1.3, 2.4); cutLine(c, [[-6, 4], [-12, 80]], 1.8); } });
  const cuff = P((p) => { p.moveTo(-30, 86); p.lineTo(30, 92); p.lineTo(30, 104); p.lineTo(-32, 96); p.closePath(); });
  leather(g, cuff, YEL, { rim: 0, line: 1.6 });
  rivet(g, 0, 0, 4.6);
}
/** 折扇：在手上（局部坐标原点 = 手），span 张开角度，dir 扇面中线方向。 */
function fan(ctx, dir, span) {
  const r0 = 12, r1 = 78;
  ctx.save(); ctx.rotate(dir);
  const a0 = -span / 2 - Math.PI / 2, a1 = span / 2 - Math.PI / 2;
  if (span > 0.15) {
    const face = new Path2D(); face.arc(0, 0, r1, a0, a1); face.arc(0, 0, r0 + 18, a1, a0, true); face.closePath();
    ctx.globalAlpha *= 0.94;
    ctx.fillStyle = span > 0.3 ? YEL_L : RED; ctx.fill(face);
    // 外缘红边
    const band = new Path2D(); band.arc(0, 0, r1, a0, a1); band.arc(0, 0, r1 - 11, a1, a0, true); band.closePath();
    ctx.fillStyle = RED; ctx.fill(band);
    // 扇骨（亮的刻线）+ 一枝梅
    ctx.strokeStyle = rgba('#fff6dc', 0.9); ctx.lineWidth = 1.6;
    for (let i = 1; i < 11; i++) { const a = lerp(a0, a1, i / 11); ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r0 + 20), Math.sin(a) * (r0 + 20)); ctx.lineTo(Math.cos(a) * (r1 - 12), Math.sin(a) * (r1 - 12)); ctx.stroke(); }
    ctx.fillStyle = RED; for (const [u, v] of [[0.3, 0.6], [0.55, 0.72], [0.7, 0.5]]) { const a = lerp(a0, a1, u), rr = lerp(r0 + 20, r1 - 12, v); circle(ctx, Math.cos(a) * rr, Math.sin(a) * rr, 3.6); ctx.fill(); }
    ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke(face);
  }
  // 扇柄（两根大骨）
  ctx.strokeStyle = OUT; ctx.lineWidth = 3.4; ctx.lineCap = 'round';
  for (const a of [a0, a1]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); ctx.stroke(); }
  ctx.restore();
  rivet(ctx, 0, 0, 3.4);
}
/** 书生这一帧的姿态。b 量化，rb 未量化。 */
function scholarPose(b, rb) {
  const q = frameNo(b);
  const startled = rb >= GAG && rb < LEAVE;
  let lean = (hash2(q, 5, 1131) - 0.5) * 0.015, arm, span = 2.1, nod = (hash2(q, 6, 1131) - 0.5) * 0.04;
  if (rb < GAG) arm = 1.95 + 0.3 * Math.sin(TAU * b);               // 一拍摇一下
  else if (startled) { arm = 2.05 + 0.32 * Math.sin(TAU * 2 * b); lean += 0.12; nod -= 0.08; } // 吓得后仰，扇得飞快
  else { arm = 1.75; span = 0.2; }                                   // 第 13 拍「啪」地合上
  const hop = rb >= T_FLIP ? -6 * Math.abs(Math.sin(Math.PI * 2 * b)) : 0;
  return { lean, arm, span, nod, hop, flip: rb >= T_FLIP ? -1 : 1 };
}
function drawScholar(ctx, x, b, rb) {
  const S = scholarPose(b, rb);
  ctx.save();
  ctx.translate(x, ROAD_Y + S.hop);
  ctx.scale(S.flip, 1);
  // 挑杆（在皮件后面伸下去）：主杆挑在后颈，手杆挑在手腕
  const hx = SCH_SHOULDER[0] - Math.sin(S.arm) * 118, hy = SCH_SHOULDER[1] + Math.cos(S.arm) * 118;
  ctx.save(); ctx.rotate(S.lean);
  drawPart(ctx, 'sch-body', SCH_BODY, scholarBody);
  ctx.save(); ctx.translate(SCH_NECK[0], SCH_NECK[1]); ctx.rotate(S.nod); ctx.translate(-SCH_NECK[0], -SCH_NECK[1]);
  drawPart(ctx, 'sch-head', SCH_HEAD, scholarHead);
  ctx.restore();
  ctx.save(); ctx.translate(SCH_SHOULDER[0], SCH_SHOULDER[1]); ctx.rotate(S.arm);
  drawPart(ctx, 'sch-arm', SCH_ARM, scholarArm);
  ctx.translate(0, 118); fan(ctx, -0.9 - (S.arm - 1.95) * 0.6, S.span);
  ctx.restore();
  ctx.restore();
  // 挑杆画在最上面（杆影比皮件更深）；倾斜时跟着身体转
  const rot = (px, py) => [px * Math.cos(S.lean) - py * Math.sin(S.lean), px * Math.sin(S.lean) + py * Math.cos(S.lean)];
  const [nx, ny] = rot(SCH_NECK[0] + 8, SCH_NECK[1] + 16), [ax, ay] = rot(hx, hy);
  rodShadow(ctx, nx, ny, 120);
  rodShadow(ctx, ax, ay, 210, 3.4);
  ctx.restore();
}

// ======================================================================
// 原创角色：皮影马（朝左跑；局部坐标原点在脚下）
// ======================================================================
const HORSE_BODY = [-232, -392, 196, -140], HORSE_LEG = [-24, -12, 24, 196];
const LEGS = [[-80, -192, 'f'], [-62, -194, 'f'], [70, -196, 'h'], [88, -192, 'h']];
function horseBody(g) {
  // 尾巴
  const tail = P((p) => { p.moveTo(104, -236); p.bezierCurveTo(150, -250, 176, -214, 186, -150); p.lineTo(170, -150); p.bezierCurveTo(160, -196, 140, -214, 108, -214); p.closePath(); });
  leather(g, tail, BLACK, { rim: 0, line: 1.6, cut: (c) => { cutLine(c, [[130, -228], [166, -166]], 2); cutLine(c, [[122, -220], [150, -160]], 1.6); } });
  // 身、颈、头
  const body = P((p) => {
    p.moveTo(-96, -246); p.bezierCurveTo(-40, -270, 50, -266, 104, -246); p.bezierCurveTo(130, -230, 126, -186, 106, -172);
    p.bezierCurveTo(60, -158, -20, -160, -84, -170); p.bezierCurveTo(-112, -186, -112, -222, -96, -246); p.closePath();
    p.moveTo(-70, -240); p.lineTo(-120, -330); p.bezierCurveTo(-128, -350, -146, -360, -158, -354); p.lineTo(-210, -304);
    p.quadraticCurveTo(-218, -290, -204, -284); p.lineTo(-176, -288); p.lineTo(-136, -300); p.lineTo(-104, -196); p.closePath();
    p.moveTo(-140, -356); p.lineTo(-136, -384); p.lineTo(-124, -360); p.closePath(); // 耳
  });
  leather(g, body, YEL, { cut: (c) => {
    cutGrid(40, -240, 104, -184, 15, (x, y) => cutCoin(c, x, y, 5.5));
    cutLine(c, [[-110, -306], [-86, -236]], 2.2); cutLine(c, [[-98, -312], [-74, -244]], 1.6);
    c.beginPath(); c.ellipse(-162, -334, 7, 3.2, -0.5, 0, TAU); c.fill(); // 眼
    cutDot(c, -202, -298, 2.4); // 鼻孔
    cutLine(c, [[-90, -186], [60, -178]], 1.6);
  } });
  // 鬃毛
  const mane = P((p) => { p.moveTo(-150, -358); for (let i = 0; i <= 8; i++) { const t = i / 8, x = lerp(-140, -66, t), y = lerp(-362, -252, t); p.lineTo(x + 14 + (i % 2) * 8, y - 6 + (i % 2) * 6); } p.lineTo(-62, -244); p.lineTo(-120, -332); p.closePath(); });
  leather(g, mane, BLACK, { rim: 0, line: 1.4 });
  // 鞍鞯（红，铜钱纹 + 黄边流苏）+ 黑鞍座
  const cloth = P((p) => { p.moveTo(-52, -258); p.lineTo(46, -256); p.lineTo(42, -196); p.quadraticCurveTo(-4, -186, -50, -196); p.closePath(); });
  leather(g, cloth, RED, { cut: (c) => { cutGrid(-40, -244, 36, -206, 16, (x, y) => cutCoin(c, x, y, 5)); } });
  const trim = P((p) => { p.moveTo(-50, -200); p.quadraticCurveTo(-4, -190, 42, -200); p.lineTo(42, -190); p.quadraticCurveTo(-4, -180, -50, -190); p.closePath(); for (let x = -46; x < 42; x += 12) { p.moveTo(x, -188); p.lineTo(x + 3, -176); p.lineTo(x + 6, -188); } });
  leather(g, trim, YEL, { rim: 0, line: 1.2, tex: 0 });
  const seat = P((p) => { p.moveTo(-40, -258); p.quadraticCurveTo(-30, -280, -14, -270); p.quadraticCurveTo(4, -262, 20, -270); p.quadraticCurveTo(34, -278, 38, -256); p.closePath(); });
  leather(g, seat, BLACK, { rim: 0, line: 1.4 });
  // 笼头、胸前红缨
  g.strokeStyle = RED_D; g.lineWidth = 3.2; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-142, -346); g.lineTo(-152, -306); g.moveTo(-184, -310); g.lineTo(-196, -292); g.stroke();
  const tas = blobs([[-104, -214, 10], [-110, -200, 7]]); leather(g, tas, RED, { rim: 0, line: 1.4, cut: (c) => cutDot(c, -104, -214, 3) });
}
function horseLeg(g, kind) {
  const hind = kind === 'h';
  const leg = P((p) => {
    p.moveTo(-14, 0); p.quadraticCurveTo(hind ? -24 : -18, 50, -9, 110); p.lineTo(-8, 162); p.lineTo(9, 162); p.lineTo(8, 112); p.quadraticCurveTo(hind ? 24 : 18, 50, 14, 0); p.quadraticCurveTo(0, -10, -14, 0); p.closePath();
  });
  leather(g, leg, YEL, { line: 2, rim: 2, cut: (c) => { cutLine(c, [[0, 20], [-2, 90]], 1.8); } });
  const hoof = P((p) => { p.moveTo(-11, 160); p.lineTo(11, 160); p.lineTo(14, 182); p.lineTo(-12, 182); p.closePath(); });
  leather(g, hoof, BLACK, { rim: 0, line: 1.4, tex: 0 });
  rivet(g, 0, 0, 4.4);
}
function drawHorse(ctx, x, b) {
  const t = (b - T_HORSE[0]) * 2.2; // 每拍跑两步多
  const bob = -9 * Math.abs(Math.sin(Math.PI * t));
  ctx.save();
  ctx.translate(x, ROAD_Y - 6 + bob);
  ctx.rotate(Math.sin(TAU * t) * 0.03);
  const ang = (k) => {
    const [, , kind] = LEGS[k];
    return kind === 'f' ? 0.55 * Math.sin(TAU * t + k * 0.6) : -0.5 * Math.sin(TAU * t + 0.4 + k * 0.6);
  };
  const leg = (k, a) => {
    const [lx, ly, kind] = LEGS[k];
    ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang(k)); drawPart(ctx, `horse-leg-${kind}`, HORSE_LEG, (g) => horseLeg(g, kind), a); ctx.restore();
  };
  leg(1, 0.75); leg(3, 0.75);
  drawPart(ctx, 'horse-body', HORSE_BODY, horseBody);
  leg(0, 0.94); leg(2, 0.94);
  rodShadow(ctx, -96, -282, 140);
  rodShadow(ctx, 92, -224, 200);
  ctx.restore();
}

// ======================================================================
// 人物：皮影画风 + 挑杆 + 一分为三
// ======================================================================
/** 他的皮影：按部位染色（黑发、红衣、青绿裤、黑鞋、浅黄空脸），镂空雕花，刻线，黄铜铆钉，深褐粗轮廓。 */
function puppetize(I) {
  const w = I.w, h = I.h, n = w * h;
  let top = h, bot = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (I.a[y * w + x] > 0.5) { if (y < top) top = y; if (y > bot) bot = y; }
  const PH = Math.max(1, bot - top);
  const S = smoothColor(I, 1.6);
  const L = lumaArray(S, 0.55);
  const E = sobel(L, w, h);
  const F = sobel(lumaArray(smoothColor(I, 0.6), 0.55), w, h);
  const In = blur(I.a, w, h, 5, 2);
  const O = { w, h, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
  const C = { hair: rgbf(BLACK), red: rgbf(RED), redD: rgbf(RED_D), grn: rgbf(TEAL), grnD: rgbf(GRN_D), yel: rgbf(YEL_L), skin: rgbf(HIDE_L), ink: rgbf(OUT) };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (I.a[i] < 0.02) continue;
    const fy = (y - top) / PH;
    const skin = S.r[i] > 0.36 && S.r[i] > S.g[i] && S.g[i] > S.b[i] && S.r[i] - S.b[i] > 0.1;
    const l = L[i];
    let c, a = 0.97, region = 'hair';
    if (skin) { c = C.skin; a = 0.78; region = 'skin'; }
    else if (fy < 0.115) c = C.hair;
    else if (fy < 0.53) { region = 'shirt'; c = l > 0.62 ? C.yel : mixc(C.redD, C.red, sstep(0.05, 0.4, l)); }
    else if (fy < 0.905) { region = 'pants'; c = mixc(C.grnD, C.grn, sstep(0.05, 0.4, l)); }
    else { region = 'shoe'; c = C.hair; }
    const m = 1 + (noise2(x * 0.09, y * 0.09, 1141) - 0.5) * 0.16;
    c = [c[0] * m, c[1] * m, c[2] * m];
    // 镂空雕花：离轮廓有一段距离的地方才刻
    let hole = false;
    if (In[i] > 0.985) {
      if (region === 'shirt' && fy > 0.17 && fy < 0.5) {
        const sp = 15, u = ((x % sp) + sp) % sp - sp / 2, v = (((y + (Math.floor(x / sp) % 2) * 7) % sp) + sp) % sp - sp / 2, d = Math.hypot(u, v);
        hole = (d > 3.6 && d < 5.4) || (Math.abs(u) < 1.2 && Math.abs(v) < 1.2);
      } else if (region === 'pants' && fy < 0.88) {
        const sp = 12, row = Math.floor(y / sp), u = (((x + (row % 2) * 6) % sp) + sp) % sp - sp / 2, v = ((y % sp) + sp) % sp - sp / 2;
        hole = Math.abs(u) + Math.abs(v) < 2.8;
      } else if (region === 'hair' && fy > 0.025) {
        hole = (((x * 0.55 + y) % 8) + 8) % 8 < 1.1;
      }
    }
    // 刻线：外形 / 衣褶边缘；皮肤处用更细的边保住五官
    const e = skin ? sstep(0.28, 0.58, F[i]) : sstep(0.6, 1.05, E[i]);
    if (e > 0.25) { hole = false; a = Math.max(a, 0.96); }
    c = mixc(c, C.ink, Math.min(1, e));
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
    O.a[i] = hole ? 0 : Math.min(a, I.a[i] < 0.9 ? 1 : a);
  }
  // 铆钉：肩、腰、膝（每行取最宽的两段身体的中点）
  for (const fy of [0.215, 0.5, 0.735]) {
    const y = Math.round(top + fy * PH);
    const runs = [];
    let s0 = -1;
    for (let x = 0; x <= w; x++) {
      const on = x < w && I.a[y * w + x] > 0.5;
      if (on && s0 < 0) s0 = x;
      if (!on && s0 >= 0) { if (x - s0 >= 18) runs.push([s0, x]); s0 = -1; }
    }
    runs.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]));
    for (const [r0, r1] of runs.slice(0, fy > 0.6 ? 2 : 1)) stampRivet(O, Math.round((r0 + r1) / 2), y, 5.5);
  }
  outline(O, I.a, 3.4, C.ink);
  return O;
}
function stampRivet(O, cx, cy, r) {
  const brass = rgbf(BRASS), ink = rgbf(OUT), hi = rgbf('#fbe6a8');
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
    if (x < 0 || y < 0 || x >= O.w || y >= O.h) continue;
    const d = Math.hypot(x - cx, y - cy), i = y * O.w + x;
    if (d > r) continue;
    const c = d > r - 1.6 ? ink : Math.hypot(x - cx + r * 0.3, y - cy + r * 0.3) < r * 0.3 ? hi : brass;
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2]; O.a[i] = 1;
  }
}
registerStyle('s11-puppet', (I) => puppetize(I));
/** 灯影重影：同一帧剪影整体偏色（朱红 / 青），轮廓也被染淡。 */
const ghostStyle = (tint, k) => (I) => {
  const O = puppetize(I), T = rgbf(tint);
  for (let i = 0; i < O.w * O.h; i++) {
    if (O.a[i] < 0.01) continue;
    // 深色轮廓只染一点（重影仍认得出、和幕布拉得开），皮件本身染得多
    const l = 0.299 * O.r[i] + 0.587 * O.g[i] + 0.114 * O.b[i], kk = k * (l < 0.12 ? 0.35 : 1);
    O.r[i] += (T[0] - O.r[i]) * kk; O.g[i] += (T[1] - O.g[i]) * kk; O.b[i] += (T[2] - O.b[i]) * kk;
  }
  return O;
};
registerStyle('s11-ghost-r', ghostStyle('#e04a2a', 0.55));
registerStyle('s11-ghost-c', ghostStyle('#1f9a92', 0.55));

/** 三个影子的位置（单位）。b 量化，rb 未量化；只在第 9–12 拍。 */
function ghosts(b, rb) {
  if (rb < GAG || rb >= LEAVE) return null;
  const x = b - GAG;
  const pop = keyframes([[-0.3, 0.55], [0.02, 0.6], [0.12, 1.14], [0.3, 1]], x); // 第 9 拍一帧弹开，带一点过冲
  const sw = swing(b, rb);
  return { spread: 150 * pop * (0.9 + 0.1 * Math.abs(sw)), drift: -sw * 46 * pop, tilt: -sw * 0.045 * pop };
}
/** 画他的一份皮影：剪影 + 挑杆（主杆挑在后颈，定格时多一根手杆）。 */
function manPuppet(ctx, fig, style) {
  drawWalker(ctx, { ...fig, style, rim: null });
  const stand = fig.pose === 'stand', A = stand ? ANCHORS.stand : ANCHORS.walk;
  ctx.save();
  if (fig.lean) ctx.rotate(fig.lean);
  rodShadow(ctx, A.shoulder[0] - 6, A.shoulder[1] + 18, 170);
  if (stand) rodShadow(ctx, A.handR[0] - 4, A.handR[1] + 6, 230, 3.4);
  ctx.restore();
}

// ======================================================================
// 场景
// ======================================================================
export const s11 = {
  id: 's11',
  station: ST,
  quantize: 10,
  figureStyle: 's11-puppet',
  freezeBeat: GAG + 1.5, // Outro 展墙：三个影子散开
  figureAdjust(b, env) {
    const rb = rawB(env);
    // 定格 / 恢复走路按未量化的拍位切换，正好落在第 9、13 拍强拍上
    if (rb >= GAG && rb < LEAVE) return { pose: 'stand' };
    if (rb >= LEAVE && b < LEAVE) return { pose: 'walk' };
    return null;
  },
  drawFigure(ctx, fig, b, env) {
    const G = ghosts(b, rawB(env));
    if (!G) { manPuppet(ctx, fig, 's11-puppet'); return; }
    for (const [dx, style, rot] of [[-G.spread + G.drift * 1.3, 's11-ghost-r', G.tilt], [G.spread + G.drift * 0.7, 's11-ghost-c', -G.tilt * 0.8]]) {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.globalAlpha *= 0.72;
      ctx.translate(dx, 0); ctx.rotate(rot);
      manPuppet(ctx, fig, style);
      ctx.restore();
    }
    ctx.save(); ctx.translate(G.drift * 0.3, 0); manPuppet(ctx, fig, 's11-puppet'); ctx.restore();
  },
  drawBack(ctx, b, env) {
    const rb = rawB(env), cam = env.cam, gc = env.camAt(GAG);
    const L = lampAt(b, rb);
    ctx.drawImage(screenImg(), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawLampGlow(ctx, L);
    drawStrip(ctx, far1Layer(), cam - shadowShift(L, 0.3) / P_FAR1);
    drawStrip(ctx, far2Layer(), cam - shadowShift(L, 0.12) / P_FAR2);
    drawStrip(ctx, nearLayer(gc), cam - shadowShift(L, 0.015));
    // 皮影马：第 5–8 拍从右往左跑过（按量化拍位一顿一顿地挪）
    if (b >= T_HORSE[0] && b <= T_HORSE[1]) {
      const x = lerp(X_MAX + 240, X_MIN - 260, (b - T_HORSE[0]) / (T_HORSE[1] - T_HORSE[0]));
      drawHorse(ctx, x, b);
    }
    // 书生：定格时站在画面右侧的亭子前
    // 第 14 拍翻面后，他跟着往右走（和镜头同速，一顿一顿地挪），不和人物叠在一起
    const sx = (rb < T_FLIP ? SCH_SX + gc - cam : SCH_SX + gc - env.camAt(T_FLIP) + (b - T_FLIP) * 26) + shadowShift(L, 0.015);
    if (sx > X_MIN - 200 && sx < X_MAX + 200) drawScholar(ctx, sx, b, rb);
  },
  drawFront(ctx, b, env) {
    const L = lampAt(b, rawB(env));
    drawLight(ctx, L);
    ctx.drawImage(stageImg(), X_MIN, 0, X_MAX - X_MIN, 1000);
  },
  drawFrame(ctx, R) { stageFrame(ctx, R); },
  cardStyle: {
    ink: OUT, accent: RED, bar: false,
    bgDraw(ctx, x, y, w, h) {
      const { canvas, pad } = leatherPlate('card', w, h, { lobes: true, border: true });
      ctx.drawImage(canvas, x - pad, y - pad);
    },
  },
  playerStyle: {
    ink: OUT, noteColor: RED, backdrop: false,
    plateDraw(ctx, x, y, w, h) {
      const { canvas, pad } = leatherPlate('plate', w, h, { lobes: false, border: false });
      ctx.drawImage(canvas, x - pad, y - pad);
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) { puppetCD(ctx, cx, cy, s, spin); },
  },
};

// ======================================================================
// 标题卡、歌名底板、CD、离场画框（像素坐标）
// ======================================================================
/** 一片浅黄牛皮：四角如意云头、边上一圈镂空圆孔、黄铜铆钉（文字区不镂空）。 */
function leatherPlate(key, w, h, { lobes, border }) {
  const pad = 30;
  const canvas = memo(`s11-plate|${key}|${Math.round(w)}|${Math.round(h)}`, () => {
    const c = makeCanvas(w + pad * 2, h + pad * 2), g = c.getContext('2d');
    g.translate(pad, pad);
    const path = new Path2D();
    if (lobes) {
      path.rect(0, 0, w, h);
      for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) { path.moveTo(cx + 20, cy); path.arc(cx, cy, 20, 0, TAU); }
    } else {
      // 两端如意头的长条
      path.moveTo(16, 0); path.lineTo(w - 16, 0); path.quadraticCurveTo(w + 14, 0, w + 14, h / 2); path.quadraticCurveTo(w + 14, h, w - 16, h);
      path.lineTo(16, h); path.quadraticCurveTo(-14, h, -14, h / 2); path.quadraticCurveTo(-14, 0, 16, 0); path.closePath();
    }
    g.save(); g.shadowColor = 'rgba(60,25,8,0.35)'; g.shadowBlur = 14; g.shadowOffsetY = 4;
    g.lineWidth = 6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(path); g.restore();
    g.fillStyle = '#f3d9a0'; g.fill(path);
    g.save(); g.clip(path); g.globalAlpha = 0.35; g.fillStyle = g.createPattern(mottle(), 'repeat'); g.fill(path); g.restore();
    g.save(); g.clip(path); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round';
    if (border) {
      for (let x = 34; x < w - 26; x += 22) { cutDot(g, x, 12, 3.6); cutDot(g, x, h - 12, 3.6); }
      for (let y = 34; y < h - 26; y += 22) { cutDot(g, 12, y, 3.6); cutDot(g, w - 12, y, 3.6); }
      g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
    } else {
      for (let x = 22; x < w - 14; x += 20) { cutDot(g, x, 9, 2.8); cutDot(g, x, h - 9, 2.8); }
      for (const ex of [-2, w + 2]) cutSpiral(g, ex, h / 2, 9, 1.3, 2.4);
    }
    if (lobes) for (const [cx, cy] of [[0, 0], [w, 0], [0, h], [w, h]]) cutSpiral(g, cx + (cx ? 4 : -4), cy + (cy ? 4 : -4), 12, 1.3, 2.6, cx ? -1 : 1);
    g.restore();
    if (lobes) for (const [cx, cy] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) rivet(g, cx + (cx < w / 2 ? 14 : -14), cy + (cy < h / 2 ? 14 : -14), 5);
    return c;
  });
  return { canvas, pad };
}
/** CD：一片挑在竹竿上的圆形镂空皮件（朱红外圈镂空花瓣、黄色内圈铜钱纹、青色花心、黄铜铆钉），整片在转。 */
function cdImg(r) {
  return memo(`s11-cd|${Math.round(r)}`, () => {
    const S = Math.ceil(r * 2 + 8), c = makeCanvas(S, S), g = c.getContext('2d');
    g.translate(S / 2, S / 2);
    const ring = (r0, r1) => { const p = new Path2D(); p.arc(0, 0, r1, 0, TAU); p.moveTo(r0, 0); p.arc(0, 0, r0, 0, TAU, true); return p; };
    // 外圈（朱红，波浪边）
    const outer = new Path2D();
    for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, rr = r * (0.95 + 0.05 * Math.cos(a * 12)); i ? outer.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : outer.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    outer.closePath(); outer.moveTo(r * 0.64, 0); outer.arc(0, 0, r * 0.64, 0, TAU, true);
    const cut = (path, fn) => { g.save(); g.clip(path, 'evenodd'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000'; g.strokeStyle = '#000'; g.lineCap = 'round'; fn(g); g.restore(); };
    g.fillStyle = RED; g.fill(outer, 'evenodd');
    cut(outer, (c2) => { for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; cutLeaf(c2, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, r * 0.11, r * 0.04, a); cutDot(c2, Math.cos(a + TAU / 24) * r * 0.86, Math.sin(a + TAU / 24) * r * 0.86, r * 0.025); } });
    g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke(outer);
    // 中圈（黄，铜钱纹）
    const mid = ring(r * 0.34, r * 0.64);
    g.fillStyle = YEL; g.fill(mid, 'evenodd');
    cut(mid, (c2) => { for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; cutCoin(c2, Math.cos(a) * r * 0.49, Math.sin(a) * r * 0.49, r * 0.085); } });
    g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(mid);
    // 花心（青）
    const core = ring(r * 0.12, r * 0.34);
    g.fillStyle = TEAL; g.fill(core, 'evenodd');
    cut(core, (c2) => { for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; cutLine(c2, [[Math.cos(a) * r * 0.16, Math.sin(a) * r * 0.16], [Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3]], 2.2); } });
    g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(core);
    rivet(g, 0, 0, r * 0.12);
    return c;
  });
}
function puppetCD(ctx, cx, cy, s, spin) {
  const r = 82 * s;
  // 竹竿：从盘心斜着伸到画面下沿，带竹节
  ctx.save();
  const ex = cx + 34, ey = cy + 240, ang = Math.atan2(ey - cy, ex - cx), len = Math.hypot(ex - cx, ey - cy);
  ctx.translate(cx, cy); ctx.rotate(ang);
  const gr = ctx.createLinearGradient(0, -6, 0, 6);
  gr.addColorStop(0, '#e8c27a'); gr.addColorStop(0.5, '#b98f48'); gr.addColorStop(1, '#7a5a2a');
  ctx.fillStyle = gr; ctx.fillRect(0, -5.5, len, 11);
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.6; ctx.strokeRect(0, -5.5, len, 11);
  ctx.fillStyle = '#6a4a20';
  for (let d = 40; d < len; d += 64) ctx.fillRect(d, -6.5, 4, 13);
  ctx.restore();
  // 盘片
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(spin);
  const img = cdImg(r);
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  ctx.restore();
}
/** 离场画框：雕花漆木戏台框（深朱漆宽边、描金内线、回纹、四角云头）。 */
function stageFrame(ctx, R) {
  const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
  ctx.save();
  ctx.fillStyle = 'rgba(30,10,4,0.22)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 1.1, w * 0.55, t * 0.5, 0, 0, TAU); ctx.fill();
  const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
  const gr = ctx.createLinearGradient(x - t, y - t, x + w + t, y + h + t);
  gr.addColorStop(0, '#8a2a18'); gr.addColorStop(0.5, LACQ); gr.addColorStop(1, LACQ_D);
  ctx.fillStyle = gr; ctx.fill(band, 'evenodd');
  ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, 3 * s);
  ctx.strokeRect(x - t * 0.82, y - t * 0.82, w + t * 1.64, h + t * 1.64);
  ctx.strokeRect(x - 5 * s, y - 5 * s, w + 10 * s, h + 10 * s);
  // 回纹：沿四边一圈
  ctx.lineWidth = Math.max(1, 2 * s); ctx.strokeStyle = rgba(GOLD, 0.9);
  const m = t * 0.34, step = t * 0.62;
  const meander = (mx, my) => { ctx.beginPath(); ctx.moveTo(mx, my + m); ctx.lineTo(mx, my); ctx.lineTo(mx + m, my); ctx.lineTo(mx + m, my + m * 0.78); ctx.lineTo(mx + m * 0.24, my + m * 0.78); ctx.lineTo(mx + m * 0.24, my + m * 0.3); ctx.lineTo(mx + m * 0.7, my + m * 0.3); ctx.stroke(); };
  for (let mx = x - t * 0.6; mx < x + w + t * 0.4; mx += step) { meander(mx, y - t * 0.62); meander(mx, y + h + t * 0.28); }
  for (let my = y; my < y + h - m; my += step) { meander(x - t * 0.62, my); meander(x + w + t * 0.28, my); }
  // 四角云头
  for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) {
    ctx.fillStyle = LACQ_D; ctx.beginPath(); ctx.arc(cx, cy, t * 0.44, 0, TAU); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = Math.max(1, 2.4 * s); ctx.stroke();
    ctx.beginPath();
    for (let k = 0; k <= 30; k++) { const tt = k / 30, a = tt * 1.4 * TAU, rr = t * 0.32 * (1 - tt * 0.85); k ? ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(20,6,2,0.8)'; ctx.lineWidth = Math.max(1, 2 * s);
  ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
  ctx.restore();
}
