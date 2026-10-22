// 第 1 站 · Jay（Jay, 2000）·「可爱女人」· 青春街角 · 漫画网点分镜
// 黑白漫画：白纸、钢笔线、45° 网点纸（平网 + 渐变网点）、集中线、分镜格。整幅画是一页漫画里的一个横幅大格。
// 构图：白纸天空 + 顶部渐变网点、勾线云 → 远处低矮楼群（浅网点）→ 一排两层小店（卷帘门、条纹遮阳篷、空白招牌）
//       → 街面道具：斑马线、凸面镜、报刊亭（亭里看报的大叔）、自动售货机（顶上睡着一只猫）、电线杆与电线、樱花树、单车
//       → 人行道。所有招牌、报纸、杂志、售货机都不写字、不用品牌。
// 梗（第 9–12 拍）：第 9 拍他定格成正面站立帧（=「回头」），同一强拍背景瞬间铺满少女漫画的闪光花朵；第 10 拍硬切复原。
//       之后一本正经的小反应：右上角依次插入小分镜格（女生回头、报刊亭大叔回头），他头侧冒汗滴，售货机上的猫也醒来看他。
// 次要小动作（第 6 拍）：路过售货机时，它自己「咚」地掉出一罐饮料。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked, memo, makeCanvas } from '../kit/canvas.js';
import { rng, hash2 } from '../kit/rng.js';
import { rgba } from '../kit/color.js';
import { circle, ellipse, poly, roundRect } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { GAG, STATION } from '../beat/time.js';
import { stationByN } from '../data/stations.js';
import { ANCHORS } from '../rig/walker.js';
import { SANS } from '../kit/text.js';

const ST = stationByN(1);
const PAPER = '#fbfaf6', INK = '#151515', DARK = '#3a3a3a';

// 时间点（段内拍位）
const T_CAN = GAG - 3;          // 第 6 拍：售货机掉出一罐饮料
const T_FLOWER = [GAG, GAG + 1]; // 第 9 拍：少女漫画背景；第 10 拍复原
const T_PANEL = [GAG + 1, GAG + 2]; // 第 10、11 拍：两个小分镜格依次插入
const T_SWEAT = GAG + 1.5;      // 第 10 拍后半：汗滴
const T_CAT = GAG + 3;          // 第 12 拍：猫醒来看他
const T_OUT = GAG + 4;          // 第 13 拍：小格滑出，继续走

// 街面道具在「定格时」的画面 x（单位）；实际画面 x = gx + camAt(GAG) − cam
const GX = { poleA: -1100, mirror: -620, kiosk: -360, vm: 70, tree: 700, poleB: 1010, bike: 1520, poleC: 3100 };
const BASE = ROAD_Y - 2;

// ---------- 网点与线 ----------
/** 45° 网点纸的一块重复贴图：level = 覆盖率（0..~0.7）。 */
function toneTile(S, level, color) {
  return memo(`s01-tile|${S}|${level.toFixed(3)}|${color}`, () => {
    const c = makeCanvas(S, S);
    const g = c.getContext('2d');
    const r = Math.min(S * 0.36, S * Math.sqrt(level / (2 * Math.PI)));
    g.fillStyle = color;
    g.beginPath();
    for (const [x, y] of [[0, 0], [S, 0], [0, S], [S, S], [S / 2, S / 2]]) { g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU); }
    g.fill();
    return c;
  });
}
const tone = (ctx, level, { S = 8, color = INK } = {}) => ctx.createPattern(toneTile(S, level, color), 'repeat');

/** 渐变网点：f(x, y) 给出每个网点的覆盖率。只在烘焙时用。 */
function toneGrad(ctx, x0, y0, x1, y1, f, { S = 8, color = INK } = {}) {
  ctx.fillStyle = color;
  ctx.beginPath();
  const h = S / 2;
  const ax = Math.floor(x0 / S) * S, ay = Math.floor(y0 / h) * h;
  for (let j = 0, y = ay; y <= y1; j++, y += h) {
    for (let x = ax + (Math.round(y / h) % 2 ? h : 0); x <= x1; x += S) {
      const l = f(x, y);
      if (l <= 0.01) continue;
      const r = Math.min(S * 0.4, S * Math.sqrt(Math.min(1, l) / (2 * Math.PI)));
      ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU);
    }
  }
  ctx.fill();
}
const pen = (ctx, w = 2, c = INK) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; };
function seg(ctx, x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
/** 填白 + 网点 + 描边。 */
function inked(ctx, p, { fill = PAPER, lv = 0, w = 2.2 } = {}) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(p); }
  if (lv > 0) { ctx.fillStyle = tone(ctx, lv); ctx.fill(p); }
  if (w > 0) { pen(ctx, w); ctx.stroke(p); }
}
const rectP = (x, y, w, h) => { const p = new Path2D(); p.rect(x, y, w, h); return p; };

// ---------- 小图形：闪光、花、花瓣、泡泡 ----------
function sparkle(ctx, x, y, r, w = 1.6) {
  const p = new Path2D();
  const q = r * 0.16;
  p.moveTo(x, y - r);
  p.quadraticCurveTo(x + q, y - q, x + r, y);
  p.quadraticCurveTo(x + q, y + q, x, y + r);
  p.quadraticCurveTo(x - q, y + q, x - r, y);
  p.quadraticCurveTo(x - q, y - q, x, y - r);
  ctx.fillStyle = PAPER; ctx.fill(p);
  pen(ctx, w); ctx.stroke(p);
}
function petalPath(s) {
  const p = new Path2D();
  p.moveTo(0, 6 * s);
  p.quadraticCurveTo(-7.5 * s, 0, -4 * s, -6 * s);
  p.lineTo(0, -3.4 * s);
  p.lineTo(4 * s, -6 * s);
  p.quadraticCurveTo(7.5 * s, 0, 0, 6 * s);
  return p;
}
function petal(ctx, x, y, s, rot, w = 1.2) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const p = petalPath(s);
  ctx.fillStyle = PAPER; ctx.fill(p); pen(ctx, w); ctx.stroke(p);
  ctx.restore();
}
function blossom(ctx, x, y, r, rot = 0, w = 1.3) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const p = new Path2D();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const cx = Math.cos(a) * r * 0.55, cy = Math.sin(a) * r * 0.55;
    p.moveTo(cx + r * 0.48, cy); p.arc(cx, cy, r * 0.48, 0, TAU);
  }
  ctx.fillStyle = PAPER; ctx.fill(p); pen(ctx, w); ctx.stroke(p);
  ctx.fillStyle = PAPER; circle(ctx, 0, 0, r * 0.42); ctx.fill();
  ctx.fillStyle = INK; circle(ctx, 0, 0, r * 0.16); ctx.fill();
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU + 0.6; circle(ctx, Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3, r * 0.06 + 0.4); ctx.fill(); }
  ctx.restore();
}
function bubble(ctx, x, y, r) {
  ctx.fillStyle = rgba(PAPER, 0.7); circle(ctx, x, y, r); ctx.fill();
  pen(ctx, 1.5); ctx.stroke();
  pen(ctx, Math.max(1.2, r * 0.12));
  ctx.beginPath(); ctx.arc(x, y, r * 0.68, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.fillStyle = INK; circle(ctx, x + r * 0.42, y + r * 0.4, Math.max(1, r * 0.07)); ctx.fill();
}
function leaf(ctx, x, y, L, a) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(a);
  const p = new Path2D();
  p.moveTo(0, 0); p.quadraticCurveTo(L * 0.5, -L * 0.32, L, 0); p.quadraticCurveTo(L * 0.5, L * 0.32, 0, 0);
  inked(ctx, p, { lv: 0.4, w: 1.6 });
  pen(ctx, 1.1); seg(ctx, L * 0.08, 0, L * 0.9, 0);
  ctx.restore();
}
function rose(ctx, x, y, r, R) {
  ctx.save(); ctx.translate(x, y);
  for (let k = 0; k < 2; k++) { const a = R() * TAU; leaf(ctx, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, r * 0.95, a); }
  ctx.rotate(R() * TAU);
  const n = 5, p = new Path2D();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    if (!i) p.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else { const am = ((i - 0.5) / n) * TAU; p.quadraticCurveTo(Math.cos(am) * r * 1.3, Math.sin(am) * r * 1.3, Math.cos(a) * r, Math.sin(a) * r); }
  }
  ctx.fillStyle = PAPER; ctx.fill(p);
  ctx.save(); ctx.clip(p); ctx.fillStyle = tone(ctx, 0.3); circle(ctx, r * 0.55, r * 0.55, r * 0.95); ctx.fill(); ctx.restore();
  pen(ctx, 2); ctx.stroke(p);
  // 花心：两道杯形弧 + 向内卷的螺旋
  pen(ctx, 1.8);
  ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.62, Math.PI * 0.05, Math.PI * 0.95); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -r * 0.04, r * 0.5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const th = (i / 60) * TAU * 2.2, rr = r * 0.44 * (1 - i / 66);
    const px = Math.cos(th) * rr, py = Math.sin(th) * rr * 0.85;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  pen(ctx, 1.5); ctx.stroke();
  ctx.restore();
}

