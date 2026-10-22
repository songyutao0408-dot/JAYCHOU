// 参数化骨骼木偶：侧面朝右（+x 向前，y 向下），根点 (0,0) 在两脚之间的地面上。
// 步态完全由「全局拍位 gb」和「累计行走距离 dist(gb)」决定：
//   - 一拍迈一步，两拍一个完整循环；近侧脚在偶数拍落地，远侧脚在奇数拍落地
//   - 支撑脚相对世界不动（随镜头平移等速后退），所以换速时也不会打滑
import { clamp, lerp, TAU } from '../kit/math.js';

export const BONES = {
  thigh: 80, shin: 78, ankle: 8, foot: 34,
  torso: 100, neck: 12, head: 62,
  upperArm: 60, forearm: 54, hand: 13,
};
export const HIP_H = BONES.thigh + BONES.shin + BONES.ankle - 4; // 略屈膝

const STANCE = 1.12; // 支撑相占 1.12 拍（双支撑重叠 0.12 拍）

function legIK(hip, ankle, L1, L2) {
  let dx = ankle[0] - hip[0], dy = ankle[1] - hip[1];
  let d = Math.hypot(dx, dy);
  const maxD = (L1 + L2) * 0.999;
  if (d > maxD) {
    ankle = [hip[0] + (dx / d) * maxD, hip[1] + (dy / d) * maxD];
    dx = ankle[0] - hip[0]; dy = ankle[1] - hip[1]; d = maxD;
  }
  const th = Math.atan2(dy, dx);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  const knee = [hip[0] + L1 * Math.cos(th - a), hip[1] + L1 * Math.sin(th - a)];
  return { knee, ankle };
}

/** 单只脚在拍位 gb 时相对髋部的位置（x）、抬脚高度、脚尖角度。 */
function footState(gb, offset, dist, liftK) {
  const c = (((gb - offset) % 2) + 2) % 2;
  const plantBeat = gb - c;
  // 落地点在髋前「支撑期行进距离的一半」，这样支撑脚正好从髋前滑到髋后
  const half = (b0) => (dist(b0 + STANCE) - dist(b0)) / 2;
  if (c <= STANCE) {
    const x = half(plantBeat) - (dist(gb) - dist(plantBeat));
    const roll = c < 0.15 ? -0.25 * (1 - c / 0.15) : c > STANCE - 0.3 ? 0.45 * ((c - (STANCE - 0.3)) / 0.3) : 0;
    return { x, lift: 0, toe: roll, stance: true };
  }
  const liftBeat = plantBeat + STANCE;
  const x0 = half(plantBeat) - (dist(liftBeat) - dist(plantBeat));
  const x1 = half(plantBeat + 2);
  const u = (c - STANCE) / (2 - STANCE);
  const s = u * u * (3 - 2 * u);
  const lift = (Math.sin(Math.PI * u) * 22 + Math.sin(Math.PI * Math.min(1, u * 1.6)) * 6) * liftK;
  return { x: lerp(x0, x1, s), lift, toe: lerp(0.45, -0.25, s), stance: false };
}

/**
 * 计算姿势。
 * @param {number} gb 全局拍位
 * @param {(b:number)=>number} dist 累计行走距离（单位：场景单位）
 * @param {object} o  lean：前倾弧度；strideK：抬脚与摆臂幅度；bounce：起伏系数；walking：是否在走
 */
export function poseAt(gb, dist, o = {}) {
  const { lean = 0.05, strideK = 1, bounce = 1, walking = true, armK = 1 } = o;
  const B = BONES;
  const frac = ((gb % 1) + 1) % 1;
  const bob = walking ? (-Math.cos(frac * TAU) * 0.5 + 0.5) * 7 * bounce : 0; // 0 落地最低 → 中段最高
  const hip = [0, -HIP_H - bob + 3];

  const near = walking ? footState(gb, 0, dist, strideK) : { x: 6, lift: 0, toe: 0, stance: true };
  const far = walking ? footState(gb, 1, dist, strideK) : { x: -6, lift: 0, toe: 0, stance: true };
  const leg = (f) => {
    const ankle = [hip[0] + f.x, -B.ankle - f.lift];
    const { knee, ankle: a } = legIK(hip, ankle, B.thigh, B.shin);
    const toe = [a[0] + Math.cos(f.toe) * B.foot * 0.78, a[1] + B.ankle - 1 + Math.sin(f.toe) * B.foot * 0.78];
    const heel = [a[0] - Math.cos(f.toe) * B.foot * 0.22, a[1] + B.ankle - 1 - Math.sin(f.toe) * B.foot * 0.22];
    return { hip: [...hip], knee, ankle: a, toe, heel, stance: f.stance };
  };
  const legs = { near: leg(near), far: leg(far) };

  // 躯干：从髋向上，按前倾角旋转（lean>0 向前倾）
  const tilt = lean + (walking ? Math.sin(frac * TAU) * 0.01 : 0);
  const up = [Math.sin(tilt), -Math.cos(tilt)];
  const chest = [hip[0] + up[0] * B.torso * 0.62, hip[1] + up[1] * B.torso * 0.62];
  const shoulder = [hip[0] + up[0] * B.torso, hip[1] + up[1] * B.torso];
  const neckTop = [shoulder[0] + up[0] * B.neck + 3, shoulder[1] + up[1] * B.neck];
  const headTilt = tilt * 0.5 + (walking ? Math.sin(frac * TAU + 0.6) * 0.012 : 0);

  // 手臂：与对侧腿反向摆动
  const cNear = walking ? ((gb % 2) + 2) % 2 : 0.5;
  const arm = (side) => {
    const ph = side === 'near' ? cNear : cNear + 1;
    const swing = walking ? -Math.cos(Math.PI * ph) * 0.42 * strideK * armK : 0;
    const a1 = swing + tilt * 0.6;
    const bend = 0.22 + Math.max(0, swing) * 0.9;
    const sh = [shoulder[0] + (side === 'near' ? 2 : -3), shoulder[1] + 4];
    const elbow = [sh[0] + Math.sin(a1) * B.upperArm, sh[1] + Math.cos(a1) * B.upperArm];
    const a2 = a1 + bend;
    const wrist = [elbow[0] + Math.sin(a2) * B.forearm, elbow[1] + Math.cos(a2) * B.forearm];
    const hand = [wrist[0] + Math.sin(a2) * B.hand * 0.6, wrist[1] + Math.cos(a2) * B.hand * 0.6];
    return { shoulder: sh, elbow, wrist, hand, angle: a2 };
  };
  const arms = { near: arm('near'), far: arm('far') };

  return { hip, chest, shoulder, neckTop, tilt, headTilt, up, legs, arms, gb };
}
