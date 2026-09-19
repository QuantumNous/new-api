'use client';
import * as React from 'react';
import { DialogStore } from '../store/DialogStore';

export interface DialogRootContext<Payload = unknown> {
  store: DialogStore<Payload>;
}

export const IsDrawerContext = React.createContext(false);

export const DialogRootContext = React.createContext<DialogRootContext | undefined>(undefined);

export function useDialogRootContext(optional?: false): DialogRootContext;
export function useDialogRootContext(optional: true): DialogRootContext | undefined;
export function useDialogRootContext(optional?: boolean) {
  const dialogRootContext = React.useContext(DialogRootContext);

  if (optional === false && dialogRootContext === undefined) {
    throw new Error(
      'Base UI: DialogRootContext is missing. Dialog parts must be placed within <Dialog.Root>.',
    );
  }

  return dialogRootContext;
}
