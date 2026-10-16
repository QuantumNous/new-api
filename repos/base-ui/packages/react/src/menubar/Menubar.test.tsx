import { afterEach, expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM, wait } from '#test-utils';
import { Menubar } from '@base-ui/react/menubar';
import { Menu } from '@base-ui/react/menu';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';

describe('<Menubar />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Menubar />, () => ({
    render: (node) => {
      return render(<Menubar>{node}</Menubar>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  // All these tests run for contained, detached and multiple contained triggers.
  // The rendered menubar has the same structure in most cases.
  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenubar },
    { name: 'detached triggers', Component: DetachedTriggerMenubar },
    { name: 'multiple contained triggers', Component: MultipleContainedTriggersMenubar },
  ])('when using $name', ({ Component: TestMenubar }) => {
    describe.skipIf(isJSDOM)('click interactions', () => {
      afterEach(async () => {
        const { cleanup } = await import('vitest-browser-react');
        await cleanup();
      });

      it('should open the menu after clicking on its trigger and close it when clicking again', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await user.click(fileTrigger, { delay: 30 });
        await screen.findByTestId('file-menu');

        // Click again to close the menu
        await user.click(fileTrigger, { delay: 30 });
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('hover behavior', async () => {
      afterEach(async () => {
        const { cleanup } = await import('vitest-browser-react');
        await cleanup();
      });

      it('should not open submenus on hover when no submenu is already open', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');

        await user.hover(fileTrigger);

        // The file menu should not be open because no submenu is already open
        expect(screen.queryByTestId('file-menu')).toBe(null);
      });

      it('should open submenus on hover when another submenu is already open', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await screen.findByTestId('file-menu');
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        // Now hover over the edit trigger, it should open because a submenu is already open
        const editTrigger = screen.queryByTestId('edit-trigger');
        expect(editTrigger).not.toBe(null);

        await user.hover(editTrigger!);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });

        // The file menu should now be closed
        expect(screen.queryByTestId('file-menu')).toBe(null);

        // Continue hovering to the view trigger
        const viewTrigger = screen.getByTestId('view-trigger');
        await user.hover(viewTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('view-menu')).not.toBe(null);
        });

        // The edit menu should now be closed
        expect(screen.queryByTestId('edit-menu')).toBe(null);
      });

      it('should open nested submenus on hover when parent menu is open', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await wait(50);

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await user.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });
      });

      it('should open another menu on hover when a nested submenu is open', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        // First click to open the file menu
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        // Now hover over the share submenu trigger
        const shareTrigger = await screen.findByTestId('share-trigger');
        await user.hover(shareTrigger);

        // The share submenu should open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });

        // Hover over the first item in the share submenu
        await user.hover(screen.getByTestId('share-item-1'));

        // Now hover over the edit menubar trigger
        const editTrigger = screen.getByTestId('edit-trigger');
        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });

        expect(screen.queryByTestId('file-menu')).toBe(null);
        expect(screen.queryByTestId('share-menu')).toBe(null);
      });
    });

    describe('focus behavior', () => {
      it('focuses a menubar item without immediately opening the menu', async () => {
        const { user } = await render(<TestMenubar />);

        await user.tab();

        await waitFor(() => {
          const fileTrigger = screen.getByTestId('file-trigger');
          expect(fileTrigger).toHaveFocus();
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });

        await wait(50);

        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('closeOnClick on nested items behavior', () => {
      afterEach(async () => {
        const { cleanup } = await import('vitest-browser-react');
        await cleanup();
      });

      it('should respect closeOnClick on nested items when the menu was opened on click', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        const viewTrigger = screen.getByTestId('view-trigger');

        await user.click(viewTrigger, { delay: 30 });
        await screen.findByTestId('view-menu');

        const layoutTrigger = screen.getByTestId('layout-trigger');
        await user.hover(layoutTrigger);

        await screen.findByTestId('layout-menu');

        const layoutItem2 = screen.getByTestId('layout-item-2');
        await user.click(layoutItem2, { delay: 30 });

        // The layout menu should not close after clicking an item
        await waitFor(() => {
          expect(screen.queryByTestId('layout-menu')).not.toBe(null);
        });
      });

      // https://github.com/mui/base-ui/issues/2092
      it('should respect closeOnClick on nested items when the menu was opened on hover', async () => {
        const { userEvent: user } = await import('vitest/browser');
        const { render: vbrRender } = await import('vitest-browser-react');

        await vbrRender(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const viewTrigger = screen.getByTestId('view-trigger');

        await user.click(fileTrigger, { delay: 30 });
        await screen.findByTestId('file-menu');

        await user.hover(viewTrigger);
        await screen.findByTestId('view-menu');

        const layoutTrigger = screen.getByTestId('layout-trigger');
        await user.hover(layoutTrigger);

        await screen.findByTestId('layout-menu');

        const layoutItem2 = screen.getByTestId('layout-item-2');
        await user.click(layoutItem2, { delay: 30 });

        // The layout menu should not close after clicking an item
        await waitFor(() => {
          expect(screen.queryByTestId('layout-menu')).not.toBe(null);
        });
      });
    });

    describe('keyboard interactions', () => {
      it('should navigate between menubar items with arrow keys', async () => {
        const { user } = await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');

        // First focus the file trigger
        await act(async () => {
          fileTrigger.focus();
        });

        // Check that file trigger has focus
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });

        // Use arrow right to navigate to edit trigger
        await user.keyboard('{ArrowRight}');

        // Wait for the edit trigger to get focus
        await waitFor(() => {
          expect(editTrigger).toHaveFocus();
        });
      });

      it('moves focus to the first and last triggers with Home and End', async () => {
        const { user } = await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const viewTrigger = screen.getByTestId('view-trigger');

        await act(async () => {
          fileTrigger.focus();
        });

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(viewTrigger).toHaveFocus();
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(fileTrigger).toHaveFocus();
        });
      });

      it('should open the menu with Space key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus the file trigger
        await act(async () => {
          fileTrigger.focus();
        });

        // Press Space key to open menu
        await user.keyboard(' ');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
      });

      it('should navigate within the menu using arrow keys', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        await act(async () => {
          fileTrigger.focus();
        });
        await user.keyboard('{Enter}');

        // File menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // First item should be focused automatically
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Navigate down to second item
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });

        // Navigate down to submenu trigger
        await user.keyboard('{ArrowDown}');
        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });
      });

      it('should open the submenu with right arrow key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        await act(async () => {
          fileTrigger.focus();
        });
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('share-trigger')).toHaveFocus();
        });

        // Arrow right should open submenu
        await user.keyboard('{ArrowRight}');

        // Share submenu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });

        // First submenu item should be focused
        const submenuItem = screen.getByTestId('share-item-1');
        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });
      });

      it.skipIf(isJSDOM)('should close the menu with Escape key', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        await act(async () => {
          fileTrigger.focus();
        });

        await user.keyboard('{Enter}');

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Press Escape to close
        await user.keyboard('{Escape}');

        // Menu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
      });

      it('should close submenu with left arrow key and return focus to submenu trigger', async () => {
        const { user } = await render(<TestMenubar />);
        const fileTrigger = screen.getByTestId('file-trigger');

        // Focus and open file menu
        await act(async () => {
          fileTrigger.focus();
        });
        await user.keyboard('{Enter}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-1')).toHaveFocus();
        });

        // Navigate to submenu trigger
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(screen.getByTestId('file-item-2')).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');

        const shareTrigger = screen.getByTestId('share-trigger');
        await waitFor(() => {
          expect(shareTrigger).toHaveFocus();
        });

        // Open submenu
        await user.keyboard('{ArrowRight}');
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).not.toBe(null);
        });

        // Close submenu with left arrow
        await user.keyboard('{ArrowLeft}');

        // Submenu should be closed
        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).toBe(null);
        });

        // Focus should return to submenu trigger
        expect(shareTrigger).toHaveFocus();
      });

      it.skipIf(!isJSDOM)(
        'closes open submenus when navigating to the next menubar item with ArrowRight',
        async () => {
          const rootOnOpenChange = vi.fn();
          const submenuOnOpenChange = vi.fn();
          const nextOnOpenChange = vi.fn();

          function SpyMenubar() {
            return (
              <Menubar>
                <Menu.Root onOpenChange={rootOnOpenChange}>
                  <Menu.Trigger data-testid="menubar-file-trigger">File</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="menubar-file-menu">
                      <Menu.Popup>
                        <Menu.Item data-testid="menubar-file-item">Item 1</Menu.Item>
                        <Menu.SubmenuRoot onOpenChange={submenuOnOpenChange}>
                          <Menu.SubmenuTrigger data-testid="menubar-submenu-trigger">
                            Share
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner data-testid="menubar-submenu-menu">
                              <Menu.Popup>
                                <Menu.Item data-testid="menubar-submenu-item">Email</Menu.Item>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                <Menu.Root onOpenChange={nextOnOpenChange}>
                  <Menu.Trigger data-testid="menubar-next-trigger">Edit</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="menubar-next-menu">
                      <Menu.Popup>
                        <Menu.Item>Edit Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </Menubar>
            );
          }

          const { user } = await render(<SpyMenubar />);
          const fileTrigger = screen.getByTestId('menubar-file-trigger');

          await act(async () => {
            fileTrigger.focus();
          });
          await user.keyboard('{Enter}');
          await screen.findByTestId('menubar-file-menu');

          await waitFor(() => {
            expect(screen.getByTestId('menubar-file-item')).toHaveFocus();
          });

          await user.keyboard('{ArrowDown}');
          const submenuTrigger = screen.getByTestId('menubar-submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');
          await screen.findByTestId('menubar-submenu-menu');

          await waitFor(() => {
            expect(screen.getByTestId('menubar-submenu-item')).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');

          await screen.findByTestId('menubar-next-menu');

          await waitFor(() => {
            expect(screen.queryByTestId('menubar-submenu-menu')).toBe(null);
          });

          await waitFor(() => {
            expect(screen.queryByTestId('menubar-file-menu')).toBe(null);
          });

          expect(submenuOnOpenChange.mock.lastCall?.[0]).toBe(false);
          expect(rootOnOpenChange.mock.lastCall?.[0]).toBe(false);
          expect(nextOnOpenChange.mock.lastCall?.[0]).toBe(true);
        },
      );

      // Doesn't work in headless mode.
      it.skipIf(!isJSDOM)(
        'should navigate between menus using left/right arrow keys when menus are open',
        async () => {
          const { user } = await render(<TestMenubar />);
          const fileTrigger = screen.getByTestId('file-trigger');

          // Focus and open file menu
          await act(async () => {
            fileTrigger.focus();
          });
          await user.keyboard('{Enter}');

          // File menu should be open
          await waitFor(() => {
            expect(screen.queryByTestId('file-menu')).not.toBe(null);
          });

          // Navigate right to edit menu
          await user.keyboard('{ArrowRight}');

          // File menu should close, edit menu should open
          await waitFor(() => {
            expect(screen.queryByTestId('file-menu')).toBe(null);
          });
          await waitFor(() => {
            expect(screen.queryByTestId('edit-menu')).not.toBe(null);
          });
        },
      );
    });

    describe.skipIf(!isJSDOM)('mixed mouse and keyboard interactions', () => {
      it('should allow keyboard navigation after opening a menu with mouse click', async () => {
        const { user } = await render(<TestMenubar />);

        // Open the menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        // Menu should be open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Navigate with keyboard
        await user.keyboard('{ArrowDown}');
        const firstItem = screen.getByTestId('file-item-1');
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        // Continue navigation
        await user.keyboard('{ArrowDown}');
        const secondItem = screen.getByTestId('file-item-2');
        await waitFor(() => {
          expect(secondItem).toHaveFocus();
        });
      });

      it('should allow clicking a menu trigger then navigating to another menu with keyboard', async () => {
        const { user } = await render(<TestMenubar />);

        // Open the file menu with a mouse click
        const fileTrigger = screen.getByTestId('file-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });

        // Navigate to edit menu with keyboard
        await user.keyboard('{ArrowRight}');

        // File menu should close, edit menu should open
        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });
      });
    });

    describe.skipIf(!isJSDOM)('touch interactions', () => {
      it('closes the entire tree on a single outside press after opening a submenu', async () => {
        await render(
          <div>
            <TestMenubar />
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const fileTrigger = screen.getByTestId('file-trigger');

        fireEvent.pointerDown(fileTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(fileTrigger);

        await screen.findByTestId('file-menu');

        const shareTrigger = await screen.findByTestId('share-trigger');
        fireEvent.pointerDown(shareTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(shareTrigger);

        await screen.findByTestId('share-menu');

        const outside = screen.getByTestId('outside');
        fireEvent.pointerDown(outside, { pointerType: 'touch' });
        fireEvent.mouseDown(outside);

        await waitFor(() => {
          expect(screen.queryByTestId('share-menu')).toBe(null);
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      it('applies scroll lock when a touch-opened submenu covers the viewport width', async () => {
        await render(
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );

        const trigger = screen.getByTestId('file-trigger');

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

      it('does not apply scroll lock when a touch-opened submenu is narrower than the viewport', async () => {
        await render(
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );

        const trigger = screen.getByTestId('file-trigger');

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

      it('updates scroll lock when handing off between top-level touch-opened menus', async () => {
        await render(
          <Menubar modal style={{ display: 'flex' }}>
            <Menu.Root>
              <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="file-menu" style={{ width: 'calc(100vw - 10px)' }}>
                  <Menu.Popup>
                    <Menu.Item>Open</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Root>
              <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="edit-menu" style={{ width: '240px' }}>
                  <Menu.Popup>
                    <Menu.Item>Copy</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');
        const doc = fileTrigger.ownerDocument;

        fireEvent.pointerDown(fileTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(fileTrigger);

        await screen.findByTestId('file-menu');

        await waitFor(() => {
          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(true);
        });

        fireEvent.pointerDown(editTrigger, { pointerType: 'touch' });
        fireEvent.mouseDown(editTrigger);

        await screen.findByTestId('edit-menu');

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).toBe(null);
        });

        await waitFor(() => {
          const isScrollLocked =
            doc.documentElement.style.overflow === 'hidden' ||
            doc.documentElement.hasAttribute('data-base-ui-scroll-locked') ||
            doc.body.style.overflow === 'hidden';

          expect(isScrollLocked).toBe(false);
        });
      });
    });

    describe.skipIf(!isJSDOM)('prop: loopFocus', () => {
      describe('when loopFocus == true', () => {
        it('should loop around to the first item after the last one', async () => {
          const { user } = await render(<TestMenubar loopFocus />);

          const firstItem = screen.getByTestId('file-trigger');
          await act(async () => {
            firstItem.focus();
          });

          await user.keyboard('{ArrowRight}');
          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          expect(lastItem).toHaveFocus();

          await user.keyboard('{ArrowRight}');
          expect(firstItem).toHaveFocus();
        });

        it('should loop around to the last item after the first one', async () => {
          const { user } = await render(<TestMenubar loopFocus />);

          const fileTrigger = screen.getByTestId('file-trigger');
          await act(async () => {
            fileTrigger.focus();
          });

          await waitFor(() => {
            expect(fileTrigger).toHaveFocus();
          });

          await user.keyboard('{ArrowLeft}');
          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });
      });

      describe('when loopFocus == false', () => {
        it('should stay on the last item when navigating beyond it', async () => {
          const { user } = await render(<TestMenubar loopFocus={false} />);

          const fileTrigger = screen.getByTestId('file-trigger');
          await act(async () => {
            fileTrigger.focus();
          });

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(screen.queryByTestId('edit-trigger')).not.toBe(null);
          });

          await user.keyboard('{ArrowRight}');

          const lastItem = screen.getByTestId('view-trigger');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });

          await user.keyboard('{ArrowRight}');
          await waitFor(() => {
            expect(lastItem).toHaveFocus();
          });
        });

        it('should stay on the first item when navigating before it', async () => {
          const { user } = await render(<TestMenubar loopFocus={false} />);

          const firstItem = screen.getByTestId('file-trigger');
          await act(async () => {
            firstItem.focus();
          });

          await user.keyboard('{ArrowLeft}');
          expect(firstItem).toHaveFocus();
        });
      });
    });

    describe('prop: disabled', () => {
      it('disables child menus when menubar is disabled', async () => {
        const { user } = await render(<TestMenubar disabled />);

        const fileTrigger = screen.getByTestId('file-trigger');

        // Trigger should be disabled
        expect(fileTrigger).toHaveAttribute('disabled');

        // It should not be reachable via Tab
        await user.tab();
        expect(fileTrigger).not.toHaveFocus();
        expect(document.body).toHaveFocus();

        // Clicking should not open the menu
        await user.click(fileTrigger);
        expect(screen.queryByTestId('file-menu')).toBe(null);
      });
    });

    it.skipIf(isJSDOM)(
      'correctly opens new menu on hover after clicking on its trigger and entering from hover (#2222)',
      async () => {
        const { user } = await render(<TestMenubar />);

        const fileTrigger = screen.getByTestId('file-trigger');
        const editTrigger = screen.getByTestId('edit-trigger');
        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });

        await user.click(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).not.toHaveAttribute('data-has-submenu-open');
        });

        await user.click(fileTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('file-menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByRole('menubar')).toHaveAttribute('data-has-submenu-open');
        });

        await user.hover(editTrigger);

        await waitFor(() => {
          expect(screen.queryByTestId('edit-menu')).not.toBe(null);
        });
      },
    );

    describe('role', () => {
      it('sets role="menubar" on the root element', async () => {
        await render(<TestMenubar />);
        expect(screen.queryByRole('menubar')).not.toBe(null);
      });

      it('sets aria-orientation on the root element', async () => {
        await render(<Menubar orientation="vertical" />);
        expect(screen.getByRole('menubar')).toHaveAttribute('aria-orientation', 'vertical');
      });

      it('sets role="menuitem" on menu triggers', async () => {
        await render(<TestMenubar />);
        const menuItems = screen.getAllByRole('menuitem');
        expect(menuItems).toHaveLength(3);
      });
    });
  });

  describe('disabled state', () => {
    it('keeps the menubar reachable when the first trigger is disabled', async () => {
      const { user } = await render(
        <Menubar style={{ display: 'flex' }}>
          <Menu.Root>
            <Menu.Trigger disabled data-testid="file-trigger">
              File
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Open</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Copy</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      const fileTrigger = screen.getByTestId('file-trigger');
      const editTrigger = screen.getByTestId('edit-trigger');

      expect(fileTrigger).toHaveAttribute('disabled');
      expect(fileTrigger).toHaveAttribute('tabindex', '-1');
      expect(editTrigger).toHaveAttribute('tabindex', '0');

      // The disabled first trigger must not swallow the only tab stop.
      await user.tab();
      expect(editTrigger).toHaveFocus();
    });

    it('disables menu items while the menubar is disabled', async () => {
      const handleClick = vi.fn();
      const { user } = await render(
        <Menubar disabled>
          <Menu.Root open>
            <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item data-testid="file-item" onClick={handleClick}>
                    Open
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      const item = screen.getByTestId('file-item');
      expect(item).toHaveAttribute('aria-disabled', 'true');

      await user.click(item);
      expect(handleClick).not.toHaveBeenCalled();
    });
  });
});

