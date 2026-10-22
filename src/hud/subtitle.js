// 居中字幕（衬线体），带淡入淡出。
import { font, SERIF } from '../kit/text.js';
import { rgba } from '../kit/color.js';

export function drawSubtitle(ctx, str, x, y, alpha, { px = 56, color = '#2a241d', family = SERIF, weight = 400, shadow = null } = {}) {
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  font(ctx, px, { family, weight });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if (shadow) { ctx.shadowColor = rgba(shadow, 0.6); ctx.shadowBlur = 12; }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.restore();
}
