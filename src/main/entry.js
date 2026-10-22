// 入口：预览页（默认）与渲染模式（?render=1，供 Puppeteer 逐帧截图）。
import { W, H } from './layout.js';
import { renderAt, renderBeat, renderFlags } from './film.js';
import { loadEmbeddedFonts } from '../kit/text.js';
import { loadWalkSets, useWalkSet, walkSetNames, activeWalk } from '../rig/walker.js';
import { setWalkSpeed } from './walk.js';
import { duration, sections, TOTAL_BEATS, grid, setGrid, timeAtBeat, beatAt } from '../beat/time.js';
import { STATIONS } from '../data/stations.js';
import { setupPreview } from './preview.js';
import { contactSheet, styleCheck, walkSheet } from './sheets.js';

const params = new URLSearchParams(location.search);
const RENDER = params.has('render');

function canvasToB64(canvas) {
  return canvas.toDataURL('image/png').split(',')[1];
}

new window.p5((p) => {
  p.setup = async () => {
    const cnv = p.createCanvas(W, H);
    p.pixelDensity(1);
    p.noLoop();
    const ctx = p.drawingContext;
    const canvas = cnv.elt;
    const nFonts = await loadEmbeddedFonts();
    await loadWalkSets();
    // 走路素材：正侧面（side）。assets/walk/frames/ 下若有多套，可用 ?walk=<套名> 切换
    setWalkSpeed(useWalkSet(params.get('walk') || undefined));
    if (params.has('bpm')) setGrid({ bpm: parseFloat(params.get('bpm')) });
    if (params.has('offset')) setGrid({ firstDownbeat: parseFloat(params.get('offset')) });

    window.__film = {
      ready: true,
      W, H,
      info: () => ({
        duration: duration(), totalBeats: TOTAL_BEATS, bpm: grid.bpm, firstDownbeat: grid.firstDownbeat,
        sections: sections.map((s) => ({ ...s, t0: timeAtBeat(s.start), t1: timeAtBeat(s.end) })),
        stations: STATIONS, fonts: nFonts, walkSets: walkSetNames(), walk: activeWalk() && activeWalk().meta,
      }),
      renderAt: (t) => renderAt(ctx, t),
      renderBeat: (gb) => renderBeat(ctx, gb),
      capture: (t, o = {}) => {
        if (o.beat !== undefined) renderBeat(ctx, o.beat);
        else renderAt(ctx, t);
        return canvasToB64(canvas);
      },
      contact: (o) => canvasToB64(contactSheet(ctx, canvas, o)),
      styleCheck: (o) => canvasToB64(styleCheck(o)),
      walkSheet: (o) => canvasToB64(walkSheet(o)),
      analyze: (beat) => analyzeFrame(ctx, canvas, beat),
      beatAt, timeAtBeat, setGrid,
    };
    if (!RENDER) setupPreview(p, canvas, ctx);
    else renderAt(ctx, 0);
  };
});

// ---------- 自查：亮度与人物反差 ----------
const lin = (v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
function analyzeFrame(ctx, canvas, beat) {
  // 1) 正常画一帧，存截图；2) 不画人物再画一帧；两帧不同的像素就是人物
  const SW = 960, SH = 540;
  const small = document.createElement('canvas');
  small.width = SW; small.height = SH;
  const sc = small.getContext('2d', { willReadFrequently: true });
  renderBeat(ctx, beat);
  const png = canvas.toDataURL('image/png').split(',')[1];
  sc.drawImage(canvas, 0, 0, SW, SH);
  const A = sc.getImageData(0, 0, SW, SH).data;
  renderFlags.hideFigure = true;
  renderBeat(ctx, beat);
  renderFlags.hideFigure = false;
  sc.drawImage(canvas, 0, 0, SW, SH);
  const Bd = sc.getImageData(0, 0, SW, SH).data;
  const n = SW * SH;
  const Y = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; // 0..255，sRGB 编码值上的亮度
  const L = (d, i) => 0.2126 * lin(d[i] / 255) + 0.7152 * lin(d[i + 1] / 255) + 0.0722 * lin(d[i + 2] / 255); // 相对亮度
  let sum = 0;
  const mask = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    sum += Y(A, i);
    if (Math.abs(A[i] - Bd[i]) + Math.abs(A[i + 1] - Bd[i + 1]) + Math.abs(A[i + 2] - Bd[i + 2]) > 30) mask[p] = 1;
  }
  // 人物身后、周围一圈背景：把人物区域外扩 12px（在 960 宽的图上）
  const R = 12, ring = new Uint8Array(n);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    if (!mask[y * SW + x]) continue;
    for (let dy = -R; dy <= R; dy += 4) for (let dx = -R; dx <= R; dx += 4) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < SW && yy < SH) ring[yy * SW + xx] = 1;
    }
  }
  // 轮廓反差：人物边缘内侧每个像素，和它外侧 3px 内的背景像素比相对亮度；取中位数和「偏低处」占比
  const LA = new Float32Array(n);
  for (let p = 0; p < n; p++) LA[p] = L(A, p * 4);
  const ratios = [];
  for (let y = 1; y < SH - 1; y++) for (let x = 1; x < SW - 1; x++) {
    const p = y * SW + x;
    if (!mask[p] || (mask[p - 1] && mask[p + 1] && mask[p - SW] && mask[p + SW])) continue;
    let os = 0, on = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const q = yy * SW + xx;
      if (!mask[q]) { os += LA[q]; on++; }
    }
    if (!on) continue;
    const ol = os / on;
    // 向内看 6px：描边或身体，任何一处和外侧背景拉开明暗，都算这一点认得出
    let best = 1;
    for (let dy = -6; dy <= 6; dy += 2) for (let dx = -6; dx <= 6; dx += 2) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= SW || yy >= SH) continue;
      const q = yy * SW + xx;
      if (!mask[q]) continue;
      const il = LA[q];
      best = Math.max(best, (Math.max(il, ol) + 0.05) / (Math.min(il, ol) + 0.05));
    }
    ratios.push(best);
  }
  ratios.sort((u, v) => u - v);
  const edge = ratios.length ? ratios[Math.floor(ratios.length / 2)] : null;
  const weak = ratios.length ? ratios.filter((r) => r < 1.5).length / ratios.length : null;
  let fs = 0, fn = 0, bs = 0, bn = 0;
  for (let p = 0; p < n; p++) {
    if (mask[p]) { fs += L(A, p * 4); fn++; }
    if (ring[p]) { bs += L(Bd, p * 4); bn++; }
  }
  const fl = fn ? fs / fn : 0, bl = bn ? bs / bn : 0;
  const contrast = (Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05);
  return { mean: sum / n / 255, figurePx: fn, figureL: fl, backL: bl, contrast, edge, weak, png };
}
