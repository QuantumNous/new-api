'use client';
import * as React from 'react';
import type { SwipeDirection } from '../../utils/useSwipeDismiss';
import type { DrawerRootSnapPointChangeEventDetails } from './DrawerRoot';

export type DrawerSwipeDirection = SwipeDirection;
export type DrawerSnapPoint = number | string;

export interface DrawerNestedSwipeProgressStore {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}

export interface DrawerRootContext {
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether to disable velocity-based snap skipping.
   */
  snapToSequentialPoints: boolean;
  /**
   * Snap points used to size/position the drawer.
   */
  snapPoints?: DrawerSnapPoint[] | undefined;
  /**
   * The currently active snap point.
   */
  activeSnapPoint?: DrawerSnapPoint | null | undefined;
  /**
   * Updates the currently active snap point.
   */
  setActiveSnapPoint?:
    | ((
        snapPoint: DrawerSnapPoint | null,
        eventDetails?: DrawerRootSnapPointChangeEventDetails,
      ) => void)
    | undefined;
  /**
   * The measured height of the frontmost open drawer within the current nested drawer stack.
   */
  frontmostHeight: number;
  /**
   * The measured height of the drawer popup element.
   */
  popupHeight: number;
  /**
   * Whether the current drawer has a nested drawer mounted in its stack (including while it is
   * transitioning out).
   */
  hasNestedDrawer: boolean;
  /**
   * Called by the drawer popup to report its own measured height.
   */
  onPopupHeightChange: (height: number) => void;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedSwiping: boolean;
  /**
   * Provides nested swipe progress without re-rendering the drawer tree.
   */
  nestedSwipeProgressStore: DrawerNestedSwipeProgressStore;
  /**
   * Called by a nested drawer to report whether it is still present (open or transitioning out).
   */
  onNestedDrawerPresenceChange: (present: boolean) => void;
  /**
   * Called by a nested drawer to report the frontmost height of its own stack.
   */
  onNestedFrontmostHeightChange: (height: number) => void;
  /**
   * Called by a nested drawer to report whether it's being swiped.
   */
  onNestedSwipingChange: (swiping: boolean) => void;
  /**
   * Called by a nested drawer to report its swipe progress.
   */
  onNestedSwipeProgressChange: (progress: number) => void;
  /**
   * Provided to nested drawers so they can report their frontmost height to the parent drawer.
   */
  notifyParentFrontmostHeight?: ((height: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swiping to the parent drawer.
   */
  notifyParentSwipingChange?: ((swiping: boolean) => void) | undefined;
  /**
   * Provided to nested drawers so they can report swipe progress to the parent drawer.
   */
  notifyParentSwipeProgressChange?: ((progress: number) => void) | undefined;
  /**
   * Provided to nested drawers so they can report whether they are still present (open or
   * transitioning out) to the parent drawer.
   */
  notifyParentHasNestedDrawer?: ((present: boolean) => void) | undefined;
}

export const DrawerRootContext = React.createContext<DrawerRootContext | undefined>(undefined);

export function useDrawerRootContext(optional?: false): DrawerRootContext;
export function useDrawerRootContext(optional: true): DrawerRootContext | undefined;
export function useDrawerRootContext(optional?: boolean) {
  const drawerRootContext = React.useContext(DrawerRootContext);

  if (optional === false && drawerRootContext === undefined) {
    throw new Error(
      'Base UI: DrawerRootContext is missing. Drawer parts must be placed within <Drawer.Root>.',
    );
  }

  return drawerRootContext;
}
