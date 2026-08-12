import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { UseFormSubscribe } from '../../types';
import { useForm } from '../../useForm';
import { useFormState } from '../../useFormState';

describe('subscribe', () => {
  it('should properly handle multiple subscriptions', async () => {
    const callbackFn1 = jest.fn();
    const callbackFn2 = jest.fn();

    function ChildComp({
      subscribe,
    }: {
      subscribe: UseFormSubscribe<{
        first: string;
        sec: string;
      }>;
    }) {
      React.useEffect(() => {
        return subscribe({
          formState: {
            dirtyFields: true,
          },
          name: 'first',
          callback: callbackFn2,
        });
      }, [subscribe]);
      return null;
    }
    const App = () => {
      const { register, subscribe } = useForm({
        defaultValues: {
          first: '',
          sec: '',
        },
      });

      React.useEffect(() => {
        return subscribe({
          formState: {
            values: true,
          },
          name: 'sec',
          callback: callbackFn1,
        });
      }, [subscribe]);
      return (
        <form>
          <input {...register('first')} />
          <input {...register('sec')} />
          <ChildComp subscribe={subscribe} />
        </form>
      );
    };
    render(<App />);

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { name: 'first', value: 'test' },
    });

    expect(callbackFn2).toHaveBeenCalledTimes(1);
    expect(callbackFn1).toHaveBeenCalledTimes(0);

    fireEvent.input(screen.getAllByRole('textbox')[1], {
      target: { name: 'sec', value: 'test' },
    });

    expect(callbackFn2).toHaveBeenCalledTimes(1);
    expect(callbackFn1).toHaveBeenCalledTimes(1);
  });

  it('should only react to formState changes it subscribes to', async () => {
    const callbackFn = jest.fn();

    const App = () => {
      const { register, subscribe, control } = useForm({
        defaultValues: {
          first: '',
          sec: '',
        },
      });

      const fieldFormState = useFormState({
        name: 'first',
        control,
      });

      fieldFormState.touchedFields;

      React.useEffect(() => {
        return subscribe({
          formState: {
            values: true,
          },
          name: 'sec',
          callback: callbackFn,
        });
      }, [subscribe]);

      return (
        <form>
          <input {...register('first')} />
          <input {...register('sec')} />
        </form>
      );
    };
    render(<App />);

    fireEvent.blur(screen.getAllByRole('textbox')[1]);

    fireEvent.input(screen.getAllByRole('textbox')[1], {
      target: { value: 'test' },
    });

    fireEvent.input(screen.getAllByRole('textbox')[1], {
      target: { value: 'test2' },
    });

    expect(callbackFn).toHaveBeenCalledTimes(2);
  });

  it('should allow subscribing to submit state updates', async () => {
    const callbackFn = jest.fn();

    const App = () => {
      const { handleSubmit, subscribe } = useForm();

      React.useEffect(() => {
        return subscribe({
          formState: {
            isSubmitted: true,
            submitCount: true,
          },
          callback: callbackFn,
        });
      }, [subscribe]);

      return (
        <form onSubmit={handleSubmit(() => undefined)}>
          <button type="submit">Submit</button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() =>
      expect(callbackFn).toHaveBeenCalledWith(
        expect.objectContaining({
          isSubmitted: true,
          submitCount: 1,
        }),
      ),
    );
  });

  it('should not call subscribe callback when setValue is called with the same value and shouldDirty option', async () => {
    const callbackFn = jest.fn();

    const App = () => {
      const { register, setValue, subscribe } = useForm({
        defaultValues: {
          test: 'initial',
        },
      });

      React.useEffect(() => {
        return subscribe({
          formState: {
            values: true,
          },
          callback: callbackFn,
        });
      }, [subscribe]);

      return (
        <form>
          <input {...register('test')} />
          <button
            type="button"
            onClick={() => setValue('test', 'initial', { shouldDirty: true })}
          >
            Set same
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Set same' }));

    expect(callbackFn).not.toHaveBeenCalled();
  });

  it('should not call subscribe callback when setValue is called with the same value and shouldTouch/shouldValidate options', async () => {
    const callbackFn = jest.fn();

    const App = () => {
      const { register, setValue, subscribe } = useForm({
        defaultValues: {
          test: 'initial',
        },
      });

      React.useEffect(() => {
        return subscribe({
          formState: {
            values: true,
          },
          callback: callbackFn,
        });
      }, [subscribe]);

      return (
        <form>
          <input {...register('test')} />
          <button
            type="button"
            onClick={() =>
              setValue('test', 'initial', {
                shouldTouch: true,
                shouldValidate: true,
              })
            }
          >
            Set same
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Set same' }));

    expect(callbackFn).not.toHaveBeenCalled();
  });

  it('should call subscribe callback with a values snapshot', async () => {
    const callbackFn = jest.fn();
    let capturedValues: Record<string, unknown> | undefined;

    const App = () => {
      const { register, setValue, subscribe } = useForm({
        defaultValues: {
          test: '',
        },
      });

      React.useEffect(() => {
        return subscribe({
          formState: {
            values: true,
          },
          callback: (data) => {
            capturedValues = data.values as Record<string, unknown>;
            callbackFn(data);
          },
        });
      }, [subscribe]);

      return (
        <form>
          <input {...register('test')} />
          <button type="button" onClick={() => setValue('test', 'hello')}>
            Update
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Update' }));

    expect(callbackFn).toHaveBeenCalledTimes(1);
    expect(capturedValues).toEqual({ test: 'hello' });
  });

  it('should keep isDirty true when reset keeps values and updates defaultValues', async () => {
    const callbackFn = jest.fn();

    const App = () => {
      const { register, reset, subscribe } = useForm({
        defaultValues: {
          name: 'name',
          description: 'a',
        },
      });

      React.useEffect(() => {
        return subscribe({
          formState: {
            isDirty: true,
            values: true,
          },
          callback: callbackFn,
        });
      }, [subscribe]);

      return (
        <form>
          <input {...register('name')} />
          <input {...register('description')} />
          <button
            type="button"
            onClick={() =>
              reset(
                {
                  name: 'server-name',
                  description: 'a',
                },
                {
                  keepValues: true,
                },
              )
            }
          >
            sync defaults
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.input(screen.getAllByRole('textbox')[0], {
      target: { value: 'client-name' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'sync defaults' }));

    await waitFor(() =>
      expect(callbackFn).toHaveBeenLastCalledWith(
        expect.objectContaining({
          isDirty: true,
          defaultValues: {
            name: 'server-name',
            description: 'a',
          },
          values: {
            name: 'client-name',
            description: 'a',
          },
        }),
      ),
    );
  });
});

describe('call setValue within subscribe', () => {
  it('should update a dependent field when subscribed field changes', () => {
    const callbackSpy = jest.fn();

    function App() {
      const { register, setValue, subscribe } = useForm<{
        name: string;
        nameLength: number;
      }>({
        defaultValues: {
          name: '',
          nameLength: 0,
        },
      });

      React.useEffect(() => {
        return subscribe({
          name: 'name',
          exact: true,
          formState: {
            values: true,
          },
          callback: ({ values }) => {
            callbackSpy(values);
            setValue('nameLength', values.name.length);
          },
        });
      }, [setValue, subscribe]);

      return (
        <form>
          <input aria-label="name" {...register('name')} />
          <input aria-label="nameLength" {...register('nameLength')} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '1' },
    });

    expect(screen.getByLabelText('nameLength')).toHaveValue('1');
    expect(callbackSpy).toHaveBeenCalledTimes(1);
    expect(callbackSpy).toHaveBeenLastCalledWith({
      name: '1',
      nameLength: 0,
    });

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '12' },
    });

    expect(screen.getByLabelText('nameLength')).toHaveValue('2');
    expect(callbackSpy).toHaveBeenCalledTimes(2);
    expect(callbackSpy).toHaveBeenLastCalledWith({
      name: '12',
      nameLength: 1,
    });
  });

  it('does not infinitely recurse when setValue call is conditional', () => {
    const callbackSpy = jest.fn();
    let counter = 0;

    function App() {
      const { register, setValue, subscribe } = useForm<{
        name: string;
        nameLength: number;
      }>({
        defaultValues: {
          name: '',
          nameLength: 0,
        },
      });

      React.useEffect(() => {
        return subscribe({
          // Subscribe to entire form
          formState: {
            values: true,
          },
          callback: ({ name, values }) => {
            // Should be called twice: once from user typing and one from setValue
            callbackSpy(values);

            if (name === 'name') {
              // Only called once due to if statement
              setValue('nameLength', ++counter);
            }
          },
        });
      }, [setValue, subscribe]);

      return (
        <form>
          <input aria-label="name" {...register('name')} />
          <input aria-label="nameLength" {...register('nameLength')} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '1' },
    });

    expect(screen.getByLabelText('nameLength')).toHaveValue('1');
    expect(callbackSpy).toHaveBeenCalledTimes(2);
    expect(callbackSpy).toHaveBeenLastCalledWith({
      name: '1',
      nameLength: 1,
    });
  });

  it('does not infinitely recurse when setValue call is conditional', () => {
    const callbackSpy = jest.fn();

    function App() {
      const { register, setValue, subscribe } = useForm<{
        name: string;
        nameLength: number;
      }>({
        defaultValues: {
          name: '',
          nameLength: 0,
        },
      });

      React.useEffect(() => {
        return subscribe({
          // Subscribe to entire form
          formState: {
            values: true,
          },
          callback: ({ values }) => {
            callbackSpy(values);

            // No if-statement, but the second call sets the value to the current value {nameLength: 1}
            // and should not trigger the subscribe callback again
            setValue('nameLength', values.name.length);
          },
        });
      }, [setValue, subscribe]);

      return (
        <form>
          <input aria-label="name" {...register('name')} />
          <input aria-label="nameLength" {...register('nameLength')} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '1' },
    });

    expect(screen.getByLabelText('nameLength')).toHaveValue('1');
    expect(callbackSpy).toHaveBeenCalledTimes(2);
    expect(callbackSpy).toHaveBeenLastCalledWith({
      name: '1',
      nameLength: 1,
    });
  });

  it('works when calling reset within subscribe', () => {
    const callbackSpy = jest.fn();

    function App() {
      const { register, reset, subscribe } = useForm<{
        name: string;
        nameLength: number;
      }>({
        defaultValues: {
          name: '',
          nameLength: 0,
        },
      });

      React.useEffect(() => {
        return subscribe({
          name: 'name',
          formState: {
            values: true,
          },
          callback: ({ name, values }) => {
            callbackSpy(values);

            if (name === 'name' && values.nameLength === 0) {
              reset({ name: values.name, nameLength: values.name.length });
            }
          },
        });
      }, [reset, subscribe]);

      return (
        <form>
          <input aria-label="name" {...register('name')} />
          <input aria-label="nameLength" {...register('nameLength')} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '1' },
    });

    expect(screen.getByLabelText('nameLength')).toHaveValue('1');
    expect(callbackSpy).toHaveBeenCalledTimes(2);
    expect(callbackSpy).toHaveBeenLastCalledWith({
      name: '1',
      nameLength: 1,
    });
  });

  it('allows calling setValue with shouldDirty', () => {
    const callbackSpy = jest.fn();
    let dirtyFieldsSpy = null;

    function App() {
      const { register, setValue, subscribe } = useForm<{
        name: string;
        nameLength: number;
      }>({
        defaultValues: {
          name: '',
          nameLength: 0,
        },
      });

      React.useEffect(() => {
        return subscribe({
          name: 'name',
          formState: {
            values: true,
            dirtyFields: true,
          },
          callback: ({ name, values, dirtyFields }) => {
            callbackSpy(values);
            dirtyFieldsSpy = dirtyFields;

            if (name === 'name' && values.nameLength === 0) {
              setValue('nameLength', values.name.length, { shouldDirty: true });
            }
          },
        });
      }, [setValue, subscribe]);

      return (
        <form>
          <input aria-label="name" {...register('name')} />
          <input aria-label="nameLength" {...register('nameLength')} />
        </form>
      );
    }

    render(<App />);

    fireEvent.change(screen.getByLabelText('name'), {
      target: { value: '1' },
    });

    expect(dirtyFieldsSpy).toMatchObject({ name: true, nameLength: true });
  });
});
