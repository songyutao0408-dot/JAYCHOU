#!/usr/bin/env python3
"""从绿幕走路视频里提取一个干净的走路循环 + 一帧站立姿势，存成透明 PNG。

用法：python3 tools/extract-walk.py assets/walk/walk-side.mp4 side [--period 30] [--walk-from 72] [--stand 12]
输出：assets/walk/frames/<name>/walk_XX.png、stand.png、meta.json（只提交这些，中间文件不落盘）

步骤：
 1. 抠像：alpha 由「绿色程度」g - max(r, b) 决定，带软边；左上角水印区域清空
 2. 去绿边：半透明边缘按背景色反解前景色，再把 g 压到不超过 (r+b)/2 附近
 3. 找循环：头部+脚底对齐后的轮廓做自相关，在稳定走路段里找首尾最接近的一段（左右脚各一步）
 4. 循环从脚跟落地（前后脚张得最开）那一帧开始；另一只脚落地的位置记为 strikes[1]，播放时据此让两步都踩在拍上
 5. 对齐：头部中心的水平位置去掉漂移后固定；每帧最低点（着地的脚）对齐到同一条基线
 6. 朝向：根据支撑脚相对身体的移动方向判断，朝左就水平翻转
 7. 测量支撑脚后退的速度（存储像素/帧），用于让镜头平移和脚步匹配、不打滑
"""
import sys, json, os, subprocess, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('name')
ap.add_argument('--period', type=int, default=0, help='循环长度（帧），0 = 自动')
ap.add_argument('--walk-from', type=int, default=72, help='从第几帧以后找循环（跳过开头站立）')
ap.add_argument('--stand', type=int, default=12, help='站立姿势取第几帧')
ap.add_argument('--height', type=int, default=560, help='输出里人物的身高（像素）')
ap.add_argument('--root', default=os.path.join(os.path.dirname(__file__), '..'))
a = ap.parse_args()

# ---------- 读视频 ----------
probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height',
                        '-of', 'csv=p=0', a.video], capture_output=True, text=True).stdout.strip().split(',')
W, H = int(probe[0]), int(probe[1])
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', a.video, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
V = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3)
N = len(V)
print(f'{a.video}: {N} 帧 {W}x{H}')

WM = (slice(0, 90), slice(0, 160))  # 水印区域（左上角「AI生成」）

def key_alpha(f):
    x = V[f].astype(np.float32)
    k = x[..., 1] - np.maximum(x[..., 0], x[..., 2])
    alpha = np.clip((70 - k) / (70 - 22), 0, 1)
    alpha[WM] = 0
    return alpha

def bg_color(f, alpha):
    x = V[f].reshape(-1, 3).astype(np.float32)
    m = alpha.reshape(-1) < 0.01
    return np.median(x[m][::7], axis=0)

def matte(f):
    """返回去绿边后的 RGBA（float32 0..1）。"""
    alpha = key_alpha(f)
    # 去掉离主体很远的零星噪点：只保留主体外接框附近
    ys, xs = np.nonzero(alpha > 0.5)
    y0, y1, x0, x1 = ys.min() - 20, ys.max() + 20, xs.min() - 20, xs.max() + 20
    keep = np.zeros_like(alpha); keep[max(0, y0):y1, max(0, x0):x1] = 1
    alpha *= keep
    rgb = V[f].astype(np.float32)
    bg = bg_color(f, alpha)
    a3 = alpha[..., None]
    # 半透明边缘：pixel = a*fg + (1-a)*bg  →  fg = (pixel - (1-a)*bg)/a
    edge = (alpha > 0.04) & (alpha < 0.98)
    fg = rgb.copy()
    fg[edge] = (rgb[edge] - (1 - a3[edge]) * bg) / np.maximum(a3[edge], 0.04)
    fg = np.clip(fg, 0, 255)
    # 去绿：g 不超过 r、b 平均值 +12
    lim = (fg[..., 0] + fg[..., 2]) / 2 + 12
    fg[..., 1] = np.minimum(fg[..., 1], lim)
    return np.dstack([fg / 255, alpha])

