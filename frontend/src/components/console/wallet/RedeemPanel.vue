<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { parseRedeemedQuota } from '@/api/liveContracts'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/auth'
import { formatQuota } from '@/utils/format'

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
let focusTimer: number | null = null

async function redeem(): Promise<void> {
  const trimmed = code.value.trim()
  if (!trimmed) return
  submittingRedeem.value = true
  try {
    const response = await api.post<unknown>('/api/user/topup', {
      key: trimmed,
    })
    const quota = parseRedeemedQuota(response)
    await auth.fetchSelf()
    toast.success(`${t('wallet.redeemNow')}: ${formatQuota(quota)}`)
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

watch(() => props.autoFocus, focusInput, { immediate: true })
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
      <div>
        <span
          class="rounded-md px-2 py-0.5 text-xs font-medium"
          style="background: var(--accent-soft); color: var(--accent-text)"
        >
          {{ t('wallet.redeemLimitOnce') }}
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
  </ConsoleCard>
</template>
