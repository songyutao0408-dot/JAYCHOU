// 把 assets/heads/*.png 以 base64 写进 preview/build/heads.js，
// 这样双击打开预览页也能读到头像（file:// 下画布不会被「污染」）。
//   assets/heads/three-quarter.png  全片唯一的头像
//   assets/heads/<场景id>.png        某站专用（如 s01.png、s11.png、intro.png），优先级最高
// 统一缩到 768×768（屏幕上头部约 160px，留足推近和 Outro 余量）。
// 用法：node tools/build-heads.mjs [--src 其他目录]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch } from './lib/browser.mjs';

const args = parseArgs();
const SRC = path.resolve(args.src || path.join(ROOT, 'assets/heads'));
const OUT = path.join(ROOT, 'preview/build/heads.js');
const SIZE = 768;
const VALID = /^(three-quarter|intro|outro|s\d\d)$/;

const files = [];
if (fs.existsSync(SRC)) {
  for (const f of fs.readdirSync(SRC)) {
    if (!/\.png$/i.test(f)) continue;
    const key = f.replace(/\.png$/i, '');
    if (!VALID.test(key)) { console.warn(`跳过 ${f}：文件名应为 three-quarter.png 或 <场景id>.png（intro、s01…s16）`); continue; }
    files.push({ key, file: path.join(SRC, f) });
  }
}

const out = {};
if (files.length) {
  const browser = await launch();
  const page = await browser.newPage();
  for (const { key, file } of files) {
    const src = 'data:image/png;base64,' + fs.readFileSync(file).toString('base64');
    const res = await page.evaluate(async (src, SIZE) => {
      const im = new Image();
      im.src = src;
      await im.decode();
      const c = document.createElement('canvas');
      c.width = SIZE; c.height = SIZE;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(im, 0, 0, SIZE, SIZE);
      return { w: im.naturalWidth, h: im.naturalHeight, data: c.toDataURL('image/png') };
    }, src, SIZE);
    if (res.w !== res.h) console.warn(`注意：${key} 不是正方形（${res.w}×${res.h}），会被拉伸。规格是 1024×1024。`);
    out[key] = res.data;
    console.log(`  ${key}  ${res.w}×${res.h} → ${SIZE}`);
  }
  await browser.close();
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// 自动生成：node tools/build-heads.mjs —— 请勿手改。\nwindow.__HEADS = ${JSON.stringify(out)};\n`);
console.log(`头像素材 ${files.length} 张 → preview/build/heads.js（来源：${path.relative(ROOT, SRC) || SRC}）`);
