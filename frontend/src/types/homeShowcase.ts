export type HomeCopyKey = `showcase.${string}`

export type HomeMarketSide = 'buy' | 'sell'
export type HomeMarketListingStatus = 'draft' | 'listed' | 'purchased'

export interface HomeMarketListing {
  id: string
  titleKey: HomeCopyKey
  detailKey: HomeCopyKey
  vendor: string
  model: string
  unitPriceUsd: number
  availabilityPercent: number
  qualityScore: number
  status: HomeMarketListingStatus
  owned: boolean
  journey: boolean
}

export type HomeRouteHealth = 'healthy' | 'degraded' | 'offline'
export type HomeRouteSource = 'platform' | 'market'

export interface HomeRouteChannel {
  id: string
  listingId: string | null
  nameKey: HomeCopyKey
  vendor: string
  model: string
  source: HomeRouteSource
  enabled: boolean
  weight: number
  priority: number
  health: HomeRouteHealth
  latencyMs: number
  qualityScore: number
}

export interface HomeDiscountTier {
  id: string
  thresholdTokens: number
  discountRate: number
}

export type HomeActivityId = 'checkin' | 'affiliate' | 'farm' | 'bigame'

export interface HomeActivityPreview {
  id: HomeActivityId
  titleKey: HomeCopyKey
  detailKey: HomeCopyKey
  rewardKey: HomeCopyKey
  current: number
  target: number
  unitKey: HomeCopyKey
  routeName: 'activity' | 'invite' | 'farm' | 'bigame'
  dayAsset: string
  nightAsset: string
}

export interface HomeRunningMetrics {
  startedAt: string
  requestSeed: number
  requestsPerSecond: number
  requestsPerTick: number
  tickIntervalMs: number
}

export interface HomeRuntimeBreakdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  totalSeconds: number
}

export type HomeQualityVerdict = 'verified' | 'review' | 'unavailable'

export interface HomeQualityReport {
  id: string
  channelId: string
  agency: string
  reportNumber: string
  model: string
  verdict: HomeQualityVerdict
  verdictKey: HomeCopyKey
  score: number | null
  inspectedAt: string
  reportUrl: string | null
  evidenceAsset: string | null
}

export type HomeSupportLinkId = 'ticket' | 'telegram' | 'qq'

export interface HomeSupportLink {
  id: HomeSupportLinkId
  labelKey: HomeCopyKey
  kind: 'route' | 'external'
  routeName: 'tickets' | null
  href: string | null
}

export interface HomeShowcaseSnapshot {
  market: {
    listings: HomeMarketListing[]
  }
  routing: {
    channels: HomeRouteChannel[]
    loadBalance: boolean
  }
  discount: {
    tiers: HomeDiscountTier[]
    accountTokens: number
    exampleSpendUsd: number
  }
  activities: HomeActivityPreview[]
  running: HomeRunningMetrics
  qualityReports: HomeQualityReport[]
  supportLinks: HomeSupportLink[]
}

export interface HomeShowcaseSource {
  load(signal?: AbortSignal): Promise<HomeShowcaseSnapshot>
}

export type HomeMarketJourneyStage = 'draft' | 'listed' | 'purchased' | 'bound'

export type HomeRouteSimulationPhase =
  'idle' | 'sending' | 'failover' | 'responded' | 'unavailable'

export interface HomeRouteSimulation {
  eventId: number
  phase: HomeRouteSimulationPhase
  primaryChannelId: string | null
  fallbackChannelId: string | null
  activeChannelId: string | null
  latencyMs: number | null
}
