// 结尾词云头像：从用户给的歌名清单前半部分挑出的 57 首短歌名（每个带书名号），按密度图拼出侧脸、闭眼、一手扶耳的头像。
// 只用 2–4 个字的歌名：字块大小均匀，拼出来的明暗更细、轮廓更像；歌名少，画面也不乱。
// 密度图 src/data/portrait.js 由 tools/build-portrait.py 从用户给的参考照片生成（照片本身不进仓库）。
// 暗处（头发、衣服、阴影）用小字密排、可以少量叠字；亮处（脸颊）稀疏甚至留白；背景完全留白。
// 排版只算一次（确定性随机），动画是拍位的纯函数：光点炸开 → 歌名四散 → 聚拢成头像 → 定格。
import { W } from './layout.js';
import { SONGS } from '../data/songs.js';
import { PORTRAIT } from '../data/portrait.js';
import { makeCanvas, memo } from '../kit/canvas.js';
import { rng } from '../kit/rng.js';
import { font, SERIF } from '../kit/text.js';
import { clamp, ease, lerp, smoothstep } from '../kit/math.js';

// 头像在画面上的位置（像素）：画面中上，下方留给三行落款
export const PORTRAIT_RECT = { x: (W - 880) / 2, y: 28, w: 880, h: (880 * PORTRAIT.h) / PORTRAIT.w };
// 画面中央放大、加粗、保证认得清的经典歌名
const FEATURED = [
  { t: '晴天', u: 0.42, v: 0.10, px: 40 },
  { t: '夜曲', u: 0.50, v: 0.62, px: 38 },
  { t: '七里香', u: 0.27, v: 0.86, px: 38 },
];
// 用户清单前半部分里挑的歌（去掉较长、带英文和不太常听到的）；必须都在 SONGS 里
const DROP = new Set(['忍者', '分裂', '懦夫', '梯田', '双刀', '借口', '将军', '困兽之斗', '逆鳞', '飘移', '退后', '心雨', '我不配', '甜甜的',
  '龙战骑士', '蛇舞', '魔术先生', '流浪诗人', '时光机', '乔克叔叔', '跨时代', '说了再见']);
export const PORTRAIT_SONGS = SONGS.slice(0, 95).filter((t) => [...t].length <= 4 && !/[A-Za-z]/.test(t) && !DROP.has(t));
const INKS = ['#3a281b', '#4a3424', '#2e2016', '#563c27'];

let density = null;
function dens(u, v) {
  if (!density) {
    const bin = atob(PORTRAIT.data);
    density = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) density[i] = bin.charCodeAt(i);
  }
  const x = clamp(u, 0, 1) * (PORTRAIT.w - 1), y = clamp(v, 0, 1) * (PORTRAIT.h - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, PORTRAIT.w - 1), y1 = Math.min(y0 + 1, PORTRAIT.h - 1);
  const fx = x - x0, fy = y - y0, D = (xx, yy) => density[yy * PORTRAIT.w + xx] / 255;
  return lerp(lerp(D(x0, y0), D(x1, y0), fx), lerp(D(x0, y1), D(x1, y1), fx), fy);
}

/**
 * 一次性排版（文字肖像）：小字一行行连续排满头像区，每个歌名的深浅（透明度、粗细）由它底下的明暗决定，
 * 亮处留白；最暗处（头发、衣服）再错开半行叠一层，越暗越密。画面中央的经典歌名单独放大，四周留出纸色。
 * 返回 [{ s: 文字, x, y（中心，像素）, px, weight, ink, alpha, rot, d, 动画参数… }]
 */
