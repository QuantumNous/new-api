import * as React from 'react';
import type { Middleware, VirtualElement } from '@floating-ui/react-dom';
import { isElement } from '@floating-ui/utils/dom';

// Floating UI ships an `inline()` middleware. This local version mirrors its line-rect
// selection while adding trigger identity checks, delayed-open hit-line reuse, and
// improved left/right edge grouping for Preview Card's reusable trigger model.

export interface InlineRectCoords {
  /** The x position in viewport coordinates. */
  x: number;
  /** The y position in viewport coordinates. */
  y: number;
  /** The line index under the pointer when coordinates were captured. */
  lineIndex?: number | undefined;
  /** The trigger element whose rects produced these coordinates. */
  element: Element;
}

interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface ClientRectLike extends RectLike {
  x: number;
  y: number;
}

interface ClientRectsReference {
  getClientRects(): ArrayLike<RectLike>;
}

function createRect(left: number, top: number, right: number, bottom: number): ClientRectLike {
  return {
    left,
    top,
    right,
    bottom,
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function copyRect(rect: RectLike): RectLike {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

function getLineRects(rects: ArrayLike<RectLike>) {
  const lines: RectLike[] = [];
  let previousRect: RectLike | undefined;
  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;

  for (const rect of Array.from(rects).sort((a, b) => a.top - b.top)) {
    left = Math.min(left, rect.left);
    top = Math.min(top, rect.top);
    right = Math.max(right, rect.right);
    bottom = Math.max(bottom, rect.bottom);

    if (!previousRect || rect.top - previousRect.top > previousRect.height / 2) {
      lines.push(copyRect(rect));
    } else {
      const line = lines[lines.length - 1];
      line.left = Math.min(line.left, rect.left);
      line.right = Math.max(line.right, rect.right);
      line.bottom = Math.max(line.bottom, rect.bottom);
      line.width = line.right - line.left;
      line.height = line.bottom - line.top;
    }

    previousRect = rect;
  }

  return {
    lines,
    fallback: createRect(left, top, right, bottom),
  };
}

function findLineIndex(lines: RectLike[], x: number, y: number) {
  return lines.findIndex(
    (lineRect) =>
      x > lineRect.left - 2 &&
      x < lineRect.right + 2 &&
      y > lineRect.top - 2 &&
      y < lineRect.bottom + 2,
  );
}

function createClientRect(rect: RectLike) {
  return createRect(rect.left, rect.top, rect.right, rect.bottom);
}

function getInlineRectCoords(
  element: Element,
  clientX: number,
  clientY: number,
): InlineRectCoords | undefined {
  const { lines } = getLineRects(element.getClientRects());

  if (lines.length < 2) {
    return undefined;
  }

  const lineIndex = findLineIndex(lines, clientX, clientY);

  return {
    x: clientX,
    y: clientY,
    lineIndex: lineIndex === -1 ? undefined : lineIndex,
    element,
  };
}

function getInlineReferenceRect(
  reference: ClientRectsReference,
  placement: string,
  coords: InlineRectCoords | undefined,
): ClientRectLike | null {
  const { lines, fallback } = getLineRects(reference.getClientRects());

  if (lines.length < 2) {
    return null;
  }

  const x = coords?.x;
  const y = coords?.y;
  const side = placement[0];

  if (coords?.lineIndex != null && lines[coords.lineIndex]) {
    return createClientRect(lines[coords.lineIndex]);
  }

  if (x != null && y != null) {
    const lineIndex = findLineIndex(lines, x, y);

    if (lineIndex !== -1) {
      return createClientRect(lines[lineIndex]);
    }
  }

  if (lines.length === 2 && lines[0].left > lines[1].right && x != null && y != null) {
    return fallback;
  }

  if (side === 't' || side === 'b') {
    const firstRect = lines[0];
    const lastRect = lines[lines.length - 1];
    const targetRect = side === 't' ? firstRect : lastRect;

    return createRect(targetRect.left, firstRect.top, targetRect.right, lastRect.bottom);
  }

  const isLeft = side === 'l';
  let left = lines[0].left;
  let right = lines[0].right;
  let edge = isLeft ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  let targetFirstRect = lines[0];
  let targetLastRect = lines[0];

  for (const rect of lines) {
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);

    const nextEdge = isLeft ? rect.left : rect.right;

    if ((isLeft && nextEdge < edge) || (!isLeft && nextEdge > edge)) {
      edge = nextEdge;
      targetFirstRect = rect;
      targetLastRect = rect;
    } else if (nextEdge === edge) {
      targetLastRect = rect;
    }
  }

  return createRect(left, targetFirstRect.top, right, targetLastRect.bottom);
}

function getContextElement(reference: Element | VirtualElement): Element | undefined {
  if ('contextElement' in reference && reference.contextElement) {
    return reference.contextElement;
  }

  return isElement(reference) ? reference : undefined;
}

export function getInlineRectTriggerProps(
  coordsRef: React.RefObject<InlineRectCoords | undefined>,
  isOpen: boolean,
): Pick<React.HTMLAttributes<Element>, 'onFocus' | 'onMouseEnter' | 'onMouseMove'> {
  function updateCoords(event: React.MouseEvent<Element>) {
    updateInlineRectCoords(coordsRef, event.currentTarget, event.clientX, event.clientY);
  }

  function updateCoordsIfClosed(event: React.MouseEvent<Element>) {
    if (!isOpen) {
      updateCoords(event);
    }
  }

  return {
    onFocus() {
      coordsRef.current = undefined;
    },
    onMouseEnter: updateCoordsIfClosed,
    onMouseMove: updateCoordsIfClosed,
  };
}

export function updateInlineRectCoords(
  coordsRef: React.RefObject<InlineRectCoords | undefined>,
  element: Element,
  clientX: number,
  clientY: number,
) {
  const nextCoords = getInlineRectCoords(element, clientX, clientY);
  coordsRef.current = nextCoords;
  return nextCoords;
}

export function createInlineMiddleware(
  coordsRef: React.RefObject<InlineRectCoords | undefined>,
): Middleware {
  return {
    name: 'inline',
    async fn(state) {
      const reference = state.elements.reference;

      if (
        typeof (reference as Partial<ClientRectsReference> | null)?.getClientRects !== 'function'
      ) {
        return {};
      }

      const contextElement = getContextElement(reference);
      const coords = coordsRef.current;
      const currentCoords =
        coords?.element === reference || coords?.element === contextElement ? coords : undefined;
      const rect = getInlineReferenceRect(
        reference as ClientRectsReference,
        state.placement,
        currentCoords,
      );

      if (!rect || typeof state.platform.getElementRects !== 'function') {
        return {};
      }

      const resetRects = await state.platform.getElementRects({
        reference: {
          contextElement,
          getBoundingClientRect() {
            return rect;
          },
        },
        floating: state.elements.floating,
        strategy: state.strategy,
      });

      if (
        state.rects.reference.x === resetRects.reference.x &&
        state.rects.reference.y === resetRects.reference.y &&
        state.rects.reference.width === resetRects.reference.width &&
        state.rects.reference.height === resetRects.reference.height
      ) {
        return {};
      }

      return {
        reset: {
          rects: resetRects,
        },
      };
    },
  };
}
