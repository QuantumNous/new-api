/**
 * Auto-routing score computation.
 *
 * Each channel is evaluated on six dimensions, each normalised to [0,1] within
 * the candidate set handed in by the caller, then combined into a single 0-100
 * score using fixed weights. The dashboard scores each vendor group separately,
 * so a score reads "how good is this channel among its vendor's pool" — routing
 * picks within a vendor, never across vendors.
 *
 * Weights (must sum to 1):
 *   latency  0.25  — lower latency  → higher score
 *   health   0.30  — higher health  → higher score
 *   cost     0.20  — lower combined multiplier → higher score
 *   quota    0.10  — more upstream balance → higher score
 *   weight   0.10  — higher weight → higher score
 *   priority 0.05  — lower priority value → higher score (priority 1 beats priority 10)
 */

export interface ChannelRoutingMetrics {
  id: number
  name: string
  supplier: string
  /** Average response latency in ms. 0 means untested — treated as worst case. */
  latency: number
  /** Health percentage 0-100. */
  health: number
  /** Upstream price multiplier (e.g. 0.75 = 75% of base price). */
  upstreamMult: number
  /** Channel price multiplier on top of upstream. */
  channelMult: number
  /** Upstream remaining balance (USD). */
  quota: number
  /** Routing weight; higher = more traffic in load-balance mode. */
  weight: number
  /** Routing priority; lower numeric value = higher priority. */
  priority: number
  /** 1 = enabled, 2 = manually disabled, 3 = auto-disabled */
  status: 1 | 2 | 3
}

export interface ScoreBreakdown {
  latency: number // normalised 0-1
  health: number
  cost: number
  quota: number
  weight: number
  priority: number
}

export interface ScoredChannel extends ChannelRoutingMetrics {
  /** Composite score 0-100 (higher is better). */
  score: number
  breakdown: ScoreBreakdown
}

export const WEIGHTS = {
  latency: 0.25,
  health: 0.3,
  cost: 0.2,
  quota: 0.1,
  weight: 0.1,
  priority: 0.05,
} as const

export type ScoreBand = 'success' | 'warning' | 'danger'

/** Threshold policy for colouring a composite score, shared by every
 *  auto-route surface so the bands can never drift apart. */
export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return 'success'
  if (score >= 45) return 'warning'
  return 'danger'
}

function minmax(values: number[]): { min: number; max: number } {
  const nonZero = values.filter((v) => v > 0)
  if (nonZero.length === 0) return { min: 0, max: 1 }
  return { min: Math.min(...nonZero), max: Math.max(...values) }
}

/** Normalise within [min, max]; inverted factors flip so lower raw values win.
 *  A factor with no spread awards full marks — the sole (or tied) candidate is
 *  trivially optimal on it, keeping direct and inverted factors symmetric. */
function factorScore(
  value: number,
  min: number,
  max: number,
  invert = false
): number {
  if (max === min) return 1
  const normalised = Math.max(0, Math.min(1, (value - min) / (max - min)))
  return invert ? 1 - normalised : normalised
}

/** Score all channels and return them sorted best-first (only enabled channels). */
export function scoreChannels(
  channels: ChannelRoutingMetrics[]
): ScoredChannel[] {
  const active = channels.filter((c) => c.status === 1)
  if (active.length === 0) return []

  // Treat latency=0 (untested) as 2× the worst measured latency.
  const testedLatencies = active.map((c) => c.latency).filter((v) => v > 0)
  const worstLatency = testedLatencies.length
    ? Math.max(...testedLatencies) * 2
    : 5000
  const effectiveLatencies = active.map((c) =>
    c.latency === 0 ? worstLatency : c.latency
  )

  const { min: minLat, max: maxLat } = minmax(effectiveLatencies)
  const costs = active.map((c) => (c.upstreamMult || 1) * (c.channelMult || 1))
  const { min: minCost, max: maxCost } = minmax(costs)
  const quotas = active.map((c) => c.quota)
  const { min: minQuota, max: maxQuota } = minmax(quotas)
  const weights = active.map((c) => c.weight)
  const { min: minW, max: maxW } = minmax(weights)
  const priorities = active.map((c) => c.priority)
  const { min: minP, max: maxP } = minmax(priorities)

  return active
    .map((c, i) => {
      const bd: ScoreBreakdown = {
        latency: factorScore(effectiveLatencies[i], minLat, maxLat, true),
        health: c.health / 100,
        cost: factorScore(costs[i], minCost, maxCost, true),
        quota: factorScore(c.quota, minQuota, maxQuota),
        weight: factorScore(c.weight, minW, maxW),
        priority: factorScore(c.priority, minP, maxP, true),
      }
      const score =
        bd.latency * WEIGHTS.latency +
        bd.health * WEIGHTS.health +
        bd.cost * WEIGHTS.cost +
        bd.quota * WEIGHTS.quota +
        bd.weight * WEIGHTS.weight +
        bd.priority * WEIGHTS.priority

      return { ...c, score: Math.round(score * 100), breakdown: bd }
    })
    .sort((a, b) => b.score - a.score)
}

/** Group channels by supplier, preserving the input order inside each group. */
export function groupByVendor<T extends { supplier: string }>(
  channels: T[]
): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const ch of channels) {
    const key = ch.supplier || 'Other'
    const existing = map.get(key)
    if (existing) {
      existing.push(ch)
    } else {
      map.set(key, [ch])
    }
  }
  return map
}
