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
 * Fold model identifiers for perf lookup.
 * Mirrors backend `perfmetrics.NormalizeModelName` (lower + trim).
 * Path / free-suffix variants stay distinct for metrics.
 */
export function normalizeModelName(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

/**
 * Strip display-only free/path noise for pricing square dedup.
 * Keeps routing identity on the model object itself; only affects card list collapse.
 *
 * Examples:
 *  - "OpenAI/gpt-4o" → "gpt-4o"
 *  - "gpt-4o:free" → "gpt-4o"
 *  - "gpt-4o[free]" → "gpt-4o"
 *  - "Deepseek-V4-Flash" → "deepseek-v4-flash"
 */
export function displayModelBaseName(name: string | null | undefined): string {
  let n = (name ?? '').trim()
  if (!n) return ''
  // Drop provider path prefix: vendor/model → model (keep last segment)
  if (n.includes('/')) {
    const parts = n.split('/').filter(Boolean)
    n = parts[parts.length - 1] ?? n
  }
  // Drop :free / :nitro style OpenRouter suffixes
  n = n.replace(/:(free|nitro|floor|exacto)$/i, '')
  // Drop [free] bracket tags
  n = n.replace(/\[free\]/gi, '')
  return n.trim().toLowerCase()
}

/** True when name looks like a free/path display variant of a base model. */
export function isPricingDisplayVariant(name: string | null | undefined): boolean {
  const raw = (name ?? '').trim()
  if (!raw) return false
  if (raw.includes('/')) return true
  if (/:(free|nitro|floor|exacto)$/i.test(raw)) return true
  if (/\[free\]/i.test(raw)) return true
  return false
}
