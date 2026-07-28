// 平面点阵世界地图：等距圆柱投影，按掩码分海陆着色的密集点阵，
// 叠加整体呼吸 + 左上流动能量光场 + 经度扫描高亮（雷达式"全球实时"感）。作为首屏全屏背景。
import { landnessDeg } from './worldMask'
import { noise2D } from './noise'
import { getCanvasTheme, withAlpha, type CanvasTheme } from './theme'

// 显示纬度带（跳过大部分极地空白，充分利用竖向空间）
export const LAT_TOP = 75
export const LAT_BOT = -60

// 移动端竖屏地图：高度占屏比 / 聚焦纬度(北纬模型带) / 舞台锚点高度(对齐枢纽 0.21h)
const MOBILE_MAP_HEIGHT_RATIO = 0.5
const MOBILE_FOCUS_LAT = 30
const MOBILE_STAGE_Y_RATIO = 0.21

// 惯性换算用单帧时长（60Hz 基准，与 MapScene.FRAME_MS 同值）
const FRAME_MS = 1000 / 60

// 鼠标照亮区内，陆地点阵就地变 ASCII 代码流的字符集（海洋改为平滑正弦流体波纹，不用字符）
const CODE_GLYPHS = '{}()<>/;=01*&|:+'

// 点阵着色量化查表：把 alpha 量化成有限档并预生成 rgba 字符串，
// 主循环逐点查表而非每点拼 `rgba(...,${a})`，消除每帧数千次字符串分配(GC 压力)。
// 48 档粒度≈0.02，肉眼不可辨。模块级构建一次，全实例共享。
const A_STEPS = 48
function buildAlphaLut(r: number, g: number, b: number): string[] {
  const arr = new Array<string>(A_STEPS + 1)
  for (let i = 0; i <= A_STEPS; i++)
    arr[i] = `rgba(${r},${g},${b},${(i / A_STEPS).toFixed(3)})`
  return arr
}
// alpha(0~1) → 量化档字符串
function lutAt(lut: string[], a: number): string {
  let i = (a * A_STEPS + 0.5) | 0
  if (i < 0) i = 0
  else if (i > A_STEPS) i = A_STEPS
  return lut[i]
}
function buildAlphaLutHex(hex: string): string[] {
  return buildAlphaLut(...hexRgb(hex))
}

// 涟漪十六进制色 → [r,g,b] 解析缓存：颜色种类有限，避免主循环内重复 parseInt+slice
const HEX_RGB_CACHE = new Map<string, [number, number, number]>()
function hexRgb(hex: string): [number, number, number] {
  let v = HEX_RGB_CACHE.get(hex)
  if (!v) {
    const s = hex.replace('#', '')
    v = [
      parseInt(s.slice(0, 2), 16),
      parseInt(s.slice(2, 4), 16),
      parseInt(s.slice(4, 6), 16),
    ]
    HEX_RGB_CACHE.set(hex, v)
  }
  return v
}

// 背景地域标签（地理锚点，极淡，呼应"全球分布"）
const REGION_LABELS: { lon: number; lat: number; text: string }[] = [
  { lon: -120, lat: 45, text: 'US-WEST' },
  { lon: -80, lat: 43, text: 'US-EAST' },
  { lon: 10, lat: 54, text: 'EU-CENTRAL' },
  { lon: 116, lat: 46, text: 'CN-NORTH' },
  { lon: 113, lat: 17, text: 'CN-SOUTH' },
  { lon: 135, lat: -5, text: 'APAC' },
  { lon: -60, lat: -20, text: 'LATAM' },
]

interface MapDot {
  lon: number
  lat: number
  x: number // 投影后屏幕像素（resize 时重算）
  y: number
  land: boolean
  honey: boolean // 蜂蜜黄点缀（稳定，避免逐帧闪烁）
  edge: number // 海岸带因子 0~1（越近岸越大，用于渐隐软化边缘锯齿）
  phase: number // 呼吸相位
}

// 点击照亮：一处扩散并淡出的点阵增亮源（屏幕坐标，短命）
interface Glow {
  x: number
  y: number
  r: number
  max: number
  life: number
}

// 鼠标扫过海面留下的短寿命水流尾迹。方向在生成时冻结，避免后续转向让旧波纹突然扭转。
interface FlowWake {
  x: number
  y: number
  dx: number
  dy: number
  life: number
  phase: number
  energy: number
  drift: number
}

