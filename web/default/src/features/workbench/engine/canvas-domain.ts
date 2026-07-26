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
import { nanoid } from 'nanoid'

import {
  NODE_DEFAULT_SIZE,
  STORYBOARD_HEADER_HEIGHT,
  STORYBOARD_ROW_HEIGHT,
  getNodeSpec,
  storyboardTableHeight,
} from '../constants'
import {
  CanvasNodeType,
  type CanvasConnection,
  type CanvasNodeData,
  type CanvasNodeMetadata,
  type ConnectionHandle,
  type Position,
  type StoryboardRow,
} from '../types'
import { isFrameNode } from './canvas-frame'
import { nodeSizeFromRatio } from './canvas-viewport'

export function createCanvasNode(
  type: CanvasNodeType,
  position: Position,
  metadata?: CanvasNodeMetadata
): CanvasNodeData {
  const spec = getNodeSpec(type)
  return {
    id: `${type}-${nanoid(8)}`,
    type,
    title: spec.title,
    position: {
      x: position.x - spec.width / 2,
      y: position.y - spec.height / 2,
    },
    width: spec.width,
    height: spec.height,
    metadata:
      type === CanvasNodeType.Script
        ? {
            ...spec.metadata,
            ...metadata,
            storyboard: metadata?.storyboard || {
              rows: [1, 2, 3].map((shotNumber) =>
                createStoryboardRow(shotNumber)
              ),
              referenceNodeIds: [],
            },
          }
        : { ...spec.metadata, ...metadata },
  }
}

export function createStoryboardRow(
  shotNumber: number,
  patch: Partial<StoryboardRow> = {}
): StoryboardRow {
  return {
    id: `shot-${nanoid(8)}`,
    shotNumber,
    durationSeconds: 6,
    plotDescription: '',
    dialogue: '',
    shotSize: '',
    camera: '',
    imageGenerationPrompt: '',
    videoMotionPrompt: '',
    negativePrompt: '',
    referenceNodeIds: [],
    status: 'idle',
    ...patch,
  }
}

export function applyNodeConfigPatch(
  node: CanvasNodeData,
  patch: Partial<CanvasNodeMetadata>
): CanvasNodeData {
  const safePatch = patch || {}
  const next = { ...node, metadata: { ...node.metadata, ...safePatch } }
  const isMedia =
    node.type === CanvasNodeType.Image || node.type === CanvasNodeType.Video
  if (
    !isMedia ||
    typeof safePatch.size !== 'string' ||
    node.metadata?.content
  ) {
    return next
  }
  const spec =
    node.type === CanvasNodeType.Video
      ? NODE_DEFAULT_SIZE[CanvasNodeType.Video]
      : NODE_DEFAULT_SIZE[CanvasNodeType.Image]
  const size = nodeSizeFromRatio(safePatch.size, spec.width, spec.height)
  if (!size) return next
  return {
    ...next,
    ...size,
    position: {
      x: node.position.x + node.width / 2 - size.width / 2,
      y: node.position.y + node.height / 2 - size.height / 2,
    },
  }
}

export function storyboardHandleAtY(
  node: CanvasNodeData,
  worldY: number,
  scrollTop = 0
) {
  const rows = node.metadata?.storyboard?.rows || []
  const localY = worldY - node.position.y - STORYBOARD_HEADER_HEIGHT
  const tableHeight = storyboardTableHeight(node.height)
  if (rows.length && localY >= 0 && localY <= tableHeight) {
    const index = Math.max(
      0,
      Math.min(
        rows.length - 1,
        Math.floor((localY + scrollTop) / STORYBOARD_ROW_HEIGHT)
      )
    )
    return `row:${rows[index].id}`
  }
  return undefined
}

