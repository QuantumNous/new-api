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
  SkillHubDirectUploadInitResponse,
  SkillHubForm,
  SkillHubListResponse,
  SkillHubSkill,
  SkillHubSkillResponse,
  SkillHubTagListResponse,
  SkillHubTagResponse,
  SkillHubUploadResponse,
} from './types'

export async function listAdminSkillHubSkills(params?: {
  keyword?: string
  recommended?: boolean
  p?: number
  page_size?: number
}): Promise<SkillHubListResponse> {
  const res = await api.get('/api/admin/skill-hub/skills', { params })
  return res.data
}

export async function listSkillHubSkills(params?: {
  keyword?: string
  recommended?: boolean
  p?: number
  page_size?: number
}): Promise<SkillHubListResponse> {
  const res = await api.get('/api/skill-hub/skills', { params })
  return res.data
}

export async function listRecommendedSkillHubSkills(params?: {
  page_size?: number
}): Promise<SkillHubListResponse> {
  const res = await api.get('/api/skill-hub/skills/recommend', { params })
  return res.data
}

export async function listSkillHubSkillsByTags(
  tagIds: number[],
  params?: {
    keyword?: string
    recommended?: boolean
    p?: number
    page_size?: number
  }
): Promise<SkillHubListResponse> {
  const res = await api.get('/api/skill-hub/tags/skills', {
    params: withTagIds(tagIds, params),
  })
  return res.data
}

export async function listAdminSkillHubSkillsByTags(
  tagIds: number[],
  params?: {
    keyword?: string
    recommended?: boolean
    p?: number
    page_size?: number
  }
): Promise<SkillHubListResponse> {
  const res = await api.get('/api/admin/skill-hub/tags/skills', {
    params: withTagIds(tagIds, params),
  })
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

export async function listAdminSkillHubTags(params?: {
  keyword?: string
  p?: number
  page_size?: number
}): Promise<SkillHubTagListResponse> {
  const res = await api.get('/api/admin/skill-hub/tags', { params })
  return res.data
}

export async function listSkillHubTags(params?: {
  keyword?: string
  p?: number
  page_size?: number
}): Promise<SkillHubTagListResponse> {
  const res = await api.get('/api/skill-hub/tags', { params })
  return res.data
}

export async function createSkillHubTag(input: {
  name: string
  sort?: number
}): Promise<SkillHubTagResponse> {
  const res = await api.post('/api/admin/skill-hub/tags', input)
  return res.data
}

export async function deleteSkillHubTag(
  name: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(
    `/api/admin/skill-hub/tags/${encodeURIComponent(name)}`
  )
  return res.data
}

export async function uploadSkillHubZip(
  file: File,
  form: Pick<SkillHubForm, 'id' | 'version'>
): Promise<SkillHubUploadResponse> {
  return uploadSkillHubObject(file, 'zip', {
    skillId: form.id,
    version: form.version,
  })
}

export async function uploadSkillHubIcon(
  file: File,
  form: Pick<SkillHubForm, 'id'>
): Promise<SkillHubUploadResponse> {
  return uploadSkillHubObject(file, 'icon', { skillId: form.id })
}

export async function discardSkillHubUpload(uploadTicket: string) {
  if (!uploadTicket) return
  await api.post('/api/admin/skill-hub/direct-upload/discard', {
    uploadTicket,
  })
}

async function uploadSkillHubObject(
  file: File,
  kind: 'zip' | 'icon',
  input: { skillId: string; version?: string }
): Promise<SkillHubUploadResponse> {
  const initPayload = await initSkillHubDirectUpload(file, kind, input)
  if (!initPayload.success || !initPayload.data) {
    return {
      success: false,
      message: initPayload.message || 'Failed to upload file',
    }
  }
  try {
    await putSkillHubObject(initPayload.data, file)
    const res = await api.post('/api/admin/skill-hub/direct-upload/complete', {
      uploadTicket: initPayload.data.uploadTicket,
    })
    const payload = res.data as SkillHubUploadResponse
    if (payload.success && payload.data) {
      payload.data.uploadTicket = initPayload.data.uploadTicket
    }
    return payload
  } catch (error) {
    await discardSkillHubUpload(initPayload.data.uploadTicket).catch(
      () => undefined
    )
    throw error
  }
}

async function initSkillHubDirectUpload(
  file: File,
  kind: 'zip' | 'icon',
  input: { skillId: string; version?: string }
): Promise<SkillHubDirectUploadInitResponse> {
  const res = await api.post('/api/admin/skill-hub/direct-upload/init', {
    kind,
    skillId: input.skillId,
    version: input.version || '',
    fileName: file.name,
    size: file.size,
  })
  return res.data
}

function putSkillHubObject(
  upload: NonNullable<SkillHubDirectUploadInitResponse['data']>,
  file: File
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(upload.uploadMethod || 'PUT', upload.uploadUrl)
    Object.entries(upload.uploadHeaders || {}).forEach(([key, value]) => {
      if (value) xhr.setRequestHeader(key, value)
    })
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      reject(new Error('Failed to upload file'))
    }
    xhr.onerror = () => reject(new Error('Failed to upload file'))
    xhr.onabort = () => reject(new Error('Failed to upload file'))
    xhr.send(file)
  })
}

export function skillToForm(skill?: SkillHubSkill): SkillHubForm {
  return {
    id: skill?.id || '',
    name: skill?.name || '',
    description: skill?.description || '',
    version: skill?.version || '1.0.0',
    author: skill?.author || '',
    icon: skill?.icon || '',
    tags: cleanList(skill?.tags),
    verified: Boolean(skill?.verified),
    recommended: Boolean(skill?.recommended),
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
    author: form.author.trim(),
    icon: form.icon.trim(),
    tags: cleanList(form.tags),
    verified: form.verified,
    recommended: form.recommended,
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

function withTagIds(
  tagIds: number[],
  params?: {
    keyword?: string
    recommended?: boolean
    p?: number
    page_size?: number
  }
) {
  return {
    ...params,
    tag_ids: tagIds.filter((id) => Number.isInteger(id) && id > 0).join(','),
  }
}
