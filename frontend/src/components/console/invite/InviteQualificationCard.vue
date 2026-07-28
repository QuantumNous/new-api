<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { InviteQualification, InviteUnlockChannel } from '@/types/console'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { formatCompact, formatMoney, QUOTA_PER_DOLLAR } from '@/utils/format'

const props = defineProps<{
  qualification: InviteQualification
  channels: InviteUnlockChannel[]
}>()

const { t } = useI18n()

const clamp = (n: number) => Math.max(0, Math.min(100, n))

const tokenPct = computed(() =>
  clamp(
    (props.qualification.token_used / props.qualification.token_required) * 100
  )
)
const topupPct = computed(() =>
  clamp(
    (props.qualification.topup_total / props.qualification.topup_required) * 100
  )
)

const tokenReached = computed(
  () => props.qualification.token_used >= props.qualification.token_required
)
const topupReached = computed(
  () => props.qualification.topup_total >= props.qualification.topup_required
)
</script>

<template>
  <ConsoleCard :title="t('invite.qualTitle')">
    <template #action>
      <StatusChip :tone="qualification.qualified ? 'success' : 'warning'">
        {{
          qualification.qualified
            ? t('invite.qualAchieved')
            : t('invite.qualPending')
        }}
      </StatusChip>
    </template>

    <div class="grid gap-8 lg:grid-cols-2">
      <!-- thresholds -->
      <div class="space-y-5">
        <div>
          <div class="mb-1.5 flex items-center justify-between text-sm">
            <span class="text-[var(--text-secondary)]">{{
              t('invite.qualTokenUsed')
            }}</span>
            <span
              class="font-medium"
              :style="
                tokenReached
                  ? 'color:var(--status-success-text)'
                  : 'color:var(--text-tertiary)'
              "
            >
              {{
                tokenReached
                  ? t('invite.qualReached')
                  : `${formatCompact(qualification.token_used)} / ${formatCompact(qualification.token_required)}`
              }}
            </span>
          </div>
          <div
            class="pencil-progress h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full transition-all"
              :style="{
                width: `${tokenPct}%`,
                background: 'var(--status-success)',
              }"
            />
          </div>
        </div>

        <div>
          <div class="mb-1.5 flex items-center justify-between text-sm">
            <span class="text-[var(--text-secondary)]">{{
              t('invite.qualTopup')
            }}</span>
            <span
              class="font-medium"
              :style="
                topupReached
                  ? 'color:var(--status-success-text)'
                  : 'color:var(--text-tertiary)'
              "
            >
              {{ formatMoney(qualification.topup_total / QUOTA_PER_DOLLAR) }} /
              {{ formatMoney(qualification.topup_required / QUOTA_PER_DOLLAR) }}
            </span>
          </div>
          <div
            class="pencil-progress h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-muted)]"
          >
            <div
              class="h-full rounded-full transition-all"
              :style="{
                width: `${topupPct}%`,
                background: 'var(--status-success)',
              }"
            />
          </div>
        </div>

        <p
          class="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-tertiary)]"
        >
          <svg
            class="mt-px shrink-0"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          {{ t('invite.qualEvalNote') }}
        </p>
      </div>

      <!-- unlock channels -->
      <div>
        <p class="mb-3 text-xs font-medium text-[var(--text-tertiary)]">
          {{ t('invite.unlockTitle') }}
        </p>
        <ul class="space-y-2.5">
          <li
            v-for="ch in channels"
            :key="ch.id"
            class="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
          >
            <span class="flex min-w-0 items-center gap-2.5">
              <svg
                class="shrink-0"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                :style="
                  ch.unlocked
                    ? 'color:var(--status-success-text)'
                    : 'color:var(--text-tertiary)'
                "
                aria-hidden="true"
              >
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path v-if="ch.unlocked" d="M8 11V7a4 4 0 0 1 8 0" />
                <path v-else d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              <span
                class="min-w-0 truncate text-sm font-medium text-[var(--text-primary)]"
              >
                {{ ch.name }}
                <span
                  v-if="ch.detail"
                  class="ml-1 text-xs font-normal text-[var(--text-tertiary)]"
                  >{{ ch.detail }}</span
                >
              </span>
            </span>
            <StatusChip :tone="ch.unlocked ? 'success' : 'neutral'">
              {{ ch.unlocked ? t('invite.unlocked') : t('invite.locked') }}
            </StatusChip>
          </li>
        </ul>
      </div>
    </div>
  </ConsoleCard>
</template>
