import React, { useState } from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import { VALIDATION_MODE } from '../constants';
import type {
  Control,
  FieldErrors,
  FieldValues,
  FormState,
  Mode,
  RegisterOptions,
  ResolverResult,
  SubmitHandler,
  UseFormGetFieldState,
  UseFormRegister,
  UseFormReturn,
  UseFormUnregister,
} from '../types';
import isFunction from '../utils/isFunction';
import noop from '../utils/noop';
import sleep from '../utils/sleep';
import {
  Controller,
  createFormControl,
  useController,
  useFieldArray,
  useForm,
  useFormState,
} from '../';

jest.useFakeTimers();

describe('useForm', () => {
  describe('when component unMount', () => {
    it('should call unSubscribe', () => {
      const { result, unmount } = renderHook(() => useForm<{ test: string }>());

      result.current.register('test');
      unmount();

      expect(result.current.getValues()).toEqual({});
    });

    it('should remain array field values when inputs gets unmounted', () => {
      const { result, unmount } = renderHook(() =>
        useForm<{ test: string[] }>(),
      );

      result.current.register('test.0');
      result.current.register('test.1');
      result.current.register('test.2');

      unmount();

      expect(result.current.getValues()).toEqual({
        test: [undefined, undefined, undefined],
      });
    });

    it('should not unregister errors when unmounted', async () => {
      const { result, unmount } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      result.current.formState.errors;
      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.handleSubmit(noop)({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });

      expect(result.current.formState.errors.test).toBeDefined();

      unmount();

      expect(result.current.formState.errors.test).toBeDefined();
    });

    it('should only unregister errors when unregister method invoked', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      result.current.formState.errors;
      result.current.register('test', { required: true });

      await act(async () => {
        await result.current.handleSubmit(noop)({
          preventDefault: noop,
          persist: noop,
        } as React.SyntheticEvent);
      });

      expect(result.current.formState.errors.test).toBeDefined();

      await act(async () => {
        result.current.unregister('test');
      });

      expect(result.current.formState.errors.test).not.toBeDefined();
    });

    it('should not unregister touched', () => {
      let formState: any;
      const Component = () => {
        const { register, formState: tempFormState } = useForm<{
          test: string;
        }>();
        formState = tempFormState;

        formState.touchedFields;

        return (
          <div>
            <input {...register('test', { required: true })} />
          </div>
        );
      };
      const { unmount } = render(<Component />);

      fireEvent.blur(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      expect(formState.touchedFields.test).toBeDefined();
      expect(formState.isDirty).toBeFalsy();

      unmount();

      expect(formState.touchedFields.test).toBeDefined();
      expect(formState.isDirty).toBeFalsy();
    });

    it('should update dirtyFields during unregister', () => {
      let formState: any;
      const Component = () => {
        const { register, formState: tempFormState } = useForm<{
          test: string;
        }>();
        formState = tempFormState;

        formState.isDirty;
        formState.dirtyFields;

        return <input {...register('test', { required: true })} />;
      };
      const { unmount } = render(<Component />);

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      expect(formState.dirtyFields.test).toBeDefined();
      expect(formState.isDirty).toBeTruthy();

      unmount();

      expect(formState.dirtyFields.test).toBeDefined();
      expect(formState.isDirty).toBeTruthy();
    });

    it('should only validate input which are mounted even with shouldUnregister: false', async () => {
      const Component = () => {
        const [show, setShow] = React.useState(true);
        const {
          handleSubmit,
          register,
          formState: { errors },
        } = useForm<{
          firstName: string;
          lastName: string;
        }>();

        return (
          <form onSubmit={handleSubmit(noop)}>
            {show && <input {...register('firstName', { required: true })} />}
            {errors.firstName && <p>First name is required.</p>}

            <input {...register('lastName', { required: true })} />
            {errors.lastName && <p>Last name is required.</p>}

            <button type={'button'} onClick={() => setShow(!show)}>
              toggle
            </button>
            <button type={'submit'}>submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      expect(await screen.findByText('First name is required.')).toBeVisible();
      expect(screen.getByText('Last name is required.')).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      expect(screen.getByText('Last name is required.')).toBeVisible();

      await waitForElementToBeRemoved(
        screen.queryByText('First name is required.'),
      );
    });
  });

  describe('when shouldUnregister set to true', () => {
    describe('with useFieldArray', () => {
      type FormValues = {
        test: string;
        test1: string;
        test2: {
          value: string;
        }[];
      };

      const Child = ({
        control,
        register,
      }: {
        control: Control<FormValues>;
        register: UseFormRegister<FormValues>;
      }) => {
        const { fields } = useFieldArray({
          control,
          name: 'test2',
          shouldUnregister: true,
        });

        return (
          <>
            {fields.map((field, i) => (
              <input
                key={field.id}
                {...register(`test2.${i}.value` as const)}
              />
            ))}
          </>
        );
      };

      it('should remove and unregister inputs when inputs gets unmounted', async () => {
        let submittedData: FormValues;

        const Component = () => {
          const [show, setShow] = React.useState(true);
          const { register, handleSubmit, control } = useForm<FormValues>({
            shouldUnregister: true,
            defaultValues: {
              test: 'bill',
              test1: 'bill1',
              test2: [{ value: 'bill2' }],
            },
          });

          return (
            <form onSubmit={handleSubmit((data) => (submittedData = data))}>
              {show && (
                <>
                  <input {...register('test')} />
                  <Controller
                    control={control}
                    render={({ field }) => <input {...field} />}
                    name={'test1'}
                  />
                  <Child control={control} register={register} />
                </>
              )}
              <button>Submit</button>
              <button type={'button'} onClick={() => setShow(false)}>
                Toggle
              </button>
            </form>
          );
        };

        render(<Component />);

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() =>
          expect(submittedData).toEqual({
            test: 'bill',
            test1: 'bill1',
            test2: [
              {
                value: 'bill2',
              },
            ],
          }),
        );

        fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

        fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

        await waitFor(() => expect(submittedData).toEqual({}));
      });
    });

    it('should not mutate defaultValues', () => {
      const defaultValues = {
        test: {
          test: '123',
          test1: '1234',
        },
      };

      const Form = () => {
        const { register, control } = useForm({
          defaultValues,
        });
        return (
          <>
            <input {...register('test.test', { shouldUnregister: true })} />
            <Controller
              control={control}
              shouldUnregister
              render={() => {
                return <input />;
              }}
              name={'test.test1'}
            />
          </>
        );
      };

      const App = () => {
        const [show, setShow] = React.useState(true);
        return (
          <>
            {show && <Form />}
            <button
              type={'button'}
              onClick={() => {
                setShow(!show);
              }}
            >
              toggle
            </button>
          </>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(screen.getByRole('button'));

      fireEvent.click(screen.getByRole('button'));

      expect(defaultValues).toEqual({
        test: {
          test: '123',
          test1: '1234',
        },
      });
    });

    it('should not register or shallow defaultValues into submission data', () => {
      let data = {};

      const App = () => {
        const { handleSubmit } = useForm({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <button
            onClick={handleSubmit((d) => {
              data = d;
            })}
          >
            submit
          </button>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      expect(data).toEqual({});
    });

    it('should keep validation during unmount', async () => {
      const onSubmit = jest.fn();

      function Component() {
        const {
          register,
          handleSubmit,
          watch,
          formState: { errors, submitCount },
        } = useForm<{
          firstName: string;
          moreDetail: boolean;
        }>({
          shouldUnregister: true,
        });
        const moreDetail = watch('moreDetail');

        return (
          <>
            <p>Submit count: {submitCount}</p>
            <form onSubmit={handleSubmit(onSubmit)}>
              <input
                placeholder="firstName"
                {...register('firstName', { maxLength: 3 })}
              />
              {errors.firstName && <p>max length</p>}
              <input
                type="checkbox"
                {...register('moreDetail')}
                placeholder={'checkbox'}
              />

              {moreDetail && <p>show more</p>}
              <button>Submit</button>
            </form>
          </>
        );
      }

      render(<Component />);

      fireEvent.change(screen.getByPlaceholderText('firstName'), {
        target: {
          value: 'testtesttest',
        },
      });

      fireEvent.click(screen.getByRole('button'));

      expect(await screen.findByText('Submit count: 1')).toBeVisible();
      expect(screen.getByText('max length')).toBeVisible();

      fireEvent.click(screen.getByPlaceholderText('checkbox'));

      expect(screen.getByText('show more')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      expect(await screen.findByText('Submit count: 2')).toBeVisible();
      expect(screen.getByText('max length')).toBeVisible();
    });

    it('should only unregister inputs when all checkboxes are unmounted', async () => {
      let result: Record<string, string> | undefined = undefined;

      const Component = () => {
        const { register, handleSubmit } = useForm({
          shouldUnregister: true,
        });
        const [radio1, setRadio1] = React.useState(true);
        const [radio2, setRadio2] = React.useState(true);

        return (
          <form
            onSubmit={handleSubmit((data) => {
              result = data;
            })}
          >
            {radio1 && (
              <input {...register('test')} type={'radio'} value={'1'} />
            )}
            {radio2 && (
              <input {...register('test')} type={'radio'} value={'2'} />
            )}
            <button type={'button'} onClick={() => setRadio1(!radio1)}>
              setRadio1
            </button>
            <button type={'button'} onClick={() => setRadio2(!radio2)}>
              setRadio2
            </button>
            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'setRadio1' }));

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(result).toEqual({ test: null }));

      fireEvent.click(screen.getByRole('button', { name: 'setRadio2' }));

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => expect(result).toEqual({}));
    });
  });

  describe('when errors changes', () => {
    it('should display the latest error message', async () => {
      const Form = () => {
        const {
          register,
          setError,
          formState: { errors },
        } = useForm<{
          test: string;
        }>();

        React.useEffect(() => {
          setError('test', {
            type: 'data',
            message: 'data',
          });
        }, [setError]);

        return (
          <div>
            <input
              {...register('test', {
                maxLength: {
                  message: 'max',
                  value: 3,
                },
              })}
              placeholder="test"
              type="text"
            />
            <span role="alert">{errors.test && errors.test.message}</span>
          </div>
        );
      };

      render(<Form />);

      const span = screen.getByRole('alert');

      await waitFor(() => expect(span.textContent).toBe('data'));

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      await waitFor(() => expect(span.textContent).toBe('data'));
    });

    it('should display the latest error message with errors prop', () => {
      const Form = () => {
        type FormValues = {
          test1: string;
          test2: string;
        };
        const [errorsState, setErrorsState] = React.useState<
          FieldErrors<FormValues>
        >({
          test1: { type: 'test1', message: 'test1 error' },
        });
        const {
          register,
          formState: { errors },
        } = useForm<FormValues>({
          errors: errorsState,
        });

        return (
          <div>
            <input {...register('test1')} type="text" />
            <span role="alert">{errors.test1 && errors.test1.message}</span>
            <input {...register('test2')} type="text" />
            <span role="alert">{errors.test2 && errors.test2.message}</span>
            <button
              onClick={() =>
                setErrorsState((errors) => ({
                  ...errors,
                  test2: { type: 'test2', message: 'test2 error' },
                }))
              }
            >
              Set Errors
            </button>
          </div>
        );
      };

      render(<Form />);

      const alert1 = screen.getAllByRole('alert')[0];
      expect(alert1.textContent).toBe('test1 error');
      const test1Input = screen.getAllByRole('textbox')[0];
      expect(test1Input).toHaveFocus();

      fireEvent.click(screen.getByRole('button'));

      const alert2 = screen.getAllByRole('alert')[1];
      expect(alert2.textContent).toBe('test2 error');
      expect(test1Input).toHaveFocus();
    });

    it("shouldn't focus the input of the error defined in the errors prop if shouldFocusError is false", () => {
      const formErrors = {
        test1: { type: 'test1', message: 'test1 error' },
      };
      const Form = () => {
        type FormValues = {
          test1: string;
        };
        const {
          register,
          formState: { errors },
        } = useForm<FormValues>({
          errors: formErrors,
          shouldFocusError: false,
        });

        return (
          <div>
            <input {...register('test1')} type="text" />
            <span role="alert">{errors.test1 && errors.test1.message}</span>
          </div>
        );
      };

      const renderRes = render(<Form />);
      const alert1 = screen.getAllByRole('alert')[0];
      expect(alert1.textContent).toBe('test1 error');
      expect(renderRes.baseElement).toHaveFocus();
    });
  });

  describe('handleChangeRef', () => {
    const Component = ({
      resolver,
      mode,
      rules = { required: 'required' },
      onSubmit = noop,
    }: {
      resolver?: any;
      mode?: 'onBlur' | 'onSubmit' | 'onChange';
      rules?: RegisterOptions<{ test: string }, 'test'>;
      onSubmit?: () => void;
    }) => {
      const internationalMethods = useForm<{ test: string }>({
        resolver,
        mode,
      });
      const {
        register,
        handleSubmit,
        formState: { errors, isValid, isDirty },
      } = internationalMethods;
      methods = internationalMethods;

      return (
        <div>
          <input type="text" {...register('test', resolver ? {} : rules)} />
          <span role="alert">
            {errors?.test?.message && errors.test.message}
          </span>
          <button onClick={handleSubmit(onSubmit)}>button</button>
          <p>{isValid ? 'valid' : 'invalid'}</p>
          <p>{isDirty ? 'dirty' : 'pristine'}</p>
        </div>
      );
    };
    let methods: UseFormReturn<{ test: string }>;

    describe('onSubmit mode', () => {
      it('should not contain error if value is valid', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(alert.textContent).toBe('');
      });

      it('should not contain error if name is invalid', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        const alert = await screen.findByRole('alert');
        expect(alert.textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'wrongName', value: '' },
        });

        expect(alert.textContent).toBe('');
      });

      it('should contain error if value is invalid with revalidateMode is onChange', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} />);

        const input = screen.getByRole('textbox');

        fireEvent.input(input, { target: { name: 'test', value: 'test' } });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not call reRender method if the current error is the same as the previous error', async () => {
        render(<Component />);

        const input = screen.getByRole('textbox');

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );

        fireEvent.input(input, { target: { name: 'test', value: '' } });

        expect(screen.getByRole('alert').textContent).toBe('required');
      });

      it('should set name to formState.touchedFields when formState.touchedFields is defined', async () => {
        const onSubmit = jest.fn();

        render(<Component onSubmit={onSubmit} rules={{}} />);

        methods.formState.touchedFields;

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        fireEvent.blur(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() =>
          expect(methods.formState.touchedFields).toEqual({
            test: true,
          }),
        );
        expect(screen.getByRole('alert').textContent).toBe('');
      });

      // check https://github.com/react-hook-form/react-hook-form/issues/2153
      it('should perform correct behavior when reValidateMode is onBlur', async () => {
        const onSubmit = jest.fn();

        const Component = () => {
          const {
            register,
            handleSubmit,
            formState: { errors },
          } = useForm<{
            test: string;
          }>({
            reValidateMode: 'onBlur',
          });
          return (
            <form onSubmit={handleSubmit(onSubmit)}>
              <input type="text" {...register('test', { required: true })} />
              {errors.test && <span role="alert">required</span>}
              <button>submit</button>
            </form>
          );
        };

        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: {
            value: 'test',
          },
        });

        fireEvent.click(screen.getByRole('button', { name: /submit/i }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        fireEvent.input(screen.getByRole('textbox'), {
          target: { value: '' },
        });

        expect(screen.queryByRole('alert')).not.toBeInTheDocument();

        fireEvent.blur(screen.getByRole('textbox'));

        expect(await screen.findByRole('alert')).toBeVisible();
      });
    });

    describe('onChange', () => {
      it('should display error with onChange', async () => {
        render(<Component mode="onChange" />);

        fireEvent.change(screen.getByRole('textbox'), {
          target: {
            value: 'test',
          },
        });

        await waitFor(() => screen.getByText('valid'));

        fireEvent.change(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should display error with onSubmit', async () => {
        render(<Component mode="onChange" />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not display error with onBlur', async () => {
        render(<Component mode="onChange" />);

        fireEvent.blur(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        expect(screen.getByRole('alert').textContent).toBe('');
      });
    });

    describe('onBlur', () => {
      it('should display error with onBlur', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.blur(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should display error with onSubmit', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.click(screen.getByRole('button'));

        await waitFor(() =>
          expect(screen.getByRole('alert').textContent).toBe('required'),
        );
      });

      it('should not display error with onChange', async () => {
        render(<Component mode="onBlur" />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: {
            value: '',
          },
        });

        expect(screen.getByRole('alert').textContent).toBe('');
      });
    });

    describe('with watch', () => {
      it('should be return undefined or null value', () => {
        const { result } = renderHook(() =>
          useForm<{
            test: string | null;
            test1?: string;
          }>(),
        );

        result.current.register('test');
        result.current.register('test1');

        act(() => {
          result.current.setValue('test', null);
        });

        act(() => {
          result.current.setValue('test1', undefined);
        });

        const test = result.current.watch('test');
        const test1 = result.current.watch('test1');

        expect(test).toBeNull();
        expect(test1).toBeUndefined();
      });

      it('should be called reRender method if isWatchAllRef is true', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string;
          }>();
          watchedField = watch();
          return (
            <form onSubmit={handleSubmit(noop)}>
              <input {...register('test')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(watchedField).toEqual({ test: 'test' });
      });

      it('should be called reRender method if field is watched', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string;
          }>();
          watchedField = watch('test');
          return (
            <form onSubmit={handleSubmit(noop)}>
              <input {...register('test')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        expect(watchedField).toBe('test');
      });

      it('should be called reRender method if array field is watched', async () => {
        let watchedField: any;
        const Component = () => {
          const { register, handleSubmit, watch } = useForm<{
            test: string[];
          }>();
          watchedField = watch('test');
          return (
            <form onSubmit={handleSubmit(noop)}>
              <input {...register('test.0')} />
              <input {...register('test.1')} />
              <input {...register('test.2')} />
              <button>button</button>
            </form>
          );
        };
        render(<Component />);

        fireEvent.input(screen.getAllByRole('textbox')[0], {
          target: { name: 'test.0', value: 'test' },
        });

        expect(watchedField).toEqual(['test', '', '']);
      });
    });

    describe('with resolver', () => {
      it('should contain error if value is invalid with resolver', async () => {
        const resolver = jest.fn(async (data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              test: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });
        expect(await screen.findByText('dirty')).toBeVisible();
        expect(resolver).toHaveBeenCalled();

        expect(screen.getByRole('alert').textContent).toBe('');
        expect(methods.formState.isValid).toBeTruthy();

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        await waitFor(() => {
          expect(screen.getByRole('alert')).toHaveTextContent('resolver error');
        });
        expect(resolver).toHaveBeenCalled();
        expect(methods.formState.isValid).toBeFalsy();
      });

      it('with sync resolver it should contain error if value is invalid with resolver', async () => {
        const resolver = jest.fn((data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              test: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBe(true));
        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        expect(await screen.findByText('invalid')).toBeVisible();
        expect(methods.formState.isValid).toBe(false);
        expect(screen.getByRole('alert')).toHaveTextContent('resolver error');
        expect(resolver).toHaveBeenCalled();
      });

      it('should make isValid change to false if it contain error that is not related name with onChange mode', async () => {
        const resolver = jest.fn(async (data: any) => {
          if (data.test) {
            return { values: data, errors: {} };
          }
          return {
            values: data,
            errors: {
              notRelatedName: {
                message: 'resolver error',
              },
            },
          };
        });

        render(<Component resolver={resolver} mode="onChange" />);

        methods.formState.isValid;

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: 'test' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBeTruthy());
        expect(screen.getByRole('alert').textContent).toBe('');

        fireEvent.input(screen.getByRole('textbox'), {
          target: { name: 'test', value: '' },
        });

        await waitFor(() => expect(methods.formState.isValid).toBeFalsy());
        expect(resolver).toHaveBeenCalled();
        expect(screen.getByRole('alert').textContent).toBe('');
      });

      it("should call the resolver with the field being validated when an input's value change", async () => {
        const resolver = jest.fn((values: any) => ({ values, errors: {} }));
        const onSubmit = jest.fn();

        render(
          <Component resolver={resolver} onSubmit={onSubmit} mode="onChange" />,
        );

        expect(await screen.findByText('valid')).toBeVisible();

        const input = screen.getByRole('textbox');

        expect(resolver).toHaveBeenCalledWith(
          {
            test: '',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );

        resolver.mockClear();

        fireEvent.input(input, {
          target: { name: 'test', value: 'test' },
        });

        expect(await screen.findByText('dirty')).toBeVisible();

        expect(resolver).toHaveBeenCalledWith(
          {
            test: 'test',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );

        resolver.mockClear();

        fireEvent.click(screen.getByText(/button/i));

        await waitFor(() => expect(onSubmit).toHaveBeenCalled());

        expect(resolver).toHaveBeenCalledWith(
          {
            test: 'test',
          },
          undefined,
          {
            criteriaMode: undefined,
            fields: {
              test: {
                mount: true,
                name: 'test',
                ref: input,
              },
            },
            names: ['test'],
            shouldUseNativeValidation: undefined,
          },
        );
      });

      it('should call the resolver with the field being validated when `trigger` is called', async () => {
        const resolver = jest.fn((values: any) => ({ values, errors: {} }));
        const defaultValues = { test: { sub: 'test' }, test1: 'test1' };

        const { result } = renderHook(() =>
          useForm<typeof defaultValues>({
            mode: VALIDATION_MODE.onChange,
            resolver,
            defaultValues,
          }),
        );

        expect(resolver).not.toHaveBeenCalled();

        await act(async () => {
          await result.current.register('test.sub');
          await result.current.register('test1');
        });

        await act(async () => {
          result.current.trigger('test.sub');
        });

        const fields = {
          test: {
            sub: {
              mount: true,
              name: 'test.sub',
              ref: { name: 'test.sub' },
            },
          },
          test1: {
            mount: true,
            name: 'test1',
            ref: {
              name: 'test1',
            },
          },
        };

        expect(resolver).toHaveBeenCalledWith(defaultValues, undefined, {
          criteriaMode: undefined,
          fields: { test: fields.test },
          names: ['test.sub'],
        });

        await act(async () => {
          result.current.trigger();
        });

        expect(resolver).toHaveBeenNthCalledWith(2, defaultValues, undefined, {
          criteriaMode: undefined,
          fields,
          names: ['test.sub', 'test1'],
        });

        await act(async () => {
          result.current.trigger(['test.sub', 'test1']);
        });

        expect(resolver).toHaveBeenNthCalledWith(3, defaultValues, undefined, {
          criteriaMode: undefined,
          fields,
          names: ['test.sub', 'test1'],
        });
      });
    });
  });

  describe('when mode or reValidateMode changes', () => {
    it('should use updated mode and reValidateMode inside of onChange handler', async () => {
      const resolver = jest.fn(async (data: any) => ({
        values: data,
        errors: {},
      }));
      const Form = () => {
        const [mode, setMode] = React.useState<Mode>('onChange');
        const [reValidateMode, setReValidateMode] =
          React.useState<Exclude<Mode, 'onTouched' | 'all'>>('onBlur');
        const { register, handleSubmit } = useForm<{ test: string }>({
          mode,
          reValidateMode,
          resolver,
        });
        return (
          <form onSubmit={handleSubmit(noop)}>
            <input {...register('test')} type="text" />
            <button
              type="button"
              onClick={() => {
                setMode('onTouched');
                setReValidateMode('onChange');
              }}
            >
              Update Validation Mode
            </button>
            <input type="submit" />
          </form>
        );
      };

      render(<Form />);

      fireEvent.click(
        screen.getByRole('button', { name: /update validation mode/i }),
      );

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });
      expect(resolver).toHaveBeenCalledTimes(0);

      fireEvent.blur(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });
      expect(resolver).toHaveBeenCalledTimes(1);

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test1',
        },
      });
      expect(resolver).toHaveBeenCalledTimes(2);

      fireEvent.click(screen.getByRole('button', { name: /submit/i }));
      await waitFor(() => expect(resolver).toHaveBeenCalledTimes(3));

      fireEvent.blur(screen.getByRole('textbox'), {
        target: {
          value: 'test1',
        },
      });
      expect(resolver).toHaveBeenCalledTimes(3);

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test12',
        },
      });
      expect(resolver).toHaveBeenCalledTimes(4);
    });
  });

  describe('updateValid', () => {
    it('should be called resolver with default values if default value is defined', async () => {
      type FormValues = {
        test: string;
      };

      const resolver = jest.fn(async (data: FormValues) => {
        return {
          values: data,
          errors: {},
        };
      });

      const { result } = renderHook(() =>
        useForm<FormValues>({
          resolver,
          defaultValues: { test: 'default' },
        }),
      );

      const { ref } = result.current.register('test');

      isFunction(ref) &&
        ref({
          target: {
            value: '',
          },
        });

      await act(async () => {
        await result.current.trigger();
      });

      expect(resolver).toHaveBeenCalledWith(
        {
          test: 'default',
        },
        undefined,
        {
          criteriaMode: undefined,
          fields: {
            test: {
              mount: true,
              name: 'test',
              ref: {
                target: {
                  value: '',
                },
                value: 'default',
              },
            },
          },
          names: ['test'],
        },
      );
    });

    it('should be called resolver with field values if value is undefined', async () => {
      type FormValues = {
        test: string;
      };

      const resolver = jest.fn(async (data: FormValues) => {
        return {
          values: data,
          errors: {},
        };
      });

      const { result } = renderHook(() =>
        useForm<FormValues>({
          resolver,
        }),
      );

      result.current.register('test');

      result.current.setValue('test', 'value');

      result.current.trigger();

      expect(resolver).toHaveBeenCalledWith({ test: 'value' }, undefined, {
        criteriaMode: undefined,
        fields: {
          test: {
            mount: true,
            name: 'test',
            ref: { name: 'test', value: 'value' },
          },
        },
        names: ['test'],
      });
    });
  });

  describe('mode with onTouched', () => {
    it('should validate form only when input is been touched', async () => {
      const Component = () => {
        const {
          register,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          mode: 'onTouched',
        });

        return (
          <>
            <input
              type="text"
              {...register('test', { required: 'This is required.' })}
            />
            {errors.test?.message}
          </>
        );
      };

      render(<Component />);

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      fireEvent.blur(input);

      expect(await screen.findByText('This is required.')).toBeVisible();

      fireEvent.input(input, {
        target: {
          value: 'test',
        },
      });

      await waitFor(() =>
        expect(screen.queryByText('This is required.')).not.toBeInTheDocument(),
      );

      fireEvent.input(input, {
        target: {
          value: '',
        },
      });

      expect(await screen.findByText('This is required.')).toBeVisible();
    });

    it('should validate onFocusout event', async () => {
      const Component = () => {
        const {
          register,
          formState: { errors },
        } = useForm<{
          test: string;
        }>({
          mode: 'onTouched',
        });

        return (
          <>
            <input
              type="text"
              {...register('test', { required: 'This is required.' })}
            />
            {errors.test?.message}
          </>
        );
      };

      render(<Component />);

      const input = screen.getByRole('textbox');

      fireEvent.focus(input);

      fireEvent.focusOut(input);

      expect(await screen.findByText('This is required.')).toBeVisible();

      fireEvent.input(input, {
        target: {
          value: 'test',
        },
      });

      await waitFor(() =>
        expect(screen.queryByText('This is required.')).not.toBeInTheDocument(),
      );

      fireEvent.input(input, {
        target: {
          value: '',
        },
      });

      expect(await screen.findByText('This is required.')).toBeVisible();
    });
  });

  describe('with schema validation', () => {
    it('should trigger and clear errors for group errors object', async () => {
      let errorsObject = {};

      const Component = () => {
        const {
          formState: { errors },
          register,
          handleSubmit,
        } = useForm<{
          checkbox: string[];
        }>({
          mode: 'onChange',
          resolver: (data) => {
            return {
              errors: {
                ...(data.checkbox.every((value) => !value)
                  ? { checkbox: { type: 'error', message: 'wrong' } }
                  : {}),
              },
              values: {},
            };
          },
        });
        errorsObject = errors;

        return (
          <form onSubmit={handleSubmit(noop)}>
            {[1, 2, 3].map((value, index) => (
              <div key={`test.${index}`}>
                <label
                  htmlFor={`checkbox.${index}`}
                >{`checkbox.${index}`}</label>
                <input
                  type={'checkbox'}
                  key={index}
                  id={`checkbox.${index}`}
                  {...register(`checkbox.${index}` as const)}
                  value={value}
                />
              </div>
            ))}

            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: { type: 'error', message: 'wrong' },
        }),
      );

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() => expect(errorsObject).toEqual({}));

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: { type: 'error', message: 'wrong' },
        }),
      );

      fireEvent.click(screen.getByLabelText('checkbox.0'));

      await waitFor(() => expect(errorsObject).toEqual({}));
    });

    it('should not clear errors for non checkbox parent inputs', async () => {
      let errorsObject = {};

      const Component = () => {
        const {
          formState: { errors },
          register,
          handleSubmit,
        } = useForm<{
          checkbox: [{ test: string }, { test1: string }];
        }>({
          mode: 'onChange',
          resolver: (data) => {
            return {
              errors: {
                ...(!data.checkbox[0].test || !data.checkbox[1].test1
                  ? {
                      checkbox: [
                        {
                          ...(!data.checkbox[0].test
                            ? { test: { type: 'error', message: 'wrong' } }
                            : {}),
                          ...(!data.checkbox[1].test1
                            ? { test1: { type: 'error', message: 'wrong' } }
                            : {}),
                        },
                      ],
                    }
                  : {}),
              },
              values: {},
            };
          },
        });
        errorsObject = errors;

        return (
          <form onSubmit={handleSubmit(noop)}>
            <input type={'checkbox'} {...register(`checkbox.0.test`)} />

            <input {...register(`checkbox.1.test1`)} />
            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: [
            {
              test: { type: 'error', message: 'wrong' },
              test1: { type: 'error', message: 'wrong' },
            },
          ],
        }),
      );

      fireEvent.click(screen.getByRole('checkbox'));

      fireEvent.click(screen.getByRole('button'));

      await waitFor(() =>
        expect(errorsObject).toEqual({
          checkbox: [
            {
              test1: { type: 'error', message: 'wrong' },
            },
          ],
        }),
      );
    });

    it('should have formState.isValid equals true with defined default values after executing resolver', async () => {
      const Toggle = () => {
        const [toggle, setToggle] = React.useState(false);

        const { register, formState } = useForm({
          defaultValues: { test: 'Test' },
          mode: 'onChange',
          resolver: async (
            values,
          ): Promise<ResolverResult<{ test: string }>> => {
            if (!values.test) {
              return {
                values: {},
                errors: {
                  test: {
                    type: 'required',
                  },
                },
              };
            }

            return {
              values,
              errors: {},
            };
          },
        });

        return (
          <>
            <button onClick={() => setToggle(!toggle)}>Toggle</button>
            {toggle && <input id="test" {...register('test')} />}
            <button disabled={!formState.isValid}>Submit</button>
          </>
        );
      };

      render(<Toggle />);

      const toggle = () => fireEvent.click(screen.getByText('Toggle'));

      toggle();

      await waitFor(() => expect(screen.getByText('Submit')).toBeEnabled());

      toggle();
      toggle();

      expect(screen.getByText('Submit')).toBeEnabled();
    });
  });

  describe('control', () => {
    it('does not change across re-renders', () => {
      let control;

      const Component = () => {
        const form = useForm<{
          test: string;
        }>();

        control = form.control;

        return (
          <>
            <input type="text" {...form.register('test')} />
          </>
        );
      };

      const { rerender } = render(<Component />);

      const firstRenderControl = control;

      rerender(<Component />);

      const secondRenderControl = control;

      expect(Object.is(firstRenderControl, secondRenderControl)).toBe(true);
    });
  });

  describe('when input is not registered', () => {
    it('trigger should not throw warn', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      await act(async () =>
        expect(await result.current.trigger('test')).toBeTruthy(),
      );
    });
  });

  it('should update isValidating form and field states correctly', async () => {
    jest.useFakeTimers();

    let formState = {} as FormState<FieldValues>;
    let getFieldState = {} as UseFormGetFieldState<FieldValues>;
    const App = () => {
      const [stateValidation, setStateValidation] = React.useState(false);
      const {
        register,
        formState: tmpFormState,
        getFieldState: tmpGetFieldState,
      } = useForm({ mode: 'all' });
      formState = tmpFormState;
      getFieldState = tmpGetFieldState;

      formState.isValidating;

      return (
        <div>
          <p>stateValidation: {String(stateValidation)}</p>
          <form>
            <input
              {...register('lastName', {
                required: true,
                validate: () => {
                  setStateValidation(true);
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      setStateValidation(false);
                      resolve(true);
                    }, 5000);
                  });
                },
              })}
              placeholder="async"
            />

            <input
              {...register('firstName', { required: true })}
              placeholder="required"
            />
          </form>
        </div>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByPlaceholderText('required'), {
      target: { value: 'test' },
    });

    expect(formState.isValidating).toBe(true);
    expect(formState.validatingFields).toStrictEqual({
      lastName: true,
      firstName: true,
    });
    expect(getFieldState('lastName').isValidating).toBe(true);
    expect(getFieldState('firstName').isValidating).toBe(true);
    screen.getByText('stateValidation: true');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(formState.isValidating).toBe(true);
    expect(formState.validatingFields).toStrictEqual({
      lastName: true,
    });
    expect(getFieldState('lastName').isValidating).toBe(true);
    expect(getFieldState('firstName').isValidating).toBe(false);
    screen.getByText('stateValidation: true');

    await act(async () => {
      jest.advanceTimersByTime(4000);
    });

    expect(formState.isValidating).toBe(false);
    expect(formState.validatingFields).toStrictEqual({});
    expect(getFieldState('lastName').isValidating).toBe(false);
    expect(getFieldState('firstName').isValidating).toBe(false);
    screen.getByText('stateValidation: false');
  });

  it('should update isValidating without subscribing to validatingFields', async () => {
    const App = () => {
      const {
        register,
        handleSubmit,
        formState: { isValidating },
      } = useForm();

      return (
        <form onSubmit={handleSubmit(noop)}>
          {isValidating && <p>is validating</p>}
          <input
            {...register('firstName', {
              validate: {
                asyncMinLengthValidator: async (value) => {
                  await sleep(2000);
                  return value.length > 3;
                },
                customMinLength: (value) => value.length > 1,
              },
              required: true,
            })}
            placeholder="First name"
          />
          <input type="submit" />
        </form>
      );
    };

    render(<App />);

    fireEvent.input(screen.getByPlaceholderText('First name'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText('is validating')).toBeVisible();
    });

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(screen.queryByText('is validating')).not.toBeInTheDocument();
    });
  });

  it('should correctly handle multiple async validation triggers', async () => {
    jest.useFakeTimers();

    let formState = {} as FormState<FieldValues>;
    let getFieldState = {} as UseFormGetFieldState<FieldValues>;
    const App = () => {
      const [stateValidation, setStateValidation] = React.useState(false);
      const {
        register,
        formState: tmpFormState,
        getFieldState: tmpGetFieldState,
      } = useForm({ mode: 'onChange' });
      formState = tmpFormState;
      getFieldState = tmpGetFieldState;

      formState.validatingFields;
      formState.isDirty;

      return (
        <div>
          <p>stateValidation: {String(stateValidation)}</p>
          <form>
            <input
              {...register('lastName', {
                required: true,
                validate: () => {
                  setStateValidation(true);
                  return new Promise((resolve) => {
                    setTimeout(() => {
                      setStateValidation(false);
                      resolve(true);
                    }, 2000);
                  });
                },
              })}
              placeholder="async"
            />
          </form>
        </div>
      );
    };

    render(<App />);

    expect(formState.validatingFields).toStrictEqual({});
    expect(formState.isDirty).toStrictEqual(false);
    expect(formState.dirtyFields).toStrictEqual({});
    expect(getFieldState('lastName').isDirty).toStrictEqual(false);

    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test' },
    });

    expect(formState.isDirty).toStrictEqual(true);
    expect(formState.dirtyFields).toStrictEqual({ lastName: true });
    expect(getFieldState('lastName').isDirty).toStrictEqual(true);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(formState.validatingFields).toStrictEqual({ lastName: true });

    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test1' },
    });

    expect(formState.validatingFields).toStrictEqual({ lastName: true });
    expect(getFieldState('lastName').isValidating).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(formState.validatingFields).toStrictEqual({});
    expect(getFieldState('lastName').isValidating).toBe(false);
  });

  it('should update isValidating to true when using with resolver', async () => {
    jest.useFakeTimers();

    let formState = {} as FormState<FieldValues>;
    let getFieldState = {} as UseFormGetFieldState<FieldValues>;
    const App = () => {
      const {
        register,
        formState: tmpFormState,
        getFieldState: tmpGetFieldState,
      } = useForm<{
        firstName: string;
        lastName: string;
      }>({
        mode: 'all',
        defaultValues: {
          lastName: '',
          firstName: '',
        },
        resolver: async () => {
          await sleep(2000);

          return {
            errors: {},
            values: {},
          };
        },
      });
      getFieldState = tmpGetFieldState;
      formState = tmpFormState;

      formState.isValidating;

      return (
        <div>
          <input {...register('lastName')} placeholder="async" />
          <input {...register('firstName')} placeholder="required" />
        </div>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test' },
    });
    fireEvent.change(screen.getByPlaceholderText('async'), {
      target: { value: 'test1' },
    });
    fireEvent.change(screen.getByPlaceholderText('required'), {
      target: { value: 'test2' },
    });
    fireEvent.change(screen.getByPlaceholderText('required'), {
      target: { value: 'test3' },
    });

    expect(formState.isValidating).toBe(true);
    expect(formState.validatingFields).toStrictEqual({
      lastName: true,
      firstName: true,
    });
    expect(getFieldState('lastName').isValidating).toBe(true);
    expect(getFieldState('firstName').isValidating).toBe(true);

    await act(async () => {
      jest.runAllTimers();
    });

    expect(formState.isValidating).toBe(false);
    expect(formState.validatingFields).toStrictEqual({});
    expect(getFieldState('lastName').isValidating).toBe(false);
    expect(getFieldState('firstName').isValidating).toBe(false);
  });

  it('should remove field from validatingFields on unregister', async () => {
    jest.useFakeTimers();
    let unregister: UseFormUnregister<FieldValues>;
    let formState = {} as FormState<FieldValues>;
    const App = () => {
      const {
        register,
        unregister: tmpUnregister,
        formState: tmpFormState,
      } = useForm({ mode: 'all' });
      unregister = tmpUnregister;
      formState = tmpFormState;

      formState.validatingFields;

      return (
        <div>
          <form>
            <input
              {...register('firstName', {
                required: true,
              })}
              placeholder="firstName"
            />
          </form>
        </div>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText('firstName'), {
      target: { value: 'test' },
    });

    expect(formState.validatingFields).toEqual({ firstName: true });
    await act(async () => {
      unregister('firstName');
      jest.runAllTimers();
    });
    expect(formState.validatingFields).toEqual({});
  });

  it('should update defaultValues async', async () => {
    const App = () => {
      const {
        register,
        formState: { isLoading },
      } = useForm<{
        test: string;
      }>({
        defaultValues: async () => {
          await sleep(100);

          return {
            test: 'test',
          };
        },
      });

      return (
        <form>
          <input {...register('test')} />
          <p>{isLoading ? 'loading...' : 'done'}</p>
        </form>
      );
    };

    render(<App />);

    await waitFor(() => {
      screen.getByText('loading...');
    });

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
        'test',
      );
    });

    await waitFor(() => {
      screen.getByText('done');
    });
  });

  it('should update async default values for controlled components', async () => {
    const App = () => {
      const { control } = useForm<{
        test: string;
      }>({
        defaultValues: async () => {
          await sleep(100);

          return {
            test: 'test',
          };
        },
      });

      return (
        <form>
          <Controller
            control={control}
            render={({ field }) => <input {...field} />}
            defaultValue=""
            name={'test'}
          />
        </form>
      );
    };

    render(<App />);

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
        'test',
      );
    });
  });

  it('should update async form values', async () => {
    type FormValues = {
      test: string;
    };

    function Loader() {
      const [values, setValues] = React.useState<FormValues>({
        test: '',
      });

      const loadData = React.useCallback(async () => {
        await sleep(100);

        setValues({
          test: 'test',
        });
      }, []);

      React.useEffect(() => {
        loadData();
      }, [loadData]);

      return <App values={values} />;
    }

    const App = ({ values }: { values: FormValues }) => {
      const { register } = useForm({
        values,
      });

      return (
        <form>
          <input {...register('test')} />
        </form>
      );
    };

    render(<Loader />);

    await waitFor(() => {
      expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
        'test',
      );
    });
  });

  it('should submit mounted values from values prop when shouldUnregister is true', async () => {
    const onSubmit = jest.fn();
    const onInvalid = jest.fn();

    const App = () => {
      const { register, handleSubmit } = useForm<{
        firstName: string;
        age: string;
      }>({
        values: {
          firstName: 'test',
          age: '',
        },
        shouldUnregister: true,
      });

      return (
        <form onSubmit={handleSubmit(onSubmit, onInvalid)}>
          <input {...register('firstName', { required: true })} />
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    expect(screen.getByRole('textbox')).toHaveValue('test');

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          firstName: 'test',
        },
        expect.anything(),
      ),
    );
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('should use values prop over defaultValues with shouldUnregister and Controller (#12697)', async () => {
    const App = () => {
      const { control, handleSubmit } = useForm<{
        firstName: string;
      }>({
        shouldUnregister: true,
        defaultValues: {
          firstName: '1',
        },
        values: {
          firstName: '2',
        },
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <Controller
            name="firstName"
            control={control}
            render={({ field }) => <input {...field} />}
          />
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('2');
    });
  });

  it('should only update async form values which are not interacted', async () => {
    type FormValues = {
      test: string;
      test1: string;
    };

    function Loader() {
      const [values, setValues] = React.useState<FormValues>({
        test: '',
        test1: '',
      });

      const loadData = React.useCallback(async () => {
        await sleep(100);

        setValues({
          test: 'test',
          test1: 'data',
        });
      }, []);

      React.useEffect(() => {
        loadData();
      }, [loadData]);

      return <App values={values} />;
    }

    const App = ({ values }: { values: FormValues }) => {
      const { register } = useForm({
        values,
        resetOptions: {
          keepDirtyValues: true,
        },
      });

      return (
        <form>
          <input {...register('test')} />
          <input {...register('test1')} />
        </form>
      );
    };

    render(<Loader />);

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: {
        value: 'test1',
      },
    });

    await waitFor(() => {
      expect(
        (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
      ).toEqual('test1');
    });

    await waitFor(() => {
      expect(
        (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
      ).toEqual('data');
    });
  });

  it('should not update isLoading when literal defaultValues are provided', async () => {
    const { result } = renderHook(() =>
      useForm({ defaultValues: { test: 'default' } }),
    );

    expect(result.current.formState.isLoading).toBe(false);
  });

  it('should update form values when values updates even with the same values', async () => {
    type FormValues = {
      firstName: string;
    };

    function App() {
      const [firstName, setFirstName] = React.useState('C');
      const values = React.useMemo(() => ({ firstName }), [firstName]);

      const {
        register,
        formState: { isDirty },
        watch,
      } = useForm<FormValues>({
        defaultValues: {
          firstName: 'C',
        },
        values,
        resetOptions: { keepDefaultValues: true },
      });
      const formValues = watch();

      return (
        <form>
          <button type="button" onClick={() => setFirstName('A')}>
            1
          </button>
          <button type="button" onClick={() => setFirstName('B')}>
            2
          </button>
          <button type="button" onClick={() => setFirstName('C')}>
            3
          </button>
          <input {...register('firstName')} placeholder="First Name" />
          <p>{isDirty ? 'dirty' : 'pristine'}</p>
          <p>{formValues.firstName}</p>
          <input type="submit" />
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: '1' }));

    await waitFor(() => {
      screen.getByText('A');
      screen.getByText('dirty');
    });

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      screen.getByText('B');
      screen.getByText('dirty');
    });

    fireEvent.click(screen.getByRole('button', { name: '3' }));

    await waitFor(() => {
      screen.getByText('C');
      screen.getByText('pristine');
    });
  });

  it('should update form values when rerendered values reuse an object reference', async () => {
    type FormValues = {
      home: { street: string };
      work: { street: string };
    };

    const { result, rerender } = renderHook(
      ({ values }: { values: FormValues }) => useForm<FormValues>({ values }),
      {
        initialProps: {
          values: { home: { street: 'a' }, work: { street: 'b' } },
        },
      },
    );

    expect(result.current.getValues('work.street')).toBe('b');

    const shared = { street: 'a' };
    rerender({ values: { home: shared, work: shared } });

    expect(result.current.getValues('work.street')).toBe('a');
  });

  it('should keep defaultValues if set keep default values is true on reset option', async () => {
    type FormValues = {
      firstName: string;
    };

    function App() {
      const { register, formState } = useForm<FormValues>({
        defaultValues: {
          firstName: 'Alex',
        },
        values: {
          firstName: 'John',
        },
        resetOptions: { keepDefaultValues: true },
      });

      return (
        <form>
          <input {...register('firstName')} placeholder="First Name" />
          <div>{String(formState.isDirty)}</div>
          <input type="submit" />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'John' },
    });

    screen.getByText('true');

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Alex' },
    });

    screen.getByText('false');
  });

  it('should change defaultValues if not reset options presented', async () => {
    type FormValues = {
      firstName: string;
    };

    function App() {
      const { register, formState } = useForm<FormValues>({
        defaultValues: {
          firstName: 'Alex',
        },
        values: {
          firstName: 'John',
        },
      });

      return (
        <form>
          <input {...register('firstName')} placeholder="First Name" />
          <div>{String(formState.isDirty)}</div>
          <input type="submit" />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Alex' },
    });

    screen.getByText('true');

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'John' },
    });

    screen.getByText('false');
  });

  it('should disable the entire form inputs', async () => {
    function App() {
      const { register } = useForm({
        disabled: true,
        defaultValues: {
          lastName: '',
          firstName: '',
        },
      });

      return (
        <form>
          <input {...register('firstName')} placeholder="firstName" />
          <input {...register('lastName')} placeholder="lastName" />
        </form>
      );
    }

    render(<App />);

    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('firstName') as HTMLInputElement).disabled,
      ).toBeTruthy();
      expect(
        (screen.getByPlaceholderText('lastName') as HTMLInputElement).disabled,
      ).toBeTruthy();
    });
  });

  it('should disable the entire form', () => {
    const App = () => {
      const [disabled, setDisabled] = useState(false);
      const { register, control } = useForm({
        disabled,
      });

      return (
        <form>
          <input
            type={'checkbox'}
            {...register('checkbox')}
            data-testid={'checkbox'}
          />
          <input type={'radio'} {...register('radio')} data-testid={'radio'} />
          <input type={'range'} {...register('range')} data-testid={'range'} />
          <select {...register('select')} data-testid={'select'} />
          <textarea {...register('textarea')} data-testid={'textarea'} />

          <Controller
            control={control}
            render={({ field }) => {
              return (
                <input disabled={field.disabled} data-testid={'controller'} />
              );
            }}
            name="test"
          />

          <button
            type="button"
            onClick={() => {
              setDisabled(!disabled);
            }}
          >
            Submit
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByTestId('checkbox')).toHaveAttribute('disabled');
    expect(screen.getByTestId('radio')).toHaveAttribute('disabled');
    expect(screen.getByTestId('range')).toHaveAttribute('disabled');
    expect(screen.getByTestId('select')).toHaveAttribute('disabled');
    expect(screen.getByTestId('textarea')).toHaveAttribute('disabled');
    expect(screen.getByTestId('controller')).toHaveAttribute('disabled');

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('checkbox')).not.toBeDisabled();
    expect(screen.getByTestId('radio')).not.toBeDisabled();
    expect(screen.getByTestId('range')).not.toBeDisabled();
    expect(screen.getByTestId('select')).not.toBeDisabled();
    expect(screen.getByTestId('textarea')).not.toBeDisabled();
    expect(screen.getByTestId('controller')).not.toBeDisabled();
  });

  it('should disable form inputs separately from its form', async () => {
    function App() {
      const { register } = useForm({
        disabled: false,
        defaultValues: {
          lastName: '',
          firstName: '',
        },
      });

      return (
        <form>
          <input
            {...register('firstName', { disabled: true })}
            placeholder="firstName"
          />
          <input
            {...register('lastName', { disabled: false })}
            placeholder="lastName"
          />
        </form>
      );
    }

    render(<App />);

    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('firstName') as HTMLInputElement).disabled,
      ).toBeTruthy();
      expect(
        (screen.getByPlaceholderText('lastName') as HTMLInputElement).disabled,
      ).toBeFalsy();
    });
  });

  it('should be able to disable the entire form', async () => {
    const App = () => {
      const [disabled, setDisabled] = useState(false);
      const { register, handleSubmit } = useForm({
        disabled,
      });

      return (
        <form
          onSubmit={handleSubmit(async () => {
            setDisabled(true);
            await sleep(100);
            setDisabled(false);
          })}
        >
          <input
            type={'checkbox'}
            {...register('checkbox')}
            data-testid={'checkbox'}
          />
          <input type={'radio'} {...register('radio')} data-testid={'radio'} />
          <input type={'range'} {...register('range')} data-testid={'range'} />
          <select {...register('select')} data-testid={'select'} />
          <textarea {...register('textarea')} data-testid={'textarea'} />
          <button>Submit</button>
        </form>
      );
    };

    render(<App />);

    expect(
      (screen.getByTestId('textarea') as HTMLTextAreaElement).disabled,
    ).toBeFalsy();
    expect(
      (screen.getByTestId('range') as HTMLInputElement).disabled,
    ).toBeFalsy();
    expect(
      (screen.getByTestId('select') as HTMLInputElement).disabled,
    ).toBeFalsy();
    expect(
      (screen.getByTestId('textarea') as HTMLInputElement).disabled,
    ).toBeFalsy();

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(
        (screen.getByTestId('textarea') as HTMLTextAreaElement).disabled,
      ).toBeTruthy();
      expect(
        (screen.getByTestId('range') as HTMLInputElement).disabled,
      ).toBeTruthy();
      expect(
        (screen.getByTestId('select') as HTMLInputElement).disabled,
      ).toBeTruthy();
      expect(
        (screen.getByTestId('textarea') as HTMLInputElement).disabled,
      ).toBeTruthy();
    });

    await waitFor(() => {
      expect(
        (screen.getByTestId('textarea') as HTMLTextAreaElement).disabled,
      ).toBeFalsy();
      expect(
        (screen.getByTestId('range') as HTMLInputElement).disabled,
      ).toBeFalsy();
      expect(
        (screen.getByTestId('select') as HTMLInputElement).disabled,
      ).toBeFalsy();
      expect(
        (screen.getByTestId('textarea') as HTMLInputElement).disabled,
      ).toBeFalsy();
    });
  });

  it('should allow submitting a form with disabled form fields', async () => {
    function App() {
      const { register, getFieldState, formState, handleSubmit } = useForm();

      return (
        <form onSubmit={handleSubmit(() => {})}>
          <input
            {...register('firstName', { disabled: true, required: true })}
            placeholder="firstName"
          />
          <p>
            {getFieldState('firstName', formState).error
              ? 'has error'
              : 'no error'}
          </p>
          <input type="submit" value="Submit" />
        </form>
      );
    }

    render(<App />);

    await act(() => {
      fireEvent.click(screen.getByRole('button'));
    });

    await waitFor(() => {
      expect(
        (screen.getByPlaceholderText('firstName') as HTMLInputElement).disabled,
      ).toBeTruthy();
      expect(
        screen.getByText('no error') as HTMLInputElement,
      ).toBeInTheDocument();
    });
  });

  describe('when given formControl', () => {
    it('accepts default values', async () => {
      type FormValues = {
        firstName: string;
      };

      const { register, handleSubmit, formControl } =
        createFormControl<FormValues>();

      function FormComponent({
        onSubmit,
        defaultValues,
      }: {
        defaultValues: FormValues;
        onSubmit: SubmitHandler<FormValues>;
      }) {
        useForm({
          formControl,
          defaultValues,
        });
        return (
          <form onSubmit={handleSubmit(onSubmit)}>
            <input {...register('firstName')} placeholder="First Name" />
            <input type="submit" />
          </form>
        );
      }

      function App() {
        const [state, setState] = React.useState('');
        return (
          <div>
            <FormComponent
              defaultValues={{ firstName: 'Emilia' }}
              onSubmit={(data) => {
                setState(JSON.stringify(data));
              }}
            />
            <pre>{state}</pre>
          </div>
        );
      }

      render(<App />);

      const input = screen.getAllByRole<HTMLInputElement>('textbox')[0];
      expect(input.value).toBe('Emilia');

      fireEvent.input(input, { target: { value: 'abc' } });
      expect(input.value).toBe('abc');
    });

    it('should reset useController value on remount with defaultValues', async () => {
      type FormValues = {
        firstName: string;
        lastName: string;
      };

      const { register, handleSubmit, formControl, control } =
        createFormControl<FormValues>();
      const onSubmit = jest.fn();

      function LastName() {
        const { field } = useController({
          control,
          name: 'lastName',
          rules: { required: true },
        });

        return <input {...field} placeholder="lastName" />;
      }

      function Form({
        onFormSubmit,
      }: {
        onFormSubmit: SubmitHandler<FormValues>;
      }) {
        useForm({
          formControl,
          defaultValues: {
            firstName: '',
            lastName: '',
          },
        });

        return (
          <form onSubmit={handleSubmit(onFormSubmit)}>
            <input {...register('firstName')} placeholder="firstName" />
            <LastName />
            <button type="submit">submit</button>
          </form>
        );
      }

      function App() {
        const [showForm, setShowForm] = React.useState(true);

        return showForm ? (
          <Form
            onFormSubmit={(data) => {
              onSubmit(data);
              setShowForm(false);
            }}
          />
        ) : (
          <button onClick={() => setShowForm(true)}>back</button>
        );
      }

      render(<App />);

      fireEvent.input(screen.getByPlaceholderText('firstName'), {
        target: { value: 'John' },
      });
      fireEvent.input(screen.getByPlaceholderText('lastName'), {
        target: { value: 'Doe' },
      });
      fireEvent.click(screen.getByText('submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenNthCalledWith(1, {
          firstName: 'John',
          lastName: 'Doe',
        });
      });

      fireEvent.click(screen.getByText('back'));
      expect(
        (screen.getByPlaceholderText('lastName') as HTMLInputElement).value,
      ).toBe('');
      fireEvent.click(screen.getByText('submit'));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    });

    it('should re-initialise when formControl prop reference changes (e.g. HMR/Fast Refresh)', async () => {
      type FormValues = {
        firstName: string;
      };

      const onSubmit = jest.fn();

      // Simulate initial module-level createFormControl call
      const { handleSubmit, formControl } = createFormControl<FormValues>({
        defaultValues: { firstName: '' },
      });

      function Form({
        ctrl,
        submit,
      }: {
        ctrl: typeof formControl;
        submit: typeof handleSubmit;
      }) {
        const { register } = useForm({ formControl: ctrl });
        return (
          <form onSubmit={submit(onSubmit)}>
            <input {...register('firstName')} placeholder="firstName" />
            <button type="submit">submit</button>
          </form>
        );
      }

      const { rerender } = render(
        <Form ctrl={formControl} submit={handleSubmit} />,
      );

      // Simulate Fast Refresh: module re-executes, producing new instances
      const next = createFormControl<FormValues>({
        defaultValues: { firstName: '' },
      });

      rerender(<Form ctrl={next.formControl} submit={next.handleSubmit} />);

      fireEvent.input(screen.getByPlaceholderText('firstName'), {
        target: { value: 'Bill' },
      });
      fireEvent.click(screen.getByText('submit'));

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          { firstName: 'Bill' },
          expect.any(Object),
        );
      });
    });
  });

  describe('When using defaultValues', () => {
    function App() {
      type FormValues = {
        firstName: string;
      };

      const [defaults, setDefaults] = React.useState<FormValues>({
        firstName: '1',
      });

      const { control, formState, reset, register } = useForm<FormValues>({
        defaultValues: defaults,
      });

      const { defaultValues: stateDefaults } = useFormState({ control });

      const handleClick = () => {
        const next = { firstName: String(Number(defaults.firstName) + 1) };
        setDefaults(next);
        reset(next);
      };

      return (
        <div>
          <input {...register('firstName')} />
          <button onClick={handleClick}>reset</button>
          <span data-testid="react">{defaults.firstName}</span>
          <span data-testid="form">{formState.defaultValues?.firstName}</span>
          <span data-testid="state">{stateDefaults?.firstName}</span>
        </div>
      );
    }

    it('formState.defaultValues and useFormState().defaultValues should be equal after reset', () => {
      render(<App />);

      fireEvent.click(screen.getByText('reset'));
      fireEvent.click(screen.getByText('reset'));
      fireEvent.click(screen.getByText('reset'));

      const reactValue = screen.getByTestId('react').textContent;
      expect(screen.getByTestId('form').textContent).toBe(reactValue);
      expect(screen.getByTestId('state').textContent).toBe(reactValue);
    });
  });

  describe('form level validation', () => {
    it('should return form level error', async () => {
      const App = () => {
        const {
          register,
          formState: { errors },
          handleSubmit,
        } = useForm({
          validate: ({ formValues }) => {
            if (formValues.firstName) {
              return true;
            }

            return 'required';
          },
          defaultValues: {
            firstName: '',
          },
        });

        return (
          <form onSubmit={handleSubmit(() => {})}>
            <input {...register('firstName')} />
            <p>{errors.form?.message}</p>
            <button>submit</button>
          </form>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      await waitFor(() => expect(screen.getByText('required')).toBeVisible());

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'test' },
      });

      await waitFor(() =>
        expect(screen.queryByText('required')).not.toBeInTheDocument(),
      );
    });

    it('should use error message from object return value', async () => {
      const App = () => {
        const {
          register,
          formState: { errors },
          handleSubmit,
        } = useForm({
          validate: ({ formValues }) => {
            if (formValues.firstName) {
              return true;
            }

            return {
              firstName: {
                message: 'first name is required',
                type: 'required',
              },
            };
          },
          defaultValues: {
            firstName: '',
          },
        });

        return (
          <form onSubmit={handleSubmit(() => {})}>
            <input {...register('firstName')} />
            <p data-testid="msg">{(errors as any).form?.firstName?.message}</p>
            <button>submit</button>
          </form>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      await waitFor(() =>
        expect(screen.getByTestId('msg').textContent).toBe(
          'first name is required',
        ),
      );
    });

    it('should preserve custom error type from object return value', async () => {
      let capturedErrors: any;

      const App = () => {
        const {
          register,
          formState: { errors },
          handleSubmit,
        } = useForm({
          validate: ({ formValues }) => {
            if (formValues.firstName) {
              return true;
            }

            return { firstName: { message: 'err', type: 'customType' } };
          },
          defaultValues: {
            firstName: '',
          },
        });

        capturedErrors = errors;

        return (
          <form onSubmit={handleSubmit(() => {})}>
            <input {...register('firstName')} />
            <button>submit</button>
          </form>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      await waitFor(() =>
        expect((capturedErrors as any).form?.firstName?.type).toBe(
          'customType',
        ),
      );
    });

    it('should clear object return errors when form becomes valid', async () => {
      const App = () => {
        const {
          register,
          formState: { errors },
          handleSubmit,
        } = useForm({
          validate: ({ formValues }) => {
            if (formValues.firstName) {
              return true;
            }

            return { firstName: { message: 'first name is required' } };
          },
          defaultValues: {
            firstName: '',
          },
        });

        return (
          <form onSubmit={handleSubmit(() => {})}>
            <input {...register('firstName')} />
            <p data-testid="msg">{(errors as any).form?.firstName?.message}</p>
            <button>submit</button>
          </form>
        );
      };

      render(<App />);

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      await waitFor(() =>
        expect(screen.getByTestId('msg').textContent).toBe(
          'first name is required',
        ),
      );

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'test' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'submit' }));

      await waitFor(() =>
        expect(screen.getByTestId('msg').textContent).toBe(''),
      );
    });
  });
});
