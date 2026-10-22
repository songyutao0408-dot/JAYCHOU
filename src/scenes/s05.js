// 第 5 站 · 七里香（Common Jasmine Orange, 2004）·「止战之殇」· 硝烟里的白鸽 · 黑白木刻版画
// 灰纸黑墨，整幅画没有纯白——唯一的白留给那只白鸽。
// 构图：墨黑的天空刻出横线（近地平线变亮）、被硝烟遮住的太阳 → 远处残破的楼与烟囱、翻滚上升的硝烟
//       → 铁丝网、枯树、沙袋 → 坑洼土路、碎石 → 前景蛇腹铁丝网、一顶头盔
// 梗：白鸽从右上方飞来，第 5 拍强拍落在他肩上；第 7 拍他继续走，鸽子跳到走路的肩上；第 8 拍飞进下一道画框。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { woodcut, hatch, carveEdge } from '../kit/etch.js';
import { baked } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { smoothPath, circle, ellipse, poly, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { SB } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { ANCHORS } from '../rig/walker.js';
import { K } from '../main/layout.js';

const ST = stationByN(5);
const INK = '#121110', PAPER = '#8f8a80', PAPER_L = '#b3ada1', WHITE = '#ffffff';
const P_FAR = 0.3, P_MID = 0.65, P_FG = 1.3;
const HORIZON = 560;

// ---------- 天空：墨底刻横线 ----------
function skyLayer() {
  return strip('s05-sky', 0.04, (ctx, x0, x1) => {
    const path = new Path2D(); path.rect(x0, 0, x1 - x0, HORIZON + 20);
    woodcut(ctx, path, {
      ink: INK, paper: PAPER, gap: 9, angle: 0.02, wobble: 3, seed: 11, bounds: [x0, 0, x1 - x0, HORIZON + 20],
      tone: (x, y) => 0.08 + 0.72 * Math.pow(y / HORIZON, 1.8) + (noise2(x * 0.004, y * 0.01, 2) - 0.5) * 0.25,
    });
    // 被硝烟遮住的太阳：一圈圈刻纹
    const sx = 980, sy = 230;
    for (let r = 120; r > 8; r -= 11) {
      ctx.strokeStyle = PAPER; ctx.lineWidth = r > 70 ? 2 : 4.5;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
    }
    circle(ctx, sx, sy, 30); ctx.fillStyle = PAPER_L; ctx.fill();
  }, { y0: 0, y1: HORIZON + 20 });
}

// ---------- 远景：残破的楼、烟囱 ----------
function ruins() {
  return strip('s05-ruins', P_FAR, (ctx, x0, x1) => {
    const R = rng('s05-ruins');
    let x = x0;
    while (x < x1) {
      const w = 90 + R() * 170, h = 110 + R() * 220;
      const top = HORIZON - h;
      // 断裂的楼顶：锯齿形
      const pts = [[x, HORIZON + 30], [x, top + R() * 30]];
      const n = 3 + Math.floor(R() * 4);
      for (let k = 1; k < n; k++) pts.push([x + (w * k) / n, top + R() * 70 - (k === 1 ? 20 : 0)]);
      pts.push([x + w, top + R() * 40], [x + w, HORIZON + 30]);
      const p = new Path2D(); pts.forEach(([px, py], i) => (i ? p.lineTo(px, py) : p.moveTo(px, py))); p.closePath();
      // 亮面在左：竖向刻线
      woodcut(ctx, p, { ink: INK, paper: PAPER, gap: 6, angle: Math.PI / 2, wobble: 1, seed: Math.floor(x), bounds: [x - 10, top - 80, w + 20, h + 120], tone: (px) => 0.32 * (1 - (px - x) / w) });
      carveEdge(ctx, p, { color: PAPER, width: 2 });
      // 空窗洞
      ctx.fillStyle = INK;
      for (let wy = top + 30; wy < HORIZON - 20; wy += 34) for (let wx = x + 12; wx < x + w - 18; wx += 26) {
        if (R() < 0.35) continue;
        ctx.fillRect(wx, wy, 12, 18);
        ctx.fillStyle = PAPER; ctx.fillRect(wx, wy + 16, 12, 2); ctx.fillStyle = INK;
      }
      // 伸出的断梁
      if (R() > 0.5) {
        ctx.strokeStyle = INK; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x + w * 0.6, top + 20); ctx.lineTo(x + w * 0.6 + 40, top - 26); ctx.stroke();
      }
      // 烟囱
      if (R() > 0.7) {
        const cx = x + w * (0.2 + R() * 0.6), ch = 140 + R() * 80;
        const cp = new Path2D(); cp.rect(cx, top - ch, 26, ch + 20);
        woodcut(ctx, cp, { ink: INK, paper: PAPER, gap: 5, angle: Math.PI / 2, seed: 4, bounds: [cx - 5, top - ch - 5, 40, ch + 30], tone: (px) => 0.4 * (1 - (px - cx) / 26) });
      }
      x += w + R() * 30;
    }
  }, { y0: 150, y1: HORIZON + 40 });
}

