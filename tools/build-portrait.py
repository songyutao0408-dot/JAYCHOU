# 结尾词云头像的明暗图：从用户给的参考照片生成一张低分辨率「文字密度图」，写进 src/data/portrait.js。
#   python3 tools/build-portrait.py 参考图.webp
# 参考照片本身不进仓库，只提交这张 220×174 的密度图（0 = 留白，255 = 最密）。
# 密度 = 暗部（头发、衣服、阴影）+ 轮廓线（侧脸、眼睛、手指的边缘）；和画面边缘相连的平坦亮背景清零；
# 封面下方的文字区域裁掉不用；底部（肩膀衣服）和左右两侧逐渐淡出到 0，头像不是一个方块。
import base64, sys
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
W, H = 220, 174
im = Image.open(src).convert('L')
# 只取头部和扶耳的手（参考图 657×663 的左上 580×460），下方的标题文字不要
im = im.crop((int(im.width * 20 / 657), 0, int(im.width * 600 / 657), int(im.height * 460 / 663)))
g = np.asarray(im.resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
gb = np.asarray(im.filter(ImageFilter.GaussianBlur(2)).resize((W, H), Image.LANCZOS), dtype=np.float32) / 255
gx = np.zeros_like(gb); gy = np.zeros_like(gb)
gx[:, 1:-1] = gb[:, 2:] - gb[:, :-2]; gy[1:-1] = gb[2:] - gb[:-2]
edge = np.sqrt(gx ** 2 + gy ** 2)

# 背景：从画面左、右、上边缘出发，连通的「亮且平坦」区域
ok = (g > 0.55) & (edge < 0.035)
bg = np.zeros((H, W), bool); q = deque()
seeds = [(y, x) for y in range(H) for x in (0, W - 1)] + [(0, x) for x in range(W)]
for y, x in seeds:
    if ok[y, x] and not bg[y, x]:
        bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        yy, xx = y + dy, x + dx
        if 0 <= yy < H and 0 <= xx < W and not bg[yy, xx] and ok[yy, xx]:
            bg[yy, xx] = True; q.append((yy, xx))

dark = np.clip((1 - g - 0.16) / 0.68, 0, 1) ** 1.3
d = np.maximum(dark, np.clip(edge * 12, 0, 1) * 0.9)  # 轮廓线加重：侧脸、眼睛、嘴唇、手指
d[bg] = 0
# 顶部收边（头发不切成一条平线）
rows0 = np.arange(H)[:, None] / (H - 1)
d *= np.clip(rows0 / 0.12, 0, 1) ** 0.8
# 底部淡出：最下面 28% 渐变到 0（肩膀衣服慢慢消失，不压成硬边）
rows = np.arange(H)[:, None] / (H - 1)
d *= np.clip(1 - (rows - 0.72) / 0.28, 0, 1) ** 1.3
# 左右两侧收边：离中心 36% 以外渐变到 0
cols = np.arange(W)[None, :] / (W - 1)
d *= np.clip(1 - np.maximum(0, np.abs(cols - 0.5) - 0.36) / 0.14, 0, 1)

data = (np.clip(d, 0, 1) * 255).astype(np.uint8)
b64 = base64.b64encode(data.tobytes()).decode()
out = Path(__file__).resolve().parent.parent / 'src/data/portrait.js'
out.write_text(
    '// 自动生成：python3 tools/build-portrait.py 参考图 —— 请勿手改。\n'
    '// 结尾词云头像的文字密度图（0 = 留白，255 = 最密），行优先。\n'
    f'export const PORTRAIT = {{ w: {W}, h: {H}, data: "{b64}" }};\n', encoding='utf-8')
Image.fromarray(255 - data).save(Path(sys.argv[2]) if len(sys.argv) > 2 else '/dev/null', format='PNG') if len(sys.argv) > 2 else None
print('写入', out, f'{W}×{H}', '平均密度', round(float(d.mean()), 3))
