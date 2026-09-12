import { afterEach, expect } from 'vitest';
import * as React from 'react';
import userEvent from '@testing-library/user-event';
import { flushMicrotasks, screen, waitFor } from '@mui/internal-test-utils';
import { Menu } from '@base-ui/react/menu';
import { Menubar } from '@base-ui/react/menubar';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';

const Trigger = React.forwardRef(function Trigger(
  props: Menu.Trigger.Props,
  ref: React.ForwardedRef<any>,
) {
  return <Menu.Trigger {...props} ref={ref} render={<div />} nativeButton={false} />;
});

describe('<Menu.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Positioner />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <Menu.Portal>{node}</Menu.Portal>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe.skipIf(isJSDOM)('prop: anchor', () => {
    it('should be placed near the specified element when a ref is passed', async () => {
      function TestComponent() {
        const anchor = React.useRef<HTMLDivElement | null>(null);

        return (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={anchor}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={anchor} />
          </div>
        );
      }

      await render(<TestComponent />);

      const positioner = screen.getByTestId('positioner');
      const anchor = screen.getByTestId('anchor');

      const anchorPosition = anchor.getBoundingClientRect();

      await flushMicrotasks();

      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
      );
    });

    it('should be placed near the specified element when an element is passed', async () => {
      function TestComponent() {
        const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
        const handleRef = React.useCallback((element: HTMLDivElement | null) => {
          setAnchor(element);
        }, []);

        return (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={anchor}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={handleRef} />
          </div>
        );
      }

      await render(<TestComponent />);

      const positioner = screen.getByTestId('positioner');
      const anchor = screen.getByTestId('anchor');

      const anchorPosition = anchor.getBoundingClientRect();

      await flushMicrotasks();

      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
      );
    });

    it('should be placed near the specified element when a function returning an element is passed', async () => {
      function TestComponent() {
        const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);
        const handleRef = React.useCallback((element: HTMLDivElement | null) => {
          setAnchor(element);
        }, []);

        const getAnchor = React.useCallback(() => anchor, [anchor]);

        return (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={getAnchor}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div data-testid="anchor" style={{ marginTop: '100px' }} ref={handleRef} />
          </div>
        );
      }

      await render(<TestComponent />);

      const positioner = screen.getByTestId('positioner');
      const anchor = screen.getByTestId('anchor');

      const anchorPosition = anchor.getBoundingClientRect();

      await flushMicrotasks();

      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${anchorPosition.left}px, ${anchorPosition.bottom}px)`,
      );
    });

    it('should be placed at the specified position', async () => {
      const boundingRect = {
        x: 200,
        y: 100,
        top: 100,
        left: 200,
        bottom: 100,
        right: 200,
        height: 0,
        width: 0,
        toJSON: () => {},
      };

      const virtualElement = { getBoundingClientRect: () => boundingRect };

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner
              side="bottom"
              align="start"
              anchor={virtualElement}
              arrowPadding={0}
              data-testid="positioner"
            >
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const positioner = screen.getByTestId('positioner');
      expect(positioner.style.getPropertyValue('transform')).toBe(`translate(200px, 100px)`);
    });

    it('should accept a non-memoized function as an anchor', async () => {
      function TestComponent() {
        return (
          <div style={{ margin: '50px' }}>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={() => null}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        );
      }

      await render(<TestComponent />);
    });

    it('should react to the anchor changing from a ref to undefined and back', async () => {
      function TestComponent() {
        const anchorRef = React.useRef<HTMLDivElement | null>(null);
        const [currentAnchor, setCurrentAnchor] = React.useState<
          React.RefObject<HTMLDivElement | null> | undefined
        >(anchorRef);

        return (
          <div style={{ margin: '50px' }}>
            <button type="button" onClick={() => setCurrentAnchor(undefined)}>
              undefined
            </button>
            <button type="button" onClick={() => setCurrentAnchor(anchorRef)}>
              ref
            </button>
            <Menu.Root open>
              <Menu.Trigger>trigger</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner
                  side="bottom"
                  align="start"
                  anchor={currentAnchor}
                  arrowPadding={0}
                  data-testid="positioner"
                >
                  <Menu.Popup>
                    <Menu.Item>1</Menu.Item>
                    <Menu.Item>2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <div
              data-testid="anchor"
              style={{ marginTop: '100px', width: 10, height: 10 }}
              ref={anchorRef}
            />
          </div>
        );
      }

      await render(<TestComponent />);

      const positioner = screen.getByTestId('positioner');
      const anchorElement = screen.getByTestId('anchor');

      const setUndefinedButton = screen.getByRole('button', { name: 'undefined' });
      const setRefButton = screen.getByRole('button', { name: 'ref' });
      const trigger = screen.getByRole('button', { name: 'trigger' });

      let anchorRect = anchorElement.getBoundingClientRect();
      await flushMicrotasks();
      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${anchorRect.left}px, ${anchorRect.bottom}px)`,
      );

      await userEvent.click(setUndefinedButton);
      await flushMicrotasks();

      const triggerRect = trigger.getBoundingClientRect();
      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${Math.floor(triggerRect.left)}px, ${triggerRect.bottom}px)`,
      );

      await userEvent.click(setRefButton);
      await flushMicrotasks();

      anchorRect = anchorElement.getBoundingClientRect();
      expect(positioner.style.getPropertyValue('transform')).toBe(
        `translate(${anchorRect.left}px, ${anchorRect.bottom}px)`,
      );
    });
  });

  describe.skipIf(isJSDOM)('prop: keepMounted', () => {
    afterEach(async () => {
      const { cleanup } = await import('vitest-browser-react');
      await cleanup();
    });

    it('when keepMounted=true, should keep the content mounted when closed', async () => {
      const { userEvent: user } = await import('vitest/browser');
      const { render: vbrRender } = await import('vitest-browser-react');

      await vbrRender(
        <Menu.Root modal={false}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });

      expect(screen.queryByRole('menu', { hidden: true })).not.toBe(null);
      expect(screen.queryByRole('menu', { hidden: true })).toBeInaccessible();

      await user.click(trigger, { delay: 20 });
      await waitFor(() => {
        expect(screen.queryByRole('menu', { hidden: false })).not.toBe(null);
      });
      expect(screen.queryByRole('menu', { hidden: false })).not.toBeInaccessible();

      await user.click(trigger, { delay: 20 });
      await waitFor(() => {
        expect(screen.queryByRole('menu', { hidden: true })).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu', { hidden: true })).toBeInaccessible();
      });
    });

    it('when keepMounted=false, should unmount the content when closed', async () => {
      const { userEvent: user } = await import('vitest/browser');
      const { render: vbrRender } = await import('vitest-browser-react');

      await vbrRender(
        <Menu.Root modal={false}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal keepMounted={false}>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.Item>2</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Toggle' });

      expect(screen.queryByRole('menu', { hidden: true })).toBe(null);

      await user.click(trigger, { delay: 20 });
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.queryByRole('menu', { hidden: false })).not.toBe(null);
      });
      expect(screen.queryByRole('menu', { hidden: false })).not.toBeInaccessible();

      await user.click(trigger, { delay: 20 });
      await waitFor(() => {
        expect(screen.queryByRole('menu', { hidden: true })).toBe(null);
      });
    });
  });

  const baselineX = 10;
  const baselineY = 36;
  const popupWidth = 52;
  const popupHeight = 24;
  const anchorWidth = 72;
  const anchorHeight = 36;
  const triggerStyle = { width: anchorWidth, height: anchorHeight };
  const popupStyle = { width: popupWidth, height: popupHeight };

  describe.skipIf(isJSDOM)('Menubar parent', () => {
    it('uses bottom as the default side when the menubar is horizontal', async () => {
      let side = 'none';

      await render(
        <Menubar>
          <Menu.Root open>
            <Trigger style={triggerStyle}>File</Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={(data) => {
                  side = data.side;
                  return 0;
                }}
              >
                <Menu.Popup style={popupStyle}>Open</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      expect(side).toBe('bottom');
    });

    it('uses inline-end as the default side when the menubar is vertical', async () => {
      let side = 'none';

      await render(
        <Menubar orientation="vertical">
          <Menu.Root open>
            <Trigger style={triggerStyle}>File</Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={(data) => {
                  side = data.side;
                  return 0;
                }}
              >
                <Menu.Popup style={popupStyle}>Open</Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );

      expect(side).toBe('inline-end');
    });
  });

  describe.skipIf(isJSDOM)('prop: sideOffset', () => {
    it('offsets the side when a number is specified', async () => {
      const sideOffset = 7;
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner" sideOffset={sideOffset}>
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX}px, ${baselineY + sideOffset}px)`,
      );
    });

    it('offsets the side when a function is specified', async () => {
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              data-testid="positioner"
              sideOffset={(data) => data.positioner.width + data.anchor.width}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX}px, ${baselineY + popupWidth + anchorWidth}px)`,
      );
    });

    it('can read the latest side inside sideOffset', async () => {
      let side = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="left"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('right');
    });

    it('can read the latest align inside sideOffset', async () => {
      let align = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              sideOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the align in the browser
      expect(align).toBe('end');
    });

    it('reads logical side inside sideOffset', async () => {
      let side = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="inline-start"
              data-testid="positioner"
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('inline-end');
    });
  });

  describe.skipIf(isJSDOM)('prop: alignOffset', () => {
    it('offsets the align when a number is specified', async () => {
      const alignOffset = 7;
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner" alignOffset={alignOffset}>
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX + alignOffset}px, ${baselineY}px)`,
      );
    });

    it('offsets the align when a function is specified', async () => {
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner" alignOffset={(data) => data.positioner.width}>
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX + popupWidth}px, ${baselineY}px)`,
      );
    });

    it('can read the latest side inside alignOffset', async () => {
      let side = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="left"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('right');
    });

    it('can read the latest align inside alignOffset', async () => {
      let align = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              alignOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the align in the browser
      expect(align).toBe('end');
    });

    it('reads logical side inside alignOffset', async () => {
      let side = 'none';
      await render(
        <Menu.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Menu.Portal>
            <Menu.Positioner
              side="inline-start"
              data-testid="positioner"
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Menu.Popup style={popupStyle}>Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('inline-end');
    });
  });
});
