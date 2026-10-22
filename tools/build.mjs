// 打包：src/ → preview/build/bundle.js（普通 script 标签即可引入，双击打开也能用）。
// 用法：node tools/build.mjs [--fonts] [--walk] [--watch]
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as esbuild from 'esbuild';
import { ROOT, parseArgs } from './lib/util.mjs';

const args = parseArgs();
const run = (script) => execFileSync(process.execPath, [path.join(ROOT, 'tools', script)], { stdio: 'inherit' });
if (args.fonts || !fs.existsSync(path.join(ROOT, 'preview/build/fonts.js'))) run('build-fonts.mjs');
if (args.walk || !fs.existsSync(path.join(ROOT, 'preview/build/walk.js'))) run('build-walk.mjs');

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
  // 先写到内存，再整体写入临时文件、改名替换：多人同时构建时不会读到写了一半的文件
  const r = await esbuild.build({ ...opts, write: false });
  const out = r.outputFiles[0];
  const tmp = `${out.path}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, out.contents);
  fs.renameSync(tmp, out.path);
  console.log(`  ${path.relative(ROOT, out.path)}  ${(out.contents.length / 1024).toFixed(1)}kb`);
}
