<script setup lang="ts">
import { LoaderCircle } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import type {
  AdminRedemptionCreateInput,
  AdminRedemptionType,
} from '@/types/console'

const props = defineProps<{
  open: boolean
  loading: boolean
  plans: Array<{ id: number; name: string }>
}>()

const emit = defineEmits<{
  close: []
  submit: [input: AdminRedemptionCreateInput]
}>()

const { t } = useI18n()

type ExpiryOption = 'never' | '1d' | '3d' | '7d' | 'custom'

const type = ref<AdminRedemptionType>('quota')
const amount = ref('10')
const concurrency = ref('5')
const planId = ref<number>(0)
const expiryOption = ref<ExpiryOption>('never')
const customDate = ref('')
const count = ref('1')

const expiryOptions: ExpiryOption[] = ['never', '1d', '3d', '7d', 'custom']

function expiryLabel(opt: ExpiryOption): string {
  switch (opt) {
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

// Reset conditional fields when type changes.
watch(type, () => {
  amount.value = '10'
  concurrency.value = '5'
  planId.value = props.plans[0]?.id ?? 0
})

watch(
  () => props.open,
  (open) => {
    if (!open) return
    type.value = 'quota'
    amount.value = '10'
    concurrency.value = '5'
    planId.value = props.plans[0]?.id ?? 0
    expiryOption.value = 'never'
    customDate.value = ''
    count.value = '1'
  }
)

const canSubmit = computed(() => {
  const n = Number(count.value)
  if (!Number.isInteger(n) || n < 1 || n > 100) return false
  if (type.value === 'quota') {
    const a = Number(amount.value)
    if (!Number.isFinite(a) || a <= 0) return false
  }
  if (type.value === 'concurrency') {
    const c = Number(concurrency.value)
    if (!Number.isInteger(c) || c < 1) return false
  }
  if (type.value === 'subscription' && !planId.value) return false
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
      const ts = new Date(customDate.value).getTime()
      return Number.isFinite(ts) ? Math.floor(ts / 1000) : -1
    }
  }
}

function submit() {
  if (!canSubmit.value || props.loading) return
  const input: AdminRedemptionCreateInput = {
    type: type.value,
    count: Number(count.value),
    expired_time: computeExpiredTime(),
  }
  if (type.value === 'quota') input.amount = Number(amount.value)
  if (type.value === 'concurrency')
    input.concurrency = Number(concurrency.value)
  if (type.value === 'subscription') input.plan_id = planId.value
  emit('submit', input)
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
      <!-- 类型 -->
      <FormField :label="t('redemption.fieldType')">
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="opt in [
              'quota',
              'concurrency',
              'subscription',
              'invite',
            ] as AdminRedemptionType[]"
            :key="opt"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            :class="
              type === opt
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]'
            "
            @click="type = opt"
          >
            {{
              t(`redemption.type${opt.charAt(0).toUpperCase()}${opt.slice(1)}`)
            }}
          </button>
        </div>
      </FormField>

      <!-- 金额 (quota) -->
      <FormField v-if="type === 'quota'" :label="t('redemption.fieldAmount')">
        <TextInput
          v-model="amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="10"
        />
      </FormField>

      <!-- 并发数 (concurrency) -->
      <FormField
        v-if="type === 'concurrency'"
        :label="t('redemption.fieldConcurrency')"
      >
        <TextInput
          v-model="concurrency"
          type="number"
          min="1"
          step="1"
          placeholder="5"
        />
      </FormField>

      <!-- 套餐 (subscription) -->
      <FormField
        v-if="type === 'subscription'"
        :label="t('redemption.fieldPlan')"
      >
        <div class="flex flex-wrap gap-2">
          <button
            v-for="plan in plans"
            :key="plan.id"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            :class="
              planId === plan.id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            "
            @click="planId = plan.id"
          >
            {{ plan.name }}
          </button>
        </div>
      </FormField>

      <!-- 过期 -->
      <FormField :label="t('redemption.fieldExpiry')">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="opt in expiryOptions"
            :key="opt"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            :class="
              expiryOption === opt
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:border-[var(--border-default)]'
            "
            @click="expiryOption = opt"
          >
            {{ expiryLabel(opt) }}
          </button>
        </div>
        <!-- 自定义日期输入 -->
        <input
          v-if="expiryOption === 'custom'"
          v-model="customDate"
          type="date"
          class="mt-2 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20"
          :min="new Date().toISOString().slice(0, 10)"
        />
      </FormField>

      <!-- 数量 -->
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
