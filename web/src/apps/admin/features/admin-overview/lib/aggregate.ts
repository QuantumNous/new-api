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
import dayjs from '@/shared/lib/dayjs'

import type {
  DailyRevenuePoint,
  HourlyActivityPoint,
  ModelUsage,
  MonthlyRevenuePoint,
  OverviewQuotaRow,
  OverviewUserRow,
  TokenSeriesEntry,
  TokenSeriesPoint,
  TokenUsageSeries,
  UsageTotals,
} from '../types'

const UNKNOWN_MODEL = 'Unknown'
const OTHER_SERIES_KEY = 'other'
const HOURS_IN_DAY = 24

/**
 * Quota and token columns are integers on the backend. Truncating here keeps
 * every sum an exact integer in quota units; currency conversion happens only
 * at display time through `@/lib/format`.
 */
function toIntegerUnits(value: number | undefined): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.trunc(numeric)
}

function getTimestamp(value: number | undefined): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0
}

export function sumUsage(
  rows: readonly (OverviewQuotaRow | OverviewUserRow)[]
): UsageTotals {
  let quota = 0
  let tokens = 0
  let requests = 0

  for (const row of rows) {
    quota += toIntegerUnits(row.quota)
    tokens += toIntegerUnits(row.token_used)
    requests += toIntegerUnits(row.count)
  }

  return { quota, tokens, requests }
}

export function sumUsageSince(
  rows: readonly (OverviewQuotaRow | OverviewUserRow)[],
  sinceSeconds: number
): UsageTotals {
  return sumUsage(
    rows.filter((row) => getTimestamp(row.created_at) >= sinceSeconds)
  )
}

function getHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function buildUsageTrend(
  rows: readonly OverviewQuotaRow[],
  days: 1 | 7 | 30,
  now: Date
): Array<{ label: string; requests: number; tokens: number }> {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))
  const buckets = new Map<
    string,
    { label: string; requests: number; tokens: number }
  >()

  if (days === 1) {
    for (let hour = 0; hour <= now.getHours(); hour++) {
      const label = getHourLabel(hour)
      buckets.set(label, { label, requests: 0, tokens: 0 })
    }
  } else {
    for (let offset = 0; offset < days; offset++) {
      const date = new Date(start)
      date.setDate(date.getDate() + offset)
      const key = dayjs(date).format('YYYY-MM-DD')
      buckets.set(key, {
        label: dayjs(date).format('MM-DD'),
        requests: 0,
        tokens: 0,
      })
    }
  }

  for (const row of rows) {
    const timestamp = getTimestamp(row.created_at)
    if (
      timestamp < start.getTime() / 1000 ||
      timestamp > now.getTime() / 1000
    ) {
      continue
    }
    const date = new Date(timestamp * 1000)
    const key =
      days === 1
        ? getHourLabel(date.getHours())
        : dayjs(date).format('YYYY-MM-DD')
    const bucket = buckets.get(key)
    if (!bucket) continue
    bucket.requests += toIntegerUnits(row.count)
    bucket.tokens += toIntegerUnits(row.token_used)
  }

  return [...buckets.values()]
}

/**
 * Build one revenue point per local day for the last `days` days.
 * Values remain exact integer quota units.
 */
export function buildDailyRevenue(
  rows: readonly OverviewQuotaRow[],
  days: number,
  now: Date = new Date()
): DailyRevenuePoint[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  start.setDate(start.getDate() - (days - 1))

  const buckets = new Map<string, DailyRevenuePoint>()
  for (let offset = 0; offset < days; offset++) {
    const date = new Date(start)
    date.setDate(start.getDate() + offset)
    const day = dayjs(date).format('YYYY-MM-DD')
    buckets.set(day, { day, label: dayjs(date).format('MM-DD'), quota: 0 })
  }

  for (const row of rows) {
    const timestamp = getTimestamp(row.created_at)
    if (timestamp === 0) continue
    const day = dayjs(timestamp * 1000).format('YYYY-MM-DD')
    const bucket = buckets.get(day)
    if (bucket) bucket.quota += toIntegerUnits(row.quota)
  }

  return [...buckets.values()]
}

/**
 * Build one revenue point per calendar month for the last `months` months.
 * Values remain exact integer quota units; labels use the interface date format.
 */
export function buildMonthlyRevenue(
  rows: readonly OverviewQuotaRow[],
  months: number,
  now: Date = new Date()
): MonthlyRevenuePoint[] {
  const points: MonthlyRevenuePoint[] = []
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  for (let offset = 0; offset < months; offset++) {
    const date = new Date(monthStart)
    date.setMonth(monthStart.getMonth() - offset)
    const month = date.getMonth()
    const year = date.getFullYear()
    const label = `${date.toLocaleString(undefined, {
      month: 'short',
      year: 'numeric',
    })}`
    points.push({ month, year, label, quota: 0 })
  }

  for (const row of rows) {
    const timestamp = getTimestamp(row.created_at)
    if (timestamp === 0) continue
    const d = new Date(timestamp * 1000)
    for (const point of points) {
      if (d.getFullYear() === point.year && d.getMonth() === point.month) {
        point.quota += toIntegerUnits(row.quota)
        break
      }
    }
  }

  return points.reverse()
}

