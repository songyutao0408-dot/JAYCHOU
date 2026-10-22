// 场景注册表。第一阶段 16 站都是占位，做好一站就在这里换成正式场景文件。
import { STATIONS } from '../data/stations.js';
import { placeholderScene } from './placeholder.js';
import { intro } from './intro.js';
import { s02 } from './s02.js';
import { s05 } from './s05.js';
import { s09 } from './s09.js';

export const SCENES = { intro };
for (const st of STATIONS) SCENES[st.id] = placeholderScene(st);
// 第二阶段精做的站
SCENES.s02 = s02;
SCENES.s05 = s05;
SCENES.s09 = s09;
