<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    percent: number | null
    color: string
    size?: number
    tickCount?: number
  }>(),
  {
    size: 38,
    tickCount: 20,
  }
)

interface TickGeometry {
  x1: number
  y1: number
  x2: number
  y2: number
  active: boolean
}

const center = computed(() => props.size / 2)
const rOuter = computed(() => center.value - 2)
const rInner = computed(() => center.value - 6.5)

const isUnknown = computed(() => props.percent === null)
const clampedPercent = computed(() =>
  props.percent === null ? 0 : Math.min(100, Math.max(0, props.percent))
)
const activeTickCount = computed(() =>
  isUnknown.value
    ? 0
    : Math.round((clampedPercent.value / 100) * props.tickCount)
)

const ticks = computed<TickGeometry[]>(() => {
  const count = props.tickCount
  const c = center.value
  const ro = rOuter.value
  const ri = rInner.value
  const activeCount = activeTickCount.value

  const list: TickGeometry[] = []
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2
    list.push({
      x1: Number((c + ri * Math.cos(angle)).toFixed(2)),
      y1: Number((c + ri * Math.sin(angle)).toFixed(2)),
      x2: Number((c + ro * Math.cos(angle)).toFixed(2)),
      y2: Number((c + ro * Math.sin(angle)).toFixed(2)),
      active: i < activeCount,
    })
  }
  return list
})
</script>

<template>
  <span
    class="precision-tick-dial relative inline-flex shrink-0 items-center justify-center"
    data-success-rate-ring
    :data-success-rate-state="isUnknown ? 'unknown' : 'value'"
  >
    <svg
      :width="size"
      :height="size"
      :viewBox="`0 0 ${size} ${size}`"
      aria-hidden="true"
      class="overflow-visible"
    >
      <line
        v-for="(tick, index) in ticks"
        :key="index"
        :x1="tick.x1"
        :y1="tick.y1"
        :x2="tick.x2"
        :y2="tick.y2"
        stroke-linecap="round"
        class="tick-line transition-[stroke,opacity] duration-300"
        :class="{
          'tick-standby': isUnknown,
          'tick-active': !isUnknown && tick.active,
          'tick-inactive': !isUnknown && !tick.active,
        }"
        :style="{
          strokeWidth: 1.4,
          stroke: isUnknown
            ? 'var(--text-tertiary)'
            : tick.active
              ? color
              : 'color-mix(in srgb, var(--text-primary) 12%, transparent)',
          animationDelay: isUnknown ? `${index * 0.08}s` : undefined,
        }"
      />
    </svg>
  </span>
</template>

<style scoped>
.tick-standby {
  opacity: 0.45;
  animation: tick-twinkle 2.4s ease-in-out infinite alternate;
}

.tick-active {
  opacity: 1;
  filter: drop-shadow(
    0 0 2px color-mix(in srgb, currentColor 45%, transparent)
  );
}

.tick-inactive {
  opacity: 0.55;
}

@keyframes tick-twinkle {
  0% {
    opacity: 0.25;
  }
  100% {
    opacity: 0.65;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tick-standby {
    animation: none;
    opacity: 0.45;
  }
}
</style>
