'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { triggerOpenStateMapping } from '../../utils/popupStateMapping';
import { useNavigationMenuItemContext } from '../item/NavigationMenuItemContext';

/**
 * An icon that indicates that the trigger button opens a menu.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuIcon = React.forwardRef(function NavigationMenuIcon(
  componentProps: NavigationMenuIcon.Props,
  forwardedRef: React.ForwardedRef<HTMLSpanElement>,
) {
  const { render, className, style, ...elementProps } = componentProps;

  const { value: itemValue } = useNavigationMenuItemContext();
  const { open, value } = useNavigationMenuRootContext();

  const isActiveItem = open && value === itemValue;

  const state: NavigationMenuIconState = {
    open: isActiveItem,
  };

  const element = useRenderElement('span', componentProps, {
    state,
    ref: forwardedRef,
    props: [{ 'aria-hidden': true, children: '▼' }, elementProps],
    stateAttributesMapping: triggerOpenStateMapping,
  });

  return element;
});

export interface NavigationMenuIconState {
  /**
   * Whether the navigation menu is open and the item is active.
   */
  open: boolean;
}

export interface NavigationMenuIconProps extends BaseUIComponentProps<
  'span',
  NavigationMenuIconState
> {}

export namespace NavigationMenuIcon {
  export type State = NavigationMenuIconState;
  export type Props = NavigationMenuIconProps;
}
