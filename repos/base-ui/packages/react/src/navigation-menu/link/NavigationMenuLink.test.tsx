import { expect } from 'vitest';
import { screen, waitFor } from '@mui/internal-test-utils';
import { NavigationMenu } from '@base-ui/react/navigation-menu';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<NavigationMenu.Link />', () => {
  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Link />, () => ({
    refInstanceof: window.HTMLAnchorElement,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.List>{node}</NavigationMenu.List>
        </NavigationMenu.Root>,
      );
    },
  }));

  describe.skipIf(!isJSDOM)('prop: closeOnClick', () => {
    it('closes the menu when clicking a link when true', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="popup-1">
                <NavigationMenu.Link href="#link-1" closeOnClick>
                  Link 1
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>

          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const link = screen.getByRole('link', { name: 'Link 1' });
      await user.click(link);

      await waitFor(() => expect(screen.queryByTestId('popup-1')).toBe(null));
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not close the menu when clicking a link when false', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="popup-1">
                <NavigationMenu.Link href="#link-1" closeOnClick={false}>
                  Link 1
                </NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>

          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const link = screen.getByRole('link', { name: 'Link 1' });
      await user.click(link);

      await waitFor(() => expect(screen.queryByTestId('popup-1')).not.toBe(null));
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('prop: active', () => {
    it('when `true`, renders with aria-current="page"', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active>
                active
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByRole('link', { name: 'active' })).toHaveAttribute('aria-current', 'page');
    });

    it('when `false`, does not render with aria-current="page"', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Link href="#" active={false}>
                inactive
              </NavigationMenu.Link>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
      expect(screen.getByRole('link', { name: 'inactive' })).not.toHaveAttribute('aria-current');
    });
  });
});
