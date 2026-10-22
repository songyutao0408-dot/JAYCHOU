// 左上角标题卡：专辑中文名、英文名、年份。字号不小于 36px（1080p）。
// 各站可以传 style 覆盖外观，让标题卡符合该站画风。
import { font, SERIF, SANS, MIN_TEXT_PX } from '../kit/text.js';
import { roundRect } from '../kit/shapes.js';
import { clamp, ease, smoothstep } from '../kit/math.js';
import { rgba, readableOn } from '../kit/color.js';

/** 标题卡出现/消失进度：第 1–2 拍滑入，第 8 拍前半淡出。 */
export const cardIn = (b) => ease.out(clamp(b / 1.1)) * (1 - smoothstep(7.25, 7.85, b));

export function drawTitleCard(ctx, st, b, style = {}) {
  const k = cardIn(b);
  if (k <= 0.001) return;
  const S = {
    bg: st.palette[0], ink: readableOn(st.palette[0], st.palette[2]), accent: st.palette[3], border: readableOn(st.palette[0], st.palette[2], st.palette[1]),
    family: SERIF, enFamily: SERIF, radius: 6, opacity: 0.94, ...style,
  };
  const zhPx = 60, enPx = Math.max(MIN_TEXT_PX, 36), yrPx = 36;
  ctx.save();
  font(ctx, zhPx, { family: S.family, weight: 700 });
  const wZh = ctx.measureText(st.albumZh).width;
  font(ctx, enPx, { family: S.enFamily, weight: 400, italic: true });
  const wEn = ctx.measureText(st.albumEn).width;
  const w = Math.max(wZh, wEn + 130) + 72;
  const h = 196;
  const x = 56 - (1 - k) * 60, y = 48;
  ctx.globalAlpha = k;
  if (S.bgDraw) {
    // 各站自定义的卡片外观（泥板、木刻印章、海报缎带……）
    S.bgDraw(ctx, x, y, w, h, b);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;
    roundRect(ctx, x, y, w, h, S.radius);
    ctx.fillStyle = rgba(S.bg, S.opacity);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 3;
    ctx.strokeStyle = S.border;
    ctx.stroke();
  }
  // 强调色竖条
  ctx.fillStyle = S.accent;
  if (S.bar !== false) ctx.fillRect(x + 20, y + 26, 7, h - 52);
  ctx.fillStyle = S.ink;
  ctx.textBaseline = 'alphabetic';
  font(ctx, zhPx, { family: S.family, weight: 700 });
  ctx.fillText(st.albumZh, x + 44, y + 86);
  font(ctx, enPx, { family: S.enFamily, weight: 400, italic: true });
  ctx.fillText(st.albumEn, x + 44, y + 140);
  font(ctx, yrPx, { family: SANS, weight: 700 });
  ctx.textAlign = 'right';
  ctx.fillStyle = S.accent;
  ctx.fillText(String(st.year), x + w - 26, y + 140);
  ctx.restore();
}
