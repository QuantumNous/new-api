'use client';
import * as React from 'react';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { type TransitionStatus } from '../../internals/useTransitionStatus';
import { type BaseUIComponentProps } from '../../internals/types';
import { type StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { DrawerPopupCssVars } from '../popup/DrawerPopupCssVars';
import { DrawerBackdropCssVars } from './DrawerBackdropCssVars';

const stateAttributesMapping: StateAttributesMapping<DrawerBackdropState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * An overlay displayed beneath the popup.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export const DrawerBackdrop = React.forwardRef(function DrawerBackdrop(
  componentProps: DrawerBackdrop.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, forceRender = false, ...elementProps } = componentProps;

  const { store } = useDialogRootContext();

  const open = store.useState('open');
  const nested = store.useState('nested');
  const mounted = store.useState('mounted');
  const transitionStatus = store.useState('transitionStatus');

  const state: DrawerBackdropState = {
    open,
    transitionStatus,
  };

  return useRenderElement('div', componentProps, {
    state,
    ref: [store.context.backdropRef, forwardedRef],
    stateAttributesMapping,
    props: [
      {
        role: 'presentation',
        hidden: !mounted,
        style: {
          pointerEvents: !open ? 'none' : undefined,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          [DrawerBackdropCssVars.swipeProgress]: '0',
          [DrawerPopupCssVars.swipeStrength]: '1',
        } as React.CSSProperties,
      },
      elementProps,
    ],
    enabled: forceRender || !nested,
  });
});

export interface DrawerBackdropProps extends BaseUIComponentProps<'div', DrawerBackdropState> {
  /**
   * Whether the backdrop is forced to render even when nested.
   * @default false
   */
  forceRender?: boolean | undefined;
}

export interface DrawerBackdropState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export namespace DrawerBackdrop {
  export type Props = DrawerBackdropProps;
  export type State = DrawerBackdropState;
}
