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
import type {
  Control,
  FieldErrors,
  FieldPath,
  FieldValues,
  FormState,
  Resolver,
  UseFormGetFieldState,
} from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import { FormProvider } from '../../useFormContext';
import { useFormState } from '../../useFormState';
import noop from '../../utils/noop';

describe('trigger', () => {
  it('should remove all errors before set new errors when trigger entire form', async () => {
    const Component = () => {
      const [show, setShow] = React.useState(true);
      const {
        register,
        unregister,
        trigger,
        formState: { errors },
      } = useForm<{
        test: string;
      }>();

      return (
        <div>
          {show && <input {...register('test', { required: true })} />}
          <button type={'button'} onClick={() => trigger()}>
            trigger
          </button>
          <button
            type={'button'}
            onClick={() => {
              setShow(false);
              unregister('test');
            }}
          >
            toggle
          </button>
          {errors.test && <span>error</span>}
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));

    expect(await screen.findByText('error')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));

    await waitFor(() =>
      expect(screen.queryByText('error')).not.toBeInTheDocument(),
    );
  });

  it('should return empty errors when field is found and validation pass', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());
    const { errors } = result.current.formState;

    result.current.register('test');

    await act(async () => {
      await result.current.trigger('test');
    });

    await act(async () => {
      await expect(errors).toEqual({});
    });
  });

  it('should update value when value is supplied', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    const { errors } = result.current.formState;

    result.current.register('test', { required: true });

    result.current.setValue('test', 'abc');

    await act(async () => {
      await result.current.trigger('test');
    });

    expect(errors).toEqual({});
  });

  it('should trigger multiple fields validation', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: string; test1: string }>({
        mode: VALIDATION_MODE.onChange,
      }),
    );

    result.current.formState.errors;

    result.current.register('test', { required: 'required' });
    result.current.register('test1', { required: 'required' });

    await act(async () => {
      await result.current.trigger(['test', 'test1']);
    });

    expect(result.current.formState.errors?.test?.message).toBe('required');
    expect(result.current.formState.errors?.test1?.message).toBe('required');
  });

  describe('with schema', () => {
    it('should return the error with single field validation', async () => {
      const resolver = async (data: any) => {
        return {
          values: data,
          errors: {
            test: {
              type: 'test',
            },
          },
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver,
        }),
      );

      result.current.formState.errors;

      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.trigger('test');
      });
      expect(result.current.formState.errors).toEqual({
        test: { type: 'test' },
      });
    });

    it('should return the status of the requested field with single field validation', async () => {
      const resolver = async (data: any) => {
        return {
          values: data,
          errors: {
            test2: {
              type: 'test',
            },
          },
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test1: string; test2: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver,
        }),
      );

      result.current.formState.errors;

      result.current.register('test1', { required: false });
      result.current.register('test2', { required: true });

      await act(async () =>
        expect(await result.current.trigger('test2')).toBeFalsy(),
      );

      expect(result.current.formState.errors).toEqual({
        test2: {
          type: 'test',
        },
      });
    });

    it('should not trigger any error when schema validation result not found', async () => {
      const { result } = renderHook(() =>
        useForm<{ test: string; test1: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver: async () => {
            return {
              values: {},
              errors: {
                test: {
                  type: 'test',
                },
              },
            };
          },
        }),
      );

      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.trigger('test1');
      });

      expect(result.current.formState.errors).toEqual({});
    });

    it('should support array of fields for schema validation', async () => {
      const resolver = async (data: any) => {
        return {
          values: data,
          errors: {
            test1: {
              type: 'test1',
            },
            test: {
              type: 'test',
            },
          },
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test: string; test1: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver,
        }),
      );

      result.current.formState.errors;

      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.trigger(['test', 'test1']);
      });

      expect(result.current.formState.errors).toEqual({
        test1: {
          type: 'test1',
        },
        test: {
          type: 'test',
        },
      });
    });

    it('should return the status of the requested fields with array of fields for validation', async () => {
      const { result } = renderHook(() =>
        useForm<{ test1: string; test2: string; test3: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver: async () => {
            return {
              values: {},
              errors: {
                test3: {
                  type: 'test',
                },
              },
            };
          },
        }),
      );

      const { errors } = result.current.formState;

      result.current.register('test1', { required: false });
      result.current.register('test2', { required: false });
      result.current.register('test3', { required: true });

      await act(async () => {
        await result.current.trigger(['test1', 'test2']);
      });

      await act(async () => {
        expect(errors).toEqual({});
      });

      await act(async () => {
        await result.current.trigger(['test3']);
      });

      await act(async () => {
        expect(result.current.formState.errors).toEqual({
          test3: {
            type: 'test',
          },
        });
      });
    });

    it('should validate all fields when pass with undefined', async () => {
      const resolver = async (data: any) => {
        return {
          values: data,
          errors: {
            test1: {
              type: 'test1',
            },
            test: {
              type: 'test',
            },
          },
        };
      };

      const { result } = renderHook(() =>
        useForm<{ test1: string; test: string }>({
          mode: VALIDATION_MODE.onChange,
          resolver,
        }),
      );

      result.current.formState.errors;

      result.current.register('test', { required: true });
      result.current.register('test1', { required: true });

      await act(async () => {
        await result.current.trigger();
      });

      expect(result.current.formState.errors).toEqual({
        test1: {
          type: 'test1',
        },
        test: {
          type: 'test',
        },
      });
    });

    it('should update isValid with validation result at form level', async () => {
      const App = () => {
        const {
          register,
          formState: { isValid },
          trigger,
        } = useForm<{ test: string; test1: string }>({
          defaultValues: {
            test: '',
          },
          resolver: async (data) => {
            if (data.test && data.test1) {
              return {
                errors: {},
                values: {},
              };
            } else {
              return {
                errors: {
                  test: {
                    message: 'test',
                    type: 'test',
                  },
                },
                values: {},
              };
            }
          },
        });

        return (
          <div>
            {isValid ? 'yes' : 'no'}
            <input {...register('test')} />
            <input {...register('test1')} />
            <button
              onClick={() => {
                trigger('test');
              }}
            >
              trigger1
            </button>
            <button
              onClick={() => {
                trigger('test1');
              }}
            >
              trigger2
            </button>
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getAllByRole('textbox')[0], {
        target: {
          value: 'test',
        },
      });

      fireEvent.click(screen.getByRole('button', { name: 'trigger1' }));

      expect(await screen.findByText('no')).toBeVisible();

      fireEvent.change(screen.getAllByRole('textbox')[1], {
        target: {
          value: 'test',
        },
      });

      fireEvent.click(screen.getByRole('button', { name: 'trigger2' }));

      expect(await screen.findByText('yes')).toBeVisible();
    });

    it('should update isValid for the entire useForm scope', async () => {
      const InputA = () => {
        const { isValid } = useFormState({ name: 'name' });

        return <p>{isValid ? 'test: valid' : 'test: invalid'}</p>;
      };

      const InputB = () => {
        const { isValid } = useFormState({ name: 'email' });

        return <p>{isValid ? 'test1: valid' : 'test1: invalid'}</p>;
      };

      function App() {
        const methods = useForm({
          resolver: async (data) => {
            if (data.test && data.test1) {
              return {
                errors: {},
                values: {},
              };
            } else {
              return {
                errors: {
                  test: {
                    message: 'test',
                    type: 'test',
                  },
                },
                values: {},
              };
            }
          },
          mode: 'onChange',
        });

        return (
          <FormProvider {...methods}>
            <form>
              <input
                onChange={(e) =>
                  methods.setValue('test', e.target.value, {
                    shouldValidate: true,
                  })
                }
              />
              <InputA />
              <input
                onChange={(e) =>
                  methods.setValue('test1', e.target.value, {
                    shouldValidate: true,
                  })
                }
              />
              <InputB />
            </form>
          </FormProvider>
        );
      }

      render(<App />);

      expect(await screen.findByText('test: invalid')).toBeVisible();
      expect(screen.getByText('test1: invalid')).toBeVisible();

      fireEvent.change(screen.getAllByRole('textbox')[0], {
        target: { value: 'test' },
      });

      expect(await screen.findByText('test: invalid')).toBeVisible();
      expect(screen.getByText('test1: invalid')).toBeVisible();

      fireEvent.change(screen.getAllByRole('textbox')[1], {
        target: { value: 'test' },
      });

      expect(await screen.findByText('test: valid')).toBeVisible();
      expect(screen.getByText('test1: valid')).toBeVisible();
    });
  });

  it('should return the status of the requested fields with array of fields for validation', async () => {
    const { result } = renderHook(() =>
      useForm<{ test1: string; test2: string; test3: string }>({
        mode: VALIDATION_MODE.onChange,
        resolver: async () => ({
          values: {},
          errors: {
            test3: { type: 'required', message: 'test3' },
          },
        }),
      }),
    );

    result.current.register('test1', { required: false });
    result.current.register('test2', { required: false });
    result.current.register('test3', { required: true });

    await act(async () =>
      expect(await result.current.trigger(['test1', 'test2'])).toBeTruthy(),
    );

    await act(async () =>
      expect(await result.current.trigger(['test3', 'test2'])).toBeFalsy(),
    );

    await act(async () =>
      expect(await result.current.trigger(['test3'])).toBeFalsy(),
    );

    await act(async () =>
      expect(await result.current.trigger(['test1'])).toBeTruthy(),
    );

    await act(async () => expect(await result.current.trigger()).toBeFalsy());
  });

  it('should return true when field is found and validation pass', async () => {
    const App = () => {
      const {
        register,
        trigger,
        formState: { isValid },
      } = useForm();

      React.useEffect(() => {
        register('test');
      }, [register]);

      return (
        <div>
          <p>{isValid ? 'yes' : 'no'}</p>
          <button
            onClick={() => {
              trigger('test');
            }}
          >
            trigger
          </button>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('yes')).toBeVisible();
  });

  it('should remove all errors before set new errors when trigger entire form', async () => {
    const Component = () => {
      const [show, setShow] = React.useState(true);
      const {
        register,
        trigger,
        formState: { errors },
      } = useForm<{
        test: string;
      }>({
        shouldUnregister: true,
      });

      return (
        <div>
          {show && <input {...register('test', { required: true })} />}
          <button type={'button'} onClick={() => trigger()}>
            trigger
          </button>
          <button type={'button'} onClick={() => setShow(false)}>
            toggle
          </button>
          {errors.test && <span>error</span>}
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));

    expect(await screen.findByText('error')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    fireEvent.click(screen.getByRole('button', { name: 'trigger' }));

    await waitFor(() =>
      expect(screen.queryByText('error')).not.toBeInTheDocument(),
    );
  });

  it('should focus on errored input with build in validation', async () => {
    const Component = () => {
      const { register, trigger } = useForm<{
        test: string;
      }>();

      return (
        <>
          <input
            {...register('test', { required: true })}
            placeholder={'test'}
          />
          <button onClick={() => trigger('test', { shouldFocus: true })}>
            trigger
          </button>
        </>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(document.activeElement).toEqual(
        screen.getByPlaceholderText('test'),
      );
    });
  });

  it('should focus on errored input with schema validation', async () => {
    const Component = () => {
      const { register, trigger } = useForm<{
        test: string;
      }>({
        resolver: () => ({
          values: {},
          errors: {
            test: {
              type: 'test',
            },
          },
        }),
      });

      return (
        <>
          <input {...register('test')} placeholder={'test'} />
          <button onClick={() => trigger('test', { shouldFocus: true })}>
            trigger
          </button>
        </>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(document.activeElement).toEqual(
        screen.getByPlaceholderText('test'),
      );
    });
  });

  it('should focus on first errored input', async () => {
    const Component = () => {
      const { register, trigger } = useForm<{
        test: string;
        test2: string;
      }>();

      return (
        <>
          <input
            {...register('test', { required: true })}
            placeholder={'test'}
          />
          <input
            {...register('test2', { required: true })}
            placeholder={'test2'}
          />
          <button onClick={() => trigger(undefined, { shouldFocus: true })}>
            trigger
          </button>
        </>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(document.activeElement).toEqual(
        screen.getByPlaceholderText('test'),
      );
    });
  });

  it('should return isValid for the entire form', async () => {
    const App = () => {
      const [isValid, setIsValid] = React.useState(true);
      const { register, trigger, formState } = useForm();

      formState.isValid;

      return (
        <div>
          <input
            {...register('firstName', { required: true })}
            placeholder={'firstName'}
          />
          <input
            {...register('lastName', { required: true })}
            placeholder={'lastName'}
          />
          <button
            onClick={async () => {
              setIsValid(await trigger());
            }}
          >
            trigger
          </button>
          <p>{isValid ? 'true' : 'false'}</p>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('false')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('firstName'), {
      target: {
        value: '1234',
      },
    });
    fireEvent.change(screen.getByPlaceholderText('lastName'), {
      target: {
        value: '1234',
      },
    });

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('true')).toBeVisible();
  });

  it('should return correct valid state when trigger the entire form with build in validation', async () => {
    let isValid;

    function App() {
      const { register, trigger } = useForm();

      const onTrigger = async () => {
        isValid = await trigger();
      };

      return (
        <form>
          <input
            {...register('firstName', { required: true })}
            placeholder="First name"
          />
          <input
            {...register('last.name', { required: true })}
            placeholder="Last name"
          />

          <input type="button" onClick={onTrigger} value="trigger" />
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(isValid).toBeFalsy();
  });

  it('should be able to trigger an object of fields', async () => {
    let isValid;

    function App() {
      const {
        register,
        trigger,
        formState: { errors },
      } = useForm({
        defaultValues: {
          test: {
            firstName: '',
            lastName: '',
          },
        },
      });

      const onTrigger = async () => {
        isValid = await trigger('test');
      };

      return (
        <form>
          <input
            {...register('test.firstName', { required: true })}
            placeholder="First name"
          />
          {errors?.test?.firstName && <p>firstName</p>}

          <input
            {...register('test.lastName', { required: true })}
            placeholder="Last name"
          />
          {errors?.test?.lastName && <p>lastName</p>}

          <input type="button" onClick={onTrigger} value="trigger" />
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(isValid).toBeFalsy();

    expect(await screen.findByText('firstName')).toBeVisible();
    expect(screen.getByText('lastName')).toBeVisible();
  });

  it('should only trigger render on targeted input', async () => {
    type FormValue = {
      x: string;
      y: string;
    };

    function Input({
      name,
      control,
    }: {
      name: FieldPath<FormValue>;
      control: Control<FormValue>;
    }) {
      const renderCount = React.useRef(0);
      renderCount.current += 1;

      const {
        fieldState: { error },
      } = useController({
        name,
        control,
        rules: {
          required: true,
        },
      });

      error;

      return <p>{renderCount.current}</p>;
    }

    function App() {
      const { handleSubmit, control, trigger } = useForm<FormValue>();
      const onSubmit = noop;

      return (
        <div>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Input name="x" control={control} />
            <Input name="y" control={control} />

            <button type="button" onClick={() => trigger('x')}>
              Trigger Validation on X
            </button>
          </form>
        </div>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('2')).toBeVisible();
    expect(screen.getByText('3')).toBeVisible();
  });

  it('should skip additional validation when input validation already failed', async () => {
    let count = 0;

    const App = () => {
      const {
        register,
        trigger,
        formState: { isValid },
      } = useForm({
        mode: 'onChange',
      });
      const validate = () => {
        count++;
        return false;
      };

      return (
        <form>
          <p>{isValid ? 'valid' : 'invalid'}</p>
          <input
            {...register('test', {
              validate,
            })}
          />
          <button onClick={() => trigger('test')} type={'button'}>
            submit
          </button>
        </form>
      );
    };

    render(<App />);

    expect(await screen.findByText('invalid')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(count).toEqual(2);
  });

  it('should update validatingFields form states correctly when trigger() called', async () => {
    jest.useFakeTimers();

    let formState = {} as FormState<FieldValues>;
    let getFieldState = {} as UseFormGetFieldState<FieldValues>;
    const App = () => {
      const {
        register,
        trigger,
        formState: tmpFormState,
        getFieldState: tmpGetFieldState,
      } = useForm({ mode: 'onBlur' });
      getFieldState = tmpGetFieldState;
      formState = tmpFormState;
      formState.isValidating;
      formState.validatingFields;

      return (
        <div>
          <form>
            <input
              {...register('test1', {
                validate: async () => {
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      resolve(true);
                    }, 1000);
                  });
                },
              })}
              placeholder="async"
            />
            <input
              {...register('test2.sub', {
                validate: async () => {
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      resolve(true);
                    }, 1000);
                  });
                },
              })}
              placeholder="asyncSub"
            />
            <button
              data-testid="trigger-button"
              type="button"
              onClick={() => {
                trigger();
              }}
            >
              trigger
            </button>
          </form>
        </div>
      );
    };

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    });

    await waitFor(() => {
      expect(formState.isValidating).toBe(true);
      expect(getFieldState('test1').isValidating).toBe(true);
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(formState.isValidating).toBe(true);
      expect(getFieldState('test2.sub').isValidating).toBe(true);
      expect(formState.validatingFields).toStrictEqual({
        test2: { sub: true },
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(formState.isValidating).toBe(false);
      expect(getFieldState('test1').isValidating).toBe(false);
      expect(getFieldState('test2.sub').isValidating).toBe(false);
      expect(formState.validatingFields).toStrictEqual({});
    });
  });

  it('should put resolver field-array root errors under root - issue #13104', async () => {
    type FormValues = { items: { name: string }[] };

    const resolver: Resolver<FormValues> = async (values) => {
      if (!values.items || values.items.length < 1) {
        return {
          values: {},
          errors: {
            items: {
              type: 'min',
              message: 'at_least_1_item',
            },
          },
        };
      }

      return { values, errors: {} };
    };

    let triggerErrors: FieldErrors<FormValues> | undefined;

    const App = () => {
      const {
        control,
        trigger,
        formState: { errors },
      } = useForm<FormValues>({
        defaultValues: { items: [] },
        resolver,
      });

      useFieldArray({ control, name: 'items' });
      triggerErrors = errors;

      return (
        <button type="button" onClick={() => trigger('items')}>
          trigger
        </button>
      );
    };

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    });

    await waitFor(() => {
      expect(triggerErrors?.items?.root?.message).toBe('at_least_1_item');
    });
  });

  it('should preserve resolver nested field-array item errors on trigger', async () => {
    type FormValues = { items: { name: string }[] };

    const nestedItemErrors: FieldErrors<FormValues> = {
      items: [
        {
          name: {
            type: 'required',
            message: 'name_required',
          },
        },
      ],
    };

    const resolver: Resolver<FormValues> = async () => ({
      values: {},
      errors: nestedItemErrors,
    });

    let triggerErrors: FieldErrors<FormValues> | undefined;

    const App = () => {
      const {
        control,
        trigger,
        formState: { errors },
      } = useForm<FormValues>({
        defaultValues: { items: [{ name: '' }] },
        resolver,
      });

      useFieldArray({ control, name: 'items' });
      triggerErrors = errors;

      return (
        <button type="button" onClick={() => trigger('items')}>
          trigger
        </button>
      );
    };

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger/i }));
    });

    await waitFor(() => {
      expect(triggerErrors?.items?.[0]?.name?.message).toBe('name_required');
      expect(triggerErrors?.items?.root).toBeUndefined();
    });
  });
});
