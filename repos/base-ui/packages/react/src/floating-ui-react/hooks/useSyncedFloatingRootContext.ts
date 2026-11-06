'use client';
import * as React from 'react';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { ReactStore } from '@base-ui/utils/store';
import { isElement } from '@floating-ui/utils/dom';
import { BaseUIChangeEventDetails } from '../../types';
import { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from '../../utils/popups';
import { FloatingRootState, FloatingRootStore } from '../components/FloatingRootStore';

export interface UseSyncedFloatingRootContextOptions<
  State extends PopupStoreState<unknown>,
  ContextEventDetails extends BaseUIChangeEventDetails<string>,
  OpenChangeEventDetails extends BaseUIChangeEventDetails<string>,
> {
  popupStore: ReactStore<State, PopupStoreContext<ContextEventDetails>, PopupStoreSelectors>;
  /**
   * Whether the Popup element is passed to Floating UI as the floating element instead of the default Positioner.
   */
  treatPopupAsFloatingElement?: boolean | undefined;
  floatingRootContext?: FloatingRootStore | undefined;
  floatingId: string | undefined;
  nested: boolean;
  onOpenChange(open: boolean, eventDetails: OpenChangeEventDetails): void;
}

/**
 * Keeps a FloatingRootStore in sync with the provided PopupStore.
 * Uses the provided FloatingRootStore when one exists, otherwise creates one once and updates it on every render.
 */
export function useSyncedFloatingRootContext<
  State extends PopupStoreState<unknown>,
  ContextEventDetails extends BaseUIChangeEventDetails<string>,
  OpenChangeEventDetails extends BaseUIChangeEventDetails<string>,
>(
  options: UseSyncedFloatingRootContextOptions<State, ContextEventDetails, OpenChangeEventDetails>,
): FloatingRootStore {
  const {
    popupStore,
    treatPopupAsFloatingElement = false,
    floatingRootContext: floatingRootContextProp,
    floatingId,
    nested,
    onOpenChange,
  } = options;

  const open = popupStore.useState('open');
  const referenceElement = popupStore.useState('activeTriggerElement');
  const floatingElement = popupStore.useState(
    treatPopupAsFloatingElement ? 'popupElement' : 'positionerElement',
  );
  const triggerElements = popupStore.context.triggerElements;

  const handleOpenChange = onOpenChange as (
    open: boolean,
    eventDetails: BaseUIChangeEventDetails<string>,
  ) => void;

  const internalStoreRef = React.useRef<FloatingRootStore | null>(null);
  if (floatingRootContextProp === undefined && internalStoreRef.current === null) {
    internalStoreRef.current = new FloatingRootStore({
      open,
      transitionStatus: undefined,
      referenceElement,
      floatingElement,
      triggerElements,
      onOpenChange: handleOpenChange,
      floatingId,
      syncOnly: true,
      nested,
    });
  }

  const store = floatingRootContextProp ?? internalStoreRef.current!;

  popupStore.useSyncedValue('floatingId', floatingId as State['floatingId']);

  useIsoLayoutEffect(() => {
    const valuesToSync: Partial<FloatingRootState> = {
      open,
      floatingId,
      referenceElement,
      floatingElement,
    };

    if (isElement(referenceElement)) {
      valuesToSync.domReferenceElement = referenceElement;
    }

    if (store.state.positionReference === store.state.referenceElement) {
      valuesToSync.positionReference = referenceElement;
    }

    store.update(valuesToSync);
  }, [open, floatingId, referenceElement, floatingElement, store]);

  // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
  store.context.onOpenChange = handleOpenChange;
  store.context.nested = nested;

  return store;
}
