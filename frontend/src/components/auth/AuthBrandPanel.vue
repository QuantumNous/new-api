<script setup lang="ts">
// 登录页左栏「钥匙星座」品牌面板：
// L0 恒深底色 → L1 AI 氛围背景(双主题) + scrim → L3 AuthScene 画布
// → L4 HTML 品牌文案 + 真实数据 mini-ticker。视差由指针驱动（hover 设备限定）。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import BrandMark from '@/components/console/BrandMark.vue'
import type { AuthScene } from '@/canvas/AuthScene'
import { useTheme } from '@/composables/useTheme'
import { useAppStore } from '@/stores'

import panelDay from '@/assets/auth/panel-day.webp'
import panelNight from '@/assets/auth/panel-night.webp'
import keyEmblem from '@/assets/auth/key-emblem.png'

const { t } = useI18n()
const { resolvedTheme } = useTheme()
const app = useAppStore()

const panelEl = ref<HTMLElement | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const hoverName = ref<string | null>(null)
const ready = ref(false)

const bgImage = computed(() =>
  resolvedTheme.value === 'dark' ? panelNight : panelDay
)

/* ===== mini-ticker：真实 store 数据轮播（reduced-motion 时静态并列） ===== */
const reducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const tickerItems = computed(() => [
  { key: 'models', label: t('auth.tickerModels'), value: app.modelCountLabel },
  { key: 'uptime', label: t('auth.tickerUptime'), value: app.uptimeLabel },
  { key: 'version', label: t('auth.tickerVersion'), value: app.versionLabel },
])
const tickerIndex = ref(0)
let tickerTimer: number | undefined
if (!reducedMotion) {
  tickerTimer = window.setInterval(() => {
    tickerIndex.value = (tickerIndex.value + 1) % 3
  }, 4000)
}

/* ===== AuthScene 生命周期（异步 chunk；visibilitychange 闸门） ===== */
let scene: AuthScene | null = null
let disposed = false
let resizeObserver: ResizeObserver | null = null

const supportsHover =
  typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

function onPointerMove(e: PointerEvent) {
  if (!scene || !panelEl.value) return
  const r = panelEl.value.getBoundingClientRect()
  const nx = (e.clientX - r.left) / r.width
  const ny = (e.clientY - r.top) / r.height
  scene.setPointer(nx, ny)
  hoverName.value = scene.hitTest(e.clientX - r.left, e.clientY - r.top)
}

function onPointerLeave() {
  scene?.setPointer(0.5, 0.5)
  hoverName.value = null
}

function syncRunning() {
  if (!scene) return
  if (document.hidden) scene.stop()
  else scene.start()
}

onMounted(async () => {
  if (!canvasEl.value) return
  try {
    const { AuthScene } = await import('@/canvas/AuthScene')
    if (disposed || !canvasEl.value) return
    scene = new AuthScene(canvasEl.value, resolvedTheme.value, reducedMotion)
    await scene.init()
    void scene.loadKeyEmblem(keyEmblem)
  } catch {
    // 纯装饰：环境不支持 2D context 时静默降级为背景图 + 文案
    scene?.dispose()
    scene = null
    return
  }
  if (disposed || !scene) return
  ready.value = true
  scene.start()

  resizeObserver = new ResizeObserver(() => scene?.resize())
  resizeObserver.observe(canvasEl.value)
  document.addEventListener('visibilitychange', syncRunning)
  if (supportsHover && !reducedMotion) {
    panelEl.value?.addEventListener('pointermove', onPointerMove, {
      passive: true,
    })
    panelEl.value?.addEventListener('pointerleave', onPointerLeave)
  }
})

watch(resolvedTheme, (theme) => scene?.setTheme(theme))

onBeforeUnmount(() => {
  disposed = true
  if (tickerTimer !== undefined) window.clearInterval(tickerTimer)
  document.removeEventListener('visibilitychange', syncRunning)
  panelEl.value?.removeEventListener('pointermove', onPointerMove)
  panelEl.value?.removeEventListener('pointerleave', onPointerLeave)
  resizeObserver?.disconnect()
  scene?.dispose()
  scene = null
})
</script>

