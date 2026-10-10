'use client';
import * as React from 'react';
import { useStableCallback } from '@base-ui/utils/useStableCallback';
import { InteractionType, useEnhancedClickHandler } from '@base-ui/utils/useEnhancedClickHandler';
import { platform } from '@base-ui/utils/platform';
import { useValueChanged } from '../internals/useValueChanged';

export function useOpenMethodTriggerProps(
  open: boolean | (() => boolean),
  setOpenMethod: (interactionType: InteractionType | null) => void,
) {
  const handleTriggerClick = useStableCallback(
    (_: React.MouseEvent, interactionType: InteractionType) => {
      const isOpen = typeof open === 'function' ? open() : open;

      if (!isOpen) {
        setOpenMethod(
          interactionType ||
            // On iOS Safari, the hitslop around touch targets means tapping outside an element's
            // bounds does not fire `pointerdown` but does fire `mousedown`. The `interactionType`
            // will be "" in that case.
            (platform.os.ios ? 'touch' : ''),
        );
      }
    },
  );

  const { onClick, onPointerDown } = useEnhancedClickHandler(handleTriggerClick);

  return React.useMemo(
    () => ({
      onClick,
      onPointerDown,
    }),
    [onClick, onPointerDown],
  );
}

/**
 * Determines the interaction type (keyboard, mouse, touch, etc.) that opened the component.
 *
 * @param open The open state of the component.
 */
export function useOpenInteractionType(open: boolean) {
  const [openMethod, setOpenMethod] = React.useState<InteractionType | null>(null);

  const triggerProps = useOpenMethodTriggerProps(open, setOpenMethod);

  useValueChanged(open, (previousOpen) => {
    if (previousOpen && !open) {
      setOpenMethod(null);
    }
  });

  return React.useMemo(
    () => ({
      openMethod,
      triggerProps,
    }),
    [openMethod, triggerProps],
  );
}
