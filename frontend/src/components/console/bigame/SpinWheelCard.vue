<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { SpinPrize } from '@/types/bigame'

const props = defineProps<{
  prizes: SpinPrize[]
  spinning: boolean
  balance: number
  lastPrize?: SpinPrize | null
  readonly?: boolean
}>()

const emit = defineEmits<{ spin: [] }>()
const { t } = useI18n()

// Wheel rotation state for animation
const rotation = ref(0)
const isAnimating = ref(false)
let animationTimer: number | undefined

const segmentAngle = computed(() =>
  props.prizes.length > 0 ? 360 / props.prizes.length : 0
)

// SVG arc path for one wheel slice. Kept in setup scope so the template
// can call it directly (a separate <script> block isn't render-visible).
function describeSlice(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180)
  const x1 = cx + r * Math.cos(toRad(startAngle))
  const y1 = cy + r * Math.sin(toRad(startAngle))
  const x2 = cx + r * Math.cos(toRad(endAngle))
  const y2 = cy + r * Math.sin(toRad(endAngle))
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

// Token map to CSS color values
const tokenColorMap: Record<string, string> = {
  accent: 'var(--accent)',
  signal: 'var(--signal)',
  support: 'var(--support)',
  'status-success': 'var(--status-success)',
  'status-warning': 'var(--status-warning)',
  'status-danger': 'var(--status-danger)',
  'status-info': 'var(--status-info)',
}

function segmentColor(token: string) {
  return tokenColorMap[token] ?? 'var(--surface-muted)'
}

async function onSpin() {
  if (!canSpin.value) return
  isAnimating.value = true
  const spins = 5 + Math.floor(Math.random() * 5)
  const extraDeg = Math.floor(Math.random() * 360)
  rotation.value += spins * 360 + extraDeg
  emit('spin')
  if (animationTimer) window.clearTimeout(animationTimer)
  animationTimer = window.setTimeout(() => {
    animationTimer = undefined
    isAnimating.value = false
  }, 3500)
}

const canSpin = computed(
  () =>
    props.prizes.length > 0 &&
    props.balance >= 5 &&
    !props.spinning &&
    !isAnimating.value
)

onBeforeUnmount(() => {
  if (animationTimer) window.clearTimeout(animationTimer)
})
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <!-- header -->
    <div class="mb-4 flex items-start justify-between">
      <div>
        <h3 class="text-base font-bold text-[var(--text-primary)]">
          🎡 {{ t('bigame.spinWheel.title') }}
        </h3>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('bigame.spinWheel.subtitle') }}
        </p>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        style="background: var(--accent-soft); color: var(--accent-text)"
      >
        {{ balance }} 🎰
      </span>
    </div>

    <!-- visual wheel (CSS-based, no canvas) -->
    <div class="flex flex-col items-center gap-5">
      <div class="relative flex size-48 items-center justify-center">
        <!-- pointer -->
        <div
          class="absolute -top-2 z-10 h-5 w-3"
          style="
            background: var(--accent);
            clip-path: polygon(50% 100%, 0 0, 100% 0);
            filter: drop-shadow(0 2px 4px var(--shadow-color));
          "
        />

        <!-- spinning disc -->
        <div
          class="size-44 overflow-hidden rounded-full border-4 border-[var(--border-strong)] shadow-[var(--card-shadow)]"
          :style="{
            transform: `rotate(${rotation}deg)`,
            transition: isAnimating
              ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)'
              : 'none',
          }"
        >
          <!-- SVG wheel -->
          <svg viewBox="0 0 100 100" class="size-full">
            <g v-for="(prize, i) in prizes" :key="prize.id">
              <path
                :d="
                  describeSlice(
                    50,
                    50,
                    50,
                    i * segmentAngle,
                    (i + 1) * segmentAngle
                  )
                "
                :fill="segmentColor(prize.color_token)"
                :fill-opacity="0.85"
                stroke="var(--surface-solid)"
                stroke-width="0.5"
              />
            </g>
            <!-- center circle -->
            <circle cx="50" cy="50" r="10" fill="var(--surface-solid)" />
            <circle cx="50" cy="50" r="7" fill="var(--accent)" />
          </svg>
        </div>
      </div>

      <!-- prize labels legend -->
      <div class="w-full space-y-1">
        <div
          v-for="prize in prizes"
          :key="prize.id"
          class="flex items-center gap-2 rounded-lg px-2 py-1"
          :class="
            lastPrize?.id === prize.id ? 'ring-1 ring-[var(--focus-ring)]' : ''
          "
          :style="
            lastPrize?.id === prize.id ? 'background: var(--accent-soft)' : ''
          "
        >
          <span
            class="size-2.5 rounded-full"
            :style="{ background: segmentColor(prize.color_token) }"
          />
          <span class="flex-1 text-xs text-[var(--text-secondary)]">{{
            prize.label
          }}</span>
          <span
            v-if="lastPrize?.id === prize.id"
            class="text-xs font-semibold"
            style="color: var(--accent-text)"
            >{{ t('bigame.spinWheel.wonMarker') }}</span
          >
        </div>
      </div>

      <ConsoleButton
        block
        :loading="spinning"
        :disabled="readonly || !canSpin"
        @click="onSpin"
      >
        {{
          spinning ? t('bigame.spinWheel.spinning') : t('bigame.spinWheel.spin')
        }}
      </ConsoleButton>
    </div>
  </article>
</template>
