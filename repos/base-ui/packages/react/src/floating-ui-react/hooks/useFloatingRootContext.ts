'use client';
import { isElement } from '@floating-ui/utils/dom';
import { useId } from '@base-ui/utils/useId';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { PopupTriggerMap } from '../../utils/popups';
import type { BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useFloatingParentNodeId } from '../components/FloatingTree';
import { FloatingRootStore, type FloatingRootState } from '../components/FloatingRootStore';
import type { ReferenceType } from '../types';

export interface UseFloatingRootContextOptions {
  open?: boolean | undefined;
  onOpenChange?(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
  elements?:
    | {
        reference?: ReferenceType | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
}

export function useFloatingRootContext(options: UseFloatingRootContextOptions): FloatingRootStore {
  const { open = false, onOpenChange, elements = {} } = options;

  const floatingId = useId();
  const nested = useFloatingParentNodeId() != null;

  if (process.env.NODE_ENV !== 'production') {
    const optionDomReference = elements.reference;
    if (optionDomReference && !isElement(optionDomReference)) {
      console.error(
        'Cannot pass a virtual element to the `elements.reference` option,',
        'as it must be a real DOM element. Use `context.setPositionReference()`',
        'instead.',
      );
    }
  }

  const store = useRefWithInit(
    () =>
      new FloatingRootStore({
        open,
        transitionStatus: undefined,
        onOpenChange,
        referenceElement: elements.reference ?? null,
        floatingElement: elements.floating ?? null,
        triggerElements: new PopupTriggerMap(),
        floatingId,
        syncOnly: false,
        nested,
      }),
  ).current;

  useIsoLayoutEffect(() => {
    const valuesToSync: Writeable<Partial<FloatingRootState>> = {
      open,
      floatingId,
    };

    // Only sync elements that are defined to avoid overwriting existing ones
    if (elements.reference !== undefined) {
      valuesToSync.referenceElement = elements.reference;
      valuesToSync.domReferenceElement = isElement(elements.reference) ? elements.reference : null;
    }

    if (elements.floating !== undefined) {
      valuesToSync.floatingElement = elements.floating;
    }

    store.update(valuesToSync);
  }, [open, floatingId, elements.reference, elements.floating, store]);

  store.context.onOpenChange = onOpenChange;
  store.context.nested = nested;

  return store;
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
