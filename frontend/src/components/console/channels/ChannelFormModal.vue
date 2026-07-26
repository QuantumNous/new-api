<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import VendorLogo from '@/components/console/models/VendorLogo.vue'
import {
  ADMIN_CHANNEL_TYPE_META,
  adminChannelTypeMeta,
} from '@/constants/adminChannels'
import type {
  AdminChannel,
  AdminChannelCreateInput,
  AdminChannelUpdateInput,
} from '@/types/console'

const props = defineProps<{
  open: boolean
  editing: AdminChannel | null
  save: (
    input: AdminChannelCreateInput | AdminChannelUpdateInput
  ) => Promise<boolean>
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const saving = ref(false)
const form = reactive({
  name: '',
  type: '1',
  status: 1 as 1 | 2,
  priority: 0,
  weight: 0,
  capacityTotal: 20,
  channelRatio: 1,
})

const typeOptions = computed(() =>
  Object.entries(ADMIN_CHANNEL_TYPE_META)
    .map(([value, meta]) => ({ value, label: meta.label }))
    .sort((left, right) => left.label.localeCompare(right.label))
)

const selectedType = computed(() => Number(form.type))
const supplier = computed(
  () => adminChannelTypeMeta(selectedType.value).supplier
)
const minimumCapacity = computed(() =>
  Math.max(1, props.editing?.capacity_used ?? 1)
)
const valid = computed(
  () =>
    form.name.trim().length > 0 &&
    Number.isSafeInteger(selectedType.value) &&
    Object.hasOwn(ADMIN_CHANNEL_TYPE_META, selectedType.value) &&
    Number.isSafeInteger(form.priority) &&
    form.priority >= 0 &&
    form.priority <= 1_000_000 &&
    Number.isSafeInteger(form.weight) &&
    form.weight >= 0 &&
    form.weight <= 1_000_000 &&
    Number.isSafeInteger(form.capacityTotal) &&
    form.capacityTotal >= minimumCapacity.value &&
    form.capacityTotal <= 1_000_000 &&
    Number.isFinite(form.channelRatio) &&
    form.channelRatio >= 0
)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const channel = props.editing
    form.name = channel?.name ?? ''
    form.type = String(channel?.type ?? 1)
    form.status = channel?.status === 2 ? 2 : 1
    form.priority = channel?.priority ?? 0
    form.weight = channel?.weight ?? 0
    form.capacityTotal = channel?.capacity_total ?? 20
    form.channelRatio = channel?.channel_ratio ?? 1
  },
  { immediate: true }
)

function close() {
  if (!saving.value) emit('close')
}

async function submit() {
  if (!valid.value || saving.value) return
  saving.value = true
  try {
    const base: AdminChannelUpdateInput = {
      name: form.name.trim(),
      type: selectedType.value,
      priority: Number(form.priority),
      weight: Number(form.weight),
      capacity_total: Number(form.capacityTotal),
      channel_ratio: Number(form.channelRatio),
    }
    const input: AdminChannelCreateInput | AdminChannelUpdateInput =
      props.editing === null ? { ...base, status: form.status } : base
    if (await props.save(input)) emit('close')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <ConsoleModal
    :open="open"
    :title="editing ? t('channels.editTitle') : t('channels.createTitle')"
    size="lg"
    @close="close"
  >
    <div class="space-y-5 text-left">
      <FormField :label="t('channels.channelName')">
        <TextInput
          v-model="form.name"
          name="admin-channel-name"
          :placeholder="t('channels.channelNamePlaceholder')"
          autocomplete="off"
        />
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
            {{ t('channels.type') }}
          </p>
          <FilterSelect
            v-model="form.type"
            :options="typeOptions"
            :label="t('channels.type')"
            class="w-full"
          />
        </div>
        <div>
          <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
            {{ t('channels.supplier') }}
          </p>
          <div
            class="flex h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3"
          >
            <VendorLogo :vendor="supplier" :size="24" />
            <span
              class="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]"
            >
              {{ supplier }}
            </span>
            <span class="text-[10px] text-[var(--text-tertiary)]">
              {{ t('channels.supplierPreview') }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="editing === null">
        <p class="mb-1.5 text-sm font-medium text-[var(--text-secondary)]">
          {{ t('channels.status') }}
        </p>
        <div
          class="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-muted)] p-1"
          role="radiogroup"
          :aria-label="t('channels.status')"
        >
          <button
            v-for="option in [
              { value: 1 as const, label: t('channels.statusEnabled') },
              { value: 2 as const, label: t('channels.statusDisabled') },
            ]"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="form.status === option.value"
            class="h-9 rounded-lg text-sm font-medium transition-colors focus-ring"
            :class="
              form.status === option.value
                ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
            "
            @click="form.status = option.value"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField :label="t('channels.priority')">
          <input
            v-model.number="form.priority"
            type="number"
            min="0"
            max="1000000"
            step="1"
            name="admin-channel-priority"
            :aria-label="t('channels.priority')"
            class="channel-form-number focus-ring"
          />
        </FormField>
        <FormField :label="t('channels.weight')">
          <input
            v-model.number="form.weight"
            type="number"
            min="0"
            max="1000000"
            step="1"
            name="admin-channel-weight"
            :aria-label="t('channels.weight')"
            class="channel-form-number focus-ring"
          />
        </FormField>
        <FormField :label="t('channels.capacityTotal')">
          <input
            v-model.number="form.capacityTotal"
            type="number"
            :min="minimumCapacity"
            max="1000000"
            step="1"
            name="admin-channel-capacity"
            :aria-label="t('channels.capacityTotal')"
            class="channel-form-number focus-ring"
          />
        </FormField>
        <FormField :label="t('channels.channelRatio')">
          <div class="relative">
            <input
              v-model.number="form.channelRatio"
              type="number"
              min="0"
              step="0.01"
              name="admin-channel-ratio"
              :aria-label="t('channels.channelRatio')"
              class="channel-form-number pr-10 focus-ring"
            />
            <span
              class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--text-tertiary)]"
              aria-hidden="true"
              >×</span
            >
          </div>
        </FormField>
      </div>
    </div>

    <template #footer>
      <div class="grid grid-cols-2 gap-3">
        <ConsoleButton
          variant="secondary"
          size="lg"
          :disabled="saving"
          @click="close"
        >
          {{ t('common.cancel') }}
        </ConsoleButton>
        <ConsoleButton
          size="lg"
          :loading="saving"
          :disabled="!valid"
          @click="submit"
        >
          {{ t('channels.saveChannel') }}
        </ConsoleButton>
      </div>
    </template>
  </ConsoleModal>
</template>

<style scoped>
.channel-form-number {
  width: 100%;
  height: 2.75rem;
  border: 1px solid var(--border-subtle);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  padding: 0 1rem;
  color: var(--text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  outline: none;
}

.channel-form-number:focus {
  border-color: var(--border-strong);
}
</style>
