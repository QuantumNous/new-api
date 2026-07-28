// 二次贝塞尔弧线控制点工具。
// 关键：控制点必须落在「起点-终点连线」的【垂直方向】上，曲线才会真正隆起成拱门。
// 若控制点与起终点共线（旧实现的 bug），二次贝塞尔会退化成一条直线。
export interface Pt {
  x: number
  y: number
}

/** 垂直于弦、强制朝上(-y)隆起的拱门控制点。用于「用户 → 网关」专属通道。 */
export function arcUp(from: Pt, to: Pt, k = 0.28): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len // 弦的法向单位向量
  let ny = dx / len
  if (ny > 0) {
    nx = -nx
    ny = -ny
  } // 翻到朝上一侧，拱顶恒向上
  const bow = k * len // 拱高随跨度成比例
  return {
    x: (from.x + to.x) / 2 + nx * bow,
    y: (from.y + to.y) / 2 + ny * bow,
  }
}

/** 垂直于弦、朝【远离 center】一侧隆起的控制点。用于「枢纽 ↔ 模型」放射状航线。
 *  与 from/to 顺序无关（去程/回程/常驻弧共用同一条弧），便于三者重合。 */
export function arcAway(from: Pt, to: Pt, center: Pt, k = 0.2): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.hypot(dx, dy) || 1
  let nx = -dy / len
  let ny = dx / len
  const mx = (from.x + to.x) / 2
  const my = (from.y + to.y) / 2
  if (nx * (mx - center.x) + ny * (my - center.y) < 0) {
    nx = -nx
    ny = -ny
  } // 使法向指向远离 center 的一侧
  const bow = k * len
  return { x: mx + nx * bow, y: my + ny * bow }
}
