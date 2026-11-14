import { expect, vi } from 'vitest';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM, waitSingleFrame } from '#test-utils';

describe('<Popover.Popup />', () => {
  const { render, clock } = createRenderer();

  describeConformance(<Popover.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>{node}</Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
    },
  }));

  it('should render the children', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    expect(screen.getByText('Content')).not.toBe(null);
  });

  describe('prop: initialFocus', () => {
    it('should focus the first focusable element within the popup by default', async () => {
      await render(
        <div>
          <input />
          <Popover.Root>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover">
                  <input data-testid="popover-input" />
                  <button>Close</button>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <input />
        </div>,
      );

      const trigger = screen.getByText('Open');
      await act(async () => {
        trigger.click();
      });

      await waitFor(() => {
        const innerInput = screen.getByTestId('popover-input');
        expect(innerInput).to.toHaveFocus();
      });
    });

    it('should focus the element provided to `initialFocus` as a ref when open', async () => {
      function TestComponent() {
        const input2Ref = React.useRef<HTMLInputElement | null>(null);
        return (
          <div>
            <input />
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup initialFocus={input2Ref}>
                    <input data-testid="input-1" />
                    <input data-testid="input-2" ref={input2Ref} />
                    <input data-testid="input-3" />
                    <button>Close</button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <input />
          </div>
        );
      }

      await render(<TestComponent />);

      const trigger = screen.getByText('Open');
      await act(async () => {
        trigger.click();
      });

      await waitFor(() => {
        const input2 = screen.getByTestId('input-2');
        expect(input2).to.toHaveFocus();
      });
    });

    it('should focus the element provided to `initialFocus` as a function when open', async () => {
      function TestComponent() {
        const input2Ref = React.useRef<HTMLInputElement>(null);

        const getRef = React.useCallback(() => input2Ref.current, []);

        return (
          <div>
            <input />
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup initialFocus={getRef}>
                    <input data-testid="input-1" />
                    <input data-testid="input-2" ref={input2Ref} />
                    <input data-testid="input-3" />
                    <button>Close</button>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <input />
          </div>
        );
      }

      const { user } = await render(<TestComponent />);

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      await waitFor(() => {
        const input2 = screen.getByTestId('input-2');
        expect(input2).to.toHaveFocus();
      });
    });

    it('should support element-returning function and no-op via false/void for initialFocus', async () => {
      function TestComponent() {
        const input2Ref = React.useRef<HTMLInputElement>(null);

        const getEl = React.useCallback((type: string) => {
          if (type === 'keyboard') {
            return input2Ref.current;
          }
          return undefined;
        }, []);

        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popover" initialFocus={getEl}>
                    <input data-testid="input-1" />
                    <input data-testid="input-2" ref={input2Ref} />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('{Escape}');
      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(screen.getByTestId('input-2')).toHaveFocus();
      });
    });

    it('passes the latest interaction type to initialFocus after reopening', async () => {
      const initialFocus = vi.fn(() => false);

      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup initialFocus={initialFocus}>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByText('Open');
      await act(async () => trigger.focus());
      await user.keyboard('[Enter]');

      await waitFor(() => {
        expect(initialFocus).toHaveBeenLastCalledWith('keyboard');
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      fireEvent.click(trigger, { detail: 1 });

      await waitFor(() => {
        expect(initialFocus).toHaveBeenLastCalledWith('touch');
      });
    });

    it('should not move focus when initialFocus is false', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popover" initialFocus={false}>
                    <input data-testid="input-1" />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      const trigger = screen.getByText('Open');
      await user.click(trigger);
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should default focus when initialFocus returns true', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popover" initialFocus={() => true}>
                    <input data-testid="input-1" />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      await user.click(screen.getByText('Open'));
      await waitFor(() => {
        expect(screen.getByTestId('input-1')).toHaveFocus();
      });
    });

    it('uses default behavior when initialFocus returns null', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popover" initialFocus={() => null}>
                    <input data-testid="input-1" />
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      await user.click(screen.getByText('Open'));
      await waitFor(() => {
        expect(screen.getByTestId('input-1')).toHaveFocus();
      });
    });
  });

  it.skipIf(isJSDOM)('focuses the popup when the active element becomes display:none', async () => {
    function TestComponent() {
      const [hidden, setHidden] = React.useState(false);

      return (
        <Popover.Root open>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">
                <button
                  data-testid="hide-button"
                  style={{ display: hidden ? 'none' : undefined }}
                  onClick={() => setHidden(true)}
                >
                  Hide
                </button>
                <input />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    const { user } = await render(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('hide-button')).toHaveFocus();
    });

    await user.click(screen.getByTestId('hide-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
  });

  describe('openOnHover: delay + click', () => {
    clock.withFakeTimers();

    it('returns focus to the trigger if opened by click before the hover delay completes', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>
                <Popover.Close>Close</Popover.Close>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByText('Open');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);

      fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByText('Close')).not.toBe(null);

      clock.tick(1000);
      await flushMicrotasks();

      fireEvent.click(screen.getByText('Close'));
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
    });
  });

  describe('prop: finalFocus', () => {
    it('should focus the trigger by default when closed', async () => {
      await render(
        <div>
          <input />
          <Popover.Root>
            <Popover.Trigger>Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>
                  <Popover.Close>Close</Popover.Close>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
          <input />
        </div>,
      );

      const trigger = screen.getByText('Open');
      await act(async () => {
        trigger.click();
      });

      const closeButton = screen.getByText('Close');
      await act(async () => {
        closeButton.click();
      });

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should focus the element provided to the prop when closed', async () => {
      function TestComponent() {
        const inputRef = React.useRef<HTMLInputElement | null>(null);
        return (
          <div>
            <input />
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={inputRef}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <input />
            <input data-testid="input-to-focus" ref={inputRef} />
            <input />
          </div>
        );
      }

      await render(<TestComponent />);

      const trigger = screen.getByText('Open');
      await act(async () => {
        trigger.click();
      });

      const closeButton = screen.getByText('Close');
      await act(async () => {
        closeButton.click();
      });

      const inputToFocus = screen.getByTestId('input-to-focus');

      await waitFor(() => {
        expect(inputToFocus).toHaveFocus();
      });
    });

    it('should focus the element provided to `finalFocus` as a function when closed', async () => {
      function TestComponent() {
        const ref = React.useRef<HTMLInputElement>(null);
        const getRef = React.useCallback(() => ref.current, []);
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={getRef}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <input data-testid="input-to-focus" ref={ref} />
          </div>
        );
      }

      const { user } = await render(<TestComponent />);

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.getByTestId('input-to-focus')).toHaveFocus();
      });
    });

    it('should not move focus when finalFocus is false', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={false}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      const trigger = screen.getByText('Open');

      await user.click(trigger);
      await user.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(trigger).not.toHaveFocus();
      });
    });

    it('should move focus to the trigger when finalFocus returns true', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={() => true}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      const trigger = screen.getByText('Open');

      await user.click(trigger);
      await user.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('should support element-returning function and default via true + no-op via void for finalFocus based on closeType', async () => {
      function TestComponent() {
        const inputRef = React.useRef<HTMLInputElement>(null);
        const getEl = React.useCallback((type: string) => {
          if (type === 'keyboard') {
            return inputRef.current;
          }
          return true;
        }, []);

        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={getEl}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <input data-testid="final-input" ref={inputRef} />
          </div>
        );
      }

      const { user } = await render(<TestComponent />);

      const trigger = screen.getByText('Open');

      // Close via pointer: true => default, should move focus to trigger
      await user.click(trigger);
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      // Close via keyboard: should move focus to final-input
      await user.click(trigger);
      await waitSingleFrame();
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.getByTestId('final-input')).toHaveFocus();
      });
    });

    it('uses default behavior when finalFocus returns null', async () => {
      function TestComponent() {
        return (
          <div>
            <Popover.Root>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup finalFocus={() => null}>
                    <Popover.Close>Close</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </div>
        );
      }

      const { user } = await render(<TestComponent />);
      const trigger = screen.getByText('Open');
      await user.click(trigger);
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });
  });
});
