<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import ConsoleModal from '@/components/common/ConsoleModal.vue'
import StatusChip from '@/components/common/StatusChip.vue'
import CountdownPill from '@/components/console/activity/CountdownPill.vue'
import type { Activity } from '@/types/console'

const props = defineProps<{
  activity: Extract<Activity, { kind: 'newcomer' }>
  claiming: boolean
}>()

const emit = defineEmits<{ claim: [id: number] }>()

const { t } = useI18n()
const confirmOpen = ref(false)

const pendingReward = computed(() =>
  props.activity.newcomer.tasks
    .filter((t) => !t.done)
    .reduce((s, t) => s + t.reward, 0)
)

const allDone = computed(() =>
  props.activity.newcomer.tasks.every((t) => t.done)
)

function formatQuota(v: number) {
  return `${(v / 10000).toFixed(0)}`
}

function confirmClaim() {
  emit('claim', props.activity.id)
  confirmOpen.value = false
}
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
          style="background: var(--signal-soft)"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--signal)"
            stroke-width="1.8"
          >
            <path :d="activity.icon" />
          </svg>
        </span>
        <div>
          <h3 class="text-base font-semibold text-[var(--text-primary)]">
            {{ activity.title }}
          </h3>
          <p class="mt-0.5 text-xs text-[var(--text-tertiary)]">
            {{ activity.tagline }}
          </p>
        </div>
      </div>
      <StatusChip
        v-if="activity.badgeKey"
        :tone="activity.badgeKey === 'ending' ? 'danger' : 'accent'"
      >
        {{ t(`activity.badge.${activity.badgeKey}`) }}
      </StatusChip>
    </header>

    <div class="mt-5 space-y-2.5">
      <div
        v-for="task in activity.newcomer.tasks"
        :key="task.id"
        class="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5"
      >
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded-full"
          :class="
            task.done
              ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
              : 'bg-[var(--surface-muted)] text-[var(--text-tertiary)]'
          "
        >
          <svg
            v-if="task.done"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
          <span v-else class="text-[10px] font-bold">○</span>
        </span>
        <span class="flex-1 text-sm text-[var(--text-primary)]">{{
          t(task.labelKey)
        }}</span>
        <span class="shrink-0 text-sm font-semibold text-[var(--accent-text)]"
          >+{{ formatQuota(task.reward) }}</span
        >
      </div>
    </div>

    <footer
      class="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4"
    >
      <CountdownPill :end="activity.end" />
      <ConsoleButton
        size="sm"
        :loading="claiming"
        :disabled="allDone || activity.newcomer.claimed"
        @click="confirmOpen = true"
      >
        {{
          activity.newcomer.claimed
            ? t('activity.newcomer.claimed')
            : t('activity.newcomer.claimAll')
        }}
      </ConsoleButton>
    </footer>

    <ConsoleModal
      :open="confirmOpen"
      :title="t('activity.newcomer.claimAll')"
      :subtitle="
        t('activity.newcomer.claimConfirmSubtitle', { reward: pendingReward })
      "
      @close="confirmOpen = false"
    >
      <div class="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-center">
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('activity.newcomer.claimConfirmLabel') }}
        </p>
        <p class="mt-1 text-2xl font-bold text-[var(--accent-text)]">
          +{{ pendingReward }}
        </p>
      </div>
      <template #footer>
        <div class="flex gap-3">
          <ConsoleButton variant="secondary" block @click="confirmOpen = false">
            {{ t('common.cancel') }}
          </ConsoleButton>
          <ConsoleButton block :loading="claiming" @click="confirmClaim">
            {{ t('common.confirm') }}
          </ConsoleButton>
        </div>
      </template>
    </ConsoleModal>
  </article>
</template>
