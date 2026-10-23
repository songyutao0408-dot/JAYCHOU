// 第 12 站 · 十二新作（Opus 12, 2012）·「红尘客栈」· 风沙里的孤店 · 国风工笔重彩
// 画风：绢本工笔重彩——细墨线勾勒（铁线描）+ 矿物色平涂、边缘分染（石青、石绿、朱砂、赭石、泥金），
//       风沙黄的绢底、细密绢纹。和第 3 站的宣纸水墨区分开：线细而匀、色浓、有金，满是江湖气。
// 构图（从远到近，视差系数）：绢底天空、淡金日轮（0）→ 青绿远山、古刹、闲云（0.07）→ 沙丘（0.2）
//       → 孤零零的客栈：两层主楼（门头一块黑底金字匾额「红尘客栈」）、偏房（有女子的窗）、柳树、
//         朱红酒旗、灯笼（0.45；从第 1 拍到第 16 拍一直在画面里）
//       → 荒村、快马（0.7）→ 土路：篱笆和菊花、插在泥里裹着布的剑、野桥（1）→ 前景草（1.25）。
//       画面里除了匾额上的四个字不写任何字（酒旗、灯笼、纸上都不写字）。
// 节拍：第 1 小节黄沙漫天、酒旗被吹得笔直；第 2 小节篱笆菊花、裹布的剑、鹤、古刹，两匹快马卷着尘土冲过；
//       第 3 小节（他定格）风变成白色刀痕、骤雨打在酒旗上，窗里亮起女子的侧影，柳枝向窗口弯下腰，
//       第 11 拍剑的布被吹开、剑出鞘一半闪一道光，第 12 拍收回；
//       第 4 小节雨歇、灯笼亮起、窗棂的影子落在地上、柳絮飘，女子端起茶，一支毛笔在飘着的纸上
//       勾出女子的脸、一片梨花落在纸上；他走过荒村野桥，最后 2 拍泥金回纹 + 朱红的画框进来。
// 匾额：放在视差 0.45 的客栈上，按 env.camAt 算好——第 1 拍在画面右侧、第 16 拍在左半边，
//       始终高过他的头顶（字不被人物挡）、在柳树左边（不被柳枝挡）、在标题卡右下（不被卡挡），
//       并且画在本站所有图层（风沙、刀痕、雨、柳絮、纸笔）之后，所以全程清晰。
import { X_MIN, X_MAX, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, makeCanvas, memo } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2, fbm } from '../kit/noise.js';
import { rgba } from '../kit/color.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { font, SERIF } from '../kit/text.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { registerStyle, comicBase, luma, rgbf, blur } from '../rig/styles.js';

const ST = stationByN(12);

// ---------- 调色板（矿物色） ----------
const INK = '#2b2019', INK_S = '#4a3a2c';
const SILK = '#f5ead0', SILK_D = '#eadbb6';
const SAND = '#e9cf98', SAND_L = '#f2e0b4', SAND_D = '#d8b475', SAND_DD = '#c39758';
const ROAD = '#eed8a8', ROAD_D = '#e2c288';
const OCHRE = '#b06d38', OCHRE_D = '#83502a', OCHRE_L = '#d49c62';
const CIN = '#c4362a', CIN_D = '#93261b', CIN_L = '#e2684d';
const AZ = '#2f6b97', AZ_D = '#21507a', AZ_L = '#8db8d1';
const MAL = '#3f8d70', MAL_D = '#2b6b53', MAL_L = '#94c8a9';
const GOLD = '#c99d45', GOLD_L = '#ead08a', GOLD_D = '#9a7230';
const TILE = '#69777a', TILE_L = '#9aa7a5';
const WOOD = '#8a5a34', WOOD_L = '#bd8a55';
const PLASTER = '#f1e4c4', WHITE = '#fcf6e7';
const LW = 1.5; // 铁线描：细而匀（单位）

const P_FAR = 0.07, P_DUNE = 0.2, P_INN = 0.45, P_MID = 0.7, P_FG = 1.25;

// ---------- 定格时（第 9–12 拍）的画面 x（单位）。各层画面 x = gx + (camAt(GAG) − cam) × p ----------
const PLQ = { gx: 376, y: 170, w: 290, h: 96 };       // 匾额（客栈层，门头上，客栈最靠左的东西）
const WIN = { x0: 700, x1: 810, y0: 302, y1: 392 };    // 店堂二层女子的窗（客栈层）
const WILLOW = { gx: 614, y: 648 };                    // 柳树（客栈层，在他和窗之间）
const FLAG_GX = 892, FLAG_Y = 118;                     // 酒旗杆（客栈层，店堂右边；旗面向左飘过屋顶）
const LANTERNS = [[600, 476, 17], [820, 476, 17], [478, 278, 15]];
const SWORD_GX = 470;                                  // 裹布的剑（路面层，他右前方的路边）
const FENCE = [-300, 250];                             // 篱笆和菊花（路面层：第 2 小节经过，定格时在他左后方）
const LATTICE = [215, 520];                            // 窗棂的影子（路面层：第 13 拍前后他走过）
const BRIDGE = [625, 1095];                            // 野桥（路面层：第 14 拍起走上桥）
const VILLAGE = 1000;                                  // 荒村（中景层）

// ---------- 时间点（段内拍位） ----------
const T_CRANE = [GAG - 5.2, GAG - 0.2];               // 鹤飞过（第 3–8 拍）
const T_HORSE = [GAG - 3.6, GAG - 1.0];               // 两匹快马（第 5.4–8 拍）
const T_RAIN = [GAG - 0.08, GAG + 0.22, GAG + 4.0, GAG + 4.8]; // 骤雨：起、满、收、停
const T_LAMP = [GAG + 0.15, GAG + 0.7];               // 窗里的灯亮起、女子侧影
const T_BOW = [GAG + 0.45, GAG + 1.5, GAG + 4.2, GAG + 5.2];   // 柳枝折腰：弯下、弯到底、开始回、回正
const T_UNWRAP = [GAG + 1.65, GAG + 2.0];             // 第 11 拍前：布被风吹开
const T_DRAW = [GAG + 1.96, GAG + 2.12];              // 第 11 拍：剑出鞘一半
const T_FLASH = [GAG + 2.0, GAG + 2.8];               // 闪光
const T_SHEATHE = [GAG + 3.0, GAG + 3.14];            // 第 12 拍：收回去
const T_SUN = [GAG + 4.0, GAG + 4.9];                 // 雨歇、灯笼亮起、窗棂的影子
const T_TEA = [GAG + 4.2, GAG + 4.7];                 // 女子端起茶
const T_PAPER = [GAG + 4.1, GAG + 4.65];              // 纸飘进来
const T_INK = [GAG + 4.6, GAG + 6.55];                // 毛笔勾脸
const T_PEAR = [GAG + 5.75, GAG + 6.9];               // 梨花飘落到纸上

const off = (env, p) => (env.camAt(GAG) - env.cam) * p;

// ---------- 基础形状 ----------
const pathOf = (fn) => { const p = new Path2D(); fn(p); return p; };
const rectP = (x, y, w, h) => pathOf((p) => p.rect(x, y, w, h));
const ellP = (x, y, rx, ry, rot = 0) => pathOf((p) => p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU));
const circP = (x, y, r) => ellP(x, y, r, r);
const polyP = (pts, close = true) => pathOf((p) => { pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); if (close) p.closePath(); });

/** 分染：沿轮廓向里由深到浅（叠几道半透明的粗描边，裁在形状里）。 */
function fen(ctx, path, color, w = 12, steps = 4, a = 0.12) {
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = color; ctx.lineJoin = 'round';
  ctx.globalAlpha = a;
  for (let i = 0; i < steps; i++) { ctx.lineWidth = 2 * w * (1 - i / steps); ctx.stroke(path); }
  ctx.restore();
}
/** 工笔：平涂 → 分染 → 细墨线。 */
function gb(ctx, path, fill, { line = LW, ink = INK, shade = null, sw = 10, sa = 0.12 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(path); }
  if (shade) fen(ctx, path, shade, sw, 4, sa);
  if (line) { ctx.lineWidth = line; ctx.strokeStyle = ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); }
}
function strokeLine(ctx, pts, w = LW, color = INK) {
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
}
/** 回纹带：从 (x, y) 起向右长 len、高 h。 */
function huiwen(ctx, x, y, len, h, color, lw = h * 0.13) {
  const u = h * 1.05, n = Math.max(1, Math.floor(len / u)), o = x + (len - n * u) / 2;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const ox = o + i * u;
    ctx.moveTo(ox, y + h); ctx.lineTo(ox, y); ctx.lineTo(ox + 0.82 * u, y); ctx.lineTo(ox + 0.82 * u, y + 0.72 * h);
    ctx.lineTo(ox + 0.3 * u, y + 0.72 * h); ctx.lineTo(ox + 0.3 * u, y + 0.34 * h); ctx.lineTo(ox + 0.58 * u, y + 0.34 * h);
  }
  ctx.moveTo(o, y + h); ctx.lineTo(o + n * u, y + h);
  ctx.stroke();
  ctx.restore();
}
function spiral(ctx, cx, cy, r, { turns = 1.2, a0 = 2.4, dir = 1, lw = 1.2, color = GOLD } = {}) {
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = a0 + dir * t * turns * TAU, rr = r * (1 - t * 0.8);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
}

