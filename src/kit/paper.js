// 纸张质感：低频斑驳 + 高频颗粒 + 纤维。生成一次后缓存。
import { baked } from './canvas.js';
import { fbm } from './noise.js';
import { rng } from './rng.js';
import { hexToRgb } from './color.js';

/** 返回一张 w×h 的纸纹画布。base 底色，amount 纹理强度。 */
export function paperTexture(w, h, { base = '#efe6d2', seed = 1, amount = 1, fibers = 260 } = {}) {
  return baked(`paper|${w}|${h}|${base}|${seed}|${amount}|${fibers}`, w, h, (ctx) => {
    const [r0, g0, b0] = hexToRgb(base);
    // 低频斑驳：在小图上算，再放大
    const sw = Math.ceil(w / 8), sh = Math.ceil(h / 8);
    const small = document.createElement('canvas');
    small.width = sw; small.height = sh;
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(sw, sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const n = fbm(x / 22, y / 22, seed, 4) - 0.5;
      const k = 1 + n * 0.09 * amount;
      const i = (y * sw + x) * 4;
      img.data[i] = r0 * k; img.data[i + 1] = g0 * k; img.data[i + 2] = b0 * k * 0.995; img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, w, h);
    // 高频颗粒：平铺一块 256 的噪点
    const T = 256;
    const tile = document.createElement('canvas');
    tile.width = T; tile.height = T;
    const tctx = tile.getContext('2d');
    const ti = tctx.createImageData(T, T);
    const R = rng('grain', seed);
    for (let i = 0; i < T * T; i++) {
      const v = R() < 0.5 ? 0 : 255;
      ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = v;
      ti.data[i * 4 + 3] = R() * 16 * amount;
    }
    tctx.putImageData(ti, 0, 0);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    // 纤维
    const F = rng('fiber', seed);
    ctx.lineCap = 'round';
    for (let i = 0; i < fibers * amount; i++) {
      const x = F() * w, y = F() * h, a = F() * Math.PI * 2, L = 6 + F() * 26;
      ctx.strokeStyle = F() < 0.5 ? 'rgba(90,70,40,0.07)' : 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 0.6 + F() * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + F() * 4, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
      ctx.stroke();
    }
  });
}
