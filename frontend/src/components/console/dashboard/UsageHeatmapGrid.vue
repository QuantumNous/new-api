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

import { formatCompact, formatNumber, formatQuota } from '@/utils/format'
import {
  shiftUsageDate,
  type UsageDistributionMetric,
  type UsageDistributionPeriod,
  type UsageDistributionView,
  type UsageHeatmapCell,
} from '@/utils/usageDistribution'

const props = defineProps<{
  view: UsageDistributionView
  period: UsageDistributionPeriod
  metric: UsageDistributionMetric
  metricColor: string
  periodLabel: string
  metricLabel: string
}>()

const { t, locale } = useI18n()
const root = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const focusDate = ref('')
const tooltipId = useId()
const tooltip = ref<{
  date: string
  label: string
  left: number
  top: number
} | null>(null)
const dragging = ref(false)
let dragStartX = 0
let dragStartScroll = 0
let suppressClick = false

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

const visibleCells = computed(() => {
  return props.view.cells.flatMap((cell, index) => {
    if (!cell.inRange || cell.future) return []

    let column: number
    let row: number
    if (props.period === 'month') {
      column = (index % 7) + 1
      row = Math.floor(index / 7) + 1
    } else {
      column = Math.floor(index / 7) + 1
      row = (index % 7) + 1
    }
    return [{ cell, column, row }]
  })
})

const calendarRows = computed(() => Math.ceil(props.view.cells.length / 7))

const monthMarkers = computed(() => {
  const weeks = Array.from({ length: props.view.weekCount }, (_, index) =>
    props.view.cells.slice(index * 7, index * 7 + 7)
  )
  const markers = weeks.flatMap((week, index) => {
    const monthStart = week.find((cell) => cell.date.endsWith('-01'))
    const source =
      monthStart ?? (index === 0 ? week.find((cell) => cell.inRange) : null)
    if (!source) return []
    const [year, month] = source.monthKey.split('-').map(Number)
    return [
      {
        key: source.monthKey,
        column: index + 1,
        label: new Intl.DateTimeFormat(locale.value, {
          month: 'short',
        }).format(new Date(year!, month! - 1, 1)),
      },
    ]
  })

  return markers.map((marker, index) => ({
    ...marker,
    span:
      (markers[index + 1]?.column ?? props.view.weekCount + 1) - marker.column,
  }))
})

function formatMetric(value: number): string {
  if (props.metric === 'consume') return formatQuota(value)
  if (props.metric === 'tokens') return formatCompact(Math.round(value))
  return formatNumber(Math.round(value))
}

function fromDateKey(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year!, month! - 1, day)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    day: 'numeric',
  }).format(fromDateKey(date))
}

function dayNumber(date: string): number {
  return fromDateKey(date).getDate()
}

function denseWeekdayLabel(index: number): string {
  if (props.period !== 'year') return weekdays.value[index]!
  return index % 2 === 0 || index === 6 ? weekdays.value[index]! : ''
}

function cellStyle(cell: UsageHeatmapCell): CSSProperties {
  if (cell.level === 0) {
    return {
      background: 'var(--surface-muted)',
      borderColor: 'var(--border-subtle)',
    }
  }
  const amount = [0, 20, 34, 50, 68, 88][cell.level]
  return {
    background: `color-mix(in srgb, ${props.metricColor} ${amount}%, var(--surface-solid))`,
    borderColor: `color-mix(in srgb, ${props.metricColor} ${Math.min(96, amount + 8)}%, var(--border-subtle))`,
  }
}

function cellLabel(cell: UsageHeatmapCell): string {
  return t('dashboard.distribution.cellLabel', {
    date: formatDate(cell.date),
    metric: props.metricLabel,
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
      rootRect.width - 84,
      Math.max(84, targetRect.left - rootRect.left + targetRect.width / 2)
    ),
    top: targetRect.top - rootRect.top - 6,
  }
}

function hideTooltip(date: string) {
  if (tooltip.value?.date === date) tooltip.value = null
}

function onCellFocus(event: FocusEvent, cell: UsageHeatmapCell) {
  focusDate.value = cell.date
  showTooltip(event, cell)
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
  const active = visibleCells.value
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const target = event.key === 'Home' ? active[0] : active.at(-1)
    if (target) void focusCell(target.cell.date)
    return
  }

  let days: number
  if (event.key === 'ArrowUp') days = -7
  else if (event.key === 'ArrowDown') days = 7
  else if (event.key === 'ArrowLeft') days = props.period === 'month' ? -1 : -7
  else if (event.key === 'ArrowRight') days = props.period === 'month' ? 1 : 7
  else return

  event.preventDefault()
  void focusCell(shiftUsageDate(cell.date, days))
}

