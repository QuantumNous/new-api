'use client';
import * as React from 'react';
import { useMergedRefs } from '@base-ui/utils/useMergedRefs';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { ownerWindow } from '@base-ui/utils/owner';
import type { BaseUIComponentProps, HTMLProps, NonNativeButtonProps } from '../../internals/types';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { NOOP } from '../../internals/noop';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useButton } from '../../internals/use-button';
import { ACTIVE_COMPOSITE_ITEM } from '../../internals/composite/constants';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useFieldItemContext } from '../../field/item/FieldItemContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRadioGroupContext } from '../../radio-group/RadioGroupContext';
import { serializeValue } from '../../internals/serializeValue';
import { RadioRootContext } from './RadioRootContext';

/**
 * Represents the radio button itself.
 * Renders a `<span>` element and a hidden `<input>` beside.
 *
 * Documentation: [Base UI Radio](https://base-ui.com/react/components/radio)
 */
export const RadioRoot = React.forwardRef(function RadioRoot<Value>(
  componentProps: RadioRoot.Props<Value>,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const {
    render,
    className,
    disabled: disabledProp = false,
    readOnly: readOnlyProp = false,
    required: requiredProp = false,
    'aria-labelledby': ariaLabelledByProp,
    value,
    inputRef: inputRefProp,
    nativeButton = false,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;

  const groupContext = useRadioGroupContext();

  const {
    disabled: disabledGroup,
    readOnly: readOnlyGroup,
    required: requiredGroup,
    form: formGroup,
    checkedValue,
    touched = false,
    validation,
    name,
  } = groupContext ?? {};
  const setCheckedValue = groupContext?.setCheckedValue ?? NOOP;
  const setTouched = groupContext?.setTouched ?? NOOP;
  const registerControlRef = groupContext?.registerControlRef ?? NOOP;
  const registerInputRef = groupContext?.registerInputRef ?? NOOP;

  const {
    setTouched: setFieldTouched,
    setFilled,
    state: fieldState,
    disabled: fieldDisabled,
  } = useFieldRootContext();
  const fieldItemContext = useFieldItemContext();
  const { labelId, getDescriptionProps } = useLabelableContext();

  const disabled = fieldDisabled || fieldItemContext.disabled || disabledGroup || disabledProp;
  const readOnly = readOnlyGroup || readOnlyProp;
  const required = requiredGroup || requiredProp;
  const form = formGroup;

  const checked = groupContext ? checkedValue === value : value === '';

  const radioRef = React.useRef<HTMLElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleControlRef = useStableCallback((element: HTMLElement | null) => {
    if (!element) {
      return;
    }

    registerControlRef(element, disabled);
  });

  const mergedInputRef = useMergedRefs(inputRefProp, inputRef, registerInputRef);

  useIsoLayoutEffect(() => {
    if (inputRef.current?.checked) {
      setFilled(true);
    }
  }, [setFilled]);

  useIsoLayoutEffect(() => {
    if (!inputRef.current) {
      return;
    }

    if (disabled && checked) {
      registerInputRef(null);
      return;
    }

    if (radioRef.current) {
      registerControlRef(radioRef.current, disabled);
    }

    registerInputRef(inputRef.current);
  }, [checked, disabled, registerControlRef, registerInputRef]);

  const id = useBaseUiId();
  const inputId = useLabelableId({
    id: idProp,
    implicit: false,
    controlRef: radioRef,
  });
  const hiddenInputId = nativeButton ? undefined : inputId;
  const ariaLabelledBy = useAriaLabelledBy(
    ariaLabelledByProp,
    labelId,
    inputRef,
    !nativeButton,
    hiddenInputId,
  );

  const rootProps: React.ComponentPropsWithRef<'span'> = {
    role: 'radio',
    'aria-checked': checked,
    'aria-required': required || undefined,
    'aria-readonly': readOnly || undefined,
    'aria-labelledby': ariaLabelledBy,
    [ACTIVE_COMPOSITE_ITEM as string]: checked ? '' : undefined,
    id: nativeButton ? inputId : id,
    onKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();
      }
    },
    onClick(event) {
      if (event.defaultPrevented || disabled || readOnly) {
        return;
      }

      event.preventDefault();

      const input = inputRef.current;
      if (!input) {
        return;
      }

      input.dispatchEvent(
        new (ownerWindow(input).PointerEvent)('click', {
          bubbles: true,
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          metaKey: event.metaKey,
        }),
      );
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled || readOnly || !touched) {
        return;
      }

      inputRef.current?.click();

      setTouched(false);
    },
  };

  const { getButtonProps, buttonRef } = useButton({
    disabled,
    native: nativeButton,
    composite: false,
  });

  const inputProps: React.ComponentPropsWithRef<'input'> = {
    type: 'radio',
    ref: mergedInputRef,
    form,
    id: hiddenInputId,
    name,
    tabIndex: -1,
    style: name ? visuallyHiddenInput : visuallyHidden,
    'aria-hidden': true,
    ...(value !== undefined ? { value: serializeValue(value) } : EMPTY_OBJECT),
    disabled,
    checked,
    required,
    readOnly,
    onChange(event) {
      // Workaround for https://github.com/facebook/react/issues/9023
      if (event.nativeEvent.defaultPrevented) {
        return;
      }

      if (disabled || readOnly || value === undefined) {
        return;
      }

      const details = createChangeEventDetails(REASONS.none, event.nativeEvent);

      setCheckedValue(value, details);

      if (details.isCanceled) {
        return;
      }

      setFieldTouched(true);
    },
    onFocus() {
      radioRef.current?.focus();
    },
  };

  const state: RadioRootState = React.useMemo(
    () => ({
      ...fieldState,
      required,
      disabled,
      readOnly,
      checked,
    }),
    [fieldState, disabled, readOnly, checked, required],
  );

  const contextValue: RadioRootContext = state;

  const isRadioGroup = groupContext !== undefined;

  const refs = [forwardedRef, radioRef, buttonRef, handleControlRef];
  const props = [
    rootProps,
    elementProps,
    getButtonProps,
    getDescriptionProps,
    validation
      ? (validationProps: HTMLProps) => validation.getValidationProps(disabled, validationProps)
      : EMPTY_OBJECT,
  ];

  const element = useRenderElement('span', componentProps, {
    enabled: !isRadioGroup,
    state,
    ref: refs,
    props,
    stateAttributesMapping,
  });

  return (
    <RadioRootContext.Provider value={contextValue}>
      {isRadioGroup ? (
        <CompositeItem
          tag="span"
          render={render}
          className={className}
          style={style}
          state={state}
          refs={refs}
          props={props}
          stateAttributesMapping={stateAttributesMapping}
        />
      ) : (
        element
      )}
      <input {...inputProps} suppressHydrationWarning />
    </RadioRootContext.Provider>
  );
}) as {
  <Value>(props: RadioRoot.Props<Value>): React.JSX.Element;
};

