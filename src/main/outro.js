// Outro（15 小节）：
//   第 1–2 小节  镜头从第 16 站拉远，展墙 4×4，占画面宽约 85%，每格定格着那一站的他（站立姿势）
//   第 3 小节    下方居中字幕「2000—2026，十六张专辑。」（第 5 小节末淡出）
//   第 5 小节强拍 16 个播放器同时停转
//   第 6 小节    安静的停顿：只有停转后的专辑墙（最后一拍整面墙轻轻暗下，准备点亮）
//   N1–N2（第 7–8 小节）  16 格按 2000→2026 的顺序每个八分音符亮起一格，像钢琴键被依次按下，格下浮出年份
//   N3–N4（第 9–10 小节） 4×4 像胶片一行左一行右交错滑动，再卷成一个圆环，像唱片一样旋转，带金色光尾
//   N5（第 11 小节）      圆环缩成画面中央偏上的一个光点（第 2 拍），停顿半拍后向四周炸开，变成 174 个歌名
//   第 11 小节末–第 13 小节第 2 拍  歌名四散后分批聚拢，拼成侧脸闭眼、一手扶耳的头像（约 4 秒，wordcloud.js）
//   第 13 小节第 3 拍起  头像下方依次浮出三行落款（第三行更大、单独晚半拍），和头像一起定格到全片结束
import { W, H } from './layout.js';
import { sectionById, stationSection, B } from '../beat/time.js';
import { STATIONS } from '../data/stations.js';
import { drawSection } from './film.js';
import { makeCanvas, memo } from '../kit/canvas.js';
import { paperTexture } from '../kit/paper.js';
import { clamp, ease, lerp, smoothstep, TAU } from '../kit/math.js';
import { roundRect, circle } from '../kit/shapes.js';
import { font, SERIF } from '../kit/text.js';
import { drawWordCloud } from './wordcloud.js';
import { drawPlayerKind, playerPalette, spinAt } from '../hud/players.js';
import { drawSubtitle } from '../hud/subtitle.js';
import { GAG } from '../beat/time.js';
import { SCENES } from '../scenes/index.js';

export const OUTRO_LINES = ['2000—2026，十六张专辑。'];
export const FINAL_LINES = ['27年，16张专辑，174首歌', '每一首歌都是我的青春', '谢谢你，JAY'];
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

// ---- 时间点（段内拍位，0 = Outro 第 1 小节强拍） ----
const PULL = B(3, 1);     // 8 拍拉远
const STOP = B(5, 1);     // 播放器停转
const DIM = [B(6, 4), B(7, 1)];          // 第 6 小节最后一拍：整面墙暗下，准备点亮
const N1 = B(7, 1), N3 = B(9, 1), N4 = B(10, 1), N5 = B(11, 1);
const lightAt = (n) => N1 + 0.5 * (n - 1); // 每个八分音符点亮一格
const SLIDE = [N3, N3 + 2];              // 胶片交错滑动
const ROLL = [N3 + 2, N3 + 4.5];         // 卷成圆环
const COLLAPSE = [N5, N5 + 1];           // 圆环缩成一个光点
const POINT = N5 + 1;                    // 光点出现
const BURST = POINT + 0.5;               // 停顿半拍后炸开成歌名
const SIGN_AT = [B(13, 3), B(13, 4), B(14, 1) + 0.5]; // 三行落款（头像拼完后）：第三行单独再晚半拍
const RING = { x: W / 2, y: 350, r: 250, w: 140 };
const PAPER = '#e4ddd0';

function spinPhase(ob) {
  const t = ob - ROLL[0];
  if (t <= 0) return 0;
  const T = N5 - ROLL[0]; // 加速到 N5，之后匀速
  if (t <= T) return 0.1 * t * t;
  return 0.1 * T * T + 0.2 * T * (t - T);
}

