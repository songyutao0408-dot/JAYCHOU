// 第 9 站 · 魔杰座（Capricorn, 2008）·「乔克叔叔」· 马戏团小丑 · 19 世纪石版画海报
// 有限套色（米白、红、深蓝、青绿、芥末黄），色块与深蓝轮廓线故意错开一点（套色不准）+ 蜡笔颗粒。海报上不放任何字。
// 构图：大棚里红白竖条纹篷布、荷叶边帷幔、三角彩旗、扫动的探照灯 → 观众席 → 带星星的马戏场围栏、鼓凳
//       → 木屑地面；右侧是原创的高个丑角「乔克叔叔」，手里攥着一把气球。
// 梗：第 8 拍他递出一只气球，第 9 拍强拍他接住；第 11 拍后半被气球带着整个人飘起来，第 13 拍强拍落回；第 14 拍松手，气球飘走。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { grainPattern, stipple } from '../kit/etch.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { rgba, mix } from '../kit/color.js';
import { smoothPath, circle, ellipse, poly, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { ANCHORS } from '../rig/walker.js';

const ST = stationByN(9);
const CREAM = '#efe0bf', PAPER = '#f4e8cc', RED = '#d0533c', RED_D = '#a63a2a', NAVY = '#2b2a3a', TEAL = '#2f7d6d', MUSTARD = '#e2a93b';
const P_TENT = 0.35, P_STANDS = 0.55, P_RING = 0.85, P_POLE = 0.92;
const REG = [3, 2]; // 套色错位

/** 石版风格的形状：色块错开一点，再描深蓝轮廓。 */
function litho(ctx, path, fill, { line = 3, stroke = NAVY } = {}) {
  ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = fill; ctx.fill(path); ctx.restore();
  if (line) { ctx.strokeStyle = stroke; ctx.lineWidth = line; ctx.lineJoin = 'round'; ctx.stroke(path); }
}
function star(cx, cy, r, n = 5) {
  const p = new Path2D();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? r * 0.45 : r;
    i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  p.closePath();
  return p;
}
function grain(ctx, x0, y0, w, h, alpha = 0.35) {
  ctx.save();
  ctx.fillStyle = grainPattern(ctx, { color: '43,42,58', density: 0.1, alpha, seed: 9 });
  ctx.fillRect(x0, y0, w, h);
  ctx.restore();
}

// ---------- 篷布：竖条纹 + 帷幔 + 彩旗 ----------
function tentLayer() {
  return strip('s09-tent', P_TENT, (ctx, x0, x1) => {
    const W = 74;
    for (let x = Math.floor(x0 / W) * W; x < x1; x += W) {
      const red = Math.round(x / W) % 2 === 0;
      const p = new Path2D();
      // 条纹略带弧度：上窄下宽，像篷布被拉紧
      p.moveTo(x + 6, 120); p.quadraticCurveTo(x + 2, 400, x - 4, 720); p.lineTo(x + W - 4, 720); p.quadraticCurveTo(x + W + 2, 400, x + W + 6, 120); p.closePath();
      ctx.fillStyle = red ? RED : PAPER; ctx.fill(p);
    }
    // 上暗下亮
    const g = ctx.createLinearGradient(0, 100, 0, 720);
    g.addColorStop(0, rgba(NAVY, 0.55)); g.addColorStop(0.5, rgba(NAVY, 0.12)); g.addColorStop(1, rgba(NAVY, 0.0));
    ctx.fillStyle = g; ctx.fillRect(x0, 100, x1 - x0, 620);
    stipple(ctx, (() => { const p = new Path2D(); p.rect(x0, 100, x1 - x0, 300); return p; })(), { color: NAVY, density: 0.004, r: 1.6, tone: (x, y) => 1 - (y - 100) / 320, bounds: [x0, 100, x1 - x0, 300] });
    // 荷叶边帷幔
    ctx.fillStyle = NAVY; ctx.fillRect(x0, 0, x1 - x0, 150);
    const val = new Path2D();
    val.moveTo(x0, 140);
    for (let x = x0; x < x1; x += 90) val.quadraticCurveTo(x + 45, 214, x + 90, 140);
    val.lineTo(x1, 0); val.lineTo(x0, 0); val.closePath();
    litho(ctx, val, RED_D);
    ctx.strokeStyle = MUSTARD; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, 140); for (let x = x0; x < x1; x += 90) ctx.quadraticCurveTo(x + 45, 214, x + 90, 140); ctx.stroke();
    for (let x = x0 + 45; x < x1; x += 90) { // 流苏
      ctx.strokeStyle = MUSTARD; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, 178); ctx.lineTo(x, 214); ctx.stroke();
      circle(ctx, x, 218, 7); ctx.fillStyle = MUSTARD; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.stroke();
    }
    // 三角彩旗：两串下垂的绳
    const flags = [TEAL, MUSTARD, RED, PAPER];
    for (const [yy, span, sag] of [[250, 520, 60], [320, 640, 80]]) {
      for (let x = x0 - span / 2 + ((yy * 3) % span); x < x1; x += span) {
        ctx.strokeStyle = NAVY; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + span / 2, yy + sag * 2, x + span, yy); ctx.stroke();
        for (let k = 1; k < 12; k++) {
          const t = k / 12, fx = x + span * t, fy = yy + sag * 4 * t * (1 - t);
          const p = new Path2D(); p.moveTo(fx - 16, fy); p.lineTo(fx + 16, fy); p.lineTo(fx, fy + 36); p.closePath();
          litho(ctx, p, flags[(k + Math.round(x)) % 4], { line: 2 });
        }
      }
    }
    grain(ctx, x0, 0, x1 - x0, 720, 0.3);
  }, { y0: 0, y1: 720 });
}

