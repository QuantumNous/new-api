import {
  elementScroll,
  observeElementOffset,
  observeElementRect,
} from '@tanstack/virtual-core'
import type { VirtualizerOptions } from '@tanstack/virtual-core'

// The subset of tag input that maps onto virtual-core options. Kept here
// (rather than imported from index.marko) so this helper has no dependency
// on the Marko template's generated types.
export interface VirtualizerInput {
  count: number
  estimateSize?: (index: number) => number
  getScrollElement: () => Element | null
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollPaddingStart?: number
  scrollPaddingEnd?: number
  gap?: number
  lanes?: number
  initialOffset?: number | (() => number)
}

// Single source of truth for the input -> virtual-core option mapping,
// shared by onMount (construction) and onUpdate (setOptions).
export function buildOptions(
  input: VirtualizerInput,
  notify: () => void,
): VirtualizerOptions<Element, Element> {
  return {
    count: input.count,
    estimateSize: input.estimateSize ?? (() => 50),
    getScrollElement: input.getScrollElement,
    overscan: input.overscan ?? 5,
    horizontal: input.horizontal ?? false,
    paddingStart: input.paddingStart,
    paddingEnd: input.paddingEnd,
    scrollPaddingStart: input.scrollPaddingStart,
    scrollPaddingEnd: input.scrollPaddingEnd,
    gap: input.gap,
    lanes: input.lanes,
    initialOffset: input.initialOffset,
    observeElementRect,
    observeElementOffset,
    scrollToFn: elementScroll,
    onChange: notify,
  }
}
