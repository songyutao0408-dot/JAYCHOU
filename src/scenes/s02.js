// 第 2 站 · 范特西（Fantasy, 2001）·「爱在西元前」· 古巴比伦城墙 · 两河流域浮雕
// 构图：暮色天空 + 远处阶梯形塔庙 → 青金石釉砖城墙（阶梯雉堞、花饰带、金色狮子带）
//       → 砂岩浮雕带：一列侧身行进的人，每拍迈一步，和他同步 → 游行大道的石板路
// 梗（第 9–12 拍）：他定格成正面站着，浮雕里人人侧身照走；离他最近的浮雕人回头看他一眼；
//       第 13 拍前他被「压扁」成侧身，接着继续走。
// 原创构图，只借用两河流域釉砖与浮雕的一般风格，不对应任何具体文物或 MV 画面。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { strip, drawStrip, stripRange } from '../kit/strip.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { mix, rgba } from '../kit/color.js';
import { smoothPath, poly, circle, ellipse, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, keyframes } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { drawDefaultFrame } from '../main/frame.js';

const ST = stationByN(2);
const SAND = '#e7d3a8', OCHRE = '#c49a5c', BROWN = '#4a3320', LAPIS = '#2f6fb0';
const LAPIS_D = '#1d4580', LAPIS_DD = '#13305c', GOLD = '#e2b850', CREAM = '#f4e6c4', CLAY = '#d6b07a';

// 城墙各带的高度（单位）
const WALL_TOP = 330, BAND1 = [346, 372], LIONS = [384, 520], BAND2 = [530, 554], RELIEF = [566, 772], PLINTH = 772;
const P_WALL = 0.85, P_FAR = 0.22, P_FG = 1.3;

// ---------- 远景：塔庙、城墙、棕榈 ----------
function farLayer() {
  return strip('s02-far', P_FAR, (ctx, x0, x1) => {
    const R = rng('s02-far');
    const c1 = mix(SAND, OCHRE, 0.5), c2 = mix(OCHRE, BROWN, 0.25);
    // 远处城墙线
    ctx.fillStyle = mix(SAND, OCHRE, 0.35);
    ctx.fillRect(x0, 300, x1 - x0, 60);
    for (let x = x0; x < x1; x += 34) ctx.fillRect(x, 288, 20, 14);
    // 塔庙（阶梯形），每隔一段一座
    for (let zx = x0 + 120; zx < x1; zx += 760 + R() * 300) {
      const w = 260 + R() * 80, steps = 5;
      for (let i = 0; i < steps; i++) {
        const ww = w * (1 - i * 0.17), hh = 34;
        const yb = 330 - i * hh;
        ctx.fillStyle = i % 2 ? c1 : mix(c1, c2, 0.4);
        ctx.fillRect(zx - ww / 2, yb - hh, ww, hh);
        ctx.fillStyle = rgba(BROWN, 0.18);
        ctx.fillRect(zx + ww / 2 - ww * 0.22, yb - hh, ww * 0.22, hh); // 背光面
      }
      // 正面的坡道
      ctx.fillStyle = mix(c1, '#ffffff', 0.15);
      poly(ctx, [[zx - 16, 330], [zx + 16, 330], [zx + 8, 330 - steps * 34], [zx - 8, 330 - steps * 34]]);
      ctx.fill();
    }
    // 棕榈
    for (let px = x0 + 40; px < x1; px += 140 + R() * 220) {
      const h = 90 + R() * 70, lean = (R() - 0.5) * 18;
      ctx.strokeStyle = c2; ctx.lineWidth = 6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(px, 340); ctx.quadraticCurveTo(px + lean * 0.3, 340 - h / 2, px + lean, 340 - h); ctx.stroke();
      ctx.fillStyle = c2;
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.48;
        const L = 40 + R() * 16;
        const tx = px + lean, ty = 340 - h;
        smoothPath(ctx, [[tx, ty], [tx + Math.cos(a - 0.25) * L * 0.6, ty + Math.sin(a - 0.25) * L * 0.6 - 4], [tx + Math.cos(a) * L, ty + Math.sin(a) * L + 10], [tx + Math.cos(a + 0.15) * L * 0.6, ty + Math.sin(a + 0.15) * L * 0.6 + 4]], true);
        ctx.fill();
      }
    }
  }, { y0: 150, y1: 380 });
}

