'use client';
import * as React from 'react';

import { useId } from '@base-ui/utils/useId';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import type { FloatingNodeType, FloatingTreeType } from '../types';
import { FloatingTreeStore } from './FloatingTreeStore';

const FloatingNodeContext = React.createContext<FloatingNodeType | null>(null);
const FloatingTreeContext = React.createContext<FloatingTreeType | null>(null);

/**
 * Returns the parent node id for nested floating elements, if available.
 * Returns `null` for top-level floating elements.
 */
export const useFloatingParentNodeId = (): string | null =>
  React.useContext(FloatingNodeContext)?.id || null;

/**
 * Returns the nearest floating tree context, if available.
 */
export const useFloatingTree = (externalTree?: FloatingTreeStore): FloatingTreeType | null => {
  const contextTree = React.useContext(FloatingTreeContext) as FloatingTreeType | null;
  return externalTree ?? contextTree;
};

/**
 * Registers a node into the `FloatingTree`, returning its id.
 * @see https://floating-ui.com/docs/FloatingTree
 */
export function useFloatingNodeId(externalTree?: FloatingTreeStore): string | undefined {
  const id = useId();
  const tree = useFloatingTree(externalTree);
  const parentId = useFloatingParentNodeId();

  useIsoLayoutEffect(() => {
    if (!id) {
      return undefined;
    }

    const node = { id, parentId };
    tree?.addNode(node);
    return () => {
      tree?.removeNode(node);
    };
  }, [tree, id, parentId]);

  return id;
}

export interface FloatingNodeProps {
  children?: React.ReactNode;
  id: string | undefined;
}

/**
 * Provides parent node context for nested floating elements.
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingNode(props: FloatingNodeProps): React.JSX.Element {
  const { children, id } = props;

  const parentId = useFloatingParentNodeId();

  return (
    <FloatingNodeContext.Provider value={React.useMemo(() => ({ id, parentId }), [id, parentId])}>
      {children}
    </FloatingNodeContext.Provider>
  );
}

export interface FloatingTreeProps {
  children?: React.ReactNode;
  externalTree?: FloatingTreeStore | undefined;
}

/**
 * Provides context for nested floating elements when they are not children of
 * each other on the DOM.
 * This is not necessary in all cases, except when there must be explicit communication between parent and child floating elements. It is necessary for:
 * - The `bubbles` option in the `useDismiss()` Hook
 * - Nested virtual list navigation
 * - Nested floating elements that each open on hover
 * - Custom communication between parent and child floating elements
 * @see https://floating-ui.com/docs/FloatingTree
 * @internal
 */
export function FloatingTree(props: FloatingTreeProps): React.JSX.Element {
  const { children, externalTree } = props;

  const tree = useRefWithInit(() => externalTree ?? new FloatingTreeStore()).current;
  return <FloatingTreeContext.Provider value={tree}>{children}</FloatingTreeContext.Provider>;
}