export class WorldMap {
  private theme: CanvasTheme
  private highlightLut: string[]
  private landLut: string[]
  private oceanLut: string[]
  private dots: MapDot[] = []
  private glows: Glow[] = []
  // 鼠标悬浮聚光：跟随光标照亮半径内点阵，进出平滑淡入淡出
  private hoverX = 0
  private hoverY = 0
  private hoverActive = false
  private hoverStrength = 0 // 缓动 0~1
  private flowX = 1 // 海洋洋流方向(单位向量，随鼠标移动缓动)
  private flowY = 0
  private flowWakes: FlowWake[] = []
  private wakeCarry = 0 // 累积鼠标位移，按距离而不是帧率生成尾迹
  // 海面动/静过渡：扫动时留下方向尾迹，静止够久后转为「阵阵涟漪」
  private stillFrames = 0 // 连续近静止帧数
  private rippleMode = 0 // 涟漪显隐闸门 0~1（静止久升起、一动即落）
  private oceanRipples: { x: number; y: number; r: number; life: number }[] = []
  private rippleTimer = 0 // 下一圈涟漪倒计时（实现"阵阵"）
  private static readonly MOVE_REF = 12 // 速度→能量归一参考(px/帧)，降低快速移动时的突兀饱和
  private static readonly STILL_SPEED = 0.4 // 低于此速视为静止
  private static readonly DWELL_FRAMES = 66 // 静止约 1.1s 后再起涟漪
  private static readonly RIPPLE_INTERVAL = 64 // 涟漪节奏更舒缓
  private static readonly WAKE_SPACING = 18 // 拉开尾迹间距，避免快速扫动时堆成亮带
  private static readonly MAX_WAKES = 8 // 固定绘制上限：8 束 × 3 条 × 13 个采样点
  private static readonly HOVER_R = 90 // 点阵照亮半径(px)，更聚拢
  private static readonly HOVER_INTENSITY = 1.6 // 照亮强度（提亮）
  private static readonly GLYPH_GATE = 0.1 // 悬浮衰减 > 此值 → 该点变 ASCII 码流
  private static readonly CURSOR_R = 12 // 跟随鼠标的小圆圈半径(px)，与照亮范围解耦
  private w = 0
  private h = 0
  // 地图矩形（居中贴合容器）
  private mx = 0
  private my = 0
  private mw = 0
  private mh = 0
  private step = 1.5
  private bgGrad: CanvasGradient | null = null // 底色竖向渐变，随布局缓存(不每帧重建)
  private t = 0
  private rot = 0 // 经度滚动偏移(度)，模拟地球自转
  reduced = false

  private static readonly SCROLL = 0.012 // 基础滚动速度(度/帧)，全周约 8 分钟（放慢约 2.5×，更沉稳）
  private static readonly BOOST = 12 // 边缘巡航最大倍率，持续悬停时逐步逼近
  private static readonly BOOST_EASE = 0.018 // 约 2~3s 缓缓叠加到接近最大值
  private static readonly RECOVER_EASE = 0.014 // 离开边缘后用更长尾的减速曲线回落
  private scrollFactor = 1 // 当前速度系数（缓动逼近 target，使加/减/反向都平滑）
  private targetFactor = 1 // 目标：1 常速 / +BOOST 向东加速 / -BOOST 反向
  private pressBoost = 0 // 长按加速自转的目标倍率（0=解除；常态 16 / 沉浸 24）
  private dragging = false // 触摸拖拽中：暂停自转与边缘巡航，rot 弹簧跟随手指
  private dragRotTarget: number | null = null // 拖拽跟手目标（累积，消抖+质量感）
  private static readonly DRAG_FOLLOW = 0.35 // 跟手弹簧系数（~2 帧逼近，不肉）
  // 拖拽惯性自旋（拨动球体手感）：独立于巡航的叠加通道；粘滞+库仑混合摩擦，
  // 高速段快速衰减、低速段干脆停稳；巡航速度始终叠加在旁，衰减完无缝接管。
  private spinVel = 0 // °/帧
  private static readonly SPIN_FRICTION = 0.94 // 粘滞（比例）阻力
  private static readonly SPIN_DECEL = 0.006 // 库仑（恒定）减速 °/帧²
  private static readonly SPIN_MAX = 1.6 // 惯性初速上限（°/帧）
  private static readonly SPIN_MIN = 0.004 // 低于此值停稳归零
  private static readonly SPIN_GAIN = 0.6 // 松手末速 → 初速增益

