'use client';
import * as React from 'react';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { useControlled } from '@base-ui/utils/useControlled';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { ownerWindow } from '@base-ui/utils/owner';
import { platform } from '@base-ui/utils/platform';
import { useId } from '@base-ui/utils/useId';
import {
  DrawerRootContext,
  type DrawerNestedSwipeProgressStore,
  type DrawerSwipeDirection,
  useDrawerRootContext,
  type DrawerSnapPoint,
} from './DrawerRootContext';
import { Dialog } from '../../dialog';
import {
  createChangeEventDetails,
  type BaseUIChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { IsDrawerContext, useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useDrawerProviderContext } from '../provider/DrawerProviderContext';
import type { DialogHandle } from '../../dialog/store/DialogHandle';
import type { PayloadChildRenderFunction } from '../../utils/popups';

/**
 * Groups all parts of the drawer.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerRoot<Payload = unknown>(props: DrawerRoot.Props<Payload>) {
  const {
    children,
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    onOpenChangeComplete,
    disablePointerDismissal = false,
    modal = true,
    actionsRef,
    handle,
    triggerId: triggerIdProp,
    defaultTriggerId: defaultTriggerIdProp = null,
    swipeDirection = 'down',
    snapToSequentialPoints = false,
    snapPoints,
    snapPoint: snapPointProp,
    defaultSnapPoint,
    onSnapPointChange,
  } = props;

  const parentDrawerRootContext = useDrawerRootContext(true);

  const notifyParentSwipeProgressChange = parentDrawerRootContext?.onNestedSwipeProgressChange;
  const notifyParentFrontmostHeight = parentDrawerRootContext?.onNestedFrontmostHeightChange;
  const notifyParentSwipingChange = parentDrawerRootContext?.onNestedSwipingChange;
  const notifyParentHasNestedDrawer = parentDrawerRootContext?.onNestedDrawerPresenceChange;

  const [popupHeight, setPopupHeight] = React.useState(0);
  const [frontmostHeight, setFrontmostHeight] = React.useState(0);
  const [hasNestedDrawer, setHasNestedDrawer] = React.useState(false);
  const [nestedSwiping, setNestedSwiping] = React.useState(false);
  const [nestedSwipeProgressStore] = React.useState(createNestedSwipeProgressStore);

  const resolvedDefaultSnapPoint =
    defaultSnapPoint !== undefined ? defaultSnapPoint : (snapPoints?.[0] ?? null);
  const isSnapPointControlled = snapPointProp !== undefined;

  const [activeSnapPoint, setActiveSnapPointUnwrapped] = useControlled({
    controlled: snapPointProp,
    default: resolvedDefaultSnapPoint,
    name: 'Drawer',
    state: 'snapPoint',
  });

  const isNestedDrawerOpenRef = React.useRef(false);

  const setActiveSnapPoint = useStableCallback(
    (
      nextSnapPoint: DrawerSnapPoint | null,
      eventDetails?: DrawerRoot.SnapPointChangeEventDetails,
    ) => {
      const resolvedEventDetails = eventDetails ?? createChangeEventDetails(REASONS.none);

      onSnapPointChange?.(nextSnapPoint, resolvedEventDetails);

      if (resolvedEventDetails.isCanceled) {
        return;
      }

      setActiveSnapPointUnwrapped(nextSnapPoint);
    },
  );

  const resolvedActiveSnapPoint = React.useMemo(() => {
    if (isSnapPointControlled) {
      return activeSnapPoint;
    }

    if (!snapPoints || snapPoints.length === 0) {
      return activeSnapPoint;
    }

    if (
      activeSnapPoint === null ||
      !snapPoints.some((snapPoint) => Object.is(snapPoint, activeSnapPoint))
    ) {
      return resolvedDefaultSnapPoint;
    }

    return activeSnapPoint;
  }, [activeSnapPoint, isSnapPointControlled, resolvedDefaultSnapPoint, snapPoints]);

  const onPopupHeightChange = useStableCallback((height: number) => {
    setPopupHeight(height);

    if (!isNestedDrawerOpenRef.current && height > 0) {
      setFrontmostHeight(height);
    }
  });

  const onNestedFrontmostHeightChange = useStableCallback((height: number) => {
    if (height > 0) {
      isNestedDrawerOpenRef.current = true;
      setFrontmostHeight(height);
      return;
    }

    isNestedDrawerOpenRef.current = false;
    if (popupHeight > 0) {
      setFrontmostHeight(popupHeight);
    }
  });

  const onNestedDrawerPresenceChange = useStableCallback((present: boolean) => {
    setHasNestedDrawer(present);
  });

  const onNestedSwipeProgressChange = useStableCallback((progress: number) => {
    nestedSwipeProgressStore.set(progress);
    notifyParentSwipeProgressChange?.(progress);
  });

  const onNestedSwipingChange = useStableCallback((swiping: boolean) => {
    setNestedSwiping(swiping);
    notifyParentSwipingChange?.(swiping);
  });

  const handleOpenChange = useStableCallback(
    (nextOpen: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => {
      onOpenChange?.(nextOpen, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      if (!nextOpen && snapPoints && snapPoints.length > 0) {
        setActiveSnapPoint(
          resolvedDefaultSnapPoint,
          createChangeEventDetails(
            eventDetails.reason,
            eventDetails.event,
            eventDetails.trigger as HTMLElement | undefined,
          ),
        );
      }
    },
  );

  const contextValue: DrawerRootContext = React.useMemo(
    () => ({
      swipeDirection,
      snapToSequentialPoints,
      snapPoints,
      activeSnapPoint: resolvedActiveSnapPoint,
      setActiveSnapPoint,
      frontmostHeight,
      popupHeight,
      hasNestedDrawer,
      nestedSwiping,
      nestedSwipeProgressStore,
      onNestedDrawerPresenceChange,
      onPopupHeightChange,
      onNestedFrontmostHeightChange,
      onNestedSwipingChange,
      onNestedSwipeProgressChange,
      notifyParentFrontmostHeight,
      notifyParentSwipingChange,
      notifyParentSwipeProgressChange,
      notifyParentHasNestedDrawer,
    }),
    [
      resolvedActiveSnapPoint,
      frontmostHeight,
      hasNestedDrawer,
      nestedSwiping,
      nestedSwipeProgressStore,
      notifyParentHasNestedDrawer,
      notifyParentSwipeProgressChange,
      notifyParentSwipingChange,
      notifyParentFrontmostHeight,
      onNestedDrawerPresenceChange,
      onNestedFrontmostHeightChange,
      onNestedSwipeProgressChange,
      onNestedSwipingChange,
      onPopupHeightChange,
      popupHeight,
      setActiveSnapPoint,
      snapPoints,
      snapToSequentialPoints,
      swipeDirection,
    ],
  );

  const resolvedChildren: React.ReactNode | PayloadChildRenderFunction<Payload> =
    typeof children === 'function' ? (
      (payload) => (
        <React.Fragment>
          <DrawerProviderReporter />
          {children(payload)}
        </React.Fragment>
      )
    ) : (
      <React.Fragment>
        <DrawerProviderReporter />
        {children}
      </React.Fragment>
    );

  return (
    <DrawerRootContext.Provider value={contextValue}>
      <IsDrawerContext.Provider value>
        <Dialog.Root
          open={openProp}
          defaultOpen={defaultOpen}
          onOpenChange={handleOpenChange}
          onOpenChangeComplete={onOpenChangeComplete}
          disablePointerDismissal={disablePointerDismissal}
          modal={modal}
          actionsRef={actionsRef}
          handle={handle}
          triggerId={triggerIdProp}
          defaultTriggerId={defaultTriggerIdProp}
        >
          {resolvedChildren}
        </Dialog.Root>
      </IsDrawerContext.Provider>
    </DrawerRootContext.Provider>
  );
}

export interface DrawerRootState {}

export interface DrawerRootProps<Payload = unknown> {
  /**
   * Whether the drawer is currently open.
   */
  open?: boolean | undefined;
  /**
   * Whether the drawer is initially open.
   *
   * To render a controlled drawer, use the `open` prop instead.
   * @default false
   */
  defaultOpen?: boolean | undefined;
  /**
   * Determines if the drawer enters a modal state when open.
   * - `true`: user interaction is limited to just the drawer: focus is trapped, document page scroll is locked, and pointer interactions on outside elements are disabled.
   * - `false`: user interaction with the rest of the document is allowed.
   * - `'trap-focus'`: focus is trapped inside the drawer, but document page scroll is not locked and pointer interactions outside of it remain enabled.
   * @default true
   */
  modal?: boolean | 'trap-focus' | undefined;
  /**
   * Event handler called when the drawer is opened or closed.
   */
  onOpenChange?: ((open: boolean, eventDetails: DrawerRoot.ChangeEventDetails) => void) | undefined;
  /**
   * Event handler called after any animations complete when the drawer is opened or closed.
   */
  onOpenChangeComplete?: ((open: boolean) => void) | undefined;
  /**
   * Whether to prevent the drawer from closing on outside presses.
   * For non-modal drawers, this also prevents the drawer from closing when focus moves outside of it.
   * @default false
   */
  disablePointerDismissal?: boolean | undefined;
  /**
   * A ref to imperative actions.
   * - `unmount`: Manually unmounts the drawer.
   * Call this after any externally controlled closing animation finishes.
   * - `close`: Closes the drawer imperatively when called.
   */
  actionsRef?: React.RefObject<DrawerRoot.Actions | null> | undefined;
  /**
   * A handle to associate the drawer with a trigger.
   * If specified, allows detached triggers to control the drawer's open state.
   * Can be created with the Drawer.createHandle() method.
   */
  handle?: DialogHandle<Payload> | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `open` prop to create a controlled drawer.
   * There's no need to specify this prop when the drawer is uncontrolled (that is, when the `open` prop is not set).
   */
  triggerId?: string | null | undefined;
  /**
   * ID of the trigger that the drawer is associated with.
   * This is useful in conjunction with the `defaultOpen` prop to create an initially open drawer.
   */
  defaultTriggerId?: string | null | undefined;
  /**
   * The content of the drawer.
   */
  children?: React.ReactNode | PayloadChildRenderFunction<Payload>;
  /**
   * The swipe direction used to dismiss the drawer.
   * @default 'down'
   */
  swipeDirection?: DrawerSwipeDirection | undefined;
  /**
   * Snap points used to position the drawer.
   * Use numbers between 0 and 1 to represent fractions of the viewport height,
   * numbers greater than 1 as pixel values, or strings in `px`/`rem` units
   * (for example, `'148px'` or `'30rem'`).
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * Disables velocity-based snap skipping so drag distance determines the next snap point.
   * @default false
   */
  snapToSequentialPoints?: boolean | undefined;
  /**
   * The currently active snap point. Use with `onSnapPointChange` to control the snap point.
   */
  snapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * The initial snap point value when uncontrolled.
   */
  defaultSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * Callback fired when the snap point changes.
   */
  onSnapPointChange?:
    | ((
        snapPoint: DrawerSnapPoint | null,
        eventDetails: DrawerRoot.SnapPointChangeEventDetails,
      ) => void)
    | undefined;
}

