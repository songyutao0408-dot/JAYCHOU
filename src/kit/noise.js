// 确定性的值噪声与分形噪声（不依赖 p5 的全局 noiseSeed）。
import { hash2 } from './rng.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = fade(xf), v = fade(yf);
  const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, seed = 0, oct = 4) {
  let s = 0, amp = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) {
    s += amp * noise2(x * f, y * f, seed + i * 17);
    n += amp;
    amp *= 0.5;
    f *= 2.03;
  }
  return s / n;
}
/** 1D 噪声，-1..1 */
export const noise1 = (x, seed = 0) => noise2(x, 0.5, seed) * 2 - 1;
