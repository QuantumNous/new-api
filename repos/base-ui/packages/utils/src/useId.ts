'use client';
import * as React from 'react';
import { SafeReact } from './safeReact';

let globalId = 0;

// TODO React 17: Remove `useGlobalId` once React 17 support is removed
function useGlobalId(idOverride?: string, prefix: string = 'mui'): string | undefined {
  const [defaultId, setDefaultId] = React.useState(idOverride);
  const id = idOverride || defaultId;
  React.useEffect(() => {
    if (defaultId == null) {
      // Fallback to this default id when possible.
      // Use the incrementing value for client-side rendering only.
      // We can't use it server-side.
      // If you want to use random values please consider the Birthday Problem: https://en.wikipedia.org/wiki/Birthday_problem
      globalId += 1;
      setDefaultId(`${prefix}-${globalId}`);
    }
  }, [defaultId, prefix]);
  return id;
}

const maybeReactUseId: undefined | (() => string) = SafeReact.useId;

/**
 *
 * @example <div id={useId()} />
 * @param idOverride
 * @returns {string}
 */
export function useId(idOverride?: string, prefix?: string): string | undefined {
  // React.useId() is only available from React 17.0.0.
  if (maybeReactUseId !== undefined) {
    const reactId = maybeReactUseId();
    return idOverride ?? (prefix ? `${prefix}-${reactId}` : reactId);
  }

  // TODO: uncomment once we enable eslint-plugin-react-compiler // eslint-disable-next-line react-compiler/react-compiler
  // eslint-disable-next-line react-hooks/rules-of-hooks -- `React.useId` is invariant at runtime.
  return useGlobalId(idOverride, prefix);
}
