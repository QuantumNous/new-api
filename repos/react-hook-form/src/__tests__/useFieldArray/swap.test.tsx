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
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import noop from '../../utils/noop';

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('swap', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should swap into pointed position', () => {
    const { result } = renderHook(() => {
      const { register, control } = useForm({
        defaultValues: { test: [{ value: '1' }] },
      });
      const methods = useFieldArray({
        control,
        name: 'test',
      });

      return { register, ...methods };
    });

    act(() => {
      result.current.append({ value: '2' });
    });

    act(() => {
      result.current.swap(0, 1);
    });

    expect(result.current.fields).toEqual([
      { id: '2', value: '2' },
      { id: '0', value: '1' },
    ]);
  });

  it('should swap data order', () => {
    const { result } = renderHook(() => {
      const { register, control } = useForm({
        defaultValues: { test: [{ value: '1' }] },
      });
      const methods = useFieldArray({
        control,
        name: 'test',
      });

      return { register, ...methods };
    });

    act(() => {
      result.current.append({ value: '2' });
    });

    act(() => {
      result.current.swap(0, 1);
    });

    expect(result.current.fields).toEqual([
      { id: '2', value: '2' },
      { id: '0', value: '1' },
    ]);
  });

  it.each(['isDirty', 'dirtyFields'])(
    'should swap dirtyFields order when formState.%s is defined',
    () => {
      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          defaultValues: { test: [{ value: '1' }] },
        });
        const methods = useFieldArray({
          control,
          name: 'test',
        });
        return {
          formState,
          ...methods,
        };
      });

      result.current.formState.isDirty;
      result.current.formState.dirtyFields;

      act(() => {
        result.current.append({ value: '2' });
      });

      act(() => {
        result.current.append({ value: '3' });
      });

      act(() => {
        result.current.swap(0, 1);
      });

      expect(result.current.formState.isDirty).toBeTruthy();
      expect(result.current.formState.dirtyFields).toEqual({
        test: [{ value: true }, { value: true }, { value: true }],
      });
    },
  );

  it('should swap errors', async () => {
    let errors: any;
    const Component = () => {
      const { register, handleSubmit, control, ...rest } = useForm({
        defaultValues: { test: [{ value: 'test' }] },
      });
      const { fields, append, swap } = useFieldArray({
        control,
        name: 'test',
      });
      errors = rest.formState.errors;

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
          <button type="button" onClick={() => swap(0, 1)}>
            swap
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(errors.test[0]).toBeUndefined());
    expect(errors.test[1]).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    expect(errors.test[0]).toBeDefined();
    expect(errors.test[1]).toBeUndefined();
  });

  it('should swap touched fields', async () => {
    let touched: any;
    const Component = () => {
      const { register, formState, control } = useForm({
        defaultValues: { test: [{ value: 'test' }] },
      });
      const { fields, append, swap } = useFieldArray({
        control,
        name: 'test',
      });

      touched = formState.touchedFields;

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
          <button type="button" onClick={() => swap(0, 1)}>
            swap
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.blur(screen.getAllByRole('textbox')[0]);

    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    expect(touched).toEqual({
      test: [undefined, { value: true }],
    });
  });

  it('should trigger reRender when user is watching the all field array', () => {
    const watched: any[] = [];
    const Component = () => {
      const { register, watch, control } = useForm({
        defaultValues: {
          test: [{ value: '1' }, { value: '2' }],
        },
      });
      const { fields, swap } = useFieldArray({
        control,
        name: 'test',
      });
      watched.push(watch());

      return (
        <form>
          {fields.map((field, i) => (
            <input key={field.id} {...register(`test.${i}.value` as const)} />
          ))}
          <button type="button" onClick={() => swap(0, 1)}>
            swap
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'swap' }));

    expect(watched).toEqual([
      { test: [{ value: '1' }, { value: '2' }] }, // first render
      { test: [{ value: '1' }, { value: '2' }] }, // render inside useEffect in useFieldArray
      { test: [{ value: '2' }, { value: '1' }] }, // render inside swap method
      { test: [{ value: '2' }, { value: '1' }] }, // render inside useEffect in useFieldArray
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
      const { fields, append, swap } = useFieldArray({
        name: 'test',
        control,
      });
      const watched = watch('test');
      const isSwapped = React.useRef(false);
      if (isSwapped.current) {
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
              swap(0, 1);
              isSwapped.current = true;
            }}
          >
            swap
          </button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.input(inputs[0], {
      target: { name: 'test[0].value', value: '111' },
    });
    fireEvent.input(inputs[1], {
      target: { name: 'test[1].value', value: '222' },
    });

    fireEvent.click(screen.getByRole('button', { name: /swap/i }));

    await waitFor(() =>
      expect(renderedItems).toEqual([
        [{ value: '222' }, { value: '111' }],
        [{ value: '222' }, { value: '111' }],
      ]),
    );
  });

  describe('with resolver', () => {
    it('should invoke resolver when formState.isValid true', async () => {
      const resolver = jest.fn().mockReturnValue({});

      const { result } = renderHook(() => {
        const { formState, control } = useForm({
          mode: VALIDATION_MODE.onChange,
          resolver,
          defaultValues: {
            test: [{ value: '1' }, { value: '2' }],
          },
        });
        const { swap } = useFieldArray({ control, name: 'test' });
        return { formState, swap };
      });

      result.current.formState.isValid;

      await act(async () => {
        result.current.swap(0, 1);
      });

      expect(resolver).toHaveBeenCalledWith(
        {
          test: [{ value: '2' }, { value: '1' }],
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
          defaultValues: {
            test: [{ value: '1' }, { value: '2' }],
          },
        });
        const { swap } = useFieldArray({ control, name: 'test' });
        return { formState, swap };
      });

      act(() => {
        result.current.swap(0, 1);
      });

      expect(resolver).toHaveBeenCalled();
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
          test: [
            { id: '1234', test: 'data' },
            { id: '4567', test: 'data1' },
          ],
        },
      });

      const { fields, swap } = useFieldArray({
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
              swap(0, 1);
            }}
          >
            swap
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'swap' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText(
        '{"test":[{"id":"4567","test":"data1"},{"id":"1234","test":"data"}]}',
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
    let k = 0;

    const App = () => {
      const [data, setData] = React.useState<FormValues>();
      const { control, register, handleSubmit } = useForm<FormValues>();

      const { fields, append, swap } = useFieldArray({
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
              swap(0, 1);
            }}
          >
            swap
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

    fireEvent.click(screen.getByRole('button', { name: 'swap' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText(
        '{"test":[{"id":"whatever1","test":"12341"},{"id":"whatever0","test":"12340"}]}',
      ),
    ).toBeVisible();
  });
});
