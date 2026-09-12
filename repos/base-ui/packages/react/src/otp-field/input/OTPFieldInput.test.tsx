import { expect, vi } from 'vitest';
import * as React from 'react';
import userEvent from '@testing-library/user-event';
import { act, fireEvent, screen } from '@mui/internal-test-utils';
import { OTPField } from '@base-ui/react/otp-field';
import { Field } from '@base-ui/react/field';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<OTPField.Input />', () => {
  const { render } = createRenderer();
  const OTP_LENGTH = 6;
  const modifierKeys = [
    ['Ctrl', { ctrlKey: true }],
    ['Cmd', { metaKey: true }],
  ] as const;

  describeConformance(<OTPField.Input />, () => ({
    refInstanceof: window.HTMLInputElement,
    render(node) {
      return render(<OTPField.Root length={1}>{node}</OTPField.Root>);
    },
  }));

  type OTPFieldTestProps = Omit<OTPField.Root.Props, 'children' | 'length'>;

  function OTPFieldTest(props: OTPFieldTestProps = {}) {
    return (
      <OTPField.Root length={OTP_LENGTH} {...props}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <OTPField.Input key={index} />
        ))}
      </OTPField.Root>
    );
  }

  function pasteText(target: HTMLElement, value: string) {
    if (isJSDOM) {
      fireEvent.paste(target, {
        clipboardData: {
          getData: () => value,
        },
      });
      return;
    }

    const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(pasteEvent, 'clipboardData', {
      value: {
        getData: () => value,
      },
    });

    fireEvent(target, pasteEvent);
  }

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
  }

  it('renders one textbox per slot', async () => {
    await render(<OTPFieldTest />);

    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('moves focus with arrow keys', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    fireEvent.keyDown(inputs[2], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('moves focus with arrow keys in RTL', async () => {
    await render(
      <DirectionProvider direction="rtl">
        <OTPFieldTest defaultValue="12" />
      </DirectionProvider>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(inputs[2]);

    fireEvent.keyDown(inputs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('redirects focus to the first empty slot when a later empty slot is focused', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[4].focus();
    });

    expect(document.activeElement).toBe(inputs[2]);
  });

  it('moves focus to the next slot after typing', async () => {
    await render(<OTPFieldTest />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[0].focus();
    });

    fireEvent.change(inputs[0], { target: { value: '1' } });

    expect(document.activeElement).toBe(inputs[1]);
  });

  it('selects the last slot after typing into it for the first time', async () => {
    await render(<OTPFieldTest defaultValue="12345" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const lastInput = inputs[5];

    await act(async () => {
      lastInput.focus();
    });

    fireEvent.change(lastInput, { target: { value: '6' } });

    expect(document.activeElement).toBe(lastInput);
    expect(lastInput.selectionStart).toBe(0);
    expect(lastInput.selectionEnd).toBe(1);
  });

  it('keeps focus in place when typing is canceled', async () => {
    await render(
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[0].focus();
    });

    fireEvent.change(inputs[0], { target: { value: '1' } });

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps the filled slot selected when typing an invalid character', async () => {
    await render(<OTPFieldTest defaultValue="1" />);

    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      firstInput.focus();
    });

    fireEvent.change(firstInput, { target: { value: 'a' } });

    expect(firstInput).toHaveValue('1');
    expect(document.activeElement).toBe(firstInput);
    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('selects the slot value on mousedown', async () => {
    await render(<OTPFieldTest defaultValue="1" />);

    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    fireEvent.mouseDown(firstInput);

    expect(firstInput.selectionStart).toBe(0);
    expect(firstInput.selectionEnd).toBe(1);
  });

  it('moves focus to the next slot when typing the same character into a filled slot', async () => {
    const user = userEvent.setup();

    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    await user.keyboard('2');

    expect(document.activeElement).toBe(inputs[2]);
  });

  it.each([
    ['ArrowUp', 0],
    ['ArrowDown', 4],
  ] as const)('moves focus to the field boundary with %s', async (key, targetIndex) => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    expect(fireEvent.keyDown(inputs[1], { key })).toBe(false);
    expect(inputs[targetIndex]).toHaveFocus();
  });

  it('stops propagation when ArrowDown moves focus to the empty end slot', async () => {
    const onKeyDown = vi.fn();

    await render(
      <div onKeyDown={onKeyDown}>
        <OTPFieldTest defaultValue="1234" />
      </div>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    expect(fireEvent.keyDown(inputs[1], { key: 'ArrowDown' })).toBe(false);
    expect(onKeyDown).not.toHaveBeenCalled();
    expect(inputs[4]).toHaveFocus();
  });

  it('keeps focus on the empty end slot with ArrowDown', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[2].focus();
    });

    expect(fireEvent.keyDown(inputs[2], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[2]).toHaveFocus();
  });

  it('keeps focus on the final slot with ArrowDown when the value is complete', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[5].focus();
    });

    expect(fireEvent.keyDown(inputs[5], { key: 'ArrowDown' })).toBe(false);
    expect(inputs[5]).toHaveFocus();
  });

  it('does not reselect the final slot when typing the same character', async () => {
    const { user } = await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
    const lastInput = inputs[5];

    await act(async () => {
      lastInput.focus();
    });

    const select = vi.spyOn(lastInput, 'select');

    try {
      await user.keyboard('6');

      expect(select).not.toHaveBeenCalled();
      expect(lastInput).toHaveFocus();
    } finally {
      select.mockRestore();
    }
  });

  it('moves focus to the first slot with Home', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[3].focus();
    });

    fireEvent.keyDown(inputs[3], { key: 'Home' });

    expect(document.activeElement).toBe(inputs[0]);
  });

  it('moves focus to the empty end slot with End', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[0].focus();
    });

    fireEvent.keyDown(inputs[0], { key: 'End' });

    expect(document.activeElement).toBe(inputs[4]);
  });

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys',
    async (_, modifierKey) => {
      await render(<OTPFieldTest defaultValue="1234" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      await act(async () => {
        inputs[2].focus();
      });

      fireEvent.keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);

      fireEvent.keyDown(inputs[0], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);
    },
  );

  it.each(modifierKeys)(
    'moves focus to the field boundaries with %s + arrow keys in RTL',
    async (_, modifierKey) => {
      await render(
        <DirectionProvider direction="rtl">
          <OTPFieldTest defaultValue="1234" />
        </DirectionProvider>,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      await act(async () => {
        inputs[2].focus();
      });

      fireEvent.keyDown(inputs[2], { key: 'ArrowLeft', ...modifierKey });
      expect(document.activeElement).toBe(inputs[4]);

      fireEvent.keyDown(inputs[4], { key: 'ArrowRight', ...modifierKey });
      expect(document.activeElement).toBe(inputs[0]);
    },
  );

  it('keeps arrow and home/end navigation working in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[2]);

    fireEvent.keyDown(inputs[2], { key: 'Home' });
    expect(document.activeElement).toBe(inputs[0]);

    fireEvent.keyDown(inputs[0], { key: 'End' });
    expect(document.activeElement).toBe(inputs[4]);

    fireEvent.keyDown(inputs[4], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(inputs[0]);

    fireEvent.keyDown(inputs[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('leaves vertical arrow navigation unhandled in disabled mode', async () => {
    const onKeyDown = vi.fn();

    await render(
      <div onKeyDown={onKeyDown}>
        <OTPFieldTest defaultValue="12" disabled />
      </div>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    const arrowUpEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowUp',
    });
    const arrowDownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'ArrowDown',
    });

    expect(inputs[1].dispatchEvent(arrowUpEvent)).toBe(true);
    expect(inputs[1].dispatchEvent(arrowDownEvent)).toBe(true);
    expect(onKeyDown).toHaveBeenCalledTimes(2);
  });

  it('blocks Delete and Backspace from changing the value in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'Delete' });
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('blocks paste from changing the value in readonly mode', async () => {
    await render(<OTPFieldTest defaultValue="1234" readOnly />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    pasteText(inputs[1], '99');

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('warns in development when clipboard text cannot be read during paste handling', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(<OTPFieldTest defaultValue="12" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      await act(async () => {
        inputs[1].focus();
      });

      pasteWithError(inputs[1], new DOMException('Blocked', 'SecurityError'));

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '', '', '', '']);
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Base UI: <OTPField.Input> could not read clipboard text during paste handling.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('allows tabbing out of the field from the active slot', async () => {
    const user = userEvent.setup();

    await render(
      <React.Fragment>
        <OTPFieldTest />
        <button type="button">Next</button>
      </React.Fragment>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[0].focus();
    });

    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(document.activeElement).toBe(inputs[1]);

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next' }));
  });

  it('deletes the current character and moves focus to the previous slot on backspace', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('deletes the previous filled slot when backspacing on an empty non-first slot', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[2].focus();
    });

    fireEvent.keyDown(inputs[2], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it.each(modifierKeys)('clears all slots with %s + Backspace', async (_, modifierKey) => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[2].focus();
    });

    fireEvent.keyDown(inputs[2], { key: 'Backspace', ...modifierKey });

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('keeps focus in place when backspace is canceled', async () => {
    await render(
      <OTPFieldTest
        defaultValue="1234"
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('deletes the current character with Delete without moving focus', async () => {
    await render(<OTPFieldTest defaultValue="1234" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'Delete' });

    expect(inputs.map((input) => input.value)).toEqual(['1', '3', '4', '', '', '']);
    expect(document.activeElement).toBe(inputs[1]);
    expect(inputs[1].selectionStart).toBe(0);
    expect(inputs[1].selectionEnd).toBe(1);
  });

  it('selects the previous slot value after backspacing into the first slot', async () => {
    await render(<OTPFieldTest defaultValue="12" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[1].focus();
    });

    fireEvent.keyDown(inputs[1], { key: 'Backspace' });

    expect(document.activeElement).toBe(inputs[0]);
    expect(inputs[0].selectionStart).toBe(0);
    expect(inputs[0].selectionEnd).toBe(1);
  });

  it('keeps focus in place when paste is canceled', async () => {
    await render(
      <OTPFieldTest
        onValueChange={(_, eventDetails) => {
          eventDetails.cancel();
        }}
      />,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[0].focus();
    });

    pasteText(inputs[0], '1234');

    expect(inputs.map((input) => input.value)).toEqual(['', '', '', '', '', '']);
    expect(document.activeElement).toBe(inputs[0]);
  });

  it('replaces values from the middle when pasting into a later slot', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    await act(async () => {
      inputs[2].focus();
    });

    pasteText(inputs[2], '99');

    expect(inputs.map((input) => input.value)).toEqual(['1', '2', '9', '9', '5', '6']);
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('marks each input as complete when all slots are filled', async () => {
    await render(<OTPFieldTest defaultValue="123456" />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-complete', '');
    });
  });

  it('adds disabled and readonly state attributes to each slot', async () => {
    const { rerender } = await render(<OTPFieldTest disabled />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-disabled', '');
    });

    await rerender(<OTPFieldTest readOnly />);

    screen.getAllByRole<HTMLInputElement>('textbox').forEach((input) => {
      expect(input).toHaveAttribute('data-readonly', '');
    });
  });

  it('applies the Field label to every slot', async () => {
    await render(
      <Field.Root>
        <Field.Label data-testid="label">Verification code</Field.Label>
        <Field.Description data-testid="description">Enter the code.</Field.Description>
        <OTPFieldTest />
      </Field.Root>,
    );

    const label = screen.getByTestId('label');
    const description = screen.getByTestId('description');
    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs.forEach((input) => {
      expect(input).toHaveAttribute('aria-labelledby', label.id);
      expect(input).not.toHaveAttribute('aria-describedby', description.id);
    });
  });

  it('applies a native label to every slot', async () => {
    await render(
      <React.Fragment>
        <label htmlFor="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </React.Fragment>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    inputs.forEach((input) => {
      expect(input).toHaveAccessibleName('Verification code');
    });
  });

  it('keeps the shared label on the first slot even if an aria-label is provided', async () => {
    await render(
      <React.Fragment>
        <label htmlFor="verification-code">Verification code</label>
        <OTPField.Root id="verification-code" length={OTP_LENGTH}>
          <OTPField.Input aria-label="Character 1 of 6" />
          <OTPField.Input aria-label="Character 2 of 6" />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      </React.Fragment>,
    );

    const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

    expect(inputs[0]).toHaveAccessibleName('Verification code');
    expect(inputs[0]).not.toHaveAttribute('aria-label', 'Character 1 of 6');
    expect(inputs[1]).toHaveAttribute('aria-label', 'Character 2 of 6');
  });

  it('warns when aria-label is provided on the first slot without an associated label', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <OTPField.Root length={OTP_LENGTH}>
          <OTPField.Input aria-label="Character 1 of 6" />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>,
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy.mock.calls[0]?.[0]).toContain(
        'Base UI: <OTPField.Input> ignores `aria-label` on the first input.',
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for a first-slot aria-label when a native label is associated', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <React.Fragment>
          <label htmlFor="verification-code">Verification code</label>
          <OTPField.Root id="verification-code" length={OTP_LENGTH}>
            <OTPField.Input aria-label="Character 1 of 6" />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
        </React.Fragment>,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not warn for a first-slot aria-label when Field.Label is associated', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPField.Root length={OTP_LENGTH}>
            <OTPField.Input aria-label="Character 1 of 6" />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
            <OTPField.Input />
          </OTPField.Root>
        </Field.Root>,
      );

      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('throws a descriptive error when rendered outside <OTPField.Root>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(render(<OTPField.Input />)).rejects.toThrow(
        'Base UI: OTPFieldRootContext is missing. OTPField parts must be placed within <OTPField.Root>.',
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