// ---------- 绢纹（细密经纬线，平铺） ----------
function weaveTile() {
  return memo('s12-weave', () => {
    const S = 96, c = makeCanvas(S, S), x = c.getContext('2d'), im = x.createImageData(S, S);
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
      const k = (j * S + i) * 4;
      const warp = (i % 3 === 0 ? 1 : 0) * (0.5 + hash2(i, 0, 3) * 0.5); // 经线
      const weft = (j % 3 === 0 ? 1 : 0) * (0.5 + hash2(0, j, 4) * 0.5); // 纬线
      const h = hash2(i, j, 5);
      const v = Math.max(warp, weft) * 0.55 + (h > 0.97 ? 0.5 : 0);
      const dark = ((i + j) & 1) === 0;
      im.data[k] = dark ? 120 : 255; im.data[k + 1] = dark ? 86 : 250; im.data[k + 2] = dark ? 40 : 232;
      im.data[k + 3] = v * 34;
    }
    x.putImageData(im, 0, 0);
    return c;
  });
}
function weave(ctx, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = ctx.createPattern(weaveTile(), 'repeat');
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// ---------- 天空：绢底 + 淡金日轮（不随镜头动） ----------
function skyCanvas() {
  const w = Math.ceil((X_MAX - X_MIN) * K), h = Math.ceil(1000 * K);
  return baked('s12-sky', w, h, (ctx) => {
    ctx.scale(K, K); ctx.translate(-X_MIN, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 760);
    g.addColorStop(0, '#f4e9cb'); g.addColorStop(0.5, '#f1dfb0'); g.addColorStop(1, '#e9cc90');
    ctx.fillStyle = g; ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
    // 绢的陈旧斑驳（低频）
    const R = rng('s12-sky');
    for (let i = 0; i < 26; i++) {
      const x = X_MIN + R() * (X_MAX - X_MIN), y = R() * 700, r = 80 + R() * 180;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, rgba(R() < 0.5 ? '#fff6dc' : '#e4c88e', 0.22)); rg.addColorStop(1, rgba('#e4c88e', 0));
      ctx.fillStyle = rg; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    // 日轮：风沙里一枚淡金的圆
    const sx = 1150, sy = 150;
    const rg = ctx.createRadialGradient(sx, sy, 30, sx, sy, 300);
    rg.addColorStop(0, 'rgba(255,247,220,0.85)'); rg.addColorStop(0.3, 'rgba(252,236,190,0.4)'); rg.addColorStop(1, 'rgba(252,236,190,0)');
    ctx.fillStyle = rg; ctx.fillRect(sx - 300, sy - 300, 600, 600);
    gb(ctx, circP(sx, sy, 48), '#fcf0cc', { line: 1.3, ink: GOLD, shade: GOLD_L, sw: 12, sa: 0.18 });
    weave(ctx, X_MIN, 0, X_MAX - X_MIN, 1000, 0.9);
  });
}

// ---------- 工笔云（泥金勾边的如意云） ----------
const CLOUD_LOBES = [[-58, 6, 22], [-26, -12, 31], [16, -18, 28], [50, -2, 22], [4, 10, 24], [-34, 12, 18]];
function cloud(ctx, x, y, s, flip = 1, fill = '#fbf3df') {
  ctx.save();
  ctx.translate(x, y); ctx.scale(flip * s, s);
  const p = new Path2D();
  for (const [dx, dy, r] of CLOUD_LOBES) { p.moveTo(dx + r, dy); p.arc(dx, dy, r, 0, TAU); }
  p.moveTo(60, 14); p.quadraticCurveTo(110, 24, 140, 4); p.quadraticCurveTo(118, 28, 60, 30); p.closePath();
  const L = 1.4 / s;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = GOLD_D; ctx.lineWidth = L * 2; ctx.stroke(p);
  ctx.fillStyle = fill; ctx.fill(p);
  // 底下一层淡石青分染
  ctx.save(); ctx.clip(p);
  const g = ctx.createLinearGradient(0, -40, 0, 34);
  g.addColorStop(0, rgba(AZ_L, 0)); g.addColorStop(1, rgba(AZ_L, 0.55));
  ctx.fillStyle = g; ctx.fillRect(-90, -50, 240, 90);
  ctx.restore();
  for (const [dx, dy, r, d] of [[-26, -12, 31, 1], [16, -18, 28, -1], [-58, 6, 22, 1], [50, -2, 22, -1]]) spiral(ctx, dx, dy + 2, r * 0.62, { dir: d, lw: L * 0.8, a0: d > 0 ? 2.6 : 0.6, color: GOLD_D });
  ctx.restore();
}

// ---------- 远景：青绿远山、古刹、闲云 ----------
function peak(ctx, cx, base, w, h, cols, R) {
  const lean = (R() - 0.5) * 0.25 * w;
  const p = new Path2D();
  p.moveTo(cx - w / 2, base);
  p.bezierCurveTo(cx - w * 0.36, base - h * 0.5, cx - w * 0.2 + lean, base - h * 1.04, cx + lean * 0.5, base - h);
  p.bezierCurveTo(cx + w * 0.22 + lean, base - h * 0.98, cx + w * 0.36, base - h * 0.48, cx + w / 2, base);
  p.closePath();
  ctx.save();
  ctx.fillStyle = cols[2]; ctx.fill(p);
  ctx.clip(p);
  // 青绿设色：上石青、中石绿、下赭石，交界柔和
  const g = ctx.createLinearGradient(0, base - h, 0, base);
  g.addColorStop(0, cols[0]); g.addColorStop(0.45, cols[1]); g.addColorStop(1, rgba(cols[2], 0.2));
  ctx.fillStyle = g; ctx.fillRect(cx - w, base - h - 10, 2 * w, h + 20);
  // 皴：几道细的折带
  ctx.strokeStyle = rgba(INK, 0.35); ctx.lineWidth = 0.9;
  for (let k = 0; k < 5; k++) {
    const sx = cx + lean * 0.4 + (R() - 0.5) * w * 0.5, sy = base - h * (0.4 + R() * 0.45);
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.quadraticCurveTo(sx + (R() - 0.5) * 30, sy + 22, sx + (R() - 0.5) * 40, sy + 48); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = 1.2; ctx.strokeStyle = rgba(GOLD_D, 0.9); ctx.stroke(p); // 金碧山水的泥金勾边
  ctx.lineWidth = 0.7; ctx.strokeStyle = rgba(INK, 0.5); ctx.stroke(p);
}
function temple(ctx, x, y) {
  // 古刹：七级小塔 + 一进殿宇，站在山脊上
  for (let k = 0; k < 7; k++) {
    const w = 24 - k * 2.3, yy = y - k * 11;
    gb(ctx, rectP(x - w * 0.36, yy - 8, w * 0.72, 8), CIN_L, { line: 0.7 });
    gb(ctx, polyP([[x - w * 0.62, yy - 7], [x + w * 0.62, yy - 7], [x + w * 0.4, yy - 11], [x - w * 0.4, yy - 11]]), TILE, { line: 0.7 });
  }
  strokeLine(ctx, [[x, y - 77], [x, y - 92]], 1.2, GOLD_D);
  ctx.fillStyle = GOLD; ctx.beginPath(); ctx.arc(x, y - 92, 2.2, 0, TAU); ctx.fill();
  // 殿
  const hx = x + 46;
  gb(ctx, rectP(hx - 22, y - 16, 44, 16), CIN_L, { line: 0.8 });
  gb(ctx, polyP([[hx - 34, y - 15], [hx + 34, y - 15], [hx + 22, y - 28], [hx - 22, y - 28]]), TILE, { line: 0.8 });
  gb(ctx, rectP(hx - 30, y - 2, 60, 4), PLASTER, { line: 0.6 });
  // 院墙
  gb(ctx, rectP(x - 30, y - 3, 30, 5), CIN_L, { line: 0.6 });
}
/** 视差长条 + 烘焙时就叠上绢纹（只叠在画了东西的地方），每帧不再整屏铺纹理。 */
function silkStrip(key, p, draw, opt) {
  return strip(key, p, (ctx, x0, x1) => {
    draw(ctx, x0, x1);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    weave(ctx, x0 - 20, opt.y0, x1 - x0 + 40, opt.y1 - opt.y0, 0.9);
    ctx.restore();
  }, opt);
}
function farLayer() {
  return silkStrip('s12-far', P_FAR, (ctx, x0, x1) => {
    const R = rng('s12-far');
    // 闲云
    for (let x = x0 + 60; x < x1; x += 280 + R() * 260) {
      const y = 72 + R() * 120, s = 0.45 + R() * 0.3;
      if (Math.abs(x - 1150) < 170 && y < 230) continue;
      cloud(ctx, x, y, s, R() < 0.5 ? -1 : 1);
    }
    // 远山两重
    const rows = [
      { base: 620, w: [260, 380], h: [150, 220], cols: ['#7fa9c8', '#9cc7ae', '#e2c992'] },
      { base: 652, w: [220, 320], h: [90, 150], cols: ['#6f9fb8', '#86bd9c', '#e6cc95'] },
    ];
    rows.forEach((row, ri) => {
      let x = x0 - 80 + R() * 100;
      while (x < x1 + 120) {
        let w = row.w[0] + R() * (row.w[1] - row.w[0]), h = row.h[0] + R() * (row.h[1] - row.h[0]);
        if (ri === 0 && Math.abs(x - 1330) < 160) { x = 1330; w = 300; h = 200; }
        peak(ctx, x, row.base, w, h, row.cols, R);
        if (ri === 0 && x === 1330) temple(ctx, x - 8, row.base - h + 4);
        x += w * (0.55 + R() * 0.25);
      }
    });
    // 远山脚下化进风沙
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 380, 0, 660);
    g.addColorStop(0, rgba(SAND_L, 0.12)); g.addColorStop(1, rgba(SAND_L, 0.85));
    ctx.fillStyle = g; ctx.fillRect(x0, 300, x1 - x0, 420);
    ctx.restore();
  }, { y0: 0, y1: 700 });
}

// ---------- 沙丘（细线勾出的沙纹） ----------
function dunePath(x0, x1, base, amp, R) {
  const ph = [R() * TAU, R() * TAU, R() * TAU], pts = [];
  for (let x = x0; x <= x1 + 8; x += 8) {
    const y = base - amp * (0.55 + 0.3 * Math.sin(x * 0.006 + ph[0]) + 0.15 * Math.sin(x * 0.017 + ph[1])) - amp * 0.25 * Math.abs(Math.sin(x * 0.0043 + ph[2]));
    pts.push([x, y]);
  }
  return pts;
}
function duneLayer() {
  return silkStrip('s12-dune', P_DUNE, (ctx, x0, x1) => {
    const R = rng('s12-dune');
    const rows = [[640, 44, '#ecd29c'], [672, 36, '#e7c88c'], [704, 28, '#e3c184']];
    for (const [base, amp, col] of rows) {
      const pts = dunePath(x0 - 10, x1 + 10, base, amp, R);
      const p = polyP([...pts, [x1 + 20, 1000], [x0 - 20, 1000]]);
      ctx.fillStyle = col; ctx.fill(p);
      // 背光的一侧分染
      fen(ctx, p, SAND_D, 16, 4, 0.1);
      // 沙纹：沿脊线往下的几道细线
      ctx.strokeStyle = rgba(OCHRE, 0.32); ctx.lineWidth = 0.8;
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath();
        let on = false;
        pts.forEach(([x, y], i) => {
          const show = noise2(x * 0.01, k * 3.1, 7) > 0.42;
          const yy = y + k * 7 + Math.sin(x * 0.03 + k) * 2;
          if (show && on) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
          on = show;
        });
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 0.9;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
  }, { y0: 520, y1: 1000 });
}

// ---------- 客栈 ----------
function hipRoof(ctx, xa, xb, ridgeY, eaveY, { flare = 30, inset = 0.2, tile = TILE, lw = LW } = {}) {
  const w = xb - xa, ra = xa + w * inset, rb = xb - w * inset;
  const p = new Path2D();
  p.moveTo(ra, ridgeY);
  p.lineTo(rb, ridgeY);
  p.quadraticCurveTo(xb - w * 0.05, eaveY - (eaveY - ridgeY) * 0.3, xb + flare, eaveY - flare * 0.75);
  p.quadraticCurveTo(xb - flare * 0.3, eaveY + 3, xb - flare * 1.5, eaveY);
  p.lineTo(xa + flare * 1.5, eaveY);
  p.quadraticCurveTo(xa + flare * 0.3, eaveY + 3, xa - flare, eaveY - flare * 0.75);
  p.quadraticCurveTo(xa + w * 0.05, eaveY - (eaveY - ridgeY) * 0.3, ra, ridgeY);
  p.closePath();
  ctx.fillStyle = tile; ctx.fill(p);
  ctx.save();
  ctx.clip(p);
  const g = ctx.createLinearGradient(0, ridgeY, 0, eaveY);
  g.addColorStop(0, rgba(TILE_L, 0.5)); g.addColorStop(1, rgba(INK, 0.12));
  ctx.fillStyle = g; ctx.fillRect(xa - flare, ridgeY, w + 2 * flare, eaveY - ridgeY + 4);
  // 瓦垄
  ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 0.8;
  const n = Math.round(w / 9);
  for (let k = 1; k < n; k++) {
    const t = k / n;
    ctx.beginPath(); ctx.moveTo(lerp(ra, rb, t), ridgeY); ctx.lineTo(lerp(xa - flare * 0.5, xb + flare * 0.5, t), eaveY + 3); ctx.stroke();
  }
  ctx.restore();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.stroke(p);
  // 檐口一排瓦当（泥金点）
  ctx.fillStyle = GOLD;
  for (let x = xa + flare * 1.3; x < xb - flare * 1.3; x += 9) { ctx.beginPath(); ctx.arc(x, eaveY - 1.5, 1.6, 0, TAU); ctx.fill(); }
  // 正脊 + 鸱吻
  const rh = Math.max(5, (eaveY - ridgeY) * 0.12);
  gb(ctx, rectP(ra - 4, ridgeY - rh, rb - ra + 8, rh), TILE_L, { line: lw * 0.9 });
  strokeLine(ctx, [[ra, ridgeY - rh * 0.5], [rb, ridgeY - rh * 0.5]], 0.9, GOLD_D);
  for (const [x, d] of [[ra - 4, -1], [rb + 4, 1]]) {
    gb(ctx, pathOf((q) => { q.moveTo(x, ridgeY); q.quadraticCurveTo(x + d * rh * 1.6, ridgeY - rh * 0.4, x + d * rh * 0.6, ridgeY - rh * 2.6); q.quadraticCurveTo(x - d * rh * 0.2, ridgeY - rh * 1.6, x, ridgeY - rh); q.closePath(); }), GOLD, { line: 0.9 });
  }
  // 檐角挂的小铃
  for (const [x, y] of [[xa - flare, eaveY - flare * 0.75], [xb + flare, eaveY - flare * 0.75]]) {
    strokeLine(ctx, [[x, y], [x, y + 9]], 0.8);
    gb(ctx, ellP(x, y + 12, 2.6, 3.4), GOLD, { line: 0.6 });
  }
  return p;
}
function lattice(ctx, x, y, w, h, { cell = 11, paper = SILK, wood = OCHRE_D, frame = WOOD, lw = 1 } = {}) {
  // 步步锦一类的格心：外框 + 一圈仔边 + 横竖短棂交错
  gb(ctx, rectP(x, y, w, h), frame, { line: LW });
  const m = 3.5, ix = x + m, iy = y + m, iw = w - 2 * m, ih = h - 2 * m;
  gb(ctx, rectP(ix, iy, iw, ih), paper, { line: 0.8, shade: OCHRE_L, sw: 6, sa: 0.12 });
  ctx.strokeStyle = wood; ctx.lineWidth = lw; ctx.lineCap = 'butt';
  ctx.beginPath();
  const g = 3.2;
  ctx.rect(ix + g, iy + g, iw - 2 * g, ih - 2 * g);
  const nx = Math.max(1, Math.round((iw - 2 * g) / cell)), ny = Math.max(1, Math.round((ih - 2 * g) / cell));
  const cw = (iw - 2 * g) / nx, ch = (ih - 2 * g) / ny;
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const cx = ix + g + (i + 0.5) * cw, cy = iy + g + (j + 0.5) * ch;
    if ((i + j) % 2 === 0) { ctx.moveTo(cx - cw * 0.5, cy - ch * 0.18); ctx.lineTo(cx + cw * 0.5, cy - ch * 0.18); ctx.moveTo(cx - cw * 0.5, cy + ch * 0.18); ctx.lineTo(cx + cw * 0.5, cy + ch * 0.18); }
    else { ctx.moveTo(cx - cw * 0.18, cy - ch * 0.5); ctx.lineTo(cx - cw * 0.18, cy + ch * 0.5); ctx.moveTo(cx + cw * 0.18, cy - ch * 0.5); ctx.lineTo(cx + cw * 0.18, cy + ch * 0.5); }
  }
  ctx.stroke();
}
function pillar(ctx, x, y0, y1, w = 11) {
  gb(ctx, rectP(x - w / 2, y0, w, y1 - y0), CIN, { line: 1.2, shade: CIN_D, sw: 3, sa: 0.25 });
  gb(ctx, rectP(x - w / 2 - 2, y1 - 6, w + 4, 6), '#cbb58e', { line: 0.9 }); // 柱础
}
function railing(ctx, xa, xb, y0, y1) {
  gb(ctx, rectP(xa, y0, xb - xa, 5), CIN, { line: 1.1 });
  gb(ctx, rectP(xa, y1 - 5, xb - xa, 5), CIN, { line: 1.1 });
  const h = y1 - y0 - 12;
  ctx.save();
  ctx.beginPath(); ctx.rect(xa, y0 + 6, xb - xa, h); ctx.clip();
  ctx.fillStyle = rgba(SILK_D, 0.9); ctx.fillRect(xa, y0 + 6, xb - xa, h);
  huiwen(ctx, xa + 2, y0 + 8, xb - xa - 4, h - 4, GOLD_D, 1.4);
  ctx.restore();
  for (let x = xa; x <= xb + 0.1; x += (xb - xa) / 8) gb(ctx, rectP(x - 3, y0 - 6, 6, y1 - y0 + 6), CIN, { line: 0.9 });
}
/** 斗拱额枋：石青、石绿相间的彩画带。 */
function bracketBand(ctx, xa, xb, y0, y1) {
  gb(ctx, rectP(xa, y0, xb - xa, y1 - y0), AZ, { line: 1.1 });
  const n = Math.round((xb - xa) / 36);
  for (let i = 0; i < n; i++) {
    const x = xa + ((xb - xa) * (i + 0.5)) / n;
    gb(ctx, ellP(x, (y0 + y1) / 2, 12, (y1 - y0) * 0.32), i % 2 ? MAL : MAL_L, { line: 0.8 });
    ctx.fillStyle = GOLD_L; ctx.beginPath(); ctx.arc(x, (y0 + y1) / 2, 2, 0, TAU); ctx.fill();
  }
  strokeLine(ctx, [[xa, y0 + 2.5], [xb, y0 + 2.5]], 0.8, GOLD_L);
  strokeLine(ctx, [[xa, y1 - 2.5], [xb, y1 - 2.5]], 0.8, GOLD_L);
}
function jar(ctx, cx, yb, h, body = OCHRE) {
  const w = h * 0.42;
  const p = pathOf((q) => {
    q.moveTo(cx - w * 0.45, yb - h * 0.86);
    q.bezierCurveTo(cx - w * 1.15, yb - h * 0.7, cx - w * 1.05, yb - h * 0.05, cx - w * 0.6, yb);
    q.lineTo(cx + w * 0.6, yb);
    q.bezierCurveTo(cx + w * 1.05, yb - h * 0.05, cx + w * 1.15, yb - h * 0.7, cx + w * 0.45, yb - h * 0.86);
    q.closePath();
  });
  gb(ctx, p, body, { line: 1.1, shade: OCHRE_D, sw: 6, sa: 0.2 });
  gb(ctx, ellP(cx, yb - h * 0.9, w * 0.55, h * 0.12), CIN, { line: 1 }); // 红布封口
  gb(ctx, rectP(cx - w * 0.6, yb - h * 0.62, w * 1.2, h * 0.16), rgba(SILK, 0.85), { line: 0.8 }); // 一圈空白纸条
}
function gateTower(ctx) {
  // 客栈门头：两根朱柱、彩画额枋、一顶小歇山；「红尘客栈」匾额挂在额枋下（另画）。匾额是整座客栈最靠左的东西。
  const xa = 238, xb = 514;
  gb(ctx, rectP(xa - 18, 630, xb - xa + 36, 18), '#d8c39a', { line: 1.2, shade: OCHRE, sw: 5, sa: 0.12 });
  // 门里看见的院子：亮的土地、后面一座小屋、一口井
  const open = rectP(xa + 8, 276, xb - xa - 16, 354);
  const og = ctx.createLinearGradient(0, 276, 0, 630);
  og.addColorStop(0, '#f6e7c2'); og.addColorStop(1, '#efd8a4');
  ctx.fillStyle = og; ctx.fill(open);
  ctx.save(); ctx.clip(open);
  gb(ctx, rectP(xa + 40, 430, 190, 150), PLASTER, { line: 1, shade: OCHRE_L, sw: 8, sa: 0.12 });
  hipRoof(ctx, xa + 30, xb - 36, 396, 432, { flare: 12, inset: 0.15, lw: 1.1 });
  lattice(ctx, xa + 70, 470, 46, 64, { cell: 9 });
  lattice(ctx, xa + 150, 470, 46, 64, { cell: 9 });
  gb(ctx, rectP(xa + 122, 500, 22, 80), '#d7b47a', { line: 1 });
  strokeLine(ctx, [[xa + 8, 580], [xb - 8, 580]], 0.9, rgba(INK, 0.5));
  gb(ctx, ellP(xb - 60, 604, 26, 8), '#cbb48a', { line: 1 });
  gb(ctx, rectP(xb - 86, 590, 52, 14), '#d6c29a', { line: 1 });
  gb(ctx, ellP(xb - 60, 590, 26, 7), '#9e8a66', { line: 1 });
  ctx.restore();
  ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(open);
  // 敞开的两扇朱漆门（门钉泥金）
  for (const [x0, d] of [[xa + 8, 1], [xb - 8, -1]]) {
    const leaf = polyP([[x0, 290], [x0 + d * 26, 300], [x0 + d * 26, 620], [x0, 628]]);
    gb(ctx, leaf, CIN, { line: 1.1, shade: CIN_D, sw: 4, sa: 0.25 });
    ctx.fillStyle = GOLD;
    for (let r = 0; r < 7; r++) for (let c = 0; c < 2; c++) { ctx.beginPath(); ctx.arc(x0 + d * (8 + c * 10), 320 + r * 42, 1.8, 0, TAU); ctx.fill(); }
  }
  // 门槛
  gb(ctx, rectP(xa + 8, 618, xb - xa - 16, 12), WOOD, { line: 1 });
  // 朱柱
  for (const x of [xa, xb]) pillar(ctx, x, 160, 640, 16);
  // 匾额下的横枋
  gb(ctx, rectP(xa - 6, 264, xb - xa + 12, 14), CIN_D, { line: 1.1 });
  strokeLine(ctx, [[xa, 271], [xb, 271]], 1, GOLD_L);
  // 额枋彩画 + 屋顶
  bracketBand(ctx, xa - 22, xb + 22, 142, 162);
  hipRoof(ctx, xa - 22, xb + 22, 86, 144, { flare: 20, inset: 0.18 });
}
function hall(ctx) {
  // 门头右边的两层店堂：二层有女子的那扇窗
  const xa = 540, xb = 870;
  gb(ctx, rectP(xa - 6, 626, xb - xa + 12, 22), '#d8c39a', { line: 1.2, shade: OCHRE, sw: 5, sa: 0.12 });
  // 一层
  gb(ctx, rectP(xa + 2, 472, xb - xa - 4, 154), PLASTER, { shade: OCHRE_L, sw: 12, sa: 0.12 });
  lattice(ctx, 560, 496, 76, 96);
  lattice(ctx, 776, 496, 76, 96);
  const door = rectP(652, 492, 108, 134);
  const dg = ctx.createLinearGradient(0, 492, 0, 626);
  dg.addColorStop(0, '#ebc985'); dg.addColorStop(1, '#f4dea8');
  gb(ctx, door, dg, { line: 1.2, shade: OCHRE, sw: 10, sa: 0.12 });
  ctx.save(); ctx.clip(door);
  gb(ctx, rectP(676, 588, 64, 38), WOOD_L, { line: 1 });
  for (const x of [664, 680, 696, 724, 740]) jar(ctx, x, 546, 17, x % 3 ? OCHRE : '#9a6a3a');
  strokeLine(ctx, [[654, 547], [758, 547]], 1.2, WOOD);
  ctx.restore();
  for (const x of [xa + 6, 650, 762, xb - 6]) pillar(ctx, x, 472, 628);
  // 下檐
  const skirt = pathOf((q) => {
    q.moveTo(xa - 18, 472); q.quadraticCurveTo(xa - 6, 460, xa + 6, 438); q.lineTo(xb - 6, 438); q.quadraticCurveTo(xb + 6, 460, xb + 18, 472);
    q.quadraticCurveTo(xb + 10, 478, xb + 2, 476); q.lineTo(xa - 2, 476); q.quadraticCurveTo(xa - 10, 478, xa - 18, 472); q.closePath();
  });
  gb(ctx, skirt, TILE, { line: 1.3 });
  ctx.save(); ctx.clip(skirt);
  ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 0.8;
  for (let x = xa; x < xb + 6; x += 8) { ctx.beginPath(); ctx.moveTo(x + 4, 438); ctx.lineTo(x, 476); ctx.stroke(); }
  ctx.restore();
  ctx.fillStyle = GOLD; for (let x = xa; x < xb; x += 8) { ctx.beginPath(); ctx.arc(x, 474, 1.4, 0, TAU); ctx.fill(); }
  // 二层
  gb(ctx, rectP(xa + 8, 282, xb - xa - 16, 158), WOOD_L, { shade: OCHRE_D, sw: 10, sa: 0.14 });
  lattice(ctx, 558, 300, 64, 96);
  lattice(ctx, 626, 300, 64, 96);
  lattice(ctx, 820, 300, 40, 96);
  for (const x of [xa + 10, 694, 816, xb - 10]) gb(ctx, rectP(x - 4, 282, 8, 158), CIN, { line: 1 });
  // 窗框（窗纸、侧影、窗棂每帧画）
  gb(ctx, rectP(WIN.x0 - 6, WIN.y0 - 6, WIN.x1 - WIN.x0 + 12, WIN.y1 - WIN.y0 + 12), WOOD, { line: 1.3 });
  railing(ctx, xa, xb, 404, 440);
  bracketBand(ctx, xa - 8, xb + 8, 266, 284);
  hipRoof(ctx, xa - 8, xb + 8, 200, 268, { flare: 26, inset: 0.18 });
}
function stable(ctx, R) {
  // 店堂右边的马棚 + 一截塌了的夯土院墙
  gb(ctx, rectP(900, 540, 170, 108), '#dcb985', { shade: OCHRE, sw: 8, sa: 0.15 });
  ctx.strokeStyle = rgba(OCHRE_D, 0.55); ctx.lineWidth = 0.8;
  for (let y = 552; y < 648; y += 12) { ctx.beginPath(); ctx.moveTo(902, y); ctx.lineTo(1068, y + 1); ctx.stroke(); }
  gb(ctx, rectP(960, 572, 50, 76), '#c9a46c', { line: 1, shade: OCHRE_D, sw: 6, sa: 0.2 });
  for (let x = 966; x < 1006; x += 10) strokeLine(ctx, [[x, 576], [x, 646]], 1, WOOD);
  hipRoof(ctx, 894, 1076, 500, 542, { flare: 14, inset: 0.1, lw: 1.2 });
  const pts = [[1076, 648], [1076, 590]];
  for (let x = 1076; x <= 1240; x += 12) pts.push([x, 590 + (x > 1160 ? (x - 1160) * 0.5 : 0) + (R() - 0.5) * 6]);
  pts.push([1240, 648]);
  gb(ctx, polyP(pts), '#dcb985', { shade: OCHRE, sw: 8, sa: 0.15 });
  ctx.strokeStyle = rgba(OCHRE_D, 0.55); ctx.lineWidth = 0.8;
  for (let y = 604; y < 648; y += 12) { ctx.beginPath(); ctx.moveTo(1078, y); ctx.lineTo(1238, y + 1); ctx.stroke(); }
  strokeLine(ctx, [[1130, 604], [1138, 620], [1133, 640]], 0.9, INK_S);
  for (let x = 1078; x < 1160; x += 9) gb(ctx, ellP(x, 590, 5, 3), TILE, { line: 0.6 });
}
function deadTree(ctx, x, y, s, R) {
  const branch = (bx, by, a, len, w, d) => {
    if (d > 4 || len < 6) return;
    const ex = bx + Math.sin(a) * len, ey = by - Math.cos(a) * len;
    ctx.lineWidth = w; ctx.strokeStyle = INK_S;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + Math.sin(a + 0.3) * len * 0.5, by - Math.cos(a + 0.3) * len * 0.5, ex, ey); ctx.stroke();
    branch(ex, ey, a - 0.4 - R() * 0.3, len * 0.68, w * 0.62, d + 1);
    branch(ex, ey, a + 0.35 + R() * 0.3, len * 0.62, w * 0.6, d + 1);
  };
  ctx.lineCap = 'round';
  branch(x, y, -0.08, 70 * s, 7 * s, 0);
}
function innLayer(cg) {
  const o = cg * P_INN;
  return silkStrip(`s12-inn|${cg.toFixed(1)}`, P_INN, (ctx) => {
    ctx.save();
    ctx.translate(o, 0);
    const R = rng('s12-inn');
    // 客栈脚下的土坡（匾额左边只有空旷的沙地）
    const mound = [];
    for (let x = 100; x <= 1400; x += 10) mound.push([x, 648 - 14 * Math.exp(-(((x - 640) / 520) ** 2)) + Math.sin(x * 0.02) * 2]);
    const mp = polyP([...mound, [1400, 780], [100, 780]]);
    ctx.fillStyle = '#e9cb92'; ctx.fill(mp);
    strokeLine(ctx, mound.filter(([x]) => x > 180), 0.9, rgba(INK, 0.45));
    ctx.strokeStyle = rgba(OCHRE, 0.3); ctx.lineWidth = 0.8;
    for (let k = 0; k < 18; k++) { const x = 200 + R() * 1150, y = 655 + R() * 60; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 30, y - 3, x + 60 + R() * 40, y); ctx.stroke(); }
    deadTree(ctx, 1290, 650, 1.1, R);
    stable(ctx, R);
    hall(ctx);
    gateTower(ctx);
    // 店堂门口的酒坛
    jar(ctx, 790, 646, 26); jar(ctx, 812, 646, 22, '#9a6a3a'); jar(ctx, 800, 626, 20);
    // 酒旗杆（旗面每帧画）
    gb(ctx, rectP(FLAG_GX - 3.5, FLAG_Y - 10, 7, 658 - FLAG_Y), WOOD, { line: 1.1, shade: OCHRE_D, sw: 2, sa: 0.3 });
    gb(ctx, rectP(FLAG_GX - 9, 640, 18, 10), '#cdb489', { line: 0.9 });
    gb(ctx, pathOf((q) => { q.moveTo(FLAG_GX - 5, FLAG_Y - 10); q.quadraticCurveTo(FLAG_GX, FLAG_Y - 34, FLAG_GX + 5, FLAG_Y - 10); q.closePath(); }), GOLD, { line: 0.9 });
    ctx.restore();
  }, { y0: 60, y1: 780 });
}

