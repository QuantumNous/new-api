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
import { create } from 'zustand'

import {
  applyNodeConfigPatch,
  attachNodeToStoryboardRow,
  createCanvasNode,
  normalizeConnection,
  removeCanvasNodes,
} from '../engine/canvas-domain'
import { applyFrameDrop, findFrameDropTarget } from '../engine/canvas-frame'
import {
  getCanvasNodesBounds,
  viewportForBounds,
} from '../engine/canvas-viewport'
import {
  CanvasNodeType,
  type CanvasBackgroundMode,
  type CanvasConnection,
  type CanvasDocument,
  type CanvasNodeData,
  type CanvasNodeMetadata,
  type Position,
  type StoryboardRow,
  type ViewportTransform,
} from '../types'

const HISTORY_LIMIT = 80

export const DEFAULT_VIEWPORT: ViewportTransform = { x: 0, y: 0, k: 1 }

type HistorySnapshot = {
  nodes: CanvasNodeData[]
  connections: CanvasConnection[]
}

type CanvasStoreState = {
  nodes: CanvasNodeData[]
  connections: CanvasConnection[]
  viewport: ViewportTransform
  backgroundMode: CanvasBackgroundMode
  selectedNodeIds: string[]
  selectedConnectionId: string | null
  past: HistorySnapshot[]
  future: HistorySnapshot[]
  revision: number
  loadDocument: (doc: Partial<CanvasDocument> | null) => void
  exportDocument: () => CanvasDocument
  setViewport: (viewport: ViewportTransform) => void
  setBackgroundMode: (mode: CanvasBackgroundMode) => void
  fitView: (size: { width: number; height: number }) => void
  addNode: (
    type: CanvasNodeType,
    position: Position,
    metadata?: CanvasNodeMetadata
  ) => CanvasNodeData
  insertNodes: (nodes: CanvasNodeData[]) => void
  updateNode: (id: string, patch: Partial<CanvasNodeData>) => void
  updateNodeMetadata: (id: string, patch: Partial<CanvasNodeMetadata>) => void
  updateStoryboardRow: (
    nodeId: string,
    rowId: string,
    patch: Partial<StoryboardRow>
  ) => void
  setStoryboardRows: (nodeId: string, rows: StoryboardRow[]) => void
  moveNodes: (offsets: Array<{ id: string; x: number; y: number }>) => void
  commitNodeDrag: (movedIds: string[]) => void
  removeNodes: (ids: string[]) => void
  duplicateNodes: (ids: string[]) => void
  connectNodes: (
    fromNodeId: string,
    toNodeId: string,
    options?: {
      firstHandleType?: 'source' | 'target'
      fromHandleId?: string
      toHandleId?: string
    }
  ) => void
  removeConnection: (id: string) => void
  setSelectedNodes: (ids: string[]) => void
  setSelectedConnection: (id: string | null) => void
  clearSelection: () => void
  undo: () => void
  redo: () => void
}

function snapshot(state: CanvasStoreState): HistorySnapshot {
  return { nodes: state.nodes, connections: state.connections }
}

