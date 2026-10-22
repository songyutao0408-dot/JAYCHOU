// 逐帧渲染 + ffmpeg 合成「无音轨」MP4。
//   node tools/render.mjs [--fps 60] [--from 0] [--to 77.48] [--height 1080|720|480] [--crf 18]
//                         [--workers 3] [--out render/film.mp4] [--frames 目录（同时保存 PNG）] [--walk side|34]
// --from/--to 可以写秒数，也可以写 s03:7 这样的拍位（见 tools/lib/spec.mjs）。
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';
import { parseSpec } from './lib/spec.mjs';

const args = parseArgs();
const fps = parseFloat(args.fps || '60'); // 成片 60fps（镜头平移更顺）；小样可用 --fps 30
const workers = parseInt(args.workers || '3', 10);
const height = parseInt(args.height || '1080', 10);
const crf = args.crf || (height <= 480 ? '26' : '18');
const out = path.resolve(args.out || path.join(ROOT, `render/film_${height}p_${fps}fps.mp4`));
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await launch();
const query = args.walk ? `walk=${args.walk}` : '';
const pages = await Promise.all(Array.from({ length: workers }, () => openFilm(browser, query)));
const info = await pages[0].evaluate(() => window.__film.info());
const toSec = (v, dflt) => {
  if (v === undefined) return dflt;
  const it = parseSpec(String(v), info);
  return it.t !== undefined ? it.t : info.firstDownbeat + (it.beat * 60) / info.bpm;
};
const t0 = toSec(args.from, 0), t1 = toSec(args.to, info.duration);
const n0 = Math.round(t0 * fps), n1 = Math.min(Math.ceil(t1 * fps), Math.floor(info.duration * fps + 1e-6));
const total = n1 - n0 + 1;
console.log(`渲染 ${t0.toFixed(2)}–${t1.toFixed(2)} s，${fps} fps，共 ${total} 帧，${workers} 个页面并行 → ${path.relative(ROOT, out)}`);
if (args.frames) fs.mkdirSync(path.resolve(args.frames), { recursive: true });

const vf = height !== 1080 ? ['-vf', `scale=-2:${height}:flags=lanczos`] : [];
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  ...vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const ffDone = new Promise((res, rej) => ff.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg 退出码 ' + c)))));

// 并行渲染、按顺序写入
const done = new Map();
let nextWrite = n0, nextJob = n0;
const start = Date.now();
async function flush() {
  while (done.has(nextWrite)) {
    const buf = done.get(nextWrite);
    done.delete(nextWrite);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (args.frames) fs.writeFileSync(path.join(path.resolve(args.frames), `${String(nextWrite).padStart(5, '0')}.png`), buf);
    nextWrite++;
    const k = nextWrite - n0;
    if (k % 50 === 0 || nextWrite > n1) {
      const el = (Date.now() - start) / 1000;
      process.stdout.write(`\r  ${k}/${total} 帧  ${(k / el).toFixed(1)} 帧/秒  剩余约 ${Math.round(((total - k) * el) / k)} 秒   `);
    }
  }
}
let flushing = Promise.resolve();
await Promise.all(pages.map(async (page) => {
  while (nextJob <= n1) {
    const i = nextJob++;
    const b64 = await page.evaluate((t) => window.__film.capture(t), i / fps);
    done.set(i, Buffer.from(b64, 'base64'));
    // 防止内存堆积：领先太多就等一等
    while (i - nextWrite > workers * 8) await new Promise((r) => setTimeout(r, 5));
    flushing = flushing.then(flush);
  }
}));
await flushing;
ff.stdin.end();
await ffDone;
await browser.close();
const mb = fs.statSync(out).size / 1048576;
console.log(`\n完成：${out}（${mb.toFixed(1)} MB，用时 ${((Date.now() - start) / 1000).toFixed(0)} 秒）`);
