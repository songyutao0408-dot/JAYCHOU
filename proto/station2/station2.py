"""第 2 站《爱在西元前》4 小节动画验证。

人物是墙上的一块彩绘高浮雕：和釉砖墙、狮子、砂岩队列共用一张高度图、一束斜阳。
背景长墙一次烘焙，人物所在的局部每帧重新上光（含他投在墙上的影子）。

用法: python3 station2.py <走路帧目录> <站立帧.png> <字体目录> <输出帧目录> [起始帧 结束帧]
"""
import sys, os, glob, numpy as np, cv2
from multiprocessing import Pool
from PIL import Image, ImageDraw, ImageFont
from scipy import ndimage as ndi

WALK_DIR, STAND, FONT, OUTDIR = sys.argv[1:5]
W, H = 1920, 1080
# ---------- 节拍（全部由拍换算，不写死秒数） ----------
BPM, FPS = 126.8, 30
BEAT = 60.0 / BPM
BEATS = 16
GAG0, GAG1 = 8.0, 12.0            # 第 3 小节：定格
NF = int(round(BEATS * BEAT * FPS))
LOOP0, LOOPN = 138, 31            # 走路循环在源视频里的起始帧 / 帧数（两步）
FIG_H, SRC_H = 566, 1036.0
SC = FIG_H / SRC_H
STEP = 338 * SC                   # 一步（一拍）镜头走过的像素：按支撑脚后退速度换算
FIG_CX = 800
CAM0 = 40
WW = 4500

def walkbeats(b): return b if b < GAG0 else (GAG0 if b < GAG1 else b - (GAG1 - GAG0))
def cam_at(b): return CAM0 + STEP * walkbeats(b)
GATE_X = cam_at(14.0) + W          # 离场画框在最后 2 拍入画

# ---------- 工具 ----------
def blur(a, s): return cv2.GaussianBlur(a, (0, 0), s)
def fbm(shape, scales, seed):
    r = np.random.default_rng(seed); out = np.zeros(shape, np.float32); amp = 1.0; tot = 0.0
    for s in scales:
        n = blur(r.standard_normal(shape).astype(np.float32), s); out += amp * n / (n.std() + 1e-6); tot += amp; amp *= 0.55
    return out / tot
def hash2(a, b, k=0):
    v = np.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453
    return (v - np.floor(v)).astype(np.float32)
def pillow(mask, w):
    d = cv2.distanceTransform((mask > 0.5).astype(np.uint8), cv2.DIST_L2, 5)
    t = np.clip(d / w, 0, 1); return 1 - (1 - t) ** 2
