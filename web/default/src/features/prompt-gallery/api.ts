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
import {
  formDataToPayload,
  type ApiResponse,
  type PromptGalleryFormData,
  type PromptGalleryListData,
  type PromptLibraryAdminItem,
} from './types'

// Get paginated prompt gallery items (admin view, includes disabled)
export async function getPromptGalleryItems(params: {
  p?: number
  page_size?: number
  category?: string
  keyword?: string
}): Promise<ApiResponse<PromptGalleryListData>> {
  const search = new URLSearchParams()
  search.set('p', String(params.p ?? 1))
  search.set('page_size', String(params.page_size ?? 20))
  if (params.category) search.set('category', params.category)
  if (params.keyword) search.set('keyword', params.keyword)
  const res = await api.get(`/api/prompt-library/admin?${search.toString()}`)
  return res.data
}

// Create a prompt gallery item
export async function createPromptGalleryItem(
  form: PromptGalleryFormData
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.post(
    '/api/prompt-library/admin',
    formDataToPayload(form)
  )
  return res.data
}

// Update a prompt gallery item. PUT is full-replace on the backend, so pass
// the original row to preserve JSON data the form does not edit
// (output_json, captured_at, extra languages).
export async function updatePromptGalleryItem(
  id: number,
  form: PromptGalleryFormData,
  original?: PromptLibraryAdminItem
): Promise<ApiResponse<{ id: number }>> {
  const res = await api.put(
    `/api/prompt-library/admin/${id}`,
    formDataToPayload(form, original)
  )
  return res.data
}

// Toggle only the enabled flag; unlike the full-replace PUT this cannot
// clobber concurrent edits to content fields.
export async function setPromptGalleryItemEnabled(
  id: number,
  enabled: boolean
): Promise<ApiResponse<{ id: number; enabled: boolean }>> {
  const res = await api.put(`/api/prompt-library/admin/${id}/enabled`, {
    enabled,
  })
  return res.data
}

// Delete a prompt gallery item
export async function deletePromptGalleryItem(
  id: number
): Promise<ApiResponse<null>> {
  const res = await api.delete(`/api/prompt-library/admin/${id}`)
  return res.data
}
