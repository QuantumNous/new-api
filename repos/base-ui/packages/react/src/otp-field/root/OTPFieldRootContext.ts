'use client';
import * as React from 'react';
import type { OTPFieldRoot, OTPFieldRootState } from './OTPFieldRoot';
import type { OTPFieldInputState } from '../input/OTPFieldInput';

export interface OTPFieldRootContext {
  activeIndex: number;
  autoComplete: string | undefined;
  disabled: boolean;
  form: string | undefined;
  focusInput: (index: number) => void;
  queueFocusInput: (index: number, value: string) => void;
  getInputId: (index: number) => string | undefined;
  handleInputBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  handleInputFocus: (index: number, event: React.FocusEvent<HTMLInputElement>) => void;
  inputMode: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  inputAriaLabelledBy: string | undefined;
  invalid: boolean | undefined;
  length: number;
  mask: boolean;
  pattern: string | undefined;
  reportValueInvalid: (value: string, details: OTPFieldRoot.InvalidEventDetails) => void;
  readOnly: boolean;
  required: boolean;
  normalizeValue: ((value: string) => string) | undefined;
  setValue: (value: string, details: OTPFieldRoot.ChangeEventDetails) => string | null;
  state: OTPFieldRootState;
  validationType: OTPFieldRoot.ValidationType;
  value: string;
}

export const OTPFieldRootContext = React.createContext<OTPFieldRootContext | undefined>(undefined);

export function useOTPFieldRootContext() {
  const context = React.useContext(OTPFieldRootContext);

  if (context === undefined) {
    throw new Error(
      'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
    );
  }

  return context;
}

export function getOTPFieldInputState(
  state: OTPFieldRootState,
  value: string,
  index: number,
): OTPFieldInputState {
  return {
    ...state,
    value,
    index,
    filled: value !== '',
  };
}
