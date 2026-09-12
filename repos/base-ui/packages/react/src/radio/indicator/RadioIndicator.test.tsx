import { expect } from 'vitest';
import * as React from 'react';
import { screen, waitFor } from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';

describe('<Radio.Indicator />', () => {
  beforeEach(() => {
    globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
  });

  const { render } = createRenderer();

  describeConformance(<Radio.Indicator />, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node) {
      return render(<Radio.Root value="">{node}</Radio.Root>);
    },
  }));

  it('should remove the indicator when there is no exit animation defined', async ({ skip }) => {
    if (isJSDOM) {
      skip();
    }

    function Test() {
      const [value, setValue] = React.useState('a');
      return (
        <div>
          <button onClick={() => setValue('b')}>Close</button>
          <RadioGroup value={value}>
            <Radio.Root value="a">
              <Radio.Indicator className="animation-test-indicator" data-testid="indicator-a" />
            </Radio.Root>
            <Radio.Root value="a">
              <Radio.Indicator className="animation-test-indicator" />
            </Radio.Root>
          </RadioGroup>
        </div>
      );
    }

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator-a')).not.toBe(null);

    const closeButton = screen.getByText('Close');

    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByTestId('indicator-a')).toBe(null);
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

      const [value, setValue] = React.useState('a');

      return (
        <div>
          {/* eslint-disable-next-line react/no-danger */}
          <style dangerouslySetInnerHTML={{ __html: style }} />
          <button onClick={() => setValue('b')}>Close</button>
          <RadioGroup value={value}>
            <Radio.Root value="a">
              <Radio.Indicator
                className="animation-test-indicator"
                keepMounted
                onAnimationEnd={notifyAnimationFinished}
                data-testid="indicator-a"
              />
            </Radio.Root>
            <Radio.Root value="a">
              <Radio.Indicator className="animation-test-indicator" keepMounted />
            </Radio.Root>
          </RadioGroup>
        </div>
      );
    }

    const { user } = await render(<Test />);

    expect(screen.getByTestId('indicator-a')).not.toBe(null);

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
        const [value, setValue] = React.useState('b');

        function handleSelectA() {
          setValue('a');
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleSelectA}>Select a</button>
            <RadioGroup value={value}>
              <Radio.Root value="a">
                <Radio.Indicator
                  className="animation-test-indicator"
                  data-testid="indicator-a"
                  onTransitionEnd={notifyTransitionFinished}
                />
              </Radio.Root>
              <Radio.Root value="b">
                <Radio.Indicator className="animation-test-indicator" data-testid="indicator-b" />
              </Radio.Root>
            </RadioGroup>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('indicator-a')).toBe(null);

      await user.click(screen.getByText('Select a'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('indicator-a')).not.toBe(null);
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
        const [value, setValue] = React.useState('a');

        function handleSelectB() {
          setValue('b');
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleSelectB}>Select b</button>
            <RadioGroup value={value}>
              <Radio.Root value="a">
                <Radio.Indicator className="animation-test-indicator" data-testid="indicator-a" />
              </Radio.Root>
              <Radio.Root value="b">
                <Radio.Indicator className="animation-test-indicator" data-testid="indicator-b" />
              </Radio.Root>
            </RadioGroup>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.getByTestId('indicator-a')).not.toBe(null);

      await user.click(screen.getByText('Select b'));

      await waitFor(() => {
        const indicator = screen.queryByTestId('indicator-a');
        expect(indicator).not.toBe(null);
        expect(indicator).toHaveAttribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('indicator-a')).toBe(null);
      });
    });
  });
});
