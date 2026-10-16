import * as React from 'react';
import { createSelector, ReactStore } from '@base-ui/utils/store';
import { type TooltipRoot } from '../root/TooltipRoot';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import {
  applyPopupOpenChange,
  createPopupFloatingRootContext,
  createInitialPopupStoreState,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  usePopupStore,
} from '../../utils/popups';

export type State<Payload> = PopupStoreState<Payload> & {
  disabled: boolean;
  instantType: 'delay' | 'dismiss' | 'focus' | undefined;
  isInstantPhase: boolean;
  trackCursorAxis: 'none' | 'x' | 'y' | 'both';
  disableHoverablePopup: boolean;
  openChangeReason: TooltipRoot.ChangeEventReason | null;
  closeOnClick: boolean;
  closeDelay: number;
  hasViewport: boolean;
};

export type Context = PopupStoreContext<TooltipRoot.ChangeEventDetails> & {
  readonly popupRef: React.RefObject<HTMLElement | null>;
};

const selectors = {
  ...popupStoreSelectors,
  disabled: createSelector((state: State<unknown>) => state.disabled),
  instantType: createSelector((state: State<unknown>) => state.instantType),
  isInstantPhase: createSelector((state: State<unknown>) => state.isInstantPhase),
  trackCursorAxis: createSelector((state: State<unknown>) => state.trackCursorAxis),
  disableHoverablePopup: createSelector((state: State<unknown>) => state.disableHoverablePopup),
  lastOpenChangeReason: createSelector((state: State<unknown>) => state.openChangeReason),
  closeOnClick: createSelector((state: State<unknown>) => state.closeOnClick),
  closeDelay: createSelector((state: State<unknown>) => state.closeDelay),
  hasViewport: createSelector((state: State<unknown>) => state.hasViewport),
};

export class TooltipStore<Payload> extends ReactStore<
  Readonly<State<Payload>>,
  Context,
  typeof selectors
> {
  constructor(
    initialState?: Partial<State<Payload>>,
    floatingId?: string | undefined,
    nested = false,
  ) {
    const triggerElements = new PopupTriggerMap();
    const state = { ...createInitialState<Payload>(), ...initialState };

    state.floatingRootContext = createPopupFloatingRootContext(triggerElements, floatingId, nested);

    super(
      state,
      {
        popupRef: React.createRef<HTMLElement | null>(),
        onOpenChange: undefined,
        onOpenChangeComplete: undefined,
        triggerElements,
      },
      selectors,
    );
  }

  setOpen = (
    nextOpen: boolean,
    eventDetails: Omit<TooltipRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    applyPopupOpenChange<State<Payload>, TooltipRoot.ChangeEventDetails>(
      this,
      nextOpen,
      eventDetails as TooltipRoot.ChangeEventDetails,
      { extraState: { openChangeReason: eventDetails.reason } },
    );
  };

  // Used by trigger clicks to clear a delayed hover open without reporting a public open-state change.
  cancelPendingOpen(event: MouseEvent | PointerEvent) {
    this.state.floatingRootContext.dispatchOpenChange(
      false,
      createChangeEventDetails(REASONS.triggerPress, event),
    );
  }

  static useStore<Payload>(
    externalStore: TooltipStore<Payload> | undefined,
    initialState?: Partial<State<Payload>>,
  ) {
    /* eslint-disable react-hooks/rules-of-hooks */
    const store = usePopupStore(
      externalStore,
      (floatingId, nested) => new TooltipStore<Payload>(initialState, floatingId, nested),
    ).store;
    /* eslint-enable react-hooks/rules-of-hooks */

    return store;
  }
}

function createInitialState<Payload>(): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(),
    disabled: false,
    instantType: undefined,
    isInstantPhase: false,
    trackCursorAxis: 'none',
    disableHoverablePopup: false,
    openChangeReason: null,
    closeOnClick: true,
    closeDelay: 0,
    hasViewport: false,
  };
}
