<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import type { AdminRedemptionCreateInput } from '@/types/console'

const props = defineProps<{
  open: boolean
  loading: boolean
}>()

const emit = defineEmits<{
  close: []
  submit: [input: AdminRedemptionCreateInput]
}>()

const { t } = useI18n()

type ExpiryOption = 'never' | '1d' | '3d' | '7d' | 'custom'

const amount = ref('10')
const expiryOption = ref<ExpiryOption>('never')
const customDate = ref('')
const count = ref('1')

const expiryOptions: ExpiryOption[] = ['never', '1d', '3d', '7d', 'custom']

function expiryLabel(option: ExpiryOption): string {
  switch (option) {
    case 'never':
      return t('redemption.expiryNever')
    case '1d':
      return t('redemption.expiry1d')
    case '3d':
      return t('redemption.expiry3d')
    case '7d':
      return t('redemption.expiry7d')
    case 'custom':
      return t('redemption.expiryCustom')
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) return
    amount.value = '10'
    expiryOption.value = 'never'
    customDate.value = ''
    count.value = '1'
  }
)

const canSubmit = computed(() => {
  const quantity = Number(count.value)
  const value = Number(amount.value)
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return false
  }
  if (!Number.isFinite(value) || value <= 0) return false
  if (expiryOption.value === 'custom' && !customDate.value) return false
  return true
})

function computeExpiredTime(): number {
  switch (expiryOption.value) {
    case 'never':
      return -1
    case '1d':
      return Math.floor(Date.now() / 1000) + 86_400
    case '3d':
      return Math.floor(Date.now() / 1000) + 3 * 86_400
    case '7d':
      return Math.floor(Date.now() / 1000) + 7 * 86_400
    case 'custom': {
      const timestamp = new Date(customDate.value).getTime()
      return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : -1
    }
  }
}

function submit() {
  if (!canSubmit.value || props.loading) return
  emit('submit', {
    type: 'quota',
    count: Number(count.value),
    amount: Number(amount.value),
    expired_time: computeExpiredTime(),
  })
}
</script>

<template>
  <ConsoleModal
    :open="open"
    size="sm"
    :title="t('redemption.generateTitle')"
    @close="emit('close')"
  >
    <div class="space-y-4">
      <FormField
        :label="t('redemption.fieldAmount')"
        :hint="t('redemption.amountHint')"
      >
        <TextInput
          v-model="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="10"
        />
      </FormField>

      <FormField :label="t('redemption.fieldExpiry')">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="option in expiryOptions"
            :key="option"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            :class="
              expiryOption === option
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]'
            "
            @click="expiryOption = option"
          >
            {{ expiryLabel(option) }}
          </button>
        </div>
        <input
          v-if="expiryOption === 'custom'"
          v-model="customDate"
          type="date"
          class="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
          :min="new Date().toISOString().slice(0, 10)"
        />
      </FormField>

      <FormField
        :label="t('redemption.fieldCount')"
        :hint="t('redemption.countHint')"
      >
        <TextInput
          v-model="count"
          type="number"
          min="1"
          max="100"
          step="1"
          placeholder="1"
        />
      </FormField>
    </div>

    <template #footer>
      <div class="flex gap-2">
        <ConsoleButton
          variant="secondary"
          class="flex-1"
          :disabled="loading"
          @click="emit('close')"
        >
          {{ t('redemption.cancel') }}
        </ConsoleButton>
        <ConsoleButton
          class="flex-1"
          :disabled="!canSubmit || loading"
          @click="submit"
        >
          <LoaderCircle
            v-if="loading"
            :size="15"
            class="animate-spin"
            aria-hidden="true"
          />
          {{ t('redemption.generate') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
