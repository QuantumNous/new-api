import { api } from '@/lib/api'
import type { AboutResponse } from './types'

export async function getAboutContent() {
  const res = await api.get<AboutResponse>('/api/about')
  return res.data
}
