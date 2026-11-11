"""第 2 站《爱在西元前》单帧验证：人物与墙面共用同一张高度图、同一束光。"""
import sys, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

W, H = 1920, 1080
rng = np.random.default_rng(2001)
FIG = sys.argv[1] if len(sys.argv) > 1 else 'fig_src.png'
OUT = sys.argv[2] if len(sys.argv) > 2 else 's2.png'
FONT = sys.argv[3] if len(sys.argv) > 3 else 'fonts/'

yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# ---------- 基础工具 ----------
def fbm(shape, scales=(64, 24, 8, 3), seed=0):
    r = np.random.default_rng(seed)
    out = np.zeros(shape, np.float32)
    amp, tot = 1.0, 0.0
    for s in scales:
        n = ndi.gaussian_filter(r.standard_normal(shape).astype(np.float32), s)
        out += amp * n / (n.std() + 1e-6)
        tot += amp
        amp *= 0.55
    return out / tot

def hash2(a, b, k=0):
    v = np.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453
    return v - np.floor(v)

def pillow(mask, w):
    """mask(0/1) → 圆角隆起剖面，边缘宽 w 像素"""
    d = ndi.distance_transform_edt(mask > 0.5).astype(np.float32)
    t = np.clip(d / w, 0, 1)
    return 1 - (1 - t) ** 2

def canvas(ss=2):
    im = Image.new('L', (W * ss, H * ss), 0)
    return im, ImageDraw.Draw(im), ss

def tomask(im):
    return np.asarray(im.resize((W, H), Image.LANCZOS), np.float32) / 255.0

# ---------- 光照 ----------
Lv = np.array([0.60, -0.58, 0.50], np.float32); Lv /= np.linalg.norm(Lv)
SUN = np.array([1.00, 0.86, 0.64], np.float32) * 1.18
AMB = np.array([0.43, 0.44, 0.58], np.float32)

def shade(Hm, alb, gloss=None, shadow_len=70):
    gx = ndi.sobel(Hm, axis=1) / 8.0
    gy = ndi.sobel(Hm, axis=0) / 8.0
    n = np.dstack([-gx, -gy, np.ones_like(Hm)])
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    diff = np.clip(n @ Lv, 0, None) / Lv[2]
    # 投影：沿光源方向行进
    d2 = Lv[:2] / np.linalg.norm(Lv[:2]); tan = Lv[2] / np.linalg.norm(Lv[:2])
    sh = np.zeros_like(Hm)
    for k in range(1, shadow_len, 1):
        s = ndi.shift(Hm, (-d2[1] * k, -d2[0] * k), order=1, mode='nearest')
        sh = np.maximum(sh, s - k * tan - Hm)
    lit = 1 - np.clip(sh / 1.2, 0, 1)
    lit = ndi.gaussian_filter(lit, 1.6)
    # 环境遮蔽：凹处更暗
    ao = np.clip(1 - (ndi.gaussian_filter(Hm, 7) - Hm) * 0.045, 0.55, 1.12)
    light = AMB[None, None] * ao[..., None] + SUN[None, None] * (diff * lit)[..., None] * 0.72
    rgb = alb * light
    if gloss is not None:
        hv = Lv + np.array([0, 0, 1], np.float32); hv /= np.linalg.norm(hv)
        spec = np.clip(n @ hv, 0, 1) ** 38
        rgb += (spec * gloss * lit)[..., None] * SUN[None, None] * 0.55
    return rgb, lit

# ---------- 版面 ----------
Y_CREN, Y_WALL = 214, 258          # 城垛顶 / 墙顶
Y_R1, Y_LION0, Y_LION1, Y_R2 = 268, 304, 536, 572
Y_DADO, Y_GROUND = 642, 830
FIG_H, FIG_CX = 566, 800

Hm = np.zeros((H, W), np.float32)
alb = np.zeros((H, W, 3), np.float32)
gloss = np.zeros((H, W), np.float32)

