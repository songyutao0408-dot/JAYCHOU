// 节拍网格配置 —— 全片唯一的时间来源。
// 场景里不允许写秒数，一律用「第几小节第几拍」换算（见 time.js）。

// 速度。配乐实测 126.8，按 127 算；必要时直接改成 126.8。
export const BPM = 127;

// 配乐里第一个强拍出现的秒数。整条时间轴整体后移这么多，
// 前面补 Intro 首帧静止画面。
export const FIRST_DOWNBEAT = 0;

export const BEATS_PER_BAR = 4;

// 每站 4 小节（16 拍，127 BPM 下约 7.56 秒）。
export const STATION_BARS = 4;

// 段落表（按顺序首尾相接）。
export const SECTIONS = [
  { id: 'intro', bars: 3 },
  ...Array.from({ length: 16 }, (_, i) => ({ id: `s${String(i + 1).padStart(2, '0')}`, bars: STATION_BARS, station: i + 1 })),
  { id: 'outro', bars: 11 }, // 原 6 小节 + 结尾新增 5 小节（N1–N5）
];