def shift(a, dx, dy):
    M = np.float32([[1, 0, dx], [0, 1, dy]])
    return cv2.warpAffine(a, M, (a.shape[1], a.shape[0]), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
def ease(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def back(x):
    x = np.clip(x, 0, 1); c = 1.70158; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2

Lv = np.array([0.60, -0.58, 0.50], np.float32); Lv /= np.linalg.norm(Lv)
SUN = np.array([1.00, 0.86, 0.64], np.float32) * 1.18
AMB = np.array([0.43, 0.44, 0.58], np.float32)
D2 = Lv[:2] / np.linalg.norm(Lv[:2]); TAN = Lv[2] / np.linalg.norm(Lv[:2])
HV = Lv + np.array([0, 0, 1], np.float32); HV /= np.linalg.norm(HV)

def shade(Hm, alb, gloss=None, shadow_len=70):
    Hm = np.ascontiguousarray(Hm, np.float32); alb = alb.astype(np.float32)
    if gloss is not None: gloss = gloss.astype(np.float32)
    gx = cv2.Sobel(Hm, cv2.CV_32F, 1, 0, ksize=3) / 8.0
    gy = cv2.Sobel(Hm, cv2.CV_32F, 0, 1, ksize=3) / 8.0
    inv = 1.0 / np.sqrt(gx * gx + gy * gy + 1)
    ndl = (-gx * Lv[0] - gy * Lv[1] + Lv[2]) * inv
    diff = np.clip(ndl, 0, None) / Lv[2]
    sh = np.zeros_like(Hm)
    for k in range(1, shadow_len):
        s = shift(Hm, -D2[0] * k, -D2[1] * k)
        np.maximum(sh, s - k * TAN - Hm, out=sh)
    lit = blur(1 - np.clip(sh / 1.2, 0, 1), 1.6)
    ao = np.clip(1 - (blur(Hm, 7) - Hm) * 0.045, 0.55, 1.12)
    rgb = alb * (AMB[None, None] * ao[..., None] + SUN[None, None] * (diff * lit)[..., None] * 0.72)
    if gloss is not None:
        ndh = (-gx * HV[0] - gy * HV[1] + HV[2]) * inv
        rgb += (np.clip(ndh, 0, 1) ** 38 * gloss * lit)[..., None] * SUN[None, None] * 0.55
    return rgb

# ---------- 版面 ----------
Y_CREN, Y_WALL = 214, 258
Y_R1, Y_LION0, Y_LION1, Y_R2 = 268, 304, 536, 572
Y_DADO, Y_GROUND = 642, 830
Y_TOWER = 132
GATE_W, PIER = 640, 170
ARCH_X0, ARCH_X1 = GATE_X + PIER, GATE_X + GATE_W - PIER
ARCH_R = (ARCH_X1 - ARCH_X0) / 2; ARCH_CY = 440
SY0, SY1 = 70, 850                 # 烘焙条带的行范围

def mask_layer(fn, x0, x1, ss=2):
    im = Image.new('L', (int((x1 - x0) * ss), H * ss), 0); fn(ImageDraw.Draw(im), ss, x0)
    return np.asarray(im.resize((int(x1 - x0), H), Image.LANCZOS), np.float32) / 255.0

def world_layer(fn):
    """分段画，避免一次开超大画布"""
    out = np.zeros((H, WW), np.float32)
    for x0 in range(0, WW, 1500):
        x1 = min(WW, x0 + 1500); out[:, x0:x1] = mask_layer(fn, x0, x1)
    return out

def lion(d, ss, ox, oy, s, part):
    def E(cx, cy, rx, ry, f=255):
        d.ellipse([(ox + (cx - rx) * s) * ss, (oy + (cy - ry) * s) * ss, (ox + (cx + rx) * s) * ss, (oy + (cy + ry) * s) * ss], fill=f)
    def Lp(pts, w):
        p = [((ox + x * s) * ss, (oy + y * s) * ss) for x, y in pts]
        d.line(p, fill=255, width=max(1, int(w * s * ss)), joint='curve')
        r = w * s * ss / 2
        for x, y in p: d.ellipse([x - r, y - r, x + r, y + r], fill=255)
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
    else:
        E(258, 39, 3.4, 3.4); E(291, 53, 3, 3); Lp([(272, 63), (289, 61)], 1.8)
        Lp([(176, 46), (169, 76), (180, 102)], 1.8); Lp([(98, 46), (106, 76), (94, 104)], 1.8)
        for px in (258, 204, 66, 116):
            for k in (-6, 0, 6): Lp([(px + k + 4, 157), (px + k + 5, 165)], 1.3)

def bearer(d, ss, ox, oy, s, kind, part, front=False):
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
        E(46, 52, 19, 11)
        if front:      # 转成正脸：对称的头、胡子、帽子
            E(47, 25, 17, 17); E(29, 26, 5, 7); E(65, 26, 5, 7)
            d.polygon([(X(37), Y(33)), (X(57), Y(33)), (X(54), Y(58)), (X(40), Y(58))], fill=255)
            d.rounded_rectangle([X(31), Y(0), X(63), Y(14)], radius=4 * s * ss, fill=255)
        else:
            E(50, 27, 13, 13); E(37, 33, 8, 8)
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
        if front:
            E(41, 24, 3.2, 3.6); E(53, 24, 3.2, 3.6); Lp([(36, 17.5), (45, 15.5)], 1.6); Lp([(49, 15.5), (58, 17.5)], 1.6)
            for k in range(4): Lp([(41 + k * 4, 38), (41.5 + k * 3.6, 55)], 1.2)
            Lp([(33, 8), (61, 8)], 1.3); E(47, 34, 2.6, 2.2)
        else:
            for k in range(3): Lp([(54 + k * 4, 36), (53 + k * 4, 50)], 1.2)
            Lp([(38, 14), (62, 14)], 1.3); E(56, 25, 1.8, 1.8)

LS, BS = 1.24, 1.02
LION_X = [x for x in np.arange(-190, WW, 452.0) if x + 300 * LS < GATE_X - 30]
BEAR_X = [x for x in np.arange(-40, WW, 132.0) if x + 100 * BS < GATE_X - 10]
FIG_WX_GAG = cam_at(GAG0) + FIG_CX
FRONT_I = min(range(len(BEAR_X)), key=lambda i: abs(BEAR_X[i] + 48 - (FIG_WX_GAG + 215)))

def build_world(front_i=None):
    yy, xx = np.mgrid[0:H, 0:WW].astype(np.float32)
    Hm = np.zeros((H, WW), np.float32); alb = np.zeros((H, WW, 3), np.float32); gloss = np.zeros((H, WW), np.float32)
    # 釉砖
    bw, bh, j = 66.0, 31.0, 2.6
    row = np.floor((yy - Y_WALL) / bh); xo = xx + (row % 2) * bw / 2 + 13; col = np.floor(xo / bw)
    u = xo - col * bw; v = (yy - Y_WALL) - row * bh
    ed = np.minimum(np.minimum(u, bw - u), np.minimum(v, bh - v))
    brick = np.clip((ed - j * 0.5) / 3.2, 0, 1); brick = 1 - (1 - brick) ** 2
    r1, r2, r3 = hash2(col, row, 1), hash2(col, row, 2), hash2(col, row, 3)
    Hb = brick * 2.6 + ((u - bw / 2) * (r1 - 0.5) * 0.035 + (v - bh / 2) * (r2 - 0.5) * 0.06) * brick + (r3 - 0.5) * 0.9 * brick
    blue = np.array([24, 58, 150], np.float32) / 255; turq = np.array([30, 96, 170], np.float32) / 255; deep = np.array([16, 34, 104], np.float32) / 255
    r1e = r1[..., None]
    mix = (r1e < 0.16) * turq + ((r1e >= 0.16) & (r1e < 0.34)) * deep + (r1e >= 0.34) * blue
    mortar = np.array([20, 22, 40], np.float32) / 255
    balb = mix * (0.86 + 0.3 * r2[..., None]); balb = balb * brick[..., None] + mortar * (1 - brick[..., None])
    balb *= (1 + 0.10 * fbm((H, WW), (40, 10, 3), 5)[..., None])
    tower = (xx >= GATE_X) & (xx < GATE_X + GATE_W)
    wallm = (yy >= Y_WALL) & (yy < Y_DADO) & ~tower
    cw = 78.0
    wallm |= ((xx + 20) % cw < cw * 0.56) & (yy >= Y_CREN) & (yy < Y_WALL) & ~tower
    wallm |= ((xx + 20) % cw >= cw * 0.14) & ((xx + 20) % cw < cw * 0.42) & (yy >= Y_CREN - 22) & (yy < Y_CREN) & ~tower
    # 城门楼（离场画框）
    tx = xx - GATE_X
    towerm = tower & (yy >= Y_TOWER) & (yy < Y_GROUND)
    towerm |= tower & ((tx + 9) % 80 < 46) & (yy >= Y_TOWER - 40) & (yy < Y_TOWER)
    towerm |= tower & ((tx + 9) % 80 >= 12) & ((tx + 9) % 80 < 34) & (yy >= Y_TOWER - 62) & (yy < Y_TOWER - 40)
    acx = (ARCH_X0 + ARCH_X1) / 2
    def arch(r_extra):
        return ((np.abs(xx - acx) < ARCH_R + r_extra) & (yy >= ARCH_CY) & (yy < Y_GROUND)) | (np.hypot(xx - acx, yy - ARCH_CY) < ARCH_R + r_extra) & (yy < ARCH_CY + 1)
    openm = arch(0); trim = arch(26) & ~openm; trim2 = arch(34) & ~arch(26)
    towerm &= ~openm
    region = wallm | towerm
    Hm[region] = Hb[region]; alb[region] = balb[region]; gloss[region] = ((0.55 + 0.5 * r3) * brick)[region]
    Hm[towerm] += 4.0            # 门楼比墙面凸出一层
    # 拱券：黄白相间的釉砖
    ang = np.arctan2(yy - ARCH_CY, xx - acx)
    seg = np.where(yy < ARCH_CY, np.floor(ang / (np.pi / 14)), np.floor((yy - ARCH_CY) / 34) + 40)
    vj = np.where(yy < ARCH_CY, np.abs(((ang / (np.pi / 14)) % 1) - 0.5), np.abs((((yy - ARCH_CY) / 34) % 1) - 0.5))
    vj = np.clip((0.5 - vj) * 9, 0, 1)
    gold_c = np.array([232, 172, 54], np.float32) / 255; white_c = np.array([240, 232, 210], np.float32) / 255
    tc = np.where((seg % 2 == 0)[..., None], gold_c, white_c) * (0.6 + 0.4 * vj[..., None])
    alb[trim] = tc[trim]; Hm[trim] = 4.0 + 5.0 * vj[trim]; gloss[trim] = 0.8
    alb[trim2] = np.array([14, 22, 62], np.float32) / 255; Hm[trim2] = 5.5; gloss[trim2] = 0.7

    # 花饰带
    def rosette(y0, y1, xa, xb, extra_h=0.0):
        cy = (y0 + y1) / 2; R = (y1 - y0) * 0.36
        def fp(d, ss, x0):
            for cx in np.arange(xa + 13, xb, 46.0):
                for k in range(8):
                    a = k * np.pi / 4; px, py = cx - x0 + np.cos(a) * R * .62, cy + np.sin(a) * R * .62
                    d.ellipse([(px - R * .3) * ss, (py - R * .3) * ss, (px + R * .3) * ss, (py + R * .3) * ss], fill=255)
        def fc(d, ss, x0):
            for cx in np.arange(xa + 13, xb, 46.0):
                d.ellipse([(cx - x0 - R * .3) * ss, (cy - R * .3) * ss, (cx - x0 + R * .3) * ss, (cy + R * .3) * ss], fill=255)
        P, C = world_layer(fp), world_layer(fc)
        band = (yy >= y0) & (yy < y1) & (xx >= xa) & (xx < xb) & region
        line = band & ((yy < y0 + 4) | (yy >= y1 - 4))
        navy = np.array([14, 22, 62], np.float32) / 255
        alb[band] = (navy * (0.85 + 0.3 * r2[..., None]) * brick[..., None] + mortar * (1 - brick[..., None]))[band]
        alb[line] = gold_c
        P = P * band; C = C * band
        alb[:] = alb * (1 - P[..., None]) + white_c * P[..., None]
        alb[:] = alb * (1 - C[..., None]) + gold_c * C[..., None]
        Hm[:] += pillow(np.maximum(P, C), 3.5) * 2.2 + line * 1.2
    rosette(Y_R1, Y_LION0, 0, GATE_X); rosette(Y_LION1, Y_R2, 0, GATE_X)
    rosette(Y_TOWER + 12, Y_TOWER + 48, GATE_X, GATE_X + GATE_W)

    # 狮子
    body = world_layer(lambda d, ss, x0: [lion(d, ss, x - x0, Y_LION0 + 8, LS, 'body') for x in LION_X])
    mane = world_layer(lambda d, ss, x0: [lion(d, ss, x - x0, Y_LION0 + 8, LS, 'mane') for x in LION_X])
    lln = world_layer(lambda d, ss, x0: [lion(d, ss, x - x0, Y_LION0 + 8, LS, 'lines') for x in LION_X])
    lionm = np.maximum(body, mane)
    gold = gold_c * (0.9 + 0.25 * r2[..., None]); ochre = np.array([168, 88, 30], np.float32) / 255 * (0.9 + 0.25 * r1[..., None])
    la = gold * (1 - mane[..., None]) + ochre * mane[..., None]
    la = la * brick[..., None] + mortar * 1.6 * (1 - brick[..., None]); la *= (1 - 0.8 * lln[..., None])
    alb[:] = alb * (1 - lionm[..., None]) + la * lionm[..., None]
    _cx, _cy = xx / 11.0, yy / 10.0; _r = np.floor(_cy); _c = _cx + (_r % 2) * 0.5
    _d = np.hypot(_c - np.floor(_c) - 0.5, (_cy - _r - 0.5))
    curl = (np.clip(1 - _d / 0.5, 0, 1) ** 0.6 * 2.0 - np.clip(1 - np.abs(_d - 0.24) / 0.09, 0, 1)) * mane
    Hm += pillow(lionm, 9) * 6.5 + pillow(mane, 6) * 2.4 + curl * 1.1 - lln * 1.6

    # 砂岩墙裙 + 队列
    dado = (yy >= Y_DADO) & (yy < Y_GROUND) & (xx < GATE_X)
    sw = 262.0; su = (xx + 60) % sw; sj = np.clip((np.minimum(su, sw - su) - 1.2) / 3, 0, 1)
    grain = fbm((H, WW), (50, 12, 3, 1.2), 11)
    strata = cv2.GaussianBlur(np.random.default_rng(3).standard_normal((H, WW)).astype(np.float32), (0, 0), sigmaX=40, sigmaY=1.2)
    strata /= strata.std()
    stone = np.array([226, 198, 150], np.float32) / 255
    salb = stone[None, None] * (1 + 0.07 * grain[..., None] + 0.045 * strata[..., None]) * (0.72 + 0.28 * sj[..., None])
    Hd = sj * 2.0 + grain * 0.7 + strata * 0.25 + (dado & (yy < Y_DADO + 14)) * 4.0 + (dado & (yy >= Y_GROUND - 16)) * 5.0
    Hm[dado] = Hd[dado] + 1.0; alb[dado] = salb[dado]; gloss[dado] = 0
    bb = world_layer(lambda d, ss, x0: [bearer(d, ss, x - x0, Y_DADO + 20, BS, i % 4, 'body', i == front_i) for i, x in enumerate(BEAR_X)])
    bl = world_layer(lambda d, ss, x0: [bearer(d, ss, x - x0, Y_DADO + 20, BS, i % 4, 'lines', i == front_i) for i, x in enumerate(BEAR_X)])
    Hm += dado * (pillow(bb, 5) * 5.0 - bl * 1.5)
    alb *= (1 - 0.30 * (bl * dado)[..., None])
    region = region | dado
    return dict(H=Hm, alb=alb, gloss=gloss, region=region, open=openm, grain=grain, strata=strata, r1=r1, brick=brick * (wallm | towerm))

# ---------- 人物：每个走路帧 → 浮雕高度 + 彩绘底色 ----------
CW, CH, CAX, CBASE = 560, 640, 280, 628

def key(img):
    b, g, r = [img[..., i].astype(np.float32) for i in range(3)]
    a = 1 - np.clip((g - np.maximum(r, b) - 18) / 45, 0, 1); a[:60, :140] = 0
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8))
    k = 1 + np.argmax(st[1:, 4]); a *= cv2.dilate((lab == k).astype(np.uint8), np.ones((5, 5)))
    im = img.astype(np.float32); im[..., 1] = np.minimum(im[..., 1], np.maximum(im[..., 0], im[..., 2]) + 4)
    return im, a

