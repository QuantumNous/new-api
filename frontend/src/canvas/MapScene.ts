import { WorldMap } from './WorldMap'
import { CharRain } from './CharRain'
import { ModelMarker, UserNode, HubNode } from './MapNode'
import { UserChannel } from './UserChannel'
import { Flyline } from './Flyline'
import { ArcPacket, Particle } from './sceneParts'
import { arcAway } from './arc'
import { landnessDeg } from './worldMask'
import { loadIcon } from './iconLoader'
import { canStartCanvasRequest } from './requestGate'
import { getCanvasTheme, type CanvasTheme, type CanvasThemeName } from './theme'
import { MODEL_NODES } from '@/constants/home/models'
import { MODEL_GEO, SOURCE_GEO } from '@/constants/home/modelGeo'
import { BRAND_LOGO_PATH } from '@/constants/branding'
import type {
  SignalCapabilityId,
  SignalConsolePhase,
  SignalConsoleSnapshot,
  SignalLatencyTier,
  SignalRequestOrigin,
  SignalRequestSource,
  SignalRequestTrace,
  SignalRouteHop,
} from '@/constants/home/signalConsole'

interface Ripple {
  x: number
  y: number
  r: number
  max: number
  color: string
  themed: boolean
  life: number
}

interface RouteProgramme {
  targetIds: string[]
  latencyMs: number
}

type AutoTrafficKind = 'quick' | 'burst' | 'remote'

interface AutoTrafficProfile extends RouteProgramme {
  kind: AutoTrafficKind
  sourceIndexes: number[]
  /** Calm period after the group settles, used to vary the scene cadence. */
  quietMs: number
  /** Scales the request journey while retaining the same lifecycle phases. */
  tempo: number
}

interface RequestTiming {
  gatherMs: number
  hubHoldMs: number
  routeMs: number
  routeOutboundMs: number
  modelProcessMs: number
  routeReturnMs: number
  respondMs: number
  settleMs: number
}

interface CreateGroupOptions {
  autoQuietMs?: number
  tempo?: number
}

interface RequestGroup {
  id: string
  origin: SignalRequestOrigin
  users: UserNode[]
  channels: UserChannel[]
  flylines: Flyline[]
  packets: ArcPacket[]
  markers: ModelMarker[]
  hub: { x: number; y: number }
  preferredTargetIds: string[]
  trace: SignalRequestTrace
  phase: Exclude<SignalConsolePhase, 'idle'>
  phaseStartedAt: number
  phaseEndsAt: number
  gatherPending: number
  processingDueAt: Map<string, number>
  timing: RequestTiming
  autoQuietMs?: number
  plannedLatencyMs: number
  latencyRecorded: boolean
}

const SOURCE_ORIGINS = [
  { label: 'NA-CENTRAL', country: 'US' },
  { label: 'US-EAST', country: 'US' },
  { label: 'MX-CITY', country: 'MX' },
  { label: 'BR-SOUTH', country: 'BR' },
  { label: 'AR-EDGE', country: 'AR' },
  { label: 'EU-CENTRAL', country: 'DE' },
  { label: 'EU-WEST', country: 'ES' },
  { label: 'AF-WEST', country: 'NG' },
  { label: 'AF-SOUTH', country: 'ZA' },
  { label: 'IN-CORE', country: 'IN' },
  { label: 'ME-GATE', country: 'IR' },
  { label: 'KR-SEOUL', country: 'KR' },
  { label: 'SG-EDGE', country: 'SG' },
  { label: 'AU-SYDNEY', country: 'AU' },
] as const

/** Pointer traffic stays legible while the automatic programme varies by round. */
const POINTER_REQUEST_PROGRAMME: readonly RouteProgramme[] = [
  { targetIds: ['openai', 'claude'], latencyMs: 84 },
  { targetIds: ['deepseek', 'qwen'], latencyMs: 112 },
  { targetIds: ['gemini', 'grok'], latencyMs: 136 },
  { targetIds: ['kimi', 'zhipu'], latencyMs: 72 },
]

/**
 * Full-screen map orchestrator. The visual scene still renders every frame,
 * while the request programme only publishes lifecycle-level telemetry events.
 */
export class MapScene {
  // The default request narrative is about seven seconds including its quiet
  // window; automatic profiles vary that cadence without skipping a phase.
  private static readonly INITIAL_IDLE_MS = 1000
  private static readonly IDLE_MS = 2000
  private static readonly GATHER_MS = 1200
  private static readonly HUB_HOLD_MS = 500
  private static readonly ROUTE_OUTBOUND_MS = 700
  private static readonly MODEL_PROCESS_MS = 500
  private static readonly ROUTE_RETURN_MS = 700
  private static readonly RESPOND_MS = 900
  private static readonly SETTLE_MS = 500
  private static readonly FRAME_MS = 1000 / 60
  // Cap fixed-timestep catch-up so a tab resuming from background can't run a
  // huge update loop (mirrors the 100ms deltaMs clamp in frame()).
  private static readonly MAX_CATCHUP_STEPS = 4
  private static readonly EDGE_DWELL_MS = 500
  private static readonly POINTER_COOLDOWN_MS = 450
  private static readonly MAX_ACTIVE_GROUPS = 4

  private ctx: CanvasRenderingContext2D
  private w = 0
  private h = 0
  private dpr = 1
  private t = 0
  private sceneTimeMs = 0
  /** Sub-frame remainder carried by the fixed-timestep loop (see update()). */
  private frameAccumulator = 0
  private reduced: boolean
  private theme: CanvasTheme

  private map: WorldMap
  private rain: CharRain
  private markers: ModelMarker[] = []
  private users: UserNode[] = []
  private channels: UserChannel[] = []
  private hub = new HubNode()
  private flylines: Flyline[] = []
  private packets: ArcPacket[] = []
  private particles: Particle[] = []
  private ripples: Ripple[] = []
  private links: { mk: ModelMarker; activity: number }[] = []

