import * as React from 'react';
import { expect } from 'vitest';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, flushMicrotasks, screen } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { Popover } from '@base-ui/react/popover';
import { describeConformance, createRenderer } from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';

describe('<Menu.Trigger />', () => {
  const { render } = createRenderer();
  const user = userEvent.setup();

  describeConformance(<Menu.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('should render a disabled button', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger disabled />
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveProperty('disabled', true);
    });

    it('should not open the menu when clicked', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger disabled />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });
  });

  it('toggles the menu state when clicked', async () => {
    await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const button = screen.getByRole('button', { name: 'Open' });
    await user.click(button);

    const menuPopup = await screen.findByRole('menu', { hidden: false });
    expect(menuPopup).not.toBe(null);
    expect(menuPopup).toHaveAttribute('data-open', '');
  });

  describe('keyboard navigation', () => {
    [
      <Menu.Trigger>Open</Menu.Trigger>,
      <Menu.Trigger render={<span />} nativeButton={false}>
        Open
      </Menu.Trigger>,
    ].forEach((buttonComponent) => {
      const buttonType = buttonComponent.props.slots?.root ? 'non-native' : 'native';
      ['ArrowUp', 'ArrowDown', 'Enter', ' '].forEach((key) => {
        if (buttonType === 'native' && (key === ' ' || key === 'Enter')) {
          return;
        }

        it(`opens the menu when pressing "${key}" on a ${buttonType} button`, async () => {
          await render(
            <Menu.Root>
              {buttonComponent}
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>,
          );

          const button = screen.getByRole('button', { name: 'Open' });
          await act(async () => {
            button.focus();
          });

          await user.keyboard(`[${key}]`);

          const menuPopup = screen.queryByRole('menu', { hidden: false });
          expect(menuPopup).not.toBe(null);
        });
      });
    });
  });

  describe('accessibility attributes', () => {
    it('has the aria-haspopup attribute', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger />
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup');
    });

    it('has the aria-expanded=false attribute when closed', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger />
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('has aria-expanded=true when the menu is opened', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button', { name: 'Toggle' });
      expect(button).toHaveAttribute('aria-expanded', 'false');

      await user.click(button);

      const menuPopup = await screen.findByRole('menu', { hidden: false });
      expect(menuPopup).not.toBe(null);
      expect(button).toHaveAttribute('data-popup-open');
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('style hooks', () => {
    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger />
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      await act(async () => {
        trigger.click();
      });

      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
    });

    it('keeps the data-popup-open attribute and handle.isOpen when a controlled close is vetoed', async () => {
      const handle = Menu.createHandle();

      function TestCase() {
        const [open, setOpen] = React.useState(false);

        return (
          <React.Fragment>
            <Menu.Root
              handle={handle}
              open={open}
              onOpenChange={(nextOpen) => {
                if (nextOpen) {
                  setOpen(true);
                }
              }}
            >
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button type="button">Outside</button>
          </React.Fragment>
        );
      }

      await render(<TestCase />);

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      await screen.findByRole('menu');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Outside' }));

      expect(screen.getByRole('menu')).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('impatient clicks with `openOnHover=true`', () => {
    const { clock, render: renderFakeTimers } = createRenderer();

    clock.withFakeTimers();

    it('does not close the menu if the user clicks too quickly', async () => {
      await renderFakeTimers(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseMove(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD - 1);

      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('closes the menu if the user clicks patiently', async () => {
      await renderFakeTimers(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button');

      fireEvent.mouseEnter(trigger);

      clock.tick(PATIENT_CLICK_THRESHOLD);

      fireEvent.click(trigger);

      expect(trigger).not.toHaveAttribute('data-popup-open');
    });

    it('sticks if the user clicks impatiently', async () => {
      await renderFakeTimers(
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
        </Menu.Root>,
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
        <Menu.Root>
          <Menu.Trigger delay={0} openOnHover />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
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
        <Menu.Root>
          <Menu.Trigger openOnHover delay={300}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
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

    it('should keep the menu open when re-hovered and clicked within the patient threshold', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger openOnHover delay={100}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>Content</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
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

  describe('preventBaseUIHandler', () => {
    it('prevents opening the menu with a mouse when `preventBaseUIHandler` is called in onMouseDown', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger onMouseDown={(event) => event.preventBaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });

    it('prevents opening the menu with keyboard when `preventBaseUIHandler` is called in onClick', async () => {
      await render(
        <Menu.Root>
          <Menu.Trigger onClick={(event) => event.preventBaseUIHandler()} />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const button = screen.getByRole('button');
      await act(async () => {
        button.focus();
      });

      await user.keyboard('[Enter]');

      expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
    });
  });

  it('does not have role prop inside a Popover', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    const button = screen.getByTestId('menu-trigger');
    expect(button).not.toHaveAttribute('role');
  });

  it('has a role prop inside a Popover when not a native button', async () => {
    await render(
      <Popover.Root open>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger" render={<span />} nativeButton={false} />
              </Menu.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    const button = screen.getByTestId('menu-trigger');
    expect(button).toHaveAttribute('role', 'button');
  });
});
