// 第 3 站 · 八度空间（The Eight Dimensions, 2002）·「爷爷泡的茶」· 山间茶棚 · 水墨
// 宣纸留白为主：远山淡墨层层晕染、化进雾里；中景山坡披麻皴、苔点、松；近处石、竹、草用枯笔；山路淡赭石。
// 原创配角：茶棚里的老人（小发髻、白长眉、白胡子、宽袖布衣），手提一把提梁壶。
// 梗：第 6–8 拍老人把壶高高举起；第 9 拍强拍茶水落地——落下来的是一道墨线，溅起墨点；
//     墨线沿地面流到定格的他脚下（第 10.5 拍），再从落点向右一路铺出画面；桌上的茶杯始终是空的。
//     第 13–16 拍他踩着这道墨线走向下一道画框（卷轴裱框），每一步脚下溅起几个小墨点。
// 水墨共用渲染在 kit/ink.js（第 3 站建立，其他站可复用）。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { fbm, noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, keyframes } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import {
  INK, xuanPaper, bristleStroke, inkDot, mossDots, mountain, mistBand, pine, bamboo, grassTuft, rock,
  inkRibbon, inkStream, quadAt, blobPath, washShape, sealStamp, paperCard, handscrollFrame, bambooLeaf,
} from '../kit/ink.js';

const ST = stationByN(3);
const PX = K; // 烘焙时每单位的像素数（blur 半径换算用）
const P_SKY = 0.03, P_FAR1 = 0.1, P_FAR2 = 0.2, P_MIST = 0.3, P_MID = 0.45, P_NEAR = 0.8, P_FG = 1.3;

// ---------- 梗的布景：定格时（第 9–12 拍）在画面上的位置（单位） ----------
const TABLE = { x0: 585, x1: 800, top: 668 };   // 矮茶桌
const MAN_X = 852;                                // 老人脚下
const MAN_BASE = 792;                             // 老人、茶棚站在路后沿
const LAND_X = 496;                               // 墨流落地点
const LINE_L = CHAR_X - 96;                       // 墨线左端（他脚后跟后面一点）
const CUP_X = 640;                                // 空茶杯
const SHED = { x0: 500, x1: 1090, eave: 432 };    // 茶棚
const FLAG_X = 1150;                              // 茶旗竿

// ---------- 时间点（段内拍位） ----------
const T_LIFT = [GAG - 3.2, GAG - 1.4];   // 第 5.8–7.6 拍：把壶举高
const T_TILT = [GAG - 0.75, GAG - 0.45]; // 壶身一倾
const T_SPOUT = GAG - 0.5;               // 墨从壶嘴流出
const T_LAND = GAG;                      // 第 9 拍（第 3 小节强拍）落地
const T_FEET = GAG + 1.5;                // 第 10.5 拍：流到他脚下
const T_AHEAD = [GAG + 0.9, GAG + 3];    // 向右铺出画面
const T_STOP = GAG + 3.1;                // 收壶：墨流断开、尾巴落下
const T_REST = [GAG + 3.3, GAG + 4.1];   // 壶放回桌上
const T_NOD = [GAG + 4.1, GAG + 4.9];    // 点头

const R0 = (k) => rng('s03', k);
const lineY = (x) => ROAD_Y + 11 + Math.sin(x / 131) * 4.5 + (fbm(x / 190, 0.4, 33, 3) - 0.5) * 12;

// ---------- 天空、远山 ----------
function skyLayer() {
  return strip('s03-sky', P_SKY, (ctx, x0, x1) => {
    // 一枚很淡的赭石日轮（右上）
    ctx.save();
    ctx.filter = `blur(${6 * PX}px)`;
    ctx.fillStyle = rgba('#e7c39a', 0.42);
    ctx.beginPath(); ctx.arc(1130, 150, 62, 0, Math.PI * 2); ctx.fill();
    ctx.filter = 'none';
    ctx.restore();
  }, { y0: 40, y1: 300 });
}
function far1Layer() {
  return strip('s03-far1', P_FAR1, (ctx, x0, x1) => {
    mountain(ctx, x0, x1, { base: 600, height: 330, color: mix(INK.qing, INK.huaqing, 0.35), alpha: 0.75, fadeY: 600, seed: 11, peaks: 2.4, layers: 2, px: PX, blur: 4, steep: 1.3 });
  }, { y0: 160, y1: 660 });
}
function far2Layer() {
  return strip('s03-far2', P_FAR2, (ctx, x0, x1) => {
    const top = mountain(ctx, x0, x1, { base: 660, height: 250, color: mix(INK.dan, INK.huaqing, 0.3), alpha: 0.72, fadeY: 650, seed: 23, peaks: 3.2, layers: 3, px: PX, blur: 3, steep: 1.5 });
    // 远处山顶几棵小松（只是几个墨点）
    const R = R0('far2pine');
    for (let i = 8; i < top.length - 8; i += 9) {
      const [x, y] = top[i];
      if (y < top[i - 6][1] && y < top[i + 6][1] && R() < 0.7) for (let k = 0; k < 3; k++) inkDot(ctx, x - 8 + k * 8 + R() * 4, y - 4 - R() * 6, 3 + R() * 2, { ry: 5 + R() * 3, color: mix(INK.zhong, INK.huaqing, 0.25), alpha: 0.75, seed: i * 3 + k, bleed: 0.3 });
    }
  }, { y0: 300, y1: 700 });
}
function mistLayer() {
  // 漂移的雾团（纸色），盖住远山山脚
  return strip('s03-mist', P_MIST, (ctx, x0, x1) => {
    mistBand(ctx, x0, x1, 650, 90, { alpha: 0.9 });
    ctx.save();
    ctx.filter = `blur(${10 * PX}px)`;
    ctx.fillStyle = rgba(INK.paper, 0.85);
    const R = R0('mist');
    for (let x = x0; x < x1; x += 160 + R() * 220) ctx.fill(blobPath(x, 600 + R() * 50, 120 + R() * 140, 18 + R() * 16, { seed: x, rough: 0.3 }));
    ctx.restore();
  }, { y0: 520, y1: 720 });
}

// ---------- 中景山坡 ----------
function midLayer(cg) {
  return strip('s03-mid', P_MID, (ctx, x0, x1) => {
    const color = mix(INK.zhong, INK.huaqing, 0.12);
    const top = mountain(ctx, x0, x1, { base: 760, height: 210, color, alpha: 0.62, fadeY: 760, seed: 37, peaks: 2.6, layers: 3, px: PX, blur: 2.2, steep: 1.9, cun: 2.6, moss: 0.3, rough: 0.25 });
    // 坡顶的松
    const R = R0('midpine');
    for (let i = 12; i < top.length - 12; i += 6) {
      const [x, y] = top[i];
      const sx = x - cg * P_MID;
      if (sx > 150 && sx < 470) continue; // 定格时他身后留白
      if (y <= top[i - 10][1] && y <= top[i + 10][1] && R() < 0.85) pine(ctx, x + (R() - 0.5) * 20, y + 6, 70 + R() * 50, { seed: i, color: INK.nong, alpha: 0.82, lean: (R() - 0.5) * 0.4, px: PX });
    }
    mistBand(ctx, x0, x1, 772, 70, { alpha: 0.8 });
  }, { y0: 420, y1: 810 });
}

