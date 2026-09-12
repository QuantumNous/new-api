'use client';
import * as React from 'react';
import { useStore } from '@base-ui/utils/store';
import { FloatingPortal } from '../../floating-ui-react';
import { SelectPortalContext } from './SelectPortalContext';
import { useSelectRootContext } from '../root/SelectRootContext';
import { selectors } from '../store';

/**
 * A portal element that moves the popup to a different part of the DOM.
 * By default, the portal element is appended to `<body>`.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export const SelectPortal = React.forwardRef(function SelectPortal(
  portalProps: SelectPortal.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { store } = useSelectRootContext();
  const mounted = useStore(store, selectors.mounted);
  const forceMount = useStore(store, selectors.forceMount);

  const shouldRender = mounted || forceMount;
  if (!shouldRender) {
    return null;
  }

  return (
    <SelectPortalContext.Provider value>
      <FloatingPortal ref={forwardedRef} {...portalProps} />
    </SelectPortalContext.Provider>
  );
});

export interface SelectPortalState {}

export interface SelectPortalProps extends FloatingPortal.Props<SelectPortalState> {}

export namespace SelectPortal {
  export type State = SelectPortalState;
  export type Props = SelectPortalProps;
}
