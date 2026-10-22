// 第 6 站 · 十一月的萧邦（November's Chopin, 2005）·「夜曲」· 月夜里的一架钢琴 · 白纸蓝黑墨水钢笔画
// 白纸为主：夜色只靠天空里稀疏的横向排线（越往上越密，从不涂满）；月亮是一大块留白，只有一圈细线和光晕；
// 远处屋顶、塔尖用淡墨单线；中景铁栏杆、石矮墙、路灯、光秃的树用细线；广场石板只有几笔横线和点。
// 广场上一架三角钢琴：大面积留白，只在琴身下沿、琴盖内侧和地面阴影上排线；琴盖支起，像一张斜帆。
// 梗：第 5–8 拍乌鸦一只只从上方落到琴盖边上，排成一行，高低错落像五线谱上的音符（镜头平移，
//     每只都落在画面同一处，像一个个音符被写上去）；第 9 拍强拍他在钢琴旁定格，乌鸦同时扭头看他；
//     第 11 拍同时扭回去；第 13 拍起他走向下一道画框，最后落下的那只乌鸦飞起，穿过月亮飞出画面。
// 钢笔线都是 Canvas2D 的细线（带一点低频抖动）；静态层预烘焙成视差长条，乌鸦每帧画。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { strip, drawStrip } from '../kit/strip.js';
import { baked } from '../kit/canvas.js';
import { paperTexture } from '../kit/paper.js';
import { rng, hash2 } from '../kit/rng.js';
import { noise2 } from '../kit/noise.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { GAG } from '../beat/time.js';
import { stationByN } from '../data/stations.js';

const ST = stationByN(6);
const PAPER = '#fbfaf6', CARD = '#fefdf9', INK = '#1f2a44', INK_M = '#4a5674', INK_L = '#7a869e', MOON_C = '#ffffff';
const P_SKY = 0.04, P_FAR = 0.3, P_MID = 0.7, P_FG = 1.3;

// ---------- 定格时（第 9–12 拍）布景在画面上的位置（单位） ----------
const MOON = { x: 1010, y: 215, r: 165 };  // 月亮（画面右上，乌鸦在它前面）
const PIANO_X = 500;                        // 钢琴键盘前端
const PARAPET = 690;                        // 广场后沿石矮墙顶
const CLEAR = [230, 1130];                  // 定格时中景在这段里不放树和路灯（人物、钢琴、月亮后面保持干净）

// ---------- 时间点（段内拍位） ----------
const N_CROW = 7;
const LAND0 = GAG - 3.5, LAND_STEP = 0.5;   // 第 5.5 拍起每半拍落一只，第 8.5 拍落完
const FLY_T = 0.9;                          // 落下来飞多久
const TURN = [GAG, GAG + 2];                // 第 9 拍强拍同时扭头，第 11 拍扭回去
const TAKEOFF = GAG + 4.6;                  // 第 13.6 拍：最后落下的那只飞起
const FLY_OFF = 2.3;

const R0 = (k) => rng('s06', k);

// ---------- 钢笔线 ----------
/** 把折线细分并在法向加一点低频抖动（钢笔手绘的轻微不稳）。 */
function wobbly(pts, { seed = 1, wob = 0.45, step = 12, close = false } = {}) {
  const out = [];
  const n = pts.length, segs = close ? n : n - 1;
  let acc = 0;
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1e-6;
    const nx = -dy / L, ny = dx / L;
    const m = Math.max(1, Math.ceil(L / step));
    for (let k = i ? 1 : 0; k <= m; k++) {
      const t = k / m;
      const d = (noise2((acc + t * L) / 34, seed * 1.37, seed) - 0.5) * 2 * wob;
      out.push([a[0] + dx * t + nx * d, a[1] + dy * t + ny * d]);
    }
    acc += L;
  }
  return out;
}
function tracePath(ctx, pts, close) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
/** 一笔钢笔线（可选先填色）。 */
function pen(ctx, pts, { w = 1.2, color = INK, alpha = 1, seed = 1, wob = 0.45, step = 12, close = false, fill = null } = {}) {
  const q = wob > 0 ? wobbly(pts, { seed, wob, step, close }) : pts;
  ctx.save();
  tracePath(ctx, q, close);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (w > 0) {
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  }
  ctx.restore();
}
/** Catmull-Rom 过点曲线 → 密集折线。 */
function spline(pts, per = 8) {
  const n = pts.length, out = [];
  const P = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(pts[n - 1]);
  return out;
}
/** 在 clip 区域里画一组平行排线（钢笔阴影）。box = [x, y, w, h]。 */
function hatch(ctx, clip, box, { angle = 0.8, gap = 6, w = 0.9, color = INK, alpha = 0.8, seed = 1, wob = 0.5, breaks = 0.12 } = {}) {
  const [bx, by, bw, bh] = box;
  ctx.save();
  if (clip) ctx.clip(clip);
  ctx.strokeStyle = color; ctx.lineWidth = w; ctx.globalAlpha *= alpha; ctx.lineCap = 'round';
  const c = Math.cos(angle), s = Math.sin(angle), D = Math.hypot(bw, bh) / 2 + 4, cx = bx + bw / 2, cy = by + bh / 2;
  ctx.beginPath();
  let i = 0;
  for (let d = -D; d <= D; d += gap, i++) {
    const jd = d + (hash2(i, 1, seed) - 0.5) * gap * 0.35;
    const px = cx - s * jd, py = cy + c * jd;
    const cut = hash2(i, 2, seed) < breaks ? lerp(-0.6, 0.6, hash2(i, 3, seed)) * D : null;
    const spans = cut === null ? [[-D, D]] : [[-D, cut - 3], [cut + 3 + hash2(i, 4, seed) * 8, D]];
    for (const [u0, u1] of spans) {
      const m = (hash2(i, 5, seed) - 0.5) * 2 * wob;
      ctx.moveTo(px + c * u0, py + s * u0);
      ctx.quadraticCurveTo(px + c * (u0 + u1) / 2 - s * m, py + s * (u0 + u1) / 2 + c * m, px + c * u1, py + s * u1);
    }
  }
  ctx.stroke();
  ctx.restore();
}
const polyPath = (pts) => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
const rectPts = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const ellPts = (cx, cy, rx, ry, n = 24, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });

