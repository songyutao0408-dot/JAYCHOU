// 换头接口。头部单独渲染，优先用我（用户）提供的素材，没有才画原创占位头。
// 素材：assets/heads/<A|B|C|D>/<front|side|three-quarter>.png（1024×1024 透明底，脖子根部对齐底边中点）
//       assets/heads/<档位>/<场景id>.png  某站专用，优先级最高（场景 id 如 s01、s11、intro）
// 构建：node tools/build-heads.mjs 把素材缩成 512 并以 base64 写进 preview/build/heads.js。
// 自动处理（按画风）：silhouette 皮影剪影 + 镂空；lines 刻线重画；ink 灰度晕染；tone 调色板映射。
import { makeCanvas, memo } from '../kit/canvas.js';
import { hexToRgb, HEADPHONE_RED } from '../kit/color.js';
import { ellipse, smoothPath, circle, roundRect } from '../kit/shapes.js';
import { hash2 } from '../kit/rng.js';

const images = new Map(); // 'A/side' → HTMLImageElement
export const HEAD_BOX = 112; // 素材 1024 方框在人物身上对应的边长（单位）
export const VIEWS = ['side', 'three-quarter', 'front'];

export async function loadHeadAssets() {
  const list = (typeof window !== 'undefined' && window.__HEADS) || {};
  await Promise.all(Object.entries(list).map(([k, src]) => new Promise((res) => {
    const im = new Image();
    im.onload = () => { images.set(k, im); res(); };
    im.onerror = () => res();
    im.src = src;
  })));
  return images.size;
}
export const headAssetKeys = () => [...images.keys()];

/** 按优先级找素材：场景专用 → 指定朝向 → 同档其他朝向 → null（用占位头）。 */
export function findHeadAsset(tier, view, sceneId) {
  if (sceneId && images.has(`${tier}/${sceneId}`)) return { key: `${tier}/${sceneId}`, img: images.get(`${tier}/${sceneId}`) };
  for (const v of [view, ...VIEWS.filter((x) => x !== view)]) {
    if (images.has(`${tier}/${v}`)) return { key: `${tier}/${v}`, img: images.get(`${tier}/${v}`), mirrored: false };
  }
  return null;
}

