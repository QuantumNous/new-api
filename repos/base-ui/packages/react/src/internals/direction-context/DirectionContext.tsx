'use client';
import * as React from 'react';

export type TextDirection = 'ltr' | 'rtl';

export type DirectionContext = {
  direction: TextDirection;
};

/**
 * @internal
 */
export const DirectionContext = React.createContext<DirectionContext | undefined>(undefined);

export function useDirection() {
  const context = React.useContext(DirectionContext);

  return context?.direction ?? 'ltr';
}
