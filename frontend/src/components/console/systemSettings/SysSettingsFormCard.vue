<script setup lang="ts">
/**
 * Standard card wrapper for a system settings section.
 * Renders a labelled heading, content slot, and a sticky save bar with
 * optional loading + dirty indicator. Matches the Desert-Ledger / One-Night
 * dual-theme token system used by AccountSecurityPanel.
 */
import { useI18n } from 'vue-i18n'
import ConsoleButton from '@/components/common/ConsoleButton.vue'

withDefaults(
  defineProps<{
    title: string
    description?: string
    saving?: boolean
    /** When true the save button is enabled; when false it is ghost/disabled */
    dirty?: boolean
  }>(),
  { description: '', saving: false, dirty: false }
)

const emit = defineEmits<{ save: [] }>()
const { t } = useI18n()
</script>

<template>
  <section
    ref="panel"
    class="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] pencil-surface"
    style="box-shadow: var(--card-shadow)"
  >
    <!-- Header -->
    <header class="border-b border-[var(--border-subtle)] px-6 py-5">
      <h3 class="text-base font-semibold text-[var(--text-primary)]">
        {{ title }}
      </h3>
      <p v-if="description" class="mt-0.5 text-sm text-[var(--text-tertiary)]">
        {{ description }}
      </p>
    </header>

    <!-- Body -->
    <div class="px-6 py-5">
      <slot />
    </div>

    <!-- Save bar -->
    <footer
      class="flex items-center justify-between gap-4 border-t border-[var(--border-subtle)] bg-[var(--surface-table-header)] px-6 py-3"
    >
      <span
        v-if="dirty"
        class="text-xs text-[var(--text-tertiary)]"
      >
        {{ t('systemSettings.noChanges') === t('systemSettings.noChanges') ? '· ' : '' }}
      </span>
      <span class="flex-1" />
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
