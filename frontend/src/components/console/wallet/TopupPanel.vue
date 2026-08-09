<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { parseTopupInfo } from '@/api/liveContracts'
import AmountInput from '@/components/common/AmountInput.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import PaymentMethods from '@/components/console/wallet/PaymentMethods.vue'
import { useToast } from '@/composables/useToast'
import { formatMoney, formatQuota, QUOTA_PER_DOLLAR } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    balanceQuota?: number | null
    paymentMethod?: string
  }>(),
  { balanceQuota: null, paymentMethod: 'epay' }
)

const emit = defineEmits<{
  done: []
  'update:paymentMethod': [method: string]
}>()

const { t } = useI18n()
const toast = useToast()

const presets = ref([10, 20, 50, 100, 200, 500])
const amount = ref<number | null>(10)
const submittingTopup = ref(false)
const paymentMethods = ref<
  Array<{ value: string; label: string; minTopup: number }>
>([])
const minimumTopup = ref(1)
const paymentLoadState = ref<'idle' | 'ready' | 'failed'>('idle')
const method = computed({
  get: () => props.paymentMethod,
  set: (value: string) => emit('update:paymentMethod', value),
})

const selectableMethods = computed(() => paymentMethods.value)
const selectedMinimumTopup = computed(
  () =>
    paymentMethods.value.find((item) => item.value === method.value)
      ?.minTopup ?? minimumTopup.value
)
const canSubmit = computed(
  () =>
    amount.value !== null &&
    amount.value >= selectedMinimumTopup.value &&
    paymentLoadState.value === 'ready' &&
    paymentMethods.value.length > 0
)

const balanceAfter = computed(() =>
  props.balanceQuota !== null &&
  props.balanceQuota !== undefined &&
  amount.value
    ? formatQuota(props.balanceQuota + amount.value * QUOTA_PER_DOLLAR)
    : '—'
)

async function topup(): Promise<void> {
  if (!amount.value) return
  submittingTopup.value = true
  try {
    const value = amount.value
    const epayMethod = method.value.startsWith('epay:')
      ? method.value.slice('epay:'.length)
      : 'alipay'
    const response = await api.post<{
      url: string
      data: Record<string, unknown>
    }>('/api/next/wallet/topup', {
      amount: value,
      payment_method: epayMethod,
    })
    if (!response.url || !response.data) {
      throw new ApiError(t('wallet.paymentMethodsUnavailable'))
    }
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = response.url
    form.style.display = 'none'
    for (const [key, raw] of Object.entries(response.data)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = key
      input.value = String(raw)
      form.append(input)
    }
    document.body.append(form)
    form.submit()
    form.remove()
    toast.success(t('wallet.callbackNote'))
    emit('done')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    submittingTopup.value = false
  }
}

onMounted(async () => {
  try {
    const info = parseTopupInfo(
      await api.get<unknown>('/api/next/wallet/config')
    )
    paymentMethods.value = info.pay_methods.map((item) => ({
      value: `epay:${item.type}`,
      label: item.name,
      minTopup: item.min_topup ?? info.min_topup,
    }))
    minimumTopup.value = info.min_topup
    paymentLoadState.value = 'ready'
    const validPresets = info.amount_options.filter(
      (value) => value >= info.min_topup
    )
    presets.value = validPresets.length ? validPresets : [info.min_topup]
    let selectedMethod = paymentMethods.value.find(
      (item) => item.value === method.value
    )
    if (!selectedMethod && paymentMethods.value.length > 0) {
      selectedMethod = paymentMethods.value[0]!
      method.value = selectedMethod.value
    }
    const initialMinimum = selectedMethod?.minTopup ?? info.min_topup
    if (amount.value === null || amount.value < initialMinimum) {
      amount.value =
        presets.value.find((value) => value >= initialMinimum) ?? initialMinimum
    }
  } catch {
    paymentLoadState.value = 'failed'
  }
})
</script>

<template>
  <ConsoleCard :title="t('wallet.quickTopup')">
    <div class="grid grid-cols-3 gap-2">
      <button
        v-for="preset in presets"
        :key="preset"
        type="button"
        class="h-14 rounded-xl text-sm font-bold transition-all focus-ring"
        :style="
          amount === preset
            ? 'background:var(--accent);color:var(--accent-contrast)'
            : 'background:var(--surface-muted);color:var(--text-secondary)'
        "
        :class="{ 'hover:bg-[var(--surface-hover)]': amount !== preset }"
        :aria-pressed="amount === preset"
        @click="amount = preset"
      >
        ${{ preset }}
      </button>
    </div>

    <div class="mt-4">
      <AmountInput
        v-model="amount"
        :placeholder="t('wallet.amountPlaceholder')"
        :min="selectedMinimumTopup"
      />
    </div>

    <div class="mt-4">
      <PaymentMethods v-model="method" :methods="selectableMethods" />
      <p
        v-if="paymentLoadState === 'failed'"
        class="mt-2 text-xs text-[var(--danger-text)]"
      >
        {{ t('wallet.paymentMethodsLoadFailed') }}
      </p>
      <p
        v-else-if="paymentLoadState === 'ready' && !paymentMethods.length"
        class="mt-2 text-xs text-[var(--text-tertiary)]"
      >
        {{ t('wallet.paymentMethodsUnavailable') }}
      </p>
    </div>

    <div class="mt-5 space-y-2 border-t border-[var(--border-subtle)] pt-4">
      <div class="flex items-center justify-between text-sm">
        <span class="text-[var(--text-secondary)]">{{
          t('wallet.summaryPayNow')
        }}</span>
        <span class="font-semibold tabular-nums text-[var(--text-primary)]">
          {{ amount ? formatMoney(amount) : '—' }}
        </span>
      </div>
      <div class="flex items-center justify-between text-sm">
        <span class="text-[var(--text-secondary)]">{{
          t('wallet.summaryBalanceAfter')
        }}</span>
        <span class="font-semibold tabular-nums text-[var(--accent-text)]">{{
          balanceAfter
        }}</span>
      </div>
    </div>

    <ConsoleButton
      class="mt-4"
      block
      size="lg"
      :loading="submittingTopup"
      :disabled="!canSubmit"
      @click="topup"
    >
      {{ t('wallet.topupNow') }}
    </ConsoleButton>

    <p class="mt-3 text-xs text-[var(--text-tertiary)]">
      {{ t('wallet.callbackNote') }}
    </p>
  </ConsoleCard>
</template>
