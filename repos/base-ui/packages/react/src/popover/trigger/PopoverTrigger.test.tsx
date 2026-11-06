import { expect } from 'vitest';
import { Popover } from '@base-ui/react/popover';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import {
  act,
  fireEvent,
  flushMicrotasks,
  ignoreActWarnings,
  screen,
  waitFor,
} from '@mui/internal-test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';

describe('<Popover.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render(node) {
      return render(<Popover.Root open>{node}</Popover.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('disables the popover', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.click(trigger);
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('custom element', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled render={<span />} nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).not.toHaveAttribute('disabled');
      expect(trigger).toHaveAttribute('data-disabled');
      expect(trigger).toHaveAttribute('aria-disabled', 'true');

      await user.click(trigger);
      expect(screen.queryByText('Content')).toBe(null);

      await user.keyboard('[Tab]');
      expect(document.activeElement).not.toBe(trigger);
    });

    it('does not open on hover when disabled', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger disabled openOnHover delay={0} render={<span />} nativeButton={false} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.hover(trigger);
      await flushMicrotasks();

      expect(screen.queryByText('Content')).toBe(null);
      expect(trigger).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open by clicking', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger />
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await act(async () => {
        trigger.click();
      });

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('should have the data-popup-open but not the data-pressed attribute when open by hover', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0} />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).not.toHaveAttribute('data-pressed');
    });

    it('should not have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true` and `delay=0`', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);

      await act(async () => {
        trigger.click();
      });

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should have the data-popup-open and data-pressed attributes when open by click when `openOnHover=true`', async () => {
      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      await user.hover(trigger);
      await act(async () => {
        trigger.click();
      });

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    const { clock, render: renderFakeTimers } = createRenderer();

    clock.withFakeTimers();

    it('does not close the popover if the user clicks too quickly', async () => {
      await renderFakeTimers(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseMove(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('closes the popover if the user clicks patiently', async () => {
      await renderFakeTimers(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      await renderFakeTimers(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      clock.tick(1);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('does not stick if the user clicks patiently', async () => {
      await renderFakeTimers(
        <Popover.Root>
          <Popover.Trigger delay={0} openOnHover />
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);
      fireEvent.mouseLeave(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks when clicked before the hover delay completes', async () => {
      await renderFakeTimers(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={300}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);

      // User clicks impatiently to open
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');

      fireEvent.mouseLeave(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('should keep the popover open when re-hovered and clicked within the patient threshold', async () => {
      await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={100}>
            Open
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      clock.tick(100);
      await flushMicrotasks();

      expect(screen.getByText('Content')).not.toBe(null);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.mouseLeave(trigger);
      fireEvent.mouseEnter(trigger);
      fireEvent.mouseMove(trigger);

      fireEvent.click(trigger);
      expect(screen.getByText('Content')).not.toBe(null);
    });
  });

  it.skipIf(isJSDOM)(
    'should toggle closed with Enter or Space when rendering a <div>',
    async () => {
      ignoreActWarnings();
      const { userEvent: user } = await import('vitest/browser');
      const { render: vbrRender, cleanup } = await import('vitest-browser-react');

      try {
        await vbrRender(
          <div>
            <Popover.Root>
              <Popover.Trigger render={<div />} nativeButton={false} data-testid="div-trigger">
                Toggle
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <button data-testid="other-button">Other button</button>
          </div>,
        );

        const trigger = screen.getByTestId('div-trigger');

        await act(async () => trigger.focus());
        await user.keyboard('[Enter]');
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.tab({ shift: true });
        expect(document.activeElement).toBe(trigger);

        await user.keyboard('[Enter]');
        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });

        await user.keyboard('[Enter]');
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.tab({ shift: true });
        expect(document.activeElement).toBe(trigger);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).toBe(null);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.tab({ shift: true });
        expect(document.activeElement).toBe(trigger);

        await user.keyboard('[Space]');
        expect(screen.queryByText('Content')).toBe(null);
      } finally {
        await cleanup();
      }
    },
  );
});
