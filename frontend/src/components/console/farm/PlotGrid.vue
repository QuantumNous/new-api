<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { FarmPlot } from '@/types/farm'

defineProps<{
  plots: FarmPlot[]
  acting: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{ harvest: [id: number] }>()

const { t } = useI18n()

const seedEmoji: Record<string, string> = {
  玉米: '🌽',
  番茄: '🍅',
  草莓: '🍓',
  向日葵: '🌻',
  胡萝卜: '🥕',
}

function timeLeft(harvest_at: number | null): string {
  if (!harvest_at) return ''
  const diff = harvest_at - Math.floor(Date.now() / 1000)
  if (diff <= 0) return t('farm.plot.ready')
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

const stageColor = computed(() => (stage: FarmPlot['stage']) => {
  if (stage === 'ready')
    return 'background:var(--status-success-soft);color:var(--status-success-text)'
  if (stage === 'growing')
    return 'background:var(--accent-soft);color:var(--accent-text)'
  return 'background:var(--surface-muted);color:var(--text-tertiary)'
})
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      🌱 {{ t('farm.plot.title') }}
    </h3>
    <div class="grid grid-cols-3 gap-3">
      <div
        v-for="plot in plots"
        :key="plot.id"
        class="farm-plot-tile flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all"
        :class="[
          plot.stage === 'ready'
            ? 'border-[var(--status-success)] cursor-pointer hover:bg-[var(--status-success-soft)]'
            : plot.stage === 'growing'
              ? 'border-[var(--accent)] cursor-default'
              : 'border-[var(--border-subtle)] border-dashed cursor-default',
        ]"
      >
        <span class="text-2xl leading-none">
          {{ plot.seed ? (seedEmoji[plot.seed] ?? '🌱') : '➕' }}
        </span>
        <span class="text-xs font-medium text-[var(--text-secondary)]">
          {{ plot.seed ?? t('farm.plot.empty') }}
        </span>
        <span
          class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          :style="stageColor(plot.stage)"
        >
          {{ t(`farm.plot.${plot.stage}`) }}
        </span>
        <span
          v-if="plot.stage === 'growing'"
          class="text-[10px] text-[var(--text-tertiary)]"
        >
          {{ t('farm.plot.timeLeft', { t: timeLeft(plot.harvest_at) }) }}
        </span>
        <ConsoleButton
          v-if="plot.stage === 'ready'"
          size="sm"
          :loading="acting"
          :disabled="readonly"
          class="w-full !text-xs"
          @click="emit('harvest', plot.id)"
        >
          {{ t('farm.plot.harvest') }}
        </ConsoleButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
:global(html.dark) .farm-plot-tile {
  border-style: solid;
}
</style>
