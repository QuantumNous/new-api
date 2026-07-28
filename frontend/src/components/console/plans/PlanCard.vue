<script setup lang="ts">
import { Check, Infinity as InfinityIcon, Radio } from 'lucide-vue-next'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import {
  durationUnitLabelKey,
  planAccentColor,
  planDiscountPercent,
  planLifetimeQuota,
  planQuotaValue,
  planUnitPrice,
  periodsInTerm,
} from '@/constants/adminPlans'
import type { Duration, Plan } from '@/types/console'
import { formatMoney, formatNumber } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    plan: Plan
    /** Marks a plan the caller already holds. */
    active?: boolean
    loading?: boolean
    disabled?: boolean
    /** Read-only render for the admin form preview — hides the CTA. */
    preview?: boolean
    /** Resolved exclusive channel name, when the caller knows it. */
    channelName?: string
  }>(),
  {
    active: false,
    loading: false,
    disabled: false,
    preview: false,
    channelName: '',
  }
)

const emit = defineEmits<{ buy: [plan: Plan] }>()

const { t } = useI18n()

const accent = computed(() => planAccentColor(props.plan.accent))
const discount = computed(() => planDiscountPercent(props.plan))
const quotaWorth = computed(() => planQuotaValue(props.plan))
const lifetimeQuota = computed(() => planLifetimeQuota(props.plan))
const unitPrice = computed(() => planUnitPrice(props.plan).toFixed(2))

function duration(value: Duration): string {
  return t(durationUnitLabelKey(value.unit), value.value, {
    named: { n: value.value },
  })
}

/** The line under the price: one-off validity, or the metering cadence. */
const cadence = computed(() => {
  const plan = props.plan
  if (plan.kind === 'traffic') {
    return plan.validity === null
      ? t('plans.oneOffForever')
      : t('plans.oneOffValid', { duration: duration(plan.validity) })
  }
  const per = duration(plan.period)
  return plan.meter === 'refill'
    ? t('plans.perPeriodRefill', { period: per })
    : t('plans.perPeriodCap', { period: per })
})

/** Rows in the spec table, which differ entirely between the two kinds. */
const specs = computed(() => {
  const plan = props.plan
  if (plan.kind === 'traffic') {
    return [
      { label: t('plans.specQuota'), value: formatNumber(plan.quota) },
      {
        label: t('plans.specValidity'),
        value:
          plan.validity === null ? t('plans.forever') : duration(plan.validity),
      },
    ]
  }
  return [
    {
      label: t('plans.specPeriodQuota'),
      value: formatNumber(plan.period_quota),
    },
    { label: t('plans.specPeriod'), value: duration(plan.period) },
    { label: t('plans.specTerm'), value: duration(plan.term) },
    {
      label: t('plans.specTotal'),
      value: formatNumber(lifetimeQuota.value),
    },
    ...(plan.rate_limit !== undefined
      ? [
          {
            label: t('plans.specRateLimit'),
            value:
              plan.rate_limit === 0
                ? t('plans.unmetered')
                : t('plans.rateLimitValue', { n: plan.rate_limit }),
          },
        ]
      : []),
  ]
})

const periodCount = computed(() =>
  props.plan.kind === 'subscription'
    ? periodsInTerm(props.plan.period, props.plan.term)
    : 0
)
</script>

