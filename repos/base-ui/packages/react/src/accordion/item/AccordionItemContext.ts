'use client';
import * as React from 'react';
import type { AccordionItemState } from './AccordionItem';

export interface AccordionItemContext {
  open: boolean;
  state: AccordionItemState;
  setTriggerId: (id: string | undefined) => void;
  triggerId?: string | undefined;
}

export const AccordionItemContext = React.createContext<AccordionItemContext | undefined>(
  undefined,
);

export function useAccordionItemContext() {
  const context = React.useContext(AccordionItemContext);
  if (context === undefined) {
    throw new Error(
      'Base UI: AccordionItemContext is missing. Accordion parts must be placed within <Accordion.Item>.',
    );
  }
  return context;
}
