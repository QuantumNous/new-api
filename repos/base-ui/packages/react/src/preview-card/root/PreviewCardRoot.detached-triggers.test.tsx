import { expect, vi } from 'vitest';
import * as React from 'react';
import { createRenderer, isJSDOM } from '#test-utils';
import { PreviewCard } from '@base-ui/react/preview-card';
import { screen, waitFor, randomStringValue, act, flushMicrotasks } from '@mui/internal-test-utils';
import { OPEN_DELAY } from '../utils/constants';

const CLOSE_TRANSITION_MS = 50;
const CLOSE_TRANSITION_TIMEOUT = 300;

describe('<PreviewCard.Root />', () => {
  beforeEach(async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the preview card with any trigger on hover', async () => {
      const popupId = randomStringValue();
      const { user } = await render(
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

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

    it('should open the preview card immediately when hovering another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = await render(
        <PreviewCard.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <PreviewCard.Trigger href="#" delay={0} payload={1}>
                Trigger 1
              </PreviewCard.Trigger>

              {/* delay should be ignored when moving from already active trigger */}
              <PreviewCard.Trigger href="#" delay={2000} payload={2}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid={popupId}>Content: {payload}</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </React.Fragment>
          )}
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      expect(screen.getByTestId(popupId).textContent).toBe('Content: 1');

      await user.hover(trigger2);
      expect(screen.queryByTestId(popupId)).toBeVisible();
      expect(screen.getByTestId(popupId).textContent).toBe('Content: 2');
    });

    it('should open the preview card with any trigger on focus', async () => {
      await render(
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger1.blur());
      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger2.blur());
      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger3.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger3.blur());
      expect(screen.queryByText('Content')).toBe(null);
    });

    it('should open again after escape when focusing another trigger', async () => {
      const popupId = randomStringValue();
      const { user } = await render(
        <PreviewCard.Root>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });

      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBe(null);
      });

      await act(async () => trigger2.focus());
      await waitFor(() => {
        expect(screen.queryByTestId(popupId)).toBeVisible();
      });
    });

    it('should switch immediately when focusing another trigger while open', async () => {
      await render(
        <PreviewCard.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={2000}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </React.Fragment>
          )}
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = await render(
        <PreviewCard.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </React.Fragment>
          )}
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

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
            <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1">
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <button type="button" aria-label="Initial focus" autoFocus />
                  <div style={{ display: 'flex', gap: 120 }}>
                    {showFirstTrigger && (
                      <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </PreviewCard.Trigger>
                    )}
                    <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </PreviewCard.Trigger>
                  </div>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner side="bottom" align="start">
                      <PreviewCard.Popup>
                        <span data-testid="content">{payload}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </React.Fragment>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should remain open when the active trigger unmount close is canceled', async () => {
      let removeFirstTrigger: () => void = () => {};
      const onOpenChange = vi.fn((nextOpen, details: PreviewCard.Root.ChangeEventDetails) => {
        if (!nextOpen) {
          details.cancel();
        }
      });

      function Test() {
        const [showFirstTrigger, setShowFirstTrigger] = React.useState(true);
        removeFirstTrigger = () => setShowFirstTrigger(false);

        return (
          <div style={{ padding: 50 }}>
            <PreviewCard.Root defaultOpen defaultTriggerId="trigger-1" onOpenChange={onOpenChange}>
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <button type="button" aria-label="Initial focus" autoFocus />
                  <div style={{ display: 'flex', gap: 120 }}>
                    {showFirstTrigger && (
                      <PreviewCard.Trigger href="#" id="trigger-1" payload={1} delay={0}>
                        Trigger 1
                      </PreviewCard.Trigger>
                    )}
                    <PreviewCard.Trigger href="#" id="trigger-2" payload={2} delay={0}>
                      Trigger 2
                    </PreviewCard.Trigger>
                  </div>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner side="bottom" align="start">
                      <PreviewCard.Popup>
                        <span data-testid="content">{payload}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </React.Fragment>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
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
        <PreviewCard.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <PreviewCard.Trigger href="#" payload={1} delay={0}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" payload={2} delay={0}>
                Trigger 2
              </PreviewCard.Trigger>

              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner" key="pos">
                  <PreviewCard.Popup data-testid="popup" key="pop">
                    <span>{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </React.Fragment>
          )}
        </PreviewCard.Root>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
      expect(screen.getByTestId('popup')).toBe(popupElement);
    });

    it('should allow controlling the preview card state programmatically', async () => {
      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div>
            <button type="button" aria-label="Initial focus" autoFocus />
            <PreviewCard.Root
              open={open}
              triggerId={activeTrigger}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <PreviewCard.Trigger href="#" payload={1} id="trigger-1" delay={0}>
                    Trigger 1
                  </PreviewCard.Trigger>
                  <PreviewCard.Trigger href="#" payload={2} id="trigger-2" delay={0}>
                    Trigger 2
                  </PreviewCard.Trigger>

                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>
                        <span data-testid="content">{payload as number}</span>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </React.Fragment>
              )}
            </PreviewCard.Root>
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

    it('allows setting an initially open preview card', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const triggerId = randomStringValue();
      await render(
        <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId={triggerId}>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <button type="button" aria-label="Initial focus" autoFocus />
              <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1}>
                Trigger 1
              </PreviewCard.Trigger>
              <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} id={triggerId}>
                Trigger 2
              </PreviewCard.Trigger>
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span>{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            </React.Fragment>
          )}
        </PreviewCard.Root>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).toBe('2');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the preview card with any trigger on hover', async () => {
      const testPreviewCard = PreviewCard.createHandle();
      const popupId = randomStringValue();
      const { user } = await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid={popupId}>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

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

    it('should open the preview card with any trigger on focus', async () => {
      const testPreviewCard = PreviewCard.createHandle();
      await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} delay={0}>
            Trigger 3
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('link', { name: 'Trigger 3' });

      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger1.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger1.blur());
      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger2.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger2.blur());
      expect(screen.queryByText('Content')).toBe(null);

      await act(async () => trigger3.focus());
      await flushMicrotasks();
      expect(screen.getByText('Content')).toBeVisible();
      await act(async () => trigger3.blur());
      expect(screen.queryByText('Content')).toBe(null);
    });

    it('should reposition to a different trigger when reopened with keepMounted=true', async () => {
      const previewCardHandle = PreviewCard.createHandle();
      const { user } = await render(
        <div style={{ margin: 50 }}>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={previewCardHandle} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={previewCardHandle}>
            <PreviewCard.Portal keepMounted>
              <PreviewCard.Positioner data-testid="positioner" side="bottom" align="start">
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      const positioner = screen.getByTestId('positioner');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger1.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });

      await user.unhover(trigger1);

      await waitFor(() => {
        expect(positioner).toHaveAttribute('hidden');
      });

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeVisible();
      });

      await waitFor(() => {
        expect(
          Math.abs(positioner.getBoundingClientRect().left - trigger2.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const { user } = await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup>
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      expect(screen.getByTestId('content').textContent).toBe('1');

      await user.unhover(trigger1);
      await user.hover(trigger2);
      expect(screen.getByTestId('content').textContent).toBe('2');
    });

    it('should close when the active detached trigger unmounts', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      let removeFirstTrigger: () => void = () => {};

      function Test() {
        const [showFirstTrigger, setShowFirstTrigger] = React.useState(true);
        removeFirstTrigger = () => setShowFirstTrigger(false);

        return (
          <div style={{ padding: 50 }}>
            <button type="button" aria-label="Initial focus" autoFocus />
            <div style={{ display: 'flex', gap: 120 }}>
              {showFirstTrigger && (
                <PreviewCard.Trigger
                  href="#"
                  handle={testPreviewCard}
                  id="trigger-1"
                  payload={1}
                  delay={0}
                >
                  Trigger 1
                </PreviewCard.Trigger>
              )}
              <PreviewCard.Trigger
                href="#"
                handle={testPreviewCard}
                id="trigger-2"
                payload={2}
                delay={0}
              >
                Trigger 2
              </PreviewCard.Trigger>
            </div>

            <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId="trigger-1">
              {({ payload }: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner side="bottom" align="start">
                    <PreviewCard.Popup>
                      <span data-testid="content">{payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      await render(<Test />);

      expect(await screen.findByTestId('content')).toHaveTextContent('1');

      await act(async () => removeFirstTrigger());

      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: 'Trigger 1' })).toBe(null);
        expect(trigger2).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      await render(
        <React.Fragment>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner data-testid="positioner">
                  <PreviewCard.Popup data-testid="popup">
                    <span>{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await act(async () => trigger1.focus());
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await act(async () => trigger2.focus());
      expect(screen.getByTestId('popup')).toBe(popupElement);
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
    });

    it('should allow controlling the preview card state programmatically', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div style={{ margin: 50 }}>
            <button type="button" aria-label="Initial focus" autoFocus />
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              payload={1}
              id="trigger-1"
              delay={0}
            >
              Trigger 1
            </PreviewCard.Trigger>
            <PreviewCard.Trigger
              href="#"
              handle={testPreviewCard}
              payload={2}
              id="trigger-2"
              delay={0}
            >
              Trigger 2
            </PreviewCard.Trigger>

            <PreviewCard.Root
              open={open}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger}
              handle={testPreviewCard}
            >
              {({ payload }: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner data-testid="positioner" side="bottom" align="start">
                    <PreviewCard.Popup>
                      <span data-testid="content">{payload}</span>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>

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

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

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

    it('allows setting an initially open preview card', async () => {
      const testPreviewCard = PreviewCard.createHandle<number>();
      const triggerId = randomStringValue();
      await render(
        <React.Fragment>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} id={triggerId}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard} defaultOpen defaultTriggerId={triggerId}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span>{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup').textContent).toBe('2');
      });
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();

      function Test() {
        return (
          <React.Fragment>
            <button type="button" aria-label="Initial focus" autoFocus />
            <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
              Trigger 1
            </PreviewCard.Trigger>
            <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={0}>
              Trigger 2
            </PreviewCard.Trigger>

            <PreviewCard.Root handle={testPreviewCard}>
              {({ payload }: NumberPayload) => (
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup data-testid="popup">
                      <PreviewCard.Viewport>
                        <span data-testid="content">{payload}</span>
                      </PreviewCard.Viewport>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              )}
            </PreviewCard.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

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

    it('opens immediately when entering trigger B during trigger A close transition', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-a-to-b-close-transition {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-a-to-b-close-transition ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;
      const { user } = await render(
        <React.Fragment>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={OPEN_DELAY}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      await user.hover(trigger2);

      await waitFor(
        () => {
          expect(screen.getByTestId('content').textContent).toBe('2');
        },
        { timeout: 200 },
      );
    });

    it('still respects trigger B open delay after trigger A close transition finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-a-to-b-post-close-delay {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-a-to-b-post-close-delay ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;
      const { user } = await render(
        <React.Fragment>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={0}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={2} delay={OPEN_DELAY}>
            Trigger 2
          </PreviewCard.Trigger>

          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      // Once close transition is done, this should behave like a normal delayed open.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');
        },
        { timeout: CLOSE_TRANSITION_TIMEOUT },
      );
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });

      await user.hover(trigger2);

      // Must not open immediately once close transition has finished.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
    });

    it('reopens immediately when re-hovering trigger A during its close transition', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-reopen-during-close {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-reopen-during-close ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;

      const { user } = await render(
        <React.Fragment>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={OPEN_DELAY}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });

      await user.hover(trigger1);

      await waitFor(
        () => {
          expect(screen.getByTestId('content').textContent).toBe('1');
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );
    });

    it('respects open delay on later same-trigger hovers after close lifecycle finishes', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testPreviewCard = PreviewCard.createHandle<number>();
      const style = `
        @keyframes preview-card-reopen-during-close-delay {
          from { opacity: 1; }
          to { opacity: 0.01; }
        }
        [data-testid="popup"][data-ending-style] {
          animation: preview-card-reopen-during-close-delay ${CLOSE_TRANSITION_MS}ms linear forwards;
        }
      `;

      const { user } = await render(
        <React.Fragment>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={testPreviewCard} payload={1} delay={OPEN_DELAY}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={testPreviewCard}>
            {({ payload }: NumberPayload) => (
              <PreviewCard.Portal keepMounted>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="popup">
                    <span data-testid="content">{payload}</span>
                  </PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });

      // First cycle: close and immediate re-hover during close lifecycle should reopen.
      await user.hover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
      });
      await user.hover(trigger1);
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      // Second cycle: once close lifecycle has fully finished, a fresh hover must honor OPEN_DELAY.
      await user.unhover(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
      });
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).not.toHaveAttribute('data-ending-style');
        },
        { timeout: CLOSE_TRANSITION_TIMEOUT },
      );

      await user.hover(trigger1);

      // Should not reopen immediately this time.
      await waitFor(
        () => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-closed');
        },
        { timeout: 200 },
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    it('opens and closes the preview card', async () => {
      const handle = PreviewCard.createHandle();
      await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={handle} id="trigger">
            Trigger
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup data-testid="content">Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>
        </div>,
      );

      const trigger = screen.getByRole('link', { name: 'Trigger' });
      expect(screen.queryByTestId('content')).toBe(null);

      await act(() => handle.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('Content');
      expect(trigger).toHaveAttribute('data-popup-open');

      await act(() => handle.close());
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sets the payload associated with the trigger', async () => {
      const handle = PreviewCard.createHandle<number>();
      await render(
        <div>
          <button type="button" aria-label="Initial focus" autoFocus />
          <PreviewCard.Trigger href="#" handle={handle} id="trigger1" payload={1}>
            Trigger 1
          </PreviewCard.Trigger>
          <PreviewCard.Trigger href="#" handle={handle} id="trigger2" payload={2}>
            Trigger 2
          </PreviewCard.Trigger>
          <PreviewCard.Root handle={handle}>
            {({ payload }: { payload: number | undefined }) => (
              <PreviewCard.Portal>
                <PreviewCard.Positioner>
                  <PreviewCard.Popup data-testid="content">{payload}</PreviewCard.Popup>
                </PreviewCard.Positioner>
              </PreviewCard.Portal>
            )}
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('link', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('link', { name: 'Trigger 2' });
      expect(screen.queryByTestId('content')).toBe(null);

      await act(() => handle.open('trigger2'));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('2');
      expect(trigger2).toHaveAttribute('data-popup-open');
      expect(trigger1).not.toHaveAttribute('data-popup-open');

      await act(() => handle.close());
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });

      expect(trigger2).not.toHaveAttribute('data-popup-open');
    });
  });
});
