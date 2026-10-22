// Intro（3 小节）：纸张质感背景，衬线字体。
//   第 1 小节：一盘虚构磁带从上方落向卡座
//   第 2 小节第 1 拍：「咔哒」推入，计数器从 000 开始转；第 3 拍字幕一淡入
//   第 3 小节第 1 拍：字幕二淡入；人物从磁带标签纸上走出来，落到路上往右走，第 4 小节强拍穿过第一道画框
import { X_MIN, X_MAX, ROAD_Y, CHAR_X, K } from '../main/layout.js';
import { paperTexture } from '../kit/paper.js';
import { bakeBrush } from '../kit/brush.js';
import { mix, rgba } from '../kit/color.js';
import { font, SERIF, SANS } from '../kit/text.js';
import { roundRect, circle } from '../kit/shapes.js';
import { clamp, ease, lerp, smoothstep, keyframes } from '../kit/math.js';
import { B } from '../beat/time.js';
import { drawWalker } from '../rig/walker.js';

const PAPER = '#efe6d2';
const INK = '#3a3129';
const LEAD = '#4a4038';

// 卡座与磁带在世界中的位置（单位）
const DECK = { x: 260, y: 230, w: 600, h: 380 };
const BAY = { x: 310, y: 270, w: 380, h: 250 };
const CAS = { w: 330, h: 210 };
const CAS_REST = { x: BAY.x + (BAY.w - CAS.w) / 2, y: BAY.y + 22 };
const LABEL = { dx: 22, dy: 16, w: CAS.w - 44, h: 106 };
const COUNTER = { x: 716, y: 280, w: 120, h: 60 };

const T_CLICK = B(2, 1);
const T_SUB1 = B(2, 3);
const T_SUB2 = B(3, 1);
const T_OUT = B(3, 1); // 人物走出标签
export const SUBTITLES = ['2000 年，他出发了。', '前面是十六张专辑。'];

// 铅笔纸面：人物先漫画化，再整体向纸色褪 42%（styles.js 的 pencil）
const FIG_STYLE = 'pencil';

function deckStrokes() {
  return bakeBrush('intro-deck', DECK.w * K + 20, DECK.h * K + 20, (Bx) => {
    const s = K, o = 10;
    Bx.set('HB', INK, 1.3);
    Bx.rect(o, o, DECK.w * s, DECK.h * s);
    Bx.set('HB', INK, 1.0);
    Bx.rect(o + (BAY.x - DECK.x) * s, o + (BAY.y - DECK.y) * s, BAY.w * s, BAY.h * s);
    Bx.rect(o + (COUNTER.x - DECK.x) * s, o + (COUNTER.y - DECK.y) * s, COUNTER.w * s, COUNTER.h * s);
    // 按键
    for (let i = 0; i < 6; i++) Bx.rect(o + (60 + i * 66) * s, o + 300 * s, 54 * s, 46 * s);
    // 旋钮
    Bx.circle(o + 520 * s, o + 170 * s, 30 * s);
    Bx.circle(o + 520 * s, o + 270 * s, 22 * s);
    Bx.set('2B', INK, 0.8);
    Bx.line(o + 20 * s, o + 280 * s, o + (DECK.w - 20) * s, o + 280 * s);
  });
}
function cassetteStrokes() {
  return bakeBrush('intro-cassette', CAS.w * K + 20, CAS.h * K + 20, (Bx) => {
    const s = K, o = 10;
    Bx.set('HB', INK, 1.2);
    Bx.rect(o, o, CAS.w * s, CAS.h * s);
    Bx.set('HB', INK, 0.9);
    Bx.rect(o + LABEL.dx * s, o + LABEL.dy * s, LABEL.w * s, LABEL.h * s);
    Bx.rect(o + 110 * s, o + 140 * s, 110 * s, 36 * s);
    Bx.circle(o + 130 * s, o + 158 * s, 14 * s);
    Bx.circle(o + 200 * s, o + 158 * s, 14 * s);
    Bx.line(o + 80 * s, o + CAS.h * s, o + 100 * s, o + 186 * s);
    Bx.line(o + 100 * s, o + 186 * s, o + 230 * s, o + 186 * s);
    Bx.line(o + 230 * s, o + 186 * s, o + 250 * s, o + CAS.h * s);
  });
}
function roadStrokes() {
  return bakeBrush('intro-road', 3600 * K, 60, (Bx) => {
    Bx.set('HB', LEAD, 1.4);
    Bx.line(0, 20, 3600 * K, 20);
    Bx.set('HB', LEAD, 0.6);
    for (let i = 0; i < 70; i++) {
      const x = 40 + i * 55 * K;
      Bx.line(x, 34, x - 26, 50);
    }
  });
}