export function storyboardHandleY(
  node: CanvasNodeData,
  handleId?: string,
  scrollTop = 0
) {
  if (node.type !== CanvasNodeType.Script) return undefined
  if (!handleId?.startsWith('row:')) return undefined
  const rowId = handleId.slice(4)
  const index = (node.metadata?.storyboard?.rows || []).findIndex(
    (row) => row.id === rowId
  )
  if (index < 0) return undefined
  const tableHeight = storyboardTableHeight(node.height)
  const localY = Math.min(
    Math.max(
      index * STORYBOARD_ROW_HEIGHT + STORYBOARD_ROW_HEIGHT / 2 - scrollTop,
      4
    ),
    tableHeight - 4
  )
  return node.position.y + STORYBOARD_HEADER_HEIGHT + localY
}

export function getConnectionTargetAnchor(
  node: CanvasNodeData,
  current: ConnectionHandle,
  handleId?: string,
  scrollTop = 0
) {
  return {
    x:
      current.handleType === 'source'
        ? node.position.x
        : node.position.x + node.width,
    y:
      storyboardHandleY(node, handleId, scrollTop) ??
      node.position.y + node.height / 2,
  }
}

export function normalizeConnection(
  firstNodeId: string,
  secondNodeId: string,
  nodes: CanvasNodeData[],
  firstHandleType: 'source' | 'target'
) {
  const first = nodes.find((node) => node.id === firstNodeId)
  const second = nodes.find((node) => node.id === secondNodeId)
  if (!first || !second || first.id === second.id) return null
  if (isFrameNode(first) || isFrameNode(second)) return null
  if (
    first.type === CanvasNodeType.Config &&
    second.type === CanvasNodeType.Config
  ) {
    return null
  }
  if (second.type === CanvasNodeType.Config) {
    return { fromNodeId: first.id, toNodeId: second.id }
  }
  if (first.type === CanvasNodeType.Config && firstHandleType === 'target') {
    return { fromNodeId: second.id, toNodeId: first.id }
  }
  if (first.type === CanvasNodeType.Config) {
    return { fromNodeId: first.id, toNodeId: second.id }
  }
  if (firstHandleType === 'target') {
    return { fromNodeId: second.id, toNodeId: first.id }
  }
  return { fromNodeId: first.id, toNodeId: second.id }
}

export function storyboardRowFromHandle(
  nodes: CanvasNodeData[],
  nodeId: string,
  handleId?: string
) {
  if (!handleId?.startsWith('row:')) return undefined
  return nodes
    .find((node) => node.id === nodeId && node.type === CanvasNodeType.Script)
    ?.metadata?.storyboard?.rows.find((row) => `row:${row.id}` === handleId)
}

/**
 * Links a media node to the storyboard row it was connected to, so shot
 * regeneration and batch runs can find their outputs again.
 */
export function attachNodeToStoryboardRow(
  nodes: CanvasNodeData[],
  connection: Pick<
    CanvasConnection,
    'fromNodeId' | 'toNodeId' | 'fromHandleId' | 'toHandleId'
  >
) {
  const fromRowHandle = connection.fromHandleId?.startsWith('row:')
  const toRowHandle = connection.toHandleId?.startsWith('row:')
  let scriptNodeId: string | null = null
  if (fromRowHandle) scriptNodeId = connection.fromNodeId
  else if (toRowHandle) scriptNodeId = connection.toNodeId
  if (!scriptNodeId) return nodes
  const handleId = connection.fromHandleId || connection.toHandleId
  const rowId = handleId?.startsWith('row:') ? handleId.slice(4) : null
  const linkedNodeId =
    scriptNodeId === connection.fromNodeId
      ? connection.toNodeId
      : connection.fromNodeId
  const linkedNode = nodes.find((node) => node.id === linkedNodeId)
  const scriptNode = nodes.find(
    (node) => node.id === scriptNodeId && node.type === CanvasNodeType.Script
  )
  if (!linkedNode || !scriptNode) return nodes
  const row = rowId
    ? scriptNode.metadata?.storyboard?.rows.find((item) => item.id === rowId)
    : undefined

  return nodes.map((node) => {
    if (node.id !== scriptNodeId) return node
    const storyboard = node.metadata?.storyboard
    if (!storyboard || !row) return node
    return {
      ...node,
      metadata: {
        ...node.metadata,
        storyboard: {
          ...storyboard,
          rows: storyboard.rows.map((item) => {
            if (item.id !== rowId) return item
            if (scriptNodeId !== connection.fromNodeId) {
              return {
                ...item,
                referenceNodeIds: [
                  ...new Set([...(item.referenceNodeIds || []), linkedNode.id]),
                ],
              }
            }
            return {
              ...item,
              imageNodeId:
                linkedNode.type === CanvasNodeType.Image
                  ? linkedNode.id
                  : item.imageNodeId,
              videoNodeId:
                linkedNode.type === CanvasNodeType.Video
                  ? linkedNode.id
                  : item.videoNodeId,
            }
          }),
        },
      },
    }
  })
}

