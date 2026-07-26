/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the License.
*/
import type { CanvasConnection, CanvasNodeData, Position } from '../types'

export type CanvasLayoutAction =
  | 'align-left'
  | 'align-center-x'
  | 'align-right'
  | 'align-top'
  | 'align-center-y'
  | 'align-bottom'
  | 'distribute-x'
  | 'distribute-y'
  | 'row'
  | 'column'
  | 'grid'
  | 'connections'

const GAP = 32

/** Returns absolute positions for movable selection roots. Children of a selected frame
 * move with their frame in the renderer and must never receive a second offset. */
export function layoutCanvasNodes(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  selectedIds: string[],
  action: CanvasLayoutAction
): Array<{ id: string; position: Position }> {
  const selected = new Set(selectedIds)
  const items = nodes.filter(
    (node) =>
      selected.has(node.id) &&
      !node.metadata?.locked &&
      !(node.parentId && selected.has(node.parentId))
  )
  if (items.length < 2) return []
  const left = Math.min(...items.map((node) => node.position.x))
  const top = Math.min(...items.map((node) => node.position.y))
  const right = Math.max(...items.map((node) => node.position.x + node.width))
  const bottom = Math.max(...items.map((node) => node.position.y + node.height))
  const result = new Map(items.map((node) => [node.id, { ...node.position }]))

  if (action.startsWith('align-')) {
    items.forEach((node) => {
      const position = result.get(node.id) ?? { ...node.position }
      if (action === 'align-left') position.x = left
      if (action === 'align-center-x') {
        position.x = (left + right - node.width) / 2
      }
      if (action === 'align-right') position.x = right - node.width
      if (action === 'align-top') position.y = top
      if (action === 'align-center-y') {
        position.y = (top + bottom - node.height) / 2
      }
      if (action === 'align-bottom') position.y = bottom - node.height
    })
  } else if (action === 'distribute-x' || action === 'distribute-y') {
    const horizontal = action === 'distribute-x'
    const sorted = [...items].sort((a, b) =>
      horizontal ? a.position.x - b.position.x : a.position.y - b.position.y
    )
    const totalSize = sorted.reduce(
      (sum, node) => sum + (horizontal ? node.width : node.height),
      0
    )
    const span = horizontal ? right - left : bottom - top
    const gap = sorted.length > 1 ? (span - totalSize) / (sorted.length - 1) : 0
    let cursor = horizontal ? left : top
    sorted.forEach((node) => {
      const position = result.get(node.id) ?? { ...node.position }
      if (horizontal) position.x = cursor
      else position.y = cursor
      cursor += (horizontal ? node.width : node.height) + gap
    })
  } else {
    let ordered = [...items]
    if (action === 'connections') {
      const rank = new Map(items.map((node) => [node.id, 0]))
      for (let pass = 0; pass < items.length; pass += 1) {
        connections.forEach((edge) => {
          if (!rank.has(edge.fromNodeId) || !rank.has(edge.toNodeId)) return
          rank.set(
            edge.toNodeId,
            Math.max(
              rank.get(edge.toNodeId) ?? 0,
              (rank.get(edge.fromNodeId) ?? 0) + 1
            )
          )
        })
      }
      ordered = ordered.sort(
        (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0)
      )
    }
    let columns = Math.ceil(Math.sqrt(ordered.length))
    if (action === 'column') columns = 1
    if (action === 'row' || action === 'connections') columns = ordered.length
    const cellWidth = Math.max(...ordered.map((node) => node.width)) + GAP
    const cellHeight = Math.max(...ordered.map((node) => node.height)) + GAP
    ordered.forEach((node, index) =>
      result.set(node.id, {
        x: left + (index % columns) * cellWidth,
        y: top + Math.floor(index / columns) * cellHeight,
      })
    )
  }
  return items.map((node) => ({
    id: node.id,
    position: result.get(node.id) ?? node.position,
  }))
}
