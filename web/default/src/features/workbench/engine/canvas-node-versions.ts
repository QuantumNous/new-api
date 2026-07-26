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
import { nanoid } from 'nanoid'

import {
  CanvasNodeType,
  type CanvasConnection,
  type CanvasNodeData,
} from '../types'

const VERSIONABLE = new Set([
  CanvasNodeType.Image,
  CanvasNodeType.Video,
  CanvasNodeType.Audio,
])
const LABELS = ['A', 'B', 'C'] as const

export function createNodeVariant(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  nodeId: string
): {
  node: CanvasNodeData
  connections: CanvasConnection[]
  updatedNodes: CanvasNodeData[]
} | null {
  const source = nodes.find((node) => node.id === nodeId)
  if (!source || !VERSIONABLE.has(source.type)) return null
  const rootId = source.metadata?.versionRootId ?? source.id
  const family = nodes.filter(
    (node) => (node.metadata?.versionRootId ?? node.id) === rootId
  )
  const occupiedLabels = new Set(
    family.map((node) => node.metadata?.versionLabel ?? 'A')
  )
  const label = LABELS.find((candidate) => !occupiedLabels.has(candidate))
  if (!label) return null
  const normalized = nodes.map((node) => {
    if (node.id !== source.id || source.metadata?.versionRootId) return node
    return {
      ...node,
      metadata: {
        ...node.metadata,
        versionRootId: rootId,
        versionLabel: 'A' as const,
        versionPrimary: true,
      },
    }
  })
  const id = nanoid()
  const node: CanvasNodeData = {
    ...source,
    id,
    title: `${source.title} ${label}`,
    position: {
      x: source.position.x + source.width + 32,
      y: source.position.y,
    },
    metadata: {
      ...source.metadata,
      content: undefined,
      assetId: undefined,
      status: 'idle',
      errorDetails: undefined,
      taskId: undefined,
      taskStatus: undefined,
      taskProgress: undefined,
      isBatchRoot: undefined,
      batchRootId: undefined,
      batchChildIds: undefined,
      imageBatchExpanded: undefined,
      primaryImageId: undefined,
      versionRootId: rootId,
      versionLabel: label,
      versionPrimary: false,
    },
  }
  const copiedConnections = connections
    .filter(
      (connection) =>
        connection.toNodeId === source.id && connection.fromNodeId !== source.id
    )
    .map((connection) => ({ ...connection, id: nanoid(), toNodeId: id }))
  return { node, connections: copiedConnections, updatedNodes: normalized }
}

export function setPrimaryNodeVersion(
  nodes: CanvasNodeData[],
  nodeId: string
): CanvasNodeData[] {
  const selected = nodes.find((node) => node.id === nodeId)
  if (!selected) return nodes
  const rootId = selected.metadata?.versionRootId ?? selected.id
  return nodes.map((node) => {
    if ((node.metadata?.versionRootId ?? node.id) !== rootId) return node
    return {
      ...node,
      metadata: { ...node.metadata, versionPrimary: node.id === nodeId },
    }
  })
}
