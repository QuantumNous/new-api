/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

export type GridCellPos = { row: number; col: number }

export function perimeter(rows: number, cols: number): number {
  if (rows <= 0 || cols <= 0) return 0
  if (rows === 1) return cols
  if (cols === 1) return rows
  return 2 * (rows + cols) - 4
}

/** Smallest ring with perimeter >= `count` (prefer wider boards). */
export function fitGridSize(count: number): { rows: number; cols: number } {
  const n = Math.max(1, count)
  let cols = 3
  let rows = 3
  while (perimeter(rows, cols) < n) {
    if (rows < cols) rows += 1
    else cols += 1
  }
  return { rows, cols }
}

/** Clockwise border path starting at top-left. */
export function borderPath(rows: number, cols: number): GridCellPos[] {
  if (rows <= 0 || cols <= 0) return []
  if (rows === 1) {
    return Array.from({ length: cols }, (_, col) => ({ row: 0, col }))
  }
  if (cols === 1) {
    return Array.from({ length: rows }, (_, row) => ({ row, col: 0 }))
  }

  const path: GridCellPos[] = []
  for (let col = 0; col < cols; col++) path.push({ row: 0, col })
  for (let row = 1; row < rows; row++) path.push({ row, col: cols - 1 })
  for (let col = cols - 2; col >= 0; col--) path.push({ row: rows - 1, col })
  for (let row = rows - 2; row >= 1; row--) path.push({ row, col: 0 })
  return path
}

export type PrizeGridSlot = {
  /** Board cell index along the marquee path. */
  cellIndex: number
  /** Index into the original prize list. */
  prizeIndex: number
  row: number
  col: number
}

/** Prefer at least a 5×4 ring (14 cells) so the board feels fuller. */
const MIN_BOARD_CELLS = 14

/**
 * Expand prize indices by relative weight, then pad/trim to an exact
 * rectangular perimeter so the ring has no empty cells.
 */
export function expandPrizeIndicesByWeight(
  weights: number[],
  minCells = MIN_BOARD_CELLS
): number[] {
  const n = weights.length
  if (n === 0) return []

  const safe = weights.map((w) => Math.max(1, Math.round(Number(w) || 1)))
  const weightSum = safe.reduce((a, b) => a + b, 0)

  const { rows, cols } = fitGridSize(Math.max(minCells, n))
  const target = perimeter(rows, cols)

  // Largest-remainder method: counts ∝ weights, every prize ≥ 1
  const exact = safe.map((w) => (w / weightSum) * target)
  const counts = exact.map((v) => Math.max(1, Math.floor(v)))
  let sum = counts.reduce((a, b) => a + b, 0)

  while (sum > target) {
    let best = -1
    let bestCount = 1
    for (let i = 0; i < n; i++) {
      if (counts[i] > bestCount) {
        bestCount = counts[i]
        best = i
      }
    }
    if (best < 0) break
    counts[best] -= 1
    sum -= 1
  }

  if (sum < target) {
    const order = exact
      .map((v, i) => ({ i, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac)
    let k = 0
    while (sum < target) {
      counts[order[k % n].i] += 1
      sum += 1
      k += 1
    }
  }

  return interleaveByCounts(counts)
}

function interleaveByCounts(counts: number[]): number[] {
  const remaining = [...counts]
  const total = remaining.reduce((a, b) => a + b, 0)
  const out: number[] = []
  while (out.length < total) {
    let best = -1
    let bestScore = -Infinity
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i] <= 0) continue
      const score = remaining[i] + (out[out.length - 1] === i ? -0.5 : 0)
      if (score > bestScore) {
        bestScore = score
        best = i
      }
    }
    if (best < 0) break
    out.push(best)
    remaining[best] -= 1
  }
  return out
}

/** Build a fully filled prize ring from prize weights. */
export function buildWeightedPrizeSlots(weights: number[]): {
  rows: number
  cols: number
  slots: PrizeGridSlot[]
} {
  const prizeIndices = expandPrizeIndicesByWeight(weights)
  const count = Math.max(1, prizeIndices.length)
  const { rows, cols } = fitGridSize(count)
  const path = borderPath(rows, cols)
  const peri = path.length
  let indices = prizeIndices
  if (indices.length !== peri) {
    indices = expandPrizeIndicesByWeight(weights, peri)
    while (indices.length < peri) {
      indices.push(indices.length % Math.max(1, weights.length))
    }
    if (indices.length > peri) indices = indices.slice(0, peri)
  }

  const slots: PrizeGridSlot[] = path.map((pos, cellIndex) => ({
    cellIndex,
    prizeIndex: indices[cellIndex] ?? 0,
    row: pos.row,
    col: pos.col,
  }))

  return { rows, cols, slots }
}

/** Pick a board cell that shows the given prize (for landing animation). */
export function pickCellForPrize(
  slots: PrizeGridSlot[],
  prizeIndex: number
): number {
  const matches = slots
    .filter((s) => s.prizeIndex === prizeIndex)
    .map((s) => s.cellIndex)
  if (matches.length === 0) {
    return Math.max(0, Math.min(prizeIndex, slots.length - 1))
  }
  return matches[Math.floor(Math.random() * matches.length)]
}
