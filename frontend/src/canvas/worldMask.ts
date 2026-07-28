// 平面世界地图专用陆地采样：复用 landMask 的 48×24 等距圆柱掩码，
// 按经纬度(度)查表判定海陆。用于点阵地图的陆地/海洋着色。
import { LAND_ROWS, MASK_W, MASK_H } from './landMask'

/** 经纬度(度) → 是否陆地。lon∈[-180,180)，lat∈[-90,90]。 */
export function isLandDeg(lonDeg: number, latDeg: number): boolean {
  let col = Math.floor(((lonDeg + 180) / 360) * MASK_W)
  col = ((col % MASK_W) + MASK_W) % MASK_W // 经度环绕
  const row = Math.min(
    MASK_H - 1,
    Math.max(0, Math.floor(((90 - latDeg) / 180) * MASK_H))
  )
  return LAND_ROWS[row].charCodeAt(col) === 35 // '#'
}

// 单格采样：经度环绕、纬度夹紧，'#'=1 陆地 / '.'=0 海洋
function cell(col: number, row: number): number {
  const c = ((col % MASK_W) + MASK_W) % MASK_W
  const r = Math.min(MASK_H - 1, Math.max(0, row))
  return LAND_ROWS[r].charCodeAt(c) === 35 ? 1 : 0
}

/** 经纬度(度) → 连续「陆地度」0~1（对 48×24 掩码做双线性插值）。
 *  用于点阵地图在海岸处得到平滑过渡，配合抖动阈值软化 7.5° 台阶锯齿。 */
export function landnessDeg(lonDeg: number, latDeg: number): number {
  // 连续网格坐标（格心落在整数处，故减 0.5）
  const fx = ((lonDeg + 180) / 360) * MASK_W - 0.5
  const fy = ((90 - latDeg) / 180) * MASK_H - 0.5
  const x0 = Math.floor(fx)
  const y0 = Math.floor(fy)
  const tx = fx - x0
  const ty = fy - y0
  const top = cell(x0, y0) * (1 - tx) + cell(x0 + 1, y0) * tx
  const bot = cell(x0, y0 + 1) * (1 - tx) + cell(x0 + 1, y0 + 1) * tx
  return top * (1 - ty) + bot * ty
}
