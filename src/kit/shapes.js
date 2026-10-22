// Canvas2D 常用图形。所有函数直接作用于 ctx（p5 的 g.drawingContext 也行）。
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
}
export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2);
}
export function poly(ctx, pts, close = true) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}
/** 过点平滑曲线（Catmull-Rom 转三次贝塞尔）。 */
export function smoothPath(ctx, pts, close = false) {
  ctx.beginPath();
  if (pts.length < 2) return;
  const n = pts.length;
  const P = (i) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  ctx.moveTo(pts[0][0], pts[0][1]);
  const segs = close ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    ctx.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1]);
  }
  if (close) ctx.closePath();
}
/** 粗细两端渐变的「肢体」：从 a 到 b，半径 ra→rb 的圆头胶囊。 */
export function capsule(ctx, a, b, ra, rb = ra) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1e-6;
  const nx = -dy / L, ny = dx / L;
  const ang = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(a[0] + nx * ra, a[1] + ny * ra);
  ctx.lineTo(b[0] + nx * rb, b[1] + ny * rb);
  ctx.arc(b[0], b[1], rb, ang + Math.PI / 2, ang - Math.PI / 2, true);
  ctx.lineTo(a[0] - nx * ra, a[1] - ny * ra);
  ctx.arc(a[0], a[1], ra, ang - Math.PI / 2, ang + Math.PI / 2, true);
  ctx.closePath();
}

/** 沿折线画一根连续的「管子」（四肢、袖子、裤腿），radii 与 pts 一一对应，两端圆头。 */
export function tube(ctx, pts, radii) {
  const n = pts.length;
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    let r = radii[i];
    if (i > 0 && i < n - 1) {
      // 关节处按夹角放宽一点，避免折角变细
      const d1 = [pts[i][0] - a[0], pts[i][1] - a[1]], d2 = [b[0] - pts[i][0], b[1] - pts[i][1]];
      const c = (d1[0] * d2[0] + d1[1] * d2[1]) / ((Math.hypot(...d1) * Math.hypot(...d2)) || 1);
      r /= Math.max(0.6, Math.sqrt((1 + c) / 2));
    }
    L.push([pts[i][0] - dy * r, pts[i][1] + dx * r]);
    R.push([pts[i][0] + dy * r, pts[i][1] - dx * r]);
  }
  const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]);
  ctx.beginPath();
  ctx.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  const e = n - 1, ae = ang(pts[e - 1], pts[e]);
  ctx.arc(pts[e][0], pts[e][1], radii[e], ae + Math.PI / 2, ae - Math.PI / 2, true);
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  const a0 = ang(pts[0], pts[1]);
  ctx.arc(pts[0][0], pts[0][1], radii[0], a0 - Math.PI / 2, a0 + Math.PI / 2, true);
  ctx.closePath();
}
