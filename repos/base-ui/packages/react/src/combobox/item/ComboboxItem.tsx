'use client';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { useStore } from '@base-ui/utils/store';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import {
  useComboboxRootContext,
  useComboboxHasItemsContext,
  useComboboxDerivedItemsContext,
} from '../root/ComboboxRootContext';
import {
  useCompositeListItem,
  IndexGuessBehavior,
} from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { ComboboxItemContext } from './ComboboxItemContext';
import { selectors } from '../store';
import { useButton } from '../../internals/use-button';
import { useComboboxRowContext } from '../row/ComboboxRowContext';
import { compareItemEquality, findItemIndex } from '../../internals/itemEquality';

interface ComboboxItemInnerProps {
  componentProps: ComboboxItem.Props;
  forwardedRef: React.ForwardedRef<HTMLDivElement>;
  /**
   * Whether the list is externally virtualized. Passed down from the wrapper (which already
   * subscribes to it) so the inner component doesn't re-subscribe to the store.
   */
  virtualized: boolean;
  /**
   * Pre-resolved index for the virtualized fallback (when no `index` prop is provided).
   * `undefined` for the common path, where the index is derived from `index` prop or the
   * composite list registration order.
   */
  indexFromFilter: number | undefined;
}

function ComboboxItemInner(props: ComboboxItemInnerProps) {
  const { componentProps, forwardedRef, virtualized, indexFromFilter } = props;
  const {
    render,
    className,
    style,
    value: itemValue = null,
    index: indexProp,
    disabled = false,
    nativeButton = false,
    ...elementProps
  } = componentProps;

  const didPointerDownRef = React.useRef(false);
  const textRef = React.useRef<HTMLElement | null>(null);
  const listItem = useCompositeListItem({
    index: indexProp,
    textRef,
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
  });

  const store = useComboboxRootContext();
  const isRow = useComboboxRowContext();
  const hasItems = useComboboxHasItemsContext();

  const open = useStore(store, selectors.open);
  const selectionMode = useStore(store, selectors.selectionMode);
  const readOnly = useStore(store, selectors.readOnly);
  const isItemEqualToValue = useStore(store, selectors.isItemEqualToValue);

  const selectable = selectionMode !== 'none';
  const index = indexProp ?? (virtualized ? (indexFromFilter ?? -1) : listItem.index);
  const hasRegistered = listItem.index !== -1;

  const rootId = useStore(store, selectors.id);
  const highlighted = useStore(store, selectors.isActive, index);
  const matchesSelectedValue = useStore(store, selectors.isSelected, itemValue);
  const itemProps = useStore(store, selectors.itemProps);

  const itemRef = React.useRef<HTMLDivElement | null>(null);

  const id = rootId != null && hasRegistered ? `${rootId}-${index}` : undefined;
  const selected = matchesSelectedValue && selectable;

  useIsoLayoutEffect(() => {
    const shouldRun = hasRegistered && (virtualized || indexProp != null);
    if (!shouldRun) {
      return undefined;
    }

    const list = store.state.listRef.current;
    list[index] = itemRef.current;

    return () => {
      delete list[index];
    };
  }, [hasRegistered, virtualized, index, indexProp, store]);

  useIsoLayoutEffect(() => {
    if (!hasRegistered || hasItems) {
      return undefined;
    }

    const visibleMap = store.state.valuesRef.current;
    visibleMap[index] = itemValue;

    // Stable registry that doesn't depend on filtering. Assume that no
    // filtering had occurred at this point; otherwise, an `items` prop is
    // required.
    if (selectionMode !== 'none') {
      store.state.allValuesRef.current.push(itemValue);
    }

    return () => {
      delete visibleMap[index];
    };
  }, [hasRegistered, hasItems, index, itemValue, store, selectionMode]);

  useIsoLayoutEffect(() => {
    if (!open) {
      didPointerDownRef.current = false;
      return;
    }

    if (!hasRegistered || hasItems) {
      return;
    }

    const selectedValue = store.state.selectedValue;
    const lastSelectedValue = Array.isArray(selectedValue)
      ? selectedValue[selectedValue.length - 1]
      : selectedValue;

    if (compareItemEquality(itemValue, lastSelectedValue, isItemEqualToValue)) {
      store.set('selectedIndex', index);
    }
  }, [hasRegistered, hasItems, open, store, index, itemValue, isItemEqualToValue]);

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled: true,
    native: nativeButton,
    composite: true,
  });

  const state: ComboboxItemState = {
    disabled,
    selected,
    highlighted,
  };

  function commitSelection(nativeEvent: MouseEvent) {
    function selectItem() {
      store.state.handleSelection(nativeEvent, itemValue);
    }

    if (store.state.submitOnItemClick) {
      ReactDOM.flushSync(selectItem);
      store.state.requestSubmit();
    } else {
      selectItem();
    }
  }

  const defaultProps: HTMLProps = {
    id,
    role: isRow ? 'gridcell' : 'option',
    'aria-selected': selectable ? selected : undefined,
    // Focusable items steal focus from the input upon mouseup.
    // Warn if the user renders a natively focusable element like `<button>`,
    // as it should be a `<div>` instead.
    tabIndex: undefined,
    onPointerDownCapture(event) {
      didPointerDownRef.current = true;
      event.preventDefault();
    },
    onMouseDown(event) {
      // iOS Safari can emit a synthetic mousedown for touch taps without a preceding
      // pointerdown. Prevent default here too so tapping an item does not blur the input.
      event.preventDefault();
    },
    onClick(event) {
      if (disabled || readOnly) {
        return;
      }

      commitSelection(event.nativeEvent);
    },
    onMouseUp(event) {
      const pointerStartedOnItem = didPointerDownRef.current;
      didPointerDownRef.current = false;

      if (disabled || readOnly || event.button !== 0 || pointerStartedOnItem || !highlighted) {
        return;
      }

      commitSelection(event.nativeEvent);
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: [buttonRef, forwardedRef, listItem.ref, itemRef],
    state,
    props: [itemProps, defaultProps, elementProps, getButtonProps],
  });

  const contextValue: ComboboxItemContext = React.useMemo(
    () => ({
      selected,
      textRef,
    }),
    [selected, textRef],
  );

  return (
    <ComboboxItemContext.Provider value={contextValue}>{element}</ComboboxItemContext.Provider>
  );
}

