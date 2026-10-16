import type { FloatingNodeType } from '../types';

/* eslint-disable @typescript-eslint/no-loop-func */

export function getNodeChildren(
  nodes: Array<FloatingNodeType>,
  id: string | undefined,
  onlyOpenChildren = true,
): Array<FloatingNodeType> {
  const directChildren = nodes.filter((node) => node.parentId === id);

  return directChildren.flatMap((child) => [
    ...(!onlyOpenChildren || child.context?.open ? [child] : []),
    ...getNodeChildren(nodes, child.id, onlyOpenChildren),
  ]);
}

export function getDeepestNode(nodes: Array<FloatingNodeType>, id: string | undefined) {
  let deepestNodeId: string | undefined;
  let maxDepth = -1;

  function findDeepest(nodeId: string | undefined, depth: number) {
    if (depth > maxDepth) {
      deepestNodeId = nodeId;
      maxDepth = depth;
    }

    const children = getNodeChildren(nodes, nodeId);

    children.forEach((child) => {
      findDeepest(child.id, depth + 1);
    });
  }

  findDeepest(id, 0);

  return nodes.find((node) => node.id === deepestNodeId);
}

export function getNodeAncestors(nodes: Array<FloatingNodeType>, id: string | undefined) {
  let allAncestors: Array<FloatingNodeType> = [];
  let currentParentId = nodes.find((node) => node.id === id)?.parentId;

  while (currentParentId) {
    const currentNode = nodes.find((node) => node.id === currentParentId);
    currentParentId = currentNode?.parentId;

    if (currentNode) {
      allAncestors = allAncestors.concat(currentNode);
    }
  }

  return allAncestors;
}
