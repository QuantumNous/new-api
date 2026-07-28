<template>
  <div
    class="hero-copy-glow flex w-full max-w-xl flex-col items-center text-center max-lg:px-2 max-lg:py-2 lg:max-w-[38rem] lg:items-end lg:text-right xl:max-w-[42rem]"
  >
    <!-- 眉标 -->
    <p
      class="animate-fade-in font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] sm:text-xs sm:tracking-[0.2em]"
      style="animation-delay: 0.15s"
    >
      {{ t('hero.eyebrow') }}
    </p>

    <!-- 主标题 + 逐词缩放打字机（最长词可比主标题大、其余词小一些；
         打字生长动效；transform 缩放不改布局，行高恒定）
         h1 必须 w-full：flex 容器 items-center/items-end 会让 h1 收缩为内容宽，
         typedLine 的 clientWidth 随当前词变化 → 逐词缩放基准跟着内容漂移。
         w-full 后测量基准 = HeroContent 容器宽（与内容无关），缩放只随视口变化。 -->
    <h1
      class="hero-title mt-3 w-full text-[clamp(1.85rem,9vw,2.5rem)] font-extrabold leading-[1.08] tracking-tight text-[var(--text-primary)] [@media(max-height:700px)_and_(max-width:1023px)]:text-[clamp(1.55rem,7vw,1.9rem)] sm:mt-4 sm:text-5xl sm:leading-[1.15] lg:text-[3.4rem]"
    >
      <span
        class="animate-rise-in whitespace-nowrap"
        style="animation-delay: 0.25s"
        >{{ t('hero.titleLead') }}</span
      >
      <span ref="typedLine" class="block w-full whitespace-nowrap">
        <span
          class="typewriter-scale-box inline-block origin-center lg:origin-right"
          :style="{ transform: typedTransform, '--type-scale': typedScaleText }"
          ><span class="gradient-text">{{ displayed }}</span
          ><span class="type-cursor" :class="{ 'is-typing': isTyping }"
        /></span>
      </span>
    </h1>

    <!-- 副标题 -->
    <p
      class="mt-3 max-w-lg animate-fade-in text-[15px] leading-relaxed text-[var(--text-secondary)] max-sm:[@media(min-height:701px)]:mt-4 sm:mt-5 sm:text-lg"
      style="animation-delay: 0.5s"
    >
      {{ t('hero.subtitle') }}
    </p>

    <!-- 承诺胶囊 -->
    <ul
      class="mt-3.5 flex flex-wrap justify-center gap-1.5 animate-fade-in max-sm:[@media(min-height:701px)]:mt-4 sm:mt-5 sm:gap-2 lg:justify-end"
      style="animation-delay: 0.65s"
    >
      <li
        v-for="p in pledges"
        :key="p"
        class="hero-pledge inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] text-[var(--text-secondary)] sm:px-3 sm:text-xs"
      >
        <svg
          class="text-[var(--accent)]"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.6"
          aria-hidden="true"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        {{ p }}
      </li>
    </ul>

    <!-- CTA -->
    <div
      class="mt-5 flex w-full flex-col items-stretch gap-2 animate-fade-in max-sm:[@media(min-height:701px)]:mt-6 sm:mt-6 lg:mt-8 lg:w-auto lg:flex-row lg:items-center lg:gap-3 lg:justify-end"
      style="animation-delay: 0.8s"
    >
      <RouterLink
        :to="isAuthenticated ? { name: 'dashboard' } : { name: 'sign-in' }"
        class="hero-cta-primary group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-[var(--accent)] px-7 py-3.5 text-base font-semibold text-[var(--accent-contrast)] shadow-[var(--button-shadow)] transition-all [text-shadow:none] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[var(--button-shadow-hover)] active:scale-[0.98] lg:w-auto"
      >
        <span class="cta-sheen" />
        <span class="relative">{{
          isAuthenticated ? t('nav.console') : t('hero.ctaPrimary')
        }}</span>
        <svg
          class="relative transition-transform group-hover:translate-x-0.5"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </RouterLink>
      <a
        v-if="showDocs"
        :href="docsLink"
        target="_blank"
        rel="noopener noreferrer"
        class="hero-cta-secondary group inline-flex min-h-11 items-center justify-center gap-2 self-center px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)] lg:min-h-0 lg:self-auto lg:rounded-full lg:border lg:border-[var(--border-default)] lg:px-7 lg:py-3.5 lg:text-base lg:font-semibold lg:text-[var(--text-secondary)] lg:transition-all lg:hover:border-[var(--border-strong)] lg:hover:bg-[var(--surface-muted)]"
      >
        {{ t('hero.ctaSecondary') }}
        <svg
          class="transition-transform group-hover:translate-x-0.5"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </a>
    </div>

    <!-- 指标（≤843px 高的移动设备隐藏：延迟数据已由 Ticker 呈现，为完整间距腾出空间） -->
    <dl
      class="mt-5 grid w-full grid-cols-3 gap-2 text-center animate-fade-in max-sm:[@media(min-height:701px)]:mt-6 [@media(max-height:843px)_and_(max-width:1023px)]:hidden sm:mt-6 sm:gap-4 lg:mt-8 lg:flex lg:w-auto lg:gap-8 lg:text-right lg:justify-end"
      style="animation-delay: 0.95s"
    >
      <div v-for="m in metrics" :key="m.label" class="min-w-0">
        <dt
          class="font-mono text-xl font-bold text-[var(--text-primary)] sm:text-2xl"
        >
          {{ m.value }}
        </dt>
        <dd
          class="mt-0.5 break-words text-[10px] leading-tight text-[var(--text-tertiary)] sm:text-xs sm:leading-normal"
        >
          {{ m.label }}
        </dd>
      </div>
    </dl>

    <!-- 已适配工具跑马灯 -->
    <div
      class="hero-integration-boundary mt-4 w-full min-w-0 overflow-visible border-t border-[var(--border-subtle)] pt-3 animate-fade-in max-sm:[@media(min-height:701px)]:mt-5 lg:mt-7"
      style="animation-delay: 1.1s"
    >
      <IntegrationMarquee />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import { useTyped } from '@/composables/useTyped'
