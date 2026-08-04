<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  ref,
  useId,
  watch,
  type CSSProperties,
} from 'vue'
import { useI18n } from 'vue-i18n'

import ConsoleCard from '@/components/common/ConsoleCard.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { UsageDistributionPoint } from '@/composables/useUsageDistribution'
import { formatCompact, formatNumber, formatQuota } from '@/utils/format'
import {
  buildUsageDistributionView,
  shiftUsageDate,
  type UsageDistributionMetric,
  type UsageDistributionPeriod,
  type UsageHeatmapCell,
} from '@/utils/usageDistribution'

const props = withDefaults(
  defineProps<{
    points: UsageDistributionPoint[]
    loading?: boolean
  }>(),
  { loading: false }
)

const { t, locale } = useI18n()
const period = ref<UsageDistributionPeriod>('quarter')
const metric = ref<UsageDistributionMetric>('requests')
const focusDate = ref('')
const root = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const tooltipId = useId()
const tooltip = ref<{
  date: string
  label: string
  left: number
  top: number
} | null>(null)

const view = computed(() =>
  buildUsageDistributionView(props.points, period.value, metric.value)
)

const visibleCells = computed(() =>
  view.value.cells.flatMap((cell, index) =>
    cell.inRange && !cell.future
      ? [
          {
            cell,
            column: Math.floor(index / 7) + 1,
            row: (index % 7) + 1,
          },
        ]
      : []
  )
)

const periodOptions = computed(() => [
  { key: 'month' as const, label: t('dashboard.distribution.periodMonth') },
  { key: 'quarter' as const, label: t('dashboard.distribution.periodQuarter') },
  { key: 'year' as const, label: t('dashboard.distribution.periodYear') },
])

const metricOptions = computed(() => [
  {
    key: 'requests' as const,
    label: t('dashboard.distribution.metricRequests'),
  },
  { key: 'consume' as const, label: t('dashboard.distribution.metricConsume') },
  { key: 'tokens' as const, label: t('dashboard.distribution.metricTokens') },
])

const metricColor = computed(() => {
  if (metric.value === 'consume') return 'var(--accent)'
  if (metric.value === 'tokens') return 'var(--support)'
  return 'var(--signal)'
})

const periodLabel = computed(() =>
  t(`dashboard.distribution.periodSummary.${period.value}`)
)
const metricLabel = computed(
  () => metricOptions.value.find((option) => option.key === metric.value)!.label
)

function formatMetric(value: number): string {
  if (metric.value === 'consume') return formatQuota(value)
  if (metric.value === 'tokens') return formatCompact(Math.round(value))
  return formatNumber(Math.round(value))
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(year!, month! - 1, day))
}

const weekdays = computed(() => {
  const monday = new Date(2024, 0, 1)
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(date.getDate() + index)
    return new Intl.DateTimeFormat(locale.value, { weekday: 'narrow' }).format(
      date
    )
  })
})

const monthLabels = computed(() => {
  const weeks = Array.from({ length: view.value.weekCount }, (_, index) =>
    view.value.cells.slice(index * 7, index * 7 + 7)
  )
  return weeks.map((week, index) => {
    const monthStart = week.find((cell) => cell.date.endsWith('-01'))
    const source =
      monthStart ?? (index === 0 ? week.find((cell) => cell.inRange) : null)
    if (!source) return ''
    const [year, month] = source.monthKey.split('-').map(Number)
    return new Intl.DateTimeFormat(locale.value, { month: 'short' }).format(
      new Date(year!, month! - 1, 1)
    )
  })
})

const maxTopDay = computed(() => view.value.topDays[0]?.value ?? 0)
const maxWeekday = computed(() =>
  Math.max(...view.value.weekdays.map((entry) => entry.value), 0)
)

