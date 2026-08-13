<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import {
  adminChannelStatusLabelKey,
  adminChannelStatusTone,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import type { AdminChannel } from '@/types/console'

const props = defineProps<{
  open: boolean
  supplier: string
  channels: AdminChannel[]
}>()

const emit = defineEmits<{
  close: []
  confirm: [channel: AdminChannel]
}>()

const { t } = useI18n()
const pickedId = ref<number | null>(null)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    // Preselect when the group has exactly one channel.
    pickedId.value = props.channels.length === 1 ? props.channels[0]!.id : null
  },
  { immediate: true }
)

const picked = computed(
  () => props.channels.find((channel) => channel.id === pickedId.value) ?? null
)

function modelCount(channel: AdminChannel): number {
  return channel.models.split(',').filter((model) => model.trim()).length
}

function confirm() {
  if (picked.value) emit('confirm', picked.value)
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
      <div
        class="subtle-scroll max-h-80 space-y-2 overflow-y-auto"
        role="radiogroup"
        :aria-label="t('channels.pickChannelTitle')"
      >
        <label
          v-for="channel in channels"
          :key="channel.id"
          class="channel-pick-row"
          :class="pickedId === channel.id ? 'channel-pick-row--active' : ''"
        >
          <input
            v-model="pickedId"
            type="radio"
            name="channel-test-pick"
            class="accent-[var(--accent)]"
            :value="channel.id"
          />
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
            <span class="block text-xs text-[var(--text-tertiary)]">
              {{
                t('channels.pickChannelModels', { count: modelCount(channel) })
              }}
            </span>
          </span>
          <StatusChip :tone="adminChannelStatusTone(channel.status)">
            {{ t(adminChannelStatusLabelKey(channel.status)) }}
          </StatusChip>
        </label>
      </div>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton variant="secondary" size="lg" @click="emit('close')">
          {{ t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton size="lg" :disabled="!picked" @click="confirm">
          {{ t('channels.pickChannelStart') }}
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
  cursor: pointer;
  transition:
    border-color 0.15s,
    background-color 0.15s;
}
.channel-pick-row:hover {
  background: var(--surface-muted);
}
.channel-pick-row--active {
  border-color: var(--border-strong);
  background: var(--accent-soft);
}
</style>
