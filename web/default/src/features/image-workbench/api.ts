import { api } from '@/lib/api'
import type { ImageWorkbenchRequest, ImageWorkbenchResponse } from './types'

export async function generateWorkbenchImages(
  payload: ImageWorkbenchRequest
): Promise<ImageWorkbenchResponse> {
  const res = await api.post('/pg/images/generations', payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
