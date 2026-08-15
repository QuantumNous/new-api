<script setup lang="ts">
import { Activity, LoaderCircle } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import type {
  ChannelModelTestOptions,
  ChannelModelTestResult,
} from '@/composables/useAdminChannels'
import { useToast } from '@/composables/useToast'
import type { AdminChannel } from '@/types/console'

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
  /** One channel started testing; the table can show a running state. */
  start: [channelId: number]
  /** One channel finished testing; the table can render the result inline. */
  result: [channelId: number, outcome: ChannelModelTestResult]
  /** The whole batch finished; safe to refresh persisted response fields. */
  tested: []
}>()

const { t } = useI18n()
const toast = useToast()

const TEST_BATCH_SIZE = 5

const selectedModel = ref('')
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
    testing.value = false
    done.value = 0
    // Preselect when the group publishes exactly one model.
    const options = modelOptions.value
    selectedModel.value = options.length === 1 ? options[0]!.value : ''
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  abortController?.abort()
})

async function runChannelTest(
  channel: AdminChannel,
  model: string
): Promise<'success' | 'failed' | 'dropped'> {
  const signal = abortController?.signal
  if (!signal || signal.aborted) return 'dropped'
  emit('start', channel.id)
  try {
    const result = await props.testModel(channel, model, {}, signal)
    // Discard outcomes that no longer belong to the current selection so a
    // mid-flight model switch cannot attribute old results to the new model.
    if (signal.aborted || selectedModel.value !== model) return 'dropped'
    emit('result', channel.id, result)
    return result.ok ? 'success' : 'failed'
  } catch {
    // Aborted (dialog closed): leave the row untested.
    return 'dropped'
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
  let succeeded = 0
  let failed = 0
  try {
    for (let start = 0; start < batchTargets.length; start += TEST_BATCH_SIZE) {
      if (controller.signal.aborted || selectedModel.value !== model) return
      const batch = batchTargets.slice(start, start + TEST_BATCH_SIZE)
      const outcomes = await Promise.all(
        batch.map((channel) => runChannelTest(channel, model))
      )
      for (const outcome of outcomes) {
        if (outcome === 'success') succeeded += 1
        else if (outcome === 'failed') failed += 1
      }
      done.value = Math.min(start + batch.length, batchTargets.length)
    }
    // Each test writes the channel's response time server-side; let the table
    // pick up the new values once the batch is complete.
    emit('tested')
    const attempted = succeeded + failed
    if (attempted === 0) return
    if (failed === 0) {
      toast.success(
        t('channels.batchTestCompleted', { count: succeeded, model })
      )
    } else if (succeeded === 0) {
      toast.error(t('channels.batchTestFailed', { count: failed, model }))
    } else {
      toast.warning(
        t('channels.batchTestPartial', { succeeded, failed, model })
      )
    }
  } finally {
    testing.value = false
    done.value = 0
  }
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="t('channels.pickChannelTitle')"
    size="sm"
    @close="emit('close')"
  >
    <div class="space-y-5 text-left">
      <p class="text-sm leading-6 text-[var(--text-tertiary)]">
        {{ t('channels.pickChannelDesc', { supplier }) }}
      </p>

      <div>
        <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
          {{ t('channels.pickModelLabel') }}
        </p>
        <!-- Switching models mid-batch would misattribute in-flight results,
             so the picker is inert while tests run. -->
        <div
          :inert="testing"
          :class="testing ? 'opacity-60' : ''"
          data-channel-test-picker
        >
          <FilterSelect
            v-model="selectedModel"
            :options="modelOptions"
            :label="t('channels.pickModelLabel')"
            :placeholder="t('channels.pickModelPlaceholder')"
          />
        </div>
        <p
          v-if="selectedModel"
          class="mt-2 text-xs text-[var(--text-tertiary)]"
        >
          {{ t('channels.pickModelHint', { count: targets.length }) }}
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
          :disabled="targets.length === 0 || testing"
          data-channel-test-start
          @click="runBatch"
        >
          <LoaderCircle
            v-if="testing"
            :size="15"
            class="relative z-[1] shrink-0 animate-spin overflow-visible"
            data-channel-test-spinner
          />
          <Activity v-else :size="15" class="relative z-[1] shrink-0" />
          <span class="relative z-[1] tabular-nums">
            {{ testing ? `${done}/${total}` : t('channels.pickChannelStart') }}
          </span>
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>