// ---------- 硝烟：预先刻好几团烟，动画时平移、放大 ----------
function puff(i) {
  return baked(`s05-puff-${i}`, 300, 300, (ctx) => {
    const R = rng('puff', i);
    const p = new Path2D();
    const cx = 150, cy = 150;
    const blobs = Array.from({ length: 7 }, () => [cx + (R() - 0.5) * 120, cy + (R() - 0.5) * 90, 40 + R() * 45]);
    for (const [x, y, r] of blobs) { p.moveTo(x + r, y); p.arc(x, y, r, 0, Math.PI * 2); }
    ctx.fillStyle = INK; ctx.fill(p);
    // 旋涡状的刻线
    ctx.save(); ctx.clip(p);
    for (const [x, y, r] of blobs) {
      for (let rr = r * 0.9; rr > 6; rr -= 9) {
        ctx.strokeStyle = rr > r * 0.5 ? PAPER : PAPER_L; ctx.lineWidth = 2.2 + (r - rr) * 0.04;
        ctx.beginPath(); ctx.arc(x - r * 0.15, y - r * 0.15, rr, Math.PI * 0.9 + R(), Math.PI * 1.9 + R()); ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.stroke(p);
  });
}
function drawSmoke(ctx, b, cam) {
  // 三根烟柱：每团烟从烟柱底部升起、变大、向右飘；按拍位推算位置（纯函数）
  const columns = [[-120, 0], [520, 1], [1180, 2], [1900, 0]];
  for (const [lx, ci] of columns) {
    const baseX = lx - cam * P_FAR, baseY = HORIZON - 120;
    for (let k = 0; k < 6; k++) {
      const life = ((b * 0.16 + k / 6 + ci * 0.13) % 1 + 1) % 1; // 0..1
      const s = 0.45 + life * 1.1;
      const x = baseX + life * 160 + Math.sin(life * 4 + k) * 20, y = baseY - life * 420;
      const img = puff((k + ci) % 3);
      ctx.globalAlpha = Math.min(1, life * 4) * (1 - smoothstep(0.75, 1, life));
      ctx.drawImage(img, x - 150 * s / K, y - 150 * s / K, 300 * s / K, 300 * s / K);
    }
  }
  ctx.globalAlpha = 1;
}

// ---------- 中景：铁丝网、枯树、沙袋 ----------
function midLayer() {
  return strip('s05-mid', P_MID, (ctx, x0, x1) => {
    const R = rng('s05-mid');
    // 田野
    const field = new Path2D(); field.rect(x0, HORIZON - 4, x1 - x0, ROAD_Y - HORIZON + 30);
    woodcut(ctx, field, { ink: INK, paper: PAPER, gap: 8, angle: 0.0, wobble: 3, seed: 21, bounds: [x0, HORIZON - 10, x1 - x0, 300], tone: (x, y) => 0.55 - (y - HORIZON) / 500 + (noise2(x * 0.01, y * 0.02, 4) - 0.5) * 0.3 });
    // 枯树
    for (let tx = x0 + 200; tx < x1; tx += 700 + R() * 500) {
      const tree = new Path2D();
      const branch = (x, y, a, len, w, d) => {
        const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
        const nx = -Math.sin(a) * w / 2, ny = Math.cos(a) * w / 2;
        tree.moveTo(x + nx, y + ny); tree.lineTo(ex + nx * 0.6, ey + ny * 0.6); tree.lineTo(ex - nx * 0.6, ey - ny * 0.6); tree.lineTo(x - nx, y - ny); tree.closePath();
        if (d > 0) { branch(ex, ey, a - 0.4 - R() * 0.3, len * 0.72, w * 0.62, d - 1); branch(ex, ey, a + 0.35 + R() * 0.3, len * 0.66, w * 0.6, d - 1); }
      };
      branch(tx, ROAD_Y - 30, -Math.PI / 2 + (R() - 0.5) * 0.2, 150, 22, 4);
      ctx.fillStyle = INK; ctx.fill(tree);
      hatch(ctx, tree, { angle: 1.2, gap: 7, color: PAPER, width: () => 1.4, wobble: 1, bounds: [tx - 250, ROAD_Y - 520, 500, 520] });
    }
    // 沙袋墙
    for (let sx = x0 + 60; sx < x1; sx += 900 + R() * 400) {
      for (let row = 0; row < 3; row++) for (let k = 0; k < 5 - row; k++) {
        const bx = sx + k * 58 + row * 29, by = ROAD_Y - 26 - row * 30;
        const bag = new Path2D(); bag.ellipse(bx, by, 30, 16, 0, 0, Math.PI * 2);
        woodcut(ctx, bag, { ink: INK, paper: PAPER, gap: 5, angle: 0.2, seed: k + row, bounds: [bx - 32, by - 18, 64, 36], tone: (x, y) => 0.55 - (y - by + 16) / 40 });
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke(bag);
      }
    }
    // 铁丝网：歪斜的桩 + 三道下垂的线 + 刺
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const posts = [];
    for (let px = x0; px < x1; px += 170 + R() * 40) posts.push([px, (R() - 0.5) * 0.25]);
    for (const [px, tilt] of posts) {
      ctx.lineWidth = 9;
      ctx.beginPath(); ctx.moveTo(px, ROAD_Y - 6); ctx.lineTo(px + Math.sin(tilt) * 190, ROAD_Y - 196); ctx.stroke();
      ctx.strokeStyle = PAPER; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - 2, ROAD_Y - 10); ctx.lineTo(px - 2 + Math.sin(tilt) * 180, ROAD_Y - 190); ctx.stroke();
      ctx.strokeStyle = INK;
    }
    for (let w = 0; w < 3; w++) {
      ctx.lineWidth = 2.4;
      for (let i = 0; i < posts.length - 1; i++) {
        const [a, ta] = posts[i], [b2, tb] = posts[i + 1];
        const ya = ROAD_Y - 60 - w * 55, yb = ROAD_Y - 60 - w * 55;
        const xa = a + Math.sin(ta) * (60 + w * 55), xb = b2 + Math.sin(tb) * (60 + w * 55);
        ctx.beginPath(); ctx.moveTo(xa, ya); ctx.quadraticCurveTo((xa + xb) / 2, ya + 22, xb, yb); ctx.stroke();
        for (let t = 0.15; t < 1; t += 0.22) {
          const bx = lerp(xa, xb, t), by = lerp(ya, yb, t) + 22 * 4 * t * (1 - t) * 0.5;
          ctx.beginPath(); ctx.moveTo(bx - 6, by - 6); ctx.lineTo(bx + 6, by + 6); ctx.moveTo(bx + 6, by - 6); ctx.lineTo(bx - 6, by + 6); ctx.stroke();
        }
      }
    }
  }, { y0: 300, y1: ROAD_Y + 30 });
}

// ---------- 路面：坑洼土路 ----------
function roadLayer() {
  return strip('s05-road', 1, (ctx, x0, x1) => {
    const R = rng('s05-road');
    const p = new Path2D(); p.rect(x0, ROAD_Y, x1 - x0, 1000 - ROAD_Y);
    woodcut(ctx, p, { ink: INK, paper: PAPER, gap: 7, angle: 0.01, wobble: 2.5, seed: 31, bounds: [x0, ROAD_Y, x1 - x0, 210], tone: (x, y) => 0.62 - (y - ROAD_Y) / 420 + (noise2(x * 0.006, y * 0.02, 6) - 0.5) * 0.35 });
    // 路沿
    ctx.fillStyle = INK; ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 6);
    // 车辙
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    for (const y of [870, 930]) { ctx.beginPath(); for (let x = x0; x < x1; x += 40) { const yy = y + (noise2(x * 0.004, y, 8) - 0.5) * 16; x === x0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
    // 碎石与水洼
    for (let i = 0; i < (x1 - x0) / 40; i++) {
      const x = x0 + R() * (x1 - x0), y = ROAD_Y + 20 + R() * 170, r = 4 + R() * 14;
      if (R() < 0.12) { ctx.fillStyle = PAPER_L; ellipse(ctx, x, y, r * 4, r * 0.8); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke(); continue; }
      smoothPath(ctx, [[x - r, y], [x - r * 0.4, y - r * 0.9], [x + r * 0.7, y - r * 0.6], [x + r, y + r * 0.3], [x, y + r * 0.6]], true);
      ctx.fillStyle = INK; ctx.fill();
      ctx.strokeStyle = PAPER; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.4); ctx.lineTo(x + r * 0.2, y - r * 0.6); ctx.stroke();
    }
  }, { y0: ROAD_Y - 4, y1: 1000 });
}

// ---------- 白鸽 ----------
function dove(ctx, x, y, s, flap, facing = 1, perch = false) {
  // 白色（全片唯一的纯白），黑色刻线勾羽毛；flap 0..1 翅膀位置
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * facing, s);
  const body = new Path2D();
  body.moveTo(-34, 2); body.quadraticCurveTo(-10, -16, 18, -10); body.quadraticCurveTo(30, -22, 40, -16);
  body.quadraticCurveTo(46, -12, 52, -10); body.lineTo(44, -6); body.quadraticCurveTo(38, 4, 24, 8);
  body.quadraticCurveTo(0, 16, -24, 10); body.lineTo(-48, 16); body.lineTo(-44, 4); body.closePath();
  const wingA = perch ? 0.1 : -1.1 + flap * 2.0;
  const wing = new Path2D();
  wing.moveTo(-4, -6);
  wing.quadraticCurveTo(-10 + Math.cos(wingA) * 20, -6 + Math.sin(wingA) * 50, -30 + Math.cos(wingA) * 36, -6 + Math.sin(wingA) * 62);
  wing.quadraticCurveTo(-30, -2 + Math.sin(wingA) * 20, 14, -2); wing.closePath();
  ctx.fillStyle = WHITE; ctx.fill(body); ctx.fill(wing);
  ctx.strokeStyle = INK; ctx.lineWidth = 2.4 / s; ctx.lineJoin = 'round';
  ctx.stroke(body); ctx.stroke(wing);
  // 羽毛刻线
  ctx.lineWidth = 1.4 / s;
  for (let k = 0; k < 4; k++) {
    const t = 0.3 + k * 0.17;
    ctx.beginPath();
    ctx.moveTo(-6 - k * 6, -5);
    ctx.lineTo(-10 + Math.cos(wingA) * 20 * t - k * 6, -6 + Math.sin(wingA) * 48 * t);
    ctx.stroke();
  }
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-34 - k * 4, 6 + k); ctx.lineTo(-46, 10 + k * 2); ctx.stroke(); }
  // 眼与喙
  circle(ctx, 40, -14, 2.2 / s * 1.4); ctx.fillStyle = INK; ctx.fill();
  ctx.fillStyle = '#5a554d';
  poly(ctx, [[50, -12], [58, -9], [50, -7]]); ctx.fill();
  if (perch) { ctx.strokeStyle = INK; ctx.lineWidth = 2 / s; ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(2, 22); ctx.moveTo(12, 10); ctx.lineTo(12, 22); ctx.stroke(); }
  ctx.restore();
}
/** 鸽子在第 b 拍的位置（画面单位）、姿态。 */
function doveAt(b, env) {
  const fig = env.figure();
  // 鸽子原点在身体中心，脚在下方约 22×s；让脚落在肩头（走路时肩头在头后，略往前挪一点免得压住头）
  const S = 1.15;
  // 正面站立：停在肩膀外侧、朝外；走路：停在肩背上，不压住头
  const sh = (pose) => { const a = ANCHORS[pose].shoulder; return [fig.x + (a[0] + (pose === 'walk' ? -30 : 34)) * fig.scale, fig.y + (a[1] + (pose === 'walk' ? 10 : 6)) * fig.scale - 22 * S]; };
  const LAND = SB(5), HOP = SB(7), OFF = SB(7.6), LEAVE = SB(8.8), START = SB(3.2);
  if (b < START || b > LEAVE) return null;
  if (b < LAND) {
    // 从右上方弧线飞来
    // 先从右上方划过天空，最后半拍收翅落下
    const t = (b - START) / (LAND - START);
    const [tx, ty] = sh('stand');
    const e = ease.inOut(t);
    return { x: lerp(1500, tx, e), y: lerp(90, ty, Math.pow(t, 1.6)) - Math.sin(Math.PI * t) * 60, flap: t > 0.85 ? 0.15 : (b * 3) % 1, facing: -1, perch: false, s: S };
  }
  if (b < HOP) return { ...xy(sh(fig.pose === 'stand' ? 'stand' : 'walk')), flap: 0, facing: b < LAND + 0.25 ? -1 : 1, perch: true, s: S, bob: Math.max(0, Math.sin((b - LAND) * Math.PI * 2)) * 3 };
  if (b < HOP + 0.18) {
    const t = (b - HOP) / 0.18;
    const [ax, ay] = sh('stand'), [bx2, by2] = sh('walk');
    return { x: lerp(ax, bx2, t), y: lerp(ay, by2, t) - Math.sin(Math.PI * t) * 26, flap: 0.5, facing: 1, perch: false, s: S };
  }
  if (b < OFF) return { ...xy(sh('walk')), flap: 0, facing: 1, perch: true, s: S };
  // 起飞：先向上，再从下一道画框的上方掠过、飞出画面
  const t = (b - OFF) / (LEAVE - OFF);
  const [ax, ay] = sh('walk');
  return { x: lerp(ax, 1450, ease.in(t)), y: lerp(ay, 110, ease.out(t)), flap: (b * 3) % 1, facing: 1, perch: false, s: S * (1 - t * 0.3) };
}
const xy = ([x, y]) => ({ x, y });

