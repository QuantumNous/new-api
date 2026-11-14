'use client';
import * as React from 'react';

export interface DrawerProviderContext {
  setDrawerOpen: (drawerId: string, open: boolean) => void;
  removeDrawer: (drawerId: string) => void;
  active: boolean;
  visualStateStore: DrawerVisualStateStore;
}

export const DrawerProviderContext = React.createContext<DrawerProviderContext | undefined>(
  undefined,
);

export interface DrawerVisualState {
  swipeProgress: number;
  frontmostHeight: number;
}

export interface DrawerVisualStateStore {
  getSnapshot: () => DrawerVisualState;
  subscribe: (listener: () => void) => () => void;
  set: (state: Partial<DrawerVisualState>) => void;
}

export function useDrawerProviderContext(optional?: false): DrawerProviderContext;
export function useDrawerProviderContext(optional: true): DrawerProviderContext | undefined;
export function useDrawerProviderContext(optional?: boolean) {
  const context = React.useContext(DrawerProviderContext);

  if (optional === false && context === undefined) {
    throw new Error('Base UI: DrawerProviderContext is missing. Use <Drawer.Provider>.');
  }

  return context;
}