// ---------- 天空：白纸 + 顶部渐变网点（几乎不动） ----------
function skyLayer() {
  const w = X_MAX - X_MIN;
  return baked('s01-sky', w * K, 330 * K, (ctx) => {
    ctx.scale(K, K); ctx.translate(-X_MIN, 0);
    toneGrad(ctx, X_MIN, 0, X_MAX, 320, (x, y) => 0.3 * Math.pow(Math.max(0, 1 - y / 280), 1.8), { S: 9, color: DARK });
  });
}
function cloudPath(cx, cy, w, h, R) {
  const p = new Path2D();
  const n = 4 + Math.floor(R() * 3);
  p.moveTo(cx - w / 2, cy);
  for (let i = 0; i < n; i++) {
    const a = cx - w / 2 + (i / n) * w, b2 = cx - w / 2 + ((i + 1) / n) * w;
    const bh = h * (0.7 + 0.6 * R()) * (i === 0 || i === n - 1 ? 0.65 : 1);
    p.bezierCurveTo(a - 10, cy - bh, b2 + 10, cy - bh, b2, cy);
  }
  p.closePath();
  return p;
}
function cloudLayer() {
  return strip('s01-cloud', 0.05, (ctx, x0, x1) => {
    const R = rng('s01-cloud');
    for (let x = x0 + 80; x < x1; x += 420 + R() * 380) {
      const y = 150 + R() * 140, w = 180 + R() * 200, h = 34 + R() * 26;
      const p = cloudPath(x, y, w, h, R);
      ctx.fillStyle = PAPER; ctx.fill(p);
      ctx.save(); ctx.clip(p); ctx.fillStyle = tone(ctx, 0.14); ctx.fillRect(x - w, y - h * 0.35, w * 2, h); ctx.restore();
      pen(ctx, 1.8); ctx.stroke(p);
      pen(ctx, 1.1);
      ctx.beginPath(); ctx.arc(x - w * 0.12, y - h * 0.3, h * 0.35, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke();
    }
  }, { y0: 40, y1: 330 });
}

// ---------- 远景：低矮楼群 ----------
function farLayer() {
  return strip('s01-far', 0.22, (ctx, x0, x1) => {
    const R = rng('s01-far');
    for (let x = x0 - 40; x < x1;) {
      const w = 90 + R() * 160, top = 360 + R() * 140;
      const p = rectP(x, top, w, 800 - top);
      inked(ctx, p, { lv: 0.08 + R() * 0.1, w: 1.4 });
      ctx.fillStyle = PAPER;
      for (let wy = top + 16; wy < 560; wy += 28) for (let wx = x + 12; wx < x + w - 18; wx += 24) if (R() > 0.3) ctx.fillRect(wx, wy, 11, 13);
      const r = R();
      if (r < 0.3) { // 屋顶水塔
        const tx = x + 20 + R() * (w - 60);
        inked(ctx, rectP(tx, top - 34, 34, 24), { lv: 0.2, w: 1.3 });
        pen(ctx, 1.2); seg(ctx, tx + 4, top - 10, tx + 4, top); seg(ctx, tx + 30, top - 10, tx + 30, top);
      } else if (r < 0.55) { // 天线
        const ax = x + w * (0.3 + R() * 0.4);
        pen(ctx, 1.2); seg(ctx, ax, top, ax, top - 46); seg(ctx, ax - 14, top - 36, ax + 14, top - 36); seg(ctx, ax - 9, top - 26, ax + 9, top - 26);
      }
      x += w + (R() < 0.3 ? 16 + R() * 40 : 0);
    }
  }, { y0: 300, y1: 800 });
}

// ---------- 中景：一排两层小店 ----------
function midLayer() {
  return strip('s01-mid', 0.55, (ctx, x0, x1) => {
    const R = rng('s01-mid');
    for (let x = x0 - 60; x < x1;) {
      const W = 230 + R() * 140, top = 430 + R() * 60;
      // 墙
      inked(ctx, rectP(x, top, W, 800 - top), { w: 2 });
      inked(ctx, rectP(x - 5, top - 12, W + 10, 12), { lv: 0.32, w: 1.8 });
      // 二楼窗（网点玻璃 + 反光斜线）
      const nw = W > 300 ? 3 : 2, ww = (W - 40 - (nw - 1) * 20) / nw;
      for (let i = 0; i < nw; i++) {
        const wx = x + 20 + i * (ww + 20), wy = top + 22;
        inked(ctx, rectP(wx, wy, ww, 74), { lv: 0.22, w: 1.8 });
        ctx.save(); ctx.beginPath(); ctx.rect(wx, wy, ww, 74); ctx.clip();
        pen(ctx, 5, PAPER); seg(ctx, wx + ww * 0.25, wy + 80, wx + ww * 0.75, wy - 6);
        pen(ctx, 2.4, PAPER); seg(ctx, wx + ww * 0.55, wy + 80, wx + ww * 0.95, wy + 10);
        ctx.restore();
        pen(ctx, 1.2); seg(ctx, wx + ww / 2, wy, wx + ww / 2, wy + 74);
        if (R() < 0.35) { // 空调外机
          const ax = wx + ww - 44;
          inked(ctx, rectP(ax, wy + 82, 44, 26), { w: 1.4 });
          pen(ctx, 1); circle(ctx, ax + 30, wy + 95, 8); ctx.stroke(); seg(ctx, ax + 5, wy + 88, ax + 16, wy + 88); seg(ctx, ax + 5, wy + 94, ax + 16, wy + 94);
        }
      }
      // 空白招牌（不写字）
      const sy = top + 112;
      inked(ctx, rectP(x + 12, sy, W - 24, 46), { w: 2.2 });
      pen(ctx, 1); ctx.strokeRect(x + 19, sy + 7, W - 38, 32);
      if (R() < 0.5) { ctx.fillStyle = tone(ctx, 0.3); ctx.fillRect(x + 19, sy + 7, (W - 38) * 0.18, 32); }
      // 条纹遮阳篷（扇贝边）
      const ay0 = top + 176, ay1 = ay0 + 50;
      const aw = new Path2D();
      aw.moveTo(x + 10, ay0); aw.lineTo(x + W - 10, ay0); aw.lineTo(x + W + 4, ay1);
      const sc = Math.max(4, Math.round((W + 8) / 30)), step = (W + 8) / sc;
      for (let k = 0; k < sc; k++) { const ex = x + W + 4 - k * step; aw.quadraticCurveTo(ex - step / 2, ay1 + 14, ex - step, ay1); }
      aw.closePath();
      ctx.fillStyle = PAPER; ctx.fill(aw);
      ctx.save(); ctx.clip(aw); ctx.fillStyle = tone(ctx, 0.42);
      for (let k = 0; k < sc; k += 2) ctx.fillRect(x - 4 + k * step, ay0, step, 70);
      ctx.restore();
      pen(ctx, 2); ctx.stroke(aw);
      // 店面：卷帘门或玻璃橱窗
      const fy = ay1 + 12;
      if (R() < 0.5) {
        inked(ctx, rectP(x + 16, fy, W - 32, 800 - fy), { lv: 0.06, w: 1.8 });
        pen(ctx, 1);
        for (let y = fy + 8; y < 800; y += 8) seg(ctx, x + 16, y, x + W - 16, y);
        ctx.fillStyle = INK; ctx.fillRect(x + W / 2 - 10, 790, 20, 4);
      } else {
        inked(ctx, rectP(x + 16, fy, W - 32, 800 - fy), { lv: 0.26, w: 1.8 });
        ctx.save(); ctx.beginPath(); ctx.rect(x + 16, fy, W - 32, 800 - fy); ctx.clip();
        pen(ctx, 7, PAPER); seg(ctx, x + 40, 800, x + 100, fy - 4);
        pen(ctx, 3, PAPER); seg(ctx, x + 90, 800, x + 140, fy - 4);
        ctx.restore();
        pen(ctx, 1.6); seg(ctx, x + W * 0.62, fy, x + W * 0.62, 800);
        // 门把
        pen(ctx, 2); seg(ctx, x + W * 0.62 - 8, fy + 50, x + W * 0.62 - 8, fy + 70);
      }
      x += W;
      // 店与店之间：窄巷
      if (R() < 0.35) {
        const gw = 34 + R() * 30;
        const p = rectP(x, top + 30, gw, 770 - top);
        ctx.fillStyle = PAPER; ctx.fill(p);
        ctx.save(); ctx.clip(p); toneGrad(ctx, x, top + 30, x + gw, 800, (xx, yy) => 0.5 - (yy - top) / 900, { S: 7 }); ctx.restore();
        pen(ctx, 1.6); ctx.stroke(p);
        x += gw;
      }
    }
    pen(ctx, 2); seg(ctx, x0, 800, x1, 800);
  }, { y0: 400, y1: 802 });
}

// ---------- 路面：人行道、路沿、马路、斑马线 ----------
const CROSS = [250, 610]; // 斑马线（层内 x）
function groundLayer() {
  return strip('s01-ground', 1, (ctx, x0, x1) => {
    const R = rng('s01-ground');
    ctx.fillStyle = PAPER; ctx.fillRect(x0, 786, x1 - x0, 214);
    ctx.fillStyle = tone(ctx, 0.3); ctx.fillRect(x0, 786, x1 - x0, 14);
    pen(ctx, 2.2); seg(ctx, x0, 800, x1, 800);
    toneGrad(ctx, x0, 803, x1, 834, (x, y) => 0.24 * (1 - (y - 803) / 31), { S: 7 });
    // 方砖缝（越近越宽）
    const rows = [800, 821, 847, 880];
    pen(ctx, 1.2);
    for (let i = 0; i < rows.length; i++) {
      const ya = rows[i], yb = i + 1 < rows.length ? rows[i + 1] : 900;
      if (i) seg(ctx, x0, ya, x1, ya);
      const tw = 60 + (ya - 800) * 1.4;
      for (let x = x0 + (i % 2) * tw * 0.5 - R() * 10; x < x1; x += tw) seg(ctx, x, ya, x + (yb - ya) * 0.12, yb);
    }
    // 路沿
    pen(ctx, 2); seg(ctx, x0, 900, x1, 900);
    ctx.fillStyle = tone(ctx, 0.16); ctx.fillRect(x0, 910, x1 - x0, 13);
    pen(ctx, 1.4); seg(ctx, x0, 910, x1, 910);
    pen(ctx, 2); seg(ctx, x0, 923, x1, 923);
    // 马路（灰网点）
    ctx.fillStyle = tone(ctx, 0.32, { S: 7 }); ctx.fillRect(x0, 924, x1 - x0, 76);
    // 斑马线：横穿马路的白色宽条，越近越粗
    const [c0, c1] = CROSS;
    ctx.fillStyle = PAPER; ctx.fillRect(c0 - 10, 902, c1 - c0 + 20, 21);
    pen(ctx, 1.4); seg(ctx, c0 - 10, 902, c0 - 10, 923); seg(ctx, c1 + 10, 902, c1 + 10, 923);
    for (const [a, b] of [[930, 941], [951, 965], [977, 996]]) {
      const p = rectP(c0, a, c1 - c0, b - a);
      ctx.fillStyle = PAPER; ctx.fill(p); pen(ctx, 1.2); ctx.stroke(p);
    }
    // 小裂缝与石子
    for (let x = x0 + R() * 200; x < x1; x += 160 + R() * 260) {
      const y = 810 + R() * 80;
      pen(ctx, 1); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y + 3); ctx.lineTo(x + 13, y + 1); ctx.lineTo(x + 20, y + 5); ctx.stroke();
    }
  }, { y0: 784, y1: 1000 });
}