# ---------- 釉砖墙 ----------
bw, bh, j = 66.0, 31.0, 2.6
row = np.floor((yy - Y_WALL) / bh)
xo = xx + (row % 2) * bw / 2 + 13
col = np.floor(xo / bw)
u = xo - col * bw; v = (yy - Y_WALL) - row * bh
ed = np.minimum(np.minimum(u, bw - u), np.minimum(v, bh - v))
brick = np.clip((ed - j * 0.5) / 3.2, 0, 1); brick = 1 - (1 - brick) ** 2
r1, r2, r3 = hash2(col, row, 1), hash2(col, row, 2), hash2(col, row, 3)
tilt = (u - bw / 2) * (r1 - 0.5) * 0.035 + (v - bh / 2) * (r2 - 0.5) * 0.06
Hb = brick * 2.6 + tilt * brick + (r3 - 0.5) * 0.9 * brick
blue = np.array([24, 58, 150], np.float32) / 255
turq = np.array([30, 96, 170], np.float32) / 255
deep = np.array([16, 34, 104], np.float32) / 255
mix = (r1[..., None] < 0.16) * turq + ((r1[..., None] >= 0.16) & (r1[..., None] < 0.34)) * deep + (r1[..., None] >= 0.34) * blue
balb = mix * (0.86 + 0.3 * r2[..., None])
mortar = np.array([20, 22, 40], np.float32) / 255
balb = balb * brick[..., None] + mortar * (1 - brick[..., None])
bglaze = fbm((H, W), (40, 10, 3), 5)
balb *= (1 + 0.10 * bglaze[..., None])

wallm = (yy >= Y_WALL) & (yy < Y_DADO)
# 城垛
cw = 78.0
cren = ((xx + 20) % cw < cw * 0.56) & (yy >= Y_CREN) & (yy < Y_WALL)
step = ((xx + 20) % cw >= cw * 0.14) & ((xx + 20) % cw < cw * 0.42) & (yy >= Y_CREN - 22) & (yy < Y_CREN)
wallm = wallm | cren | step
Hm[wallm] = Hb[wallm]; alb[wallm] = balb[wallm]; gloss[wallm] = (0.55 + 0.5 * r3)[wallm] * brick[wallm]

# ---------- 花饰带 ----------
def rosette_band(y0, y1):
    im, d, ss = canvas(2)
    petals, core = Image.new('L', im.size, 0), Image.new('L', im.size, 0)
    dp, dc = ImageDraw.Draw(petals), ImageDraw.Draw(core)
    cy = (y0 + y1) / 2; R = (y1 - y0) * 0.36
    for cx in np.arange(-10, W + 40, 46.0):
        for k in range(8):
            a = k * np.pi / 4
            px, py = cx + np.cos(a) * R * 0.62, cy + np.sin(a) * R * 0.62
            dp.ellipse([(px - R * .3) * ss, (py - R * .3) * ss, (px + R * .3) * ss, (py + R * .3) * ss], fill=255)
        dc.ellipse([(cx - R * .3) * ss, (cy - R * .3) * ss, (cx + R * .3) * ss, (cy + R * .3) * ss], fill=255)
    P, C = tomask(petals), tomask(core)
    band = (yy >= y0) & (yy < y1)
    line = band & ((yy < y0 + 4) | (yy >= y1 - 4))
    navy = np.array([14, 22, 62], np.float32) / 255
    a2 = alb.copy()
    a2[band] = (navy * (0.85 + 0.3 * r2[..., None]) * brick[..., None] + mortar * (1 - brick[..., None]))[band]
    a2[line] = np.array([226, 172, 58], np.float32) / 255
    a2 = a2 * (1 - P[..., None]) + np.array([240, 232, 210], np.float32) / 255 * P[..., None]
    a2 = a2 * (1 - C[..., None]) + np.array([232, 170, 50], np.float32) / 255 * C[..., None]
    alb[:] = a2
    Hm[:] += pillow(np.maximum(P, C), 3.5) * 2.2 + line * 1.2

rosette_band(Y_R1, Y_LION0)
rosette_band(Y_LION1, Y_R2)

