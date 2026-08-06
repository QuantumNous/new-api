<script setup lang="ts">
import { Radio } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { durationUnitLabelKey, planAccentColor } from '@/constants/adminPlans'
import type { SubscriptionEntitlement } from '@/types/console'
import { formatDate, formatNumber, formatTime } from '@/utils/format'

const props = defineProps<{
  subscription: SubscriptionEntitlement | null
  savingAutoRenew: boolean
}>()

const { t } = useI18n()

const EXPIRING_SOON_DAYS = 7

const daysLeft = computed(() => {
  if (!props.subscription) return 0
  const seconds = props.subscription.expire_time - Date.now() / 1000
  return Math.max(0, Math.ceil(seconds / 86_400))
})

const expired = computed(
  () => props.subscription !== null && daysLeft.value <= 0
)

/** Share of the current period's allowance already consumed. */
const usedPercent = computed(() => {
  const current = props.subscription
  if (!current || current.period_quota <= 0) return 0
  return Math.min(
    100,
    Math.max(0, (current.period_used / current.period_quota) * 100)
  )
})

const remaining = computed(() => {
  const current = props.subscription
  if (!current) return 0
  return Math.max(0, current.period_quota - current.period_used)
})

/** Same threshold policy as CapacityMeter: signal → warning → danger. */
const meterColor = computed(() => {
  if (usedPercent.value >= 100) return 'var(--status-danger)'
  if (usedPercent.value >= 80) return 'var(--status-warning)'
  return 'var(--signal)'
})

const accent = computed(() =>
  props.subscription
    ? planAccentColor(props.subscription.accent)
    : 'var(--accent)'
)

const periodLabel = computed(() => {
  const current = props.subscription
  if (!current) return ''
  return t(durationUnitLabelKey(current.period.unit), current.period.value, {
    named: { n: current.period.value },
  })
})
</script>

<template>
  <ConsoleCard :title="t('plans.currentSubscription')">
    <div v-if="!subscription" class="py-2">
      <p class="text-sm font-medium text-[var(--text-primary)]">
        {{ t('plans.noSubscription') }}
      </p>
      <p class="mt-1 text-xs text-[var(--text-tertiary)]">
        {{ t('plans.noSubscriptionHint') }}
      </p>
      <RouterLink
        :to="{ name: 'wallet' }"
        class="mt-3 inline-block text-xs font-semibold text-[var(--accent-text)] underline-offset-4 hover:underline focus-ring"
      >
        {{ t('plans.goWallet') }}
      </RouterLink>
    </div>

    <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span
            class="h-6 w-1 shrink-0 rounded-full"
            :style="{ background: accent }"
            aria-hidden="true"
          />
          <p
            class="display-title text-2xl font-bold text-[var(--text-primary)]"
          >
            {{ subscription.name }}
          </p>
          <StatusChip v-if="expired" tone="danger">
            {{ t('plans.expired') }}
          </StatusChip>
          <StatusChip v-else-if="daysLeft <= EXPIRING_SOON_DAYS" tone="warning">
            {{ t('plans.expiringSoon') }}
          </StatusChip>
        </div>

        <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
          {{
            t('plans.renewsAt', { date: formatDate(subscription.expire_time) })
          }}
          <span v-if="!expired" class="text-[var(--text-secondary)]">
            · {{ t('plans.daysLeft', { n: daysLeft }) }}
          </span>
        </p>
        <p class="mt-1 text-xs text-[var(--text-tertiary)]">
          {{
            subscription.meter === 'refill'
              ? t('plans.meterRefillHint', { period: periodLabel })
              : t('plans.meterCapHint', { period: periodLabel })
          }}
        </p>

        <div
          v-if="subscription.exclusive_channel"
          class="mt-3 flex items-center gap-2 text-xs text-[var(--text-secondary)]"
        >
          <Radio :size="14" :style="{ color: accent }" aria-hidden="true" />
          {{ t('plans.exclusiveChannel') }} ·
          {{ subscription.exclusive_channel.name }}
        </div>
      </div>

      <!-- current-period meter -->
      <div class="min-w-0">
        <div class="flex items-end justify-between gap-3">
          <div class="min-w-0">
            <p class="text-xs text-[var(--text-tertiary)]">
              {{
                subscription.meter === 'refill'
                  ? t('plans.periodRemaining')
                  : t('plans.periodAvailable')
              }}
            </p>
            <p
              class="display-number mt-0.5 font-mono text-3xl tabular-nums text-[var(--text-primary)]"
            >
              {{ formatNumber(remaining) }}
            </p>
          </div>
          <p class="shrink-0 text-xs tabular-nums text-[var(--text-tertiary)]">
            {{ Math.round(usedPercent) }}%
          </p>
        </div>

        <div
          class="pencil-progress mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]"
          role="progressbar"
          :aria-valuenow="Math.round(usedPercent)"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('plans.usage')"
        >
          <div
            class="h-full rounded-full transition-[width] duration-500"
            :style="{ width: `${usedPercent}%`, background: meterColor }"
          />
        </div>

        <dl
          class="mt-3 space-y-1 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]"
        >
          <div class="flex justify-between gap-2">
            <dt>{{ t('plans.periodQuota') }}</dt>
            <dd>{{ formatNumber(subscription.period_quota) }}</dd>
          </div>
          <div class="flex justify-between gap-2">
            <dt>{{ t('plans.periodResetsAt') }}</dt>
            <dd>{{ formatTime(subscription.period_end) }}</dd>
          </div>
          <div
            v-if="subscription.rate_limit !== undefined"
            class="flex justify-between gap-2"
          >
            <dt>{{ t('plans.specRateLimit') }}</dt>
            <dd>
              {{
                subscription.rate_limit === 0
                  ? t('plans.unmetered')
                  : t('plans.rateLimitValue', { n: subscription.rate_limit })
              }}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </ConsoleCard>
</template>
