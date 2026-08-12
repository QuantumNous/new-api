'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { useRenderElement } from '../../internals/useRenderElement';
import { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { useComboboxChipContext } from '../chip/ComboboxChipContext';
import { useButton } from '../../internals/use-button';
import { stopEvent } from '../../floating-ui-react/utils';
import { selectors } from '../store';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { findItemIndex } from '../../internals/itemEquality';

/**
 * A button to remove a chip.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxChipRemove = React.forwardRef(function ComboboxChipRemove(
  componentProps: ComboboxChipRemove.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const {
    render,
    className,
    disabled: disabledProp = false,
    nativeButton = true,
    style,
    ...elementProps
  } = componentProps;

  const store = useComboboxRootContext();
  const { index } = useComboboxChipContext();

  const comboboxDisabled = useStore(store, selectors.disabled);
  const readOnly = useStore(store, selectors.readOnly);
  const selectedValue = useStore(store, selectors.selectedValue);
  const isItemEqualToValue = useStore(store, selectors.isItemEqualToValue);

  const disabled = comboboxDisabled || disabledProp;

  const { buttonRef, getButtonProps } = useButton({
    native: nativeButton,
    disabled: disabled || readOnly,
    focusableWhenDisabled: true,
  });

  const state: ComboboxChipRemoveState = {
    disabled,
  };

  function clearActiveIndexForRemovedItem(removedItem: any) {
    const activeIndex = store.state.activeIndex;

    if (activeIndex == null) {
      return;
    }

    // Try current visible list first; if not found, it's filtered out.
    // No need to clear highlight in that case since it can't equal activeIndex.
    const removedIndex = findItemIndex(
      store.state.valuesRef.current,
      removedItem,
      isItemEqualToValue,
    );
    if (removedIndex !== -1 && activeIndex === removedIndex) {
      store.state.setIndices({
        activeIndex: null,
        type: store.state.keyboardActiveRef.current ? 'keyboard' : 'pointer',
      });
    }
  }

  function removeChip(
    event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLButtonElement>,
  ) {
    const eventDetails = createChangeEventDetails(REASONS.chipRemovePress, event.nativeEvent);
    const removedItem = selectedValue[index];

    clearActiveIndexForRemovedItem(removedItem);

    store.state.setSelectedValue(
      selectedValue.filter((_: any, i: number) => i !== index),
      eventDetails,
    );

    store.state.inputRef.current?.focus();
    return eventDetails;
  }

  const element = useRenderElement('button', componentProps, {
    ref: [forwardedRef, buttonRef],
    state,
    props: [
      {
        tabIndex: -1,
        onMouseDown(event) {
          event.preventDefault();
        },
        onClick(event) {
          if (disabled || readOnly) {
            return;
          }

          const eventDetails = removeChip(event);
          if (!eventDetails.isPropagationAllowed) {
            event.stopPropagation();
          }
        },
        onKeyDown(event) {
          if (disabled || readOnly) {
            return;
          }

          if (event.key === 'Enter' || event.key === ' ') {
            const eventDetails = removeChip(event);
            if (!eventDetails.isPropagationAllowed) {
              stopEvent(event);
            }
          }
        },
      },
      elementProps,
      getButtonProps,
    ],
  });

  return element;
});

export interface ComboboxChipRemoveState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface ComboboxChipRemoveProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxChipRemoveState> {}

export namespace ComboboxChipRemove {
  export type State = ComboboxChipRemoveState;
  export type Props = ComboboxChipRemoveProps;
}
