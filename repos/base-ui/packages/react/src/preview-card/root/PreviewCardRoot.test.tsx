import { expect, vi } from 'vitest';
import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { act, fireEvent, screen, flushMicrotasks, waitFor } from '@mui/internal-test-utils';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';
import { CLOSE_DELAY, OPEN_DELAY } from '../utils/constants';

describe('<PreviewCard.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render, clock } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <PreviewCard.Root {...props.root}>
        <PreviewCard.Trigger href="#" {...props.trigger}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal {...props.portal}>
          <PreviewCard.Positioner>
            <PreviewCard.Popup {...props.popup}>Content</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    render,
    triggerMouseAction: 'hover',
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerPreviewCard },
    { name: 'detached triggers', Component: DetachedTriggerPreviewCard },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersPreviewCard },
  ])('when using $name', ({ Component: TestPreviewCard }) => {
    describe('uncontrolled open', () => {
      clock.withFakeTimers();

      it('should open when the trigger is hovered', async () => {
        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is unhovered', async () => {
        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        fireEvent.mouseLeave(trigger);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should open when the trigger is focused', async () => {
        if (!isJSDOM) {
          // Ignore due to `:focus-visible` being required in the browser.
          return;
        }

        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await act(async () => trigger.focus());

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should close when the trigger is blurred', async () => {
        await render(<TestPreviewCard />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        await act(async () => trigger.focus());
        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        await act(async () => trigger.blur());
        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('prop: onOpenChange', () => {
      clock.withFakeTimers();

      it('should call onOpenChange when the open state changes', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestPreviewCard
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

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.mouseLeave(trigger);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0][0]).toBe(false);
        expect(handleChange.mock.calls[1][0]).toBe(true);
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestPreviewCard rootProps={{ open, onOpenChange: setOpen }} />
            </React.Fragment>
          );
        }

        await render(<App />);

        fireEvent.click(screen.getByRole('button', { name: 'Show' }));

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        clock.tick(CLOSE_DELAY);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return <TestPreviewCard rootProps={{ open, onOpenChange: setOpen }} />;
        }

        await render(<App />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not call onChange when the open state does not change', async () => {
        const handleChange = vi.fn();

        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestPreviewCard
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

        const trigger = screen.getByRole('link', { name: 'Link' });

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
      clock.withFakeTimers();

      it('should open when the component is rendered', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />,
        );

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should not open when the component is rendered and open is controlled', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
              open: false,
            }}
          />,
        );

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('should not close when the component is rendered and open is controlled', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
              open: true,
            }}
          />,
        );

        expect(screen.getByText('Content')).not.toBe(null);
      });

      it('should remain uncontrolled', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />,
        );

        expect(screen.getByText('Content')).not.toBe(null);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.mouseLeave(trigger);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              defaultOpen: true,
            }}
          />,
        );

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      clock.withFakeTimers();

      it('should open after delay with rest type by default', async () => {
        await render(<TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

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
        await render(<TestPreviewCard triggerProps={{ closeDelay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

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

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        await render(
          <TestPreviewCard
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('link', { name: 'Link' });
        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('dismissal', () => {
      clock.withFakeTimers();

      it('reopens on hover after Escape closes it', async () => {
        await render(<TestPreviewCard triggerProps={{ delay: 100 }} />);

        const trigger = screen.getByRole('link', { name: 'Link' });

        fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        clock.tick(100);
        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        fireEvent.keyDown(document.body, { key: 'Escape' });
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

    describe.skipIf(!isJSDOM)('prop: actionsRef', () => {
      it('unmounts the preview card when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = await render(
          <TestPreviewCard
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
            triggerProps={{
              delay: 0,
              closeDelay: 0,
            }}
          />,
        );

        const trigger = screen.getByRole('link', { name: 'Link' });
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
              />
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        expect(screen.getByTestId('popup')).not.toBe(null);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
              />
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
              />
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
              />
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
              <TestPreviewCard
                rootProps={{
                  open,
                  onOpenChangeComplete,
                }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
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

        expect(screen.queryByTestId('popup')).not.toBe(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = vi.fn();

        await render(
          <TestPreviewCard
            rootProps={{
              onOpenChangeComplete,
            }}
          />,
        );

        expect(onOpenChangeComplete.mock.calls.length).toBe(0);
      });
    });
  });

  describe('nested preview card interactions', () => {
    it('keeps the parent preview card open when clicking nested trigger', async () => {
      function Test() {
        return (
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="parent-popup">
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        );
      }

      await render(<Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByRole('link', { name: 'Child' });

      fireEvent.click(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after clicking the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when press starts in nested popup and ends outside', async () => {
      function Test() {
        return (
          <div>
            <button type="button" data-testid="outside">
              Outside
            </button>

            <PreviewCard.Root defaultOpen>
              <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <PreviewCard.Root defaultOpen>
                      <PreviewCard.Trigger href="#">Child</PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      expect(screen.queryByTestId('child-popup')).not.toBe(null);

      const childPopup = screen.getByTestId('child-popup');
      const outside = screen.getByTestId('outside');

      fireEvent.pointerDown(childPopup, { pointerType: 'mouse', button: 0 });
      fireEvent.click(outside);

      await waitFor(() => {
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
      });
      expect(screen.queryByTestId('child-popup')).not.toBe(null);
    });

    it('keeps the parent preview card open when hovering nested trigger', async () => {
      function Test() {
        return (
          <PreviewCard.Root defaultOpen>
            <PreviewCard.Trigger href="#">Parent</PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner data-testid="parent-positioner">
                <PreviewCard.Popup data-testid="parent-popup">
                  <div>Parent content</div>
                  <PreviewCard.Root>
                    <PreviewCard.Trigger href="#" data-testid="child-trigger">
                      Child
                    </PreviewCard.Trigger>
                    <PreviewCard.Portal>
                      <PreviewCard.Positioner>
                        <PreviewCard.Popup data-testid="child-popup">
                          Child content
                        </PreviewCard.Popup>
                      </PreviewCard.Positioner>
                    </PreviewCard.Portal>
                  </PreviewCard.Root>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        );
      }

      await render(<Test />);

      expect(screen.queryByTestId('parent-popup')).not.toBe(null);

      const childTrigger = screen.getByTestId('child-trigger');

      // Simulate hovering from parent content to child trigger
      fireEvent.pointerDown(childTrigger, { pointerType: 'mouse' });
      fireEvent.mouseEnter(childTrigger);
      fireEvent.mouseMove(childTrigger);

      await flushMicrotasks();

      // Parent popup should still be open after hovering the child trigger
      expect(screen.queryByTestId('parent-popup')).not.toBe(null);
    });

    describe('race condition between close timers and hover-open logic', () => {
      clock.withFakeTimers();

      it('keeps the parent open and re-opens the child when re-entering after partial close', async () => {
        function Test() {
          return (
            <PreviewCard.Root defaultOpen>
              <PreviewCard.Trigger href="#" data-testid="parent-trigger">
                Parent
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <div>Parent content</div>
                    <PreviewCard.Root>
                      <PreviewCard.Trigger href="#" data-testid="child-trigger">
                        Child
                      </PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          );
        }

        await render(<Test />);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        let childPopup = screen.getByTestId('child-popup').parentElement!;

        // Step 3: Move mouse outside all previews
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseLeave(parentPopup);
        fireEvent.mouseMove(document.body);

        // Advance partway through close delay but not all the way
        clock.tick(CLOSE_DELAY / 2);
        await flushMicrotasks();

        // Step 4: Re-enter parent popup before it closes
        fireEvent.mouseEnter(parentPopup);

        // Let the child's close delay finish — child closes
        clock.tick(CLOSE_DELAY);
        await flushMicrotasks();

        // Parent should still be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        // Step 5: Hover child trigger again to re-open child
        fireEvent.mouseEnter(childTrigger);
        fireEvent.mouseMove(childTrigger);

        clock.tick(OPEN_DELAY);
        await flushMicrotasks();

        // Parent and child should be open
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);

        clock.tick(CLOSE_DELAY);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).not.toBe(null);
      });
    });

    describe('synchronized closing', () => {
      clock.withFakeTimers();

      it('parent popup closes as soon as the child popup closes', async () => {
        function Test() {
          return (
            <PreviewCard.Root>
              <PreviewCard.Trigger href="#" data-testid="parent-trigger">
                Parent
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="parent-popup">
                    <div>Parent content</div>
                    <PreviewCard.Root>
                      <PreviewCard.Trigger href="#" data-testid="child-trigger">
                        Child
                      </PreviewCard.Trigger>
                      <PreviewCard.Portal>
                        <PreviewCard.Positioner>
                          <PreviewCard.Popup data-testid="child-popup">
                            Child content
                          </PreviewCard.Popup>
                        </PreviewCard.Positioner>
                      </PreviewCard.Portal>
                    </PreviewCard.Root>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </PreviewCard.Root>
          );
        }

        await render(<Test />);

        const parentTrigger = screen.getByTestId('parent-trigger');
        fireEvent.mouseEnter(parentTrigger);
        clock.tick(OPEN_DELAY);

        // Events must be triggered on positioner elements (parent of popup)
        const parentPopup = screen.getByTestId('parent-popup').parentElement!;
        const childTrigger = screen.getByTestId('child-trigger');

        fireEvent.mouseLeave(parentTrigger, { relatedTarget: parentPopup });
        fireEvent.mouseEnter(parentPopup);
        fireEvent.mouseEnter(childTrigger);
        clock.tick(OPEN_DELAY);

        const childPopup = screen.getByTestId('child-popup').parentElement!;

        fireEvent.mouseLeave(childTrigger, { relatedTarget: childPopup });
        fireEvent.mouseLeave(parentPopup, { relatedTarget: childPopup });
        fireEvent.mouseEnter(childPopup);
        fireEvent.mouseLeave(childPopup);
        fireEvent.mouseMove(document.body);

        clock.tick(CLOSE_DELAY + 10);
        await flushMicrotasks();

        expect(screen.queryByTestId('child-popup')).toBe(null);
        expect(screen.queryByTestId('parent-popup')).toBe(null);
      });
    });
  });
});

type TestPreviewCardProps = {
  rootProps?: PreviewCard.Root.Props;
  triggerProps?: PreviewCard.Trigger.Props;
  portalProps?: PreviewCard.Portal.Props;
  positionerProps?: PreviewCard.Positioner.Props;
  popupProps?: PreviewCard.Popup.Props;
};

function ContainedTriggerPreviewCard(props: TestPreviewCardProps) {
  const { rootProps, triggerProps, portalProps, positionerProps, popupProps } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Link';
  const popupContent = popupChildren ?? 'Content';

  return (
    <PreviewCard.Root {...rootProps}>
      <PreviewCard.Trigger href="#" data-testid="trigger" {...restTriggerProps}>
        {triggerContent}
      </PreviewCard.Trigger>
      <PreviewCard.Portal {...restPortalProps}>
        {portalChildren}
        <PreviewCard.Positioner data-testid="positioner" {...positionerProps}>
          <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
            {popupContent}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function DetachedTriggerPreviewCard(props: TestPreviewCardProps) {
  const { rootProps, triggerProps, portalProps, positionerProps, popupProps } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Link';
  const popupContent = popupChildren ?? 'Content';

  const previewCardHandle = useRefWithInit(() => PreviewCard.createHandle()).current;

  return (
    <React.Fragment>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...restTriggerProps}
        handle={previewCardHandle}
      >
        {triggerContent}
      </PreviewCard.Trigger>
      <PreviewCard.Root {...rootProps} handle={previewCardHandle}>
        <PreviewCard.Portal {...restPortalProps}>
          {portalChildren}
          <PreviewCard.Positioner data-testid="positioner" {...positionerProps}>
            <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
              {popupContent}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </React.Fragment>
  );
}

function MultipleDetachedTriggersPreviewCard(props: TestPreviewCardProps) {
  const { rootProps, triggerProps, portalProps, positionerProps, popupProps } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  const triggerContent = triggerChildren ?? 'Link';
  const popupContent = popupChildren ?? 'Content';

  const previewCardHandle = useRefWithInit(() => PreviewCard.createHandle()).current;

  return (
    <React.Fragment>
      <PreviewCard.Trigger
        href="#"
        data-testid="trigger"
        {...restTriggerProps}
        handle={previewCardHandle}
      >
        {triggerContent}
      </PreviewCard.Trigger>
      <PreviewCard.Trigger href="#" data-testid="trigger-2" handle={previewCardHandle}>
        Another link
      </PreviewCard.Trigger>

      <PreviewCard.Root {...rootProps} handle={previewCardHandle}>
        <PreviewCard.Portal {...restPortalProps}>
          {portalChildren}
          <PreviewCard.Positioner data-testid="positioner" {...positionerProps}>
            <PreviewCard.Popup data-testid="popup" {...restPopupProps}>
              {popupContent}
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    </React.Fragment>
  );
}
