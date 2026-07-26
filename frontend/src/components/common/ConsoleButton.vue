<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'stamp'
    size?: 'sm' | 'md' | 'lg'
    block?: boolean
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  {
    variant: 'primary',
    size: 'md',
    block: false,
    loading: false,
    disabled: false,
    type: 'button',
  }
)

const classes = computed(() => {
  const base =
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all focus-ring disabled:cursor-not-allowed disabled:opacity-50'
  const sizes = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-5 text-base',
  }
  const variants = {
    // Solid CTA: accent background, hand-drawn irregular radius + pencil-pressure shadow
    primary:
      'sketch-sm bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] active:bg-[var(--accent-active)] shadow-[2px_3px_0_rgba(56,55,43,0.18),0_4px_14px_var(--shadow-color)]',
    // Outlined: 1.5px border, hand-drawn radius, paper-surface fill
    secondary:
      'sketch-sm border-[length:var(--sketch-border-width)] border-[var(--border-default)] bg-[var(--surface-solid)] text-[var(--text-primary)] hover:bg-[var(--surface-muted)] hover:border-[var(--border-strong)]',
    // Danger: rust-red fill, text-inverse holds contrast in both themes
    danger:
      'sketch-sm bg-[var(--status-danger)] text-[var(--text-inverse)] hover:opacity-90',
    // Ghost: brush-highlight appears on hover via group/pseudo approach
    ghost:
      'sketch-sm text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]',
    // Stamp: vermilion-ink seal style, slight rotation, for special actions
    stamp:
      'bg-[var(--status-danger)] text-[var(--text-inverse)] hover:opacity-90 shadow-[2px_2px_0_rgba(56,55,43,0.22)] -rotate-[0.5deg] hover:rotate-0',
  }
  // stamp uses its own border-radius (more square, seal-like)
  const radiusOverride =
    props.variant === 'stamp' ? 'rounded-[4px_6px_5px_5px/5px_4px_6px_4px]' : ''

  return [
    base,
    sizes[props.size],
    variants[props.variant],
    radiusOverride,
    props.block ? 'w-full' : '',
  ]
    .filter(Boolean)
    .join(' ')
})
</script>

<template>
  <button :type="type" :class="classes" :disabled="disabled || loading">
    <svg
      v-if="loading"
      class="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        stroke-opacity=".25"
        stroke-width="2.5"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
      />
    </svg>
    <slot />
  </button>
</template>
