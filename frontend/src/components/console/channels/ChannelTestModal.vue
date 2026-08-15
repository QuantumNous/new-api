<script setup lang="ts">
import {
  Activity,
  ArrowDownAZ,
  ArrowUpAZ,
  ArrowUpDown,
  CircleCheckBig,
  LoaderCircle,
  Trash2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import IconButton from '@/components/common/IconButton.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TablePagination from '@/components/common/TablePagination.vue'
import type {
  ChannelModelTestOptions,
  ChannelModelTestResult,
} from '@/composables/useAdminChannels'
import { CHANNEL_TEST_ENDPOINT_OPTIONS } from '@/constants/adminChannels'
import type { AdminChannel } from '@/types/console'

type ModelTestStatus = 'idle' | 'running' | 'success' | 'failed'

interface ModelTestState {
  status: ModelTestStatus
  timeMs?: number
  message?: string
}

const props = defineProps<{
  open: boolean
  channel: AdminChannel | null
  canWrite: boolean
  testModel: (
    channel: AdminChannel,
    model: string,
    options: ChannelModelTestOptions,
    signal?: AbortSignal
  ) => Promise<ChannelModelTestResult>
  removeModels: (channel: AdminChannel, models: string[]) => Promise<boolean>
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()

const TEST_BATCH_SIZE = 5
const REMOVE_ARM_TIMEOUT_MS = 3000

// ── State ──────────────────────────────────────────────────────────────────
const models = ref<string[]>([])
const states = ref<Record<string, ModelTestState>>({})
const endpointType = ref('')
const stream = ref(false)
const filter = ref('')
const page = ref(1)
const pageSize = ref(5)
const sortOrder = ref<'none' | 'asc' | 'desc'>('none')
const selected = ref<string[]>([])
const testingAll = ref(false)
const batchDone = ref(0)
const removeArmed = ref(false)
const removing = ref(false)
let abortController: AbortController | null = null
let removeArmTimer = 0

function resetFromChannel(channel: AdminChannel | null) {
  abortController?.abort()
  abortController = new AbortController()
  const list = channel
    ? Array.from(
        new Set(
          channel.models
            .split(',')
            .map((model) => model.trim())
            .filter(Boolean)
        )
      )
    : []
  models.value = list
  states.value = Object.fromEntries(
    list.map((model) => [model, { status: 'idle' as ModelTestStatus }])
  )
  endpointType.value = ''
  stream.value = false
  filter.value = ''
  page.value = 1
  pageSize.value = 5
  sortOrder.value = 'none'
  selected.value = []
  testingAll.value = false
  batchDone.value = 0
  removeArmed.value = false
  removing.value = false
}

watch(
  () => props.open,
  (open) => {
    if (open) resetFromChannel(props.channel)
    else abortController?.abort()
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  abortController?.abort()
  window.clearTimeout(removeArmTimer)
})

// ── Derived lists ──────────────────────────────────────────────────────────
const filteredModels = computed(() => {
  const query = filter.value.trim().toLowerCase()
  const base = query
    ? models.value.filter((model) => model.toLowerCase().includes(query))
    : [...models.value]
  if (sortOrder.value === 'asc') return base.sort((a, b) => a.localeCompare(b))
  if (sortOrder.value === 'desc') return base.sort((a, b) => b.localeCompare(a))
  return base
})

const pagedModels = computed(() =>
  filteredModels.value.slice(
    (page.value - 1) * pageSize.value,
    page.value * pageSize.value
  )
)

watch([filter, sortOrder], () => {
  page.value = 1
})

watch([() => filteredModels.value.length, pageSize], ([modelCount]) => {
  const pageCount = Math.max(1, Math.ceil(modelCount / pageSize.value))
  if (page.value > pageCount) page.value = pageCount
})

const successModels = computed(() =>
  models.value.filter((model) => states.value[model]?.status === 'success')
)
const failedModels = computed(() =>
  models.value.filter((model) => states.value[model]?.status === 'failed')
)
const allFilteredSelected = computed(
  () =>
    filteredModels.value.length > 0 &&
    filteredModels.value.every((model) => selected.value.includes(model))
)
const batchTargets = computed(() =>
  selected.value.length > 0 ? selected.value : filteredModels.value
)

// ── Selection ──────────────────────────────────────────────────────────────
function toggleModelSelected(model: string) {
  selected.value = selected.value.includes(model)
    ? selected.value.filter((item) => item !== model)
    : [...selected.value, model]
}

function toggleAllFiltered() {
  selected.value = allFilteredSelected.value ? [] : [...filteredModels.value]
}

function selectSuccessModels() {
  selected.value = [...successModels.value]
}

function cycleSortOrder() {
  sortOrder.value =
    sortOrder.value === 'none'
      ? 'asc'
      : sortOrder.value === 'asc'
        ? 'desc'
        : 'none'
}

// ── Testing ────────────────────────────────────────────────────────────────
async function runModelTest(model: string): Promise<void> {
  const channel = props.channel
  const signal = abortController?.signal
  if (!channel || !signal || signal.aborted) return
  states.value[model] = { status: 'running' }
  try {
    const result = await props.testModel(
      channel,
      model,
      {
        endpointType: endpointType.value || undefined,
        stream: stream.value,
      },
      signal
    )
    if (signal.aborted) return
    states.value[model] = result.ok
      ? { status: 'success', timeMs: result.timeMs }
      : { status: 'failed', message: result.message }
  } catch {
    // Aborted (modal closed): leave the row untested.
    if (states.value[model]?.status === 'running') {
      states.value[model] = { status: 'idle' }
    }
  }
}

function testSingle(model: string) {
  if (testingAll.value || states.value[model]?.status === 'running') return
  void runModelTest(model)
}

async function testBatch() {
  if (testingAll.value || batchTargets.value.length === 0) return
  const targets = [...batchTargets.value]
  testingAll.value = true
  batchDone.value = 0
  try {
    for (let start = 0; start < targets.length; start += TEST_BATCH_SIZE) {
      if (!abortController || abortController.signal.aborted) return
      const batch = targets.slice(start, start + TEST_BATCH_SIZE)
      await Promise.all(batch.map((model) => runModelTest(model)))
      batchDone.value = Math.min(start + batch.length, targets.length)
    }
  } finally {
    testingAll.value = false
    batchDone.value = 0
  }
}

// ── Remove failed models (two-step confirm) ────────────────────────────────
async function removeFailed() {
  const channel = props.channel
  if (!channel || !props.canWrite || removing.value) return
  if (failedModels.value.length === 0) return
  if (!removeArmed.value) {
    removeArmed.value = true
    window.clearTimeout(removeArmTimer)
    removeArmTimer = window.setTimeout(() => {
      removeArmed.value = false
    }, REMOVE_ARM_TIMEOUT_MS)
    return
  }
  window.clearTimeout(removeArmTimer)
  removeArmed.value = false
  removing.value = true
  try {
    const removedModels = [...failedModels.value]
    if (await props.removeModels(channel, removedModels)) {
      const removed = new Set(removedModels)
      models.value = models.value.filter((model) => !removed.has(model))
      selected.value = selected.value.filter((model) => !removed.has(model))
      removedModels.forEach((model) => delete states.value[model])
    }
  } finally {
    removing.value = false
  }
}

// ── Presentation helpers ───────────────────────────────────────────────────
function statusTone(
  status: ModelTestStatus
): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

function statusLabel(status: ModelTestStatus): string {
  if (status === 'success') return t('channels.testStatusSuccess')
  if (status === 'failed') return t('channels.testStatusFailed')
  if (status === 'running') return t('channels.testStatusRunning')
  return t('channels.testStatusIdle')
}

function modelState(model: string): ModelTestState {
  return states.value[model] ?? { status: 'idle' }
}

const endpointOptions = computed(() => [...CHANNEL_TEST_ENDPOINT_OPTIONS])

const modalTitle = computed(() =>
  t('channels.testModalTitle', { name: props.channel?.name ?? '' })
)

function close() {
  emit('close')
}
</script>

<template>
  <ConsoleModal :open="open" :title="modalTitle" size="xl" @close="close">
    <div class="space-y-5 text-left">
      <!-- ══ 测试配置 ══════════════════════════════════════════════════ -->
      <section class="channel-test-config">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
              {{ t('channels.endpointTypeLabel') }}
            </p>
            <FilterSelect
              v-model="endpointType"
              :options="endpointOptions"
              :label="t('channels.endpointTypeLabel')"
              :placeholder="t('channels.endpointTypeAuto')"
            />
            <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
              {{ t('channels.endpointTypeHint') }}
            </p>
          </div>
          <div>
            <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
              {{ t('channels.streamMode') }}
            </p>
            <div class="flex h-10 items-center gap-3">
              <button
                type="button"
                role="switch"
                :aria-checked="stream"
                :aria-label="t('channels.streamMode')"
                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-ring"
                :class="
                  stream
                    ? 'bg-[var(--accent)]'
                    : 'bg-[var(--surface-muted)] border border-[var(--border-subtle)]'
                "
                @click="stream = !stream"
              >
                <span
                  class="inline-block h-4 w-4 rounded-full bg-white shadow transition-transform"
                  :class="stream ? 'translate-x-6' : 'translate-x-1'"
                />
              </button>
              <span class="text-sm text-[var(--text-secondary)]">
                {{
                  stream
                    ? t('channels.streamEnabled')
                    : t('channels.streamDisabled')
                }}
              </span>
            </div>
            <p class="mt-1.5 text-xs text-[var(--text-tertiary)]">
              {{ t('channels.streamHint') }}
            </p>
          </div>
        </div>
      </section>

      <!-- ══ 渠道模型 ══════════════════════════════════════════════════ -->
      <section>
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p class="text-sm font-semibold text-[var(--text-primary)]">
              {{ t('channels.testModelsTitle') }}
            </p>
            <p class="text-xs text-[var(--text-tertiary)]">
              {{ t('channels.testModelsDesc') }}
            </p>
          </div>
          <SearchInput
            v-model="filter"
            :placeholder="t('channels.filterModelsPlaceholder')"
            :aria-label="t('channels.filterModelsPlaceholder')"
            name="channel-test-model-filter"
            class="w-full sm:w-60"
          />
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <ConsoleButton
            size="sm"
            :disabled="batchTargets.length === 0 || testingAll"
            @click="testBatch"
          >
            <LoaderCircle
              v-if="testingAll"
              :size="14"
              class="relative z-[1] shrink-0 animate-spin overflow-visible"
              data-channel-model-test-spinner
            />
            <Activity v-else :size="14" class="relative z-[1] shrink-0" />
            <span class="relative z-[1] tabular-nums">
              {{
                testingAll
                  ? `${batchDone}/${batchTargets.length}`
                  : selected.length > 0
                    ? t('channels.testSelectedModels', {
                        count: selected.length,
                      })
                    : t('channels.testAllModels', {
                        count: filteredModels.length,
                      })
              }}
            </span>
          </ConsoleButton>
          <ConsoleButton
            variant="secondary"
            size="sm"
            :disabled="successModels.length === 0"
            @click="selectSuccessModels"
          >
            <CircleCheckBig :size="14" />
            {{
              t('channels.selectSuccessModels', {
                count: successModels.length,
              })
            }}
          </ConsoleButton>
          <ConsoleButton
            v-if="canWrite"
            variant="secondary"
            size="sm"
            :disabled="failedModels.length === 0 || removing"
            :class="
              removeArmed
                ? '!border-[var(--status-danger)] !text-[var(--status-danger-text)]'
                : ''
            "
            @click="removeFailed"
          >
            <LoaderCircle v-if="removing" :size="14" class="animate-spin" />
            <Trash2 v-else :size="14" />
            {{
              removeArmed
                ? t('channels.removeFailedConfirm', {
                    count: failedModels.length,
                  })
                : t('channels.removeFailedModels', {
                    count: failedModels.length,
                  })
            }}
          </ConsoleButton>
        </div>

        <div class="channel-test-table-wrap subtle-scroll mt-3">
          <table class="w-full min-w-[720px] text-sm">
            <thead>
              <tr class="channel-test-head-row">
                <th class="w-9 px-3 py-2">
                  <input
                    type="checkbox"
                    class="checkbox-round"
                    :checked="allFilteredSelected"
                    :disabled="filteredModels.length === 0"
                    :aria-label="t('channels.selectPage')"
                    @change="toggleAllFiltered"
                  />
                </th>
                <th class="px-2 py-2 text-left">
                  <button
                    type="button"
                    class="inline-flex items-center gap-1 font-medium focus-ring"
                    @click="cycleSortOrder"
                  >
                    {{ t('channels.testModelColumn') }}
                    <ArrowUpAZ v-if="sortOrder === 'asc'" :size="13" />
                    <ArrowDownAZ v-else-if="sortOrder === 'desc'" :size="13" />
                    <ArrowUpDown
                      v-else
                      :size="13"
                      class="text-[var(--text-tertiary)]"
                    />
                  </button>
                </th>
                <th class="w-24 px-2 py-2 text-left">
                  {{ t('channels.testStatusColumn') }}
                </th>
                <th class="px-2 py-2 text-left">
                  {{ t('channels.testResultColumn') }}
                </th>
                <th class="w-16 px-3 py-2 text-right">
                  {{ t('channels.actions') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="model in pagedModels"
                :key="model"
                class="channel-test-row"
              >
                <td class="px-3 py-2.5">
                  <input
                    type="checkbox"
                    class="checkbox-round"
                    :checked="selected.includes(model)"
                    :aria-label="model"
                    @change="toggleModelSelected(model)"
                  />
                </td>
                <td class="px-2 py-2.5">
                  <span
                    class="block max-w-[220px] truncate font-medium text-[var(--text-primary)]"
                    :title="model"
                  >
                    {{ model }}
                  </span>
                </td>
                <td class="px-2 py-2.5">
                  <StatusChip :tone="statusTone(modelState(model).status)">
                    {{ statusLabel(modelState(model).status) }}
                  </StatusChip>
                </td>
                <td class="px-2 py-2.5">
                  <span
                    v-if="modelState(model).status === 'success'"
                    class="text-xs tabular-nums text-[var(--status-success-text)]"
                  >
                    {{
                      t('channels.testResultMs', {
                        ms: modelState(model).timeMs ?? 0,
                      })
                    }}
                  </span>
                  <span
                    v-else-if="modelState(model).status === 'failed'"
                    class="block max-w-[300px] truncate text-xs text-[var(--status-danger-text)]"
                    :title="modelState(model).message"
                  >
                    {{ modelState(model).message }}
                  </span>
                  <span v-else class="text-xs text-[var(--text-tertiary)]">
                    -
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <IconButton
                    :label="t('channels.testModelAction', { model })"
                    :disabled="
                      testingAll || modelState(model).status === 'running'
                    "
                    class="h-7 w-7"
                    @click="testSingle(model)"
                  >
                    <LoaderCircle
                      v-if="modelState(model).status === 'running'"
                      :size="14"
                      class="relative z-[1] shrink-0 animate-spin overflow-visible"
                      data-channel-model-row-spinner
                    />
                    <Activity v-else :size="14" />
                  </IconButton>
                </td>
              </tr>
              <tr v-if="pagedModels.length === 0">
                <td
                  colspan="5"
                  class="px-3 py-8 text-center text-sm text-[var(--text-tertiary)]"
                >
                  {{ t('common.noResults') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <template #footer>
      <TablePagination
        v-model:page="page"
        v-model:page-size="pageSize"
        :total="filteredModels.length"
        :page-sizes="[5, 10, 30, 50]"
        variant="modal-footer"
      >
        <template #actions>
          <ConsoleButton
            variant="secondary"
            size="md"
            data-channel-test-close
            @click="close"
          >
            {{ t('common.close') }}
          </ConsoleButton>
        </template>
      </TablePagination>
    </template>
  </ConsoleModal>
</template>

<style scoped>
.channel-test-config {
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--border-subtle);
}
.channel-test-table-wrap {
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  overflow-x: auto;
}
.channel-test-head-row {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-table-header);
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.channel-test-row {
  border-bottom: 1px solid var(--border-subtle);
}
.channel-test-row:last-child {
  border-bottom: none;
}
.channel-test-row:hover {
  background: var(--surface-muted);
}
</style>
