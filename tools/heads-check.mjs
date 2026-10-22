// 换头对照表：头像（assets/heads/three-quarter.png，没有则为占位头）在 16 种画风下各渲染一张，拼成一张图。
//   node tools/heads-check.mjs [--out 文件]
// 先自动运行 build-heads.mjs，把 assets/heads/ 的最新素材打包进预览页。
// 加 --src 目录 可以临时用别的素材目录检查（不会改动 assets/）。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';

const args = parseArgs();
execFileSync(process.execPath, [path.join(ROOT, 'tools/build-heads.mjs'), ...(args.src ? ['--src', args.src] : [])], { stdio: 'inherit' });
const out = path.resolve(args.out || path.join(ROOT, 'render/heads-check.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await launch();
const page = await openFilm(browser);
fs.writeFileSync(out, Buffer.from(await page.evaluate(() => window.__film.headsCheck({})), 'base64'));
await browser.close();
console.log(out);
