<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { MilestoneItem } from '@/types/bigame'

defineProps<{
  milestones: MilestoneItem[]
  claiming?: string | null // id of milestone being claimed
}>()

const emit = defineEmits<{ claim: [id: string] }>()
const { t } = useI18n()

function progressPct(item: MilestoneItem): number {
  if (item.claimed) return 100
  return Math.min(100, Math.round((item.current / item.target) * 100))
}

function canClaim(item: MilestoneItem): boolean {
  return !item.claimed && item.current >= item.target
}
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <h3 class="mb-4 text-sm font-semibold text-[var(--text-primary)]">
      🎯 {{ t('bigame.milestone.title') }}
    </h3>

    <div class="space-y-3">
      <div
        v-for="item in milestones"
        :key="item.id"
        class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-4 py-3"
        :class="item.claimed ? 'opacity-60' : ''"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium text-[var(--text-primary)]">{{
              item.label
            }}</span>
            <span
              class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
              style="background: var(--accent-soft); color: var(--accent-text)"
            >
              {{ t('bigame.milestone.reward', { n: item.reward }) }}
            </span>
          </div>
          <!-- progress -->
          <div
            class="pencil-progress mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full transition-all duration-500"
              :style="{
                width: `${progressPct(item)}%`,
                background: item.claimed
                  ? 'var(--status-success)'
                  : 'var(--accent)',
              }"
            />
          </div>
          <p class="mt-1 text-[10px] text-[var(--text-tertiary)]">
            {{
              t('bigame.milestone.progress', {
                cur: item.current.toLocaleString(),
                target: item.target.toLocaleString(),
              })
            }}
          </p>
        </div>

        <ConsoleButton
          v-if="canClaim(item)"
          size="sm"
          :loading="claiming === item.id"
          class="shrink-0"
          @click="emit('claim', item.id)"
        >
          {{ t('bigame.milestone.claim') }}
        </ConsoleButton>
        <span
          v-else-if="item.claimed"
          class="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
          style="
            background: var(--status-success-soft);
            color: var(--status-success-text);
          "
        >
          ✓ {{ t('bigame.milestone.claimed') }}
        </span>
      </div>
    </div>
  </article>
</template>
