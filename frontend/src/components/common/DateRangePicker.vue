<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

/**
 * Themed date-range picker (contract: LogsView filter toolbar).
 * Trigger matches FilterSelect's chrome (rounded-xl + --surface-muted, focus
 * --border-strong); the popover consumes the floating-layer overlay tokens so
 * it reads as the same material as the topbar dropdowns (THEMES.md §1.2).
 * Emits 'YYYY-MM-DD' strings via v-model:start / v-model:end.
 */

const { t, locale } = useI18n()

const start = defineModel<string>('start', { default: '' })
const end = defineModel<string>('end', { default: '' })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    /** open the panel upward — use when the control sits near the page bottom */
    direction?: 'down' | 'up'
  }>(),
  { placeholder: '', direction: 'down' }
)

/* ---------- date helpers (all local-time, string-keyed 'YYYY-MM-DD') ---------- */
function keyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
const todayKey = () => keyOf(new Date())

interface DayCell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
}

/** 6-row × 7-col grid for the given month, weeks starting Monday. */
function monthCells(year: number, month: number): DayCell[] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Mon=0 … Sun=6
  const cursor = addDays(first, -offset)
  const cells: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = addDays(cursor, i)
    cells.push({
      key: keyOf(d),
      day: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: keyOf(d) === todayKey(),
    })
  }
  return cells
}

/* ---------- popover state ---------- */
const root = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const open = ref(false)
const panelId = useId()
const panelTitleId = useId()
const focusKey = ref('')

/**
 * Left (anchor) visible month as 'YYYY-MM'. Kept in local state while open so
 * navigating doesn't mutate the model; synced from the selection when opened.
 */
const now = new Date()
const anchor = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
)

const anchorYear = computed(() => Number(anchor.value.split('-')[0]))
const anchorMonth = computed(() => Number(anchor.value.split('-')[1]) - 1)

const rightMonth = computed(() => {
  const d = new Date(anchorYear.value, anchorMonth.value + 1, 1)
  return { year: d.getFullYear(), month: d.getMonth() }
})

const leftCells = computed(() =>
  monthCells(anchorYear.value, anchorMonth.value)
)
const rightCells = computed(() =>
  monthCells(rightMonth.value.year, rightMonth.value.month)
)

const monthTitle = (year: number, month: number) =>
  locale.value.startsWith('zh')
    ? `${year} 年 ${month + 1} 月`
    : `${year}-${String(month + 1).padStart(2, '0')}`

const weekDays = computed(() => {
  // Monday-first labels; pick short localized names.
  const base = new Date(2024, 0, 1) // 2024-01-01 was a Monday
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale.value, { weekday: 'short' }).format(
      addDays(base, i)
    )
  )
})

function shiftAnchor(delta: number) {
  const d = new Date(anchorYear.value, anchorMonth.value + delta, 1)
  anchor.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function openPanel() {
  // Anchor the left month on the current selection (or today) when opening.
  const seed = start.value ? fromKey(start.value) : new Date()
  anchor.value = `${seed.getFullYear()}-${String(seed.getMonth() + 1).padStart(2, '0')}`
  hoverKey.value = ''
  focusKey.value = keyOf(seed)
  open.value = true
  nextTick(() => focusDay(focusKey.value))
}
function closePanel(restoreFocus = false) {
  open.value = false
  hoverKey.value = ''
  if (restoreFocus) nextTick(() => triggerRef.value?.focus())
}
function toggle() {
  if (open.value) closePanel()
  else openPanel()
}

const panelRef = ref<HTMLElement | null>(null)
onClickOutside(root, () => closePanel())

/* ---------- range selection ---------- */
const hoverKey = ref('')

/** Effective end shown while picking: committed end, else live hover preview. */
const previewEnd = computed(() => end.value || hoverKey.value)

function inRange(key: string): boolean {
  if (!start.value || !previewEnd.value) return false
  const [a, b] =
    start.value <= previewEnd.value
      ? [start.value, previewEnd.value]
      : [previewEnd.value, start.value]
  return key > a && key < b
}
function isStart(key: string) {
  return Boolean(start.value) && key === start.value
}
function isEnd(key: string) {
  return Boolean(end.value) && key === end.value
}

function pick(key: string) {
  if (!start.value || (start.value && end.value)) {
    // Begin a fresh range.
    start.value = key
    end.value = ''
    return
  }
  // Completing the range — swap so start <= end.
  if (key < start.value) {
    end.value = start.value
    start.value = key
  } else {
    end.value = key
  }
  apply()
}

function applyPreset(s: string, e: string) {
  start.value = s
  end.value = e
  apply()
}

function clear() {
  start.value = ''
  end.value = ''
  hoverKey.value = ''
}

function apply() {
  closePanel()
}

/* ---------- presets ---------- */
const presets = computed(() => {
  const t0 = new Date()
  const today = keyOf(t0)
  const yesterday = keyOf(addDays(t0, -1))
  const monthStart = keyOf(new Date(t0.getFullYear(), t0.getMonth(), 1))
  return [
    { label: t('logs.rangeToday'), s: today, e: today },
    { label: t('logs.rangeYesterday'), s: yesterday, e: yesterday },
    { label: t('logs.rangeLast7'), s: keyOf(addDays(t0, -6)), e: today },
    { label: t('logs.rangeLast30'), s: keyOf(addDays(t0, -29)), e: today },
    { label: t('logs.rangeThisMonth'), s: monthStart, e: today },
  ]
})

const activePreset = computed(() => {
  if (!start.value || !end.value) return -1
  return presets.value.findIndex(
    (p) => p.s === start.value && p.e === end.value
  )
})

/* ---------- trigger label ---------- */
const fmtShort = (key: string) =>
  key.slice(2).replace('-', '/').replace('-', '/') // YY/MM/DD
const triggerLabel = computed(() => {
  if (start.value && end.value)
    return `${fmtShort(start.value)} ~ ${fmtShort(end.value)}`
  if (start.value) return `${fmtShort(start.value)} ~`
  return props.placeholder || t('logs.selectDateRange')
})
const hasValue = computed(() => Boolean(start.value || end.value))

/* ---------- keyboard ---------- */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    e.stopPropagation()
    closePanel(true)
  } else if ((e.key === 'Enter' || e.key === ' ') && !open.value) {
    e.preventDefault()
    openPanel()
  }
}

