'use client';
import * as React from 'react';
import { NOOP } from '../noop';
import { HTMLProps } from '../types';

export interface LabelableContext {
  /**
   * The `id` of the labelable element.
   * When `null` the association is implicit.
   */
  controlId: string | null | undefined;
  registerControlId: (source: symbol, id: string | null | undefined) => void;
  /**
   * The `id` of the label.
   */
  labelId: string | undefined;
  setLabelId: React.Dispatch<React.SetStateAction<string | undefined>>;
  /**
   * An array of `id`s of elements that provide an accessible description.
   */
  messageIds: string[];
  setMessageIds: React.Dispatch<React.SetStateAction<string[]>>;
  getDescriptionProps: (externalProps: HTMLProps) => HTMLProps;
}

/**
 * A context for providing [labelable elements](https://html.spec.whatwg.org/multipage/forms.html#category-label)\
 * with an accessible name (label) and description.
 */
export const LabelableContext = React.createContext<LabelableContext>({
  controlId: undefined,
  registerControlId: NOOP,
  labelId: undefined,
  setLabelId: NOOP,
  messageIds: [],
  setMessageIds: NOOP,
  getDescriptionProps: (externalProps: HTMLProps) => externalProps,
});

export function useLabelableContext() {
  return React.useContext(LabelableContext);
}
