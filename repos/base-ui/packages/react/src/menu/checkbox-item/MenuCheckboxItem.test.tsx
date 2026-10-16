import { expect, vi } from 'vitest';
import * as React from 'react';
import { fireEvent, act, waitFor, screen } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';

describe('<Menu.CheckboxItem />', () => {
  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(<Menu.CheckboxItem />, () => ({
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('perf: does not rerender menu items unnecessarily', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    const renderItem1Spy = vi.fn();
    const renderItem2Spy = vi.fn();
    const renderItem3Spy = vi.fn();
    const renderItem4Spy = vi.fn();

    const LoggingRoot = React.forwardRef(function LoggingRoot(
      props: any & { renderSpy: () => void },
      ref: React.ForwardedRef<HTMLLIElement>,
    ) {
      const { renderSpy, state, ...other } = props;
      renderSpy();
      return <li {...other} ref={ref} />;
    });

    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.CheckboxItem render={<LoggingRoot renderSpy={renderItem1Spy} />} id="item-1">
                1
              </Menu.CheckboxItem>
              <Menu.CheckboxItem render={<LoggingRoot renderSpy={renderItem2Spy} />} id="item-2">
                2
              </Menu.CheckboxItem>
              <Menu.CheckboxItem render={<LoggingRoot renderSpy={renderItem3Spy} />} id="item-3">
                3
              </Menu.CheckboxItem>
              <Menu.CheckboxItem render={<LoggingRoot renderSpy={renderItem4Spy} />} id="item-4">
                4
              </Menu.CheckboxItem>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const menuItems = screen.getAllByRole('menuitemcheckbox');
    await act(async () => {
      menuItems[0].focus();
    });

    renderItem1Spy.mockClear();
    renderItem2Spy.mockClear();
    renderItem3Spy.mockClear();
    renderItem4Spy.mockClear();

    expect(renderItem1Spy.mock.calls.length).toBe(0);

    fireEvent.keyDown(menuItems[0], { key: 'ArrowDown' }); // highlights '2'

    // React renders twice in strict mode, so we expect twice the number of spy calls

    await waitFor(
      () => {
        expect(renderItem1Spy.mock.calls.length).toBe(2); // '1' rerenders as it loses highlight
      },
      { timeout: 1000 },
    );

    await waitFor(
      () => {
        expect(renderItem2Spy.mock.calls.length).toBe(2); // '2' rerenders as it receives highlight
      },
      { timeout: 1000 },
    );

    // neither the highlighted nor the selected state of these options changed,
    // so they don't need to rerender:
    expect(renderItem3Spy.mock.calls.length).toBe(0);
    expect(renderItem4Spy.mock.calls.length).toBe(0);
  });

  describe('state management', () => {
    (
      [
        [true, 'true', 'checked'],
        [false, 'false', 'unchecked'],
      ] as const
    ).forEach(([checked, ariaChecked, dataState]) =>
      it('adds the state and ARIA attributes when checked', async () => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked}>Item</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        const item = screen.getByRole('menuitemcheckbox');
        expect(item).toHaveAttribute('aria-checked', ariaChecked);
        expect(item).toHaveAttribute(`data-${dataState}`, '');
      }),
    );

    it('toggles the checked state when clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it(`toggles the checked state when Space is pressed`, async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });
      await user.keyboard('[ArrowDown]');
      const item = screen.getByRole('menuitemcheckbox');

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await user.keyboard(`[Space]`);
      expect(item).toHaveAttribute('data-checked', '');

      await user.keyboard(`[Space]`);
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it.skipIf(isJSDOM)(
      'does not toggle when Space is pressed during an active typeahead session',
      async () => {
        const onCheckedChange = vi.fn();
        const { user } = await render(
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item One</Menu.CheckboxItem>
                  <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item Two</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const [itemOne, itemTwo] = screen.getAllByRole('menuitemcheckbox');

        await act(async () => {
          itemOne.focus();
        });

        await user.keyboard('Item T');

        await waitFor(() => {
          expect(itemTwo).toHaveFocus();
        });

        await user.keyboard('[Space]');
        await user.keyboard('[Space]');

        expect(onCheckedChange.mock.calls.length > 0).toBe(false);
        expect(itemTwo).toHaveAttribute('aria-checked', 'false');
      },
    );

    it(`toggles the checked state when Enter is pressed`, async ({ skip }) => {
      if (isJSDOM) {
        skip();
      }

      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('[ArrowDown]');
      const item = screen.getByRole('menuitemcheckbox');

      await waitFor(() => {
        expect(item).toHaveFocus();
      });

      await user.keyboard(`[Enter]`);
      expect(item).toHaveAttribute('data-checked', '');
    });

    it('calls `onCheckedChange` when the item is clicked', async () => {
      const onCheckedChange = vi.fn();
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(1);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(true);

      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(2);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(false);
    });

    it('does not toggle when `onCheckedChange` cancels the event', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  onCheckedChange={(_, eventDetails) => {
                    eventDetails.cancel();
                  }}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
    });

    it('keeps the state when closed and reopened', async () => {
      const { user } = await render(
        <Menu.Root modal={false}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await act(() => {
        trigger.focus();
      });

      await user.keyboard('{Enter}');

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');

      const itemAfterReopen = screen.getByRole('menuitemcheckbox');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked');
    });
  });

  describe('prop: closeOnClick', () => {
    it('when `closeOnClick=true`, closes the menu when the item is clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem closeOnClick>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('does not close the menu when the item is clicked by default', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleCheckedChange = vi.fn();
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  disabled
                  onCheckedChange={handleCheckedChange}
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      await act(() => item.focus());
      expect(item).toHaveFocus();

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);
    });
  });
});
