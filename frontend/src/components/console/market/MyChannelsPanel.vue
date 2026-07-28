<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { MyChannel } from '@/types/console'
import ConfirmDialog from '@/components/common/ConfirmDialog.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import DataTable, { type TableColumn } from '@/components/common/DataTable.vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  channels: MyChannel[]
  loading: boolean
  pending: Set<number>
}>()

const emit = defineEmits<{
  toggle: [id: number]
  remove: [id: number]
  goBuy: []
}>()

const { t } = useI18n()

const removing = ref<MyChannel | null>(null)

const columns = computed<TableColumn[]>(() => [
  { key: 'merchant', label: t('market.mine.merchant'), width: '180px' },
  { key: 'title', label: t('market.colName') },
  { key: 'models', label: t('market.mine.models') },
  { key: 'status', label: t('market.mine.status'), width: '120px' },
  { key: 'addedAt', label: t('market.mine.addedAt'), width: '130px' },
  {
    key: 'actions',
    label: t('market.mine.actions'),
    align: 'right',
    width: '110px',
  },
])

const rows = computed(
  () => props.channels as unknown as Array<Record<string, unknown>>
)
const asChannel = (row: Record<string, unknown>) => row as unknown as MyChannel

function confirmRemove() {
  if (!removing.value) return
  emit('remove', removing.value.id)
  removing.value = null
}
</script>

<template>
  <DataTable
    :columns="columns"
    :rows="rows"
    row-key="id"
    :loading="loading"
    :empty-title="t('market.mine.empty')"
    :empty-hint="t('market.mine.emptyHint')"
  >
    <template #cell-merchant="{ row }">
      <span class="font-medium text-[var(--text-primary)]">{{
        asChannel(row).merchantName
      }}</span>
    </template>
    <template #cell-title="{ row }">
      <span class="text-[var(--text-secondary)]">{{
        asChannel(row).title
      }}</span>
    </template>
    <template #cell-models="{ row }">
      <div class="flex flex-wrap gap-1">
        <span
          v-for="m in asChannel(row).supportedModels.slice(0, 3)"
          :key="m"
          class="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 font-mono text-xs text-[var(--text-secondary)]"
        >
          {{ m }}
        </span>
        <span
          v-if="asChannel(row).supportedModels.length > 3"
          class="px-1 text-xs text-[var(--text-tertiary)]"
        >
          +{{ asChannel(row).supportedModels.length - 3 }}
        </span>
      </div>
    </template>
    <template #cell-status="{ row }">
      <StatusChip
        :tone="asChannel(row).status === 'active' ? 'success' : 'neutral'"
      >
        {{
          asChannel(row).status === 'active'
            ? t('market.mine.enabled')
            : t('market.mine.disabled')
        }}
      </StatusChip>
    </template>
    <template #cell-addedAt="{ row }">
      <span class="text-xs text-[var(--text-tertiary)]">{{
        formatDate(asChannel(row).addedAt)
      }}</span>
    </template>
    <template #cell-actions="{ row }">
      <div class="flex items-center justify-end gap-2">
        <ConsoleToggle
          :model-value="asChannel(row).status === 'active'"
          :disabled="pending.has(asChannel(row).id)"
          :label="t('market.mine.status')"
          @update:model-value="emit('toggle', asChannel(row).id)"
        />
        <IconButton
          :label="t('market.mine.remove')"
          tone="danger"
          @click="removing = asChannel(row)"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
          </svg>
        </IconButton>
      </div>
    </template>
  </DataTable>

  <div
    v-if="!loading && channels.length === 0"
    class="mt-4 flex justify-center"
  >
    <ConsoleButton variant="secondary" @click="emit('goBuy')">
      {{ t('market.mine.goBuy') }}
    </ConsoleButton>
  </div>

  <ConfirmDialog
    :open="removing !== null"
    :title="t('market.mine.removeTitle')"
    :message="t('market.mine.removeMessage', { title: removing?.title ?? '' })"
    :confirm-text="t('market.mine.remove')"
    :cancel-text="t('keys.thinkAgain')"
    @confirm="confirmRemove"
    @cancel="removing = null"
  />
</template>
