// 拍 ⇄ 秒 的换算，以及「现在落在哪个段落的第几拍」。
// 约定：beat 位置一律从 0 开始计数的浮点数（0 = 第 1 小节第 1 拍）。
// 对外用 1 起的「小节、拍」写法：B(2, 1) 表示第 2 小节第 1 拍。
import { BPM, FIRST_DOWNBEAT, BEATS_PER_BAR, SECTIONS } from './config.js';

// 运行时网格：默认取 config.js；预览页对拍时可以临时覆盖（不写回文件）。
export const grid = { bpm: BPM, firstDownbeat: FIRST_DOWNBEAT };
export function setGrid({ bpm, firstDownbeat } = {}) {
  if (Number.isFinite(bpm) && bpm > 0) grid.bpm = bpm;
  if (Number.isFinite(firstDownbeat) && firstDownbeat >= 0) grid.firstDownbeat = firstDownbeat;
}

export const beatSec = () => 60 / grid.bpm;
export const barSec = () => beatSec() * BEATS_PER_BAR;

/** 段内位置：第 bar 小节第 beat 拍（都从 1 起，beat 可带小数）→ 段内拍位（0 起）。 */
export const B = (bar, beat = 1) => (bar - 1) * BEATS_PER_BAR + (beat - 1);

/** 每站 8 拍的写法：第 n 拍（1–8，可带小数）→ 段内拍位。 */
export const SB = (n) => n - 1;

// 段落起止（单位：拍，全局）
let acc = 0;
export const sections = SECTIONS.map((s) => {
  const start = acc;
  acc += s.bars * BEATS_PER_BAR;
  return { ...s, start, beats: s.bars * BEATS_PER_BAR, end: acc };
});
export const TOTAL_BEATS = acc;
export const sectionById = Object.fromEntries(sections.map((s) => [s.id, s]));
export const stationSection = (n) => sections.find((s) => s.station === n);

/** 全片时长（秒），含 FIRST_DOWNBEAT 前补的静止画面。 */
export const duration = () => grid.firstDownbeat + TOTAL_BEATS * beatSec();

/** 成片时间（秒）→ 全局拍位。FIRST_DOWNBEAT 之前停在 0（Intro 首帧静止）。 */
export function beatAt(t) {
  const b = (t - grid.firstDownbeat) / beatSec();
  return Math.min(Math.max(b, 0), TOTAL_BEATS);
}

/** 全局拍位 → 成片时间（秒）。 */
export const timeAtBeat = (gb) => grid.firstDownbeat + gb * beatSec();

/** 全局拍位所在的段落。 */
export function sectionAt(gb) {
  for (const s of sections) if (gb < s.end) return s;
  return sections[sections.length - 1];
}

/** 「小节:拍」显示用字符串（全局 1 起）。 */
export function barBeatLabel(gb) {
  const bar = Math.floor(gb / BEATS_PER_BAR) + 1;
  const beat = Math.floor(gb % BEATS_PER_BAR) + 1;
  return `${bar}:${beat}`;
}

/** 把拍位量化成每秒 hz 次更新（皮影、胶片、蜡笔的顿挫）。 */
export function quantizeBeats(b, hz) {
  const s = b * beatSec();
  return (Math.floor(s * hz + 1e-6) / hz) / beatSec();
}