export interface DrawerRootActions {
  unmount: () => void;
  close: () => void;
}

export type DrawerRootChangeEventReason =
  | typeof REASONS.triggerPress
  | typeof REASONS.outsidePress
  | typeof REASONS.escapeKey
  | typeof REASONS.closeWatcher
  | typeof REASONS.closePress
  | typeof REASONS.focusOut
  | typeof REASONS.imperativeAction
  | typeof REASONS.swipe
  | typeof REASONS.none;

export type DrawerRootChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRoot.ChangeEventReason> & {
    preventUnmountOnClose(): void;
  };

export type DrawerRootSnapPointChangeEventReason = DrawerRootChangeEventReason;

export type DrawerRootSnapPointChangeEventDetails =
  BaseUIChangeEventDetails<DrawerRootSnapPointChangeEventReason>;

export namespace DrawerRoot {
  export type State = DrawerRootState;
  export type Props<Payload = unknown> = DrawerRootProps<Payload>;
  export type Actions = DrawerRootActions;
  export type ChangeEventReason = DrawerRootChangeEventReason;
  export type ChangeEventDetails = DrawerRootChangeEventDetails;
  export type SnapPointChangeEventReason = DrawerRootSnapPointChangeEventReason;
  export type SnapPointChangeEventDetails = DrawerRootSnapPointChangeEventDetails;
  export type SnapPoint = DrawerSnapPoint;
}