def body_stats(alpha):
    ys, xs = np.nonzero(alpha > 0.5)
    top, bot = ys.min(), ys.max(); h = bot - top
    head = ys < top + 0.13 * h
    lower = ys > top + 0.82 * h
    return dict(top=int(top), bot=int(bot), h=int(h), headX=float(xs[head].mean()),
                spread=float(xs[lower].max() - xs[lower].min()),
                lowX=float(xs[ys >= bot - 6].mean()))

# ---------- 找循环 ----------
print('分析轮廓…')
stats = {}; sig = {}
for f in range(a.walk_from, N):
    al = key_alpha(f)
    s = body_stats(al); stats[f] = s
    # 以头部中心、脚底对齐的小轮廓
    pad = np.zeros((H + 600, W + 600), np.float32); pad[300:300 + H, 300:300 + W] = al
    cy = 300 + s['bot'] - 1080; cx = int(300 + s['headX'] - 350)
    crop = pad[cy:cy + 1100, cx:cx + 700]
    sig[f] = np.asarray(Image.fromarray((crop * 255).astype(np.uint8)).resize((70, 110), Image.BILINEAR), np.float32) / 255
frames = sorted(sig)
dif = lambda i, j: float(np.abs(sig[i] - sig[j]).mean())
if a.period:
    periods = [a.period]
else:
    lag = {L: np.mean([dif(i, i + L) for i in frames if i + L in sig]) for L in range(18, 40)}
    best = min(lag, key=lag.get)
    periods = [best - 1, best, best + 1]
    print('自动周期：', best, '帧')
cands = []
for P in periods:
    for s in frames:
        if s + P not in sig: break
        # 首尾相接的差 + 首尾附近两帧的差（保证接缝前后运动方向也一致）
        sc = dif(s, s + P) + 0.5 * dif(s + 1, s + P + 1 if s + P + 1 in sig else s + P)
        cands.append((sc, s, P))
sc, s0, P = min(cands)
print(f'循环：第 {s0}–{s0 + P - 1} 帧（{P} 帧），首尾差 {sc:.4f}')
loop = list(range(s0, s0 + P))

# 从脚跟落地开始。落地时两脚张得最开、身体也最低（头顶 y 最大）；
# 四分之三侧面两腿前后重叠，单看张开程度不准，所以两项各占一半
def norm(v): v = np.asarray(v, np.float64); return (v - v.min()) / max(1e-6, v.max() - v.min())
strike = 0.5 * norm([stats[f]['spread'] for f in loop]) + 0.5 * norm([stats[f]['top'] for f in loop])
strike = np.array([np.mean(np.take(strike, [i - 1, i, i + 1], mode='wrap')) for i in range(P)])
k0 = int(np.argmax(strike))
loop = loop[k0:] + loop[:k0]
strike = np.roll(strike, -k0)
# 另一只脚落地：循环中段附近的第二个峰
lo, hi = int(round(P * 0.42)), int(round(P * 0.58)) + 1  # 限制在中段附近，时间重映射不至于太不均匀
k1 = lo + int(np.argmax(strike[lo:hi]))
print(f'脚跟落地：第 0 帧和第 {k1} 帧（共 {P} 帧）')

# ---------- 朝向 ----------
lowX = np.array([stats[f]['lowX'] - stats[f]['headX'] for f in loop])
d = np.diff(np.concatenate([lowX, lowX[:1]]))
facing = 'right' if np.median(d) < 0 else 'left'
flip = facing == 'left'
print('朝向：', facing, '（翻转）' if flip else '')

# ---------- 对齐 ----------
headX = np.array([stats[f]['headX'] for f in loop], np.float64)
# 去掉循环内的线性漂移，再做环形平滑，得到每帧需要抵消的水平偏移
trend = np.linspace(0, headX[-1] + (headX[-1] - headX[-2]) - headX[0], P, endpoint=False)
hx = headX - trend
ker = np.array([1, 2, 3, 2, 1], np.float64); ker /= ker.sum()
hx_s = np.array([np.sum(ker * np.take(hx, range(i - 2, i + 3), mode='wrap')) for i in range(P)])
# 抵消：漂移 + 平滑后的头部位置；保留平滑掉的那点自然晃动以外的一切
shift_x = trend + (hx_s - hx_s.mean())
bots = np.array([stats[f]['bot'] for f in loop])
person_h = float(np.median([stats[f]['h'] for f in loop]))
scale = a.height / person_h

