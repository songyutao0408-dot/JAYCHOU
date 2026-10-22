// 颜色工具：hex ⇄ rgb、混色、亮度。
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
export const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) {
  const A = hexToRgb(a), Bc = hexToRgb(b);
  return rgbToHex(A.map((x, i) => x + (Bc[i] - x) * t));
}
export function rgba(hex, a = 1) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};
/** 全片共用的锚点颜色：红耳机。 */
export const HEADPHONE_RED = '#d8262e';

/** 在底色上可读的文字色：底色暗就用浅色，否则用给定的深色。 */
export const readableOn = (bg, dark, light = '#f4efe4') => (luminance(bg) < 0.42 ? light : dark);
