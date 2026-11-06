import { expect, vi } from 'vitest';
import * as React from 'react';
import { Tooltip } from '@base-ui/react/tooltip';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { OPEN_DELAY } from '../utils/constants';
import { REASONS } from '../../internals/reasons';

describe('<Tooltip.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  afterEach(async () => {
    await act(async () => {
      document.body.click();
    });
  });

  const { render, clock } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Tooltip.Root {...props.root}>
        <Tooltip.Trigger {...props.trigger}>Open menu</Tooltip.Trigger>
        <Tooltip.Portal {...props.portal}>
          <Tooltip.Positioner>
            <Tooltip.Popup {...props.popup}>Content</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerTooltip },
    { name: 'detached triggers', Component: DetachedTriggerTooltip },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersTooltip },
  ])('when using $name', ({ Component: TestTooltip }) => {
    describe('uncontrolled open', () => {
      clock.withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();
        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async ({ skip }) => {
        if (isJSDOM) {
          skip();
        }

        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => trigger.focus());

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        await act(async () => {
          trigger.blur();
        });

        clock.tick(OPEN_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('controlled open', () => {
      clock.withFakeTimers();
      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestTooltip
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

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('should not call onChange when the open state does not change', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestTooltip
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

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
        expect(handleChange.mock.calls.length).toBe(1);
        expect(handleChange.mock.calls[0][0]).toBe(false);
      });
    });

    describe('prop: defaultOpen', () => {
      it('should open when the component is rendered', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should not open when the component is rendered and open is controlled', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true, open: false }} />);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the component is rendered and open is controlled', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true, open: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should remain uncontrolled', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true }} />);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseLeave(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: delay', () => {
      clock.withFakeTimers();

      it('should open after rest delay', async () => {
        await render(<TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

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
        await render(<TestTooltip triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);

        expect(screen.getByText('Content')).not.toBe(null);

        clock.tick(100);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('preventUnmountOnClose()', () => {
      it('does not prevent unmounting on later closes', async () => {
        let preventNextClose = true;
        const { user } = await render(
          <TestTooltip
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextClose) {
                  preventNextClose = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.hover(trigger);

        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the tooltip when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = await render(
          <TestTooltip
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await user.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).not.toBe(null);
        });

        await act(async () => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByTestId('positioner')).toBe(null);
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
              <Tooltip.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
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
              <Tooltip.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup className="animation-test-indicator" data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        expect(screen.getByTestId('popup')).not.toBe(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
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
              <Tooltip.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).not.toBe(null);
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
              <Tooltip.Root
                open={open}
                onOpenChange={setOpen}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup className="animation-test-indicator" data-testid="popup" />
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
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

        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = vi.fn();

        await render(
          <Tooltip.Root onOpenChangeComplete={onOpenChangeComplete}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="popup" />
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>,
        );

        expect(onOpenChangeComplete.mock.calls.length).toBe(0);
      });
    });

    describe.skipIf(isJSDOM)('animations', () => {
      it('toggles instant animations for adjacent tooltips only while opening', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const style = `
          .tooltip {
            transition: opacity 20ms;
          }
          .tooltip[data-starting-style],
          .tooltip[data-ending-style] {
            opacity: 0;
          }

          .tooltip[data-instant] {
            transition: none;
          }
        `;

        const { user } = await render(
          <Tooltip.Provider>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-1" delay={0}>
                First
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup className="tooltip" data-testid="popup-1">
                    First tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="trigger-2" delay={0}>
                Second
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup className="tooltip" data-testid="popup-2">
                    Second tooltip
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>,
        );

        const firstTrigger = screen.getByTestId('trigger-1');
        const secondTrigger = screen.getByTestId('trigger-2');

        await user.hover(firstTrigger);

        const firstPopup = await screen.findByTestId('popup-1');
        expect(firstPopup.dataset.instant).toBe(undefined);

        await user.unhover(firstTrigger);
        await user.hover(secondTrigger);

        const secondPopup = await screen.findByTestId('popup-2');

        await waitFor(() => {
          expect(secondPopup.dataset.instant).toBe('delay');
          expect(secondPopup.getAnimations().length).toBe(0);
        });

        await user.unhover(secondTrigger);

        await waitFor(() => {
          expect(secondPopup.dataset.endingStyle).toBe('');
          expect(secondPopup.dataset.instant).toBe(undefined);
          expect(secondPopup.getAnimations().length).toBe(1);
        });
      });

      it('inline opacity: 0 is removed before user CSS transitions run', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        // The inline opacity: 0 applied before positioning must be removed
        // before CSS transitions start, so it does not trigger an unwanted
        // opacity transition.
        const style = `
          .tooltip {
            transition: opacity 200ms;
            opacity: 1;
          }
        `;

        const { user } = await render(
          <Tooltip.Root>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Tooltip.Trigger data-testid="trigger" delay={0}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup className="tooltip" data-testid="popup">
                  Tooltip
                </Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>,
        );

        await user.hover(screen.getByTestId('trigger'));

        const popup = await screen.findByTestId('popup');

        // Opacity should be 1 immediately — no unwanted fade from 0 to 1.
        // No opacity transition should be running.
        await waitFor(() => {
          expect(Number(getComputedStyle(popup).opacity)).toBe(1);
          const opacityAnimations = popup
            .getAnimations()
            .filter((a) => (a as CSSTransition).transitionProperty === 'opacity');
          expect(opacityAnimations.length).toBe(0);
        });
      });
    });

    describe('prop: disabled', () => {
      it('should not open when disabled', async () => {
        await render(<TestTooltip rootProps={{ disabled: true }} triggerProps={{ delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        await act(async () => trigger.focus());

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open on focus when the trigger is disabled', async () => {
        await render(<TestTooltip triggerProps={{ disabled: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => trigger.focus());
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should close if open when becoming disabled', async () => {
        function App() {
          const [disabled, setDisabled] = React.useState(false);
          return (
            <div>
              <TestTooltip
                rootProps={{ defaultOpen: true, disabled }}
                triggerProps={{ delay: 0 }}
              />
              <button
                data-testid="disabled"
                onClick={() => {
                  setDisabled(true);
                }}
              />
            </div>
          );
        }

        await render(<App />);

        expect(screen.queryByText('Content')).not.toBe(null);

        const disabledButton = screen.getByTestId('disabled');
        fireEvent.click(disabledButton);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not throw error when combined with defaultOpen', async () => {
        await render(<TestTooltip rootProps={{ defaultOpen: true, disabled: true }} />);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: disableHoverablePopup', () => {
      it('applies pointer-events: none to the positioner when `disableHoverablePopup = true`', async () => {
        await render(
          <TestTooltip rootProps={{ disableHoverablePopup: true }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('none');
      });

      it('does not apply pointer-events: none to the positioner when `disableHoverablePopup = false`', async () => {
        await render(
          <TestTooltip rootProps={{ disableHoverablePopup: false }} triggerProps={{ delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.getByTestId('positioner').style.pointerEvents).toBe('');
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        await render(
          <TestTooltip
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('allowPropagation() prevents stopPropagation on Escape while still closing', async () => {
        const stopPropagationSpy = vi.spyOn(Event.prototype as any, 'stopPropagation');

        await render(
          <TestTooltip
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.escapeKey) {
                  eventDetails.allowPropagation();
                }
              },
            }}
            triggerProps={{ delay: 0 }}
          />,
        );

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });

        expect(stopPropagationSpy).toHaveBeenCalledTimes(0);
        stopPropagationSpy.mockRestore();
      });
    });

    describe('dismissal', () => {
      clock.withFakeTimers();

      it('should not open when the trigger was clicked before delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not open when the trigger receives pointerdown before delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger was clicked before delay duration and closeOnClick is false', async () => {
        await render(<TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY / 2);

        fireEvent.click(trigger);

        clock.tick(OPEN_DELAY / 2);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is clicked after delay duration', async () => {
        await render(<TestTooltip />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the trigger is clicked after delay duration and closeOnClick is false', async () => {
        await render(<TestTooltip triggerProps={{ closeOnClick: false }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('reopens on hover after the trigger is clicked closed', async () => {
        await render(<TestTooltip triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.click(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        // Re-enter with mouse events only. A fresh pointerenter can be missed
        // after the click-driven close, but hover should still work.
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const tooltip = Tooltip.createHandle();

      function App() {
        const [showRoot, setShowRoot] = React.useState(true);
        const [remountOpen, setRemountOpen] = React.useState(false);
        const preventNextUnmountRef = React.useRef(true);

        return (
          <React.Fragment>
            <Tooltip.Trigger handle={tooltip} id="trigger" delay={0}>
              Toggle
            </Tooltip.Trigger>
            <button type="button" onClick={() => tooltip.open('trigger')}>
              Open tooltip
            </button>
            <button type="button" onClick={() => tooltip.close()}>
              Close tooltip
            </button>
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
              <Tooltip.Root
                handle={tooltip}
                defaultOpen={remountOpen}
                defaultTriggerId="trigger"
                onOpenChange={(open, details) => {
                  if (!open && preventNextUnmountRef.current) {
                    preventNextUnmountRef.current = false;
                    details.preventUnmountOnClose();
                  }
                }}
              >
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner">
                    <Tooltip.Popup>Content</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(screen.getByRole('button', { name: 'Open tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).not.toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(trigger).not.toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByTestId('positioner')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('positioner')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Close tooltip' }));
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });
    });
  });

  it.skipIf(isJSDOM)(
    'tracks the cursor on the first delayed hover when trackCursorAxis is x',
    async () => {
      await render(
        <div style={{ paddingTop: 100, paddingLeft: 40 }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={{ width: 300, height: 40 }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: 40, height: 20 }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', clientX: cursorX, clientY: cursorY });
      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const positioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = positioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - cursorX)).toBeLessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'stops tracking the cursor after trackCursorAxis is disabled while closed',
    async () => {
      function App() {
        const [trackCursorAxis, setTrackCursorAxis] = React.useState<'none' | 'x'>('x');

        return (
          <div style={{ paddingTop: 100, paddingLeft: 40 }}>
            <button onClick={() => setTrackCursorAxis('none')}>Disable tracking</button>
            <Tooltip.Root trackCursorAxis={trackCursorAxis}>
              <Tooltip.Trigger delay={100} style={{ width: 300, height: 40 }}>
                Trigger
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner" side="bottom">
                  <Tooltip.Popup style={{ width: 40, height: 20 }}>Tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </div>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const cursorX = triggerRect.left + 240;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, { pointerType: 'mouse', clientX: cursorX, clientY: cursorY });
      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const trackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = trackedPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - cursorX)).toBeLessThanOrEqual(2);
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Disable tracking' }));

      fireEvent.mouseEnter(trigger, { clientX: cursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: cursorX, clientY: cursorY });

      const untrackedPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = untrackedPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        const triggerCenterX = triggerRect.left + triggerRect.width / 2;

        expect(Math.abs(positionerCenterX - triggerCenterX)).toBeLessThanOrEqual(2);
      });
    },
  );

  it.skipIf(isJSDOM)(
    'updates the tracked cursor position after closing and reopening',
    async () => {
      await render(
        <div style={{ paddingTop: 100, paddingLeft: 40 }}>
          <Tooltip.Root trackCursorAxis="x">
            <Tooltip.Trigger delay={100} style={{ width: 300, height: 40 }}>
              Trigger
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner data-testid="positioner" side="bottom">
                <Tooltip.Popup style={{ width: 40, height: 20 }}>Tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const triggerRect = trigger.getBoundingClientRect();
      const firstCursorX = triggerRect.left + 240;
      const secondCursorX = triggerRect.left + 60;
      const cursorY = triggerRect.top + 20;

      fireEvent.pointerDown(trigger, {
        pointerType: 'mouse',
        clientX: firstCursorX,
        clientY: cursorY,
      });
      fireEvent.mouseEnter(trigger, { clientX: firstCursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: firstCursorX, clientY: cursorY });

      const firstPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = firstPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - firstCursorX)).toBeLessThanOrEqual(2);
      });

      fireEvent.mouseLeave(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('positioner')).toBe(null);
      });

      fireEvent.mouseEnter(trigger, { clientX: secondCursorX, clientY: cursorY });
      fireEvent.mouseMove(trigger, { clientX: secondCursorX, clientY: cursorY });

      const secondPositioner = await screen.findByTestId('positioner');

      await waitFor(() => {
        const positionerRect = secondPositioner.getBoundingClientRect();
        const positionerCenterX = positionerRect.left + positionerRect.width / 2;
        expect(Math.abs(positionerCenterX - secondCursorX)).toBeLessThanOrEqual(2);
      });
    },
  );

  it('keeps the tooltip open when moving across spaced triggers without a closeDelay', async () => {
    const testTooltip = Tooltip.createHandle();
    const { user } = await render(
      <Tooltip.Provider timeout={400}>
        <div style={{ display: 'flex', gap: 32 }}>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>
        </div>

        <Tooltip.Root handle={testTooltip}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="popup">Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const [trigger1, trigger2, trigger3] = screen.getAllByRole('button');

    await user.hover(trigger1);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    await user.unhover(trigger1);
    await user.hover(trigger2);
    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseLeave(trigger2, { relatedTarget: document.body, clientX: 120, clientY: 0 });
    await user.hover(trigger3);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    fireEvent.mouseMove(document.body, { clientX: 300, clientY: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  });
});

describe('nested tooltips', () => {
  const { render, clock } = createRenderer();
  clock.withFakeTimers();

  it('should not open the outer tooltip when hovering over a nested tooltip trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when moving between sibling nested triggers', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-a-trigger">Inner A</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-a-popup">Inner A tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-b-trigger">Inner B</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-b-popup">Inner B tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerATrigger = screen.getByTestId('inner-a-trigger');
    const innerBTrigger = screen.getByTestId('inner-b-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerATrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(innerATrigger);
    fireEvent.mouseOver(innerATrigger);
    fireEvent.mouseMove(innerATrigger, { clientX: 30, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-a-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-b-popup')).toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerATrigger, { relatedTarget: innerBTrigger });
    fireEvent.pointerEnter(innerBTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerBTrigger);
    fireEvent.mouseOver(innerBTrigger);
    fireEvent.mouseMove(innerBTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-a-popup')).toBe(null);
    expect(screen.getByTestId('inner-b-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open ancestor tooltips when hovering over a third-level nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="grandparent-trigger" render={<span />}>
          Grandparent
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="parent-trigger" render={<span />}>
              Parent
              <Tooltip.Root>
                <Tooltip.Trigger data-testid="child-trigger">Child</Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="child-popup">Child tooltip</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="parent-popup">Parent tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="grandparent-popup">Grandparent tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const grandparentTrigger = screen.getByTestId('grandparent-trigger');
    const parentTrigger = screen.getByTestId('parent-trigger');
    const childTrigger = screen.getByTestId('child-trigger');

    fireEvent.pointerEnter(grandparentTrigger, {
      pointerType: 'mouse',
      clientX: 10,
      clientY: 10,
    });
    fireEvent.mouseEnter(grandparentTrigger);
    fireEvent.pointerEnter(parentTrigger, { pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.mouseEnter(parentTrigger);
    fireEvent.pointerEnter(childTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(childTrigger);
    fireEvent.mouseOver(childTrigger);
    fireEvent.mouseMove(childTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('child-popup')).not.toBe(null);
    expect(screen.queryByTestId('parent-popup')).toBe(null);
    expect(screen.queryByTestId('grandparent-popup')).toBe(null);
  });

  it('should open the outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open a disabled outer tooltip when moving from a nested trigger to the parent area with zero delay', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={0} disabled>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerDown(innerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should reopen the delayed outer tooltip when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    await render(
      <Tooltip.Provider delay={delay}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
                Inner
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should support nested triggers inside a detached parent trigger', async () => {
    const delay = 100;
    const rowHandle = Tooltip.createHandle<string>();

    await render(
      <Tooltip.Provider delay={delay}>
        <Tooltip.Trigger
          handle={rowHandle}
          payload="Row"
          data-testid="outer-trigger"
          render={<div />}
        >
          <span data-testid="outer-area">Row</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>

        <Tooltip.Root handle={rowHandle}>
          {({ payload }) => (
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="outer-popup">{payload} tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          )}
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).toHaveTextContent('Row tooltip');
  });

  it('should not reopen the outer tooltip when rapidly moving back to a nested trigger', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);

    fireEvent.mouseOut(outerArea, { relatedTarget: innerTrigger });
    fireEvent.mouseOver(innerTrigger);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip when hovering the nested tooltip popup', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={0}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    const innerPopup = screen.getByTestId('inner-popup');
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOver(innerPopup);

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should cancel the pending parent reopen when the pointer leaves the parent trigger', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(delay);
    await flushMicrotasks();

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);

    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    clock.tick(delay);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should not open the outer tooltip when the pointer moves onto a nested trigger before the delay expires', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY / 2);

    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.pointerMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should restart the parent delay when moving from a nested trigger to the parent area', async () => {
    const delay = 100;

    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={delay}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={delay * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const outerArea = screen.getByTestId('outer-area');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(delay / 2);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();
    expect(screen.queryByTestId('outer-popup')).toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);

    clock.tick(delay / 2);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should close the outer tooltip when the pointer moves from outer area onto a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // First open the outer tooltip by hovering the outer area
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    // Now move onto the inner trigger — mouseover bubbles to the outer trigger,
    // which detects the nested trigger and closes itself.
    fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // The outer tooltip should close
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should keep a focus-opened outer tooltip open when hovering over a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span tabIndex={0} />}>
          <span>Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    await act(async () => {
      outerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should keep a controlled-open outer tooltip open when hovering over a nested trigger', async () => {
    const onOpenChange = vi.fn();

    await render(
      <Tooltip.Root open onOpenChange={onOpenChange}>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span>Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');

    expect(screen.getByTestId('outer-popup')).not.toBe(null);

    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('should not open the outer tooltip when focusing a nested tooltip trigger', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render={<div />}>
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');

    await act(async () => {
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);
    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should close a focus-opened inner tooltip when the inner trigger loses focus', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root open={false}>
          <Tooltip.Trigger data-testid="outer-trigger" render={<div />}>
            row label
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">button with tooltip</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">inner popup</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
            <button data-testid="after">button</button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">outer popup</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const innerTrigger = screen.getByTestId('inner-trigger');
    const after = screen.getByTestId('after');

    await act(async () => {
      innerTrigger.focus();
    });
    await flushMicrotasks();

    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    await act(async () => {
      after.focus();
    });
    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should allow the parent tooltip to open when a nested trigger is disabled', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          Outer
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" disabled>
              Inner (disabled)
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    // The outer tooltip should open since the nested trigger is disabled
    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not open the outer tooltip when hovering over a nested trigger inside a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const container = document.createElement('div');
    shadowRoot.appendChild(container);

    try {
      await render(
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
            Outer
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger" render={<div />}>
                Inner
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
        { container },
      );

      const outerTrigger = shadowRoot.querySelector('[data-testid="outer-trigger"]') as HTMLElement;
      const innerTrigger = shadowRoot.querySelector('[data-testid="inner-trigger"]') as HTMLElement;
      const innerShadowRoot = innerTrigger.attachShadow({ mode: 'open' });
      const innerShadowTarget = document.createElement('span');
      innerShadowTarget.textContent = 'Inner shadow target';
      innerShadowRoot.appendChild(innerShadowTarget);

      // Hover the outer trigger first so the outer tooltip starts its open delay.
      fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
      fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
      fireEvent.mouseEnter(outerTrigger);
      fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

      // Move onto a target inside the inner trigger's shadow root before the delay expires.
      // The composed mouseover bubbles to the outer trigger, and the target
      // traversal walks out of the shadow tree to find the private marker on
      // the inner trigger, suppressing the outer tooltip.
      fireEvent.pointerEnter(innerTrigger, { clientX: 50, clientY: 10 });
      fireEvent.mouseEnter(innerTrigger);
      innerShadowTarget.dispatchEvent(
        new MouseEvent('mouseover', {
          bubbles: true,
          composed: true,
          clientX: 50,
          clientY: 10,
        }),
      );
      fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });

      clock.tick(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('outer-popup')).toBe(null);
    } finally {
      await act(async () => {
        host.remove();
      });
    }
  });

  it('should open the outer tooltip when hovering over the non-nested area', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
    expect(screen.queryByTestId('inner-popup')).toBe(null);
  });

  it('should not reopen the outer tooltip via the local reopen path for touch pointers', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // A touch interaction sets pointerTypeRef to 'touch'.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'touch', clientX: 50, clientY: 10 });
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    // Move from the inner trigger back to the outer area; the local reopen
    // path is gated on `isMouseLikePointerType`, so a touch pointer must not
    // queue or fire a reopen.
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should allow mouse hover after leaving a touch interaction', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />} delay={0}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    // Start with a touch interaction, then leave the trigger before the next hover.
    fireEvent.pointerEnter(outerTrigger, { pointerType: 'touch', clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(outerTrigger, { relatedTarget: document.body });

    // A later mouse-only hover should not be suppressed by the previous touch input.
    fireEvent.mouseOver(innerTrigger);
    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });

  it('should not open the outer tooltip when moving from the outer popup to a nested trigger', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    // Open the outer tooltip via hover.
    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    const outerPopup = screen.getByTestId('outer-popup');
    expect(outerPopup).not.toBe(null);

    // Hover the outer popup (it's portaled outside the trigger).
    fireEvent.pointerEnter(outerPopup, { pointerType: 'mouse', clientX: 200, clientY: 200 });
    fireEvent.mouseOver(outerPopup);

    await flushMicrotasks();

    // Move back onto the nested trigger. The bubbling mouseover hits the
    // outer trigger and the close-on-nested-hover branch runs.
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should suppress the safePolygon-driven open while a nested trigger is hovered', async () => {
    await render(
      <Tooltip.Root>
        <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
          <span data-testid="outer-area">Outer</span>
          <Tooltip.Root>
            <Tooltip.Trigger data-testid="inner-trigger" delay={OPEN_DELAY * 10}>
              Inner
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');

    fireEvent.pointerDown(outerTrigger, { pointerType: 'mouse' });
    fireEvent.pointerEnter(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.mouseMove(outerTrigger, { clientX: 10, clientY: 10 });
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);
    // Repeated mouseMoves keep the safePolygon / mouseover path active, which
    // calls `setOpen(true)` via `useHoverReferenceInteraction`'s onMouseMove
    // handler — that path is now gated by `checkShouldOpen()`.
    fireEvent.mouseMove(innerTrigger, { clientX: 50, clientY: 10 });
    fireEvent.mouseMove(innerTrigger, { clientX: 51, clientY: 10 });

    clock.tick(OPEN_DELAY);
    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
  });

  it('should support nested triggers with a Provider delay={0}', async () => {
    await render(
      <Tooltip.Provider delay={0}>
        <Tooltip.Root>
          <Tooltip.Trigger data-testid="outer-trigger" render={<span />}>
            <span data-testid="outer-area">Outer</span>
            <Tooltip.Root>
              <Tooltip.Trigger data-testid="inner-trigger">Inner</Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="inner-popup">Inner tooltip</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid="outer-popup">Outer tooltip</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>,
    );

    const outerTrigger = screen.getByTestId('outer-trigger');
    const innerTrigger = screen.getByTestId('inner-trigger');
    const outerArea = screen.getByTestId('outer-area');

    fireEvent.pointerEnter(outerTrigger, { pointerType: 'mouse', clientX: 10, clientY: 10 });
    fireEvent.mouseEnter(outerTrigger);
    fireEvent.pointerEnter(innerTrigger, { pointerType: 'mouse', clientX: 50, clientY: 10 });
    fireEvent.mouseEnter(innerTrigger);
    fireEvent.mouseOver(innerTrigger);

    await flushMicrotasks();

    expect(screen.queryByTestId('outer-popup')).toBe(null);
    expect(screen.getByTestId('inner-popup')).not.toBe(null);

    fireEvent.mouseOut(innerTrigger, { relatedTarget: outerArea });
    fireEvent.mouseOver(outerArea);

    await flushMicrotasks();

    expect(screen.getByTestId('outer-popup')).not.toBe(null);
  });
});

type TestTooltipProps = {
  rootProps?: Tooltip.Root.Props;
  triggerProps?: Tooltip.Trigger.Props;
  portalProps?: Tooltip.Portal.Props;
  positionerProps?: Tooltip.Positioner.Props;
  popupProps?: Tooltip.Popup.Props;
  portalChildren?: React.ReactNode;
  beforeTrigger?: React.ReactNode;
  betweenTriggerAndPortal?: React.ReactNode;
  afterPortal?: React.ReactNode;
};

function ContainedTriggerTooltip(props: TestTooltipProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    beforeTrigger,
    betweenTriggerAndPortal,
    afterPortal,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Toggle';
  const popupContent = popupChildren ?? 'Content';

  return (
    <Tooltip.Root {...rootProps}>
      {beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" {...restTriggerProps}>
        {triggerContent}
      </Tooltip.Trigger>
      {betweenTriggerAndPortal}
      <Tooltip.Portal {...restPortalProps}>
        {portalChildren}
        <Tooltip.Positioner data-testid="positioner" {...positionerProps}>
          <Tooltip.Popup data-testid="popup" {...restPopupProps}>
            {popupContent}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
      {afterPortal}
    </Tooltip.Root>
  );
}

function DetachedTriggerTooltip(props: TestTooltipProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    beforeTrigger,
    betweenTriggerAndPortal,
    afterPortal,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Toggle';
  const popupContent = popupChildren ?? 'Content';

  const tooltipHandle = useRefWithInit(() => Tooltip.createHandle()).current;

  return (
    <React.Fragment>
      {beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...restTriggerProps}>
        {triggerContent}
      </Tooltip.Trigger>
      {betweenTriggerAndPortal}
      <Tooltip.Root handle={tooltipHandle} {...rootProps}>
        <Tooltip.Portal {...restPortalProps}>
          {portalChildren}
          <Tooltip.Positioner data-testid="positioner" {...positionerProps}>
            <Tooltip.Popup data-testid="popup" {...restPopupProps}>
              {popupContent}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
        {afterPortal}
      </Tooltip.Root>
    </React.Fragment>
  );
}

function MultipleDetachedTriggersTooltip(props: TestTooltipProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    positionerProps,
    popupProps,
    beforeTrigger,
    betweenTriggerAndPortal,
    afterPortal,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Toggle';
  const popupContent = popupChildren ?? 'Content';

  const tooltipHandle = useRefWithInit(() => Tooltip.createHandle()).current;

  return (
    <React.Fragment>
      {beforeTrigger}
      <Tooltip.Trigger data-testid="trigger" handle={tooltipHandle} {...restTriggerProps}>
        {triggerContent}
      </Tooltip.Trigger>
      <Tooltip.Trigger data-testid="trigger-2" handle={tooltipHandle}>
        Toggle another
      </Tooltip.Trigger>
      {betweenTriggerAndPortal}
      <Tooltip.Root handle={tooltipHandle} {...rootProps}>
        <Tooltip.Portal {...restPortalProps}>
          {portalChildren}
          <Tooltip.Positioner data-testid="positioner" {...positionerProps}>
            <Tooltip.Popup data-testid="popup" {...restPopupProps}>
              {popupContent}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
        {afterPortal}
      </Tooltip.Root>
    </React.Fragment>
  );
}
