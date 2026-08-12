'use client';
import * as React from 'react';
import { type FloatingRootContext } from '../../floating-ui-react';
import type { SelectStore } from '../store';
import type { UseFieldValidationReturnValue } from '../../field/root/useFieldValidation';
import type { HTMLProps } from '../../internals/types';
import type { SelectRoot } from './SelectRoot';

export interface SelectRootContext {
  store: SelectStore;
  name: string | undefined;
  disabled: boolean;
  readOnly: boolean;
  required: boolean;
  multiple: boolean;
  highlightItemOnHover: boolean;
  setValue: (nextValue: any, eventDetails: SelectRoot.ChangeEventDetails) => void;
  setOpen: (open: boolean, eventDetails: SelectRoot.ChangeEventDetails) => void;
  listRef: React.RefObject<Array<HTMLElement | null>>;
  popupRef: React.RefObject<HTMLDivElement | null>;
  scrollHandlerRef: React.RefObject<((el: HTMLDivElement) => void) | null>;
  handleScrollArrowVisibility: () => void;
  scrollArrowsMountedCountRef: React.RefObject<number>;
  itemProps: HTMLProps;
  valueRef: React.RefObject<HTMLSpanElement | null>;
  valuesRef: React.RefObject<Array<any>>;
  labelsRef: React.RefObject<Array<string | null>>;
  typingRef: React.RefObject<boolean>;
  selectionRef: React.RefObject<{
    allowUnselectedMouseUp: boolean;
    allowSelectedMouseUp: boolean;
    dragY: number;
  }>;
  firstItemTextRef: React.RefObject<HTMLElement | null>;
  selectedItemTextRef: React.RefObject<HTMLElement | null>;
  validation: UseFieldValidationReturnValue;
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  alignItemWithTriggerActiveRef: React.RefObject<boolean>;
  initialValueRef: React.RefObject<any>;
}

export const SelectRootContext = React.createContext<SelectRootContext | null>(null);
export const SelectFloatingContext = React.createContext<FloatingRootContext | null>(null);

export function useSelectRootContext() {
  const context = React.useContext(SelectRootContext);
  if (context === null) {
    throw new Error(
      'Base UI: SelectRootContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return context;
}

export function useSelectFloatingContext() {
  const context = React.useContext(SelectFloatingContext);
  if (context === null) {
    throw new Error(
      'Base UI: SelectFloatingContext is missing. Select parts must be placed within <Select.Root>.',
    );
  }
  return context;
}
