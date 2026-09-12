import { expect } from 'vitest';
import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, describeConformance } from '#test-utils';
import { screen } from '@mui/internal-test-utils';

describe('<Dialog.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          {node}
        </Dialog.Root>,
      );
    },
  }));

  it('has role="presentation"', async () => {
    await render(
      <Dialog.Root open>
        <Dialog.Backdrop data-testid="backdrop" />
      </Dialog.Root>,
    );

    expect(screen.getByTestId('backdrop')).toHaveAttribute('role', 'presentation');
  });

  describe('prop: forceRender', () => {
    it('renders only the root backdrop by default', async () => {
      function App() {
        const [nestedOpen, setNestedOpen] = React.useState(true);

        return (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="root-backdrop" />
            <Dialog.Portal>
              <Dialog.Popup>
                Root dialog
                <Dialog.Root open={nestedOpen} onOpenChange={setNestedOpen}>
                  <Dialog.Backdrop data-testid="nested-backdrop" />
                  <Dialog.Portal>
                    <Dialog.Popup>Nested dialog</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      await render(<App />);

      expect(screen.getByTestId('root-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('nested-backdrop')).toBe(null);
    });

    it('always renders by default when not nested', async () => {
      await render(
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Portal>
            <Dialog.Popup>Content</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(screen.getByTestId('backdrop')).not.toBe(null);
    });

    it('renders only the root backdrop with multiple nesting levels', async () => {
      function App() {
        const [level2Open, setLevel2Open] = React.useState(true);
        const [level3Open, setLevel3Open] = React.useState(true);

        return (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="level-1-backdrop" />
            <Dialog.Portal>
              <Dialog.Popup>
                Level 1 dialog
                <Dialog.Root open={level2Open} onOpenChange={setLevel2Open}>
                  <Dialog.Backdrop data-testid="level-2-backdrop" />
                  <Dialog.Portal>
                    <Dialog.Popup>
                      Level 2 dialog
                      <Dialog.Root open={level3Open} onOpenChange={setLevel3Open}>
                        <Dialog.Backdrop data-testid="level-3-backdrop" />
                        <Dialog.Portal>
                          <Dialog.Popup>Level 3 dialog</Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      await render(<App />);

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('level-2-backdrop')).toBe(null);
      expect(screen.queryByTestId('level-3-backdrop')).toBe(null);
    });

    it('always renders when true', async () => {
      function App() {
        const [level2Open, setLevel2Open] = React.useState(true);
        const [level3Open, setLevel3Open] = React.useState(true);

        return (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="level-1-backdrop" forceRender />
            <Dialog.Portal>
              <Dialog.Popup>
                Level 1 dialog
                <Dialog.Root open={level2Open} onOpenChange={setLevel2Open}>
                  <Dialog.Backdrop data-testid="level-2-backdrop" forceRender />
                  <Dialog.Portal>
                    <Dialog.Popup>
                      Level 2 dialog
                      <Dialog.Root open={level3Open} onOpenChange={setLevel3Open}>
                        <Dialog.Backdrop data-testid="level-3-backdrop" forceRender />
                        <Dialog.Portal>
                          <Dialog.Popup>Level 3 dialog</Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      }

      await render(<App />);

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-2-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-3-backdrop')).not.toBe(null);
    });
  });
});
