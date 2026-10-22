// Outro（6 小节）：
//   第 1–2 小节  镜头从第 16 站拉远，展墙 4×4，占画面宽约 85%，每格定格着那一站的他（站立姿势）
//   第 3 小节    下方居中字幕「2000—2026，十六张专辑。」
//   第 5 小节强拍 16 个播放器同时停转
//   第 6 小节    最后一行字幕「下一站，未完待续。」定格
import { W, H } from './layout.js';
import { sectionById, stationSection, B } from '../beat/time.js';
import { STATIONS } from '../data/stations.js';
import { drawSection } from './film.js';
import { makeCanvas, memo } from '../kit/canvas.js';
import { paperTexture } from '../kit/paper.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';
import { drawPlayerKind, playerPalette, spinAt } from '../hud/players.js';
import { drawSubtitle } from '../hud/subtitle.js';
import { GAG } from '../beat/time.js';
import { SCENES } from '../scenes/index.js';

export const OUTRO_LINES = ['2000—2026，十六张专辑。', '下一站，未完待续。'];
const COLS = 4, ROWS = 4, GAP = 16;
const GRID_W = W * 0.85;
const CELL_W = (GRID_W - GAP * (COLS - 1)) / COLS;
const CELL_H = (CELL_W * 9) / 16;
const GRID_H = CELL_H * ROWS + GAP * (ROWS - 1);
const LEFT = (W - GRID_W) / 2;
const TOP = 34;
const FREEZE_B = GAG + 1.5; // 1–15 站定格在梗的中段（第 10.5 拍，人物为站立姿势）
const CACHE_SCALE = 2 / 3; // 定格图 1280×720

export function cellRect(n) {
  const i = n - 1, c = i % COLS, r = Math.floor(i / COLS);
  return { x: LEFT + c * (CELL_W + GAP), y: TOP + r * (CELL_H + GAP), w: CELL_W, h: CELL_H };
}

function freezeImage(n, gbFreeze) {
  return memo(`freeze|${n}|${gbFreeze.toFixed(4)}`, () => {
    const c = makeCanvas(W * CACHE_SCALE, H * CACHE_SCALE);
    const ctx = c.getContext('2d');
    ctx.scale(CACHE_SCALE, CACHE_SCALE);
    drawSection(ctx, stationSection(n), gbFreeze, { stand: true });
    return c;
  });
}

let liveCanvas = null;

export function drawOutro(ctx, gb) {
  const sec = sectionById.outro;
  const ob = gb - sec.start;
  const PULL = B(3, 1); // 8 拍拉远
  const u = ease.inOut(clamp(ob / PULL));
  // 镜头：从「第 16 格铺满画面」变到「整面墙」
  const r16 = cellRect(16);
  const S0 = W / r16.w;
  const s = Math.exp(lerp(Math.log(S0), 0, u));
  const w = (1 / s - 1 / S0) / (1 - 1 / S0);
  const c0 = [r16.x + r16.w / 2, r16.y + r16.h / 2];
  const cx = lerp(c0[0], W / 2, w), cy = lerp(c0[1], H / 2, w);

  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.translate(-cx, -cy);
  // 展墙
  const wall = paperTexture(W, H, { base: '#e4ddd0', seed: 21, amount: 0.8, fibers: 120 });
  ctx.drawImage(wall, -W * 2, -H * 2, W * 5, H * 5);
  for (const st of STATIONS) {
    const R = cellRect(st.n);
    // 只画在画面里的格子
    const sx = (R.x - cx) * s + W / 2, sy = (R.y - cy) * s + H / 2;
    if (sx > W || sy > H || sx + R.w * s < 0 || sy + R.h * s < 0) continue;
    // 画框（细边）与阴影
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(R.x + 4, R.y + 6, R.w, R.h);
    ctx.fillStyle = '#2c2723';
    ctx.fillRect(R.x - 5, R.y - 5, R.w + 10, R.h + 10);
    let img;
    if (st.n === 16 && ob < PULL) {
      // 第 16 格在拉远时还是活的，拉远结束（第 3 小节强拍）定格
      if (!liveCanvas) liveCanvas = makeCanvas(W, H);
      const lc = liveCanvas.getContext('2d');
      lc.setTransform(1, 0, 0, 1, 0, 0);
      drawSection(lc, stationSection(16), gb);
      img = liveCanvas;
    } else if (st.n === 16) {
      img = freezeImage(16, sec.start + PULL);
    } else {
      const sc = SCENES[stationSection(st.n).id];
      img = freezeImage(st.n, stationSection(st.n).start + (sc.freezeBeat ?? FREEZE_B));
    }
    ctx.drawImage(img, R.x, R.y, R.w, R.h);
    // 每格右下角的小播放器：第 5 小节强拍同时停转
    const STOP = B(5, 1);
    const spinGb = Math.min(gb, sec.start + STOP);
    const settle = ob > STOP ? 0.12 * Math.exp(-(ob - STOP) * 7) * Math.sin((ob - STOP) * 26) : 0;
    const ps = st.player === 'phone' ? 0.3 : 0.36;
    const px = R.x + R.w - (st.player === 'phone' ? 26 : 36), py = R.y + R.h - (st.player === 'phone' ? 40 : 30);
    const appear = smoothstep(B(1, 3), B(2, 3), ob);
    if (appear > 0) {
      ctx.save();
      ctx.globalAlpha = appear;
      drawPlayerKind(ctx, st.player, px, py, ps, spinAt(spinGb) + settle, playerPalette(st), spinGb);
      ctx.restore();
    }
  }
  ctx.restore();

  // 字幕（屏幕空间）
  const y = TOP + GRID_H + (H - TOP - GRID_H) / 2 + 18;
  const a1 = smoothstep(B(3, 1), B(3, 1) + 0.8, ob) * (1 - smoothstep(B(5, 4), B(6, 1), ob));
  const a2 = smoothstep(B(6, 1), B(6, 1) + 0.8, ob);
  drawSubtitle(ctx, OUTRO_LINES[0], W / 2, y, a1, { px: 50, color: '#2a241d' });
  drawSubtitle(ctx, OUTRO_LINES[1], W / 2, y, a2, { px: 50, color: '#2a241d', weight: 700 });
}