def prep(path, tx=None, find_ear=True):
    im, A = key(cv2.imread(path))
    ys, xs = np.where(A > 0.5); y0, y1 = ys.min(), ys.max(); hh = y1 - y0
    if tx is None:
        tx = np.where(A[y0 + int(.2 * hh):y0 + int(.45 * hh)] > 0.5)[1].mean()
    B_, G_, R_ = im[..., 0], im[..., 1], im[..., 2]
    lum = 0.3 * R_ + 0.59 * G_ + 0.11 * B_
    yrel = np.mgrid[0:A.shape[0], 0:A.shape[1]][0].astype(np.float32)
    skin = ((lum > 92) & (R_ - B_ > 18) & (R_ > G_)).astype(np.float32) * (A > 0.5)
    skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, np.ones((5, 5)))
    skin = cv2.morphologyEx(skin, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    # 耳机：头部皮肤里被包住的深色小块
    headz = (yrel < y0 + 150)
    hole = (ndi.binary_fill_holes(skin > 0.5) & ~(skin > 0.5) & headz).astype(np.uint8)
    ear = np.zeros_like(A)
    n, lab, st, cen = cv2.connectedComponentsWithStats(hole)
    if n > 1 and find_ear:
        k = 1 + np.argmax(st[1:, 4])
        if st[k, 4] > 40: cv2.circle(ear, (int(cen[k][0]), int(cen[k][1])), 13, 1.0, -1)
    ear *= (A > 0.5)
    cloth = (A > 0.5) * (1 - skin)
    hair = cloth * (yrel < y0 + 150); shoe = cloth * (yrel > y1 - 88)
    shirt = cloth * (yrel >= y0 + 150) * (yrel < y0 + 548); pants = cloth * (yrel >= y0 + 548) * (yrel <= y1 - 88)
    l2 = blur(lum, 2.6); hp = l2 - blur(l2, 9); sd = np.sqrt(blur(hp * hp, 14)) + 4
    det = np.clip(hp / sd, -2, 2) * A
    out = {}
    M = np.float32([[SC, 0, CAX - tx * SC], [0, SC, CBASE - y1 * SC]])
    for k, v in dict(A=A, skin=skin, hair=hair, shoe=shoe, shirt=shirt, pants=pants, ear=ear, det=det).items():
        out[k] = cv2.warpAffine(v.astype(np.float32), M, (CW, CH), flags=cv2.INTER_AREA)
    P = out; fa = np.clip(P['A'], 0, 1); fm = (fa > 0.5).astype(np.float32)
    cy, cx = np.mgrid[0:CH, 0:CW].astype(np.float32)
    c1, c2 = cx / 9.0, cy / 8.0; rowc = np.floor(c2); cxs = c1 + (rowc % 2) * 0.5
    cd = np.hypot(cxs - np.floor(cxs) - 0.5, (c2 - rowc - 0.5) * 1.05)
    curls = np.clip(1 - cd / 0.5, 0, 1) ** 0.6; ring = np.clip(1 - np.abs(cd - 0.22) / 0.09, 0, 1)
    dist = cv2.distanceTransform(fm.astype(np.uint8), cv2.DIST_L2, 5)
    Hf = pillow(fm, 16) * 21 + np.clip(dist / 46, 0, 1) * 6
    Hf += pillow(P['skin'], 7) * 2.6 + pillow(P['hair'], 5) * 2.2 + P['hair'] * (curls * 1.15 - ring * 0.6)
    Hf += pillow(P['shoe'], 5) * 1.6 + P['det'] * 1.5 * (1 - P['hair'])
    lab = ((P['skin'] > .5) * 1 + (P['hair'] > .5) * 2 + (P['shirt'] > .5) * 3 + (P['pants'] > .5) * 4 + (P['shoe'] > .5) * 5).astype(np.uint8)
    k3 = np.ones((3, 3), np.uint8)
    edge = (cv2.dilate(lab, k3) != cv2.erode(lab, k3)) & (cv2.erode(fm, np.ones((5, 5), np.uint8)) > 0)
    Hf -= blur(edge.astype(np.float32), 1.1) * 3.2
    Hf = blur(Hf, 0.8) * fm
    fstone = np.array([222, 188, 136], np.float32) / 255
    pig = {'skin': ([206, 138, 92], 0.80), 'hair': ([24, 21, 30], 0.95), 'shirt': ([244, 232, 204], 0.88),
           'pants': ([92, 56, 44], 0.90), 'shoe': ([52, 38, 36], 0.92)}
    edge_wear = np.clip(1 - dist / 5.0, 0, 1)
    falb = np.broadcast_to(fstone, (CH, CW, 3)).copy()
    for k, (c, op) in pig.items():
        keep = np.clip(op - 0.45 * edge_wear - 0.10 * np.clip(P['det'], 0, 2), 0, 1)
        falb = falb * (1 - (P[k] * keep)[..., None]) + (np.array(c, np.float32) / 255) * (P[k] * keep)[..., None]
    red = np.array([196, 46, 34], np.float32) / 255
    falb = falb * (1 - P['ear'][..., None]) + red * P['ear'][..., None]
    return dict(fa=fa, Hf=Hf, falb=falb)

# ---------- HUD：泥板 ----------
def font(n, s): return ImageFont.truetype(os.path.join(FONT, n), s)
F_CN = lambda s: font('chinese-simplified-900-normal.ttf', s)
F_IT = lambda s: ImageFont.truetype('/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf', s)
F_NUM = lambda s: font('latin-700-normal.ttf', s)
PAD = 30

def tablet(w, h, draw_fn, seed):
    ss = 2
    def L():
        im = Image.new('L', ((w + PAD * 2) * ss, (h + PAD * 2) * ss), 0); return im, ImageDraw.Draw(im)
    def dn(im): return np.asarray(im.resize((w + PAD * 2, h + PAD * 2), Image.LANCZOS), np.float32) / 255
    bi, bd = L(); bd.rounded_rectangle([PAD * ss, PAD * ss, (PAD + w) * ss, (PAD + h) * ss], radius=14 * ss, fill=255)
    bm = dn(bi); layers = draw_fn(L, dn, PAD, ss)
    n = fbm(bm.shape, (30, 8, 2), seed)
    Ht = pillow(bm, 9) * 9 + n * 0.8
    clay = np.array([232, 204, 158], np.float32) / 255
    al = np.broadcast_to(clay, bm.shape + (3,)).copy() * (1 + 0.06 * n[..., None])
    if 'raised' in layers: Ht += pillow(layers['raised'], 4) * 3.5
    if 'tape' in layers:
        tp = layers['tape']; Ht += pillow(tp, 3) * 1.5
        al = al * (1 - tp[..., None]) + np.array([30, 66, 152], np.float32) / 255 * tp[..., None]
    if 'hole' in layers:
        ho = layers['hole']; Ht -= ho * 3.0; al = al * (1 - 0.7 * ho[..., None])
    if 'ink' in layers:
        ink = layers['ink']; Ht -= blur(ink, 0.8) * 2.2
        al = al * (1 - ink[..., None]) + np.array([62, 40, 28], np.float32) / 255 * ink[..., None]
    if 'blue' in layers:
        b2 = layers['blue']; Ht -= blur(b2, 0.8) * 2.0
        al = al * (1 - b2[..., None]) + np.array([26, 70, 164], np.float32) / 255 * b2[..., None]
    c = shade(Ht, al, None, 30) * 1.06
    shd = blur(shift(bm, -9, 10), 9)
    return c, bm, shd

def title_fn(L, dn, pad, ss):
    i1, d1 = L(); i2, d2 = L()
    d1.text(((pad + 50) * ss, (pad + 14) * ss), '范特西', font=F_CN(66 * ss), fill=255)
    d1.text(((pad + 52) * ss, (pad + 112) * ss), 'Fantasy', font=F_IT(46 * ss), fill=255)
    d2.text(((pad + 232) * ss, (pad + 110) * ss), '2001', font=F_NUM(42 * ss), fill=255)
    d2.rectangle([(pad + 24) * ss, (pad + 28) * ss, (pad + 31) * ss, (pad + 150) * ss], fill=255)
    for k in range(7):
        xk = (pad + 250 + k * 12) * ss; yk = (pad + 28) * ss
        d1.polygon([(xk, yk), (xk + 8 * ss, yk + 3 * ss), (xk, yk + 6 * ss)], fill=255)
    return {'ink': dn(i1), 'blue': dn(i2)}

def song_fn(L, dn, pad, ss):
    i1, d1 = L(); i2, d2 = L()
    d1.text(((pad + 66) * ss, (pad + 9) * ss), '爱在西元前', font=F_CN(54 * ss), fill=255)
    d2.ellipse([(pad + 22) * ss, (pad + 50) * ss, (pad + 40) * ss, (pad + 66) * ss], fill=255)
    d2.rectangle([(pad + 36) * ss, (pad + 20) * ss, (pad + 41) * ss, (pad + 58) * ss], fill=255)
    d2.polygon([((pad + 41) * ss, (pad + 20) * ss), ((pad + 54) * ss, (pad + 30) * ss), ((pad + 41) * ss, (pad + 34) * ss)], fill=255)
    return {'ink': dn(i1), 'blue': dn(i2)}

def tape_fn_at(angle):
    def fn(L, dn, pad, ss):
        i1, d1 = L(); i2, d2 = L(); i3, d3 = L(); i4, d4 = L(); w, h = 210, 136
        d4.rounded_rectangle([(pad + 14) * ss, (pad + 14) * ss, (pad + w - 14) * ss, (pad + 88) * ss], radius=8 * ss, fill=255)
        d2.rectangle([(pad + 22) * ss, (pad + 22) * ss, (pad + w - 22) * ss, (pad + 34) * ss], fill=255)
        d3.rounded_rectangle([(pad + 50) * ss, (pad + 44) * ss, (pad + w - 50) * ss, (pad + 78) * ss], radius=16 * ss, fill=255)
        for cx in (72, w - 72):
            d2.ellipse([(pad + cx - 13) * ss, (pad + 48) * ss, (pad + cx + 13) * ss, (pad + 74) * ss], fill=255)
            for k in range(6):
                a = k * np.pi / 3 + angle
                d1.line([((pad + cx + np.cos(a) * 3) * ss, (pad + 61 + np.sin(a) * 3) * ss), ((pad + cx + np.cos(a) * 11) * ss, (pad + 61 + np.sin(a) * 11) * ss)], fill=255, width=3 * ss)
        d1.polygon([((pad + 50) * ss, (pad + h - 10) * ss), ((pad + 64) * ss, (pad + 102) * ss), ((pad + w - 64) * ss, (pad + 102) * ss), ((pad + w - 50) * ss, (pad + h - 10) * ss)], outline=255, width=3 * ss)
        for cx in (84, w - 84):
            d1.ellipse([(pad + cx - 4) * ss, (pad + 116) * ss, (pad + cx + 4) * ss, (pad + 124) * ss], fill=255)
        return {'ink': dn(i1), 'tape': dn(i2), 'hole': dn(i3), 'raised': dn(i4)}
    return fn

def put(out, spr, x, y, a=1.0):
    c, bm, shd = spr; h, w = bm.shape; X0, Y0 = int(round(x)) - PAD, int(round(y)) - PAD
    xa, ya = max(0, X0), max(0, Y0); xb, yb = min(W, X0 + w), min(H, Y0 + h)
    if xa >= xb or ya >= yb: return
    sl = (slice(ya, yb), slice(xa, xb)); ss = (slice(ya - Y0, yb - Y0), slice(xa - X0, xb - X0))
    out[sl] *= (1 - 0.42 * a * shd[ss][..., None])
    m = (bm[ss] * a)[..., None]
    out[sl] = out[sl] * (1 - m) + c[ss] * m

# ---------- 全局烘焙 ----------
G = {}

def bake():
    print('build world'); wd = build_world(None)
    sl = slice(SY0, SY1)
    print('shade strip'); rgb = shade(wd['H'][sl], wd['alb'][sl], wd['gloss'][sl])
    G.update(Hs=wd['H'][sl].copy(), albs=wd['alb'][sl].copy(), gls=wd['gloss'][sl].copy(), rgb=rgb,
             reg=wd['region'][sl].astype(np.float32), grain=wd['grain'][sl].copy(), strata=wd['strata'][sl].copy(),
             twk=(wd['gloss'][sl] * wd['r1'][sl]).copy(), r1=wd['r1'][sl].copy())
    # 门洞里露出下一站：宣纸底 + 淡墨远山
    yy, xx = np.mgrid[SY0:SY1, 0:WW].astype(np.float32)
    acx = (ARCH_X0 + ARCH_X1) / 2
    paper = np.broadcast_to(np.array([246, 240, 226], np.float32) / 255, rgb.shape).copy()
    m1 = np.clip((yy - (560 - 120 * np.exp(-((xx - acx + 60) / 90) ** 2) - 70 * np.exp(-((xx - acx - 80) / 70) ** 2))) / 60, 0, 1)
    paper *= (1 - 0.22 * m1[..., None] * np.clip((720 - yy) / 160, 0, 1)[..., None])
    inner = np.clip((np.minimum(np.abs(xx - acx), 999) - (ARCH_R - 30)) / 30, 0, 1)
    paper *= (1 - 0.18 * inner[..., None])
    op = wd['open'][sl]
    G['rgb'][op] = paper[op] * 1.02; G['reg'][op] = 1.0
    # 转正脸的那个队列人：只重新烘焙他周围一小块
    print('alt bearer'); wa = build_world(FRONT_I)
    x0 = int(BEAR_X[FRONT_I]) - 120; x1 = x0 + 360
    pa = shade(wa['H'][sl, x0:x1], wa['alb'][sl, x0:x1], wa['gloss'][sl, x0:x1])
    G.update(alt_rgb=pa, alt_H=wa['H'][sl, x0:x1].copy(), alt_alb=wa['alb'][sl, x0:x1].copy(), alt_x0=x0, alt_x1=x1)
    del wd, wa
    # 天空
    sy, sx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip(sy / 300, 0, 1)[..., None]
    sky = (1 - t) * np.array([222, 132, 88], np.float32) / 255 + t * np.array([252, 216, 160], np.float32) / 255
    ds = np.hypot(sx - 1490, sy - 118)
    sky += np.exp(-(ds / 300) ** 2)[..., None] * np.array([0.20, 0.20, 0.14], np.float32) + np.exp(-(ds / 110) ** 2)[..., None] * np.array([0.16, 0.18, 0.16], np.float32)
    disc = np.clip((62 - ds) / 2, 0, 1)[..., None]
    sky = sky * (1 - disc) + np.array([1.25, 1.2, 1.0], np.float32) * disc
    cl = cv2.GaussianBlur(np.random.default_rng(8).standard_normal((H, W)).astype(np.float32), (0, 0), sigmaX=90, sigmaY=3)
    cl = np.clip(cl / cl.std() - 1.5, 0, 1) * np.clip(1 - np.abs(sy - 120) / 110, 0, 1)
    G['sky'] = (sky + cl[..., None] * 0.16)[:300].copy(); G['ds'] = ds
    pan = cam_at(BEATS) - CAM0
    ZP, PP = 0.05, 0.13
    wz = int(W + pan * ZP + 20); im = Image.new('L', (wz * 2, 600), 0); d = ImageDraw.Draw(im)
    zx = 1080
    for hw, y0, y1 in [(150, 176, 216), (112, 138, 176), (78, 104, 138), (46, 76, 104)]:
        d.rectangle([(zx - hw) * 2, y0 * 2, (zx + hw) * 2, y1 * 2], fill=255)
    G['zig'] = np.asarray(im.resize((wz, 300), Image.LANCZOS), np.float32) / 255
    wp = int(W + pan * PP + 20); im = Image.new('L', (wp * 2, 600), 0); d = ImageDraw.Draw(im)
    px = 60.0; i = 0
    while px < wp:
        sz = 0.7 + 0.3 * ((i * 37) % 10) / 9; ph = 100 + 50 * ((i * 53) % 10) / 9; topy = Y_CREN - ph
        d.line([(px * 2, Y_WALL * 2), ((px + 5 * sz) * 2, (topy + Y_WALL)), ((px + 12 * sz) * 2, topy * 2)], fill=255, width=int(8 * sz * 2), joint='curve')
        for q, a in enumerate(np.linspace(-3.25, 0.1, 13)):
            ln = (58 + 22 * ((q * 7) % 5) / 4) * sz
            pts = [((px + 12 * sz + np.cos(a) * r * ln) * 2, (topy + np.sin(a) * r * ln * 0.75 + r * r * 46 * sz) * 2) for r in np.linspace(0, 1, 14)]
            for k in range(13): d.line([pts[k], pts[k + 1]], fill=255, width=max(2, int((7.5 - 5.5 * k / 13) * sz * 2)))
        d.ellipse([(px + 4 * sz) * 2, (topy - 6 * sz) * 2, (px + 20 * sz) * 2, (topy + 10 * sz) * 2], fill=255)
        px += 170 + 110 * ((i * 71) % 10) / 9; i += 1
    G['palm'] = np.asarray(im.resize((wp, 300), Image.LANCZOS), np.float32) / 255
    G['ZP'], G['PP'] = ZP, PP
    G['gnoise'] = fbm((256, 2048), (30, 8, 2), 31)
    # 前景陶罐（虚焦）
    jw, jh = 300, 330; jy, jx = np.mgrid[0:jh, 0:jw].astype(np.float32)
    v = jy / jh
    prof = np.where(v < 0.12, 0.30 + 0.05 * np.cos(v / 0.12 * np.pi), 0.26 + 0.24 * np.sin(np.clip((v - 0.12) / 0.88, 0, 1) * np.pi * 0.62) ** 0.8) * jw
    dxn = (jx - jw / 2) / np.maximum(prof, 1)
    jm = np.clip((1 - np.abs(dxn)) * prof / 3, 0, 1)
    nz = np.sqrt(np.clip(1 - dxn ** 2, 0, 1)); lam = np.clip(dxn * 0.62 + nz * 0.55 + 0.25, 0, 1.3)
    terra = np.array([186, 104, 58], np.float32) / 255
    jc = terra[None, None] * (0.38 + 0.85 * lam[..., None]) * (1 - 0.25 * ((np.abs(v - 0.3) < 0.012) | (np.abs(v - 0.34) < 0.006))[..., None])
    G['jar'] = (blur(jc, 2.5), blur(jm, 2.5))
    # 人物帧
    print('figure frames')
    fs = [os.path.join(WALK_DIR, 'f%03d.png' % (LOOP0 + 1 + k)) for k in range(LOOPN)]
    rec = []
    for f in fs:
        _, A = key(cv2.imread(f)); ys, xs = np.where(A > 0.5); y0, y1 = ys.min(), ys.max(); hh = y1 - y0
        rec.append(np.where(A[y0 + int(.2 * hh):y0 + int(.45 * hh)] > 0.5)[1].mean())
    rec = np.array(rec); pad = np.concatenate([rec[-3:], rec, rec[:3]])
    txs = np.convolve(pad, np.ones(7) / 7, mode='valid')
    G['walk'] = [prep(f, tx) for f, tx in zip(fs, txs)]
    G['stand'] = prep(STAND, None, False)
    G['title'] = tablet(360, 178, title_fn, 41); G['song'] = tablet(356, 86, song_fn, 43)
    print('bake done')

def crop_world(arr, camx, x0, x1, y0, y1):
    """从世界条带取屏幕矩形 [x0,x1)×[y0,y1)，亚像素平移"""
    wx = camx + x0; ix = int(np.floor(wx)); fr = wx - ix
    src = arr[y0 - SY0:y1 - SY0, ix:ix + (x1 - x0) + 1]
    if fr < 1e-4: return src[:, :-1].copy()
    return src[:, :-1] * (1 - fr) + src[:, 1:] * fr

PX0, PX1, PY0, PY1 = FIG_CX - 380, FIG_CX + 380, 150, 848
yyS, xxS = np.mgrid[0:H, 0:W].astype(np.float32)

def render(i):
    b = i / FPS / BEAT
    camx = cam_at(b)
    out = np.zeros((H, W, 3), np.float32)
    # 天空 + 视差远景
    sky = G['sky'].copy()
    for name, par, col, op in (('zig', G['ZP'], [206, 136, 96], 0.6), ('palm', G['PP'], [150, 98, 60], 0.72)):
        m = G[name]; off = (camx - CAM0) * par; ix = int(off); fr = off - ix
        mm = (m[:, ix:ix + W] * (1 - fr) + m[:, ix + 1:ix + W + 1] * fr)[..., None] * op
        sky = sky * (1 - mm) + np.array(col, np.float32) / 255 * mm
    out[:300] = sky
    # 墙
    in_gag = GAG0 <= b < GAG1
    look = (GAG0 + 2.0) <= b < GAG1                    # 第 11 拍：队列人转正脸
    rgb = crop_world(G['rgb'], camx, 0, W, SY0, SY1); reg = crop_world(G['reg'], camx, 0, W, SY0, SY1)
    if look:
        ax0 = G['alt_x0'] - camx; ia = int(np.floor(ax0));
        strip = G['rgb'].copy() if False else None
    # 釉面闪光：随镜头移动在砖面上游走
    tw = crop_world(G['twk'], camx, 0, W, SY0, SY1); r1c = crop_world(G['r1'], camx, 0, W, SY0, SY1)
    ph = (r1c * 3.0 + xxS[SY0:SY1] / 900.0 - b * 0.22) % 1.0
    rgb = rgb + (np.clip(1 - np.abs(ph - 0.5) * 9, 0, 1) * tw * 0.5)[..., None] * SUN
    out[SY0:SY1] = out[SY0:SY1] * (1 - reg[..., None]) + rgb * reg[..., None]
    # 人物局部重新上光
    if in_gag:
        F = G['stand']; kz = 1.0 + 0.45 * back((b - GAG0) / 0.4)
    else:
        ph2 = (walkbeats(b) % 2.0) / 2.0
        F = G['walk'][int(ph2 * LOOPN) % LOOPN]
        kz = 1.0 - 0.6 * np.exp(-(b - GAG1) * 4.5) if b >= GAG1 else 1.0   # 第 13 拍：被压回侧身
    Hw = crop_world(G['Hs'], camx, PX0, PX1, PY0, PY1); aw = crop_world(G['albs'], camx, PX0, PX1, PY0, PY1)
    gw = crop_world(G['gls'], camx, PX0, PX1, PY0, PY1); rw = crop_world(G['reg'], camx, PX0, PX1, PY0, PY1)
    if look:
        # 把转正脸的小人贴进局部（他就在人物右边）
        lx0 = int(round(G['alt_x0'] - camx)); lx1 = lx0 + (G['alt_x1'] - G['alt_x0'])
        a0, a1 = max(lx0, PX0), min(lx1, PX1)
        if a1 > a0:
            Hw[:, a0 - PX0:a1 - PX0] = G['alt_H'][PY0 - SY0:PY1 - SY0, a0 - lx0:a1 - lx0]
            aw[:, a0 - PX0:a1 - PX0] = G['alt_alb'][PY0 - SY0:PY1 - SY0, a0 - lx0:a1 - lx0]
        b0, b1 = max(lx0, 0), min(lx1, W)
        out[Y_DADO:Y_GROUND, b0:b1] = G['alt_rgb'][Y_DADO - SY0:Y_GROUND - SY0, b0 - lx0:b1 - lx0]
    ph_, pw_ = PY1 - PY0, PX1 - PX0
    fy0 = (Y_GROUND - 15 + 4) - CBASE - PY0; fx0 = FIG_CX - CAX - PX0
    fa = np.zeros((ph_, pw_), np.float32); Hf = np.zeros_like(fa); falb = np.zeros((ph_, pw_, 3), np.float32)
    fa[fy0:fy0 + CH, fx0:fx0 + CW] = F['fa']; Hf[fy0:fy0 + CH, fx0:fx0 + CW] = F['Hf']; falb[fy0:fy0 + CH, fx0:fx0 + CW] = F['falb']
    gr = crop_world(G['grain'], camx * 0 + CAM0, PX0, PX1, PY0, PY1); st = crop_world(G['strata'], CAM0, PX0, PX1, PY0, PY1)
    falb = falb * (1 + 0.07 * gr[..., None] + 0.04 * st[..., None])
    Hp = Hw * (1 - fa) + (blur(Hw, 6) * 0.4 + 3.0 + Hf * kz + gr * 0.6) * fa
    ap = aw * (1 - fa[..., None]) + falb * fa[..., None]
    rp = shade(Hp, ap, gw * (1 - fa))
    fm = (fa > 0.3).astype(np.uint8)
    wgt = blur(cv2.dilate(fm, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (181, 181))).astype(np.float32), 14)
    cov = np.maximum(rw, fa) * wgt
    sl = (slice(PY0, PY1), slice(PX0, PX1))
    out[sl] = out[sl] * (1 - cov[..., None]) + rp * cov[..., None]
    # 地面：越靠近镜头的石板移动越快
    gy = yyS[Y_GROUND:] - Y_GROUND; gxs = xxS[Y_GROUND:]
    rows = [0, 38, 86, 148, 250]; pav = np.array([228, 204, 162], np.float32) / 255
    gl = (AMB * 0.95 + SUN * 0.60)
    gimg = np.zeros((H - Y_GROUND, W, 3), np.float32)
    for r in range(4):
        hh = rows[r + 1] - rows[r]; pw = hh * 3.1; par = 1.0 + 0.16 * r
        xo2 = gxs[rows[r]:rows[r + 1]] + camx * par + (r * 0.37 + 0.2) * pw
        c2 = np.floor(xo2 / pw); uu = xo2 - c2 * pw; vv = gy[rows[r]:rows[r + 1]] - rows[r]
        e = np.minimum(np.minimum(uu, pw - uu), np.minimum(vv, hh - vv))
        jn = np.clip(e / (1.6 + r * 0.5), 0, 1); tone = 0.93 + 0.14 * hash2(c2, r, 7)
        nx = (xo2.astype(np.int64)) % 2048; ny = (vv.astype(np.int64) + r * 60) % 256
        nz = G['gnoise'][ny, nx]
        gimg[rows[r]:rows[r + 1]] = pav * (tone * (1 + 0.07 * nz) * (0.66 + 0.34 * jn))[..., None] * gl
    gimg *= (1 - 0.30 * np.exp(-gy / 16))[..., None]
    out[Y_GROUND:] = gimg
    # 前景陶罐
    jc, jm = G['jar']
    for wxj in (1500.0, 4700.0, 6300.0):
        sxj = int(round(wxj - camx * 1.7)); sy0 = H - 250
        xa, xb = max(0, sxj), min(W, sxj + jc.shape[1])
        if xb > xa:
            hh = H - sy0; m = jm[:hh, xa - sxj:xb - sxj][..., None]
            out[sy0:, xa:xb] = out[sy0:, xa:xb] * (1 - m) + jc[:hh, xa - sxj:xb - sxj] * gl * m
    # 大气
    wallrows = np.exp(-((yyS - Y_WALL) / 240) ** 2) * (yyS >= Y_CREN) * (yyS < Y_GROUND)
    out += wallrows[..., None] * np.array([0.045, 0.026, 0.006], np.float32)
    out += np.exp(-(G['ds'] / 620) ** 2)[..., None] * np.array([0.06, 0.04, 0.015], np.float32)
    # 镜头：定格时轻推
    z = 1.0 + 0.04 * (ease((b - GAG0) / 0.5) - ease((b - GAG1) / 0.5))
    if z > 1.0005:
        cxz, cyz = FIG_CX + 60, 560
        M = np.float32([[z, 0, cxz * (1 - z)], [0, z, cyz * (1 - z)]])
        out = cv2.warpAffine(out, M, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    # HUD
    a1 = ease((b - 0.5) / 1.0); put(out, G['title'], 48 - 60 * (1 - back((b - 0.5) / 1.0)), 40, a1)
    a2 = ease((b - 1.5) / 1.0)
    put(out, G['song'], 1298, 918 + 40 * (1 - back((b - 1.5) / 1.0)), a2)
    put(out, tablet(210, 136, tape_fn_at(b * np.pi / 2), 45), 1672, 892 + 40 * (1 - back((b - 1.8) / 1.0)), ease((b - 1.8) / 1.0))
    # 收尾
    out = np.clip(out, 0, None); out = out / (1 + 0.10 * out) * 1.10
    out *= (1 - 0.16 * (((xxS - W / 2) / (W / 2)) ** 2 + ((yyS - H / 2) / (H / 2)) ** 2) ** 1.2)[..., None]
    out += np.random.default_rng(1000 + i).standard_normal((H, W, 1)).astype(np.float32) * 0.012
    img = (np.clip(out, 0, 1) * 255).astype(np.uint8)
    cv2.imwrite(os.path.join(OUTDIR, 'f%04d.png' % i), img[..., ::-1], [cv2.IMWRITE_PNG_COMPRESSION, 1])
    return i, float(img.mean()) / 255

if __name__ == '__main__':
    os.makedirs(OUTDIR, exist_ok=True)
    a, bnd = (int(sys.argv[5]), int(sys.argv[6])) if len(sys.argv) > 6 else (0, NF)
    step = int(sys.argv[7]) if len(sys.argv) > 7 else 1
    print('frames', NF, 'step px/beat %.1f' % STEP, 'gate x', GATE_X)
    bake()
    cv2.setNumThreads(1)
    with Pool(4) as p:
        for i, m in p.imap_unordered(render, range(a, bnd, step)):
            if i % 20 == 0: print(i, 'mean %.3f' % m, flush=True)