interface NestedSwipeProgressStore extends DrawerNestedSwipeProgressStore {
  set: (progress: number) => void;
}

function createNestedSwipeProgressStore(): NestedSwipeProgressStore {
  let progress = 0;
  const listeners = new Set<() => void>();

  return {
    getSnapshot: () => progress,
    set(nextProgress) {
      const resolved = Number.isFinite(nextProgress) ? nextProgress : 0;
      if (resolved === progress) {
        return;
      }

      progress = resolved;
      listeners.forEach((listener) => {
        listener();
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

function DrawerProviderReporter() {
  const drawerId = useId();

  const providerContext = useDrawerProviderContext(true);
  const { store } = useDialogRootContext(false);

  const open = store.useState('open');
  const nestedOpenDialogCount = store.useState('nestedOpenDialogCount');
  const popupElement = store.useState('popupElement');

  const isTopmost = nestedOpenDialogCount === 0;

  React.useEffect(() => {
    if (!providerContext || drawerId == null) {
      return undefined;
    }

    return () => {
      providerContext.removeDrawer(drawerId);
    };
  }, [drawerId, providerContext]);

  React.useEffect(() => {
    if (drawerId == null) {
      return;
    }

    providerContext?.setDrawerOpen(drawerId, open);
  }, [drawerId, open, providerContext]);

  React.useEffect(() => {
    // CloseWatcher enables the Android back gesture (Chromium-only).
    // Keep this Android-only for now to avoid interfering with Escape/nesting semantics on desktop due to `useDismiss`.
    if (!open || !isTopmost || !platform.os.android) {
      return undefined;
    }

    const win = ownerWindow(popupElement);

    const CloseWatcherCtor = (win as Window & { CloseWatcher?: (new () => any) | undefined })
      .CloseWatcher;
    if (!CloseWatcherCtor) {
      return undefined;
    }

    function handleCloseWatcher(event: Event) {
      if (!store.select('open')) {
        return;
      }
      store.setOpen(false, createChangeEventDetails(REASONS.closeWatcher, event));
    }

    const closeWatcher = new CloseWatcherCtor();
    const unsubscribe = addEventListener(closeWatcher, 'close', handleCloseWatcher);

    return () => {
      unsubscribe();
      closeWatcher.destroy();
    };
  }, [store, isTopmost, open, popupElement]);

  return null;
}
