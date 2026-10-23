// 第 3 站 · 八度空间（The Eight Dimensions, 2002）·「爷爷泡的茶」· 泼墨山水 + 一点「家」的暖黄光
// 茶色是整站的主线：山泉、茶汤、年轮都是同一种暖琥珀茶色（ink.js 的 TEA），一路蔓延。
//
// 构图（从远到近，视差系数）：宣纸 + 暖茶色日晕（0.03）→ 淡花青远峰、两座泼墨主峰（0.08）
//   → 淡墨山峦、远处小山包上的一棵树和秋千（0.16）→ 雾带（0.3）→ 中景山坡：一道茶色山泉蜿蜒流下（0.45）
//   → 屋檐人家（0.5，第 2 小节起一直在画面里）：瓦檐、亮着暖黄灯的窗和门、书立上的字典、
//     樟木茶桌上的三卷线装书、竹椅上的爷爷、门口小男孩的墨色剪影、小风炉
//   → 近坡草石（0.8）→ 茶色溪水、山路、路下的岩层剖面、爷爷种的樟树（1）→ 前景草（1.3）。
//
// 节拍：
//   第 1 小节：穿过第 2 站的画框进山。镜头下切（场景自带竖向镜头位移，人物 figureAdjust 同步上移），
//     路面化成岩层剖面，溪里的茶色一层层渗进岩石；溪边冒出一棵樟树苗，快进长高（树根跟着茶色往下扎），
//     镜头在第 4 拍前回到路面。
//   第 2 小节：屋檐下下着小雨、檐口滴水；小男孩的剪影望着远处的秋千；爷爷坐着抽旱烟，桌上的线装书被风翻页；
//     书立上的字典哗哗翻到一页，朱笔把「遥远」两个字圈出来。他从屋前走过。
//   第 3 小节（他定格，镜头停住；三个特写之间都是落在拍上的硬切）：
//     第 9 拍强拍镜头推进樟木茶桌的横切面，第 9–10 拍茶色年轮一圈圈画出来，越来越密，正好 23 圈；
//     第 11 拍硬切：他站立帧的脸（同一张站立帧放大、裁到脸），茶色暖光 + 水墨晕边；
//     第 12 拍硬切：爷爷长着老茧的手，手指一倒，茶汤落进清水，一缕缕晕开。
//   第 4 小节：硬切回全景，他接着走。茶色从爷爷的杯子晕开、染进整张画；满头白发的爷爷端着茶杯，竖起手指放在嘴边；
//     远处原创的唐代茶人牵着一匹瘦马走进风沙；茶烟飘过他，化成山里的雾；最后 2 拍手卷裱框（茶色绫边）进来。
// 画面里除了字典上被圈出的「遥远」两个字，不写任何字（线装书的书签空白，门窗不写字）。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, memo } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { fbm, noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { font, SERIF } from '../kit/text.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawWalker, activeWalk } from '../rig/walker.js';
import { registerStyle, styledFrame, rgbf, smoothColor, lumaArray, sobel, blur, outline } from '../rig/styles.js';
import {
  INK, TEA, xuanPaper, bristleStroke, inkDot, mossDots, mountain, mistBand, grassTuft, rock, washShape, blobPath,
  sealStamp, paperCard, handscrollFrame, pomo, splatter, inkStream, ribbonPath,
} from '../kit/ink.js';

const ST = stationByN(3);
const PX = K; // 烘焙时每单位的像素数（blur 半径换算用）
const P_SKY = 0.03, P_FAR1 = 0.08, P_FAR2 = 0.16, P_MIST = 0.3, P_MID = 0.45, P_HOUSE = 0.5, P_NEAR = 0.8, P_FG = 1.3;
const PAPER = INK.paper;
const LAMP = '#f6d48c', LAMP_HI = '#fcebc0';   // 家的暖黄灯光
const SKIN = mix(INK.paper, INK.zheshi, 0.5), SKIN_D = mix(INK.zheshi, '#9a6a45', 0.45);

// ---------- 时间点（段内拍位） ----------
const T_DOWN = [0.5, 1.25];               // 镜头下切
const T_UP = [2.85, 3.7];                 // 镜头回到路面（第 4 拍前）
const DROP = 270;                         // 下切的竖向位移（单位）
const T_SEEP = [1.0, 2.95];               // 茶色一层层渗进岩层
const T_GROW = [1.25, 4.15];                // 樟树苗快进长高
const T_RAIN = [GAG - 4.4, GAG - 3.7];    // 第 2 小节：小雨、檐口滴水（淡入；第 3 小节起停）
const T_FLIP = [GAG - 3.7, GAG - 2.45];   // 字典被风哗哗翻页（第 4.3–5.55 拍）
const T_CIRCLE = [GAG - 2.25, GAG - 1.55];// 朱笔圈出「遥远」（第 5.75–6.45 拍）
const T_PUSH = [GAG, GAG + 0.34];         // 第 9 拍强拍：推进茶桌横切面
const T_RINGS = [GAG + 0.3, GAG + 1.9];   // 年轮一圈圈画出来（23 圈）
const T_FACE = GAG + 2;                   // 第 11 拍：硬切到脸
const T_HAND = GAG + 3;                   // 第 12 拍：硬切到手
const T_TIP = [GAG + 3.02, GAG + 3.24];   // 手指一倒
const T_POUR = [GAG + 3.12, GAG + 3.66];  // 茶汤落进水里
const T_WIDE = GAG + 4;                   // 第 13 拍：硬切回全景
const T_HUSH = [GAG + 4.1, GAG + 4.45];   // 爷爷竖起手指
const T_TINT = [GAG + 4.05, GAG + 5.5];   // 茶色晕进整张画
const T_FOG = [GAG + 4.5, GAG + 6.6];     // 茶烟化成山里的雾
const RINGS = 23;

const R0 = (k) => rng('s03v2', k);
const poly = (pts, close = true) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); return p; };
const fillP = (ctx, p, c) => { ctx.fillStyle = c; ctx.fill(p); };

/** 镜头下切的程度 0..1（第 1 小节）。 */
function tiltAt(b) {
  if (b <= T_DOWN[0] || b >= T_UP[1]) return 0;
  return ease.inOut(clamp((b - T_DOWN[0]) / (T_DOWN[1] - T_DOWN[0]))) * (1 - ease.inOut(clamp((b - T_UP[0]) / (T_UP[1] - T_UP[0]))));
}
/** 路面 → 岩层剖面的交叉程度。 */
const cutAt = (b) => smoothstep(T_DOWN[0] + 0.15, T_DOWN[1] - 0.05, b) * (1 - smoothstep(T_UP[0] + 0.05, T_UP[1] - 0.1, b));
const houseOff = (env) => (env.camAt(GAG) - env.cam) * P_HOUSE;

// ======================================================================
// 远景
// ======================================================================
function skyLayer() {
  return strip('s03v2-sky', P_SKY, (ctx) => {
    // 一枚暖茶色的日晕（右上）
    ctx.save();
    ctx.filter = `blur(${26 * PX}px)`;
    ctx.fillStyle = rgba(TEA.glow, 0.5);
    ctx.beginPath(); ctx.arc(1120, 150, 150, 0, TAU); ctx.fill();
    ctx.filter = `blur(${5 * PX}px)`;
    ctx.fillStyle = rgba(TEA.light, 0.5);
    ctx.beginPath(); ctx.arc(1120, 150, 58, 0, TAU); ctx.fill();
    ctx.restore();
  }, { y0: -60, y1: 420 });
}
function peakPts(top, cx, w, depth) {
  const pts = top.filter(([x]) => x > cx - w && x < cx + w);
  if (pts.length < 3) return null;
  const ymin = Math.min(...pts.map((p) => p[1]));
  return [...pts, [cx + w, ymin + depth], [cx - w, ymin + depth]];
}
function far1Layer() {
  return strip('s03v2-far1', P_FAR1, (ctx, x0, x1) => {
    const top = mountain(ctx, x0, x1, { base: 650, height: 380, color: mix(INK.qing, INK.huaqing, 0.45), alpha: 0.62, fadeY: 650, seed: 211, peaks: 2.0, layers: 2, px: PX, blur: 4, steep: 1.25 });
    // 泼墨：两座主峰的峰顶泼一大片墨（墨块集中在局部，其余留白）
    for (const [cx, w, d, sd, a] of [[-170, 190, 300, 5, 0.9], [760, 150, 230, 9, 0.62], [1700, 170, 260, 13, 0.8]]) {
      const P = peakPts(top, cx, w, d);
      if (!P) continue;
      const ymin = Math.min(...P.map((p) => p[1]));
      pomo(ctx, P, { color: mix(INK.nong, INK.huaqing, 0.25), light: mix(INK.dan, INK.huaqing, 0.3), alpha: a, seed: sd, blobs: 14, px: PX, fadeY: ymin + d, edge: 4, backrun: 3, top: 0.8 });
    }
  }, { y0: 150, y1: 700 });
}
// 远处小山包上的树和秋千（秋千每帧画，随风轻轻摆）
const SWING = { lx: 1430, knoll: 1468, ky: 646, branchY: 522 };
function far2Layer() {
  return strip('s03v2-far2', P_FAR2, (ctx, x0, x1) => {
    const top = mountain(ctx, x0, x1, { base: 705, height: 240, color: mix(INK.dan, INK.huaqing, 0.32), alpha: 0.6, fadeY: 705, seed: 223, peaks: 2.8, layers: 3, px: PX, blur: 3, steep: 1.5 });
    mossDots(ctx, top.map(([x, y]) => [x, y + 3]), { gap: 46, size: 3, color: mix(INK.zhong, INK.huaqing, 0.3), alpha: 0.7, seed: 224, chance: 0.4 });
    // 小山包
    const { knoll, ky } = SWING;
    const kp = [];
    for (let x = knoll - 170; x <= knoll + 170; x += 10) kp.push([x, ky - 34 * Math.cos(((x - knoll) / 170) * Math.PI / 2) ** 1.4 + (noise2(x / 30, 2, 4) - 0.5) * 4]);
    washShape(ctx, [...kp, [knoll + 170, 712], [knoll - 170, 712]], { color: mix(INK.dan, INK.huaqing, 0.25), alpha: 0.55, fadeY: 712, blur: 2, edge: 0.3, px: PX });
    // 树：枯笔树干 + 一根伸向左边的横枝 + 墨点树冠
    const o = { px: PX };
    bristleStroke(ctx, [[knoll + 6, ky - 30], [knoll + 2, ky - 80], [knoll - 4, ky - 130], [knoll + 4, ky - 170]], { width: 9, color: INK.zhong, alpha: 0.85, bristles: 6, dry: 0.3, seed: 31, taper: [1, 0.8, 0.4], ...o });
    bristleStroke(ctx, [[knoll - 2, ky - 116], [knoll - 30, SWING.branchY + 2], [SWING.lx - 22, SWING.branchY - 2]], { width: 5, color: INK.zhong, alpha: 0.85, bristles: 4, dry: 0.25, seed: 32, taper: [1, 0.8, 0.5], ...o });
    const R = R0('swingtree');
    for (let k = 0; k < 26; k++) {
      const a = R() * TAU, d = Math.sqrt(R());
      inkDot(ctx, knoll - 10 + Math.cos(a) * d * 64, ky - 172 + Math.sin(a) * d * 34, 9 + R() * 8, { ry: 5 + R() * 4, color: R() < 0.4 ? INK.zhong : mix(INK.dan, INK.huaqing, 0.3), alpha: 0.7, seed: k + 40, bleed: 0.3, rough: 0.35 });
    }
  }, { y0: 380, y1: 720 });
}
function drawSwing(ctx, b, cam) {
  const x = SWING.lx - cam * P_FAR2;
  if (x < X_MIN - 40 || x > X_MAX + 40) return;
  const a = Math.sin(b * Math.PI * 0.7) * 0.16 + Math.sin(b * 2.3) * 0.03;
  const L = 74;
  ctx.save();
  ctx.translate(x, SWING.branchY);
  ctx.rotate(a);
  ctx.strokeStyle = rgba(INK.zhong, 0.85); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-13, L); ctx.moveTo(12, 0); ctx.lineTo(13, L); ctx.stroke();
  ctx.lineWidth = 4; ctx.strokeStyle = rgba(INK.nong, 0.85);
  ctx.beginPath(); ctx.moveTo(-17, L); ctx.lineTo(17, L); ctx.stroke();
  ctx.restore();
}
function mistLayer() {
  return strip('s03v2-mist', P_MIST, (ctx, x0, x1) => {
    mistBand(ctx, x0, x1, 676, 86, { alpha: 0.9 });
    ctx.save();
    ctx.filter = `blur(${10 * PX}px)`;
    ctx.fillStyle = rgba(PAPER, 0.85);
    const R = R0('mist');
    for (let x = x0; x < x1; x += 160 + R() * 220) ctx.fill(blobPath(x, 624 + R() * 46, 120 + R() * 150, 16 + R() * 14, { seed: Math.round(x), rough: 0.3 }));
    ctx.restore();
  }, { y0: 540, y1: 740 });
}

// ======================================================================
// 中景山坡 + 茶色山泉
// ======================================================================
const SPRING = { top: [705, 470], foot: [430, 776] };
function springPts() {
  return memo('s03v2-springpts', () => {
    const pts = [];
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const y = lerp(SPRING.top[1], SPRING.foot[1], t);
      const x = lerp(SPRING.top[0], SPRING.foot[0], ease.inOut(t)) + Math.sin(t * Math.PI * 3.3 + 0.4) * 34 * (0.35 + t) + (fbm(t * 6, 1, 81, 2) - 0.5) * 14;
      pts.push([x, y]);
    }
    return pts;
  });
}
function drawSpring(ctx) {
  const P = springPts();
  const wAt = (i, t) => lerp(4, 30, t ** 1.3) * (0.85 + 0.3 * noise2(i * 0.3, 3, 82));
  const o = { px: PX };
  // 两岸湿墨 + 石头
  const R = R0('springrocks');
  for (let k = 0; k < 9; k++) {
    const t = 0.15 + k * 0.095, [x, y] = P[Math.round(t * 80)];
    const side = k % 2 ? 1 : -1, w = wAt(0, t);
    inkDot(ctx, x + side * (w * 0.5 + 10 + R() * 6), y + 4, 9 + t * 14, { ry: 5 + t * 6, color: mix(INK.nong, INK.huaqing, 0.15), alpha: 0.75, seed: k + 5, bleed: 0.4, rough: 0.35 });
  }
  // 水：茶色（模糊的湿边 + 水身 + 浅一点的水心），几道顺着水流的留白水光
  ctx.save();
  ctx.filter = `blur(${2 * PX}px)`;
  ctx.fillStyle = rgba(TEA.tea, 0.32);
  ctx.fill(ribbonPath(P, (i, t) => wAt(i, t) + 9));
  ctx.filter = `blur(${0.6 * PX}px)`;
  ctx.fillStyle = rgba(TEA.tea, 0.82);
  ctx.fill(ribbonPath(P, wAt));
  ctx.fillStyle = rgba(TEA.light, 0.75);
  ctx.fill(ribbonPath(P.map(([x, y], i) => [x + Math.sin(i * 0.4) * wAt(i, i / 80) * 0.12, y]), (i, t) => wAt(i, t) * 0.42));
  ctx.filter = 'none';
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = rgba(PAPER, 0.8); ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const i0 = 4 + Math.round(hash2(k, 1, 84) * 50), n = 10 + Math.round(hash2(k, 2, 84) * 16);
    const off = (hash2(k, 3, 84) - 0.5) * 0.6;
    ctx.lineWidth = 1 + (i0 / 80) * 1.6;
    ctx.beginPath();
    for (let j = 0; j <= n && i0 + j <= 80; j++) {
      const i = i0 + j, [x, y] = P[i];
      const xx = x + off * wAt(i, i / 80) + Math.sin(i * 0.9 + k) * 1.5;
      j ? ctx.lineTo(xx, y) : ctx.moveTo(xx, y);
    }
    ctx.stroke();
  }
  // 拐弯处的白沫
  for (const t of [0.22, 0.47, 0.71]) {
    const i = Math.round(t * 80), [x, y] = P[i];
    for (let j = 0; j < 5; j++) inkDot(ctx, x + (hash2(i, j, 85) - 0.5) * wAt(i, t) * 1.2, y + (hash2(j, i, 85) - 0.5) * 8, 1.6 + hash2(i, j + 9, 85) * 2.2, { color: PAPER, alpha: 0.85, seed: i + j, bleed: 0.2 });
  }
  ctx.restore();
  // 泉眼：山岩缝里一团浓墨
  inkDot(ctx, SPRING.top[0] + 6, SPRING.top[1] - 6, 22, { ry: 13, color: INK.nong, alpha: 0.85, seed: 85, bleed: 0.5, rough: 0.35 });
}
function midLayer() {
  return strip('s03v2-mid', P_MID, (ctx, x0, x1) => {
    const color = mix(INK.zhong, INK.huaqing, 0.14);
    mountain(ctx, x0, x1, { base: 778, height: 200, color, alpha: 0.46, fadeY: 778, seed: 237, peaks: 2.5, layers: 3, px: PX, blur: 2.4, steep: 1.8, cun: 1.8, moss: 0.3, rough: 0.25 });
    // 山泉流下来的那面坡：一块泼墨山岩
    const R = R0('midpomo');
    const slope = [];
    for (let x = 300; x <= 900; x += 12) slope.push([x, 470 + 300 * ((x - 720) / 300) ** 2 * (x < 720 ? 1 : 1.6) - 40 * Math.exp(-(((x - 700) / 60) ** 2)) + (noise2(x / 40, 1, 5) - 0.5) * 18]);
    pomo(ctx, [...slope.filter(([, y]) => y < 780), [900, 780], [300, 780]], { color: mix(INK.nong, INK.huaqing, 0.12), light: mix(INK.dan, INK.huaqing, 0.2), alpha: 0.78, seed: 241, blobs: 16, px: PX, fadeY: 770, edge: 3, backrun: 4, top: 0.7 });
    // 另外两处泼墨岩坡（第 2、4 小节的左边）
    for (const [cx, w, h, sd] of [[1520, 210, 190, 243], [2240, 240, 170, 245]]) {
      const P = [];
      for (let x = cx - w; x <= cx + w; x += 12) P.push([x, 776 - h * Math.exp(-(((x - cx) / (w * 0.55)) ** 2)) + (noise2(x / 36, 2, sd) - 0.5) * 16]);
      pomo(ctx, [...P, [cx + w, 780], [cx - w, 780]], { color: mix(INK.nong, INK.huaqing, 0.12), light: mix(INK.dan, INK.huaqing, 0.2), alpha: 0.62 + R() * 0.15, seed: sd, blobs: 12, px: PX, fadeY: 772, edge: 3, backrun: 3, top: 0.7 });
    }
    drawSpring(ctx);
    mistBand(ctx, x0, x1, 778, 40, { alpha: 0.65 });
  }, { y0: 380, y1: 800 });
}