stand_alpha = key_alpha(a.stand)
st = body_stats(stand_alpha)

# 统一画布：以头部中心为 x 锚点，以基线为 y 锚点
def placed_bbox(alpha, sx, bot):
    ys, xs = np.nonzero(alpha > 0.02)
    return xs.min() - sx, xs.max() - sx, ys.min() - bot, ys.max() - bot
boxes = [placed_bbox(key_alpha(f), headX[0] + shift_x[i], bots[i]) for i, f in enumerate(loop)]
boxes.append(placed_bbox(stand_alpha, st['headX'], st['bot']))
x0 = min(b[0] for b in boxes) - 16; x1 = max(b[1] for b in boxes) + 16
y0 = min(b[2] for b in boxes) - 6; y1 = 4
CW, CH = int(np.ceil((x1 - x0) * scale)), int(np.ceil((y1 - y0) * scale))
anchorX = -x0 * scale; baseY = -y0 * scale
print(f'输出画布 {CW}x{CH}，锚点 ({anchorX:.1f}, {baseY:.1f})，缩放 {scale:.4f}')

out_dir = os.path.join(a.root, 'assets/walk/frames', a.name)
os.makedirs(out_dir, exist_ok=True)
for old in os.listdir(out_dir):
    if old.endswith('.png') or old == 'meta.json': os.remove(os.path.join(out_dir, old))

def render(f, sx, bot, path):
    rgba = matte(f)
    img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
    # 原图坐标 → 画布：先平移使锚点对齐，再缩放
    big = Image.new('RGBA', (int((x1 - x0)) + 2, int((y1 - y0)) + 2), (0, 0, 0, 0))
    big.paste(img, (int(round(-x0 - sx)), int(round(-y0 - bot))), img)
    small = big.resize((CW, CH), Image.LANCZOS)
    if flip: small = small.transpose(Image.FLIP_LEFT_RIGHT)
    small.save(path, optimize=True)

for i, f in enumerate(loop):
    render(f, headX[0] + shift_x[i], bots[i], os.path.join(out_dir, f'walk_{i:02d}.png'))
render(a.stand, st['headX'], st['bot'], os.path.join(out_dir, 'stand.png'))

# 支撑脚后退速度：着地点相对头部的水平移动（取每步支撑期中段的中位数），换算到输出像素
steps = []
for i in range(P):
    j = (i + 1) % P
    fi, fj = loop[i], loop[j]
    if stats[fi]['bot'] >= np.median(bots) - 3 and stats[fj]['bot'] >= np.median(bots) - 3:
        steps.append((stats[fj]['lowX'] - (headX[0] + shift_x[j])) - (stats[fi]['lowX'] - (headX[0] + shift_x[i])))
foot = float(np.median([s for s in steps if s < 0])) * scale if any(s < 0 for s in steps) else -8.0
if flip: foot = foot  # 翻转后方向一致（都表示向后）
meta = dict(source=os.path.basename(a.video), name=a.name, fps=24, frames=P, sourceFrames=[int(f) for f in loop],
            strikes=[0, k1], width=CW, height=CH, anchorX=round(anchorX, 2), baseY=round(baseY, 2),
            personHeight=a.height, footSpeedPxPerFrame=round(abs(foot), 3), standSourceFrame=a.stand, flipped=flip)
json.dump(meta, open(os.path.join(out_dir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
size = sum(os.path.getsize(os.path.join(out_dir, x)) for x in os.listdir(out_dir))
print(f'写入 {out_dir}：{P} 帧 + stand.png，共 {size / 1048576:.1f} MB；支撑脚速度 {abs(foot):.2f} px/帧')
