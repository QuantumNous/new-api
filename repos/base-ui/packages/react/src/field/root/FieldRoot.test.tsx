import { vi, expect } from 'vitest';
import * as React from 'react';
import { Form } from '@base-ui/react/form';
import { NumberField } from '@base-ui/react/number-field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Select } from '@base-ui/react/select';
import { Checkbox } from '@base-ui/react/checkbox';
import { CheckboxGroup } from '@base-ui/react/checkbox-group';
import { Switch } from '@base-ui/react/switch';
import { Slider } from '@base-ui/react/slider';
import { Field } from '@base-ui/react/field';
import {
  act,
  fireEvent,
  flushMicrotasks,
  reactMajor,
  screen,
  waitFor,
} from '@mui/internal-test-utils';
import { createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { LabelableProvider } from '../../internals/labelable-provider';

describe('<Field.Root />', () => {
  const { render, renderToString } = createRenderer();
  const { render: renderStrict } = createRenderer({ strict: true });

  describeConformance(<Field.Root />, () => ({
    refInstanceof: window.HTMLDivElement,
    render,
  }));

  it('updates label association when replacing one control with another', async () => {
    function TestCase() {
      const [showB, setShowB] = React.useState(false);

      return (
        <React.Fragment>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            {showB ? (
              <Field.Control key="b" id="control-b" />
            ) : (
              <Field.Control key="a" id="control-a" />
            )}
          </Field.Root>
          <button type="button" onClick={() => setShowB(true)}>
            Toggle
          </button>
        </React.Fragment>
      );
    }

    await render(<TestCase />);

    const label = screen.getByText('Label');
    expect(label).toHaveAttribute('for', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    await waitFor(() => {
      expect(label).toHaveAttribute('for', 'control-b');
    });
  });

  it('preserves null initial control ids', async () => {
    await render(
      <Field.Root>
        <LabelableProvider controlId={null}>
          <Field.Label>Label</Field.Label>
          <Field.Control data-testid="control" />
        </LabelableProvider>
      </Field.Root>,
    );

    const label = screen.getByText('Label');
    const control = screen.getByTestId('control');

    expect(label).not.toHaveAttribute('for');
    expect(control.getAttribute('id')).not.toBe(null);
  });

  it('updates label associations when the control id changes', async () => {
    function TestCase() {
      const [controlId, setControlId] = React.useState('control-a');

      return (
        <React.Fragment>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId} />
          </Field.Root>
          <button type="button" onClick={() => setControlId('control-b')}>
            Change
          </button>
        </React.Fragment>
      );
    }

    await render(<TestCase />);

    const label = screen.getByText('Label');

    expect(label).toHaveAttribute('for', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    await waitFor(() => {
      expect(label).toHaveAttribute('for', 'control-b');
    });
  });

  it('falls back to a generated id when the control id is removed', async () => {
    function TestCase() {
      const [controlId, setControlId] = React.useState<string | undefined>('control-a');

      return (
        <React.Fragment>
          <Field.Root>
            <Field.Label>Label</Field.Label>
            <Field.Control id={controlId} />
          </Field.Root>
          <button type="button" onClick={() => setControlId(undefined)}>
            Clear
          </button>
        </React.Fragment>
      );
    }

    await render(<TestCase />);

    const label = screen.getByText('Label');
    const control = screen.getByRole('textbox');

    expect(label).toHaveAttribute('for', 'control-a');
    expect(control).toHaveAttribute('id', 'control-a');

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      const updatedControl = screen.getByRole('textbox');
      const updatedId = updatedControl.getAttribute('id') ?? '';

      expect(updatedId).not.toBe('');
      expect(updatedId).not.toBe('control-a');
      expect(label).toHaveAttribute('for', updatedId);
    });
  });

  it.skipIf(isJSDOM)('does not set `aria-labelledby` during SSR when Field.Label is absent', () => {
    renderToString(
      <Field.Root>
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value placeholder="Pick one" />
          </Select.Trigger>
        </Select.Root>
      </Field.Root>,
    );

    expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
  });

  it.skipIf(isJSDOM)(
    'keeps `aria-labelledby` valid when toggling from Checkbox.Root to Select.Root after hydration',
    async () => {
      function TestCase() {
        const [showSelect, setShowSelect] = React.useState(false);

        return (
          <React.Fragment>
            <Field.Root>
              <Field.Label nativeLabel={false} render={<div />} data-testid="label">
                Label
              </Field.Label>
              {showSelect ? (
                <Select.Root>
                  <Select.Trigger data-testid="trigger">
                    <Select.Value placeholder="Pick one" />
                  </Select.Trigger>
                </Select.Root>
              ) : (
                <Checkbox.Root data-testid="checkbox" />
              )}
            </Field.Root>
            <button type="button" onClick={() => setShowSelect((prev) => !prev)}>
              Toggle
            </button>
          </React.Fragment>
        );
      }

      const { hydrate } = renderToString(<TestCase />);
      const label = screen.getByTestId('label');
      const checkbox = screen.getByTestId('checkbox');

      expect(label.id).not.toBe('');
      expect(checkbox).not.toHaveAttribute('aria-labelledby');

      hydrate();
      await waitFor(() => {
        expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-labelledby', label.id);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-labelledby', label.id);

      fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

      const checkboxAfterToggle = screen.getByTestId('checkbox');
      expect(checkboxAfterToggle).toHaveAttribute('aria-labelledby', label.id);
    },
  );

  it.skipIf(isJSDOM)(
    'removes `aria-labelledby` when Field.Label is removed after hydration',
    async () => {
      function TestCase() {
        const [showLabel, setShowLabel] = React.useState(true);

        return (
          <React.Fragment>
            <Field.Root>
              {showLabel ? (
                <Field.Label nativeLabel={false} render={<div />} data-testid="label">
                  Label
                </Field.Label>
              ) : null}
              <Select.Root>
                <Select.Trigger data-testid="trigger">
                  <Select.Value placeholder="Pick one" />
                </Select.Trigger>
              </Select.Root>
            </Field.Root>
            <button type="button" onClick={() => setShowLabel(false)}>
              Remove Label
            </button>
          </React.Fragment>
        );
      }

      const { hydrate } = renderToString(<TestCase />);
      const label = screen.getByTestId('label');
      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveAttribute('aria-labelledby');

      hydrate();
      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', label.id);
      });
      fireEvent.click(screen.getByRole('button', { name: 'Remove Label' }));

      expect(screen.queryByTestId('label')).toBe(null);
      expect(screen.getByTestId('trigger')).not.toHaveAttribute('aria-labelledby');
    },
  );

  it.skipIf(reactMajor < 19)(
    'does not loop when a control is unmounted and remounted',
    async () => {
      const errorSpy = vi
        .spyOn(console, 'error')
        .mockName('console.error')
        .mockImplementation(() => {});

      try {
        type ActivityProps = {
          mode: 'visible' | 'hidden';
          children: React.ReactNode;
        };

        const Activity = (React as typeof React & { Activity: React.ComponentType<ActivityProps> })
          .Activity;

        function TestCase() {
          const [showSelect, setShowSelect] = React.useState(true);

          return (
            <React.Fragment>
              <Field.Root>
                <Field.Label nativeLabel={false} render={<div />}>
                  Label
                </Field.Label>
                <Activity mode={showSelect ? 'visible' : 'hidden'}>
                  <Select.Root>
                    <Select.Trigger>
                      <Select.Value placeholder="Select a model" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner>
                        <Select.Popup>
                          <Select.Item value="model">Model</Select.Item>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </Activity>
              </Field.Root>
              <Checkbox.Root
                checked={!showSelect}
                onCheckedChange={(checked) => {
                  setShowSelect(!checked);
                }}
              />
            </React.Fragment>
          );
        }

        await renderStrict(<TestCase />);

        const checkbox = screen.getByRole('checkbox');

        fireEvent.click(checkbox);
        fireEvent.click(checkbox);

        expect(errorSpy.mock.calls.length).toBe(0);
      } finally {
        errorSpy.mockRestore();
      }
    },
  );

  describe('prop: disabled', () => {
    it('should add data-disabled style hook to all components', async () => {
      await render(
        <Field.Root data-testid="field" disabled>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="message" />
        </Field.Root>,
      );

      const field = screen.getByTestId('field');
      const control = screen.getByTestId('control');
      const label = screen.getByTestId('label');
      const message = screen.getByTestId('message');

      expect(field).toHaveAttribute('data-disabled', '');
      expect(control).toHaveAttribute('data-disabled', '');
      expect(label).toHaveAttribute('data-disabled', '');
      expect(message).toHaveAttribute('data-disabled', '');
    });
  });

  describe('prop: validate', () => {
    it('when not in <Form> the function does not run by default', async () => {
      const validateSpy = vi.fn(() => 'error');
      await render(
        <Field.Root validate={validateSpy}>
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('textbox');
      const message = screen.queryByText('error');

      expect(message).toBe(null);

      fireEvent.focus(control);
      fireEvent.change(control, { target: { value: 'abc' } });
      expect(validateSpy.mock.calls.length).toBe(0);
      expect(screen.queryByText('error')).toBe(null);

      fireEvent.blur(control);
      expect(validateSpy.mock.calls.length).toBe(0);
      expect(screen.queryByText('error')).toBe(null);
    });

    it('runs after native validations', async () => {
      await render(
        <Form>
          <Field.Root validate={(val) => (val === 'ab' ? 'custom error' : null)}>
            <Field.Control required />
            <Field.Error match="valueMissing">value missing</Field.Error>
            <Field.Error match="customError" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      expect(screen.queryByText('value missing')).toBe(null);
      expect(screen.queryByText('custom error')).toBe(null);

      const input = screen.getByRole<HTMLInputElement>('textbox');

      // submit
      fireEvent.click(screen.getByText('submit'));
      expect(screen.queryByText('value missing')).not.toBe(null);
      expect(screen.queryByText('custom error')).toBe(null);

      fireEvent.focus(input);
      // revalidate
      fireEvent.change(input, { target: { value: 'ab' } });
      expect(screen.queryByText('value missing')).toBe(null);
      expect(screen.queryByText('custom error')).not.toBe(null);

      fireEvent.change(input, { target: { value: '' } });
      expect(screen.queryByText('value missing')).not.toBe(null);
      // expect(screen.queryByText('custom error')).toBe(null);
    });

    it('should apply aria-invalid prop to control once validation finishes', async () => {
      await render(
        <Form>
          <Field.Root validate={() => 'error'}>
            <Field.Control />
            <Field.Error />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      const control = screen.getByRole('textbox');
      expect(control).not.toHaveAttribute('aria-invalid');

      fireEvent.click(screen.getByText('submit'));
      expect(control).toHaveAttribute('aria-invalid', 'true');
    });

    it('receives all form values as the 2nd argument', async () => {
      const validateSpy = vi.fn();

      await render(
        <Form>
          <Field.Root name="checkbox">
            <Checkbox.Root defaultChecked />
          </Field.Root>

          <Field.Root name="checkbox-group">
            <CheckboxGroup defaultValue={['apple', 'banana']}>
              <Field.Item>
                <Checkbox.Root value="apple" />
              </Field.Item>
              <Field.Item>
                <Checkbox.Root value="banana" />
              </Field.Item>
            </CheckboxGroup>
          </Field.Root>

          <Field.Root name="input" validate={validateSpy}>
            <Field.Control data-testid="input" type="url" defaultValue="https://base-ui.com" />
          </Field.Root>

          <Field.Root name="number-field">
            <NumberField.Root defaultValue={13}>
              <NumberField.Input />
            </NumberField.Root>
          </Field.Root>

          <Field.Root name="radio-group">
            <RadioGroup defaultValue="cats">
              <Radio.Root value="cats" />
            </RadioGroup>
          </Field.Root>

          <Field.Root name="select">
            <Select.Root defaultValue="sans">
              <Select.Trigger />
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="sans" />
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </Field.Root>

          <Field.Root name="slider">
            <Slider.Root defaultValue={12}>
              <Slider.Control />
            </Slider.Root>
          </Field.Root>

          <Field.Root name="range-slider">
            <Slider.Root defaultValue={[25, 70]}>
              <Slider.Control />
            </Slider.Root>
          </Field.Root>

          <Field.Root name="switch">
            <Switch.Root defaultChecked={false} />
          </Field.Root>

          <button type="submit">submit</button>
        </Form>,
      );

      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][1]).toEqual({
        checkbox: true,
        'checkbox-group': ['apple', 'banana'],
        input: 'https://base-ui.com',
        'number-field': 13,
        'radio-group': 'cats',
        select: 'sans',
        slider: 12,
        'range-slider': [25, 70],
        switch: false,
      });
    });

    it('unmounted fields are excluded from the validate fn', async () => {
      const validateSpy = vi.fn();
      function App() {
        const [checked, setChecked] = React.useState(true);

        return (
          <Form>
            <input type="checkbox" checked={checked} onChange={() => setChecked(!checked)} />
            {checked && (
              <Field.Root name="input1">
                <Field.Control defaultValue="one" />
              </Field.Root>
            )}
            <Field.Root name="input2" validate={validateSpy}>
              <Field.Control defaultValue="two" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>
        );
      }
      await render(<App />);

      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.mock.calls.length).toBe(1);
      expect(validateSpy.mock.calls[0][1]).toEqual({
        input1: 'one',
        input2: 'two',
      });

      fireEvent.click(screen.getByRole('checkbox'));
      fireEvent.click(screen.getByText('submit'));

      expect(validateSpy.mock.calls.length).toBe(2);
      expect(validateSpy.mock.lastCall?.[1]).toEqual({
        input2: 'two',
      });
    });

    it('submits the replacement control value when swapping field-aware controls', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [showSlider, setShowSlider] = React.useState(false);

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name="value">
              {showSlider ? (
                <Slider.Root defaultValue={12}>
                  <Slider.Control />
                </Slider.Root>
              ) : (
                <Select.Root defaultValue="sans">
                  <Select.Trigger />
                  <Select.Portal>
                    <Select.Positioner>
                      <Select.Popup>
                        <Select.Item value="sans" />
                      </Select.Popup>
                    </Select.Positioner>
                  </Select.Portal>
                </Select.Root>
              )}
            </Field.Root>
            <button type="button" onClick={() => setShowSlider(true)}>
              Toggle
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      await render(<App />);

      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ value: 'sans' });

      fireEvent.click(screen.getByText('Toggle'));
      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ value: 12 });
    });

    it('excludes registration-gated controls from onFormSubmit when their field name is removed', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = React.useState<string | undefined>('fruits');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root name={name}>
              <CheckboxGroup defaultValue={['apple']}>
                <Field.Item>
                  <Checkbox.Root value="apple" />
                </Field.Item>
                <Field.Item>
                  <Checkbox.Root value="banana" />
                </Field.Item>
              </CheckboxGroup>
            </Field.Root>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      await render(<App />);

      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(1);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ fruits: ['apple'] });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));

      expect(handleSubmit).toHaveBeenCalledTimes(2);
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });

    it('uses the Field.Control name for form submission and form validation values', async () => {
      const handleSubmit = vi.fn();
      const validate = vi.fn((_value: unknown, _formValues: Form.Values) => null);

      await render(
        <Form onFormSubmit={handleSubmit}>
          <Field.Root>
            <Field.Control name="email" defaultValue="one@example.com" />
          </Field.Root>
          <Field.Root name="confirmEmail" validate={validate}>
            <Field.Control defaultValue="one@example.com" />
          </Field.Root>
          <button type="submit">submit</button>
        </Form>,
      );

      fireEvent.click(screen.getByText('submit'));

      expect(validate.mock.lastCall?.[1]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        email: 'one@example.com',
        confirmEmail: 'one@example.com',
      });
    });

    it('updates the Field.Control name fallback when the name changes', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = React.useState<string | undefined>('email');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <Field.Control name={name} defaultValue="one@example.com" />
            </Field.Root>
            <button type="button" onClick={() => setName('alternateEmail')}>
              Change name
            </button>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      await render(<App />);

      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ email: 'one@example.com' });

      fireEvent.click(screen.getByText('Change name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({
        alternateEmail: 'one@example.com',
      });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });

    it('uses the Field.Control name fallback when the Field.Root name is removed', async () => {
      function App() {
        const [rootName, setRootName] = React.useState<string | undefined>('rootEmail');

        return (
          <Form errors={{ email: 'Email is already taken' }}>
            <Field.Root name={rootName}>
              <Field.Control name="email" />
              <Field.Error data-testid="default-error" />
            </Field.Root>
            <button type="button" onClick={() => setRootName(undefined)}>
              Clear root name
            </button>
          </Form>
        );
      }

      await render(<App />);

      expect(screen.getByRole('textbox')).not.toHaveAttribute('aria-invalid');
      expect(screen.queryByTestId('default-error')).toBe(null);

      fireEvent.click(screen.getByText('Clear root name'));

      expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('default-error')).toHaveTextContent('Email is already taken');
    });

    it('updates field-aware control name fallbacks when the name changes', async () => {
      const handleSubmit = vi.fn();

      function App() {
        const [name, setName] = React.useState<string | undefined>('quantity');

        return (
          <Form onFormSubmit={handleSubmit}>
            <Field.Root>
              <NumberField.Root name={name} defaultValue={13}>
                <NumberField.Input />
              </NumberField.Root>
            </Field.Root>
            <button type="button" onClick={() => setName('amount')}>
              Change name
            </button>
            <button type="button" onClick={() => setName(undefined)}>
              Clear name
            </button>
            <button type="submit">submit</button>
          </Form>
        );
      }

      await render(<App />);

      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ quantity: 13 });

      fireEvent.click(screen.getByText('Change name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({ amount: 13 });

      fireEvent.click(screen.getByText('Clear name'));
      fireEvent.click(screen.getByText('submit'));
      expect(handleSubmit.mock.lastCall?.[0]).toEqual({});
    });
  });

  describe('prop: validationMode', () => {
    describe('onSubmit', () => {
      it('should validate the field on submit', async () => {
        await render(
          <Form>
            <Field.Root validate={() => 'error'}>
              <Field.Control />
              <Field.Error />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const message = screen.queryByText('error');

        expect(message).toBe(null);

        fireEvent.click(screen.getByText('submit'));

        expect(screen.queryByText('error')).not.toBe(null);
      });

      it('revalidates on change', async () => {
        await render(
          <Form>
            <Field.Root>
              <Field.Control type="url" required defaultValue="" />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="submit">submit</button>
          </Form>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');

        expect(screen.queryByTestId('error')).toBe(null);

        fireEvent.click(screen.getByText('submit'));
        expect(screen.queryByTestId('error')).not.toBe(null);

        fireEvent.change(control, { target: { value: 'http://example' } });
        expect(screen.queryByTestId('error')).toBe(null);
      });
    });

    describe('onChange', () => {
      it('validates the field on change', async () => {
        await render(
          <Field.Root
            validationMode="onChange"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        fireEvent.change(control, { target: { value: 't' } });

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });
    });

    describe('onBlur', () => {
      it('validates the field on blur', async () => {
        await render(
          <Field.Root
            validationMode="onBlur"
            validate={(value) => {
              const str = value as string;
              return str.length < 3 ? 'error' : null;
            }}
          >
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        fireEvent.change(control, { target: { value: 't' } });

        expect(control).not.toHaveAttribute('data-invalid');

        fireEvent.blur(control);

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });

      it('should not mark invalid if `valueMissing` is the only error and not yet dirtied', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId('control');

        fireEvent.focus(control);
        fireEvent.blur(control);

        expect(control).not.toHaveAttribute('data-invalid');
        expect(control).not.toHaveAttribute('aria-invalid');
      });

      it('should mark invalid if `valueMissing` is the only error and dirtied', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId('control');

        fireEvent.focus(control);
        fireEvent.change(control, { target: { value: 'a' } });
        fireEvent.change(control, { target: { value: '' } });
        fireEvent.blur(control);

        expect(control).toHaveAttribute('data-invalid', '');
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });

      it('supports async validation', async () => {
        await render(
          <Field.Root validationMode="onBlur" validate={() => Promise.resolve('error')}>
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole('textbox');
        const message = screen.queryByText('error');

        expect(message).toBe(null);

        fireEvent.focus(control);
        fireEvent.blur(control);

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.queryByText('error')).not.toBe(null);
        });
      });

      it('ignores stale async validation results', async () => {
        const resolvers: Record<string, (value: string | null) => void> = {};
        const validate = vi.fn((value) => {
          return new Promise<string | null>((resolve) => {
            resolvers[value as string] = resolve;
          });
        });

        await render(
          <Field.Root validationMode="onChange" validate={validate}>
            <Field.Control />
            <Field.Error />
          </Field.Root>,
        );

        const control = screen.getByRole<HTMLInputElement>('textbox');

        fireEvent.change(control, { target: { value: 'old' } });
        fireEvent.change(control, { target: { value: 'new' } });

        await act(async () => {
          resolvers.new(null);
          await flushMicrotasks();
        });

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');

        await act(async () => {
          resolvers.old('old error');
          await flushMicrotasks();
        });

        expect(screen.queryByText('old error')).toBe(null);
        expect(control).not.toHaveAttribute('aria-invalid');
      });

      it('should apply [data-field] style hooks to field components', async () => {
        await render(
          <Field.Root validationMode="onBlur">
            <Field.Label data-testid="label">Label</Field.Label>
            <Field.Description data-testid="description">Description</Field.Description>
            <Field.Error data-testid="error" />
            <Field.Control data-testid="control" required />
          </Field.Root>,
        );

        const control = screen.getByTestId<HTMLInputElement>('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        let error = screen.queryByTestId('error');

        expect(control).not.toHaveAttribute('data-valid');
        expect(label).not.toHaveAttribute('data-valid');
        expect(description).not.toHaveAttribute('data-valid');
        expect(error).toBe(null);

        fireEvent.focus(control);
        fireEvent.change(control, { target: { value: 'a' } });
        fireEvent.change(control, { target: { value: '' } });
        fireEvent.blur(control);

        error = screen.getByTestId('error');

        expect(control).toHaveAttribute('data-invalid', '');
        expect(label).toHaveAttribute('data-invalid', '');
        expect(description).toHaveAttribute('data-invalid', '');
        expect(error).toHaveAttribute('data-invalid', '');

        act(() => {
          control.value = 'value';
          control.focus();
          control.blur();
        });

        error = screen.queryByTestId('error');

        expect(control).toHaveAttribute('data-valid', '');
        expect(label).toHaveAttribute('data-valid', '');
        expect(description).toHaveAttribute('data-valid', '');
        expect(error).toBe(null);
      });

      describe('revalidation', () => {
        it('revalidates on change for `valueMissing`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control required />
              <Field.Error />
            </Field.Root>,
          );

          const control = screen.getByRole('textbox');
          const message = screen.queryByText('error');

          expect(message).toBe(null);

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 't' } });
          fireEvent.blur(control);

          expect(control).not.toHaveAttribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).toHaveAttribute('aria-invalid');
        });

        it('handles both `required` and `typeMismatch`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required />
              <Field.Error data-testid="error" />
            </Field.Root>,
          );

          const control = screen.getByRole('textbox');
          const message = screen.queryByTestId('error');

          expect(message).toBe(null);

          fireEvent.focus(control);
          fireEvent.blur(control);

          expect(control).not.toHaveAttribute('aria-invalid');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'tt' } });
          fireEvent.blur(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'email@email.com' } });
          fireEvent.blur(control);

          expect(control).not.toHaveAttribute('aria-invalid');
        });

        it('revalidates on change when clearing a type mismatch leaves only `valueMissing`', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error match="typeMismatch" data-testid="type-error">
                Invalid email
              </Field.Error>
              <Field.Error match="valueMissing" data-testid="required-error">
                Required
              </Field.Error>
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'invalid' } });
          fireEvent.blur(control);

          expect(screen.getByTestId('type-error')).not.toBe(null);
          expect(screen.queryByTestId('required-error')).toBe(null);

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: '' } });

          expect(screen.queryByTestId('type-error')).toBe(null);
          expect(screen.getByTestId('required-error')).not.toBe(null);
        });

        it('clears valueMissing on change but defers other native errors like typeMismatch until blur when both are active', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control type="email" required data-testid="control" />
              <Field.Error data-testid="error" />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.blur(control);
          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'a' } });
          fireEvent.change(control, { target: { value: '' } });
          fireEvent.blur(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.toBe(null);

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 't' } });

          // The field becomes temporarily valid because only 'valueMissing' is checked for immediate clearing.
          // Other errors like 'typeMismatch' are deferred to the next blur/submit.
          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          fireEvent.blur(control);

          expect(control).toHaveAttribute('aria-invalid', 'true');
          expect(screen.getByTestId('error')).not.toBe(null);
          expect(screen.getByTestId('error').textContent).not.toBe('');

          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'test@example.com' } });

          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);

          fireEvent.blur(control);

          expect(control).not.toHaveAttribute('aria-invalid', 'true');
          expect(screen.queryByTestId('error')).toBe(null);
        });
      });

      describe('computed validity state', () => {
        it('should not mark field as invalid for valueMissing if not dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          fireEvent.focus(control);
          fireEvent.blur(control);

          expect(control).not.toHaveAttribute('data-invalid');
          expect(control).not.toHaveAttribute('aria-invalid');
        });

        it('should mark field as invalid for valueMissing if dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" required />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          // Mark as touched and dirtied
          fireEvent.focus(control);
          fireEvent.change(control, { target: { value: 'a' } });
          fireEvent.change(control, { target: { value: '' } });
          fireEvent.blur(control);

          // valueMissing is true, and markedDirtyRef is true, so valid should be false
          expect(control).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
        });

        it('should mark field as invalid for other errors (e.g., typeMismatch) even if not dirty', async () => {
          await render(
            <Field.Root validationMode="onBlur">
              <Field.Control data-testid="control" type="email" defaultValue="not_an_email@" />
            </Field.Root>,
          );

          const control = screen.getByTestId('control');

          // Mark as touched but not dirty
          fireEvent.focus(control);
          fireEvent.blur(control);

          // typeMismatch is true, so valid should be false regardless of dirty state
          expect(control).toHaveAttribute('data-invalid', '');
          expect(control).toHaveAttribute('aria-invalid', 'true');
        });
      });
    });
  });

  describe('prop: validateDebounceTime', () => {
    const { clock, render: renderFakeTimers } = createRenderer();

    clock.withFakeTimers();

    it('should debounce validation', async () => {
      await renderFakeTimers(
        <Field.Root
          validationDebounceTime={100}
          validationMode="onChange"
          validate={(value) => {
            const str = value as string;
            return str.length < 3 ? 'error' : null;
          }}
        >
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');
      const message = screen.queryByText('error');

      expect(message).toBe(null);

      fireEvent.change(control, { target: { value: 't' } });

      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(99);

      fireEvent.change(control, { target: { value: 'te' } });

      clock.tick(99);

      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(1);

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('should debounce validation for field-aware controls', async () => {
      const validate = vi.fn((value) => (value ? 'error' : null));

      await renderFakeTimers(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Checkbox.Root />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('checkbox');

      fireEvent.click(control);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('should debounce validation for radio groups', async () => {
      const validate = vi.fn((value) => (value === 'b' ? 'error' : null));

      await renderFakeTimers(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <RadioGroup>
            <Radio.Root value="a" data-testid="item-a" />
            <Radio.Root value="b" data-testid="item-b" />
          </RadioGroup>
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole('radiogroup');

      fireEvent.click(screen.getByTestId('item-b'));

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(99);

      expect(validate).not.toHaveBeenCalled();
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(1);

      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('b');
      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.queryByText('error')).not.toBe(null);
    });

    it('ignores async validation results superseded during debounce', async () => {
      const resolvers: Record<string, (value: string | null) => void> = {};
      const validate = vi.fn((value) => {
        return new Promise<string | null>((resolve) => {
          resolvers[value as string] = resolve;
        });
      });

      await renderFakeTimers(
        <Field.Root validationDebounceTime={100} validationMode="onChange" validate={validate}>
          <Field.Control />
          <Field.Error />
        </Field.Root>,
      );

      const control = screen.getByRole<HTMLInputElement>('textbox');

      fireEvent.change(control, { target: { value: 'old' } });
      clock.tick(100);

      expect(validate.mock.lastCall?.[0]).toBe('old');

      fireEvent.change(control, { target: { value: 'new' } });

      await act(async () => {
        resolvers.old('old error');
        await flushMicrotasks();
      });

      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');

      clock.tick(100);

      await act(async () => {
        resolvers.new(null);
        await flushMicrotasks();
      });

      expect(validate.mock.lastCall?.[0]).toBe('new');
      expect(screen.queryByText('old error')).toBe(null);
      expect(control).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('style hooks', () => {
    describe('touched', () => {
      it('should apply [data-touched] style hook to all components when touched', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');
        const error = screen.queryByTestId('error');

        expect(root).not.toHaveAttribute('data-touched');
        expect(control).not.toHaveAttribute('data-touched');
        expect(label).not.toHaveAttribute('data-touched');
        expect(description).not.toHaveAttribute('data-touched');
        expect(error).toBe(null);

        fireEvent.focus(control);
        fireEvent.blur(control);

        expect(root).toHaveAttribute('data-touched', '');
        expect(control).toHaveAttribute('data-touched', '');
        expect(label).toHaveAttribute('data-touched', '');
        expect(description).toHaveAttribute('data-touched', '');
        expect(error).toBe(null);
      });
    });

    describe('dirty', () => {
      it('should apply [data-dirty] style hook to all components when dirty', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-dirty');
        expect(control).not.toHaveAttribute('data-dirty');
        expect(label).not.toHaveAttribute('data-dirty');
        expect(description).not.toHaveAttribute('data-dirty');

        fireEvent.change(control, { target: { value: 'value' } });

        expect(root).toHaveAttribute('data-dirty', '');
        expect(control).toHaveAttribute('data-dirty', '');
        expect(label).toHaveAttribute('data-dirty', '');
        expect(description).toHaveAttribute('data-dirty', '');

        fireEvent.change(control, { target: { value: '' } });

        expect(root).not.toHaveAttribute('data-dirty');
        expect(control).not.toHaveAttribute('data-dirty');
        expect(label).not.toHaveAttribute('data-dirty');
        expect(description).not.toHaveAttribute('data-dirty');
      });
    });

    describe('filled', () => {
      it('should apply [data-filled] style hook to all components when filled', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-filled');
        expect(control).not.toHaveAttribute('data-filled');
        expect(label).not.toHaveAttribute('data-filled');
        expect(description).not.toHaveAttribute('data-filled');

        fireEvent.change(control, { target: { value: 'value' } });

        expect(root).toHaveAttribute('data-filled', '');
        expect(control).toHaveAttribute('data-filled', '');
        expect(label).toHaveAttribute('data-filled', '');
        expect(description).toHaveAttribute('data-filled', '');

        fireEvent.change(control, { target: { value: '' } });

        expect(root).not.toHaveAttribute('data-filled');
        expect(control).not.toHaveAttribute('data-filled');
        expect(label).not.toHaveAttribute('data-filled');
        expect(description).not.toHaveAttribute('data-filled');
      });

      it('changes [data-filled] when the value is changed externally', async () => {
        function App() {
          const [value, setValue] = React.useState('');
          return (
            <div>
              <Field.Root>
                <Field.Control value={value} onChange={(event) => setValue(event.target.value)} />
              </Field.Root>
              <button onClick={() => setValue('test')}>change</button>
              <button onClick={() => setValue('')}>reset</button>
            </div>
          );
        }

        const { user } = await render(<App />);

        expect(screen.getByRole('textbox')).not.toHaveAttribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'change' }));
        expect(screen.getByRole('textbox')).toHaveAttribute('data-filled', '');

        await user.click(screen.getByRole('button', { name: 'reset' }));
        expect(screen.getByRole('textbox')).not.toHaveAttribute('data-filled', '');
      });
    });

    describe('focused', () => {
      it('should apply [data-focused] style hook to all components when focused', async () => {
        await render(
          <Field.Root data-testid="root">
            <Field.Control data-testid="control" />
            <Field.Label data-testid="label" />
            <Field.Description data-testid="description" />
            <Field.Error data-testid="error" />
          </Field.Root>,
        );

        const root = screen.getByTestId('root');
        const control = screen.getByTestId('control');
        const label = screen.getByTestId('label');
        const description = screen.getByTestId('description');

        expect(root).not.toHaveAttribute('data-focused');
        expect(control).not.toHaveAttribute('data-focused');
        expect(label).not.toHaveAttribute('data-focused');
        expect(description).not.toHaveAttribute('data-focused');

        fireEvent.focus(control);

        expect(root).toHaveAttribute('data-focused', '');
        expect(control).toHaveAttribute('data-focused', '');
        expect(label).toHaveAttribute('data-focused', '');
        expect(description).toHaveAttribute('data-focused', '');

        fireEvent.blur(control);

        expect(root).not.toHaveAttribute('data-focused');
        expect(control).not.toHaveAttribute('data-focused');
        expect(label).not.toHaveAttribute('data-focused');
        expect(description).not.toHaveAttribute('data-focused');
      });
    });
  });

  describe('defaultValue behavior', () => {
    it('should not reset to defaultValue when input value is programmatically changed and then focused', async () => {
      const inputRef = React.createRef<HTMLInputElement>();

      await render(
        <Field.Root>
          <Field.Control ref={inputRef} defaultValue="foo" data-testid="input" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('foo');

      if (inputRef.current) {
        inputRef.current.value = '';
      }

      expect(input.value).toBe('');

      fireEvent.focus(input);

      expect(input.value).toBe('');
    });

    it('should not reset to defaultValue when input value is programmatically changed to non-empty value and then focused', async () => {
      const inputRef = React.createRef<HTMLInputElement>();

      await render(
        <Field.Root>
          <Field.Control ref={inputRef} defaultValue="foo" data-testid="input" />
        </Field.Root>,
      );

      const input = screen.getByTestId('input') as HTMLInputElement;

      expect(input.value).toBe('foo');

      if (inputRef.current) {
        inputRef.current.value = 'abc';
      }

      expect(input.value).toBe('abc');

      fireEvent.focus(input);

      expect(input.value).toBe('abc');
    });
  });

  describe('prop: dirty', () => {
    it('controls the dirty state', async () => {
      await render(
        <Field.Root data-testid="root" dirty>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).toHaveAttribute('data-dirty');
      });
    });

    it('uses the controlled dirty state for required validation', async () => {
      await render(
        <Field.Root dirty validationMode="onBlur">
          <Field.Control data-testid="control" required />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      const control = screen.getByTestId('control');

      fireEvent.focus(control);
      fireEvent.blur(control);

      expect(control).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('error')).not.toBe(null);
    });
  });

  describe('prop: touched', () => {
    it('controls the touched state', async () => {
      await render(
        <Field.Root data-testid="root" touched>
          <Field.Control data-testid="control" />
          <Field.Label data-testid="label" />
          <Field.Description data-testid="description" />
          <Field.Error data-testid="error" />
        </Field.Root>,
      );

      ['root', 'control', 'label', 'description'].forEach((part) => {
        expect(screen.getByTestId(part)).toHaveAttribute('data-touched');
      });
    });
  });

  describe('prop: actionsRef', () => {
    it('validates the field when the `validate` method is called', async () => {
      function App() {
        const actionsRef = React.useRef<Field.Root.Actions>(null);
        return (
          <div>
            <Field.Root name="username" actionsRef={actionsRef}>
              <Field.Control defaultValue="" required />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      const { user } = await render(<App />);

      expect(screen.queryByTestId('error')).toBe(null);

      await user.click(screen.getByText('validate'));

      expect(screen.queryByTestId('error')).not.toBe(null);
    });

    it('validates the current control value when the `validate` method is called', async () => {
      const validate = vi.fn((value) => (value === 'valid' ? null : 'error'));

      function App() {
        const actionsRef = React.useRef<Field.Root.Actions>(null);
        return (
          <div>
            <Field.Root actionsRef={actionsRef} validate={validate}>
              <Field.Control />
              <Field.Error data-testid="error" />
            </Field.Root>
            <button type="button" onClick={() => actionsRef.current?.validate()}>
              validate
            </button>
          </div>
        );
      }

      const { user } = await render(<App />);
      const control = screen.getByRole('textbox');

      fireEvent.change(control, { target: { value: 'valid' } });
      await user.click(screen.getByText('validate'));

      expect(validate.mock.lastCall?.[0]).toBe('valid');
      expect(screen.queryByTestId('error')).toBe(null);
    });
  });
});