function ContainedTriggerMenubar(props: Menubar.Props) {
  return (
    <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
      <Menu.Root>
        <Menu.Trigger data-testid="file-trigger">File</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="file-menu">
            <Menu.Popup>
              <Menu.Item data-testid="file-item-1">Open</Menu.Item>
              <Menu.Item data-testid="file-item-2">Save</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="share-trigger">Share</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="share-menu">
                    <Menu.Popup>
                      <Menu.Item data-testid="share-item-1">Email</Menu.Item>
                      <Menu.Item data-testid="share-item-2">Print</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="edit-trigger">Edit</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="edit-menu">
            <Menu.Popup>
              <Menu.Item data-testid="edit-item-1">Copy</Menu.Item>
              <Menu.Item data-testid="edit-item-2">Paste</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      <Menu.Root>
        <Menu.Trigger data-testid="view-trigger">View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="view-menu">
            <Menu.Popup>
              <Menu.Item data-testid="view-item-1">Zoom In</Menu.Item>
              <Menu.Item data-testid="view-item-2">Zoom Out</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="layout-trigger">Layout</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner data-testid="layout-menu">
                    <Menu.Popup>
                      <Menu.RadioGroup defaultValue="single">
                        <Menu.RadioItem value="single" data-testid="layout-item-1">
                          Single column
                        </Menu.RadioItem>
                        <Menu.RadioItem value="two" data-testid="layout-item-2">
                          Two columns
                        </Menu.RadioItem>
                      </Menu.RadioGroup>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menubar>
  );
}

