<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { marketSources } from '@/constants/console'
import type { MyChannel, TokenChannel, TokenSummary } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import IconButton from '@/components/common/IconButton.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  token: TokenSummary | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

const channels = ref<TokenChannel[]>([])
const loadBalance = ref(false)
const saving = ref(false)
const showAdd = ref(false)
const myChannels = ref<MyChannel[]>([])

const readonly = computed(() => props.token?.type === 'auto')

/** Distribute 100% equally across channels (integer, remainder to the first slot). */
function distributeWeights() {
  const n = channels.value.length
  if (n === 0) return
  const base = Math.floor(100 / n)
  const remainder = 100 - base * n
  channels.value.forEach((c, i) => {
    c.weight = base + (i < remainder ? 1 : 0)
  })
}

/** When load balance is toggled on, recalculate equal integer weights summing to 100. */
watch(loadBalance, (enabled) => {
  if (enabled) distributeWeights()
})

watch(
  () => props.token,
  async (token) => {
    if (!token) return
    channels.value = token.channels.map((c) => ({ ...c }))
    loadBalance.value = token.load_balance
    showAdd.value = false
    if (token.type === 'manual') {
      try {
        const data = await api.get<{ channels: MyChannel[] }>(
          '/api/market/my-channels'
        )
        myChannels.value = data.channels
      } catch (error) {
        myChannels.value = []
        toast.error(
          error instanceof ApiError ? error.message : t('common.failed')
        )
      }
    } else {
      myChannels.value = []
    }
  },
  { immediate: true }
)

const candidates = computed<string[]>(() => {
  if (!props.token || readonly.value) return []
  return [
    ...new Set(
      marketSources.concat(
        myChannels.value
          .filter((c) => c.status === 'active')
          .map((c) => c.merchantName)
      )
    ),
  ]
})

const selectedNames = computed(() => new Set(channels.value.map((c) => c.name)))

function toggleCandidate(name: string) {
  if (readonly.value) return
  const idx = channels.value.findIndex((c) => c.name === name)
  if (idx >= 0) {
    channels.value.splice(idx, 1)
  } else {
    channels.value.push({ name, enabled: true })
  }
  if (loadBalance.value) distributeWeights()
}

function removeChannel(index: number) {
  channels.value.splice(index, 1)
  if (loadBalance.value) distributeWeights()
}

/** Change a channel's weight by delta, clamped to [0, 100]. */
function stepWeight(index: number, delta: number) {
  const c = channels.value[index]
  if (c.weight === undefined) c.weight = 1
  c.weight = Math.max(0, Math.min(100, c.weight + delta))
}

/* ---- HTML5 drag-sort ---- */
const dragIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  dragIndex.value = index
  event.dataTransfer?.setData('text/plain', String(index))
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(index: number) {
  if (dragIndex.value === null || dragIndex.value === index) return
  const [moved] = channels.value.splice(dragIndex.value, 1)
  channels.value.splice(index, 0, moved)
  dragIndex.value = index
}

function onDragEnd() {
  dragIndex.value = null
}