function cellStyle(cell: UsageHeatmapCell): CSSProperties {
  if (!cell.inRange || cell.future) return { background: 'transparent' }
  if (cell.level === 0) {
    return {
      background: 'var(--surface-muted)',
      borderColor: 'var(--border-subtle)',
    }
  }
  const amount = [0, 20, 34, 50, 68, 88][cell.level]
  return {
    background: `color-mix(in srgb, ${metricColor.value} ${amount}%, var(--surface-solid))`,
    borderColor: `color-mix(in srgb, ${metricColor.value} ${Math.min(96, amount + 8)}%, var(--border-subtle))`,
  }
}

function cellLabel(cell: UsageHeatmapCell): string {
  return t('dashboard.distribution.cellLabel', {
    date: formatDate(cell.date),
    metric: metricLabel.value,
    value: formatMetric(cell.value),
  })
}

function showTooltip(event: FocusEvent | MouseEvent, cell: UsageHeatmapCell) {
  if (!root.value) return
  const target = event.currentTarget as HTMLElement
  const targetRect = target.getBoundingClientRect()
  const rootRect = root.value.getBoundingClientRect()
  tooltip.value = {
    date: cell.date,
    label: cellLabel(cell),
    left: Math.min(
      rootRect.width - 92,
      Math.max(92, targetRect.left - rootRect.left + targetRect.width / 2)
    ),
    top: targetRect.top - rootRect.top - 8,
  }
}

function onCellFocus(event: FocusEvent, cell: UsageHeatmapCell) {
  focusDate.value = cell.date
  showTooltip(event, cell)
}

function hideTooltip(date: string) {
  if (tooltip.value?.date === date) tooltip.value = null
}

async function focusCell(date: string) {
  const target = root.value?.querySelector<HTMLButtonElement>(
    `[data-usage-date="${date}"]`
  )
  if (!target) return
  focusDate.value = date
  await nextTick()
  target.focus()
}

function onCellKeydown(event: KeyboardEvent, cell: UsageHeatmapCell) {
  let days: number
  if (event.key === 'ArrowUp') days = -1
  else if (event.key === 'ArrowDown') days = 1
  else if (event.key === 'ArrowLeft') days = -7
  else if (event.key === 'ArrowRight') days = 7
  else if (event.key === 'Home') {
    const date = new Date(`${cell.date}T00:00:00`)
    days = -((date.getDay() + 6) % 7)
  } else if (event.key === 'End') {
    const date = new Date(`${cell.date}T00:00:00`)
    days = 6 - ((date.getDay() + 6) % 7)
  } else {
    return
  }
  event.preventDefault()
  void focusCell(shiftUsageDate(cell.date, days))
}

async function alignLatest() {
  await nextTick()
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
}

watch(
  view,
  (next) => {
    const active = next.cells.filter((cell) => cell.inRange && !cell.future)
    if (!active.some((cell) => cell.date === focusDate.value)) {
      focusDate.value = active.at(-1)?.date ?? ''
    }
    tooltip.value = null
    void alignLatest()
  },
  { immediate: true }
)

onMounted(() => void alignLatest())
</script>

