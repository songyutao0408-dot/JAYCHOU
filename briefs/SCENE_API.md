# 场景接口说明（写 `src/scenes/sNN.js` 用）

> 先读：`PROMPT.md`（全部要求）、`PROGRESS.md`（已确认的决定）、`briefs/TEMPLATE.md`、本站简报 `briefs/sNN.md`。
> 范例：`src/scenes/s02.js`（视差长条 + 梗）、`s05.js`（p5.brush 铅笔 / 水彩 + 色彩晕开）、`s09.js`（刻线石版 + 原创配角 + 挂在人物身上的道具）。

## 文件与导出

每站一个文件 `src/scenes/sNN.js`，导出同名常量 `export const sNN = { ... }`。注册表 `src/scenes/index.js` 已经导入全部 16 站，**不要改它**。
模块顶层只放定义（常量、函数），不要在顶层执行绘图或可能出错的代码。

## 坐标

- 场景单位：y ∈ [0, 1000] 对应画面全高 1080px（1 单位 = 1.08px）；x ∈ [0, 1000] 是画面中间的正方形，画面实际可见 x ∈ [`X_MIN` ≈ −389, `X_MAX` ≈ 1389]，左右出血也要画满。
- 路面高度 `ROAD_Y = 800`（全片所有站的路都在这里，画框转场时路面对齐）。人物站位 `CHAR_X = 322`（画面约 40% 处），身高 `FIGURE_H = 500` 单位。
- 这些常量在 `src/main/layout.js`、`src/rig/walker.js`。

## 时间（只用拍位，禁止写秒数）

- `b`：段内拍位（0 = 本站第 1 拍强拍）。每站 16 拍，结构见 `STATION`（`src/beat/time.js`）：
  - 第 1–4 拍 `b ∈ [0, 4)`：过画框进场，标题卡、播放器出现
  - 第 5–8 拍 `b ∈ [4, 8)`：往前走，镜头带过场景，可加次要小动作
  - 第 9–12 拍 `b ∈ [8, 12)`（`GAG = 8`）：梗，人物自动定格成站立帧，镜头停住
  - 第 13–16 拍 `b ∈ [12, 16)`：走向下一道画框（下一站的画框在最后 2 拍出现）
- 场景还会在 `b ∈ [−2, 0)` 时被画进上一站的画框里（缩小显示），在 `b ∈ [16, 16.4)` 时作为离场背景；Outro 展墙会定格在 `GAG + 1.5`（或场景的 `freezeBeat`）。
- 写法：`import { GAG, STATION, SB, B } from '../beat/time.js'`。`SB(9) === 8`（第 9 拍），`B(3, 1) === 8`（第 3 小节第 1 拍）。
- `npm test` 会扫描场景文件：不能出现 `Math.random`、`Date`、`performance.now`、`BPM`、`beatSec`、写死的秒数。随机数一律用 `rng(...)` / `hash2(...)`（`src/kit/rng.js`），画面必须是拍位的纯函数。

## 场景对象

```js
export const sNN = {
  id: 'sNN',
  station: stationByN(N),
  drawBack(ctx, b, env) {},   // 必需：背景（单位坐标；人物画在它之后）
  drawFront(ctx, b, env) {},  // 可选：前景（画在人物之前面）
  // ---- 以下都可选 ----
  quantize: 10,               // 第 8、11、13 站：画面按每秒 N 次更新（顿挫感），镜头平移不受影响
  figureStyle: 's03-ink',     // 人物画风名（默认用 STATION_STYLE[N]，见 src/rig/styles.js）
  figureRim: { color: '#fff6e0', width: 5, alpha: 0.9 }, // 人物轮廓光 / 描边（背景偏暗时）
  figureAdjust(b, env) {},    // 返回 { pose:'stand'|'walk', dx, dy, scale, sx, rotate, alpha, hidden, style, rim } 覆盖人物
  drawFigure(ctx, fig, b, env) {}, // 自己画人物（ctx 原点在脚下）；一般用 drawWalker(ctx, { ...fig, style })
  drawFrame(ctx, R, env) {},  // 离场画框的样子（像素坐标！R = { x, y, w, h, s }，边框宽约 64 × s）
  transitionOut(ctx, o) {},   // 自定义离场转场（像素坐标），返回 true 表示已画完（第 14→15 站撕页用）
  freezeBeat: GAG + 3,        // Outro 展墙定格在哪一拍
  cardStyle: { ink, accent, bar: false, bgDraw(ctx, x, y, w, h, b) {} },   // 左上标题卡（像素坐标）
  playerStyle: { ink, plate, noteColor, backdrop: false, palette: {...},  // 右下播放器 + 歌名
    plateDraw(ctx, x, y, w, h) {}, drawPlayer(ctx, kind, cx, cy, s, spin, P, gb) {} },
};
```

## env（第三个参数）

