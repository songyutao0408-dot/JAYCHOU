// 小工具：插值、缓动、取值约束。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, clamp(invLerp(a, b, x)));
export const smoothstep = (a, b, x) => {
  const t = clamp(invLerp(a, b, x));
  return t * t * (3 - 2 * t);
};
export const ease = {
  inOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t) => 1 - Math.pow(1 - t, 3),
  in: (t) => t * t * t,
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
};
/** 关键帧插值：keys = [[x0, y0], [x1, y1, 段缓动?], ...]（x 递增）。
 *  每段的缓动取该段终点 key 的第三项，没有就用 easeFn。 */
export function keyframes(keys, x, easeFn = (t) => t) {
  if (x <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (x <= keys[i][0]) {
      const [x0, y0] = keys[i - 1], [x1, y1] = keys[i];
      return lerp(y0, y1, (keys[i][2] || easeFn)(invLerp(x0, x1, x)));
    }
  }
  return keys[keys.length - 1][1];
}
/** 0→1→0 的单峰脉冲，在 [a, b] 内。 */
export const pulse = (a, b, x) => {
  const t = clamp(invLerp(a, b, x));
  return Math.sin(Math.PI * t);
};
export const TAU = Math.PI * 2;
