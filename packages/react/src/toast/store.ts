import { ReactStore, createSelector } from '@base-ui/utils/store';
import { generateId } from '@base-ui/utils/generateId';
import { ownerDocument } from '@base-ui/utils/owner';
import { Timeout } from '@base-ui/utils/useTimeout';
import {
  ToastManagerAddOptions,
  ToastManagerPromiseOptions,
  ToastManagerUpdateOptions,
  ToastObject,
} from './useToastManager';
import { resolvePromiseOptions } from './utils/resolvePromiseOptions';
import { activeElement, contains, getTarget } from '../floating-ui-react/utils';
import { isFocusVisible } from './utils/focusVisible';

type ToastInternalUpdateOptions<Data extends object> = Partial<Omit<ToastObject<Data>, 'id'>>;
type UpdateToastBehavior = {
  resetTimer?: boolean | undefined;
  markUpdated?: boolean | undefined;
};
type RemoveToastBehavior = {
  skipOnRemove?: boolean | undefined;
};

export type State = {
  toasts: ToastObject<any>[];
  toastMetadata: Map<string, ToastMetadata>;
  hovering: boolean;
  focused: boolean;
  timeout: number;
  limit: number;
  isWindowFocused: boolean;
  viewport: HTMLElement | null;
  prevFocusElement: HTMLElement | null;
};

type ToastMetadata = {
  value: ToastObject<any>;
  domIndex: number;
  visibleIndex: number;
  offsetY: number;
};

type InitialState = Omit<State, 'toastMetadata'>;

function createToastMetadata(toasts: ToastObject<any>[]) {
  const metadata = new Map<string, ToastMetadata>();
  let visibleIndex = 0;
  let offsetY = 0;

  toasts.forEach((toast, toastIndex) => {
    const isEnding = toast.transitionStatus === 'ending';
    metadata.set(toast.id, {
      value: toast,
      domIndex: toastIndex,
      visibleIndex: isEnding ? -1 : visibleIndex,
      offsetY,
    });

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });

  return metadata;
}

// Marks the active (non-ending) toasts beyond `limit` as limited. Callers pass
// toasts in newest-first order, so the newest `limit` toasts stay visible and
// the rest are flagged. Returns the same toast reference when its `limited`
// flag is unchanged to avoid unnecessary re-renders.
function applyLimited(toasts: ToastObject<any>[], limit: number): ToastObject<any>[] {
  let activeIndex = 0;
  return toasts.map((toast) => {
    if (toast.transitionStatus === 'ending') {
      return toast;
    }
    const limited = activeIndex >= limit;
    activeIndex += 1;
    return toast.limited === limited ? toast : { ...toast, limited };
  });
}

const toastMetadataSelector = (state: State) => state.toastMetadata;

export const selectors = {
  toasts: createSelector((state: State) => state.toasts),
  isEmpty: createSelector((state: State) => state.toasts.length === 0),
  toast: createSelector(
    toastMetadataSelector,
    (toastMetadata, id: string) => toastMetadata.get(id)?.value,
  ),
  toastIndex: createSelector(
    toastMetadataSelector,
    (toastMetadata, id: string) => toastMetadata.get(id)?.domIndex ?? -1,
  ),
  toastOffsetY: createSelector(
    toastMetadataSelector,
    (toastMetadata, id: string) => toastMetadata.get(id)?.offsetY ?? 0,
  ),
  toastVisibleIndex: createSelector(
    toastMetadataSelector,
    (toastMetadata, id: string) => toastMetadata.get(id)?.visibleIndex ?? -1,
  ),
  hovering: createSelector((state: State) => state.hovering),
  focused: createSelector((state: State) => state.focused),
  expanded: createSelector((state: State) => state.hovering || state.focused),
  expandedOrOutOfFocus: createSelector(
    (state: State) => state.hovering || state.focused || !state.isWindowFocused,
  ),
  prevFocusElement: createSelector((state: State) => state.prevFocusElement),
};