// ---------- 天空：稀疏横向排线 + 留白的大月亮 + 星 ----------
function skyLayer(cg) {
  const MX = MOON.x + cg * P_SKY, MY = MOON.y, MR = MOON.r;
  return strip('s06-sky', P_SKY, (ctx, x0, x1) => {
    const R = R0('sky');
    // 月亮周围一圈不画（光晕），排线在边上自然断开
    const clip = new Path2D();
    clip.rect(x0, 0, x1 - x0, 700);
    clip.arc(MX, MY, MR * 1.2, 0, Math.PI * 2);
    ctx.save();
    ctx.clip(clip, 'evenodd');
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const row = (y, pass) => {
      const t = y / 600;
      let x = x0 - R() * 120;
      while (x < x1) {
        const L = 34 + R() * 120;
        const mx = x + L / 2;
        const d = Math.hypot(mx - MX, y - MY) / MR;
        // 越往下越稀；离月亮越近越稀
        const keep = smoothstep(1.15, 2.4, d) * (0.85 - 0.8 * smoothstep(0.3, 0.95, t)) * (pass ? 1 - smoothstep(0.05, 0.36, t) : 1);
        if (R() < keep) {
          const slope = -0.03 + (R() - 0.5) * 0.02;
          ctx.globalAlpha = 0.5 + R() * 0.3;
          ctx.lineWidth = 0.8 + R() * 0.35;
          const q = wobbly([[x, y], [x + L, y + slope * L]], { seed: Math.floor(x * 7 + y), wob: 0.7, step: 16 });
          tracePath(ctx, q, false);
          ctx.stroke();
        }
        x += L + 14 + R() * 30 * (1 + t * 3);
      }
    };
    for (let y = 5; y < 600;) { row(y, 0); y += lerp(8, 26, Math.pow(y / 600, 0.65)) * (0.8 + R() * 0.4); }
    // 顶上再叠一层，让最上面更深一点（仍然透白）
    for (let y = 9; y < 230;) { row(y, 1); y += lerp(10, 18, y / 230) * (0.85 + R() * 0.3); }
    ctx.restore();
    // 光晕：两圈断续的细线
    for (const [k, a, seg] of [[1.08, 0.55, 0], [1.2, 0.32, 1]]) {
      const n = seg ? 14 : 1;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + R() * 0.2, a1 = a0 + (seg ? (Math.PI * 2 / n) * (0.45 + R() * 0.3) : Math.PI * 2);
        pen(ctx, ellPts(MX, MY, MR * k, MR * k, seg ? 6 : 90, a0, a1), { w: 0.9, alpha: a, seed: 30 + i, wob: 0.5, color: INK_M });
      }
    }
    // 月亮：纯白留白 + 一圈细线 + 几处极淡的月海点线
    pen(ctx, ellPts(MX, MY, MR, MR, 120), { w: 1.5, fill: MOON_C, seed: 7, wob: 0.6, step: 10, close: true });
    // 右下一道内弧（体积），其余全部留白
    pen(ctx, ellPts(MX, MY, MR * 0.92, MR * 0.92, 24, 0.15, 1.35), { w: 0.9, alpha: 0.4, color: INK_M, seed: 8, wob: 0.4 });
    pen(ctx, ellPts(MX, MY, MR * 0.86, MR * 0.86, 16, 0.4, 1.1), { w: 0.8, alpha: 0.25, color: INK_M, seed: 9, wob: 0.4 });
    // 星：小十字（先擦出一点白）
    const RS = R0('stars');
    for (let i = 0; i < 46; i++) {
      const x = x0 + RS() * (x1 - x0), y = 20 + Math.pow(RS(), 1.4) * 430;
      if (Math.hypot(x - MX, y - MY) < MR * 1.45) continue;
      const s = 3 + RS() * 5;
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, y, s * 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }, { y0: 0, y1: 700 });
}
/** 几颗随拍闪一下的星（每帧画）。 */
const TWINKLE = Array.from({ length: 7 }, (_, i) => ({ x: X_MIN + 120 + hash2(i, 1, 66) * (X_MAX - X_MIN - 240), y: 40 + hash2(i, 2, 66) * 300, ph: hash2(i, 3, 66) }));
function drawTwinkles(ctx, b, cam) {
  for (const s of TWINKLE) {
    const x = s.x - cam * P_SKY;
    if (Math.hypot(x - MOON.x, s.y - MOON.y) < MOON.r * 1.5) continue;
    const u = ((b + s.ph * 4) % 1 + 1) % 1;
    const k = Math.exp(-u * 5);
    const L = 4 + 9 * k;
    ctx.save();
    ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(x, s.y, L * 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x - L, s.y); ctx.lineTo(x + L, s.y); ctx.moveTo(x, s.y - L); ctx.lineTo(x, s.y + L);
    const d = L * 0.45; ctx.moveTo(x - d, s.y - d); ctx.lineTo(x + d, s.y + d); ctx.moveTo(x - d, s.y + d); ctx.lineTo(x + d, s.y - d);
    ctx.globalAlpha = 0.9; ctx.stroke();
    ctx.restore();
  }
}

// ---------- 远景：屋顶、烟囱、塔尖（淡墨单线） ----------
function farLayer() {
  return strip('s06-far', P_FAR, (ctx, x0, x1) => {
    const R = R0('far');
    const BASE = 700;
    const o = (seed) => ({ w: 1.05, color: INK_L, seed, wob: 0.35, fill: PAPER, close: true });
    let x = x0 - 40, i = 0;
    while (x < x1) {
      const kind = R();
      i++;
      if (kind < 0.07) {
        // 钟楼 + 尖顶
        const w = 46 + R() * 14, h = 150 + R() * 60, sh = 120 + R() * 50, cx = x + w / 2;
        pen(ctx, [[x, BASE], [x, BASE - h], [x + w, BASE - h], [x + w, BASE]], o(i));
        pen(ctx, [[x - 4, BASE - h], [cx, BASE - h - sh], [x + w + 4, BASE - h]], o(i + 500));
        hatch(ctx, polyPath([[cx, BASE - h - sh], [x + w + 4, BASE - h], [cx, BASE - h]]), [x, BASE - h - sh, w + 8, sh], { angle: 1.25, gap: 4.5, color: INK_L, w: 0.8, alpha: 0.7, seed: i });
        pen(ctx, [[cx, BASE - h - sh], [cx, BASE - h - sh - 16]], { w: 1, color: INK_L, wob: 0 });
        // 钟楼拱窗
        const wy = BASE - h + 22;
        const arch = [[cx - 9, wy + 34], ...ellPts(cx, wy + 9, 9, 9, 8, Math.PI, Math.PI * 2), [cx + 9, wy + 34]];
        pen(ctx, arch, { ...o(i + 900), fill: null, close: true });
        hatch(ctx, polyPath(arch), [cx - 10, wy, 20, 36], { angle: 1.1, gap: 3, color: INK_L, w: 0.8, seed: i + 3 });
        x += w + 10 + R() * 30;
        continue;
      }
      if (kind < 0.12) {
        // 圆顶
        const w = 120 + R() * 50, h = 80 + R() * 40, cx = x + w / 2, dr = w * 0.34;
        pen(ctx, [[x, BASE], [x, BASE - h], [x + w, BASE - h], [x + w, BASE]], o(i));
        const dome = [[cx - dr, BASE - h], ...ellPts(cx, BASE - h, dr, dr * 0.9, 20, Math.PI, Math.PI * 2)];
        pen(ctx, dome, o(i + 200));
        hatch(ctx, polyPath(dome), [cx, BASE - h - dr, dr, dr], { angle: 1.4, gap: 4, color: INK_L, w: 0.8, alpha: 0.6, seed: i });
        pen(ctx, rectPts(cx - 5, BASE - h - dr * 0.9 - 18, 10, 18), o(i + 300));
        for (let k = 0; k < 4; k++) { const wx = x + 14 + k * (w - 28) / 3.2; pen(ctx, rectPts(wx, BASE - h + 20, 9, 24), { ...o(i + 40 + k), fill: null }); }
        x += w + 6 + R() * 26;
        continue;
      }
      // 普通房子：山墙、斜顶或孟莎顶，烟囱，几扇窗
      const w = 64 + R() * 120, h = 56 + R() * 110, rh = 26 + R() * 46;
      const top = BASE - h;
      const roofKind = R();
      let roof;
      if (roofKind < 0.45) roof = [[x - 4, top], [x + w / 2, top - rh], [x + w + 4, top]];
      else if (roofKind < 0.75) roof = [[x - 4, top], [x + w * 0.2, top - rh], [x + w * 0.8, top - rh], [x + w + 4, top]];
      else roof = [[x - 2, top], [x + w + 2, top]];
      const body = [[x, BASE], [x, top], ...roof.slice(1, -1), [x + w, top], [x + w, BASE]];
      // 烟囱（先画，被屋顶盖住下半截）
      if (R() < 0.65) {
        const cx = x + w * (0.25 + R() * 0.5), ch = rh + 18 + R() * 20;
        pen(ctx, rectPts(cx - 7, top - ch, 14, ch), o(i + 700));
        pen(ctx, rectPts(cx - 9, top - ch - 5, 18, 6), o(i + 710));
        if (R() < 0.5) pen(ctx, spline([[cx, top - ch - 8], [cx + 6, top - ch - 22], [cx - 2, top - ch - 34], [cx + 8, top - ch - 50], [cx + 4, top - ch - 64]], 5), { w: 0.8, color: INK_L, alpha: 0.6, seed: i + 720 });
      }
      pen(ctx, body, o(i));
      if (roof.length > 2) {
        hatch(ctx, polyPath([...roof, [x + w + 4, top]]), [x - 4, top - rh, w + 8, rh], { angle: roofKind < 0.45 ? 2.2 : 1.57, gap: 5, color: INK_L, w: 0.8, alpha: 0.55, seed: i + 5 });
        pen(ctx, roof, { w: 1.1, color: INK_L, seed: i + 6, wob: 0.3 });
      }
      // 窗：两排，少数涂暗
      const cols = Math.max(1, Math.floor(w / 34)), rows = Math.max(1, Math.floor(h / 46));
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (R() < 0.3) continue;
        const wx = x + (w / cols) * (c + 0.5) - 6, wy = top + 14 + r * 44;
        if (wy + 18 > BASE - 6) continue;
        const pts = rectPts(wx, wy, 12, 18);
        pen(ctx, pts, { w: 0.9, color: INK_L, seed: i * 31 + r * 7 + c, wob: 0.25, close: true });
        if (R() < 0.35) hatch(ctx, polyPath(pts), [wx, wy, 12, 18], { angle: 0.9, gap: 2.6, color: INK_L, w: 0.8, seed: i + c + r });
        else pen(ctx, [[wx + 6, wy], [wx + 6, wy + 18]], { w: 0.7, color: INK_L, alpha: 0.7, wob: 0 });
      }
      x += w + (R() < 0.35 ? -8 : 6 + R() * 34);
    }
  }, { y0: 330, y1: 720 });
}

