<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { MarketListing, MarketModelType } from '@/types/console'
import AmountInput from '@/components/common/AmountInput.vue'
import ChipPicker from '@/components/common/ChipPicker.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FilterSelect from '@/components/common/FilterSelect.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'

const props = defineProps<{
  open: boolean
  /** null = create mode */
  editing: MarketListing | null
  models: string[]
  channels: string[]
  tagPool: string[]
}>()

const emit = defineEmits<{
  close: []
  saved: []
}>()

const { t } = useI18n()
const toast = useToast()

const form = reactive({
  title: '',
  summary: '',
  source: '',
  type: 'chat' as MarketModelType,
  supportedModels: [] as string[],
  priceUSD: null as number | null,
  tags: [] as string[],
})
const saving = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    const e = props.editing
    form.title = e?.title ?? ''
    form.summary = e?.summary ?? ''
    form.source = e?.source ?? props.channels[0] ?? ''
    form.type = e?.type ?? 'chat'
    form.supportedModels = e?.supportedModels ? [...e.supportedModels] : []
    form.priceUSD = e?.priceUSD ?? null
    form.tags = e?.tags ? [...e.tags] : []
  }
)

const typeOptions = computed(() => [
  { value: 'chat', label: t('models.type.chat') },
  { value: 'image', label: t('models.type.image') },
  { value: 'embedding', label: t('models.type.embedding') },
  { value: 'audio', label: t('models.type.audio') },
  { value: 'video', label: t('models.type.video') },
  { value: 'rerank', label: t('models.type.rerank') },
])

const channelOptions = computed(() =>
  props.channels.map((c) => ({ value: c, label: c }))
)

const canSubmit = computed(
  () =>
    form.title.trim().length > 0 &&
    form.supportedModels.length > 0 &&
    (form.priceUSD ?? 0) > 0
)

async function save() {
  saving.value = true
  try {
    const payload = {
      title: form.title.trim(),
      summary: form.summary.trim(),
      source: form.source,
      type: form.type,
      supportedModels: form.supportedModels,
      priceUSD: form.priceUSD ?? 0,
      tags: form.tags,
    }
    if (props.editing) {
      await api.put(`/api/market/listing/${props.editing.id}`, payload)
      toast.success(t('market.form.updated'))
    } else {
      await api.post('/api/market/listing', payload)
      toast.success(t('market.form.created'))
    }
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
    :open="open"
    :title="editing ? t('market.form.editTitle') : t('market.form.createTitle')"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <FormField :label="t('market.form.nameLabel')">
        <TextInput
          v-model="form.title"
          name="listing-title"
          :placeholder="t('market.form.namePlaceholder')"
        />
      </FormField>

      <FormField :label="t('market.form.summaryLabel')">
        <TextInput
          v-model="form.summary"
          name="listing-summary"
          :placeholder="t('market.form.summaryPlaceholder')"
        />
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField :label="t('market.form.sourceLabel')">
          <FilterSelect
            v-model="form.source"
            :options="channelOptions"
            :label="t('market.form.sourceLabel')"
            class="h-11"
          />
        </FormField>
        <FormField :label="t('market.form.typeLabel')">
          <FilterSelect
            v-model="form.type"
            :options="typeOptions"
            :label="t('market.form.typeLabel')"
            class="h-11"
          />
        </FormField>
      </div>

      <FormField :label="t('market.form.modelsLabel')">
        <ChipPicker
          v-model="form.supportedModels"
          :options="models"
          :placeholder="t('market.form.modelsPlaceholder')"
        />
      </FormField>

      <FormField :label="t('market.form.priceLabel')">
        <AmountInput
          v-model="form.priceUSD"
          name="listing-price"
          :aria-label="t('market.form.priceLabel')"
          :placeholder="t('market.form.pricePlaceholder')"
          :min="0"
        />
      </FormField>

      <FormField :label="t('market.form.tagsLabel')">
        <ChipPicker
          v-model="form.tags"
          :options="tagPool"
          :placeholder="t('market.form.tagsPlaceholder')"
          :max="4"
        />
      </FormField>
    </div>

    <template #footer>
      <ConsoleButton
        size="lg"
        block
        :loading="saving"
        :disabled="!canSubmit"
        @click="save"
      >
        {{
          editing ? t('market.form.submitEdit') : t('market.form.submitCreate')
        }}
      </ConsoleButton>
    </template>
  </ConsoleModal>
</template>
