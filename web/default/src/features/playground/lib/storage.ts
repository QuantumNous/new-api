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
import { STORAGE_KEYS } from '../constants'
import type {
  Message,
  ParameterEnabled,
  PlaygroundConfig,
  PlaygroundRecordPayload,
} from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

function scopedKey(base: string, userId: number): string {
  return `${base}:v2:${userId}`
}

function isValidUserId(userId: number): boolean {
  return Number.isInteger(userId) && userId > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function isPendingRecord(value: unknown): value is PlaygroundRecordPayload {
  if (!isRecord(value)) return false
  const isStatusValid =
    value.status === 'complete' ||
    value.status === 'error' ||
    value.status === 'stopped'
  const isNonNegativeInteger = (candidate: unknown) =>
    Number.isInteger(candidate) && Number(candidate) >= 0

  return (
    typeof value.record_id === 'string' &&
    value.record_id.length > 0 &&
    typeof value.conversation_id === 'string' &&
    value.conversation_id.length > 0 &&
    isRecord(value.user_message) &&
    Array.isArray(value.request_messages) &&
    isRecord(value.assistant_message) &&
    typeof value.reasoning_content === 'string' &&
    typeof value.input_text === 'string' &&
    typeof value.output_text === 'string' &&
    typeof value.model_name === 'string' &&
    typeof value.group_name === 'string' &&
    isRecord(value.parameters) &&
    isStatusValid &&
    typeof value.error_code === 'string' &&
    typeof value.error_message === 'string' &&
    typeof value.relay_request_id === 'string' &&
    isNonNegativeInteger(value.prompt_tokens) &&
    isNonNegativeInteger(value.completion_tokens) &&
    isNonNegativeInteger(value.total_tokens) &&
    isNonNegativeInteger(value.latency_ms) &&
    Array.isArray(value.messages_snapshot) &&
    Number.isInteger(value.client_completed_at) &&
    Number(value.client_completed_at) > 0
  )
}

/**
 * Load playground config from localStorage
 */
export function loadConfig(userId: number): Partial<PlaygroundConfig> {
  if (!isValidUserId(userId)) return {}
  try {
    const saved = localStorage.getItem(scopedKey(STORAGE_KEYS.CONFIG, userId))
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      return isRecord(parsed) ? parsed : {}
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(
  userId: number,
  config: Partial<PlaygroundConfig>
): void {
  if (!isValidUserId(userId)) return
  try {
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.CONFIG, userId),
      JSON.stringify(config)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(
  userId: number
): Partial<ParameterEnabled> {
  if (!isValidUserId(userId)) return {}
  try {
    const saved = localStorage.getItem(
      scopedKey(STORAGE_KEYS.PARAMETER_ENABLED, userId)
    )
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      return isRecord(parsed) ? parsed : {}
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  userId: number,
  parameterEnabled: Partial<ParameterEnabled>
): void {
  if (!isValidUserId(userId)) return
  try {
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.PARAMETER_ENABLED, userId),
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(userId: number): Message[] | null {
  if (!isValidUserId(userId)) return null
  try {
    const saved = localStorage.getItem(scopedKey(STORAGE_KEYS.MESSAGES, userId))
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(userId, sanitized)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

/**
 * Save messages to localStorage
 */
export function saveMessages(userId: number, messages: Message[]): void {
  if (!isValidUserId(userId)) return
  try {
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.MESSAGES, userId),
      JSON.stringify(messages)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Load the active conversation id from localStorage
 */
export function loadConversationId(userId: number): string | null {
  if (!isValidUserId(userId)) return null
  try {
    const saved = localStorage.getItem(
      scopedKey(STORAGE_KEYS.CONVERSATION, userId)
    )
    return saved?.trim() || null
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load conversation id:', error)
    return null
  }
}

/**
 * Save the active conversation id to localStorage
 */
export function saveConversationId(
  userId: number,
  conversationId: string
): void {
  if (!isValidUserId(userId)) return
  try {
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.CONVERSATION, userId),
      conversationId
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save conversation id:', error)
  }
}

/**
 * Load terminal records that still need to be saved by the server
 */
export function loadPendingRecords(userId: number): PlaygroundRecordPayload[] {
  if (!isValidUserId(userId)) return []
  try {
    const saved = localStorage.getItem(
      scopedKey(STORAGE_KEYS.PENDING_RECORDS, userId)
    )
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every(isPendingRecord)) return []
    return parsed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load pending Playground records:', error)
    return []
  }
}

/**
 * Enqueue a record, replacing a matching id without changing FIFO order
 */
export function enqueuePendingRecord(
  userId: number,
  payload: PlaygroundRecordPayload
): boolean {
  const pending = loadPendingRecords(userId)
  const existingIndex = pending.findIndex(
    (record) => record.record_id === payload.record_id
  )
  if (existingIndex >= 0) {
    pending[existingIndex] = payload
  } else {
    pending.push(payload)
  }
  return replacePendingRecords(userId, pending)
}

/**
 * Replace the complete pending record queue
 */
export function replacePendingRecords(
  userId: number,
  payloads: PlaygroundRecordPayload[]
): boolean {
  if (!isValidUserId(userId)) return false
  try {
    localStorage.setItem(
      scopedKey(STORAGE_KEYS.PENDING_RECORDS, userId),
      JSON.stringify(payloads)
    )
    return true
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save pending Playground records:', error)
    return false
  }
}

/**
 * Remove all versioned Playground state for one user
 */
export function clearUserPlaygroundData(userId: number): void {
  if (!isValidUserId(userId)) return
  try {
    const keys = [
      STORAGE_KEYS.CONFIG,
      STORAGE_KEYS.PARAMETER_ENABLED,
      STORAGE_KEYS.MESSAGES,
      STORAGE_KEYS.CONVERSATION,
      STORAGE_KEYS.PENDING_RECORDS,
    ]
    keys.forEach((key) => localStorage.removeItem(scopedKey(key, userId)))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear Playground data:', error)
  }
}