export class ToastStore extends ReactStore<State, {}, typeof selectors> {
  private timers = new Map<string, TimerInfo>();

  private areTimersPaused = false;

  constructor(initialState: InitialState) {
    super(
      {
        ...initialState,
        toastMetadata: createToastMetadata(initialState.toasts),
      },
      {},
      selectors,
    );
  }

  setFocused(focused: boolean) {
    this.set('focused', focused);
  }

  setHovering(hovering: boolean) {
    this.set('hovering', hovering);
  }

  setIsWindowFocused(isWindowFocused: boolean) {
    this.set('isWindowFocused', isWindowFocused);
  }

  setPrevFocusElement(prevFocusElement: HTMLElement | null) {
    this.set('prevFocusElement', prevFocusElement);
  }

  setViewport = (viewport: HTMLElement | null) => {
    this.set('viewport', viewport);
  };

  syncProviderProps(props: Pick<State, 'timeout' | 'limit'>) {
    const limitChanged = this.state.limit !== props.limit;

    if (this.state.timeout === props.timeout && !limitChanged) {
      return;
    }

    const updates: Partial<State> = {
      timeout: props.timeout,
      limit: props.limit,
    };

    if (limitChanged) {
      const newToasts = applyLimited(this.state.toasts, props.limit);
      updates.toasts = newToasts;
      updates.toastMetadata = createToastMetadata(newToasts);
    }

    this.update(updates);
  }

  disposeEffect = () => {
    return () => {
      this.timers.forEach((timer) => {
        timer.timeout?.clear();
      });
      this.timers.clear();
    };
  };

  removeToast(toastId: string, behavior: RemoveToastBehavior = {}) {
    const index = selectors.toastIndex(this.state, toastId);
    if (index === -1) {
      return;
    }

    const toast = this.state.toasts[index];
    if (!behavior.skipOnRemove) {
      toast?.onRemove?.();
    }

    const newToasts = [...this.state.toasts];
    newToasts.splice(index, 1);
    this.setToasts(newToasts);
  }

  addToast = <Data extends object>(toast: ToastManagerAddOptions<Data>): string => {
    const { timeout, limit } = this.state;
    const id = toast.id || generateId('toast');

    if (toast.id) {
      const existingToast = selectors.toast(this.state, toast.id);

      if (existingToast) {
        if (existingToast.transitionStatus === 'ending') {
          this.removeToast(toast.id, { skipOnRemove: true });
        } else {
          const { id: ignoredId, transitionStatus: ignoredTransitionStatus, ...updates } = toast;
          this.updateToastInternal(toast.id, updates, {
            resetTimer: true,
            markUpdated: true,
          });
          return toast.id;
        }
      }
    }

    const toastToAdd: ToastObject<Data> = {
      ...toast,
      id,
      updateKey: 0,
      transitionStatus: 'starting',
    };

    const updatedToasts = [toastToAdd, ...this.state.toasts];
    this.setToasts(applyLimited(updatedToasts, limit));

    const duration = toastToAdd.timeout ?? timeout;
    if (toastToAdd.type !== 'loading' && duration > 0) {
      this.scheduleTimer(id, duration, () => this.closeToast(id));
    }

    if (selectors.expandedOrOutOfFocus(this.state)) {
      this.pauseTimers();
    }

    return id;
  };

  updateToast = <Data extends object>(id: string, updates: ToastManagerUpdateOptions<Data>) => {
    this.updateToastInternal(id, updates, { markUpdated: true });
  };