  /** 边缘加速控制：dir=+1 右侧(继续向东)、-1 左侧(反向)、0 恢复常速。 */
  setEdgeBoost(dir: -1 | 0 | 1) {
    this.targetFactor = dir === 0 ? 1 : dir * WorldMap.BOOST
  }

  /** 触摸长按加速自转：factor=目标速度倍率（长按期间生效），0 解除回落常速。 */
  setPressBoost(factor: number) {
    this.pressBoost = factor
  }

  /** 触摸拖拽开始：自转/巡航暂停；按住正在自旋的球 → 停；弹簧从当前角起步。 */
  beginDrag() {
    this.dragging = true
    this.spinVel = 0
    this.dragRotTarget = this.rot
  }

  /** 跟手目标累积：手指右滑(+dx)大陆跟着向右；满宽一滑 ≈ 一个可见经度窗。 */
  dragBy(dxPx: number) {
    if (!this.dragging || this.dragRotTarget === null) return
    this.dragRotTarget =
      (this.dragRotTarget - dxPx * (360 / this.mw) + 360) % 360
  }

  /**
   * 拖拽释放：末段速度换算成惯性自旋初速（reduced 下关闭），
   * 之后每帧粘滞+库仑摩擦衰减，像拨动一颗真实球体。
   */
  endDrag(vxPxPerMs: number) {
    this.dragging = false
    this.dragRotTarget = null
    if (this.reduced || !Number.isFinite(vxPxPerMs)) return
    const raw = -vxPxPerMs * FRAME_MS * (360 / this.mw) * WorldMap.SPIN_GAIN
    this.spinVel = Math.max(
      -WorldMap.SPIN_MAX,
      Math.min(WorldMap.SPIN_MAX, raw)
    )
  }

  constructor(reduced = false, theme: CanvasTheme = getCanvasTheme('dark')) {
    this.reduced = reduced
    this.theme = theme
    this.highlightLut = buildAlphaLutHex(theme.mapHighlight)
    this.landLut = buildAlphaLutHex(theme.mapLand)
    this.oceanLut = buildAlphaLutHex(theme.mapOcean)
  }

  setTheme(theme: CanvasTheme) {
    this.theme = theme
    this.highlightLut = buildAlphaLutHex(theme.mapHighlight)
    this.landLut = buildAlphaLutHex(theme.mapLand)
    this.oceanLut = buildAlphaLutHex(theme.mapOcean)
    this.bgGrad = null
  }

  setLayout(w: number, h: number) {
    this.w = w
    this.h = h
    this.step = w < 640 ? 2.4 : 1.5
    const mapAspect = 360 / (LAT_TOP - LAT_BOT)
    if (w >= 1024 || h < w) {
      // 桌面端 + 手机横屏：放大并居中（过扫描），两侧远洋边缘裁掉不影响主要陆地。
      // SCALE=1.3 时可见经度约 ±138°，美西(-122)与中国东部(+122)均在视野内。
      const SCALE = 1.3
      this.mw = w * SCALE
      this.mh = (w / mapAspect) * SCALE
      this.my = (h - this.mh) / 2
    } else {
      // 移动端竖屏：地图高度改由屏高推导（按屏宽推导会缩成 ~22% 屏高的一条，
      // 且垂直居中后正好被内容卡遮挡）。北纬 30° 模型密集带锚定到 21% 屏高，
      // 与枢纽(MapScene 0.21h)、CSS 聚光(50% 26%) 对齐，内容聚焦卡片之上的舞台区。
      this.mh = h * MOBILE_MAP_HEIGHT_RATIO
      this.mw = this.mh * mapAspect
      this.my =
        h * MOBILE_STAGE_Y_RATIO -
        ((LAT_TOP - MOBILE_FOCUS_LAT) / (LAT_TOP - LAT_BOT)) * this.mh
    }
    this.mx = (w - this.mw) / 2
    this.bgGrad = null // 尺寸变化 → 背景渐变失效，draw 时按新高度重建
    this.buildDots()
  }

