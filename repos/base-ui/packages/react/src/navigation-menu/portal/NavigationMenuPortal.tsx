'use client';
import * as React from 'react';
import { FloatingPortal } from '../../floating-ui-react';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { NavigationMenuPortalContext } from './NavigationMenuPortalContext';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuPortal = React.forwardRef(function NavigationMenuPortal(
  props: NavigationMenuPortal.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { keepMounted = false, ...portalProps } = props;

  const { mounted } = useNavigationMenuRootContext();

  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }

  return (
    <NavigationMenuPortalContext.Provider value={keepMounted}>
      <FloatingPortal ref={forwardedRef} {...portalProps} />
    </NavigationMenuPortalContext.Provider>
  );
});

export interface NavigationMenuPortalState {}

export interface NavigationMenuPortalProps extends FloatingPortal.Props<NavigationMenuPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
  /**
   * A parent element to render the portal element into.
   */
  container?: FloatingPortal.Props<NavigationMenuPortalState>['container'] | undefined;
}

export namespace NavigationMenuPortal {
  export type State = NavigationMenuPortalState;
  export type Props = NavigationMenuPortalProps;
}
