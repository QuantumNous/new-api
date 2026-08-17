<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'
import FormField from '@/components/common/FormField.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import TextInput from '@/components/common/TextInput.vue'
import type { SystemSettingValue } from '@/composables/useSystemSettings'
import type { SystemSettingField } from '@/constants/systemSettingsCatalog'

const props = defineProps<{
  field: SystemSettingField
  modelValue: SystemSettingValue
  secretConfigured?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: SystemSettingValue]
}>()

const jsonError = ref('')
const structuredError = ref('')
const listEntries = ref<string[]>([])
const mapEntries = ref<Array<{ key: string; value: string }>>([])

const textValue = computed({
  get: () => String(props.modelValue ?? ''),
  set: (value: string) => {
    if (props.field.kind === 'number') {
      const parsed = Number(value)
      emit('update:modelValue', Number.isFinite(parsed) ? parsed : 0)
      return
    }
    emit('update:modelValue', value)
  },
})

function updateJson(value: string) {
  try {
    const parsed = JSON.parse(value)
    jsonError.value = ''
    emit('update:modelValue', JSON.stringify(parsed, null, 2))
  } catch {
    jsonError.value = '请输入有效的 JSON 数据。'
    emit('update:modelValue', value)
  }
}

function formatJson() {
  try {
    emit(
      'update:modelValue',
      JSON.stringify(JSON.parse(textValue.value), null, 2)
    )
    jsonError.value = ''
  } catch {
    jsonError.value = '请输入有效的 JSON 数据。'
  }
}

function parseStructuredValue() {
  const value = String(props.modelValue ?? '')
  if (!['list', 'key-value', 'ratio'].includes(props.field.kind)) return
  try {
    const parsed = JSON.parse(
      value || (props.field.kind === 'list' ? '[]' : '{}')
    )
    if (props.field.kind === 'list') {
      if (
        !Array.isArray(parsed) ||
        !parsed.every((item) => typeof item === 'string')
      ) {
        throw new Error('列表只能包含文本项')
      }
      listEntries.value = parsed
    } else {
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('键值表必须是对象')
      }
      const entries = Object.entries(parsed)
      if (
        props.field.kind === 'ratio' &&
        entries.some(
          ([, entry]) => typeof entry !== 'number' || !Number.isFinite(entry)
        )
      ) {
        throw new Error('倍率值必须是有限数字')
      }
      if (
        props.field.kind === 'key-value' &&
        entries.some(([, entry]) => typeof entry !== 'string')
      ) {
        throw new Error('键值表的值必须是文本')
      }
      mapEntries.value = entries.map(([key, entry]) => ({
        key,
        value: String(entry),
      }))
    }
    structuredError.value = ''
  } catch (error) {
    listEntries.value = []
    mapEntries.value = []
    structuredError.value =
      error instanceof Error ? error.message : '配置格式不正确'
  }
}

function emitList() {
  emit('update:modelValue', JSON.stringify(listEntries.value))
}

function emitMap() {
  const next: Record<string, string | number> = {}
  const keys = new Set<string>()
  for (const entry of mapEntries.value) {
    const key = entry.key.trim()
    if (!key) {
      structuredError.value = '键名不能为空。'
      return
    }
    if (keys.has(key)) {
      structuredError.value = '键名不能重复。'
      return
    }
    keys.add(key)
    if (props.field.kind === 'ratio') {
      const value = Number(entry.value)
      if (!Number.isFinite(value)) {
        structuredError.value = '倍率值必须是有限数字。'
        return
      }
      next[key] = value
    } else {
      next[key] = entry.value
    }
  }
  structuredError.value = ''
  emit('update:modelValue', JSON.stringify(next))
}

function addListEntry() {
  listEntries.value.push('')
  emitList()
}

function removeListEntry(index: number) {
  listEntries.value.splice(index, 1)
  emitList()
}

function addMapEntry() {
  mapEntries.value.push({ key: '', value: '' })
}

function removeMapEntry(index: number) {
  mapEntries.value.splice(index, 1)
  emitMap()
}

watch(() => [props.field.kind, props.modelValue], parseStructuredValue, {
  immediate: true,
})
</script>

