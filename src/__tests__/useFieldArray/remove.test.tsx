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
import type { Control, DeepMap, FieldError } from '../../types';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import noop from '../../utils/noop';

jest.useFakeTimers();

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('remove', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should update isDirty formState when item removed', () => {
    let formState: any;
    const Component = () => {
      const {
        register,
        control,
        formState: tempFormState,
      } = useForm({
        defaultValues: {
          test: [{ name: 'default' }],
        },
      });
      const { fields, remove, append } = useFieldArray({
        name: 'test',
        control,
      });

      formState = tempFormState;
      formState.isDirty;

      return (
        <form>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`test.${i}.name` as const)} />
              <button type={'button'} onClick={() => remove(i)}>
                remove
              </button>
            </div>
          ))}

          <button
            type={'button'}
            onClick={() =>
              append({
                name: '',
              })
            }
          >
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    expect(formState.isDirty).toBeFalsy();

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(formState.isDirty).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[1]);

    expect(formState.isDirty).toBeFalsy();
  });

  it('should not mark unrelated fields as dirty when removing from field array', async () => {
    let dirtyInputs = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          items: [{ value: 'first' }, { value: 'second' }],
        },
      });
      const { fields, remove } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyInputs = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`items.${i}.value` as const)} />
              <button type="button" onClick={() => remove(i)}>
                remove{i}
              </button>
            </div>
          ))}
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /remove0/i }));

    await waitFor(() => {
      expect(dirtyInputs).not.toHaveProperty('name');
      expect(dirtyInputs).toHaveProperty('items');
    });
  });

  it('should update isValid formState when item removed', async () => {
    let formState: any;
    const Component = () => {
      const {
        register,
        control,
        formState: tempFormState,
      } = useForm({
        mode: 'onChange',
        defaultValues: {
          test: [{ name: 'default' }],
        },
      });
      const { fields, remove, append } = useFieldArray({
        name: 'test',
        control,
      });

      formState = tempFormState;

      formState.isValid;

      return (
        <form>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input
                {...register(`test.${i}.name` as const, { required: true })}
              />
              <button type={'button'} onClick={() => remove(i)}>
                remove
              </button>
            </div>
          ))}

          <button
            type={'button'}
            onClick={() =>
              append({
                name: '',
              })
            }
          >
            append
          </button>

          <p>{formState.isValid ? 'isValid' : 'notValid'}</p>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(await screen.findByText('notValid')).toBeVisible();

    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[1]);

    expect(await screen.findByText('isValid')).toBeVisible();
  });

  it('should remove field according index', () => {
    const { result } = renderHook(() => {
      const { control } = useForm({
        defaultValues: {
          test: [{ value: 'default' }],
        },
      });
      return useFieldArray({
        control,
        name: 'test',
      });
    });

    act(() => {
      result.current.append({ value: 'test' });
    });

    act(() => {
      result.current.remove(1);
    });

    expect(result.current.fields).toEqual([{ id: '0', value: 'default' }]);

    act(() => {
      result.current.remove(0);
    });

    expect(result.current.fields).toEqual([]);
  });

  it('should remove all field', () => {
    const { result } = renderHook(() => {
      const { control } = useForm({
        defaultValues: {
          test: [{ value: 'default' }],
        },
      });
      return useFieldArray({
        control,
        name: 'test',
      });
    });

    act(() => {
      result.current.append({ value: 'test' });
    });

    act(() => {
      result.current.remove();
    });

    expect(result.current.fields).toEqual([]);
  });

  it('should remove specific fields when index is array', () => {
    const { result } = renderHook(() => {
      const { control } = useForm({
        defaultValues: {
          test: [{ value: 'default' }],
        },
      });
      return useFieldArray({
        control,
        name: 'test',
      });
    });

    act(() => {
      result.current.append({ value: 'test' });
    });

    act(() => {
      result.current.remove([0, 1]);
    });

    expect(result.current.fields).toEqual([]);
  });

  it.each(['isDirty', 'dirtyFields'])(
    'should be dirtyFields when value is remove with %s',
    () => {
      const { result } = renderHook(() => {
        const { register, formState, control } = useForm({
          defaultValues: {
            test: [{ value: 'default' }],
          },
        });
        const { fields, append, remove } = useFieldArray({
          control,
          name: 'test',
        });

        return { register, formState, fields, append, remove };
      });

      result.current.formState.isDirty;
      result.current.formState.dirtyFields;

      act(() => {
        result.current.append({ value: 'test' });
      });

      act(() => {
        result.current.append({ value: 'test' });
      });

      act(() => {
        result.current.remove(0);
      });

      expect(result.current.formState.isDirty).toBeTruthy();
      expect(result.current.formState.dirtyFields).toEqual({
        test: [{ value: true }, { value: true }],
      });

      act(() => {
        result.current.remove();
      });

      expect(result.current.formState.isDirty).toBeTruthy();
      expect(result.current.formState.dirtyFields).toEqual({
        test: [{ value: true }],
      });
    },
  );

  it('should remove values from formState.touchedFields', () => {
    let touched: any;

    const Component = () => {
      const { register, formState, control } = useForm();
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      touched = formState.touchedFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value`)} />
          ))}
          <button type="button" onClick={() => append({ value: 'append' })}>
            append
          </button>
          <button type="button" onClick={() => remove(0)}>
            remove
          </button>
          <button type="button" onClick={() => remove()}>
            remove all
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.blur(inputs[0]);
    fireEvent.blur(inputs[1]);
    fireEvent.blur(inputs[2]);

    expect(touched).toEqual({
      test: [{ value: true }, { value: true }, { value: true }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(touched).toEqual({
      test: [{ value: true }, { value: true }],
    });

    fireEvent.click(screen.getByRole('button', { name: 'remove all' }));

    expect(touched).toEqual({ test: [] });
  });

  it('should remove specific field if isValid is true', async () => {
    const Component = () => {
      const { register, formState, control } = useForm({
        mode: VALIDATION_MODE.onChange,
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      formState.isValid;

      return (
        <form>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.value` as const, { required: true })}
            />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => remove(1)}>
            remove
          </button>
          <p>{formState.isValid ? 'valid' : 'notValid'}</p>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(await screen.findByText('notValid')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.input(inputs[0], {
      target: { value: 'test' },
    });

    fireEvent.input(inputs[2], {
      target: { value: 'test' },
    });

    fireEvent.input(inputs[3], {
      target: { value: 'test' },
    });

    expect(await screen.findByText('notValid')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(await screen.findByText('valid')).toBeVisible();
  });

  it('should remove all field if isValid is true', async () => {
    let isValid = false;
    const Component = () => {
      const { register, formState, control } = useForm({
        mode: VALIDATION_MODE.onChange,
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });
      isValid = formState.isValid;

      return (
        <form>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.value` as const, { required: true })}
            />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => remove()}>
            remove
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    await waitFor(() => expect(isValid).toBeFalsy());
    expect(screen.getAllByRole('textbox')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    await waitFor(() => expect(isValid).toBeFalsy());
    expect(screen.getAllByRole('textbox')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    await waitFor(() => expect(isValid).toBe(true));
  });

  it('should remove error', async () => {
    let errors: any;
    const Component = () => {
      const {
        register,
        formState: { errors: tempErrors },
        handleSubmit,
        control,
      } = useForm();
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });
      errors = tempErrors;

      return (
        <form onSubmit={handleSubmit(noop)}>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.value` as const, { required: true })}
            />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => remove(0)}>
            remove
          </button>
          <button type="button" onClick={() => remove()}>
            remove all
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    await waitFor(() => expect(errors.test).toHaveLength(2));

    fireEvent.click(screen.getByRole('button', { name: 'remove all' }));

    expect(errors.test).toBeUndefined();
  });

  it('should remove nested field array error', async () => {
    type FormValues = {
      test: {
        nested: {
          test: string;
          key: number;
        }[];
      }[];
    };

    let mockKey = 0;
    const callback = jest.fn();

    const Nested = ({
      errors,
      control,
      index,
    }: {
      control: Control<FormValues>;
      errors: DeepMap<Record<string, any>, FieldError>;
      index: number;
    }) => {
      const { fields, append, remove } = useFieldArray<
        FormValues,
        'test.0.nested'
      >({
        name: `test.${index}.nested` as 'test.0.nested',
        control,
      });

      return (
        <fieldset>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input
                {...control.register(
                  `test.${index}.nested.${i}.test` as const,
                  {
                    required: 'required',
                  },
                )}
              />
              {errors?.test &&
                errors.test[index]?.nested &&
                errors.test[index].nested[i]?.test && (
                  <span data-testid="nested-error">
                    {errors.test[index].nested[i].test.message}
                  </span>
                )}
              <button type="button" onClick={() => remove(i)}>
                nested delete
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => append({ test: 'test', key: mockKey++ })}
          >
            nested append
          </button>
        </fieldset>
      );
    };

    const Component = () => {
      const {
        formState: { errors, isValid },
        handleSubmit,
        control,
      } = useForm<FormValues>({
        defaultValues: {
          test: [{ nested: [{ test: '', key: mockKey }] }],
        },
      });
      const { fields } = useFieldArray({ name: 'test', control });

      return (
        <>
          <p>Valid: {isValid.toString()}</p>
          <form onSubmit={handleSubmit(callback)}>
            {fields.map((_, i) => (
              <Nested
                key={i.toString()}
                errors={errors}
                control={control}
                index={i}
              />
            ))}
            <button>submit</button>
          </form>
        </>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByTestId('nested-error')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /nested delete/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('nested-error')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('Valid: true')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /nested append/i }));

    expect(screen.queryByTestId('nested-error')).not.toBeInTheDocument();
  });

  it('should trigger reRender when user is watching the all field array', () => {
    const watched: any[] = [];
    const Component = () => {
      const { register, watch, control } = useForm<{
        test: {
          value: string;
        }[];
      }>();
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });
      watched.push(watch());

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => remove(0)}>
            remove
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    expect(watched).toEqual([
      {}, // first render
      { test: [] }, // render inside useEffect in useFieldArray
      { test: [{ value: '' }] }, // render inside append method
      { test: [{ value: '' }] }, // render inside useEffect in useFieldArray
      { test: [] }, // render inside remove method
      { test: [] }, // render inside useEffect in useFieldArray
    ]);
  });

  it('should return watched value with watch API', async () => {
    const renderedItems: any = [];
    const Component = () => {
      const { watch, register, control } = useForm<{
        test: {
          value: string;
        }[];
      }>();
      const { fields, append, remove } = useFieldArray({
        name: 'test',
        control,
      });
      const watched = watch('test');
      const isRemoved = React.useRef(false);
      if (isRemoved.current) {
        renderedItems.push(watched);
      }

      return (
        <div>
          {fields.map((field, i) => (
            <div key={`${field.id}`}>
              <input {...register(`test.${i}.value` as const)} />
            </div>
          ))}
          <button onClick={() => append({ value: '' })}>append</button>
          <button
            onClick={() => {
              remove(2);
              isRemoved.current = true;
            }}
          >
            remove
          </button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], {
      target: { name: 'test[0].value', value: '111' },
    });
    fireEvent.change(inputs[1], {
      target: { name: 'test[1].value', value: '222' },
    });
    fireEvent.change(inputs[2], {
      target: { name: 'test[2].value', value: '333' },
    });

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    await waitFor(() =>
      expect(renderedItems).toEqual([
        [{ value: '111' }, { value: '222' }],
        [{ value: '111' }, { value: '222' }],
      ]),
    );
  });

  it('should remove dirtyFields fields with nested field inputs', () => {
    const { result } = renderHook(() => {
      const { register, formState, control } = useForm({
        defaultValues: {
          test: {
            data: [{ value: 'default' }],
          },
        },
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test.data',
      });

      return { register, formState, fields, append, remove };
    });

    result.current.formState.dirtyFields as Record<string, any>;
    result.current.formState.isDirty;

    act(() => {
      result.current.append({ value: 'test' });
    });

    expect(result.current.formState.isDirty).toBeTruthy();
    expect(result.current.formState.dirtyFields).toEqual({
      test: { data: [undefined, { value: true }] },
    });

    act(() => {
      result.current.remove(1);
    });

    expect(result.current.formState.isDirty).toBeFalsy();
    expect(result.current.formState.dirtyFields).toEqual({});
  });

  it('should remove Controller by index without error', () => {
    const Component = () => {
      const { control, handleSubmit } = useForm<{
        test: {
          firstName: string;
        }[];
      }>({
        defaultValues: {
          test: [],
        },
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <ul>
            {fields.map((item, index) => {
              return (
                <li key={item.id}>
                  <Controller
                    render={({ field }) => <input {...field} />}
                    name={`test.${index}.firstName` as const}
                    control={control}
                  />
                  <button type="button" onClick={() => remove(index)}>
                    delete
                  </button>
                </li>
              );
            })}
          </ul>
          <section>
            <button
              type="button"
              onClick={() => {
                append({ firstName: 'appendBill' });
              }}
            >
              append
            </button>
          </section>

          <input type="submit" />
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[1]);
    fireEvent.click(screen.getAllByRole('button', { name: 'delete' })[0]);
  });

  it("should not reset Controller's value during remove when Field Array name is already registered", async () => {
    function Component() {
      const { control, handleSubmit } = useForm({
        defaultValues: {
          test: [{ firstName: 'Bill', lastName: '' }],
        },
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <ul>
            {fields.map((item, index) => {
              return (
                <li key={item.id}>
                  <Controller
                    name={`test.${index}.lastName` as const}
                    control={control}
                    render={({ field }) => <input {...field} />}
                  />
                  <button type="button" onClick={() => remove(index)}>
                    Delete
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => {
              append({ firstName: 'appendBill', lastName: 'appendLuo' });
            }}
          >
            append
          </button>
        </form>
      );
    }

    render(<Component />);

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { name: 'test[0].lastName', value: '111' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[1]);

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('111');
  });

  describe('with resolver', () => {
    it('should invoke resolver when formState.isValid true', async () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
          defaultValues: {
            test: [{ value: 'test' }],
          },
        });
        const { remove } = useFieldArray({ control, name: 'test' });
        return { formState, remove };
      });

      result.current.formState.isValid;

      await act(async () => {
        result.current.remove(0);
      });

      expect(resolver).toHaveBeenCalledWith(
        {
          test: [],
        },
        undefined,
        { criteriaMode: undefined, fields: {}, names: [] },
      );
    });

    it('should not invoke resolver when formState.isValid false', () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
          defaultValues: {
            test: [{ value: 'test' }],
          },
        });
        const { remove } = useFieldArray({ control, name: 'test' });
        return { formState, remove };
      });

      act(() => {
        result.current.remove(0);
      });

      expect(resolver).toHaveBeenCalled();
    });

    it('should remove the first index correctly', async () => {
      let output: unknown;

      type FormValues = {
        test: {
          firstName: string;
          lastName: string;
        }[];
      };

      const Component = () => {
        const { control, handleSubmit, register } = useForm<FormValues>({
          defaultValues: {
            test: [
              {
                firstName: 'test',
                lastName: 'test',
              },
              {
                firstName: 'test1',
                lastName: 'test1',
              },
            ],
          },
        });
        const { fields, remove } = useFieldArray({
          control,
          name: 'test',
        });

        const onSubmit = (data: FormValues) => (output = data);

        return (
          <form onSubmit={handleSubmit(onSubmit)}>
            {fields.map((field, index) => {
              return (
                <div key={field.id}>
                  <input {...register(`test.${index}.firstName` as const)} />
                  <Controller
                    name={`test.${index}.lastName` as const}
                    control={control}
                    render={() => <div />}
                  />
                  <button
                    type={'button'}
                    onClick={() => {
                      remove(index);
                    }}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
            <button>Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() =>
        expect(output).toEqual({
          test: [
            {
              firstName: 'test',
              lastName: 'test',
            },
            {
              firstName: 'test1',
              lastName: 'test1',
            },
          ],
        }),
      );

      fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() =>
        expect(output).toEqual({
          test: [
            {
              firstName: 'test1',
              lastName: 'test1',
            },
          ],
        }),
      );
    });
  });

  it('should remove correct value with async reset', async () => {
    let output = {};

    function App() {
      const { handleSubmit, control, reset } = useForm({
        defaultValues: {
          test: [
            {
              title: '',
              description: '',
            },
            {
              title: '',
              description: '',
            },
          ],
        },
      });
      const { fields, remove } = useFieldArray({
        name: 'test',
        control,
      });

      React.useEffect(() => {
        setTimeout(() => {
          reset({
            test: [
              {
                title: 'title1',
                description: 'description1',
              },
              {
                title: 'title2',
                description: 'description2',
              },
            ],
          });
        }, 2000);
      }, [reset]);

      return (
        <form onSubmit={handleSubmit((data) => (output = data))}>
          {fields.map((field, index) => (
            <div
              key={field.id}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              <Controller
                name={`test.${index}.title`}
                control={control}
                render={({ field }) => <input {...field} />}
              />
              <button type="button" onClick={() => remove(index)}>
                remove
              </button>
            </div>
          ))}
          <button type="submit">submit</button>
        </form>
      );
    }

    render(<App />);

    act(() => {
      jest.advanceTimersByTime(2000);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[1]);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(output).toEqual({
        test: [{ title: 'title1', description: 'description1' }],
      }),
    );
  });

  it('should not omit keyName when provided', async () => {
    type FormValues = {
      test: {
        test: string;
        id: string;
      }[];
    };

    const App = () => {
      const [data, setData] = React.useState<FormValues>();
      const { control, register, handleSubmit } = useForm<FormValues>({
        defaultValues: {
          test: [
            { id: '1234', test: 'data' },
            { id: '4567', test: 'data1' },
          ],
        },
      });

      const { fields, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit(setData)}>
          {fields.map((field, index) => {
            return <input key={field.id} {...register(`test.${index}.test`)} />;
          })}
          <button
            type={'button'}
            onClick={() => {
              remove(0);
            }}
          >
            remove
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"4567","test":"data1"}]}'),
    ).toBeVisible();
  });

  it('should not omit keyName when provided and defaultValue is empty', async () => {
    type FormValues = {
      test: {
        test: string;
        id: string;
      }[];
    };
    let k = 0;

    const App = () => {
      const [data, setData] = React.useState<FormValues>();
      const { control, register, handleSubmit } = useForm<FormValues>();

      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit(setData)}>
          {fields.map((field, index) => {
            return <input key={field.id} {...register(`test.${index}.test`)} />;
          })}
          <button
            type={'button'}
            onClick={() => {
              remove(0);
            }}
          >
            remove
          </button>

          <button
            type={'button'}
            onClick={() => {
              append({
                id: 'whatever' + k,
                test: '1234' + k,
              });
              k = 1;
            }}
          >
            append
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    fireEvent.click(screen.getByRole('button', { name: 'remove' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever1","test":"12341"}]}'),
    ).toBeVisible();
  });

  it('should not leave empty objects in watched values when removing from field array with values prop', async () => {
    type FormValues = {
      items: { name: string; text: string }[];
    };

    const onUpdate = jest.fn();

    function App() {
      const [model, setModel] = React.useState<FormValues>({ items: [] });

      const {
        formState: { isValid, isDirty },
        control,
        watch,
      } = useForm<FormValues>({
        mode: 'onChange',
        defaultValues: { items: [] },
        values: model,
      });

      const { fields, append, remove } = useFieldArray({
        control,
        name: 'items',
      });

      const watchedValues = watch();

      React.useEffect(() => {
        if (isValid && isDirty) {
          onUpdate(watchedValues);
          setModel(watchedValues);
        }
      }, [watchedValues, isValid, isDirty]);

      return (
        <form>
          {fields.map((item, index) => (
            <div key={item.id}>
              <Controller
                control={control}
                name={`items.${index}.name`}
                rules={{ required: true }}
                render={({ field }) => (
                  <input data-testid={`name-${index}`} {...field} />
                )}
              />
              <Controller
                control={control}
                name={`items.${index}.text`}
                rules={{ required: true }}
                render={({ field }) => (
                  <input data-testid={`text-${index}`} {...field} />
                )}
              />
              <button type="button" onClick={() => remove(index)}>
                remove {index}
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({ name: '', text: '' })}>
            add
          </button>
          <p data-testid="fields-count">{fields.length}</p>
        </form>
      );
    }

    render(<App />);

    // Add first item
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');

    // Fill first item
    fireEvent.change(screen.getByTestId('name-0'), {
      target: { value: 'foo' },
    });
    fireEvent.change(screen.getByTestId('text-0'), {
      target: { value: 'bar' },
    });

    // Add second item
    fireEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(screen.getByTestId('fields-count')).toHaveTextContent('2');

    // Fill second item
    fireEvent.change(screen.getByTestId('name-1'), {
      target: { value: 'baz' },
    });
    fireEvent.change(screen.getByTestId('text-1'), {
      target: { value: 'qux' },
    });

    // Clear the mock so we can check post-remove calls
    onUpdate.mockClear();

    // Remove first item
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'remove 0' }));
    });

    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');

    // Every call to onUpdate should have exactly 1 item
    for (const call of onUpdate.mock.calls) {
      const watchedVal = call[0] as FormValues;
      expect(watchedVal.items).toHaveLength(1);
      expect(watchedVal.items[0].name).toBeDefined();
      expect(watchedVal.items[0].text).toBeDefined();
    }
  });

  it('should not re-insert removed items when using values prop with keepDirtyValues', async () => {
    type FormValues = {
      test: { value?: string }[];
    };

    function App() {
      const [record, setRecord] = React.useState<FormValues>({
        test: [{ value: 'foo' }],
      });
      const { register, handleSubmit, control } = useForm<FormValues>({
        values: record,
        resetOptions: { keepDirtyValues: true },
      });
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit((data) => setRecord(data))}>
          {fields.map((field, index) => (
            <div key={field.id}>
              <input {...register(`test.${index}.value`)} />
              <button type="button" onClick={() => remove(index)}>
                remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({})}>
            append
          </button>
          <button type="submit">submit</button>
          <p data-testid="fields-count">{fields.length}</p>
        </form>
      );
    }

    render(<App />);

    // Initial state: 1 field
    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');

    // Step 1: Append and fill
    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    expect(screen.getByTestId('fields-count')).toHaveTextContent('2');

    const inputs = screen.getAllByRole('textbox');
    fireEvent.change(inputs[1], { target: { value: 'bar' } });

    // Step 2: Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    });
    expect(screen.getByTestId('fields-count')).toHaveTextContent('2');

    // Step 3: Delete the appended element
    fireEvent.click(screen.getAllByRole('button', { name: 'remove' })[1]);
    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');

    // Step 4: Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    });
    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');

    // Step 5: Delete the only element left
    fireEvent.click(screen.getByRole('button', { name: 'remove' }));
    expect(screen.getByTestId('fields-count')).toHaveTextContent('0');

    // Step 6: Submit
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'submit' }));
    });
    expect(screen.getByTestId('fields-count')).toHaveTextContent('0');

    // Step 7: Append - should add exactly ONE element
    fireEvent.click(screen.getByRole('button', { name: 'append' }));
    expect(screen.getByTestId('fields-count')).toHaveTextContent('1');
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });
});
