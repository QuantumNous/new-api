import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen } from '@mui/internal-test-utils';
import { OTPField as OTPFieldBase } from '@base-ui/react/otp-field';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { REASONS } from '../../internals/reasons';

describe('<OTPField.Root />', () => {
  const { render, renderToString } = createRenderer();
  const OTP_LENGTH = 6;

  describeConformance(<OTPFieldBase.Root length={1} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  type OTPFieldProps = Omit<OTPFieldBase.Root.Props, 'children' | 'length'>;

  function OTPField(props: OTPFieldProps = {}) {
    return (
      <OTPFieldBase.Root length={OTP_LENGTH} {...props}>
        {Array.from({ length: OTP_LENGTH }, (_, index) => (
          <OTPFieldBase.Input key={index} />
        ))}
      </OTPFieldBase.Root>
    );
  }

  function getValues() {
    return screen
      .getAllByRole<HTMLInputElement>('textbox')
      .map((input) => input.value)
      .join('');
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

  describe('value handling', () => {
    it('splits the default value across inputs', async () => {
      await render(<OTPField defaultValue="12a34b56" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('clamps an overlong default value to the rendered slot count', async () => {
      await render(<OTPField defaultValue="12a34b56c7" name="otp" />);

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(inputs[0]).toHaveAttribute('maxlength', '6');
      inputs.slice(1).forEach((input) => {
        expect(input).not.toHaveAttribute('maxlength');
      });
      expect(hiddenInput).toHaveValue('123456');
    });

    it('assigns slot indexes from render order when omitted', async () => {
      await render(
        <OTPFieldBase.Root defaultValue="123" length={3}>
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
          <OTPFieldBase.Input />
        </OTPFieldBase.Root>,
      );

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3']);
    });

    it('supports grouped layouts without affecting slot counting', async () => {
      await render(
        <OTPFieldBase.Root defaultValue="123456" length={6}>
          <div data-testid="first-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
          <OTPFieldBase.Separator>-</OTPFieldBase.Separator>
          <div data-testid="second-group">
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </div>
        </OTPFieldBase.Root>,
      );

      const root = screen.getByRole('group');
      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(root).toContainElement(screen.getByTestId('first-group'));
      expect(root).toContainElement(screen.getByTestId('second-group'));
      expect(screen.getByText('-')).toBeVisible();
      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
    });

    it('updates the rendered value in controlled mode', async () => {
      const { rerender } = await render(<OTPField value="123456" />);

      expect(getValues()).toBe('123456');

      await rerender(<OTPField value="654321" />);

      expect(getValues()).toBe('654321');
    });

    describe('prop: validationType', () => {
      describe('built-in filtering', () => {
        it('supports alphabetic values when set to `alpha`', async () => {
          await render(<OTPField defaultValue="1a2b3Cd4" validationType="alpha" />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
          expect(inputs.map((input) => input.value)).toEqual(['a', 'b', 'C', 'd', '', '']);
        });

        it('supports typing alphabetic values when set to `alpha`', async () => {
          await render(<OTPField validationType="alpha" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          fireEvent.change(firstInput, { target: { value: '1a2b3C' } });

          expect(getValues()).toBe('abC');
        });

        it('supports alphanumeric values when set to `alphanumeric`', async () => {
          await render(<OTPField validationType="alphanumeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          fireEvent.change(firstInput, { target: { value: 'A1-B2c3' } });

          expect(getValues()).toBe('A1B2c3');
        });

        it('applies single-character validation to each visible slot', async () => {
          await render(<OTPField validationType="alphanumeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

          expect(firstInput).toHaveAttribute('pattern', '[a-zA-Z0-9]{1}');
        });
      });

      describe('hidden validation input', () => {
        it('renders the hidden validation input with an alphanumeric pattern during SSR', () => {
          renderToString(
            <OTPFieldBase.Root
              name="otp"
              required
              length={OTP_LENGTH}
              validationType="alphanumeric"
            >
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
              <OTPFieldBase.Input />
            </OTPFieldBase.Root>,
          );

          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(hiddenInput).not.toBeNull();
          expect(hiddenInput).toHaveAttribute('pattern', '[a-zA-Z0-9]{6}');
        });

        it('omits the hidden validation pattern when set to `none`', async () => {
          await render(<OTPField name="otp" validationType="none" />);

          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(hiddenInput).not.toBeNull();
          expect(hiddenInput).not.toHaveAttribute('pattern');
        });

        it('allows a custom inputMode when validation is set to `none`', async () => {
          await render(<OTPField name="otp" validationType="none" inputMode="numeric" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(firstInput).toHaveAttribute('inputmode', 'numeric');
          expect(hiddenInput).toHaveAttribute('inputmode', 'numeric');
        });

        it('allows overriding the built-in inputMode when needed', async () => {
          await render(<OTPField name="otp" validationType="numeric" inputMode="text" />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

          expect(firstInput).toHaveAttribute('inputmode', 'text');
          expect(hiddenInput).toHaveAttribute('inputmode', 'text');
        });
      });
    });

    describe('prop: normalizeValue', () => {
      it('supports custom normalization when `validationType` is `none`', async () => {
        await render(
          <OTPField
            validationType="none"
            normalizeValue={(value) => value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: 'ab-12 cd' } });

        expect(getValues()).toBe('AB12CD');
      });

      it('composes with built-in validation and advances focus', async () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        try {
          await render(
            <OTPField
              validationType="alphanumeric"
              normalizeValue={(value) => value.toUpperCase()}
            />,
          );

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
          fireEvent.change(inputs[0], { target: { value: 'a!' } });

          expect(getValues()).toBe('A');
          expect(inputs[1]).toHaveFocus();
          expect(warnSpy).not.toHaveBeenCalled();
        } finally {
          warnSpy.mockRestore();
        }
      });

      it('composes built-in validation and custom normalization for pasted values', async () => {
        await render(
          <OTPField
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, 'ab-12 cd!');

        expect(getValues()).toBe('AB12CD');
      });

      it('composes built-in validation and custom normalization from a non-first slot', async () => {
        await render(
          <OTPField
            defaultValue="12"
            validationType="alphanumeric"
            normalizeValue={(value) => value.toUpperCase()}
          />,
        );

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        await act(async () => {
          inputs[2].focus();
        });

        fireEvent.change(inputs[2], { target: { value: 'a!' } });

        expect(getValues()).toBe('12A');
        expect(inputs[3]).toHaveFocus();
      });
    });

    describe('prop: onValueChange', () => {
      it('fires `input-change` when typing', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1' } });

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('1');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-clear` when clearing a slot by input', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1" onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '' } });

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputClear);
      });
    });

    describe('prop: onValueInvalid', () => {
      it('fires when typing is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();

        await render(<OTPField onValueInvalid={onValueInvalid} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1a' } });

        expect(getValues()).toBe('1');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="none"
            inputMode="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1209' } });

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1209' } });

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when built-in validation removes characters before custom normalization expands the value', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => (value === '1' ? '12' : value)}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1a' } });

        expect(getValues()).toBe('12');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1a');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires when custom normalization removes all characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={() => ''}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '1' } });

        expect(getValues()).toBe('');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasted text is normalized before the OTP value updates', async () => {
        const onValueInvalid = vi.fn();

        await render(<OTPField onValueInvalid={onValueInvalid} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '12a34');

        expect(getValues()).toBe('1234');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when custom normalization removes characters after built-in validation', async () => {
        const onValueInvalid = vi.fn();

        await render(
          <OTPField
            validationType="numeric"
            normalizeValue={(value) => value.replace(/[^0-3]/g, '')}
            onValueInvalid={onValueInvalid}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '1209');

        expect(getValues()).toBe('120');
        expect(onValueInvalid).toHaveBeenCalledTimes(1);
        expect(onValueInvalid.mock.calls[0]?.[0]).toBe('1209');
        expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });
    });

    describe('prop: onValueComplete', () => {
      it('fires when typing completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '123456' } });

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      });

      it('fires `input-paste` when pasting completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '123456');

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when a complete paste replaces a complete OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '123456');
        pasteText(firstInput, '654321');
        pasteText(firstInput, '654321');

        expect(onValueComplete).toHaveBeenCalledTimes(3);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
        expect(onValueComplete.mock.calls[1]?.[0]).toBe('654321');
        expect(onValueComplete.mock.calls[1]?.[1].reason).toBe(REASONS.inputPaste);
        expect(onValueComplete.mock.calls[2]?.[0]).toBe('654321');
        expect(onValueComplete.mock.calls[2]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('fires `input-paste` when pasting into a middle slot completes the OTP', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField defaultValue="12" onValueComplete={onValueComplete} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        await act(async () => {
          inputs[2].focus();
        });

        pasteText(inputs[2], '3456');

        expect(onValueComplete).toHaveBeenCalledTimes(1);
        expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });

      it('does not fire when a completion-making paste is canceled', async () => {
        const onValueComplete = vi.fn();

        await render(
          <OTPField
            onValueChange={(_, eventDetails) => {
              eventDetails.cancel();
            }}
            onValueComplete={onValueComplete}
          />,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '123456');

        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire before the OTP becomes complete', async () => {
        const onValueComplete = vi.fn();

        await render(<OTPField onValueComplete={onValueComplete} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        fireEvent.change(firstInput, { target: { value: '12345' } });

        expect(onValueComplete).not.toHaveBeenCalled();
      });

      it('does not fire later for a stale controlled completion attempt', async () => {
        vi.useFakeTimers();

        try {
          const onValueComplete = vi.fn();

          function Test() {
            const [value, setValue] = React.useState('');

            return (
              <React.Fragment>
                <OTPField
                  value={value}
                  onValueChange={() => {}}
                  onValueComplete={onValueComplete}
                />
                <button type="button" onClick={() => setValue('654321')}>
                  Apply value
                </button>
              </React.Fragment>
            );
          }

          await render(<Test />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          fireEvent.change(firstInput, { target: { value: '123456' } });

          await act(async () => {
            vi.runAllTimers();
          });

          fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

          expect(onValueComplete).not.toHaveBeenCalled();
        } finally {
          vi.useRealTimers();
        }
      });

      it('fires after an asynchronously accepted controlled completion', async () => {
        vi.useFakeTimers();

        try {
          const onValueComplete = vi.fn();

          function Test() {
            const [value, setValue] = React.useState('');

            return (
              <OTPField
                value={value}
                onValueChange={(nextValue) => {
                  setTimeout(() => {
                    setValue(nextValue);
                  }, 10);
                }}
                onValueComplete={onValueComplete}
              />
            );
          }

          await render(<Test />);

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
          fireEvent.change(firstInput, { target: { value: '123456' } });

          await act(async () => {
            vi.runAllTimers();
          });

          expect(onValueComplete).toHaveBeenCalledTimes(1);
          expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
          expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
        } finally {
          vi.useRealTimers();
        }
      });

      it('does not fire again when a controlled value changes from one complete value to another', async () => {
        const onValueComplete = vi.fn();

        function Test() {
          const [value, setValue] = React.useState('123456');

          return (
            <React.Fragment>
              <OTPField value={value} onValueChange={() => {}} onValueComplete={onValueComplete} />
              <button type="button" onClick={() => setValue('654321')}>
                Apply value
              </button>
            </React.Fragment>
          );
        }

        await render(<Test />);

        fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

        expect(onValueComplete).not.toHaveBeenCalled();
      });
    });
  });

  describe('Field', () => {
    it('associates Field.Label with the first slot', async () => {
      await render(
        <Field.Root>
          <Field.Label>Verification code</Field.Label>
          <OTPField />
        </Field.Root>,
      );

      const label = screen.getByText('Verification code');
      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(label).toHaveAttribute('for', firstInput.id);
    });

    it('applies the Field description to the group', async () => {
      await render(
        <Field.Root>
          <Field.Label data-testid="label">Verification code</Field.Label>
          <Field.Description data-testid="description">Enter the code.</Field.Description>
          <OTPField aria-describedby="external-description" />
        </Field.Root>,
      );

      const label = screen.getByTestId('label');
      const description = screen.getByTestId('description');
      const group = screen.getByRole('group', { name: 'Verification code' });

      expect(group).toHaveAttribute('aria-labelledby', label.id);
      expect(group).toHaveAttribute('aria-describedby', `external-description ${description.id}`);
    });
  });

  describe('accessibility', () => {
    it('forwards root `aria-describedby` to the group', async () => {
      await render(<OTPField aria-describedby="description-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('aria-describedby', 'description-id');
    });

    it('forwards root `aria-labelledby` to the group only', async () => {
      await render(
        <React.Fragment>
          <span id="label-id">Verification code</span>
          <OTPField aria-labelledby="label-id" />
        </React.Fragment>,
      );

      const group = screen.getByRole('group', { name: 'Verification code' });
      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(group).toHaveAttribute('aria-labelledby', 'label-id');
      inputs.forEach((input) => {
        expect(input).not.toHaveAttribute('aria-labelledby', 'label-id');
      });
    });

    describe('prop: autoComplete', () => {
      it('applies the default autocomplete to the first slot only', async () => {
        await render(<OTPField />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        expect(inputs[0]).toHaveAttribute('autocomplete', 'one-time-code');
        expect(inputs[1]).toHaveAttribute('autocomplete', 'off');
      });

      it('allows overriding the autocomplete attribute', async () => {
        await render(<OTPField autoComplete="off" name="otp" />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');
        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(inputs[0]).toHaveAttribute('autocomplete', 'off');
        expect(hiddenInput).toHaveAttribute('autocomplete', 'off');
      });
    });
  });

  describe('prop: disabled', () => {
    it('disables every slot and prevents value changes', async () => {
      const onValueChange = vi.fn();

      await render(<OTPField disabled onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(firstInput).toBeDisabled();
      expect(screen.getByRole('group')).toHaveAttribute('data-disabled', '');

      fireEvent.change(firstInput, { target: { value: '1' } });

      expect(getValues()).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: readOnly', () => {
    it('marks every slot as readonly and prevents value changes', async () => {
      const onValueChange = vi.fn();

      await render(<OTPField readOnly onValueChange={onValueChange} />);

      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(firstInput).toHaveAttribute('readonly');
      expect(screen.getByRole('group')).toHaveAttribute('data-readonly', '');

      fireEvent.change(firstInput, { target: { value: '1' } });

      expect(getValues()).toBe('');
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('tracks focus state when a readonly slot receives focus', async () => {
      await render(<OTPField readOnly />);

      const root = screen.getByRole('group');
      const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

      await act(async () => {
        firstInput.focus();
      });

      expect(root).toHaveAttribute('data-focused', '');
    });
  });

  describe('prop: mask', () => {
    describe('native masking', () => {
      it('renders password slot inputs when enabled', async () => {
        await render(<OTPField defaultValue="123" mask />);

        expect(document.querySelectorAll('input[type="password"]')).toHaveLength(6);
      });
    });

    describe('slot overrides', () => {
      it('allows overriding the input type on individual slots', async () => {
        await render(
          <OTPFieldBase.Root length={1} mask>
            <OTPFieldBase.Input type="tel" />
          </OTPFieldBase.Root>,
        );

        expect(screen.getByRole('textbox')).toHaveAttribute('type', 'tel');
      });
    });
  });

  describe('interactions', () => {
    describe('typing', () => {
      it('fills consecutive slots when typing multiple characters into the first input', async () => {
        await render(<OTPField />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
      });

      it('replaces consecutive slots when typing multiple characters into a later input', async () => {
        await render(<OTPField defaultValue="123456" />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(inputs[2], { target: { value: '99' } });

        expect(getValues()).toBe('129956');
      });
    });

    describe('pasting', () => {
      it('fills consecutive slots when pasting a code', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');
        pasteText(firstInput, '123456');

        expect(getValues()).toBe('123456');
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputPaste);
      });
    });

    describe('keyboard', () => {
      it('removes a character and moves focus to the previous slot with backspace', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1234" onValueChange={onValueChange} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        await act(async () => {
          inputs[1].focus();
        });

        fireEvent.keyDown(inputs[1], { key: 'Backspace' });

        expect(getValues()).toBe('134');
        expect(document.activeElement).toBe(inputs[0]);
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.calls[0]?.[0]).toBe('134');
        expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.keyboard);
      });

      it('does not fire `onValueChange` for Delete on an empty slot', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField defaultValue="1" onValueChange={onValueChange} />);

        const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

        await act(async () => {
          inputs[1].focus();
        });

        fireEvent.keyDown(inputs[1], { key: 'Delete' });

        expect(getValues()).toBe('1');
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not fire `onValueChange` for Backspace on an already-empty first slot', async () => {
        const onValueChange = vi.fn();

        await render(<OTPField onValueChange={onValueChange} />);

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        await act(async () => {
          firstInput.focus();
        });

        fireEvent.keyDown(firstInput, { key: 'Backspace' });

        expect(getValues()).toBe('');
        expect(document.activeElement).toBe(firstInput);
        expect(onValueChange).not.toHaveBeenCalled();
      });

      it('does not move focus later for a stale controlled change', async () => {
        vi.useFakeTimers();

        try {
          function Test() {
            const [value, setValue] = React.useState('');

            return (
              <React.Fragment>
                <OTPField value={value} onValueChange={() => {}} />
                <button type="button" onClick={() => setValue('9')}>
                  Apply value
                </button>
              </React.Fragment>
            );
          }

          await render(<Test />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          await act(async () => {
            inputs[0].focus();
          });

          fireEvent.change(inputs[0], { target: { value: '1' } });

          await act(async () => {
            vi.runAllTimers();
          });

          fireEvent.click(screen.getByRole('button', { name: 'Apply value' }));

          expect(document.activeElement).toBe(inputs[0]);
        } finally {
          vi.useRealTimers();
        }
      });

      it('moves focus after an asynchronously accepted controlled change', async () => {
        vi.useFakeTimers();

        try {
          function Test() {
            const [value, setValue] = React.useState('');

            return (
              <OTPField
                value={value}
                onValueChange={(nextValue) => {
                  setTimeout(() => {
                    setValue(nextValue);
                  }, 10);
                }}
              />
            );
          }

          await render(<Test />);

          const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

          await act(async () => {
            inputs[0].focus();
          });

          fireEvent.change(inputs[0], { target: { value: '1' } });

          await act(async () => {
            vi.runAllTimers();
          });

          expect(document.activeElement).toBe(inputs[1]);
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });

  describe('Form', () => {
    it('blocks form submission while the code is incomplete', async () => {
      await render(
        <form data-testid="form">
          <OTPField defaultValue="123" name="otp" required />
          <button type="submit">Submit</button>
        </form>,
      );

      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(false);
    });

    it('allows form submission when the code is complete', async () => {
      await render(
        <form data-testid="form">
          <OTPField defaultValue="123456" name="otp" required />
          <button type="submit">Submit</button>
        </form>,
      );

      expect(screen.getByTestId<HTMLFormElement>('form').checkValidity()).toBe(true);
    });

    it('renders the hidden validation input with the provided name', async () => {
      await render(<OTPField name="otp" />);

      expect(document.querySelector('input[name="otp"]')).not.toBeNull();
    });

    it('handles password manager autofill through the hidden input', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();

      await render(
        <OTPField
          name="otp"
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />,
      );

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      fireEvent.change(hiddenInput!, { target: { value: '12a34b56' } });

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(inputs.map((input) => input.value)).toEqual(['1', '2', '3', '4', '5', '6']);
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('12a34b56');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueComplete.mock.calls.length).toBe(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('123456');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it('composes validation and custom normalization during hidden input autofill', async () => {
      const onValueChange = vi.fn();
      const onValueInvalid = vi.fn();
      const onValueComplete = vi.fn();

      await render(
        <OTPField
          name="otp"
          validationType="alphanumeric"
          normalizeValue={(value) => value.toUpperCase()}
          onValueChange={onValueChange}
          onValueInvalid={onValueInvalid}
          onValueComplete={onValueComplete}
        />,
      );

      const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

      expect(hiddenInput).not.toBeNull();

      fireEvent.change(hiddenInput!, { target: { value: 'ab-12 cd!' } });

      const inputs = screen.getAllByRole<HTMLInputElement>('textbox');

      expect(inputs.map((input) => input.value)).toEqual(['A', 'B', '1', '2', 'C', 'D']);
      expect(document.activeElement).toBe(inputs[5]);
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.calls[0]?.[0]).toBe('AB12CD');
      expect(onValueChange.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueInvalid).toHaveBeenCalledTimes(1);
      expect(onValueInvalid.mock.calls[0]?.[0]).toBe('ab-12 cd!');
      expect(onValueInvalid.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
      expect(onValueComplete.mock.calls.length).toBe(1);
      expect(onValueComplete.mock.calls[0]?.[0]).toBe('AB12CD');
      expect(onValueComplete.mock.calls[0]?.[1].reason).toBe(REASONS.inputChange);
    });

    it.each([
      { lockState: 'readOnly', label: 'inside Field', withField: true },
      { lockState: 'disabled', label: 'inside Field', withField: true },
      { lockState: 'readOnly', label: 'outside Field', withField: false },
      { lockState: 'disabled', label: 'outside Field', withField: false },
    ] as const)(
      'ignores hidden-input autofill when $lockState $label',
      async ({ lockState, withField }) => {
        const onValueChange = vi.fn();
        const onValueInvalid = vi.fn();
        const onValueComplete = vi.fn();
        const otpField = (
          <OTPField
            readOnly={lockState === 'readOnly'}
            disabled={lockState === 'disabled'}
            name={withField ? undefined : 'otp'}
            onValueChange={onValueChange}
            onValueInvalid={onValueInvalid}
            onValueComplete={onValueComplete}
          />
        );

        await render(
          withField ? (
            <Form errors={{ otp: 'test' }}>
              <Field.Root name="otp">
                {otpField}
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>
          ) : (
            otpField
          ),
        );

        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(hiddenInput).not.toBeNull();

        if (withField) {
          expect(screen.getByTestId('error')).toHaveTextContent('test');
          const inputs = screen.getAllByRole('textbox');
          inputs.forEach((input) => {
            if (lockState === 'disabled') {
              expect(input).not.toHaveAttribute('aria-invalid');
            } else {
              expect(input).toHaveAttribute('aria-invalid', 'true');
            }
          });
        }

        fireEvent.change(hiddenInput!, { target: { value: '12a34b56' } });

        expect(getValues()).toBe('');
        expect(onValueChange).not.toHaveBeenCalled();
        expect(onValueInvalid).not.toHaveBeenCalled();
        expect(onValueComplete).not.toHaveBeenCalled();

        if (withField) {
          expect(screen.getByTestId('error')).toHaveTextContent('test');
        }
      },
    );

    describe('prop: autoSubmit', () => {
      const flushSyncLifecycleError = 'flushSync was called from inside a lifecycle method';

      function spyOnFlushSyncLifecycleError() {
        return vi.spyOn(console, 'error').mockImplementation((...args) => {
          if (args.some((arg) => String(arg).includes(flushSyncLifecycleError))) {
            return;
          }

          throw new Error(`Unexpected console.error: ${args.map(String).join(' ')}`);
        });
      }

      it('does not auto-submit the owning form when the OTP becomes complete by default', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).not.toHaveBeenCalled();
      });

      it('submits the completed named OTP value from the owning form when enabled', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();

          expect(new FormData(event.currentTarget).get('otp')).toBe('123456');
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField name="otp" required autoSubmit />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });

      it('does not call flushSync inside a layout effect when auto-submitting a Base UI Form', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
        });
        const consoleErrorSpy = spyOnFlushSyncLifecycleError();

        try {
          await render(
            <Form onSubmit={handleSubmit}>
              <Field.Root name="otp">
                <OTPField autoSubmit />
              </Field.Root>
            </Form>,
          );

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

          fireEvent.change(firstInput, { target: { value: '123456' } });

          expect(getValues()).toBe('123456');
          expect(handleSubmit).toHaveBeenCalledTimes(1);
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
          consoleErrorSpy.mockRestore();
        }
      });

      it('blocks invalid Base UI Form auto-submit without calling flushSync inside a layout effect', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
        });
        const consoleErrorSpy = spyOnFlushSyncLifecycleError();

        try {
          await render(
            <Form onSubmit={handleSubmit}>
              <Field.Root name="otp" validate={() => 'Invalid OTP'}>
                <OTPField autoSubmit />
                <Field.Error data-testid="error" />
              </Field.Root>
            </Form>,
          );

          const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

          fireEvent.change(firstInput, { target: { value: '123456' } });

          expect(getValues()).toBe('123456');
          expect(handleSubmit).not.toHaveBeenCalled();
          expect(screen.getByTestId('error')).toHaveTextContent('Invalid OTP');
          expect(consoleErrorSpy).not.toHaveBeenCalled();
        } finally {
          consoleErrorSpy.mockRestore();
        }
      });

      it('does not submit the owning form before the OTP becomes complete when enabled', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();
        });

        await render(
          <form onSubmit={handleSubmit}>
            <OTPField autoSubmit />
            <button type="submit">Submit</button>
          </form>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(firstInput, { target: { value: '12345' } });

        expect(getValues()).toBe('12345');
        expect(handleSubmit).not.toHaveBeenCalled();
      });
    });

    describe('prop: form', () => {
      it('submits an associated external form when used with `autoSubmit`', async () => {
        const handleSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
          event.preventDefault();

          expect(new FormData(event.currentTarget).get('otp')).toBe('123456');
        });

        await render(
          <React.Fragment>
            <form id="verification-form" onSubmit={handleSubmit}>
              <button type="submit">Submit</button>
            </form>
            <OTPField form="verification-form" name="otp" autoSubmit />
          </React.Fragment>,
        );

        const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

        fireEvent.change(firstInput, { target: { value: '123456' } });

        expect(getValues()).toBe('123456');
        expect(handleSubmit).toHaveBeenCalledTimes(1);
      });
    });

    describe('server-side rendering', () => {
      it('renders a hidden validation input with the provided length', () => {
        renderToString(
          <OTPFieldBase.Root name="otp" required length={OTP_LENGTH}>
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
            <OTPFieldBase.Input />
          </OTPFieldBase.Root>,
        );

        const hiddenInput = document.querySelector<HTMLInputElement>('input[name="otp"]');

        expect(hiddenInput).not.toBeNull();
        expect(hiddenInput).toHaveAttribute('minlength', '6');
        expect(hiddenInput).toHaveAttribute('maxlength', '6');
        expect(hiddenInput).toHaveAttribute('pattern', '\\d{6}');
      });
    });
  });

  it('updates standalone filled and focused state on the root', async () => {
    await render(
      <OTPFieldBase.Root data-testid="root" length={OTP_LENGTH}>
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
      </OTPFieldBase.Root>,
    );

    const root = screen.getByTestId('root');
    const [firstInput] = screen.getAllByRole<HTMLInputElement>('textbox');

    expect(root).not.toHaveAttribute('data-filled');
    expect(root).not.toHaveAttribute('data-focused');

    await act(async () => {
      firstInput.focus();
    });

    expect(root).toHaveAttribute('data-focused', '');

    fireEvent.change(firstInput, { target: { value: '1' } });

    expect(root).toHaveAttribute('data-filled', '');

    fireEvent.blur(firstInput);

    expect(root).not.toHaveAttribute('data-focused');
  });

  it('sets `data-complete` when all slots are filled', async () => {
    await render(<OTPField data-testid="root" defaultValue="123456" />);

    expect(screen.getByTestId('root')).toHaveAttribute('data-complete', '');
  });

  it('renders a fallback hidden input id when name is not provided', async () => {
    await render(<OTPField id="verification-code" />);

    expect(document.querySelector('#verification-code-hidden-input')).not.toBeNull();
  });

  it('warns when length does not match the rendered input count', async () => {
    const warnSpy = vi
      .spyOn(console, 'warn')
      .mockName('console.warn')
      .mockImplementation(() => {});

    await render(
      <OTPFieldBase.Root length={OTP_LENGTH}>
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
        <OTPFieldBase.Input />
      </OTPFieldBase.Root>,
    );

    expect(warnSpy.mock.calls.length).toBe(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain(
      'Base UI: <OTPField.Root> `length` must match the number of rendered <OTPField.Input /> parts.',
    );
    expect(warnSpy.mock.calls[0]?.[0]).toContain('Received `length={6}` but rendered 5 inputs.');

    warnSpy.mockRestore();
  });

  it.each([0, -1, 3.7, Number.NaN, Number.POSITIVE_INFINITY])(
    'warns when length is not a positive integer (%p)',
    async (invalidLength) => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await render(<OTPFieldBase.Root length={invalidLength} />);

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain(
          `Base UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(invalidLength)}}\`.`,
        );
      } finally {
        warnSpy.mockRestore();
      }
    },
  );
});
