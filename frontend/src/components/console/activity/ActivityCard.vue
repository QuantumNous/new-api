<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import StatusChip from '@/components/common/StatusChip.vue'
import CountdownPill from '@/components/console/activity/CountdownPill.vue'
import ConsoleButton from '@/components/common/ConsoleButton.vue'

const props = defineProps<{
  id: number
  kind: string
  title: string
  tagline: string
  status: 'ongoing' | 'upcoming' | 'ended'
  badgeKey?: 'hot' | 'new' | 'ending'
  end: number
  icon: string
  claimLabel: string
  claimDisabled?: boolean
}>()

const emit = defineEmits<{ claim: [id: number] }>()

const { t } = useI18n()

const statusTone = computed(() => {
  if (props.status === 'ended') return 'neutral'
  if (props.status === 'upcoming') return 'info'
  return 'accent'
})

const badgeTone = computed(() => {
  if (props.badgeKey === 'ending') return 'danger'
  if (props.badgeKey === 'new') return 'accent'
  return 'warning'
})
</script>

<template>
  <article
    class="pencil-surface flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] p-5 shadow-[var(--card-shadow)]"
    data-handdrawn="surface"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="flex items-center gap-3">
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-full"
          style="background: var(--accent-soft)"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-text)"
            stroke-width="1.8"
          >
            <path :d="icon" />
          </svg>
        </span>
        <div class="min-w-0">
          <h3
            class="truncate text-base font-semibold text-[var(--text-primary)]"
          >
            {{ title }}
          </h3>
          <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {{ tagline }}
          </p>
        </div>
      </div>
      <div class="flex shrink-0 flex-col items-end gap-1.5">
        <StatusChip v-if="badgeKey" :tone="badgeTone">{{
          t(`activity.badge.${badgeKey}`)
        }}</StatusChip>
        <StatusChip :tone="statusTone">{{
          t(`activity.category.${status}`)
        }}</StatusChip>
      </div>
    </header>

    <div class="mt-4 flex-1">
      <slot />
    </div>

    <footer
      class="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4"
    >
      <CountdownPill :end="end" />
      <ConsoleButton
        size="sm"
        :disabled="claimDisabled"
        @click="emit('claim', id)"
      >
        {{ claimLabel }}
      </ConsoleButton>
    </footer>
  </article>
</template>
