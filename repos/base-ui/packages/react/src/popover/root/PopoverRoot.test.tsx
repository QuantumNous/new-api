import { expect, vi } from 'vitest';
import * as React from 'react';
import { Popover } from '@base-ui/react/popover';
import { Combobox } from '@base-ui/react/combobox';
import { Menu } from '@base-ui/react/menu';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM, popupConformanceTests, wait } from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { REASONS } from '../../internals/reasons';

describe('<Popover.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, clock } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        <Popover.Trigger {...props.trigger}>Open menu</Popover.Trigger>
        <Popover.Portal {...props.portal}>
          <Popover.Positioner>
            <Popover.Popup {...props.popup}>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerPopover },
    { name: 'detached triggers', Component: DetachedTriggerPopover },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersPopover },
  ])('when using $name', ({ Component: TestPopover }) => {
    it('should render the children', async () => {
      await render(<TestPopover />);

      expect(screen.getByText('Toggle')).not.toBe(null);
    });

    describe('uncontrolled open', () => {
      it('should close when the anchor is clicked twice', async () => {
        await render(<TestPopover />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.click(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(anchor);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('rewires dismiss interactions after closing and reopening', async () => {
        const { user } = await render(
          <TestPopover
            rootProps={{ modal: false }}
            popupProps={{ children: <Popover.Close>Close</Popover.Close> }}
          />,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        fireEvent.click(document.body);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe('controlled open', () => {
      it('should call onChange when the open state changes', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestPopover
              rootProps={{
                open,
                onOpenChange: (nextOpen) => {
                  handleChange(open);
                  setOpen(nextOpen);
                },
              }}
            />
          );
        }

        await render(<App />);

        expect(screen.queryByText('Content')).toBe(null);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.click(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(anchor);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('unmounts on a normal close after preventUnmountOnClose and external reopen', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const preventNextUnmountRef = React.useRef(true);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setOpen(true)}>
                Open externally
              </button>
              <TestPopover
                rootProps={{
                  open,
                  onOpenChange(nextOpen, details) {
                    if (!nextOpen && preventNextUnmountRef.current) {
                      preventNextUnmountRef.current = false;
                      details.preventUnmountOnClose();
                    }

                    setOpen(nextOpen);
                  },
                }}
              />
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);
        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Open externally' }));
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestPopover
                rootProps={{ open, onOpenChange: setOpen }}
                triggerProps={{ openOnHover: true, delay: 0 }}
              />
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestPopover
              rootProps={{ open, onOpenChange: setOpen }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          );
        }

        await render(<App />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        expect(screen.queryByRole('dialog')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it('cleans up the safe polygon handler after a hover-opened popup becomes click-sticky', async () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        try {
          await render(
            <TestPopover
              rootProps={{ modal: false }}
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');

          fireEvent.mouseLeave(trigger, { relatedTarget: positioner });
          fireEvent.mouseEnter(positioner);

          let documentMouseMoveHandler: EventListenerOrEventListenerObject | undefined;
          for (let i = addEventListenerSpy.mock.calls.length - 1; i >= 0; i -= 1) {
            const [eventName, listener] = addEventListenerSpy.mock.calls[i];
            if (eventName === 'mousemove') {
              documentMouseMoveHandler = listener;
              break;
            }
          }

          expect(documentMouseMoveHandler).toEqual(expect.any(Function));

          fireEvent.click(trigger);
          await flushMicrotasks();

          fireEvent.mouseLeave(positioner);

          expect(screen.queryByRole('dialog')).not.toBe(null);
          expect(removeEventListenerSpy).toHaveBeenCalledWith(
            'mousemove',
            documentMouseMoveHandler,
          );
        } finally {
          addEventListenerSpy.mockRestore();
          removeEventListenerSpy.mockRestore();
        }
      });
    });

    describe('nested menu interactions', () => {
      it('keeps the popover open when a nested menu opens via Enter using a shared container', async () => {
        vi.spyOn(console, 'error').mockImplementation((...args) => {
          if (args[0] === 'null') {
            // a bug in vitest prints specific browser errors as "null"
            // See https://github.com/vitest-dev/vitest/issues/9285
            // TODO(@mui/base): debug why this test triggers "ResizeObserver loop completed with undelivered notifications"
            // It seems related to @testing-library/user-event. Native vitest `userEvent` does not trigger it.
            return;
          }
          console.error(...args);
        });

        function Test() {
          const [dialogNode, setDialogNode] = React.useState<HTMLDialogElement | null>(null);
          const handleDialogRef = React.useCallback((node: HTMLDialogElement | null) => {
            if (node) {
              setDialogNode(node);
            }
          }, []);

          return (
            <dialog open ref={handleDialogRef}>
              <TestPopover
                portalProps={{ container: dialogNode ?? undefined }}
                popupProps={{
                  children: (
                    <Menu.Root>
                      <Menu.Trigger>Open nested</Menu.Trigger>
                      <Menu.Portal container={dialogNode ?? undefined}>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="menu-popup">Nested Menu</Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  ),
                }}
              />
            </dialog>
          );
        }

        const { user } = await render(<Test />);

        const popoverTrigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          popoverTrigger.focus();
        });

        await user.keyboard('{Enter}');
        await screen.findByTestId('popover-popup');

        const nestedTrigger = await screen.findByRole('button', { name: 'Open nested' });

        await act(async () => {
          nestedTrigger.focus();
        });

        await user.keyboard('{Enter}');
        await screen.findByTestId('menu-popup');

        expect(screen.getByTestId('popover-popup')).not.toBe(null);
      });

      it('keeps the popover open when a nested menu opens via pointer using a shared container', async () => {
        vi.spyOn(console, 'error').mockImplementation((...args) => {
          if (args[0] === 'null') {
            // a bug in vitest prints specific browser errors as "null"
            // See https://github.com/vitest-dev/vitest/issues/9285
            // TODO(@mui/base): debug why this test triggers "ResizeObserver loop completed with undelivered notifications"
            // It seems related to @testing-library/user-event. Native vitest `userEvent` does not trigger it.
            return;
          }
          console.error(...args);
        });

        function Test() {
          const [dialogNode, setDialogNode] = React.useState<HTMLDialogElement | null>(null);
          const handleDialogRef = React.useCallback((node: HTMLDialogElement | null) => {
            if (node) {
              setDialogNode(node);
            }
          }, []);

          return (
            <dialog open ref={handleDialogRef}>
              <TestPopover
                portalProps={{ container: dialogNode ?? undefined }}
                popupProps={{
                  children: (
                    <Menu.Root>
                      <Menu.Trigger>Open nested</Menu.Trigger>
                      <Menu.Portal container={dialogNode ?? undefined}>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="menu-popup">
                            <Menu.Item closeOnClick={false}>Item</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  ),
                }}
              />
            </dialog>
          );
        }

        const { user } = await render(<Test />);

        const popoverTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(popoverTrigger);
        await screen.findByTestId('popover-popup');

        const nestedTrigger = await screen.findByRole('button', { name: 'Open nested' });
        await user.click(nestedTrigger);
        await screen.findByTestId('menu-popup');

        const item = await screen.findByText('Item');
        await user.click(item);

        await waitFor(() => {
          expect(screen.getByTestId('popover-popup')).not.toBe(null);
        });
      });
    });

    describe('prop: defaultOpen', () => {
      it('should open when the component is rendered', async () => {
        await render(<TestPopover rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should not open when the component is rendered and open is controlled', async () => {
        await render(<TestPopover rootProps={{ defaultOpen: true, open: false }} />);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the component is rendered and open is controlled', async () => {
        await render(<TestPopover rootProps={{ defaultOpen: true, open: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should remain uncontrolled', async () => {
        await render(<TestPopover rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        const anchor = screen.getByTestId('trigger');

        fireEvent.click(anchor);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(
          <TestPopover rootProps={{ defaultOpen: true }} triggerProps={{ openOnHover: true }} />,
        );

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      clock.withFakeTimers();

      it('should open after delay with rest type by default', async () => {
        await render(<TestPopover triggerProps={{ openOnHover: true, delay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        clock.tick(100);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: closeDelay', () => {
      clock.withFakeTimers();

      it('should close after delay', async () => {
        await render(<TestPopover triggerProps={{ openOnHover: true, closeDelay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(anchor);

        clock.tick(50);

        expect(screen.getByText('Content')).not.toBe(null);

        clock.tick(50);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('hover close transitions', () => {
      it.skipIf(isJSDOM)(
        'reopens immediately when re-hovering the trigger during a hover close transition',
        async () => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

          const closeTransitionMs = 50;
          const style = `
            @keyframes popover-reopen-during-close {
              from {
                opacity: 1;
              }
              to {
                opacity: 0.01;
              }
            }

            .animation-test-indicator[data-ending-style] {
              animation: popover-reopen-during-close ${closeTransitionMs}ms linear forwards;
            }
          `;

          const { user } = await render(
            <React.Fragment>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <TestPopover
                portalProps={{ keepMounted: true }}
                // Popover.Trigger uses `delay` as `restMs`, so this remains a
                // rest-only hover reopen case with no fallback open delay.
                triggerProps={{ openOnHover: true, delay: 1 }}
                popupProps={{ className: 'animation-test-indicator' }}
              />
            </React.Fragment>,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await user.hover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-open');
          });

          await user.unhover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-ending-style');
          });

          // Re-enter without a follow-up mousemove so this only passes if the
          // close-transition fast path runs from `onMouseEnter`.
          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);

          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-open');
          });
          expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-closed');
        },
      );
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        await render(
          <TestPopover
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        fireEvent.click(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('onOpenChange cancel() prevents closing from a close press without changing the trigger', async () => {
        let closePressTriggerId: string | undefined;

        await render(
          <TestPopover
            triggerProps={{ id: 'trigger-1' }}
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.closePress) {
                  closePressTriggerId = eventDetails.trigger?.id;
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              children: (
                <Popover.Close data-testid="close" id="close-button">
                  Close
                </Popover.Close>
              ),
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        fireEvent.click(trigger);
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('close'));

        expect(closePressTriggerId).toBe('trigger-1');
        expect(screen.queryByTestId('close')).not.toBe(null);
      });

      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = await render(
          <TestPopover
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe('focus management', () => {
      it('focuses the trigger after the popover is closed but not unmounted', async () => {
        const { user } = await render(
          <div>
            <input type="text" />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{ children: <Popover.Close>Close</Popover.Close> }}
            />
            <input type="text" />
          </div>,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        await user.click(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        await user.click(close);

        await waitFor(
          () => {
            expect(toggle).toHaveFocus();
          },
          { timeout: 1500 },
        );
      });

      it('restores temporarily disabled focus before focusing a reopened keepMounted popover', async () => {
        const { user } = await render(
          <div>
            <input />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{ children: <button data-testid="inside">Inside</button> }}
              afterTrigger={<input data-testid="after" />}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        const inside = await screen.findByTestId('inside');
        await waitFor(() => {
          expect(inside).toHaveFocus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        await waitFor(() => {
          expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-open');
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(inside).toHaveFocus();
        });
      });

      it('does not move focus to the popover when opened with hover', async () => {
        const { user } = await render(
          <TestPopover
            triggerProps={{ openOnHover: true, delay: 0 }}
            popupProps={{ children: <Popover.Close>Close</Popover.Close> }}
          />,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        act(() => toggle.focus());

        await user.hover(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        expect(close).not.toBe(null);
        expect(close).not.to.toHaveFocus();
      });

      it('does not change focus when opened with hover and closed', async () => {
        const style = `
        .popup {
          width: 100px;
          height: 100px;
          background-color: red;
          opacity: 1;
          transition: opacity 1ms;
        }

        .popup[data-exiting] {
          opacity: 0;
        }
      `;

        const { user } = await render(
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <input type="text" data-testid="first-input" />
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
              popupProps={{ className: 'popup', children: null }}
            />
            <input type="text" data-testid="last-input" />
          </div>,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });
        const firstInput = screen.getByTestId('first-input');
        const lastInput = screen.getByTestId('last-input');

        await act(async () => lastInput.focus());

        await user.hover(toggle);
        await flushMicrotasks();

        await user.hover(firstInput);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

        expect(lastInput).toHaveFocus();
      });

      describe('with the popup following immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{ children: <input data-testid="input-inside" /> }}
                afterTrigger={<input data-testid="focus-target" />}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          await act(async () => inputInside.focus());

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        it('closes a nested combobox popup when tabbing out of the popover', async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: (
                    <Combobox.Root items={['a', 'b']}>
                      <Combobox.Input data-testid="combobox-input" />
                      <Combobox.Portal>
                        <Combobox.Positioner>
                          <Combobox.Popup>
                            <Combobox.List>
                              <Combobox.Item value="a">a</Combobox.Item>
                              <Combobox.Item value="b">b</Combobox.Item>
                            </Combobox.List>
                          </Combobox.Popup>
                        </Combobox.Positioner>
                      </Combobox.Portal>
                    </Combobox.Root>
                  ),
                }}
                afterTrigger={<input data-testid="focus-target" />}
              />
            </div>,
          );

          const comboboxInput = screen.getByTestId('combobox-input');
          await user.click(comboboxInput);
          await flushMicrotasks();

          expect(screen.getByRole('listbox')).toBeVisible();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-closed');
          });

          await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBe(null);
          });
        });

        it('closes a nested combobox popup when tabbing backward to the trigger', async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: (
                    <Combobox.Root items={['a', 'b']}>
                      <Combobox.Input data-testid="combobox-input" />
                      <Combobox.Portal>
                        <Combobox.Positioner>
                          <Combobox.Popup>
                            <Combobox.List>
                              <Combobox.Item value="a">a</Combobox.Item>
                              <Combobox.Item value="b">b</Combobox.Item>
                            </Combobox.List>
                          </Combobox.Popup>
                        </Combobox.Positioner>
                      </Combobox.Portal>
                    </Combobox.Root>
                  ),
                }}
              />
            </div>,
          );

          const comboboxInput = screen.getByTestId('combobox-input');
          await user.click(comboboxInput);
          await flushMicrotasks();

          expect(screen.getByRole('listbox')).toBeVisible();

          const trigger = screen.getByTestId('trigger');
          expect(trigger).not.toHaveAttribute('aria-hidden', 'true');

          await user.tab({ shift: true });

          expect(trigger).toHaveFocus();

          await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBe(null);
          });
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  popupProps={{ children: <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            const inputInside = screen.getByTestId('input-inside');
            await act(async () => inputInside.focus());

            await wait(50);
            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.keyboard('{Tab}');
            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );
      });

      describe('with focusable elements between the trigger and the popup', () => {
        it('moves focus to the element following the trigger when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                afterTrigger={<input data-testid="focus-target" />}
                popupProps={{ children: <input data-testid="input-inside" /> }}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          await act(async () => inputInside.focus());

          await user.tab();

          await waitFor(() => {
            expect(screen.getByTestId('focus-target')).toHaveFocus();
          });

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  afterTrigger={<input />}
                  popupProps={{ children: <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });

            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.tab();
            await wait(50);
            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );
      });

      describe('with the popup preceding immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                triggerPlacement="after-content"
                popupProps={{ children: <input data-testid="input-inside" /> }}
                afterTrigger={<input data-testid="focus-target" />}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          await act(async () => inputInside.focus());

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  triggerPlacement="after-content"
                  popupProps={{ children: <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            const inputInside = screen.getByTestId('input-inside');
            await act(async () => inputInside.focus());

            await wait(50);
            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.keyboard('{Tab}');

            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );
      });
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
            portalProps={{ children: <Popover.Backdrop data-testid="backdrop" /> }}
          />,
        );

        const backdrop = screen.getByTestId('backdrop');

        fireEvent.mouseDown(backdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        const internalBackdrop = document.querySelector('[role="presentation"]') as HTMLElement;

        fireEvent.mouseDown(internalBackdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(internalBackdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <React.Fragment>
              <button data-testid="outside">Outside</button>
              <TestPopover
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
                portalProps={{ container: shadowRoot }}
              />
            </React.Fragment>,
            { container },
          );

          const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;

          fireEvent.click(outsideButton);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
          expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
        } finally {
          await act(async () => {
            host.remove();
          });
        }
      });

      it('closing via outside press: works when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <TestPopover
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              portalProps={{ container: shadowRoot }}
            />,
            { container },
          );

          fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
          expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
        } finally {
          await act(async () => {
            host.remove();
          });
        }
      });
    });

    describe('non-modal focus transitions', () => {
      it('closes as soon as focus leaves the popup on pointer down outside', async () => {
        function TestCase() {
          return (
            <React.Fragment>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{ children: <button data-testid="inside">Inside</button> }}
              />
              <button data-testid="outside">Outside</button>
            </React.Fragment>
          );
        }

        await render(<TestCase />);

        const inside = screen.getByTestId('inside');
        await act(async () => {
          inside.focus();
        });

        const outside = screen.getByTestId('outside');

        fireEvent.pointerDown(outside);
        await act(async () => {
          outside.focus();
        });
        fireEvent.focusOut(inside, { relatedTarget: outside });

        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it.skipIf(isJSDOM)(
        'moves focus to the next element when tabbing out of a nested menu inside the popover',
        async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: (
                    <React.Fragment>
                      <button type="button" data-testid="before">
                        Before
                      </button>
                      <Menu.Root>
                        <Menu.Trigger>Menu</Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Item>Item</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>
                      <button type="button" data-testid="after">
                        After
                      </button>
                    </React.Fragment>
                  ),
                }}
              />
            </div>,
          );

          await user.click(screen.getByRole('button', { name: 'Menu' }));

          const menu = await screen.findByRole('menu');
          await waitFor(() => {
            expect(menu).toHaveFocus();
          });

          await user.tab();

          expect(screen.getByTestId('after')).toHaveFocus();
          expect(screen.queryByRole('menu')).toBe(null);
          expect(screen.getByTestId('popover-popup')).toBeVisible();
        },
      );
    });

    describe.skipIf(isJSDOM)('pointerdown removal', () => {
      it('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', async () => {
        function Test() {
          const [showButton, setShowButton] = React.useState(true);
          return (
            <TestPopover
              rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
              popupProps={{
                children: showButton && (
                  <button data-testid="remove" onPointerDown={() => setShowButton(false)}>
                    Remove on pointer down
                  </button>
                ),
              }}
            />
          );
        }

        const { user } = await render(<Test />);

        const removeButton = screen.getByTestId('remove');
        await waitFor(() => {
          expect(removeButton).toHaveFocus();
        });
        fireEvent.pointerDown(removeButton);

        const popup = screen.getByTestId('popover-popup');
        await waitFor(() => {
          expect(popup).toHaveFocus();
        });

        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the popover when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = await render(
          <TestPopover
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await act(async () => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('closes the popover when the `close` method is called', async () => {
        const actionsRef = React.createRef<Popover.Root.Actions>();
        await render(<TestPopover rootProps={{ defaultOpen: true, actionsRef }} />);

        await act(async () => {
          actionsRef.current!.close();
        });

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestPopover rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should only render focus guards inside the popup when `true`', async () => {
        const { user } = await render(
          <div>
            <TestPopover
              rootProps={{ modal: true }}
              popupProps={{ children: <Popover.Close>Close</Popover.Close> }}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        expect(
          trigger.previousElementSibling?.hasAttribute('data-base-ui-focus-guard') ?? false,
        ).toBe(false);
        expect(trigger.nextElementSibling?.hasAttribute('data-base-ui-focus-guard') ?? false).toBe(
          false,
        );
        expect(
          document.querySelectorAll('[data-base-ui-focus-guard][data-type="inside"]'),
        ).toHaveLength(2);
      });

      it('should keep trigger focus guards when `true` without a close part', async () => {
        const { user } = await render(
          <div>
            <TestPopover
              rootProps={{ defaultOpen: true, modal: true }}
              popupProps={{ children: <input data-testid="input-inside" /> }}
              afterTrigger={<input data-testid="focus-target" />}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        expect(trigger.previousElementSibling).toHaveAttribute('data-base-ui-focus-guard');
        expect(trigger.nextElementSibling).toHaveAttribute('data-base-ui-focus-guard');

        await act(async () => {
          screen.getByTestId('input-inside').focus();
        });

        await user.tab();

        expect(screen.getByTestId('focus-target')).toHaveFocus();

        await waitFor(() => {
          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestPopover rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });

      describe('with openOnHover', () => {
        clock.withFakeTimers();

        it('enables modal behavior after a hover-open is clicked', async () => {
          await render(
            <TestPopover
              rootProps={{ modal: true }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();

          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });

        it('reopens on hover after an impatient click is followed by a close button press', async () => {
          await render(
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 100 }}
              popupProps={{ children: <Popover.Close>Close</Popover.Close> }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).not.toBe(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);
          await flushMicrotasks();

          fireEvent.click(screen.getByRole('button', { name: 'Close' }));
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).not.toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('touch scroll lock', () => {
        it('applies scroll lock when a touch-opened popup covers the viewport width', async () => {
          await render(
            <Popover.Root modal>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner
                  data-testid="positioner"
                  style={{ width: 'calc(100vw - 10px)' }}
                >
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Open' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);
          fireEvent.click(trigger, { detail: 1 });

          const popup = await screen.findByRole('dialog');
          const doc = popup.ownerDocument;

          await waitFor(() => {
            const isScrollLocked =
              doc.documentElement.style.overflow === 'hidden' ||
              doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
              doc.body.style.overflow === 'hidden';

            expect(isScrollLocked).toBe(true);
          });
        });

        it('does not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
          await render(
            <Popover.Root modal>
              <Popover.Trigger>Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner data-testid="positioner" style={{ width: '240px' }}>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Open' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);
          fireEvent.click(trigger, { detail: 1 });

          const popup = await screen.findByRole('dialog');
          const doc = popup.ownerDocument;

          await act(async () => {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          });

          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(false);
        });
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('is called on close when there is no exit animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(true);
          return (
            <div>
              <button onClick={() => setOpen(false)}>Close</button>
              <TestPopover
                rootProps={{ open, onOpenChangeComplete }}
                popupProps={{ children: null }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
      });

      it('is called on close when the exit animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = React.useState(true);

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(false)}>Close</button>
              <TestPopover
                rootProps={{ open, onOpenChangeComplete }}
                popupProps={{ className: 'animation-test-indicator', children: null }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        expect(screen.getByTestId('popover-popup')).not.toBe(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
      });

      it('is called on open when there is no enter animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(false);
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open</button>
              <TestPopover
                rootProps={{ open, onOpenChangeComplete }}
                popupProps={{ children: null }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popover-popup')).not.toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls.length).toBe(2);
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      it('is called on open when the enter animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = React.useState(false);

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(true)}>Open</button>
              <TestPopover
                rootProps={{
                  open,
                  onOpenChange: (nextOpen) => setOpen(nextOpen),
                  onOpenChangeComplete,
                }}
                popupProps={{ className: 'animation-test-indicator', children: null }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        expect(screen.queryByTestId('popover-popup')).not.toBe(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = vi.fn();

        await render(
          <TestPopover rootProps={{ onOpenChangeComplete }} popupProps={{ children: null }} />,
        );

        expect(onOpenChangeComplete.mock.calls.length).toBe(0);
      });
    });

    describe('nested popup interactions', () => {
      it('returns focus through nested programmatic popovers in close order', async () => {
        function Test() {
          const [childOpen, setChildOpen] = React.useState(false);

          return (
            <Popover.Root>
              <Popover.Trigger>Parent trigger</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="parent-popup">
                    <button type="button" onClick={() => setChildOpen(true)}>
                      Open child programmatically
                    </button>

                    <Popover.Root
                      open={childOpen}
                      triggerId="child-reference"
                      onOpenChange={setChildOpen}
                    >
                      <Popover.Trigger id="child-reference">Child reference</Popover.Trigger>
                      <Popover.Portal>
                        <Popover.Positioner>
                          <Popover.Popup data-testid="child-popup">
                            <Popover.Close>Close child</Popover.Close>
                          </Popover.Popup>
                        </Popover.Positioner>
                      </Popover.Portal>
                    </Popover.Root>

                    <Popover.Close>Close parent</Popover.Close>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        }

        const { user } = await render(<Test />);

        const parentTrigger = screen.getByRole('button', { name: 'Parent trigger' });
        await user.click(parentTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        });

        const childOpener = screen.getByRole('button', {
          name: 'Open child programmatically',
        });
        await user.click(childOpener);

        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).not.toBe(null);
        });

        await user.click(screen.getByRole('button', { name: 'Close child' }));

        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).toBe(null);
        });
        expect(childOpener).toHaveFocus();
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Close parent' }));

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).toBe(null);
        });
        expect(parentTrigger).toHaveFocus();
      });

      it('keeps the parent popover open when press starts in nested popover and ends outside', async () => {
        function Test() {
          return (
            <div>
              <button type="button" data-testid="outside">
                Outside
              </button>

              <Popover.Root defaultOpen>
                <Popover.Trigger>Parent</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="parent-popup">
                      <Popover.Root>
                        <Popover.Trigger>Child</Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Positioner>
                            <Popover.Popup data-testid="child-popup">Child content</Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </Popover.Root>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
          );
        }

        await render(<Test />);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        const childTrigger = screen.getByRole('button', { name: 'Child' });

        fireEvent.click(childTrigger);

        const childPopup = await screen.findByTestId('child-popup');
        const outside = screen.getByTestId('outside');

        fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
        fireEvent.click(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        });
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });

      it.skipIf(isJSDOM)(
        'should not close popover when scrolling nested popup on touch',
        async () => {
          const fruits = Array.from({ length: 50 }, (_, i) => i);
          await render(
            <TestPopover
              rootProps={{ defaultOpen: true }}
              popupProps={{
                children: (
                  <Combobox.Root items={fruits} defaultOpen>
                    <Combobox.Input placeholder="Choose a fruit" />
                    <Combobox.Portal>
                      <Combobox.Positioner>
                        <Combobox.Popup
                          data-testid="combobox-popup"
                          style={{ maxHeight: 200, overflow: 'auto' }}
                        >
                          <Combobox.List>
                            {(item: string) => (
                              <Combobox.Item key={item} value={item} style={{ height: 100 }}>
                                {item}
                              </Combobox.Item>
                            )}
                          </Combobox.List>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                ),
              }}
            />,
          );

          const popoverPopup = screen.getByTestId('popover-popup');
          expect(popoverPopup).not.toBe(null);

          await flushMicrotasks();

          const comboboxPopup = screen.getByTestId('combobox-popup');
          expect(comboboxPopup).not.toBe(null);

          // Simulate touch scroll: touchstart + touchmove on the scrollable list
          const touch1 = new Touch({
            identifier: 1,
            target: comboboxPopup,
            clientX: 100,
            clientY: 100,
          });

          fireEvent.touchStart(comboboxPopup, {
            touches: [touch1],
          });

          // Wait for the markInsideReactTree timeout to finish
          await new Promise((resolve) => {
            setTimeout(resolve);
          });

          const touch2 = new Touch({
            identifier: 1,
            target: comboboxPopup,
            clientX: 100,
            clientY: 50,
          });

          fireEvent.touchMove(comboboxPopup, {
            touches: [touch2],
          });

          fireEvent.touchEnd(comboboxPopup, {
            changedTouches: [touch2],
          });

          await flushMicrotasks();

          expect(screen.queryByTestId('popover-popup')).not.toBe(null);
          expect(screen.queryByTestId('combobox-popup')).not.toBe(null);
        },
      );

      it('should close child popover when clicking parent popover', async () => {
        const { user } = await render(
          <TestPopover
            triggerProps={{ 'data-testid': 'parent-trigger' } as Popover.Trigger.Props}
            popupProps={
              {
                'data-testid': 'parent-popup',
                children: (
                  <ContainedTriggerPopover
                    triggerProps={{ 'data-testid': 'child-trigger' } as Popover.Trigger.Props}
                    popupProps={
                      { 'data-testid': 'child-popup', children: null } as Popover.Popup.Props
                    }
                  />
                ),
              } as Popover.Popup.Props
            }
          />,
        );

        expect(screen.queryByTestId('parent-popup')).toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const parentTrigger = screen.getByTestId('parent-trigger');
        await user.click(parentTrigger);
        await flushMicrotasks();

        const parentPopup = screen.getByTestId('parent-popup');

        expect(parentPopup).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const childTrigger = screen.getByTestId('child-trigger');
        await user.click(childTrigger);
        await flushMicrotasks();

        expect(parentPopup).not.toBe(null);
        expect(screen.getByTestId('child-popup')).not.toBe(null);

        await user.click(parentPopup);
        await flushMicrotasks();

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);
      });
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('does not leak from a canceled close into a synchronous second close', async () => {
      const popover = Popover.createHandle();

      function App() {
        const closeAttemptsRef = React.useRef(0);

        return (
          <React.Fragment>
            <button type="button" onClick={() => popover.close()}>
              Close popover
            </button>
            <Popover.Root
              handle={popover}
              defaultOpen
              defaultTriggerId="trigger"
              onOpenChange={(open, details) => {
                if (open) {
                  return;
                }

                closeAttemptsRef.current += 1;

                if (closeAttemptsRef.current === 1) {
                  details.preventUnmountOnClose();
                  details.cancel();
                  popover.close();
                }
              }}
            >
              <Popover.Trigger handle={popover} id="trigger">
                Toggle
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close popover' }));

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });

    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const popover = Popover.createHandle();

      function App() {
        const [showRoot, setShowRoot] = React.useState(true);
        const [remountOpen, setRemountOpen] = React.useState(false);
        const preventNextUnmountRef = React.useRef(true);

        return (
          <React.Fragment>
            <button type="button" onClick={() => setShowRoot(false)}>
              Unmount root
            </button>
            <button
              type="button"
              onClick={() => {
                setRemountOpen(true);
                setShowRoot(true);
              }}
            >
              Remount open
            </button>
            {showRoot && (
              <Popover.Root
                handle={popover}
                defaultOpen={remountOpen}
                defaultTriggerId="trigger"
                onOpenChange={(open, details) => {
                  if (!open && preventNextUnmountRef.current) {
                    preventNextUnmountRef.current = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Popover.Trigger handle={popover} id="trigger">
                  Toggle
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="popup">Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            )}
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByTestId('popup')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
    });
  });
});

type TestPopoverProps = {
  rootProps?: Popover.Root.Props;
  triggerProps?: Popover.Trigger.Props;
  portalProps?: Popover.Portal.Props;
  positionerProps?: Popover.Positioner.Props;
  popupProps?: Popover.Popup.Props;
  triggerPlacement?: 'before-content' | 'after-content';
  beforeTrigger?: React.ReactNode;
  afterTrigger?: React.ReactNode;
  includeTrigger?: boolean;
};

function ContainedTriggerPopover(props: TestPopoverProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    triggerPlacement = 'before-content',
    afterTrigger,
    includeTrigger = true,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const renderPortal = () => (
    <Popover.Portal {...restPortalProps}>
      {portalChildren}
      <Popover.Positioner data-testid="positioner" {...positionerProps}>
        <Popover.Popup data-testid="popover-popup" {...restPopupProps}>
          {popupChildren ?? 'Content'}
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  );

  const triggerElement = includeTrigger ? (
    <Popover.Trigger data-testid="trigger" {...restTriggerProps}>
      {triggerChildren ?? 'Toggle'}
    </Popover.Trigger>
  ) : null;

  return (
    <Popover.Root {...rootProps}>
      {triggerPlacement === 'before-content' ? (
        <React.Fragment>
          {triggerElement}
          {afterTrigger}
          {renderPortal()}
        </React.Fragment>
      ) : (
        <React.Fragment>
          {renderPortal()}
          {triggerElement}
          {afterTrigger}
        </React.Fragment>
      )}
    </Popover.Root>
  );
}

function DetachedTriggerPopover(props: TestPopoverProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    triggerPlacement = 'before-content',
    afterTrigger,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const popoverHandle = useRefWithInit(() => Popover.createHandle()).current;

  return (
    <React.Fragment>
      {triggerPlacement === 'before-content' && (
        <React.Fragment>
          <Popover.Trigger data-testid="trigger" handle={popoverHandle} {...restTriggerProps}>
            {triggerChildren ?? 'Toggle'}
          </Popover.Trigger>
          {afterTrigger}
        </React.Fragment>
      )}
      <ContainedTriggerPopover
        rootProps={{ ...rootProps, handle: popoverHandle }}
        portalProps={portalProps}
        positionerProps={positionerProps}
        popupProps={popupProps}
        includeTrigger={false}
      />
      {triggerPlacement === 'after-content' && (
        <React.Fragment>
          <Popover.Trigger data-testid="trigger" handle={popoverHandle} {...restTriggerProps}>
            {triggerChildren ?? 'Toggle'}
          </Popover.Trigger>
          {afterTrigger}
        </React.Fragment>
      )}
    </React.Fragment>
  );
}

function MultipleDetachedTriggersPopover(props: TestPopoverProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    afterTrigger,
    triggerPlacement = 'before-content',
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const popoverHandle = useRefWithInit(() => Popover.createHandle()).current;

  const renderTriggers = () => (
    <React.Fragment>
      <Popover.Trigger data-testid="trigger" handle={popoverHandle} {...restTriggerProps}>
        {triggerChildren ?? 'Toggle'}
      </Popover.Trigger>
      {afterTrigger}
      <Popover.Trigger data-testid="trigger-2" handle={popoverHandle}>
        Toggle another
      </Popover.Trigger>
    </React.Fragment>
  );

  return (
    <React.Fragment>
      {triggerPlacement === 'before-content' && <React.Fragment>{renderTriggers()}</React.Fragment>}
      <ContainedTriggerPopover
        rootProps={{ ...rootProps, handle: popoverHandle }}
        portalProps={portalProps}
        positionerProps={positionerProps}
        popupProps={popupProps}
        includeTrigger={false}
      />
      {triggerPlacement === 'after-content' && <React.Fragment>{renderTriggers()}</React.Fragment>}
    </React.Fragment>
  );
}
