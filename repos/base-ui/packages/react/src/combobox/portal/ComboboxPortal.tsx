'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { FloatingPortal } from '../../floating-ui-react';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import { ComboboxPortalContext } from './ComboboxPortalContext';
import { selectors } from '../store';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export const ComboboxPortal = React.forwardRef(function ComboboxPortal(
  props: ComboboxPortal.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { keepMounted = false, ...portalProps } = props;

  const store = useComboboxRootContext();

  const mounted = useStore(store, selectors.mounted);
  const forceMounted = useStore(store, selectors.forceMounted);

  const shouldRender = mounted || keepMounted || forceMounted;
  if (!shouldRender) {
    return null;
  }

  return (
    <ComboboxPortalContext.Provider value={keepMounted}>
      <FloatingPortal ref={forwardedRef} {...portalProps} />
    </ComboboxPortalContext.Provider>
  );
});

export interface ComboboxPortalState {}

export interface ComboboxPortalProps extends FloatingPortal.Props<ComboboxPortalState> {
  /**
   * Whether to keep the portal mounted in the DOM while the popup is hidden.
   * @default false
   */
  keepMounted?: boolean | undefined;
}

export namespace ComboboxPortal {
  export type State = ComboboxPortalState;
  export type Props = ComboboxPortalProps;
}
