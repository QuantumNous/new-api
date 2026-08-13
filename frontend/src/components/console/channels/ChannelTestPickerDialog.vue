<script setup lang="ts">
import { Activity, LoaderCircle } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import type {
  ChannelModelTestOptions,
  ChannelModelTestResult,
} from '@/composables/useAdminChannels'
import {
  adminChannelStatusLabelKey,
  adminChannelStatusTone,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import type { AdminChannel } from '@/types/console'

type RowStatus = 'idle' | 'running' | 'success' | 'failed'

interface RowState {
  status: RowStatus
  timeMs?: number
  message?: string
}

const props = defineProps<{
  open: boolean
  supplier: string
  channels: AdminChannel[]
  testModel: (
    channel: AdminChannel,
    model: string,
    options: ChannelModelTestOptions,
    signal?: AbortSignal
  ) => Promise<ChannelModelTestResult>
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const TEST_BATCH_SIZE = 5

const pickedModel = ref('')
const testing = ref(false)
const results = ref<Record<number, RowState>>({})
let abortController: AbortController | null = null

function abortRun() {
  abortController?.abort()
  abortController = null
  testing.value = false
}

watch(
  () => props.open,
  (open) => {
    abortRun()
    if (!open) return
    pickedModel.value = ''
    results.value = {}
  },
  { immediate: true }
)

// Results belong to one model, so a new pick drops the previous run.
watch(pickedModel, () => {
  abortRun()
  results.value = {}
})

onBeforeUnmount(abortRun)

/** Model union of the group: model -> the channels that publish it. */
const modelChannels = computed(() => {
  const map = new Map<string, AdminChannel[]>()
  for (const channel of props.channels) {
    for (const raw of channel.models.split(',')) {
      const model = raw.trim()
      if (!model) continue
      const existing = map.get(model)
      if (!existing) map.set(model, [channel])
      else if (!existing.includes(channel)) existing.push(channel)
    }
  }
  return map
})

const modelOptions = computed(() =>
  Array.from(modelChannels.value.keys())
    .sort((a, b) => a.localeCompare(b))
    .map((model) => ({ value: model, label: model }))
)

/** Before a pick the dialog still shows the whole group. */
const targetChannels = computed(() =>
  pickedModel.value
    ? (modelChannels.value.get(pickedModel.value) ?? [])
    : props.channels
)

const testedCount = computed(
  () =>
    Object.values(results.value).filter(
      (row) => row.status === 'success' || row.status === 'failed'
    ).length
)

function modelCount(channel: AdminChannel): number {
  return channel.models.split(',').filter((model) => model.trim()).length
}

function rowState(channel: AdminChannel): RowState {
  return results.value[channel.id] ?? { status: 'idle' }
}

async function runChannelTest(
  channel: AdminChannel,
  model: string,
  signal: AbortSignal
): Promise<void> {
  try {
    const result = await props.testModel(channel, model, {}, signal)
    if (signal.aborted) return
    results.value[channel.id] = result.ok
      ? { status: 'success', timeMs: result.timeMs }
      : { status: 'failed', message: result.message }
  } catch {
    // Aborted (dialog closed or model changed): leave the row untested.
    if (results.value[channel.id]?.status === 'running') {
      results.value[channel.id] = { status: 'idle' }
    }
  }
}

async function startTest() {
  const model = pickedModel.value
  if (!model || testing.value) return
  const targets = [...targetChannels.value]
  if (targets.length === 0) return

  abortRun()
  const controller = new AbortController()
  abortController = controller
  const signal = controller.signal

  testing.value = true
  results.value = Object.fromEntries(
    targets.map((channel) => [channel.id, { status: 'idle' as RowStatus }])
  )
  try {
    for (let start = 0; start < targets.length; start += TEST_BATCH_SIZE) {
      if (signal.aborted) return
      const batch = targets.slice(start, start + TEST_BATCH_SIZE)
      batch.forEach((channel) => {
        results.value[channel.id] = { status: 'running' }
      })
      await Promise.all(
        batch.map((channel) => runChannelTest(channel, model, signal))
      )
    }
  } finally {
    // A newer run or an abort may already own the dialog state.
    if (abortController === controller) testing.value = false
  }
}

function statusTone(
  status: RowStatus
): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

function statusLabel(status: RowStatus): string {
  if (status === 'success') return t('channels.testStatusSuccess')
  if (status === 'failed') return t('channels.testStatusFailed')
  return t('channels.testStatusRunning')
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="t('channels.pickChannelTitle')"
    size="md"
    @close="emit('close')"
  >
    <div class="text-left">
      <p class="mb-3 text-xs text-[var(--text-tertiary)]">
        {{ t('channels.pickChannelDesc', { supplier }) }}
      </p>
      <FilterSelect
        v-model="pickedModel"
        :options="modelOptions"
        :label="t('channels.pickChannelModelLabel')"
        :placeholder="t('channels.pickChannelModelPlaceholder')"
      />
      <div
        class="subtle-scroll mt-3 max-h-80 space-y-2 overflow-y-auto"
        role="list"
        :aria-label="t('channels.pickChannelTitle')"
      >
        <div
          v-for="channel in targetChannels"
          :key="channel.id"
          class="channel-pick-row"
          role="listitem"
        >
          <VendorLogo
            :vendor="adminChannelTypeMeta(channel.type).supplier"
            :size="22"
          />
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-sm font-medium text-[var(--text-primary)]"
              :title="channel.name"
            >
              {{ channel.name }}
            </span>
            <span
              v-if="rowState(channel).status === 'success'"
              class="block text-xs tabular-nums text-[var(--status-success-text)]"
            >
              {{
                t('channels.testResultMs', {
                  ms: rowState(channel).timeMs ?? 0,
                })
              }}
            </span>
            <span
              v-else-if="rowState(channel).status === 'failed'"
              class="block truncate text-xs text-[var(--status-danger-text)]"
              :title="rowState(channel).message"
            >
              {{ rowState(channel).message }}
            </span>
            <span v-else class="block text-xs text-[var(--text-tertiary)]">
              {{
                t('channels.pickChannelModels', { count: modelCount(channel) })
              }}
            </span>
          </span>
          <StatusChip
            v-if="rowState(channel).status !== 'idle'"
            :tone="statusTone(rowState(channel).status)"
          >
            {{ statusLabel(rowState(channel).status) }}
          </StatusChip>
          <StatusChip v-else :tone="adminChannelStatusTone(channel.status)">
            {{ t(adminChannelStatusLabelKey(channel.status)) }}
          </StatusChip>
        </div>
        <p
          v-if="targetChannels.length === 0"
          class="px-2 py-6 text-center text-sm text-[var(--text-tertiary)]"
        >
          {{ t('common.noResults') }}
        </p>
      </div>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="emit('close')">
          {{ t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton
          size="lg"
          :disabled="!pickedModel || testing"
          @click="startTest"
        >
          <LoaderCircle v-if="testing" :size="15" class="animate-spin" />
          <Activity v-else :size="15" />
          {{
            testing
              ? `${testedCount}/${targetChannels.length}`
              : t('channels.pickChannelStart')
          }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>

<style scoped>
.channel-pick-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
}
</style>
