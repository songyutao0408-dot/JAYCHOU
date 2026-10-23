// 水墨共用渲染（第 3 站建立，其他站可复用）。全部是 Canvas2D，确定性（只用 seed，不用 Math.random），
// 适合在 strip / baked 里预烘焙；少量函数（inkDot、inkStream、bristleStroke 的短笔）也可以每帧画。
//
//   颜色      INK（焦浓重淡清五档 + 宣纸 + 花青 + 赭石 + 印章红）、TEA（茶色：暖琥珀）、inkTone(t)
//   纸        xuanPaper(w, h, o)                          宣纸纹理（像素尺寸，缓存）
//   笔触      bristleStroke(ctx, pts, o)                  毛笔一笔：多根笔毛 + 飞白 + 起收笔粗细
//             inkDot(ctx, x, y, r, o)                     湿墨点（噪声轮廓 + 晕开的边）
//             mossDots(ctx, pts, o)                       沿一条线点苔点
//   山水      ridge(x0, x1, o) → [[x,y]...]               山脊线（噪声 + 若干主峰）
//             washShape(ctx, pts, o)                      晕染：竖向渐变 + 模糊湿边（上浓下淡、化进雾里）
//             mountain(ctx, x0, x1, o)                    一整层远山：层层晕染 + 可选皴擦、苔点；返回山脊
//             cunStrokes(ctx, ridgePts, o)                披麻皴：沿坡向的长枯笔
//             mistBand(ctx, x0, x1, y, h, o)              留白雾带（纸色渐变）
//             pine / bamboo / grassTuft / rock            松、竹、草、石（写意）
//   泼墨      pomo(ctx, pts, o)                           泼墨块：多层浓淡墨团在形内化开 + 水渍 + 湿边，往下化进纸（烘焙用）
//             splatter(ctx, x, y, r, o)                   甩出去的一簇墨点（主墨团 + 飞溅小点）
//   墨线      ribbonPath(pts, widthAt)                    变宽的带状路径
//             inkRibbon(ctx, pts, o)                      流动的墨线（湿芯 + 晕边 + 飞白），烘焙用
//             inkStream(ctx, p0, p1, p2, t0, t1, o)       倒下来的墨流（二次曲线的一段，每帧画）
//   装裱      sealStamp(ctx, x, y, size, o)               印章（抽象纹样，不刻字）
//             handscrollFrame(ctx, R, o)                  手卷裱框（离场画框，像素坐标）
//             paperCard(ctx, x, y, w, h, o)               宣纸卡片（标题卡 / 歌名签）
//
// 坐标：函数不关心单位，直接在 ctx 当前变换下作画；宽度、半径等都是当前坐标系的单位。
// 注意 ctx.filter 的 blur 半径按画布像素算（不随变换缩放），函数里统一用 o.px（每单位多少像素，默认 1）换算。
import { baked, makeCanvas } from './canvas.js';
import { hash2, rng } from './rng.js';
import { noise2, fbm } from './noise.js';
import { mix, rgba, hexToRgb } from './color.js';
import { clamp, lerp, smoothstep } from './math.js';

// ---------- 颜色 ----------
export const INK = {
  paper: '#f4efe2',   // 宣纸
  jiao: '#1b1a17',    // 焦墨
  nong: '#33312c',    // 浓墨
  zhong: '#6f6c64',   // 中（重）墨
  dan: '#a9a598',     // 淡墨
  qing: '#d3cfc3',    // 清墨
  huaqing: '#7d9aa3', // 花青
  zheshi: '#d2b48c',  // 淡赭石
  seal: '#b8402e',    // 印章红（朱砂）
};
/** 茶色：第 3 站从山泉、茶汤到年轮一路用的同一种暖琥珀色（深 / 主 / 浅 / 淡茶水 / 暖光）。 */
export const TEA = {
  deep: '#8e5f27',
  tea: '#b9853f',
  light: '#d9b47c',
  wash: '#efdcb6',
  glow: '#f6d99a',
};
/** 墨色：t = 0 宣纸 … 1 焦墨；tint 给一点花青 / 赭石（0..1）。 */
export function inkTone(t, { paper = INK.paper, tint = null, tintAmt = 0 } = {}) {
  let c = mix(paper, INK.jiao, clamp(t));
  if (tint && tintAmt > 0) c = mix(c, tint, tintAmt);
  return c;
}

// ---------- 宣纸 ----------
/**
 * 宣纸纹理（像素尺寸 w×h，按参数缓存）：暖白底 + 云状斑驳（像纸浆厚薄不匀）+ 长纤维 + 稀疏杂点。
 * o.base 底色；o.seed；o.amount 纹理强度（0..1.5）。
 */
