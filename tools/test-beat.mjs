// 节拍网格测试：段落起止与 PROMPT 表一致；FIRST_DOWNBEAT 让整条时间轴后移、前面停在 Intro 首帧；改 BPM 后仍按拍换算。
import assert from 'node:assert/strict';
import * as T from '../src/beat/time.js';

const near = (a, b, eps = 0.006) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
assert.equal(T.TOTAL_BEATS, 164);
near(T.duration(), 77.48);
near(T.timeAtBeat(T.sectionById.s01.start), 5.67);
for (let n = 1; n <= 16; n++) near(T.timeAtBeat(T.stationSection(n).start), 5.67 + (n - 1) * 3.78, 0.02);
near(T.timeAtBeat(T.sectionById.outro.start), 66.14);
near(T.sectionById.outro.beats * T.beatSec(), 11.34);

T.setGrid({ firstDownbeat: 1.25 });
assert.equal(T.beatAt(0), 0);          // 配乐第一个强拍之前：Intro 首帧静止
assert.equal(T.beatAt(1.0), 0);
near(T.beatAt(1.25 + T.beatSec() * 12), 12); // 第 1 站强拍整体后移 1.25 秒
near(T.duration(), 77.48 + 1.25);

T.setGrid({ firstDownbeat: 0, bpm: 126.8 });
near(T.duration(), (164 * 60) / 126.8);
T.setGrid({ bpm: 127 });

assert.equal(T.B(2, 1), 4);
assert.equal(T.SB(5), 4);
console.log('节拍网格测试通过。');
