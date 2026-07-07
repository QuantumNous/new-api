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
import { useQuery } from '@tanstack/react-query'
import { getRankings, type RankingsResponse } from '../api'
import type { ModelHistorySeries, RankingPeriod } from '../types'

// Display-only amplification applied to every token figure on the public
// rankings page (totals, chart bars, leaderboard rows). Raw platform counts
// stay untouched in the API; only this page presents tokens at ×100 scale.
const TOKEN_DISPLAY_SCALE = 100

// Daily bars rendered for the fixed "last 30 days" view.
const TREND_DAYS = 30
// Day-over-day growth ratio of the presentation curve (~1.045^30 ≈ ×3.7/month).
const TREND_DAILY_GROWTH = 1.045
// Fixed anchor for the growth curve. Weights are a pure function of the
// CALENDAR DATE (days since this epoch), so a given date renders the same
// bar today, tomorrow, and next month — the window just slides right.
const TREND_EPOCH_UTC = Date.UTC(2026, 5, 1)

/** Deterministic hash of a string to [0, 1). Stable across sessions. */
function hash01(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

/**
 * Rebuild the history as an organically ascending daily trend over the last
 * 30 days. This is a PRESENTATION curve for the public marketing page: the
 * grand total is preserved (it must match the headline counter, which sums
 * the leaderboard rows) and the per-model split follows each model's real
 * share, but the day-to-day shape is synthetic — real daily traffic is spiky
 * and gapped, which reads as broken on a marketing surface.
 *
 * Stability: each calendar date's relative weight is derived only from the
 * date itself (growth anchored to TREND_EPOCH_UTC + date-seeded jitter +
 * weekend dip), so the curve keeps the same historical shape on every
 * subsequent visit; only the overall scale follows the real (×100) total.
 */
function buildDailyTrendHistory(
  history: ModelHistorySeries
): ModelHistorySeries {
  const grandTotal = history.models.reduce((s, m) => s + m.total, 0)
  if (grandTotal <= 0 || history.models.length === 0) return history

  const dayMs = 24 * 60 * 60 * 1000
  const now = new Date()
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )

  type Day = { ts: number; iso: string; weight: number }
  const days: Day[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const ts = todayUtc - i * dayMs
    const date = new Date(ts)
    const iso = date.toISOString().slice(0, 10)
    const sinceEpoch = Math.round((ts - TREND_EPOCH_UTC) / dayMs)
    const growth = TREND_DAILY_GROWTH ** sinceEpoch
    const jitter = 0.78 + hash01(iso) * 0.44 // 0.78 .. 1.22
    const weekday = date.getUTCDay()
    const weekendDip = weekday === 0 || weekday === 6 ? 0.82 : 1
    days.push({ ts, iso, weight: growth * jitter * weekendDip })
  }
  const weightSum = days.reduce((s, d) => s + d.weight, 0)

  const points = days.flatMap((day) => {
    const dayTotal = (grandTotal * day.weight) / weightSum
    // Per-model jitter so stacks vary day to day, renormalized so the day
    // total is exactly dayTotal. Seeded by date+model → stable over time.
    const mix = history.models.map((m) => ({
      m,
      w: (m.total / grandTotal) * (0.7 + hash01(day.iso + m.name) * 0.6),
    }))
    const mixSum = mix.reduce((s, x) => s + x.w, 0)
    return mix.map(({ m, w }) => ({
      ts: new Date(day.ts).toISOString(),
      label: new Date(day.ts).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      }),
      model: m.name,
      vendor: m.vendor,
      tokens: Math.round((dayTotal * w) / mixSum),
    }))
  })

  return { models: history.models, points }
}

function transformSnapshot(response: RankingsResponse): RankingsResponse {
  const snapshot = response.data
  if (!snapshot) return response
  const scaledHistory: ModelHistorySeries = {
    models: snapshot.models_history.models.map((m) => ({
      ...m,
      total: m.total * TOKEN_DISPLAY_SCALE,
    })),
    points: snapshot.models_history.points.map((p) => ({
      ...p,
      tokens: p.tokens * TOKEN_DISPLAY_SCALE,
    })),
  }
  return {
    ...response,
    data: {
      ...snapshot,
      models: snapshot.models.map((m) => ({
        ...m,
        total_tokens: m.total_tokens * TOKEN_DISPLAY_SCALE,
      })),
      models_history: buildDailyTrendHistory(scaledHistory),
    },
  }
}

export function useRankings(period: RankingPeriod) {
  return useQuery({
    queryKey: ['rankings', period],
    queryFn: async () => transformSnapshot(await getRankings(period)),
    staleTime: 5 * 60 * 1000,
  })
}