// ---------- 观众席 ----------
function standsLayer() {
  return strip('s09-stands', P_STANDS, (ctx, x0, x1) => {
    const R = rng('s09-stands');
    for (let row = 0; row < 4; row++) {
      const y = 470 + row * 46;
      const bench = new Path2D(); bench.rect(x0, y + 26, x1 - x0, 20);
      litho(ctx, bench, row % 2 ? '#6c4a3a' : '#7d5644', { line: 2 });
      for (let x = x0 + R() * 30; x < x1; x += 34 + R() * 16) {
        if (R() < 0.12) continue;
        const h = 30 + R() * 10;
        const head = new Path2D(); head.ellipse(x, y + 18 - h * 0.5, 13, 15, 0, 0, Math.PI * 2);
        head.rect(x - 17, y + 20 - h * 0.2, 34, 30);
        ctx.fillStyle = mix(NAVY, '#5d5a7a', 0.2 + 0.4 * R()); ctx.fill(head);
        if (R() < 0.18) { ctx.fillStyle = NAVY; ctx.fillRect(x - 15, y - h * 0.5 - 4, 30, 6); ctx.fillRect(x - 9, y - h * 0.5 - 20, 18, 18); } // 礼帽
      }
    }
    // 栏杆
    const rail = new Path2D(); rail.rect(x0, 646, x1 - x0, 16);
    litho(ctx, rail, RED, { line: 2.5 });
    for (let x = x0; x < x1; x += 46) { const p = new Path2D(); p.rect(x, 660, 10, 40); litho(ctx, p, MUSTARD, { line: 2 }); }
    grain(ctx, x0, 440, x1 - x0, 270, 0.25);
  }, { y0: 400, y1: 710 });
}

// ---------- 马戏场围栏 + 鼓凳 ----------
function ringLayer() {
  return strip('s09-ring', P_RING, (ctx, x0, x1) => {
    const R = rng('s09-ring');
    const wall = new Path2D(); wall.rect(x0, 700, x1 - x0, 98);
    litho(ctx, wall, RED, { line: 3 });
    const band = new Path2D(); band.rect(x0, 700, x1 - x0, 20);
    litho(ctx, band, NAVY, { line: 0 });
    ctx.fillStyle = MUSTARD; ctx.fillRect(x0, 716, x1 - x0, 4);
    for (let x = x0 + 40; x < x1; x += 110) litho(ctx, star(x, 760, 20), MUSTARD, { line: 2 });
    // 鼓凳
    for (let x = x0 + 300; x < x1; x += 760 + R() * 300) {
      const top = new Path2D(); top.ellipse(x, 640, 70, 18, 0, 0, Math.PI * 2);
      const side = new Path2D(); side.moveTo(x - 70, 640); side.lineTo(x - 70, 700); side.ellipse(x, 700, 70, 18, 0, Math.PI, 0, true); side.lineTo(x + 70, 640); side.closePath();
      litho(ctx, side, TEAL);
      ctx.save(); ctx.clip(side);
      ctx.fillStyle = PAPER; for (let k = -3; k < 4; k++) ctx.fillRect(x + k * 24 - 6, 640, 12, 80);
      ctx.restore();
      ctx.strokeStyle = NAVY; ctx.lineWidth = 3; ctx.stroke(side);
      litho(ctx, top, MUSTARD);
      litho(ctx, star(x, 676, 16), RED, { line: 2 });
    }
    grain(ctx, x0, 600, x1 - x0, 210, 0.3);
  }, { y0: 600, y1: 810 });
}

