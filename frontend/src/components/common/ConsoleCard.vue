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
     *
     * `sketch` renders a hand-drawn feel: irregular border-radius + layered
     * pencil-pressure shadow. Use for KPI callouts or accent cards.
     */
    variant?: 'default' | 'ink' | 'sketch'
  }>(),
  { title: '', padded: true, stretch: false, variant: 'default' }
)

const ink = computed(() => props.variant === 'ink')
const sketch = computed(() => props.variant === 'sketch')
</script>

<template>
  <section
    class="border"
    :data-surface-variant="variant"
    :data-handdrawn="ink ? undefined : sketch ? 'surface-strong' : 'surface'"
    :class="[
      ink
        ? 'border-transparent bg-[var(--surface-footer)] grid-paper'
        : sketch
          ? 'border-[var(--border-default)] bg-[var(--surface-solid)] stamp-watermark'
          : 'border-[var(--border-subtle)] bg-[var(--surface-solid)]',
      ink
        ? 'rounded-2xl'
        : sketch
          ? 'sketch-lg pencil-surface-strong'
          : 'rounded-2xl pencil-surface',
      ink ? 'no-handdrawn' : '',
      { 'flex h-full flex-col': stretch },
    ]"
    :style="[
      ink
        ? {
            '--text-primary': 'var(--footer-text-primary)',
            '--text-secondary': 'var(--footer-text-secondary)',
            '--text-tertiary': 'var(--footer-text-tertiary)',
            '--border-subtle': 'var(--footer-border)',
            '--border-default': 'var(--footer-border)',
            '--surface-muted': 'var(--ink-surface-muted)',
            '--accent-text': 'var(--footer-accent)',
            boxShadow: 'var(--card-shadow)',
          }
        : sketch
          ? { boxShadow: 'var(--card-sketch-shadow)' }
          : { boxShadow: 'var(--card-shadow)' },
    ]"
  >
    <span v-if="sketch" class="stamp-watermark-art" aria-hidden="true" />
    <header
      v-if="title || $slots.action"
      class="flex items-center justify-between gap-3 px-5 pt-4"
      :class="{ 'pb-1': !padded }"
    >
      <!-- sketch variant: accent left-bar decoration on title -->
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          v-if="sketch"
          class="shrink-0 w-0.5 h-4 rounded-full"
          style="background: var(--accent)"
          aria-hidden="true"
        />
        <h2 class="text-sm font-semibold text-[var(--text-primary)] truncate">
          {{ title }}
        </h2>
      </div>
      <slot name="action" />
    </header>
    <div :class="[padded ? 'p-5' : '', stretch ? 'flex grow flex-col' : '']">
      <slot />
    </div>
  </section>
</template>
