import { flowSeries } from './data'
import { tokenTrend } from './overview'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'

const DAY_MS = 86_400_000
const HISTORY_DAYS = 365

function dateKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function addDays(date: Date, amount: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function generatedHistory(): UsageDistributionPoint[] {
  const random = createRandom(0x51f15e)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: HISTORY_DAYS }, (_, index) => {
    const date = addDays(today, index - HISTORY_DAYS + 1)
    const weekday = (date.getDay() + 6) % 7
    const weekendFactor = weekday >= 5 ? 0.58 : 1
    const seasonal = 0.78 + 0.22 * Math.sin(index / 17)
    const quiet = random() < 0.045
    const spike = random() < 0.08 ? 1.55 + random() * 0.8 : 1
    const requests = quiet
      ? 0
      : Math.round((240 + random() * 760) * weekendFactor * seasonal * spike)
    const consume = requests ? Math.round(requests * (170 + random() * 230)) : 0
    const tokens = requests
      ? Math.round(requests * (11_000 + random() * 29_000))
      : 0

    return { date: dateKey(date), requests, consume, tokens }
  })
}

const generated = generatedHistory()
const recentFlowStart = generated.length - flowSeries.length

flowSeries.forEach((point, index) => {
  const target = generated[recentFlowStart + index]
  if (!target) return
  target.consume = point.consume
  target.requests = point.requests
})

const recentTokenStart = generated.length - tokenTrend.length
tokenTrend.forEach((point, index) => {
  const target = generated[recentTokenStart + index]
  if (!target) return
  target.tokens =
    point.input + point.output + point.cache_create + point.cache_read
})

export const usageDistributionHistory = generated

export function usagePointDate(point: UsageDistributionPoint): Date {
  const [year, month, day] = point.date.split('-').map(Number)
  return new Date(year!, month! - 1, day)
}

export function usageHistoryDurationDays(): number {
  const first = usageDistributionHistory[0]
  const last = usageDistributionHistory.at(-1)
  if (!first || !last) return 0
  return (
    Math.round(
      (usagePointDate(last).getTime() - usagePointDate(first).getTime()) /
        DAY_MS
    ) + 1
  )
}
