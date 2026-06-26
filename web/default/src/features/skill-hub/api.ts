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
import { api } from '@/lib/api'
import type {
  SkillHubForm,
  SkillHubListResponse,
  SkillHubSkill,
  SkillHubSkillResponse,
} from './types'

export async function listAdminSkillHubSkills(params?: {
  keyword?: string
  p?: number
  page_size?: number
}): Promise<SkillHubListResponse> {
  const res = await api.get('/api/admin/skill-hub/skills', { params })
  return res.data
}

export async function createSkillHubSkill(
  form: SkillHubForm
): Promise<SkillHubSkillResponse> {
  const res = await api.post('/api/admin/skill-hub/skills', formToPayload(form))
  return res.data
}

export async function updateSkillHubSkill(
  id: string,
  form: SkillHubForm
): Promise<SkillHubSkillResponse> {
  const res = await api.put(
    `/api/admin/skill-hub/skills/${encodeURIComponent(id)}`,
    formToPayload(form)
  )
  return res.data
}

export async function deleteSkillHubSkill(
  id: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(
    `/api/admin/skill-hub/skills/${encodeURIComponent(id)}`
  )
  return res.data
}

export async function setSkillHubSkillPublished(
  id: string,
  published: boolean
): Promise<SkillHubSkillResponse> {
  const action = published ? 'publish' : 'unpublish'
  const res = await api.post(
    `/api/admin/skill-hub/skills/${encodeURIComponent(id)}/${action}`
  )
  return res.data
}

export async function uploadSkillHubZip(
  file: File,
  form: Pick<SkillHubForm, 'id' | 'version'>
): Promise<{
  success: boolean
  message?: string
  data?: { url: string; object: string; size: number; checksum: string }
}> {
  const body = new FormData()
  body.append('file', file)
  body.append('skill_id', form.id)
  body.append('version', form.version)
  const res = await api.post('/api/admin/skill-hub/upload', body)
  return res.data
}

export async function uploadSkillHubIcon(
  file: File,
  form: Pick<SkillHubForm, 'id'>
): Promise<{
  success: boolean
  message?: string
  data?: { url: string; object: string; size: number; checksum: string }
}> {
  const body = new FormData()
  body.append('file', file)
  body.append('skill_id', form.id)
  const res = await api.post('/api/admin/skill-hub/upload-icon', body)
  return res.data
}

export function skillToForm(skill?: SkillHubSkill): SkillHubForm {
  return {
    id: skill?.id || '',
    name: skill?.name || '',
    description: skill?.description || '',
    version: skill?.version || '1.0.0',
    icon: skill?.icon || '',
    tags: cleanList(skill?.tags),
    verified: Boolean(skill?.verified),
    published: Boolean(skill?.published || skill?.status === 1),
    sort: skill?.sort || 0,
    sourceType: 'zip',
    sourceUrl: skill?.source?.url || '',
    sourceRef: skill?.source?.ref || '',
    sourceChecksum: skill?.source?.checksum || '',
  }
}

function formToPayload(form: SkillHubForm) {
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    version: form.version.trim(),
    icon: form.icon.trim(),
    tags: cleanList(form.tags),
    verified: form.verified,
    published: form.published,
    sort: Number(form.sort) || 0,
    source: {
      type: 'zip',
      url: form.sourceUrl.trim(),
      ref: form.sourceRef.trim(),
      checksum: form.sourceChecksum.trim(),
    },
  }
}

function cleanList(values?: string[]) {
  const seen = new Set<string>()
  const clean: string[] = []

  for (const value of values || []) {
    const item = value.trim()
    const key = item.toLowerCase()
    if (!item || seen.has(key)) continue
    seen.add(key)
    clean.push(item)
  }

  return clean
}