export function wordLayout() {
  return memo('wordcloud|layout', () => {
    const R = PORTRAIT_RECT;
    const r = rng('wordcloud');
    const mc = makeCanvas(8, 8).getContext('2d');
    const widthAt = new Map();
    const w100 = (s, weight) => {
      const k = s + weight;
      if (!widthAt.has(k)) { font(mc, 100, { family: SERIF, weight }); widthAt.set(k, mc.measureText(s).width); }
      return widthAt.get(k);
    };
    const words = [];
    // 1) 经典歌名：固定位置、放大加粗，周围的小字让开
    const holes = [];
    for (const f of FEATURED) {
      const s = `《${f.t}》`, w = (w100(s, 700) * f.px) / 100, h = f.px * 1.15;
      const cx = R.x + f.u * R.w, cy = R.y + f.v * R.h;
      holes.push({ x0: cx - w / 2 - 3, x1: cx + w / 2 + 3, y0: cy - h / 2 - 2, y1: cy + h / 2 + 2 });
      words.push({ s, x: cx, y: cy, px: f.px, weight: 700, d: 1, alpha: 1, ink: '#24170e', rot: 0, featured: true });
    }
    const inHole = (x0, x1, y) => holes.some((h) => y > h.y0 && y < h.y1 && x1 > h.x0 && x0 < h.x1);
    // 2) 一行行排小字。深浅逐字计算（每个字取它底下的明暗），这样侧脸、眼睛、手指的轮廓能细到一个字宽
    const order = PORTRAIT_SONGS.map((t) => [r(), t]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);
    let next = 0;
    const charW = new Map();
    const cw = (ch, weight) => {
      const k = ch + weight;
      if (!charW.has(k)) { font(mc, 100, { family: SERIF, weight }); charW.set(k, mc.measureText(ch).width / 100); }
      return charW.get(k);
    };
    const tone = (d) => (d < 0.16 ? 0 : clamp(1.15 * Math.pow(d, 1.35), 0, 1));
    const row = (y, px, minD, layer) => {
      let x = R.x + (r() * 0.9 + (layer ? 0.5 : 0)) * px * 3;
      while (x < R.x + R.w - px) {
        const title = order[next % order.length];
        const s = `《${title}》`;
        const chars = [...s];
        const dHead = dens((x + px - R.x) / R.w, (y - R.y) / R.h);
        const weight = dHead > 0.75 ? 700 : 400;
        const offs = [], alphas = [];
        let cx = 0, sum = 0, peak = 0;
        for (const ch of chars) {
          const w = cw(ch, weight) * px;
          const d = dens((x + cx + w / 2 - R.x) / R.w, (y - R.y) / R.h);
          offs.push(cx); alphas.push(tone(d)); sum += d; peak = Math.max(peak, d);
          cx += w;
        }
        const wTot = cx, dAvg = sum / chars.length;
        if (peak < minD || inHole(x, x + wTot, y)) { x += px * 1.6; continue; }
        words.push({ s, x: x + wTot / 2, y, px, weight, d: dAvg, alpha: 1, chars, offs, alphas, wTot,
          ink: INKS[Math.floor(r() * INKS.length)], rot: (r() - 0.5) * 0.02 });
        next++;
        x += wTot + px * 0.2;
      }
    };
    const PX = 9.5, LINE = 10;
    for (let y = R.y + LINE / 2; y < R.y + R.h; y += LINE) row(y, PX * (0.95 + r() * 0.1), 0.12, 0);
    // 暗处再叠一层（错开半行）：头发、衣服、阴影更密
    for (let y = R.y + LINE; y < R.y + R.h; y += LINE) row(y, PX * 0.9, 0.7, 1);
    // 动画参数：炸开方向、半径、聚拢的先后（暗处先到，经典歌名最后落定）
    for (const wd of words) {
      wd.a = r() * Math.PI * 2;
      wd.r0 = 220 + r() * 860;
      wd.rot0 = (r() - 0.5) * 2.4;
      wd.curve = (r() - 0.5) * 260;
      wd.delay = wd.featured ? 1.6 : (1 - wd.d) * 1.0 + r() * 0.6;
    }
    return words;
  });
}

/**
 * 画词云。t 是相对时间（拍）：t=0 光点炸开；[0, BURST_LEN] 四散；从 GATHER_AT 起分批聚拢，GATHER_LEN 拍飞到位；
 * t ≥ DONE 之后直接贴烘焙好的定格图。
 */
export const BURST_LEN = 1.6, GATHER_AT = 2, GATHER_LEN = 4.5, DONE = 8.2;
export function drawWordCloud(ctx, t, origin) {
  const words = wordLayout();
  if (t >= DONE) {
    ctx.drawImage(finalImage(), 0, 0);
    return;
  }
  // 歌名落定时，底下慢慢晕出一层很淡的赭色铅笔底色，把明暗托出来
  const wa = smoothstep(GATHER_AT + 2.2, DONE, t);
  if (wa > 0.01) { ctx.save(); ctx.globalAlpha = wa; ctx.drawImage(washImage(), 0, 0); ctx.restore(); }
  ctx.save();
  words.forEach((wd, i) => {
    const tb = clamp(t / BURST_LEN);
    const eb = ease.out(tb);
    const drift = Math.max(0, t - BURST_LEN) * 10;
    const bx = origin[0] + Math.cos(wd.a) * (wd.r0 * eb + drift);
    const by = origin[1] + Math.sin(wd.a) * (wd.r0 * eb + drift) * 0.7;
    const tg = clamp((t - GATHER_AT - wd.delay) / GATHER_LEN);
    const e = ease.inOut(tg);
    // 聚拢时走一条弧线
    const nx = -(wd.y - by), ny = wd.x - bx, nl = Math.hypot(nx, ny) || 1;
    const arc = Math.sin(Math.PI * e) * wd.curve;
    const x = lerp(bx, wd.x, e) + (nx / nl) * arc, y = lerp(by, wd.y, e) + (ny / nl) * arc;
    const sc = lerp(lerp(0.2, 1.35, eb), 1, e); // 四散时放大一些，歌名在空中认得出
    const rot = lerp(wd.rot0 * eb, wd.rot, e);
    // 四散时每个歌名都看得见（逐字深浅要到聚拢后才显出来）
    const alpha = lerp(smoothstep(0, 0.25, tb) * 0.9, 1, e);
    if (alpha <= 0.01) return;
    const spr = sprite(wd, i);
    ctx.globalAlpha = alpha;
    ctx.setTransform(Math.cos(rot) * sc, Math.sin(rot) * sc, -Math.sin(rot) * sc, Math.cos(rot) * sc, x, y);
    if (e < 0.999 && wd.chars) {
      // 还在飞：用整词的平均深浅（至少 0.35），免得浅色歌名在空中看不见
      ctx.globalAlpha = alpha * lerp(0.85, 1, e);
      if (!wd.flat) wd.flat = flatSprite(wd, i);
      ctx.drawImage(wd.flat, -wd.flat.cw / 2, -wd.flat.ch / 2, wd.flat.cw, wd.flat.ch);
      ctx.globalAlpha = alpha * e;
    }
    ctx.drawImage(spr, -spr.cw / 2, -spr.ch / 2, spr.cw, spr.ch);
  });
  ctx.restore();
}

