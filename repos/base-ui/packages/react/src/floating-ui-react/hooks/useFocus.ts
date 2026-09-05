'use client';
import * as React from 'react';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { platform } from '@base-ui/utils/platform';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument } from '@base-ui/utils/owner';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { getWindow, isElement, isHTMLElement } from '@floating-ui/utils/dom';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { createAttribute } from '../utils/createAttribute';
import {
  activeElement,
  contains,
  getTarget,
  isTargetInsideEnabledTrigger,
  isTypeableElement,
  matchesFocusVisible,
} from '../utils/element';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import { FloatingUIOpenChangeDetails } from '../../internals/types';

const isMacSafari = platform.os.mac && platform.engine.webkit;

export interface UseFocusProps {
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * Waits for the specified time before opening.
   * @default undefined
   */
  delay?: number | (() => number | undefined) | undefined;
}

/**
 * Opens the floating element while the reference element has focus, like CSS
 * `:focus`.
 * @see https://floating-ui.com/docs/useFocus
 */
export function useFocus(
  context: FloatingRootContext | FloatingContext,
  props: UseFocusProps = {},
): ElementProps {
  const { enabled = true, delay } = props;

  const store = 'rootStore' in context ? context.rootStore : context;

  const { events, dataRef } = store.context;

  const blockFocusRef = React.useRef(false);
  // Track which reference should be blocked from re-opening after Escape/press dismissal.
  const blockedReferenceRef = React.useRef<Element | null>(null);
  const keyboardModalityRef = React.useRef(true);

  const timeout = useTimeout();

  React.useEffect(() => {
    const domReference = store.select('domReferenceElement');

    if (!enabled) {
      return undefined;
    }

    const win = getWindow(domReference);

    // If the reference was focused and the user left the tab/window, and the
    // floating element was not open, the focus should be blocked when they
    // return to the tab/window.
    function onBlur() {
      const currentDomReference = store.select('domReferenceElement');
      if (
        !store.select('open') &&
        isHTMLElement(currentDomReference) &&
        currentDomReference === activeElement(ownerDocument(currentDomReference))
      ) {
        blockFocusRef.current = true;
      }
    }

    function onKeyDown() {
      keyboardModalityRef.current = true;
    }

    function onPointerDown() {
      keyboardModalityRef.current = false;
    }

    return mergeCleanups(
      addEventListener(win, 'blur', onBlur),
      isMacSafari && addEventListener(win, 'keydown', onKeyDown, true),
      isMacSafari && addEventListener(win, 'pointerdown', onPointerDown, true),
    );
  }, [store, enabled]);

  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
      if (details.reason === REASONS.triggerPress || details.reason === REASONS.escapeKey) {
        const referenceElement = store.select('domReferenceElement');
        if (isElement(referenceElement)) {
          blockedReferenceRef.current = referenceElement;
          blockFocusRef.current = true;
        }
      }
    }

    events.on('openchange', onOpenChangeLocal);
    return () => {
      events.off('openchange', onOpenChangeLocal);
    };
  }, [events, enabled, store]);

  const reference: ElementProps['reference'] = React.useMemo(() => {
    function resetBlockedFocus() {
      blockFocusRef.current = false;
      blockedReferenceRef.current = null;
    }

    return {
      onMouseLeave() {
        resetBlockedFocus();
      },
      onFocus(event) {
        const focusTarget = event.currentTarget as Element;

        if (blockFocusRef.current) {
          if (blockedReferenceRef.current === focusTarget) {
            return;
          }

          resetBlockedFocus();
        }

        const target = getTarget(event.nativeEvent);

        if (isElement(target)) {
          // Safari fails to match `:focus-visible` if focus was initially
          // outside the document.
          if (isMacSafari && !event.relatedTarget) {
            if (!keyboardModalityRef.current && !isTypeableElement(target)) {
              return;
            }
          } else if (!matchesFocusVisible(target)) {
            return;
          }
        }

        const movedFromOtherEnabledTrigger = isTargetInsideEnabledTrigger(
          event.relatedTarget,
          store.context.triggerElements,
        );

        const { nativeEvent, currentTarget } = event;
        const delayValue = typeof delay === 'function' ? delay() : delay;

        if (
          (store.select('open') && movedFromOtherEnabledTrigger) ||
          delayValue === 0 ||
          delayValue === undefined
        ) {
          store.setOpen(
            true,
            createChangeEventDetails(
              REASONS.triggerFocus,
              nativeEvent,
              currentTarget as HTMLElement,
            ),
          );
          return;
        }

        timeout.start(delayValue, () => {
          if (blockFocusRef.current) {
            return;
          }

          store.setOpen(
            true,
            createChangeEventDetails(
              REASONS.triggerFocus,
              nativeEvent,
              currentTarget as HTMLElement,
            ),
          );
        });
      },
      onBlur(event) {
        resetBlockedFocus();

        const relatedTarget = event.relatedTarget;
        const nativeEvent = event.nativeEvent;

        // Hit the non-modal focus management portal guard. Focus will be
        // moved into the floating element immediately after.
        const movedToFocusGuard =
          isElement(relatedTarget) &&
          relatedTarget.hasAttribute(createAttribute('focus-guard')) &&
          relatedTarget.getAttribute('data-type') === 'outside';

        // Wait for the window blur listener to fire.
        timeout.start(0, () => {
          const domReference = store.select('domReferenceElement');
          const activeEl = activeElement(ownerDocument(domReference));

          // Focus left the page, keep it open.
          if (!relatedTarget && activeEl === domReference) {
            return;
          }

          // When focusing the reference element (e.g. regular click), then
          // clicking into the floating element, prevent it from hiding.
          // Note: it must be focusable, e.g. `tabindex="-1"`.
          // We can not rely on relatedTarget to point to the correct element
          // as it will only point to the shadow host of the newly focused element
          // and not the element that actually has received focus if it is located
          // inside a shadow root.
          if (
            contains(dataRef.current.floatingContext?.refs.floating.current, activeEl) ||
            contains(domReference, activeEl) ||
            movedToFocusGuard
          ) {
            return;
          }

          // If the next focused element is one of the triggers, do not close
          // the floating element. The focus handler of that trigger will
          // handle the open state.
          const nextFocusedElement = relatedTarget ?? activeEl;
          if (isTargetInsideEnabledTrigger(nextFocusedElement, store.context.triggerElements)) {
            return;
          }

          store.setOpen(false, createChangeEventDetails(REASONS.triggerFocus, nativeEvent));
        });
      },
    };
  }, [dataRef, delay, store, timeout]);

  return React.useMemo(
    () => (enabled ? { reference, trigger: reference } : {}),
    [enabled, reference],
  );
}
