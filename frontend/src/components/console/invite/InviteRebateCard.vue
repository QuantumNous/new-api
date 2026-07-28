<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleCard from '@/components/common/ConsoleCard.vue'
import { useAuthStore } from '@/stores/auth'
import { formatQuota } from '@/utils/format'

const props = defineProps<{
  transferable: number
  pendingReward: number
  rewardTotal: number
  invited: number
}>()

const emit = defineEmits<{ transfer: [] }>()

const { t } = useI18n()
const auth = useAuthStore()

/** Wallet balance available today, before any transfer-in. */
const currentBalance = computed(() => {
  const u = auth.user
  return u?.quota ?? 0
})

const afterBalance = computed(() => currentBalance.value + props.transferable)
const canTransfer = computed(() => props.transferable > 0)
</script>

<template>
  <ConsoleCard :title="t('invite.rebateTitle')">
    <p class="text-xs leading-relaxed text-[var(--text-tertiary)]">
      {{ t('invite.rebateSubtitle', { count: invited }) }}
    </p>

    <p class="mt-4 text-3xl font-bold tracking-tight text-[var(--accent-text)]">
      {{ formatQuota(transferable) }}
    </p>

    <dl class="mt-4 space-y-2.5 text-sm">
      <div class="flex items-center justify-between">
        <dt class="text-[var(--text-tertiary)]">
          {{ t('invite.rebateCurrent') }}
        </dt>
        <dd class="font-medium text-[var(--text-primary)]">
          {{ formatQuota(currentBalance) }}
        </dd>
      </div>
      <div class="flex items-center justify-between">
        <dt class="text-[var(--text-tertiary)]">
          {{ t('invite.rebatePending') }}
        </dt>
        <dd class="font-medium" style="color: var(--signal)">
          +{{ formatQuota(pendingReward) }}
        </dd>
      </div>
      <div
        class="flex items-center justify-between border-t border-[var(--border-subtle)] pt-2.5"
      >
        <dt class="text-[var(--text-secondary)]">
          {{ t('invite.rebateAfter') }}
        </dt>
        <dd class="font-semibold text-[var(--text-primary)]">
          {{ formatQuota(afterBalance) }}
        </dd>
      </div>
    </dl>

    <ConsoleButton
      class="mt-5"
      block
      :variant="canTransfer ? 'primary' : 'secondary'"
      :disabled="!canTransfer"
      @click="emit('transfer')"
    >
      {{ canTransfer ? t('invite.transfer') : `✓ ${t('invite.rebateZero')}` }}
    </ConsoleButton>

    <p
      class="mt-4 flex items-center justify-between border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-tertiary)]"
    >
      <span>{{ t('invite.rebateHistoryTotal') }}</span>
      <span class="font-medium text-[var(--text-secondary)]">{{
        formatQuota(rewardTotal)
      }}</span>
    </p>
  </ConsoleCard>
</template>
