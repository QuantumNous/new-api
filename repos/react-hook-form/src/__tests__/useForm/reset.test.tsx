import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';

import { Controller } from '../../controller';
import type {
  Control,
  FieldErrors,
  UseFormRegister,
  UseFormReturn,
} from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import { useWatch } from '../../useWatch';
import isEmptyObject from '../../utils/isEmptyObject';
import noop from '../../utils/noop';

jest.useFakeTimers();

describe('reset', () => {
  it('should reset the form and re-render the form', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    result.current.register('test');
    result.current.setValue('test', 'data');

    expect(result.current.formState.isSubmitted).toBeFalsy();
    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: 'data',
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(result.current.formState.isSubmitted).toBeTruthy();
    act(() => result.current.reset());
    expect(result.current.formState.isSubmitted).toBeFalsy();
  });

  it('should reset form value', () => {
    let methods: any;
    const App = () => {
      methods = useForm<{
        test: string;
      }>();
      return (
        <form>
          <input {...methods.register('test')} />
        </form>
      );
    };
    render(<App />);

    act(() =>
      methods.reset({
        test: 'test',
      }),
    );

    expect(methods.getValues()).toEqual({
      test: 'test',
    });
  });

  it('should reset the form with callback action', () => {
    const App = () => {
      const { register, reset } = useForm({
        defaultValues: {
          test: '',
        },
      });

      React.useEffect(() => {
        reset((formValues) => {
          return {
            ...formValues,
            test: 'test',
          };
        });
      }, [reset]);

      return (
        <form>
          <input {...register('test')} />
        </form>
      );
    };

    render(<App />);

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'test',
    );
  });

  it('should set array value of multiple checkbox inputs correctly', async () => {
    const App = () => {
      const { register } = useForm<{
        test: string[];
      }>({
        defaultValues: {
          test: ['1', '2'],
        },
      });

      return (
        <>
          <input type="checkbox" value={'1'} {...register('test')} />
          <input type="checkbox" value={'2'} {...register('test')} />
        </>
      );
    };

    render(<App />);

    screen
      .getAllByRole('checkbox')
      .forEach((checkbox) =>
        expect((checkbox as HTMLInputElement).checked).toBeTruthy(),
      );
  });

  it('should reset the form if ref is HTMLElement and parent element is not form', async () => {
    const mockReset = jest.spyOn(window.HTMLFormElement.prototype, 'reset');
    let methods: UseFormReturn<{
      test: string;
    }>;
    const App = () => {
      methods = useForm<{
        test: string;
      }>();
      return <input {...methods.register('test')} />;
    };
    render(<App />);

    act(() => methods.reset());

    expect(mockReset).not.toHaveBeenCalled();
  });

  it('should set default value if values is specified to first argument', async () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string;
      }>(),
    );

    result.current.register('test');

    act(() => result.current.reset({ test: 'test' }));

    expect(result.current.control._defaultValues).toEqual({
      test: 'test',
    });
  });

  it('should reset unmountFieldsState value when shouldUnregister set to false', () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string;
      }>(),
    );

    result.current.register('test');

    act(() => result.current.reset({ test: 'test' }));
  });

  it('should not reset unmountFieldsState value by default', () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string;
      }>(),
    );

    result.current.register('test');

    act(() => result.current.reset({ test: 'test' }));
  });

  it('should not reset form values when keepValues is specified', () => {
    const App = () => {
      const { register, reset } = useForm();

      return (
        <>
          <input {...register('test')} />
          <button
            type={'button'}
            onClick={() =>
              reset(undefined, {
                keepValues: true,
              })
            }
          >
            reset
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    fireEvent.click(screen.getByRole('button'));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'test',
    );
  });

  it('should not reset form defaultValues when keepDefaultValues is specified', async () => {
    const App = () => {
      const {
        register,
        reset,
        formState: { isDirty },
      } = useForm({
        defaultValues: {
          test: 'test1',
        },
      });

      return (
        <>
          <input {...register('test')} />
          <p>{isDirty ? 'dirty' : ''}</p>
          <button
            type={'button'}
            onClick={() =>
              reset(undefined, {
                keepValues: true,
              })
            }
          >
            reset
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    fireEvent.click(screen.getByRole('button'));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'test',
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test2',
      },
    });

    expect(await screen.findByText('dirty')).toBeVisible();

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test1',
      },
    });

    expect(screen.queryByText('dirty')).not.toBeInTheDocument();
  });

  it('should update dirty and dirtyFields when keepDefaultValues and updatedValues is provided', async () => {
    function App() {
      const {
        register,
        reset,
        formState: { isDirty, dirtyFields },
      } = useForm({
        defaultValues: {
          firstName: 'test',
        },
      });

      return (
        <form>
          <input {...register('firstName')} placeholder="First Name" />
          <p>{isDirty ? 'dirty' : 'pristine'}</p>
          <p>{JSON.stringify(dirtyFields)}</p>

          <button
            type="button"
            onClick={() => {
              reset(
                {
                  firstName: 'other',
                },
                {
                  keepDefaultValues: true,
                },
              );
            }}
          >
            test
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('dirty')).toBeVisible();
    expect(screen.getByText('{"firstName":true}')).toBeVisible();
  });

  it('should not reset if keepStateOption is specified', async () => {
    let formState = {};
    const onSubmit = jest.fn();

    const App = () => {
      const {
        register,
        handleSubmit,
        reset,
        formState: { touchedFields, errors, isDirty },
      } = useForm<{ test: string }>({
        defaultValues: {
          test: '',
        },
      });

      formState = { touchedFields, errors, isDirty };

      return (
        <form onSubmit={handleSubmit(onSubmit)}>
          <input {...register('test', { required: true, minLength: 3 })} />
          <button>submit</button>
          <button
            onClick={() => {
              reset(
                { test: '' },
                {
                  keepErrors: true,
                  keepDirty: true,
                  keepIsSubmitted: true,
                  keepIsSubmitSuccessful: true,
                  keepTouched: true,
                  keepSubmitCount: true,
                },
              );
            }}
            type={'button'}
          >
            reset
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    fireEvent.blur(screen.getByRole('textbox'));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    await waitFor(() =>
      expect(formState).toEqual({
        errors: {},
        isDirty: true,
        touchedFields: {
          test: true,
        },
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));

    expect(formState).toEqual({
      errors: {},
      isDirty: true,
      touchedFields: {
        test: true,
      },
    });
  });

  it('should reset field array fine with empty value', async () => {
    let data: unknown;
    const App = () => {
      const { control, register, reset, handleSubmit } = useForm<{
        test: {
          firstName: string;
          lastName: string;
        }[];
      }>();
      const { fields } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form
          onSubmit={handleSubmit((d) => {
            data = d;
          })}
        >
          {fields.map((field, index) => (
            <div key={field.id}>
              <input {...register(`test.${index}.firstName` as const)} />
              <Controller
                control={control}
                name={`test.${index}.lastName` as const}
                render={({ field }) => <input {...field} />}
              />
            </div>
          ))}

          <button>submit</button>

          <button type={'button'} onClick={() => reset()}>
            reset
          </button>
          <button
            type={'button'}
            onClick={() =>
              reset({
                test: [{ firstName: 'test', lastName: 'test' }],
              })
            }
          >
            reset with value
          </button>
        </form>
      );
    };

    render(<App />);

    const resetButton = screen.getByRole('button', { name: 'reset' });
    const submitButton = screen.getByRole('button', { name: 'submit' });

    fireEvent.click(resetButton);
    fireEvent.click(submitButton);

    await waitFor(() => expect(data).toEqual({}));

    fireEvent.click(screen.getByRole('button', { name: 'reset with value' }));
    fireEvent.click(submitButton);

    await waitFor(() =>
      expect(data).toEqual({
        test: [{ firstName: 'test', lastName: 'test' }],
      }),
    );
  });

  it('should return reset nested value', () => {
    const getValuesResult: unknown[] = [];

    function App() {
      const [, update] = React.useState({});
      const { register, reset, getValues } = useForm<{
        names: { name: string }[];
      }>({
        defaultValues: {
          names: [{ name: 'test' }],
        },
      });

      React.useEffect(() => {
        reset({ names: [{ name: 'Bill' }, { name: 'Luo' }] });
      }, [reset]);

      getValuesResult.push(getValues());

      return (
        <form>
          <input {...register('names.0.name')} placeholder="Name" />
          <button type={'button'} onClick={() => update({})}>
            update
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(getValuesResult).toEqual([
      {
        names: [
          {
            name: 'test',
          },
        ],
      },
      {
        names: [
          {
            name: 'Bill',
          },
          {
            name: 'Luo',
          },
        ],
      },
      {
        names: [
          {
            name: 'Bill',
          },
          {
            name: 'Luo',
          },
        ],
      },
    ]);
  });

  it('should keep defaultValues after reset with shouldKeepDefaultValues', async () => {
    type FormValues = { test: string; test1: string };
    const ControlledInput = ({ control }: { control: Control<FormValues> }) => {
      const { field } = useController({
        name: 'test',
        control,
      });

      return <input {...field} />;
    };

    function App() {
      const { control, register, reset } = useForm<FormValues>({
        defaultValues: { test: 'test', test1: 'test1' },
      });
      const resetData = () => {
        reset(undefined, { keepDefaultValues: true });
      };

      return (
        <form>
          <ControlledInput control={control} />
          <input {...register('test1')} />
          <input type="button" onClick={resetData} value="Reset" />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'data' },
    });

    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'data' },
    });

    fireEvent.click(screen.getByRole('button'));

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('test');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('test1');
  });

  describe('when reset optional props set to keepDirtyValues', () => {
    describe('with uncontrolled components', () => {
      let updatedDirtyFields: Record<string, boolean> = {};
      let updatedDirty = false;
      let submittedValue: unknown = {};

      function App() {
        const [showButton, setShowButton] = React.useState(false);
        const {
          reset,
          register,
          handleSubmit,
          formState: { dirtyFields, isDirty },
        } = useForm();

        updatedDirtyFields = dirtyFields;
        updatedDirty = isDirty;

        React.useEffect(() => {
          setTimeout(() => {
            reset(
              {
                firstName: 'bill',
                lastName: 'luo',
              },
              { keepDirtyValues: true },
            );
            setShowButton(true);
          }, 500);
        }, [reset]);

        return (
          <form
            onSubmit={handleSubmit((data) => {
              submittedValue = data;
            })}
          >
            <input {...register('firstName')} placeholder="First Name" />
            <input {...register('lastName')} placeholder="Last Name" />

            {showButton && (
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
              >
                reset
              </button>
            )}
            <button>submit</button>
          </form>
        );
      }

      it('should only update new reset values', async () => {
        render(<App />);

        await waitFor(() =>
          expect(
            (screen.getByPlaceholderText('First Name') as HTMLInputElement)
              .value,
          ).toEqual('bill'),
        );

        fireEvent.click(screen.getByRole('button', { name: 'reset' }));

        expect(updatedDirtyFields).toEqual({});
        expect(updatedDirty).toBeFalsy();

        expect(
          (screen.getByPlaceholderText('First Name') as HTMLInputElement).value,
        ).toEqual('bill');

        expect(updatedDirtyFields).toEqual({});
        expect(updatedDirty).toBeFalsy();

        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() =>
          expect(submittedValue).toEqual({
            firstName: 'bill',
            lastName: 'luo',
          }),
        );
      });

      it('should treat previously-undirty fields as dirty when keepDefaultValues is set', async () => {
        let updatedDirtyFields: Record<string, boolean> = {};
        let updatedDirty = false;

        function App() {
          const {
            reset,
            register,
            handleSubmit,
            formState: { dirtyFields, isDirty },
          } = useForm({ defaultValues: { firstName: '', lastName: '' } });

          function resetKeepDefaults() {
            reset(
              {
                firstName: 'bill',
                lastName: 'luo',
              },
              {
                keepDefaultValues: true,
                keepDirtyValues: true,
              },
            );
          }

          updatedDirtyFields = dirtyFields;
          updatedDirty = isDirty;

          return (
            <form
              onSubmit={handleSubmit((data) => {
                submittedValue = data;
              })}
            >
              <input {...register('firstName')} placeholder="First Name" />
              <input {...register('lastName')} placeholder="Last Name" />

              <button
                type="button"
                onClick={() => {
                  resetKeepDefaults();
                }}
              >
                reset keep defaults
              </button>
              <button>submit</button>
            </form>
          );
        }

        render(<App />);

        fireEvent.click(
          screen.getByRole('button', { name: 'reset keep defaults' }),
        );

        await waitFor(() =>
          expect(
            (screen.getByPlaceholderText('Last Name') as HTMLInputElement)
              .value,
          ).toEqual('luo'),
        );

        expect(
          (screen.getByPlaceholderText('First Name') as HTMLInputElement).value,
        ).toEqual('bill');

        // Both fields were updated, the defaults were kept, so both should be dirty
        expect(updatedDirtyFields).toEqual({
          firstName: true,
          lastName: true,
        });

        expect(updatedDirty).toBeTruthy();
      });
    });

    describe('with controlled components', () => {
      let updatedDirtyFields: Record<string, boolean> = {};
      let updatedDirty = false;
      let submittedValue: unknown = {};

      function App() {
        const [showButton, setShowButton] = React.useState(false);
        const {
          reset,
          control,
          handleSubmit,
          formState: { dirtyFields, isDirty },
        } = useForm({
          defaultValues: {
            firstName: '',
            lastName: '',
          },
        });

        updatedDirtyFields = dirtyFields;
        updatedDirty = isDirty;

        React.useEffect(() => {
          setTimeout(() => {
            reset(
              {
                firstName: 'bill',
                lastName: 'luo',
              },
              { keepDirtyValues: true },
            );
            setShowButton(true);
          }, 500);
        }, [reset]);

        return (
          <form
            onSubmit={handleSubmit((data) => {
              submittedValue = data;
            })}
          >
            <Controller
              control={control}
              render={({ field }) => {
                return <input {...field} placeholder="First Name" />;
              }}
              name={'firstName'}
            />
            <Controller
              control={control}
              render={({ field }) => {
                return <input {...field} placeholder="Last Name" />;
              }}
              name={'lastName'}
            />

            {showButton && (
              <button
                type="button"
                onClick={() => {
                  reset();
                }}
              >
                reset
              </button>
            )}

            <button>submit</button>
          </form>
        );
      }

      it('should only update new reset values', async () => {
        render(<App />);

        await waitFor(() =>
          expect(
            (screen.getByPlaceholderText('First Name') as HTMLInputElement)
              .value,
          ).toEqual('bill'),
        );

        fireEvent.click(screen.getByRole('button', { name: 'reset' }));

        expect(updatedDirtyFields).toEqual({});
        expect(updatedDirty).toBeFalsy();

        expect(
          (screen.getByPlaceholderText('First Name') as HTMLInputElement).value,
        ).toEqual('bill');

        expect(updatedDirtyFields).toEqual({});
        expect(updatedDirty).toBeFalsy();

        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() =>
          expect(submittedValue).toEqual({
            firstName: 'bill',
            lastName: 'luo',
          }),
        );
      });

      it('should only update none dirty fields and keep other values updated', async () => {
        render(<App />);

        fireEvent.change(screen.getByPlaceholderText('First Name'), {
          target: {
            value: 'test',
          },
        });

        await waitFor(() =>
          expect(
            (screen.getByPlaceholderText('Last Name') as HTMLInputElement)
              .value,
          ).toEqual('luo'),
        );

        expect(updatedDirtyFields).toEqual({
          firstName: true,
        });
        expect(updatedDirty).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() =>
          expect(submittedValue).toEqual({
            firstName: 'test',
            lastName: 'luo',
          }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'reset' }));

        expect(
          (screen.getByPlaceholderText('First Name') as HTMLInputElement).value,
        ).toEqual('bill');

        expect(updatedDirtyFields).toEqual({});
        expect(updatedDirty).toBeFalsy();

        fireEvent.click(screen.getByRole('button', { name: 'submit' }));

        await waitFor(() =>
          expect(submittedValue).toEqual({
            firstName: 'bill',
            lastName: 'luo',
          }),
        );
      });
    });
  });

  it('should allow resetting unmounted field array', () => {
    type FormValues = {
      test: { name: string }[];
    };

    const FieldArray = ({
      control,
      register,
    }: {
      control: Control<FormValues>;
      register: UseFormRegister<FormValues>;
    }) => {
      const { fields, append } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <div>
          {fields.map((field, index) => {
            return (
              <input
                key={field.id}
                {...register(`test.${index}.name` as const)}
              />
            );
          })}
          <button
            onClick={() => {
              append({ name: '' });
            }}
          >
            append
          </button>
        </div>
      );
    };

    const App = () => {
      const [show, setShow] = React.useState(true);
      const { control, register, reset } = useForm<FormValues>();

      return (
        <div>
          {show && <FieldArray control={control} register={register} />}
          <button
            onClick={() => {
              setShow(!show);
            }}
          >
            toggle
          </button>
          <button
            onClick={() => {
              reset({
                test: [{ name: 'test' }],
              });
            }}
          >
            reset
          </button>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    expect(screen.getAllByRole('textbox').length).toEqual(2);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getAllByRole('textbox').length).toEqual(1);
  });

  it('should only return register input when reset is invoked with shouldUnregister:true', async () => {
    let submittedData = {};

    const App = () => {
      const { reset, handleSubmit } = useForm({
        defaultValues: {
          test: 'bill',
        },
        shouldUnregister: true,
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <button>submit</button>
          <button
            type={'button'}
            onClick={() => {
              reset({
                test: '1234',
              });
            }}
          >
            reset
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(submittedData).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(submittedData).toEqual({});
  });

  it('should update controlled input correctly with shouldUnregister set to true', () => {
    function App() {
      const { register, reset, control } = useForm({
        defaultValues: { uncontrolled: '', control: '' },
        shouldUnregister: true,
      });

      return (
        <form>
          <input {...register('uncontrolled')} />
          <Controller
            render={({ field }) => (
              <input
                ref={field.ref}
                value={field.value}
                onChange={field.onChange}
              />
            )}
            name="control"
            control={control}
          />

          <button
            type="button"
            onClick={() => {
              reset({ uncontrolled: 'uncontrolled', control: 'control' });
            }}
          >
            reset
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('uncontrolled');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('control');
  });

  it('should keep reset value for conditionally mounted controlled fields with shouldUnregister', async () => {
    let submittedData = {};

    const App = () => {
      const { control, watch, handleSubmit, reset } = useForm<{
        name: string;
        age: string;
      }>({
        shouldUnregister: true,
        defaultValues: {
          name: '',
        },
      });
      const showAge = !!watch('name');

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <Controller
            name="name"
            control={control}
            render={({ field: { onChange, name, ref, value } }) => (
              <input
                ref={ref}
                name={name}
                value={value || ''}
                onChange={onChange}
              />
            )}
          />
          {showAge && (
            <Controller
              name="age"
              control={control}
              render={({ field: { onChange, name, ref, value } }) => (
                <input
                  ref={ref}
                  name={name}
                  value={value || ''}
                  onChange={onChange}
                />
              )}
            />
          )}
          <button
            type="button"
            onClick={() => {
              reset({ name: 'name', age: '3' });
            }}
          >
            reset with values
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'reset with values' }));

    await waitFor(() =>
      expect(
        (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
      ).toBe('3'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(submittedData).toEqual({ name: 'name', age: '3' }),
    );
  });

  it('should keep input values when keepValues is set to true', () => {
    function App() {
      const { register, handleSubmit, reset } = useForm();
      const [show, setShow] = React.useState(true);

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input {...register('firstName')} placeholder="First Name" />
          {show && <input {...register('lastName')} placeholder="Last Name" />}
          <button
            type="button"
            onClick={() => {
              reset({}, { keepValues: true });
            }}
          >
            reset
          </button>
          <button
            type="button"
            onClick={() => {
              setShow(!show);
            }}
          >
            toggle
          </button>
          <input type="submit" />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('test');
  });

  it('should not update isMounted when isValid is subscribed', async () => {
    const mounted: unknown[] = [];

    const App = () => {
      const { control, reset } = useForm();

      mounted.push(control._state.mount);

      React.useEffect(() => {
        reset({});
      }, [reset]);

      return <form />;
    };

    render(<App />);

    expect(mounted).toEqual([false, true]);
  });

  it('should update isMounted when isValid is subscribed', async () => {
    const mounted: unknown[] = [];
    let tempControl: Control = {} as Control;

    const App = () => {
      const {
        control,
        reset,
        formState: { isValid },
      } = useForm();

      mounted.push(control._state.mount);
      tempControl = control;

      React.useEffect(() => {
        reset({});
      }, [reset]);

      return (
        <form>
          <p>{isValid ? 'true' : 'false'}</p>
        </form>
      );
    };

    render(<App />);

    expect(await screen.findByText('false')).toBeVisible();

    // With fix for #13088, mount is set based on conditions including !isEmptyObject(_formValues)
    // When reset({}) is called, _formValues becomes {}, so mount becomes true
    expect(mounted).toEqual([false, false]);

    expect(tempControl._state.mount).toBeTruthy();
  });

  it('should reset values but keep defaultValues', async () => {
    const App = () => {
      const { register, control, reset } = useForm({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });

      return (
        <>
          <input {...register('test')} />
          <Controller
            control={control}
            render={({ field }) => <input {...field} />}
            name={'test1'}
          />
          <button
            onClick={() => {
              reset(
                {
                  test: 'changed1',
                  test1: 'changed2',
                },
                { keepDefaultValues: true },
              );
            }}
          >
            reset
          </button>
          <p>{JSON.stringify(control._defaultValues)}</p>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(
      await screen.findByText('{"test":"test","test1":"test1"}'),
    ).toBeVisible();
    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('changed1');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('changed2');
  });

  it('should reset field array async', () => {
    let tempFields: unknown[] = [];

    function App() {
      const { control, reset } = useForm<{
        names: {
          test: string;
        }[];
      }>({
        defaultValues: {
          names: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'names',
      });

      tempFields = fields;

      return (
        <form>
          <button
            type="button"
            onClick={() => {
              setTimeout(() => {
                reset();
              }, 100);
            }}
          >
            reset
          </button>
          <button
            type="button"
            onClick={() =>
              append({
                test: '1',
              })
            }
          >
            append
          </button>
          <ul>
            {fields.map((item, index) => (
              <Controller
                key={item.id}
                render={({ field }) => <input {...field} />}
                name={`names.${index}.test`}
                control={control}
              />
            ))}
          </ul>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(tempFields).toEqual([]);
  });

  it('should reset the form after submitted', async () => {
    function App() {
      const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { isDirty, dirtyFields },
      } = useForm({
        defaultValues: {
          something: 'anything',
          test: [{ firstName: 'Bill', lastName: 'Luo' }],
        },
      });
      const { fields } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            reset({ ...data });
          })}
        >
          <p>is dirty? {isDirty ? 'yes' : 'no'}</p>
          <p>{JSON.stringify(dirtyFields)}</p>
          <input {...register('something')} />
          <ul>
            {fields.map((item, index) => {
              return (
                <li key={item.id}>
                  <input
                    defaultValue={`${item.firstName}`}
                    {...register(`test.${index}.firstName`)}
                  />

                  <Controller
                    render={({ field }) => <input {...field} />}
                    name={`test.${index}.lastName`}
                    control={control}
                    defaultValue={item.lastName}
                  />
                </li>
              );
            })}
          </ul>

          <button>Submit</button>
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: '1' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: '2' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[2], {
      target: { value: '3' },
    });

    expect(screen.getByText(/yes/i)).toBeVisible();
    expect(
      screen.getByText(
        `{"something":true,"test":[{"firstName":true,"lastName":true}]}`,
      ),
    ).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText(/no/i)).toBeVisible();

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('1');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('2');
    expect(
      (screen.getAllByRole('textbox')[2] as HTMLInputElement).value,
    ).toEqual('3');
  });

  it('should keep isSubmitted and isSubmitSuccessful value when flags are set', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    expect(result.current.formState.isSubmitted).toBeFalsy();
    expect(result.current.formState.isSubmitSuccessful).toBeFalsy();

    await act(() =>
      result.current.reset(undefined, {
        keepIsSubmitted: true,
        keepIsSubmitSuccessful: true,
      }),
    );
    expect(result.current.formState.isSubmitted).toBeFalsy();
    expect(result.current.formState.isSubmitSuccessful).toBeFalsy();

    result.current.register('test');
    result.current.setValue('test', 'data');

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: 'data',
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });

    expect(result.current.formState.isSubmitted).toBeTruthy();
    expect(result.current.formState.isSubmitSuccessful).toBeTruthy();

    act(() =>
      result.current.reset(undefined, {
        keepIsSubmitted: true,
        keepIsSubmitSuccessful: true,
      }),
    );

    expect(result.current.formState.isSubmitted).toBeTruthy();
    expect(result.current.formState.isSubmitSuccessful).toBeTruthy();
  });

  it('should keep track on updated defaultValues', async () => {
    function App() {
      const {
        handleSubmit,
        reset,
        formState: { defaultValues },
      } = useForm({
        defaultValues: { firstName: 'Bill', lastName: 'Luo' },
      });

      return (
        <form
          onSubmit={handleSubmit(() => {
            reset({ firstName: 'Bill1', lastName: 'Luo1' });
          })}
        >
          <button>Submit</button>
          <p>{defaultValues?.firstName}</p>
          <p>{defaultValues?.lastName}</p>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('Bill1')).toBeVisible();
      expect(screen.getByText('Luo1')).toBeVisible();
    });
  });

  it('should reset to empty values in useWatch and watch when calling reset with empty object', async () => {
    const defaultValues = {
      something: 'anything',
    };

    function App() {
      const { control, reset, register, watch } = useForm({
        defaultValues,
      });
      const watchValue = watch('something');
      const useWatchValue = useWatch({
        control,
        name: 'something',
      });

      return (
        <form>
          <input {...register('something')} />
          <button
            type="button"
            onClick={() => {
              reset({});
            }}
          >
            reset
          </button>
          <p>watch: {watchValue}</p>
          <p>useWatch: {useWatchValue}</p>
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '1' },
    });

    expect(screen.getByText('watch: 1')).toBeVisible();
    expect(screen.getByText('useWatch: 1')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('watch:')).toBeVisible();
    expect(screen.getByText('useWatch:')).toBeVisible();
  });

  it('should use values passed to reset({}) as new defaultValues on submit', async () => {
    let submittedData: unknown;

    function App() {
      const { reset, handleSubmit } = useForm({
        defaultValues: {
          name: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submittedData = data;
          })}
        >
          <button type="submit">submit</button>
          <button
            type="button"
            onClick={() => {
              reset({});
            }}
          >
            reset
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(submittedData).toEqual({}));
  });

  it('should set _formValues to empty object after reset({})', () => {
    const { result } = renderHook(() =>
      useForm({
        defaultValues: {
          name: {
            firstName: 'John',
            lastName: 'Doe',
          },
        },
      }),
    );

    act(() => result.current.reset({}));

    expect(result.current.getValues()).toEqual({});
    expect(result.current.control._defaultValues).toEqual({});
  });

  it('should keep mounted value after reset with keep dirty values', async () => {
    function App() {
      const {
        getValues,
        reset,
        register,
        formState: { isValid },
      } = useForm({
        mode: 'onChange',
      });

      return (
        <form>
          <input
            {...register('value', { required: true })}
            defaultValue="Any default value!"
          />
          <p>{getValues().test}</p>
          <p>isValid = {isValid ? 'true' : 'false'}</p>
          <button
            type="button"
            onClick={() => reset({ test: '34' }, { keepDirtyValues: true })}
          >
            reset
          </button>
        </form>
      );
    }

    render(<App />);

    expect(await screen.findByText('isValid = true')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      screen.getByText('34');
    });
  });

  it('should keep dirty array value after reset with keepDirtyValues', async () => {
    function App() {
      const {
        getValues,
        reset,
        setValue,
        formState: { isDirty },
      } = useForm<{
        array: string[];
      }>({
        mode: 'onChange',
        defaultValues: {
          array: [],
        },
      });

      return (
        <form>
          <input defaultValue="users#0" />
          <p>{`users#${getValues().array.length}`}</p>
          <p>isDirty = {isDirty ? 'true' : 'false'}</p>
          <button
            data-testid="dirtyButton"
            type="button"
            onClick={() => setValue('array', ['1'], { shouldDirty: true })}
          >
            dirty
          </button>
          <button
            data-testid="resetButton"
            type="button"
            onClick={() => reset({ array: [] }, { keepDirtyValues: true })}
          >
            reset
          </button>
        </form>
      );
    }

    render(<App />);

    expect(await screen.findByText('isDirty = false')).toBeVisible();
    await waitFor(() => {
      screen.getByText('users#0');
    });

    fireEvent.click(screen.getByTestId('dirtyButton'));
    expect(await screen.findByText('isDirty = true')).toBeVisible();
    await waitFor(() => {
      screen.getByText('users#1');
    });

    fireEvent.click(screen.getByTestId('resetButton'));

    await waitFor(() => {
      screen.getByText('users#1');
    });
  });

  it('should keep dirty fields for dynamic controller name when keepDirty and keepDirtyValues are true', async () => {
    type FormValues = {
      name_es: string;
      name_en: string;
    };

    const defaultValues: FormValues = {
      name_es: 'Espanol',
      name_en: 'English',
    };

    function App() {
      const {
        control,
        reset,
        formState: { dirtyFields },
      } = useForm<FormValues>({
        defaultValues,
      });
      const [language, setLanguage] = React.useState<'es' | 'en'>('en');

      return (
        <form>
          <Controller
            control={control}
            name={`name_${language}`}
            render={({ field }) => <input {...field} />}
          />
          <button
            type="button"
            onClick={() => {
              setLanguage((prev) => (prev === 'en' ? 'es' : 'en'));
              reset(defaultValues, { keepDirty: true, keepDirtyValues: true });
            }}
          >
            toggle
          </button>
          <p data-testid="dirtyFields">{JSON.stringify(dirtyFields)}</p>
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'Test 1',
      },
    });

    expect(screen.getByTestId('dirtyFields').textContent).toBe(
      '{"name_en":true}',
    );

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    await waitFor(() =>
      expect(screen.getByTestId('dirtyFields').textContent).toBe(
        '{"name_en":true}',
      ),
    );
  });

  it('should not mutate data outside of library', () => {
    const defaultValues = {
      test: 'ok',
    };

    const App = () => {
      const { register, reset, resetField } = useForm();

      return (
        <form>
          <input {...register('test')} />
          <button type="button" onClick={() => reset(defaultValues)}>
            reset
          </button>
          <button
            type="button"
            onClick={() => resetField('test', { defaultValue: 'error' })}
          >
            resetField
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'resetField' }));

    expect(defaultValues.test).toBe('ok');
  });

  it('should not reset value to undefined with onSubmit data', async () => {
    const onSubmit = jest.fn();
    const App = () => {
      const { handleSubmit, reset, register } = useForm({
        defaultValues: {
          test: 'test' as string | undefined,
        },
      });

      return (
        <form onSubmit={handleSubmit((data) => onSubmit(data))}>
          <button
            onClick={() => {
              reset(
                {
                  test: undefined,
                },
                {
                  keepDefaultValues: true,
                },
              );
            }}
          >
            reset
          </button>
          <input {...register('test')} />
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        test: 'test',
      }),
    );
  });

  it('should clear validation errors after reset to prevent false errors on subsequent submissions (Next.js 16 Server Actions fix)', async () => {
    const resolver = jest.fn(
      async (data: { name: string; description?: string }) => {
        const errors: FieldErrors<{ name: string; description?: string }> = {};

        if (!data.name || data.name.length < 2) {
          errors.name = {
            type: 'min',
            message: 'Name must be at least 2 characters',
          };
        }

        if (data.description && data.description.length < 5) {
          errors.description = {
            type: 'min',
            message: 'Description must be at least 5 characters',
          };
        }

        return {
          values: isEmptyObject(errors) ? data : {},
          errors,
        };
      },
    );

    const onSubmit = jest.fn();
    let methods: UseFormReturn<{ name: string; description?: string }>;

    const App = () => {
      methods = useForm<{ name: string; description?: string }>({
        resolver,
        defaultValues: {
          name: '',
          description: '',
        },
      });

      return (
        <form
          onSubmit={methods.handleSubmit(async (data) => {
            // Simulate Next.js Server Action
            await new Promise((resolve) => setTimeout(resolve, 100));
            onSubmit(data);
            // Call reset after successful submission
            methods.reset();
          })}
        >
          <input {...methods.register('name')} />
          {methods.formState.errors.name && (
            <p>{methods.formState.errors.name.message}</p>
          )}
          <input {...methods.register('description')} />
          {methods.formState.errors.description && (
            <p>{methods.formState.errors.description.message}</p>
          )}
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<App />);

    // First submission with valid data
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'validname' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'validdescription' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'validname',
      description: 'validdescription',
    });

    // Wait for reset to complete
    await waitFor(() => {
      expect(methods.formState.errors).toEqual({});
    });

    // Second submission with valid data after reset
    // This should not show validation errors
    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: { value: 'newname' },
    });
    fireEvent.change(screen.getAllByRole('textbox')[1], {
      target: { value: 'newdescription' },
    });

    // Clear previous calls
    onSubmit.mockClear();
    resolver.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith({
      name: 'newname',
      description: 'newdescription',
    });

    // Verify no error messages are displayed
    expect(
      screen.queryByText('Name must be at least 2 characters'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('Description must be at least 5 characters'),
    ).not.toBeInTheDocument();
  });

  it('should keep isValid value when reset is called with keepIsValid option', async () => {
    let formState: { isValid: boolean } = { isValid: false };

    const App = () => {
      const {
        register,
        reset,
        formState: { isValid },
      } = useForm({
        defaultValues: { name: 'Mike' },
        mode: 'onChange',
      });

      formState = { isValid };

      return (
        <div>
          <p>
            <input {...register('name', { required: true })} />
          </p>
          <button
            onClick={() => {
              reset({ name: '' }, { keepIsValid: true });
            }}
          >
            reset with keepIsValid
          </button>
          <button
            onClick={() => {
              reset({ name: '' });
            }}
          >
            reset without keepIsValid
          </button>
          <p>is valid: {isValid ? 'true' : 'false'}</p>
        </div>
      );
    };

    render(<App />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    await waitFor(() => {
      expect(screen.getByText('is valid: true')).toBeInTheDocument();
    });

    expect(formState).toEqual({ isValid: true });
    expect(input.value).toBe('Mike');

    // Reset with keepIsValid
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'reset with keepIsValid' }),
      );
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('is valid: true')).toBeInTheDocument();
    expect(formState).toEqual({ isValid: true });

    // Reset without keepIsValid
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'reset without keepIsValid' }),
      );
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    // Verify isValid value is false after reset without keepIsValid
    expect(screen.getByText('is valid: false')).toBeInTheDocument();
    expect(formState).toEqual({ isValid: false });
  });

  it('should keep isValid value when form has resetOptions.keepIsValid configured', async () => {
    let formState: { isValid: boolean } = { isValid: false };

    const App = () => {
      const {
        register,
        reset,
        formState: { isValid },
      } = useForm({
        defaultValues: { name: 'Mike' },
        mode: 'onChange',
        resetOptions: {
          keepIsValid: true,
        },
      });

      formState = { isValid };

      return (
        <div>
          <p>
            <input {...register('name', { required: true })} />
          </p>
          <button
            onClick={() => {
              reset({ name: '' });
            }}
          >
            reset
          </button>
          <p>is valid: {isValid ? 'true' : 'false'}</p>
        </div>
      );
    };

    render(<App />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    await waitFor(() => {
      expect(screen.getByText('is valid: true')).toBeInTheDocument();
    });

    expect(formState).toEqual({ isValid: true });
    expect(input.value).toBe('Mike');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'reset' }));
    });

    await waitFor(() => {
      expect(input.value).toBe('');
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(screen.getByText('is valid: true')).toBeInTheDocument();
    expect(formState).toEqual({ isValid: true });
  });
});
