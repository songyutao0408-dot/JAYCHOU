# 第一阶段 demo：骨架（已调整为「全片固定一个形象」）

| 文件 | 看什么 |
| --- | --- |
| `heads_check.png` | **换头对照表**：`assets/heads/three-quarter.png` 在 16 种画风下的自动处理，左侧是原图；均已按脖子底部向下旋转 12° |
| `walk_s01.png` | **人物走路截图**（1080p，第 1 站第 3 拍）：头像 + 身体（细描边、明暗、肤色一致）+ 红耳机 |
| `rig_sheet.png` | 一个步态循环（2 拍）的 8 个相位 |
| `film_480p_30fps.mp4` | 全片 480p 小样（无声）。Intro → 16 个标名占位站 → Outro 展墙 |
| `fps-compare/side-by-side_30vs60.mp4` | **帧率对比**：第 2→3 站一段镜头平移 + 过画框，左 30fps、右 60fps |
| `fps-compare/s02-s03_30fps_1080p.mp4`、`…_60fps_1080p.mp4` | 同一段的 1080p 原尺寸，分别看 |
| `contact_full.png` | 全片接触表：每段 8 个关键拍 |
| `contact_transition_s04-s05.png` | 转场逐格：每 1/8 拍一格，第 5 站第 1 拍（强拍）画框左沿正好压过人物 |
| `contact_intro.png`、`contact_outro.png` | Intro、Outro 每半拍一格 |
| `keyframes/` | 1080p 关键帧截图 |

占位场景里的「占位 · 第 n 站 · 画风」和「第 2 小节的梗：……」是开发用标注，正式场景里不会出现。
占位阶段片中的头像不做画风处理（身体也还没按画风变色），保证肤色一致；各站正式画风做好后再按对照表里的方式处理。
