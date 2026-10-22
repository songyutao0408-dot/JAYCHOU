// 镜头：每站第 1 拍（进场强拍）轻微推近一下再回来。
import { ease, clamp } from '../kit/math.js';
import { DOWNBEATS } from './walk.js';

export const PUSH_AMOUNT = 0.035;

/** 当前推近量 0..1 */
export function pushAt(gb) {
  for (const D of DOWNBEATS) {
    const u = gb - D;
    if (u >= 0 && u < 1.4) {
      const t = clamp(u / 1.4);
      return t < 0.18 ? ease.out(t / 0.18) : 1 - ease.inOut((t - 0.18) / 0.82);
    }
  }
  return 0;
}
