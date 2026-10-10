import { expect, vi } from 'vitest';
import * as React from 'react';
import type { UserEvent } from '@testing-library/user-event';
import { act, screen, waitFor } from '@mui/internal-test-utils';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { createRenderer, isJSDOM, popupConformanceTests } from '#test-utils';
import { DialogStore } from '../../dialog/store/DialogStore';
import { REASONS } from '../../internals/reasons';

describe('<AlertDialog.Root />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  popupConformanceTests({
    createComponent: (props) => (
      <AlertDialog.Root {...props.root}>
        <AlertDialog.Trigger {...props.trigger}>Open dialog</AlertDialog.Trigger>
        <AlertDialog.Portal {...props.portal}>
          <AlertDialog.Popup {...props.popup}>Dialog</AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'alertdialog',
    expectedAriaHasPopupValue: 'dialog',
  });

  it('ARIA attributes', async () => {
    await render(
      <AlertDialog.Root open>
        <AlertDialog.Trigger />
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Popup>
            <AlertDialog.Title>title text</AlertDialog.Title>
            <AlertDialog.Description>description text</AlertDialog.Description>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );

    const popup = screen.queryByRole('alertdialog');
    expect(popup).not.toBe(null);

    expect(screen.getByText('title text').getAttribute('id')).toBe(
      popup?.getAttribute('aria-labelledby'),
    );
    expect(screen.getByText('description text').getAttribute('id')).toBe(
      popup?.getAttribute('aria-describedby'),
    );
  });

  it('synchronizes trigger ARIA attributes in controlled mode', async () => {
    await render(
      <AlertDialog.Root open triggerId="trigger-2">
        <AlertDialog.Trigger id="trigger-1">Trigger 1</AlertDialog.Trigger>
        <AlertDialog.Trigger id="trigger-2">Trigger 2</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Popup>Dialog</AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );

    const trigger1 = screen.getByText('Trigger 1');
    const trigger2 = screen.getByText('Trigger 2');
    const popup = screen.getByRole('alertdialog');

    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger1).not.toHaveAttribute('aria-controls');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('synchronizes trigger ARIA attributes when initially open with a handle', async () => {
    const handle = AlertDialog.createHandle();

    await render(
      <AlertDialog.Root handle={handle} defaultOpen defaultTriggerId="trigger">
        <AlertDialog.Trigger id="trigger">Open</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Popup>Dialog</AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );

    const trigger = screen.getByText('Open');
    const popup = screen.getByRole('alertdialog');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('synchronizes detached trigger ARIA attributes when initially open with a handle', async () => {
    const handle = AlertDialog.createHandle();

    await render(
      <React.Fragment>
        <AlertDialog.Trigger handle={handle} id="trigger">
          Open
        </AlertDialog.Trigger>
        <AlertDialog.Root handle={handle} defaultOpen defaultTriggerId="trigger">
          <AlertDialog.Portal>
            <AlertDialog.Popup>Dialog</AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </React.Fragment>,
    );

    const trigger = screen.getByText('Open');
    const popup = screen.getByRole('alertdialog');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
    expect(handle.isOpen).toBe(true);
  });

  it('renders a viewport', async () => {
    await render(
      <AlertDialog.Root open>
        <AlertDialog.Portal>
          <AlertDialog.Viewport data-testid="viewport">
            <AlertDialog.Popup>Dialog</AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );

    expect(screen.getByTestId('viewport')).toContain(screen.getByRole('alertdialog'));
  });

  describe('prop: onOpenChange', () => {
    it('calls onOpenChange with the new open state', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <AlertDialog.Root onOpenChange={handleOpenChange}>
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
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
        <AlertDialog.Root onOpenChange={handleOpenChange}>
          <AlertDialog.Trigger id="open-trigger">Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.triggerPress);
      expect(handleOpenChange.mock.calls[0][1].trigger).toBe(openButton);
      expect(handleOpenChange.mock.calls[0][1].trigger?.id).toBe('open-trigger');

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      expect(handleOpenChange.mock.calls.length).toBe(2);
      expect(handleOpenChange.mock.calls[1][1].reason).toBe(REASONS.closePress);
      expect(handleOpenChange.mock.calls[1][1].trigger).toBe(openButton);
      expect(handleOpenChange.mock.calls[1][1].trigger?.id).toBe('open-trigger');
    });

    it('calls onOpenChange with the reason for change when pressed Esc while the dialog is open', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      await user.keyboard('[Escape]');

      expect(handleOpenChange.mock.calls.length).toBe(1);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });

    it('does not close when the backdrop is clicked', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      await user.click(screen.getByRole('presentation', { hidden: true }));

      expect(handleOpenChange.mock.calls.length).toBe(0);
      expect(screen.queryByRole('alertdialog')).not.toBe(null);
    });

    it('keeps the trigger data-popup-open attribute and handle.isOpen when a controlled close is vetoed', async () => {
      const handle = AlertDialog.createHandle();

      function TestCase() {
        const [open, setOpen] = React.useState(false);

        return (
          <AlertDialog.Root
            handle={handle}
            open={open}
            onOpenChange={(nextOpen) => {
              if (nextOpen) {
                setOpen(true);
              }
            }}
          >
            <AlertDialog.Trigger>Open</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Title>Confirm</AlertDialog.Title>
                <AlertDialog.Close>Cancel</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        );
      }

      const { user } = await render(<TestCase />);

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      await screen.findByRole('alertdialog');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('alertdialog')).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('prop: actionsRef', () => {
    it('unmounts the alert dialog when the `unmount` method is called', async () => {
      const actionsRef = React.createRef<AlertDialog.Root.Actions>();

      const { user } = await render(
        <AlertDialog.Root
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            if (!open) {
              details.preventUnmountOnClose();
            }
          }}
        >
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup />
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const trigger = screen.getByText('Open');
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      await user.click(trigger);

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      await act(async () => actionsRef.current?.unmount());

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });
    });

    it('clears manual unmount state after the `unmount` method is called', async () => {
      const actionsRef = React.createRef<AlertDialog.Root.Actions>();
      let shouldPreventUnmount = true;

      const { user } = await render(
        <AlertDialog.Root
          actionsRef={actionsRef}
          onOpenChange={(open, details) => {
            if (!open && shouldPreventUnmount) {
              shouldPreventUnmount = false;
              details.preventUnmountOnClose();
            }
          }}
        >
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const trigger = screen.getByText('Open');
      await user.click(trigger);
      expect(await screen.findByRole('alertdialog')).not.toBe(null);

      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      await act(async () => actionsRef.current?.unmount());
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });

      await user.click(trigger);
      expect(await screen.findByRole('alertdialog')).not.toBe(null);

      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });
    });

    it('closes the alert dialog when the `close` method is called', async () => {
      const actionsRef = React.createRef<AlertDialog.Root.Actions>();

      await render(
        <AlertDialog.Root defaultOpen actionsRef={actionsRef}>
          <AlertDialog.Portal>
            <AlertDialog.Popup />
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      expect(screen.queryByRole('alertdialog')).not.toBe(null);

      await act(async () => actionsRef.current?.close());

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('opens the alert dialog with any trigger', async () => {
      const { user } = await render(
        <AlertDialog.Root>
          <AlertDialog.Trigger>Trigger 1</AlertDialog.Trigger>
          <AlertDialog.Trigger>Trigger 2</AlertDialog.Trigger>
          <AlertDialog.Trigger>Trigger 3</AlertDialog.Trigger>

          <AlertDialog.Portal>
            <AlertDialog.Popup>
              Alert dialog content
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Alert dialog content')).toBe(null);

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).toBe(null);
      });

      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).toBe(null);
      });

      await user.click(trigger3);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
    });

    it('sets the payload and renders content based on its value', async () => {
      const { user } = await render(
        <AlertDialog.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <AlertDialog.Trigger payload={1}>Trigger 1</AlertDialog.Trigger>
              <AlertDialog.Trigger payload={2}>Trigger 2</AlertDialog.Trigger>

              <AlertDialog.Portal>
                <AlertDialog.Popup>
                  <span data-testid="content">{payload}</span>
                  <AlertDialog.Close>Close</AlertDialog.Close>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </React.Fragment>
          )}
        </AlertDialog.Root>,
      );

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
    });

    it('reuses the popup DOM node when switching triggers', async () => {
      const { user } = await render(
        <AlertDialog.Root>
          {({ payload }: NumberPayload) => (
            <React.Fragment>
              <AlertDialog.Trigger payload={1}>Trigger 1</AlertDialog.Trigger>
              <AlertDialog.Trigger payload={2}>Trigger 2</AlertDialog.Trigger>

              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="alert-dialog-popup">
                  <span>{payload}</span>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </React.Fragment>
          )}
        </AlertDialog.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      const popupElement = screen.getByTestId('alert-dialog-popup');

      await user.click(trigger2);
      expect(screen.getByTestId('alert-dialog-popup')).toBe(popupElement);
    });

    it('synchronizes ARIA attributes on the active trigger', async () => {
      const { user } = await render(
        <AlertDialog.Root>
          <AlertDialog.Trigger>Trigger 1</AlertDialog.Trigger>
          <AlertDialog.Trigger>Trigger 2</AlertDialog.Trigger>

          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="alert-dialog-popup">
              Alert dialog content
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'false');

      await user.click(trigger1);

      const dialog = await screen.findByRole('alertdialog');
      const trigger1Controls = trigger1.getAttribute('aria-controls');
      expect(trigger1Controls).not.toBe(null);
      expect(dialog.getAttribute('id')).toBe(trigger1Controls);
      await waitFor(() => {
        expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      });
      expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    function TriggerWithNesting({
      handle,
      nesting,
    }: {
      handle: ReturnType<typeof AlertDialog.createHandle>;
      nesting: 0 | 1 | 2 | 3;
    }) {
      const trigger = <AlertDialog.Trigger handle={handle}>Trigger</AlertDialog.Trigger>;

      if (nesting === 0) {
        return trigger;
      }

      if (nesting === 1) {
        return <div>{trigger}</div>;
      }

      if (nesting === 2) {
        return (
          <div>
            <div>{trigger}</div>
          </div>
        );
      }

      return (
        <div>
          <div>
            <div>{trigger}</div>
          </div>
        </div>
      );
    }

    function DetachedTriggerReparentingTest({
      handle,
      nesting,
    }: {
      handle: ReturnType<typeof AlertDialog.createHandle>;
      nesting: 0 | 1 | 2 | 3;
    }) {
      return (
        <React.Fragment>
          <TriggerWithNesting handle={handle} nesting={nesting} />
          <AlertDialog.Root handle={handle}>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                Alert dialog content
                <AlertDialog.Close>Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </React.Fragment>
      );
    }

    async function openAndCloseDialog(user: UserEvent) {
      await user.click(screen.getByRole('button', { name: 'Trigger' }));
      await waitFor(() => {
        expect(screen.getByText('Alert dialog content')).toBeVisible();
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).toBe(null);
      });
    }

    it('opens the alert dialog with any trigger', async () => {
      const testDialog = AlertDialog.createHandle();
      const { user } = await render(
        <div>
          <AlertDialog.Trigger handle={testDialog}>Trigger 1</AlertDialog.Trigger>
          <AlertDialog.Trigger handle={testDialog}>Trigger 2</AlertDialog.Trigger>
          <AlertDialog.Trigger handle={testDialog}>Trigger 3</AlertDialog.Trigger>

          <AlertDialog.Root handle={testDialog}>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                Alert dialog content
                <AlertDialog.Close>Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      const trigger3 = screen.getByRole('button', { name: 'Trigger 3' });

      expect(screen.queryByText('Alert dialog content')).toBe(null);

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).toBe(null);
      });

      await user.click(trigger2);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
      await user.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).toBe(null);
      });

      await user.click(trigger3);
      await waitFor(() => {
        expect(screen.queryByText('Alert dialog content')).not.toBe(null);
      });
    });

    it('keeps detached triggers clickable when reparented (remove wrappers)', async () => {
      const testDialog = AlertDialog.createHandle();
      const { user, setProps } = await render(
        <DetachedTriggerReparentingTest handle={testDialog} nesting={3} />,
      );

      await openAndCloseDialog(user);

      await setProps({ nesting: 2 });
      await openAndCloseDialog(user);

      await setProps({ nesting: 1 });
      await openAndCloseDialog(user);

      await setProps({ nesting: 0 });
      await openAndCloseDialog(user);
    });

    it('keeps detached triggers clickable when reparented (add wrappers)', async () => {
      const testDialog = AlertDialog.createHandle();
      const { user, setProps } = await render(
        <DetachedTriggerReparentingTest handle={testDialog} nesting={0} />,
      );

      await openAndCloseDialog(user);

      await setProps({ nesting: 1 });
      await openAndCloseDialog(user);

      await setProps({ nesting: 2 });
      await openAndCloseDialog(user);

      await setProps({ nesting: 3 });
      await openAndCloseDialog(user);
    });

    it('keeps detached triggers clickable during Fast Refresh-like handle recreation', async () => {
      function DetachedTriggerTest({
        handle,
      }: {
        handle: ReturnType<typeof AlertDialog.createHandle>;
      }) {
        return (
          <React.Fragment>
            <AlertDialog.Trigger handle={handle}>Trigger</AlertDialog.Trigger>
            <AlertDialog.Root handle={handle}>
              <AlertDialog.Portal>
                <AlertDialog.Popup>
                  Alert dialog content
                  <AlertDialog.Close>Close</AlertDialog.Close>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </React.Fragment>
        );
      }

      const handleA = AlertDialog.createHandle();
      const { user, setProps } = await render(<DetachedTriggerTest handle={handleA} />);

      await openAndCloseDialog(user);

      await setProps({ handle: AlertDialog.createHandle() });
      await openAndCloseDialog(user);

      await setProps({ handle: AlertDialog.createHandle() });
      await openAndCloseDialog(user);
    });

    it('keeps detached triggers clickable when reparented during Fast Refresh-like handle recreation', async () => {
      const handleA = AlertDialog.createHandle();
      const { user, setProps } = await render(
        <DetachedTriggerReparentingTest handle={handleA} nesting={3} />,
      );

      await openAndCloseDialog(user);

      await setProps({ handle: AlertDialog.createHandle(), nesting: 2 });
      await openAndCloseDialog(user);

      await setProps({ handle: AlertDialog.createHandle(), nesting: 1 });
      await openAndCloseDialog(user);

      await setProps({ handle: AlertDialog.createHandle(), nesting: 0 });
      await openAndCloseDialog(user);
    });

    it('sets the payload and renders content based on its value', async () => {
      const testDialog = AlertDialog.createHandle<number>();
      const { user } = await render(
        <div>
          <AlertDialog.Trigger handle={testDialog} payload={1}>
            Trigger 1
          </AlertDialog.Trigger>
          <AlertDialog.Trigger handle={testDialog} payload={2}>
            Trigger 2
          </AlertDialog.Trigger>

          <AlertDialog.Root handle={testDialog}>
            {({ payload }: NumberPayload) => (
              <AlertDialog.Portal>
                <AlertDialog.Popup>
                  <span data-testid="content">{payload}</span>
                  <AlertDialog.Close>Close</AlertDialog.Close>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            )}
          </AlertDialog.Root>
        </div>,
      );

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
    });

    it('reuses the popup DOM node when switching triggers', async () => {
      const testDialog = AlertDialog.createHandle<number>();
      const { user } = await render(
        <React.Fragment>
          <AlertDialog.Trigger handle={testDialog} payload={1}>
            Trigger 1
          </AlertDialog.Trigger>
          <AlertDialog.Trigger handle={testDialog} payload={2}>
            Trigger 2
          </AlertDialog.Trigger>

          <AlertDialog.Root handle={testDialog}>
            {({ payload }: NumberPayload) => (
              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="alert-dialog-popup">
                  <span>{payload}</span>
                </AlertDialog.Popup>
              </AlertDialog.Portal>
            )}
          </AlertDialog.Root>
        </React.Fragment>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await user.click(trigger1);
      const popupElement = screen.getByTestId('alert-dialog-popup');

      await user.click(trigger2);
      expect(screen.getByTestId('alert-dialog-popup')).toBe(popupElement);
    });
  });

  describe('imperative actions on the handle', () => {
    it('enforces alert dialog state when constructed with a plain store', () => {
      const store = new DialogStore();
      const handle = new AlertDialog.Handle(store);

      expect(handle.store.select('modal')).toBe(true);
      expect(handle.store.select('disablePointerDismissal')).toBe(true);
      expect(handle.store.select('role')).toBe('alertdialog');
    });

    it('keeps the alert dialog open when the backdrop is clicked', async () => {
      const handle = AlertDialog.createHandle();

      const { user } = await render(
        <React.Fragment>
          <AlertDialog.Trigger handle={handle}>Open</AlertDialog.Trigger>
          <AlertDialog.Root handle={handle}>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Close>Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </React.Fragment>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      expect(await screen.findByRole('alertdialog')).not.toBe(null);

      const backdrop = await screen.findByRole('presentation', { hidden: true });
      await user.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });
    });

    it('opens and closes the dialog', async () => {
      const dialog = AlertDialog.createHandle();
      await render(
        <div>
          <AlertDialog.Trigger handle={dialog} id="trigger">
            Trigger
          </AlertDialog.Trigger>
          <AlertDialog.Root handle={dialog}>
            <AlertDialog.Portal>
              <AlertDialog.Popup data-testid="content">Content</AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      expect(screen.queryByRole('alertdialog')).toBe(null);

      await act(() => dialog.open('trigger'));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('Content');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await act(() => dialog.close());
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets the payload associated with the trigger', async () => {
      const dialog = AlertDialog.createHandle<number>();
      await render(
        <div>
          <AlertDialog.Trigger handle={dialog} id="trigger1" payload={1}>
            Trigger 1
          </AlertDialog.Trigger>
          <AlertDialog.Trigger handle={dialog} id="trigger2" payload={2}>
            Trigger 2
          </AlertDialog.Trigger>
          <AlertDialog.Root handle={dialog}>
            {({ payload }: { payload: number | undefined }) => (
              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="content">{payload}</AlertDialog.Popup>
              </AlertDialog.Portal>
            )}
          </AlertDialog.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByRole('alertdialog')).toBe(null);

      await act(() => dialog.open('trigger2'));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('2');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(trigger1).not.toHaveAttribute('aria-expanded', 'true');

      await act(() => dialog.close());
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });

      expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    });

    it('sets the payload programmatically', async () => {
      const dialog = AlertDialog.createHandle<number>();
      await render(
        <div>
          <AlertDialog.Trigger handle={dialog} id="trigger1" payload={1}>
            Trigger 1
          </AlertDialog.Trigger>
          <AlertDialog.Trigger handle={dialog} id="trigger2" payload={2}>
            Trigger 2
          </AlertDialog.Trigger>
          <AlertDialog.Root handle={dialog}>
            {({ payload }: { payload: number | undefined }) => (
              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="content">{payload}</AlertDialog.Popup>
              </AlertDialog.Portal>
            )}
          </AlertDialog.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
      expect(screen.queryByRole('alertdialog')).toBe(null);

      await act(() => dialog.openWithPayload(8));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('8');
      expect(trigger1).not.toHaveAttribute('aria-expanded', 'true');
      expect(trigger2).not.toHaveAttribute('aria-expanded', 'true');

      await act(() => dialog.close());
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBe(null);
      });
    });
  });

  describe.skipIf(isJSDOM)('modality', () => {
    it('makes other interactive elements on the page inert when a modal dialog is open', async () => {
      await render(
        <AlertDialog.Root defaultOpen>
          <AlertDialog.Trigger>Open Dialog</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close Dialog</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );

      expect(screen.getByRole('presentation', { hidden: true })).not.toBe(null);
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
            <AlertDialog.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="popup" />
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
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
            <AlertDialog.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <AlertDialog.Portal>
                <AlertDialog.Popup className="animation-test-indicator" data-testid="popup" />
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      expect(screen.getByTestId('popup')).not.toBe(null);

      // Wait for open animation to finish
      await waitFor(() => {
        expect(onOpenChangeComplete.mock.calls[0][0]).toBe(true);
      });

      const closeButton = screen.getByText('Close');
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
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
            <AlertDialog.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
              <AlertDialog.Portal>
                <AlertDialog.Popup data-testid="popup" />
              </AlertDialog.Portal>
            </AlertDialog.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);

      const openButton = screen.getByText('Open');
      await user.click(openButton);

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).not.toBe(null);
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
            <AlertDialog.Root
              open={open}
              onOpenChange={setOpen}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <AlertDialog.Portal>
                <AlertDialog.Popup className="animation-test-indicator" data-testid="popup" />
              </AlertDialog.Portal>
            </AlertDialog.Root>
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

      expect(screen.queryByTestId('popup')).not.toBe(null);
    });
  });
});
