// 自查用的拼图：接触表（多帧缩略图 + 标签）、换头对照表（头像 × 16 种画风）、人物步态检查表。
import { renderAt, renderBeat } from './film.js';
import { makeCanvas } from '../kit/canvas.js';
import { font, SANS } from '../kit/text.js';
import { STATIONS } from '../data/stations.js';
import { LOOK } from '../rig/look.js';
import { drawHead, findHeadAsset } from '../rig/head.js';
import { headTreatmentFor } from '../rig/treatments.js';
import { SCENES } from '../scenes/index.js';
import { mix } from '../kit/color.js';

/** items: [{ t } | { beat }, label]，cols 列，cellW 每格宽（像素）。 */
export function contactSheet(ctx, canvas, { items, cols = 6, cellW = 400, title = '' }) {
  const cellH = Math.round((cellW * 9) / 16), labelH = 34, pad = 10, titleH = title ? 56 : 0;
  const rows = Math.ceil(items.length / cols);
  const sheet = makeCanvas(cols * (cellW + pad) + pad, titleH + rows * (cellH + labelH + pad) + pad);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#1a1a1a';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  if (title) {
    font(sc, 32, { family: SANS, weight: 700 });
    sc.fillStyle = '#eee';
    sc.fillText(title, pad + 4, 40);
  }
  items.forEach((it, i) => {
    if (it.beat !== undefined) renderBeat(ctx, it.beat);
    else renderAt(ctx, it.t);
    const x = pad + (i % cols) * (cellW + pad), y = titleH + pad + Math.floor(i / cols) * (cellH + labelH + pad);
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(canvas, x, y, cellW, cellH);
    font(sc, 22, { family: SANS, weight: 400 });
    sc.fillStyle = '#ddd';
    sc.fillText(it.label || '', x + 2, y + cellH + 25);
  });
  return sheet;
}

/** 换头对照表：这张头像（或占位头）在 16 种画风下的自动处理，左侧是原图。 */
export function headsCheck({ cell = 300 } = {}) {
  const cols = 4, rows = 4, pad = 8, refW = 420, top = 64;
  const sheet = makeCanvas(refW + pad + cols * (cell + pad) + pad, top + rows * (cell + pad) + 44);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#202020';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  const src = findHeadAsset(null);
  font(sc, 28, { family: SANS, weight: 700 });
  sc.fillStyle = '#eee';
  sc.fillText(`换头对照表 · 素材：${src ? `assets/heads/${src.key}.png` : '没有素材（原创占位头）'} · 已按脖子底部向下旋转 12°`, 16, 42);
  // 原图
  const drawAt = (x, y, w, h, bg, treatment, sceneId, label) => {
    sc.fillStyle = bg;
    sc.fillRect(x, y, w, h);
    sc.save();
    sc.beginPath(); sc.rect(x, y, w, h); sc.clip();
    const side = Math.min(w, h);
    sc.translate(x + w / 2 - side * 0.04, y + (h + side) / 2 - 6);
    const k = (side * 0.95) / 160;
    sc.scale(k, k);
    drawHead(sc, LOOK, { sceneId, treatment });
    sc.restore();
    font(sc, 18, { family: SANS, weight: 700 });
    sc.fillStyle = 'rgba(0,0,0,0.55)';
    sc.fillRect(x, y, w, 30);
    sc.fillStyle = '#fff';
    sc.fillText(label, x + 8, y + 22);
  };
  drawAt(pad, top, refW - pad, rows * (cell + pad) - pad, '#f3efe6', { type: 'none' }, null, '原图（不处理）');
  STATIONS.forEach((st, i) => {
    const x = refW + pad + (i % cols) * (cell + pad), y = top + Math.floor(i / cols) * (cell + pad);
    const t = headTreatmentFor(st);
    const own = findHeadAsset(st.id);
    const tag = own && own.key === st.id ? ' · 专用头像' : '';
    drawAt(x, y, cell, cell, st.palette[0], t, st.id, `${st.n} ${st.style.slice(0, 9)} · ${t.type}${tag}`);
  });
  font(sc, 18, { family: SANS, weight: 400 });
  sc.fillStyle = '#aaa';
  sc.fillText('处理方式：tone 调色板映射（保留红色）· ink 灰度晕染 · lines 刻线排线 · silhouette 皮影剪影 + 镂空。各站正式画风做好后会再细调。', 16, sheet.height - 14);
  return sheet;
}

/** 人物检查表：一个步态循环（2 拍）的 8 个相位，脚下画出地面和世界刻度，检查是否打滑。 */
import { figurePose } from './figure.js';
import { drawFigure as paintFigure } from '../rig/painter.js';
import { dist } from './walk.js';
export function rigSheet({ cell = 300, phases = 8, gb0 = 20, scale = 1.25 } = {}) {
  const rowH = 600, left = 20;
  const sheet = makeCanvas(left + phases * cell + 20, rowH + 60);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#f3efe6';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  font(sc, 22, { family: SANS, weight: 700 });
  sc.fillStyle = '#333';
  for (let i = 0; i < phases; i++) sc.fillText(`第 ${(gb0 + (i * 2) / phases).toFixed(2)} 拍`, left + i * cell + 90, 34);
  const y0 = 60 + rowH - 40;
  for (let i = 0; i < phases; i++) {
    const gb = gb0 + (i * 2) / phases;
    const x0 = left + i * cell + cell / 2;
    sc.strokeStyle = '#999';
    sc.lineWidth = 2;
    sc.beginPath(); sc.moveTo(x0 - cell / 2 + 6, y0); sc.lineTo(x0 + cell / 2 - 6, y0); sc.stroke();
    // 世界刻度：随行走距离后退，支撑脚应与刻度保持相对静止
    const off = (dist(gb) * scale) % 40;
    sc.fillStyle = '#bbb';
    for (let k = -4; k <= 4; k++) sc.fillRect(x0 + k * 40 - off, y0 + 4, 3, 10);
    sc.save();
    sc.translate(x0, y0);
    sc.scale(scale, scale);
    paintFigure(sc, figurePose(gb, LOOK), LOOK, {});
    sc.restore();
  }
  return sheet;
}
