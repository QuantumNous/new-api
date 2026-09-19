import { vi, expect } from 'vitest';
import * as React from 'react';
import { createRenderer, isJSDOM } from '#test-utils';
import { Tooltip } from '@base-ui/react/tooltip';
import { screen, waitFor, randomStringValue, act, flushMicrotasks } from '@mui/internal-test-utils';

describe('<Tooltip.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;

    await act(async () => {
      document.body.click();
    });

    // Wait for all tooltips to unmount
    await waitFor(() => {
      const tooltips = document.querySelectorAll('[data-open]');
      expect(tooltips.length).toBe(0);
    });
  });

  const { render } = createRenderer();

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the tooltip with any trigger on hover', async () => {
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

      const popupId = randomStringValue();
      const { user } = await render(
        <Tooltip.Root>
          <input type="text" aria-label="Initial focus" autoFocus />
          <Tooltip.Trigger delay={0}>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger delay={0}>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger delay={0}>Trigger 3</Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup data-testid={popupId}>Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger1);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger2);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger3);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      await user.hover(document.body);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });
    });

    it('should open the tooltip with any trigger on focus', async () => {
      await render(
        <Tooltip.Root>
          <Tooltip.Trigger>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger>Trigger 3</Tooltip.Trigger>

          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Tooltip Content</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger1.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger2.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger3.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger3.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = await render(
        <Tooltip.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Tooltip.Trigger payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </React.Fragment>
          )}
        </Tooltip.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).toBe('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should close when the active trigger unmounts', async () => {
      let removeFirstTrigger: () => void = () => {};

      function Test() {
        const [showFirstTrigger, setShowFirstTrigger] = React.useState(true);
        removeFirstTrigger = () => setShowFirstTrigger(false);

        return (
          <div style={{ padding: 50 }}>
            <Tooltip.Root defaultOpen defaultTriggerId="trigger-1">
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <div style={{ display: 'flex', gap: 120 }}>
                    {showFirstTrigger && (
                      <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </Tooltip.Trigger>
                    )}
                    <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </Tooltip.Trigger>
                  </div>

                  <Tooltip.Portal>
                    <Tooltip.Positioner side="bottom" align="start">
                      <Tooltip.Popup>
                        <span data-testid="content">{payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </React.Fragment>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      let removeFirstTrigger: () => void = () => {};
      const onOpenChange = vi.fn((nextOpen, details: Tooltip.Root.ChangeEventDetails) => {
        if (!nextOpen) {
          details.cancel();
        }
      });

      function Test() {
        const [showFirstTrigger, setShowFirstTrigger] = React.useState(true);
        removeFirstTrigger = () => setShowFirstTrigger(false);

        return (
          <div style={{ padding: 50 }}>
            <Tooltip.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <div style={{ display: 'flex', gap: 120 }}>
                    {showFirstTrigger && (
                      <Tooltip.Trigger id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </Tooltip.Trigger>
                    )}
                    <Tooltip.Trigger id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </Tooltip.Trigger>
                  </div>

                  <Tooltip.Portal>
                    <Tooltip.Positioner side="bottom" align="start">
                      <Tooltip.Popup>
                        <span data-testid="content">{payload}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </React.Fragment>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(onOpenChange).toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: 'none' }),
        );
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.getByTestId('content')).toHaveTextContent('1');
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      await render(
        <Tooltip.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Tooltip.Trigger payload={1} delay={0}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>

              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner" key="pos">
                  <Tooltip.Popup data-testid="popup" key="pop">
                    <span>{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </React.Fragment>
          )}
        </Tooltip.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
      expect(screen.getByTestId('popup')).toBe(popupElement);
    });

    it('should allow controlling the tooltip state programmatically', async () => {
      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div>
            <Tooltip.Root
              open={open}
              triggerId={activeTrigger}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <Tooltip.Trigger payload={1} id="trigger-1" delay={0}>
                    Trigger 1
                  </Tooltip.Trigger>
                  <Tooltip.Trigger payload={2} id="trigger-2" delay={0}>
                    Trigger 2
                  </Tooltip.Trigger>

                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>
                        <span data-testid="content">{payload as number}</span>
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </React.Fragment>
              )}
            </Tooltip.Root>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = await render(<Test />);
      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      expect(screen.getByTestId('content').textContent).toBe('1');
      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      expect(screen.getByTestId('content').textContent).toBe('2');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).toBe(null);
    });

    it('allows setting an initially open tooltip', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const triggerId = randomStringValue();
      await render(
        <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId={triggerId}>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <Tooltip.Trigger handle={testTooltip} payload={1}>
                Trigger 1
              </Tooltip.Trigger>
              <Tooltip.Trigger handle={testTooltip} payload={2} id={triggerId}>
                Trigger 2
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">
                    <span>{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </React.Fragment>
          )}
        </Tooltip.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).toBe('2');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the tooltip with any trigger on hover', async () => {
      const testTooltip = Tooltip.createHandle();
      const popupId = randomStringValue();
      const { user } = await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} delay={0}>
            Trigger 3
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid={popupId}>Tooltip Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await user.hover(trigger3);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
      await user.unhover(trigger3);
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });
    });

    it('should open the tooltip with any trigger on focus', async () => {
      const testTooltip = Tooltip.createHandle();
      await render(
        <div>
          <Tooltip.Trigger handle={testTooltip}>Trigger 1</Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip}>Trigger 2</Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip}>Trigger 3</Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Tooltip Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger1.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger2.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);

      await act(async () => trigger3.focus());
      await flushMicrotasks();
      expect(screen.getByText('Tooltip Content')).toBeVisible();
      await act(async () => trigger3.blur());
      expect(screen.queryByText('Tooltip Content')).toBe(null);
    });

    it('should close when focusing a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('1');

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should set the payload and render content based on its value', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).toBe('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      let removeFirstTrigger: () => void = () => {};

      function Test() {
        const [showFirstTrigger, setShowFirstTrigger] = React.useState(true);
        removeFirstTrigger = () => setShowFirstTrigger(false);

        return (
          <div style={{ padding: 50 }}>
            <div style={{ display: 'flex', gap: 120 }}>
              {showFirstTrigger && (
                <Tooltip.Trigger handle={testTooltip} id="trigger-1" payload={1} delay={0}>
                  Trigger 1
                </Tooltip.Trigger>
              )}
              <Tooltip.Trigger handle={testTooltip} id="trigger-2" payload={2} delay={0}>
                Trigger 2
              </Tooltip.Trigger>
            </div>

            <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId="trigger-1">
              {({ payload }: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should close when hovering a disabled trigger while another trigger is open', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} disabled>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });

    it('should switch to a rendered disabled button trigger when trigger hover is enabled', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const { user } = await render(
        <div>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger
            handle={testTooltip}
            payload={2}
            delay={0}
            render={
              <button type="button" disabled>
                Trigger 2
              </button>
            }
          />

          <Tooltip.Root handle={testTooltip}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>
                    <span data-testid="content">{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      expect(trigger2).toHaveAttribute('data-popup-open');
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      await render(
        <React.Fragment>
          <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner data-testid="positioner">
                  <Tooltip.Popup data-testid="popup">
                    <span>{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('popup')).toBe(popupElement);
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
    });

    it('should allow controlling the tooltip state programmatically', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div style={{ margin: 50 }}>
            <Tooltip.Trigger handle={testTooltip} payload={1} id="trigger-1" delay={0}>
              Trigger 1
            </Tooltip.Trigger>
            <Tooltip.Trigger handle={testTooltip} payload={2} id="trigger-2" delay={0}>
              Trigger 2
            </Tooltip.Trigger>

            <Tooltip.Root
              open={open}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger}
              handle={testTooltip}
            >
              {({ payload }: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner data-testid="positioner" side="bottom" align="start">
                    <Tooltip.Popup>
                      <span data-testid="content">{payload}</span>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>

            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      expect(screen.getByTestId('content').textContent).toBe('1');

      await waitFor(() => {
        expect(
          Math.abs(
            screen.getByTestId('positioner').getBoundingClientRect().left -
              trigger1.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      expect(screen.getByTestId('content').textContent).toBe('2');
      await waitFor(() => {
        expect(
          Math.abs(
            screen.getByTestId('positioner').getBoundingClientRect().left -
              trigger2.getBoundingClientRect().left,
          ),
        ).toBeLessThanOrEqual(1);
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      expect(screen.queryByTestId('content')).toBe(null);
    });

    it('allows setting an initially open tooltip', async () => {
      const testTooltip = Tooltip.createHandle<number>();
      const triggerId = randomStringValue();
      await render(
        <React.Fragment>
          <button type="button" aria-label="Initial focus" autoFocus />
          <Tooltip.Trigger handle={testTooltip} payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={testTooltip} payload={2} id={triggerId}>
            Trigger 2
          </Tooltip.Trigger>

          <Tooltip.Root handle={testTooltip} defaultOpen defaultTriggerId={triggerId}>
            {({ payload }: NumberPayload) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="popup">
                    <span>{payload}</span>
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </React.Fragment>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).toBe('2');
      });
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testTooltip = Tooltip.createHandle<number>();

      function Test() {
        return (
          <React.Fragment>
            <button type="button" aria-label="Initial focus" autoFocus />
            <Tooltip.Trigger handle={testTooltip} payload={1} delay={0}>
              Trigger 1
            </Tooltip.Trigger>
            <Tooltip.Trigger handle={testTooltip} payload={2} delay={0}>
              Trigger 2
            </Tooltip.Trigger>

            <Tooltip.Root handle={testTooltip}>
              {({ payload }: NumberPayload) => (
                <Tooltip.Portal>
                  <Tooltip.Positioner>
                    <Tooltip.Popup data-testid="popup">
                      <Tooltip.Viewport>
                        <span data-testid="content">{payload}</span>
                      </Tooltip.Viewport>
                    </Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              )}
            </Tooltip.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      // Open with Trigger 1
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      // Switch to Trigger 2
      await user.unhover(trigger1);
      await user.hover(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });

      // The popup should not have an inline scale style that would override CSS transitions
      const popup = screen.getByTestId('popup');
      expect(popup.style.scale).toBe('');
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    it('opens and closes the tooltip', async () => {
      const tooltip = Tooltip.createHandle();
      await render(
        <div>
          <Tooltip.Trigger handle={tooltip} id="trigger">
            Trigger
          </Tooltip.Trigger>
          <Tooltip.Root handle={tooltip}>
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup data-testid="content">Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).toBe(null);

      await act(() => tooltip.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('Content');
      expect(trigger).toHaveAttribute('data-popup-open');

      await act(() => tooltip.close());
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sets the payload associated with the trigger', async () => {
      const tooltip = Tooltip.createHandle<number>();
      await render(
        <div>
          <Tooltip.Trigger handle={tooltip} id="trigger1" payload={1}>
            Trigger 1
          </Tooltip.Trigger>
          <Tooltip.Trigger handle={tooltip} id="trigger2" payload={2}>
            Trigger 2
          </Tooltip.Trigger>
          <Tooltip.Root handle={tooltip}>
            {({ payload }: { payload: number | undefined }) => (
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup data-testid="content">{payload}</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            )}
          </Tooltip.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByTestId('content')).toBe(null);

      await act(() => tooltip.open('trigger2'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('2');
      expect(trigger2).toHaveAttribute('data-popup-open');
      expect(trigger1).not.toHaveAttribute('data-popup-open');

      await act(() => tooltip.close());
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });

      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });
  });
});
