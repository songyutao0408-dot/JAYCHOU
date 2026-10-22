// 人物检查表：node tools/rig-sheet.mjs [--out 文件]
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
const args = parseArgs();
const out = path.resolve(args.out || path.join(ROOT, 'render/rig-sheet.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launch();
const page = await openFilm(browser);
fs.writeFileSync(out, Buffer.from(await page.evaluate(() => window.__film.rigSheet({})), 'base64'));
await browser.close();
console.log(out);
