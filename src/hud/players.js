// 右下角播放器：第 1–5 站磁带，第 6–12 站 CD，第 13–16 站手机播放界面。全部虚构，不用任何真实 logo。
// 旁边写歌名（≥36px）。spin 为转动角度（弧度），由调度按拍位给出，停转时保持不变。
import { font, SERIF, SANS } from '../kit/text.js';
import { roundRect, circle, ellipse } from '../kit/shapes.js';
import { clamp, ease, smoothstep, TAU } from '../kit/math.js';
import { rgba, mix, readableOn } from '../kit/color.js';

export const playerIn = (b) => ease.outBack(clamp((b - 0.5) / 1.1)) * (1 - smoothstep(7.25, 7.85, b));

/** 每拍转 1/4 圈 */
export const spinAt = (gb) => gb * (TAU / 4);

export function drawCassette(ctx, cx, cy, s, spin, P) {
  const w = 200 * s, h = 128 * s;
  ctx.save();
  ctx.translate(cx, cy);
  roundRect(ctx, -w / 2, -h / 2, w, h, 10 * s);
  ctx.fillStyle = P.body; ctx.fill();
  ctx.lineWidth = 3 * s; ctx.strokeStyle = P.ink; ctx.stroke();
  // 标签纸（无字）
  roundRect(ctx, -w / 2 + 14 * s, -h / 2 + 12 * s, w - 28 * s, 66 * s, 5 * s);
  ctx.fillStyle = P.label; ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.accent;
  ctx.fillRect(-w / 2 + 14 * s, -h / 2 + 22 * s, w - 28 * s, 7 * s);
  // 窗口
  roundRect(ctx, -52 * s, -h / 2 + 34 * s, 104 * s, 34 * s, 16 * s);
  ctx.fillStyle = P.window; ctx.fill(); ctx.stroke();
  // 磁带卷 + 转轮
  for (const sx of [-1, 1]) {
    const rx = sx * 34 * s, ry = -h / 2 + 51 * s;
    circle(ctx, rx, ry, (sx < 0 ? 16 : 11) * s); ctx.fillStyle = P.tape; ctx.fill();
    circle(ctx, rx, ry, 9 * s); ctx.fillStyle = P.body; ctx.fill(); ctx.stroke();
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(spin * (sx < 0 ? 1 : 1.35));
    for (let i = 0; i < 6; i++) {
      ctx.rotate(TAU / 6);
      ctx.fillStyle = P.ink;
      ctx.fillRect(-1.4 * s, -8 * s, 2.8 * s, 4.5 * s);
    }
    ctx.restore();
  }
  // 底部梯形
  ctx.beginPath();
  ctx.moveTo(-60 * s, h / 2); ctx.lineTo(-48 * s, h / 2 - 30 * s); ctx.lineTo(48 * s, h / 2 - 30 * s); ctx.lineTo(60 * s, h / 2);
  ctx.stroke();
  for (const sx of [-1, 1]) { circle(ctx, sx * 30 * s, h / 2 - 14 * s, 5 * s); ctx.fillStyle = P.ink; ctx.fill(); }
  ctx.restore();
}

export function drawCD(ctx, cx, cy, s, spin, P) {
  const r = 78 * s;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  circle(ctx, 0, 0, r);
  const g = ctx.createConicGradient ? ctx.createConicGradient(0, 0, 0) : null;
  if (g) {
    g.addColorStop(0, P.disc); g.addColorStop(0.15, P.shine1); g.addColorStop(0.3, P.disc);
    g.addColorStop(0.55, P.shine2); g.addColorStop(0.7, P.disc); g.addColorStop(1, P.disc);
    ctx.fillStyle = g;
  } else ctx.fillStyle = P.disc;
  ctx.fill();
  ctx.lineWidth = 3 * s; ctx.strokeStyle = P.ink; ctx.stroke();
  // 印刷面（虚构，无字）：一圈色环 + 一个偏心记号，转起来看得见
  circle(ctx, 0, 0, r * 0.62); ctx.lineWidth = 9 * s; ctx.strokeStyle = rgba(P.accent, 0.8); ctx.stroke();
  ctx.fillStyle = P.accent;
  ellipse(ctx, r * 0.78, 0, 7 * s, 4 * s); ctx.fill();
  circle(ctx, 0, 0, r * 0.26); ctx.fillStyle = P.hub; ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = P.ink; ctx.stroke();
  circle(ctx, 0, 0, r * 0.1); ctx.fillStyle = P.hole; ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawPhone(ctx, cx, cy, s, spin, P, progress = 0.3) {
  const w = 120 * s, h = 220 * s;
  ctx.save();
  ctx.translate(cx, cy);
  roundRect(ctx, -w / 2, -h / 2, w, h, 18 * s);
  ctx.fillStyle = P.ink; ctx.fill();
  roundRect(ctx, -w / 2 + 7 * s, -h / 2 + 7 * s, w - 14 * s, h - 14 * s, 13 * s);
  ctx.fillStyle = P.screen; ctx.fill();
  // 虚构播放界面：旋转的圆盘、进度条、三个按钮
  ctx.save(); ctx.translate(0, -h / 2 + 76 * s); ctx.rotate(spin);
  circle(ctx, 0, 0, 40 * s); ctx.fillStyle = P.disc; ctx.fill();
  for (let i = 1; i < 4; i++) { circle(ctx, 0, 0, (14 + i * 7) * s); ctx.lineWidth = 1 * s; ctx.strokeStyle = rgba('#ffffff', 0.18); ctx.stroke(); }
  circle(ctx, 0, 0, 13 * s); ctx.fillStyle = P.accent; ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.85); ctx.fillRect(-2 * s, -38 * s, 4 * s, 12 * s);
  ctx.restore();
  const by = h / 2 - 66 * s;
  roundRect(ctx, -44 * s, by, 88 * s, 5 * s, 2.5 * s); ctx.fillStyle = rgba(P.fg, 0.25); ctx.fill();
  roundRect(ctx, -44 * s, by, 88 * s * progress, 5 * s, 2.5 * s); ctx.fillStyle = P.accent; ctx.fill();
  circle(ctx, -44 * s + 88 * s * progress, by + 2.5 * s, 5 * s); ctx.fill();
  ctx.fillStyle = P.fg;
  const yb = h / 2 - 34 * s;
  ctx.beginPath(); ctx.moveTo(-6 * s, yb - 10 * s); ctx.lineTo(10 * s, yb); ctx.lineTo(-6 * s, yb + 10 * s); ctx.closePath(); ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sx * 26 * s, yb - 7 * s); ctx.lineTo(sx * 36 * s, yb); ctx.lineTo(sx * 26 * s, yb + 7 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(sx * 37 * s - 1.5 * s, yb - 7 * s, 3 * s, 14 * s);
  }
  ctx.restore();
}

