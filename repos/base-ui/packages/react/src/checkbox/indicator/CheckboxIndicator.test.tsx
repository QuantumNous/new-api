import { expect } from 'vitest';
import * as React from 'react';
import { Checkbox } from '@base-ui/react/checkbox';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { screen, waitFor } from '@mui/internal-test-utils';
import { CheckboxRootContext } from '../root/CheckboxRootContext';

const testContext = {
  checked: true,
  disabled: false,
  readOnly: false,
  required: false,
  indeterminate: false,
  dirty: false,
  touched: false,
  valid: null,
  filled: false,
  focused: false,
};

describe('<Checkbox.Indicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Checkbox.Indicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(
        <CheckboxRootContext.Provider value={testContext}>{node}</CheckboxRootContext.Provider>,
      );
    },
  }));

  it('should not render indicator by default', async () => {
    await render(
      <Checkbox.Root>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>,
    );
    const indicator = screen.queryByTestId('indicator');
    expect(indicator).toBe(null);
  });

  it('should render indicator when checked', async () => {
    await render(
      <Checkbox.Root checked>
        <Checkbox.Indicator data-testid="indicator" />
      </Checkbox.Root>,
    );
    const indicator = screen.getByTestId('indicator');
    expect(indicator).not.toBe(null);
  });

  it('should spread extra props', async () => {
    await render(
      <Checkbox.Root defaultChecked>
        <Checkbox.Indicator data-testid="indicator" data-extra-prop="Lorem ipsum" />
      </Checkbox.Root>,
    );
    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-extra-prop', 'Lorem ipsum');
  });

  describe('prop: keepMounted', () => {
    it('should keep indicator mounted when unchecked', async () => {
      await render(
        <Checkbox.Root>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });

    it('should keep indicator mounted when checked', async () => {
      await render(
        <Checkbox.Root checked>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });

    it('should keep indicator mounted when indeterminate', async () => {
      await render(
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" keepMounted />
        </Checkbox.Root>,
      );
      const indicator = screen.getByTestId('indicator');
      expect(indicator).not.toBe(null);
    });
  });

  it('should remove the indicator when there is no exit animation defined', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    function Test() {
      const [checked, setChecked] = React.useState(true);
      return (
        <div>
          <button onClick={() => setChecked(false)}>Close</button>
          <Checkbox.Root checked={checked}>
            <Checkbox.Indicator data-testid="indicator" />
          </Checkbox.Root>
        </div>
      );
    }

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator')).not.toBe(null);

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
          <Checkbox.Root checked={checked}>
            <Checkbox.Indicator
              className="animation-test-indicator"
              data-testid="indicator"
              onAnimationEnd={notifyAnimationFinished}
              keepMounted
            />
          </Checkbox.Root>
        </div>
      );
    }

    const { user } = await render(<Test />);
    expect(screen.getByTestId('indicator')).not.toBe(null);

    const closeButton = screen.getByText('Close');
    await user.click(closeButton);

    await waitFor(() => {
      expect(animationFinished).toBe(true);
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-indicator {
          transition: opacity 1ms;
        }

        .animation-test-indicator[data-starting-style],
        .animation-test-indicator[data-ending-style] {
          opacity: 0;
        }
      `;

      function Test() {
        const [checked, setChecked] = React.useState(false);

        function handleCheck() {
          setChecked(true);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleCheck}>Check</button>
            <Checkbox.Root checked={checked}>
              <Checkbox.Indicator
                className="animation-test-indicator"
                data-testid="indicator"
                onTransitionEnd={notifyTransitionFinished}
              />
            </Checkbox.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('indicator')).toBe(null);

      await user.click(screen.getByText('Check'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('indicator')).not.toBe(null);
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

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

      function Test() {
        const [checked, setChecked] = React.useState(true);

        function handleUncheck() {
          setChecked(false);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleUncheck}>Uncheck</button>
            <Checkbox.Root checked={checked}>
              <Checkbox.Indicator className="animation-test-indicator" data-testid="indicator" />
            </Checkbox.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.getByTestId('indicator')).not.toBe(null);

      await user.click(screen.getByText('Uncheck'));

      await waitFor(() => {
        const indicator = screen.queryByTestId('indicator');
        expect(indicator).not.toBe(null);
        expect(indicator).toHaveAttribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('indicator')).toBe(null);
      });
    });
  });
});
