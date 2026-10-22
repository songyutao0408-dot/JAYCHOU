// 默认画法（干净的漫画线稿 + 平涂）。各站可以写自己的画法替换它，
// 但都吃同一份 pose（skeleton.js）和 look（look.js），所以换风格时动作连续。
// 坐标：人物局部坐标（根点在脚下地面，朝右），单位与场景单位一致。
import { capsule, smoothPath, ellipse, circle, poly, tube } from '../kit/shapes.js';
import { drawHead, SKIN, HEADPHONE_RED } from './head.js';
import { BONES } from './skeleton.js';

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];
/** 漫画比例：头画大一点 */
export const HEAD_SCALE = 1.28;

/** 默认画风参数；station 可以覆盖其中任何一项。 */
export const DEFAULT_STYLE = {
  ink: '#1d1b1a', lw: 2.6, skin: SKIN, red: HEADPHONE_RED,
  color: (hex) => hex, // 衣服颜色映射（比如单色画风把彩色压成灰阶）
  shade: true,
  view: 'side',
  headTreatment: { type: 'none' },
};

export function drawFigure(ctx, pose, look, style = {}) {
  const S = { ...DEFAULT_STYLE, ...style };
  const C = (k) => S.color(look.colors[k]);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = S.ink;
  ctx.lineWidth = S.lw;
  const b = look.build;
  const f = [Math.cos(pose.tilt), Math.sin(pose.tilt)]; // 向前
  const up = pose.up;

  const limb = (a, c, ra, rc, fill) => {
    capsule(ctx, a, c, ra, rc);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.stroke();
  };
  const shoe = (leg, near) => {
    const { heel, toe, ankle } = leg;
    const col = S.color(look.colors.shoe);
    const sole = S.color(look.colors.sole);
    const big = look.shoes === 'canvas' ? 1.05 : 1;
    const dx = toe[0] - heel[0], dy = toe[1] - heel[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const nx = uy, ny = -ux; // 指向脚背（上方）
    const h = 11 * big;
    const pts = [
      add(heel, [nx, ny], 1), add(heel, [nx, ny], h * 0.9), add(ankle, [nx, ny], 5),
      [toe[0] + nx * h * 0.55 - ux * 6, toe[1] + ny * h * 0.55 - uy * 6], add(toe, [ux, uy], 3 * big), add(toe, [nx, ny], 1),
    ];
    smoothPath(ctx, pts, true);
    ctx.fillStyle = col; ctx.fill(); ctx.stroke();
    ctx.lineWidth = S.lw * 1.6;
    ctx.strokeStyle = sole;
    ctx.beginPath(); ctx.moveTo(heel[0] - ux, heel[1] - uy + 1); ctx.lineTo(toe[0] + ux * 3, toe[1] + uy * 3 + 1); ctx.stroke();
    ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw;
    if (look.shoes === 'canvas') {
      ctx.lineWidth = S.lw * 0.6;
      ctx.beginPath(); ctx.moveTo(ankle[0] + 2, ankle[1] - 1); ctx.lineTo(toe[0] - ux * 10 + nx * 6, toe[1] - uy * 10 + ny * 6); ctx.stroke();
      ctx.lineWidth = S.lw;
    }
  };
  const leg = (L, near) => {
    const pants = near ? C('pants') : darken(C('pants'), 0.82);
    shoe(L, near);
    tube(ctx, [L.hip, L.knee, L.ankle], [15 * b, 12 * b, 10 * b]);
    ctx.fillStyle = pants; ctx.fill(); ctx.stroke();
  };
  const arm = (A, near) => {
    const sleeve = near ? C('outer') : darken(C('outer'), 0.8);
    // 手（在袖口下面）
    const hx = A.hand[0] + (A.hand[0] - A.wrist[0]) * 0.6, hy = A.hand[1] + (A.hand[1] - A.wrist[1]) * 0.6;
    ellipse(ctx, hx, hy, 9, 10.5, A.angle);
    ctx.fillStyle = near ? S.skin : darken(S.skin, 0.88);
    ctx.fill(); ctx.stroke();
    const cuff = look.outfit === 'trench' || look.outfit === 'jacket' ? 0.96 : 0.9;
    const w2 = [A.elbow[0] + (A.wrist[0] - A.elbow[0]) * cuff, A.elbow[1] + (A.wrist[1] - A.elbow[1]) * cuff];
    tube(ctx, [A.shoulder, A.elbow, w2], [13 * b, 11 * b, 10 * b]);
    ctx.fillStyle = sleeve; ctx.fill(); ctx.stroke();
  };

  // 1) 远侧手臂、远侧腿
  arm(pose.arms.far, false);
  leg(pose.legs.far, false);
  // 风衣后摆在腿后面
  if (look.outfit === 'trench') coatTail(ctx, pose, look, S, C, f, up, true);
  leg(pose.legs.near, true);

  // 2) 躯干
  const hip = pose.hip, sh = pose.shoulder, ch = pose.chest;
  const back = 25 * b, front = 23 * b;
  const hemY = look.outfit === 'trench' ? 0 : 8;
  const hipB = add(add(hip, up, -hemY), f, -back + 1);
  const hipF = add(add(hip, up, -hemY), f, front - 1);
  const torso = [hipB, add(add(ch, f, -back - 1), up, 0), add(add(sh, f, -back + 6), up, 4), add(sh, up, 9),
    add(add(sh, f, front - 4), up, 3), add(ch, f, front + 3), hipF];
  smoothPath(ctx, torso, true);
  ctx.fillStyle = C('outer');
  ctx.fill();
  ctx.save();
  ctx.clip();
  torsoDetail(ctx, pose, look, S, C, f, up, back, front);
  ctx.restore();
  smoothPath(ctx, torso, true);
  ctx.stroke();
  if (look.outfit === 'trench') coatTail(ctx, pose, look, S, C, f, up, false);

  // 3) 红耳机（头带和远侧耳罩在脖子后）
  const neckBase = add(sh, up, 6);
  const neckTop = pose.neckTop;
  ctx.lineWidth = S.lw * 2.2;
  ctx.strokeStyle = S.red;
  ctx.beginPath();
  const farCup = add(add(neckBase, f, -15), up, 2);
  const nearCup = add(add(neckBase, f, 13), up, 2);
  ctx.moveTo(farCup[0], farCup[1]);
  ctx.quadraticCurveTo(neckBase[0] - f[0] * 30 + up[0] * 22, neckBase[1] - f[1] * 30 + up[1] * 22, neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
  ctx.stroke();
  ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw;
  ellipse(ctx, farCup[0], farCup[1], 8, 10.5, pose.tilt + 0.5);
  ctx.fillStyle = darken(S.red, 0.75); ctx.fill(); ctx.stroke();

  // 4) 脖子 + 头
  limb(neckBase, neckTop, 7.5, 7, S.skin);
  ctx.save();
  ctx.translate(neckTop[0], neckTop[1] + 6);
  ctx.rotate(pose.headTilt);
  ctx.scale(HEAD_SCALE, HEAD_SCALE);
  drawHead(ctx, look, { view: S.view, ink: S.ink, lw: S.lw, skin: S.skin, sceneId: S.sceneId, treatment: S.headTreatment, hairColor: S.color(look.colors.hair) });
  ctx.restore();

  // 5) 近侧耳罩（在胸前）
  ctx.lineWidth = S.lw * 2.2;
  ctx.strokeStyle = S.red;
  ctx.beginPath();
  ctx.moveTo(neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
  ctx.quadraticCurveTo(nearCup[0] + up[0] * 16 + f[0] * 4, nearCup[1] + up[1] * 16 + f[1] * 4, nearCup[0], nearCup[1]);
  ctx.stroke();
  ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw;
  ellipse(ctx, nearCup[0], nearCup[1], 9, 12, pose.tilt - 0.35);
  ctx.fillStyle = S.red; ctx.fill(); ctx.stroke();
  ellipse(ctx, nearCup[0] + 1.5, nearCup[1] - 1, 4.5, 6.5, pose.tilt - 0.35);
  ctx.fillStyle = darken(S.red, 0.7); ctx.fill();

  // 6) 近侧手臂
  arm(pose.arms.near, true);
  ctx.restore();
}

function torsoDetail(ctx, pose, look, S, C, f, up, back, front) {
  const hip = pose.hip, sh = pose.shoulder;
  ctx.lineWidth = S.lw * 0.7;
  if (look.outfit === 'tee-plaid') {
    // 格子：横竖两组色线
    ctx.strokeStyle = S.color(look.colors.outer2);
    ctx.globalAlpha = 0.75;
    for (let k = -6; k <= 6; k++) {
      ctx.lineWidth = k % 2 ? 1.6 : 3.4;
      const a = add(add(hip, up, k * 16), f, -40), c = add(add(hip, up, k * 16), f, 40);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke();
      const d = add(add(hip, f, k * 9), up, -20), e = add(add(hip, f, k * 9), up, 130);
      ctx.beginPath(); ctx.moveTo(...d); ctx.lineTo(...e); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // 敞开的前襟露出白 T
    const strip = [add(add(hip, f, front - 9), up, -12), add(add(hip, f, front + 10), up, -12), add(add(sh, f, front + 10), up, 10), add(add(sh, f, front - 6), up, 10)];
    poly(ctx, strip);
    ctx.fillStyle = C('top');
    ctx.fill();
    ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw * 0.8;
    ctx.beginPath(); ctx.moveTo(...add(add(hip, f, front - 9), up, -10)); ctx.lineTo(...add(add(sh, f, front - 6), up, 4)); ctx.stroke();
  } else if (look.outfit === 'jacket') {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(...add(add(hip, f, front - 4), up, -8)); ctx.lineTo(...add(add(sh, f, front - 6), up, 2)); ctx.stroke();
    // 领口与下摆罗纹
    ctx.fillStyle = S.color(look.colors.outer2);
    poly(ctx, [add(add(hip, f, -40), up, 0), add(add(hip, f, 40), up, 0), add(add(hip, f, 40), up, 14), add(add(hip, f, -40), up, 14)]);
    ctx.fill();
    ctx.fillStyle = C('top');
    poly(ctx, [add(add(sh, f, front - 14), up, 8), add(add(sh, f, front + 4), up, 8), add(add(sh, f, front - 2), up, -14)]);
    ctx.fill();
  } else if (look.outfit === 'cardigan') {
    ctx.strokeStyle = 'rgba(0,0,0,0.12)';
    ctx.lineWidth = 1.4;
    for (let k = 0; k < 16; k++) {
      const a = add(add(hip, up, k * 7.5), f, -40), c = add(add(hip, up, k * 7.5), f, 40);
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...c); ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.fillStyle = C('top');
    poly(ctx, [add(add(sh, f, front - 16), up, 10), add(add(sh, f, front + 6), up, 10), add(add(sh, f, front + 2), up, -46)]);
    ctx.fill();
    ctx.fillStyle = darken(C('outer'), 0.8);
    for (let k = 0; k < 3; k++) { circle(ctx, ...add(add(hip, f, front - 2), up, 26 + k * 20), 2.2); ctx.fill(); }
  } else if (look.outfit === 'trench') {
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = S.lw * 0.8;
    // 腰带
    ctx.fillStyle = S.color(look.colors.outer2);
    poly(ctx, [add(add(hip, f, -40), up, 22), add(add(hip, f, 40), up, 22), add(add(hip, f, 40), up, 32), add(add(hip, f, -40), up, 32)]);
    ctx.fill(); ctx.stroke();
    // 翻领
    ctx.fillStyle = darken(C('outer'), 0.9);
    poly(ctx, [add(add(sh, f, front - 18), up, 8), add(add(sh, f, front + 6), up, 8), add(add(sh, f, front + 4), up, -40), add(add(sh, f, front - 6), up, -24)]);
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = C('top');
    poly(ctx, [add(add(sh, f, front - 10), up, 9), add(add(sh, f, front + 2), up, 9), add(add(sh, f, front - 2), up, -10)]);
    ctx.fill();
  }
}

function coatTail(ctx, pose, look, S, C, f, up, behind) {
  // 风衣下摆：从腰到膝下，前后片跟着两腿摆动
  const hip = pose.hip;
  const down = [-up[0], -up[1]];
  const L = BONES.thigh * 1.05;
  const kn = pose.legs.near.knee, kf = pose.legs.far.knee;
  const fx = Math.max(kn[0], kf[0]) - hip[0], bx = Math.min(kn[0], kf[0]) - hip[0];
  if (behind) {
    const pts = [add(hip, f, -24), [hip[0] + bx * 0.9 - 30, hip[1] + L + 4], [hip[0] + fx * 0.4, hip[1] + L + 8], add(hip, f, 10)];
    poly(ctx, pts);
    ctx.fillStyle = darken(C('outer'), 0.78);
    ctx.fill(); ctx.stroke();
    return;
  }
  const pts = [add(add(hip, up, 26), f, -26), add(hip, f, -27), [hip[0] + bx * 0.55 - 30, hip[1] + L], [hip[0] + fx * 0.75 + 26, hip[1] + L + 2], add(hip, f, 26), add(add(hip, up, 26), f, 25)];
  smoothPath(ctx, pts, true);
  ctx.fillStyle = C('outer');
  ctx.fill(); ctx.stroke();
  // 前襟开衩
  ctx.beginPath();
  const mid = [hip[0] + (fx * 0.75 + bx * 0.55) / 2 + 4, hip[1] + L + 1];
  ctx.moveTo(...add(hip, f, 14)); ctx.lineTo(...mid); ctx.stroke();
  void down;
}

export function darken(hex, k) {
  if (!hex.startsWith('#')) return hex;
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16) * k, g = parseInt(v.slice(2, 4), 16) * k, b2 = parseInt(v.slice(4, 6), 16) * k;
  return `rgb(${r | 0},${g | 0},${b2 | 0})`;
}
