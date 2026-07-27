<script setup lang="ts" generic="T extends Record<string, unknown>">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  useId,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'

import EmptyState from './EmptyState.vue'

export interface TableColumn {
  key: string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
}

const { t } = useI18n()

const props = withDefaults(
  defineProps<{
    columns: TableColumn[]
    rows: T[]
    rowKey: keyof T & string
    loading?: boolean
    selectable?: boolean
    selected?: Array<string | number>
    /** Keys affected by the header checkbox. Defaults to rendered data rows. */
    selectionKeys?: Array<string | number>
    selectionDisabled?: boolean
    /**
     * Per-row selection guard. A row that fails it renders a disabled checkbox
     * and cannot be toggled, so a selection can never contain rows the caller
     * would have to silently drop when acting on it.
     */
    rowSelectable?: (row: T) => boolean
    /** Checkbox visual: default square native look, or round custom-drawn. */
    checkboxShape?: 'square' | 'round'
    /** Emit row-click on tbody rows. */
    rowClickable?: boolean
    /** Emit row-dblclick on tbody rows without making single clicks actionable. */
    rowDblclickable?: boolean
    /** Optional per-row visual class for states such as disabled records. */
    rowClass?: (row: T) => string | undefined
    /** Identifies semantic group-heading rows rendered through #group-row. */
    isGroupRow?: (row: T) => boolean
    emptyTitle?: string
    emptyHint?: string
    /** Hand-drawn illustration name for the empty state. Tables mostly empty
        out from filters, so the search spot is the default. */
    emptyIllustration?: string
    /** Skeleton row count while loading. Pass the page size so the loading
        state occupies the same height as a full page and the layout doesn't
        jump when paginating. */
    skeletonRows?: number
    /**
     * Enables viewport-aware inner scrolling. A short page keeps its natural
     * height; a full overflowing page is capped only after accounting for the
     * sticky console header and the pagination footer.
     */
    adaptiveScroll?: boolean
    /** Current server page size. Changing it resets the body scroll position. */
    pageSize?: number
    /** Accessible name for the independently scrollable row region. */
    scrollRegionLabel?: string
    /** Minimum table width before the body switches to horizontal scrolling. */
    minTableWidth?: string
    /** Visual breathing room below the table and footer, matching main py-8. */
    viewportBottomGap?: number
    /** Element whose bottom edge is the outer-to-inner scroll handoff point. */
    scrollBoundarySelector?: string
    /** The actual scrollable container. Scroll events on this element trigger the
        outer→inner handoff check. Must not be window/document. */
    scrollZoneSelector?: string
  }>(),
  {
    loading: false,
    selectable: false,
    selected: () => [],
    selectionKeys: () => [],
    selectionDisabled: false,
    checkboxShape: 'square',
    rowClickable: false,
    rowClass: undefined,
    rowSelectable: undefined,
    isGroupRow: undefined,
    emptyTitle: '',
    emptyHint: '',
    emptyIllustration: 'empty-search',
    skeletonRows: 5,
    adaptiveScroll: false,
    pageSize: 0,
    scrollRegionLabel: '',
    minTableWidth: '720px',
    viewportBottomGap: 32,
    scrollBoundarySelector: '[data-console-scroll-boundary]',
    scrollZoneSelector: '[data-console-scroll-zone]',
  }
)

const emit = defineEmits<{
  'update:selected': [keys: Array<string | number>]
  'row-click': [row: T]
  'row-dblclick': [row: T]
}>()

// `checkbox-round` lives in styles/console.css so the table, the mobile lists
// and any future admin surface share one definition.
const checkboxClass = computed(() =>
  props.checkboxShape === 'round'
    ? 'checkbox-round'
    : 'h-4 w-4 accent-[var(--accent)]'
)

const rowInteractive = computed(
  () => props.rowClickable || props.rowDblclickable
)

const dataRows = computed(() =>
  props.isGroupRow
    ? props.rows.filter((row) => !props.isGroupRow?.(row))
    : props.rows
)

const effectiveSelectionKeys = computed(() =>
  props.selectionKeys.length > 0
    ? props.selectionKeys
    : dataRows.value
        .filter((row) => props.rowSelectable?.(row) ?? true)
        .map((row) => row[props.rowKey] as string | number)
)

const allChecked = computed(
  () =>
    effectiveSelectionKeys.value.length > 0 &&
    effectiveSelectionKeys.value.every((key) => props.selected.includes(key))
)

