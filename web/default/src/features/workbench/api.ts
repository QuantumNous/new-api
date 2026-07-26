/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { api } from '@/lib/api'

import type {
  CanvasProjectMeta,
  CanvasProjectRecord,
  CanvasVersionMeta,
  CanvasVersionRecord,
} from './types'

const CANVAS_PROJECTS = '/api/playground/canvas/projects'

export async function listCanvasProjects(): Promise<CanvasProjectMeta[]> {
  const res = await api.get(CANVAS_PROJECTS)
  if (!res.data?.success) return []
  return (res.data.data?.projects ?? []) as CanvasProjectMeta[]
}

export async function getCanvasProject(
  id: number
): Promise<CanvasProjectRecord> {
  const res = await api.get(`${CANVAS_PROJECTS}/${id}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'request failed')
  return res.data.data as CanvasProjectRecord
}

export async function createCanvasProject(input: {
  title: string
  doc: string
  cover?: string
}): Promise<CanvasProjectRecord> {
  const res = await api.post(CANVAS_PROJECTS, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'request failed')
  return res.data.data as CanvasProjectRecord
}

export async function updateCanvasProject(
  id: number,
  input: {
    title?: string
    doc?: string
    cover?: string
    base_updated_at: number
  }
): Promise<{ updated_at: number }> {
  const res = await api.put(`${CANVAS_PROJECTS}/${id}`, input)
  if (!res.data?.success) throw new Error(res.data?.message || 'request failed')
  return res.data.data as { updated_at: number }
}

export async function deleteCanvasProject(id: number): Promise<void> {
  const res = await api.delete(`${CANVAS_PROJECTS}/${id}`)
  if (!res.data?.success) throw new Error(res.data?.message || 'request failed')
}

export async function listCanvasVersions(
  projectId: number
): Promise<CanvasVersionMeta[]> {
  const res = await api.get(`${CANVAS_PROJECTS}/${projectId}/versions`)
  if (!res.data?.success) return []
  return (res.data.data?.versions ?? []) as CanvasVersionMeta[]
}

export async function getCanvasVersion(
  projectId: number,
  versionId: number
): Promise<CanvasVersionRecord> {
  const res = await api.get(
    `${CANVAS_PROJECTS}/${projectId}/versions/${versionId}`
  )
  if (!res.data?.success) throw new Error(res.data?.message || 'request failed')
  return res.data.data as CanvasVersionRecord
}