# ---------- 狮子 ----------
def lion(d, ss, ox, oy, s, part):
    def E(cx, cy, rx, ry, f=255):
        d.ellipse([(ox + (cx - rx) * s) * ss, (oy + (cy - ry) * s) * ss, (ox + (cx + rx) * s) * ss, (oy + (cy + ry) * s) * ss], fill=f)
    def Lp(pts, w):
        p = [((ox + x * s) * ss, (oy + y * s) * ss) for x, y in pts]
        d.line(p, fill=255, width=max(1, int(w * s * ss)), joint='curve')
        for x, y in p:
            r = w * s * ss / 2
            d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    if part == 'body':
        E(138, 70, 80, 31); E(200, 66, 42, 40); E(72, 70, 40, 36); E(66, 92, 27, 30)
        E(250, 44, 28, 26); E(276, 55, 17, 14); E(268, 66, 13, 8); E(236, 18, 9, 10)
        Lp([(222, 88), (244, 120), (248, 154)], 21); E(258, 160, 17, 8)
        Lp([(196, 94), (190, 128), (194, 154)], 22); E(204, 160, 17, 8)
        Lp([(60, 104), (44, 130), (56, 154)], 22); E(66, 160, 17, 8)
        Lp([(90, 96), (112, 126), (106, 154)], 21); E(116, 160, 17, 8)
        Lp([(36, 58), (14, 70), (4, 96), (12, 116), (26, 112)], 9); E(29, 110, 9, 9)
    elif part == 'mane':
        E(222, 56, 34, 45); E(210, 90, 27, 23); E(238, 24, 22, 18)
        E(258, 47, 21, 20, 0); E(277, 57, 17, 14, 0); E(236, 17, 6, 7, 0)
    elif part == 'lines':
        E(258, 39, 3.4, 3.4); E(291, 53, 3, 3); Lp([(272, 63), (289, 61)], 1.8)
        Lp([(176, 46), (169, 76), (180, 102)], 1.8); Lp([(98, 46), (106, 76), (94, 104)], 1.8)
        for px in (258, 204, 66, 116):
            for k in (-6, 0, 6): Lp([(px + k + 4, 157), (px + k + 5, 165)], 1.3)

def layer(fn):
    im, d, ss = canvas(2); fn(d, ss); return tomask(im)

LS = 1.24
lion_x = np.arange(-190, W + 100, 452.0)
body = layer(lambda d, ss: [lion(d, ss, x, Y_LION0 + 8, LS, 'body') for x in lion_x])
mane = layer(lambda d, ss: [lion(d, ss, x, Y_LION0 + 8, LS, 'mane') for x in lion_x])
lln = layer(lambda d, ss: [lion(d, ss, x, Y_LION0 + 8, LS, 'lines') for x in lion_x])
lionm = np.maximum(body, mane)
lnz = fbm((H, W), (14, 5, 2), 9)
gold = np.array([232, 170, 52], np.float32) / 255 * (0.9 + 0.25 * r2[..., None])
ochre = np.array([168, 88, 30], np.float32) / 255 * (0.9 + 0.25 * r1[..., None])
la = gold * (1 - mane[..., None]) + ochre * mane[..., None]
la = la * brick[..., None] + mortar * 1.6 * (1 - brick[..., None])
la *= (1 - 0.8 * lln[..., None])
alb[:] = alb * (1 - lionm[..., None]) + la * lionm[..., None]
_cx, _cy = xx / 11.0, yy / 10.0; _r = np.floor(_cy); _c = _cx + (_r % 2) * 0.5
_d = np.hypot(_c - np.floor(_c) - 0.5, (_cy - _r - 0.5))
curl = (np.clip(1 - _d / 0.5, 0, 1) ** 0.6 * 2.0 - np.clip(1 - np.abs(_d - 0.24) / 0.09, 0, 1)) * mane
Hm += pillow(lionm, 9) * 6.5 + pillow(mane, 6) * 2.4 + curl * 1.1 - lln * 1.6

# ---------- 砂岩墙裙 + 队列 ----------
dado = (yy >= Y_DADO) & (yy < Y_GROUND)
sw = 262.0
su = (xx + 60) % sw
sj = np.clip((np.minimum(su, sw - su) - 1.2) / 3, 0, 1)
grain = fbm((H, W), (50, 12, 3, 1.2), 11)
strata = ndi.gaussian_filter(np.random.default_rng(3).standard_normal((H, W)).astype(np.float32), (1.2, 40))
strata /= strata.std()
stone = np.array([226, 198, 150], np.float32) / 255
salb = stone[None, None] * (1 + 0.07 * grain[..., None] + 0.045 * strata[..., None])
salb *= (0.72 + 0.28 * sj[..., None])
Hd = sj * 2.0 + grain * 0.7 + strata * 0.25
top = dado & (yy < Y_DADO + 14); base = dado & (yy >= Y_GROUND - 16)
Hd = Hd + top * 4.0 + base * 5.0
Hm[dado] = Hd[dado] + 1.0; alb[dado] = salb[dado]; gloss[dado] = 0

