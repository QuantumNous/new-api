<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title?: string
    padded?: boolean
    /**
     * Lets the card fill a grid cell taller than its content: the body becomes
     * a flex column, so slot content can push itself apart with `mt-auto` /
     * `grow` instead of leaving the surplus as a blank strip at the bottom.
     */
    stretch?: boolean
    /**
     * `ink` renders the deep ledger-ink surface (dark in both themes) and
     * re-scopes the text/border tokens so existing children adapt untouched.
     * Reserve it for one or two hero-level cards per page.
     */
    variant?: 'default' | 'ink'
  }>(),
  { title: '', padded: true, stretch: false, variant: 'default' }
)

const ink = computed(() => props.variant === 'ink')
</script>

<template>
  <section
    class="rounded-2xl border shadow-[var(--card-shadow)]"
    :class="[
      ink
        ? 'border-transparent bg-[var(--surface-footer)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-solid)]',
      { 'flex h-full flex-col': stretch },
    ]"
    :style="
      ink
        ? {
            '--text-primary': 'var(--footer-text-primary)',
            '--text-secondary': 'var(--footer-text-secondary)',
            '--text-tertiary': 'var(--footer-text-tertiary)',
            '--border-subtle': 'var(--footer-border)',
            '--border-default': 'var(--footer-border)',
            '--surface-muted': 'rgba(244, 242, 232, 0.08)',
            '--accent-text': 'var(--footer-accent)',
          }
        : undefined
    "
  >
    <header
      v-if="title || $slots.action"
      class="flex items-center justify-between gap-3 px-5 pt-4"
      :class="{ 'pb-1': !padded }"
    >
      <h2 class="text-sm font-semibold text-[var(--text-primary)]">
        {{ title }}
      </h2>
      <slot name="action" />
    </header>
    <div :class="[padded ? 'p-5' : '', stretch ? 'flex grow flex-col' : '']">
      <slot />
    </div>
  </section>
</template>
