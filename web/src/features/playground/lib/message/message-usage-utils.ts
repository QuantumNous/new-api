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
import type { MessageUsageTokens } from '../../types'

/**
 * Token counts of an OpenAI-style `usage` object, or null when the object is
 * missing or its counts are not numbers.
 */
export function parseUsageTokens(usage: unknown): MessageUsageTokens | null {
  if (!usage || typeof usage !== 'object') return null
  const record = usage as Record<string, unknown>
  const promptTokens = record.prompt_tokens
  const completionTokens = record.completion_tokens
  if (
    typeof promptTokens !== 'number' ||
    typeof completionTokens !== 'number'
  ) {
    return null
  }
  return { promptTokens, completionTokens }
}

/** Usage of a stream chunk; only the final chunk carries it. */
export function parseStreamUsage(data: string): MessageUsageTokens | null {
  try {
    return parseUsageTokens((JSON.parse(data) as { usage?: unknown }).usage)
  } catch {
    return null
  }
}

/**
 * Quota a test took from the wallet: the balance drop between before and
 * after. An unknown or rising balance counts as 0.
 */
export function computeTestCostQuota(
  balanceBefore: number | undefined,
  balanceAfter: number | undefined
): number {
  if (
    typeof balanceBefore !== 'number' ||
    typeof balanceAfter !== 'number' ||
    !Number.isFinite(balanceBefore) ||
    !Number.isFinite(balanceAfter)
  ) {
    return 0
  }
  return Math.max(0, balanceBefore - balanceAfter)
}
