<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import {
  adminOrderMethodLabelKey,
  adminOrderStatusLabelKey,
  adminOrderStatusTone,
  adminOrderTypeLabelKey,
} from '@/constants/adminOrders'
import type { AdminOrder } from '@/types/console'
import { formatMoney, formatQuota, formatTime } from '@/utils/format'

const props = withDefaults(
  defineProps<{
    order: AdminOrder | null
    canRefund?: boolean
  }>(),
  { canRefund: false }
)

const emit = defineEmits<{
  close: []
  refund: [order: AdminOrder]
}>()

const { t } = useI18n()
</script>

<template>
  <ConsoleModal
    :open="order !== null"
    :title="t('orders.detailTitle')"
    :subtitle="order?.order_no"
    size="lg"
    @close="emit('close')"
  >
    <dl v-if="props.order" class="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colId') }}
        </dt>
        <dd class="mt-1 font-mono text-sm text-[var(--text-primary)]">
          #{{ props.order.id }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colStatus') }}
        </dt>
        <dd class="mt-1">
          <StatusChip :tone="adminOrderStatusTone(props.order.status)">
            {{ t(adminOrderStatusLabelKey(props.order.status)) }}
          </StatusChip>
        </dd>
      </div>
      <div class="min-w-0 sm:col-span-2">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colOrderNo') }}
        </dt>
        <dd class="mt-1 break-all font-mono text-sm text-[var(--text-primary)]">
          {{ props.order.order_no }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colUser') }}
        </dt>
        <dd class="mt-1 min-w-0 text-sm text-[var(--text-primary)]">
          <span class="block truncate" :title="props.order.email">
            {{ props.order.email }}
          </span>
          <span class="block truncate text-xs text-[var(--text-tertiary)]">
            {{ props.order.username }} · #{{ props.order.user_id }}
          </span>
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colSubject') }}
        </dt>
        <dd class="mt-1 truncate text-sm text-[var(--text-primary)]">
          {{ props.order.subject }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colAmount') }}
        </dt>
        <dd
          class="mt-1 text-lg font-bold tabular-nums text-[var(--text-primary)]"
        >
          {{ formatMoney(props.order.amount) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colQuota') }}
        </dt>
        <dd class="mt-1 text-sm tabular-nums text-[var(--text-primary)]">
          {{ props.order.quota > 0 ? formatQuota(props.order.quota) : '—' }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colType') }}
        </dt>
        <dd class="mt-1 text-sm text-[var(--text-primary)]">
          {{ t(adminOrderTypeLabelKey(props.order.type)) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colMethod') }}
        </dt>
        <dd class="mt-1 text-sm text-[var(--text-primary)]">
          {{ t(adminOrderMethodLabelKey(props.order.method)) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colCreated') }}
        </dt>
        <dd class="mt-1 text-sm tabular-nums text-[var(--text-secondary)]">
          {{ formatTime(props.order.created) }}
        </dd>
      </div>
      <div class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colPaidAt') }}
        </dt>
        <dd class="mt-1 text-sm tabular-nums text-[var(--text-secondary)]">
          {{
            props.order.paid_at > 0
              ? formatTime(props.order.paid_at)
              : t('orders.notPaid')
          }}
        </dd>
      </div>
      <div v-if="props.order.refunded_at > 0" class="min-w-0">
        <dt class="text-xs text-[var(--text-tertiary)]">
          {{ t('orders.colRefundedAt') }}
        </dt>
        <dd class="mt-1 text-sm tabular-nums text-[var(--text-secondary)]">
          {{ formatTime(props.order.refunded_at) }}
        </dd>
      </div>
    </dl>

    <template #footer>
      <div :class="canRefund ? 'grid grid-cols-2 gap-3' : ''">
        <ConsoleButton variant="secondary" block @click="emit('close')">
          {{ t('common.close') }}
        </ConsoleButton>
        <ConsoleButton
          v-if="canRefund && props.order"
          variant="danger"
          block
          @click="emit('refund', props.order)"
        >
          {{ t('orders.refundOrder') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
