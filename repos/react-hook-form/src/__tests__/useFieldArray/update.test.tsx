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
import type { Control } from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('update', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should update dirtyFields fields correctly', async () => {
    let dirtyInputs = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: {
          test: [
            { value: 'plz change' },
            { value: 'dont change' },
            { value: 'dont change' },
          ],
        },
      });
      const { fields, update } = useFieldArray({
        control,
        name: 'test',
      });

      dirtyInputs = dirtyFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => update(0, { value: 'changed' })}>
            update
          </button>
          {dirtyFields.test?.length && 'dirty'}
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('dirty')).toBeVisible();

    expect(dirtyInputs).toEqual({
      test: [{ value: true }, undefined, undefined],
    });
  });

  it.each(['isDirty', 'dirtyFields'])('should update state with %s', () => {
    let isDirtyValue;
    let dirtyValue;

    const Component = () => {
      const {
        register,
        control,
        formState: { isDirty, dirtyFields },
      } = useForm<{
        test: { test: string }[];
      }>({
        defaultValues: {},
      });
      const { fields, update } = useFieldArray({
        control,
        name: 'test',
      });

      isDirtyValue = isDirty;
      dirtyValue = dirtyFields;

      return (
        <form>
          {fields.map((field, index) => {
            return (
              <input
                key={field.id}
                {...register(`test.${index}.test` as const)}
              />
            );
          })}
          <button type={'button'} onClick={() => update(2, { test: 'test1' })}>
            update
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    expect(isDirtyValue).toBeTruthy();
    expect(dirtyValue).toEqual({
      test: [undefined, undefined, { test: true }],
    });
  });

  it('should trigger reRender when user update input and is watching the all field array', () => {
    const watched: any[] = [];
    const Component = () => {
      const { register, watch, control } = useForm<{
        test: { value: string }[];
      }>();
      const { fields, update } = useFieldArray({
        control,
        name: 'test',
      });
      watched.push(watch());

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => update(0, { value: '' })}>
            update
          </button>
        </form>
      );
    };

    render(<Component />);

    expect(watched).toEqual([
      {},
      {
        test: [],
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    expect(watched).toEqual([
      {},
      {
        test: [],
      },
      {
        test: [
          {
            value: '',
          },
        ],
      },
      {
        test: [
          {
            value: '',
          },
        ],
      },
    ]);
  });

  it('should return watched value with update and watch API', async () => {
    const renderedItems: any = [];
    const Component = () => {
      const { watch, register, control } = useForm<{
        test: { value: string }[];
      }>();
      const { fields, update } = useFieldArray({
        name: 'test',
        control,
      });
      const watched = watch('test');
      renderedItems.push(watched);
      return (
        <div>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`test.${i}.value` as const)} />
            </div>
          ))}
          <button onClick={() => update(0, { value: 'test' })}>update</button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /update/i }));

    await waitFor(() =>
      expect(renderedItems).toEqual([
        undefined,
        [],
        [{ value: 'test' }],
        [{ value: 'test' }],
      ]),
    );
  });

  it('should update group input correctly', () => {
    type FormValues = {
      test: {
        value: {
          firstName: string;
          lastName: string;
        };
      }[];
    };

    const fieldArrayValues: unknown[] = [];

    const GroupInput = ({
      control,
      index,
    }: {
      control: Control<FormValues>;
      index: number;
    }) => {
      const { field } = useController({
        control,
        name: `test.${index}.value` as const,
      });

      return (
        <div>
          <input
            value={field.value.firstName}
            onChange={(e) => {
              field.onChange({
                ...field.value,
                firstName: e.target.name,
              });
            }}
          />
          <input
            value={field.value.lastName}
            onChange={(e) => {
              field.onChange({
                ...field.value,
                lastName: e.target.name,
              });
            }}
          />
        </div>
      );
    };

    const App = () => {
      const { control } = useForm<FormValues>({
        defaultValues: {
          test: [
            {
              value: {
                firstName: 'bill',
                lastName: 'luo',
              },
            },
          ],
        },
      });
      const { fields, update } = useFieldArray({
        name: 'test',
        control,
      });

      fieldArrayValues.push(fields);

      return (
        <div>
          {fields.map((field, i) => (
            <div key={field.id}>
              <GroupInput control={control} index={i} />
            </div>
          ))}
          <button
            onClick={() =>
              update(0, {
                value: { firstName: 'firstName', lastName: 'lastName' },
              })
            }
          >
            update
          </button>
        </div>
      );
    };

    render(<App />);

    expect(fieldArrayValues.at(-1)).toEqual([
      {
        id: '0',
        value: {
          firstName: 'bill',
          lastName: 'luo',
        },
      },
    ]);

    fireEvent.click(screen.getByRole('button'));

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('firstName');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('lastName');

    // Let's check all values of renders with implicitly the number of render (for each value)
    expect(fieldArrayValues).toEqual([
      [
        {
          id: '0',
          value: {
            firstName: 'bill',
            lastName: 'luo',
          },
        },
      ],
      [
        {
          id: '0',
          value: {
            firstName: 'bill',
            lastName: 'luo',
          },
        },
      ],
      [
        {
          id: '2',
          value: {
            firstName: 'firstName',
            lastName: 'lastName',
          },
        },
      ],
    ]);
  });

  it('should update field array with single value', () => {
    let fieldArrayValues: { value: string }[] | [] = [];
    const App = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: {
          test: [
            {
              value: 'bill',
            },
          ],
        },
      });
      const { fields, update } = useFieldArray({
        name: 'test',
        control,
      });

      fieldArrayValues = fields;

      return (
        <div>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`test.${i}.value` as const)} />
            </div>
          ))}
          <button onClick={() => update(0, { value: 'test' })}>update</button>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'test',
    );

    expect(fieldArrayValues[0].value).toEqual('test');
  });

  it('should update field array with multiple values', () => {
    let fieldArrayValues: { firstName: string; lastName: string }[] | [] = [];

    const App = () => {
      const { register, control } = useForm<{
        test: { firstName: string; lastName: string }[];
      }>({
        defaultValues: {
          test: [
            {
              firstName: 'bill',
              lastName: 'luo',
            },
            {
              firstName: 'bill1',
              lastName: 'luo1',
            },
          ],
        },
      });
      const { fields, update } = useFieldArray({
        name: 'test',
        control,
      });

      fieldArrayValues = fields;

      return (
        <div>
          {fields.map((field, i) => (
            <div key={field.id}>
              <input {...register(`test.${i}.firstName` as const)} />
              <input {...register(`test.${i}.lastName` as const)} />
            </div>
          ))}
          <button
            onClick={() => {
              update(0, { firstName: 'test1', lastName: 'test2' });
              update(1, { firstName: 'test3', lastName: 'test4' });
            }}
          >
            update
          </button>
        </div>
      );
    };

    render(<App />);

    expect(fieldArrayValues).toEqual([
      {
        firstName: 'bill',
        id: '0',
        lastName: 'luo',
      },
      {
        firstName: 'bill1',
        id: '1',
        lastName: 'luo1',
      },
    ]);

    fireEvent.click(screen.getByRole('button'));

    expect(
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
    ).toEqual('test1');
    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('test2');
    expect(
      (screen.getAllByRole('textbox')[2] as HTMLInputElement).value,
    ).toEqual('test3');
    expect(
      (screen.getAllByRole('textbox')[3] as HTMLInputElement).value,
    ).toEqual('test4');

    expect(fieldArrayValues).toEqual([
      {
        firstName: 'test1',
        id: '4',
        lastName: 'test2',
      },
      {
        firstName: 'test3',
        id: '5',
        lastName: 'test4',
      },
    ]);
  });

  describe('with resolver', () => {
    it('should invoke resolver when formState.isValid true', async () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
        });
        const { update } = useFieldArray({ control, name: 'test' });
        return { formState, update };
      });

      result.current.formState.isValid;

      await act(async () => {
        result.current.update(0, { value: '1' });
      });

      expect(resolver).toHaveBeenCalledWith(
        {
          test: [{ value: '1' }],
        },
        undefined,
        {
          criteriaMode: undefined,
          fields: {},
          names: [],
        },
      );
    });

    it('should not invoke resolver when formState.isValid false', () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
        });
        const { update } = useFieldArray({ control, name: 'test' });
        return { formState, update };
      });

      act(() => {
        result.current.update(0, { value: '1' });
      });

      expect(resolver).toHaveBeenCalled();
    });

    it('should not invoke resolver per register during update; only array-scoped + final isValid', async () => {
      const resolver = jest
        .fn()
        .mockImplementation((values) => ({ values, errors: {} }));

      const App = () => {
        const { register, formState, control } = useForm<{
          test: { value: string }[];
        }>({
          mode: VALIDATION_MODE.onTouched,
          resolver,
          defaultValues: {
            test: [{ value: 'a' }, { value: 'b' }, { value: 'c' }],
          },
        });

        formState.isValid;

        const { fields, update } = useFieldArray({ control, name: 'test' });

        return (
          <form>
            <input {...register('test' as const)} />
            {fields.map((f, i) => (
              <input key={f.id} {...register(`test.${i}.value` as const)} />
            ))}
            <button type="button" onClick={() => update(1, { value: 'x' })}>
              update
            </button>
          </form>
        );
      };

      render(<App />);

      await waitFor(() =>
        expect(resolver.mock.calls.length).toBeGreaterThanOrEqual(1),
      );
      const initialCalls = resolver.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: 'update' }));

      await waitFor(async () => {
        expect((await screen.findAllByRole('textbox')).length).toBe(4);
      });

      await waitFor(() =>
        expect(resolver.mock.calls.length).toBe(initialCalls + 2),
      );
    });
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
          test: [{ id: '1234', test: 'data' }],
        },
      });

      const { fields, update } = useFieldArray({
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
              update(0, {
                id: 'whatever',
                test: '1234',
              });
            }}
          >
            update
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever","test":"1234"}]}'),
    ).toBeVisible();
  });

  it('should not omit keyName when provided and defaultValue is empty', async () => {
    type FormValues = {
      test: {
        test: string;
        id: string;
      }[];
    };

    const App = () => {
      const [data, setData] = React.useState<FormValues>();
      const { control, register, handleSubmit } = useForm<FormValues>();

      const { fields, update } = useFieldArray({
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
              update(0, {
                id: 'whatever',
                test: '1234',
              });
            }}
          >
            update
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'update' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever","test":"1234"}]}'),
    ).toBeVisible();
  });

  it('should not update errors state', async () => {
    const App = () => {
      const {
        control,
        register,
        trigger,
        formState: { errors },
      } = useForm({
        defaultValues: {
          test: [
            {
              firstName: '',
            },
          ],
        },
      });
      const { fields, update } = useFieldArray({
        name: 'test',
        control,
      });

      React.useEffect(() => {
        trigger();
      }, [trigger]);

      return (
        <form>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.firstName` as const, {
                required: 'This is required',
              })}
            />
          ))}
          <p>{errors?.test?.[0]?.firstName?.message}</p>
          <button
            type={'button'}
            onClick={() =>
              update(0, {
                firstName: 'firstName',
              })
            }
          >
            update
          </button>
        </form>
      );
    };

    render(<App />);

    expect(await screen.findByText('This is required')).toBeVisible();

    fireEvent.click(screen.getByRole('button'));

    expect(await screen.findByText('This is required')).toBeVisible();
  });
});