// ---------- 街面道具（预烘焙成小图，按定格时的位置摆放） ----------
function sprite(key, w, h, draw) {
  const c = baked(`s01-sp|${key}`, w * K, h * K, (ctx) => { ctx.scale(K, K); ctx.translate(w / 2, h - 24); draw(ctx); });
  return { c, w, h };
}
const drawSprite = (ctx, S, x, y) => ctx.drawImage(S.c, x - S.w / 2, y - (S.h - 24), S.w, S.h);
function groundShadow(ctx, w) { ctx.fillStyle = tone(ctx, 0.4); ellipse(ctx, 0, 4, w, 10); ctx.fill(); }

function kioskSprite() {
  return sprite('kiosk', 520, 560, (ctx) => {
    groundShadow(ctx, 230);
    const W2 = 200;
    inked(ctx, rectP(-W2, -400, 2 * W2, 400), { w: 0 });
    // 下半截柜台
    inked(ctx, rectP(-W2, -175, 2 * W2, 175), { lv: 0.2, w: 2 });
    pen(ctx, 1.2); for (let x = -W2 + 50; x < W2; x += 50) seg(ctx, x, -165, x, -10);
    // 窗口（暗）+ 看报的大叔
    const open = rectP(-130, -380, 260, 186);
    inked(ctx, open, { lv: 0.55, w: 2 });
    // 大叔：报纸挡住脸，只露帽子和两只手
    inked(ctx, (() => { const p = new Path2D(); p.ellipse(-10, -318, 34, 18, 0, Math.PI, 0); p.closePath(); return p; })(), { lv: 0.3, w: 1.8 });
    inked(ctx, (() => { const p = new Path2D(); p.moveTo(-44, -320); p.lineTo(-74, -314); p.lineTo(-44, -308); p.closePath(); return p; })(), { fill: INK, w: 1.2 });
    const paper = new Path2D(); paper.moveTo(-80, -312); paper.lineTo(64, -318); paper.lineTo(70, -200); paper.lineTo(-76, -196); paper.closePath();
    inked(ctx, paper, { w: 1.8 });
    ctx.save(); ctx.clip(paper);
    ctx.fillStyle = tone(ctx, 0.35);
    ctx.fillRect(-70, -300, 56, 34); ctx.fillRect(4, -300, 54, 18); ctx.fillRect(-70, -250, 30, 40);
    pen(ctx, 1); seg(ctx, -4, -312, -2, -196);
    ctx.fillStyle = tone(ctx, 0.12); ctx.fillRect(4, -276, 54, 70); ctx.fillRect(-36, -258, 28, 52);
    ctx.restore();
    for (const hx of [-82, 68]) { ctx.fillStyle = PAPER; ellipse(ctx, hx, -262, 9, 12); ctx.fill(); pen(ctx, 1.4); ctx.stroke(); }
    // 柜台上的报纸堆
    inked(ctx, rectP(-W2 - 12, -196, 2 * W2 + 24, 16), { w: 2 });
    for (const sx of [-170, 80]) {
      for (let k = 0; k < 4; k++) { inked(ctx, rectP(sx + (k % 2) * 3, -212 + k * 0 - k * 4, 86, 6), { w: 1.1 }); }
    }
    // 两侧挂杂志（封面只有网点和色块）
    const R = rng('s01-kiosk');
    for (const px of [-W2 + 6, W2 - 64]) {
      for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 2; c2++) {
        const mx = px + c2 * 30, my = -372 + r2 * 58;
        const p = rectP(mx, my, 26, 48);
        inked(ctx, p, { lv: 0.1 + R() * 0.4, w: 1.2 });
        ctx.fillStyle = PAPER;
        if (R() < 0.5) { circle(ctx, mx + 13, my + 28, 7); ctx.fill(); pen(ctx, 0.9); ctx.stroke(); }
        else { ctx.fillRect(mx + 3, my + 4, 20, 8); }
      }
    }
    pen(ctx, 2.4); ctx.strokeRect(-W2, -400, 2 * W2, 400);
    // 屋顶 + 空白招牌
    inked(ctx, rectP(-W2 - 34, -440, 2 * W2 + 68, 40), { lv: 0.36, w: 2.2 });
    pen(ctx, 3, PAPER); seg(ctx, -W2 - 30, -434, W2 + 30, -434);
    inked(ctx, rectP(-150, -500, 300, 58), { w: 2.4 });
    pen(ctx, 1.1); ctx.strokeRect(-142, -492, 284, 42);
      });
}

