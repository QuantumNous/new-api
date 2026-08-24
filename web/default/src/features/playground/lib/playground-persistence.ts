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
import type {
  ChatCompletionRequest,
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundRecordPayload,
} from '../types'
import { getCurrentVersion } from './message-utils'
import { buildChatCompletionPayload } from './payload-builder'

export interface ActivePlaygroundTurn {
  recordId: string
  conversationId: string
  assistantMessageKey: string
  startedAt: number
  request: ChatCompletionRequest
  userMessage: Message
}

export function createActivePlaygroundTurn(
  conversationId: string,
  requestMessages: Message[],
  config: PlaygroundConfig,
  parameterEnabled: ParameterEnabled,
  minimalParameters: boolean,
  assistantMessageKey: string,
  now = Date.now()
): ActivePlaygroundTurn {
  const userMessage = [...requestMessages]
    .reverse()
    .find((message) => message.from === 'user')

  if (!userMessage) {
    throw new Error('Cannot persist a Playground turn without a user message')
  }

  return {
    recordId: crypto.randomUUID(),
    conversationId,
    assistantMessageKey,
    startedAt: now,
    request: buildChatCompletionPayload(
      requestMessages,
      config,
      parameterEnabled,
      { minimalParameters }
    ),
    userMessage,
  }
}

export function buildPlaygroundRecordPayload(
  active: ActivePlaygroundTurn,
  messages: Message[],
  stopped: boolean,
  completedAt = Date.now()
): PlaygroundRecordPayload {
  const assistantMessage = messages.find(
    (message) =>
      message.from === 'assistant' && message.key === active.assistantMessageKey
  )

  if (!assistantMessage) {
    throw new Error(
      'Cannot persist a Playground turn without an assistant message'
    )
  }

  const {
    model,
    group = '',
    messages: requestMessages,
    ...parameters
  } = active.request
  const isError = assistantMessage.status === 'error'

  return {
    record_id: active.recordId,
    conversation_id: active.conversationId,
    user_message: active.userMessage,
    request_messages: requestMessages,
    assistant_message: assistantMessage,
    reasoning_content: assistantMessage.reasoning?.content || '',
    input_text: getCurrentVersion(active.userMessage).content,
    output_text: getCurrentVersion(assistantMessage).content,
    model_name: model,
    group_name: group,
    parameters,
    status: isError ? 'error' : stopped ? 'stopped' : 'complete',
    error_code: isError ? assistantMessage.errorCode || '' : '',
    error_message: isError ? getCurrentVersion(assistantMessage).content : '',
    relay_request_id: '',
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    latency_ms: Math.max(0, completedAt - active.startedAt),
    messages_snapshot: messages,
    client_completed_at: completedAt,
  }
}

export async function drainPlaygroundOutbox(
  records: PlaygroundRecordPayload[],
  save: (record: PlaygroundRecordPayload) => Promise<void>
): Promise<PlaygroundRecordPayload[]> {
  for (let index = 0; index < records.length; index += 1) {
    try {
      await save(records[index])
    } catch {
      return records.slice(index)
    }
  }

  return []
}

export function removeDeliveredPlaygroundRecords(
  latestRecords: PlaygroundRecordPayload[],
  attemptedRecords: PlaygroundRecordPayload[],
  remainingRecords: PlaygroundRecordPayload[]
): PlaygroundRecordPayload[] {
  const deliveredCount = Math.max(
    0,
    attemptedRecords.length - remainingRecords.length
  )
  const deliveredIds = new Set(
    attemptedRecords.slice(0, deliveredCount).map((record) => record.record_id)
  )
  return latestRecords.filter((record) => !deliveredIds.has(record.record_id))
}

export interface PlaygroundConversationSnapshot {
  conversation_id: string
  messages: Message[]
}

export type PlaygroundRestoreResult =
  | {
      pendingRecords: PlaygroundRecordPayload[]
      shouldApplyCurrent: false
    }
  | {
      pendingRecords: PlaygroundRecordPayload[]
      shouldApplyCurrent: true
      current: PlaygroundConversationSnapshot | null
    }

interface PlaygroundRestoreOptions {
  preferLocal?: boolean
  retryCurrentAfter?: (attempt: number) => Promise<void>
}

function waitBeforeCurrentRetry(attempt: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, attempt * 250)
  })
}

export async function restorePlaygroundSession(
  pendingRecords: PlaygroundRecordPayload[],
  save: (record: PlaygroundRecordPayload) => Promise<void>,
  getCurrent: () => Promise<PlaygroundConversationSnapshot | null>,
  options: PlaygroundRestoreOptions = {}
): Promise<PlaygroundRestoreResult> {
  const remaining = await drainPlaygroundOutbox(pendingRecords, save)
  if (remaining.length > 0) {
    return {
      pendingRecords: remaining,
      shouldApplyCurrent: false,
    }
  }

  if (options.preferLocal) {
    return {
      pendingRecords: [],
      shouldApplyCurrent: false,
    }
  }

  const retryCurrentAfter = options.retryCurrentAfter ?? waitBeforeCurrentRetry
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return {
        pendingRecords: [],
        shouldApplyCurrent: true,
        current: await getCurrent(),
      }
    } catch {
      if (attempt < 3) await retryCurrentAfter(attempt)
    }
  }

  return {
    pendingRecords: [],
    shouldApplyCurrent: false,
  }
}
