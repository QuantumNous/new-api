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
/*
Adapted from open-ai-canvas (https://github.com/ddcat-ai/open-ai-canvas),
based on basketikun/infinite-canvas. AGPL-3.0; see THIRD-PARTY-LICENSES.md.
*/
import { CANVAS_MAX_SCALE, CANVAS_MIN_SCALE } from '../constants'
import type { CanvasNodeData, ViewportTransform } from '../types'

export type CanvasBounds = {
  left: number
  top: number
  right: number
  bottom: number
}

export type CanvasViewportSize = {
  width: number
  height: number
}

export function clampCanvasScale(scale: number) {
  return Math.min(Math.max(scale, CANVAS_MIN_SCALE), CANVAS_MAX_SCALE)
}

export function getCanvasNodesBounds(
  nodes: CanvasNodeData[]
): CanvasBounds | null {
  if (!nodes.length) return null
  let left = Number.POSITIVE_INFINITY
  let top = Number.POSITIVE_INFINITY
  let right = Number.NEGATIVE_INFINITY
  let bottom = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    left = Math.min(left, node.position.x)
    top = Math.min(top, node.position.y)
    right = Math.max(right, node.position.x + node.width)
    bottom = Math.max(bottom, node.position.y + node.height)
  })

  return { left, top, right, bottom }
}

export function viewportForBounds(
  bounds: CanvasBounds,
  viewportSize: CanvasViewportSize,
  options: { padding?: number; maxScale?: number } = {}
): ViewportTransform {
  const padding = options.padding ?? 96
  const maxScale = options.maxScale ?? 1
  const boundsWidth = Math.max(1, bounds.right - bounds.left)
  const boundsHeight = Math.max(1, bounds.bottom - bounds.top)
  const availableWidth = Math.max(1, viewportSize.width - padding * 2)
  const availableHeight = Math.max(1, viewportSize.height - padding * 2)
  const k = Math.min(
    maxScale,
    Math.max(
      CANVAS_MIN_SCALE,
      Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight)
    )
  )
  const centerX = (bounds.left + bounds.right) / 2
  const centerY = (bounds.top + bounds.bottom) / 2

  return {
    x: viewportSize.width / 2 - centerX * k,
    y: viewportSize.height / 2 - centerY * k,
    k,
  }
}

export function viewportAtScale(
  viewport: ViewportTransform,
  viewportSize: CanvasViewportSize,
  scale: number
): ViewportTransform {
  const k = clampCanvasScale(scale)
  const centerWorldX = (viewportSize.width / 2 - viewport.x) / viewport.k
  const centerWorldY = (viewportSize.height / 2 - viewport.y) / viewport.k
  return {
    x: viewportSize.width / 2 - centerWorldX * k,
    y: viewportSize.height / 2 - centerWorldY * k,
    k,
  }
}

export function interpolateViewport(
  from: ViewportTransform,
  to: ViewportTransform,
  progress: number
): ViewportTransform {
  const t = 1 - Math.pow(1 - Math.min(1, Math.max(0, progress)), 3)
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    k: from.k + (to.k - from.k) * t,
  }
}

export function nodeSizeFromRatio(
  size: string,
  baseWidth: number,
  baseHeight: number
) {
  const match = size?.match(/^(\d+)(?:x|:)(\d+)/)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  const ratio = width / Math.max(1, height)
  if (ratio < 0.25 || ratio > 4) return { width: baseWidth, height: baseHeight }
  return ratio >= baseWidth / baseHeight
    ? { width: baseWidth, height: baseWidth / ratio }
    : { width: baseHeight * ratio, height: baseHeight }
}

export function fitNodeSize(
  width: number,
  height: number,
  maxWidth = 640,
  maxHeight = 640
) {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const scale = Math.min(1, maxWidth / w, maxHeight / h)
  return { width: w * scale, height: h * scale }
}
