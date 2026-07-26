/**
 * Dashboard overview mock series that do not belong in data.ts.
 *
 * Kept separate on purpose: data.ts draws from a single seeded PRNG and its
 * header warns that adding shared rand() consumers shifts every downstream
 * seed. Everything here is derived from closed-form formulas so the payload is
 * deterministic without touching that draw order.
 */

const DAY = 86_400
const now = Math.floor(Date.now() / 1000)

export interface TokenTrendPoint {
  date: string
  input: number
  output: number
  cache_create: number
  cache_read: number
  /** cache hit rate, 0-100 */
  hit_rate: number
  /** discounted spend in quota units */
  actual: number
  /** list-price spend in quota units */
  standard: number
}

/**
 * 14-day token mix. Cache read dominates once the prefix cache warms up, which
 * is what makes the hit-rate curve climb over the window — same shape a real
 * account shows after a few days of steady prompting.
 */
export const tokenTrend: TokenTrendPoint[] = Array.from(
  { length: 14 },
  (_, i) => {
    const t = i / 13
    // Smooth ramp with a mid-window dip, so the series are not visibly linear.
    const wave = 0.55 + 0.45 * Math.sin(t * Math.PI * 1.35 - 0.45)
    const growth = 0.35 + 0.65 * t

    const input = Math.round(2_400_000 * wave * growth)
    const output = Math.round(input * 0.42)
    const cacheCreate = Math.round(input * 0.78)
    const cacheRead = Math.round(input * (1.9 + 4.6 * t))

    const readable = cacheRead + input
    const hitRate = readable > 0 ? (cacheRead / readable) * 100 : 0

    // Cache reads bill at a fraction of input, which is where the gap between
    // actual and standard spend comes from.
    const standard =
      (input + cacheRead) * 0.0009 + output * 0.0045 + cacheCreate * 0.0011
    const actual = standard * (0.58 + 0.14 * (1 - t))

    return {
      date: new Date((now - (13 - i) * DAY) * 1000).toISOString().slice(0, 10),
      input,
      output,
      cache_create: cacheCreate,
      cache_read: cacheRead,
      hit_rate: Math.round(hitRate * 10) / 10,
      actual: Math.round(actual),
      standard: Math.round(standard),
    }
  }
)

export interface SystemMetrics {
  cpu_percent: number
  memory_used_gb: number
  memory_total_gb: number
  bandwidth_up_mbps: number
  bandwidth_down_mbps: number
  disk_used_gb: number
  disk_total_gb: number
  api_success_rate: number
  /** Recent throughput samples, oldest → newest; the last pair is the live figure. */
  bandwidth_series: { up: number[]; down: number[] }
}

const BANDWIDTH_SAMPLES = 24

/**
 * Closed-form throughput wave that lands exactly on 1 at the newest sample, so
 * the series endpoint and the headline Mbps figure are the same number rather
 * than two nearly-equal ones.
 */
function throughputWave(t: number, cycles: number, floor: number): number {
  const main = Math.sin(Math.PI * 2 * cycles * (t - 1) + Math.PI / 2)
  const ripple = 0.18 * Math.sin(Math.PI * 2 * 2.7 * (t - 1))
  const mix = Math.min(1, Math.max(0, 0.5 + 0.5 * main + ripple))
  return floor + (1 - floor) * mix
}

/** Distinct cycle counts so upload is not just a scaled copy of download. */
const bandwidthSeries = {
  up: Array.from(
    { length: BANDWIDTH_SAMPLES },
    (_, i) =>
      Math.round(
        2.1 * throughputWave(i / (BANDWIDTH_SAMPLES - 1), 0.85, 0.35) * 10
      ) / 10
  ),
  down: Array.from(
    { length: BANDWIDTH_SAMPLES },
    (_, i) =>
      Math.round(
        12.4 * throughputWave(i / (BANDWIDTH_SAMPLES - 1), 1.15, 0.3) * 10
      ) / 10
  ),
}

/**
 * Infrastructure gauges. In a real deployment these come from a monitoring
 * endpoint and are usually admin-scoped; here they are demo values.
 */
export const systemMetrics: SystemMetrics = {
  cpu_percent: 34,
  memory_used_gb: 5.2,
  memory_total_gb: 16,
  bandwidth_up_mbps: bandwidthSeries.up.at(-1)!,
  bandwidth_down_mbps: bandwidthSeries.down.at(-1)!,
  disk_used_gb: 218,
  disk_total_gb: 512,
  api_success_rate: 99.7,
  bandwidth_series: bandwidthSeries,
}