export function playerPalette(st) {
  const [bg, mid, ink, acc] = st.palette;
  return {
    body: mix(bg, '#ffffff', 0.25), label: mix(bg, '#ffffff', 0.6), ink, accent: acc, window: mix(ink, mid, 0.5),
    tape: mix(ink, '#5a3a2a', 0.5), disc: mix(mid, '#d8dde2', 0.6), shine1: '#f4f7ff', shine2: mix(acc, '#ffffff', 0.5),
    hub: mix(bg, '#ffffff', 0.4), hole: bg, screen: mix(ink, '#202630', 0.6), fg: '#f2f2f2',
  };
}

export function drawPlayerKind(ctx, kind, cx, cy, s, spin, P, gb = 0) {
  if (kind === 'cassette') drawCassette(ctx, cx, cy, s, spin, P);
  else if (kind === 'cd') drawCD(ctx, cx, cy, s, spin, P);
  else drawPhone(ctx, cx, cy, s, spin, P, 0.2 + ((gb / 64) % 0.7));
}

/** 右下角：播放器 + 歌名 */
export function drawPlayerHUD(ctx, st, b, gb, W, H, style = {}) {
  const k = playerIn(b);
  if (k <= 0.001) return;
  const P = { ...playerPalette(st), ...(style.palette || {}) };
  const s = 1.0;
  const cx = W - 60 - (st.player === 'phone' ? 60 : st.player === 'cd' ? 80 : 100);
  const cy = H - 60 - (st.player === 'phone' ? 110 : st.player === 'cd' ? 80 : 64);
  ctx.save();
  ctx.globalAlpha = clamp(k);
  ctx.translate(cx, cy);
  ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  ctx.translate(-cx, -cy);
  if (style.backdrop !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
  }
  if (style.drawPlayer) style.drawPlayer(ctx, st.player, cx, cy, s, spinAt(gb), P, gb);
  else drawPlayerKind(ctx, st.player, cx, cy, s, spinAt(gb), P, gb);
  ctx.shadowColor = 'transparent';
  // 歌名（播放器左侧），带底板保证可读
  const px = 52;
  font(ctx, px, { family: style.family || SERIF, weight: 700 });
  const tw = ctx.measureText(st.song).width;
  const left = st.player === 'phone' ? cx - 90 : st.player === 'cd' ? cx - 110 : cx - 125;
  const ty = cy + 18;
  const plate = style.plate || st.palette[0];
  const ink = style.ink || readableOn(plate, st.palette[2]);
  if (style.plateDraw) style.plateDraw(ctx, left - tw - 52, ty - 58, tw + 64, 80);
  else {
    roundRect(ctx, left - tw - 52, ty - 58, tw + 64, 80, 8);
    ctx.fillStyle = rgba(plate, 0.9);
    ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = ink; ctx.stroke();
  }
  ctx.fillStyle = ink;
  ctx.textAlign = 'right';
  ctx.fillText(st.song, left - 12, ty);
  // 小音符记号（几何形，非文字）
  ctx.fillStyle = style.noteColor || st.palette[3];
  circle(ctx, left - tw - 34, ty - 12, 5); ctx.fill();
  ctx.fillRect(left - tw - 30, ty - 38, 3, 26);
  ctx.restore();
}
