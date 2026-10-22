// 默认画法：细描边 + 平涂 + 简单的赛璐璐明暗，向头像（插画风、细轮廓线）靠拢。
// 各站可以写自己的画法替换它，但都吃同一份 pose（skeleton.js）和 LOOK（look.js），换风格时动作连续。
// 坐标：人物局部坐标（根点在脚下地面，朝右），单位与场景单位一致。
// 光从前上方来：每块形状的背面和下沿压暗一条。
import { smoothPath, ellipse, poly, tube } from '../kit/shapes.js';
import { drawHead, HEADPHONE_RED } from './head.js';
import { mix } from '../kit/color.js';

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k];

/** 默认画风参数；station 可以覆盖其中任何一项。 */
export const DEFAULT_STYLE = {
  ink: '#1a1514',
  lw: 1.2,            // 与头像轮廓线粗细一致（头像约 7px/1024 × 145 单位 ≈ 1 单位）
  skin: null,         // null = 用 LOOK 里与头像一致的肤色
  red: HEADPHONE_RED,
  color: (hex) => hex, // 颜色映射（比如单色画风把彩色压成灰阶）；肤色也走这里，保持与头像处理一致
  shade: 0.78,        // 暗部 = 底色 × shade；设为 1 关闭明暗
  headTreatment: { type: 'none' },
};

