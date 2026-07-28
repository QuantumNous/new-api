<template>
  <div
    class="signal-dot-matrix"
    :class="{ 'is-compact': compact }"
    :data-phase="phase"
    aria-hidden="true"
  >
    <span
      v-for="dot in dots"
      :key="dot.id"
      class="signal-dot-matrix__dot"
      :class="`is-${dot.tone}`"
      :style="{ '--dot-delay': `${dot.delay}ms` }"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type {
  SignalCapabilityId,
  SignalConsolePhase,
} from '@/constants/home/signalConsole'

type DotTone = 'quiet' | 'warm' | 'accent' | 'response'

interface SignalDot {
  id: number
  tone: DotTone
  delay: number
}

const props = withDefaults(
  defineProps<{
    phase: SignalConsolePhase
    compact?: boolean
    activeCapability?: SignalCapabilityId
    activeRequests?: number
    targetCount?: number
  }>(),
  {
    compact: false,
    activeCapability: 'governance',
    activeRequests: 0,
    targetCount: 0,
  }
)

const ROWS = 3
const COLS = 10

const capabilityOffset: Record<SignalCapabilityId, number> = {
  access: 1,
  observe: 4,
  billing: 7,
  governance: 9,
}

const phaseOffset: Record<SignalConsolePhase, number> = {
  idle: 0,
  gather: 2,
  hub_hold: 3,
  route: 5,
  respond: 7,
  settle: 8,
}

// The column changes only at meaningful lifecycle boundaries. That keeps the
// ASCII matrix legible while the Canvas runs its longer request programme.
const activeColumn = computed(
  () =>
    (capabilityOffset[props.activeCapability] + phaseOffset[props.phase]) % COLS
)

const dots = computed<SignalDot[]>(() => {
  const pulseWidth = Math.max(
    1,
    Math.min(2, props.activeRequests || props.targetCount || 1)
  )

  return Array.from({ length: ROWS * COLS }, (_, id) => {
    const row = Math.floor(id / COLS)
    const col = id % COLS
    const forwardDistance = (col - activeColumn.value + COLS) % COLS
    const backwardDistance = (activeColumn.value - col + COLS) % COLS
    const distance = Math.min(forwardDistance, backwardDistance)
    let tone: DotTone = 'quiet'

    switch (props.phase) {
      case 'idle':
        tone = col === activeColumn.value && row === 1 ? 'warm' : 'quiet'
        break
      case 'gather':
        tone =
          distance === 0
            ? 'accent'
            : distance <= pulseWidth && row !== 1
              ? 'warm'
              : 'quiet'
        break
      case 'hub_hold':
        tone = distance === 0 ? 'accent' : distance === 1 ? 'warm' : 'quiet'
        break
      case 'route':
        tone = distance === 0 ? 'accent' : distance === 1 ? 'warm' : 'quiet'
        break
      case 'respond':
        tone =
          distance === 0 || (distance === 1 && row !== 1)
            ? 'response'
            : distance === 2
              ? 'warm'
              : 'quiet'
        break
      case 'settle':
        tone =
          distance === 0 && row === 1
            ? 'warm'
            : distance === 1
              ? 'quiet'
              : 'quiet'
        break
    }

    return {
      id,
      tone,
      // Row stagger makes one lifecycle change feel like a gentle signal,
      // without restarting the 30 stable DOM nodes.
      delay: row * 58 + Math.min(distance, 2) * 42,
    }
  })
})
</script>

<style scoped>
.signal-dot-matrix {
  display: grid;
  width: 184px;
  grid-template-columns: repeat(10, 5px);
  grid-auto-rows: 5px;
  gap: 8px 13px;
  padding: 3px 0;
}

.signal-dot-matrix.is-compact {
  width: 136px;
  grid-template-columns: repeat(10, 4px);
  grid-auto-rows: 4px;
  gap: 6px 10px;
  padding: 1px 0;
}

.signal-dot-matrix.is-compact .signal-dot-matrix__dot {
  width: 4px;
  height: 4px;
}

.signal-dot-matrix__dot {
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: rgb(var(--signal-rgb) / 0.18);
  box-shadow: none;
  opacity: 0.5;
  transform: scale(0.76);
  transition:
    background-color 620ms ease,
    box-shadow 620ms ease,
    opacity 560ms ease,
    transform 640ms cubic-bezier(0.22, 0.72, 0.25, 1);
  transition-delay: var(--dot-delay);
}

.signal-dot-matrix__dot.is-warm {
  background: rgb(var(--signal-rgb) / 0.84);
  box-shadow: 0 0 8px rgb(var(--signal-rgb) / 0.24);
  opacity: 0.92;
  transform: scale(1);
}

.signal-dot-matrix__dot.is-accent {
  background: var(--accent);
  box-shadow: 0 0 11px rgb(var(--accent-rgb) / 0.64);
  opacity: 1;
  transform: scale(1.18);
}

.signal-dot-matrix__dot.is-response {
  background: var(--text-primary);
  box-shadow: 0 0 12px rgb(var(--accent-rgb) / 0.76);
  opacity: 1;
  transform: scale(1.24);
}

[data-phase='idle'] .signal-dot-matrix__dot.is-warm {
  animation: signal-dot-idle 5.8s ease-in-out infinite;
}

@keyframes signal-dot-idle {
  0%,
  100% {
    opacity: 0.58;
    transform: scale(0.82);
  }
  50% {
    opacity: 1;
    transform: scale(1.14);
  }
}

@media (prefers-reduced-motion: reduce) {
  .signal-dot-matrix__dot,
  [data-phase='idle'] .signal-dot-matrix__dot.is-warm {
    animation: none;
    transition: none;
    transform: none;
  }
}
</style>
