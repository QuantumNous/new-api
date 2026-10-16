'use client';
import * as React from 'react';

/**
 * Returns a previous value of its argument.
 * @param value Current value.
 * @returns Previous value, or null if there is no previous value.
 */
export function usePreviousValue<T>(value: T): T | null {
  const [state, setState] = React.useState<{ current: T; previous: T | null }>({
    current: value,
    previous: null,
  });

  if (value !== state.current) {
    setState({ current: value, previous: state.current });
  }

  return state.previous;
}