export interface RadioRootState extends FieldRootState {
  /**
   * Whether the radio button is currently selected.
   */
  checked: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly: boolean;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required: boolean;
  /**
   * Whether the radio button has been touched (when wrapped in Field.Root).
   */
  touched: boolean;
  /**
   * Whether the radio button's value has changed from its initial value (when wrapped in Field.Root).
   */
  dirty: boolean;
  /**
   * Whether the radio button is in a valid state (when wrapped in Field.Root).
   */
  valid: boolean | null;
  /**
   * Whether the radio button has a value (when wrapped in Field.Root).
   */
  filled: boolean;
  /**
   * Whether the radio button is focused (when wrapped in Field.Root).
   */
  focused: boolean;
}

export interface RadioRootProps<Value = any>
  extends NonNativeButtonProps, Omit<BaseUIComponentProps<'span', RadioRootState>, 'value'> {
  /**
   * The unique identifying value of the radio in a group.
   */
  value: Value;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   */
  required?: boolean | undefined;
  /**
   * Whether the user should be unable to select the radio button.
   */
  readOnly?: boolean | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: React.Ref<HTMLInputElement> | undefined;
}

export namespace RadioRoot {
  export type State = RadioRootState;
  export type Props<TValue = any> = RadioRootProps<TValue>;
}
