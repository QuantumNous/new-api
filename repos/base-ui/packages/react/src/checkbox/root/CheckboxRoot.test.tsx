import { expect, vi } from 'vitest';
import * as React from 'react';
import { act, fireEvent, screen, waitFor } from '@mui/internal-test-utils';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';

describe('<Checkbox.Root />', () => {
  const { render } = createRenderer();

  describeConformance(<Checkbox.Root />, () => ({
    refInstanceof: window.HTMLSpanElement,
    testComponentPropWith: 'span',
    button: true,
    render,
  }));

  describe('ARIA attributes', () => {
    it('sets the correct aria attributes', async () => {
      const { setProps } = await render(<Checkbox.Root data-testid="test" required={false} />);

      expect(screen.getByRole('checkbox')).toBe(screen.getByTestId('test'));
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked');
      await setProps({ required: true });
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('extra props', () => {
    it('can override the built-in attributes', async () => {
      const { container } = await render(<Checkbox.Root role="switch" />);
      expect(container.firstElementChild as HTMLElement).toHaveAttribute('role', 'switch');
    });
  });

  describe('interactions', () => {
    it('should change its state when clicked', async () => {
      await render(<Checkbox.Root />);
      const [checkbox] = screen.getAllByRole('checkbox');
      // querying it separately since hidden true returns both button and input.
      // without hidden it only returns the button (in the above query)
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);

      await act(async () => {
        checkbox.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
      expect(input.checked).toBe(true);

      await act(async () => {
        checkbox.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should update its state when changed from outside', async () => {
      function Test() {
        const [checked, setChecked] = React.useState(false);
        return (
          <div>
            <button onClick={() => setChecked((c) => !c)}>Toggle</button>
            <Checkbox.Root checked={checked} />;
          </div>
        );
      }

      await render(<Test />);
      const [checkbox] = screen.getAllByRole('checkbox');
      const button = screen.getByText('Toggle');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      await act(async () => {
        button.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'true');

      await act(async () => {
        button.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should call onCheckedChange when clicked', async () => {
      const handleChange = vi.fn();
      await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      await act(async () => {
        checkbox.click();
      });

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.calls[0][0]).toBe(true);
    });

    it('does not update its state when onCheckedChange cancels the event', async () => {
      const handleChange = vi.fn((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const checkbox = screen.getByRole('checkbox');
      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });

      fireEvent.click(checkbox);

      expect(handleChange.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      expect(input.checked).toBe(false);
    });

    it('should report keyboard modifier event properties when calling onCheckedChange', async () => {
      const handleChange = vi.fn((checked, eventDetails) => eventDetails);
      const { user } = await render(<Checkbox.Root onCheckedChange={handleChange} />);
      const [checkbox] = screen.getAllByRole('checkbox');

      await user.keyboard('{Shift>}');
      await user.click(checkbox);
      await user.keyboard('{/Shift}');

      expect(handleChange.mock.calls.length).toBe(1);
      expect(handleChange.mock.results[0]?.value.event.shiftKey).toBe(true);
    });

    it('should update its state if the underlying input is toggled', async () => {
      await render(<Checkbox.Root />);
      const checkbox = screen.getByRole('checkbox');
      const internalInput = document.querySelector<HTMLInputElement>('input[type="checkbox"]');

      await act(async () => {
        internalInput?.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('can be activated with Space key', async () => {
      const { user } = await render(<Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Space]');
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('does not activate with Enter key', async () => {
      const { user } = await render(<Checkbox.Root />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      await render(<Checkbox.Root disabled />);
      expect(screen.getByRole('checkbox')).not.toHaveAttribute('disabled');
      expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root disabled />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await act(async () => {
        checkbox.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: readOnly', () => {
    it('should have the `aria-readonly` attribute', async () => {
      await render(<Checkbox.Root readOnly />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-readonly', 'true');
    });

    it('should not have the aria attribute when `readOnly` is not set', async () => {
      await render(<Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-readonly');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root readOnly />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      await act(async () => {
        checkbox.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it('should not change its state when its label is clicked', async () => {
      await render(
        <label data-testid="label">
          <Checkbox.Root readOnly />
        </label>,
      );
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      const labelElement = screen.getByTestId('label');

      await act(async () => {
        labelElement.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: indeterminate', () => {
    it('should set the `aria-checked` attribute as "mixed"', async () => {
      await render(<Checkbox.Root indeterminate />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not change its state when clicked', async () => {
      await render(<Checkbox.Root indeterminate />);
      const [checkbox] = screen.getAllByRole('checkbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');

      await act(async () => {
        checkbox.click();
      });

      expect(checkbox).toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not have the aria attribute when `indeterminate` is not set', async () => {
      await render(<Checkbox.Root />);
      expect(screen.getAllByRole('checkbox')[0]).not.toHaveAttribute('aria-checked', 'mixed');
    });

    it('should not be overridden by `checked` prop', async () => {
      await render(<Checkbox.Root indeterminate checked />);
      expect(screen.getAllByRole('checkbox')[0]).toHaveAttribute('aria-checked', 'mixed');
    });

    it('sets the native input state when indeterminate', async () => {
      await render(<Checkbox.Root indeterminate />);

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });

    it('sets indeterminate style hooks on the root and indicator', async () => {
      await render(
        <Checkbox.Root indeterminate>
          <Checkbox.Indicator data-testid="indicator" />
        </Checkbox.Root>,
      );

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-indeterminate', '');
      expect(screen.getByTestId('indicator')).toHaveAttribute('data-indeterminate', '');
    });

    it('sets grouped parent aria when manually indeterminate', async () => {
      await render(
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>,
      );

      expect(screen.getByTestId('parent')).toHaveAttribute('aria-checked', 'mixed');
    });

    it('sets grouped parent native input state when manually indeterminate', async () => {
      await render(
        <CheckboxGroup value={[]} allValues={['one']}>
          <Checkbox.Root parent indeterminate data-testid="parent" />
          <Checkbox.Root value="one" />
        </CheckboxGroup>,
      );

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input.indeterminate).toBe(true);
    });
  });

  it('should update its state if the underlying input is toggled', async () => {
    await render(<Checkbox.Root />);
    const [checkbox] = screen.getAllByRole('checkbox');
    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });

    await act(async () => {
      input.click();
    });

    expect(checkbox).toHaveAttribute('aria-checked', 'true');
  });

  it('should place the style hooks on the root and the indicator', async () => {
    const { setProps } = await render(
      <Checkbox.Root defaultChecked disabled readOnly required>
        <Checkbox.Indicator />
      </Checkbox.Root>,
    );

    const [checkbox] = screen.getAllByRole('checkbox');
    const indicator = checkbox.querySelector('span');

    expect(checkbox).toHaveAttribute('data-checked', '');
    expect(checkbox).not.toHaveAttribute('data-unchecked');

    expect(checkbox).toHaveAttribute('data-disabled', '');
    expect(checkbox).toHaveAttribute('data-readonly', '');
    expect(checkbox).toHaveAttribute('data-required', '');

    expect(indicator).toHaveAttribute('data-checked', '');
    expect(indicator).not.toHaveAttribute('data-unchecked');

    expect(indicator).toHaveAttribute('data-disabled', '');
    expect(indicator).toHaveAttribute('data-readonly', '');
    expect(indicator).toHaveAttribute('data-required', '');

    await setProps({ disabled: false, readOnly: false });
    fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('data-unchecked', '');
    expect(checkbox).not.toHaveAttribute('data-checked');
  });

  it('should set the name attribute only on the input', async () => {
    await render(<Checkbox.Root name="checkbox-name" />);

    const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
      hidden: true,
    });
    expect(input).toHaveAttribute('name', 'checkbox-name');
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('name');
  });

  // flaky with user.click
  describe('with native <label>', () => {
    it('should toggle the checkbox when a wrapping <label> is clicked', async () => {
      await render(
        <label data-testid="label">
          <Checkbox.Root />
          Toggle
        </label>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should toggle the checkbox when a explicitly linked <label> is clicked', async () => {
      await render(
        <div>
          <label data-testid="label" htmlFor="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" />
        </div>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });

    it('should associate `id` with the native button when `nativeButton=true`', async () => {
      await render(
        <div>
          <label data-testid="label" htmlFor="myCheckbox">
            Toggle
          </label>

          <Checkbox.Root id="myCheckbox" nativeButton render={<button />} />
        </div>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveAttribute('id', 'myCheckbox');

      const hiddenInputs = screen.getAllByRole<HTMLInputElement>('checkbox', { hidden: true });
      const hiddenInput = hiddenInputs.find((input) => input !== checkbox);
      expect(hiddenInput).not.toBe(undefined);
      expect(hiddenInput).not.toHaveAttribute('id', 'myCheckbox');

      expect(checkbox).toHaveAttribute('aria-checked', 'false');
      fireEvent.click(screen.getByTestId('label'));
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('Form', () => {
    it('triggers native HTML validation on submit', async () => {
      const { user } = await render(
        <Form>
          <Field.Root name="test" data-testid="field">
            <Checkbox.Root required />
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
            <Checkbox.Root data-testid="checkbox" />
            <Field.Error data-testid="error" />
          </Field.Root>
        </Form>,
      );

      const checkbox = screen.getByTestId('checkbox');

      expect(checkbox).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('test');

      fireEvent.click(checkbox);

      expect(checkbox).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'should include the checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await act(async () => {
          checkbox.click();
        });

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
      },
    );

    it.skipIf(isJSDOM)('submits the form when Enter is pressed while focused', async () => {
      const submitSpy = vi.fn((event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return {
          value: formData.get('test-checkbox'),
          submitter: (event.nativeEvent as SubmitEvent).submitter,
        };
      });
      const submitClickSpy = vi.fn();

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root />
          </Field.Root>
          <button id="submit-button" type="submit" onClick={submitClickSpy}>
            Submit
          </button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value.value).toBe(null);
      expect(submitSpy.mock.results.at(-1)?.value.submitter).toBe(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(submitClickSpy.mock.calls.length).toBe(1);
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the consumer prevents default',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root onKeyDown={(event) => event.preventDefault()} />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when an ancestor prevents default',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
        });
        const keyDownSpy = vi.fn((event: React.KeyboardEvent) => {
          const defaultPrevented = event.defaultPrevented;
          event.preventDefault();
          return defaultPrevented;
        });

        const { user } = await render(
          <Form onSubmit={submitSpy} onKeyDown={keyDownSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(keyDownSpy.mock.results.at(-1)?.value).toBe(false);
        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits the form with Enter when readOnly', async () => {
      const submitSpy = vi.fn((event) => {
        event.preventDefault();
        return (event.nativeEvent as SubmitEvent).submitter;
      });

      const { user } = await render(
        <Form onSubmit={submitSpy}>
          <Field.Root name="test-checkbox">
            <Checkbox.Root readOnly />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');

      await user.keyboard('[Tab]');
      expect(checkbox).toHaveFocus();

      await user.keyboard('[Enter]');

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(
        screen.getByRole('button', { name: 'Submit' }),
      );
      expect(checkbox).toHaveAttribute('aria-checked', 'false');
    });

    it.skipIf(isJSDOM)(
      'submits the form once with Enter when rendered as a native button',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          return (event.nativeEvent as SubmitEvent).submitter;
        });
        const submitClickSpy = vi.fn();

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root render={<button />} nativeButton />
            </Field.Root>
            <button type="submit" onClick={submitClickSpy}>
              Submit
            </button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(
          screen.getByRole('button', { name: 'Submit' }),
        );
        expect(submitClickSpy.mock.calls.length).toBe(1);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when there is no submit button',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)(
      'does not submit the form with Enter when the default button is disabled',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
        });

        const { user } = await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root />
            </Field.Root>
            <button type="submit" disabled>
              Disabled
            </button>
            <button type="submit">Enabled</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        // getDefaultFormSubmitter intentionally returns the disabled default button;
        // clicking it should be a no-op rather than falling through to a later submitter.
        expect(submitSpy.mock.calls.length).toBe(0);
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits to an external form when `form` is provided', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-checkbox');
      });

      const { user } = await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" />
        </React.Fragment>,
      );

      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'submits to an external form with Enter when `form` is provided',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          return (event.nativeEvent as SubmitEvent).submitter;
        });

        const { user } = await render(
          <React.Fragment>
            <Checkbox.Root name="test-checkbox" form="external-form" />
            <form id="external-form" onSubmit={submitSpy}>
              <button type="submit">Submit</button>
            </form>
          </React.Fragment>,
        );

        const checkbox = screen.getByRole('checkbox');

        await user.keyboard('[Tab]');
        expect(checkbox).toHaveFocus();

        await user.keyboard('[Enter]');

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(screen.getByRole('button'));
        expect(checkbox).toHaveAttribute('aria-checked', 'false');
      },
    );

    it.skipIf(isJSDOM)('submits uncheckedValue to an external form when unchecked', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-checkbox');
      });

      await render(
        <React.Fragment>
          <form id="external-form" onSubmit={submitSpy}>
            <button type="submit">Submit</button>
          </form>
          <Checkbox.Root name="test-checkbox" form="external-form" uncheckedValue="off" />
        </React.Fragment>,
      );

      fireEvent.click(screen.getByRole('button'));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
    });

    it.skipIf(isJSDOM)(
      'should include the custom checkbox value in form submission, matching native checkbox behavior',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root value="test-value" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe(null);

        await act(async () => {
          checkbox.click();
        });

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('test-value');
      },
    );

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
            <Checkbox.Root />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const customCheckbox = screen.getAllByRole('checkbox')[1];
      const customSubmitButton = screen.getAllByRole('button')[1]!;

      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe(null);
      expect(customSubmitSpy.mock.results.at(-1)?.value.getAll).toEqual([]);

      await customUser.click(customCheckbox);
      await customUser.click(customSubmitButton);
      expect(customSubmitSpy.mock.results.at(-1)?.value.get).toBe('on');
    });

    it.skipIf(isJSDOM)(
      'should submit uncheckedValue when checkbox is unchecked and uncheckedValue is specified',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="off" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');

        await act(async () => {
          checkbox.click();
        });

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('on');

        await act(async () => {
          checkbox.click();
        });

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(3);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('off');
      },
    );

    it.skipIf(isJSDOM)('does not submit uncheckedValue when disabled', async () => {
      const submitSpy = vi.fn((event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        return formData.get('test-checkbox');
      });

      const { user } = await render(
        <form onSubmit={submitSpy}>
          <Checkbox.Root name="test-checkbox" uncheckedValue="off" disabled />
          <button type="submit">Submit</button>
        </form>,
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(submitSpy.mock.calls.length).toBe(1);
      expect(submitSpy.mock.results.at(-1)?.value).toBe(null);
    });

    it.skipIf(isJSDOM)(
      'should submit custom uncheckedValue when checkbox is unchecked',
      async () => {
        const submitSpy = vi.fn((event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          return formData.get('test-checkbox');
        });

        await render(
          <Form onSubmit={submitSpy}>
            <Field.Root name="test-checkbox">
              <Checkbox.Root uncheckedValue="false" value="true" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>,
        );

        const checkbox = screen.getByRole('checkbox');
        const submitButton = screen.getByRole('button')!;

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(1);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('false');

        await act(async () => {
          checkbox.click();
        });

        await act(async () => {
          submitButton.click();
        });

        expect(submitSpy.mock.calls.length).toBe(2);
        expect(submitSpy.mock.results.at(-1)?.value).toBe('true');
      },
    );
  });

  describe('Field', () => {
    it('should receive disabled prop from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Checkbox.Root />
        </Field.Root>,
      );

      const [checkbox] = screen.getAllByRole('checkbox');
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('should receive name prop from Field.Root', async () => {
      await render(
        <Field.Root name="field-checkbox">
          <Checkbox.Root />
        </Field.Root>,
      );

      const [, input] = screen.getAllByRole<HTMLInputElement>('checkbox', {
        hidden: true,
      });
      expect(input).toHaveAttribute('name', 'field-checkbox');
    });

    it('[data-touched]', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root data-testid="button" />
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
            <Checkbox.Root data-testid="button" />
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
            <Checkbox.Root data-testid="button" defaultChecked />
          </Field.Root>,
        );

        const button = screen.getByTestId('button');

        expect(button).toHaveAttribute('data-filled');

        fireEvent.click(button);

        expect(button).not.toHaveAttribute('data-filled', '');
      });

      it('adds [data-filled] attribute when any checkbox is filled when inside a group', async () => {
        await render(
          <Field.Root>
            <CheckboxGroup defaultValue={['1', '2']}>
              <Checkbox.Root name="1" data-testid="button-1" />
              <Checkbox.Root name="2" data-testid="button-2" />
            </CheckboxGroup>
          </Field.Root>,
        );

        const button1 = screen.getByTestId('button-1');
        const button2 = screen.getByTestId('button-2');

        expect(button1).toHaveAttribute('data-filled');
        expect(button2).toHaveAttribute('data-filled');

        fireEvent.click(button1);

        expect(button1).toHaveAttribute('data-filled');
        expect(button2).toHaveAttribute('data-filled');

        fireEvent.click(button2);

        expect(button1).not.toHaveAttribute('data-filled');
        expect(button2).not.toHaveAttribute('data-filled');
      });
    });

    it('[data-focused]', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-focused');

      fireEvent.focus(button);

      expect(button).toHaveAttribute('data-focused', '');

      fireEvent.blur(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('does not set [data-focused] when disabled', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root disabled data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      fireEvent.focus(button);

      expect(button).not.toHaveAttribute('data-focused');
    });

    it('[data-invalid]', async () => {
      await render(
        <Field.Root invalid>
          <Checkbox.Root data-testid="button" />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).toHaveAttribute('data-invalid', '');
    });

    it('[data-valid]', async () => {
      await render(
        <Field.Root validationMode="onBlur">
          <Checkbox.Root data-testid="button" required />
        </Field.Root>,
      );

      const button = screen.getByTestId('button');

      expect(button).not.toHaveAttribute('data-valid');
      expect(button).not.toHaveAttribute('data-invalid');

      // Check the checkbox and trigger validation
      fireEvent.click(button);
      fireEvent.focus(button);
      fireEvent.blur(button);

      expect(button).toHaveAttribute('data-valid', '');
      expect(button).not.toHaveAttribute('data-invalid');
    });

    it('prop: validationMode=onSubmit', async () => {
      await render(
        <Form>
          <Field.Root>
            <Checkbox.Root required />
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.click(screen.getByText('submit'));
      expect(checkbox).toHaveAttribute('aria-invalid', 'true');

      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-unchecked', '');
      expect(checkbox).toHaveAttribute('aria-invalid');

      fireEvent.click(checkbox);
      expect(checkbox).toHaveAttribute('data-checked', '');
      expect(checkbox).not.toHaveAttribute('aria-invalid');
    });

    it('props: validationMode=onChange', async () => {
      await render(
        <Field.Root
          validationMode="onChange"
          validate={(value) => {
            const checked = value as boolean;
            return checked ? 'error' : null;
          }}
        >
          <Checkbox.Root data-testid="button" />
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
          <Checkbox.Root />
        </Field.Root>,
      );

      await user.click(screen.getByRole('checkbox'));

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe(true);
    });

    it('revalidates when a controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => ((value as boolean) ? 'error' : null));

      function App() {
        const [checked, setChecked] = React.useState(false);

        return (
          <React.Fragment>
            <Field.Root validationMode="onChange" validate={validateSpy} name="terms">
              <Checkbox.Root data-testid="button" checked={checked} onCheckedChange={setChecked} />
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
          <Checkbox.Root data-testid="button" />
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
      describe('explicit association', () => {
        it('when label and checkbox are siblings', async () => {
          await render(
            <Field.Root>
              <Field.Label>Label</Field.Label>
              <Checkbox.Root />
            </Field.Root>,
          );

          const label = screen.getByText('Label');
          expect(label.getAttribute('id')).not.toBe(null);

          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));
          expect(checkbox).toHaveAttribute('aria-checked', 'false');

          fireEvent.click(label);
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });

      describe('implicit association', () => {
        it('sets `for` on the label', async () => {
          await render(
            <Field.Root>
              <Field.Label data-testid="label">
                <Checkbox.Root />
                OK
              </Field.Label>
            </Field.Root>,
          );

          const label = screen.getByTestId('label');
          const input = document.querySelector('input[type="checkbox"]');
          expect(label.getAttribute('for')).not.toBe(null);
          expect(label.getAttribute('for')).toBe(input?.getAttribute('id'));

          const checkbox = screen.getByRole('checkbox');
          expect(label.getAttribute('id')).not.toBe(null);
          expect(checkbox.getAttribute('aria-labelledby')).toBe(label.getAttribute('id'));

          expect(checkbox).toHaveAttribute('aria-checked', 'false');
          fireEvent.click(screen.getByText('OK'));
          expect(checkbox).toHaveAttribute('aria-checked', 'true');
        });
      });
    });

    it('Field.Description', async () => {
      await render(
        <Field.Root>
          <Checkbox.Root data-testid="button" aria-describedby="external-description" />
          <Field.Description data-testid="description" />
        </Field.Root>,
      );

      const internalInput = screen.getByRole<HTMLInputElement>('checkbox');

      expect(internalInput).toHaveAttribute(
        'aria-describedby',
        `external-description ${screen.getByTestId('description').id}`,
      );
    });
  });

  it('should change state when clicking the checkbox if it has a wrapping label', async () => {
    await render(
      <label data-testid="label">
        <Checkbox.Root />
        Toggle
      </label>,
    );

    const [checkbox] = screen.getAllByRole('checkbox');

    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(checkbox);

    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    await render(
      <div>
        <label htmlFor="checkbox-input">Label</label>
        <Checkbox.Root id="checkbox-input" />
      </div>,
    );

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    function TestCase() {
      const [id, setId] = React.useState('checkbox-input-a');

      return (
        <React.Fragment>
          <label htmlFor="checkbox-input-a">Label A</label>
          <label htmlFor="checkbox-input-b">Label B</label>
          <Checkbox.Root id={id} />
          <button type="button" onClick={() => setId('checkbox-input-b')}>
            Toggle
          </button>
        </React.Fragment>
      );
    }

    await render(<TestCase />);

    const checkbox = screen.getByRole('checkbox');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(checkbox).toHaveAttribute('aria-labelledby', labelA.id);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      const labelB = screen.getByText('Label B');

      expect(labelB.id).not.toBe('');
      expect(labelA.id).not.toBe(labelB.id);
      expect(checkbox).toHaveAttribute('aria-labelledby', labelB.id);
    });
  });

  it('can render a native button', async () => {
    const { container, user } = await render(<Checkbox.Root render={<button />} nativeButton />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
    // eslint-disable-next-line testing-library/no-container
    expect(container.querySelector('button')).toBe(checkbox);

    await user.keyboard('[Tab]');
    expect(checkbox).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(checkbox).toHaveAttribute('aria-checked', 'false');

    await user.keyboard('[Space]');
    expect(checkbox).toHaveAttribute('aria-checked', 'true');

    await user.click(checkbox);
    expect(checkbox).toHaveAttribute('aria-checked', 'false');
  });
});
