'use client';
import * as React from 'react';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import type { BaseUIComponentProps, HTMLProps } from '../internals/types';
import { useBaseUiId } from '../internals/useBaseUiId';
import { contains } from '../floating-ui-react/utils';
import { SHIFT } from '../internals/composite/composite';
import { CompositeRoot } from '../internals/composite/root/CompositeRoot';
import { useFieldRootContext } from '../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../internals/field-register-control/useRegisterFieldControl';
import { fieldValidityMapping } from '../internals/field-constants/constants';
import type { FieldRootState } from '../field/root/FieldRoot';
import { useFieldsetRootContext } from '../fieldset/root/FieldsetRootContext';
import { useFormContext } from '../internals/form-context/FormContext';
import { useLabelableContext } from '../internals/labelable-provider/LabelableContext';
import { useValueChanged } from '../internals/useValueChanged';
import { RadioGroupContext } from './RadioGroupContext';
import type { BaseUIChangeEventDetails } from '../internals/createBaseUIEventDetails';
import { REASONS } from '../internals/reasons';

const MODIFIER_KEYS = [SHIFT];

/**
 * Provides a shared state to a series of radio buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Radio Group](https://base-ui.com/react/components/radio)
 */
export const RadioGroup = React.forwardRef(function RadioGroup<Value>(
  componentProps: RadioGroup.Props<Value>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    render,
    className,
    disabled: disabledProp,
    readOnly,
    required,
    onValueChange: onValueChangeProp,
    value: externalValue,
    defaultValue,
    form,
    name: nameProp,
    inputRef: inputRefProp,
    id: idProp,
    style,
    ...elementProps
  } = componentProps;

  const {
    setTouched: setFieldTouched,
    setFocused,
    validationMode,
    name: fieldName,
    disabled: fieldDisabled,
    state: fieldState,
    validation,
    setDirty,
    setFilled,
    validityData,
  } = useFieldRootContext();
  const { labelId } = useLabelableContext();
  const { clearErrors } = useFormContext();
  const fieldsetContext = useFieldsetRootContext(true);

  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;
  const id = useBaseUiId(idProp);

  const [checkedValue, setCheckedValueUnwrapped] = useControlled({
    controlled: externalValue,
    default: defaultValue,
    name: 'RadioGroup',
    state: 'value',
  });
  const [touched, setTouched] = React.useState(false);

  const setCheckedValue = useStableCallback(
    (value: Value, eventDetails: RadioGroup.ChangeEventDetails) => {
      onValueChangeProp?.(value, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      setCheckedValueUnwrapped(value);
    },
  );

  const controlRef = React.useRef<HTMLElement>(null);
  const groupInputRef = React.useRef<HTMLInputElement | null>(null);
  const firstEnabledInputRef = React.useRef<HTMLInputElement | null>(null);

  function setInputRef(hiddenInput: HTMLInputElement | null) {
    let cleanup: void | (() => void) | undefined = undefined;

    if (inputRefProp) {
      if (typeof inputRefProp === 'function') {
        cleanup = inputRefProp(hiddenInput);
      } else {
        inputRefProp.current = hiddenInput;
      }
    }

    groupInputRef.current = hiddenInput;
    validation.inputRef.current = hiddenInput;

    return cleanup;
  }

  const registerControlRef = useStableCallback(
    (element: HTMLElement | null, isDisabled = false) => {
      if (!element) {
        return;
      }

      if (isDisabled) {
        if (controlRef.current === element) {
          controlRef.current = null;
        }
        return;
      }

      if (controlRef.current == null) {
        controlRef.current = element;
      }
    },
  );

  const registerInputRef = useStableCallback((input: HTMLInputElement | null) => {
    if (!input || input.disabled) {
      return undefined;
    }

    if (!firstEnabledInputRef.current) {
      firstEnabledInputRef.current = input;
    }

    const currentInput = groupInputRef.current;
    if (input.checked || currentInput == null || currentInput.disabled) {
      return setInputRef(input);
    }

    return undefined;
  });

  const getFormValue = useStableCallback(() => {
    // Disabled radios are excluded from native form submission, so a disabled
    // selection shouldn't be reported as the field's value either.
    const input = groupInputRef.current;
    if (!input || input.disabled || !input.checked) {
      return null;
    }

    return checkedValue ?? null;
  });

  useRegisterFieldControl(controlRef, id, checkedValue ?? null, getFormValue, !disabled, nameProp);

  useValueChanged(checkedValue, () => {
    clearErrors(name);

    setDirty(checkedValue !== validityData.initialValue);
    setFilled(checkedValue != null);

    validation.change(checkedValue);

    const fallbackInput = firstEnabledInputRef.current;
    if (checkedValue == null && fallbackInput && !fallbackInput.disabled) {
      setInputRef(fallbackInput);
    }
  });

  const ariaLabelledby = elementProps['aria-labelledby'] ?? labelId ?? fieldsetContext?.legendId;

  const state: RadioGroupState = {
    ...fieldState,
    disabled: disabled ?? false,
    required: required ?? false,
    readOnly: readOnly ?? false,
  };

  const contextValue: RadioGroupContext<Value> = React.useMemo(
    () => ({
      ...fieldState,
      checkedValue,
      disabled,
      form,
      validation,
      name,
      readOnly,
      registerControlRef,
      registerInputRef,
      required,
      setCheckedValue,
      setTouched,
      touched,
    }),
    [
      checkedValue,
      disabled,
      form,
      validation,
      fieldState,
      name,
      readOnly,
      registerControlRef,
      registerInputRef,
      required,
      setCheckedValue,
      setTouched,
      touched,
    ],
  );

  const defaultProps: HTMLProps = {
    id: idProp,
    role: 'radiogroup',
    'aria-required': required || undefined,
    'aria-disabled': disabled || undefined,
    'aria-readonly': readOnly || undefined,
    'aria-labelledby': ariaLabelledby,
    onFocus() {
      setFocused(true);
    },
    onBlur(event) {
      if (!contains(event.currentTarget, event.relatedTarget)) {
        setFieldTouched(true);
        setFocused(false);

        if (validationMode === 'onBlur') {
          validation.commit(checkedValue);
        }
      }
    },
    onKeyDownCapture(event) {
      if (event.key.startsWith('Arrow')) {
        setTouched(true);
        setFocused(true);
      }
    },
  };

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <CompositeRoot
        render={render}
        className={className}
        style={style}
        state={state}
        props={[
          defaultProps,
          elementProps,
          (props: HTMLProps) => validation.getValidationProps(disabled ?? false, props),
        ]}
        refs={[forwardedRef]}
        stateAttributesMapping={fieldValidityMapping}
        enableHomeAndEndKeys={false}
        modifierKeys={MODIFIER_KEYS}
      />
    </RadioGroupContext.Provider>
  );
}) as {
  <Value>(props: RadioGroup.Props<Value>): React.JSX.Element;
};