// ---------- 中景：路灯、光秃的树、石矮墙 + 铁栏杆 ----------
function midGeo(cg) {
  const R = R0('mid'), items = [];
  let lamp = true;
  for (let x = -900; x < 3900;) {
    const sx = x - cg * P_MID;
    if (sx > CLEAR[0] && sx < CLEAR[1]) { x += 90; continue; }
    items.push({ x, kind: lamp ? 'lamp' : 'tree', seed: Math.floor(R() * 1000), h: R() });
    lamp = !lamp || R() < 0.2;
    x += 300 + R() * 260;
  }
  return items;
}
function lamp(ctx, x, seed) {
  const top = 430;
  // 杆：两条细线 + 几个箍
  pen(ctx, [[x - 4, PARAPET + 10], [x - 3, top + 30], [x + 3, top + 30], [x + 4, PARAPET + 10]], { w: 1.1, color: INK_M, fill: PAPER, seed, wob: 0.25, close: true });
  for (const y of [top + 40, top + 120, 610]) pen(ctx, [[x - 7, y], [x + 7, y]], { w: 1.1, color: INK_M, seed: seed + y, wob: 0.2 });
  pen(ctx, [[x - 16, top + 52], [x + 16, top + 52]], { w: 1.1, color: INK_M, seed: seed + 3, wob: 0.2 });
  // 灯笼：顶帽、玻璃、底座（玻璃留白——灯是亮的）
  const glass = [[x - 15, top - 22], [x + 15, top - 22], [x + 9, top + 22], [x - 9, top + 22]];
  pen(ctx, [[x - 20, top - 22], [x, top - 40], [x + 20, top - 22]], { w: 1.2, color: INK_M, fill: PAPER, seed: seed + 4, close: true });
  hatch(ctx, polyPath([[x, top - 40], [x + 20, top - 22], [x, top - 22]]), [x, top - 41, 21, 20], { angle: 1.2, gap: 2.8, color: INK_M, w: 0.8, seed });
  pen(ctx, glass, { w: 1.1, color: INK_M, fill: '#ffffff', seed: seed + 5, close: true });
  pen(ctx, [[x, top - 22], [x, top + 22]], { w: 0.7, color: INK_M, alpha: 0.6, wob: 0 });
  pen(ctx, [[x - 9, top + 22], [x - 5, top + 30], [x + 5, top + 30], [x + 9, top + 22]], { w: 1.1, color: INK_M, fill: PAPER, seed: seed + 6, close: true });
  pen(ctx, [[x, top - 40], [x, top - 50]], { w: 1.1, color: INK_M, wob: 0 });
  // 光：一圈放射的短线
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + 0.13;
    const r0 = 32 + hash2(k, 1, seed) * 4, r1 = r0 + 7 + hash2(k, 2, seed) * 8;
    pen(ctx, [[x + Math.cos(a) * r0, top + Math.sin(a) * r0], [x + Math.cos(a) * r1, top + Math.sin(a) * r1]], { w: 0.9, color: INK_M, alpha: 0.6, wob: 0 });
  }
}
function tree(ctx, x, seed, hk) {
  const R = rng('s06-tree', seed);
  const base = PARAPET + 12, h = 170 + hk * 80;
  const lean = (R() - 0.5) * 30;
  const topPt = [x + lean, base - h];
  // 树干：两条边线 + 左侧（背光）竖排线
  const left = spline([[x - 13, base], [x - 9 + lean * 0.4, base - h * 0.5], [topPt[0] - 6, topPt[1]]], 6);
  const right = spline([[x + 13, base], [x + 8 + lean * 0.4, base - h * 0.5], [topPt[0] + 6, topPt[1]]], 6);
  const trunk = [...left, ...right.slice().reverse()];
  pen(ctx, trunk, { w: 0, fill: PAPER, wob: 0, close: true });
  hatch(ctx, polyPath(trunk), [x - 16 + Math.min(0, lean), base - h, 18, h], { angle: 1.5, gap: 3.4, color: INK_M, w: 0.8, alpha: 0.7, seed });
  pen(ctx, left, { w: 1.2, color: INK_M, seed: seed + 1 });
  pen(ctx, right, { w: 1.2, color: INK_M, seed: seed + 2 });
  // 枝：递归细线
  const branch = (bx, by, ang, len, w, depth) => {
    const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
    const mx = (bx + ex) / 2 + (R() - 0.5) * len * 0.25, my = (by + ey) / 2 + (R() - 0.5) * len * 0.25;
    pen(ctx, spline([[bx, by], [mx, my], [ex, ey]], 4), { w, color: INK_M, seed: Math.floor(R() * 999), wob: 0.3, step: 8 });
    if (depth <= 0) return;
    const n = R() < 0.3 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const da = (k - (n - 1) / 2) * (0.5 + R() * 0.35) + (R() - 0.5) * 0.25;
      branch(ex, ey, ang + da, len * (0.62 + R() * 0.16), Math.max(0.6, w * 0.72), depth - 1);
    }
  };
  branch(topPt[0], topPt[1] + 4, -Math.PI / 2 - 0.55, 60 + R() * 20, 2.6, 5);
  branch(topPt[0], topPt[1] + 2, -Math.PI / 2 + 0.5, 60 + R() * 20, 2.6, 5);
  branch(topPt[0], topPt[1], -Math.PI / 2 + (R() - 0.5) * 0.3, 54, 2.4, 4);
  branch(x - 6, base - h * 0.62, Math.PI + 0.55, 44, 1.6, 3);
}
function midLayer(cg) {
  const items = midGeo(cg);
  return strip('s06-mid', P_MID, (ctx, x0, x1) => {
    for (const it of items) {
      if (it.x < x0 - 200 || it.x > x1 + 200) continue;
      if (it.kind === 'tree') tree(ctx, it.x, it.seed, it.h);
    }
    for (const it of items) if (it.kind === 'lamp' && it.x > x0 - 60 && it.x < x1 + 60) lamp(ctx, it.x, it.seed);
    // 铁栏杆（在石矮墙上）
    const RAIL0 = 646, RAIL1 = PARAPET - 4;
    ctx.save();
    ctx.strokeStyle = INK_M; ctx.lineCap = 'round';
    ctx.lineWidth = 0.9; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let x = x0, i = 0; x < x1; x += 13, i++) {
      const j = (hash2(i, 1, 61) - 0.5) * 0.8;
      ctx.moveTo(x + j, RAIL1); ctx.lineTo(x - j, RAIL0 - 4);
    }
    ctx.stroke();
    // 矛尖
    ctx.fillStyle = INK_M;
    for (let x = x0; x < x1; x += 13) { ctx.beginPath(); ctx.moveTo(x - 2.4, RAIL0 - 3); ctx.lineTo(x, RAIL0 - 10); ctx.lineTo(x + 2.4, RAIL0 - 3); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    pen(ctx, [[x0, RAIL0 + 6], [x1, RAIL0 + 6]], { w: 1.2, color: INK_M, seed: 62, step: 30 });
    pen(ctx, [[x0, RAIL1 - 8], [x1, RAIL1 - 8]], { w: 1.2, color: INK_M, seed: 63, step: 30 });
    // 栏杆柱（每隔一段，顶上一个圆球）
    for (let x = x0 + 40; x < x1; x += 156) {
      pen(ctx, rectPts(x - 5, RAIL0 - 2, 10, RAIL1 - RAIL0 + 2), { w: 1.1, color: INK_M, fill: PAPER, seed: Math.floor(x), wob: 0.2, close: true });
      pen(ctx, ellPts(x, RAIL0 - 9, 6.5, 6.5, 12), { w: 1.1, color: INK_M, fill: PAPER, seed: Math.floor(x) + 1, wob: 0.2, close: true });
    }
    // 石矮墙：压顶两条线 + 错缝 + 下半截稀疏排线
    const wall = rectPts(x0, PARAPET, x1 - x0, 40);
    pen(ctx, wall, { w: 0, fill: PAPER, wob: 0, close: true });
    pen(ctx, [[x0, PARAPET], [x1, PARAPET]], { w: 1.3, color: INK_M, seed: 64, step: 26 });
    pen(ctx, [[x0, PARAPET + 7], [x1, PARAPET + 7]], { w: 1, color: INK_M, seed: 65, step: 26 });
    pen(ctx, [[x0, PARAPET + 38], [x1, PARAPET + 38]], { w: 1.1, color: INK_M, seed: 66, step: 26 });
    const R = R0('wall');
    for (let x = x0; x < x1; x += 52 + R() * 26) pen(ctx, [[x, PARAPET + 7], [x + (R() - 0.5) * 2, PARAPET + 22]], { w: 0.8, color: INK_M, alpha: 0.7, wob: 0 });
    for (let x = x0 + 30; x < x1; x += 52 + R() * 26) pen(ctx, [[x, PARAPET + 22], [x, PARAPET + 38]], { w: 0.8, color: INK_M, alpha: 0.7, wob: 0 });
    pen(ctx, [[x0, PARAPET + 22], [x1, PARAPET + 22]], { w: 0.7, color: INK_M, alpha: 0.5, seed: 67, step: 30 });
    hatch(ctx, polyPath(rectPts(x0, PARAPET + 24, x1 - x0, 14)), [x0, PARAPET + 24, x1 - x0, 14], { angle: 0.05, gap: 3.6, color: INK_M, w: 0.7, alpha: 0.4, seed: 68, breaks: 0.5 });
  }, { y0: 290, y1: 732 });
}

