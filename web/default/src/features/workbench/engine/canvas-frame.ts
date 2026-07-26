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
import { CanvasNodeType, type CanvasNodeData } from '../types'

export const FRAME_HEADER_HEIGHT = 36
export const FRAME_PADDING = 24

export function isFrameNode(node?: CanvasNodeData | null): boolean {
  return node?.type === CanvasNodeType.Frame
}

export function canFrameContain(node: CanvasNodeData) {
  return (
    node.type === CanvasNodeType.Image ||
    node.type === CanvasNodeType.Text ||
    node.type === CanvasNodeType.Script ||
    node.type === CanvasNodeType.Video ||
    node.type === CanvasNodeType.Audio
  )
}

export function getFrameChildren(frameId: string, nodes: CanvasNodeData[]) {
  return nodes.filter((node) => node.parentId === frameId)
}

export function getFrameChildIds(frameId: string, nodes: CanvasNodeData[]) {
  return new Set(getFrameChildren(frameId, nodes).map((node) => node.id))
}

export function getCollapsedParentFrame(
  node: CanvasNodeData,
  nodes: CanvasNodeData[]
) {
  if (!node.parentId) return null
  const frame = nodes.find(
    (item) => item.id === node.parentId && isFrameNode(item)
  )
  return frame?.metadata?.frame?.collapsed ? frame : null
}

export function isNodeHiddenByCollapsedFrame(
  node: CanvasNodeData,
  nodes: CanvasNodeData[]
) {
  return Boolean(getCollapsedParentFrame(node, nodes))
}

export function findFrameDropTarget(
  nodes: CanvasNodeData[],
  draggedNodeIds: Set<string>
) {
  const dragged = nodes.filter(
    (node) => draggedNodeIds.has(node.id) && canFrameContain(node)
  )
  if (!dragged.length) return null

  return (
    [...nodes].reverse().find((frame) => {
      if (
        !isFrameNode(frame) ||
        frame.metadata?.frame?.collapsed ||
        draggedNodeIds.has(frame.id)
      ) {
        return false
      }
      const left = frame.position.x
      const top = frame.position.y + FRAME_HEADER_HEIGHT
      const right = frame.position.x + frame.width
      const bottom = frame.position.y + frame.height
      return dragged.every((node) => {
        const centerX = node.position.x + node.width / 2
        const centerY = node.position.y + node.height / 2
        return (
          centerX >= left &&
          centerX <= right &&
          centerY >= top &&
          centerY <= bottom
        )
      })
    })?.id || null
  )
}

export function applyFrameDrop(
  nodes: CanvasNodeData[],
  draggedNodeIds: Set<string>,
  frameId: string | null
) {
  const next = nodes.map((node) =>
    draggedNodeIds.has(node.id) && canFrameContain(node)
      ? { ...node, parentId: frameId || undefined }
      : node
  )
  if (!frameId) return next

  const children = getFrameChildren(frameId, next)
  if (!children.length) return next
  const frame = next.find((node) => node.id === frameId)
  if (!frame || !isFrameNode(frame)) return next

  const left = Math.min(
    frame.position.x,
    ...children.map((node) => node.position.x - FRAME_PADDING)
  )
  const top = Math.min(
    frame.position.y,
    ...children.map(
      (node) => node.position.y - FRAME_HEADER_HEIGHT - FRAME_PADDING
    )
  )
  const right = Math.max(
    frame.position.x + frame.width,
    ...children.map((node) => node.position.x + node.width + FRAME_PADDING)
  )
  const bottom = Math.max(
    frame.position.y + frame.height,
    ...children.map((node) => node.position.y + node.height + FRAME_PADDING)
  )

  return next.map((node) =>
    node.id === frameId
      ? {
          ...node,
          position: { x: left, y: top },
          width: right - left,
          height: bottom - top,
          metadata: {
            ...node.metadata,
            frame: {
              collapsed: false,
              expandedWidth: right - left,
              expandedHeight: bottom - top,
            },
          },
        }
      : node
  )
}

export function resolveFrameConnection(
  connection: { fromNodeId: string; toNodeId: string },
  nodes: CanvasNodeData[]
) {
  const from = nodes.find((node) => node.id === connection.fromNodeId)
  const to = nodes.find((node) => node.id === connection.toNodeId)
  if (!from || !to) return null

  const displayFrom = getCollapsedParentFrame(from, nodes) || from
  const displayTo = getCollapsedParentFrame(to, nodes) || to
  if (displayFrom.id === displayTo.id) return null
  return { from: displayFrom, to: displayTo }
}
