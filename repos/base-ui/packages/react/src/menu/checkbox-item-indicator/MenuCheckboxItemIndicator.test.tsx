import { expect } from 'vitest';
import * as React from 'react';
import { Menu } from '@base-ui/react/menu';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { screen, waitFor } from '@mui/internal-test-utils';

describe('<Menu.CheckboxItemIndicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Menu.CheckboxItemIndicator keepMounted />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>{node}</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
  }));

  it('should remove the indicator when there is no exit animation defined', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    function Test() {
      const [checked, setChecked] = React.useState(true);
      return (
        <div>
          <button onClick={() => setChecked(false)}>Close</button>
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked}>
                    <Menu.CheckboxItemIndicator data-testid="indicator" />
                  </Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    }

    const { user } = await render(<Test />);

    expect(screen.queryByTestId('indicator')).not.toBe(null);

    const closeButton = screen.getByText('Close');

    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('indicator')).toBe(null);
    });
  });

  it('should remove the indicator when the animation finishes', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    let animationFinished = false;
    const notifyAnimationFinished = () => {
      animationFinished = true;
    };

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

      const [checked, setChecked] = React.useState(true);

      return (
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button onClick={() => setChecked(false)}>Close</button>
          <Menu.Root open modal={false}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked}>
                    <Menu.CheckboxItemIndicator
                      className="animation-test-indicator"
                      data-testid="indicator"
                      keepMounted
                      onAnimationEnd={notifyAnimationFinished}
                    />
                  </Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    }

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator')).not.toHaveAttribute('hidden');

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(animationFinished).toBe(true);
    });
  });
});
