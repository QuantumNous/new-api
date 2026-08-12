'use client';
import * as React from 'react';
import { useTooltipRootContext } from '../root/TooltipRootContext';
import { TooltipPortalContext } from './TooltipPortalContext';
import { FloatingPortalLite } from '../../utils/FloatingPortalLite';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Tooltip](https://base-ui.com/react/components/tooltip)
 */
export const TooltipPortal = React.forwardRef(function TooltipPortal(
  props: TooltipPortal.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { keepMounted = false, ...portalProps } = props;

  const store = useTooltipRootContext();
  const mounted = store.useState('mounted');

  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }

  return (
    <TooltipPortalContext.Provider value={keepMounted}>
      <FloatingPortalLite ref={forwardedRef} {...portalProps} />
    </TooltipPortalContext.Provider>
  );
});

export interface TooltipPortalState {}

export interface TooltipPortalProps extends FloatingPortalLite.Props<TooltipPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace TooltipPortal {
  export type State = TooltipPortalState;
  export type Props = TooltipPortalProps;
}