function DynamicMenu(props: { handle?: Menu.Handle<MenuDefinition>; children?: React.ReactNode }) {
  const { handle, children } = props;

  return (
    <Menu.Root handle={handle}>
      {({ payload: menu }) => {
        return (
          <React.Fragment>
            {children}
            <Menu.Portal>
              <Menu.Positioner data-testid={menu?.menuTestId}>
                <Menu.Popup>
                  {(menu?.items ?? []).map((item, index) =>
                    renderMenuContentItem(item, `item-${index}`),
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </React.Fragment>
        );
      }}
    </Menu.Root>
  );
}

function renderMenuContentItem(item: ContentItem, key: string) {
  switch (item.type) {
    case 'item':
      return (
        <Menu.Item
          disabled={item.disabled}
          closeOnClick={item.closeOnClick}
          onClick={item.onClick}
          data-testid={item.testId}
          key={key}
        >
          {item.label}
        </Menu.Item>
      );

    case 'submenu':
      return (
        <Menu.SubmenuRoot key={key}>
          <Menu.SubmenuTrigger data-testid={item.testId}>{item.label}</Menu.SubmenuTrigger>
          <Menu.Portal>
            <Menu.Positioner data-testid={item.menuTestId}>
              <Menu.Popup>
                {item.items.map((subItem, subIndex) =>
                  renderMenuContentItem(subItem, `${key}.${subIndex}`),
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.SubmenuRoot>
      );
    case 'radioGroup':
      return (
        <Menu.RadioGroup defaultValue={item.defaultValue} key={key}>
          {item.items.map((radioItem, radioIndex) =>
            renderMenuContentItem(radioItem, `${key}.${radioIndex}`),
          )}
        </Menu.RadioGroup>
      );
    case 'radioItem':
      return (
        <Menu.RadioItem
          value={item.value}
          data-testid={item.testId}
          disabled={item.disabled}
          key={key}
        >
          {item.label}
        </Menu.RadioItem>
      );
    default:
      return null;
  }
}

type RadioItem = {
  type: 'radioItem';
  label: string;
  value: string;
  testId?: string;
  disabled?: boolean;
};

type ContentItem =
  | {
      type: 'item';
      label: string;
      testId?: string;
      disabled?: boolean;
      closeOnClick?: boolean;
      onClick?: () => void;
    }
  | {
      type: 'submenu';
      label: string;
      testId?: string;
      disabled?: boolean;
      menuTestId?: string;
      items: ContentItem[];
    }
  | {
      type: 'radioGroup';
      defaultValue?: string;
      items: RadioItem[];
    }
  | RadioItem;

type MenuDefinition = {
  label: string;
  triggerTestId?: string;
  menuTestId?: string;
  items: ContentItem[];
};

const menuContents: Record<string, MenuDefinition> = {
  file: {
    label: 'File',
    triggerTestId: 'file-trigger',
    menuTestId: 'file-menu',
    items: [
      { type: 'item', label: 'Open', testId: 'file-item-1' },
      { type: 'item', label: 'Save', testId: 'file-item-2' },
      {
        type: 'submenu',
        label: 'Share',
        testId: 'share-trigger',
        menuTestId: 'share-menu',
        items: [
          { type: 'item', label: 'Email', testId: 'share-item-1' },
          { type: 'item', label: 'Print', testId: 'share-item-2' },
        ],
      },
    ],
  },
  edit: {
    label: 'Edit',
    triggerTestId: 'edit-trigger',
    menuTestId: 'edit-menu',
    items: [
      { type: 'item', label: 'Copy', testId: 'edit-item-1' },
      { type: 'item', label: 'Paste', testId: 'edit-item-2' },
    ],
  },
  view: {
    label: 'View',
    triggerTestId: 'view-trigger',
    menuTestId: 'view-menu',
    items: [
      { type: 'item', label: 'Zoom In', testId: 'view-item-1' },
      { type: 'item', label: 'Zoom Out', testId: 'view-item-2' },
      {
        type: 'submenu',
        label: 'Layout',
        testId: 'layout-trigger',
        menuTestId: 'layout-menu',
        items: [
          {
            type: 'radioGroup',
            defaultValue: 'single',
            items: [
              {
                type: 'radioItem',
                value: 'single',
                label: 'Single column',
                testId: 'layout-item-1',
              },
              {
                type: 'radioItem',
                value: 'two',
                label: 'Two columns',
                testId: 'layout-item-2',
              },
            ],
          },
        ],
      },
    ],
  },
};

function DetachedTriggerMenubar(props: Menubar.Props) {
  const testMenuHandle = useRefWithInit(() => new Menu.Handle<MenuDefinition>()).current;

  return (
    <React.Fragment>
      <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
        {Object.entries(menuContents).map(([key, menuDef]) => (
          <Menu.Trigger
            handle={testMenuHandle}
            payload={menuDef}
            key={key}
            data-testid={menuDef.triggerTestId}
          >
            {menuDef.label}
          </Menu.Trigger>
        ))}
      </Menubar>
      <DynamicMenu handle={testMenuHandle} />
    </React.Fragment>
  );
}

function MultipleContainedTriggersMenubar(props: Menubar.Props) {
  return (
    <Menubar {...props} style={{ maxWidth: '25vw', display: 'flex' }}>
      <DynamicMenu>
        {Object.entries(menuContents).map(([key, menuDef]) => (
          <Menu.Trigger payload={menuDef} key={key} data-testid={menuDef.triggerTestId}>
            {menuDef.label}
          </Menu.Trigger>
        ))}
      </DynamicMenu>
    </Menubar>
  );
}
