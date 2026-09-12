import { api } from '@/lib/api'

import type { InternalKey } from './types'

interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export async function getInternalKeys(): Promise<ApiResponse<InternalKey[]>> {
  const res = await api.get('/api/internal_key/')
  return res.data
}

export async function createInternalKey(data: {
  key_id: string
  name: string
  status: number
  key?: string
}): Promise<ApiResponse<InternalKey>> {
  const res = await api.post('/api/internal_key/', data)
  return res.data
}

export async function updateInternalKey(data: {
  id: number
  name: string
  status: number
  key?: string
}): Promise<ApiResponse<InternalKey>> {
  const res = await api.put('/api/internal_key/', data)
  return res.data
}

export async function deleteInternalKey(id: number): Promise<ApiResponse> {
  const res = await api.delete(`/api/internal_key/${id}`)
  return res.data
}
