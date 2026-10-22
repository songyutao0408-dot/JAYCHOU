// 视差长条：把一层静态背景预先画成一张很宽的离屏图，之后每帧按镜头位置平移。
// 场景里的一层 = 一个视差系数 p：画面 x = 层内 x − cam × p。
// 长条覆盖整站会用到的范围（转场前 2 拍到离场后 0.4 拍、以及 Outro 的定格），按 key 缓存。
import { baked } from './canvas.js';
import { K, X_MIN, X_MAX } from '../main/layout.js';

const CAM_MIN = -520, CAM_MAX = 1650; // 一站里镜头平移的大致范围（单位）

/**
 * strip('s02-wall', 0.85, (ctx, x0, x1) => { ...用层内单位坐标作画... })
 * @returns {{canvas, x0, x1, p}}
 */
export function strip(key, p, draw, { y0 = 0, y1 = 1000, res = 1 } = {}) {
  const x0 = Math.floor(X_MIN + CAM_MIN * p) - 20, x1 = Math.ceil(X_MAX + CAM_MAX * p) + 20;
  const s = K * res;
  const canvas = baked(`strip|${key}|${p}|${y0}|${y1}|${res}`, (x1 - x0) * s, (y1 - y0) * s, (ctx) => {
    ctx.scale(s, s);
    ctx.translate(-x0, -y0);
    draw(ctx, x0, x1);
  });
  return { canvas, x0, x1, y0, y1, p };
}

/** 在单位空间里画一条长条。 */
export function drawStrip(ctx, S, cam) {
  ctx.drawImage(S.canvas, S.x0 - cam * S.p, S.y0, S.x1 - S.x0, S.y1 - S.y0);
}

/** 层内需要覆盖的 x 范围（给按间隔重复的元素用）。 */
export const stripRange = (p) => [Math.floor(X_MIN + CAM_MIN * p) - 20, Math.ceil(X_MAX + CAM_MAX * p) + 20];
