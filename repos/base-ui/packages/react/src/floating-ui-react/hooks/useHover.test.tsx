import { vi, test, expect } from 'vitest';

import { act, fireEvent, flushMicrotasks, render, screen, waitFor } from '@mui/internal-test-utils';
import * as React from 'react';
import userEvent from '@testing-library/user-event';
import { isJSDOM, useTestInteractions } from '#test-utils';
import { useFloating, useHover } from '../index';
import type { UseHoverProps } from './useHover';
import { Popover } from '../../../test/floating-ui-tests/Popover';
import { REASONS } from '../../internals/reasons';

function App({ showReference = true, ...props }: UseHoverProps & { showReference?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });
  const { getReferenceProps, getFloatingProps } = useTestInteractions([useHover(context, props)]);

  return (
    <React.Fragment>
      {showReference && <button {...getReferenceProps({ ref: refs.setReference })} />}
      {open && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
    </React.Fragment>
  );
}

describe.skipIf(!isJSDOM)('useHover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  test('opens on mouseenter', async () => {
    render(<App />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    await flushMicrotasks();
  });

  test('closes on mouseleave', () => {
    render(<App />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  describe('prop: delay', () => {
    test('symmetric number', async () => {
      render(<App delay={1000} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(999);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('open', async () => {
      render(<App delay={{ open: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(499);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('close', async () => {
      render(<App delay={{ close: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));
      fireEvent.mouseLeave(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(499);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('open with close 0', async () => {
      render(<App delay={{ open: 500 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(499);
      });

      fireEvent.mouseLeave(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(1);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('restMs + nullish open delay should respect restMs', async () => {
      render(<App restMs={100} delay={{ close: 100 }} />);

      fireEvent.mouseEnter(screen.getByRole('button'));

      await act(async () => {
        vi.advanceTimersByTime(99);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('restMs', async () => {
    render(<App restMs={100} />);

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 10 });
      Object.defineProperty(event, 'movementY', { value: 10 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    await act(async () => {
      vi.advanceTimersByTime(99);
    });

    fireEvent.mouseMove(button);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.mouseMove(button);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test.skip('restMs is always 0 for touch input', async () => {
    render(<App restMs={100} />);

    fireEvent.pointerDown(screen.getByRole('button'), { pointerType: 'touch' });
    fireEvent.mouseMove(screen.getByRole('button'));

    await flushMicrotasks();

    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  test('restMs does not reset timer for minor mouse movement', async () => {
    render(<App restMs={100} />);

    const button = screen.getByRole('button');

    const originalDispatchEvent = button.dispatchEvent;
    const spy = vi.spyOn(button, 'dispatchEvent').mockImplementation((event) => {
      Object.defineProperty(event, 'movementX', { value: 1 });
      Object.defineProperty(event, 'movementY', { value: 0 });
      return originalDispatchEvent.call(button, event);
    });

    fireEvent.mouseMove(button);

    await act(async () => {
      vi.advanceTimersByTime(99);
    });

    fireEvent.mouseMove(button);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByRole('tooltip')).toBeInTheDocument();

    spy.mockRestore();
  });

  test('mouseleave on the floating element closes it (mouse)', async () => {
    render(<App />);

    fireEvent.mouseEnter(screen.getByRole('button'));
    await flushMicrotasks();

    fireEvent(
      screen.getByRole('button'),
      new MouseEvent('mouseleave', {
        relatedTarget: screen.getByRole('tooltip'),
      }),
    );

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('does not show after delay if domReference changes', async () => {
    const { rerender } = render(<App delay={1000} />);

    fireEvent.mouseEnter(screen.getByRole('button'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    rerender(<App showReference={false} />);

    await act(async () => {
      vi.advanceTimersByTime(999);
    });

    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  test('reason string', async () => {
    function App() {
      const [isOpen, setIsOpen] = React.useState(false);
      const { refs, context } = useFloating({
        open: isOpen,
        onOpenChange(nextOpen, data) {
          setIsOpen(nextOpen);
          expect(data?.reason).toBe(REASONS.triggerHover);
        },
      });

      const hover = useHover(context);
      const { getReferenceProps, getFloatingProps } = useTestInteractions([hover]);

      return (
        <React.Fragment>
          <button ref={refs.setReference} {...getReferenceProps()} />
          {isOpen && <div role="tooltip" ref={refs.setFloating} {...getFloatingProps()} />}
        </React.Fragment>
      );
    }

    render(<App />);
    const button = screen.getByRole('button');
    fireEvent.mouseEnter(button);
    await flushMicrotasks();
    fireEvent.mouseLeave(button);
  });

  test('does not treat a synthetic child target as inactive when the native path differs', async () => {
    const onOpenChange = vi.fn();

    function App() {
      const [open, setOpen] = React.useState(true);
      const { refs, context } = useFloating({
        open,
        onOpenChange(nextOpen, details) {
          onOpenChange(nextOpen, details);
          setOpen(nextOpen);
        },
      });
      const { getReferenceProps, getFloatingProps } = useTestInteractions([useHover(context)]);

      return (
        <React.Fragment>
          <button ref={refs.setReference} {...getReferenceProps()}>
            <span data-testid="child" />
          </button>
          {open && <div role="tooltip" ref={refs.setFloating} {...getFloatingProps()} />}
        </React.Fragment>
      );
    }

    render(<App />);

    const child = screen.getByTestId('child');
    const event = new MouseEvent('mousemove', { bubbles: true });

    // Deliberately skew the native path so `getTarget(nativeEvent)` resolves
    // outside the trigger while React's synthetic `event.target` remains `child`.
    Object.defineProperty(event, 'composedPath', {
      configurable: true,
      value: () => [document.body, child.parentElement, child],
    });

    fireEvent(child, event);

    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(0);
    expect(screen.queryByRole('tooltip')).not.toBe(null);
  });

  test('cleans up blockPointerEvents if trigger changes', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <Popover
        hover={false}
        modal={false}
        bubbles
        render={({ labelId, descriptionId, close }) => (
          <React.Fragment>
            <h2 id={labelId}>Parent title</h2>
            <p id={descriptionId}>Description</p>
            <Popover
              hover
              modal={false}
              bubbles
              render={({ labelId, descriptionId, close }) => (
                <React.Fragment>
                  <h2 id={labelId}>Child title</h2>
                  <p id={descriptionId}>Description</p>
                  <button onClick={close}>Close</button>
                </React.Fragment>
              )}
            >
              <button type="button">Open child</button>
            </Popover>
            <button onClick={close}>Close</button>
          </React.Fragment>
        )}
      >
        <button type="button">Open parent</button>
      </Popover>,
    );

    await user.click(screen.getByText('Open parent'));
    expect(screen.getByText('Parent title')).toBeInTheDocument();
    await user.click(screen.getByText('Open child'));
    expect(screen.getByText('Child title')).toBeInTheDocument();
    await user.click(screen.getByText('Child title'));
    // clean up blockPointerEvents
    // userEvent.unhover does not work because of the pointer-events
    fireEvent.mouseLeave(screen.getByRole('dialog', { name: 'Child title' }));
    expect(screen.getByText('Child title')).toBeInTheDocument();
    await user.click(screen.getByText('Parent title'));
    // screen.debug();
    expect(screen.getByText('Parent title')).toBeInTheDocument();
  });
});
