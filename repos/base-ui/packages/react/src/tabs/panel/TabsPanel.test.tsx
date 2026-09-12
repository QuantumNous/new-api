import { afterEach, expect, vi } from 'vitest';
import * as React from 'react';
import { Tabs } from '@base-ui/react/tabs';
import { act, reactMajor, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Tabs.Panel />', () => {
  const { render } = createRenderer();

  describeConformance(<Tabs.Panel value="1" keepMounted />, () => ({
    render: (node) => render(<Tabs.Root>{node}</Tabs.Root>),
    refInstanceof: window.HTMLDivElement,
  }));

  describe('Suspense integration', () => {
    it.skipIf(reactMajor < 19)(
      'renders a panel that suspends when opened with the boundary outside the root',
      async () => {
        function createSuspensePromise() {
          let resolvePromise: ((value: string) => void) | null = null;
          const promise = new Promise<string>((resolve) => {
            resolvePromise = resolve;
          });

          return {
            promise,
            resolve(value: string) {
              if (!resolvePromise) {
                throw new Error('Suspense promise resolver not initialized.');
              }
              resolvePromise(value);
            },
          };
        }

        const suspender = createSuspensePromise();

        function SuspendingChild() {
          return <div>{React.use(suspender.promise)}</div>;
        }

        const handleValueChange = vi.fn();

        await render(
          <React.Suspense fallback={<div>Loading…</div>}>
            <Tabs.Root defaultValue="a" onValueChange={handleValueChange}>
              <Tabs.List>
                <Tabs.Tab value="a">Tab A</Tabs.Tab>
                <Tabs.Tab value="b">Tab B</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="a">Panel A</Tabs.Panel>
              <Tabs.Panel value="b">
                <SuspendingChild />
              </Tabs.Panel>
            </Tabs.Root>
          </React.Suspense>,
        );

        const tabB = screen.getByRole('tab', { name: 'Tab B' });

        // `user.click` warns when this interaction suspends via `React.use`,
        // so use the lower-level DOM click inside an awaited act scope.
        await act(async () => {
          tabB.click();
        });

        await screen.findByText('Loading…');

        await act(async () => {
          suspender.resolve('Panel B');
          await Promise.resolve();
        });

        await screen.findByText('Panel B');
        expect(handleValueChange.mock.calls).toHaveLength(1);
        expect(handleValueChange.mock.calls[0][0]).toBe('b');
        expect(handleValueChange.mock.calls[0][1].reason).toBe('none');
      },
    );
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      const notifyTransitionFinished = () => {
        transitionFinished = true;
      };

      const style = `
        .animation-test-panel {
          transition: opacity 1ms;
        }

        .animation-test-panel[data-starting-style],
        .animation-test-panel[data-ending-style] {
          opacity: 0;
        }
      `;

      const { user } = await render(
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="one">Panel one</Tabs.Panel>
            <Tabs.Panel
              className="animation-test-panel"
              data-testid="panel-two"
              onTransitionEnd={notifyTransitionFinished}
              value="two"
            >
              Panel two
            </Tabs.Panel>
          </Tabs.Root>
        </div>,
      );

      expect(screen.queryByTestId('panel-two')).toBeNull();

      await user.click(screen.getByRole('tab', { name: 'Two' }));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('panel-two')).not.toBeNull();
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-panel[data-ending-style] {
          animation: test-anim 100ms;
        }
      `;

      const { user } = await render(
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <Tabs.Root defaultValue="one">
            <Tabs.List>
              <Tabs.Tab value="one">One</Tabs.Tab>
              <Tabs.Tab value="two">Two</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel className="animation-test-panel" data-testid="panel-one" value="one">
              Panel one
            </Tabs.Panel>
            <Tabs.Panel value="two">Panel two</Tabs.Panel>
          </Tabs.Root>
        </div>,
      );

      expect(screen.getByTestId('panel-one')).not.toBeNull();

      await user.click(screen.getByRole('tab', { name: 'Two' }));

      await waitFor(() => {
        const panel = screen.queryByTestId('panel-one');
        expect(panel).not.toBeNull();
        expect(panel).toHaveAttribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('panel-one')).toBeNull();
      });
    });
  });
});