| 字段 | 含义 |
| --- | --- |
| `env.b` | 段内拍位（量化站为量化后的值） |
| `env.cam` | 镜头从本站第 1 拍起向右平移的距离（单位，不量化）。视差层：画面 x = 层内 x − cam × p |
| `env.camAt(bb)` | 第 bb 拍时的镜头位置。把梗用的布景放在「定格时的画面位置」：层内 x = 画面 x + camAt(GAG) × p |
| `env.figure()` | 人物这一帧画在哪：`{ x, y, scale, pose, phase, lean, ... }`（单位坐标，x,y 是脚下） |
| `env.st` | 站点数据（专辑名、歌名、年份、调色板） |

镜头速度约每拍 158 单位；第 9–12 拍停住。一站里镜头总共平移约 2000 单位。

## 人物

- 人物是绿幕视频提取的走路循环（`assets/walk/frames/side/`），不要用代码画人物身体。
- 挂东西用 `ANCHORS`（`src/rig/walker.js`）：`ANCHORS.stand.{shoulder, handR, handL, headTop, ear}`、`ANCHORS.walk.{shoulder, hand, headTop, ear}`，相对脚下、单位坐标，乘 `fig.scale` 后加 `fig.x / fig.y`。
- 画风：在自己的场景文件里注册，不改 `styles.js`：
  ```js
  import { registerStyle, comicBase, mapTone, hatchStyle, watercolor, smoothColor, outline, rgbf } from '../rig/styles.js';
  registerStyle('s03-ink', (I) => { const O = comicBase(I, { levels: 3, lw: 2.4 }); return mapTone(O, ['#1a1a19', '#8d8a82', '#f2eee3']); });
  ```
  `I` 是浮点图像 `{ w, h, r, g, b, a }`（Float32Array，0..1），返回同样结构。结果会按帧缓存。
  注意：`registerStyle` 在模块顶层调用是允许的（只是登记一个函数）。

## 工具箱（`src/kit/`）

| 文件 | 用途 |
| --- | --- |
| `strip.js` | `strip(key, p, draw, { y0, y1 })` 预烘焙一层视差长条；`drawStrip(ctx, S, cam)` 每帧画 |
| `sketch.js` | p5.brush 铅笔线 `sketchStrip`、水彩 `washStrip`；手绘抖动线 `sketchPoly / sketchEllipse / sketchLine / sketchHatch` |
| `etch.js` | 刻线共用渲染（第 7、9 站）：`hatch`、`woodcut`、`carveEdge`、`grainPattern`、`stipple` |
| `brush.js` | `bakeBrush(key, w, h, (B) => {...})` 直接用 p5.brush（独立版，原点左上，像素坐标）。笔刷：`2H HB 2B cpencil pen rotring pastel crayon charcoal spray marker` |
| `paper.js` | `paperTexture(w, h, { base, seed })` 纸纹 |
| `canvas.js` | `baked(key, w, h, draw)`、`memo(key, make)`：按 key 缓存 |
| `rng.js` / `noise.js` | `rng(...keys)`、`hash2(x, y, seed)`、`noise2`、`fbm` |
| `shapes.js` | `roundRect`、`circle`、`ellipse`、`poly`、`smoothPath`、`capsule`、`tube` |
| `text.js` | `font(ctx, px, { family: SERIF | SANS, weight })`；画面上只允许出现专辑名和歌名 |
| `color.js` | `mix`、`rgba`、`readableOn`、`luminance` |
| `math.js` | `clamp`、`lerp`、`ease.*`、`smoothstep`、`keyframes`、`pulse` |

共用渲染的归属：水墨（`src/kit/ink.js`，第 3 站建立）；水彩（`src/kit/watercolor.js`，第 10 站建立，第 14 站复用）。

## 性能

- 静态的东西都预烘焙（`strip` / `baked` / `bakeBrush`），每帧只做平移和少量动态元素。
- 烘焙后每帧 ≤ 150ms（1080p）；首次烘焙 ≤ 30 秒。不要每帧对整屏做逐像素循环。

## 自查（每轮都要真的看图）

```bash
node tools/build.mjs                                   # 改完先打包（出错会报在这里）
node tools/shot.mjs sNN:1.5 sNN:6 sNN:9 sNN:10.5 sNN:14 --out render/sNN   # 截图，用 Read 看 PNG
node tools/contact.mjs --every 0.5 --from sNN:0.5 --to sNN:17 --cols 7 --cell 280 --out render/sNN/contact.png
node tools/brightness.mjs --stations sNN --out render/sNN/brightness           # 亮度与人物反差（全局规则）
npm test                                               # 时间写法与节拍网格
```

检查重点：文字清晰（≥ 36px）、人物在本站画风下认得出、反差合格、转场和梗落在强拍、整体亮度合格、与相邻站（画框里的预览）衔接自然。

## 约束（PROMPT.md 摘要）

不画专辑封面或近似版；不画 MV 具体镜头和构图；画面里只出现专辑名和歌名两种文字（招牌、路牌、海报都不写字）；播放器、品牌、App 界面全部虚构，不用真实 logo；配角都是原创造型，不像任何真实人物。
