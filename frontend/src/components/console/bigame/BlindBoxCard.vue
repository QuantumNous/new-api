<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import type { BlindBoxPrize } from '@/types/bigame'

const props = defineProps<{
  opening: boolean
  balance: number
  lastPrize?: BlindBoxPrize | null
}>()

const emit = defineEmits<{ openBox: [] }>()
const { t } = useI18n()

const isShaking = ref(false)
let shakeTimer: number | undefined

type StatusChipTone =
  'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent'

const rarityTone = (r: string): StatusChipTone => {
  if (r === 'legendary') return 'accent'
  if (r === 'epic') return 'warning'
  if (r === 'rare') return 'success'
  return 'neutral'
}

const rarityGlow: Record<string, string> = {
  legendary: '0 0 24px var(--accent)',
  epic: '0 0 18px var(--status-warning)',
  rare: '0 0 12px var(--status-success)',
  common: 'none',
}

async function onOpen() {
  if (props.opening || props.balance < 10) return
  isShaking.value = true
  if (shakeTimer) window.clearTimeout(shakeTimer)
  shakeTimer = window.setTimeout(() => {
    shakeTimer = undefined
    isShaking.value = false
  }, 600)
  emit('openBox')
}

onBeforeUnmount(() => {
  if (shakeTimer) window.clearTimeout(shakeTimer)
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
          🎁 {{ t('bigame.blindBox.title') }}
        </h3>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('bigame.blindBox.subtitle') }}
        </p>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-semibold"
        style="background: var(--accent-soft); color: var(--accent-text)"
      >
        {{ balance }} 🎰
      </span>
    </div>

    <div class="flex flex-col items-center gap-5">
      <!-- box animation -->
      <div
        class="flex size-32 flex-col items-center justify-center rounded-3xl border-2 border-[var(--border-strong)] text-6xl transition-all duration-300"
        :class="isShaking ? 'animate-[shake_0.5s_ease-in-out]' : ''"
        :style="{
          background: lastPrize ? 'var(--accent-soft)' : 'var(--surface-muted)',
          boxShadow: lastPrize ? rarityGlow[lastPrize.rarity] : 'none',
        }"
      >
        {{ lastPrize ? lastPrize.emoji : '❓' }}
      </div>

      <!-- result reveal -->
      <div
        v-if="lastPrize"
        class="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-center animate-scale-in"
      >
        <div class="flex items-center justify-center gap-2">
          <StatusChip :tone="rarityTone(lastPrize.rarity)">
            {{ t(`bigame.blindBox.rarity.${lastPrize.rarity}`) }}
          </StatusChip>
          <span class="font-bold text-[var(--text-primary)]">{{
            lastPrize.label
          }}</span>
        </div>
      </div>

      <!-- rarity odds preview -->
      <div class="flex w-full justify-center gap-3 text-center text-xs">
        <div
          v-for="(pct, r) in {
            common: '70%',
            rare: '20%',
            epic: '8%',
            legendary: '2%',
          }"
          :key="r"
        >
          <StatusChip :tone="rarityTone(r)">{{ r }}</StatusChip>
          <p class="mt-1 text-[var(--text-tertiary)]">{{ pct }}</p>
        </div>
      </div>

      <ConsoleButton
        block
        :loading="opening"
        :disabled="balance < 10 || opening"
        @click="onOpen"
      >
        {{ opening ? t('bigame.blindBox.opening') : t('bigame.blindBox.open') }}
      </ConsoleButton>
    </div>
  </article>
</template>

<style scoped>
@keyframes shake {
  0%,
  100% {
    transform: translateX(0) rotate(0deg);
  }
  15% {
    transform: translateX(-8px) rotate(-4deg);
  }
  30% {
    transform: translateX(8px) rotate(4deg);
  }
  45% {
    transform: translateX(-6px) rotate(-3deg);
  }
  60% {
    transform: translateX(6px) rotate(3deg);
  }
  75% {
    transform: translateX(-3px) rotate(-1deg);
  }
  90% {
    transform: translateX(3px) rotate(1deg);
  }
}
</style>