// ---------- 城墙主体（砖、雉堞、花饰带、狮子带） ----------
function rosette(ctx, x, y, r, petal, center) {
  ctx.fillStyle = petal;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ellipse(ctx, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.45, r * 0.22, a);
    ctx.fill();
  }
  circle(ctx, x, y, r * 0.3); ctx.fillStyle = center; ctx.fill();
}
function lion(ctx, x, y, s, R) {
  // 侧身迈步的狮子（原创简化造型）：金色身体、橙褐色鬃毛、浅色腹部，暗色描边，下沿压暗做出浮雕感
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  const body = [[-80, -40], [-40, -58], [20, -56], [52, -66], [74, -60], [92, -44], [96, -28], [80, -22], [62, -26], [58, -8], [62, 30], [50, 34], [44, 2], [10, 4], [-20, 2], [-30, 34], [-44, 34], [-42, 0], [-70, -4], [-92, -20], [-112, -46], [-104, -50], [-84, -32]];
  const draw = (dx, dy, col) => { ctx.save(); ctx.translate(dx, dy); smoothPath(ctx, body, true); ctx.fillStyle = col; ctx.fill(); ctx.restore(); };
  draw(3, 4, rgba('#0b1f3f', 0.55)); // 浮雕投影
  draw(0, 0, GOLD);
  // 鬃毛
  ctx.fillStyle = '#c9742c';
  smoothPath(ctx, [[30, -58], [52, -70], [74, -64], [80, -40], [70, -20], [52, -16], [36, -30]], true);
  ctx.fill();
  ctx.strokeStyle = rgba('#7a3f12', 0.8); ctx.lineWidth = 2;
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(40 + k * 6, -56 + k * 2); ctx.quadraticCurveTo(46 + k * 6, -40, 40 + k * 7, -24); ctx.stroke(); }
  // 腹部亮色、腿部肌肉线
  ctx.fillStyle = rgba(CREAM, 0.7);
  smoothPath(ctx, [[-40, -8], [10, -6], [40, -10], [10, 2], [-30, 0]], true); ctx.fill();
  ctx.strokeStyle = '#3d2410'; ctx.lineWidth = 2.6;
  smoothPath(ctx, body, true); ctx.stroke();
  // 眼睛与张开的嘴
  ctx.fillStyle = '#3d2410';
  circle(ctx, 82, -46, 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(96, -30); ctx.lineTo(84, -32); ctx.stroke();
  ctx.restore();
}
function wallLayer() {
  return strip('s02-wall', P_WALL, (ctx, x0, x1) => {
    const R = rng('s02-wall');
    // 墙体底色
    ctx.fillStyle = LAPIS_D;
    ctx.fillRect(x0, WALL_TOP, x1 - x0, PLINTH - WALL_TOP + 30);
    // 釉砖：错缝，逐块颜色微差 + 上沿高光 + 灰缝
    const bw = 46, bh = 22;
    for (let row = 0, y = WALL_TOP; y < PLINTH; row++, y += bh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = x0 - bw + off; x < x1; x += bw) {
        const t = hash2(Math.round(x), row, 4);
        const base = t < 0.33 ? LAPIS : t < 0.75 ? mix(LAPIS, LAPIS_D, 0.45) : mix(LAPIS, '#5b8fd0', 0.35);
        ctx.fillStyle = base;
        ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        ctx.fillStyle = rgba('#cfe2ff', 0.18 + 0.12 * hash2(Math.round(x), row, 5));
        ctx.fillRect(x + 3, y + 3, bw - 10, 2.5);
        // 釉面斑驳
        if (hash2(Math.round(x), row, 6) > 0.8) { ctx.fillStyle = rgba('#0c2347', 0.25); ctx.fillRect(x + 6 + hash2(row, Math.round(x), 7) * 20, y + 8, 10, 6); }
      }
    }
    // 雉堞（阶梯形）
    for (let x = x0; x < x1; x += 72) {
      ctx.fillStyle = LAPIS_D;
      poly(ctx, [[x + 6, WALL_TOP], [x + 6, WALL_TOP - 16], [x + 14, WALL_TOP - 16], [x + 14, WALL_TOP - 32], [x + 22, WALL_TOP - 32], [x + 22, WALL_TOP - 46],
        [x + 46, WALL_TOP - 46], [x + 46, WALL_TOP - 32], [x + 54, WALL_TOP - 32], [x + 54, WALL_TOP - 16], [x + 62, WALL_TOP - 16], [x + 62, WALL_TOP]]);
      ctx.fill();
      ctx.fillStyle = rgba('#cfe2ff', 0.22);
      ctx.fillRect(x + 22, WALL_TOP - 46, 24, 3);
      ctx.fillRect(x + 6, WALL_TOP - 16, 8, 3);
    }
    // 花饰带
    for (const [a, b] of [BAND1, BAND2]) {
      ctx.fillStyle = LAPIS_DD;
      ctx.fillRect(x0, a, x1 - x0, b - a);
      ctx.fillStyle = GOLD; ctx.fillRect(x0, a, x1 - x0, 3); ctx.fillRect(x0, b - 3, x1 - x0, 3);
      for (let x = x0 + 20; x < x1; x += 40) rosette(ctx, x, (a + b) / 2, 10, CREAM, GOLD);
    }
    // 狮子带
    for (let x = x0 + 150; x < x1; x += 330) lion(ctx, x, LIONS[1] - 34, 0.9 + R() * 0.04, R);
    // 墙脚
    ctx.fillStyle = mix(BROWN, OCHRE, 0.3);
    ctx.fillRect(x0, PLINTH, x1 - x0, 30);
    ctx.fillStyle = rgba('#000000', 0.18);
    ctx.fillRect(x0, PLINTH, x1 - x0, 5);
  }, { y0: 270, y1: 810 });
}

