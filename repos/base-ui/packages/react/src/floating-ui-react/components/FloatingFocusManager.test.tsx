import { test, vi, expect } from 'vitest';
/* eslint-disable jsx-a11y/role-has-required-aria-props */
/* eslint-disable no-promise-executor-return */
/* eslint-disable react/function-component-definition */

/* eslint-disable react/jsx-fragments */
import userEvent from '@testing-library/user-event';
import {
  flushMicrotasks,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@mui/internal-test-utils';
import * as React from 'react';
import * as ReactDOMClient from 'react-dom/client';
import { isJSDOM, useTestInteractions } from '#test-utils';
import {
  FloatingFocusManager,
  FloatingNode,
  FloatingPortal,
  FloatingTree,
  useClick,
  useDismiss,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
  useHover,
} from '../index';
import type { FloatingFocusManagerProps } from './FloatingFocusManager';
import { Main as Navigation } from '../../../test/floating-ui-tests/Navigation';

// TODO (@Janpot) It looks like the toHaveFocus assertion from @mui/internal-test-utils
// is not working correctly with iframes and nested documents. Helper as a workaround
// until fixed.
function isFocused(element: Element): boolean {
  let doc = element.ownerDocument;
  let current: Element = element;

  while (doc) {
    if (doc.activeElement !== current) {
      return false;
    }

    // Move up to the parent document
    const frame = doc.defaultView?.frameElement; // the <iframe> hosting this doc
    if (!frame) {
      return true;
    }

    current = frame;
    doc = frame.ownerDocument;
  }

  return true;
}

beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );

  Object.defineProperty(HTMLElement.prototype, 'inert', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: true,
  });
});

function App(
  props: Partial<
    Omit<FloatingFocusManagerProps, 'initialFocus'> & {
      initialFocus?: 'two' | boolean;
    }
  >,
) {
  const ref = React.useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open)} />
      {open && (
        <FloatingFocusManager
          {...props}
          initialFocus={props.initialFocus === 'two' ? ref : props.initialFocus}
          context={context}
        >
          <div role="dialog" ref={refs.setFloating} data-testid="floating">
            <button data-testid="one">close</button>
            <button data-testid="two" ref={ref}>
              confirm
            </button>
            <button data-testid="three" onClick={() => setOpen(false)}>
              x
            </button>
            {props.children}
          </div>
        </FloatingFocusManager>
      )}
      <div tabIndex={0} data-testid="last">
        outside
      </div>
    </>
  );
}

function RadioApp() {
  const [open, setOpen] = React.useState(false);
  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
  });

  return (
    <>
      <button data-testid="reference" ref={refs.setReference} onClick={() => setOpen(!open)} />
      {open && (
        <FloatingFocusManager context={context}>
          <div role="dialog" ref={refs.setFloating}>
            <input type="radio" name="group" data-testid="radio-one" />
            <input type="radio" name="group" defaultChecked data-testid="radio-two" />
            <button data-testid="after-radio">after</button>
          </div>
        </FloatingFocusManager>
      )}
    </>
  );
}

interface DialogProps {
  open?: boolean;
  render: (props: { close: () => void }) => React.ReactNode;
  children: React.JSX.Element;
}