// ---------- 素材的画风处理 ----------
const PROC = 256;
function lumOf(d, i) { return (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; }

/** treatment: { type:'none'|'tone'|'ink'|'silhouette'|'lines', palette:[暗,中,亮], color, seed } */
export function processedHead(key, img, treatment) {
  const tkey = JSON.stringify(treatment || { type: 'none' });
  return memo(`headproc|${key}|${tkey}`, () => {
    const c = makeCanvas(PROC, PROC);
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, PROC, PROC);
    const type = treatment?.type || 'none';
    if (type === 'none') return c;
    const im = ctx.getImageData(0, 0, PROC, PROC);
    const d = im.data;
    if (type === 'tone' || type === 'ink') {
      const pal = (treatment.palette || ['#222222', '#888888', '#eeeeee']).map(hexToRgb);
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        let l = lumOf(d, i);
        if (type === 'ink') l = Math.pow(l, 0.8);
        const [a, b, t] = l < 0.5 ? [pal[0], pal[1], l / 0.5] : [pal[1], pal[2], (l - 0.5) / 0.5];
        // 保留素材里明显的红色（比如本人头上的红耳机），其余映射到调色板
        const isRed = d[i] > 150 && d[i] > d[i + 1] * 1.8 && d[i] > d[i + 2] * 1.8;
        if (!isRed) for (let k = 0; k < 3; k++) d[i + k] = a[k] + (b[k] - a[k]) * t;
      }
      ctx.putImageData(im, 0, 0);
      if (type === 'ink') {
        // 晕染：模糊一层叠回去，边缘化开
        const blur = makeCanvas(PROC, PROC);
        const bctx = blur.getContext('2d');
        bctx.filter = 'blur(3px)';
        bctx.drawImage(c, 0, 0);
        ctx.globalAlpha = 0.55;
        ctx.drawImage(blur, 0, 0);
        ctx.globalAlpha = 1;
      }
      return c;
    }
    if (type === 'silhouette') {
      const col = hexToRgb(treatment.color || '#3a1d10');
      for (let y = 0; y < PROC; y++) for (let x = 0; x < PROC; x++) {
        const i = (y * PROC + x) * 4;
        if (d[i + 3] < 40) { d[i + 3] = 0; continue; }
        const l = lumOf(d, i);
        // 镂空：亮处按网格挖出小孔，形成皮影的雕花
        const cell = 9, cx = x % cell - cell / 2, cy = y % cell - cell / 2;
        const hole = l > 0.55 && cx * cx + cy * cy < (l - 0.45) * 26;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2];
        d[i + 3] = hole ? 0 : 235;
      }
      ctx.putImageData(im, 0, 0);
      return c;
    }
    if (type === 'lines') {
      // 刻线：Sobel 边缘 + 暗部按亮度画平行排线
      const col = hexToRgb(treatment.color || '#111111');
      const L = new Float32Array(PROC * PROC);
      const A = new Uint8Array(PROC * PROC);
      for (let i = 0; i < PROC * PROC; i++) { L[i] = lumOf(d, i * 4); A[i] = d[i * 4 + 3]; }
      const out = ctx.createImageData(PROC, PROC);
      const o = out.data;
      const at = (x, y) => L[Math.min(PROC - 1, Math.max(0, y)) * PROC + Math.min(PROC - 1, Math.max(0, x))];
      for (let y = 0; y < PROC; y++) for (let x = 0; x < PROC; x++) {
        const i = y * PROC + x;
        if (A[i] < 40) continue;
        const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
        const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1) - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
        const edge = Math.hypot(gx, gy) > 0.55;
        const dark = 1 - L[i];
        const hatch = ((x + y) % 6 < 1.6 && dark > 0.35) || ((x - y + 600) % 6 < 1.4 && dark > 0.62);
        const edgeA = (x === 0 || A[i - 1] < 40 || A[i + 1] < 40 || A[i - PROC] < 40 || A[i + PROC] < 40);
        const on = edge || hatch || edgeA;
        const k = i * 4;
        if (on) { o[k] = col[0]; o[k + 1] = col[1]; o[k + 2] = col[2]; o[k + 3] = 255; }
        else { const p = treatment.paper ? hexToRgb(treatment.paper) : [255, 255, 255]; o[k] = p[0]; o[k + 1] = p[1]; o[k + 2] = p[2]; o[k + 3] = treatment.paper ? 255 : 0; }
      }
      ctx.putImageData(out, 0, 0);
      return c;
    }
    return c;
  });
}

// ---------- 原创占位头 ----------
// 坐标：脖子根部为 (0,0)，朝右，y 向下。占位造型刻意做成简单的漫画小人，不像任何真实人物。
export const SKIN = '#f0d2b4';

