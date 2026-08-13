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

type ChannelTestStatus =
  'idle' | 'running' | 'success' | 'failed' | 'unsupported'

interface ChannelTestState {
  status: ChannelTestStatus
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
  tested: []
}>()

const { t } = useI18n()

const TEST_BATCH_SIZE = 5

const selectedModel = ref('')
const states = ref<Record<number, ChannelTestState>>({})
const testing = ref(false)
const done = ref(0)
const total = ref(0)
let abortController: AbortController | null = null

function channelModels(channel: AdminChannel): string[] {
  return channel.models
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

/** Union of every model published across the group, so one pick can drive a
    batch test even when the channels publish different catalogs. */
const modelOptions = computed(() => {
  const models = new Set<string>()
  props.channels.forEach((channel) =>
    channelModels(channel).forEach((model) => models.add(model))
  )
  return Array.from(models)
    .sort((left, right) => left.localeCompare(right))
    .map((model) => ({ value: model, label: model }))
})

const targets = computed(() =>
  selectedModel.value
    ? props.channels.filter((channel) =>
        channelModels(channel).includes(selectedModel.value)
      )
    : []
)

watch(
  () => props.open,
  (open) => {
    abortController?.abort()
    if (!open) {
      abortController = null
      return
    }
    abortController = new AbortController()
    states.value = {}
    testing.value = false
    done.value = 0
    // Preselect when the group publishes exactly one model.
    const options = modelOptions.value
    selectedModel.value = options.length === 1 ? options[0]!.value : ''
  },
  { immediate: true }
)

watch(selectedModel, () => {
  // Results belong to a single model; switching invalidates them.
  states.value = {}
  done.value = 0
})

onBeforeUnmount(() => {
  abortController?.abort()
})

function stateFor(channel: AdminChannel): ChannelTestState {
  if (
    selectedModel.value &&
    !channelModels(channel).includes(selectedModel.value)
  ) {
    return { status: 'unsupported' }
  }
  return states.value[channel.id] ?? { status: 'idle' }
}

async function runChannelTest(
  channel: AdminChannel,
  model: string
): Promise<void> {
  const signal = abortController?.signal
  if (!signal || signal.aborted) return
  states.value[channel.id] = { status: 'running' }
  try {
    const result = await props.testModel(channel, model, {}, signal)
    // Discard outcomes that no longer belong to the current selection so a
    // mid-flight model switch cannot attribute old results to the new model.
    if (signal.aborted || selectedModel.value !== model) return
    states.value[channel.id] = result.ok
      ? { status: 'success', timeMs: result.timeMs }
      : { status: 'failed', message: result.message }
  } catch {
    // Aborted (dialog closed): leave the row untested.
    if (states.value[channel.id]?.status === 'running') {
      states.value[channel.id] = { status: 'idle' }
    }
  }
}

async function runBatch() {
  const controller = abortController
  const model = selectedModel.value
  if (!controller || !model || testing.value || targets.value.length === 0) {
    return
  }
  const batchTargets = [...targets.value]
  testing.value = true
  done.value = 0
  total.value = batchTargets.length
  try {
    for (let start = 0; start < batchTargets.length; start += TEST_BATCH_SIZE) {
      if (controller.signal.aborted || selectedModel.value !== model) return
      const batch = batchTargets.slice(start, start + TEST_BATCH_SIZE)
      await Promise.all(batch.map((channel) => runChannelTest(channel, model)))
      done.value = Math.min(start + batch.length, batchTargets.length)
    }
    // Each test writes the channel's response time server-side; let the table
    // pick up the new values.
    emit('tested')
  } finally {
    testing.value = false
    done.value = 0
  }
}

function statusTone(
  status: ChannelTestStatus
): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

function statusLabel(status: ChannelTestStatus): string {
  if (status === 'success') return t('channels.testStatusSuccess')
  if (status === 'failed') return t('channels.testStatusFailed')
  if (status === 'running') return t('channels.testStatusRunning')
  if (status === 'unsupported') return t('channels.pickModelMissing')
  return t('channels.testStatusIdle')
}

/** Second row line doubles as the response field: timing, error, or catalog. */
function resultText(channel: AdminChannel): string {
  const state = stateFor(channel)
  if (state.status === 'success') {
    return t('channels.testResultMs', { ms: state.timeMs ?? 0 })
  }
  if (state.status === 'failed') return state.message ?? ''
  return t('channels.pickChannelModels', {
    count: channelModels(channel).length,
  })
}

function resultClass(channel: AdminChannel): string {
  const status = stateFor(channel).status
  if (status === 'success') {
    return 'tabular-nums text-[var(--status-success-text)]'
  }
  if (status === 'failed') return 'text-[var(--status-danger-text)]'
  return 'text-[var(--text-tertiary)]'
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="t('channels.pickChannelTitle')"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <p class="text-xs text-[var(--text-tertiary)]">
        {{ t('channels.pickChannelDesc', { supplier }) }}
      </p>

      <div>
        <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
          {{ t('channels.pickModelLabel') }}
        </p>
        <!-- Switching models mid-batch would misattribute in-flight results,
             so the picker is inert while tests run. -->
        <div :inert="testing" :class="testing ? 'opacity-60' : ''">
          <FilterSelect
            v-model="selectedModel"
            :options="modelOptions"
            :label="t('channels.pickModelLabel')"
            :placeholder="t('channels.pickModelPlaceholder')"
          />
        </div>
        <p
          v-if="selectedModel"
          class="mt-1.5 text-xs text-[var(--text-tertiary)]"
        >
          {{ t('channels.pickModelHint', { count: targets.length }) }}
        </p>
      </div>

      <ul class="subtle-scroll max-h-80 space-y-2 overflow-y-auto">
        <li
          v-for="channel in channels"
          :key="channel.id"
          class="channel-pick-row"
          :class="
            stateFor(channel).status === 'unsupported'
              ? 'channel-pick-row--muted'
              : ''
          "
        >
          <VendorLogo
            :vendor="adminChannelTypeMeta(channel.type).supplier"
            :size="22"
          />
          <div class="min-w-0 flex-1">
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="truncate text-sm font-medium text-[var(--text-primary)]"
                :title="channel.name"
              >
                {{ channel.name }}
              </span>
              <StatusChip
                class="shrink-0 whitespace-nowrap"
                :tone="adminChannelStatusTone(channel.status)"
              >
                {{ t(adminChannelStatusLabelKey(channel.status)) }}
              </StatusChip>
            </div>
            <p
              class="mt-0.5 truncate text-xs"
              :class="resultClass(channel)"
              :title="resultText(channel)"
            >
              {{ resultText(channel) }}
            </p>
          </div>
          <StatusChip
            class="shrink-0 whitespace-nowrap"
            :tone="statusTone(stateFor(channel).status)"
          >
            <LoaderCircle
              v-if="stateFor(channel).status === 'running'"
              :size="12"
              class="animate-spin"
            />
            {{ statusLabel(stateFor(channel).status) }}
          </StatusChip>
        </li>
      </ul>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="emit('close')">
          {{ t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton
          size="lg"
          :disabled="targets.length === 0 || testing"
          @click="runBatch"
        >
          <LoaderCircle v-if="testing" :size="15" class="animate-spin" />
          <Activity v-else :size="15" />
          {{ testing ? `${done}/${total}` : t('channels.pickChannelStart') }}
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
  transition:
    border-color 0.15s,
    background-color 0.15s;
}
.channel-pick-row--muted {
  opacity: 0.6;
}
</style>
