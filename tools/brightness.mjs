// 亮度与人物反差自查（全局规则，每批自查都要跑）：
//   每站第 1、2、3、4 小节各截一帧（第 3 拍，即段内第 2、6、10、14 拍），
//   计算整幅画面平均亮度，以及人物轮廓和背景的反差，输出表格 + 截图。
// 用法：node tools/brightness.mjs [--stations s02,s05,s09] [--out 目录]
// 判定：平均亮度 ≥ 45% 合格，35–45% 偏暗（注意），< 35% 过暗（必须先调）；
//       人物轮廓反差（边缘逐点：向内 6px 内与外侧背景的最大相对亮度比，取中位数）≥ 3 合格，2–3 注意，< 2 不足（加轮廓光或浅色描边）；
//       同时列出轮廓上反差 < 1.5 的「贴色」占比，超过 30% 也要处理。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, parseArgs } from './lib/util.mjs';
import { launch, openFilm } from './lib/browser.mjs';

const args = parseArgs();
const out = path.resolve(args.out || path.join(ROOT, 'render/brightness'));
fs.mkdirSync(out, { recursive: true });
const browser = await launch();
const page = await openFilm(browser);
const info = await page.evaluate(() => window.__film.info());
const ids = args.stations ? args.stations.split(',') : info.sections.filter((s) => s.station).map((s) => s.id);
const BARS = [1, 2, 3, 4];
const grade = (v, good, warn) => (v >= good ? '合格' : v >= warn ? '注意' : '不足');
const rows = [];
for (const id of ids) {
  const sec = info.sections.find((s) => s.id === id);
  const st = info.stations[sec.station - 1];
  const r = { id, n: sec.station, name: `${st.albumZh}「${st.song}」`, bars: [] };
  for (const bar of BARS) {
    const beat = sec.start + (bar - 1) * 4 + 2;
    const a = await page.evaluate((b) => window.__film.analyze(b), beat);
    const file = `${id}_bar${bar}.png`;
    fs.writeFileSync(path.join(out, file), Buffer.from(a.png, 'base64'));
    r.bars.push({ bar, file, mean: a.mean, contrast: a.figurePx > 50 ? a.edge : null, weak: a.figurePx > 50 ? a.weak : null, body: a.contrast });
  }
  r.mean = r.bars.reduce((s, b) => s + b.mean, 0) / BARS.length;
  r.minMean = Math.min(...r.bars.map((b) => b.mean));
  const cs = r.bars.map((b) => b.contrast).filter((c) => c !== null);
  r.minContrast = cs.length ? Math.min(...cs) : null;
  const ws = r.bars.map((b) => b.weak).filter((c) => c !== null);
  r.maxWeak = ws.length ? Math.max(...ws) : null;
  rows.push(r);
  console.log(`${id}  平均亮度 ${(r.mean * 100).toFixed(0)}%（最低 ${(r.minMean * 100).toFixed(0)}%）  轮廓反差最低 ${r.minContrast ? r.minContrast.toFixed(1) : '—'}  贴色最多 ${r.maxWeak !== null ? (r.maxWeak * 100).toFixed(0) + '%' : '—'}`);
}
await browser.close();

const pct = (v) => `${(v * 100).toFixed(0)}%`;
let md = `# 亮度与人物反差表\n\n每站第 1–4 小节各截一帧（每小节第 3 拍）。\n\n`;
md += `判定：平均亮度 ≥ 45% 合格，35–45% 注意，< 35% 不足（必须先调）；人物轮廓反差 ≥ 3 合格，2–3 注意，< 2 不足；轮廓贴色占比 > 30% 也要处理（加轮廓光或浅色描边）。\n`;
md += `亮度 = 整幅画面 Rec.709 亮度的平均值。轮廓反差 = 沿人物边缘逐点，取边缘向内 6px 内（描边或身体）与外侧 3px 背景之间最大的相对亮度比（WCAG 算法），再取中位数；贴色 = 边缘上比值 < 1.5 的点所占比例。\n\n`;
md += `| 站 | 第 1 小节 | 第 2 小节 | 第 3 小节 | 第 4 小节 | 平均亮度 | 轮廓反差（最低） | 贴色（最多） | 结论 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`;
for (const r of rows) {
  const cells = r.bars.map((b) => `${pct(b.mean)} / ${b.contrast ? b.contrast.toFixed(1) : '—'}`);
  const gm = grade(r.minMean, 0.45, 0.35), gc = r.minContrast === null ? '—' : grade(r.minContrast, 3, 2);
  const gw = r.maxWeak === null ? '—' : r.maxWeak <= 0.3 ? '合格' : '不足';
  const ok = gm === '合格' && gc !== '不足' && gw !== '不足';
  md += `| ${r.n} ${r.name} | ${cells.join(' | ')} | ${pct(r.mean)}（${gm}） | ${r.minContrast ? r.minContrast.toFixed(1) : '—'}（${gc}） | ${r.maxWeak !== null ? pct(r.maxWeak) : '—'}（${gw}） | ${ok ? '✅' : '⚠️ 需调整'} |\n`;
}
md += `\n每格：画面平均亮度 / 人物轮廓反差。截图：${rows.map((r) => r.bars.map((b) => `[${r.id} 第${b.bar}小节](${b.file})`).join('、')).join('；')}\n`;
fs.writeFileSync(path.join(out, 'README.md'), md);
fs.writeFileSync(path.join(out, 'brightness.json'), JSON.stringify(rows.map(({ bars, ...r }) => ({ ...r, bars: bars.map(({ file, ...b }) => b) })), null, 1));
console.log(`→ ${path.relative(ROOT, out)}/README.md`);
