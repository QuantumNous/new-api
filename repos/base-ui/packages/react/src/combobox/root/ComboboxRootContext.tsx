'use client';
import * as React from 'react';
import { ComboboxStore } from '../store';
import type { FloatingRootContext } from '../../floating-ui-react';

export interface ComboboxDerivedItemsContext {
  query: string;
  hasItems: boolean;
  filteredItems: any[];
  flatFilteredItems: any[];
}

export const ComboboxRootContext = React.createContext<ComboboxStore | undefined>(undefined);
export const ComboboxFloatingContext = React.createContext<FloatingRootContext | undefined>(
  undefined,
);
export const ComboboxDerivedItemsContext = React.createContext<
  ComboboxDerivedItemsContext | undefined
>(undefined);
export const ComboboxHasItemsContext = React.createContext<boolean>(false);
// `inputValue` can't be placed in the store.
// https://github.com/mui/base-ui/issues/2703
export const ComboboxInputValueContext =
  React.createContext<React.ComponentProps<'input'>['value']>('');

export function useComboboxRootContext() {
  const context = React.useContext(ComboboxRootContext) as ComboboxStore | undefined;
  if (!context) {
    throw new Error(
      'Base UI: ComboboxRootContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxFloatingContext() {
  const context = React.useContext(ComboboxFloatingContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxFloatingContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxDerivedItemsContext() {
  const context = React.useContext(ComboboxDerivedItemsContext);
  if (!context) {
    throw new Error(
      'Base UI: ComboboxItemsContext is missing. Combobox parts must be placed within <Combobox.Root>.',
    );
  }
  return context;
}

export function useComboboxInputValueContext() {
  return React.useContext(ComboboxInputValueContext);
}

export function useComboboxHasItemsContext() {
  return React.useContext(ComboboxHasItemsContext);
}
