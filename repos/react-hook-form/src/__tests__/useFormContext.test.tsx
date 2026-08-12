import React, { useState } from 'react';
import { flushSync } from 'react-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Controller } from '../controller';
import { useController } from '../useController';
import { useFieldArray } from '../useFieldArray';
import { useForm } from '../useForm';
import { FormProvider, useFormContext } from '../useFormContext';
import { useFormState } from '../useFormState';
import { useWatch } from '../useWatch';
import deepEqual from '../utils/deepEqual';
import noop from '../utils/noop';

describe('FormProvider', () => {
  it('should have access to all methods with useFormContext', () => {
    const mockRegister = jest.fn();
    const Test = () => {
      const { register } = useFormContext();

      React.useEffect(() => {
        register('test');
      }, [register]);

      return null;
    };

    const App = () => {
      const methods = useForm();

      return (
        <FormProvider {...methods} register={mockRegister}>
          <form>
            <Test />
          </form>
        </FormProvider>
      );
    };

    render(<App />);

    expect(mockRegister).toHaveBeenCalled();
  });

  it('should work correctly with Controller, useWatch, useFormState.', async () => {
    const TestComponent = () => {
      const { field } = useController({
        name: 'test',
        defaultValue: '',
      });
      return <input {...field} />;
    };

    const TestWatch = () => {
      const value = useWatch({
        name: 'test',
      });

      return <p>Value: {value === undefined ? 'undefined value' : value}</p>;
    };

    const TestFormState = () => {
      const { isDirty } = useFormState();

      return <div>Dirty: {isDirty ? 'yes' : 'no'}</div>;
    };

    const Component = () => {
      const methods = useForm();
      return (
        <FormProvider {...methods}>
          <TestComponent />
          <TestWatch />
          <TestFormState />
        </FormProvider>
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox');

    expect(input).toBeVisible();
    expect(await screen.findByText('Value: undefined value')).toBeVisible();
    expect(screen.getByText('Dirty: no')).toBeVisible();

    fireEvent.change(input, { target: { value: 'test' } });
    expect(screen.getByText('Value: test')).toBeVisible();
    expect(screen.getByText('Dirty: yes')).toBeVisible();
  });

  it('should not throw type error', () => {
    type FormValues = {
      firstName: string;
    };

    type Context = {
      someValue: boolean;
    };

    function App() {
      const methods = useForm<FormValues, Context>();
      const { handleSubmit, register } = methods;

      return (
        <div>
          <FormProvider {...methods}>
            <form onSubmit={handleSubmit(noop)}>
              <input {...register('firstName')} placeholder="First Name" />
              <input type="submit" />
            </form>
          </FormProvider>
        </div>
      );
    }

    render(<App />);
  });

  it('should be able to access defaultValues within formState', () => {
    type FormValues = {
      firstName: string;
      lastName: string;
    };

    const defaultValues = {
      firstName: 'a',
      lastName: 'b',
    };

    const Test1 = () => {
      const methods = useFormState();

      return (
        <p>
          {deepEqual(methods.defaultValues, defaultValues)
            ? 'context-yes'
            : 'context-no'}
        </p>
      );
    };

    const Test = () => {
      const methods = useFormContext();

      return (
        <p>
          {deepEqual(methods.formState.defaultValues, defaultValues)
            ? 'yes'
            : 'no'}
        </p>
      );
    };

    const Component = () => {
      const methods = useForm<FormValues>({
        defaultValues,
      });

      return (
        <FormProvider {...methods}>
          <Test />
          <Test1 />
          <button
            onClick={() => {
              methods.reset({
                firstName: 'c',
                lastName: 'd',
              });
            }}
          >
            reset
          </button>
          <p>{JSON.stringify(defaultValues)}</p>
        </FormProvider>
      );
    };

    render(<Component />);

    expect(screen.getByText('yes')).toBeVisible();
    expect(screen.getByText('context-yes')).toBeVisible();

    screen.getByText(JSON.stringify(defaultValues));

    fireEvent.click(screen.getByRole('button'));

    waitFor(() => {
      expect(screen.getByText('yes')).not.toBeValid();
      expect(screen.getByText('context-yes')).not.toBeVisible();

      screen.getByText(
        JSON.stringify({
          firstName: 'c',
          lastName: 'd',
        }),
      );
    });
  });

  it('should report errors correctly', async () => {
    const Child = () => {
      const {
        formState: { errors },
        register,
        handleSubmit,
      } = useFormContext<{
        test: string;
      }>();

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input {...register('test', { required: 'This is required' })} />
          <p>{errors.test?.message}</p>
          <button>submit</button>
        </form>
      );
    };

    const App = () => {
      const methods = useForm();

      return (
        <FormProvider {...methods}>
          <Child />
        </FormProvider>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => screen.getByText('This is required'));
  });

  it('should report errors correctly with useFieldArray Controller', async () => {
    let arrayErrors: (string | undefined)[] = [];
    const Form = () => {
      const {
        control,
        formState: { errors },
      } = useFormContext<{
        testArray: { name: string }[];
      }>();

      const { append, fields } = useFieldArray({
        control,
        name: 'testArray',
      });

      arrayErrors = fields.map(
        (_, index) => errors?.testArray?.[index]?.name?.message,
      );
      const onSubmit = jest.fn((e) => e.preventDefault());
      const [selected, setSelected] = useState<number | undefined>();
      return (
        <form onSubmit={onSubmit}>
          <p data-testid="error-value">{JSON.stringify(errors)}</p>
          <p data-testid="error-filter-value">
            {arrayErrors.filter(Boolean).length}
          </p>
          <button onClick={() => append({ name: 'test' })}>Increment</button>
          <select
            data-testid="select"
            onChange={(e) => {
              flushSync(() => setSelected(+e.target.value));
            }}
          >
            {fields.map((field, index) => (
              <option key={field.id} value={index}></option>
            ))}
          </select>
          {selected !== undefined && (
            <Controller
              control={control}
              name={`testArray.${selected}.name`}
              shouldUnregister={false}
              rules={{ required: { value: true, message: 'required' } }}
              render={({ field }) => (
                <input data-testid="error-input" onChange={field.onChange} />
              )}
            />
          )}
        </form>
      );
    };
    const App = () => {
      const methods = useForm({
        defaultValues: { testArray: [] },
        mode: 'all',
      });

      return (
        <FormProvider {...methods}>
          <Form />
        </FormProvider>
      );
    };
    render(<App />);
    const errorValue = screen.getByTestId('error-value');
    const errorFilterValue = screen.getByTestId('error-filter-value');
    const select = screen.getByTestId('select');
    // const errorInput = screen.getByTestId('error-input');
    const button = screen.getByText('Increment');

    // Click button add Value
    fireEvent.click(button);
    fireEvent.click(button);
    // Change second value to ''
    fireEvent.change(select, { target: { value: 1 } });
    const errorInput = screen.getByTestId('error-input');
    fireEvent.change(errorInput, { target: { value: 'test' } });
    fireEvent.change(errorInput, { target: { value: '' } });
    await waitFor(() => {
      expect(errorValue).toHaveTextContent(
        '{"testArray":[null,{"name":{"type":"required","message":"required","ref":{"name":"testArray.1.name"}}}]}',
      );
      expect(errorFilterValue).toHaveTextContent('1');
    });
  });

  it('should not rerender unrelated fields when using useController', () => {
    const onRender = jest.fn();

    const RenderCounter = React.memo(() => {
      useController({
        name: 'value2',
        defaultValue: '',
      });
      onRender();
      return null;
    });

    const Form = () => {
      const [, setValues] = useState({ value1: '', value2: '' });
      const methods = useForm<{ value1: string; value2: string }>();
      const { subscribe } = methods;

      React.useEffect(() => {
        subscribe({
          formState: { values: true },
          callback: ({ values }) => {
            setValues(values);
          },
        });
      }, [subscribe]);

      return (
        <FormProvider {...methods}>
          <form>
            <input {...methods.register('value1')} data-testid="value1-input" />
            <RenderCounter />
          </form>
        </FormProvider>
      );
    };

    render(<Form />);

    const input = screen.getByTestId('value1-input');

    expect(input).toBeVisible();
    expect(onRender).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.change(input, { target: { value: '2' } });
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  /**
   * Verifies that external state changes in the parent component
   * do not cause unnecessary rerenders of children consuming useFormContext.
   * This ensures FormProvider's context value is properly memoized.
   */
  it('should not do unnecessary rerenders by useFormContext', () => {
    const onRender = jest.fn();

    const RenderCounter = React.memo(() => {
      const {
        formState: { dirtyFields },
      } = useFormContext();
      onRender();
      return <span>{JSON.stringify(dirtyFields, null, 2)}</span>;
    });

    const Form = () => {
      const [, setValues] = useState({ value1: '' });
      const methods = useForm<{ value1: string }>();
      const { subscribe } = methods;

      React.useEffect(() => {
        subscribe({
          formState: { values: true },
          callback: ({ values }) => {
            setValues(values);
          },
        });
      }, [subscribe]);

      return (
        <FormProvider {...methods}>
          <form>
            <input {...methods.register('value1')} data-testid="value1-input" />
            <button
              type="button"
              data-testid="set-values-button"
              onClick={() => setValues({ value1: 'manual' })}
            >
              Set Values
            </button>
            <RenderCounter />
          </form>
        </FormProvider>
      );
    };

    render(<Form />);

    const input = screen.getByTestId('value1-input');

    expect(input).toBeVisible();
    const rerendersCount = onRender.mock.calls.length;
    expect(onRender).toHaveBeenCalledTimes(rerendersCount);
    fireEvent.change(input, { target: { value: '1' } });
    expect(onRender).toHaveBeenCalledTimes(rerendersCount + 1);

    // after external change, we should not trigger the context recreation
    fireEvent.click(screen.getByTestId('set-values-button'));
    expect(onRender).toHaveBeenCalledTimes(rerendersCount + 1);
  });

  it('should not throw "Cannot update a component while rendering a different component" when swapping FormProviders', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const Child = () => {
      useController({ name: 'test' });
      return <input data-testid="test-input" />;
    };

    const App = () => {
      const [showA, setShowA] = React.useState(true);
      const methodsA = useForm({ defaultValues: { test: 'A' } });
      const methodsB = useForm({ defaultValues: { test: 'B' } });

      return (
        <div>
          <button onClick={() => setShowA(!showA)}>Toggle</button>
          {showA ? (
            <FormProvider {...methodsA}>
              <Child />
            </FormProvider>
          ) : (
            <FormProvider {...methodsB}>
              <Child />
            </FormProvider>
          )}
        </div>
      );
    };

    render(<App />);

    // Toggle to swap between two distinct FormProvider instances
    act(() => {
      fireEvent.click(screen.getByText('Toggle'));
    });

    // If it doesn't throw, it passes
    expect(screen.getByTestId('test-input')).toBeVisible();

    // Check if the specific warning was logged
    const wasWarningLogged = consoleSpy.mock.calls.some((call) =>
      call[0]?.includes?.('Cannot update a component'),
    );

    expect(wasWarningLogged).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should not throw "Cannot update a component while rendering a different component" when swapping FormProvider props', () => {
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const Child = () => {
      useController({ name: 'test' });
      return <input data-testid="test-input" />;
    };

    const App = () => {
      const [showA, setShowA] = React.useState(true);
      const methodsA = useForm({ defaultValues: { test: 'A' } });
      const methodsB = useForm({ defaultValues: { test: 'B' } });

      return (
        <div>
          <button onClick={() => setShowA(!showA)}>Toggle</button>
          <FormProvider {...(showA ? methodsA : methodsB)}>
            <Child />
          </FormProvider>
        </div>
      );
    };

    render(<App />);

    // Toggle to swap FormProvider props
    act(() => {
      fireEvent.click(screen.getByText('Toggle'));
    });

    // If it doesn't throw, it passes
    expect(screen.getByTestId('test-input')).toBeVisible();

    // Check if the specific warning was logged
    const wasWarningLogged = consoleSpy.mock.calls.some((call) =>
      call[0]?.includes?.('Cannot update a component'),
    );

    expect(wasWarningLogged).toBe(false);

    consoleSpy.mockRestore();
  });

  it('should expose setValues from useFormContext', async () => {
    const Child = () => {
      const { setValues, getValues } = useFormContext<{
        a: string;
        b: string;
      }>();

      return (
        <button
          data-testid="set-values"
          onClick={() => setValues({ a: 'foo', b: 'bar' })}
        >
          {getValues('a')}
        </button>
      );
    };

    const App = () => {
      const methods = useForm<{ a: string; b: string }>({
        defaultValues: { a: '', b: '' },
      });
      return (
        <FormProvider {...methods}>
          <Child />
        </FormProvider>
      );
    };

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('set-values'));
    });

    expect(screen.getByTestId('set-values').textContent).toBe('foo');
  });
});
