// 人物：从绿幕视频里提取的走路循环（assets/walk/frames/<套>/）+ 一帧站立姿势。
// 一个循环 = 两步 = 两拍；两次脚跟落地（meta.strikes）分别对齐到拍点上，一拍迈一步。
// 画面上人物约占画面高度的一半（FIGURE_H 单位）。各站按 STATION_STYLE 做画风转换（styles.js）。
import { styledFrame } from './styles.js';
import { makeCanvas, memo } from '../kit/canvas.js';

export const FIGURE_H = 500; // 人物身高（场景单位，≈ 画面高度一半）

/** 人物身上的几个点（单位，相对脚下基线中点；按正侧面素材在站立帧 / 走路帧上量出）。梗里挂东西用。 */
export const ANCHORS = {
  stand: { shoulder: [30, -423], handR: [58, -226], handL: [-23, -235], headTop: [0, -507], ear: [25, -465] },
  walk: { shoulder: [-19, -421], hand: [32, -250], headTop: [-5, -494], ear: [-1, -454] },
};
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

/** 选用哪一套走路循环（已选定 side 正侧面）。返回该套对应的行走速度（单位/拍）。 */
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
  const key = `${active.name}/${stand ? 'stand' : idx}`;
  const img = styledFrame(key, src, o.style);
  ctx.save();
  if (o.lean) ctx.rotate(o.lean);
  ctx.imageSmoothingQuality = 'high';
  // 轮廓光 / 浅色描边：背景偏暗时，在人物外面加一圈亮边，保证反差（全局规则）
  if (o.rim) {
    const halo = rimFrame(key, img, o.rim.color || '#fff6e0', o.rim.width || 5);
    ctx.globalAlpha *= o.rim.alpha ?? 0.9;
    ctx.drawImage(halo, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
    ctx.globalAlpha /= o.rim.alpha ?? 0.9;
  }
  ctx.drawImage(img, -m.anchorX * s, -m.baseY * s, m.width * s, m.height * s);
  ctx.restore();
}

/** 人物外轮廓向外扩 width 像素、填成纯色的一圈（按帧、颜色、宽度缓存）。 */
function rimFrame(key, img, color, width) {
  return memo(`rim|${key}|${img.width}|${color}|${width}`, () => {
    const w = img.width, h = img.height;
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      for (const r of [width, width * 0.5]) ctx.drawImage(img, Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    return c;
  });
}
