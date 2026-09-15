'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStore } from '@base-ui/utils/store';
import { useSelectRootContext } from '../root/SelectRootContext';
import {
  useCompositeListItem,
  IndexGuessBehavior,
} from '../../internals/composite/list/useCompositeListItem';
import type {
  BaseUIComponentProps,
  BaseUIEvent,
  HTMLProps,
  NonNativeButtonProps,
} from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { SelectItemContext } from './SelectItemContext';
import { selectors } from '../store';
import { useButton } from '../../internals/use-button';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { compareItemEquality, removeItem } from '../../internals/itemEquality';
import { isVirtualClick } from '../../floating-ui-react/utils/event';

/**
 * An individual option in the select popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectItem = React.memo(
  React.forwardRef(function SelectItem(
    componentProps: SelectItem.Props,
    forwardedRef: React.ForwardedRef<HTMLElement>,
  ) {
    const {
      render,
      className,
      style,
      value: itemValue = null,
      label,
      disabled = false,
      nativeButton = false,
      ...elementProps
    } = componentProps;

    const textRef = React.useRef<HTMLElement | null>(null);
    const listItem = useCompositeListItem({
      label,
      textRef,
      indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
    });

    const {
      store,
      itemProps,
      setOpen,
      setValue,
      selectionRef,
      typingRef,
      valuesRef,
      multiple,
      selectedItemTextRef,
      disabled: selectDisabled,
      readOnly,
    } = useSelectRootContext();

    const highlighted = useStore(store, selectors.isActive, listItem.index);
    const open = useStore(store, selectors.open);
    const selected = useStore(store, selectors.isSelected, itemValue);
    const selectedByFocus = useStore(store, selectors.isSelectedByFocus, listItem.index);
    const isItemEqualToValue = useStore(store, selectors.isItemEqualToValue);

    const index = listItem.index;
    const hasRegistered = index !== -1;

    const itemRef = React.useRef<HTMLDivElement | null>(null);

    useIsoLayoutEffect(() => {
      if (!hasRegistered) {
        return undefined;
      }

      const values = valuesRef.current;
      values[index] = itemValue;

      return () => {
        delete values[index];
      };
    }, [hasRegistered, index, itemValue, valuesRef]);

    useIsoLayoutEffect(() => {
      if (!hasRegistered) {
        return;
      }

      const selectedValue = store.state.value;

      let selectedCandidate = selectedValue;
      if (multiple && Array.isArray(selectedValue)) {
        // Compare against the last selected item, or `undefined` when nothing is selected — never
        // the raw array, which a custom `isItemEqualToValue` isn't expected to receive.
        selectedCandidate =
          selectedValue.length > 0 ? selectedValue[selectedValue.length - 1] : undefined;
      }

      if (
        selectedCandidate !== undefined &&
        compareItemEquality(itemValue, selectedCandidate, isItemEqualToValue)
      ) {
        store.set('selectedIndex', index);
        // Make sure SelectPopup can measure the selected item on first open.
        // SelectItemText can still update this ref later when focus moves.
        if (textRef.current) {
          selectedItemTextRef.current = textRef.current;
        }
      }
    }, [hasRegistered, index, multiple, isItemEqualToValue, store, itemValue, selectedItemTextRef]);

    const lastKeyRef = React.useRef<string | null>(null);
    const pointerTypeRef = React.useRef<'mouse' | 'touch' | 'pen'>('mouse');
    const allowMouseSelectionRef = React.useRef(false);

    const { getButtonProps, buttonRef } = useButton({
      disabled,
      focusableWhenDisabled: true,
      native: nativeButton,
      composite: true,
    });

    const state: SelectItemState = {
      disabled,
      selected,
      highlighted,
    };

    function commitSelection(event: MouseEvent | KeyboardEvent | PointerEvent) {
      // A forced-open select (`open`/`defaultOpen`) can still receive item activations even
      // when the root is disabled or read-only, so guard the commit here too.
      if (selectDisabled || readOnly) {
        return;
      }

      const selectedValue = store.state.value;
      if (multiple) {
        const currentValue = Array.isArray(selectedValue) ? selectedValue : [];
        const nextValue = selected
          ? removeItem(currentValue, itemValue, isItemEqualToValue)
          : [...currentValue, itemValue];
        setValue(nextValue, createChangeEventDetails(REASONS.itemPress, event));
      } else {
        setValue(itemValue, createChangeEventDetails(REASONS.itemPress, event));
        setOpen(false, createChangeEventDetails(REASONS.itemPress, event));
      }
    }

    function resetDragMovement() {
      selectionRef.current.dragY = 0;
    }

    const defaultProps: HTMLProps = {
      role: 'option',
      'aria-selected': selected,
      tabIndex: open && highlighted ? 0 : -1,
      onKeyDown(event: BaseUIEvent<React.KeyboardEvent>) {
        lastKeyRef.current = event.key;
        store.set('activeIndex', index);

        if (event.key === ' ' && typingRef.current) {
          event.preventDefault();
        }
      },
      onClick(event) {
        const isMouseClick = event.type === 'click' && pointerTypeRef.current !== 'touch';
        const clickPointerType = (event.nativeEvent as PointerEvent).pointerType;
        const isVirtualMouseClick =
          isMouseClick &&
          isVirtualClick(event.nativeEvent) &&
          // Generic no-pointer `detail === 0` clicks stay tied to highlight state. Virtual
          // clicks that carry browser pointer data, including an empty string from assistive
          // technology, can activate unhighlighted items.
          (clickPointerType !== undefined || highlighted);
        // With alignItemWithTrigger, opening can place an item under the cursor. Real mouse
        // clicks must start on the item, while virtual clicks represent explicit keyboard or
        // assistive technology activation.
        const isInvalidMouseClick =
          isMouseClick && !isVirtualMouseClick && !allowMouseSelectionRef.current;

        allowMouseSelectionRef.current = false;

        // Prevent double commit on {Enter}
        if (event.type === 'keydown' && lastKeyRef.current === null) {
          return;
        }

        if (
          disabled ||
          (event.type === 'keydown' && lastKeyRef.current === ' ' && typingRef.current) ||
          isInvalidMouseClick
        ) {
          return;
        }

        lastKeyRef.current = null;
        commitSelection(event.nativeEvent);
      },
      onPointerEnter(event) {
        pointerTypeRef.current = event.pointerType;
      },
      onPointerMove(event) {
        if (event.pointerType === 'mouse' && event.buttons === 1) {
          const selection = selectionRef.current;
          selection.dragY += event.movementY;

          if (selection.dragY ** 2 >= 64) {
            selection.allowUnselectedMouseUp = true;
          }
        }
      },
      onPointerDown(event) {
        pointerTypeRef.current = event.pointerType;
        allowMouseSelectionRef.current = true;
        resetDragMovement();
      },
      onMouseUp() {
        resetDragMovement();

        if (disabled || pointerTypeRef.current === 'touch') {
          return;
        }

        // Regular clicks are committed by the click event.
        if (allowMouseSelectionRef.current) {
          return;
        }

        const disallowSelectedMouseUp = !selectionRef.current.allowSelectedMouseUp && selected;
        const disallowUnselectedMouseUp = !selectionRef.current.allowUnselectedMouseUp && !selected;

        if (disallowSelectedMouseUp || disallowUnselectedMouseUp) {
          return;
        }

        allowMouseSelectionRef.current = true;
        itemRef.current?.click();
        allowMouseSelectionRef.current = false;
      },
    };

    const element = useRenderElement('div', componentProps, {
      ref: [buttonRef, forwardedRef, listItem.ref, itemRef],
      state,
      props: [itemProps, defaultProps, elementProps, getButtonProps],
    });

    const contextValue: SelectItemContext = React.useMemo(
      () => ({
        selected,
        index,
        textRef,
        selectedByFocus,
        hasRegistered,
      }),
      [selected, index, textRef, selectedByFocus, hasRegistered],
    );

    return <SelectItemContext.Provider value={contextValue}>{element}</SelectItemContext.Provider>;
  }),
);

export interface SelectItemState {
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

export interface SelectItemProps
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'div', SelectItemState>, 'id'> {
  children?: React.ReactNode;
  /**
   * A unique value that identifies this select item.
   * @default null
   */
  value?: any;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Specifies the text label to use when the item is matched during keyboard text navigation.
   *
   * Defaults to the item text content if not provided.
   */
  label?: string | undefined;
}

export namespace SelectItem {
  export type State = SelectItemState;
  export type Props = SelectItemProps;
}
