'use client';
import * as React from 'react';
import type { FloatingRootContext } from '../../floating-ui-react';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import type { NavigationMenuRoot } from './NavigationMenuRoot';

export type NavigationMenuPopupAutoSizeResetState = {
  abortController: AbortController | null;
  owner: any;
};

export interface NavigationMenuRootContext<Value = any> {
  open: boolean;
  value: NavigationMenuRoot.Value<Value>;
  setValue: (
    value: NavigationMenuRoot.Value<Value>,
    eventDetails: NavigationMenuRoot.ChangeEventDetails,
  ) => void;
  transitionStatus: TransitionStatus;
  mounted: boolean;
  popupElement: HTMLElement | null;
  setPopupElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  positionerElement: HTMLElement | null;
  setPositionerElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  viewportElement: HTMLElement | null;
  setViewportElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  viewportTargetElement: HTMLElement | null;
  setViewportTargetElement: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
  activationDirection: 'left' | 'right' | 'up' | 'down' | null;
  setActivationDirection: React.Dispatch<
    React.SetStateAction<'left' | 'right' | 'up' | 'down' | null>
  >;
  floatingRootContext: FloatingRootContext | undefined;
  setFloatingRootContext: React.Dispatch<React.SetStateAction<FloatingRootContext | undefined>>;
  currentContentRef: React.RefObject<HTMLDivElement | null>;
  nested: boolean;
  rootRef: React.RefObject<HTMLDivElement | null>;
  beforeInsideRef: React.RefObject<HTMLSpanElement | null>;
  afterInsideRef: React.RefObject<HTMLSpanElement | null>;
  beforeOutsideRef: React.RefObject<HTMLSpanElement | null>;
  afterOutsideRef: React.RefObject<HTMLSpanElement | null>;
  prevTriggerElementRef: React.RefObject<Element | null | undefined>;
  popupAutoSizeResetRef: React.MutableRefObject<NavigationMenuPopupAutoSizeResetState>;
  delay: number;
  closeDelay: number;
  orientation: 'horizontal' | 'vertical';
  viewportInert: boolean;
  setViewportInert: React.Dispatch<React.SetStateAction<boolean>>;
}

export const NavigationMenuRootContext = React.createContext<
  NavigationMenuRootContext<any> | undefined
>(undefined);

if (process.env.NODE_ENV !== 'production') {
  NavigationMenuRootContext.displayName = 'NavigationMenuRootContext';
}

function useNavigationMenuRootContext<Value = any>(
  optional?: false,
): NavigationMenuRootContext<Value>;
function useNavigationMenuRootContext<Value = any>(
  optional: true,
): NavigationMenuRootContext<Value> | undefined;
function useNavigationMenuRootContext<Value = any>(optional?: boolean) {
  const context = React.useContext<NavigationMenuRootContext<Value> | undefined>(
    NavigationMenuRootContext,
  );
  if (context === undefined && !optional) {
    throw new Error(
      'Base UI: NavigationMenuRootContext is missing. Navigation Menu parts must be placed within <NavigationMenu.Root>.',
    );
  }
  return context;
}

export const NavigationMenuTreeContext = React.createContext<string | undefined>(undefined);

function useNavigationMenuTreeContext() {
  return React.useContext(NavigationMenuTreeContext);
}

export { useNavigationMenuRootContext, useNavigationMenuTreeContext };