import { useTheme } from '@/composables/useTheme'
import IntegrationMarquee from './IntegrationMarquee.vue'
import { useAppStore } from '@/stores'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  /** Canvas 信号场景回传的滚动平均延迟；首个请求完成前为 undefined。 */
  averageLatencyMs?: number
}>()

const { t, tm } = useI18n()
const { docsLink, showDocs, modelCountLabel, uptimeLabel } =
  storeToRefs(useAppStore())
const { isAuthenticated } = storeToRefs(useAuthStore())

const typedWords = computed(() => tm('hero.typed') as string[])
const { displayed, currentWord, isTyping } = useTyped(typedWords)

const pledges = computed(() => tm('hero.pledges') as string[])

const latencyLabel = computed(() =>
  typeof props.averageLatencyMs === 'number'
    ? `${Math.round(props.averageLatencyMs)}ms`
    : '--'
)

const metrics = computed(() => [
  { value: modelCountLabel.value, label: t('hero.metrics.models') },
  { value: uptimeLabel.value, label: t('hero.metrics.uptime') },
  { value: latencyLabel.value, label: t('hero.metrics.latency') },
])

/* ===== 标题第二行逐词缩放 =====
   最长词按容器宽度适配（宽屏允许超过主标题，MAX_SCALE 封顶防纵向溢出）；
   其余词固定 OTHER_SCALE（比主标题小一些）；每个词再按容器宽度硬收一次，
   任何情况下都不超出一行。transform 不改布局盒，行高与卡片高度锁死。 */
const typedLine = ref<HTMLElement | null>(null)
const fitScale = ref(1) // 最长词的容器适配缩放
const longestWord = ref('')
const wordWidths = ref<Record<string, number>>({})
const containerAvailable = ref(0)
const CURSOR_RESERVE = 14 // 光标外悬占位（px）
const MIN_SCALE = 0.55
/* 日间（Noto Serif SC）字符更宽，词间像素差大，缩放范围收窄避免词切换时跳变；
   夜间（Inter）保持原有两端值，视觉一致。 */
const { resolvedTheme } = useTheme()
const maxScale = computed(() => (resolvedTheme.value === 'dark' ? 0.88 : 0.84))
const otherScale = computed(() => (resolvedTheme.value === 'dark' ? 0.75 : 0.8))
let measureCtx: CanvasRenderingContext2D | null = null

function fitLine() {
  const line = typedLine.value
  if (!line) return
  if (!measureCtx) {
    measureCtx = document.createElement('canvas').getContext('2d')
    if (!measureCtx) return
  }
  const cs = getComputedStyle(line)
  measureCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  const words = typedWords.value
  if (!words.length) return
  const widths: Record<string, number> = {}
  for (const w of words) widths[w] = measureCtx.measureText(w).width
  wordWidths.value = widths
  const longest = words.reduce((a, b) => (widths[a] >= widths[b] ? a : b))
  longestWord.value = longest
  const needed = widths[longest] + CURSOR_RESERVE
  const available = line.clientWidth
  containerAvailable.value = available
  if (available <= 0 || needed <= 0) return
  fitScale.value = Math.max(
    Math.min(maxScale.value, available / needed),
    MIN_SCALE
  )
}

/* ===== 生长式打字动效（内容越多字体越大） =====
   打字进度 = 已打字数 / 当前词长，缩放从 GROW_START 线性长到 1（删除同步回缩）；
   与逐词目标缩放相乘，生长全程不超出一行。
   transform 不改布局盒，行高恒定；reduced-motion 时进度恒满（无动效）。 */
const GROW_START = 0.85 // 首字起始缩放比例（0.85→1 柔和生长，避免忽大忽小）
const growScale = computed(() => {
  const total = currentWord.value.length
  if (total <= 0) return 1
  const progress = Math.min(1, displayed.value.length / total)
  return GROW_START + (1 - GROW_START) * progress
})

/* 逐词目标缩放：最长词用容器适配值（宽屏可比主标题大），其余词小一些；
   任何词都再按容器宽度收一次，保证一行。 */
const wordScale = computed(() => {
  const word = currentWord.value
  const target =
    word && word === longestWord.value ? fitScale.value : otherScale.value
  const width = wordWidths.value[word] ?? 0
  if (width > 0 && containerAvailable.value > 0) {
    return Math.min(target, containerAvailable.value / width)
  }
  return target
})
/* 数值缩放同时暴露为 CSS 变量 --type-scale：PC 端光标用它做反缩放锁定尺寸 */
const typedScale = computed(() => wordScale.value * growScale.value)
const typedScaleText = computed(() => typedScale.value.toFixed(4))
const typedTransform = computed(() => `scale(${typedScaleText.value})`)

watch(typedWords, () => void nextTick(fitLine))
useResizeObserver(typedLine, () => fitLine())

watch(resolvedTheme, () => void nextTick(fitLine))

onMounted(() => {
  fitLine()
  // 衬线/正文字体异步就绪后重测，避免按回退字体量出的偏差
  document.fonts.ready.then(() => fitLine()).catch(() => {})
})
</script>