def bearer(d, ss, ox, oy, s, kind, part):
    def X(x): return (ox + x * s) * ss
    def Y(y): return (oy + y * s) * ss
    def E(cx, cy, rx, ry): d.ellipse([X(cx - rx), Y(cy - ry), X(cx + rx), Y(cy + ry)], fill=255)
    def Lp(pts, w):
        p = [(X(x), Y(y)) for x, y in pts]
        d.line(p, fill=255, width=max(1, int(w * s * ss)), joint='curve')
        r = w * s * ss / 2
        for x, y in p: d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    if part == 'body':
        d.polygon([(X(31), Y(48)), (X(62), Y(48)), (X(71), Y(146)), (X(23), Y(146))], fill=255)
        E(46, 52, 19, 11); E(50, 27, 13, 13); E(37, 33, 8, 8)
        d.polygon([(X(52), Y(32)), (X(67), Y(33)), (X(63), Y(55)), (X(50), Y(50))], fill=255)
        d.rounded_rectangle([X(37), Y(7), X(63), Y(21)], radius=4 * s * ss, fill=255)
        Lp([(48, 58), (64, 76), (80, 68)], 8)
        E(40, 151, 13, 5); E(64, 151, 13, 5)
        if kind == 0: E(88, 64, 9, 11); Lp([(88, 50), (88, 54)], 6)
        elif kind == 1: Lp([(84, 30), (84, 150)], 3.2); E(84, 28, 5, 5)
        elif kind == 2: d.polygon([(X(76), Y(60)), (X(100), Y(60)), (X(94), Y(70)), (X(82), Y(70))], fill=255)
        else: Lp([(82, 66), (92, 44)], 4); E(94, 40, 7, 9)
    else:
        for yv in (104, 124, 140): Lp([(27, yv), (69, yv + 1)], 1.6)
        for xv in range(27, 70, 6): Lp([(xv, 140), (xv - 1, 146)], 1.3)
        Lp([(34, 76), (62, 76)], 1.8)
        for k in range(3): Lp([(54 + k * 4, 36), (53 + k * 4, 50)], 1.2)
        Lp([(38, 14), (62, 14)], 1.3); E(56, 25, 1.8, 1.8)

BS = 1.02
bx = np.arange(-40, W + 60, 132.0)
bb = layer(lambda d, ss: [bearer(d, ss, x, Y_DADO + 20, BS, i % 4, 'body') for i, x in enumerate(bx)])
bl = layer(lambda d, ss: [bearer(d, ss, x, Y_DADO + 20, BS, i % 4, 'lines') for i, x in enumerate(bx)])
Hm += dado * (pillow(bb, 5) * 5.0 - bl * 1.5)
alb *= (1 - 0.30 * (bl * dado)[..., None])

# ---------- 人物：同一块石头上的高浮雕，残留彩绘 ----------
src = cv2.imread(FIG, cv2.IMREAD_UNCHANGED).astype(np.float32)
sh_, sw_ = src.shape[:2]
A = src[..., 3] / 255; B_, G_, R_ = src[..., 0], src[..., 1], src[..., 2]
lum = 0.3 * R_ + 0.59 * G_ + 0.11 * B_
ysrc = np.mgrid[0:sh_, 0:sw_][0] / sh_
skin = ((lum > 92) & (R_ - B_ > 18) & (R_ > G_)).astype(np.float32) * (A > 0.5)
skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, np.ones((5, 5)))
skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (23, 23)))
skin = ndi.binary_fill_holes(skin > 0.5).astype(np.float32) * (A > 0.5)
cloth = (A > 0.5) * (1 - skin)
hair = cloth * (ysrc < 0.142)
shoe = cloth * (ysrc > 0.917)
shirt = cloth * (ysrc >= 0.142) * (ysrc < 0.522)
pants = cloth * (ysrc >= 0.522) * (ysrc <= 0.917)
ear = np.zeros_like(A); cv2.circle(ear, (291, 97), 13, 1.0, -1); ear *= (A > 0.5)
# 细节：局部对比归一化后的明暗 → 刻痕
l2 = cv2.GaussianBlur(lum, (0, 0), 2.6)
hp = l2 - cv2.GaussianBlur(l2, (0, 0), 9)
sd = np.sqrt(cv2.GaussianBlur(hp * hp, (0, 0), 14)) + 4
det = np.clip(hp / sd, -2, 2) * A

