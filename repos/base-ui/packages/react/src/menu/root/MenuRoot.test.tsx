import { expect, vi } from 'vitest';
import * as React from 'react';
import {
  act,
  fireEvent,
  flushMicrotasks,
  ignoreActWarnings,
  screen,
  waitFor,
} from '@mui/internal-test-utils';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { Menu } from '@base-ui/react/menu';
import { Dialog } from '@base-ui/react/dialog';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import userEvent from '@testing-library/user-event';
import { createRenderer, isJSDOM, popupConformanceTests, wait } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';

describe('<Menu.Root />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger}>Open menu</Menu.Trigger>
        <Menu.Portal {...props.portal}>
          <Menu.Positioner>
            <Menu.Popup {...props.popup}>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'menu',
  });

  // All these tests run for contained and detached triggers.
  // The rendered menu has the same structure in most cases.
  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenu },
    { name: 'detached triggers', Component: DetachedTriggerMenu },
  ])('when using $name', ({ Component: TestMenu }) => {
    describe('keyboard navigation', () => {
      it('changes the highlighted item using the arrow keys', async () => {
        await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      it('changes the highlighted item using the Home and End keys', async () => {
        await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');
        const item1 = screen.getByTestId('item-1');
        const item5 = screen.getByTestId('item-5');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{End}');
        await waitFor(() => {
          expect(item5).toHaveFocus();
        });

        await userEvent.keyboard('{Home}');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });
      });

      it('includes disabled items during keyboard navigation', async () => {
        await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const disabledItem3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(disabledItem3).toHaveFocus();
        });

        expect(disabledItem3).toHaveAttribute('aria-disabled', 'true');
      });

      it.skipIf(isJSDOM)('skips items hidden with CSS during keyboard navigation', async () => {
        await render(
          <TestMenu
            popupProps={{
              children: (
                <React.Fragment>
                  <Menu.Item data-testid="item-1" style={{ display: 'none' }}>
                    Item 1
                  </Menu.Item>
                  <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                </React.Fragment>
              ),
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const hiddenItem = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
        expect(hiddenItem).toHaveAttribute('tabindex', '-1');

        await userEvent.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await userEvent.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      describe('text navigation', () => {
        it.skipIf(isJSDOM)('changes the highlighted item', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="bb">Bb</Menu.Item>,
            <Menu.Item key="ca">Ca</Menu.Item>,
            <Menu.Item key="cb">Cb</Menu.Item>,
            <Menu.Item key="cd">Cd</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Ca')).toHaveFocus();
          });

          expect(screen.getByText('Ca')).toHaveAttribute('tabindex', '0');

          await user.keyboard('d');
          await waitFor(() => {
            expect(screen.getByText('Cd')).toHaveFocus();
          });

          expect(screen.getByText('Cd')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)('skips items hidden with CSS in text navigation', async () => {
          const itemElements = [
            <Menu.Item key="hidden" data-testid="item-hidden" style={{ display: 'none' }}>
              Apple
            </Menu.Item>,
            <Menu.Item key="apricot" data-testid="item-apricot">
              Apricot
            </Menu.Item>,
            <Menu.Item key="banana" data-testid="item-banana">
              Banana
            </Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
          );

          const hiddenItem = screen.getByTestId('item-hidden');
          const apricotItem = screen.getByTestId('item-apricot');
          const bananaItem = screen.getByTestId('item-banana');

          await act(async () => {
            bananaItem.focus();
          });

          await user.keyboard('a');
          await waitFor(() => {
            expect(apricotItem).toHaveFocus();
          });

          expect(hiddenItem).toHaveAttribute('tabindex', '-1');
        });

        it.skipIf(!isJSDOM)(
          'changes the highlighted item using text navigation on label prop',
          async () => {
            const itemElements = [
              <Menu.Item key="1" label="Aa">
                1
              </Menu.Item>,
              <Menu.Item key="2" label="Ba">
                2
              </Menu.Item>,
              <Menu.Item key="3" label="Bb">
                3
              </Menu.Item>,
              <Menu.Item key="4" label="Ca">
                4
              </Menu.Item>,
            ];

            const { user } = await render(<TestMenu popupProps={{ children: itemElements }} />);

            const trigger = screen.getByRole('button', { name: 'Toggle' });
            await user.click(trigger);
            const items = screen.getAllByRole('menuitem');
            await flushMicrotasks();

            await user.keyboard('b');
            await waitFor(() => {
              expect(items[1]).toHaveFocus();
            });

            await waitFor(() => {
              expect(items[1]).toHaveAttribute('tabindex', '0');
            });

            await user.keyboard('b');
            await waitFor(() => {
              expect(items[2]).toHaveFocus();
            });

            await waitFor(() => {
              expect(items[2]).toHaveAttribute('tabindex', '0');
            });

            await user.keyboard('b');
            await waitFor(() => {
              expect(items[2]).toHaveFocus();
            });

            await waitFor(() => {
              expect(items[2]).toHaveAttribute('tabindex', '0');
            });
          },
        );

        it.skipIf(isJSDOM)('skips the non-stringifiable items', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="empty" />,
            <Menu.Item key="nested">
              <div>Nested Content</div>
            </Menu.Item>,
            <Menu.Item key="undefined">{undefined}</Menu.Item>,
            <Menu.Item key="null">{null}</Menu.Item>,
            <Menu.Item key="bc">Bc</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Bc')).toHaveFocus();
          });
          expect(screen.getByText('Bc')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)('navigate to options with diacritic characters', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="bb">Bb</Menu.Item>,
            <Menu.Item key="bą">Bą</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          await act(async () => {
            items[0].focus();
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('Bą')).toHaveFocus();
          });
          expect(screen.getByText('Bą')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)(
          'navigate to next options that begin with diacritic characters',
          async () => {
            const itemElements = [
              <Menu.Item key="aa">Aa</Menu.Item>,
              <Menu.Item key="ąa">ąa</Menu.Item>,
              <Menu.Item key="ąb">ąb</Menu.Item>,
              <Menu.Item key="ąc">ąc</Menu.Item>,
            ];

            const { user } = await render(
              <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
            );

            const items = screen.getAllByRole('menuitem');

            await act(async () => {
              items[0].focus();
            });

            await user.keyboard('ą');
            await waitFor(() => {
              expect(screen.getByText('ąa')).toHaveFocus();
            });
            expect(screen.getByText('ąa')).toHaveAttribute('tabindex', '0');
          },
        );

        it.skipIf(isJSDOM)(
          'does not trigger the onClick event when Space is pressed during text navigation',
          async () => {
            const handleClick = vi.fn();

            const itemElements = [
              <Menu.Item key="one" onClick={() => handleClick()}>
                Item One
              </Menu.Item>,
              <Menu.Item key="two" onClick={() => handleClick()}>
                Item Two
              </Menu.Item>,
              <Menu.Item key="three" onClick={() => handleClick()}>
                Item Three
              </Menu.Item>,
            ];

            const { user } = await render(
              <TestMenu rootProps={{ open: true }} popupProps={{ children: itemElements }} />,
            );

            const items = screen.getAllByRole('menuitem');

            await act(async () => {
              items[0].focus();
            });

            await user.keyboard('Item T');

            expect(handleClick.mock.calls.length > 0).toBe(false);

            await waitFor(() => {
              expect(items[1]).toHaveFocus();
            });
          },
        );

        it.skipIf(isJSDOM)(
          'does not open a submenu when pressing Space during a typeahead session',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: (
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">
                        Add to Playlist
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item>Add now</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  ),
                }}
              />,
            );

            const submenuTrigger = screen.getByTestId('submenu-trigger');

            await act(async () => {
              submenuTrigger.focus();
            });

            await user.keyboard('Add to p');

            await waitFor(() => {
              expect(submenuTrigger).toHaveFocus();
            });

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).toBe(null);

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).toBe(null);
          },
        );

        it('opens a focused submenu trigger with Space when not typing', async () => {
          const { user } = await render(<TestMenu rootProps={{ open: true }} />);

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          await act(async () => {
            submenuTrigger.focus();
          });

          await user.keyboard('[Space]');
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        it.skipIf(isJSDOM)(
          'matches "Item 2" after "Item " currently matches "Item 1"',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: (
                    <React.Fragment>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                      <Menu.Item>Item 3</Menu.Item>
                    </React.Fragment>
                  ),
                }}
              />,
            );

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const item2 = screen.getByTestId('item-2');

            await act(async () => {
              item1.focus();
            });

            await user.keyboard('Item 2');
            expect(item2).toHaveFocus();
          },
        );

        it.skipIf(isJSDOM)(
          'matches a submenu trigger label after a space + numeric suffix',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: (
                    <React.Fragment>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger">
                          Item 2
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup data-testid="submenu">
                              <Menu.Item>Nested 2.1</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                      <Menu.Item>Item 3</Menu.Item>
                    </React.Fragment>
                  ),
                }}
              />,
            );

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const submenuTrigger = screen.getByTestId('submenu-trigger');

            await act(async () => {
              item1.focus();
            });

            await user.keyboard('Item 2');
            expect(submenuTrigger).toHaveFocus();
            expect(screen.queryByTestId('submenu')).toBe(null);
          },
        );
      });
    });

    describe('nested menus', () => {
      (
        [
          ['vertical', 'ltr', 'ArrowRight', 'ArrowLeft'],
          ['vertical', 'rtl', 'ArrowLeft', 'ArrowRight'],
          ['horizontal', 'ltr', 'ArrowDown', 'ArrowUp'],
          ['horizontal', 'rtl', 'ArrowDown', 'ArrowUp'],
        ] as const
      ).forEach(([orientation, direction, openKey, closeKey]) => {
        it.skipIf(isJSDOM)(
          `opens a nested menu of a ${orientation} ${direction.toUpperCase()} menu with ${openKey} key and closes it with ${closeKey}`,

          async () => {
            const { user } = await render(
              <DirectionProvider direction={direction}>
                <TestMenu rootProps={{ open: true, orientation }} submenuProps={{ orientation }} />
              </DirectionProvider>,
            );

            const submenuTrigger = screen.getByTestId('submenu-trigger');

            await act(async () => {
              submenuTrigger.focus();
            });

            // This check fails in JSDOM
            await waitFor(() => {
              expect(submenuTrigger).toHaveFocus();
            });

            await user.keyboard(`[${openKey}]`);

            let submenu: HTMLElement | null = await screen.findByTestId('submenu');

            const submenuItem1 = screen.queryByTestId('item-4_1');
            expect(submenuItem1).not.toBe(null);
            await waitFor(() => {
              expect(submenuItem1).toHaveFocus();
            });

            await user.keyboard(`[${closeKey}]`);

            submenu = screen.queryByTestId('submenu');
            expect(submenu).toBe(null);

            expect(submenuTrigger).toHaveFocus();
          },
        );
      });

      it('opens submenu on click when openOnHover is false', async () => {
        const { user } = await render(<TestMenu submenuTriggerProps={{ openOnHover: false }} />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        expect(menu).not.toBe(null);
        expect(await screen.findByTestId('item-4_1')).toHaveTextContent('Item 4.1');
      });

      it('closes submenus when focus is lost by shift-tabbing from a nested menu', async () => {
        const { user } = await render(<TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        const submenuItem = await screen.findByTestId('item-4_1');
        await act(async () => {
          submenuItem.focus();
        });

        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });

        // Shift+Tab should close the submenu and focus should return to the submenu trigger
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });

        expect(submenuTrigger).toHaveFocus();
      });

      it('closes the entire tree when clicking outside the deepest submenu', async () => {
        const { user } = await render(
          <div>
            <TestMenu />
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger1).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('submenu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger2 = await screen.findByTestId('nested-submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger2).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('nested-submenu');

        const outside = screen.getByTestId('outside');
        await user.click(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('level-1')).toBe(null);
          expect(screen.queryByTestId('level-2')).toBe(null);
          expect(screen.queryByTestId('level-3')).toBe(null);
        });
      });

      it.skipIf(isJSDOM)(
        'returns focus to submenu triggers when closing nested menus',
        async () => {
          const { user } = await render(<TestMenu />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          await user.click(trigger);

          await screen.findByTestId('menu');

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');

          const nestedSubmenuTrigger = await screen.findByTestId('nested-submenu-trigger');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          await waitFor(() => {
            expect(nestedSubmenuTrigger).toHaveFocus();
          });

          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('nested-submenu');

          await user.keyboard('[ArrowLeft]');

          await waitFor(() => {
            expect(screen.queryByTestId('nested-submenu')).toBe(null);
          });
          expect(nestedSubmenuTrigger).toHaveFocus();

          await user.keyboard('[ArrowLeft]');

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).toBe(null);
          });
          expect(submenuTrigger).toHaveFocus();
        },
      );
    });

    describe('controlled open', () => {
      it('returns focus to the opener when a menu is opened programmatically', async () => {
        function Test() {
          const [open, setOpen] = React.useState(false);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setOpen(true)}>
                Open menu programmatically
              </button>
              <Menu.Root open={open} triggerId="menu-trigger" onOpenChange={setOpen}>
                <Menu.Trigger id="menu-trigger">Menu trigger</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Close menu</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </React.Fragment>
          );
        }

        const { user } = await render(<Test />);

        const opener = screen.getByRole('button', { name: 'Open menu programmatically' });
        await user.click(opener);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(screen.getByRole('menuitem', { name: 'Close menu' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
        expect(opener).toHaveFocus();
      });
    });

    describe('nested popups', () => {
      it('keeps the menu and dialog open when pressing Shift+Tab inside a nested dialog', async () => {
        function MenuWithNestedDialog() {
          return (
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu-popup">
                    <Menu.Item>Item 1</Menu.Item>
                    <Dialog.Root>
                      <Menu.Item
                        render={<Dialog.Trigger />}
                        closeOnClick={false}
                        nativeButton
                        data-testid="dialog-trigger"
                      >
                        Open Dialog
                      </Menu.Item>
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="dialog-popup">
                          <button type="button" data-testid="dialog-button">
                            Dialog Button
                          </button>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Menu.Item>Item 2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        }

        const { user } = await render(<MenuWithNestedDialog />);

        const menuTrigger = screen.getByTestId('menu-trigger');
        await user.click(menuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu-popup')).not.toBe(null);
        });

        const dialogTrigger = screen.getByTestId('dialog-trigger');
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
        });

        const dialogButton = screen.getByTestId('dialog-button');
        await act(async () => {
          dialogButton.focus();
        });

        await waitFor(() => {
          expect(dialogButton).toHaveFocus();
        });

        // Shift+Tab inside the dialog should NOT close the menu or the dialog
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        // Both menu and dialog should still be open
        await waitFor(() => {
          expect(screen.queryByTestId('menu-popup')).not.toBe(null);
          expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
        });
      });

      it.skipIf(isJSDOM)(
        'keeps focus in a nested alert dialog popup when the pointer leaves the triggering menu item',
        async () => {
          function MenuWithNestedAlertDialog() {
            return (
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="menu-popup">
                      <Menu.Item>Item 1</Menu.Item>
                      <AlertDialog.Root>
                        <Menu.Item
                          render={<AlertDialog.Trigger />}
                          closeOnClick={false}
                          nativeButton
                          data-testid="alert-dialog-trigger"
                        >
                          Open Alert Dialog
                        </Menu.Item>
                        <AlertDialog.Portal>
                          <AlertDialog.Backdrop data-testid="alert-dialog-backdrop" />
                          <AlertDialog.Popup data-testid="alert-dialog-popup">
                            <AlertDialog.Close data-testid="alert-dialog-close">
                              Close
                            </AlertDialog.Close>
                          </AlertDialog.Popup>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                      <Menu.Item>Item 2</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            );
          }

          const { user } = await render(<MenuWithNestedAlertDialog />);

          await user.click(screen.getByTestId('menu-trigger'));

          const alertDialogTrigger = await screen.findByTestId('alert-dialog-trigger');
          await user.click(alertDialogTrigger);

          const menuPopup = screen.getByTestId('menu-popup');
          const alertDialogPopup = await screen.findByTestId('alert-dialog-popup');

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).toBe(true);
          });

          fireEvent.pointerLeave(alertDialogTrigger, {
            pointerType: 'mouse',
            relatedTarget: document.body,
          });

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).toBe(true);
          });
          expect(menuPopup.contains(document.activeElement)).toBe(false);
        },
      );

      it.skipIf(isJSDOM)(
        'keeps pending focus in a nested dialog when the pointer leaves the triggering menu item',
        async () => {
          function MenuWithNestedDialog() {
            return (
              <Menu.Root>
                <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="menu-popup">
                      <Menu.Item>Item 1</Menu.Item>
                      <Dialog.Root>
                        <Menu.Item
                          render={<Dialog.Trigger render={<div />} nativeButton={false} />}
                          closeOnClick={false}
                          data-testid="dialog-trigger"
                        >
                          Open Dialog
                        </Menu.Item>
                        <Dialog.Portal>
                          <Dialog.Popup data-testid="dialog-popup">
                            <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
                          </Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                      <Menu.Item>Item 2</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            );
          }

          const { user } = await render(<MenuWithNestedDialog />);

          await user.click(screen.getByTestId('menu-trigger'));

          const frameCallbacks = new Map<number, FrameRequestCallback>();
          let frameId = 0;
          const requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => {
              frameId += 1;
              frameCallbacks.set(frameId, callback);
              return frameId;
            });
          const cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation((id) => {
              frameCallbacks.delete(id);
            });

          try {
            const dialogTrigger = await screen.findByTestId('dialog-trigger');
            fireEvent.click(dialogTrigger);
            await flushMicrotasks();
            fireEvent.pointerLeave(dialogTrigger, {
              pointerType: 'mouse',
              relatedTarget: document.body,
            });

            const dialogClose = await screen.findByTestId('dialog-close');

            act(() => {
              const callbacks = Array.from(frameCallbacks.values());
              frameCallbacks.clear();
              callbacks.forEach((callback) => callback(performance.now()));
            });

            await waitFor(() => {
              expect(dialogClose).toHaveFocus();
            });

            expect(screen.getByTestId('menu-popup').contains(document.activeElement)).toBe(false);
          } finally {
            requestAnimationFrameSpy.mockRestore();
            cancelAnimationFrameSpy.mockRestore();
          }
        },
      );
    });

    describe('focus management', () => {
      it('focuses the first item after the menu is opened by keyboard', async () => {
        await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await userEvent.keyboard('[Enter]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(firstItem.tabIndex).toBe(0);
        });
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the first item when down arrow key opens the menu', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => expect(firstItem).toHaveFocus());
        expect(firstItem.tabIndex).toBe(0);
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the last item when up arrow key opens the menu', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowUp]');

        const items = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(items[4]).toHaveFocus();
        });

        expect(items[4].tabIndex).toBe(0);
        [items[0], items[1], items[2], items[3]].forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the trigger after the menu is closed', async () => {
        const { user } = await render(
          <div>
            <input type="text" />
            <TestMenu />
            <input type="text" />
          </div>,
        );

        const button = screen.getByRole('button', { name: 'Toggle' });
        await user.click(button);

        const menuItem = await screen.findAllByRole('menuitem');
        await user.click(menuItem[0]);

        expect(button).toHaveFocus();
      });

      it.skipIf(isJSDOM)(
        'focuses the trigger after Escape when the closing menu receives mouseleave',
        async () => {
          globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

          const { user } = await render(
            <React.Fragment>
              <style>
                {`
                  .transition-test-indicator {
                    transition:
                      transform 100ms ease-out,
                      opacity 100ms ease-out;
                  }

                  .transition-test-indicator[data-ending-style] {
                    opacity: 0;
                    transform: scale(0.98);
                  }
                `}
              </style>
              <TestMenu popupProps={{ className: 'transition-test-indicator' }} />
            </React.Fragment>,
          );

          const button = screen.getByRole('button', { name: 'Toggle' });
          await user.click(button);

          const firstItem = await screen.findByTestId('item-1');
          await user.hover(firstItem);

          await waitFor(() => {
            expect(firstItem).toHaveFocus();
          });

          await user.keyboard('[Escape]');

          // During an exit transition, the positioner can receive a mouseleave after Escape
          // when pointer-events change while the pointer rests over the popup.
          fireEvent.mouseLeave(screen.getByTestId('menu-positioner'), {
            relatedTarget: document.body,
          });

          await waitFor(() => {
            expect(screen.queryByRole('menu')).toBe(null);
          });
          expect(button).toHaveFocus();
        },
      );

      it.skipIf(isJSDOM)(
        'focuses the trigger after the menu is closed but not unmounted',
        async () => {
          const { user } = await render(
            <div>
              <input type="text" />
              <TestMenu portalProps={{ keepMounted: true }} />
              <input type="text" />
            </div>,
          );

          const button = screen.getByRole('button', { name: 'Toggle' });
          await user.click(button);

          const menuItem = await screen.findAllByRole('menuitem');
          await user.click(menuItem[0]);

          await waitFor(() => {
            expect(button).toHaveFocus();
          });
        },
      );
    });

    describe('focus guards', () => {
      it('closes the menu and moves focus to the next element when tabbing forward from the open menu', async () => {
        const { user } = await render(
          <div>
            <input />
            <TestMenu rootProps={{ modal: false }} />
            <input data-testid="after" />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
      });

      it('closes the menu and moves focus to the trigger when shift-tabbing from the open menu', async () => {
        const { user } = await render(
          <div>
            <input data-testid="before" />
            <TestMenu />
            <input />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await screen.findByTestId('menu');

        const menuItem = screen.getByTestId('item-1');
        await act(async () => {
          menuItem.focus();
        });

        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
      });
    });

    describe('prop: closeParentOnEsc', () => {
      it('does not close the parent menu when the Escape key is pressed by default', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[Escape]');

        const menus = screen.queryAllByRole('menu', { hidden: false });
        await waitFor(() => {
          expect(menus.length).toBe(1);
        });

        expect(menus[0].dataset.testid).toBe('menu');
      });

      it('closes the parent menu when the Escape key is pressed  if `closeParentOnEsc=true`', async () => {
        const { user } = await render(<TestMenu submenuProps={{ closeParentOnEsc: true }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(async () => {
          trigger.focus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Item 4.1' })).toHaveFocus();
        });

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });
    });

    describe('hover close', () => {
      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(<TestMenu rootProps={{ defaultOpen: true }} />);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.toBe(null);
      });
    });

    describe('controlled open', () => {
      it('does not close after hovering out of a popup opened externally', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setOpen(true)}>
                Show
              </button>
              <TestMenu rootProps={{ open, onOpenChange: setOpen }} />
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);

          return (
            <TestMenu
              rootProps={{ open, onOpenChange: setOpen, modal: false }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />
          );
        }

        await render(<App />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        expect(screen.queryByRole('menu')).not.toBe(null);

        const positioner = screen.getByTestId('menu-positioner');

        fireEvent.mouseEnter(positioner);
        fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('interaction type tracking (openMethod)', () => {
        it('should not apply scroll lock when opened via touch', async () => {
          await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');

          const doc = menu.ownerDocument;

          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(false);
        });

        it('should apply scroll lock when opened via mouse', async () => {
          const { user } = await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const doc = trigger.ownerDocument;

          await user.click(trigger);
          await screen.findByRole('menu');

          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(true);
        });
      });

      describe('touch scroll lock', () => {
        it('should apply scroll lock when a touch-opened popup covers the viewport width', async () => {
          await render(
            <Menu.Root modal>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Open' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');
          const doc = menu.ownerDocument;

          await waitFor(() => {
            const isScrollLocked =
              doc.documentElement.style.overflow === 'hidden' ||
              doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
              doc.body.style.overflow === 'hidden';

            expect(isScrollLocked).toBe(true);
          });
        });

        it('should not apply scroll lock when a touch-opened popup is narrower than the viewport', async () => {
          await render(
            <Menu.Root modal>
              <Menu.Trigger>Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Open' });

          fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');
          const doc = menu.ownerDocument;

          await act(async () => {
            await new Promise<void>((resolve) => {
              requestAnimationFrame(() => resolve());
            });
          });

          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(false);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the menu when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = await render(
          <TestMenu
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await act(() => {
          trigger.focus();
        });

        await user.keyboard('{Enter}');

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await act(async () => {
          await new Promise((resolve) => {
            requestAnimationFrame(resolve);
          });

          actionsRef.current.unmount();
        });

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('is called on close when there is no exit animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(true);
          return (
            <div>
              <button onClick={() => setOpen(false)}>Close</button>
              <TestMenu rootProps={{ open, onOpenChangeComplete }} />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
      });

      it('is called on close when the exit animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
          @keyframes test-anim {
            to {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-ending-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = React.useState(true);

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(false)}>Close</button>
              <TestMenu
                rootProps={{ open, onOpenChangeComplete }}
                popupProps={{ className: 'animation-test-indicator' }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        expect(screen.getByTestId('menu')).not.toBe(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
      });

      it('is called on open when there is no enter animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(false);
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open</button>
              <TestMenu rootProps={{ open, onOpenChangeComplete }} />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).not.toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls.length).toBe(2);
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      it('is called on open when the enter animation finishes', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
          @keyframes test-anim {
            from {
              opacity: 0;
            }
          }

          .animation-test-indicator[data-starting-style] {
            animation: test-anim 1ms;
          }
        `;

          const [open, setOpen] = React.useState(false);

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(true)}>Open</button>
              <TestMenu
                rootProps={{ open, onOpenChange: setOpen, onOpenChangeComplete }}
                popupProps={{ className: 'animation-test-indicator' }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        expect(screen.queryByTestId('menu')).not.toBe(null);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = vi.fn();

        await render(<TestMenu rootProps={{ onOpenChangeComplete }} />);

        expect(onOpenChangeComplete.mock.calls.length).toBe(0);
      });
    });

    describe('prop: openOnHover', () => {
      it('should open the menu when the trigger is hovered', async () => {
        await render(<TestMenu triggerProps={{ openOnHover: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });
      });

      it('should close the menu when the trigger is no longer hovered', async () => {
        await render(
          <TestMenu rootProps={{ modal: false }} triggerProps={{ openOnHover: true, delay: 0 }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await userEvent.unhover(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });

      it('opens the submenu on hover with zero delay', async () => {
        await render(
          <ContainedTriggerMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });
      });

      it('does not clear body pointer-events styles when closing a scoped submenu', async () => {
        await render(
          <TestMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0, closeDelay: 0 }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        const previousBodyPointerEvents = document.body.style.pointerEvents;
        try {
          document.body.style.pointerEvents = 'none';

          const sibling = screen.getByTestId('item-2');
          // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
          fireEvent.mouseMove(sibling);

          await waitFor(() => {
            expect(screen.queryByTestId('submenu')).toBe(null);
          });

          expect(document.body.style.pointerEvents).toBe('none');
        } finally {
          document.body.style.pointerEvents = previousBodyPointerEvents;
        }
      });

      it('scopes submenu safePolygon pointer events to the parent menu with keepMounted portal', async () => {
        await render(
          <TestMenu
            rootProps={{ defaultOpen: true }}
            popupProps={{
              children: (
                <React.Fragment>
                  <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger" delay={0}>
                      Item 2
                    </Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner data-testid="submenu-positioner">
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Item 2.1</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                </React.Fragment>
              ),
            }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const menu = screen.getByTestId('menu');
        const submenuPositioner = screen.getByTestId('submenu-positioner');

        expect(menu.style.pointerEvents).toBe('none');
        expect(submenuPositioner.style.pointerEvents).toBe('auto');
        expect(screen.getByTestId('item-3').style.pointerEvents).toBe('');
      });

      it('should not close when submenu is hovered after root menu is hovered', async () => {
        await render(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });

        const menu = screen.getByTestId('menu');

        await userEvent.hover(menu);

        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const submenu = screen.getByTestId('submenu');

        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(menu);
        fireEvent.mouseLeave(menu);
        await userEvent.hover(submenu);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      it('keeps the parent submenu open after a third-level submenu closes due to sibling hover', async () => {
        await render(
          <ContainedTriggerMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await act(async () => {
          trigger.focus();
        });

        await userEvent.hover(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });

        // Open first-level submenu
        const level1Trigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await userEvent.hover(level1Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        // Open second-level submenu
        const level2Trigger = screen.getByRole('menuitem', { name: 'Item 4.3' });
        await userEvent.hover(level2Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('nested-submenu')).not.toBe(null);
        });

        // Hover a sibling item in the parent submenu to close the second-level submenu
        const parentSibling = screen.getByRole('menuitem', { name: 'Item 4.2' });
        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        fireEvent.mouseMove(parentSibling);

        await waitFor(() => {
          expect(screen.queryByTestId('nested-submenu')).toBe(null);
        });

        // Now unhover the parent submenu container; it should remain open
        const submenu1 = screen.getByTestId('submenu');
        fireEvent.mouseLeave(submenu1);

        // Parent submenu should still be open
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      describe('modal behavior', () => {
        const { render: renderFakeTimers, clock } = createRenderer();

        clock.withFakeTimers();

        it('reopens on hover after an impatient click closes via item press', async () => {
          await renderFakeTimers(<TestMenu triggerProps={{ openOnHover: true, delay: 100 }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();

          fireEvent.click(screen.getByTestId('item-1'));

          await flushMicrotasks();

          expect(screen.queryByRole('menu')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          clock.tick(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        it('treats hover-opened menus as modal after a click', async () => {
          await renderFakeTimers(
            <Menu.Root>
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          fireEvent.mouseEnter(trigger);
          fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('menu')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          clock.tick(PATIENT_CLICK_THRESHOLD - 1);
          fireEvent.click(trigger);

          await flushMicrotasks();
          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });
      });
    });

    describe('prop: closeDelay', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('should close after delay', async () => {
        await renderFakeTimers(
          <TestMenu triggerProps={{ openOnHover: true, delay: 0, closeDelay: 100 }} />,
        );

        const anchor = screen.getByRole('button');

        fireEvent.mouseEnter(anchor);
        fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Item 1')).not.toBe(null);

        fireEvent.mouseLeave(anchor);

        clock.tick(50);

        expect(screen.getByText('Item 1')).not.toBe(null);

        clock.tick(50);

        expect(screen.queryByText('Item 1')).toBe(null);
      });

      it('should close submenu after delay when hovering a sibling item', async () => {
        await renderFakeTimers(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />,
        );

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Submenu should still be open after partial delay
        clock.tick(50);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Submenu should close after the full delay
        clock.tick(50);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('should not restart closeDelay on repeated mousemove over sibling items', async () => {
        await renderFakeTimers(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />,
        );

        const trigger = screen.getByRole('button');

        fireEvent.mouseEnter(trigger);
        fireEvent.mouseMove(trigger);

        await flushMicrotasks();

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        fireEvent.mouseMove(siblingItem);

        // Wait 80ms (most of the delay), then move again over the sibling
        clock.tick(80);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Move again - this should NOT restart the timer
        fireEvent.mouseMove(siblingItem);

        // After 20 more ms (100ms total from first move), the submenu should close
        clock.tick(20);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
    });

    describe('submenu hover open', () => {
      const { render: renderFakeTimers, clock } = createRenderer();

      clock.withFakeTimers();

      it('opens a submenu after a plain delay without waiting for the pointer to rest', async () => {
        // The menu is opened programmatically, so `allowMouseEnter` starts
        // `false`. Hovering the submenu trigger as the first item must still
        // open it after a plain delay rather than collapsing to a rest-only
        // path that requires the cursor to stop moving.
        await renderFakeTimers(
          <TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        fireEvent.mouseEnter(submenuTrigger);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });

        // Keep the pointer moving past the open delay so it never comes to rest.
        clock.tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        clock.tick(40);
        fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        clock.tick(40);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('mouse interaction', () => {
      afterEach(async () => {
        const { cleanup } = await import('vitest-browser-react');
        await cleanup();
      });

      it('triggers a menu item and closes the menu on click, drag, release', async () => {
        ignoreActWarnings();
        const openChangeSpy = vi.fn();
        const clickSpy = vi.fn();

        const items = [
          <Menu.Item key="1" data-testid="item-1">
            1
          </Menu.Item>,
          <Menu.Item key="2" data-testid="item-2" onClick={clickSpy}>
            2
          </Menu.Item>,
          <Menu.Item key="3" data-testid="item-3">
            3
          </Menu.Item>,
        ];

        await render(
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{ children: items }}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        fireEvent.mouseDown(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).not.toBe(null);
        });

        await wait(200);

        const item2 = screen.getByTestId('item-2');
        fireEvent.mouseUp(item2);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(clickSpy.mock.calls.length).toBe(1);

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      });

      it('closes the menu on click, drag outside, release', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        const openChangeSpy = vi.fn();

        const items = [
          <Menu.Item key="1" data-testid="item-1">
            1
          </Menu.Item>,
          <Menu.Item key="2" data-testid="item-2">
            2
          </Menu.Item>,
          <Menu.Item key="3" data-testid="item-3">
            3
          </Menu.Item>,
        ];

        await vbrRender(
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{ children: items }}
            />
            <div data-testid="outside">Outside</div>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        const outsideElement = screen.getByTestId('outside');

        await user.dragAndDrop(trigger, outsideElement);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.cancelOpen);
      });
    });

    describe('BaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents opening while uncontrolled', async () => {
        await render(
          <TestMenu
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await userEvent.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });

      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = await render(
          <TestMenu
            rootProps={{
              onOpenChange: (open, details) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByRole('menu')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
      });
    });
  });

  it('does not leave a tabbable item after tabbing out of a keepMounted menu before close', async () => {
    const actionsRef = {
      current: {
        unmount: vi.fn(),
        close: vi.fn(),
      },
    };

    const { user } = await render(
      <div>
        <input />
        <DetachedTriggerMenu
          rootProps={{ modal: false, actionsRef }}
          portalProps={{ keepMounted: true }}
        />
        <input data-testid="after" />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await act(async () => {
      trigger.focus();
    });
    await user.keyboard('[Enter]');

    const menuItem = await screen.findByTestId('item-1');
    await waitFor(() => {
      expect(menuItem).toHaveFocus();
    });
    expect(menuItem).toHaveAttribute('tabindex', '0');

    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    await act(async () => {
      actionsRef.current.close();
    });

    await waitFor(() => {
      expect(screen.getByTestId('menu')).not.toHaveAttribute('data-open');
    });
    expect(menuItem).toHaveAttribute('tabindex', '-1');
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      await render(
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item2 = screen.getByTestId('item-2');
      fireEvent.mouseMove(item2);

      await flushMicrotasks();

      expect(item2).not.toHaveFocus();
    });

    it('does not highlight submenu triggers from mouse enter when disabled', async () => {
      await render(
        <TestMenuContents
          rootProps={{ open: true, highlightItemOnHover: false }}
          popupProps={{
            children: (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Nested item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            ),
          }}
        />,
      );

      const submenuTrigger = screen.getByTestId('submenu-trigger');
      fireEvent.mouseEnter(submenuTrigger);

      await flushMicrotasks();

      expect(submenuTrigger).not.toHaveAttribute('data-highlighted');
      expect(submenuTrigger).not.toHaveFocus();
    });
  });

  describe('prop: disabled', () => {
    it('does not highlight items with text navigation when controlled open', async () => {
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            children: (
              <React.Fragment>
                <Menu.Item data-testid="alpha">Alpha</Menu.Item>
                <Menu.Item data-testid="beta">Beta</Menu.Item>
              </React.Fragment>
            ),
          }}
        />,
      );

      const alpha = screen.getByTestId('alpha');
      const beta = screen.getByTestId('beta');

      await act(async () => {
        alpha.focus();
      });

      await user.keyboard('b');
      await flushMicrotasks();

      expect(beta).not.toHaveAttribute('data-highlighted');
      expect(beta).not.toHaveFocus();
    });

    it('does not close or activate items when controlled open', async () => {
      const handleOpenChange = vi.fn();
      const handleClick = vi.fn();
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true, onOpenChange: handleOpenChange }}
          popupProps={{
            children: (
              <Menu.Item data-testid="item" onClick={handleClick}>
                Item
              </Menu.Item>
            ),
          }}
        />,
      );

      await user.click(screen.getByTestId('item'));

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('disables submenu triggers when controlled open', async () => {
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            children: (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                  Submenu
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Nested item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            ),
          }}
        />,
      );

      const submenuTrigger = screen.getByTestId('submenu-trigger');

      expect(submenuTrigger).toHaveAttribute('data-disabled');

      await user.click(submenuTrigger);

      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });
  });

  describe('dynamic items', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it('skips null items when navigating', async () => {
      function DynamicMenu() {
        const [itemsFiltered, setItemsFiltered] = React.useState(false);

        return (
          <Menu.Root
            onOpenChange={(newOpen) => {
              if (newOpen) {
                setTimeout(() => {
                  setItemsFiltered(true);
                }, 0);
              }
            }}
            onOpenChangeComplete={(newOpen) => {
              if (!newOpen) {
                setItemsFiltered(false);
              }
            }}
          >
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Add to Library</Menu.Item>
                  {!itemsFiltered && (
                    <React.Fragment>
                      <Menu.Item>Add to Playlist</Menu.Item>
                      <Menu.Item>Play Next</Menu.Item>
                      <Menu.Item>Play Last</Menu.Item>
                    </React.Fragment>
                  )}
                  <Menu.Item>Favorite</Menu.Item>
                  <Menu.Item>Share</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      }

      const { user } = await renderFakeTimers(<DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      await act(async () => {
        trigger.focus();
      });

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      await user.keyboard('{ArrowDown}'); // loops back to Add to Library

      expect(screen.queryByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
    });
  });
});

function ContainedTriggerMenu(props: TestMenuProps) {
  const { triggerProps, ...rest } = props;
  return (
    <TestMenuContents {...rest}>
      <Menu.Trigger {...triggerProps}>Toggle</Menu.Trigger>
    </TestMenuContents>
  );
}

function DetachedTriggerMenu(props: TestMenuProps) {
  const { triggerProps, ...rest } = props;
  const menuHandle = useRefWithInit(() => new Menu.Handle()).current;

  return (
    <React.Fragment>
      <TestMenuContents
        {...rest}
        rootProps={{ ...rest.rootProps, handle: menuHandle }}
      ></TestMenuContents>
      <Menu.Trigger handle={menuHandle} {...triggerProps}>
        Toggle
      </Menu.Trigger>
    </React.Fragment>
  );
}

type TestMenuProps = {
  rootProps?: Menu.Root.Props;
  portalProps?: Menu.Portal.Props;
  popupProps?: Menu.Popup.Props;
  triggerProps?: Menu.Trigger.Props;
  submenuProps?: Menu.SubmenuRoot.Props;
  submenuTriggerProps?: Menu.SubmenuTrigger.Props;
  children?: React.ReactNode;
};

function TestMenuContents(props: TestMenuProps) {
  const { children, rootProps, portalProps, submenuProps, submenuTriggerProps, popupProps } = props;
  return (
    <Menu.Root {...rootProps}>
      {children}
      <Menu.Portal {...portalProps}>
        <Menu.Positioner data-testid="menu-positioner">
          <Menu.Popup data-testid="menu" {...popupProps}>
            {popupProps?.children ?? (
              <React.Fragment>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3" disabled>
                  Item 3
                </Menu.Item>
                <Menu.SubmenuRoot {...submenuProps}>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger" {...submenuTriggerProps}>
                    Item 4
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu">
                        <Menu.Item data-testid="item-4_1">Item 4.1</Menu.Item>
                        <Menu.Item data-testid="item-4_2">Item 4.2</Menu.Item>
                        <Menu.SubmenuRoot {...submenuProps}>
                          <Menu.SubmenuTrigger
                            data-testid="nested-submenu-trigger"
                            {...submenuTriggerProps}
                          >
                            Item 4.3
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup data-testid="nested-submenu">
                                <Menu.Item data-testid="item-4_3_1">Item 4.3.1</Menu.Item>
                                <Menu.Item data-testid="item-4_3_2">Item 4.3.2</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
                <Menu.Item data-testid="item-5">Item 5</Menu.Item>
              </React.Fragment>
            )}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
