'use client';
import * as React from 'react';

export interface CSPContextValue {
  nonce?: string | undefined;
  disableStyleElements?: boolean | undefined;
}

/**
 * @internal
 */
export const CSPContext = React.createContext<CSPContextValue | undefined>(undefined);

const DEFAULT_CSP_CONTEXT_VALUE: CSPContextValue = {
  disableStyleElements: false,
};

/**
 * @internal
 */
export function useCSPContext(): CSPContextValue {
  return React.useContext(CSPContext) ?? DEFAULT_CSP_CONTEXT_VALUE;
}