sc = FIG_H / sh_
def rs(m): return cv2.resize(m, (int(sw_ * sc), FIG_H), interpolation=cv2.INTER_AREA)
parts = {k: rs(v) for k, v in dict(A=A, skin=skin, hair=hair, shoe=shoe, shirt=shirt, pants=pants, ear=ear, det=det).items()}
fh, fw = parts['A'].shape
fx0 = int(FIG_CX - fw / 2); fy0 = Y_GROUND - 15 - fh + 4
def place(m):
    out = np.zeros((H, W), np.float32); out[fy0:fy0 + fh, fx0:fx0 + fw] = m; return out
P = {k: place(v) for k, v in parts.items()}
fa = np.clip(P['A'], 0, 1); fm = (fa > 0.5).astype(np.float32)

# 头发：亚述式卷纹
cx_, cy_ = xx / 9.0, yy / 8.0
rowc = np.floor(cy_); cxs = cx_ + (rowc % 2) * 0.5
curl_d = np.hypot(cxs - np.floor(cxs) - 0.5, (cy_ - rowc - 0.5) * 1.05)
curls = np.clip(1 - curl_d / 0.5, 0, 1) ** 0.6
ring = np.clip(1 - np.abs(curl_d - 0.22) / 0.09, 0, 1)

Hf = pillow(fm, 16) * 21 + np.clip(ndi.distance_transform_edt(fm) / 46, 0, 1) * 6
Hf += pillow((P['skin'] > 0.5), 7) * 2.6
Hf += pillow((P['hair'] > 0.5), 5) * 2.2 + P['hair'] * (curls * 1.15 - ring * 0.6)
Hf += pillow((P['shoe'] > 0.5), 5) * 1.6
Hf += P['det'] * 1.5 * (1 - P['hair'])
lab = (P['skin'] > .5) * 1 + (P['hair'] > .5) * 2 + (P['shirt'] > .5) * 3 + (P['pants'] > .5) * 4 + (P['shoe'] > .5) * 5
edge = (ndi.maximum_filter(lab, 3) != ndi.minimum_filter(lab, 3)) & (ndi.minimum_filter(fm, 5) > 0)
Hf -= ndi.gaussian_filter(edge.astype(np.float32), 1.1) * 3.2
# 衣褶：沿裤腿的浅刻线
Hf = ndi.gaussian_filter(Hf, 0.8) * fm
# 人物所在处，墙面被铲平成石板底
Hbase = ndi.gaussian_filter(Hm, 6)
Hm = Hm * (1 - fa) + (Hbase * 0.4 + 3.0 + Hf + grain * 0.6) * fa

fstone = np.array([222, 188, 136], np.float32) / 255
pig = {'skin': ([206, 138, 92], 0.80), 'hair': ([24, 21, 30], 0.95), 'shirt': ([244, 232, 204], 0.86),
       'pants': ([92, 56, 44], 0.90), 'shoe': ([52, 38, 36], 0.92)}
wear = fbm((H, W), (22, 7, 2.2, 1), 21)
edge_wear = np.clip(1 - ndi.distance_transform_edt(fm) / 5.0, 0, 1)
falb = np.broadcast_to(fstone, (H, W, 3)).copy()
for k, (c, op) in pig.items():
    m = P[k]
    keep = np.clip(op + 0.20 * wear - 0.45 * edge_wear - 0.10 * np.clip(P['det'], 0, 2), 0.0, 1)
    keep = keep * (wear > -1.25)                     # 剥落的小块
    keep = ndi.gaussian_filter(keep.astype(np.float32), 0.7)
    falb = falb * (1 - (m * keep)[..., None]) + (np.array(c, np.float32) / 255) * (m * keep)[..., None]
red = np.array([196, 46, 34], np.float32) / 255
falb = falb * (1 - P['ear'][..., None]) + red * P['ear'][..., None]
falb *= (1 + 0.07 * grain[..., None] + 0.04 * strata[..., None])
alb = alb * (1 - fa[..., None]) + falb * fa[..., None]
gloss *= (1 - fa)

# ---------- 上光 ----------
region = wallm | dado
rgb, lit = shade(Hm, alb, gloss)

