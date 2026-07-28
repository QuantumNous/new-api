<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { api } from '@/api/console'
import { ApiError } from '@/api/types'
import type { TicketCategory, TicketPriority } from '@/types/console'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { useToast } from '@/composables/useToast'

import TicketImageUploader from './TicketImageUploader.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { t } = useI18n()
const toast = useToast()

const categories: TicketCategory[] = [
  'billing',
  'api',
  'model',
  'account',
  'other',
]
const priorities: TicketPriority[] = ['low', 'normal', 'high']

const form = reactive({
  title: '',
  category: 'other' as TicketCategory,
  priority: 'normal' as TicketPriority,
  content: '',
  model_id: '',
  request_id: '',
})
const errors = reactive({ title: '', content: '' })
const saving = ref(false)
const uploader = ref<InstanceType<typeof TicketImageUploader> | null>(null)

watch(
  () => props.open,
  (open) => {
    if (open) return
    // Reset on close so the next open starts clean.
    form.title = ''
    form.category = 'other'
    form.priority = 'normal'
    form.content = ''
    form.model_id = ''
    form.request_id = ''
    errors.title = ''
    errors.content = ''
    uploader.value?.reset()
  }
)

function validate(): boolean {
  errors.title = ''
  errors.content = ''
  let valid = true
  const title = form.title.trim()
  const content = form.content.trim()
  if (!title) {
    errors.title = t('tickets.create.titleRequired')
    valid = false
  } else if (title.length > 100) {
    errors.title = t('tickets.create.titleLength')
    valid = false
  }
  if (!content) {
    errors.content = t('tickets.create.contentRequired')
    valid = false
  } else if (content.length > 2000) {
    errors.content = t('tickets.create.contentLength')
    valid = false
  }
  return valid
}

async function save() {
  if (!validate() || saving.value) return
  saving.value = true
  try {
    await api.post('/api/ticket/', {
      title: form.title.trim(),
      category: form.category,
      priority: form.priority,
      content: form.content.trim(),
      images: uploader.value?.getUrls() ?? [],
      model_id: form.model_id.trim() || undefined,
      request_id: form.request_id.trim() || undefined,
    })
    toast.success(t('tickets.created'))
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
    :title="t('tickets.create.title')"
    size="lg"
    @close="emit('close')"
  >
    <div class="space-y-4 text-left">
      <FormField :label="t('tickets.create.titleLabel')">
        <TextInput
          v-model="form.title"
          name="ticket-title"
          :placeholder="t('tickets.create.titlePlaceholder')"
        />
        <span
          v-if="errors.title"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.title }}
        </span>
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField :label="t('tickets.create.categoryLabel')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="cat in categories"
              :key="cat"
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-ring"
              :style="
                form.category === cat
                  ? 'border-color:var(--accent);background:var(--accent);color:var(--accent-contrast)'
                  : 'border-color:var(--border-subtle);background:var(--surface-solid);color:var(--text-secondary)'
              "
              :aria-pressed="form.category === cat"
              @click="form.category = cat"
            >
              {{ t(`tickets.category.${cat}`) }}
            </button>
          </div>
        </FormField>
        <FormField :label="t('tickets.create.priorityLabel')">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="pri in priorities"
              :key="pri"
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-ring"
              :style="
                form.priority === pri
                  ? 'border-color:var(--accent);background:var(--accent);color:var(--accent-contrast)'
                  : 'border-color:var(--border-subtle);background:var(--surface-solid);color:var(--text-secondary)'
              "
              :aria-pressed="form.priority === pri"
              @click="form.priority = pri"
            >
              {{ t(`tickets.priority.${pri}`) }}
            </button>
          </div>
        </FormField>
      </div>

      <FormField :label="t('tickets.create.contentLabel')">
        <textarea
          v-model="form.content"
          rows="5"
          name="ticket-content"
          :aria-label="t('tickets.create.contentLabel')"
          :placeholder="t('tickets.create.contentPlaceholder')"
          class="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] transition-colors focus:border-[var(--border-strong)] focus-ring"
        />
        <span
          v-if="errors.content"
          class="mt-1.5 block text-xs text-[var(--status-danger-text)]"
        >
          {{ errors.content }}
        </span>
      </FormField>

      <div class="grid gap-4 sm:grid-cols-2">
        <FormField :label="t('tickets.create.modelIdLabel')">
          <TextInput
            v-model="form.model_id"
            name="ticket-model-id"
            :placeholder="t('tickets.create.modelIdPlaceholder')"
          />
        </FormField>
        <FormField :label="t('tickets.create.requestIdLabel')">
          <TextInput
            v-model="form.request_id"
            name="ticket-request-id"
            :placeholder="t('tickets.create.requestIdPlaceholder')"
          />
        </FormField>
      </div>

      <FormField :label="t('tickets.create.imagesLabel')">
        <TicketImageUploader ref="uploader" :max-count="4" />
      </FormField>
    </div>

    <template #footer>
      <ConsoleButton
        size="lg"
        block
        :loading="saving"
        :disabled="!form.title.trim() || !form.content.trim()"
        @click="save"
      >
        {{ t('common.confirm') }}
      </ConsoleButton>
    </template>
  </ConsoleModal>
</template>
