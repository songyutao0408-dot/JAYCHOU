// 「穿过画框」转场里的画框外观。默认是一副描金画框；各站可以提供自己的 drawFrame。
// rect：画框内沿（像素），s：当前缩放（边框粗细随之变化）。
import { mix } from '../kit/color.js';

export function drawDefaultFrame(ctx, rect, s, o = {}) {
  const { gold = '#c9a24a', dark = '#5e4520', light = '#f3dc8e' } = o;
  const t = 64 * s; // 边框宽度
  const { x, y, w, h } = rect;
  ctx.save();
  // 投在路面上的影子
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + t * 0.9, w * 0.55, t * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // 外框（四条斜接的梯形）
  const outer = [x - t, y - t, w + 2 * t, h + 2 * t];
  const sides = [
    { pts: [[x - t, y - t], [x + w + t, y - t], [x + w, y], [x, y]], c: light },
    { pts: [[x + w + t, y - t], [x + w + t, y + h + t], [x + w, y + h], [x + w, y]], c: gold },
    { pts: [[x + w + t, y + h + t], [x - t, y + h + t], [x, y + h], [x + w, y + h]], c: dark },
    { pts: [[x - t, y + h + t], [x - t, y - t], [x, y], [x, y + h]], c: mix(gold, light, 0.4) },
  ];
  for (const sd of sides) {
    ctx.beginPath();
    sd.pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.closePath();
    ctx.fillStyle = sd.c;
    ctx.fill();
  }
  // 雕花凹槽与内沿
  ctx.strokeStyle = 'rgba(70,45,10,0.55)';
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.strokeRect(x - t * 0.62, y - t * 0.62, w + t * 1.24, h + t * 1.24);
  ctx.strokeStyle = 'rgba(255,240,190,0.6)';
  ctx.strokeRect(x - t * 0.3, y - t * 0.3, w + t * 0.6, h + t * 0.6);
  ctx.lineWidth = Math.max(1, 5 * s);
  ctx.strokeStyle = dark;
  ctx.strokeRect(x - 2 * s, y - 2 * s, w + 4 * s, h + 4 * s);
  ctx.strokeStyle = 'rgba(40,25,5,0.8)';
  ctx.lineWidth = Math.max(1, 2 * s);
  ctx.strokeRect(...outer);
  // 四角的小圆饰
  ctx.fillStyle = light;
  for (const [cx, cy] of [[x - t / 2, y - t / 2], [x + w + t / 2, y - t / 2], [x - t / 2, y + h + t / 2], [x + w + t / 2, y + h + t / 2]]) {
    ctx.beginPath(); ctx.arc(cx, cy, t * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, 2 * s); ctx.stroke();
  }
  ctx.restore();
}
