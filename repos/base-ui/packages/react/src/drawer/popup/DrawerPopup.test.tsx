import { describe, expect, it, vi } from 'vitest';
import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import { Drawer } from '@base-ui/react/drawer';
import { act, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Drawer.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Popup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>{node}</Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  it('warns in development when not rendered within a viewport', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Popup>Drawer</Drawer.Popup>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Base UI: <Drawer.Popup> expected to be rendered within <Drawer.Viewport>.',
        ),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('defaults initial focus to the popup element', async () => {
    await render(
      <div>
        <input />
        <Drawer.Root modal={false}>
          <Drawer.Trigger>Open</Drawer.Trigger>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="popup">
                <input data-testid="popup-input" />
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>
      </div>,
    );

    await act(async () => {
      screen.getByRole('button', { name: 'Open' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
      expect(screen.getByTestId('popup-input')).not.toHaveFocus();
    });
  });

  it.skipIf(isJSDOM)(
    'includes border size in frontmost height CSS variable for nested drawers',
    async () => {
      await render(
        <Drawer.Root open>
          <Drawer.Portal>
            <Drawer.Viewport>
              <Drawer.Popup data-testid="parent-popup">
                <Drawer.Root open>
                  <Drawer.Portal>
                    <Drawer.Viewport>
                      <Drawer.Popup
                        data-testid="child-popup"
                        style={{
                          height: 100,
                          borderTop: '2px solid transparent',
                          borderBottom: '2px solid transparent',
                        }}
                      >
                        <div style={{ height: 10 }}>Child drawer</div>
                      </Drawer.Popup>
                    </Drawer.Viewport>
                  </Drawer.Portal>
                </Drawer.Root>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const parentPopup = screen.getByTestId('parent-popup');
      const childPopup = screen.getByTestId('child-popup');

      await waitFor(() => {
        expect(childPopup.offsetHeight).toBeGreaterThan(childPopup.scrollHeight);
        expect(parentPopup.style.getPropertyValue('--drawer-frontmost-height')).toBe(
          `${childPopup.offsetHeight}px`,
        );
      });
    },
  );

  it('does not treat dialogs inside nested drawers as nested drawers', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <Dialog.Root modal={false}>
                        <Dialog.Trigger>Open dialog</Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Popup data-testid="dialog-popup">Dialog</Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const observedNestedDrawerCounts = [parentPopup.style.getPropertyValue('--nested-drawers')];

    const observer = new MutationObserver(() => {
      observedNestedDrawerCounts.push(parentPopup.style.getPropertyValue('--nested-drawers'));
    });

    observer.observe(parentPopup, {
      attributeFilter: ['style'],
      attributes: true,
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open dialog' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('dialog-popup')).toBeVisible();
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    observer.disconnect();

    expect(observedNestedDrawerCounts).not.toContain('2');
  });

  it('does not treat alert dialogs inside nested drawers as nested drawers', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open modal={false}>
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <AlertDialog.Root>
                        <AlertDialog.Trigger>Open alert dialog</AlertDialog.Trigger>
                        <AlertDialog.Portal>
                          <AlertDialog.Popup data-testid="alert-dialog-popup">
                            Alert dialog
                            <AlertDialog.Close>Close alert dialog</AlertDialog.Close>
                          </AlertDialog.Popup>
                        </AlertDialog.Portal>
                      </AlertDialog.Root>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');
    const observedNestedDrawerCounts = [parentPopup.style.getPropertyValue('--nested-drawers')];

    const observer = new MutationObserver(() => {
      observedNestedDrawerCounts.push(parentPopup.style.getPropertyValue('--nested-drawers'));
    });

    observer.observe(parentPopup, {
      attributeFilter: ['style'],
      attributes: true,
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open alert dialog' }).click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('alert-dialog-popup')).toBeVisible();
    });
    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(childPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(childPopup).not.toHaveAttribute('data-nested-drawer-open');

    observer.disconnect();

    expect(observedNestedDrawerCounts).not.toContain('2');
  });

  it('clears parent nested drawer state as soon as a nested drawer closes', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root modal={false}>
                <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                <Drawer.Portal keepMounted>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <Drawer.Close>Close nested drawer</Drawer.Close>
                    </Drawer.Popup>
                  </Drawer.Viewport>
                </Drawer.Portal>
              </Drawer.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const parentPopup = screen.getByTestId('parent-popup');
    const childPopup = screen.getByTestId('child-popup');

    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

    await act(async () => {
      screen.getByRole('button', { name: 'Open nested drawer' }).click();
    });

    await waitFor(() => {
      expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
    });
    expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');

    await act(async () => {
      screen.getByRole('button', { name: 'Close nested drawer' }).click();
    });

    expect(childPopup).toBeInTheDocument();
    expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
    expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
  });

  it.skipIf(isJSDOM)(
    'clears parent nested drawer state when a nested drawer starts closing before unmount',
    async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-drawer-exit {
          to {
            opacity: 0;
          }
        }

        .animation-test-child-popup[data-ending-style] {
          animation: test-drawer-exit 100ms;
        }
      `;

      try {
        await render(
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Drawer.Root open modal={false}>
              <Drawer.Portal>
                <Drawer.Viewport>
                  <Drawer.Popup data-testid="parent-popup">
                    <Drawer.Root defaultOpen modal={false}>
                      <Drawer.Portal>
                        <Drawer.Viewport>
                          <Drawer.Popup
                            className="animation-test-child-popup"
                            data-testid="child-popup"
                          >
                            <Drawer.Close>Close nested drawer</Drawer.Close>
                          </Drawer.Popup>
                        </Drawer.Viewport>
                      </Drawer.Portal>
                    </Drawer.Root>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            </Drawer.Root>
          </div>,
        );

        const parentPopup = screen.getByTestId('parent-popup');

        await waitFor(() => {
          expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('1');
        });
        expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');

        await act(async () => {
          screen.getByRole('button', { name: 'Close nested drawer' }).click();
        });

        await waitFor(() => {
          expect(screen.getByTestId('child-popup')).toHaveAttribute('data-ending-style');
        });
        expect(parentPopup.style.getPropertyValue('--nested-drawers')).toBe('0');
        expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');

        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).toBeNull();
        });
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      }
    },
  );

  it.skipIf(isJSDOM)('keeps a fixed height applied while a nested drawer closes', async () => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const style = `
        @keyframes test-drawer-exit {
          to {
            opacity: 0;
          }
        }

        .animation-test-parent-popup {
          height: var(--drawer-height, auto);
          overflow: hidden;
          transition: height 100ms linear;
        }

        .animation-test-parent-popup[data-nested-drawer-open] {
          height: var(--drawer-frontmost-height, var(--drawer-height));
        }

        .animation-test-parent-content {
          display: block;
          height: 160px;
        }

        .animation-test-child-content {
          display: block;
          height: 64px;
        }

        .animation-test-child-popup[data-ending-style] {
          animation: test-drawer-exit 100ms;
        }
      `;

    try {
      await render(
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <Drawer.Root open modal={false}>
            <Drawer.Portal>
              <Drawer.Viewport>
                <Drawer.Popup className="animation-test-parent-popup" data-testid="parent-popup">
                  <div className="animation-test-parent-content" />
                  <Drawer.Root modal={false}>
                    <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                    <Drawer.Portal>
                      <Drawer.Viewport>
                        <Drawer.Popup
                          className="animation-test-child-popup"
                          data-testid="child-popup"
                        >
                          <div className="animation-test-child-content" />
                          <Drawer.Close>Close nested drawer</Drawer.Close>
                        </Drawer.Popup>
                      </Drawer.Viewport>
                    </Drawer.Portal>
                  </Drawer.Root>
                </Drawer.Popup>
              </Drawer.Viewport>
            </Drawer.Portal>
          </Drawer.Root>
        </div>,
      );

      const parentPopup = screen.getByTestId('parent-popup');
      await act(async () => {
        screen.getByRole('button', { name: 'Open nested drawer' }).click();
      });

      await waitFor(() => {
        expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
      });
      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');
      });

      const mutations: Array<{ hasNested: boolean; drawerHeight: string }> = [];
      const observer = new MutationObserver(() => {
        mutations.push({
          hasNested: parentPopup.hasAttribute('data-nested-drawer-open'),
          drawerHeight: parentPopup.style.getPropertyValue('--drawer-height'),
        });
      });

      observer.observe(parentPopup, {
        attributeFilter: ['data-nested-drawer-open', 'style'],
        attributes: true,
      });

      await act(async () => {
        screen.getByRole('button', { name: 'Close nested drawer' }).click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('child-popup')).toHaveAttribute('data-ending-style');
      });
      await waitFor(() => {
        expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
      });
      await waitFor(() => {
        expect(parentPopup.style.getPropertyValue('--drawer-height')).not.toBe('');
      });
      await waitFor(() => {
        expect(
          mutations.some((mutation) => !mutation.hasNested && mutation.drawerHeight !== ''),
        ).toBe(true);
      });

      observer.disconnect();

      await waitFor(() => {
        expect(screen.queryByTestId('child-popup')).toBeNull();
      });
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    }
  });

  it.skipIf(isJSDOM)(
    'restores a fixed height before nested state when reopening a nested drawer',
    async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        .animation-test-parent-popup {
          height: var(--drawer-height, auto);
          overflow: hidden;
          transition: height 100ms linear;
        }

        .animation-test-parent-popup[data-nested-drawer-open] {
          height: var(--drawer-frontmost-height, var(--drawer-height));
        }

        .animation-test-parent-content {
          display: block;
          height: 160px;
        }

        .animation-test-child-content {
          display: block;
          height: 64px;
        }
      `;

      try {
        await render(
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <Drawer.Root open modal={false}>
              <Drawer.Portal>
                <Drawer.Viewport>
                  <Drawer.Popup className="animation-test-parent-popup" data-testid="parent-popup">
                    <div className="animation-test-parent-content" />
                    <Drawer.Root modal={false}>
                      <Drawer.Trigger>Open nested drawer</Drawer.Trigger>
                      <Drawer.Portal>
                        <Drawer.Viewport>
                          <Drawer.Popup data-testid="child-popup">
                            <div className="animation-test-child-content" />
                            <Drawer.Close>Close nested drawer</Drawer.Close>
                          </Drawer.Popup>
                        </Drawer.Viewport>
                      </Drawer.Portal>
                    </Drawer.Root>
                  </Drawer.Popup>
                </Drawer.Viewport>
              </Drawer.Portal>
            </Drawer.Root>
          </div>,
        );

        const parentPopup = screen.getByTestId('parent-popup');
        await act(async () => {
          screen.getByRole('button', { name: 'Open nested drawer' }).click();
        });

        await waitFor(() => {
          expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
        });

        await act(async () => {
          screen.getByRole('button', { name: 'Close nested drawer' }).click();
        });

        await waitFor(() => {
          expect(parentPopup).not.toHaveAttribute('data-nested-drawer-open');
        });
        await waitFor(() => {
          expect(screen.queryByTestId('child-popup')).toBeNull();
        });

        const mutations: Array<{ hasNested: boolean; drawerHeight: string }> = [];
        const observer = new MutationObserver(() => {
          mutations.push({
            hasNested: parentPopup.hasAttribute('data-nested-drawer-open'),
            drawerHeight: parentPopup.style.getPropertyValue('--drawer-height'),
          });
        });

        observer.observe(parentPopup, {
          attributeFilter: ['data-nested-drawer-open', 'style'],
          attributes: true,
        });

        await act(async () => {
          screen.getByRole('button', { name: 'Open nested drawer' }).click();
        });

        await waitFor(() => {
          expect(parentPopup).toHaveAttribute('data-nested-drawer-open', '');
        });
        await waitFor(() => {
          expect(mutations.find((mutation) => mutation.hasNested)?.drawerHeight).not.toBe('');
        });
        observer.disconnect();
      } finally {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
      }
    },
  );
});
