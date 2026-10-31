import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor, flushMicrotasks } from '@mui/internal-test-utils';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog } from '@base-ui/react/dialog';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';
import { Menu } from '@base-ui/react/menu';
import { Select } from '@base-ui/react/select';
import { NumberField } from '@base-ui/react/number-field';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { useRefWithInit } from '@base-ui/utils/useRefWithInit';
import { REASONS } from '../../internals/reasons';
import { useDialogRootContext } from './DialogRootContext';

describe('<Dialog.Root />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Dialog.Root {...props.root}>
        <Dialog.Trigger {...props.trigger}>Open dialog</Dialog.Trigger>
        <Dialog.Portal {...props.portal}>
          <Dialog.Popup {...props.popup}>Dialog</Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  it('keeps trigger ownership when another trigger mounts while open', async () => {
    function Test() {
      const [showSecondTrigger, setShowSecondTrigger] = React.useState(false);

      return (
        <Dialog.Root modal={false}>
          <Dialog.Trigger id="trigger-1">Trigger 1</Dialog.Trigger>
          {showSecondTrigger && <Dialog.Trigger id="trigger-2">Trigger 2</Dialog.Trigger>}
          <Dialog.Portal>
            <Dialog.Popup>
              <button onClick={() => setShowSecondTrigger(true)}>Mount trigger 2</button>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    const { user } = await render(<Test />);
    const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

    await user.click(trigger1);

    const popup = await screen.findByRole('dialog');
    const trigger1Controls = trigger1.getAttribute('aria-controls');

    expect(trigger1Controls).toBe(popup.getAttribute('id'));

    await user.click(screen.getByRole('button', { name: 'Mount trigger 2' }));

    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger1.getAttribute('aria-controls')).toBe(trigger1Controls);
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).not.toHaveAttribute('aria-controls');
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerDialog },
    { name: 'detached triggers', Component: DetachedTriggerDialog },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersDialog },
  ])('when using $name', ({ Component: TestDialog }) => {
    it('rewires dismiss interactions after closing and reopening', async () => {
      const { user } = await render(<TestDialog rootProps={{ modal: false }} />);

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      fireEvent.click(document.body);
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    it('ARIA attributes', async () => {
      await render(
        <TestDialog
          rootProps={{ modal: false, open: true }}
          popupProps={{
            children: (
              <React.Fragment>
                <Dialog.Title>title text</Dialog.Title>
                <Dialog.Description>description text</Dialog.Description>
              </React.Fragment>
            ),
          }}
          includeBackdrop
        />,
      );

      const popup = screen.queryByRole('dialog');
      expect(popup).not.toBe(null);

      expect(screen.getByText('title text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-labelledby'),
      );
      expect(screen.getByText('description text').getAttribute('id')).toBe(
        popup?.getAttribute('aria-describedby'),
      );
    });

    describe('prop: onOpenChange', () => {
      it('calls onOpenChange with the new open state', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog rootProps={{ onOpenChange: handleOpenChange }} />,
        );

        expect(handleOpenChange.mock.calls.length).toBe(0);

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][0]).toBe(true);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        expect(handleOpenChange.mock.calls.length).toBe(2);
        expect(handleOpenChange.mock.calls[1][0]).toBe(false);
      });

      it('calls onOpenChange with the reason for change when clicked on trigger and close button', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog rootProps={{ onOpenChange: handleOpenChange }} />,
        );

        const openButton = screen.getByText('Open');
        await user.click(openButton);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);

        const closeButton = screen.getByText('Close');
        await user.click(closeButton);

        expect(handleOpenChange.mock.calls.length).toBe(2);
        expect(handleOpenChange.mock.calls[1][1].reason).toBe(REASONS.closePress);
      });

      it('calls onOpenChange with the reason for change when pressed Esc while the dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />,
        );

        await user.keyboard('[Escape]');

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
      });

      it('calls onOpenChange with the reason for change when user clicks backdrop while the modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }} />,
        );

        await user.click(screen.getByRole('presentation', { hidden: true }));

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      it('calls onOpenChange with the reason for change when user clicks outside while the non-modal dialog is open', async () => {
        const handleOpenChange = vi.fn();

        const { user } = await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
          />,
        );

        await user.click(document.body);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      });

      describe.skipIf(isJSDOM)('clicks on user backdrop', () => {
        it('detects clicks on user backdrop', async () => {
          const handleOpenChange = vi.fn();

          const { user } = await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              popupProps={{ style: { position: 'fixed', zIndex: 10 } }}
              includeBackdrop
            />,
          );

          await user.click(screen.getByTestId('backdrop'));

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        });

        it('does not change open state on non-main button clicks', async () => {
          const handleOpenChange = vi.fn();

          const { user } = await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              includeBackdrop
            />,
          );

          const backdrop = screen.getByTestId('backdrop');
          await user.pointer([{ target: backdrop }, { keys: '[MouseRight]', target: backdrop }]);

          expect(handleOpenChange.mock.calls.length).toBe(0);
        });
      });

      it('cancel() prevents opening while uncontrolled', async () => {
        const { user } = await render(
          <TestDialog
            rootProps={{
              onOpenChange: (nextOpen, eventDetails) => {
                if (nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
          />,
        );

        const openButton = screen.getByText('Open');
        await user.click(openButton);
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it('emits a single internal openchange when closing on Escape', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = await render(
          <TestDialog
            rootProps={{ defaultOpen: true }}
            popupProps={{
              children: (
                <React.Fragment>
                  <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </React.Fragment>
              ),
            }}
          />,
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(handleInternalOpenChange.mock.calls.length).toBe(1);
        expect(handleInternalOpenChange.mock.calls[0][0]).toMatchObject({
          open: false,
          reason: REASONS.escapeKey,
        });
      });

      it('does not emit internal openchange when an Escape close is canceled', async () => {
        const handleInternalOpenChange = vi.fn();
        const { user } = await render(
          <TestDialog
            rootProps={{
              defaultOpen: true,
              onOpenChange: (nextOpen, eventDetails) => {
                if (!nextOpen) {
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              children: (
                <React.Fragment>
                  <DialogOpenChangeSpy onOpenChange={handleInternalOpenChange} />
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </React.Fragment>
              ),
            }}
          />,
        );

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleInternalOpenChange.mock.calls.length).toBe(0);
      });
    });

    describe('prop: modal', () => {
      it('makes other interactive elements on the page inert when a modal dialog is open', async () => {
        await render(<TestDialog rootProps={{ defaultOpen: true, modal: true }} />);

        expect(screen.getByRole('presentation', { hidden: true })).not.toBe(null);
      });

      it('does not make other interactive elements on the page inert when a non-modal dialog is open', async () => {
        await render(<TestDialog rootProps={{ defaultOpen: true, modal: false }} />);

        expect(screen.queryByRole('presentation')).toBe(null);
      });
    });

    describe('prop: disablePointerDismissal', () => {
      (
        [
          [true, false],
          [false, true],
          [undefined, true],
        ] as const
      ).forEach(([disablePointerDismissal, expectDismissed]) => {
        it(`${expectDismissed ? 'closes' : 'does not close'} the dialog when clicking outside if disablePointerDismissal=${disablePointerDismissal}`, async () => {
          const handleOpenChange = vi.fn();

          await render(
            <div data-testid="outside">
              <TestDialog
                rootProps={{
                  defaultOpen: true,
                  onOpenChange: handleOpenChange,
                  disablePointerDismissal,
                  modal: false,
                }}
              />
            </div>,
          );

          const outside = screen.getByTestId('outside');

          fireEvent.mouseDown(outside);
          fireEvent.click(outside);
          expect(handleOpenChange.mock.calls.length === 1).toBe(expectDismissed);

          if (expectDismissed) {
            expect(screen.queryByRole('dialog')).toBe(null);
          } else {
            expect(screen.queryByRole('dialog')).not.toBe(null);
          }
        });
      });
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
            includeBackdrop
          />,
        );

        const backdrop = screen.getByTestId('backdrop');

        fireEvent.mouseDown(backdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        const internalBackdrop = screen.getByRole('presentation', { hidden: true });

        fireEvent.mouseDown(internalBackdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        fireEvent.click(internalBackdrop);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via intentional outside press with user backdrop (modal=true): works when portaled into a shadow DOM', async () => {
        const handleOpenChange = vi.fn();

        const container = document.body.appendChild(document.createElement('div'));
        const shadowRoot = container.attachShadow({ mode: 'open' });

        await render(
          <TestDialog
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
            portalProps={{ container: shadowRoot }}
            includeBackdrop
          />,
        );

        const backdrop = shadowRoot.querySelector('[data-testid="backdrop"]') as HTMLElement;

        fireEvent.click(backdrop);
        await waitFor(() => {
          expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
        });
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <React.Fragment>
              <button data-testid="outside">Outside</button>
              <TestDialog
                rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
                portalProps={{ container: shadowRoot }}
              />
            </React.Fragment>,
            { container },
          );

          const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;

          fireEvent.click(outsideButton);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          await act(async () => {
            host.remove();
          });
        }
      });

      it('closing via outside press: works when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: false }}
              portalProps={{ container: shadowRoot }}
            />,
            { container },
          );

          fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          await act(async () => {
            host.remove();
          });
        }
      });

      it('closing via outside press: works for a modal dialog when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        try {
          await render(
            <TestDialog
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
              portalProps={{ container: shadowRoot }}
            />,
            { container },
          );

          fireEvent.click(document.body);

          await waitFor(() => {
            expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
          });

          expect(handleOpenChange.mock.calls.length).toBe(1);
          expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
        } finally {
          await act(async () => {
            host.remove();
          });
        }
      });
    });

    it.skipIf(isJSDOM)('waits for the exit transition to finish before unmounting', async () => {
      const css = `
    .dialog {
      opacity: 0;
      transition: opacity 200ms;
    }
    .dialog[data-open] {
      opacity: 1;
    }
  `;

      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const notifyTransitionEnd = vi.fn();

      function TransitionTest(props: { open: boolean }) {
        return (
          <React.Fragment>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: css }} />
            <TestDialog
              rootProps={{ open: props.open, modal: false }}
              portalProps={{ keepMounted: true }}
              popupProps={{
                className: 'dialog',
                onTransitionEnd: notifyTransitionEnd,
                children: null,
              }}
            />
          </React.Fragment>
        );
      }

      const { setProps } = await render(<TransitionTest open />);

      await setProps({ open: false });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      expect(notifyTransitionEnd.mock.calls.length).toBe(1);
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestDialog rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toHaveAttribute(
          'role',
          'presentation',
        );
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestDialog rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const popup = screen.getByRole('dialog');

        // focus guard -> internal backdrop
        expect(popup.previousElementSibling?.previousElementSibling).toBe(null);
      });
    });

    it('does not dismiss previous modal dialog when clicking new modal dialog', async () => {
      function App() {
        const [openNested, setOpenNested] = React.useState(false);
        const [openNested2, setOpenNested2] = React.useState(false);

        return (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={{
                children: <button onClick={() => setOpenNested(true)}>Open nested 1</button>,
              }}
            />
            <TestDialog
              rootProps={{ open: openNested, onOpenChange: setOpenNested }}
              popupProps={{
                children: <button onClick={() => setOpenNested2(true)}>Open nested 2</button>,
              }}
            />
            <TestDialog
              rootProps={{ open: openNested2, onOpenChange: setOpenNested2 }}
              popupProps={{ children: 'Final nested' }}
            />
          </div>
        );
      }

      const { user } = await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Open base' });
      await user.click(trigger);

      const nestedButton1 = screen.getByRole('button', { name: 'Open nested 1' });
      await user.click(nestedButton1);

      const nestedButton2 = screen.getByRole('button', { name: 'Open nested 2' });
      await user.click(nestedButton2);

      const finalDialog = screen.getByText('Final nested');

      expect(finalDialog).not.toBe(null);
    });

    it('dismisses non-nested dialogs one by one', async () => {
      function App() {
        const [openNested, setOpenNested] = React.useState(false);
        const [openNested2, setOpenNested2] = React.useState(false);

        return (
          <div>
            <TestDialog
              triggerProps={{ children: 'Open base' }}
              popupProps={
                {
                  'data-testid': 'level-1',
                  children: <button onClick={() => setOpenNested(true)}>Open nested 1</button>,
                } as Dialog.Popup.Props
              }
            />
            <TestDialog
              rootProps={{ open: openNested, onOpenChange: setOpenNested }}
              popupProps={
                {
                  'data-testid': 'level-2',
                  children: <button onClick={() => setOpenNested2(true)}>Open nested 2</button>,
                } as Dialog.Popup.Props
              }
            />
            <TestDialog
              rootProps={{ open: openNested2, onOpenChange: setOpenNested2 }}
              popupProps={
                { 'data-testid': 'level-3', children: 'Final nested' } as Dialog.Popup.Props
              }
            />
          </div>
        );
      }

      await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Open base' });
      fireEvent.click(trigger);

      const nestedButton1 = screen.getByRole('button', { name: 'Open nested 1' });
      fireEvent.click(nestedButton1);

      const nestedButton2 = screen.getByRole('button', { name: 'Open nested 2' });
      fireEvent.click(nestedButton2);

      const backdrops = Array.from(document.querySelectorAll('[role="presentation"]'));
      fireEvent.click(backdrops[backdrops.length - 1]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-3')).toBe(null);
      });

      fireEvent.click(backdrops[backdrops.length - 2]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-2')).toBe(null);
      });

      fireEvent.click(backdrops[backdrops.length - 3]);

      await waitFor(() => {
        expect(screen.queryByTestId('level-1')).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('nested popups', () => {
      it('should not dismiss the dialog when dismissing outside a nested modal menu', async () => {
        const { user } = await render(
          <TestDialog
            popupProps={{
              children: (
                <Menu.Root>
                  <Menu.Trigger>Open menu</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="menu-positioner">
                      <Menu.Popup>
                        <Menu.Item>Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              ),
            }}
          />,
        );

        const dialogTrigger = screen.getByRole('button', { name: 'Open' });
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const menuTrigger = screen.getByRole('button', { name: 'Open menu' });

        await user.click(menuTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const menuPositioner = screen.getByTestId('menu-positioner');
        const menuInternalBackdrop = menuPositioner.previousElementSibling as HTMLElement;

        await user.click(menuInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const dialogPopup = screen.getByTestId('dialog-popup');
        const dialogInternalBackdrop = dialogPopup.previousElementSibling
          ?.previousElementSibling as HTMLElement;

        await user.click(dialogInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('should not dismiss the dialog when dismissing outside a nested select popup', async () => {
        const { user } = await render(
          <TestDialog
            popupProps={{
              children: (
                <Select.Root>
                  <Select.Trigger data-testid="select-trigger">Open select</Select.Trigger>
                  <Select.Portal>
                    <Select.Positioner data-testid="select-positioner">
                      <Select.Popup>
                        <Select.Item>Item</Select.Item>
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              ),
            }}
          />,
        );

        const dialogTrigger = screen.getByRole('button', { name: 'Open' });
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const selectTrigger = screen.getByTestId('select-trigger');

        await user.click(selectTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).not.toBe(null);
        });

        const selectPositioner = screen.getByTestId('select-positioner');
        const selectInternalBackdrop = selectPositioner.previousElementSibling as HTMLElement;

        await user.click(selectInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        const dialogPopup = screen.getByTestId('dialog-popup');
        const dialogInternalBackdrop = dialogPopup.previousElementSibling
          ?.previousElementSibling as HTMLElement;

        await user.click(dialogInternalBackdrop);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('should not close the parent menu when Escape is pressed in a nested dialog', async () => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Open menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <TestDialog
                    triggerProps={{ children: 'Open dialog' }}
                    triggerWrapper={(trigger) => (
                      <Menu.Item closeOnClick={false} render={trigger} nativeButton />
                    )}
                  ></TestDialog>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const menuTrigger = screen.getByRole('button', { name: 'Open menu' });
        await user.click(menuTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const dialogTrigger = screen.getByRole('menuitem', { name: 'Open dialog' });
        await user.click(dialogTrigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.keyboard('[Escape]');

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the dialog when the `unmount` method is called', async () => {
        const actionsRef = {
          current: {
            unmount: vi.fn(),
            close: vi.fn(),
          },
        };

        const { user } = await render(
          <TestDialog
            rootProps={{
              actionsRef,
              onOpenChange: (open, details) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await act(async () => actionsRef.current.unmount());

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('pointerdown removal', () => {
      it('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', async () => {
        function Test() {
          const [showButton, setShowButton] = React.useState(true);
          return (
            <TestDialog
              rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
              popupProps={{
                children: showButton && (
                  <button data-testid="remove" onPointerDown={() => setShowButton(false)}>
                    Remove on pointer down
                  </button>
                ),
              }}
            />
          );
        }

        const { user } = await render(<Test />);

        const removeButton = screen.getByTestId('remove');
        await waitFor(() => {
          expect(removeButton).toHaveFocus();
        });
        fireEvent.pointerDown(removeButton);

        const popup = screen.getByTestId('dialog-popup');
        await waitFor(() => {
          expect(popup).toHaveFocus();
        });

        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
      });

      it('dismisses on first outside click after NumberField scrub interaction (pointer lock path)', async () => {
        const originalRequestPointerLock = Element.prototype.requestPointerLock;
        const requestPointerLockSpy = vi.fn(() => Promise.resolve());

        try {
          Element.prototype.requestPointerLock =
            requestPointerLockSpy as typeof originalRequestPointerLock;

          await render(
            <ContainedTriggerDialog
              rootProps={{ defaultOpen: true, modal: false }}
              popupProps={{
                children: (
                  <NumberField.Root defaultValue={100}>
                    <NumberField.ScrubArea data-testid="scrub-area">
                      <span>Amount</span>
                    </NumberField.ScrubArea>
                    <NumberField.Input aria-label="Amount" />
                  </NumberField.Root>
                ),
              }}
            />,
          );

          const scrubArea = screen.getByTestId('scrub-area');

          fireEvent.pointerDown(scrubArea, { pointerType: 'mouse', button: 0 });
          fireEvent.mouseDown(scrubArea, { button: 0 });
          fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
          fireEvent.mouseUp(document.body, { button: 0 });
          await flushMicrotasks();

          fireEvent.click(document.body);

          await waitFor(() => {
            expect(screen.queryByRole('dialog')).toBe(null);
          });
          expect(requestPointerLockSpy.mock.calls.length).toBe(1);
        } finally {
          Element.prototype.requestPointerLock = originalRequestPointerLock;
        }
      });
    });

    describe.skipIf(isJSDOM)('prop: onOpenChangeComplete', () => {
      it('is called on close when there is no exit animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(true);
          return (
            <div>
              <button onClick={() => setOpen(false)}>Close externally</button>
              <TestDialog rootProps={{ open, onOpenChangeComplete }} />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const closeButton = screen.getByText('Close externally');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).toBe(null);
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
              <button onClick={() => setOpen(false)}>Close externally</button>
              <TestDialog
                rootProps={{ open, onOpenChangeComplete }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        expect(screen.getByTestId('dialog-popup')).not.toBe(null);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        const closeButton = screen.getByText('Close externally');
        await user.click(closeButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.lastCall?.[0]).toBe(false);
      });

      it('is called on open when there is no enter animation defined', async () => {
        const onOpenChangeComplete = vi.fn();

        function Test() {
          const [open, setOpen] = React.useState(false);
          return (
            <div>
              <button onClick={() => setOpen(true)}>Open externally</button>
              <TestDialog rootProps={{ open, onOpenChangeComplete }} />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
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
              <button onClick={() => setOpen(true)}>Open externally</button>
              <TestDialog
                rootProps={{ open, onOpenChange: setOpen, onOpenChangeComplete }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await user.click(openButton);

        // Wait for open animation to finish
        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });

        expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
      });

      it('waits for a restarted enter animation to finish', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
            @keyframes test-enter-a {
              from {
                opacity: 0;
              }
            }

            @keyframes test-enter-b {
              from {
                opacity: 0;
              }
            }

            .animation-test-indicator.animation-a[data-open] {
              animation: test-enter-a 50ms linear;
            }

            .animation-test-indicator.animation-b[data-open] {
              animation: test-enter-b 50ms linear;
            }
          `;

          const [open, setOpen] = React.useState(false);
          const [variant, setVariant] = React.useState<'a' | 'b'>('a');

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(true)}>Open externally</button>
              <button onClick={() => setVariant((v) => (v === 'a' ? 'b' : 'a'))}>
                Swap animation
              </button>
              <TestDialog
                rootProps={{ open, onOpenChange: setOpen, onOpenChangeComplete }}
                popupProps={{
                  className: `animation-test-indicator animation-${variant}`,
                }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await user.click(openButton);

        const popup = screen.getByTestId('dialog-popup');
        await waitFor(() => {
          expect(popup.getAnimations().length).not.toBe(0);
        });

        const swapButton = screen.getByText('Swap animation');
        await user.click(swapButton);

        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls.length).toBe(0);

        await waitFor(() => {
          expect(onOpenChangeComplete.mock.calls.length).toBe(1);
          expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
        });
      });

      it('does not get called on open when dismissed during the enter animation', async () => {
        globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

        const onOpenChangeComplete = vi.fn();

        function Test() {
          const style = `
            .animation-test-indicator {
              opacity: 0;
              transition: opacity 200ms linear;
            }

            .animation-test-indicator[data-open] {
              opacity: 1;
            }

            .animation-test-indicator[data-open][data-starting-style] {
              opacity: 0;
            }

            .animation-test-indicator[data-ending-style] {
              opacity: 0;
            }
          `;

          const [open, setOpen] = React.useState(false);

          return (
            <div>
              {/* eslint-disable-next-line react/no-danger */}
              <style dangerouslySetInnerHTML={{ __html: style }} />
              <button onClick={() => setOpen(true)}>Open externally</button>
              <TestDialog
                rootProps={{ open, onOpenChange: setOpen, onOpenChangeComplete }}
                popupProps={{
                  className: 'animation-test-indicator',
                }}
              />
            </div>
          );
        }

        const { user } = await render(<Test />);

        const openButton = screen.getByText('Open externally');
        await user.click(openButton);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
        });

        const popup = screen.getByTestId('dialog-popup');
        await waitFor(() => {
          const animations = popup.getAnimations();
          expect(animations.length).not.toBe(0);
          expect(animations.some((anim) => anim.playState !== 'finished')).toBe(true);
        });

        await user.click(document.body);

        await waitFor(() => {
          expect(screen.queryByTestId('dialog-popup')).toBe(null);
        });

        expect(onOpenChangeComplete.mock.calls.length).toBe(1);
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(false);
      });

      it('does not get called on mount when not open', async () => {
        const onOpenChangeComplete = vi.fn();

        await render(<TestDialog rootProps={{ onOpenChangeComplete }} />);

        expect(onOpenChangeComplete.mock.calls.length).toBe(0);
      });
    });
  });

  it.skipIf(isJSDOM)(
    'returns focus to the menu trigger when a detached dialog trigger unmounts',
    async () => {
      function MenuDialog() {
        const dialogHandle = useRefWithInit(() => Dialog.createHandle()).current;

        return (
          <React.Fragment>
            <Menu.Root>
              <Menu.Trigger>Open menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item render={<Dialog.Trigger handle={dialogHandle} />} nativeButton>
                      Open dialog
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>

            <Dialog.Root handle={dialogHandle}>
              <Dialog.Portal>
                <Dialog.Popup>Dialog content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<MenuDialog />);

      const menuTrigger = screen.getByRole('button', { name: 'Open menu' });
      await user.click(menuTrigger);

      const menu = await screen.findByRole('menu');
      await waitFor(() => {
        expect(menu).toHaveFocus();
      });

      const dialogTrigger = await screen.findByRole('menuitem', { name: 'Open dialog' });
      await user.click(dialogTrigger);

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      await user.keyboard('[Escape]');

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBe(null);
      });
      await waitFor(() => {
        expect(menuTrigger).toHaveFocus();
      });
    },
  );

  it.skipIf(isJSDOM)(
    'keeps focus trapped when dialog content contains a non-scrollable scroll area',
    async () => {
      const { user } = await render(
        <div>
          <button data-testid="outside-before">Outside before</button>
          <ContainedTriggerDialog
            rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
            popupProps={{
              children: (
                <ScrollArea.Root style={{ width: 200, height: 200 }}>
                  <ScrollArea.Viewport
                    data-testid="viewport"
                    style={{ width: '100%', height: '100%' }}
                  >
                    <div style={{ width: 100, height: 100 }}>Non-scrollable content</div>
                  </ScrollArea.Viewport>
                </ScrollArea.Root>
              ),
            }}
            omitTrigger
          />
          <button data-testid="outside-after">Outside after</button>
        </div>,
      );

      const popup = screen.getByRole('dialog');
      const outsideBefore = screen.getByTestId('outside-before');
      const outsideAfter = screen.getByTestId('outside-after');

      await waitFor(() => {
        expect(popup.contains(document.activeElement)).toBe(true);
      });

      await user.keyboard('[Tab]');
      expect(popup.contains(document.activeElement)).toBe(true);

      await user.keyboard('[Tab]');
      expect(popup.contains(document.activeElement)).toBe(true);

      await user.keyboard('[ShiftLeft>][Tab][/ShiftLeft]');
      expect(popup.contains(document.activeElement)).toBe(true);

      expect(outsideBefore).not.toHaveFocus();
      expect(outsideAfter).not.toHaveFocus();
    },
  );

  it.skipIf(isJSDOM)(
    'returns focus into the dialog when a close confirmation opened by an outside press closes',
    async () => {
      function App() {
        const [open, setOpen] = React.useState(false);
        const [confirmationOpen, setConfirmationOpen] = React.useState(false);
        const [value, setValue] = React.useState('');

        return (
          <Dialog.Root
            open={open}
            onOpenChange={(nextOpen, eventDetails) => {
              if (!nextOpen && value) {
                eventDetails.cancel();
                setConfirmationOpen(true);
                return;
              }
              setOpen(nextOpen);
            }}
          >
            <Dialog.Trigger data-testid="trigger">Tweet</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop data-testid="backdrop" />
              <Dialog.Popup>
                <textarea
                  data-testid="textarea"
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                />
              </Dialog.Popup>
            </Dialog.Portal>
            <AlertDialog.Root open={confirmationOpen} onOpenChange={setConfirmationOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Popup>
                  <AlertDialog.Close data-testid="go-back">Go back</AlertDialog.Close>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </Dialog.Root>
        );
      }

      const { user } = await render(<App />);

      await user.click(screen.getByTestId('trigger'));
      await screen.findByRole('dialog');

      const textarea = screen.getByTestId('textarea');
      await user.click(textarea);
      await user.keyboard('x');
      expect(textarea).toHaveFocus();

      // Pressing the backdrop moves focus to the body before the close is
      // canceled and the confirmation dialog opens.
      await user.click(screen.getByTestId('backdrop'));

      const goBack = await screen.findByTestId('go-back');
      await waitFor(() => {
        expect(goBack).toHaveFocus();
      });

      await user.keyboard('[Enter]');

      await waitFor(() => {
        expect(screen.queryByTestId('go-back')).toBe(null);
      });
      await waitFor(() => {
        expect(textarea).toHaveFocus();
      });
    },
  );

  it.skipIf(isJSDOM)(
    'does not leak a non-modal popup field into an unrelated dialog return focus',
    async () => {
      function App() {
        const [confirmationOpen, setConfirmationOpen] = React.useState(false);

        return (
          <React.Fragment>
            {/* Clicking this non-focusable surface blurs the field to the body and
                opens the confirmation while the body is focused. */}
            <div
              data-testid="surface"
              onClick={() => setConfirmationOpen(true)}
              style={{ width: 100, height: 100 }}
            >
              surface
            </div>

            {/* A non-modal dialog held open (controlled, no `onOpenChange`). Its field
                blurs to the body on the outside press, but because it is non-modal it
                must not feed the shared focus stack. */}
            <Dialog.Root open modal={false}>
              <Dialog.Portal>
                <Dialog.Popup>
                  <textarea data-testid="nonmodal-field" />
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>

            <AlertDialog.Root open={confirmationOpen} onOpenChange={setConfirmationOpen}>
              <AlertDialog.Portal>
                <AlertDialog.Popup>
                  <AlertDialog.Close data-testid="go-back">Go back</AlertDialog.Close>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const field = screen.getByTestId('nonmodal-field');
      await user.click(field);
      expect(field).toHaveFocus();

      // Blur the field to the body and open the confirmation while it is focused.
      await user.click(screen.getByTestId('surface'));

      const goBack = await screen.findByTestId('go-back');
      await waitFor(() => {
        expect(goBack).toHaveFocus();
      });

      await user.keyboard('[Enter]');

      await waitFor(() => {
        expect(screen.queryByTestId('go-back')).toBe(null);
      });

      // The modal gate keeps the non-modal field out of the shared stack, so the
      // confirmation must not restore focus into the unrelated dialog.
      await flushMicrotasks();
      expect(field).not.toHaveFocus();
    },
  );
});

function DialogOpenChangeSpy(props: {
  onOpenChange: (details: { open: boolean; reason: string | null | undefined }) => void;
}) {
  const { onOpenChange } = props;
  const { store } = useDialogRootContext();
  const floatingRootContext = store.useState('floatingRootContext');

  React.useEffect(() => {
    function handleOpenChange(details: { open: boolean; reason: string | null | undefined }) {
      onOpenChange(details);
    }

    floatingRootContext.context.events.on('openchange', handleOpenChange);
    return () => {
      floatingRootContext.context.events.off('openchange', handleOpenChange);
    };
  }, [floatingRootContext, onOpenChange]);

  return null;
}

type TestDialogProps = {
  rootProps?: Omit<Dialog.Root.Props, 'children'>;
  triggerProps?: Dialog.Trigger.Props;
  portalProps?: Dialog.Portal.Props;
  popupProps?: Dialog.Popup.Props;
  omitTrigger?: boolean;
  includeBackdrop?: boolean;
  triggerWrapper?: (trigger: React.ReactElement) => React.ReactElement;
};

function ContainedTriggerDialog(props: TestDialogProps) {
  const {
    rootProps,
    triggerProps,
    portalProps,
    popupProps,
    omitTrigger = false,
    includeBackdrop = false,
    triggerWrapper = (trigger) => trigger,
  } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const { children: popupChildren, ...restPopupProps } = popupProps ?? {};
  const { children: portalChildren, ...restPortalProps } = portalProps ?? {};

  return (
    <Dialog.Root {...rootProps}>
      {!omitTrigger
        ? triggerWrapper(
            <Dialog.Trigger data-testid="trigger" {...restTriggerProps}>
              {triggerChildren ?? 'Open'}
            </Dialog.Trigger>,
          )
        : null}
      <Dialog.Portal {...restPortalProps}>
        {portalChildren ?? (
          <React.Fragment>
            {includeBackdrop ? (
              <Dialog.Backdrop
                data-testid="backdrop"
                style={{ position: 'fixed', zIndex: 10, inset: 0 }}
              />
            ) : null}
            <Dialog.Popup
              data-testid="dialog-popup"
              style={{ position: 'fixed', zIndex: 10 }}
              {...restPopupProps}
            >
              {popupChildren ?? (
                <React.Fragment>
                  <p>Dialog content</p>
                  <Dialog.Close>Close</Dialog.Close>
                </React.Fragment>
              )}
            </Dialog.Popup>
          </React.Fragment>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function DetachedTriggerDialog(props: Omit<TestDialogProps, 'omitTrigger'>) {
  const { triggerProps, triggerWrapper = (trigger) => trigger } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const dialogHandle = useRefWithInit(() => Dialog.createHandle()).current;

  return (
    <React.Fragment>
      {triggerWrapper(
        <Dialog.Trigger data-testid="trigger" {...restTriggerProps} handle={dialogHandle}>
          {triggerChildren ?? 'Open'}
        </Dialog.Trigger>,
      )}
      <ContainedTriggerDialog
        {...props}
        rootProps={{ ...props.rootProps, handle: dialogHandle }}
        omitTrigger
      />
    </React.Fragment>
  );
}

function MultipleDetachedTriggersDialog(props: Omit<TestDialogProps, 'omitTrigger'>) {
  const { triggerProps, triggerWrapper = (trigger) => trigger } = props;

  const { children: triggerChildren, ...restTriggerProps } = triggerProps ?? {};
  const dialogHandle = useRefWithInit(() => Dialog.createHandle()).current;

  return (
    <React.Fragment>
      {triggerWrapper(
        <Dialog.Trigger data-testid="trigger" {...restTriggerProps} handle={dialogHandle}>
          {triggerChildren ?? 'Open'}
        </Dialog.Trigger>,
      )}
      <Dialog.Trigger data-testid="trigger-2" handle={dialogHandle}>
        Open another
      </Dialog.Trigger>
      <ContainedTriggerDialog
        {...props}
        rootProps={{ ...props.rootProps, handle: dialogHandle }}
        omitTrigger
      />
    </React.Fragment>
  );
}
