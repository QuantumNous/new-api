import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, ignoreActWarnings, screen, waitFor } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { createRenderer, isJSDOM, wait } from '#test-utils';

describe('<MenuRoot />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the menu with any trigger', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Trigger 1</Menu.Trigger>
          <Menu.Trigger>Trigger 2</Menu.Trigger>
          <Menu.Trigger>Trigger 3</Menu.Trigger>

          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByRole('menu')).toBe(null);

      await user.click(trigger1);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger2);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger3);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const { user } = await render(
        <Menu.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Menu.Trigger payload={1}>Trigger 1</Menu.Trigger>
              <Menu.Trigger payload={2}>Trigger 2</Menu.Trigger>

              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </React.Fragment>
          )}
        </Menu.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(screen.getByTestId('content'));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const { user } = await render(
        <Menu.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Menu.Trigger payload={1}>Trigger 1</Menu.Trigger>
              <Menu.Trigger payload={2}>Trigger 2</Menu.Trigger>

              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup data-testid="popup">
                    <span>{payload}</span>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </React.Fragment>
          )}
        </Menu.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await screen.findByRole('menu');
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await user.click(trigger2);
      await screen.findByRole('menu');

      expect(screen.getByTestId('popup')).toBe(popupElement);
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
    });

    it('should allow controlling the menu state programmatically', async () => {
      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div>
            <Menu.Root
              open={open}
              triggerId={activeTrigger}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
            >
              {({ payload }: NumberPayload) => (
                <React.Fragment>
                  <Menu.Trigger payload={1} id="trigger-1">
                    Trigger 1
                  </Menu.Trigger>
                  <Menu.Trigger payload={2} id="trigger-2">
                    Trigger 2
                  </Menu.Trigger>

                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item data-testid="content">{payload}</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </React.Fragment>
              )}
            </Menu.Root>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('allows setting an initially open menu', async () => {
      await render(
        <Menu.Root defaultOpen defaultTriggerId="trigger-2">
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Menu.Trigger payload={1} id="trigger-1">
                Trigger 1
              </Menu.Trigger>
              <Menu.Trigger payload={2} id="trigger-2">
                Trigger 2
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="popup-content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </React.Fragment>
          )}
        </Menu.Root>,
      );

      expect(screen.getByTestId('popup-content').textContent).toBe('2');
    });

    describe('nested menus', () => {
      it('supports keyboard navigation from any trigger', async () => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Trigger 1</Menu.Trigger>
            <Menu.Trigger>Trigger 2</Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner data-testid="menu">
                <Menu.Popup>
                  <Menu.Item>Standalone</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner data-testid="submenu">
                        <Menu.Popup>
                          <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

        await user.click(trigger1);
        await screen.findByTestId('menu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');

        const submenuItem = await screen.findByTestId('submenu-item');
        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });

        await user.keyboard('[ArrowLeft]');
        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });
        expect(submenuTrigger).toHaveFocus();

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        await user.click(trigger2);
        await screen.findByTestId('menu');
      });

      it('opens a submenu with the mouse when hover is disabled', async () => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Trigger 1</Menu.Trigger>
            <Menu.Trigger>Trigger 2</Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner data-testid="menu">
                <Menu.Popup>
                  <Menu.Item>Standalone</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                      More
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner data-testid="submenu">
                        <Menu.Popup>
                          <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

        await user.click(trigger1);
        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        const submenuItem = await screen.findByTestId('submenu-item');
        expect(submenuItem.textContent).toBe('Nested');

        await user.click(submenuItem);
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        await user.click(trigger2);
        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('closes every level when clicking outside the deepest submenu', async () => {
        const { user } = await render(
          <div>
            <Menu.Root>
              <Menu.Trigger>Trigger 1</Menu.Trigger>
              <Menu.Trigger>Trigger 2</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="level-1">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger-1">
                        Level 2
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="level-2">
                          <Menu.Popup>
                            <Menu.Item>Item 2</Menu.Item>
                            <Menu.SubmenuRoot>
                              <Menu.SubmenuTrigger data-testid="submenu-trigger-2">
                                Level 3
                              </Menu.SubmenuTrigger>
                              <Menu.Portal>
                                <Menu.Positioner data-testid="level-3">
                                  <Menu.Popup>
                                    <Menu.Item>Deep Item</Menu.Item>
                                  </Menu.Popup>
                                </Menu.Positioner>
                              </Menu.Portal>
                            </Menu.SubmenuRoot>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Trigger 1' });
        await user.click(trigger);
        await screen.findByTestId('level-1');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger-1');
        await waitFor(() => {
          expect(submenuTrigger1).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('level-2');

        await user.keyboard('[ArrowDown]');
        const submenuTrigger2 = await screen.findByTestId('submenu-trigger-2');
        await waitFor(() => {
          expect(submenuTrigger2).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('level-3');

        await user.click(screen.getByTestId('outside'));
        await waitFor(() => {
          expect(screen.queryByTestId('level-1')).toBe(null);
          expect(screen.queryByTestId('level-2')).toBe(null);
          expect(screen.queryByTestId('level-3')).toBe(null);
        });
      });

      it('allows selecting nested items via click, drag, release', async () => {
        ignoreActWarnings();
        const clickSpy = vi.fn();
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Trigger 1</Menu.Trigger>
            <Menu.Trigger>Trigger 2</Menu.Trigger>

            <Menu.Portal>
              <Menu.Positioner data-testid="menu">
                <Menu.Popup>
                  <Menu.Item>Item 1</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner data-testid="submenu">
                        <Menu.Popup>
                          <Menu.Item data-testid="submenu-item" onClick={clickSpy}>
                            Nested Action
                          </Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        fireEvent.mouseDown(trigger1);

        await screen.findByTestId('menu');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);
        await screen.findByTestId('submenu');

        // Wait 200ms to enable mouseup on menu items
        await wait(200);

        const submenuItem = await screen.findByTestId('submenu-item');
        fireEvent.mouseUp(submenuItem);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
        expect(clickSpy.mock.calls.length).toBe(1);

        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
        await user.click(trigger2);
        await screen.findByTestId('menu');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('should open the menu with any trigger', async () => {
      const testMenu = Menu.createHandle();
      const { user } = await render(
        <div>
          <Menu.Trigger handle={testMenu}>Trigger 1</Menu.Trigger>
          <Menu.Trigger handle={testMenu}>Trigger 2</Menu.Trigger>
          <Menu.Trigger handle={testMenu}>Trigger 3</Menu.Trigger>

          <Menu.Root handle={testMenu}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Close</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByRole('menu')).toBe(null);

      await user.click(trigger1);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger2);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger3);
      await screen.findByRole('menu');
      await user.click(await screen.findByRole('menuitem', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    it('should set the payload and render content based on its value', async () => {
      const testMenu = Menu.createHandle<number>();
      const { user } = await render(
        <div>
          <Menu.Trigger handle={testMenu} payload={1}>
            Trigger 1
          </Menu.Trigger>
          <Menu.Trigger handle={testMenu} payload={2}>
            Trigger 2
          </Menu.Trigger>

          <Menu.Root handle={testMenu}>
            {({ payload }: NumberPayload) => (
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            )}
          </Menu.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(screen.getByTestId('content'));
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
    });

    it('should reuse the popup and positioner DOM nodes when switching triggers', async () => {
      const testMenu = Menu.createHandle<number>();
      const { user } = await render(
        <React.Fragment>
          <Menu.Trigger handle={testMenu} payload={1}>
            Trigger 1
          </Menu.Trigger>
          <Menu.Trigger handle={testMenu} payload={2}>
            Trigger 2
          </Menu.Trigger>

          <Menu.Root handle={testMenu}>
            {({ payload }: NumberPayload) => (
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup data-testid="popup">
                    <span>{payload}</span>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            )}
          </Menu.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await screen.findByRole('menu');
      const popupElement = screen.getByTestId('popup');
      const positionerElement = screen.getByTestId('positioner');

      await user.click(trigger2);
      await screen.findByRole('menu');

      expect(screen.getByTestId('popup')).toBe(popupElement);
      expect(screen.getByTestId('positioner')).toBe(positionerElement);
    });

    it('should allow controlling the menu state programmatically', async () => {
      const testMenu = Menu.createHandle<number>();

      function Test() {
        const [open, setOpen] = React.useState(false);
        const [activeTrigger, setActiveTrigger] = React.useState<string | null>(null);

        return (
          <div style={{ margin: 50 }}>
            <Menu.Trigger handle={testMenu} payload={1} id="trigger-1">
              Trigger 1
            </Menu.Trigger>
            <Menu.Trigger handle={testMenu} payload={2} id="trigger-2">
              Trigger 2
            </Menu.Trigger>

            <Menu.Root
              open={open}
              onOpenChange={(nextOpen, details) => {
                setActiveTrigger(details.trigger?.id ?? null);
                setOpen(nextOpen);
              }}
              triggerId={activeTrigger}
              handle={testMenu}
            >
              {({ payload }: NumberPayload) => (
                <Menu.Portal>
                  <Menu.Positioner data-testid="positioner" side="bottom" align="start">
                    <Menu.Popup>
                      <Menu.Item data-testid="content">{payload}</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              )}
            </Menu.Root>

            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-1');
              }}
            >
              Open Trigger 1
            </button>
            <button
              onClick={() => {
                setOpen(true);
                setActiveTrigger('trigger-2');
              }}
            >
              Open Trigger 2
            </button>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await waitFor(() => {
        const positionerLeft = screen.getByTestId('positioner').getBoundingClientRect().left;
        expect(
          Math.abs(positionerLeft - trigger1.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });

      await user.click(screen.getByRole('button', { name: 'Open Trigger 2' }));
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });
      await waitFor(() => {
        const positionerLeft = screen.getByTestId('positioner').getBoundingClientRect().left;
        expect(
          Math.abs(positionerLeft - trigger2.getBoundingClientRect().left),
        ).toBeLessThanOrEqual(1);
      });

      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('content')).toBe(null);
      });
    });

    it('allows setting an initially open menu', async () => {
      const testMenu = Menu.createHandle<number>();
      await render(
        <Menu.Root handle={testMenu} defaultOpen defaultTriggerId="trigger-2">
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <Menu.Trigger handle={testMenu} payload={1} id="trigger-1">
                Trigger 1
              </Menu.Trigger>
              <Menu.Trigger handle={testMenu} payload={2} id="trigger-2">
                Trigger 2
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="popup-content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </React.Fragment>
          )}
        </Menu.Root>,
      );

      expect(screen.getByTestId('popup-content').textContent).toBe('2');
    });

    it('should not have inline scale style after switching triggers', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const testMenu = Menu.createHandle<number>();

      function Test() {
        return (
          <React.Fragment>
            <Menu.Trigger handle={testMenu} payload={1}>
              Trigger 1
            </Menu.Trigger>
            <Menu.Trigger handle={testMenu} payload={2}>
              Trigger 2
            </Menu.Trigger>

            <Menu.Root handle={testMenu}>
              {({ payload }: NumberPayload) => (
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="popup">
                      <Menu.Viewport>
                        <Menu.Item data-testid="content">{payload}</Menu.Item>
                      </Menu.Viewport>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              )}
            </Menu.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<Test />);

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('2');
      });

      const popup = screen.getByTestId('popup');
      expect(popup.style.scale).toBe('');
    });

    describe('nested menus', () => {
      it('supports keyboard navigation regardless of which trigger opened the menu', async () => {
        const testMenu = Menu.createHandle();
        const { user } = await render(
          <div>
            <Menu.Trigger handle={testMenu}>Trigger 1</Menu.Trigger>
            <Menu.Trigger handle={testMenu}>Trigger 2</Menu.Trigger>

            <Menu.Root handle={testMenu}>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

        await user.click(trigger1);
        await screen.findByTestId('menu');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger).toHaveFocus();
        });

        await user.keyboard('[ArrowRight]');
        const submenuItem = await screen.findByTestId('submenu-item');
        await waitFor(() => expect(submenuItem).toHaveFocus());

        await user.keyboard('[ArrowLeft]');
        await waitFor(() => {
          expect(screen.queryByTestId('submenu')).toBe(null);
        });
        expect(submenuTrigger).toHaveFocus();

        await user.keyboard('[Escape]');
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        await user.click(trigger2);
        await screen.findByTestId('menu');
      });

      it('opens submenus on click when hover is disabled', async () => {
        const testMenu = Menu.createHandle();
        const { user } = await render(
          <div>
            <Menu.Trigger handle={testMenu}>Trigger 1</Menu.Trigger>
            <Menu.Trigger handle={testMenu}>Trigger 2</Menu.Trigger>

            <Menu.Root handle={testMenu}>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Standalone</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                        More
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item">Nested</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

        await user.click(trigger1);
        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        const submenuItem = await screen.findByTestId('submenu-item');
        expect(submenuItem.textContent).toBe('Nested');

        await user.click(submenuItem);
        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        await user.click(trigger2);
        await screen.findByTestId('menu');
        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('closes the nested tree on outside click', async () => {
        const testMenu = Menu.createHandle();
        const { user } = await render(
          <div>
            <Menu.Trigger handle={testMenu}>Trigger 1</Menu.Trigger>
            <Menu.Trigger handle={testMenu}>Trigger 2</Menu.Trigger>

            <Menu.Root handle={testMenu}>
              <Menu.Portal>
                <Menu.Positioner data-testid="level-1">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger-1">
                        Level 2
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="level-2">
                          <Menu.Popup>
                            <Menu.Item>Item 2</Menu.Item>
                            <Menu.SubmenuRoot>
                              <Menu.SubmenuTrigger data-testid="submenu-trigger-2">
                                Level 3
                              </Menu.SubmenuTrigger>
                              <Menu.Portal>
                                <Menu.Positioner data-testid="level-3">
                                  <Menu.Popup>
                                    <Menu.Item>Deep Item</Menu.Item>
                                  </Menu.Popup>
                                </Menu.Positioner>
                              </Menu.Portal>
                            </Menu.SubmenuRoot>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Trigger 1' });
        await user.click(trigger);
        await screen.findByTestId('level-1');

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger-1');
        await waitFor(() => expect(submenuTrigger1).toHaveFocus());

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('level-2');

        await user.keyboard('[ArrowDown]');
        const submenuTrigger2 = await screen.findByTestId('submenu-trigger-2');
        await waitFor(() => expect(submenuTrigger2).toHaveFocus());

        await user.keyboard('[ArrowRight]');
        await screen.findByTestId('level-3');

        await user.click(screen.getByTestId('outside'));
        await waitFor(() => {
          expect(screen.queryByTestId('level-1')).toBe(null);
          expect(screen.queryByTestId('level-2')).toBe(null);
          expect(screen.queryByTestId('level-3')).toBe(null);
        });
      });

      it('selects nested items with click, drag, release', async () => {
        ignoreActWarnings();
        const testMenu = Menu.createHandle();
        const clickSpy = vi.fn();
        const { user } = await render(
          <div>
            <Menu.Trigger handle={testMenu}>Trigger 1</Menu.Trigger>
            <Menu.Trigger handle={testMenu}>Trigger 2</Menu.Trigger>

            <Menu.Root handle={testMenu}>
              <Menu.Portal>
                <Menu.Positioner data-testid="menu">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner data-testid="submenu">
                          <Menu.Popup>
                            <Menu.Item data-testid="submenu-item" onClick={clickSpy}>
                              Nested Action
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>,
        );

        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        fireEvent.mouseDown(trigger1);
        await screen.findByTestId('menu');

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.hover(submenuTrigger);
        await screen.findByTestId('submenu');

        // Wait 200ms to enable mouseup on menu items
        await wait(200);

        const submenuItem = await screen.findByTestId('submenu-item');
        fireEvent.mouseUp(submenuItem);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });
        expect(clickSpy.mock.calls.length).toBe(1);

        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
        await user.click(trigger2);
        await screen.findByTestId('menu');
      });
    });
  });

  describe.skipIf(isJSDOM)('imperative actions on the handle', () => {
    type NumberPayload = { payload: number | undefined };

    it('opens and closes the menu', async () => {
      const menuHandle = Menu.createHandle();
      await render(
        <div>
          <Menu.Trigger handle={menuHandle} id="trigger">
            Trigger
          </Menu.Trigger>
          <Menu.Root handle={menuHandle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="content">
                  <Menu.Item>Content</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByRole('menu')).toBe(null);

      await act(async () => {
        menuHandle.open('trigger');
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('Content');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await act(async () => {
        menuHandle.close();
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets the payload associated with the trigger', async () => {
      const menuHandle = Menu.createHandle<number>();
      await render(
        <div>
          <Menu.Trigger handle={menuHandle} id="trigger1" payload={1}>
            Trigger 1
          </Menu.Trigger>
          <Menu.Trigger handle={menuHandle} id="trigger2" payload={2}>
            Trigger 2
          </Menu.Trigger>
          <Menu.Root handle={menuHandle}>
            {({ payload }: NumberPayload) => (
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item data-testid="content">{payload}</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            )}
          </Menu.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByRole('menu')).toBe(null);

      await act(async () => {
        menuHandle.open('trigger2');
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('2');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(trigger1).not.toHaveAttribute('aria-expanded', 'true');

      await act(async () => {
        menuHandle.close();
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
