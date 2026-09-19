import { expect, vi } from 'vitest';
import { Toolbar } from '@base-ui/react/toolbar';
import { NumberField } from '@base-ui/react/number-field';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { NOOP } from '../../internals/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import { type Orientation } from '../../internals/types';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';
import { ARROW_UP, ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT } from '../../internals/composite/composite';

const testCompositeContext: CompositeRootContext = {
  highlightedIndex: 0,
  onHighlightedIndexChange: NOOP,
  highlightItemOnHover: false,
  relayKeyboardEvent: NOOP,
};

const testToolbarContext: ToolbarRootContext = {
  disabled: false,
  orientation: 'horizontal',
  setItemMap: NOOP,
};

describe('<Toolbar.Input />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    testRenderPropWith: 'input',
    render: (node) => {
      return render(
        <ToolbarRootContext.Provider value={testToolbarContext}>
          <CompositeRootContext.Provider value={testCompositeContext}>
            {node}
          </CompositeRootContext.Provider>
        </ToolbarRootContext.Provider>,
      );
    },
  }));

  describe('ARIA attributes', () => {
    it('renders a textbox', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Input data-testid="input" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('input')).toBe(screen.getByRole('textbox'));
    });
  });

  describe.skipIf(isJSDOM)('keyboard navigation', () => {
    // when navigating through RTL text in real browsers the arrow keys for
    // moving the text insertion cursor is also reversed from LTR but this doesn't
    // work with testing library
    [
      ['horizontal', ARROW_RIGHT, ARROW_LEFT],
      ['vertical', ARROW_DOWN, ARROW_UP],
    ].forEach((entry) => {
      const [orientation, nextKey, prevKey] = entry;

      it(`orientation: ${orientation}`, async () => {
        const { user } = await render(
          <Toolbar.Root orientation={orientation as Orientation}>
            <Toolbar.Button />
            <Toolbar.Input defaultValue="abcd" />
            <Toolbar.Button />
          </Toolbar.Root>,
        );
        const input = screen.getByRole('textbox') as HTMLInputElement;
        const [button1, button2] = screen.getAllByRole('button');

        await user.keyboard('[Tab]');
        expect(button1).toHaveFocus();

        await user.keyboard(`[${nextKey}]`);
        expect(input).toHaveFocus();

        // Firefox doesn't support document.getSelection() in inputs
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe(4);

        await user.keyboard(`[${ARROW_RIGHT}]`);
        await user.keyboard(`[${nextKey}]`);

        expect(button2).toHaveFocus();

        await user.keyboard(`[${prevKey}]`);
        expect(input).toHaveFocus();

        await user.keyboard(`[${ARROW_LEFT}]`);
        await user.keyboard(`[${prevKey}]`);

        expect(button1).toHaveFocus();
      });
    });
  });

  describe.skipIf(isJSDOM)('disabled', () => {
    it('does not trap keyboard focus when disabled', async () => {
      const { user } = await render(
        <div>
          <Toolbar.Root>
            <Toolbar.Button data-testid="button" />
            <Toolbar.Input defaultValue="abcd" disabled />
          </Toolbar.Root>
          <button type="button" data-testid="after">
            after
          </button>
        </div>,
      );

      const button = screen.getByTestId('button');
      const input = screen.getByRole('textbox');
      const after = screen.getByTestId('after');

      await user.keyboard('[Tab]');
      expect(button).toHaveFocus();

      await user.keyboard(`[${ARROW_RIGHT}]`);
      expect(input).toHaveFocus();

      // Tab must leave the toolbar instead of being trapped on the disabled input
      await user.keyboard('[Tab]');
      expect(after).toHaveFocus();

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(input).toHaveFocus();
    });

    it('does not block vertical roving focus when disabled', async () => {
      const { user } = await render(
        <Toolbar.Root orientation="vertical">
          <Toolbar.Button data-testid="button1" />
          <Toolbar.Input defaultValue="abcd" disabled />
          <Toolbar.Button data-testid="button2" />
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');
      const button1 = screen.getByTestId('button1');
      const button2 = screen.getByTestId('button2');

      await user.keyboard('[Tab]');
      expect(button1).toHaveFocus();

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(input).toHaveFocus();

      // ArrowDown must move roving focus past the disabled input
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(button2).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(button1).toHaveFocus();
    });
  });

  describe('rendering NumberField', () => {
    it('renders NumberField.Input', async () => {
      await render(
        <Toolbar.Root>
          <NumberField.Root>
            <NumberField.Group>
              <Toolbar.Input render={<NumberField.Input />} />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-roledescription', 'Number field');
    });

    it('handles interactions', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input render={<NumberField.Input />} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');

      await user.keyboard('[Tab]');
      expect(input).toHaveAttribute('tabindex', '0');
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0][0]).toBe(6);

      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.calls[1][0]).toBe(5);
    });

    it('disabled state', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Toolbar.Root>
          <NumberField.Root min={1} max={10} defaultValue={5} onValueChange={onValueChange}>
            <NumberField.Group>
              <NumberField.Decrement />
              <Toolbar.Input disabled render={<NumberField.Input />} />
              <NumberField.Increment />
            </NumberField.Group>
          </NumberField.Root>
        </Toolbar.Root>,
      );

      const input = screen.getByRole('textbox');

      expect(input).not.toHaveAttribute('disabled');
      expect(input).toHaveAttribute('data-disabled');
      expect(input).toHaveAttribute('aria-disabled', 'true');

      await user.keyboard('[Tab]');
      expect(input).toHaveAttribute('tabindex', '0');
      expect(input).toHaveFocus();

      await user.keyboard(`[${ARROW_UP}]`);
      await user.keyboard(`[${ARROW_DOWN}]`);
      expect(onValueChange.mock.calls.length).toBe(0);
    });
  });
});
