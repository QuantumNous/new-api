export const ROUTE_HEALTH_BUCKETS = 6
export const ROUTE_HEALTH_BUCKET_SECONDS = 600

export type RouteHealthState = 'healthy' | 'degraded' | 'down' | 'unknown'

export interface RouteHealthCheck {
  timestamp: number
  state: RouteHealthState
}

export interface RouteHealthSummary {
  checks: RouteHealthCheck[]
  state: RouteHealthState
  availability: number | null
}

interface RouteHealthChannel {
  status: number
  healthChecks?: readonly RouteHealthCheck[]
}

function currentTimestamp(): number {
  return Math.floor(Date.now() / 1000)
}

function completedBucketEnd(timestamp: number): number {
  return (
    Math.floor(timestamp / ROUTE_HEALTH_BUCKET_SECONDS) *
    ROUTE_HEALTH_BUCKET_SECONDS
  )
}

function bucketEnds(nowTimestamp: number): number[] {
  const anchor = completedBucketEnd(nowTimestamp)
  return Array.from(
    { length: ROUTE_HEALTH_BUCKETS },
    (_, index) =>
      anchor - (ROUTE_HEALTH_BUCKETS - index - 1) * ROUTE_HEALTH_BUCKET_SECONDS
  )
}

function checkBucketEnd(timestamp: number): number {
  return (
    Math.ceil(timestamp / ROUTE_HEALTH_BUCKET_SECONDS) *
    ROUTE_HEALTH_BUCKET_SECONDS
  )
}

export function routeHealthStateFromValue(value: number): RouteHealthState {
  if (value >= 90) return 'healthy'
  if (value >= 70) return 'degraded'
  return 'down'
}

/** Align recent checks to six ten-minute buckets, keeping the last check in each. */
export function alignRouteHealthChecks(
  checks: readonly RouteHealthCheck[] | undefined,
  nowTimestamp = currentTimestamp()
): RouteHealthCheck[] {
  const ends = bucketEnds(nowTimestamp)
  const firstEnd = ends[0]!
  const anchor = ends.at(-1)!
  const latestByBucket = new Map<number, RouteHealthCheck>()

  for (const check of checks ?? []) {
    if (!Number.isFinite(check.timestamp) || check.timestamp > nowTimestamp) {
      continue
    }

    const end = checkBucketEnd(check.timestamp)
    if (end < firstEnd || end > anchor) continue

    const latest = latestByBucket.get(end)
    if (!latest || check.timestamp >= latest.timestamp) {
      latestByBucket.set(end, check)
    }
  }

  return ends.map((timestamp) => ({
    timestamp,
    state: latestByBucket.get(timestamp)?.state ?? 'unknown',
  }))
}

function aggregateBucket(states: RouteHealthState[]): RouteHealthState {
  if (states.includes('healthy')) return 'healthy'
  if (states.includes('degraded')) return 'degraded'
  if (states.length > 0 && states.every((state) => state === 'down')) {
    return 'down'
  }
  return 'unknown'
}

/** Summarise failover availability across enabled channels only. */
export function summarizeRouteHealth(
  channels: readonly RouteHealthChannel[],
  nowTimestamp = currentTimestamp()
): RouteHealthSummary {
  const enabled = channels.filter((channel) => channel.status === 1)
  const ends = bucketEnds(nowTimestamp)
  const alignedEnabled = enabled.map((channel) =>
    alignRouteHealthChecks(channel.healthChecks, nowTimestamp)
  )

  const checks =
    enabled.length === 0
      ? ends.map<RouteHealthCheck>((timestamp) => ({
          timestamp,
          state: 'down',
        }))
      : ends.map<RouteHealthCheck>((timestamp, index) => ({
          timestamp,
          state: aggregateBucket(
            alignedEnabled.map((channelChecks) => channelChecks[index]!.state)
          ),
        }))

  const known = checks.filter((check) => check.state !== 'unknown')
  const available = known.filter(
    (check) => check.state === 'healthy' || check.state === 'degraded'
  ).length

  return {
    checks,
    state: checks.at(-1)!.state,
    availability: known.length > 0 ? (available / known.length) * 100 : null,
  }
}
