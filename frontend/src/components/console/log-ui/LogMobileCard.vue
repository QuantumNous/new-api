<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import StatusChip from '@/components/common/StatusChip.vue'
import type { LogItem, LogType } from '@/types/console'
import { formatQuota, formatTime } from '@/utils/format'

import LogPerformanceCell from './LogPerformanceCell.vue'
import LogUsageCell from './LogUsageCell.vue'

defineProps<{
  log: LogItem
}>()

const { t } = useI18n()

const typeTone: Record<
  LogType,
  'accent' | 'success' | 'warning' | 'info' | 'danger'
> = {
  consume: 'accent',
  topup: 'success',
  refund: 'warning',
  manage: 'info',
  error: 'danger',
  system: 'info',
}

const typeLabelKey: Record<LogType, string> = {
  consume: 'logs.typeConsume',
  topup: 'logs.typeTopup',
  refund: 'logs.typeRefund',
  manage: 'logs.typeManage',
  error: 'logs.typeError',
  system: 'logs.typeSystem',
}

function quotaPrefix(type: LogType): string {
  return ['topup', 'refund', 'manage', 'system'].includes(type) ? '+' : '-'
}
</script>

<template>
  <article
    data-log-mobile-card
    :data-log-type="log.type"
    class="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-4 shadow-[var(--card-shadow)]"
    :aria-label="t('logs.mobileCardLabel', { model: log.model })"
  >
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex min-w-0 flex-wrap items-center gap-2">
          <h3
            class="max-w-full truncate font-mono text-base font-semibold leading-5 text-[var(--text-primary)]"
            :title="log.model"
          >
            {{ log.model }}
          </h3>
          <StatusChip :tone="typeTone[log.type]">
            {{ t(typeLabelKey[log.type]) }}
          </StatusChip>
        </div>
        <p class="mt-1 truncate text-xs text-[var(--text-tertiary)]">
          {{ log.channel }} · {{ formatTime(log.created) }}
        </p>
      </div>
      <p
        class="shrink-0 text-sm font-semibold tabular-nums"
        :class="
          ['topup', 'refund', 'manage', 'system'].includes(log.type)
            ? 'text-[var(--status-success-text)]'
            : 'text-[var(--text-primary)]'
        "
      >
        {{ quotaPrefix(log.type) }}{{ formatQuota(log.quota) }}
      </p>
    </header>

    <div
      class="mt-3 min-h-[58px] rounded-lg bg-[var(--surface-muted)] px-3 py-2.5"
    >
      <LogPerformanceCell :log="log" :interactive="false" />
    </div>

    <dl class="mt-3 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 text-xs">
      <div class="min-w-0">
        <dt class="text-[var(--text-tertiary)]">{{ t('logs.colToken') }}</dt>
        <dd
          class="mt-0.5 truncate font-mono text-[var(--text-secondary)]"
          :title="log.token_name"
        >
          {{ log.token_name }}
        </dd>
      </div>
      <div
        class="col-span-2 min-w-0 border-t border-[var(--border-subtle)] pt-3"
      >
        <dt class="text-[var(--text-tertiary)]">{{ t('logs.colUsage') }}</dt>
        <dd class="mt-1">
          <LogUsageCell :log="log" mobile />
        </dd>
      </div>
      <div
        class="col-span-2 min-w-0 border-t border-[var(--border-subtle)] pt-3"
      >
        <dt class="sr-only">{{ t('logs.colContent') }}</dt>
        <dd class="truncate text-[var(--text-tertiary)]" :title="log.content">
          {{ log.content }}
        </dd>
      </div>
    </dl>
  </article>
</template>
