// 主调度：成片时间 t → 一帧画面（纯函数）。
// 段落切换用「穿过画框」：下一站以一幅画的形式从右侧出现、变大，路面始终对齐；
// 第 1 拍强拍时画框左沿正好扫过人物，人物在边沿两侧分别用新旧两种画风绘制（形象不变，只换画风）。
import { W, H, K, OX, ROAD_Y, CHAR_X, applyUnits } from './layout.js';
import { beatAt, sections, sectionAt, sectionById, quantizeBeats, TOTAL_BEATS } from '../beat/time.js';
import { SCENES } from '../scenes/index.js';
import { stationByN } from '../data/stations.js';
import { drawWalker } from '../rig/walker.js';
import { STATION_STYLE } from '../rig/styles.js';
import { dist } from './walk.js';
import { pushAt, PUSH_AMOUNT } from './camera.js';
import { figureState, WALK_START } from './figure.js';
import { drawDefaultFrame } from './frame.js';
import { drawTitleCard } from '../hud/titlecard.js';
import { drawPlayerHUD } from '../hud/players.js';
import { drawOutro } from './outro.js';
import { keyframes, ease } from '../kit/math.js';

export const CHAR_PX = OX + CHAR_X * K;
export const ROAD_PX = ROAD_Y * K;
const LEAD = 2;      // 画框提前 2 拍（第 7–8 拍）出现
export const TAIL = 0.4; // 强拍后 0.4 拍画框完全扫出画面

const sceneOf = (sec) => SCENES[sec.id];
/** 镜头累计平移：人物开始走（Intro 第 3 小节）之前镜头不动。 */
const camDist = (gb) => dist(Math.max(gb, WALK_START));

/** 某段落在全局拍位 gb 时的环境。 */
export function envFor(sec, gb, extra = {}) {
  const scene = sceneOf(sec);
  let b = gb - sec.start;
  if (scene.quantize) b = quantizeBeats(b, scene.quantize);
  const st = sec.station ? stationByN(sec.station) : null;
  return {
    sec, scene, st, gb, b,
    gbq: sec.start + b,
    cam: camDist(gb) - camDist(sec.start), // 镜头平移不量化
    /** 段内第 b 拍时镜头的位置（场景用来把布景放在梗发生时的画面位置上） */
    camAt: (bb) => camDist(sec.start + bb) - camDist(sec.start),
    /** 人物这一帧画在哪、什么姿势：{ x, y, scale, pose, ... }（前景层把东西挂到人物身上时用） */
    figure() { return figurePlacement(this); },
    ...extra,
  };
}

/** 画一个段落的背景/前景（像素空间 ctx，内部切到单位空间）。 */
export function drawSceneLayers(ctx, env, { back = true, front = true } = {}) {
  const { scene, b } = env;
  ctx.save();
  applyUnits(ctx);
  if (back) scene.drawBack(ctx, b, env);
  if (front && scene.drawFront) scene.drawFront(ctx, b, env);
  ctx.restore();
}

/** 在像素空间画人物（站位固定在 CHAR_PX, ROAD_PX）。 */
export function drawFigureFor(ctx, env, { forceStand = false } = {}) {
  const { scene, b } = env;
  const fig = figurePlacement(env, { forceStand });
  if (fig.hidden) return;
  ctx.save();
  applyUnits(ctx);
  ctx.translate(fig.x, fig.y);
  if (fig.sx !== 1 || fig.scale !== 1) ctx.scale(fig.scale * fig.sx, fig.scale);
  if (fig.alpha !== undefined) ctx.globalAlpha = fig.alpha;
  if (scene.drawFigure) scene.drawFigure(ctx, fig, b, env);
  else drawWalker(ctx, fig);
  ctx.restore();
}

/** 人物这一帧画在哪、什么姿势（场景的前景层用它把东西挂到人物身上）。 */
export function figurePlacement(env, { forceStand = false } = {}) {
  const { scene, sec, b } = env;
  const adj = (scene.figureAdjust && scene.figureAdjust(b, env)) || {};
  const st = figureState(env.gbq, env);
  forceStand = forceStand || !!env.forceStand;
  return {
    hidden: !!adj.hidden,
    x: CHAR_X + (adj.dx || 0), y: ROAD_Y + (adj.dy || 0),
    scale: adj.scale || 1, sx: adj.sx || 1, alpha: adj.alpha,
    pose: forceStand ? 'stand' : adj.pose || st.pose,
    phase: st.phase,
    lean: st.lean + (adj.rotate || 0),
    style: adj.style || scene.figureStyle || (sec.station ? STATION_STYLE[sec.station] : 'comic'),
  };
}