export function isHiddenBatchChild(
  node: CanvasNodeData,
  nodes: CanvasNodeData[]
) {
  const rootId = node.metadata?.batchRootId
  if (!rootId) return false
  const root = nodes.find((item) => item.id === rootId)
  return Boolean(root && !root.metadata?.imageBatchExpanded)
}

export function sameStringSet(left: Set<string>, right: Set<string>) {
  if (left.size !== right.size) return false
  for (const value of left) if (!right.has(value)) return false
  return true
}

export function removeCanvasNodes(
  nodes: CanvasNodeData[],
  requestedIds: Set<string>
) {
  const removedIds = new Set(requestedIds)
  nodes.forEach((node) => {
    if (!requestedIds.has(node.id)) return
    node.metadata?.batchChildIds?.forEach((childId) => removedIds.add(childId))
  })
  const remaining = nodes.filter((node) => !removedIds.has(node.id))
  const nextNodes = remaining.map((node) => {
    const detached =
      node.parentId && removedIds.has(node.parentId)
        ? { ...node, parentId: undefined }
        : node
    const storyboard = detached.metadata?.storyboard
    const cleaned = storyboard
      ? {
          ...detached,
          metadata: {
            ...detached.metadata,
            storyboard: {
              ...storyboard,
              referenceNodeIds: storyboard.referenceNodeIds.filter(
                (id) => !removedIds.has(id)
              ),
              rows: storyboard.rows.map((row) => ({
                ...row,
                referenceNodeIds: (row.referenceNodeIds || []).filter(
                  (id) => !removedIds.has(id)
                ),
                imageNodeId:
                  row.imageNodeId && !removedIds.has(row.imageNodeId)
                    ? row.imageNodeId
                    : undefined,
                videoNodeId:
                  row.videoNodeId && !removedIds.has(row.videoNodeId)
                    ? row.videoNodeId
                    : undefined,
              })),
            },
          },
        }
      : detached
    const childIds = cleaned.metadata?.batchChildIds?.filter(
      (childId) => !removedIds.has(childId)
    )
    if (
      !cleaned.metadata?.isBatchRoot ||
      childIds?.length === cleaned.metadata.batchChildIds?.length
    ) {
      return cleaned
    }
    const primaryImageId = childIds?.includes(
      cleaned.metadata.primaryImageId || ''
    )
      ? cleaned.metadata.primaryImageId
      : childIds?.[0]
    const primaryNode = remaining.find((item) => item.id === primaryImageId)
    return {
      ...cleaned,
      metadata: {
        ...cleaned.metadata,
        batchChildIds: childIds,
        primaryImageId,
        content: primaryNode?.metadata?.content || cleaned.metadata?.content,
        naturalWidth:
          primaryNode?.metadata?.naturalWidth || cleaned.metadata?.naturalWidth,
        naturalHeight:
          primaryNode?.metadata?.naturalHeight ||
          cleaned.metadata?.naturalHeight,
      },
    }
  })
  return { removedIds, nodes: nextNodes }
}

