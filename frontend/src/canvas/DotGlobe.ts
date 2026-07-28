// 登录页点阵地球：正交投影的陆地点云 + 城市间弧线数据包。
// 「AI 中转」的具象：请求从一座城市升起，沿弧线抵达另一座城市。
// 颜色全部来自语义令牌（运行时解析），纸底上呈现日间橄榄墨点 / 夜间雾蓝星点。
import { resolveToken } from '@/charts/palette'
import { normalizeOpaqueColor } from '@/utils/cssColor'
import { withAlpha } from './theme'
import { landnessDeg } from './worldMask'

const DPR_CAP = 2
const POINT_COUNT = 3200 // fibonacci 球面采样总数（过滤后仅剩陆地点）
const ROTATE_SPEED = 0.045 // rad/s — 一圈约 140s，静谧自转
const ARC_MAX = 3

/** 主要接入城市（lat, lon）— 弧线在这些锚点间往返。 */
const HUBS: [number, number][] = [
  [39.9, 116.4], // Beijing
  [1.35, 103.8], // Singapore
  [35.7, 139.7], // Tokyo
  [50.1, 8.7], // Frankfurt
  [51.5, -0.1], // London
  [37.8, -122.4], // San Francisco
  [40.7, -74.0], // New York
  [-33.9, 151.2], // Sydney
]

interface Palette {
  dot: string
  dotFaint: string
  rim: string
  sphere: string
  arc: string
  packet: string
  hub: string
}

interface Arc {
  a: number // HUBS index
  b: number
  progress: number
  durationMs: number
}

export class DotGlobe {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private palette: Palette
  private land: { lat: number; lon: number }[] = []
  private arcs: Arc[] = []
  private w = 0
  private h = 0
  private raf = 0
  private running = false
  private lastTs = 0
  private rotation = 0
  private reduced: boolean