/** 飞行时用的整词小图：统一深浅。 */
function flatSprite(wd, i) {
  return memo(`wordcloud|flat|${i}`, () => {
    const pad = Math.ceil(wd.px * 0.4);
    const w = Math.ceil(wd.wTot + pad * 2), h = Math.ceil(wd.px * 1.5 + pad);
    const c = makeCanvas(w * SPR, h * SPR);
    const g = c.getContext('2d');
    g.scale(SPR, SPR);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    font(g, wd.px, { family: SERIF, weight: wd.weight });
    g.fillStyle = wd.ink;
    g.globalAlpha = 0.85;
    g.fillText(wd.s, pad, h / 2);
    c.cw = w; c.ch = h;
    return c;
  });
}

/** 每个歌名先烘焙成一张小图（逐字深浅都在里面），动画时整张平移旋转，定格时和动画完全一致。 */
const SPR = 2; // 小图按 2 倍分辨率烘焙，放大时也不糊
function sprite(wd, i) {
  return memo(`wordcloud|spr|${i}`, () => {
    const pad = Math.ceil(wd.px * 0.4);
    const w = Math.ceil((wd.wTot ?? wd.px * [...wd.s].length * 1.05) + pad * 2), h = Math.ceil(wd.px * 1.5 + pad);
    const c = makeCanvas(w * SPR, h * SPR);
    const g = c.getContext('2d');
    g.scale(SPR, SPR);
    g.textBaseline = 'middle';
    font(g, wd.px, { family: SERIF, weight: wd.weight });
    g.fillStyle = wd.ink;
    if (wd.chars) {
      g.textAlign = 'left';
      wd.chars.forEach((ch, k) => {
        if (wd.alphas[k] <= 0.01) return;
        g.globalAlpha = wd.alphas[k];
        g.fillText(ch, pad + wd.offs[k], h / 2);
      });
    } else {
      g.textAlign = 'center';
      g.translate(w / 2, h / 2);
      halo(g, wd.s, wd.px);
      g.fillText(wd.s, 0, 0);
    }
    c.cw = w; c.ch = h;
    return c;
  });
}

/** 经典歌名外面一圈纸色描边，压在密排小字上也认得清。 */
function halo(ctx, s, px) {
  ctx.save();
  ctx.strokeStyle = '#e8e0d2';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.28);
  ctx.globalAlpha = Math.min(1, ctx.globalAlpha * 1.1);
  ctx.strokeText(s, 0, 0);
  ctx.restore();
}

/** 头像底下的淡赭色底色：密度图放大、柔化，暗处最多约 20% 墨色。 */
function washImage() {
  return memo('wordcloud|wash', () => {
    const R = PORTRAIT_RECT;
    const c = makeCanvas(W, Math.ceil(R.y + R.h + 20));
    const small = makeCanvas(PORTRAIT.w, PORTRAIT.h);
    const sg = small.getContext('2d');
    const img = sg.createImageData(PORTRAIT.w, PORTRAIT.h);
    for (let i = 0; i < PORTRAIT.w * PORTRAIT.h; i++) {
      const d = dens((i % PORTRAIT.w) / (PORTRAIT.w - 1), Math.floor(i / PORTRAIT.w) / (PORTRAIT.h - 1));
      img.data[i * 4] = 92; img.data[i * 4 + 1] = 64; img.data[i * 4 + 2] = 40;
      img.data[i * 4 + 3] = Math.round(255 * 0.2 * Math.pow(d, 1.3));
    }
    sg.putImageData(img, 0, 0);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.filter = 'blur(2px)';
    g.drawImage(small, R.x, R.y, R.w, R.h);
    return c;
  });
}

/** 定格的头像（透明底），只烘焙一次。 */
function finalImage() {
  return memo('wordcloud|final', () => {
    const c = makeCanvas(W, Math.ceil(PORTRAIT_RECT.y + PORTRAIT_RECT.h + 20));
    const ctx = c.getContext('2d');
    ctx.drawImage(washImage(), 0, 0);
    wordLayout().forEach((wd, i) => {
      const spr = sprite(wd, i);
      ctx.setTransform(Math.cos(wd.rot), Math.sin(wd.rot), -Math.sin(wd.rot), Math.cos(wd.rot), wd.x, wd.y);
      ctx.drawImage(spr, -spr.cw / 2, -spr.ch / 2, spr.cw, spr.ch);
    });
    return c;
  });
}