// ---------- 浮雕带：侧身行进的人（两种步态，按拍交替） ----------
const FIG_GAP = 210;
const OFFERINGS = ['jar', 'lyre', 'basket', 'branch'];
function reliefFigure(ctx, x, pose, item, frontal = false) {
  // 原创的两河流域风格人物：侧脸、正面眼、筒形帽、长袍、手捧供品；pose 0/1 为两种迈步姿势
  const base = RELIEF[1] - 6, H = 186;
  const top = base - H;
  ctx.save();
  ctx.translate(x, 0);
  const shade = (path, dx = 2.5, dy = 3) => {
    ctx.save(); ctx.translate(dx, dy); ctx.fillStyle = rgba('#6b4a2b', 0.45); ctx.fill(path); ctx.restore();
    ctx.fillStyle = mix(SAND, '#f6e9cc', 0.25); ctx.fill(path);
    ctx.strokeStyle = rgba('#7a5a34', 0.9); ctx.lineWidth = 1.6; ctx.stroke(path);
  };
  const stride = pose ? 26 : 12;
  // 腿与脚（长袍下摆下露出）
  const legs = new Path2D();
  legs.moveTo(-6, base - 46); legs.lineTo(-6 - stride, base - 4); legs.lineTo(-6 - stride + 16, base - 4); legs.lineTo(2, base - 46);
  legs.moveTo(6, base - 46); legs.lineTo(10 + stride, base - 4); legs.lineTo(26 + stride, base - 4); legs.lineTo(16, base - 46);
  shade(legs);
  // 长袍
  const robe = new Path2D();
  robe.moveTo(-22, top + 66); robe.lineTo(24, top + 64); robe.lineTo(30 + stride * 0.3, base - 40); robe.lineTo(-26 - stride * 0.3, base - 40); robe.closePath();
  shade(robe);
  // 袍边流苏
  ctx.strokeStyle = rgba('#7a5a34', 0.8); ctx.lineWidth = 1.2;
  for (let k = -24; k <= 28; k += 5) { ctx.beginPath(); ctx.moveTo(k, base - 42); ctx.lineTo(k + 1, base - 34); ctx.stroke(); }
  // 后手臂
  const armB = new Path2D(); armB.rect(-18, top + 70, 10, 52); shade(armB);
  // 头（侧脸 / 正脸）、帽、胡子
  const head = new Path2D();
  if (!frontal) {
    head.moveTo(-14, top + 22); head.lineTo(-14, top + 50); head.lineTo(-2, top + 60); head.lineTo(14, top + 52); head.lineTo(18, top + 40); head.lineTo(22, top + 36); head.lineTo(16, top + 30); head.lineTo(14, top + 18); head.closePath();
  } else {
    head.ellipse(0, top + 40, 17, 22, 0, 0, Math.PI * 2);
  }
  shade(head);
  const hat = new Path2D(); hat.rect(-16, top + 2, 30, 20); shade(hat);
  ctx.strokeStyle = rgba('#7a5a34', 0.8);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-16, top + 7 + k * 5); ctx.lineTo(14, top + 7 + k * 5); ctx.stroke(); }
  const beard = new Path2D();
  if (!frontal) { beard.moveTo(-4, top + 50); beard.lineTo(14, top + 50); beard.lineTo(10, top + 74); beard.lineTo(-6, top + 72); beard.closePath(); }
  else { beard.moveTo(-14, top + 50); beard.lineTo(14, top + 50); beard.lineTo(8, top + 76); beard.lineTo(-8, top + 76); beard.closePath(); }
  shade(beard);
  ctx.strokeStyle = rgba('#7a5a34', 0.7);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(frontal ? -10 : -2, top + 56 + k * 6); ctx.lineTo(frontal ? 10 : 12, top + 56 + k * 6); ctx.stroke(); }
  // 眼睛（侧脸画正面眼）
  ctx.fillStyle = '#5a3b1c';
  if (!frontal) { ellipse(ctx, 8, top + 34, 4.5, 2.2); ctx.fill(); }
  else {
    // 正脸：眼白 + 往左（往他那边）瞟的眼珠
    for (const ex of [-7, 7]) {
      ellipse(ctx, ex, top + 36, 5, 3); ctx.fillStyle = '#fbf1da'; ctx.fill();
      ctx.strokeStyle = '#5a3b1c'; ctx.lineWidth = 1.2; ctx.stroke();
      circle(ctx, ex - 2.5, top + 36, 1.8); ctx.fillStyle = '#5a3b1c'; ctx.fill();
    }
  }
  // 前手臂 + 供品
  const armF = new Path2D(); armF.moveTo(10, top + 72); armF.lineTo(36, top + 92); armF.lineTo(32, top + 100); armF.lineTo(6, top + 84); armF.closePath(); shade(armF);
  const off = new Path2D();
  if (item === 'jar') { off.ellipse(42, top + 86, 12, 15, 0, 0, Math.PI * 2); off.rect(36, top + 66, 12, 8); }
  else if (item === 'lyre') { off.moveTo(34, top + 104); off.lineTo(30, top + 60); off.lineTo(36, top + 60); off.lineTo(40, top + 98); off.lineTo(56, top + 98); off.lineTo(60, top + 58); off.lineTo(66, top + 58); off.lineTo(62, top + 104); off.closePath(); }
  else if (item === 'basket') { off.moveTo(30, top + 82); off.lineTo(60, top + 82); off.lineTo(54, top + 100); off.lineTo(36, top + 100); off.closePath(); }
  else { off.moveTo(36, top + 96); off.lineTo(46, top + 40); off.lineTo(52, top + 42); off.lineTo(42, top + 96); off.closePath(); off.ellipse(52, top + 46, 10, 6, -0.6, 0, Math.PI * 2); off.ellipse(46, top + 60, 10, 6, 0.6, 0, Math.PI * 2); }
  shade(off);
  ctx.restore();
}
function reliefLayer(pose) {
  return strip(`s02-relief-${pose}`, P_WALL, (ctx, x0, x1) => {
    // 砂岩底板 + 刻凿纹理
    const g = ctx.createLinearGradient(0, RELIEF[0], 0, RELIEF[1]);
    g.addColorStop(0, mix(SAND, OCHRE, 0.25)); g.addColorStop(1, mix(SAND, OCHRE, 0.5));
    ctx.fillStyle = g;
    ctx.fillRect(x0, RELIEF[0], x1 - x0, RELIEF[1] - RELIEF[0]);
    ctx.strokeStyle = rgba('#8a6a3f', 0.18); ctx.lineWidth = 1;
    for (let y = RELIEF[0] + 4; y < RELIEF[1]; y += 5) {
      ctx.beginPath();
      for (let x = x0; x < x1; x += 40) { const yy = y + (noise2(x * 0.01, y * 0.1, 3) - 0.5) * 3; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); }
      ctx.stroke();
    }
    ctx.fillStyle = rgba('#6b4a2b', 0.35); ctx.fillRect(x0, RELIEF[0], x1 - x0, 4);
    ctx.fillStyle = rgba('#fff3d6', 0.35); ctx.fillRect(x0, RELIEF[1] - 4, x1 - x0, 4);
    // 人物队列
    let i = 0;
    for (let x = x0 + 60; x < x1; x += FIG_GAP, i++) reliefFigure(ctx, x, (pose + i) % 2, OFFERINGS[i % OFFERINGS.length]);
  }, { y0: RELIEF[0] - 4, y1: RELIEF[1] + 4 });
}

