import { expect, vi } from 'vitest';
import { Select } from '@base-ui/react/select';
import { act, fireEvent, screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ScrollDownArrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ScrollDownArrow keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>{node}</Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('snaps hover scrolling to the true bottom when the remaining space is fractional', async () => {
    let scrollTop = 19.5;

    vi.useFakeTimers();
    try {
      await render(
        <Select.Root open>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  ref={(node) => {
                    if (!node) {
                      return;
                    }

                    Object.defineProperty(node, 'scrollTop', {
                      configurable: true,
                      get: () => scrollTop,
                      set: (value: number) => {
                        scrollTop = value;
                      },
                    });
                    Object.defineProperty(node, 'scrollHeight', {
                      value: 100.5,
                      configurable: true,
                    });
                    Object.defineProperty(node, 'clientHeight', {
                      value: 60,
                      configurable: true,
                    });
                  }}
                >
                  {['One', 'Two', 'Three'].map((label, index) => (
                    <Select.Item
                      key={label}
                      value={label}
                      ref={(node) => {
                        if (!node) {
                          return;
                        }

                        Object.defineProperty(node, 'offsetTop', {
                          value: index * 40,
                          configurable: true,
                        });
                        Object.defineProperty(node, 'offsetHeight', {
                          value: 20,
                          configurable: true,
                        });
                      }}
                    >
                      {label}
                    </Select.Item>
                  ))}
                </Select.List>
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const arrow = screen.getByText('▼');
      Object.defineProperty(arrow, 'offsetHeight', {
        value: 0,
        configurable: true,
      });

      fireEvent.mouseMove(arrow, {
        movementX: 0,
        movementY: 1,
      });

      act(() => {
        vi.advanceTimersByTime(40);
      });

      expect(scrollTop).toBe(40.5);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps advancing when the next item bottom is fractionally within the visible bottom', async () => {
    let scrollTop = 71.81818389892578;

    vi.useFakeTimers();
    try {
      await render(
        <Select.Root open>
          <Select.Trigger>Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List
                  ref={(node) => {
                    if (!node) {
                      return;
                    }

                    Object.defineProperty(node, 'scrollTop', {
                      configurable: true,
                      get: () => scrollTop,
                      set: (value: number) => {
                        scrollTop = value;
                      },
                    });
                    Object.defineProperty(node, 'scrollHeight', {
                      value: 598,
                      configurable: true,
                    });
                    Object.defineProperty(node, 'clientHeight', {
                      value: 440,
                      configurable: true,
                    });
                  }}
                >
                  {[
                    32, 64, 96, 128, 160, 192, 224, 256, 336, 368, 400, 432, 448, 480, 512, 544,
                  ].map((offsetTop, index) => (
                    <Select.Item
                      key={index}
                      value={`item-${index}`}
                      ref={(node) => {
                        if (!node) {
                          return;
                        }

                        Object.defineProperty(node, 'offsetTop', {
                          value: offsetTop,
                          configurable: true,
                        });
                        Object.defineProperty(node, 'offsetHeight', {
                          value: 32,
                          configurable: true,
                        });
                      }}
                    >
                      Item {index}
                    </Select.Item>
                  ))}
                </Select.List>
                <Select.ScrollDownArrow keepMounted />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const arrow = screen.getByText('▼');
      Object.defineProperty(arrow, 'offsetHeight', {
        value: 0,
        configurable: true,
      });

      fireEvent.mouseMove(arrow, {
        movementX: 0,
        movementY: 1,
      });

      act(() => {
        vi.advanceTimersByTime(40);
      });

      expect(scrollTop).toBe(104);
    } finally {
      vi.useRealTimers();
    }
  });
});
