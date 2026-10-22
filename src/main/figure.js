// 人物在某个拍位的姿势：步态 + 过框前倾。所有场景共用，保证换风格时动作连续。
import { poseAt } from '../rig/skeleton.js';
import { dist, boost } from './walk.js';

export const WALK_START = 8; // Intro 第 3 小节第 1 拍开始走

export function figurePose(gb, look) {
  const walking = gb >= WALK_START;
  const g = walking ? gb : WALK_START;
  return poseAt(g, dist, {
    lean: 0.04 + look.posture + 0.13 * boost(gb),
    bounce: look.bounce,
    armK: look.armK,
    walking: true,
  });
}
