// 文字：只用随项目打包的开源字体（Noto Serif SC / Noto Sans SC），不依赖系统字体。
export const SERIF = 'SerifSC';
export const SANS = 'SansSC';
/** 1080p 下文字最小字号。 */
export const MIN_TEXT_PX = 36;

export function font(ctx, px, { family = SERIF, weight = 400, italic = false } = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${px}px "${family}", serif`;
}

/** 按字距绘制（Canvas2D 的 letterSpacing 在部分环境下不可用，这里手动排）。 */
export function spacedText(ctx, str, x, y, spacing = 0, align = 'left') {
  const chars = [...str];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const saved = ctx.textAlign;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = saved;
  return total;
}

/** 加载 preview/build/fonts.js 里嵌入的字体。 */
export async function loadEmbeddedFonts() {
  const list = (typeof window !== 'undefined' && window.__FONTS) || [];
  for (const f of list) {
    const bin = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
    const face = new FontFace(f.family, bin.buffer, { weight: String(f.weight) });
    await face.load();
    document.fonts.add(face);
  }
  return list.length;
}
