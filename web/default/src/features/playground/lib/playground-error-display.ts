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
import i18next from 'i18next'
import {
  extractModelNameFromPriceNotConfiguredMessage,
  isModelPriceNotConfiguredMessage,
} from '@/features/channels/lib/channel-error-display'

/** Real billing routes (platform configuration center). */
export const PLAYGROUND_BILLING_MODEL_PRICING_PATH =
  '/system-settings/billing/model-pricing'
export const PLAYGROUND_BILLING_GROUP_PRICING_PATH =
  '/system-settings/billing/group-pricing'

const REQUEST_ID_RE =
  /(?:request\s*id|请求编号)[:\s#]*([A-Za-z0-9_.-]+)/i

const EN_MODEL_PRICE_TAIL_RE =
  /\bModel\s+.+\s+price not configured[\s\S]*$/i

const UPSTREAM_REQUEST_ERROR_MARKERS = [
  /upstream\s+error/i,
  /do\s+request\s+failed/i,
  /upstream.*request.*failed/i,
  /failed to call upstream/i,
  /dial\s+tcp/i,
  /connection\s+refused/i,
  /no\s+such\s+host/i,
  /context\s+deadline\s+exceeded/i,
  /i\/o\s+timeout/i,
] as const

export type PlaygroundErrorCode =
  | 'model_price_error'
  | 'upstream_request_error'
  | string
  | undefined

export function isUpstreamRequestErrorMessage(message: string): boolean {
  const trimmed = (message ?? '').trim()
  if (!trimmed) return false
  return UPSTREAM_REQUEST_ERROR_MARKERS.some((pattern) => pattern.test(trimmed))
}

export function extractPlaygroundRequestId(message: string): string | null {
  const match = message.match(REQUEST_ID_RE)
  return match?.[1]?.trim() ?? null
}

/** Remove legacy prefixes and trailing English duplicate from backend payloads. */
export function stripLegacyPlaygroundErrorNoise(raw: string): string {
  let text = (raw ?? '').trim()
  text = text.replace(/^Request error occurred:\s*/i, '')
  const enStart = text.search(EN_MODEL_PRICE_TAIL_RE)
  if (enStart > 0) {
    text = text.slice(0, enStart).trim()
  }
  return text.replace(/[;；]\s*$/, '').trim()
}

export function resolvePlaygroundErrorCode(
  message: string,
  errorCode?: string
): PlaygroundErrorCode {
  if (errorCode === 'model_price_error') return errorCode
  if (errorCode === 'upstream_request_error') return errorCode
  if (isModelPriceNotConfiguredMessage(message)) return 'model_price_error'
  if (isUpstreamRequestErrorMessage(message)) return 'upstream_request_error'
  return errorCode
}

/**
 * Maps API/stream errors to productized Chinese copy for the chat UI.
 * Does not change API payloads or error codes.
 */
function appendPlaygroundRequestId(
  bodyLines: string[],
  requestId: string | null
): string {
  const lines = [...bodyLines]
  if (requestId) {
    lines.push(i18next.t('Playground request id label', { id: requestId }))
  }
  return lines.join('\n\n')
}

export function formatPlaygroundChatErrorMessage(
  rawMessage: string,
  errorCode?: string
): string {
  const noiseStripped = stripLegacyPlaygroundErrorNoise(rawMessage)
  const code = resolvePlaygroundErrorCode(noiseStripped || rawMessage, errorCode)
  const requestId = extractPlaygroundRequestId(rawMessage)

  if (import.meta.env.DEV && rawMessage.trim()) {
    // eslint-disable-next-line no-console
    console.debug('[playground] Chat error (raw):', rawMessage, {
      errorCode: code ?? errorCode,
      requestId,
    })
  }

  if (code === 'model_price_error') {
    const model = extractModelNameFromPriceNotConfiguredMessage(
      noiseStripped || rawMessage
    )
    return appendPlaygroundRequestId(
      [
        model
          ? i18next.t('Playground model price error body with model', { model })
          : i18next.t('Playground model price error body'),
        i18next.t('Playground model price error self-use note'),
      ],
      requestId
    )
  }

  if (code === 'upstream_request_error') {
    return appendPlaygroundRequestId(
      [i18next.t('Playground upstream request error body')],
      requestId
    )
  }

  return appendPlaygroundRequestId(
    [i18next.t('Playground generic service error body')],
    requestId
  )
}

export function getPlaygroundErrorTitle(errorCode?: string | null): string {
  if (errorCode === 'model_price_error') {
    return i18next.t('Model Price Not Configured')
  }
  return i18next.t('Playground service request error title')
}

export type PlaygroundErrorDisplayParts = {
  paragraphs: string[]
  requestId: string | null
}

/** Split formatted message for title card layout (request id as secondary line). */
export function parsePlaygroundErrorDisplay(
  formattedContent: string
): PlaygroundErrorDisplayParts {
  const lines = formattedContent.split(/\n\n+/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) {
    return { paragraphs: [], requestId: null }
  }
  const last = lines[lines.length - 1]
  const requestIdMatch = last.match(
    /^(?:请求编号|Request ID)[:：]\s*(.+)$/i
  )
  if (requestIdMatch) {
    return {
      paragraphs: lines.slice(0, -1),
      requestId: requestIdMatch[1].trim(),
    }
  }
  return { paragraphs: lines, requestId: null }
}