/** 一个段落的完整画面（背景 + 人物 + 前景）。 */
export function drawSection(ctx, sec, gb, { figure = true, stand = false } = {}) {
  const env = envFor(sec, gb, { forceStand: stand });
  drawSceneLayers(ctx, env, { front: false });
  if (figure) drawFigureFor(ctx, env, { forceStand: stand });
  drawSceneLayers(ctx, env, { back: false });
  return env;
}

/** 当前是否处于某道画框转场里。 */
export function transitionAt(gb) {
  for (const s of sections) {
    if (!s.station) continue;
    const x = gb - s.start;
    if (x >= -LEAD && x < TAIL) {
      const prev = sections[sections.indexOf(s) - 1];
      return { prev, next: s, x };
    }
  }
  return null;
}

/** 画框内沿（像素）：左沿 E、缩放 s，路面高度保持一致。 */
export function frameRect(x) {
  // 前 1.5 拍缓缓靠近；最后半拍加速，强拍上左沿正好压过人物，之后 0.4 拍内猛地扫出画面
  const lin = (t) => t;
  const E = keyframes([[-LEAD, W + 90], [-0.5, CHAR_PX + 90, ease.inOut], [0, CHAR_PX, lin], [TAIL, 0, ease.out]], x);
  const s = keyframes([[-LEAD, 0.36], [-0.5, 0.74, ease.inOut], [0, 0.9, lin], [TAIL, 1, ease.out]], x);
  return { E, s, x: E, y: ROAD_PX * (1 - s), w: W * s, h: H * s };
}

function zoomAbout(ctx, z, ax, ay) {
  ctx.translate(ax, ay);
  ctx.scale(z, z);
  ctx.translate(-ax, -ay);
}

/** 主入口：在 ctx（1920×1080）上画出时刻 t。 */
export function renderAt(ctx, t) {
  renderBeat(ctx, beatAt(t));
}

export function renderBeat(ctx, gb) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  if (gb >= sectionById.outro.start) {
    drawOutro(ctx, gb);
    return;
  }
  const z = 1 + PUSH_AMOUNT * pushAt(gb);
  ctx.save();
  zoomAbout(ctx, z, CHAR_PX, ROAD_PX - 180 * K);
  const tr = transitionAt(gb);
  if (!tr) {
    drawSection(ctx, sectionAt(gb), gb);
  } else {
    drawTransition(ctx, tr, gb);
  }
  ctx.restore();
  drawHUD(ctx, gb);
}

function drawTransition(ctx, tr, gb) {
  const { prev, next, x } = tr;
  const R = frameRect(x);
  const envPrev = envFor(prev, gb);
  const envNext = envFor(next, gb);
  // 旧站铺满
  drawSceneLayers(ctx, envPrev, { front: false });
  drawSceneLayers(ctx, envPrev, { back: false });
  // 新站在画框里
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.x, R.y, R.w, R.h);
  ctx.clip();
  ctx.translate(R.E, ROAD_PX * (1 - R.s));
  ctx.scale(R.s, R.s);
  drawSceneLayers(ctx, envNext);
  ctx.restore();
  // 画框（属于正在离开的那一站，可自定义）
  const sc = envPrev.scene;
  if (sc.drawFrame) sc.drawFrame(ctx, R, envPrev);
  else drawDefaultFrame(ctx, R, R.s);
  // 人物：画框左沿左侧是旧画风，右侧是新画风
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, Math.max(0, R.E), H);
  ctx.clip();
  drawFigureFor(ctx, envPrev);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(R.E, 0, W - R.E, H);
  ctx.clip();
  drawFigureFor(ctx, envNext);
  ctx.restore();
}

function drawHUD(ctx, gb) {
  for (const s of sections) {
    if (!s.station) continue;
    const b = gb - s.start;
    if (b < 0 || b > s.beats) continue;
    const st = stationByN(s.station);
    const scene = sceneOf(s);
    drawTitleCard(ctx, st, b, scene.cardStyle || {});
    drawPlayerHUD(ctx, st, b, gb, W, H, scene.playerStyle || {});
  }
}

export { TOTAL_BEATS };
