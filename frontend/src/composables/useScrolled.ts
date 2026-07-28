import { onMounted, onUnmounted, ref } from 'vue'

/** 监听窗口滚动，返回是否越过阈值（用于导航栏毛玻璃切换）。 */
export function useScrolled(threshold = 20) {
  const scrolled = ref(false)

  const onScroll = () => {
    scrolled.value = window.scrollY > threshold
  }

  onMounted(() => {
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', onScroll)
  })

  return { scrolled }
}
