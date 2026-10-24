import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { Controller } from '../../controller';
import type { Control, FieldErrors, ResolverResult } from '../../types';
import type { Resolver } from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import { useFormState } from '../../useFormState';
import noop from '../../utils/noop';
import sleep from '../../utils/sleep';

describe('resolver', () => {
  it('should update context within the resolver', async () => {
    type FormValues = {
      test: string;
    };

    const App = () => {
      const [test, setTest] = React.useState('');
      const [data, setData] = React.useState({});
      const { handleSubmit } = useForm<FormValues>({
        resolver: (_, context) => {
          return {
            errors: {},
            values: context as FormValues,
          };
        },
        context: {
          test,
        },
      });

      return (
        <>
          <input
            value={test}
            onChange={(e) => {
              setTest(e.target.value);
            }}
          />
          <button onClick={handleSubmit((data) => setData(data))}>Test</button>
          <p>{JSON.stringify(data)}</p>
        </>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'test' },
    });
    fireEvent.click(screen.getByRole('button'));

    expect(
      await screen.findByText('{"test":"test"}', undefined, { timeout: 3000 }),
    ).toBeVisible();
  });

  it('should support resolver schema switching', async () => {
    type FormValues = {
      test: string;
    };

    const fakeResolver =
      (schema: boolean): Resolver<FormValues> =>
      async (): Promise<ResolverResult<FormValues>> => {
        if (schema) {
          return {
            values: { test: 'ok' },
            errors: {},
          };
        }

        return {
          values: {},
          errors: {
            test: {
              type: 'test',
              message: 'wrong',
            },
          },
        };
      };

    const App = () => {
      const [schema, setSchema] = React.useState(false);
      const [submit, setSubmit] = React.useState(false);
      const {
        register,
        handleSubmit,
        formState: { errors },
      } = useForm<FormValues>({
        resolver: fakeResolver(schema),
      });

      return (
        <form
          onSubmit={handleSubmit(() => {
            setSubmit(true);
          })}
        >
          <input {...register('test')} />
          {errors.test && <p>Error</p>}
          {submit && <p>Submitted</p>}
          <button onClick={() => setSchema(!schema)}>Toggle</button>
          <button>Submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Error')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Submitted')).toBeVisible();
  });

  it('should be called with the shouldUseNativeValidation option to true', async () => {
    const test = jest.fn();
    const resolver = (a: any, b: any, c: any) => {
      test(a, b, c);
      return {
        errors: {},
        values: {},
      };
    };

    const App = () => {
      const { register, handleSubmit } = useForm({
        resolver: async (data, context, options) =>
          resolver(data, context, options),
        shouldUseNativeValidation: true,
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <input {...register('test')} />
          <button>Submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(test.mock.calls[0][2]).toEqual(
      expect.objectContaining({ shouldUseNativeValidation: true }),
    );
  });

  it('should avoid the problem of race condition', async () => {
    jest.useFakeTimers();

    type FormValues = {
      test: string;
    };

    const test = jest.fn();
    let errorsObject = {};

    const resolver: Resolver<FormValues> = async (
      a,
      b,
      c,
    ): Promise<ResolverResult<FormValues>> => {
      test(a, b, c);

      if (a.test !== 'OK') {
        await sleep(100);
        return {
          errors: {
            test: {
              type: 'test',
              message: 'wrong',
            },
          },
          values: {},
        };
      }

      return {
        errors: {},
        values: { test: a.test },
      };
    };

    const App = () => {
      const {
        register,
        formState: { errors },
      } = useForm<FormValues>({
        resolver,
        mode: 'onChange',
      });
      errorsObject = errors;

      return (
        <form>
          <input type="text" {...register('test')} />
        </form>
      );
    };

    render(<App />);

    const inputElm = screen.getByRole('textbox');

    fireEvent.change(inputElm, {
      target: {
        value: 'O',
      },
    });

    fireEvent.change(inputElm, {
      target: {
        value: 'OK',
      },
    });

    await act(async () => {
      jest.advanceTimersByTime(200);
    });

    expect(errorsObject).toEqual({});
  });

  it('should submit a transformed value on success', async () => {
    type FormValues = {
      alpha: string;
      beta: string;
    };

    const App = () => {
      const [data, setData] = React.useState(0);
      const { handleSubmit, setValue } = useForm<FormValues, any, number>({
        defaultValues: { alpha: '1', beta: '2' },
        resolver: ({ alpha, beta }) => {
          return {
            values: parseInt(alpha, 10) + parseInt(beta, 10),
            errors: {},
          };
        },
      });

      return (
        <>
          <button onClick={() => setValue('alpha', '9')}>Update</button>
          <button onClick={handleSubmit((data) => setData(data))}>Test</button>
          <p>result: {JSON.stringify(data)}</p>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByText('Update'));
    fireEvent.click(screen.getByText('Test'));

    expect(
      await screen.findByText('result: 11', undefined, { timeout: 3000 }),
    ).toBeVisible();
  });

  it('should submit field errors on failure', async () => {
    type FormValues = {
      alpha: string;
      beta: string;
    };

    const App = () => {
      const [errors, setErrors] = React.useState<
        FieldErrors<FormValues> | undefined
      >(undefined);
      const { handleSubmit, setValue } = useForm<FormValues, any, number>({
        defaultValues: { alpha: '1', beta: '2' },
        resolver: () => {
          return {
            values: {},
            errors: {
              alpha: {
                message: 'alpha is wrong',
                type: 'test',
              },
            },
          };
        },
      });

      return (
        <>
          <button onClick={() => setValue('alpha', '9')}>Update</button>
          <button onClick={handleSubmit(() => {}, setErrors)}>Test</button>
          <p>{errors?.alpha?.message}</p>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByText('Update'));
    fireEvent.click(screen.getByText('Test'));

    expect(
      await screen.findByText('alpha is wrong', undefined, {
        timeout: 3000,
      }),
    ).toBeVisible();
  });

  describe('resolver state batching', () => {
    type FormValues = {
      test: string;
    };

    const createResolver = (): Resolver<FormValues> => async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        values: {},
        errors: {
          test: { type: 'required', message: 'Required' },
        },
      };
    };

    const StateTracker = ({
      control,
      onEmit,
    }: {
      control: any;
      onEmit: (state: { errors: any; isValidating: boolean }) => void;
    }) => {
      const { errors, isValidating } = useFormState({ control });

      React.useEffect(() => {
        onEmit({ errors: { ...errors }, isValidating });
      }, [errors, isValidating, onEmit]);

      return null;
    };

    it('should batch state updates in onChange mode', async () => {
      const stateEmissions: Array<{ errors: any; isValidating: boolean }> = [];

      const App = () => {
        const { register, control } = useForm<FormValues>({
          resolver: createResolver(),
          mode: 'onChange',
        });

        return (
          <form>
            <input {...register('test')} />
            <StateTracker
              control={control}
              onEmit={(state) => stateEmissions.push(state)}
            />
          </form>
        );
      };

      render(<App />);
      stateEmissions.length = 0;

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } });

      await waitFor(() => {
        expect(stateEmissions.some((s) => s.errors.test)).toBe(true);
      });

      // Should be 2 emissions, not 3
      expect(stateEmissions).toHaveLength(2);
      expect(stateEmissions[0]).toEqual({ errors: {}, isValidating: true });
      expect(stateEmissions[1].errors.test).toBeDefined();
      expect(stateEmissions[1].isValidating).toBe(false);
    });

    it('should update isDirty after rapid changes with async resolver', async () => {
      type DirtyState = { isDirty: boolean };
      const dirtyStateEmissions: DirtyState[] = [];

      const App = () => {
        const { register, control } = useForm<FormValues>({
          resolver: createResolver(),
          mode: 'onChange',
          defaultValues: { test: '' },
        });
        const { isDirty } = useFormState({ control });

        React.useEffect(() => {
          dirtyStateEmissions.push({ isDirty });
        }, [isDirty]);

        return <input {...register('test')} />;
      };

      render(<App />);
      dirtyStateEmissions.length = 0;

      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } });
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'ab' },
      });
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'abc' },
      });

      await waitFor(() => {
        expect(dirtyStateEmissions.some(({ isDirty }) => isDirty)).toBe(true);
      });
    });

    it('should propagate isDirty to a separate useFormState subscriber when Controller field.onChange is called twice in the same tick', async () => {
      type FieldValues = { field: string };

      function DirtyStatus({ control }: { control: Control<FieldValues> }) {
        const { isDirty } = useFormState({ control });
        return <p data-testid="dirty">{String(isDirty)}</p>;
      }

      const App = () => {
        const { control } = useForm<FieldValues>({
          resolver: async (data) => ({ values: data, errors: {} }),
          mode: 'onChange',
          defaultValues: { field: 'initial' },
        });

        return (
          <>
            <Controller
              name="field"
              control={control}
              render={({ field }) => (
                <button
                  data-testid="double-change"
                  onClick={() => {
                    field.onChange('value-A');
                    field.onChange('value-B');
                  }}
                >
                  Two Changes
                </button>
              )}
            />
            <DirtyStatus control={control} />
          </>
        );
      };

      render(<App />);
      expect(screen.getByTestId('dirty')).toHaveTextContent('false');

      fireEvent.click(screen.getByTestId('double-change'));

      await waitFor(() =>
        expect(screen.getByTestId('dirty')).toHaveTextContent('true'),
      );
    });

    it('should batch state updates in onBlur mode', async () => {
      const stateEmissions: Array<{ errors: any; isValidating: boolean }> = [];

      const App = () => {
        const { register, control } = useForm<FormValues>({
          resolver: createResolver(),
          mode: 'onBlur',
        });

        return (
          <form>
            <input {...register('test')} />
            <StateTracker
              control={control}
              onEmit={(state) => stateEmissions.push(state)}
            />
          </form>
        );
      };

      render(<App />);
      stateEmissions.length = 0;

      fireEvent.focus(screen.getByRole('textbox'));
      fireEvent.change(screen.getByRole('textbox'), { target: { value: 'a' } });
      fireEvent.blur(screen.getByRole('textbox'));

      await waitFor(() => {
        expect(stateEmissions.some((s) => s.errors.test)).toBe(true);
      });

      // Should be 2 emissions, not 3
      expect(stateEmissions).toHaveLength(2);
      expect(stateEmissions[0]).toEqual({ errors: {}, isValidating: true });
      expect(stateEmissions[1].errors.test).toBeDefined();
      expect(stateEmissions[1].isValidating).toBe(false);
    });

    it('should batch state updates when using trigger', async () => {
      const stateEmissions: Array<{ errors: any; isValidating: boolean }> = [];

      const App = () => {
        const { register, control, trigger } = useForm<FormValues>({
          resolver: createResolver(),
        });

        return (
          <form>
            <input {...register('test')} />
            <StateTracker
              control={control}
              onEmit={(state) => stateEmissions.push(state)}
            />
            <button type="button" onClick={() => trigger('test')}>
              Trigger
            </button>
          </form>
        );
      };

      render(<App />);
      stateEmissions.length = 0;

      fireEvent.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(stateEmissions.some((s) => s.errors.test)).toBe(true);
      });

      // Should be 2 emissions, not 3
      expect(stateEmissions).toHaveLength(2);
      expect(stateEmissions[0]).toEqual({ errors: {}, isValidating: true });
      expect(stateEmissions[1].errors.test).toBeDefined();
      expect(stateEmissions[1].isValidating).toBe(false);
    });

    it('should not cause "Cannot update component while rendering" error with fieldArray and async validation', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const asyncResolver = async (values: any) => {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const errors: any = {};
        if (values.parts) {
          values.parts.forEach((part: any, index: number) => {
            if (!part.name) {
              if (!errors.parts) {
                errors.parts = [];
              }
              errors.parts[index] = { name: { message: 'Required' } };
            }
          });
        }

        return {
          values,
          errors,
        };
      };

      const FormInput = ({ control, name }: any) => {
        const { field } = useController({ control, name });
        return <input {...field} />;
      };

      const TestComponent = () => {
        const [partCount, setPartCount] = React.useState(1);

        const { control, reset } = useForm({
          resolver: asyncResolver,
          mode: 'onChange',
          defaultValues: {
            parts: [{ name: 'Part 1' }],
          },
        });

        const { fields } = useFieldArray({
          control,
          name: 'parts',
        });

        const { isValid } = useFormState({ control });

        React.useEffect(() => {
          if (fields.length < partCount) {
            const newParts = Array.from({ length: partCount }, (_, i) => ({
              name: `Part ${i + 1}`,
            }));
            reset({ parts: newParts });
          }
        }, [partCount, fields.length, reset]);

        return (
          <div>
            <div data-testid="isValid">{isValid ? 'valid' : 'invalid'}</div>
            <div data-testid="fieldsCount">{fields.length}</div>
            {fields.map((field, index) => (
              <FormInput
                key={field.id}
                control={control}
                name={`parts.${index}.name`}
              />
            ))}
            <button onClick={() => setPartCount(10)}>Add Parts</button>
          </div>
        );
      };

      render(<TestComponent />);

      expect(screen.getByTestId('fieldsCount')).toHaveTextContent('1');

      fireEvent.click(screen.getByText('Add Parts'));

      await waitFor(
        () => {
          expect(screen.getByTestId('fieldsCount')).toHaveTextContent('10');
        },
        { timeout: 3000 },
      );

      // Verify no React rendering errors occurred
      const reactErrors = consoleError.mock.calls.filter((call) =>
        call[0]?.toString().includes('Cannot update a component'),
      );

      expect(reactErrors.length).toBe(0);

      consoleError.mockRestore();
    });
  });
});
