import { expect, vi } from 'vitest';
import * as React from 'react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { Field } from '@base-ui/react/field';
import { Fieldset } from '@base-ui/react/fieldset';
import { Form } from '@base-ui/react/form';
import { DirectionProvider, type TextDirection } from '@base-ui/react/direction-provider';
import { isJSDOM, createRenderer } from '#test-utils';
import { act, screen, fireEvent } from '@mui/internal-test-utils';
import { describeConformance } from '../../test/describeConformance';

describe('<RadioGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<RadioGroup />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      const { container } = await render(<RadioGroup role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('prop: id', () => {
    it('is forwarded to the root element', async () => {
      await render(<RadioGroup id="group-id" />);

      expect(screen.getByRole('radiogroup')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when an item is clicked', async () => {
      const handleChange = vi.fn();
      await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      fireEvent.click(item);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe('a');
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((value, eventDetails) => eventDetails);

      const { user } = await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      await user.keyboard('{Shift>}');
      await user.click(item);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should select an item with Space on keyup', async () => {
      const handleChange = vi.fn();
      const { user } = await render(
        <RadioGroup onValueChange={handleChange}>
          <Radio.Root value="a" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      act(() => {
        item.focus();
      });

      await user.keyboard('[Space>]');

      expect(handleChange).not.toHaveBeenCalled();

      await user.keyboard('[/Space]');

      expect(handleChange).toHaveBeenCalledOnce();
      expect(handleChange).toHaveBeenLastCalledWith('a', expect.anything());
    });

    it('does not change state when canceled via a root click', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="item" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const item = screen.getByTestId('item');
      const input = document.querySelector<HTMLInputElement>('input[type="radio"]');

      expect(input).not.toBe(null);
      if (!input) {
        return;
      }

      await user.click(input);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via arrow key navigation', async () => {
      const { user } = await render(
        <Field.Root>
          <RadioGroup onValueChange={(_, eventDetails) => eventDetails.cancel()}>
            <Radio.Root value="a" data-testid="a" />
            <Radio.Root value="b" data-testid="b" />
          </RadioGroup>
        </Field.Root>,
      );

      const group = screen.getByRole('radiogroup');
      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');

      act(() => {
        a.focus();
      });

      await user.keyboard('{ArrowDown}');

      expect(b).toHaveFocus();
      expect(a).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(inputs[0]?.checked).toBe(false);
      expect(inputs[1]?.checked).toBe(false);
      expect(group).not.toHaveAttribute('data-touched');
      expect(group).not.toHaveAttribute('data-dirty');
      expect(group).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: disabled', () => {
    it('should have the `aria-disabled` attribute', async () => {
      await render(
        <RadioGroup disabled>
          <Radio.Root value="a" />
        </RadioGroup>,
      );
      expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByRole('radio')).toHaveAttribute('data-disabled');
      const input = document.querySelector('input[type="radio"]');
      expect(input).toHaveAttribute('disabled');
    });

    it('should not have the aria attribute when `disabled` is not set', async () => {
      await render(<RadioGroup />);
      expect(screen.getByRole('radiogroup')).not.toHaveAttribute('aria-disabled');
    });

    it('should not change its state when clicked', async () => {
      await render(
        <RadioGroup disabled>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<RadioGroup readOnly />);
      const group = screen.getByRole('radiogroup');
      expect(group).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<RadioGroup />);
      const group = screen.getByRole('radiogroup');
      expect(group).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(
        <RadioGroup readOnly>
          <Radio.Root value="" data-testid="item" />
        </RadioGroup>,
      );

      const item = screen.getByTestId('item');

      expect(item).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    await render(
      <RadioGroup data-testid="root">
        <Radio.Root value="" data-testid="item" />
      </RadioGroup>,
    );

    const group = screen.getByTestId('root');
    const item = screen.getByTestId('item');

    const input = group.querySelector<HTMLInputElement>('input')!;

    fireEvent.click(input);

    expect(item).toHaveAttribute('aria-checked', 'true');
  });

  it('should place the style hooks on the root and subcomponents', async () => {
    await render(
      <RadioGroup defaultValue="1" disabled readOnly required>
        <Radio.Root value="1" data-testid="item">
          <Radio.Indicator data-testid="indicator" />
        </Radio.Root>
      </RadioGroup>,
    );

    const root = screen.getByRole('radiogroup');
    const item = screen.getByTestId('item');
    const indicator = screen.getByTestId('indicator');

    expect(root).toHaveAttribute('data-disabled', '');
    expect(root).toHaveAttribute('data-readonly', '');
    expect(root).toHaveAttribute('data-required', '');

    expect(item).toHaveAttribute('data-checked', '');
    expect(item).toHaveAttribute('data-disabled', '');
    expect(item).toHaveAttribute('data-readonly', '');
    expect(item).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');
  });

  it('should set the name attribute on each radio input', async () => {
    await render(
      <RadioGroup name="radio-group">
        <Radio.Root value="a" data-testid="radio" />
      </RadioGroup>,
    );
    const radio = screen.getByTestId('radio');
    const input = radio.nextElementSibling as HTMLInputElement;

    expect(input).toHaveAttribute('name', 'radio-group');
    expect(input).toHaveAttribute('value', 'a');
  });

  it('points inputRef to the checked radio input when present', async () => {
    const groupInputRef = React.createRef<HTMLInputElement>();

    await render(
      <RadioGroup defaultValue="a" inputRef={groupInputRef}>
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>,
    );

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');
    const inputA = radioA.nextElementSibling as HTMLInputElement;
    const inputB = radioB.nextElementSibling as HTMLInputElement;

    expect(groupInputRef.current).toBe(inputA);

    fireEvent.click(radioB);

    expect(groupInputRef.current).toBe(inputB);
  });

  it('allows reading inputRef.current in an effect', async () => {
    let observedValue: string | null = null;

    function App() {
      const inputRef = React.useRef<HTMLInputElement>(null);

      React.useLayoutEffect(() => {
        observedValue = inputRef.current?.value ?? null;
      });

      return (
        <RadioGroup defaultValue="a" inputRef={inputRef}>
          <Radio.Root value="a" />
          <Radio.Root value="b" />
        </RadioGroup>
      );
    }

    await render(<App />);

    expect(observedValue).toBe('a');
  });

  it('supports inputRef as a function', async () => {
    const inputRefSpy = vi.fn();

    await render(
      <RadioGroup defaultValue="a" inputRef={inputRefSpy}>
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>,
    );

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');
    const inputA = radioA.nextElementSibling as HTMLInputElement;
    const inputB = radioB.nextElementSibling as HTMLInputElement;

    fireEvent.click(radioB);

    expect(inputRefSpy.mock.calls.some((args) => args[0] === inputA)).toBe(true);
    expect(inputRefSpy.mock.calls.some((args) => args[0] === inputB)).toBe(true);
    expect(inputRefSpy.mock.lastCall?.[0]).toBe(inputB);
  });

  it('skips disabled radios when assigning inputRef', async () => {
    const groupInputRef = React.createRef<HTMLInputElement>();

    await render(
      <RadioGroup inputRef={groupInputRef}>
        <Radio.Root value="a" disabled data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>,
    );

    const inputB = (screen.getByTestId('radio-b').nextElementSibling ??
      null) as HTMLInputElement | null;

    expect(groupInputRef.current).toBe(inputB);
  });

  it('points inputRef to the first radio input when nativeButton wraps a button', async () => {
    const groupInputRef = React.createRef<HTMLInputElement>();

    await render(
      <RadioGroup inputRef={groupInputRef}>
        <Radio.Root
          nativeButton
          value="a"
          render={(props) => (
            <label>
              <button {...props} data-testid="radio-a" />
              <span>Label A</span>
            </label>
          )}
        />
        <Radio.Root
          nativeButton
          value="b"
          render={(props) => (
            <label>
              <button {...props} data-testid="radio-b" />
              <span>Label B</span>
            </label>
          )}
        />
      </RadioGroup>,
    );

    const inputs = document.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(inputs.length).toBe(2);
    expect(groupInputRef.current).toBe(inputs[0]);
  });

  it('keeps inputRef pointing to the first radio when the value is cleared', async () => {
    const groupInputRef = React.createRef<HTMLInputElement>();

    function App() {
      const [value, setValue] = React.useState<null | string>('a');

      return (
        <React.Fragment>
          <RadioGroup value={value} inputRef={groupInputRef}>
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
          <button type="button" onClick={() => setValue(null)}>
            Clear
          </button>
        </React.Fragment>
      );
    }

    await render(<App />);

    const radioA = screen.getByTestId('radio-a');
    const inputA = radioA.nextElementSibling as HTMLInputElement;

    expect(groupInputRef.current).toBe(inputA);

    fireEvent.click(screen.getByText('Clear'));

    expect(groupInputRef.current).toBe(inputA);
  });

  it.skipIf(isJSDOM)(
    'should return null when no radio is selected (matching native behavior)',
    async () => {
      await render(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            expect(formData.get('test-group')).toBe(null);
          }}
        >
          <RadioGroup name="test-group">
            <Radio.Root value="option-a" />
            <Radio.Root value="option-b" />
          </RadioGroup>
          <button type="submit">Submit</button>
        </form>,
      );

      const submitButton = screen.getByRole('button');
      submitButton.click();
    },
  );

  it.skipIf(isJSDOM)('should return null in form data when no radio is selected', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="group">
          <Radio.Root value="a" />
          <Radio.Root value="b" />
          <Radio.Root value="c" />
        </RadioGroup>
      </form>,
    );

    const form = screen.getByTestId('form') as HTMLFormElement;
    const formData = new FormData(form);
    expect(formData.get('group')).toBe(null);
  });

  it.skipIf(isJSDOM)('should include selected radio value in form data', async () => {
    await render(
      <form data-testid="form">
        <RadioGroup name="group">
          <Radio.Root value="a" data-testid="radio-a" />
          <Radio.Root value="b" />
          <Radio.Root value="c" />
        </RadioGroup>
      </form>,
    );

    const radio = screen.getByTestId('radio-a');
    const form = screen.getByTestId('form') as HTMLFormElement;

    await act(async () => {
      radio.click();
    });

    const formData = new FormData(form);
    expect(formData.get('group')).toBe('a');
  });

  it('should automatically select radio upon navigation', async () => {
    const { user } = await render(
      <Field.Root>
        <RadioGroup>
          <Radio.Root value="a" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </Field.Root>,
    );

    const group = screen.getByRole('radiogroup');
    const a = screen.getByTestId('a');
    const b = screen.getByTestId('b');

    act(() => {
      a.focus();
    });

    expect(group).not.toHaveAttribute('data-touched');
    expect(a).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('{ArrowDown}');

    expect(a).toHaveAttribute('aria-checked', 'false');

    expect(b).toHaveFocus();
    expect(b).toHaveAttribute('aria-checked', 'true');
    expect(group).toHaveAttribute('data-touched', '');
  });

  describe('should manage arrow key navigation', () => {
    [
      ['ltr', 'ArrowRight', 'ArrowLeft'],
      ['rtl', 'ArrowLeft', 'ArrowRight'],
    ].forEach((entry) => {
      const [direction, horizontalNextKey, horizontalPrevKey] = entry;

      describe.skipIf(isJSDOM && direction === 'rtl')(direction, () => {
        it(direction, async () => {
          const { user } = await render(
            <DirectionProvider direction={direction as TextDirection}>
              <button data-testid="before" />
              <RadioGroup>
                <Radio.Root value="a" data-testid="a" />
                <Radio.Root value="b" data-testid="b" />
                <Radio.Root value="c" data-testid="c" />
              </RadioGroup>
              <button data-testid="after" />
            </DirectionProvider>,
          );

          const a = screen.getByTestId('a');
          const b = screen.getByTestId('b');
          const c = screen.getByTestId('c');
          const after = screen.getByTestId('after');

          act(() => {
            a.focus();
          });

          expect(a).toHaveFocus();

          await user.keyboard('{ArrowDown}');

          expect(b).toHaveFocus();

          await user.keyboard('{ArrowDown}');

          expect(c).toHaveFocus();

          await user.keyboard('{ArrowDown}');

          expect(a).toHaveFocus();

          await user.keyboard('{ArrowUp}');

          expect(c).toHaveFocus();

          await user.keyboard('{ArrowUp}');

          expect(b).toHaveFocus();

          await user.keyboard('{ArrowUp}');

          expect(a).toHaveFocus();

          await user.keyboard(`{${horizontalPrevKey}}`);

          expect(c).toHaveFocus();

          await user.keyboard(`{${horizontalNextKey}}`);

          expect(a).toHaveFocus();

          await user.tab();

          expect(after).toHaveFocus();

          await user.tab({ shift: true });

          expect(a).toHaveFocus();

          await user.keyboard(`{${horizontalPrevKey}}`);

          expect(c).toHaveFocus();

          await user.tab({ shift: true });
          await user.tab();

          expect(c).toHaveFocus();
        });

        describe('modifier keys', () => {
          it('when Shift is pressed arrow keys move focus normally', async () => {
            const { user } = await render(
              <DirectionProvider direction={direction as TextDirection}>
                <RadioGroup>
                  <Radio.Root value="a" data-testid="a" />
                  <Radio.Root value="b" data-testid="b" />
                  <Radio.Root value="c" data-testid="c" />
                </RadioGroup>
              </DirectionProvider>,
            );

            const a = screen.getByTestId('a');
            const b = screen.getByTestId('b');
            const c = screen.getByTestId('c');

            await user.keyboard('{Tab}');
            expect(a).toHaveFocus();

            await user.keyboard(`{Shift>}{${horizontalNextKey}}`);
            expect(b).toHaveFocus();

            await user.keyboard('{Shift>}{ArrowDown}');
            expect(c).toHaveFocus();
          });
        });
      });
    });
  });

  describe('style hooks', () => {
    it('should apply data-checked and data-unchecked to radio root and indicator', async () => {
      await render(
        <RadioGroup>
          <Radio.Root value="a" data-testid="a">
            <Radio.Indicator keepMounted data-testid="indicator-a" />
          </Radio.Root>
          <Radio.Root value="b" data-testid="b">
            <Radio.Indicator keepMounted data-testid="indicator-b" />
          </Radio.Root>
        </RadioGroup>,
      );

      const a = screen.getByTestId('a');
      const b = screen.getByTestId('b');
      const indicatorA = screen.getByTestId('indicator-a');
      const indicatorB = screen.getByTestId('indicator-b');

      expect(a).toHaveAttribute('data-unchecked', '');
      expect(indicatorA).toHaveAttribute('data-unchecked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');

      fireEvent.click(a);

      expect(a).toHaveAttribute('data-checked', '');
      expect(indicatorA).toHaveAttribute('data-checked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');

      fireEvent.click(b);

      expect(a).toHaveAttribute('data-unchecked', '');
      expect(indicatorA).toHaveAttribute('data-unchecked', '');

      expect(b).toHaveAttribute('data-checked', '');
      expect(indicatorB).toHaveAttribute('data-checked', '');

      fireEvent.click(a);

      expect(a).toHaveAttribute('data-checked', '');
      expect(indicatorA).toHaveAttribute('data-checked', '');

      expect(b).toHaveAttribute('data-unchecked', '');
      expect(indicatorB).toHaveAttribute('data-unchecked', '');
    });
  });

  it('does not forward `value` prop', async () => {
    await render(
      <RadioGroup value="test" data-testid="radio-group">
        <Radio.Root value="" />
      </RadioGroup>,
    );

    expect(screen.getByTestId('radio-group')).not.toHaveAttribute('value');
  });

  it('sets tabIndex=0 to the correct element initially', async () => {
    await render(
      <RadioGroup defaultValue="b">
        <Radio.Root value="a" data-testid="radio-a" />
        <Radio.Root value="b" data-testid="radio-b" />
      </RadioGroup>,
    );

    const radioA = screen.getByTestId('radio-a');
    const radioB = screen.getByTestId('radio-b');

    expect(radioA).not.toHaveAttribute('tabindex', '0');
    expect(radioB).toHaveAttribute('tabindex', '0');
  });

  describe('with native <label>', () => {
    it('associates implicitly', async () => {
      const changeSpy = vi.fn((newValue) => newValue);
      await render(
        <RadioGroup onValueChange={changeSpy}>
          <label data-testid="label">
            <Radio.Root value="apple" />
            Apple
          </label>

          <label data-testid="label">
            <Radio.Root value="banana" />
            Banana
          </label>
        </RadioGroup>,
      );

      const [label1, label2] = screen.getAllByTestId('label');

      fireEvent.click(label1);
      expect(changeSpy.mock.calls.length).toBe(1);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');

      fireEvent.click(label2);
      expect(changeSpy.mock.calls.length).toBe(2);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
    });

    it('associates explicitly', async () => {
      const changeSpy = vi.fn((newValue) => newValue);
      await render(
        <RadioGroup onValueChange={changeSpy}>
          <div>
            <label data-testid="label" htmlFor="RadioA">
              Apple
            </label>
            <Radio.Root value="apple" id="RadioA" />
          </div>

          <div>
            <label data-testid="label" htmlFor="RadioB">
              Banana
            </label>
            <Radio.Root value="banana" id="RadioB" />
          </div>
        </RadioGroup>,
      );

      const [label1, label2] = screen.getAllByTestId('label');

      fireEvent.click(label1);
      expect(changeSpy.mock.calls.length).toBe(1);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');

      fireEvent.click(label2);
      expect(changeSpy.mock.calls.length).toBe(2);
      expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
    });
  });

  describe('Field', () => {
    it('passes the `name` prop to the radio input', async () => {
      await render(
        <Field.Root name="test" data-testid="field">
          <RadioGroup name="group">
            <Field.Item>
              <Radio.Root value="a" data-testid="item" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>,
      );

      const radio = screen.getByTestId('item');
      const input = radio.nextElementSibling as HTMLInputElement;

      expect(input).toHaveAttribute('name', 'test');
    });

    describe('Field.Root', () => {
      it('should receive disabled prop from Field.Root', async () => {
        await render(
          <Field.Root disabled>
            <RadioGroup>
              <Field.Item>
                <Radio.Root value="a" data-testid="radio" />
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radioGroup = screen.getByRole('radiogroup');
        const radio = screen.getByTestId('radio');

        expect(radioGroup).toHaveAttribute('aria-disabled', 'true');
        expect(radioGroup).toHaveAttribute('data-disabled');
        expect(radio).toHaveAttribute('aria-disabled', 'true');
        expect(radio).toHaveAttribute('data-disabled');
      });

      it('should receive name prop from Field.Root', async () => {
        await render(
          <Field.Root name="field-radio">
            <RadioGroup value="a">
              <Field.Item>
                <Radio.Root value="a" data-testid="radio" />
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radio = screen.getByTestId('radio');
        const input = radio.nextElementSibling as HTMLInputElement;

        expect(input).toHaveAttribute('name', 'field-radio');
      });

      it('revalidates when the controlled value changes externally', async () => {
        const validateSpy = vi.fn((value: unknown) => ((value as string) === 'b' ? 'error' : null));

        function App() {
          const [value, setValue] = React.useState('a');

          return (
            <React.Fragment>
              <Field.Root validationMode="onChange" validate={validateSpy} name="choices">
                <RadioGroup
                  value={value}
                  onValueChange={(nextValue) => setValue(nextValue as string)}
                >
                  <Field.Item>
                    <Radio.Root value="a" data-testid="radio" />
                  </Field.Item>
                  <Field.Item>
                    <Radio.Root value="b" data-testid="radio" />
                  </Field.Item>
                </RadioGroup>
              </Field.Root>
              <button type="button" onClick={() => setValue('b')}>
                Select externally
              </button>
            </React.Fragment>
          );
        }

        await render(<App />);

        const radioGroup = screen.getByRole('radiogroup');
        const toggle = screen.getByText('Select externally');

        expect(radioGroup).not.toHaveAttribute('aria-invalid');
        const initialCallCount = validateSpy.mock.calls.length;

        fireEvent.click(toggle);

        expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
        expect(validateSpy.mock.lastCall?.[0]).toBe('b');
        expect(radioGroup).toHaveAttribute('aria-invalid', 'true');
      });
    });

    describe('Field.Label', () => {
      it('associates implicitly', async () => {
        const changeSpy = vi.fn((newValue) => newValue);
        await render(
          <Field.Root name="options">
            <RadioGroup onValueChange={changeSpy}>
              <Field.Item>
                <Field.Label data-testid="label">
                  <Radio.Root value="apple" />
                  Apple
                </Field.Label>
              </Field.Item>
              <Field.Item>
                <Field.Label data-testid="label">
                  <Radio.Root value="banana" />
                  Banana
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const labels = screen.getAllByTestId('label');
        expect(labels.length).toBe(2);
        labels.forEach((label) => {
          expect(label).toHaveAttribute('for');
        });

        fireEvent.click(screen.getByText('Apple'));
        expect(changeSpy.mock.calls.length).toBe(1);
        expect(changeSpy.mock.results.at(-1)?.value).toBe('apple');
      });

      it('associates explicitly', async () => {
        const changeSpy = vi.fn((newValue) => newValue);
        await render(
          <Field.Root name="options">
            <RadioGroup onValueChange={changeSpy}>
              <Field.Item>
                <Radio.Root value="apple" />
                <Field.Label data-testid="label">Apple</Field.Label>
                <Field.Description data-testid="description">
                  An apple is the round, edible fruit of an apple tree
                </Field.Description>
              </Field.Item>
              <Field.Item>
                <Radio.Root value="banana" />
                <Field.Label data-testid="label">Banana</Field.Label>
                <Field.Description data-testid="description">
                  A banana is an elongated, edible fruit
                </Field.Description>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const radios = screen.getAllByRole('radio');
        const labels = screen.getAllByTestId('label');
        const descriptions = screen.getAllByTestId('description');
        const inputs = document.querySelectorAll('input[type="radio"]');

        radios.forEach((radio, index) => {
          const label = labels[index];
          const description = descriptions[index];
          const input = inputs[index];

          expect(label.getAttribute('for')).not.toBe(null);
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));
          expect(description.getAttribute('id')).not.toBe(null);
          expect(description.getAttribute('id')).toBe(radio.getAttribute('aria-describedby'));
        });

        fireEvent.click(screen.getByText('Banana'));
        expect(changeSpy.mock.results.at(-1)?.value).toBe('banana');
      });
    });

    describe('Field.Description', () => {
      it('links the group and individual radios', async () => {
        await render(
          <Field.Root name="apple">
            <RadioGroup defaultValue={[]} aria-describedby="external-description">
              <Field.Description data-testid="group-description">
                Group description
              </Field.Description>
              <Field.Item>
                <Field.Label>
                  <Radio.Root value="fuji-apple" aria-describedby="radio-description" />
                  Fuji
                </Field.Label>
              </Field.Item>
            </RadioGroup>
          </Field.Root>,
        );

        const groupDescription = screen.getByTestId('group-description');
        const groupDescriptionId = groupDescription.getAttribute('id');
        expect(groupDescriptionId).not.toBe(null);
        expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toContain(
          groupDescriptionId,
        );
        expect(screen.getByRole('radio').getAttribute('aria-describedby')).toContain(
          groupDescriptionId,
        );
        expect(screen.getByRole('radio')).toHaveAttribute(
          'aria-describedby',
          `radio-description ${groupDescriptionId}`,
        );
        expect(screen.getByRole('radiogroup')).toHaveAttribute(
          'aria-describedby',
          `external-description ${groupDescriptionId}`,
        );
      });
    });

    describe('prop: validationMode', () => {
      it('onSubmit', async () => {
        const { user } = await render(
          <Form>
            <Field.Root
              validate={(val) => {
                if (val === 'a') {
                  return 'custom error a';
                }

                if (val === 'c') {
                  return 'custom error c';
                }
                return null;
              }}
            >
              <RadioGroup>
                <Radio.Root value="a" data-testid="item" />
                <Radio.Root value="b" data-testid="item" />
                <Radio.Root value="c" data-testid="item" />
              </RadioGroup>
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const radioGroup = screen.getByRole('radiogroup');
        const [radioA, radioB, radioC] = screen.getAllByTestId('item');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(radioA);
        expect(radioA).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(radioC);
        expect(radioC).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');

        await user.click(screen.getByText('submit'));
        expect(radioGroup).toHaveAttribute('aria-invalid');

        await user.click(radioB);
        expect(radioB).toHaveAttribute('data-checked', '');
        expect(radioGroup).not.toHaveAttribute('aria-invalid');
      });
    });
  });

  describe('Fieldset', () => {
    it('labels the radio group from the fieldset legend', async () => {
      await render(
        <Field.Root name="test">
          <Fieldset.Root render={<RadioGroup />}>
            <Fieldset.Legend>Legend</Fieldset.Legend>
            <Field.Item>
              <Radio.Root value="a" />
            </Field.Item>
          </Fieldset.Root>
        </Field.Root>,
      );

      const legend = screen.getByText('Legend');
      const radioGroup = screen.getByRole('radiogroup');

      expect(radioGroup.getAttribute('aria-labelledby')).toBe(legend.getAttribute('id'));
    });
  });

  describe('Form', () => {
    const { render: renderFakeTimers, clock } = createRenderer({
      clockOptions: {
        shouldAdvanceTime: true,
      },
    });

    clock.withFakeTimers();

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('group');
      });

      await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <RadioGroup name="group" form="external-form" defaultValue="b">
            <Radio.Root value="a" />
            <Radio.Root value="b" />
          </RadioGroup>
        </React.Fragment>,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('b');
    });

    it('triggers native HTML validation on submit', async () => {
      const { user } = await renderFakeTimers(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required>
              <Field.Item>
                <Radio.Root value="a" data-testid="item" />
              </Field.Item>
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByText('Submit');

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(submit);

      const error = screen.getByTestId('error');
      expect(error).toHaveTextContent('required');
    });

    it('submits null to onFormSubmit when no radio is selected', async () => {
      const handleSubmit = vi.fn();

      await renderFakeTimers(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root name="test">
            <RadioGroup name="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls.length).toBe(1);
      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('excludes a disabled selected radio from onFormSubmit to match native form data', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [disabled, setDisabled] = React.useState(false);
        return (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="test">
              <RadioGroup name="group" defaultValue="a">
                <Radio.Root value="a" disabled={disabled} data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button type="button" onClick={() => setDisabled(true)}>
              Disable
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      await renderFakeTimers(<App />);

      fireEvent.click(screen.getByText('Disable'));

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).get('test')).toBe(null);

      fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('includes a selected radio again when it is re-enabled before form submission', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [disabled, setDisabled] = React.useState(false);
        return (
          <Form onFormSubmit={handleSubmit} data-testid="form">
            <Field.Root name="test">
              <RadioGroup name="group" defaultValue="a">
                <Radio.Root value="a" disabled={disabled} data-testid="item-a" />
                <Radio.Root value="b" data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button type="button" onClick={() => setDisabled((value) => !value)}>
              Toggle disabled
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      await renderFakeTimers(<App />);

      const form = screen.getByTestId('form') as HTMLFormElement;

      fireEvent.click(screen.getByText('Toggle disabled'));
      expect(new FormData(form).get('test')).toBe(null);

      fireEvent.click(screen.getByText('Toggle disabled'));
      expect(new FormData(form).get('test')).toBe('a');

      fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: 'a' });
    });

    it('excludes an initially disabled selected radio from onFormSubmit to match native form data', async () => {
      const handleSubmit = vi.fn();

      await renderFakeTimers(
        <Form onFormSubmit={handleSubmit} data-testid="form">
          <Field.Root name="test">
            <RadioGroup name="group" defaultValue="a">
              <Radio.Root value="a" disabled data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const form = screen.getByTestId('form') as HTMLFormElement;
      expect(new FormData(form).get('test')).toBe(null);

      fireEvent.click(screen.getByText('Submit'));

      expect(handleSubmit.mock.calls[0][0]).toEqual({ test: null });
    });

    it('clears required validation when a value is selected', async () => {
      const { user } = await renderFakeTimers(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required data-testid="group">
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      const group = screen.getByTestId('group');
      const radioA = screen.getByTestId('item-a');
      const radioB = screen.getByTestId('item-b');

      await user.click(screen.getByText('Submit'));

      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(group).toHaveAttribute('aria-invalid', 'true');
      expect(radioA).toHaveAttribute('aria-invalid', 'true');
      expect(radioB).toHaveAttribute('aria-invalid', 'true');

      await user.click(radioB);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(group).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioA).not.toHaveAttribute('aria-invalid', 'true');
      expect(radioB).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('validates when inputRef is a function', async () => {
      const inputRefSpy = vi.fn(() => () => {});
      const { user } = await renderFakeTimers(
        <Form>
          <Field.Root name="test">
            <RadioGroup name="group" required inputRef={inputRefSpy}>
              <Radio.Root value="a" data-testid="item-a" />
              <Radio.Root value="b" data-testid="item-b" />
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      expect(inputRefSpy.mock.calls.length > 0).toBe(true);
      expect(screen.getByTestId('error')).toHaveTextContent('required');
    });

    it('focuses the first enabled radio when all radios start disabled', async () => {
      function App() {
        const [disabled, setDisabled] = React.useState(true);

        return (
          <Form>
            <Field.Root name="test">
              <RadioGroup name="group" required>
                <Radio.Root value="a" disabled={disabled} data-testid="item-a" />
                <Radio.Root value="b" disabled={disabled} data-testid="item-b" />
              </RadioGroup>
            </Field.Root>
            <button type="button" onClick={() => setDisabled(false)}>
              Enable
            </button>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      const { user } = await renderFakeTimers(<App />);

      await user.click(screen.getByText('Enable'));

      const radioA = screen.getByTestId('item-a');

      await user.click(screen.getByText('Submit'));

      expect(document.activeElement).toBe(radioA);
    });

    it('clears external errors on change', async () => {
      await renderFakeTimers(
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <RadioGroup data-testid="radio-group">
              <Field.Item>
                <Radio.Root value="a" data-testid="item-a" />
              </Field.Item>
              <Field.Item>
                <Radio.Root value="b" data-testid="item-b" />
              </Field.Item>
            </RadioGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const itemA = screen.getByTestId('item-a');
      const radioGroup = screen.getByTestId('radio-group');

      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      fireEvent.click(itemA);

      expect(screen.queryByTestId('error')).toBe(null);
      expect(radioGroup).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('appends the id attribute of the error to aria-describedby of individual radios', async () => {
      const { user } = await renderFakeTimers(
        <Form>
          <Field.Root name="test" data-testid="field">
            <RadioGroup name="group" required>
              <Field.Item>
                <Radio.Root value="a" />
                <Field.Description>description</Field.Description>
              </Field.Item>
            </RadioGroup>
            <Field.Error match="valueMissing" data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('Submit'));

      const error = screen.getByTestId('error');
      const radio = screen.getByRole('radio');
      const description = screen.getByText('description');
      expect(radio.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(radio.getAttribute('aria-describedby')).toContain(description.getAttribute('id'));
    });
  });
});
