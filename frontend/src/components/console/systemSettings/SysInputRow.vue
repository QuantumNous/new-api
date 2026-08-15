<script setup lang="ts">
/**
 * Text/number input row — label + optional description + TextInput/textarea.
 */
import FormField from '@/components/common/FormField.vue'
import TextInput from '@/components/common/TextInput.vue'

withDefaults(
  defineProps<{
    label: string
    description?: string
    hint?: string
    type?: 'text' | 'password' | 'number' | 'url' | 'email'
    placeholder?: string
    rows?: number // > 1 renders a <textarea>
    autocomplete?: string
    readonly?: boolean
    maxlength?: number
  }>(),
  {
    description: '',
    hint: '',
    type: 'text',
    rows: 1,
    autocomplete: 'off',
    readonly: false,
    placeholder: '',
    maxlength: undefined,
  }
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <FormField :label="label" :hint="hint || description">
    <textarea
      v-if="rows > 1"
      v-model="model"
      :placeholder="placeholder"
      :rows="rows"
      :readonly="readonly"
      class="sys-textarea"
    />
    <TextInput
      v-else
      v-model="model"
      :type="type"
      :placeholder="placeholder"
      :autocomplete="autocomplete"
      :readonly="readonly"
      v-bind="maxlength ? { maxlength } : {}"
    />
  </FormField>
</template>

<style scoped>
.sys-textarea {
  width: 100%;
  min-height: 7rem;
  resize: vertical;
  border: 1.5px solid var(--border-default);
  border-radius: var(--sketch-border-radius-sm);
  background: transparent;
  padding: 0.625rem 1rem;
  font-size: 0.875rem;
  line-height: 1.6;
  color: var(--text-primary);
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s ease;
}
.sys-textarea::placeholder {
  color: var(--text-tertiary);
}
.sys-textarea:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
