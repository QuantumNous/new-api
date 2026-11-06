'use client';
import * as React from 'react';
import { SafeReact } from '@base-ui/utils/safeReact';
import { useControlled } from '@base-ui/utils/useControlled';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { visuallyHidden, visuallyHiddenInput } from '@base-ui/utils/visuallyHidden';
import { warn } from '@base-ui/utils/warn';
import { ownerDocument } from '@base-ui/utils/owner';
import { contains } from '../../floating-ui-react/utils';
import { CompositeList } from '../../internals/composite/list/CompositeList';
import { useFieldRootContext } from '../../internals/field-root-context/FieldRootContext';
import { useRegisterFieldControl } from '../../internals/field-register-control/useRegisterFieldControl';
import type { FieldRootState } from '../../field/root/FieldRoot';
import { useFormContext } from '../../internals/form-context/FormContext';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useAriaLabelledBy } from '../../internals/labelable-provider/useAriaLabelledBy';
import { useLabelableId } from '../../internals/labelable-provider/useLabelableId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useValueChanged } from '../../internals/useValueChanged';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
  type BaseUIChangeEventDetails,
  type BaseUIGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { OTPFieldRootContext } from './OTPFieldRootContext';
import { rootStateAttributesMapping } from '../utils/stateAttributesMapping';
import {
  getOTPValidationConfig,
  normalizeOTPValue,
  normalizeOTPValueWithDetails,
  type OTPValidationType,
} from '../utils/otp';