async function save() {
  if (!props.token || saving.value) return
  saving.value = true
  try {
    await api.put(`/api/token/${props.token.id}`, {
      channels: channels.value,
      load_balance: loadBalance.value,
    })
    toast.success(t('keys.channels.saved'))
    emit('saved')
    emit('close')
  } catch (error) {
    toast.error(error instanceof ApiError ? error.message : String(error))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="token"
    class="flex max-h-[65vh] flex-col rounded-t-2xl border border-[var(--border-default)] bg-[var(--surface-solid)] shadow-2xl"
  >
    <!-- unified header: drag handle + title in one accent band -->
    <div
      class="flex shrink-0 flex-col rounded-t-2xl border-b border-[var(--border-subtle)] bg-[var(--accent-soft)]"
    >
      <!-- drag handle pill -->
      <div class="flex justify-center pt-2.5 pb-1.5" aria-hidden="true">
        <span class="h-1 w-10 rounded-full bg-[var(--accent)] opacity-30" />
      </div>
      <!-- title row -->
      <div class="flex items-center gap-3 px-5 pb-3">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="shrink-0"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
          <circle cx="20" cy="6" r="2" fill="var(--accent)" stroke="none" />
          <circle cx="4" cy="12" r="2" fill="var(--accent)" stroke="none" />
          <circle cx="20" cy="18" r="2" fill="var(--accent)" stroke="none" />
        </svg>
        <span class="text-sm font-semibold text-[var(--accent-text)]">{{
          t('keys.channels.title')
        }}</span>
        <span class="text-xs text-[var(--accent-text)] opacity-50">·</span>
        <span class="min-w-0 truncate text-sm text-[var(--accent-text)]">{{
          token.name
        }}</span>
        <button
          type="button"
          class="ml-auto rounded-lg p-1 text-[var(--accent-text)] opacity-60 transition-opacity hover:opacity-100 focus-ring"
          :aria-label="t('common.cancel')"
          @click="emit('close')"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>

    <!-- scrollable body -->
    <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <!-- auto lock notice -->
      <div
        v-if="readonly"
        class="mb-4 flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="shrink-0"
        >
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {{ t('keys.channels.autoReadonly') }}
      </div>

      <!-- channel list -->
      <p
        v-if="channels.length === 0"
        class="rounded-xl border border-dashed border-[var(--border-subtle)] py-6 text-center text-sm text-[var(--text-tertiary)]"
      >
        {{ t('keys.channels.empty') }}
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="(c, i) in channels"
          :key="c.name"
          :draggable="!readonly"
          class="flex items-center gap-2 rounded-xl border bg-[var(--surface-solid)] px-3 py-2.5 transition-colors"
          :class="
            dragIndex === i
              ? 'border-[var(--accent)] bg-[var(--accent-soft)] opacity-60'
              : 'border-[var(--border-subtle)]'
          "
          @dragstart="onDragStart(i, $event)"
          @dragover.prevent="onDragOver(i)"
          @dragend="onDragEnd"
        >
          <!-- drag handle -->
          <span
            v-if="!readonly"
            class="cursor-grab text-[var(--text-tertiary)] active:cursor-grabbing"
            aria-hidden="true"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.6" />
              <circle cx="15" cy="6" r="1.6" />
              <circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" />
              <circle cx="9" cy="18" r="1.6" />
              <circle cx="15" cy="18" r="1.6" />
            </svg>
          </span>

          <!-- priority badge -->
          <span
            class="w-7 shrink-0 rounded bg-[var(--surface-muted)] py-0.5 text-center font-mono text-xs font-semibold text-[var(--text-secondary)]"
          >
            #{{ i + 1 }}
          </span>

          <!-- name -->
          <span
            class="min-w-0 flex-1 truncate text-sm text-[var(--text-primary)]"
            >{{ c.name }}</span
          >

          <!-- weight stepper (only when load-balance is on and not readonly) -->
          <div
            v-if="loadBalance && !readonly"
            class="flex shrink-0 items-center gap-0.5"
          >
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded-l-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-solid)] hover:text-[var(--text-primary)] disabled:opacity-40"
              :disabled="(c.weight ?? 1) <= 0"
              :aria-label="t('common.decreaseValue', { item: c.name })"
              @click="stepWeight(i, -5)"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M5 12h14" />
              </svg>
            </button>
            <span
              class="flex h-6 min-w-[3rem] items-center justify-center border-t border-b border-[var(--border-subtle)] bg-[var(--surface-solid)] font-mono text-xs font-medium text-[var(--text-primary)]"
            >
              {{ c.weight ?? 1 }}%
            </span>
            <button
              type="button"
              class="flex h-6 w-6 items-center justify-center rounded-r-md border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-solid)] hover:text-[var(--text-primary)] disabled:opacity-40"
              :disabled="(c.weight ?? 1) >= 100"
              :aria-label="t('common.increaseValue', { item: c.name })"
              @click="stepWeight(i, 5)"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>

          <!-- enable toggle -->
          <ConsoleToggle
            v-model="c.enabled"
            :disabled="readonly"
            :label="c.name"
          />

          <!-- delete -->
          <IconButton
            v-if="!readonly"
            :label="t('keys.channels.remove')"
            tone="danger"
            @click="removeChannel(i)"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
            </svg>
          </IconButton>
        </li>
      </ul>

      <!-- candidate picker (add channels) -->
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-96"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="opacity-100 max-h-96"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="showAdd && !readonly" class="mt-3 overflow-hidden">
          <div class="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
            <button
              v-for="name in candidates"
              :key="name"
              type="button"
              role="checkbox"
              :aria-checked="selectedNames.has(name)"
              class="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs transition-colors focus-ring"
              :class="
                selectedNames.has(name)
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-solid)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
              "
              @click="toggleCandidate(name)"
            >
              <span
                class="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border"
                :class="
                  selectedNames.has(name)
                    ? 'border-[var(--accent)] bg-[var(--accent)]'
                    : 'border-[var(--border-strong)]'
                "
              >
                <svg
                  v-if="selectedNames.has(name)"
                  width="8"
                  height="8"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent-contrast)"
                  stroke-width="3.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M4 12l5 5L20 6" />
                </svg>
              </span>
              <span class="truncate">{{ name }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>

    <!-- sticky footer -->
    <div
      class="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--surface-solid)] px-5 py-3"
    >
      <div class="flex flex-wrap items-center gap-3">
        <!-- load balance toggle -->
        <label
          v-if="!readonly"
          class="flex items-center gap-2 text-xs text-[var(--text-secondary)]"
        >
          <ConsoleToggle
            v-model="loadBalance"
            :label="t('keys.channels.loadBalance')"
          />
          {{ t('keys.channels.loadBalance') }}
          <span v-if="loadBalance" class="text-[var(--text-tertiary)]">
            · {{ t('keys.channels.loadBalanceHint') }}
          </span>
        </label>

        <div class="ml-auto flex items-center gap-2">
          <!-- add channels toggle button -->
          <button
            v-if="!readonly"
            type="button"
            class="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors focus-ring"
            :class="
              showAdd
                ? 'border-[var(--accent)] text-[var(--accent-text)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent-text)]'
            "
            @click="showAdd = !showAdd"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            {{ t('keys.channels.add') }}
          </button>

          <!-- save -->
          <ConsoleButton
            v-if="!readonly"
            size="sm"
            :loading="saving"
            @click="save"
          >
            {{ t('common.save') }}
          </ConsoleButton>

          <!-- close (readonly) -->
          <ConsoleButton
            v-else
            size="sm"
            variant="secondary"
            @click="emit('close')"
          >
            {{ t('common.cancel') }}
          </ConsoleButton>
        </div>
      </div>
    </div>
  </div>
</template>