// ---------- 广场石板（几笔横线 + 少量点） ----------
const ROWS = [736, 747, 760, 776, 797, 822, 853, 892, 940, 998];
function groundLayer() {
  return strip('s06-ground', 1, (ctx, x0, x1) => {
    ctx.fillStyle = PAPER; ctx.fillRect(x0, 726, x1 - x0, 274);
    const R = R0('ground');
    ROWS.forEach((y, i) => {
      const t = i / (ROWS.length - 1);
      const gapH = i ? y - ROWS[i - 1] : 10;
      const alpha = lerp(0.35, 0.8, t);
      // 一行：断续的横线
      let x = x0 - R() * 60;
      while (x < x1) {
        const L = 60 + R() * 220 * (1 + t);
        if (R() < 0.82) pen(ctx, [[x, y + (R() - 0.5) * 1.5], [x + L, y + (R() - 0.5) * 1.5]], { w: lerp(0.8, 1.25, t), alpha, seed: Math.floor(x + y), wob: 0.5, step: 20 });
        x += L + 10 + R() * 40 * (1 + t);
      }
      // 石缝：竖向短线（越近越宽）
      const sp = gapH * 2.6 + 14;
      for (let xx = x0 + (i % 2) * sp * 0.5; xx < x1; xx += sp * (0.8 + R() * 0.4)) {
        if (R() < 0.45) continue;
        const lean = (xx - 500) * 0.0006 * gapH;
        pen(ctx, [[xx, y - gapH + 2], [xx + lean, y - 2]], { w: lerp(0.7, 1, t), alpha: alpha * 0.8, wob: 0 });
      }
      // 点
      for (let k = 0; k < (x1 - x0) / 140; k++) {
        const px = x0 + R() * (x1 - x0), py = y - R() * gapH;
        ctx.fillStyle = INK; ctx.globalAlpha = alpha * 0.7;
        ctx.beginPath(); ctx.arc(px, py, 0.8 + R() * 0.7, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });
  }, { y0: 722, y1: 1000 });
}

// ---------- 钢琴（单位坐标，键盘前端为原点；y 为画面绝对值） ----------
const CASE_T = 522, CASE_B = 612;
const LID_EDGE = [[100, 507], [170, 486], [240, 476], [310, 452], [380, 440], [450, 410], [520, 392], [572, 362], [604, 350]];
const LID_PTS = spline(LID_EDGE, 10);
function lidY(x) {
  for (let i = 1; i < LID_PTS.length; i++) {
    const [ax, ay] = LID_PTS[i - 1], [bx, by] = LID_PTS[i];
    if (x <= bx) return lerp(ay, by, clamp((x - ax) / ((bx - ax) || 1)));
  }
  return LID_PTS[LID_PTS.length - 1][1];
}
// 七只乌鸦：站位（相对键盘前端的 x）、大小、姿势（蹲 0..1）、脖子伸长
const CROWS = Array.from({ length: N_CROW }, (_, i) => ({
  rx: 136 + i * 72,
  s: [1.08, 1.2, 1.02, 1.24, 1.06, 1.16, 1.22][i],
  crouch: [0.25, 0, 0.55, 0, 0.35, 0.1, 0][i],
  neck: [0, 4, 0, 7, 0, 2, 5][i],
  land: LAND0 + i * LAND_STEP,
}));
function pianoImage() {
  const BX0 = -150, BX1 = 650, BY0 = 300, BY1 = 830;
  const canvas = baked('s06-piano', (BX1 - BX0) * K, (BY1 - BY0) * K, (ctx) => {
    ctx.scale(K, K);
    ctx.translate(-BX0, -BY0);
    // 地上的影子（月光从右上来，影子落向左边）：横排线
    const shadow = polyPath([[-120, 808], [-60, 796], [604, 792], [640, 800], [560, 816], [-90, 818]]);
    hatch(ctx, shadow, [-130, 790, 780, 30], { angle: 0.02, gap: 3.2, w: 0.9, alpha: 0.55, seed: 601, breaks: 0.4 });
    // 琴凳
    const bench = [[-112, 676], [-30, 676], [-28, 690], [-114, 690]];
    for (const lx of [-98, -40]) pen(ctx, [[lx, 690], [lx + 2, 788], [lx + 7, 788], [lx + 6, 690]], { w: 1, color: INK_M, fill: PAPER, seed: 610 + lx, close: true, wob: 0.2 });
    for (const lx of [-106, -32]) pen(ctx, [[lx, 690], [lx - 1, 794], [lx + 6, 794], [lx + 7, 690]], { w: 1.2, fill: PAPER, seed: 620 + lx, close: true, wob: 0.2 });
    pen(ctx, [[-104, 760], [-26, 760]], { w: 1, seed: 630, wob: 0.2 });
    pen(ctx, bench, { w: 1.4, fill: PAPER, seed: 631, close: true, wob: 0.3 });
    hatch(ctx, polyPath(bench), [-115, 676, 90, 14], { angle: 0.75, gap: 3, w: 0.8, alpha: 0.8, seed: 632 });
    pen(ctx, [[-110, 678], [-32, 678]], { w: 2, color: '#ffffff', alpha: 0.9, wob: 0.2 });
    // 后面那条琴腿（低音侧，躲在前腿后面）
    pen(ctx, [[92, CASE_B], [106, CASE_B], [102, 778], [95, 778]], { w: 1, color: INK_M, fill: PAPER, seed: 640, close: true, wob: 0.2 });
    // 琴盖（支起，像一张斜帆）：下沿是铰链，上沿是 LID_EDGE，尾部圆转下来
    const tail = spline([[604, 350], [618, 372], [622, 440], [614, CASE_T]], 6);
    const lid = [[96, CASE_T], [100, 507], ...LID_PTS.slice(1), ...tail.slice(1)];
    pen(ctx, lid, { w: 0, fill: '#fefefc', wob: 0, close: true });
    // 琴盖内侧：靠铰链的一半稀疏斜排线（阴影），上半留白
    const lidP = polyPath(lid);
    ctx.save();
    ctx.clip(lidP);
    const sh = new Path2D();
    sh.moveTo(96, CASE_T);
    for (let x = 100; x <= 620; x += 20) sh.lineTo(x, lerp(CASE_T, lidY(Math.min(604, x)), 0.42));
    sh.lineTo(620, CASE_T); sh.closePath();
    hatch(ctx, sh, [96, 380, 530, 150], { angle: -0.62, gap: 5.5, w: 0.85, alpha: 0.55, seed: 650, breaks: 0.25 });
    ctx.restore();
    // 琴盖边厚：上沿下面一条平行线
    pen(ctx, LID_PTS.map(([x, y]) => [x + 1, y + 7]).filter(([x]) => x < 600), { w: 0.9, alpha: 0.7, seed: 652 });
    pen(ctx, lid, { w: 1.6, seed: 651, close: true, wob: 0.35 });
    // 支杆
    const stickTop = [334, lidY(334) + 3];
    pen(ctx, [[312, CASE_T - 1], stickTop], { w: 2.2, seed: 660, wob: 0.15 });
    pen(ctx, [[317, CASE_T - 1], [stickTop[0] + 4, stickTop[1] + 1]], { w: 0.8, alpha: 0.6, seed: 661, wob: 0.15 });
    // 谱架
    const desk = [[58, CASE_T], [70, CASE_T], [104, 446], [93, 442]];
    pen(ctx, desk, { w: 1.3, fill: PAPER, seed: 670, close: true, wob: 0.2 });
    hatch(ctx, polyPath(desk), [58, 440, 48, 84], { angle: -1.2, gap: 3, w: 0.7, alpha: 0.7, seed: 671 });
    // 琴身侧面：顶边、尾部圆角、底边；下半截竖排线（体积）
    const caseOutline = [[58, CASE_T], [574, CASE_T], ...spline([[574, CASE_T], [606, CASE_T + 10], [618, (CASE_T + CASE_B) / 2], [606, CASE_B - 10], [574, CASE_B]], 6).slice(1), [58, CASE_B]];
    pen(ctx, caseOutline, { w: 1.7, fill: '#fefefc', seed: 680, close: true, wob: 0.35 });
    ctx.save();
    ctx.clip(polyPath(caseOutline));
    hatch(ctx, polyPath([[56, CASE_T + 48], [640, CASE_T + 48], [640, CASE_B + 2], [56, CASE_B + 2]]), [56, CASE_T + 46, 584, 50], { angle: 1.5, gap: 4.2, w: 0.85, alpha: 0.7, seed: 681, breaks: 0.3 });
    hatch(ctx, polyPath([[56, CASE_B - 14], [640, CASE_B - 14], [640, CASE_B + 2], [56, CASE_B + 2]]), [56, CASE_B - 16, 584, 20], { angle: 0.06, gap: 3.2, w: 0.8, alpha: 0.6, seed: 682 });
    ctx.restore();
    pen(ctx, [[60, CASE_T + 8], [586, CASE_T + 8]], { w: 0.9, alpha: 0.75, seed: 683, step: 24 });
    pen(ctx, [[60, CASE_B - 7], [592, CASE_B - 7]], { w: 0.9, alpha: 0.75, seed: 684, step: 24 });
    // 键盘：琴颊、键盘盖、几个琴键
    const cheek = [[0, 530], [58, 530], [58, 568], [4, 568]];
    pen(ctx, cheek, { w: 1.5, fill: '#fefefc', seed: 690, close: true, wob: 0.25 });
    hatch(ctx, polyPath([[2, 552], [58, 552], [58, 568], [4, 568]]), [0, 550, 60, 20], { angle: 1.5, gap: 3, w: 0.8, alpha: 0.75, seed: 691 });
    pen(ctx, [[2, 530], [10, 516], [58, 516], [58, 530]], { w: 1.3, fill: '#fefefc', seed: 692, close: true, wob: 0.2 });
    for (let k = 0; k < 6; k++) { const kx = 14 + k * 7; ctx.fillStyle = INK; ctx.fillRect(kx, 524, 3.4, 5); }
    pen(ctx, [[10, 530], [58, 530]], { w: 1, seed: 693, wob: 0.1 });
    // 琴腿：前腿（高音侧）、尾腿，下面一个小轮
    for (const [lx, sd] of [[62, 700], [540, 710]]) {
      const leg = [[lx, CASE_B], [lx + 26, CASE_B], [lx + 21, 782], [lx + 5, 782]];
      pen(ctx, leg, { w: 1.4, fill: '#fefefc', seed: sd, close: true, wob: 0.2 });
      hatch(ctx, polyPath([[lx, CASE_B], [lx + 9, CASE_B], [lx + 10, 782], [lx + 5, 782]]), [lx, CASE_B, 12, 170], { angle: 1.52, gap: 2.8, w: 0.8, alpha: 0.8, seed: sd + 1 });
      pen(ctx, [[lx - 2, CASE_B + 10], [lx + 28, CASE_B + 10]], { w: 1.2, seed: sd + 2, wob: 0.1 });
      pen(ctx, ellPts(lx + 13, 789, 8, 8, 14), { w: 1.3, fill: PAPER, seed: sd + 3, close: true, wob: 0.1 });
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(lx + 13, 789, 2, 0, Math.PI * 2); ctx.fill();
    }
    // 踏板琴架（竖琴形）+ 踏板
    pen(ctx, spline([[156, CASE_B], [146, 660], [158, 720], [154, 760]], 6), { w: 1.3, seed: 720 });
    pen(ctx, spline([[188, CASE_B], [198, 660], [186, 720], [190, 760]], 6), { w: 1.3, seed: 721 });
    for (let k = 0; k < 4; k++) pen(ctx, [[160 + k * 7, CASE_B + 6], [162 + k * 7, 756]], { w: 0.8, alpha: 0.75, seed: 722 + k, wob: 0.15 });
    pen(ctx, rectPts(142, 756, 62, 14), { w: 1.3, fill: '#fefefc', seed: 730, close: true, wob: 0.15 });
    hatch(ctx, polyPath(rectPts(142, 763, 62, 7)), [142, 762, 62, 9], { angle: 0.04, gap: 2.4, w: 0.7, alpha: 0.8, seed: 731 });
    for (const dy of [0, 4]) pen(ctx, [[142, 762 + dy], [118, 764 + dy]], { w: 1.8, seed: 732 + dy, wob: 0.1 });
  });
  return { canvas, x0: BX0, y0: BY0, w: BX1 - BX0, h: BY1 - BY0 };
}

// ---------- 乌鸦（原创钢笔小剪影：实心墨块 + 留白高光） ----------
// 站着的乌鸦比较直立（像音符：一个圆头 + 一根「符干」似的身子）
const CROW_BODY = [[12, -46], [17, -37], [15, -26], [9, -17], [-1, -13], [-11, -12], [-21, -8], [-33, -1], [-36, -7], [-25, -19], [-17, -33], [-7, -45], [2, -51]];
function crowStand(ctx, x, y, { s = 1, head = 1, crouch = 0, neck = 0, sq = 0, seed = 1, shout = 0 } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * (1 + 0.1 * crouch + sq * 0.12), s * (1 - 0.14 * crouch - sq * 0.16));
  // 腿和脚
  ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-3, -14); ctx.lineTo(-5, 0); ctx.moveTo(-11, 0); ctx.lineTo(1, 0);
  ctx.moveTo(5, -15); ctx.lineTo(6, 0); ctx.moveTo(1, 0); ctx.lineTo(13, 0);
  ctx.stroke();
  // 身体（含尾巴）
  ctx.fillStyle = INK;
  tracePath(ctx, wobbly(CROW_BODY, { seed, wob: 0.5, step: 8, close: true }), true); ctx.fill();
  // 头（扭头 = 朝向翻转）
  const hx = 6 + 3 * head, hy = -57 - neck;
  ctx.beginPath(); ctx.moveTo(-4, -44); ctx.lineTo(hx - 8, hy + 2); ctx.lineTo(hx + 8, hy + 2); ctx.lineTo(16, -40); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.arc(hx, hy, 11, 0, Math.PI * 2); ctx.fill();
  // 喙：粗、略带钩
  ctx.beginPath();
  ctx.moveTo(hx + 5 * head, hy - 6); ctx.quadraticCurveTo(hx + 17 * head, hy - 5, hx + 23 * head, hy + 1); ctx.lineTo(hx + 6 * head, hy + 4); ctx.closePath(); ctx.fill();
  // 留白：眼睛、喙缝、翅膀高光、羽尖
  ctx.fillStyle = PAPER;
  ctx.beginPath(); ctx.arc(hx + 4 * head, hy - 3, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAPER; ctx.lineCap = 'round'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(hx + 9 * head, hy + 0.5); ctx.lineTo(hx + 18 * head, hy + 0.5); ctx.stroke();
  ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(-26, -13); ctx.quadraticCurveTo(-16, -30, 2, -40); ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  for (let k = 0; k < 3; k++) { ctx.moveTo(-20 + k * 7, -11 - k * 4); ctx.lineTo(-14 + k * 7, -19 - k * 4); }
  ctx.moveTo(-33, -4); ctx.lineTo(-24, -9);
  ctx.stroke();
  // 扭头那一下：头边上三道惊觉的短线
  if (shout > 0) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.globalAlpha = shout;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.55 - head * 0.35;
      const r0 = 16, r1 = 16 + 10 * shout;
      ctx.moveTo(hx + Math.cos(a) * r0, hy + Math.sin(a) * r0); ctx.lineTo(hx + Math.cos(a) * r1, hy + Math.sin(a) * r1);
    }
    ctx.stroke();
  }
  ctx.restore();
}
/** 飞行中的乌鸦（x, y 为身体中心；flap 为扇翅相位 0..1；dir 朝向）。 */
function crowFly(ctx, x, y, { s = 1, flap = 0, dir = 1, seed = 1 } = {}) {
  const u = Math.cos(flap * Math.PI * 2);
  const wing = (k) => [[10, -5], [6, -5 - 26 * u * k], [-4, -5 - 46 * u * k], [-12, -5 - 56 * u * k], [-17, -5 - 50 * u * k], [-21, -5 - 44 * u * k], [-24, -5 - 36 * u * k], [-12, -3]];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * dir, s);
  ctx.rotate(-0.12);
  ctx.fillStyle = INK;
  // 远侧翅膀（略短）
  ctx.save(); ctx.translate(4, -2); tracePath(ctx, wing(0.8), true); ctx.fill(); ctx.restore();
  const body = [[-24, -2], [-10, -8], [8, -9], [18, -7], [20, 2], [6, 6], [-12, 5], [-24, 3]];
  tracePath(ctx, wobbly(body, { seed, wob: 0.4, step: 8, close: true }), true); ctx.fill();
  tracePath(ctx, [[-22, -3], [-40, -9], [-43, -1], [-40, 7], [-22, 4]], true); ctx.fill();
  ctx.beginPath(); ctx.arc(23, -6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(27, -10); ctx.quadraticCurveTo(36, -9, 41, -4); ctx.lineTo(28, -2); ctx.closePath(); ctx.fill();
  tracePath(ctx, wing(1), true); ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath(); ctx.arc(26, -8, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = PAPER; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(4, -6 - 18 * u); ctx.lineTo(-8, -6 - 36 * u); ctx.stroke();
  ctx.restore();
}
const bez = (P, t) => { const v = 1 - t; return [0, 1].map((j) => v * v * P[0][j] + 2 * v * t * P[1][j] + t * t * P[2][j]); };
function drawCrows(ctx, b, env) {
  const off = env.camAt(GAG) - env.cam;
  const looking = b >= TURN[0] && b < TURN[1];
  CROWS.forEach((c, i) => {
    const fx = PIANO_X + c.rx + off, fy = lidY(c.rx) + 1;
    if (b < c.land - FLY_T) return;
    const seed = 800 + i;
    // 落下来：从左上方画外滑翔下来，最后两下扇翅刹住
    if (b < c.land) {
      const t = (b - (c.land - FLY_T)) / FLY_T;
      const P = [[fx - 250, -90], [fx - 210, fy - 210], [fx, fy - 22]];
      const [x, y] = bez(P, ease.out(t));
      crowFly(ctx, x, y, { s: c.s, flap: b * 3.4 + i * 0.3, seed });
      return;
    }
    // 最后落下的那只：第 13.6 拍飞起，穿过月亮飞出画面
    if (i === N_CROW - 1 && b >= TAKEOFF - 0.18) {
      if (b < TAKEOFF) { crowStand(ctx, fx, fy, { s: c.s, crouch: 0.9, neck: 0, seed }); return; }
      const t = (b - TAKEOFF) / FLY_OFF;
      if (t > 1) return;
      const P = [[fx + 6, fy - 30], [fx + 70, fy - 250], [fx + 520, fy - 560]];
      const [x, y] = bez(P, ease.in(t) * 0.35 + t * 0.65);
      crowFly(ctx, x, y, { s: c.s * (1 + t * 0.15), flap: (b - TAKEOFF) * 3.8, seed });
      return;
    }
    const since = b - c.land;
    const sq = since < 0.32 ? Math.sin((Math.PI * since) / 0.32) : 0; // 落地一顿
    const shout = looking ? Math.max(0, 1 - (b - TURN[0]) / 0.45) : 0;
    const jerk = looking && b - TURN[0] < 0.12 ? -2 : 0;
    crowStand(ctx, fx, fy + jerk, { s: c.s, head: looking ? -1 : 1, crouch: c.crouch, neck: c.neck, sq, seed, shout });
  });
}

// ---------- 他脚下的影子（月光从右上来，落向左边） ----------
function figureShadow(ctx) {
  ctx.save();
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (let k = 0; k < 6; k++) {
    const y = ROAD_Y + 2 + k * 2.6;
    const L = 120 - k * 15;
    ctx.globalAlpha = 0.5 - k * 0.05; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(CHAR_X + 30 - k * 6, y); ctx.lineTo(CHAR_X + 30 - L - k * 4, y + 1); ctx.stroke();
  }
  ctx.restore();
}

// ---------- 前景：石缝里的几丛草 ----------
function fgLayer(cg) {
  return strip('s06-fg', P_FG, (ctx, x0, x1) => {
    const R = R0('fg');
    for (let x = x0 + 60; x < x1; x += 260 + R() * 300) {
      const sx = x - cg * P_FG;
      if (sx > 150 && sx < 520) continue;
      const y = 978 + R() * 16;
      // 一块石板边 + 一丛草
      pen(ctx, [[x - 60, y + 4], [x - 20, y - 2], [x + 50, y - 1], [x + 80, y + 6]], { w: 1.4, seed: Math.floor(x), wob: 0.5 });
      for (let k = 0; k < 7; k++) {
        const a = -Math.PI / 2 + (k - 3) * 0.22 + (R() - 0.5) * 0.15, L = 18 + R() * 26;
        const bx = x + (k - 3) * 3;
        pen(ctx, spline([[bx, y], [bx + Math.cos(a) * L * 0.5 + (R() - 0.5) * 4, y + Math.sin(a) * L * 0.5], [bx + Math.cos(a) * L, y + Math.sin(a) * L]], 4), { w: 1.2, seed: Math.floor(x) + k, wob: 0.2 });
      }
      for (let k = 0; k < 4; k++) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 40 + R() * 110, y + 6 + R() * 6, 1 + R(), 0, Math.PI * 2); ctx.fill(); }
    }
  }, { y0: 930, y1: 1000 });
}