// ======================================================================
// 近坡、溪、路、岩层剖面
// ======================================================================
function nearLayer() {
  return strip('s03v2-near', P_NEAR, (ctx, x0, x1) => {
    const R = R0('near');
    for (let x = x0 + 60; x < x1; x += 200 + R() * 260) {
      if (R() < 0.45) rock(ctx, x, 784, 50 + R() * 50, 22 + R() * 18, { seed: Math.round(x), color: INK.zhong, alpha: 0.7, px: PX });
      grassTuft(ctx, x + 40, 784, 26 + R() * 24, { seed: Math.round(x) + 7, color: INK.zhong, alpha: 0.55, blades: 4 + Math.floor(R() * 3), px: PX });
    }
  }, { y0: 700, y1: 800 });
}
const creekTop = (x) => 777 + Math.sin(x / 97) * 2 + (fbm(x / 140, 0.3, 91, 2) - 0.5) * 5;
function creekLayer() {
  return strip('s03v2-creek', 1, (ctx, x0, x1) => {
    const top = [];
    for (let x = x0; x <= x1; x += 8) top.push([x, creekTop(x)]);
    const band = poly([...top, [x1, 800], [x0, 800]]);
    const g = ctx.createLinearGradient(0, 776, 0, 800);
    g.addColorStop(0, rgba(TEA.tea, 0.85)); g.addColorStop(0.55, rgba(TEA.tea, 0.62)); g.addColorStop(1, rgba(TEA.light, 0.5));
    ctx.fillStyle = g; ctx.fill(band);
    const R = R0('creek');
    // 对岸：断续的枯笔 + 草
    for (let x = x0; x < x1;) {
      const L = 140 + R() * 240, pts = [];
      for (let u = 0; u <= L; u += 20) pts.push([x + u, creekTop(x + u) - 1]);
      bristleStroke(ctx, pts, { width: 3.4, color: INK.nong, alpha: 0.6, bristles: 5, dry: 0.5, seed: Math.round(x), taper: [0.7, 1, 0.3], px: PX });
      x += L + 30 + R() * 80;
    }
    // 水光（宣纸色细线）
    ctx.strokeStyle = rgba(PAPER, 0.8); ctx.lineCap = 'round';
    for (let x = x0; x < x1; x += 30 + R() * 50) {
      const y = 782 + R() * 13, L = 14 + R() * 40;
      ctx.lineWidth = 1 + R() * 1.4;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + L, y + (R() - 0.5) * 1.5); ctx.stroke();
    }
    // 近岸（路沿）：一道淡墨
    for (let x = x0; x < x1; x += 260) bristleStroke(ctx, [[x, 800], [x + 130, 799], [x + 250, 801]], { width: 3, color: INK.zhong, alpha: 0.45, bristles: 5, dry: 0.55, seed: Math.round(x) + 3, px: PX });
  }, { y0: 760, y1: 806 });
}
function roadLayer() {
  return strip('s03v2-road', 1, (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(0, ROAD_Y, 0, 1000);
    g.addColorStop(0, rgba(INK.zheshi, 0.34)); g.addColorStop(0.4, rgba(INK.zheshi, 0.14)); g.addColorStop(1, rgba(INK.zheshi, 0.05));
    ctx.fillStyle = g;
    ctx.fillRect(x0, ROAD_Y, x1 - x0, 1000 - ROAD_Y);
    const R = R0('road');
    for (let x = x0; x < x1; x += 70 + R() * 130) {
      const y = ROAD_Y + 30 + R() * 160, L = 40 + R() * 110;
      bristleStroke(ctx, [[x, y], [x + L * 0.5, y + (R() - 0.5) * 4], [x + L, y + (R() - 0.5) * 6]], { width: 3 + R() * 3, color: INK.dan, alpha: 0.42, bristles: 5, dry: 0.65, seed: Math.round(x) + 3, taper: [0.8, 1, 0.1], px: PX });
    }
    for (let x = x0; x < x1; x += 40 + R() * 90) inkDot(ctx, x, ROAD_Y + 20 + R() * 170, 2 + R() * 3.5, { ry: 1.4 + R() * 2, color: INK.zhong, alpha: 0.55, seed: Math.round(x), bleed: 0.2 });
  }, { y0: ROAD_Y, y1: 1000 });
}

// 岩层剖面：路面以下一层层的土、砾石、砂岩、页岩、基岩（宣纸留白为主，淡墨淡赭）
const SY = [800, 842, 900, 968, 1046, 1130, 1220, 1340];
const strataY = (i, x) => (i === 0 ? 800 : SY[i] + (fbm(x / 170, i * 3.7, 71, 3) - 0.5) * 30 + Math.sin(x / 260 + i * 1.3) * 7);
const LAYERS = [
  { c: INK.zheshi, a: 0.38, tex: 'soil' },
  { c: INK.dan, a: 0.16, tex: 'gravel' },
  { c: INK.huaqing, a: 0.16, tex: 'sand' },
  { c: INK.zhong, a: 0.16, tex: 'shale' },
  { c: INK.zheshi, a: 0.24, tex: 'sand' },
  { c: INK.dan, a: 0.26, tex: 'rock' },
  { c: INK.zhong, a: 0.22, tex: 'rock' },
];
function strataLayer(soaked) {
  return strip(`s03v2-strata${soaked ? '-tea' : ''}`, 1, (ctx, x0, x1) => {
    const R = R0(`strata${soaked}`);
    const o = { px: PX };
    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i];
      const top = [], bot = [];
      for (let x = x0; x <= x1; x += 10) { top.push([x, strataY(i, x)]); bot.push([x, strataY(i + 1, x)]); }
      const path = poly([...top, ...bot.slice().reverse()]);
      ctx.fillStyle = rgba(L.c, L.a);
      ctx.fill(path);
      ctx.save();
      ctx.clip(path);
      const y0 = SY[i], y1 = SY[i + 1];
      if (L.tex === 'gravel' || L.tex === 'rock') {
        const big = L.tex === 'rock';
        for (let x = x0; x < x1; x += (big ? 70 : 26) + R() * (big ? 90 : 30)) {
          const y = lerp(y0, y1, 0.15 + R() * 0.7), rx = big ? 26 + R() * 34 : 6 + R() * 9, ry = rx * (0.45 + R() * 0.25);
          const p = blobPath(x, y, rx, ry, { seed: Math.round(x) + i, rough: 0.25 });
          ctx.fillStyle = rgba(big ? INK.dan : PAPER, big ? 0.22 : 0.5); ctx.fill(p);
          ctx.strokeStyle = rgba(INK.zhong, 0.55); ctx.lineWidth = big ? 2.2 : 1.4; ctx.stroke(p);
        }
      } else if (L.tex === 'sand') {
        ctx.fillStyle = rgba(INK.zhong, 0.35);
        for (let x = x0; x < x1; x += 7 + R() * 9) { const y = lerp(y0, y1, R()); ctx.fillRect(x, y, 1.6, 1.6); }
      } else if (L.tex === 'shale') {
        for (let x = x0; x < x1; x += 50 + R() * 90) {
          const y = lerp(y0, y1, 0.2 + R() * 0.6), Lh = 60 + R() * 140;
          bristleStroke(ctx, [[x, y], [x + Lh, y + (R() - 0.5) * 4]], { width: 2.2, color: INK.zhong, alpha: 0.4, bristles: 3, dry: 0.5, seed: Math.round(x) + i, ...o });
        }
      } else if (L.tex === 'soil') {
        // 土里的细根须
        ctx.strokeStyle = rgba(INK.zhong, 0.35); ctx.lineWidth = 1;
        for (let x = x0; x < x1; x += 40 + R() * 70) { ctx.beginPath(); ctx.moveTo(x, 803); ctx.quadraticCurveTo(x + (R() - 0.5) * 20, 815, x + (R() - 0.5) * 26, 818 + R() * 18); ctx.stroke(); }
      }
      ctx.restore();
      if (i > 0) {
        for (let x = x0; x < x1;) {
          const Lb = 300 + R() * 300, pts = [];
          for (let u = 0; u <= Lb; u += 15) pts.push([x + u, strataY(i, x + u)]);
          bristleStroke(ctx, pts, { width: 3.2, color: INK.zhong, alpha: 0.6, bristles: 5, dry: 0.45, seed: Math.round(x) + i * 7, taper: [0.6, 1, 0.5], ...o });
          x += Lb + 10 + R() * 40;
        }
      }
    }
    // 基岩里的裂缝
    for (let x = x0; x < x1; x += 200 + R() * 260) {
      const pts = [[x, SY[5] + 10]];
      for (let k = 1; k < 5; k++) pts.push([pts[k - 1][0] + (R() - 0.5) * 30, pts[k - 1][1] + 26 + R() * 20]);
      bristleStroke(ctx, pts, { width: 2, color: INK.nong, alpha: 0.5, bristles: 2, dry: 0.3, seed: Math.round(x), ...o });
    }
    if (soaked) {
      // 渗进去的茶色：整体染一层，层与层交界处积一道深一点的茶色，细流往下挂
      ctx.fillStyle = rgba(TEA.light, 0.42);
      ctx.fillRect(x0, 800, x1 - x0, 540);
      for (let i = 1; i < LAYERS.length; i++) {
        const top = [], bot = [];
        for (let x = x0; x <= x1; x += 10) { const y = strataY(i, x); top.push([x, y - 16]); bot.push([x, y + 1]); }
        const band = poly([...top, ...bot.reverse()]);
        const g = ctx.createLinearGradient(0, SY[i] - 30, 0, SY[i] + 14);
        g.addColorStop(0, rgba(TEA.tea, 0)); g.addColorStop(0.8, rgba(TEA.tea, 0.45)); g.addColorStop(1, rgba(TEA.deep, 0.5));
        ctx.fillStyle = g; ctx.fill(band);
      }
      ctx.strokeStyle = rgba(TEA.deep, 0.5); ctx.lineCap = 'round';
      for (let x = x0; x < x1; x += 34 + R() * 60) {
        const i = 1 + Math.floor(R() * (LAYERS.length - 1));
        const y = strataY(i, x), L = 16 + R() * 46;
        ctx.lineWidth = 1.2 + R() * 1.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (R() - 0.5) * 8, y + L * 0.5, x + (R() - 0.5) * 10, y + L); ctx.stroke();
      }
    }
  }, { y0: 796, y1: 1342 });
}
/** 茶色渗到哪儿了（世界 x 处的前沿深度）。 */
function seepY(b, x) {
  const p = clamp((b - T_SEEP[0]) / (T_SEEP[1] - T_SEEP[0]));
  if (p <= 0) return 796;
  const n = LAYERS.length, f = p * n, i = Math.min(n - 1, Math.floor(f)), u = f - i;
  const m = p >= 1 ? 1 : ease.inOut(clamp(u / 0.7));
  const fingers = p >= 1 ? 0 : 46 * Math.max(0, fbm(x / 38, i * 2.1, 9, 2) - 0.48) * Math.sin(Math.PI * clamp(m * 1.2));
  return lerp(strataY(i, x), strataY(i + 1, x), m) + fingers + (p >= 1 ? 40 : 0);
}

