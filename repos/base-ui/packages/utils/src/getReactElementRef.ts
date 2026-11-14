import * as React from 'react';
import { isReactVersionAtLeast } from './reactVersion';

/**
 * Extracts the `ref` from a React element, handling different React versions.
 */
export function getReactElementRef(element: unknown): React.Ref<unknown> | null {
  if (!React.isValidElement(element)) {
    return null;
  }

  const reactElement = element as React.ReactElement & { ref?: React.Ref<unknown> | undefined };
  const propsWithRef = reactElement.props as { ref?: React.Ref<unknown> | undefined } | undefined;

  return (isReactVersionAtLeast(19) ? propsWithRef?.ref : reactElement.ref) ?? null;
}
