import { expect } from 'vitest';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, describeConformance } from '#test-utils';
import { screen } from '@mui/internal-test-utils';

describe('<Dialog.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Dialog.Root open>{node}</Dialog.Root>);
    },
  }));

  describe('Suspense integration', () => {
    // Issue #3695
    it('should not throw "Maximum update depth exceeded" when Suspense boundary is outside Portal', async () => {
      function createLazyComponent() {
        let resolvePromise: ((value: { default: React.ComponentType }) => void) | null = null;
        const promise = new Promise<{ default: React.ComponentType }>((resolve) => {
          resolvePromise = resolve;
        });

        return {
          LazyComponent: React.lazy(() => promise),
          resolve(value: { default: React.ComponentType }) {
            if (!resolvePromise) {
              throw new Error('Lazy message resolver not initialized.');
            }
            resolvePromise(value);
          },
        };
      }

      const { LazyComponent, resolve } = createLazyComponent();

      await render(
        <React.Suspense fallback="Loading…">
          <Dialog.Root open>
            <Dialog.Portal>
              <Dialog.Popup>
                <LazyComponent />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </React.Suspense>,
      );

      expect(await screen.findByText('Loading…')).not.toBe(null);
      resolve({ default: () => <p>Greetings</p> });
      expect(await screen.findByText('Greetings')).not.toBe(null);
    });
  });
});
