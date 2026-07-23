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
import { z } from 'zod'

export const ASYNC_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-3-pro-image-preview',
  'gpt-image-2',
  'gpt-image-2-vip',
  'nano-banana-pro',
  'nano-banana-2-lite',
  'nano-banana-2',
  'nano-banana-fast',
] as const

export type AsyncImageModel = (typeof ASYNC_IMAGE_MODELS)[number]

export const asyncImageFormSchema = z.object({
  model: z.enum(ASYNC_IMAGE_MODELS),
  tokenId: z.string().min(1, 'Select an API key.'),
  prompt: z
    .string()
    .trim()
    .min(1, 'Enter a prompt.')
    .max(8000, 'Prompt must not exceed 8000 characters.'),
  size: z.string().min(1),
  quality: z.string().min(1),
})

export type AsyncImageFormValues = z.infer<typeof asyncImageFormSchema>

export type AsyncExecutionStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'failure'
  | 'uncertain'
  | 'cancelled'

export interface AsyncSubmitResponse {
  id: string
  status: AsyncExecutionStatus
  status_url: string
  result_url: string
}

export interface AsyncTaskError {
  phase: string
  code: string
  message: string
}

export interface AsyncTaskStatusResponse {
  id: string
  status: AsyncExecutionStatus
  progress: number
  created_at: number
  started_at?: number | null
  finished_at?: number | null
  error?: AsyncTaskError | null
}

export interface AsyncArtifact {
  content_type: string
  size_bytes: number
  sha256: string
  expires_at: number
  url: string
}

export interface AsyncTaskResultResponse {
  id: string
  status: AsyncExecutionStatus
  response?: {
    created?: number
    data?: Array<{
      url?: string
      revised_prompt?: string
    }>
  }
  artifacts: AsyncArtifact[]
}

export interface ActiveAsyncImageTask {
  submission: AsyncSubmitResponse
  request: AsyncImageFormValues
}

export interface AsyncApiErrorResponse {
  error?: {
    message?: string
    code?: string
  }
}
