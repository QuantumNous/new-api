<script setup lang="ts">
/**
 * Standard card wrapper for a system settings section.
 * Renders a labelled heading, content slot, and a sticky save bar.
 * Matches the Desert-Ledger / One-Night dual-theme token system.
 */
import { useI18n } from 'vue-i18n'
import ConsoleButton from '@/components/common/ConsoleButton.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    saving?: boolean
    /** When true the save button is enabled */
    dirty?: boolean
  }>(),
  { description: '', saving: false, dirty: false }
)

const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    class="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <!-- Header -->
    <header
      class="border-b border-[var(--border-subtle)] bg-[var(--surface-table-header)]/40 px-6 py-5"
    >
      <h3 class="display-title text-base font-bold text-[var(--text-primary)]">
        {{ title }}
      </h3>
      <p v-if="description" class="mt-1 text-xs text-[var(--text-secondary)]">
        {{ description }}
      </p>
    </header>

    <!-- Body -->
    <div class="px-6 py-6">
      <slot />
    </div>

    <!-- Sticky Save bar -->
    <footer
      class="sticky bottom-0 z-10 flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface-table-header)]/90 px-6 py-3.5 backdrop-blur-md"
    >
      <div class="flex items-center gap-2">
        <span
          v-if="dirty"
          class="inline-flex items-center gap-1.5 rounded-md bg-[var(--status-warning-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--status-warning-text)]"
        >
          <span
            class="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--status-warning)]"
          />
          {{ t('common.unsavedChanges') }}
        </span>
      </div>
      <ConsoleButton
        variant="primary"
        size="sm"
        :loading="saving"
        :disabled="!dirty || saving"
        @click="emit('save')"
      >
        {{ t('systemSettings.saveChanges') }}
      </ConsoleButton>
    </footer>
  </section>
</template>
