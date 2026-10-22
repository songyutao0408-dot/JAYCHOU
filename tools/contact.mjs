// 接触表：把多个时间点拼成一张图，用来逐帧自查。
//   node tools/contact.mjs                       默认：每段几个关键拍
//   node tools/contact.mjs s01:1 s01:5 ... [--cols 6] [--cell 400] [--out 文件] [--title 标题]
//   node tools/contact.mjs --sections s01,s11   只看这些段落（默认关键拍）
//   node tools/contact.mjs --every 0.25 --from s03:7 --to s04:2   按拍等间隔
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
import { parseSpec } from './lib/spec.mjs';

const args = parseArgs();
const browser = await launch();
const page = await openFilm(browser);
const info = await page.evaluate(() => window.__film.info());

const KEY = {
  intro: [1, 3, 5, 7, 9, 10, 11, 12],
  station: [1, 1.25, 2, 4, 5, 5.5, 7, 7.75],
  outro: [1, 3, 5, 7, 9, 13, 17.2, 21, 24],
};
let specs = args._;
if (args.every) {
  const a = parseSpec(args.from, info), b = parseSpec(args.to, info);
  const step = parseFloat(args.every);
  specs = [];
  for (let x = a.beat; x <= b.beat + 1e-6; x += step) specs.push(`b:${x.toFixed(3)}`);
} else if (!specs.length) {
  const want = args.sections ? args.sections.split(',') : info.sections.map((s) => s.id);
  for (const id of want) {
    const keys = id === 'intro' ? KEY.intro : id === 'outro' ? KEY.outro : KEY.station;
    for (const k of keys) specs.push(`${id}:${k}`);
  }
}
const items = specs.map((s) => {
  const it = parseSpec(s, info);
  const gb = it.beat !== undefined ? it.beat : (it.t - info.firstDownbeat) * info.bpm / 60;
  const bar = Math.floor(gb / 4) + 1, beat = (gb % 4) + 1;
  return { ...it, label: `${s}  ·  ${bar}:${beat.toFixed(2)}` };
});
const cols = parseInt(args.cols || '8', 10), cell = parseInt(args.cell || '300', 10);
const t0 = Date.now();
const b64 = await page.evaluate((o) => window.__film.contact(o), { items, cols, cellW: cell, title: args.title || '' });
const out = path.resolve(args.out || path.join(ROOT, 'render/contact.png'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(b64, 'base64'));
console.log(`${out}  ${items.length} 帧，${((Date.now() - t0) / 1000).toFixed(1)} s`);
await browser.close();
