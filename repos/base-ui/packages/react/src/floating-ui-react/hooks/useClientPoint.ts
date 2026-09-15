'use client';
import * as React from 'react';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { getWindow } from '@floating-ui/utils/dom';
import type { ContextData, ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { contains, getTarget } from '../utils/element';
import { isMouseLikePointerType } from '../utils/event';

function createVirtualElement(
  domElement: Element | null | undefined,
  data: {
    axis: 'x' | 'y' | 'both';
    dataRef: React.RefObject<ContextData>;
    pointerType: string | undefined;
    x: number | null;
    y: number | null;
  },
) {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: domElement || undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() || {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      };

      const isXAxis = data.axis === 'x' || data.axis === 'both';
      const isYAxis = data.axis === 'y' || data.axis === 'both';
      const canTrackCursorOnAutoUpdate =
        ['mouseenter', 'mousemove'].includes(data.dataRef.current.openEvent?.type || '') &&
        data.pointerType !== 'touch';

      let width = domRect.width;
      let height = domRect.height;
      let x = domRect.x;
      let y = domRect.y;

      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }

      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;
      width = 0;
      height = 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        width = data.axis === 'y' ? domRect.width : 0;
        height = data.axis === 'x' ? domRect.height : 0;
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      } else if (isAutoUpdateEvent && !canTrackCursorOnAutoUpdate) {
        height = data.axis === 'x' ? domRect.height : height;
        width = data.axis === 'y' ? domRect.width : width;
      }

      isAutoUpdateEvent = true;

      return {
        width,
        height,
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
      };
    },
  };
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

export interface UseClientPointProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether to restrict the client point to an axis and use the reference
   * element (if it exists) as the other axis. This can be useful if the
   * floating element is also interactive.
   * @default 'both'
   */
  axis?: 'x' | 'y' | 'both' | undefined;
}

/**
 * Positions the floating element relative to a client point (in the viewport),
 * such as the mouse position. By default, it follows the mouse cursor.
 * @see https://floating-ui.com/docs/useClientPoint
 */
export function useClientPoint(
  context: FloatingRootContext | FloatingContext,
  props: UseClientPointProps = {},
): ElementProps {
  const { enabled = true, axis = 'both' } = props;

  const store = 'rootStore' in context ? context.rootStore : context;

  const open = store.useState('open');
  const floating = store.useState('floatingElement');
  const domReference = store.useState('domReferenceElement');

  const dataRef = store.context.dataRef;

  const initialRef = React.useRef(false);
  const cleanupListenerRef = React.useRef<null | (() => void)>(null);

  const [pointerType, setPointerType] = React.useState<string | undefined>();
  const [reactive, setReactive] = React.useState([]);

  const resetReference = useStableCallback((reference: Element | null) => {
    store.set('positionReference', reference);
  });

  const setReference = useStableCallback(
    (newX: number | null, newY: number | null, referenceElement?: Element | null) => {
      if (initialRef.current) {
        return;
      }

      // Prevent setting if the open event was not a mouse-like one
      // (e.g. focus to open, then hover over the reference element).
      // Only apply if the event exists.
      if (dataRef.current.openEvent && !isMouseBasedEvent(dataRef.current.openEvent)) {
        return;
      }

      store.set(
        'positionReference',
        createVirtualElement(referenceElement ?? domReference, {
          x: newX,
          y: newY,
          axis,
          dataRef,
          pointerType,
        }),
      );
    },
  );

  const handleReferenceEnterOrMove = useStableCallback((event: React.MouseEvent<Element>) => {
    if (!open) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    } else if (!cleanupListenerRef.current) {
      // If there's no cleanup, there's no listener, but we want to ensure
      // we add the listener if the cursor landed on the floating element and
      // then back on the reference (i.e. it's interactive).
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
      setReactive([]);
    }
  });

  // If the pointer is a mouse-like pointer, we want to continue following the
  // mouse even if the floating element is transitioning out. On touch
  // devices, this is undesirable because the floating element will move to
  // the dismissal touch point.
  const openCheck = isMouseLikePointerType(pointerType) ? floating : open;

  React.useEffect(() => {
    if (!enabled) {
      resetReference(domReference);
      return undefined;
    }

    if (!openCheck) {
      return undefined;
    }

    function cleanupListener() {
      cleanupListenerRef.current?.();
      cleanupListenerRef.current = null;
    }

    const win = getWindow(floating);

    function handleMouseMove(event: MouseEvent) {
      const target = getTarget(event) as Element | null;

      if (!contains(floating, target)) {
        setReference(event.clientX, event.clientY);
      } else {
        cleanupListener();
      }
    }

    if (!dataRef.current.openEvent || isMouseBasedEvent(dataRef.current.openEvent)) {
      cleanupListenerRef.current = addEventListener(win, 'mousemove', handleMouseMove);
    } else {
      resetReference(domReference);
    }

    return cleanupListener;
  }, [
    openCheck,
    enabled,
    floating,
    dataRef,
    domReference,
    store,
    setReference,
    resetReference,
    reactive,
  ]);

  // Clear virtual cursor references when the hook unmounts. Enabled flips are handled above.
  React.useEffect(
    () => () => {
      store.set('positionReference', null);
    },
    [store],
  );

  React.useEffect(() => {
    if (enabled && !floating) {
      initialRef.current = false;
    }
  }, [enabled, floating]);

  React.useEffect(() => {
    if (!enabled && open) {
      initialRef.current = true;
    }
  }, [enabled, open]);

  const reference: ElementProps['reference'] = React.useMemo(() => {
    function setPointerTypeRef(event: React.PointerEvent) {
      setPointerType(event.pointerType);
    }

    return {
      onPointerDown: setPointerTypeRef,
      onPointerEnter: setPointerTypeRef,
      onMouseMove: handleReferenceEnterOrMove,
      onMouseEnter: handleReferenceEnterOrMove,
    };
  }, [handleReferenceEnterOrMove]);

  return React.useMemo(
    () => (enabled ? { reference, trigger: reference } : {}),
    [enabled, reference],
  );
}
