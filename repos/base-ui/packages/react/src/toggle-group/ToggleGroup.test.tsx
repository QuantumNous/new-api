import { expect, vi } from 'vitest';
import { act, screen } from '@mui/internal-test-utils';
import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { type Orientation } from '../internals/types';

describe('<ToggleGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<ToggleGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('renders a `group`', async () => {
    await render(<ToggleGroup aria-label="My Toggle Group" />);

    expect(screen.queryByRole('group', { name: 'My Toggle Group' })).not.toBe(null);
  });

  describe('uncontrolled', () => {
    it('pressed state', async ({ skip }) => {
      if (isJSDOM) {
        skip();
      }

      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: defaultValue', async () => {
      const { user } = await render(
        <ToggleGroup defaultValue={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });

    it('when Toggles omit value', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle />
          <Toggle value="" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('should warn if Toggle value is not set and ToggleGroup value is defined', async () => {
      vi.spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      await render(
        <ToggleGroup defaultValue={['one']}>
          <Toggle />
          <Toggle />
        </ToggleGroup>,
      );

      expect(console.error).toHaveBeenCalledExactlyOnceWith(
        'Base UI: A `<Toggle>` component rendered in a `<ToggleGroup>` has no explicit `value` prop. This will cause issues between the Toggle Group and Toggle values. Provide the `<Toggle>` with a `value` prop matching the `<ToggleGroup>` values prop type.',
      );
    });
  });

  describe('controlled', () => {
    it('pressed state', async () => {
      const { setProps } = await render(
        <ToggleGroup value={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');

      await setProps({ value: ['one'] });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await setProps({ value: ['two'] });

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    it('prop: value', async () => {
      const { setProps } = await render(
        <ToggleGroup value={['two']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('data-pressed');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await setProps({ value: ['one'] });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button1).toHaveAttribute('data-pressed');
      expect(button2).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('can disable the whole group', async () => {
      await render(
        <ToggleGroup disabled>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'true');
      expect(button1).toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });

    it('can disable individual items', async () => {
      await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" disabled />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-disabled', 'false');
      expect(button1).not.toHaveAttribute('data-disabled');
      expect(button2).toHaveAttribute('aria-disabled', 'true');
      expect(button2).toHaveAttribute('data-disabled');
    });
  });

  describe('prop: orientation', () => {
    it('vertical', async () => {
      await render(
        <ToggleGroup orientation="vertical">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const group = screen.queryByRole('group');
      expect(group).toHaveAttribute('data-orientation', 'vertical');
    });

    it('does not render aria-orientation on role="group"', async () => {
      await render(
        <ToggleGroup orientation="horizontal">
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const group = screen.queryByRole('group');
      expect(group).not.toHaveAttribute('aria-orientation');
    });
  });

  describe('prop: multiple', () => {
    it('multiple items can be pressed when true', async () => {
      const { user } = await render(
        <ToggleGroup multiple defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('only one item can be pressed when false', async () => {
      const { user } = await render(
        <ToggleGroup defaultValue={['one']}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });

    it('when Toggles omit value', async () => {
      const { user } = await render(
        <ToggleGroup multiple>
          <Toggle value="" />
          <Toggle />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(button2).toHaveAttribute('aria-pressed', 'false');
      expect(button1).toHaveAttribute('aria-pressed', 'false');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'false');

      await user.click(button2);
      expect(button1).toHaveAttribute('aria-pressed', 'true');
      expect(button2).toHaveAttribute('aria-pressed', 'true');

      await user.click(button1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
      expect(button2).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe.skipIf(isJSDOM)('keyboard interactions', () => {
    [
      ['ltr', 'horizontal', 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'],
      ['ltr', 'vertical', 'ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'],
      ['rtl', 'horizontal', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'],
      ['rtl', 'vertical', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'],
    ].forEach((entry) => {
      const [direction, orientation, nextKey, prevKey, ignoredNextKey, ignoredPrevKey] = entry;

      describe(direction, () => {
        it(`orientation: ${orientation}`, async () => {
          const { user } = await render(
            <DirectionProvider direction={direction as TextDirection}>
              <ToggleGroup orientation={orientation as Orientation}>
                <Toggle value="one" />
                <Toggle value="two" />
                <Toggle value="three" />
              </ToggleGroup>
            </DirectionProvider>,
          );

          const [button1, button2, button3] = screen.getAllByRole('button');

          await user.keyboard('[Tab]');

          expect(button1).toHaveAttribute('tabindex', '0');
          expect(button1).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          await user.keyboard(`[${nextKey}]`);

          expect(button3).toHaveAttribute('tabindex', '0');
          expect(button3).toHaveFocus();

          // loop to the beginning
          await user.keyboard(`[${nextKey}]`);

          expect(button1).toHaveAttribute('tabindex', '0');
          expect(button1).toHaveFocus();

          await user.keyboard(`[${prevKey}]`);

          expect(button3).toHaveAttribute('tabindex', '0');
          expect(button3).toHaveFocus();

          await user.keyboard(`[${prevKey}]`);

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          // keys from the other axis should not move focus
          await user.keyboard(`[${ignoredNextKey}]`);

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();

          await user.keyboard(`[${ignoredPrevKey}]`);

          expect(button2).toHaveAttribute('tabindex', '0');
          expect(button2).toHaveFocus();
        });
      });
    });

    it('Home key moves focus to the first item', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight][ArrowRight]');
      expect(button3).toHaveFocus();

      await user.keyboard('[Home]');
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(button2).toHaveFocus();

      await user.keyboard('[Home]');
      expect(button1).toHaveAttribute('tabindex', '0');
      expect(button1).toHaveFocus();
    });

    it('End key moves focus to the last item', async () => {
      const { user } = await render(
        <ToggleGroup>
          <Toggle value="one" />
          <Toggle value="two" />
          <Toggle value="three" />
        </ToggleGroup>,
      );

      const [button1, button2, button3] = screen.getAllByRole('button');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard('[End]');
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();

      await user.keyboard('[ArrowLeft]');
      expect(button2).toHaveFocus();

      await user.keyboard('[End]');
      expect(button3).toHaveAttribute('tabindex', '0');
      expect(button3).toHaveFocus();
    });

    ['Enter', 'Space'].forEach((key) => {
      it(`key: ${key} toggles the pressed state`, async () => {
        const { user } = await render(
          <ToggleGroup>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>,
        );

        const [button1] = screen.getAllByRole('button');

        expect(button1).toHaveAttribute('aria-pressed', 'false');

        await act(async () => {
          button1.focus();
        });

        await user.keyboard(`[${key}]`);

        expect(button1).toHaveAttribute('aria-pressed', 'true');

        await user.keyboard(`[${key}]`);

        expect(button1).toHaveAttribute('aria-pressed', 'false');
      });
    });
  });

  describe('prop: onValueChange', () => {
    it('fires when an Item is clicked', async () => {
      const onValueChange = vi.fn();

      const { user } = await render(
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1, button2] = screen.getAllByRole('button');

      expect(onValueChange.mock.calls.length).toBe(0);

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

      await user.pointer({ keys: '[MouseLeft]', target: button2 });

      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
    });

    it('does not change the value when the event is canceled', async () => {
      const onValueChange = vi.fn((_value, eventDetails) => {
        eventDetails.cancel();
      });

      const { user } = await render(
        <ToggleGroup onValueChange={onValueChange}>
          <Toggle value="one" />
          <Toggle value="two" />
        </ToggleGroup>,
      );

      const [button1] = screen.getAllByRole('button');

      await user.pointer({ keys: '[MouseLeft]', target: button1 });

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(button1).toHaveAttribute('aria-pressed', 'false');
    });

    ['Enter', 'Space'].forEach((key) => {
      it(`fires when the ${key} is pressed`, async ({ skip }) => {
        if (isJSDOM) {
          skip();
        }

        const onValueChange = vi.fn();

        const { user } = await render(
          <ToggleGroup onValueChange={onValueChange}>
            <Toggle value="one" />
            <Toggle value="two" />
          </ToggleGroup>,
        );

        const [button1, button2] = screen.getAllByRole('button');

        expect(onValueChange.mock.calls.length).toBe(0);

        await act(async () => {
          button1.focus();
        });

        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(1);
        expect(onValueChange.mock.calls[0][0]).toEqual(['one']);

        await act(async () => {
          button2.focus();
        });

        await user.keyboard(`[${key}]`);

        expect(onValueChange.mock.calls.length).toBe(2);
        expect(onValueChange.mock.calls[1][0]).toEqual(['two']);
      });
    });
  });
});