// ---------- 大柱子 ----------
function poleLayer() {
  return strip('s09-pole', P_POLE, (ctx, x0, x1) => {
    for (let x = x0 + 900; x < x1; x += 1500) {
      const p = new Path2D(); p.rect(x - 22, 0, 44, 700);
      litho(ctx, p, NAVY, { line: 0 });
      ctx.save(); ctx.clip(p);
      ctx.strokeStyle = MUSTARD; ctx.lineWidth = 12;
      for (let y = -60; y < 760; y += 70) { ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y + 40); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = NAVY; ctx.lineWidth = 3; ctx.strokeRect(x - 22, 0, 44, 700);
    }
  }, { y0: 0, y1: 710 });
}

// ---------- 地面：木屑 ----------
function floorLayer() {
  return strip('s09-floor', 1, (ctx, x0, x1) => {
    const g = ctx.createLinearGradient(0, ROAD_Y, 0, 1000);
    g.addColorStop(0, '#e9cf98'); g.addColorStop(1, '#d6b67a');
    ctx.fillStyle = g; ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 1000 - ROAD_Y + 2);
    const p = new Path2D(); p.rect(x0, ROAD_Y, x1 - x0, 200);
    stipple(ctx, p, { color: '#8a6a3a', density: 0.01, r: 1.5, tone: () => 0.45, bounds: [x0, ROAD_Y, x1 - x0, 200] });
    ctx.strokeStyle = PAPER; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(x0, 905); for (let x = x0; x < x1; x += 60) ctx.lineTo(x, 905 + Math.sin(x * 0.004) * 6); ctx.stroke();
    ctx.fillStyle = NAVY; ctx.fillRect(x0, ROAD_Y - 2, x1 - x0, 5);
    grain(ctx, x0, ROAD_Y, x1 - x0, 200, 0.28);
  }, { y0: ROAD_Y - 4, y1: 1000 });
}

