'use client';
import * as React from 'react';
import { isElement } from '@floating-ui/utils/dom';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { useAnimationFrame } from '@base-ui/utils/useAnimationFrame';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useValueAsRef } from '@base-ui/utils/useValueAsRef';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils';
import type { Coords } from '../../floating-ui-react/types';
import { clamp } from '../../internals/clamp';
import type { BaseUIComponentProps } from '../../internals/types';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { useRenderElement } from '../../internals/useRenderElement';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import type { SliderRootState } from '../root/SliderRoot';
import { getMidpoint } from '../utils/getMidpoint';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return {
      start: 0,
      end: 0,
    };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start: parseSize(styles[`border${start}Width`]) + parseSize(styles[`padding${start}`]),
    end: parseSize(styles[`border${end}Width`]) + parseSize(styles[`padding${end}`]),
  };
}

function getFingerCoords(
  event: TouchEvent | PointerEvent | React.PointerEvent,
  touchIdRef: React.RefObject<number | null>,
): Coords | null {
  // The event is TouchEvent
  if (touchIdRef.current != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchIdRef.current) {
        return {
          x: touch.clientX,
          y: touch.clientY,
        };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return {
    x: (event as PointerEvent).clientX,
    y: (event as PointerEvent).clientY,
  };
}

/**
 * The clickable, interactive part of the slider.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Slider](https://base-ui.com/react/components/slider)
 */
export const SliderControl = React.forwardRef(function SliderControl(
  componentProps: SliderControl.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render: renderProp, className, style, ...elementProps } = componentProps;

  const {
    disabled,
    dragging,
    inset,
    lastChangeReasonRef,
    max,
    min,
    minStepsBetweenValues,
    onValueCommitted,
    orientation,
    pressedInputRef,
    pressedThumbCenterOffsetRef,
    pressedThumbIndexRef,
    pressedValuesRef,
    registerFieldControlRef,
    renderBeforeHydration,
    setActive,
    setDragging,
    setValue,
    state,
    step,
    thumbCollisionBehavior,
    thumbRefs,
    values,
  } = useSliderRootContext();

  const direction = useDirection();
  const range = values.length > 1;
  const vertical = orientation === 'vertical';

  const controlRef = React.useRef<HTMLElement>(null);
  const stylesRef = React.useRef<CSSStyleDeclaration>(null);
  const setStylesRef = useStableCallback((element: HTMLElement | null) => {
    if (element && stylesRef.current == null) {
      stylesRef.current = ownerWindow(element).getComputedStyle(element);
    }
  });

  // A number that uniquely identifies the current finger in the touch session.
  const touchIdRef = React.useRef<number>(null);
  // The number of touch/pointermove events that have fired.
  const moveCountRef = React.useRef(0);
  // The offset amount to each side of the control for inset sliders.
  // This value should be equal to the radius or half the width/height of the thumb.
  const insetThumbOffsetRef = React.useRef(0);
  const currentInteractionValueRef = React.useRef<number | number[] | null>(null);
  const latestValuesRef = useValueAsRef(values);

  function updatePressedThumb(nextIndex: number) {
    if (pressedThumbIndexRef.current !== nextIndex) {
      pressedThumbIndexRef.current = nextIndex;
    }

    const thumbElement = thumbRefs.current[nextIndex];

    if (!thumbElement) {
      pressedThumbCenterOffsetRef.current = null;
      pressedInputRef.current = null;
      return;
    }

    pressedInputRef.current = thumbElement.querySelector<HTMLInputElement>('input[type="range"]');
  }

  function resetPressedThumb() {
    pressedThumbIndexRef.current = -1;
    pressedThumbCenterOffsetRef.current = null;
    pressedInputRef.current = null;
  }

  function isTargetDisabledThumb(target: EventTarget | null) {
    if (!isElement(target)) {
      return false;
    }

    return thumbRefs.current.some((thumbEl) => {
      if (!isElement(thumbEl) || !contains(thumbEl, target)) {
        return false;
      }

      return thumbEl.querySelector<HTMLInputElement>('input[type="range"]')?.disabled === true;
    });
  }

  function getFingerState(fingerCoords: Coords): FingerState | null {
    const control = controlRef.current;
    const thumbIndex = pressedThumbIndexRef.current;

    if (!control || (!range && (thumbIndex < 0 || thumbIndex >= values.length))) {
      return null;
    }

    const { width, height, bottom, left, right } = control.getBoundingClientRect();

    const controlOffset = getControlOffset(stylesRef.current, vertical);
    const insetThumbOffset = insetThumbOffsetRef.current;
    const controlSize =
      (vertical ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffset * 2;
    const thumbCenterOffset = pressedThumbCenterOffsetRef.current ?? 0;
    const fingerX = fingerCoords.x - thumbCenterOffset;
    const fingerY = fingerCoords.y - thumbCenterOffset;

    const valueSize = vertical
      ? bottom - fingerY - controlOffset.end
      : (direction === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
    // the value at the finger origin scaled down to fit the range [0, 1]
    const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

    let newValue = (max - min) * valueRescaled + min;
    newValue = roundValueToStep(newValue, step, min);
    newValue = clamp(newValue, min, max);

    if (!range) {
      return {
        value: newValue,
        thumbIndex,
        didSwap: false,
      };
    }

    if (thumbIndex < 0) {
      return null;
    }

    const collisionResult = resolveThumbCollision({
      behavior: thumbCollisionBehavior,
      values,
      currentValues: latestValuesRef.current ?? values,
      initialValues: pressedValuesRef.current,
      pressedIndex: thumbIndex,
      nextValue: newValue,
      min,
      max,
      step,
      minStepsBetweenValues,
    });

    return collisionResult;
  }

  function startPressing(fingerCoords: Coords) {
    pressedValuesRef.current = range ? values.slice() : null;
    currentInteractionValueRef.current = null;
    latestValuesRef.current = values;

    const pressedThumbIndex = pressedThumbIndexRef.current;
    let closestThumbIndex = pressedThumbIndex;

    if (pressedThumbIndex > -1 && pressedThumbIndex < values.length) {
      if (values[pressedThumbIndex] === max) {
        let candidateIndex = pressedThumbIndex;

        while (candidateIndex > 0 && values[candidateIndex - 1] === max) {
          candidateIndex -= 1;
        }

        closestThumbIndex = candidateIndex;
      }
    } else {
      // pressed on control
      const axis = !vertical ? 'x' : 'y';
      let minDistance: number | undefined;

      closestThumbIndex = -1;

      for (let i = 0; i < thumbRefs.current.length; i += 1) {
        const thumbEl = thumbRefs.current[i];
        if (
          isElement(thumbEl) &&
          !thumbEl.querySelector<HTMLInputElement>('input[type="range"]')?.disabled
        ) {
          const midpoint = getMidpoint(thumbEl);
          const distance = Math.abs(fingerCoords[axis] - midpoint[axis]);

          if (minDistance === undefined || distance <= minDistance) {
            closestThumbIndex = i;
            minDistance = distance;
          }
        }
      }
    }

    if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
      updatePressedThumb(closestThumbIndex);
    }

    if (inset) {
      const thumbEl = thumbRefs.current[closestThumbIndex];
      if (isElement(thumbEl)) {
        const thumbRect = thumbEl.getBoundingClientRect();
        const side = !vertical ? 'width' : 'height';
        insetThumbOffsetRef.current = thumbRect[side] / 2;
      }
    }
  }

  function focusThumb(thumbIndex: number) {
    const input =
      thumbRefs.current?.[thumbIndex]?.querySelector<HTMLInputElement>('input[type="range"]');
    if (!input) {
      return;
    }

    input.focus({
      preventScroll: true,
      // Prevent pointer-driven focus rings in browsers that support this option.
      // Supported in Chrome from 144+.
      focusVisible: false,
    });
  }

  function setValueFromPointer(
    finger: FingerState,
    reason: typeof REASONS.trackPress | typeof REASONS.drag,
    nativeEvent: TouchEvent | PointerEvent,
  ) {
    const applied = setValue(
      finger.value,
      createChangeEventDetails(reason, nativeEvent, undefined, {
        activeThumbIndex: finger.thumbIndex,
      }),
    );

    if (applied) {
      currentInteractionValueRef.current = finger.value;
      latestValuesRef.current = Array.isArray(finger.value) ? finger.value : [finger.value];

      // Only track the swapped thumb once the change is actually applied so a
      // canceled swap doesn't leak the new index into subsequent moves.
      if (finger.didSwap) {
        updatePressedThumb(finger.thumbIndex);
      }
    }

    return applied;
  }

  const handleTouchMove = useStableCallback((nativeEvent: TouchEvent | PointerEvent) => {
    const fingerCoords = getFingerCoords(nativeEvent, touchIdRef);

    if (fingerCoords == null) {
      return;
    }

    moveCountRef.current += 1;

    // Cancel move in case some other element consumed a pointerup event and it was not fired.
    if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      handleTouchEnd(nativeEvent);
      return;
    }

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    if (validateMinimumDistance(finger.value, step, minStepsBetweenValues)) {
      if (!dragging && moveCountRef.current > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
        setDragging(true);
      }

      const applied = setValueFromPointer(finger, REASONS.drag, nativeEvent);

      if (applied && finger.didSwap) {
        focusThumb(finger.thumbIndex);
      }
    }
  });

  const handleTouchEnd = useStableCallback((nativeEvent: TouchEvent | PointerEvent) => {
    setActive(-1);
    setDragging(false);

    pressedInputRef.current = null;
    pressedThumbCenterOffsetRef.current = null;

    if (currentInteractionValueRef.current != null) {
      const commitReason = lastChangeReasonRef.current;
      onValueCommitted(
        currentInteractionValueRef.current,
        createGenericEventDetails(commitReason, nativeEvent),
      );
    }

    if (
      'pointerType' in nativeEvent &&
      controlRef.current?.hasPointerCapture(nativeEvent.pointerId)
    ) {
      controlRef.current?.releasePointerCapture(nativeEvent.pointerId);
    }

    pressedThumbIndexRef.current = -1;
    touchIdRef.current = null;
    pressedValuesRef.current = null;
    currentInteractionValueRef.current = null;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    stopListening();
  });

  const handleTouchStart = useStableCallback((nativeEvent: TouchEvent) => {
    if (disabled) {
      return;
    }

    if (isTargetDisabledThumb(getTarget(nativeEvent))) {
      resetPressedThumb();
      return;
    }

    const touch = nativeEvent.changedTouches[0];

    if (touch != null) {
      touchIdRef.current = touch.identifier;
    }

    const fingerCoords = getFingerCoords(nativeEvent, touchIdRef);

    if (fingerCoords != null) {
      startPressing(fingerCoords);

      const finger = getFingerState(fingerCoords);

      if (finger == null) {
        return;
      }

      focusThumb(finger.thumbIndex);
      const applied = setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

      if (applied && finger.didSwap) {
        focusThumb(finger.thumbIndex);
      }
    }

    moveCountRef.current = 0;
    const doc = ownerDocument(controlRef.current);
    doc.addEventListener('touchmove', handleTouchMove, { passive: true });
    doc.addEventListener('touchend', handleTouchEnd, { passive: true });
  });

  const stopListening = useStableCallback(() => {
    const doc = ownerDocument(controlRef.current);
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    pressedValuesRef.current = null;
    currentInteractionValueRef.current = null;
  });

  const focusFrame = useAnimationFrame();

  React.useEffect(() => {
    const control = controlRef.current;
    if (!control) {
      return () => stopListening();
    }

    const unsubscribeTouchStart = addEventListener(control, 'touchstart', handleTouchStart, {
      passive: true,
    });

    return () => {
      unsubscribeTouchStart();
      focusFrame.cancel();

      stopListening();
    };
  }, [stopListening, handleTouchStart, controlRef, focusFrame]);

  React.useEffect(() => {
    if (disabled) {
      stopListening();
    }
  }, [disabled, stopListening]);

  const element = useRenderElement('div', componentProps, {
    state,
    ref: [forwardedRef, registerFieldControlRef, controlRef, setStylesRef],
    props: [
      {
        ['data-base-ui-slider-control' as string]: renderBeforeHydration ? '' : undefined,
        onPointerDown(event) {
          const control = controlRef.current;
          const target = getTarget(event.nativeEvent);

          if (
            !control ||
            disabled ||
            event.defaultPrevented ||
            !isElement(target) ||
            // Only handle left clicks
            event.button !== 0
          ) {
            return;
          }

          if (isTargetDisabledThumb(target)) {
            resetPressedThumb();
            return;
          }

          const fingerCoords = getFingerCoords(event, touchIdRef);

          if (fingerCoords != null) {
            startPressing(fingerCoords);

            const finger = getFingerState(fingerCoords);

            if (finger == null) {
              return;
            }

            const pressedOnFocusedThumb = contains(
              thumbRefs.current[finger.thumbIndex],
              activeElement(ownerDocument(control)),
            );

            if (pressedOnFocusedThumb) {
              event.preventDefault();
            } else {
              focusFrame.request(() => {
                focusThumb(finger.thumbIndex);
              });
            }

            setDragging(true);

            const pressedOnAnyThumb = pressedThumbCenterOffsetRef.current != null;
            if (!pressedOnAnyThumb) {
              const applied = setValueFromPointer(finger, REASONS.trackPress, event.nativeEvent);

              if (applied && finger.didSwap) {
                focusThumb(finger.thumbIndex);
              }
            }
          }

          if (event.nativeEvent.pointerId) {
            control.setPointerCapture(event.nativeEvent.pointerId);
          }

          moveCountRef.current = 0;
          const doc = ownerDocument(controlRef.current);
          doc.addEventListener('pointermove', handleTouchMove, { passive: true });
          doc.addEventListener('pointerup', handleTouchEnd, { once: true });
        },
      },
      elementProps,
    ],
    stateAttributesMapping: sliderStateAttributesMapping,
  });

  return element;
});

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps extends BaseUIComponentProps<'div', SliderControlState> {}

export namespace SliderControl {
  export type State = SliderControlState;
  export type Props = SliderControlProps;
}
