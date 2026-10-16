import { expect } from 'vitest';
import * as React from 'react';
import { PreviewCard } from '@base-ui/react/preview-card';
import { act, ignoreActWarnings, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM, waitSingleFrame } from '#test-utils';

describe('<PreviewCard.Viewport />', () => {
  const { render } = createRenderer();

  describeConformance(<PreviewCard.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <PreviewCard.Root open>
          <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
          <PreviewCard.Portal>
            <PreviewCard.Positioner>
              <PreviewCard.Popup>{node}</PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        </PreviewCard.Root>,
      );
    },
  }));

  it('should render children in the `current` container by default', async () => {
    await render(
      <PreviewCard.Root open>
        <PreviewCard.Trigger>Trigger</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup>
              <PreviewCard.Viewport>
                <div data-testid="content">Content</div>
              </PreviewCard.Viewport>
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>,
    );

    const currentContainer = screen.getByTestId('content').closest('[data-current]');
    expect(currentContainer).not.toBe(null);
    expect(currentContainer!.textContent).toBe('Content');
  });

  it('should remount the `current` container when the active trigger changes', async () => {
    ignoreActWarnings();
    await render(
      <PreviewCard.Root>
        {({ payload }) => (
          <React.Fragment>
            <PreviewCard.Trigger href="#" payload="first" delay={0} data-testid="trigger1">
              Trigger 1
            </PreviewCard.Trigger>
            <PreviewCard.Trigger href="#" payload="second" delay={0} data-testid="trigger2">
              Trigger 2
            </PreviewCard.Trigger>
            <PreviewCard.Portal>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>
                  <PreviewCard.Viewport>
                    {payload === 'first' ? (
                      <img data-testid="payload-image-1" src="about:blank" alt="Preview 1" />
                    ) : null}
                    {payload === 'second' ? (
                      <img data-testid="payload-image-2" src="about:blank" alt="Preview 2" />
                    ) : null}
                  </PreviewCard.Viewport>
                </PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </React.Fragment>
        )}
      </PreviewCard.Root>,
    );

    const trigger1 = screen.getByTestId('trigger1');
    const trigger2 = screen.getByTestId('trigger2');

    await waitSingleFrame();
    await act(async () => trigger1.focus());

    const firstImage = await screen.findByTestId('payload-image-1');
    const firstContainer = firstImage.closest('[data-current]');
    expect(firstContainer).not.toBe(null);

    await waitSingleFrame();
    await act(async () => trigger2.focus());

    const secondImage = await screen.findByTestId('payload-image-2');
    const secondContainer = secondImage.closest('[data-current]');
    expect(secondContainer).not.toBe(null);
    expect(secondContainer).not.toBe(firstContainer);
  });

  describe.skipIf(isJSDOM)('morphing containers with multiple triggers and payloads', () => {
    beforeEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    });

    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('should create morphing containers during transitions', async () => {
      ignoreActWarnings();
      await render(
        <div>
          <style>
            {`
              [data-transitioning] [data-previous] {
                animation: slide-out 0.3s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 0.3s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
          </style>
          <PreviewCard.Root>
            {({ payload }) => (
              <React.Fragment>
                <PreviewCard.Trigger
                  href="#"
                  payload={0}
                  delay={0}
                  data-testid="trigger1"
                  style={{
                    position: 'absolute',
                    top: '10px',
                    left: '10px',
                    width: '100px',
                    height: '50px',
                  }}
                >
                  Trigger 1
                </PreviewCard.Trigger>
                <PreviewCard.Trigger
                  href="#"
                  payload={1}
                  delay={0}
                  data-testid="trigger2"
                  style={{
                    position: 'absolute',
                    top: '100px',
                    left: '200px',
                    width: '100px',
                    height: '50px',
                  }}
                >
                  Trigger 2
                </PreviewCard.Trigger>
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup>
                      <PreviewCard.Viewport>
                        <div data-testid="content">Content {payload as number}</div>
                      </PreviewCard.Viewport>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </React.Fragment>
            )}
          </PreviewCard.Root>
        </div>,
      );

      const trigger1 = screen.getByTestId('trigger1');
      const trigger2 = screen.getByTestId('trigger2');

      await waitSingleFrame();
      await act(async () => trigger1.focus());

      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });

      await waitSingleFrame();
      await act(async () => trigger2.focus());

      // Check for morphing containers during transition
      let previousContainer: HTMLElement | null = null;
      await waitFor(() => {
        previousContainer = document.querySelector('[data-previous]');
        expect(previousContainer).not.toBe(null);
      });

      expect(previousContainer).toHaveAttribute('inert');
      expect(previousContainer!.textContent).toBe('Content 0');

      const nextContainer = document.querySelector('[data-current]');
      expect(nextContainer).not.toBe(null);
      expect(nextContainer!.textContent).toBe('Content 1');

      // Verify they are cleaned up after animation
      await waitFor(() => {
        expect(document.querySelector('[data-previous]')).toBe(null);
      });

      expect(document.querySelector('[data-current]')).toBeVisible();
      expect(screen.getByText('Content 1')).toBeVisible();
    });

    it('should handle rapid trigger changes', async () => {
      ignoreActWarnings();
      function TestComponent() {
        return (
          <div>
            <style>
              {`
              [data-transitioning] [data-previous] {
                animation: slide-out 0.2s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 0.2s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
            </style>
            <PreviewCard.Root>
              {({ payload }) => (
                <React.Fragment>
                  <PreviewCard.Trigger href="#" payload={1} delay={0} data-testid="trigger1">
                    Trigger 1
                  </PreviewCard.Trigger>
                  <PreviewCard.Trigger href="#" payload={2} delay={0} data-testid="trigger2">
                    Trigger 2
                  </PreviewCard.Trigger>
                  <PreviewCard.Trigger href="#" payload={3} delay={0} data-testid="trigger3">
                    Trigger 3
                  </PreviewCard.Trigger>
                  <PreviewCard.Portal>
                    <PreviewCard.Positioner>
                      <PreviewCard.Popup>
                        <PreviewCard.Viewport>Content {payload as number}</PreviewCard.Viewport>
                      </PreviewCard.Popup>
                    </PreviewCard.Positioner>
                  </PreviewCard.Portal>
                </React.Fragment>
              )}
            </PreviewCard.Root>
          </div>
        );
      }

      await render(<TestComponent />);

      const trigger1 = screen.getByTestId('trigger1');
      const trigger2 = screen.getByTestId('trigger2');
      const trigger3 = screen.getByTestId('trigger3');

      await waitSingleFrame();
      await act(async () => trigger1.focus());
      await waitSingleFrame();
      await act(async () => trigger2.focus());
      await waitSingleFrame();
      await act(async () => trigger3.focus());
      await waitSingleFrame();
      await act(async () => trigger1.focus());

      await waitFor(async () => {
        expect(await screen.findByText('Content 1')).toBeVisible();
      });
    });

    it.each([
      {
        name: 'should calculate "right down" direction',
        trigger1: { top: 10, left: 10 },
        trigger2: { top: 100, left: 200 },
        expectedDirection: ['right', 'down'],
      },
      {
        name: 'should calculate "left up" direction',
        trigger1: { top: 100, left: 200 },
        trigger2: { top: 10, left: 10 },
        expectedDirection: ['left', 'up'],
      },
      {
        name: 'should calculate "right" direction (horizontal only)',
        trigger1: { top: 50, left: 10 },
        trigger2: { top: 52, left: 200 }, // 2px vertical difference within tolerance
        expectedDirection: ['right'],
      },
      {
        name: 'should calculate "down" direction (vertical only)',
        trigger1: { top: 10, left: 50 },
        trigger2: { top: 100, left: 52 }, // 2px horizontal difference within tolerance
        expectedDirection: ['down'],
      },
      {
        name: 'should handle tolerance for small differences',
        trigger1: { top: 50, left: 50 },
        trigger2: { top: 52, left: 52 }, // Both differences within 5px tolerance
        expectedDirection: [],
      },
      {
        name: 'should calculate "left down" direction',
        trigger1: { top: 10, left: 200 },
        trigger2: { top: 100, left: 10 },
        expectedDirection: ['left', 'down'],
      },
      {
        name: 'should calculate "right up" direction',
        trigger1: { top: 100, left: 10 },
        trigger2: { top: 10, left: 200 },
        expectedDirection: ['right', 'up'],
      },
    ])('$name', async ({ trigger1, trigger2, expectedDirection }) => {
      ignoreActWarnings();

      await render(
        <div>
          <style>
            {`
              [data-transitioning] [data-previous] {
                animation: slide-out 0.2s ease-out forwards;
              }
              [data-transitioning] [data-current] {
                animation: slide-in 0.2s ease-out forwards;
              }
              @keyframes slide-out {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(-30%); opacity: 0; }
              }
              @keyframes slide-in {
                from { transform: translateX(30%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
              }
            `}
          </style>
          <PreviewCard.Root>
            {({ payload }) => (
              <React.Fragment>
                <PreviewCard.Trigger
                  href="#"
                  payload={0}
                  delay={0}
                  data-testid="trigger1"
                  style={{
                    position: 'absolute',
                    top: `${trigger1.top}px`,
                    left: `${trigger1.left}px`,
                    width: '100px',
                    height: '50px',
                  }}
                >
                  Trigger 1
                </PreviewCard.Trigger>
                <PreviewCard.Trigger
                  href="#"
                  payload={1}
                  delay={0}
                  data-testid="trigger2"
                  style={{
                    position: 'absolute',
                    top: `${trigger2.top}px`,
                    left: `${trigger2.left}px`,
                    width: '100px',
                    height: '50px',
                  }}
                >
                  Trigger 2
                </PreviewCard.Trigger>
                <PreviewCard.Portal>
                  <PreviewCard.Positioner>
                    <PreviewCard.Popup>
                      <PreviewCard.Viewport data-testid="viewport">
                        <div data-testid="content">Content {payload as number}</div>
                      </PreviewCard.Viewport>
                    </PreviewCard.Popup>
                  </PreviewCard.Positioner>
                </PreviewCard.Portal>
              </React.Fragment>
            )}
          </PreviewCard.Root>
        </div>,
      );

      const triggerElement1 = screen.getByTestId('trigger1');
      const triggerElement2 = screen.getByTestId('trigger2');

      await waitSingleFrame();
      await act(async () => triggerElement1.focus());

      await waitFor(() => {
        expect(screen.getByText('Content 0')).toBeVisible();
      });

      await waitSingleFrame();
      await act(async () => triggerElement2.focus());

      const viewport = screen.getByTestId('viewport');
      await waitFor(() => {
        expect(viewport).toHaveAttribute('data-activation-direction');
      });

      const direction = viewport.getAttribute('data-activation-direction');

      if (expectedDirection.length === 0) {
        expect(direction?.trim()).toBe('');
      } else {
        expectedDirection.forEach((dir) => {
          expect(direction).toContain(dir);
        });
      }
    });
  });
});
