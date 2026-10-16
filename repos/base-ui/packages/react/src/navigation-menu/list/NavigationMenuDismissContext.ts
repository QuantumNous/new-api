'use client';
import * as React from 'react';
import type { ElementProps } from '../../floating-ui-react';

export const NavigationMenuDismissContext = React.createContext<ElementProps | undefined>(
  undefined,
);

export function useNavigationMenuDismissContext() {
  return React.useContext(NavigationMenuDismissContext);
}
