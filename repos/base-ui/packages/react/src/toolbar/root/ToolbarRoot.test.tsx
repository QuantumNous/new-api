import { expect } from 'vitest';
import { Toolbar } from '@base-ui/react/toolbar';
import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { type Orientation } from '../../internals/types';

describe('<Toolbar.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('ARIA attributes', () => {
    it('has role="toolbar"', async () => {
      const { container } = await render(<Toolbar.Root />);

      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'toolbar');
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    [
      ['ltr', 'horizontal', 'ArrowRight', 'ArrowLeft'],
      ['ltr', 'vertical', 'ArrowDown', 'ArrowUp'],
      ['rtl', 'horizontal', 'ArrowLeft', 'ArrowRight'],
      ['rtl', 'vertical', 'ArrowDown', 'ArrowUp'],
    ].forEach((entry) => {
      const [direction, orientation, nextKey, prevKey] = entry;

      describe(direction, () => {
        it(`orientation: ${orientation}`, async () => {
          const { user } = await render(
            <DirectionProvider direction={direction as TextDirection}>
              <Toolbar.Root dir={direction} orientation={orientation as Orientation}>
                <Toolbar.Button />
                <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
                <Toolbar.Group>
                  <Toolbar.Button />
                  <Toolbar.Button />
                </Toolbar.Group>
                <Toolbar.Input defaultValue="" />
              </Toolbar.Root>
            </DirectionProvider>,
          );
          const [button1, groupedButton1, groupedButton2] = screen.getAllByRole('button');
          const link = screen.getByText('Link');
          const input = screen.getByRole('textbox');

          await user.keyboard('[Tab]');
          expect(button1).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);
          expect(link).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);
          expect(groupedButton1).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);
          expect(groupedButton2).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);
          expect(input).toHaveFocus();

          // loop to the beginning
          await user.keyboard(`[${nextKey}]`);
          expect(button1).toHaveFocus();

          await user.keyboard(`[${prevKey}]`);
          expect(input).toHaveFocus();

          await user.keyboard(`[${prevKey}]`);
          expect(groupedButton2).toHaveFocus();
        });
      });
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links', async () => {
      await render(
        <Toolbar.Root disabled>
          <Toolbar.Button />
          <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
          <Toolbar.Input defaultValue="" />
          <Toolbar.Group>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input defaultValue="" />
          </Toolbar.Group>
        </Toolbar.Root>,
      );

      [...screen.getAllByRole('button'), ...screen.getAllByRole('textbox')].forEach(
        (toolbarItem) => {
          expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
          expect(toolbarItem).toHaveAttribute('data-disabled');
        },
      );

      expect(screen.getByRole('group')).toHaveAttribute('data-disabled');

      screen.getAllByText('Link').forEach((link) => {
        expect(link).not.toHaveAttribute('data-disabled');
        expect(link).not.toHaveAttribute('aria-disabled');
      });
    });
  });

  describe.skipIf(isJSDOM)('prop: focusableWhenDisabled', () => {
    function expectFocusedWhenDisabled(element: Element) {
      expect(element).toHaveAttribute('data-disabled');
      expect(element).toHaveAttribute('aria-disabled', 'true');
      expect(element).toHaveFocus();
    }

    it('toolbar items can be focused when disabled by default', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled />
          </Toolbar.Group>
          <Toolbar.Input defaultValue="" disabled />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      [input, ...buttons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton1);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton2);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await user.keyboard('[ArrowRight]');
      expect(button1).toHaveAttribute('tabindex', '0');

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(input);

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(groupedButton2);
    });

    it('toolbar items can individually disable focusableWhenDisabled', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled />
          <Toolbar.Group>
            <Toolbar.Button disabled />
            <Toolbar.Button disabled focusableWhenDisabled={false} />
          </Toolbar.Group>
          <Toolbar.Input defaultValue="" disabled />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const buttons = screen.getAllByRole('button');
      const focusableWhenDisabledButtons = buttons.filter(
        (button) => button.getAttribute('data-focusable') != null,
      );
      [input, ...focusableWhenDisabledButtons].forEach((item) => {
        expect(item).not.toHaveAttribute('disabled');
      });

      const [button1, groupedButton1, groupedButton2] = buttons;
      expect(groupedButton2).toHaveAttribute('disabled');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(groupedButton1);

      await user.keyboard('[ArrowRight]');
      expectFocusedWhenDisabled(input);

      // loop to the beginning
      await user.keyboard('[ArrowRight]');
      expect(button1).toHaveAttribute('tabindex', '0');

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(input);

      await user.keyboard('[ArrowLeft]');
      expectFocusedWhenDisabled(groupedButton1);
    });

    it('moves the initial tab stop off a disabled, non-focusable first item', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');
      // a natively disabled first item cannot hold the single roving tab stop
      expect(button1).toHaveAttribute('disabled');
      expect(button1).not.toHaveAttribute('tabindex', '0');
      expect(button2).toHaveAttribute('tabindex', '0');

      await user.keyboard('[Tab]');
      expect(button2).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button3).toHaveFocus();

      // looping back skips the disabled first item
      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();
    });

    it('keeps an enabled item with focusableWhenDisabled={false} navigable', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Button focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');
      expect(button2).not.toHaveAttribute('disabled');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button3).toHaveFocus();
    });

    it('skips a disabled Toolbar.Input with focusableWhenDisabled={false}', async () => {
      const { user } = await render(
        <Toolbar.Root>
          <Toolbar.Button />
          <Toolbar.Input defaultValue="" disabled focusableWhenDisabled={false} />
          <Toolbar.Button />
        </Toolbar.Root>,
      );

      const [button1, button2] = screen.getAllByRole('button');
      const input = screen.getByRole('textbox');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(input).not.toHaveFocus();
      expect(button2).toHaveFocus();
    });
  });
});