export function drawFigure(ctx, pose, look, style = {}) {
  const S = { ...DEFAULT_STYLE, ...style };
  const C = (k) => S.color(look.colors[k]);
  const skin = S.skin || C('skin');
  const skinShade = S.skin ? darken(S.skin, 0.86) : C('skinShade');
  const shadeOf = (c) => (S.shade >= 1 ? c : darken(c, S.shade));
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = S.ink;
  ctx.lineWidth = S.lw;
  const b = look.build;
  const f = [Math.cos(pose.tilt), Math.sin(pose.tilt)]; // 向前
  const up = pose.up;

  // 赛璐璐明暗：先整块涂暗色，再把亮色版本向光源方向错开一点叠上，留出背光一侧的暗边
  const cel = (path, base, shade, dx = 3.5, dy = -2) => {
    path(); ctx.fillStyle = shade; ctx.fill();
    if (shade !== base) {
      ctx.save(); path(); ctx.clip();
      ctx.translate(dx, dy); path(); ctx.fillStyle = base; ctx.fill();
      ctx.restore();
    }
    path(); ctx.stroke();
  };

  const shoe = (leg) => {
    const { heel, toe, ankle } = leg;
    const col = C('shoe'), sole = C('sole');
    const dx = toe[0] - heel[0], dy = toe[1] - heel[1];
    const L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    const nx = uy, ny = -ux; // 指向脚背（上方）
    const h = 15;
    const pts = [
      add(heel, [nx, ny], 1), add(heel, [nx, ny], h * 0.95), add(ankle, [nx, ny], 9),
      [toe[0] + nx * h * 0.55 - ux * 6, toe[1] + ny * h * 0.55 - uy * 6], add(toe, [ux, uy], 3), add(toe, [nx, ny], 1),
    ];
    cel(() => smoothPath(ctx, pts, true), col, shadeOf(col), 2.5, -2.5);
    // 鞋底
    const soleP = [add(heel, [nx, ny], 4.5), add(heel, [ux, uy], -1.5), add(toe, [ux, uy], 3), add(toe, [nx, ny], 4.5)];
    poly(ctx, soleP);
    ctx.fillStyle = sole; ctx.fill(); ctx.stroke();
  };
  const leg = (L, near) => {
    const pants = near ? C('pants') : darken(C('pants'), 0.82);
    cel(() => tube(ctx, [L.hip, L.knee, L.ankle], [15 * b, 12 * b, 10 * b]), pants, shadeOf(pants));
    shoe(L); // 鞋压在裤脚上
  };
  const arm = (A, near) => {
    const sleeve = near ? C('outer') : darken(C('outer'), 0.8);
    const hx = A.hand[0] + (A.hand[0] - A.wrist[0]) * 0.6, hy = A.hand[1] + (A.hand[1] - A.wrist[1]) * 0.6;
    const handC = near ? skin : darken(skin, 0.9);
    cel(() => ellipse(ctx, hx, hy, 9, 10.5, A.angle), handC, near ? skinShade : darken(skinShade, 0.9), 2.5, -2);
    const w2 = [A.elbow[0] + (A.wrist[0] - A.elbow[0]) * 0.96, A.elbow[1] + (A.wrist[1] - A.elbow[1]) * 0.96];
    cel(() => tube(ctx, [A.shoulder, A.elbow, w2], [13 * b, 11 * b, 10 * b]), sleeve, mix(sleeve, '#000000', 0.35));
    // 袖口
    ctx.save();
    ctx.lineWidth = S.lw * 0.8;
    const d = [w2[0] - A.elbow[0], w2[1] - A.elbow[1]], dl = Math.hypot(...d) || 1;
    const n = [-d[1] / dl, d[0] / dl];
    const c0 = [w2[0] - (d[0] / dl) * 5, w2[1] - (d[1] / dl) * 5];
    ctx.beginPath(); ctx.moveTo(c0[0] + n[0] * 10, c0[1] + n[1] * 10); ctx.lineTo(c0[0] - n[0] * 10, c0[1] - n[1] * 10); ctx.stroke();
    ctx.restore();
  };

  // 1) 远侧手臂、两条腿
  arm(pose.arms.far, false);
  leg(pose.legs.far, false);
  leg(pose.legs.near, true);

  // 2) 躯干（敞开的夹克，前襟露出白 T）
  const hip = pose.hip, sh = pose.shoulder, ch = pose.chest;
  const back = 25 * b, front = 23 * b;
  const hipB = add(add(hip, up, -8), f, -back + 1);
  const hipF = add(add(hip, up, -8), f, front - 1);
  const torso = [hipB, add(ch, f, -back - 1), add(add(sh, f, -back + 6), up, 4), add(sh, up, 9),
    add(add(sh, f, front - 4), up, 3), add(ch, f, front + 3), hipF];
  const outer = C('outer');
  cel(() => smoothPath(ctx, torso, true), outer, mix(outer, '#000000', 0.35), 6, -3);
  ctx.save();
  smoothPath(ctx, torso, true);
  ctx.clip();
  torsoDetail(ctx, pose, S, C, f, up, front);
  ctx.restore();
  smoothPath(ctx, torso, true);
  ctx.stroke();

  // 3) 红耳机：头带和远侧耳罩在脖子后
  const neckBase = add(sh, up, 6);
  const farCup = add(add(neckBase, f, -15), up, 2);
  const nearCup = add(add(neckBase, f, 13), up, 2);
  const band = () => {
    ctx.lineWidth = 5.5;
    ctx.strokeStyle = S.ink;
    ctx.stroke();
    ctx.lineWidth = 3.4;
    ctx.strokeStyle = S.red;
    ctx.stroke();
    ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw;
  };
  ctx.beginPath();
  ctx.moveTo(farCup[0], farCup[1]);
  ctx.quadraticCurveTo(neckBase[0] - f[0] * 30 + up[0] * 22, neckBase[1] - f[1] * 30 + up[1] * 22, neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
  band();
  cel(() => ellipse(ctx, farCup[0], farCup[1], 8, 10.5, pose.tilt + 0.5), darken(S.red, 0.8), darken(S.red, 0.6), 2, -1.5);

  // 4) 头（素材或占位头），原点在领口
  ctx.save();
  ctx.translate(neckBase[0], neckBase[1]);
  ctx.rotate(pose.tilt);
  ctx.translate(0, 5); // 头像的脖子较长，往领口里收一点
  drawHead(ctx, look, {
    sceneId: S.sceneId, treatment: S.headTreatment, tilt: pose.headTilt - pose.tilt,
    ink: S.ink, lw: S.lw, skin, hairColor: C('hair'),
  });
  ctx.restore();

  // 5) 夹克立领（压住脖子根部）
  const collar = [add(add(sh, f, -back + 8), up, 2), add(add(sh, f, -12), up, 15), add(add(sh, f, 2), up, 13), add(add(sh, f, 6), up, 4)];
  cel(() => smoothPath(ctx, collar, true), outer, mix(outer, '#000000', 0.35), 3, -1);

  // 6) 近侧耳罩（在胸前）
  ctx.beginPath();
  ctx.moveTo(neckBase[0] + up[0] * 18, neckBase[1] + up[1] * 18);
  ctx.quadraticCurveTo(nearCup[0] + up[0] * 16 + f[0] * 4, nearCup[1] + up[1] * 16 + f[1] * 4, nearCup[0], nearCup[1]);
  band();
  cel(() => ellipse(ctx, nearCup[0], nearCup[1], 9, 12, pose.tilt - 0.35), S.red, darken(S.red, 0.72), 2.5, -2);
  ellipse(ctx, nearCup[0] + 1.5, nearCup[1] - 1, 4.5, 6.5, pose.tilt - 0.35);
  ctx.fillStyle = darken(S.red, 0.62); ctx.fill();
  // 高光
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.ellipse(nearCup[0], nearCup[1], 6.5, 9.5, pose.tilt - 0.35, -2.6, -1.6); ctx.stroke();
  ctx.strokeStyle = S.ink; ctx.lineWidth = S.lw;

  // 7) 近侧手臂
  arm(pose.arms.near, true);
  ctx.restore();
}

function torsoDetail(ctx, pose, S, C, f, up, front) {
  const hip = pose.hip, sh = pose.shoulder;
  // 白 T：前襟敞开处露出的一条
  const tee = C('top');
  const strip = [add(add(hip, f, front - 11), up, -12), add(add(hip, f, front + 12), up, -12), add(add(sh, f, front + 12), up, 12), add(add(sh, f, front - 8), up, 12)];
  poly(ctx, strip);
  ctx.fillStyle = darken(tee, 0.86);
  ctx.fill();
  const lit = strip.map((p) => [p[0] + 2.5, p[1] - 1.5]);
  poly(ctx, lit);
  ctx.fillStyle = tee;
  ctx.fill();
  ctx.lineWidth = S.lw;
  ctx.strokeStyle = S.ink;
  // 夹克前襟边缘（翻领）
  ctx.beginPath();
  ctx.moveTo(...add(add(hip, f, front - 11), up, -10));
  ctx.lineTo(...add(add(sh, f, front - 8), up, 6));
  ctx.stroke();
  // 下摆罗纹
  const outer2 = C('outer2');
  poly(ctx, [add(add(hip, f, -40), up, -10), add(add(hip, f, front - 10), up, -10), add(add(hip, f, front - 10), up, 4), add(add(hip, f, -40), up, 4)]);
  ctx.fillStyle = outer2;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(...add(add(hip, f, -40), up, 4)); ctx.lineTo(...add(add(hip, f, front - 10), up, 4));
  ctx.stroke();
  // 口袋
  ctx.lineWidth = S.lw * 0.8;
  ctx.beginPath();
  ctx.moveTo(...add(add(hip, f, 2), up, 34)); ctx.lineTo(...add(add(hip, f, 10), up, 18));
  ctx.stroke();
}

export function darken(hex, k) {
  if (!hex.startsWith('#')) return hex;
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16) * k, g = parseInt(v.slice(2, 4), 16) * k, b2 = parseInt(v.slice(4, 6), 16) * k;
  return '#' + [r, g, b2].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('');
}
