<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AmountInput from '@/components/common/AmountInput.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FormField from '@/components/common/FormField.vue'
import SegmentedToggle from '@/components/common/SegmentedToggle.vue'
import TextInput from '@/components/common/TextInput.vue'
import AccentPicker from '@/components/console/plans/AccentPicker.vue'
import ChannelSelect from '@/components/console/plans/ChannelSelect.vue'
import DurationInput from '@/components/console/plans/DurationInput.vue'
import PlanCard from '@/components/console/plans/PlanCard.vue'
import {
  ADMIN_PLAN_LIMITS,
  PLAN_KINDS,
  SUBSCRIPTION_METERS,
  durationToSeconds,
  planKindLabelKey,
  subscriptionMeterLabelKey,
} from '@/constants/adminPlans'
import type {
  AdminPlan,
  AdminPlanCreateInput,
  Duration,
  Plan,
  PlanAccent,
  PlanKind,
  SubscriptionMeter,
} from '@/types/console'
import { formatMoney, QUOTA_PER_DOLLAR } from '@/utils/format'

const props = defineProps<{
  open: boolean
  /** null = create; otherwise the row being edited. */
  plan: AdminPlan | null
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [input: AdminPlanCreateInput]
}>()

const { t } = useI18n()

/**
 * Deliberately flat, unlike the domain union: the admin can toggle kind back and
 * forth while filling the form, and a discriminated draft would discard the
 * other kind's half-entered values on every switch. Collapsed to the union only
 * on submit.
 */
const kind = ref<PlanKind>('traffic')
const name = ref('')
const price = ref<number | null>(null)
/** Held in dollars — quota units are a wire detail. */
const quotaDollars = ref<number | null>(null)
const validity = ref<Duration | null>({ value: 30, unit: 'day' })
const neverExpires = ref(false)
const period = ref<Duration | null>({ value: 1, unit: 'day' })
const meter = ref<SubscriptionMeter>('refill')
const periodQuotaDollars = ref<number | null>(null)
const term = ref<Duration | null>({ value: 1, unit: 'month' })
const rateLimit = ref<number | null>(null)
const accent = ref<PlanAccent>({ token: 'accent' })
const exclusiveChannelId = ref<number | null>(null)
const ratio = ref<number | null>(null)
const sortOrder = ref<number | null>(0)
const recommended = ref(false)
const featuresText = ref('')
const error = ref('')

const isEdit = computed(() => props.plan !== null)

const kindOptions = computed(() =>
  PLAN_KINDS.map((value) => ({ value, label: t(planKindLabelKey(value)) }))
)
const meterOptions = computed(() =>
  SUBSCRIPTION_METERS.map((value) => ({
    value,
    label: t(subscriptionMeterLabelKey(value)),
  }))
)

const kindModel = computed<string>({
  get: () => kind.value,
  set: (value) => {
    kind.value = value as PlanKind
  },
})
const meterModel = computed<string>({
  get: () => meter.value,
  set: (value) => {
    meter.value = value as SubscriptionMeter
  },
})

const features = computed(() =>
  featuresText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, ADMIN_PLAN_LIMITS.featuresMax)
)

const quotaUnits = computed(() =>
  quotaDollars.value === null
    ? 0
    : Math.round(quotaDollars.value * QUOTA_PER_DOLLAR)
)
const periodQuotaUnits = computed(() =>
  periodQuotaDollars.value === null
    ? 0
    : Math.round(periodQuotaDollars.value * QUOTA_PER_DOLLAR)
)

/** Live storefront render of whatever is currently in the form. */
const previewPlan = computed<Plan>(() => {
  const shared = {
    id: props.plan?.id ?? 0,
    name: name.value.trim() || t('planManagement.formNamePlaceholder'),
    price: price.value ?? 0,
    features: features.value,
    accent: accent.value,
    exclusive_channel_id: exclusiveChannelId.value,
    ...(recommended.value ? { recommended: true } : {}),
    ...(ratio.value !== null ? { ratio: ratio.value } : {}),
  }
  if (kind.value === 'traffic') {
    return {
      ...shared,
      kind: 'traffic',
      quota: quotaUnits.value,
      validity: neverExpires.value ? null : validity.value,
    }
  }
  return {
    ...shared,
    kind: 'subscription',
    period: period.value ?? { value: 1, unit: 'day' },
    meter: meter.value,
    period_quota: periodQuotaUnits.value,
    term: term.value ?? { value: 1, unit: 'month' },
    ...(rateLimit.value !== null ? { rate_limit: rateLimit.value } : {}),
  }
})

