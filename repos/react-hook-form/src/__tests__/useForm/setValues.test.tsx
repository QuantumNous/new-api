import React from 'react';
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from '@testing-library/react';

import { Controller } from '../../controller';
import { useForm } from '../../useForm';

describe('setValues', () => {
  it('should batch update multiple values', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    await act(async () => {
      result.current.setValues({
        a: '10',
        b: '20',
      });
    });

    expect(result.current.getValues()).toEqual({
      a: '10',
      b: '20',
    });
  });

  it('should support function updater', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    await act(async () => {
      result.current.setValues((values) => ({
        a: values.a + 'x',
        b: values.b + 'y',
      }));
    });

    expect(result.current.getValues()).toEqual({
      a: '1x',
      b: '2y',
    });
  });

  it('should not notify subscribers when batch values are unchanged', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    const control = result.current.control as any;
    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValues({
        a: '1',
        b: '2',
      });
    });

    const valueNotifications = nextSpy.mock.calls.filter(
      (call) =>
        call[0] != null &&
        typeof call[0] === 'object' &&
        'values' in (call[0] as Record<string, unknown>),
    );

    expect(valueNotifications).toHaveLength(0);
  });

  it('should notify subscribers only once for batch update', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    // Register a watch(fn) subscriber so values are included in notifications.
    const watchSub = result.current.watch(() => {});

    const control = result.current.control as any;
    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValues({
        a: '100',
        b: '200',
      });
    });

    watchSub.unsubscribe();

    const valueNotifications = nextSpy.mock.calls.filter(
      (call) =>
        call[0] != null &&
        typeof call[0] === 'object' &&
        'values' in (call[0] as Record<string, unknown>),
    );

    expect(valueNotifications).toHaveLength(1);
  });

  it('should notify the batch update as a whole-form change (no stale name/type)', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    // Drive a single-field change first so `_formState.name`/`type` are
    // polluted with a stale field label from the prior emit.
    await act(async () => {
      result.current.register('a');
      result.current.setValue('a', 'changed', { shouldValidate: true });
    });

    // Register a watch(fn) subscriber so values are included in notifications.
    const watchSub = result.current.watch(() => {});

    const control = result.current.control as any;
    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValues({
        a: '10',
        b: '20',
      });
    });

    watchSub.unsubscribe();

    const valueNotifications = nextSpy.mock.calls.filter(
      (call) =>
        call[0] != null &&
        typeof call[0] === 'object' &&
        'values' in (call[0] as Record<string, unknown>),
    );

    // The terminal bulk emit must announce a whole-form change. Before the
    // fix it spread the stale `_formState.name`/`type` left over from the
    // prior single-field change, causing name-gated subscribers to skip it.
    const terminal = valueNotifications.at(-1)![0] as Record<string, unknown>;
    expect(terminal.name).toBeUndefined();
    expect(terminal.type).toBeUndefined();
    expect(terminal.values).toEqual({ a: '10', b: '20' });
  });

  it('should update controlled input value when setValues is called', async () => {
    const Component = () => {
      const { control, setValues } = useForm({
        defaultValues: {
          firstName: '',
        },
      });

      return (
        <>
          <Controller
            name="firstName"
            control={control}
            render={({ field }) => <input {...field} />}
          />
          <button
            type="button"
            onClick={() =>
              setValues({
                firstName: '111',
              })
            }
          >
            set
          </button>
        </>
      );
    };

    render(<Component />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set' }));
    });

    expect(screen.getByRole('textbox')).toHaveValue('111');
  });

  it('should update registered input value when setValues is called', async () => {
    const Component = () => {
      const { register, setValues } = useForm({
        defaultValues: {
          firstName: '',
        },
      });

      return (
        <>
          <input {...register('firstName')} />
          <button
            type="button"
            onClick={() =>
              setValues({
                firstName: '111',
              })
            }
          >
            set
          </button>
        </>
      );
    };

    render(<Component />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set' }));
    });

    expect(screen.getByRole('textbox')).toHaveValue('111');
  });

  it('should not leave a stale element behind when setValues shrinks a field array', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: { name: string }[] }>({
        defaultValues: {
          test: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
        },
      }),
    );

    result.current.register('test.0.name');
    result.current.register('test.1.name');
    result.current.register('test.2.name');

    await act(async () => {
      result.current.setValues({
        test: [{ name: 'x' }, { name: 'y' }],
      });
    });

    expect(result.current.getValues()).toEqual({
      test: [{ name: 'x' }, { name: 'y' }],
    });
  });

  it('should handle setValues shrinking a field array down to empty', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: { name: string }[] }>({
        defaultValues: {
          test: [{ name: 'a' }, { name: 'b' }],
        },
      }),
    );

    result.current.register('test.0.name');
    result.current.register('test.1.name');

    await act(async () => {
      result.current.setValues({
        test: [],
      });
    });

    expect(result.current.getValues()).toEqual({ test: [] });
  });

  it('should still propagate an explicitly set undefined value to a mounted field', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: string | undefined; b: string }>({
        defaultValues: { a: '1', b: '2' },
      }),
    );

    result.current.register('a');
    result.current.register('b');

    await act(async () => {
      result.current.setValues({
        a: undefined,
        b: '2',
      });
    });

    expect(result.current.getValues()).toEqual({ a: undefined, b: '2' });
  });

  it('should update deep nested registered input values when setValues is called', async () => {
    const Component = () => {
      const { register, setValues } = useForm({
        defaultValues: {
          user: {
            profile: { firstName: 'Jane', lastName: 'Doe' },
            address: { city: 'Boston' },
          },
        },
      });

      return (
        <>
          <input
            {...register('user.profile.firstName')}
            aria-label="firstName"
          />
          <input {...register('user.profile.lastName')} aria-label="lastName" />
          <input {...register('user.address.city')} aria-label="city" />
          <button
            type="button"
            onClick={() =>
              setValues({
                user: {
                  profile: { firstName: 'John', lastName: 'Smith' },
                  address: { city: 'New York' },
                },
              })
            }
          >
            set
          </button>
        </>
      );
    };

    render(<Component />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'set' }));
    });

    expect(screen.getByLabelText('firstName')).toHaveValue('John');
    expect(screen.getByLabelText('lastName')).toHaveValue('Smith');
    expect(screen.getByLabelText('city')).toHaveValue('New York');
  });

  it('should preserve object references for untouched values instead of deep cloning per field', async () => {
    type FormValues = {
      a: { nested: string };
      b: { nested: string };
    };

    const { result } = renderHook(() =>
      useForm<FormValues>({
        defaultValues: {
          a: { nested: '1' },
          b: { nested: '2' },
        },
      }),
    );

    const nextA = { nested: '10' };
    const nextB = { nested: '20' };

    await act(async () => {
      result.current.setValues({ a: nextA, b: nextB });
    });

    const values = result.current.getValues();

    expect(values).toEqual({ a: { nested: '10' }, b: { nested: '20' } });
    // setValues must not deep-clone each field via the internal setValue call,
    // so the exact objects passed in are kept by reference.
    expect(values.a).toBe(nextA);
    expect(values.b).toBe(nextB);
  });

  it('should emit exactly one state notification for a setValues batch', async () => {
    const { result } = renderHook(() =>
      useForm<{ a: { nested: string }; b: string }>({
        defaultValues: { a: { nested: '1' }, b: 'x' },
      }),
    );

    const refA = document.createElement('div');
    act(() => {
      result.current.register('a').ref(refA);
      result.current.register('b');
    });

    const deliveredValues: object[] = [];
    const unsubscribe = result.current.subscribe({
      formState: { values: true },
      callback: (data) => deliveredValues.push(data.values),
    });

    await act(async () => {
      result.current.setValues({ a: { nested: '10' }, b: 'y' });
    });
    unsubscribe();

    // All per-field emissions are suppressed; only the single final broadcast fires.
    expect(deliveredValues.length).toBe(1);
    expect(deliveredValues[0]).toEqual({ a: { nested: '10' }, b: 'y' });
  });

  it('should propagate shouldValidate option to trigger validation and update isValid', async () => {
    const { result } = renderHook(() =>
      useForm<{ firstName: string }>({
        defaultValues: { firstName: '' },
        mode: 'onChange',
      }),
    );

    // Register the field with required validation
    act(() => {
      result.current.register('firstName', { required: true });
    });

    // Initially form should be invalid (empty required field)
    expect(result.current.formState.isValid).toBe(false);

    // Set value with shouldValidate to trigger validation
    await act(async () => {
      result.current.setValues({ firstName: 'John' }, { shouldValidate: true });
    });

    // Form should now be valid
    expect(result.current.formState.isValid).toBe(true);
    expect(result.current.getValues().firstName).toBe('John');
  });

  it('should propagate shouldDirty and shouldTouch options', async () => {
    const { result } = renderHook(() =>
      useForm<{ firstName: string; lastName: string }>({
        defaultValues: { firstName: '', lastName: '' },
      }),
    );

    // Register fields
    act(() => {
      result.current.register('firstName');
      result.current.register('lastName');
    });

    // Set values with shouldDirty and shouldTouch
    await act(async () => {
      result.current.setValues(
        { firstName: 'John', lastName: 'Doe' },
        { shouldDirty: true, shouldTouch: true },
      );
    });

    // Check that fields are marked as dirty and touched
    expect(result.current.formState.dirtyFields).toEqual({
      firstName: true,
      lastName: true,
    });
    expect(result.current.formState.touchedFields).toEqual({
      firstName: true,
      lastName: true,
    });
  });

  it('should clear errors and update isValid when revalidating with setValues', async () => {
    const { result } = renderHook(() =>
      useForm<{ email: string }>({
        defaultValues: { email: '' },
        mode: 'onChange',
      }),
    );

    // Register the field with required and email validation
    act(() => {
      result.current.register('email', {
        required: 'Email is required',
        pattern: {
          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
          message: 'Invalid email address',
        },
      });
    });

    // Initially form should be invalid
    expect(result.current.formState.isValid).toBe(false);
    expect(result.current.formState.errors.email).toBeUndefined();

    // Trigger validation by touching the field (should show error)
    await act(async () => {
      result.current.trigger('email');
    });

    // Should have error after validation
    expect(result.current.formState.errors.email).toBeDefined();
    expect(result.current.formState.isValid).toBe(false);

    // Set invalid value with validation - should still be invalid
    await act(async () => {
      result.current.setValues({ email: 'invalid' }, { shouldValidate: true });
    });

    expect(result.current.formState.isValid).toBe(false);
    expect(result.current.formState.errors.email).toBeDefined();

    // Set valid value with validation - should become valid and clear error
    await act(async () => {
      result.current.setValues(
        { email: 'test@example.com' },
        { shouldValidate: true },
      );
    });

    expect(result.current.formState.isValid).toBe(true);
    expect(result.current.formState.errors.email).toBeUndefined();
    expect(result.current.getValues().email).toBe('test@example.com');
  });

  it('should validate multiple fields and update isValid correctly', async () => {
    const { result } = renderHook(() =>
      useForm<{ username: string; email: string; age: number }>({
        defaultValues: { username: '', email: '', age: 0 },
        mode: 'onChange',
      }),
    );

    // Register fields with validation
    act(() => {
      result.current.register('username', {
        required: 'Username is required',
        minLength: {
          value: 3,
          message: 'Username must be at least 3 characters',
        },
      });
      result.current.register('email', {
        required: 'Email is required',
        pattern: {
          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
          message: 'Invalid email',
        },
      });
      result.current.register('age', {
        required: 'Age is required',
        min: { value: 18, message: 'Must be at least 18' },
      });
    });

    // Initially all fields are invalid
    expect(result.current.formState.isValid).toBe(false);

    // Set all values with validation at once
    await act(async () => {
      result.current.setValues(
        {
          username: 'john',
          email: 'john@example.com',
          age: 25,
        },
        { shouldValidate: true },
      );
    });

    // All fields should be valid now
    expect(result.current.formState.isValid).toBe(true);
    expect(result.current.formState.errors).toEqual({});
    expect(result.current.getValues()).toEqual({
      username: 'john',
      email: 'john@example.com',
      age: 25,
    });

    // Now set one invalid value - should become invalid
    await act(async () => {
      result.current.setValues({ username: 'ab' }, { shouldValidate: true });
    });

    expect(result.current.formState.isValid).toBe(false);
    expect(result.current.formState.errors.username).toBeDefined();
  });

  it('should not validate when shouldValidate is not provided', async () => {
    const { result } = renderHook(() =>
      useForm<{ firstName: string }>({
        defaultValues: { firstName: '' },
        mode: 'onChange',
      }),
    );

    // Register the field with required validation
    act(() => {
      result.current.register('firstName', { required: true });
    });

    // Initially form should be invalid
    expect(result.current.formState.isValid).toBe(false);

    // Set value without shouldValidate - should not trigger validation
    await act(async () => {
      result.current.setValues({ firstName: 'John' });
    });

    // Value is set but validation is not triggered
    expect(result.current.getValues().firstName).toBe('John');
    // isValid might still be false because validation wasn't re-run
    expect(result.current.formState.isValid).toBe(false);
  });
});