# ---------- 天空 ----------
t = np.clip(yy / 300, 0, 1)[..., None]
sky = (1 - t) * np.array([222, 132, 88], np.float32) / 255 + t * np.array([252, 216, 160], np.float32) / 255
sx, sy = 1490, 118
ds = np.hypot(xx - sx, yy - sy)
sky += np.exp(-(ds / 300) ** 2)[..., None] * np.array([0.20, 0.20, 0.14], np.float32) + np.exp(-(ds / 110) ** 2)[..., None] * np.array([0.16, 0.18, 0.16], np.float32)
sky = sky * (1 - np.clip((62 - ds) / 2, 0, 1)[..., None]) + np.array([1.25, 1.2, 1.0], np.float32) * np.clip((62 - ds) / 2, 0, 1)[..., None]
cl = ndi.gaussian_filter(np.random.default_rng(8).standard_normal((H, W)).astype(np.float32), (3, 90))
cl = np.clip(cl / cl.std() - 1.5, 0, 1) * np.clip(1 - np.abs(yy - 120) / 110, 0, 1)
sky += cl[..., None] * 0.16
# 远景：塔庙、棕榈（薄雾里的剪影）
im = Image.new('L', (W * 2, H * 2), 0); d = ImageDraw.Draw(im)
zx = 1010
for i, (hw, y0, y1) in enumerate([(150, 176, 216), (112, 138, 176), (78, 104, 138), (46, 76, 104)]):
    d.rectangle([(zx - hw) * 2, y0 * 2, (zx + hw) * 2, y1 * 2], fill=255)
zig = tomask(im)
im = Image.new('L', (W * 2, H * 2), 0); d = ImageDraw.Draw(im)
for px, ph, sz in [(96, 150, 1.0), (300, 118, .8), (520, 136, .9), (690, 100, .7), (1300, 128, .85), (1700, 150, 1.0), (1850, 110, .75)]:
    topy = Y_CREN - ph
    d.line([(px * 2, Y_WALL * 2), ((px + 5 * sz) * 2, ((topy + Y_WALL) / 2) * 2), ((px + 12 * sz) * 2, topy * 2)], fill=255, width=int(8 * sz * 2), joint='curve')
    for i, a in enumerate(np.linspace(-3.25, 0.1, 13)):
        ln = (58 + 22 * ((i * 7) % 5) / 4) * sz
        pts = []
        for r in np.linspace(0, 1, 14):
            x = px + 12 * sz + np.cos(a) * r * ln
            y = topy + np.sin(a) * r * ln * 0.75 + r * r * 46 * sz
            pts.append((x * 2, y * 2))
        for k in range(len(pts) - 1):
            d.line([pts[k], pts[k + 1]], fill=255, width=max(2, int((7.5 - 5.5 * k / 13) * sz * 2)))
    d.ellipse([(px + 4 * sz) * 2, (topy - 6 * sz) * 2, (px + 20 * sz) * 2, (topy + 10 * sz) * 2], fill=255)
palm = tomask(im)
sky = sky * (1 - 0.6 * zig[..., None]) + np.array([206, 136, 96], np.float32) / 255 * 0.6 * zig[..., None]
sky = sky * (1 - 0.72 * palm[..., None]) + np.array([150, 98, 60], np.float32) / 255 * 0.72 * palm[..., None]

out = sky.copy()
out[region] = rgb[region]

# ---------- 地面 ----------
gy = yy - Y_GROUND
rows = [0, 38, 86, 148, 250]
pav = np.array([228, 204, 162], np.float32) / 255
galb = np.broadcast_to(pav, (H, W, 3)).copy(); gj = np.ones((H, W), np.float32)
for i in range(len(rows) - 1):
    m = (gy >= rows[i]) & (gy < rows[i + 1]); hh = rows[i + 1] - rows[i]; pw = hh * 3.1
    xo2 = xx + (i * 0.37 + 0.2) * pw; c2 = np.floor(xo2 / pw); uu = xo2 - c2 * pw; vv = gy - rows[i]
    e = np.minimum(np.minimum(uu, pw - uu), np.minimum(vv, hh - vv))
    jn = np.clip(e / (1.6 + i * 0.5), 0, 1)
    tone = 0.93 + 0.14 * hash2(c2, i, 7)
    galb[m] = (pav * tone[..., None])[m]; gj[m] = jn[m]
