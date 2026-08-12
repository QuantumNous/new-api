'use client';

import * as React from 'react';
import { CodeComponentsContext } from '@mui/internal-docs-infra/useCode';
import type { MDXComponents } from 'mdx/types';
import { Link } from './components/Link';
import { TypeRef } from './components/TypeRef';
import { TypePropRef } from './components/TypePropRef';

export const codeComponents: MDXComponents = {
  a: Link,
  TypeRef,
  TypePropRef,
};

export function CodeComponentsProvider({ children }: { children: React.ReactNode }) {
  return (
    <CodeComponentsContext.Provider value={codeComponents}>
      {children}
    </CodeComponentsContext.Provider>
  );
}
