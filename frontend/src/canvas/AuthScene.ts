// Auth 品牌面板迷你场景：「钥匙星座」。
// 一把 3D 钥匙徽章悬浮于面板中下部，8 个模型 Logo 呈星座散布在上方；
// 金色请求包沿贝塞尔弧从钥匙升向节点，命中时节点脉冲，偶发薄荷绿响应包回落。
// 与首页 MapScene 完全独立（≈1/4 规模），但沿用其视觉词汇：
// arcAway 弧线、请求/响应双色语义、iconLoader 位图缓存、运行闸门模式。
import { arcUp, type Pt } from './arc'
import { loadIcon } from './iconLoader'
import {
  getAuthSceneTheme,
  withAlpha,
  type AuthSceneTheme,
  type CanvasThemeName,
} from './theme'

/** 星座节点：手工调优的固定位（相对面板宽高），保证不压 HTML 文案区。 */
interface StarSpec {
  id: string
  name: string
  icon: string
  x: number // 0..1 相对面板宽
  y: number // 0..1 相对面板高
  depth: number // 视差系数 0.6(远)~1.4(近)，同时影响节点尺寸
}

// 布局约束：HTML 文案区占 y≈0.42~0.62（slogan/标题/tagline）与 y>0.88（ticker），
// 星座压缩在 y≤0.36 的上空带；钥匙落在文案块下方 y≈0.72 的留白区。
const STARS: StarSpec[] = [
  {
    id: 'claude',
    name: 'Claude',
    icon: '/models/claude-color.svg',
    x: 0.18,
    y: 0.11,
    depth: 1.2,
  },
  {
    id: 'openai',
    name: 'GPT',
    icon: '/models/openai.svg',
    x: 0.45,
    y: 0.07,
    depth: 0.9,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: '/models/gemini-color.svg',
    x: 0.83,
    y: 0.13,
    depth: 1.1,
  },
  {
    id: 'kimi',
    name: 'Kimi',
    icon: '/models/kimi-color.svg',
    x: 0.31,
    y: 0.19,
    depth: 0.65,
  },
  {
    id: 'qwen',
    name: 'Qwen',
    icon: '/models/qwen-color.svg',
    x: 0.63,
    y: 0.2,
    depth: 1.35,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    icon: '/models/deepseek-color.svg',
    x: 0.13,
    y: 0.28,
    depth: 0.75,
  },
  {
    id: 'zhipu',
    name: 'GLM',
    icon: '/models/zhipu-color.svg',
    x: 0.42,
    y: 0.31,
    depth: 1.0,
  },
  {
    id: 'grok',
    name: 'Grok',
    icon: '/models/grok.svg',
    x: 0.86,
    y: 0.3,
    depth: 0.8,
  },
]

/** 钥匙锚点：文案块（居中带）下方的留白区，窄栏也不会与标题尾部相撞。 */
const KEY_ANCHOR = { x: 0.6, y: 0.72 }

const DPR_CAP = 2
const PACKET_MAX = 4
const SPAWN_MIN_MS = 1200
const SPAWN_MAX_MS = 2400
const RESPONSE_CHANCE = 0.3
const RESPONSE_DELAY_MS = 600

interface Star extends StarSpec {
  px: number // 布局后的像素坐标
  py: number
  r: number // 图标半径
  phase: number // 浮动相位
  pulse: number // 命中脉冲 0..1（衰减）
  img: HTMLImageElement | null
}

interface Packet {
  from: Pt
  to: Pt
  ctrl: Pt
  progress: number
  durationMs: number
  kind: 'request' | 'response'
  targetIndex: number // request 命中的星座下标（response 为 -1）
}

export class AuthScene {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private theme: AuthSceneTheme
  private stars: Star[] = []
  private packets: Packet[] = []
  private dust: {
    x: number
    y: number
    r: number
    speed: number
    phase: number
  }[] = []
  private keyImg: HTMLImageElement | null = null
  private w = 0
  private h = 0
  private keyPx = { x: 0, y: 0 }
  private raf = 0
  private running = false
  private lastTs = 0
  private spawnAt = 0
  private elapsed = 0
  private hover = -1
  private pointerX = 0.5 // 视差输入（0..1）
  private pointerY = 0.5
  private reduced: boolean