galb *= (1 + 0.06 * grain[..., None] + 0.03 * fbm((H, W), (90, 30), 31)[..., None])
gl = (AMB * 0.95 + SUN * 0.60)
ground = galb * gl * (0.66 + 0.34 * gj[..., None])
ground *= (1 - 0.30 * np.exp(-np.clip(gy, 0, None) / 16))[..., None]      # 墙根的接触阴影
gm = yy >= Y_GROUND
out[gm] = ground[gm]

# 墙面的大气：上部受夕阳暖光、整体轻雾
hz = np.exp(-((yy - Y_WALL) / 240) ** 2) * region
out += hz[..., None] * np.array([0.045, 0.026, 0.006], np.float32)
glow = np.exp(-(ds / 620) ** 2)[..., None] * np.array([0.06, 0.04, 0.015], np.float32)
out += glow

# ---------- HUD：陶土泥板 ----------
def font(name, size): return ImageFont.truetype(FONT + name, size)
F_CN = lambda s: font('chinese-simplified-900-normal.ttf', s)
F_CN7 = lambda s: font('chinese-simplified-700-normal.ttf', s)
F_IT = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf', s)
F_NUM = lambda s: font('latin-700-normal.ttf', s)

def tablet(x, y, w, h, draw_fn, seed):
    global out
    pad = 30; ss = 2
    def L():
        im = Image.new('L', ((w + pad * 2) * ss, (h + pad * 2) * ss), 0); return im, ImageDraw.Draw(im)
    def dn(im): return np.asarray(im.resize((w + pad * 2, h + pad * 2), Image.LANCZOS), np.float32) / 255
    bi, bd = L(); bd.rounded_rectangle([pad * ss, pad * ss, (pad + w) * ss, (pad + h) * ss], radius=14 * ss, fill=255)
    bm = dn(bi)
    layers = draw_fn(L, dn, pad, ss)       # dict: ink / blue / raised
    n = fbm(bm.shape, (30, 8, 2), seed)
    Ht = pillow(bm, 9) * 9 + n * 0.8
    edge_n = fbm(bm.shape, (6, 2), seed + 1)
    bm2 = np.clip(bm + (edge_n * 0.25) * (bm > 0.02) * (bm < 0.98), 0, 1)
    clay = np.array([232, 204, 158], np.float32) / 255
    al = np.broadcast_to(clay, bm.shape + (3,)).copy() * (1 + 0.06 * n[..., None])
    ink = layers.get('ink'); bl_ = layers.get('blue'); rz = layers.get('raised')
    if rz is not None:
        Ht += pillow(rz, 4) * 3.5
    if 'tape' in layers:
        tp = layers['tape']; Ht += pillow(tp, 3) * 1.5
        al = al * (1 - tp[..., None]) + np.array([30, 66, 152], np.float32) / 255 * tp[..., None]
    if 'hole' in layers:
        ho = layers['hole']; Ht -= ho * 3.0
        al = al * (1 - 0.7 * ho[..., None])
    if ink is not None:
        Ht -= ndi.gaussian_filter(ink, 0.8) * 2.2
        al = al * (1 - ink[..., None]) + np.array([62, 40, 28], np.float32) / 255 * ink[..., None]
    if bl_ is not None:
        Ht -= ndi.gaussian_filter(bl_, 0.8) * 2.0
        al = al * (1 - bl_[..., None]) + np.array([26, 70, 164], np.float32) / 255 * bl_[..., None]
    c, _ = shade(Ht, al, None, 30)
    c *= 1.06
    X0, Y0 = x - pad, y - pad
    sl = (slice(Y0, Y0 + h + pad * 2), slice(X0, X0 + w + pad * 2))
    shd = ndi.gaussian_filter(ndi.shift(bm, (10, -9), order=1), 9)
    out[sl] = out[sl] * (1 - 0.42 * shd[..., None])
    out[sl] = out[sl] * (1 - bm2[..., None]) + c * bm2[..., None]

