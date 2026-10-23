// 节拍网格测试：段落起止与 PROMPT 表一致；FIRST_DOWNBEAT 让整条时间轴整体后移、前面停在 Intro 首帧；改 BPM 后仍按拍换算。
import assert from 'node:assert/strict';
import * as T from '../src/beat/time.js';

const near = (a, b, eps = 0.006) => assert.ok(Math.abs(a - b) < eps, `${a} ≠ ${b}`);
import { BPM, FIRST_DOWNBEAT } from '../src/beat/config.js';
const bar = 4 * 60 / BPM;
const FD = FIRST_DOWNBEAT;
assert.equal(BPM, 126.8);          // 配乐实测
assert.equal(FD, 0.459);
// Intro 3 小节 + 16 站 × 4 小节 + Outro 15 小节（原 6 + 点亮/胶片圆环 5 + 词云头像与落款 4）= 82 小节 = 328 拍
assert.equal(T.TOTAL_BEATS, 328);
near(T.duration(), FD + 82 * bar);            // ≈ 155.66 秒
assert.ok(T.duration() < 180, '全片应在 3 分钟以内');
near(T.timeAtBeat(T.sectionById.s01.start), FD + 3 * bar);
for (let n = 1; n <= 16; n++) near(T.timeAtBeat(T.stationSection(n).start), FD + 3 * bar + (n - 1) * 4 * bar);
near(T.stationSection(1).beats * T.beatSec(), 4 * bar); // 每站 7.56 秒
near(T.timeAtBeat(T.sectionById.outro.start), FD + 67 * bar);
near(T.sectionById.outro.beats * T.beatSec(), 15 * bar);
near(T.timeAtBeat(T.sectionById.outro.start + 41), FD + 309 * 60 / BPM); // 圆环缩成光点
near(T.timeAtBeat(T.sectionById.outro.start + 48), FD + 316 * 60 / BPM); // 词云头像拼完（第 13 小节强拍）
assert.deepEqual(T.STATION.gag, [8, 12]);

T.setGrid({ firstDownbeat: 1.25 });
assert.equal(T.beatAt(0), 0);          // 配乐第一个强拍之前：Intro 首帧静止
assert.equal(T.beatAt(1.0), 0);
near(T.beatAt(1.25 + T.beatSec() * 12), 12); // 第 1 站强拍整体后移 1.25 秒
near(T.duration(), 82 * bar + 1.25);

T.setGrid({ firstDownbeat: 0, bpm: 127 });
near(T.duration(), (328 * 60) / 127);
T.setGrid({ firstDownbeat: FD, bpm: BPM });

assert.equal(T.B(2, 1), 4);
assert.equal(T.SB(9), 8);
console.log(`节拍网格测试通过：全片 ${T.duration().toFixed(2)} 秒，每站 ${(16 * T.beatSec()).toFixed(2)} 秒。`);
