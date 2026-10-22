// 字体子集：扫描 src/ 里出现的所有字符，从 Noto Serif SC / Noto Sans SC（与思源同字形，OFL）
// 裁出子集，以 base64 写进 preview/build/fonts.js，双击打开预览页也能用。
// 源字体缓存在 .cache/fonts/（不提交），缺失时自动下载。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, walk } from './lib/util.mjs';

const CACHE = path.join(ROOT, '.cache/fonts');
const BASE = 'https://raw.githubusercontent.com/notofonts/noto-cjk/main/';
const FONTS = [
  { family: 'SerifSC', weight: 400, file: 'NotoSerifSC-Regular.otf', url: 'Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf' },
  { family: 'SerifSC', weight: 700, file: 'NotoSerifSC-Bold.otf', url: 'Serif/SubsetOTF/SC/NotoSerifSC-Bold.otf' },
  { family: 'SansSC', weight: 400, file: 'NotoSansSC-Regular.otf', url: 'Sans/SubsetOTF/SC/NotoSansSC-Regular.otf' },
  { family: 'SansSC', weight: 700, file: 'NotoSansSC-Bold.otf', url: 'Sans/SubsetOTF/SC/NotoSansSC-Bold.otf' },
];

fs.mkdirSync(CACHE, { recursive: true });
for (const f of FONTS) {
  const p = path.join(CACHE, f.file);
  if (!fs.existsSync(p)) {
    console.log('下载', f.file);
    try {
      execFileSync('curl', ['-sS', '-fL', '--max-time', '300', '-o', p, BASE + f.url], { stdio: 'inherit' });
    } catch (e) {
      console.error(`字体下载失败：${BASE + f.url}\n请检查网络设置后重试。`);
      process.exit(1);
    }
  }
}

// 收集字符
const chars = new Set();
for (let c = 0x20; c < 0x7f; c++) chars.add(String.fromCharCode(c));
for (const c of '—–「」『』，。！？：；、《》（）·…“”‘’０１２３４５６７８９') chars.add(c);
for (const file of walk(path.join(ROOT, 'src'), (f) => f.endsWith('.js'))) {
  for (const ch of fs.readFileSync(file, 'utf8')) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
}
const text = [...chars].join('');
const tmp = path.join(CACHE, 'subset');
fs.mkdirSync(tmp, { recursive: true });
fs.writeFileSync(path.join(tmp, 'chars.txt'), text);

const out = [];
for (const f of FONTS) {
  const dst = path.join(tmp, f.file.replace('.otf', '.woff2'));
  execFileSync('python3', ['-m', 'fontTools.subset', path.join(CACHE, f.file), `--text-file=${path.join(tmp, 'chars.txt')}`,
    '--flavor=woff2', `--output-file=${dst}`, '--layout-features=*', '--no-hinting'], { stdio: 'inherit' });
  const b64 = fs.readFileSync(dst).toString('base64');
  out.push({ family: f.family, weight: f.weight, data: b64 });
  console.log(`${f.family} ${f.weight}: ${(b64.length / 1024).toFixed(0)} KB`);
}
const js = `// 自动生成：node tools/build-fonts.mjs —— 请勿手改。共 ${chars.size} 个字符。\nwindow.__FONTS = ${JSON.stringify(out)};\n`;
fs.writeFileSync(path.join(ROOT, 'preview/build/fonts.js'), js);
console.log('写入 preview/build/fonts.js，字符数', chars.size);