export interface RadioGroupState extends FieldRootState {
  /**
   * Whether the user should be unable to select a different radio button in the group.
   */
  readOnly: boolean;
  /**
   * Whether the user must tick a radio button within the group before submitting a form.
   */
  required: boolean;
}

export interface RadioGroupProps<Value = any> extends Omit<
  BaseUIComponentProps<'div', RadioGroupState>,
  'value'
> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to select a different radio button in the group.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Whether the user must choose a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * Identifies the form that owns the radio inputs.
   * Useful when the radio group is rendered outside the form.
   */
  form?: string | undefined;
  /**
   * The controlled value of the radio item that should be currently selected.
   *
   * To render an uncontrolled radio group, use the `defaultValue` prop instead.
   */
  value?: Value | undefined;
  /**
   * The uncontrolled value of the radio button that should be initially selected.
   *
   * To render a controlled radio group, use the `value` prop instead.
   */
  defaultValue?: Value | undefined;
  /**
   * Callback fired when the value changes.
   */
  onValueChange?: ((value: Value, eventDetails: RadioGroup.ChangeEventDetails) => void) | undefined;
  /**
   * A ref to access the hidden input element.
   */
  inputRef?: React.Ref<HTMLInputElement> | undefined;
}

export type RadioGroupChangeEventReason = typeof REASONS.none;

export type RadioGroupChangeEventDetails = BaseUIChangeEventDetails<RadioGroup.ChangeEventReason>;

export namespace RadioGroup {
  export type State = RadioGroupState;
  export type Props<TValue = any> = RadioGroupProps<TValue>;
  export type ChangeEventReason = RadioGroupChangeEventReason;
  export type ChangeEventDetails = RadioGroupChangeEventDetails;
}