export function drawPlaceholderHead(ctx, look, o = {}) {
  const { view = 'side', ink = '#1d1b1a', lw = 2.6, skin = SKIN, flat = false, hairColor } = o;
  const hc = hairColor || look.colors.hair;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = ink;
  if (view === 'front') return drawFrontHead(ctx, look, { ink, lw, skin, hc, flat });
  const tq = view === 'three-quarter';

  // 后脑与脸部轮廓
  const face = tq
    ? [[-20, -20], [-27, -40], [-24, -66], [-6, -80], [16, -78], [28, -62], [29, -48], [27, -36], [20, -24], [8, -17], [-6, -15]]
    : [[-18, -18], [-26, -38], [-24, -64], [-8, -80], [14, -79], [26, -66], [29, -54], [33, -46], [29, -42], [29, -34], [25, -25], [14, -19], [0, -16]];
  smoothPath(ctx, face, true);
  ctx.fillStyle = skin;
  ctx.fill();
  if (!flat) {
    // 胡茬：下颌区域的淡灰
    if (look.stubble > 0) {
      ctx.save();
      ctx.clip();
      ctx.fillStyle = `rgba(70,64,60,${0.04 + look.stubble * 0.16})`;
      ellipse(ctx, 18, -24, 16, 10, -0.2);
      ctx.fill();
      for (let i = 0; i < 26 * look.stubble; i++) {
        const x = 4 + hash2(i, 1, 9) * 26, y = -32 + hash2(i, 2, 9) * 16;
        circle(ctx, x, y, 0.7);
        ctx.fillStyle = 'rgba(40,36,34,0.45)';
        ctx.fill();
      }
      ctx.restore();
    }
    smoothPath(ctx, face, true);
  }
  ctx.stroke();

  // 耳朵（在头发之后画，见下）

  // 头发
  ctx.fillStyle = hc;
  const v = look.hairVol;
  let hair;
  if (look.hair === 'fringe') {
    hair = [[-27, -40], [-30, -60], [-20, -80], [0, -88 - 4 * v], [20, -84], [32, -70], [34, -58], [26, -62], [18, -58], [12, -66], [2, -68], [-12, -62], [-18, -50]];
  } else if (look.hair === 'short') {
    hair = [[-26, -42], [-29, -62], [-18, -80], [2, -85 - 2 * v], [20, -80], [28, -70], [24, -67], [10, -72], [-6, -70], [-16, -60], [-20, -48]];
  } else {
    // slick / slick-grey：往后梳，顶部平顺，后脑饱满
    hair = [[-25, -38], [-31, -58], [-24, -78], [-4, -87 - 2 * v], [18, -83], [28, -73], [24, -70], [8, -76], [-8, -74], [-18, -64], [-20, -50]];
  }
  smoothPath(ctx, hair, true);
  ctx.fill();
  ctx.stroke();
  if (look.hair === 'slick' || look.hair === 'slick-grey') {
    // 梳痕
    ctx.save();
    ctx.lineWidth = lw * 0.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    for (let k = 0; k < 3; k++) smoothPath(ctx, [[18 - k * 4, -79 + k * 2], [0 - k * 3, -82 + k * 3], [-18 - k, -70 + k * 3]]), ctx.stroke();
    ctx.restore();
  }
  // 耳朵：侧面只描后半圈，像个「C」
  const earX = tq ? -12 : -5;
  ellipse(ctx, earX, -45, 5.2, 7.6, -0.1);
  ctx.fillStyle = skin; ctx.fill();
  ctx.lineWidth = lw * 0.9;
  ctx.beginPath(); ctx.ellipse(earX, -45, 5.2, 7.6, -0.1, Math.PI * 0.45, Math.PI * 1.75); ctx.stroke();
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath(); ctx.arc(earX + 0.5, -45, 2.6, Math.PI * 0.6, Math.PI * 1.5); ctx.stroke();
  ctx.lineWidth = lw;
  // 鬓角：和头发连成一片，盖住耳朵上沿
  ctx.fillStyle = look.grey > 0 ? mixGrey(hc, look.grey) : hc;
  const sx = tq ? -6 : 1;
  smoothPath(ctx, [[sx - 16, -66], [sx + 9, -66], [sx + 8, -56], [sx + 5, -49], [sx + 2, -55], [sx - 10, -55]], true);
  ctx.fill();
  if (look.grey > 0) {
    ctx.fillStyle = mixGrey(hc, look.grey * 0.75);
    smoothPath(ctx, [[-24, -58], [-14, -64], [-12, -56], [-20, -48]], true);
    ctx.fill();
  }
  // 眉、眼、鼻、嘴
  const ex = tq ? 12 : 19;
  ctx.lineWidth = lw * 1.05;
  ctx.beginPath(); ctx.moveTo(ex - 6, -58); ctx.quadraticCurveTo(ex, -61, ex + 6, -58.5); ctx.stroke();
  ctx.fillStyle = ink;
  ellipse(ctx, ex, -50, 2.4, 3.4); ctx.fill();
  if (tq) { ellipse(ctx, ex + 13, -50, 2.0, 3.2); ctx.fill(); ctx.beginPath(); ctx.moveTo(ex + 8, -57.5); ctx.quadraticCurveTo(ex + 13, -60, ex + 18, -57.5); ctx.stroke(); }
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.moveTo(tq ? 22 : 24, -32); ctx.quadraticCurveTo(tq ? 18 : 21, -30.5, tq ? 14 : 17, -31.5); ctx.stroke();
  if (look.glasses) {
    ctx.lineWidth = lw * 0.6;
    roundRect(ctx, ex - 6, -55, 13, 10, 3); ctx.stroke();
    if (tq) { roundRect(ctx, ex + 8, -55, 11, 10, 3); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(ex - 6, -51); ctx.lineTo(-2, -50); ctx.stroke();
  }
}

function drawFrontHead(ctx, look, { ink, lw, skin, hc }) {
  const faceP = [[0, -16], [-18, -22], [-26, -40], [-27, -60], [-18, -78], [0, -84], [18, -78], [27, -60], [26, -40], [18, -22]];
  ellipse(ctx, -28, -46, 5, 8); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  ellipse(ctx, 28, -46, 5, 8); ctx.fill(); ctx.stroke();
  smoothPath(ctx, faceP, true); ctx.fillStyle = skin; ctx.fill();
  if (look.stubble > 0) {
    ctx.save(); ctx.clip();
    ctx.fillStyle = `rgba(70,64,60,${0.12 + look.stubble * 0.28})`;
    ellipse(ctx, 0, -24, 22, 12); ctx.fill();
    ctx.restore();
    smoothPath(ctx, faceP, true);
  }
  ctx.stroke();
  ctx.fillStyle = hc;
  const hair = look.hair === 'fringe'
    ? [[-28, -46], [-30, -70], [-14, -88], [8, -88], [26, -76], [29, -54], [22, -64], [8, -68], [-6, -60], [-20, -62]]
    : look.hair === 'short'
      ? [[-27, -50], [-28, -72], [-12, -86], [10, -86], [27, -72], [27, -50], [20, -66], [0, -70], [-20, -66]]
      : [[-27, -48], [-29, -72], [-12, -88], [12, -88], [29, -72], [27, -48], [22, -68], [0, -74], [-22, -68]];
  smoothPath(ctx, hair, true); ctx.fill(); ctx.stroke();
  if (look.grey > 0) {
    ctx.fillStyle = mixGrey(hc, look.grey);
    for (const s of [-1, 1]) { smoothPath(ctx, [[s * 27, -60], [s * 24, -52], [s * 26, -44], [s * 29, -52]], true); ctx.fill(); }
  }
  ctx.fillStyle = ink;
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 10, -50, 2.4, 3.4); ctx.fill();
    ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(s * 5, -58); ctx.quadraticCurveTo(s * 10, -61, s * 16, -58); ctx.stroke();
  }
  ctx.lineWidth = lw * 0.8;
  ctx.beginPath(); ctx.moveTo(-1, -46); ctx.lineTo(-2, -38); ctx.lineTo(1, -37); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -30); ctx.quadraticCurveTo(0, -28, 6, -30); ctx.stroke();
  if (look.glasses) {
    ctx.lineWidth = lw * 0.6;
    roundRect(ctx, -17, -55, 13, 10, 3); ctx.stroke();
    roundRect(ctx, 4, -55, 13, 10, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-4, -51); ctx.lineTo(4, -51); ctx.stroke();
  }
}

function mixGrey(hex, k) {
  const [r, g, b] = hexToRgb(hex);
  const G = [196, 194, 190];
  return `rgb(${r + (G[0] - r) * k},${g + (G[1] - g) * k},${b + (G[2] - b) * k})`;
}

/**
 * 画头：有素材画素材（按 treatment 处理），否则画占位头。
 * 坐标同上：脖子根部 (0,0)。
 */
export function drawHead(ctx, look, o = {}) {
  const { view = 'side', sceneId, treatment } = o;
  const asset = findHeadAsset(look.tier, view, sceneId);
  if (asset) {
    const img = processedHead(asset.key, asset.img, treatment);
    ctx.drawImage(img, -HEAD_BOX / 2, -HEAD_BOX, HEAD_BOX, HEAD_BOX);
    return true;
  }
  drawPlaceholderHead(ctx, look, o);
  return false;
}

export { HEADPHONE_RED };
