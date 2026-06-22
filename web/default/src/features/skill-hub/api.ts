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
    author: skill?.author || '',
    icon: skill?.icon || '',
    tags: listToText(skill?.tags),
    verified: Boolean(skill?.verified),
    recommended: Boolean(skill?.recommended),
    published: Boolean(skill?.published || skill?.status === 1),
    sort: skill?.sort || 0,
    connectorMinVersion: skill?.compatibility?.connectorMinVersion || '',
    platforms: listToText(skill?.compatibility?.platforms),
    permissions: listToText(skill?.permissions),
    manifestEntry: skill?.manifest?.entry || 'SKILL.md',
    manifestPermissions: listToText(skill?.manifest?.permissions),
    manifestTools: listToText(skill?.manifest?.tools),
    sourceType: 'zip',
    sourceUrl: skill?.source?.url || '',
    sourceRef: skill?.source?.ref || '',
    sourceChecksum: skill?.source?.checksum || '',
    changelog: skill?.changelog || '',
  }
}

function formToPayload(form: SkillHubForm) {
  return {
    id: form.id.trim(),
    name: form.name.trim(),
    description: form.description.trim(),
    version: form.version.trim(),
    author: form.author.trim(),
    icon: form.icon.trim(),
    tags: textToList(form.tags),
    verified: form.verified,
    recommended: form.recommended,
    published: form.published,
    sort: Number(form.sort) || 0,
    compatibility: {
      connectorMinVersion: form.connectorMinVersion.trim(),
      platforms: textToList(form.platforms),
    },
    permissions: textToList(form.permissions),
    manifest: {
      entry: form.manifestEntry.trim() || 'SKILL.md',
      permissions: textToList(form.manifestPermissions),
      tools: textToList(form.manifestTools),
    },
    source: {
      type: 'zip',
      url: form.sourceUrl.trim(),
      ref: form.sourceRef.trim(),
      checksum: form.sourceChecksum.trim(),
    },
    changelog: form.changelog.trim(),
  }
}

function listToText(values?: string[]) {
  return Array.isArray(values) ? values.join(', ') : ''
}

function textToList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
