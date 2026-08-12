import { expect, vi } from 'vitest';
import * as React from 'react';
import { screen } from '@mui/internal-test-utils';
import { Collapsible } from '@base-ui/react/collapsible';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { REASONS } from '../../internals/reasons';

const PANEL_CONTENT = 'This is panel content';

describe('<Collapsible.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Collapsible.Root />, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  describe('ARIA attributes', () => {
    it('sets ARIA attributes', async () => {
      await render(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-expanded');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(trigger.getAttribute('aria-controls')).toBe(panel.getAttribute('id'));
    });

    it('references manual panel id in trigger aria-controls', async () => {
      await render(
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger />
          <Collapsible.Panel id="custom-panel-id" data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');
      const panel = screen.getByTestId('panel');

      expect(trigger).toHaveAttribute('aria-controls', 'custom-panel-id');
      expect(panel).toHaveAttribute('id', 'custom-panel-id');
    });
  });

  describe('collapsible status', () => {
    it('disabled status', async () => {
      await render(
        <Collapsible.Root disabled>
          <Collapsible.Trigger />
          <Collapsible.Panel data-testid="panel" />
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).toHaveAttribute('data-disabled');
    });

    it('does not toggle or call onOpenChange when clicked while disabled', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root disabled onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('BaseUIChangeEventDetails', () => {
    it('calls onOpenChange with eventDetails', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      const [openArg, details] = handleOpenChange.mock.calls[0] as [boolean, any];
      expect(openArg).toBe(true);
      expect(details).not.toBe(undefined);
      expect(details.reason).toBe(REASONS.triggerPress);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.isCanceled).toBe(false);
      expect(typeof details.cancel).toBe('function');
      expect(typeof details.allowPropagation).toBe('function');
    });

    it('eventDetails.cancel() prevents opening while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      const { user } = await render(
        <Collapsible.Root onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('eventDetails.cancel() prevents closing while uncontrolled', async () => {
      const handleOpenChange = vi.fn(
        (nextOpen, eventDetails: Collapsible.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );

      const { user } = await render(
        <Collapsible.Root defaultOpen onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
    });
  });

  describe.skipIf(isJSDOM)('open state', () => {
    it('controlled trigger presses request open and close state changes', async () => {
      function App() {
        const [open, setOpen] = React.useState(false);
        return (
          <Collapsible.Root open={open} onOpenChange={setOpen}>
            <Collapsible.Trigger>trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);

      await user.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('does not change controlled open state without an external update', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <Collapsible.Root open={false} onOpenChange={handleOpenChange}>
          <Collapsible.Trigger>trigger</Collapsible.Trigger>
          <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'trigger' });

      await user.click(trigger);

      expect(handleOpenChange).toHaveBeenCalledOnce();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('controlled mode', async () => {
      function App() {
        const [open, setOpen] = React.useState(false);
        return (
          <React.Fragment>
            <Collapsible.Root open={open}>
              <Collapsible.Trigger>trigger</Collapsible.Trigger>
              <Collapsible.Panel>This is panel content</Collapsible.Panel>
            </Collapsible.Root>
            <button type="button" onClick={() => setOpen(!open)}>
              toggle
            </button>
          </React.Fragment>
        );
      }
      const { user } = await render(<App />);

      const externalTrigger = screen.getByRole('button', { name: 'toggle' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.click(externalTrigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');

      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.click(externalTrigger);

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });

    it('uncontrolled mode', async () => {
      const { user } = await render(
        <Collapsible.Root defaultOpen={false}>
          <Collapsible.Trigger />
          <Collapsible.Panel>This is panel content</Collapsible.Panel>
        </Collapsible.Root>,
      );

      const trigger = screen.getByRole('button');

      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls');
      expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
      expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
      expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-panel-open');

      await user.pointer({ keys: '[MouseLeft]', target: trigger });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-panel-open');
      expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
    });
  });

  describe('state callbacks', () => {
    it('passes state to className and style callbacks', async () => {
      const { user } = await render(
        <Collapsible.Root
          data-testid="root"
          className={(state) => (state.open ? 'root-open' : 'root-closed')}
          style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
        >
          <Collapsible.Trigger
            className={(state) => (state.open ? 'trigger-open' : 'trigger-closed')}
            style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            Trigger
          </Collapsible.Trigger>
          <Collapsible.Panel
            keepMounted
            data-testid="panel"
            className={(state) => (state.open ? 'panel-open' : 'panel-closed')}
            style={(state) => ({ opacity: state.open ? 1 : 0.5 })}
          >
            {PANEL_CONTENT}
          </Collapsible.Panel>
        </Collapsible.Root>,
      );

      const root = screen.getByTestId('root');
      const trigger = screen.getByRole('button', { name: 'Trigger' });
      const panel = screen.getByTestId('panel');

      expect(root).toHaveClass('root-closed');
      expect(root).toHaveStyle({ opacity: '0.5' });
      expect(trigger).toHaveClass('trigger-closed');
      expect(trigger).toHaveStyle({ opacity: '0.5' });
      expect(panel).toHaveClass('panel-closed');
      expect(panel).toHaveStyle({ opacity: '0.5' });

      await user.click(trigger);

      expect(root).toHaveClass('root-open');
      expect(root).toHaveStyle({ opacity: '1' });
      expect(trigger).toHaveClass('trigger-open');
      expect(trigger).toHaveStyle({ opacity: '1' });
      expect(panel).toHaveClass('panel-open');
      expect(panel).toHaveStyle({ opacity: '1' });
    });
  });

  describe.skipIf(isJSDOM)('keyboard interactions', () => {
    ['Enter', 'Space'].forEach((key) => {
      it(`key: ${key} does not toggle or call onOpenChange when disabled`, async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <Collapsible.Root disabled onOpenChange={handleOpenChange}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
          </Collapsible.Root>,
        );

        const trigger = screen.getByRole('button');

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();

        await user.keyboard(`[${key}]`);

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      });
    });

    ['Enter', 'Space'].forEach((key) => {
      it(`key: ${key} should toggle the Collapsible`, async () => {
        const { user } = await render(
          <Collapsible.Root defaultOpen={false}>
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
            <Collapsible.Panel>This is panel content</Collapsible.Panel>
          </Collapsible.Root>,
        );

        const trigger = screen.getByRole('button');

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);

        await user.keyboard('[Tab]');
        expect(trigger).toHaveFocus();
        await user.keyboard(`[${key}]`);

        expect(trigger).toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT)).toBeVisible();
        expect(screen.queryByText(PANEL_CONTENT)).not.toBe(null);
        expect(screen.queryByText(PANEL_CONTENT)).toHaveAttribute('data-open');

        await user.keyboard(`[${key}]`);

        expect(trigger).not.toHaveAttribute('aria-controls');
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).not.toHaveAttribute('data-panel-open');
        expect(screen.queryByText(PANEL_CONTENT)).toBe(null);
      });
    });
  });
});
