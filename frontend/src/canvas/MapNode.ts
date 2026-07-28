// 平面地图上的节点。本文件先实现模型标记 ModelMarker；
// 人群源 SourceNode 与 RenRen 枢纽 HubNode 在 P3 追加。
import { MODEL_COLORS } from './sceneParts'
import { getCanvasTheme, type CanvasTheme } from './theme'

export function hexToRgba(hex: string, a: number): string {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16)
  const g = parseInt(v.slice(2, 4), 16)
  const b = parseInt(v.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// 模型标记：Logo 钉在其公司所在城市上方，命中时高亮 + 显示名称。
export class ModelMarker {
  x = 0 // Logo 屏幕坐标（散开后，逐帧随滚动更新）
  y = 0
  cityX = 0 // 城市锚点屏幕坐标（连接线目标，逐帧随滚动更新）
  cityY = 0
  glow = 0
  // 地理锚点(经纬) + 相对城市锚点的散开偏移(像素)，屏幕坐标逐帧用 projectRot 重算以跟随滚动
  lon = 0
  lat = 0
  private offX = 0
  private offY = 0
  visible = true // 滚出视口时置 false：不绘制、不参与路由
  private bob: number
  private speed: number
  private theme: CanvasTheme

  constructor(
    public id: string,
    public name: string,
    public img: HTMLImageElement,
    public r: number,
    theme: CanvasTheme = getCanvasTheme('dark')
  ) {
    this.bob = Math.random() * Math.PI * 2
    this.speed = 0.02 + Math.random() * 0.015
    this.theme = theme
  }

  get color(): string {
    return (
      this.theme.modelColorOverrides[this.id] ??
      MODEL_COLORS[this.id] ??
      this.theme.modelFallback
    )
  }

  setTheme(theme: CanvasTheme) {
    this.theme = theme
  }

  // 记录地理锚点与散开偏移（放置期算一次；散开量随滚动不变）
  setAnchor(lon: number, lat: number, offX: number, offY: number) {
    this.lon = lon
    this.lat = lat
    this.offX = offX
    this.offY = offY
  }

  // 逐帧：用含滚动的投影重算城市锚点与 Logo 屏幕坐标，并判定是否在视口内
  place(
    map: { projectRot(lon: number, lat: number): { x: number; y: number } },
    w: number,
    h: number
  ) {
    const p = map.projectRot(this.lon, this.lat)
    this.cityX = p.x
    this.cityY = p.y
    this.x = p.x + this.offX
    this.y = p.y + this.offY
    const m = this.r + 30
    this.visible =
      this.x > -m && this.x < w + m && this.y > -m && this.y < h + m
  }

  update() {
    this.bob += this.speed
    this.glow = Math.max(0, this.glow - 0.02)
  }

  private cy(): number {
    return this.y + Math.sin(this.bob) * 1.5
  }

  draw(ctx: CanvasRenderingContext2D, showLabel: boolean) {
    const x = this.x
    const y = this.cy()
    const r = this.r
    const color = this.color

    // 到城市锚点的连接线
    ctx.strokeStyle = hexToRgba(color, 0.22 + this.glow * 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, y + r)
    ctx.lineTo(this.cityX, this.cityY)
    ctx.stroke()
    // 城市锚点小圆
    ctx.fillStyle = hexToRgba(color, 0.5 + this.glow * 0.4)
    ctx.beginPath()
    ctx.arc(this.cityX, this.cityY, 1.6, 0, Math.PI * 2)
    ctx.fill()

    // 命中光晕
    if (this.glow > 0.01) {
      const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r + 24)
      g.addColorStop(0, hexToRgba(color, 0.5 * this.glow))
      g.addColorStop(1, hexToRgba(color, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r + 24, 0, Math.PI * 2)
      ctx.fill()
    }

    // 底盘 + 品牌色环（命中时微放大 + 亮环加粗，强化"选中"反馈）
    const rr = r * (1 + 0.08 * this.glow)
    ctx.beginPath()
    ctx.arc(x, y, rr, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(this.theme.nodeSurface, 0.9)
    ctx.fill()
    ctx.lineWidth = 1.3 + this.glow * 1.4
    ctx.strokeStyle = hexToRgba(color, 0.5 + this.glow * 0.5)
    ctx.stroke()

    // Logo 图标（随命中同步微放大）
    if (this.img.complete && this.img.naturalWidth) {
      const s = rr * 1.2
      ctx.drawImage(this.img, x - s / 2, y - s / 2, s, s)
      // 命中提亮：用 lighter 叠加重绘图标本体，让 LOGO 自身整体变亮（而非仅周边光晕）
      if (this.glow > 0.01) {
        ctx.save()
        ctx.globalCompositeOperation = this.theme.glowComposite
        ctx.globalAlpha = Math.min(1, this.glow * 0.7)
        ctx.drawImage(this.img, x - s / 2, y - s / 2, s, s)
        ctx.restore()
      }
    }

    // 名称标签（命中或强制显示时）：加深色底衬 + 描边环增强可读性
    if (showLabel || this.glow > 0.3) {
      ctx.font = '11px "JetBrains Mono", monospace'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const ty = y + rr + 5
      const tw = ctx.measureText(this.name).width
      ctx.fillStyle = hexToRgba(this.theme.nodeLabelSurface, 0.55 * this.glow)
      ctx.fillRect(x - tw / 2 - 4, ty - 2, tw + 8, 15)
      ctx.fillStyle = hexToRgba(this.theme.nodeLabelText, 0.6 + this.glow * 0.4)
      ctx.fillText(this.name, x, ty)
    }
  }

  hit(mx: number, my: number): boolean {
    return Math.hypot(mx - this.x, my - this.cy()) < this.r + 6
  }
}

// 瞬时用户：每次请求在某地理坐标出现，随地图滚动同步漂移，出生涟漪 + 微光呼吸，传输完成后淡出消失。
export class UserNode {
  dead = false
  x = 0 // 屏幕坐标（逐帧随地图滚动重算）
  y = 0
  visible = true
  private life = 0 // 出生渐显
  private fade = 1 // 消散
  private fading = false
  private bob = Math.random() * Math.PI * 2
  // 地理锚点：随地图一起滚动
  constructor(
    public lon: number,
    public lat: number,
    private theme: CanvasTheme = getCanvasTheme('dark')
  ) {}

  setTheme(theme: CanvasTheme) {
    this.theme = theme
  }

  // 逐帧：用含滚动的投影重算屏幕坐标并判定可见性（与 ModelMarker 同源）
  place(
    map: { projectRot(lon: number, lat: number): { x: number; y: number } },
    w: number,
    h: number
  ) {
    const p = map.projectRot(this.lon, this.lat)
    this.x = p.x
    this.y = p.y
    this.visible =
      this.x > -40 && this.x < w + 40 && this.y > -40 && this.y < h + 40
  }

  head(): { x: number; y: number } {
    return { x: this.x, y: this.y }
  }
  // 请求结束：开始淡出
  release() {
    this.fading = true
  }
  update() {
    this.bob += 0.05
    if (this.life < 1) this.life = Math.min(1, this.life + 0.08)
    if (this.fading) {
      this.fade -= 0.035
      if (this.fade <= 0) this.dead = true
    }
  }
  draw(ctx: CanvasRenderingContext2D) {
    const vis = this.life * this.fade
    if (vis <= 0.01) return
    const breath = 0.6 + 0.4 * Math.sin(this.bob)
    // 出生涟漪（life 前段扩散一圈）
    if (this.life < 1) {
      const rr = 4 + this.life * 16
      ctx.strokeStyle = hexToRgba(this.theme.userAccent, (1 - this.life) * 0.5)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(this.x, this.y, rr, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 光晕
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 11)
    g.addColorStop(0, hexToRgba(this.theme.userAccent, 0.5 * vis))
    g.addColorStop(1, hexToRgba(this.theme.userAccent, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(this.x, this.y, 11, 0, Math.PI * 2)
    ctx.fill()
    // 核心亮点
    ctx.fillStyle = hexToRgba(
      this.theme.userCore,
      Math.min(1, (0.55 + breath * 0.35) * vis)
    )
    ctx.beginPath()
    ctx.arc(this.x, this.y, 2.6, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 两层旋转光粒轨道配置：[轨道半径系数, 粒子数, 转向, 颜色]
const ORBITS: { rk: number; count: number; dir: number }[] = [
  { rk: 1.5, count: 7, dir: 1 },
  { rk: 2.1, count: 9, dir: -1 },
]
const ORBIT_TILT = 0.42 // 椭圆纵向压缩(仿 3D 倾斜)

// RenRen 网关枢纽：网站 Logo + 环绕旋转的光粒轨道 + 呼吸描边 + 命中脉冲。
export class HubNode {
  x = 0
  y = 0
  r = 22
  pulse = 0
  hover = 0 // 鼠标悬浮高亮(0~1)，外部每帧命中时置高，update 中衰减
  private breath = 0
  private orbit = 0
  private img: HTMLImageElement | null = null
  private theme: CanvasTheme = getCanvasTheme('dark')

  setPos(x: number, y: number, r: number) {
    this.x = x
    this.y = y
    this.r = r
  }
  setLogo(img: HTMLImageElement) {
    this.img = img
  }
  setTheme(theme: CanvasTheme) {
    this.theme = theme
  }
  update(reduced = false) {
    this.breath += reduced ? 0 : 0.03
    this.orbit += reduced ? 0 : 0.01 * (1 + this.pulse + this.hover) // 命中/悬浮时轨道加速
    this.pulse = Math.max(0, this.pulse - 0.02)
    this.hover = Math.max(0, this.hover - 0.05) // 悬浮高亮衰减（外部每帧命中时重置）
  }

  // 绘制轨道光粒；front=true 只画前半(下方)，false 只画后半(上方)，实现绕 Logo 穿插
  private drawOrbit(ctx: CanvasRenderingContext2D, front: boolean) {
    const { x, y, r } = this
    const compact = r < 18 // 移动端小尺寸：减半粒子
    for (const [orbitIndex, ob] of ORBITS.entries()) {
      const orbitColor =
        orbitIndex === 0
          ? this.theme.hubOrbitPrimary
          : this.theme.hubOrbitSecondary
      const rr = r * ob.rk
      const ry = rr * ORBIT_TILT
      const count = compact ? Math.ceil(ob.count / 2) : ob.count
      for (let i = 0; i < count; i++) {
        const a = this.orbit * ob.dir * 2.4 + (i / count) * Math.PI * 2
        const sy = Math.sin(a)
        if (front !== sy > 0) continue // 前后半分离
        const px = x + Math.cos(a) * rr
        const py = y + sy * ry
        const depth = (sy + 1) / 2 // 0(后)~1(前)：近大远小
        const size = (0.8 + depth * 1.6) * (1 + this.pulse * 0.5)
        const alpha = (0.25 + depth * 0.55) * (0.7 + this.pulse * 0.3)
        // 微光晕
        const g = ctx.createRadialGradient(px, py, 0, px, py, size + 3)
        g.addColorStop(0, hexToRgba(orbitColor, alpha))
        g.addColorStop(1, hexToRgba(orbitColor, 0))
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(px, py, size + 3, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = hexToRgba(this.theme.hubOrbitCore, alpha)
        ctx.beginPath()
        ctx.arc(px, py, size * 0.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, label: string) {
    const { x, y, r } = this
    const breath = 0.5 + 0.5 * Math.sin(this.breath)

    // 命中脉冲环
    if (this.pulse > 0.01) {
      ctx.strokeStyle = hexToRgba(this.theme.hubRing, this.pulse * 0.6)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, r + 10 + (1 - this.pulse) * 20, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 悬浮高亮环（蜂蜜黄，命中枢纽时在外圈亮起）
    if (this.hover > 0.01) {
      ctx.strokeStyle = hexToRgba(this.theme.hubRing, this.hover * 0.7)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(x, y, r + 6, 0, Math.PI * 2)
      ctx.stroke()
    }
    // 外光晕（悬浮时提亮）
    const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 2.6)
    g.addColorStop(
      0,
      hexToRgba(this.theme.hubHalo, 0.5 + this.pulse * 0.3 + this.hover * 0.3)
    )
    g.addColorStop(0.5, hexToRgba(this.theme.hubHalo, 0.16 + this.hover * 0.12))
    g.addColorStop(1, hexToRgba(this.theme.hubHalo, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r * 2.6, 0, Math.PI * 2)
    ctx.fill()

    // 后半轨道（在 Logo 之后）
    this.drawOrbit(ctx, false)

    // 暗盘底垫（保证 Logo 对比度）
    ctx.fillStyle = hexToRgba(this.theme.hubSurface, 0.92)
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()

    // Logo（圆形裁剪）
    if (this.img && this.img.complete && this.img.naturalWidth) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, r - 1, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(this.img, x - r, y - r, r * 2, r * 2)
      // 悬浮提亮：lighter 叠加重绘，让枢纽 LOGO 本体整体变亮
      if (this.hover > 0.01) {
        ctx.globalCompositeOperation = this.theme.glowComposite
        ctx.globalAlpha = Math.min(1, this.hover * 0.7)
        ctx.drawImage(this.img, x - r, y - r, r * 2, r * 2)
      }
      ctx.restore()
    }
    // 品牌绿描边环（呼吸；悬浮时加亮加粗）
    ctx.strokeStyle = hexToRgba(
      this.theme.hubRing,
      Math.min(1, 0.55 + breath * 0.35 + this.hover * 0.4)
    )
    ctx.lineWidth = 1.6 + this.hover * 1.4
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()

    // 前半轨道（在 Logo 之前）
    this.drawOrbit(ctx, true)

    // 标签
    ctx.font = 'bold 12px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = hexToRgba(this.theme.hubLabel, 0.92)
    ctx.fillText(label, x, y + r * 2.1 + 4)
  }
}
