<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleButton from '@/components/common/ConsoleButton.vue'
import type { Activity } from '@/types/console'
import { formatQuota } from '@/utils/format'

const props = defineProps<{
  activity: Extract<Activity, { kind: 'checkin' }>
  claiming: boolean
}>()

const emit = defineEmits<{ checkin: [id: number] }>()

const { t } = useI18n()

// Today's potential reward = next unclaimed slot in the 7-day cycle
const todayReward = computed(
  () =>
    props.activity.checkin.days[
      props.activity.checkin.streak % props.activity.checkin.days.length
    ]
)

// Week total (sum of claimed entries)
const weekTotal = computed(() =>
  props.activity.checkin.week_entries.reduce(
    (sum, e) => sum + (e.claimed ? e.reward : 0),
    0
  )
)

// Month progress 0–100
const monthPct = computed(() => {
  const { month_days, month_days_total } = props.activity.checkin
  return month_days_total > 0
    ? Math.min(100, Math.round((month_days / month_days_total) * 100))
    : 0
})

// Today's week entry for date display
const todayEntry = computed(
  () => props.activity.checkin.week_entries.find((e) => e.today) ?? null
)

// e.g. "2026 · 07 · 23 · THU"
const dateDisplay = computed(() => {
  const e = todayEntry.value
  if (!e) return ''
  const [mm, dd] = e.date.split('/')
  return `2026 · ${mm} · ${dd} · ${e.weekday}`
})

// Week label e.g. "WEEK 4 · JUL"
const weekLabel = computed(() => {
  const now = new Date()
  const week = Math.ceil(now.getDate() / 7)
  const mon = now.toLocaleString('en-US', { month: 'short' }).toUpperCase()
  return `WEEK ${week} · ${mon}`
})
</script>

