// 入口：预览页（默认）与渲染模式（?render=1，供 Puppeteer 逐帧截图）。
import { W, H } from './layout.js';
import { renderAt, renderBeat } from './film.js';
import { loadEmbeddedFonts } from '../kit/text.js';
import { loadHeadAssets, headAssetKeys } from '../rig/head.js';
import { duration, sections, TOTAL_BEATS, grid, setGrid, timeAtBeat, beatAt } from '../beat/time.js';
import { STATIONS } from '../data/stations.js';
import { setupPreview } from './preview.js';
import { contactSheet, headsCheck, rigSheet } from './sheets.js';

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
    const nHeads = await loadHeadAssets();
    if (params.has('bpm')) setGrid({ bpm: parseFloat(params.get('bpm')) });
    if (params.has('offset')) setGrid({ firstDownbeat: parseFloat(params.get('offset')) });

    window.__film = {
      ready: true,
      W, H,
      info: () => ({
        duration: duration(), totalBeats: TOTAL_BEATS, bpm: grid.bpm, firstDownbeat: grid.firstDownbeat,
        sections: sections.map((s) => ({ ...s, t0: timeAtBeat(s.start), t1: timeAtBeat(s.end) })),
        stations: STATIONS, fonts: nFonts, heads: headAssetKeys(),
      }),
      renderAt: (t) => renderAt(ctx, t),
      renderBeat: (gb) => renderBeat(ctx, gb),
      capture: (t, o = {}) => {
        if (o.beat !== undefined) renderBeat(ctx, o.beat);
        else renderAt(ctx, t);
        return canvasToB64(canvas);
      },
      contact: (o) => canvasToB64(contactSheet(ctx, canvas, o)),
      headsCheck: (o) => canvasToB64(headsCheck(o)),
      rigSheet: (o) => canvasToB64(rigSheet(o)),
      beatAt, timeAtBeat, setGrid,
    };
    if (!RENDER) setupPreview(p, canvas, ctx);
    else renderAt(ctx, 0);
  };
});