// ======================================================================
// 爷爷种的樟树（世界坐标 p = 1）：骨架算一次，按生长程度烘焙成若干张，逐帧交叉淡入
// ======================================================================
const TREE_X = 960, TREE_Y = 779;
const TREE_N = 14, ROOT_N = 10;
const TB = { x: 340, top: 700, bot: 30 }; // 树的烘焙范围（单位，相对树根）
function treeSkel() {
  return memo('s03v2-treeskel', () => {
    const R = rng('s03v2-tree');
    const segs = [], leaves = [];
    function branch(x, y, a, L, w, g0, depth) {
      const n = 6, pts = [[x, y]];
      let cx = x, cy = y, ca = a;
      for (let k = 1; k <= n; k++) { ca += (R() - 0.5) * 0.22; cx += Math.cos(ca) * L / n; cy += Math.sin(ca) * L / n; pts.push([cx, cy]); }
      const g1 = Math.min(1, g0 + 0.22 + depth * 0.03);
      segs.push({ pts, w, g0, g1, depth });
      if (depth >= 3) {
        for (let k = 0; k < 4; k++) leaves.push({ x: cx + (R() - 0.5) * 50, y: cy + (R() - 0.5) * 30, r: 20 + R() * 16, g: g1 - 0.05 + R() * 0.1, tone: R() });
        return;
      }
      const kids = depth === 0 ? 3 : 2 + (R() < 0.5 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const t = depth === 0 ? 1 : 0.55 + R() * 0.45;
        const [bx, by] = pts[Math.round(t * n)];
        const spread = depth === 0 ? [-0.75, 0.05, 0.7][k] : (k - (kids - 1) / 2) * 0.8 + (R() - 0.5) * 0.3;
        const na = a + spread;
        branch(bx, by, na, L * (0.62 + R() * 0.16), w * 0.58, g0 + (g1 - g0) * t * 0.9, depth + 1);
      }
      // 沿枝的小叶团
      if (depth >= 1) for (let k = 0; k < 2; k++) { const [lx, ly] = pts[2 + k * 2]; leaves.push({ x: lx + (R() - 0.5) * 30, y: ly - 10 - R() * 20, r: 16 + R() * 12, g: g0 + 0.15 + R() * 0.2, tone: R() }); }
    }
    branch(0, 0, -Math.PI / 2 - 0.04, 250, 30, 0, 0);
    // 树冠外沿补一圈叶团，让冠形圆一点（樟树树冠浓密、圆）
    for (let k = 0; k < 34; k++) {
      const a = -Math.PI * (0.06 + 0.88 * (k / 33)) + (R() - 0.5) * 0.15;
      leaves.push({ x: Math.cos(a) * (190 + R() * 30), y: -380 + Math.sin(a) * (150 + R() * 25), r: 22 + R() * 14, g: 0.72 + R() * 0.25, tone: R() });
    }
    leaves.sort((p, q) => q.tone - p.tone); // 浅的先画，深的压在上面
    const roots = [];
    function root(x, y, a, L, w, g0, depth) {
      const n = 6, pts = [[x, y]];
      let cx = x, cy = y, ca = a;
      for (let k = 1; k <= n; k++) { ca += (R() - 0.5) * 0.5; ca = clamp(ca, 0.15, Math.PI - 0.15); cx += Math.cos(ca) * L / n; cy += Math.sin(ca) * L / n; pts.push([cx, cy]); }
      const g1 = Math.min(1, g0 + 0.35);
      roots.push({ pts, w, g0, g1 });
      if (depth >= 2) return;
      for (let k = 0; k < 2; k++) { const t = 0.4 + R() * 0.5; const [bx, by] = pts[Math.round(t * n)]; root(bx, by, ca + (k ? 0.6 : -0.6) * (0.6 + R() * 0.6), L * 0.6, w * 0.55, g0 + (g1 - g0) * t, depth + 1); }
    }
    for (let k = 0; k < 5; k++) root((k - 2) * 6, 20, Math.PI / 2 + (k - 2) * 0.42, 190 + R() * 60, 8, k * 0.04, 0);
    return { segs, leaves, roots };
  });
}
/** 第 i 张：生长程度 g（0..1）。原点在树根，画布范围 x ±TB.x、y −TB.top..TB.bot。 */
function treeStage(i) {
  const g = i / (TREE_N - 1);
  return baked(`s03v2-tree-${i}`, TB.x * 2 * K, (TB.top + TB.bot) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(TB.x, TB.top);
    const { segs, leaves } = treeSkel();
    const S = 0.86 * lerp(0.16, 1, Math.pow(g, 0.7)); // 整棵树随生长放大（树苗 → 大树）
    ctx.scale(S, S);
    const o = { px: PX * S };
    // 树干、枝
    for (const s of segs) {
      const f = clamp((g - s.g0) / (s.g1 - s.g0));
      if (f <= 0) continue;
      const n = Math.max(2, Math.round(f * (s.pts.length - 1)) + 1);
      const pts = s.pts.slice(0, n);
      bristleStroke(ctx, pts, { width: s.w * (0.5 + 0.5 * g), color: s.depth < 2 ? INK.nong : INK.zhong, alpha: 0.88, bristles: s.depth < 1 ? 9 : 5, dry: 0.3, seed: Math.round(s.pts[0][0] * 7 + s.depth), taper: [1, 0.85, 0.55], ...o });
    }
    // 叶团：淡花青 + 中墨，浓淡相间
    for (const [k, L] of leaves.entries()) {
      const f = clamp((g - L.g * 0.55) / 0.12 + 0.6);
      if (f <= 0) continue;
      const tone = L.tone < 0.35 ? mix(INK.dan, INK.huaqing, 0.35) : L.tone < 0.75 ? mix(INK.zhong, INK.huaqing, 0.22) : INK.nong;
      inkDot(ctx, L.x, L.y, L.r * f, { ry: L.r * 0.62 * f, color: tone, alpha: 0.62 + 0.25 * (L.tone > 0.75), seed: k + 300, bleed: 0.35, rough: 0.4 });
    }
    // 树苗阶段：两片嫩叶
    if (g < 0.25) {
      const a = 1 - g / 0.25;
      ctx.globalAlpha = a;
      for (const s of [-1, 1]) {
        const p = new Path2D(); p.moveTo(0, -60); p.quadraticCurveTo(s * 30, -100, s * 60, -80); p.quadraticCurveTo(s * 30, -60, 0, -60);
        ctx.fillStyle = mix(INK.zhong, INK.huaqing, 0.3); ctx.fill(p);
      }
      ctx.globalAlpha = 1;
    }
  });
}
function rootStage(i) {
  const g = i / (ROOT_N - 1);
  return baked(`s03v2-root-${i}`, 600 * K, 400 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(300, 10);
    const { roots } = treeSkel();
    for (const [k, r] of roots.entries()) {
      const f = clamp((g - r.g0) / (r.g1 - r.g0));
      if (f <= 0) continue;
      const n = Math.max(2, Math.round(f * (r.pts.length - 1)) + 1);
      bristleStroke(ctx, r.pts.slice(0, n), { width: r.w * (0.5 + 0.5 * g), color: mix(INK.nong, TEA.deep, 0.35), alpha: 0.85, bristles: 4, dry: 0.25, seed: k + 500, taper: [1, 0.8, 0.15], px: PX });
    }
  });
}
const growAt = (b) => { const u = clamp((b - T_GROW[0]) / (T_GROW[1] - T_GROW[0])); return u <= 0 ? 0 : 1 - Math.pow(1 - u, 1.7); };
function drawStages(ctx, stage, N, g, x, y, w, h, ax, ay, alpha = 1) {
  if (g <= 0.001) return;
  const f = g * (N - 1), i = Math.floor(f), u = f - i;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(stage(i), x - ax, y - ay, w, h);
  if (u > 0.02 && i + 1 < N) { ctx.globalAlpha = alpha * u; ctx.drawImage(stage(i + 1), x - ax, y - ay, w, h); }
  ctx.restore();
}
function drawTree(ctx, b, cam) {
  const g = growAt(b);
  const x = TREE_X - cam;
  if (x < X_MIN - 320 || x > X_MAX + 320) return;
  drawStages(ctx, treeStage, TREE_N, g, x, TREE_Y, TB.x * 2, TB.top + TB.bot, TB.x, TB.top);
}
function drawRoots(ctx, b, cam, alpha) {
  const g = Math.min(growAt(b) * 1.2, smoothstep(T_SEEP[0], T_SEEP[1], b));
  const x = TREE_X - cam;
  if (x < X_MIN - 320 || x > X_MAX + 320 || alpha <= 0) return;
  drawStages(ctx, rootStage, ROOT_N, g, x, TREE_Y + 20, 600, 400, 300, 10, alpha);
}

// ======================================================================
// 屋檐人家（视差 0.5；按定格时的画面坐标作画，各元素画面 x = gx + houseOff）
// ======================================================================
const HB = 772;                                   // 廊下地面
const POST = [412, 1092];
const EAVE_Y = 424, RIDGE_Y = 318, ROOF = [360, 1150];
const WIN = { x0: 806, x1: 962, y0: 466, y1: 616 }; // 暖黄的窗
const DOOR = { x0: 992, x1: 1078, y0: 470 };
const DICT = { x: 440, y: 545, w: 140, h: 128 };  // 字典（立在书立上，正对画面）
const TABLE = { x0: 612, x1: 792, top: 652, th: 30 };
const GP = { x: 878 };                            // 爷爷（坐在竹椅上，面朝左）
const BOY_X = 1048;
const STOVE_X = 968;
const HOUSE_BOX = { x0: 330, x1: 1190, y0: 290, y1: 792 };

