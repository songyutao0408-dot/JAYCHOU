// 自查用的拼图：接触表（多帧缩略图 + 标签）、换头对照表（头像 × 16 种画风）、人物步态检查表。
import { renderAt, renderBeat } from './film.js';
import { makeCanvas } from '../kit/canvas.js';
import { font, SANS } from '../kit/text.js';
import { STATIONS } from '../data/stations.js';
import { drawWalker, activeWalk, frameIndex, FIGURE_H } from '../rig/walker.js';
import { STATION_STYLE, STYLE_LABEL } from '../rig/styles.js';
import { dist } from './walk.js';
import { SB } from '../beat/time.js';

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

/** 人物在 16 种画风下的对照表：每站一格（走路帧 + 站立帧），左侧是原样。 */
export function styleCheck({ cell = 300, frame = 0 } = {}) {
  const W0 = activeWalk();
  const cols = 4, rows = 4, pad = 8, refW = 380, top = 64, ch = Math.round(cell * 1.25);
  const sheet = makeCanvas(refW + pad + cols * (cell + pad) + pad, top + rows * (ch + pad) + 44);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#202020';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  font(sc, 28, { family: SANS, weight: 700 });
  sc.fillStyle = '#eee';
  sc.fillText(`人物 × 16 种画风 · 素材：${W0 ? W0.meta.source : '无'} · 每格左为走路帧、右为站立帧`, 16, 42);
  const draw = (x, y, w, h, bg, style, label) => {
    sc.fillStyle = bg;
    sc.fillRect(x, y, w, h);
    sc.save();
    sc.beginPath(); sc.rect(x, y, w, h); sc.clip();
    const k = (Math.min(h, w * 1.25) * 0.9) / FIGURE_H;
    for (const [dx, pose] of [[0.3, 'walk'], [0.72, 'stand']]) {
      sc.save();
      sc.translate(x + w * dx, y + (h + Math.min(h, w * 1.25)) / 2 - 10);
      sc.scale(k, k);
      drawWalker(sc, { pose, frame, style });
      sc.restore();
    }
    sc.restore();
    font(sc, 18, { family: SANS, weight: 700 });
    sc.fillStyle = 'rgba(0,0,0,0.55)';
    sc.fillRect(x, y, w, 30);
    sc.fillStyle = '#fff';
    sc.fillText(label, x + 8, y + 22);
  };
  draw(pad, top, refW - pad, rows * (ch + pad) - pad, '#f3efe6', 'none', '原样（抠像后）');
  STATIONS.forEach((st, i) => {
    const x = refW + pad + (i % cols) * (cell + pad), y = top + Math.floor(i / cols) * (ch + pad);
    const style = STATION_STYLE[st.n];
    draw(x, y, cell, ch, st.palette[0], style, `${st.n} ${STYLE_LABEL[style]}`);
  });
  font(sc, 18, { family: SANS, weight: 400 });
  sc.fillStyle = '#aaa';
  sc.fillText('所有站先统一做一层漫画化（平滑 + 色块简化 + 描边），再叠加各站处理；第 16 站保留更多原貌。各站正式场景做好后再细调。', 16, sheet.height - 14);
  return sheet;
}

/** 走路循环检查表：一个循环（2 拍）的全部帧，标出落在拍上的两帧，脚下画世界刻度检查是否打滑。 */
export function walkSheet({ style = 'none', cols = 10, scale = 0.62 } = {}) {
  const W0 = activeWalk();
  const P = W0.meta.frames, rows = Math.ceil(P / cols);
  const cw = 190, chh = Math.round(FIGURE_H * scale) + 70;
  const sheet = makeCanvas(cols * cw + 20, rows * chh + 60);
  const sc = sheet.getContext('2d');
  sc.fillStyle = '#f3efe6';
  sc.fillRect(0, 0, sheet.width, sheet.height);
  font(sc, 24, { family: SANS, weight: 700 });
  sc.fillStyle = '#333';
  sc.fillText(`走路循环 · ${W0.meta.source} · ${P} 帧 = 2 拍 · ★ = 落在拍上的脚跟着地帧（第 ${W0.meta.strikes.join('、')} 帧）`, 12, 34);
  for (let i = 0; i < P; i++) {
    const x0 = 10 + (i % cols) * cw + cw / 2, y0 = 60 + Math.floor(i / cols) * chh + chh - 40;
    sc.strokeStyle = '#999'; sc.lineWidth = 2;
    sc.beginPath(); sc.moveTo(x0 - cw / 2 + 6, y0); sc.lineTo(x0 + cw / 2 - 6, y0); sc.stroke();
    sc.save();
    sc.translate(x0, y0);
    sc.scale(scale, scale);
    drawWalker(sc, { frame: i, style });
    sc.restore();
    font(sc, 18, { family: SANS, weight: 400 });
    sc.fillStyle = W0.meta.strikes.includes(i) ? '#c0392b' : '#555';
    sc.fillText(`${W0.meta.strikes.includes(i) ? '★ ' : ''}${i}`, x0 - cw / 2 + 8, y0 + 26);
  }
  return sheet;
}