/** 磁带的竖直位置：第 1 小节从画外落下，第 2 小节强拍「咔哒」到位并轻轻一震。 */
function cassetteY(b) {
  const drop = keyframes([[0, -300], [B(1, 2), -250], [T_CLICK - 0.15, CAS_REST.y - 10]], b, ease.inOut);
  if (b < T_CLICK - 0.15) return drop;
  const u = b - T_CLICK;
  if (u < 0) return lerp(CAS_REST.y - 10, CAS_REST.y + 4, (u + 0.15) / 0.15);
  return CAS_REST.y + 4 * Math.exp(-u * 9) * Math.cos(u * 30);
}

export const intro = {
  id: 'intro',
  station: null,
  figureStyle: FIG_STYLE,
  figureAdjust(b, env) {
    if (b < T_OUT) return { hidden: true };
    const e = ease.inOut(clamp((b - T_OUT) / 1.15));
    const lx = CAS_REST.x + LABEL.dx + LABEL.w * 0.5 - env.cam;
    const ly = CAS_REST.y + LABEL.dy + LABEL.h - 6;
    return {
      dx: lerp(lx - CHAR_X, 0, e),
      dy: lerp(ly - ROAD_Y, 0, e) - Math.sin(Math.PI * e) * 70,
      scale: lerp(0.17, 1, e),
    };
  },
  drawBack(ctx, b, env) {
    const cam = env.cam;
    // 纸（固定在世界里，随镜头平移）
    const pw = Math.ceil((X_MAX - X_MIN + 1600) * K), ph = Math.ceil(1000 * K);
    const paper = paperTexture(pw, ph, { base: PAPER, seed: 7 });
    ctx.drawImage(paper, X_MIN - cam * 1, 0, pw / K, ph / K);
    ctx.save();
    ctx.translate(-cam, 0);
    // 卡座
    roundRect(ctx, DECK.x, DECK.y, DECK.w, DECK.h, 6);
    ctx.fillStyle = mix(PAPER, '#b9ab94', 0.35);
    ctx.fill();
    ctx.fillStyle = mix(PAPER, '#4a4038', 0.55);
    ctx.fillRect(BAY.x, BAY.y, BAY.w, BAY.h);
    ctx.fillStyle = '#2b2622';
    ctx.fillRect(COUNTER.x, COUNTER.y, COUNTER.w, COUNTER.h);
    drawCounter(ctx, b);
    // 按键与旋钮的淡色填充
    ctx.fillStyle = mix(PAPER, '#ffffff', 0.4);
    for (let i = 0; i < 6; i++) ctx.fillRect(DECK.x + 60 + i * 66, DECK.y + 300, 54, 46);
    // 「播放」键在咔哒之后按下
    const pressed = smoothstep(T_CLICK, T_CLICK + 0.2, b);
    ctx.fillStyle = rgba('#c0392b', 0.25 + 0.4 * pressed);
    ctx.fillRect(DECK.x + 60 + 66 * 1, DECK.y + 300 + 6 * pressed, 54, 46 - 6 * pressed);
    const ds = deckStrokes();
    ctx.drawImage(ds, DECK.x - 10 / K, DECK.y - 10 / K, ds.width / K, ds.height / K);

    // 磁带
    const cy = cassetteY(b);
    ctx.save();
    ctx.translate(CAS_REST.x, cy);
    roundRect(ctx, 0, 0, CAS.w, CAS.h, 10);
    ctx.fillStyle = mix(PAPER, '#d9cdb6', 0.6);
    ctx.fill();
    ctx.fillStyle = mix(PAPER, '#ffffff', 0.55);
    ctx.fillRect(LABEL.dx, LABEL.dy, LABEL.w, LABEL.h);
    ctx.fillStyle = rgba('#c0392b', 0.55);
    ctx.fillRect(LABEL.dx, LABEL.dy + 12, LABEL.w, 8);
    // 标签上的手写横线（无字）
    ctx.strokeStyle = rgba(INK, 0.35);
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(LABEL.dx + 14, LABEL.dy + 40 + i * 18); ctx.lineTo(LABEL.dx + 80, LABEL.dy + 40 + i * 18); ctx.stroke(); }
    // 磁带窗里的两个卷轴：咔哒之后开始转
    const spin = Math.max(0, b - T_CLICK) * (Math.PI / 2);
    for (const [x, r] of [[130, 22], [200, 16]]) {
      circle(ctx, x, 158, r); ctx.fillStyle = '#5a4a3c'; ctx.fill();
      ctx.save(); ctx.translate(x, 158); ctx.rotate(spin);
      ctx.fillStyle = PAPER;
      for (let i = 0; i < 3; i++) { ctx.rotate((Math.PI * 2) / 3); ctx.fillRect(-2, -11, 4, 6); }
      ctx.restore();
    }
    const cs = cassetteStrokes();
    ctx.drawImage(cs, -10 / K, -10 / K, cs.width / K, cs.height / K);
    // 标签纸上的小人：走出来之前一直画在标签上
    if (b < T_OUT) {
      ctx.save();
      ctx.translate(LABEL.dx + LABEL.w * 0.5, LABEL.dy + LABEL.h - 6);
      ctx.scale(0.17, 0.17);
      drawWalker(ctx, { pose: 'stand', style: FIG_STYLE });
      ctx.restore();
    }
    ctx.restore();
    // 「咔哒」：到位那一拍四角闪出短线（无字）
    const ck = 1 - smoothstep(T_CLICK, T_CLICK + 0.6, b);
    if (b >= T_CLICK && ck > 0) {
      ctx.strokeStyle = rgba(INK, ck);
      ctx.lineWidth = 3;
      const L = 18 + 22 * (1 - ck);
      for (const [x, y, dx, dy] of [[0, 0, -1, -1], [CAS.w, 0, 1, -1], [0, CAS.h, -1, 1], [CAS.w, CAS.h, 1, 1]]) {
        const px = CAS_REST.x + x, py = CAS_REST.y + y;
        ctx.beginPath(); ctx.moveTo(px + dx * 10, py + dy * 10); ctx.lineTo(px + dx * (10 + L), py + dy * (10 + L)); ctx.stroke();
      }
    }
    // 路：一道铅笔线
    const rs = roadStrokes();
    ctx.drawImage(rs, 80, ROAD_Y - 20 / K, rs.width / K, rs.height / K);
    ctx.restore();
  },
  drawFront(ctx, b) {
    // 两条字幕：固定在画面下方（不随镜头平移）
    const out = 1 - smoothstep(B(3, 3), B(3, 4), b);
    const a1 = smoothstep(T_SUB1, T_SUB1 + 0.7, b) * out;
    const a2 = smoothstep(T_SUB2, T_SUB2 + 0.7, b) * out;
    ctx.save();
    ctx.textAlign = 'center';
    font(ctx, 54, { family: SERIF, weight: 400 });
    ctx.fillStyle = rgba(INK, a1);
    ctx.fillText(SUBTITLES[0], 500, 892);
    font(ctx, 54, { family: SERIF, weight: 700 });
    ctx.fillStyle = rgba(INK, a2);
    ctx.fillText(SUBTITLES[1], 500, 960);
    ctx.restore();
  },
};

function drawCounter(ctx, b) {
  // 三位机械计数器：咔哒之后开始转，最低位连续滚动
  const v = Math.max(0, b - T_CLICK) * 3.2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(COUNTER.x + 6, COUNTER.y + 6, COUNTER.w - 12, COUNTER.h - 12);
  ctx.clip();
  font(ctx, 40, { family: SANS, weight: 700 });
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cw = (COUNTER.w - 12) / 3;
  for (let d = 0; d < 3; d++) {
    const place = Math.pow(10, 2 - d);
    const val = v / place;
    const digit = Math.floor(val) % 10;
    // 只有最低位连续滚；高位在进位时滚
    const frac = d === 2 ? val - Math.floor(val) : Math.max(0, (v % place) - (place - 1));
    const x = COUNTER.x + 6 + cw * (d + 0.5), y = COUNTER.y + COUNTER.h / 2;
    ctx.fillStyle = '#efe6d2';
    ctx.fillText(String(digit), x, y - frac * 44);
    ctx.fillText(String((digit + 1) % 10), x, y + 44 - frac * 44);
  }
  ctx.restore();
}