async function alignLatest() {
  await nextTick()
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
}

function onScrollPointerDown(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (event.button !== 0 || target.scrollWidth <= target.clientWidth) return
  dragging.value = true
  suppressClick = false
  dragStartX = event.clientX
  dragStartScroll = target.scrollLeft
  target.setPointerCapture?.(event.pointerId)
}

function onScrollPointerMove(event: PointerEvent) {
  if (!dragging.value) return
  const target = event.currentTarget as HTMLElement
  const distance = event.clientX - dragStartX
  if (Math.abs(distance) > 3) suppressClick = true
  target.scrollLeft = dragStartScroll - distance
  event.preventDefault()
}

function onScrollPointerEnd(event: PointerEvent) {
  if (!dragging.value) return
  const target = event.currentTarget as HTMLElement
  dragging.value = false
  if (target.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
}

function onScrollClickCapture(event: MouseEvent) {
  if (!suppressClick) return
  event.preventDefault()
  event.stopPropagation()
  suppressClick = false
}

watch(
  () => [props.view, props.period] as const,
  () => {
    const active = visibleCells.value
    if (!active.some((entry) => entry.cell.date === focusDate.value)) {
      focusDate.value = active.at(-1)?.cell.date ?? ''
    }
    tooltip.value = null
    void alignLatest()
  },
  { immediate: true }
)

onMounted(() => void alignLatest())
</script>

<template>
  <div ref="root" class="relative min-w-0" :data-usage-layout="period">
    <div
      v-if="period === 'month'"
      ref="scroller"
      class="subtle-scroll min-w-0 overflow-x-auto pb-1"
      data-usage-scroll
    >
      <div class="usage-month-calendar">
        <div class="usage-calendar-weekdays" aria-hidden="true">
          <span v-for="weekday in weekdays" :key="weekday">{{ weekday }}</span>
        </div>
        <div
          class="usage-month-grid"
          :style="{ '--usage-calendar-rows': calendarRows } as CSSProperties"
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
            class="usage-month-cell focus-ring"
            :style="[cellStyle(cell), { gridColumn: column, gridRow: row }]"
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
          >
            {{ dayNumber(cell.date) }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="flex min-w-0 gap-2">
      <div
        class="usage-dense-weekdays mt-[22px] grid shrink-0 text-center text-[9px] text-[var(--text-tertiary)]"
        :data-period="period"
        aria-hidden="true"
      >
        <span v-for="(_, index) in weekdays" :key="index">
          {{ denseWeekdayLabel(index) }}
        </span>
      </div>
      <div
        ref="scroller"
        class="subtle-scroll min-w-0 flex-1 overflow-x-auto pb-1"
        :class="{
          'usage-drag-scroll': period === 'year',
          'is-dragging': period === 'year' && dragging,
        }"
        data-usage-scroll
        :data-usage-draggable="period === 'year' || undefined"
        @pointerdown="onScrollPointerDown"
        @pointermove="onScrollPointerMove"
        @pointerup="onScrollPointerEnd"
        @pointercancel="onScrollPointerEnd"
        @click.capture="onScrollClickCapture"
      >
        <div
          class="usage-dense-content"
          :data-period="period"
          :style="{ '--usage-weeks': view.weekCount } as CSSProperties"
        >
          <div class="usage-dense-months mb-1.5" aria-hidden="true">
            <span
              v-for="marker in monthMarkers"
              :key="marker.key"
              class="whitespace-nowrap pl-0.5 text-[9px] text-[var(--text-tertiary)]"
              :style="{
                gridColumn: `${marker.column} / span ${marker.span}`,
              }"
              :data-usage-month="marker.label"
            >
              {{ marker.label }}
            </span>
          </div>
          <div
            class="usage-dense-grid"
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
              class="usage-dense-cell focus-ring"
              :style="[cellStyle(cell), { gridColumn: column, gridRow: row }]"
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
      v-if="tooltip"
      :id="tooltipId"
      class="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] shadow-[var(--overlay-shadow)]"
      :style="{ left: `${tooltip.left}px`, top: `${tooltip.top}px` }"
      role="tooltip"
    >
      {{ tooltip.label }}
    </div>
  </div>
