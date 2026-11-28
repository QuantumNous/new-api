import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, flushMicrotasks, screen } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM } from '#test-utils';
import { useSwipeDismiss } from './useSwipeDismiss';

function SwipeBox() {
  const ref = React.useRef<HTMLDivElement>(null);
  const swipe = useSwipeDismiss({
    enabled: true,
    directions: ['down'],
    elementRef: ref,
    movementCssVars: { x: '--x', y: '--y' },
  });

  return (
    <div data-testid="el" ref={ref} style={swipe.getDragStyles()} {...swipe.getPointerProps()} />
  );
}

function SwipeProgressBox({ onProgress }: { onProgress: (progress: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const swipe = useSwipeDismiss({
    enabled: true,
    directions: ['right'],
    elementRef: ref,
    movementCssVars: { x: '--x', y: '--y' },
    onProgress,
  });

  return (
    <div
      data-testid="progress"
      ref={ref}
      style={swipe.getDragStyles()}
      {...swipe.getPointerProps()}
    />
  );
}

function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
  if (typeof Touch === 'function') {
    return new Touch({
      identifier: 1,
      target,
      ...point,
    });
  }

  return point;
}

describe('useSwipeDismiss', () => {
  beforeAll(function beforeHook() {
    // PointerEvent not fully implemented in jsdom, causing fireEvent.pointer* to ignore options.
    // https://github.com/jsdom/jsdom/issues/2527
    (window as any).PointerEvent = window.MouseEvent;
  });

  const { render } = createRenderer();

  it('does not start swiping within a scrollable element when ignoreScrollableAncestors is true', async () => {
    const onSwipeStart = vi.fn();

    function SwipeBoxScrollable() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipeDismiss = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        ignoreScrollableAncestors: true,
        onSwipeStart,
      });

      return (
        <div
          data-testid="root"
          ref={ref}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.getPointerProps()}
        >
          <div data-testid="scroll" style={{ overflowY: 'auto', height: 100 }}>
            <div style={{ height: 200 }} />
          </div>
        </div>
      );
    }

    await render(<SwipeBoxScrollable />);

    const root = screen.getByTestId('root');
    const scroll = screen.getByTestId('scroll') as HTMLDivElement;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    if (scroll.scrollHeight <= scroll.clientHeight) {
      const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
      if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'scrollHeight', { value: 200, configurable: true });
      }

      const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
      if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
        Object.defineProperty(scroll, 'clientHeight', { value: 100, configurable: true });
      }
    }

    try {
      fireEvent.pointerDown(scroll, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 100,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
      });

      await flushMicrotasks();

      fireEvent.pointerMove(scroll, {
        pointerId: 1,
        clientX: 0,
        clientY: 150,
        bubbles: true,
        movementX: 0,
        movementY: 50,
      });

      await flushMicrotasks();

      expect(onSwipeStart).not.toHaveBeenCalled();
      expect(root.style.getPropertyValue('--y')).toBe('0px');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not prevent touch scrolling during swipe interactions', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // First move establishes the baseline (iOS pointermove delay handling).
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Move up (unsupported) should not block the default touch scroll behavior.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 50,
      bubbles: true,
      movementX: 0,
      movementY: -50,
    });

    await flushMicrotasks();

    const touchMoveBefore = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveBefore);
    expect(touchMoveBefore.defaultPrevented).toBe(false);

    // Once a supported direction is detected, touchmove should still not be prevented.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 150,
      bubbles: true,
      movementX: 0,
      movementY: 100,
    });

    await flushMicrotasks();

    const touchMoveAfter = new Event('touchmove', { bubbles: true, cancelable: true });
    element.dispatchEvent(touchMoveAfter);
    expect(touchMoveAfter.defaultPrevented).toBe(false);
  });

  it('fires onProgress relative to the element size', async () => {
    const onProgress = vi.fn();
    await render(<SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
    }

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 50,
      clientY: 0,
      bubbles: true,
      movementX: 50,
      movementY: 0,
    });

    await flushMicrotasks();

    const progress = onProgress.mock.calls.at(-1)?.[0];
    expect(progress).toBeCloseTo(0.25, 2);
  });

  it('continues firing onProgress when swipe progress is clamped', async () => {
    const onProgress = vi.fn();
    await render(<SwipeProgressBox onProgress={onProgress} />);
    const element = screen.getByTestId('progress');

    const widthDescriptor = Object.getOwnPropertyDescriptor(element, 'offsetWidth');
    if (!widthDescriptor || widthDescriptor.configurable) {
      Object.defineProperty(element, 'offsetWidth', { value: 200, configurable: true });
    }

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Baseline move.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 50,
      clientY: 0,
      bubbles: true,
      movementX: 50,
      movementY: 0,
    });

    await flushMicrotasks();

    const callsAfterForward = onProgress.mock.calls.length;

    // Move past the starting point in the opposite direction; progress is clamped to 0.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: -10,
      clientY: 0,
      bubbles: true,
      movementX: -60,
      movementY: 0,
    });

    await flushMicrotasks();

    const callsAfterReverse = onProgress.mock.calls.length;
    expect(callsAfterReverse).toBeGreaterThan(callsAfterForward);

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: -20,
      clientY: 0,
      bubbles: true,
      movementX: -10,
      movementY: 0,
    });

    await flushMicrotasks();

    expect(onProgress.mock.calls.length).toBeGreaterThan(callsAfterReverse);
    expect(onProgress.mock.calls.at(-1)?.[0]).toBe(0);
  });

  it('applies exponential damping for opposite-direction movement', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();
    expect(element.style.transition).toBe('none');

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 50,
      bubbles: true,
      movementX: 0,
      movementY: -50,
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).not.toBe('0px');
  });

  it('preserves inline transform and transition when resetting drag styles', async () => {
    function SwipeBoxWithInlineStyles() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
      });

      return (
        <React.Fragment>
          <button type="button" onClick={swipe.reset}>
            Reset
          </button>
          <div
            data-testid="styled"
            ref={ref}
            style={{
              ...swipe.getDragStyles(),
              transform: 'scale(0.9)',
              transition: 'opacity 200ms ease',
            }}
            {...swipe.getPointerProps()}
          />
        </React.Fragment>
      );
    }

    await render(<SwipeBoxWithInlineStyles />);
    const element = screen.getByTestId('styled');
    const initialTransform = element.style.transform;
    const initialTransition = element.style.transition;

    async function moveTo(clientY: number, movementY: number) {
      fireEvent.pointerMove(element, {
        pointerId: 1,
        buttons: 1,
        clientX: 0,
        clientY,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY,
      });

      await flushMicrotasks();
    }

    expect(initialTransform).not.toBe('');
    expect(initialTransition).not.toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    await moveTo(0, 0);
    await moveTo(12, 12);
    await moveTo(16, 4);

    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 16,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(element.style.transform).toBe(initialTransform);
    expect(element.style.transition).toBe(initialTransition);
  });

  it('applies the drag transform imperatively while swiping', async () => {
    await render(<SwipeBox />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // The first move only establishes the drag baseline.
    fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 40,
    });

    await flushMicrotasks();

    expect(element.style.transition).toBe('none');
    expect(element.style.transform).toMatch(/translate3d\(0px, ?40px, ?0(?:px)?\)/);
    expect(element.style.getPropertyValue('--y')).toBe('40px');
  });

  it('respects custom swipeThreshold', async () => {
    const onDismiss = vi.fn();

    function SwipeBoxThreshold() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        swipeThreshold: 10,
        onDismiss,
      });

      return (
        <div
          data-testid="el"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxThreshold />);
    const element = screen.getByTestId('el');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Baseline move.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    // Move beyond the custom 10px threshold.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
      movementX: 0,
      movementY: 20,
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalled();
  });

  it('fires onSwipingChange on start and end', async () => {
    const onSwipingChange = vi.fn();

    function SwipeBoxSwipingChange() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return (
        <div
          data-testid="swiping"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxSwipingChange />);
    const element = screen.getByTestId('swiping');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
  });

  it('cancels pointer swipe when the primary mouse button is released without pointerup', async () => {
    const onDismiss = vi.fn();
    const onSwipingChange = vi.fn();

    function SwipeBoxPointerCancel() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onSwipingChange,
      });

      return (
        <div
          data-testid="pointer-cancel"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxPointerCancel />);
    const element = screen.getByTestId('pointer-cancel');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 12,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 12,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledWith(true);
    expect(element.style.getPropertyValue('--y')).not.toBe('0px');

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 16,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 4,
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 40,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 24,
    });

    await flushMicrotasks();

    expect(element.style.getPropertyValue('--y')).toBe('0px');
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('commits the swipe when the primary button is released past the threshold without pointerup', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();

    function SwipeBoxFlickRelease() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onCancel,
      });

      return (
        <div
          data-testid="flick-release"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxFlickRelease />);
    const element = screen.getByTestId('flick-release');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // First move establishes the start position; the second provides the displacement.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // On a fast trackpad flick the click releases just before pointerup, producing a trailing
    // `buttons: 0` pointermove. It must commit the gesture (past the threshold here), not cancel it.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('uses the final buttons:0 release move to decide dismissal when it crosses the threshold', async () => {
    const onDismiss = vi.fn();
    const onCancel = vi.fn();

    function SwipeBoxReleaseMove() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onDismiss,
        onCancel,
      });

      return (
        <div
          data-testid="release-move"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxReleaseMove />);
    const element = screen.getByTestId('release-move');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // Last pressed move stays just BELOW the 40px threshold.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 1,
      clientX: 0,
      clientY: 35,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    // The trailing `buttons: 0` release move is the one that carries the threshold-crossing
    // displacement; it must be applied before the release is decided.
    fireEvent.pointerMove(element, {
      pointerId: 1,
      buttons: 0,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });
    await flushMicrotasks();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('resets swiping when touch ends over a scrollable descendant', async () => {
    const onSwipingChange = vi.fn();

    function SwipeBoxTouchScrollableEnd() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipingChange,
      });

      return (
        <div
          data-testid="touch-root"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getTouchProps()}
        >
          <div data-testid="touch-scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
            <div style={{ height: 120 }} />
          </div>
        </div>
      );
    }

    await render(<SwipeBoxTouchScrollableEnd />);

    const root = screen.getByTestId('touch-root');
    const scroll = screen.getByTestId('touch-scroll');

    const scrollHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'scrollHeight');
    if (!scrollHeightDescriptor || scrollHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    }

    const clientHeightDescriptor = Object.getOwnPropertyDescriptor(scroll, 'clientHeight');
    if (!clientHeightDescriptor || clientHeightDescriptor.configurable) {
      Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    }

    fireEvent.touchStart(root, {
      touches: [
        createTouch(root, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    fireEvent.touchMove(root, {
      touches: [
        createTouch(root, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    fireEvent.touchEnd(scroll, {
      changedTouches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    expect(onSwipingChange).toHaveBeenCalledTimes(2);
    expect(onSwipingChange).toHaveBeenNthCalledWith(1, true);
    expect(onSwipingChange).toHaveBeenLastCalledWith(false);
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });

  it('allows onRelease to override dismissal', async () => {
    const onDismiss = vi.fn();
    const onRelease = vi.fn(() => false);

    function SwipeBoxReleaseOverride() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        swipeThreshold: 10,
        onDismiss,
        onRelease,
      });

      return (
        <div
          data-testid="release"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    await render(<SwipeBoxReleaseOverride />);
    const element = screen.getByTestId('release');

    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      bubbles: true,
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
      movementX: 0,
      movementY: 20,
    });

    await flushMicrotasks();

    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 0,
      clientY: 20,
      bubbles: true,
    });

    await flushMicrotasks();

    expect(onRelease).toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it.skipIf(!isJSDOM)('provides swipe velocity on release', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity');

      fireEvent.pointerDown(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1100));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1200));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        movementX: 50,
        movementY: 0,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1300));
      fireEvent.pointerUp(element, {
        pointerId: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        timeStamp: 1300,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.25, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.skipIf(!isJSDOM)('provides release velocity from the latest swipe movement', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity-latest"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-latest');

      fireEvent.pointerDown(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1100));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1100,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1200));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 50,
        clientY: 0,
        bubbles: true,
        movementX: 50,
        movementY: 0,
        timeStamp: 1200,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1216));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 70,
        clientY: 0,
        bubbles: true,
        movementX: 20,
        movementY: 0,
        timeStamp: 1216,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1224));
      fireEvent.pointerUp(element, {
        pointerId: 1,
        clientX: 70,
        clientY: 0,
        bubbles: true,
        timeStamp: 1224,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.releaseVelocityX).toBeCloseTo(1.25, 2);
      expect(details?.releaseVelocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it.skipIf(!isJSDOM)('clamps short swipe durations when computing velocity', async () => {
    const onRelease = vi.fn();

    function SwipeBoxReleaseVelocity() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipe = useSwipeDismiss({
        enabled: true,
        directions: ['right'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onRelease,
      });

      return (
        <div
          data-testid="release-velocity-short"
          ref={ref}
          style={swipe.getDragStyles()}
          {...swipe.getPointerProps()}
        />
      );
    }

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(1000));
      await render(<SwipeBoxReleaseVelocity />);
      const element = screen.getByTestId('release-velocity-short');

      fireEvent.pointerDown(element, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        pointerType: 'mouse',
        movementX: 0,
        movementY: 0,
        timeStamp: 1000,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1005));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        movementX: 0,
        movementY: 0,
        timeStamp: 1005,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1010));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 30,
        clientY: 0,
        bubbles: true,
        movementX: 30,
        movementY: 0,
        timeStamp: 1010,
      });

      await flushMicrotasks();

      vi.setSystemTime(new Date(1015));
      fireEvent.pointerUp(element, {
        pointerId: 1,
        clientX: 30,
        clientY: 0,
        bubbles: true,
        timeStamp: 1015,
      });

      await flushMicrotasks();

      const details = onRelease.mock.calls[0]?.[0];
      expect(details?.velocityX).toBeCloseTo(0.6, 2);
      expect(details?.velocityY).toBeCloseTo(0, 2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores pointer interactions that were default prevented', async () => {
    const onSwipeStart = vi.fn();

    function SwipeBoxWithPreventedChild() {
      const ref = React.useRef<HTMLDivElement>(null);
      const swipeDismiss = useSwipeDismiss({
        enabled: true,
        directions: ['down'],
        elementRef: ref,
        movementCssVars: { x: '--x', y: '--y' },
        onSwipeStart,
      });

      return (
        <div
          data-testid="root"
          ref={ref}
          style={swipeDismiss.getDragStyles()}
          {...swipeDismiss.getPointerProps()}
        >
          <div data-testid="child" onPointerDown={(event) => event.preventDefault()} />
        </div>
      );
    }

    await render(<SwipeBoxWithPreventedChild />);

    const root = screen.getByTestId('root');
    const child = screen.getByTestId('child');

    fireEvent.pointerDown(child, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 0,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
      movementX: 0,
      movementY: 0,
    });

    await flushMicrotasks();

    fireEvent.pointerMove(child, {
      pointerId: 1,
      clientX: 0,
      clientY: 150,
      bubbles: true,
      movementX: 0,
      movementY: 50,
    });

    await flushMicrotasks();

    expect(onSwipeStart).not.toHaveBeenCalled();
    expect(root.style.getPropertyValue('--y')).toBe('0px');
  });
});
