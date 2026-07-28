<template>
  <canvas
    ref="canvasEl"
    class="absolute inset-0 h-full w-full cursor-pointer transition-opacity duration-700 ease-out"
    :class="ready ? 'opacity-100' : 'opacity-0'"
    :aria-label="t('canvas.alt')"
    role="img"
  />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useI18n } from 'vue-i18n'
import type { MapScene } from '@/canvas/MapScene'
import type { SignalConsoleSnapshot } from '@/constants/home/signalConsole'
import { useTheme } from '@/composables/useTheme'

const emit = defineEmits<{
  signalChange: [snapshot: SignalConsoleSnapshot]
}>()

const props = withDefaults(defineProps<{ immersive?: boolean }>(), {
  immersive: false,
})

const { t } = useI18n()
const { resolvedTheme } = useTheme()
const canvasEl = ref<HTMLCanvasElement | null>(null)
const ready = ref(false) // 图标就绪前画布透明（下方是干净页面底），就绪后淡入
let scene: MapScene | null = null
let io: IntersectionObserver | null = null

watch(resolvedTheme, (theme) => scene?.setTheme(theme))

const onResize = useDebounceFn(() => scene?.resize(), 180)

// 事件挂到 window 而非 canvas：右侧 HeroContent 等 HTML 层盖在画布上会吞掉指针事件，
// 导致中间/右侧模型无法悬停聚焦。改为按 canvas 矩形自行换算坐标，让悬停「穿透」到画布，
// 命中身后的模型；点击若落在真实可交互元素(a/button)上则放行，不劫持。
function localXY(
  e: MouseEvent
): { x: number; y: number; inside: boolean; insideY: boolean } | null {
  const el = canvasEl.value
  if (!el) return null
  const r = el.getBoundingClientRect()
  const x = e.clientX - r.left
  const y = e.clientY - r.top
  const insideY = y >= 0 && y <= r.height
  const inside = x >= 0 && x <= r.width && insideY
  return { x, y, inside, insideY }
}

function isCanvasInteractionBoundary(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      '[data-hero-canvas-boundary], [data-canvas-interaction-boundary]'
    )
  )
}

/* ===== 移动端触摸横滑转动地图（常态仅下方空白区；沉浸态扩至全屏） =====
   起点落在热区且非交互元素时才进入待定；|dx|>|dy|×1.5 认领手势，
   竖向滚动靠容器 touch-action: pan-y + touchcancel 交还浏览器，互不劫持。 */
const DRAG_ZONE_Y_RATIO = 0.52 // 常态热区起点（画布高占比；沉浸态为 0 全屏）
const DRAG_CLAIM_PX = 8 // 手势方向判定阈值
const DRAG_DIRECTION_RATIO = 1.5 // |dx| 须超过 |dy|×1.5 才算横向
const FLING_SAMPLE_MS = 120 // 释放速度采样窗口
const LONG_PRESS_MS = 500 // 长按加速自转的触发时长（按住不动、位移 <8px）
const BOOST_FACTOR_NORMAL = 16 // 长按自转倍速（常态）
const BOOST_FACTOR_IMMERSIVE = 24 // 长按自转倍速（沉浸全屏）
let dragState: 'idle' | 'pending' | 'claim' | 'pass' = 'idle'
let dragStartX = 0
let dragStartY = 0
let dragLastX = 0
let dragSamples: { x: number; t: number }[] = []
let suppressClickUntil = 0 // 拖动/长按后短暂抑制 canvas 点击请求（防误触发）
let boostTimer: number | undefined // 长按倒计时
let boostActive = false // 长按加速已生效

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'a, button, [role="button"], input, textarea, select, label, [data-hero-canvas-boundary], [data-canvas-interaction-boundary]'
    )
  )
}

/* ===== 长按加速自转（拨球前的"助跑"）：全画布非交互区按住 500ms 触发 ===== */
function cancelBoost() {
  if (boostTimer !== undefined) {
    window.clearTimeout(boostTimer)
    boostTimer = undefined
  }
  if (boostActive) {
    boostActive = false
    scene?.endBoost()
  }
}

function startBoostCountdown() {
  cancelBoost()
  boostTimer = window.setTimeout(() => {
    boostTimer = undefined
    boostActive = true
    scene?.beginBoost(
      props.immersive ? BOOST_FACTOR_IMMERSIVE : BOOST_FACTOR_NORMAL
    )
    // 长按生效期间挂起 click 抑制（抬手时 finishDrag 换算成 450ms 窗口）
    suppressClickUntil = Number.POSITIVE_INFINITY
  }, LONG_PRESS_MS)
}

