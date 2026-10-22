// 年龄 → 外观参数。分四档，档内按年龄平滑过渡。
//   A 21–24 偏瘦，侧分刘海，白 T 恤 + 敞开的格子衬衫，帆布鞋
//   B 25–29 短发利落，黑色夹克，身板更挺
//   C 31–37 背头，淡胡茬，细框眼镜，针织开衫
//   D 43–47 鬓角微白，胡茬明显，长风衣，步伐从容
import { clamp, lerp } from '../kit/math.js';
import { tierOf } from '../data/stations.js';

const RANGE = { A: [21, 24], B: [25, 29], C: [31, 37], D: [43, 47] };

export function lookFor(age) {
  const tier = tierOf(age);
  const [a0, a1] = RANGE[tier];
  const t = clamp((age - a0) / (a1 - a0));
  const L = { age, tier, t };
  switch (tier) {
    case 'A':
      Object.assign(L, {
        build: lerp(0.86, 0.93, t), posture: lerp(-0.01, 0.0, t),
        hair: 'fringe', hairVol: lerp(1.0, 0.9, t),
        stubble: 0, grey: 0, glasses: false,
        outfit: 'tee-plaid', shoes: 'canvas', bounce: 1.15, armK: 1.05,
        colors: { top: '#f7f5ef', outer: '#3f6fae', outer2: '#c8423b', pants: '#4a5d7a', shoe: '#f2f0e8', sole: '#d8d2c4', hair: '#1c1a19' },
      });
      break;
    case 'B':
      Object.assign(L, {
        build: lerp(0.97, 1.02, t), posture: lerp(0.0, 0.01, t),
        hair: 'short', hairVol: lerp(0.9, 0.82, t),
        stubble: 0, grey: 0, glasses: false,
        outfit: 'jacket', shoes: 'sneaker', bounce: 1.0, armK: 1.0,
        colors: { top: '#e9e6df', outer: '#1d1f24', outer2: '#2d3038', pants: '#2e3442', shoe: '#22252b', sole: '#e8e6e0', hair: '#191817' },
      });
      break;
    case 'C':
      Object.assign(L, {
        build: lerp(1.03, 1.08, t), posture: 0.01,
        hair: 'slick', hairVol: lerp(0.86, 0.8, t),
        stubble: lerp(0.25, 0.5, t), grey: lerp(0, 0.08, t), glasses: true,
        outfit: 'cardigan', shoes: 'loafer', bounce: 0.9, armK: 0.92,
        colors: { top: '#efe9dc', outer: '#7a6a58', outer2: '#5f5244', pants: '#3b3a3f', shoe: '#6b4529', sole: '#3a2a1f', hair: '#1d1b1a' },
      });
      break;
    default:
      Object.assign(L, {
        build: lerp(1.08, 1.1, t), posture: lerp(0.015, 0.02, t),
        hair: 'slick-grey', hairVol: lerp(0.82, 0.78, t),
        stubble: lerp(0.7, 0.85, t), grey: lerp(0.35, 0.6, t), glasses: false,
        outfit: 'trench', shoes: 'leather', bounce: 0.7, armK: 0.78,
        colors: { top: '#e6e1d6', outer: '#a68a62', outer2: '#8a7150', pants: '#2f2e33', shoe: '#2b211b', sole: '#16110e', hair: '#22201e' },
      });
  }
  return L;
}
