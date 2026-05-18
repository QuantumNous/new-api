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

/**
 * Quota → human-friendly "how many chats can I afford" estimates.
 *
 * Quota is stored in units where 500,000 = $1 USD. We assume a mid-tier
 * chat costs ~$0.005 (avg between gpt-4o-mini and gpt-4o):
 *   chats ≈ (quota / 500_000) / 0.005 = quota / 2_500
 *
 * Image / video / TTS estimates use coarser per-unit costs sourced from
 * setting/alias_setting/seed/aliases.yaml YAML defaults.
 *
 * These are *order-of-magnitude* estimates for marketing-friendly UI
 * copy — never treat them as billing-grade. Actual cost depends on the
 * model the user invokes and conversation length.
 */

const QUOTA_PER_USD = 500_000
const AVG_CHAT_COST_USD = 0.005 // mid-tier mix of gpt-4o-mini ($0.0004) and gpt-4o ($0.006)
const AVG_IMAGE_COST_USD = 0.04 // DALL·E-3 standard
const AVG_VIDEO_COST_USD = 0.6 // Veo-3 5-sec clip
const AVG_MINUTE_COST_USD = 0.006 // Whisper-1 / TTS midpoint

/**
 * Estimate how many average chat turns a quota balance covers.
 * Returns a non-negative integer; 0 when input is invalid or zero.
 */
export function estimateChats(quota: number | null | undefined): number {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return 0
  const usd = quota / QUOTA_PER_USD
  return Math.max(0, Math.floor(usd / AVG_CHAT_COST_USD))
}

/** Estimate images at DALL·E-3 standard price. */
export function estimateImages(quota: number | null | undefined): number {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return 0
  const usd = quota / QUOTA_PER_USD
  return Math.max(0, Math.floor(usd / AVG_IMAGE_COST_USD))
}

/** Estimate ~5s video clips at Veo-3 price. */
export function estimateVideoClips(quota: number | null | undefined): number {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return 0
  const usd = quota / QUOTA_PER_USD
  return Math.max(0, Math.floor(usd / AVG_VIDEO_COST_USD))
}

/** Estimate audio minutes (TTS/STT) at Whisper midpoint. */
export function estimateAudioMinutes(
  quota: number | null | undefined
): number {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return 0
  const usd = quota / QUOTA_PER_USD
  return Math.max(0, Math.floor(usd / AVG_MINUTE_COST_USD))
}

/**
 * Format an integer count with the appropriate "k" / "万" suffix for
 * marketing copy. Returns "1.2k" / "12k" / "120k" / "1.2m" style strings.
 * For zh-leaning UI you may prefer to render with 万 (ten-thousand) —
 * this helper stays language-neutral; callers wrap with their own i18n.
 */
export function formatCount(n: number): string {
  if (n < 1000) return String(n)
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
  if (n < 1_000_000) return `${Math.floor(n / 1000)}k`
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`
}

/**
 * Per-model character estimates — onboarding-v2 §7.4 wants users to see
 * "约能用 Sonnet X 万字 / GPT-4o X 万字 / DeepSeek X 万字" on each top-up
 * tier so they can gauge value across cheap / mid / premium models.
 *
 * effectiveRatio = input_ratio × 3 — rough multiplier that accounts for
 * the typical 1:2 input:output split AND output being ~4× input. Yields
 * the right order of magnitude for marketing copy; never billing-grade.
 *
 * model_ratio values come from setting/ratio_setting/model_ratio.go.
 * Update HIGHLIGHT_MODELS in lock-step with pricing changes.
 */
const HIGHLIGHT_MODELS: { name: string; effectiveRatio: number }[] = [
  { name: 'Claude Sonnet', effectiveRatio: 4.5 }, // input ratio 1.5
  { name: 'GPT-4o', effectiveRatio: 3.75 }, // input ratio 1.25
  { name: 'DeepSeek V3', effectiveRatio: 0.405 }, // input ratio 0.135
]

const CHARS_PER_TOKEN = 1.4

/**
 * Returns rough character-count estimates for each highlight model at a
 * given quota balance. Empty array if input is non-positive.
 */
export function estimateCharsByModel(
  quota: number | null | undefined
): { name: string; chars: number }[] {
  if (!quota || !Number.isFinite(quota) || quota <= 0) return []
  return HIGHLIGHT_MODELS.map(({ name, effectiveRatio }) => {
    const tokens = quota / (effectiveRatio * 2)
    return {
      name,
      chars: Math.max(0, Math.floor(tokens * CHARS_PER_TOKEN)),
    }
  })
}

/**
 * Format a character count for Chinese-friendly marketing copy:
 *   < 10_000 → "X 字"
 *   < 100_000_000 → "X 万字"
 *   ≥ 100_000_000 → "X.Y 亿字"
 */
export function formatChars(n: number): string {
  if (n < 10_000) return `${n} 字`
  if (n < 100_000_000) return `${Math.round(n / 10_000)} 万字`
  return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, '')} 亿字`
}