const SLOT = { x: -96, y: -98, w: 132, h: 46 };
function vmSprite() {
  return sprite('vm', 320, 520, (ctx) => {
    groundShadow(ctx, 150);
    // 侧面厚度
    inked(ctx, (() => { const p = new Path2D(); p.moveTo(120, -436); p.lineTo(142, -424); p.lineTo(142, 0); p.lineTo(120, 0); p.closePath(); return p; })(), { lv: 0.42, w: 2 });
    const body = new Path2D(); body.roundRect ? body.roundRect(-120, -444, 240, 444, 10) : body.rect(-120, -444, 240, 444);
    inked(ctx, body, { w: 0 });
    ctx.fillStyle = tone(ctx, 0.3); ctx.fillRect(-120, -436, 240, 22);
    // 展示窗：三排饮料（瓶罐剪影，不写字）
    const disp = rectP(-104, -404, 164, 196);
    inked(ctx, disp, { lv: 0.12, w: 2 });
    for (let r2 = 0; r2 < 3; r2++) {
      const yb = -346 + r2 * 64;
      for (let i = 0; i < 5; i++) {
        const cx = -88 + i * 31;
        const p = new Path2D();
        if ((i + r2) % 2) { p.rect(cx - 9, yb - 40, 18, 40); }
        else { p.moveTo(cx - 9, yb); p.lineTo(cx - 9, yb - 28); p.quadraticCurveTo(cx - 9, yb - 36, cx - 4, yb - 40); p.lineTo(cx - 4, yb - 48); p.lineTo(cx + 4, yb - 48); p.lineTo(cx + 4, yb - 40); p.quadraticCurveTo(cx + 9, yb - 36, cx + 9, yb - 28); p.lineTo(cx + 9, yb); p.closePath(); }
        inked(ctx, p, { w: 1.3 });
        ctx.save(); ctx.clip(p); ctx.fillStyle = tone(ctx, [0.5, 0.25, 0.4][(i + r2 * 2) % 3]); ctx.fillRect(cx - 10, yb - 26, 20, 14); ctx.restore();
        inked(ctx, (() => { const q = new Path2D(); q.roundRect ? q.roundRect(cx - 7, yb + 6, 14, 7, 2) : q.rect(cx - 7, yb + 6, 14, 7); return q; })(), { w: 1 });
      }
    }
    // 投币区
    inked(ctx, rectP(70, -404, 38, 196), { w: 1.8 });
    ctx.fillStyle = INK; ctx.fillRect(84, -384, 10, 24);
    inked(ctx, rectP(76, -340, 26, 12), { lv: 0.5, w: 1.2 });
    circle(ctx, 89, -300, 8); inked(ctx, (() => { const p = new Path2D(); p.arc(89, -300, 8, 0, TAU); return p; })(), { w: 1.4 });
    inked(ctx, rectP(78, -262, 22, 36), { lv: 0.3, w: 1.2 });
    // 下方空白广告板：斜条网点
    const ad = rectP(-104, -196, 212, 80);
    inked(ctx, ad, { w: 1.8 });
    ctx.save(); ctx.clip(ad); ctx.fillStyle = tone(ctx, 0.35);
    for (let k = -4; k < 10; k++) { ctx.beginPath(); ctx.moveTo(-104 + k * 34, -116); ctx.lineTo(-104 + k * 34 + 16, -116); ctx.lineTo(-104 + k * 34 + 96, -196); ctx.lineTo(-104 + k * 34 + 80, -196); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // 出货口
    inked(ctx, rectP(SLOT.x, SLOT.y, SLOT.w, SLOT.h), { fill: INK, w: 2 });
    inked(ctx, rectP(SLOT.x, SLOT.y, SLOT.w, 12), { lv: 0.5, w: 1.4 });
    inked(ctx, rectP(-120, -30, 240, 30), { lv: 0.28, w: 1.8 });
    pen(ctx, 2.6); ctx.stroke(body);
  });
}

function poleSprite() {
  return sprite('pole', 240, 900, (ctx) => {
    groundShadow(ctx, 30);
    const p = new Path2D(); p.moveTo(-16, 0); p.lineTo(-10, -860); p.lineTo(10, -860); p.lineTo(16, 0); p.closePath();
    inked(ctx, p, { w: 0 });
    ctx.save(); ctx.clip(p); ctx.fillStyle = tone(ctx, 0.4); ctx.fillRect(1, -870, 20, 880); ctx.restore();
    pen(ctx, 2.2); ctx.stroke(p);
    // 横担 + 绝缘子
    for (const [y, L] of [[-770, 96], [-712, 70]]) {
      inked(ctx, rectP(-L, y, 2 * L, 9), { lv: 0.3, w: 1.8 });
      for (const x of [-L + 8, 0, L - 8]) { if (!x && y > -760) continue; inked(ctx, (() => { const q = new Path2D(); q.roundRect ? q.roundRect(x - 5, y - 13, 10, 13, 3) : q.rect(x - 5, y - 13, 10, 13); return q; })(), { w: 1.3 }); }
    }
    pen(ctx, 1.6); seg(ctx, -60, -761, -14, -730); seg(ctx, 60, -761, 14, -730);
    // 变压器
    const tr = new Path2D(); tr.roundRect ? tr.roundRect(16, -600, 46, 86, 8) : tr.rect(16, -600, 46, 86);
    inked(ctx, tr, { w: 2 });
    ctx.save(); ctx.clip(tr); toneGrad(ctx, 16, -600, 62, -514, (x) => 0.05 + (x - 16) / 46 * 0.45, { S: 6 }); ctx.restore();
    pen(ctx, 2); ctx.stroke(tr);
    pen(ctx, 1.4); seg(ctx, 16, -580, 12, -580); seg(ctx, 16, -530, 12, -530); seg(ctx, 30, -600, 30, -640); seg(ctx, 48, -600, 48, -650);
    // 脚钉
    pen(ctx, 2.2);
    for (let y = -170, s = 1; y > -680; y -= 46, s = -s) seg(ctx, s * 12, y, s * 26, y);
    // 空白小铭牌
    inked(ctx, rectP(-12, -330, 24, 40), { w: 1.4 });
  });
}
const WIRE = [[-88, -770], [0, -770], [88, -770], [-62, -712], [62, -712]];

function treeSprite() {
  return sprite('tree', 700, 800, (ctx) => {
    groundShadow(ctx, 90);
    const R = rng('s01-tree');
    // 树干与枝
    const trunk = new Path2D();
    trunk.moveTo(-30, 0); trunk.bezierCurveTo(-24, -120, -34, -220, -14, -330); trunk.lineTo(10, -330); trunk.bezierCurveTo(4, -220, 16, -110, 28, 0); trunk.closePath();
    inked(ctx, trunk, { lv: 0.5, w: 2.4 });
    pen(ctx, 1.2, PAPER);
    for (let y = -40; y > -310; y -= 34) seg(ctx, -14 + R() * 6, y, 2 + R() * 8, y - 6);
    const blobs = [[-230, -360, 105], [-120, -470, 150], [60, -540, 165], [210, -430, 140], [-30, -360, 120], [130, -330, 95], [-60, -650, 120], [160, -680, 105], [-230, -560, 100]];
    pen(ctx, 9); ctx.strokeStyle = INK;
    for (const [bx, by] of blobs) { ctx.lineWidth = 6 + R() * 6; ctx.beginPath(); ctx.moveTo(-2, -320); ctx.quadraticCurveTo((bx - 2) * 0.4, -340 + (by + 320) * 0.3, bx * 0.8, by * 0.95); ctx.stroke(); }
    // 花团：扇贝边的云团，下侧铺渐变网点
    for (const [bx, by, r] of blobs) {
      const p = new Path2D(); const n = 11;
      const pt = (a, rr) => [bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.82];
      p.moveTo(...pt(0, r));
      for (let i = 1; i <= n; i++) { const a = (i / n) * TAU, am = ((i - 0.5) / n) * TAU; p.quadraticCurveTo(...pt(am, r * (1.16 + 0.06 * Math.sin(i * 3.1 + bx))), ...pt(a, r)); }
      p.closePath();
      ctx.fillStyle = PAPER; ctx.fill(p);
      ctx.save(); ctx.clip(p); toneGrad(ctx, bx - r * 1.3, by - r, bx + r * 1.3, by + r * 1.2, (x, y) => 0.3 * smoothstep(by + r * 0.05, by + r * 0.95, y), { S: 7 }); ctx.restore();
      pen(ctx, 2); ctx.stroke(p);
    }
    for (let k = 0; k < 70; k++) {
      const [bx, by, r] = blobs[k % blobs.length];
      const a = R() * TAU, rr = Math.sqrt(R()) * r * 0.85;
      blossom(ctx, bx + Math.cos(a) * rr, by + Math.sin(a) * rr * 0.8, 6 + R() * 5, R() * TAU, 1.1);
    }
  });
}

function bikeSprite() {
  return sprite('bike', 360, 260, (ctx) => {
    groundShadow(ctx, 130);
    const wheel = (x) => {
      pen(ctx, 5); circle(ctx, x, -62, 60); ctx.stroke();
      pen(ctx, 1.2); circle(ctx, x, -62, 52); ctx.stroke();
      pen(ctx, 0.9); for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; seg(ctx, x, -62, x + Math.cos(a) * 52, -62 + Math.sin(a) * 52); }
      ctx.fillStyle = INK; circle(ctx, x, -62, 5); ctx.fill();
      pen(ctx, 2.4); ctx.beginPath(); ctx.arc(x, -62, 68, Math.PI * 1.08, Math.PI * 1.9); ctx.stroke();
    };
    wheel(-100); wheel(100);
    pen(ctx, 5);
    ctx.beginPath(); ctx.moveTo(-100, -62); ctx.lineTo(-6, -62); ctx.lineTo(-40, -170); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-6, -62); ctx.quadraticCurveTo(30, -70, 74, -176); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-100, -62); ctx.lineTo(-40, -160); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(100, -62); ctx.lineTo(80, -190); ctx.stroke();
    // 车把、车座、车筐
    pen(ctx, 4); ctx.beginPath(); ctx.moveTo(80, -190); ctx.quadraticCurveTo(70, -214, 48, -206); ctx.stroke();
    inked(ctx, (() => { const p = new Path2D(); p.ellipse(-44, -178, 26, 8, -0.08, 0, TAU); return p; })(), { fill: INK, w: 1 });
    const bk = new Path2D(); bk.moveTo(92, -206); bk.lineTo(160, -206); bk.lineTo(152, -150); bk.lineTo(98, -150); bk.closePath();
    inked(ctx, bk, { lv: 0.08, w: 2 });
    pen(ctx, 1); for (let x = 102; x < 158; x += 10) seg(ctx, x, -206, x - 2, -150); seg(ctx, 94, -178, 156, -178);
    ctx.fillStyle = INK; circle(ctx, -6, -62, 11); ctx.fill();
    pen(ctx, 3); seg(ctx, -6, -62, 12, -40); seg(ctx, -6, -62, -24, -84);
    pen(ctx, 2.4); seg(ctx, -20, -60, -34, 0);
  });
}

