import { onMounted, onUnmounted } from 'vue'

const DEFAULT_CLASS_NAME = 'hero-scrollbar-hidden'

/**
 * The native browser rail cannot fade predictably across engines. Suppress it
 * for the lifetime of HomeView and let the activity indicator render the
 * visible, timed state instead. No overflow is changed, so wheel,
 * touchpad, touch, and keyboard scrolling keep their native behavior.
 */
export function useHeroScrollChrome(className = DEFAULT_CLASS_NAME) {
  onMounted(() => {
    document.documentElement.classList.add(className)
  })

  onUnmounted(() => {
    document.documentElement.classList.remove(className)
  })
}
