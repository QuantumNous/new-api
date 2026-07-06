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
  ClientRelease,
  ClientReleaseChannel,
  ClientReleaseDirectUploadInitResponse,
  ClientReleaseForm,
  ClientReleaseListResponse,
  ClientReleaseResponse,
  ClientReleaseUploadResponse,
} from './types'

export async function listAdminClientReleases(params?: {
  keyword?: string
  platform?: string
  arch?: string
  channel?: string
  p?: number
  page_size?: number
}): Promise<ClientReleaseListResponse> {
  const res = await api.get('/api/admin/client-releases/', { params })
  return res.data
}

export async function createClientRelease(
  form: ClientReleaseForm
): Promise<ClientReleaseResponse> {
  const res = await api.post('/api/admin/client-releases/', formToPayload(form))
  return res.data
}

export async function updateClientRelease(
  id: number,
  form: ClientReleaseForm
): Promise<ClientReleaseResponse> {
  const res = await api.put(
    `/api/admin/client-releases/${encodeURIComponent(id)}`,
    formToPayload(form)
  )
  return res.data
}

export async function deleteClientRelease(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(
    `/api/admin/client-releases/${encodeURIComponent(id)}`
  )
  return res.data
}

export async function setClientReleasePublished(
  id: number,
  published: boolean
): Promise<ClientReleaseResponse> {
  const action = published ? 'publish' : 'unpublish'
  const res = await api.post(
    `/api/admin/client-releases/${encodeURIComponent(id)}/${action}`
  )
  return res.data
}

export async function uploadClientRelease(
  file: File,
  form: Pick<ClientReleaseForm, 'version' | 'platform' | 'arch' | 'channel'>
): Promise<ClientReleaseUploadResponse> {
  const initPayload = await initClientReleaseDirectUpload(file, form)
  if (!initPayload.success || !initPayload.data) {
    return {
      success: false,
      message: initPayload.message || 'Failed to upload package',
    }
  }
  try {
    await putClientReleaseObject(initPayload.data, file)
    const res = await api.post(
      '/api/admin/client-releases/direct-upload/complete',
      {
        uploadTicket: initPayload.data.uploadTicket,
      }
    )
    const payload = res.data as ClientReleaseUploadResponse
    if (payload.success && payload.data) {
      payload.data.uploadTicket = initPayload.data.uploadTicket
    }
    return payload
  } catch (error) {
    await discardClientReleaseUpload(initPayload.data.uploadTicket).catch(
      () => undefined
    )
    throw error
  }
}

export async function discardClientReleaseUpload(uploadTicket: string) {
  if (!uploadTicket) return
  await api.post('/api/admin/client-releases/direct-upload/discard', {
    uploadTicket,
  })
}

async function initClientReleaseDirectUpload(
  file: File,
  form: Pick<ClientReleaseForm, 'version' | 'platform' | 'arch' | 'channel'>
): Promise<ClientReleaseDirectUploadInitResponse> {
  const res = await api.post('/api/admin/client-releases/direct-upload/init', {
    fileName: file.name,
    size: file.size,
    version: form.version,
    platform: form.platform,
    arch: form.arch,
    channel: form.channel,
  })
  return res.data
}

function putClientReleaseObject(
  upload: NonNullable<ClientReleaseDirectUploadInitResponse['data']>,
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
      reject(new Error('Failed to upload package'))
    }
    xhr.onerror = () => reject(new Error('Failed to upload package'))
    xhr.onabort = () => reject(new Error('Failed to upload package'))
    xhr.send(file)
  })
}

export function clientReleaseToForm(
  release?: ClientRelease
): ClientReleaseForm {
  return {
    version: release?.version || '',
    platform: release?.platform || 'windows',
    arch: release?.arch || 'x64',
    channel: normalizeClientReleaseChannel(release?.channel),
    fileName: release?.fileName || '',
    objectKey: release?.objectKey || '',
    size: release?.size || 0,
    sha256: release?.sha256 || '',
    sha512: release?.sha512 || '',
    releaseNotes: release?.releaseNotes || '',
    minVersion: release?.minVersion || '',
    forced: Boolean(release?.forced),
    published: Boolean(release?.published || release?.status === 1),
  }
}

function normalizeClientReleaseChannel(channel?: string): ClientReleaseChannel {
  return channel === 'beta' ? 'beta' : 'stable'
}

function formToPayload(form: ClientReleaseForm) {
  return {
    version: form.version.trim(),
    platform: form.platform,
    arch: form.arch,
    channel: form.channel.trim() || 'stable',
    fileName: form.fileName.trim(),
    objectKey: form.objectKey.trim(),
    size: Number(form.size) || 0,
    sha256: form.sha256.trim(),
    sha512: form.sha512.trim(),
    releaseNotes: form.releaseNotes.trim(),
    minVersion: form.minVersion.trim(),
    forced: form.forced,
    published: form.published,
  }
}
