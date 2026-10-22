// 截图：node tools/shot.mjs s01:1 s01:5 12.3 b:40 [--out 目录] [--prefix 名字]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
import { parseSpec } from './lib/spec.mjs';

const args = parseArgs();
const outDir = path.resolve(args.out || path.join(ROOT, 'render/shots'));
fs.mkdirSync(outDir, { recursive: true });
const browser = await launch();
const page = await openFilm(browser);
const info = await page.evaluate(() => window.__film.info());
for (const spec of args._) {
  const it = parseSpec(spec, info);
  const t0 = Date.now();
  const b64 = await page.evaluate((it) => window.__film.capture(it.t, it.beat !== undefined ? { beat: it.beat } : {}), it);
  const file = path.join(outDir, `${args.prefix || 'shot'}_${spec.replace(/[:/]/g, '-')}.png`);
  fs.writeFileSync(file, Buffer.from(b64, 'base64'));
  console.log(`${file}  (${Date.now() - t0} ms)`);
}
await browser.close();
