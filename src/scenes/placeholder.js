// 第一阶段的占位场景：按调色板画天空、三层视差、路面，标出站名和画风；
// 第 5–6 拍（梗的位置）亮起一个提示。正式场景做好后逐个替换。
import { X_MIN, X_MAX, ROAD_Y, CHAR_X } from '../main/layout.js';
import { mix, rgba, readableOn } from '../kit/color.js';
import { rng } from '../kit/rng.js';
import { font, SERIF, SANS } from '../kit/text.js';
import { roundRect, circle, poly } from '../kit/shapes.js';
import { pulse, smoothstep } from '../kit/math.js';
import { SB } from '../beat/time.js';

export function placeholderScene(st) {
  const [bg, mid, ink, acc] = st.palette;
  const dark = ['#1c2140', '#2a2622', '#1b2230', '#5b5852'].includes(bg);
  const far = mix(bg, mid, 0.35), near = mix(mid, ink, 0.25), road = mix(mid, ink, 0.45);

  // 一层沿 x 无限重复的形状，parallax 为视差系数
  function layer(ctx, cam, parallax, spacing, seedKey, drawOne) {
    const off = cam * parallax;
    const i0 = Math.floor((X_MIN + off) / spacing) - 1, i1 = Math.ceil((X_MAX + off) / spacing) + 1;
    for (let i = i0; i <= i1; i++) drawOne(i * spacing - off, rng(st.id, seedKey, i));
  }

  return {
    id: st.id,
    station: st,
    // 占位阶段身体不按画风变色，头像也保持原样，保证肤色一致；正式场景再按画风处理（见 heads-check）
    figureStyle: () => ({ headTreatment: { type: 'none' } }),
    drawBack(ctx, b, env) {
      const cam = env.cam;
      // 天空
      const g = ctx.createLinearGradient(0, 0, 0, ROAD_Y);
      g.addColorStop(0, mix(bg, mid, dark ? 0.15 : 0.05));
      g.addColorStop(1, mix(bg, mid, dark ? 0.45 : 0.3));
      ctx.fillStyle = g;
      ctx.fillRect(X_MIN - 2, 0, X_MAX - X_MIN + 4, ROAD_Y + 2);
      // 远景
      layer(ctx, cam, 0.2, 230, 'far', (x, R) => {
        const h = R.range(120, 260);
        ctx.fillStyle = far;
        roundRect(ctx, x, ROAD_Y - 120 - h, R.range(120, 200), h + 130, 18);
        ctx.fill();
      });
      // 中景
      layer(ctx, cam, 0.55, 310, 'mid', (x, R) => {
        const h = R.range(150, 300);
        ctx.fillStyle = mix(far, near, 0.55);
        poly(ctx, [[x, ROAD_Y], [x + 40, ROAD_Y - h], [x + 110, ROAD_Y - h + 30], [x + 150, ROAD_Y]]);
        ctx.fill();
      });
      // 站名水印（占位用）
      ctx.save();
      font(ctx, 46, { family: SANS, weight: 700 });
      ctx.textAlign = 'center';
      ctx.fillStyle = rgba(readableOn(bg, ink), 0.55);
      ctx.fillText(`占位 · 第 ${st.n} 站 · ${st.style}`, 690, 330);
      font(ctx, 40, { family: SERIF, weight: 400 });
      ctx.fillText(`场景：${st.scene}`, 690, 390);
      ctx.restore();
      // 路面
      ctx.fillStyle = road;
      ctx.fillRect(X_MIN - 2, ROAD_Y, X_MAX - X_MIN + 4, 1000 - ROAD_Y + 2);
      ctx.fillStyle = mix(road, ink, 0.35);
      ctx.fillRect(X_MIN - 2, ROAD_Y, X_MAX - X_MIN + 4, 6);
      // 路面虚线：和世界一起平移，用来检查脚步是否打滑
      layer(ctx, cam, 1, 120, 'dash', (x) => {
        ctx.fillStyle = rgba(bg, 0.55);
        ctx.fillRect(x, ROAD_Y + 60, 60, 8);
      });
      // 路边的柱子（与人物同一深度）
      layer(ctx, cam, 1, 520, 'post', (x, R) => {
        ctx.fillStyle = near;
        ctx.fillRect(x, ROAD_Y - 260, 16, 262);
        circle(ctx, x + 8, ROAD_Y - 268, 22);
        ctx.fillStyle = acc;
        ctx.fill();
      });
    },
    drawFront(ctx, b, env) {
      // 梗的位置：第 5–6 拍
      const k = smoothstep(SB(5) - 0.15, SB(5) + 0.1, b) * (1 - smoothstep(SB(7) - 0.2, SB(7), b));
      if (k <= 0.01) return;
      const pul = 1 + 0.08 * pulse(SB(5), SB(6), b) + 0.08 * pulse(SB(6), SB(7), b);
      ctx.save();
      ctx.globalAlpha = k;
      ctx.translate(CHAR_X, ROAD_Y - 190);
      ctx.scale(pul, pul);
      ctx.strokeStyle = acc;
      ctx.lineWidth = 8;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 210, Math.sin(a) * 210);
        ctx.lineTo(Math.cos(a) * 250, Math.sin(a) * 250);
        ctx.stroke();
      }
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = k;
      font(ctx, 38, { family: SANS, weight: 700 });
      const lines = wrap(ctx, `第 2 小节的梗：${st.gag}`, 760);
      const x = 520, y = 470;
      roundRect(ctx, x - 24, y - 54, 808, lines.length * 52 + 40, 12);
      ctx.fillStyle = rgba(mix(bg, '#ffffff', 0.5), 0.92);
      ctx.fill();
      ctx.strokeStyle = acc; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = ink;
      lines.forEach((l, i) => ctx.fillText(l, x, y + i * 52));
      ctx.restore();
    },
  };
}

function wrap(ctx, str, maxW) {
  const out = [];
  let line = '';
  for (const ch of str) {
    if (ctx.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}
