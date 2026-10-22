// 把配乐合成进无音轨成片（视频流直接复制，不重新编码）。
//   node tools/mux-audio.mjs --video render/film_1080p_30fps.mp4 --audio 我的配乐.wav [--out render/film_with_music.mp4]
//   [--audio-offset 0]  配乐整体延后（正数）或提前（负数）的秒数；正常情况下保持 0，
//                       对拍请改 src/beat/config.js 的 FIRST_DOWNBEAT 后重新渲染。
// 等价的 ffmpeg 命令：
//   ffmpeg -i film.mp4 -i music.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest out.mp4
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, parseArgs } from './lib/util.mjs';

const a = parseArgs();
if (!a.video || !a.audio) {
  console.log('用法：node tools/mux-audio.mjs --video 成片.mp4 --audio 配乐.wav [--out 输出.mp4] [--audio-offset 秒]');
  process.exit(1);
}
const out = path.resolve(a.out || path.join(ROOT, 'render/film_with_music.mp4'));
const off = parseFloat(a['audio-offset'] || '0');
const args = ['-y', '-i', a.video, ...(off ? ['-itsoffset', String(off)] : []), '-i', a.audio,
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out];
console.log('ffmpeg ' + args.join(' '));
const r = spawnSync('ffmpeg', args, { stdio: 'inherit' });
process.exit(r.status ?? 1);
