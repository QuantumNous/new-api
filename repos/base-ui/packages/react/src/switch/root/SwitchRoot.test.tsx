import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { Switch } from '@base-ui/react/switch';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';

describe('<Switch.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Switch.Root />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testComponentPropWith: 'span',
    button: true,
    render,
  }));

  describe('interactions', () => {
    it('should change its state when clicked', async () => {
      await render(<Switch.Root />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await act(async () => {
        switchElement.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should update its state when changed from outside', async () => {
      function Test() {
        const [checked, setChecked] = React.useState(false);
        return (
          <div>
            <button onClick={() => setChecked((c) => !c)}>Toggle</button>
            <Switch.Root checked={checked} />;
          </div>
        );
      }

      await render(<Test />);
      const switchElement = screen.getByRole('switch');
      const button = screen.getByText('Toggle');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      await act(async () => {
        button.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        button.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should update its state if the underlying input is toggled', async () => {
      await render(<Switch.Root />);
      const switchElement = screen.getByRole('switch');
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      await act(async () => {
        internalInput.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    ['Enter', 'Space'].forEach((key) => {
      it(`can be activated with ${key} key`, async () => {
        const { user } = await render(<Switch.Root />);

        const switchEl = screen.getByRole('switch');
        expect(switchEl).toHaveAttribute('aria-checked', 'false');

        await user.keyboard('[Tab]');
        expect(switchEl).toHaveFocus();

        await user.keyboard(`[${key}]`);
        expect(switchEl).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('extra props', () => {
    it('should override the built-in attributes', async () => {
      await render(<Switch.Root role="checkbox" data-testid="switch" />);
      expect(screen.getByTestId('switch')).toHaveAttribute('role', 'checkbox');
    });

    it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
      await render(
        <div>
          <label htmlFor="switch-input">Label</label>
          <Switch.Root id="switch-input" />
        </div>,
      );

      const label = screen.getByText('Label');
      expect(label.id).not.toBe('');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-labelledby', label.id);
    });

    it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
      function TestCase() {
        const [id, setId] = React.useState('switch-input-a');

        return (
          <React.Fragment>
            <label htmlFor="switch-input-a">Label A</label>
            <label htmlFor="switch-input-b">Label B</label>
            <Switch.Root id={id} />
            <button type="button" onClick={() => setId('switch-input-b')}>
              Toggle
            </button>
          </React.Fragment>
        );
      }

      await render(<TestCase />);

      const switchEl = screen.getByRole('switch');
      const labelA = screen.getByText('Label A');

      expect(labelA.id).not.toBe('');
      expect(switchEl).toHaveAttribute('aria-labelledby', labelA.id);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      await waitFor(() => {
        const labelB = screen.getByText('Label B');

        expect(labelB.id).not.toBe('');
        expect(labelA.id).not.toBe(labelB.id);
        expect(switchEl).toHaveAttribute('aria-labelledby', labelB.id);
      });
    });
  });

  describe('prop: onCheckedChange', () => {
    it('should call onCheckedChange when clicked', async () => {
      const handleChange = vi.fn();
      await render(<Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      await act(async () => {
        switchElement.click();
      });

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((checked, eventDetails) => eventDetails);
      const { user } = await render(<Switch.Root onCheckedChange={handleChange} />);
      const switchElement = screen.getByRole('switch');

      await user.keyboard('{Shift>}');
      await user.click(switchElement);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('does not change state when canceled via a root click', async () => {
      const { user } = await render(
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>,
      );

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(switchElement);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });

    it('does not change state when canceled via a hidden input click', async () => {
      const { user } = await render(
        <Field.Root>
          <Switch.Root
            data-testid="button"
            onCheckedChange={(_, eventDetails) => eventDetails.cancel()}
          />
        </Field.Root>,
      );

      const switchElement = screen.getByTestId('button');
      const input = screen.getByRole<HTMLInputElement>('checkbox', { hidden: true });

      await user.click(input);

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
      expect(switchElement).not.toHaveAttribute('data-dirty');
      expect(switchElement).not.toHaveAttribute('data-filled');
    });
  });

  describe('prop: onClick', () => {
    it('should call onClick when clicked', async () => {
      const handleClick = vi.fn();
      await render(<Switch.Root onClick={handleClick} />);
      const switchElement = screen.getByRole('switch');

      await act(async () => {
        switchElement.click();
      });

      expect(handleClick.mock.calls.length).toBe(1);
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(<Switch.Root disabled />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not have the `disabled` attribute when `disabled` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('disabled');
    });

    it('should not change its state when clicked', async () => {
      await render(<Switch.Root disabled />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await act(async () => {
        switchElement.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<Switch.Root readOnly />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(<Switch.Root readOnly />);
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await act(async () => {
        switchElement.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', async () => {
      await render(
        <label data-testid="label">
          <Switch.Root readOnly />
        </label>,
      );
      const switchElement = screen.getByRole('switch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      const labelElement = screen.getByTestId('label');

      await act(async () => {
        labelElement.click();
      });

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: required', () => {
    it('should have the `aria-required` attribute', async () => {
      await render(<Switch.Root required />);
      expect(screen.getByRole('switch')).toHaveAttribute('aria-required', 'true');
    });

    it('should not have the aria attribute when `required` is not set', async () => {
      await render(<Switch.Root />);
      expect(screen.getByRole('switch')).not.toHaveAttribute('aria-required');
    });
  });

  describe('prop: inputRef', () => {
    it('should be able to access the native input', async () => {
      const inputRef = React.createRef<HTMLInputElement>();
      await render(<Switch.Root inputRef={inputRef} />);
      const internalInput = screen.getByRole('checkbox', { hidden: true });

      expect(inputRef.current).toBe(internalInput);
    });
  });

  it('should place the style hooks on the root and the thumb', async () => {
    const { setProps } = await render(
      <Switch.Root defaultChecked disabled readOnly required>
        <Switch.Thumb data-testid="thumb" />
      </Switch.Root>,
    );

    const switchElement = screen.getByRole('switch');
    const thumb = screen.getByTestId('thumb');

    expect(switchElement).toHaveAttribute('data-checked', '');
    expect(switchElement).toHaveAttribute('data-disabled', '');
    expect(switchElement).toHaveAttribute('data-readonly', '');
    expect(switchElement).toHaveAttribute('data-required', '');

    expect(thumb).toHaveAttribute('data-checked', '');
    expect(thumb).toHaveAttribute('data-disabled', '');
    expect(thumb).toHaveAttribute('data-readonly', '');
    expect(thumb).toHaveAttribute('data-required', '');

    await setProps({ disabled: false, readOnly: false });
    fireEvent.click(switchElement);

    expect(switchElement).toHaveAttribute('data-unchecked', '');
    expect(switchElement).not.toHaveAttribute('data-checked');

    expect(thumb).toHaveAttribute('data-unchecked', '');
    expect(thumb).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', async () => {
    await render(<Switch.Root name="switch-name" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('name', 'switch-name');
    expect(switchElement).not.toHaveAttribute('name');
  });

  it('should not set the value attribute by default', async () => {
    await render(<Switch.Root />);

    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).not.toHaveAttribute('value');
  });

  it('should set the value attribute only on the input', async () => {
    await render(<Switch.Root value="1" />);

    const switchElement = screen.getByRole('switch');
    const input = screen.getByRole('checkbox', { hidden: true });

    expect(input).toHaveAttribute('value', '1');
    expect(switchElement).not.toHaveAttribute('value');
  });

  describe('with native <label>', () => {
    it('should toggle the switch when a wrapping <label> is clicked', async () => {
      const { user } = await render(
        <label data-testid="label">
          <Switch.Root />
          Toggle
        </label>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the switch when a explicitly linked <label> is clicked', async () => {
      const { user } = await render(
        <div>
          <label data-testid="label" htmlFor="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" />
        </div>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('aria-checked', 'false');

      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      const { user } = await render(
        <div>
          <label data-testid="label" htmlFor="mySwitch">
            Toggle
          </label>

          <Switch.Root id="mySwitch" nativeButton render={<button />} />
        </div>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('id', 'mySwitch');

      const hiddenInput = screen.getByRole('checkbox', { hidden: true });
      expect(hiddenInput).not.toHaveAttribute('id', 'mySwitch');

      expect(switchElement).toHaveAttribute('aria-checked', 'false');
      await user.click(screen.getByTestId('label'));
      expect(switchElement).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    // FormData is not available in JSDOM
    it.skipIf(isJSDOM)(
      'should include the switch value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-switch');
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
      },
    );

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-switch');
      });

      const { user } = await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" />
        </React.Fragment>,
      );

      await user.click(screen.getByRole('switch'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)('submits uncheckedValue to an external form when off', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-switch');
      });

      await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Switch.Root name="test-switch" form="external-form" uncheckedValue="off" />
        </React.Fragment>,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it.skipIf(isJSDOM)('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-switch');
      });

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Switch.Root name="test-switch" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    });

    it.skipIf(isJSDOM)('matches native checkbox form submission behavior', async () => {
      const nativeSubmitSpy = vi.fn((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return {
          get: formData.get('native'),
          getAll: formData.getAll('native'),
        };
      });

      const customSubmitSpy = vi.fn((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return {
          get: formData.get('custom'),
          getAll: formData.getAll('custom'),
        };
      });

      const { user: nativeUser } = await render(
        <form onSubmit={nativeSubmitSpy}>
          <input type="checkbox" name="native" />
          <button type="submit">Submit</button>
        </form>,
      );

      const nativeCheckbox = screen.getByRole('checkbox');
      const nativeSubmitButton = screen.getByRole('button')!;

      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await nativeUser.click(nativeCheckbox);
      await nativeUser.click(nativeSubmitButton);
      expect(nativeSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');

      const { user: customUser } = await render(
        <Form onSubmit={customSubmitSpy}>
          <Field.Root name="custom">
            <Switch.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const customSwitch = screen.getByRole('switch');
      const customSubmitButton = screen.getAllByRole('button')[1]!;

      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(customSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await customUser.click(customSwitch);
      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'should submit uncheckedValue when switch is off and uncheckedValue is specified',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-switch');
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root uncheckedValue="off" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');

        await user.click(switchElement);
        await user.click(submitButton);

        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
      },
    );

    it.skipIf(isJSDOM)('should submit custom uncheckedValue when switch is off', async () => {
      const submitSpy = vi.fn((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-switch');
      });

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-switch">
            <Switch.Root uncheckedValue="false" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const switchElement = screen.getByRole('switch');
      const submitButton = screen.getByRole('button')!;

      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('false');

      await user.click(switchElement);
      await user.click(submitButton);

      expect(submitSpy.mock.calls.length).toBe(2);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'submits custom value and uncheckedValue across an off/on/off cycle',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-switch');
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-switch">
              <Switch.Root value="yes" uncheckedValue="no" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const switchElement = screen.getByRole('switch');
        const submitButton = screen.getByRole('button')!;

        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('no');

        await user.click(switchElement);
        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('yes');

        await user.click(switchElement);
        await user.click(submitButton);
        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('no');
      },
    );

    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test">
            <Switch.Root name="switch" required />
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

    it('clears external errors on change', async () => {
      await render(
        <Form
          errors={{
            test: 'test',
          }}
        >
          <Field.Root name="test" data-testid="field">
            <Switch.Root data-testid="switch" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const switchElement = screen.getByTestId('switch');

      expect(switchElement).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      fireEvent.click(switchElement);

      expect(switchElement).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Switch.Root />
        </Field.Root>,
      );

      const switchElement = screen.getByRole('switch');
      expect(switchElement).toHaveAttribute('data-disabled');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-switch">
          <Switch.Root />
        </Field.Root>,
      );

      const input = screen.getByRole('checkbox', { hidden: true });
      expect(input).toHaveAttribute('name', 'field-switch');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      fireEvent.focus(button);
      fireEvent.blur(button);

      expect(button).toHaveAttribute('data-touched', '');
    });

    it('[data-dirty]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-dirty');

      fireEvent.click(button);

      expect(button).toHaveAttribute('data-dirty', '');
    });

    describe('[data-filled]', () => {
      it('adds [data-filled] attribute when checked after being initially unchecked', async () => {
        await render(
          <Field.Root>
            <Switch.Root data-testid="button" />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).not.toHaveAttribute('data-filled');

        fireEvent.click(button);

        expect(button).toHaveAttribute('data-filled', '');

        fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled');
      });

      it('removes [data-filled] attribute when unchecked after being initially checked', async () => {
        await render(
          <Field.Root>
            <Switch.Root data-testid="button" defaultChecked />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).toHaveAttribute('data-filled');

        fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled', '');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-focused');

      fireEvent.focus(button);

      expect(button).toHaveAttribute('data-focused', '');

      fireEvent.blur(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('prop: validationMode=onSubmit', async () => {
      await render(
        <Form>
          <Field.Root>
            <Switch.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const button = screen.getByRole('switch');
      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.click(screen.getByText('submit'));
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);

      fireEvent.click(button);
      expect(button).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('prop: validationMode=onChange', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.click(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('validates once when changed by the user', async () => {
      const validate = vi.fn();

      const { user } = await render(
        <Field.Root validationMode="onChange" validate={validate}>
          <Switch.Root />
        </Field.Root>,
      );

      await user.click(screen.getByRole('switch'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));

      function App() {
        const [checked, setChecked] = React.useState(false);

        return (
          <React.Fragment>
            <Field.Root validationMode="onChange" validate={validateSpy} name="newsletters">
              <Switch.Root data-testid="button" checked={checked} onCheckedChange={setChecked} />
            </Field.Root>
            <button type="button" onClick={() => setChecked((prev) => !prev)}>
              Toggle externally
            </button>
          </React.Fragment>
        );
      }

      await render(<App />);

      const button = screen.getByTestId('button');
      const toggle = screen.getByText('Toggle externally');

      expect(button).not.toHaveAttribute('aria-invalid');
      const initialCallCount = validateSpy.mock.calls.length;

      fireEvent.click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toBe(true);
      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    it('prop: validationMode=onBlur', async () => {
      await render(
        <Field.Root
          validationMode="onBlur"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Switch.Root data-testid="button" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('aria-invalid');

      fireEvent.click(button);
      fireEvent.blur(button);

      expect(button).toHaveAttribute('aria-invalid', 'true');
    });

    describe('Field.Label', () => {
      describe('implicit', () => {
        it('sets `for` on the label', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label">
                <Switch.Root />
                OK
              </Field.Label>
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const switchEl = screen.getByRole('switch');
          expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          expect(switchEl).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('explicit association', () => {
        it('when the label is sibling to the switch', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label">Label</Field.Label>
              <Switch.Root />
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          const switchEl = screen.getByRole('switch');
          const input = document.querySelector('input[type="checkbox"]');

          expect(label.getAttribute('for')).not.toBe(null);

          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));
          expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));

          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          expect(switchEl).toHaveAttribute('aria-checked', 'true');
        });

        it('when rendering a non-native button', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label">OK</Field.Label>
              <Switch.Root render={<span />} nativeButton={false} />
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          expect(label.getAttribute('for')).not.toBe(null);
          const input = document.querySelector('input[type="checkbox"]');
          expect(input?.getAttribute('id')).toBe(label.getAttribute('for'));
          const switchEl = screen.getByRole('switch');
          expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
        });

        it('when rendering a non-native label', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label" render={<span />} nativeLabel={false}>
                <Switch.Root data-testid="button" />
              </Field.Label>
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          const switchEl = screen.getByRole('switch');

          expect(label.getAttribute('for')).toBe(null);
          expect(label.getAttribute('id')).not.toBe(null);

          expect(switchEl.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(switchEl).toHaveAttribute('aria-checked', 'false');

          // non-native labels cannot toggle a non-native-button switch
          fireEvent.click(label);
          expect(switchEl).not.toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Switch.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      const internalInput = screen.queryByRole<HTMLInputElement>('checkbox', { hidden: true });
      const description = screen.getByTestId('description');

      expect(internalInput).toHaveAttribute('aria-describedby', description.id);
      expect(screen.getByRole('switch')).toHaveAttribute(
        'aria-describedby',
        `external-description ${description.id}`,
      );
    });
  });

  it('can render a native button', async () => {
    const { container, user } = await render(<Switch.Root render={<button />} nativeButton />);

    const switchEl = screen.getByRole('switch');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('button')).toBe(switchEl);

    await user.keyboard('[Tab]');
    expect(switchEl).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(switchEl).toHaveAttribute('aria-checked', 'true');

    await user.keyboard('[Space]');
    expect(switchEl).toHaveAttribute('aria-checked', 'false');

    await user.click(switchEl);
    expect(switchEl).toHaveAttribute('aria-checked', 'true');
  });
});