// ---------- 中景：荒村、枯树（视差 0.7） ----------
function hut(ctx, x0, x1, yb, R, broken) {
  const h = 92, w = x1 - x0;
  const wall = broken
    ? polyP([[x0, yb], [x0, yb - h], [x0 + w * 0.3, yb - h + 6], [x0 + w * 0.42, yb - h + 34], [x0 + w * 0.6, yb - h + 28], [x0 + w * 0.75, yb - h + 58], [x1, yb - h + 52], [x1, yb]])
    : rectP(x0, yb - h, w, h);
  gb(ctx, wall, '#dab27c', { shade: OCHRE, sw: 10, sa: 0.16 });
  ctx.strokeStyle = rgba(OCHRE_D, 0.5); ctx.lineWidth = 0.8;
  for (let y = yb - h + 14; y < yb; y += 14) { ctx.beginPath(); ctx.moveTo(x0 + 2, y); ctx.lineTo(x1 - 2, y + 1); ctx.stroke(); }
  // 门洞（空的）
  gb(ctx, rectP(x0 + w * 0.36, yb - 56, 26, 56), '#b58c5a', { line: 1, shade: OCHRE_D, sw: 6, sa: 0.2 });
  if (!broken) {
    // 塌了一角的茅草顶
    const roof = polyP([[x0 - 14, yb - h + 4], [x0 + w * 0.42, yb - h - 46], [x0 + w * 0.62, yb - h - 30], [x0 + w * 0.7, yb - h - 8], [x1 + 4, yb - h + 18], [x1 - 10, yb - h + 2], [x0 + w * 0.5, yb - h - 14]]);
    gb(ctx, roof, '#c9a668', { shade: OCHRE_D, sw: 8, sa: 0.2 });
    ctx.strokeStyle = rgba(OCHRE_D, 0.75); ctx.lineWidth = 0.7;
    for (let k = 0; k < 26; k++) { const t = k / 26, x = lerp(x0 - 6, x1 - 4, t); ctx.beginPath(); ctx.moveTo(x + 10, yb - h - 30 * Math.sin(t * Math.PI) - 4); ctx.lineTo(x, yb - h + 8); ctx.stroke(); }
    // 断椽
    strokeLine(ctx, [[x0 + w * 0.7, yb - h - 8], [x0 + w * 0.92, yb - h - 30]], 2.2, WOOD);
  } else {
    strokeLine(ctx, [[x0 + w * 0.2, yb - h + 4], [x1 + 10, yb - 8]], 3, WOOD); // 倒下的梁
  }
}
function wheel(ctx, x, y, r) {
  gb(ctx, circP(x, y, r), null, { line: 2.4, ink: WOOD });
  ctx.strokeStyle = WOOD; ctx.lineWidth = 1.6;
  for (let k = 0; k < 8; k++) { const a = (k * TAU) / 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, TAU); ctx.stroke();
}
function midLayer(cg) {
  const o = cg * P_MID;
  return silkStrip(`s12-mid|${cg.toFixed(1)}`, P_MID, (ctx, x0, x1) => {
    const R = rng('s12-mid');
    const top = [];
    for (let x = x0 - 10; x <= x1 + 10; x += 10) top.push([x, 702 + Math.sin(x * 0.013) * 3 + Math.sin(x * 0.041) * 1.5]);
    const p = polyP([...top, [x1 + 10, 1000], [x0 - 10, 1000]]);
    const g = ctx.createLinearGradient(0, 700, 0, 800);
    g.addColorStop(0, '#e6c78c'); g.addColorStop(1, '#ecd29f');
    ctx.fillStyle = g; ctx.fill(p);
    strokeLine(ctx, top, 0.8, rgba(INK, 0.35));
    // 枯草、碎石
    for (let x = x0 + R() * 60; x < x1; x += 50 + R() * 90) {
      const y = 708 + R() * 40;
      ctx.strokeStyle = rgba(OCHRE_D, 0.7); ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = -0.9 + k * 0.36 - 0.25; ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(a) * 8, y - 10, x + Math.sin(a) * 16 - 4, y - 14 - R() * 8); }
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(o, 0);
    hut(ctx, VILLAGE, VILLAGE + 130, 714, R, false);
    wheel(ctx, VILLAGE + 142, 696, 18);
    hut(ctx, VILLAGE + 190, VILLAGE + 340, 716, R, true);
    deadTree(ctx, VILLAGE + 400, 716, 1.3, R);
    ctx.restore();
  }, { y0: 520, y1: 1000 });
}

