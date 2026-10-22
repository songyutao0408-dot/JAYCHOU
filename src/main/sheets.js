// 自查用的拼图：接触表（多帧缩略图 + 标签）与换头对照表（四档 × 16 种画风）。
import { renderAt, renderBeat } from './film.js';
import { makeCanvas } from '../kit/canvas.js';
import { font, SANS } from '../kit/text.js';
import { STATIONS } from '../data/stations.js';
import { lookFor } from '../rig/look.js';
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

/** 四档头像在 16 种画风下各渲染一张。 */
export function headsCheck({ cell = 190 } = {}) {
  const tiers = ['A', 'B', 'C', 'D'];
  const ages = { A: 22, B: 27, C: 34, D: 45 };
  const headW = 90, headH = 70, pad = 6;
  const sheet = makeCanvas(headW + STATIONS.length * (cell + pad) + pad, headH + tiers.length * (cell + pad) + pad + 40);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#202020';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  font(sc, 20, { family: SANS, weight: 700 });
  sc.fillStyle = '#eee';
  STATIONS.forEach((st, i) => {
    const x = headW + pad + i * (cell + pad);
    sc.fillText(`${st.n}`, x + 4, 26);
    font(sc, 16, { family: SANS, weight: 400 });
    sc.fillText(st.style.slice(0, 10), x + 4, 52);
    font(sc, 20, { family: SANS, weight: 700 });
  });
  tiers.forEach((tier, r) => {
    const y = headH + r * (cell + pad);
    font(sc, 34, { family: SANS, weight: 700 });
    sc.fillStyle = '#eee';
    sc.fillText(tier, 30, y + cell / 2 + 12);
    STATIONS.forEach((st, i) => {
      const x = headW + pad + i * (cell + pad);
      const look = lookFor(ages[tier]);
      const scene = SCENES[st.id];
      const style = scene.figureStyle ? scene.figureStyle(4, { look, st }) : {};
      const treatment = style.headTreatment || headTreatmentFor(st);
      sc.fillStyle = st.palette[0];
      sc.fillRect(x, y, cell, cell);
      sc.save();
      sc.beginPath(); sc.rect(x, y, cell, cell); sc.clip();
      sc.translate(x + cell / 2, y + cell - 12);
      sc.scale(1.45, 1.45);
      drawHead(sc, look, { view: 'side', sceneId: st.id, treatment, ink: style.ink || '#1d1b1a' });
      sc.restore();
      const src = findHeadAsset(tier, 'side', st.id);
      font(sc, 14, { family: SANS, weight: 400 });
      sc.fillStyle = mix(st.palette[2], '#888888', 0.3);
      sc.fillText(src ? src.key : '占位', x + 4, y + 16);
    });
  });
  font(sc, 18, { family: SANS, weight: 400 });
  sc.fillStyle = '#aaa';
  sc.fillText('左上角小字：所用素材（档位/朝向或场景 id），「占位」表示没有素材、画原创占位头。', headW, sheet.height - 14);
  return sheet;
}

/** 人物检查表：四档 × 一个步态循环（2 拍）的 8 个相位，脚下画出地面和世界刻度，检查是否打滑。 */
import { figurePose } from './figure.js';
import { drawFigure as paintFigure } from '../rig/painter.js';
import { dist } from './walk.js';
export function rigSheet({ cell = 230, phases = 8, gb0 = 20 } = {}) {
  const tiers = [['A', 22], ['B', 27], ['C', 34], ['D', 45]];
  const rowH = 420, pad = 10, left = 80;
  const sheet = makeCanvas(left + phases * cell + pad, tiers.length * rowH + 60);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#f3efe6';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  font(sc, 22, { family: SANS, weight: 700 });
  sc.fillStyle = '#333';
  for (let i = 0; i < phases; i++) sc.fillText(`第 ${(gb0 + (i * 2) / phases).toFixed(2)} 拍`, left + i * cell + 40, 34);
  tiers.forEach(([tier, age], r) => {
    const look = lookFor(age);
    const y0 = 60 + r * rowH + rowH - 30;
    font(sc, 40, { family: SANS, weight: 700 });
    sc.fillStyle = '#333';
    sc.fillText(tier, 24, y0 - 150);
    font(sc, 20, { family: SANS, weight: 400 });
    sc.fillText(`${age} 岁`, 20, y0 - 116);
    for (let i = 0; i < phases; i++) {
      const gb = gb0 + (i * 2) / phases;
      const x0 = left + i * cell + cell / 2;
      sc.strokeStyle = '#999';
      sc.lineWidth = 2;
      sc.beginPath(); sc.moveTo(x0 - cell / 2 + 6, y0); sc.lineTo(x0 + cell / 2 - 6, y0); sc.stroke();
      // 世界刻度：随行走距离后退，支撑脚应与刻度保持相对静止
      const off = dist(gb) % 40;
      sc.fillStyle = '#bbb';
      for (let k = -4; k <= 4; k++) sc.fillRect(x0 + k * 40 * 1.0 - off, y0 + 4, 3, 10);
      sc.save();
      sc.translate(x0, y0);
      sc.scale(1.0, 1.0);
      paintFigure(sc, figurePose(gb, look), look, {});
      sc.restore();
    }
  });
  return sheet;
}
