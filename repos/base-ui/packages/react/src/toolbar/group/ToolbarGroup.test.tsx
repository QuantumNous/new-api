import { expect } from 'vitest';
import { Toolbar } from '@base-ui/react/toolbar';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';
import { NOOP } from '../../internals/noop';
import { ToolbarRootContext } from '../root/ToolbarRootContext';
import { CompositeRootContext } from '../../internals/composite/root/CompositeRootContext';

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

describe('<Toolbar.Group />', () => {
  const { render } = createRenderer();

  describeConformance(<Toolbar.Group />, () => ({
    refInstanceof: window.HTMLDivElement,
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
    it('renders a group', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Group data-testid="group" />
        </Toolbar.Root>,
      );

      expect(screen.getByTestId('group')).toBe(screen.getByRole('group'));
    });
  });

  describe('prop: disabled', () => {
    it('disables all toolbar items except links in the group', async () => {
      await render(
        <Toolbar.Root>
          <Toolbar.Group disabled>
            <Toolbar.Button />
            <Toolbar.Link href="https://base-ui.com">Link</Toolbar.Link>
            <Toolbar.Input defaultValue="" />
          </Toolbar.Group>
        </Toolbar.Root>,
      );

      [screen.getByRole('button'), screen.getByRole('textbox')].forEach((toolbarItem) => {
        expect(toolbarItem).toHaveAttribute('aria-disabled', 'true');
        expect(toolbarItem).toHaveAttribute('data-disabled');
      });

      expect(screen.getByText('Link')).not.toHaveAttribute('data-disabled');
      expect(screen.getByText('Link')).not.toHaveAttribute('aria-disabled');
    });
  });
});