</template>

<style scoped>
.usage-month-calendar {
  --usage-calendar-width: 32px;
  --usage-calendar-height: 24px;
  --usage-calendar-column-gap: 3px;
  --usage-calendar-row-gap: 3px;
  width: calc(
    7 * var(--usage-calendar-width) + 6 * var(--usage-calendar-column-gap)
  );
}

.usage-calendar-weekdays,
.usage-month-grid {
  display: grid;
  grid-template-columns: repeat(7, var(--usage-calendar-width));
  column-gap: var(--usage-calendar-column-gap);
}

.usage-calendar-weekdays {
  margin-bottom: 4px;
  text-align: center;
  font-size: 9px;
  color: var(--text-tertiary);
}

.usage-month-grid {
  grid-template-rows: repeat(
    var(--usage-calendar-rows),
    var(--usage-calendar-height)
  );
  row-gap: var(--usage-calendar-row-gap);
}

.usage-month-cell {
  display: flex;
  width: var(--usage-calendar-width);
  height: var(--usage-calendar-height);
  align-items: flex-start;
  justify-content: flex-start;
  border: 1px solid;
  border-radius: 6px;
  padding: 3px 5px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
  line-height: 1;
  color: var(--text-primary);
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

.usage-dense-content {
  --usage-cell-size: 18px;
  --usage-gap: 2px;
  width: calc(
    var(--usage-weeks) * (var(--usage-cell-size) + var(--usage-gap)) -
      var(--usage-gap)
  );
}

.usage-dense-content[data-period='year'] {
  --usage-cell-size: 10px;
  --usage-gap: 2px;
}

.usage-dense-months,
.usage-dense-grid {
  display: grid;
  grid-template-columns: repeat(var(--usage-weeks), var(--usage-cell-size));
  gap: var(--usage-gap);
}

.usage-dense-grid {
  grid-template-rows: repeat(7, var(--usage-cell-size));
}

.usage-dense-weekdays {
  grid-template-rows: repeat(7, 18px);
  gap: 2px;
}

.usage-dense-weekdays[data-period='year'] {
  grid-template-rows: repeat(7, 10px);
  gap: 2px;
}

.usage-dense-weekdays > span {
  display: flex;
  align-items: center;
  justify-content: center;
}

.usage-dense-cell {
  display: block;
  width: var(--usage-cell-size);
  height: var(--usage-cell-size);
  border: 1px solid;
  border-radius: 4px;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    background-color 120ms ease;
}

.usage-dense-content[data-period='year'] .usage-dense-cell {
  border-radius: 3px;
}

.usage-drag-scroll {
  cursor: grab;
  scrollbar-width: none;
  touch-action: pan-y;
  user-select: none;
}

.usage-drag-scroll::-webkit-scrollbar {
  display: none;
}

.usage-drag-scroll.is-dragging {
  cursor: grabbing;
}

.usage-month-cell:hover,
.usage-month-cell:focus-visible,
.usage-dense-cell:hover,
.usage-dense-cell:focus-visible {
  position: relative;
  z-index: 1;
  transform: translateY(-1px);
}

@media (max-width: 359px) {
  .usage-month-calendar {
    --usage-calendar-width: 30px;
    --usage-calendar-height: 23px;
    --usage-calendar-column-gap: 3px;
    --usage-calendar-row-gap: 3px;
  }
}

@media (min-width: 640px) {
  .usage-month-calendar {
    --usage-calendar-width: 42px;
    --usage-calendar-height: 24px;
    --usage-calendar-column-gap: 5px;
    --usage-calendar-row-gap: 3px;
  }

  .usage-calendar-weekdays {
    margin-bottom: 4px;
    font-size: 9px;
  }

  .usage-month-cell {
    border-radius: 7px;
    padding: 4px 6px;
    font-size: 10px;
  }
}

@media (min-width: 1024px) {
  .usage-dense-content[data-period='quarter'] {
    --usage-cell-size: 21px;
  }

  .usage-dense-weekdays[data-period='quarter'] {
    grid-template-rows: repeat(7, 21px);
  }

  .usage-dense-content[data-period='year'] {
    --usage-cell-size: 14px;
  }

  .usage-dense-weekdays[data-period='year'] {
    grid-template-rows: repeat(7, 14px);
  }
}
</style>
