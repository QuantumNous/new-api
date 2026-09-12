'use client';
import * as React from 'react';
import type { AccordionRoot } from './AccordionRoot';

export interface AccordionRootContext<Value = any> {
  disabled: boolean;
  handleValueChange: (
    newValue: AccordionRoot.Value<Value>[number],
    nextOpen: boolean,
    eventDetails: AccordionRoot.ChangeEventDetails,
  ) => void;
  hiddenUntilFound: boolean;
  keepMounted: boolean;
  state: AccordionRoot.State<Value>;
  value: AccordionRoot.Value<Value>;
}

export const AccordionRootContext = React.createContext<AccordionRootContext<any> | undefined>(
  undefined,
);

export function useAccordionRootContext<Value = any>() {
  const context = React.useContext<AccordionRootContext<Value> | undefined>(AccordionRootContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: AccordionRootContext is missing. Accordion parts must be placed within <Accordion.Root>.',
    );
  }
  return context;
}
