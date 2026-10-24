import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, screen, fireEvent } from '@mui/internal-test-utils';
import { NumberField } from '@base-ui/react/number-field';
import { createRenderer, describeConformance } from '#test-utils';

describe('<NumberField.Input />', () => {
  const { render } = createRenderer();

  function pasteWithError(target: HTMLElement, error: Error) {
    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData() {
          throw error;
        },
      },
    });

    fireEvent(target, pasteEvent);

    return pasteEvent;
  }

  describeConformance(<NumberField.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  it('has textbox role', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    expect(screen.queryByRole('textbox')).not.toBe(null);
  });

  it('should not allow non-numeric characters on change', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(input).toHaveValue('');
  });

  it('should not allow non-numeric characters on keydown', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'a' });
    expect(input).toHaveValue('');
  });

  it('should allow numeric characters on change', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '123' } });
    expect(input).toHaveValue('123');
  });

  it('should increment on keydown ArrowUp', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input).toHaveValue('1');
  });

  it('should decrement on keydown ArrowDown', async () => {
    await render(
      <NumberField.Root defaultValue={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveValue('-1');
  });

  it('should set the value to min on keydown Home', async () => {
    await render(
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'Home' });
    expect(input).toHaveValue('-10');
  });

  it('should set the value to max on keydown End', async () => {
    await render(
      <NumberField.Root min={-10} max={10}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'End' });
    expect(input).toHaveValue('10');
  });

  it('uses smallStep and snapOnStep when holding Alt with ArrowUp/ArrowDown', async () => {
    await render(
      <NumberField.Root defaultValue={0.15} smallStep={0.1} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });
    expect(input).toHaveValue('0.3');
    fireEvent.keyDown(input, { key: 'ArrowDown', altKey: true });
    expect(input).toHaveValue('0.2');
  });

  it('advances by a smallStep finer than 3 fraction digits', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(0);
      return (
        <NumberField.Root
          value={value}
          smallStep={0.0001}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    await render(<Controlled />);

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    fireEvent.keyDown(input, { key: 'ArrowUp', altKey: true });

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0001);
    expect(input).toHaveValue('0');
  });

  it('increments with keyboard from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => input.focus());

    // Synced display shows the rounded `1.235`; stepping must advance the full-precision
    // numeric value (matching the button path), not the parsed display string.
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('decrements with keyboard from numeric state, not rounded display text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root defaultValue={1.23456} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => input.focus());

    // ArrowDown must step from the full-precision numeric value (0.23456), not the rounded
    // display (which would yield 0.235).
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.23456);
  });

  it('increments with keyboard from numeric state after a no-edit blur cycle', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => input.focus());
    await user.keyboard('1.23456');
    fireEvent.blur(input);
    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => input.focus());
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('steps keyboard from dirty input text when the controlled value lags onValueChange', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    // The parent intentionally never mirrors `onValueChange` back into `value`, so the numeric
    // state stays 0 while the visible text is dirty.
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);

    // ArrowUp must step from the dirty text (1.5 -> 2.5), not the stale numeric state (0 -> 1).
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('does not commit a stale value when a synced keyboard step is canceled after an external change', async () => {
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
          <button onClick={() => setValue(10)}>external</button>
        </NumberField.Root>
      );
    }

    await render(<Controlled />);
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    // A prior committed keyboard step populates the internal `lastChangedValueRef` (1).
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueCommitted.mock.calls.length).toBe(1);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);

    // The controlled value changes externally to 10.
    fireEvent.click(screen.getByText('external'));

    // Canceling the next keyboard step must not commit the stale earlier value (1): the synced
    // path now refreshes the commit ref to the current value before stepping.
    cancelNextChange = true;
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onValueCommitted.mock.calls.length).toBe(1);
  });

  it('keeps dirty-input authority after a non-mutating key so the next keyboard step uses dirty text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    // Dirty text the parent never mirrors back into `value` (still 0).
    fireEvent.change(input, { target: { value: '1.5' } });

    // A non-mutating navigation key must not mark the input as synced.
    fireEvent.keyDown(input, { key: 'ArrowLeft' });

    // ArrowUp must still step from the dirty text (1.5 -> 2.5), not the stale numeric state.
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('keeps dirty-input authority after a non-mutating key so a button step uses dirty text', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
        <NumberField.Increment />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    fireEvent.change(input, { target: { value: '1.5' } });
    fireEvent.keyDown(input, { key: 'ArrowLeft' });

    // The button commits the dirty text before stepping, so it must step from 1.5, not 0.
    fireEvent.click(screen.getByLabelText('Increase'));
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.5);
  });

  it('commits dirty text on blur after a cursor key when the controlled value does not mirror it', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root value={0} onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    // Parent never mirrors onValueChange, so the numeric state stays 0 while the text is dirty.
    fireEvent.change(input, { target: { value: '5' } });
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);

    // A cursor key must not clear dirty authority, so blur commits the typed text (5) rather
    // than silently reverting to the stale numeric state (0).
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    onValueChange.mockClear();
    fireEvent.blur(input);
    expect(onValueChange.mock.lastCall?.[0]).toBe(5);
  });

  it('allows unicode plus/minus, permille and fullwidth digits on keydown when formatted as percent', async () => {
    await render(
      <NumberField.Root format={{ style: 'percent' }}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('−')).toBe(true); // MINUS SIGN U+2212
    expect(dispatchKey('＋')).toBe(true); // FULLWIDTH PLUS SIGN U+FF0B
    expect(dispatchKey('‰')).toBe(true);
    expect(dispatchKey('１')).toBe(true);
  });

  it('blocks percent and permille symbols on keydown when not formatted as percent', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    function dispatchKey(key: string) {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    }

    expect(dispatchKey('%')).toBe(false);
    expect(dispatchKey('‰')).toBe(false);
  });

  it('applies locale-aware decimal/group gating (de-DE)', async () => {
    await render(
      <NumberField.Root locale="de-DE">
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // de-DE: decimal is ',' and group is '.'
    // First comma is allowed
    expect(dispatchKey(',')).toBe(true);
    // Simulate a typical user value with a digit before decimal to let change handler accept it
    fireEvent.change(input, { target: { value: '1,' } });
    expect(input).toHaveValue('1,');

    // Second comma should be blocked
    expect(dispatchKey(',')).toBe(false);

    // Grouping '.' should be allowed multiple times
    expect(dispatchKey('.')).toBe(true);
    fireEvent.change(input, { target: { value: '1.,' } });
    expect(dispatchKey('.')).toBe(true);
  });

  it('allows space key when locale uses space-like grouping (pl-PL)', async () => {
    await render(
      <NumberField.Root locale="pl-PL">
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    await act(async () => input.focus());

    const dispatchKey = (key: string) => {
      const evt = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      return input.dispatchEvent(evt);
    };

    // pl-PL grouping is a space-like character; typing plain space from keyboard should be allowed
    expect(dispatchKey(' ')).toBe(true);

    // Simulate a typical user value using a regular space as group
    fireEvent.change(input, { target: { value: '1 234' } });
    expect(input).toHaveValue('1 234');
  });

  it('commits formatted value only on blur', async () => {
    await render(
      <NumberField.Root>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '1234' } });
    expect(input).toHaveValue('1234');
    fireEvent.blur(input);
    expect(input).toHaveValue((1234).toLocaleString());
  });

  it('should commit validated number on blur (min)', async () => {
    await render(
      <NumberField.Root min={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '-1' } });
    expect(input).toHaveValue('-1');
    fireEvent.blur(input);
    expect(input).toHaveValue('0');
  });

  it('should commit validated number on blur (max)', async () => {
    await render(
      <NumberField.Root max={0}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '1' } });
    expect(input).toHaveValue('1');
    fireEvent.blur(input);
    expect(input).toHaveValue('0');
  });

  it('should not snap number to step on blur', async () => {
    await render(
      <NumberField.Root step={0.5} snapOnStep>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '1.5' } });
    expect(input).toHaveValue('1.5');
    fireEvent.blur(input);
    expect(input).toHaveValue((1.5).toLocaleString());
  });

  it('should commit validated number on blur (step and min)', async () => {
    await render(
      <NumberField.Root min={2} step={2}>
        <NumberField.Input />
      </NumberField.Root>,
    );
    const input = screen.getByRole('textbox');
    await act(async () => input.focus());
    fireEvent.change(input, { target: { value: '3' } });
    expect(input).toHaveValue('3');
    fireEvent.blur(input);
    expect(input).toHaveValue('3');
  });

  it('should preserve default formatting on first blur after external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.23456 });
    });

    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => {
      input.focus();
      input.blur();
    });

    // A focus/blur with no edits must not re-parse the rounded display text and overwrite the
    // numeric value: the display is purely visual formatting.
    expect(input).toHaveValue((1.23456).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should update input value after increment/decrement followed by external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(0);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
          <NumberField.Decrement />
          <button onClick={() => setValue(1.23456)}>external</button>
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');
    const incrementButton = screen.getByLabelText('Increase');

    expect(input).toHaveValue('0');

    await user.click(incrementButton);

    expect(input).toHaveValue('1');
    expect(onValueChange.mock.calls.length).toBe(1);

    await user.click(screen.getByText('external'));

    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should update input value after decrement followed by external value change', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(5);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <NumberField.Increment />
          <NumberField.Decrement />
          <button onClick={() => setValue(2.98765)}>external</button>
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');
    const decrementButton = screen.getByLabelText('Decrease');

    expect(input).toHaveValue('5');

    await user.click(decrementButton);

    expect(input).toHaveValue('4');
    expect(onValueChange.mock.calls.length).toBe(1);

    await user.click(screen.getByText('external'));

    expect(input).toHaveValue((2.98765).toLocaleString());
  });

  it('should allow typing after default formatting on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.23456 });
    });

    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => {
      input.focus();
    });

    await user.clear(input);
    await user.keyboard('1.234567');
    expect(input).toHaveValue('1.234567');

    fireEvent.blur(input);
    expect(input).toHaveValue((1.234567).toLocaleString());
  });

  it('should format to default canonical representation on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.23456 });
    });

    expect(input).toHaveValue((1.23456).toLocaleString());

    await act(async () => {
      input.focus();
    });

    await user.clear(input);
    await user.keyboard('1.23456000');
    expect(input).toHaveValue('1.23456000');

    fireEvent.blur(input);
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should handle multiple blur cycles with default formatting', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.23456789 });
    });

    expect(input).toHaveValue((1.23456789).toLocaleString());

    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);

    await act(async () => {
      input.focus();
      input.blur();
    });

    // Repeated no-edit blur cycles keep the full-precision numeric value; only the display
    // stays formatted to the Intl default.
    expect(input).toHaveValue((1.23456789).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(0);
  });

  it('should handle edge case where parsed value equals current value but input differs', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} onValueChange={onValueChange}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps, user } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.5 });
    });

    expect(input).toHaveValue((1.5).toLocaleString());

    await act(async () => {
      input.focus();
    });

    await user.clear(input);
    await user.keyboard('1.50');
    expect(input).toHaveValue('1.50');

    fireEvent.blur(input);
    expect((input as HTMLInputElement).value).toMatch(/^1[.,]5/);
  });

  it('should apply default formatting after external change during typing', async () => {
    const onValueChange = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
        >
          <NumberField.Input />
          <button onClick={() => setValue(3.14159265)}>set pi</button>
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });

    await user.keyboard('2.7');
    expect(input).toHaveValue('2.7');

    await user.click(screen.getByText('set pi'));

    expect(input).toHaveValue((3.14159265).toLocaleString());

    fireEvent.blur(input);
    expect(input).toHaveValue((3.14159265).toLocaleString());
  });

  it('should round to explicit maximumFractionDigits on blur', async () => {
    const onValueChange = vi.fn();

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root
          value={props.value}
          onValueChange={onValueChange}
          format={{ maximumFractionDigits: 2 }}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.23456 });
    });

    expect(input).toHaveValue((1.23).toLocaleString());

    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(input).toHaveValue((1.23).toLocaleString());
    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1.23);
  });

  async function renderControlledNumberField(
    format: Intl.NumberFormatOptions,
    locale: Intl.LocalesArgument = 'en-US',
    rootProps: { min?: number; max?: number; allowOutOfRange?: boolean } = {},
  ) {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(nextValue) => {
            onValueChange(nextValue);
            setValue(nextValue);
          }}
          onValueCommitted={onValueCommitted}
          format={format}
          locale={locale}
          {...rootProps}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });

    return { input, onValueChange, onValueCommitted, user };
  }

  it.each([
    ['en-US', '1.239'],
    ['fr-FR', '1,239'],
    ['ar-EG', '١٫٢٣٩'],
  ] as const)(
    'should respect roundingMode when rounding to explicit maximumFractionDigits on blur in %s',
    async (locale, inputText) => {
      const format = {
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      };

      const { input, onValueChange, user } = await renderControlledNumberField(format, locale);

      await user.keyboard(inputText);
      fireEvent.blur(input);

      expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
      expect(input).toHaveValue(new Intl.NumberFormat(locale, format).format(1.239));
    },
  );

  it('should not throw on blur when format uses roundingIncrement with fixed fraction digits', async () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    await render(
      <NumberField.Root defaultValue={1.2} format={format}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    const expectedValue = new Intl.NumberFormat(undefined, format).format(1.2);

    expect(input).toHaveValue(expectedValue);

    await act(async () => {
      input.focus();
      input.blur();
    });

    expect(input).toHaveValue(expectedValue);
  });

  it('should commit roundingIncrement values on blur', async () => {
    const format = {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
      roundingIncrement: 5,
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('1.26');
    expect(onValueCommitted).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.5);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.5);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.26));
  });

  it('should commit significant digit rounded values on blur', async () => {
    const format = {
      maximumSignificantDigits: 3,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('12345');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(12300);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(12300);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(12345));
  });

  it('should preserve tiny percent significant digit rounded values on blur', async () => {
    const format = {
      style: 'percent',
      maximumSignificantDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.0001234%');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0000012);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0000012);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(0.000001234));
  });

  it('should commit roundingMode values on blur without explicit precision', async () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('1.2399');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.239);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.239);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.2399));
  });

  it('should format controlled values with rounding options after external value changes', async () => {
    const format = {
      minimumIntegerDigits: 1,
      roundingMode: 'floor',
    };

    function Controlled(props: { value: number | null }) {
      return (
        <NumberField.Root value={props.value} format={format}>
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { setProps } = await render(<Controlled value={null} />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      setProps({ value: 1.2399 });
    });

    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.2399));
  });

  it.each([
    [
      'percent',
      {
        style: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'percent with min-only precision',
      {
        style: 'percent',
        minimumFractionDigits: 2,
        roundingMode: 'floor',
      },
      0.0123,
    ],
    [
      'unit percent',
      {
        style: 'unit',
        unit: 'percent',
        maximumFractionDigits: 2,
        roundingMode: 'floor',
      },
      1.23,
    ],
  ] as const)('should round %s values on blur', async (_, format, expectedValue) => {
    const { input, onValueChange, user } = await renderControlledNumberField(format);

    await user.keyboard('1.239%');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(expectedValue);
    expect(input).toHaveValue('1.23%');
  });

  it('should parse locale prefix percent values on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;
    const formatted = new Intl.NumberFormat('tr-TR', format).format(0.0123);

    const { input, onValueChange, onValueCommitted } = await renderControlledNumberField(
      format,
      'tr-TR',
    );

    fireEvent.change(input, { target: { value: formatted } });
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0123);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0123);
    expect(input).toHaveValue(formatted);
  });

  it('should preserve exact percent precision boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.46%');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should preserve high-precision percent boundaries with directional roundingMode on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 16,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, onValueCommitted, user } =
      await renderControlledNumberField(format);

    await user.keyboard('0.46%');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.0046);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.0046);
    expect(input).toHaveValue('0.46%');
  });

  it('should commit the clamped value when blur rounding crosses a boundary', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
    } as const;

    const { input, onValueChange, onValueCommitted, user } = await renderControlledNumberField(
      format,
      'en-US',
      { max: 0.01235 },
    );

    await user.keyboard('1.236%');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(0.01235);
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(0.01235);
  });

  it('should round currency values on blur without percent scaling', async () => {
    const format = {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;

    const { input, onValueChange, user } = await renderControlledNumberField(format);

    await user.keyboard('1.239');
    fireEvent.blur(input);

    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23);
    expect(input).toHaveValue(new Intl.NumberFormat('en-US', format).format(1.239));
  });

  it('should not commit values that overflow while parsing on blur', async () => {
    const format = {
      style: 'percent',
      maximumFractionDigits: 2,
      roundingMode: 'floor',
    } as const;
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        format={format}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');
    const formattedOverflow = new Intl.NumberFormat('en-US', format).format(Number.MAX_VALUE);

    await act(async () => {
      input.focus();
    });
    fireEvent.change(input, { target: { value: formattedOverflow } });
    fireEvent.blur(input);

    expect(onValueChange).not.toHaveBeenCalled();
    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue(formattedOverflow);
  });

  it('should not commit a canceled blur change', async () => {
    const onValueChange = vi.fn((_nextValue, details) => {
      details.cancel();
    });
    const onValueCommitted = vi.fn();

    await render(
      <NumberField.Root
        value={0}
        format={{ maximumFractionDigits: 2 }}
        onValueChange={onValueChange}
        onValueCommitted={onValueCommitted}
      >
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });
    fireEvent.change(input, { target: { value: '1.239' } });
    fireEvent.blur(input);

    expect(onValueCommitted).not.toHaveBeenCalled();
    expect(input).toHaveValue('1.239');
  });

  it('should preserve default numeric precision while formatting display on blur', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });

    await user.keyboard('1.23456');
    expect(input).toHaveValue('1.23456');

    // Without explicit rounding options the numeric value keeps full precision rather than
    // being truncated to the Intl display default of 3 fraction digits.
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.23456);

    fireEvent.blur(input);

    // The committed value retains full precision, while the displayed text uses default formatting.
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.23456);
    expect(input).toHaveValue((1.23456).toLocaleString());
  });

  it('should preserve values typed with more than 15 significant digits', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });

    // Parsed input gets no rounding or cleanup beyond standard JS number parsing, so every
    // digit the resulting `number` can represent is preserved (here all 16 typed digits).
    await user.keyboard('1.234567890123456');
    expect(input).toHaveValue('1.234567890123456');
    expect(onValueChange.mock.lastCall?.[0]).toBe(1.234567890123456);

    fireEvent.blur(input);

    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.234567890123456);
    expect(input).toHaveValue((1.234567890123456).toLocaleString());
  });

  it('keeps full numeric precision across no-edit focus/blur cycles and subsequent stepping', async () => {
    const onValueChange = vi.fn();
    const onValueCommitted = vi.fn();

    function Controlled() {
      const [value, setValue] = React.useState<number | null>(null);
      return (
        <NumberField.Root
          value={value}
          onValueChange={(val) => {
            onValueChange(val);
            setValue(val);
          }}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Input />
          <NumberField.Increment />
        </NumberField.Root>
      );
    }

    const { user } = await render(<Controlled />);
    const input = screen.getByRole('textbox');

    await act(async () => {
      input.focus();
    });
    await user.keyboard('1.23456');
    fireEvent.blur(input);

    // Display rounds to the Intl default; the committed numeric value keeps full precision.
    expect(input).toHaveValue((1.23456).toLocaleString());
    expect(onValueCommitted.mock.lastCall?.[0]).toBe(1.23456);

    // Re-focusing and blurring without edits must not re-parse the rounded display text and
    // collapse the stored value, so no new commit fires.
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(onValueCommitted.mock.calls.length).toBe(1);

    // Stepping advances from the full-precision numeric value (2.23456), not the rounded
    // display, which would have yielded 2.235.
    await user.click(screen.getByLabelText('Increase'));
    expect(onValueChange.mock.lastCall?.[0]).toBe(2.23456);
  });

  it('commits parsed value on blur and normalizes display for fr-FR', async () => {
    const onValueChange = vi.fn();

    await render(
      <NumberField.Root locale="fr-FR" onValueChange={onValueChange}>
        <NumberField.Input />
      </NumberField.Root>,
    );

    const input = screen.getByRole<HTMLInputElement>('textbox');
    await act(async () => input.focus());

    fireEvent.change(input, { target: { value: '1234,5' } });
    expect(input).toHaveValue('1234,5');

    fireEvent.blur(input);

    expect(onValueChange.mock.calls.length).toBe(1);
    expect(onValueChange.mock.calls[0][0]).toBe(1234.5);

    expect(input.value).toBe((1234.5).toLocaleString('fr-FR'));
  });

  it('warns in development when clipboard text cannot be read during paste handling', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <NumberField.Root defaultValue={12}>
          <NumberField.Input />
        </NumberField.Root>,
      );

      const input = screen.getByRole('textbox');
      await act(async () => input.focus());

      const pasteEvent = pasteWithError(input, new DOMException('Blocked', 'SecurityError'));

      expect(input).toHaveValue('12');
      expect(pasteEvent.defaultPrevented).toBe(false);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Base UI: <NumberField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });
});