// ---------- 标题卡、CD、画框（像素坐标） ----------
function penRect(ctx, x, y, w, h, o) { pen(ctx, rectPts(x, y, w, h), { ...o, close: true }); }
function penCard(ctx, x, y, w, h, seed, staff) {
  ctx.save();
  // 钢笔画的「投影」：右边和下边一条斜排线
  const sh = new Path2D(); sh.rect(x + 10, y + h, w, 10); sh.rect(x + w, y + 10, 10, h);
  hatch(ctx, sh, [x, y, w + 12, h + 12], { angle: -0.8, gap: 3.4, w: 1, alpha: 0.6, seed });
  ctx.fillStyle = CARD; ctx.fillRect(x, y, w, h);
  penRect(ctx, x, y, w, h, { w: 2.6, seed: seed + 1, wob: 0.5, step: 18 });
  penRect(ctx, x + 7, y + 7, w - 14, h - 14, { w: 1.2, seed: seed + 2, wob: 0.4, step: 18 });
  if (staff) {
    // 一角一小段五线谱 + 三个音符（没有任何文字）
    const sx0 = x + w - 200, sx1 = x + w - 22, sy = y + h - 33, g = 4.2;
    for (let k = 0; k < 5; k++) pen(ctx, [[sx0, sy + k * g], [sx1, sy + k * g]], { w: 0.9, alpha: 0.85, seed: seed + 10 + k, wob: 0.25, step: 30 });
    pen(ctx, [[sx1, sy], [sx1, sy + 4 * g]], { w: 1.4, wob: 0 });
    pen(ctx, [[sx0, sy], [sx0, sy + 4 * g]], { w: 1, wob: 0 });
    ctx.fillStyle = INK;
    const notes = [[sx0 + 34, sy + 3 * g], [sx0 + 72, sy + 1.5 * g], [sx0 + 104, sy + 2.5 * g], [sx0 + 142, sy + 1 * g]];
    notes.forEach(([nx, ny], k) => {
      ctx.save(); ctx.translate(nx, ny); ctx.rotate(-0.4);
      ctx.beginPath(); ctx.ellipse(0, 0, 3.9, 2.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(nx + 4, ny - 1); ctx.lineTo(nx + 4, ny - 15); ctx.stroke();
      if (k === 1) { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(nx + 4, ny - 15); ctx.lineTo(notes[2][0] + 4, notes[2][1] - 15); ctx.stroke(); }
      if (k === 3) { ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(nx + 4, ny - 15); ctx.quadraticCurveTo(nx + 12, ny - 10, nx + 10, ny - 4); ctx.stroke(); }
    });
  }
  ctx.restore();
}
function penCD(ctx, cx, cy, s, spin) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  // 排线投影（右下的月牙）
  const sh = new Path2D(); sh.arc(7, 8, r, 0, Math.PI * 2); sh.arc(0, 0, r, 0, Math.PI * 2);
  hatch(ctx, sh, [-r, -r, 2 * r + 10, 2 * r + 10], { angle: -0.8, gap: 3.2, w: 1, alpha: 0.6, seed: 900 });
  ctx.fillStyle = CARD; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(spin);
  // 一块排线扇面 + 两道反光弧：转动时清楚可见
  const wedge = new Path2D(); wedge.moveTo(0, 0); wedge.arc(0, 0, r * 0.95, -0.42, 0.42); wedge.closePath();
  const ring = new Path2D(); ring.arc(0, 0, r * 0.95, 0, Math.PI * 2); ring.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.save(); ctx.clip(ring, 'evenodd'); hatch(ctx, wedge, [-r, -r, 2 * r, 2 * r], { angle: 0.3, gap: 3, w: 1, alpha: 0.85, seed: 901, wob: 0.3 }); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineCap = 'round';
  for (const [rr, a0, a1, w] of [[0.84, 2.3, 3.3, 1.2], [0.74, 2.5, 3.1, 1], [0.84, 4.6, 5.2, 1], [0.55, 3.9, 4.9, 0.9]]) {
    ctx.lineWidth = w * s; ctx.beginPath(); ctx.arc(0, 0, r * rr, a0, a1); ctx.stroke();
  }
  // 一圈细细的音轨
  ctx.globalAlpha = 0.45; ctx.lineWidth = 0.8;
  for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(0, 0, r * (0.4 + k * 0.045), 0, Math.PI * 2); ctx.stroke(); }
  ctx.globalAlpha = 1;
  pen(ctx, ellPts(0, 0, r, r, 60), { w: 2.6 * s, seed: 902, wob: 0.4, close: true });
  pen(ctx, ellPts(0, 0, r * 0.27, r * 0.27, 24), { w: 1.6 * s, seed: 903, wob: 0.3, close: true, fill: CARD });
  const hole = ellPts(0, 0, r * 0.1, r * 0.1, 16);
  pen(ctx, hole, { w: 1.3 * s, seed: 904, wob: 0.2, close: true, fill: '#ffffff' });
  hatch(ctx, polyPath(hole), [-r * 0.1, -r * 0.1, r * 0.2, r * 0.2], { angle: 0.8, gap: 2.2, w: 0.9, alpha: 0.8, seed: 905 });
  ctx.restore();
}
function penFrame(ctx, R) {
  // 钢笔线描的细框：纸色窄边、外中内三道线，右边和下边排线作阴影，四角一个小卷草
  const s = R.s, t = 46 * s, { x, y, w, h } = R;
  ctx.save();
  const band = new Path2D(); band.rect(x - t, y - t, w + 2 * t, h + 2 * t); band.rect(x, y, w, h);
  ctx.fillStyle = PAPER; ctx.fill(band, 'evenodd');
  const shade = new Path2D();
  shade.moveTo(x + w + t, y - t); shade.lineTo(x + w + t, y + h + t); shade.lineTo(x - t, y + h + t); shade.lineTo(x, y + h); shade.lineTo(x + w, y + h); shade.lineTo(x + w, y); shade.closePath();
  hatch(ctx, shade, [x - t, y - t, w + 2 * t, h + 2 * t], { angle: -0.8, gap: Math.max(2.5, 5 * s), w: Math.max(0.7, 1.1 * s), alpha: 0.55, seed: 950, wob: 0.6 * s, breaks: 0 });
  const o = { seed: 951, wob: 0.8 * s, step: 40 * s, color: INK };
  penRect(ctx, x - t, y - t, w + 2 * t, h + 2 * t, { ...o, w: Math.max(1.2, 2.6 * s) });
  penRect(ctx, x - t * 0.62, y - t * 0.62, w + t * 1.24, h + t * 1.24, { ...o, seed: 952, w: Math.max(0.8, 1.1 * s) });
  penRect(ctx, x - t * 0.5, y - t * 0.5, w + t, h + t, { ...o, seed: 953, w: Math.max(0.6, 0.8 * s), alpha: 0.7 });
  penRect(ctx, x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s, { ...o, seed: 954, w: Math.max(1.2, 2.4 * s) });
  // 四个角：小卷草
  for (const [cx, cy, sx, sy] of [[x - t * 0.26, y - t * 0.26, 1, 1], [x + w + t * 0.26, y - t * 0.26, -1, 1], [x - t * 0.26, y + h + t * 0.26, 1, -1], [x + w + t * 0.26, y + h + t * 0.26, -1, -1]]) {
    const q = [];
    for (let k = 0; k <= 16; k++) { const a = k * 0.45, rr = t * 0.2 * (1 - k / 22); q.push([cx + sx * Math.cos(a) * rr, cy + sy * Math.sin(a) * rr]); }
    pen(ctx, q, { w: Math.max(0.8, 1.3 * s), seed: 960, wob: 0 });
  }
  ctx.restore();
}