// ---------- 乔克叔叔（原创丑角） ----------
const BALLOON_COLS = [TEAL, MUSTARD, RED, '#7a5aa6'];
function balloon(ctx, x, y, col, r = 34, sway = 0) {
  const p = new Path2D(); p.ellipse(x, y, r * 0.86, r, sway, 0, Math.PI * 2);
  litho(ctx, p, col, { line: 2.6 });
  ctx.fillStyle = rgba(PAPER, 0.75); ellipse(ctx, x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.28, -0.5); ctx.fill();
  const k = new Path2D(); k.moveTo(x - 5, y + r - 1); k.lineTo(x + 5, y + r - 1); k.lineTo(x, y + r + 8); k.closePath();
  litho(ctx, k, col, { line: 2 });
}
function string(ctx, ax, ay, bx, by, wob = 0) {
  ctx.strokeStyle = NAVY; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + bx) / 2 + wob, (ay + by) / 2, bx, by); ctx.stroke();
}
function clown(ctx, x, b, { reach = 0, laugh = 0, hold = 3 }) {
  // x：两脚中点；脚底在 ROAD_Y。高约 560 单位。
  const y = ROAD_Y;
  const bob = Math.abs(Math.sin(b * Math.PI)) * 6; // 每拍点一下脚
  ctx.save();
  ctx.translate(x, y - bob * 0.3);
  // 大鞋
  for (const [dx, up] of [[-46, 0], [40, bob]]) {
    const s = new Path2D(); s.ellipse(dx + 18, -14 - up, 58, 20, 0, 0, Math.PI * 2);
    litho(ctx, s, RED);
  }
  // 腿（菱格裤）
  const legs = new Path2D(); legs.moveTo(-58, -30); legs.lineTo(-38, -250); legs.lineTo(36, -250); legs.lineTo(56, -30); legs.lineTo(16, -30); legs.lineTo(0, -200); legs.lineTo(-18, -30); legs.closePath();
  ctx.save(); ctx.translate(REG[0], REG[1]); ctx.fillStyle = PAPER; ctx.fill(legs); ctx.clip(legs);
  for (let yy = -260; yy < 0; yy += 44) for (let xx = -80; xx < 80; xx += 44) {
    const d = new Path2D(); d.moveTo(xx, yy); d.lineTo(xx + 22, yy + 22); d.lineTo(xx, yy + 44); d.lineTo(xx - 22, yy + 22); d.closePath();
    ctx.fillStyle = ((xx + yy) / 44) % 2 ? RED : TEAL; ctx.fill(d);
  }
  ctx.restore();
  ctx.strokeStyle = NAVY; ctx.lineWidth = 3; ctx.stroke(legs);
  // 上衣
  const body = new Path2D(); body.moveTo(-62, -250); body.quadraticCurveTo(-74, -340, -50, -400); body.lineTo(50, -400); body.quadraticCurveTo(76, -340, 62, -250); body.closePath();
  litho(ctx, body, TEAL);
  for (const [px, py] of [[0, -360], [0, -320], [0, -280]]) { circle(ctx, px, py, 7); ctx.fillStyle = MUSTARD; ctx.fill(); ctx.strokeStyle = NAVY; ctx.lineWidth = 2; ctx.stroke(); }
  // 右手（画面左侧）伸出递气球：reach 0..1
  const ra = lerp(0.35, -0.95, ease.inOut(reach));
  ctx.save(); ctx.translate(-52, -380); ctx.rotate(ra);
  const arm = new Path2D(); arm.rect(-14, 0, 28, 150);
  litho(ctx, arm, MUSTARD);
  const glove = new Path2D(); glove.ellipse(0, 162, 22, 18, 0, 0, Math.PI * 2); litho(ctx, glove, PAPER);
  ctx.restore();
  // 左手举着一把气球
  ctx.save(); ctx.translate(54, -380); ctx.rotate(-0.35 + Math.sin(b * Math.PI) * 0.04);
  const arm2 = new Path2D(); arm2.rect(-14, -150, 28, 150);
  litho(ctx, arm2, MUSTARD);
  const glove2 = new Path2D(); glove2.ellipse(0, -162, 20, 18, 0, 0, Math.PI * 2); litho(ctx, glove2, PAPER);
  ctx.restore();
  // 大褶领
  for (let k = 0; k < 9; k++) {
    const a = Math.PI + (k / 8) * Math.PI;
    const p = new Path2D(); p.ellipse(Math.cos(a) * 52, -402 + Math.sin(a) * 6 + 6, 22, 14, a, 0, Math.PI * 2);
    litho(ctx, p, PAPER, { line: 2.2 });
  }
  // 头：白脸、红鼻、大笑、橙色发簇、尖帽
  for (const sx of [-1, 1]) { const h = new Path2D(); h.ellipse(sx * 42, -452, 22, 18, sx * 0.4, 0, Math.PI * 2); litho(ctx, h, '#e07a2c', { line: 2 }); }
  const face = new Path2D(); face.ellipse(0, -458, 40, 46, 0, 0, Math.PI * 2);
  litho(ctx, face, PAPER);
  ctx.strokeStyle = NAVY; ctx.lineWidth = 3;
  for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * 15, -472, 10, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); circle(ctx, sx * 15, -466, 4); ctx.fillStyle = NAVY; ctx.fill(); }
  const mouth = new Path2D();
  const open = 6 + laugh * 18;
  mouth.moveTo(-26, -440); mouth.quadraticCurveTo(0, -428 + open, 26, -440); mouth.quadraticCurveTo(0, -432, -26, -440); mouth.closePath();
  litho(ctx, mouth, RED, { line: 2.4 });
  const nose = new Path2D(); nose.ellipse(0, -452, 11, 10, 0, 0, Math.PI * 2); litho(ctx, nose, RED, { line: 2.2 });
  const hat = new Path2D(); hat.moveTo(-34, -494); hat.lineTo(14, -600); hat.lineTo(34, -494); hat.closePath();
  litho(ctx, hat, MUSTARD);
  ctx.save(); ctx.clip(hat); ctx.fillStyle = RED; for (let k = 0; k < 4; k++) ctx.fillRect(-40, -520 - k * 26, 90, 9); ctx.restore();
  litho(ctx, (() => { const p = new Path2D(); p.arc(14, -604, 12, 0, Math.PI * 2); return p; })(), RED, { line: 2.2 });
  ctx.restore();
}