// ---------- 路面：游行大道石板 ----------
function roadLayer() {
  return strip('s02-road', 1, (ctx, x0, x1) => {
    const R = rng('s02-road');
    ctx.fillStyle = mix(SAND, '#ffffff', 0.12);
    ctx.fillRect(x0, ROAD_Y, x1 - x0, 1000 - ROAD_Y);
    // 路沿：一条烧砖色带
    ctx.fillStyle = mix(OCHRE, BROWN, 0.35);
    ctx.fillRect(x0, ROAD_Y, x1 - x0, 12);
    const rows = [[812, 846], [846, 896], [896, 964], [964, 1000]];
    rows.forEach(([a, b], r) => {
      let x = x0 - R() * 120;
      while (x < x1) {
        const w = 110 + (b - a) * 2.2 + R() * 90;
        const t = R();
        ctx.fillStyle = mix(mix(SAND, '#f6ead1', 0.4), OCHRE, 0.12 + t * 0.2);
        ctx.fillRect(x + 2, a + 2, w - 4, b - a - 4);
        ctx.fillStyle = rgba('#fff8e8', 0.35); ctx.fillRect(x + 4, a + 3, w - 10, 2);
        if (R() > 0.6) { ctx.fillStyle = rgba(BROWN, 0.08); ellipse(ctx, x + R() * w, a + (b - a) * R(), 14 + R() * 20, 4 + R() * 5); ctx.fill(); }
        ctx.fillStyle = rgba(BROWN, 0.45); ctx.fillRect(x, a, 2.5, b - a);
        x += w;
      }
      ctx.fillStyle = rgba(BROWN, 0.35); ctx.fillRect(x0, b - 1.5, x1 - x0, 2.5);
    });
  }, { y0: ROAD_Y - 2, y1: 1000 });
}

