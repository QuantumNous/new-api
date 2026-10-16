import { expect, vi } from 'vitest';
import { Select } from '@base-ui/react/select';
import { act, fireEvent, screen } from '@mui/internal-test-utils';
import { createRenderer, describeConformance } from '#test-utils';

describe('<Select.ScrollUpArrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.ScrollUpArrow keepMounted />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <Select.Root open>
          <Select.Positioner>{node}</Select.Positioner>
        </Select.Root>,
      );
    },
  }));

  it('keeps advancing when the previous item top is fractionally within the visible top', async () => {
    let scrollTop = 72.18181610107422;

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
                  {[32, 71.5, 110, 142].map((offsetTop, index) => (
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

      const arrow = screen.getByText('▲');
      Object.defineProperty(arrow, 'offsetHeight', {
        value: 0,
        configurable: true,
      });

      fireEvent.mouseMove(arrow, {
        movementX: 0,
        movementY: -1,
      });

      act(() => {
        vi.advanceTimersByTime(40);
      });

      expect(scrollTop).toBe(32);
    } finally {
      vi.useRealTimers();
    }
  });
});