// ---------- 时间点 ----------
const T_REACH = [GAG - 1.5, GAG];        // 第 7.5–9 拍：递出气球
const T_GIVE = GAG;                      // 第 9 拍（第 3 小节强拍）接住
const T_RISE = [GAG + 2.5, GAG + 3.8];   // 第 11.5 拍起被带着飘起
const T_LAND = GAG + 4;                  // 第 13 拍（第 4 小节强拍）落回
const T_LET = GAG + 5.2;                 // 松手

export const s09 = {
  id: 's09',
  station: ST,
  // 深蓝人物站在深蓝观众席前：加一圈米白描边（海报套印的白边），保证反差
  figureRim: { color: CREAM, width: 6, alpha: 1 },
  figureAdjust(b) {
    if (b >= T_RISE[0] && b < T_LAND) {
      const up = b < T_RISE[1] ? ease.out((b - T_RISE[0]) / (T_RISE[1] - T_RISE[0])) : 1 - ease.in((b - T_RISE[1]) / (T_LAND - T_RISE[1]));
      return { pose: 'stand', dy: -150 * up, rotate: Math.sin((b - T_RISE[0]) * 9) * 0.04 * up };
    }
    if (b >= T_LAND && b < T_LAND + 0.12) return { sx: 1.06, dy: 0 }; // 落地一顿
    return null;
  },
  drawBack(ctx, b, env) {
    const cam = env.cam;
    drawStrip(ctx, tentLayer(), cam);
    // 探照灯光柱：从顶上斜下来，缓慢扫动
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const [sx, ph] of [[60, 0], [760, 1.7], [1300, 3.1]]) {
      const ang = Math.sin(b * 0.35 + ph) * 0.35;
      const bx = sx - cam * 0.2, by = 130;
      const ex = bx + Math.sin(ang) * 900, ey = by + Math.cos(ang) * 900;
      const nx = Math.cos(ang) * 190, ny = -Math.sin(ang) * 190;
      const g = ctx.createLinearGradient(bx, by, ex, ey);
      g.addColorStop(0, rgba('#fff6d8', 0.28)); g.addColorStop(1, rgba('#fff6d8', 0));
      ctx.fillStyle = g;
      poly(ctx, [[bx - 14, by], [bx + 14, by], [ex + nx, ey + ny], [ex - nx, ey - ny]]); ctx.fill();
    }
    ctx.restore();
    drawStrip(ctx, standsLayer(), cam);
    drawStrip(ctx, poleLayer(), cam);
    drawStrip(ctx, ringLayer(), cam);
    drawStrip(ctx, floorLayer(), cam);
    // 乔克叔叔：站在定格时画面右侧（画面 x ≈ 690）
    const c5 = env.camAt(T_GIVE);
    const cx = 690 + c5 - cam;
    if (cx > X_MIN - 200 && cx < X_MAX + 200) {
      const reach = smoothstep(T_REACH[0], T_REACH[1], b) * (1 - smoothstep(GAG + 1, GAG + 1.5, b));
      const laugh = smoothstep(T_RISE[0], T_RISE[1], b) * (1 - smoothstep(T_LAND + 0.5, T_LAND + 1, b)) + Math.max(0, Math.sin(b * Math.PI * 2)) * 0.15;
      ctx.fillStyle = rgba(NAVY, 0.25); ellipse(ctx, cx + 4, ROAD_Y + 4, 120, 16); ctx.fill();
      // 手里那一把气球（递出去的那只单独画）
      const holdX = cx + 54 + 150 * Math.sin(0.35), holdY = ROAD_Y - 380 - 150 * Math.cos(0.35);
      const n = b < T_GIVE ? 4 : 3;
      for (let k = 0; k < n; k++) {
        const bx = holdX + (k - 1.5) * 46 + Math.sin(b * 1.4 + k) * 8, by = holdY - 190 - (k % 2) * 46;
        string(ctx, holdX, holdY - 16, bx, by + 40, Math.sin(b + k) * 10);
        balloon(ctx, bx, by, BALLOON_COLS[k + (4 - n)], 36, Math.sin(b + k) * 0.08);
      }
      clown(ctx, cx, b, { reach, laugh });
    }
  },
  drawFront(ctx, b, env) {
    // 递过来、被他接住的那只气球
    if (b < T_REACH[0] || b > T_LET + 2) return;
    const fig = env.figure();
    const c5 = env.camAt(T_GIVE);
    const cx = 690 + c5 - env.cam;
    let hx, hy;
    if (b < T_GIVE) {
      // 还在丑角手里：跟着伸出的手
      const ra = lerp(0.35, -0.95, ease.inOut(smoothstep(T_REACH[0], T_REACH[1], b)));
      hx = cx - 52 - Math.sin(ra) * 162; hy = ROAD_Y - 380 + Math.cos(ra) * 162;
    } else if (b < T_LET) {
      const a = fig.pose === 'stand' ? ANCHORS.stand.handR : ANCHORS.walk.hand;
      hx = fig.x + a[0] * fig.scale; hy = fig.y + a[1] * fig.scale;
    } else {
      // 松手后飘走
      const a = ANCHORS.walk.hand, t = b - T_LET;
      hx = fig.x + a[0] - t * 60; hy = fig.y + a[1] - t * t * 260 - t * 120;
    }
    const lift = b >= T_RISE[0] && b < T_LAND ? 1 : 0;
    // 绳子放长：气球飘在他头顶前上方，不挡脸
    const bx = hx + 34 + Math.sin(b * 1.7) * 14, by = hy - 370 - lift * 30;
    string(ctx, hx, hy, bx, by + 42, Math.sin(b * 2) * 18);
    balloon(ctx, bx, by, MUSTARD, 44 + lift * 4, Math.sin(b * 1.7) * 0.1);
    // 落地时扬起一点木屑
    const dust = smoothstep(T_LAND, T_LAND + 0.05, b) * (1 - smoothstep(T_LAND + 0.1, T_LAND + 0.5, b));
    if (dust > 0) {
      ctx.fillStyle = rgba('#c9a46a', 0.8 * dust);
      for (let k = 0; k < 9; k++) { const t = (b - T_LAND) * 3; circle(ctx, fig.x + (k - 4) * 22 * (1 + t), ROAD_Y - 6 - Math.sin(k) * 10 * t - 8 * t, 5 + k % 3); ctx.fill(); }
    }
  },
  drawFrame(ctx, R) {
    // 海报边框：深蓝宽边、红色内线、四角和边中点的芥末黄星星
    const t = 64 * R.s, { x, y, w, h } = R;
    const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
    ctx.fillStyle = NAVY; ctx.fill(band, 'evenodd');
    ctx.strokeStyle = RED; ctx.lineWidth = Math.max(1, 8 * R.s); ctx.strokeRect(x - t * 0.35, y - t * 0.35, w + t * 0.7, h + t * 0.7);
    ctx.strokeStyle = MUSTARD; ctx.lineWidth = Math.max(1, 3 * R.s); ctx.strokeRect(x - 4, y - 4, w + 8, h + 8);
    for (const [sx, sy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2], [x + w / 2, y - t / 2], [x + w / 2, y + h + t / 2]]) {
      ctx.fillStyle = MUSTARD; ctx.fill(star(sx, sy, t * 0.34));
    }
  },
  cardStyle: {
    ink: PAPER, accent: MUSTARD, bar: false,
    bgDraw(ctx, x, y, w, h) {
      // 海报缎带：红色主体、两端折角燕尾、深蓝描边、星星点缀
      ctx.save();
      const tail = (dir) => {
        const ex = dir < 0 ? x - 34 : x + w + 34, bx2 = dir < 0 ? x + 6 : x + w - 6;
        const p = new Path2D(); p.moveTo(bx2, y + 30); p.lineTo(ex, y + 30); p.lineTo(ex + dir * -18, y + h / 2 + 15); p.lineTo(ex, y + h + 4); p.lineTo(bx2, y + h + 4); p.closePath();
        litho(ctx, p, RED_D, { line: 3 });
      };
      tail(-1); tail(1);
      const main = new Path2D(); main.rect(x, y, w, h);
      litho(ctx, main, RED, { line: 3.5 });
      ctx.strokeStyle = MUSTARD; ctx.lineWidth = 2.5; ctx.strokeRect(x + 10, y + 10, w - 20, h - 20);
      for (const [sx, sy] of [[x + 22, y + 22], [x + w - 22, y + 22], [x + 22, y + h - 22], [x + w - 22, y + h - 22]]) { ctx.fillStyle = MUSTARD; ctx.fill(star(sx, sy, 9)); }
      ctx.restore();
    },
  },
  playerStyle: {
    plate: RED, ink: PAPER, noteColor: MUSTARD,
    palette: { disc: PAPER, shine1: '#ffffff', shine2: MUSTARD, accent: TEAL, hub: MUSTARD, hole: NAVY, ink: NAVY },
    plateDraw(ctx, x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); litho(ctx, p, RED, { line: 3 }); },
  },
};
