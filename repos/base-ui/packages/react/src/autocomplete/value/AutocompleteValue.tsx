'use client';
import * as React from 'react';
import { useComboboxInputValueContext } from '../../combobox/root/ComboboxRootContext';

/**
 * The current value of the autocomplete.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Autocomplete](https://base-ui.com/react/components/autocomplete)
 */
export function AutocompleteValue(props: AutocompleteValue.Props): React.ReactElement {
  const { children } = props;

  const inputValue = useComboboxInputValueContext();

  let returnValue = null;
  if (typeof children === 'function') {
    returnValue = children(String(inputValue));
  } else if (children != null) {
    returnValue = children;
  } else {
    returnValue = inputValue;
  }

  return <React.Fragment>{returnValue}</React.Fragment>;
}

export interface AutocompleteValueState {}

export interface AutocompleteValueProps {
  children?: React.ReactNode | ((value: string) => React.ReactNode);
}

export namespace AutocompleteValue {
  export type State = AutocompleteValueState;
  export type Props = AutocompleteValueProps;
}
