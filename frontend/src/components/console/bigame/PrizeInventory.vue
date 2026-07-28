<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import StatusChip from '@/components/common/StatusChip.vue'
import { formatTime } from '@/utils/format'
import type { PrizeRecord } from '@/types/bigame'

defineProps<{ records: PrizeRecord[] }>()
const { t } = useI18n()

type RarityTone = 'accent' | 'warning' | 'success' | 'neutral'

const rarityTone = (r: string): RarityTone => {
  if (r === 'legendary') return 'accent'
  if (r === 'epic') return 'warning'
  if (r === 'rare') return 'success'
  return 'neutral'
}
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      📋 {{ t('bigame.inventory.title') }}
    </h3>

    <p
      v-if="records.length === 0"
      class="py-6 text-center text-sm text-[var(--text-tertiary)]"
    >
      {{ t('bigame.inventory.empty') }}
    </p>

    <div v-else class="space-y-2">
      <div
        v-for="rec in records"
        :key="rec.id"
        class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5"
      >
        <!-- source badge -->
        <span
          class="shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold"
          :style="
            rec.source === 'spin'
              ? 'background:var(--signal-soft);color:var(--signal)'
              : 'background:var(--support);color:var(--accent-contrast);opacity:0.8'
          "
        >
          {{ t(`bigame.inventory.source.${rec.source}`) }}
        </span>

        <!-- prize label -->
        <span class="flex-1 truncate text-sm text-[var(--text-primary)]">
          {{ rec.prize_label }}
        </span>

        <StatusChip :tone="rarityTone(rec.rarity)">
          {{ rec.rarity }}
        </StatusChip>

        <span class="shrink-0 text-xs text-[var(--text-tertiary)]">
          {{ formatTime(rec.created) }}
        </span>
      </div>
    </div>
  </article>
</template>