function withHistory(
  state: CanvasStoreState,
  next: Partial<CanvasStoreState>
): Partial<CanvasStoreState> {
  return {
    ...next,
    past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
    future: [],
    revision: state.revision + 1,
  }
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  nodes: [],
  connections: [],
  viewport: DEFAULT_VIEWPORT,
  backgroundMode: 'lines',
  selectedNodeIds: [],
  selectedConnectionId: null,
  past: [],
  future: [],
  revision: 0,

  loadDocument: (doc) =>
    set({
      nodes: doc?.nodes ?? [],
      connections: doc?.connections ?? [],
      viewport: doc?.viewport ?? DEFAULT_VIEWPORT,
      backgroundMode: doc?.backgroundMode ?? 'lines',
      selectedNodeIds: [],
      selectedConnectionId: null,
      past: [],
      future: [],
      revision: 0,
    }),

  exportDocument: () => {
    const state = get()
    return {
      nodes: state.nodes,
      connections: state.connections,
      viewport: state.viewport,
      backgroundMode: state.backgroundMode,
    }
  },

  setViewport: (viewport) => set({ viewport }),

  setBackgroundMode: (backgroundMode) =>
    set((state) => ({ backgroundMode, revision: state.revision + 1 })),

  fitView: (size) => {
    const bounds = getCanvasNodesBounds(get().nodes)
    if (!bounds) {
      set({ viewport: DEFAULT_VIEWPORT })
      return
    }
    set({ viewport: viewportForBounds(bounds, size) })
  },

  addNode: (type, position, metadata) => {
    const node = createCanvasNode(type, position, metadata)
    set((state) =>
      withHistory(state, {
        nodes: [...state.nodes, node],
        selectedNodeIds: [node.id],
        selectedConnectionId: null,
      })
    )
    return node
  },

  insertNodes: (nodes) => {
    if (!nodes.length) return
    set((state) =>
      withHistory(state, {
        nodes: [...state.nodes, ...nodes],
        selectedNodeIds: nodes.map((node) => node.id),
        selectedConnectionId: null,
      })
    )
  },

  updateNode: (id, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...patch } : node
      ),
      revision: state.revision + 1,
    })),

  updateNodeMetadata: (id, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? applyNodeConfigPatch(node, patch) : node
      ),
      revision: state.revision + 1,
    })),

  updateStoryboardRow: (nodeId, rowId, patch) =>
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const storyboard = node.metadata?.storyboard
        if (node.id !== nodeId || !storyboard) return node
        return {
          ...node,
          metadata: {
            ...node.metadata,
            storyboard: {
              ...storyboard,
              rows: storyboard.rows.map((row) =>
                row.id === rowId ? { ...row, ...patch } : row
              ),
            },
          },
        }
      }),
      revision: state.revision + 1,
    })),

  setStoryboardRows: (nodeId, rows) =>
    set((state) =>
      withHistory(state, {
        nodes: state.nodes.map((node) => {
          if (node.id !== nodeId) return node
          return {
            ...node,
            metadata: {
              ...node.metadata,
              storyboard: {
                referenceNodeIds:
                  node.metadata?.storyboard?.referenceNodeIds ?? [],
                rows,
              },
            },
          }
        }),
      })
    ),

  moveNodes: (offsets) => {
    const positionById = new Map(offsets.map((item) => [item.id, item]))
    set((state) => ({
      nodes: state.nodes.map((node) => {
        const target = positionById.get(node.id)
        return target
          ? { ...node, position: { x: target.x, y: target.y } }
          : node
      }),
      revision: state.revision + 1,
    }))
  },

  commitNodeDrag: (movedIds) => {
    const state = get()
    const draggedIds = new Set(movedIds)
    const frameId = findFrameDropTarget(state.nodes, draggedIds)
    set(
      withHistory(state, {
        nodes: applyFrameDrop(state.nodes, draggedIds, frameId),
      })
    )
  },

  removeNodes: (ids) => {
    if (!ids.length) return
    set((state) => {
      const { removedIds, nodes } = removeCanvasNodes(state.nodes, new Set(ids))
      return withHistory(state, {
        nodes,
        connections: state.connections.filter(
          (connection) =>
            !removedIds.has(connection.fromNodeId) &&
            !removedIds.has(connection.toNodeId)
        ),
        selectedNodeIds: state.selectedNodeIds.filter(
          (id) => !removedIds.has(id)
        ),
      })
    })
  },

  duplicateNodes: (ids) => {
    const state = get()
    const selected = new Set(ids)
    const copies = state.nodes
      .filter((node) => selected.has(node.id))
      .map((node) => ({
        ...node,
        id: `${node.type}-${nanoid(8)}`,
        parentId: undefined,
        position: { x: node.position.x + 40, y: node.position.y + 40 },
        metadata: {
          ...node.metadata,
          isBatchRoot: undefined,
          batchRootId: undefined,
          batchChildIds: undefined,
        },
      }))
    if (!copies.length) return
    set(
      withHistory(state, {
        nodes: [...state.nodes, ...copies],
        selectedNodeIds: copies.map((node) => node.id),
      })
    )
  },

  connectNodes: (fromNodeId, toNodeId, options) => {
    const state = get()
    const normalized = normalizeConnection(
      fromNodeId,
      toNodeId,
      state.nodes,
      options?.firstHandleType ?? 'source'
    )
    if (!normalized) return
    const flipped = normalized.fromNodeId !== fromNodeId
    const fromHandleId = flipped ? options?.toHandleId : options?.fromHandleId
    const toHandleId = flipped ? options?.fromHandleId : options?.toHandleId
    const exists = state.connections.some(
      (connection) =>
        connection.fromNodeId === normalized.fromNodeId &&
        connection.toNodeId === normalized.toNodeId &&
        connection.fromHandleId === fromHandleId &&
        connection.toHandleId === toHandleId
    )
    if (exists) return
    const connection: CanvasConnection = {
      id: `conn-${nanoid(8)}`,
      ...normalized,
      fromHandleId,
      toHandleId,
    }
    set(
      withHistory(state, {
        connections: [...state.connections, connection],
        nodes: attachNodeToStoryboardRow(state.nodes, connection),
      })
    )
  },

  removeConnection: (id) =>
    set((state) =>
      withHistory(state, {
        connections: state.connections.filter(
          (connection) => connection.id !== id
        ),
        selectedConnectionId:
          state.selectedConnectionId === id ? null : state.selectedConnectionId,
      })
    ),

  setSelectedNodes: (ids) =>
    set({ selectedNodeIds: ids, selectedConnectionId: null }),

  setSelectedConnection: (id) =>
    set({ selectedConnectionId: id, selectedNodeIds: [] }),

  clearSelection: () =>
    set({ selectedNodeIds: [], selectedConnectionId: null }),

  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      if (!previous) return state
      return {
        ...state,
        ...previous,
        past: state.past.slice(0, -1),
        future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
        selectedNodeIds: [],
        selectedConnectionId: null,
        revision: state.revision + 1,
      }
    }),

  redo: () =>
    set((state) => {
      const next = state.future[0]
      if (!next) return state
      return {
        ...state,
        ...next,
        past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
        future: state.future.slice(1),
        selectedNodeIds: [],
        selectedConnectionId: null,
        revision: state.revision + 1,
      }
    }),
}))

export function canvasNodeById(nodes: CanvasNodeData[], id?: string | null) {
  if (!id) return undefined
  return nodes.find((node) => node.id === id)
}

export function isGenerationNode(node: CanvasNodeData) {
  return (
    node.type === CanvasNodeType.Image ||
    node.type === CanvasNodeType.Video ||
    node.type === CanvasNodeType.Audio
  )
}