  /** 经纬度(度) → 屏幕像素坐标（不含滚动，仅用于建点期的 y 计算）。 */
  project(lon: number, lat: number): { x: number; y: number } {
    const lonFrac = (lon + 180) / 360
    const latFrac = (LAT_TOP - lat) / (LAT_TOP - LAT_BOT)
    return { x: this.mx + lonFrac * this.mw, y: this.my + latFrac * this.mh }
  }

  /** 含滚动的经度 → 屏幕 x（环绕）。滚动方向：rot 增大 → 大陆向左漂移。 */
  private projX(lon: number): number {
    let f = ((lon - this.rot + 180) / 360) % 1
    if (f < 0) f += 1
    return this.mx + f * this.mw
  }

  /** 含滚动的经纬 → 屏幕坐标，供模型/弧线/通道与地图对齐。 */
  projectRot(lon: number, lat: number): { x: number; y: number } {
    const latFrac = (LAT_TOP - lat) / (LAT_TOP - LAT_BOT)
    return { x: this.projX(lon), y: this.my + latFrac * this.mh }
  }

  /** 屏幕坐标 → 含滚动的经纬度（projectRot 的逆运算，用于点击点阵定位用户）。 */
  unprojectRot(x: number, y: number): { lon: number; lat: number } {
    const f = (x - this.mx) / this.mw
    let lon = f * 360 - 180 + this.rot
    lon = ((((lon + 180) % 360) + 360) % 360) - 180 // 归一到 [-180,180)
    const latFrac = (y - this.my) / this.mh
    let lat = LAT_TOP - latFrac * (LAT_TOP - LAT_BOT)
    lat = Math.min(LAT_TOP, Math.max(LAT_BOT, lat)) // 夹紧到可见纬度带
    return { lon, lat }
  }

  /** 点击照亮：在屏幕坐标处新增一处扩散增亮源（短命，约 1s）。 */
  addGlow(x: number, y: number) {
    this.glows.push({ x, y, r: 0, max: 130, life: 1 })
    if (this.glows.length > 8) this.glows.shift()
  }

  /** 鼠标悬浮聚光：每帧下传光标位置和速度，驱动海洋尾迹方向与静止涟漪。 */
  setHover(x: number, y: number, active: boolean, vx = 0, vy = 0) {
    this.hoverX = x
    this.hoverY = y
    this.hoverActive = active
    const sp = Math.hypot(vx, vy)
    // 移动明显时把流向缓动到移动方向；静止则维持(洋流有惯性)
    if (sp > WorldMap.STILL_SPEED) {
      this.flowX += (vx / sp - this.flowX) * 0.12
      this.flowY += (vy / sp - this.flowY) * 0.12
      const flowLen = Math.hypot(this.flowX, this.flowY) || 1
      this.flowX /= flowLen
      this.flowY /= flowLen

      // 仅在海面按移动距离生成尾迹；极快扫动也限制单帧累积，避免对象突增。
      const geo = this.unprojectRot(x, y)
      if (active && !this.reduced && landnessDeg(geo.lon, geo.lat) < 0.45) {
        this.wakeCarry += Math.min(sp, WorldMap.WAKE_SPACING * 2)
        if (this.wakeCarry >= WorldMap.WAKE_SPACING) {
          const energy = Math.min(1, sp / WorldMap.MOVE_REF)
          this.addFlowWake(x - vx * 0.25, y - vy * 0.25, energy)
          this.wakeCarry %= WorldMap.WAKE_SPACING
        }
      } else {
        this.wakeCarry = 0
      }
    } else if (!active) {
      this.wakeCarry = 0
    }
    // 静止计时（鼠标停住时本方法仍每帧被调用，sp≈0 会持续累加）
    if (active && sp < WorldMap.STILL_SPEED) this.stillFrames++
    else this.stillFrames = 0
    // 涟漪闸门：静止够久升起、一动即落
    const wantRipple =
      active && this.stillFrames > WorldMap.DWELL_FRAMES ? 1 : 0
    this.rippleMode += (wantRipple - this.rippleMode) * 0.08
    // 静止态：周期性从光标（在海面时）生成一圈同心涟漪
    if (wantRipple) {
      if (--this.rippleTimer <= 0) {
        const geo = this.unprojectRot(x, y)
        if (landnessDeg(geo.lon, geo.lat) < 0.5)
          this.oceanRipples.push({ x, y, r: 6, life: 1 })
        this.rippleTimer = WorldMap.RIPPLE_INTERVAL
      }
    } else {
      this.rippleTimer = 0 // 一动就复位，下次静止立刻起第一圈
    }
    // 涟漪扩散 + 淡出
    for (const rp of this.oceanRipples) {
      rp.r += 0.62
      rp.life -= 0.007
    }
    if (this.oceanRipples.length > 12) this.oceanRipples.shift()
    this.oceanRipples = this.oceanRipples.filter((rp) => rp.life > 0)
  }