// ---------- 近坡：石、竹、草 ----------
function nearLayer(cg) {
  return strip('s03-near', P_NEAR, (ctx, x0, x1) => {
    const R = R0('near');
    // 低矮的土坡：一层很淡的赭石 + 淡墨晕染
    const pts = [];
    for (let x = x0; x <= x1; x += 8) pts.push([x, 742 - 26 * fbm(x / 210, 0.2, 51, 3) - 14 * Math.sin(x / 330)]);
    washShape(ctx, [...pts, [x1, 805], [x0, 805]], { color: mix(INK.zheshi, INK.dan, 0.4), alpha: 0.35, fadeY: 805, blur: 3, edge: 0.4, px: PX });
    bristleStroke(ctx, pts.filter((_, i) => i % 3 === 0), { width: 3.5, color: INK.zhong, alpha: 0.55, bristles: 6, dry: 0.55, seed: 52, px: PX, spacing: 3 });
    // 石头、竹丛、草丛（定格时他身后 150–470 留白，茶棚背后另有竹子）
    for (let x = x0 + 80; x < x1; x += 260 + R() * 320) {
      const sx = x - cg * P_NEAR;
      if (sx > 120 && sx < 1120) continue;
      const kind = R();
      if (kind < 0.35) rock(ctx, x, 798, 80 + R() * 70, 46 + R() * 34, { seed: Math.round(x), color: INK.zhong, px: PX });
      else if (kind < 0.7) bamboo(ctx, x, 796, 240 + R() * 120, { seed: Math.round(x), color: INK.nong, alpha: 0.75, stems: 2 + Math.floor(R() * 2), px: PX });
      else { grassTuft(ctx, x, 798, 40 + R() * 30, { seed: Math.round(x), px: PX }); rock(ctx, x + 50, 798, 50, 26, { seed: Math.round(x) + 1, px: PX }); }
    }
    for (let x = x0; x < x1; x += 170 + R() * 260) grassTuft(ctx, x, 800, 22 + R() * 22, { seed: Math.round(x) + 7, color: INK.zhong, alpha: 0.6, blades: 4 + Math.floor(R() * 3), px: PX });
  }, { y0: 480, y1: 812 });
}

// ---------- 山路 ----------
function roadLayer() {
  return strip('s03-road', 1, (ctx, x0, x1) => {
    // 淡赭石的路面：上沿稍浓，往下化开
    const g = ctx.createLinearGradient(0, ROAD_Y, 0, 1000);
    g.addColorStop(0, rgba(INK.zheshi, 0.42)); g.addColorStop(0.35, rgba(INK.zheshi, 0.16)); g.addColorStop(1, rgba(INK.zheshi, 0.05));
    ctx.fillStyle = g;
    ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1000 - ROAD_Y + 2);
    const R = R0('road');
    // 路的上沿：断续的枯笔
    for (let x = x0; x < x1;) {
      const L = 120 + R() * 260;
      const pts = [];
      for (let u = 0; u <= L; u += 20) pts.push([x + u, ROAD_Y + 1 + Math.sin((x + u) / 47) * 1.5]);
      bristleStroke(ctx, pts, { width: 3.4, color: INK.zhong, alpha: 0.55, bristles: 6, dry: 0.55, seed: Math.round(x), taper: [0.7, 1, 0.3], px: PX });
      x += L + 20 + R() * 60;
    }
    // 路面上横向的几笔干皴（路的纹理）
    for (let x = x0; x < x1; x += 70 + R() * 130) {
      const y = ROAD_Y + 30 + R() * 160, L = 40 + R() * 110;
      bristleStroke(ctx, [[x, y], [x + L * 0.5, y + (R() - 0.5) * 4], [x + L, y + (R() - 0.5) * 6]], { width: 3 + R() * 3, color: INK.dan, alpha: 0.45, bristles: 5, dry: 0.65, seed: Math.round(x) + 3, taper: [0.8, 1, 0.1], px: PX });
    }
    // 小石子
    for (let x = x0; x < x1; x += 40 + R() * 90) inkDot(ctx, x, ROAD_Y + 20 + R() * 170, 2 + R() * 3.5, { ry: 1.4 + R() * 2, color: INK.zhong, alpha: 0.6, seed: Math.round(x), bleed: 0.2 });
    // 下沿：一道很淡的路边
    for (let x = x0; x < x1; x += 300) bristleStroke(ctx, [[x, 975], [x + 140, 972], [x + 290, 976]], { width: 4, color: INK.dan, alpha: 0.35, bristles: 5, dry: 0.6, seed: Math.round(x) + 9, px: PX });
  }, { y0: ROAD_Y - 6, y1: 1000 });
}

