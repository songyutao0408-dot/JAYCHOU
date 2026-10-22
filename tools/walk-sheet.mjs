// 走路循环检查表：node tools/walk-sheet.mjs [--walk side|34] [--style none] [--out 文件]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
const args = parseArgs();
const out = path.resolve(args.out || path.join(ROOT, `render/walk-sheet-${args.walk || 'side'}.png`));
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launch();
const page = await openFilm(browser, args.walk ? `walk=${args.walk}` : '');
fs.writeFileSync(out, Buffer.from(await page.evaluate((style) => window.__film.walkSheet({ style }), args.style || 'none'), 'base64'));
await browser.close();
console.log(out);
