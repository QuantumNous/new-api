<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import { formatQuota } from '@/utils/format'
import type { LeaderEntry, LeaderPeriod } from '@/types/farm'

defineProps<{
  entries: LeaderEntry[]
  period: LeaderPeriod
  loading: boolean
}>()

const emit = defineEmits<{ changePeriod: [period: LeaderPeriod] }>()
const { t } = useI18n()

const periods: LeaderPeriod[] = ['day', 'week', 'all']

function rankBadge(rank: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return rank
}
</script>

<template>
  <article
    class="pencil-surface rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <h3 class="text-sm font-semibold text-[var(--text-primary)]">
        🏆 {{ t('farm.leader.rank') }}
      </h3>
      <!-- period toggle -->
      <div
        class="flex gap-1 rounded-xl border border-[var(--border-subtle)] p-0.5"
      >
        <button
          v-for="p in periods"
          :key="p"
          type="button"
          class="rounded-lg px-3 py-1 text-xs font-medium transition-all focus-ring"
          :style="
            period === p
              ? 'background:var(--accent);color:var(--accent-contrast)'
              : 'color:var(--text-secondary)'
          "
          @click="emit('changePeriod', p)"
        >
          {{ t(`farm.leader.period.${p}`) }}
        </button>
      </div>
    </div>

    <!-- loading skeleton -->
    <div v-if="loading" class="space-y-2">
      <div
        v-for="i in 5"
        :key="i"
        class="h-10 animate-pulse rounded-xl bg-[var(--surface-muted)]"
      />
    </div>

    <div v-else class="space-y-1.5">
      <div
        v-for="entry in entries"
        :key="entry.uid"
        class="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors"
        :class="
          entry.is_self
            ? 'bg-[var(--accent-soft)]'
            : 'hover:bg-[var(--surface-muted)]'
        "
      >
        <!-- rank -->
        <span
          class="w-8 text-center text-sm font-bold text-[var(--text-secondary)]"
        >
          {{ rankBadge(entry.rank) }}
        </span>

        <!-- avatar -->
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
          :style="
            entry.is_self
              ? 'background:var(--accent);color:var(--accent-contrast)'
              : 'background:var(--surface-muted);color:var(--text-secondary)'
          "
        >
          {{ entry.avatar_seed }}
        </div>

        <!-- name -->
        <span
          class="flex-1 truncate text-sm font-medium"
          :class="
            entry.is_self
              ? 'text-[var(--accent-text)]'
              : 'text-[var(--text-primary)]'
          "
        >
          {{ entry.display_name }}
          <span v-if="entry.is_self" class="ml-1 text-xs opacity-70">
            ({{ t('farm.leader.self') }})
          </span>
        </span>

        <!-- quota -->
        <span class="text-xs font-semibold text-[var(--text-secondary)]">
          {{ formatQuota(entry.consume_quota) }}
        </span>
      </div>
    </div>
  </article>
</template>