function houseImage() {
  const { x0, x1, y0, y1 } = HOUSE_BOX;
  return baked('s03v2-house', (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-x0, -y0);
    paintHouse(ctx);
  });
}
function paintHouse(ctx) {
  const o = { px: PX };
  const R = R0('house');
  // 后墙：白墙 + 木构
  washShape(ctx, [[POST[0], EAVE_Y], [POST[1], EAVE_Y], [POST[1], HB], [POST[0], HB]], { color: mix(PAPER, '#ffffff', 0.4), alpha: 0.9, blur: 0, edge: 0, ...o });
  washShape(ctx, [[POST[0], 690], [POST[1], 690], [POST[1], HB], [POST[0], HB]], { color: INK.dan, alpha: 0.22, top: 690, fadeY: HB + 30, blur: 1, edge: 0, ...o });
  bristleStroke(ctx, [[POST[0], 690], [POST[1], 690]], { width: 3, color: INK.zhong, alpha: 0.6, bristles: 4, dry: 0.35, seed: 3, ...o });
  bristleStroke(ctx, [[POST[0], 452], [POST[1], 452]], { width: 6, color: INK.nong, alpha: 0.75, bristles: 6, dry: 0.3, seed: 4, ...o });
  for (const x of [700, 980]) bristleStroke(ctx, [[x, 452], [x + 1, HB]], { width: 5, color: INK.zhong, alpha: 0.55, bristles: 5, dry: 0.4, seed: x, ...o });
  // 窗：暖黄灯光（家的光）+ 窗格
  const { x0: wx0, x1: wx1, y0: wy0, y1: wy1 } = WIN;
  ctx.save();
  ctx.filter = `blur(${16 * PX}px)`;
  ctx.fillStyle = rgba(LAMP, 0.55);
  ctx.fillRect(wx0 - 30, wy0 - 24, wx1 - wx0 + 60, wy1 - wy0 + 60);
  ctx.filter = 'none';
  const wg = ctx.createRadialGradient((wx0 + wx1) / 2, wy0 + 60, 10, (wx0 + wx1) / 2, wy0 + 60, 120);
  wg.addColorStop(0, LAMP_HI); wg.addColorStop(1, LAMP);
  ctx.fillStyle = wg; ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  ctx.restore();
  ctx.strokeStyle = rgba(INK.nong, 0.75); ctx.lineWidth = 2.2;
  for (let x = wx0 + 26; x < wx1 - 4; x += 26) { ctx.beginPath(); ctx.moveTo(x, wy0); ctx.lineTo(x, wy1); ctx.stroke(); }
  for (let y = wy0 + 30; y < wy1 - 4; y += 30) { ctx.beginPath(); ctx.moveTo(wx0, y); ctx.lineTo(wx1, y); ctx.stroke(); }
  bristleStroke(ctx, [[wx0, wy0], [wx1, wy0], [wx1, wy1], [wx0, wy1], [wx0, wy0 + 2]], { width: 6, color: INK.nong, alpha: 0.85, bristles: 6, dry: 0.25, seed: 7, spacing: 3, ...o });
  // 门：里面亮着灯（一盏挂灯的剪影）
  const { x0: dx0, x1: dx1, y0: dy0 } = DOOR;
  const dg = ctx.createLinearGradient(0, dy0, 0, HB);
  dg.addColorStop(0, LAMP_HI); dg.addColorStop(1, mix(LAMP, INK.zheshi, 0.4));
  ctx.fillStyle = dg; ctx.fillRect(dx0, dy0, dx1 - dx0, HB - dy0);
  ctx.save(); ctx.filter = `blur(${10 * PX}px)`; ctx.fillStyle = rgba(LAMP, 0.45); ctx.fillRect(dx0 - 20, dy0 - 10, dx1 - dx0 + 40, HB - dy0 + 10); ctx.restore();
  ctx.strokeStyle = rgba(INK.nong, 0.8); ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(dx0 + 52, dy0); ctx.lineTo(dx0 + 52, dy0 + 40); ctx.stroke();
  inkDot(ctx, dx0 + 52, dy0 + 52, 11, { ry: 13, color: mix(INK.zheshi, '#e09a4a', 0.4), alpha: 0.9, seed: 9, bleed: 0.4 });
  bristleStroke(ctx, [[dx0, HB], [dx0, dy0], [dx1, dy0], [dx1, HB]], { width: 6, color: INK.nong, alpha: 0.85, bristles: 6, dry: 0.25, seed: 8, spacing: 3, ...o });
  // 檐下的阴影
  washShape(ctx, [[ROOF[0] + 30, EAVE_Y], [ROOF[1] - 30, EAVE_Y], [ROOF[1] - 40, EAVE_Y + 40], [ROOF[0] + 40, EAVE_Y + 40]], { color: INK.dan, alpha: 0.35, top: EAVE_Y, fadeY: EAVE_Y + 42, blur: 2, edge: 0, ...o });
  // 柱子
  for (const x of POST) {
    bristleStroke(ctx, [[x, HB], [x - 1, EAVE_Y - 6]], { width: 13, color: INK.nong, alpha: 0.88, bristles: 8, dry: 0.3, seed: x + 1, taper: [1.1, 0.95, 1], ...o });
    washShape(ctx, [[x - 14, HB - 18], [x + 14, HB - 18], [x + 16, HB], [x - 16, HB]], { color: INK.zhong, alpha: 0.7, blur: 0.6, edge: 0, ...o });
  }
  // 台基：石条
  washShape(ctx, [[ROOF[0] + 14, HB], [ROOF[1] - 20, HB], [ROOF[1] - 24, HB + 18], [ROOF[0] + 18, HB + 18]], { color: mix(INK.dan, INK.zheshi, 0.3), alpha: 0.5, blur: 0.8, edge: 0, ...o });
  bristleStroke(ctx, [[ROOF[0] + 14, HB], [ROOF[1] - 20, HB]], { width: 3.5, color: INK.nong, alpha: 0.8, bristles: 5, dry: 0.3, seed: 11, ...o });
  for (let x = ROOF[0] + 70; x < ROOF[1] - 30; x += 90 + R() * 40) bristleStroke(ctx, [[x, HB + 2], [x - 2, HB + 17]], { width: 2, color: INK.zhong, alpha: 0.6, bristles: 2, ...o });
  // 屋顶：泼一层湿墨做瓦面（檐口最浓），稀疏的枯笔瓦垄，檐口一排瓦当，屋脊两端起翘
  const ridgeAt = (t) => RIDGE_Y + 6 - 26 * Math.pow(Math.abs(t - 0.5) * 2, 3);       // 屋脊：中间略凹、两头翘
  const eaveAt = (t) => EAVE_Y - 4 - 16 * Math.pow(Math.abs(t - 0.5) * 2, 4);          // 檐口：两头微微上挑
  const rx = (t) => lerp(ROOF[0], ROOF[1], t);
  const topPts = [], eavePts = [];
  for (let i = 0; i <= 40; i++) { const t = i / 40; topPts.push([lerp(ROOF[0] + 70, ROOF[1] - 70, t), ridgeAt(t)]); eavePts.push([rx(t), eaveAt(t)]); }
  const roofPoly = [...topPts, ...eavePts.slice().reverse()];
  pomo(ctx, roofPoly, { color: mix(INK.nong, INK.huaqing, 0.15), light: mix(INK.dan, INK.huaqing, 0.2), alpha: 0.72, seed: 17, blobs: 10, px: PX, edge: 1.2, backrun: 2, top: 0.2, wetEdge: 0.3 });
  washShape(ctx, [...eavePts.map(([x, y]) => [x, y - 26]), ...eavePts.slice().reverse()], { color: INK.nong, alpha: 0.45, blur: 2, edge: 0, ...o });
  for (let k = 0; k < 34; k++) {
    if (R() < 0.2) continue;
    const t = (k + 0.5 + (R() - 0.5) * 0.4) / 34;
    const x1 = lerp(ROOF[0] + 70, ROOF[1] - 70, t), x2 = rx(t);
    const y1 = ridgeAt(t) + 6 + R() * 10, y2 = eaveAt(t) - 4;
    bristleStroke(ctx, [[x1, y1], [lerp(x1, x2, 0.5) + 2, lerp(y1, y2, 0.5)], [x2, y2]], { width: 4 + R() * 2.5, color: R() < 0.4 ? INK.jiao : INK.nong, alpha: 0.45 + R() * 0.35, bristles: 4, dry: 0.55, seed: 300 + k, taper: [0.4, 1, 0.9], ...o });
  }
  bristleStroke(ctx, eavePts.map(([x, y]) => [x, y + 2]), { width: 8, color: INK.jiao, alpha: 0.9, bristles: 9, dry: 0.25, seed: 13, spacing: 3, taper: [0.5, 1, 0.5], ...o });
  for (let x = ROOF[0] + 18; x < ROOF[1] - 12; x += 17) {
    const y = eaveAt((x - ROOF[0]) / (ROOF[1] - ROOF[0])) + 6;
    inkDot(ctx, x, y, 5, { ry: 4.4, color: INK.nong, alpha: 0.9, seed: Math.round(x), bleed: 0.15, rough: 0.1 });
    inkDot(ctx, x, y, 2, { color: mix(INK.dan, PAPER, 0.3), alpha: 0.8, seed: Math.round(x) + 1, bleed: 0 });
  }
  bristleStroke(ctx, topPts.map(([x, y]) => [x, y - 4]), { width: 13, color: INK.jiao, alpha: 0.9, bristles: 10, dry: 0.3, seed: 14, spacing: 3, taper: [0.4, 1, 0.4], ...o });
  for (const [t, d] of [[0, -1], [1, 1]]) { const [x, y] = topPts[t * 40]; bristleStroke(ctx, [[x, y - 2], [x + d * 16, y - 16], [x + d * 26, y - 30]], { width: 7, color: INK.jiao, alpha: 0.9, bristles: 5, taper: [1, 0.8, 0.2], ...o }); }
  // 书立 + 矮凳（字典另画）
  const sx = DICT.x + DICT.w / 2;
  washShape(ctx, [[sx - 60, 690], [sx + 60, 690], [sx + 58, 702], [sx - 58, 702]], { color: mix(INK.zheshi, INK.zhong, 0.4), alpha: 0.8, blur: 0.5, edge: 0, ...o });
  bristleStroke(ctx, [[sx - 62, 690], [sx + 62, 690]], { width: 4, color: INK.nong, alpha: 0.85, bristles: 5, ...o });
  for (const x of [sx - 48, sx + 48]) bristleStroke(ctx, [[x, 700], [x + (x < sx ? -4 : 4), HB]], { width: 6, color: INK.nong, alpha: 0.85, bristles: 5, dry: 0.3, seed: Math.round(x), ...o });
  bristleStroke(ctx, [[sx - 40, 690], [sx - 30, DICT.y + DICT.h + 4]], { width: 4, color: INK.nong, alpha: 0.8, bristles: 4, ...o });
  bristleStroke(ctx, [[sx + 40, 690], [sx + 30, DICT.y + DICT.h + 4]], { width: 4, color: INK.nong, alpha: 0.8, bristles: 4, ...o });
  // 樟木茶桌：厚板 + 左端露出横切面（年轮）+ 板腿
  const { x0: tx0, x1: tx1, top, th } = TABLE;
  washShape(ctx, [[tx0, top - 10], [tx1, top - 10], [tx1, top], [tx0, top]], { color: mix(TEA.light, PAPER, 0.35), alpha: 0.9, blur: 0, edge: 0, ...o });
  washShape(ctx, [[tx0, top], [tx1, top], [tx1, top + th], [tx0, top + th]], { color: mix(TEA.tea, INK.zheshi, 0.4), alpha: 0.75, blur: 0, edge: 0, ...o });
  for (let k = 0; k < 4; k++) bristleStroke(ctx, [[tx0 + 20, top + 6 + k * 6], [tx1 - 10, top + 7 + k * 6 + (k % 2 ? 2 : -1)]], { width: 1.6, color: TEA.deep, alpha: 0.5, bristles: 2, dry: 0.4, seed: 20 + k, ...o });
  for (const x of [tx0 + 26, tx1 - 30]) {
    washShape(ctx, [[x - 12, top + th], [x + 12, top + th], [x + 14, HB], [x - 14, HB]], { color: mix(TEA.tea, INK.zhong, 0.35), alpha: 0.8, blur: 0, edge: 0, ...o });
    bristleStroke(ctx, [[x - 12, top + th], [x - 14, HB]], { width: 3, color: INK.nong, alpha: 0.8, bristles: 3, ...o });
    bristleStroke(ctx, [[x + 12, top + th], [x + 14, HB]], { width: 3, color: INK.nong, alpha: 0.8, bristles: 3, ...o });
  }
  bristleStroke(ctx, [[tx0, top - 10], [tx1, top - 10], [tx1 + 2, top + th], [tx0, top + th]], { width: 3.6, color: INK.nong, alpha: 0.85, bristles: 5, dry: 0.3, seed: 23, spacing: 2.5, ...o });
  // 横切面
  const ec = [tx0 - 2, top + th / 2 - 4];
  ctx.save();
  ctx.fillStyle = mix(TEA.wash, PAPER, 0.3);
  ctx.beginPath(); ctx.ellipse(ec[0], ec[1], 13, 21, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(TEA.tea, 0.9); ctx.lineWidth = 1;
  for (let r = 3; r < 13; r += 2.6) { ctx.beginPath(); ctx.ellipse(ec[0] + 1, ec[1] + 1, r * 0.62, r, 0, 0, TAU); ctx.stroke(); }
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 2.6;
  ctx.beginPath(); ctx.ellipse(ec[0], ec[1], 13, 21, 0, 0, TAU); ctx.stroke();
  ctx.restore();
  // 一本立着的线装书（第三卷）：靛青封面、空白书签、右边的订线
  const bx = tx0 + 14, by = top - 70, bw = 40, bh = 60;
  ctx.save();
  ctx.translate(bx + bw / 2, by + bh);
  ctx.rotate(-0.08);
  ctx.fillStyle = '#5d6f80'; ctx.fillRect(-bw / 2, -bh, bw, bh);
  ctx.fillStyle = '#f3ecd8'; ctx.fillRect(-bw / 2 + 5, -bh + 6, 10, 32);
  ctx.strokeStyle = rgba(INK.nong, 0.8); ctx.lineWidth = 1; ctx.strokeRect(-bw / 2 + 5, -bh + 6, 10, 32);
  ctx.strokeStyle = '#efe6cf'; ctx.lineWidth = 1.2;
  for (let k = 0; k < 4; k++) { const y = -bh + 8 + k * 15; ctx.beginPath(); ctx.moveTo(bw / 2 - 5, y); ctx.lineTo(bw / 2, y); ctx.moveTo(bw / 2 - 5, y); ctx.lineTo(bw / 2 - 5, y + 15 * (k < 3)); ctx.stroke(); }
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 2; ctx.strokeRect(-bw / 2, -bh, bw, bh);
  ctx.restore();
  // 小风炉 + 陶壶（热气每帧画）
  const sx2 = STOVE_X;
  const stove = [[sx2 - 22, HB], [sx2 - 18, HB - 62], [sx2 + 18, HB - 62], [sx2 + 22, HB]];
  washShape(ctx, stove, { color: mix(INK.zheshi, INK.zhong, 0.35), alpha: 0.65, blur: 0.6, edge: 0, ...o });
  bristleStroke(ctx, stove, { width: 3.4, color: INK.nong, alpha: 0.85, bristles: 5, dry: 0.3, seed: 41, ...o });
  ctx.save(); ctx.filter = `blur(${4 * PX}px)`; ctx.fillStyle = rgba('#e0874c', 0.6); ctx.beginPath(); ctx.ellipse(sx2, HB - 26, 9, 6, 0, 0, TAU); ctx.fill(); ctx.restore();
  inkDot(ctx, sx2, HB - 78, 19, { ry: 15, color: mix(INK.zhong, TEA.deep, 0.4), alpha: 0.9, seed: 5, bleed: 0.2, rough: 0.08 });
  bristleStroke(ctx, [[sx2 - 17, HB - 84], [sx2 - 31, HB - 96]], { width: 4, color: INK.nong, alpha: 0.85, bristles: 3, ...o });
}

// ---------- 字典：被风哗哗翻页，停在一页，朱笔圈出「遥远」 ----------
function pageLines(ctx, x, y, w, h, seed, skip = null) {
  // 抽象的竖排「字」：一列列淡墨短划（不是真的字）
  ctx.save();
  ctx.strokeStyle = rgba(INK.zhong, 0.55); ctx.lineCap = 'round';
  for (let c = 0; c < 6; c++) {
    const cx = x + w - 9 - c * ((w - 14) / 5.4);
    if (skip && cx > skip[0] && cx < skip[1]) continue;
    for (let yy = y + 10; yy < y + h - 10;) {
      const L = 4 + hash2(c, Math.round(yy), seed) * 7;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(cx, yy); ctx.lineTo(cx + (hash2(c, Math.round(yy), seed + 1) - 0.5) * 2, yy + L); ctx.stroke();
      yy += L + 3 + hash2(c, Math.round(yy), seed + 2) * 4;
    }
  }
  ctx.restore();
}
function drawDict(ctx, b, ox) {
  const { x, y, w, h } = DICT;
  const X = x + ox, cx = X + w / 2;
  ctx.save();
  // 书壳 + 书口阴影
  ctx.fillStyle = rgba(INK.jiao, 0.18);
  ctx.beginPath(); ctx.ellipse(cx, y + h + 6, w * 0.55, 6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#6a5340';
  ctx.fillRect(X - 5, y - 4, w + 10, h + 9);
  ctx.fillStyle = '#f7f1e2';
  ctx.fillRect(X, y, w / 2 - 1, h);
  ctx.fillRect(cx + 1, y, w / 2 - 1, h);
  const g = ctx.createLinearGradient(cx - 14, 0, cx + 14, 0);
  g.addColorStop(0, 'rgba(90,70,40,0)'); g.addColorStop(0.5, 'rgba(90,70,40,0.25)'); g.addColorStop(1, 'rgba(90,70,40,0)');
  ctx.fillStyle = g; ctx.fillRect(cx - 14, y, 28, h);
  const flip = clamp((b - T_FLIP[0]) / (T_FLIP[1] - T_FLIP[0]));
  const settled = b >= T_FLIP[1];
  // 哪一页：翻到第几页（数字只决定页面上抽象短划的花样）
  const NF = 7;
  const pf = b < T_FLIP[0] ? 0 : settled ? NF : ease.out(flip) * NF;
  const page = Math.floor(pf);
  pageLines(ctx, X, y, w / 2 - 1, h, 900 + (settled ? 77 : page));
  if (settled) {
    // 「遥远」：右页第一列，大字（字高约 44 单位 ≈ 47px）
    const col = cx + w / 4;
    pageLines(ctx, cx + 1, y, w / 2 - 1, h, 977, [col - 26, col + 26]);
    ctx.fillStyle = INK.jiao;
    font(ctx, 44, { family: SERIF, weight: 700 });
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('遥', col, y + 39);
    ctx.fillText('远', col, y + 89);
    // 朱笔圈
    const u = ease.inOut(clamp((b - T_CIRCLE[0]) / (T_CIRCLE[1] - T_CIRCLE[0])));
    if (u > 0) {
      const pts = [];
      const a0 = -Math.PI * 0.62, span = TAU + 0.55;
      const n = Math.max(2, Math.round(48 * u));
      for (let i = 0; i <= n; i++) {
        const a = a0 + span * u * (i / n);
        const rr = 1 + 0.05 * Math.sin(a * 2.3 + 1) + (a - a0) * 0.012;
        pts.push([col + Math.cos(a) * 31 * rr, y + 64 + Math.sin(a) * 58 * rr]);
      }
      bristleStroke(ctx, pts, { width: 5, color: INK.seal, alpha: 0.92, bristles: 5, dry: 0.25, seed: 66, taper: [0.7, 1, 0.45], spacing: 2 });
    }
  } else {
    pageLines(ctx, cx + 1, y, w / 2 - 1, h, 950 + page);
  }
  // 正在翻的一页
  if (!settled && b >= T_FLIP[0]) {
    const th = (pf - page) * Math.PI;
    const tipX = cx + Math.cos(th) * (w / 2 - 2);
    const lift = Math.sin(th) * 10;
    const p = new Path2D();
    p.moveTo(cx, y); p.quadraticCurveTo((cx + tipX) / 2, y - lift, tipX, y - lift * 0.6);
    p.lineTo(tipX, y + h - lift * 0.4); p.quadraticCurveTo((cx + tipX) / 2, y + h - lift * 0.8, cx, y + h); p.closePath();
    ctx.fillStyle = Math.cos(th) > 0 ? '#fbf6ea' : '#eee6d2';
    ctx.fill(p);
    ctx.strokeStyle = rgba(INK.nong, 0.6); ctx.lineWidth = 1; ctx.stroke(p);
  }
  ctx.strokeStyle = rgba(INK.nong, 0.85); ctx.lineWidth = 2;
  ctx.strokeRect(X, y, w, h);
  ctx.beginPath(); ctx.moveTo(cx, y); ctx.lineTo(cx, y + h); ctx.stroke();
  ctx.restore();
}

// ---------- 樟木茶桌上的两卷《茶经》（线装书，摊开，风一吹就翻页） ----------
const BOOKS = [{ x: 694, ph: 0.3 }, { x: 754, ph: 0.85 }];
function drawBooks(ctx, b, ox) {
  const top = TABLE.top - 10;
  for (const [i, B] of BOOKS.entries()) {
    const x = B.x + ox, hw = 26;
    ctx.save();
    // 封面（靛青）露出一圈 + 两摞书页
    ctx.fillStyle = '#5d6f80';
    ctx.beginPath(); ctx.moveTo(x - hw - 3, top + 1); ctx.lineTo(x + hw + 3, top + 1); ctx.lineTo(x + hw + 2, top - 3); ctx.lineTo(x - hw - 2, top - 3); ctx.fill();
    for (const s of [-1, 1]) {
      const p = new Path2D();
      p.moveTo(x, top - 4); p.quadraticCurveTo(x + s * hw * 0.5, top - 12, x + s * hw, top - 9); p.lineTo(x + s * hw, top - 2); p.lineTo(x, top - 2); p.closePath();
      ctx.fillStyle = '#f6efdd'; ctx.fill(p);
      ctx.strokeStyle = rgba(INK.nong, 0.75); ctx.lineWidth = 1.2; ctx.stroke(p);
    }
    // 翻页：风一阵阵，每拍左右翻一页（第 2 小节最勤，第 4 小节偶尔）
    const rate = b < GAG ? 1 : 0.5;
    const ph = (b * rate + B.ph) % 1;
    const active = b > T_RAIN[0] - 0.5;
    if (active && ph < 0.5) {
      const th = ease.inOut(ph / 0.5) * Math.PI;
      const tipX = x + Math.cos(th) * hw, tipY = top - 9 - Math.sin(th) * 30;
      const p = new Path2D();
      p.moveTo(x, top - 4); p.quadraticCurveTo((x + tipX) / 2 + Math.cos(th) * 4, tipY - 6, tipX, tipY);
      p.quadraticCurveTo((x + tipX) / 2, (top - 4 + tipY) / 2 + 3, x, top - 3); p.closePath();
      ctx.fillStyle = '#fbf6ea'; ctx.fill(p);
      ctx.strokeStyle = rgba(INK.nong, 0.75); ctx.lineWidth = 1.1; ctx.stroke(p);
    }
    ctx.restore();
    void i;
  }
}

// ---------- 爷爷（原创：圆脑袋、大鼻子、笑纹；深灰蓝布衫；面朝左，坐竹椅） ----------
// 局部坐标：原点在竹椅正下方的地面（GP.x, HB）。
const GP_SH = [-4, -242];                 // 近侧肩
const HEAD = [-16, -292];
const ROBE_C = mix(INK.zhong, INK.huaqing, 0.32), ROBE_L = mix(INK.dan, INK.huaqing, 0.35), ROBE_DK = mix(INK.nong, INK.huaqing, 0.2);
function pathQ(cmds) {
  // cmds: ['M', x, y] / ['L', x, y] / ['Q', cx, cy, x, y]
  const p = new Path2D();
  for (const c of cmds) { if (c[0] === 'M') p.moveTo(c[1], c[2]); else if (c[0] === 'L') p.lineTo(c[1], c[2]); else p.quadraticCurveTo(c[1], c[2], c[3], c[4]); }
  p.closePath();
  return p;
}
function grandpaBody(ctx, white) {
  const o = { px: PX };
  const wood = mix(INK.zheshi, INK.zhong, 0.45);
  // 竹椅：椅背在身后（右边），座面、腿
  for (const x of [28, 52]) bristleStroke(ctx, [[x, 0], [x + 3, -120], [x + 12, -296]], { width: 7, color: wood, alpha: 0.9, bristles: 5, dry: 0.3, seed: x, ...o });
  for (const y of [-196, -236, -276]) bristleStroke(ctx, [[22, y + 4], [64, y - 2]], { width: 4, color: wood, alpha: 0.85, bristles: 3, ...o });
  bristleStroke(ctx, [[-66, -118], [58, -122]], { width: 8, color: wood, alpha: 0.92, bristles: 6, dry: 0.3, seed: 51, ...o });
  for (const x of [-58, 10]) bristleStroke(ctx, [[x, -114], [x - 3, 0]], { width: 5, color: wood, alpha: 0.85, bristles: 4, ...o });
  // 小腿（裤子）+ 黑布鞋
  const shin = pathQ([['M', -104, -124], ['L', -78, -120], ['Q', -76, -60, -80, -14], ['L', -100, -14], ['Q', -104, -70, -104, -124]]);
  ctx.save(); ctx.fillStyle = ROBE_DK; ctx.globalAlpha = 0.92; ctx.fill(shin); ctx.restore();
  ctx.save(); ctx.strokeStyle = INK.jiao; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke(shin); ctx.restore();
  const shoe = pathQ([['M', -80, -14], ['L', -78, 0], ['L', -122, 0], ['Q', -124, -10, -108, -14]]);
  ctx.save(); ctx.fillStyle = INK.jiao; ctx.fill(shoe); ctx.fillStyle = '#f2ede0'; ctx.fillRect(-122, -2, 44, 2.5); ctx.restore();
  // 布衫：上身 + 盖住大腿的下摆
  const robe = pathQ([['M', -30, -258], ['Q', -46, -226, -48, -186], ['Q', -50, -160, -52, -152], ['L', -104, -150], ['Q', -116, -138, -104, -118],
    ['L', -24, -112], ['Q', 20, -110, 38, -118], ['Q', 46, -180, 32, -244], ['Q', 10, -264, -30, -258]]);
  ctx.save(); ctx.fillStyle = ROBE_C; ctx.globalAlpha = 0.95; ctx.fill(robe); ctx.restore();
  ctx.save(); ctx.clip(robe);
  ctx.fillStyle = rgba(ROBE_DK, 0.55); ctx.fill(blobPath(30, -170, 26, 90, { seed: 5, rough: 0.2 }));      // 背光的一面
  ctx.fillStyle = rgba(ROBE_L, 0.45); ctx.fill(blobPath(-40, -210, 10, 40, { seed: 6, rough: 0.3 }));      // 胸前受光
  ctx.restore();
  for (const [pts, w] of [[[[-12, -226], [-18, -178], [-24, -150]], 2.4], [[[-60, -140], [-84, -134]], 2], [[[8, -200], [12, -150]], 2]]) bristleStroke(ctx, pts, { width: w, color: ROBE_DK, alpha: 0.8, bristles: 3, dry: 0.3, seed: Math.round(pts[0][0]), ...o });
  ctx.save(); ctx.strokeStyle = INK.jiao; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.globalAlpha = 0.9; ctx.stroke(robe); ctx.restore();
  // 对襟的盘扣
  for (let k = 0; k < 4; k++) inkDot(ctx, -38 + k * 0.6, -236 + k * 22, 2.6, { color: '#efe8d6', alpha: 0.95, seed: 58 + k, bleed: 0 });
  // 脖子
  ctx.save(); ctx.fillStyle = SKIN; ctx.fill(pathQ([['M', -30, -258], ['L', -26, -272], ['L', -2, -272], ['L', 2, -256]])); ctx.restore();
  // 头
  const [hx, hy] = HEAD;
  ctx.save();
  ctx.fillStyle = SKIN;
  ctx.fill(blobPath(hx, hy, 29, 32, { seed: 61, rough: 0.04 }));
  // 大鼻子、下巴（面朝左的侧脸）
  const face = pathQ([['M', hx - 26, hy - 16], ['Q', hx - 30, hy - 8, hx - 34, hy - 2], ['Q', hx - 46, hy + 10, hx - 36, hy + 13], ['L', hx - 30, hy + 14], ['Q', hx - 33, hy + 20, hx - 29, hy + 22], ['Q', hx - 31, hy + 30, hx - 22, hy + 33], ['L', hx - 4, hy + 30], ['L', hx - 4, hy - 10]]);
  ctx.fill(face);
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(hx - 24, hy - 28); ctx.quadraticCurveTo(hx - 30, hy - 10, hx - 34, hy - 2); ctx.quadraticCurveTo(hx - 46, hy + 10, hx - 36, hy + 13); ctx.lineTo(hx - 30, hy + 14);
  ctx.quadraticCurveTo(hx - 33, hy + 20, hx - 29, hy + 22); ctx.quadraticCurveTo(hx - 31, hy + 30, hx - 22, hy + 33); ctx.quadraticCurveTo(hx - 6, hy + 34, hx + 8, hy + 24); ctx.stroke();
  // 后脑勺
  ctx.beginPath(); ctx.moveTo(hx + 8, hy + 24); ctx.quadraticCurveTo(hx + 30, hy + 8, hx + 26, hy - 18); ctx.stroke();
  ctx.restore();
  // 耳朵
  ctx.save(); ctx.fillStyle = SKIN; ctx.beginPath(); ctx.ellipse(hx + 8, hy + 2, 6, 9, 0.2, 0, TAU); ctx.fill(); ctx.strokeStyle = INK.nong; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
  // 头发：抽烟时花白（灰里夹白），第 4 小节满头白发（蓬松）
  const hair = white
    ? pathQ([['M', hx - 28, hy - 18], ['Q', hx - 32, hy - 40, hx - 10, hy - 44], ['Q', hx + 14, hy - 50, hx + 30, hy - 30], ['Q', hx + 40, hy - 10, hx + 30, hy + 14], ['Q', hx + 24, hy + 22, hx + 18, hy + 12], ['Q', hx + 16, hy - 6, hx + 4, hy - 14], ['Q', hx - 12, hy - 22, hx - 28, hy - 18]])
    : pathQ([['M', hx - 26, hy - 22], ['Q', hx - 26, hy - 38, hx - 8, hy - 38], ['Q', hx + 14, hy - 42, hx + 26, hy - 26], ['Q', hx + 34, hy - 8, hx + 28, hy + 12], ['Q', hx + 22, hy + 18, hx + 18, hy + 8], ['Q', hx + 14, hy - 8, hx + 2, hy - 16], ['Q', hx - 12, hy - 22, hx - 26, hy - 22]]);
  if (white) {
    // 蓬松的白发：沿发际几团小卷
    ctx.save();
    for (const [x, y, r] of [[hx - 24, hy - 30, 9], [hx - 12, hy - 42, 10], [hx + 4, hy - 45, 10], [hx + 20, hy - 38, 10], [hx + 31, hy - 22, 9], [hx + 33, hy - 4, 8], [hx + 27, hy + 12, 7]]) {
      ctx.fillStyle = '#fbf9f2'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK.dan; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(x, y, r, Math.PI * 0.9, Math.PI * 2.1); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.save();
  ctx.fillStyle = white ? '#fbf9f2' : mix(INK.zhong, INK.dan, 0.25);
  ctx.fill(hair);
  ctx.strokeStyle = white ? INK.dan : INK.nong; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(hair);
  ctx.clip(hair);
  ctx.strokeStyle = white ? rgba(INK.dan, 0.7) : rgba('#f6f2e8', 0.85); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  const nS = white ? 4 : 9;
  for (let k = 0; k < nS; k++) { const x = hx - 20 + k * (white ? 13 : 7); ctx.beginPath(); ctx.moveTo(x, hy - 44); ctx.quadraticCurveTo(x + 10, hy - 34 + (k % 2) * 4, x + 12 + k, hy - 20 + k * 3); ctx.stroke(); }
  ctx.restore();
  // 皱纹、笑纹、眉
  ctx.save();
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hx - 22 + k, hy - 24 + k * 5); ctx.quadraticCurveTo(hx - 12, hy - 27 + k * 5, hx - 2, hy - 24 + k * 5); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(hx - 24, hy + 12); ctx.quadraticCurveTo(hx - 18, hy + 18, hx - 19, hy + 26); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hx - 8, hy - 2); ctx.lineTo(hx - 3, hy - 6); ctx.moveTo(hx - 8, hy + 1); ctx.lineTo(hx - 2, hy + 2); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = white ? '#fbf9f2' : INK.zhong; ctx.strokeStyle = white ? INK.dan : INK.zhong; ctx.lineWidth = 1;
  const brow = pathQ([['M', hx - 10, hy - 14], ['Q', hx - 22, hy - 19, hx - 32, hy - 12], ['Q', hx - 22, hy - 13, hx - 10, hy - 10]]);
  ctx.fill(brow); ctx.stroke(brow);
  ctx.restore();
  // 白胡子（白发版）
  if (white) {
    const beard = pathQ([['M', hx - 30, hy + 16], ['Q', hx - 38, hy + 40, hx - 26, hy + 56], ['Q', hx - 18, hy + 44, hx - 6, hy + 46], ['Q', hx + 4, hy + 36, hx + 6, hy + 22], ['Q', hx - 10, hy + 30, hx - 30, hy + 16]]);
    ctx.save(); ctx.fillStyle = '#fbf9f2'; ctx.fill(beard); ctx.strokeStyle = INK.dan; ctx.lineWidth = 1.6; ctx.stroke(beard); ctx.restore();
  }
}
function grandpaFace(ctx, white) {
  const [hx, hy] = HEAD;
  ctx.save();
  ctx.strokeStyle = INK.jiao; ctx.lineCap = 'round';
  if (!white) {
    // 眯着眼抽烟：一道弯
    ctx.lineWidth = 2.6;
    ctx.beginPath(); ctx.moveTo(hx - 28, hy - 6); ctx.quadraticCurveTo(hx - 22, hy - 2, hx - 16, hy - 6); ctx.stroke();
    // 嘴：抿着烟嘴
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 33, hy + 17); ctx.lineTo(hx - 24, hy + 18); ctx.stroke();
  } else {
    // 睁着眼，眼角带笑，看着他（左边）
    ctx.fillStyle = INK.jiao;
    ctx.beginPath(); ctx.ellipse(hx - 24, hy - 4, 3, 3.6, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(hx - 30, hy - 8); ctx.quadraticCurveTo(hx - 24, hy - 11, hx - 18, hy - 8); ctx.stroke();
    ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx - 32, hy + 17); ctx.quadraticCurveTo(hx - 27, hy + 19, hx - 23, hy + 17); ctx.stroke();
  }
  ctx.restore();
}
function grandpaImage(white) {
  return baked(`s03v2-gp-${white ? 'w' : 'g'}`, 260 * K, 360 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(170, 350);
    const o = { px: PX };
    if (!white) {
      // 远侧手搭在膝上（被身子挡住，只露出手）
      grandpaBody(ctx, false);
      grandpaFace(ctx, false);
      handBlob(ctx, [-88, -154], 0);
      // 近侧手握着旱烟袋：烟嘴含在嘴里，长杆斜向前下方，铜烟锅
      const m = [HEAD[0] - 31, HEAD[1] + 17], bowl = [-158, -196];
      bristleStroke(ctx, [m, bowl], { width: 3.4, color: mix(INK.zheshi, INK.nong, 0.6), alpha: 0.95, bristles: 3, dry: 0.05, seed: 81, ...o });
      ctx.save(); ctx.fillStyle = '#d8c9a0'; ctx.beginPath(); ctx.arc(m[0] - 1, m[1], 3, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.fillStyle = '#a9894a'; ctx.strokeStyle = INK.nong; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(bowl[0] - 10, bowl[1] - 12); ctx.lineTo(bowl[0] + 8, bowl[1] - 12); ctx.lineTo(bowl[0] + 5, bowl[1] + 2); ctx.lineTo(bowl[0] - 7, bowl[1] + 2); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
      sleeveArm(ctx, GP_SH, [-22, -178], [-88, -244]);
      // 烟荷包
      bristleStroke(ctx, [[-120, -224], [-122, -200]], { width: 1.4, color: INK.nong, alpha: 0.8, bristles: 1, ...o });
      inkDot(ctx, -122, -190, 9, { ry: 11, color: mix(INK.zheshi, INK.zhong, 0.3), alpha: 0.95, seed: 83, bleed: 0.15 });
    } else {
      grandpaBody(ctx, true);
      grandpaFace(ctx, true);
      // 远侧手端着茶杯（近侧手每帧画，竖起手指）
      sleeveArm(ctx, [-28, -226], [-36, -186], [-66, -204], 1, false, true);
      teacup(ctx, ...CUP_L, 1.15);
    }
  });
}
const CUP_L = [-70, -220];                // 茶杯（局部坐标）
/** 一只握着的手（肤色团 + 指节线）。 */
function handBlob(ctx, [x, y], rot = 0) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  const p = pathQ([['M', 10, -8], ['Q', -2, -14, -12, -8], ['Q', -18, -2, -14, 7], ['Q', -4, 13, 10, 9]]);
  ctx.fillStyle = SKIN; ctx.fill(p);
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(p);
  ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1.2;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-10 + k * 1.5, -4 + k * 4); ctx.lineTo(-4 + k * 1.5, -3 + k * 4); ctx.stroke(); }
  ctx.restore();
}
/** 袖子（布衫）+ 手：肩 → 肘 → 手腕。finger：竖起食指；far：远侧的手臂（颜色深一点）。 */
function sleeveArm(ctx, sh, el, hand, k = 1, finger = false, far = false) {
  const nrm = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  const n1 = nrm(sh, el), n2 = nrm(el, hand);
  const ne = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
  const P = (q, n, w) => [q[0] + n[0] * w, q[1] + n[1] * w];
  const wr = [hand[0] + (el[0] - hand[0]) * 0.2, hand[1] + (el[1] - hand[1]) * 0.2];
  const A = [P(sh, n1, 15), P(el, ne, 14), P(wr, n2, 13)];
  const Bv = [P(sh, n1, -15), P(el, ne, -14), P(wr, n2, -13)];
  const sl = poly([...A, ...Bv.reverse()]);
  ctx.save();
  ctx.globalAlpha *= k;
  if (finger) {
    // 竖起的食指（先画，压在手掌后面一点）
    const f = pathQ([['M', hand[0] - 9, hand[1] - 4], ['L', hand[0] - 10, hand[1] - 32], ['Q', hand[0] - 6, hand[1] - 38, hand[0] - 2, hand[1] - 32], ['L', hand[0] - 1, hand[1] - 6]]);
    ctx.fillStyle = SKIN; ctx.fill(f); ctx.strokeStyle = INK.nong; ctx.lineWidth = 1.8; ctx.stroke(f);
  }
  handBlob(ctx, hand, Math.atan2(hand[1] - el[1], hand[0] - el[0]) + Math.PI);
  ctx.fillStyle = far ? ROBE_DK : ROBE_C; ctx.fill(sl);
  ctx.strokeStyle = INK.jiao; ctx.lineWidth = 2.6; ctx.lineJoin = 'round'; ctx.stroke(sl);
  // 袖口一道浅边
  ctx.strokeStyle = rgba(ROBE_L, 0.9); ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.moveTo(...P(wr, n2, 11)); ctx.lineTo(...P(wr, n2, -11)); ctx.stroke();
  ctx.restore();
}
function teacup(ctx, x, y, s) {
  // 小茶杯：白瓷 + 茶色的茶汤
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  const p = new Path2D(); p.moveTo(-13, -10); p.lineTo(13, -10); p.quadraticCurveTo(12, 8, 5, 10); p.lineTo(-5, 10); p.quadraticCurveTo(-12, 8, -13, -10); p.closePath();
  ctx.fillStyle = '#fbf8f0'; ctx.fill(p);
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 1.8; ctx.stroke(p);
  ctx.fillStyle = TEA.tea; ctx.beginPath(); ctx.ellipse(0, -9, 11.5, 3, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
const CUP_G = [GP.x + CUP_L[0], HB + CUP_L[1] - 12]; // 茶杯口（定格时的画面坐标）
function drawGrandpa(ctx, b, ox) {
  const white = b >= GAG;
  const x = GP.x + ox;
  ctx.drawImage(grandpaImage(white), x - 170, HB - 350, 260, 360);
  if (white) {
    // 近侧手：从膝上抬到嘴边，竖起食指（嘘——）
    const u = ease.inOut(clamp((b - T_HUSH[0]) / (T_HUSH[1] - T_HUSH[0])));
    const hand = [lerp(-86, -54, u), lerp(-150, -262, u)];
    const el = [lerp(-30, -14, u), lerp(-176, -196, u)];
    ctx.save();
    ctx.translate(x, HB);
    sleeveArm(ctx, GP_SH, el, hand, 1, u > 0.5);
    ctx.restore();
  }
}
// 门口的小男孩：墨色剪影，背着手，望着远处的秋千（面朝右）
function boyImage() {
  return baked('s03v2-boy', 120 * K, 200 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(60, 192);
    const p = new Path2D();
    // 腿、短裤、上身、背着的手、头、一撮翘起的头发
    p.moveTo(-10, 0); p.lineTo(-9, -52); p.lineTo(-17, -54); p.lineTo(-18, -80); p.quadraticCurveTo(-24, -112, -16, -128);
    p.quadraticCurveTo(-6, -136, 8, -132); p.quadraticCurveTo(18, -116, 16, -80); p.lineTo(14, -54); p.lineTo(8, -52); p.lineTo(8, 0); p.lineTo(16, 0); p.lineTo(16, 4); p.lineTo(-1, 4); p.lineTo(-1, -48); p.lineTo(-2, 4); p.lineTo(-18, 4); p.lineTo(-18, 0); p.closePath();
    ctx.save();
    ctx.fillStyle = INK.jiao;
    ctx.filter = `blur(${1.2 * PX}px)`;
    ctx.globalAlpha = 0.5;
    ctx.fill(p);
    ctx.filter = 'none';
    ctx.globalAlpha = 0.92;
    ctx.fill(p);
    ctx.fill(blobPath(1, -152, 19, 21, { seed: 3, rough: 0.06 }));
    ctx.fill(blobPath(-20, -96, 9, 8, { seed: 4, rough: 0.2 })); // 背在身后的手
    ctx.lineWidth = 2.4; ctx.strokeStyle = INK.jiao; ctx.lineCap = 'round'; // 头顶两撮翘起的头发
    ctx.beginPath(); ctx.moveTo(-6, -170); ctx.quadraticCurveTo(-4, -177, 1, -176); ctx.moveTo(0, -171); ctx.quadraticCurveTo(4, -176, 8, -173); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -150); ctx.lineTo(25, -146); ctx.lineTo(19, -142); ctx.fill(); // 鼻尖
    ctx.restore();
  });
}
const boyAlpha = (b) => smoothstep(1.5, 3.2, b) * (1 - smoothstep(GAG - 0.3, GAG, b));