  private addFlowWake(x: number, y: number, energy: number) {
    this.flowWakes.push({
      x,
      y,
      dx: this.flowX,
      dy: this.flowY,
      life: 1,
      phase: this.t * 0.012,
      energy,
      drift: 0.045 + energy * 0.05,
    })
    if (this.flowWakes.length > WorldMap.MAX_WAKES) this.flowWakes.shift()
  }

  /** 当前滚动偏移(度)。 */
  get rotation(): number {
    return this.rot
  }

  private buildDots() {
    this.dots = []
    const cols = Math.floor(360 / this.step)
    const rows = Math.floor((LAT_TOP - LAT_BOT) / this.step)
    let landSeq = 0
    for (let r = 0; r <= rows; r++) {
      const lat = LAT_TOP - r * this.step
      for (let c = 0; c < cols; c++) {
        const lon = -180 + c * this.step
        // 连续陆地度 + 稳定噪声抖动阈值：把 7.5° 掩码的直角台阶软化成有机海岸线
        const ln = landnessDeg(lon, lat)
        const jitter =
          (noise2D(lon * 0.35 + 100, lat * 0.35 + 100) - 0.5) * 0.26
        const land = ln + jitter > 0.5
        // 海洋仅稀疏保留约 1/6 网格
        if (!land && (r * cols + c) % 6 !== 0) continue
        const p = this.project(lon, lat)
        // 纵向视口外丢弃（y 不随滚动变）；x 每帧含滚动重算，故此处不按 x 裁剪
        if (p.y < -2 || p.y > this.h + 2) continue
        // 海岸带因子：landness 越接近判定边界(0.5)越靠岸；内陆/深海趋 0
        const edge = land ? Math.max(0, 1 - Math.abs(ln - 0.5) / 0.3) : 0
        const honey = land && landSeq++ % 9 === 0
        this.dots.push({
          lon,
          lat,
          x: p.x,
          y: p.y,
          land,
          honey,
          edge,
          phase: Math.random() * Math.PI * 2,
        })
      }
    }
  }

