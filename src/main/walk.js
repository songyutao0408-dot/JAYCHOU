// 全片的行走距离（镜头平移）。人物在屏幕上站位固定，世界向左平移。
//   - 平移速度由走路视频里支撑脚后退的速度决定（walker.walkSpeedOf），脚不打滑
//   - 每站第 5～6 拍人物定格成站立姿势，镜头同时停住
//   - 过画框前半拍略微加速（人物同时略微前倾），进入新站后恢复
// 速度是分段函数，这里预先按 1/64 拍积分成表，dist(gb) 查表插值，仍是拍位的纯函数。
import { sections, TOTAL_BEATS, SB } from '../beat/time.js';

export const DOWNBEATS = sections.filter((s) => s.station).map((s) => s.start);
export const FREEZE = [SB(5), SB(7)]; // 每站第 5～6 拍

const BOOST_FROM = -0.55, BOOST_LEN = 0.8, BOOST_AMP = 0.45;
const RAMP = 0.2; // 定格前后镜头减速 / 加速用的拍数

let speed = 105;
let table = null;
const RES = 64;

export function setWalkSpeed(v) {
  speed = v;
  table = null;
}
export const walkSpeed = () => speed;

/** 过框加速的强度 0..1（用于前倾）。 */
export function boost(gb) {
  for (const D of DOWNBEATS) {
    const x = gb - (D + BOOST_FROM);
    if (x >= 0 && x <= BOOST_LEN) return Math.sin((Math.PI * x) / BOOST_LEN) ** 2;
  }
  return 0;
}
/** 是否处在某站的定格（第 5～6 拍）里：返回 0..1（两端有短暂的减速/加速）。 */
export function pauseAmount(gb) {
  for (const D of DOWNBEATS) {
    const x = gb - D;
    if (x < FREEZE[0] - RAMP || x > FREEZE[1] + RAMP) continue;
    if (x < FREEZE[0]) return (x - (FREEZE[0] - RAMP)) / RAMP;
    if (x > FREEZE[1]) return 1 - (x - FREEZE[1]) / RAMP;
    return 1;
  }
  return 0;
}
const rate = (gb) => speed * (1 + BOOST_AMP * boost(gb)) * (1 - pauseAmount(gb));

function build() {
  const n = Math.ceil((TOTAL_BEATS + 8) * RES);
  table = new Float64Array(n + 1);
  let acc = 0;
  for (let i = 0; i < n; i++) {
    table[i] = acc;
    acc += rate((i + 0.5) / RES) / RES;
  }
  table[n] = acc;
}

/** 累计行走距离（单位）。 */
export function dist(gb) {
  if (!table) build();
  if (gb <= 0) return speed * gb;
  const x = gb * RES, i = Math.floor(x);
  if (i >= table.length - 1) return table[table.length - 1] + speed * (gb - (table.length - 1) / RES);
  return table[i] + (table[i + 1] - table[i]) * (x - i);
}