<template>
  <article
    class="pencil-surface overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-solid)] shadow-[var(--card-shadow)]"
    data-handdrawn="surface-clipped"
  >
    <!-- ─── header ─── -->
    <div
      class="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4"
    >
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style="background: var(--accent-soft)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-text)"
            stroke-width="1.8"
          >
            <path :d="activity.icon" />
          </svg>
        </span>
        <div class="min-w-0">
          <p class="text-sm font-bold tracking-wide text-[var(--text-primary)]">
            {{ t('activity.checkin.signInLabel') }}
            <span
              class="ml-1.5 font-mono text-[10px] font-normal tracking-widest text-[var(--text-tertiary)]"
              >SIGN-IN</span
            >
          </p>
          <p class="text-[10px] text-[var(--text-tertiary)]">
            {{ t('activity.checkin.signInSub') }}
          </p>
        </div>
      </div>

      <div class="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <!-- streak fire badge -->
        <span
          v-if="activity.checkin.streak > 0"
          class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
          style="
            background: var(--status-warning-soft);
            color: var(--status-warning-text);
          "
        >
          🔥
          {{ t('activity.checkin.streak', { count: activity.checkin.streak }) }}
        </span>
        <!-- month total -->
        <span class="text-xs text-[var(--text-tertiary)]">
          {{ t('activity.checkin.monthIncome') }}
          <span class="ml-1 font-semibold text-[var(--accent-text)]">
            {{ formatQuota(activity.checkin.month_reward) }}
          </span>
        </span>
      </div>
    </div>

    <!-- ─── two-panel body ─── -->
    <div
      class="flex flex-col sm:flex-row sm:divide-x sm:divide-[var(--border-subtle)]"
    >
      <!-- LEFT: today's receipt -->
      <div
        class="relative flex flex-col items-center justify-center gap-3 px-6 py-6 sm:w-56 sm:shrink-0"
      >
        <!-- date -->
        <p
          class="font-mono text-[11px] tracking-widest text-[var(--text-tertiary)]"
        >
          {{ dateDisplay }}
        </p>

        <!-- big amount -->
        <p
          class="text-5xl font-bold tracking-tighter text-[var(--text-primary)]"
        >
          {{ formatQuota(todayReward.reward, 2) }}
        </p>
        <p class="text-xs text-[var(--text-tertiary)]">
          {{ t('activity.checkin.todayIncome') }}
        </p>

        <!-- claimed / unclaimed stamp -->
        <div
          class="checkin-stamp mt-1 rotate-[-14deg] rounded-md border-2 px-3 py-1 text-xs font-bold uppercase tracking-widest"
          :style="
            activity.checkin.todayClaimed
              ? 'border-color:var(--status-danger);color:var(--status-danger-text)'
              : 'border-color:var(--accent);color:var(--accent-text)'
          "
        >
          {{
            activity.checkin.todayClaimed
              ? t('activity.checkin.creditedStamp')
              : t('activity.checkin.pendingStamp')
          }}
        </div>

        <!-- streak + next -->
        <p class="mt-1 text-center text-[11px] text-[var(--text-tertiary)]">
          <span class="font-medium text-[var(--text-secondary)]">
            {{
              t('activity.checkin.streakLong', {
                count: activity.checkin.streak,
              })
            }}
          </span>
        </p>

        <!-- dashed perforated divider (mobile: bottom) -->
        <div
          class="checkin-perforation absolute bottom-0 left-5 right-5 h-px border-b border-dashed border-[var(--border-default)] sm:hidden"
        />
      </div>

      <!-- RIGHT: weekly log -->
      <div class="flex-1 px-5 py-5">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-xs font-semibold text-[var(--text-secondary)]">
            {{ t('activity.checkin.weekIncome') }}
          </p>
          <p
            class="font-mono text-[10px] tracking-widest text-[var(--text-tertiary)]"
          >
            {{ weekLabel }}
          </p>
        </div>

        <div class="space-y-1">
          <div
            v-for="entry in activity.checkin.week_entries"
            :key="entry.date"
            class="flex items-center gap-3 rounded-lg px-2 py-1 text-xs transition-colors"
            :class="{ 'bg-[var(--accent-soft)]': entry.today }"
          >
            <span
              class="w-7 font-mono font-medium"
              :class="
                entry.today
                  ? 'text-[var(--accent-text)]'
                  : 'text-[var(--text-tertiary)]'
              "
            >
              {{ entry.weekday }}
            </span>
            <span class="w-10 text-[var(--text-tertiary)]">{{
              entry.date
            }}</span>
            <span class="flex-1 text-right font-semibold">
              <template v-if="entry.claimed">
                <span style="color: var(--accent-text)">{{
                  formatQuota(entry.reward)
                }}</span>
              </template>
              <template
                v-else-if="entry.today && !activity.checkin.todayClaimed"
              >
                <span class="text-[var(--text-tertiary)]">—</span>
              </template>
              <template v-else>
                <span class="text-[var(--text-tertiary)]">—</span>
              </template>
            </span>
          </div>
        </div>

        <!-- week total -->
        <div
          class="mt-3 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2 text-xs"
        >
          <span class="text-[var(--text-tertiary)]">{{
            t('activity.checkin.weekTotal')
          }}</span>
          <span class="font-semibold text-[var(--text-primary)]">{{
            formatQuota(weekTotal)
          }}</span>
        </div>
      </div>
    </div>

    <!-- ─── bottom stats + claim ─── -->
    <div class="border-t border-[var(--border-subtle)] px-5 py-4">
      <!-- month progress bar -->
      <div class="mb-3">
        <div
          class="mb-1.5 flex items-center justify-between text-[10px] text-[var(--text-tertiary)]"
        >
          <span>{{ t('activity.checkin.monthProgress') }}</span>
          <span class="font-medium"
            >{{ activity.checkin.month_days }} /
            {{ activity.checkin.month_days_total }}</span
          >
        </div>
        <div
          class="pencil-progress h-1.5 overflow-hidden rounded-full bg-[var(--surface-muted)]"
        >
          <div
            class="h-full rounded-full transition-all duration-700"
            style="background: var(--accent)"
            :style="{ width: `${monthPct}%` }"
          />
        </div>
      </div>

      <!-- stats row + button -->
      <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('activity.checkin.totalDays')
          }}</span>
          <span class="text-sm font-bold text-[var(--text-primary)]">{{
            activity.checkin.total_days
          }}</span>
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('activity.checkin.dayUnit')
          }}</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('activity.checkin.monthIncome')
          }}</span>
          <span class="text-sm font-bold" style="color: var(--accent-text)">
            {{ formatQuota(activity.checkin.month_reward) }}
          </span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('activity.checkin.bestStreak')
          }}</span>
          <span class="text-sm font-bold text-[var(--text-primary)]">{{
            activity.checkin.best_streak
          }}</span>
          <span class="text-xs text-[var(--text-tertiary)]">{{
            t('activity.checkin.dayUnit')
          }}</span>
        </div>

        <ConsoleButton
          size="sm"
          :loading="claiming"
          :disabled="activity.checkin.todayClaimed"
          class="ml-auto"
          @click="emit('checkin', activity.id)"
        >
          {{
            activity.checkin.todayClaimed
              ? t('activity.checkin.claimed')
              : t('activity.checkin.claim')
          }}
        </ConsoleButton>
      </div>
    </div>
  </article>
</template>

<style scoped>
:global(html.dark) .checkin-stamp {
  transform: none;
}

:global(html.dark) .checkin-perforation {
  border-bottom-style: solid;
}
</style>
