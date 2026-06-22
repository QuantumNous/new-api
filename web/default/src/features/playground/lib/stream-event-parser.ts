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
import type { ChatCompletionChunk } from '../types'

type StreamErrorPayload = {
  error?: {
    message?: string
    code?: string
  }
}

export type ParsedStreamMessageEvent =
  | { type: 'delta'; reasoning?: string; content?: string }
  | { type: 'error'; message: string; code?: string }
  | { type: 'parse_error' }

export function parseStreamMessageEvent(
  data: string
): ParsedStreamMessageEvent {
  try {
    const parsed = JSON.parse(data) as ChatCompletionChunk & StreamErrorPayload

    if (parsed.error) {
      return {
        type: 'error',
        message: parsed.error.message || 'Request error occurred',
        code: parsed.error.code || undefined,
      }
    }

    const delta = parsed.choices?.[0]?.delta
    return {
      type: 'delta',
      reasoning: delta?.reasoning_content,
      content: delta?.content,
    }
  } catch {
    return { type: 'parse_error' }
  }
}
