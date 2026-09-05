'use client';
import * as React from 'react';
import { useAnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { NOOP, EMPTY_OBJECT } from '@base-ui/utils/empty';
import { useAnimationsFinished } from '../internals/useAnimationsFinished';
import { getCssDimensions } from './getCssDimensions';
import { Dimensions } from '../floating-ui-react/types';
import { Side } from './useAnchorPositioning';

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 */
export function usePopupAutoResize(parameters: UsePopupAutoResizeParameters) {
  const {
    popupElement,
    positionerElement,
    content,
    mounted,
    onMeasureLayout: onMeasureLayoutParam,
    onMeasureLayoutComplete: onMeasureLayoutCompleteParam,
    side,
    direction,
  } = parameters;

  const runOnceAnimationsFinish = useAnimationsFinished(popupElement, true, false);

  const animationFrame = useAnimationFrame();

  const committedDimensionsRef = React.useRef<Dimensions | null>(null);
  const isInitialRenderRef = React.useRef(true);

  const restoreAnchoringStylesRef = React.useRef(NOOP);

  const onMeasureLayout = useStableCallback(onMeasureLayoutParam);
  const onMeasureLayoutComplete = useStableCallback(onMeasureLayoutCompleteParam);

  const anchoringStyles: React.CSSProperties = React.useMemo(() => {
    // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
    let isOriginSide = side === 'top';
    let isPhysicalLeft = side === 'left';
    if (direction === 'rtl') {
      isOriginSide = isOriginSide || side === 'inline-end';
      isPhysicalLeft = isPhysicalLeft || side === 'inline-end';
    } else {
      isOriginSide = isOriginSide || side === 'inline-start';
      isPhysicalLeft = isPhysicalLeft || side === 'inline-start';
    }

    return isOriginSide
      ? {
          position: 'absolute',
          [side === 'top' ? 'bottom' : 'top']: '0',
          [isPhysicalLeft ? 'right' : 'left']: '0',
        }
      : EMPTY_OBJECT;
  }, [side, direction]);

  useIsoLayoutEffect(() => {
    // Reset the state when the popup is closed.
    if (!mounted) {
      restoreAnchoringStylesRef.current = NOOP;
      isInitialRenderRef.current = true;
      committedDimensionsRef.current = null;
      return undefined;
    }

    if (!popupElement || !positionerElement) {
      return undefined;
    }

    restoreAnchoringStylesRef.current = applyElementStyles(
      popupElement,
      anchoringStyles as Record<string, string>,
    );

    // Measure the rendered size to enable transitions:
    setPopupCssSize(popupElement, 'auto');

    const restorePopupPosition = overrideElementStyle(popupElement, 'position', 'static');
    const restorePopupTransform = overrideElementStyle(popupElement, 'transform', 'none');
    const restorePopupScale = overrideElementStyle(popupElement, 'scale', '1');
    const restorePositionerAvailableSize = applyElementStyles(positionerElement, {
      '--available-width': 'max-content',
      '--available-height': 'max-content',
    });

    function restoreMeasurementOverrides() {
      restorePopupPosition();
      restorePopupTransform();
      restorePositionerAvailableSize();
    }

    function restoreMeasurementOverridesIncludingScale() {
      restoreMeasurementOverrides();
      restorePopupScale();
    }

    onMeasureLayout?.();

    // Initial render (for each time the popup opens).
    if (isInitialRenderRef.current || committedDimensionsRef.current === null) {
      setPositionerCssSize(positionerElement, 'max-content');

      const dimensions = getCssDimensions(popupElement);

      committedDimensionsRef.current = dimensions;

      setPositionerCssSize(positionerElement, dimensions);
      restoreMeasurementOverridesIncludingScale();
      onMeasureLayoutComplete?.(null, dimensions);

      isInitialRenderRef.current = false;

      return () => {
        restoreAnchoringStylesRef.current();
        restoreAnchoringStylesRef.current = NOOP;
      };
    }

    // Subsequent renders while open (when `content` changes).
    setPositionerCssSize(positionerElement, 'max-content');

    const previousDimensions = committedDimensionsRef.current;
    const newDimensions = getCssDimensions(popupElement);

    // Commit immediately so future content changes have a stable previous size.
    committedDimensionsRef.current = newDimensions;

    setPopupCssSize(popupElement, previousDimensions);
    restoreMeasurementOverridesIncludingScale();
    onMeasureLayoutComplete?.(previousDimensions, newDimensions);

    setPositionerCssSize(positionerElement, newDimensions);

    const abortController = new AbortController();

    animationFrame.request(() => {
      setPopupCssSize(popupElement, newDimensions);

      runOnceAnimationsFinish(() => {
        popupElement.style.setProperty('--popup-width', 'auto');
        popupElement.style.setProperty('--popup-height', 'auto');
      }, abortController.signal);
    });

    return () => {
      abortController.abort();
      animationFrame.cancel();
      restoreAnchoringStylesRef.current();
      restoreAnchoringStylesRef.current = NOOP;
    };
  }, [
    content,
    popupElement,
    positionerElement,
    runOnceAnimationsFinish,
    animationFrame,
    mounted,
    onMeasureLayout,
    onMeasureLayoutComplete,
    anchoringStyles,
  ]);
}

interface UsePopupAutoResizeParameters {
  /**
   * Element to resize.
   */
  popupElement: HTMLElement | null;
  /*
   * Positioner element (parent of the popup)
   */
  positionerElement: HTMLElement | null;
  /**
   * Whether the popup is mounted.
   */
  mounted: boolean;
  /*
   * Content that may change and trigger a resize.
   * This doesn't have to be the actual content of the popup, but a value that triggers a resize.
   */
  content: unknown;
  /**
   * Callback fired immediately before measuring the dimensions of the new content.
   */
  onMeasureLayout?: (() => void) | undefined;
  /**
   * Callback fired after the new dimensions have been measured.
   *
   * @param previousDimensions Dimensions before the change, or `null` if this is the first measurement.
   * @param newDimensions Newly measured dimensions.
   */
  onMeasureLayoutComplete?:
    | ((previousDimensions: Dimensions | null, newDimensions: Dimensions) => void)
    | undefined;

  side: Side;
  direction: 'ltr' | 'rtl';
}

function overrideElementStyle(element: HTMLElement, property: string, value: string) {
  const originalValue = element.style.getPropertyValue(property);
  element.style.setProperty(property, value);

  return () => {
    element.style.setProperty(property, originalValue);
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const restorers: Array<() => void> = [];

  for (const [key, value] of Object.entries(styles)) {
    restorers.push(overrideElementStyle(element, key, value));
  }

  return restorers.length
    ? () => {
        restorers.forEach((restore) => restore());
      }
    : NOOP;
}

function setPopupCssSize(popupElement: HTMLElement, size: Dimensions | 'auto') {
  const width = size === 'auto' ? 'auto' : `${size.width}px`;
  const height = size === 'auto' ? 'auto' : `${size.height}px`;
  popupElement.style.setProperty('--popup-width', width);
  popupElement.style.setProperty('--popup-height', height);
}

function setPositionerCssSize(positionerElement: HTMLElement, size: Dimensions | 'max-content') {
  const width = size === 'max-content' ? 'max-content' : `${size.width}px`;
  const height = size === 'max-content' ? 'max-content' : `${size.height}px`;
  positionerElement.style.setProperty('--positioner-width', width);
  positionerElement.style.setProperty('--positioner-height', height);
}
