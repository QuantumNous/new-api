'use client';
import * as React from 'react';
import { getSide, getAlignment, type Rect, getSideAxis } from '@floating-ui/utils';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift,
  useFloating,
  size,
  type UseFloatingOptions,
  type Placement,
  type FloatingRootContext,
  type VirtualElement,
  type Padding,
  type FloatingContext,
  type Side as PhysicalSide,
  type MiddlewareState,
  type AutoUpdateOptions,
  type Middleware,
  type FloatingTreeStore,
} from '../floating-ui-react';
import { useDirection } from '../internals/direction-context/DirectionContext';
import { arrow } from '../floating-ui-react/middleware/arrow';
import { hide } from './hideMiddleware';
import { DEFAULT_SIDES } from './adaptiveOriginMiddleware';

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      top: 'top',
      right: isLogicalSideParam ? logicalRight : 'right',
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
    align: getAlignment(placement) || 'center',
    anchor: { width: rects.reference.width, height: rects.reference.height },
    positioner: { width: rects.floating.width, height: rects.floating.height },
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'flip'`: If there is not enough space, place the popup on the opposite side.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'flip' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'flip'`: If there is not enough space, swap `'start'` and `'end'` alignment.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'flip' | 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   * - `'shift'`: Keep the preferred side and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred side even if it overflows.
   */
  side?: 'shift' | 'none' | undefined;
  /**
   * How to avoid collisions on the align axis.
   * - `'shift'`: Keep the alignment and shift the popup to fit within the boundary.
   * - `'none'`: Keep the preferred alignment even if it overflows.
   */
  align?: 'shift' | 'none' | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   * - `'start'`: Prefer the logical start side on the perpendicular axis.
   * - `'end'`: Prefer the logical end side on the perpendicular axis.
   * - `'none'`: Do not fallback to the perpendicular axis.
   */
  fallbackAxisSide?: 'start' | 'end' | 'none' | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook.
 */