  update() {
    this.t += 1
    // 悬浮聚光强度平滑缓动（进出约 0.3s 淡入淡出，避免突兀）
    this.hoverStrength +=
      ((this.hoverActive ? 1 : 0) - this.hoverStrength) * 0.1
    // 点击照亮源扩散并淡出（reduced 下仍允许，但衰减更快，保留点击反馈）
    for (const gl of this.glows) {
      gl.r += (gl.max - gl.r) * 0.06
      gl.life -= this.reduced ? 0.04 : 0.02
    }
    this.glows = this.glows.filter((gl) => gl.life > 0)
    for (const wake of this.flowWakes) {
      wake.x += wake.dx * wake.drift
      wake.y += wake.dy * wake.drift
      wake.phase += 0.009
      wake.life -= 0.0065
    }
    this.flowWakes = this.flowWakes.filter((wake) => wake.life > 0)
    if (this.reduced) return
    if (this.dragging) {
      // 拖拽中：巡航暂停，rot 以最短角差弹簧逼近跟手目标（消抖且有质量感）
      if (this.dragRotTarget !== null) {
        let diff = this.dragRotTarget - this.rot
        if (diff > 180) diff -= 360
        else if (diff < -180) diff += 360
        this.rot = (this.rot + diff * WorldMap.DRAG_FOLLOW + 360) % 360
      }
      return
    }
    // 加速与减速都使用长尾缓动；左右换向仍会自然经过 0，不产生瞬时跳变。
    const target = this.pressBoost !== 0 ? this.pressBoost : this.targetFactor
    const ease =
      Math.abs(target) > 1 ? WorldMap.BOOST_EASE : WorldMap.RECOVER_EASE
    this.scrollFactor += (target - this.scrollFactor) * ease
    this.rot = (this.rot + WorldMap.SCROLL * this.scrollFactor) % 360
    if (this.rot < 0) this.rot += 360 // 反向时保持 rot ∈ [0,360)
    // 拖拽惯性自旋：叠加在巡航之上，粘滞+库仑摩擦停稳后巡航无缝接管
    if (this.spinVel !== 0) {
      this.rot = (this.rot + this.spinVel + 360) % 360
      this.spinVel *= WorldMap.SPIN_FRICTION
      this.spinVel -= Math.sign(this.spinVel) * WorldMap.SPIN_DECEL
      if (Math.abs(this.spinVel) < WorldMap.SPIN_MIN) this.spinVel = 0
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    ripples?: { x: number; y: number; r: number; color: string; life: number }[]
  ): void {
    // 底色竖向渐变（brand-900 → brand-800）：随布局缓存，避免每帧重建
    if (!this.bgGrad) {
      const g = ctx.createLinearGradient(0, 0, 0, this.h)
      g.addColorStop(0, this.theme.backgroundTop)
      g.addColorStop(1, this.theme.backgroundBottom)
      this.bgGrad = g
    }
    ctx.fillStyle = this.bgGrad
    ctx.fillRect(0, 0, this.w, this.h)

    // 经度扫描线（雷达式全球实时感）
    const sweep = this.reduced ? null : -180 + ((this.t * 0.09) % 360)
    const sweepW = 22

    // 整体呼吸：全图统一起伏（比逐点闪烁更"像活物呼吸"）
    const globalBreath = this.reduced
      ? 1
      : 0.85 + 0.15 * Math.sin(this.t * 0.012)

    // Ambient field: desktop shifts its centre toward the gateway hinge;
    // mobile aligns with the hub/stage strip at the top (50% x, 21% y).
    const desktop = this.w >= 1024
    const fieldCx =
      this.w *
      ((desktop ? 0.39 : 0.5) +
        (desktop ? 0.08 : 0.1) * Math.sin(this.t * 0.006))
    const fieldCy =
      this.h *
      ((desktop ? 0.43 : 0.21) +
        (desktop ? 0.07 : 0.08) * Math.cos(this.t * 0.008))
    const fieldR = Math.min(this.w, this.h) * (desktop ? 0.32 : 0.28)

    for (const d of this.dots) {
      // 逐帧按滚动重算屏幕 x（y 不随滚动变），离屏跳过
      d.x = this.projX(d.lon)
      if (d.x < -2 || d.x > this.w + 2) continue
      const breath =
        (this.reduced ? 1 : 0.6 + 0.4 * Math.sin(this.t * 0.03 + d.phase)) *
        globalBreath
      // 扫描增益
      let gain = 0
      if (sweep !== null) {
        let dl = Math.abs(d.lon - sweep)
        dl = Math.min(dl, 360 - dl)
        if (dl < sweepW) gain = 1 - dl / sweepW
      }
      // 左上能量场增益：距场心越近 + noise 扰动 → 明暗涌动
      if (!this.reduced) {
        const fd = Math.hypot(d.x - fieldCx, d.y - fieldCy)
        if (fd < fieldR) {
          const nz = noise2D(d.x * 0.01 + this.t * 0.004, d.y * 0.01)
          gain += (1 - fd / fieldR) * nz * 0.5
        }
      }
      // 点击照亮增益：落在照亮源半径内 → 按距离与剩余生命增亮
      for (const gl of this.glows) {
        const gd = Math.hypot(d.x - gl.x, d.y - gl.y)
        if (gd < gl.r) gain += (1 - gd / gl.r) * gl.life * 0.9
      }
      // 悬浮聚光增益：仅陆地响应鼠标（提亮 + 就地变代码流 ASCII）。
      // 海洋点不吃 hover 增益、不变字形，只由 drawOceanFlow 的流体波纹表现"扫过海面"。
      if (d.land && this.hoverStrength > 0.01) {
        const hd = Math.hypot(d.x - this.hoverX, d.y - this.hoverY)
        if (hd < WorldMap.HOVER_R) {
          const f = 1 - hd / WorldMap.HOVER_R
          const hoverF = f * f * this.hoverStrength // 二次衰减：中心明显更亮，边缘更快隐没
          gain += hoverF * WorldMap.HOVER_INTENSITY
          if (hoverF > WorldMap.GLYPH_GATE) {
            this.drawGlyph(ctx, d, hoverF)
            continue
          }
        }
      }
      // 涟漪染色：落在某涟漪环带内 → 临时染成命中色（无涟漪时短路，不进函数）
      const tint =
        ripples && ripples.length ? this.rippleTint(d.x, d.y, ripples) : null
      let a: number
      let r: number
      if (d.land) {
        // 海岸点渐隐（feather）：软化边缘、减轻锯齿；内陆点不受影响
        const feather = 1 - 0.5 * d.edge
        a = (0.35 * breath + gain * 0.5) * feather
        r = (1.2 + gain * 0.9) * (1 - 0.25 * d.edge)
        // 逐点查表着色（替代每点拼串）；涟漪命中时用其预染色
        if (tint) ctx.fillStyle = tint
        else if (d.honey) {
          // 星辉金点缀：夜间叠加逐点失谐的慢频明度呼吸（星星眨眼）；
          // 日间保持焦糖稳定点亮，像账本上落下的批注戳。
          let starAlpha = a + 0.1
          if (this.theme.name === 'dark' && !this.reduced) {
            starAlpha *=
              0.55 +
              0.45 *
                Math.sin(this.t * (0.008 + (d.phase % 0.014)) + d.phase * 7)
          }
          ctx.fillStyle = lutAt(this.highlightLut, starAlpha)
        } else ctx.fillStyle = lutAt(this.landLut, a)
      } else {
        a = 0.1 * breath + gain * 0.22
        r = 0.8
        ctx.fillStyle = tint ?? lutAt(this.oceanLut, a > 0.6 ? 0.6 : a)
      }
      ctx.fillRect(d.x - r / 2, d.y - r / 2, r, r)
    }

    // 局部海流层（跟随鼠标的正弦波纹）+ 静止态阵阵涟漪；reduced 下不绘制，海洋维持稀疏点
    if (!this.reduced) {
      this.drawOceanFlow(ctx)
      this.drawOceanRipples(ctx)
    }

    // 地域标签（极淡，垫在数据点之上、节点之下）
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const lb of REGION_LABELS) {
      const p = this.projectRot(lb.lon, lb.lat)
      if (p.x < 0 || p.x > this.w) continue
      ctx.fillStyle = withAlpha(
        this.theme.mapLabel,
        this.theme.name === 'light' ? 0.28 : 0.14
      )
      ctx.fillText(lb.text, p.x, p.y)
    }

    // 鼠标跟随小圆圈：一圈柔和描边环 + 很淡的小光晕，随 hoverStrength 淡入淡出
    if (this.hoverStrength > 0.01) {
      const hs = this.hoverStrength
      const x = this.hoverX
      const y = this.hoverY
      const R = WorldMap.CURSOR_R // 固定小半径，紧贴鼠标
      ctx.save()
      ctx.globalCompositeOperation = this.theme.glowComposite
      // 小光晕（提亮）
      const halo = ctx.createRadialGradient(x, y, 0, x, y, R + 8)
      halo.addColorStop(0, withAlpha(this.theme.mapCursorGlow, 0.3 * hs))
      halo.addColorStop(1, withAlpha(this.theme.mapCursorGlow, 0))
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(x, y, R + 8, 0, Math.PI * 2)
      ctx.fill()
      // 小圆圈描边环（提亮）
      ctx.strokeStyle = withAlpha(this.theme.mapCursorRing, 0.72 * hs)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x, y, R, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
  }

  // 按鼠标路径遗留的低速水流尾迹。每束冻结生成时的方向，转向时旧水流保留原惯性。
  private drawOceanFlow(ctx: CanvasRenderingContext2D) {
    if (!this.flowWakes.length) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = this.theme.glowComposite
    for (const wake of this.flowWakes) this.drawFlowWake(ctx, wake)
    ctx.restore()
  }

  private drawFlowWake(ctx: CanvasRenderingContext2D, wake: FlowWake) {
    const age = 1 - wake.life
    const half = 13 + wake.energy * 9 + age * 18
    const amp = 1.6 + wake.energy * 2.5
    const nx = -wake.dy
    const ny = wake.dx
    const born = Math.min(1, age * 10)
    const alpha = born * Math.pow(wake.life, 1.45) * (0.18 + wake.energy * 0.3)
    if (alpha <= 0.01) return

    for (let lane = -1; lane <= 1; lane++) {
      const laneOffset = lane * (5 + age * 3)
      let drawing = false
      ctx.beginPath()
      for (let s = 0; s <= 12; s++) {
        const u = s / 12
        const dist = (u * 2 - 1) * half
        const envelope = Math.sin(Math.PI * u)
        const sway =
          Math.sin(dist / 9 + wake.phase + lane * 0.72) * amp * envelope
        const px = wake.x + wake.dx * dist + nx * (laneOffset + sway)
        const py = wake.y + wake.dy * dist + ny * (laneOffset + sway)
        const geo = this.unprojectRot(px, py)
        if (landnessDeg(geo.lon, geo.lat) >= 0.5) {
          drawing = false
          continue
        }
        if (!drawing) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
        drawing = true
      }
      const laneAlpha = alpha * (lane === 0 ? 1 : 0.58)
      ctx.strokeStyle = withAlpha(this.theme.mapFlow, laneAlpha)
      ctx.lineWidth = lane === 0 ? 1.35 : 0.85
      ctx.stroke()
    }
  }

  // 静止态「阵阵涟漪」：鼠标停住一段时间后，从光标处一圈接一圈扩散的同心圆环。
  // 生成/推进在 setHover 中完成；此处只按 rippleMode 闸门与各环剩余生命绘制。
  private drawOceanRipples(ctx: CanvasRenderingContext2D) {
    if (this.rippleMode <= 0.01 || !this.oceanRipples.length) return
    ctx.save()
    for (const rp of this.oceanRipples) {
      // 半径越大越淡、线宽随之收细；整体乘涟漪闸门与悬浮强度
      const a = rp.life * rp.life * this.rippleMode * this.hoverStrength * 0.6
      if (a <= 0.01) continue
      ctx.strokeStyle = withAlpha(this.theme.mapRipple, a)
      ctx.lineWidth = 0.8 + rp.life * 1.2
      ctx.beginPath()
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 将一个陆地点渲染为流动代码流 ASCII（字符随时间+位置滚动，邻点错位 → 像流动的代码）。
  // 海洋不走此路：改由 drawOceanFlow 的平滑正弦波纹表现。
  private drawGlyph(ctx: CanvasRenderingContext2D, d: MapDot, hoverF: number) {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = "12px 'JetBrains Mono', monospace"
    const alpha = Math.min(1, 0.42 + hoverF * 0.95) // 照亮越强越亮
    const idx = Math.floor(this.t * 0.15 + d.phase * 3 + d.x * 0.02)
    const ch = CODE_GLYPHS.charAt(
      ((idx % CODE_GLYPHS.length) + CODE_GLYPHS.length) % CODE_GLYPHS.length
    )
    ctx.fillStyle = withAlpha(
      d.honey ? this.theme.mapGlyphAccent : this.theme.mapGlyph,
      alpha
    )
    ctx.fillText(ch, d.x, d.y)
  }

  // 点落在任一涟漪环带(±14px)内 → 返回该涟漪的染色。
  // 包围盒 + 平方距离先粗筛：绝大多数点远离环带，用廉价比较跳过 hypot；命中才走开方与拼串。
  private rippleTint(
    x: number,
    y: number,
    ripples: { x: number; y: number; r: number; color: string; life: number }[]
  ): string | null {
    const BAND = 14
    for (const rp of ripples) {
      const dx = x - rp.x
      const dy = y - rp.y
      // 环带外接盒粗筛：|dx| 或 |dy| 超过 (r+BAND) 必不在带内
      const reach = rp.r + BAND
      if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue
      const dist2 = dx * dx + dy * dy
      const inner = rp.r - BAND
      // 平方距离环带判定：inner² ≤ dist² ≤ (r+BAND)²（inner<0 时下界取 0）
      if (dist2 <= reach * reach && (inner <= 0 || dist2 >= inner * inner)) {
        const [cr, cg, cb] = hexRgb(rp.color)
        const a = rp.life * 1.2
        return `rgba(${cr},${cg},${cb},${a < 1 ? a : 1})`
      }
    }
    return null
  }
}
