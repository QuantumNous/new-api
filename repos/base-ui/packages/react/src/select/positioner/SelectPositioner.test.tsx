import { expect } from 'vitest';
import * as React from 'react';
import { Select } from '@base-ui/react/select';
import { screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

const Trigger = React.forwardRef(function Trigger(
  props: Select.Trigger.Props,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  return <Select.Trigger {...props} ref={ref} />;
});

describe('<Select.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Portal>{node}</Select.Portal>
        </Select.Root>,
      );
    },
  }));

  const baselineX = 10;
  const baselineY = 36;
  const popupWidth = 52;
  const popupHeight = 24;
  const anchorWidth = 72;
  const anchorHeight = 36;
  const triggerStyle = { width: anchorWidth, height: anchorHeight };
  const popupStyle = { width: popupWidth, height: popupHeight };

  describe.skipIf(isJSDOM)('prop: sideOffset', () => {
    it('offsets the side when a number is specified', async () => {
      const sideOffset = 7;
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              align="center"
              sideOffset={sideOffset}
              alignItemWithTrigger={false}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX}px, ${baselineY + sideOffset}px)`,
      );
    });

    it('offsets the side when a function is specified', async () => {
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              align="center"
              sideOffset={(data) => data.positioner.width + data.anchor.width}
              alignItemWithTrigger={false}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX}px, ${baselineY + popupWidth + anchorWidth}px)`,
      );
    });

    it('can read the latest side inside sideOffset', async () => {
      let side = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="left"
              align="center"
              data-testid="positioner"
              alignItemWithTrigger={false}
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('right');
    });

    it('can read the latest align inside sideOffset', async () => {
      let align = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              alignItemWithTrigger={false}
              sideOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the align in the browser
      expect(align).toBe('end');
    });

    it('reads logical side inside sideOffset', async () => {
      let side = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="inline-start"
              data-testid="positioner"
              alignItemWithTrigger={false}
              sideOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('inline-end');
    });
  });

  describe.skipIf(isJSDOM)('prop: alignOffset', () => {
    it('offsets the align when a number is specified', async () => {
      const alignOffset = 7;
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              align="center"
              alignOffset={alignOffset}
              alignItemWithTrigger={false}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX + alignOffset}px, ${baselineY}px)`,
      );
    });

    it('offsets the align when a function is specified', async () => {
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              data-testid="positioner"
              align="center"
              alignItemWithTrigger={false}
              alignOffset={(data) => data.positioner.width}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      expect(screen.getByTestId('positioner').style.transform).toBe(
        `translate(${baselineX + popupWidth}px, ${baselineY}px)`,
      );
    });

    it('can read the latest side inside alignOffset', async () => {
      let side = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="left"
              align="center"
              data-testid="positioner"
              alignItemWithTrigger={false}
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('right');
    });

    it('can read the latest align inside alignOffset', async () => {
      let align = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="right"
              align="start"
              data-testid="positioner"
              alignItemWithTrigger={false}
              alignOffset={(data) => {
                align = data.align;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the align in the browser
      expect(align).toBe('end');
    });

    it('reads logical side inside alignOffset', async () => {
      let side = 'none';
      await render(
        <Select.Root open>
          <Trigger style={triggerStyle}>Trigger</Trigger>
          <Select.Portal>
            <Select.Positioner
              side="inline-start"
              data-testid="positioner"
              alignItemWithTrigger={false}
              alignOffset={(data) => {
                side = data.side;
                return 0;
              }}
            >
              <Select.Popup style={popupStyle}>Popup</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      // correctly flips the side in the browser
      expect(side).toBe('inline-end');
    });
  });
});
