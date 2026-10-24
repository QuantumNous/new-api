import { vi, expect } from 'vitest';

import { act, fireEvent, flushMicrotasks, render, screen, waitFor } from '@mui/internal-test-utils';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { isJSDOM, useTestInteractions } from '#test-utils';
import {
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useFocus,
  useClick,
} from '../index';
import { REASONS } from '../../internals/reasons';
import type { UseDismissProps } from './useDismiss';
import { normalizeProp } from './useDismiss';

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
});

function App(
  props: UseDismissProps & {
    onClose?: () => void;
  },
) {
  const [open, setOpen] = React.useState(true);
  const { refs, context } = useFloating({
    open,
    onOpenChange(openArg, data) {
      setOpen(openArg);
      const reason = data?.reason;
      if (props.outsidePress) {
        expect(reason).toBe(REASONS.outsidePress);
      } else if (props.escapeKey) {
        expect(reason).toBe(REASONS.escapeKey);
        if (!openArg) {
          props.onClose?.();
        }
      } else if (props.referencePress?.()) {
        expect(reason).toBe(REASONS.triggerPress);
      }
    },
  });
  const { getReferenceProps, getFloatingProps } = useTestInteractions([useDismiss(context, props)]);

  return (
    <React.Fragment>
      <button {...getReferenceProps({ ref: refs.setReference })} />
      {open && (
        <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
          <input />
        </div>
      )}
    </React.Fragment>
  );
}

