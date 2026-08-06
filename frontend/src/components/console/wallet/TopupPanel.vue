<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { isMockApi } from '@/api/client'
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
const creemProducts = ref<Array<{ productId: string; price: number }>>([])
const paymentMethods = ref<Array<{ value: string; label: string }>>([])
const paymentLoadState = ref<'idle' | 'ready' | 'failed'>('idle')
const method = computed({
  get: () => props.paymentMethod,
  set: (value: string) => emit('update:paymentMethod', value),
})

const selectableMethods = computed(() =>
  isMockApi ? undefined : paymentMethods.value
)
const canSubmit = computed(
  () =>
    Boolean(amount.value) &&
    (isMockApi ||
      (paymentLoadState.value === 'ready' && paymentMethods.value.length > 0))
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
    const provider = method.value.startsWith('epay:') ? 'epay' : method.value
    const epayMethod = method.value.startsWith('epay:')
      ? method.value.slice('epay:'.length)
      : 'alipay'
    if (provider === 'creem') {
      const product = creemProducts.value.find(
        (item) => Math.abs(item.price - value) < 0.01
      )
      if (!product) {
        throw new ApiError('当前金额没有可用的 Creem 商品')
      }
      const response = await api.post<{
        checkout_url?: string
        data?: { checkout_url?: string }
      }>('/api/user/creem/pay', {
        product_id: product.productId,
        payment_method: 'creem',
      })
      const checkoutUrl = response.checkout_url ?? response.data?.checkout_url
      if (checkoutUrl) window.location.assign(checkoutUrl)
    } else {
      const endpoint =
        provider === 'stripe'
          ? '/api/user/stripe/pay'
          : provider === 'waffo'
            ? '/api/user/waffo/pay'
            : provider === 'waffo_pancake'
              ? '/api/user/waffo-pancake/pay'
              : '/api/user/pay'
      const response = await api.post<{
        url?: string
        pay_link?: string
        payment_url?: string
        checkout_url?: string
        data?: Record<string, unknown>
        trade_no?: string
      }>(endpoint, {
        amount: value,
        payment_method: epayMethod,
        success_url: `${window.location.origin}/next/console/wallet`,
        cancel_url: `${window.location.origin}/next/console/wallet`,
      })
      const paymentUrl =
        response.pay_link ?? response.payment_url ?? response.checkout_url
      if (provider === 'epay' && response.url && response.data) {
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
      }
      if (paymentUrl) window.location.assign(paymentUrl)
    }
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
    const rawInfo = await api.get<unknown>('/api/user/topup/info')
    const info = parseTopupInfo(rawInfo)
    if (!isMockApi) {
      const raw = rawInfo as Record<string, unknown>
      const providerTypes = new Set([
        'stripe',
        'creem',
        'waffo',
        'waffo_pancake',
      ])
      const dynamic = info.pay_methods
        .filter((item) => !providerTypes.has(item.type))
        .map((item) => ({
          value: `epay:${item.type}`,
          label: item.name,
        }))
      if (info.enable_stripe_topup)
        dynamic.push({ value: 'stripe', label: 'Stripe' })
      if (info.enable_creem_topup)
        dynamic.push({ value: 'creem', label: 'Creem' })
      if (info.enable_waffo_topup)
        dynamic.push({ value: 'waffo', label: 'Waffo' })
      if (info.enable_waffo_pancake_topup) {
        dynamic.push({ value: 'waffo_pancake', label: 'Waffo Pancake' })
      }
      paymentMethods.value = dynamic
      paymentLoadState.value = 'ready'
      presets.value = info.amount_options.length
        ? info.amount_options
        : presets.value
      if (
        dynamic.length > 0 &&
        !dynamic.some((item) => item.value === method.value)
      ) {
        method.value = dynamic[0]!.value
      }
      const products = raw.creem_products
      if (Array.isArray(products)) {
        creemProducts.value = products.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const row = item as Record<string, unknown>
          const productId = row.productId ?? row.product_id
          const price = Number(row.price)
          return typeof productId === 'string' && Number.isFinite(price)
            ? [{ productId, price }]
            : []
        })
      }
      return
    }
    const raw = (rawInfo as { creem_products?: string | unknown[] })
      .creem_products
    const parsed = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
    if (Array.isArray(parsed)) {
      creemProducts.value = parsed.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        const productId = row.productId ?? row.product_id
        const price = row.price
        return typeof productId === 'string' && typeof price === 'number'
          ? [{ productId, price }]
          : []
      })
    }
  } catch {
    if (!isMockApi) paymentLoadState.value = 'failed'
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
        :min="1"
      />
    </div>

    <div class="mt-4">
      <PaymentMethods v-model="method" :methods="selectableMethods" />
      <p
        v-if="!isMockApi && paymentLoadState === 'failed'"
        class="mt-2 text-xs text-[var(--danger-text)]"
      >
        {{ t('wallet.paymentMethodsLoadFailed') }}
      </p>
      <p
        v-else-if="
          !isMockApi && paymentLoadState === 'ready' && !paymentMethods.length
        "
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
