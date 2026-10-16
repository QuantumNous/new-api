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
import type { Control, FieldPath } from '../../types';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('append', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should append dirtyFields fields correctly', async () => {
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
      const { fields, append } = useFieldArray({
        control,
        name: 'test',
      });

      dirtyInputs = dirtyFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          {dirtyFields.test?.length && 'dirty'}
        </form>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { value: 'test' },
    });
    fireEvent.blur(screen.getAllByRole('textbox')[0]);

    expect(await screen.findByText('dirty')).toBeVisible();

    expect(dirtyInputs).toEqual({
      test: [{ value: true }],
    });

    fireEvent.click(screen.getByRole('button'));

    expect(dirtyInputs).toEqual({
      test: [{ value: true }, undefined, undefined, { value: true }],
    });
  });

  it('should not mark unrelated fields as dirty when appending to field array', async () => {
    let dirtyInputs = {};
    const Component = () => {
      const {
        register,
        control,
        formState: { dirtyFields },
      } = useForm<{
        name: string;
        age: number;
        items: { value: string }[];
      }>({
        defaultValues: {
          name: 'John',
          age: 30,
          items: [],
        },
      });
      const { fields, append } = useFieldArray({
        control,
        name: 'items',
      });

      dirtyInputs = dirtyFields;

      return (
        <form>
          <input {...register('name')} />
          <input {...register('age')} />
          {fields.map((field, i) => (
            <input key={field.id} {...register(`items.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: 'new' })}>
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(dirtyInputs).toEqual({
        items: [{ value: true }],
      });
    });
  });

  it('should append data into the fields', () => {
    let currentFields: unknown[] = [];
    const Component = () => {
      const { register, control } = useForm<{
        test: { test: string }[];
      }>();
      const { fields, append } = useFieldArray({
        control,
        name: 'test',
      });

      currentFields = fields;

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
          <button type={'button'} onClick={() => append({ test: 'test' })}>
            append
          </button>
          <button
            type={'button'}
            onClick={() =>
              append([{ test: 'test-batch' }, { test: 'test-batch1' }])
            }
          >
            appendBatch
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    expect(currentFields).toEqual([{ id: '0', test: 'test' }]);

    fireEvent.click(screen.getByRole('button', { name: 'append' }));

    expect(currentFields).toEqual([
      { id: '0', test: 'test' },
      { id: '2', test: 'test' },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'appendBatch' }));

    expect(currentFields).toEqual([
      { id: '0', test: 'test' },
      { id: '2', test: 'test' },
      { id: '5', test: 'test-batch' },
      { id: '6', test: 'test-batch1' },
    ]);
  });

  it.each(['isDirty', 'dirtyFields'])(
    'should be dirtyFields when value is appended with %s',
    () => {
      let isDirtyValue;
      let dirtyValue;

      const Component = () => {
        const {
          register,
          control,
          formState: { isDirty, dirtyFields },
        } = useForm<{
          test: { test: string }[];
        }>();
        const { fields, append } = useFieldArray({
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
            <button type={'button'} onClick={() => append({ test: 'test' })}>
              append
            </button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'append' }));

      fireEvent.click(screen.getByRole('button', { name: 'append' }));

      fireEvent.click(screen.getByRole('button', { name: 'append' }));

      expect(isDirtyValue).toBeTruthy();
      expect(dirtyValue).toEqual({
        test: [{ test: true }, { test: true }, { test: true }],
      });
    },
  );

  it('should trigger reRender when user is watching the all field array', () => {
    const watched: unknown[] = [];
    const Component = () => {
      const { register, watch, control } = useForm<{
        test: { value: string }[];
      }>();
      const { fields, append } = useFieldArray({
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
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(watched).toEqual([
      {},
      { test: [] },
      { test: [{ value: '' }] },
      { test: [{ value: '' }] },
    ]);
  });

  it('should focus if shouldFocus is true', () => {
    const Component = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: { test: [{ value: '1' }, { value: '2' }] },
      });
      const { fields, append } = useFieldArray({ control, name: 'test' });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: '3' })}>
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    expect(inputs).toHaveLength(3);

    expect(document.activeElement).toEqual(inputs[2]);
  });

  it('should not focus if shouldFocus is false', () => {
    const Component = () => {
      const { register, control } = useForm<{
        test: { value: string }[];
      }>({
        defaultValues: { test: [{ value: '1' }, { value: '2' }] },
      });
      const { fields, append } = useFieldArray({ control, name: 'test' });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() => append({ value: '3' }, { shouldFocus: false })}
          >
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    expect(inputs).toHaveLength(3);
    expect(document.activeElement).toEqual(document.body);
  });

  it('should return watched value with watch API', async () => {
    const renderedItems: any = [];
    const Component = () => {
      const { watch, register, control } = useForm<{
        test: { value: string }[];
      }>();
      const { fields, append } = useFieldArray({
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
          <button onClick={() => append({ value: 'test' })}>append</button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    await waitFor(() =>
      expect(renderedItems).toEqual([
        undefined,
        [],
        [{ value: 'test' }],
        [{ value: 'test' }],
      ]),
    );
  });

  it('should append nested field value without its reference', () => {
    type FormValues = {
      test: { name: { deep: string } }[];
    };

    function Input({
      name,
      control,
    }: {
      name: FieldPath<FormValues>;
      control: Control<FormValues>;
    }) {
      const { field } = useController({
        name: name as 'test.0.name.deep',
        control,
      });

      return <input type="text" {...field} />;
    }

    function FieldArray({
      control,
      name,
      itemDefaultValue,
    }: {
      control: Control<FormValues>;
      name: FieldPath<FormValues>;
      itemDefaultValue: { name: { deep: string } };
    }) {
      const { fields, append } = useFieldArray({
        control,
        name: name as 'test',
      });

      return (
        <>
          {fields.map((item, index) => (
            <Input
              key={item.id}
              name={`test.${index}.name.deep`}
              control={control}
            />
          ))}
          <button type="button" onClick={() => append(itemDefaultValue)}>
            Append
          </button>
        </>
      );
    }

    function App() {
      const { control } = useForm<FormValues>({
        defaultValues: {
          test: [],
        },
      });

      return (
        <form>
          <FieldArray
            name="test"
            control={control}
            itemDefaultValue={{ name: { deep: '' } }}
          />
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '1234' },
    });

    fireEvent.click(screen.getByRole('button'));

    expect(
      (screen.getAllByRole('textbox')[1] as HTMLInputElement).value,
    ).toEqual('');
  });

  describe('with resolver', () => {
    it('should invoke resolver when formState.isValid true', async () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
        });
        const { append } = useFieldArray({ control, name: 'test' });
        return { formState, append };
      });

      result.current.formState.isValid;

      await act(async () => {
        result.current.append({ value: '1' });
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
        const { append } = useFieldArray({ control, name: 'test' });
        return { formState, append };
      });

      act(() => {
        result.current.append({ value: '1' });
      });

      expect(resolver).toHaveBeenCalled();
    });

    it('should not invoke resolver per register during append; only array-scoped + final isValid', async () => {
      const resolver = jest
        .fn()
        .mockImplementation((values) => ({ values, errors: {} }));

      const App = () => {
        const { register, formState, control } = useForm<{
          test: { value: string }[];
        }>({
          mode: VALIDATION_MODE.onTouched,
          resolver,
          defaultValues: { test: [] },
        });

        formState.isValid;

        const { fields, append } = useFieldArray({ control, name: 'test' });

        return (
          <form>
            <input {...register('test' as const)} />
            {fields.map((f, i) => (
              <input key={f.id} {...register(`test.${i}.value` as const)} />
            ))}
            <button
              type="button"
              onClick={() =>
                append([{ value: '1' }, { value: '2' }, { value: '3' }])
              }
            >
              append
            </button>
          </form>
        );
      };

      render(<App />);

      await waitFor(() =>
        expect(resolver.mock.calls.length).toBeGreaterThanOrEqual(1),
      );
      const initialCalls = resolver.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: 'append' }));

      await waitFor(async () => {
        expect((await screen.findAllByRole('textbox')).length).toBe(4); // 1 root + 3 items
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

      const { fields, append } = useFieldArray({
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
              append({
                id: 'whatever',
                test: '1234',
              });
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

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText(
        '{"test":[{"id":"1234","test":"data"},{"id":"whatever","test":"1234"}]}',
      ),
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

      const { fields, append } = useFieldArray({
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
              append({
                id: 'whatever',
                test: '1234',
              });
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

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever","test":"1234"}]}'),
    ).toBeVisible();
  });
});
