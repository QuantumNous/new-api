<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import { marketSources } from '@/constants/console'
import type { MyChannel, TokenChannel, TokenSummary } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import IconButton from '@/components/common/IconButton.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  open: boolean
  token: TokenSummary | null
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

/** Working copy — committed only on save. */
const channels = ref<TokenChannel[]>([])
const loadBalance = ref(false)
const saving = ref(false)

/** Manual tokens can also use the user's active marketplace channels. */
const myChannels = ref<MyChannel[]>([])

const readonly = computed(() => props.token?.type === 'auto')

watch(
  () => props.open,
  async (open) => {
    if (!open || !props.token) return
    channels.value = props.token.channels.map((c) => ({ ...c }))
    loadBalance.value = props.token.load_balance
    if (props.token.type === 'manual') {
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
  }
)

/** Manual tokens combine official and user-added active channels. */
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
  if (idx >= 0) channels.value.splice(idx, 1)
  else channels.value.push({ name, enabled: true })
}

function removeChannel(index: number) {
  channels.value.splice(index, 1)
}

/* ---- HTML5 drag-sort: array order = routing priority ---- */
const dragIndex = ref<number | null>(null)

function onDragStart(index: number, event: DragEvent) {
  if (readonly.value) return
  dragIndex.value = index
  // Firefox needs data set for the drag to start.
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
  <ConsoleModal
    :open="open && token != null"
    :title="`${t('keys.channels.title')} · ${token?.name ?? ''}`"
    size="lg"
    @close="emit('close')"
  >
    <div v-if="token" class="space-y-5 text-left">
      <!-- auto tokens: system-computed, locked -->
      <div
        v-if="readonly"
        class="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]"
      >
        <svg
          width="15"
          height="15"
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

      <!-- candidate pool: dot-matrix rectangle picker -->
      <div v-if="!readonly">
        <h3 class="mb-2 text-sm font-medium text-[var(--text-secondary)]">
          {{ t('keys.channels.candidates') }}
        </h3>
        <div
          class="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="group"
          :aria-label="t('keys.channels.candidates')"
        >
          <button
            v-for="name in candidates"
            :key="name"
            type="button"
            role="checkbox"
            :aria-checked="selectedNames.has(name)"
            class="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-ring"
            :class="
              selectedNames.has(name)
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-solid)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]'
            "
            @click="toggleCandidate(name)"
          >
            <span
              class="grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border"
              :class="
                selectedNames.has(name)
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : 'border-[var(--border-strong)]'
              "
            >
              <svg
                v-if="selectedNames.has(name)"
                width="10"
                height="10"
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

      <!-- selected channels: drag to reorder, order = priority -->
      <div>
        <div class="mb-2 flex items-center justify-between">
          <h3 class="text-sm font-medium text-[var(--text-secondary)]">
            {{ t('keys.channels.priority') }}
          </h3>
          <span
            v-if="!readonly && channels.length > 1"
            class="text-xs text-[var(--text-tertiary)]"
          >
            {{ t('keys.channels.dragHint') }}
          </span>
        </div>

        <p
          v-if="channels.length === 0"
          class="rounded-xl border border-dashed border-[var(--border-subtle)] py-8 text-center text-sm text-[var(--text-tertiary)]"
        >
          {{ t('keys.channels.empty') }}
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="(c, i) in channels"
            :key="c.name"
            :draggable="!readonly"
            class="flex items-center gap-3 rounded-xl border bg-[var(--surface-solid)] px-3 py-2.5 transition-colors"
            :class="
              dragIndex === i
                ? 'border-[var(--accent)] opacity-60'
                : 'border-[var(--border-subtle)]'
            "
            @dragstart="onDragStart(i, $event)"
            @dragover.prevent="onDragOver(i)"
            @dragend="onDragEnd"
          >
            <span
              v-if="!readonly"
              class="cursor-grab text-[var(--text-tertiary)] active:cursor-grabbing"
              aria-hidden="true"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <circle cx="9" cy="6" r="1.6" />
                <circle cx="15" cy="6" r="1.6" />
                <circle cx="9" cy="12" r="1.6" />
                <circle cx="15" cy="12" r="1.6" />
                <circle cx="9" cy="18" r="1.6" />
                <circle cx="15" cy="18" r="1.6" />
              </svg>
            </span>
            <span
              class="w-8 shrink-0 rounded-md bg-[var(--surface-muted)] py-0.5 text-center font-mono text-xs font-semibold text-[var(--text-secondary)]"
            >
              #{{ i + 1 }}
            </span>
            <span
              class="min-w-0 flex-1 truncate text-sm font-medium text-[var(--text-primary)]"
            >
              {{ c.name }}
            </span>
            <span
              v-if="loadBalance && c.weight != null"
              class="shrink-0 font-mono text-xs text-[var(--text-tertiary)]"
            >
              ×{{ c.weight }}
            </span>
            <ConsoleToggle
              v-model="c.enabled"
              :disabled="readonly"
              :label="c.name"
            />
            <IconButton
              v-if="!readonly"
              :label="t('keys.channels.remove')"
              tone="danger"
              @click="removeChannel(i)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </IconButton>
          </li>
        </ul>
      </div>

      <!-- load balancing -->
      <label
        v-if="!readonly"
        class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3"
      >
        <ConsoleToggle
          v-model="loadBalance"
          :label="t('keys.channels.loadBalance')"
        />
        <span class="text-sm text-[var(--text-primary)]">{{
          t('keys.channels.loadBalance')
        }}</span>
        <span class="text-xs text-[var(--text-tertiary)]">{{
          t('keys.channels.loadBalanceHint')
        }}</span>
      </label>
    </div>

    <template #footer>
      <ConsoleButton
        v-if="!readonly"
        size="lg"
        block
        :loading="saving"
        @click="save"
      >
        {{ t('common.confirm') }}
      </ConsoleButton>
      <ConsoleButton
        v-else
        size="lg"
        block
        variant="secondary"
        @click="emit('close')"
      >
        {{ t('common.cancel') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>
</template>
