'use client';
import * as React from 'react';
import type { BaseUIComponentProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  NavigationMenuItemContext,
  NavigationMenuItemContextValue,
} from './NavigationMenuItemContext';
import { useBaseUiId } from '../../internals/useBaseUiId';

/**
 * An individual navigation menu item.
 * Renders a `<li>` element.
 *
 * Documentation: [Base UI Navigation Menu](https://base-ui.com/react/components/navigation-menu)
 */
export const NavigationMenuItem = React.forwardRef(function NavigationMenuItem(
  componentProps: NavigationMenuItem.Props,
  forwardedRef: React.ForwardedRef<HTMLLIElement>,
) {
  const { render, className, style, value: valueProp, ...elementProps } = componentProps;

  const fallbackValue = useBaseUiId();
  const value = valueProp ?? fallbackValue;

  const element = useRenderElement('li', componentProps, {
    ref: forwardedRef,
    props: elementProps,
  });

  const contextValue: NavigationMenuItemContextValue = React.useMemo(() => ({ value }), [value]);

  return (
    <NavigationMenuItemContext.Provider value={contextValue}>
      {element}
    </NavigationMenuItemContext.Provider>
  );
});

export interface NavigationMenuItemState {}

export interface NavigationMenuItemProps extends BaseUIComponentProps<
  'li',
  NavigationMenuItemState
> {
  /**
   * A unique value that identifies this navigation menu item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the navigation menu programmatically.
   */
  value?: any;
}

export namespace NavigationMenuItem {
  export type State = NavigationMenuItemState;
  export type Props = NavigationMenuItemProps;
}