// ---------- 茶棚（定格时的画面坐标作画，烘焙成一张图） ----------
const SHED_BOX = { x0: 440, x1: 1290, y0: 200, y1: 812 };
function shedImage(part) {
  const { x0, x1, y0, y1 } = SHED_BOX;
  return baked(`s03-shed-${part}`, (x1 - x0) * K, (y1 - y0) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-x0, -y0);
    if (part === 'back') shedBack(ctx); else shedFront(ctx);
  });
}
function shedBack(ctx) {
  const o = { px: PX };
  // 茶棚背后的一丛竹子
  bamboo(ctx, 1040, MAN_BASE - 10, 380, { seed: 301, color: mix(INK.zhong, INK.huaqing, 0.15), alpha: 0.6, stems: 3, ...o });
  bamboo(ctx, 560, MAN_BASE - 10, 300, { seed: 307, color: mix(INK.dan, INK.huaqing, 0.2), alpha: 0.55, stems: 2, ...o });
  // 后排竹竿
  for (const x of [600, 1010]) bristleStroke(ctx, [[x, MAN_BASE - 14], [x + 2, SHED.eave - 40]], { width: 9, color: INK.zhong, alpha: 0.65, bristles: 6, dry: 0.25, seed: x, taper: [1, 0.9, 1], ...o });
  // 地面：棚下一块淡墨
  ctx.save();
  ctx.filter = `blur(${4 * PX}px)`;
  ctx.fillStyle = rgba(INK.dan, 0.25);
  ctx.fill(blobPath(800, MAN_BASE + 4, 300, 12, { seed: 3, rough: 0.2 }));
  ctx.restore();
  // 风炉 + 小陶壶（右边），热气每帧画
  const sx = 965;
  const stove = [[sx - 34, MAN_BASE], [sx - 28, MAN_BASE - 92], [sx + 28, MAN_BASE - 92], [sx + 34, MAN_BASE]];
  washShape(ctx, [...stove], { color: mix(INK.zheshi, INK.zhong, 0.35), alpha: 0.55, blur: 1, edge: 0, ...o });
  bristleStroke(ctx, stove, { width: 4, color: INK.nong, alpha: 0.85, bristles: 6, dry: 0.35, seed: 41, ...o });
  ctx.save(); ctx.filter = `blur(${5 * PX}px)`; ctx.fillStyle = rgba('#d9824e', 0.55); ctx.beginPath(); ctx.ellipse(sx, MAN_BASE - 38, 13, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); // 炉口的火光（淡朱）
  bristleStroke(ctx, [[sx - 16, MAN_BASE - 40], [sx + 16, MAN_BASE - 40]], { width: 3, color: INK.nong, alpha: 0.7, bristles: 3, ...o });
  inkDot(ctx, sx, MAN_BASE - 112, 26, { ry: 20, color: mix(INK.zhong, INK.zheshi, 0.25), alpha: 0.85, seed: 5, bleed: 0.2, rough: 0.08 });
  bristleStroke(ctx, [[sx - 8, MAN_BASE - 132], [sx + 8, MAN_BASE - 132]], { width: 5, color: INK.jiao, alpha: 0.9, bristles: 3, ...o });
  // 小板凳（左边，给路人坐的）
  bristleStroke(ctx, [[520, MAN_BASE - 46], [575, MAN_BASE - 48]], { width: 7, color: INK.nong, alpha: 0.8, bristles: 6, dry: 0.3, seed: 61, ...o });
  for (const x of [527, 567]) bristleStroke(ctx, [[x, MAN_BASE - 44], [x + (x < 540 ? -3 : 3), MAN_BASE]], { width: 4, color: INK.nong, alpha: 0.8, bristles: 4, seed: x, ...o });
}
function shedFront(ctx) {
  const o = { px: PX };
  // 前排竹竿
  for (const x of [SHED.x0 + 14, SHED.x1 - 18]) {
    bristleStroke(ctx, [[x, ROAD_Y - 4], [x - 2, SHED.eave - 30]], { width: 12, color: INK.nong, alpha: 0.85, bristles: 8, dry: 0.3, seed: x + 1, taper: [1.1, 0.9, 1], ...o });
    for (let y = ROAD_Y - 90; y > SHED.eave; y -= 92) bristleStroke(ctx, [[x - 8, y], [x + 7, y - 2]], { width: 2.5, color: INK.jiao, alpha: 0.85, bristles: 2, ...o });
  }
  // 茅草顶：一片斜坡，枯笔一束一束往下刷
  const roof = [[SHED.x0 - 60, SHED.eave + 6], [SHED.x0 + 70, SHED.eave - 120], [SHED.x1 - 40, SHED.eave - 150], [SHED.x1 + 70, SHED.eave - 8]];
  const roofPts = [...roof, [SHED.x1 + 50, SHED.eave + 8], [SHED.x0 - 40, SHED.eave + 18]];
  washShape(ctx, roofPts, { color: mix(INK.zheshi, INK.dan, 0.55), alpha: 0.5, top: SHED.eave - 150, fadeY: SHED.eave + 40, blur: 1.5, edge: 0, ...o });
  const R = R0('thatch');
  for (let k = 0; k < 70; k++) {
    const u = R();
    const tx = lerp(roof[1][0], roof[2][0], u), ty = lerp(roof[1][1], roof[2][1], u);
    const bx = lerp(SHED.x0 - 50, SHED.x1 + 60, u) + (R() - 0.5) * 30, by = SHED.eave + 6 + R() * 16;
    const s = 0.1 + R() * 0.25;
    bristleStroke(ctx, [[lerp(tx, bx, s), lerp(ty, by, s)], [lerp(tx, bx, 0.6) + (R() - 0.5) * 10, lerp(ty, by, 0.6)], [bx, by]], { width: 5 + R() * 6, color: R() < 0.3 ? INK.nong : INK.zhong, alpha: 0.5 + R() * 0.35, bristles: 6, dry: 0.5, seed: k + 400, taper: [0.5, 1, 0.3], ...o });
  }
  // 屋脊：一道浓墨
  bristleStroke(ctx, [roof[1], [lerp(roof[1][0], roof[2][0], 0.5), lerp(roof[1][1], roof[2][1], 0.5) - 6], roof[2]], { width: 10, color: INK.jiao, alpha: 0.85, bristles: 9, dry: 0.35, seed: 71, taper: [0.6, 1, 0.5], ...o });
  // 檐口：一根横竹
  bristleStroke(ctx, [[SHED.x0 - 30, SHED.eave + 10], [SHED.x1 + 40, SHED.eave + 2]], { width: 7, color: INK.nong, alpha: 0.85, bristles: 7, dry: 0.25, seed: 73, ...o });
  // 矮茶桌：桌面 + 桌裙 + 两条腿
  const { x0, x1, top } = TABLE;
  const slab = [[x0 - 8, top], [x1 + 8, top - 2], [x1 + 6, top + 14], [x0 - 6, top + 15]];
  washShape(ctx, slab, { color: mix(INK.zheshi, INK.zhong, 0.5), alpha: 0.75, blur: 0.8, edge: 0, ...o });
  bristleStroke(ctx, [[x0 - 8, top], [x1 + 8, top - 2]], { width: 4.5, color: INK.jiao, alpha: 0.9, bristles: 7, dry: 0.25, seed: 81, ...o });
  bristleStroke(ctx, [[x0 - 6, top + 15], [x1 + 6, top + 14]], { width: 3, color: INK.nong, alpha: 0.8, bristles: 5, dry: 0.3, seed: 82, ...o });
  for (const x of [x0 + 14, x1 - 14]) bristleStroke(ctx, [[x, top + 14], [x + (x < 700 ? -5 : 5), MAN_BASE + 2]], { width: 9, color: INK.nong, alpha: 0.85, bristles: 6, dry: 0.3, seed: x + 7, taper: [1, 0.9, 0.8], ...o });
  // 桌裙：淡墨一抹
  washShape(ctx, [[x0 + 22, top + 15], [x1 - 22, top + 15], [x1 - 26, top + 52], [x0 + 26, top + 52]], { color: INK.dan, alpha: 0.3, blur: 1.2, edge: 0, ...o });
  // 空茶杯 + 托
  const cy = top - 1;
  inkDot(ctx, CUP_X, cy, 17, { ry: 3.5, color: INK.dan, alpha: 0.6, seed: 91, bleed: 0.2, rough: 0.05 });
  const cup = [[CUP_X - 14, cy - 26], [CUP_X + 14, cy - 26], [CUP_X + 9, cy - 3], [CUP_X - 9, cy - 3]];
  washShape(ctx, cup, { color: INK.paper, alpha: 1, blur: 0, edge: 0, ...o });
  bristleStroke(ctx, [cup[0], cup[3], cup[2], cup[1]], { width: 2.6, color: INK.nong, alpha: 0.9, bristles: 3, dry: 0.1, seed: 92, ...o });
  ctx.save(); ctx.strokeStyle = INK.nong; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.ellipse(CUP_X, cy - 26, 14, 3.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  // 第二只杯子，倒扣着
  const c2 = CUP_X + 46;
  washShape(ctx, [[c2 - 9, cy - 22], [c2 + 9, cy - 22], [c2 + 13, cy - 2], [c2 - 13, cy - 2]], { color: INK.qing, alpha: 0.8, blur: 0, edge: 0, ...o });
  bristleStroke(ctx, [[c2 - 13, cy - 2], [c2 - 9, cy - 22], [c2 + 9, cy - 22], [c2 + 13, cy - 2]], { width: 2.4, color: INK.nong, alpha: 0.85, bristles: 3, seed: 93, ...o });
}

// ---------- 老人（原创，面朝左；局部坐标原点在脚下） ----------
const SHOULDER = [-14, -246];
const UPPER = 72, FORE = 72;
const ROBE = '#d6d1c4';
function manBody() {
  const w = 220, h = 380; // 单位
  return baked('s03-man', w * K, h * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(110, 370);
    const o = { px: PX };
    // 远侧的手臂（垂在身后，只露一截袖子）
    washShape(ctx, [[18, -236], [40, -230], [44, -150], [24, -146]], { color: mix(ROBE, INK.dan, 0.5), alpha: 0.9, blur: 0.6, edge: 0, ...o });
    // 布袍：微驼背，宽下摆
    const robe = [[-30, -258], [6, -264], [34, -252], [56, -214], [62, -150], [60, -60], [66, 0], [-52, 0], [-50, -80], [-48, -170], [-40, -236]];
    washShape(ctx, robe, { color: ROBE, alpha: 0.95, top: -264, fadeY: 30, blur: 0.8, edge: 0, ...o });
    ctx.save(); ctx.globalAlpha = 0.5; washShape(ctx, robe.slice(2, 7).concat([[30, -40], [20, -200]]), { color: INK.dan, alpha: 0.55, blur: 2.5, edge: 0, ...o }); ctx.restore();
    // 衣纹：几笔浓淡不一的长线
    bristleStroke(ctx, [[6, -264], [34, -252], [56, -214], [62, -150], [60, -60], [66, 0]], { width: 5.5, color: INK.nong, alpha: 0.85, bristles: 7, dry: 0.3, seed: 201, taper: [0.8, 1, 0.5], ...o });
    bristleStroke(ctx, [[-40, -236], [-48, -170], [-50, -80], [-52, 0]], { width: 5, color: INK.nong, alpha: 0.85, bristles: 7, dry: 0.35, seed: 202, taper: [0.9, 1, 0.4], ...o });
    bristleStroke(ctx, [[10, -140], [14, -80], [8, -20]], { width: 3, color: INK.zhong, alpha: 0.6, bristles: 4, dry: 0.5, seed: 203, ...o });
    bristleStroke(ctx, [[-20, -130], [-24, -70]], { width: 2.6, color: INK.zhong, alpha: 0.5, bristles: 4, dry: 0.5, seed: 204, ...o });
    // 交领
    bristleStroke(ctx, [[-30, -256], [-6, -214], [8, -206]], { width: 4, color: INK.nong, alpha: 0.85, bristles: 5, dry: 0.2, seed: 205, ...o });
    // 腰带：浓墨一笔 + 垂下的带头
    bristleStroke(ctx, [[-50, -158], [6, -152], [60, -158]], { width: 14, color: INK.jiao, alpha: 0.9, bristles: 9, dry: 0.25, seed: 206, taper: [1, 1, 0.9], ...o });
    bristleStroke(ctx, [[-30, -150], [-36, -110], [-32, -92]], { width: 6, color: INK.nong, alpha: 0.85, bristles: 5, dry: 0.3, seed: 207, taper: [1, 0.8, 0.4], ...o });
    // 头：淡赭石的脸
    const hx = -22, hy = -298;
    ctx.save();
    ctx.fillStyle = mix(INK.paper, INK.zheshi, 0.45);
    ctx.fill(blobPath(hx, hy, 29, 33, { seed: 3, rough: 0.05 }));
    // 后脑勺一点灰发
    ctx.fillStyle = rgba(INK.dan, 0.7);
    ctx.fill(blobPath(hx + 16, hy - 4, 15, 27, { seed: 4, rough: 0.12 }));
    ctx.restore();
    bristleStroke(ctx, [[hx - 10, hy - 32], [hx + 14, hy - 33], [hx + 28, hy - 14], [hx + 27, hy + 12], [hx + 14, hy + 30]], { width: 3.4, color: INK.nong, alpha: 0.9, bristles: 4, dry: 0.15, seed: 211, ...o });
    bristleStroke(ctx, [[hx - 10, hy - 32], [hx - 26, hy - 20], [hx - 30, hy - 6]], { width: 3, color: INK.nong, alpha: 0.9, bristles: 4, dry: 0.15, seed: 212, ...o });
    // 鼻子（鹰钩一点）
    bristleStroke(ctx, [[hx - 29, hy - 6], [hx - 37, hy + 5], [hx - 27, hy + 8]], { width: 3, color: INK.nong, alpha: 0.9, bristles: 3, seed: 213, ...o });
    // 发髻 + 簪子
    inkDot(ctx, hx + 6, hy - 40, 11, { ry: 9, color: INK.jiao, alpha: 0.9, seed: 214, bleed: 0.25 });
    bristleStroke(ctx, [[hx - 12, hy - 36], [hx + 24, hy - 46]], { width: 2.4, color: mix(INK.zheshi, INK.nong, 0.5), alpha: 0.9, bristles: 2, ...o });
    // 耳朵
    bristleStroke(ctx, [[hx + 6, hy - 6], [hx + 12, hy - 2], [hx + 10, hy + 8], [hx + 5, hy + 9]], { width: 2.2, color: INK.nong, alpha: 0.8, bristles: 3, ...o });
    // 闭着眼笑：一道弯
    bristleStroke(ctx, [[hx - 22, hy - 6], [hx - 16, hy - 10], [hx - 10, hy - 6]], { width: 2.6, color: INK.jiao, alpha: 0.95, bristles: 3, ...o });
    // 白长眉：从眉骨垂下来（纸色 + 淡墨边）
    ctx.save();
    ctx.fillStyle = INK.paper;
    const brow = new Path2D(); brow.moveTo(hx - 6, hy - 18); brow.quadraticCurveTo(hx - 30, hy - 22, hx - 44, hy + 2); brow.quadraticCurveTo(hx - 30, hy - 12, hx - 8, hy - 12); brow.closePath();
    ctx.fill(brow);
    ctx.restore();
    bristleStroke(ctx, [[hx - 6, hy - 18], [hx - 30, hy - 21], [hx - 44, hy + 2]], { width: 2, color: INK.dan, alpha: 0.9, bristles: 3, ...o });
    // 白胡子：一绺垂到胸前
    const beard = new Path2D();
    beard.moveTo(hx - 32, hy + 10); beard.quadraticCurveTo(hx - 46, hy + 50, hx - 40, hy + 96); beard.quadraticCurveTo(hx - 30, hy + 60, hx - 6, hy + 24); beard.closePath();
    ctx.save(); ctx.fillStyle = INK.paper; ctx.fill(beard); ctx.restore();
    for (let k = 0; k < 4; k++) bristleStroke(ctx, [[hx - 30 + k * 5, hy + 12 + k * 3], [hx - 40 + k * 3, hy + 52], [hx - 40 + k * 1.5, hy + 92 - k * 6]], { width: 1.6, color: INK.dan, alpha: 0.85, bristles: 2, dry: 0.2, seed: 220 + k, ...o });
    // 胡子：嘴边一撇
    bristleStroke(ctx, [[hx - 30, hy + 12], [hx - 22, hy + 16], [hx - 14, hy + 14]], { width: 2, color: INK.zhong, alpha: 0.8, bristles: 2, ...o });
  });
}
/** 两节手臂：给定手的位置（局部坐标），返回肘点（肘往下、往后弯）。 */
function elbowFor(hand) {
  const [sx, sy] = SHOULDER;
  const dx = hand[0] - sx, dy = hand[1] - sy;
  const d = Math.min(UPPER + FORE - 0.5, Math.hypot(dx, dy));
  const a = Math.atan2(dy, dx);
  const c = clamp((UPPER * UPPER + d * d - FORE * FORE) / (2 * UPPER * d), -1, 1);
  const e = a - Math.acos(c); // 肘在手臂连线的「下方」（老人面朝左，手往左上举时肘朝下）
  return [sx + Math.cos(e) * UPPER, sy + Math.sin(e) * UPPER];
}
const HAND_REST = [-82, -214], HAND_UP = [-142, -276];
function handAt(b) {
  if (b < T_REST[0]) {
    const u = ease.inOut(smoothstep(T_LIFT[0], T_LIFT[1], b));
    const lift = [lerp(HAND_REST[0], HAND_UP[0], u), lerp(HAND_REST[1], HAND_UP[1], u) - Math.sin(u * Math.PI) * 18];
    // 倒茶时手腕微微抖（一本正经地高冲）
    const pour = smoothstep(T_LAND, T_LAND + 0.3, b) * (1 - smoothstep(T_STOP - 0.3, T_STOP, b));
    return [lift[0] + Math.sin(b * 9.4) * 2 * pour, lift[1] - pour * 10 + Math.sin(b * 6.3) * 2.5 * pour];
  }
  const u = ease.inOut(smoothstep(T_REST[0], T_REST[1], b));
  return [lerp(HAND_UP[0], HAND_REST[0], u), lerp(HAND_UP[1] - 10, HAND_REST[1], u) - Math.sin(u * Math.PI) * 14];
}
const tiltAt = (b) => -0.62 * smoothstep(T_TILT[0], T_TILT[1], b) * (1 - smoothstep(T_STOP - 0.1, T_STOP + 0.3, b));
/** 提梁壶（局部原点 = 提梁顶上的手；壶嘴朝左上）。返回壶嘴尖（局部）。 */
const SPOUT = [-74, 24];
function kettle(ctx) {
  const k = baked('s03-kettle', 140 * K, 130 * K, (c) => {
    c.scale(K, K);
    c.translate(96, 16);
    const o = { px: PX };
    // 壶身：浓淡两层（陶壶，略带赭石）
    c.save();
    c.fillStyle = mix(INK.zhong, INK.zheshi, 0.3);
    c.fill(blobPath(0, 64, 37, 31, { seed: 8, rough: 0.04 }));
    c.globalAlpha = 0.6;
    c.fillStyle = INK.nong;
    c.fill(blobPath(10, 72, 26, 22, { seed: 9, rough: 0.1 }));
    c.restore();
    // 高光留白
    bristleStroke(c, [[-24, 52], [-14, 42], [0, 38]], { width: 4, color: INK.paper, alpha: 0.7, bristles: 3, dry: 0.4, seed: 2, ...o });
    // 壶嘴
    const sp = new Path2D(); sp.moveTo(-30, 66); sp.quadraticCurveTo(-52, 58, SPOUT[0], SPOUT[1] + 2); sp.lineTo(SPOUT[0] + 4, SPOUT[1] - 4); sp.quadraticCurveTo(-48, 44, -32, 50); sp.closePath();
    c.fillStyle = INK.nong; c.fill(sp);
    // 壶盖、钮
    bristleStroke(c, [[-18, 36], [0, 31], [18, 36]], { width: 4, color: INK.jiao, alpha: 0.9, bristles: 4, ...o });
    inkDot(c, 0, 27, 5, { color: INK.jiao, seed: 3, bleed: 0.1 });
    // 提梁：一道弧
    bristleStroke(c, [[-28, 44], [-24, 12], [-8, 0], [8, 0], [24, 12], [28, 44]], { width: 5, color: INK.jiao, alpha: 0.9, bristles: 5, dry: 0.25, seed: 4, ...o });
  });
  ctx.drawImage(k, -96, -16, 140, 130);
}
function drawMan(ctx, b, x, y) {
  const breath = Math.sin(b * Math.PI) * 1.2;
  const nod = Math.sin(Math.PI * smoothstep(T_NOD[0], T_NOD[1], b)) * 0.06;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-nod);
  ctx.translate(0, breath * 0.3);
  ctx.drawImage(manBody(), -110, -370, 220, 380);
  // 近侧手臂（宽袖）：肩→肘→手腕，袖子下沿往下垂；然后壶，最后手握在提梁上
  const hand = handAt(b), elbow = elbowFor(hand);
  const tilt = tiltAt(b);
  const nrm = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], L = Math.hypot(dx, dy) || 1; return [-dy / L, dx / L]; };
  let n1 = nrm(SHOULDER, elbow), n2 = nrm(elbow, hand);
  if (n1[1] > 0) n1 = [-n1[0], -n1[1]]; // 统一取「上侧」
  if (n2[1] > 0) n2 = [-n2[0], -n2[1]];
  const ne = [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2];
  const P = (q, n, w) => [q[0] + n[0] * w, q[1] + n[1] * w];
  const wrist = [hand[0] + (elbow[0] - hand[0]) * 0.12, hand[1] + (elbow[1] - hand[1]) * 0.12];
  const topEdge = [P(SHOULDER, n1, 17), P(elbow, ne, 14), P(wrist, n2, 12)];
  const cuffLow = [wrist[0] - n2[0] * 22 + 4, wrist[1] + 30];          // 袖口下垂
  const botEdge = [P(SHOULDER, n1, -18), P(elbow, ne, -16), [lerp(elbow[0], cuffLow[0], 0.55), Math.max(elbow[1], cuffLow[1]) + 8], cuffLow];
  const sl = new Path2D();
  [...topEdge, ...botEdge.slice().reverse()].forEach(([px, py], i) => (i ? sl.lineTo(px, py) : sl.moveTo(px, py)));
  sl.closePath();
  ctx.save();
  ctx.fillStyle = ROBE; ctx.fill(sl);
  ctx.fillStyle = rgba(INK.dan, 0.35); ctx.fill(blobPath(elbow[0], elbow[1] + 8, 16, 12, { seed: 8, rough: 0.2 }));
  ctx.restore();
  bristleStroke(ctx, topEdge, { width: 3.6, color: INK.nong, alpha: 0.9, bristles: 4, dry: 0.25, seed: 502, spacing: 3 });
  bristleStroke(ctx, botEdge, { width: 3.6, color: INK.nong, alpha: 0.9, bristles: 4, dry: 0.3, seed: 503, spacing: 3 });
  bristleStroke(ctx, [topEdge[2], cuffLow], { width: 3, color: INK.nong, alpha: 0.85, bristles: 3, dry: 0.2, seed: 504, spacing: 3 });
  // 提梁壶
  ctx.save();
  ctx.translate(hand[0], hand[1]);
  ctx.rotate(tilt);
  kettle(ctx);
  ctx.restore();
  // 手：握在提梁顶上
  ctx.save(); ctx.fillStyle = mix(INK.paper, INK.zheshi, 0.45); ctx.fill(blobPath(hand[0] + 1, hand[1] - 1, 9, 8, { seed: 6, rough: 0.1 })); ctx.restore();
  bristleStroke(ctx, [[hand[0] - 7, hand[1] - 8], [hand[0] - 10, hand[1] + 2], [hand[0] - 3, hand[1] + 7], [hand[0] + 8, hand[1] + 5]], { width: 2.2, color: INK.nong, alpha: 0.9, bristles: 2, spacing: 2 });
  ctx.restore();
  // 壶嘴尖在画面上的位置
  const c = Math.cos(tilt - nod), s = Math.sin(tilt - nod);
  const hx = hand[0] * Math.cos(-nod) - (hand[1] + breath * 0.3) * Math.sin(-nod), hy = hand[0] * Math.sin(-nod) + (hand[1] + breath * 0.3) * Math.cos(-nod);
  return [x + hx + SPOUT[0] * c - SPOUT[1] * s, y + hy + SPOUT[0] * s + SPOUT[1] * c];
}