/** Aggregate quota rows per model, ordered by token usage then quota. */
export function buildModelUsage(
  rows: readonly OverviewQuotaRow[]
): ModelUsage[] {
  const models = new Map<string, ModelUsage>()

  for (const row of rows) {
    const model = row.model_name?.trim() || UNKNOWN_MODEL
    const current = models.get(model) ?? {
      model,
      quota: 0,
      tokens: 0,
      requests: 0,
    }
    current.quota += toIntegerUnits(row.quota)
    current.tokens += toIntegerUnits(row.token_used)
    current.requests += toIntegerUnits(row.count)
    models.set(model, current)
  }

  return [...models.values()].sort(
    (a, b) => b.tokens - a.tokens || b.quota - a.quota
  )
}

/**
 * Build today's token usage per hour, split across the most used models.
 * Remaining models are grouped into an `other` series.
 */
export function buildTodayTokenSeries(
  rows: readonly OverviewQuotaRow[],
  todayStartSeconds: number,
  currentHour: number,
  topModelCount = 5
): TokenUsageSeries {
  const todayRows = rows.filter(
    (row) => getTimestamp(row.created_at) >= todayStartSeconds
  )

  const totalsByModel = new Map<string, number>()
  const tokensByHour = new Map<number, Map<string, number>>()

  for (const row of todayRows) {
    const model = row.model_name?.trim() || UNKNOWN_MODEL
    const tokens = toIntegerUnits(row.token_used)
    const hour = new Date(getTimestamp(row.created_at) * 1000).getHours()

    totalsByModel.set(model, (totalsByModel.get(model) ?? 0) + tokens)
    const hourBucket = tokensByHour.get(hour) ?? new Map<string, number>()
    hourBucket.set(model, (hourBucket.get(model) ?? 0) + tokens)
    tokensByHour.set(hour, hourBucket)
  }

  const rankedModels = [...totalsByModel.entries()]
    .filter(([, tokens]) => tokens > 0)
    .sort((a, b) => b[1] - a[1])
  const topModels = rankedModels.slice(0, topModelCount).map(([model]) => model)
  const hasOtherModels = rankedModels.length > topModels.length

  const series: TokenSeriesEntry[] = topModels.map((model, index) => ({
    key: `series-${index}`,
    model,
  }))
  if (hasOtherModels) {
    series.push({ key: OTHER_SERIES_KEY, model: 'Other' })
  }

  const modelKey = new Map<string, string>()
  topModels.forEach((model, index) => {
    modelKey.set(model, `series-${index}`)
  })

  const points: TokenSeriesPoint[] = []
  for (let hour = 0; hour <= currentHour; hour++) {
    const values: Record<string, number> = {}
    for (const entry of series) values[entry.key] = 0

    const hourBucket = tokensByHour.get(hour)
    if (hourBucket) {
      for (const [model, tokens] of hourBucket) {
        const key = modelKey.get(model) ?? OTHER_SERIES_KEY
        if (key in values) values[key] += tokens
      }
    }

    const total = Object.values(values).reduce((sum, value) => sum + value, 0)
    points.push({ label: getHourLabel(hour), total, values })
  }

  return { series, points }
}

/** Hourly quota sparkline for today, in exact quota units. */
export function buildTodayUsageSparkline(
  rows: readonly OverviewQuotaRow[],
  todayStartSeconds: number,
  currentHour: number,
  field: 'quota' | 'count'
): number[] {
  const buckets = Array.from({ length: currentHour + 1 }, () => 0)
  for (const row of rows) {
    const timestamp = getTimestamp(row.created_at)
    if (timestamp < todayStartSeconds) continue
    const hour = new Date(timestamp * 1000).getHours()
    if (hour < buckets.length) buckets[hour] += toIntegerUnits(row[field])
  }
  return buckets
}

/** Count distinct users with usage in the rows. */
export function countActiveUsers(rows: readonly OverviewUserRow[]): number {
  const users = new Set<string>()
  for (const row of rows) {
    const username = row.username?.trim()
    if (username) users.add(username)
  }
  return users.size
}

/**
 * Distinct active users per hour for the trailing 24 hours, oldest first.
 */
export function buildHourlyActiveUsers(
  rows: readonly OverviewUserRow[],
  now: Date = new Date()
): HourlyActivityPoint[] {
  const currentHour = new Date(now)
  currentHour.setMinutes(0, 0, 0)
  const startSeconds =
    Math.floor(currentHour.getTime() / 1000) - (HOURS_IN_DAY - 1) * 60 * 60

  const buckets = Array.from({ length: HOURS_IN_DAY }, (_, index) => ({
    label: getHourLabel(
      new Date((startSeconds + index * 60 * 60) * 1000).getHours()
    ),
    users: new Set<string>(),
  }))

  for (const row of rows) {
    const username = row.username?.trim()
    if (!username) continue
    const index = Math.floor(
      (getTimestamp(row.created_at) - startSeconds) / (60 * 60)
    )
    const bucket = buckets[index]
    if (bucket) bucket.users.add(username)
  }

  return buckets.map((bucket) => ({
    label: bucket.label,
    activeUsers: bucket.users.size,
  }))
}

/** Return the second-to-last daily revenue point, interpreted as "yesterday". */
export function revenueYesterday(
  revenueTrend: readonly DailyRevenuePoint[]
): DailyRevenuePoint | undefined {
  if (revenueTrend.length < 2) return undefined
  return revenueTrend.at(-2)
}
