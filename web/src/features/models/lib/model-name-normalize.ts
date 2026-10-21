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
 * Model name fuzzy matching for pricing lookups.
 *
 * ============================================================================
 * Design contract
 * ============================================================================
 *
 * The model name persisted in `models.model_name` and used for API routing
 * MUST NOT be mutated by this module. If a user creates a model called
 *
 *   doubao-seedream-5-0-pro-260628
 *
 * then that exact string is what our gateway sends upstream, what shows
 * up in logs, and what the /v1/models/pricing API returns as the key.
 * We ONLY use fuzzy matching when looking up an official reference price
 * from a catalogue whose keys were curated with a different casing /
 * punctuation convention (e.g. Volcano's docs list "Doubao-Seedream-5.0-pro").
 *
 * ============================================================================
 * Fuzzy rules (kept intentionally small)
 * ============================================================================
 *
 * A. Lower-case both sides.
 * B. Treat `-N-M-` and `-N.M-` as equivalent version separators, where N
 *    and M are 1-3 digit runs. This is the single most common divergence
 *    between the routing form ("5-0") and the marketing form ("5.0").
 * C. Match by substring in either direction — the model name may be
 *    longer than the catalogue key (extra suffix like `-260628` release
 *    stamp) or shorter (family key like `doubao-seed-1.6` matching a
 *    specific model `doubao-seed-1.6-vision`).
 *
 * We deliberately DO NOT:
 *   - Strip date stamps. Whether `-260628` at the end matters for a lookup
 *     is context-dependent; substring matching handles it naturally.
 *   - Recurse over multi-segment versions like `1-6-1`. Nobody uses those
 *     in practice, and greedy conversion risks munging model sizes like
 *     `qwen2-7b` (where `2-7b` is NOT a version).
 *   - Rewrite the input string persistently. Every helper here returns a
 *     transient normalized form used solely inside this function's scope.
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Normalize a raw model name for fuzzy comparison purposes only.
 *
 * Rules applied (left-to-right, single pass):
 *   1. Trim + lower-case.
 *   2. Convert `-N-M-` and terminal `-N-M` to dotted form when N and M are
 *      1-3 digit runs. This is the pattern that produces
 *      `5-0` → `5.0` and `1-6` → `1.6`.
 *
 * The result is safe to use in `includes()` matching against a catalogue
 * whose keys have been normalized the same way. It is NOT suitable to
 * write back to persistent storage — always keep the raw input.
 *
 * @example
 *   normalizeModelName('doubao-seedream-5-0-pro-260628')
 *     → 'doubao-seedream-5.0-pro-260628'
 *   normalizeModelName('Doubao-Seedream-5.0-pro')
 *     → 'doubao-seedream-5.0-pro'
 *   normalizeModelName('gpt-4o-mini')
 *     → 'gpt-4o-mini'  (no `-N-M-` pattern to convert)
 */
export function normalizeModelName(raw: string): string {
  if (!raw) return ''
  const s = raw.trim().toLowerCase()
  return versionDashesToDots(s)
}

/**
 * Look up a model in a catalogue using normalized fuzzy matching.
 *
 * Search order:
 *   Pass 1 — exact key match on the raw input (fast path, no normalization).
 *   Pass 2 — for every catalogue key, normalize both sides and check
 *            substring in either direction. When multiple keys match,
 *            the LONGEST overlap wins so `doubao-seed-1.6-vision` beats
 *            the bare family key `doubao-seed-1.6`.
 *
 * Returns `null` when nothing matches (including empty input).
 *
 * @example
 *   const catalog = {
 *     'Doubao-Seedream-5.0-pro': { price: 0.04 },
 *     'Doubao-Seed-1.6-vision':  { price: 0.02 },
 *   }
 *   findModelInCatalog('doubao-seedream-5-0-pro-260628', catalog)
 *     → { key: 'Doubao-Seedream-5.0-pro', value: { price: 0.04 } }
 */
export function findModelInCatalog<T>(
  rawInput: string,
  catalog: Record<string, T>,
): { key: string; value: T } | null {
  if (!rawInput) return null

  if (Object.prototype.hasOwnProperty.call(catalog, rawInput)) {
    return { key: rawInput, value: catalog[rawInput] }
  }

  const target = normalizeModelName(rawInput)
  if (!target) return null

  let best: { key: string; value: T; matchLen: number } | null = null
  for (const key of Object.keys(catalog)) {
    const normKey = normalizeModelName(key)
    if (!normKey) continue

    const overlap =
      target.includes(normKey) || normKey.includes(target)
        ? Math.min(target.length, normKey.length)
        : 0

    if (overlap === 0) continue
    if (!best || overlap > best.matchLen) {
      best = { key, value: catalog[key], matchLen: overlap }
    }
  }
  return best ? { key: best.key, value: best.value } : null
}

/**
 * Boolean helper for "do these two names refer to the same model?".
 * Uses the same fuzzy rules as findModelInCatalog. Callers that also want
 * to fetch the associated value should use findModelInCatalog directly to
 * avoid a second normalization pass.
 */
export function modelNameMatches(rawA: string, rawB: string): boolean {
  if (!rawA || !rawB) return false
  if (rawA === rawB) return true
  const a = normalizeModelName(rawA)
  const b = normalizeModelName(rawB)
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Convert `-N-M-` and terminal `-N-M` to `-N.M`. N and M are limited to
 * 1-3 digits each so we don't accidentally reformat model sizes like
 * `qwen2-7b` (that `2-7` isn't a version — the `b` right after `7` stops
 * the digit run).
 *
 * The mid-string variant requires a trailing `-` in a lookahead so the
 * match doesn't consume it — otherwise we'd need a second pass to catch
 * back-to-back version segments, and multi-segment versions are out of
 * scope on purpose (see file header rationale).
 */
function versionDashesToDots(s: string): string {
  return s
    .replace(/(-\d{1,3})-(\d{1,3})(?=-)/g, '$1.$2')
    .replace(/(-\d{1,3})-(\d{1,3})$/, '$1.$2')
}
