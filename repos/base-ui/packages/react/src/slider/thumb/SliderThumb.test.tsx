import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { Slider } from '@base-ui/react/slider';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { platform } from '@base-ui/utils/platform';
import { createTouches, getHorizontalSliderRect } from '../utils/test-utils';

const isWebKit = platform.engine.webkit;

describe('<Slider.Thumb />', () => {
  const { render, renderToString } = createRenderer();

  describeConformance(<Slider.Thumb />, () => ({
    render: (node) => {
      return render(<Slider.Root>{node}</Slider.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('ARIA attributes', () => {
    ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-valuetext'].forEach((attr) => {
      it(`forwards ${attr} to the input`, async () => {
        await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb
                {...{
                  [attr]: 'test',
                }}
              />
            </Slider.Control>
          </Slider.Root>,
        );
        expect(screen.getByRole('slider')).toHaveAttribute(attr, 'test');
      });
    });

    it('prefers getAriaValueText over a direct aria-valuetext prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb
              aria-valuetext="ignored"
              getAriaValueText={(formatted) => `${formatted} percent`}
            />
          </Slider.Control>
        </Slider.Root>,
      );
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '50 percent');
    });
  });

  describe('prop: onKeyDown', () => {
    it('forwards key events that the slider does not handle', async () => {
      const handleKeyDown = vi.fn();
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      await act(async () => {
        slider.focus();
      });
      fireEvent.keyDown(slider, { key: 'Enter' });
      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    ['ArrowRight', 'PageUp'].forEach((key) => {
      it(`forwards handled ${key} key events`, async () => {
        const handleKeyDown = vi.fn();
        await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onKeyDown={handleKeyDown} />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        await act(async () => {
          slider.focus();
        });
        fireEvent.keyDown(slider, { key });

        expect(handleKeyDown).toHaveBeenCalledTimes(1);
      });
    });

    it('allows preventing the internal key handling', async () => {
      const handleKeyDown = vi.fn((event: React.KeyboardEvent<HTMLInputElement>) => {
        event.preventDefault();
      });

      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb onKeyDown={handleKeyDown} />
          </Slider.Control>
        </Slider.Root>,
      );

      const slider = screen.getByRole('slider');
      await act(async () => {
        slider.focus();
      });
      fireEvent.keyDown(slider, { key: 'ArrowRight' });

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
      expect(slider).toHaveAttribute('aria-valuenow', '50');
    });
  });

  // AT (e.g. Android Talkback) may use increase/decrease actions to interact
  // with the slider which works on `input type="range"` via change events, but
  // not pure ARIA implementations using `div role="slider"`. The `input`
  // element(s) must be the only focusable element(s).
  // See:
  // - https://issues.chromium.org/issues/40816094
  // - https://github.com/mui/material-ui/issues/23506
  describe('events', () => {
    describe.skipIf(isJSDOM)('focus and blur', () => {
      it('single thumb', async () => {
        const focusAndBlurSpy = vi.fn((event) => event.target);
        const { user } = await render(
          <Slider.Root defaultValue={50}>
            <Slider.Control>
              <Slider.Thumb onFocus={focusAndBlurSpy} onBlur={focusAndBlurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );
        expect(document.body).toHaveFocus();
        const input = screen.getByRole('slider');
        expect(input.tagName).toBe('INPUT');
        expect(input).toHaveAttribute('type', 'range');

        await user.keyboard('[Tab]');
        // We assert above that the tabbable elements of the slider are
        // input[type="range"] because TalkBack doesn't simulate keyboard events for increments
        // or decrements (proof: https://issues.chromium.org/issues/40816094). Instead, it triggers change events on those native slider inputs.
        expect(input).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(1);
        expect(focusAndBlurSpy.mock.results[0]?.value).toBe(input);

        await user.keyboard('[Tab]');
        expect(document.body).toHaveFocus();
        expect(focusAndBlurSpy.mock.calls.length).toBe(2);
        expect(focusAndBlurSpy.mock.results.at(-1)?.value).toBe(input);
      });

      it('multiple thumbs', async () => {
        const focusSpy = vi.fn((event) => event.target);
        const blurSpy = vi.fn((event) => event.target);
        const { user } = await render(
          <Slider.Root defaultValue={[50, 70]}>
            <Slider.Control>
              <Slider.Thumb onFocus={focusSpy} onBlur={blurSpy} />
              <Slider.Thumb onFocus={focusSpy} onBlur={blurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );
        expect(document.body).toHaveFocus();
        const [slider1, slider2] = screen.getAllByRole('slider');
        expect(slider1).toHaveProperty('tagName', 'INPUT');
        expect(slider1).toHaveAttribute('type', 'range');
        expect(slider2).toHaveProperty('tagName', 'INPUT');
        expect(slider2).toHaveAttribute('type', 'range');

        await user.keyboard('[Tab]');
        expect(slider1).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(1);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider1);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(1);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider1);
        expect(slider2).toHaveFocus();
        expect(focusSpy.mock.calls.length).toBe(2);
        expect(focusSpy.mock.results.at(-1)?.value).toBe(slider2);

        await user.keyboard('[Tab]');
        expect(blurSpy.mock.calls.length).toBe(2);
        expect(blurSpy.mock.results.at(-1)?.value).toBe(slider2);
        expect(document.body).toHaveFocus();
      });

      it('does not emit extra blur and focus events when restoring focus-visible', async () => {
        const focusSpy = vi.fn((event) => event.target);
        const blurSpy = vi.fn((event) => event.target);

        await render(
          <Slider.Root defaultValue={40}>
            <Slider.Control data-testid="control">
              <Slider.Thumb onFocus={focusSpy} onBlur={blurSpy} />
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');
        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(
          getHorizontalSliderRect,
        );

        const slider = screen.getByRole('slider');

        fireEvent.pointerDown(sliderControl, {
          pointerId: 1,
          pointerType: 'mouse',
          button: 0,
          buttons: 1,
          clientX: 40,
          clientY: 0,
        });

        await waitFor(() => {
          expect(slider).toHaveFocus();
        });
        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(focusSpy.mock.results[0]?.value).toBe(slider);
        expect(blurSpy).not.toHaveBeenCalled();

        fireEvent.keyDown(slider, { key: 'ArrowRight' });

        expect(focusSpy).toHaveBeenCalledTimes(1);
        expect(blurSpy).not.toHaveBeenCalled();
      });
    });

    describe('change', () => {
      it('handles change events', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root defaultValue={50} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        fireEvent.change(slider, { target: { value: '51' } });
        expect(handleValueChange.mock.calls.length).toBe(1);
        expect(slider).toHaveAttribute('aria-valuenow', '51');
      });

      it('does not change the value beyond min and max', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root defaultValue={50} min={40} max={60} onValueChange={handleValueChange}>
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');

        fireEvent.change(slider, { target: { value: '30' } });
        expect(slider).toHaveAttribute('aria-valuenow', '40');
        expect(handleValueChange.mock.calls.length).toBe(1);
        fireEvent.change(slider, { target: { value: '30' } });
        expect(handleValueChange.mock.calls.length).toBe(1);

        fireEvent.change(slider, { target: { value: '70' } });
        expect(slider).toHaveAttribute('aria-valuenow', '60');
        expect(handleValueChange.mock.calls.length).toBe(2);
        fireEvent.change(slider, { target: { value: '70' } });
        expect(handleValueChange.mock.calls.length).toBe(2);
      });

      it('handles non-integer values', async () => {
        const handleValueChange = vi.fn();
        await render(
          <Slider.Root
            defaultValue={50}
            min={-100}
            max={100}
            step={0.00000001}
            onValueChange={handleValueChange}
          >
            <Slider.Control>
              <Slider.Thumb />
            </Slider.Control>
          </Slider.Root>,
        );

        const slider = screen.getByRole('slider');
        expect(slider).toHaveAttribute('aria-valuenow', '50');
        expect(slider).toHaveAttribute('step', '1e-8');

        fireEvent.change(slider, { target: { value: '51.1' } });
        expect(slider).toHaveAttribute('aria-valuenow', '51.1');

        fireEvent.change(slider, { target: { value: '0.00000005' } });
        expect(slider).toHaveAttribute('aria-valuenow', '5e-8');

        fireEvent.change(slider, { target: { value: '1e-7' } });
        expect(slider).toHaveAttribute('aria-valuenow', '1e-7');
      });
    });
  });

  describe('prop: tabIndex', () => {
    it('does not apply tabIndex to the thumb element by default', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByTestId('thumb')).not.toHaveAttribute('tabindex');
      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', 0);
    });

    it('can be removed from the tab sequence', async () => {
      const { user } = await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb tabIndex={-1} />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByRole('slider')).toHaveProperty('tabIndex', -1);
      expect(document.body).toHaveFocus();
      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
    });
  });

  describe('prop: children', () => {
    it('renders the nested input as a sibling to children', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb">
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the short form render prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render={<div data-testid="thumb" />}>
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });

    it('renders the nested input when using the long form render prop', async () => {
      await render(
        <Slider.Root defaultValue={50}>
          <Slider.Control>
            <Slider.Thumb render={(props) => <div data-testid="thumb" {...props} />}>
              <span data-testid="child" />
            </Slider.Thumb>
          </Slider.Control>
        </Slider.Root>,
      );

      const thumb = screen.getByTestId('thumb');
      expect(thumb.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
      expect(thumb.querySelector('[data-testid="child"]')).toBe(screen.getByTestId('child'));
    });
  });

  describe('prop: inputRef', () => {
    it('can focus the input element', async () => {
      function App() {
        const inputRef = React.useRef<HTMLInputElement>(null);
        return (
          <React.Fragment>
            <Slider.Root defaultValue={50}>
              <Slider.Control>
                <Slider.Thumb inputRef={inputRef} />
              </Slider.Control>
            </Slider.Root>
            <button
              onClick={() => {
                if (inputRef.current) {
                  inputRef.current.focus();
                }
              }}
            >
              Button
            </button>
          </React.Fragment>
        );
      }
      const { user } = await render(<App />);

      expect(document.body).toHaveFocus();
      await user.click(screen.getByText('Button'));
      expect(screen.getByRole('slider')).toHaveFocus();
    });
  });

  describe('stacking order', () => {
    it('relies on DOM order before any thumb is used', async () => {
      await render(
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>,
      );

      expect(screen.getByTestId('thumb-0').style.zIndex).toBe('');
      expect(screen.getByTestId('thumb-1').style.zIndex).toBe('');
    });

    it('keeps the most recently active thumb on top after focus moves away', async () => {
      const { user } = await render(
        <Slider.Root defaultValue={[20, 20]}>
          <Slider.Control>
            <Slider.Thumb data-testid="thumb-0" />
            <Slider.Thumb data-testid="thumb-1" />
          </Slider.Control>
        </Slider.Root>,
      );

      const [thumb0, thumb1] = [screen.getByTestId('thumb-0'), screen.getByTestId('thumb-1')];

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[0]).toHaveFocus();
      expect(thumb0.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(screen.getAllByRole('slider')[1]).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('2');

      await user.keyboard('[Tab]');
      expect(document.body).toHaveFocus();
      expect(thumb1.style.zIndex).toBe('1');
      expect(thumb0.style.zIndex).toBe('');
    });
  });

  describe('prop: thumbAlignment', () => {
    it.skipIf(isJSDOM)('recomputes inset positions when the slider becomes visible', async () => {
      function App() {
        const [visible, setVisible] = React.useState(false);

        return (
          <React.Fragment>
            <button type="button" onClick={() => setVisible(true)}>
              show
            </button>
            <div style={{ display: visible ? 'block' : 'none' }}>
              <Slider.Root defaultValue={30} thumbAlignment="edge" style={{ width: '100px' }}>
                <Slider.Control
                  data-testid="control"
                  style={{ position: 'relative', width: '100%', height: '10px' }}
                >
                  <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                    <Slider.Indicator data-testid="indicator" />
                    <Slider.Thumb data-testid="thumb" style={{ width: '10px', height: '10px' }} />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </div>
          </React.Fragment>
        );
      }

      const { user } = await render(<App />);

      const thumb = screen.getByTestId('thumb');
      const indicator = screen.getByTestId('indicator');

      await waitFor(() => {
        expect(thumb.style.visibility).toBe('hidden');
        expect(thumb.style.getPropertyValue('--position')).toBe('0%');
        expect(indicator.style.visibility).toBe('hidden');
        expect(indicator.style.getPropertyValue('--start-position')).toBe('0%');
      });

      await user.click(screen.getByRole('button', { name: 'show' }));

      await waitFor(() => {
        expect(thumb.style.visibility).toBe('');
        expect(thumb.style.getPropertyValue('--position')).toBe('32%');
        expect(indicator.style.visibility).toBe('');
        expect(indicator.style.getPropertyValue('--start-position')).toBe('32%');
      });
    });

    it.skipIf(isJSDOM)(
      'recomputes range inset positions when the slider becomes visible',
      async () => {
        function App() {
          const [visible, setVisible] = React.useState(false);

          return (
            <React.Fragment>
              <button type="button" onClick={() => setVisible(true)}>
                show
              </button>
              <div style={{ display: visible ? 'block' : 'none' }}>
                <Slider.Root
                  defaultValue={[30, 70]}
                  thumbAlignment="edge"
                  style={{ width: '100px' }}
                >
                  <Slider.Control
                    data-testid="control"
                    style={{ position: 'relative', width: '100%', height: '10px' }}
                  >
                    <Slider.Track style={{ position: 'relative', width: '100%', height: '10px' }}>
                      <Slider.Indicator data-testid="indicator" />
                      <Slider.Thumb
                        data-testid="start-thumb"
                        style={{ width: '10px', height: '10px' }}
                      />
                      <Slider.Thumb
                        data-testid="end-thumb"
                        style={{ width: '10px', height: '10px' }}
                      />
                    </Slider.Track>
                  </Slider.Control>
                </Slider.Root>
              </div>
            </React.Fragment>
          );
        }

        const { user } = await render(<App />);

        const startThumb = screen.getByTestId('start-thumb');
        const endThumb = screen.getByTestId('end-thumb');
        const indicator = screen.getByTestId('indicator');

        await waitFor(() => {
          expect(startThumb.style.visibility).toBe('hidden');
          expect(startThumb.style.getPropertyValue('--position')).toBe('0%');
          expect(endThumb.style.visibility).toBe('hidden');
          expect(endThumb.style.getPropertyValue('--position')).toBe('0%');
          expect(indicator.style.visibility).toBe('hidden');
          expect(indicator.style.getPropertyValue('--start-position')).toBe('0%');
          expect(indicator.style.getPropertyValue('--relative-size')).toBe('0%');
        });

        await user.click(screen.getByRole('button', { name: 'show' }));

        await waitFor(() => {
          expect(startThumb.style.visibility).toBe('');
          expect(startThumb.style.getPropertyValue('--position')).toBe('32%');
          expect(endThumb.style.visibility).toBe('');
          expect(endThumb.style.getPropertyValue('--position')).toBe('68%');
          expect(indicator.style.visibility).toBe('');
          expect(indicator.style.getPropertyValue('--start-position')).toBe('32%');
          expect(indicator.style.getPropertyValue('--relative-size')).toBe('36%');
        });
      },
    );
  });

  /**
   * Browser tests render with 1024px width by default, so most tests here set
   * the component to `width: 100px` to make the asserted values more readable.
   */
  describe.skipIf(isJSDOM || isWebKit || typeof Touch === 'undefined')('positioning styles', () => {
    describe('positions the thumb when dragged', () => {
      it('single thumb', async () => {
        await render(
          <Slider.Root
            style={{
              width: '1000px',
            }}
          >
            <Slider.Control data-testid="control">
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');

        const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
          getHorizontalSliderRect(1000),
        );

        fireEvent.touchStart(
          sliderControl,
          createTouches([{ identifier: 1, clientX: 20, clientY: 0 }]),
        );
        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );
        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );

        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 199, clientY: 0 }]),
        );

        expect(thumbStyles.getPropertyValue('left')).toBe('200px');
        fireEvent.touchEnd(
          document.body,
          createTouches([{ identifier: 1, clientX: 0, clientY: 0 }]),
        );
        expect(thumbStyles.getPropertyValue('left')).toBe('200px');
      });

      it('multiple thumbs', async () => {
        await render(
          <Slider.Root
            defaultValue={[20, 40]}
            style={{
              width: '1000px',
            }}
          >
            <Slider.Control data-testid="control">
              <Slider.Track>
                <Slider.Indicator />
                <Slider.Thumb data-testid="thumb" />
                <Slider.Thumb data-testid="thumb" />
              </Slider.Track>
            </Slider.Control>
          </Slider.Root>,
        );

        const sliderControl = screen.getByTestId('control');

        const computedStyles = {
          thumb1: getComputedStyle(screen.getAllByTestId('thumb')[0]),
          thumb2: getComputedStyle(screen.getAllByTestId('thumb')[1]),
        };

        vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
          getHorizontalSliderRect(1000),
        );

        fireEvent.touchStart(
          sliderControl,
          createTouches([{ identifier: 1, clientX: 400, clientY: 0 }]),
        );
        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );
        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );

        fireEvent.touchMove(
          document.body,
          createTouches([{ identifier: 1, clientX: 699, clientY: 0 }]),
        );

        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('700px');
        fireEvent.touchEnd(
          document.body,
          createTouches([{ identifier: 1, clientX: 0, clientY: 0 }]),
        );
        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('200px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('700px');
      });

      describe('prop: thumbCollisionBehavior', () => {
        function getSliderValues() {
          return screen
            .getAllByRole('slider')
            .map((input) => Number(input.getAttribute('aria-valuenow')));
        }

        it('prevents thumbs from passing each other when set to "none"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="none"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 600, clientY: 0 }]),
          );
          fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 600, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([40, 40]);
        });

        it('pushes adjacent thumbs forward when set to "push"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="push"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 650, clientY: 0 }]),
          );
          fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 650, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([65, 65]);
        });

        it('allows thumbs to swap when set to "swap"', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40]}
              thumbCollisionBehavior="swap"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          fireEvent.touchMove(
            document.body,
            createTouches([{ identifier: 1, clientX: 700, clientY: 0 }]),
          );
          fireEvent.touchEnd(
            document.body,
            createTouches([{ identifier: 1, clientX: 700, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([40, 70]);
        });

        it('maintains minimum steps between values when swapping', async () => {
          await render(
            <Slider.Root
              defaultValue={[20, 40, 60]}
              minStepsBetweenValues={10}
              thumbCollisionBehavior="swap"
              style={{
                width: '1000px',
              }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb index={0} data-testid="thumb1" />
                  <Slider.Thumb index={1} />
                  <Slider.Thumb index={2} />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>,
          );

          const sliderControl = screen.getByTestId('control');

          vi.spyOn(sliderControl, 'getBoundingClientRect').mockImplementation(() =>
            getHorizontalSliderRect(1000),
          );

          fireEvent.touchStart(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 200, clientY: 0 }]),
          );
          fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 500, clientY: 0 }]),
          );
          fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 550, clientY: 0 }]),
          );
          fireEvent.touchMove(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 800, clientY: 0 }]),
          );
          fireEvent.touchEnd(
            sliderControl,
            createTouches([{ identifier: 1, clientX: 800, clientY: 0 }]),
          );

          expect(getSliderValues()).toEqual([30, 50, 80]);
        });
      });
    });

    describe('positions the thumb when the controlled value changes externally', () => {
      it('single thumb', async () => {
        function App() {
          const [val, setVal] = React.useState(20);
          return (
            <React.Fragment>
              <button onClick={() => setVal(55)} />
              <Slider.Root
                value={val}
                onValueChange={(newVal) => setVal(newVal as number)}
                style={{
                  width: '100px',
                }}
              >
                <Slider.Control data-testid="control">
                  <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb data-testid="thumb" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </React.Fragment>
          );
        }
        await render(<App />);

        const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));
        expect(thumbStyles.getPropertyValue('left')).toBe('20px');

        fireEvent.click(screen.getByRole('button'));
        expect(thumbStyles.getPropertyValue('left')).toBe('55px');
      });

      it('multiple thumbs', async () => {
        function App() {
          const [val, setVal] = React.useState([20, 50]);
          return (
            <React.Fragment>
              <button onClick={() => setVal([33, 72])} />
              <Slider.Root
                value={val}
                onValueChange={(newVal) => setVal(newVal as number[])}
                style={{
                  width: '100px',
                }}
              >
                <Slider.Control data-testid="control">
                  <Slider.Track>
                    <Slider.Indicator />
                    <Slider.Thumb data-testid="thumb" />
                    <Slider.Thumb data-testid="thumb" />
                  </Slider.Track>
                </Slider.Control>
              </Slider.Root>
            </React.Fragment>
          );
        }
        await render(<App />);

        const computedStyles = {
          thumb1: getComputedStyle(screen.getAllByTestId('thumb')[0]),
          thumb2: getComputedStyle(screen.getAllByTestId('thumb')[1]),
        };

        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('20px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('50px');

        fireEvent.click(screen.getByRole('button'));
        expect(computedStyles.thumb1.getPropertyValue('left')).toBe('33px');
        expect(computedStyles.thumb2.getPropertyValue('left')).toBe('72px');
      });
    });

    it('thumb should not go out of bounds when the controlled value goes out of bounds', async () => {
      function App() {
        const [val, setVal] = React.useState(50);
        return (
          <React.Fragment>
            <button onClick={() => setVal(119.9)}>max</button>
            <button onClick={() => setVal(-7.31)}>min</button>
            <Slider.Root
              value={val}
              onValueChange={setVal}
              min={0}
              max={100}
              style={{ width: '100px' }}
            >
              <Slider.Control data-testid="control">
                <Slider.Track>
                  <Slider.Indicator />
                  <Slider.Thumb data-testid="thumb" />
                </Slider.Track>
              </Slider.Control>
            </Slider.Root>
          </React.Fragment>
        );
      }
      const { user } = await render(<App />);

      const thumbStyles = getComputedStyle(screen.getByTestId('thumb'));
      expect(thumbStyles.getPropertyValue('left')).toBe('50px');

      await user.click(screen.getByRole('button', { name: 'max' }));
      expect(thumbStyles.getPropertyValue('left')).toBe('100px');

      await user.click(screen.getByRole('button', { name: 'min' }));
      expect(thumbStyles.getPropertyValue('left')).toBe('0px');
    });
  });

  describe.skipIf(isJSDOM)('server-side rendering', () => {
    it('single thumb', async () => {
      await renderToString(
        <Slider.Root
          defaultValue={30}
          style={{
            width: '100px',
          }}
        >
          <Slider.Value />
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      expect(getComputedStyle(screen.getByTestId('thumb')).getPropertyValue('left')).toBe('30px');
    });

    it('renders the inline pre-hydration script for edge-aligned thumbs', async () => {
      await renderToString(
        <Slider.Root
          defaultValue={30}
          thumbAlignment="edge"
          style={{
            width: '100px',
          }}
        >
          <Slider.Value />
          <Slider.Control>
            <Slider.Track>
              <Slider.Indicator />
              <Slider.Thumb data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      expect(document.querySelector('script')).not.toBe(null);
    });

    it('multiple thumbs', async () => {
      renderToString(
        <Slider.Root
          defaultValue={[30, 40]}
          style={{
            width: '100px',
          }}
        >
          <Slider.Value />
          <Slider.Control>
            <Slider.Track>
              <Slider.Thumb index={0} data-testid="thumb" />
              <Slider.Thumb index={1} data-testid="thumb" />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>,
      );

      const [thumb0, thumb1] = Array.from(await screen.findAllByTestId('thumb'));

      expect(getComputedStyle(thumb0).getPropertyValue('left')).toBe('30px');
      expect(getComputedStyle(thumb1).getPropertyValue('left')).toBe('40px');
    });
  });
});
