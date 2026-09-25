import { expect } from 'vitest';
import { Tooltip } from '@base-ui/react/tooltip';
import { screen, fireEvent, flushMicrotasks } from '@mui/internal-test-utils';
import { createRenderer } from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';

describe('<Tooltip.Provider />', () => {
  const { render, clock } = createRenderer();

  describe('prop: delay', () => {
    clock.withFakeTimers();

    it('waits for the delay before showing the tooltip', async () => {
      await render(
        <Tooltip.Provider delay={10_000}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      expect(screen.queryByText('Content')).toBe(null);

      clock.tick(1_000);

      expect(screen.queryByText('Content')).toBe(null);

      clock.tick(9_000);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects delay=0', async () => {
      await render(
        <Tooltip.Provider delay={0}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(0);

      expect(screen.queryByText('Content')).not.toBe(null);
    });

    it('respects trigger delay prop over provider delay prop', async () => {
      await render(
        <Tooltip.Provider delay={10}>
          <Tooltip.Root>
            <Tooltip.Trigger delay={100} />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      expect(screen.queryByText('Content')).toBe(null);

      clock.tick(99);

      expect(screen.queryByText('Content')).toBe(null);

      clock.tick(1);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.toBe(null);
    });
  });

  describe('prop: closeDelay', () => {
    clock.withFakeTimers();

    it('waits for the closeDelay before hiding the tooltip', async () => {
      await render(
        <Tooltip.Provider closeDelay={400}>
          <Tooltip.Root>
            <Tooltip.Trigger />
            <Tooltip.Portal>
              <Tooltip.Positioner>
                <Tooltip.Popup>Content</Tooltip.Popup>
              </Tooltip.Positioner>
            </Tooltip.Portal>
          </Tooltip.Root>
        </Tooltip.Provider>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(OPEN_DELAY);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.toBe(null);

      fireEvent.mouseLeave(trigger);

      clock.tick(300);

      expect(screen.queryByText('Content')).not.toBe(null);

      clock.tick(300);

      expect(screen.queryByText('Content')).toBe(null);
    });

    it('uses the latest closeDelay after the prop updates', async () => {
      function Test({ closeDelay }: { closeDelay: number }) {
        return (
          <Tooltip.Provider closeDelay={closeDelay}>
            <Tooltip.Root>
              <Tooltip.Trigger />
              <Tooltip.Portal>
                <Tooltip.Positioner>
                  <Tooltip.Popup>Content</Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          </Tooltip.Provider>
        );
      }

      const { rerender } = await render(<Test closeDelay={400} />);

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(OPEN_DELAY);

      await flushMicrotasks();

      expect(screen.queryByText('Content')).not.toBe(null);

      await rerender(<Test closeDelay={1000} />);

      fireEvent.mouseLeave(trigger);

      clock.tick(999);

      expect(screen.queryByText('Content')).not.toBe(null);

      clock.tick(1);

      expect(screen.queryByText('Content')).toBe(null);
    });
  });
});
