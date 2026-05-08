import { api, type ApiRequestConfig } from '@/lib/api'
import type { ImageWorkbenchRequest, ImageWorkbenchResponse } from './types'

export async function generateWorkbenchImages(
  payload: ImageWorkbenchRequest
): Promise<ImageWorkbenchResponse> {
  const config: ApiRequestConfig = {
    skipErrorHandler: true,
  }
  const res = await api.post('/pg/images/generations', payload, config)
  return res.data
}