/**
 * Groups all OTP field parts and manages their state.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export const OTPFieldRoot = React.forwardRef(function OTPFieldRoot(
  componentProps: OTPFieldRoot.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const {
    'aria-describedby': ariaDescribedByProp,
    'aria-labelledby': ariaLabelledByProp,
    id: idProp,
    autoComplete = 'one-time-code',
    defaultValue,
    value: valueProp,
    onValueChange,
    onValueComplete: onValueCompleteProp,
    form,
    length,
    autoSubmit = false,
    mask = false,
    inputMode: inputModeProp,
    validationType = 'numeric',
    normalizeValue,
    disabled: disabledProp = false,
    readOnly = false,
    required = false,
    name: nameProp,
    onValueInvalid,
    render,
    className,
    style,
    ...elementProps
  } = componentProps;

  const {
    setDirty,
    validityData,
    disabled: fieldDisabled,
    setFilled,
    invalid,
    name: fieldName,
    state: fieldState,
    validation,
    validationMode,
    setFocused,
    setTouched,
  } = useFieldRootContext();
  const { clearErrors } = useFormContext();
  const { getDescriptionProps, labelId } = useLabelableContext();

  const disabled = fieldDisabled || disabledProp;
  const name = fieldName ?? nameProp;

  const [valueUnwrapped, setValueUnwrapped] = useControlled<string>({
    controlled: valueProp,
    default: defaultValue,
    name: 'OTPField',
    state: 'value',
  });

  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const pendingFocusRef = React.useRef<{
    index: number;
    value: string;
  } | null>(null);
  const pendingCompleteValueRef = React.useRef<{
    value: string;
    eventDetails: OTPFieldRoot.CompleteEventDetails;
  } | null>(null);
  const firstInputRef = React.useMemo(
    () =>
      ({
        get current() {
          return inputRefs.current[0] ?? null;
        },
      }) as React.RefObject<HTMLInputElement | null>,
    [],
  );

  const id = useLabelableId({ id: idProp });
  const ariaLabelledBy = useAriaLabelledBy(ariaLabelledByProp, labelId, firstInputRef, true, id);
  const inputAriaLabelledBy = ariaLabelledByProp == null ? ariaLabelledBy : undefined;
  const fieldDescriptionProps = getDescriptionProps({});
  const ariaDescribedBy = mergeAriaIds(
    ariaDescribedByProp,
    fieldDescriptionProps['aria-describedby'],
  );
  const validationConfig = getOTPValidationConfig(validationType);
  const pattern = validationConfig?.slotPattern;
  const hiddenInputPattern = validationConfig?.getRootPattern(length);
  const inputMode = inputModeProp ?? validationConfig?.inputMode;
  const hasValidLength = Number.isInteger(length) && length > 0;

  const value = normalizeOTPValue(valueUnwrapped, length, validationType, normalizeValue);
  const valueRef = useValueAsRef(value);
  const filled = value !== '';

  const [inputCount, setInputCount] = React.useState(0);
  const [focusedIndex, setFocusedIndex] = React.useState(() => Math.min(value.length, length - 1));
  const [focused, setFocusedState] = React.useState(false);

  const activeIndex = focused
    ? Math.min(focusedIndex, Math.max(length - 1, 0))
    : Math.min(value.length, length - 1);

  useIsoLayoutEffect(() => {
    setFilled(filled);
  }, [filled, setFilled]);

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useOTPFieldRootDevWarnings({
      inputCount,
      length,
    });
  }

  useRegisterFieldControl(firstInputRef, id, value, undefined, !disabled, nameProp);

  const focusInput = useStableCallback((index: number) => {
    const targetIndex = Math.min(Math.max(index, 0), Math.max(inputRefs.current.length - 1, 0));
    const target = inputRefs.current[targetIndex];
    target?.focus();
    target?.select();
  });

  const queueFocusInput = useStableCallback((index: number, nextValue: string) => {
    pendingFocusRef.current = { index, value: nextValue };
  });

  function requestSubmit() {
    let formElement = validation.inputRef.current?.form ?? inputRefs.current[0]?.form ?? null;

    if (form) {
      const associatedElement = ownerDocument(rootRef.current).getElementById(form);
      if (associatedElement?.tagName === 'FORM') {
        formElement = associatedElement as HTMLFormElement;
      }
    }

    if (formElement && typeof formElement.requestSubmit === 'function') {
      formElement.requestSubmit();
    }
  }

  function completeValue(completedValue: string, eventDetails: OTPFieldRoot.CompleteEventDetails) {
    onValueCompleteProp?.(completedValue, eventDetails);

    if (autoSubmit) {
      requestSubmit();
    }
  }

  useValueChanged(value, () => {
    clearErrors(name);
    setDirty(value !== validityData.initialValue);

    validation.change(value);

    const pendingCompleteValue = pendingCompleteValueRef.current;

    if (pendingCompleteValue != null) {
      pendingCompleteValueRef.current = null;

      if (pendingCompleteValue.value === value) {
        completeValue(value, pendingCompleteValue.eventDetails);
      }
    }

    const pendingFocus = pendingFocusRef.current;

    if (pendingFocus != null) {
      pendingFocusRef.current = null;

      if (pendingFocus.value === value) {
        focusInput(pendingFocus.index);
      }
    }
  });

  const setValue = useStableCallback(
    (nextValue: string, details: OTPFieldRoot.ChangeEventDetails) => {
      const normalizedValue = normalizeOTPValue(nextValue, length, validationType, normalizeValue);
      const completeEventDetails =
        normalizedValue.length === length &&
        (valueRef.current.length !== length || details.reason === REASONS.inputPaste)
          ? getCompleteEventDetails(details)
          : null;

      if (normalizedValue === valueRef.current) {
        if (completeEventDetails != null) {
          completeValue(normalizedValue, completeEventDetails);
        }

        return null;
      }

      onValueChange?.(normalizedValue, details);

      if (details.isCanceled) {
        return null;
      }

      setValueUnwrapped(normalizedValue);
      if (completeEventDetails != null) {
        pendingCompleteValueRef.current = {
          value: normalizedValue,
          eventDetails: completeEventDetails,
        };
      } else if (normalizedValue.length !== length) {
        pendingCompleteValueRef.current = null;
      }

      return normalizedValue;
    },
  );

  const reportValueInvalid = useStableCallback(
    (invalidValue: string, details: OTPFieldRoot.InvalidEventDetails) => {
      onValueInvalid?.(invalidValue, details);
    },
  );

  const handleInputFocus = useStableCallback(
    (index: number, event: React.FocusEvent<HTMLInputElement>) => {
      if (index > valueRef.current.length) {
        focusInput(Math.min(valueRef.current.length, length - 1));
        return;
      }

      setFocusedIndex(index);
      setFocusedState(true);
      setFocused(true);
      event.currentTarget.select();
    },
  );

  const handleInputBlur = useStableCallback((event: React.FocusEvent<HTMLInputElement>) => {
    if (contains(rootRef.current, event.relatedTarget)) {
      return;
    }

    setTouched(true);
    setFocusedState(false);
    setFocused(false);

    if (validationMode === 'onBlur') {
      validation.commit(valueRef.current);
    }
  });

  const getInputId = React.useCallback(
    (index: number) => {
      if (id == null) {
        return undefined;
      }

      return index === 0 ? id : `${id}-${index + 1}`;
    },
    [id],
  );

  const state: OTPFieldRootState = React.useMemo(
    () => ({
      ...fieldState,
      complete: value.length === length,
      disabled,
      filled,
      focused,
      length,
      readOnly,
      required,
      value,
    }),
    [disabled, fieldState, filled, focused, length, readOnly, required, value],
  );

  const contextValue: OTPFieldRootContext = React.useMemo(
    () => ({
      autoComplete,
      activeIndex,
      disabled,
      form,
      focusInput,
      queueFocusInput,
      getInputId,
      handleInputBlur,
      handleInputFocus,
      inputMode,
      inputAriaLabelledBy,
      invalid,
      length,
      mask,
      pattern,
      reportValueInvalid,
      readOnly,
      required,
      normalizeValue,
      setValue,
      state,
      validationType,
      value,
    }),
    [
      activeIndex,
      autoComplete,
      disabled,
      focusInput,
      form,
      getInputId,
      handleInputBlur,
      handleInputFocus,
      inputMode,
      inputAriaLabelledBy,
      invalid,
      length,
      mask,
      pattern,
      queueFocusInput,
      readOnly,
      reportValueInvalid,
      required,
      normalizeValue,
      setValue,
      state,
      validationType,
      value,
    ],
  );

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, rootRef],
    state,
    props: [
      {
        role: 'group',
        'aria-describedby': ariaDescribedBy,
        'aria-labelledby': ariaLabelledBy,
      },
      elementProps,
    ],
    stateAttributesMapping: rootStateAttributesMapping,
  });

  return (
    <CompositeList
      elementsRef={inputRefs}
      onMapChange={(newMap) => {
        setInputCount(newMap.size);
      }}
    >
      <OTPFieldRootContext.Provider value={contextValue}>
        {element}
        {hasValidLength && (
          <input
            {...validation.getValidationProps(disabled, {
              onFocus() {
                focusInput(0);
              },
              onChange(event: React.ChangeEvent<HTMLInputElement>) {
                if (event.nativeEvent.defaultPrevented || disabled || readOnly) {
                  return;
                }

                const rawValue = event.currentTarget.value;
                const [normalizedValue, didRejectCharacters] = normalizeOTPValueWithDetails(
                  rawValue,
                  length,
                  validationType,
                  normalizeValue,
                );

                if (didRejectCharacters) {
                  reportValueInvalid(
                    rawValue,
                    createGenericEventDetails(REASONS.inputChange, event.nativeEvent),
                  );
                }

                const committedValue = setValue(
                  normalizedValue,
                  createChangeEventDetails(REASONS.inputChange, event.nativeEvent),
                );

                if (committedValue != null && committedValue !== '') {
                  queueFocusInput(committedValue.length - 1, committedValue);
                }
              },
            })}
            ref={validation.inputRef}
            type="text"
            id={id && name == null ? `${id}-hidden-input` : undefined}
            form={form}
            name={name}
            value={value}
            autoComplete={autoComplete}
            inputMode={inputMode}
            minLength={length}
            maxLength={length}
            pattern={hiddenInputPattern}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            aria-hidden
            tabIndex={-1}
            style={name ? visuallyHiddenInput : visuallyHidden}
          />
        )}
      </OTPFieldRootContext.Provider>
    </CompositeList>
  );
});

function getCompleteEventDetails(details: OTPFieldRoot.ChangeEventDetails) {
  if (details.reason === REASONS.inputChange || details.reason === REASONS.inputPaste) {
    return createGenericEventDetails(details.reason, details.event);
  }

  return null;
}

export interface OTPFieldRootProps extends Omit<
  BaseUIComponentProps<'div', OTPFieldRootState>,
  'onChange'
> {
  /**
   * The id of the first input element.
   * Subsequent inputs derive their ids from it (`{id}-2`, `{id}-3`, and so on).
   */
  id?: string | undefined;
  /**
   * The input autocomplete attribute. Applied to the first slot and hidden validation input.
   * @default 'one-time-code'
   */
  autoComplete?: string | undefined;
  /**
   * A string specifying the `form` element with which the hidden input is associated.
   * This string's value must match the id of a `form` element in the same document.
   */
  form?: string | undefined;
  /**
   * The number of OTP input slots.
   * Required so the root can clamp values, detect completion, and generate
   * consistent validation markup before all slots hydrate.
   */
  length: number;
  /**
   * Whether to submit the owning form when the OTP becomes complete.
   * @default false
   */
  autoSubmit?: boolean | undefined;
  /**
   * Whether the slot inputs should mask entered characters.
   * Pass `type` directly to individual `<OTPField.Input>` parts to use a custom
   * input type.
   * @default false
   */
  mask?: boolean | undefined;
  /**
   * The virtual keyboard hint applied to the slot inputs and hidden validation input.
   *
   * Built-in validation modes provide sensible defaults, but you can override them when needed.
   */
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'] | undefined;
  /**
   * The type of input validation to apply to the OTP value.
   * @default 'numeric'
   */
  validationType?: OTPFieldRoot.ValidationType | undefined;
  /**
   * Function that normalizes the OTP value after whitespace and `validationType` filtering.
   * It runs whenever OTP Field normalizes a value, including initial/default values, controlled
   * values, and user edits.
   *
   * The returned value is filtered by `validationType` again, then clamped to `length`.
   * It should be idempotent because OTP Field may normalize the same value more than once while
   * handling edits, storing state, and rendering controlled or uncontrolled values. Non-idempotent
   * normalizers can compound across those normalization passes. Characters rejected while
   * normalizing typed or pasted text are reported through `onValueInvalid`.
   */
  normalizeValue?: ((value: string) => string) | undefined;
  /**
   * Whether the user must enter a value before submitting a form.
   * @default false
   */
  required?: boolean | undefined;
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user should be unable to change the field value.
   * @default false
   */
  readOnly?: boolean | undefined;
  /**
   * Identifies the field when a form is submitted.
   */
  name?: string | undefined;
  /**
   * The OTP value.
   */
  value?: string | undefined;
  /**
   * The uncontrolled OTP value when the component is initially rendered.
   */
  defaultValue?: string | undefined;
  /**
   * Callback fired when the OTP value changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   * - `'input-change'` for typing or autofill
   * - `'input-clear'` when a character is removed by text input
   * - `'input-paste'` for paste interactions
   * - `'keyboard'` for keyboard interactions that change the value
   */
  onValueChange?:
    | ((value: string, eventDetails: OTPFieldRoot.ChangeEventDetails) => void)
    | undefined;
  /**
   * Callback fired when entered text contains characters that are rejected by validation or
   * normalization before the OTP value updates.
   *
   * The `value` argument is the attempted user-entered string before normalization.
   */
  onValueInvalid?:
    | ((value: string, eventDetails: OTPFieldRoot.InvalidEventDetails) => void)
    | undefined;
  /**
   * Callback function that is fired when the OTP value becomes complete, or when a complete value
   * is pasted while the OTP is already complete.
   *
   * When the value changes, it runs later than `onValueChange`, after the internal value update is
   * applied. If a complete pasted value matches the current value, `onValueChange` does not fire.
   *
   * If `autoSubmit` is enabled, it runs immediately before the owning form is submitted.
   */
  onValueComplete?:
    | ((value: string, eventDetails: OTPFieldRoot.CompleteEventDetails) => void)
    | undefined;
}

