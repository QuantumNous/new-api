'use client';
import * as React from 'react';
import { addEventListener } from '@base-ui/utils/addEventListener';
import { mergeCleanups } from '@base-ui/utils/mergeCleanups';
import { ownerDocument, ownerWindow } from '@base-ui/utils/owner';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import { useTimeout } from '@base-ui/utils/useTimeout';
import { activeElement, contains, getTarget } from '../../floating-ui-react/utils';
import { FocusGuard } from '../../utils/FocusGuard';
import type { BaseUIComponentProps, HTMLProps } from '../../internals/types';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import { useRenderElement } from '../../internals/useRenderElement';
import { isFocusVisible } from '../utils/focusVisible';
import { ToastViewportCssVars } from './ToastViewportCssVars';

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export const ToastViewport = React.forwardRef(function ToastViewport(
  componentProps: ToastViewport.Props,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const { render, className, style, children, ...elementProps } = componentProps;

  const store = useToastProviderContext();
  const windowFocusTimeout = useTimeout();

  const handlingFocusGuardRef = React.useRef(false);
  const markedReadyForMouseLeaveRef = React.useRef(false);
  const touchActiveRef = React.useRef(false);

  const isEmpty = store.useState('isEmpty');
  const toasts = store.useState('toasts');
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');
  const prevFocusElement = store.useState('prevFocusElement');
  const frontmostHeight = toasts[0]?.height ?? 0;

  const hasTransitioningToasts = React.useMemo(
    () => toasts.some((toast) => toast.transitionStatus === 'ending'),
    [toasts],
  );
  const highPriorityToasts = React.useMemo(
    () => toasts.filter((toast) => toast.priority === 'high'),
    [toasts],
  );

  // Listen globally for F6 so we can force-focus the viewport.
  React.useEffect(() => {
    const viewport = store.state.viewport;
    if (!viewport) {
      return undefined;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (isEmpty) {
        return;
      }

      if (event.key === 'F6' && getTarget(event) !== viewport) {
        event.preventDefault();
        store.setPrevFocusElement(activeElement(ownerDocument(viewport)) as HTMLElement | null);
        viewport?.focus({ preventScroll: true });
        store.pauseTimers();
        store.setFocused(true);
      }
    }

    const win = ownerWindow(viewport);
    return addEventListener(win, 'keydown', handleGlobalKeyDown);
  }, [store, isEmpty]);

  React.useEffect(() => {
    const viewport = store.state.viewport;
    if (!viewport || isEmpty) {
      return undefined;
    }

    const win = ownerWindow(viewport);

    function handleWindowBlur(event: FocusEvent) {
      if (getTarget(event) !== win) {
        return;
      }

      store.setIsWindowFocused(false);
      store.pauseTimers();
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      const target = getTarget(event);
      const activeEl = activeElement(ownerDocument(viewport));
      if (
        target === win ||
        !contains(viewport, target as HTMLElement | null) ||
        !isFocusVisible(activeEl)
      ) {
        store.resumeTimers();
      }

      // Wait for the `handleFocus` event to fire.
      windowFocusTimeout.start(0, () => store.setIsWindowFocused(true));
    }

    return mergeCleanups(
      addEventListener(win, 'blur', handleWindowBlur, true),
      addEventListener(win, 'focus', handleWindowFocus, true),
    );
  }, [
    store,
    windowFocusTimeout,
    // `store.state.viewport` isn't available on the first render,
    // since the portal node hasn't yet been created.
    // By adding this dependency, we ensure the window listeners
    // are added when toasts have been created, once the ref is available.
    isEmpty,
  ]);

  React.useEffect(() => {
    const viewport = store.state.viewport;
    if (!viewport || isEmpty) {
      return undefined;
    }

    const doc = ownerDocument(viewport);
    return addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true);
  }, [isEmpty, store]);

  function handleFocusGuard(event: React.FocusEvent) {
    const viewport = store.state.viewport;
    if (!viewport) {
      return;
    }

    handlingFocusGuardRef.current = true;

    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    if (event.relatedTarget === viewport) {
      const firstFocusableToast = toasts.find(
        (toast) => toast.transitionStatus !== 'ending' && !toast.limited,
      );
      if (firstFocusableToast) {
        firstFocusableToast.ref?.current?.focus();
      } else {
        store.restoreFocusToPrevElement();
      }
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (
      event.key === 'Tab' &&
      event.shiftKey &&
      getTarget(event.nativeEvent) === store.state.viewport
    ) {
      event.preventDefault();
      store.restoreFocusToPrevElement();
      // Shift+Tab is explicit keyboard navigation out of the viewport.
      store.resumeTimers();
    }
  }

  function flushMouseLeave() {
    const hasEndingToasts = store.state.toasts.some((toast) => toast.transitionStatus === 'ending');

    if (hasEndingToasts || touchActiveRef.current || !markedReadyForMouseLeaveRef.current) {
      return;
    }

    // Once transitions have finished, see if a mouseleave was already triggered
    // but blocked from taking effect. If so, we can now safely collapse the viewport
    // without restarting timers while the window is blurred.
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
    store.setHovering(false);
    markedReadyForMouseLeaveRef.current = false;
  }

  React.useEffect(flushMouseLeave, [hasTransitioningToasts, store]);

  function handleMouseEnter() {
    store.pauseTimers();
    store.setHovering(true);
    markedReadyForMouseLeaveRef.current = false;
  }

  function resumeTimersIfWindowFocused() {
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
  }

  function handleMouseLeave() {
    const hasEndingToasts = store.state.toasts.some((toast) => toast.transitionStatus === 'ending');

    if (hasEndingToasts || touchActiveRef.current) {
      // When swiping to dismiss, wait until the transitions have settled
      // or the touch interaction ends to avoid collapsing mid-gesture.
      markedReadyForMouseLeaveRef.current = true;
    } else {
      resumeTimersIfWindowFocused();
      store.setHovering(false);
    }
  }

  function handlePointerDown(event: React.PointerEvent) {
    if (event.pointerType === 'touch') {
      touchActiveRef.current = true;
    }
  }

  function handlePointerEnd(event: React.PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }

    touchActiveRef.current = false;
    flushMouseLeave();
  }

  function handleFocus() {
    if (handlingFocusGuardRef.current) {
      handlingFocusGuardRef.current = false;
      return;
    }

    if (focused) {
      return;
    }

    // Only set focused when the active element is focus-visible.
    // This prevents the viewport from staying expanded when clicking inside without
    // keyboard navigation.
    if (isFocusVisible(activeElement(ownerDocument(store.state.viewport)))) {
      store.setFocused(true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: React.FocusEvent) {
    if (!focused || contains(store.state.viewport, event.relatedTarget as HTMLElement | null)) {
      return;
    }

    store.setFocused(false);
    resumeTimersIfWindowFocused();
  }

  const defaultProps: HTMLProps = {
    tabIndex: -1,
    role: 'region',
    'aria-live': 'polite',
    'aria-atomic': false,
    'aria-relevant': 'additions text',
    'aria-label': 'Notifications',
    onMouseEnter: handleMouseEnter,
    onMouseMove: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onClick: handleFocus,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerEnd,
  };

  const state: ToastViewportState = {
    expanded,
  };

  const element = useRenderElement('div', componentProps, {
    ref: [forwardedRef, store.setViewport],
    state,
    props: [
      defaultProps,
      {
        style: {
          [ToastViewportCssVars.frontmostHeight as string]: frontmostHeight
            ? `${frontmostHeight}px`
            : undefined,
        },
      },
      elementProps,
      {
        children: (
          <React.Fragment>
            {!isEmpty && prevFocusElement && <FocusGuard onFocus={handleFocusGuard} />}
            {children}
            {!isEmpty && prevFocusElement && <FocusGuard onFocus={handleFocusGuard} />}
          </React.Fragment>
        ),
      },
    ],
  });

  return (
    <React.Fragment>
      {!isEmpty && prevFocusElement && <FocusGuard onFocus={handleFocusGuard} />}
      {element}
      {!focused && highPriorityToasts.length > 0 && (
        <div style={visuallyHidden}>
          {highPriorityToasts.map((toast) => (
            <div key={toast.id} role="alert" aria-atomic>
              <div>{toast.title}</div>
              <div>{toast.description}</div>
            </div>
          ))}
        </div>
      )}
    </React.Fragment>
  );
});

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportProps extends BaseUIComponentProps<'div', ToastViewportState> {}

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}
