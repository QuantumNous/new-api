/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
export const CANVAS_SNAPSHOT_VERSION = 1 as const

export type CanvasNodeKind = 'text' | 'image' | 'video'
export type CanvasNode = {
  id: string
  kind: CanvasNodeKind
  x: number
  y: number
  width: number
  height: number
  content: string
  model?: string
  group?: string
  taskId?: string
}
export type CanvasEdge = { id: string; from: string; to: string }
export type CanvasViewport = { x: number; y: number; k: number }
export type CanvasSnapshotV1 = {
  schema_version: typeof CANVAS_SNAPSHOT_VERSION
  viewport: CanvasViewport
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  provenance?: Record<string, unknown>
  source?: Record<string, unknown>
}
export type CanvasProject = {
  id: number
  title: string
  revision: number
  snapshot: CanvasSnapshotV1
  created_at?: number
  updated_at?: number
}
