import { isMouseLikePointerType } from '../utils/event';
import type { ExtendedElements, FloatingTreeType, Placement } from '../types';

export { isTargetInsideEnabledTrigger as isInsideEnabledTrigger } from '../utils/element';

export interface HandleCloseOptions {
  blockPointerEvents?: boolean | undefined;
  getScope?: (() => HTMLElement | SVGSVGElement | null) | undefined;
}

export interface HandleCloseContext {
  x: number | null;
  y: number | null;
  placement: Placement | null;
  elements: Pick<ExtendedElements, 'domReference' | 'floating'>;
  onClose: () => void;
  nodeId?: string | undefined;
  tree?: FloatingTreeType | null | undefined;
  leave?: boolean | undefined;
}

export type HandleCloseContextBase = Omit<HandleCloseContext, 'onClose' | 'tree' | 'x' | 'y'>;

export interface HandleClose {
  (context: HandleCloseContext): (event: MouseEvent) => void;
  __options?: HandleCloseOptions | undefined;
}

type HoverDelay = number | Partial<{ open: number; close: number }>;

function resolveValue<T>(
  value: T | (() => T) | undefined,
  pointerType?: PointerEvent['pointerType'],
): T | 0 | undefined {
  if (pointerType != null && !isMouseLikePointerType(pointerType)) {
    return 0;
  }

  if (typeof value === 'function') {
    return (value as () => T)();
  }

  return value;
}

export function getDelay(
  value: HoverDelay | (() => HoverDelay) | undefined,
  prop: 'open' | 'close',
  pointerType?: PointerEvent['pointerType'],
) {
  const result = resolveValue(value, pointerType);
  if (typeof result === 'number') {
    return result;
  }

  return result?.[prop];
}

export function getRestMs(value: number | (() => number)) {
  if (typeof value === 'function') {
    return value();
  }
  return value;
}

export function isClickLikeOpenEvent(openEventType: string | undefined, interactedInside: boolean) {
  return interactedInside || openEventType === 'click' || openEventType === 'mousedown';
}

export function isHoverOpenEvent(openEventType: string | undefined) {
  return openEventType?.includes('mouse') && openEventType !== 'mousedown';
}
