// 画布与场景单位空间。每站在 1000×1000 单位空间内作画：
//   y ∈ [0,1000] 对应画布全高 1080px；x ∈ [0,1000] 对应画布中间 1080×1080 的正方形，
//   左右两侧各有约 389 单位的出血（x ∈ [-389, 1389]），场景需要把出血也画满。
export const W = 1920;
export const H = 1080;
export const K = H / 1000;            // 1 单位 = 1.08px
export const OX = (W - 1000 * K) / 2; // 单位 x=0 在画布上的像素位置（420）
export const X_MIN = -OX / K;         // ≈ -388.9
export const X_MAX = 1000 + OX / K;   // ≈ 1388.9

// 路面与人物（单位）
export const ROAD_Y = 800;            // 路面高度：全片所有站的路都在这里，画框转场时路面对齐
export const CHAR_X = 322;            // 人物站位（≈ 画面宽度 40%）
export const WALK_SPEED = 105;        // 每拍行进单位数（决定步幅与镜头平移速度）

export const toPx = (ux, uy) => [OX + ux * K, uy * K];
export const toUnits = (px, py) => [(px - OX) / K, py / K];

/** 把 ctx 设为单位空间（在当前变换之上叠加）。 */
export function applyUnits(ctx) {
  ctx.translate(OX, 0);
  ctx.scale(K, K);
}