function mirrorSprite() {
  return sprite('mirror', 200, 640, (ctx) => {
    groundShadow(ctx, 22);
    inked(ctx, rectP(-5, -500, 10, 500), { lv: 0.3, w: 1.6 });
    pen(ctx, 2); seg(ctx, -5, -505, 0, -520);
    const m = new Path2D(); m.ellipse(0, -548, 54, 58, 0, 0, TAU);
    ctx.fillStyle = PAPER; ctx.fill(m);
    ctx.save(); ctx.clip(m); toneGrad(ctx, -60, -610, 60, -490, (x, y) => 0.08 + Math.max(0, (x + y + 548) / 120) * 0.35, { S: 6 });
    pen(ctx, 6, PAPER); seg(ctx, -34, -540, -6, -588); pen(ctx, 3, PAPER); seg(ctx, -24, -520, 6, -572);
    ctx.restore();
    pen(ctx, 8); ctx.stroke(m);
    pen(ctx, 2, PAPER); ctx.beginPath(); ctx.ellipse(0, -548, 54, 58, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
    inked(ctx, (() => { const p = new Path2D(); p.ellipse(0, -604, 46, 14, 0, Math.PI, 0); p.closePath(); return p; })(), { lv: 0.4, w: 1.8 });
  });
}

// 售货机顶上的猫：睡着（团成一团）/ 醒来回头看他
function cat(ctx, x, y, awake) {
  ctx.save(); ctx.translate(x, y);
  const body = new Path2D(); body.ellipse(4, -22, 48, 23, 0, 0, TAU);
  inked(ctx, body, { w: 2 });
  ctx.save(); ctx.clip(body); ctx.fillStyle = tone(ctx, 0.45);
  for (const sx of [-6, 14, 34]) { ctx.beginPath(); ctx.moveTo(sx, -46); ctx.lineTo(sx + 10, -46); ctx.lineTo(sx + 4, -26); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const tail = new Path2D(); tail.moveTo(46, -14); tail.quadraticCurveTo(66, 0, 40, 2); tail.quadraticCurveTo(10, 4, -20, 0);
  pen(ctx, 7); ctx.stroke(tail); pen(ctx, 4, PAPER); ctx.stroke(tail);
  const hx = -40, hy = awake ? -46 : -24;
  const head = new Path2D(); head.ellipse(hx, hy, 22, 19, 0, 0, TAU);
  const ears = new Path2D();
  ears.moveTo(hx - 20, hy - 8); ears.lineTo(hx - 18, hy - (awake ? 30 : 24)); ears.lineTo(hx - 6, hy - 16); ears.closePath();
  ears.moveTo(hx + 4, hy - 17); ears.lineTo(hx + 14, hy - (awake ? 32 : 26)); ears.lineTo(hx + 20, hy - 8); ears.closePath();
  inked(ctx, ears, { lv: 0.4, w: 2 });
  inked(ctx, head, { w: 2 });
  pen(ctx, 1.6);
  if (awake) {
    // 圆眼直勾勾看着他（往右）
    for (const ex of [-10, 6]) { ctx.fillStyle = PAPER; circle(ctx, hx + ex, hy - 2, 5.5); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; circle(ctx, hx + ex + 2.2, hy - 2, 2.6); ctx.fill(); }
    seg(ctx, hx - 2, hy + 7, hx + 2, hy + 7);
    pen(ctx, 1); seg(ctx, hx + 16, hy + 4, hx + 32, hy + 1); seg(ctx, hx + 16, hy + 8, hx + 32, hy + 9); seg(ctx, hx - 18, hy + 4, hx - 32, hy + 1);
  } else {
    for (const ex of [-10, 6]) { ctx.beginPath(); ctx.arc(hx + ex, hy - 1, 4.5, 0.2, Math.PI - 0.2); ctx.stroke(); }
    pen(ctx, 1); seg(ctx, hx - 18, hy + 5, hx - 32, hy + 3);
  }
  ctx.restore();
}

// ---------- 少女漫画背景（第 9 拍，一整张预烘焙） ----------
const HALO = [CHAR_X, 480];
function shoujoLayer() {
  const w = X_MAX - X_MIN;
  return baked('s01-shoujo', w * K, 1000 * K, (ctx) => {
    ctx.scale(K, K); ctx.translate(-X_MIN, 0);
    const R = rng('s01-shoujo');
    ctx.fillStyle = PAPER; ctx.fillRect(X_MIN, 0, w, 1000);
    const dn = (x, y) => Math.hypot((x - HALO[0]) / 1000, (y - HALO[1]) / 660);
    toneGrad(ctx, X_MIN, 0, X_MAX, 1000, (x, y) => 0.6 * smoothstep(0.4, 1.12, dn(x, y)), { S: 8, color: DARK });
    // 白色放射闪线（刮网点）
    ctx.fillStyle = PAPER;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU + R() * 0.04, r0 = 300 + R() * 260, r1 = 1600, hw = 0.003 + R() * 0.009;
      poly(ctx, [[HALO[0] + Math.cos(a) * r0, HALO[1] + Math.sin(a) * r0], [HALO[0] + Math.cos(a - hw) * r1, HALO[1] + Math.sin(a - hw) * r1], [HALO[0] + Math.cos(a + hw) * r1, HALO[1] + Math.sin(a + hw) * r1]]);
      ctx.fill();
    }
    // 不遮人物，也不压在标题卡下面
    const free = (x, y, r) => !(x > 170 - r && x < 470 + r && y > 250 - r && y < 830 + r) && !(x < -20 + r && y < 250 + r);
    const roses = [[-300, 400, 66], [-190, 560, 54], [-330, 730, 82], [-170, 880, 66], [-10, 970, 62], [90, 760, 44], [560, 960, 58], [720, 870, 76], [900, 960, 62],
      [1080, 890, 56], [1260, 960, 70], [1320, 760, 78], [1170, 650, 56], [1330, 560, 58], [1240, 400, 70], [1340, 220, 62], [1180, 110, 72], [990, 70, 54], [800, 60, 58],
      [630, 120, 48], [-110, 320, 44], [580, 300, 40], [700, 640, 46], [-300, 990, 50]];
    for (const [x, y, r] of roses) rose(ctx, x, y, r, R);
    for (let k = 0; k < 400 && k >= 0; k++) {
      const x = X_MIN + R() * w, y = R() * 1000, r = 9 + R() * 14;
      if (!free(x, y, r)) continue;
      const t = R();
      if (t < 0.32) blossom(ctx, x, y, r, R() * TAU);
      else if (t < 0.6) bubble(ctx, x, y, r * (0.5 + R() * 1.6));
      else if (t < 0.88) petal(ctx, x, y, 1.4 + R() * 1.4, R() * TAU);
      else sparkle(ctx, x, y, r * 1.4, 1.3);
    }
  });
}
// 动态闪光：十几颗四角星一闪一闪
const TWINKLES = Array.from({ length: 16 }, (_, i) => {
  const a = hash2(i, 1, 101) * TAU, d = 0.55 + hash2(i, 2, 101) * 0.45;
  return [HALO[0] + Math.cos(a) * d * 900, HALO[1] + Math.sin(a) * d * 520, 16 + hash2(i, 3, 101) * 22, hash2(i, 4, 101)];
}).filter(([x, y]) => !(x > 150 && x < 490 && y > 230 && y < 840) && !(x < 0 && y < 260));
function drawShoujo(ctx, b) {
  const t = b - T_FLOWER[0];
  const pop = 1.07 - 0.07 * ease.out(clamp(t / 0.14));
  ctx.save();
  ctx.translate(HALO[0], HALO[1]); ctx.scale(pop, pop); ctx.translate(-HALO[0], -HALO[1]);
  ctx.drawImage(shoujoLayer(), X_MIN, 0, X_MAX - X_MIN, 1000);
  ctx.restore();
  for (const [x, y, r, ph] of TWINKLES) {
    const k = 0.45 + 0.55 * Math.abs(Math.sin(TAU * (t * 1.5 + ph)));
    sparkle(ctx, x, y, r * k, 1.8);
    pen(ctx, 1.2); seg(ctx, x - r * 1.5 * k, y, x - r * 1.05 * k, y); seg(ctx, x + r * 1.05 * k, y, x + r * 1.5 * k, y);
  }
  // 他身边一圈细小的闪光（不压在身上）
  for (let i = 0; i < 6; i++) {
    const a = -1.9 + i * 0.32, rr = 230 + (i % 2) * 40;
    const k = 0.5 + 0.5 * Math.abs(Math.sin(TAU * (t * 2 + i * 0.17)));
    sparkle(ctx, CHAR_X + Math.cos(a) * rr * 0.9, 520 + Math.sin(a) * rr, (8 + (i % 3) * 4) * k, 1.4);
  }
}

// ---------- 樱花瓣（一直在飘，按拍位算） ----------
function drawPetals(ctx, b, treeX) {
  for (let i = 0; i < 22; i++) {
    const P = 3.2 + hash2(i, 1, 7) * 2.4;
    const t = ((b + hash2(i, 2, 7) * P) / P) % 1;
    const tt = t < 0 ? t + 1 : t;
    const x0 = treeX + (hash2(i, 3, 7) - 0.5) * 560, y0 = BASE - 660 + hash2(i, 4, 7) * 260;
    const x = x0 - tt * (180 + hash2(i, 5, 7) * 160) + Math.sin(tt * TAU * 1.3 + i) * 26;
    const y = lerp(y0, BASE + 60 + hash2(i, 6, 7) * 120, tt);
    if (x < X_MIN - 20 || x > X_MAX + 20) continue;
    petal(ctx, x, y, 1.3 + hash2(i, 7, 7) * 0.6, tt * 9 + i);
  }
}

// ---------- 小分镜格（第 10–12 拍，右上角） ----------
const PANELS = [
  { t: T_PANEL[0], q: [[808, 58], [1092, 58], [1070, 322], [808, 322]], draw: drawGirl },
  { t: T_PANEL[1], q: [[1106, 58], [1366, 58], [1366, 322], [1084, 322]], draw: drawUncle },
];
function drawPanel(ctx, P, b) {
  if (b < P.t || b >= T_OUT + 0.4) return;
  const pin = ease.out(clamp((b - P.t) / 0.12));
  const out = ease.in(clamp((b - T_OUT) / 0.35));
  const cx = (P.q[0][0] + P.q[1][0]) / 2, cy = (P.q[0][1] + P.q[2][1]) / 2;
  const path = new Path2D(); P.q.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
  ctx.save();
  ctx.translate(out * 700, 0);
  ctx.translate(cx, cy); ctx.scale(1.14 - 0.14 * pin, 1.14 - 0.14 * pin); ctx.translate(-cx, -cy);
  ctx.globalAlpha *= clamp(pin * 3);
  pen(ctx, 16, PAPER); ctx.stroke(path);
  ctx.fillStyle = PAPER; ctx.fill(path);
  ctx.save(); ctx.clip(path); P.draw(ctx, b - P.t); ctx.restore();
  pen(ctx, 4.5); ctx.stroke(path);
  ctx.restore();
}
function speedLinesH(ctx, x0, y0, x1, y1, seed) {
  pen(ctx, 1.4);
  for (let i = 0; i < 26; i++) {
    const y = y0 + (y1 - y0) * hash2(i, 1, seed), L = (x1 - x0) * (0.3 + 0.6 * hash2(i, 2, seed));
    const xs = x1 - L * hash2(i, 3, seed) * 0.4;
    ctx.lineWidth = 0.8 + hash2(i, 4, seed) * 1.6; seg(ctx, xs - L, y, xs, y);
  }
}
function drawGirl(ctx, t) {
  // 原创：扎马尾、水手领的女生，回过头来直直看他（面无表情）
  ctx.fillStyle = tone(ctx, 0.12); ctx.fillRect(800, 50, 300, 280);
  ctx.fillStyle = PAPER; ctx.fillRect(800, 50, 300, 120);
  speedLinesH(ctx, 800, 60, 1100, 190, 21);
  const turn = ease.out(clamp(t / 0.2));
  const hx = 958 - 6 * turn, hy = 178;
  // 肩背 + 水手领（从背后看）
  const back = new Path2D(); back.moveTo(842, 330); back.quadraticCurveTo(850, 252, 930, 240); back.lineTo(1000, 240); back.quadraticCurveTo(1066, 252, 1078, 330); back.closePath();
  inked(ctx, back, { w: 2.2 });
  const collar = new Path2D(); collar.moveTo(904, 244); collar.lineTo(1022, 244); collar.lineTo(1034, 306); collar.lineTo(894, 306); collar.closePath();
  inked(ctx, collar, { fill: INK, w: 2 });
  pen(ctx, 3, PAPER); seg(ctx, 902, 292, 1026, 292); seg(ctx, 900, 282, 1028, 282);
  // 马尾（甩动）+ 甩动弧线
  const tail = new Path2D(); tail.moveTo(1000, 150); tail.bezierCurveTo(1050 + 20 * turn, 150, 1070 + 14 * turn, 210, 1046 + 26 * turn, 262); tail.bezierCurveTo(1040, 214, 1022, 186, 992, 182); tail.closePath();
  inked(ctx, tail, { fill: INK, w: 2 });
  pen(ctx, 1.8, PAPER); ctx.beginPath(); ctx.moveTo(1018, 166); ctx.quadraticCurveTo(1046, 182, 1048, 220); ctx.stroke();
  pen(ctx, 1.4);
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(1004, 196, 66 + k * 12, -0.5, 0.55); ctx.stroke(); }
  // 头：后脑头发 + 转过来的半张脸
  const hair = new Path2D(); hair.ellipse(hx + 6, hy - 6, 56, 60, 0, 0, TAU);
  inked(ctx, hair, { fill: INK, w: 2 });
  const face = new Path2D(); face.moveTo(hx - 44, hy - 16); face.quadraticCurveTo(hx - 50, hy + 30, hx - 22, hy + 52); face.quadraticCurveTo(hx + 4, hy + 60, hx + 18, hy + 34); face.quadraticCurveTo(hx + 10, hy - 10, hx - 44, hy - 16); face.closePath();
  inked(ctx, face, { w: 2 });
  // 刘海
  ctx.fillStyle = INK;
  poly(ctx, [[hx - 50, hy - 24], [hx - 40, hy + 4], [hx - 30, hy - 14], [hx - 20, hy + 2], [hx - 8, hy - 14], [hx + 4, hy + 4], [hx + 14, hy - 20], [hx - 6, hy - 46]]); ctx.fill();
  // 发上的光环
  pen(ctx, 2.4, PAPER); ctx.beginPath(); ctx.ellipse(hx + 8, hy - 24, 40, 18, -0.15, Math.PI * 1.05, Math.PI * 1.9); ctx.stroke();
  // 发圈
  ctx.fillStyle = PAPER; circle(ctx, 1000, 160, 7); ctx.fill(); pen(ctx, 1.6); ctx.stroke();
  // 眼：两颗圆点，直直看着他
  ctx.fillStyle = INK;
  ellipse(ctx, hx - 30, hy + 14, 4.5, 6.5); ctx.fill();
  ellipse(ctx, hx - 6, hy + 14, 4.5, 6.5); ctx.fill();
  pen(ctx, 1.6); seg(ctx, hx - 36, hy + 2, hx - 24, hy + 1); seg(ctx, hx - 12, hy + 1, hx, hy + 2);
  seg(ctx, hx - 20, hy + 38, hx - 12, hy + 38);
}
function drawUncle(ctx, t) {
  // 报刊亭大叔：从（没有字的）报纸后面回过头，镜片反光
  ctx.fillStyle = tone(ctx, 0.2); ctx.fillRect(1080, 50, 300, 280);
  pen(ctx, 1);
  for (let i = 0; i < 18; i++) { const x = 1090 + i * 16; seg(ctx, x, 50, x + 30, 330); }
  const turn = ease.out(clamp(t / 0.2));
  const hx = 1218 - 10 * turn, hy = 168;
  // 头
  const head = new Path2D(); head.ellipse(hx, hy, 50, 56, 0, 0, TAU);
  inked(ctx, head, { w: 2.2 });
  // 帽子
  const crown = new Path2D(); crown.ellipse(hx + 4, hy - 34, 56, 34, 0, Math.PI, 0); crown.closePath();
  inked(ctx, crown, { lv: 0.35, w: 2.2 });
  const bill = new Path2D(); bill.moveTo(hx - 50, hy - 36); bill.quadraticCurveTo(hx - 92, hy - 30, hx - 96, hy - 22); bill.lineTo(hx - 46, hy - 26); bill.closePath();
  inked(ctx, bill, { fill: INK, w: 1.6 });
  // 眼镜：两片反光的镜片
  for (const ex of [-26, 8]) {
    const g = new Path2D(); g.ellipse(hx + ex, hy - 4, 16, 12, 0, 0, TAU);
    inked(ctx, g, { lv: 0.18, w: 2.4 });
    pen(ctx, 3, PAPER); seg(ctx, hx + ex - 8, hy + 4, hx + ex + 4, hy - 12);
  }
  pen(ctx, 2); seg(ctx, hx - 10, hy - 5, hx - 8, hy - 5);
  // 胡子
  ctx.fillStyle = INK; ellipse(ctx, hx - 12, hy + 26, 20, 7); ctx.fill();
  // 报纸（没有字：网点块 + 栏线）
  const np = new Path2D(); np.moveTo(1094, 232); np.lineTo(1360, 222); np.lineTo(1372, 334); np.lineTo(1088, 334); np.closePath();
  inked(ctx, np, { w: 2.2 });
  ctx.save(); ctx.clip(np);
  ctx.fillStyle = tone(ctx, 0.4); ctx.fillRect(1108, 244, 70, 40); ctx.fillRect(1250, 240, 90, 22);
  ctx.fillStyle = tone(ctx, 0.15); ctx.fillRect(1190, 246, 48, 80); ctx.fillRect(1108, 292, 70, 40); ctx.fillRect(1250, 270, 90, 60);
  pen(ctx, 1); seg(ctx, 1184, 236, 1186, 334); seg(ctx, 1244, 232, 1246, 334);
  ctx.restore();
  for (const hx2 of [1100, 1350]) { ctx.fillStyle = PAPER; ellipse(ctx, hx2, 250, 12, 16); ctx.fill(); pen(ctx, 1.8); ctx.stroke(); }
}

