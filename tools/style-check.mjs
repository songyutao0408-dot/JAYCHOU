// 人物 × 16 种画风对照表：node tools/style-check.mjs [--walk side|34] [--frame 0] [--out 文件]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
const args = parseArgs();
const out = path.resolve(args.out || path.join(ROOT, 'render/style-check.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launch();
const page = await openFilm(browser, args.walk ? `walk=${args.walk}` : '');
const frame = parseInt(args.frame || '0', 10);
fs.writeFileSync(out, Buffer.from(await page.evaluate((frame) => window.__film.styleCheck({ frame }), frame), 'base64'));
await browser.close();
console.log(out);
