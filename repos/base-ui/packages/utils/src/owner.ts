export { getWindow as ownerWindow } from '@floating-ui/utils/dom';

export function ownerDocument(node: Element | null) {
  return node?.ownerDocument || document;
}