/** 第 n 格在 ob 时的位置：{ x, y, w, h, rot }（中心点，屏幕像素）。 */
function cellPose(n, ob) {
  const R = cellRect(n);
  const row = Math.floor((n - 1) / COLS);
  const dir = row % 2 === 0 ? -1 : 1;
  const slide = ease.inOut(clamp((ob - SLIDE[0]) / (SLIDE[1] - SLIDE[0])));
  const g = { x: R.x + R.w / 2 + dir * 240 * slide, y: R.y + R.h / 2, w: R.w, h: R.h, rot: 0 };
  const m = ease.inOut(clamp((ob - ROLL[0]) / (ROLL[1] - ROLL[0])));
  if (m <= 0) return g;
  const c = ease.inOut(clamp((ob - COLLAPSE[0]) / (COLLAPSE[1] - COLLAPSE[0])));
  const th = -Math.PI / 2 + ((n - 1) / 16) * TAU + spinPhase(ob);
  const rr = RING.r * (1 - c);
  const rw = RING.w * (1 - 0.85 * c);
  // 朝向：切线方向，取离 0 最近的等价角，再加转动相位（卷起时只转最短的一边，转动中不跳变）
  const a0 = ((n - 1) / 16) * TAU;
  const rot = Math.atan2(Math.sin(a0), Math.cos(a0)) + spinPhase(ob);
  const ring = { x: RING.x + Math.cos(th) * rr, y: RING.y + Math.sin(th) * rr, w: rw, h: (rw * 9) / 16, rot };
  return { x: lerp(g.x, ring.x, m), y: lerp(g.y, ring.y, m), w: lerp(g.w, ring.w, m), h: lerp(g.h, ring.h, m), rot: lerp(0, ring.rot, m), th, rr };
}

function cellImage(n, ob, gb, sec) {
  if (n === 16 && ob < PULL) {
    // 第 16 格在拉远时还是活的，拉远结束（第 3 小节强拍）定格
    if (!liveCanvas) liveCanvas = makeCanvas(W, H);
    const lc = liveCanvas.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    drawSection(lc, stationSection(16), gb);
    return liveCanvas;
  }
  if (n === 16) return freezeImage(16, sec.start + PULL);
  const sc = SCENES[stationSection(n).id];
  return freezeImage(n, stationSection(n).start + (sc.freezeBeat ?? FREEZE_B));
}

/** 胶片底条：N3 滑动时每一行后面衬一条带片孔的深色胶片。 */
function drawFilmStrips(ctx, ob) {
  const a = smoothstep(SLIDE[0], SLIDE[0] + 0.6, ob) * (1 - smoothstep(ROLL[0], ROLL[0] + 1, ob));
  if (a <= 0.001) return;
  const slide = ease.inOut(clamp((ob - SLIDE[0]) / (SLIDE[1] - SLIDE[0])));
  ctx.save();
  ctx.globalAlpha = a;
  for (let row = 0; row < ROWS; row++) {
    const R = cellRect(row * COLS + 1);
    const dir = row % 2 === 0 ? -1 : 1;
    const y0 = R.y - 18, h = R.h + 36;
    ctx.fillStyle = '#231e1a';
    ctx.fillRect(-20, y0, W + 40, h);
    ctx.fillStyle = PAPER;
    const off = (((dir * 240 * slide) % 44) + 44) % 44;
    for (let x = -44 + off; x < W + 44; x += 44) {
      roundRect(ctx, x, y0 + 4, 22, 9, 2); ctx.fill();
      roundRect(ctx, x, y0 + h - 13, 22, 9, 2); ctx.fill();
    }
  }
  ctx.restore();
}

