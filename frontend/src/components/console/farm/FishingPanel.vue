<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import type { FishingState } from '@/types/farm'
import { formatQuota } from '@/utils/format'

defineProps<{
  fishing: FishingState
  acting: boolean
  readonly?: boolean
}>()

const emit = defineEmits<{ fish: [] }>()
const { t } = useI18n()

type RarityTone = 'accent' | 'success' | 'neutral'

const rarityTone = (r: string): RarityTone =>
  r === 'legendary' ? 'accent' : r === 'rare' ? 'success' : 'neutral'
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      🎣 {{ t('farm.fishing.title') }}
    </h3>

    <!-- last catch -->
    <div
      v-if="fishing.last_catch"
      class="mb-4 flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
    >
      <span class="text-2xl">{{ fishing.last_catch.emoji }}</span>
      <div class="flex-1">
        <p class="text-sm font-semibold text-[var(--text-primary)]">
          {{ fishing.last_catch.name }}
        </p>
        <p class="text-xs text-[var(--text-tertiary)]">
          +{{ formatQuota(fishing.last_catch.quota, 4) }}
        </p>
      </div>
      <StatusChip :tone="rarityTone(fishing.last_catch.rarity)">
        {{ t(`farm.fishing.rarity.${fishing.last_catch.rarity}`) }}
      </StatusChip>
    </div>

    <!-- action + count -->
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm text-[var(--text-secondary)]">
        {{
          fishing.daily_left > 0
            ? t('farm.fishing.dailyLeft', { n: fishing.daily_left })
            : t('farm.fishing.noLeft')
        }}
      </p>
      <ConsoleButton
        size="sm"
        :loading="acting"
        :disabled="readonly || fishing.daily_left === 0"
        @click="emit('fish')"
      >
        🎣 {{ t('farm.fishing.cast') }}
      </ConsoleButton>
    </div>
  </article>
</template>
