// 离屏画布与确定性缓存。缓存的内容只取决于 key，所以不破坏「每帧是 t 的纯函数」。
const cache = new Map();

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** 以 key 缓存一张离屏图：draw(ctx, canvas) 只在第一次调用。 */
export function baked(key, w, h, draw) {
  let c = cache.get(key);
  if (!c) {
    c = makeCanvas(w, h);
    draw(c.getContext('2d'), c);
    cache.set(key, c);
  }
  return c;
}

export function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const clearCache = () => cache.clear();