/** 圆环转动时每格身后的金色光尾。 */
function drawGoldTrails(ctx, ob) {
  const m = ease.inOut(clamp((ob - ROLL[0]) / (ROLL[1] - ROLL[0])));
  const c = ease.inOut(clamp((ob - COLLAPSE[0]) / (COLLAPSE[1] - COLLAPSE[0])));
  const a = smoothstep(0.4, 1, m) * (1 - c);
  if (a <= 0.001) return;
  const speed = Math.min(1, 0.2 * (ob - ROLL[0]));          // 转得越快光尾越长
  const len = 0.15 + 0.55 * speed;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let n = 1; n <= 16; n++) {
    const p = cellPose(n, ob);
    const rr = p.rr ?? RING.r;
    for (let k = 0; k < 6; k++) {
      const t0 = p.th - len * (k + 1) / 6, t1 = p.th - len * k / 6;
      ctx.strokeStyle = `rgba(255, 196, 96, ${(0.32 * a * (1 - k / 6)).toFixed(3)})`;
      ctx.lineWidth = 16 * (1 - k / 7);
      ctx.beginPath();
      ctx.arc(RING.x, RING.y, rr, t0, t1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** N5：圆环缩成的光点——停顿半拍时轻轻呼吸，炸开的一瞬间一闪。 */
function drawLightPoint(ctx, ob) {
  const appear = smoothstep(COLLAPSE[0] + 0.4, POINT, ob);
  const gone = smoothstep(BURST, BURST + 0.45, ob);
  const a = appear * (1 - gone);
  if (a <= 0.001) return;
  const breathe = ob >= POINT && ob < BURST ? Math.sin((Math.PI * (ob - POINT)) / (BURST - POINT)) : 0;
  const r = 22 * (1 + 0.25 * breathe) + 220 * ease.out(clamp((ob - BURST) / 0.45));
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(RING.x, RING.y, 0, RING.x, RING.y, r * 2.4);
  g.addColorStop(0, 'rgba(255, 250, 235, 1)');
  g.addColorStop(0.18, 'rgba(255, 222, 150, 0.95)');
  g.addColorStop(0.5, 'rgba(255, 196, 96, 0.35)');
  g.addColorStop(1, 'rgba(255, 196, 96, 0)');
  ctx.fillStyle = g;
  circle(ctx, RING.x, RING.y, r * 2.4); ctx.fill();
  ctx.restore();
}

/** 格子下方浮出的年份牌。 */
function drawYearTag(ctx, st, p, ob) {
  const t = ob - lightAt(st.n);
  const a = smoothstep(0, 0.35, t) * (1 - smoothstep(SLIDE[0], SLIDE[0] + 1, ob));
  if (a <= 0.001) return;
  const rise = (1 - ease.out(clamp(t / 0.5))) * 14;
  const tw = 108, th = 42;
  const x = p.x - tw / 2, y = p.y + p.h / 2 - th - 10 + rise; // 放在格子里面的底边中间，不压到下一行
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, x + 2, y + 3, tw, th, 8); ctx.fill();
  ctx.fillStyle = '#f4efe4';
  roundRect(ctx, x, y, tw, th, 8); ctx.fill();
  ctx.strokeStyle = '#2c2723'; ctx.lineWidth = 2;
  roundRect(ctx, x, y, tw, th, 8); ctx.stroke();
  font(ctx, 30, { family: SERIF, weight: 700 });
  ctx.fillStyle = '#2a241d';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(st.year), p.x, y + th / 2 + 1);
  ctx.restore();
}

/** 全片落款：头像拼完后，下方依次浮出三行，和头像一起定格到结尾。 */
function drawSignOff(ctx, ob) {
  const ys = [826, 898, 988];
  for (let i = 0; i < 3; i++) {
    const a = smoothstep(SIGN_AT[i], SIGN_AT[i] + 0.9, ob);
    drawSubtitle(ctx, FINAL_LINES[i], W / 2, ys[i], a, { px: i === 2 ? 68 : 50, color: '#2a1d12', weight: i === 2 ? 700 : 400 });
  }
}

export function drawOutro(ctx, gb) {
  const sec = sectionById.outro;
  const ob = gb - sec.start;
  const u = ease.inOut(clamp(ob / PULL));
  // 镜头：从「第 16 格铺满画面」变到「整面墙」（拉远结束后是单位变换）
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
  // 展墙底纸
  const wall = paperTexture(W, H, { base: PAPER, seed: 21, amount: 0.8, fibers: 120 });
  ctx.drawImage(wall, -W * 2, -H * 2, W * 5, H * 5);
  drawFilmStrips(ctx, ob);
  drawGoldTrails(ctx, ob);

  const dimBase = 0.55 * smoothstep(DIM[0], DIM[1], ob);
  const cellsAlpha = 1 - ease.inOut(clamp((ob - COLLAPSE[0]) / (COLLAPSE[1] - COLLAPSE[0])));
  const playersAlpha = smoothstep(B(1, 3), B(2, 3), ob) * (1 - smoothstep(SLIDE[0], SLIDE[0] + 1, ob));
  if (cellsAlpha > 0.001) {
    const tags = [];
    for (const st of STATIONS) {
      const p = cellPose(st.n, ob);
      // 只画在画面里的格子（拉远阶段的裁剪）
      const sx = (p.x - p.w / 2 - cx) * s + W / 2, sy = (p.y - p.h / 2 - cy) * s + H / 2;
      if (sx > W || sy > H || sx + p.w * s < 0 || sy + p.h * s < 0) continue;
      // 点亮：暗下的墙按顺序一格一格亮起，像琴键被按下（轻轻下沉再弹回 + 一闪）
      const t = ob - lightAt(st.n);
      const lit = t >= 0 ? 1 - ease.out(clamp(t / 0.3)) : 1;
      const dim = ob < DIM[0] ? 0 : dimBase * lit;
      const press = t >= 0 ? Math.sin(Math.PI * clamp(t / 0.35)) * 7 : 0;
      const flash = t >= 0 ? 0.5 * Math.exp(-t * 7) : 0;
      const k = p.w / CELL_W;
      ctx.save();
      ctx.globalAlpha = cellsAlpha;
      ctx.translate(p.x, p.y + press);
      ctx.rotate(p.rot);
      // 画框（细边）与阴影
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(-p.w / 2 + 4 * k, -p.h / 2 + 6 * k, p.w, p.h);
      ctx.fillStyle = '#2c2723';
      const b = Math.max(2, 5 * k);
      ctx.fillRect(-p.w / 2 - b, -p.h / 2 - b, p.w + 2 * b, p.h + 2 * b);
      ctx.drawImage(cellImage(st.n, ob, gb, sec), -p.w / 2, -p.h / 2, p.w, p.h);
      if (dim > 0.001) { ctx.fillStyle = `rgba(28, 22, 16, ${dim.toFixed(3)})`; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      if (flash > 0.01) { ctx.fillStyle = `rgba(255, 246, 220, ${flash.toFixed(3)})`; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); }
      // 每格右下角的小播放器：第 5 小节强拍同时停转；胶片滑动开始时淡出
      if (playersAlpha > 0.001) {
        const spinGb = Math.min(gb, sec.start + STOP);
        const settle = ob > STOP ? 0.12 * Math.exp(-(ob - STOP) * 7) * Math.sin((ob - STOP) * 26) : 0;
        const ps = st.player === 'phone' ? 0.3 : 0.36;
        const px = p.w / 2 - (st.player === 'phone' ? 26 : 36), py = p.h / 2 - (st.player === 'phone' ? 40 : 30);
        ctx.globalAlpha = cellsAlpha * playersAlpha;
        drawPlayerKind(ctx, st.player, px, py, ps, spinAt(spinGb) + settle, playerPalette(st), spinGb);
      }
      ctx.restore();
      tags.push([st, { ...p, y: p.y + press }]);
    }
    // 年份牌在所有格子之后画，不会被下一行盖住
    for (const [st, p] of tags) drawYearTag(ctx, st, p, ob);
  }
  drawLightPoint(ctx, ob);
  ctx.restore();
  // 光点炸开 → 歌名四散 → 聚拢成头像 → 定格（屏幕空间；此时镜头已是单位变换）
  if (ob >= BURST) drawWordCloud(ctx, ob - BURST, [RING.x, RING.y]);

  // 字幕（屏幕空间）
  const y = TOP + GRID_H + (H - TOP - GRID_H) / 2 + 18;
  const a1 = smoothstep(B(3, 1), B(3, 1) + 0.8, ob) * (1 - smoothstep(B(5, 4), B(6, 1), ob));
  drawSubtitle(ctx, OUTRO_LINES[0], W / 2, y, a1, { px: 50, color: '#2a241d' });
  drawSignOff(ctx, ob);
}
