import { expect, vi } from 'vitest';
import * as React from 'react';
import { screen, fireEvent, act } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

describe('<NumberField.Increment />', () => {
  const { render, clock } = createRenderer();

  describeConformance(<NumberField.Increment />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has increase label', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Increment />
      </NumberField.Root>,
    );
    expect(screen.queryByLabelText('Increase')).not.toBe(null);
  });

  it('increments starting from 0 click', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('0');
  });

  it('increments to 1 starting from defaultValue=0 click', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('1');
  });

  it('seeds an empty fully-negative range in range on first increment', async () => {
    await render(
      <NumberField.Root min={-10} max={-5}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );
    fireEvent.click(screen.getByRole('button'));
    // First step on an empty field seeds the in-range value nearest 0 (the max here), not 0.
    expect(screen.getByRole('textbox')).toHaveValue('-5');
  });

  it('first increment after external controlled update', async () => {
    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root value={value} onValueChange={setValue}>
          <NumberField.Input />
          <NumberField.Increment />
          <button onClick={() => setValue(1.23456)}>external</button>
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    await user.click(screen.getByText('external'));
    expect(input).toHaveValue((1.23456).toLocaleString());

    await user.click(increase);
    expect(input).toHaveValue((2.23456).toLocaleString());
  });

  it('increments uncontrolled defaultValue from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    const { user } = await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    expect(input).toHaveValue((1.23456).toLocaleString());

    await user.click(screen.getByLabelText('Increase'));

    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([2.23456]);
    expect(input).toHaveValue((2.23456).toLocaleString());
  });

  it('increments from numeric state after typed precision is formatted on blur', async () => {
    const onValueChange = vi.fn();

    const { user } = await render(
      <NumberField.Root onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    await user.click(input);
    await user.keyboard('1.23456');
    fireEvent.blur(input);

    expect(input).toHaveValue((1.23456).toLocaleString());

    await user.click(increase);
    expect(input).toHaveValue((2.23456).toLocaleString());

    await user.click(increase);
    expect(onValueChange.mock.lastCall?.[0]).toBe(3.23456);
    expect(input).toHaveValue((3.23456).toLocaleString());
  });

  it('advances by a step finer than 3 fraction digits', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(0);
      return (
        <NumberField.Root
          value={value}
          step={0.0001}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Increase');

    // A step smaller than the old 3-digit default used to round back to 0, making this a no-op.
    await user.click(increase);
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
    expect(input).toHaveValue('0');

    await user.click(increase);
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0002);
    expect(input).toHaveValue('0');
  });

  it('cleans binary floating point noise introduced by stepping', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={0.7} step={0.1} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>,
    );

    fireEvent.click(screen.getByLabelText('Increase'));

    // 0.7 + 0.1 === 0.7999999999999999 in binary floating point.
    expect(onValueChange.mock.lastCall?.[0]).toBe(0.8);
  });

  it('preserves large fractional values when stepping cleanup would be too coarse', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(100000000000000.1);
      return (
        <NumberField.Root
          value={value}
          step={0.1}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);

    await user.click(screen.getByLabelText('Increase'));

    expect(onValueChange.mock.lastCall?.[0]).toBe(100000000000000.1 + 0.1);
  });

  it('does not commit a stale value when a synced increment is canceled after an external change', async () => {
    const onValueCommitted = vi.fn();
    let cancelNextChange = false;

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(0);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val, details) => {
            if (cancelNextChange) {
              details.cancel();
              return;
            }
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
          <NumberField.Increment />
          <button onClick={() => setValue(10)}>external</button>
        </NumberField.Root>
      );
    }

    await render(<Controlled />);
    const increase = screen.getByLabelText('Increase');

    // A prior committed increment populates the internal `lastChangedValueRef` (1).
    fireEvent.click(increase);
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

    // The controlled value changes externally to 10.
    fireEvent.click(screen.getByText('external'));

    // Canceling the next increment must not commit the stale earlier value (1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    fireEvent.click(increase);

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('only calls onValueChange once per increment', async () => {
    const handleValueChange = vi.fn();
    const { user } = await render(
      <NumberField.Root onValueChange={handleValueChange}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');

    await user.click(button);
    expect(handleValueChange.mock.calls.length).toBe(1);

    await user.click(button);
    expect(handleValueChange.mock.calls.length).toBe(2);
  });

  describe('press and hold', () => {
    clock.withFakeTimers();

    it('increments continuously when holding pointerdown', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.pointerUp(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });

    it('stops calling onValueChange once max is reached', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={9} max={10} onValueChange={handleValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      fireEvent.pointerUp(button);
    });

    it('commits on release after a hold reaches the boundary', async () => {
      const onValueCommitted = vi.fn();
      await render(
        <NumberField.Root defaultValue={9} max={10} onValueCommitted={onValueCommitted}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button);
      clock.tick(START_AUTO_CHANGE_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('10');
      expect(onValueCommitted).not.toHaveBeenCalled();

      fireEvent.pointerUp(button);

      expect(onValueCommitted.mock.calls.length).toBe(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('does not commit a stale value when the first hold tick is canceled after dirty input', async () => {
      const onValueCommitted = vi.fn();
      let cancelNextChange = false;

      function Controlled() {
        const [value, setValue] = React.useState<number | null>(0);
        return (
          <NumberField.Root
            value={value}
            onValueChange={(nextValue, details) => {
              if (cancelNextChange) {
                details.cancel();
                cancelNextChange = false;
                return;
              }
              setValue(nextValue);
            }}
            onValueCommitted={onValueCommitted}
          >
            <NumberField.Input />
            <NumberField.Increment />
            <button onClick={() => setValue(10)}>external</button>
          </NumberField.Root>
        );
      }

      await render(<Controlled />);
      const button = screen.getByLabelText('Increase');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

      fireEvent.click(screen.getByText('external'));
      expect(input).toHaveValue('10');

      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '-' } });
      expect(input).toHaveValue('-');

      cancelNextChange = true;
      fireEvent.pointerDown(button);
      fireEvent.pointerUp(button);

      expect(onValueCommitted.mock.calls.length).toBe(2);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
    });

    it('does not increment twice with pointerdown and click', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      fireEvent.pointerUp(button);
      fireEvent.click(button, { detail: 1 });

      expect(input).toHaveValue('1');
    });

    it('should stop incrementing after mouseleave', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });

    it('should start incrementing again after mouseleave then mouseenter', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseEnter(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x5

      expect(input).toHaveValue('5');
    });

    it('should not start incrementing again after mouseleave then mouseenter after pointerup', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('4');

      fireEvent.pointerUp(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');

      fireEvent.mouseEnter(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('4');
    });
  });

  it('should not increment when readOnly', async () => {
    await render(
      <NumberField.Root readOnly>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('should increment when input is dirty but not blurred (click)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    await act(() => input.focus());

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button'));

    expect(input).toHaveValue('101');
  });

  it('should increment when input is dirty but not blurred (pointerdown)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    await act(() => input.focus());

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.pointerDown(screen.getByRole('button'));

    expect(input).toHaveValue('101');
  });

  it('treats pen pointer as touch-like', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox');

    fireEvent.pointerDown(button, { pointerType: 'pen', button: 0 });

    expect(document.activeElement).not.toBe(input);
  });

  it('always increments on quick touch (touchend that occurs before TOUCH_TIMEOUT)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox');

    fireEvent.touchStart(button);
    fireEvent.mouseEnter(button);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button, { detail: 1 });
    fireEvent.touchEnd(button);

    expect(input).toHaveValue('1');

    fireEvent.touchStart(button);
    // No mouseenter occurs after the first focus
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.click(button, { detail: 1 });
    fireEvent.touchEnd(button);

    expect(input).toHaveValue('2');
  });

  it.skipIf(isJSDOM)('fires onValueCommitted once on first soft tap (touch)', async () => {
    const onValueCommitted = vi.fn();
    await render(
      <NumberField.Root defaultValue={0} onValueCommitted={onValueCommitted}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByLabelText('Increase');

    // Simulate the typical sequence with a 300ms tap delay producing mouse compatibility events
    fireEvent.touchStart(button);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    // No movement; quick tap
    fireEvent.touchEnd(button);
    // Compatibility mouse events and click
    fireEvent.mouseEnter(button);
    fireEvent.click(button, { detail: 1 });

    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.calls[0][0]).toBe(1);
  });

  describe('prop: snapOnStep', () => {
    it('does not emit a snapped intermediate when committing dirty text before a step', async () => {
      const onValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={0} step={2} snapOnStep onValueChange={onValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      await act(async () => input.focus());

      fireEvent.change(input, { target: { value: '7' } });
      onValueChange.mockClear();
      fireEvent.click(button);

      // The dirty "7" must not be directionally snapped to 6 before the increment runs.
      const values = onValueChange.mock.calls.map((call) => call[0]);
      expect(values).not.toContain(6);
      expect(input).toHaveValue('8');
    });

    it('should increment by exact step without rounding when snapOnStep is false', async () => {
      await render(
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((4.7).toLocaleString());
    });

    it('should snap on increment when snapOnStep is true', async () => {
      await render(
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '1.9' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('0');
    });

    it('seeds an empty field in range without directional snapping', async () => {
      await render(
        <NumberField.Root min={-10} max={-5} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      fireEvent.click(screen.getByRole('button'));
      // The first step seeds the in-range value nearest 0 (the max here). It isn't a step from a
      // previous value, so it must not be directionally snapped (which would land on -6).
      expect(screen.getByRole('textbox')).toHaveValue('-5');
    });

    it('should increment with respect to the min value', async () => {
      await render(
        <NumberField.Root defaultValue={1} min={1} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(input).toHaveValue('3');

      fireEvent.click(button);
      expect(input).toHaveValue('5');

      fireEvent.change(input, { target: { value: '1.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('3');

      fireEvent.change(input, { target: { value: '0.999' } });
      fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });

  describe('disabled state', () => {
    it('exposes aria-controls on the stepper', async () => {
      await render(
        <NumberField.Root readOnly>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-controls', input.id);
    });

    it('should not increment when root is disabled', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root disabled onValueChange={handleValueChange}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not increment when button is disabled', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={0} onValueChange={handleValueChange}>
          <NumberField.Increment disabled />
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
      expect(input).toHaveValue('0');

      fireEvent.pointerDown(button);
      expect(handleValueChange.mock.calls.length).toBe(0);
      expect(input).toHaveValue('0');
    });

    describe('prop: className', () => {
      it('when root is disabled', async () => {
        const classNameSpy = vi.fn();
        await render(
          <NumberField.Root disabled>
            <NumberField.Increment className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>,
        );

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });

      it('when button is disabled', async () => {
        const classNameSpy = vi.fn();
        await render(
          <NumberField.Root>
            <NumberField.Increment disabled className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>,
        );

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });
    });
  });
});
