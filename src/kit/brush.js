// p5.brush（独立版，MIT）封装：在一块共用的 WebGL2 画布上画自然笔触，
// 画完拷贝成普通 2D 画布并按 key 缓存，主画面用 drawImage 合成。
// 笔触有随机性，所以每次烘焙前都按 key 设种子，保证结果可复现。
import { makeCanvas } from './canvas.js';
import { hashStr } from './rng.js';

let glCanvas = null;
const cache = new Map();

export const brushAvailable = () => typeof window !== 'undefined' && !!window.brush;

/**
 * bakeBrush('intro-deck', 800, 500, (B) => { B.set('HB', '#333', 1); B.line(0,0,100,100); })
 * 坐标原点在左上角，单位为像素。返回 2D 画布；brush 不可用时返回空白画布。
 */
export function bakeBrush(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const out = makeCanvas(w, h);
  const B = brushAvailable() ? window.brush : null;
  if (B) {
    if (!glCanvas) glCanvas = document.createElement('canvas');
    glCanvas.width = Math.round(w);
    glCanvas.height = Math.round(h);
    B.load(glCanvas);
    B.clear();
    // brush.clear() 清成「透明白」，合成时会发白；这里直接清成全透明
    const gl = glCanvas.getContext('webgl2');
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const seed = hashStr(key);
    B.seed(seed);
    B.noiseSeed(seed);
    // 独立版的原点在画布中心，这里统一挪到左上角
    B.push();
    B.translate(-w / 2, -h / 2);
    draw(B);
    B.pop();
    B.render();
    out.getContext('2d').drawImage(glCanvas, 0, 0);
  }
  cache.set(key, out);
  return out;
}
