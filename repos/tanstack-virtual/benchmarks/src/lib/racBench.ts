import type { ListLayout } from 'react-aria-components'
import type { HarnessHandle } from './harness'
import type { ScenarioInput } from '../scenarios/types'
import type { Item } from './dataset'

export function findRacScrollContainer(
  root: HTMLElement | null,
): HTMLElement | null {
  if (!root) return null
  for (const node of root.querySelectorAll('div')) {
    const el = node as HTMLElement
    const oy = getComputedStyle(el).overflowY
    if (oy === 'auto' || oy === 'scroll') return el
  }
  return root
}

export function scrollRacToIndex(
  container: HTMLElement,
  layout: ListLayout<unknown> | null,
  items: Array<Item>,
  index: number,
  itemSize: number,
  align: 'start' | 'end' = 'start',
): void {
  const key = items[index]?.id ?? index

  for (let attempt = 0; attempt < 4; attempt++) {
    let scrollTop = index * itemSize

    if (layout?.virtualizer) {
      layout.update({})
      layout.getLayoutInfo(key)
      const layoutInfo = layout.getLayoutInfo(key)
      if (layoutInfo) {
        scrollTop =
          align === 'end'
            ? layoutInfo.rect.y +
              layoutInfo.rect.height -
              container.clientHeight
            : layoutInfo.rect.y
      }
    } else if (align === 'end') {
      scrollTop += itemSize - container.clientHeight
    }

    const maxScroll = Math.max(
      0,
      container.scrollHeight - container.clientHeight,
    )
    container.scrollTop = Math.max(0, Math.min(scrollTop, maxScroll))
    container.scrollTo({ top: container.scrollTop, behavior: 'instant' })
    container.dispatchEvent(new Event('scroll', { bubbles: true }))
  }
}

export function createRacVirtualHarness({
  hostRef,
  scrollerRef,
  layoutRef,
  items,
  scenario,
}: {
  hostRef: { current: HTMLDivElement | null }
  scrollerRef: { current: HTMLElement | null }
  layoutRef: { current: ListLayout<unknown> | null }
  items: Array<Item>
  scenario: ScenarioInput
}): Omit<HarnessHandle, 'getScrollContainer'> & {
  getScrollContainer: () => HTMLElement | null
} {
  return {
    getScrollContainer: () =>
      scrollerRef.current ?? findRacScrollContainer(hostRef.current),
    getSearchRoot: () => hostRef.current,
    scrollToIndex: (index, opts) => {
      const container =
        scrollerRef.current ?? findRacScrollContainer(hostRef.current)
      if (!container) return
      scrollRacToIndex(
        container,
        layoutRef.current,
        items,
        index,
        scenario.itemSize,
        opts?.align ?? 'start',
      )
    },
    getTotalSize: () => {
      const container =
        scrollerRef.current ?? findRacScrollContainer(hostRef.current)
      if (!container) return 0
      const content = container.firstElementChild as HTMLElement | null
      return content?.offsetHeight ?? container.scrollHeight
    },
    isFullyMeasured: () => {
      if (!scenario.dynamic) return true
      const container =
        scrollerRef.current ?? findRacScrollContainer(hostRef.current)
      const total = container?.scrollHeight ?? 0
      const estimate = scenario.count * scenario.itemSize
      return total > 0 && total !== estimate
    },
  }
}

export function cacheRacScroller(
  host: HTMLDivElement | null,
  scrollerRef: { current: HTMLElement | null },
): void {
  const scroller = findRacScrollContainer(host)
  if (scroller) {
    scrollerRef.current = scroller
    scroller.dataset.benchRacScroller = 'true'
  }
}