<template>
  <ConsoleCard
    :title="t('dashboard.distribution.title')"
    stretch
    data-usage-distribution
  >
    <div v-if="loading" class="flex flex-col gap-3" data-usage-loading>
      <div class="flex flex-wrap justify-between gap-4">
        <div
          class="h-12 w-52 animate-pulse rounded-xl bg-[var(--surface-muted)]"
        />
        <div
          class="h-10 w-72 animate-pulse rounded-xl bg-[var(--surface-muted)]"
        />
      </div>
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div class="h-48 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
        <div class="h-48 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </div>
    </div>

    <EmptyState
      v-else-if="!points.length"
      :title="t('dashboard.distribution.emptyTitle')"
      :hint="t('dashboard.distribution.emptyHint')"
    />

    <div v-else ref="root" class="relative flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-xs text-[var(--text-tertiary)]">
            {{ periodLabel }} · {{ metricLabel }}
          </p>
          <div class="mt-0.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <p
              class="truncate text-xl font-bold tabular-nums text-[var(--text-primary)] sm:text-2xl"
              aria-live="polite"
              data-usage-total
            >
              {{ formatMetric(view.total) }}
            </p>
            <span class="text-[11px] text-[var(--text-tertiary)]">
              {{
                t('dashboard.distribution.activeDays', {
                  count: view.activeDays,
                })
              }}
            </span>
            <span class="text-[11px] text-[var(--text-tertiary)]">
              {{ t('dashboard.distribution.peak') }}
              <strong class="font-semibold text-[var(--text-secondary)]">
                {{ view.peak ? formatMetric(view.peak.value) : '--' }}
              </strong>
            </span>
          </div>
        </div>

        <div
          class="grid w-full gap-2 min-[360px]:grid-cols-2 sm:w-auto sm:justify-items-end"
        >
          <div
            class="grid grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-xs"
            :aria-label="t('dashboard.distribution.periodControl')"
          >
            <button
              v-for="option in periodOptions"
              :key="option.key"
              type="button"
              class="min-w-0 rounded-lg px-2.5 py-1.5 font-medium transition-all focus-ring"
              :class="
                period === option.key
                  ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              "
              :aria-pressed="period === option.key"
              :data-usage-period="option.key"
              @click="period = option.key"
            >
              {{ option.label }}
            </button>
          </div>
          <div
            class="grid grid-cols-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-0.5 text-xs"
            :aria-label="t('dashboard.distribution.metricControl')"
          >
            <button
              v-for="option in metricOptions"
              :key="option.key"
              type="button"
              class="min-w-0 rounded-lg px-2.5 py-1.5 font-medium transition-all focus-ring"
              :class="
                metric === option.key
                  ? 'bg-[var(--surface-solid)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              "
              :aria-pressed="metric === option.key"
              :data-usage-metric="option.key"
              @click="metric = option.key"
            >
              {{ option.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div class="min-w-0 self-center">
          <div class="flex min-w-0 gap-2">
            <div
              class="usage-weekdays mt-6 grid shrink-0 text-center text-[10px] text-[var(--text-tertiary)]"
              aria-hidden="true"
            >
              <span v-for="weekday in weekdays" :key="weekday">{{
                weekday
              }}</span>
            </div>
            <div
              ref="scroller"
              class="subtle-scroll min-w-0 flex-1 overflow-x-auto pb-2"
              data-usage-scroll
            >
              <div
                class="usage-heat-content"
                :style="{ '--usage-weeks': view.weekCount } as CSSProperties"
              >
                <div class="usage-months mb-1.5" aria-hidden="true">
                  <span
                    v-for="(label, index) in monthLabels"
                    :key="index"
                    class="truncate text-[10px] text-[var(--text-tertiary)]"
                  >
                    {{ label }}
                  </span>
                </div>
                <div
                  class="usage-grid"
                  role="grid"
                  :aria-label="
                    t('dashboard.distribution.gridLabel', {
                      period: periodLabel,
                      metric: metricLabel,
                    })
                  "
                >
                  <button
                    v-for="{ cell, column, row } in visibleCells"
                    :key="cell.date"
                    type="button"
                    class="usage-cell focus-ring"
                    :style="[
                      cellStyle(cell),
                      { gridColumn: column, gridRow: row },
                    ]"
                    :tabindex="focusDate === cell.date ? 0 : -1"
                    :aria-label="cellLabel(cell)"
                    :aria-describedby="
                      tooltip?.date === cell.date ? tooltipId : undefined
                    "
                    :data-usage-date="cell.date"
                    :data-usage-level="cell.level"
                    role="gridcell"
                    @focus="onCellFocus($event, cell)"
                    @blur="hideTooltip(cell.date)"
                    @mouseenter="showTooltip($event, cell)"
                    @mouseleave="hideTooltip(cell.date)"
                    @keydown="onCellKeydown($event, cell)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            class="mt-1.5 flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]"
          >
            <span>{{ t('dashboard.distribution.less') }}</span>
            <span
              v-for="level in [0, 1, 2, 3, 4, 5] as const"
              :key="level"
              class="h-2.5 w-2.5 rounded-sm border"
              :style="
                cellStyle({
                  date: '',
                  value: level,
                  level,
                  inRange: true,
                  future: false,
                  monthKey: '',
                })
              "
            />
            <span>{{ t('dashboard.distribution.more') }}</span>
          </div>
        </div>

        <aside
          class="grid gap-4 border-t border-[var(--border-subtle)] pt-3 min-[360px]:grid-cols-2 lg:block lg:space-y-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
        >
          <section>
            <h3 class="text-xs font-medium text-[var(--text-tertiary)]">
              {{ t('dashboard.distribution.topDays') }}
            </h3>
            <div v-if="view.topDays.length" class="mt-2 space-y-2">
              <div v-for="day in view.topDays" :key="day.date">
                <div class="flex items-center justify-between gap-2 text-xs">
                  <span class="text-[var(--text-secondary)]">{{
                    formatDate(day.date)
                  }}</span>
                  <span
                    class="font-mono tabular-nums text-[var(--text-primary)]"
                    >{{ formatMetric(day.value) }}</span
                  >
                </div>
                <div
                  class="mt-1 h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div
                    class="h-full rounded-full"
                    :style="{
                      width: `${maxTopDay ? (day.value / maxTopDay) * 100 : 0}%`,
                      background: metricColor,
                    }"
                  />
                </div>
              </div>
            </div>
            <p v-else class="mt-3 text-xs text-[var(--text-tertiary)]">
              {{ t('dashboard.stats.noData') }}
            </p>
          </section>

          <section>
            <h3 class="text-xs font-medium text-[var(--text-tertiary)]">
              {{ t('dashboard.distribution.weekdayRhythm') }}
            </h3>
            <div class="mt-2 space-y-1">
              <div
                v-for="entry in view.weekdays"
                :key="entry.weekday"
                class="grid grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 text-[10px]"
              >
                <span class="text-[var(--text-tertiary)]">{{
                  weekdays[entry.weekday]
                }}</span>
                <div
                  class="h-1 overflow-hidden rounded-full bg-[var(--surface-muted)]"
                >
                  <div
                    class="h-full rounded-full opacity-70"
                    :style="{
                      width: `${maxWeekday ? (entry.value / maxWeekday) * 100 : 0}%`,
                      background: metricColor,
                    }"
                  />
                </div>
                <span
                  class="w-12 truncate text-right font-mono tabular-nums text-[var(--text-secondary)]"
                  >{{ formatMetric(entry.value) }}</span
                >
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div
        v-if="tooltip"
        :id="tooltipId"
        class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-3 py-2 text-xs text-[var(--text-primary)] shadow-[var(--overlay-shadow)]"
        :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
        role="tooltip"
      >
        {{ tooltip.label }}
      </div>
    </div>
  </ConsoleCard>
