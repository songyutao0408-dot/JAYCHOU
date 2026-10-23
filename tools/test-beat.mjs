// 节拍网格测试：段落起止与 PROMPT 表一致；FIRST_DOWNBEAT 让整条时间轴整体后移、前面停在 Intro 首帧；改 BPM 后仍按拍换算。
import assert from 'node:assert/strict';
import * as T from '../src/beat/time.js';

const near = (a, b, eps = 0.006) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
const bar = 4 * 60 / 127;
// Intro 3 小节 + 16 站 × 4 小节 + Outro 11 小节（原 6 小节 + 结尾 5 小节）= 78 小节 = 312 拍
assert.equal(T.TOTAL_BEATS, 312);
near(T.duration(), 78 * bar);                 // ≈ 147.40 秒
assert.ok(T.duration() < 180, '全片应在 3 分钟以内');
near(T.timeAtBeat(T.sectionById.s01.start), 3 * bar); // 5.67
for (let n = 1; n <= 16; n++) near(T.timeAtBeat(T.stationSection(n).start), 3 * bar + (n - 1) * 4 * bar);
near(T.stationSection(1).beats * T.beatSec(), 4 * bar); // 每站 7.56 秒
near(T.timeAtBeat(T.sectionById.outro.start), 67 * bar); // 126.61
near(T.sectionById.outro.beats * T.beatSec(), 11 * bar);
near(T.timeAtBeat(T.sectionById.outro.start + 32), 141.733); // N3 强拍：结尾第一行文案
near(T.timeAtBeat(T.sectionById.outro.start + 36), 143.622); // N4 强拍：第二行
near(T.timeAtBeat(T.sectionById.outro.start + 40), 145.512); // N5 强拍：第三行
assert.deepEqual(T.STATION.gag, [8, 12]);

T.setGrid({ firstDownbeat: 1.25 });
assert.equal(T.beatAt(0), 0);          // 配乐第一个强拍之前：Intro 首帧静止
assert.equal(T.beatAt(1.0), 0);
near(T.beatAt(1.25 + T.beatSec() * 12), 12); // 第 1 站强拍整体后移 1.25 秒
near(T.duration(), 78 * bar + 1.25);

T.setGrid({ firstDownbeat: 0, bpm: 126.8 });
near(T.duration(), (312 * 60) / 126.8);
T.setGrid({ bpm: 127 });

assert.equal(T.B(2, 1), 4);
assert.equal(T.SB(9), 8);
console.log(`节拍网格测试通过：全片 ${T.duration().toFixed(2)} 秒，每站 ${(16 * T.beatSec()).toFixed(2)} 秒。`);
