// 打包：src/ → preview/build/bundle.js（普通 script 标签即可引入，双击打开也能用）。
// 用法：node tools/build.mjs [--fonts] [--heads] [--watch]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import { ROOT, parseArgs } from './lib/util.mjs';

const args = parseArgs();
const run = (script) => execFileSync(process.execPath, [path.join(ROOT, 'tools', script)], { stdio: 'inherit' });
if (args.fonts || !fs.existsSync(path.join(ROOT, 'preview/build/fonts.js'))) run('build-fonts.mjs');
if (args.heads || !fs.existsSync(path.join(ROOT, 'preview/build/heads.js'))) run('build-heads.mjs');

const opts = {
  entryPoints: [path.join(ROOT, 'src/main/entry.js')],
  bundle: true,
  format: 'iife',
  target: 'chrome110',
  outfile: path.join(ROOT, 'preview/build/bundle.js'),
  banner: { js: '// 自动生成：node tools/build.mjs —— 请勿手改，源码在 src/。' },
  logLevel: 'info',
};
if (args.watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('监听 src/ 变化中…');
} else {
  await esbuild.build(opts);
}