// ---------- 墨线 ----------
function linePts(cg, cEnd) {
  const xa = LINE_L + cg, xb = cEnd + X_MAX + 260;
  const pts = [];
  for (let x = xa; x <= xb; x += 6) pts.push([x, lineY(x - cg)]);
  return pts;
}
function lineLayer(env) {
  const cg = env.camAt(GAG), cEnd = env.camAt(16.5);
  return strip('s03-inkline', 1, (ctx, x0, x1) => {
    const pts = linePts(cg, cEnd).filter(([x]) => x > x0 && x < x1);
    inkRibbon(ctx, pts, { width: 17, vary: 0.55, seed: 7, px: PX, bleed: 4, dry: 0.55, taper: 60 });
    // 落点：一团晕开的墨
    inkDot(ctx, LAND_X + cg, lineY(LAND_X) + 1, 30, { ry: 9, seed: 31, bleed: 0.5, alpha: 0.9 });
    // 他脚下：一小团
    inkDot(ctx, CHAR_X + cg - 10, lineY(CHAR_X - 10) + 1, 22, { ry: 6, seed: 32, bleed: 0.5, alpha: 0.75 });
  }, { y0: ROAD_Y - 20, y1: ROAD_Y + 45 });
}
/** 墨线左右两端（定格时的画面坐标）。 */
function lineEnds(b, env) {
  if (b < T_LAND) return null;
  const left = lerp(LAND_X, LINE_L, ease.out(smoothstep(T_LAND, T_FEET, b)));
  const grow = lerp(LAND_X, X_MAX + 90, ease.inOut(smoothstep(T_AHEAD[0], T_AHEAD[1], b)));
  const ahead = b >= T_AHEAD[1] ? env.cam - env.camAt(GAG) + X_MAX + 90 : -Infinity;
  const spread = 30 * ease.out(smoothstep(T_LAND, T_LAND + 0.25, b)); // 落地时向两边先摊开一点
  return [Math.min(left, LAND_X - spread), Math.max(grow, ahead, LAND_X + spread)];
}
function drawInkLine(ctx, b, env) {
  const E = lineEnds(b, env);
  if (!E) return;
  const off = env.camAt(GAG) - env.cam; // 定格画面坐标 → 当前画面坐标
  const S = lineLayer(env);
  const xa = E[0] + off - (E[0] <= LINE_L + 1 ? 30 : 0), xb = E[1] + off;
  ctx.save();
  ctx.beginPath();
  ctx.rect(xa, ROAD_Y - 30, xb - xa, 90);
  ctx.clip();
  drawStrip(ctx, S, env.cam);
  ctx.restore();
  // 流动的墨头
  if (b < T_FEET + 0.15) {
    const k = 1 - smoothstep(T_FEET - 0.1, T_FEET + 0.15, b);
    inkDot(ctx, E[0] + off, lineY(E[0]) - 0.5, 9 * k + 2, { ry: 6.5 * k + 1.5, seed: Math.floor(b * 8), bleed: 0.3 });
  }
  if (b < T_AHEAD[1] + 0.2 && b > T_AHEAD[0]) inkDot(ctx, xb, lineY(E[1]) - 0.5, 10, { ry: 7, seed: Math.floor(b * 8) + 3, bleed: 0.3 });
}
/** 第 9 拍落地溅起的墨点：飞出去，落在路上不动了。 */
function drawSplash(ctx, b, env) {
  if (b < T_LAND) return;
  const off = env.camAt(GAG) - env.cam;
  const u = clamp((b - T_LAND) / 0.32);
  for (let k = 0; k < 16; k++) {
    const dir = hash2(k, 1, 3) < 0.5 ? -1 : 1;
    const dist = 20 + hash2(k, 2, 3) * 110;
    const hgt = 30 + hash2(k, 3, 3) * 70;
    const fx = LAND_X + dir * dist * ease.out(u), fy = lineY(LAND_X) + (hash2(k, 4, 3) - 0.3) * 26 - Math.sin(Math.PI * u) * hgt;
    const r = 2 + hash2(k, 5, 3) * 4.5;
    inkDot(ctx, fx + off, fy, r * (u < 1 ? 1 : 1.25), { ry: u < 1 ? r : r * 0.55, seed: k + 60, bleed: 0.25, alpha: 0.88 });
  }
}
/** 第 13–16 拍：每一步脚下溅起几个小墨点（落在世界坐标里，留在路上）。 */
function drawSteps(ctx, b, env) {
  for (let k = GAG + 4; k < 17; k++) {
    if (b < k) break;
    const u = clamp((b - k) / 0.3);
    const wx = env.camAt(k) + CHAR_X + 62;
    const sx = wx - env.cam;
    if (sx < X_MIN - 40 || sx > X_MAX + 40) continue;
    for (let j = 0; j < 6; j++) {
      const dir = j % 2 ? 1 : -1;
      const fx = sx + dir * (10 + hash2(k, j, 9) * 40) * ease.out(u), fy = lineY(wx - env.camAt(GAG)) - Math.sin(Math.PI * u) * (12 + hash2(j, k, 9) * 24) + hash2(k, j + 7, 9) * 8;
      const r = 1.6 + hash2(k, j + 3, 9) * 2.6;
      inkDot(ctx, fx, fy, r, { ry: u < 1 ? r : r * 0.6, seed: k * 10 + j, bleed: 0.2, alpha: 0.85 });
    }
  }
}

