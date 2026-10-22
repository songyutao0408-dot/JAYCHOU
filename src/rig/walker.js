// 人物：从绿幕视频里提取的走路循环（assets/walk/frames/<套>/）+ 一帧站立姿势。
// 一个循环 = 两步 = 两拍；两次脚跟落地（meta.strikes）分别对齐到拍点上，一拍迈一步。
// 画面上人物约占画面高度的一半（FIGURE_H 单位）。各站按 STATION_STYLE 做画风转换（styles.js）。
import { styledFrame } from './styles.js';

export const FIGURE_H = 500; // 人物身高（场景单位，≈ 画面高度一半）
export const DEFAULT_SET = 'side';

const sets = {};
let active = null;

export async function loadWalkSets() {
  const raw = (typeof window !== 'undefined' && window.__WALK) || {};
  const load = (src) => new Promise((res) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  for (const [name, s] of Object.entries(raw)) {
    sets[name] = { name, meta: s.meta, frames: await Promise.all(s.frames.map(load)), stand: await load(s.stand) };
  }
  return Object.keys(sets);
}
export const walkSetNames = () => Object.keys(sets);

/** 选用哪一套走路循环（side 正侧面 / 34 四分之三侧面）。返回该套对应的行走速度（单位/拍）。 */
export function useWalkSet(name) {
  active = sets[name] || sets[DEFAULT_SET] || Object.values(sets)[0] || null;
  return active ? walkSpeedOf(active.meta) : 105;
}
export const activeWalk = () => active;

/** 视频里支撑脚每帧后退多少像素 × 每拍几帧 × 缩放 = 镜头每拍该平移多少单位，脚才不打滑。 */
export function walkSpeedOf(meta) {
  const s = FIGURE_H / meta.personHeight;
  return meta.footSpeedPxPerFrame * (meta.frames / 2) * s;
}

/** 循环里的第几帧：phase 为循环内拍位（0..2），两次落地分别对齐到 0 和 1。 */
export function frameIndex(phase) {
  const m = active.meta;
  const k = m.strikes[1], P = m.frames;
  const c = ((phase % 2) + 2) % 2;
  const f = c < 1 ? c * k : k + (c - 1) * (P - k);
  return Math.min(P - 1, Math.floor(f + 1e-6));
}

/**
 * 画人物。ctx 原点在脚下基线中点（单位空间）。
 * o.pose：'walk' | 'stand'；o.phase：循环内拍位；o.style：画风；o.lean：前倾弧度
 */
export function drawWalker(ctx, o = {}) {
  if (!active) return;
  const m = active.meta;
  const s = FIGURE_H / m.personHeight;
  const stand = o.pose === 'stand';
  const idx = stand ? -1 : o.frame ?? frameIndex(o.phase || 0);
  const src = stand ? active.stand : active.frames[idx];
  if (!src) return;
  const img = styledFrame(`${active.name}/${stand ? 'stand' : idx}`, src, o.style);
  ctx.save();
  if (o.lean) ctx.rotate(o.lean);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
  ctx.restore();
}