export function useAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  const {
    // Public parameters
    anchor,
    positionMethod = 'absolute',
    side: sideParam = 'bottom',
    sideOffset = 0,
    align = 'center',
    alignOffset = 0,
    collisionBoundary,
    collisionPadding: collisionPaddingParam = 5,
    sticky = false,
    arrowPadding = 5,
    disableAnchorTracking = false,
    inline: inlineMiddleware,
    // Private parameters
    keepMounted = false,
    floatingRootContext,
    mounted,
    collisionAvoidance,
    shiftCrossAxis = false,
    nodeId,
    adaptiveOrigin,
    lazyFlip = false,
    externalTree,
  } = params;

  const [mountSide, setMountSide] = React.useState<PhysicalSide | null>(null);

  if (!mounted && mountSide !== null) {
    setMountSide(null);
  }

  const collisionAvoidanceSide = collisionAvoidance.side || 'flip';
  const collisionAvoidanceAlign = collisionAvoidance.align || 'flip';
  const collisionAvoidanceFallbackAxisSide = collisionAvoidance.fallbackAxisSide || 'end';

  const anchorFn = typeof anchor === 'function' ? anchor : undefined;
  const anchorFnCallback = useStableCallback(anchorFn);
  const anchorDep = anchorFn ? anchorFnCallback : anchor;
  const anchorValueRef = useValueAsRef(anchor);
  const mountedRef = useValueAsRef(mounted);

  const direction = useDirection();
  const isRtl = direction === 'rtl';

  const side =
    mountSide ||
    (
      {
        top: 'top',
        right: 'right',
        bottom: 'bottom',
        left: 'left',
        'inline-end': isRtl ? 'left' : 'right',
        'inline-start': isRtl ? 'right' : 'left',
      } satisfies Record<Side, PhysicalSide>
    )[sideParam];

  const placement = align === 'center' ? side : (`${side}-${align}` as Placement);

  let collisionPadding = collisionPaddingParam as {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  // Create a bias to the preferred side.
  // On iOS, when the mobile software keyboard opens, the input is exactly centered
  // in the viewport, but this can cause it to flip to the top undesirably.
  const bias = 1;
  const biasTop = sideParam === 'bottom' ? bias : 0;
  const biasBottom = sideParam === 'top' ? bias : 0;
  const biasLeft = sideParam === 'right' ? bias : 0;
  const biasRight = sideParam === 'left' ? bias : 0;

  if (typeof collisionPadding === 'number') {
    collisionPadding = {
      top: collisionPadding + biasTop,
      right: collisionPadding + biasRight,
      bottom: collisionPadding + biasBottom,
      left: collisionPadding + biasLeft,
    };
  } else if (collisionPadding) {
    collisionPadding = {
      top: (collisionPadding.top || 0) + biasTop,
      right: (collisionPadding.right || 0) + biasRight,
      bottom: (collisionPadding.bottom || 0) + biasBottom,
      left: (collisionPadding.left || 0) + biasLeft,
    };
  }

  const commonCollisionProps = {
    boundary: collisionBoundary === 'clipping-ancestors' ? 'clippingAncestors' : collisionBoundary,
    padding: collisionPadding,
  } as const;

  // Using a ref assumes that the arrow element is always present in the DOM for the lifetime of the
  // popup. If this assumption ends up being false, we can switch to state to manage the arrow's
  // presence.
  const arrowRef = React.useRef<Element | null>(null);

  // Keep these reactive if they're not functions
  const sideOffsetRef = useValueAsRef(sideOffset);
  const alignOffsetRef = useValueAsRef(alignOffset);
  const sideOffsetDep = typeof sideOffset !== 'function' ? sideOffset : 0;
  const alignOffsetDep = typeof alignOffset !== 'function' ? alignOffset : 0;

  const middleware: UseFloatingOptions['middleware'] = [];

  if (inlineMiddleware) {
    middleware.push(inlineMiddleware);
  }

  middleware.push(
    offset(
      (state) => {
        const data = getOffsetData(state, sideParam, isRtl);

        const sideAxis =
          typeof sideOffsetRef.current === 'function'
            ? sideOffsetRef.current(data)
            : sideOffsetRef.current;
        const alignAxis =
          typeof alignOffsetRef.current === 'function'
            ? alignOffsetRef.current(data)
            : alignOffsetRef.current;

        return {
          mainAxis: sideAxis,
          crossAxis: alignAxis,
          alignmentAxis: alignAxis,
        };
      },
      [sideOffsetDep, alignOffsetDep, isRtl, sideParam],
    ),
  );

  const shiftDisabled = collisionAvoidanceAlign === 'none' && collisionAvoidanceSide !== 'shift';
  const crossAxisShiftEnabled =
    !shiftDisabled && (sticky || shiftCrossAxis || collisionAvoidanceSide === 'shift');

  const flipMiddleware =
    collisionAvoidanceSide === 'none'
      ? null
      : flip({
          ...commonCollisionProps,
          // Ensure the popup flips if it's been limited by its --available-height and it resizes.
          // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
          padding: {
            top: collisionPadding.top + bias,
            right: collisionPadding.right + bias,
            bottom: collisionPadding.bottom + bias,
            left: collisionPadding.left + bias,
          },
          mainAxis: !shiftCrossAxis && collisionAvoidanceSide === 'flip',
          crossAxis: collisionAvoidanceAlign === 'flip' ? 'alignment' : false,
          fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide,
        });
  const shiftMiddleware = shiftDisabled
    ? null
    : shift(
        (data) => {
          const html = ownerDocument(data.elements.floating).documentElement;
          return {
            ...commonCollisionProps,
            // Use the Layout Viewport to avoid shifting around when pinch-zooming
            // for context menus.
            rootBoundary: shiftCrossAxis
              ? { x: 0, y: 0, width: html.clientWidth, height: html.clientHeight }
              : undefined,
            mainAxis: collisionAvoidanceAlign !== 'none',
            crossAxis: crossAxisShiftEnabled,
            limiter:
              sticky || shiftCrossAxis
                ? undefined
                : limitShift((limitData) => {
                    if (!arrowRef.current) {
                      return {};
                    }
                    const { width, height } = arrowRef.current.getBoundingClientRect();
                    const sideAxis = getSideAxis(getSide(limitData.placement));
                    const arrowSize = sideAxis === 'y' ? width : height;
                    const offsetAmount =
                      sideAxis === 'y'
                        ? collisionPadding.left + collisionPadding.right
                        : collisionPadding.top + collisionPadding.bottom;
                    return {
                      offset: arrowSize / 2 + offsetAmount / 2,
                    };
                  }),
          };
        },
        [commonCollisionProps, sticky, shiftCrossAxis, collisionPadding, collisionAvoidanceAlign],
      );

  // https://floating-ui.com/docs/flip#combining-with-shift
  if (
    collisionAvoidanceSide === 'shift' ||
    collisionAvoidanceAlign === 'shift' ||
    align === 'center'
  ) {
    middleware.push(shiftMiddleware, flipMiddleware);
  } else {
    middleware.push(flipMiddleware, shiftMiddleware);
  }

  middleware.push(
    size({
      ...commonCollisionProps,
      apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
        if (!mountedRef.current) {
          return;
        }

        const floatingStyle = floating.style;
        floatingStyle.setProperty('--available-width', `${availableWidth}px`);
        floatingStyle.setProperty('--available-height', `${availableHeight}px`);

        // Snap anchor dimensions to device pixels to ensure the popup's visual width matches the anchor's one.
        const dpr = ownerWindow(floating).devicePixelRatio || 1;
        const { x, y, width, height } = rects.reference;
        const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
        const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;

        floatingStyle.setProperty('--anchor-width', `${anchorWidth}px`);
        floatingStyle.setProperty('--anchor-height', `${anchorHeight}px`);
      },
    }),
    arrow(
      (state) => ({
        // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
        // we'll create a fake element.
        element: arrowRef.current || ownerDocument(state.elements.floating).createElement('div'),
        padding: arrowPadding,
        offsetParent: 'floating',
      }),
      [arrowPadding],
    ),
    {
      name: 'transformOrigin',
      fn(state) {
        const { elements, middlewareData, placement: renderedPlacement, rects, y } = state;

        const currentRenderedSide = getSide(renderedPlacement);
        const currentRenderedAxis = getSideAxis(currentRenderedSide);
        const arrowEl = arrowRef.current;
        const arrowX = middlewareData.arrow?.x || 0;
        const arrowY = middlewareData.arrow?.y || 0;
        const arrowWidth = arrowEl?.clientWidth || 0;
        const arrowHeight = arrowEl?.clientHeight || 0;
        const transformX = arrowX + arrowWidth / 2;
        const transformY = arrowY + arrowHeight / 2;
        const shiftY = Math.abs(middlewareData.shift?.y || 0);
        const halfAnchorHeight = rects.reference.height / 2;
        const sideOffsetValue =
          typeof sideOffset === 'function'
            ? sideOffset(getOffsetData(state, sideParam, isRtl))
            : sideOffset;
        const isOverlappingAnchor = shiftY > sideOffsetValue;

        const adjacentTransformOrigin = {
          top: `${transformX}px calc(100% + ${sideOffsetValue}px)`,
          bottom: `${transformX}px ${-sideOffsetValue}px`,
          left: `calc(100% + ${sideOffsetValue}px) ${transformY}px`,
          right: `${-sideOffsetValue}px ${transformY}px`,
        }[currentRenderedSide];
        const overlapTransformOrigin = `${transformX}px ${rects.reference.y + halfAnchorHeight - y}px`;

        elements.floating.style.setProperty(
          '--transform-origin',
          crossAxisShiftEnabled && currentRenderedAxis === 'y' && isOverlappingAnchor
            ? overlapTransformOrigin
            : adjacentTransformOrigin,
        );

        return {};
      },
    },
    hide,
    adaptiveOrigin,
  );

  useIsoLayoutEffect(() => {
    // Ensure positioning doesn't run initially for `keepMounted` elements that
    // aren't initially open.
    if (!mounted && floatingRootContext) {
      floatingRootContext.update({
        referenceElement: null,
        floatingElement: null,
        domReferenceElement: null,
        positionReference: null,
      });
    }
  }, [mounted, floatingRootContext]);

  const autoUpdateOptions: AutoUpdateOptions = React.useMemo(
    () => ({
      elementResize: !disableAnchorTracking && typeof ResizeObserver !== 'undefined',
      layoutShift: !disableAnchorTracking && typeof IntersectionObserver !== 'undefined',
    }),
    [disableAnchorTracking],
  );

  const {
    refs,
    elements,
    x,
    y,
    middlewareData,
    update,
    placement: renderedPlacement,
    context,
    isPositioned,
    floatingStyles: originalFloatingStyles,
  } = useFloating({
    rootContext: floatingRootContext,
    open: keepMounted ? mounted : undefined,
    placement,
    middleware,
    strategy: positionMethod,
    whileElementsMounted: keepMounted
      ? undefined
      : (...args) => autoUpdate(...args, autoUpdateOptions),
    nodeId,
    externalTree,
  });

  const { sideX, sideY } = middlewareData.adaptiveOrigin || DEFAULT_SIDES;

  // Default to `fixed` when not positioned to prevent `autoFocus` scroll jumps.
  // This ensures the popup is inside the viewport initially before it gets positioned.
  const resolvedPosition: 'absolute' | 'fixed' = isPositioned ? positionMethod : 'fixed';

  const floatingStyles = React.useMemo<React.CSSProperties>(() => {
    const base = adaptiveOrigin
      ? { position: resolvedPosition, [sideX]: x, [sideY]: y }
      : { position: resolvedPosition, ...originalFloatingStyles };
    if (!isPositioned) {
      base.opacity = 0;
    }
    return base;
  }, [adaptiveOrigin, resolvedPosition, sideX, x, sideY, y, originalFloatingStyles, isPositioned]);

  const registeredPositionReferenceRef = React.useRef<Element | VirtualElement | null>(null);

  useIsoLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    const anchorValue = anchorValueRef.current;
    const resolvedAnchor = typeof anchorValue === 'function' ? anchorValue() : anchorValue;
    const unwrappedElement =
      (isRef(resolvedAnchor) ? resolvedAnchor.current : resolvedAnchor) || null;
    const finalAnchor = unwrappedElement || null;

    if (finalAnchor !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(finalAnchor);
      registeredPositionReferenceRef.current = finalAnchor;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);

  React.useEffect(() => {
    if (!mounted) {
      return;
    }

    const anchorValue = anchorValueRef.current;

    // Refs from parent components are set after useLayoutEffect runs and are available in useEffect.
    // Therefore, if the anchor is a ref, we need to update the position reference in useEffect.
    if (typeof anchorValue === 'function') {
      return;
    }

    if (isRef(anchorValue) && anchorValue.current !== registeredPositionReferenceRef.current) {
      refs.setPositionReference(anchorValue.current);
      registeredPositionReferenceRef.current = anchorValue.current;
    }
  }, [mounted, refs, anchorDep, anchorValueRef]);

  React.useEffect(() => {
    if (keepMounted && mounted && elements.reference && elements.floating) {
      return autoUpdate(elements.reference, elements.floating, update, autoUpdateOptions);
    }
    return undefined;
  }, [keepMounted, mounted, elements, update, autoUpdateOptions]);

  const renderedSide = getSide(renderedPlacement);
  const logicalRenderedSide = getLogicalSide(sideParam, renderedSide, isRtl);
  const renderedAlign = getAlignment(renderedPlacement) || 'center';
  const anchorHidden = Boolean(middlewareData.hide?.referenceHidden);

  // Locks the flip (makes it "sticky") so it doesn't prefer a given placement
  // and flips back lazily, not eagerly. Ideal for filtered lists that change
  // the size of the popup dynamically to avoid unwanted flipping when typing.
  useIsoLayoutEffect(() => {
    if (lazyFlip && mounted && isPositioned) {
      setMountSide(renderedSide);
    }
  }, [lazyFlip, mounted, isPositioned, renderedSide]);

  const arrowStyles = React.useMemo(
    () => ({
      position: 'absolute' as const,
      top: middlewareData.arrow?.y,
      left: middlewareData.arrow?.x,
    }),
    [middlewareData.arrow],
  );

  const arrowUncentered = middlewareData.arrow?.centerOffset !== 0;

  return React.useMemo(
    () => ({
      positionerStyles: floatingStyles,
      arrowStyles,
      arrowRef,
      arrowUncentered,
      side: logicalRenderedSide,
      align: renderedAlign,
      physicalSide: renderedSide,
      anchorHidden,
      refs,
      context,
      isPositioned,
      update,
    }),
    [
      floatingStyles,
      arrowStyles,
      arrowRef,
      arrowUncentered,
      logicalRenderedSide,
      renderedAlign,
      renderedSide,
      anchorHidden,
      refs,
      context,
      isPositioned,
      update,
    ],
  );
}

