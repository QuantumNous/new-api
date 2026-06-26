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
import type { UsageLog } from '../data/schema'
import type { LogOtherData } from '../types'

export type LogMediaPreview =
  | { kind: 'image'; url: string; taskId?: string; errorMessage?: string; errorCode?: string }
  | { kind: 'video'; url: string; taskId: string }

export function isValidMediaPreviewURL(url: string): boolean {
  const u = url.trim()
  if (!u) return false
  if (u.startsWith('data:image')) return true
  if (u.startsWith('http://') || u.startsWith('https://')) return true
  return u.startsWith('/')
}

export function isLogMediaImageModel(modelName: string): boolean {
  const model = modelName.trim().toLowerCase()
  return model.startsWith('gpt-image-2')
}

export function isLogMediaVideoModel(modelName: string): boolean {
  const model = modelName.trim().toLowerCase()
  return model === 'sora-2' || model === 'sora-2-pro' || model.startsWith('sora-2-')
}

export function getLogMediaPreview(
  log: UsageLog,
  other: LogOtherData | null
): LogMediaPreview | null {
  if (!other || log.type !== 2) return null

  const modelName = (log.model_name || '').trim()
  const resultURL = other.result_url?.trim()
  const taskId = other.task_id?.trim()
  const taskFailReason = other.task_fail_reason?.trim()
  const taskFailCode = other.task_fail_code?.trim()

  if (isLogMediaImageModel(modelName)) {
    if (resultURL && isValidMediaPreviewURL(resultURL)) {
      return { kind: 'image', url: resultURL, taskId: taskId || undefined }
    }
    if (taskId && (resultURL || other.request_data || taskFailReason)) {
      const legacyInvalidURL =
        resultURL && !isValidMediaPreviewURL(resultURL) ? resultURL : undefined
      return {
        kind: 'image',
        url: '',
        taskId,
        errorMessage: taskFailReason || legacyInvalidURL,
        errorCode: taskFailCode || undefined,
      }
    }
    return null
  }

  if (isLogMediaVideoModel(modelName)) {
    if (resultURL && isValidMediaPreviewURL(resultURL)) {
      return { kind: 'video', url: resultURL, taskId: taskId || '' }
    }
    if (taskId && (log.use_time ?? 0) > 0) {
      return { kind: 'video', url: `/v1/videos/${taskId}/content`, taskId }
    }
  }

  return null
}