function drawDrips(ctx, b, ox, amt) {
  if (amt <= 0) return;
  ctx.save();
  for (let k = 0; k < 15; k++) {
    const x = ROOF[0] + 24 + k * 52 + ox;
    if (x < X_MIN - 10 || x > X_MAX + 10) continue;
    const per = 0.9 + hash2(k, 1, 41) * 0.5;
    const t = ((b / per + hash2(k, 2, 41)) % 1);
    const y0 = EAVE_Y + 6, y1 = HB + 6;
    const tf = t / 0.7;
    ctx.globalAlpha = amt;
    if (tf < 1) {
      const y = y0 + (y1 - y0) * tf * tf;
      ctx.fillStyle = rgba(INK.zhong, 0.7);
      ctx.beginPath(); ctx.ellipse(x, y, 2.2, 4 + tf * 4, 0, 0, TAU); ctx.fill();
    } else {
      const u = (tf - 1) / 0.43;
      ctx.strokeStyle = rgba(INK.zhong, 0.55 * (1 - u)); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(x, y1, 4 + u * 12, 1.5 + u * 2.5, 0, 0, TAU); ctx.stroke();
    }
    // 檐口挂着的一颗
    ctx.fillStyle = rgba(INK.zhong, 0.6);
    ctx.beginPath(); ctx.ellipse(x, y0 + 1, 2, 2.6 + (t > 0.85 ? (t - 0.85) * 18 : 0), 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}
function drawWisp(ctx, x, y, b, { len = 80, sway = 8, seed = 0, color = INK.dan, alpha = 0.55, w = 2.6, dir = 0 } = {}) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const ph = (b * 0.5 + k / 3 + seed * 0.13) % 1;
    const a = Math.sin(Math.PI * ph) * alpha;
    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = w * (1 - ph * 0.5);
    ctx.beginPath();
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      const yy = y - (ph * len * 0.8 + t * len * 0.7);
      const xx = x + (k - 1) * 5 + Math.sin(t * 5 + b * 2 + k + seed) * (sway * (0.4 + t)) + dir * (ph + t) * len * 0.5;
      s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawHouse(ctx, b, env) {
  const ox = houseOff(env);
  const { x0, x1, y0, y1 } = HOUSE_BOX;
  if (x1 + ox < X_MIN || x0 + ox > X_MAX) return;
  ctx.drawImage(houseImage(), x0 + ox, y0, x1 - x0, y1 - y0);
  drawWisp(ctx, STOVE_X - 2 + ox, HB - 96, b, { len: 70, sway: 7, seed: 2 });
  drawDict(ctx, b, ox);
  drawBooks(ctx, b, ox);
  drawGrandpa(ctx, b, ox);
  if (b < GAG) drawWisp(ctx, GP.x - 149 + ox, HB - 210, b, { len: 90, sway: 9, seed: 5, color: INK.zhong, alpha: 0.45, w: 2.2, dir: -0.3 }); // 烟锅里的烟
  const ba = boyAlpha(b);
  if (ba > 0.01) { ctx.save(); ctx.globalAlpha = ba; ctx.drawImage(boyImage(), BOY_X + ox - 60, HB - 192, 120, 200); ctx.restore(); }
  drawDrips(ctx, b, ox, rainAt(b));
}
const rainAt = (b) => smoothstep(T_RAIN[0], T_RAIN[1], b) * (1 - smoothstep(GAG - 0.4, GAG, b));

// ======================================================================
// 第 4 小节：远处的唐代茶人牵着瘦马走进风沙（原创，小小的墨色剪影）
// ======================================================================
function luyuState(b, env) {
  const u = clamp((b - T_WIDE) / 4.2);
  const par = (env.cam - env.camAt(T_WIDE)) * 0.15;
  return { x: lerp(96, -70, u) - par, y: lerp(640, 600, u), s: lerp(1.45, 0.85, u), a: smoothstep(T_WIDE - 0.01, T_WIDE + 0.2, b) };
}
function drawSand(ctx, b, L) {
  // 风沙：一团赭黄的尘雾 + 横着刮的细沙线（风从左往右）
  ctx.save();
  ctx.globalAlpha = 0.7 * L.a;
  ctx.drawImage(puff(mix(INK.zheshi, TEA.light, 0.5)), L.x + 30 - 260, L.y - 30 - 260, 520, 520);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = rgba(TEA.deep, 0.35 * L.a); ctx.lineCap = 'round';
  for (let k = 0; k < 26; k++) {
    const sp = 90 + hash2(k, 1, 61) * 80;
    const xx = L.x - 240 + ((hash2(k, 2, 61) * 480 + b * sp) % 480);
    const yy = L.y - 130 + hash2(k, 3, 61) * 150;
    const len = 12 + hash2(k, 4, 61) * 30;
    ctx.lineWidth = 0.8 + hash2(k, 5, 61) * 1.2;
    ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + len, yy - len * 0.06); ctx.stroke();
  }
  ctx.restore();
}
function drawLuyu(ctx, b, env) {
  if (b < T_WIDE) return;
  const L = luyuState(b, env);
  if (L.x < X_MIN - 200) return;
  drawSand(ctx, b, L);
  const col = mix(INK.jiao, INK.zheshi, 0.15);
  const ph = b * Math.PI * 2; // 一拍一步
  ctx.save();
  ctx.translate(L.x, L.y);
  ctx.scale(L.s, L.s);
  ctx.globalAlpha = L.a;
  ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 远处的小路
  ctx.lineWidth = 2; ctx.strokeStyle = rgba(INK.zhong, 0.45);
  ctx.beginPath(); ctx.moveTo(-80, 2); ctx.quadraticCurveTo(40, -1, 170, 4); ctx.stroke();
  ctx.strokeStyle = col;
  // —— 瘦马（跟在后面，右边），头低垂，鬃毛、尾巴被风吹向右
  const hx = 92;
  ctx.lineWidth = 2.6;
  for (let k = 0; k < 4; k++) {
    const front = k < 2, lx = hx + (front ? -24 : 26) + (k % 2) * 6;
    const sw = Math.sin(ph + k * Math.PI * (k % 2 ? 1 : 0) + (front ? 0 : Math.PI)) * 6;
    ctx.beginPath(); ctx.moveTo(lx, -40); ctx.lineTo(lx + sw * 0.5, -20); ctx.lineTo(lx + sw, 0); ctx.stroke();
  }
  const body = new Path2D();
  body.moveTo(hx - 30, -44); body.quadraticCurveTo(hx, -56, hx + 32, -46); body.quadraticCurveTo(hx + 36, -36, hx + 28, -34); body.quadraticCurveTo(hx, -36, hx - 28, -34); body.closePath();
  ctx.fill(body);
  ctx.lineWidth = 7; // 脖子低垂
  ctx.beginPath(); ctx.moveTo(hx - 26, -44); ctx.quadraticCurveTo(hx - 40, -50, hx - 48, -36); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(hx - 52, -31, 8, 4.5, 0.6, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(PAPER, 0.7); // 肋骨
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hx - 6 + k * 7, -50); ctx.lineTo(hx - 8 + k * 7, -38); ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(hx - 28 + k * 4, -50); ctx.quadraticCurveTo(hx - 18 + k * 4, -58 - Math.sin(ph * 0.5 + k) * 2, hx - 6 + k * 5, -56); ctx.stroke(); }
  ctx.beginPath(); ctx.moveTo(hx + 32, -44); ctx.quadraticCurveTo(hx + 46, -40 + Math.sin(ph * 0.7) * 3, hx + 50, -24); ctx.stroke();
  // 缰绳：从马头到他手里
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(INK.nong, 0.8);
  ctx.beginPath(); ctx.moveTo(hx - 54, -30); ctx.quadraticCurveTo(hx - 66, -22, 14, -40); ctx.stroke();
  ctx.strokeStyle = col;
  // —— 茶人：幞头（两条软脚被风吹向右）、宽袍下摆往右飘、拄杖，面朝左背着风往远处走
  const step = Math.sin(ph) * 5;
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-2, -16); ctx.lineTo(-4 - step, 0); ctx.moveTo(4, -16); ctx.lineTo(6 + step, 0); ctx.stroke();
  const robe = new Path2D();
  robe.moveTo(-8, -58); robe.quadraticCurveTo(-14, -30, -12, -12); robe.lineTo(16 + Math.sin(ph * 0.7) * 3, -10); robe.quadraticCurveTo(22, -24, 12, -40); robe.quadraticCurveTo(10, -56, 4, -60); robe.closePath();
  ctx.fill(robe);
  ctx.beginPath(); ctx.ellipse(-2, -66, 6, 7, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = INK.jiao;
  ctx.beginPath(); ctx.ellipse(-1, -72, 7, 4.5, 0, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = INK.jiao; ctx.lineWidth = 1.6;
  for (const k of [0, 1]) { ctx.beginPath(); ctx.moveTo(5, -71 + k * 2); ctx.quadraticCurveTo(14, -74 + k * 4 + Math.sin(ph + k) * 2, 22, -70 + k * 6 + Math.sin(ph * 1.3 + k) * 3); ctx.stroke(); }
  ctx.strokeStyle = col; ctx.lineWidth = 2; // 手杖
  ctx.beginPath(); ctx.moveTo(-14, -44); ctx.lineTo(-22 - step * 0.5, 0); ctx.stroke();
  ctx.restore();
}

/** 一团柔软的圆形光晕（烘焙一次，每帧只 drawImage）。 */
function puff(color) {
  return baked(`s03v2-puff-${color}`, 128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.5, rgba(color, 0.45)); gr.addColorStop(1, rgba(color, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  });
}
// ======================================================================
// 第 4 小节：茶色晕进整张画、茶烟变成山里的雾
// ======================================================================
function cupScreen(env) { return [CUP_G[0] + houseOff(env), CUP_G[1] + 6]; }
function drawTint(ctx, b, env) {
  const a = smoothstep(T_TINT[0], T_TINT[1], b);
  if (a <= 0) return;
  const [cx, cy] = cupScreen(env);
  const R = lerp(30, 2300, ease.out(a));
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  g.addColorStop(0, rgba(TEA.wash, 0.75));
  g.addColorStop(0.7, rgba(TEA.wash, 0.62));
  g.addColorStop(0.86, rgba(TEA.light, 0.42 * (1 - a * 0.7)));
  g.addColorStop(1, rgba(TEA.wash, 0));
  ctx.fillStyle = g;
  ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
  ctx.restore();
}
function fogImage() {
  // 雾带：一串模糊的纸色椭圆，从左边的山里往右淡开（烘焙一次）
  const w = X_MAX - X_MIN + 400;
  return baked('s03v2-fog', w * K * 0.5, 220 * K * 0.5, (g) => {
    g.scale(K * 0.5, K * 0.5);
    g.filter = `blur(${7 * PX}px)`;
    for (let k = 0; k < 11; k++) {
      const x = 80 + k * 200 + Math.sin(k * 2.1) * 50, y = 110 + Math.sin(k * 1.7) * 30;
      const L = clamp(1 - (x - 700) / 1000);
      g.fillStyle = rgba(mix('#fffbf2', TEA.wash, 0.2), 0.9 * L);
      g.beginPath(); g.ellipse(x, y, 220, 30 + (k % 3) * 12, 0, 0, TAU); g.fill();
    }
  });
}
function drawFogBand(ctx, b) {
  const a = smoothstep(T_FOG[0], T_FOG[1], b);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.drawImage(fogImage(), X_MIN - 320 + (b - T_FOG[0]) * 22, 395, X_MAX - X_MIN + 400, 220);
  ctx.restore();
}
/** 茶烟：从爷爷的杯子升起，打着卷飘过他，往左边山里去（画在人物前面）。 */
function smokePath(k, b, cx, cy, reach) {
  const N = 40, pts = [];
  let x = cx + (k - 2) * 3, y = cy - 6, a = -Math.PI / 2;
  const total = 820 + k * 90, step = (total * reach) / N;
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    pts.push([x, y, s * reach]);
    // 先往上升，再慢慢折向左边；一路打卷
    const turn = smoothstep(0.02, 0.17, s * reach);
    a = -Math.PI / 2 - turn * (Math.PI / 2.25) + Math.sin(s * reach * 15 + k * 2.1 + b * 1.6) * (0.25 + 0.55 * s * reach);
    x += Math.cos(a) * step; y += Math.sin(a) * step * (1 - 0.35 * turn);
  }
  return pts;
}
function drawTeaSmoke(ctx, b, env) {
  if (b < T_WIDE) return;
  const [cx, cy] = cupScreen(env);
  const age = b - T_WIDE;
  const fade = 1 - smoothstep(15, 16.3, b);
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 0; k < 5; k++) {
    const reach = clamp((age - k * 0.15) / 2.4);
    if (reach <= 0.01) continue;
    const pts = smokePath(k, b, cx, cy, reach);
    // 软的白烟（暗处看得见）：一串越来越大、越来越淡的圆团
    const P = puff('#fffaf0');
    for (let i = 2; i < pts.length; i += 3) {
      const [x, y, s] = pts[i];
      const r = 10 + s * 52;
      ctx.globalAlpha = 0.3 * fade * (1 - s * 0.6);
      ctx.drawImage(P, x - r, y - r, 2 * r, 2 * r);
    }
    ctx.globalAlpha = 1;
    // 烟线（白纸上看得见）：一道淡茶灰的细线，带一点粗细起伏
    ctx.strokeStyle = rgba(mix(TEA.deep, INK.dan, 0.5), 0.6 * fade);
    for (let i = 1; i < pts.length; i++) {
      const [x0, y0, s0] = pts[i - 1], [x1, y1] = pts[i];
      ctx.globalAlpha = 1 - s0 * 0.7;
      ctx.lineWidth = 1.2 + 1.6 * Math.sin(Math.PI * Math.min(1, s0 * 1.6));
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ======================================================================
// 前景
// ======================================================================
function fgLayer() {
  return strip('s03v2-fg', P_FG, (ctx, x0, x1) => {
    const R = R0('fg');
    for (let x = x0 + 100; x < x1; x += 420 + R() * 420) {
      grassTuft(ctx, x, 1012, 90 + R() * 60, { seed: Math.round(x), color: INK.zhong, alpha: 0.55, blades: 7, spread: 1.4, px: PX });
      grassTuft(ctx, x + 40, 1014, 60 + R() * 40, { seed: Math.round(x) + 1, color: INK.dan, alpha: 0.5, blades: 5, spread: 1.2, px: PX });
    }
  }, { y0: 840, y1: 1030 });
}
function drawRain(ctx, b) {
  const a = rainAt(b);
  if (a <= 0.01) return;
  ctx.save();
  ctx.strokeStyle = rgba(mix(INK.dan, INK.huaqing, 0.4), 0.42 * a);
  ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 90; k++) {
    const x0 = X_MIN + hash2(k, 1, 71) * (X_MAX - X_MIN + 200);
    const sp = 1 + hash2(k, 2, 71) * 0.4;
    const y = ((hash2(k, 3, 71) + b * 1.6 * sp) % 1) * 1150 - 80;
    const x = x0 - y * 0.12;
    ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 30);
  }
  ctx.stroke();
  ctx.restore();
}