watch(
  () => [props.open, props.plan] as const,
  ([open]) => {
    if (!open) return
    error.value = ''
    const source = props.plan
    if (!source) {
      kind.value = 'traffic'
      name.value = ''
      price.value = null
      quotaDollars.value = null
      validity.value = { value: 30, unit: 'day' }
      neverExpires.value = false
      period.value = { value: 1, unit: 'day' }
      meter.value = 'refill'
      periodQuotaDollars.value = null
      term.value = { value: 1, unit: 'month' }
      rateLimit.value = null
      accent.value = { token: 'accent' }
      exclusiveChannelId.value = null
      ratio.value = null
      sortOrder.value = 0
      recommended.value = false
      featuresText.value = ''
      return
    }

    kind.value = source.kind
    name.value = source.name
    price.value = source.price
    accent.value = { ...source.accent }
    exclusiveChannelId.value = source.exclusive_channel_id
    ratio.value = source.ratio ?? null
    sortOrder.value = source.sort_order
    recommended.value = Boolean(source.recommended)
    featuresText.value = source.features.join('\n')

    if (source.kind === 'traffic') {
      quotaDollars.value = source.quota / QUOTA_PER_DOLLAR
      neverExpires.value = source.validity === null
      validity.value = source.validity ?? { value: 30, unit: 'day' }
      // Reset the other kind's fields to defaults rather than leaving stale ones.
      periodQuotaDollars.value = null
      period.value = { value: 1, unit: 'day' }
      term.value = { value: 1, unit: 'month' }
      meter.value = 'refill'
      rateLimit.value = null
      return
    }

    periodQuotaDollars.value = source.period_quota / QUOTA_PER_DOLLAR
    period.value = { ...source.period }
    term.value = { ...source.term }
    meter.value = source.meter
    rateLimit.value = source.rate_limit ?? null
    quotaDollars.value = null
    validity.value = { value: 30, unit: 'day' }
    neverExpires.value = false
  },
  { immediate: true }
)

function validate(): string {
  const trimmed = name.value.trim()
  if (!trimmed || trimmed.length > ADMIN_PLAN_LIMITS.nameMaxLength) {
    return t('planManagement.errName')
  }
  if (
    price.value === null ||
    price.value < 0 ||
    price.value > ADMIN_PLAN_LIMITS.priceMax
  ) {
    return t('planManagement.errPrice')
  }
  if (
    sortOrder.value === null ||
    !Number.isInteger(sortOrder.value) ||
    sortOrder.value < 0 ||
    sortOrder.value > ADMIN_PLAN_LIMITS.sortOrderMax
  ) {
    return t('planManagement.errSortOrder')
  }
  if (
    ratio.value !== null &&
    (ratio.value < ADMIN_PLAN_LIMITS.ratioMin ||
      ratio.value > ADMIN_PLAN_LIMITS.ratioMax)
  ) {
    return t('planManagement.errRatio')
  }
  if (accent.value.token === 'custom' && !accent.value.hex) {
    return t('planManagement.errAccent')
  }

  if (kind.value === 'traffic') {
    if (quotaUnits.value <= 0) return t('planManagement.errQuota')
    if (!neverExpires.value && validity.value === null) {
      return t('planManagement.errValidity')
    }
    return ''
  }

  if (periodQuotaUnits.value <= 0) return t('planManagement.errPeriodQuota')
  if (period.value === null) return t('planManagement.errPeriod')
  if (term.value === null) return t('planManagement.errTerm')
  if (durationToSeconds(term.value) < durationToSeconds(period.value)) {
    return t('planManagement.errTermShorterThanPeriod')
  }
  return ''
}

