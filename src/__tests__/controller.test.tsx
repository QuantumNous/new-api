import React from 'react';
import {
  act as actComponent,
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import { Controller } from '../controller';
import type {
  Control,
  ControllerRenderProps,
  FieldValues,
  ValidateResult,
} from '../types';
import { useFieldArray } from '../useFieldArray';
import { useForm } from '../useForm';
import { FormProvider } from '../useFormContext';
import { useWatch } from '../useWatch';
import noop from '../utils/noop';

function Input<TFieldValues extends FieldValues>({
  onChange,
  onBlur,
  placeholder,
}: Pick<ControllerRenderProps<TFieldValues>, 'onChange' | 'onBlur'> & {
  placeholder?: string;
}) {
  return (
    <input
      placeholder={placeholder}
      onChange={() => onChange(1)}
      onBlur={() => onBlur()}
    />
  );
}

describe('Controller', () => {
  it('should render correctly with as with string', () => {
    const Component = () => {
      const { control } = useForm();
      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(input).toBeVisible();
    expect(input.name).toBe('test');
  });

  it('should render correctly with as with component', () => {
    const Component = () => {
      const { control } = useForm();
      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    expect(input).toBeVisible();
    expect(input?.name).toBe('test');
  });

  it('should reset value', async () => {
    const Component = () => {
      const { reset, control } = useForm();

      return (
        <>
          <Controller
            defaultValue="default"
            name="test"
            render={({ field }) => <input {...field} />}
            control={control}
          />
          <button
            type="button"
            onClick={() =>
              reset({
                test: 'default',
              })
            }
          >
            reset
          </button>
        </>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'test' } });
    expect(screen.getByRole('textbox')).toHaveValue('test');

    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(screen.getByRole('textbox')).toHaveValue('default');
  });

  it('should set defaultValue to value props when input was reset', () => {
    const Component = () => {
      const { reset, control } = useForm<{
        test: string;
      }>();

      React.useEffect(() => {
        reset({ test: 'default' });
      }, [reset]);

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    expect(screen.getByRole('textbox')).toHaveValue('default');
  });

  it('should render when registered field values are updated', () => {
    const Component = () => {
      const { control } = useForm();
      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'test' } });

    expect(screen.getByRole('textbox')).toHaveValue('test');
  });

  it("should trigger component's onChange method and invoke setValue method", () => {
    let fieldValues: unknown;
    const Component = () => {
      const { control, getValues } = useForm();

      return (
        <>
          <Controller
            defaultValue=""
            name="test"
            render={({ field }) => <input {...field} />}
            control={control}
          />
          <button onClick={() => (fieldValues = getValues())}>getValues</button>
        </>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), {
      target: { value: 'test' },
    });

    fireEvent.click(screen.getByRole('button', { name: /getValues/ }));

    expect(fieldValues).toEqual({ test: 'test' });
  });

  it.each([
    'isSubmitted',
    'submitCount',
    'isSubmitting',
    'isSubmitSuccessful',
    'disabled',
    'defaultValues',
  ] as const)(
    'should update submitted values when controller render accesses formState.%s',
    async (formStateProp) => {
      const onSubmit = jest.fn();

      const Component = () => {
        const { control, handleSubmit } = useForm({
          defaultValues: {
            name: 'foo',
            type: 'bar',
          },
        });

        return (
          <form onSubmit={handleSubmit(onSubmit)}>
            <Controller
              name="type"
              control={control}
              render={({ field, formState }) => (
                <>
                  <input {...field} />
                  <p>{String(formState[formStateProp])}</p>
                </>
              )}
            />
            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <button type="button" onClick={() => field.onChange('test')}>
                  Change Name
                </button>
              )}
            />
            <button type="submit">Submit</button>
          </form>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'Change Name' }));
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith(
          {
            name: 'test',
            type: 'bar',
          },
          expect.anything(),
        ),
      );
    },
  );

  it("should trigger component's onChange method and invoke trigger method", async () => {
    let errors: any;
    const Component = () => {
      const { control, ...rest } = useForm({ mode: 'onChange' });

      errors = rest.formState.errors;

      return (
        <Controller
          defaultValue="test"
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
          rules={{ required: true }}
        />
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), {
      target: { value: '' },
    });

    await waitFor(() => expect(errors.test).toBeDefined());
  });

  it("should trigger component's onBlur method and invoke trigger method", async () => {
    let errors: any;
    const Component = () => {
      const { control, ...rest } = useForm({ mode: 'onBlur' });

      errors = rest.formState.errors;

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
          rules={{ required: true }}
        />
      );
    };

    render(<Component />);

    fireEvent.blur(screen.getByRole('textbox'), {
      target: { value: '' },
    });

    await waitFor(() => expect(errors.test).toBeDefined());
  });

  it('should set field to formState.touchedFields', async () => {
    let touched: any;
    const Component = () => {
      const { control, formState } = useForm({ mode: 'onBlur' });

      touched = formState.touchedFields;

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    fireEvent.blur(screen.getByRole('textbox'));

    expect(touched).toEqual({ test: true });
  });

  it('should set field to formState validatingFields and render field isValidating state', async () => {
    jest.useFakeTimers();

    const getValidateMock: (timeout: number) => Promise<ValidateResult> = (
      timeout: number,
    ) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(true);
        }, timeout);
      });
    };

    let validatingFields: any;
    const Component = () => {
      const { control, formState } = useForm({ mode: 'onBlur' });

      validatingFields = formState.validatingFields;

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field, fieldState }) => (
            <>
              <div>isValidating: {String(fieldState.isValidating)}</div>
              <input {...field} />
            </>
          )}
          control={control}
          rules={{
            validate: () => getValidateMock(1000),
          }}
        />
      );
    };

    render(<Component />);

    expect(validatingFields).toEqual({});
    expect(screen.getByText('isValidating: false')).toBeVisible();

    fireEvent.blur(screen.getByRole('textbox'));

    expect(validatingFields).toEqual({ test: true });
    expect(screen.getByText('isValidating: true')).toBeVisible();

    await actComponent(async () => {
      jest.advanceTimersByTime(1100);
    });

    expect(validatingFields).toEqual({});
    expect(screen.getByText('isValidating: false')).toBeVisible();
  });

  it('should call trigger method when re-validate mode is onBlur with blur event', async () => {
    const Component = () => {
      const {
        handleSubmit,
        control,
        formState: { errors },
      } = useForm({
        reValidateMode: 'onBlur',
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          <Controller
            defaultValue=""
            name="test"
            render={({ field }) => <input {...field} />}
            control={control}
            rules={{ required: true }}
          />
          {errors.test && <span role="alert">required</span>}
          <button>submit</button>
        </form>
      );
    };
    render(<Component />);

    fireEvent.blur(screen.getByRole('textbox'), {
      target: {
        value: '',
      },
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fireEvent.submit(screen.getByRole('button'));

    fireEvent.input(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    expect(await screen.findByRole('alert')).toBeVisible();

    fireEvent.blur(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    await waitForElementToBeRemoved(screen.queryByRole('alert'));
  });

  it('should invoke custom event named method', () => {
    let fieldValues: any;
    const Component = () => {
      const { control, getValues } = useForm();
      return (
        <>
          <Controller
            defaultValue=""
            name="test"
            render={({ field: props }) => {
              return <input {...props} />;
            }}
            control={control}
          />
          <button onClick={() => (fieldValues = getValues())}>getValues</button>
        </>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /getValues/ }));

    expect(fieldValues).toEqual({ test: 'test' });
  });

  it('should invoke custom onChange method', () => {
    const onChange = jest.fn();
    const Component = () => {
      const { control } = useForm<{
        test: string;
      }>();
      return (
        <>
          <Controller
            defaultValue=""
            name="test"
            render={({ field: { onBlur, value } }) => {
              return (
                <Input placeholder="test" {...{ onChange, onBlur, value }} />
              );
            }}
            control={control}
          />
        </>
      );
    };

    render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    expect(onChange).toHaveBeenCalled();
  });

  it('should invoke custom onBlur method', () => {
    const onBlur = jest.fn();
    const Component = () => {
      const { control } = useForm();
      return (
        <>
          <Controller
            defaultValue=""
            name="test"
            render={({ field: { onChange, value } }) => {
              return <Input {...{ onChange, onBlur, value }} />;
            }}
            control={control}
          />
        </>
      );
    };

    render(<Component />);

    fireEvent.blur(screen.getByRole('textbox'));

    expect(onBlur).toHaveBeenCalled();
  });

  it('should update rules when rules gets updated', () => {
    let fieldsRef: any;
    const Component = ({ required = true }: { required?: boolean }) => {
      const { control } = useForm();
      fieldsRef = control._fields;
      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          rules={{ required }}
          control={control}
        />
      );
    };
    const { rerender } = render(<Component />);

    rerender(<Component required={false} />);

    expect(fieldsRef.test.required).toBeFalsy();
  });

  it('should set initial state from unmount state', () => {
    const Component = ({ isHide }: { isHide?: boolean }) => {
      const { control } = useForm();
      return isHide ? null : (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input {...field} />}
          control={control}
        />
      );
    };

    const { rerender } = render(<Component />);

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'test' } });

    rerender(<Component isHide />);

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    rerender(<Component />);

    expect(screen.getByRole('textbox')).toHaveValue('test');
  });

  it('should skip validation when Controller is unmounted', async () => {
    const onValid = jest.fn();
    const onInvalid = jest.fn();

    const App = () => {
      const [show, setShow] = React.useState(true);
      const { control, handleSubmit } = useForm();

      return (
        <form onSubmit={handleSubmit(onValid, onInvalid)}>
          {show && (
            <Controller
              render={({ field }) => <input {...field} />}
              name={'test'}
              rules={{
                required: true,
              }}
              control={control}
            />
          )}
          <button type={'button'} onClick={() => setShow(false)}>
            toggle
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(onInvalid).toHaveBeenCalledTimes(1));
    expect(onValid).toHaveBeenCalledTimes(0);

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(onInvalid).toHaveBeenCalledTimes(1);
  });

  it('should not set initial state from unmount state when input is part of field array', () => {
    const Component = () => {
      const { control } = useForm<{
        test: { value: string }[];
      }>();
      const { fields, append, remove } = useFieldArray({
        name: 'test',
        control,
      });

      return (
        <form>
          {fields.map((field, i) => (
            <Controller
              key={field.id}
              defaultValue={field.value}
              name={`test.${i}.value` as const}
              render={({ field }) => <input {...field} />}
              control={control}
            />
          ))}
          <button type="button" onClick={() => append({ value: 'test' })}>
            append
          </button>
          <button type="button" onClick={() => remove(0)}>
            remove
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    fireEvent.input(screen.getByRole('textbox'), { target: { value: 'test' } });

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));

    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    expect(screen.getByRole('textbox')).toHaveValue('test');
  });

  it('should not assign default value when field is removed with useFieldArray', () => {
    const Component = () => {
      const { control } = useForm();
      const { fields, append, remove } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form>
          {fields.map((field, i) => (
            <div key={field.id}>
              <Controller
                render={({ field }) => <input {...field} />}
                name={`test.${i}.value`}
                defaultValue={''}
                control={control}
              />
              <button type="button" onClick={() => remove(i)}>
                remove{i}
              </button>
            </div>
          ))}
          <button type="button" onClick={() => append({ value: '' })}>
            append
          </button>
        </form>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));
    fireEvent.click(screen.getByRole('button', { name: /append/i }));

    const inputs = screen.getAllByRole('textbox');

    fireEvent.input(inputs[0], {
      target: { value: '1' },
    });

    fireEvent.input(inputs[1], {
      target: { value: '2' },
    });

    fireEvent.input(inputs[2], {
      target: { value: '3' },
    });

    fireEvent.click(screen.getByRole('button', { name: /remove1/i }));

    expect(screen.getAllByRole('textbox')[0]).toHaveValue('1');
    expect(screen.getAllByRole('textbox')[1]).toHaveValue('3');
  });

  it('should validate input when input is touched and with onTouched mode', async () => {
    let currentErrors: any = {};
    const Component = () => {
      const {
        formState: { errors },
        control,
      } = useForm<{ test: string }>({
        mode: 'onTouched',
      });

      currentErrors = errors;

      return (
        <form>
          <Controller
            name={'test'}
            control={control}
            defaultValue=""
            rules={{ required: true }}
            render={({ field }) => <input {...field} />}
          />
        </form>
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox');

    fireEvent.blur(input);

    await waitFor(() => expect(currentErrors.test).not.toBeUndefined());

    fireEvent.input(input, {
      target: { value: '1' },
    });

    await waitFor(() => expect(currentErrors.test).toBeUndefined());
  });

  it('should show invalid input when there is an error', async () => {
    const Component = () => {
      const { control } = useForm({
        mode: 'onChange',
      });

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field: props, fieldState }) => (
            <>
              <input {...props} />
              {fieldState.invalid && <p>Input is invalid.</p>}
            </>
          )}
          control={control}
          rules={{
            required: true,
          }}
        />
      );
    };

    render(<Component />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    expect(screen.queryByText('Input is invalid.')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: '',
      },
    });

    expect(await screen.findByText('Input is invalid.')).toBeVisible();
  });

  it('should show input has been touched.', async () => {
    const Component = () => {
      const { control } = useForm();

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field: props, fieldState }) => (
            <>
              <input {...props} />
              {fieldState.isTouched && <p>Input is touched.</p>}
            </>
          )}
          control={control}
          rules={{
            required: true,
          }}
        />
      );
    };

    render(<Component />);

    expect(screen.queryByText('Input is touched.')).not.toBeInTheDocument();

    fireEvent.blur(screen.getByRole('textbox'));

    expect(await screen.findByText('Input is touched.')).toBeVisible();
  });

  it('should show input is dirty.', async () => {
    const Component = () => {
      const { control } = useForm();

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field: props, fieldState }) => (
            <>
              <input {...props} />
              {fieldState.isDirty && <p>Input is dirty.</p>}
            </>
          )}
          control={control}
          rules={{
            required: true,
          }}
        />
      );
    };

    render(<Component />);

    expect(screen.queryByText('Input is dirty.')).not.toBeInTheDocument();

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'dirty' } });

    expect(await screen.findByText('Input is dirty.')).toBeVisible();
  });

  it('should display input error.', async () => {
    const Component = () => {
      const { control } = useForm({
        mode: 'onChange',
      });

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field: props, fieldState }) => (
            <>
              <input {...props} />
              {fieldState.error && <p>{fieldState.error.message}</p>}
            </>
          )}
          control={control}
          rules={{
            required: 'This is required',
          }}
        />
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'q' } });
    fireEvent.change(input, { target: { value: '' } });

    expect(await screen.findByText('This is required')).toBeVisible();
  });

  it('should not trigger extra-render while not subscribed to any input state', () => {
    let count = 0;

    const Component = () => {
      const { control } = useForm();
      count++;

      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field: props, fieldState }) => (
            <>
              <input {...props} />
              {fieldState.isTouched && <p>Input is dirty.</p>}
            </>
          )}
          control={control}
          rules={{
            required: true,
          }}
        />
      );
    };

    render(<Component />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'test',
      },
    });

    expect(count).toEqual(2);
  });

  it('should update Controller value with setValue', () => {
    const Component = () => {
      const { control, setValue } = useForm<{
        test: string;
      }>();

      React.useEffect(() => {
        setValue('test', 'data');
      }, [setValue]);

      return (
        <Controller
          name={'test'}
          control={control}
          render={({ field }) => <input {...field} />}
          defaultValue=""
        />
      );
    };

    render(<Component />);

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'data',
    );
  });

  it('should retain default value or defaultValues at Controller', () => {
    let getValuesMethod = noop;
    const Component = () => {
      const { control, getValues } = useForm<{
        test: number;
        test1: number;
      }>({
        defaultValues: {
          test: 2,
        },
      });

      getValuesMethod = getValues;

      return (
        <>
          <Controller
            render={({ field }) => <input {...field} />}
            name={'test'}
            control={control}
          />
          <Controller
            render={({ field }) => <input {...field} />}
            name={'test1'}
            defaultValue={1}
            control={control}
          />
        </>
      );
    };

    render(<Component />);

    expect(getValuesMethod()).toEqual({
      test: 2,
      test1: 1,
    });
  });

  it('should return correct isValid formState when input ref is not registered', async () => {
    const Component = () => {
      const {
        control,
        formState: { isValid },
      } = useForm<{
        test: string;
        test1: string;
      }>({
        mode: 'onChange',
        defaultValues: {
          test: '2',
          test1: '2',
        },
      });

      return (
        <>
          <Controller
            render={({ field }) => (
              <input value={field.value} onChange={field.onChange} />
            )}
            rules={{ required: true }}
            name={'test'}
            control={control}
          />
          <Controller
            render={({ field }) => (
              <input value={field.value} onChange={field.onChange} />
            )}
            rules={{ required: true }}
            name={'test1'}
            control={control}
          />
          {isValid ? 'true' : 'false'}
        </>
      );
    };

    render(<Component />);

    expect(screen.getByText('false')).toBeVisible();

    fireEvent.change(screen.getAllByRole('textbox')[0], {
      target: {
        value: '',
      },
    });

    expect(await screen.findByText('false')).toBeVisible();

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: {
        value: 'test',
      },
    });

    expect(await screen.findByText('true')).toBeVisible();
  });

  it('should subscribe the correct dirty fields', () => {
    type FormValues = {
      test: string;
    };

    const Component = () => {
      const {
        control,
        formState: { dirtyFields, isDirty },
      } = useForm<FormValues>({
        defaultValues: {
          test: '',
        },
      });

      return (
        <>
          <Controller
            control={control}
            name={'test'}
            render={({ field }) => <input {...field} />}
          />
          <p>{JSON.stringify(dirtyFields)}</p>
          <p>{isDirty ? 'true' : 'false'}</p>
        </>
      );
    };

    render(<Component />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '1' } });

    expect(screen.getByText('{"test":true}')).toBeVisible();
    expect(screen.getByText('true')).toBeVisible();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });

    expect(screen.getByText('{}')).toBeVisible();
    expect(screen.getByText('false')).toBeVisible();
  });

  it('should remove input value and reference with Controller and set shouldUnregister: true', () => {
    type FormValue = {
      test: string;
    };
    const watchedValue: FormValue[] = [];
    const Component = () => {
      const { control, watch } = useForm<FormValue>({
        defaultValues: {
          test: 'bill',
        },
      });
      const [show, setShow] = React.useState(true);
      watchedValue.push(watch());

      return (
        <>
          {show && (
            <Controller
              control={control}
              name={'test'}
              shouldUnregister
              render={({ field }) => <input {...field} />}
            />
          )}
          <button onClick={() => setShow(false)}>hide</button>
        </>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    expect(watchedValue).toEqual([
      {
        test: 'bill',
      },
      {
        test: 'bill',
      },
      {
        test: 'bill',
      },
      {},
    ]);
  });

  it('should set ref to empty object when ref is not defined', async () => {
    const App = () => {
      const [show, setShow] = React.useState(false);
      const { control } = useForm({
        mode: 'onChange',
        defaultValues: {
          test: '',
        },
      });

      return (
        <div>
          {show && (
            <Controller
              name={'test'}
              rules={{ required: true }}
              control={control}
              render={({ field }) => (
                <input value={field.value} onChange={field.onChange} />
              )}
            />
          )}
          <button onClick={() => setShow(!show)}>setShow</button>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    const input = screen.getByRole('textbox');

    fireEvent.change(input, {
      target: { value: 'test' },
    });

    // Everything should be fine even if no ref on the controlled input
    await waitFor(() => expect(input).toHaveValue('test'));
  });

  it('should transform input value instead update via ref', () => {
    type FormValues = {
      test: number;
    };

    const transform = {
      input: (x: number) => x / 10,
    };

    function App() {
      const { control } = useForm<FormValues>({
        defaultValues: {
          test: 7200,
        },
      });

      return (
        <Controller
          name="test"
          control={control}
          render={({ field }) => (
            <input
              type="number"
              {...field}
              value={transform.input(+field.value)}
              placeholder="test"
            />
          )}
        />
      );
    }

    render(<App />);

    expect(
      (screen.getByPlaceholderText('test') as HTMLInputElement).value,
    ).toEqual('720');
  });

  it('should mark mounted inputs correctly within field array', async () => {
    const App = () => {
      const {
        control,
        handleSubmit,
        formState: { errors },
      } = useForm({
        defaultValues: {
          test: [{ firstName: 'test' }],
        },
      });
      const { fields, prepend } = useFieldArray({
        control,
        name: 'test',
      });

      return (
        <form onSubmit={handleSubmit(noop)}>
          {fields.map((field, index) => {
            return (
              <div key={field.id}>
                <Controller
                  control={control}
                  render={({ field }) => <input {...field} />}
                  name={`test.${index}.firstName`}
                  rules={{ required: true }}
                />
                {errors?.test?.[index]?.firstName && <p>error</p>}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() =>
              prepend({
                firstName: '',
              })
            }
          >
            prepend
          </button>
          <button>submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    fireEvent.click(screen.getByRole('button', { name: 'prepend' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('error')).toBeVisible();
  });

  it('should not throw type error with field state', () => {
    type FormValues = {
      firstName: string;
      deepNested: {
        test: string;
      };
      todos: string[];
      nestedValue: { test: string };
    };

    function App() {
      const { control } = useForm<FormValues>({
        defaultValues: {
          firstName: '',
          deepNested: { test: '' },
          todos: [],
          nestedValue: { test: '' },
        },
      });

      return (
        <form>
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="firstName"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="deepNested.test"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="todos"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...{ ...field, value: field.value.test }} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="nestedValue"
          />
        </form>
      );
    }

    render(<App />);

    expect(screen.getAllByRole('textbox').length).toEqual(4);
  });

  it('should not cause type error with any', () => {
    function App() {
      const { control } = useForm({
        defaultValues: {
          firstName: '',
          deepNested: { test: '' },
          todos: [],
          nestedValue: { test: '' },
        },
      });

      return (
        <form>
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="firstName"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="deepNested.test"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="todos"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...{ ...field, value: field.value.test }} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="nestedValue"
          />
        </form>
      );
    }

    render(<App />);

    expect(screen.getAllByRole('textbox').length).toEqual(4);
  });

  it('should not cause type error without generic type', () => {
    function App() {
      const { control } = useForm({
        defaultValues: {
          firstName: '',
          deepNested: { test: '' },
          todos: [],
          nestedValue: { test: '' },
        },
      });

      return (
        <form>
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="firstName"
          />
          <Controller
            render={({ field, fieldState }) => (
              <>
                <input {...field} />
                <p>{fieldState.error?.message}</p>
              </>
            )}
            control={control}
            name="deepNested.test"
          />
          <Controller
            render={({ field }) => (
              <>
                <input {...field} />
              </>
            )}
            control={control}
            name="todos"
          />
          <Controller
            render={({ field }) => (
              <>
                <input {...{ ...field, value: field.value.test }} />
              </>
            )}
            control={control}
            name="nestedValue"
          />
        </form>
      );
    }

    render(<App />);

    expect(screen.getAllByRole('textbox').length).toEqual(4);
  });

  it('should unregister component within field array when field is unmounted', () => {
    const getValueFn = jest.fn();

    const Child = () => {
      const { fields } = useFieldArray({
        name: 'names',
      });
      const show = useWatch({ name: 'show' });

      return (
        <>
          <Controller
            name={'show'}
            render={({ field }) => (
              <input
                {...field}
                checked={field.value}
                type="checkbox"
                data-testid="checkbox"
              />
            )}
          />

          {fields.map((field, i) => (
            <div key={field.id}>
              {show && (
                <Controller
                  shouldUnregister
                  name={`names.${i}.firstName`}
                  render={({ field }) => <input {...field} />}
                />
              )}
            </div>
          ))}
        </>
      );
    };

    function App() {
      const methods = useForm({
        defaultValues: { show: true, names: [{ firstName: '' }] },
      });

      return (
        <FormProvider {...methods}>
          <Child />
          <button
            onClick={() => {
              getValueFn(methods.getValues());
            }}
          >
            getValues
          </button>
        </FormProvider>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(getValueFn).toHaveBeenCalledWith({
      names: [{ firstName: '' }],
      show: true,
    });

    fireEvent.click(screen.getByTestId('checkbox'));
    fireEvent.click(screen.getByRole('button'));

    expect(getValueFn).toHaveBeenCalledWith({
      show: false,
    });
  });

  it('should set up defaultValues for controlled component with values prop', () => {
    function App() {
      const { control } = useForm({
        values: {
          firstName: 'test',
        },
      });

      return (
        <Controller
          render={({ field }) => <input {...field} />}
          control={control}
          name="firstName"
        />
      );
    }

    render(<App />);

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'test',
    );
  });

  it('should re-render on change with single value array', async () => {
    function App() {
      const { control, handleSubmit } = useForm<{ numbers: number[] }>();

      return (
        <form onSubmit={handleSubmit(noop)}>
          <Controller
            control={control}
            name="numbers"
            rules={{
              required: 'required',
              validate: () => {
                return 'custom';
              },
            }}
            render={({ field, fieldState }) => (
              <>
                <button type="button" onClick={() => field.onChange([1])}>
                  [1]
                </button>
                <p data-testid="error">{fieldState.error?.message}</p>
              </>
            )}
          />
          <button type="submit">submit</button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('required')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '[1]' }));

    expect(await screen.findByText('custom')).toBeVisible();
  });

  it('should not require type coercion', async () => {
    function App() {
      class NonCoercible {
        x: string;

        constructor(x: string) {
          this.x = x;
        }

        [Symbol.toPrimitive]() {
          throw new TypeError();
        }
      }

      const { control } = useForm({
        mode: 'onChange',
        defaultValues: {
          value: new NonCoercible('a'),
        },
      });

      return (
        <form>
          <Controller
            control={control}
            name="value"
            rules={{
              validate: (field) => {
                return field.x.length > 0;
              },
            }}
            render={({ field }) => (
              <input
                value={field.value.x}
                onChange={(e) =>
                  field.onChange(new NonCoercible(e.target.value))
                }
              />
            )}
          />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByRole('textbox'), {
      target: {
        value: 'b',
      },
    });

    expect(screen.getByRole('textbox')).toHaveValue('b');
  });

  it('should respect disabled state set on the input element', () => {
    const Component = () => {
      const { control } = useForm();
      return (
        <Controller
          defaultValue=""
          name="test"
          render={({ field }) => <input disabled {...field} />}
          control={control}
        />
      );
    };

    render(<Component />);

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should respect disabled state set on the Controller component', () => {
    const Component = () => {
      const { control } = useForm();

      const [disabled, setDisabled] = React.useState(true);

      return (
        <>
          <Controller
            defaultValue=""
            name="test"
            disabled={disabled}
            render={({ field }) => <input {...field} />}
            control={control}
          />
          <button onClick={() => setDisabled(false)}>disable</button>
        </>
      );
    };

    render(<Component />);

    expect(screen.getByRole('textbox')).toBeDisabled();

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('textbox')).toBeEnabled();
  });

  it('should create error object when the value is Invalid Date during onChange event', async () => {
    let currentErrors: any = {};
    const name = 'test';
    const Component = () => {
      const {
        control,
        formState: { errors },
      } = useForm({ mode: 'onChange' });
      const [text, setText] = React.useState('');
      currentErrors = errors;

      return (
        <form>
          <Controller
            defaultValue=""
            name={name}
            control={control}
            render={({ field: { onChange } }) => (
              <input
                type="text"
                value={text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setText(e.target.value);
                  const dateValue = new Date(e.target.value);
                  onChange(dateValue);
                }}
              />
            )}
            rules={{
              validate: (v) => !(v instanceof Date && isNaN(v.getTime())),
            }}
          />
        </form>
      );
    };

    render(<Component />);

    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => expect(currentErrors).toHaveProperty(name));

    fireEvent.change(input, { target: { value: '2024-10-16' } });

    await waitFor(() => expect(currentErrors).not.toHaveProperty(name));
  });

  it('should recover memoized Controller field after reset without rerender', async () => {
    type FormValues = {
      test: string;
    };

    const MemoField = React.memo(
      ({ control }: { control: Control<FormValues> }) => (
        <Controller
          control={control}
          name="test"
          render={({ field }) => (
            <input value={field.value} onChange={field.onChange} />
          )}
        />
      ),
    );

    const App = () => {
      const { control, reset } = useForm<FormValues>({
        defaultValues: { test: '' },
      });

      React.useEffect(() => {
        reset({ test: '' });
      }, [reset]);

      return <MemoField control={control} />;
    };

    render(<App />);

    fireEvent.input(screen.getByRole('textbox'), {
      target: { value: 'a' },
    });

    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('a'));
  });
});
