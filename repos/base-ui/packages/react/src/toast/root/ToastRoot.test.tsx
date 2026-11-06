import { expect } from 'vitest';
import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { act, screen, fireEvent, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import type { ToastManagerAddOptions } from '../useToastManager';
import { List, Button } from '../utils/test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

function simulateSwipe(
  element: HTMLElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  releaseTarget: HTMLElement | Document = element,
  releaseType: 'pointerup' | 'pointercancel' = 'pointerup',
) {
  fireEvent.pointerDown(element, {
    clientX: startX,
    clientY: startY,
    button: 0,
    bubbles: true,
    pointerId: 1,
  });

  // Fire an initial move event close to the start to trigger the isFirstPointerMoveRef logic correctly.
  // This simulates the finger moving slightly before the main swipe movement is registered.
  let deltaX = 0;
  if (endX > startX) {
    deltaX = 1;
  } else if (endX < startX) {
    deltaX = -1;
  }

  let deltaY = 0;
  if (endY > startY) {
    deltaY = 1;
  } else if (endY < startY) {
    deltaY = -1;
  }

  fireEvent.pointerMove(element, {
    clientX: startX + deltaX,
    clientY: startY + deltaY,
    bubbles: true,
    pointerId: 1,
  });

  // Fire the main move event to the end position.
  fireEvent.pointerMove(element, {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  });
  const releaseEvent = {
    clientX: endX,
    clientY: endY,
    bubbles: true,
    pointerId: 1,
  };

  if (releaseType === 'pointercancel') {
    fireEvent.pointerCancel(releaseTarget, releaseEvent);
  } else {
    fireEvent.pointerUp(releaseTarget, releaseEvent);
  }
}

describe('<Toast.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Root toast={toast} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Viewport>{node}</Toast.Viewport>
        </Toast.Provider>,
      );
    },
  }));

  it.skipIf(isJSDOM)('recalculates height when content mutates', async () => {
    function ToastList() {
      return Toast.useToastManager().toasts.map((toastItem) => (
        <Toast.Root
          key={toastItem.id}
          toast={toastItem}
          data-testid="toast-root"
          style={{ width: 30 }}
        >
          <Toast.Content>
            <Toast.Title>{toastItem.title}</Toast.Title>
            <Toast.Description>{toastItem.description}</Toast.Description>
          </Toast.Content>
        </Toast.Root>
      ));
    }

    function App() {
      const { add, update } = Toast.useToastManager();
      const [toastId, setToastId] = React.useState<string | null>(null);
      const addedRef = React.useRef(false);

      React.useEffect(() => {
        if (addedRef.current) {
          return;
        }
        addedRef.current = true;
        const id = add({
          id: 'resizable-toast',
          title: 'Loading',
          description: 'Short',
        });
        setToastId(id);
      }, [add]);

      return (
        <div>
          <button
            type="button"
            onClick={() => {
              if (!toastId) {
                return;
              }
              update(toastId, {
                title: 'Success',
                description:
                  'This content is longer than before and should cause the height to increase',
              });
            }}
          >
            update
          </button>
          <Toast.Viewport>
            <ToastList />
          </Toast.Viewport>
        </div>
      );
    }

    await render(
      <Toast.Provider>
        <App />
      </Toast.Provider>,
    );

    const toastRoot = await screen.findByTestId('toast-root');

    await waitFor(() => {
      const height = toastRoot.style.getPropertyValue('--toast-height');
      expect(height).not.toBe('');
    });

    const initialHeight = parseInt(toastRoot.style.getPropertyValue('--toast-height'), 10);

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    await waitFor(() => {
      const newHeight = parseInt(toastRoot.style.getPropertyValue('--toast-height'), 10);
      expect(newHeight).toBeGreaterThan(initialHeight);
    });
  });

  // requires :focus-visible check
  it.skipIf(isJSDOM)('closes when pressing escape', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
        <Button />
      </Toast.Provider>,
    );

    const button = screen.getByRole('button', { name: 'add' });

    await act(async () => button.focus());
    await user.click(button);

    await user.keyboard('{F6}');
    await user.keyboard('{Tab}');
    await user.keyboard('{Escape}');

    expect(screen.queryByTestId('root')).toBe(null);
  });

  describe.skipIf(isJSDOM)('swipe behavior', () => {
    function SwipeTestButton({
      toastOptions,
    }: {
      toastOptions?: Partial<ToastManagerAddOptions<any>>;
    } = {}) {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() => {
            add({
              id: 'swipe-test-toast',
              title: 'Swipe Me',
              description: 'Swipe to dismiss',
              ...(toastOptions ?? {}),
            });
          }}
        >
          add toast
        </button>
      );
    }

    function SwipeTestToast({
      swipeDirection,
    }: {
      swipeDirection: Toast.Root.Props['swipeDirection'];
    }) {
      return Toast.useToastManager().toasts.map((toastItem) => (
        <Toast.Root
          key={toastItem.id}
          toast={toastItem}
          data-testid="toast-root"
          swipeDirection={swipeDirection}
        >
          <Toast.Title>{toastItem.title}</Toast.Title>
          <Toast.Description>{toastItem.description}</Toast.Description>
        </Toast.Root>
      ));
    }

    it('closes toast when swiping in the specified direction beyond threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe up (starting at y=100, ending at y=55, which is > 40px threshold)
      simulateSwipe(toastElement, 100, 100, 100, 55);

      await waitFor(() => {
        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('does not close toast when swiping in the specified direction below threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe up but only by 10px (below 40px threshold)
      simulateSwipe(toastElement, 100, 100, 100, 90);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('does not close toast when swiping in a non-specified direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe down (opposite of allowed direction)
      simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    describe('supports multiple swipe directions', () => {
      it('up + right', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['up', 'right']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        fireEvent.click(addToast);

        // Swipe right
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 150, 100);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });

        fireEvent.click(addToast);

        // Swipe up
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 50);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });
      });

      it('right + left', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['right', 'left']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        fireEvent.click(addToast);

        // Swipe right
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 150, 100);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });

        fireEvent.click(addToast);

        // Swipe left
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 50, 100);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });
      });

      it('up + down', async () => {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection={['up', 'down']} />
            </Toast.Viewport>
            <SwipeTestButton />
          </Toast.Provider>,
        );

        const addToast = screen.getByRole('button', { name: 'add toast' });

        fireEvent.click(addToast);

        // Swipe up
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 50);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });

        fireEvent.click(addToast);

        // Swipe down
        simulateSwipe(screen.getByTestId('toast-root'), 100, 100, 100, 150);

        await waitFor(() => {
          expect(screen.queryByTestId('toast-root')).toBe(null);
        });
      });
    });

    it('cancels swipe when direction is reversed beyond threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Start swiping up
      fireEvent.pointerDown(toastElement, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });
      fireEvent.pointerMove(toastElement, { clientX: 100, clientY: 80, pointerId: 1 });

      // Then reverse direction
      fireEvent.pointerMove(toastElement, { clientX: 100, clientY: 90, pointerId: 1 });
      fireEvent.pointerUp(toastElement, { clientX: 100, clientY: 90, pointerId: 1 });

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('applies [data-swiping] attribute when swiping', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      fireEvent.pointerDown(toastElement, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });

      expect(toastElement.getAttribute('data-swiping')).toBe('');
    });

    it('dismisses toast when swiped down with downward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="down" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('dismisses toast when swiped left with leftward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="left" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      simulateSwipe(toastElement, 100, 100, 50, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('dismisses toast when swiped right with rightward swipe direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="right" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');
      simulateSwipe(toastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('allows swiping in multiple directions when specified', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection={['up', 'right']} />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // First test upward swipe
      simulateSwipe(toastElement, 100, 100, 100, 50);

      expect(screen.queryByTestId('toast-root')).toBe(null);

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));
      const secondToastElement = screen.getByTestId('toast-root');

      simulateSwipe(secondToastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).toBe(null);
    });

    it('does not dismiss when swiped in non-specified direction', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Swipe right (not allowed)
      simulateSwipe(toastElement, 100, 100, 150, 100);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);

      // Swipe down (not allowed)
      simulateSwipe(toastElement, 100, 100, 100, 150);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('does not dismiss when swipe distance is below threshold', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <SwipeTestToast swipeDirection="up" />
          </Toast.Viewport>
          <SwipeTestButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Small upward swipe (below threshold)
      simulateSwipe(toastElement, 100, 100, 100, 95);

      expect(screen.queryByTestId('toast-root')).not.toBe(null);
    });

    it('prevents native touchmove only during an active touch swipe', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <Toast.Title>{toast.title}</Toast.Title>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      Object.defineProperty(toastElement, 'setPointerCapture', {
        value: () => {},
        configurable: true,
      });

      const beforeSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(beforeSwipeEvent);
      expect(beforeSwipeEvent.defaultPrevented).toBe(false);

      fireEvent.pointerDown(toastElement, {
        clientX: 100,
        clientY: 100,
        button: 0,
        pointerId: 1,
        pointerType: 'touch',
      });

      const duringSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(duringSwipeEvent);
      expect(duringSwipeEvent.defaultPrevented).toBe(true);

      fireEvent.pointerCancel(toastElement, { pointerId: 1, pointerType: 'touch' });

      const afterSwipeEvent = new Event('touchmove', { bubbles: true, cancelable: true });
      toastElement.dispatchEvent(afterSwipeEvent);
      expect(afterSwipeEvent.defaultPrevented).toBe(false);
    });

    it('does not start swiping from elements with the data-base-ui-swipe-ignore attribute', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <div data-base-ui-swipe-ignore data-testid="ignore-target">
                Ignore swipe
              </div>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      const ignoreTarget = screen.getByTestId('ignore-target');

      fireEvent.pointerDown(ignoreTarget, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });

      expect(toastElement).not.toHaveAttribute('data-swiping');
    });

    it('does not start swiping from elements with the legacy data-swipe-ignore attribute', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <Toast.Root toast={toast} data-testid="toast-root" swipeDirection="up">
              <div data-swipe-ignore data-testid="ignore-target">
                Ignore swipe
              </div>
            </Toast.Root>
          </Toast.Viewport>
        </Toast.Provider>,
      );

      const toastElement = screen.getByTestId('toast-root');
      const ignoreTarget = screen.getByTestId('ignore-target');

      fireEvent.pointerDown(ignoreTarget, { clientX: 100, clientY: 100, button: 0, pointerId: 1 });

      expect(toastElement).not.toHaveAttribute('data-swiping');
    });

    it('ignores swipe gestures when toast is anchored', async () => {
      const anchor = document.createElement('div');
      document.body.appendChild(anchor);

      try {
        await render(
          <Toast.Provider>
            <Toast.Viewport>
              <SwipeTestToast swipeDirection="up" />
            </Toast.Viewport>
            <SwipeTestButton
              toastOptions={{
                positionerProps: {
                  anchor,
                },
              }}
            />
          </Toast.Provider>,
        );

        fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

        const toastElement = screen.getByTestId('toast-root');

        simulateSwipe(toastElement, 100, 100, 100, 55);

        expect(screen.queryByTestId('toast-root')).not.toBe(null);
      } finally {
        document.body.removeChild(anchor);
      }
    });
  });

  describe('drag behavior regression', () => {
    function DragList() {
      return Toast.useToastManager().toasts.map((toastItem) => (
        <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast-root">
          <Toast.Content data-testid="toast-content">
            <Toast.Title>{toastItem.title}</Toast.Title>
            <Toast.Description>{toastItem.description}</Toast.Description>
          </Toast.Content>
        </Toast.Root>
      ));
    }

    function DragButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() => {
            add({ title: 'T', description: 'D' });
          }}
        >
          add toast
        </button>
      );
    }

    it('resets drag state after releasing a far swipe even when the release lands on the document', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      // Default swipeDirection=['down','right']. Dragging left triggers the damped, opposite-
      // direction path. Release on the document to cover browsers that don't deliver the final
      // pointer event back to the toast root.
      simulateSwipe(toastElement, 300, 100, -5000, 100, document);

      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');

      simulateSwipe(toastElement, 100, 100, 150, 100);

      await waitFor(() => {
        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('resets drag state after a document pointercancel', async () => {
      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <DragList />
          </Toast.Viewport>
          <DragButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = screen.getByTestId('toast-root');

      simulateSwipe(toastElement, 300, 100, -5000, 100, document, 'pointercancel');

      expect(toastElement).not.toHaveAttribute('data-swiping');
      expect(toastElement).not.toHaveAttribute('data-swipe-direction');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-x')).toBe('0px');
      expect(toastElement.style.getPropertyValue('--toast-swipe-movement-y')).toBe('0px');
      expect(toastElement.style.transition).toBe('');
      expect(toastElement.style.transform).toBe('');
    });
  });

  describe('object identity', () => {
    // Regression test for https://github.com/mui/base-ui/issues/3922
    // Toast calculations should use ID-based lookups, not referential equality
    it('works correctly when toast objects are recreated (not referentially equal)', async () => {
      // This component wraps useToastManager and creates NEW toast objects
      // by spreading them. This is a common pattern when users want to
      // add type-safety to the data field or transform toast properties.
      function ToastListWithNewObjects() {
        const { toasts } = Toast.useToastManager();

        // Create new objects - this breaks referential equality
        const transformedToasts = toasts.map((t) => ({
          ...t,
          // Users might transform data for type-safety, like:
          // data: parseToastData(t.data)
        }));

        return transformedToasts.map((toastItem) => (
          <Toast.Root key={toastItem.id} toast={toastItem} data-testid="toast-root">
            <Toast.Title>{toastItem.title}</Toast.Title>
            <Toast.Description>{toastItem.description}</Toast.Description>
            <Toast.Close data-testid="toast-close">Close</Toast.Close>
          </Toast.Root>
        ));
      }

      function AddButton() {
        const { add } = Toast.useToastManager();
        return (
          <button
            type="button"
            onClick={() => {
              add({
                id: 'test-toast',
                title: 'Test Title',
                description: 'Test Description',
              });
            }}
          >
            add toast
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toast' }));

      const toastElement = await screen.findByTestId('toast-root');

      // Verify the toast index is correctly calculated (should be 0, not -1)
      // The --toast-index CSS variable is set based on the domIndex calculation
      await waitFor(() => {
        const toastIndex = toastElement.style.getPropertyValue('--toast-index');
        expect(toastIndex).toBe('0');
      });

      // Verify the close button works (which also relies on ID-based lookup)
      fireEvent.click(screen.getByTestId('toast-close'));

      await waitFor(() => {
        expect(screen.queryByTestId('toast-root')).toBe(null);
      });
    });

    it('correctly calculates indices for multiple toasts with recreated objects', async () => {
      function ToastListWithNewObjects() {
        const { toasts } = Toast.useToastManager();

        // Create new objects - this breaks referential equality
        const transformedToasts = toasts.map((t) => ({ ...t }));

        return transformedToasts.map((toastItem) => (
          <Toast.Root key={toastItem.id} toast={toastItem} data-testid={`toast-${toastItem.id}`}>
            <Toast.Title>{toastItem.title}</Toast.Title>
          </Toast.Root>
        ));
      }

      function AddButton() {
        const { add } = Toast.useToastManager();
        return (
          <button
            type="button"
            onClick={() => {
              add({ title: 'Toast 1' });
              add({ title: 'Toast 2' });
              add({ title: 'Toast 3' });
            }}
          >
            add toasts
          </button>
        );
      }

      await render(
        <Toast.Provider>
          <Toast.Viewport>
            <ToastListWithNewObjects />
          </Toast.Viewport>
          <AddButton />
        </Toast.Provider>,
      );

      fireEvent.click(screen.getByRole('button', { name: 'add toasts' }));

      // Wait for all toasts to appear
      const toasts = await screen.findAllByTestId(/^toast-/);
      expect(toasts).toHaveLength(3);

      // Verify each toast has a valid (non-negative) index
      await waitFor(() => {
        toasts.forEach((toastEl) => {
          const toastIndex = parseInt(toastEl.style.getPropertyValue('--toast-index'), 10);
          expect(toastIndex).toBeGreaterThanOrEqual(0);
        });
      });
    });
  });
});