function finishDrag(cancelled: boolean) {
  const wasBoosting = boostActive
  cancelBoost()
  if (wasBoosting && !cancelled) {
    suppressClickUntil = performance.now() + 450 // 长按后抬手：不当作点击
  } else if (suppressClickUntil === Number.POSITIVE_INFINITY) {
    suppressClickUntil = 0
  }
  if (dragState === 'claim') {
    let vx = 0
    if (!cancelled && dragSamples.length >= 2) {
      const first = dragSamples[0]
      const last = dragSamples[dragSamples.length - 1]
      const dt = last.t - first.t
      if (dt > 0) vx = (last.x - first.x) / dt
    }
    scene?.endMapDrag(vx)
    suppressClickUntil = performance.now() + 450
  }
  dragState = 'idle'
  dragSamples = []
}

function onWindowTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) {
    finishDrag(true) // 多指介入：放弃当前手势
    return
  }
  if (dragState === 'claim') return
  if (window.innerWidth >= 1024 || isInteractiveTarget(e.target)) {
    dragState = 'idle'
    return
  }
  const el = canvasEl.value
  if (!el) {
    dragState = 'idle'
    return
  }
  const touch = e.touches[0]
  const r = el.getBoundingClientRect()
  const x = touch.clientX - r.left
  const y = touch.clientY - r.top
  const insideCanvas = x >= 0 && x <= r.width && y >= 0 && y <= r.height
  if (!insideCanvas) {
    dragState = 'idle'
    return
  }
  dragStartX = touch.clientX
  dragStartY = touch.clientY
  startBoostCountdown() // 长按加速自转：全画布非交互区可触发
  const zoneTop = props.immersive ? 0 : r.height * DRAG_ZONE_Y_RATIO
  if (y < zoneTop) {
    dragState = 'idle' // 上方区域不参与横滑转球，仅保留长按加速
    return
  }
  dragState = 'pending'
  dragLastX = touch.clientX
  dragSamples = [{ x: touch.clientX, t: performance.now() }]
}

function onWindowTouchMove(e: TouchEvent) {
  const touch = e.touches[0]
  // 位移超阈值：取消长按加速（后续由转球/沉浸手势接管）
  if (boostTimer !== undefined || boostActive) {
    const dx0 = touch.clientX - dragStartX
    const dy0 = touch.clientY - dragStartY
    if (Math.abs(dx0) > DRAG_CLAIM_PX || Math.abs(dy0) > DRAG_CLAIM_PX)
      cancelBoost()
  }
  if (dragState !== 'pending' && dragState !== 'claim') return
  if (dragState === 'pending') {
    const dx = touch.clientX - dragStartX
    const dy = touch.clientY - dragStartY
    if (Math.abs(dx) < DRAG_CLAIM_PX && Math.abs(dy) < DRAG_CLAIM_PX) return
    if (Math.abs(dx) > Math.abs(dy) * DRAG_DIRECTION_RATIO) {
      dragState = 'claim'
      scene?.beginMapDrag()
      suppressClickUntil = performance.now() + 450
    } else {
      dragState = 'pass' // 竖向主导：交还页面滚动
      return
    }
  }
  scene?.dragMapBy(touch.clientX - dragLastX)
  dragLastX = touch.clientX
  const now = performance.now()
  dragSamples.push({ x: touch.clientX, t: now })
  while (dragSamples.length > 2 && now - dragSamples[0].t > FLING_SAMPLE_MS)
    dragSamples.shift()
}

function onWindowTouchEnd() {
  finishDrag(false)
}

function onWindowTouchCancel() {
  finishDrag(true)
}

function onWindowMove(e: MouseEvent) {
  // 触摸滑动不触发悬停聚光/边缘巡航（避免横滑转图时地图误亮）
  if ('pointerType' in e && (e as PointerEvent).pointerType === 'touch') return
  if (isCanvasInteractionBoundary(e.target)) {
    resetInteraction()
    return
  }

  const p = localXY(e)
  if (!p) return
  const edgeActive =
    p.insideY && e.clientX >= 0 && e.clientX <= window.innerWidth
  scene?.setEdgePointer(e.clientX, window.innerWidth, edgeActive)
  if (p.inside) scene?.setMouse(p.x, p.y, true)
  else scene?.setMouse(0, 0, false) // 移出画布区域视作离开
}

