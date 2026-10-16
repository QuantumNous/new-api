import { expect, vi } from 'vitest';
import * as React from 'react';
import { createRenderer, screen, fireEvent } from '@mui/internal-test-utils';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Checkbox } from '@base-ui/react/checkbox';
import { Field } from '@base-ui/react/field';
import { Form } from '@base-ui/react/form';
import { describeConformance, isJSDOM } from '#test-utils';

describe('<CheckboxGroup />', () => {
  const { render } = createRenderer();

  describeConformance(<CheckboxGroup />, () => ({
    inheritComponent: 'div',
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  describe('prop: id', () => {
    it('is forwarded to the root element', () => {
      render(<CheckboxGroup id="group-id" />);

      expect(screen.getByRole('group')).toHaveAttribute('id', 'group-id');
    });
  });

  describe('prop: value', () => {
    it('should control the value', () => {
      function App() {
        const [value, setValue] = React.useState(['red']);
        return (
          <CheckboxGroup value={value} onValueChange={setValue}>
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(blue);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'true');

      fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'true');
    });
  });

  describe('prop: onValueChange', () => {
    it('should be called when the value changes', () => {
      const handleValueChange = vi.fn();

      function App() {
        const [value, setValue] = React.useState<string[]>([]);
        return (
          <CheckboxGroup
            value={value}
            onValueChange={(nextValue) => {
              setValue(nextValue);
              handleValueChange(nextValue);
            }}
          >
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      fireEvent.click(red);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      fireEvent.click(green);

      expect(handleValueChange.mock.calls.length).toBe(2);
      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      fireEvent.click(blue);

      expect(handleValueChange.mock.calls.length).toBe(3);
      expect(handleValueChange.mock.calls[2][0]).toEqual(['red', 'green', 'blue']);
    });

    it('should treat an omitted defaultValue as an empty array', () => {
      const handleValueChange = vi.fn();

      render(
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root name="red" data-testid="red" />
          <Checkbox.Root name="green" data-testid="green" />
          <Checkbox.Root name="blue" data-testid="blue" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      fireEvent.click(red);

      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);

      fireEvent.click(green);

      expect(handleValueChange.mock.calls[1][0]).toEqual(['red', 'green']);

      fireEvent.click(red);

      expect(handleValueChange.mock.calls[2][0]).toEqual(['green']);
    });

    it('does not update the group when onValueChange cancels the event', () => {
      const handleValueChange = vi.fn((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
        eventDetails.cancel();
      });

      render(
        <CheckboxGroup onValueChange={handleValueChange}>
          <Checkbox.Root value="red" data-testid="red" />
          <Checkbox.Root value="green" data-testid="green" />
        </CheckboxGroup>,
      );

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');

      fireEvent.click(red);

      expect(handleValueChange.mock.calls.length).toBe(1);
      expect(handleValueChange.mock.calls[0][0]).toEqual(['red']);
      expect(red).toHaveAttribute('aria-checked', 'false');
      expect(green).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('should set the initial value', () => {
      function App() {
        return (
          <CheckboxGroup defaultValue={['red']}>
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'false');
      expect(blue).toHaveAttribute('aria-checked', 'false');

      fireEvent.click(green);

      expect(red).toHaveAttribute('aria-checked', 'true');
      expect(green).toHaveAttribute('aria-checked', 'true');
      expect(blue).toHaveAttribute('aria-checked', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('disables all checkboxes when `true`', () => {
      function App() {
        return (
          <CheckboxGroup disabled>
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not disable all checkboxes when `false`', () => {
      function App() {
        return (
          <CheckboxGroup disabled={false}>
            <Checkbox.Root name="red" data-testid="red" />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).not.toHaveAttribute('aria-disabled', 'true');
      expect(green).not.toHaveAttribute('aria-disabled', 'true');
      expect(blue).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('takes precedence over individual checkboxes', () => {
      function App() {
        return (
          <CheckboxGroup disabled>
            <Checkbox.Root name="red" data-testid="red" disabled={false} />
            <Checkbox.Root name="green" data-testid="green" />
            <Checkbox.Root name="blue" data-testid="blue" />
          </CheckboxGroup>
        );
      }

      render(<App />);

      const red = screen.getByTestId('red');
      const green = screen.getByTestId('green');
      const blue = screen.getByTestId('blue');

      expect(red).toHaveAttribute('aria-disabled', 'true');
      expect(green).toHaveAttribute('aria-disabled', 'true');
      expect(blue).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Field', () => {
    it('keeps a required error while another required checkbox in the group is unchecked', async () => {
      const { user } = render(
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="checkbox" required />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="checkbox" required />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking only one of the two required checkboxes must not clear the error.
      await user.click(checkboxes[1]);
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(checkboxes[0]);
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('ignores a disabled required checkbox when validating the group', async () => {
      const { user } = render(
        <Form onSubmit={(event) => event.preventDefault()}>
          <Field.Root name="protocols">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-enabled" required />
              </Field.Item>
              {/* Mounted last so it would otherwise win the shared input ref. */}
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-disabled" required disabled />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // A disabled checkbox is exempt from constraint validation, so checking the only
      // enabled required checkbox is enough to satisfy the field.
      await user.click(screen.getByTestId('cb-enabled'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('keeps validating the remaining required checkbox after a checked sibling unmounts', async () => {
      function App() {
        const [showHttps, setShowHttps] = React.useState(true);
        return (
          <Form onSubmit={(event) => event.preventDefault()}>
            <Field.Root name="protocols">
              <CheckboxGroup defaultValue={[]}>
                <Field.Item>
                  <Checkbox.Root value="http" data-testid="checkbox-http" required />
                </Field.Item>
                {showHttps && (
                  <Field.Item>
                    <Checkbox.Root value="https" data-testid="checkbox-https" required />
                  </Field.Item>
                )}
              </CheckboxGroup>
              <Field.Error match="valueMissing" data-testid="error">
                required
              </Field.Error>
            </Field.Root>
            <button type="button" onClick={() => setShowHttps(false)}>
              remove
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      const { user } = render(<App />);

      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Check `https` (the last-mounted input that wins the shared ref), then unmount it. The shared
      // ref is now nulled, so only the registry can keep validating the still-unchecked `http`.
      await user.click(screen.getByTestId('checkbox-https'));
      await user.click(screen.getByText('remove'));
      await user.click(screen.getByText('submit'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      // Checking the remaining required checkbox satisfies the field.
      await user.click(screen.getByTestId('checkbox-http'));
      await user.click(screen.getByText('submit'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onChange keeps the error until every required checkbox is ticked', async () => {
      const { user } = render(
        <Field.Root name="protocols" validationMode="onChange">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );

      expect(screen.queryByTestId('error')).toBe(null);

      // Ticking the second (last-mounted) checkbox must not clear the requirement on the first.
      await user.click(screen.getByTestId('cb-https'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('validationMode=onBlur keeps the error until every required checkbox is ticked', async () => {
      const { user } = render(
        <Field.Root name="protocols" validationMode="onBlur">
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" required />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" required />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error match="valueMissing" data-testid="error">
            required
          </Field.Error>
        </Field.Root>,
      );

      await user.click(screen.getByTestId('cb-https'));
      expect(screen.queryByTestId('error')).toBe(null);

      fireEvent.blur(screen.getByTestId('cb-https'));
      expect(screen.getByTestId('error')).toHaveTextContent('required');

      await user.click(screen.getByTestId('cb-http'));
      expect(screen.queryByTestId('error')).toBe(null);
    });

    it('does not leave a stale custom error when toggling checkboxes in a group', async () => {
      const validateSpy = vi.fn((value) => ((value as string[]).length < 2 ? 'pick two' : null));
      render(
        <Field.Root name="protocols" validationMode="onChange" validate={validateSpy}>
          <CheckboxGroup defaultValue={[]}>
            <Field.Item>
              <Checkbox.Root value="http" data-testid="cb-http" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="https" data-testid="cb-https" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const http = screen.getByTestId('cb-http');
      const https = screen.getByTestId('cb-https');

      fireEvent.click(http);
      expect(http).toHaveAttribute('aria-invalid', 'true');

      // Selecting both clears the field-level error; no stale custom validation result should keep
      // the group invalid.
      fireEvent.click(https);
      expect(http).not.toHaveAttribute('aria-invalid');
      expect(https).not.toHaveAttribute('aria-invalid');

      // Unticking one brings the real error back (not a phantom from a prior commit).
      fireEvent.click(http);
      expect(https).toHaveAttribute('aria-invalid', 'true');
    });

    it('clears custom validity from disabled registered inputs when the group becomes valid', async () => {
      function App() {
        const [disabled, setDisabled] = React.useState(false);
        const [value, setValue] = React.useState<string[]>([]);
        const validate = (nextValue: unknown) =>
          (nextValue as string[]).length < 2 ? 'pick two' : null;

        return (
          <Field.Root name="protocols" validationMode="onChange" validate={validate}>
            <CheckboxGroup value={value} onValueChange={setValue}>
              <Field.Item>
                <Checkbox.Root value="http" data-testid="cb-http" disabled={disabled} />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="https" data-testid="cb-https" />
              </Field.Item>
            </CheckboxGroup>
            <button type="button" onClick={() => setDisabled(true)}>
              disable
            </button>
          </Field.Root>
        );
      }

      const { user } = render(<App />);

      await user.click(screen.getByTestId('cb-http'));

      const httpInput = document.querySelector<HTMLInputElement>(
        'input[type="checkbox"][value="http"]',
      );
      expect(httpInput?.validity.customError).toBe(true);

      await user.click(screen.getByText('disable'));
      await user.click(screen.getByTestId('cb-https'));

      expect(httpInput?.validity.customError).toBe(false);
    });

    it('prop: validationMode=onSubmit', async () => {
      const validateSpy = vi.fn((value) => {
        const v = value as string[];
        if (v.length === 0) {
          return 'custom error 1';
        }
        if (v.length < 2) {
          return 'custom error 2';
        }
        if (v.includes('two')) {
          return 'custom error 3';
        }
        return null;
      });
      const { user } = render(
        <Form>
          <Field.Root validate={validateSpy} name="test">
            <CheckboxGroup defaultValue={[]}>
              <Field.Item>
                <Checkbox.Root value="one" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" data-testid="checkbox" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="three" data-testid="checkbox" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      await user.click(screen.getByText('submit'));
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));

      await user.click(checkbox1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid'));
      await user.click(checkbox2);
      await user.click(checkbox3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one', 'three']);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
    });

    it('prop: validationMode=onChange', async () => {
      const validateSpy = vi.fn((value) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(
        <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, checkbox2, checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      fireEvent.click(checkbox2);
      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two']);

      fireEvent.click(checkbox1);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['two', 'one']);

      fireEvent.click(checkbox3);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('validates with the group value when toggling the parent checkbox', async () => {
      const validateSpy = vi.fn((_value: unknown) => null);

      const { user } = render(
        <Field.Root validationMode="onChange" validate={validateSpy} name="fruits">
          <CheckboxGroup allValues={['apple', 'orange']}>
            <Checkbox.Root parent data-testid="parent" />
            <Checkbox.Root value="apple" />
            <Checkbox.Root value="orange" />
          </CheckboxGroup>
        </Field.Root>,
      );

      const parent = screen.getByTestId('parent');

      await user.click(parent);
      expect(validateSpy).toHaveBeenCalledTimes(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['apple', 'orange']);

      await user.click(parent);
      expect(validateSpy).toHaveBeenCalledTimes(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);
    });

    it('revalidates when the controlled value changes externally', async () => {
      const validateSpy = vi.fn((value: unknown) => {
        const values = value as string[];
        return values.includes('one') ? 'error' : null;
      });

      function App() {
        const [selected, setSelected] = React.useState<string[]>([]);

        return (
          <React.Fragment>
            <Field.Root validationMode="onChange" validate={validateSpy} name="apple">
              <CheckboxGroup value={selected}>
                <Field.Item>
                  <Checkbox.Root value="one" data-testid="checkbox" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" data-testid="checkbox" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setSelected(['one'])}>
              Select externally
            </button>
          </React.Fragment>
        );
      }

      render(<App />);

      const checkboxes = screen.getAllByTestId('checkbox');
      const toggle = screen.getByText('Select externally');

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));
      const initialCallCount = validateSpy.mock.calls.length;

      fireEvent.click(toggle);

      expect(validateSpy.mock.calls.length).toBe(initialCallCount + 1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['one']);
      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });

    it('prop: validationMode=onBlur', async () => {
      const validateSpy = vi.fn((value) => {
        const v = value as string[];
        return v.includes('one') ? 'error' : null;
      });
      render(
        <Field.Root validationMode="onBlur" validate={validateSpy} name="apple">
          <CheckboxGroup defaultValue={['one']}>
            <Field.Item>
              <Checkbox.Root value="one" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="two" data-testid="checkbox" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="three" data-testid="checkbox" />
            </Field.Item>
          </CheckboxGroup>
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const checkboxes = screen.getAllByTestId('checkbox');
      const [checkbox1, , checkbox3] = checkboxes;

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(0);
      fireEvent.blur(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.lastCall?.[0]).toEqual([]);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox3);
      expect(validateSpy.mock.calls.length).toBe(1);
      fireEvent.blur(checkbox3);
      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three']);

      checkboxes.forEach((checkbox) => expect(checkbox).not.toHaveAttribute('aria-invalid'));

      fireEvent.click(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(2);
      fireEvent.blur(checkbox1);
      expect(validateSpy.mock.calls.length).toBe(3);
      expect(validateSpy.mock.lastCall?.[0]).toEqual(['three', 'one']);

      checkboxes.forEach((checkbox) => expect(checkbox).toHaveAttribute('aria-invalid', 'true'));
    });
  });

  describe('Field.Label', () => {
    it('implicit association', async () => {
      const changeSpy = vi.fn();
      render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="fuji-apple" />
                Fuji
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="gala-apple" />
                Gala
              </Field.Label>
            </Field.Item>
            <Field.Item>
              <Field.Label data-testid="label">
                <Checkbox.Root value="granny-smith-apple" onCheckedChange={changeSpy} />
                Granny Smith
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
      });

      fireEvent.click(labels[2]);
      expect(changeSpy.mock.calls.length).toBe(1);
    });

    it('explicit association', async () => {
      const changeSpy = vi.fn();

      await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
            <Field.Item>
              <Checkbox.Root value="fuji-apple" />
              <Field.Label data-testid="label">Fuji</Field.Label>
              <Field.Description data-testid="description">
                A fuji apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" onCheckedChange={changeSpy} />
              <Field.Label data-testid="label">Gala</Field.Label>
              <Field.Description data-testid="description">
                A gala apple is the round, edible fruit of an apple tree
              </Field.Description>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const checkboxes = screen.getAllByRole('checkbox');
      const labels = screen.getAllByTestId('label');
      const descriptions = screen.getAllByTestId('description');
      const inputs = document.querySelectorAll('input[type="checkbox"]');

      checkboxes.forEach((checkbox, index) => {
        const label = labels[index];
        const description = descriptions[index];
        const input = inputs[index];

        expect(label.getAttribute('for')).not.toBe(null);
        expect(label.getAttribute('for')).toBe(input.getAttribute('id'));
        expect(label.getAttribute('id')).not.toBe(null);
        expect(label.getAttribute('id')).toBe(checkbox.getAttribute('aria-labelledby'));
        expect(description.getAttribute('id')).not.toBe(null);
        expect(description.getAttribute('id')).toBe(checkbox.getAttribute('aria-describedby'));
      });

      fireEvent.click(screen.getByText('Gala'));
      expect(changeSpy.mock.calls.length).toBe(1);
    });
  });

  describe('Field.Description', () => {
    it('links the group and individual checkboxes', async () => {
      await render(
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} aria-describedby="external-description">
            <Field.Description data-testid="group-description">Group description</Field.Description>
            <Field.Item>
              <Field.Label>
                <Checkbox.Root value="fuji-apple" aria-describedby="checkbox-description" />
                Fuji
              </Field.Label>
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>,
      );

      const groupDescription = screen.getByTestId('group-description');
      const groupDescriptionId = groupDescription.getAttribute('id');
      expect(groupDescriptionId).not.toBe(null);
      expect(screen.getByRole('group').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toContain(
        groupDescriptionId,
      );
      expect(screen.getByRole('checkbox')).toHaveAttribute(
        'aria-describedby',
        `checkbox-description ${groupDescriptionId}`,
      );
      expect(screen.getByRole('group')).toHaveAttribute(
        'aria-describedby',
        `external-description ${groupDescriptionId}`,
      );
    });
  });

  describe.skipIf(isJSDOM)('Form', () => {
    it('includes the checkbox group value in form submission', async () => {
      render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            expect(formData.getAll('apple')).toEqual(['fuji-apple', 'gala-apple']);
          }}
        >
          <Field.Root name="apple">
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByRole('button');
      fireEvent.click(submit);
    });

    it('is validated as a group upon form submission', async () => {
      const validateSpy = vi.fn();

      render(
        <Form
          onSubmit={(event) => {
            event.preventDefault();
          }}
        >
          <Field.Root name="apple" validate={validateSpy}>
            <CheckboxGroup defaultValue={['fuji-apple', 'gala-apple']}>
              <Field.Item>
                <Checkbox.Root value="fuji-apple" data-testid="button-1" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="gala-apple" data-testid="button-2" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="granny-smith-apple" data-testid="button-3" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );

      const submit = screen.getByRole('button');
      fireEvent.click(submit);
      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][0]).toEqual(['fuji-apple', 'gala-apple']);
    });

    it('focuses the first checkbox when the field receives an error from Form', async () => {
      function App() {
        const [errors, setErrors] = React.useState<Form.Props['errors']>({});
        return (
          <Form
            errors={errors}
            onSubmit={(event) => {
              event.preventDefault();
              setErrors({ group: 'server error' });
            }}
          >
            <Field.Root name="group" data-testid="field">
              <CheckboxGroup defaultValue={['one']}>
                <Field.Item>
                  <Checkbox.Root value="one" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="two" />
                </Field.Item>
              </CheckboxGroup>
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      const { user } = render(<App />);
      expect(screen.queryByTestId('error')).toBe(null);
      const submit = screen.getByText('Submit');
      await user.click(submit);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1).toHaveFocus();
      expect(checkbox1).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByTestId('error')).toHaveTextContent('server error');
    });

    it('excludes parent checkboxes from form submission', async () => {
      const allValues = ['fuji-apple', 'gala-apple', 'granny-smith-apple'];

      function App() {
        const [value, setValue] = React.useState<string[]>(['fuji-apple', 'gala-apple']);
        return (
          <Form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              expect(formData.getAll('apple')).toEqual([
                'fuji-apple',
                'gala-apple',
                'granny-smith-apple',
              ]);
            }}
          >
            <Field.Root name="apple">
              <CheckboxGroup value={value} onValueChange={setValue} allValues={allValues}>
                <Field.Item>
                  <Checkbox.Root parent />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="fuji-apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="gala-apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="granny-smith-apple" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="submit">Submit</button>
          </Form>
        );
      }

      const { user } = render(<App />);

      const [parentCheckbox, , , checkbox3] = screen.getAllByRole('checkbox');

      expect(parentCheckbox).toHaveAttribute('aria-checked', 'mixed');

      await user.click(checkbox3);

      expect(parentCheckbox).toHaveAttribute('aria-checked', 'true');

      const submit = screen.getByText('Submit');
      fireEvent.click(submit);
    });

    it('appends the id attribute of the error to aria-describedby of individual checkboxes', async () => {
      await render(
        <Form errors={{ group: 'error' }}>
          <Field.Root name="group">
            <CheckboxGroup defaultValue={['one']}>
              <Field.Item>
                <Checkbox.Root value="one" />
                <Field.Description>Description</Field.Description>
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="two" />
              </Field.Item>
            </CheckboxGroup>
            <Field.Error data-testid="error" />
          </Field.Root>
          <button type="submit">Submit</button>
        </Form>,
      );
      const error = screen.getByTestId('error');
      expect(error).not.toBe(null);

      const [checkbox1] = screen.getAllByRole('checkbox');
      expect(checkbox1.getAttribute('aria-describedby')).toContain(error.getAttribute('id'));
      expect(checkbox1.getAttribute('aria-describedby')).toContain(
        screen.getByText('Description').getAttribute('id'),
      );
    });
  });
});
