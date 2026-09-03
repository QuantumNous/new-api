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

import { API_ENDPOINTS } from './constants'
import type {
  GroupOption,
  ImageEditRequest,
  ImageGenerationRequest,
  ImageResponse,
  ModelOption,
} from './types'

async function relayFetch<T>(
  url: string,
  init: RequestInit,
  apiKey: string
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.headers as Record<string, string> | undefined),
      Authorization: `Bearer ${apiKey}`,
    },
  })
  const json = (await response.json().catch(() => ({}))) as {
    error?: { message?: string }
    message?: string
  }
  if (!response.ok) {
    throw new Error(
      json.error?.message || json.message || `HTTP ${response.status}`
    )
  }
  return json as T
}

export async function generateImages(
  payload: ImageGenerationRequest,
  apiKey: string
): Promise<ImageResponse> {
  return relayFetch<ImageResponse>(
    API_ENDPOINTS.IMAGES_GENERATIONS,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    apiKey
  )
}

export async function editImage(
  payload: ImageEditRequest,
  apiKey: string
): Promise<ImageResponse> {
  const form = new FormData()
  form.append('model', payload.model)
  form.append('prompt', payload.prompt)
  if (payload.size) form.append('size', payload.size)
  if (payload.n && payload.n > 1) form.append('n', String(payload.n))
  for (const image of payload.images) {
    form.append('image', image, image.name)
  }
  return relayFetch<ImageResponse>(
    API_ENDPOINTS.IMAGES_EDITS,
    { method: 'POST', body: form },
    apiKey
  )
}

export async function getAvailableModels(group: string): Promise<ModelOption[]> {
  const res = await api.get('/api/user/models', { params: { group } })
  const data = res.data?.data
  if (!Array.isArray(data)) return []
  return data.map((name: string) => ({ name }))
}

export async function getAvailableGroups(): Promise<GroupOption[]> {
  const res = await api.get('/api/user/self/groups')
  const data = res.data?.data
  if (!data || typeof data !== 'object') return []
  return Object.entries(data as Record<string, { desc?: string }>).map(
    ([name, info]) => ({ name, desc: info?.desc })
  )
}
