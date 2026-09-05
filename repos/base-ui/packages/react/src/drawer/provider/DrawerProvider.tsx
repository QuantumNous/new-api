'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import {
  DrawerProviderContext,
  type DrawerVisualState,
  type DrawerVisualStateStore,
} from './DrawerProviderContext';

/**
 * Provides a shared context for coordinating global Drawer UI, such as indent/background effects based on whether any Drawer is open.
 * Doesn't render its own HTML element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerProvider(props: DrawerProvider.Props) {
  const { children } = props;

  const [openById, setOpenById] = React.useState(() => new Map<string, boolean>());
  const [visualStateStore] = React.useState(createVisualStateStore);

  const setDrawerOpen = useStableCallback((drawerId: string, open: boolean) => {
    setOpenById((prev) => {
      const prevOpen = prev.get(drawerId);
      if (prevOpen === open) {
        return prev;
      }

      const next = new Map(prev);
      next.set(drawerId, open);
      return next;
    });
  });

  const removeDrawer = useStableCallback((drawerId: string) => {
    setOpenById((prev) => {
      if (!prev.has(drawerId)) {
        return prev;
      }

      const next = new Map(prev);
      next.delete(drawerId);
      return next;
    });
  });

  const active = React.useMemo(() => {
    for (const open of openById.values()) {
      if (open) {
        return true;
      }
    }
    return false;
  }, [openById]);

  const contextValue = React.useMemo(
    () => ({
      setDrawerOpen,
      removeDrawer,
      active,
      visualStateStore,
    }),
    [active, removeDrawer, setDrawerOpen, visualStateStore],
  );

  return (
    <DrawerProviderContext.Provider value={contextValue}>{children}</DrawerProviderContext.Provider>
  );
}

export interface DrawerProviderState {}

export interface DrawerProviderProps {
  children?: React.ReactNode;
}

export namespace DrawerProvider {
  export type State = DrawerProviderState;
  export type Props = DrawerProviderProps;
}

type VisualStateListener = () => void;

function createVisualStateStore(): DrawerVisualStateStore {
  let state: DrawerVisualState = {
    swipeProgress: 0,
    frontmostHeight: 0,
  };
  const listeners = new Set<VisualStateListener>();

  return {
    getSnapshot: () => state,
    set(nextState) {
      let nextSwipeProgress = state.swipeProgress;
      if (nextState.swipeProgress !== undefined) {
        nextSwipeProgress = Number.isFinite(nextState.swipeProgress) ? nextState.swipeProgress : 0;
      }

      let nextFrontmostHeight = state.frontmostHeight;
      if (nextState.frontmostHeight !== undefined) {
        nextFrontmostHeight = Number.isFinite(nextState.frontmostHeight)
          ? nextState.frontmostHeight
          : 0;
      }

      if (
        nextSwipeProgress === state.swipeProgress &&
        nextFrontmostHeight === state.frontmostHeight
      ) {
        return;
      }

      state = {
        swipeProgress: nextSwipeProgress,
        frontmostHeight: nextFrontmostHeight,
      };

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
