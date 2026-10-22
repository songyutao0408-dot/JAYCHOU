// 「刻线」共用渲染：第 7 站铜版、第 9 站石版共用的排线、刀刻和颗粒（第 5 站已改为铅笔速写，见 kit/sketch.js）。
// 都是 Canvas2D 操作，作用在 Path2D 形状上；建议在烘焙阶段（strip / baked）调用。
import { rng } from './rng.js';
import { noise2 } from './noise.js';
import { makeCanvas, memo } from './canvas.js';

/**
 * 在形状里画一组平行线（可抖动、粗细随 tone 变化）。
 * o.angle 弧度；o.gap 线距；o.width(x, y) → 线宽；o.wobble 抖动幅度；o.step 采样步长
 */
export function hatch(ctx, path, o = {}) {
  const { angle = 0, gap = 8, color = '#111', width = () => 1.5, wobble = 1.2, step = 6, seed = 1, bounds } = o;
  const [bx, by, bw, bh] = bounds || [-2000, -200, 6000, 1400];
  const c = Math.cos(angle), s = Math.sin(angle);
  const diag = Math.hypot(bw, bh);
  const cx = bx + bw / 2, cy = by + bh / 2;
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let d = -diag / 2; d <= diag / 2; d += gap) {
    let prev = null;
    for (let t = -diag / 2; t <= diag / 2; t += step) {
      const wob = (noise2(t * 0.01, d * 0.05, seed) - 0.5) * 2 * wobble;
      const x = cx + c * t - s * (d + wob), y = cy + s * t + c * (d + wob);
      if (prev) {
        const w = width(x, y);
        if (w > 0.05) {
          ctx.lineWidth = w;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(x, y); ctx.stroke();
        }
      }
      prev = [x, y];
    }
  }
  ctx.restore();
}

/**
 * 木刻：形状先涂满墨色，再按亮度刻出浅色线（越亮刻得越宽）。
 * o.tone(x, y) → 0..1 亮度；o.paper 刻掉后露出的纸色
 */
export function woodcut(ctx, path, o = {}) {
  const { ink = '#121110', paper = '#8f8a80', tone = () => 0.3, gap = 7, angle = 0, wobble = 2, seed = 3, bounds } = o;
  ctx.fillStyle = ink;
  ctx.fill(path);
  hatch(ctx, path, {
    angle, gap, wobble, seed, bounds, color: paper, step: 5,
    width: (x, y) => {
      const t = Math.min(1, Math.max(0, tone(x, y)));
      return t * gap * 0.82 * (0.85 + 0.3 * noise2(x * 0.02, y * 0.02, seed + 9));
    },
  });
}

/** 沿形状边缘刻一圈浅色细线（木刻里物体轮廓的「让刀」）。 */
export function carveEdge(ctx, path, { color = '#8f8a80', width = 2, offset = 3 } = {}) {
  ctx.save();
  ctx.clip(path);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash([14, 5, 6, 4]);
  ctx.translate(offset * 0.5, offset * 0.5);
  ctx.stroke(path);
  ctx.restore();
}

/** 石版 / 蜡笔颗粒：平铺的小噪点图（透明底，深色颗粒）。 */
export function grainPattern(ctx, { color = '20,18,30', density = 0.12, size = 256, seed = 7, alpha = 0.35 } = {}) {
  const tile = memo(`grain|${color}|${density}|${size}|${seed}|${alpha}`, () => {
    const c = makeCanvas(size, size);
    const x = c.getContext('2d');
    const im = x.createImageData(size, size);
    const R = rng('grain', seed);
    const [r, g, b] = color.split(',').map(Number);
    for (let i = 0; i < size * size; i++) {
      if (R() < density) {
        im.data[i * 4] = r; im.data[i * 4 + 1] = g; im.data[i * 4 + 2] = b;
        im.data[i * 4 + 3] = 255 * alpha * (0.4 + 0.6 * R());
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  });
  return ctx.createPattern(tile, 'repeat');
}

/** 石版点刻阴影：在形状里按 tone 撒点（越暗越密）。 */
export function stipple(ctx, path, { color = '#2b2a3a', tone = () => 0.5, density = 0.012, r = 1.4, seed = 5, bounds = [-2000, -200, 6000, 1400] } = {}) {
  const [bx, by, bw, bh] = bounds;
  const R = rng('stipple', seed);
  const n = Math.round(bw * bh * density);
  ctx.save();
  ctx.clip(path);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const x = bx + R() * bw, y = by + R() * bh;
    if (R() > 1 - tone(x, y)) continue;
    ctx.beginPath();
    ctx.arc(x, y, r * (0.6 + 0.6 * R()), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
