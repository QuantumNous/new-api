'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { HTMLProps } from '../types';
import { useBaseUiId } from '../useBaseUiId';
import { LabelableContext, useLabelableContext } from './LabelableContext';

/**
 * @internal
 */
export const LabelableProvider: React.FC<LabelableProvider.Props> = function LabelableProvider(
  props,
) {
  const defaultId = useBaseUiId();
  const initialControlId = props.controlId === undefined ? defaultId : props.controlId;

  const [controlId, setControlIdState] = React.useState<string | null | undefined>(
    initialControlId,
  );
  const [labelId, setLabelId] = React.useState<string | undefined>(props.labelId);
  const [messageIds, setMessageIds] = React.useState<string[]>([]);

  const registrationsRef = useRefWithInit(() => new Map<symbol, string | null>());

  const { messageIds: parentMessageIds } = useLabelableContext();

  const registerControlId = useStableCallback(
    (source: symbol, nextId: string | null | undefined) => {
      const registrations = registrationsRef.current;

      if (nextId === undefined) {
        registrations.delete(source);
        return;
      }

      registrations.set(source, nextId);

      // Only flush when registering, not when unregistering.
      // This prevents loops during rapid unmount/remount cycles (e.g. React Activity).
      // The next registration will pick up the correct state.
      setControlIdState((prev) => {
        if (registrations.size === 0) {
          return undefined;
        }

        let nextControlId: string | null | undefined;

        for (const id of registrations.values()) {
          if (prev !== undefined && id === prev) {
            return prev;
          }

          if (nextControlId === undefined) {
            nextControlId = id;
          }
        }

        return nextControlId;
      });
    },
  );

  const getDescriptionProps = React.useCallback(
    (externalProps: HTMLProps) => {
      const ids = externalProps['aria-describedby']
        ? externalProps['aria-describedby'].split(' ')
        : [];
      ids.push(...parentMessageIds, ...messageIds);

      return {
        ...externalProps,
        'aria-describedby': Array.from(new Set(ids)).join(' ') || undefined,
      };
    },
    [parentMessageIds, messageIds],
  );

  const contextValue: LabelableContext = React.useMemo(
    () => ({
      controlId,
      registerControlId,
      labelId,
      setLabelId,
      messageIds,
      setMessageIds,
      getDescriptionProps,
    }),
    [
      controlId,
      registerControlId,
      labelId,
      setLabelId,
      messageIds,
      setMessageIds,
      getDescriptionProps,
    ],
  );

  return (
    <LabelableContext.Provider value={contextValue}>{props.children}</LabelableContext.Provider>
  );
};

export interface LabelableProviderState {}

export interface LabelableProviderProps {
  controlId?: string | null | undefined;
  labelId?: string | undefined;
  children?: React.ReactNode;
}

export namespace LabelableProvider {
  export type State = LabelableProviderState;
  export type Props = LabelableProviderProps;
}
