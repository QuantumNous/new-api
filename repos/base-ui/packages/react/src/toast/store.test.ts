import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastStore, selectors } from './store';
import type { ToastObject } from './useToastManager';

function createStore(toasts: ToastObject<any>[]) {
  return new ToastStore({
    toasts,
    timeout: 0,
    limit: 3,
    hovering: false,
    focused: false,
    isWindowFocused: true,
    viewport: null,
    prevFocusElement: null,
  });
}

function expectToastMetadataToMatchToasts(store: ToastStore) {
  let visibleIndex = 0;
  let offsetY = 0;

  store.state.toasts.forEach((toast, index) => {
    const isEnding = toast.transitionStatus === 'ending';

    expect(selectors.toast(store.state, toast.id)).toBe(toast);
    expect(selectors.toastIndex(store.state, toast.id)).toBe(index);
    expect(selectors.toastOffsetY(store.state, toast.id)).toBe(offsetY);
    expect(selectors.toastVisibleIndex(store.state, toast.id)).toBe(isEnding ? -1 : visibleIndex);

    offsetY += toast.height || 0;

    if (!isEnding) {
      visibleIndex += 1;
    }
  });
}

describe('ToastStore', () => {
  it('keeps toast metadata synchronized after mutations', () => {
    const store = createStore([
      { id: 'newest', height: 30 },
      { id: 'middle', height: 40 },
      { id: 'oldest', height: 50 },
    ]);

    expectToastMetadataToMatchToasts(store);

    store.updateToastInternal('middle', { height: 45 });

    expectToastMetadataToMatchToasts(store);

    store.closeToast('middle');

    expectToastMetadataToMatchToasts(store);
    expect(selectors.toast(store.state, 'middle')?.transitionStatus).toBe('ending');

    store.removeToast('middle', { skipOnRemove: true });

    expectToastMetadataToMatchToasts(store);

    store.addToast({ id: 'front', title: 'Front', timeout: 0 });

    expectToastMetadataToMatchToasts(store);
  });

  describe('limit', () => {
    it('recomputes limited flags when the limit changes', () => {
      // Ordered newest-first, matching how `addToast` prepends.
      const store = createStore([{ id: 'c' }, { id: 'b' }, { id: 'a' }]);

      store.syncProviderProps({ timeout: 0, limit: 1 });
      expect(selectors.toast(store.state, 'c')?.limited).toBe(false);
      expect(selectors.toast(store.state, 'b')?.limited).toBe(true);
      expect(selectors.toast(store.state, 'a')?.limited).toBe(true);

      store.syncProviderProps({ timeout: 0, limit: 3 });
      expect(selectors.toast(store.state, 'c')?.limited).toBe(false);
      expect(selectors.toast(store.state, 'b')?.limited).toBe(false);
      expect(selectors.toast(store.state, 'a')?.limited).toBe(false);
    });
  });

  describe('timer pausing', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('re-pauses timers after the last toast is closed and a new one is added', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      // Add a toast with a running timer, then pause it (as a hover would).
      store.addToast({ title: 'a', timeout: 100 });
      store.pauseTimers();

      // Closing the last toast must clear the internal "paused" flag, otherwise
      // the next toast's timer can never be paused again.
      store.closeToast(store.state.toasts[0].id);

      store.addToast({ title: 'b', timeout: 100 });
      const newToastId = store.state.toasts[0].id;

      // Hovering again should pause the new toast's timer.
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(selectors.toast(store.state, newToastId)?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after all toasts are closed and a new one is added', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();

      store.closeToast();

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(selectors.toast(store.state, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after the last active toast closes while ending toasts remain', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();

      store.closeToast('b');
      store.closeToast('a');

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(selectors.toast(store.state, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after the last timed toast closes while untimed toasts remain', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'loading', title: 'loading', type: 'loading' });
      store.addToast({ id: 'timed', title: 'timed', timeout: 100 });
      store.pauseTimers();

      store.closeToast('timed');

      store.addToast({ id: 'c', title: 'c', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(selectors.toast(store.state, 'c')?.transitionStatus).not.toBe('ending');
    });

    it('re-pauses timers after the last timed toast becomes untimed', () => {
      vi.useFakeTimers();
      const store = createStore([]);

      store.addToast({ id: 'a', title: 'a', timeout: 100 });
      store.pauseTimers();

      store.updateToastInternal('a', { timeout: 0 });

      store.addToast({ id: 'b', title: 'b', timeout: 100 });
      store.pauseTimers();
      vi.advanceTimersByTime(200);

      expect(selectors.toast(store.state, 'b')?.transitionStatus).not.toBe('ending');
    });
  });
});
