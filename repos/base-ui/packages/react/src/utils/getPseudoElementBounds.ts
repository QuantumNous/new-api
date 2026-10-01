import { ownerWindow } from '@base-ui/utils/owner';
import { platform } from '@base-ui/utils/platform';

interface ElementBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export function getPseudoElementBounds(element: HTMLElement): ElementBounds {
  const elementRect = element.getBoundingClientRect();
  const win = ownerWindow(element);

  // Avoid "Not implemented: window.getComputedStyle(elt, pseudoElt)" in jsdom.
  if (platform.env.jsdom) {
    return elementRect;
  }

  const beforeStyles = win.getComputedStyle(element, '::before');
  const afterStyles = win.getComputedStyle(element, '::after');

  const hasPseudoElements = beforeStyles.content !== 'none' || afterStyles.content !== 'none';

  if (!hasPseudoElements) {
    return elementRect;
  }

  // Get dimensions of pseudo-elements
  const beforeWidth = parseFloat(beforeStyles.width) || 0;
  const beforeHeight = parseFloat(beforeStyles.height) || 0;
  const afterWidth = parseFloat(afterStyles.width) || 0;
  const afterHeight = parseFloat(afterStyles.height) || 0;

  // Calculate max dimensions including pseudo-elements
  const totalWidth = Math.max(elementRect.width, beforeWidth, afterWidth);
  const totalHeight = Math.max(elementRect.height, beforeHeight, afterHeight);

  // Calculate the differences to extend the bounds
  const widthDiff = totalWidth - elementRect.width;
  const heightDiff = totalHeight - elementRect.height;

  return {
    left: elementRect.left - widthDiff / 2,
    right: elementRect.right + widthDiff / 2,
    top: elementRect.top - heightDiff / 2,
    bottom: elementRect.bottom + heightDiff / 2,
  };
}
