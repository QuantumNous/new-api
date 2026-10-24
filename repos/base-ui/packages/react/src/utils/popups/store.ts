import { createSelector } from '@base-ui/utils/store';
import { EMPTY_OBJECT } from '@base-ui/utils/empty';
import { FloatingRootContext } from '../../floating-ui-react';
import { FloatingRootStore } from '../../floating-ui-react/components/FloatingRootStore';
import { getEmptyRootContext } from '../../floating-ui-react/utils/getEmptyRootContext';
import { TransitionStatus } from '../../internals/useTransitionStatus';
import { PopupTriggerMap } from './popupTriggerMap';
import { HTMLProps } from '../../internals/types';

/**
 * State common to all popup stores.
 */
export type PopupStoreState<Payload> = {
  /**
   * Whether the popup is open (internal state).
   */
  open: boolean;
  /**
   * Whether the popup is open (external prop).
   */
  readonly openProp: boolean | undefined;
  /**
   * Whether the popup should be mounted in the DOM.
   * This usually follows `open` but can be different during exit transitions.
   */
  mounted: boolean;
  /**
   * The current enter/exit transition status of the popup.
   */
  transitionStatus: TransitionStatus;

  floatingRootContext: FloatingRootContext;
  floatingId: string | undefined;
  /**
   * Number of trigger elements currently registered for this popup.
   */
  triggerCount: number;
  /**
   * Whether to prevent unmounting the popup when closed.
   * Useful for interacting with JS animation libraries that control unmounting themselves.
   */
  preventUnmountingOnClose: boolean;

  /**
   * Optional payload set by the trigger.
   */
  payload: Payload | undefined;

  /**
   * ID of the currently active trigger.
   */
  activeTriggerId: string | null;
  /**
   * The currently active trigger DOM element.
   */
  activeTriggerElement: Element | null;
  /**
   * ID of the trigger (external prop).
   */
  readonly triggerIdProp: string | null | undefined;
  /**
   * The popup DOM element.
   */
  popupElement: HTMLElement | null;
  /**
   * The positioner DOM element.
   */
  positionerElement: HTMLElement | null;

  /**
   * Props to spread onto the active trigger element.
   */
  activeTriggerProps: HTMLProps;
  /**
   * Props to spread onto inactive trigger elements.
   */
  inactiveTriggerProps: HTMLProps;
  /**
   * Props to spread onto the popup element.
   */
  popupProps: HTMLProps;
};

export function createInitialPopupStoreState<Payload>(): PopupStoreState<Payload> {
  return {
    open: false,
    openProp: undefined,
    mounted: false,
    transitionStatus: undefined,
    floatingRootContext: getEmptyRootContext(),
    floatingId: undefined,
    triggerCount: 0,
    preventUnmountingOnClose: false,
    payload: undefined,
    activeTriggerId: null,
    activeTriggerElement: null,
    triggerIdProp: undefined,
    popupElement: null,
    positionerElement: null,
    activeTriggerProps: EMPTY_OBJECT as HTMLProps,
    inactiveTriggerProps: EMPTY_OBJECT as HTMLProps,
    popupProps: EMPTY_OBJECT as HTMLProps,
  };
}

export function createPopupFloatingRootContext(
  triggerElements: PopupTriggerMap,
  floatingId?: string | undefined,
  nested = false,
) {
  return new FloatingRootStore({
    open: false,
    transitionStatus: undefined,
    floatingElement: null,
    referenceElement: null,
    triggerElements,
    floatingId,
    syncOnly: true,
    nested,
    onOpenChange: undefined,
  });
}

export type PopupStoreContext<ChangeEventDetails> = {
  /**
   * Map of registered trigger elements.
   */
  readonly triggerElements: PopupTriggerMap;
  /**
   * Reference to the popup element.
   */
  readonly popupRef: React.RefObject<HTMLElement | null>;
  /**
   * Callback fired when the open state changes.
   */
  onOpenChange?: ((open: boolean, eventDetails: ChangeEventDetails) => void) | undefined;
  /**
   * Callback fired when the open state change animation completes.
   */
  onOpenChangeComplete: ((open: boolean) => void) | undefined;
};

type S = PopupStoreState<unknown>;

const activeTriggerIdSelector = createSelector(
  (state: S) => state.triggerIdProp ?? state.activeTriggerId,
);

const openSelector = createSelector((state: S) => state.openProp ?? state.open);

const popupIdSelector = createSelector((state: S) => {
  const popupId = state.popupElement?.id ?? state.floatingId;
  return popupId || undefined;
});

function triggerOwnsOpenPopup(state: S, triggerId: string | undefined) {
  return (
    triggerId !== undefined && openSelector(state) && activeTriggerIdSelector(state) === triggerId
  );
}

function triggerOwnsOpenPopupOrIsOnlyTrigger(state: S, triggerId: string | undefined) {
  if (triggerOwnsOpenPopup(state, triggerId)) {
    return true;
  }

  return (
    triggerId !== undefined &&
    openSelector(state) &&
    activeTriggerIdSelector(state) == null &&
    state.triggerCount === 1
  );
}

export const popupStoreSelectors = {
  open: openSelector,
  mounted: createSelector((state: S) => state.mounted),
  transitionStatus: createSelector((state: S) => state.transitionStatus),
  floatingRootContext: createSelector((state: S) => state.floatingRootContext),
  triggerCount: createSelector((state: S) => state.triggerCount),
  preventUnmountingOnClose: createSelector((state: S) => state.preventUnmountingOnClose),
  payload: createSelector((state: S) => state.payload),

  activeTriggerId: activeTriggerIdSelector,
  activeTriggerElement: createSelector((state: S) =>
    state.mounted ? state.activeTriggerElement : null,
  ),
  popupId: popupIdSelector,
  /**
   * Whether the trigger with the given ID was used to open the popup.
   */
  isTriggerActive: createSelector(
    (state: S, triggerId: string | undefined) =>
      triggerId !== undefined && activeTriggerIdSelector(state) === triggerId,
  ),
  /**
   * Whether the popup is open and was activated by a trigger with the given ID.
   */
  isOpenedByTrigger: createSelector((state: S, triggerId: string | undefined) =>
    triggerOwnsOpenPopup(state, triggerId),
  ),
  /**
   * Whether the popup is mounted and was activated by a trigger with the given ID.
   */
  isMountedByTrigger: createSelector(
    (state: S, triggerId: string | undefined) =>
      triggerId !== undefined && activeTriggerIdSelector(state) === triggerId && state.mounted,
  ),
  triggerProps: createSelector((state: S, isActive: boolean) =>
    isActive ? state.activeTriggerProps : state.inactiveTriggerProps,
  ),
  /**
   * Popup id for the trigger that currently owns the open popup.
   */
  triggerPopupId: createSelector((state: S, triggerId: string | undefined) =>
    triggerOwnsOpenPopupOrIsOnlyTrigger(state, triggerId) ? popupIdSelector(state) : undefined,
  ),
  popupProps: createSelector((state: S) => state.popupProps),

  popupElement: createSelector((state: S) => state.popupElement),
  positionerElement: createSelector((state: S) => state.positionerElement),
};

export type PopupStoreSelectors = typeof popupStoreSelectors;
