export type SignalConsolePhase =
  'idle' | 'gather' | 'hub_hold' | 'route' | 'respond' | 'settle'

export type SignalCapabilityId = 'access' | 'observe' | 'billing' | 'governance'

export type SignalRequestOrigin = 'auto' | 'pointer'

export type SignalRouteHopState =
  'queued' | 'outbound' | 'processing' | 'returning' | 'returned'

export type SignalLatencyTier = 'low' | 'elevated' | 'high'

export interface SignalRequestSource {
  /** Stable source id, suitable for a keyed list. */
  id: string
  /** Compact, human-readable source label used by the console trace. */
  label: string
  /** ISO-like country code shown in the compact live-source rail. */
  country?: string
}

export interface SignalRouteHop {
  modelId: string
  modelName: string
  state: SignalRouteHopState
}

/**
 * A request trace is deliberately UI-ready: the console does not need to
 * reconstruct the source → gateway → model chain from Canvas internals.
 */
export interface SignalRequestTrace {
  id: string
  origin: SignalRequestOrigin
  phase: SignalConsolePhase
  startedAt: number
  phaseStartedAt: number
  sources: SignalRequestSource[]
  sourceCount: number
  hubLabel: string
  hops: SignalRouteHop[]
  latencyMs?: number
  completedAt?: number
}

export interface SignalConsoleSnapshot {
  /** Canvas' focused lifecycle phase; idle while only completed traces remain. */
  phase: SignalConsolePhase
  activeCapability: SignalCapabilityId

  /** Incremented only when a lifecycle or trace event occurs, never per frame. */
  eventId?: number
  /** Backwards-compatible alias for consumers already using sequence. */
  sequence?: number
  sceneTimeMs?: number
  focusRequestId?: string

  /** Active requests followed by up to four most recently completed requests. */
  traces?: SignalRequestTrace[]
  activeRequests?: number

  /** Last five completed request latencies, and their rounded average. */
  averageLatencyMs?: number
  lastLatencyMs?: number
  latencyTier?: SignalLatencyTier
  /** Increments once per completed response so the latency glyph can pulse once. */
  latencyEventId?: number

  /** Existing compact-console fields retained during the UI migration. */
  modelName?: string
  latencyMs?: number
  sourceCount?: number
  targetCount?: number
}

export const INITIAL_SIGNAL_SNAPSHOT: SignalConsoleSnapshot = {
  phase: 'idle',
  activeCapability: 'governance',
  activeRequests: 0,
  sourceCount: 0,
  targetCount: 0,
  traces: [],
  eventId: 0,
  sequence: 0,
  sceneTimeMs: 0,
  latencyEventId: 0,
}

export const SIGNAL_CAPABILITIES: {
  id: SignalCapabilityId
  titleKey: string
  detailKey: string
}[] = [
  {
    id: 'access',
    titleKey: 'signalConsole.capabilities.access.title',
    detailKey: 'signalConsole.capabilities.access.detail',
  },
  {
    id: 'observe',
    titleKey: 'signalConsole.capabilities.observe.title',
    detailKey: 'signalConsole.capabilities.observe.detail',
  },
  {
    id: 'billing',
    titleKey: 'signalConsole.capabilities.billing.title',
    detailKey: 'signalConsole.capabilities.billing.detail',
  },
  {
    id: 'governance',
    titleKey: 'signalConsole.capabilities.governance.title',
    detailKey: 'signalConsole.capabilities.governance.detail',
  },
]
