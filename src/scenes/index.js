// 场景注册表。第一阶段 16 站都是占位，做好一站就在这里换成正式场景文件。
import { STATIONS } from '../data/stations.js';
import { placeholderScene } from './placeholder.js';
import { intro } from './intro.js';

export const SCENES = { intro };
for (const st of STATIONS) SCENES[st.id] = placeholderScene(st);
