'use client';

import * as React from 'react';
import type { TypePropRefProps } from '@mui/internal-docs-infra/useType';

import './TypePropRef.css';

/**
 * Renders a type property reference.
 * Definition sites (`id` is present) render a plain span with the anchor id.
 * Reference sites render a plain anchor to that definition.
 */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

export function TypePropRef({ id, name, prop, className, children }: TypePropRefProps) {
  const resolvedHref = `#${name}-${kebabToCamelCase(prop)}`;

  if (id) {
    return (
      <span id={id} className={className}>
        {children}
      </span>
    );
  }

  return (
    <a href={resolvedHref} className={`${className ?? ''} TypePropRefLink`.trim()}>
      {children}
    </a>
  );
}
