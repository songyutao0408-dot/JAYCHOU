// 铅笔速写共用工具（第 5 站起用）：
//   - sketchStrip：视差长条，Canvas2D 画「纸色垫底」（遮住后面的层），p5.brush 画铅笔线，合成一张图
//   - washStrip：视差长条，p5.brush 水彩填色（透明底），合成时用 multiply 叠在铅笔线上
//   - sketchPoly / sketchEllipse / sketchLine：Canvas2D 的手绘抖动线（每帧要画的小物件、标题卡、播放器用）
// 抖动都由 seed 决定，同一时刻每次画都一样。
import { baked } from './canvas.js';
import { bakeBrush, brushAvailable } from './brush.js';
import { hash2 } from './rng.js';
import { K } from '../main/layout.js';
import { stripRange } from './strip.js';

/** 单位坐标的长条：fills(ctx) 用 Canvas2D 画垫底，lines(B) 用 p5.brush 画铅笔线。 */
export function sketchStrip(key, p, { fills, lines, y0 = 0, y1 = 1000 }) {
  const [x0, x1] = stripRange(p);
  const w = (x1 - x0) * K, h = (y1 - y0) * K;
  const brushLayer = lines ? brushStrip(`${key}|lines`, x0, y0, w, h, lines, x1) : null;
  const canvas = baked(`sketch|${key}|${p}`, w, h, (ctx) => {
    ctx.save();
    ctx.scale(K, K);
    ctx.translate(-x0, -y0);
    if (fills) fills(ctx, x0, x1);
    ctx.restore();
    if (brushLayer) ctx.drawImage(brushLayer, 0, 0);
  });
  return { canvas, x0, x1, y0, y1, p };
}

/** 单位坐标的水彩长条（透明底）。 */
export function washStrip(key, p, { wash, y0 = 0, y1 = 1000 }) {
  const [x0, x1] = stripRange(p);
  const w = (x1 - x0) * K, h = (y1 - y0) * K;
  const canvas = brushStrip(`${key}|wash`, x0, y0, w, h, wash, x1);
  return { canvas, x0, x1, y0, y1, p };
}

function brushStrip(key, x0, y0, w, h, draw, x1) {
  return bakeBrush(`bstrip|${key}`, w, h, (B) => {
    B.scale(K, K);
    B.translate(-x0, -y0);
    draw(B, x0, x1);
  });
}

// ---------- 手绘抖动线（Canvas2D） ----------
const jit = (i, k, seed, amp) => (hash2(i, k, seed) - 0.5) * 2 * amp;

/** 折线 / 多边形：每条边单独画、两端略微出头，叠两遍。 */
export function sketchPoly(ctx, pts, { close = true, seed = 1, color = '#5c564e', width = 1.6, passes = 2, jitter = 1.2, over = 5, alpha = 0.85 } = {}) {
  const n = pts.length, segs = close ? n : n - 1;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let p = 0; p < passes; p++) {
    ctx.globalAlpha *= p ? alpha * 0.7 : alpha;
    ctx.lineWidth = width * (p ? 0.7 : 1);
    for (let i = 0; i < segs; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      const ux = dx / L, uy = dy / L;
      const o1 = over * (0.3 + hash2(i, p, seed + 7)), o2 = over * (0.3 + hash2(i, p, seed + 8));
      const ax = a[0] - ux * o1 + jit(i, p * 4, seed, jitter), ay = a[1] - uy * o1 + jit(i, p * 4 + 1, seed, jitter);
      const bx = b[0] + ux * o2 + jit(i, p * 4 + 2, seed, jitter), by = b[1] + uy * o2 + jit(i, p * 4 + 3, seed, jitter);
      const mx = (ax + bx) / 2 + jit(i, p * 4 + 9, seed, jitter * 1.4), my = (ay + by) / 2 + jit(i, p * 4 + 10, seed, jitter * 1.4);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo(mx, my, bx, by); ctx.stroke();
    }
  }
  ctx.restore();
}
export function ellipsePts(cx, cy, rx, ry, n = 28, rot = 0, a0 = 0, a1 = Math.PI * 2) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]);
  }
  return pts;
}
export function sketchEllipse(ctx, cx, cy, rx, ry, o = {}) {
  sketchPoly(ctx, ellipsePts(cx, cy, rx, ry, 24, o.rot || 0), { ...o, close: false, over: 2 });
}
export const sketchLine = (ctx, a, b, o = {}) => sketchPoly(ctx, [a, b], { ...o, close: false });

/** 在矩形区域里画一组斜向排线（铅笔阴影）。 */
export function sketchHatch(ctx, x, y, w, h, { angle = 0.9, gap = 6, color = '#7a746a', width = 1, alpha = 0.6, seed = 3 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.globalAlpha *= alpha;
  const c = Math.cos(angle), s = Math.sin(angle), D = Math.hypot(w, h);
  let i = 0;
  for (let d = -D; d <= D; d += gap, i++) {
    const cx = x + w / 2 - s * d, cy = y + h / 2 + c * d;
    ctx.beginPath();
    ctx.moveTo(cx - c * D + jit(i, 1, seed, 1.5), cy - s * D + jit(i, 2, seed, 1.5));
    ctx.lineTo(cx + c * D + jit(i, 3, seed, 1.5), cy + s * D + jit(i, 4, seed, 1.5));
    ctx.stroke();
  }
  ctx.restore();
}

export { brushAvailable };
