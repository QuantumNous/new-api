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
 * Provider-agnostic top-up (purchase) conversion firing with de-duplication.
 *
 * Payments complete via several providers (Paddle inline poll, Stripe/epay
 * redirect-back, etc.), so rather than instrument every success path we fire
 * the conversion once per completed top-up keyed by a stable id (`trade_no`).
 *
 * Guards:
 *  - de-dupe via localStorage so a top-up never double-counts (refresh, re-poll)
 *  - only fire for *fresh* top-ups (completed within RECENT_WINDOW_MS) so that
 *    a returning user loading their billing history does NOT retroactively fire
 *    conversions for historical top-ups.
 */
import { trackTopupConversion } from './gtag'
import { trackPixelsTopup } from './pixels'

const STORAGE_KEY = 'ads:tracked_topups'
const RECENT_WINDOW_MS = 30 * 60 * 1000 // 30 min — covers redirect round-trips
const MAX_KEYS = 200 // cap stored keys so the entry can't grow unbounded

interface TrackableTopup {
  trade_no?: string
  money?: number // USD value actually paid
  complete_time?: number // unix seconds
  create_time?: number // unix seconds
}

function loadTracked(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function saveTracked(keys: string[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(keys.slice(-MAX_KEYS))
    )
  } catch {
    /* ignore storage write failures */
  }
}

function keyFor(t: TrackableTopup): string {
  return t.trade_no || `${t.create_time ?? ''}-${t.money ?? ''}`
}

function isFresh(t: TrackableTopup): boolean {
  const tsSec = t.complete_time || t.create_time
  if (!tsSec) return true // no timestamp → assume just happened (inline success)
  return Date.now() - tsSec * 1000 <= RECENT_WINDOW_MS
}

/**
 * Fire the top-up conversion for a single just-completed top-up. Idempotent:
 * safe to call repeatedly with the same record. No-op if already tracked or
 * (when a timestamp is present) the top-up is not recent.
 */
export function trackTopupOnce(t: TrackableTopup): void {
  if (typeof window === 'undefined') return
  const key = keyFor(t)
  if (!key) return
  if (!isFresh(t)) return
  const tracked = loadTracked()
  if (tracked.includes(key)) return
  tracked.push(key)
  saveTracked(tracked)

  const value = typeof t.money === 'number' && t.money > 0 ? t.money : undefined
  trackTopupConversion(value)
  trackPixelsTopup(value)
}

/**
 * Scan a billing-history page for freshly-succeeded top-ups and fire each once.
 * Call whenever billing records load (covers redirect-back providers).
 */
export function trackSuccessfulTopups(
  records: Array<TrackableTopup & { status?: string }>
): void {
  for (const r of records) {
    if (r?.status === 'success') trackTopupOnce(r)
  }
}