export type NodeAlignmentContext = {
  movingBounds: { left: number; top: number; right: number; bottom: number }
  targets: Array<{ x: number[]; y: number[] }>
}

export function createNodeAlignmentContext(
  nodes: CanvasNodeData[],
  initialPositions: Array<{ id: string; x: number; y: number }>
): NodeAlignmentContext | null {
  const movingIds = new Set(initialPositions.map((item) => item.id))
  const initialById = new Map(initialPositions.map((item) => [item.id, item]))
  const movingNodes = nodes.filter((node) => movingIds.has(node.id))
  if (!movingNodes.length) return null
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const left = Math.min(
    ...movingNodes.map((node) => initialById.get(node.id)?.x ?? node.position.x)
  )
  const top = Math.min(
    ...movingNodes.map((node) => initialById.get(node.id)?.y ?? node.position.y)
  )
  const right = Math.max(
    ...movingNodes.map(
      (node) => (initialById.get(node.id)?.x ?? node.position.x) + node.width
    )
  )
  const bottom = Math.max(
    ...movingNodes.map(
      (node) => (initialById.get(node.id)?.y ?? node.position.y) + node.height
    )
  )
  const targets = nodes.flatMap((node) => {
    if (movingIds.has(node.id)) return []
    const batchRoot = node.metadata?.batchRootId
      ? nodeById.get(node.metadata.batchRootId)
      : null
    if (batchRoot && !batchRoot.metadata?.imageBatchExpanded) return []
    const parent = node.parentId ? nodeById.get(node.parentId) : null
    if (parent && isFrameNode(parent) && parent.metadata?.frame?.collapsed) {
      return []
    }
    return [
      {
        x: [
          node.position.x,
          node.position.x + node.width / 2,
          node.position.x + node.width,
        ],
        y: [
          node.position.y,
          node.position.y + node.height / 2,
          node.position.y + node.height,
        ],
      },
    ]
  })
  return { movingBounds: { left, top, right, bottom }, targets }
}

export function calculateNodeAlignment(
  context: NodeAlignmentContext | null,
  rawOffset: Position,
  threshold: number
) {
  if (!context) {
    return {
      offset: rawOffset,
      guides: {} as { vertical?: number; horizontal?: number },
    }
  }
  const { left, top, right, bottom } = context.movingBounds
  const movingX = [
    left + rawOffset.x,
    (left + right) / 2 + rawOffset.x,
    right + rawOffset.x,
  ]
  const movingY = [
    top + rawOffset.y,
    (top + bottom) / 2 + rawOffset.y,
    bottom + rawOffset.y,
  ]
  let bestXDelta: number | undefined
  let bestXGuide: number | undefined
  let bestYDelta: number | undefined
  let bestYGuide: number | undefined
  context.targets.forEach((target) => {
    movingX.forEach((value, anchorIndex) => {
      const delta = target.x[anchorIndex] - value
      if (
        Math.abs(delta) <= threshold &&
        (bestXDelta === undefined || Math.abs(delta) < Math.abs(bestXDelta))
      ) {
        bestXDelta = delta
        bestXGuide = target.x[anchorIndex]
      }
    })
    movingY.forEach((value, anchorIndex) => {
      const delta = target.y[anchorIndex] - value
      if (
        Math.abs(delta) <= threshold &&
        (bestYDelta === undefined || Math.abs(delta) < Math.abs(bestYDelta))
      ) {
        bestYDelta = delta
        bestYGuide = target.y[anchorIndex]
      }
    })
  })
  return {
    offset: {
      x: rawOffset.x + (bestXDelta || 0),
      y: rawOffset.y + (bestYDelta || 0),
    },
    guides: { vertical: bestXGuide, horizontal: bestYGuide },
  }
}
