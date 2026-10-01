import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { Drawer } from '@base-ui/react/drawer';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM, waitSingleFrame } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { useDrawerRootContext } from './DrawerRootContext';

vi.mock('@base-ui/utils/platform', async () => {
  const actual =
    await vi.importActual<typeof import('@base-ui/utils/platform')>('@base-ui/utils/platform');
  return {
    ...actual,
    platform: {
      ...actual.platform,
      os: { ...actual.platform.os, android: true },
    },
  };
});

function TestCase({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [open, setOpen] = React.useState(true);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        onOpenChange(nextOpen);
      }}
      swipeDirection="right"
    >
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

async function simulateTimedRightSwipe(
  element: HTMLElement,
  startX: number,
  endX: number,
  startTime: number,
  moveTime: number,
  endTime: number,
) {
  if (isJSDOM) {
    vi.setSystemTime(new Date(startTime));
    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: startX,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    vi.setSystemTime(new Date(moveTime));
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: startX + 1,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    vi.setSystemTime(new Date(endTime - 1));
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: endX,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    vi.setSystemTime(new Date(endTime));
    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: endX,
      clientY: 100,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();
    return;
  }

  const moveDelay = Math.max(0, moveTime - startTime);
  const endDelay = Math.max(0, endTime - moveTime);

  fireEvent.pointerDown(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: startX,
    clientY: 100,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();
  await new Promise((resolve) => {
    setTimeout(resolve, moveDelay);
  });

  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: startX + 1,
    clientY: 100,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();
  await new Promise((resolve) => {
    setTimeout(resolve, endDelay);
  });

  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: endX,
    clientY: 100,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();

  fireEvent.pointerUp(element, {
    pointerId: 1,
    clientX: endX,
    clientY: 100,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();
}

async function simulateTimedDownSwipe(
  element: HTMLElement,
  startY: number,
  endY: number,
  startTime: number,
  moveTime: number,
  endTime: number,
  settleTime?: number,
) {
  const resolvedSettleTime =
    typeof settleTime === 'number' && Number.isFinite(settleTime) ? settleTime : null;
  const settleY = endY - 1;

  if (isJSDOM) {
    vi.setSystemTime(new Date(startTime));
    fireEvent.pointerDown(element, {
      button: 0,
      buttons: 1,
      pointerId: 1,
      clientX: 100,
      clientY: startY,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    vi.setSystemTime(new Date(moveTime));
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 100,
      clientY: startY + 1,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    if (resolvedSettleTime !== null) {
      vi.setSystemTime(new Date(resolvedSettleTime));
      fireEvent.pointerMove(element, {
        pointerId: 1,
        clientX: 100,
        clientY: settleY,
        bubbles: true,
        pointerType: 'mouse',
      });

      await flushMicrotasks();
    }

    vi.setSystemTime(new Date(endTime - 1));
    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 100,
      clientY: endY,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();

    vi.setSystemTime(new Date(endTime));
    fireEvent.pointerUp(element, {
      pointerId: 1,
      clientX: 100,
      clientY: endY,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();
    return;
  }

  const moveDelay = Math.max(0, moveTime - startTime);
  const settleDelay =
    resolvedSettleTime !== null ? Math.max(0, resolvedSettleTime - moveTime) : null;
  const endDelay =
    resolvedSettleTime !== null
      ? Math.max(0, endTime - resolvedSettleTime)
      : Math.max(0, endTime - moveTime);

  fireEvent.pointerDown(element, {
    button: 0,
    buttons: 1,
    pointerId: 1,
    clientX: 100,
    clientY: startY,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();
  await new Promise((resolve) => {
    setTimeout(resolve, moveDelay);
  });

  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: 100,
    clientY: startY + 1,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();

  if (settleDelay !== null) {
    await new Promise((resolve) => {
      setTimeout(resolve, settleDelay);
    });

    fireEvent.pointerMove(element, {
      pointerId: 1,
      clientX: 100,
      clientY: settleY,
      bubbles: true,
      pointerType: 'mouse',
    });

    await flushMicrotasks();
  }

  await new Promise((resolve) => {
    setTimeout(resolve, endDelay);
  });

  fireEvent.pointerMove(element, {
    pointerId: 1,
    clientX: 100,
    clientY: endY,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();

  fireEvent.pointerUp(element, {
    pointerId: 1,
    clientX: 100,
    clientY: endY,
    bubbles: true,
    pointerType: 'mouse',
  });

  await flushMicrotasks();
}

type TimedSwipeStep = {
  type: 'down' | 'move' | 'up';
  x: number;
  y: number;
  time: number;
};

async function simulateTimedSwipe(element: HTMLElement, steps: TimedSwipeStep[]) {
  if (steps.length === 0) {
    return;
  }

  function fireStep(step: TimedSwipeStep) {
    const baseEvent = {
      pointerId: 1,
      clientX: step.x,
      clientY: step.y,
      bubbles: true,
      pointerType: 'mouse',
    };

    if (step.type === 'down') {
      fireEvent.pointerDown(element, { ...baseEvent, button: 0, buttons: 1 });
      return;
    }

    if (step.type === 'move') {
      fireEvent.pointerMove(element, baseEvent);
      return;
    }

    fireEvent.pointerUp(element, baseEvent);
  }

  if (isJSDOM) {
    await steps.reduce(async (previous, step) => {
      await previous;
      vi.setSystemTime(new Date(step.time));
      fireStep(step);
      await flushMicrotasks();
    }, Promise.resolve());
    return;
  }

  await steps.reduce(async (previous, step, index) => {
    await previous;
    const previousTime = steps[index - 1]?.time ?? step.time;
    const delay = index === 0 ? 0 : Math.max(0, step.time - previousTime);
    if (delay > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, delay);
      });
    }

    fireStep(step);
    await flushMicrotasks();
  }, Promise.resolve());
}

function mockResizeObserver() {
  const original = globalThis.ResizeObserver;
  if (typeof original === 'function') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as typeof ResizeObserver;
  }
  return () => {
    if (typeof original === 'function') {
      globalThis.ResizeObserver = original;
    }
  };
}

/**
 * Sets up `elementFromPoint` and `ResizeObserver` mocks for swipe-dismiss tests.
 * Returns a cleanup function that restores originals.
 */
function setupSwipeTestEnv() {
  const originalElementFromPoint = document.elementFromPoint;
  const restoreResizeObserver = mockResizeObserver();
  return {
    /** Call after rendering to point `elementFromPoint` at the given element. */
    pointAt(element: Element) {
      document.elementFromPoint = () => element;
    },
    cleanup() {
      document.elementFromPoint = originalElementFromPoint;
      restoreResizeObserver();
    },
  };
}

function SnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function ActiveSnapPointDisplay() {
  const { activeSnapPoint } = useDrawerRootContext();
  return <div data-testid="active-snap">{String(activeSnapPoint)}</div>;
}

function DefaultSnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);

  return (
    <Drawer.Root
      defaultSnapPoint={snapPoints[1]}
      open={open}
      onOpenChange={setOpen}
      snapPoints={snapPoints}
    >
      <ActiveSnapPointDisplay />
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            Drawer
            <Drawer.Close data-testid="close">Close</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SnapPointChangeDetailsCase({
  onSnapPointChange,
}: {
  onSnapPointChange: (
    snapPoint: Drawer.Root.SnapPoint | null,
    eventDetails: Drawer.Root.SnapPointChangeEventDetails,
  ) => void;
}) {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      snapPoints={snapPoints}
      snapPoint={snapPoint}
      onSnapPointChange={(nextSnapPoint, eventDetails) => {
        setSnapPoint(nextSnapPoint);
        onSnapPointChange(nextSnapPoint, eventDetails);
      }}
    >
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            Drawer
            <Drawer.Close data-testid="close">Close</Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CanceledCloseSnapPointResetCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[2]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open={open}
        onOpenChange={(nextOpen, eventDetails) => {
          if (!nextOpen) {
            eventDetails.cancel();
          } else {
            setOpen(nextOpen);
          }
        }}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              Drawer
              <Drawer.Close data-testid="close">Close</Drawer.Close>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function ControlledAlwaysOpenCase({
  onOpenChange,
}: {
  onOpenChange?: (open: boolean, eventDetails: Drawer.Root.ChangeEventDetails) => void;
}) {
  return (
    <Drawer.Root open onOpenChange={onOpenChange} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport" style={{ height: 300 }}>
          <Drawer.Popup data-testid="popup" style={{ height: 200 }}>
            Drawer
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function ControlledSwipeCloseSnapPointCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  // Start at '300px' (non-default) so we can distinguish correct reset to
  // the default ('100px') from incorrect restoration to the pre-swipe value.
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[1]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open={open}
        onOpenChange={setOpen}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport" style={{ height: 600 }}>
            <Drawer.Popup data-testid="popup" style={{ height: 600 }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function CanceledSwipeCloseCase() {
  const [open, setOpen] = React.useState(true);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(nextOpen, eventDetails) => {
        if (!nextOpen && eventDetails.reason === REASONS.swipe) {
          eventDetails.cancel();
          return;
        }

        setOpen(nextOpen);
      }}
      swipeDirection="down"
    >
      <Drawer.Portal>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Viewport data-testid="viewport" style={{ height: 300 }}>
          <Drawer.Popup data-testid="popup" style={{ height: 200 }}>
            Drawer
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function CanceledSwipeCloseSnapPointCase() {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[0]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open={open}
        onOpenChange={(nextOpen, eventDetails) => {
          if (!nextOpen && eventDetails.reason === REASONS.swipe) {
            eventDetails.cancel();
            return;
          }

          setOpen(nextOpen);
        }}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport" style={{ height: 600 }}>
            <Drawer.Popup data-testid="popup" style={{ height: 600 }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function SnapPointOvershootCase() {
  return (
    <Drawer.Root open defaultSnapPoint={1} snapPoints={['100px', 1]} swipeDirection="down">
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport" style={{ height: 400 }}>
          <Drawer.Popup data-testid="popup" style={{ height: 400 }}>
            Drawer
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function SnapPointSwipeCase({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const snapPoints = ['100px', '300px', 1];
  const [open, setOpen] = React.useState(true);
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[0]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          onOpenChange(nextOpen);
        }}
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        swipeDirection="down"
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport" style={{ height: 600 }}>
            <Drawer.Popup data-testid="popup" style={{ height: 600 }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

function SnapPointSequentialSkipCase() {
  const snapPoints = ['100px', '300px', 1];
  const [snapPoint, setSnapPoint] = React.useState<Drawer.Root.SnapPoint | null>(snapPoints[0]);

  return (
    <div>
      <div data-testid="active-snap">{String(snapPoint)}</div>
      <Drawer.Root
        open
        snapPoints={snapPoints}
        snapPoint={snapPoint}
        onSnapPointChange={setSnapPoint}
        swipeDirection="down"
        snapToSequentialPoints
      >
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport" style={{ height: 600 }}>
            <Drawer.Popup data-testid="popup" style={{ height: 600 }}>
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </div>
  );
}

describe('<Drawer.Root />', () => {
  const { render } = createRenderer();

  beforeAll(function beforeHook() {
    // PointerEvent not fully implemented in jsdom, causing fireEvent.pointer* to ignore options.
    // https://github.com/jsdom/jsdom/issues/2527
    (window as any).PointerEvent = window.MouseEvent;
  });

  it.skipIf(isJSDOM)('uses a size-based swipe threshold', async () => {
    const handleOpenChange = vi.fn();
    await render(<TestCase onOpenChange={handleOpenChange} />);

    await flushMicrotasks();

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');

    popup.style.width = '200px';
    await flushMicrotasks();

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    const useFakeTimers = isJSDOM;
    if (useFakeTimers) {
      vi.useFakeTimers();
    }

    try {
      const startTime = 1000;
      const moveTime = 1100;
      const endTime = 1600;

      await simulateTimedRightSwipe(viewport, 100, 190, startTime, moveTime, endTime);
      expect(handleOpenChange).not.toHaveBeenCalled();

      await simulateTimedRightSwipe(
        viewport,
        100,
        220,
        startTime + 1000,
        moveTime + 1000,
        endTime + 1000,
      );
      expect(handleOpenChange).toHaveBeenCalledWith(false);
    } finally {
      if (useFakeTimers) {
        vi.useRealTimers();
      }
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('supports detached triggers with handles', async () => {
    const handle = Drawer.createHandle<number>();

    await render(
      <div>
        <Drawer.Trigger handle={handle} payload={1}>
          Trigger 1
        </Drawer.Trigger>
        <Drawer.Trigger handle={handle} payload={2}>
          Trigger 2
        </Drawer.Trigger>
        <Drawer.Root handle={handle}>
          {({ payload }: { payload: number | undefined }) => (
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup>
                  <span data-testid="payload">{payload}</span>
                  <Drawer.Close>Close</Drawer.Close>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          )}
        </Drawer.Root>
      </div>,
    );

    await flushMicrotasks();
    expect(screen.queryByTestId('payload')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 1' }));
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('1');

    fireEvent.click(screen.getByText('Close'));
    await flushMicrotasks();
    expect(screen.queryByTestId('payload')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger 2' }));
    await flushMicrotasks();
    expect(screen.getByTestId('payload').textContent).toBe('2');
  });

  it('synchronizes trigger aria-controls with the popup id', async () => {
    const { user } = await render(
      <Drawer.Root>
        <Drawer.Trigger>Open</Drawer.Trigger>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('dialog')).not.toBe(null);
    });

    const popup = screen.getByTestId('popup');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('resets the active snap point when closing', async () => {
    await render(<SnapPointResetCase />);
    await flushMicrotasks();

    const closeButton = screen.getByTestId('close');
    fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('100px');
  });

  it('resets to the default snap point when provided', async () => {
    await render(<DefaultSnapPointResetCase />);
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');

    const closeButton = screen.getByTestId('close');
    fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('300px');
  });

  it('provides event details when snap point changes', async () => {
    const handleSnapPointChange = vi.fn();
    await render(<SnapPointChangeDetailsCase onSnapPointChange={handleSnapPointChange} />);
    await flushMicrotasks();

    const closeButton = screen.getByTestId('close');
    fireEvent.click(closeButton);

    await flushMicrotasks();

    expect(handleSnapPointChange).toHaveBeenCalled();
    const [, eventDetails] = handleSnapPointChange.mock.calls[0];
    expect(eventDetails.reason).toBe(REASONS.closePress);
  });

  it('does not reset snap point when a close is canceled', async () => {
    await render(<CanceledCloseSnapPointResetCase />);
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('1');

    fireEvent.click(screen.getByTestId('close'));
    await flushMicrotasks();

    expect(screen.getByTestId('active-snap').textContent).toBe('1');
  });

  it.skipIf(isJSDOM)('clears swipe-dismiss styles when swipe close is canceled', async () => {
    const env = setupSwipeTestEnv();

    try {
      await render(<CanceledSwipeCloseCase />);
      await flushMicrotasks();

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');
      const backdrop = screen.getByTestId('backdrop');

      Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

      env.pointAt(popup);

      await simulateTimedDownSwipe(viewport, 100, 250, 1000, 1010, 1040);

      expect(popup).not.toHaveAttribute('data-swipe-dismiss');
      expect(backdrop).not.toHaveAttribute('data-swipe-dismiss');
      expect(popup).not.toHaveAttribute('data-ending-style');
      expect(backdrop).not.toHaveAttribute('data-swiping');
      expect(popup).toHaveAttribute('data-open', '');
      expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    } finally {
      env.cleanup();
    }
  });

  it.skipIf(isJSDOM)(
    'does not dismiss a controlled drawer via swipe when open is always true',
    async () => {
      const handleOpenChange = vi.fn();
      const env = setupSwipeTestEnv();

      try {
        await render(<ControlledAlwaysOpenCase onOpenChange={handleOpenChange} />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');
        const backdrop = screen.getByTestId('backdrop');

        Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

        env.pointAt(popup);

        await simulateTimedDownSwipe(viewport, 100, 250, 1000, 1010, 1040);

        // onOpenChange should still be called so the parent knows about the dismiss intent
        expect(handleOpenChange).toHaveBeenCalledWith(false, expect.anything());

        // The controlled reopen happens in rAF outside fireEvent's implicit act scope.
        // Wrap the frame wait in act to avoid React act warnings.
        await act(async () => {
          await waitSingleFrame();
        });

        // The drawer should remain open without data-swipe-dismiss
        expect(popup).not.toHaveAttribute('data-swipe-dismiss');
        expect(backdrop).not.toHaveAttribute('data-swipe-dismiss');
        expect(popup).not.toHaveAttribute('data-ending-style');
        expect(popup).toHaveAttribute('data-open', '');
      } finally {
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)(
    'does not restore snap point when a controlled swipe close is accepted by the parent',
    async () => {
      const env = setupSwipeTestEnv();

      try {
        await render(<ControlledSwipeCloseSnapPointCase />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        await simulateTimedDownSwipe(viewport, 100, 260, 1000, 1010, 1040);
        expect(screen.getByTestId('active-snap').textContent).toBe('100px');
      } finally {
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)(
    'restores snap point and swipe offsets when swipe close is canceled',
    async () => {
      const env = setupSwipeTestEnv();

      try {
        await render(<CanceledSwipeCloseSnapPointCase />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        await simulateTimedDownSwipe(viewport, 100, 260, 1000, 1010, 1040);

        expect(screen.getByTestId('active-snap').textContent).toBe('100px');
        expect(popup).toHaveAttribute('data-open', '');
        expect(popup).not.toHaveAttribute('data-swipe-dismiss');
        expect(popup).not.toHaveAttribute('data-ending-style');
        expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
      } finally {
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)(
    'damps active snap point overshoot after the swipe direction is established',
    async () => {
      const env = setupSwipeTestEnv();

      try {
        await render(<SnapPointOvershootCase />);

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        fireEvent.pointerDown(viewport, {
          button: 0,
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 200,
          bubbles: true,
          pointerType: 'mouse',
        });

        await flushMicrotasks();

        fireEvent.pointerMove(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 200,
          bubbles: true,
          pointerType: 'mouse',
        });

        await flushMicrotasks();

        fireEvent.pointerMove(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 100,
          bubbles: true,
          pointerType: 'mouse',
        });

        await flushMicrotasks();

        fireEvent.pointerMove(viewport, {
          buttons: 1,
          pointerId: 1,
          clientX: 100,
          clientY: 50,
          bubbles: true,
          pointerType: 'mouse',
        });

        await flushMicrotasks();

        expect(popup.style.transform).toBe('');
        expect(
          Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y')),
        ).toBeCloseTo(-Math.sqrt(150));
      } finally {
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)(
    'allows dragging past a snap point when snapToSequentialPoints is enabled',
    async () => {
      const env = setupSwipeTestEnv();

      const useFakeTimers = isJSDOM;
      if (useFakeTimers) {
        vi.useFakeTimers();
      }

      try {
        await render(<SnapPointSequentialSkipCase />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        const startTime = 1000;
        const moveTime = 1010;
        const endTime = 1040;

        await simulateTimedDownSwipe(viewport, 500, 50, startTime, moveTime, endTime);

        expect(screen.getByTestId('active-snap').textContent).toBe('1');
      } finally {
        if (useFakeTimers) {
          vi.useRealTimers();
        }
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)(
    'advances to the next snap point on fast flicks when snapToSequentialPoints is enabled',
    async () => {
      const env = setupSwipeTestEnv();

      const useFakeTimers = isJSDOM;
      if (useFakeTimers) {
        vi.useFakeTimers();
      }

      try {
        await render(<SnapPointSequentialSkipCase />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        const startTime = 2000;
        const moveTime = 2010;
        const endTime = 2050;

        await simulateTimedDownSwipe(viewport, 500, 460, startTime, moveTime, endTime);

        expect(screen.getByTestId('active-snap').textContent).toBe('300px');
      } finally {
        if (useFakeTimers) {
          vi.useRealTimers();
        }
        env.cleanup();
      }
    },
  );

  it.skipIf(isJSDOM)('keeps the drawer open on low-velocity swipes near a snap point', async () => {
    const handleOpenChange = vi.fn();
    const env = setupSwipeTestEnv();

    const useFakeTimers = isJSDOM;
    if (useFakeTimers) {
      vi.useFakeTimers();
    }

    try {
      await render(<SnapPointSwipeCase onOpenChange={handleOpenChange} />);
      await flushMicrotasks();

      const viewport = screen.getByTestId('viewport');
      const popup = screen.getByTestId('popup');

      env.pointAt(popup);

      const startTime = 1000;
      const moveTime = 1005;
      const settleTime = 1015;
      const endTime = 1035;

      await simulateTimedDownSwipe(viewport, 100, 120, startTime, moveTime, endTime, settleTime);

      expect(handleOpenChange).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId('active-snap').textContent).toBe('100px');
    } finally {
      if (useFakeTimers) {
        vi.useRealTimers();
      }
      env.cleanup();
    }
  });

  it.skipIf(isJSDOM)(
    'keeps the drawer open when the release velocity reverses during an upward swipe',
    async () => {
      const handleOpenChange = vi.fn();
      const env = setupSwipeTestEnv();

      const useFakeTimers = isJSDOM;
      if (useFakeTimers) {
        vi.useFakeTimers();
      }

      try {
        await render(<SnapPointSwipeCase onOpenChange={handleOpenChange} />);
        await flushMicrotasks();

        const viewport = screen.getByTestId('viewport');
        const popup = screen.getByTestId('popup');

        env.pointAt(popup);

        const startTime = 1000;
        const nudgeTime = 1003;
        const peakTime = 1010;
        const reversalTime = 1015;
        const endTime = 1025;

        await simulateTimedSwipe(viewport, [
          { type: 'down', x: 100, y: 300, time: startTime },
          { type: 'move', x: 100, y: 299, time: nudgeTime },
          { type: 'move', x: 100, y: 120, time: peakTime },
          { type: 'move', x: 100, y: 140, time: reversalTime },
          { type: 'up', x: 100, y: 140, time: endTime },
        ]);

        expect(handleOpenChange).not.toHaveBeenCalledWith(false);
      } finally {
        if (useFakeTimers) {
          vi.useRealTimers();
        }
        env.cleanup();
      }
    },
  );

  it('closes when CloseWatcher emits a close event', async () => {
    const handleOpenChange = vi.fn();

    class CloseWatcherStub extends EventTarget {
      static instances: CloseWatcherStub[] = [];
      onclose: ((this: CloseWatcherStub, ev: Event) => void) | null = null;
      oncancel: ((this: CloseWatcherStub, ev: Event) => void) | null = null;
      destroy = vi.fn();
      close = vi.fn();
      requestClose = vi.fn();
      constructor() {
        super();
        CloseWatcherStub.instances.push(this);
      }
    }

    const originalCloseWatcher = (window as Window & { CloseWatcher?: unknown | undefined })
      .CloseWatcher;
    (window as Window & { CloseWatcher?: typeof CloseWatcherStub | undefined }).CloseWatcher =
      CloseWatcherStub;

    try {
      await render(
        <Drawer.Root defaultOpen onOpenChange={handleOpenChange}>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup>Drawer</Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      await flushMicrotasks();

      const instance = CloseWatcherStub.instances[CloseWatcherStub.instances.length - 1];
      expect(instance).not.toBeUndefined();

      await act(async () => {
        instance.dispatchEvent(new Event('close'));
        await flushMicrotasks();
      });

      expect(handleOpenChange).toHaveBeenCalled();
      const lastCall = handleOpenChange.mock.calls[handleOpenChange.mock.calls.length - 1];
      expect(lastCall?.[0]).toBe(false);
      expect(lastCall?.[1]?.reason).toBe(REASONS.closeWatcher);
    } finally {
      (window as Window & { CloseWatcher?: unknown | undefined }).CloseWatcher =
        originalCloseWatcher;
    }
  });
});
