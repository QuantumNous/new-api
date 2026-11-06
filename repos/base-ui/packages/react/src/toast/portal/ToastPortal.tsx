'use client';
import { FloatingPortalLite } from '../../utils/FloatingPortalLite';

/**
 * A portal element that moves the viewport to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastPortal = FloatingPortalLite;

export interface ToastPortalState {}

export interface ToastPortalProps extends FloatingPortalLite.Props<ToastPortalState> {}

export namespace ToastPortal {
  export type State = ToastPortalState;
  export type Props = ToastPortalProps;
}