export const s06 = {
  id: 's06',
  station: ST,
  figureStyle: 'pen',
  freezeBeat: GAG + 1.5, // Outro 展墙：乌鸦正扭头看他
  drawBack(ctx, b, env) {
    const cam = env.cam, cg = env.camAt(GAG);
    const pw = Math.ceil((X_MAX - X_MIN) * K), ph = Math.ceil(1000 * K);
    ctx.drawImage(paperTexture(pw, ph, { base: PAPER, seed: 66, amount: 0.45, fibers: 90 }), X_MIN, 0, X_MAX - X_MIN, 1000);
    drawStrip(ctx, skyLayer(cg), cam);
    drawTwinkles(ctx, b, cam);
    drawStrip(ctx, farLayer(), cam);
    drawStrip(ctx, midLayer(cg), cam);
    drawStrip(ctx, groundLayer(), cam);
    const P = pianoImage();
    const px = PIANO_X + cg - cam;
    if (px + P.x0 < X_MAX && px + P.x0 + P.w > X_MIN) ctx.drawImage(P.canvas, px + P.x0, P.y0, P.w, P.h);
    figureShadow(ctx);
    drawCrows(ctx, b, env);
  },
  drawFront(ctx, b, env) {
    drawStrip(ctx, fgLayer(env.camAt(GAG)), env.cam);
  },
  drawFrame(ctx, R) { penFrame(ctx, R); },
  cardStyle: {
    ink: INK, accent: INK_M, bar: false,
    bgDraw(ctx, x, y, w, h) { penCard(ctx, x, y, w, h, 101, true); },
  },
  playerStyle: {
    ink: INK, noteColor: INK, backdrop: false,
    plateDraw(ctx, x, y, w, h) { penCard(ctx, x, y, w, h, 111, false); },
    drawPlayer(ctx, kind, cx, cy, s, spin) { penCD(ctx, cx, cy, s, spin); },
  },
};
