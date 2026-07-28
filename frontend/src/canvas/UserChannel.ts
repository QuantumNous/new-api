import { arcUp } from './arc'
import { getCanvasTheme, withAlpha, type CanvasTheme } from './theme'

export interface UserChannelTiming {
  establishMs: number
  transmitMs: number
  fadeMs: number
  delayMs?: number
}

/**
 * User → gateway channel. Its lifecycle is advanced by elapsed milliseconds so
 * the Canvas request programme keeps the same tempo on 60/120Hz displays and
 * after a temporary tab pause.
 */
export class UserChannel {
  dead = false
  phase: 'establish' | 'transmit' | 'fade' = 'establish'
  private establishProgress = 0
  private transmitProgress = 0
  private fade = 1
  private delayRemaining: number
  private arrived = false

  constructor(
    private getFrom: () => { x: number; y: number },
    public to: { x: number; y: number },
    private timing: UserChannelTiming,
    private onArrive: () => void,
    private reduced = false
  ) {
    this.delayRemaining = timing.delayMs ?? 0
  }

  private point(t: number) {
    const from = this.getFrom()
    const c = arcUp(from, this.to, 0.28)
    const u = 1 - t
    return {
      x: u * u * from.x + 2 * u * t * c.x + t * t * this.to.x,
      y: u * u * from.y + 2 * u * t * c.y + t * t * this.to.y,
    }
  }

  release() {
    if (this.phase !== 'fade') this.phase = 'fade'
  }

  update(deltaMs: number) {
    let remaining = Math.max(0, deltaMs)

    if (this.delayRemaining > 0) {
      const consumed = Math.min(remaining, this.delayRemaining)
      this.delayRemaining -= consumed
      remaining -= consumed
      if (remaining <= 0) return
    }

    while (remaining > 0 && !this.dead) {
      if (this.phase === 'establish') {
        // Guard the divisor like the fade phase does: a 0ms duration would make
        // progress NaN, stall the phase, and spin this while-loop forever.
        const establishMs = Math.max(1, this.timing.establishMs)
        const left = Math.max(0, (1 - this.establishProgress) * establishMs)
        const consumed = Math.min(remaining, left)
        this.establishProgress = Math.min(
          1,
          this.establishProgress + consumed / establishMs
        )
        remaining -= consumed
        if (this.establishProgress >= 1) this.phase = 'transmit'
        continue
      }

      if (this.phase === 'transmit') {
        const transmitMs = Math.max(1, this.timing.transmitMs)
        const left = Math.max(0, (1 - this.transmitProgress) * transmitMs)
        const consumed = Math.min(remaining, left)
        this.transmitProgress = Math.min(
          1,
          this.transmitProgress + consumed / transmitMs
        )
        remaining -= consumed
        if (this.transmitProgress >= 1 && !this.arrived) {
          this.arrived = true
          this.phase = 'fade'
          this.onArrive()
        }
        continue
      }

      const fadeMs = Math.max(1, this.timing.fadeMs)
      const left = Math.max(0, this.fade * fadeMs)
      const consumed = Math.min(remaining, left)
      this.fade = Math.max(0, this.fade - consumed / fadeMs)
      remaining -= consumed
      if (this.fade <= 0) this.dead = true
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    t: number,
    theme: CanvasTheme = getCanvasTheme('dark')
  ) {
    if (this.delayRemaining > 0) return
    const a = this.fade
    const seg = this.phase === 'establish' ? this.establishProgress : 1
    const p0 = this.getFrom()

    ctx.save()
    ctx.beginPath()
    ctx.moveTo(p0.x, p0.y)
    const samples = 22
    for (let i = 1; i <= samples; i++) {
      const tt = (i / samples) * seg
      const p = this.point(tt)
      ctx.lineTo(p.x, p.y)
    }
    ctx.strokeStyle = withAlpha(theme.channelStroke, 0.5 * a)
    ctx.lineWidth = 1.6
    if (!this.reduced) {
      ctx.shadowColor = withAlpha(theme.channelGlow, 0.7)
      ctx.shadowBlur = 6
    }
    ctx.stroke()
    ctx.restore()

    if (this.phase !== 'transmit') return
    const p = this.point(this.transmitProgress)
    const radius = 7
    const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius + 6)
    glow.addColorStop(0, withAlpha(theme.channelGlow, 0.55 * a))
    glow.addColorStop(1, withAlpha(theme.channelGlow, 0))
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius + 6, 0, Math.PI * 2)
    ctx.fill()

    ctx.save()
    if (!this.reduced) {
      ctx.shadowColor = withAlpha(theme.channelGlow, 0.8)
      ctx.shadowBlur = 8
    }
    ctx.strokeStyle = withAlpha(theme.channelPacket, 0.95 * a)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()

    ctx.fillStyle = withAlpha(theme.channelCore, 0.95 * a)
    ctx.beginPath()
    ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2)
    ctx.fill()
    void t
  }
}
