import { expect, vi } from 'vitest';
import * as React from 'react';
import { screen, fireEvent, act } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

describe('<NumberField.Decrement />', () => {
  const { render, clock } = createRenderer();

  describeConformance(<NumberField.Decrement />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has decrease label', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Decrement />
      </NumberField.Root>,
    );
    expect(screen.queryByLabelText('Decrease')).not.toBe(null);
  });

  it('decrements starting from 0 click', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('0');
  });

  it('decrements to -1 starting from defaultValue=0 click', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('-1');
  });

  it('first decrement after external controlled update', async () => {
    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root value={value} onValueChange={setValue}>
          <NumberField.Input />
          <NumberField.Decrement />
          <button onClick={() => setValue(1.23456)}>external</button>
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');
    const increase = screen.getByLabelText('Decrease');

    await user.click(screen.getByText('external'));
    expect(input).toHaveValue((1.23456).toLocaleString());

    await user.click(increase);
    expect(input).toHaveValue((0.23456).toLocaleString());
  });

  it('decrements uncontrolled defaultValue from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    const { user } = await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Decrement />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    expect(input).toHaveValue((1.23456).toLocaleString());

    await user.click(screen.getByLabelText('Decrease'));

    expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([0.23456]);
    expect(input).toHaveValue((0.23456).toLocaleString());
  });

  it('does not commit a stale value when a synced decrement is canceled after an external change', async () => {
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
          <NumberField.Decrement />
          <button onClick={() => setValue(10)}>external</button>
        </NumberField.Root>
      );
    }

    await render(<Controlled />);
    const decrease = screen.getByLabelText('Decrease');

    // A prior committed decrement populates the internal `lastChangedValueRef` (-1).
    fireEvent.click(decrease);
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(-1);

    // The controlled value changes externally to 10.
    fireEvent.click(screen.getByText('external'));

    // Canceling the next decrement must not commit the stale earlier value (-1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    fireEvent.click(decrease);

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('only calls onValueChange once per decrement', async () => {
    const handleValueChange = vi.fn();
    const { user } = await render(
      <NumberField.Root onValueChange={handleValueChange}>
        <NumberField.Decrement />
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

    it('decrements continuously when holding pointerdown', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('-1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('-4');

      fireEvent.pointerUp(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');
    });

    it('stops calling onValueChange once min is reached', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={-9} min={-10} onValueChange={handleValueChange}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('-10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY);
      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-10');
      expect(handleValueChange.mock.calls.length).toBe(1);

      fireEvent.pointerUp(button);
    });

    it('does not decrement twice with pointerdown and click', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1
      fireEvent.pointerUp(button);
      fireEvent.click(button, { detail: 1 });

      expect(input).toHaveValue('-1');
    });

    it('should stop decrementing after mouseleave', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('-1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('-4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');
    });

    it('should start decrementing again after mouseleave then mouseenter', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('-1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('-4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');

      fireEvent.mouseEnter(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x5

      expect(input).toHaveValue('-5');
    });

    it('should not start decrementing again after mouseleave then mouseenter after pointerup', async () => {
      await render(
        <NumberField.Root defaultValue={0}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.pointerDown(button); // onChange x1

      expect(input).toHaveValue('-1');

      clock.tick(START_AUTO_CHANGE_DELAY);

      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x2
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x3
      clock.tick(CHANGE_VALUE_TICK_DELAY); // onChange x4

      expect(input).toHaveValue('-4');

      fireEvent.pointerUp(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');

      fireEvent.mouseLeave(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');

      fireEvent.mouseEnter(button);

      clock.tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('-4');
    });
  });

  it('should not decrement when readOnly', async () => {
    await render(
      <NumberField.Root readOnly>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('should decrement when input is dirty but not blurred (click)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    await act(() => input.focus());

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button'));

    expect(input).toHaveValue('99');
  });

  it('should decrement when input is dirty but not blurred (pointerdown)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    await act(() => input.focus());

    fireEvent.change(input, { target: { value: '100' } });
    fireEvent.pointerDown(screen.getByRole('button'));

    expect(input).toHaveValue('99');
  });

  it('always decrements on quick touch (touchend that occurs before TOUCH_TIMEOUT)', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    const input = screen.getByRole('textbox');

    fireEvent.touchStart(button);
    fireEvent.mouseEnter(button);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.touchEnd(button);
    fireEvent.click(button, { detail: 1 });

    expect(input).toHaveValue('-1');

    fireEvent.touchStart(button);
    // No mouseenter occurs after the first focus
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.touchEnd(button);
    fireEvent.click(button, { detail: 1 });

    expect(input).toHaveValue('-2');
  });

  it.skipIf(isJSDOM)('fires onValueCommitted once on first soft tap (touch)', async () => {
    const onValueCommitted = vi.fn();
    await render(
      <NumberField.Root defaultValue={0} onValueCommitted={onValueCommitted}>
        <NumberField.Decrement />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByLabelText('Decrease');

    fireEvent.touchStart(button);
    fireEvent.pointerDown(button, { pointerType: 'touch' });
    fireEvent.touchEnd(button);
    fireEvent.mouseEnter(button);
    fireEvent.click(button, { detail: 1 });

    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.calls[0][0]).toBe(-1);
  });

  describe('prop: snapOnStep', () => {
    it('should decrement by exact step without rounding when snapOnStep is false', async () => {
      await render(
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((0.7).toLocaleString());
    });

    it('should snap on decrement when snapOnStep is true', async () => {
      await render(
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '1.9' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.change(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('-1');
    });

    it('should decrement with respect to the min value', async () => {
      await render(
        <NumberField.Root defaultValue={8} min={1} step={2} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(input).toHaveValue('7');

      fireEvent.click(button);
      expect(input).toHaveValue('5');

      fireEvent.change(input, { target: { value: '9.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('9');

      fireEvent.change(input, { target: { value: '1.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });

  describe('disabled state', () => {
    it('should not decrement when root is disabled', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root disabled onValueChange={handleValueChange}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      fireEvent.click(button);
      expect(screen.getByRole('textbox')).toHaveValue('');
      expect(handleValueChange.mock.calls.length).toBe(0);
    });

    it('should not decrement when button is disabled', async () => {
      const handleValueChange = vi.fn();
      await render(
        <NumberField.Root defaultValue={0} onValueChange={handleValueChange}>
          <NumberField.Decrement disabled />
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
            <NumberField.Decrement className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>,
        );

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });

      it('when button is disabled', async () => {
        const classNameSpy = vi.fn();
        await render(
          <NumberField.Root>
            <NumberField.Decrement disabled className={classNameSpy} />
            <NumberField.Input />
          </NumberField.Root>,
        );

        expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
      });
    });
  });
});
