import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import type { Control } from '../../types';
import { useForm } from '../../useForm';
import { useFormState } from '../../useFormState';

describe('clearErrors', () => {
  it('should remove error', () => {
    const { result } = renderHook(() => useForm<{ input: string }>());
    act(() => {
      result.current.register('input');
      result.current.setError('input', {
        type: 'test',
        message: 'message',
      });
    });

    act(() => result.current.clearErrors('input'));

    expect(result.current.formState.errors).toEqual({});
  });

  it('should remove nested error', () => {
    const { result } = renderHook(() =>
      useForm<{ input: { nested: string } }>(),
    );
    result.current.formState.errors;
    act(() =>
      result.current.setError('input.nested', {
        type: 'test',
      }),
    );
    expect(result.current.formState.errors.input?.nested).toBeDefined();
    act(() => result.current.clearErrors('input.nested'));
    expect(result.current.formState.errors.input?.nested).toBeUndefined();
  });

  it('should remove deep nested error and set it to undefined', async () => {
    let currentErrors = {};

    const Component = () => {
      const {
        register,
        formState: { errors },
        trigger,
        clearErrors,
      } = useForm<{
        test: { data: string };
      }>();

      currentErrors = errors;
      return (
        <div>
          <input type="text" {...register('test.data', { required: true })} />
          <button type={'button'} onClick={() => trigger()}>
            submit
          </button>
          <button type={'button'} onClick={() => clearErrors(['test.data'])}>
            clear
          </button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(currentErrors).toEqual({
        test: {
          data: {
            message: '',
            ref: screen.getByRole('textbox'),
            type: 'required',
          },
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'clear' }));

    expect(currentErrors).toEqual({});
  });

  it('should remove specified errors', () => {
    const { result } = renderHook(() =>
      useForm<{
        input: string;
        input1: string;
        input2: string;
        nest: { data: string; data1: string };
      }>(),
    );

    result.current.formState.errors;

    const error = {
      type: 'test',
      message: 'message',
    };

    act(() => {
      result.current.register('input');
      result.current.register('input1');
      result.current.register('input2');
      result.current.setError('input', error);
      result.current.setError('input1', error);
      result.current.setError('input2', error);

      result.current.register('nest.data');
      result.current.register('nest.data1');
      result.current.setError('nest.data', error);
      result.current.setError('nest.data1', error);
    });

    const errors = {
      input: {
        ...error,
        ref: {
          name: 'input',
        },
      },
      input1: {
        ...error,
        ref: {
          name: 'input1',
        },
      },
      input2: {
        ...error,
        ref: {
          name: 'input2',
        },
      },
      nest: {
        data: {
          ...error,
          ref: {
            name: 'nest.data',
          },
        },
        data1: {
          ...error,
          ref: {
            name: 'nest.data1',
          },
        },
      },
    };
    expect(result.current.formState.errors).toEqual(errors);

    act(() => result.current.clearErrors(['input', 'input1', 'nest.data']));
    expect(result.current.formState.errors).toEqual({
      input2: errors.input2,
      nest: {
        data1: errors.nest.data1,
      },
    });
  });

  it('should remove all error', () => {
    const { result } = renderHook(() =>
      useForm<{ input: string; input1: string; input2: string }>(),
    );

    result.current.formState.errors;

    const error = {
      type: 'test',
      message: 'message',
    };
    act(() => result.current.setError('input', error));
    act(() => result.current.setError('input1', error));
    act(() => result.current.setError('input2', error));
    expect(result.current.formState.errors).toEqual({
      input: {
        ...error,
        ref: undefined,
        types: undefined,
      },
      input1: {
        ...error,
        ref: undefined,
        types: undefined,
      },
      input2: {
        ...error,
        ref: undefined,
        types: undefined,
      },
    });

    act(() => result.current.clearErrors());
    expect(result.current.formState.errors).toEqual({});
  });

  it('should prevent the submission if there is a custom error', async () => {
    const submit = jest.fn();
    const { result } = renderHook(() =>
      useForm<{ data: string; whatever: string }>(),
    );

    result.current.register('data');

    act(() => {
      result.current.setError('whatever', { type: 'server' });
    });

    await act(async () => await result.current.handleSubmit(submit)());
    expect(submit).not.toHaveBeenCalled();

    act(() => {
      result.current.clearErrors('whatever');
    });

    await act(async () => await result.current.handleSubmit(submit)());
    expect(submit).toHaveBeenCalled();
  });

  it('should update isValid to true with setError', async () => {
    const App = () => {
      const {
        formState: { isValid },
        setError,
        clearErrors,
      } = useForm({
        mode: 'onChange',
      });

      return (
        <div>
          <button
            onClick={() => {
              setError('test', { type: 'test' });
            }}
          >
            setError
          </button>

          <button
            onClick={() => {
              clearErrors();
            }}
          >
            clearError
          </button>
          {isValid ? 'yes' : 'no'}
        </div>
      );
    };

    render(<App />);

    expect(await screen.findByText('yes')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'setError' }));

    expect(await screen.findByText('no')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'clearError' }));

    expect(await screen.findByText('no')).toBeVisible();
  });

  it('should be able to clear root error', () => {
    const App = () => {
      const { clearErrors } = useForm();

      React.useEffect(() => {
        clearErrors('root');
        clearErrors('root.other');
      }, [clearErrors]);

      return null;
    };

    render(<App />);
  });

  it('should only notify subscribers for the cleared field when using exact: true', async () => {
    let renderCountA = 0;
    let renderCountB = 0;

    const FieldA = ({
      control,
    }: {
      control: Control<{ a: string; b: string }>;
    }) => {
      const { errors } = useFormState({
        control,
        name: 'a',
        exact: true,
      });
      renderCountA++;
      return <div data-testid="error-a">{errors.a?.message || ''}</div>;
    };

    const FieldB = ({
      control,
    }: {
      control: Control<{ a: string; b: string }>;
    }) => {
      const { errors } = useFormState({
        control,
        name: 'b',
        exact: true,
      });
      renderCountB++;
      return <div data-testid="error-b">{errors.b?.message || ''}</div>;
    };

    const App = () => {
      const { control, setError, clearErrors } = useForm<{
        a: string;
        b: string;
      }>();

      return (
        <div>
          <FieldA control={control} />
          <FieldB control={control} />
          <button onClick={() => setError('a', { message: 'error a' })}>
            Set Error A
          </button>
          <button onClick={() => clearErrors('a')}>Clear Error A</button>
        </div>
      );
    };

    render(<App />);

    // Initial render
    const initialRenderA = renderCountA;
    const initialRenderB = renderCountB;

    // Set error on field 'a'
    fireEvent.click(screen.getByRole('button', { name: 'Set Error A' }));

    await waitFor(() => {
      expect(screen.getByTestId('error-a')).toHaveTextContent('error a');
    });

    const afterSetErrorRenderA = renderCountA;
    const afterSetErrorRenderB = renderCountB;

    // FieldA should have re-rendered for setError('a')
    expect(afterSetErrorRenderA).toBeGreaterThan(initialRenderA);
    // FieldB should NOT have re-rendered for setError('a')
    expect(afterSetErrorRenderB).toBe(initialRenderB);

    // Clear error on field 'a'
    fireEvent.click(screen.getByRole('button', { name: 'Clear Error A' }));

    await waitFor(() => {
      expect(screen.getByTestId('error-a')).toHaveTextContent('');
    });

    const afterClearErrorRenderA = renderCountA;
    const afterClearErrorRenderB = renderCountB;

    // FieldA should have re-rendered for clearErrors('a')
    expect(afterClearErrorRenderA).toBeGreaterThan(afterSetErrorRenderA);
    // FieldB should NOT have re-rendered for clearErrors('a') - this is the bug fix!
    expect(afterClearErrorRenderB).toBe(afterSetErrorRenderB);
  });
});