  updateToastInternal = <Data extends object>(
    id: string,
    updates: ToastInternalUpdateOptions<Data>,
    behavior: UpdateToastBehavior = {},
  ) => {
    const { timeout, toasts } = this.state;
    const prevToast = selectors.toast(this.state, id) ?? null;
    if (!prevToast) {
      return;
    }

    // Ignore updates for toasts that are already closing.
    // This prevents races where async updates (e.g. promise success/error)
    // can block a dismissal from completing.
    if (prevToast.transitionStatus === 'ending') {
      return;
    }

    const nextToast: ToastObject<Data> = {
      ...prevToast,
      ...updates,
      ...(behavior.markUpdated && {
        updateKey: (prevToast.updateKey ?? 0) + 1,
      }),
    };

    this.setToasts(toasts.map((toast) => (toast.id === id ? nextToast : toast)));

    const nextTimeout = nextToast.timeout ?? timeout;
    const prevTimeout = prevToast?.timeout ?? timeout;

    const timeoutUpdated = Object.hasOwn(updates, 'timeout');

    const shouldHaveTimer =
      nextToast.transitionStatus !== 'ending' && nextToast.type !== 'loading' && nextTimeout > 0;

    const hasTimer = this.timers.has(id);
    const timeoutChanged = prevTimeout !== nextTimeout;
    const wasLoading = prevToast?.type === 'loading';

    if (!shouldHaveTimer && hasTimer) {
      this.clearTimer(id);
      return;
    }

    // Schedule or reschedule timer if needed
    if (
      shouldHaveTimer &&
      (!hasTimer || timeoutChanged || timeoutUpdated || wasLoading || behavior.resetTimer)
    ) {
      this.clearTimer(id);

      this.scheduleTimer(id, nextTimeout, () => this.closeToast(id));

      if (selectors.expandedOrOutOfFocus(this.state)) {
        this.pauseTimers();
      }
    }
  };

  closeToast = (toastId?: string) => {
    const closeAll = toastId === undefined;
    const { limit, toasts } = this.state;
    let toastsToClose: ToastObject<any>[];

    if (closeAll) {
      toastsToClose = toasts;
      this.clearTimers();
    } else {
      const toast = selectors.toast(this.state, toastId);
      if (!toast) {
        return;
      }
      toastsToClose = [toast];
      this.clearTimer(toastId);
    }

    const endingToasts = toasts.map((item) =>
      closeAll || item.id === toastId
        ? { ...item, transitionStatus: 'ending' as const, height: 0 }
        : item,
    );
    const newToasts = applyLimited(endingToasts, limit);

    const updates: Partial<State> = {
      toasts: newToasts,
      toastMetadata: createToastMetadata(newToasts),
    };
    const hasActiveToasts = newToasts.some((toast) => toast.transitionStatus !== 'ending');
    if (!hasActiveToasts) {
      updates.hovering = false;
      updates.focused = false;
    }
    this.update(updates);

    toastsToClose.forEach((toast) => {
      if (toast.transitionStatus !== 'ending') {
        toast.onClose?.();
      }
    });

    this.handleFocusManagement(toastId);
  };

  promiseToast = <Value, Data extends object>(
    promiseValue: Promise<Value>,
    options: ToastManagerPromiseOptions<Value, Data>,
  ): Promise<Value> => {
    // Create a loading toast (which does not auto-dismiss).
    const loadingOptions = resolvePromiseOptions(options.loading);
    const id = this.addToast({
      ...loadingOptions,
      type: 'loading',
    });

    const handledPromise = promiseValue
      .then((result: Value) => {
        const successOptions = resolvePromiseOptions(options.success, result);
        this.updateToast(id, {
          ...successOptions,
          type: 'success',
          timeout: successOptions.timeout,
        });

        return result;
      })
      .catch((error) => {
        const errorOptions = resolvePromiseOptions(options.error, error);
        this.updateToast(id, {
          ...errorOptions,
          type: 'error',
          timeout: errorOptions.timeout,
        });

        return Promise.reject(error);
      });

    // Private API used exclusively by `Manager` to handoff the promise
    // back to the manager after it's handled here.
    if ({}.hasOwnProperty.call(options, 'setPromise')) {
      (options as any).setPromise(handledPromise);
    }

    return handledPromise;
  };

