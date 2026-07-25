/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import { api } from '@/lib/api'

export type InspirationCategory = {
  id: number
  slug: string
  name: string
  description: string
  status: 'active' | 'archived'
  sort_order: number
}

export type InspirationTemplate = {
  id: number
  category_id?: number
  category_slug: string
  slug: string
  title: string
  description: string
  modality: string
  status?: string
  featured: boolean
  sort_order?: number
  version_id: number
  draft_version_id?: number | null
  published_version_id?: number | null
}

export type InspirationVersion = {
  id: number
  version: number
  state: 'draft' | 'released'
  prompt_template: string
  negative_prompt: string
  explanation: string
  tags_json?: string
  variables_json?: string
  model_policy_json?: string
  parameters_json?: string
  covers_json?: string
  examples_json?: string
  created_at: number
  released_at?: number | null
}

export type VersionInput = {
  prompt_template: string
  negative_prompt: string
  explanation: string
  tags: unknown[]
  variables: unknown[]
  model_policy: Record<string, unknown>
  parameters: Record<string, unknown>
  covers: Record<string, unknown>
  examples: unknown[]
}

type TemplateDetail = {
  template: InspirationTemplate
  versions: InspirationVersion[]
}

const base = '/api/playground/inspiration/admin'

export async function listCategories(): Promise<InspirationCategory[]> {
  const response = await api.get(`${base}/categories`)
  return response.data.data ?? []
}

export async function listTemplates(params: {
  category?: string
  modality?: string
}): Promise<InspirationTemplate[]> {
  const response = await api.get(`${base}/templates`, {
    params: { ...params, page: 1, page_size: 100 },
  })
  return response.data.data?.items ?? []
}

export async function getTemplate(id: number): Promise<TemplateDetail> {
  const response = await api.get(`${base}/templates/${id}`)
  return response.data.data
}

export async function createCategory(data: Partial<InspirationCategory>) {
  return api.post(`${base}/categories`, data)
}
export async function updateCategory(
  id: number,
  data: Partial<InspirationCategory>
) {
  return api.patch(`${base}/categories/${id}`, data)
}
export async function archiveCategory(id: number) {
  return api.post(`${base}/categories/${id}/archive`)
}
export async function createTemplate(data: Partial<InspirationTemplate>) {
  return api.post(`${base}/templates`, data)
}
export async function updateTemplate(
  id: number,
  data: Partial<InspirationTemplate>
) {
  return api.patch(`${base}/templates/${id}`, data)
}
export async function saveDraft(
  templateId: number,
  versionId: number | null,
  data: VersionInput
) {
  if (versionId) {
    return api.patch(`${base}/templates/${templateId}/draft/${versionId}`, data)
  }
  return api.post(`${base}/templates/${templateId}/draft`, data)
}
export async function publishDraft(id: number) {
  return api.post(`${base}/templates/${id}/publish`)
}
export async function activateVersion(id: number, versionId: number) {
  return api.post(`${base}/templates/${id}/versions/${versionId}/activate`)
}
export async function setArchived(id: number, archived: boolean) {
  return api.post(`${base}/templates/${id}/${archived ? 'archive' : 'restore'}`)
}

export function parseVersion(version?: InspirationVersion): VersionInput {
  const parse = <T>(value: string | undefined, fallback: T): T => {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return {
    prompt_template: version?.prompt_template ?? '',
    negative_prompt: version?.negative_prompt ?? '',
    explanation: version?.explanation ?? '',
    tags: parse(version?.tags_json, []),
    variables: parse(version?.variables_json, []),
    model_policy: parse(version?.model_policy_json, {
      recommended: [],
      compatible: [],
    }),
    parameters: parse(version?.parameters_json, {}),
    covers: parse(version?.covers_json, {}),
    examples: parse(version?.examples_json, []),
  }
}