export function xuanPaper(w, h, { base = INK.paper, seed = 3, amount = 1 } = {}) {
  w = Math.round(w); h = Math.round(h);
  return baked(`xuan|${w}|${h}|${base}|${seed}|${amount}`, w, h, (ctx) => {
    const [r0, g0, b0] = hexToRgb(base);
    // 云状斑驳：小图上算 fbm，再放大（双线性，天然柔和）
    const sw = Math.ceil(w / 10), sh = Math.ceil(h / 10);
    const small = makeCanvas(sw, sh);
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(sw, sh);
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
      const n = fbm(x / 18, y / 18, seed, 4) - 0.5;          // 大块
      const m = fbm(x / 4.5, y / 4.5, seed + 9, 2) - 0.5;    // 小絮
      const k = 1 + (n * 0.055 + m * 0.025) * amount;
      const i = (y * sw + x) * 4;
      img.data[i] = r0 * k; img.data[i + 1] = g0 * k; img.data[i + 2] = b0 * (k - 0.004); img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, w, h);
    // 细颗粒：平铺一块噪点
    const T = 192;
    const tile = makeCanvas(T, T);
    const tctx = tile.getContext('2d');
    const ti = tctx.createImageData(T, T);
    const R = rng('xuan-grain', seed);
    for (let i = 0; i < T * T; i++) {
      const v = R() < 0.55 ? 255 : 120;
      ti.data[i * 4] = ti.data[i * 4 + 1] = ti.data[i * 4 + 2] = v;
      ti.data[i * 4 + 3] = R() * 12 * amount;
    }
    tctx.putImageData(ti, 0, 0);
    ctx.fillStyle = ctx.createPattern(tile, 'repeat');
    ctx.fillRect(0, 0, w, h);
    // 长纤维：宣纸里细长弯曲的檀皮纤维
    const F = rng('xuan-fiber', seed);
    ctx.lineCap = 'round';
    const nF = Math.round((w * h) / 9000 * amount);
    for (let i = 0; i < nF; i++) {
      const x = F() * w, y = F() * h, a = F() * Math.PI * 2, L = 14 + F() * 60;
      const bend = (F() - 0.5) * L * 0.6;
      ctx.strokeStyle = F() < 0.6 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,250,0.22)';
      ctx.lineWidth = 0.5 + F() * 0.7;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(a) * L * 0.5 - Math.sin(a) * bend, y + Math.sin(a) * L * 0.5 + Math.cos(a) * bend, x + Math.cos(a) * L, y + Math.sin(a) * L);
      ctx.stroke();
    }
    // 稀疏杂点（纸里的小草屑）
    const nS = Math.round((w * h) / 60000 * amount);
    for (let i = 0; i < nS; i++) {
      ctx.fillStyle = `rgba(90,75,50,${0.08 + F() * 0.12})`;
      ctx.beginPath(); ctx.ellipse(F() * w, F() * h, 0.6 + F() * 1.4, 0.4 + F() * 0.8, F() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
}

// ---------- 路径工具 ----------
/** 把折线按间距 d 重新采样（返回新数组）。 */
export function resample(pts, d = 3) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const L = Math.hypot(bx - ax, by - ay);
    let s = d - carry;
    while (s <= L) { const t = s / L; out.push([ax + (bx - ax) * t, ay + (by - ay) * t]); s += d; }
    carry = L - (s - d);
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > d * 0.3) out.push(last);
  return out;
}
function normals(P) {
  const N = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    N.push([-dy / L, dx / L]);
  }
  return N;
}
/** 起笔 → 行笔 → 收笔的粗细曲线：taper = [起, 中, 收]（相对 width）。 */
const profile = (t, [a, m, z]) => (t < 0.18 ? lerp(a, m, smoothstep(0, 0.18, t)) : t > 0.65 ? lerp(m, z, smoothstep(0.65, 1, t)) : m);

// ---------- 笔触 ----------
/**
 * 毛笔一笔（枯笔 / 湿笔）：沿折线 pts 画 bristles 根「笔毛」细线，宽度按 taper 起收；
 * dry（0..1）越大飞白越多（越往收笔越干）；wet（单位）> 0 时先垫一层模糊的晕边。
 * o: { width, color, alpha, bristles, dry, seed, taper:[起,中,收], wet, px, spacing }
 */
