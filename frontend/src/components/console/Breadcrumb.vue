<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * Single source of truth for the console breadcrumb row. Consumed by both
 * PageHero (with a title) and PageBreadcrumb (standalone). The `spacing` prop
 * lets each host keep its own bottom margin.
 */
const { t } = useI18n()

withDefaults(
  defineProps<{
    crumbs?: string[]
    spacing?: string
  }>(),
  { crumbs: () => [], spacing: 'mb-2' }
)
</script>

<template>
  <nav
    v-if="crumbs.length"
    class="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]"
    :class="spacing"
    :aria-label="t('common.breadcrumb')"
  >
    <template v-for="(crumb, i) in crumbs" :key="i">
      <!-- hand-drawn chevron separator -->
      <svg
        v-if="i > 0"
        width="9"
        height="10"
        viewBox="0 0 9 10"
        fill="none"
        class="shrink-0 text-[var(--accent)] opacity-70"
        aria-hidden="true"
      >
        <path
          d="M2.4 1.8c1.5 1 2.8 2.1 3.9 3.4C5.1 6.4 3.9 7.5 2.7 8.4"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
        />
      </svg>
      <span
        :class="i === crumbs.length - 1 ? 'text-[var(--text-secondary)]' : ''"
      >
        {{ crumb }}
      </span>
    </template>
  </nav>
</template>