<template>
  <div v-if="field.kind === 'boolean'" class="settings-field-toggle">
    <div class="min-w-0 flex-1">
      <p class="settings-field-title">{{ field.label }}</p>
      <p v-if="field.description" class="settings-field-description">
        {{ field.description }}
      </p>
    </div>
    <ConsoleToggle
      :model-value="Boolean(modelValue)"
      :label="field.label"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>

  <FormField
    v-else
    :label="field.label"
    :hint="field.description"
    :class="[
      'settings-field-control',
      {
        'settings-field-wide': ['json', 'list', 'key-value', 'ratio'].includes(
          field.kind
        ),
      },
    ]"
  >
    <div v-if="field.kind === 'json'" class="settings-json-editor">
      <div class="mb-1.5 flex items-center justify-between">
        <span class="font-mono text-xs text-[var(--text-tertiary)]"
          >JSON Format</span
        >
        <button
          type="button"
          class="focus-ring text-xs font-semibold text-[var(--accent-text)] hover:underline"
          @click="formatJson"
        >
          格式化 JSON
        </button>
      </div>
      <textarea
        :value="textValue"
        rows="8"
        spellcheck="false"
        class="settings-json-textarea"
        @input="updateJson(($event.target as HTMLTextAreaElement).value)"
        @blur="formatJson"
      />
      <p v-if="jsonError" class="settings-json-error">{{ jsonError }}</p>
    </div>

    <div v-else-if="field.kind === 'list'" class="settings-structured-editor">
      <p v-if="structuredError" class="settings-json-error">
        {{ structuredError }}
      </p>
      <div
        v-for="(_, index) in listEntries"
        :key="index"
        class="settings-structured-row"
      >
        <TextInput
          v-model="listEntries[index]"
          autocomplete="off"
          @change="emitList"
        />
        <button
          type="button"
          class="settings-structured-icon focus-ring"
          title="删除条目"
          aria-label="删除条目"
          @click="removeListEntry(index)"
        >
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </div>
      <ConsoleButton
        type="button"
        size="sm"
        variant="secondary"
        class="mt-1 w-fit"
        title="添加条目"
        @click="addListEntry"
      >
        <Plus :size="14" class="mr-1" aria-hidden="true" />
        添加条目
      </ConsoleButton>
    </div>

    <div
      v-else-if="field.kind === 'key-value' || field.kind === 'ratio'"
      class="settings-structured-editor"
    >
      <p v-if="structuredError" class="settings-json-error">
        {{ structuredError }}
      </p>
      <div
        v-for="(_, index) in mapEntries"
        :key="index"
        class="settings-structured-row settings-structured-pair"
      >
        <TextInput
          v-model="mapEntries[index].key"
          placeholder="键名"
          autocomplete="off"
          @change="emitMap"
        />
        <TextInput
          v-model="mapEntries[index].value"
          :type="field.kind === 'ratio' ? 'number' : 'text'"
          :placeholder="field.kind === 'ratio' ? '倍率' : '值'"
          autocomplete="off"
          @change="emitMap"
        />
        <button
          type="button"
          class="settings-structured-icon focus-ring"
          title="删除条目"
          aria-label="删除条目"
          @click="removeMapEntry(index)"
        >
          <Trash2 :size="14" aria-hidden="true" />
        </button>
      </div>
      <ConsoleButton
        type="button"
        size="sm"
        variant="secondary"
        class="mt-1 w-fit"
        title="添加条目"
        @click="addMapEntry"
      >
        <Plus :size="14" class="mr-1" aria-hidden="true" />
        添加条目
      </ConsoleButton>
    </div>

    <div
      v-else-if="field.kind === 'textarea' || field.kind === 'secret-textarea'"
      class="space-y-1.5"
    >
      <textarea
        v-model="textValue"
        rows="5"
        class="settings-textarea"
        :autocomplete="
          field.kind === 'secret-textarea' ? 'new-password' : 'off'
        "
      />
      <div
        v-if="field.kind === 'secret-textarea' && secretConfigured"
        class="mt-1 flex items-center gap-1.5"
      >
        <StatusChip tone="success" class="text-xs">已配置</StatusChip>
        <span class="text-xs text-[var(--text-tertiary)]"
          >留空不会覆盖现有凭据</span
        >
      </div>
    </div>

    <div v-else-if="field.kind === 'select'" class="relative">
      <select v-model="textValue" class="settings-select focus-ring">
        <option
          v-for="option in field.options"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </option>
      </select>
    </div>

    <div v-else class="space-y-1.5">
      <TextInput
        v-model="textValue"
        :type="
          field.kind === 'secret'
            ? 'password'
            : field.kind === 'number'
              ? 'number'
              : field.kind === 'url'
                ? 'url'
                : 'text'
        "
        :autocomplete="field.kind === 'secret' ? 'new-password' : 'off'"
      />
      <div
        v-if="field.kind === 'secret' && secretConfigured"
        class="mt-1 flex items-center gap-1.5"
      >
        <StatusChip tone="success" class="text-xs">已配置</StatusChip>
        <span class="text-xs text-[var(--text-tertiary)]"
          >留空不会覆盖现有凭据</span
        >
      </div>
    </div>
  </FormField>
</template>

<style scoped>
.settings-field-toggle {
  display: flex;
  min-height: 4rem;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle);
  background: var(--surface-table-header);
  transition: all 0.15s ease;
}
.settings-field-toggle:hover {
  background: var(--surface-hover);
}
.settings-field-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}
.settings-field-description {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}
.settings-textarea,
.settings-json-textarea,
.settings-select {
  width: 100%;
  border: 1.5px solid var(--border-default);
  border-radius: 0.75rem;
  background: var(--surface-solid);
  color: var(--text-primary);
  font: inherit;
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.settings-textarea,
.settings-json-textarea {
  min-height: 8rem;
  resize: vertical;
  padding: 0.75rem 1rem;
  line-height: 1.6;
}
.settings-json-textarea {
  font-family:
    'Ren2JetBrainsMono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
    monospace;
  font-size: 0.8125rem;
}
.settings-select {
  height: 2.75rem;
  padding: 0 0.875rem;
  cursor: pointer;
}
.settings-textarea:focus,
.settings-json-textarea:focus,
.settings-select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.settings-json-error {
  margin-top: 0.375rem;
  font-size: 0.75rem;
  color: var(--status-danger-text);
}
.settings-structured-editor {
  display: grid;
  gap: 0.625rem;
}
.settings-structured-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 2.5rem;
  gap: 0.5rem;
  align-items: center;
}
.settings-structured-pair {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 2.5rem;
}
.settings-structured-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--border-default);
  border-radius: 0.625rem;
  background: var(--surface-solid);
  color: var(--text-tertiary);
  transition: all 0.15s ease;
}
.settings-structured-icon:hover {
  border-color: var(--status-danger);
  color: var(--status-danger-text);
  background: var(--status-danger-soft);
}
</style>
