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
import noop from '../../utils/noop';

jest.useFakeTimers();

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('insert', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should insert data at index with single value', () => {
    const { result } = renderHook(() => {
      const { control } = useForm({
        defaultValues: {
          test: [{ test: '1' }, { test: '2' }],
        },
      });
      const { fields, insert } = useFieldArray({
        control,
        name: 'test',
      });
      return { fields, insert };
    });

    act(() => {
      result.current.insert(1, { test: '3' });
    });

    expect(result.current.fields).toEqual([
      { id: '0', test: '1' },
      { id: '4', test: '3' },
      { id: '1', test: '2' },
    ]);
  });

  it('should insert data at index with array value', () => {
    const { result } = renderHook(() => {
      const { control } = useForm({
        defaultValues: {
          test: [{ test: '1' }, { test: '2' }],
        },
      });
      const { fields, insert } = useFieldArray({
        control,
        name: 'test',
      });
      return { fields, insert };
    });

    act(() => {
      result.current.insert(1, [{ test: '3' }, { test: '4' }]);
    });

    expect(result.current.fields).toEqual([
      { id: '0', test: '1' },
      { id: '4', test: '3' },
      { id: '5', test: '4' },
      { id: '1', test: '2' },
    ]);
  });

  it.each(['isDirty', 'dirtyFields'])(
    'should insert data to formState.%s at index with single value',
    () => {
      const { result } = renderHook(() => {
        const { formState, control } = useForm<{
          test: { value: string; value1: string }[];
        }>({
          defaultValues: { test: [{ value: '1' }] },
        });
        const { fields, append, insert } = useFieldArray({
          control,
          name: 'test',
        });

        return { formState, fields, append, insert };
      });

      result.current.formState.isDirty;
      result.current.formState.dirtyFields;

      act(() => {
        result.current.append({ value: '2', value1: '' });
      });

      act(() => {
        result.current.insert(1, { value1: '3', value: '' });
      });

      expect(result.current.formState.isDirty).toBeTruthy();
      expect(result.current.formState.dirtyFields).toEqual({
        test: [
          undefined,
          { value1: true, value: true },
          { value: true, value1: true },
        ],
      });
    },
  );

  it.each(['isDirty', 'dirtyFields'])(
    'should insert data to formState.%s at index with array value',
    () => {
      const { result } = renderHook(() => {
        const { formState, control } = useForm<{
          test: { value1: string; value2: string; value: string }[];
        }>({
          defaultValues: { test: [{ value: '1' }] },
        });
        const { fields, append, insert } = useFieldArray({
          control,
          name: 'test',
        });

        return { formState, fields, append, insert };
      });

      result.current.formState.isDirty;
      result.current.formState.dirtyFields;

      act(() => {
        result.current.append({ value: '2', value1: '', value2: '' });
      });

      act(() => {
        result.current.insert(1, [
          { value1: '3', value: '', value2: '' },
          { value2: '4', value: '', value1: '' },
        ]);
      });

      expect(result.current.formState.isDirty).toBeTruthy();
      expect(result.current.formState.dirtyFields).toEqual({
        test: [
          undefined,
          { value1: true, value: true, value2: true },
          { value2: true, value: true, value1: true },
          { value: true, value1: true, value2: true },
        ],
      });
    },
  );

  it('should insert touched fields with single value', () => {
    let touched: any;
    const Component = () => {
      const { register, formState, control } = useForm({
        defaultValues: { test: [{ value: '1' }, { value: '2' }] },
      });
      const { fields, insert } = useFieldArray({
        control,
        name: 'test',
      });

      touched = formState.touchedFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() => insert(1, { value: `${fields.length}` })}
          >
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    fireEvent.blur(screen.getAllByRole('textbox')[1]);

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    expect(touched).toEqual({
      test: [{ value: true }, undefined, { value: true }],
    });
  });

  it('should insert touched fields with array value', () => {
    let touched: any;
    const Component = () => {
      const { register, formState, control } = useForm({
        defaultValues: { test: [{ value: '1' }, { value: '2' }] },
      });
      const { fields, insert } = useFieldArray({
        control,
        name: 'test',
      });

      touched = formState.touchedFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() =>
              insert(1, [
                { value: `${fields.length}` },
                { value: `${fields.length + 1}` },
              ])
            }
          >
            insert array
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.blur(screen.getAllByRole('textbox')[0]);
    fireEvent.blur(screen.getAllByRole('textbox')[1]);

    fireEvent.click(screen.getByRole('button', { name: /insert array/i }));

    expect(touched).toEqual({
      test: [{ value: true }, undefined, undefined, { value: true }],
    });
  });

  it('should insert error with single value', async () => {
    let errors: any;
    const Component = () => {
      const { register, handleSubmit, control, ...rest } = useForm();
      const { fields, append, insert } = useFieldArray({
        control,
        name: 'test',
      });

      errors = rest.formState.errors;

      return (
        <form onSubmit={handleSubmit(noop)}>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.value`, { required: true })}
            />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => insert(1, { value: '' })}>
            insert
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    await waitFor(() => expect(errors.test[0]).toBeDefined());
    expect(errors.test[1]).toBeUndefined();
    expect(errors.test[2]).toBeDefined();
  });

  it('should insert error with array value', async () => {
    let errors: any;
    const Component = () => {
      const { register, handleSubmit, control, ...rest } = useForm();
      const { fields, append, insert } = useFieldArray({
        control,
        name: 'test',
      });

      errors = rest.formState.errors;

      return (
        <form onSubmit={handleSubmit(noop)}>
          {fields.map((field, i) => (
            <input
              key={field.id}
              {...register(`test.${i}.value`, { required: true })}
            />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button
            type="button"
            onClick={() => insert(1, [{ value: '' }, { value: '' }])}
          >
            insert array
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    fireEvent.click(screen.getByRole('button', { name: /insert array/i }));

    await waitFor(() => expect(errors.test[0]).toBeDefined());
    expect(errors.test[1]).toBeUndefined();
    expect(errors.test[2]).toBeUndefined();
    expect(errors.test[3]).toBeDefined();
  });

  it('should focus if shouldFocus is true', () => {
    const Component = () => {
      const { register, control } = useForm({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, insert } = useFieldArray({ name: 'test', control });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => insert(1, { value: '' })}>
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    const inputs = screen.getAllByRole('textbox');

    expect(inputs).toHaveLength(3);
    expect(document.activeElement).toEqual(inputs[1]);
  });

  it('should not focus if shouldFocus is false', () => {
    const Component = () => {
      const { register, control } = useForm({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, insert } = useFieldArray({ name: 'test', control });

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button
            type="button"
            onClick={() => insert(1, { value: '' }, { shouldFocus: false })}
          >
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    const inputs = screen.getAllByRole('textbox');

    expect(inputs).toHaveLength(3);
    expect(document.activeElement).toEqual(document.body);
  });

  it('should trigger reRender when user is watching the all field array', () => {
    const watched: any[] = [];
    const Component = () => {
      const { register, watch, control } = useForm<{
        test: {
          value: string;
        }[];
      }>();
      const { fields, insert } = useFieldArray({
        control,
        name: 'test',
      });
      watched.push(watch());

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => insert(0, { value: '' })}>
            insert
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'insert' }));

    expect(watched).toEqual([
      {}, // first render
      { test: [] }, // render inside useEffect in useFieldArray
      { test: [{ value: '' }] }, // render inside insert method
      { test: [{ value: '' }] }, // render inside useEffect in useFieldArray
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
      const { fields, append, insert } = useFieldArray({
        name: 'test',
        control,
      });
      const watched = watch('test');
      const isInserted = React.useRef(false);
      if (isInserted.current) {
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
              insert(1, { value: 'test' });
              isInserted.current = true;
            }}
          >
            insert
          </button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.change(inputs[0], {
      target: { name: 'test[0].value', value: '111' },
    });
    fireEvent.change(inputs[1], {
      target: { name: 'test[1].value', value: '222' },
    });

    fireEvent.click(screen.getByRole('button', { name: /insert/i }));

    expect(renderedItems).toEqual([
      [{ value: '111' }, { value: 'test' }, { value: '222' }],
      [{ value: '111' }, { value: 'test' }, { value: '222' }],
    ]);
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
      const { fields, insert } = useFieldArray({
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
          <button type="button" onClick={() => insert(0, itemDefaultValue)}>
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
      (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
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
        const { insert } = useFieldArray({ control, name: 'test' });
        return { formState, insert };
      });

      result.current.formState.isValid;

      await act(async () => {
        result.current.insert(0, { value: '1' });
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
        const { insert } = useFieldArray({ control, name: 'test' });
        return { formState, insert };
      });

      act(() => {
        result.current.insert(0, { value: '1' });
      });

      expect(resolver).toHaveBeenCalled();
    });

    it('should insert update fields during async submit', () => {
      type FormValues = {
        test: { name: string }[];
      };

      function App() {
        const { register, control } = useForm<FormValues>();
        const [value, setValue] = React.useState('');
        const { fields, insert } = useFieldArray({
          control,
          name: 'test',
        });

        return (
          <div>
            <form>
              {fields.map((field, index) => {
                return (
                  <fieldset key={field.id}>
                    <input {...register(`test.${index}.name`)} />
                  </fieldset>
                );
              })}
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = e.target as HTMLFormElement;

                setTimeout(() => {
                  insert(0, {
                    name: value,
                  });
                }, 1000);

                target.reset();
              }}
            >
              <input
                name="name"
                data-testid="input"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button>submit</button>
            </form>
          </div>
        );
      }

      render(<App />);

      fireEvent.change(screen.getByTestId('input'), {
        target: {
          value: 'test',
        },
      });

      fireEvent.click(screen.getByRole('button'));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(
        (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
      ).toEqual('test');

      fireEvent.change(screen.getByTestId('input'), {
        target: {
          value: 'test1',
        },
      });

      fireEvent.click(screen.getByRole('button'));

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      expect(
        (screen.getAllByRole('textbox')[0] as HTMLInputElement).value,
      ).toEqual('test1');
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

      const { fields, insert } = useFieldArray({
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
              insert(1, {
                id: 'whatever',
                test: '1234',
              });
            }}
          >
            insert
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'insert' }));

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

      const { fields, insert } = useFieldArray({
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
              insert(0, {
                id: 'whatever',
                test: '1234',
              });
            }}
          >
            insert
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'insert' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever","test":"1234"}]}'),
    ).toBeVisible();
  });

  it('should not invoke resolver per register during insert; only array-scoped + final isValid', async () => {
    const resolver = jest
      .fn()
      .mockImplementation((values) => ({ values, errors: {} }));

    const App = () => {
      const { register, formState, control } = useForm<{
        test: { value: string }[];
      }>({
        mode: VALIDATION_MODE.onTouched,
        resolver,
        defaultValues: { test: [{ value: '1' }, { value: '2' }] },
      });
      formState.isValid;
      const { fields, insert } = useFieldArray({ control, name: 'test' });

      return (
        <form>
          {fields.map((f, i) => (
            <input key={f.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => insert(1, { value: 'x' })}>
            insert
          </button>
        </form>
      );
    };

    render(<App />);

    await waitFor(() =>
      expect(resolver.mock.calls.length).toBeGreaterThanOrEqual(1),
    );
    const initialCalls = resolver.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'insert' }));

    await waitFor(() =>
      expect(resolver.mock.calls.length).toBe(initialCalls + 2),
    );
  });
});