/**
 * Resolves the index from the filtered items for the virtualized fallback (no `index` prop).
 * Isolated here so that this per-keystroke subscription to the derived-items context is only
 * paid by virtualized items. Those re-render on every input change anyway — the parent
 * virtualizer re-windows the list as the filtered set changes — so the extra subscription costs
 * them nothing, while it keeps every non-virtualized item off that context.
 */
function ComboboxItemVirtualizedIndex(props: {
  componentProps: ComboboxItem.Props;
  forwardedRef: React.ForwardedRef<HTMLDivElement>;
}) {
  const { componentProps, forwardedRef } = props;

  const store = useComboboxRootContext();
  const isItemEqualToValue = useStore(store, selectors.isItemEqualToValue);
  const { flatFilteredItems } = useComboboxDerivedItemsContext();

  const indexFromFilter = findItemIndex(
    flatFilteredItems,
    componentProps.value ?? null,
    isItemEqualToValue,
  );

  // Only reached when `virtualized` is true (see the wrapper below).
  return (
    <ComboboxItemInner
      componentProps={componentProps}
      forwardedRef={forwardedRef}
      virtualized
      indexFromFilter={indexFromFilter}
    />
  );
}

/**
 * An individual item in the list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxItem = React.memo(
  React.forwardRef(function ComboboxItem(
    componentProps: ComboboxItem.Props,
    forwardedRef: React.ForwardedRef<HTMLDivElement>,
  ) {
    const store = useComboboxRootContext();
    const virtualized = useStore(store, selectors.virtualized);

    // `virtualized` (and whether an item provides an explicit `index`) must be stable for an
    // item's lifetime: the two branches return different component types, so flipping it at
    // runtime remounts the item and resets its refs and effects.
    if (virtualized && componentProps.index == null) {
      return (
        <ComboboxItemVirtualizedIndex componentProps={componentProps} forwardedRef={forwardedRef} />
      );
    }

    return (
      <ComboboxItemInner
        componentProps={componentProps}
        forwardedRef={forwardedRef}
        virtualized={virtualized}
        indexFromFilter={undefined}
      />
    );
  }),
);

export interface ComboboxItemState {
  /**
   * Whether the item should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the item is selected.
   */
  selected: boolean;
  /**
   * Whether the item is highlighted.
   */
  highlighted: boolean;
}

export interface ComboboxItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', ComboboxItemState>, 'id'> {
  children?: React.ReactNode;
  /**
   * An optional click handler for the item when selected.
   * It fires when clicking the item with the pointer, as well as when pressing `Enter` with the keyboard if the item is highlighted when the `Input` or `List` element has focus.
   */
  onClick?: BaseUIComponentProps<'div', ComboboxItemState>['onClick'] | undefined;
  /**
   * The index of the item in the list. Improves performance when specified by avoiding the need to calculate the index automatically from the DOM.
   */
  index?: number | undefined;
  /**
   * A unique value that identifies this item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxItem {
  export type State = ComboboxItemState;
  export type Props = ComboboxItemProps;
}
