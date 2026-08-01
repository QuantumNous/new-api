<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, Zap } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { HomeRuntime } from '@/types/homeShowcase'

const props = defineProps<{
  runtime: HomeRuntime
  requests: number
  uptimeLabel: string
}>()

const { t } = useI18n()

// ===== Split-flap: 记录每个 digit 的前一值，触发翻牌动画 =====
const prevDigits = ref<Record<string, string>>({})
const previousDigits = ref<Record<string, string>>({})
const flippingDigits = ref<Set<string>>(new Set())
let flipTimers: Record<string, ReturnType<typeof setTimeout>> = {}

const clockGroups = computed(() => [
  {
    key: 'days',
    value: String(props.runtime.days).padStart(3, '0'),
    label: t('showcase.runtime.units.days'),
  },
  {
    key: 'hours',
    value: String(props.runtime.hours).padStart(2, '0'),
    label: t('showcase.runtime.units.hours'),
  },
  {
    key: 'minutes',
    value: String(props.runtime.minutes).padStart(2, '0'),
    label: t('showcase.runtime.units.minutes'),
  },
  {
    key: 'seconds',
    value: String(props.runtime.seconds).padStart(2, '0'),
    label: t('showcase.runtime.units.seconds'),
  },
])

// 监听每个 digit 变化，标记对应格进行翻牌动画
watch(
  clockGroups,
  (groups) => {
    groups.forEach((group) => {
      group.value.split('').forEach((digit, idx) => {
        const id = `${group.key}-${idx}`
        if (
          prevDigits.value[id] !== undefined &&
          prevDigits.value[id] !== digit
        ) {
          previousDigits.value[id] = prevDigits.value[id]
          flippingDigits.value.add(id)
          clearTimeout(flipTimers[id])
          flipTimers[id] = setTimeout(() => {
            flippingDigits.value.delete(id)
          }, 420)
        }
        prevDigits.value[id] = digit
      })
    })
  },
  { immediate: true }
)

// ===== 请求总数 count-up =====
const displayRequests = ref(0)
let countRafId: number | null = null
let countStarted = false
let countTarget = 0

function startCountUp(target: number) {
  if (countStarted) return
  countStarted = true
  countTarget = target
  const start = Math.max(0, target - 1400)
  const duration = 1800
  const startTime = performance.now()

  function tick(now: number) {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    displayRequests.value = Math.round(start + (countTarget - start) * eased)
    if (progress < 1) {
      countRafId = requestAnimationFrame(tick)
    } else {
      displayRequests.value = countTarget
      countRafId = null
    }
  }
  countRafId = requestAnimationFrame(tick)
}

watch(
  () => props.requests,
  (target) => {
    if (!countStarted) return
    if (countRafId !== null) {
      countTarget = target
      return
    }
    displayRequests.value = target
  }
)

function previousDigit(id: string, fallback: string) {
  return previousDigits.value[id] ?? fallback
}

// 监听 section 进入视口后触发 count-up
const sectionRef = ref<HTMLElement | null>(null)
let io: IntersectionObserver | null = null

onMounted(() => {
  // 初始化 prevDigits
  clockGroups.value.forEach((group) => {
    group.value.split('').forEach((digit, idx) => {
      prevDigits.value[`${group.key}-${idx}`] = digit
    })
  })
  displayRequests.value = 0

  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  if (reducedMotion) {
    displayRequests.value = props.requests
    countStarted = true
    return
  }

  io = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        startCountUp(props.requests)
        io?.disconnect()
      }
    },
    { threshold: 0.15 }
  )
  if (sectionRef.value) io.observe(sectionRef.value)
})

onBeforeUnmount(() => {
  io?.disconnect()
  if (countRafId !== null) cancelAnimationFrame(countRafId)
  Object.values(flipTimers).forEach(clearTimeout)
})

// 可用率柱状图高度（固定 seed，每次相同）
const barHeights = [14, 20, 16, 26, 12, 22, 18]

// 柱状图入场：进入视口后依次弹入
const barsVisible = ref(false)
onMounted(() => {
  const reducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches
  if (reducedMotion) {
    barsVisible.value = true
    return
  }
  // barsVisible 通过 watch(displayRequests) 在 count-up 启动后自动设为 true
})

watch(displayRequests, (v) => {
  if (v > 0 && !barsVisible.value) barsVisible.value = true
})
</script>