<template>
  <section
    class="pencil-surface relative flex flex-col border bg-[var(--surface-solid)]"
    :class="
      plan.recommended || active
        ? 'border-[var(--border-strong)]'
        : 'border-[var(--border-subtle)]'
    "
    style="border-radius: var(--shape-card); box-shadow: var(--card-shadow)"
    :data-surface-variant="plan.recommended ? 'sketch' : 'default'"
    :data-handdrawn="plan.recommended ? 'surface-strong' : 'surface'"
  >
    <!-- accent cap: semantic token or the plan's custom colour -->
    <span
      class="absolute inset-x-0 top-0 h-[3px]"
      :style="{
        background: `linear-gradient(90deg, transparent, ${accent} 20%, ${accent} 80%, transparent)`,
        borderTopLeftRadius: 'var(--shape-card)',
        borderTopRightRadius: 'var(--shape-card)',
      }"
      aria-hidden="true"
    />

    <header class="px-5 pt-5">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h3
            class="display-title truncate text-lg font-bold text-[var(--text-primary)]"
          >
            {{ plan.name }}
          </h3>
          <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {{
              plan.kind === 'traffic'
                ? t('planManagement.kindTraffic')
                : t('planManagement.kindSubscription')
            }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1.5">
          <StatusChip v-if="active" tone="success">
            {{ t('plans.currentPlan') }}
          </StatusChip>
          <StatusChip v-else-if="plan.recommended" tone="accent">
            {{ t('plans.recommended') }}
          </StatusChip>
        </div>
      </div>

      <p
        class="mt-3 flex items-baseline gap-1 font-mono text-[var(--text-primary)]"
      >
        <span class="text-lg text-[var(--text-tertiary)]">$</span>
        <span class="display-number text-4xl">{{ plan.price }}</span>
      </p>
      <p class="mt-1 text-xs text-[var(--text-secondary)]">{{ cadence }}</p>

      <div class="mt-2 flex flex-wrap items-center gap-2">
        <span class="text-xs text-[var(--text-secondary)]">
          {{ t('plans.unitPriceValue', { value: unitPrice }) }}
        </span>
        <StatusChip v-if="discount > 0" tone="success" class="text-[10px]">
          {{ t('plans.discountBadge', { percent: discount }) }}
        </StatusChip>
      </div>
    </header>

    <div
      class="mx-5 my-4 border-t border-[var(--border-subtle)]"
      aria-hidden="true"
    />

    <div class="flex grow flex-col px-5 pb-5">
      <dl class="space-y-1.5 text-xs">
        <div
          v-for="spec in specs"
          :key="spec.label"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-[var(--text-tertiary)]">{{ spec.label }}</dt>
          <dd class="font-mono tabular-nums text-[var(--text-primary)]">
            {{ spec.value }}
          </dd>
        </div>
        <div class="flex items-center justify-between gap-2">
          <dt class="text-[var(--text-tertiary)]">
            {{ t('plans.quotaValueLabel') }}
          </dt>
          <dd class="font-mono tabular-nums text-[var(--text-secondary)]">
            {{ formatMoney(quotaWorth, 2) }}
          </dd>
        </div>
        <div
          v-if="plan.kind === 'subscription' && periodCount > 1"
          class="flex items-center justify-between gap-2"
        >
          <dt class="text-[var(--text-tertiary)]">
            {{ t('plans.specPeriodCount') }}
          </dt>
          <dd class="font-mono tabular-nums text-[var(--text-secondary)]">
            {{ periodCount }}
          </dd>
        </div>
      </dl>

      <!-- exclusive channel reads as the headline benefit when present -->
      <div
        v-if="plan.exclusive_channel_id !== null"
        class="mt-4 flex items-start gap-2 rounded-xl px-3 py-2"
        :style="{ background: 'var(--surface-muted)' }"
      >
        <Radio
          :size="15"
          class="mt-0.5 shrink-0"
          :style="{ color: accent }"
          aria-hidden="true"
        />
        <div class="min-w-0">
          <p class="text-xs font-semibold text-[var(--text-primary)]">
            {{ t('plans.exclusiveChannel') }}
          </p>
          <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
            {{ channelName || t('plans.exclusiveChannelHint') }}
          </p>
        </div>
      </div>

      <p
        v-if="plan.features.length"
        class="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-tertiary)]"
      >
        {{ t('plans.included') }}
      </p>
      <ul v-if="plan.features.length" class="mt-2 space-y-1.5">
        <li
          v-for="feature in plan.features"
          :key="feature"
          class="flex items-start gap-2 text-sm text-[var(--text-secondary)]"
        >
          <Check
            :size="15"
            class="mt-0.5 shrink-0"
            :style="{ color: accent }"
            aria-hidden="true"
          />
          <span class="min-w-0">{{ feature }}</span>
        </li>
      </ul>

      <p
        v-if="plan.kind === 'traffic' && plan.validity === null"
        class="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
      >
        <InfinityIcon :size="14" aria-hidden="true" />
        {{ t('plans.foreverHint') }}
      </p>

      <ConsoleButton
        v-if="!preview"
        class="mt-5"
        block
        :variant="!active && plan.recommended ? 'primary' : 'secondary'"
        :loading="loading"
        :disabled="disabled || loading"
        @click="emit('buy', plan)"
      >
        {{
          active
            ? t('plans.renewPlan')
            : plan.kind === 'traffic'
              ? t('plans.buyPack')
              : t('plans.buy')
        }}
      </ConsoleButton>
    </div>
  </section>
</template>