// ---------- 路面：土路、篱笆菊花、野桥（视差 1） ----------
function chrysanthemum(ctx, x, y, r, col, R) {
  const n = 22;
  for (let ring = 0; ring < 2; ring++) {
    const rr = r * (ring ? 0.62 : 1);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.14 + R() * 0.08;
      const tip = [x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8];
      const p = pathOf((q) => {
        q.moveTo(x + Math.cos(a - 0.12) * rr * 0.25, y + Math.sin(a - 0.12) * rr * 0.2);
        q.quadraticCurveTo(x + Math.cos(a - 0.08) * rr * 0.8, y + Math.sin(a - 0.08) * rr * 0.7, tip[0], tip[1]);
        q.quadraticCurveTo(x + Math.cos(a + 0.08) * rr * 0.8, y + Math.sin(a + 0.08) * rr * 0.7, x + Math.cos(a + 0.12) * rr * 0.25, y + Math.sin(a + 0.12) * rr * 0.2);
      });
      ctx.fillStyle = ring ? col[1] : col[0]; ctx.fill(p);
      ctx.strokeStyle = rgba(INK, 0.6); ctx.lineWidth = 0.5; ctx.stroke(p);
    }
  }
  gb(ctx, circP(x, y, r * 0.2), col[2], { line: 0.6 });
}
function leaf(ctx, x, y, len, a) {
  const p = pathOf((q) => {
    q.moveTo(x, y);
    q.quadraticCurveTo(x + Math.cos(a - 0.5) * len * 0.6, y + Math.sin(a - 0.5) * len * 0.6, x + Math.cos(a) * len, y + Math.sin(a) * len);
    q.quadraticCurveTo(x + Math.cos(a + 0.5) * len * 0.6, y + Math.sin(a + 0.5) * len * 0.6, x, y);
  });
  gb(ctx, p, MAL, { line: 0.7, shade: MAL_D, sw: 3, sa: 0.3 });
  strokeLine(ctx, [[x, y], [x + Math.cos(a) * len * 0.85, y + Math.sin(a) * len * 0.85]], 0.5, rgba(INK, 0.6));
}
function fence(ctx, xa, xb, yb, R) {
  // 竹木篱笆：参差的木桩 + 两道横枝 + 斜插的细枝
  const posts = [];
  for (let x = xa; x <= xb; x += 26 + R() * 10) posts.push([x, 92 + R() * 22]);
  for (const [x, h] of posts) {
    const p = polyP([[x - 4, yb], [x - 3.5, yb - h], [x, yb - h - 5], [x + 3.5, yb - h + 1], [x + 4, yb]]);
    gb(ctx, p, '#c79a5e', { line: 1, shade: OCHRE_D, sw: 2, sa: 0.3 });
  }
  for (const yy of [yb - 70, yb - 38]) {
    ctx.strokeStyle = INK; ctx.lineWidth = 3.6; ctx.beginPath(); ctx.moveTo(xa - 8, yy); ctx.bezierCurveTo(xa + 200, yy - 4, xb - 200, yy + 4, xb + 8, yy); ctx.stroke();
    ctx.strokeStyle = '#b8874b'; ctx.lineWidth = 2.2; ctx.stroke();
  }
  ctx.strokeStyle = rgba(OCHRE_D, 0.9); ctx.lineWidth = 1.2;
  for (let x = xa; x < xb - 20; x += 22) { ctx.beginPath(); ctx.moveTo(x, yb - 6); ctx.lineTo(x + 30, yb - 84); ctx.stroke(); }
}
function bridge(ctx, xa, xb) {
  // 河床（干的，雨后积了一点水）
  const bed = polyP([[xa + 12, 766], [xb - 12, 766], [xb + 30, 1000], [xa - 30, 1000]]);
  const g = ctx.createLinearGradient(0, 766, 0, 1000);
  g.addColorStop(0, '#cfac70'); g.addColorStop(1, '#dcbb80');
  gb(ctx, bed, g, { line: 1.2 });
  const water = polyP([[xa + 120, 812], [xb - 150, 812], [xb - 110, 1000], [xa + 80, 1000]]);
  gb(ctx, water, '#bcd2cc', { line: 0.9, shade: AZ_L, sw: 10, sa: 0.25 });
  ctx.strokeStyle = rgba(WHITE, 0.8); ctx.lineWidth = 1;
  for (let k = 0; k < 9; k++) { const y = 830 + k * 18, x = lerp(xa + 140, xb - 160, (k * 0.37) % 1); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 40, y); ctx.stroke(); }
  const R = rng('s12-bed');
  for (let k = 0; k < 16; k++) { const x = lerp(xa, xb, R()), y = 830 + R() * 160; gb(ctx, ellP(x, y, 6 + R() * 8, 3 + R() * 4), '#c9b48c', { line: 0.8 }); }
  // 桥墩
  for (let x = xa + 40; x < xb; x += 110) gb(ctx, rectP(x - 6, 812, 12, 150 + (x % 3) * 10), WOOD, { line: 1.1, shade: OCHRE_D, sw: 3, sa: 0.3 });
  strokeLine(ctx, [[xa + 40, 870], [xb - 30, 870]], 2, WOOD);
  // 桥面（木板沿进深方向铺）
  const deck = polyP([[xa - 10, 768], [xb + 10, 768], [xb + 14, 806], [xa - 14, 806]]);
  gb(ctx, deck, '#c9965a', { line: 1.2 });
  ctx.strokeStyle = rgba(OCHRE_D, 0.8); ctx.lineWidth = 0.8;
  for (let x = xa - 6; x < xb + 10; x += 14) { ctx.beginPath(); ctx.moveTo(x, 768); ctx.lineTo(x - 2, 806); ctx.stroke(); }
  gb(ctx, rectP(xa - 16, 806, xb - xa + 32, 12), WOOD, { line: 1.2 });
  // 远侧栏杆
  for (let x = xa - 6; x <= xb + 6; x += 47) gb(ctx, rectP(x - 3, 714, 6, 56), WOOD, { line: 0.9 });
  for (const y of [720, 744]) { strokeLine(ctx, [[xa - 12, y], [xb + 12, y]], 3.4, INK); strokeLine(ctx, [[xa - 12, y], [xb + 12, y]], 2, WOOD_L); }
}
function roadLayer(cg) {
  return silkStrip(`s12-road|${cg.toFixed(1)}`, 1, (ctx, x0, x1) => {
    const R = rng('s12-road');
    const top = [];
    for (let x = x0 - 10; x <= x1 + 10; x += 10) top.push([x, 764 + Math.sin(x * 0.011) * 3 + Math.sin(x * 0.037) * 1.5]);
    const p = polyP([...top, [x1 + 10, 1000], [x0 - 10, 1000]]);
    const g = ctx.createLinearGradient(0, 760, 0, 1000);
    g.addColorStop(0, ROAD); g.addColorStop(1, ROAD_D);
    ctx.fillStyle = g; ctx.fill(p);
    strokeLine(ctx, top, 1, rgba(INK, 0.5));
    // 车辙、沙纹
    ctx.strokeStyle = rgba(OCHRE, 0.35); ctx.lineWidth = 0.9;
    for (const y of [848, 912]) {
      ctx.beginPath();
      for (let x = x0; x < x1; x += 70) { if (noise2(x * 0.004, y, 3) < 0.35) continue; ctx.moveTo(x, y + Math.sin(x * 0.01) * 2); ctx.lineTo(x + 56, y + Math.sin((x + 56) * 0.01) * 2); }
      ctx.stroke();
    }
    ctx.strokeStyle = rgba(OCHRE, 0.22); ctx.lineWidth = 0.7;
    for (let k = 0; k < (x1 - x0) / 16; k++) {
      const x = x0 + R() * (x1 - x0), y = 790 + R() * 200, l = 20 + R() * 50;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + l / 2, y - 3, x + l, y); ctx.stroke();
    }
    // 远沿的枯草
    for (let x = x0 + R() * 40; x < x1; x += 30 + R() * 50) {
      const y = 766 + R() * 6;
      ctx.lineWidth = 0.8;
      for (let k = 0; k < 7; k++) {
        const a = -0.8 + k * 0.27 + (R() - 0.5) * 0.2, l = 10 + R() * 16;
        ctx.strokeStyle = k % 3 ? rgba(OCHRE_D, 0.8) : rgba(MAL_D, 0.8);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(a) * l * 0.4, y - l * 0.6, x + Math.sin(a) * l - 3, y - l); ctx.stroke();
      }
    }
    // 卵石
    for (let k = 0; k < (x1 - x0) / 90; k++) {
      const x = x0 + R() * (x1 - x0), y = 800 + R() * 190, r = 3 + R() * 6 * (0.5 + (y - 800) / 200);
      gb(ctx, ellP(x, y, r * 1.4, r), R() < 0.5 ? '#d8c29a' : '#cdb58a', { line: 0.8 });
    }
    ctx.save();
    ctx.translate(cg, 0);
    // 篱笆下的菊花（第 2 小节路过）
    fence(ctx, FENCE[0], FENCE[1], 772, R);
    const cols = [[GOLD_L, '#f3c851', OCHRE], ['#fbf3e0', '#f1e4c2', GOLD], [CIN_L, '#e9876a', GOLD], ['#f6d36a', GOLD_L, CIN]];
    for (let x = FENCE[0] + 6; x < FENCE[1] + 10; x += 22 + R() * 18) {
      const y = 712 + R() * 50;
      strokeLine(ctx, [[x, 776], [x + (R() - 0.5) * 10, y]], 1.2, MAL_D);
      leaf(ctx, x, y + 26, 18, -2.5 - R() * 0.4); leaf(ctx, x, y + 14, 16, -0.5 + R() * 0.4); leaf(ctx, x, y + 40, 15, -2.9 + R() * 0.3);
      chrysanthemum(ctx, x, y - 2, 13 + R() * 9, cols[Math.floor(R() * cols.length)], R);
    }
    bridge(ctx, BRIDGE[0], BRIDGE[1]);
    ctx.restore();
  }, { y0: 640, y1: 1000 });
}
function fgLayer() {
  return strip('s12-fg', P_FG, (ctx, x0, x1) => {
    const R = rng('s12-fg');
    for (let x = x0 + R() * 200; x < x1; x += 320 + R() * 300) {
      const y = 990 + R() * 6;
      for (let k = 0; k < 14; k++) {
        const a = -1 + k * 0.15 + (R() - 0.5) * 0.2, l = 30 + R() * 50;
        ctx.strokeStyle = k % 3 ? rgba(OCHRE_D, 0.85) : rgba(MAL_D, 0.85); ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.sin(a) * l * 0.4, y - l * 0.6, x + Math.sin(a) * l - 6, y - l); ctx.stroke();
      }
      if (R() < 0.5) gb(ctx, ellP(x + 40, y - 6, 22, 12), '#d4bd92', { line: 1.1, shade: OCHRE, sw: 5, sa: 0.2 });
    }
  }, { y0: 880, y1: 1000 });
}

// ---------- 风：每拍的风力（第 1–2 小节顶风，第 3 小节骤雨，第 4 小节风停） ----------
const sandAt = (b) => 1 - 0.6 * smoothstep(GAG - 4.5, GAG - 0.8, b) - 0.4 * smoothstep(GAG - 0.8, GAG, b);
const rainAt = (b) => smoothstep(T_RAIN[0], T_RAIN[1], b) * (1 - smoothstep(T_RAIN[2], T_RAIN[3], b));
const windAt = (b) => lerp(lerp(1, 0.82, smoothstep(GAG - 0.5, GAG + 0.3, b)), 0.3, smoothstep(T_RAIN[2], T_RAIN[3], b));
const sunAt = (b) => smoothstep(T_SUN[0], T_SUN[1], b);

// ---------- 酒旗（朱红空白旗面、泥金犬牙边） ----------
function drawFlag(ctx, b, ox) {
  const x0 = FLAG_GX - 3 + ox, y0 = FLAG_Y, H = 92, L = 176, N = 18;
  const wind = windAt(b), rain = rainAt(b);
  const top = [], bot = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const wave = Math.sin(u * 7 - b * Math.PI * 3.2) * (4 + 7 * wind) * u + Math.sin(u * 13 - b * Math.PI * 5.1) * 2 * u * wind;
    const droop = (1 - wind) * u * u * 62 + rain * u * u * 10;
    const x = x0 - u * L * (1 - (1 - wind) * 0.18 * u);
    top.push([x, y0 + wave + droop]);
    bot.push([x + droop * 0.2, y0 + H * (1 - 0.1 * u) + wave * 1.1 + droop * 1.05]);
  }
  // 犬牙边：沿下沿和旗尾
  const teeth = [];
  for (let i = N; i >= 0; i--) {
    const [x, y] = bot[i];
    teeth.push([x, y]);
    if (i > 0) { const [xn, yn] = bot[i - 1]; teeth.push([(x + xn) / 2, (y + yn) / 2 + 9]); }
  }
  const shape = polyP([...top, ...teeth]);
  gb(ctx, shape, CIN, { line: 1.2, shade: CIN_D, sw: 8, sa: 0.18 });
  // 泥金镶边（沿上沿和下沿内侧）
  ctx.strokeStyle = GOLD_L; ctx.lineWidth = 2.2;
  ctx.beginPath(); top.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + 6) : ctx.moveTo(x, y + 6))); ctx.stroke();
  ctx.beginPath(); bot.forEach(([x, y], i) => (i ? ctx.lineTo(x, y - 4) : ctx.moveTo(x, y - 4))); ctx.stroke();
  // 旗心一块空白的泥金框（不写字）
  const q = [top[4], top[12], bot[12], bot[4]].map(([x, y], i) => [x, y + (i < 2 ? 18 : -18)]);
  gb(ctx, polyP(q), rgba(GOLD_L, 0.35), { line: 1, ink: GOLD_D });
  // 淋湿：颜色变深
  if (rain > 0) { ctx.save(); ctx.globalAlpha = 0.35 * rain; gb(ctx, shape, CIN_D, { line: 0 }); ctx.restore(); }
  // 雨点打在旗上：溅起的小水花
  if (rain > 0.05) {
    ctx.fillStyle = rgba(WHITE, 0.9 * rain);
    for (let i = 0; i < 9; i++) {
      const ph0 = b * 3 + hash2(i, 1, 41), cyc = Math.floor(ph0), ph = ph0 - cyc;
      const u = 0.1 + hash2(i, cyc, 42) * 0.85, k = Math.round(u * N);
      const [x, y] = top[k];
      const yy = y + 4 + hash2(i, cyc, 43) * (H - 20);
      if (ph > 0.35) continue;
      const s = ph / 0.35;
      ctx.beginPath();
      for (const d of [-1, -0.45, 0, 0.45, 1]) { ctx.moveTo(x + d * (3 + s * 9) + 1.4, yy - (3 + s * 8) * (1.1 - Math.abs(d) * 0.5)); ctx.arc(x + d * (3 + s * 9), yy - (3 + s * 8) * (1.1 - Math.abs(d) * 0.5), 1.4 * (1 - s * 0.5), 0, TAU); }
      ctx.fill();
    }
  }
}

// ---------- 灯笼 ----------
function drawLantern(ctx, x, y, r, swing, lit) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(swing);
  strokeLine(ctx, [[0, 0], [0, 12]], 1, INK);
  const cy = 12 + r * 1.05;
  if (lit > 0) {
    const g = ctx.createRadialGradient(0, cy, r * 0.3, 0, cy, r * 3.2);
    g.addColorStop(0, `rgba(255,214,140,${0.8 * lit})`); g.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = g; ctx.fillRect(-r * 3.2, cy - r * 3.2, r * 6.4, r * 6.4);
  }
  const body = ellP(0, cy, r * 0.92, r);
  const bg = ctx.createRadialGradient(-r * 0.2, cy - r * 0.2, 1, 0, cy, r);
  bg.addColorStop(0, lerpHex(CIN_L, '#ffd07a', lit)); bg.addColorStop(1, lerpHex(CIN, '#e8603c', lit));
  gb(ctx, body, bg, { line: 1.1 });
  ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 0.7;
  for (const k of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.ellipse(0, cy, Math.abs(k) * r * 0.92 + 0.01, r, 0, -Math.PI / 2, Math.PI / 2, k < 0); ctx.stroke(); }
  gb(ctx, rectP(-r * 0.45, cy - r - 4, r * 0.9, 5), GOLD, { line: 0.8 });
  gb(ctx, rectP(-r * 0.45, cy + r - 1, r * 0.9, 5), GOLD, { line: 0.8 });
  // 流苏
  ctx.strokeStyle = CIN; ctx.lineWidth = 1.1;
  ctx.beginPath(); for (const d of [-3, -1, 1, 3]) { ctx.moveTo(d, cy + r + 4); ctx.lineTo(d * 1.3 - swing * 30, cy + r + 20); } ctx.stroke();
  ctx.restore();
}
function lerpHex(a, b, t) {
  const A = rgbf(a), B2 = rgbf(b);
  return `rgb(${A.map((v, i) => Math.round((v + (B2[i] - v) * t) * 255)).join(',')})`;
}