function toggleAll() {
  if (props.selectionDisabled) return
  if (allChecked.value) {
    emit('update:selected', [])
  } else {
    emit('update:selected', [...effectiveSelectionKeys.value])
  }
}

/**
 * A row the caller marks unselectable gets a disabled checkbox rather than a
 * silently ignored one, so the selection can never contain a key the consumer
 * would have to filter back out.
 */
function isRowSelectable(row: T): boolean {
  return props.rowSelectable?.(row) ?? true
}

function toggleRow(row: T) {
  if (props.selectionDisabled || !isRowSelectable(row)) return
  const key = row[props.rowKey] as string | number
  const next = props.selected.includes(key)
    ? props.selected.filter((k) => k !== key)
    : [...props.selected, key]
  emit('update:selected', next)
}

function activateRowFromKeyboard(event: KeyboardEvent, row: T) {
  if (!rowInteractive.value || event.target !== event.currentTarget) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  if (props.rowDblclickable) {
    emit('row-dblclick', row)
  } else {
    emit('row-click', row)
  }
}

function dataRowNumber(row: T): number {
  return dataRows.value.indexOf(row) + 1
}

const alignClass = (align?: string) =>
  align === 'right'
    ? 'text-right'
    : align === 'center'
      ? 'text-center'
      : 'text-left'

const tableId = useId()
const columnHeaderId = (key: string) => `${tableId}-column-${key}`

/* ---- split header / body scrolling -------------------------------------
 * The vertical scrollbar belongs only to bodyViewportRef, so its track starts
 * below the visible header. Both tables use the same colgroup and fixed table
 * layout; horizontal body scrolling is mirrored onto the clipped header.
 */
const headerClipRef = ref<HTMLElement | null>(null)
const headerTableRef = ref<HTMLTableElement | null>(null)
const bodyViewportRef = ref<HTMLElement | null>(null)
const bodyTableRef = ref<HTMLTableElement | null>(null)
const footerRef = ref<HTMLElement | null>(null)

const constrained = ref(false)
const innerScrollActive = ref(false)
const horizontalScrollAvailable = ref(false)
const bodyMaxHeight = ref(0)
const headerViewportWidth = ref(0)

const bodyViewportStyle = computed(() => {
  if (!constrained.value) {
    return {
      maxHeight: 'none',
      overflowY: 'visible' as const,
    }
  }
  return {
    maxHeight: `${bodyMaxHeight.value}px`,
    overflowY: innerScrollActive.value
      ? ('auto' as const)
      : ('hidden' as const),
  }
})

const scrollRegionAvailable = computed(
  () => horizontalScrollAvailable.value || innerScrollActive.value
)

const headerClipStyle = computed(() =>
  headerViewportWidth.value > 0
    ? { width: `${headerViewportWidth.value}px` }
    : undefined
)

let boundaryElement: HTMLElement | null = null
let scrollZoneEl: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let measureFrame = 0
let lastScrollLeft = -1
let stickyBottom = 0
let pointerFocusPending = false
let pointerFocusTimer = 0

function visualViewportBottom() {
  const viewport = window.visualViewport
  return viewport ? viewport.offsetTop + viewport.height : window.innerHeight
}

function minimumUsefulBodyHeight() {
  const rows =
    bodyTableRef.value?.querySelectorAll<HTMLTableRowElement>('tbody tr')
  if (!rows?.length) return 0
  return Array.from(rows)
    .slice(0, 2)
    .reduce((height, row) => height + row.getBoundingClientRect().height, 0)
}

function updateActivation() {
  const viewport = bodyViewportRef.value
  if (!constrained.value || !headerClipRef.value) {
    innerScrollActive.value = false
    return
  }

  const reachedBoundary =
    headerClipRef.value.getBoundingClientRect().top <= stickyBottom + 1
  if (!reachedBoundary && innerScrollActive.value && viewport) {
    // A direct window scroll can move the list away from its handoff point while
    // the body is midway through its own scroll. Reset before locking it again
    // so the pre-handoff table never begins with hidden earlier rows.
    viewport.scrollTop = 0
  }
  innerScrollActive.value = reachedBoundary
}

