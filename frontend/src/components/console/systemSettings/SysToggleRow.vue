<script setup lang="ts">
/**
 * Toggle row — label + description on the left, ConsoleToggle on the right.
 * Used inside SysSettingsFormCard body.
 */
import ConsoleToggle from '@/components/common/ConsoleToggle.vue'

defineProps<{
  label: string
  description?: string
  disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <div class="settings-toggle-row">
    <div class="min-w-0 flex-1">
      <p class="settings-toggle-title">{{ label }}</p>
      <p v-if="description" class="settings-toggle-description">
        {{ description }}
      </p>
    </div>
    <ConsoleToggle v-model="model" :label="label" :disabled="disabled" />
  </div>
</template>

<style scoped>
.settings-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  min-height: 4rem;
  padding: 0.875rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid var(--border-subtle);
  background: var(--surface-table-header);
  transition: all 0.15s ease;
}
.settings-toggle-row:hover {
  background: var(--surface-hover);
}

.settings-toggle-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
}

.settings-toggle-description {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--text-tertiary);
}
</style>
