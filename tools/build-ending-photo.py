# 结尾照片：把用户给的照片做成「艺术黑白照」，色调贴合全片的米黄纸张与深棕墨色，写进 src/data/endphoto.js。
#   python3 tools/build-ending-photo.py 照片.webp [预览.jpg]
# 处理：只取头部和扶耳的手（去掉封面下方的文字）→ 灰度 → 柔和的 S 曲线、黑位轻微抬起（哑光）
#       → 双色调：暗部深棕 #24180f、亮部米白 #efe6d6 → 细颗粒（固定种子）→ 四角轻微暗角。
import base64, io, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

src = sys.argv[1]
im = Image.open(src).convert('L')
W0, H0 = im.size
im = im.crop((int(W0 * 14 / 657), 0, int(W0 * 610 / 657), int(H0 * 470 / 663)))
w, h = im.size
im = im.resize((w * 2, h * 2), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=2, percent=60, threshold=2))
g = np.asarray(im, dtype=np.float32) / 255
H, W = g.shape

# 色阶：去掉两端各 0.5%，再拉一条柔和的 S 曲线
lo, hi = np.percentile(g, 0.5), np.percentile(g, 99.5)
g = np.clip((g - lo) / (hi - lo), 0, 1)
g = 0.5 + (g - 0.5) * 1.12
g = np.clip(g, 0, 1)
g = g * g * (3 - 2 * g) * 0.35 + g * 0.65
g = 0.06 + g * 0.92  # 黑位轻微抬起，像哑光相纸

# 暗角
yy, xx = np.mgrid[0:H, 0:W]
r = np.hypot((xx / (W - 1) - 0.5) / 0.62, (yy / (H - 1) - 0.48) / 0.62)
g *= 1 - 0.22 * np.clip(r - 0.55, 0, 1) ** 1.5

# 细颗粒（固定种子，确定性）
rng = np.random.default_rng(20001107)
grain = rng.normal(0, 1, (H // 2, W // 2)).astype(np.float32)
grain = np.asarray(Image.fromarray(grain).resize((W, H), Image.BILINEAR))
g = np.clip(g + grain * 0.028 * (1 - np.abs(g - 0.5) * 1.2), 0, 1)

# 双色调
dark = np.array([36, 24, 15], np.float32)
mid = np.array([128, 104, 82], np.float32)
light = np.array([239, 230, 214], np.float32)
t = g[..., None]
rgb = np.where(t < 0.5, dark + (mid - dark) * (t / 0.5), mid + (light - mid) * ((t - 0.5) / 0.5))
img = Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), 'RGB')

buf = io.BytesIO()
img.save(buf, format='JPEG', quality=88, optimize=True, progressive=True)
b64 = base64.b64encode(buf.getvalue()).decode()
out = Path(__file__).resolve().parent.parent / 'src/data/endphoto.js'
out.write_text(
    '// 自动生成：python3 tools/build-ending-photo.py 照片 —— 请勿手改。\n'
    '// 结尾的艺术黑白照（双色调 JPEG，base64）。原图不进仓库。\n'
    f'export const END_PHOTO = {{ w: {W}, h: {H}, src: "data:image/jpeg;base64,{b64}" }};\n', encoding='utf-8')
if len(sys.argv) > 2:
    img.save(sys.argv[2], quality=92)
print('写入', out, f'{W}×{H}', f'{len(buf.getvalue()) / 1024:.0f} KB')