function onBodyFocusIn(event: FocusEvent) {
  const viewport = bodyViewportRef.value
  const header = headerClipRef.value
  const target = event.target instanceof HTMLElement ? event.target : null
  if (
    pointerFocusPending ||
    !viewport ||
    !header ||
    !target ||
    !constrained.value ||
    innerScrollActive.value
  )
    return

  // Hidden overflow can still be changed by browser focus management. Move the
  // outer page to the handoff point first, then let the newly active body bring
  // the focused control into view.
  viewport.scrollTop = 0
  const delta = header.getBoundingClientRect().top - stickyBottom
  if (delta > 1) {
    if (scrollZoneEl) scrollZoneEl.scrollBy({ top: delta, behavior: 'auto' })
    else window.scrollBy({ top: delta, behavior: 'auto' })
  }

  window.requestAnimationFrame(() => {
    updateActivation()
    if (innerScrollActive.value)
      target.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}

function onBodyPointerDown() {
  window.clearTimeout(pointerFocusTimer)
  pointerFocusPending = true
  pointerFocusTimer = window.setTimeout(() => {
    pointerFocusPending = false
  }, 0)
}

function measure() {
  measureFrame = 0
  const header = headerClipRef.value
  const viewport = bodyViewportRef.value
  const table = bodyTableRef.value
  if (!header || !viewport || !table) return

  if (!boundaryElement || !document.contains(boundaryElement)) {
    boundaryElement = document.querySelector<HTMLElement>(
      props.scrollBoundarySelector
    )
  }

  const nextHeaderWidth = viewport.offsetWidth
  if (headerViewportWidth.value !== nextHeaderWidth) {
    headerViewportWidth.value = nextHeaderWidth
  }
  horizontalScrollAvailable.value =
    viewport.scrollWidth > viewport.clientWidth + 1

  if (!props.adaptiveScroll || !boundaryElement) {
    constrained.value = false
    bodyMaxHeight.value = 0
    updateActivation()
    return
  }

  stickyBottom = boundaryElement.getBoundingClientRect().bottom
  const headerHeight = header.getBoundingClientRect().height
  const footerHeight = footerRef.value?.getBoundingClientRect().height ?? 0
  const availableHeight = Math.floor(
    visualViewportBottom() -
      stickyBottom -
      headerHeight -
      footerHeight -
      props.viewportBottomGap
  )
  const naturalHeight = Math.max(table.scrollHeight, table.offsetHeight)
  const minimumHeight = minimumUsefulBodyHeight()
  const hasUsefulViewport =
    minimumHeight > 0 && availableHeight >= minimumHeight
  const shouldConstrain =
    hasUsefulViewport && naturalHeight > availableHeight + 1

  if (shouldConstrain) {
    bodyMaxHeight.value = availableHeight
    constrained.value = true
  } else {
    constrained.value = false
    bodyMaxHeight.value = 0
  }

  updateActivation()
}

function scheduleMeasure() {
  if (measureFrame) return
  measureFrame = window.requestAnimationFrame(measure)
}

function onBodyScroll() {
  const viewport = bodyViewportRef.value
  const headerTable = headerTableRef.value
  if (!viewport || !headerTable || viewport.scrollLeft === lastScrollLeft)
    return

  lastScrollLeft = viewport.scrollLeft
  headerTable.style.transform = `translate3d(${-lastScrollLeft}px, 0, 0)`
}

function onHeaderScroll() {
  const header = headerClipRef.value
  const viewport = bodyViewportRef.value
  if (!header || !viewport || header.scrollLeft === 0) return

  const nextScrollLeft = Math.min(
    Math.max(0, viewport.scrollLeft + header.scrollLeft),
    Math.max(0, viewport.scrollWidth - viewport.clientWidth)
  )
  header.scrollLeft = 0
  viewport.scrollLeft = nextScrollLeft
  onBodyScroll()
}

async function resetBodyAndMeasure() {
  await nextTick()
  bodyViewportRef.value?.scrollTo({ top: 0 })
  scheduleMeasure()
}

watch(
  [
    () => props.rows,
    () => props.columns,
    () => props.loading,
    () => props.skeletonRows,
    () => props.pageSize,
    () => props.adaptiveScroll,
  ],
  resetBodyAndMeasure
)

onMounted(() => {
  boundaryElement = document.querySelector<HTMLElement>(
    props.scrollBoundarySelector
  )
  scrollZoneEl = document.querySelector<HTMLElement>(props.scrollZoneSelector)
  resizeObserver = new ResizeObserver(scheduleMeasure)

  const observed = [
    headerClipRef.value,
    bodyViewportRef.value,
    bodyTableRef.value,
    footerRef.value,
    boundaryElement,
  ]
  observed.forEach((element) => {
    if (element) resizeObserver?.observe(element)
  })

  scrollZoneEl?.addEventListener('scroll', updateActivation, { passive: true })
  window.addEventListener('resize', scheduleMeasure, { passive: true })
  window.visualViewport?.addEventListener('resize', scheduleMeasure, {
    passive: true,
  })
  window.visualViewport?.addEventListener('scroll', scheduleMeasure, {
    passive: true,
  })
  scheduleMeasure()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  scrollZoneEl?.removeEventListener('scroll', updateActivation)
  scrollZoneEl = null
  window.removeEventListener('resize', scheduleMeasure)
  window.visualViewport?.removeEventListener('resize', scheduleMeasure)
  window.visualViewport?.removeEventListener('scroll', scheduleMeasure)
  if (measureFrame) window.cancelAnimationFrame(measureFrame)
  window.clearTimeout(pointerFocusTimer)
})
</script>

<template>
  <div class="data-table-shell" data-handdrawn="ledger">
    <!-- Visual header: wider tracking + gold-line bottom border for ledger feel -->
    <div
      ref="headerClipRef"
      class="data-table-header-clip overflow-hidden border-b bg-[var(--surface-table-header)]"
      style="border-color: var(--dec-gold-line)"
      :style="headerClipStyle"
      @scroll="onHeaderScroll"
    >
      <table
        ref="headerTableRef"
        role="presentation"
        class="w-full table-fixed border-collapse text-sm will-change-transform"
        :style="{ minWidth: minTableWidth }"
      >
        <colgroup>
          <col v-if="selectable" style="width: 40px" />
          <col
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: col.width } : undefined"
          />
        </colgroup>
        <thead class="bg-[var(--surface-table-header)]">
          <tr class="text-left text-xs text-[var(--text-secondary)]">
            <td v-if="selectable" class="w-10 px-3 py-3">
              <input
                type="checkbox"
                :class="checkboxClass"
                :checked="allChecked"
                :disabled="selectionDisabled"
                :aria-label="t('common.selectAll')"
                @change="toggleAll"
              />
            </td>
            <td
              v-for="col in columns"
              :key="col.key"
              class="px-3 py-3 font-semibold tracking-[0.12em] uppercase"
              style="
                font-size: 10px;
                font-family: var(--font-display);
                color: var(--text-tertiary);
              "
              :class="alignClass(col.align)"
            >
              <slot :name="`header-${col.key}`" :column="col">
                <span aria-hidden="true">{{ col.label }}</span>
              </slot>
            </td>
          </tr>
        </thead>
      </table>
    </div>

    <div
      ref="bodyViewportRef"
      class="data-table-body-viewport overflow-x-auto"
      :style="bodyViewportStyle"
      :role="scrollRegionAvailable ? 'region' : undefined"
      :tabindex="scrollRegionAvailable ? 0 : undefined"
      :aria-label="
        scrollRegionAvailable
          ? scrollRegionLabel || t('common.tableRows')
          : undefined
      "
      :aria-busy="loading"
      @pointerdown.capture="onBodyPointerDown"
      @focusin="onBodyFocusIn"
      @scroll="onBodyScroll"
    >
      <table
        ref="bodyTableRef"
        class="w-full table-fixed border-collapse text-sm"
        :style="{ minWidth: minTableWidth }"
      >
        <colgroup>
          <col v-if="selectable" style="width: 40px" />
          <col
            v-for="col in columns"
            :key="col.key"
            :style="col.width ? { width: col.width } : undefined"
          />
        </colgroup>

        <!-- The visible header is a separate non-scrolling table. This zero-height
             semantic header keeps column associations within the body table. -->
        <thead class="data-table-semantic-head">
          <tr>
            <th v-if="selectable" scope="col">
              <span class="sr-only">{{ t('common.selectColumn') }}</span>
            </th>
            <th
              v-for="col in columns"
              :id="columnHeaderId(col.key)"
              :key="col.key"
              scope="col"
            >
              <span class="sr-only">{{ col.label }}</span>
            </th>
          </tr>
        </thead>

        <tbody v-if="!loading && rows.length > 0">
          <template v-for="(row, index) in rows" :key="String(row[rowKey])">
            <tr
              v-if="isGroupRow?.(row)"
              data-table-group-row
              class="border-b border-[var(--border-default)] bg-[var(--surface-muted)]"
            >
              <th
                scope="rowgroup"
                :colspan="columns.length + (selectable ? 1 : 0)"
                class="px-3 py-2 text-left font-medium text-[var(--text-primary)]"
              >
                <slot name="group-row" :row="row" :index="index">
                  {{ row[rowKey] }}
                </slot>
              </th>
            </tr>
            <tr
              v-else
              class="row-divider transition-colors last:border-0 hover:bg-[var(--surface-muted)]"
              :data-selected="
                selected.includes(row[rowKey] as string | number)
                  ? 'true'
                  : undefined
              "
              :class="[
                rowInteractive ? 'cursor-pointer select-none' : undefined,
                rowClass?.(row),
              ]"
              :tabindex="rowInteractive ? 0 : undefined"
              @click="rowClickable && emit('row-click', row)"
              @dblclick="
                (rowClickable || rowDblclickable) && emit('row-dblclick', row)
              "
              @keydown="activateRowFromKeyboard($event, row)"
            >
              <td
                v-if="selectable"
                class="px-3 py-3"
                @click.stop
                @dblclick.stop
              >
                <input
                  type="checkbox"
                  :class="checkboxClass"
                  :checked="selected.includes(row[rowKey] as string | number)"
                  :disabled="selectionDisabled || !isRowSelectable(row)"
                  :aria-label="
                    t('common.selectRow', { index: dataRowNumber(row) })
                  "
                  @change="toggleRow(row)"
                />
              </td>
              <td
                v-for="col in columns"
                :key="col.key"
                :headers="columnHeaderId(col.key)"
                class="px-3 py-3 text-[var(--text-primary)]"
                :class="alignClass(col.align)"
              >
                <slot :name="`cell-${col.key}`" :row="row" :index="index">
                  {{ row[col.key] }}
                </slot>
              </td>
            </tr>
          </template>
        </tbody>

        <!-- Skeleton rows live inside the table so each matches a data row's
             exact height; rendering skeletonRows = page size keeps the body the
             same height loaded or loading, so pagination doesn't shift layout. -->
        <tbody v-else-if="loading">
          <tr
            v-for="i in skeletonRows"
            :key="i"
            class="border-b border-[var(--border-subtle)] last:border-0"
          >
            <td v-if="selectable" class="px-3 py-3">
              <div
                class="h-[22px] w-4 animate-pulse rounded bg-[var(--surface-muted)]"
              />
            </td>
            <td v-for="col in columns" :key="col.key" class="px-3 py-3">
              <div
                class="h-[22px] animate-pulse rounded bg-[var(--surface-muted)]"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <EmptyState
        v-if="!loading && rows.length === 0"
        :title="emptyTitle || t('common.none')"
        :hint="emptyHint"
        :illustration="emptyIllustration"
      />
    </div>

    <div v-if="$slots.footer" ref="footerRef" class="data-table-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
