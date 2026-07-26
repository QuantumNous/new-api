<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
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

const presets = [10, 20, 50, 100, 200, 500]
const amount = ref<number | null>(10)
const submittingTopup = ref(false)
const method = computed({
  get: () => props.paymentMethod,
  set: (value: string) => emit('update:paymentMethod', value),
})

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
    const response = await api.post<{ message: string; trade_no?: string }>(
      '/api/user/topup',
      { amount: amount.value, method: method.value }
    )
    toast.success(response.message || t('wallet.callbackNote'))
    emit('done')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    submittingTopup.value = false
  }
}
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
        :min="1"
      />
    </div>

    <div class="mt-4">
      <PaymentMethods v-model="method" />
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
      :disabled="!amount"
      @click="topup"
    >
      {{ t('wallet.topupNow') }}
    </ConsoleButton>

    <p class="mt-3 text-xs text-[var(--text-tertiary)]">
      {{ t('wallet.callbackNote') }}
    </p>
  </ConsoleCard>
</template>
