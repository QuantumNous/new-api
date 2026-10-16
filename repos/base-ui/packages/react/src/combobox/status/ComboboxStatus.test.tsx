import * as React from 'react';
import { expect } from 'vitest';
import { Combobox } from '@base-ui/react/combobox';
import { createRenderer, describeConformance } from '#test-utils';
import { screen, waitFor } from '@mui/internal-test-utils';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../utils/useInitialLiveRegionTextMutation';

describe('<Combobox.Status />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Status />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('renders only when open', async () => {
    const { user } = await render(
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Status data-testid="status">Searching…</Combobox.Status>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.queryByTestId('status')).toBe(null);
    await user.click(screen.getByTestId('input'));
    await waitFor(() => expect(screen.getByTestId('status')).not.toBe(null));
  });

  describe('a11y', () => {
    const { render: renderFakeTimers, clock } = createRenderer();

    clock.withFakeTimers();

    function StatusTest(props: { children?: React.ReactNode }) {
      return (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status data-testid="status">{props.children}</Combobox.Status>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      );
    }

    it('removes the initial text mutation after the reset delay', async () => {
      await renderFakeTimers(<StatusTest>Searching…</StatusTest>);

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status').textContent).toBe('Searching…\u2060');

      clock.tick(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('status').textContent).toBe('Searching…');
    });

    it('updates content immediately after the live region has mounted', async () => {
      const { rerender } = await renderFakeTimers(<StatusTest />);

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status')).toHaveTextContent('');

      await rerender(<StatusTest>Searching…</StatusTest>);

      expect(screen.getByTestId('status')).toHaveTextContent('Searching…');
    });

    it('preserves a custom render prop on the visible element', async () => {
      await renderFakeTimers(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status render={<p data-testid="custom-status" />}>
                  Searching…
                </Combobox.Status>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      expect(screen.getByTestId('custom-status').tagName).toBe('P');
      expect(screen.getByRole('status')).toBe(screen.getByTestId('custom-status'));
      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…\u2060');

      clock.tick(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);

      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…');
    });

    it('restores the marker before unmounting during the reset delay', async () => {
      const { unmount } = await renderFakeTimers(<StatusTest>Searching…</StatusTest>);

      const status = screen.getByTestId('status');
      expect(status.textContent).toBe('Searching…\u2060');

      unmount();

      expect(status.textContent).toBe('Searching…');
    });
  });
});
