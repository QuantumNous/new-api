export interface HomeRuntime {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export type HomeMarketMode = 'buy' | 'sell'
export type HomeExchangeStage = 'draft' | 'published' | 'purchased' | 'bound'
export type HomeMarketListingStatus =
  'available' | 'draft' | 'published' | 'purchased' | 'bound'

export interface HomeMarketListing {
  id: string
  provider: string
  model: string
  region: string
  price: number
  availability: number
  qualityScore: number
  status: HomeMarketListingStatus
  source: 'official' | 'market'
}

export type HomeRouteMode = 'manual' | 'auto'
export type HomeRouteHealth = 'online' | 'degraded' | 'offline'

export interface HomeRouteChannel {
  id: string
  listingId: string | null
  name: string
  nameKey: `showcase.routing.channels.${string}` | null
  provider: string
  model: string
  source: 'official' | 'market'
  weight: number
  enabled: boolean
  latency: number
  qualityScore: number
  health: HomeRouteHealth
}

export interface HomeTokenRoute {
  id: 'production-key' | 'image-worker'
  name: string
  maskedKey: string
  mode: HomeRouteMode
  loadBalance: boolean
  channels: HomeRouteChannel[]
}

export type HomeRouteSimulationPhase =
  'idle' | 'sending' | 'failed' | 'switching' | 'responded' | 'unavailable'

export interface HomeRouteSimulation {
  eventId: number
  phase: HomeRouteSimulationPhase
  primaryChannelId: string | null
  fallbackChannelId: string | null
  activeChannelId: string | null
  latency: number | null
}
