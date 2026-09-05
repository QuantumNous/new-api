import { vi, expect } from 'vitest';
import { act, fireEvent, flushMicrotasks, render, screen } from '@mui/internal-test-utils';
import * as React from 'react';
import { isJSDOM, useTestInteractions } from '#test-utils';
import { useClick, useFloating, useHover } from '../index';
import { REASONS } from '../../internals/reasons';
import type { UseFloatingOptions } from '../types';
import type { UseClickProps } from './useClick';

function App({
  initialOpen = false,
  onOpenChange,
  typeable = false,
  ...props
}: UseClickProps & {
  initialOpen?: boolean;
  onOpenChange?: UseFloatingOptions['onOpenChange'];
  typeable?: boolean;
}) {
  const [open, setOpen] = React.useState(initialOpen);
  const { refs, context } = useFloating({
    open,
    onOpenChange(nextOpen, details) {
      onOpenChange?.(nextOpen, details);
      setOpen(nextOpen);
    },
  });
  const { getReferenceProps, getFloatingProps } = useTestInteractions([useClick(context, props)]);
  const Reference = typeable ? 'input' : 'button';

  return (
    <React.Fragment>
      <Reference data-testid="reference" {...getReferenceProps({ ref: refs.setReference })} />
      {open && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
    </React.Fragment>
  );
}

function createMouseEvent(type: string, options: MouseEventInit = {}) {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    ...options,
  });
}

function createPointerEvent(type: string, pointerType: PointerEvent['pointerType']) {
  const event = createMouseEvent(type) as PointerEvent;
  Object.defineProperty(event, 'pointerType', {
    value: pointerType,
  });
  return event;
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(createMouseEvent('click'));
  });
}

async function pressMouse(element: Element) {
  await act(async () => {
    element.dispatchEvent(createPointerEvent('pointerdown', 'mouse'));
    element.dispatchEvent(createMouseEvent('mousedown'));
    element.dispatchEvent(createMouseEvent('click'));
  });
}

async function hover(element: Element) {
  await act(async () => {
    element.dispatchEvent(createMouseEvent('mouseover', { relatedTarget: document.body }));
    element.dispatchEvent(createMouseEvent('mouseenter', { relatedTarget: document.body }));
  });
}

describe.skipIf(!isJSDOM)('useClick', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
      (callback: FrameRequestCallback): number => {
        callback(0);
        return 0;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test('opens and closes on repeated clicks', async () => {
    render(<App />);

    const button = screen.getByRole('button');

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('keeps open on repeated clicks when toggle is false', async () => {
    render(<App toggle={false} />);

    const button = screen.getByRole('button');

    await click(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('opens from the mousedown event path', async () => {
    render(<App event="mousedown" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await flushMicrotasks();
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('closes from the mousedown event path', async () => {
    render(<App event="mousedown" initialOpen />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    await flushMicrotasks();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('ignores the click event after mousedown when event is mousedown-only', async () => {
    render(<App event="mousedown-only" />);

    const button = screen.getByRole('button');

    await pressMouse(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    await click(button);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('ignores mouse input when ignoreMouse is true', async () => {
    render(<App ignoreMouse />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'mouse' });
    fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('delays touch opening when touchOpenDelay is set', async () => {
    vi.useFakeTimers();

    render(<App touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('delays touch opening from the deferred mousedown event path', async () => {
    vi.useFakeTimers();

    const frameCallbacks: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });

    render(<App event="mousedown" touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    await act(async () => {
      button.dispatchEvent(createPointerEvent('pointerdown', 'touch'));
      button.dispatchEvent(createMouseEvent('mousedown'));
      button.dispatchEvent(createMouseEvent('click'));
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await act(async () => {
      frameCallbacks.forEach((callback) => callback(0));
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('does not delay touch closing', async () => {
    vi.useFakeTimers();

    render(<App initialOpen touchOpenDelay={100} />);

    const button = screen.getByRole('button');

    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('uses the configured reason', async () => {
    const onOpenChange = vi.fn();

    render(<App onOpenChange={onOpenChange} reason={REASONS.inputPress} typeable />);

    await click(screen.getByRole('textbox'));

    expect(onOpenChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: REASONS.inputPress }),
    );
  });

  test('stickIfOpen true keeps a hover-opened popup open on first click', async () => {
    function HoverClickApp() {
      const [open, setOpen] = React.useState(false);
      const { refs, context } = useFloating({
        open,
        onOpenChange: setOpen,
      });
      const { getReferenceProps, getFloatingProps } = useTestInteractions([
        useHover(context),
        useClick(context, { stickIfOpen: true }),
      ]);

      return (
        <React.Fragment>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          {open && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
        </React.Fragment>
      );
    }

    render(<HoverClickApp />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  test('stickIfOpen false closes a hover-opened popup on first click', async () => {
    function HoverClickApp() {
      const [open, setOpen] = React.useState(false);
      const { refs, context } = useFloating({
        open,
        onOpenChange: setOpen,
      });
      const { getReferenceProps, getFloatingProps } = useTestInteractions([
        useHover(context),
        useClick(context, { stickIfOpen: false }),
      ]);

      return (
        <React.Fragment>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          {open && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
        </React.Fragment>
      );
    }

    render(<HoverClickApp />);

    const button = screen.getByRole('button');

    await hover(button);
    await click(button);

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
