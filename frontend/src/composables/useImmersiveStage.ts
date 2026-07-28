import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const ENTER_THRESHOLD_PX = 64 // 舞台条下滑进入阈值
const EXIT_THRESHOLD_PX = 64 // 沉浸态上滑退出阈值
const DIRECTION_RATIO = 1.5 // 竖向判定：|dy| > |dx| × 1.5（与横滑转图对称互斥）
const CLAIM_PX = 8 // 手势方向判定阈值
const HINT_DELAY_MS = 1400 // 首访提示入场延迟
const HINT_DURATION_MS = 4500 // 提示自动隐藏时长

/**
 * 移动端「下滑进入全屏沉浸」：舞台条下滑隐藏 Hero 内容（Ticker 同步隐去），
 * 全屏态上滑或点召回钮恢复；附首访引导提示的显示调度。
 * 手势未判定时零拦截；竖向判定与 HeroWorldMap 的横滑转图方向比对称（1.5），
 * 同一次滑动手势只会被其中一方认领，互不劫持。
 */
export function useImmersiveStage() {
  const immersive = ref(false)
  const showHint = ref(false)

  let hintDelayTimer: number | undefined
  let hintHideTimer: number | undefined
  let desktopQuery: MediaQueryList | undefined

  // 进入手势（舞台条元素级）
  let enterStartX = 0
  let enterStartY = 0
  let enterGesture: 'idle' | 'pending' | 'pass' = 'idle'

  // 退出手势（window 级，仅沉浸态注册）
  let exitStartX = 0
  let exitStartY = 0
  let exitGesture: 'idle' | 'pending' | 'claim' | 'pass' = 'idle'

  function clearHintTimers() {
    if (hintDelayTimer !== undefined) window.clearTimeout(hintDelayTimer)
    if (hintHideTimer !== undefined) window.clearTimeout(hintHideTimer)
    hintDelayTimer = undefined
    hintHideTimer = undefined
  }

  function hideHint() {
    showHint.value = false
    clearHintTimers()
  }

  function enter() {
    if (immersive.value) return
    immersive.value = true
    hideHint()
  }

  function exit() {
    if (!immersive.value) return
    immersive.value = false
  }

  /* ===== 进入：舞台条下滑（pan-x 已排除浏览器竖滚/下拉刷新，无需拦截） ===== */
  function onStageTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) {
      enterGesture = 'idle'
      return
    }
    enterStartX = e.touches[0].clientX
    enterStartY = e.touches[0].clientY
    enterGesture = 'pending'
  }

  function onStageTouchMove(e: TouchEvent) {
    if (enterGesture !== 'pending') return
    const dx = e.touches[0].clientX - enterStartX
    const dy = e.touches[0].clientY - enterStartY
    if (Math.abs(dx) < CLAIM_PX && Math.abs(dy) < CLAIM_PX) return
    if (dy > 0 && Math.abs(dy) > Math.abs(dx) * DIRECTION_RATIO) {
      if (dy >= ENTER_THRESHOLD_PX) {
        enter()
        enterGesture = 'idle'
      }
    } else {
      enterGesture = 'pass'
    }
  }

  function onStageTouchEnd() {
    enterGesture = 'idle'
  }

  /* ===== 退出：沉浸态全屏上滑（认领后 preventDefault 防页面滚动） ===== */
  function isInteractiveTarget(target: EventTarget | null) {
    if (!(target instanceof Element)) return false
    return Boolean(
      target.closest(
        'a, button, [role="button"], input, textarea, select, label'
      )
    )
  }

  function onExitTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1 || isInteractiveTarget(e.target)) {
      exitGesture = 'idle'
      return
    }
    exitStartX = e.touches[0].clientX
    exitStartY = e.touches[0].clientY
    exitGesture = 'pending'
  }

  function onExitTouchMove(e: TouchEvent) {
    if (exitGesture !== 'pending' && exitGesture !== 'claim') return
    const dx = e.touches[0].clientX - exitStartX
    const dy = e.touches[0].clientY - exitStartY
    if (exitGesture === 'pending') {
      if (Math.abs(dx) < CLAIM_PX && Math.abs(dy) < CLAIM_PX) return
      if (dy < 0 && Math.abs(dy) > Math.abs(dx) * DIRECTION_RATIO) {
        exitGesture = 'claim'
      } else {
        exitGesture = 'pass'
        return
      }
    }
    if (e.cancelable) e.preventDefault()
    if (dy <= -EXIT_THRESHOLD_PX) {
      exit()
      exitGesture = 'idle'
    }
  }

  function onExitTouchEnd() {
    exitGesture = 'idle'
  }

  function addExitListeners() {
    window.addEventListener('touchstart', onExitTouchStart, { passive: true })
    window.addEventListener('touchmove', onExitTouchMove, { passive: false })
    window.addEventListener('touchend', onExitTouchEnd)
    window.addEventListener('touchcancel', onExitTouchEnd)
  }

  function removeExitListeners() {
    window.removeEventListener('touchstart', onExitTouchStart)
    window.removeEventListener('touchmove', onExitTouchMove)
    window.removeEventListener('touchend', onExitTouchEnd)
    window.removeEventListener('touchcancel', onExitTouchEnd)
    exitGesture = 'idle'
  }

  watch(immersive, (value) =>
    value ? addExitListeners() : removeExitListeners()
  )

  function onDesktopChange(e: MediaQueryListEvent) {
    if (e.matches) exit()
  }

  onMounted(() => {
    desktopQuery = window.matchMedia('(min-width: 1024px)')
    desktopQuery.addEventListener('change', onDesktopChange)
    // 首访引导提示仅在移动端显示一次
    if (!desktopQuery.matches) {
      hintDelayTimer = window.setTimeout(() => {
        hintDelayTimer = undefined
        showHint.value = true
        hintHideTimer = window.setTimeout(() => {
          hintHideTimer = undefined
          showHint.value = false
        }, HINT_DURATION_MS)
      }, HINT_DELAY_MS)
    }
  })

  onBeforeUnmount(() => {
    desktopQuery?.removeEventListener('change', onDesktopChange)
    clearHintTimers()
    removeExitListeners()
  })

  return {
    immersive,
    showHint,
    enter,
    exit,
    onStageTouchStart,
    onStageTouchMove,
    onStageTouchEnd,
  }
}