</template>

<style scoped>
.usage-heat-content {
  --usage-cell-size: 21px;
  --usage-gap: 3px;
  width: calc(
    var(--usage-weeks) * (var(--usage-cell-size) + var(--usage-gap)) -
      var(--usage-gap)
  );
}

.usage-months {
  display: grid;
  grid-template-columns: repeat(var(--usage-weeks), var(--usage-cell-size));
  gap: var(--usage-gap);
}

.usage-grid {
  display: grid;
  grid-template-columns: repeat(var(--usage-weeks), var(--usage-cell-size));
  grid-template-rows: repeat(7, var(--usage-cell-size));
  gap: var(--usage-gap);
}

.usage-weekdays {
  grid-template-rows: repeat(7, 21px);
  gap: 3px;
}

.usage-weekdays > span {
  display: flex;
  align-items: center;
  justify-content: center;
}

.usage-cell {
  display: block;
  width: var(--usage-cell-size);
  height: var(--usage-cell-size);
  border: 1px solid;
  border-radius: 5px;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

button.usage-cell:hover,
button.usage-cell:focus-visible {
  position: relative;
  z-index: 1;
  transform: translateY(-1px);
}

@media (max-width: 639px) {
  .usage-heat-content {
    --usage-cell-size: 20px;
    --usage-gap: 3px;
  }

  .usage-weekdays {
    grid-template-rows: repeat(7, 20px);
    gap: 3px;
  }
}
</style>