function onSubmit(): void {
  const message = validate()
  error.value = message
  if (message) return

  const shared = {
    name: name.value.trim(),
    price: price.value ?? 0,
    features: features.value,
    accent: accent.value,
    recommended: recommended.value,
    exclusive_channel_id: exclusiveChannelId.value,
    sort_order: sortOrder.value ?? 0,
    ...(ratio.value !== null ? { ratio: ratio.value } : {}),
    // Create defaults to on-sale; the server ignores this on edit, where shelf
    // state belongs to the dedicated status route.
    status: props.plan?.status ?? ('active' as const),
  }

  if (kind.value === 'traffic') {
    emit('submit', {
      ...shared,
      kind: 'traffic',
      quota: quotaUnits.value,
      validity: neverExpires.value ? null : validity.value,
    })
    return
  }

  emit('submit', {
    ...shared,
    kind: 'subscription',
    period: period.value ?? { value: 1, unit: 'day' },
    meter: meter.value,
    period_quota: periodQuotaUnits.value,
    term: term.value ?? { value: 1, unit: 'month' },
    ...(rateLimit.value !== null ? { rate_limit: rateLimit.value } : {}),
  })
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="
      isEdit ? t('planManagement.editPlan') : t('planManagement.createPlan')
    "
    size="lg"
    @close="emit('close')"
  >
    <form
      class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]"
      @submit.prevent="onSubmit"
    >
      <div class="min-w-0 space-y-4">
        <!-- kind: immutable once holders exist, so locked on edit -->
        <FormField
          :label="t('planManagement.formKind')"
          :hint="isEdit ? t('planManagement.formKindLocked') : ''"
        >
          <SegmentedToggle
            v-if="!isEdit"
            v-model="kindModel"
            :options="kindOptions"
            :label="t('planManagement.formKind')"
          />
          <p v-else class="py-2 text-sm font-medium text-[var(--text-primary)]">
            {{ t(planKindLabelKey(kind)) }}
          </p>
        </FormField>

        <FormField :label="t('planManagement.formName')">
          <TextInput
            v-model="name"
            :placeholder="t('planManagement.formNamePlaceholder')"
            :maxlength="ADMIN_PLAN_LIMITS.nameMaxLength"
            name="plan-name"
          />
        </FormField>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField :label="t('planManagement.formPrice')">
            <AmountInput
              v-model="price"
              :min="0"
              :max="ADMIN_PLAN_LIMITS.priceMax"
              placeholder="20"
              name="plan-price"
            />
          </FormField>

          <!-- traffic: one-off quota -->
          <FormField
            v-if="kind === 'traffic'"
            :label="t('planManagement.formQuota')"
            :hint="
              t('planManagement.formQuotaHint', {
                value: formatMoney(quotaDollars ?? 0, 2),
              })
            "
          >
            <AmountInput
              v-model="quotaDollars"
              :min="0"
              placeholder="120"
              name="plan-quota"
            />
          </FormField>

          <!-- subscription: per-period allowance -->
          <FormField
            v-else
            :label="t('planManagement.formPeriodQuota')"
            :hint="
              t('planManagement.formQuotaHint', {
                value: formatMoney(periodQuotaDollars ?? 0, 2),
              })
            "
          >
            <AmountInput
              v-model="periodQuotaDollars"
              :min="0"
              placeholder="4"
              name="plan-period-quota"
            />
          </FormField>
        </div>

        <!-- traffic validity -->
        <template v-if="kind === 'traffic'">
          <FormField
            :label="t('planManagement.formValidity')"
            :hint="t('planManagement.formValidityHint')"
          >
            <DurationInput
              v-model="validity"
              :label="t('planManagement.formValidity')"
              :disabled="neverExpires"
            />
          </FormField>
          <div
            class="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-2.5"
          >
            <div class="min-w-0">
              <p class="text-xs font-medium text-[var(--text-secondary)]">
                {{ t('planManagement.formNeverExpires') }}
              </p>
              <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                {{ t('planManagement.formNeverExpiresHint') }}
              </p>
            </div>
            <ConsoleToggle
              v-model="neverExpires"
              :label="t('planManagement.formNeverExpires')"
            />
          </div>
        </template>

        <!-- subscription period / meter / term -->
        <template v-else>
          <FormField
            :label="t('planManagement.formMeter')"
            :hint="
              meter === 'refill'
                ? t('planManagement.formMeterRefillHint')
                : t('planManagement.formMeterCapHint')
            "
          >
            <SegmentedToggle
              v-model="meterModel"
              :options="meterOptions"
              :label="t('planManagement.formMeter')"
            />
          </FormField>
          <div class="grid gap-4 sm:grid-cols-2">
            <FormField
              :label="t('planManagement.formPeriod')"
              :hint="t('planManagement.formPeriodHint')"
            >
              <DurationInput
                v-model="period"
                :label="t('planManagement.formPeriod')"
              />
            </FormField>
            <FormField
              :label="t('planManagement.formTerm')"
              :hint="t('planManagement.formTermHint')"
            >
              <DurationInput
                v-model="term"
                :label="t('planManagement.formTerm')"
              />
            </FormField>
          </div>
          <FormField
            :label="t('planManagement.formRateLimit')"
            :hint="t('planManagement.formRateLimitHint')"
          >
            <AmountInput
              v-model="rateLimit"
              :min="0"
              :max="ADMIN_PLAN_LIMITS.rateLimitMax"
              prefix=""
              integer
              placeholder="300"
              name="plan-rate-limit"
            />
          </FormField>
        </template>

        <div class="grid gap-4 sm:grid-cols-2">
          <FormField
            :label="t('planManagement.formSortOrder')"
            :hint="t('planManagement.formSortOrderHint')"
          >
            <AmountInput
              v-model="sortOrder"
              :min="0"
              :max="ADMIN_PLAN_LIMITS.sortOrderMax"
              prefix=""
              integer
              placeholder="0"
              name="plan-sort-order"
            />
          </FormField>
          <FormField
            :label="t('planManagement.formRatio')"
            :hint="t('planManagement.formRatioHint')"
          >
            <AmountInput
              v-model="ratio"
              :min="ADMIN_PLAN_LIMITS.ratioMin"
              :max="ADMIN_PLAN_LIMITS.ratioMax"
              prefix=""
              placeholder="1.00"
              name="plan-ratio"
            />
          </FormField>
        </div>

        <FormField
          :label="t('planManagement.formChannel')"
          :hint="t('planManagement.formChannelHint')"
        >
          <ChannelSelect v-model="exclusiveChannelId" />
        </FormField>

        <AccentPicker v-model="accent" />

        <FormField
          :label="t('planManagement.formFeatures')"
          :hint="t('planManagement.formFeaturesHint')"
        >
          <textarea
            v-model="featuresText"
            rows="5"
            :placeholder="t('planManagement.formFeaturesPlaceholder')"
            class="pencil-control subtle-scroll w-full resize-y border bg-[var(--surface-solid)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:border-[var(--accent)] focus:outline-none"
            style="border-color: var(--border-default)"
            name="plan-features"
          />
        </FormField>

        <div
          class="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-muted)] px-3.5 py-2.5"
        >
          <div class="min-w-0">
            <p class="text-xs font-medium text-[var(--text-secondary)]">
              {{ t('planManagement.formRecommended') }}
            </p>
            <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
              {{ t('planManagement.formRecommendedHint') }}
            </p>
          </div>
          <ConsoleToggle
            v-model="recommended"
            :label="t('planManagement.formRecommended')"
          />
        </div>

        <p
          v-if="error"
          class="text-xs text-[var(--status-danger-text)]"
          role="alert"
        >
          {{ error }}
        </p>
      </div>

      <div class="min-w-0">
        <p class="section-heading mb-3">
          {{ t('planManagement.formPreview') }}
        </p>
        <PlanCard :plan="previewPlan" preview />
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <ConsoleButton
          variant="ghost"
          :disabled="loading"
          @click="emit('close')"
        >
          {{ t('planManagement.cancel') }}
        </ConsoleButton>
        <ConsoleButton :loading="loading" @click="onSubmit">
          {{ t('planManagement.save') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