  constructor(canvas: HTMLCanvasElement, reduced = false) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.reduced = reduced
    this.palette = this.resolvePalette()
    this.sampleLand()
    this.seedArcs()
  }

  /** 语义令牌 → 画布色。主题切换后由宿主再调一次。 */
  refreshPalette(): void {
    this.palette = this.resolvePalette()
    if (this.reduced) this.drawFrame()
  }

  private resolvePalette(): Palette {
    const signal = normalizeOpaqueColor(resolveToken('--signal'), '#74765a')
    const accent = normalizeOpaqueColor(resolveToken('--accent'), '#d8984c')
    const surface = normalizeOpaqueColor(
      resolveToken('--surface-solid'),
      '#fffdf8'
    )
    const glow = normalizeOpaqueColor(resolveToken('--glow'), '#7fa463')
    return {
      dot: withAlpha(signal, 0.55),
      dotFaint: withAlpha(signal, 0.22),
      rim: withAlpha(signal, 0.16),
      sphere: surface,
      arc: withAlpha(accent, 0.4),
      packet: accent,
      hub: glow,
    }
  }

  /** fibonacci 球面均匀采样，仅保留陆地点（landness > 抖动阈值柔化海岸）。 */
  private sampleLand(): void {
    const GOLDEN = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < POINT_COUNT; i++) {
      const y = 1 - (2 * i) / (POINT_COUNT - 1)
      const r = Math.sqrt(Math.max(0, 1 - y * y))
      const theta = i * GOLDEN
      const x = Math.cos(theta) * r
      const z = Math.sin(theta) * r
      const lat = (Math.asin(y) * 180) / Math.PI
      const lon = (Math.atan2(z, x) * 180) / Math.PI
      const land = landnessDeg(lon, lat)
      // 抖动阈值：海岸线得到疏点过渡而非硬边
      if (land > 0.3 + ((i * 0.618) % 1) * 0.35) {
        this.land.push({ lat, lon })
      }
    }
  }

  private seedArcs(): void {
    for (let i = 0; i < ARC_MAX; i++) this.arcs.push(this.newArc(i * 0.33))
  }

  private newArc(progress = 0): Arc {
    const a = Math.floor(Math.random() * HUBS.length)
    let b = Math.floor(Math.random() * HUBS.length)
    if (b === a) b = (b + 3) % HUBS.length
    return { a, b, progress, durationMs: 4200 + Math.random() * 2600 }
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    this.w = rect.width
    this.h = rect.height
    this.canvas.width = Math.round(rect.width * dpr)
    this.canvas.height = Math.round(rect.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (this.reduced) this.drawFrame()
  }

  start(): void {
    if (this.running) return
    if (this.reduced) {
      this.drawFrame()
      return
    }
    this.running = true
    this.lastTs = performance.now()
    const loop = (ts: number) => {
      if (!this.running) return
      const delta = Math.min(64, ts - this.lastTs)
      this.lastTs = ts
      this.rotation += (ROTATE_SPEED * delta) / 1000
      for (let i = 0; i < this.arcs.length; i++) {
        const arc = this.arcs[i]
        arc.progress += delta / arc.durationMs
        if (arc.progress >= 1.25) this.arcs[i] = this.newArc()
      }
      this.drawFrame()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    this.running = false
    cancelAnimationFrame(this.raf)
  }

  dispose(): void {
    this.stop()
    this.land = []
    this.arcs = []
  }

  /** lat/lon(deg) + 当前自转 → 单位球 3D（z 朝观察者）。 */
  private project(
    lat: number,
    lon: number
  ): { x: number; y: number; z: number } {
    const phi = (lat * Math.PI) / 180
    const lambda = (lon * Math.PI) / 180 + this.rotation
    const cosPhi = Math.cos(phi)
    return {
      x: cosPhi * Math.sin(lambda),
      y: Math.sin(phi),
      z: cosPhi * Math.cos(lambda),
    }
  }

  private drawFrame(): void {
    const { ctx, palette } = this
    ctx.clearRect(0, 0, this.w, this.h)
    const R = Math.min(this.w, this.h) * 0.46
    const cx = this.w / 2
    const cy = this.h / 2

    // 球体量感：左上受光的柔和渐变 — 保持极淡，点阵才是主角
    const grad = ctx.createRadialGradient(
      cx - R * 0.35,
      cy - R * 0.4,
      R * 0.1,
      cx,
      cy,
      R
    )
    grad.addColorStop(0, withAlpha(palette.sphere, 0.55))
    grad.addColorStop(0.7, withAlpha(palette.sphere, 0.2))
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, R, 0, Math.PI * 2)
    ctx.fill()

    // 轮廓细环
    ctx.strokeStyle = palette.rim
    ctx.lineWidth = 1
    ctx.stroke()

    // 陆地点云（背面剔除；靠边缘的点更小更淡 = 球面透视）
    for (const p of this.land) {
      const v = this.project(p.lat, p.lon)
      if (v.z <= 0.02) continue
      const sx = cx + v.x * R
      const sy = cy - v.y * R
      const size = 0.7 + v.z * 1.15
      ctx.fillStyle = v.z > 0.4 ? palette.dot : palette.dotFaint
      ctx.beginPath()
      ctx.arc(sx, sy, size, 0, Math.PI * 2)
      ctx.fill()
    }

    // 城市弧线 + 数据包
    for (const arc of this.arcs) {
      const A = this.project(HUBS[arc.a][0], HUBS[arc.a][1])
      const B = this.project(HUBS[arc.b][0], HUBS[arc.b][1])
      if (A.z <= 0.08 || B.z <= 0.08) continue
      const ax = cx + A.x * R
      const ay = cy - A.y * R
      const bx = cx + B.x * R
      const by = cy - B.y * R
      // 控制点：弦中点沿远离球心方向抬升，弧永远隆起在球外
      const mx = (ax + bx) / 2
      const my = (ay + by) / 2
      const dx = mx - cx
      const dy = my - cy
      const dLen = Math.hypot(dx, dy) || 1
      const chord = Math.hypot(bx - ax, by - ay)
      const lift = Math.max(R * 1.06, dLen + chord * 0.35)
      const cxp = cx + (dx / dLen) * lift
      const cyp = cy + (dy / dLen) * lift

      const t = Math.min(1, arc.progress)
      // 弧线本体（progress 内的部分逐渐显现）
      ctx.strokeStyle = palette.arc
      ctx.lineWidth = 1.1
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      const STEPS = 24
      const upto = Math.round(STEPS * t)
      for (let s = 1; s <= upto; s++) {
        const u = s / STEPS
        const iu = 1 - u
        ctx.lineTo(
          iu * iu * ax + 2 * iu * u * cxp + u * u * bx,
          iu * iu * ay + 2 * iu * u * cyp + u * u * by
        )
      }
      ctx.stroke()

      // 端点微光
      ctx.fillStyle = withAlpha(palette.hub, 0.7)
      ctx.beginPath()
      ctx.arc(ax, ay, 2.2, 0, Math.PI * 2)
      ctx.fill()

      // 包头
      if (t < 1) {
        const iu = 1 - t
        const px = iu * iu * ax + 2 * iu * t * cxp + t * t * bx
        const py = iu * iu * ay + 2 * iu * t * cyp + t * t * by
        ctx.fillStyle = palette.packet
        ctx.beginPath()
        ctx.arc(px, py, 2.6, 0, Math.PI * 2)
        ctx.fill()
      } else {
        // 抵达：终点脉冲随余量衰减
        const fade = 1 - (arc.progress - 1) / 0.25
        ctx.strokeStyle = withAlpha(palette.packet, 0.5 * fade)
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(bx, by, 3 + (1 - fade) * 9, 0, Math.PI * 2)
        ctx.stroke()
      }
    }
  }
}