export function bristleStroke(ctx, pts, o = {}) {
  const { width = 6, color = INK.jiao, alpha = 0.9, bristles = 8, dry = 0.2, seed = 1, taper = [0.45, 1, 0.35], wet = 0, px = 1, spacing = 2.2 } = o;
  if (pts.length < 2) return;
  const P = resample(pts, spacing);
  if (P.length < 2) return;
  const N = normals(P);
  const n = P.length;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  if (wet > 0) {
    // 湿笔：整笔先画一层模糊的淡边
    ctx.filter = `blur(${Math.max(0.5, wet * px)}px)`;
    ctx.globalAlpha = alpha * 0.32;
    ctx.lineWidth = width * 1.15;
    ctx.beginPath();
    P.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.filter = 'none';
  }
  // 累计长度（噪声沿长度取样，飞白的长短与笔画长度无关）
  const S = [0];
  for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = S[n - 1] || 1;
  const bw = Math.max(0.35, (width / bristles) * 1.7);
  for (let j = 0; j < bristles; j++) {
    const off = bristles === 1 ? 0 : j / (bristles - 1) - 0.5;
    const edge = Math.abs(off) * 2; // 外侧的笔毛更容易干
    ctx.globalAlpha = alpha * (0.55 + 0.45 * hash2(j, 1, seed));
    ctx.lineWidth = bw * (0.7 + 0.6 * hash2(j, 2, seed));
    const jx = (hash2(j, 3, seed) - 0.5) * width * 0.12;
    ctx.beginPath();
    let down = false;
    for (let i = 0; i < n; i++) {
      const t = S[i] / total;
      const w = width * profile(t, taper);
      const dd = dry * (0.25 + 0.75 * t) * (0.6 + 0.6 * edge);
      const gap = dd > 0 && noise2(S[i] / 9 + j * 13.7, j * 3.3 + seed * 0.71, seed + j) < dd;
      if (gap) { down = false; continue; }
      const x = P[i][0] + N[i][0] * (off * w + jx), y = P[i][1] + N[i][1] * (off * w + jx);
      if (!down) { ctx.moveTo(x, y); down = true; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** 噪声轮廓的闭合路径（墨点、石头、雾团都用）。 */
export function blobPath(cx, cy, rx, ry, { seed = 1, rough = 0.18, n = 28, rot = 0 } = {}) {
  const p = new Path2D();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + rough * (noise2(Math.cos(a) * 1.7 + seed, Math.sin(a) * 1.7 - seed, seed) - 0.5) * 2;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    const X = cx + x * Math.cos(rot) - y * Math.sin(rot), Y = cy + x * Math.sin(rot) + y * Math.cos(rot);
    i ? p.lineTo(X, Y) : p.moveTo(X, Y);
  }
  p.closePath();
  return p;
}

/** 湿墨点：噪声轮廓 + 外圈晕开（bleed 单位）。可每帧画（数量别太多）。 */
export function inkDot(ctx, x, y, r, { color = INK.jiao, alpha = 0.9, seed = 1, bleed = 0.35, ry = null, rot = 0, px = 1, rough = 0.22 } = {}) {
  if (r <= 0.05) return;
  ctx.save();
  ctx.fillStyle = color;
  if (bleed > 0) {
    ctx.globalAlpha = alpha * 0.28;
    ctx.fill(blobPath(x, y, r * (1 + bleed), (ry ?? r) * (1 + bleed), { seed: seed + 5, rough: rough * 1.4, rot }));
  }
  ctx.globalAlpha = alpha;
  ctx.fill(blobPath(x, y, r, ry ?? r, { seed, rough, rot }));
  ctx.restore();
}

/** 苔点：沿折线 pts 每隔 gap 点一簇横向短墨点（写意山水山脊、石头上用）。 */
export function mossDots(ctx, pts, { gap = 26, size = 4, color = INK.jiao, alpha = 0.85, seed = 7, chance = 0.6 } = {}) {
  const P = resample(pts, gap);
  P.forEach(([x, y], i) => {
    if (hash2(i, 1, seed) > chance) return;
    const k = 1 + Math.floor(hash2(i, 2, seed) * 3);
    for (let j = 0; j < k; j++) {
      const dx = (hash2(i, 10 + j, seed) - 0.5) * gap * 0.7, dy = (hash2(i, 20 + j, seed) - 0.6) * size * 1.6;
      const s = size * (0.6 + hash2(i, 30 + j, seed) * 0.7);
      inkDot(ctx, x + dx, y + dy, s * 1.4, { ry: s * 0.75, rot: (hash2(i, 40 + j, seed) - 0.5) * 0.6, color, alpha, seed: seed + i * 7 + j, bleed: 0.25 });
    }
  });
}

// ---------- 山水 ----------
/**
 * 山脊线：x0..x1，base 为山脚，height 为主峰高度。peaks 控制主峰密度（每 1000 单位几座）。
 * 返回 [[x, y], ...]（不含山脚两角）。
 */
export function ridge(x0, x1, { base = 600, height = 260, seed = 1, step = 6, peaks = 2.2, rough = 0.18, steep = 1.6 } = {}) {
  const R = rng('ridge', seed);
  const P = [];
  const n = Math.max(2, Math.round(((x1 - x0) / 1000) * peaks) + 2);
  for (let i = 0; i < n; i++) {
    P.push({ x: lerp(x0, x1, (i + R() * 0.8 - 0.4) / (n - 1)), h: height * (0.45 + 0.55 * R()), w: (x1 - x0) / n * (0.45 + R() * 0.5) });
  }
  const out = [];
  for (let x = x0; x <= x1 + step; x += step) {
    let h = 0;
    for (const p of P) {
      const d = (x - p.x) / p.w;
      h = Math.max(h, p.h * Math.exp(-Math.pow(Math.abs(d), steep) * 1.4));
    }
    h *= 1 - rough + rough * 2 * fbm(x / 140, 0.3, seed, 4);
    h += (fbm(x / 38, 2.1, seed + 3, 3) - 0.5) * height * 0.06;
    out.push([Math.min(x, x1), base - Math.max(height * 0.06, h)]);
  }
  return out;
}

/**
 * 晕染：pts 是闭合多边形（通常是山脊 + 山脚两角）。竖向渐变：top 处 alpha=a0，fadeY 处为 0（化进雾里）。
 * blur 为湿边模糊（单位），edge > 0 时沿上沿再压一道积墨（水痕边）。
 */
export function washShape(ctx, pts, { color = INK.dan, alpha = 0.8, top = null, fadeY = null, blur = 3, edge = 0.25, edgeW = 3, px = 1, seed = 1 } = {}) {
  let ymin = Infinity, ymax = -Infinity;
  for (const [, y] of pts) { ymin = Math.min(ymin, y); ymax = Math.max(ymax, y); }
  const y0 = top ?? ymin, y1 = fadeY ?? ymax;
  const [r, g, b] = hexToRgb(color);
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(0.55, `rgba(${r},${g},${b},${alpha * 0.55})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  ctx.save();
  if (blur > 0) ctx.filter = `blur(${blur * px}px)`;
  ctx.fillStyle = gr;
  ctx.fill(path);
  ctx.filter = 'none';
  if (edge > 0) {
    // 积墨边：只沿上沿（山脊）画，越往下越淡
    ctx.globalAlpha = edge;
    ctx.strokeStyle = gr;
    ctx.lineWidth = edgeW;
    ctx.lineJoin = 'round';
    if (blur > 0) ctx.filter = `blur(${blur * 0.35 * px}px)`;
    ctx.stroke(path);
    ctx.filter = 'none';
  }
  ctx.restore();
  return path;
}

/**
 * 一整层山：同一条山脊叠 layers 遍晕染（每遍往下缩一点、更浓），可选皴擦与苔点。
 * o: { base, height, color, alpha, fadeY, seed, peaks, layers, cun, moss, px, blur, steep }
 * 返回山脊点（给松树、苔点定位用）。
 */
export function mountain(ctx, x0, x1, o = {}) {
  const { base = 600, height = 260, color = INK.dan, alpha = 0.7, fadeY = base, seed = 1, peaks = 2.2, layers = 3, cun = 0, moss = 0, px = 1, blur = 3, steep = 1.6, rough = 0.18 } = o;
  const top = ridge(x0, x1, { base, height, seed, peaks, steep, rough });
  const ymin = Math.min(...top.map((p) => p[1]));
  for (let k = 0; k < layers; k++) {
    // 第 k 遍：山脊往下压一点（越往上越浓 = 层层积染），透明度递减
    const sink = k * height * 0.07;
    const pts = top.map(([x, y]) => [x, y + sink * (0.6 + 0.8 * fbm(x / 90, k + 0.5, seed + 11, 2))]);
    pts.push([x1, fadeY + 40], [x0, fadeY + 40]);
    washShape(ctx, pts, { color, alpha: alpha * (k ? 0.5 : 1), top: ymin + sink, fadeY, blur: blur * (k ? 1.6 : 1), edge: k ? 0 : 0.35, px, seed: seed + k });
  }
  if (cun > 0) cunStrokes(ctx, top, { base: fadeY, color: mix(color, INK.jiao, 0.45), density: cun, seed: seed + 21, px });
  if (moss > 0) mossDots(ctx, top.map(([x, y]) => [x, y + 3]), { gap: 30 / moss, size: 3.6, color: mix(color, INK.jiao, 0.7), seed: seed + 31, chance: 0.45 });
  return top;
}

/** 披麻皴：从山脊往下顺坡画的长枯笔，下端渐淡。density 每 100 单位几笔。 */
export function cunStrokes(ctx, top, { base = 800, color = INK.zhong, density = 1, seed = 5, px = 1, alpha = 0.55, len = 0.45 } = {}) {
  const R = rng('cun', seed);
  const x0 = top[0][0], x1 = top[top.length - 1][0];
  const yAt = (x) => { const i = clamp(Math.round(((x - x0) / (x1 - x0)) * (top.length - 1)), 0, top.length - 1); return top[i][1]; };
  const count = Math.round(((x1 - x0) / 100) * density);
  for (let k = 0; k < count; k++) {
    const x = lerp(x0, x1, R());
    const y = yAt(x);
    const slope = (yAt(x + 12) - yAt(x - 12)) / 24; // 顺坡方向
    const H = (base - y) * len * (0.4 + R() * 0.8);
    if (H < 8) continue;
    const pts = [];
    const sx = clamp(-slope * 0.6, -0.8, 0.8);
    for (let s = 0; s <= 6; s++) {
      const t = s / 6;
      pts.push([x + sx * H * t + Math.sin(t * 3 + k) * 4, y + 4 + H * t]);
    }
    bristleStroke(ctx, pts, { width: 3 + R() * 4, color, alpha: alpha * (0.6 + R() * 0.4), bristles: 5, dry: 0.45, seed: seed + k, taper: [0.8, 1, 0.15], px });
  }
}

/** 留白雾带：纸色的水平渐变带（上下都淡），盖住山脚。 */
export function mistBand(ctx, x0, x1, y, h, { color = INK.paper, alpha = 0.95 } = {}) {
  const [r, g, b] = hexToRgb(color);
  const gr = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  gr.addColorStop(0, `rgba(${r},${g},${b},0)`);
  gr.addColorStop(0.45, `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(0.6, `rgba(${r},${g},${b},${alpha})`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(x0, y - h / 2, x1 - x0, h);
}

/** 写意松：枯笔树干 + 几簇横向的墨团针叶。x,y 为树根，h 树高。 */
export function pine(ctx, x, y, h, { seed = 1, color = INK.nong, alpha = 0.85, lean = 0.15, px = 1 } = {}) {
  const R = rng('pine', seed);
  const trunk = [];
  for (let s = 0; s <= 8; s++) {
    const t = s / 8;
    trunk.push([x + Math.sin(t * 2.6 + seed) * h * 0.05 + lean * h * t, y - h * t]);
  }
  bristleStroke(ctx, trunk, { width: h * 0.06, color, alpha, bristles: 6, dry: 0.35, seed, taper: [1, 0.8, 0.35], px });
  const tiers = 3 + Math.floor(R() * 2);
  for (let k = 0; k < tiers; k++) {
    const t = 0.45 + (k / tiers) * 0.55;
    const [tx, ty] = trunk[Math.round(t * 8)];
    const side = k % 2 ? 1 : -1;
    const w = h * (0.32 - 0.18 * (k / tiers)) * (0.8 + R() * 0.4);
    // 树枝
    bristleStroke(ctx, [[tx, ty], [tx + side * w * 0.6, ty - h * 0.03], [tx + side * w, ty + h * 0.01]], { width: h * 0.022, color, alpha, bristles: 3, dry: 0.3, seed: seed + k * 3 + 1, px });
    // 针叶团：一串扁墨点
    for (let j = 0; j < 5; j++) {
      const u = j / 4;
      const cx = tx + side * w * (0.15 + u * 0.95), cy = ty - h * 0.04 - Math.sin(u * Math.PI) * h * 0.04;
      inkDot(ctx, cx, cy, w * 0.22, { ry: h * 0.045, color, alpha: alpha * 0.85, seed: seed * 31 + k * 7 + j, bleed: 0.3, rough: 0.35 });
    }
  }
  // 树顶
  const [hx, hy] = trunk[8];
  inkDot(ctx, hx, hy - h * 0.02, h * 0.12, { ry: h * 0.05, color, alpha: alpha * 0.9, seed: seed + 99, bleed: 0.3, rough: 0.35 });
}

/** 写意竹：几根竹竿（分节）+ 竹叶（一撇一撇的尖叶）。x,y 为根部中心。 */
export function bamboo(ctx, x, y, h, { seed = 1, color = INK.nong, alpha = 0.8, stems = 3, px = 1 } = {}) {
  const R = rng('bamboo', seed);
  for (let s = 0; s < stems; s++) {
    const bx = x + (s - (stems - 1) / 2) * h * 0.07 + (R() - 0.5) * h * 0.04;
    const hh = h * (0.7 + R() * 0.3), lean = (R() - 0.5) * 0.25;
    const tone = s % 2 ? mix(color, INK.paper, 0.35) : color;
    let yy = y, xx = bx;
    const segs = 5 + Math.floor(R() * 2);
    for (let k = 0; k < segs; k++) {
      const L = hh / segs;
      const nx = xx + lean * L, ny = yy - L;
      bristleStroke(ctx, [[xx, yy - 2], [nx, ny + 3]], { width: h * 0.022, color: tone, alpha, bristles: 4, dry: 0.15, seed: seed + s * 13 + k, taper: [1.1, 0.9, 1.15], px });
      // 竹节
      bristleStroke(ctx, [[nx - h * 0.014, ny + 1], [nx + h * 0.014, ny - 1]], { width: 2.2, color: INK.jiao, alpha: alpha * 0.9, bristles: 2, dry: 0, seed: seed + k, px });
      xx = nx; yy = ny;
      // 叶子：从节上斜出的一组尖叶
      if (k >= segs - 3 && R() < 0.85) {
        const dir = R() < 0.5 ? -1 : 1;
        const nL = 2 + Math.floor(R() * 3);
        for (let j = 0; j < nL; j++) {
          const a = (dir < 0 ? Math.PI : 0) + dir * (0.35 + j * 0.28 + (R() - 0.5) * 0.2) * -1 + (dir < 0 ? -0.15 : 0.15);
          const len = h * (0.09 + R() * 0.06);
          bambooLeaf(ctx, xx, yy, a + Math.PI * 0.08 * dir, len, { color: tone, alpha: alpha * 0.95, seed: seed * 7 + j });
        }
      }
    }
  }
}
/** 一片竹叶（尖头的柳叶形墨块）。 */
export function bambooLeaf(ctx, x, y, a, len, { color = INK.nong, alpha = 0.85, seed = 1 } = {}) {
  const w = len * 0.17;
  const c = Math.cos(a), s = Math.sin(a);
  const bend = (hash2(seed, 1, 3) - 0.5) * len * 0.25;
  const P = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  const p = new Path2D();
  const p0 = P(0, 0), p1 = P(len * 0.35, -w + bend * 0.3), p2 = P(len, bend), p3 = P(len * 0.4, w * 0.7 + bend * 0.3);
  p.moveTo(...p0);
  p.quadraticCurveTo(...p1, ...p2);
  p.quadraticCurveTo(...p3, ...p0);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fill(p);
  ctx.restore();
}

/** 一丛草：几笔从根部散开、上端尖细的弧线。 */
export function grassTuft(ctx, x, y, h, { seed = 1, color = INK.zhong, alpha = 0.7, blades = 6, spread = 0.9, px = 1 } = {}) {
  for (let k = 0; k < blades; k++) {
    const a = -Math.PI / 2 + (k / Math.max(1, blades - 1) - 0.5) * spread + (hash2(k, 1, seed) - 0.5) * 0.3;
    const L = h * (0.55 + hash2(k, 2, seed) * 0.5);
    const bend = (hash2(k, 3, seed) - 0.5) * 0.6;
    const pts = [];
    for (let s = 0; s <= 5; s++) {
      const t = s / 5, aa = a + bend * t;
      pts.push([x + Math.cos(aa) * L * t + (k - blades / 2) * 1.5, y + Math.sin(aa) * L * t]);
    }
    bristleStroke(ctx, pts, { width: 2.6 + hash2(k, 4, seed) * 2, color, alpha, bristles: 3, dry: 0.2, seed: seed + k, taper: [1, 0.7, 0.05], px });
  }
}

/** 写意石头：淡墨晕染的块面 + 枯笔勾出轮廓和一两道皴。 */
export function rock(ctx, x, y, w, h, { seed = 1, color = INK.zhong, alpha = 0.8, px = 1 } = {}) {
  const R = rng('rock', seed);
  // 轮廓：底平、上面起伏
  const pts = [];
  const n = 9;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const yy = y - h * Math.sin(Math.PI * t) ** 0.6 * (0.75 + R() * 0.35);
    pts.push([x - w / 2 + w * t, yy]);
  }
  const shape = [...pts, [x + w / 2, y], [x - w / 2, y]];
  washShape(ctx, shape, { color: mix(color, INK.paper, 0.45), alpha: alpha * 0.55, top: y - h, fadeY: y + 6, blur: 1.5, edge: 0, px });
  bristleStroke(ctx, pts, { width: Math.max(3, h * 0.07), color, alpha, bristles: 6, dry: 0.35, seed, taper: [0.9, 1, 0.5], px });
  // 皴：从顶往下的一两笔
  for (let k = 0; k < 2; k++) {
    const t = 0.3 + R() * 0.4;
    const top = pts[Math.round(t * n)];
    bristleStroke(ctx, [[top[0], top[1] + 4], [top[0] + (R() - 0.5) * w * 0.2, top[1] + h * 0.45], [top[0] + (R() - 0.5) * w * 0.25, y - 2]], { width: Math.max(2.5, h * 0.05), color, alpha: alpha * 0.6, bristles: 4, dry: 0.5, seed: seed + k + 7, taper: [0.9, 0.8, 0.1], px });
  }
  mossDots(ctx, pts.slice(2, 7), { gap: Math.max(10, w / 5), size: Math.max(2, h * 0.06), color: INK.jiao, seed: seed + 3, chance: 0.5 });
}

// ---------- 泼墨 ----------
/**
 * 泼墨块（烘焙用）：在闭合多边形 pts 里，先铺一层淡墨，再泼几层浓淡不同、模糊程度不同的墨团（偏向上沿），
 * 留几块回流的水渍（浅斑 + 一圈积墨），上沿压一道湿边；形外用模糊的边化开，往下（fadeY）化进纸里。
 * o: { color（主墨色）, light（淡墨色）, alpha, seed, blobs（墨团数）, px, fadeY, edge（形边模糊，单位）, backrun（水渍数）, top（偏向上沿 0..1）}
 */
export function pomo(ctx, pts, o = {}) {
  const { color = INK.nong, light = INK.dan, alpha = 0.9, seed = 1, blobs = 12, px = 1, fadeY = null, edge = 3, backrun = 3, top = 0.6, wetEdge = 0.5 } = o;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = edge * 3 + 6;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const W = (x1 - x0) * px, H = (y1 - y0) * px;
  if (W < 2 || H < 2) return;
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  g.scale(px, px);
  g.translate(-x0, -y0);
  const path = new Path2D();
  pts.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
  path.closePath();
  const R = rng('pomo', seed);
  const w = x1 - x0, h = y1 - y0;
  // 底：一层淡墨
  g.fillStyle = light;
  g.globalAlpha = 0.55;
  g.filter = `blur(${2 * px}px)`;
  g.fill(path);
  // 墨团：大而虚的在下，小而实的在上
  for (let k = 0; k < blobs; k++) {
    const u = R(), v = Math.pow(R(), 1 + top * 2);
    const bx = x0 + pad + u * (w - 2 * pad), by = y0 + pad + v * (h - 2 * pad) * 0.9;
    const r = (0.08 + R() * 0.22) * Math.max(w, h * 1.5);
    const dark = R() < 0.45;
    g.globalAlpha = dark ? 0.35 + R() * 0.35 : 0.2 + R() * 0.25;
    g.fillStyle = dark ? color : mix(color, light, 0.5 + R() * 0.4);
    g.filter = `blur(${(dark ? 2 + R() * 4 : 5 + R() * 9) * px}px)`;
    g.fill(blobPath(bx, by, r, r * (0.35 + R() * 0.4), { seed: seed * 13 + k, rough: 0.35, rot: (R() - 0.5) * 0.5 }));
  }
  g.filter = 'none';
  // 水渍：浅斑 + 外圈一道积墨
  for (let k = 0; k < backrun; k++) {
    const bx = x0 + pad + R() * (w - 2 * pad), by = y0 + pad + (0.25 + R() * 0.6) * (h - 2 * pad);
    const r = (0.04 + R() * 0.08) * Math.max(w, h);
    const bp = blobPath(bx, by, r, r * (0.5 + R() * 0.4), { seed: seed * 7 + k + 50, rough: 0.45 });
    g.globalCompositeOperation = 'destination-out';
    g.globalAlpha = 0.35 + R() * 0.25;
    g.filter = `blur(${1.5 * px}px)`;
    g.fill(bp);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 0.25;
    g.strokeStyle = color;
    g.lineWidth = 1.6;
    g.filter = `blur(${0.6 * px}px)`;
    g.stroke(bp);
  }
  g.filter = 'none';
  // 上沿的湿边
  if (wetEdge > 0) {
    g.globalAlpha = wetEdge;
    g.strokeStyle = color;
    g.lineWidth = 3;
    g.lineJoin = 'round';
    g.filter = `blur(${1.2 * px}px)`;
    g.stroke(path);
    g.filter = 'none';
  }
  // 形外化开：只留形内（边缘模糊）
  g.globalCompositeOperation = 'destination-in';
  g.globalAlpha = 1;
  g.fillStyle = '#000';
  g.filter = `blur(${edge * px}px)`;
  g.fill(path);
  g.filter = 'none';
  // 往下化进纸
  if (fadeY !== null) {
    g.globalCompositeOperation = 'destination-out';
    const gr = g.createLinearGradient(0, lerp(y0, fadeY, 0.45), 0, fadeY);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,1)');
    g.fillStyle = gr;
    g.fillRect(x0, y0, w, h);
    g.fillStyle = '#000';
    g.fillRect(x0, fadeY, w, Math.max(0, y1 - fadeY));
  }
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(c, x0, y0, w, h);
  ctx.restore();
}

/** 甩出去的一簇墨点：一个主墨团 + 周围大小不一的飞溅点（可每帧画，数量少）。 */
export function splatter(ctx, x, y, r, { color = INK.jiao, alpha = 0.85, seed = 1, count = 14, spread = 2.6, dir = null } = {}) {
  inkDot(ctx, x, y, r, { color, alpha, seed, bleed: 0.35, rough: 0.35 });
  for (let k = 0; k < count; k++) {
    let a = hash2(k, 1, seed) * Math.PI * 2;
    if (dir !== null) a = dir + (hash2(k, 1, seed) - 0.5) * 1.3;
    const d = r * (1.1 + Math.pow(hash2(k, 2, seed), 1.6) * spread);
    const s = r * (0.05 + 0.22 * Math.pow(hash2(k, 3, seed), 2)) * (1.4 - d / (r * (1.1 + spread)));
    inkDot(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(0.6, s), { color, alpha, seed: seed + k * 3, bleed: 0.15, rough: 0.2 });
  }
}

// ---------- 墨线 ----------
/** 变宽的带状路径：中心线 pts，宽度 widthAt(i, t)。 */
export function ribbonPath(pts, widthAt) {
  const N = normals(pts);
  const L = [], Rr = [];
  pts.forEach(([x, y], i) => {
    const w = widthAt(i, i / (pts.length - 1)) / 2;
    L.push([x + N[i][0] * w, y + N[i][1] * w]);
    Rr.push([x - N[i][0] * w, y - N[i][1] * w]);
  });
  const p = new Path2D();
  L.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  for (let i = Rr.length - 1; i >= 0; i--) p.lineTo(Rr[i][0], Rr[i][1]);
  p.closePath();
  return p;
}

/**
 * 流动的墨线（烘焙用）：湿芯 + 晕开的外边 + 积墨边 + 局部飞白。
 * o: { width, vary（粗细起伏比例）, color, seed, px, dryAt(t)→0..1 飞白强度 }
 */
export function inkRibbon(ctx, pts, { width = 12, vary = 0.35, color = INK.jiao, seed = 1, px = 1, bleed = 4, dry = 0.35, taper = 40 } = {}) {
  const P = resample(pts, 3);
  const S = [0];
  for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = S[S.length - 1] || 1;
  // 粗细：噪声起伏（提按）+ 两端收笔（taper 单位内渐细）
  const ends = (i) => (taper > 0 ? Math.sqrt(clamp(Math.min(S[i], total - S[i]) / taper)) : 1);
  const wAt = (i) => width * (1 + vary * (fbm(S[i] / 90, 0.5, seed, 3) - 0.5) * 2.2) * Math.max(0.12, ends(i));
  ctx.save();
  // 晕边：外扩 + 模糊
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.22;
  ctx.filter = `blur(${bleed * px}px)`;
  ctx.fill(ribbonPath(P, (i) => wAt(i) + bleed * 1.6));
  ctx.filter = `blur(${0.6 * px}px)`;
  ctx.globalAlpha = 0.9;
  const core = ribbonPath(P, (i) => wAt(i));
  ctx.fill(core);
  ctx.filter = 'none';
  // 积墨边：墨线两侧更深一点
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = INK.jiao;
  ctx.lineWidth = 1.2;
  ctx.stroke(core);
  // 飞白：沿线几段纸色细丝（笔毛之间漏出的纸）
  if (dry > 0) {
    ctx.strokeStyle = INK.paper;
    ctx.lineCap = 'round';
    for (let j = 0; j < 5; j++) {
      const off = (j / 4 - 0.5) * 0.7;
      ctx.globalAlpha = 0.5 + 0.3 * hash2(j, 1, seed);
      ctx.lineWidth = 0.7 + hash2(j, 2, seed) * 1.1;
      ctx.beginPath();
      let down = false;
      const N = normals(P);
      for (let i = 0; i < P.length; i++) {
        const on = noise2(S[i] / 46 + j * 5.1, j * 1.7, seed + 40) < dry * 0.75;
        if (!on) { down = false; continue; }
        const w = wAt(i);
        const x = P[i][0] + N[i][0] * off * w, y = P[i][1] + N[i][1] * off * w;
        if (!down) { ctx.moveTo(x, y); down = true; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** 二次贝塞尔上的点。 */
export const quadAt = (p0, p1, p2, t) => {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
};
/**
 * 倒下来的墨流（每帧画）：二次曲线 p0→p1→p2 上 t0..t1 的一段，宽度从 w0 渐变到 w1，
 * wobble 为摆动（单位，按 phase 变化），两端圆头。
 */
export function inkStream(ctx, p0, p1, p2, t0, t1, { w0 = 5, w1 = 7, color = INK.jiao, alpha = 0.92, wobble = 2, phase = 0, seed = 1 } = {}) {
  if (t1 - t0 < 0.002) return;
  const n = Math.max(4, Math.ceil((t1 - t0) * 48));
  const P = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n);
    const [x, y] = quadAt(p0, p1, p2, t);
    P.push([x + Math.sin(t * 17 + phase * 6.3) * wobble * t, y]);
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  ctx.fill(ribbonPath(P, (i, u) => lerp(w0, w1, lerp(t0, t1, u)) * (1 + 0.18 * Math.sin(u * 23 + phase * 9 + seed))));
  // 圆头
  const a = P[0], z = P[P.length - 1];
  ctx.beginPath(); ctx.arc(a[0], a[1], lerp(w0, w1, t0) / 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(z[0], z[1], lerp(w0, w1, t1) * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- 装裱、印章、卡片 ----------
/**
 * 印章：印章红方印，白文抽象纹样（山 + 水波 + 圆日，不刻字）。x,y 为中心。
 * o: { color, seed, rot, alpha, round（圆角比例） }
 */
export function sealStamp(ctx, x, y, size, { color = INK.seal, seed = 1, rot = -0.04, alpha = 0.92 } = {}) {
  const s = size / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  // 印面：略不规则的方形
  const p = new Path2D();
  const c = [[-s, -s], [s, -s], [s, s], [-s, s]];
  c.forEach(([cx, cy], i) => {
    const jx = (hash2(i, 1, seed) - 0.5) * size * 0.04, jy = (hash2(i, 2, seed) - 0.5) * size * 0.04;
    i ? p.lineTo(cx + jx, cy + jy) : p.moveTo(cx + jx, cy + jy);
  });
  p.closePath();
  ctx.fillStyle = color;
  ctx.fill(p);
  // 白文纹样
  ctx.strokeStyle = INK.paper;
  ctx.fillStyle = INK.paper;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(1, size * 0.07);
  ctx.strokeRect(-s * 0.78, -s * 0.78, s * 1.56, s * 1.56);
  ctx.beginPath(); // 山
  ctx.moveTo(-s * 0.62, s * 0.18); ctx.lineTo(-s * 0.25, -s * 0.42); ctx.lineTo(0, -s * 0.05); ctx.lineTo(s * 0.22, -s * 0.3); ctx.lineTo(s * 0.62, s * 0.18);
  ctx.stroke();
  ctx.beginPath(); // 水波
  for (let k = 0; k < 2; k++) {
    const yy = s * (0.4 + k * 0.2);
    ctx.moveTo(-s * 0.6, yy);
    for (let u = 0; u <= 4; u++) ctx.quadraticCurveTo(-s * 0.6 + (u + 0.5) * s * 0.3, yy - s * 0.1 * (u % 2 ? -1 : 1), -s * 0.6 + (u + 1) * s * 0.3, yy);
  }
  ctx.lineWidth = Math.max(0.8, size * 0.05);
  ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.42, -s * 0.5, s * 0.13, 0, Math.PI * 2); ctx.fill(); // 日
  // 印泥不匀：几个缺口（纸色小点）
  for (let k = 0; k < 14; k++) {
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc((hash2(k, 5, seed) - 0.5) * size * 0.98, (hash2(k, 6, seed) - 0.5) * size * 0.98, size * (0.008 + hash2(k, 7, seed) * 0.02), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 宣纸卡片（像素坐标，标题卡 / 歌名签用）：毛边纸片 + 淡投影 + 枯笔方框（可选印章）。
 * 结果按尺寸缓存，返回 { canvas, pad }，调用方 drawImage(canvas, x - pad, y - pad)。
 */
export function paperCard(w, h, { seed = 1, seal = true, sealSize = 46, border = INK.nong, key = '' } = {}) {
  const pad = 24;
  w = Math.round(w); h = Math.round(h);
  const canvas = baked(`inkcard|${key}|${w}|${h}|${seed}|${seal}|${sealSize}`, w + pad * 2, h + pad * 2, (ctx) => {
    ctx.translate(pad, pad);
    // 毛边纸形
    const edge = new Path2D();
    const pts = [];
    const n = 80;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      let x, y;
      if (t < 0.25) { x = (t / 0.25) * w; y = 0; } else if (t < 0.5) { x = w; y = ((t - 0.25) / 0.25) * h; } else if (t < 0.75) { x = w - ((t - 0.5) / 0.25) * w; y = h; } else { x = 0; y = h - ((t - 0.75) / 0.25) * h; }
      const j = (noise2(i * 0.9, 0.5, seed) - 0.5) * 5;
      pts.push([x + (y === 0 || y === h ? 0 : j), y + (x === 0 || x === w ? 0 : j)]);
    }
    pts.forEach(([x, y], i) => (i ? edge.lineTo(x, y) : edge.moveTo(x, y)));
    edge.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(60,45,25,0.22)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    ctx.fillStyle = INK.paper;
    ctx.fill(edge);
    ctx.restore();
    ctx.save();
    ctx.clip(edge);
    ctx.drawImage(xuanPaper(w, h, { seed: seed + 50, amount: 1.1 }), 0, 0);
    // 淡淡的一层水渍
    ctx.fillStyle = rgba(INK.dan, 0.08);
    ctx.fill(blobPath(w * 0.8, h * 0.75, w * 0.35, h * 0.4, { seed, rough: 0.3 }));
    ctx.restore();
    // 枯笔方框
    const m = 12;
    const sides = [[[m, m], [w - m, m + 1]], [[w - m, m - 2], [w - m + 1, h - m]], [[w - m + 2, h - m], [m, h - m - 1]], [[m, h - m + 2], [m - 1, m]]];
    sides.forEach(([a, b], i) => bristleStroke(ctx, [a, [(a[0] + b[0]) / 2 + (hash2(i, 1, seed) - 0.5) * 3, (a[1] + b[1]) / 2 + (hash2(i, 2, seed) - 0.5) * 3], b], { width: 4.2, color: border, alpha: 0.85, bristles: 6, dry: 0.42, seed: seed + i * 5, taper: [1, 0.85, 0.5], spacing: 1.6 }));
    if (seal) sealStamp(ctx, w - m - sealSize * 0.55 - 6, m + sealSize * 0.55 + 6, sealSize, { seed: seed + 9 });
  });
  return { canvas, pad };
}

/**
 * 手卷裱框（离场画框，像素坐标）：R = { x, y, w, h, s }，边宽约 64 × s。
 * 绫边（淡青灰 + 细云纹）、内外墨线 + 赭石细线，左右两端木轴（上下伸出白玉轴头），右上一方小印，路面上的淡影。
 */
export function handscrollFrame(ctx, R, { silk = '#dfe2d6', silkDark = '#c9cdbf', wood = '#4a3426', knob = '#efeadb', seal = true } = {}) {
  const t = 64 * R.s, { x, y, w, h } = R;
  const s = R.s;
  ctx.save();
  // 路面上的影子
  ctx.fillStyle = 'rgba(40,35,25,0.14)';
  ctx.beginPath(); ctx.ellipse(x + w / 2, y + h + t * 0.95, w * 0.55, t * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  // 绫边
  const band = new Path2D();
  band.rect(x - t, y - t * 0.8, w + 2 * t, h + t * 1.6);
  band.rect(x, y, w, h);
  ctx.fillStyle = silk;
  ctx.fill(band, 'evenodd');
  // 细云纹（绫的暗花）
  ctx.save();
  ctx.clip(band, 'evenodd');
  ctx.strokeStyle = rgba(silkDark, 0.9);
  ctx.lineWidth = Math.max(0.6, 1.4 * s);
  const step = 46 * s;
  if (step > 4) {
    for (let yy = y - t * 0.8 + step * 0.5, r = 0; yy < y + h + t * 0.8; yy += step * 0.75, r++) {
      for (let xx = x - t + (r % 2) * step * 0.5; xx < x + w + t; xx += step) {
        ctx.beginPath();
        ctx.arc(xx, yy, step * 0.16, Math.PI, Math.PI * 2);
        ctx.arc(xx + step * 0.2, yy, step * 0.1, Math.PI, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  // 内沿：墨线 + 赭石细线（局条）
  ctx.strokeStyle = INK.nong;
  ctx.lineWidth = Math.max(1, 3 * s);
  ctx.strokeRect(x - 1.5 * s, y - 1.5 * s, w + 3 * s, h + 3 * s);
  ctx.strokeStyle = INK.zheshi;
  ctx.lineWidth = Math.max(1, 5 * s);
  ctx.strokeRect(x - 9 * s, y - 9 * s, w + 18 * s, h + 18 * s);
  ctx.strokeStyle = rgba(INK.nong, 0.7);
  ctx.lineWidth = Math.max(0.8, 1.6 * s);
  ctx.strokeRect(x - t, y - t * 0.8, w + 2 * t, h + t * 1.6);
  // 左右两端的木轴
  for (const side of [-1, 1]) {
    const cx = side < 0 ? x - t - 14 * s : x + w + t + 14 * s;
    const rw = 30 * s, top = y - t * 0.8 - 18 * s, bot = y + h + t * 0.8 + 18 * s;
    const g = ctx.createLinearGradient(cx - rw / 2, 0, cx + rw / 2, 0);
    g.addColorStop(0, mix(wood, '#000000', 0.3)); g.addColorStop(0.35, mix(wood, '#ffffff', 0.25)); g.addColorStop(1, mix(wood, '#000000', 0.45));
    ctx.fillStyle = g;
    ctx.fillRect(cx - rw / 2, top, rw, bot - top);
    // 轴头（白玉）
    for (const [ky, dir] of [[top, -1], [bot, 1]]) {
      const kg = ctx.createLinearGradient(cx - rw * 0.6, 0, cx + rw * 0.6, 0);
      kg.addColorStop(0, '#cfc9b6'); kg.addColorStop(0.4, knob); kg.addColorStop(1, '#b9b29c');
      ctx.fillStyle = kg;
      ctx.beginPath();
      ctx.ellipse(cx, ky + dir * 12 * s, rw * 0.62, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = rgba(INK.nong, 0.6); ctx.lineWidth = Math.max(0.6, 1.2 * s); ctx.stroke();
    }
  }
  // 一方小印
  if (seal && t > 8) sealStamp(ctx, x + w + t * 0.5, y + h * 0.08 + t * 0.1, t * 0.42, { seed: 77 });
  ctx.restore();
}
