import type * as React from 'react';
import {
  getGridNavigatedIndex,
  isIndexOutOfListBounds,
  type DisabledIndices,
} from '../utils/composite';

/**
 * Positional arguments are deliberate: property names of an options object
 * don't minify, and the signature is locked to the caller via `typeof` on the
 * `grid` option of `useListNavigation`.
 *
 * The injected grid navigator only ever operates on a uniform 1x1 grid (sizes are
 * always `1x1` and packing is never dense), so the cell-map machinery that supports
 * multi-cell items collapses to an identity transform over the item list. Calling
 * `getGridNavigatedIndex` directly keeps the cell-map helpers
 * (`createGridCellMap`/`getGridCellIndexOfCorner`/`getGridCellIndices`) out of
 * grid-combobox bundles.
 */
export function gridNavigation(
  event: React.KeyboardEvent,
  prevIndex: number,
  listRef: React.RefObject<Array<HTMLElement | null>>,
  orientation: 'horizontal' | 'vertical' | 'both',
  loopFocus: boolean,
  rtl: boolean,
  disabledIndices: DisabledIndices | undefined,
  minIndex: number,
  maxIndex: number,
  cols = 2,
): number | undefined {
  const nextIndex = getGridNavigatedIndex(listRef.current, {
    event,
    orientation,
    loopFocus,
    rtl,
    cols,
    disabledIndices,
    minIndex,
    maxIndex,
    // An out-of-range previous index falls back to the first enabled item.
    prevIndex: prevIndex > maxIndex ? minIndex : prevIndex,
    stopEvent: true,
  });

  // `getGridNavigatedIndex` can return an out-of-bounds sentinel (e.g. `-1` when there is no
  // previous item to move from); surface that as `undefined` so the caller treats it as
  // "no navigation" rather than highlighting index `-1`.
  return isIndexOutOfListBounds(listRef.current, nextIndex) ? undefined : nextIndex;
}