<template>
  <section
    id="home-runtime"
    ref="sectionRef"
    class="home-band runtime-band"
    aria-labelledby="runtime-title"
  >
    <h2 id="runtime-title" class="sr-only">
      {{ t('showcase.runtime.title') }}
    </h2>

    <div class="runtime-ledger-sheet">
      <!-- 左栏：运行时长翻牌 -->
      <div class="runtime-ledger-panel runtime-ledger-panel--uptime">
        <header class="runtime-ledger-heading">
          <span class="runtime-status-dot" aria-hidden="true" />
          <Activity :size="18" aria-hidden="true" />
          <strong>{{ t('showcase.runtime.running') }}</strong>
          <span aria-hidden="true">·</span>
          <em>{{ t('showcase.runtime.uptimeTag') }}</em>
        </header>

        <div class="runtime-clock" :aria-label="t('showcase.runtime.running')">
          <div
            v-for="group in clockGroups"
            :key="group.key"
            class="runtime-clock-group"
          >
            <div class="runtime-clock-digits">
              <!-- split-flap：每格分为上/下半，digit 变化时触发翻牌动效 -->
              <span
                v-for="(digit, idx) in group.value"
                :key="`${group.key}-${idx}`"
                class="runtime-flap"
                :class="{
                  'is-flipping': flippingDigits.has(`${group.key}-${idx}`),
                }"
                :data-value="digit"
                :data-prev="previousDigit(`${group.key}-${idx}`, digit)"
              >
                <span class="flap-half flap-half--top" aria-hidden="true">
                  <span class="flap-digit">{{ digit }}</span>
                </span>
                <span class="flap-half flap-half--bottom" aria-hidden="true">
                  <span class="flap-digit">{{ digit }}</span>
                </span>
                <span
                  v-if="flippingDigits.has(`${group.key}-${idx}`)"
                  class="flap-leaf flap-leaf--previous-top"
                  aria-hidden="true"
                >
                  <span class="flap-digit">{{
                    previousDigit(`${group.key}-${idx}`, digit)
                  }}</span>
                </span>
                <span
                  v-if="flippingDigits.has(`${group.key}-${idx}`)"
                  class="flap-leaf flap-leaf--previous-bottom"
                  aria-hidden="true"
                >
                  <span class="flap-digit">{{
                    previousDigit(`${group.key}-${idx}`, digit)
                  }}</span>
                </span>
                <span
                  v-if="flippingDigits.has(`${group.key}-${idx}`)"
                  class="flap-leaf flap-leaf--next-bottom"
                  aria-hidden="true"
                >
                  <span class="flap-digit">{{ digit }}</span>
                </span>
                <!-- 屏幕阅读器文本 -->
                <span class="sr-only">{{ digit }}</span>
              </span>
            </div>
            <small>{{ group.label }}</small>
          </div>
        </div>

        <!-- 可用率柱状图 -->
        <div class="runtime-availability">
          <span class="runtime-availability-bars" aria-hidden="true">
            <i
              v-for="(h, idx) in barHeights"
              :key="idx"
              class="runtime-availability-bar"
              :class="{ 'is-visible': barsVisible }"
              :style="{
                height: `${h}px`,
                animationDelay: barsVisible ? `${idx * 55}ms` : '0ms',
              }"
            />
          </span>
          <strong>{{ uptimeLabel }}</strong>
          <span>/ {{ t('showcase.runtime.recentAvailability') }}</span>
        </div>
      </div>

      <!-- 右栏：请求总数 + sparkline -->
      <div class="runtime-ledger-panel runtime-ledger-panel--requests">
        <header class="runtime-ledger-heading">
          <Zap :size="19" aria-hidden="true" />
          <strong>{{ t('showcase.runtime.stableCalls') }}</strong>
          <span aria-hidden="true">·</span>
          <em>{{ t('showcase.runtime.servedTag') }}</em>
        </header>

        <strong class="runtime-request-total">
          {{ displayRequests.toLocaleString('en-US') }}
        </strong>
        <p class="runtime-request-caption">
          {{ t('showcase.runtime.todaySuccess') }} ·
          {{ t('showcase.runtime.protectedBy') }}
        </p>

        <div class="runtime-trend">
          <svg
            viewBox="0 0 240 54"
            role="img"
            :aria-label="t('showcase.runtime.trend24h')"
          >
            <polyline
              points="2,44 15,39 29,41 43,29 57,31 72,22 87,24 102,12 118,17 133,9 148,18 163,15 178,26 193,28 208,39 223,41 238,35"
            />
          </svg>
          <span>{{ t('showcase.runtime.trend24h') }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