function addMonthsClamped(date: Date, delta: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0
  ).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return target
}

async function focusDay(key: string): Promise<void> {
  const target = fromKey(key)
  const targetAnchor = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}`
  if (targetAnchor !== anchor.value) {
    anchor.value = targetAnchor
    await nextTick()
  }
  focusKey.value = key
  await nextTick()
  const button = Array.from(
    panelRef.value?.querySelectorAll<HTMLButtonElement>('[data-date-key]') ?? []
  ).find(
    (candidate) =>
      candidate.dataset.dateKey === key && candidate.dataset.inMonth === 'true'
  )
  button?.focus()
}

function onDayKeydown(event: KeyboardEvent, key: string): void {
  const date = fromKey(key)
  let target: Date

  if (event.key === 'ArrowLeft') target = addDays(date, -1)
  else if (event.key === 'ArrowRight') target = addDays(date, 1)
  else if (event.key === 'ArrowUp') target = addDays(date, -7)
  else if (event.key === 'ArrowDown') target = addDays(date, 7)
  else if (event.key === 'Home')
    target = addDays(date, -((date.getDay() + 6) % 7))
  else if (event.key === 'End')
    target = addDays(date, 6 - ((date.getDay() + 6) % 7))
  else if (event.key === 'PageUp') target = addMonthsClamped(date, -1)
  else if (event.key === 'PageDown') target = addMonthsClamped(date, 1)
  else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    pick(key)
    return
  } else {
    return
  }

  event.preventDefault()
  void focusDay(keyOf(target))
}
</script>

<template>
  <div ref="root" class="relative h-10" @keydown="onKeydown">
    <!-- trigger -->
    <button
      ref="triggerRef"
      type="button"
      class="pencil-control flex h-full w-full items-center gap-2 rounded-xl border px-3.5 text-left text-sm transition-colors focus-ring"
      data-handdrawn="control"
      :class="[
        open || hasValue
          ? 'border-[var(--border-strong)] bg-[var(--surface-solid)]'
          : 'border-transparent bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)]',
        hasValue ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]',
      ]"
      aria-haspopup="dialog"
      :aria-label="t('logs.selectDateRange')"
      :aria-expanded="open"
      :aria-controls="panelId"
      @click="toggle"
    >
      <svg
        class="shrink-0 text-[var(--text-tertiary)]"
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
      <span class="min-w-0 flex-1 truncate">{{ triggerLabel }}</span>
      <span
        v-if="hasValue"
        role="button"
        tabindex="-1"
        class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
        :aria-label="t('logs.clear')"
        @click.stop="clear"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          aria-hidden="true"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </span>
      <svg
        v-else
        class="shrink-0 text-[var(--text-tertiary)] transition-transform"
        :class="open ? 'rotate-180' : ''"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- popover panel -->
    <Transition name="drp-pop">
      <div
        v-if="open"
        :id="panelId"
        ref="panelRef"
        class="absolute left-1/2 z-50 w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-2xl border bg-[var(--surface-overlay)] shadow-[var(--overlay-shadow)] sm:left-auto sm:right-0 sm:w-[560px] sm:translate-x-0"
        :class="direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'"
        style="border-color: var(--overlay-border)"
        role="dialog"
        aria-modal="false"
        data-handdrawn="menu"
        :aria-labelledby="panelTitleId"
      >
        <h2 :id="panelTitleId" class="sr-only">
          {{ t('logs.selectDateRange') }}
        </h2>
        <div class="flex">
          <!-- preset rail -->
          <div
            class="hidden w-32 shrink-0 flex-col gap-0.5 border-r p-2 sm:flex"
            style="border-color: var(--border-subtle)"
          >
            <button
              v-for="(p, i) in presets"
              :key="p.label"
              type="button"
              class="rounded-lg px-3 py-2 text-left text-sm transition-colors"
              :class="
                i === activePreset
                  ? 'bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]'
              "
              @click="applyPreset(p.s, p.e)"
            >
              {{ p.label }}
            </button>
          </div>

          <!-- calendars -->
          <div class="min-w-0 flex-1 p-3">
            <!-- nav header -->
            <div class="mb-2 flex items-center justify-between px-1">
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
                :aria-label="t('logs.prevMonth')"
                @click="shiftAnchor(-1)"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div
                class="flex flex-1 items-center justify-around text-sm font-semibold text-[var(--text-primary)]"
              >
                <span>{{ monthTitle(anchorYear, anchorMonth) }}</span>
                <span class="hidden sm:block">{{
                  monthTitle(rightMonth.year, rightMonth.month)
                }}</span>
              </div>
              <button
                type="button"
                class="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-tertiary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
                :aria-label="t('logs.nextMonth')"
                @click="shiftAnchor(1)"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div
                v-for="(cells, gi) in [leftCells, rightCells]"
                :key="gi"
                :class="gi === 1 ? 'hidden sm:block' : ''"
              >
                <!-- weekday header -->
                <div
                  class="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-[var(--text-tertiary)]"
                >
                  <span v-for="w in weekDays" :key="w" class="py-1">{{
                    w
                  }}</span>
                </div>
                <!-- day grid -->
                <div class="grid grid-cols-7">
                  <button
                    v-for="c in cells"
                    :key="c.key"
                    type="button"
                    :data-today="c.isToday ? 'true' : undefined"
                    :data-date-key="c.key"
                    :data-in-month="c.inMonth ? 'true' : 'false'"
                    :tabindex="focusKey === c.key && c.inMonth ? 0 : -1"
                    class="relative flex h-9 items-center justify-center text-[13px] transition-colors focus-ring"
                    :class="[
                      !c.inMonth
                        ? 'text-[var(--text-tertiary)] opacity-45'
                        : 'text-[var(--text-primary)]',
                      isStart(c.key) || isEnd(c.key)
                        ? 'font-semibold'
                        : inRange(c.key)
                          ? 'bg-[var(--accent-soft)]'
                          : 'hover:bg-[var(--surface-muted)]',
                    ]"
                    @click="pick(c.key)"
                    @focus="focusKey = c.key"
                    @keydown="onDayKeydown($event, c.key)"
                    @mouseenter="hoverKey = start && !end ? c.key : hoverKey"
                  >
                    <span
                      class="relative z-10 flex h-7 w-7 items-center justify-center rounded-full"
                      :class="[
                        isStart(c.key) || isEnd(c.key)
                          ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                          : '',
                        c.isToday && !(isStart(c.key) || isEnd(c.key))
                          ? 'ring-1 ring-[var(--signal)]'
                          : '',
                      ]"
                      >{{ c.day }}</span
                    >
                  </button>
                </div>
              </div>
            </div>

            <!-- footer -->
            <div
              class="mt-3 flex items-center justify-between border-t pt-3"
              style="border-color: var(--border-subtle)"
            >
              <span
                class="min-w-0 truncate text-xs text-[var(--text-tertiary)]"
              >
                {{ hasValue ? triggerLabel : t('logs.selectDateRange') }}
              </span>
              <div class="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-ring"
                  @click="clear"
                >
                  {{ t('logs.clear') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors focus-ring"
                  :class="
                    start && end
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]'
                      : 'cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-tertiary)]'
                  "
                  :disabled="!(start && end)"
                  @click="apply"
                >
                  {{ t('logs.apply') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.drp-pop-enter-active,
.drp-pop-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s cubic-bezier(0.2, 0.6, 0.2, 1);
}
.drp-pop-enter-from,
.drp-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