// ---------- 窗里的女子（侧影投在窗纸上，面朝左） ----------
function womanPath(tea) {
  const cx = 756, p = new Path2D();
  // 头、发髻、簪
  p.ellipse(cx, 432, 12, 14, 0.15, 0, TAU);
  p.moveTo(cx + 22, 418); p.ellipse(cx + 13, 418, 9, 8, 0, 0, TAU);
  p.moveTo(cx - 12, 433); p.lineTo(cx - 16, 437); p.lineTo(cx - 11, 440); p.closePath(); // 鼻尖
  // 颈、肩、身（到窗下沿）
  p.moveTo(cx - 6, 442); p.lineTo(cx + 6, 442); p.lineTo(cx + 8, 456);
  p.quadraticCurveTo(cx + 26, 458, cx + 34, 490); p.lineTo(cx - 34, 490); p.quadraticCurveTo(cx - 26, 460, cx - 8, 456); p.closePath();
  if (tea) {
    // 抬起的手臂和茶盏
    p.moveTo(cx - 14, 462); p.quadraticCurveTo(cx - 34, 468, cx - 30, 448); p.lineTo(cx - 24, 446); p.quadraticCurveTo(cx - 24, 460, cx - 8, 458); p.closePath();
    p.moveTo(cx - 40, 442); p.lineTo(cx - 22, 442); p.lineTo(cx - 25, 450); p.lineTo(cx - 37, 450); p.closePath();
  }
  return p;
}
function drawWindow(ctx, b, ox) {
  ctx.save();
  ctx.translate(ox, 0);
  const lit = smoothstep(T_LAMP[0], T_LAMP[1], b);
  const win = rectP(WIN.x0, WIN.y0, WIN.x1 - WIN.x0, WIN.y1 - WIN.y0);
  ctx.fillStyle = '#efe2c2'; ctx.fill(win);
  if (lit > 0) {
    ctx.save(); ctx.clip(win);
    const dy = WIN.y0 - 396;
    const g = ctx.createRadialGradient(762, 446 + dy, 6, 762, 446 + dy, 90);
    g.addColorStop(0, `rgba(255,224,140,${lit})`); g.addColorStop(1, `rgba(248,206,120,${0.75 * lit})`);
    ctx.fillStyle = g; ctx.fill(win);
    const tea = smoothstep(T_TEA[0], T_TEA[1], b);
    ctx.translate(0, dy);
    ctx.fillStyle = `rgba(118,74,44,${0.85 * lit})`;
    ctx.fill(womanPath(tea > 0.5));
    if (tea > 0.5) {
      // 茶的热气
      ctx.strokeStyle = `rgba(118,74,44,${0.5 * lit * (tea - 0.5) * 2})`; ctx.lineWidth = 1.2;
      for (const d of [0, 7]) {
        ctx.beginPath();
        for (let k = 0; k <= 10; k++) { const yy = 438 - k * 3.2, xx = 724 + d + Math.sin(k * 0.8 - b * Math.PI * 2 + d) * 3; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // 窗棂
  ctx.strokeStyle = WOOD; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 1; i < 5; i++) { const x = lerp(WIN.x0, WIN.x1, i / 5); ctx.moveTo(x, WIN.y0); ctx.lineTo(x, WIN.y1); }
  for (let j = 1; j < 4; j++) { const y = lerp(WIN.y0, WIN.y1, j / 4); ctx.moveTo(WIN.x0, y); ctx.lineTo(WIN.x1, y); }
  ctx.stroke();
  ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(win);
  ctx.restore();
}

// ---------- 柳树（定格时柳枝朝窗口弯下腰） ----------
const ANCH = [[-50, -18], [-34, -42], [-14, -56], [6, -60], [24, -50], [38, -32], [-40, 8], [34, 12], [-8, -30], [16, -22]];
function bowAt(b) {
  // 第 1–2 小节被顶风吹向左；第 3 小节朝窗口（右）弯下腰；第 4 小节轻摆
  const blown = -0.5 + 0.1 * Math.sin(b * Math.PI * 1.3);
  const sway = 0.12 * Math.sin(b * Math.PI);
  const toWin = 0.95 + 0.04 * Math.sin(b * Math.PI * 2);
  const k1 = ease.inOut(smoothstep(T_BOW[0], T_BOW[1], b)), k2 = ease.inOut(smoothstep(T_BOW[2], T_BOW[3], b));
  return lerp(lerp(blown, toWin, k1), sway, k2);
}
function drawWillow(ctx, b, ox) {
  const bend = bowAt(b);
  const pos = Math.max(0, bend), neg = Math.max(0, -bend);
  const bx = WILLOW.gx + ox, by = WILLOW.y;
  const tx = bx - 6 + 44 * pos - 12 * neg, ty = 362 + 26 * pos;
  // 树干（上段跟着折腰）
  const trunk = pathOf((q) => {
    q.moveTo(bx - 9, by); q.quadraticCurveTo(bx - 14, by - 150, tx - 4, ty);
    q.lineTo(tx + 4, ty); q.quadraticCurveTo(bx + 2, by - 150, bx + 9, by); q.closePath();
  });
  gb(ctx, trunk, '#8b6a46', { line: 1.2, shade: OCHRE_D, sw: 4, sa: 0.3 });
  strokeLine(ctx, [[bx - 4, by - 20], [bx - 7, by - 90], [bx - 2, by - 140]], 0.7, rgba(INK, 0.5));
  const lines = new Path2D(), leafA = new Path2D(), leafB = new Path2D();
  ctx.strokeStyle = '#6b5236'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ANCH.forEach(([ax, ay], ai) => {
    const x = tx + ax + 22 * pos * (ax > -10 ? 1 : 0.6), y = ty + ay + 22 * pos + (ax > 0 ? ax * 0.4 * pos : 0);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.quadraticCurveTo(tx + ax * 0.4, ty + ay * 1.2, x, y); ctx.stroke(); // 枝
    for (let s = 0; s < 6; s++) {
      const id = ai * 6 + s;
      const L = 130 + hash2(id, 1, 61) * 150;
      const fl = 0.07 * Math.sin(b * Math.PI * 2.2 + id * 0.7);
      let px = x + (s - 2.5) * 3.2, py = y, phi = 0;
      lines.moveTo(px, py);
      const N = 14;
      for (let i = 1; i <= N; i++) {
        const t = i / N;
        phi = (bend * (0.85 + 0.3 * hash2(id, 2, 61))) * Math.pow(0.3 + 0.7 * t, 1.6) + fl * t;
        const ds = L / N;
        px += Math.sin(phi) * ds; py += Math.cos(phi) * ds;
        lines.lineTo(px, py);
        if (i > 1) {
          const la = Math.PI / 2 - phi + (i % 2 ? 0.55 : -0.55);
          const P = i % 3 ? leafA : leafB;
          const lx = px + Math.cos(la) * 5, ly = py + Math.sin(la) * 5;
          P.moveTo(lx + Math.cos(la) * 6.5, ly + Math.sin(la) * 6.5);
          P.ellipse(lx, ly, 6.5, 2.1, la, 0, TAU);
        }
      }
    }
  });
  ctx.strokeStyle = '#6f7d45'; ctx.lineWidth = 0.9; ctx.stroke(lines);
  ctx.fillStyle = MAL; ctx.fill(leafA);
  ctx.fillStyle = '#8fbf86'; ctx.fill(leafB);
}

// ---------- 鹤（第 2 小节飞过） ----------
function drawCrane(ctx, b) {
  const k = (b - T_CRANE[0]) / (T_CRANE[1] - T_CRANE[0]);
  if (k <= 0 || k >= 1) return;
  const x = lerp(1480, -480, k), y = 112 + Math.sin(k * 5) * 10;
  const w = Math.sin(b * Math.PI * 2.4);
  ctx.save();
  ctx.translate(x, y); ctx.scale(0.75, 0.75);
  // 远翼
  gb(ctx, polyP([[2, -4], [26 - 8 * w, -44 * w - 6], [44 - 6 * w, -40 * w - 4], [20, 0]]), '#efe9da', { line: 0.9 });
  gb(ctx, polyP([[26 - 8 * w, -44 * w - 6], [44 - 6 * w, -40 * w - 4], [36, -30 * w]]), INK, { line: 0 });
  // 身、颈、头
  gb(ctx, ellP(4, 0, 28, 9, 0.05), WHITE, { line: 0.9 });
  strokeLine(ctx, [[-20, -2], [-46, -6], [-62, -5]], 3.2, INK);
  gb(ctx, circP(-64, -6, 4), WHITE, { line: 0.8 });
  ctx.fillStyle = CIN; ctx.beginPath(); ctx.arc(-64, -9, 2.2, 0, TAU); ctx.fill();
  strokeLine(ctx, [[-67, -5], [-86, -2]], 1.6, OCHRE);
  gb(ctx, polyP([[26, -4], [44, -2], [42, 6], [28, 4]]), INK, { line: 0 }); // 尾羽
  strokeLine(ctx, [[30, 2], [70, 6]], 1.2, INK); strokeLine(ctx, [[30, 4], [68, 10]], 1.2, INK);
  // 近翼
  gb(ctx, polyP([[-6, -2], [14 - 10 * w, 44 * w + 2], [34 - 8 * w, 40 * w + 6], [16, 2]]), WHITE, { line: 0.9 });
  gb(ctx, polyP([[14 - 10 * w, 44 * w + 2], [34 - 8 * w, 40 * w + 6], [28, 28 * w]]), INK, { line: 0 });
  ctx.restore();
}

// ---------- 两匹快马（剪影像刀光） ----------
function horse(ctx, x, y, s, ph) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.translate(0, Math.sin(ph * TAU * 2) * 3);
  const C = '#2a211c';
  ctx.fillStyle = C; ctx.strokeStyle = C; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // 腿
  const legs = [[40, -84, 0, 1], [30, -84, 0.12, 1], [-44, -88, 0.5, -1], [-54, -88, 0.62, -1]];
  for (const [lx, ly, o, f] of legs) {
    const a = Math.sin((ph + o) * TAU);
    const th1 = a * 0.8 + 0.1 * f;
    const kx = lx + Math.sin(th1) * 34, ky = ly + Math.cos(th1) * 34;
    const bend = Math.max(0, Math.cos((ph + o) * TAU)) * 1.3 * f;
    const th2 = th1 - bend;
    ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(kx, ky); ctx.stroke();
    ctx.lineWidth = 5.5; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.sin(th2) * 40, ky + Math.cos(th2) * 40); ctx.stroke();
  }
  // 身、颈、头、尾
  ctx.beginPath(); ctx.ellipse(-4, -96, 62, 24, -0.04, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(30, -112); ctx.quadraticCurveTo(58, -150, 80, -164); ctx.lineTo(114, -142); ctx.lineTo(108, -132); ctx.lineTo(86, -138); ctx.quadraticCurveTo(70, -112, 50, -84); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(78, -164); ctx.lineTo(82, -178); ctx.lineTo(88, -162); ctx.fill();
  ctx.lineWidth = 7;
  ctx.beginPath(); ctx.moveTo(-62, -106); ctx.quadraticCurveTo(-100, -116 + Math.sin(ph * TAU) * 6, -132, -98 + Math.sin(ph * TAU + 1) * 8); ctx.stroke();
  // 鬃毛
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(50 + k * 8, -138 - k * 8); ctx.lineTo(28 + k * 6, -150 - k * 8 + Math.sin(ph * TAU + k) * 3); ctx.stroke(); }
  // 骑者：斗笠、披风、背上的剑
  ctx.beginPath(); ctx.moveTo(-14, -114); ctx.lineTo(4, -162); ctx.lineTo(22, -158); ctx.lineTo(18, -112); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.ellipse(16, -170, 9, 10, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, -176); ctx.lineTo(16, -194); ctx.lineTo(46, -176); ctx.quadraticCurveTo(16, -170, -14, -176); ctx.fill();
  ctx.beginPath(); ctx.moveTo(4, -160); ctx.quadraticCurveTo(-40, -170 + Math.sin(ph * TAU) * 8, -86, -146 + Math.sin(ph * TAU + 2) * 10); ctx.lineTo(-70, -136); ctx.quadraticCurveTo(-30, -146, -6, -130); ctx.closePath(); ctx.fill();
  ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(18, -150); ctx.lineTo(46, -128); ctx.stroke();
  ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-10, -170); ctx.lineTo(34, -126); ctx.stroke();
  // 刀光一样的亮边：背、颈、斗笠、剑
  ctx.strokeStyle = 'rgba(255,252,240,0.95)'; ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(-58, -118); ctx.quadraticCurveTo(-10, -124, 30, -114); ctx.quadraticCurveTo(58, -150, 80, -164); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -177); ctx.lineTo(16, -193); ctx.lineTo(44, -177); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, -172); ctx.lineTo(32, -131); ctx.stroke();
  ctx.restore();
}
function horseX(b, k) {
  const t0 = T_HORSE[0] + k * 0.22, t1 = T_HORSE[1] + k * 0.22;
  return lerp(-560, 1560, (b - t0) / (t1 - t0));
}
function drawHorses(ctx, b) {
  if (b < T_HORSE[0] - 0.5 || b > T_HORSE[1] + 1.8) return;
  for (let k = 0; k < 2; k++) {
    const t0 = T_HORSE[0] + k * 0.22, t1 = T_HORSE[1] + k * 0.22, yb = 736 + k * 12, s = 0.95 + k * 0.08;
    // 卷起的尘土：沿路线留下，慢慢胀大变淡
    for (let i = 0; i < 26; i++) {
      const tk = t0 + (i / 26) * (t1 - t0);
      const age = b - tk;
      if (age < 0 || age > 1.6) continue;
      const x = horseX(tk, k) - 40 - age * 60, r = 18 + age * 46 + hash2(i, k, 51) * 10;
      const a = 0.32 * (1 - age / 1.6);
      const g = ctx.createRadialGradient(x, yb - r * 0.4, 0, x, yb - r * 0.4, r);
      g.addColorStop(0, rgba(SAND_L, a)); g.addColorStop(1, rgba(SAND_L, 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, yb - r * 1.4, 2 * r, 2 * r);
    }
    if (b < t0 || b > t1) continue;
    const x = horseX(b, k);
    // 刀光：一道细长的亮痕拖在后面
    for (const [hy, L, th] of [[118, 520, 4], [176, 380, 2.6], [60, 300, 2]]) {
      const g = ctx.createLinearGradient(x - L, 0, x, 0);
      g.addColorStop(0, 'rgba(255,252,238,0)'); g.addColorStop(1, 'rgba(255,252,238,0.95)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x - L, yb - hy * s + 2); ctx.lineTo(x - 20, yb - hy * s - th); ctx.lineTo(x - 20, yb - hy * s + th * 0.4); ctx.closePath(); ctx.fill();
    }
    horse(ctx, x, yb, s, b * 2.6 + k * 0.4);
  }
}

// ---------- 剑：裹着布插在泥里；第 11 拍布被吹开、出鞘一半一闪，第 12 拍收回 ----------
function swordState(b) {
  const unwrap = smoothstep(T_UNWRAP[0], T_UNWRAP[1], b);
  const up = ease.out(smoothstep(T_DRAW[0], T_DRAW[1], b)) * (1 - ease.in(smoothstep(T_SHEATHE[0], T_SHEATHE[1], b)));
  const flash = b >= T_FLASH[0] && b < T_FLASH[1] ? Math.pow(1 - (b - T_FLASH[0]) / (T_FLASH[1] - T_FLASH[0]), 1.6) * smoothstep(T_FLASH[0], T_FLASH[0] + 0.06, b) : 0;
  return { unwrap, up, flash };
}
const SWORD_TILT = 0.12, SHEATH = 150, HILT = 46, RISE = 74;
function drawSword(ctx, b, ox) {
  const x = SWORD_GX + ox, y = 796;
  if (x < X_MIN - 300 || x > X_MAX + 200) return;
  const S = swordState(b);
  // 泥堆
  gb(ctx, ellP(x, y + 3, 30, 8), '#a8814f', { line: 1 });
  gb(ctx, ellP(x - 4, y + 1, 16, 4), '#8f6c41', { line: 0 });
  ctx.save();
  ctx.translate(x, y); ctx.rotate(SWORD_TILT);
  const rise = S.up * RISE;
  // 剑身（出鞘的一段）
  if (rise > 0.5) {
    const blade = rectP(-4.2, -SHEATH - rise, 8.4, rise + 2);
    const g = ctx.createLinearGradient(-4, 0, 4, 0);
    g.addColorStop(0, '#e6eef2'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#a9bccb');
    gb(ctx, blade, g, { line: 1 });
    strokeLine(ctx, [[0, -SHEATH], [0, -SHEATH - rise]], 0.7, rgba(AZ_D, 0.6));
  }
  // 剑鞘：黑漆 + 泥金饰件
  const sh = rectP(-6.5, -SHEATH, 13, SHEATH);
  gb(ctx, sh, '#2e2420', { line: 1.1 });
  for (const yy of [-SHEATH, -SHEATH * 0.55, -14]) gb(ctx, rectP(-7.5, yy, 15, 9), GOLD, { line: 0.8 });
  // 剑柄
  ctx.save();
  ctx.translate(0, -rise);
  gb(ctx, pathOf((q) => { q.moveTo(-20, -SHEATH - 2); q.quadraticCurveTo(0, -SHEATH - 12, 20, -SHEATH - 2); q.lineTo(14, -SHEATH + 3); q.quadraticCurveTo(0, -SHEATH - 4, -14, -SHEATH + 3); q.closePath(); }), GOLD, { line: 1 });
  const grip = rectP(-4.5, -SHEATH - HILT, 9, HILT - 6);
  gb(ctx, grip, CIN_D, { line: 1 });
  ctx.save(); ctx.clip(grip); ctx.strokeStyle = GOLD_L; ctx.lineWidth = 1; ctx.beginPath();
  for (let k = 0; k < 9; k++) { const yy = -SHEATH - HILT + k * 6; ctx.moveTo(-5, yy); ctx.lineTo(5, yy + 5); } ctx.stroke(); ctx.restore();
  gb(ctx, circP(0, -SHEATH - HILT - 4, 5.5), GOLD, { line: 1 });
  // 剑穗
  const tw = windAt(b);
  const tp = [[0, -SHEATH - HILT - 8], [-14 - 20 * tw, -SHEATH - HILT + 4 + Math.sin(b * 9) * 3], [-26 - 30 * tw, -SHEATH - HILT + 22 + Math.sin(b * 9 + 1) * 5]];
  strokeLine(ctx, tp, 2.4, CIN);
  ctx.restore();
  // 裹剑的布：一截麻布把鞘和柄整个裹住，两道朱砂绳；被风吹开时从两头往鞘口松脱，变成一条飘着的长布
  const cloth = S.unwrap, MOUTH = SHEATH - 6;
  const yTop = -(SHEATH + HILT + 8) + (HILT + 14) * cloth, yBot = -4 - (MOUTH - 10) * cloth;
  if (yBot - yTop > 6) {
    const sl = pathOf((q) => { q.moveTo(-9, yBot); q.lineTo(-9, yTop + 6); q.quadraticCurveTo(0, yTop - 4, 9, yTop + 6); q.lineTo(9, yBot); q.closePath(); });
    gb(ctx, sl, '#e9dcbc', { line: 1, shade: OCHRE_L, sw: 4, sa: 0.35 });
    ctx.save(); ctx.clip(sl);
    ctx.strokeStyle = rgba(OCHRE_D, 0.75); ctx.lineWidth = 0.8;
    ctx.beginPath(); for (let yy = yBot - 2; yy > yTop; yy -= 9) { ctx.moveTo(-10, yy); ctx.lineTo(10, yy - 7); } ctx.stroke();
    ctx.restore();
    for (const yy of [-40, -SHEATH - 8]) if (yy > yTop + 4 && yy < yBot - 2) gb(ctx, rectP(-10, yy - 2, 20, 4), CIN, { line: 0.8 });
  }
  // 布头：系在剑上，随风往左飘；吹开以后变长
  const len = 34 + 150 * cloth, w = windAt(b);
  const ay = cloth < 1 ? yTop + 8 : -MOUTH;
  const pts = [];
  const ground = (cloth < 1 ? -ay : MOUTH) - 3;
  for (let i = 0; i <= 14; i++) {
    const u = i / 14, d = u * len;
    // 有风：往左飘；风停：顺着剑垂下来，多出来的一截堆在地上
    const fx = -d * 0.95, fy = Math.sin(u * 6 - b * Math.PI * 4) * (2 + 10 * u) * u + u * 6;
    const hy = Math.min(d * 0.97, ground), hx = -Math.max(0, d - ground) * 0.9 - 6 * Math.sin(u * 3.1) - 4 * u;
    pts.push([lerp(hx, fx, w), lerp(hy, fy, w)]);
  }
  const half = (u) => 6 + 1.5 * Math.sin(u * 9 + b * 5);
  const rib = polyP([...pts.map(([px, py], i) => [px, py - half(i / 14)]), ...pts.slice().reverse().map(([px, py], i) => [px, py + half(1 - i / 14)])]);
  ctx.translate(0, ay);
  ctx.rotate(-SWORD_TILT);
  gb(ctx, rib, '#e3d2a8', { line: 1, shade: OCHRE, sw: 3, sa: 0.3 });
  strokeLine(ctx, pts.slice(2).map(([x, y]) => [x, y + 2]), 0.7, rgba(OCHRE_D, 0.7));
  ctx.restore();
  // 闪光：出鞘那一刻剑身上一点星芒 + 一道横贯的刀光
  if (S.flash > 0) {
    const f = S.flash;
    const gx = x + Math.sin(SWORD_TILT) * (SHEATH + rise * 0.5), gy = y - Math.cos(SWORD_TILT) * (SHEATH + rise * 0.5);
    const rg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 160);
    rg.addColorStop(0, `rgba(255,255,248,${0.75 * f})`); rg.addColorStop(1, 'rgba(255,250,230,0)');
    ctx.fillStyle = rg; ctx.fillRect(gx - 160, gy - 160, 320, 320);
    ctx.fillStyle = `rgba(255,255,252,${0.95 * f})`;
    const L = 70 + 60 * f;
    ctx.beginPath(); ctx.moveTo(gx - L * 0.35, gy); ctx.lineTo(gx, gy - 3); ctx.lineTo(gx + L * 6, gy - 0.5); ctx.lineTo(gx, gy + 3); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(gx, gy - L * 0.8); ctx.lineTo(gx + 3, gy); ctx.lineTo(gx, gy + L * 0.8); ctx.lineTo(gx - 3, gy); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(gx - 20 * f, gy - 20 * f); ctx.lineTo(gx + 1.5, gy - 1.5); ctx.lineTo(gx + 20 * f, gy + 20 * f); ctx.lineTo(gx - 1.5, gy + 1.5); ctx.closePath(); ctx.fill();
  }
}

// ---------- 窗棂的影子（第 4 小节雨歇日出，斜斜落在路上） ----------
function drawLatticeShadow(ctx, b, ox) {
  const k = sunAt(b);
  if (k <= 0) return;
  const [xa, xb] = LATTICE.map((v) => v + ox);
  if (xb < X_MIN || xa - 120 > X_MAX) return;
  const sk = -110, y0 = 790, y1 = 880;
  const P = (u, v) => [lerp(xa, xb, u) + sk * v, lerp(y0, y1, v)];
  ctx.save();
  ctx.globalAlpha = k;
  const quad = polyP([P(0, 0), P(1, 0), P(1, 1), P(0, 1)]);
  const g = ctx.createLinearGradient(xa, 0, xb, 0);
  g.addColorStop(0, 'rgba(255,244,206,0)'); g.addColorStop(0.2, 'rgba(255,244,206,0.6)'); g.addColorStop(0.8, 'rgba(255,244,206,0.6)'); g.addColorStop(1, 'rgba(255,244,206,0)');
  ctx.fillStyle = g; ctx.fill(quad);
  ctx.strokeStyle = 'rgba(140,96,50,0.5)'; ctx.lineWidth = 4.2;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) { const [ax, ay] = P(0.08 + i * 0.14, 0.05), [bx2, by2] = P(0.08 + i * 0.14, 0.95); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); }
  for (let j = 0; j <= 3; j++) { const [ax, ay] = P(0.08, 0.05 + j * 0.3), [bx2, by2] = P(0.92, 0.05 + j * 0.3); ctx.moveTo(ax, ay); ctx.lineTo(bx2, by2); }
  ctx.stroke();
  ctx.restore();
}

