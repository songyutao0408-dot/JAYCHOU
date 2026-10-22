// 全片的行走距离与身体前倾。人物在屏幕上站位固定，世界向左平移；
// 过画框前半拍略微加速、前倾，进入新站后恢复。
import { WALK_SPEED } from './layout.js';
import { sections } from '../beat/time.js';

// 每个站的进场强拍（全局拍位）
export const DOWNBEATS = sections.filter((s) => s.station).map((s) => s.start);

const BOOST_FROM = -0.55, BOOST_LEN = 0.8, BOOST_AMP = 0.45; // 相对强拍：从前 0.55 拍开始，持续 0.8 拍
const sin2Integral = (x, L) => x / 2 - (L / (4 * Math.PI)) * Math.sin((2 * Math.PI * x) / L);

/** 累计行走距离（单位），对全局拍位 gb 连续可微。 */
export function dist(gb) {
  let d = WALK_SPEED * gb;
  for (const D of DOWNBEATS) {
    const x = gb - (D + BOOST_FROM);
    if (x <= 0) break;
    d += WALK_SPEED * BOOST_AMP * sin2Integral(Math.min(x, BOOST_LEN), BOOST_LEN);
  }
  return d;
}

/** 过框加速的强度 0..1（用于前倾）。 */
export function boost(gb) {
  for (const D of DOWNBEATS) {
    const x = gb - (D + BOOST_FROM);
    if (x >= 0 && x <= BOOST_LEN) return Math.sin((Math.PI * x) / BOOST_LEN) ** 2;
  }
  return 0;
}