// ======================================================================
// 全景（第 1、2、4 小节；第 3 小节推进镜头时也用）
// ======================================================================
function paintPaper(ctx) {
  const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1000 * K);
  ctx.drawImage(xuanPaper(pw, ph, { seed: 3 }), X_MIN, 0, X_MAX - X_MIN, 1000);
}
function paintWide(ctx, b, env) {
  const cam = env.cam;
  paintPaper(ctx);
  ctx.save();
  ctx.translate(0, -DROP * tiltAt(b));
  drawStrip(ctx, skyLayer(), cam);
  drawStrip(ctx, far1Layer(), cam);
  drawStrip(ctx, far2Layer(), cam);
  drawSwing(ctx, b, cam);
  drawStrip(ctx, mistLayer(), cam - (b * 10) / P_MIST);
  drawLuyu(ctx, b, env);
  drawFogBand(ctx, b);
  drawStrip(ctx, midLayer(), cam);
  drawHouse(ctx, b, env);
  drawStrip(ctx, nearLayer(), cam);
  // 路面 ↔ 岩层剖面
  const cut = cutAt(b);
  if (cut < 0.999) { ctx.save(); ctx.globalAlpha = 1 - cut; drawStrip(ctx, roadLayer(), cam); ctx.restore(); }
  if (cut > 0.001) {
    ctx.save();
    ctx.globalAlpha = cut;
    drawStrip(ctx, strataLayer(false), cam);
    // 渗进去的茶色 + 跟着往下扎的树根
    const pts = [[X_MIN, 790]];
    for (let sx = X_MIN; sx <= X_MAX + 12; sx += 12) pts.push([sx, seepY(b, sx + cam)]);
    pts.push([X_MAX + 12, 790]);
    ctx.clip(poly(pts));
    drawStrip(ctx, strataLayer(true), cam);
    drawRoots(ctx, b, cam, 1);
    ctx.restore();
    // 渗水的前沿：一道湿湿的深茶色水痕
    if (b < T_SEEP[1]) {
      ctx.save();
      ctx.globalAlpha = cut * 0.7;
      ctx.strokeStyle = TEA.deep; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.filter = `blur(${1.2 * PX}px)`;
      ctx.beginPath(); pts.slice(1, -1).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
      ctx.restore();
    }
  }
  drawStrip(ctx, creekLayer(), cam);
  drawCreekFlow(ctx, b, cam);
  drawTree(ctx, b, cam);
  drawTint(ctx, b, env);
  ctx.restore();
}
function drawCreekFlow(ctx, b, cam) {
  // 溪水流动：几道宣纸色的水光往右漂
  ctx.save();
  ctx.strokeStyle = rgba(PAPER, 0.75); ctx.lineCap = 'round'; ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (let k = 0; k < 26; k++) {
    const span = X_MAX - X_MIN + 120;
    const x = X_MIN - 60 + (((hash2(k, 1, 77) * span + b * 26 - cam) % span) + span) % span;
    const y = 783 + hash2(k, 2, 77) * 12, L = 10 + hash2(k, 3, 77) * 22;
    ctx.moveTo(x, y); ctx.lineTo(x + L, y);
  }
  ctx.stroke();
  ctx.restore();
}
function paintFront(ctx, b, env) {
  const cut = cutAt(b);
  ctx.save();
  ctx.translate(0, -DROP * tiltAt(b));
  if (cut < 0.999) { ctx.globalAlpha = 1 - cut; drawStrip(ctx, fgLayer(), env.cam); ctx.globalAlpha = 1; }
  ctx.restore();
  drawRain(ctx, b);
  drawTeaSmoke(ctx, b, env);
}

