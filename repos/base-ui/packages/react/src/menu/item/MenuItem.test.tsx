import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';

describe('<Menu.Item />', () => {
  const { render, clock } = createRenderer({
    clockOptions: {
      shouldAdvanceTime: true,
    },
  });

  clock.withFakeTimers();

  describeConformance(<Menu.Item />, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  it('calls the onClick handler when clicked', async () => {
    const onClick = vi.fn();
    const { user } = await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick} id="item">
                Item
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
  });

  it('does not close the menu when onClick prevents Base UI handler', async () => {
    const onClick = vi.fn((event) => event.preventBaseUIHandler());
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onClick={onClick}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const trigger = screen.getByRole('button', { name: 'Open' });
    await user.click(trigger);

    const item = screen.getByRole('menuitem');
    await user.click(item);

    expect(onClick.mock.calls.length).toBe(1);
    expect(screen.queryByRole('menu')).not.toBe(null);
  });

  it('allows onMouseDown to call preventBaseUIHandler', async () => {
    await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item onMouseDown={(event) => event.preventBaseUIHandler()}>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const item = screen.getByRole('menuitem');

    expect(() => fireEvent.mouseDown(item)).not.toThrow();
  });

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

    const { user } = await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item render={<LoggingRoot renderSpy={renderItem1Spy} />} id="item-1">
                1
              </Menu.Item>
              <Menu.Item render={<LoggingRoot renderSpy={renderItem2Spy} />} id="item-2">
                2
              </Menu.Item>
              <Menu.Item render={<LoggingRoot renderSpy={renderItem3Spy} />} id="item-3">
                3
              </Menu.Item>
              <Menu.Item render={<LoggingRoot renderSpy={renderItem4Spy} />} id="item-4">
                4
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const menuItems = screen.getAllByRole('menuitem');
    await act(async () => {
      menuItems[0].focus();
    });

    renderItem1Spy.mockClear();
    renderItem2Spy.mockClear();
    renderItem3Spy.mockClear();
    renderItem4Spy.mockClear();

    expect(renderItem1Spy.mock.calls.length).toBe(0);

    await user.keyboard('{ArrowDown}'); // highlights '2'

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

  describe('prop: closeOnClick', () => {
    it('closes the menu when the item is clicked by default', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('when `closeOnClick=false` does not close the menu when the item is clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item closeOnClick={false}>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitem');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });

  describe('disabled state', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item
                  disabled
                  onClick={handleClick}
                  onKeyDown={handleKeyDown}
                  onKeyUp={handleKeyUp}
                >
                  Item
                </Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitem');
      await act(() => item.focus());
      expect(item).toHaveFocus();

      fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);

      fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
    });
  });
});