def title_fn(L, dn, pad, ss):
    ink_i, d1 = L(); blue_i, d2 = L()
    d1.text(((pad + 50) * ss, (pad + 14) * ss), '范特西', font=F_CN(66 * ss), fill=255)
    d1.text(((pad + 52) * ss, (pad + 112) * ss), 'Fantasy', font=F_IT(46 * ss), fill=255)
    d2.text(((pad + 232) * ss, (pad + 110) * ss), '2001', font=F_NUM(42 * ss), fill=255)
    d2.rectangle([(pad + 24) * ss, (pad + 28) * ss, (pad + 31) * ss, (pad + 150) * ss], fill=255)
    for k in range(7):                       # 楔形小刻痕做边饰（不是文字）
        xk = (pad + 250 + k * 12) * ss; yk = (pad + 28) * ss
        d1.polygon([(xk, yk), (xk + 8 * ss, yk + 3 * ss), (xk, yk + 6 * ss)], fill=255)
    return {'ink': dn(ink_i), 'blue': dn(blue_i)}

def song_fn(L, dn, pad, ss):
    ink_i, d1 = L(); blue_i, d2 = L()
    d1.text(((pad + 66) * ss, (pad + 9) * ss), '爱在西元前', font=F_CN(54 * ss), fill=255)
    d2.ellipse([(pad + 22) * ss, (pad + 50) * ss, (pad + 40) * ss, (pad + 66) * ss], fill=255)
    d2.rectangle([(pad + 36) * ss, (pad + 20) * ss, (pad + 41) * ss, (pad + 58) * ss], fill=255)
    d2.polygon([((pad + 41) * ss, (pad + 20) * ss), ((pad + 54) * ss, (pad + 30) * ss), ((pad + 41) * ss, (pad + 34) * ss)], fill=255)
    return {'ink': dn(ink_i), 'blue': dn(blue_i)}

def tape_fn(L, dn, pad, ss):
    ink_i, d1 = L(); tp_i, d2 = L(); ho_i, d3 = L(); rz_i, d4 = L()
    w, h = 210, 136
    d4.rounded_rectangle([(pad + 14) * ss, (pad + 14) * ss, (pad + w - 14) * ss, (pad + 88) * ss], radius=8 * ss, fill=255)
    d2.rectangle([(pad + 22) * ss, (pad + 22) * ss, (pad + w - 22) * ss, (pad + 34) * ss], fill=255)
    d3.rounded_rectangle([(pad + 50) * ss, (pad + 44) * ss, (pad + w - 50) * ss, (pad + 78) * ss], radius=16 * ss, fill=255)
    for cx in (72, w - 72):
        d2.ellipse([(pad + cx - 13) * ss, (pad + 61 - 13) * ss, (pad + cx + 13) * ss, (pad + 61 + 13) * ss], fill=255)
        for k in range(6):
            a = k * np.pi / 3 + 0.3
            d1.line([((pad + cx + np.cos(a) * 3) * ss, (pad + 61 + np.sin(a) * 3) * ss), ((pad + cx + np.cos(a) * 11) * ss, (pad + 61 + np.sin(a) * 11) * ss)], fill=255, width=3 * ss)
    d1.polygon([((pad + 50) * ss, (pad + h - 10) * ss), ((pad + 64) * ss, (pad + 102) * ss), ((pad + w - 64) * ss, (pad + 102) * ss), ((pad + w - 50) * ss, (pad + h - 10) * ss)], outline=255, width=3 * ss)
    for cx in (84, w - 84):
        d1.ellipse([(pad + cx - 4) * ss, (pad + 116) * ss, (pad + cx + 4) * ss, (pad + 124) * ss], fill=255)
    return {'ink': dn(ink_i), 'tape': dn(tp_i), 'hole': dn(ho_i), 'raised': dn(rz_i)}

tablet(48, 40, 360, 178, title_fn, 41)
tablet(1298, 918, 356, 86, song_fn, 43)
tablet(1672, 892, 210, 136, tape_fn, 45)

# ---------- 收尾 ----------
out = np.clip(out, 0, None)
out = out / (1 + 0.10 * out)  * 1.10                 # 轻微压高光
vg = 1 - 0.16 * (((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2) ** 1.2
out *= vg[..., None]
out += rng.standard_normal((H, W, 1)).astype(np.float32) * 0.012
img8 = (np.clip(out, 0, 1) ** (1 / 1.0) * 255).astype(np.uint8)
Image.fromarray(img8).save(OUT)
g = img8.astype(np.float32) @ np.array([0.2126, 0.7152, 0.0722], np.float32)
print('mean luminance %.1f%%' % (g.mean() / 255 * 100))