/* Row divider: dashed ledger line by day, solid hairline by night (tokens). */
.row-divider {
  border-bottom: 1px var(--row-divider-style, dashed) var(--row-divider-color);
}

.data-table-body-viewport {
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  overscroll-behavior: auto;
  transition: scrollbar-color 0.35s ease;
}
.data-table-body-viewport:hover {
  scrollbar-color: var(--scroll-thumb) transparent;
}

.data-table-body-viewport::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.data-table-body-viewport::-webkit-scrollbar-button {
  display: none;
}
.data-table-body-viewport::-webkit-scrollbar-track {
  background: transparent;
}
.data-table-body-viewport::-webkit-scrollbar-corner {
  background: transparent;
}
.data-table-body-viewport::-webkit-scrollbar-thumb {
  background: transparent;
  background-clip: padding-box;
  border: 2px solid transparent;
  border-radius: 8px;
  transition: background 0.35s ease;
}
.data-table-body-viewport:hover::-webkit-scrollbar-thumb {
  background: var(--scroll-thumb);
  background-clip: padding-box;
}

.data-table-semantic-head,
.data-table-semantic-head tr,
.data-table-semantic-head th {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
  padding: 0;
  font-size: 0;
  line-height: 0;
}

@media print {
  .data-table-body-viewport {
    max-height: none !important;
    overflow: visible !important;
  }
}
</style>