const circle2 = (ctx, x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };

// ---------- 每帧的小动态 ----------
function drawBirds(ctx, b, cam) {
  // 两三只墨点飞鸟，从左往右慢慢飞
  for (let k = 0; k < 3; k++) {
    const x = 700 + k * 80 + b * 40 - cam * 0.05, y = 300 + (k % 2) * 30 + Math.sin(b * 1.3 + k) * 8;
    const flap = Math.sin(b * Math.PI * 2 + k * 1.7);
    if (x < X_MIN - 30 || x > X_MAX + 30) continue;
    ctx.save();
    ctx.strokeStyle = INK.nong; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 4 * flap); ctx.quadraticCurveTo(x - 5, y - 6 * flap - 2, x, y);
    ctx.quadraticCurveTo(x + 5, y - 6 * flap - 2, x + 12, y - 4 * flap);
    ctx.stroke();
    ctx.restore();
  }
}
function drawSteam(ctx, b, x, y) {
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const ph = (b * 0.55 + k / 3) % 1;
    const a = Math.sin(Math.PI * ph) * 0.55;
    ctx.strokeStyle = rgba(INK.dan, a);
    ctx.lineWidth = 3 - ph * 1.5;
    ctx.beginPath();
    for (let s = 0; s <= 12; s++) {
      const t = s / 12;
      const yy = y - 10 - (ph * 70 + t * 70);
      const xx = x + (k - 1) * 8 + Math.sin(t * 5 + b * 2 + k) * (6 + t * 10);
      s ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}
function drawFlag(ctx, b, x) {
  // 茶旗：竹竿 + 横杆 + 空白旗面（茶叶纹样、印章红镶边），随风飘
  const top = 248, cross = 268;
  bristleStroke(ctx, [[x, ROAD_Y - 6], [x + 3, top]], { width: 9, color: INK.nong, alpha: 0.85, bristles: 6, dry: 0.3, seed: 601, taper: [1, 0.9, 0.7], spacing: 4 });
  ctx.save();
  ctx.strokeStyle = INK.nong; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + 2, cross); ctx.lineTo(x + 92, cross - 6); ctx.stroke();
  // 旗面：上边挂在横杆上，下边和外边随风摆
  const W = 84, H = 200;
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([x + 6 + W * t, cross - 6 * t + 3]); }
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([x + 6 + W + Math.sin(b * 2.6 + t * 3) * 6 * t + t * 4, cross + H * t]);
  }
  for (let i = 10; i >= 0; i--) {
    const t = i / 10;
    pts.push([x + 6 + W * t + Math.sin(b * 2.6 + 3 + t * 2) * 7, cross + H + Math.sin(b * 3.1 + t * 6) * 5 * t - 6 * t]);
  }
  for (let i = 12; i >= 0; i--) { const t = i / 12; pts.push([x + 6 + Math.sin(b * 2.6 + t * 2) * 3 * t, cross + H * t]); }
  const p = new Path2D();
  pts.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py)));
  p.closePath();
  ctx.fillStyle = '#efe8d6'; ctx.fill(p);
  ctx.clip(p);
  ctx.fillStyle = rgba(INK.seal, 0.85); ctx.fillRect(x, cross - 10, W + 20, 18); // 镶边
  ctx.fillStyle = rgba(INK.dan, 0.18); ctx.fillRect(x + W * 0.55, cross, W, H + 20);
  // 纹样：一把小茶壶的剪影 + 一缕热气（不写字）
  const cx = x + 6 + W / 2 + Math.sin(b * 2.6 + 1.5) * 3, cy = cross + 112;
  ctx.fillStyle = rgba(INK.nong, 0.85);
  ctx.fill(blobPath(cx + 2, cy, 22, 17, { seed: 12, rough: 0.05 }));
  ctx.beginPath(); ctx.moveTo(cx - 16, cy + 2); ctx.quadraticCurveTo(cx - 30, cy - 2, cx - 36, cy - 16); ctx.lineTo(cx - 31, cy - 17); ctx.quadraticCurveTo(cx - 26, cy - 8, cx - 14, cy - 8); ctx.closePath(); ctx.fill();
  ctx.fillRect(cx - 9, cy - 21, 22, 5); circle2(ctx, cx + 2, cy - 24, 4);
  ctx.strokeStyle = rgba(INK.nong, 0.85); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(cx + 24, cy - 1, 9, -1.3, 1.3); ctx.stroke();
  ctx.lineWidth = 2.4; ctx.strokeStyle = rgba(INK.zhong, 0.7);
  ctx.beginPath(); ctx.moveTo(cx + 2, cy - 32); ctx.bezierCurveTo(cx - 8, cy - 44, cx + 12, cy - 52, cx + 2, cy - 66); ctx.stroke();
  ctx.restore();
  ctx.save(); ctx.strokeStyle = rgba(INK.nong, 0.8); ctx.lineWidth = 2.2; ctx.stroke(p); ctx.restore();
}
/** 前景：画面下沿两侧几丛淡墨草（p = 1.3）。 */
function fgLayer(cg) {
  return strip('s03-fg', P_FG, (ctx, x0, x1) => {
    const R = R0('fg');
    for (let x = x0 + 100; x < x1; x += 380 + R() * 420) {
      const sx = x - cg * P_FG;
      if (sx > 40 && sx < 1100) continue; // 定格时不挡人物、墨线、茶棚
      grassTuft(ctx, x, 1010, 90 + R() * 60, { seed: Math.round(x), color: INK.zhong, alpha: 0.55, blades: 7, spread: 1.4, px: PX });
      grassTuft(ctx, x + 40, 1012, 60 + R() * 40, { seed: Math.round(x) + 1, color: INK.dan, alpha: 0.5, blades: 5, spread: 1.2, px: PX });
    }
  }, { y0: 840, y1: 1030 });
}

