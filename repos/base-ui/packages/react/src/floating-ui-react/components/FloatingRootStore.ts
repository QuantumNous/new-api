import * as React from 'react';
import { createSelector, ReactStore } from '@base-ui/utils/store';
import type { FloatingEvents, ContextData, ReferenceType } from '../types';
import { type BaseUIChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { createEventEmitter } from '../utils/createEventEmitter';
import { type FloatingUIOpenChangeDetails } from '../../internals/types';
import { type PopupTriggerMap } from '../../utils/popups';
import { isClickLikeEvent } from '../utils';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface FloatingRootState {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  domReferenceElement: Element | null;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  positionReference: ReferenceType | null;
  /**
   * The ID of the floating element.
   */
  floatingId: string | undefined;
}

export interface FloatingRootStoreContext {
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
  readonly dataRef: React.RefObject<ContextData>;
  readonly events: FloatingEvents;
  nested: boolean;
  readonly triggerElements: PopupTriggerMap;
}

const selectors = {
  open: createSelector((state: FloatingRootState) => state.open),
  transitionStatus: createSelector((state: FloatingRootState) => state.transitionStatus),
  domReferenceElement: createSelector((state: FloatingRootState) => state.domReferenceElement),
  referenceElement: createSelector(
    (state: FloatingRootState) => state.positionReference ?? state.referenceElement,
  ),
  floatingElement: createSelector((state: FloatingRootState) => state.floatingElement),
  floatingId: createSelector((state: FloatingRootState) => state.floatingId),
};

interface FloatingRootStoreOptions {
  open: boolean;
  transitionStatus: TransitionStatus | undefined;
  referenceElement: ReferenceType | null;
  floatingElement: HTMLElement | null;
  triggerElements: PopupTriggerMap;
  floatingId: string | undefined;
  /**
   * When true, `setOpen` only forwards to `onOpenChange`.
   * The popup store owns `dispatchOpenChange(...)` in this mode.
   */
  syncOnly: boolean;
  nested: boolean;
  onOpenChange:
    | ((open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void)
    | undefined;
}

export class FloatingRootStore extends ReactStore<
  Readonly<FloatingRootState>,
  FloatingRootStoreContext,
  typeof selectors
> {
  private readonly syncOnly: boolean;

  constructor(options: FloatingRootStoreOptions) {
    const { syncOnly, nested, onOpenChange, triggerElements, ...initialState } = options;

    super(
      {
        ...initialState,
        positionReference: initialState.referenceElement,
        domReferenceElement: initialState.referenceElement as Element | null,
      },
      {
        onOpenChange,
        dataRef: { current: {} },
        events: createEventEmitter(),
        nested,
        triggerElements,
      },
      selectors,
    );

    this.syncOnly = syncOnly;
  }

  /**
   * Syncs the event used by hover logic to distinguish hover-open from click-like interaction.
   */
  syncOpenEvent = (newOpen: boolean, event: Event | undefined) => {
    if (
      !newOpen ||
      !this.state.open ||
      // Prevent a pending hover-open from overwriting a click-open event, while allowing
      // click events to upgrade a hover-open.
      (event != null && isClickLikeEvent(event))
    ) {
      this.context.dataRef.current.openEvent = newOpen ? event : undefined;
    }
  };

  /**
   * Runs the root-owned side effects for an open state change.
   */
  dispatchOpenChange = (newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    this.syncOpenEvent(newOpen, eventDetails.event);

    const details: FloatingUIOpenChangeDetails = {
      open: newOpen,
      reason: eventDetails.reason,
      nativeEvent: eventDetails.event,
      nested: this.context.nested,
      triggerElement: eventDetails.trigger,
    };

    this.context.events.emit('openchange', details);
  };

  /**
   * Emits the `openchange` event through the internal event emitter and calls the `onOpenChange` handler with the provided arguments.
   *
   * @param newOpen The new open state.
   * @param eventDetails Details about the event that triggered the open state change.
   */
  setOpen = (newOpen: boolean, eventDetails: BaseUIChangeEventDetails<string>) => {
    if (this.syncOnly) {
      this.context.onOpenChange?.(newOpen, eventDetails);
      return;
    }

    this.dispatchOpenChange(newOpen, eventDetails);

    this.context.onOpenChange?.(newOpen, eventDetails);
  };
}
