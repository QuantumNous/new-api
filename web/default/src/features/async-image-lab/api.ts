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
import axios from 'axios'

import { api } from '@/lib/api'

import type {
  AsyncApiErrorResponse,
  AsyncImageFormValues,
  AsyncSubmitResponse,
  AsyncTaskResultResponse,
  AsyncTaskStatusResponse,
} from './types'

function tokenRequestConfig(apiKey: string) {
  return {
    headers: { Authorization: `Bearer ${apiKey}` },
    skipBusinessError: true,
    skipErrorHandler: true,
    skipAuthReset: true,
  }
}

export async function submitAsyncImageTask(
  values: AsyncImageFormValues,
  apiKey: string
): Promise<AsyncSubmitResponse> {
  const response = await api.post<AsyncSubmitResponse>(
    '/v1/async/images/generations',
    {
      model: values.model,
      prompt: values.prompt,
      n: 1,
      size: values.size,
      quality: values.quality,
    },
    {
      ...tokenRequestConfig(apiKey),
      headers: {
        ...tokenRequestConfig(apiKey).headers,
        'Idempotency-Key': crypto.randomUUID(),
      },
    }
  )
  return response.data
}

export async function getAsyncImageTask(
  taskId: string,
  apiKey: string
): Promise<AsyncTaskStatusResponse> {
  const response = await api.get<AsyncTaskStatusResponse>(
    `/v1/async/tasks/${encodeURIComponent(taskId)}`,
    {
      ...tokenRequestConfig(apiKey),
      disableDuplicate: true,
    }
  )
  return response.data
}

export async function getAsyncImageResult(
  taskId: string,
  apiKey: string
): Promise<AsyncTaskResultResponse> {
  const response = await api.get<AsyncTaskResultResponse>(
    `/v1/async/tasks/${encodeURIComponent(taskId)}/result?include_upstream=false`,
    {
      ...tokenRequestConfig(apiKey),
      disableDuplicate: true,
    }
  )
  return response.data
}

export function getAsyncApiErrorMessage(error: unknown): string | undefined {
  if (!axios.isAxiosError<AsyncApiErrorResponse>(error)) {
    return error instanceof Error ? error.message : undefined
  }
  return error.response?.data.error?.message || error.message
}
