'use client';
import * as React from 'react';
import { usePreviewCardRootContext } from '../root/PreviewCardContext';
import { PreviewCardPortalContext } from './PreviewCardPortalContext';
import { FloatingPortalLite } from '../../utils/FloatingPortalLite';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Preview Card](https://base-ui.com/react/components/preview-card)
 */
export const PreviewCardPortal = React.forwardRef(function PreviewCardPortal(
  props: PreviewCardPortal.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { keepMounted = false, ...portalProps } = props;

  const store = usePreviewCardRootContext();
  const mounted = store.useState('mounted');

  const shouldRender = mounted || keepMounted;
  if (!shouldRender) {
    return null;
  }

  return (
    <PreviewCardPortalContext.Provider value={keepMounted}>
      <FloatingPortalLite ref={forwardedRef} {...portalProps} />
    </PreviewCardPortalContext.Provider>
  );
});

export interface PreviewCardPortalState {}

export interface PreviewCardPortalProps extends FloatingPortalLite.Props<PreviewCardPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace PreviewCardPortal {
  export type State = PreviewCardPortalState;
  export type Props = PreviewCardPortalProps;
}
