import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as ReactDOM from 'react-dom';
import { Combobox } from '@base-ui/react/combobox';
import { Drawer } from '@base-ui/react/drawer';
import { Slider } from '@base-ui/react/slider';
import { act, fireEvent, flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Drawer.Viewport />', () => {
  beforeAll(function beforeHook() {
    // PointerEvent not fully implemented in jsdom, causing fireEvent.pointer* to ignore options.
    // https://github.com/jsdom/jsdom/issues/2527
    (window as any).PointerEvent = window.MouseEvent;
  });

  const { render } = createRenderer();

  describeConformance(<Drawer.Viewport />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Drawer.Root open>
          <Drawer.Portal>{node}</Drawer.Portal>
        </Drawer.Root>,
      );
    },
  }));

  function createTouch(target: EventTarget, point: { clientX: number; clientY: number }) {
    if (typeof Touch === 'function') {
      return new Touch({
        identifier: 1,
        target,
        ...point,
      });
    }

    return point;
  }

  function createNativeTouchMove(target: EventTarget, point: { clientX: number; clientY: number }) {
    const touchMove = new Event('touchmove', { bubbles: true, cancelable: true });
    Object.defineProperty(touchMove, 'touches', {
      value: [createTouch(target, point)],
      configurable: true,
    });
    return touchMove;
  }

  it('clears text selection on swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(selection.rangeCount).toBe(0);
  });

  it('does not clear text selection on touch swipe start', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>
                <span data-testid="text">Selectable</span>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    expect(text.firstChild).toBeTruthy();

    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);
    expect(selection.isCollapsed).toBe(false);

    const popup = screen.getByTestId('popup');
    const viewport = screen.getByTestId('viewport');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(selection.rangeCount).toBe(1);
  });

  it('starts touch swipes from interactive elements', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('clears the backdrop data-swiping attribute when the drawer unmounts mid-swipe', async () => {
    const { unmount } = await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <button type="button" data-testid="button">
                Action
              </button>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      fireEvent.touchStart(button, {
        touches: [createTouch(button, { clientX: 0, clientY: 0 })],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    await act(async () => {
      unmount();
    });

    // The detached node keeps its attributes, so this asserts the cleanup removed
    // `data-swiping` from the backdrop that was mounted while swiping.
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('uses the event target for non-keyboard touch scroll arbitration', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <button type="button" data-testid="button">
                  Action
                </button>
                <div style={{ height: 120 }} />
              </div>
              <div data-testid="other-scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }} />
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const scroll = screen.getByTestId('scroll');
    const otherScroll = screen.getByTestId('other-scroll');
    const backdrop = screen.getByTestId('backdrop');

    Object.defineProperty(scroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;
    Object.defineProperty(otherScroll, 'scrollHeight', { value: 160, configurable: true });
    Object.defineProperty(otherScroll, 'clientHeight', { value: 40, configurable: true });
    otherScroll.scrollTop = 40;

    const originalElementFromPoint = document.elementFromPoint;
    let hitTestCount = 0;
    document.elementFromPoint = () => {
      hitTestCount += 1;
      return hitTestCount === 1 ? otherScroll : button;
    };

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('allows clicks on non-interactive elements without data-base-ui-swipe-ignore', async () => {
    const handleClick = vi.fn();
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" onClick={handleClick}>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.touchStart(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
      fireEvent.pointerDown(target, { pointerType: 'touch' });
      fireEvent.touchEnd(target, {
        changedTouches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });
      fireEvent.click(target, { detail: 1 });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start touch swipes from elements with data-base-ui-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target" data-base-ui-swipe-ignore>
                  Action
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(target, {
      touches: [
        createTouch(target, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    fireEvent.touchMove(target, {
      touches: [
        createTouch(target, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    fireEvent.touchEnd(target, {
      changedTouches: [
        createTouch(target, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    await flushMicrotasks();

    expect(backdrop).not.toHaveAttribute('data-swiping');
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not prevent native touch scrolling in portaled descendants', async () => {
    const portalContainer = document.createElement('div');
    document.body.append(portalContainer);

    function PortaledPopup() {
      return ReactDOM.createPortal(
        <div data-testid="portaled-popup">Portaled popup</div>,
        portalContainer,
      );
    }

    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>Content</Drawer.Content>
              <PortaledPopup />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const portaledPopup = screen.getByTestId('portaled-popup');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => portaledPopup;

    try {
      fireEvent.touchStart(portaledPopup, {
        touches: [
          createTouch(portaledPopup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(portaledPopup, {
        clientX: 0,
        clientY: 40,
      });
      portaledPopup.dispatchEvent(touchMove);

      expect(touchMove.defaultPrevented).toBe(false);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      portalContainer.remove();
    }
  });

  it.skipIf(isJSDOM)(
    'allows touch gestures on a portaled combobox popup without starting drawer swipe',
    async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Drawer.Root open onOpenChange={handleOpenChange}>
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <Drawer.Content>
                  <Combobox.Root
                    defaultOpen
                    items={[
                      'Apple',
                      'Banana',
                      'Cherry',
                      'Date',
                      'Elderberry',
                      'Fig',
                      'Grape',
                      'Honeydew',
                      'Kiwi',
                      'Lime',
                    ]}
                  >
                    <Combobox.Input />
                    <Combobox.Portal>
                      <Combobox.Positioner>
                        <Combobox.Popup>
                          <Combobox.List style={{ maxHeight: 40, overflow: 'auto' }}>
                            {(item: string) => (
                              <Combobox.Item key={item} value={item}>
                                {item}
                              </Combobox.Item>
                            )}
                          </Combobox.List>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                </Drawer.Content>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const listbox = await screen.findByRole('listbox');
      const backdrop = screen.getByTestId('backdrop');
      await waitFor(() => {
        expect(listbox.scrollHeight).toBeGreaterThan(listbox.clientHeight);
      });
      expect(listbox.scrollHeight).toBeGreaterThan(listbox.clientHeight);

      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => listbox;

      try {
        const rect = listbox.getBoundingClientRect();

        await user.pointer([
          {
            target: listbox,
            coords: {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height - 8,
            },
            keys: '[TouchA>]',
          },
          {
            target: listbox,
            coords: {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
            },
            pointerName: 'TouchA',
          },
          {
            target: listbox,
            coords: {
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + 8,
            },
            pointerName: 'TouchA',
          },
          { keys: '[/TouchA]' },
        ]);

        expect(backdrop).not.toHaveAttribute('data-swiping');
        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(listbox).toBeVisible();
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }
    },
  );

  it('still allows touch swipes from elements with legacy data-swipe-ignore', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <div data-testid="target" data-swipe-ignore>
                Action
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');
    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.touchStart(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(target, {
        touches: [
          createTouch(target, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(target, {
        changedTouches: [
          createTouch(target, {
            clientX: 0,
            clientY: 80,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
    expect(handleOpenChange).not.toHaveBeenCalled();
  });

  it('does not start non-touch swipes from Drawer.Content', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Drawer.Content>
                <div data-testid="target">Action</div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const target = screen.getByTestId('target');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => target;

    try {
      fireEvent.pointerDown(target, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not jump when touch starts outside the popup and then enters it', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (_x, y) => (y < 100 ? viewport : popup);

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 120,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
      expect(Number.parseFloat(popup.style.getPropertyValue('--drawer-swipe-movement-y'))).toBe(0);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('dismisses when touch starts outside the popup, then continues swiping down inside it', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = (_x, y) => (y < 100 ? viewport : popup);

    try {
      fireEvent.touchStart(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 120,
          }),
        ],
      });

      fireEvent.touchMove(viewport, {
        touches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 170,
          }),
        ],
      });

      fireEvent.touchEnd(viewport, {
        changedTouches: [
          createTouch(viewport, {
            clientX: 0,
            clientY: 170,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('treats pen interactions on Drawer.Content as non-touch swipes', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup>
              <Drawer.Content>
                <button type="button" data-testid="button">
                  Action
                </button>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const button = screen.getByTestId('button');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => button;

    try {
      const pointerDownEvent = new Event('pointerdown', {
        bubbles: true,
        cancelable: true,
      }) as PointerEvent;

      Object.defineProperties(pointerDownEvent, {
        button: { value: 0 },
        buttons: { value: 1 },
        pointerId: { value: 1 },
        pointerType: { value: 'pen' },
        clientX: { value: 0 },
        clientY: { value: 0 },
      });

      fireEvent(button, pointerDownEvent);

      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const prevented = fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      expect(prevented).toBe(true);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not mark nested drawers as swiping until movement passes the threshold', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport data-testid="parent-viewport">
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport data-testid="child-viewport">
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
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
    const parentViewport = screen.getByTestId('parent-viewport');
    const childViewport = screen.getByTestId('child-viewport');
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => childPopup;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentViewport).not.toHaveAttribute('data-nested-dialog-open');
      expect(childViewport).not.toHaveAttribute('data-nested-dialog-open');
      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 5,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('clears nested swiping when a nested drawer swipe is reversed before release', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="parent-popup">
              <Drawer.Root open swipeDirection="down">
                <Drawer.Portal>
                  <Drawer.Viewport>
                    <Drawer.Popup data-testid="child-popup">
                      <button type="button" data-testid="child-button">
                        Action
                      </button>
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
    const button = screen.getByTestId('child-button');
    Object.defineProperty(childPopup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => childPopup;

    try {
      fireEvent.touchStart(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 5,
          }),
        ],
      });

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).toHaveAttribute('data-nested-drawer-swiping', '');

      fireEvent.touchMove(button, {
        touches: [
          createTouch(button, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(parentPopup).not.toHaveAttribute('data-nested-drawer-swiping');
      expect(parentPopup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove at scroll top when swiping down on scrollable content', async () => {
    const handleTouchMove = vi.fn();

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchMove={handleTouchMove}
                style={{ overflowY: 'auto', maxHeight: 40 }}
              >
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const prevented = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 10,
        }),
      ],
    });

    expect(prevented).toBe(false);
    expect(handleTouchMove).not.toHaveBeenCalled();
  });

  it('prevents touchmove at scroll bottom when swiping up on scrollable content', async () => {
    await render(
      <Drawer.Root open swipeDirection="up">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 80;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(scroll, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        scroll.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove when a scrollable ancestor wraps the popup at the top', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
              <Drawer.Popup>
                <Drawer.Content>
                  <span data-testid="item">Scrollable content</span>
                </Drawer.Content>
              </Drawer.Popup>
            </div>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    const item = screen.getByTestId('item');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => item;

    try {
      fireEvent.touchStart(item, {
        touches: [
          createTouch(item, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(item, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        item.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('prevents touchmove when there is no scroll container', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <Drawer.Content>Content</Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      const touchMove = createNativeTouchMove(popup, {
        clientX: 0,
        clientY: 10,
      });

      await act(async () => {
        popup.dispatchEvent(touchMove);
        await flushMicrotasks();
      });

      expect(touchMove.defaultPrevented).toBe(true);
      expect(backdrop).toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not block touchmove on native range inputs', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <input type="range" data-testid="range" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const range = screen.getByTestId('range');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(range, {
      touches: [
        createTouch(range, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const dispatched = fireEvent.touchMove(range, {
      touches: [
        createTouch(range, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await waitFor(() => {
      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    });
  });

  it('does not block touchmove on slider thumb range inputs', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <Slider.Root defaultValue={50}>
                <Slider.Control>
                  <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const sliderInput = screen.getByRole('slider');
    const backdrop = screen.getByTestId('backdrop');

    fireEvent.touchStart(sliderInput, {
      touches: [
        createTouch(sliderInput, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const dispatched = fireEvent.touchMove(sliderInput, {
      touches: [
        createTouch(sliderInput, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    expect(dispatched).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start swiping when adjusting input selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <input data-testid="input" defaultValue="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const input = screen.getByTestId('input') as HTMLInputElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    input.focus();
    input.setSelectionRange(0, 5);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await waitFor(() => {
        expect(dispatched).toBe(true);
        expect(backdrop).not.toHaveAttribute('data-swiping');
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start swiping when adjusting textarea selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <textarea data-testid="textarea" defaultValue="Selectable text" />
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    textarea.focus();
    textarea.setSelectionRange(0, 5);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await waitFor(() => {
        expect(dispatched).toBe(true);
        expect(backdrop).not.toHaveAttribute('data-swiping');
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not start swiping when adjusting contenteditable selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div contentEditable suppressContentEditableWarning data-testid="editable">
                Selectable text
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const editable = screen.getByTestId('editable');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(editable.firstChild).toBeTruthy();
    if (!selection || !editable.firstChild) {
      return;
    }

    editable.focus();
    const range = document.createRange();
    range.setStart(editable.firstChild, 0);
    range.setEnd(editable.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await waitFor(() => {
        expect(dispatched).toBe(true);
        expect(backdrop).not.toHaveAttribute('data-swiping');
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      selection.removeAllRanges();
    }
  });

  it('does not start swiping when adjusting regular text selection handles', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <span data-testid="text">Selectable text</span>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const text = screen.getByTestId('text');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');
    const selection = window.getSelection();
    expect(selection).not.toBeNull();
    expect(text.firstChild).toBeTruthy();
    if (!selection || !text.firstChild) {
      return;
    }

    const range = document.createRange();
    range.setStart(text.firstChild, 0);
    range.setEnd(text.firstChild, 5);
    selection.removeAllRanges();
    selection.addRange(range);

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.touchStart(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).not.toHaveAttribute('data-swiping');

      const dispatched = fireEvent.touchMove(popup, {
        touches: [
          createTouch(popup, {
            clientX: 0,
            clientY: 10,
          }),
        ],
      });

      await waitFor(() => {
        expect(dispatched).toBe(true);
        expect(backdrop).not.toHaveAttribute('data-swiping');
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      selection.removeAllRanges();
    }
  });

  it('allows touchmove when scrolling down from scroll top', async () => {
    const handleTouchMove = vi.fn();

    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>
              <div
                data-testid="scroll"
                onTouchMove={handleTouchMove}
                style={{ overflowY: 'auto', maxHeight: 40 }}
              >
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 0,
        }),
      ],
    });

    const prevented = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: -10,
        }),
      ],
    });

    expect(prevented).toBe(true);
    expect(handleTouchMove).toHaveBeenCalledTimes(1);
  });

  it('does not start an opposite-direction swipe from scroll bottom for down drawers with snap points', async () => {
    await render(
      <Drawer.Root open swipeDirection="down" snapPoints={['100px', 1]}>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 80;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 40,
        }),
      ],
    });

    const moveAllowed = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 0,
          clientY: 20,
        }),
      ],
    });

    await flushMicrotasks();

    expect(moveAllowed).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('does not start an opposite-direction swipe from scroll right edge for right drawers', async () => {
    await render(
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowX: 'auto', maxWidth: 40 }}>
                <div style={{ width: 120, height: 40 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
    scroll.scrollLeft = 80;

    fireEvent.touchStart(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 40,
          clientY: 0,
        }),
      ],
    });

    const moveAllowed = fireEvent.touchMove(scroll, {
      touches: [
        createTouch(scroll, {
          clientX: 20,
          clientY: 0,
        }),
      ],
    });

    await flushMicrotasks();

    expect(moveAllowed).toBe(true);
    expect(backdrop).not.toHaveAttribute('data-swiping');
  });

  it('starts swipe-to-dismiss after a scrollable container reaches the dismiss edge', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 30;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 30,
          }),
        ],
      });

      const firstMovePrevented = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 40,
          }),
        ],
      });

      expect(firstMovePrevented).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');

      scroll.scrollTop = 0;

      const secondMovePrevented = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 50,
          }),
        ],
      });

      expect(secondMovePrevented).toBe(false);

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('dismisses from a top-edge scroll container with a touch swipe down', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 0;

    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a bottom-edge scroll container with a touch swipe up', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="up">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 80;

    Object.defineProperty(popup, 'offsetHeight', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 140,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a left-edge horizontal scroll container with a touch swipe right', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ overflowX: 'auto', maxWidth: 40 }}>
                <div style={{ width: 120, height: 40 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
    scroll.scrollLeft = 0;

    Object.defineProperty(popup, 'offsetWidth', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('dismisses from a right-edge horizontal scroll container with a touch swipe left', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Drawer.Root open onOpenChange={handleOpenChange} swipeDirection="left">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup data-testid="popup">
              <div data-testid="scroll" style={{ overflowX: 'auto', maxWidth: 40 }}>
                <div style={{ width: 120, height: 40 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
    scroll.scrollLeft = 80;

    Object.defineProperty(popup, 'offsetWidth', { value: 200, configurable: true });

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 140,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.touchEnd(scroll, {
        changedTouches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }

    expect(handleOpenChange).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: 'swipe' }),
    );
  });

  it('allows horizontal swipe dismiss from a vertical scroll container', async () => {
    await render(
      <Drawer.Root open swipeDirection="right">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowY: 'auto', maxHeight: 40 }}>
                <div style={{ height: 120 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
    scroll.scrollTop = 20;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 20,
            clientY: 20,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('does not lock vertical swipe after minor cross-axis jitter in down drawers', async () => {
    await render(
      <Drawer.Root open swipeDirection="down">
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport>
            <Drawer.Popup>
              <div data-testid="scroll" style={{ overflowX: 'auto', width: 40 }}>
                <div style={{ width: 120, height: 40 }}>Scrollable content</div>
              </div>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const scroll = screen.getByTestId('scroll');
    const backdrop = screen.getByTestId('backdrop');
    Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
    Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
    scroll.scrollLeft = 0;

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => scroll;

    try {
      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 4,
            clientY: 3,
          }),
        ],
      });

      fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 4,
            clientY: 28,
          }),
        ],
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it.skipIf(isJSDOM)(
    'does not hijack cross-axis gestures from mixed-axis scroll containers',
    async () => {
      await render(
        <Drawer.Root open swipeDirection="down">
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ overflow: 'auto', width: 40, height: 40 }}>
                  <div style={{ width: 120, height: 120 }}>Scrollable content</div>
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const scroll = screen.getByTestId('scroll');
      const backdrop = screen.getByTestId('backdrop');
      Object.defineProperty(scroll, 'scrollHeight', { value: 120, configurable: true });
      Object.defineProperty(scroll, 'clientHeight', { value: 40, configurable: true });
      Object.defineProperty(scroll, 'scrollWidth', { value: 120, configurable: true });
      Object.defineProperty(scroll, 'clientWidth', { value: 40, configurable: true });
      scroll.scrollTop = 0;
      scroll.scrollLeft = 40;

      const originalElementFromPoint = document.elementFromPoint;
      document.elementFromPoint = () => scroll;

      try {
        fireEvent.touchStart(scroll, {
          touches: [
            createTouch(scroll, {
              clientX: 40,
              clientY: 0,
            }),
          ],
        });

        fireEvent.touchMove(scroll, {
          touches: [
            createTouch(scroll, {
              clientX: 10,
              clientY: 20,
            }),
          ],
        });

        await flushMicrotasks();

        expect(backdrop).not.toHaveAttribute('data-swiping');
      } finally {
        document.elementFromPoint = originalElementFromPoint;
      }
    },
  );

  it.skipIf(isJSDOM)(
    'does not block vertical scrolling in right drawers when only vertical overflow exists',
    async () => {
      await render(
        <Drawer.Root open swipeDirection="right">
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ overflowY: 'auto', height: 40 }}>
                  <div style={{ height: 120 }}>Scrollable content</div>
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const scroll = screen.getByTestId('scroll');
      const backdrop = screen.getByTestId('backdrop');

      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      const dispatched = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    },
  );

  it.skipIf(isJSDOM)(
    'does not block vertical scrolling in left drawers when only vertical overflow exists',
    async () => {
      await render(
        <Drawer.Root open swipeDirection="left">
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ overflowY: 'auto', height: 40 }}>
                  <div style={{ height: 120 }}>Scrollable content</div>
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const scroll = screen.getByTestId('scroll');
      const backdrop = screen.getByTestId('backdrop');

      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 20,
          }),
        ],
      });

      const dispatched = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    },
  );

  it.skipIf(isJSDOM)(
    'does not block horizontal scrolling in down drawers when only horizontal overflow exists',
    async () => {
      await render(
        <Drawer.Root open swipeDirection="down">
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ overflowX: 'auto', width: 40 }}>
                  <div style={{ width: 120, height: 40 }}>Scrollable content</div>
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const scroll = screen.getByTestId('scroll');
      const backdrop = screen.getByTestId('backdrop');

      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 20,
            clientY: 0,
          }),
        ],
      });

      const dispatched = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    },
  );

  it.skipIf(isJSDOM)(
    'does not block horizontal scrolling in up drawers when only horizontal overflow exists',
    async () => {
      await render(
        <Drawer.Root open swipeDirection="up">
          <Drawer.Portal>
            <Drawer.Backdrop data-testid="backdrop" />
            <Drawer.Viewport>
              <Drawer.Popup>
                <div data-testid="scroll" style={{ overflowX: 'auto', width: 40 }}>
                  <div style={{ width: 120, height: 40 }}>Scrollable content</div>
                </div>
              </Drawer.Popup>
            </Drawer.Viewport>
          </Drawer.Portal>
        </Drawer.Root>,
      );

      const scroll = screen.getByTestId('scroll');
      const backdrop = screen.getByTestId('backdrop');

      fireEvent.touchStart(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 20,
            clientY: 0,
          }),
        ],
      });

      const dispatched = fireEvent.touchMove(scroll, {
        touches: [
          createTouch(scroll, {
            clientX: 0,
            clientY: 0,
          }),
        ],
      });

      await flushMicrotasks();

      expect(dispatched).toBe(true);
      expect(backdrop).not.toHaveAttribute('data-swiping');
    },
  );

  it('toggles data-swiping on the backdrop while swiping', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      fireEvent.pointerUp(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });

  it('ends swipe drag when the primary mouse button is released mid-gesture', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Portal>
          <Drawer.Backdrop data-testid="backdrop" />
          <Drawer.Viewport data-testid="viewport">
            <Drawer.Popup data-testid="popup">Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>,
    );

    const viewport = screen.getByTestId('viewport');
    const popup = screen.getByTestId('popup');
    const backdrop = screen.getByTestId('backdrop');

    const originalElementFromPoint = document.elementFromPoint;
    document.elementFromPoint = () => popup;

    try {
      fireEvent.pointerDown(viewport, {
        button: 0,
        buttons: 1,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 8,
        buttons: 1,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).toHaveAttribute('data-swiping', '');

      // Simulate a right-click interruption where the primary button is no longer pressed.
      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 12,
        buttons: 2,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');

      fireEvent.pointerMove(viewport, {
        pointerId: 1,
        clientX: 0,
        clientY: 30,
        buttons: 0,
        pointerType: 'mouse',
      });

      await flushMicrotasks();

      expect(backdrop).not.toHaveAttribute('data-swiping');
    } finally {
      document.elementFromPoint = originalElementFromPoint;
    }
  });
});