// ---------- 他头上的汗滴 ----------
function sweat(ctx, fig, b) {
  if (b < T_SWEAT || b >= T_OUT) return;
  const k = ease.outBack(clamp((b - T_SWEAT) / 0.18));
  const slide = (b - T_SWEAT) * 9;
  const a = ANCHORS.stand.headTop;
  const x = fig.x + (a[0] + 66) * fig.scale, y = fig.y + (a[1] + 44) * fig.scale + slide;
  ctx.save(); ctx.translate(x, y); ctx.scale(k * 1.35, k * 1.35);
  const p = new Path2D(); p.moveTo(0, -24); p.bezierCurveTo(6, -8, 15, 2, 15, 12); p.arc(0, 12, 15, 0, Math.PI); p.bezierCurveTo(-15, 2, -6, -8, 0, -24); p.closePath();
  ctx.fillStyle = PAPER; ctx.fill(p); pen(ctx, 3); ctx.stroke(p);
  pen(ctx, 2.2); ctx.beginPath(); ctx.arc(0, 12, 9, Math.PI * 0.15, Math.PI * 0.55); ctx.stroke();
  ctx.restore();
}

// ---------- 第 1 拍的集中线 ----------
function focusLines(ctx, b) {
  const k = 1 - smoothstep(0.05, 0.6, b);
  if (b < 0 || k <= 0) return;
  ctx.save();
  ctx.fillStyle = rgba(INK, 0.9 * k);
  const C = [CHAR_X + 30, 520];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU + hash2(i, 1, 33) * 0.05;
    const r0 = 560 + hash2(i, 2, 33) * 260 + (1 - k) * 160, r1 = 1700, hw = 0.002 + hash2(i, 3, 33) * 0.007;
    poly(ctx, [[C[0] + Math.cos(a) * r0, C[1] + Math.sin(a) * r0], [C[0] + Math.cos(a - hw) * r1, C[1] + Math.sin(a - hw) * r1], [C[0] + Math.cos(a + hw) * r1, C[1] + Math.sin(a + hw) * r1]]);
    ctx.fill();
  }
  ctx.restore();
}