function resetInteraction() {
  scene?.setMouse(0, 0, false)
  scene?.setEdgePointer(0, window.innerWidth, false)
  finishDrag(true)
}

function onWindowClick(e: MouseEvent) {
  if (isCanvasInteractionBoundary(e.target)) {
    resetInteraction()
    return
  }

  if (performance.now() < suppressClickUntil) return // 拖动刚结束：不当作点击
  const p = localXY(e)
  if (!p || !p.inside) return
  // 落在真实可交互元素上(CTA/链接/按钮/跑马灯)：放行原生行为，不发起画布请求
  if (
    (e.target as HTMLElement)?.closest(
      'a, button, [role="button"], input, textarea, select, label'
    )
  )
    return
  scene?.clickAt(p.x, p.y)
}

function onWindowFocusIn(e: FocusEvent) {
  if (isCanvasInteractionBoundary(e.target)) {
    resetInteraction()
  }
}

// 运行闸门：仅当「在视口内」且「页面可见」时才跑动画。
// IntersectionObserver 管滚动离屏，visibilitychange/pagehide 管切后台标签页/隐藏——
// 二者共同决定，避免后台空转烧 CPU（借鉴 Midjourney 的 visibilitychange 暂停）。
let intersecting = true
function syncRunning() {
  if (!scene) return
  if (intersecting && !document.hidden) scene.start()
  else scene.stop()
}
function onVisibility() {
  if (document.hidden) resetInteraction()
  syncRunning()
}
function onPageHide() {
  resetInteraction()
  scene?.stop()
}

let disposed = false

onMounted(async () => {
  if (!canvasEl.value) return
  try {
    // The canvas engine (~3000 lines) is a separate async chunk so it stays off
    // the critical path: the hero copy/H1 paints without waiting for it to load,
    // parse, and execute. It's purely decorative, so this only defers pixels.
    const { MapScene } = await import('@/canvas/MapScene')
    if (disposed || !canvasEl.value) return
    scene = new MapScene(
      canvasEl.value,
      (snapshot) => emit('signalChange', snapshot),
      resolvedTheme.value
    )
    await scene.init()
  } catch (error) {
    // No 2D context (unsupported/constrained env) or init failed. The map is
    // purely decorative, so degrade silently and keep the page functional.
    if (import.meta.env.DEV) console.warn('World map unavailable:', error)
    scene?.dispose()
    scene = null
    return
  }
  // init() awaits icon loading; if the component unmounted during that gap,
  // onBeforeUnmount has already disposed the scene (scene = null). Bail before
  // touching it — scene.start() would throw, and the listeners below would leak.
  if (disposed || !scene) return
  ready.value = true // 就绪后整景淡入，模型 Logo/枢纽不再硬弹出
  scene.start()
  window.addEventListener('resize', onResize)
  // pointermove already covers mouse/pen/touch; a separate mousemove listener
  // would double-run onWindowMove (and its getBoundingClientRect) per mouse move.
  window.addEventListener('pointermove', onWindowMove, { passive: true })
  window.addEventListener('click', onWindowClick)
  window.addEventListener('focusin', onWindowFocusIn)
  window.addEventListener('blur', resetInteraction)
  window.addEventListener('touchstart', onWindowTouchStart, { passive: true })
  window.addEventListener('touchmove', onWindowTouchMove, { passive: true })
  window.addEventListener('touchend', onWindowTouchEnd)
  window.addEventListener('touchcancel', onWindowTouchCancel)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)

  io = new IntersectionObserver(
    ([entry]) => {
      intersecting = entry.isIntersecting
      if (!intersecting) resetInteraction()
      syncRunning()
    },
    { threshold: 0 }
  )
  io.observe(canvasEl.value)
})

onBeforeUnmount(() => {
  disposed = true
  cancelBoost() // clear any in-flight long-press timer
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointermove', onWindowMove)
  window.removeEventListener('click', onWindowClick)
  window.removeEventListener('focusin', onWindowFocusIn)
  window.removeEventListener('blur', resetInteraction)
  window.removeEventListener('touchstart', onWindowTouchStart)
  window.removeEventListener('touchmove', onWindowTouchMove)
  window.removeEventListener('touchend', onWindowTouchEnd)
  window.removeEventListener('touchcancel', onWindowTouchCancel)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  io?.disconnect()
  scene?.dispose()
  scene = null // 卸载后防抖尾调用触发时 scene?.resize() 即为 no-op
})
</script>
