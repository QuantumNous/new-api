'use client';
import * as React from 'react';
import { SafeReact } from '@base-ui/utils/safeReact';
import { warn } from '@base-ui/utils/warn';
import { stopEvent } from '../../floating-ui-react/utils';
import {
  IndexGuessBehavior,
  useCompositeListItem,
} from '../../internals/composite/list/useCompositeListItem';
import type { BaseUIComponentProps } from '../../internals/types';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useOTPFieldRootContext, getOTPFieldInputState } from '../root/OTPFieldRootContext';
import type { OTPFieldRootState } from '../root/OTPFieldRoot';
import { inputStateAttributesMapping } from '../utils/stateAttributesMapping';
import { normalizeOTPValueWithDetails, removeOTPCharacter, replaceOTPValue } from '../utils/otp';

/**
 * An individual OTP character input.
 * Renders an `<input>` element.
 *
 * Documentation: [Base UI OTP Field](https://base-ui.com/react/components/otp-field)
 */
export const OTPFieldInput = React.forwardRef(function OTPFieldInput(
  componentProps: OTPFieldInput.Props,
  forwardedRef: React.ForwardedRef<HTMLInputElement>,
) {
  const {
    'aria-label': externalAriaLabel,
    'aria-labelledby': externalAriaLabelledBy,
    render,
    className,
    style,
    ...elementProps
  } = componentProps;

  const {
    activeIndex,
    autoComplete,
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
  } = useOTPFieldRootContext();

  const { ref: listItemRef, index } = useCompositeListItem({
    indexGuessBehavior: IndexGuessBehavior.GuessFromOrder,
  });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const direction = useDirection();

  const slotValue = value[index] ?? '';
  const inputState = getOTPFieldInputState(state, slotValue, index);
  const slotAriaLabel = externalAriaLabel;
  const inheritedLabel = externalAriaLabelledBy ?? inputAriaLabelledBy;
  const ariaLabel = index === 0 ? undefined : slotAriaLabel;

  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (index !== 0 || slotAriaLabel == null || inputRef.current?.labels?.length) {
        return;
      }

      const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
      warn(
        '<OTPField.Input> ignores `aria-label` on the first input. Use a `<label>` or `<Field.Label>` to label the OTP field.',
        ownerStackMessage,
      );
    }, [index, slotAriaLabel]);
  }

  const inputProps: React.ComponentProps<'input'> = {
    id: getInputId(index),
    value: slotValue,
    type: mask ? 'password' : 'text',
    inputMode,
    autoComplete: index === 0 ? autoComplete : 'off',
    autoCorrect: 'off',
    spellCheck: 'false',
    enterKeyHint: index === length - 1 ? 'done' : 'next',
    // Only the first slot has a max length to avoid password manager bubbles appearing after later inputs.
    maxLength: index === 0 ? length : undefined,
    tabIndex: activeIndex === index ? 0 : -1,
    disabled,
    form,
    pattern,
    readOnly,
    required,
    'aria-labelledby': ariaLabel == null ? inheritedLabel : undefined,
    'aria-invalid': !disabled && invalid ? true : undefined,
    'aria-label': ariaLabel,
    onMouseDown(event) {
      if (event.defaultPrevented || disabled) {
        return;
      }

      event.preventDefault();
      focusInput(index);
    },
    onFocus(event) {
      if (event.defaultPrevented || disabled) {
        return;
      }

      handleInputFocus(index, event);
    },
    onBlur(event) {
      if (event.defaultPrevented) {
        return;
      }

      handleInputBlur(event);
    },
    onChange(event) {
      if (event.defaultPrevented || disabled || readOnly) {
        return;
      }

      const rawValue = event.currentTarget.value;
      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
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

      if (nextDigits === '') {
        if (rawValue === '') {
          setValue(
            removeOTPCharacter(value, index),
            createChangeEventDetails(REASONS.inputClear, event.nativeEvent),
          );
        } else if (slotValue !== '') {
          event.currentTarget.value = slotValue;
          event.currentTarget.select();
        }
        return;
      }

      const nextValue = replaceOTPValue(
        value,
        index,
        nextDigits,
        length,
        validationType,
        normalizeValue,
      );

      const committedValue = setValue(
        nextValue,
        createChangeEventDetails(REASONS.inputChange, event.nativeEvent),
      );

      if (committedValue != null) {
        const nextInput = Math.min(index + nextDigits.length, length - 1);
        queueFocusInput(nextInput, committedValue);
      }
    },
    onKeyDown(event) {
      if (event.defaultPrevented || disabled) {
        return;
      }

      const firstIndex = 0;
      const lastIndex = Math.max(length - 1, firstIndex);
      const endTargetIndex = Math.min(value.length, lastIndex);
      const hasBoundaryModifier = (event.ctrlKey || event.metaKey) && !event.altKey;
      const isRtl = direction === 'rtl';
      const previousKey = isRtl ? 'ArrowRight' : 'ArrowLeft';
      const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';

      if (event.key === previousKey) {
        stopEvent(event);
        focusInput(hasBoundaryModifier ? firstIndex : Math.max(firstIndex, index - 1));
        return;
      }

      if (event.key === nextKey) {
        stopEvent(event);
        focusInput(hasBoundaryModifier ? endTargetIndex : Math.min(lastIndex, index + 1));
        return;
      }

      if (event.key === 'Home' || event.key === 'ArrowUp') {
        stopEvent(event);
        focusInput(firstIndex);
        return;
      }

      if (event.key === 'End' || event.key === 'ArrowDown') {
        stopEvent(event);
        focusInput(endTargetIndex);
        return;
      }

      if (readOnly) {
        return;
      }

      function setKeyboardValue(nextValue: string, targetIndex: number) {
        const committedValue = setValue(
          nextValue,
          createChangeEventDetails(REASONS.keyboard, event.nativeEvent),
        );

        if (committedValue != null) {
          queueFocusInput(targetIndex, committedValue);
        }
      }

      if (event.key === 'Backspace' && hasBoundaryModifier) {
        stopEvent(event);
        setKeyboardValue('', firstIndex);
        return;
      }

      if (event.key === 'Delete') {
        stopEvent(event);
        setKeyboardValue(removeOTPCharacter(value, index), index);
        return;
      }

      const inputValue = event.currentTarget.value;
      const fullSelection =
        event.currentTarget.selectionStart === 0 &&
        event.currentTarget.selectionEnd === inputValue.length;

      if (event.key.length === 1 && fullSelection && slotValue === event.key) {
        stopEvent(event);
        if (index < length - 1) {
          focusInput(index + 1);
        }
        return;
      }

      if (event.key === 'Backspace') {
        stopEvent(event);
        const targetIndex = Math.max(firstIndex, index - 1);
        const deleteIndex = slotValue === '' ? targetIndex : index;
        setKeyboardValue(removeOTPCharacter(value, deleteIndex), targetIndex);
      }
    },
    onPaste(event) {
      if (event.defaultPrevented || disabled || readOnly) {
        return;
      }

      let rawValue = '';

      try {
        rawValue = event.clipboardData?.getData('text/plain') ?? '';
      } catch {
        if (process.env.NODE_ENV !== 'production') {
          const ownerStackMessage = SafeReact.captureOwnerStack?.() || '';
          warn(
            '<OTPField.Input> could not read clipboard text during paste handling.',
            ownerStackMessage,
          );
        }

        return;
      }

      event.preventDefault();

      const [nextDigits, didRejectCharacters] = normalizeOTPValueWithDetails(
        rawValue,
        length,
        validationType,
        normalizeValue,
      );

      if (didRejectCharacters) {
        reportValueInvalid(
          rawValue,
          createGenericEventDetails(REASONS.inputPaste, event.nativeEvent),
        );
      }

      if (nextDigits === '') {
        return;
      }

      const committedValue = setValue(
        replaceOTPValue(value, index, nextDigits, length, validationType, normalizeValue),
        createChangeEventDetails(REASONS.inputPaste, event.nativeEvent),
      );

      if (committedValue != null) {
        const nextInput = Math.min(index + nextDigits.length, length - 1);
        queueFocusInput(nextInput, committedValue);
      }
    },
  };

  const element = useRenderElement('input', componentProps, {
    ref: [forwardedRef, listItemRef, inputRef],
    state: inputState,
    props: [inputProps, elementProps],
    stateAttributesMapping: inputStateAttributesMapping,
  });

  return element;
});

export interface OTPFieldInputState extends Omit<OTPFieldRootState, 'filled' | 'value'> {
  /**
   * Whether this input contains a character.
   */
  filled: boolean;
  /**
   * The input index.
   */
  index: number;
  /**
   * The character rendered in this slot.
   */
  value: string;
}

export interface OTPFieldInputProps extends BaseUIComponentProps<'input', OTPFieldInputState> {}

export namespace OTPFieldInput {
  export type State = OTPFieldInputState;
  export type Props = OTPFieldInputProps;
}