export interface OTPFieldRootState extends FieldRootState {
  /**
   * Whether all slots are filled.
   */
  complete: boolean;
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * The number of OTP input slots.
   */
  length: number;
  /**
   * Whether the user should be unable to change the field value.
   */
  readOnly: boolean;
  /**
   * Whether the user must enter a value before submitting a form.
   */
  required: boolean;
  /**
   * The OTP value.
   */
  value: string;
}

export type OTPFieldRootChangeEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputClear
  | typeof REASONS.inputPaste
  | typeof REASONS.keyboard;
export type OTPFieldRootChangeEventDetails =
  BaseUIChangeEventDetails<OTPFieldRoot.ChangeEventReason>;

export type OTPFieldRootInvalidEventReason = typeof REASONS.inputChange | typeof REASONS.inputPaste;
export type OTPFieldRootInvalidEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.InvalidEventReason>;

export type OTPFieldRootCompleteEventReason =
  | typeof REASONS.inputChange
  | typeof REASONS.inputPaste;
export type OTPFieldRootCompleteEventDetails =
  BaseUIGenericEventDetails<OTPFieldRoot.CompleteEventReason>;

export namespace OTPFieldRoot {
  export type State = OTPFieldRootState;
  export type Props = OTPFieldRootProps;
  export type ValidationType = OTPValidationType;
  export type ChangeEventReason = OTPFieldRootChangeEventReason;
  export type ChangeEventDetails = OTPFieldRootChangeEventDetails;
  export type InvalidEventReason = OTPFieldRootInvalidEventReason;
  export type InvalidEventDetails = OTPFieldRootInvalidEventDetails;
  export type CompleteEventReason = OTPFieldRootCompleteEventReason;
  export type CompleteEventDetails = OTPFieldRootCompleteEventDetails;
}

function mergeAriaIds(...values: Array<string | undefined>) {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? Array.from(new Set(ids)).join(' ') : undefined;
}

interface UseOTPFieldRootDevWarningsParameters {
  inputCount: number;
  length: number;
}

function useOTPFieldRootDevWarnings(parameters: UseOTPFieldRootDevWarningsParameters) {
  const { inputCount, length } = parameters;

  React.useEffect(() => {
    if (!Number.isInteger(length) || length <= 0 || inputCount === 0 || inputCount === length) {
      return;
    }

    const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
    const message =
      '<OTPField.Root> `length` must match the number of rendered ' +
      `<OTPField.Input /> parts. Received \`length={${length}}\` but rendered ` +
      `${inputCount} input${inputCount === 1 ? '' : 's'}.`;
    warn(message, ownerStackMessage);
  }, [inputCount, length]);

  React.useEffect(() => {
    if (Number.isInteger(length) && length > 0) {
      return;
    }

    const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
    warn(
      `<OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(length)}}\`.`,
      ownerStackMessage,
    );
  }, [length]);
}
