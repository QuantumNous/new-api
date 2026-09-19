import { FloatingTreeType } from '../../floating-ui-react';
import { contains, getNodeChildren } from '../../floating-ui-react/utils';

interface Targets {
  currentTarget: HTMLElement | null;
  relatedTarget: HTMLElement | null;
}

interface Params {
  popupElement: HTMLElement | null;
  rootRef: React.RefObject<HTMLDivElement | null>;
  tree: FloatingTreeType | null;
  nodeId: string | undefined;
}

export function isOutsideMenuEvent({ currentTarget, relatedTarget }: Targets, params: Params) {
  const { popupElement, rootRef, tree, nodeId } = params;

  const nodeChildrenContains = tree
    ? getNodeChildren(tree.nodesRef.current, nodeId).some((node) =>
        contains(node.context?.elements.floating, relatedTarget),
      )
    : [];

  // For nested scenarios without popupElement, we need to be more lenient
  // and only close if we're definitely outside the root
  if (!popupElement) {
    return !contains(rootRef.current, relatedTarget) && !nodeChildrenContains;
  }

  return (
    !contains(popupElement, currentTarget) &&
    !contains(popupElement, relatedTarget) &&
    !contains(rootRef.current, relatedTarget) &&
    !nodeChildrenContains &&
    !(
      contains(popupElement, relatedTarget) &&
      relatedTarget?.hasAttribute('data-base-ui-focus-guard')
    )
  );
}
