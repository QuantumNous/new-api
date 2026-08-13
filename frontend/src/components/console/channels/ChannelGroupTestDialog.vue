<script setup lang="ts">
import { Activity, LoaderCircle } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import type {
  ChannelModelTestOptions,
  ChannelModelTestResult,
} from '@/composables/useAdminChannels'
import { adminChannelTypeMeta } from '@/constants/adminChannels'
import type { AdminChannel } from '@/types/console'

type ResultStatus = 'idle' | 'running' | 'success' | 'failed'

interface ChannelResultRow {
  channel: AdminChannel
  status: ResultStatus
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

const filter = ref('')
const pickedModel = ref<string | null>(null)
const testing = ref(false)
const resultsModel = ref('')
const results = ref<ChannelResultRow[]>([])
let abortController: AbortController | null = null

watch(
  () => props.open,
  (open) => {
    abortController?.abort()
    if (!open) return
    abortController = new AbortController()
    filter.value = ''
    pickedModel.value = null
    testing.value = false
    resultsModel.value = ''
    results.value = []
  },
  { immediate: true }
)

onBeforeUnmount(() => abortController?.abort())

/** Model union across the group: model -> channels that publish it. */
const modelEntries = computed<
  Array<{ model: string; channels: AdminChannel[] }>
>(() => {
  const map = new Map<string, AdminChannel[]>()
  for (const channel of props.channels) {
    for (const raw of channel.models.split(',')) {
      const model = raw.trim()
      if (!model) continue
      const existing = map.get(model)
      if (existing) {
        if (!existing.includes(channel)) existing.push(channel)
      } else {
        map.set(model, [channel])
      }
    }
  }
  return Array.from(map, ([model, channels]) => ({ model, channels })).sort(
    (a, b) => a.model.localeCompare(b.model)
  )
})

const filteredEntries = computed(() => {
  const query = filter.value.trim().toLowerCase()
  if (!query) return modelEntries.value
  return modelEntries.value.filter((entry) =>
    entry.model.toLowerCase().includes(query)
  )
})

const pickedChannels = computed(
  () =>
    modelEntries.value.find((entry) => entry.model === pickedModel.value)
      ?.channels ?? []
)

const testedCount = computed(
  () =>
    results.value.filter(
      (row) => row.status === 'success' || row.status === 'failed'
    ).length
)

async function startTest() {
  const model = pickedModel.value
  const signal = abortController?.signal
  if (!model || testing.value || !signal || signal.aborted) return
  const targets = [...pickedChannels.value]
  if (targets.length === 0) return

  testing.value = true
  resultsModel.value = model
  results.value = targets.map((channel) => ({ channel, status: 'idle' }))
  try {
    for (let start = 0; start < targets.length; start += TEST_BATCH_SIZE) {
      if (signal.aborted) return
      const batch = results.value.slice(start, start + TEST_BATCH_SIZE)
      batch.forEach((row) => (row.status = 'running'))
      await Promise.all(
        batch.map(async (row) => {
          try {
            const result = await props.testModel(row.channel, model, {}, signal)
            if (signal.aborted) return
            if (result.ok) {
              row.status = 'success'
              row.timeMs = result.timeMs
            } else {
              row.status = 'failed'
              row.message = result.message
            }
          } catch {
            // Aborted (dialog closed): leave the row unresolved.
            if (row.status === 'running') row.status = 'idle'
          }
        })
      )
    }
  } finally {
    testing.value = false
  }
}

function statusTone(
  status: ResultStatus
): 'neutral' | 'success' | 'danger' | 'warning' {
  if (status === 'success') return 'success'
  if (status === 'failed') return 'danger'
  if (status === 'running') return 'warning'
  return 'neutral'
}

function statusLabel(status: ResultStatus): string {
  if (status === 'success') return t('channels.testStatusSuccess')
  if (status === 'failed') return t('channels.testStatusFailed')
  if (status === 'running') return t('channels.testStatusRunning')
  return t('channels.testStatusIdle')
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="t('channels.pickModelTitle')"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <!-- ══ 模型单选 ══════════════════════════════════════════════════ -->
      <section class="channel-group-test-section">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ t('channels.pickModelDesc', { supplier }) }}
          </p>
          <SearchInput
            v-model="filter"
            :placeholder="t('channels.filterModelsPlaceholder')"
            :aria-label="t('channels.filterModelsPlaceholder')"
            name="channel-group-test-filter"
            class="w-full sm:w-60"
          />
        </div>

        <div
          class="subtle-scroll mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1"
          role="radiogroup"
          :aria-label="t('channels.pickModelTitle')"
        >
          <label
            v-for="entry in filteredEntries"
            :key="entry.model"
            class="channel-group-model-row"
            :class="
              pickedModel === entry.model
                ? 'channel-group-model-row--active'
                : ''
            "
          >
            <input
              v-model="pickedModel"
              type="radio"
              name="channel-group-test-model"
              class="accent-[var(--accent)]"
              :value="entry.model"
            />
            <span
              class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]"
              :title="entry.model"
            >
              {{ entry.model }}
            </span>
            <span class="shrink-0 text-xs text-[var(--text-tertiary)]">
              {{
                t('channels.pickModelChannels', {
                  count: entry.channels.length,
                })
              }}
            </span>
          </label>
          <p
            v-if="filteredEntries.length === 0"
            class="px-2 py-6 text-center text-sm text-[var(--text-tertiary)]"
          >
            {{ t('common.noResults') }}
          </p>
        </div>
      </section>

      <!-- ══ 测试结果 ══════════════════════════════════════════════════ -->
      <section v-if="results.length > 0" class="channel-group-test-section">
        <p class="text-sm font-semibold text-[var(--text-primary)]">
          {{ t('channels.pickModelResults', { model: resultsModel }) }}
        </p>
        <div class="channel-group-result-wrap mt-3">
          <table class="w-full text-sm">
            <thead>
              <tr class="channel-group-result-head">
                <th class="px-3 py-2 text-left">
                  {{ t('channels.testChannelColumn') }}
                </th>
                <th class="w-24 px-2 py-2 text-left">
                  {{ t('channels.testStatusColumn') }}
                </th>
                <th class="px-2 py-2 text-left">
                  {{ t('channels.testResultColumn') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in results"
                :key="row.channel.id"
                class="channel-group-result-row"
              >
                <td class="px-3 py-2.5">
                  <span class="flex min-w-0 items-center gap-2">
                    <VendorLogo
                      :vendor="adminChannelTypeMeta(row.channel.type).supplier"
                      :size="20"
                    />
                    <span
                      class="truncate font-medium text-[var(--text-primary)]"
                      :title="row.channel.name"
                    >
                      {{ row.channel.name }}
                    </span>
                  </span>
                </td>
                <td class="px-2 py-2.5">
                  <StatusChip :tone="statusTone(row.status)">
                    {{ statusLabel(row.status) }}
                  </StatusChip>
                </td>
                <td class="px-2 py-2.5">
                  <span
                    v-if="row.status === 'success'"
                    class="text-xs tabular-nums text-[var(--status-success-text)]"
                  >
                    {{ t('channels.testResultMs', { ms: row.timeMs ?? 0 }) }}
                  </span>
                  <span
                    v-else-if="row.status === 'failed'"
                    class="block max-w-[320px] truncate text-xs text-[var(--status-danger-text)]"
                    :title="row.message"
                  >
                    {{ row.message }}
                  </span>
                  <span v-else class="text-xs text-[var(--text-tertiary)]">
                    -
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="emit('close')">
          {{ t('common.close') }}
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
              ? `${testedCount}/${results.length}`
              : t('channels.pickModelStart')
          }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>

<style scoped>
/* Same card family as the channel form/test modals (token-driven themes). */
.channel-group-test-section {
  padding: 1rem 1.125rem 1.125rem;
  border: 1px solid var(--border-subtle);
  border-radius: 1rem;
  background: var(--surface-muted);
}
.channel-group-model-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.875rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}
.channel-group-model-row:hover {
  background: var(--surface-hover);
}
.channel-group-model-row--active {
  border-color: var(--border-strong);
  background: var(--accent-soft);
}
.channel-group-result-wrap {
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  overflow: hidden;
}
.channel-group-result-head {
  border-bottom: 1px solid var(--border-subtle);
  background: var(--surface-table-header);
  font-size: 0.75rem;
  color: var(--text-secondary);
}
.channel-group-result-row {
  border-bottom: 1px solid var(--border-subtle);
}
.channel-group-result-row:last-child {
  border-bottom: none;
}
</style>
