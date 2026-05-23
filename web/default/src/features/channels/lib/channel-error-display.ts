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

const MODEL_PRICE_NOT_CONFIGURED_MARKERS = [
  /price not configured/i,
  /的价格未配置/,
  /Group\s*&\s*Model\s*Pricing/i,
  /分组与模型定价/,
  /System Settings/i,
  /Operation Settings/i,
  /系统设置/,
  /运营设置/,
] as const

const MODEL_NAME_ZH_RE = /模型\s+(.+?)\s+的价格未配置/
const MODEL_NAME_EN_RE = /Model\s+(.+?)\s+price not configured/i

/** Platform configuration center → Billing & Settlement → Model Pricing */
export const CHANNEL_BILLING_MODEL_PRICING_PATH =
  '/system-settings/billing/model-pricing'

/** Platform configuration center → Billing & Settlement → Group Pricing */
export const CHANNEL_BILLING_GROUP_PRICING_PATH =
  '/system-settings/billing/group-pricing'

export function isModelPriceNotConfiguredMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed) return false
  return MODEL_PRICE_NOT_CONFIGURED_MARKERS.some((pattern) =>
    pattern.test(trimmed)
  )
}

export function extractModelNameFromPriceNotConfiguredMessage(
  message: string
): string | null {
  const trimmed = message.trim()
  if (!trimmed) return null

  const zhMatch = trimmed.match(MODEL_NAME_ZH_RE)
  if (zhMatch?.[1]) return zhMatch[1].trim()

  const enMatch = trimmed.match(MODEL_NAME_EN_RE)
  if (enMatch?.[1]) return enMatch[1].trim()

  return null
}

/**
 * Maps legacy backend channel errors to productized ops-center navigation hints.
 * Unknown messages are returned unchanged.
 */
export function formatChannelErrorMessageForOpsCenter(message: string): string {
  const trimmed = (message ?? '').trim()
  if (!trimmed || !isModelPriceNotConfiguredMessage(trimmed)) {
    return trimmed
  }

  const model = extractModelNameFromPriceNotConfiguredMessage(trimmed)
  if (model) {
    return i18next.t(
      'Model "{{model}}" billing unit price is not configured. Open Platform Configuration Center → Billing & Settlement → Model Pricing to configure pricing for this model. For self-use mode, check Platform Configuration Center → Model Resources & Routing → Global Model Configuration.',
      { model }
    )
  }

  return i18next.t(
    'Model billing unit price is not configured. Open Platform Configuration Center → Billing & Settlement → Model Pricing to configure pricing, then try again.'
  )
}

/**
 * Formats API error text for channel toasts; falls back when message is empty.
 */
export function formatChannelToastError(
  message: string | undefined | null,
  fallback?: string
): string {
  const raw = (message ?? '').trim()
  const base = raw || (fallback ?? '').trim()
  if (!base) return fallback ?? ''
  return formatChannelErrorMessageForOpsCenter(base)
}

export function formatChannelApiError(
  error: unknown,
  fallback: string
): string {
  const err = error as { response?: { data?: { message?: string } } }
  const message = err?.response?.data?.message
  return formatChannelToastError(message, fallback)
}
