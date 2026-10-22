# 第三方组件与许可

本项目代码为自行编写，仅作个人私藏。以下第三方组件随仓库分发（`preview/lib/`、`preview/build/fonts.js`）或在工具链中使用：

| 组件 | 版本 | 许可 | 用途 | 位置 |
| --- | --- | --- | --- | --- |
| [p5.js](https://p5js.org) | 2.3.4 | LGPL-2.1 | 画布与绘图宿主 | `preview/lib/p5.min.js`（许可全文 `preview/lib/p5.LICENSE.txt`） |
| [p5.brush](https://github.com/acamposuribe/p5.brush) | 2.2.3（独立版 `dist/brush.js`） | MIT，© 2023-2026 Alejandro Campos Uribe | 自然笔触（铅笔线等），烘焙成图后合成 | `preview/lib/p5.brush.standalone.js`（许可全文 `preview/lib/p5.brush.LICENSE.md`） |
| [Noto Serif SC / Noto Sans SC](https://github.com/notofonts/noto-cjk)（与思源宋体 / 思源黑体同字形） | noto-cjk main 分支 SubsetOTF | SIL Open Font License 1.1 | 全片文字；裁成子集后以 base64 嵌入 | `preview/build/fonts.js`（许可全文 `preview/lib/OFL.txt`） |
| [puppeteer-core](https://pptr.dev) | 见 `package.json` | Apache-2.0 | 逐帧截图（开发工具，不随成片分发） | `node_modules/` |
| [esbuild](https://esbuild.github.io) | 见 `package.json` | MIT | 打包（开发工具） | `node_modules/` |
| [FFmpeg](https://ffmpeg.org) | 系统安装 | LGPL/GPL | 合成视频（开发工具，不随仓库分发） | — |
| [fontTools](https://github.com/fonttools/fonttools) | pip 安装 | MIT | 字体子集（开发工具） | — |

## 关于参考仓库

参考了 [Tunai-0511/meme67-art-history](https://github.com/Tunai-0511/meme67-art-history)（代码 MIT）的**工作思路**：共用绘图工具包 + 节拍模块 + 每站一个场景文件、画面为 `renderAt(t)` 纯函数、Puppeteer 逐帧 + ffmpeg、截图与接触表自查、先写规格再派子代理。
**未复制其任何代码**；其影片、封面、渲染帧和音频（保留所有权利）均未使用；其美术简报、构图、笑点、百叶窗转场、年份计数器、博物馆标签卡均未采用。
若今后复用任何代码片段，会在此处保留原作者的 MIT 版权与许可声明。
