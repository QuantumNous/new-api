'use client';
import * as React from 'react';
import { useFloatingTree } from '../../floating-ui-react';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import {
  useNavigationMenuRootContext,
  useNavigationMenuTreeContext,
} from '../root/NavigationMenuRootContext';
import { isOutsideMenuEvent } from '../utils/isOutsideMenuEvent';
import { CompositeItem } from '../../internals/composite/item/CompositeItem';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

/**
 * A link in the navigation menu that can be used to navigate to a different page or section.
 * Renders an `<a>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuLink = React.forwardRef(function NavigationMenuLink(
  componentProps: NavigationMenuLink.Props,
  forwardedRef: React.ForwardedRef<HTMLAnchorElement>,
) {
  const {
    className,
    render,
    active = false,
    closeOnClick = false,
    style,
    ...elementProps
  } = componentProps;

  const { setValue, popupElement, positionerElement, rootRef } = useNavigationMenuRootContext();
  const nodeId = useNavigationMenuTreeContext();
  const tree = useFloatingTree();

  const state: NavigationMenuLinkState = {
    active,
  };

  const defaultProps: HTMLProps = {
    'aria-current': active ? 'page' : undefined,
    tabIndex: undefined,
    onClick(event) {
      if (closeOnClick) {
        setValue(null, createChangeEventDetails(REASONS.linkPress, event.nativeEvent));
      }
    },
    onBlur(event) {
      if (
        positionerElement &&
        popupElement &&
        isOutsideMenuEvent(
          {
            currentTarget: event.currentTarget,
            relatedTarget: event.relatedTarget as HTMLElement | null,
          },
          { popupElement, rootRef, tree, nodeId },
        )
      ) {
        setValue(null, createChangeEventDetails(REASONS.focusOut, event.nativeEvent));
      }
    },
  };

  return (
    <CompositeItem
      tag="a"
      render={render}
      className={className}
      style={style}
      state={state}
      refs={[forwardedRef]}
      props={[defaultProps, elementProps]}
    />
  );
});

export interface NavigationMenuLinkState {
  /**
   * Whether the link is the currently active page.
   */
  active: boolean;
}

export interface NavigationMenuLinkProps extends BaseUIComponentProps<
  'a',
  NavigationMenuLinkState
> {
  /**
   * Whether the link is the currently active page.
   * @default false
   */
  active?: boolean | undefined;
  /**
   * Whether to close the navigation menu when the link is clicked.
   * @default false
   */
  closeOnClick?: boolean | undefined;
}

export namespace NavigationMenuLink {
  export type State = NavigationMenuLinkState;
  export type Props = NavigationMenuLinkProps;
}
