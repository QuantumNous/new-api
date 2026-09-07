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

import { IMAGE_RATIO_OPTIONS } from './lib/drawing'
import type {
  DrawingBatch,
  DrawingTemplate,
  DrawingRequest,
  DrawingSettings,
} from './types'

export async function getDrawingSettings(): Promise<DrawingSettings> {
  return (await api.get('/pg/drawing/settings')).data
}
export async function getDrawingBatches(): Promise<DrawingBatch[]> {
  return (await api.get('/pg/drawing/batches')).data
}
export async function createDrawing(
  request: DrawingRequest,
  submissionId: string
): Promise<DrawingBatch> {
  const form = new FormData()
  form.append(
    'request',
    JSON.stringify({
      submission_id: submissionId,
      expected_agent_price_version: request.expectedAgentPriceVersion,
      model: request.model,
      group: request.group,
      prompt: request.prompt,
      ratio: IMAGE_RATIO_OPTIONS.find((option) => option.size === request.size)
        ?.ratio,
      count: request.count ?? 1,
      items: request.items,
    })
  )
  if (request.image) form.append('image', request.image)
  return (
    await api.post('/pg/drawing/batches', form, { skipErrorHandler: true })
  ).data
}
export async function getDrawingTemplates(): Promise<DrawingTemplate[]> {
  return (await api.get('/pg/drawing/templates', { skipErrorHandler: true }))
    .data
}
export async function saveDrawingTemplate(template: {
  id?: string
  name: string
  prompt: string
}): Promise<DrawingTemplate> {
  const data = { name: template.name, prompt: template.prompt }
  if (template.id) {
    return (
      await api.put(`/pg/drawing/templates/${template.id}`, data, {
        skipErrorHandler: true,
      })
    ).data
  }
  return (
    await api.post('/pg/drawing/templates', data, { skipErrorHandler: true })
  ).data
}
export async function deleteDrawingTemplate(id: string): Promise<void> {
  await api.delete(`/pg/drawing/templates/${id}`, { skipErrorHandler: true })
}
export async function getDrawingImage(
  id: string,
  signal?: AbortSignal
): Promise<Blob> {
  return (
    await api.get(`/pg/drawing/images/${id}`, {
      responseType: 'blob',
      disableDuplicate: true,
      signal,
      skipErrorHandler: true,
    })
  ).data
}
export async function getDrawingZip(id: string): Promise<Blob> {
  return (
    await api.get(`/pg/drawing/batches/${id}/download`, {
      responseType: 'blob',
      skipErrorHandler: true,
      timeout: 120000,
    })
  ).data
}
export function drawingErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'response' in error) {
    const response = error.response as {
      data?: { error?: { message?: string }; message?: string }
    }
    return response?.data?.error?.message || response?.data?.message || fallback
  }
  return error instanceof Error ? error.message : fallback
}
