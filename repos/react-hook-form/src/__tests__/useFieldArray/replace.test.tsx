import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { VALIDATION_MODE } from '../../constants';
import { useController } from '../../useController';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import { FormProvider } from '../../useFormContext';

interface TestValue {
  x: string;
}

interface DefaultValues {
  test: TestValue[];
}

let i = 0;

jest.mock('../../logic/generateId', () => () => String(i++));

describe('replace', () => {
  beforeEach(() => {
    i = 0;
  });

  it('should replace fields correctly', () => {
    let currentFields: any = [];
    const defaultValues: DefaultValues = {
      test: [{ x: '101' }, { x: '102' }, { x: '103' }],
    };

    const labelSingle = 'replace';

    const labelBatch = 'replaceBatch';

    const Component = () => {
      const { register, control } = useForm<DefaultValues>({
        defaultValues,
      });
      const { fields, replace } = useFieldArray({
        control,
        name: 'test',
      });

      currentFields = fields;

      const handleSingleReplace = () => replace({ x: '201' });

      const handleBatchReplace = () => replace([{ x: '301' }, { x: '302' }]);

      return (
        <form>
          {fields.map((field, index) => {
            return (
              <input key={field.id} {...register(`test.${index}.x` as const)} />
            );
          })}
          <button type="button" onClick={handleSingleReplace}>
            {labelSingle}
          </button>
          <button type="button" onClick={handleBatchReplace}>
            {labelBatch}
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: labelSingle }));

    expect(currentFields).toEqual([{ id: '6', x: '201' }]);

    fireEvent.click(screen.getByRole('button', { name: labelBatch }));

    expect(currentFields).toEqual([
      { id: '8', x: '301' },
      { id: '9', x: '302' },
    ]);
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

      const { fields, replace } = useFieldArray({
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
              replace([{ id: 'test', test: 'data' }]);
            }}
          >
            replace
          </button>
          <button>submit</button>
          <p>{JSON.stringify(data)}</p>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'replace' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"test","test":"data"}]}'),
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

      const { fields, append, replace } = useFieldArray({
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
              replace([{ id: 'whatever', test: 'data' }]);
            }}
          >
            replace
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

    fireEvent.click(screen.getByRole('button', { name: 'replace' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(
      await screen.findByText('{"test":[{"id":"whatever","test":"data"}]}'),
    ).toBeVisible();
  });

  it('should not replace errors state', async () => {
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
      const { fields, replace } = useFieldArray({
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
              replace([
                {
                  firstName: 'firstName',
                },
              ])
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

  it('should not affect other formState during replace action', () => {
    const ControlledInput = ({ index }: { index: number }) => {
      const { field } = useController({
        name: `fieldArray.${index}.firstName`,
      });
      return <input {...field} />;
    };

    const defaultValue = {
      firstName: 'test',
    };

    const FieldArray = () => {
      const { fields, replace } = useFieldArray({
        name: 'fieldArray',
      });

      React.useEffect(() => {
        replace([defaultValue]);
      }, [replace]);

      return (
        <div>
          {fields.map((field, index) => {
            return <ControlledInput key={field.id} index={index} />;
          })}

          <button type="button" onClick={() => replace(defaultValue)}>
            replace
          </button>
        </div>
      );
    };

    function App() {
      const form = useForm({
        mode: 'onChange',
      });
      const [, updateState] = React.useState(0);

      return (
        <FormProvider {...form}>
          <FieldArray />
          <p>{JSON.stringify(form.formState.touchedFields)}</p>
          <button onClick={() => updateState(1)}>updateState</button>
        </FormProvider>
      );
    }

    render(<App />);

    fireEvent.focus(screen.getByRole('textbox'));
    fireEvent.blur(screen.getByRole('textbox'));
    fireEvent.click(screen.getByRole('button', { name: 'replace' }));
    fireEvent.click(screen.getByRole('button', { name: 'updateState' }));

    expect(
      screen.getByText('{"fieldArray":[{"firstName":true}]}'),
    ).toBeVisible();
  });

  describe('with resolver', () => {
    it('should not invoke resolver per register during replace, but run after replace completes', async () => {
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

        const { fields, replace } = useFieldArray({ control, name: 'test' });

        return (
          <form>
            {fields.map((f, i) => (
              <input key={f.id} {...register(`test.${i}.value` as const)} />
            ))}
            <button
              type="button"
              onClick={() =>
                replace([{ value: '1' }, { value: '2' }, { value: '3' }])
              }
            >
              replace
            </button>
          </form>
        );
      };

      render(<App />);

      // wait for any initial resolver run triggered by isValid subscription
      await waitFor(() =>
        expect(resolver.mock.calls.length).toBeGreaterThanOrEqual(1),
      );
      const initialCalls = resolver.mock.calls.length;

      fireEvent.click(screen.getByRole('button', { name: 'replace' }));

      // ensure 3 inputs are mounted (all fields registered)
      await waitFor(async () => {
        expect((await screen.findAllByRole('textbox')).length).toBe(3);
      });

      // assert only two extra resolver calls: array-scoped + final isValid
      await waitFor(() =>
        expect(resolver.mock.calls.length).toBe(initialCalls + 2),
      );
    });
  });
});
