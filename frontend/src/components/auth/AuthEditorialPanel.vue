<script setup lang="ts">
// 登录页左栏 — 编辑级排版叙事（随想式）：
// 中转链路图（提示词 → 网关直通 → 官方上游）、衬线诗意大标题、
// 信任要点清单、点阵地球（AI 中转的世界意象）、真实运行数据脚注。
// 全部颜色走语义令牌，与站点整页纸底/炭蓝双主题同源。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import type { DotGlobe } from '@/canvas/DotGlobe'
import { useTheme } from '@/composables/useTheme'
import { useAppStore } from '@/stores'

const { t } = useI18n()
const { resolvedTheme } = useTheme()
const app = useAppStore()

const globeEl = ref<HTMLCanvasElement | null>(null)
const ready = ref(false)

const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const stats = computed(() => [
  { label: t('auth.tickerModels'), value: app.modelCountLabel },
  { label: t('auth.tickerUptime'), value: app.uptimeLabel },
  { label: t('auth.tickerVersion'), value: app.versionLabel },
])

let globe: DotGlobe | null = null
let disposed = false
let resizeObserver: ResizeObserver | null = null

function syncRunning() {
  if (!globe) return
  if (document.hidden) globe.stop()
  else globe.start()
}

onMounted(async () => {
  if (!globeEl.value) return
  if (globeEl.value.getBoundingClientRect().width === 0) return // hidden < lg
  try {
    const { DotGlobe } = await import('@/canvas/DotGlobe')
    if (disposed || !globeEl.value) return
    globe = new DotGlobe(globeEl.value, reducedMotion)
    globe.resize()
  } catch {
    globe?.dispose()
    globe = null
    return
  }
  if (disposed || !globe) return
  ready.value = true
  globe.start()
  resizeObserver = new ResizeObserver(() => globe?.resize())
  resizeObserver.observe(globeEl.value)
  document.addEventListener('visibilitychange', syncRunning)
})

watch(resolvedTheme, () => globe?.refreshPalette())

onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('visibilitychange', syncRunning)
  resizeObserver?.disconnect()
  globe?.dispose()
  globe = null
})
</script>