  constructor(
    canvas: HTMLCanvasElement,
    themeName: CanvasThemeName,
    reduced = false
  ) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')
    this.canvas = canvas
    this.ctx = ctx
    this.theme = getAuthSceneTheme(themeName)
    this.reduced = reduced
  }

  async init(): Promise<void> {
    this.stars = STARS.map((s) => ({
      ...s,
      px: 0,
      py: 0,
      r: 0,
      phase: Math.random() * Math.PI * 2,
      pulse: 0,
      img: null,
    }))
    // 图标并行加载；单个失败降级为色点（img 缺省时绘制字母圆）
    await Promise.all(
      this.stars.map(async (s) => {
        try {
          s.img = await loadIcon(s.icon)
        } catch {
          s.img = null
        }
      })
    )
    this.resize()
    this.seedDust()
    if (this.reduced) this.drawStaticFrame()
  }

  /** 3D 钥匙位图（AI 生成）。加载失败时 fallback 为矢量钥匙。 */
  async loadKeyEmblem(src: string): Promise<void> {
    try {
      this.keyImg = await loadIcon(src)
    } catch {
      this.keyImg = null
    }
    if (this.reduced) this.drawStaticFrame()
  }

  setTheme(name: CanvasThemeName): void {
    this.theme = getAuthSceneTheme(name)
    if (this.reduced) this.drawStaticFrame()
  }

  /** 视差输入：面板内指针相对坐标（0..1）。触屏或 reduced 时不调用即可。 */
  setPointer(nx: number, ny: number): void {
    this.pointerX = nx
    this.pointerY = ny
  }

  /** 悬停检测（面板本地像素坐标）；返回命中的模型名（无命中为 null）。 */
  hitTest(x: number, y: number): string | null {
    this.hover = -1
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i]
      const dx = x - s.px
      const dy = y - s.py
      if (dx * dx + dy * dy <= (s.r + 8) * (s.r + 8)) {
        this.hover = i
        return s.name
      }
    }
    return null
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
    this.w = rect.width
    this.h = rect.height
    this.canvas.width = Math.round(rect.width * dpr)
    this.canvas.height = Math.round(rect.height * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    // 布局：节点半径随 depth 与面板宽缩放
    const base = Math.min(this.w, 560) / 24
    for (const s of this.stars) {
      s.px = s.x * this.w
      s.py = s.y * this.h
      s.r = base * (0.75 + s.depth * 0.45)
    }
    this.keyPx = { x: KEY_ANCHOR.x * this.w, y: KEY_ANCHOR.y * this.h }
    if (this.reduced) this.drawStaticFrame()
  }

  start(): void {
    if (this.running || this.reduced) return
    this.running = true
    this.lastTs = performance.now()
    this.spawnAt = this.elapsed + 400
    const loop = (ts: number) => {
      if (!this.running) return
      const delta = Math.min(64, ts - this.lastTs)
      this.lastTs = ts
      this.elapsed += delta
      this.update(delta)
      this.draw()
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
    this.stars = []
    this.packets = []
    this.dust = []
    this.keyImg = null
  }

  // ===== 内部 =====

  private seedDust(): void {
    this.dust = Array.from({ length: 24 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.6 + Math.random() * 1.3,
      speed: 0.006 + Math.random() * 0.014,
      phase: Math.random() * Math.PI * 2,
    }))
  }

  private spawnPacket(): void {
    if (this.packets.length >= PACKET_MAX) return
    const idx = Math.floor(Math.random() * this.stars.length)
    const star = this.stars[idx]
    const from = { x: this.keyPx.x, y: this.keyPx.y - 14 }
    const to = { x: star.px, y: star.py }
    this.packets.push({
      from,
      to,
      ctrl: arcUp(from, to, 0.22),
      progress: 0,
      durationMs: 1400 + Math.random() * 900,
      kind: 'request',
      targetIndex: idx,
    })
  }

  private spawnResponse(star: Star): void {
    const from = { x: star.px, y: star.py }
    const to = { x: this.keyPx.x, y: this.keyPx.y - 14 }
    this.packets.push({
      from,
      to,
      ctrl: arcUp(from, to, 0.18),
      progress: 0,
      durationMs: 1200 + Math.random() * 600,
      kind: 'response',
      targetIndex: -1,
    })
  }

  private update(delta: number): void {
    if (this.elapsed >= this.spawnAt) {
      this.spawnPacket()
      this.spawnAt =
        this.elapsed +
        SPAWN_MIN_MS +
        Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS)
    }

    for (const p of this.packets) {
      p.progress = Math.min(1, p.progress + delta / p.durationMs)
      if (p.progress >= 1 && p.kind === 'request' && p.targetIndex >= 0) {
        const star = this.stars[p.targetIndex]
        star.pulse = 1
        if (Math.random() < RESPONSE_CHANCE) {
          const target = star
          window.setTimeout(() => {
            // 场景可能已销毁/暂停；spawnResponse 读取当前坐标，无陈旧引用问题
            if (this.running) this.spawnResponse(target)
          }, RESPONSE_DELAY_MS)
        }
        p.targetIndex = -2 // 防重复触发
      }
    }
    this.packets = this.packets.filter((p) => p.progress < 1)

    for (const s of this.stars) {
      if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - delta / 900)
    }
  }

  private bezier(p: Packet, t: number): Pt {
    const u = 1 - t
    return {
      x: u * u * p.from.x + 2 * u * t * p.ctrl.x + t * t * p.to.x,
      y: u * u * p.from.y + 2 * u * t * p.ctrl.y + t * t * p.to.y,
    }
  }

  private draw(): void {
    const { ctx, theme } = this
    ctx.clearRect(0, 0, this.w, this.h)

    this.drawDust()
    this.drawPackets()
    for (let i = 0; i < this.stars.length; i++) this.drawStar(i)
    this.drawKey()
    if (this.hover >= 0) this.drawLabel(this.stars[this.hover])
    void theme
  }

  /** reduced-motion：绘制一帧定格构图（星座 + 钥匙 + 两条静态弧）。 */
  private drawStaticFrame(): void {
    const { ctx } = this
    ctx.clearRect(0, 0, this.w, this.h)
    // 两条定格弧线示意路由
    const picks = [this.stars[0], this.stars[4]].filter(Boolean)
    for (const star of picks) {
      const from = { x: this.keyPx.x, y: this.keyPx.y - 14 }
      const to = { x: star.px, y: star.py }
      const c = arcUp(from, to, 0.22)
      ctx.strokeStyle = withAlpha(this.theme.packet, 0.35)
      ctx.lineWidth = 1.2
      ctx.setLineDash([4, 6])
      ctx.beginPath()
      ctx.moveTo(from.x, from.y)
      ctx.quadraticCurveTo(c.x, c.y, to.x, to.y)
      ctx.stroke()
      ctx.setLineDash([])
    }
    for (let i = 0; i < this.stars.length; i++) this.drawStar(i, true)
    this.drawKey(true)
  }

  private drawDust(): void {
    const { ctx, theme } = this
    for (const d of this.dust) {
      d.y -= d.speed * 0.016
      if (d.y < -0.02) {
        d.y = 1.02
        d.x = Math.random()
      }
      const tw = 0.35 + 0.3 * Math.sin(this.elapsed / 900 + d.phase)
      ctx.fillStyle = withAlpha(theme.dust, 0.16 * tw)
      ctx.beginPath()
      ctx.arc(d.x * this.w, d.y * this.h, d.r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  private drawPackets(): void {
    const { ctx, theme } = this
    for (const p of this.packets) {
      const color = p.kind === 'request' ? theme.packet : theme.response
      // 尾迹
      const TAIL = 6
      for (let i = 0; i < TAIL; i++) {
        const t = Math.max(0, p.progress - i * 0.035)
        if (t <= 0) continue
        const pt = this.bezier(p, t)
        const alpha = 0.55 * (1 - i / TAIL) * (p.kind === 'request' ? 1 : 0.85)
        ctx.fillStyle = withAlpha(color, alpha)
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 2.4 - i * 0.28, 0, Math.PI * 2)
        ctx.fill()
      }
      // 头部亮核
      const head = this.bezier(p, p.progress)
      ctx.fillStyle = theme.packetCore
      ctx.beginPath()
      ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = withAlpha(color, 0.8)
      ctx.lineWidth = 1.4
      ctx.stroke()
    }
  }

  private parallax(depth: number): { dx: number; dy: number } {
    // 指针视差：深度越大偏移越大（±6px），静态帧不偏移
    const ox = (this.pointerX - 0.5) * 12
    const oy = (this.pointerY - 0.5) * 8
    return { dx: ox * (depth - 1), dy: oy * (depth - 1) }
  }

  private drawStar(index: number, still = false): void {
    const { ctx, theme } = this
    const s = this.stars[index]
    const float = still ? 0 : Math.sin(this.elapsed / 1200 + s.phase) * 3
    const { dx, dy } = still ? { dx: 0, dy: 0 } : this.parallax(s.depth)
    const x = s.px + dx
    const y = s.py + float + dy
    const hovered = index === this.hover
    const r = s.r * (hovered ? 1.15 : 1)

    // 命中脉冲光环
    if (s.pulse > 0) {
      const ringR = r + 4 + (1 - s.pulse) * 14
      ctx.strokeStyle = withAlpha(theme.halo, 0.5 * s.pulse)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x, y, ringR, 0, Math.PI * 2)
      ctx.stroke()
    }

    // 节点底面
    ctx.fillStyle = theme.nodeSurface
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = withAlpha(theme.nodeRing, hovered ? 0.9 : 0.4)
    ctx.lineWidth = hovered ? 1.6 : 1
    ctx.stroke()

    // Logo（或降级字母）
    if (s.img && s.img.width > 0) {
      const size = r * 1.15
      ctx.drawImage(s.img, x - size / 2, y - size / 2, size, size)
    } else {
      ctx.fillStyle = theme.label
      ctx.font = `600 ${Math.round(r * 0.9)}px 'Ren2Inter', sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(s.name[0] ?? '?', x, y + 1)
    }
  }

  private drawKey(still = false): void {
    const { ctx, theme } = this
    const float = still ? 0 : Math.sin(this.elapsed / 1600) * 4
    const x = this.keyPx.x
    const y = this.keyPx.y + float
    const breath = still ? 0.5 : 0.4 + 0.25 * Math.sin(this.elapsed / 1100)

    // 呼吸光晕
    const glowR = 52
    const grad = ctx.createRadialGradient(x, y, 4, x, y, glowR)
    grad.addColorStop(0, withAlpha(theme.keyGlow, 0.34 * breath + 0.12))
    grad.addColorStop(1, withAlpha(theme.keyGlow, 0))
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, glowR, 0, Math.PI * 2)
    ctx.fill()

    if (this.keyImg && this.keyImg.width > 0) {
      // Preserve the emblem's aspect ratio (it is taller than wide).
      const h = 104
      const w = h * (this.keyImg.width / this.keyImg.height)
      ctx.drawImage(this.keyImg, x - w / 2, y - h / 2, w, h)
      return
    }

    // 矢量 fallback：手绘线稿钥匙（六边形芯片头 + 齿）
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(-0.35)
    ctx.strokeStyle = theme.packet
    ctx.fillStyle = withAlpha(theme.packet, 0.14)
    ctx.lineWidth = 2.4
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    // 芯片形钥匙头（六边形）
    const R = 15
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6
      const px = Math.cos(a) * R
      const py = Math.sin(a) * R - 10
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // 头内孔
    ctx.beginPath()
    ctx.arc(0, -10, 4.5, 0, Math.PI * 2)
    ctx.stroke()
    // 键杆 + 齿
    ctx.beginPath()
    ctx.moveTo(0, 5)
    ctx.lineTo(0, 34)
    ctx.moveTo(0, 22)
    ctx.lineTo(8, 22)
    ctx.moveTo(0, 30)
    ctx.lineTo(11, 30)
    ctx.stroke()
    ctx.restore()
  }

  private drawLabel(star: Star): void {
    const { ctx, theme } = this
    const text = star.name
    ctx.font = `600 12px 'Ren2Inter', sans-serif`
    const w = ctx.measureText(text).width + 16
    const x = star.px
    const y = star.py - star.r - 18
    ctx.fillStyle = withAlpha(theme.labelSurface, 0.92)
    ctx.beginPath()
    ctx.roundRect(x - w / 2, y - 11, w, 22, 6)
    ctx.fill()
    ctx.strokeStyle = withAlpha(theme.nodeRing, 0.5)
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.fillStyle = theme.label
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, x, y)
  }
}
