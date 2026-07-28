<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError, type PageResult } from '@/api/types'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TextInput from '@/components/common/TextInput.vue'
import type { TopupRecord } from '@/types/console'
import { useLatestRequest } from '@/composables/useLatestRequest'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatMoney, formatTime } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    autoFocus?: boolean
    refreshKey?: number
  }>(),
  { autoFocus: false, refreshKey: 0 }
)

const emit = defineEmits<{ done: [] }>()
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const code = ref('')
const submittingRedeem = ref(false)
const redeemRecords = ref<TopupRecord[]>([])
const redeemTotal = ref(0)
const loadingRedeem = ref(false)
const loadError = ref<unknown | null>(null)
const listRequest = useLatestRequest()
let focusTimer: number | null = null

const redeemStatusTone = {
  success: 'success',
  pending: 'info',
  failed: 'danger',
} as const

async function loadRedeemRecords(): Promise<void> {
  loadingRedeem.value = true
  loadError.value = null
  const result = await listRequest.run((signal) =>
    api.get<PageResult<TopupRecord>>(
      '/api/user/topup/redeem/records',
      { page: 1, page_size: 5 },
      { signal }
    )
  )
  if (result.stale) return
  loadingRedeem.value = false
  if (!result.ok) {
    loadError.value = result.error
    toast.error(
      result.error instanceof ApiError
        ? result.error.message
        : String(result.error)
    )
    return
  }
  redeemRecords.value = result.value.items
  redeemTotal.value = result.value.total
}

async function redeem(): Promise<void> {
  const trimmed = code.value.trim()
  if (!trimmed) return
  submittingRedeem.value = true
  try {
    const response = await api.post<{ message: string; quota?: number }>(
      '/api/user/topup/redeem',
      { code: trimmed }
    )
    await auth.fetchSelf()
    toast.success(response.message)
    code.value = ''
    emit('done')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    submittingRedeem.value = false
  }
}

function focusInput(): void {
  if (focusTimer !== null) window.clearTimeout(focusTimer)
  focusTimer = null
  if (!props.autoFocus) return
  focusTimer = window.setTimeout(() => {
    focusTimer = null
    document.getElementById('redeem-input')?.focus()
  }, 300)
}

function retryLoad(): void {
  void loadRedeemRecords()
}

watch(
  () => props.refreshKey,
  () => void loadRedeemRecords()
)
watch(() => props.autoFocus, focusInput, { immediate: true })

onMounted(() => void loadRedeemRecords())
onBeforeUnmount(() => {
  if (focusTimer !== null) window.clearTimeout(focusTimer)
})
</script>

<template>
  <ConsoleCard>
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-[var(--text-primary)]">
        {{ t('wallet.redeemTitle') }}
      </h3>
      <div class="flex items-center gap-2">
        <span
          class="rounded-md px-2 py-0.5 text-xs font-medium"
          style="background: var(--accent-soft); color: var(--accent-text)"
        >
          {{ t('wallet.redeemLimitOnce') }}
        </span>
        <span class="text-xs text-[var(--text-tertiary)]">
          {{ t('wallet.redeemCount', { count: redeemTotal }) }}
        </span>
      </div>
    </div>

    <div class="mt-5 space-y-3">
      <TextInput
        id="redeem-input"
        v-model="code"
        :placeholder="t('wallet.redeemPlaceholder')"
      />
      <ConsoleButton
        block
        variant="secondary"
        :loading="submittingRedeem"
        :disabled="!code.trim()"
        @click="redeem"
      >
        → {{ t('wallet.redeemNow') }}
      </ConsoleButton>
    </div>

    <div class="mt-5 border-t border-[var(--border-subtle)] pt-4">
      <p
        class="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary)]"
      >
        {{ t('wallet.redeemHistoryTitle') }}
      </p>
      <ul class="divide-y divide-[var(--border-subtle)]">
        <li
          v-for="row in redeemRecords"
          :key="row.id"
          class="flex items-center justify-between gap-2 py-2.5"
        >
          <div class="min-w-0">
            <p class="truncate font-mono text-xs text-[var(--text-secondary)]">
              {{ row.trade_no }}
            </p>
            <p class="mt-0.5 text-[11px] text-[var(--text-tertiary)]">
              {{ formatTime(row.created) }}
            </p>
          </div>
          <div class="shrink-0 text-right">
            <p class="text-sm font-bold text-[var(--text-primary)]">
              +{{ formatMoney(row.amount, 0) }}
            </p>
            <StatusChip :tone="redeemStatusTone[row.status]" class="mt-0.5">
              {{ t(`common.${row.status}`) }}
            </StatusChip>
          </div>
        </li>
        <li
          v-if="loadingRedeem"
          class="py-8 text-center text-xs text-[var(--text-tertiary)]"
        >
          {{ t('common.loading') }}
        </li>
        <li
          v-else-if="loadError"
          class="flex items-center justify-center gap-3 py-6 text-xs text-[var(--status-danger-text)]"
        >
          <span>{{ t('common.failed') }}</span>
          <ConsoleButton size="sm" variant="ghost" @click="retryLoad">
            {{ t('common.retry') }}
          </ConsoleButton>
        </li>
        <li
          v-else-if="redeemRecords.length === 0"
          class="py-8 text-center text-xs text-[var(--text-tertiary)]"
        >
          {{ t('wallet.redeemHistoryEmpty') }}
        </li>
      </ul>
    </div>
  </ConsoleCard>
</template>
