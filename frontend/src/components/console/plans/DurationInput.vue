<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AmountInput from '@/components/common/AmountInput.vue'
import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import {
  ADMIN_PLAN_LIMITS,
  DURATION_UNITS,
  durationUnitNameKey,
} from '@/constants/adminPlans'
import type { Duration, DurationUnit } from '@/types/console'

/**
 * Value + unit pair. `null` is a meaningful state for callers where "no
 * duration" means never expires, so the model is nullable rather than
 * defaulting to zero.
 */
const model = defineModel<Duration | null>({ required: true })

withDefaults(
  defineProps<{
    /** Accessible name for the numeric field. */
    label: string
    disabled?: boolean
  }>(),
  { disabled: false }
)

const { t } = useI18n()

const unitOptions = computed<SelectOption[]>(() =>
  DURATION_UNITS.map((unit) => ({
    value: unit,
    // Bare noun: the count lives in the adjacent numeric field.
    label: t(durationUnitNameKey(unit)),
  }))
)

const amount = computed<number | null>({
  get: () => model.value?.value ?? null,
  set: (value) => {
    if (value === null) {
      model.value = null
      return
    }
    model.value = { value, unit: model.value?.unit ?? 'day' }
  },
})

const unit = computed<string>({
  get: () => model.value?.unit ?? 'day',
  set: (next) => {
    model.value = {
      value: model.value?.value ?? 1,
      unit: next as DurationUnit,
    }
  },
})
</script>

<template>
  <div class="flex min-w-0 items-start gap-2">
    <AmountInput
      v-model="amount"
      class="min-w-0 flex-1"
      :min="1"
      :max="ADMIN_PLAN_LIMITS.durationValueMax"
      prefix=""
      integer
      placeholder="30"
      :aria-label="label"
      :disabled="disabled"
    />
    <FilterSelect
      v-model="unit"
      class="w-28 shrink-0"
      :options="unitOptions"
      :label="t('planManagement.durationUnit')"
    />
  </div>
</template>
