<script setup lang="ts">
import {
  Activity,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  Pencil,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
} from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

import CapacityMeter from '@/components/common/CapacityMeter.vue'
import IconButton from '@/components/common/IconButton.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import {
  type AdminChannelOptionalField,
  adminChannelResponseText,
  adminChannelResponseTone,
  adminChannelStatusLabelKey,
  adminChannelStatusTone,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import type { AdminChannel } from '@/types/console'
import { formatMoney, formatQuota, relativeTime } from '@/utils/format'

import ChannelInlineNumber from './ChannelInlineNumber.vue'

type ChannelAction = 'priority' | 'weight' | 'status' | 'balance' | 'test'
type ChannelBatchAction = Extract<ChannelAction, 'balance' | 'test'>

interface ChannelBatchProgress {
  action: ChannelBatchAction
  scope: 'page' | 'supplier'
  supplier?: string
  total: number
  processed: number
}

defineProps<{
  groups: Array<{ supplier: string; channels: AdminChannel[] }>
  visibleFields: AdminChannelOptionalField[]
  selectedIds: number[]
  allSelected: boolean
  selectionDisabled: boolean
  toggleAllSelected: () => void
  toggleSelected: (channel: AdminChannel) => void
  isSupplierCollapsed: (supplier: string) => boolean
  toggleSupplier: (supplier: string) => void
  batchProgress: ChannelBatchProgress | null
  canRunBatch: boolean
  canMutate: boolean
  canOperate: boolean
  canWrite: boolean
  canSensitiveWrite: boolean
  runSupplierBatch: (
    action: ChannelBatchAction,
    supplier: string,
    channels: AdminChannel[]
  ) => Promise<void>
  clearSupplier: (group: { supplier: string; channels: AdminChannel[] }) => void
  isBusy: (id: number, action: ChannelAction) => boolean
  isRowBusy: (id: number) => boolean
  updateNumber: (
    channel: AdminChannel,
    field: 'priority' | 'weight',
    value: number
  ) => Promise<boolean>
  toggleStatus: (channel: AdminChannel) => Promise<boolean>
  refreshBalance: (channel: AdminChannel) => Promise<boolean>
  testChannel: (channel: AdminChannel) => Promise<boolean>
  editChannel: (channel: AdminChannel) => void
  deleteChannel: (channel: AdminChannel) => void
}>()

const { t, locale } = useI18n()
</script>