<template>
  <aside
    ref="panelEl"
    class="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex"
    style="background: var(--surface-footer)"
  >
    <!-- L1: AI 氛围背景（双主题切换）+ scrim 保证文字对比度 -->
    <div
      class="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
      :style="{ backgroundImage: `url(${bgImage})` }"
      aria-hidden="true"
    />
    <!-- scrim: darkens the copy band (y 38%-70%) and the ticker foot so the
         serif headline keeps contrast over whatever the artwork does there -->
    <div
      class="absolute inset-0"
      style="
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0.16) 0%,
          rgba(0, 0, 0, 0.04) 26%,
          rgba(0, 0, 0, 0.52) 44%,
          rgba(0, 0, 0, 0.6) 62%,
          rgba(0, 0, 0, 0.5) 80%,
          rgba(0, 0, 0, 0.62) 100%
        );
      "
      aria-hidden="true"
    />

    <!-- L3: 钥匙星座画布（纯装饰；底部渐隐，避免与 ticker 抢注意力） -->
    <canvas
      ref="canvasEl"
      class="absolute inset-0 h-full w-full transition-opacity duration-700"
      :class="ready ? 'opacity-100' : 'opacity-0'"
      style="
        mask-image: linear-gradient(
          180deg,
          black 0%,
          black 80%,
          transparent 94%
        );
        -webkit-mask-image: linear-gradient(
          180deg,
          black 0%,
          black 80%,
          transparent 94%
        );
      "
      aria-hidden="true"
    />

    <!-- L4: 品牌行 -->
    <div class="relative z-10 flex items-center gap-3">
      <BrandMark class="h-10 w-10 rounded-xl" />
      <span class="text-xl font-bold" style="color: var(--footer-text-primary)"
        >Ren2Hub</span
      >
    </div>

    <!-- L4: 文案区 -->
    <div class="relative z-10">
      <p
        class="text-xs font-semibold uppercase tracking-[0.22em]"
        style="color: var(--footer-accent)"
      >
        {{ t('auth.brandSlogan') }}
      </p>
      <h2
        class="display-title mt-4 text-4xl font-bold leading-snug"
        style="color: var(--footer-text-primary)"
      >
        {{ t('auth.signUpSubtitle') }}
      </h2>
      <p
        class="mt-4 max-w-sm text-sm leading-relaxed"
        style="color: var(--footer-text-tertiary)"
      >
        {{ t('auth.brandTagline') }}
      </p>
    </div>

    <!-- L4: mini-ticker（真实数据；reduced-motion 时静态并列） -->
    <div class="relative z-10" aria-live="off">
      <template v-if="reducedMotion">
        <div class="flex flex-wrap gap-x-6 gap-y-1.5">
          <p
            v-for="item in tickerItems"
            :key="item.key"
            class="text-xs"
            style="color: var(--footer-text-tertiary)"
          >
            {{ item.label }}
            <span
              class="ml-1 font-mono font-semibold"
              style="color: var(--footer-text-secondary)"
              >{{ item.value }}</span
            >
          </p>
        </div>
      </template>
      <template v-else>
        <!-- Keyed CSS animation rather than <Transition>: the element is always
             at its final opacity, so a dropped transition can't leave it blank. -->
        <div class="flex min-h-6 items-center">
          <p
            :key="tickerIndex"
            class="tick-item flex items-center gap-2 whitespace-nowrap text-xs"
            style="color: var(--footer-text-tertiary)"
          >
            <span
              class="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
              style="background: var(--footer-accent)"
            />
            {{ tickerItems[tickerIndex].label }}
            <span
              class="font-mono font-semibold"
              style="color: var(--footer-text-secondary)"
              >{{ tickerItems[tickerIndex].value }}</span
            >
          </p>
        </div>
        <div class="mt-3 flex gap-2" aria-hidden="true">
          <span
            v-for="(item, i) in tickerItems"
            :key="item.key"
            class="h-1.5 rounded-full transition-all duration-300"
            :style="{
              width: i === tickerIndex ? '2.5rem' : '1.25rem',
              background:
                i === tickerIndex
                  ? 'var(--footer-accent)'
                  : 'var(--footer-border)',
            }"
          />
        </div>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.tick-item {
  animation: tick-in 0.4s cubic-bezier(0.2, 0.6, 0.2, 1) both;
}

@keyframes tick-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .tick-item {
    animation: none;
  }
}
</style>
