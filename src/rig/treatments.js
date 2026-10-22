// 头像素材按画风的默认处理方式（某站专用素材同样会经过这里，除非该站自己指定）。
//   皮影 → 剪影 + 镂空；木刻 / 铜版 / 石版 → 刻线排线；水墨 → 灰度晕染；其余 → 调色板色调映射
import { mix } from '../kit/color.js';

const LINES = { 5: '#0e0d0c', 7: '#2a2219', 9: '#2b2a3a' };

export function headTreatmentFor(st) {
  const [bg, mid, ink] = st.palette;
  if (st.n === 11) return { type: 'silhouette', color: '#3a1d10' };
  if (LINES[st.n]) return { type: 'lines', color: LINES[st.n], paper: st.n === 5 ? '#f6f4ee' : mix(bg, '#ffffff', 0.3) };
  if (st.n === 3) return { type: 'ink', palette: ['#1d1d1b', '#8d8a82', '#f2eee3'] };
  return { type: 'tone', palette: [ink, mix(mid, '#e8c8a8', 0.5), mix(bg, '#ffffff', 0.5)] };
}
