import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'

export type UsageDistributionMetric = 'requests' | 'consume' | 'tokens'
export type UsageDistributionPeriod = 'month' | 'quarter' | 'year'

export interface UsageHeatmapCell {
  date: string
  value: number
  level: 0 | 1 | 2 | 3 | 4 | 5
  inRange: boolean
  future: boolean
  monthKey: string
}

export interface UsageWeekdaySummary {
  weekday: number
  value: number
}

export interface UsageDistributionView {
  cells: UsageHeatmapCell[]
  weekCount: number
  total: number
  activeDays: number
  peak: UsageHeatmapCell | null
  topDays: UsageHeatmapCell[]
  weekdays: UsageWeekdaySummary[]
  rangeStart: string
  rangeEnd: string
}

const PERIOD_DAYS: Record<UsageDistributionPeriod, number> = {
  month: 30,
  quarter: 91,
  year: 364,
}

function localDateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year!, month! - 1, day)
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function mondayOf(date: Date): Date {
  return addDays(date, -((date.getDay() + 6) % 7))
}

function sundayOf(date: Date): Date {
  return addDays(mondayOf(date), 6)
}

function metricValue(
  point: UsageDistributionPoint | undefined,
  metric: UsageDistributionMetric
): number {
  return point?.[metric] ?? 0
}

function quantileThresholds(values: number[]): number[] {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b)
  if (!sorted.length) return []
  return [1, 2, 3, 4].map((part) => {
    const index = Math.max(0, Math.ceil((sorted.length * part) / 5) - 1)
    return sorted[index]!
  })
}

function intensityLevel(
  value: number,
  thresholds: number[]
): 0 | 1 | 2 | 3 | 4 | 5 {
  if (value <= 0) return 0
  let level = 1
  thresholds.forEach((threshold) => {
    if (value > threshold) level++
  })
  return Math.min(5, level) as 1 | 2 | 3 | 4 | 5
}

export function buildUsageDistributionView(
  points: UsageDistributionPoint[],
  period: UsageDistributionPeriod,
  metric: UsageDistributionMetric,
  referenceDate = new Date()
): UsageDistributionView {
  const today = new Date(referenceDate)
  today.setHours(0, 0, 0, 0)
  const rangeEnd = today
  const rangeStart = addDays(today, -(PERIOD_DAYS[period] - 1))
  const gridStart = mondayOf(rangeStart)
  const gridEnd = sundayOf(rangeEnd)
  const pointMap = new Map(points.map((point) => [point.date, point]))

  const values: number[] = []
  for (
    let cursor = rangeStart;
    cursor <= rangeEnd;
    cursor = addDays(cursor, 1)
  ) {
    values.push(metricValue(pointMap.get(localDateKey(cursor)), metric))
  }
  const thresholds = quantileThresholds(values)

  const cells: UsageHeatmapCell[] = []
  for (let cursor = gridStart; cursor <= gridEnd; cursor = addDays(cursor, 1)) {
    const date = localDateKey(cursor)
    const future = cursor > today
    const inRange = cursor >= rangeStart && cursor <= rangeEnd
    const value = inRange ? metricValue(pointMap.get(date), metric) : 0
    cells.push({
      date,
      value,
      level: inRange ? intensityLevel(value, thresholds) : 0,
      inRange,
      future,
      monthKey: date.slice(0, 7),
    })
  }

  const active = cells.filter((cell) => cell.inRange && cell.value > 0)
  const ranked = [...active].sort(
    (left, right) =>
      right.value - left.value || right.date.localeCompare(left.date)
  )
  const weekdays = Array.from({ length: 7 }, (_, weekday) => {
    const matching = cells.filter(
      (cell) =>
        cell.inRange && (fromDateKey(cell.date).getDay() + 6) % 7 === weekday
    )
    return {
      weekday,
      value: matching.length
        ? matching.reduce((sum, cell) => sum + cell.value, 0) / matching.length
        : 0,
    }
  })

  return {
    cells,
    weekCount: cells.length / 7,
    total: values.reduce((sum, value) => sum + value, 0),
    activeDays: active.length,
    peak: ranked[0] ?? null,
    topDays: ranked.slice(0, 3),
    weekdays,
    rangeStart: localDateKey(rangeStart),
    rangeEnd: localDateKey(rangeEnd),
  }
}

export function shiftUsageDate(dateKey: string, days: number): string {
  return localDateKey(addDays(fromDateKey(dateKey), days))
}