// ======================================================================
// 第 3 小节的三个特写
// ======================================================================
// ---- 1. 樟木茶桌的横切面：23 圈茶色年轮，越来越密 ----
const DISC = { x: 520, y: 478, r: 392 };
function ringR(k) { return DISC.r * 0.95 * Math.pow(k / RINGS, 0.6); }
function ringPts(k) {
  return memo(`s03v2-ring-${k}`, () => {
    const r = ringR(k), pts = [];
    const n = 120;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU - Math.PI / 2;
      const rr = r * (1 + 0.035 * (fbm(Math.cos(a) * 1.4 + k * 0.13, Math.sin(a) * 1.4, 501, 3) - 0.5) * 2 + 0.012 * Math.sin(a * 3 + k));
      const off = 18 * (1 - k / RINGS); // 髓心略偏
      pts.push([DISC.x + off * 0.6 + Math.cos(a) * rr, DISC.y + off * 0.3 + Math.sin(a) * rr * 0.985]);
    }
    return pts;
  });
}
const ringT = (k) => T_RINGS[0] + (T_RINGS[1] - T_RINGS[0]) * Math.pow((k - 1) / (RINGS - 1), 0.62);
function discBase() {
  return baked('s03v2-disc', (X_MAX - X_MIN) * K, 1000 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-X_MIN, 0);
    ctx.drawImage(xuanPaper(Math.ceil((X_MAX - X_MIN) * K), Math.ceil(1000 * K), { seed: 3 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    // 四角淡淡的泼墨（避开左上标题卡、右下播放器）
    pomo(ctx, [[1080, -20], [1420, -20], [1420, 330], [1250, 260], [1130, 120]], { color: mix(INK.zhong, INK.huaqing, 0.2), light: INK.qing, alpha: 0.5, seed: 601, blobs: 8, px: PX, edge: 8, backrun: 2 });
    pomo(ctx, [[-420, 700], [-200, 760], [-80, 900], [-60, 1020], [-420, 1020]], { color: mix(INK.zhong, INK.huaqing, 0.2), light: INK.qing, alpha: 0.5, seed: 602, blobs: 8, px: PX, edge: 8, backrun: 2 });
    const { x, y, r } = DISC;
    // 投影
    ctx.save(); ctx.filter = `blur(${14 * PX}px)`; ctx.fillStyle = 'rgba(80,55,25,0.22)'; ctx.beginPath(); ctx.arc(x + 10, y + 16, r + 20, 0, TAU); ctx.fill(); ctx.restore();
    // 树皮：一圈浓淡不匀的枯笔
    ctx.save();
    ctx.fillStyle = mix(INK.zhong, TEA.deep, 0.35);
    ctx.fill(blobPath(x, y, r + 26, r + 24, { seed: 611, rough: 0.025, n: 90 }));
    ctx.restore();
    for (let k = 0; k < 7; k++) {
      const pts = [];
      for (let i = 0; i <= 90; i++) { const a = (i / 90) * TAU; const rr = r + 6 + k * 3 + (noise2(i * 0.4, k, 612) - 0.5) * 8; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      bristleStroke(ctx, pts, { width: 5, color: k % 2 ? INK.jiao : INK.nong, alpha: 0.7, bristles: 5, dry: 0.5, seed: 613 + k, spacing: 3, px: PX });
    }
    // 木面：淡茶色，中间亮
    const g = ctx.createRadialGradient(x, y, 10, x, y, r);
    g.addColorStop(0, mix(TEA.wash, '#fffaf0', 0.45)); g.addColorStop(0.75, TEA.wash); g.addColorStop(1, mix(TEA.wash, TEA.light, 0.6));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    // 细细的放射纹（木射线）
    ctx.strokeStyle = rgba(TEA.light, 0.35); ctx.lineWidth = 1;
    for (let k = 0; k < 140; k++) { const a = hash2(k, 1, 621) * TAU, r0 = hash2(k, 2, 621) * r * 0.6, L = 20 + hash2(k, 3, 621) * 70; ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * (r0 + L), y + Math.sin(a) * (r0 + L)); ctx.stroke(); }
    // 两道干裂
    for (const [a, L, sd] of [[-0.6, 0.55, 1], [2.4, 0.38, 2]]) {
      const pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; const rr = r * (1 - L * t); pts.push([x + Math.cos(a + (noise2(t * 3, sd, 631) - 0.5) * 0.06) * rr, y + Math.sin(a + (noise2(t * 3, sd, 631) - 0.5) * 0.06) * rr]); }
      bristleStroke(ctx, pts, { width: 5, color: INK.nong, alpha: 0.8, bristles: 4, dry: 0.2, seed: 640 + sd, taper: [1, 0.6, 0.05], px: PX });
    }
    ctx.strokeStyle = rgba(INK.nong, 0.85); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  });
}
function drawRings(ctx, b) {
  const k0 = 1 + 0.06 * clamp((b - T_RINGS[0]) / (T_RINGS[1] - T_RINGS[0] + 0.1)); // 缓缓推近
  ctx.save();
  ctx.translate(DISC.x, DISC.y); ctx.scale(k0, k0); ctx.translate(-DISC.x, -DISC.y);
  ctx.drawImage(discBase(), X_MIN, 0, X_MAX - X_MIN, 1000);
  // 髓心
  inkDot(ctx, DISC.x + 11, DISC.y + 5, 6, { color: TEA.deep, alpha: 0.9, seed: 650, bleed: 0.5 });
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let k = 1; k <= RINGS; k++) {
    const t0 = ringT(k);
    if (b < t0) break;
    const dur = Math.max(0.035, Math.min(0.24, (k < RINGS ? ringT(k + 1) - t0 : 0.06) * 0.92));
    const u = ease.out(clamp((b - t0) / dur));
    const P = ringPts(k), n = Math.max(2, Math.round(u * (P.length - 1)) + 1);
    // 晚材：外侧一道淡茶色宽带；年轮线：茶色湿笔
    const fresh = 1 - clamp((b - t0 - dur) / 0.35);
    ctx.strokeStyle = rgba(TEA.light, 0.45);
    ctx.lineWidth = Math.max(3, (ringR(k) - ringR(k - 1)) * 0.45);
    ctx.beginPath(); P.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.strokeStyle = rgba(fresh > 0 ? mix(TEA.tea, TEA.deep, 0.5 * fresh) : TEA.tea, 0.95);
    ctx.lineWidth = 3.2 + 1.6 * fresh;
    ctx.beginPath(); P.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    // 正在画的那一圈：笔头一点湿墨
    if (u < 1) { const [x, y] = P[n - 1]; inkDot(ctx, x, y, 5, { color: TEA.deep, alpha: 0.9, seed: k + 660, bleed: 0.6 }); }
  }
  ctx.restore();
}
// ---- 2. 他的脸：同一张站立帧放大、裁到脸，茶色暖光 + 水墨晕边 ----
const FACE = { x: 106, y: 0, w: 132, h: 156, k: 5 };
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
registerStyle('s03-face', (I) => {
  const C = cropUp(I, FACE);
  const W = C.w, H = C.h, n = W * H;
  const S = smoothColor(C, 3);
  const L = lumaArray(smoothColor(C, 1.6), 0.8);
  const E = sobel(L, W, H);
  const A = blur(C.a, W, H, 3);
  const O = { w: W, h: H, r: new Float32Array(n), g: new Float32Array(n), b: new Float32Array(n), a: new Float32Array(n) };
  // 连续的墨 → 茶 → 纸的色调（不分档，像一张淡彩水墨）
  const stops = ['#221d18', '#4a3e33', '#86684a', '#c9a77a', '#ecd9b8', '#fbf3e2'].map(rgbf);
  const warm = rgbf(TEA.glow), ink = rgbf('#1f1a15');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const a = smoothstep(0.25, 0.75, A[i]);
    if (a < 0.01) continue;
    const l0 = Math.min(0.9999, Math.max(0, 0.299 * S.r[i] + 0.587 * S.g[i] + 0.114 * S.b[i]));
    const l = Math.pow(l0, 0.85) * 5;
    const k = Math.floor(l), t = l - k;
    let c = [0, 1, 2].map((j) => stops[k][j] + (stops[k + 1][j] - stops[k][j]) * t);
    // 茶色暖光从右边来（亮部偏暖）
    const side = clamp((x / W - 0.3) / 0.7), lit = clamp(l / 5 - 0.3);
    c = c.map((v, j) => v + (warm[j] - v) * side * lit * 0.5);
    // 细墨线：五官、发丝、轮廓
    const e = smoothstep(0.12, 0.36, E[i]) * 0.72;
    c = c.map((v, j) => v + (ink[j] - v) * e);
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
    O.a[i] = a;
  }
  // 外轮廓一道淡墨（头发、脸颊）
  outline(O, O.a.slice(), 4, rgbf('#3a3128'));
  // 水墨晕边：下沿和两侧（衣服被裁断的地方）柔柔地化进纸里，边上带一点噪声
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (O.a[i] < 0.01) continue;
    const nz = (fbm(x * 0.012, y * 0.012, 33, 3) - 0.5) * 0.22;
    const fy = y / H, fx = Math.min(x, W - 1 - x) / W;
    let fade = 1 - smoothstep(0.56, 0.9, fy + nz);
    if (fy > 0.45) fade *= smoothstep(0.0, 0.2, fx + nz * 0.6);
    O.a[i] *= clamp(fade);
  }
  return O;
});
function faceBg() {
  return baked('s03v2-facebg', (X_MAX - X_MIN) * K, 1000 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-X_MIN, 0);
    ctx.drawImage(xuanPaper(Math.ceil((X_MAX - X_MIN) * K), Math.ceil(1000 * K), { seed: 5 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    // 茶色的光：一大团暖琥珀晕染在脸后（像灯光，也像一盏茶）
    ctx.save();
    ctx.filter = `blur(${40 * PX}px)`;
    ctx.fillStyle = rgba(TEA.glow, 0.75);
    ctx.beginPath(); ctx.arc(640, 420, 330, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(TEA.light, 0.45);
    ctx.beginPath(); ctx.arc(760, 380, 200, 0, TAU); ctx.fill();
    ctx.restore();
    // 左右两边的泼墨（水墨晕边）
    pomo(ctx, [[-420, -20], [-170, -20], [-90, 260], [-150, 620], [-230, 1020], [-420, 1020]], { color: mix(INK.zhong, INK.huaqing, 0.2), light: INK.qing, alpha: 0.55, seed: 701, blobs: 9, px: PX, edge: 10, backrun: 2 });
    pomo(ctx, [[1420, 120], [1200, 200], [1150, 420], [1260, 640], [1420, 700]], { color: mix(INK.zhong, TEA.deep, 0.25), light: TEA.wash, alpha: 0.5, seed: 702, blobs: 8, px: PX, edge: 10, backrun: 2 });
    splatter(ctx, -60, 820, 8, { color: INK.zhong, alpha: 0.6, seed: 703, count: 12 });
    splatter(ctx, 1180, 160, 6, { color: TEA.tea, alpha: 0.7, seed: 704, count: 10 });
  });
}
function drawFace(ctx, b) {
  ctx.drawImage(faceBg(), X_MIN, 0, X_MAX - X_MIN, 1000);
  const W = activeWalk();
  if (!W || !W.stand) return;
  const img = styledFrame(`${W.name}/stand`, W.stand, 's03-face');
  const u = clamp(b - T_FACE);
  const s = 6.6 * (1 + 0.035 * u);           // 每个源像素多少单位（缓缓推近）
  const fx = 172 - FACE.x;                    // 脸的中心（源像素，裁剪内）
  const cx = 540, top = 18 - u * 10;
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, cx - fx * s, top, FACE.w * s, FACE.h * s);
  ctx.restore();
}
// ---- 3. 爷爷长着老茧的手：手指一倒，茶汤落进清水，一缕缕晕开 ----
const BOWL = { x: 520, rimY: 500, rx: 300, ry: 40, bot: 905 };
const WATER_Y = 532;
const PINCH = [700, 360];                 // 拇指压住盏沿的那一点：手指一倒，茶盏绕它倾过去
const ARM_BOX = { x0: 520, x1: 1560, y0: -460, y1: 520 };
function handBg() {
  return baked('s03v2-handbg', (X_MAX - X_MIN) * K, 1000 * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-X_MIN, 0);
    ctx.drawImage(xuanPaper(Math.ceil((X_MAX - X_MIN) * K), Math.ceil(1000 * K), { seed: 7 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    ctx.save(); ctx.filter = `blur(${30 * PX}px)`; ctx.fillStyle = rgba(TEA.glow, 0.45); ctx.beginPath(); ctx.arc(1050, 260, 300, 0, TAU); ctx.fill(); ctx.restore();
    pomo(ctx, [[-420, 560], [-160, 640], [-110, 820], [-160, 1020], [-420, 1020]], { color: mix(INK.zhong, INK.huaqing, 0.2), light: INK.qing, alpha: 0.5, seed: 801, blobs: 8, px: PX, edge: 10, backrun: 2 });
    // 玻璃碗（后半圈）+ 清水
    const { x, rimY, rx, ry, bot } = BOWL;
    const body = new Path2D();
    body.moveTo(x - rx, rimY); body.bezierCurveTo(x - rx, rimY + 300, x - rx * 0.55, bot, x, bot); body.bezierCurveTo(x + rx * 0.55, bot, x + rx, rimY + 300, x + rx, rimY); body.closePath();
    ctx.save();
    ctx.clip(body);
    const wg = ctx.createLinearGradient(0, WATER_Y, 0, bot);
    wg.addColorStop(0, rgba(INK.huaqing, 0.1)); wg.addColorStop(1, rgba(INK.huaqing, 0.2));
    ctx.fillStyle = wg; ctx.fillRect(x - rx, WATER_Y, rx * 2, bot - WATER_Y);
    ctx.restore();
    ctx.strokeStyle = rgba(INK.zhong, 0.5); ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.ellipse(x, rimY, rx, ry, 0, Math.PI, TAU); ctx.stroke();
    ctx.strokeStyle = rgba(INK.huaqing, 0.45); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.ellipse(x, WATER_Y, rx * 0.985, ry * 0.9, 0, Math.PI, TAU); ctx.stroke();
  });
}
function bowlFront(ctx) {
  const { x, rimY, rx, ry, bot } = BOWL;
  ctx.save();
  ctx.strokeStyle = rgba(INK.zhong, 0.7); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(x, rimY, rx, ry, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = rgba(INK.huaqing, 0.5); ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.ellipse(x, WATER_Y, rx * 0.985, ry * 0.9, 0, 0, Math.PI); ctx.stroke();
  ctx.strokeStyle = rgba(INK.zhong, 0.7); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x - rx, rimY); ctx.bezierCurveTo(x - rx, rimY + 300, x - rx * 0.55, bot, x, bot); ctx.bezierCurveTo(x + rx * 0.55, bot, x + rx, rimY + 300, x + rx, rimY); ctx.stroke();
  // 玻璃的高光：两道留白
  ctx.strokeStyle = 'rgba(255,255,252,0.85)'; ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(x - rx + 34, rimY + 60); ctx.bezierCurveTo(x - rx + 40, rimY + 200, x - rx + 90, rimY + 320, x - rx + 150, rimY + 370); ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x + rx - 40, rimY + 70); ctx.bezierCurveTo(x + rx - 46, rimY + 150, x + rx - 70, rimY + 230, x + rx - 96, rimY + 280); ctx.stroke();
  // 碗底的影子
  ctx.fillStyle = 'rgba(80,60,30,0.12)'; ctx.beginPath(); ctx.ellipse(x, bot + 14, rx * 0.6, 14, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
/** 手 + 袖子 + 茶盏（画面坐标，未倾斜时的样子）。三龙护鼎的拿法：拇指、食指捏住盏沿，中指托着盏底。 */
function armImage() {
  const { x0, x1, y0, y1 } = ARM_BOX;
  return baked('s03v2-arm', (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-x0, -y0);
    const o = { px: PX };
    // 袖子（往右上伸出画面）
    const sl = poly([[800, 296], [858, 438], [1560, 150], [1560, -460], [1240, -460]]);
    ctx.fillStyle = ROBE_C; ctx.fill(sl);
    ctx.save(); ctx.clip(sl);
    for (let k = 0; k < 6; k++) bristleStroke(ctx, [[840 + k * 26, 330 + k * 8], [1400 + k * 30, -300 + k * 60]], { width: 4, color: k % 2 ? ROBE_DK : ROBE_L, alpha: 0.6, bristles: 3, dry: 0.45, seed: 860 + k, ...o });
    ctx.fillStyle = rgba(ROBE_DK, 0.4); ctx.fillRect(800, 250, 90, 200);
    ctx.restore();
    bristleStroke(ctx, [[800, 296], [1240, -460]], { width: 6, color: INK.jiao, alpha: 0.9, bristles: 7, dry: 0.3, seed: 871, ...o });
    bristleStroke(ctx, [[858, 438], [1560, 150]], { width: 6, color: INK.jiao, alpha: 0.9, bristles: 7, dry: 0.3, seed: 872, ...o });
    bristleStroke(ctx, [[796, 292], [826, 370], [860, 442]], { width: 9, color: INK.jiao, alpha: 0.9, bristles: 8, dry: 0.2, seed: 873, ...o });
    const finger = (pts, w, seed) => {
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const path = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); };
      ctx.strokeStyle = INK.nong; ctx.lineWidth = w + 6; path(); ctx.stroke();
      ctx.strokeStyle = SKIN; ctx.lineWidth = w; path(); ctx.stroke();
      ctx.translate(0, w * 0.22); ctx.strokeStyle = rgba(SKIN_D, 0.45); ctx.lineWidth = w * 0.35; path(); ctx.stroke(); // 下侧的暗面
      ctx.restore();
      // 指节的横纹
      for (let j = 1; j < pts.length - 1; j++) {
        const [x, y] = pts[j];
        for (let q = 0; q < 3; q++) bristleStroke(ctx, [[x - w * 0.3 + q * 2, y - w * 0.42 + q * 1.5], [x + w * 0.1 + q * 2, y - w * 0.46 + q * 1.5]], { width: 1.4, color: SKIN_D, alpha: 0.85, bristles: 2, seed: seed + j * 5 + q, ...o });
      }
    };
    const nail = (x, y, a, r) => { ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.fillStyle = mix(SKIN, '#ffffff', 0.4); ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.7, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = SKIN_D; ctx.lineWidth = 1.6; ctx.stroke(); ctx.restore(); };
    // 食指（在茶盏后面，指尖搭在盏沿上）
    finger([[716, 358], [682, 348], [656, 362]], 21, 880);
    // 茶盏：黑褐釉 + 盏口的茶汤
    const cp = pathQ([['M', 572, 372], ['Q', 574, 422, 604, 432], ['L', 636, 432], ['Q', 666, 422, 668, 372]]);
    const cg = ctx.createLinearGradient(572, 0, 668, 0);
    cg.addColorStop(0, '#3b2a1f'); cg.addColorStop(0.42, '#6a4c36'); cg.addColorStop(1, '#2a1d15');
    ctx.fillStyle = cg; ctx.fill(cp);
    ctx.strokeStyle = INK.jiao; ctx.lineWidth = 3; ctx.stroke(cp);
    ctx.fillStyle = '#2a1d15'; ctx.fillRect(606, 431, 28, 8);
    ctx.fillStyle = TEA.tea; ctx.beginPath(); ctx.ellipse(620, 373, 46, 8.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK.jiao; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.strokeStyle = rgba(TEA.glow, 0.8); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(612, 372, 22, 3, 0, Math.PI * 1.05, Math.PI * 1.7); ctx.stroke();
    ctx.strokeStyle = rgba(PAPER, 0.6); ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(586, 386); ctx.quadraticCurveTo(590, 408, 604, 420); ctx.stroke();
    // 手背
    const back = pathQ([['M', 822, 328], ['Q', 770, 322, 726, 344], ['Q', 698, 358, 700, 386], ['Q', 704, 414, 736, 430], ['Q', 792, 444, 840, 422]]);
    ctx.fillStyle = SKIN; ctx.fill(back);
    ctx.save(); ctx.clip(back); ctx.fillStyle = rgba(SKIN_D, 0.35); ctx.fill(blobPath(780, 432, 70, 22, { seed: 3, rough: 0.2 })); ctx.restore();
    bristleStroke(ctx, [[822, 328], [770, 322], [726, 344], [702, 366], [700, 386], [712, 412], [736, 430], [792, 444], [840, 422]], { width: 4, color: INK.nong, alpha: 0.9, bristles: 5, dry: 0.15, seed: 890, spacing: 2, ...o });
    // 无名指、小指（蜷着）
    finger([[730, 424], [714, 446], [728, 456]], 18, 900);
    finger([[750, 430], [744, 450], [756, 455]], 15, 910);
    // 中指托着盏底
    finger([[718, 410], [674, 436], [630, 446]], 21, 920);
    nail(632, 442, 0.15, 7);
    // 拇指压在盏沿上
    finger([[746, 400], [702, 402], [658, 386]], 25, 930);
    nail(662, 380, -0.4, 9);
    nail(660, 356, 0.6, 7); // 食指指甲
    // 老茧：拇指指肚、中指指侧、虎口一块块发黄发硬的厚皮，带细裂纹
    const callus = [[666, 394, 13, 8, -0.3], [644, 452, 13, 7, 0.1], [694, 396, 14, 9, 0], [726, 452, 9, 6, 0.4], [676, 344, 10, 6, -0.2]];
    for (const [k, [x, y, rx, ry, rot]] of callus.entries()) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.fillStyle = rgba(mix(TEA.light, '#ead48f', 0.45), 0.95);
      ctx.fill(blobPath(0, 0, rx, ry, { seed: 820 + k, rough: 0.3 }));
      ctx.strokeStyle = rgba(TEA.deep, 0.55); ctx.lineWidth = 1; ctx.stroke(blobPath(0, 0, rx, ry, { seed: 820 + k, rough: 0.3 }));
      ctx.strokeStyle = rgba(TEA.deep, 0.75); ctx.lineWidth = 1;
      for (let j = 0; j < 3; j++) { ctx.beginPath(); ctx.moveTo(-rx * 0.6, -ry * 0.4 + j * ry * 0.4); ctx.lineTo(rx * 0.5, -ry * 0.3 + j * ry * 0.35 + (hash2(k, j, 9) - 0.5) * 3); ctx.stroke(); }
      ctx.restore();
    }
    // 手背：青筋、老人斑、皱纹
    bristleStroke(ctx, [[820, 360], [786, 368], [752, 384], [722, 386]], { width: 3, color: mix(SKIN, INK.huaqing, 0.5), alpha: 0.8, bristles: 2, dry: 0.3, seed: 941, ...o });
    bristleStroke(ctx, [[826, 392], [790, 396], [756, 410]], { width: 2.4, color: mix(SKIN, INK.huaqing, 0.5), alpha: 0.7, bristles: 2, dry: 0.3, seed: 942, ...o });
    for (const [k, [x, y, r]] of [[790, 344, 6], [760, 358, 4], [806, 404, 5], [742, 412, 3.5], [772, 386, 3]].entries()) inkDot(ctx, x, y, r, { color: SKIN_D, alpha: 0.55, seed: 950 + k, bleed: 0.3 });
    for (let j = 0; j < 5; j++) bristleStroke(ctx, [[800 - j * 14, 338 + j * 4], [808 - j * 14, 352 + j * 4]], { width: 1.2, color: SKIN_D, alpha: 0.6, bristles: 2, seed: 960 + j, ...o });
  });
}
const tipAt = (b) => -0.62 * ease.inOut(clamp((b - T_TIP[0]) / (T_TIP[1] - T_TIP[0])));
const rotAbout = ([x, y], [cx, cy], a) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
/** 盏口（倒出茶的那一点）在画面上的位置。 */
const ARM_S = 1.38; // 特写里手再放大一点
const lipAt = (b) => rotAbout([PINCH[0] + (574 - 652) * ARM_S, PINCH[1] + (374 - 382) * ARM_S], PINCH, tipAt(b));
const ENTRY = () => [lipAt(T_TIP[1])[0] - 10, WATER_Y];
function drawPlume(ctx, b) {
  const t = b - (T_POUR[0] + 0.08);
  if (t <= 0) return;
  const E = ENTRY();
  ctx.save();
  // 碗里的清水一点点染上茶色
  const { x, rimY, rx, bot } = BOWL;
  const body = new Path2D();
  body.moveTo(x - rx, WATER_Y); body.lineTo(x + rx, WATER_Y); body.bezierCurveTo(x + rx, rimY + 300, x + rx * 0.55, bot, x, bot); body.bezierCurveTo(x - rx * 0.55, bot, x - rx, rimY + 300, x - rx, WATER_Y); body.closePath();
  ctx.clip(body);
  ctx.fillStyle = rgba(TEA.wash, 0.35 * clamp(t / 0.8));
  ctx.fill(body);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const D = 330 * ease.out(clamp(t / 0.75));
  for (let k = 0; k < 11; k++) {
    const ph = hash2(k, 1, 91) * TAU, amp = 18 + hash2(k, 2, 91) * 46, drift = (hash2(k, 3, 91) - 0.5) * 1.5;
    const dk = D * (0.55 + 0.45 * hash2(k, 4, 91));
    const pts = [];
    const N = 30;
    for (let i = 0; i <= N; i++) {
      const s = i / N, d = s * dk;
      pts.push([E[0] + drift * d + Math.sin(s * 5.2 + ph + t * 2.4) * amp * s + Math.sin(s * 13 + ph) * 6 * s, E[1] + 4 + d - Math.sin(s * 4 + ph) * 18 * s]);
    }
    for (const [w, c, al] of [[46, TEA.light, 0.14], [16, TEA.tea, 0.22], [3, TEA.deep, 0.4]]) {
      ctx.strokeStyle = rgba(c, al);
      ctx.lineWidth = w * (0.5 + 1.3 * t);
      ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py))); ctx.stroke();
    }
    // 末端卷起的一朵
    const [ex, ey] = pts[N];
    const rr = 40 + t * 40;
    ctx.globalAlpha = 0.3; ctx.drawImage(puff(TEA.tea), ex - rr, ey - rr, 2 * rr, 2 * rr); ctx.globalAlpha = 1;
  }
  ctx.restore();
  // 水面上一圈圈涟漪 + 茶色在水面摊开
  ctx.save();
  ctx.fillStyle = rgba(TEA.tea, 0.3 * (1 - clamp((t - 0.4) / 0.6) * 0.5));
  ctx.beginPath(); ctx.ellipse(E[0], E[1], 30 + t * 120, 5 + t * 14, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba(INK.huaqing, 0.6); ctx.lineWidth = 1.6;
  for (let k = 0; k < 3; k++) { const u = (t * 1.6 + k / 3) % 1; ctx.globalAlpha = 1 - u; ctx.beginPath(); ctx.ellipse(E[0], E[1], 20 + u * 200, 4 + u * 26, 0, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function drawHand(ctx, b) {
  ctx.drawImage(handBg(), X_MIN, 0, X_MAX - X_MIN, 1000);
  drawPlume(ctx, b);
  bowlFront(ctx);
  // 茶汤：从盏口落进水里
  if (b >= T_POUR[0] && b < T_POUR[1] + 0.3) {
    const L = lipAt(b), E = ENTRY();
    const p1 = [lerp(L[0], E[0], 0.7) - 6, lerp(L[1], E[1], 0.35)];
    const t1 = ease.in(clamp((b - T_POUR[0]) / 0.1));
    const t0 = b < T_POUR[1] ? 0 : ease.in(clamp((b - T_POUR[1]) / 0.25));
    inkStream(ctx, L, p1, E, t0, t1, { w0: 10, w1: 6, wobble: 1.5, phase: b, seed: 3, color: TEA.tea, alpha: 0.95 });
  }
  const { x0, x1, y0, y1 } = ARM_BOX;
  ctx.save();
  ctx.translate(PINCH[0], PINCH[1]); ctx.rotate(tipAt(b)); ctx.scale(ARM_S, ARM_S); ctx.translate(-652, -382); // 拇指压住盏沿的点（armImage 里在 652, 382）
  ctx.drawImage(armImage(), x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}
// ---- 推进：第 9 拍强拍，从全景推进到茶桌的横切面 ----
const PUSH_AT = [TABLE.x0 - 2, TABLE.top + TABLE.th / 2 - 4];
function drawPush(ctx, b, env) {
  const u = clamp((b - T_PUSH[0]) / (T_PUSH[1] - T_PUSH[0]));
  const Z = Math.exp(Math.log(18) * ease.in(u));
  const m = ease.inOut(u);
  const fx = lerp(PUSH_AT[0], DISC.x, m), fy = lerp(PUSH_AT[1], DISC.y, m);
  ctx.save();
  ctx.translate(fx, fy); ctx.scale(Z, Z); ctx.translate(-PUSH_AT[0], -PUSH_AT[1]);
  paintWide(ctx, b, env);
  ctx.save();
  ctx.translate(CHAR_X, ROAD_Y);
  drawWalker(ctx, { pose: 'stand', style: 'ink', rim: s03.figureRim });
  ctx.restore();
  paintFront(ctx, b, env);
  ctx.restore();
  const f = smoothstep(0.55, 1, u);
  if (f > 0) { ctx.save(); ctx.globalAlpha = f; drawRings(ctx, b); ctx.restore(); }
}
function drawCloseup(ctx, b, env) {
  if (b < T_PUSH[1]) drawPush(ctx, b, env);
  else if (b < T_FACE) drawRings(ctx, b);
  else if (b < T_HAND) drawFace(ctx, b);
  else drawHand(ctx, b);
}

// ======================================================================
// 播放器：水墨磁带（标签染一抹茶色）
// ======================================================================
function inkCassette(ctx, cx, cy, s, spin) {
  const w = 200 * s, h = 128 * s;
  const body = baked(`s03v2-cassette|${Math.round(w)}`, (w + 40), (h + 40), (c) => {
    c.translate(20 + w / 2, 20 + h / 2);
    c.save();
    c.shadowColor = 'rgba(60,45,25,0.22)'; c.shadowBlur = 12; c.shadowOffsetY = 4;
    c.fillStyle = PAPER;
    c.fill(blobPath(0, 0, w / 2 + 2, h / 2 + 2, { seed: 5, rough: 0.012, n: 60 }));
    c.restore();
    const rect = (x0, y0, x1, y1, o) => bristleStroke(c, [[x0, y0], [x1, y0 + 1], [x1 - 1, y1], [x0 + 1, y1 - 1], [x0, y0 + 2]], o);
    rect(-w / 2 + 4, -h / 2 + 4, w / 2 - 4, h / 2 - 4, { width: 4.5, color: INK.jiao, alpha: 0.9, bristles: 7, dry: 0.35, seed: 11, spacing: 1.6, taper: [1, 0.9, 0.7] });
    c.save(); c.fillStyle = rgba(TEA.light, 0.45); c.fill(blobPath(0, -h / 2 + 46, w / 2 - 20, 30, { seed: 7, rough: 0.05 })); c.restore();
    rect(-w / 2 + 16, -h / 2 + 14, w / 2 - 16, -h / 2 + 78, { width: 2.6, color: INK.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 12, spacing: 1.6 });
    sealStamp(c, w / 2 - 30, -h / 2 + 28, 18, { seed: 5 });
    c.save(); c.fillStyle = PAPER; c.fill(blobPath(0, -h / 2 + 51, 50, 15, { seed: 8, rough: 0.03 })); c.restore();
    bristleStroke(c, [[-50, -h / 2 + 36], [50, -h / 2 + 36], [52, -h / 2 + 66], [-50, -h / 2 + 66], [-50, -h / 2 + 37]], { width: 2.4, color: INK.nong, alpha: 0.85, bristles: 3, seed: 13, spacing: 1.6 });
    bristleStroke(c, [[-60, h / 2 - 4], [-48, h / 2 - 30], [48, h / 2 - 30], [60, h / 2 - 4]], { width: 3, color: INK.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 14, spacing: 1.6 });
    for (const sx of [-1, 1]) inkDot(c, sx * 30, h / 2 - 15, 4.5, { color: INK.jiao, seed: 15 + sx, bleed: 0.2 });
  });
  ctx.drawImage(body, cx - w / 2 - 20, cy - h / 2 - 20);
  for (const sx of [-1, 1]) {
    const rx = cx + sx * 34 * s, ry = cy - h / 2 + 51 * s;
    ctx.save();
    ctx.fillStyle = rgba(TEA.deep, 0.85);
    ctx.beginPath(); ctx.arc(rx, ry, (sx < 0 ? 15 : 11) * s, 0, TAU); ctx.fill();
    ctx.fillStyle = PAPER;
    ctx.beginPath(); ctx.arc(rx, ry, 8 * s, 0, TAU); ctx.fill();
    ctx.translate(rx, ry); ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
    ctx.strokeStyle = INK.jiao; ctx.lineWidth = 2.4 * s; ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { ctx.rotate(Math.PI / 3); ctx.beginPath(); ctx.moveTo(0, -3 * s); ctx.lineTo(0, -7.5 * s); ctx.stroke(); }
    ctx.restore();
  }
}

export const s03 = {
  id: 's03',
  station: ST,
  figureStyle: 'ink',
  // 人物（墨色）走过泼墨山坡、檐下时：一圈宣纸色留白边，保证轮廓反差
  figureRim: { color: '#f7f3e8', width: 5, alpha: 0.95 },
  freezeBeat: GAG + 5.1, // Outro 展墙：第 4 小节，爷爷竖指噤声、茶色已晕开、远处茶人牵马走进风沙
  figureAdjust(b) {
    if (b >= GAG && b < T_WIDE) return { hidden: true }; // 第 3 小节是特写（推进时在场景里自己画他）
    const t = tiltAt(b);
    if (t > 0) return { dy: -DROP * t };
    return null;
  },
  drawBack(ctx, b, env) {
    if (b >= GAG && b < T_WIDE) { drawCloseup(ctx, b, env); return; }
    paintWide(ctx, b, env);
  },
  drawFront(ctx, b, env) {
    if (b >= GAG && b < T_WIDE) return;
    paintFront(ctx, b, env);
  },
  drawFrame(ctx, R) {
    handscrollFrame(ctx, R, { silk: '#e8dcc0', silkDark: '#d6c39c', wood: '#5a3b22' });
  },
  cardStyle: {
    ink: INK.jiao, accent: INK.seal, bar: false,
    bgDraw(ctx, x, y, w, h) {
      const { canvas, pad } = paperCard(w, h, { seed: 31, sealSize: 44, key: 's03-card' });
      ctx.drawImage(canvas, x - pad, y - pad);
    },
  },
  playerStyle: {
    ink: INK.jiao, noteColor: INK.seal, backdrop: false,
    plateDraw(ctx, x, y, w, h) {
      const { canvas, pad } = paperCard(w, h, { seed: 41, seal: false, key: 's03-plate' });
      ctx.drawImage(canvas, x - pad, y - pad);
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) { inkCassette(ctx, cx, cy, s, spin); },
  },
};
