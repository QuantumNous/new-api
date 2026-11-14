'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { useAnimationsFinished } from './useAnimationsFinished';

/**
 * Calls the provided function when the CSS open/close animation or transition completes.
 */
export function useOpenChangeComplete(parameters: UseOpenChangeCompleteParameters) {
  const { enabled = true, open, ref, onComplete: onCompleteParam } = parameters;

  const onComplete = useStableCallback(onCompleteParam);
  const runOnceAnimationsFinish = useAnimationsFinished(ref, open, false);

  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const abortController = new AbortController();

    runOnceAnimationsFinish(onComplete, abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [enabled, open, onComplete, runOnceAnimationsFinish]);
}

export interface UseOpenChangeCompleteParameters {
  /**
   * Whether the hook is enabled.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Whether the element is open.
   */
  open?: boolean | undefined;
  /**
   * Ref to the element being closed.
   */
  ref: React.RefObject<HTMLElement | null>;
  /**
   * Function to call when the animation completes (or there is no animation).
   */
  onComplete: () => void;
}

export interface UseOpenChangeCompleteState {}