describe.skipIf(!isJSDOM)('useDismiss', () => {
  describe('default options', () => {
    test('dismisses with escape key', async () => {
      render(<App />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await flushMicrotasks();
    });

    test('calls preventDefault on escape key dismiss', async () => {
      render(<App />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        document.body.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
      await flushMicrotasks();
    });

    test('does not call preventDefault on escape key if close is canceled', async () => {
      function CancelApp() {
        const [open, setOpen] = React.useState(true);
        const { refs, context } = useFloating({
          open,
          onOpenChange(openArg, data) {
            data?.cancel();
            setOpen(true);
          },
        });
        const { getReferenceProps, getFloatingProps } = useTestInteractions([useDismiss(context)]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open && <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />}
          </React.Fragment>
        );
      }

      render(<CancelApp />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        document.body.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with escape key if IME is active', async () => {
      const onClose = vi.fn();

      render(<App onClose={onClose} escapeKey />);

      const textbox = screen.getByRole('textbox');

      await act(async () => {
        textbox.focus();
      });

      await flushMicrotasks();

      // Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
      // cancellation.
      fireEvent.change(textbox, { target: { value: 'あ' } });
      fireEvent.compositionStart(textbox);
      fireEvent.keyDown(textbox, { key: 'Escape' });
      fireEvent.compositionEnd(textbox);

      // Wait for the compositionend timeout tick due to Safari
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });

      expect(onClose).toHaveBeenCalledTimes(0);

      fireEvent.keyDown(textbox, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('dismisses with outside pointer press', async () => {
      render(<App />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with reference press', () => {
      render(<App referencePress={() => true} />);
      fireEvent.pointerDown(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('dismisses with native click', async () => {
      render(<App referencePress={() => true} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(<App outsidePress={() => false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('outsidePress ignored for third party elements', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(true);

        const { context, refs } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
              </FloatingFocusManager>
            )}
          </React.Fragment>
        );
      }

      render(<App />);
      await flushMicrotasks();

      const thirdParty = document.createElement('div');
      thirdParty.setAttribute('data-testid', 'third-party');
      document.body.append(thirdParty);
      await userEvent.click(thirdParty);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      thirdParty.remove();
    });

    test('dismisses when clicking outside a shared shadow root', async () => {
      function App({ shadowRoot }: { shadowRoot: ShadowRoot }) {
        const [isOpen, setIsOpen] = React.useState(true);

        const { context, refs } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss(context);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {isOpen && (
              <FloatingPortal container={shadowRoot}>
                <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
              </FloatingPortal>
            )}
          </React.Fragment>
        );
      }

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(<App shadowRoot={shadowRoot} />, { container });

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('dismisses when clicking outside a shared shadow root while focus is managed', async () => {
      function App({ shadowRoot }: { shadowRoot: ShadowRoot }) {
        const [isOpen, setIsOpen] = React.useState(true);

        const { context, refs } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss(context);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {isOpen && (
              <FloatingPortal container={shadowRoot}>
                <FloatingFocusManager context={context}>
                  <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                </FloatingFocusManager>
              </FloatingPortal>
            )}
          </React.Fragment>
        );
      }

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        render(<App shadowRoot={shadowRoot} />, { container });
        await flushMicrotasks();

        await userEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    test('outsidePress not ignored for nested floating elements', async () => {
      function Popover({
        children,
        id,
        modal,
      }: {
        children?: React.ReactNode;
        id: string;
        modal?: boolean | null;
      }) {
        const [isOpen, setIsOpen] = React.useState(true);

        const { context, refs } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

        const dialogJsx = (
          <div role="dialog" data-testid={id} {...getFloatingProps({ ref: refs.setFloating })}>
            {children}
          </div>
        );

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {isOpen && (
              <React.Fragment>
                {modal == null ? (
                  dialogJsx
                ) : (
                  <FloatingFocusManager context={context} modal={modal}>
                    {dialogJsx}
                  </FloatingFocusManager>
                )}
              </React.Fragment>
            )}
          </React.Fragment>
        );
      }

      function App({ modal }: { modal: [boolean, boolean] | null }) {
        return (
          <Popover id="popover-1" modal={modal ? modal[0] : true}>
            <Popover id="popover-2" modal={modal ? modal[1] : null} />
          </Popover>
        );
      }

      const { unmount } = render(<App modal={[true, true]} />);
      await flushMicrotasks();

      let popover1 = screen.getByTestId('popover-1');
      let popover2 = screen.getByTestId('popover-2');
      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount();

      const { unmount: unmount2 } = render(<App modal={[true, false]} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount2();

      const { unmount: unmount3 } = render(<App modal={[false, true]} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();

      unmount3();

      render(<App modal={null} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await userEvent.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await userEvent.click(popover1);
      expect(popover2).not.toBeInTheDocument();
    });
  });

  describe('options set to false', () => {
    test('does not dismiss with escape key', async () => {
      render(<App escapeKey={false} />);
      fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('does not dismiss with outside press', async () => {
      render(<App outsidePress={false} />);
      await userEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss with reference pointer down', async () => {
      render(<App referencePress={() => false} />);
      await userEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    test('does not dismiss when clicking portaled children', async () => {
      function App() {
        const [open, setOpen] = React.useState(true);
        const { refs, context } = useFloating({
          open,
          onOpenChange: setOpen,
        });

        const { getReferenceProps, getFloatingProps } = useTestInteractions([useDismiss(context)]);

        return (
          <React.Fragment>
            <button ref={refs.setReference} {...getReferenceProps()} />
            {open && (
              <div ref={refs.setFloating} {...getFloatingProps()}>
                <FloatingPortal>
                  <button data-testid="portaled-button" />
                </FloatingPortal>
              </div>
            )}
          </React.Fragment>
        );
      }

      render(<App />);

      fireEvent.pointerDown(screen.getByTestId('portaled-button'), {
        bubbles: true,
      });
      await flushMicrotasks();

      expect(screen.getByTestId('portaled-button')).toBeInTheDocument();
    });

    test('outsidePress function guard', async () => {
      render(<App outsidePress={() => true} />);
      await userEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('prop: bubbles', () => {
    function Dialog({
      testId,
      children,
      ...props
    }: UseDismissProps & { testId: string; children: React.ReactNode }) {
      const [open, setOpen] = React.useState(true);
      const nodeId = useFloatingNodeId();

      const { refs, context } = useFloating({
        open,
        onOpenChange: setOpen,
        nodeId,
      });

      const { getReferenceProps, getFloatingProps } = useTestInteractions([
        useDismiss(context, props),
      ]);

      return (
        <FloatingNode id={nodeId}>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          {open && (
            <FloatingFocusManager context={context}>
              <div {...getFloatingProps({ ref: refs.setFloating })} data-testid={testId}>
                {children}
              </div>
            </FloatingFocusManager>
          )}
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { testId: string; children: React.ReactNode }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp();

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
          normalizeProp(false);

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(
          {},
        );

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ escapeKey: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          escapeKey: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });
    });

    describe('prop: bubbles.outsidePress', () => {
      test('when true', async () => {
        render(
          <NestedDialog testId="outer">
            <NestedDialog testId="inner">
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(
          <NestedDialog testId="outer" bubbles={{ outsidePress: false }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(
          <NestedDialog testId="outer" bubbles={{ outsidePress: true }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: bubbles.escapeKey', () => {
      test('without FloatingTree', async () => {
        function App() {
          const [popoverOpen, setPopoverOpen] = React.useState(true);
          const [tooltipOpen, setTooltipOpen] = React.useState(false);

          const popover = useFloating({
            open: popoverOpen,
            onOpenChange: setPopoverOpen,
          });
          const tooltip = useFloating({
            open: tooltipOpen,
            onOpenChange: setTooltipOpen,
          });

          const popoverInteractions = useTestInteractions([useDismiss(popover.context)]);
          const tooltipInteractions = useTestInteractions([
            useFocus(tooltip.context),
            useDismiss(tooltip.context),
          ]);

          return (
            <React.Fragment>
              <button
                ref={popover.refs.setReference}
                {...popoverInteractions.getReferenceProps()}
              />
              {popoverOpen && (
                <div
                  role="dialog"
                  ref={popover.refs.setFloating}
                  {...popoverInteractions.getFloatingProps()}
                >
                  <button
                    data-testid="focus-button"
                    ref={tooltip.refs.setReference}
                    {...tooltipInteractions.getReferenceProps()}
                  />
                </div>
              )}
              {tooltipOpen && (
                <div
                  role="tooltip"
                  ref={tooltip.refs.setFloating}
                  {...tooltipInteractions.getFloatingProps()}
                />
              )}
            </React.Fragment>
          );
        }

        render(<App />);

        await flushMicrotasks();
        await act(async () => {
          screen.getByTestId('focus-button').focus();
        });

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        await userEvent.keyboard('{Escape}');

        await waitFor(() => {
          expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        });
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      test('when true', async () => {
        render(
          <NestedDialog testId="outer" bubbles>
            <NestedDialog testId="inner" bubbles>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('when false', async () => {
        render(
          <NestedDialog testId="outer" bubbles={{ escapeKey: false }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      test('mixed', async () => {
        render(
          <NestedDialog testId="outer" bubbles={{ escapeKey: true }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await userEvent.keyboard('{Escape}');

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: capture', () => {
    describe('normalizeProp', () => {
      test('undefined', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp();

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('{}', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(
          {},
        );

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      test('when true', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(true);

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('when false', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(false);

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });

      test('{ escapeKey: true }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          escapeKey: true,
        });

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      test('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });
    });

    function Overlay({ children }: { children: React.ReactNode }) {
      return (
        <div
          style={{ width: '100vw', height: '100vh' }}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
            }
          }}
        >
          <span>outside</span>
          {children}
        </div>
      );
    }

    function Dialog({
      id,
      children,
      ...props
    }: UseDismissProps & { id: string; children: React.ReactNode }) {
      const [open, setOpen] = React.useState(true);
      const nodeId = useFloatingNodeId();

      const { refs, context } = useFloating({
        open,
        onOpenChange: setOpen,
        nodeId,
      });

      const { getReferenceProps, getFloatingProps } = useTestInteractions([
        useDismiss(context, props),
      ]);

      return (
        <FloatingNode id={nodeId}>
          <button {...getReferenceProps({ ref: refs.setReference })} />
          {open && (
            <FloatingPortal>
              <FloatingFocusManager context={context}>
                <div {...getFloatingProps({ ref: refs.setFloating })}>
                  <span>{id}</span>
                  {children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          )}
        </FloatingNode>
      );
    }

    function NestedDialog(props: UseDismissProps & { id: string; children: React.ReactNode }) {
      const parentId = useFloatingParentNodeId();

      if (parentId == null) {
        return (
          <FloatingTree>
            <Dialog {...props} />
          </FloatingTree>
        );
      }

      return <Dialog {...props} />;
    }

    describe('prop: capture.outsidePress', () => {
      test('when true', async () => {
        const user = userEvent.setup();

        render(
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>,
        );

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.click(screen.getByText('outer'));

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.click(screen.getByText('outside'));

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: capture.escapeKey', () => {
      test('when false', async () => {
        const user = userEvent.setup();

        render(
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner">{null}</NestedDialog>
            </NestedDialog>
          </Overlay>,
        );

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('outsidePressEvent: intentional', () => {
    test('dragging outside the floating element does not close', async () => {
      render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging inside the floating element does not close', async () => {
      render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(document.body);
      fireEvent.mouseUp(floatingEl);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    test('dragging outside the floating element then clicking outside closes', async () => {
      render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);
      // A click event will have fired before the proper outside click.
      fireEvent.click(document.body);
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click then programmatic outside click closes', async () => {
      render(<App outsidePressEvent="intentional" />);
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(insideInput);
      fireEvent.mouseUp(insideInput);
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('inside click after drag does not cause immediate close on first outside click', async () => {
      render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      const insideInput = screen.getByRole('textbox');

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(document.body);

      // Inside clicks should never dismiss, and they should not consume the
      // one-shot outside click suppression from the drag that started inside.
      fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // First true outside click after that drag is still ignored once.
      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next outside click is a deliberate outside press and dismisses.
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('drag ending on outsidePress-ignored target does not consume next outside click', async () => {
      render(
        <App
          outsidePressEvent="intentional"
          outsidePress={(event) => !(event.target as Element)?.closest('[data-testid="ignore"]')}
        />,
      );
      const floatingEl = screen.getByRole('tooltip');
      const ignored = document.createElement('div');
      ignored.setAttribute('data-testid', 'ignore');
      document.body.append(ignored);

      fireEvent.mouseDown(floatingEl);
      fireEvent.mouseUp(ignored);

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press start prevented inside does not require double outside click', async () => {
      function AppWithPreventedPressStart() {
        const [open, setOpen] = React.useState(true);
        const { refs, context } = useFloating({ open, onOpenChange: setOpen });
        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          useDismiss(context, { outsidePressEvent: 'intentional' }),
        ]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open && (
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                <div data-testid="scrubber" onPointerDown={(event) => event.preventDefault()} />
              </div>
            )}
          </React.Fragment>
        );
      }

      render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      // Wait a tick: if no immediate synthetic click occurred after pointerup,
      // the next user click should still dismiss.
      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(document.body, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });
      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('press start prevented inside suppresses only immediate outside click', async () => {
      function AppWithPreventedPressStart() {
        const [open, setOpen] = React.useState(true);
        const { refs, context } = useFloating({ open, onOpenChange: setOpen });
        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          useDismiss(context, { outsidePressEvent: 'intentional' }),
        ]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open && (
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                <div data-testid="scrubber" onPointerDown={(event) => event.preventDefault()} />
              </div>
            )}
          </React.Fragment>
        );
      }

      render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseUp(document.body, { button: 0 });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    test('pointercancel after prevented press start suppresses immediate outside click', async () => {
      function AppWithPreventedPressStart() {
        const [open, setOpen] = React.useState(true);
        const { refs, context } = useFloating({ open, onOpenChange: setOpen });
        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          useDismiss(context, { outsidePressEvent: 'intentional' }),
        ]);

        return (
          <React.Fragment>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open && (
              <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                <div data-testid="scrubber" onPointerDown={(event) => event.preventDefault()} />
              </div>
            )}
          </React.Fragment>
        );
      }

      render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      fireEvent.mouseDown(scrubber, { button: 0 });
      fireEvent.pointerCancel(document.body, { pointerType: 'mouse' });

      fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 0);
        });
      });

      fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  test('nested floating elements with different portal containers', async () => {
    function ButtonWithFloating({
      children,
      portalContainer,
      triggerText,
    }: {
      children?: React.ReactNode;
      portalContainer?: HTMLElement | null;
      triggerText: string;
    }) {
      const [open, setOpen] = React.useState(false);
      const { refs, floatingStyles, context } = useFloating({
        open,
        onOpenChange: setOpen,
      });

      const click = useClick(context);
      const dismiss = useDismiss(context);

      const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

      return (
        <React.Fragment>
          <button ref={refs.setReference} {...getReferenceProps()}>
            {triggerText}
          </button>
          {open && (
            <FloatingPortal container={portalContainer}>
              <FloatingFocusManager context={context} modal={false}>
                <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
                  {children}
                </div>
              </FloatingFocusManager>
            </FloatingPortal>
          )}
        </React.Fragment>
      );
    }

    function App() {
      const [otherContainer, setOtherContainer] = React.useState<HTMLDivElement | null>();

      const portal1 = undefined;
      const portal2 = otherContainer;

      return (
        <React.Fragment>
          <ButtonWithFloating portalContainer={portal1} triggerText="open 1">
            <ButtonWithFloating portalContainer={portal2} triggerText="open 2">
              <button>nested</button>
            </ButtonWithFloating>
          </ButtonWithFloating>
          <div ref={setOtherContainer} />
        </React.Fragment>
      );
    }

    render(<App />);

    await userEvent.click(screen.getByText('open 1'));
    expect(screen.getByText('open 2')).toBeInTheDocument();

    await userEvent.click(screen.getByText('open 2'));
    await flushMicrotasks();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });
});
