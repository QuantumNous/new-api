'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { ownerDocument } from '@base-ui/utils/owner';
import { BaseUIComponentProps, NativeButtonProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import {
  useComboboxFloatingContext,
  useComboboxDerivedItemsContext,
  useComboboxInputValueContext,
  useComboboxRootContext,
} from '../root/ComboboxRootContext';
import { triggerStateAttributesMapping } from '../utils/stateAttributesMapping';
import { selectors } from '../store';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { stopEvent, contains, getTarget } from '../../floating-ui-react/utils';
import { getPseudoElementBounds } from '../../utils/getPseudoElementBounds';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useClick, useTypeahead } from '../../floating-ui-react';
import type { Side } from '../../utils/useAnchorPositioning';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { resolveAriaLabelledBy } from '../../utils/resolveAriaLabelledBy';
import { getComboboxPopupId } from '../root/utils';

const BOUNDARY_OFFSET = 2;

/**
 * A button that opens the popup.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxTrigger = React.forwardRef(function ComboboxTrigger(
  componentProps: ComboboxTrigger.Props,
  forwardedRef: React.ForwardedRef<HTMLButtonElement>,
) {
  const {
    render,
    className,
    nativeButton = true,
    disabled: disabledProp = false,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;

  const {
    state: fieldState,
    disabled: fieldDisabled,
    setTouched,
    setFocused,
    validationMode,
    validation,
  } = useFieldRootContext();
  const { labelId: fieldLabelId } = useLabelableContext();
  const store = useComboboxRootContext();
  const { filteredItems } = useComboboxDerivedItemsContext();

  const selectionMode = useStore(store, selectors.selectionMode);
  const comboboxDisabled = useStore(store, selectors.disabled);
  const readOnly = useStore(store, selectors.readOnly);
  const required = useStore(store, selectors.required);
  const mounted = useStore(store, selectors.mounted);
  const popupSideValue = useStore(store, selectors.popupSide);
  const positionerElement = useStore(store, selectors.positionerElement);
  const listElement = useStore(store, selectors.listElement);
  const storedPopupId = useStore(store, selectors.popupId);
  const triggerProps = useStore(store, selectors.triggerProps);
  const triggerElement = useStore(store, selectors.triggerElement);
  const inputInsidePopup = useStore(store, selectors.inputInsidePopup);
  const rootId = useStore(store, selectors.id);
  const comboboxLabelId = useStore(store, selectors.labelId);
  const open = useStore(store, selectors.open);
  const selectedValue = useStore(store, selectors.selectedValue);
  const activeIndex = useStore(store, selectors.activeIndex);
  const selectedIndex = useStore(store, selectors.selectedIndex);
  const hasSelectedValue = useStore(store, selectors.hasSelectedValue);

  const floatingRootContext = useComboboxFloatingContext();
  const inputValue = useComboboxInputValueContext();

  const focusTimeout = useTimeout();

  const disabled = fieldDisabled || comboboxDisabled || disabledProp;
  const listEmpty = filteredItems.length === 0;
  const popupSide = mounted && positionerElement ? popupSideValue : null;

  useLabelableId({ id: inputInsidePopup ? idProp : undefined });
  const id = inputInsidePopup ? (idProp ?? rootId) : idProp;
  const ariaLabelledBy = resolveAriaLabelledBy(fieldLabelId, comboboxLabelId);

  let ariaControls: string | undefined;

  if (open && inputInsidePopup) {
    // Fall back to the default id while the popup registers its own (custom ids are stored once the
    // popup mounts), so `aria-controls` is set on the same commit `open` becomes `true`.
    ariaControls = storedPopupId ?? getComboboxPopupId(rootId);
  } else if (open) {
    ariaControls = listElement?.id;
  }

  const currentPointerTypeRef = React.useRef<PointerEvent['pointerType']>('');

  function trackPointerType(event: React.PointerEvent) {
    currentPointerTypeRef.current = event.pointerType;
  }

  const domReference = floatingRootContext.useState('domReferenceElement');

  // Update the floating root context to use the trigger element when it differs from the current reference.
  // This ensures useClick and useTypeahead attach handlers to the correct element.
  React.useEffect(() => {
    if (!inputInsidePopup) {
      return;
    }
    if (triggerElement && triggerElement !== domReference) {
      floatingRootContext.set('domReferenceElement', triggerElement);
    }
  }, [triggerElement, domReference, floatingRootContext, inputInsidePopup]);

  const { reference: triggerTypeaheadProps } = useTypeahead(floatingRootContext, {
    enabled: !open && !readOnly && !comboboxDisabled && selectionMode === 'single',
    listRef: store.state.labelsRef,
    activeIndex,
    selectedIndex,
    onMatch(index) {
      const nextSelectedValue = store.state.valuesRef.current[index];
      if (nextSelectedValue !== undefined) {
        store.state.setSelectedValue(nextSelectedValue, createChangeEventDetails('none'));
      }
    },
  });

  const { reference: triggerClickProps } = useClick(floatingRootContext, {
    enabled: !readOnly && !comboboxDisabled,
    event: 'mousedown',
  });

  const { buttonRef, getButtonProps } = useButton({
    native: nativeButton,
    disabled,
  });

  const state: ComboboxTriggerState = {
    ...fieldState,
    open,
    disabled,
    popupSide,
    listEmpty,
    placeholder: selectionMode === 'none' ? false : !hasSelectedValue,
  };

  const setTriggerElement = useStableCallback((element) => {
    store.set('triggerElement', element);
  });

  const element = useRenderElement('button', componentProps, {
    ref: [forwardedRef, buttonRef, setTriggerElement],
    state,
    props: [
      triggerProps,
      triggerClickProps,
      triggerTypeaheadProps,
      {
        id,
        tabIndex: inputInsidePopup ? 0 : -1,
        role: inputInsidePopup ? 'combobox' : undefined,
        'aria-expanded': open ? 'true' : 'false',
        'aria-haspopup': inputInsidePopup ? 'dialog' : 'listbox',
        'aria-controls': ariaControls,
        'aria-required': inputInsidePopup ? required || undefined : undefined,
        'aria-labelledby': ariaLabelledBy,
        onPointerDown: trackPointerType,
        onPointerEnter: trackPointerType,
        onFocus() {
          setFocused(true);

          if (disabled || readOnly) {
            return;
          }

          focusTimeout.start(0, store.state.forceMount);
        },
        onBlur(event) {
          // If focus is moving into the popup, don't count it as a blur.
          if (contains(positionerElement, event.relatedTarget)) {
            return;
          }

          setTouched(true);
          setFocused(false);

          if (validationMode === 'onBlur') {
            const valueToValidate = selectionMode === 'none' ? inputValue : selectedValue;
            validation.commit(valueToValidate);
          }
        },
        onMouseDown(event) {
          if (disabled || readOnly) {
            return;
          }

          if (!inputInsidePopup) {
            floatingRootContext.set('domReferenceElement', event.currentTarget);
          }

          // Ensure items are registered for initial selection highlight.
          store.state.forceMount();

          if (currentPointerTypeRef.current !== 'touch') {
            store.state.inputRef.current?.focus();

            if (!inputInsidePopup) {
              event.preventDefault();
            }
          }

          if (open) {
            return;
          }

          const doc = ownerDocument(event.currentTarget);

          function handleMouseUp(mouseEvent: MouseEvent) {
            if (!triggerElement) {
              return;
            }

            const mouseUpTarget = getTarget(mouseEvent) as Element | null;
            const positioner = store.state.positionerElement;
            const list = store.state.listElement;

            if (
              contains(triggerElement, mouseUpTarget) ||
              contains(positioner, mouseUpTarget) ||
              contains(list, mouseUpTarget) ||
              mouseUpTarget === triggerElement
            ) {
              return;
            }

            const bounds = getPseudoElementBounds(triggerElement);

            const withinHorizontal =
              mouseEvent.clientX >= bounds.left - BOUNDARY_OFFSET &&
              mouseEvent.clientX <= bounds.right + BOUNDARY_OFFSET;
            const withinVertical =
              mouseEvent.clientY >= bounds.top - BOUNDARY_OFFSET &&
              mouseEvent.clientY <= bounds.bottom + BOUNDARY_OFFSET;

            if (withinHorizontal && withinVertical) {
              return;
            }

            store.state.setOpen(false, createChangeEventDetails('cancel-open', mouseEvent));
          }

          if (inputInsidePopup) {
            doc.addEventListener('mouseup', handleMouseUp, { once: true });
          }
        },
        onKeyDown(event) {
          if (disabled || readOnly) {
            return;
          }

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            stopEvent(event);
            store.state.setOpen(
              true,
              createChangeEventDetails(REASONS.listNavigation, event.nativeEvent),
            );
            store.state.inputRef.current?.focus();
          }
        },
      },
      validation ? validation.getValidationProps(disabled, elementProps) : elementProps,
      getButtonProps,
    ],
    stateAttributesMapping: triggerStateAttributesMapping,
  });

  return element;
});

export interface ComboboxTriggerState extends FieldRootState {
  /**
   * Whether the popup is open.
   */
  open: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Indicates which side the corresponding popup is positioned relative to its anchor.
   */
  popupSide: Side | null;
  /**
   * Present when the corresponding items list is empty.
   */
  listEmpty: boolean;
  /**
   * Whether the combobox doesn't have a value.
   */
  placeholder: boolean;
}

export interface ComboboxTriggerProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ComboboxTriggerState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace ComboboxTrigger {
  export type State = ComboboxTriggerState;
  export type Props = ComboboxTriggerProps;
}
