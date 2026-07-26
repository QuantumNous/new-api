/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'

import { api } from '@/lib/api'

import {
  CANVAS_SNAPSHOT_VERSION,
  type CanvasProject,
  type CanvasSnapshotV1,
} from './types'

const ENDPOINT = '/api/playground/canvas/projects'

function decodeProject(payload: unknown): CanvasProject {
  const envelope = payload as { data?: unknown }
  const project = (envelope?.data ?? payload) as Omit<
    CanvasProject,
    'snapshot'
  > & {
    snapshot: {
      schema_version?: number
      viewport?: { x?: number; y?: number; zoom?: number; k?: number }
      nodes?: Array<
        Partial<CanvasSnapshotV1['nodes'][number]> & {
          type?: string
          position?: { x?: number; y?: number }
          data?: { text?: string; content?: string }
        }
      >
      edges?: CanvasSnapshotV1['edges']
      provenance?: Record<string, unknown>
      source?: Record<string, unknown>
    }
  }
  const source = project.snapshot
  if (source.schema_version !== CANVAS_SNAPSHOT_VERSION) {
    throw new Error('Unsupported canvas snapshot version')
  }
  const snapshot: CanvasSnapshotV1 = {
    schema_version: CANVAS_SNAPSHOT_VERSION,
    viewport: {
      x: source.viewport?.x ?? 0,
      y: source.viewport?.y ?? 0,
      k: source.viewport?.k ?? source.viewport?.zoom ?? 1,
    },
    nodes: (source.nodes ?? []).map((node) => {
      let kind: CanvasSnapshotV1['nodes'][number]['kind'] = 'text'
      if (node.kind === 'image' || node.kind === 'video') {
        kind = node.kind
      } else if (node.type === 'image' || node.type === 'video') {
        kind = node.type
      }
      return {
        id: node.id ?? crypto.randomUUID(),
        kind,
        x: node.x ?? node.position?.x ?? 0,
        y: node.y ?? node.position?.y ?? 0,
        width: node.width ?? 320,
        height: node.height ?? 180,
        content: node.content ?? node.data?.text ?? node.data?.content ?? '',
        model: node.model,
        group: node.group,
        taskId: node.taskId,
      }
    }),
    edges: source.edges ?? [],
    provenance: source.provenance,
    source: source.source,
  }
  return { ...project, snapshot }
}

export async function createCanvasProject(input: {
  template_id: number
  title?: string
  prompt?: string
  values?: Record<string, string | number>
}): Promise<CanvasProject> {
  const response = await api.post(ENDPOINT, input)
  return decodeProject(response.data)
}

export async function getCanvasProject(id: string): Promise<CanvasProject> {
  const response = await api.get(`${ENDPOINT}/${id}`)
  return decodeProject(response.data)
}

export async function listCanvasProjects(): Promise<CanvasProject[]> {
  const response = await api.get(ENDPOINT)
  const envelope = response.data as { data?: unknown }
  const projects = envelope.data ?? response.data
  if (!Array.isArray(projects)) return []
  return projects.map((project) => decodeProject(project))
}

export async function updateCanvasProject(
  id: string,
  input: {
    revision: number
    title?: string
    snapshot_version: number
    snapshot: CanvasSnapshotV1
  }
): Promise<CanvasProject> {
  try {
    const response = await api.patch(`${ENDPOINT}/${id}`, input, {
      skipErrorHandler: true,
    })
    return decodeProject(response.data)
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      throw new CanvasRevisionConflictError()
    }
    throw error
  }
}

export class CanvasRevisionConflictError extends Error {}

export function useCanvasProject(id: string) {
  return useQuery({
    queryKey: ['inspiration', 'canvas', 'project', id],
    queryFn: () => getCanvasProject(id),
  })
}

export function useUpdateCanvasProject(id: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof updateCanvasProject>[1]) =>
      updateCanvasProject(id, input),
  })
}
