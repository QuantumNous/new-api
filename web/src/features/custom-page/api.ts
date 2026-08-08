import { api } from '@/lib/api'
import type { CustomPageResponse } from './types'

export async function getCustomPageContent() {
  const res = await api.get<CustomPageResponse>('/api/custom-page')
  return res.data
}
