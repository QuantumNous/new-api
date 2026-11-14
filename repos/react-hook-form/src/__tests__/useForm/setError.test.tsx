import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import type {
  DeepMap,
  ErrorOption,
  FieldError,
  GlobalError,
} from '../../types';
import { useForm } from '../../useForm';
import { FormProvider, useFormContext } from '../../useFormContext';

describe('setError', () => {
  const tests: [string, ErrorOption, DeepMap<any, FieldError>][] = [
    [
      'should only set an error when it is not existed',
      { type: 'test' },
      {
        input: {
          type: 'test',
          message: undefined,
          ref: undefined,
        },
      },
    ],
    [
      'should set error message',
      { type: 'test', message: 'test' },
      {
        input: {
          type: 'test',
          message: 'test',
          ref: undefined,
          types: undefined,
        },
      },
    ],
    [
      'should set multiple error type',
      {
        types: { test1: 'test1', test2: 'test2' },
      },
      {
        input: {
          types: {
            test1: 'test1',
            test2: 'test2',
          },
          ref: undefined,
        },
      },
    ],
  ];

  it.each(tests)('%s', (_, input, output) => {
    const { result } = renderHook(() => useForm<{ input: string }>());

    result.current.formState.errors;

    act(() => {
      result.current.setError('input', input);
    });
    expect(result.current.formState.errors).toEqual(output);
    expect(result.current.formState.isValid).toBeFalsy();
  });

  it('should update isValid with setError', async () => {
    const App = () => {
      const {
        formState: { isValid },
        setError,
      } = useForm({
        mode: 'onChange',
      });

      return (
        <div>
          <button
            type={'button'}
            onClick={() => {
              setError('test', { type: 'test' });
            }}
          >
            setError
          </button>
          {isValid ? 'yes' : 'no'}
        </div>
      );
    };

    render(<App />);

    expect(await screen.findByText('yes')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('no')).toBeVisible();
  });

  it('should allow setting global error', async () => {
    const onSubmit = jest.fn();

    type Errors = {
      root: {
        customError: GlobalError;
        serverError: GlobalError;
      };
    };

    type FormValues = {
      test: string;
    };

    const App = () => {
      const {
        formState: { errors },
        handleSubmit,
        setError,
      } = useForm<FormValues & Errors>({
        mode: 'onChange',
      });

      return (
        <form
          onSubmit={handleSubmit(() => {
            onSubmit();
            setError('root.serverError', {
              type: '404',
              message: 'not found',
            });
          })}
        >
          <button
            type={'button'}
            onClick={() => {
              setError('root.customError', {
                type: 'custom',
                message: 'custom error',
              });
            }}
          >
            setError
          </button>

          <p>{errors?.root?.customError?.message}</p>
          <p>{errors?.root?.serverError?.message}</p>

          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'setError' }));

    await waitFor(() => {
      screen.findByText('custom error');
    });

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
      expect(screen.queryByText('custom error')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      screen.findByText('not found');
    });
  });

  it('should allow sequential calls to set with child after ancestor', async () => {
    const { result } = renderHook(() =>
      useForm<{ input: { first: string; last: string } }>(),
    );
    result.current.formState.errors;

    act(() => {
      result.current.setError('input', {
        type: 'test',
        message: 'Some error that depends on both fields',
      });
    });

    expect(result.current.formState.errors).toEqual({
      input: {
        type: 'test',
        message: 'Some error that depends on both fields',
        ref: undefined,
      },
    });

    act(() => {
      result.current.setError('input.first', {
        type: 'test',
        message: 'Name must be capitalized',
      });
    });

    expect(result.current.formState.errors).toEqual({
      input: {
        type: 'test',
        message: 'Some error that depends on both fields',
        ref: undefined,
        first: {
          type: 'test',
          message: 'Name must be capitalized',
          ref: undefined,
        },
      },
    });
  });

  it('should allow sequential calls to set with ancestor after child', async () => {
    const { result } = renderHook(() =>
      useForm<{ input: { first: string; last: string } }>(),
    );

    result.current.formState.errors;

    act(() => {
      result.current.setError('input.first', {
        type: 'test',
        message: 'Name must be capitalized',
      });
    });

    expect(result.current.formState.errors).toEqual({
      input: {
        first: {
          type: 'test',
          message: 'Name must be capitalized',
          ref: undefined,
        },
      },
    });

    act(() => {
      result.current.setError('input', {
        type: 'test',
        message: 'Some error that depends on both fields',
      });
    });

    expect(result.current.formState.errors).toEqual({
      input: {
        type: 'test',
        message: 'Some error that depends on both fields',
        ref: undefined,
        first: {
          type: 'test',
          message: 'Name must be capitalized',
          ref: undefined,
        },
      },
    });
  });
});

it('should update error state in FormProvider when setError is called in useEffect', async () => {
  type FormValues = {
    firstname: string;
    lastname: string;
  };

  const MyForm = () => {
    const {
      register,
      setError,
      formState: { errors },
    } = useFormContext<FormValues>();

    React.useEffect(() => {
      setError('firstname', { type: 'manual', message: 'This is an error' });
    }, [setError]);

    return (
      <form>
        <div>
          <input {...register('firstname')} placeholder="firstname" />
          {errors.firstname && <p>{errors.firstname.message}</p>}
        </div>
        <div>
          <input {...register('lastname')} placeholder="lastname" />
        </div>
      </form>
    );
  };

  const App = () => {
    const methods = useForm<FormValues>();
    return (
      <FormProvider {...methods}>
        <MyForm />
      </FormProvider>
    );
  };

  render(<App />);

  await waitFor(() => {
    expect(screen.getByText('This is an error')).toBeInTheDocument();
  });
});