<template>
  <div
    class="relative hidden min-h-full flex-col justify-between overflow-hidden px-12 py-12 lg:flex xl:px-16"
  >
    <!-- 点阵地球：右下沉入，纸面上的静谧星球 -->
    <canvas
      ref="globeEl"
      class="pointer-events-none absolute -bottom-[30%] -right-[22%] h-[76%] w-[100%] transition-opacity duration-1000"
      :class="ready ? 'opacity-100' : 'opacity-0'"
      aria-hidden="true"
    />

    <!-- 顶部：中转链路图 — 提示词 → 网关 → 官方上游 -->
    <div class="relative z-10">
      <div
        class="flex items-end gap-0 text-[11px] tracking-[0.08em] text-[var(--text-tertiary)]"
        aria-hidden="true"
      >
        <!-- node: prompt -->
        <div class="flex flex-col items-start gap-2.5">
          <svg
            width="72"
            height="30"
            viewBox="0 0 72 30"
            fill="none"
            class="text-[var(--text-secondary)]"
          >
            <path d="M2 24 h44" stroke="currentColor" stroke-width="1" />
            <path
              d="M6 24 c2 -8 6 -14 14 -16"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.5"
            />
            <path
              d="M52 24 l7 -18 M58 24 l7 -18"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
          <span>{{ t('auth.relay.prompt') }}</span>
        </div>
        <div
          class="mx-3 mb-[22px] h-px w-16 bg-[var(--border-default)] xl:w-24"
        />
        <!-- node: gateway passthrough -->
        <div class="flex flex-col items-start gap-2.5">
          <svg
            width="60"
            height="30"
            viewBox="0 0 60 30"
            fill="none"
            class="text-[var(--text-secondary)]"
          >
            <path
              d="M6 24 l7 -18 M13 24 l7 -18"
              stroke="currentColor"
              stroke-width="1"
            />
            <path
              d="M30 24 l7 -18 M37 24 l7 -18"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.5"
            />
          </svg>
          <span>{{ t('auth.relay.passthrough') }}</span>
        </div>
        <div
          class="mx-3 mb-[22px] h-px w-16 bg-[var(--border-default)] xl:w-24"
        />
        <!-- node: official upstream -->
        <div class="flex flex-col items-start gap-2.5">
          <svg
            width="34"
            height="34"
            viewBox="0 0 34 34"
            fill="none"
            class="text-[var(--text-secondary)]"
          >
            <rect
              x="8"
              y="3"
              width="18"
              height="26"
              rx="2.5"
              stroke="currentColor"
              stroke-width="1.1"
            />
            <circle cx="21.5" cy="8" r="1.4" fill="var(--accent)" />
            <path
              d="M12 14 h10 M12 19 h10 M12 24 h6"
              stroke="currentColor"
              stroke-width="1"
              opacity="0.55"
            />
          </svg>
          <span>{{ t('auth.relay.upstream') }}</span>
        </div>
      </div>
    </div>

    <!-- 中部：标语 + 诗意大标题 + 信任要点 -->
    <div class="relative z-10 max-w-xl">
      <p
        class="flex items-center gap-3 text-xs tracking-[0.3em] text-[var(--text-tertiary)]"
      >
        <span>{{ t('auth.editorial.word1') }}</span>
        <span class="text-[var(--accent)]">·</span>
        <span>{{ t('auth.editorial.word2') }}</span>
        <span class="text-[var(--accent)]">·</span>
        <span>{{ t('auth.editorial.word3') }}</span>
      </p>

      <h1 class="display-title mt-6 leading-[1.14] text-[var(--text-primary)]">
        <span class="block text-5xl font-bold xl:text-6xl">{{
          t('auth.editorial.line1')
        }}</span>
        <span
          class="mt-2 block text-5xl font-bold text-[var(--text-tertiary)] xl:text-6xl"
          >{{ t('auth.editorial.line2') }}</span
        >
      </h1>

      <div class="mt-10 h-px w-full max-w-md bg-[var(--border-default)]" />

      <ul class="mt-8 space-y-4 text-sm text-[var(--text-secondary)]">
        <li class="flex items-center gap-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-[var(--text-tertiary)]"
          >
            <rect x="4" y="10" width="16" height="11" rx="2" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          {{ t('auth.editorial.point1') }}
        </li>
        <li class="flex items-center gap-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-[var(--text-tertiary)]"
          >
            <path d="M12 2 4 6v6c0 5 3.4 8.6 8 10 4.6-1.4 8-5 8-10V6l-8-4Z" />
          </svg>
          {{ t('auth.editorial.point2') }}
        </li>
        <li class="flex items-center gap-3.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="shrink-0 text-[var(--text-tertiary)]"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3.5 2" />
          </svg>
          {{ t('auth.editorial.point3') }}
        </li>
      </ul>
    </div>

    <!-- 底部：SUPPORT 标注 + 真实运行数据 -->
    <div class="relative z-10 max-w-md">
      <div class="h-px w-full bg-[var(--border-default)]" />
      <p
        class="mt-5 flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-tertiary)]"
      >
        <span
          class="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
        />
        {{ t('auth.editorial.statusLabel') }}
      </p>
      <div class="mt-3 flex flex-wrap gap-x-8 gap-y-1.5">
        <p
          v-for="s in stats"
          :key="s.label"
          class="text-sm text-[var(--text-tertiary)]"
        >
          {{ s.label }}
          <span
            class="ml-1.5 font-mono font-semibold text-[var(--text-primary)]"
            >{{ s.value }}</span
          >
        </p>
      </div>
    </div>
  </div>
</template>