// ---------- 风沙（第 1–2 小节）：沙线、滚动的尘团、他身边卷过的沙带 ----------
/** 风沙的沙雾、沙幕、尘团：画在人物后面（人物不被罩淡）。 */
function drawSandBack(ctx, b, cam) {
  const amt = sandAt(b);
  if (amt <= 0.01) return;
  const span = X_MAX - X_MIN + 400;
  ctx.save();
  ctx.fillStyle = rgba(SAND_L, 0.2 * amt); ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
  // 一层层卷过的沙幕（宽的波浪带）
  for (let k = 0; k < 5; k++) {
    const y0 = 200 + k * 150 + Math.sin(b * 1.3 + k) * 20, ph = b * (2.4 + k * 0.3) + k;
    const band = new Path2D();
    band.moveTo(X_MIN - 50, y0);
    for (let x = X_MIN - 50; x <= X_MAX + 50; x += 40) band.lineTo(x, y0 + Math.sin(x * 0.006 + ph) * 34 + Math.sin(x * 0.017 - ph * 1.7) * 10);
    for (let x = X_MAX + 50; x >= X_MIN - 50; x -= 40) band.lineTo(x, y0 + 60 + Math.sin(x * 0.006 + ph + 0.8) * 30 + Math.sin(x * 0.021 - ph) * 8);
    band.closePath();
    ctx.fillStyle = rgba(k % 2 ? SAND_L : '#f6e6bf', 0.24 * amt); ctx.fill(band);
  }
  // 尘团
  for (let i = 0; i < 7; i++) {
    const sp = 380 + hash2(i, 1, 71) * 260;
    const x = ((((hash2(i, 2, 71) * span - b * sp - cam * 0.6) % span) + span) % span) + X_MIN - 200;
    const y = 640 + hash2(i, 3, 71) * 260, r = 130 + hash2(i, 4, 71) * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(SAND_L, 0.34 * amt)); g.addColorStop(1, rgba(SAND_L, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
}
/** 沙线：细而快，从右往左，画在人物前面。 */
function drawSand(ctx, b, cam) {
  const amt = sandAt(b);
  if (amt <= 0.01) return;
  const span = X_MAX - X_MIN + 400;
  ctx.save();
  ctx.lineCap = 'round';
  const n = Math.round(280 * amt);
  const pa = new Path2D(), pb = new Path2D();
  for (let i = 0; i < n; i++) {
    const sp = 900 + hash2(i, 5, 72) * 900, len = 30 + hash2(i, 6, 72) * 90;
    const x = ((((hash2(i, 7, 72) * span - b * sp - cam) % span) + span) % span) + X_MIN - 200;
    const y = 60 + hash2(i, 8, 72) * 930 + Math.sin(b * 3 + i) * 6;
    const P = i % 3 ? pa : pb;
    P.moveTo(x, y); P.quadraticCurveTo(x + len * 0.5, y - 2, x + len, y + 1.5);
  }
  ctx.strokeStyle = rgba('#fff6dc', 0.75 * amt); ctx.lineWidth = 1.6; ctx.stroke(pa);
  ctx.strokeStyle = rgba(OCHRE, 0.42 * amt); ctx.lineWidth = 1.2; ctx.stroke(pb);
  ctx.restore();
}
/** 他身后卷过的沙带（替代「衣角翻飞」：人物不加动作，用风沙表现）。画在人物后面。 */
function drawSandRibbons(ctx, b) {
  const amt = sandAt(b) * (1 - smoothstep(GAG - 1, GAG, b));
  if (amt <= 0.01) return;
  ctx.save();
  for (let k = 0; k < 3; k++) {
    const ph = ((b * 0.9 + k * 0.37) % 1 + 1) % 1;
    const cx = lerp(760, -120, ph), cy = 560 + k * 80;
    const a = Math.sin(Math.PI * ph) * 0.5 * amt;
    const pts = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([cx + u * 360, cy + Math.sin(u * 5 + b * 4 + k) * (14 + 10 * u) - u * 30]); }
    for (let w = 0; w < 3; w++) {
      ctx.strokeStyle = rgba(w ? SAND_L : '#fff4d8', a * (w ? 0.5 : 0.8)); ctx.lineWidth = w ? 9 - w * 3 : 2;
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + w * 4) : ctx.moveTo(x, y + w * 4))); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---------- 刀痕：风变成一道道白色的弧形刀痕（第 3 小节） ----------
const SLASHES = [
  { t: GAG - 0.08, a: [1440, 90], b: [-300, 520], c: 0.14, w: 11 },
  { t: GAG + 0.1, a: [1420, 640], b: [480, 990], c: -0.12, w: 8 },
  { t: GAG + 0.45, a: [1300, 300], b: [560, 420], c: 0.12, w: 7 },
  { t: GAG + 0.95, a: [-380, 780], b: [230, 540], c: -0.2, w: 8 },
  { t: GAG + 0.95, a: [1440, 440], b: [640, 760], c: 0.15, w: 9 },
  { t: GAG + 1.45, a: [1150, 40], b: [560, 290], c: -0.1, w: 6 },
  { t: GAG + 1.95, a: [1440, 700], b: [600, 920], c: 0.12, w: 8 },
  { t: GAG + 2.95, a: [1400, 220], b: [700, 400], c: 0.1, w: 6 },
];
function drawSlashes(ctx, b) {
  ctx.save();
  for (const S of SLASHES) {
    const age = b - S.t;
    if (age < 0 || age > 0.7) continue;
    const head = clamp(age / 0.14), tail = clamp((age - 0.18) / 0.5);
    const a = 1 - smoothstep(0.35, 0.7, age);
    const [ax, ay] = S.a, [bx2, by2] = S.b;
    const mx = (ax + bx2) / 2 - (by2 - ay) * S.c, my = (ay + by2) / 2 + (bx2 - ax) * S.c;
    const pt = (u) => [(1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * bx2, (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * by2];
    const N = 24, L = [], Rr = [];
    for (let i = 0; i <= N; i++) {
      const u = lerp(tail, head, i / N);
      const [x, y] = pt(u), [x2, y2] = pt(Math.min(1, u + 0.01));
      let dx = x2 - x, dy = y2 - y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const w = S.w * Math.sin(Math.PI * (i / N)) * (0.4 + 0.6 * Math.sin(Math.PI * u));
      L.push([x - dy * w, y + dx * w]); Rr.push([x + dy * w * 0.3, y - dx * w * 0.3]);
    }
    const blade = polyP([...L, ...Rr.reverse()]);
    ctx.save(); ctx.translate(2, 3); ctx.fillStyle = `rgba(176,128,60,${0.35 * a})`; ctx.fill(blade); ctx.restore();
    ctx.fillStyle = `rgba(255,255,250,${0.95 * a})`;
    ctx.fill(blade);
    ctx.strokeStyle = `rgba(255,255,250,${0.35 * a})`; ctx.lineWidth = 1;
    ctx.beginPath(); for (let i = 0; i <= N; i++) { const [x, y] = pt(lerp(tail, head, i / N)); i ? ctx.lineTo(x, y + 9) : ctx.moveTo(x, y + 9); } ctx.stroke();
  }
  ctx.restore();
}

// ---------- 骤雨（灰黄雨幕，画面保持明亮） ----------
const RAIN = [
  { n: 200, len: [16, 28], w: 1.0, a: 0.55, sp: 1700, seed: 1 },
  { n: 150, len: [34, 56], w: 1.5, a: 0.55, sp: 2200, seed: 2 },
  { n: 40, len: [90, 140], w: 2.2, a: 0.45, sp: 3000, seed: 3 },
];
const SLANT = -0.32;
function drawRain(ctx, b, cam) {
  const amt = rainAt(b);
  if (amt <= 0.01) return;
  const span = X_MAX - X_MIN + 300;
  ctx.save();
  ctx.lineCap = 'round';
  for (const L of RAIN) {
    const n = Math.round(L.n * amt);
    const light = new Path2D(), dark = new Path2D();
    for (let i = 0; i < n; i++) {
      const sp = L.sp * (0.85 + hash2(i, 1, L.seed) * 0.3), len = lerp(L.len[0], L.len[1], hash2(i, 2, L.seed));
      const y = ((hash2(i, 3, L.seed) * 1300 + b * sp) % 1300) - 150;
      const x = ((((hash2(i, 4, L.seed) * span - cam - y * SLANT) % span) + span) % span) + X_MIN - 100;
      light.moveTo(x, y); light.lineTo(x + len * SLANT, y + len);
      dark.moveTo(x + L.w, y + 2); dark.lineTo(x + L.w + len * SLANT, y + len + 2);
    }
    ctx.lineWidth = L.w * 1.1; ctx.strokeStyle = `rgba(120,100,70,${(L.a * 0.35).toFixed(3)})`; ctx.stroke(dark);
    ctx.lineWidth = L.w; ctx.strokeStyle = `rgba(255,252,240,${L.a.toFixed(3)})`; ctx.stroke(light);
  }
  // 地上的水花
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 50; i++) {
    const ph0 = b * 1.6 + hash2(i, 5, 82), cyc = Math.floor(ph0), ph = ph0 - cyc;
    const wx = hash2(i, cyc, 83) * span, y = 772 + hash2(i, cyc, 84) * 220;
    const x = ((((wx - cam) % span) + span) % span) + X_MIN - 100;
    const s1 = 0.5 + (y - 770) / 260;
    ctx.strokeStyle = `rgba(255,252,240,${(0.7 * amt * (1 - ph)).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(x, y, (3 + ph * 18) * s1, (1 + ph * 4) * s1, 0, 0, TAU); ctx.stroke();
    if (ph < 0.25) {
      const k = ph / 0.25;
      ctx.beginPath();
      for (const d of [-1, -0.4, 0.4, 1]) { ctx.moveTo(x + d * 2 * s1, y); ctx.lineTo(x + d * (4 + k * 6) * s1, y - (5 + k * 5) * s1 * (1.2 - Math.abs(d) * 0.4)); }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 雨幕：灰黄的一层 + 斜着移动的雨帘，画在人物后面。 */
function drawRainVeil(ctx, b) {
  const amt = rainAt(b);
  if (amt <= 0.01) return;
  const span = X_MAX - X_MIN + 300;
  ctx.save();
  // 雨幕
  ctx.fillStyle = rgba('#d9cfae', 0.2 * amt); ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
  for (let i = 0; i < 5; i++) {
    const x = ((((hash2(i, 1, 81) * span - b * 520) % span) + span) % span) + X_MIN - 150;
    const g = ctx.createLinearGradient(x - 120, 0, x + 120, 0);
    g.addColorStop(0, 'rgba(236,228,204,0)'); g.addColorStop(0.5, `rgba(236,228,204,${0.16 * amt})`); g.addColorStop(1, 'rgba(236,228,204,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(x - 120, 0); ctx.lineTo(x + 120, 0); ctx.lineTo(x + 120 + SLANT * 1000, 1000); ctx.lineTo(x - 120 + SLANT * 1000, 1000); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------- 柳絮（第 4 小节） ----------
function drawCatkins(ctx, b) {
  const k = smoothstep(GAG + 3.6, GAG + 4.4, b);
  if (k <= 0) return;
  ctx.save();
  for (let i = 0; i < 46; i++) {
    const t0 = GAG + 3.4 + hash2(i, 1, 91) * 3.5;
    const age = b - t0;
    if (age < 0) continue;
    const x = 1400 - hash2(i, 2, 91) * 600 - age * (230 + hash2(i, 3, 91) * 120) + Math.sin(age * 3 + i) * 14;
    const y = 120 + hash2(i, 4, 91) * 640 + Math.sin(age * 2.2 + i * 1.7) * 22 - age * 16;
    if (x < X_MIN - 20) continue;
    const r = 2.6 + hash2(i, 5, 91) * 2.4;
    ctx.fillStyle = `rgba(255,253,246,${0.9 * k})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = `rgba(255,253,246,${0.6 * k})`; ctx.lineWidth = 0.6;
    ctx.beginPath(); for (let j = 0; j < 5; j++) { const a = j * 1.26 + age; ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * r * 2.3, y + Math.sin(a) * r * 2.3); } ctx.stroke();
  }
  ctx.restore();
}

// ---------- 毛笔在飘着的纸上工笔勾出女子的脸，一片梨花落在纸上（第 4 小节） ----------
// 面朝右的侧脸（纸的局部坐标，单位）：额、鼻、唇、下巴、颈；眉、眼、耳；发际、发髻、簪。
const HEAD_OUT = [[16, -58], [8, -72], [-10, -82], [-34, -80], [-52, -66], [-60, -44], [-58, -18], [-46, 6], [-30, 24]];
const HAIRLINE = [[16, -58], [4, -50], [-4, -38], [-10, -24], [-16, -14], [-22, 6], [-30, 24]];
const BUN = [[-50, -72], [-60, -90], [-80, -96], [-94, -84], [-92, -66], [-76, -58], [-58, -62]];
const FACE = [
  [[16, -58], [19, -46], [21, -34], [24, -26], [33, -12], [31, -8], [28, -6], [29, 0], [33, 5], [30, 9], [31, 13], [28, 18], [25, 26], [18, 34], [8, 38], [0, 38], [-10, 32], [-18, 20]],
  [[0, -31], [9, -34], [18, -31]],
  [[4, -21], [11, -25], [19, -20]],
  [[6, -19], [12, -17.5], [18, -20]],
  [[-12, -12], [-19, -10], [-20, 0], [-14, 5]],
  [[6, 38], [6, 58], [4, 82]],
  [[-30, 24], [-30, 52], [-28, 82]],
  HEAD_OUT,
  HAIRLINE.slice(0, 5),
  BUN,
  [[8, -56], [-12, -68], [-38, -70], [-54, -62]],
  [[0, -47], [-18, -58], [-42, -58], [-58, -44]],
  [[-6, -35], [-24, -44], [-46, -42], [-60, -26]],
  [[-12, -21], [-28, -26], [-48, -20], [-56, -4]],
  [[-74, -90], [-86, -82], [-84, -66]],
  [[-104, -104], [-62, -68]],
];
function chaikin(pts, it = 3) {
  let P = pts;
  for (let k = 0; k < it; k++) {
    const Q = [P[0]];
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[i + 1];
      Q.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    Q.push(P[P.length - 1]);
    P = Q;
  }
  return P;
}
const FACE_S = FACE.map((st) => (st.length > 2 ? chaikin(st) : st));
const FACE_LEN = FACE_S.map((s) => s.reduce((acc, p, i) => acc + (i ? Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0), 0));
const FACE_TOTAL = FACE_LEN.reduce((a, v) => a + v, 0);
function paperPose(b) {
  const k = ease.out(smoothstep(T_PAPER[0], T_PAPER[1], b));
  const fadeOut = 1 - smoothstep(GAG + 7.6, GAG + 8, b);
  const x = lerp(-560, -212, k) + Math.sin(b * 1.4) * 6, y = lerp(380, 478, k) + Math.sin(b * 2.1) * 5;
  const rot = lerp(-0.6, -0.05, k) + Math.sin(b * 1.7) * 0.025;
  return { k, x, y, rot, a: Math.min(1, k * 1.5) * fadeOut };
}
function drawPaper(ctx, b) {
  if (b < T_PAPER[0]) return;
  const P = paperPose(b);
  if (P.a <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = P.a;
  ctx.translate(P.x, P.y); ctx.rotate(P.rot);
  // 纸（微微卷起的一张绢 / 熟宣）
  const sheet = pathOf((q) => { q.moveTo(-112, -128); q.quadraticCurveTo(0, -136, 112, -126); q.quadraticCurveTo(118, 0, 110, 130); q.quadraticCurveTo(0, 122, -110, 132); q.quadraticCurveTo(-118, 0, -112, -128); q.closePath(); });
  ctx.fillStyle = 'rgba(80,50,20,0.16)'; ctx.save(); ctx.translate(6, 9); ctx.fill(sheet); ctx.restore();
  gb(ctx, sheet, '#fbf5e4', { line: 1.1, shade: SILK_D, sw: 12, sa: 0.3 });
  // 勾线进度
  const prog = clamp((b - T_INK[0]) / (T_INK[1] - T_INK[0])) * FACE_TOTAL;
  let acc = 0, tip = null;
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 1.3;
  ctx.save();
  ctx.scale(1.12, 1.12);
  FACE_S.forEach((s, si) => {
    if (acc >= prog) { acc += FACE_LEN[si]; return; }
    ctx.beginPath(); ctx.moveTo(s[0][0], s[0][1]);
    let rem = prog - acc;
    for (let i = 1; i < s.length; i++) {
      const [x0, y0] = s[i - 1], [x1, y1] = s[i], l = Math.hypot(x1 - x0, y1 - y0);
      if (rem >= l) { ctx.lineTo(x1, y1); rem -= l; tip = [x1, y1]; }
      else { const t = rem / l; tip = [lerp(x0, x1, t), lerp(y0, y1, t)]; ctx.lineTo(tip[0], tip[1]); rem = 0; break; }
    }
    ctx.stroke();
    acc += FACE_LEN[si];
  });
  ctx.restore();
  // 勾完以后：发髻上墨、唇点朱砂、腮上一点胭脂（重彩）
  const color = smoothstep(T_INK[1] - 0.1, T_INK[1] + 0.35, b);
  if (color > 0) {
    ctx.save();
    ctx.globalAlpha *= color;
    ctx.scale(1.12, 1.12);
    // 头发：淡墨罩染（外轮廓 + 发际线之间），发髻稍深
    const hairG = ctx.createLinearGradient(-60, -80, 10, -20);
    hairG.addColorStop(0, rgba('#1f1712', 0.95)); hairG.addColorStop(1, rgba('#2b2019', 0.82));
    ctx.fillStyle = hairG;
    ctx.beginPath(); chaikin(HEAD_OUT).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); chaikin(HAIRLINE).slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba('#1f1712', 0.95);
    ctx.beginPath(); chaikin([...BUN, BUN[0]]).forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
    // 发丝高光（留白的细线）
    ctx.strokeStyle = rgba('#fbf5e4', 0.32); ctx.lineWidth = 0.7;
    for (const st of FACE_S.slice(10, 14)) { ctx.beginPath(); st.forEach(([x, y], k) => (k ? ctx.lineTo(x, y + 2) : ctx.moveTo(x, y + 2))); ctx.stroke(); }
    // 眼珠、朱唇、腮上胭脂
    ctx.fillStyle = rgba('#2b2019', 0.9); ctx.beginPath(); ctx.ellipse(14, -21, 2, 2.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba(CIN, 0.9); ctx.beginPath(); ctx.ellipse(30.5, 10, 2.6, 3.2, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba('#e9917a', 0.32); ctx.beginPath(); ctx.ellipse(8, -6, 14, 9, 0, 0, TAU); ctx.fill();
    // 衣领一抹石青
    ctx.fillStyle = rgba(AZ, 0.55); ctx.beginPath(); ctx.moveTo(-30, 66); ctx.quadraticCurveTo(-10, 74, 6, 64); ctx.lineTo(10, 100); ctx.lineTo(-34, 100); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.moveTo(-30, 66); ctx.quadraticCurveTo(-10, 74, 6, 64); ctx.stroke();
    gb(ctx, circP(-104, -104, 4.5), GOLD, { line: 0.7 }); // 簪头
    strokeLine(ctx, [[-104, -100], [-106, -86]], 0.9, GOLD_D); gb(ctx, circP(-106, -84, 2.4), CIN, { line: 0.5 });
    ctx.restore();
  }
  // 梨花
  const pk = clamp((b - T_PEAR[0]) / (T_PEAR[1] - T_PEAR[0]));
  if (pk > 0) {
    const landed = pk >= 1;
    const lx = -66, ly = -108;
    let px = lx, py = ly, rot = 0.4;
    if (!landed) {
      // 在纸外飘落：从右上方落下（局部坐标）
      px = lx + (1 - pk) * 160 + Math.sin(pk * 7) * 22;
      py = ly - (1 - pk) * 330;
      rot = pk * 5;
    }
    ctx.save();
    ctx.translate(px, py); ctx.rotate(rot);
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      gb(ctx, ellP(Math.cos(a) * 9, Math.sin(a) * 9, 9, 7, a), '#fffdf6', { line: 0.8, shade: '#e6ecd9', sw: 3, sa: 0.4 });
    }
    gb(ctx, circP(0, 0, 3.6), '#c9d98e', { line: 0.6 });
    ctx.fillStyle = OCHRE_D;
    for (let i = 0; i < 7; i++) { const a = i * 0.9; ctx.beginPath(); ctx.arc(Math.cos(a) * 6, Math.sin(a) * 6, 1, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // 毛笔：竹管 + 墨色笔头，竖着（中锋）跟着笔尖走；勾完抬起来离开
  const inkK = smoothstep(T_INK[0] - 0.3, T_INK[0], b) * (1 - smoothstep(T_INK[1] + 0.05, T_INK[1] + 0.5, b));
  if (inkK > 0) {
    const t = tip || FACE[0][0];
    const lift = (1 - inkK) * 60;
    ctx.save();
    ctx.globalAlpha *= inkK;
    ctx.translate(t[0] + lift * 0.4, t[1] - lift); ctx.rotate(0.14);
    gb(ctx, pathOf((q) => { q.moveTo(0, 0); q.quadraticCurveTo(-5, -10, -4.5, -24); q.lineTo(4.5, -24); q.quadraticCurveTo(5, -10, 0, 0); q.closePath(); }), '#2b2019', { line: 0.8 });
    gb(ctx, rectP(-4.5, -30, 9, 6), GOLD, { line: 0.8 });
    gb(ctx, rectP(-3.5, -132, 7, 102), '#cfa565', { line: 0.9, shade: OCHRE, sw: 2, sa: 0.3 });
    for (const yy of [-60, -96]) strokeLine(ctx, [[-3.5, yy], [3.5, yy]], 1, OCHRE_D);
    gb(ctx, rectP(-4.5, -140, 9, 8), '#2b2019', { line: 0.8 });
    ctx.restore();
  }
  ctx.restore();
}

// ---------- 匾额：黑底金字「红尘客栈」，思源宋体粗体 + 干笔飞白、墨色不匀、毛边 ----------
function brushGlyphs() {
  return memo('s12-glyphs', () => {
    const FS = 200, adv = FS * 1.04, pad = 26;
    const W = Math.ceil(adv * 4 + pad * 2), H = Math.ceil(FS * 1.3);
    const c = makeCanvas(W, H), x = c.getContext('2d', { willReadFrequently: true });
    font(x, FS, { family: SERIF, weight: 700 });
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
    const rot = [-0.035, 0.022, -0.014, 0.03], dy = [-4, 5, -2, 4], sc = [1.0, 0.97, 1.02, 0.99];
    [...'红尘客栈'].forEach((ch, i) => {
      x.save(); x.translate(pad + adv * (i + 0.5), H / 2 + dy[i]); x.rotate(rot[i]); x.scale(sc[i], sc[i] * 1.03);
      x.fillText(ch, 0, FS * 0.04); x.restore();
    });
    const im = x.getImageData(0, 0, W, H), d = im.data, n = W * H;
    const A = new Float32Array(n);
    for (let i = 0; i < n; i++) A[i] = d[i * 4 + 3] / 255;
    const B = blur(A, W, H, 3, 2), C = blur(A, W, H, 9, 2);
    const out = x.createImageData(W, H), o = out.data;
    for (let py = 1; py < H - 1; py++) for (let px = 1; px < W - 1; px++) {
      const i = py * W + px, bv = B[i];
      if (bv < 0.12) continue;
      // 毛边：阈值上叠细噪声和低频起伏（笔画边缘微毛、略带晕）
      const thr = 0.5 + 0.24 * (noise2(px / 2.1, py / 2.1, 31) - 0.5) + 0.18 * (fbm(px / 24, py / 24, 32, 3) - 0.5);
      let a = smoothstep(thr - 0.06, thr + 0.06, bv);
      if (a <= 0) continue;
      // 干笔飞白：顺着笔画方向的丝缕空白，只出现在「笔干了」的几块地方
      const gx = C[i + 1] - C[i - 1], gy = C[i + W] - C[i - W];
      const horiz = Math.abs(gy) > Math.abs(gx);
      const sn = horiz ? noise2(px / 38, py / 2.4, 33) : noise2(px / 2.4, py / 38, 34);
      const dry = smoothstep(0.5, 0.74, fbm(px / 64, py / 64, 35, 3));
      a *= 1 - dry * (1 - smoothstep(0.3, 0.4, sn));
      if (a <= 0.01) continue;
      // 墨色（金）不匀：低频深浅 + 丝缕亮暗；笔画边缘积色略深
      const edge = 1 - smoothstep(thr, thr + 0.3, bv);
      const tone = 0.9 + 0.3 * (fbm(px / 42, py / 42, 36, 3) - 0.5) + 0.16 * (sn - 0.5) - 0.14 * edge;
      o[i * 4] = Math.min(255, 240 * tone); o[i * 4 + 1] = Math.min(255, 202 * tone); o[i * 4 + 2] = Math.min(255, 118 * tone);
      o[i * 4 + 3] = a * 255;
    }
    const c2 = makeCanvas(W, H);
    c2.getContext('2d').putImageData(out, 0, 0);
    return c2;
  });
}
const PS = 3; // 匾额烘焙精度：每单位 3px
function plaqueCanvas() {
  const { w: W, h: H } = PLQ;
  return baked('s12-plaque', (W + 12) * PS, (H + 16) * PS, (ctx) => {
    ctx.scale(PS, PS); ctx.translate(6, 4);
    // 落在墙上的影子
    ctx.fillStyle = 'rgba(60,34,14,0.3)'; ctx.fillRect(3, 6, W, H);
    // 朱红边框（分染）+ 泥金细线 + 回纹
    const bw = 12;
    gb(ctx, rectP(0, 0, W, H), CIN, { line: 1.2, shade: CIN_D, sw: 4, sa: 0.3 });
    huiwen(ctx, 3, 3, W - 6, bw - 6.5, GOLD_L, 0.9);
    huiwen(ctx, 3, H - bw + 3.5, W - 6, bw - 6.5, GOLD_L, 0.9);
    for (const sx of [3, W - bw + 3.5]) {
      ctx.save(); ctx.translate(sx + bw - 6.5, bw); ctx.rotate(Math.PI / 2); huiwen(ctx, 0, 0, H - 2 * bw, bw - 6.5, GOLD_L, 0.9); ctx.restore();
    }
    // 黑漆匾心
    const inner = rectP(bw, bw, W - 2 * bw, H - 2 * bw);
    const g = ctx.createLinearGradient(0, bw, 0, H - bw);
    g.addColorStop(0, '#2c221d'); g.addColorStop(1, '#16110f');
    ctx.fillStyle = g; ctx.fill(inner);
    ctx.save(); ctx.clip(inner);
    ctx.strokeStyle = 'rgba(255,226,170,0.05)'; ctx.lineWidth = 0.5;
    for (let y = bw + 2; y < H - bw; y += 2.2) { ctx.beginPath(); ctx.moveTo(bw, y); for (let x = bw; x <= W - bw; x += 12) ctx.lineTo(x, y + Math.sin(x * 0.05 + y) * 0.6); ctx.stroke(); }
    const sh = ctx.createLinearGradient(0, bw, 0, bw + 24);
    sh.addColorStop(0, 'rgba(255,240,210,0.1)'); sh.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = sh; ctx.fillRect(bw, bw, W - 2 * bw, 24);
    ctx.restore();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.strokeRect(bw + 2.5, bw + 2.5, W - 2 * bw - 5, H - 2 * bw - 5);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(bw, bw, W - 2 * bw, H - 2 * bw);
    // 字
    const G = brushGlyphs();
    const tw = W - 2 * bw - 14, th = (tw * G.height) / G.width;
    const tx = bw + 7, ty = H / 2 - th / 2 + 1;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowOffsetX = 1.2 * PS; ctx.shadowOffsetY = 1.6 * PS; ctx.shadowBlur = 1.5 * PS;
    ctx.drawImage(G, tx, ty, tw, th);
    ctx.restore();
    // 四角泥金云头
    for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [W, 0, -1, 1], [0, H, 1, -1], [W, H, -1, -1]]) {
      ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy);
      gb(ctx, pathOf((q) => { q.moveTo(-2, -2); q.lineTo(20, -2); q.quadraticCurveTo(16, 6, 9, 7); q.quadraticCurveTo(7, 14, -2, 20); q.closePath(); }), GOLD, { line: 0.9 });
      spiral(ctx, 6, 6, 4, { lw: 0.8, color: GOLD_D });
      ctx.restore();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(0, 0, W, H);
  });
}
function plaqueRect(env) {
  return { x: PLQ.gx + off(env, P_INN) - PLQ.w / 2, y: PLQ.y, w: PLQ.w, h: PLQ.h };
}
function drawPlaque(ctx, env) {
  const r = plaqueRect(env);
  if (r.x > X_MAX + 20 || r.x + r.w < X_MIN - 20) return;
  // 挂匾的两根金钩
  for (const dx of [40, r.w - 40]) strokeLine(ctx, [[r.x + dx, r.y - 10], [r.x + dx, r.y + 2]], 1.6, GOLD_D);
  ctx.drawImage(plaqueCanvas(), r.x - 6, r.y - 4, r.w + 12, r.h + 16);
}

// ---------- 人物画风：工笔（细墨线 + 平涂分染；黑衣保留深墨色） ----------
registerStyle('s12-gongbi', (I) => {
  const O = comicBase(I, { levels: 6, keep: 0.22, lw: 1.7, inner: 0.46, ink: INK, smooth: 1.6 });
  const dark = ['#181310', '#2c241f', '#463b33', '#655749'].map(rgbf);
  const skin = ['#a5694a', '#d29d74', '#efcca5', '#f9e6cb'].map(rgbf);
  const light = ['#8f8372', '#cfc3a8', '#f2e8d2'].map(rgbf);
  const ramp = (S, t) => {
    const u = clamp(t) * (S.length - 1), k = Math.min(S.length - 2, Math.floor(u)), f = u - k;
    return [S[k][0] + (S[k + 1][0] - S[k][0]) * f, S[k][1] + (S[k + 1][1] - S[k][1]) * f, S[k][2] + (S[k + 1][2] - S[k][2]) * f];
  };
  const ink = rgbf(INK);
  for (let i = 0; i < O.w * O.h; i++) {
    if (O.a[i] < 0.01) continue;
    const l = luma(O, i);
    let c;
    if (l < 0.07) c = ink;
    else if (I.r[i] - I.b[i] > 0.09 && I.r[i] > 0.3 && I.a[i] > 0.5) c = ramp(skin, (l - 0.15) / 0.75);
    else if (l < 0.4) c = ramp(dark, l / 0.4);
    else c = ramp(light, (l - 0.4) / 0.6);
    O.r[i] = c[0]; O.g[i] = c[1]; O.b[i] = c[2];
  }
  return O;
});

// ---------- 标题卡、CD、歌名牌、离场画框（像素坐标） ----------
function cardBg(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(70,40,15,0.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
  ctx.fillStyle = CIN; ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  fen(ctx, rectP(x, y, w, h), CIN_D, 6, 3, 0.25);
  const bw = 16;
  huiwen(ctx, x + 3, y + 3.5, w - 6, bw - 7, GOLD_L, 1.3);
  huiwen(ctx, x + 3, y + h - bw + 3.5, w - 6, bw - 7, GOLD_L, 1.3);
  for (const sx of [x + 3.5, x + w - bw + 3.5]) { ctx.save(); ctx.translate(sx + bw - 7, y + bw); ctx.rotate(Math.PI / 2); huiwen(ctx, 0, 0, h - 2 * bw, bw - 7, GOLD_L, 1.3); ctx.restore(); }
  const inner = rectP(x + bw, y + bw, w - 2 * bw, h - 2 * bw);
  gb(ctx, inner, SILK, { line: 1.3, shade: OCHRE_L, sw: 10, sa: 0.1 });
  weave(ctx, x + bw, y + bw, w - 2 * bw, h - 2 * bw, 0.8);
  ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.strokeRect(x + bw + 5, y + bw + 5, w - 2 * bw - 10, h - 2 * bw - 10);
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h);
  for (const [cx, cy, sx, sy] of [[x + bw + 5, y + bw + 5, 1, 1], [x + w - bw - 5, y + bw + 5, -1, 1], [x + bw + 5, y + h - bw - 5, 1, -1], [x + w - bw - 5, y + h - bw - 5, -1, -1]]) {
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sx, sy);
    spiral(ctx, 9, 9, 7, { lw: 1.3, color: GOLD });
    ctx.restore();
  }
  ctx.restore();
}
function gongbiCD(ctx, kind, cx, cy, s, spin) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = 'rgba(70,40,15,0.3)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  gb(ctx, circP(0, 0, r), SILK, { line: 0 });
  ctx.shadowColor = 'transparent';
  ctx.rotate(spin);
  // 朱红外环 + 泥金点（转起来看得见）
  const ring = pathOf((p) => { p.arc(0, 0, r * 0.97, 0, TAU); p.moveTo(r * 0.82, 0); p.arc(0, 0, r * 0.82, 0, TAU, true); });
  ctx.fillStyle = CIN; ctx.fill(ring, 'evenodd');
  ctx.fillStyle = GOLD_L;
  for (let k = 0; k < 16; k++) { const a = (k / 16) * TAU; ctx.save(); ctx.rotate(a); ctx.fillRect(r * 0.86, -1.6 * s, r * 0.07, 3.2 * s); ctx.restore(); }
  // 盘面：一枝工笔牡丹（偏在一侧，转动清楚）
  ctx.save();
  ctx.translate(0, -r * 0.52);
  for (const [a, l] of [[2.4, 20], [0.7, 18], [3.6, 16]]) leaf(ctx, 0, 6 * s, l * s, a);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * TAU;
    gb(ctx, ellP(Math.cos(a) * 9 * s, Math.sin(a) * 7 * s, 9 * s, 6 * s, a), k % 2 ? CIN_L : '#ef9a86', { line: 0.7 });
  }
  gb(ctx, circP(0, 0, 5 * s), GOLD, { line: 0.7 });
  ctx.restore();
  // 一朵泥金小云在另一侧
  spiral(ctx, 0, r * 0.55, 10 * s, { lw: 1.4, color: GOLD_D });
  spiral(ctx, 14 * s, r * 0.55, 7 * s, { lw: 1.2, color: GOLD_D, dir: -1 });
  // 石青内环 + 中孔
  const inner = pathOf((p) => { p.arc(0, 0, r * 0.34, 0, TAU); p.moveTo(r * 0.24, 0); p.arc(0, 0, r * 0.24, 0, TAU, true); });
  ctx.fillStyle = AZ; ctx.fill(inner, 'evenodd');
  ctx.strokeStyle = GOLD_L; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r * 0.29, 0, TAU); ctx.stroke();
  gb(ctx, circP(0, 0, r * 0.1), SILK_D, { line: 1 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4;
  for (const rr of [r, r * 0.82, r * 0.34, r * 0.24]) { ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke(); }
  ctx.restore();
}
function plate(ctx, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = 'rgba(70,40,15,0.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
  ctx.fillStyle = CIN; ctx.fillRect(x, y, w, h);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = GOLD_L; ctx.lineWidth = 1.4; ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  gb(ctx, rectP(x + 9, y + 9, w - 18, h - 18), SILK, { line: 1.1, shade: OCHRE_L, sw: 8, sa: 0.12 });
  ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(x, y, w, h);
  for (const sx of [x, x + w]) gb(ctx, circP(sx, y + h / 2, 7), GOLD, { line: 1.1 });
  ctx.restore();
}
/** 离场画框：朱红宽边上泥金回纹 + 石青、石绿细带 + 泥金角花，细墨线勾边。 */
function gongbiFrame(ctx, R) {
  const t = 64 * R.s, { x, y, w, h } = R, lw = Math.max(1, 1.5 * R.s);
  ctx.save();
  ctx.fillStyle = 'rgba(60,35,10,0.18)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.45, 0, 0, TAU); ctx.fill();
  const ringP = (o, i) => pathOf((p) => { p.rect(x - o, y - o, w + 2 * o, h + 2 * o); p.rect(x - i, y - i, w + 2 * i, h + 2 * i); });
  ctx.fillStyle = CIN; ctx.fill(ringP(t, t * 0.3), 'evenodd');
  ctx.fillStyle = AZ; ctx.fill(ringP(t * 0.3, t * 0.15), 'evenodd');
  ctx.fillStyle = MAL; ctx.fill(ringP(t * 0.15, 0), 'evenodd');
  // 朱红带的分染（内外沿深）
  ctx.save(); ctx.clip(ringP(t, t * 0.3), 'evenodd');
  ctx.strokeStyle = rgba(CIN_D, 0.35); ctx.lineWidth = t * 0.14;
  ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t); ctx.strokeRect(x - t * 0.3, y - t * 0.3, w + t * 0.6, h + t * 0.6);
  ctx.restore();
  const bh = t * 0.36, bo = t * 0.83;
  const hl = Math.max(1, 2.2 * R.s);
  huiwen(ctx, x - bo, y - bo, w + 2 * bo, bh, GOLD_L, hl);
  huiwen(ctx, x - bo, y + h + bo - bh, w + 2 * bo, bh, GOLD_L, hl);
  for (const [sx, dir] of [[x - bo, 1], [x + w + bo, -1]]) {
    ctx.save(); ctx.translate(sx, dir > 0 ? y + h + bo : y - bo); ctx.rotate(-dir * Math.PI / 2); huiwen(ctx, 0, 0, h + 2 * bo, bh, GOLD_L, hl); ctx.restore();
  }
  // 石绿细带上的泥金点
  ctx.fillStyle = GOLD_L;
  const step = Math.max(8, 30 * R.s), m = t * 0.075;
  for (let px = x; px < x + w; px += step) { ctx.beginPath(); ctx.arc(px, y - m, Math.max(0.8, 2.2 * R.s), 0, TAU); ctx.arc(px, y + h + m, Math.max(0.8, 2.2 * R.s), 0, TAU); ctx.fill(); }
  ctx.strokeStyle = INK; ctx.lineWidth = lw;
  for (const o of [t, t * 0.3, t * 0.15]) ctx.strokeRect(x - o, y - o, w + 2 * o, h + 2 * o);
  ctx.lineWidth = lw * 1.3; ctx.strokeRect(x, y, w, h);
  // 四角泥金角花、上下正中石青如意
  for (const [cx, cy] of [[x - t * 0.65, y - t * 0.65], [x + w + t * 0.65, y - t * 0.65], [x - t * 0.65, y + h + t * 0.65], [x + w + t * 0.65, y + h + t * 0.65]]) {
    const r = t * 0.42;
    gb(ctx, pathOf((p) => { p.rect(cx - r, cy - r, 2 * r, 2 * r); }), GOLD, { line: lw });
    gb(ctx, circP(cx, cy, r * 0.62), CIN_L, { line: lw * 0.8 });
    spiral(ctx, cx, cy, r * 0.5, { lw: lw * 0.8, color: GOLD_L });
  }
  for (const cy of [y - t * 0.65, y + h + t * 0.65]) {
    gb(ctx, ellP(x + w / 2, cy, t * 0.8, t * 0.36), GOLD, { line: lw });
    gb(ctx, ellP(x + w / 2, cy, t * 0.5, t * 0.2), AZ, { line: lw * 0.8 });
  }
  ctx.restore();
}