<template>
  <div>
    <label
      v-if="canOperate || canSensitiveWrite"
      class="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-2 text-xs text-[var(--text-secondary)]"
    >
      <input
        type="checkbox"
        class="checkbox-round"
        :checked="allSelected"
        :disabled="selectionDisabled"
        :aria-label="t('channels.selectPage')"
        @change="toggleAllSelected"
      />
      {{ t('channels.selectPage') }}
    </label>
    <div class="divide-y divide-[var(--border-default)]">
      <section v-for="group in groups" :key="group.supplier">
        <div
          data-channel-mobile-group
          class="flex min-w-0 items-center justify-between gap-2 bg-[var(--surface-muted)] px-3 py-2.5"
        >
          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring"
            :aria-label="
              isSupplierCollapsed(group.supplier)
                ? t('channels.expandSupplier', { supplier: group.supplier })
                : t('channels.collapseSupplier', { supplier: group.supplier })
            "
            :aria-expanded="!isSupplierCollapsed(group.supplier)"
            @click="toggleSupplier(group.supplier)"
          >
            <ChevronRight
              v-if="isSupplierCollapsed(group.supplier)"
              :size="15"
              class="shrink-0 text-[var(--text-tertiary)]"
            />
            <ChevronDown
              v-else
              :size="15"
              class="shrink-0 text-[var(--text-tertiary)]"
            />
            <VendorLogo :vendor="group.supplier" :size="24" />
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm font-semibold text-[var(--text-primary)]"
              >
                {{ group.supplier }}
              </span>
              <span class="block text-[10px] text-[var(--text-tertiary)]">
                {{
                  batchProgress?.scope === 'supplier' &&
                  batchProgress.supplier === group.supplier
                    ? t('channels.batchProgress', {
                        processed: batchProgress.processed,
                        total: batchProgress.total,
                      })
                    : t('channels.supplierGroupCount', {
                        count: group.channels.length,
                      })
                }}
              </span>
            </span>
          </button>
          <div
            v-if="canOperate || canSensitiveWrite"
            class="flex shrink-0 items-center gap-0.5"
          >
            <IconButton
              v-if="canOperate"
              :label="t('channels.syncSupplier', { supplier: group.supplier })"
              :disabled="!canRunBatch"
              class="h-7 w-7"
              @click="
                runSupplierBatch('balance', group.supplier, group.channels)
              "
            >
              <LoaderCircle
                v-if="
                  batchProgress?.scope === 'supplier' &&
                  batchProgress.action === 'balance' &&
                  batchProgress.supplier === group.supplier
                "
                :size="14"
                class="animate-spin"
              />
              <RefreshCw v-else :size="14" />
            </IconButton>
            <IconButton
              v-if="canOperate"
              :label="t('channels.testSupplier', { supplier: group.supplier })"
              :disabled="!canRunBatch"
              class="h-7 w-7"
              @click="runSupplierBatch('test', group.supplier, group.channels)"
            >
              <LoaderCircle
                v-if="
                  batchProgress?.scope === 'supplier' &&
                  batchProgress.action === 'test' &&
                  batchProgress.supplier === group.supplier
                "
                :size="14"
                class="animate-spin"
              />
              <Activity v-else :size="14" />
            </IconButton>
            <IconButton
              v-if="canSensitiveWrite"
              :label="t('channels.clearSupplier', { supplier: group.supplier })"
              tone="danger"
              :disabled="!canMutate"
              class="h-7 w-7"
              @click="clearSupplier(group)"
            >
              <Trash2 :size="14" />
            </IconButton>
          </div>
        </div>

        <div
          v-if="!isSupplierCollapsed(group.supplier)"
          class="divide-y divide-[var(--border-subtle)]"
        >
          <article
            v-for="channel in group.channels"
            :key="channel.id"
            data-channel-mobile-row
            class="min-w-0 px-4 py-4 transition-colors"
            :class="
              channel.status === 1 ? '' : 'bg-[var(--surface-muted)] opacity-75'
            "
          >
            <header class="flex min-w-0 items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-2.5">
                <input
                  v-if="canOperate || canSensitiveWrite"
                  type="checkbox"
                  class="checkbox-round mt-2 shrink-0"
                  :checked="selectedIds.includes(channel.id)"
                  :disabled="selectionDisabled"
                  :aria-label="
                    t('channels.selectChannel', { name: channel.name })
                  "
                  @click.stop
                  @change="toggleSelected(channel)"
                />
                <VendorLogo
                  v-if="visibleFields.includes('type')"
                  :vendor="channel.supplier"
                  :size="32"
                />
                <div class="min-w-0">
                  <h2
                    class="truncate text-sm font-semibold text-[var(--text-primary)]"
                    :title="channel.name"
                  >
                    {{ channel.name }}
                  </h2>
                  <p
                    v-if="
                      visibleFields.includes('id') ||
                      visibleFields.includes('type')
                    "
                    class="mt-0.5 text-xs text-[var(--text-tertiary)]"
                  >
                    <span v-if="visibleFields.includes('id')" class="font-mono">
                      #{{ channel.id }}
                    </span>
                    <span
                      v-if="
                        visibleFields.includes('id') &&
                        visibleFields.includes('type')
                      "
                      aria-hidden="true"
                    >
                      ·
                    </span>
                    <span v-if="visibleFields.includes('type')">
                      {{ adminChannelTypeMeta(channel.type).label }}
                    </span>
                  </p>
                </div>
              </div>
              <StatusChip
                v-if="visibleFields.includes('status')"
                :tone="adminChannelStatusTone(channel.status)"
              >
                {{ t(adminChannelStatusLabelKey(channel.status)) }}
              </StatusChip>
            </header>

            <dl class="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-4 text-xs">
              <div v-if="visibleFields.includes('priority')" class="min-w-0">
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.priority') }}
                </dt>
                <dd class="mt-1.5">
                  <ChannelInlineNumber
                    v-if="canWrite"
                    :value="channel.priority"
                    :label="t('channels.priorityFor', { name: channel.name })"
                    :busy="isRowBusy(channel.id)"
                    :commit="
                      (value) => updateNumber(channel, 'priority', value)
                    "
                  />
                  <span v-else class="tabular-nums text-[var(--text-primary)]">
                    {{ channel.priority }}
                  </span>
                </dd>
              </div>
              <div v-if="visibleFields.includes('weight')" class="min-w-0">
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.weight') }}
                </dt>
                <dd class="mt-1.5">
                  <ChannelInlineNumber
                    v-if="canWrite"
                    :value="channel.weight"
                    :label="t('channels.weightFor', { name: channel.name })"
                    :busy="isRowBusy(channel.id)"
                    :commit="(value) => updateNumber(channel, 'weight', value)"
                  />
                  <span v-else class="tabular-nums text-[var(--text-primary)]">
                    {{ channel.weight }}
                  </span>
                </dd>
              </div>
              <div
                v-if="visibleFields.includes('capacity')"
                class="col-span-2 min-w-0"
              >
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.capacity') }}
                </dt>
                <dd class="mt-1.5">
                  <CapacityMeter
                    :used="channel.capacity_used"
                    :total="channel.capacity_total"
                  />
                </dd>
              </div>
              <div v-if="visibleFields.includes('usage')" class="min-w-0">
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.usageAndRatio') }}
                </dt>
                <dd class="mt-1 space-y-0.5">
                  <p
                    class="font-semibold tabular-nums text-[var(--text-primary)]"
                  >
                    {{ formatQuota(channel.used_quota) }}
                  </p>
                  <p class="text-[11px] text-[var(--text-tertiary)]">
                    {{
                      t('channels.channelRatioValue', {
                        ratio: channel.channel_ratio.toFixed(2),
                      })
                    }}
                  </p>
                </dd>
              </div>
              <div v-if="visibleFields.includes('upstream')" class="min-w-0">
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.upstreamAndRatio') }}
                </dt>
                <dd class="mt-1 flex items-center justify-between gap-1">
                  <div class="min-w-0 space-y-0.5">
                    <p
                      class="font-semibold tabular-nums text-[var(--text-primary)]"
                    >
                      {{ formatMoney(channel.balance) }}
                    </p>
                    <p class="truncate text-[11px] text-[var(--text-tertiary)]">
                      {{
                        t('channels.upstreamRatioValue', {
                          ratio: channel.upstream_ratio.toFixed(2),
                        })
                      }}
                    </p>
                  </div>
                  <IconButton
                    v-if="
                      canOperate && visibleFields.includes('rowUpstreamAction')
                    "
                    :label="t('channels.refreshBalance')"
                    :disabled="isRowBusy(channel.id)"
                    class="h-7 w-7 shrink-0"
                    @click="refreshBalance(channel)"
                  >
                    <LoaderCircle
                      v-if="isBusy(channel.id, 'balance')"
                      :size="14"
                      class="animate-spin"
                    />
                    <RefreshCw v-else :size="14" />
                  </IconButton>
                </dd>
              </div>
              <div v-if="visibleFields.includes('response')" class="min-w-0">
                <dt class="text-[var(--text-tertiary)]">
                  {{ t('channels.response') }}
                </dt>
                <dd class="mt-1 flex items-center justify-between gap-1">
                  <StatusChip
                    :tone="adminChannelResponseTone(channel.response_time)"
                    :title="
                      channel.test_time
                        ? t('channels.testedAt', {
                            time: relativeTime(channel.test_time, locale),
                          })
                        : t('channels.notTested')
                    "
                  >
                    {{
                      adminChannelResponseText(
                        channel.response_time,
                        t('channels.notTested')
                      )
                    }}
                  </StatusChip>
                  <IconButton
                    v-if="
                      canOperate && visibleFields.includes('rowResponseAction')
                    "
                    :label="t('channels.testChannel')"
                    :disabled="isRowBusy(channel.id)"
                    class="h-7 w-7 shrink-0"
                    @click="testChannel(channel)"
                  >
                    <LoaderCircle
                      v-if="isBusy(channel.id, 'test')"
                      :size="14"
                      class="animate-spin"
                    />
                    <Activity v-else :size="14" />
                  </IconButton>
                </dd>
              </div>
            </dl>

            <footer
              v-if="canOperate || canWrite || canSensitiveWrite"
              class="mt-4 flex items-center justify-end gap-1 border-t border-[var(--border-subtle)] pt-3"
            >
              <IconButton
                v-if="canWrite"
                :label="t('channels.editChannel')"
                :disabled="isRowBusy(channel.id)"
                @click="editChannel(channel)"
              >
                <Pencil :size="16" />
              </IconButton>
              <IconButton
                v-if="canOperate"
                :label="
                  channel.status === 1
                    ? t('channels.disableChannel')
                    : t('channels.enableChannel')
                "
                :tone="channel.status === 1 ? 'danger' : 'default'"
                :disabled="isRowBusy(channel.id)"
                @click="toggleStatus(channel)"
              >
                <LoaderCircle
                  v-if="isBusy(channel.id, 'status')"
                  :size="16"
                  class="animate-spin"
                />
                <PowerOff v-else-if="channel.status === 1" :size="16" />
                <Power v-else :size="16" />
              </IconButton>
              <IconButton
                v-if="canSensitiveWrite"
                :label="t('channels.deleteChannel')"
                tone="danger"
                :disabled="isRowBusy(channel.id)"
                @click="deleteChannel(channel)"
              >
                <Trash2 :size="16" />
              </IconButton>
            </footer>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>
