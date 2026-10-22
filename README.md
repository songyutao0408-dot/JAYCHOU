# 十六站

一个漫画小人沿一条贯穿全片的路，依次走过周杰伦的 16 张专辑。约 77.5 秒、1920×1080、127 BPM 的代码动画短片，成片不含音频。仅作个人私藏。

- 完整要求：[`PROMPT.md`](PROMPT.md)
- 当前进度、已确认的决定、下一步：[`PROGRESS.md`](PROGRESS.md)
- 每个阶段的 demo（接触表、关键帧、480p 短片）：[`demo/`](demo/)

## 预览（不用装任何东西）

下载仓库压缩包，解压后**双击 `preview.html`**，用 Chrome 打开即可。

- 地址后面加 `?walk=34` 可以切换到四分之三侧面的走路素材（默认正侧面）
- 底部控制条：播放 / 暂停（空格）、拖动进度、逐帧前进后退（← →，按住 Shift 一次 1 秒）
- 显示当前「小节:拍」和站名；左边的小圆点是节拍灯（红色 = 每小节强拍）
- **对拍**：把本地音频文件拖进窗口（或点「音频」选择），会和画面同步播放。音频只在这个页面里，不保存、不上传。
  右下可以临时改 `FIRST_DOWNBEAT` 和 BPM 观察效果，确定后再写回 `src/beat/config.js`。

## 目录

| 目录 | 内容 |
| --- | --- |
| `src/beat/` | 节拍网格。**`config.js` 里的 `BPM`、`FIRST_DOWNBEAT` 是全片唯一的时间来源** |
| `src/kit/` | 共用绘图工具包（随机数、噪声、纸纹、形状、文字、p5.brush 烘焙；刻线 / 水墨 / 水彩共用渲染在第二、三阶段加入） |
| `src/rig/` | 人物：走路循环帧的播放（`walker.js`）、各站画风转换（`styles.js`） |
| `src/scenes/` | 每站一个场景文件（第一阶段为标名占位）、Intro |
| `src/main/` | 调度、「穿过画框」转场、镜头、Outro、预览页、自查拼图 |
| `src/hud/` | 标题卡、播放器（磁带 / CD / 手机）、字幕 |
| `assets/walk/` | 你的绿幕走路视频；`frames/` 下是提取好的循环帧（透明 PNG + meta.json） |
| `tools/` | 循环提取、构建、截图、接触表、成片渲染、画风对照表、合成配乐 |
| `briefs/` | 每站美术简报 |
| `preview/` | 预览页用到的库和打包结果（双击即用，已提交） |

## 命令（需要 Node 20+、Chrome 或 Chromium、ffmpeg）

```bash
npm install
python3 tools/extract-walk.py assets/walk/walk-side.mp4 side   # 从绿幕视频提取走路循环（需要 numpy、Pillow）
npm run build                 # 打包 src/ → preview/build/bundle.js（加 --fonts 重建字体子集，--walk 重新打包人物帧）
npm test                      # 节拍网格测试 + 场景时间写法检查（只许用小节/拍）
npm run shot -- s01:5 12.3    # 截图（时间写法：秒数 / b:全局拍 / s03:5 第 3 站第 5 拍 / intro:9 / outro:17）
npm run contact               # 全片接触表 → render/contact.png
npm run style-check           # 人物 × 16 种画风对照表 → render/style-check.png
npm run walk-sheet            # 走路循环检查表（全部帧、落在拍上的帧）
npm run render -- --fps 30    # 成片（无音轨）→ render/film_1080p_30fps.mp4；--height 480 出小样
npm run mux -- --video render/film_1080p_30fps.mp4 --audio 我的配乐.wav   # 把配乐合成进去
```

合成配乐的等价 ffmpeg 命令：

```bash
ffmpeg -i film.mp4 -i music.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -shortest film_with_music.mp4
```

第三方组件与许可见 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
