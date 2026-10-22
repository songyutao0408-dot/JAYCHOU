// 检查场景代码里有没有绕过节拍网格的时间写法：
//   - 不允许直接用墙钟或帧号（Date、performance.now、millis、frameCount、deltaTime）
//   - 不允许用 Math.random（画面必须是时间的纯函数）
//   - 不允许直接 import BPM / FIRST_DOWNBEAT 或 beatSec（场景只拿「段内拍位」b）
//   - 不允许出现写死的秒数（如 2.5s、3 秒、sec = 1.2）
// 用法：node tools/lint-time.mjs   （有问题时退出码为 1）
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, walk } from './lib/util.mjs';

const RULES = [
  [/\bDate\b|performance\.now|\bmillis\s*\(|\bframeCount\b|\bdeltaTime\b/, '用了墙钟或帧号'],
  [/Math\.random/, '用了 Math.random（请用 kit/rng.js）'],
  [/\b(BPM|FIRST_DOWNBEAT|beatSec|barSec|timeAtBeat)\b/, '场景里不应直接用 BPM/秒换算'],
  [/\b\d+(\.\d+)?\s*(s|sec|secs|seconds)\b(?!['"`])|\d+(\.\d+)?\s*秒/, '疑似写死的秒数'],
];
let bad = 0;
for (const file of walk(path.join(ROOT, 'src/scenes'), (f) => f.endsWith('.js'))) {
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    for (const [re, msg] of RULES) if (re.test(code)) { console.log(`${path.relative(ROOT, file)}:${i + 1}  ${msg}\n    ${line.trim()}`); bad++; }
  });
}
console.log(bad ? `发现 ${bad} 处问题` : '场景时间写法检查通过：只用小节/拍。');
process.exit(bad ? 1 : 0);
