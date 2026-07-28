// 地图场景通用构件：各模型主题色、请求/响应光包、迸发粒子。
import { arcUp } from './arc'
import { getCanvasTheme, type CanvasTheme } from './theme'

export const MODEL_COLORS: Record<string, string> = {
  claude: '#D97706',
  openai: '#10B981',
  gemini: '#4285F4',
  deepseek: '#4D6BFE',
  qwen: '#8B5CF6',
  grok: '#E5E7EB',
  kimi: '#22D3EE',
  zhipu: '#3859FF',
  doubao: '#3B82F6',
  minimax: '#F97066',
  hunyuan: '#12B5CB',
  mistral: '#F7D046',
}

// 沿直线行进的请求/响应光包（人群源 ↔ 网关枢纽的短程脉冲）
export class StraightPacket {
  progress = 0
  constructor(
    public from: { x: number; y: number },
    public to: { x: number; y: number },
    public color: string,
    public speed: number,
    public onArrive: () => void,
    public dead = false
  ) {}

  update() {
    this.progress += this.speed
    if (this.progress >= 1) {
      this.progress = 1
      this.dead = true
      this.onArrive()
    }
  }

  pos() {
    const e =
      this.progress < 0.5
        ? 2 * this.progress * this.progress
        : 1 - Math.pow(-2 * this.progress + 2, 2) / 2
    return {
      x: this.from.x + (this.to.x - this.from.x) * e,
      y: this.from.y + (this.to.y - this.from.y) * e,
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    theme: CanvasTheme = getCanvasTheme('dark')
  ) {
    const { x, y } = this.pos()
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9)
    g.addColorStop(0, this.color)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = theme.packetCore
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 沿拱门弧线返回的响应光包（网关 → 用户）：与去程通道共用 arcUp 同一条弧，实现「沿原路返回」。
// 终点用实时 getter，跟随随地图漂移的用户；弧线牢牢粘住两端。
export class ArcPacket {
  progress = 0
  dead = false
  constructor(
    public from: { x: number; y: number }, // 枢纽（固定）
    private getTo: () => { x: number; y: number }, // 用户实时位置
    private durationMs: number,
    public onArrive: () => void
  ) {}

  update(deltaMs: number) {
    this.progress += Math.max(0, deltaMs) / Math.max(1, this.durationMs)
    if (this.progress >= 1) {
      this.progress = 1
      this.dead = true
      this.onArrive()
    }
  }

  private point(t: number) {
    const to = this.getTo()
    const c = arcUp(this.from, to, 0.28) // 与 UserChannel 同参 → 同一条弧（原路）
    const u = 1 - t
    return {
      x: u * u * this.from.x + 2 * u * t * c.x + t * t * to.x,
      y: u * u * this.from.y + 2 * u * t * c.y + t * t * to.y,
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    theme: CanvasTheme = getCanvasTheme('dark')
  ) {
    const { x, y } = this.point(this.progress)
    const g = ctx.createRadialGradient(x, y, 0, x, y, 9)
    g.addColorStop(0, theme.responsePacket)
    g.addColorStop(1, 'transparent')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 9, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = theme.packetCore
    ctx.beginPath()
    ctx.arc(x, y, 2, 0, Math.PI * 2)
    ctx.fill()
  }
}

// 命中模型时的迸发粒子
export class Particle {
  vx: number
  vy: number
  life = 1
  size: number
  constructor(
    public x: number,
    public y: number,
    public color: string,
    private themed = false
  ) {
    const a = Math.random() * Math.PI * 2
    const sp = 0.5 + Math.random() * 2
    this.vx = Math.cos(a) * sp
    this.vy = Math.sin(a) * sp
    this.size = 1.2 + Math.random() * 2.2
  }
  update(deltaMs = 1000 / 60) {
    const scale = Math.max(0, deltaMs) / (1000 / 60)
    this.x += this.vx * scale
    this.y += this.vy * scale
    this.vy += 0.02 * scale
    this.life -= 0.02 * scale
  }
  draw(
    ctx: CanvasRenderingContext2D,
    theme: CanvasTheme = getCanvasTheme('dark')
  ) {
    ctx.globalAlpha = Math.max(0, this.life)
    ctx.fillStyle = this.themed ? theme.accent : this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