// ---------- 场景 ----------
const glanceIndex = (env) => {
  // 定格时离他最近、在他右前方的那个浮雕人（画面 x ≈ 560 附近）
  const cam = env.camAt(GAG);
  const want = 560 + cam * P_WALL;
  const [x0] = stripRange(P_WALL);
  const i = Math.round((want - (x0 + 60)) / FIG_GAP);
  return { i, x: x0 + 60 + i * FIG_GAP };
};

export const s02 = {
  id: 's02',
  station: ST,
  figureAdjust(b) {
    // 第 7 拍前 0.3 拍：正面站立被「压扁」成侧身，第 7 拍弹回侧身走路
    const E = GAG + 4;
    if (b >= E - 0.3 && b < E) return { pose: 'stand', sx: lerp(1, 0.12, ease.inOut((b - (E - 0.3)) / 0.3)) };
    if (b >= E && b < E + 0.15) return { sx: lerp(1.12, 1, (b - E) / 0.15) };
    return null;
  },
  drawBack(ctx, b, env) {
    const cam = env.cam;
    // 天空（几乎不动）
    const g = ctx.createLinearGradient(0, 0, 0, 380);
    g.addColorStop(0, '#c99a62'); g.addColorStop(0.55, '#e9c58c'); g.addColorStop(1, '#f6e2b6');
    ctx.fillStyle = g;
    ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 380);
    const sx = 980 - cam * 0.03;
    const sg = ctx.createRadialGradient(sx, 210, 10, sx, 210, 230);
    sg.addColorStop(0, rgba('#fff4d6', 0.95)); sg.addColorStop(0.25, rgba('#fbe6b5', 0.6)); sg.addColorStop(1, rgba('#fbe6b5', 0));
    ctx.fillStyle = sg; ctx.fillRect(sx - 240, 0, 480, 400);
    circle(ctx, sx, 210, 62); ctx.fillStyle = '#fbeccb'; ctx.fill();
    // 薄云：几团拉长的柔边椭圆
    for (let k = 0; k < 5; k++) {
      const cx = ((k * 620 - cam * 0.08) % 2600 + 2600) % 2600 + X_MIN - 300, cy = 90 + k * 37, L = 220 + k * 40;
      for (let j = 0; j < 4; j++) {
        const ex = cx + j * L * 0.28, ew = L * (0.35 + 0.1 * (j % 2)), eh = 7 + (j % 3) * 3;
        const cg = ctx.createRadialGradient(ex, cy, 1, ex, cy, ew);
        cg.addColorStop(0, rgba('#fff3dc', 0.5)); cg.addColorStop(1, rgba('#fff3dc', 0));
        ctx.fillStyle = cg;
        ctx.save(); ctx.translate(ex, cy); ctx.scale(1, eh / ew); ctx.translate(-ex, -cy);
        circle(ctx, ex, cy, ew); ctx.fill();
        ctx.restore();
      }
    }
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, wallLayer(), cam);
    // 浮雕带：两种步态每拍交替（定格时也照走）
    const pose = Math.floor(env.gb + 1e-6) % 2;
    drawStrip(ctx, reliefLayer(pose), cam);
    // 梗：离他最近的浮雕人回头看他一眼（第 5 拍后半到第 6 拍后半）
    const k = smoothstep(GAG + 0.8, GAG + 1.0, b) * (1 - smoothstep(GAG + 3.4, GAG + 3.6, b));
    if (k > 0.5) {
      const { i, x } = glanceIndex(env);
      const sxp = x - cam * P_WALL;
      ctx.save();
      ctx.beginPath(); ctx.rect(sxp - 30, RELIEF[0] + 4, 64, 92); ctx.clip();
      ctx.fillStyle = mix(SAND, OCHRE, 0.3); ctx.fillRect(sxp - 30, RELIEF[0] + 4, 64, 92);
      reliefFigure(ctx, sxp, (pose + i) % 2, OFFERINGS[((i % 4) + 4) % 4], true);
      ctx.restore();
    }
    drawStrip(ctx, roadLayer(), cam);
    // 浮尘
    ctx.fillStyle = rgba('#fff3d0', 0.5);
    for (let k2 = 0; k2 < 26; k2++) {
      const px = ((hash2(k2, 1, 2) * 2200 - cam * 0.9 + b * 18 * (0.5 + hash2(k2, 2, 2))) % 2200 + 2200) % 2200 + X_MIN;
      const py = 380 + hash2(k2, 3, 2) * 380 + Math.sin(b * 1.3 + k2) * 10;
      circle(ctx, px, py, 1.2 + hash2(k2, 4, 2) * 1.6); ctx.fill();
    }
  },
  drawFront(ctx, b, env) {
    // 前景：陶罐与棕榈叶，放在定格时画面两侧，不挡人物
    const cam = env.cam, c4 = env.camAt(GAG);
    const items = [[-260, 'jar'], [1240, 'frond'], [2100, 'jar']];
    for (const [sx0, kind] of items) {
      const x = sx0 + c4 * P_FG - cam * P_FG;
      if (x < X_MIN - 200 || x > X_MAX + 200) continue;
      if (kind === 'jar') {
        ctx.fillStyle = rgba('#000', 0.25); ellipse(ctx, x + 10, 992, 90, 14); ctx.fill();
        smoothPath(ctx, [[x - 40, 860], [x - 70, 910], [x - 66, 970], [x - 30, 996], [x + 30, 996], [x + 66, 970], [x + 70, 910], [x + 40, 860]], true);
        const g = ctx.createLinearGradient(x - 70, 0, x + 70, 0);
        g.addColorStop(0, '#8a4f24'); g.addColorStop(0.4, '#c77a3a'); g.addColorStop(1, '#5e3418');
        ctx.fillStyle = g; ctx.fill();
        ctx.fillStyle = '#6e3c19'; ctx.fillRect(x - 34, 846, 68, 16);
        ctx.strokeStyle = rgba(CREAM, 0.6); ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 64, 930); ctx.lineTo(x + 64, 930); ctx.stroke();
      } else {
        ctx.fillStyle = '#5c6b2e';
        for (let k = 0; k < 6; k++) {
          const a = -2.3 + k * 0.32;
          smoothPath(ctx, [[x, 1010], [x + Math.cos(a) * 160, 1010 + Math.sin(a) * 240], [x + Math.cos(a + 0.06) * 300, 1010 + Math.sin(a + 0.06) * 330], [x + Math.cos(a + 0.12) * 160, 1010 + Math.sin(a + 0.12) * 240]], true);
          ctx.fill();
        }
      }
    }
  },
  drawFrame(ctx, R, env) {
    drawDefaultFrame(ctx, R, R.s, { gold: '#c9a06a', dark: '#5e4022', light: '#efd8a8' });
  },
  cardStyle: {
    ink: BROWN, accent: LAPIS, bar: false,
    bgDraw(ctx, x, y, w, h) {
      // 泥板：圆角、略不规整的边，四周刻一圈楔形纹（装饰，不是文字）
      ctx.save();
      ctx.shadowColor = 'rgba(40,20,0,0.35)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
      roundRect(ctx, x, y, w, h, 26);
      const g = ctx.createLinearGradient(x, y, x, y + h);
      g.addColorStop(0, '#e2c08b'); g.addColorStop(1, CLAY);
      ctx.fillStyle = g; ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = rgba(BROWN, 0.5); ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = rgba(BROWN, 0.55);
      const wedge = (wx, wy, r) => { ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + 9, wy - 3 + r); ctx.lineTo(wx + 9, wy + 3 + r); ctx.closePath(); ctx.fill(); };
      for (let wx = x + 22; wx < x + w - 22; wx += 15) { wedge(wx, y + 14, (wx * 7) % 3 - 1); wedge(wx, y + h - 14, (wx * 5) % 3 - 1); }
      ctx.fillStyle = LAPIS;
      ctx.fillRect(x + 22, y + 30, 6, h - 60);
      ctx.restore();
    },
  },
  playerStyle: {
    plate: CLAY, ink: BROWN, noteColor: LAPIS,
    palette: { body: '#d8b47e', label: CREAM, window: LAPIS_D, accent: LAPIS, tape: '#6b4a2b', ink: BROWN },
  },
};
