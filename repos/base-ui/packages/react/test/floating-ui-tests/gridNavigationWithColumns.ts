import { gridNavigation } from '../../src/floating-ui-react/hooks/gridNavigation';

export function gridNavigationWithColumns(cols: number): typeof gridNavigation {
  return (
    event,
    prevIndex,
    listRef,
    orientation,
    loopFocus,
    rtl,
    disabledIndices,
    minIndex,
    maxIndex,
  ) =>
    gridNavigation(
      event,
      prevIndex,
      listRef,
      orientation,
      loopFocus,
      rtl,
      disabledIndices,
      minIndex,
      maxIndex,
      cols,
    );
}
