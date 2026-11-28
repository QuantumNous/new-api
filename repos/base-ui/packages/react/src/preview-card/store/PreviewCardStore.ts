import * as React from 'react';
import { createSelector, ReactStore } from '@base-ui/utils/store';
import {
  applyPopupOpenChange,
  createPopupFloatingRootContext,
  createInitialPopupStoreState,
  InlineRectCoords,
  PopupStoreContext,
  popupStoreSelectors,
  PopupStoreState,
  PopupTriggerMap,
  updateInlineRectCoords,
  usePopupStore,
} from '../../utils/popups';
import { type PreviewCardRoot } from '../root/PreviewCardRoot';
import { REASONS } from '../../internals/reasons';
import { CLOSE_DELAY } from '../utils/constants';

export type State<Payload> = PopupStoreState<Payload> & {
  instantType: 'dismiss' | 'focus' | undefined;
  hasViewport: boolean;
};

export type Context = PopupStoreContext<PreviewCardRoot.ChangeEventDetails> & {
  closeDelayRef: React.RefObject<number>;
  inlineRectCoordsRef: React.MutableRefObject<InlineRectCoords | undefined>;
};

const selectors = {
  ...popupStoreSelectors,
  instantType: createSelector((state: State<unknown>) => state.instantType),
  hasViewport: createSelector((state: State<unknown>) => state.hasViewport),
};

export class PreviewCardStore<Payload> extends ReactStore<
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
        closeDelayRef: { current: CLOSE_DELAY },
        inlineRectCoordsRef: { current: undefined },
      },
      selectors,
    );
  }

  public setOpen = (
    nextOpen: boolean,
    eventDetails: Omit<PreviewCardRoot.ChangeEventDetails, 'preventUnmountOnClose'>,
  ) => {
    const { inlineRectCoordsRef } = this.context;

    applyPopupOpenChange<State<Payload>, PreviewCardRoot.ChangeEventDetails>(
      this,
      nextOpen,
      eventDetails as PreviewCardRoot.ChangeEventDetails,
      {
        onBeforeDispatch() {
          // Capture the hovered inline-rect coordinates so the card anchors to the
          // exact point on the link that was hovered.
          const event = eventDetails.event;
          if (
            nextOpen &&
            eventDetails.reason === REASONS.triggerHover &&
            eventDetails.trigger &&
            'clientX' in event &&
            'clientY' in event &&
            inlineRectCoordsRef.current?.element !== eventDetails.trigger
          ) {
            updateInlineRectCoords(
              inlineRectCoordsRef,
              eventDetails.trigger,
              event.clientX,
              event.clientY,
            );
          }
        },
      },
    );
  };

  public static useStore<Payload>(
    externalStore: PreviewCardStore<Payload> | undefined,
    initialState?: Partial<State<Payload>>,
  ) {
    /* eslint-disable react-hooks/rules-of-hooks */
    const store = usePopupStore(
      externalStore,
      (floatingId, nested) => new PreviewCardStore<Payload>(initialState, floatingId, nested),
    ).store;
    /* eslint-enable react-hooks/rules-of-hooks */

    return store;
  }
}

function createInitialState<Payload>(): State<Payload> {
  return {
    ...createInitialPopupStoreState<Payload>(),
    instantType: undefined,
    hasViewport: false,
  };
}
