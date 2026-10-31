import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import { VALIDATION_MODE } from '../../constants';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import isFunction from '../../utils/isFunction';
import noop from '../../utils/noop';

describe('handleSubmit', () => {
  it('should invoke the callback when validation pass', async () => {
    const { result } = renderHook(() => useForm());
    const callback = jest.fn();

    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
    expect(callback).toHaveBeenCalled();
  });

  it('should pass default value', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: string; deep: { nested: string; values: string } }>({
        mode: VALIDATION_MODE.onSubmit,
        defaultValues: {
          test: 'data',
          deep: {
            values: '5',
          },
        },
      }),
    );

    result.current.register('test');
    result.current.register('deep.nested');
    result.current.register('deep.values');

    await act(async () => {
      await result.current.handleSubmit((data: any) => {
        expect(data).toEqual({
          test: 'data',
          deep: {
            nested: undefined,
            values: '5',
          },
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should not pass default value when field is not registered', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: string; deep: { nested: string; values: string } }>({
        mode: VALIDATION_MODE.onSubmit,
        defaultValues: {
          test: 'data',
          deep: {
            values: '5',
          },
        },
      }),
    );

    await act(async () => {
      await result.current.handleSubmit((data: any) => {
        expect(data).toEqual({
          test: 'data',
          deep: {
            values: '5',
          },
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should not provide reference to _formValues as data', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: string; deep: { values: string } }>({
        mode: VALIDATION_MODE.onSubmit,
        defaultValues: {
          test: 'data',
          deep: {
            values: '5',
          },
        },
      }),
    );

    await act(async () => {
      await result.current.handleSubmit((data: any) => {
        data.deep.values = '12';
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    await act(async () => {
      await result.current.handleSubmit((data: any) => {
        expect(data.deep).toEqual({ values: '5' });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should not invoke callback when there are errors', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    result.current.register('test', { required: true });

    const callback = jest.fn();

    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('should not focus if errors is exist', async () => {
    const focus = jest.fn();
    const { result } = renderHook(() => useForm<{ test: string }>());
    const { ref } = result.current.register('test', { required: true });

    result.current.formState;

    isFunction(ref) &&
      ref({
        focus,
      });

    const callback = jest.fn();
    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(result.current.control._formState.errors?.test?.type).toBe(
      'required',
    );
  });

  it('should not focus if shouldFocusError is false', async () => {
    const mockFocus = jest.spyOn(HTMLInputElement.prototype, 'focus');

    const { result } = renderHook(() =>
      useForm<{ test: string }>({ shouldFocusError: false }),
    );

    result.current.register('test', { required: true });
    result.current.formState;

    const callback = jest.fn();
    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(callback).not.toHaveBeenCalled();
    expect(mockFocus).not.toHaveBeenCalled();
    expect(result.current.control._formState.errors?.test?.type).toBe(
      'required',
    );
  });

  it('should avoid re-focusing with native validation on submit', async () => {
    jest.useFakeTimers();

    const firstFocus = jest.fn();
    const lastFocus = jest.fn();

    const { result } = renderHook(() =>
      useForm<{ firstName: string; lastName: string }>({
        shouldUseNativeValidation: true,
        resolver: (_, __, options) => {
          for (const key of ['firstName', 'lastName'] as const) {
            const ref = options.fields[key].ref;
            ref.setCustomValidity?.('required');
            ref.reportValidity?.();
          }

          return {
            values: {},
            errors: {
              firstName: { type: 'required' },
              lastName: { type: 'required' },
            },
          };
        },
      }),
    );

    const first = result.current.register('firstName');
    const last = result.current.register('lastName');

    first.ref({
      name: 'firstName',
      focus: firstFocus,
      setCustomValidity: noop,
      reportValidity: noop,
    });
    last.ref({
      name: 'lastName',
      focus: lastFocus,
      setCustomValidity: noop,
      reportValidity: noop,
    });

    await act(async () => {
      await result.current.handleSubmit(noop)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    await act(async () => {
      jest.runOnlyPendingTimers();
    });

    expect(firstFocus).toHaveBeenCalledTimes(0);
    expect(lastFocus).not.toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('should submit form data when inputs are removed', async () => {
    const { result, unmount } = renderHook(() =>
      useForm<{
        test: string;
      }>(),
    );

    result.current.register('test');
    result.current.setValue('test', 'test');

    unmount();

    await act(async () =>
      result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: 'test',
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent),
    );
  });

  it('should invoke onSubmit callback and reset nested errors when submit with valid form values', async () => {
    const callback = jest.fn();
    const { result } = renderHook(() =>
      useForm<{
        test: { firstName: string; lastName: string }[];
      }>(),
    );
    const validate = () => {
      return !!result.current
        .getValues()
        .test.some(({ firstName }) => firstName);
    };

    result.current.register('test.0.firstName', {
      validate,
    });
    result.current.register('test.0.lastName', {
      validate,
    });
    result.current.register('test.1.firstName', {
      validate,
    });
    result.current.register('test.1.lastName', {
      validate,
    });

    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(callback).not.toHaveBeenCalled();

    result.current.setValue('test.0.firstName', 'test');

    await act(async () => {
      await result.current.handleSubmit(callback)({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(callback).toHaveBeenCalled();
  });

  it('should bubble the error up when an error occurs in the provided handleSubmit function by leaving formState flags in a consistent state', async () => {
    const errorMsg = 'this is an error';
    const App = () => {
      const [error, setError] = React.useState('');
      const {
        register,
        handleSubmit,
        formState: { isSubmitting, isSubmitted, isSubmitSuccessful },
      } = useForm();

      const rejectPromiseFn = jest.fn().mockRejectedValue(new Error(errorMsg));

      return (
        <form>
          <input {...register('test')} />
          <p>{error}</p>
          <p>isSubmitting : {isSubmitting ? 'true' : 'false'}</p>
          <p>isSubmitted : {isSubmitted ? 'true' : 'false'}</p>
          <p>isSubmitSuccessful : {isSubmitSuccessful ? 'true' : 'false'}</p>
          <button
            type={'button'}
            onClick={() =>
              handleSubmit(rejectPromiseFn)().catch((err) =>
                setError(err.message),
              )
            }
          >
            Submit
          </button>
        </form>
      );
    };

    render(<App />);
    expect(await screen.findByText('isSubmitting : false')).toBeVisible();
    expect(await screen.findByText('isSubmitted : false')).toBeVisible();
    expect(await screen.findByText('isSubmitSuccessful : false')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(errorMsg)).toBeVisible();
    expect(await screen.findByText('isSubmitting : false')).toBeVisible();
    expect(await screen.findByText('isSubmitted : true')).toBeVisible();
    expect(await screen.findByText('isSubmitSuccessful : false')).toBeVisible();
  });

  describe('with validationSchema', () => {
    it('should invoke callback when error not found', async () => {
      const resolver = async (data: any) => {
        return {
          values: data,
          errors: {},
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test: string }>({
          mode: VALIDATION_MODE.onSubmit,
          resolver,
        }),
      );

      result.current.register('test', { required: true });

      const callback = jest.fn();

      await act(async () => {
        await result.current.handleSubmit(callback)({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });
      expect(callback).toHaveBeenCalled();
    });

    it('should invoke callback with transformed values', async () => {
      const resolver = async () => {
        return {
          values: { test: 'test' },
          errors: {},
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test: string }>({
          mode: VALIDATION_MODE.onSubmit,
          resolver,
        }),
      );

      result.current.register('test', { required: true });

      const callback = jest.fn();

      await act(async () => {
        await result.current.handleSubmit(callback)({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });
      expect(callback.mock.calls[0][0]).toEqual({ test: 'test' });
    });
  });

  describe('with onInvalid callback', () => {
    it('should invoke the onValid callback when validation pass', async () => {
      const { result } = renderHook(() => useForm());
      const onValidCallback = jest.fn();
      const onInvalidCallback = jest.fn();

      await act(async () => {
        await result.current.handleSubmit(
          onValidCallback,
          onInvalidCallback,
        )({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });
      expect(onValidCallback).toHaveBeenCalledTimes(1);
      expect(onInvalidCallback).not.toHaveBeenCalledTimes(1);
    });

    it('should invoke the onInvalid callback when validation failed', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );
      result.current.register('test', { required: true });
      const onValidCallback = jest.fn();
      const onInvalidCallback = jest.fn();

      await act(async () => {
        await result.current.handleSubmit(
          onValidCallback,
          onInvalidCallback,
        )({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });

      expect(onValidCallback).not.toHaveBeenCalledTimes(1);
      expect(onInvalidCallback).toHaveBeenCalledTimes(1);
    });
  });

  it('should not provide internal errors reference to onInvalid callback', async () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string;
      }>(),
    );
    result.current.register('test', { required: true });

    await act(async () => {
      await result.current.handleSubmit(noop, (errors) => {
        Object.freeze(errors);
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    await act(async () => {
      expect(() =>
        result.current.setError('test', { message: 'Not enough', type: 'min' }),
      ).not.toThrow();
    });
  });

  it('should be able to submit correctly when errors contains empty array object', async () => {
    const onSubmit = jest.fn();

    const App = () => {
      const { register, control, handleSubmit } = useForm({
        defaultValues: {
          test: [{ name: '1234' }],
        },
        mode: 'onChange',
      });
      const { fields, remove } = useFieldArray({ control, name: 'test' });

      return (
        <form
          onSubmit={handleSubmit(() => {
            onSubmit();
          })}
        >
          {fields.map((field, index) => {
            return (
              <input
                key={field.id}
                {...register(`test.${index}.name`, { required: true })}
              />
            );
          })}

          <button type={'button'} onClick={() => remove(0)}>
            remove
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('should be able to submit correctly when errors contains empty array object and errors state is subscribed', async () => {
    const onSubmit = jest.fn();

    const App = () => {
      const {
        register,
        control,
        handleSubmit,
        formState: { errors },
      } = useForm({
        defaultValues: {
          test: [{ name: '1234' }],
        },
        mode: 'onChange',
      });
      const { fields, remove } = useFieldArray({ control, name: 'test' });

      return (
        <>
          <p>Number of errors: {Object.keys(errors).length}</p>
          <form
            onSubmit={handleSubmit(() => {
              onSubmit();
            })}
          >
            {fields.map((field, index) => {
              return (
                <input
                  key={field.id}
                  {...register(`test.${index}.name`, { required: true })}
                />
              );
            })}

            <button type={'button'} onClick={() => remove(0)}>
              remove
            </button>
            <button>submit</button>
          </form>
        </>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '',
      },
    });

    expect(await screen.findByText('Number of errors: 1')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
  });
});
