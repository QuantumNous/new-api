'use client';
import * as React from 'react';
import { CSPContext, type CSPContextValue } from '../internals/csp-context/CSPContext';

/**
 * Provides a default Content Security Policy (CSP) configuration for Base UI components that
 * require inline `<style>` or `<script>` tags.
 *
 * Documentation: [Base UI CSP Provider](https://base-ui.com/react/utils/csp-provider)
 */
export function CSPProvider(props: CSPProvider.Props) {
  const { children, nonce, disableStyleElements } = props;

  const contextValue: CSPContextValue = React.useMemo(
    () => ({
      nonce,
      disableStyleElements,
    }),
    [nonce, disableStyleElements],
  );

  return <CSPContext.Provider value={contextValue}>{children}</CSPContext.Provider>;
}

export interface CSPProviderState {}

export interface CSPProviderProps {
  children?: React.ReactNode;
  /**
   * The nonce value to apply to inline `<style>` and `<script>` tags.
   */
  nonce?: string | undefined;
  /**
   * Whether inline `<style>` elements created by Base UI components should not be rendered. Instead, components must specify the CSS styles via custom class names or other methods.
   * @default false
   */
  disableStyleElements?: boolean | undefined;
}

export namespace CSPProvider {
  export type State = CSPProviderState;
  export type Props = CSPProviderProps;
}
