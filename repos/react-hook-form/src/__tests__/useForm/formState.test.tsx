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
import { Controller } from '../../controller';
import type { Control, FormState, UseFormGetFieldState } from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import noop from '../../utils/noop';

describe('formState', () => {
  describe('isValid', () => {
    it('should return isValid correctly with resolver', async () => {
      let isValidValue = false;

      const Component = () => {
        const {
          register,
          formState: { isValid },
        } = useForm<{ test: string }>({
          mode: 'onChange',
          resolver: async (data) => {
            return {
              values: data.test ? data : {},
              errors: data.test
                ? {}
                : {
                    test: {
                      message: 'issue',
                      type: 'test',
                    },
                  },
            };
          },
        });

        isValidValue = isValid;
        return <input {...register('test')} />;
      };

      render(<Component />);

      expect(isValidValue).toBeFalsy();

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      await waitFor(() => expect(isValidValue).toBeTruthy());
    });

    it('should return true for onBlur mode by default', async () => {
      const App = () => {
        const {
          formState: { isValid },
        } = useForm<{ test: string }>({
          mode: VALIDATION_MODE.onBlur,
        });

        return <p>{isValid ? 'valid' : 'invalid'}</p>;
      };

      render(<App />);

      expect(await screen.findByText('valid')).toBeVisible();
    });

    it('should return true for onChange mode by default', async () => {
      const App = () => {
        const {
          formState: { isValid },
        } = useForm<{ test: string }>({
          mode: VALIDATION_MODE.onChange,
        });

        return <p>{isValid ? 'valid' : 'invalid'}</p>;
      };

      render(<App />);

      expect(await screen.findByText('valid')).toBeVisible();
    });

    it('should return true for all mode by default', async () => {
      const App = () => {
        const {
          formState: { isValid },
        } = useForm<{ test: string }>({
          mode: VALIDATION_MODE.all,
        });

        return <p>{isValid ? 'valid' : 'invalid'}</p>;
      };

      render(<App />);

      expect(await screen.findByText('valid')).toBeVisible();
    });

    it('should return false when default value is not valid value', async () => {
      const { result } = renderHook(() => {
        const methods = useForm<{ input: string; issue: string }>({
          mode: VALIDATION_MODE.onChange,
        });

        methods.formState.isValid;

        return methods;
      });

      await act(async () => {
        result.current.register('issue', { required: true });
        result.current.setValue('issue', '', { shouldValidate: true });
      });

      expect(result.current.formState.isValid).toBeFalsy();
    });

    it('should return false when custom register with validation', async () => {
      const { result } = renderHook(() =>
        useForm<{ input: string; issue: string }>({
          mode: VALIDATION_MODE.onChange,
        }),
      );

      result.current.formState.isValid;

      await act(async () => {
        result.current.register('issue', { required: true });
      });

      expect(result.current.formState.isValid).toBeFalsy();
    });

    it('should update valid when toggle Controller', async () => {
      const App = () => {
        const {
          control,
          watch,
          formState: { isValid },
        } = useForm({
          mode: 'onChange',
          shouldUnregister: true,
        });
        const test = watch('test');

        return (
          <div>
            <p>{isValid ? 'valid' : 'invalid'}</p>
            <Controller
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <select {...field} data-testid="select">
                  <option value={''}></option>
                  <option value={'test'}>test</option>
                  <option value={'test1'}>test1</option>
                </select>
              )}
              name={'test'}
            />

            {test === 'test1' && (
              <>
                <Controller
                  control={control}
                  render={({ field }) => <input {...field} />}
                  rules={{ required: true }}
                  name={'first.test'}
                />
                <Controller
                  control={control}
                  render={({ field }) => <input {...field} />}
                  rules={{ required: true }}
                  name={'first.test1'}
                />
              </>
            )}
          </div>
        );
      };

      render(<App />);

      expect(screen.getByText('invalid')).toBeVisible();

      fireEvent.change(screen.getByTestId('select'), {
        target: {
          value: 'test',
        },
      });

      expect(await screen.findByText('valid')).toBeVisible();

      fireEvent.change(screen.getByTestId('select'), {
        target: {
          value: 'test1',
        },
      });

      expect(await screen.findByText('invalid')).toBeVisible();

      fireEvent.change(screen.getByTestId('select'), {
        target: {
          value: 'test',
        },
      });

      expect(await screen.findByText('valid')).toBeVisible();

      fireEvent.change(screen.getByTestId('select'), {
        target: {
          value: 'test1',
        },
      });

      expect(await screen.findByText('invalid')).toBeVisible();
    });

    it('should set isValid to true after async values provide valid data', async () => {
      jest.useFakeTimers();

      const App = () => {
        const [value, setValue] = React.useState<{ name: string } | undefined>(
          undefined,
        );

        React.useEffect(() => {
          const t = setTimeout(() => setValue({ name: 'Mike' }), 2000);
          return () => clearTimeout(t);
        }, []);

        const {
          register,
          formState: { isValid },
        } = useForm<{ name: string }>({
          defaultValues: { name: '' },
          values: value ?? { name: '' },
          mode: 'onBlur',
        });

        return (
          <div>
            <input {...register('name', { required: true })} />
            <p>{isValid ? 'valid' : 'invalid'}</p>
          </div>
        );
      };

      render(<App />);

      expect(screen.getByText('invalid')).toBeVisible();

      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => expect(screen.getByText('valid')).toBeVisible());
      jest.useRealTimers();
    });
  });

  it('should be a proxy object that returns undefined for unknown properties', () => {
    const { result } = renderHook(() => useForm());

    // @ts-expect-error it's expected for an undefined property to be a typescript error
    expect(result.current.formState.nonExistentProperty).toBeUndefined();
  });

  it('should be a proxy object that properly implements the has trap', () => {
    const { result } = renderHook(() => useForm());

    expect('nonExistentProperty' in result.current.formState).toBeFalsy();
  });

  it('should be a proxy object that hasOwnProperty works on', () => {
    const { result } = renderHook(() => useForm());

    expect(result.current.formState).toHaveProperty('hasOwnProperty');
  });

  describe('when using with reset API', () => {
    type FormValues = {
      foo: string;
      foo1: string;
    };

    it('should render isValid as true with reset at useEffect with valid data', async () => {
      function Component() {
        const {
          register,
          control,
          formState: { isValid },
          reset,
        } = useForm<FormValues>({
          mode: 'onBlur',
          defaultValues: { foo: '', foo1: '' },
        });

        React.useEffect(() => {
          reset({ foo: 'test', foo1: 'test2' });
        }, [reset]);

        return (
          <div>
            <h2>Form with controlled input</h2>
            <Controller
              name="foo"
              rules={{ required: true }}
              control={control}
              render={({ field }) => <input {...field} />}
            />
            <input {...register('foo1', { required: true })} />
            {isValid ? 'valid' : 'nope'}
          </div>
        );
      }

      render(<Component />);

      expect(await screen.findByText('valid')).toBeVisible();
    });

    it('should render isValid as false with reset at useEffect with valid data', async () => {
      function Component() {
        const {
          register,
          control,
          formState: { isValid },
          reset,
        } = useForm<FormValues>({
          mode: 'onBlur',
          defaultValues: { foo: '', foo1: '' },
        });

        React.useEffect(() => {
          reset({ foo: 'test', foo1: '' });
        }, [reset]);

        return (
          <div>
            <h2>Form with controlled input</h2>
            <Controller
              name="foo"
              rules={{ required: true }}
              control={control}
              render={({ field }) => <input {...field} />}
            />
            <input {...register('foo1', { required: true })} />
            {isValid ? 'valid' : 'nope'}
          </div>
        );
      }

      render(<Component />);

      expect(await screen.findByText('nope')).toBeVisible();
    });
  });

  it('should not update form state when there is a promise reject', async () => {
    const rejectPromiseFn = jest
      .fn()
      .mockRejectedValue(new Error('this is an error'));

    const App = () => {
      const {
        register,
        handleSubmit,
        formState: { isSubmitSuccessful, isSubmitted },
      } = useForm();

      return (
        <form>
          <input {...register('test')} />
          <p>{isSubmitted ? 'isSubmitted' : 'no'}</p>
          <p>
            {isSubmitSuccessful
              ? 'isSubmitSuccessful'
              : 'isNotSubmitSuccessful'}
          </p>
          <button
            type={'button'}
            onClick={() => handleSubmit(rejectPromiseFn)().catch(noop)}
          >
            Submit
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('isNotSubmitSuccessful')).toBeVisible();
  });

  it('should update isValid even with mode set to onSubmit', async () => {
    const App = () => {
      const {
        register,
        handleSubmit,
        formState: { isValid, errors },
      } = useForm({
        defaultValues: {
          test: '',
        },
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input {...register('test', { required: true })} />
          {errors.test && <p>error</p>}

          <p>{isValid ? 'valid' : 'invalid'}</p>

          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    await waitFor(() => screen.getByText('invalid'));
    expect(screen.queryByText('error')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'value',
      },
    });

    await waitFor(() => screen.getByText('valid'));
    expect(screen.queryByText('error')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '',
      },
    });

    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(screen.queryByText('error')).toBeInTheDocument(),
    );
    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'value',
      },
    });
    await waitFor(() =>
      expect(screen.queryByText('error')).not.toBeInTheDocument(),
    );
  });

  it('should update correct isValid formState with dynamic fields', async () => {
    const Component = () => {
      const {
        register,
        control,
        formState: { isValid },
      } = useForm<{
        list: {
          firstName: string;
          lastName: string;
        }[];
        test: string;
        test1: string;
        test2: string;
        test3: string;
      }>({
        mode: 'onChange',
      });
      const { append, fields } = useFieldArray({
        control,
        name: 'list',
      });

      return (
        <form>
          <Controller
            render={({ field }) => (
              <input {...field} placeholder={field.name} />
            )}
            name={'test'}
            rules={{ required: true }}
            control={control}
            defaultValue={''}
          />
          <input
            {...register('test1', { required: true })}
            placeholder={'test1'}
          />
          <input {...register('test2')} placeholder={'test2'} />
          <Controller
            render={({ field }) => (
              <input {...field} placeholder={field.name} />
            )}
            name={'test3'}
            control={control}
            defaultValue={''}
          />
          {fields.map((field, index) => {
            return (
              <div key={field.id}>
                <Controller
                  render={({ field }) => (
                    <input {...field} placeholder={field.name} />
                  )}
                  name={`list.${index}.firstName` as const}
                  control={control}
                  rules={{ required: true }}
                />
                <input
                  {...register(`list.${index}.lastName` as const, {
                    required: true,
                  })}
                  placeholder={`list.${index}.lastName`}
                />
              </div>
            );
          })}
          <button
            type={'button'}
            onClick={() =>
              append({
                firstName: '',
                lastName: '',
              })
            }
          >
            append
          </button>
          <p>{isValid ? 'valid' : 'inValid'}</p>
        </form>
      );
    };

    render(<Component />);

    expect(await screen.findByText('inValid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('test'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByPlaceholderText('test1'), {
      target: { value: '1' },
    });

    expect(await screen.findByText('valid')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('inValid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('list.0.firstName'), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByPlaceholderText('list.0.lastName'), {
      target: { value: '1' },
    });

    expect(await screen.findByText('valid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('list.0.lastName'), {
      target: { value: '' },
    });

    expect(await screen.findByText('inValid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('list.0.lastName'), {
      target: { value: '1' },
    });

    expect(await screen.findByText('valid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('list.0.firstName'), {
      target: { value: '' },
    });

    expect(await screen.findByText('inValid')).toBeVisible();

    fireEvent.change(screen.getByPlaceholderText('list.0.firstName'), {
      target: { value: '1' },
    });

    expect(await screen.findByText('valid')).toBeVisible();
  });

  it('should remind isSubmitting when form is invalid', async () => {
    const submittingState: boolean[] = [];

    function App() {
      const {
        register,
        formState: { isSubmitting },
        handleSubmit,
      } = useForm();

      submittingState.push(isSubmitting);

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input
            {...register('value', { required: true })}
            defaultValue="Any default value!"
          />
          <button>Submit</button>
        </form>
      );
    }

    render(<App />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button'));
    });

    expect(submittingState).toEqual([false, false, true, false]);
  });

  describe('when defaultValue supplied', () => {
    it('should update isValid to true for validation with inline defaultValue', async () => {
      function App() {
        const {
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
            <p>isValid = {isValid ? 'true' : 'false'}</p>
          </form>
        );
      }

      render(<App />);

      expect(await screen.findByText('isValid = true')).toBeVisible();
    });

    it('should update isValid to true for Controller validation', async () => {
      function App() {
        const {
          control,
          formState: { isValid },
        } = useForm({
          mode: 'onChange',
        });

        return (
          <form>
            <Controller
              control={control}
              render={({ field }) => <input {...field} />}
              name={'test'}
              defaultValue="Any default value!"
            />
            <p>isValid = {isValid ? 'true' : 'false'}</p>
            <button>Submit</button>
          </form>
        );
      }

      render(<App />);

      expect(await screen.findByText('isValid = true')).toBeVisible();
    });
  });

  it('should not update dirty fields during blur event', async () => {
    let dirtyFieldsState = {};

    const App = () => {
      const {
        handleSubmit,
        register,
        formState: { dirtyFields },
      } = useForm();

      dirtyFieldsState = dirtyFields;

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input
            {...register('test', { setValueAs: (value) => value + '1' })}
          />
          <input type="submit" />
        </form>
      );
    };

    render(<App />);

    fireEvent.blur(screen.getByRole('textbox'));

    expect(dirtyFieldsState).toEqual({});
  });

  it('should update isDirty with getFieldState at child component', () => {
    type FormValues = {
      test?: string;
    };

    function Output({
      getFieldState,
      formState,
    }: {
      getFieldState: UseFormGetFieldState<FormValues>;
      formState: FormState<FormValues>;
    }) {
      const { isDirty } = getFieldState('test', formState);

      return <p>{isDirty.toString()}</p>;
    }

    const TextInput = ({ control }: { control: Control<FormValues> }) => {
      const { field } = useController({
        name: 'test',
        control,
      });

      return <input {...field} type="text" />;
    };

    function App() {
      const { formState, getFieldState, control } = useForm<FormValues>({
        values: {},
      });
      formState.isDirty;

      return (
        <form>
          <TextInput control={control} />
          <Output getFieldState={getFieldState} formState={formState} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '123456',
      },
    });

    waitFor(() => {
      screen.getByText('true');
    });
  });

  it('should recompute isDirty after toggling disabled', async () => {
    let isDirty: null | boolean = null;

    const App = () => {
      const defaultValues = { name: 'initial', disableName: false };
      const { formState, register, watch } = useForm({ defaultValues });

      isDirty = formState.isDirty;

      const disableName = watch('disableName', defaultValues.disableName);

      return (
        <form>
          <input type="text" {...register('name', { disabled: disableName })} />
          <input type="checkbox" {...register('disableName')} />
        </form>
      );
    };

    render(<App />);

    const checkbox = screen.getByRole('checkbox');

    fireEvent.click(checkbox);

    expect(isDirty).toBe(true);

    fireEvent.click(checkbox);

    expect(isDirty).toBe(false);
  });

  it('should prevent dirty from updating when the form is disabled', async () => {
    function App() {
      const {
        register,
        control,
        formState: { isDirty, dirtyFields },
      } = useForm<{
        test: { firstName: string; lastName: string }[];
      }>({
        disabled: true,
        defaultValues: {
          test: [{ firstName: 'Bill', lastName: 'Luo' }],
        },
      });
      const { fields } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form>
          <ul>
            {fields.map((item, index) => {
              return (
                <li key={item.id}>
                  <input
                    {...register(`test.${index}.firstName`, { required: true })}
                  />
                  <Controller
                    render={({ field }) => <input {...field} />}
                    name={`test.${index}.lastName`}
                    control={control}
                  />
                </li>
              );
            })}
          </ul>
          <p>{isDirty ? 'dirty' : 'notDirty'}</p>
          <p>{Object.keys(dirtyFields).length}</p>
        </form>
      );
    }

    render(<App />);

    await screen.getByText('notDirty');
    await screen.getByText('0');
  });

  describe('when delay config is set', () => {
    const message = 'required.';

    it('should only show error after 500ms with register', async () => {
      jest.useFakeTimers();

      const App = () => {
        const {
          register,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          delayError: 500,
          mode: 'onChange',
        });

        return (
          <div>
            <input
              {...register('test', {
                maxLength: 4,
              })}
            />
            {errors.test && <p>{message}</p>}
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: '123456',
        },
      });

      expect(screen.queryByText(message)).not.toBeInTheDocument();

      jest.advanceTimersByTime(500);

      expect(await screen.findByText(message)).toBeVisible();
    });

    it('should only show error after 500ms with Controller', async () => {
      const App = () => {
        const {
          control,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          delayError: 500,
          mode: 'onChange',
        });

        return (
          <div>
            <Controller
              render={({ field }) => <input {...field} />}
              rules={{
                maxLength: 4,
              }}
              control={control}
              name="test"
              defaultValue=""
            />
            {errors.test && <p>{message}</p>}
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: '123456',
        },
      });

      expect(screen.queryByText(message)).not.toBeInTheDocument();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(await screen.findByText(message)).toBeVisible();
    });

    it('should prevent error from showing once input is validated', async () => {
      jest.useFakeTimers();

      const App = () => {
        const {
          register,
          formState: { errors, isDirty },
        } = useForm<{
          test: string;
        }>({
          delayError: 500,
          mode: 'onChange',
        });

        return (
          <div>
            <p>Dirty: {isDirty.toString()}</p>
            <input
              {...register('test', {
                maxLength: 4,
              })}
            />
            {errors.test && <p>{message}</p>}
          </div>
        );
      };

      render(<App />);

      const input = screen.getByRole('textbox');

      fireEvent.change(input, {
        target: {
          value: '123456',
        },
      });

      expect(await screen.findByText('Dirty: true')).toBeVisible();
      expect(screen.queryByText(message)).not.toBeInTheDocument();

      fireEvent.change(input, {
        target: {
          value: '123',
        },
      });
      expect(screen.queryByText(message)).not.toBeInTheDocument();

      await act(async () => {
        jest.advanceTimersByTime(500);
      });

      expect(screen.queryByText(message)).not.toBeInTheDocument();
    });

    describe('when delayError is provided', () => {
      it('should only show error after 500ms with register and render formState instantly', async () => {
        jest.useFakeTimers();

        const message = 'required.';

        const App = () => {
          const {
            register,
            formState: { errors, isValid },
          } = useForm<{
            test: string;
          }>({
            delayError: 500,
            mode: 'onChange',
          });

          return (
            <div>
              {isValid ? 'valid' : 'inValid'}
              <input
                {...register('test', {
                  required: true,
                  maxLength: 4,
                })}
              />
              {errors.test && <p>{message}</p>}
            </div>
          );
        };

        render(<App />);

        fireEvent.change(screen.getByRole('textbox'), {
          target: {
            value: '123',
          },
        });

        expect(screen.queryByText(message)).not.toBeInTheDocument();

        expect(await screen.findByText('valid')).toBeVisible();

        await act(async () => {
          fireEvent.change(screen.getByRole('textbox'), {
            target: {
              value: '',
            },
          });
        });

        await act(async () => {
          await waitFor(() => screen.getByText('inValid'));
        });

        expect(screen.queryByText(message)).toBeNull();

        act(() => {
          jest.advanceTimersByTime(500);
        });

        expect(await screen.findByText(message)).toBeVisible();
      });
    });
  });

  it('should return updated value with NaN data type', async () => {
    function App() {
      const { register, formState } = useForm({
        mode: 'onChange',
        defaultValues: {
          value: '',
        },
      });

      return (
        <form>
          {formState.errors.value && <p>error</p>}
          <input
            {...register('value', {
              min: 0,
              valueAsNumber: true,
              validate: (value) => !Number.isNaN(value),
            })}
          />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '2a',
      },
    });

    await waitFor(() => {
      screen.getByText('error');
    });
  });

  it('should only trigger validation on blur', async () => {
    function App() {
      const { register, formState } = useForm({
        mode: 'onBlur',
        defaultValues: {
          value: '',
        },
      });

      return (
        <form>
          {formState.errors.value && <p>error</p>}
          <input
            {...register('value', {
              min: 0,
              valueAsNumber: true,
              validate: (value) => !Number.isNaN(value),
            })}
          />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '2a',
      },
    });

    await waitFor(() => {
      expect(screen.queryByText('error')).toBeNull();
    });

    fireEvent.blur(screen.getByRole('textbox'), {
      target: {
        value: '2a',
      },
    });

    await waitFor(() => {
      screen.getByText('error');
    });
  });

  it('should report isDirty as false on mount when defaultValues contain numeric string keys (issue #13346)', async () => {
    function App() {
      const {
        register,
        formState: { isDirty },
      } = useForm({
        defaultValues: {
          items: {
            '123': { name: 'Alice' },
            '456': { name: 'Bob' },
          },
        },
      });

      return (
        <div>
          <input {...register('items.123.name')} />
          <input {...register('items.456.name')} />
          <p>{isDirty ? 'dirty' : 'pristine'}</p>
        </div>
      );
    }

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('pristine')).toBeInTheDocument();
    });
  });

  it('should not update valid with onBlur mode', async () => {
    function App() {
      const {
        formState: { isValid },
        register,
      } = useForm({ mode: 'onBlur' });

      return (
        <div>
          <input {...register('name', { required: true })} />
          <p>{isValid ? 'yes' : 'no'}</p>
        </div>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '2a',
      },
    });

    await waitFor(() => {
      expect(screen.getByText('no')).toBeInTheDocument();
    });
  });

  it('should produce a new errors reference on each mutation so memoized child components re-render', async () => {
    type FormValues = { test: string };
    const errorRefs: object[] = [];

    function ErrorDisplay({
      errors,
    }: {
      errors: FormState<FormValues>['errors'];
    }) {
      errorRefs.push(errors);
      return <p data-testid="error">{errors.test?.message ?? ''}</p>;
    }

    function App() {
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<FormValues>({
        mode: 'onChange',
        defaultValues: { test: '' },
      });
      return (
        <form onSubmit={handleSubmit(noop)}>
          <input {...register('test', { required: 'required' })} />
          <ErrorDisplay errors={errors} />
          <button type="submit">Submit</button>
        </form>
      );
    }

    render(<App />);
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'valid' } });
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(''),
    );

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('required'),
    );
    const refAfterFirstError = errorRefs.at(-1);

    fireEvent.change(input, { target: { value: 'valid' } });
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(''),
    );
    const refAfterCleared = errorRefs.at(-1);

    fireEvent.change(input, { target: { value: '' } });
    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('required'),
    );
    const refAfterSecondError = errorRefs.at(-1);

    expect(refAfterFirstError).not.toBe(refAfterCleared);
    expect(refAfterCleared).not.toBe(refAfterSecondError);
  });
});
