import {
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'

interface TypedOptions {
  typeSpeed?: number
  deleteSpeed?: number
  pauseAfterType?: number
  pauseAfterDelete?: number
  startDelay?: number
}

/**
 * 轮播打字机：按 words 顺序逐字打出→停顿→逐字删除→下一个。
 * 返回 displayed（当前可见文本）。尊重 prefers-reduced-motion（直接显示首个词）。
 */
export function useTyped(
  wordsSource: MaybeRefOrGetter<readonly string[]>,
  options: TypedOptions = {}
) {
  const {
    typeSpeed = 95,
    deleteSpeed = 45,
    pauseAfterType = 1600,
    pauseAfterDelete = 350,
    startDelay = 650,
  } = options

  const displayed = ref('')
  /** 当前正在输入/删除的完整词（displayed 是它的前缀），供生长缩放计算进度。 */
  const currentWord = ref('')
  /** 打字/删除进行中为 true，停顿等待时为 false。供光标判断是否暂停闪烁。 */
  const isTyping = ref(false)
  let wordIndex = 0
  let charIndex = 0
  let deleting = false
  let timer: number | undefined
  let mounted = false

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const clearTimer = () => {
    if (timer === undefined) return
    window.clearTimeout(timer)
    timer = undefined
  }

  const tick = () => {
    const words = toValue(wordsSource)
    if (words.length === 0) {
      displayed.value = ''
      return
    }

    const current = words[wordIndex % words.length]
    currentWord.value = current

    if (!deleting) {
      charIndex++
      displayed.value = current.slice(0, charIndex)
      if (charIndex >= current.length) {
        deleting = true
        isTyping.value = false
        timer = window.setTimeout(tick, pauseAfterType)
        return
      }
      isTyping.value = true
      timer = window.setTimeout(tick, typeSpeed)
    } else {
      charIndex--
      displayed.value = current.slice(0, Math.max(0, charIndex))
      if (charIndex <= 0) {
        deleting = false
        wordIndex++
        isTyping.value = false
        timer = window.setTimeout(tick, pauseAfterDelete)
        return
      }
      isTyping.value = true
      timer = window.setTimeout(tick, deleteSpeed)
    }
  }

  const restart = () => {
    clearTimer()
    wordIndex = 0
    charIndex = 0
    deleting = false
    isTyping.value = false

    const words = toValue(wordsSource)
    currentWord.value = words[0] ?? ''
    if (reduced || words.length === 0) {
      displayed.value = words[0] ?? ''
      return
    }

    displayed.value = ''
    timer = window.setTimeout(tick, startDelay)
  }

  watch(
    () => toValue(wordsSource),
    () => {
      if (mounted) restart()
    }
  )

  onMounted(() => {
    mounted = true
    restart()
  })

  onUnmounted(() => {
    mounted = false
    clearTimer()
  })

  return { displayed, currentWord, isTyping }
}
