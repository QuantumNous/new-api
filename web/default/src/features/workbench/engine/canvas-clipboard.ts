/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { nanoid } from 'nanoid'

import type { CanvasConnection, CanvasNodeData, Position } from '../types'

export const CANVAS_CLIPBOARD_KIND = 'boxai-canvas-selection'

export type CanvasClipboardPayload = {
  kind: typeof CANVAS_CLIPBOARD_KIND
  version: 1
  nodes: CanvasNodeData[]
  connections: CanvasConnection[]
}

/**
 * Collects the selected nodes plus the batch children they own, together with
 * the connections whose two ends are both inside the selection.
 */
export function serializeCanvasSelection(
  nodes: CanvasNodeData[],
  connections: CanvasConnection[],
  selectedIds: string[]
): CanvasClipboardPayload | null {
  const wanted = new Set(selectedIds)
  let changed = true
  while (changed) {
    changed = false
    nodes.forEach((node) => {
      if (!wanted.has(node.id)) return
      const related = [
        ...nodes
          .filter((candidate) => candidate.parentId === node.id)
          .map((candidate) => candidate.id),
        ...(node.metadata?.batchChildIds ?? []),
      ]
      related.forEach((id) => {
        if (wanted.has(id)) return
        wanted.add(id)
        changed = true
      })
    })
  }
  const picked = nodes.filter((node) => wanted.has(node.id))
  if (!picked.length) return null
  return {
    kind: CANVAS_CLIPBOARD_KIND,
    version: 1,
    nodes: picked,
    connections: connections.filter(
      (connection) =>
        wanted.has(connection.fromNodeId) && wanted.has(connection.toNodeId)
    ),
  }
}

export function parseCanvasClipboard(
  text: string
): CanvasClipboardPayload | null {
  try {
    const parsed = JSON.parse(text) as Partial<CanvasClipboardPayload>
    if (parsed?.kind !== CANVAS_CLIPBOARD_KIND) return null
    if (!Array.isArray(parsed.nodes) || !parsed.nodes.length) return null
    return {
      kind: CANVAS_CLIPBOARD_KIND,
      version: 1,
      nodes: parsed.nodes,
      connections: Array.isArray(parsed.connections) ? parsed.connections : [],
    }
  } catch {
    return null
  }
}

/**
 * Rebuilds a clipboard payload with fresh identifiers so it can be pasted into
 * the same canvas (or another one) without colliding with existing nodes.
 */
export function instantiateClipboardNodes(
  payload: CanvasClipboardPayload,
  offset: Position
): { nodes: CanvasNodeData[]; connections: CanvasConnection[] } {
  const idMap = new Map(
    payload.nodes.map((node) => [node.id, `${node.type}-${nanoid(8)}`])
  )
  const rowIdMap = new Map(
    payload.nodes.flatMap((node) =>
      (node.metadata?.storyboard?.rows ?? []).map(
        (row) => [row.id, `shot-${nanoid(8)}`] as const
      )
    )
  )
  const remap = (id?: string) => (id ? idMap.get(id) : undefined)
  const remapHandle = (handleId?: string) => {
    if (!handleId?.startsWith('row:')) return handleId
    const nextRowId = rowIdMap.get(handleId.slice(4))
    return nextRowId ? `row:${nextRowId}` : undefined
  }

  const versionFamilies = new Map<string, CanvasNodeData[]>()
  payload.nodes.forEach((node) => {
    const rootId = node.metadata?.versionRootId
    if (!rootId) return
    versionFamilies.set(rootId, [...(versionFamilies.get(rootId) ?? []), node])
  })
  const normalizedVersions = new Map<
    string,
    { rootId: string; label: 'A' | 'B' | 'C'; primary: boolean }
  >()
  versionFamilies.forEach((family, oldRootId) => {
    const root = family.find((node) => node.id === oldRootId) ?? family[0]
    const rootId = idMap.get(root.id) as string
    family.slice(0, 3).forEach((node, index) => {
      normalizedVersions.set(node.id, {
        rootId,
        label: ['A', 'B', 'C'][index] as 'A' | 'B' | 'C',
        primary: node.id === root.id,
      })
    })
  })

  const nodes = payload.nodes.map((node) => {
    const storyboard = node.metadata?.storyboard
    const version = normalizedVersions.get(node.id)
    return {
      ...node,
      id: idMap.get(node.id) as string,
      parentId: remap(node.parentId),
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
      metadata: {
        ...node.metadata,
        status: node.metadata?.content
          ? ('success' as const)
          : ('idle' as const),
        errorDetails: undefined,
        taskId: undefined,
        taskStatus: undefined,
        taskProgress: undefined,
        batchRootId: remap(node.metadata?.batchRootId),
        batchChildIds: node.metadata?.batchChildIds
          ?.map((childId) => remap(childId))
          .filter((childId): childId is string => Boolean(childId)),
        primaryImageId: remap(node.metadata?.primaryImageId),
        versionRootId: version?.rootId,
        versionLabel: version?.label,
        versionPrimary: version?.primary,
        storyboard: storyboard
          ? {
              referenceNodeIds: storyboard.referenceNodeIds
                .map((id) => remap(id))
                .filter((id): id is string => Boolean(id)),
              rows: storyboard.rows.map((row) => ({
                ...row,
                id: rowIdMap.get(row.id) ?? `shot-${nanoid(8)}`,
                status: 'idle' as const,
                errorDetails: undefined,
                referenceNodeIds: (row.referenceNodeIds || [])
                  .map((id) => remap(id))
                  .filter((id): id is string => Boolean(id)),
                imageNodeId: remap(row.imageNodeId),
                videoNodeId: remap(row.videoNodeId),
              })),
            }
          : undefined,
      },
    }
  })

  const connections = payload.connections.flatMap<CanvasConnection>(
    (connection) => {
      const fromNodeId = remap(connection.fromNodeId)
      const toNodeId = remap(connection.toNodeId)
      if (!fromNodeId || !toNodeId) return []
      return [
        {
          ...connection,
          id: `conn-${nanoid(8)}`,
          fromNodeId,
          toNodeId,
          fromHandleId: remapHandle(connection.fromHandleId),
          toHandleId: remapHandle(connection.toHandleId),
        },
      ]
    }
  )

  return { nodes, connections }
}