function Dialog({ render, open: passedOpen = false, children }: DialogProps) {
  const [open, setOpen] = React.useState(passedOpen);
  const nodeId = useFloatingNodeId();

  const { refs, context } = useFloating({
    open,
    onOpenChange: setOpen,
    nodeId,
  });

  const { getReferenceProps, getFloatingProps } = useTestInteractions([
    useClick(context),
    useDismiss(context, { bubbles: false }),
  ]);

  return (
    <FloatingNode id={nodeId}>
      {React.cloneElement(
        children,
        getReferenceProps({ ref: refs.setReference, ...children.props }),
      )}
      <FloatingPortal>
        {open && (
          <FloatingFocusManager context={context}>
            <div {...getFloatingProps({ ref: refs.setFloating })}>
              {render({
                close: () => setOpen(false),
              })}
            </div>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </FloatingNode>
  );
}

describe('FloatingFocusManager', () => {
  describe.skipIf(!isJSDOM)('JSDOM-only coverage', () => {
    describe('prop: initialFocus', () => {
      test('default behavior focuses first tabbable element', async () => {
        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('default behavior focuses the checked radio in a named group', async () => {
        render(<RadioApp />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('radio-two')).toHaveFocus();
      });

      test('ref', async () => {
        render(<App initialFocus="two" />);
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('two')).toHaveFocus();
      });

      test('respects autoFocus', async () => {
        render(
          <App>
            <input autoFocus data-testid="input" />
          </App>,
        );
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveFocus();
      });
    });

    describe('prop: returnFocus', () => {
      test('when true', async () => {
        const { rerender } = render(<App />);

        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        act(() => screen.getByTestId('two').focus());

        rerender(<App returnFocus={false} />);

        expect(screen.getByTestId('two')).toHaveFocus();

        fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('when false', async () => {
        render(<App returnFocus={false} />);

        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('ref', async () => {
        function Test() {
          const ref = React.useRef<HTMLInputElement | null>(null);
          return (
            <div>
              <input />
              <input data-testid="focus-target" ref={ref} />
              <input />
              <App returnFocus={ref} />
            </div>
          );
        }

        render(<Test />);
        screen.getByTestId('reference').focus();
        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('three'));
        await flushMicrotasks();
        expect(screen.getByTestId('focus-target')).toHaveFocus();
      });

      test('always returns to the reference for nested elements', async () => {
        const NestedDialog: React.FC<DialogProps> = (props) => {
          const parentId = useFloatingParentNodeId();

          if (parentId == null) {
            return (
              <FloatingTree>
                <Dialog {...props} />
              </FloatingTree>
            );
          }

          return <Dialog {...props} />;
        };

        render(
          <NestedDialog
            render={({ close }) => (
              <>
                <NestedDialog
                  render={({ close }) => (
                    <button onClick={close} data-testid="close-nested-dialog" />
                  )}
                >
                  <button data-testid="open-nested-dialog" />
                </NestedDialog>
                <button onClick={close} data-testid="close-dialog" />
              </>
            )}
          >
            <button data-testid="open-dialog" />
          </NestedDialog>,
        );

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-nested-dialog')).not.toBeInTheDocument();

        fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();
      });

      test('return to the first focusable descendent of the reference, if the reference is not focusable', async () => {
        render(
          <Dialog render={({ close }) => <button onClick={close} data-testid="close-dialog" />}>
            <div data-testid="non-focusable-reference">
              <button data-testid="open-dialog" />
            </div>
          </Dialog>,
        );
        screen.getByTestId('open-dialog').focus();
        await userEvent.keyboard('{Enter}');

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();

        await userEvent.keyboard('{Esc}');

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('open-dialog')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (modal)', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const [removed, setRemoved] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          const click = useClick(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return (
            <>
              {!removed && (
                <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
              )}
              {isOpen && (
                <FloatingPortal>
                  <FloatingFocusManager context={context}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button
                        data-testid="remove"
                        onClick={() => {
                          setRemoved(true);
                          setIsOpen(false);
                        }}
                      >
                        remove
                      </button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              )}
              <button data-testid="fallback" />
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await userEvent.tab();

        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (non-modal)', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const [removed, setRemoved] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          const click = useClick(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return (
            <>
              {!removed && (
                <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
              )}
              {isOpen && (
                <FloatingPortal>
                  <FloatingFocusManager context={context} modal={false}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button
                        data-testid="remove"
                        onClick={() => {
                          setRemoved(true);
                          setIsOpen(false);
                        }}
                      >
                        remove
                      </button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              )}
              <button data-testid="fallback" />
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await userEvent.tab();

        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test.skipIf(!isJSDOM)(
        'does not return focus to reference on outside press when preventScroll is not supported',
        async () => {
          function App() {
            const [isOpen, setIsOpen] = React.useState(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setIsOpen,
            });

            const click = useClick(context);
            const dismiss = useDismiss(context);

            const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

            return (
              <>
                <button ref={refs.setReference} {...getReferenceProps()}>
                  reference
                </button>
                {isOpen && (
                  <FloatingFocusManager context={context}>
                    <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
                  </FloatingFocusManager>
                )}
              </>
            );
          }

          render(<App />);

          await userEvent.click(screen.getByText('reference'));
          await flushMicrotasks();

          expect(screen.getByTestId('floating')).toHaveFocus();

          await userEvent.click(document.body);
          await flushMicrotasks();

          expect(screen.getByText('reference')).not.toHaveFocus();
        },
      );

      test('returns focus to reference on outside press when preventScroll is supported', async () => {
        const originalFocus = HTMLElement.prototype.focus;
        Object.defineProperty(HTMLElement.prototype, 'focus', {
          configurable: true,
          writable: true,
          value(options: any) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            options && options.preventScroll;
            return originalFocus.call(this, options);
          },
        });

        function App() {
          const [isOpen, setIsOpen] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          const click = useClick(context);
          const dismiss = useDismiss(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

          return (
            <>
              <button ref={refs.setReference} {...getReferenceProps()}>
                reference
              </button>
              {isOpen && (
                <FloatingFocusManager context={context}>
                  <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByText('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        await userEvent.click(document.body);
        await flushMicrotasks();

        expect(screen.getByText('reference')).toHaveFocus();

        HTMLElement.prototype.focus = originalFocus;
      });

      test('does not insert fallback element when return element is falsy', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);

          const { refs, context } = useFloating({ open: isOpen, onOpenChange: setIsOpen });

          const click = useClick(context);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingPortal>
                {isOpen && (
                  <FloatingFocusManager context={context} returnFocus={() => undefined}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button data-testid="close" onClick={() => setIsOpen(false)} />
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
            </>
          );
        }

        render(<App />);

        const reference = screen.getByTestId('reference');
        await userEvent.click(reference);
        await flushMicrotasks();

        expect(reference.nextElementSibling).toBeNull();

        await userEvent.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.queryByTestId('close')).toBeNull();
        });

        expect(reference.nextElementSibling).toBeNull();
      });
    });

    describe('iframe focus navigation', () => {
      function App({ iframe }: { iframe: HTMLElement }) {
        return (
          <div>
            <a href="#">prev iframe link</a>
            <Popover
              portalRef={iframe}
              render={() => (
                <div data-testid="popover">
                  <a href="#">popover link 1</a>
                  <a href="#">popover link 2</a>
                </div>
              )}
            >
              <button>Open</button>
            </Popover>
            <a href="#">next iframe link</a>
          </div>
        );
      }

      function Popover({
        children,
        render,
        portalRef,
      }: {
        children: React.ReactElement;
        render: () => React.ReactNode;
        portalRef?: HTMLElement;
      }) {
        const [open, setOpen] = React.useState(false);

        const { floatingStyles, refs, context } = useFloating({
          open,
          onOpenChange: setOpen,
        });

        const click = useClick(context);
        const dismiss = useDismiss(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

        return (
          <>
            {React.cloneElement(children, getReferenceProps({ ref: refs.setReference }))}
            {open && (
              <FloatingPortal container={portalRef}>
                <FloatingFocusManager context={context} modal={false}>
                  <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
                    {render()}
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            )}
          </>
        );
      }

      function IframeApp() {
        React.useEffect(() => {
          function createIframe() {
            const innerRoot = document.querySelector('#innerRoot');
            const iframe = document.createElement('iframe');
            iframe.setAttribute('data-testid', 'iframe');
            iframe.src = 'about:blank';
            iframe.style.height = '300px';

            innerRoot?.appendChild(iframe);

            // Properly open, write, and close the iframe document.
            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
              iframeDoc.open();
              iframeDoc.write(`<div id="rootIframe"></div>`);
              iframeDoc.close();
            }

            const rootIframe = iframe.contentWindow?.document.getElementById('rootIframe');
            return rootIframe;
          }

          const root = createIframe();
          if (root) {
            ReactDOMClient.createRoot(root).render(<App iframe={root} />);
          }
        }, []);

        return (
          <>
            <a href="#">Outside link 1</a>
            <div id="innerRoot" />
            <a href="#">Outside link 2</a>
          </>
        );
      }

      /* eslint-disable testing-library/prefer-screen-queries */
      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/facebook/react/pull/32441
      test.skipIf(!isJSDOM)('tabs from the popover to the next element in the iframe', async () => {
        render(<IframeApp />);

        const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

        const user = userEvent.setup({ document: iframeDoc });

        await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

        expect(iframeWithin.getByTestId('popover')).toBeInTheDocument();

        await user.tab();
        await user.tab();

        expect(isFocused(iframeWithin.getByText('next iframe link'))).toBe(true);
      });

      // "Should not already be working"(?) when trying to click within the iframe
      // https://github.com/facebook/react/pull/32441
      test.skipIf(!isJSDOM)(
        'shift+tab from the popover to the previous element in the iframe',
        async () => {
          render(<IframeApp />);

          const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

          const user = userEvent.setup({ document: iframeDoc });

          await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

          expect(iframeWithin.getByTestId('popover')).toBeInTheDocument();

          await user.tab({ shift: true });

          expect(isFocused(iframeWithin.getByRole('button', { name: 'Open' }))).toBe(true);
        },
      );
    });
    /* eslint-enable testing-library/prefer-screen-queries */

    describe('prop: modal', () => {
      test('when true', async () => {
        render(<App modal />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('one')).toHaveFocus();

        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('when false', async () => {
        render(<App modal={false} />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await userEvent.tab();

        // Wait for the setTimeout that wraps onOpenChange(false).
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        // Focus leaving the floating element closes it.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('closeOnFocusOut: false keeps a non-modal element open when focus leaves', async () => {
        render(<App modal={false} closeOnFocusOut={false} />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await userEvent.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        // Move focus out of the floating element entirely.
        await userEvent.tab();

        // Wait for the (potential) setTimeout that wraps onOpenChange(false).
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        // With `closeOnFocusOut={false}`, focus leaving the floating element does not close it.
        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('clicking a nested click trigger does not suppress the next focus-out close', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              {open && (
                <FloatingFocusManager context={context} modal={false}>
                  <div role="dialog" ref={refs.setFloating} data-testid="floating">
                    <button data-base-ui-click-trigger="" data-testid="nested-trigger" />
                  </div>
                </FloatingFocusManager>
              )}
              <button data-testid="last" />
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.click(screen.getByTestId('nested-trigger'));
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        await userEvent.tab();
        await act(() => new Promise((resolve) => setTimeout(resolve)));

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('false - comboboxes do not hide all other nodes', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
          });

          return (
            <>
              <input
                role="combobox"
                data-testid="reference"
                ref={refs.setReference}
                onFocus={() => setOpen(true)}
              />
              <button data-testid="btn-1" />
              <button data-testid="btn-2" />
              {open && (
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.focus(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
      });

      test('fallback to floating element when it has no tabbable content', async () => {
        function App() {
          const { refs, context } = useFloating({ open: true });
          return (
            <>
              <button data-testid="reference" ref={refs.setReference} />
              <FloatingFocusManager context={context} modal>
                <div ref={refs.setFloating} data-testid="floating" tabIndex={-1} />
              </FloatingFocusManager>
            </>
          );
        }

        render(<App />);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
        await userEvent.tab();
        expect(screen.getByTestId('floating')).toHaveFocus();
        await userEvent.tab({ shift: true });
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('mixed modality and nesting', async () => {
        interface Props {
          open?: boolean;
          modal?: boolean;
          render: (props: { close: () => void }) => React.ReactNode;
          children?: React.JSX.Element;
          sideChildren?: React.JSX.Element;
        }

        const Dialog = ({
          render,
          open: controlledOpen,
          modal = true,
          children,
          sideChildren,
        }: Props) => {
          const [internalOpen, setOpen] = React.useState(false);
          const nodeId = useFloatingNodeId();
          const open = controlledOpen !== undefined ? controlledOpen : internalOpen;

          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
            nodeId,
          });

          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useClick(context),
            useDismiss(context, { bubbles: false }),
          ]);

          return (
            <FloatingNode id={nodeId}>
              {children &&
                React.cloneElement(
                  children,
                  getReferenceProps({ ref: refs.setReference, ...children.props }),
                )}
              <FloatingPortal>
                {open && (
                  <FloatingFocusManager context={context} modal={modal}>
                    <div {...getFloatingProps({ ref: refs.setFloating })}>
                      {render({
                        close: () => setOpen(false),
                      })}
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
              {sideChildren}
            </FloatingNode>
          );
        };

        const NestedDialog: React.FC<Props> = (props) => {
          const parentId = useFloatingParentNodeId();

          if (parentId == null) {
            return (
              <FloatingTree>
                <Dialog {...props} />
              </FloatingTree>
            );
          }

          return <Dialog {...props} />;
        };

        const App = () => {
          const [sideDialogOpen, setSideDialogOpen] = React.useState(false);
          return (
            <NestedDialog
              modal={false}
              render={({ close }) => (
                <>
                  <button onClick={close} data-testid="close-dialog" />
                  <button
                    onClick={() => setSideDialogOpen(true)}
                    data-testid="open-nested-dialog"
                  />
                </>
              )}
              sideChildren={
                <NestedDialog
                  modal
                  open={sideDialogOpen}
                  render={({ close }) => (
                    <button onClick={close} data-testid="close-nested-dialog" />
                  )}
                />
              }
            >
              <button data-testid="open-dialog" />
            </NestedDialog>
          );
        };

        render(<App />);

        await userEvent.click(screen.getByTestId('open-dialog'));
        await userEvent.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();
      });

      test('true - applies aria-hidden to outside nodes', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              {isOpen && (
                <FloatingFocusManager context={context}>
                  <div ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden');
      });

      test('true - keeps supplied inside elements outside the floating node exposed to assistive tech', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const dismissRef = React.useRef<HTMLButtonElement | null>(null);
          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <button data-testid="outside-button" />
              </div>
              {isOpen && (
                <FloatingFocusManager
                  context={context}
                  getInsideElements={() => [dismissRef.current]}
                >
                  <>
                    <div ref={refs.setFloating} data-testid="floating" />
                    <button ref={dismissRef} data-testid="dismiss" />
                  </>
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('dismiss')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('aria-hidden', 'true');
      });

      test('false - does not apply inert to outside nodes', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <input
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <div data-testid="outside-wrapper">
                <div data-testid="aria-live" aria-live="polite" />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
              </div>
              {isOpen && (
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('reference')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('false - keeps marker on top-level outside ancestor when reference has siblings', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <div data-testid="outside-wrapper">
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => setIsOpen((v) => !v)}
                />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
                <div data-testid="nested-wrapper">
                  <button data-testid="nested-btn" />
                </div>
              </div>
              <div data-testid="outside-sibling" />
              {isOpen && (
                <FloatingFocusManager context={context} modal={false}>
                  <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('outside-sibling')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-base-ui-inert');
      });
    });

    describe('prop: disabled', () => {
      test('true -> false', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const [disabled, setDisabled] = React.useState(true);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          return (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setIsOpen((v) => !v)}
              />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              {isOpen && (
                <FloatingFocusManager context={context} disabled={disabled}>
                  <div ref={refs.setFloating} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).not.toHaveFocus();
        fireEvent.click(screen.getByTestId('toggle'));
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
      });

      test('when false', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);
          const [disabled, setDisabled] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          const click = useClick(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <button data-testid="toggle" onClick={() => setDisabled((v) => !v)} />
              {isOpen && (
                <FloatingFocusManager context={context} disabled={disabled}>
                  <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()} />
                </FloatingFocusManager>
              )}
            </>
          );
        }

        render(<App />);

        fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('supports keepMounted behavior', async () => {
        function App() {
          const [isOpen, setIsOpen] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          const click = useClick(context);
          const dismiss = useDismiss(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

          return (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingFocusManager context={context} disabled={!isOpen} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                  <button data-testid="child" />
                </div>
              </FloatingFocusManager>
              <button data-testid="after" />
            </>
          );
        }

        render(<App />);

        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveFocus();

        fireEvent.click(screen.getByTestId('reference'));

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await userEvent.tab();

        expect(screen.getByTestId('after')).toHaveFocus();

        await userEvent.tab({ shift: true });

        fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('child')).toHaveFocus();

        await userEvent.keyboard('{Escape}');

        expect(screen.getByTestId('reference')).toHaveFocus();
      });

      test('clears outside pointer state between keep-mounted open sessions', async () => {
        let readInsideReactTree = () => false;

        function App() {
          const [isOpen, setIsOpen] = React.useState(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setIsOpen,
          });

          readInsideReactTree = () => context.dataRef.current.insideReactTree;

          const click = useClick(context);
          const dismiss = useDismiss(context);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

          return (
            <>
              <span data-testid="open-state">{String(isOpen)}</span>
              <button data-testid="before" />
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              <FloatingPortal>
                <FloatingFocusManager context={context} disabled={!isOpen} modal={false}>
                  <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
              <button data-testid="after" />
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fireEvent.pointerDown(screen.getByTestId('after'));
        await flushMicrotasks();

        expect(screen.getByTestId('open-state')).toHaveTextContent('false');

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        fireEvent.focusOut(screen.getByTestId('child'), {
          relatedTarget: screen.getByTestId('after'),
        });

        expect(readInsideReactTree()).toBe(true);
      });
    });

    describe('non-modal + FloatingPortal', () => {
      test('focuses inside element, tabbing out focuses last document element', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
          });

          return (
            <>
              <span tabIndex={0} data-testid="first" />
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <FloatingPortal>
                {open && (
                  <FloatingFocusManager context={context} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabIndex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
              <span tabIndex={0} data-testid="last" />
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('inside')).toHaveFocus();

        await userEvent.tab();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('does not mark reference siblings due to outside focus guards', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
          });

          return (
            <>
              <div data-testid="reference-wrapper">
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => setOpen(true)}
                />
                <span data-testid="reference-sibling-1" />
                <span data-testid="reference-sibling-2" />
              </div>
              <FloatingPortal>
                {open && (
                  <FloatingFocusManager context={context} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabIndex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-1')).not.toHaveAttribute('data-base-ui-inert');
        expect(screen.getByTestId('reference-sibling-2')).not.toHaveAttribute('data-base-ui-inert');
      });

      test('shift+tab', async () => {
        function App() {
          const [open, setOpen] = React.useState(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpen,
          });

          return (
            <>
              <span tabIndex={0} data-testid="first" />
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => setOpen(true)}
              />
              <FloatingPortal>
                {open && (
                  <FloatingFocusManager context={context} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabIndex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
              <span tabIndex={0} data-testid="last" />
            </>
          );
        }

        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await userEvent.tab({ shift: true });

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await userEvent.tab({ shift: true });

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
      });
    });

    describe('Navigation', () => {
      test('does not focus reference when hovering it', async () => {
        render(<Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.getByText('Product')).not.toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by esc key', async () => {
        render(<Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.keyboard('{Escape}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by an explicit close button', async () => {
        render(<Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await userEvent.click(screen.getByText('Close').parentElement!);
        await userEvent.keyboard('{Tab}');
        expect(screen.getByText('Close')).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('does not re-open after closing via escape key', async () => {
        render(<Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.keyboard('{Escape}');
        expect(screen.queryByText('Link 1')).not.toBeInTheDocument();
      });

      test('closes when unhovering floating element even when focus is inside it', async () => {
        render(<Navigation />);
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.click(screen.getByTestId('subnavigation'));
        await userEvent.unhover(screen.getByTestId('subnavigation'));
        await userEvent.hover(screen.getByText('Product'));
        await userEvent.unhover(screen.getByText('Product'));
        expect(screen.queryByTestId('subnavigation')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: restoreFocus', () => {
    function App({ restoreFocus = true }: { restoreFocus?: boolean }) {
      const [isOpen, setIsOpen] = React.useState(false);
      const [removed, setRemoved] = React.useState(false);
      const twoRef = React.useRef<HTMLButtonElement | null>(null);

      const { refs, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
      });

      const click = useClick(context);
      const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

      return (
        <>
          <button onClick={() => setRemoved(true)}>remove</button>
          <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
          {isOpen && (
            <FloatingFocusManager
              context={context}
              restoreFocus={restoreFocus}
              initialFocus={twoRef}
            >
              <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                <button>one</button>
                {!removed && <button ref={twoRef}>two</button>}
                <button>three</button>
              </div>
            </FloatingFocusManager>
          )}
        </>
      );
    }

    test.skipIf(isJSDOM)(
      'true: restores focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(<App />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fireEvent.click(remove);

        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      },
    );

    test.skipIf(isJSDOM)(
      'false: does not restore focus to nearest tabbable element if currently focused element is removed',
      async () => {
        render(<App restoreFocus={false} />);

        await userEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        fireEvent.click(remove);
        await flushMicrotasks();

        await waitFor(() => {
          expect(document.body).toHaveFocus();
        });
      },
    );

    test('restores focus to the nearest tabbable element when the focused element becomes hidden', async () => {
      render(<App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      const two = screen.getByRole('button', { name: 'two' });
      const three = screen.getByRole('button', { name: 'three' });

      expect(two).toHaveFocus();

      document.body.tabIndex = -1;
      two.style.visibility = 'hidden';
      document.body.focus();

      await waitFor(() => {
        expect(three).toHaveFocus();
      });
    });
  });

  describe.skipIf(!isJSDOM)('JSDOM-only coverage', () => {
    test('trapped combobox prevents focus moving outside floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, floatingStyles, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const role = React.useMemo(
          () => ({
            reference: {
              'aria-expanded': isOpen,
              'aria-controls': isOpen ? 'floating' : undefined,
            },
            floating: {
              id: 'floating',
              role: 'listbox' as const,
            },
          }),
          [isOpen],
        );
        const dismiss = useDismiss(context);
        const click = useClick(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([role, dismiss, click]);

        return (
          <div className="App">
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
                  <button>one</button>
                  <button>two</button>
                </div>
              </FloatingFocusManager>
            )}
          </div>
        );
      }

      render(<App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).not.toHaveFocus();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await flushMicrotasks();
    });

    test('untrapped combobox creates non-modal focus management', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, floatingStyles, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const role = React.useMemo(
          () => ({
            reference: {
              'aria-expanded': isOpen,
              'aria-controls': isOpen ? 'floating' : undefined,
            },
            floating: {
              id: 'floating',
              role: 'listbox' as const,
            },
          }),
          [isOpen],
        );
        const dismiss = useDismiss(context);
        const click = useClick(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([role, dismiss, click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            {isOpen && (
              <FloatingPortal>
                <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                  <div ref={refs.setFloating} style={floatingStyles} {...getFloatingProps()}>
                    <button>one</button>
                    <button>two</button>
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            )}
            <button>outside</button>
          </>
        );
      }

      render(<App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    test('returns focus to last connected element', async () => {
      function Drawer({
        open,
        onOpenChange,
      }: {
        open: boolean;
        onOpenChange: (open: boolean) => void;
      }) {
        const { refs, context } = useFloating({ open, onOpenChange });
        const dismiss = useDismiss(context);
        const { getFloatingProps } = useTestInteractions([dismiss]);

        return (
          <FloatingFocusManager context={context}>
            <div ref={refs.setFloating} {...getFloatingProps()}>
              <button data-testid="child-reference" />
            </div>
          </FloatingFocusManager>
        );
      }

      function Parent() {
        const [isOpen, setIsOpen] = React.useState(false);
        const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const dismiss = useDismiss(context);
        const click = useClick(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

        return (
          <>
            <button
              ref={refs.setReference}
              data-testid="parent-reference"
              {...getReferenceProps()}
            />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()}>
                  Parent Floating
                  <button
                    data-testid="parent-floating-reference"
                    onClick={() => {
                      setIsDrawerOpen(true);
                      setIsOpen(false);
                    }}
                  />
                </div>
              </FloatingFocusManager>
            )}
            {isDrawerOpen && <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />}
          </>
        );
      }

      render(<Parent />);
      await userEvent.click(screen.getByTestId('parent-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('parent-floating-reference')).toHaveFocus();
      await userEvent.click(screen.getByTestId('parent-floating-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('child-reference')).toHaveFocus();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByTestId('parent-reference')).toHaveFocus();
    });

    test('focus is placed on element with floating props when floating element is a wrapper', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const role = React.useMemo(
          () => ({
            reference: {
              'aria-haspopup': 'dialog' as const,
              'aria-expanded': isOpen,
              'aria-controls': isOpen ? 'floating' : undefined,
            },
            floating: {
              id: 'floating',
              role: 'dialog' as const,
            },
          }),
          [isOpen],
        );

        const { getReferenceProps, getFloatingProps } = useTestInteractions([role]);

        return (
          <>
            <button
              ref={refs.setReference}
              {...getReferenceProps({
                onClick: () => setIsOpen((v) => !v),
              })}
            />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} data-testid="outer">
                  <div {...getFloatingProps()} data-testid="inner" />
                </div>
              </FloatingFocusManager>
            )}
          </>
        );
      }

      render(<App />);

      await userEvent.click(screen.getByRole('button'));
      await flushMicrotasks();

      expect(screen.getByTestId('inner')).toHaveFocus();
    });

    test('floating element closes upon tabbing out of modal combobox', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const click = useClick(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            {isOpen && (
              <FloatingFocusManager context={context} initialFocus={false}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button tabIndex={-1}>one</button>
                </div>
              </FloatingFocusManager>
            )}
            <button data-testid="after" />
          </>
        );
      }

      render(<App />);
      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await userEvent.tab();
      await flushMicrotasks();
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    test('untrapped typeable combobox closes on second tab sequence (click -> tab -> click -> tab)', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const click = useClick(context);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            {isOpen && (
              <FloatingFocusManager context={context} initialFocus={false} modal>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button tabIndex={-1}>one</button>
                </div>
              </FloatingFocusManager>
            )}
            <button data-testid="after" />
          </>
        );
      }

      render(<App />);

      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();

      await userEvent.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await userEvent.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
    });

    test('focus does not return to reference when floating element is triggered by hover', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const hover = useHover(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([hover]);

        return (
          <>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            )}
          </>
        );
      }

      render(<App />);

      const reference = screen.getByTestId('reference');

      act(() => reference.focus());

      await userEvent.hover(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveFocus();

      await userEvent.unhover(screen.getByTestId('floating'));

      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });

    test('uses aria-hidden instead of inert on outside nodes if opened with hover and modal=true', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const hover = useHover(context);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([hover]);

        return (
          <>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            {isOpen && (
              <FloatingFocusManager context={context}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            )}
            <button>outside</button>
          </>
        );
      }

      render(<App />);

      await userEvent.hover(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByText('outside')).not.toHaveAttribute('inert');
      expect(screen.getByText('outside')).toHaveAttribute('aria-hidden', 'true');
    });

    test('floating element with no focusable elements and no listbox role gets tabIndex=0 when initialFocus is -1', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
            />
            {isOpen && (
              <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog" />
              </FloatingFocusManager>
            )}
          </>
        );
      }

      render(<App />);

      const reference = screen.getByTestId('reference');
      await userEvent.click(reference);
      await flushMicrotasks();
      fireEvent.focusOut(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
    });

    test('floating element with managed tabIndex is downgraded once content becomes tabbable', async () => {
      function App({ hasTabbableContent = false }: { hasTabbableContent?: boolean }) {
        const { refs, context } = useFloating({
          open: true,
          onOpenChange() {},
        });

        return (
          <>
            <button data-testid="reference" ref={refs.setReference} />
            <FloatingFocusManager context={context} initialFocus={false} modal={false}>
              <div ref={refs.setFloating} data-testid="floating" role="dialog">
                {hasTabbableContent && <button data-testid="inside" />}
              </div>
            </FloatingFocusManager>
          </>
        );
      }

      const { rerender } = render(<App />);
      await flushMicrotasks();

      const reference = screen.getByTestId('reference');
      reference.focus();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '0');

      rerender(<App hasTabbableContent />);
      await flushMicrotasks();

      fireEvent.focusOut(reference, { relatedTarget: screen.getByTestId('inside') });
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '-1');
    });

    test('floating element with listbox role ignores tabIndex setting', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const click = useClick(context);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
              {...getReferenceProps()}
            >
              ref
            </button>
            {isOpen && (
              <FloatingFocusManager context={context} initialFocus={false} modal={false}>
                <div
                  ref={refs.setFloating}
                  role="listbox"
                  data-testid="floating"
                  {...getFloatingProps()}
                >
                  floating
                </div>
              </FloatingFocusManager>
            )}
          </>
        );
      }

      render(<App />);
      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
    });

    test('handles manual tabindex on dialog floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        return (
          <>
            <button
              data-testid="reference"
              ref={refs.setReference}
              onClick={() => setIsOpen(true)}
            />
            {isOpen && (
              <FloatingFocusManager context={context} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog" />
              </FloatingFocusManager>
            )}
          </>
        );
      }

      render(<App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('floating')).toHaveFocus();
    });

    test('standard tabbing back and forth of a non-modal floating element', async () => {
      function App() {
        const [isOpen, setIsOpen] = React.useState(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setIsOpen,
        });

        const click = useClick(context);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return (
          <>
            <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
            {isOpen && (
              <FloatingPortal>
                <FloatingFocusManager context={context} modal={false}>
                  <div
                    ref={refs.setFloating}
                    data-testid="floating"
                    role="dialog"
                    {...getFloatingProps()}
                  >
                    <button data-testid="inner">inner</button>
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
            )}
          </>
        );
      }
      render(<App />);

      await userEvent.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('inner')).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('inner')).toHaveFocus();
    });
  });
});
