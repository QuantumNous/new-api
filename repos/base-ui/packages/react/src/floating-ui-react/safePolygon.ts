import { isElement } from '@floating-ui/utils/dom';
import { Timeout } from '@base-ui/utils/useTimeout';
import type { Rect, Side } from './types';
import type { HandleClose, HandleCloseOptions } from './hooks/useHoverShared';
import { contains, getTarget } from './utils/element';
import { getNodeChildren } from './utils/nodes';

/* eslint-disable no-nested-ternary */

const CURSOR_SPEED_THRESHOLD = 0.1;
const CURSOR_SPEED_THRESHOLD_SQUARED = CURSOR_SPEED_THRESHOLD * CURSOR_SPEED_THRESHOLD;
const POLYGON_BUFFER = 0.5;

function hasIntersectingEdge(
  pointX: number,
  pointY: number,
  xi: number,
  yi: number,
  xj: number,
  yj: number,
) {
  return yi >= pointY !== yj >= pointY && pointX <= ((xj - xi) * (pointY - yi)) / (yj - yi) + xi;
}

function isPointInQuadrilateral(
  pointX: number,
  pointY: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  x4: number,
  y4: number,
) {
  let isInsideValue = false;

  if (hasIntersectingEdge(pointX, pointY, x1, y1, x2, y2)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x2, y2, x3, y3)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x3, y3, x4, y4)) {
    isInsideValue = !isInsideValue;
  }

  if (hasIntersectingEdge(pointX, pointY, x4, y4, x1, y1)) {
    isInsideValue = !isInsideValue;
  }

  return isInsideValue;
}

function isInsideRect(pointX: number, pointY: number, rect: Rect) {
  return (
    pointX >= rect.x &&
    pointX <= rect.x + rect.width &&
    pointY >= rect.y &&
    pointY <= rect.y + rect.height
  );
}

function isInsideAxisAlignedRect(
  pointX: number,
  pointY: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  return pointX >= minX && pointX <= maxX && pointY >= minY && pointY <= maxY;
}

export interface SafePolygonOptions extends HandleCloseOptions {}

/**
 * Generates a safe polygon area that the user can traverse without closing the
 * floating element once leaving the reference element.
 * @see https://floating-ui.com/docs/useHover#safepolygon
 */