  pauseTimers() {
    if (this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = true;
    this.timers.forEach((timer) => {
      if (timer.timeout) {
        timer.timeout.clear();
        const elapsed = Date.now() - timer.start;
        const remaining = timer.delay - elapsed;
        timer.remaining = remaining > 0 ? remaining : 0;
      }
    });
  }

  resumeTimers() {
    if (!this.areTimersPaused) {
      return;
    }
    this.areTimersPaused = false;
    this.timers.forEach((timer, id) => {
      timer.remaining = timer.remaining > 0 ? timer.remaining : timer.delay;
      timer.timeout ??= Timeout.create();
      timer.timeout.start(timer.remaining, () => {
        this.handleTimerFired(id);
        timer.callback();
      });
      timer.start = Date.now();
    });
  }

  restoreFocusToPrevElement() {
    this.state.prevFocusElement?.focus({ preventScroll: true });
  }

  handleDocumentPointerDown = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    const target = getTarget(event) as Element | null;
    if (contains(this.state.viewport, target)) {
      return;
    }

    // This is explicit touch activity outside the viewport, so the paused
    // interaction state should end even if the window focus state is unchanged.
    this.resumeTimers();
    this.update({ hovering: false, focused: false });
  };

  private scheduleTimer(id: string, delay: number, callback: () => void) {
    const start = Date.now();
    const shouldStartActive = !selectors.expandedOrOutOfFocus(this.state);
    const currentTimeout = shouldStartActive ? Timeout.create() : undefined;

    currentTimeout?.start(delay, () => {
      this.handleTimerFired(id);
      callback();
    });

    this.timers.set(id, {
      timeout: currentTimeout,
      start: shouldStartActive ? start : 0,
      delay,
      remaining: delay,
      callback,
    });
  }

  private clearTimers() {
    this.timers.forEach((timer) => {
      timer.timeout?.clear();
    });
    this.timers.clear();
    this.areTimersPaused = false;
  }

  private clearTimer(id: string) {
    const timer = this.timers.get(id);
    timer?.timeout?.clear();
    this.timers.delete(id);

    this.resetPausedStateIfNoTimersRemain();
  }

  private handleTimerFired(id: string) {
    this.timers.delete(id);
    this.resetPausedStateIfNoTimersRemain();
  }

  private resetPausedStateIfNoTimersRemain() {
    if (this.timers.size === 0) {
      // No timers remain to keep paused; clear the flag so a fresh toast's
      // running timer can be paused again on hover/focus.
      this.areTimersPaused = false;
    }
  }

  private setToasts(newToasts: ToastObject<any>[]) {
    const updates: Partial<State> = {
      toasts: newToasts,
      toastMetadata: createToastMetadata(newToasts),
    };
    if (newToasts.length === 0) {
      updates.hovering = false;
      updates.focused = false;
    }
    this.update(updates);
  }

  private handleFocusManagement(toastId: string | undefined) {
    const activeEl = activeElement(ownerDocument(this.state.viewport));
    if (
      !this.state.viewport ||
      !contains(this.state.viewport, activeEl) ||
      !isFocusVisible(activeEl)
    ) {
      return;
    }

    if (toastId === undefined) {
      this.restoreFocusToPrevElement();
      return;
    }

    const toasts = selectors.toasts(this.state);
    const currentIndex = selectors.toastIndex(this.state, toastId);
    let nextToast: ToastObject<any> | null = null;

    // Try to find the next toast that isn't animating out
    let index = currentIndex + 1;
    while (index < toasts.length) {
      if (toasts[index].transitionStatus !== 'ending') {
        nextToast = toasts[index];
        break;
      }
      index += 1;
    }

    // Go backwards if no next toast is found
    if (!nextToast) {
      index = currentIndex - 1;
      while (index >= 0) {
        if (toasts[index].transitionStatus !== 'ending') {
          nextToast = toasts[index];
          break;
        }
        index -= 1;
      }
    }

    if (nextToast) {
      nextToast.ref?.current?.focus();
    } else {
      this.restoreFocusToPrevElement();
    }
  }
}

interface TimerInfo {
  timeout?: Timeout | undefined;
  start: number;
  delay: number;
  remaining: number;
  callback: () => void;
}