export const s05 = {
  id: 's05',
  station: ST,
  drawBack(ctx, b, env) {
    const cam = env.cam;
    drawStrip(ctx, skyLayer(), cam);
    drawSmoke(ctx, b, cam);
    drawStrip(ctx, ruins(), cam);
    drawStrip(ctx, midLayer(), cam);
    drawStrip(ctx, roadLayer(), cam);
  },
  drawFront(ctx, b, env) {
    const cam = env.cam, c5 = env.camAt(SB(5));
    // 前景：蛇腹铁丝网与一顶头盔（定格时在画面两侧，不挡人物）
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    for (const [sx0, kind] of [[-200, 'coil'], [980, 'helmet'], [1250, 'coil'], [2200, 'coil']]) {
      const x = sx0 + c5 * P_FG - cam * P_FG;
      if (x < X_MIN - 400 || x > X_MAX + 400) continue;
      if (kind === 'coil') {
        ctx.lineWidth = 3;
        for (let k = 0; k < 14; k++) {
          ctx.beginPath(); ctx.ellipse(x + k * 26, 952, 26, 46, 0.35, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x + k * 26 - 4, 908); ctx.lineTo(x + k * 26 + 6, 900); ctx.stroke();
        }
      } else {
        const p = new Path2D(); p.ellipse(x, 960, 70, 44, 0, Math.PI, 0); p.lineTo(x + 86, 962); p.lineTo(x - 86, 962); p.closePath();
        ctx.fillStyle = INK; ctx.fill(p);
        ctx.save(); ctx.clip(p);
        ctx.strokeStyle = PAPER; ctx.lineWidth = 2.4;
        for (let r = 60; r > 10; r -= 9) { ctx.beginPath(); ctx.arc(x - 18, 954, r, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke(); }
        ctx.restore();
        ctx.fillStyle = PAPER; ctx.fillRect(x - 86, 960, 172, 3);
      }
    }
    // 白鸽
    const d = doveAt(b, env);
    if (d) dove(ctx, d.x, d.y - (d.bob || 0), d.s, d.flap, d.facing, d.perch);
  },
  drawFrame(ctx, R) {
    // 木刻画框：黑色粗框 + 刻出的浅色细线
    const t = 64 * R.s, { x, y, w, h } = R;
    ctx.save();
    const outer = new Path2D(); outer.rect(x - t, y - t, w + 2 * t, h + 2 * t); outer.rect(x, y, w, h);
    ctx.fillStyle = INK; ctx.fill(outer, 'evenodd');
    ctx.strokeStyle = PAPER; ctx.lineWidth = Math.max(1, 2.5 * R.s);
    for (const k of [0.25, 0.5, 0.72]) ctx.strokeRect(x - t * k, y - t * k, w + 2 * t * k, h + 2 * t * k);
    ctx.lineWidth = Math.max(1, 4 * R.s); ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    ctx.restore();
  },
  cardStyle: {
    ink: PAPER_L, accent: PAPER, bar: false,
    bgDraw(ctx, x, y, w, h) {
      // 木刻印出的黑色块，边缘有刻刀留下的浅色线
      ctx.save();
      ctx.fillStyle = INK; ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = PAPER; ctx.lineWidth = 2;
      ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      ctx.setLineDash([18, 6, 8, 5]); ctx.strokeRect(x + 16, y + 16, w - 32, h - 32); ctx.setLineDash([]);
      ctx.restore();
    },
  },
  playerStyle: {
    plate: INK, ink: PAPER_L, noteColor: PAPER,
    palette: { body: '#6f6a61', label: PAPER_L, window: INK, accent: INK, tape: '#2a2725', ink: INK, hub: PAPER },
  },
};
