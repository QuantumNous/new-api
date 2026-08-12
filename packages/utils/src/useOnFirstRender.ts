'use client';
import * as React from 'react';

export function useOnFirstRender(fn: Function) {
  const ref = React.useRef(true);
  if (ref.current) {
    ref.current = false;
    fn();
  }
}
