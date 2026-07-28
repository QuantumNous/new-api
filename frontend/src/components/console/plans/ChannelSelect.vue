<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import FilterSelect, {
  type SelectOption,
} from '@/components/common/FilterSelect.vue'
import type { AdminChannel, AdminChannelPage } from '@/types/console'

/** null = no exclusive channel. */
const model = defineModel<number | null>({ required: true })

const { t } = useI18n()

const channels = ref<AdminChannel[]>([])
const loading = ref(false)

/**
 * Loaded on mount rather than lazily on open: the select has to resolve the
 * stored id to a name immediately when editing an existing plan.
 */
async function load(): Promise<void> {
  loading.value = true
  try {
    const page = await api.get<AdminChannelPage>('/api/channel/', {
      page_size: 100,
    })
    channels.value = page.items
  } catch {
    // Non-fatal: the field degrades to "none" and the rest of the form works.
  } finally {
    loading.value = false
  }
}

const options = computed<SelectOption[]>(() => [
  { value: '', label: t('planManagement.formChannelNone') },
  ...channels.value.map((channel) => ({
    value: String(channel.id),
    label: `${channel.name} · ${channel.supplier}`,
  })),
])

/**
 * A stored id with no matching channel means the channel was deleted. Surfacing
 * it as a distinct option keeps the dangling reference visible instead of
 * silently resetting the field to "none" on the next save.
 */
const missingId = computed(
  () =>
    model.value !== null &&
    !loading.value &&
    channels.value.length > 0 &&
    !channels.value.some((channel) => channel.id === model.value)
)

const allOptions = computed<SelectOption[]>(() =>
  missingId.value
    ? [
        ...options.value,
        {
          value: String(model.value),
          label: t('planManagement.formChannelMissing', { id: model.value }),
          tone: 'danger' as const,
        },
      ]
    : options.value
)

const selected = computed<string>({
  get: () => (model.value === null ? '' : String(model.value)),
  set: (value) => {
    model.value = value === '' ? null : Number(value)
  },
})

onMounted(() => void load())
</script>

<template>
  <FilterSelect
    v-model="selected"
    :options="allOptions"
    :label="t('planManagement.formChannel')"
  />
</template>