export function safePolygon(options: SafePolygonOptions = {}) {
  const { blockPointerEvents = false } = options;
  const timeout = new Timeout();

  const fn: HandleClose = ({ x, y, placement, elements, onClose, nodeId, tree }) => {
    const side = placement?.split('-')[0] as Side | undefined;
    let hasLanded = false;
    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastCursorTime = typeof performance !== 'undefined' ? performance.now() : 0;

    function isCursorMovingSlowly(nextX: number, nextY: number) {
      const currentTime = performance.now();
      const elapsedTime = currentTime - lastCursorTime;

      if (lastX === null || lastY === null || elapsedTime === 0) {
        lastX = nextX;
        lastY = nextY;
        lastCursorTime = currentTime;
        return false;
      }

      const deltaX = nextX - lastX;
      const deltaY = nextY - lastY;
      const distanceSquared = deltaX * deltaX + deltaY * deltaY;
      const thresholdSquared = elapsedTime * elapsedTime * CURSOR_SPEED_THRESHOLD_SQUARED;

      lastX = nextX;
      lastY = nextY;
      lastCursorTime = currentTime;

      return distanceSquared < thresholdSquared;
    }

    function close() {
      timeout.clear();
      onClose();
    }

    return function onMouseMove(event: MouseEvent) {
      timeout.clear();

      const domReference = elements.domReference;
      const floating = elements.floating;
      if (!domReference || !floating || side == null || x == null || y == null) {
        return undefined;
      }

      const { clientX, clientY } = event;
      const target = getTarget(event) as Element | null;
      const isLeave = event.type === 'mouseleave';
      const isOverFloatingEl = contains(floating, target);
      const isOverReferenceEl = contains(domReference, target);

      if (isOverFloatingEl) {
        hasLanded = true;

        if (!isLeave) {
          return undefined;
        }
      }

      if (isOverReferenceEl) {
        hasLanded = false;

        if (!isLeave) {
          hasLanded = true;
          return undefined;
        }
      }

      // Prevent overlapping floating element from being stuck in an open-close
      // loop: https://github.com/floating-ui/floating-ui/issues/1910
      if (isLeave && isElement(event.relatedTarget) && contains(floating, event.relatedTarget)) {
        return undefined;
      }

      function hasOpenChildNode() {
        return Boolean(tree && getNodeChildren(tree.nodesRef.current, nodeId).length > 0);
      }

      function closeIfNoOpenChild() {
        if (!hasOpenChildNode()) {
          close();
        }
      }

      // If any nested child is open, abort.
      if (hasOpenChildNode()) {
        return undefined;
      }

      const refRect = domReference.getBoundingClientRect();
      const rect = floating.getBoundingClientRect();
      const cursorLeaveFromRight = x > rect.right - rect.width / 2;
      const cursorLeaveFromBottom = y > rect.bottom - rect.height / 2;
      const isFloatingWider = rect.width > refRect.width;
      const isFloatingTaller = rect.height > refRect.height;
      const left = (isFloatingWider ? refRect : rect).left;
      const right = (isFloatingWider ? refRect : rect).right;
      const top = (isFloatingTaller ? refRect : rect).top;
      const bottom = (isFloatingTaller ? refRect : rect).bottom;

      // If the pointer is leaving from the opposite side, the "buffer" logic
      // creates a point where the floating element remains open, but should be
      // ignored.
      // A constant of 1 handles floating point rounding errors.
      if (
        (side === 'top' && y >= refRect.bottom - 1) ||
        (side === 'bottom' && y <= refRect.top + 1) ||
        (side === 'left' && x >= refRect.right - 1) ||
        (side === 'right' && x <= refRect.left + 1)
      ) {
        closeIfNoOpenChild();
        return undefined;
      }

      // Ignore when the cursor is within the rectangular trough between the
      // two elements. Since the triangle is created from the cursor point,
      // which can start beyond the ref element's edge, traversing back and
      // forth from the ref to the floating element can cause it to close. This
      // ensures it always remains open in that case.
      let isInsideTroughRect = false;

      switch (side) {
        case 'top':
          isInsideTroughRect = isInsideAxisAlignedRect(
            clientX,
            clientY,
            left,
            refRect.top + 1,
            right,
            rect.bottom - 1,
          );
          break;
        case 'bottom':
          isInsideTroughRect = isInsideAxisAlignedRect(
            clientX,
            clientY,
            left,
            rect.top + 1,
            right,
            refRect.bottom - 1,
          );
          break;
        case 'left':
          isInsideTroughRect = isInsideAxisAlignedRect(
            clientX,
            clientY,
            rect.right - 1,
            bottom,
            refRect.left + 1,
            top,
          );
          break;
        case 'right':
          isInsideTroughRect = isInsideAxisAlignedRect(
            clientX,
            clientY,
            refRect.right - 1,
            bottom,
            rect.left + 1,
            top,
          );
          break;
        default:
      }

      if (isInsideTroughRect) {
        return undefined;
      }

      if (hasLanded && !isInsideRect(clientX, clientY, refRect)) {
        closeIfNoOpenChild();
        return undefined;
      }

      if (!isLeave && isCursorMovingSlowly(clientX, clientY)) {
        closeIfNoOpenChild();
        return undefined;
      }

      let isInsidePolygon = false;

      switch (side) {
        case 'top': {
          const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneX = isFloatingWider
            ? x + cursorXOffset
            : cursorLeaveFromRight
              ? x + cursorXOffset
              : x - cursorXOffset;
          const cursorPointTwoX = isFloatingWider
            ? x - cursorXOffset
            : cursorLeaveFromRight
              ? x + cursorXOffset
              : x - cursorXOffset;
          const cursorPointY = y + POLYGON_BUFFER + 1;

          const commonYLeft = cursorLeaveFromRight
            ? rect.bottom - POLYGON_BUFFER
            : isFloatingWider
              ? rect.bottom - POLYGON_BUFFER
              : rect.top;
          const commonYRight = cursorLeaveFromRight
            ? isFloatingWider
              ? rect.bottom - POLYGON_BUFFER
              : rect.top
            : rect.bottom - POLYGON_BUFFER;

          isInsidePolygon = isPointInQuadrilateral(
            clientX,
            clientY,
            cursorPointOneX,
            cursorPointY,
            cursorPointTwoX,
            cursorPointY,
            rect.left,
            commonYLeft,
            rect.right,
            commonYRight,
          );
          break;
        }
        case 'bottom': {
          const cursorXOffset = isFloatingWider ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneX = isFloatingWider
            ? x + cursorXOffset
            : cursorLeaveFromRight
              ? x + cursorXOffset
              : x - cursorXOffset;
          const cursorPointTwoX = isFloatingWider
            ? x - cursorXOffset
            : cursorLeaveFromRight
              ? x + cursorXOffset
              : x - cursorXOffset;
          const cursorPointY = y - POLYGON_BUFFER;

          const commonYLeft = cursorLeaveFromRight
            ? rect.top + POLYGON_BUFFER
            : isFloatingWider
              ? rect.top + POLYGON_BUFFER
              : rect.bottom;
          const commonYRight = cursorLeaveFromRight
            ? isFloatingWider
              ? rect.top + POLYGON_BUFFER
              : rect.bottom
            : rect.top + POLYGON_BUFFER;

          isInsidePolygon = isPointInQuadrilateral(
            clientX,
            clientY,
            cursorPointOneX,
            cursorPointY,
            cursorPointTwoX,
            cursorPointY,
            rect.left,
            commonYLeft,
            rect.right,
            commonYRight,
          );
          break;
        }
        case 'left': {
          const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneY = isFloatingTaller
            ? y + cursorYOffset
            : cursorLeaveFromBottom
              ? y + cursorYOffset
              : y - cursorYOffset;
          const cursorPointTwoY = isFloatingTaller
            ? y - cursorYOffset
            : cursorLeaveFromBottom
              ? y + cursorYOffset
              : y - cursorYOffset;
          const cursorPointX = x + POLYGON_BUFFER + 1;

          const commonXTop = cursorLeaveFromBottom
            ? rect.right - POLYGON_BUFFER
            : isFloatingTaller
              ? rect.right - POLYGON_BUFFER
              : rect.left;
          const commonXBottom = cursorLeaveFromBottom
            ? isFloatingTaller
              ? rect.right - POLYGON_BUFFER
              : rect.left
            : rect.right - POLYGON_BUFFER;

          isInsidePolygon = isPointInQuadrilateral(
            clientX,
            clientY,
            commonXTop,
            rect.top,
            commonXBottom,
            rect.bottom,
            cursorPointX,
            cursorPointOneY,
            cursorPointX,
            cursorPointTwoY,
          );
          break;
        }
        case 'right': {
          const cursorYOffset = isFloatingTaller ? POLYGON_BUFFER / 2 : POLYGON_BUFFER * 4;
          const cursorPointOneY = isFloatingTaller
            ? y + cursorYOffset
            : cursorLeaveFromBottom
              ? y + cursorYOffset
              : y - cursorYOffset;
          const cursorPointTwoY = isFloatingTaller
            ? y - cursorYOffset
            : cursorLeaveFromBottom
              ? y + cursorYOffset
              : y - cursorYOffset;
          const cursorPointX = x - POLYGON_BUFFER;

          const commonXTop = cursorLeaveFromBottom
            ? rect.left + POLYGON_BUFFER
            : isFloatingTaller
              ? rect.left + POLYGON_BUFFER
              : rect.right;
          const commonXBottom = cursorLeaveFromBottom
            ? isFloatingTaller
              ? rect.left + POLYGON_BUFFER
              : rect.right
            : rect.left + POLYGON_BUFFER;

          isInsidePolygon = isPointInQuadrilateral(
            clientX,
            clientY,
            cursorPointX,
            cursorPointOneY,
            cursorPointX,
            cursorPointTwoY,
            commonXTop,
            rect.top,
            commonXBottom,
            rect.bottom,
          );
          break;
        }
        default:
      }

      if (!isInsidePolygon) {
        closeIfNoOpenChild();
      } else if (!hasLanded) {
        timeout.start(40, closeIfNoOpenChild);
      }

      return undefined;
    };
  };

  // eslint-disable-next-line no-underscore-dangle
  fn.__options = {
    ...options,
    blockPointerEvents,
  };

  return fn;
}
