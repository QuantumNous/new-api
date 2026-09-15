'use client';
import * as React from 'react';
import { useTimeout, Timeout } from '@base-ui/utils/useTimeout';
import { useIsoLayoutEffect } from '@base-ui/utils/useIsoLayoutEffect';

import { getDelay } from '../hooks/useHoverShared';
import type { FloatingRootContext, Delay, FloatingContext } from '../types';
import {
  BaseUIChangeEventDetails,
  createChangeEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';

interface ContextValue {
  hasProvider: boolean;
  timeoutMs: number;
  delayRef: React.RefObject<Delay>;
  initialDelayRef: React.RefObject<Delay>;
  timeout: Timeout;
  currentIdRef: React.RefObject<any>;
  currentContextRef: React.RefObject<{
    onOpenChange: (open: boolean, eventDetails: BaseUIChangeEventDetails<any>) => void;
    setIsInstantPhase: (value: boolean) => void;
  } | null>;
}

const FloatingDelayGroupContext = React.createContext<ContextValue>({
  hasProvider: false,
  timeoutMs: 0,
  delayRef: { current: 0 },
  initialDelayRef: { current: 0 },
  timeout: new Timeout(),
  currentIdRef: { current: null },
  currentContextRef: { current: null },
});

function resetDelayRef(delayRef: React.RefObject<Delay>, initialDelayRef: React.RefObject<Delay>) {
  delayRef.current = initialDelayRef.current;
}

export interface FloatingDelayGroupProps {
  children?: React.ReactNode;
  /**
   * The delay to use for the group when it's not in the instant phase.
   */
  delay: Delay;
  /**
   * An optional explicit timeout to use for the group, which represents when
   * grouping logic will no longer be active after the close delay completes.
   * This is useful if you want grouping to “last” longer than the close delay,
   * for example if there is no close delay at all.
   */
  timeoutMs?: number | undefined;
}

/**
 * Experimental next version of `FloatingDelayGroup` to become the default
 * in the future. This component is not yet stable.
 * Provides context for a group of floating elements that should share a
 * `delay`. Unlike `FloatingDelayGroup`, `useDelayGroup` with this
 * component does not cause a re-render of unrelated consumers of the
 * context when the delay changes.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function FloatingDelayGroup(props: FloatingDelayGroupProps): React.JSX.Element {
  const { children, delay, timeoutMs = 0 } = props;

  const delayRef = React.useRef(delay);
  const initialDelayRef = React.useRef(delay);
  const currentIdRef = React.useRef<string | null>(null);
  const currentContextRef = React.useRef(null);
  const timeout = useTimeout();

  useIsoLayoutEffect(() => {
    initialDelayRef.current = delay;

    if (!currentIdRef.current) {
      delayRef.current = delay;
      return;
    }

    delayRef.current = {
      open: getDelay(delayRef.current, 'open'),
      close: getDelay(delay, 'close'),
    };
  }, [delay, currentIdRef, delayRef, initialDelayRef]);

  return (
    <FloatingDelayGroupContext.Provider
      value={React.useMemo(
        () => ({
          hasProvider: true,
          delayRef,
          initialDelayRef,
          currentIdRef,
          timeoutMs,
          currentContextRef,
          timeout,
        }),
        [timeoutMs, timeout],
      )}
    >
      {children}
    </FloatingDelayGroupContext.Provider>
  );
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger this hook is used in has opened the tooltip.
   */
  open: boolean;
}

interface UseDelayGroupReturn {
  /**
   * The delay reference object.
   */
  delayRef: React.RefObject<Delay>;
  /**
   * Whether animations should be removed.
   */
  isInstantPhase: boolean;
  /**
   * Whether a `<FloatingDelayGroup>` provider is present.
   */
  hasProvider: boolean;
}

/**
 * Enables grouping when called inside a component that's a child of a
 * `FloatingDelayGroup`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(
  context: FloatingRootContext | FloatingContext,
  options: UseDelayGroupOptions = { open: false },
): UseDelayGroupReturn {
  const { open } = options;

  const store = 'rootStore' in context ? context.rootStore : context;
  const floatingId = store.useState('floatingId');

  const groupContext = React.useContext(FloatingDelayGroupContext);
  const {
    currentIdRef,
    delayRef,
    timeoutMs,
    initialDelayRef,
    currentContextRef,
    hasProvider,
    timeout,
  } = groupContext;

  const [isInstantPhase, setIsInstantPhase] = React.useState(false);
  const openRef = React.useRef(open);
  const isUnmountedRef = React.useRef(false);

  useIsoLayoutEffect(() => {
    openRef.current = open;
  }, [open]);

  useIsoLayoutEffect(() => {
    return () => {
      isUnmountedRef.current = true;
    };
  }, []);

  useIsoLayoutEffect(() => {
    function unset() {
      if (!isUnmountedRef.current) {
        setIsInstantPhase(false);
      }
      currentContextRef.current?.setIsInstantPhase(false);
      currentIdRef.current = null;
      currentContextRef.current = null;
      delayRef.current = initialDelayRef.current;
      timeout.clear();
    }

    if (!currentIdRef.current) {
      return undefined;
    }

    if (!open && currentIdRef.current === floatingId) {
      setIsInstantPhase(false);

      if (timeoutMs) {
        const closingId = floatingId;
        timeout.start(timeoutMs, () => {
          // If another tooltip has taken over the group, skip resetting.
          if (
            store.select('open') ||
            (currentIdRef.current && currentIdRef.current !== closingId)
          ) {
            return;
          }
          unset();
        });
        return () => {
          if (openRef.current || currentIdRef.current !== closingId) {
            timeout.clear();
          }
        };
      }

      unset();
    }

    return undefined;
  }, [
    open,
    floatingId,
    currentIdRef,
    delayRef,
    timeoutMs,
    initialDelayRef,
    currentContextRef,
    timeout,
    store,
  ]);

  useIsoLayoutEffect(() => {
    if (!open) {
      return;
    }

    const prevContext = currentContextRef.current;
    const prevId = currentIdRef.current;

    // A new tooltip is opening, so cancel any pending timeout that would reset
    // the group's delay back to the initial value.
    timeout.clear();
    currentContextRef.current = { onOpenChange: store.setOpen, setIsInstantPhase };
    currentIdRef.current = floatingId;
    delayRef.current = {
      open: 0,
      close: getDelay(initialDelayRef.current, 'close'),
    };

    if (prevId !== null && prevId !== floatingId) {
      setIsInstantPhase(true);
      prevContext?.setIsInstantPhase(true);
      prevContext?.onOpenChange(false, createChangeEventDetails(REASONS.none));
    } else {
      setIsInstantPhase(false);
      prevContext?.setIsInstantPhase(false);
    }
  }, [
    open,
    floatingId,
    store,
    currentIdRef,
    delayRef,
    initialDelayRef,
    currentContextRef,
    timeout,
  ]);

  useIsoLayoutEffect(() => {
    return () => {
      if (currentIdRef.current === floatingId) {
        currentContextRef.current = null;

        if (!openRef.current) {
          return;
        }

        currentIdRef.current = null;
        resetDelayRef(delayRef, initialDelayRef);
        timeout.clear();
      }
    };
  }, [currentContextRef, currentIdRef, delayRef, floatingId, initialDelayRef, timeout]);

  return React.useMemo(
    () => ({
      hasProvider,
      delayRef,
      isInstantPhase,
    }),
    [hasProvider, delayRef, isInstantPhase],
  );
}
