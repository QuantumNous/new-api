'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import type { TransitionStatus } from '../../internals/useTransitionStatus';
import { transitionStatusMapping } from '../../internals/stateAttributesMapping';
import { useBaseUiId } from '../../internals/useBaseUiId';
import { useNavigationMenuPositionerContext } from '../positioner/NavigationMenuPositionerContext';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { Align, Side } from '../../utils/useAnchorPositioning';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';

const stateAttributesMapping: StateAttributesMapping<NavigationMenuPopupState> = {
  ...baseMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the navigation menu contents.
 * Renders a `<nav>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuPopup = React.forwardRef(function NavigationMenuPopup(
  componentProps: NavigationMenuPopup.Props,
  forwardedRef: React.ForwardedRef<HTMLElement>,
) {
  const { render, className, style, id: idProp, ...elementProps } = componentProps;

  const { open, transitionStatus, setPopupElement } = useNavigationMenuRootContext();
  const positioning = useNavigationMenuPositionerContext();
  const direction = useDirection();

  const id = useBaseUiId(idProp);

  const state: NavigationMenuPopupState = {
    open,
    transitionStatus,
    side: positioning.side,
    align: positioning.align,
    anchorHidden: positioning.anchorHidden,
  };

  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  let isPhysicalLeft = positioning.side === 'left';
  if (direction === 'rtl') {
    isPhysicalLeft = isPhysicalLeft || positioning.side === 'inline-end';
  } else {
    isPhysicalLeft = isPhysicalLeft || positioning.side === 'inline-start';
  }
  const isOriginSide = positioning.side === 'top' || isPhysicalLeft;

  const element = useRenderElement('nav', componentProps, {
    state,
    ref: [forwardedRef, setPopupElement],
    props: [
      {
        id,
        tabIndex: -1,
        style: isOriginSide
          ? {
              position: 'absolute',
              [positioning.side === 'top' ? 'bottom' : 'top']: '0',
              [isPhysicalLeft ? 'right' : 'left']: '0',
            }
          : {},
      },
      getDisabledMountTransitionStyles(transitionStatus),
      elementProps,
    ],
    stateAttributesMapping,
  });

  return element;
});

export interface NavigationMenuPopupState {
  /**
   * If `true`, the popup is open.
   */
  open: boolean;
  /**
   * The transition status of the popup.
   */
  transitionStatus: TransitionStatus;
  /**
   * The side of the anchor the popup is positioned on.
   */
  side: Side;
  /**
   * The alignment of the popup relative to the anchor.
   */
  align: Align;
  /**
   * Whether the anchor element is hidden.
   */
  anchorHidden: boolean;
}

export interface NavigationMenuPopupProps extends BaseUIComponentProps<
  'nav',
  NavigationMenuPopupState
> {}

export namespace NavigationMenuPopup {
  export type State = NavigationMenuPopupState;
  export type Props = NavigationMenuPopupProps;
}