  private mouse = { x: 0, y: 0, active: false }
  private prevMouseX = 0
  private prevMouseY = 0
  private parallax = { x: 0, y: 0 }
  private parallaxAmp = 14

  private edgePointer = { x: 0, width: 0, active: false }
  private edgeSide: -1 | 0 | 1 = 0
  private edgeSince = 0
  private edgeBoosting = false

  private groups: RequestGroup[] = []
  private completedTraces: SignalRequestTrace[] = []
  private latencySamples: number[] = []
  private lastLatencyMs?: number
  private latencyEventId = 0
  private signalSequence = 0
  private requestSequence = 0
  private pointerProgrammeIndex = 0
  private lastPointerRequestAt = Number.NEGATIVE_INFINITY
  private lastAutoTrafficKind?: AutoTrafficKind
  private autoNextAt = MapScene.INITIAL_IDLE_MS

  private raf = 0
  private running = false
  private disposed = false
  private lastFrame = 0

  constructor(
    private canvas: HTMLCanvasElement,
    private readonly onSignalChange?: (snapshot: SignalConsoleSnapshot) => void,
    initialTheme: CanvasThemeName = 'dark'
  ) {
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) throw new Error('MapScene: 2D canvas context unavailable')
    this.ctx = ctx
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.theme = getCanvasTheme(initialTheme)
    this.map = new WorldMap(this.reduced, this.theme)
    this.rain = new CharRain(this.ctx, this.reduced)
    this.hub.setTheme(this.theme)
    this.resize()
    // 立即绘制背景帧：点阵已在 setLayout 中建好，不必等图标加载——
    // 消除 alpha:false 画布在 init 前的黑色闪烁。
    this.map.draw(this.ctx)
    this.rain.draw(this.theme)
  }

  setTheme(name: CanvasThemeName) {
    const next = getCanvasTheme(name)
    if (next.name === this.theme.name) return
    this.theme = next
    this.map.setTheme(next)
    this.hub.setTheme(next)
    for (const marker of this.markers) marker.setTheme(next)
    for (const user of this.users) user.setTheme(next)
    for (const ripple of this.ripples)
      if (ripple.themed) ripple.color = next.accent
    this.draw()
  }

  async init(): Promise<void> {
    const images = await Promise.all(
      MODEL_NODES.map((model) => loadIcon(model.icon).catch(() => new Image()))
    )
    const imageById = new Map(
      MODEL_NODES.map((model, index) => [model.id, images[index]])
    )
    if (this.disposed) return
    this.markers = MODEL_GEO.map((geo) => {
      const model = MODEL_NODES.find((candidate) => candidate.id === geo.id)
      return new ModelMarker(
        geo.id,
        model?.name ?? geo.id,
        imageById.get(geo.id) ?? new Image(),
        this.nodeRadius(),
        this.theme
      )
    })
    loadIcon(BRAND_LOGO_PATH)
      .then((image) => {
        if (!this.disposed) this.hub.setLogo(image)
      })
      .catch(() => {})
    this.placeMarkers()
    this.placeHub()
    this.publishSignal()
  }

  private placeHub() {
    const radius = this.w < 640 ? 16 : 22
    // On desktop the gateway becomes the hinge between telemetry, routing, and
    // copy. On smaller screens it rises into the reserved stage strip above
    // the frosted content card, so the routing story stays visible.
    const desktop = this.w >= 1024
    const mobileHubY = this.h < 700 ? 0.16 : 0.21
    this.hub.setPos(
      this.w * (desktop ? 0.43 : 0.5),
      this.h * (desktop ? 0.52 : mobileHubY),
      radius
    )
    this.buildLinks()
  }

  private buildLinks() {
    if (!this.markers.length) return
    const previousActivity = new Map(
      this.links.map((link) => [link.mk, link.activity])
    )
    this.links = this.markers.map((marker) => ({
      mk: marker,
      activity: previousActivity.get(marker) ?? 0,
    }))
  }

  private nodeRadius(): number {
    return this.w < 640 ? 13 : 16
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    const rect = this.canvas.getBoundingClientRect()
    this.w = rect.width
    this.h = rect.height
    this.canvas.width = Math.floor(this.w * this.dpr)
    this.canvas.height = Math.floor(this.h * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.map.setLayout(this.w, this.h)
    this.rain.setLayout(this.w, this.h)
    if (!this.markers.length) return
    this.markers.forEach((marker) => (marker.r = this.nodeRadius()))
    this.placeMarkers()
    this.placeHub()
  }

  private placeMarkers() {
    if (!this.markers.length) return
    const baseLift = this.nodeRadius() + 8
    interface Cluster {
      ax: number
      ay: number
      lon: number
      lat: number
      items: ModelMarker[]
    }
    const clusters: Cluster[] = []
    const threshold = 26
    for (const geo of MODEL_GEO) {
      const marker = this.markers.find((candidate) => candidate.id === geo.id)
      if (!marker) continue
      const point = this.map.project(geo.lon, geo.lat)
      let cluster = clusters.find(
        (candidate) =>
          Math.abs(candidate.ax - point.x) < threshold &&
          Math.abs(candidate.ay - point.y) < threshold
      )
      if (!cluster) {
        cluster = {
          ax: point.x,
          ay: point.y,
          lon: geo.lon,
          lat: geo.lat,
          items: [],
        }
        clusters.push(cluster)
      }
      cluster.items.push(marker)
    }
    for (const cluster of clusters) {
      if (cluster.items.length === 1) {
        cluster.items[0].setAnchor(cluster.lon, cluster.lat, 0, -baseLift)
        continue
      }
      const spread = 44
      cluster.items.forEach((marker, index) => {
        const fraction = index / (cluster.items.length - 1)
        const theta = (-65 + fraction * 130) * (Math.PI / 180)
        marker.setAnchor(
          cluster.lon,
          cluster.lat,
          Math.sin(theta) * spread,
          -Math.cos(theta) * spread - baseLift * 0.3
        )
      })
    }
    this.positionMarkers()
  }

  private positionMarkers() {
    for (const marker of this.markers) {
      marker.place(this.map, this.w, this.h)
      if (marker.visible && this.markerIntersectsHeroCopy(marker)) {
        marker.visible = false
      }
    }
  }

  private markerIntersectsHeroCopy(marker: ModelMarker): boolean {
    if (this.w < 1024) return false
    const margin = marker.r + 8
    const x = marker.x + margin
    const y = marker.y
    const headlineZone =
      x >= this.w * 0.68 &&
      y + margin >= this.h * 0.2 &&
      y - margin <= this.h * 0.49
    const actionZone =
      x >= this.w * 0.72 &&
      y + margin >= this.h * 0.49 &&
      y - margin <= this.h * 0.7
    return headlineZone || actionZone
  }

  setMouse(x: number, y: number, active: boolean) {
    if (active && !this.mouse.active) {
      this.prevMouseX = x
      this.prevMouseY = y
    }
    this.mouse = { x, y, active }
  }

  setEdgePointer(clientX: number, viewportWidth: number, active: boolean) {
    this.edgePointer = { x: clientX, width: viewportWidth, active }
    if (!active) this.resetEdgeBoost()
  }

  /** 触摸拖拽转动地图（移动端下方空白区手势）：开始/跟手/释放(带惯性)。 */
  beginMapDrag() {
    this.map.beginDrag()
  }

  dragMapBy(dxPx: number) {
    this.map.dragBy(dxPx)
  }

  endMapDrag(vxPxPerMs: number) {
    this.map.endDrag(vxPxPerMs)
  }

  /** 触摸长按加速自转：factor=目标速度倍率（常态 16 / 沉浸 24），沿用巡航缓动。 */
  beginBoost(factor: number) {
    this.map.setPressBoost(factor)
  }

  endBoost() {
    this.map.setPressBoost(0)
  }

  /** Pointer requests are intentionally unthrottled and can overlap each other. */
  clickAt(mx: number, my: number) {
    const translatedX = mx - this.parallax.x * this.parallaxAmp
    const translatedY = my - this.parallax.y * this.parallaxAmp
    for (const marker of this.markers) {
      if (!marker.visible || !marker.hit(translatedX, translatedY)) continue
      marker.glow = 1
      this.burst(marker.x, marker.y, marker.color)
      this.spawnRipple(marker.x, marker.y, 1, marker.color)
      return
    }

    const geo = this.map.unprojectRot(mx, my)
    if (landnessDeg(geo.lon, geo.lat) < 0.5) return
    if (!this.canStartRequest('pointer')) return
    this.map.addGlow(mx, my)
    this.spawnRipple(mx, my, 1)

    const programme =
      POINTER_REQUEST_PROGRAMME[
        this.pointerProgrammeIndex % POINTER_REQUEST_PROGRAMME.length
      ]
    this.pointerProgrammeIndex += 1
    const nearestSource = this.sourceForIndex(this.nearestSourceIndex(geo))
    const source: SignalRequestSource = {
      id: `pointer-${this.pointerProgrammeIndex}`,
      label: `POINTER ${nearestSource.label}`,
      country: nearestSource.country,
    }
    const group = this.createGroup(
      'pointer',
      [{ geo, source }],
      programme.targetIds,
      programme.latencyMs
    )
    if (group) this.lastPointerRequestAt = this.sceneTimeMs
  }

  private canStartRequest(origin: SignalRequestOrigin): boolean {
    const limit = this.reduced || this.w < 640 ? 2 : MapScene.MAX_ACTIVE_GROUPS
    return canStartCanvasRequest({
      activeRequests: this.groups.length,
      maxActiveRequests: limit,
      origin,
      nowMs: this.sceneTimeMs,
      lastPointerRequestAt: this.lastPointerRequestAt,
      pointerCooldownMs: MapScene.POINTER_COOLDOWN_MS,
    })
  }

  private advanceAutoProgramme() {
    const hasAutomaticGroup = this.groups.some(
      (group) => group.origin === 'auto'
    )
    if (
      this.sceneTimeMs < this.autoNextAt ||
      hasAutomaticGroup ||
      !this.markers.length
    )
      return

    const profile = this.createAutoTrafficProfile()
    const sources = profile.sourceIndexes.map((index) => ({
      geo: SOURCE_GEO[index],
      source: this.sourceForIndex(index),
    }))
    const group = this.createGroup(
      'auto',
      sources,
      profile.targetIds,
      profile.latencyMs,
      {
        autoQuietMs: profile.quietMs,
        tempo: profile.tempo,
      }
    )

    // A running automatic group owns the next tick. Pointer activity neither
    // blocks the group nor changes its schedule.
    this.autoNextAt = group
      ? Number.POSITIVE_INFINITY
      : this.sceneTimeMs + MapScene.IDLE_MS
  }

  /** Selects a distinct visual rhythm for every automatic request round. */
  private createAutoTrafficProfile(): AutoTrafficProfile {
    const kind = this.nextAutoTrafficKind()
    const sourcePool = this.autoSourceIndexes()

    if (kind === 'quick') {
      return {
        kind,
        sourceIndexes: this.sampleDistinct(sourcePool, 1),
        targetIds: this.sampleDistinct(
          MODEL_GEO.map((model) => model.id),
          1
        ),
        latencyMs: this.randomWhole(62, 94),
        quietMs: this.randomWhole(850, 1350),
        tempo: this.randomBetween(0.86, 0.94),
      }
    }

    if (kind === 'burst') {
      const maxSources = this.reduced || this.w < 640 ? 2 : 3
      const maxTargets = this.reduced || this.w < 640 ? 2 : 3
      return {
        kind,
        sourceIndexes: this.sampleDistinct(
          sourcePool,
          this.randomWhole(2, maxSources)
        ),
        targetIds: this.sampleDistinct(
          MODEL_GEO.map((model) => model.id),
          this.randomWhole(2, maxTargets)
        ),
        latencyMs: this.randomWhole(92, 142),
        quietMs: this.randomWhole(1350, 2050),
        tempo: this.randomBetween(0.96, 1.04),
      }
    }

    const sourceCount =
      this.reduced || this.w < 640 ? 1 : this.randomWhole(1, 2)
    const sourceIndexes = this.sampleDistinct(sourcePool, sourceCount)
    return {
      kind,
      sourceIndexes,
      targetIds: this.farthestModelIds(
        sourceIndexes,
        this.reduced || this.w < 640 ? 1 : this.randomWhole(1, 2)
      ),
      latencyMs: this.randomWhole(132, 198),
      quietMs: this.randomWhole(1800, 2600),
      tempo: this.randomBetween(1.05, 1.14),
    }
  }

  private nextAutoTrafficKind(): AutoTrafficKind {
    const roll = Math.random()
    let kind: AutoTrafficKind =
      roll < 0.32 ? 'quick' : roll < 0.72 ? 'burst' : 'remote'
    if (kind === this.lastAutoTrafficKind) {
      const alternatives = (['quick', 'burst', 'remote'] as const).filter(
        (candidate) => candidate !== kind
      )
      kind = alternatives[Math.floor(Math.random() * alternatives.length)]
    }
    this.lastAutoTrafficKind = kind
    return kind
  }

  /** Prefer sources that are currently readable on screen, with a global fallback. */
  private autoSourceIndexes(): number[] {
    const margin = this.w < 640 ? 24 : 48
    const hubAvoidance = Math.max(96, this.w * 0.13)
    const visible = SOURCE_GEO.flatMap((source, index) => {
      const point = this.map.projectRot(source.lon, source.lat)
      const inView =
        point.x > -margin &&
        point.x < this.w + margin &&
        point.y > -margin &&
        point.y < this.h + margin
      const awayFromHub =
        Math.hypot(point.x - this.hub.x, point.y - this.hub.y) > hubAvoidance
      return inView && awayFromHub ? [index] : []
    })
    return visible.length >= 2 ? visible : SOURCE_GEO.map((_, index) => index)
  }

  /** Favour long geographic source-to-model paths for the remote profile. */
  private farthestModelIds(sourceIndexes: number[], count: number): string[] {
    const sources = sourceIndexes
      .map((index) => SOURCE_GEO[index])
      .filter((source): source is { lon: number; lat: number } =>
        Boolean(source)
      )
    if (!sources.length)
      return this.sampleDistinct(
        MODEL_GEO.map((model) => model.id),
        count
      )

    const ranked = MODEL_GEO.map((model) => ({
      id: model.id,
      distance:
        sources.reduce(
          (sum, source) => sum + this.geoDistance(source, model),
          0
        ) / sources.length,
    })).sort((left, right) => right.distance - left.distance)
    const farPool = ranked
      .slice(0, Math.max(count, Math.ceil(ranked.length * 0.42)))
      .map((entry) => entry.id)
    return this.sampleDistinct(farPool, count)
  }

  private geoDistance(
    left: { lon: number; lat: number },
    right: { lon: number; lat: number }
  ): number {
    const longitudeDelta = Math.abs(left.lon - right.lon)
    const wrappedLongitudeDelta = Math.min(longitudeDelta, 360 - longitudeDelta)
    const latitudeDelta = left.lat - right.lat
    const meanLatitude = ((left.lat + right.lat) * Math.PI) / 360
    return (
      latitudeDelta * latitudeDelta +
      (wrappedLongitudeDelta * Math.cos(meanLatitude)) ** 2
    )
  }

  private sampleDistinct<T>(items: readonly T[], count: number): T[] {
    const pool = [...items]
    const result: T[] = []
    while (pool.length && result.length < count) {
      result.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0])
    }
    return result
  }

  private randomWhole(min: number, max: number): number {
    return Math.floor(this.randomBetween(min, max + 1))
  }

  private randomBetween(min: number, max: number): number {
    return min + Math.random() * (max - min)
  }

  private sourceForIndex(index: number): SignalRequestSource {
    const origin = SOURCE_ORIGINS[index]
    return {
      id: `source-${index}`,
      label: origin?.label ?? `EDGE-${String(index + 1).padStart(2, '0')}`,
      country: origin?.country,
    }
  }

  private nearestSourceIndex(geo: { lon: number; lat: number }): number {
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY

    SOURCE_GEO.forEach((source, index) => {
      const longitudeDelta = Math.abs(source.lon - geo.lon)
      const wrappedLongitudeDelta = Math.min(
        longitudeDelta,
        360 - longitudeDelta
      )
      const latitudeDelta = source.lat - geo.lat
      const distance =
        latitudeDelta * latitudeDelta +
        wrappedLongitudeDelta * wrappedLongitudeDelta
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return nearestIndex
  }

  private createGroup(
    origin: SignalRequestOrigin,
    sourceEntries: {
      geo: { lon: number; lat: number }
      source: SignalRequestSource
    }[],
    preferredTargetIds: string[],
    plannedLatencyMs: number,
    options: CreateGroupOptions = {}
  ): RequestGroup | undefined {
    if (
      !this.markers.length ||
      !sourceEntries.length ||
      !this.canStartRequest(origin)
    )
      return undefined
    const now = this.sceneTimeMs
    const timing = this.requestTiming(options.tempo ?? 1)
    const id = `${origin}-${++this.requestSequence}`
    const trace: SignalRequestTrace = {
      id,
      origin,
      phase: 'gather',
      startedAt: now,
      phaseStartedAt: now,
      sources: sourceEntries.map(({ source }) => ({ ...source })),
      sourceCount: sourceEntries.length,
      hubLabel: 'MODEL GATEWAY',
      hops: [],
    }
    const group: RequestGroup = {
      id,
      origin,
      users: [],
      channels: [],
      flylines: [],
      packets: [],
      markers: [],
      hub: { x: this.hub.x, y: this.hub.y },
      preferredTargetIds: [...preferredTargetIds],
      trace,
      phase: 'gather',
      phaseStartedAt: now,
      phaseEndsAt: now + timing.gatherMs,
      gatherPending: sourceEntries.length,
      processingDueAt: new Map(),
      timing,
      autoQuietMs: options.autoQuietMs,
      plannedLatencyMs,
      latencyRecorded: false,
    }
    for (const [index, entry] of sourceEntries.entries()) {
      const user = new UserNode(entry.geo.lon, entry.geo.lat, this.theme)
      user.place(this.map, this.w, this.h)
      this.users.push(user)
      group.users.push(user)

      const gatherScale = timing.gatherMs / MapScene.GATHER_MS
      const delayMs = Math.round(index * 120 * gatherScale)
      const establishMs = Math.round(380 * gatherScale)
      const transmitMs = Math.max(260, timing.gatherMs - delayMs - establishMs)
      const channel = new UserChannel(
        () => user.head(),
        group.hub,
        { establishMs, transmitMs, fadeMs: 640, delayMs },
        () => this.onUserArrivedAtHub(group),
        this.reduced
      )
      this.channels.push(channel)
      group.channels.push(channel)
    }
    this.groups.push(group)
    this.publishSignal()
    return group
  }

  private requestTiming(tempo: number): RequestTiming {
    const scale = (duration: number) => Math.round(duration * tempo)
    const routeOutboundMs = scale(MapScene.ROUTE_OUTBOUND_MS)
    const modelProcessMs = scale(MapScene.MODEL_PROCESS_MS)
    const routeReturnMs = scale(MapScene.ROUTE_RETURN_MS)
    return {
      gatherMs: scale(MapScene.GATHER_MS),
      hubHoldMs: scale(MapScene.HUB_HOLD_MS),
      routeMs: routeOutboundMs + modelProcessMs + routeReturnMs,
      routeOutboundMs,
      modelProcessMs,
      routeReturnMs,
      respondMs: scale(MapScene.RESPOND_MS),
      settleMs: scale(MapScene.SETTLE_MS),
    }
  }

  private onUserArrivedAtHub(group: RequestGroup) {
    if (group.phase !== 'gather') return
    group.gatherPending -= 1
    if (group.gatherPending <= 0) this.enterGroupPhase(group, 'hub_hold')
  }

  private enterGroupPhase(
    group: RequestGroup,
    phase: Exclude<SignalConsolePhase, 'idle'>
  ) {
    if (!this.groups.includes(group)) return
    const now = this.sceneTimeMs
    group.phase = phase
    group.phaseStartedAt = now
    group.trace.phase = phase
    group.trace.phaseStartedAt = now

    if (phase === 'hub_hold') {
      group.phaseEndsAt = now + group.timing.hubHoldMs
      this.hub.pulse = 1
      this.spawnRipple(group.hub.x, group.hub.y, 0.7)
    } else if (phase === 'route') {
      group.phaseEndsAt = now + group.timing.routeMs
      this.startRoute(group)
    } else if (phase === 'respond') {
      group.phaseEndsAt = now + group.timing.respondMs
      this.startResponse(group)
    } else if (phase === 'settle') {
      group.phaseEndsAt = now + group.timing.settleMs
      this.recordLatency(group)
      for (const user of group.users) user.release()
    } else {
      group.phaseEndsAt = now + group.timing.gatherMs
    }
    this.publishSignal()
  }

  private startRoute(group: RequestGroup) {
    const selected = this.resolveRouteTargets(group.preferredTargetIds)
    group.markers = selected
    group.trace.hops = selected.map((marker): SignalRouteHop => ({
      modelId: marker.id,
      modelName: marker.name,
      state: 'outbound',
    }))
    const centerX = this.w / 2
    const centerY = this.h / 2
    for (const marker of selected) {
      const link = this.links.find((candidate) => candidate.mk === marker)
      if (link) link.activity = 1
      const flyline = new Flyline(
        group.hub,
        { x: marker.x, y: marker.y },
        () => marker.color,
        group.timing.routeOutboundMs,
        () => this.onOutboundArrived(group, marker),
        centerX,
        centerY
      )
      this.flylines.push(flyline)
      group.flylines.push(flyline)
    }
  }

  private resolveRouteTargets(preferredTargetIds: string[]): ModelMarker[] {
    const visible = this.markers.filter((marker) => marker.visible)
    if (!visible.length) return []
    const preferredVisible = preferredTargetIds
      .map((id) => visible.find((marker) => marker.id === id))
      .filter((marker): marker is ModelMarker => Boolean(marker))
    // Preserve all visible preferred targets; when they are unavailable, the
    // first visible marker is the deterministic on-screen fallback.
    return preferredVisible.length ? preferredVisible : [visible[0]]
  }

  private onOutboundArrived(group: RequestGroup, marker: ModelMarker) {
    if (group.phase !== 'route') return
    const hop = group.trace.hops.find(
      (candidate) => candidate.modelId === marker.id
    )
    if (!hop || hop.state !== 'outbound') return
    marker.glow = 1
    this.burst(marker.x, marker.y, marker.color)
    this.spawnRipple(marker.x, marker.y, 0.9, marker.color)
    hop.state = 'processing'
    group.processingDueAt.set(
      marker.id,
      this.sceneTimeMs + group.timing.modelProcessMs
    )
    this.publishSignal()
  }

  private advanceRoute(group: RequestGroup) {
    for (const [modelId, dueAt] of [...group.processingDueAt]) {
      if (this.sceneTimeMs < dueAt) continue
      const marker = group.markers.find((candidate) => candidate.id === modelId)
      const hop = group.trace.hops.find(
        (candidate) => candidate.modelId === modelId
      )
      group.processingDueAt.delete(modelId)
      if (!marker || !hop || hop.state !== 'processing') continue
      hop.state = 'returning'
      const centerX = this.w / 2
      const centerY = this.h / 2
      const flyline = new Flyline(
        { x: marker.x, y: marker.y },
        group.hub,
        () => marker.color,
        group.timing.routeReturnMs,
        () => this.onReturnArrived(group, marker),
        centerX,
        centerY
      )
      this.flylines.push(flyline)
      group.flylines.push(flyline)
      this.publishSignal()
    }

    const allReturned = group.trace.hops.every(
      (hop) => hop.state === 'returned'
    )
    if (this.sceneTimeMs >= group.phaseEndsAt && allReturned)
      this.enterGroupPhase(group, 'respond')
  }

  private onReturnArrived(group: RequestGroup, marker: ModelMarker) {
    if (group.phase !== 'route') return
    const hop = group.trace.hops.find(
      (candidate) => candidate.modelId === marker.id
    )
    if (!hop || hop.state !== 'returning') return
    hop.state = 'returned'
    this.hub.pulse = Math.max(this.hub.pulse, 0.6)
    this.publishSignal()
  }

  private startResponse(group: RequestGroup) {
    // Surface the simulated latency with the response, then commit it to the
    // rolling metric only when that response visibly finishes.
    group.trace.latencyMs = group.plannedLatencyMs
    for (const user of group.users) {
      const packet = new ArcPacket(
        group.hub,
        () => user.head(),
        group.timing.respondMs,
        () => user.release()
      )
      this.packets.push(packet)
      group.packets.push(packet)
    }
  }

  private recordLatency(group: RequestGroup) {
    if (group.latencyRecorded || group.trace.latencyMs === undefined) return
    group.latencyRecorded = true
    this.lastLatencyMs = group.trace.latencyMs
    this.latencySamples.push(group.trace.latencyMs)
    if (this.latencySamples.length > 5) this.latencySamples.shift()
    this.latencyEventId += 1
  }

  private terminateGroupArtifacts(group: RequestGroup) {
    for (const channel of group.channels) channel.dead = true
    for (const flyline of group.flylines) flyline.dead = true
    for (const packet of group.packets) packet.dead = true
    group.processingDueAt.clear()
  }

  private completeGroup(group: RequestGroup) {
    if (!this.groups.includes(group)) return
    group.trace.completedAt = this.sceneTimeMs
    this.completedTraces.unshift(this.cloneTrace(group.trace))
    this.completedTraces = this.completedTraces.slice(0, 4)
    this.terminateGroupArtifacts(group)
    this.groups = this.groups.filter((candidate) => candidate !== group)

    // Only automatic traffic owns the programme clock. User clicks may pile
    // up without delaying, restarting, or otherwise throttling the next round.
    if (group.origin === 'auto')
      this.autoNextAt =
        this.sceneTimeMs + (group.autoQuietMs ?? MapScene.IDLE_MS)
    this.publishSignal()
  }

  private advanceGroups() {
    for (const group of [...this.groups]) {
      if (group.phase === 'gather') {
        if (this.sceneTimeMs >= group.phaseEndsAt)
          this.enterGroupPhase(group, 'hub_hold')
        continue
      }
      if (group.phase === 'hub_hold') {
        if (this.sceneTimeMs >= group.phaseEndsAt)
          this.enterGroupPhase(group, 'route')
        continue
      }
      if (group.phase === 'route') {
        this.advanceRoute(group)
        continue
      }
      if (group.phase === 'respond') {
        if (this.sceneTimeMs >= group.phaseEndsAt)
          this.enterGroupPhase(group, 'settle')
        continue
      }
      if (this.sceneTimeMs >= group.phaseEndsAt) this.completeGroup(group)
    }
  }

  private capabilityFor(phase: SignalConsolePhase): SignalCapabilityId {
    if (phase === 'gather' || phase === 'hub_hold') return 'access'
    if (phase === 'route') return 'observe'
    if (phase === 'respond' || phase === 'settle') return 'billing'
    return 'governance'
  }

  private focusGroup(): RequestGroup | undefined {
    const latest = [...this.groups].reverse()
    return (
      latest.find((group) => group.origin === 'pointer') ??
      latest.find((group) => group.origin === 'auto')
    )
  }

  private averageLatency(): number | undefined {
    if (!this.latencySamples.length) return undefined
    return Math.round(
      this.latencySamples.reduce((sum, latency) => sum + latency, 0) /
        this.latencySamples.length
    )
  }

  private latencyTier(
    latencyMs: number | undefined
  ): SignalLatencyTier | undefined {
    if (latencyMs === undefined) return undefined
    if (latencyMs < 90) return 'low'
    if (latencyMs <= 130) return 'elevated'
    return 'high'
  }

  private cloneTrace(trace: SignalRequestTrace): SignalRequestTrace {
    return {
      ...trace,
      sources: trace.sources.map((source) => ({ ...source })),
      hops: trace.hops.map((hop) => ({ ...hop })),
    }
  }

  /** Emits a serializable snapshot only after a real request/trace transition. */
  private publishSignal() {
    if (!this.onSignalChange) return
    const focus = this.focusGroup()
    const recent = this.completedTraces[0]
    const focusTrace = focus?.trace ?? recent
    const phase: SignalConsolePhase = focus?.phase ?? 'idle'
    const averageLatencyMs = this.averageLatency()
    const firstHop = focusTrace?.hops[0]
    const eventId = ++this.signalSequence
    this.onSignalChange({
      phase,
      activeCapability: this.capabilityFor(phase),
      eventId,
      sequence: eventId,
      sceneTimeMs: this.sceneTimeMs,
      focusRequestId: focus?.id ?? recent?.id,
      traces: [
        ...this.groups.map((group) => this.cloneTrace(group.trace)),
        ...this.completedTraces.map((trace) => this.cloneTrace(trace)),
      ],
      activeRequests: this.groups.length,
      averageLatencyMs,
      lastLatencyMs: this.lastLatencyMs,
      latencyTier: this.latencyTier(averageLatencyMs),
      latencyEventId: this.latencyEventId,
      modelName: firstHop?.modelName,
      latencyMs: focusTrace?.latencyMs ?? this.lastLatencyMs,
      sourceCount: focusTrace?.sourceCount ?? 0,
      targetCount: focusTrace?.hops.length ?? 0,
    })
  }

  private spawnRipple(x: number, y: number, strength: number, color?: string) {
    this.ripples.push({
      x,
      y,
      r: 0,
      max: 90 + strength * 150,
      color: color ?? this.theme.accent,
      themed: color === undefined,
      life: 1,
    })
    if (this.ripples.length > 14) this.ripples.shift()
  }

  private burst(x: number, y: number, color: string) {
    const count = this.reduced ? 6 : 14
    for (let index = 0; index < count; index++) {
      const themed = index % 2 !== 0
      this.particles.push(
        new Particle(x, y, themed ? this.theme.accent : color, themed)
      )
    }
    if (this.particles.length > 160)
      this.particles.splice(0, this.particles.length - 160)
  }

  private resetEdgeBoost() {
    if (this.edgeBoosting) this.map.setEdgeBoost(0)
    this.edgeSide = 0
    this.edgeSince = 0
    this.edgeBoosting = false
  }

  private trackEdgeDwell() {
    if (this.reduced) return
    const now = performance.now()
    let side: -1 | 0 | 1 = 0
    if (this.edgePointer.active && this.edgePointer.width > 0) {
      const edgeWidth = Math.max(48, this.edgePointer.width * 0.06)
      if (this.edgePointer.x <= edgeWidth) side = -1
      else if (this.edgePointer.x >= this.edgePointer.width - edgeWidth)
        side = 1
    }
    if (side !== this.edgeSide) {
      if (this.edgeBoosting) this.map.setEdgeBoost(0)
      this.edgeSide = side
      this.edgeSince = now
      this.edgeBoosting = false
      return
    }
    if (
      side !== 0 &&
      !this.edgeBoosting &&
      now - this.edgeSince >= MapScene.EDGE_DWELL_MS
    ) {
      this.map.setEdgeBoost(side)
      this.edgeBoosting = true
    }
  }

  private update(deltaMs: number) {
    const clamped = Math.max(0, deltaMs)
    const frameScale = clamped / MapScene.FRAME_MS
    this.sceneTimeMs += clamped
    this.t += frameScale

    const velocityX = this.mouse.active ? this.mouse.x - this.prevMouseX : 0
    const velocityY = this.mouse.active ? this.mouse.y - this.prevMouseY : 0
    this.map.setHover(
      this.mouse.x,
      this.mouse.y,
      this.mouse.active,
      velocityX,
      velocityY
    )
    this.prevMouseX = this.mouse.x
    this.prevMouseY = this.mouse.y

    // Fixed-timestep for the frame-count-based subsystems (globe rotation/breath,
    // gateway hub, model markers, user nodes): their update() bodies advance a
    // fixed amount per call, so we step them once per 60fps-equivalent slice and
    // carry the sub-frame remainder — total steps then track wall-clock exactly,
    // making their speed identical across 60/120/144/165/240Hz. At 60/120/240Hz
    // frameScale≈1 → exactly one step per render (behaviour unchanged); on 144Hz
    // (~48 gated fps) it averages 1.25 steps/render, restoring true 60fps speed.
    // The ms-based subsystems below (channels/packets/flylines/particles) already
    // consume deltaMs directly, so this realigns the two clocks.
    this.frameAccumulator += frameScale
    let steps = Math.floor(this.frameAccumulator)
    this.frameAccumulator -= steps
    if (steps > MapScene.MAX_CATCHUP_STEPS) steps = MapScene.MAX_CATCHUP_STEPS
    for (let s = 0; s < steps; s++) {
      this.map.update()
      this.hub.update(this.reduced)
      for (const marker of this.markers) marker.update()
      for (const user of this.users) user.update()
    }

    this.trackEdgeDwell()

    const targetParallaxX =
      this.mouse.active && !this.reduced ? this.mouse.x / this.w - 0.5 : 0
    const targetParallaxY =
      this.mouse.active && !this.reduced ? this.mouse.y / this.h - 0.5 : 0
    const smoothing = 1 - Math.pow(1 - 0.06, frameScale)
    this.parallax.x += (targetParallaxX - this.parallax.x) * smoothing
    this.parallax.y += (targetParallaxY - this.parallax.y) * smoothing

    this.positionMarkers()
    for (const user of this.users) {
      user.place(this.map, this.w, this.h)
    }
    for (let i = this.users.length - 1; i >= 0; i--) {
      const user = this.users[i]
      if (!user.dead) continue
      for (const group of this.groups) {
        if (group.users.includes(user)) this.terminateGroupArtifacts(group)
      }
      this.users.splice(i, 1)
    }

    for (const channel of this.channels) channel.update(deltaMs)
    for (let i = this.channels.length - 1; i >= 0; i--)
      if (this.channels[i].dead) this.channels.splice(i, 1)
    for (const packet of this.packets) packet.update(deltaMs)
    for (let i = this.packets.length - 1; i >= 0; i--)
      if (this.packets[i].dead) this.packets.splice(i, 1)
    for (const flyline of this.flylines) flyline.update(deltaMs)
    for (let i = this.flylines.length - 1; i >= 0; i--)
      if (this.flylines[i].dead) this.flylines.splice(i, 1)
    for (const particle of this.particles) particle.update(deltaMs)
    for (let i = this.particles.length - 1; i >= 0; i--)
      if (this.particles[i].life <= 0) this.particles.splice(i, 1)

    const rippleRate = 1 - Math.pow(1 - 0.05, frameScale)
    for (const ripple of this.ripples) {
      ripple.r += (ripple.max - ripple.r) * rippleRate
      ripple.life -= 0.014 * frameScale
    }
    for (let i = this.ripples.length - 1; i >= 0; i--)
      if (this.ripples[i].life <= 0) this.ripples.splice(i, 1)
    for (const link of this.links)
      link.activity = Math.max(0, link.activity - 0.006 * frameScale)

    this.advanceGroups()
    this.advanceAutoProgramme()

    if (this.mouse.active) {
      const mx = this.mouse.x - this.parallax.x * this.parallaxAmp
      const my = this.mouse.y - this.parallax.y * this.parallaxAmp
      for (const marker of this.markers) {
        if (marker.visible && marker.hit(mx, my)) {
          marker.glow = Math.max(marker.glow, 0.9)
        }
      }
      if (Math.hypot(mx - this.hub.x, my - this.hub.y) < this.hub.r + 14)
        this.hub.hover = Math.max(this.hub.hover, 0.9)
    }
  }

  private draw() {
    const ctx = this.ctx
    this.map.draw(ctx, this.ripples)
    this.rain.draw(this.theme)
    this.drawRipples(ctx)
    const offsetX = this.parallax.x * this.parallaxAmp
    const offsetY = this.parallax.y * this.parallaxAmp
    ctx.save()
    ctx.translate(offsetX, offsetY)
    this.drawLinks(ctx)
    for (const channel of this.channels) channel.draw(ctx, this.t, this.theme)
    for (const user of this.users) if (user.visible) user.draw(ctx)
    for (const flyline of this.flylines)
      flyline.draw(ctx, this.t, this.reduced, this.theme)
    for (const packet of this.packets) packet.draw(ctx, this.theme)
    for (const marker of this.markers)
      if (marker.visible) marker.draw(ctx, false)
    this.hub.draw(ctx, 'AI Gateway')
    for (const particle of this.particles) particle.draw(ctx, this.theme)
    ctx.restore()
  }

  private drawLinks(ctx: CanvasRenderingContext2D) {
    const center = { x: this.w / 2, y: this.h / 2 }
    for (const link of this.links) {
      if (!link.mk.visible) continue
      const hub = { x: this.hub.x, y: this.hub.y }
      const marker = { x: link.mk.x, y: link.mk.y }
      const control = arcAway(hub, marker, center, 0.2)
      const alpha = 0.05 + link.activity * 0.4
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(hub.x, hub.y)
      ctx.quadraticCurveTo(control.x, control.y, marker.x, marker.y)
      ctx.strokeStyle = this.hexAlpha(link.mk.color, alpha)
      ctx.lineWidth = 0.8 + link.activity * 1.2
      ctx.stroke()
      ctx.restore()
    }
  }

  private hexAlpha(hex: string, alpha: number): string {
    const value = hex.replace('#', '')
    if (value.length < 6) return hex
    return `rgba(${parseInt(value.slice(0, 2), 16)},${parseInt(value.slice(2, 4), 16)},${parseInt(value.slice(4, 6), 16)},${alpha})`
  }

  private drawRipples(ctx: CanvasRenderingContext2D) {
    for (const ripple of this.ripples) {
      ctx.save()
      ctx.globalAlpha = ripple.life * 0.5
      ctx.strokeStyle = ripple.color
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(ripple.x, ripple.y, ripple.r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  private frame = (now: number) => {
    if (!this.running) return
    this.raf = requestAnimationFrame(this.frame)
    const elapsed = now - this.lastFrame
    if (elapsed < MapScene.FRAME_MS - 1) return
    // Preserve wall-clock duration exactly. Quantising the anchor here can
    // double-count time on displays whose rAF cadence sits near 60Hz.
    this.lastFrame = now
    // Cap to ~6 frames so a background tab resuming doesn't teleport animations
    this.update(Math.min(elapsed, 100))
    this.draw()
  }

  start() {
    if (this.running || this.disposed) return
    this.running = true
    // Reset the wall-clock anchor on resume. `sceneTimeMs` remains untouched,
    // so document visibility/intersection pauses freeze instead of skipping.
    this.lastFrame = performance.now()
    this.draw()
    if (this.reduced) return
    this.raf = requestAnimationFrame(this.frame)
  }

  stop() {
    this.running = false
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.resetEdgeBoost()
    this.stop()
    for (const group of this.groups) this.terminateGroupArtifacts(group)
    this.groups = []
    this.users = []
    this.channels = []
    this.flylines = []
    this.packets = []
    this.particles = []
    this.ripples = []
    this.completedTraces = []
    this.latencySamples = []
  }
}