// ---------- 播放器：水墨磁带 ----------
function inkCassette(ctx, cx, cy, s, spin) {
  const w = 200 * s, h = 128 * s;
  const body = baked('s03-cassette', (w + 40), (h + 40), (c) => {
    c.translate(20 + w / 2, 20 + h / 2);
    c.save();
    c.shadowColor = 'rgba(60,45,25,0.22)'; c.shadowBlur = 12; c.shadowOffsetY = 4;
    c.fillStyle = INK.paper;
    c.fill(blobPath(0, 0, w / 2 + 2, h / 2 + 2, { seed: 5, rough: 0.012, n: 60 }));
    c.restore();
    const rect = (x0, y0, x1, y1, o) => bristleStroke(c, [[x0, y0], [x1, y0 + 1], [x1 - 1, y1], [x0 + 1, y1 - 1], [x0, y0 + 2]], o);
    rect(-w / 2 + 4, -h / 2 + 4, w / 2 - 4, h / 2 - 4, { width: 4.5, color: INK.jiao, alpha: 0.9, bristles: 7, dry: 0.35, seed: 11, spacing: 1.6, taper: [1, 0.9, 0.7] });
    // 标签区：淡墨一抹 + 小红印
    c.save(); c.fillStyle = rgba(INK.dan, 0.28); c.fill(blobPath(0, -h / 2 + 46, w / 2 - 20, 30, { seed: 7, rough: 0.05 })); c.restore();
    rect(-w / 2 + 16, -h / 2 + 14, w / 2 - 16, -h / 2 + 78, { width: 2.6, color: INK.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 12, spacing: 1.6 });
    sealStamp(c, w / 2 - 30, -h / 2 + 28, 18, { seed: 5 });
    // 窗
    c.save(); c.fillStyle = INK.paper; c.fill(blobPath(0, -h / 2 + 51, 50, 15, { seed: 8, rough: 0.03 })); c.restore();
    bristleStroke(c, [[-50, -h / 2 + 36], [50, -h / 2 + 36], [52, -h / 2 + 66], [-50, -h / 2 + 66], [-50, -h / 2 + 37]], { width: 2.4, color: INK.nong, alpha: 0.85, bristles: 3, seed: 13, spacing: 1.6 });
    // 底部梯形 + 两个孔
    bristleStroke(c, [[-60, h / 2 - 4], [-48, h / 2 - 30], [48, h / 2 - 30], [60, h / 2 - 4]], { width: 3, color: INK.nong, alpha: 0.85, bristles: 4, dry: 0.3, seed: 14, spacing: 1.6 });
    for (const sx of [-1, 1]) inkDot(c, sx * 30, h / 2 - 15, 4.5, { color: INK.jiao, seed: 15 + sx, bleed: 0.2 });
  });
  ctx.drawImage(body, cx - w / 2 - 20, cy - h / 2 - 20);
  // 转轮：浓墨圈 + 辐条（每帧）
  for (const sx of [-1, 1]) {
    const rx = cx + sx * 34 * s, ry = cy - h / 2 + 51 * s;
    ctx.save();
    ctx.fillStyle = rgba(INK.nong, 0.85);
    ctx.beginPath(); ctx.arc(rx, ry, (sx < 0 ? 15 : 11) * s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = INK.paper;
    ctx.beginPath(); ctx.arc(rx, ry, 8 * s, 0, Math.PI * 2); ctx.fill();
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
  // 人物（墨色）在中墨山坡、竹丛前：加一圈宣纸色留白边，保证轮廓反差
  figureRim: { color: '#f7f3e8', width: 5, alpha: 0.95 },
  freezeBeat: GAG + 2.5, // Outro 展墙：墨线已经铺开，老人还在倒
  drawBack(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG);
    // 宣纸
    const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1000 * K);
    ctx.drawImage(xuanPaper(pw, ph, { seed: 3 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawStrip(ctx, skyLayer(), cam);
    drawBirds(ctx, b, cam);
    drawStrip(ctx, far1Layer(), cam);
    drawStrip(ctx, far2Layer(), cam);
    drawStrip(ctx, mistLayer(), cam - (b * 10) / P_MIST); // 雾带缓慢往右漂
    drawStrip(ctx, midLayer(cg), cam);
    drawStrip(ctx, nearLayer(cg), cam);
    drawStrip(ctx, roadLayer(), cam);
    // 茶棚 + 老人（定格时的画面坐标 → 当前画面坐标）
    const off = cg - cam;
    if (SHED_BOX.x1 + off > X_MIN && SHED_BOX.x0 + off < X_MAX + 60) {
      const { x0, x1, y0, y1 } = SHED_BOX;
      ctx.drawImage(shedImage('back'), x0 + off, y0, x1 - x0, y1 - y0);
      drawSteam(ctx, b, 965 + off, MAN_BASE - 134);
      const tip = drawMan(ctx, b, MAN_X + off, MAN_BASE);
      ctx.drawImage(shedImage('front'), x0 + off, y0, x1 - x0, y1 - y0);
      drawFlag(ctx, b, FLAG_X + off);
      // 墨线（路面上）
      drawInkLine(ctx, b, env);
      drawSplash(ctx, b, env);
      // 倒下来的墨流：壶嘴 → 落点
      if (b >= T_SPOUT && b < T_STOP + 0.5) {
        const p2 = [LAND_X + off, lineY(LAND_X) - 2];
        const p1 = [lerp(tip[0], p2[0], 0.62), tip[1] + 8];
        const t1 = b < T_LAND ? ease.in(clamp((b - T_SPOUT) / (T_LAND - T_SPOUT))) : 1;
        const t0 = b < T_STOP ? 0 : ease.in(clamp((b - T_STOP) / 0.45));
        inkStream(ctx, tip, p1, p2, t0, t1, { w0: 6, w1: 10, wobble: 2.5, phase: b, seed: 3 });
      }
    } else {
      drawInkLine(ctx, b, env);
    }
  },
  drawFront(ctx, b, env) {
    drawSteps(ctx, b, env);
    drawStrip(ctx, fgLayer(env.camAt(GAG)), env.cam);
  },
  drawFrame(ctx, R) {
    handscrollFrame(ctx, R);
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