// ---------- 场景 ----------
export const s12 = {
  id: 's12',
  station: ST,
  figureStyle: 's12-gongbi',
  // 一圈很细的绢白描边：在客栈门里、窗格前也拉得开
  figureRim: { color: '#f8efd8', width: 4, alpha: 0.85 },
  freezeBeat: GAG + 2.15, // Outro 展墙：剑出鞘一半正闪光、柳枝朝窗口弯着腰、窗里女子的侧影、骤雨，匾额在画面里
  drawBack(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG);
    ctx.drawImage(skyCanvas(), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawStrip(ctx, farLayer(), cam);
    drawCrane(ctx, b);
    drawStrip(ctx, duneLayer(), cam);
    // 地平线上的沙雾（第 1 小节最浓）
    const haze = 0.35 + 0.4 * sandAt(b);
    const hg = ctx.createLinearGradient(0, 420, 0, 700);
    hg.addColorStop(0, rgba(SAND_L, 0)); hg.addColorStop(0.7, rgba(SAND_L, 0.5 * haze)); hg.addColorStop(1, rgba(SAND_L, 0.2 * haze));
    ctx.fillStyle = hg; ctx.fillRect(X_MIN, 420, X_MAX - X_MIN, 280);
    // 客栈层
    const oi = off(env, P_INN);
    drawStrip(ctx, innLayer(cg), cam);
    if (WIN.x1 + oi > X_MIN && WIN.x0 + oi < X_MAX) drawWindow(ctx, b, oi);
    const lit = sunAt(b), wind = windAt(b);
    LANTERNS.forEach(([lx, ly, r], i) => {
      if (lx + oi < X_MIN - 60 || lx + oi > X_MAX + 60) return;
      drawLantern(ctx, lx + oi, ly, r, Math.sin(b * Math.PI * (1 + wind) + i) * (0.05 + 0.1 * wind) + 0.08 * wind, lit);
    });
    if (FLAG_GX + oi > X_MIN - 10 && FLAG_GX + oi - 200 < X_MAX) drawFlag(ctx, b, oi);
    if (WILLOW.gx + oi > X_MIN - 300 && WILLOW.gx + oi < X_MAX + 300) drawWillow(ctx, b, oi);
    // 第 1 小节：客栈也笼在风沙里（匾额另画，不受影响）
    const veil = 0.22 * sandAt(b) * (1 - smoothstep(GAG - 4, GAG - 2, b));
    if (veil > 0.005) { ctx.fillStyle = rgba(SAND_L, veil); ctx.fillRect(X_MIN, 60, X_MAX - X_MIN, 660); }
    // 中景：荒村、快马
    drawStrip(ctx, midLayer(cg), cam);
    drawHorses(ctx, b);
    // 路面
    drawStrip(ctx, roadLayer(cg), cam);
    const or = off(env, 1);
    drawLatticeShadow(ctx, b, or);
    drawSword(ctx, b, or);
    drawSandBack(ctx, b, cam);
    drawRainVeil(ctx, b);
    drawSandRibbons(ctx, b);
    // 第 4 小节：雨歇后的暖光
    const sun = sunAt(b);
    if (sun > 0) {
      const sg = ctx.createRadialGradient(1150, 120, 40, 1150, 120, 1300);
      sg.addColorStop(0, `rgba(255,236,186,${0.3 * sun})`); sg.addColorStop(1, 'rgba(255,236,186,0)');
      ctx.fillStyle = sg; ctx.fillRect(X_MIN, 0, X_MAX - X_MIN, 1000);
    }
  },
  drawFront(ctx, b, env) {
    const cam = env.cam;
    drawStrip(ctx, fgLayer(), cam);
    drawSand(ctx, b, cam);
    drawSlashes(ctx, b);
    drawRain(ctx, b, cam);
    drawCatkins(ctx, b);
    drawPaper(ctx, b);
    // 匾额最后画：不被风沙、刀痕、雨、柳絮、纸笔遮住
    drawPlaque(ctx, env);
  },
  drawFrame(ctx, R) { gongbiFrame(ctx, R); },
  cardStyle: { ink: INK, accent: CIN, bar: false, bgDraw: (ctx, x, y, w, h) => cardBg(ctx, x, y, w, h) },
  playerStyle: {
    ink: INK, noteColor: CIN, backdrop: false,
    plateDraw: (ctx, x, y, w, h) => plate(ctx, x, y, w, h),
    drawPlayer: (ctx, kind, cx, cy, s, spin) => gongbiCD(ctx, kind, cx, cy, s, spin),
  },
};