function isRef(
  param: Element | VirtualElement | React.RefObject<any> | null | undefined,
): param is React.RefObject<any> {
  return param != null && 'current' in param;
}

export interface UseAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   */
  anchor?:
    | Element
    | null
    | VirtualElement
    | React.RefObject<Element | null>
    | (() => Element | VirtualElement | null)
    | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: 'absolute' | 'fixed' | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   sideOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.height
   *       : anchor.width;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: number | OffsetFunction | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   alignOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.width
   *       : anchor.height;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: number | OffsetFunction | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   * Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * `side` controls overflow on the preferred placement axis (`top`/`bottom` or `left`/`right`):
   * - `'flip'`: keep the requested side when it fits; otherwise try the opposite side
   *   (`top` and `bottom`, or `left` and `right`).
   * - `'shift'`: never change side; keep the requested side and move the popup within
   *   the clipping boundary so it stays visible.
   * - `'none'`: do not correct side-axis overflow.
   *
   * `align` controls overflow on the alignment axis (`start`/`center`/`end`):
   * - `'flip'`: keep side, but swap `start` and `end` when the requested alignment overflows.
   * - `'shift'`: keep side and requested alignment, then nudge the popup along the
   *   alignment axis to fit.
   * - `'none'`: do not correct alignment-axis overflow.
   *
   * `fallbackAxisSide` controls fallback behavior on the perpendicular axis when the
   * preferred axis cannot fit:
   * - `'start'`: allow perpendicular fallback and try the logical start side first
   *   (`top` before `bottom`, or `left` before `right` in LTR).
   * - `'end'`: allow perpendicular fallback and try the logical end side first
   *   (`bottom` before `top`, or `right` before `left` in LTR).
   * - `'none'`: do not fallback to the perpendicular axis.
   *
   * When `side` is `'shift'`, explicitly setting `align` only supports `'shift'` or `'none'`.
   * If `align` is omitted, it defaults to `'flip'`.
   *
   * @example
   * ```jsx
   * <Positioner
   *   collisionAvoidance={{
   *     side: 'shift',
   *     align: 'shift',
   *     fallbackAxisSide: 'none',
   *   }}
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export interface UseAnchorPositioningParameters extends UseAnchorPositioningSharedParameters {
  keepMounted?: boolean | undefined;
  floatingRootContext?: FloatingRootContext | undefined;
  mounted: boolean;
  disableAnchorTracking: boolean;
  nodeId?: string | undefined;
  adaptiveOrigin?: Middleware | undefined;
  collisionAvoidance: CollisionAvoidance;
  shiftCrossAxis?: boolean | undefined;
  lazyFlip?: boolean | undefined;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Optional middleware that can replace the measured reference rect before offsets and collision
   * middleware run. Used by Preview Card to position against a specific inline line box.
   */
  inline?: Middleware | undefined;
}

export interface UseAnchorPositioningReturnValue {
  positionerStyles: React.CSSProperties;
  arrowStyles: React.CSSProperties;
  arrowRef: React.RefObject<Element | null>;
  arrowUncentered: boolean;
  side: Side;
  align: Align;
  physicalSide: PhysicalSide;
  anchorHidden: boolean;
  refs: ReturnType<typeof useFloating>['refs'];
  context: FloatingContext;
  isPositioned: boolean;
  update: () => void;
}
