import React from 'react';
import {
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { Controller } from '../controller';
import type {
  Control,
  UseFieldArrayReturn,
  UseFormRegister,
  UseFormReturn,
} from '../types';
import { useController } from '../useController';
import { useFieldArray } from '../useFieldArray';
import { useForm } from '../useForm';
import { FormProvider, useFormContext } from '../useFormContext';
import { useWatch } from '../useWatch';
import noop from '../utils/noop';

let i = 0;

jest.mock('../logic/generateId', () => () => String(i++));

describe('useWatch', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should return default value in useForm', () => {
    let method;
    let watched;
    const Component = () => {
      method = useForm<{ test: string }>({ defaultValues: { test: 'test' } });
      watched = useWatch({ control: method.control });
      return <div />;
    };
    render(<Component />);

    expect(watched).toEqual({ test: 'test' });
  });

  it('should return default value in useWatch', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string }>({
        defaultValues: {
          test: 'test',
        },
      });
      return useWatch({
        control,
        name: 'test',
      });
    });

    expect(result.current).toEqual('test');
  });

  it('should return default value for single input', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string; test1: string }>({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });
      return useWatch({
        control,
        name: 'test',
      });
    });

    expect(result.current).toEqual('test');
  });

  it('should return default values for array of inputs', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string; test1: string }>({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });
      return useWatch({
        control,
        name: ['test', 'test1'],
      });
    });

    expect(result.current).toEqual(['test', 'test1']);
  });

  it('should return own default value for single input', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string; test1: string }>({});
      return useWatch({
        control,
        name: 'test',
        defaultValue: 'test',
      });
    });

    expect(result.current).toEqual('test');
  });

  it('should return own default value for array of inputs', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string; test1: string }>({});
      return useWatch({
        control,
        name: ['test', 'test1'],
        defaultValue: {
          test: 'test',
          test1: 'test1',
        },
      });
    });

    expect(result.current).toEqual(['test', 'test1']);
  });

  it('should return default value when name is undefined', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string; test1: string }>({
        defaultValues: {
          test: 'test',
          test1: 'test1',
        },
      });
      return useWatch({
        control,
      });
    });

    expect(result.current).toEqual({ test: 'test', test1: 'test1' });
  });

  it('should return empty array when watch array fields', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string }>();
      return useWatch({
        control,
        name: ['test'],
      });
    });

    expect(result.current).toEqual([undefined]);
  });

  it('should return undefined', () => {
    const { result } = renderHook(() => {
      const { control } = useForm<{ test: string }>();
      return useWatch({
        control,
        name: 'test',
      });
    });

    expect(result.current).toBeUndefined();
  });

  it('should render with FormProvider', () => {
    const Provider = ({ children }: { children: React.ReactNode }) => {
      const methods = useForm<{ test: string }>();
      return <FormProvider {...methods}>{children}</FormProvider>;
    };
    expect(() =>
      renderHook(() => useWatch({ name: 'test' }), {
        wrapper: Provider,
      }),
    ).not.toThrow();
  });

  it('should remove input with shouldUnregister: true and deeply nested', async () => {
    type FormValue = {
      test: string;
    };

    let submitData = {};

    const Child = ({
      control,
      register,
    }: {
      register: UseFormRegister<FormValue>;
      control: Control<FormValue>;
    }) => {
      const show = useWatch({
        control,
        name: 'test',
      });

      return <>{show && show !== 'test' && <input {...register('test')} />}</>;
    };

    const Component = () => {
      const { register, control, handleSubmit } = useForm<FormValue>({
        defaultValues: {
          test: 'bill',
        },
        shouldUnregister: true,
      });

      return (
        <form
          onSubmit={handleSubmit((data) => {
            submitData = data;
          })}
        >
          <Child control={control} register={register} />
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'test' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(submitData).toEqual({});
  });

  it('should return defaultValue with shouldUnregister set to true and keepDefaultValues', () => {
    const output: unknown[] = [];

    function App() {
      const { register, reset, control } = useForm({
        defaultValues: { test: 'test' },
        shouldUnregister: true,
      });
      const inputs = useWatch({ control });

      output.push(inputs);

      return (
        <form>
          <input {...register('test')} />
          <button
            type="button"
            onClick={() => reset(undefined, { keepDefaultValues: true })}
          >
            Reset
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'test' },
    });

    fireEvent.click(screen.getByRole('button'));

    expect(output).toEqual([
      { test: 'test' },
      { test: 'test' },
      { test: 'test' },
      { test: 'test' },
      { test: 'test' },
      { test: 'test' },
    ]);
  });

  it('should subscribe to exact input change', () => {
    const App = () => {
      const { control, register } = useForm();
      const value = useWatch({
        name: 'test',
        control,
        exact: true,
        defaultValue: 'test',
      });

      return (
        <div>
          <input {...register('test.0.data')} />
          <p>{value}</p>
        </div>
      );
    };

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '1234',
      },
    });

    expect(screen.getByText('test')).toBeVisible();
  });

  it('should return root object subscription', () => {
    function App() {
      const { register, control } = useForm({
        defaultValues: { field: { firstName: 'value' } },
      });
      const field = useWatch({ control, name: 'field' });

      return (
        <div>
          <form>
            <input {...register('field.firstName')} placeholder="First Name" />
            <p>{field.firstName}</p>
          </form>
        </div>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '123',
      },
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '234',
      },
    });

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '345',
      },
    });

    expect(screen.getByText('345')).toBeVisible();
  });

  it('should avoid triggering extra callbacks', () => {
    const onChange = jest.fn();
    type FormInputs = {
      firstName: string;
    };

    const App = () => {
      const {
        register,
        formState: { errors },
        clearErrors,
        watch,
      } = useForm<FormInputs>();

      React.useEffect(() => {
        const unsubscribe = watch(onChange)?.unsubscribe;
        return () => unsubscribe?.();
      }, [watch]);

      return (
        <form>
          <label>First Name</label>
          <input type="text" {...register('firstName', { required: true })} />
          {errors.firstName && <p>This Field is Required</p>}

          <button type="button" onClick={() => clearErrors('firstName')}>
            Clear First Name Errors
          </button>
          <button type="button" onClick={() => clearErrors()}>
            Clear All Errors
          </button>
          <input type="submit" />
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByText('Clear All Errors'));
    expect(onChange).toHaveBeenCalledTimes(0);
  });

  describe('when disabled prop is used', () => {
    it('should be able to disabled subscription and started with true', async () => {
      type FormValues = {
        test: string;
      };

      const ChildComponent = ({
        control,
      }: {
        control: Control<FormValues>;
      }) => {
        const [disabled, setDisabled] = React.useState(true);
        const test = useWatch({
          control,
          name: 'test',
          disabled,
        });

        return (
          <div>
            <p>{test}</p>
            <button
              onClick={() => {
                setDisabled(!disabled);
              }}
              type={'button'}
            >
              toggle
            </button>
          </div>
        );
      };

      const App = () => {
        const { register, control } = useForm<FormValues>({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <div>
            <input {...register('test')} />
            <ChildComponent control={control} />
          </div>
        );
      };

      render(<App />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what',
        },
      });

      expect(screen.getByText('test')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what12345',
        },
      });

      expect(screen.getByText('what12345')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: '12345',
        },
      });

      expect(screen.getByText('what12345')).toBeVisible();
    });

    it('should be able to toggle the subscription and started with false', async () => {
      type FormValues = {
        test: string;
      };

      const ChildComponent = ({
        control,
      }: {
        control: Control<FormValues>;
      }) => {
        const [disabled, setDisabled] = React.useState(false);
        const test = useWatch({
          control,
          name: 'test',
          disabled,
        });

        return (
          <div>
            <p>{test}</p>
            <button
              onClick={() => {
                setDisabled(!disabled);
              }}
              type={'button'}
            >
              toggle
            </button>
          </div>
        );
      };

      const WatchApp = () => {
        const { register, control } = useForm<FormValues>({
          defaultValues: {
            test: 'test',
          },
        });

        return (
          <div>
            <input {...register('test')} />
            <ChildComponent control={control} />
          </div>
        );
      };

      render(<WatchApp />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what',
        },
      });

      expect(screen.getByText('what')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      fireEvent.change(screen.getByRole('textbox'), {
        target: {
          value: 'what12345',
        },
      });

      expect(screen.getByText('what')).toBeVisible();
    });
  });

  describe('update', () => {
    it('should partial re-render', async () => {
      type FormInputs = {
        child: string;
        parent: string;
      };

      let childCount = 0;
      const Child = ({
        register,
        control,
      }: Pick<UseFormReturn<FormInputs>, 'register' | 'control'>) => {
        useWatch({ name: 'child', control });
        childCount++;
        return <input {...register('child')} />;
      };

      let parentCount = 0;
      const Parent = () => {
        const {
          register,
          handleSubmit,
          control,
          formState: { errors },
        } = useForm<FormInputs>();
        parentCount++;
        return (
          <form onSubmit={handleSubmit(noop)}>
            <>
              <input {...register('parent')} />
              <Child register={register} control={control} />
              <p>{String(errors?.parent)}</p>
              <button>submit</button>
            </>
          </form>
        );
      };

      render(<Parent />);

      const childInput = screen.getAllByRole('textbox')[1];

      fireEvent.input(childInput, {
        target: { value: 'test' },
      });

      expect(parentCount).toBe(2);
      expect(childCount).toBe(3);

      parentCount = 0;
      childCount = 0;

      fireEvent.submit(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(parentCount).toBe(1));
      expect(childCount).toBe(1);

      parentCount = 0;
      childCount = 0;

      fireEvent.input(childInput, { target: { value: 'test1' } });

      expect(parentCount).toBe(0);
      expect(childCount).toBe(1);
    });

    it('should partial re-render with array name and exact option', async () => {
      type FormInputs = {
        child: string;
        childSecond: string;
        parent: string;
      };

      let childCount = 0;
      let childSecondCount = 0;
      const Child = ({
        register,
        control,
      }: Pick<UseFormReturn<FormInputs>, 'register' | 'control'>) => {
        useWatch({ name: ['childSecond'], control });
        childCount++;
        return <input {...register('child')} />;
      };

      const ChildSecond = ({
        register,
        control,
      }: Pick<UseFormReturn<FormInputs>, 'register' | 'control'>) => {
        useWatch({ name: ['childSecond'], control, exact: true });
        childSecondCount++;
        return <input {...register('childSecond')} />;
      };

      let parentCount = 0;
      const Parent = () => {
        const {
          register,
          handleSubmit,
          control,
          formState: { errors },
        } = useForm<FormInputs>();
        parentCount++;
        return (
          <form onSubmit={handleSubmit(noop)}>
            <>
              <input {...register('parent')} />
              <Child register={register} control={control} />
              <ChildSecond register={register} control={control} />
              <p>{String(errors.parent)}</p>
              <button>submit</button>
            </>
          </form>
        );
      };

      render(<Parent />);

      const childInput = screen.getAllByRole('textbox')[1];
      const childSecondInput = screen.getAllByRole('textbox')[2];

      fireEvent.input(childInput, {
        target: { value: 'test' },
      });

      expect(parentCount).toBe(2);
      expect(childCount).toBe(3);
      expect(childSecondCount).toBe(2);

      parentCount = 0;
      childCount = 0;
      childSecondCount = 0;

      fireEvent.submit(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(parentCount).toBe(1));
      expect(childCount).toBe(1);
      expect(childSecondCount).toBe(1);

      parentCount = 0;
      childCount = 0;
      childSecondCount = 0;

      fireEvent.input(childInput, { target: { value: 'test1' } });

      expect(parentCount).toBe(0);
      expect(childCount).toBe(1);
      expect(childSecondCount).toBe(0);

      parentCount = 0;
      childCount = 0;
      childSecondCount = 0;

      fireEvent.input(childSecondInput, { target: { value: 'test2' } });

      expect(parentCount).toBe(0);
      expect(childCount).toBe(1);
      expect(childSecondCount).toBe(1);
    });

    it('should not re-render useWatch when submit does not change watched values', async () => {
      type FormInputs = {
        firstName: string;
      };

      let watchCount = 0;
      let isSubmitted = false;
      const FirstNameWatched = ({
        control,
      }: Pick<UseFormReturn<FormInputs>, 'control'>) => {
        useWatch({ name: ['firstName'], control, exact: true });
        watchCount++;
        return null;
      };

      const Parent = () => {
        const { register, control, handleSubmit } = useForm<FormInputs>();
        return (
          <form
            onSubmit={handleSubmit(() => {
              isSubmitted = true;
            })}
          >
            <input {...register('firstName')} />
            <FirstNameWatched control={control} />
            <button>submit</button>
          </form>
        );
      };

      render(<Parent />);

      fireEvent.input(screen.getByRole('textbox'), {
        target: { value: 'test' },
      });

      watchCount = 0;

      fireEvent.submit(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => expect(isSubmitted).toBe(true));
      expect(watchCount).toBe(0);
    });

    it('should only subscribe change at useWatch level instead of useForm', () => {
      type FormValues = {
        test: string;
        test1: string;
        test2: string;
      };

      let parentRenderCount = 0;
      let childRenderCount = 0;

      const Test = ({ control }: { control: Control<FormValues> }) => {
        useWatch({
          control,
        });

        childRenderCount++;

        return <div>test</div>;
      };

      const Component = () => {
        const { control, register } = useForm<FormValues>();

        parentRenderCount++;

        return (
          <div>
            <Test control={control} />
            <input {...register('test')} />
            <input {...register('test1')} />
            <input {...register('test2')} />
          </div>
        );
      };

      render(<Component />);

      fireEvent.change(screen.getAllByRole('textbox')[0], {
        target: {
          value: '1234',
        },
      });

      fireEvent.change(screen.getAllByRole('textbox')[1], {
        target: {
          value: '1234',
        },
      });

      fireEvent.change(screen.getAllByRole('textbox')[2], {
        target: {
          value: '1234',
        },
      });

      expect(parentRenderCount).toEqual(2);
      expect(childRenderCount).toEqual(5);
    });

    it("should not re-render external component when field name don't match", async () => {
      type FormInputs = { test1: string; test2: string };

      const Child = ({ control }: { control: Control<FormInputs> }) => {
        useWatch({ name: 'test2', control });

        return <div />;
      };

      const Parent = () => {
        const { register, control } = useForm<FormInputs>();
        useWatch({ name: 'test1', control });

        return (
          <form>
            <input {...register('test1')} />
            <input {...register('test2')} />
            <Child control={control} />
          </form>
        );
      };

      render(<Parent />);

      fireEvent.input(screen.getAllByRole('textbox')[1], {
        target: {
          name: 'test2',
          value: 'value',
        },
      });
    });

    it('should not throw error when null or undefined is set', () => {
      const watchedValue: Record<string, any> = {};
      const Component = () => {
        const { register, control } = useForm<{
          test: string;
          test1: string;
        }>();

        register('test');
        register('test1');

        watchedValue['test'] = useWatch({ name: 'test', control });
        watchedValue['test1'] = useWatch({ name: 'test1', control });

        return <div />;
      };

      render(<Component />);

      expect(watchedValue).toEqual({ test: undefined, test1: undefined });
    });

    it('should return undefined when input gets unregistered', async () => {
      const Component = () => {
        const { register, control, unregister } = useForm<{ test: number }>();
        const [show, setShow] = React.useState(true);
        const data: any = useWatch({ name: 'test', control });

        return (
          <>
            {show && <input {...register('test')} />}
            <span>{data}</span>
            <button
              type="button"
              onClick={() => {
                unregister('test');
                setShow(false);
              }}
            >
              hide
            </button>
          </>
        );
      };

      render(<Component />);

      fireEvent.input(screen.getByRole('textbox'), {
        target: {
          value: 'test',
        },
      });

      expect(screen.getByText('test')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      expect(screen.queryByText('test')).not.toBeInTheDocument();
    });

    it('should return undefined when input get unregistered', () => {
      type FormValues = {
        test: string;
      };

      const Test = ({ control }: { control: Control<FormValues> }) => {
        const value = useWatch({
          control,
          name: 'test',
        });

        return <div>{value === undefined ? 'yes' : 'no'}</div>;
      };

      const Component = () => {
        const { register, control, unregister } = useForm<FormValues>({
          defaultValues: {
            test: 'test',
          },
        });

        React.useEffect(() => {
          register('test');
        }, [register]);

        return (
          <>
            <Test control={control} />
            <button onClick={() => unregister('test')}>unregister</button>
          </>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('yes')).toBeVisible();
    });

    it('should react to changing field name', () => {
      type FormValues = {
        field1: string;
        field2: string;
      };

      const { result: formResult } = renderHook(() =>
        useForm<FormValues>({
          defaultValues: {
            field1: 'value1',
            field2: 'value2',
          },
        }),
      );

      const { result, rerender } = renderHook(
        ({ fieldName }: { fieldName: 'field1' | 'field2' }) => {
          const watchedValue = useWatch({
            control: formResult.current.control,
            name: fieldName,
          });
          return watchedValue;
        },
        {
          initialProps: { fieldName: 'field1' },
        },
      );

      expect(result.current).toBe('value1');

      rerender({ fieldName: 'field2' });
      expect(result.current).toBe('value2');

      rerender({ fieldName: 'field1' });
      expect(result.current).toBe('value1');
    });

    it('should react to changing control', () => {
      type FormValues = {
        name: string;
      };

      const { result: form1Result } = renderHook(() =>
        useForm<FormValues>({
          defaultValues: {
            name: 'form1-value',
          },
        }),
      );

      const { result: form2Result } = renderHook(() =>
        useForm<FormValues>({
          defaultValues: {
            name: 'form2-value',
          },
        }),
      );

      const { result, rerender } = renderHook(
        ({ control }: { control: Control<FormValues> }) =>
          useWatch({
            control,
            name: 'name',
          }),
        {
          initialProps: { control: form1Result.current.control },
        },
      );

      expect(result.current).toBe('form1-value');

      rerender({ control: form2Result.current.control });
      expect(result.current).toBe('form2-value');

      rerender({ control: form1Result.current.control });
      expect(result.current).toBe('form1-value');
    });
  });

  describe('fieldArray', () => {
    it('should watch correct input update with single field array input', () => {
      const inputValues: string[] = [];

      type FormValues = {
        labels: {
          displayName: string;
          internalName: string;
        }[];
      };

      function Item({
        control,
        register,
        itemIndex,
        remove,
      }: {
        control: Control<FormValues>;
        register: UseFormReturn<FormValues>['register'];
        remove: UseFieldArrayReturn['remove'];
        itemIndex: number;
      }) {
        const actualValue = useWatch({
          control,
          name: `labels.${itemIndex}.displayName` as const,
        });
        inputValues.push(actualValue);

        return (
          <div>
            <input
              {...register(`labels.${itemIndex}.displayName` as const)}
              defaultValue={actualValue}
            />
            <button type="button" onClick={() => remove(itemIndex)}>
              Remove
            </button>
          </div>
        );
      }

      const Component = () => {
        const { control, register } = useForm<FormValues>({
          defaultValues: {
            labels: [
              {
                displayName: 'Type',
                internalName: 'type',
              },
              {
                displayName: 'Number',
                internalName: 'number',
              },
              {
                displayName: 'Totals',
                internalName: 'totals',
              },
            ],
          },
        });

        const { fields, remove } = useFieldArray({
          control,
          name: 'labels',
        });

        return (
          <form>
            {fields.map((item, itemIndex) => (
              <Item
                key={item.id}
                control={control}
                register={register}
                itemIndex={itemIndex}
                remove={remove}
              />
            ))}
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getAllByRole('button')[1]);

      expect(inputValues).toEqual([
        'Type',
        'Number',
        'Totals',
        'Type',
        'Number',
        'Totals',
        'Type',
        'Number',
        'Totals',
        'Type',
        'Totals',
      ]);
    });

    it('should return shallow merged watch values', () => {
      const watchedValue: unknown[] = [];

      function App() {
        const methods = useForm({
          defaultValues: {
            name: 'foo',
            arr: [],
          },
          mode: 'onSubmit',
          reValidateMode: 'onChange',
          criteriaMode: 'all',
          shouldUnregister: false,
        });

        return (
          <FormProvider {...methods}>
            <input {...methods.register('name')} placeholder="First Name" />
            <Preview />
            <FieldArray />
            <input type="submit" />
          </FormProvider>
        );
      }

      function Preview() {
        const form = useWatch({});
        watchedValue.push(form);

        return null;
      }

      function FieldArray() {
        useFieldArray({
          name: 'arr',
          shouldUnregister: false,
        });

        return null;
      }

      render(<App />);

      expect(watchedValue).toEqual([
        {
          arr: [],
          name: 'foo',
        },
        {
          arr: [],
          name: 'foo',
        },
      ]);
    });
  });

  describe('fieldArray with shouldUnregister true', () => {
    it('should watch correct input update with single field array input', async () => {
      const watchData: unknown[] = [];

      type Unpacked<T> = T extends (infer U)[] ? U : T;

      type FormValues = {
        items: { prop: string }[];
      };

      function App() {
        const rhfProps = useForm<FormValues>({
          defaultValues: {
            items: [{ prop: 'test' }, { prop: 'test1' }],
          },
          shouldUnregister: true,
        });
        const { control } = rhfProps;

        const { fields, insert, remove } = useFieldArray({
          control,
          name: 'items',
        });

        return (
          <form>
            {fields.map((item, index) => {
              return (
                <div key={item.id}>
                  <Child control={control} index={index} itemDefault={item} />
                  <button
                    type="button"
                    onClick={() => {
                      insert(index + 1, { prop: 'ShouldBeTHere' });
                    }}
                  >
                    insert
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      remove(index);
                    }}
                  >
                    remove
                  </button>
                </div>
              );
            })}
            <Watcher itemsDefault={fields} control={control} />
            <input type="submit" />
          </form>
        );
      }

      function Watcher({
        itemsDefault,
        control,
      }: {
        itemsDefault: FormValues['items'];
        control: Control<FormValues>;
      }) {
        const useWatchedItems = useWatch({
          name: 'items',
          control,
          defaultValue: itemsDefault,
        });

        watchData.push(useWatchedItems);

        return (
          <div>
            {useWatchedItems.map((item, index) => {
              return (
                <p key={index}>
                  Value {index}: {item.prop}
                </p>
              );
            })}
          </div>
        );
      }

      function Child({
        index,
        itemDefault,
        control,
      }: {
        index: number;
        itemDefault: Unpacked<FormValues['items']>;
        control: Control<FormValues>;
      }) {
        const { field } = useController({
          name: `items.${index}.prop` as const,
          control,
          defaultValue: itemDefault.prop,
        });

        return <input {...field} />;
      }

      render(<App />);

      expect(screen.getByText('Value 0: test')).toBeVisible();
      expect(screen.getByText('Value 1: test1')).toBeVisible();
      expect(
        screen.queryByText('Value 1: ShouldBeTHere'),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getAllByRole('button', { name: 'insert' })[0]);

      expect(await screen.findByText('Value 1: ShouldBeTHere')).toBeVisible();
      expect(screen.getByText('Value 2: test1')).toBeVisible();

      fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[0]);

      expect(
        screen.queryByText('Value 2: ShouldBeTHere'),
      ).not.toBeInTheDocument();

      expect(watchData).toMatchSnapshot();
    });
  });

  describe('reset', () => {
    it('should return updated default value with watched field after reset', async () => {
      type FormValues = {
        test: string;
        name: string;
      };

      function Watcher({ control }: { control: Control<FormValues> }) {
        const testField = useWatch<FormValues>({
          name: 'test',
          control: control,
        });

        return <div>{testField}</div>;
      }

      function Component() {
        const { reset, control } = useForm<FormValues>({
          defaultValues: {
            test: '',
            name: '',
          },
        });

        React.useEffect(() => {
          reset({
            test: 'test',
          });
        }, [reset]);

        return <Watcher control={control} />;
      }

      render(<Component />);

      expect(await screen.findByText('test')).toBeVisible();
    });

    it('should return default value of reset method', async () => {
      const Component = () => {
        const { register, reset, control } = useForm<{
          test: string;
        }>();
        const test = useWatch<{
          test: string;
        }>({ name: 'test', control });

        React.useEffect(() => {
          reset({ test: 'default' });
        }, [reset]);

        return (
          <form>
            <input {...register('test')} />
            <span>{test}</span>
          </form>
        );
      };

      render(<Component />);

      expect(await screen.findByText('default')).toBeDefined();
    });

    it('should re-register watched input after reset', async () => {
      type FormValues = {
        firstName: string;
      };

      function LivePreview({ control }: { control: Control<FormValues> }) {
        const value = useWatch({
          name: `firstName`,
          defaultValue: 'yes',
          control,
        });

        return <p>{value}</p>;
      }

      const Component = () => {
        const formMethods = useForm<FormValues>();
        const { control, reset, register } = formMethods;

        React.useEffect(() => {
          reset({
            firstName: 'firstName',
          });
        }, [reset]);

        return (
          <>
            <input {...register('firstName')} />

            <LivePreview control={control} />
          </>
        );
      };

      render(<Component />);

      expect(screen.getByText('firstName')).toBeVisible();

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '123' },
      });

      expect(screen.getByText('123')).toBeVisible();
    });

    it('should fallback to inline defaultValue with reset API', () => {
      const App = () => {
        const { control, reset } = useForm();
        const value = useWatch({
          name: 'test',
          defaultValue: 'yes',
          control,
        });

        React.useEffect(() => {
          reset({});
        }, [reset]);

        return <p>{value ? 'yes' : 'no'}</p>;
      };

      render(<App />);

      expect(screen.getByText('yes')).toBeVisible();
    });

    describe('with useFieldArray', () => {
      // issue: https://github.com/react-hook-form/react-hook-form/issues/2229
      it('should return current value with radio type', () => {
        type FormValues = {
          options: { option: string }[];
        };
        const watchedValue: object[] = [];

        const Test = ({ control }: { control: Control<FormValues> }) => {
          const values = useWatch({ control });
          const options = values.options;
          watchedValue.push(values);

          return (
            <div>
              <p>First: {options?.[0].option}</p>
              <p>Second: {options?.[1].option}</p>
            </div>
          );
        };

        const Component = () => {
          const { register, reset, control } = useForm<FormValues>();
          const { fields } = useFieldArray({ name: 'options', control });

          React.useEffect(() => {
            reset({
              options: [
                {
                  option: 'yes',
                },
                {
                  option: 'yes',
                },
              ],
            });
          }, [reset]);

          return (
            <form>
              {fields.map((_, i) => (
                <div key={i.toString()} data-testid={`field-${i}`}>
                  <label>
                    Yes
                    <input
                      type="radio"
                      value="yes"
                      {...register(`options.${i}.option` as const)}
                    />
                  </label>
                  <label>
                    No
                    <input
                      type="radio"
                      value="no"
                      {...register(`options.${i}.option` as const)}
                    />
                  </label>
                </div>
              ))}
              <Test control={control} />
            </form>
          );
        };

        render(<Component />);

        const firstField = screen.getByTestId('field-0');
        expect(within(firstField).getByLabelText('Yes')).toBeChecked();
        expect(screen.getByText('First: yes')).toBeVisible();

        const secondField = screen.getByTestId('field-1');
        expect(within(secondField).getByLabelText('Yes')).toBeChecked();
        expect(screen.getByText('Second: yes')).toBeVisible();

        fireEvent.click(within(firstField).getByLabelText('No'));

        expect(screen.getByText('First: no')).toBeVisible();
        expect(screen.getByText('Second: yes')).toBeVisible();

        // Let's check all values of renders with implicitly the number of render (for each value)
        expect(watchedValue).toMatchSnapshot();
      });

      it("should watch item correctly with useFieldArray's remove method", async () => {
        let watchedValue: { [x: string]: any } | undefined;
        const Component = () => {
          const { register, control } = useForm<{
            test: {
              firstName: string;
              lsatName: string;
            }[];
          }>({
            defaultValues: {
              test: [{ firstName: 'test' }, { firstName: 'test1' }],
            },
          });
          const { fields, remove } = useFieldArray({
            name: 'test',
            control,
          });
          watchedValue = useWatch({
            name: 'test',
            control,
          });

          return (
            <form>
              {fields.map((item, i) => (
                <div key={item.firstName}>
                  <input
                    type="input"
                    defaultValue={item.firstName}
                    {...register(`test.${i}.firstName` as const)}
                  />

                  <button type="button" onClick={() => remove(i)}>
                    remove
                  </button>
                </div>
              ))}
            </form>
          );
        };

        render(<Component />);

        expect(watchedValue).toEqual([
          { firstName: 'test' },
          { firstName: 'test1' },
        ]);

        fireEvent.click(screen.getAllByRole('button')[0]);

        expect(watchedValue).toEqual([{ firstName: 'test1' }]);
      });
    });

    describe('with custom register', () => {
      it('should return default value of reset method when value is not empty', async () => {
        const Component = () => {
          const { register, reset, control } = useForm<{
            test: string;
          }>();
          const test = useWatch<{
            test: string;
          }>({
            name: 'test',
            control,
          });

          React.useEffect(() => {
            register('test');
          }, [register]);

          React.useEffect(() => {
            reset({ test: 'default1' });
          }, [reset]);

          return (
            <form>
              <input {...register('test')} />
              <span data-testid="result">{test}</span>
            </form>
          );
        };

        render(<Component />);

        expect((await screen.findByTestId('result')).textContent).toBe(
          'default1',
        );
      });

      it('should return default value of reset method', async () => {
        const Component = () => {
          const { register, reset, control } = useForm<{
            test: string;
          }>();
          const test = useWatch<{
            test: string;
          }>({ name: 'test', control });

          React.useEffect(() => {
            register('test');
          }, [register]);

          React.useEffect(() => {
            reset({ test: 'default' });
          }, [reset]);

          return (
            <form>
              <span>{test}</span>
            </form>
          );
        };

        render(<Component />);

        expect(await screen.findByText('default')).toBeDefined();
      });

      it('should return default value', async () => {
        const Component = () => {
          const { register, reset, control } = useForm<{ test: string }>({
            defaultValues: {
              test: 'test',
            },
          });
          const test = useWatch<{ test: string }>({
            name: 'test',
            control,
          });

          React.useEffect(() => {
            register('test');
          }, [register]);

          React.useEffect(() => {
            reset();
          }, [reset]);

          return (
            <form>
              <span>{test}</span>
            </form>
          );
        };

        render(<Component />);

        expect(await screen.findByText('test')).toBeDefined();
      });
    });

    it('Should update the value immediately after reset when used with Controller', async () => {
      const getDefaultValue = () => ({
        test: undefined,
      });

      const Component = () => {
        const { reset, control } = useForm({
          defaultValues: getDefaultValue(),
        });

        return (
          <form>
            <Controller
              control={control}
              name="test"
              render={({ field: { onChange, value } }) => (
                <select
                  data-testid="test-select"
                  value={value ?? ''}
                  onChange={(e) => {
                    onChange(e.target.value);
                  }}
                >
                  <option value=""></option>
                  <option value="test1">test1</option>
                  <option value="test2">test2</option>
                </select>
              )}
            />
            <button
              type="button"
              data-testid="reset-button"
              onClick={() => reset(getDefaultValue())}
            >
              Reset
            </button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.change(screen.getByTestId('test-select'), {
        target: { value: 'test1' },
      });

      expect(screen.getByTestId('test-select')).toHaveValue('test1');

      fireEvent.click(screen.getByTestId('reset-button'));

      expect(screen.getByTestId('test-select')).toHaveValue('');

      fireEvent.change(screen.getByTestId('test-select'), {
        target: { value: 'test2' },
      });

      expect(screen.getByTestId('test-select')).toHaveValue('test2');

      fireEvent.click(screen.getByTestId('reset-button'));

      expect(screen.getByTestId('test-select')).toHaveValue('');
    });
  });

  describe('unregister', () => {
    it('should return correct value after input get unregistered', async () => {
      type FormValues = { test: string };

      const Component = ({ control }: { control: Control<FormValues> }) => {
        const test = useWatch<{ test: string }>({ name: 'test', control });
        return <div>{test === undefined ? 'no' : test}</div>;
      };

      const Form = () => {
        const { control, unregister, register } = useForm<FormValues>({
          defaultValues: { test: 'test' },
        });

        return (
          <>
            <Component control={control} />
            <input {...register('test')} />
            <button onClick={() => unregister('test')}>unregister</button>
          </>
        );
      };

      render(<Form />);

      expect(screen.getByText('test')).toBeVisible();

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('no')).toBeVisible();
    });
  });

  describe('setValue', () => {
    it('should return correct value after input get unregistered', async () => {
      type FormValues = { test: string };

      const Child = ({ register }: UseFormReturn<FormValues>) => {
        return <input {...register('test')} />;
      };

      const Component = ({ control }: { control: Control<FormValues> }) => {
        const test = useWatch<{ test: string }>({ name: 'test', control });
        return <div>{test === 'bill' ? 'no' : test}</div>;
      };

      const Form = () => {
        const methods = useForm<FormValues>({
          defaultValues: { test: 'test' },
        });

        const { setValue } = methods;

        React.useEffect(() => {
          setValue('test', 'bill');
        }, [setValue]);

        return (
          <>
            <Component control={methods.control} />
            <Child {...methods} />
          </>
        );
      };

      render(<Form />);

      expect(await screen.findByText('no')).toBeVisible();
    });

    it('should keep set type after set value', async () => {
      const Form = () => {
        const { control, setValue } = useForm({
          defaultValues: { test: new Set(['test']) },
        });
        const { field } = useController({
          control,
          name: 'test',
        });

        React.useEffect(() => {
          setValue('test', new Set(['test']));
        }, [setValue]);

        return <>{field.value instanceof Set ? 'yes' : 'no'}</>;
      };

      render(<Form />);

      await waitFor(() => {
        screen.getByText('yes');
      });
    });

    it('should watch nested object field update', () => {
      interface FormData {
        one: {
          two: {
            dep: number;
          };
        };
      }

      const Component1 = () => {
        const watchedDep = useWatch({ name: 'one.two.dep' });
        return <p>{watchedDep}</p>;
      };

      const Component2 = () => {
        const { register, setValue } = useFormContext<FormData>();
        const field = register('one.two.dep');

        return (
          <>
            <input {...field} />
            <button
              onClick={() => {
                setValue('one.two', { dep: 333 });
              }}
            >
              set deep
            </button>
          </>
        );
      };

      const Component: React.FC = () => {
        const form = useForm<FormData>({
          defaultValues: {
            one: {
              two: {
                dep: 111,
              },
            },
          },
        });

        return (
          <>
            <FormProvider {...form}>
              <Component1 />
              <Component2 />
            </FormProvider>
          </>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('333')).toBeVisible();

      expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
        '333',
      );
    });

    it('should return field value, not resolver transformed value', async () => {
      const Form = () => {
        const { control, setValue } = useForm<
          { test: string },
          any,
          { test: number }
        >({
          defaultValues: { test: '3' },
          resolver: ({ test }) => ({
            values: { test: parseInt(test, 10) },
            errors: {},
          }),
        });
        const { field } = useController({
          control,
          name: 'test',
        });

        React.useEffect(() => {
          setValue('test', '9');
        }, [setValue]);

        return <>{field.value === '9' ? 'yes' : 'no'}</>;
      };

      render(<Form />);

      await waitFor(() => {
        screen.getByText('yes');
      });
    });

    it('should return field value when resolver transformed value is a different shape', async () => {
      const Form = () => {
        const { control, setValue } = useForm<
          { alpha: string; beta: string },
          any,
          { add: number }
        >({
          defaultValues: { alpha: '3', beta: '4' },
          resolver: ({ alpha, beta }) => ({
            values: { add: parseInt(alpha, 10) + parseInt(beta, 10) },
            errors: {},
          }),
        });
        const { field } = useController({
          control,
          name: 'alpha',
        });

        React.useEffect(() => {
          setValue('alpha', '9');
        }, [setValue]);

        return <>{field.value === '9' ? 'yes' : 'no'}</>;
      };

      render(<Form />);

      await waitFor(() => {
        screen.getByText('yes');
      });
    });
  });

  describe('formContext', () => {
    it('should work with form context', async () => {
      const Component = () => {
        const test = useWatch<{ test: string }>({ name: 'test' });
        return <div>{test}</div>;
      };

      const Form = () => {
        const methods = useForm<{ test: string }>({
          defaultValues: { test: 'test' },
        });

        return (
          <FormProvider {...methods}>
            <Component />
          </FormProvider>
        );
      };

      render(<Form />);

      expect(await screen.findByText('test')).toBeDefined();
    });
  });

  describe('compute ', () => {
    it('should only update when value changed within compute', () => {
      type FormValue = {
        test: string;
      };

      let renderCount = 0;

      const Form = () => {
        const methods = useForm<FormValue>({
          defaultValues: { test: '' },
        });

        const watchedValue = useWatch({
          control: methods.control,
          compute: (data: FormValue) => data.test?.length > 2,
        });

        renderCount++;

        return (
          <div>
            <input {...methods.register('test')} />
            <p>{watchedValue ? 'yes' : 'no'}</p>
            <p>{renderCount}</p>
          </div>
        );
      };

      render(<Form />);

      screen.getByText('no');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '12' },
      });

      screen.getByText('no');

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '123' },
      });

      screen.getByText('yes');

      expect(renderCount).toEqual(4);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '12' },
      });

      screen.getByText('no');

      expect(renderCount).toEqual(5);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: '1' },
      });

      screen.getByText('no');

      expect(renderCount).toEqual(5);
    });
  });
});
