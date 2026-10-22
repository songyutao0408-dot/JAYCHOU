// 人物在某个拍位的状态：走路循环的相位、是否定格成站立姿势、前倾角。所有场景共用，换画风时动作连续。
import { boost, FREEZE } from './walk.js';

export const WALK_START = 8; // Intro 第 3 小节第 1 拍开始走

/**
 * @param {number} gb 全局拍位（量化站传入量化后的拍位）
 * @param {object} env 段落环境（station 段在第 5～6 拍定格）
 */
export function figureState(gb, env = {}) {
  const b = gb - (env.sec ? env.sec.start : 0);
  const frozen = !!(env.sec && env.sec.station && b >= FREEZE[0] && b < FREEZE[1]);
  return {
    pose: frozen ? 'stand' : 'walk',
    phase: Math.max(0, gb - WALK_START), // 循环内拍位：第 3 小节强拍起，偶数拍和奇数拍各落一只脚
    lean: 0.06 * boost(gb),
  };
}
