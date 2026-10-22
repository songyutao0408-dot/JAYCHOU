// 把 assets/walk/frames/<套>/ 下的走路循环（walk_XX.png、stand.png、meta.json）以 base64 写进 preview/build/walk.js，
// 双击打开预览页也能做逐像素的画风处理（file:// 下画布不会被「污染」）。
// 用法：node tools/build-walk.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './lib/util.mjs';

const SRC = path.join(ROOT, 'assets/walk/frames');
const OUT = path.join(ROOT, 'preview/build/walk.js');
const sets = {};
if (fs.existsSync(SRC)) {
  for (const name of fs.readdirSync(SRC).sort()) {
    const dir = path.join(SRC, name);
    const metaPath = path.join(dir, 'meta.json');
    if (!fs.existsSync(metaPath)) continue;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64');
    sets[name] = {
      meta,
      frames: Array.from({ length: meta.frames }, (_, i) => b64(`walk_${String(i).padStart(2, '0')}.png`)),
      stand: b64('stand.png'),
    };
    console.log(`  ${name}: ${meta.frames} 帧 + 站立帧（来源 ${meta.source}）`);
  }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `// 自动生成：node tools/build-walk.mjs —— 请勿手改。\nwindow.__WALK = ${JSON.stringify(sets)};\n`);
console.log(`走路帧 ${Object.keys(sets).length} 套 → preview/build/walk.js（${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB）`);