// ---------- 整幅画的分镜框（白页边 + 黑框线） ----------
const M = 12;
function pageBorder(ctx) {
  const p = new Path2D();
  p.rect(X_MIN - 10, -10, X_MAX - X_MIN + 20, 1020);
  p.rect(X_MIN + M, M, X_MAX - X_MIN - 2 * M, 1000 - 2 * M);
  ctx.fillStyle = PAPER; ctx.fill(p, 'evenodd');
  pen(ctx, 3.5); ctx.strokeRect(X_MIN + M, M, X_MAX - X_MIN - 2 * M, 1000 - 2 * M);
}

// ---------- 场景 ----------
export const s01 = {
  id: 's01',
  station: ST,
  // 漫画里人物压在网点上时的「白边」：保证经过灰网点马路、售货机、树干时也拉得开
  figureRim: { color: PAPER, width: 6, alpha: 1 },
  freezeBeat: GAG + 0.5, // Outro 展墙定格在少女漫画闪光那一拍
  drawBack(ctx, b, env) {
    if (b >= T_FLOWER[0] && b < T_FLOWER[1]) { drawShoujo(ctx, b); return; }
    const cam = env.cam, cg = env.camAt(GAG);
    const X = (gx) => gx + cg - cam;
    ctx.fillStyle = PAPER; ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, 1000);
    ctx.drawImage(skyLayer(), X_MIN, 0, X_MAX - X_MIN, 330);
    drawStrip(ctx, cloudLayer(), cam);
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, midLayer(), cam);
    drawStrip(ctx, groundLayer(), cam);
    const vis = (x, w) => x > X_MIN - w && x < X_MAX + w;
    // 凸面镜、报刊亭
    if (vis(X(GX.mirror), 120)) drawSprite(ctx, mirrorSprite(), X(GX.mirror), BASE);
    if (vis(X(GX.kiosk), 280)) drawSprite(ctx, kioskSprite(), X(GX.kiosk), BASE);
    // 售货机：第 6 拍自己掉出一罐饮料（机身一抖、出货口冲击线）
    const vx = X(GX.vm);
    if (vis(vx, 200)) {
      const sh = b >= T_CAN && b < T_CAN + 0.3 ? Math.sin((b - T_CAN) * 60) * 3 * (1 - (b - T_CAN) / 0.3) : 0;
      drawSprite(ctx, vmSprite(), vx + sh, BASE);
      if (b >= T_CAN) {
        const cx = vx + sh + SLOT.x + 40, cy = BASE + SLOT.y + SLOT.h - 12;
        const drop = ease.in(clamp((b - T_CAN) / 0.08));
        const can = new Path2D(); can.roundRect ? can.roundRect(cx - 26, cy - 11 - (1 - drop) * 20, 52, 22, 6) : can.rect(cx - 26, cy - 11, 52, 22);
        inked(ctx, can, { w: 1.6 });
        ctx.save(); ctx.clip(can); ctx.fillStyle = tone(ctx, 0.45); ctx.fillRect(cx - 8, cy - 40, 16, 60); ctx.restore();
        const k = 1 - smoothstep(T_CAN + 0.25, T_CAN + 0.7, b);
        if (k > 0) {
          ctx.save(); ctx.globalAlpha *= k;
          pen(ctx, 2.4);
          const sx0 = vx + sh + SLOT.x, sy0 = BASE + SLOT.y;
          for (const [ax, ay, dx, dy] of [[-6, 10, -26, -8], [-6, 26, -30, 4], [-2, 44, -24, 18], [SLOT.w + 6, 10, 26, -8], [SLOT.w + 6, 26, 30, 4], [SLOT.w + 2, 44, 24, 18]]) {
            seg(ctx, sx0 + ax, sy0 + ay, sx0 + ax + dx, sy0 + ay + dy);
          }
          ctx.restore();
        }
      }
      cat(ctx, vx + sh - 34, BASE - 444, b >= T_CAT && b < T_OUT + 1.5);
    }
    if (vis(X(GX.tree), 360)) drawSprite(ctx, treeSprite(), X(GX.tree), BASE);
    if (vis(X(GX.bike), 200)) drawSprite(ctx, bikeSprite(), X(GX.bike), BASE + 6);
    // 电线杆与电线
    const poles = [GX.poleA, GX.poleB, GX.poleC].map(X);
    for (let i = 0; i + 1 < poles.length; i++) {
      const a = poles[i], c = poles[i + 1];
      if (c < X_MIN - 200 || a > X_MAX + 200) continue;
      WIRE.forEach(([dx, dy], k) => {
        pen(ctx, k < 3 ? 1.8 : 1.3);
        const y = BASE + dy - 10, sag = 70 + k * 12;
        ctx.beginPath(); ctx.moveTo(a + dx, y); ctx.quadraticCurveTo((a + c) / 2 + dx, y + sag * 2, c + dx, y); ctx.stroke();
      });
    }
    for (const x of poles) if (vis(x, 150)) drawSprite(ctx, poleSprite(), x, BASE);
    drawPetals(ctx, b, X(GX.tree));
  },
  drawFront(ctx, b, env) {
    focusLines(ctx, b);
    // 第 10 拍复原后只剩一片花瓣慢慢飘过他眼前
    if (b >= T_FLOWER[1] && b < T_FLOWER[1] + 2.6) {
      const t = (b - T_FLOWER[1]) / 2.6;
      petal(ctx, lerp(CHAR_X + 170, CHAR_X - 150, t) + Math.sin(t * TAU * 1.2) * 34, lerp(240, 700, t), 2.6, t * 7, 1.6);
    }
    sweat(ctx, env.figure(), b);
    for (const P of PANELS) drawPanel(ctx, P, b);
    pageBorder(ctx);
  },
  drawFrame(ctx, R) {
    // 漫画分镜框：白色格间距宽带、内外两道黑线、右下错位网点阴影；右侧拖着几道速度线（画框从右边滑进来）
    const t = 64 * R.s, { x, y, w, h } = R, s = R.s;
    ctx.save();
    pen(ctx, 1);
    for (let i = 0; i < 18; i++) {
      const yy = y - t + (h + 2 * t) * hash2(i, 1, 11), L = (90 + 260 * hash2(i, 2, 11)) * s, x0 = x + w + t + (20 + 40 * hash2(i, 3, 11)) * s;
      ctx.lineWidth = Math.max(1, (1.5 + 3.5 * hash2(i, 4, 11)) * s);
      seg(ctx, x0, yy, x0 + L, yy);
    }
    const o = 16 * s, S = Math.max(4, Math.round(9 * s));
    const sh = new Path2D(); sh.rect(x - t + o, y - t + o, w + 2 * t, h + 2 * t); sh.rect(x - t, y - t, w + 2 * t, h + 2 * t);
    ctx.fillStyle = tone(ctx, 0.55, { S }); ctx.fill(sh, 'evenodd');
    const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
    ctx.fillStyle = PAPER; ctx.fill(band, 'evenodd');
    pen(ctx, Math.max(1, 3 * s)); ctx.strokeRect(x - t, y - t, w + 2 * t, h + 2 * t);
    pen(ctx, Math.max(1.5, 7 * s)); ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
    // 格间距里的小网点角标
    ctx.fillStyle = tone(ctx, 0.4, { S });
    ctx.fillRect(x - t * 0.7, y - t * 0.7, t * 0.4, t * 0.4); ctx.fillRect(x + w + t * 0.3, y + h + t * 0.3, t * 0.4, t * 0.4);
    ctx.restore();
  },
  cardStyle: {
    ink: INK, accent: INK, bar: false,
    bgDraw(ctx, x, y, w, h) {
      // 一格漫画分镜：白底粗黑框、右下硬投影、左侧一条渐变网点竖条
      ctx.save();
      ctx.fillStyle = INK; ctx.fillRect(x + 10, y + 10, w, h);
      ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
      ctx.beginPath(); ctx.rect(x + 16, y + 18, 16, h - 36); ctx.save(); ctx.clip();
      toneGrad(ctx, x + 12, y + 14, x + 36, y + h - 14, (xx, yy) => 0.15 + 0.6 * (yy - y) / h, { S: 7 });
      ctx.restore();
      pen(ctx, 1.5); ctx.strokeRect(x + 16, y + 18, 16, h - 36);
      pen(ctx, 5); ctx.strokeRect(x, y, w, h);
      // 右上角几道速度线
      pen(ctx, 1.4);
      for (let i = 0; i < 5; i++) seg(ctx, x + w - 70 + i * 4, y + 14 + i * 7, x + w - 14, y + 14 + i * 7);
      ctx.restore();
    },
  },
  playerStyle: {
    plate: PAPER, ink: INK, noteColor: INK, backdrop: false, family: SANS,
    plateDraw(ctx, x, y, w, h) {
      // 对话框：白底圆角气泡，尾巴指向磁带
      const tail = new Path2D(); tail.moveTo(x + w - 46, y + h - 14); tail.lineTo(x + w + 34, y + h + 12); tail.lineTo(x + w - 20, y + h - 34); tail.closePath();
      const bub = new Path2D(); bub.roundRect ? bub.roundRect(x, y, w, h, h / 2) : bub.rect(x, y, w, h);
      pen(ctx, 8); ctx.stroke(tail); ctx.stroke(bub);
      ctx.fillStyle = PAPER; ctx.fill(tail); ctx.fill(bub);
    },
    drawPlayer(ctx, kind, cx, cy, s, spin) {
      // 黑白磁带：白壳黑线、标签纸贴网点、黑窗里两道转动的白弧
      const w = 200 * s, h = 128 * s;
      ctx.save(); ctx.translate(cx, cy);
      ctx.fillStyle = INK; roundRect(ctx, -w / 2 + 9, -h / 2 + 9, w, h, 10 * s); ctx.fill();
      roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s); ctx.fillStyle = PAPER; ctx.fill(); pen(ctx, 3.5 * s); ctx.stroke();
      roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 12 * s, w - 28 * s, 66 * s, 5 * s);
      ctx.save(); ctx.clip();
      toneGrad(ctx, -w / 2, -h / 2, w / 2, 20 * s, (x) => 0.05 + 0.4 * clamp((x + w / 2) / w), { S: 6 });
      ctx.restore();
      pen(ctx, 2.2 * s); ctx.stroke();
      ctx.fillStyle = INK; ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 22 * s, w - 28 * s, 6 * s);
      roundRect(ctx, -52 * s, -h / 2 + 34 * s, 104 * s, 34 * s, 16 * s); ctx.fillStyle = INK; ctx.fill();
      for (const sx of [-1, 1]) {
        const rx = sx * 34 * s, ry = -h / 2 + 51 * s;
        ctx.fillStyle = PAPER; circle(ctx, rx, ry, 10 * s); ctx.fill(); pen(ctx, 1.6 * s); ctx.stroke();
        ctx.save(); ctx.translate(rx, ry); ctx.rotate(spin * (sx < 0 ? 1 : 1.3));
        ctx.fillStyle = INK; for (let i = 0; i < 6; i++) { ctx.rotate(TAU / 6); ctx.fillRect(-1.4 * s, -9 * s, 2.8 * s, 4.5 * s); }
        pen(ctx, 1.6 * s, PAPER); ctx.beginPath(); ctx.arc(0, 0, 14 * s, 0, 1.1); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 14 * s, Math.PI, Math.PI + 1.1); ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath(); ctx.moveTo(-60 * s, h / 2); ctx.lineTo(-48 * s, h / 2 - 30 * s); ctx.lineTo(48 * s, h / 2 - 30 * s); ctx.lineTo(60 * s, h / 2); ctx.closePath();
      ctx.fillStyle = tone(ctx, 0.3, { S: 6 }); ctx.fill(); pen(ctx, 2.4 * s); ctx.stroke();
      ctx.fillStyle = INK; for (const sx of [-1, 1]) { circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s); ctx.fill(); }
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { circle(ctx, sx * (w / 2 - 8 * s), sy * (h / 2 - 8 * s), 2.6 * s); ctx.fill(); }
      ctx.restore();
    },
  },
};
