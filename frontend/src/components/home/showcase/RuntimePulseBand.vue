<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Activity, Zap } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import type { HomeRequestMetrics } from '@/api/public'
import type { HomeRuntime } from '@/types/homeShowcase'

const props = defineProps<{
  runtime: HomeRuntime
  uptimeLabel: string
  requestMetrics: HomeRequestMetrics | null
}>()

const { locale, t } = useI18n()

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

function previousDigit(id: string, fallback: string) {
  return previousDigits.value[id] ?? fallback
}

const barHeights = [14, 20, 16, 26, 12, 22, 18]
const barsVisible = ref(false)
const displayRequests = ref(0)
let countRafId: number | null = null

const requestValue = computed(() => {
  const metrics = props.requestMetrics
  return metrics?.available && metrics.requests_24h !== null
    ? metrics.requests_24h
    : null
})

const formattedRequestTarget = computed(() =>
  requestValue.value === null
    ? '--'
    : requestValue.value.toLocaleString(locale.value)
)
const formattedDisplayRequests = computed(() =>
  displayRequests.value.toLocaleString(locale.value)
)
const requestTotalClasses = computed(() => {
  const length = formattedRequestTarget.value.length
  return {
    'runtime-request-total--long': requestValue.value !== null && length >= 9,
    'runtime-request-total--extra-long':
      requestValue.value !== null && length >= 14,
  }
})

const trendPoints = computed(() => {
  const values = props.requestMetrics?.hourly_requests ?? []
  if (
    values.length !== 24 ||
    requestValue.value === null ||
    requestValue.value === 0 ||
    !values.some((value) => value > 0)
  ) {
    return ''
  }
  const max = Math.max(...values, 1)
  return values
    .map((value, index) => {
      const x = 2 + (236 * index) / Math.max(values.length - 1, 1)
      const y = 44 - (value / max) * 35
      return x.toFixed(1) + ',' + y.toFixed(1)
    })
    .join(' ')
})

function animateRequestTotal(target: number | null) {
  if (countRafId !== null) cancelAnimationFrame(countRafId)
  countRafId = null
  if (target === null) {
    displayRequests.value = 0
    return
  }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    displayRequests.value = target
    return
  }
  const start = displayRequests.value
  const startedAt = performance.now()
  const duration = 700
  const tick = (now: number) => {
    const progress = Math.min(1, (now - startedAt) / duration)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayRequests.value = Math.round(start + (target - start) * eased)
    if (progress < 1) countRafId = requestAnimationFrame(tick)
    else countRafId = null
  }
  countRafId = requestAnimationFrame(tick)
}

watch(requestValue, animateRequestTotal, { immediate: true })

onMounted(() => {
  clockGroups.value.forEach((group) => {
    group.value.split('').forEach((digit, idx) => {
      prevDigits.value[`${group.key}-${idx}`] = digit
    })
  })
  barsVisible.value = true
})

onBeforeUnmount(() => {
  Object.values(flipTimers).forEach(clearTimeout)
  if (countRafId !== null) cancelAnimationFrame(countRafId)
})
</script>

<template>
  <section
    id="home-runtime"
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

        <div
          class="runtime-clock"
          role="timer"
          :aria-label="t('showcase.runtime.running')"
        >
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

      <div class="runtime-ledger-panel runtime-ledger-panel--requests">
        <header class="runtime-ledger-heading">
          <Zap :size="19" aria-hidden="true" />
          <strong>{{ t('showcase.runtime.stableCalls') }}</strong>
          <span aria-hidden="true">·</span>
          <em>{{ t('showcase.runtime.servedTag') }}</em>
        </header>

        <strong
          class="runtime-request-total"
          :class="requestTotalClasses"
          data-home-request-total
        >
          {{ requestValue === null ? '--' : formattedDisplayRequests }}
        </strong>
        <p class="runtime-request-caption">
          {{
            requestValue === null
              ? t('showcase.runtime.metricsUnavailable')
              : `${t('showcase.runtime.todaySuccess')} · ${t(
                  'showcase.runtime.protectedBy'
                )}`
          }}
        </p>

        <div class="runtime-trend">
          <svg
            v-if="trendPoints"
            viewBox="0 0 240 54"
            role="img"
            :aria-label="t('showcase.runtime.trend24h')"
          >
            <polyline :points="trendPoints" />
          </svg>
          <span v-else class="runtime-trend-placeholder" aria-hidden="true"
            >--</span
          >
          <span>{{ t('showcase.runtime.trend24h') }}</span>
        </div>
      </div>
    </div>
  </section>
</template>
