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
import type { Control } from '../../types';
import { useFieldArray } from '../../useFieldArray';
import { useForm } from '../../useForm';
import get from '../../utils/get';
import isFunction from '../../utils/isFunction';
import noop from '../../utils/noop';
import sleep from '../../utils/sleep';

jest.useFakeTimers();

describe('setValue', () => {
  it('should not setValue for unmounted state with shouldUnregister', () => {
    const { result } = renderHook(() => useForm<{ test1: string }>());

    result.current.register('test1');
    result.current.setValue('test1', 'data');
  });

  it('should empty string when value is null or undefined when registered field is HTMLElement', () => {
    const { result } = renderHook(() =>
      useForm<{ test?: string | null }>({
        defaultValues: {
          test: 'test',
        },
      }),
    );

    const elm = document.createElement('input');
    elm.type = 'text';
    elm.name = 'test';

    result.current.register('test');

    result.current.setValue('test', null);

    expect(elm).not.toHaveValue();

    act(() => {
      result.current.unregister('test');
    });

    expect(elm).not.toHaveValue();
  });

  it('should set value of radio input correctly', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    result.current.register('test');

    result.current.setValue('test', '1');

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: '1',
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should set value of file input correctly if value is FileList', async () => {
    const { result } = renderHook(() => useForm<{ test: FileList }>());

    result.current.register('test');

    const file = new File([''], '', { type: 'image/png', lastModified: 1 });
    const fileList = {
      0: file,
      1: file,
      length: 2,
    } as unknown as FileList;

    act(() => result.current.setValue('test', fileList));

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: fileList,
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should overwrite File values for unregistered fields', () => {
    const { result } = renderHook(() => useForm<{ avatar: File }>());
    const fileA = new File(['a'], 'a.svg', { type: 'image/svg+xml' });
    const fileB = new File(['b'], 'b.jpg', { type: 'image/jpeg' });

    act(() => result.current.setValue('avatar', fileA));
    act(() => result.current.setValue('avatar', fileB));

    expect(result.current.getValues('avatar')).toBe(fileB);
  });

  it('should set value of multiple checkbox input correctly', async () => {
    const { result } = renderHook(() => useForm<{ test: string[] }>());

    const { ref } = result.current.register('test');

    const elm = document.createElement('input');
    elm.type = 'checkbox';
    elm.name = 'test';
    elm.value = '2';

    document.body.append(elm);
    isFunction(ref) && ref(elm);

    const { ref: ref1 } = result.current.register('test');

    const elm1 = document.createElement('input');
    elm1.type = 'checkbox';
    elm1.name = 'test';
    elm1.value = '1';

    document.body.append(elm1);

    isFunction(ref1) && ref1(elm1);

    result.current.setValue('test', ['1']);

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: ['1'],
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should set value of single checkbox input correctly', async () => {
    const { result } = renderHook(() => useForm<{ test: string }>());

    result.current.register('test');

    result.current.setValue('test', '1');

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: '1',
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should set value of multiple checkbox input correctly as a child', async () => {
    const { result } = renderHook(() =>
      useForm<{ parent: { test: string[] } }>(),
    );

    const { ref } = result.current.register('parent.test');

    const elm = document.createElement('input');
    elm.type = 'checkbox';
    elm.name = 'test';
    elm.value = '2';

    document.body.append(elm);
    isFunction(ref) && ref(elm);

    const { ref: ref1 } = result.current.register('parent.test');

    const elm1 = document.createElement('input');
    elm1.type = 'checkbox';
    elm1.name = 'test';
    elm1.value = '1';

    document.body.append(elm1);

    isFunction(ref1) && ref1(elm1);

    result.current.setValue('parent', { test: ['1'] });
    expect(elm1).toBeChecked();

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          parent: {
            test: ['1'],
          },
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should set value of single checkbox input correctly as a child', async () => {
    const { result } = renderHook(() =>
      useForm<{ parent: { test: string } }>(),
    );

    const { ref } = result.current.register('parent.test');

    const elm = document.createElement('input');
    elm.type = 'checkbox';
    elm.name = 'test';
    elm.value = '1';

    document.body.append(elm);
    isFunction(ref) && ref(elm);

    result.current.setValue('parent', { test: '1' });
    expect(elm).toBeChecked();

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          parent: {
            test: '1',
          },
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should set value of multiple select correctly', async () => {
    const { result } = renderHook(() => useForm<{ test: string[] }>());
    const { ref } = result.current.register('test');

    isFunction(ref) &&
      ref({
        type: 'checkbox',
        refs: [{}, {}],
      });

    result.current.setValue('test', ['1']);

    await act(async () => {
      await result.current.handleSubmit((data) => {
        expect(data).toEqual({
          test: ['1'],
        });
      })({
        preventDefault: noop,
        persist: noop,
      } as React.SyntheticEvent);
    });
  });

  it('should update nested controlled input', () => {
    function App() {
      const { setValue, control } = useForm({
        defaultValues: {
          test: {
            deep: {
              field: 'test',
            },
          },
        },
      });

      return (
        <form>
          <Controller
            name="test.deep.field"
            control={control}
            render={({ field }) => <input {...field} />}
          />

          <button
            type="button"
            onClick={() => {
              setValue('test.deep', {
                field: 'updateValue',
              });
            }}
          >
            setValue
          </button>
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toEqual(
      'updateValue',
    );
  });

  it('should set object array value', () => {
    const { result } = renderHook(() =>
      useForm<{
        test: {
          one: string;
          two: string;
          three: string;
        }[];
      }>(),
    );

    result.current.register('test.0.one');
    result.current.register('test.0.two');
    result.current.register('test.0.three');

    act(() => {
      result.current.setValue('test', [
        {
          one: 'ONE',
          two: 'TWO',
          three: 'THREE',
        },
      ]);
    });

    expect(result.current.getValues()).toEqual({
      test: [
        {
          one: 'ONE',
          two: 'TWO',
          three: 'THREE',
        },
      ],
    });
  });

  it('should set unmountFieldsState value when shouldUnregister is set to false', async () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string;
        checkbox: string[];
        test1: { one: string; two: string; three: string }[];
      }>(),
    );

    act(() => {
      result.current.setValue('test', '1');
      result.current.setValue('checkbox', ['1', '2']);
      result.current.setValue('test1.0', {
        one: 'ONE',
        two: 'TWO',
        three: 'THREE',
      });
    });
  });

  it('should set nested value correctly ', () => {
    const { result } = renderHook(() =>
      useForm<{
        test1: string[];
        test2: {
          key1: string;
          key2: number;
        };
        test3: {
          key1: string;
          key2: number;
        }[];
      }>(),
    );

    result.current.register('test1');
    result.current.register('test2');
    result.current.register('test3');

    act(() => {
      result.current.setValue('test1', ['1', '2', '3']);
      result.current.setValue('test2', { key1: '1', key2: 2 });
      result.current.setValue('test3', [
        { key1: '1', key2: 2 },
        { key1: '3', key2: 4 },
      ]);
    });

    expect(result.current.control._fields['test1']).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test1', value: ['1', '2', '3'] },
        name: 'test1',
      },
    });
    expect(result.current.control._fields['test2']).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test2', value: { key1: '1', key2: 2 } },
        name: 'test2',
      },
    });
    expect(result.current.control._fields['test3']).toEqual({
      _f: {
        mount: true,
        ref: {
          name: 'test3',
          value: [
            { key1: '1', key2: 2 },
            { key1: '3', key2: 4 },
          ],
        },
        name: 'test3',
      },
    });
  });

  it('should work with array fields', () => {
    const { result } = renderHook(() =>
      useForm<{
        test: string[];
        test1: {
          test: string;
        }[];
      }>(),
    );

    result.current.register('test1.0.test');
    result.current.register('test.0');
    result.current.register('test.1');
    result.current.register('test.2');

    act(() => result.current.setValue('test', ['1', '2', '3']));

    expect(get(result.current.control._fields, 'test.0')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.0', value: '1' },
        name: 'test.0',
      },
    });
    expect(get(result.current.control._fields, 'test.1')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.1', value: '2' },
        name: 'test.1',
      },
    });
    expect(get(result.current.control._fields, 'test.2')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.2', value: '3' },
        name: 'test.2',
      },
    });
  });

  it('should worked with nested array fields with object', () => {
    const { result } = renderHook(() =>
      useForm<{
        test: {
          test: string;
        }[];
      }>(),
    );

    result.current.register('test.0.test');
    result.current.register('test.1.test');
    result.current.register('test.2.test');

    act(() =>
      result.current.setValue('test', [
        { test: '1' },
        { test: '2' },
        { test: '3' },
      ]),
    );

    expect(get(result.current.control._fields, 'test.0.test')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.0.test', value: '1' },
        name: 'test.0.test',
      },
    });
    expect(get(result.current.control._fields, 'test.1.test')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.1.test', value: '2' },
        name: 'test.1.test',
      },
    });
    expect(get(result.current.control._fields, 'test.2.test')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.2.test', value: '3' },
        name: 'test.2.test',
      },
    });
  });

  it('should work with object fields', () => {
    const { result } = renderHook(() =>
      useForm<{
        test1: {
          test: string;
        }[];
        test: {
          bill: string;
          luo: string;
          test: string;
        };
      }>(),
    );

    result.current.register('test1.0.test');
    result.current.register('test.bill');
    result.current.register('test.luo');
    result.current.register('test.test');

    act(() =>
      result.current.setValue('test', { bill: '1', luo: '2', test: '3' }),
    );
    expect(get(result.current.control._fields, 'test.bill')).toEqual({
      _f: {
        ref: { name: 'test.bill', value: '1' },
        mount: true,
        name: 'test.bill',
      },
    });
    expect(get(result.current.control._fields, 'test.luo')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.luo', value: '2' },
        name: 'test.luo',
      },
    });
    expect(get(result.current.control._fields, 'test.test')).toEqual({
      _f: {
        mount: true,
        ref: { name: 'test.test', value: '3' },
        name: 'test.test',
      },
    });
  });

  it('should work for nested fields which are not registered', () => {
    const { result } = renderHook(() => useForm());

    result.current.register('test.test');
    result.current.register('test1.test');

    act(() => {
      result.current.setValue('test', {
        test: 'test',
        test1: 'test1',
        test2: 'test2',
      });
    });

    expect(result.current.control._fields['test']).toEqual({
      test: {
        _f: {
          mount: true,
          name: 'test.test',
          ref: {
            name: 'test.test',
            value: 'test',
          },
        },
      },
    });
  });

  describe('with watch', () => {
    it('should get watched value', () => {
      const { result } = renderHook(() => {
        const { register, watch, setValue } = useForm<{ test: string }>();

        register('test');

        React.useEffect(() => {
          setValue('test', 'abc');
        }, [setValue]);

        return watch('test');
      });

      expect(result.current).toBe('abc');
    });

    it('should track field names', () => {
      type FormValues = {
        enabled: boolean;
        child: {
          dependent: boolean;
        };
      };

      function App() {
        const { control, watch, setValue } = useForm<FormValues>({
          defaultValues: { enabled: false, child: { dependent: false } },
        });

        // Propagate the easy-to-edit form values that we add back to template ID
        // values.
        React.useEffect(() => {
          const subscription = watch((formData, { name }) => {
            if (name === 'enabled') {
              setValue(`child.dependent`, !!formData.enabled);
            }
          });
          return () => subscription.unsubscribe();
        }, [setValue, watch]);

        watch('child');

        return (
          <div>
            <form>
              <label>
                Enabled
                <Controller
                  render={({ field: { value, ...props } }) => (
                    <input type="checkbox" {...props} checked={!!value} />
                  )}
                  name="enabled"
                  control={control}
                />
              </label>
              <input type="submit" />
            </form>
          </div>
        );
      }

      render(<App />);

      expect(() =>
        fireEvent.click(screen.getByRole('checkbox', { name: 'Enabled' })),
      ).not.toThrow();
    });
  });

  describe('with validation', () => {
    it('should be called trigger method if shouldValidate variable is true', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string;
        }>(),
      );

      result.current.register('test', {
        minLength: {
          value: 5,
          message: 'min',
        },
      });

      result.current.formState.dirtyFields;
      result.current.formState.errors;

      await act(async () =>
        result.current.setValue('test', 'abc', {
          shouldValidate: true,
        }),
      );

      expect(result.current.formState.errors?.test?.message).toBe('min');
    });

    it('should validate input correctly with existing error', async () => {
      const Component = () => {
        const {
          register,
          setError,
          setValue,
          formState: { errors },
        } = useForm({
          defaultValues: {
            test: '',
          },
        });

        return (
          <>
            <input {...register('test', { required: true })} />
            <button
              onClick={() => {
                setError('test', { type: 'somethingWrong', message: 'test' });
              }}
            >
              setError
            </button>
            <button
              onClick={() => {
                setValue('test', 'bill', {
                  shouldValidate: true,
                });
              }}
            >
              update
            </button>
            <p>{errors?.test?.message}</p>
          </>
        );
      };

      render(<Component />);

      fireEvent.click(screen.getByRole('button', { name: 'setError' }));

      expect(await screen.findByText('test')).toBeVisible();

      fireEvent.click(screen.getByRole('button', { name: 'update' }));

      await waitFor(() =>
        expect(screen.queryByText('test')).not.toBeInTheDocument(),
      );
    });

    it('should not be called trigger method if options is empty', async () => {
      const { result } = renderHook(() => useForm<{ test: string }>());

      result.current.register('test', {
        minLength: {
          value: 5,
          message: 'min',
        },
      });

      result.current.setValue('test', 'abc');

      expect(result.current.formState.errors?.test).toBeUndefined();
    });

    it('should be called trigger method if shouldValidate variable is true and field value is array', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string[];
        }>(),
      );

      const rules = {
        minLength: {
          value: 5,
          message: 'min',
        },
      };

      result.current.register('test.0', rules);
      result.current.register('test.1', rules);
      result.current.register('test.2', rules);

      result.current.formState.errors;

      await act(async () =>
        result.current.setValue('test', ['abc1', 'abc2', 'abc3'], {
          shouldValidate: true,
        }),
      );

      expect(result.current.formState.errors?.test?.[0]?.message).toBe('min');
      expect(result.current.formState.errors?.test?.[1]?.message).toBe('min');
      expect(result.current.formState.errors?.test?.[2]?.message).toBe('min');
    });

    it('should not be called trigger method if options is empty and field value is array', async () => {
      const { result } = renderHook(() =>
        useForm<{
          test: string[];
        }>(),
      );

      const rules = {
        minLength: {
          value: 5,
          message: 'min',
        },
      };

      result.current.register('test.0', rules);
      result.current.register('test.1', rules);
      result.current.register('test.2', rules);

      act(() => result.current.setValue('test', ['test', 'test1', 'test2']));

      expect(result.current.formState.errors?.test).toBeUndefined();
    });
  });

  describe('with dirty', () => {
    it.each(['isDirty', 'dirtyFields'])(
      'should be dirtyFields when %s is defined when shouldDirty is true',
      (property) => {
        const { result } = renderHook(() => useForm<{ test: string }>());

        result.current.formState[property as 'dirtyFields' | 'isDirty'];
        result.current.formState.isDirty;
        result.current.formState.dirtyFields;

        result.current.register('test');

        act(() =>
          result.current.setValue('test', 'test', { shouldDirty: true }),
        );

        expect(result.current.formState.isDirty).toBeTruthy();
        expect(result.current.formState.dirtyFields).toEqual({ test: true });
      },
    );

    it.each([
      ['isDirty', ['test1', 'test2', 'test3'], [true, true, true]],
      ['dirty', ['test1', 'test2', 'test3'], [true, true, true]],
      ['isDirty', ['test1', '', 'test3'], [true, undefined, true]],
      ['dirty', ['test1', '', 'test3'], [true, undefined, true]],
    ])(
      'should be dirtyFields when %s is defined when shouldDirty is true with array fields',
      (property, values, dirtyFields) => {
        const { result } = renderHook(() =>
          useForm<{
            test: string[];
          }>({
            defaultValues: {
              test: ['', '', ''],
            },
          }),
        );

        result.current.formState[property as 'isDirty' | 'dirtyFields'];
        result.current.formState.isDirty;
        result.current.formState.dirtyFields;

        result.current.register('test.0');
        result.current.register('test.1');
        result.current.register('test.2');

        act(() =>
          result.current.setValue('test', values, {
            shouldDirty: true,
          }),
        );

        expect(result.current.formState.isDirty).toBeTruthy();
        expect(result.current.formState.dirtyFields).toEqual({
          test: dirtyFields,
        });
      },
    );

    it.each(['isDirty', 'dirtyFields'])(
      'should not be dirtyFields when %s is defined when shouldDirty is false',
      (property) => {
        const { result } = renderHook(() =>
          useForm<{
            test: string;
          }>(),
        );

        result.current.formState[property as 'isDirty' | 'dirtyFields'];

        result.current.register('test');

        act(() =>
          result.current.setValue('test', 'test', { shouldDirty: false }),
        );

        expect(result.current.formState.isDirty).toBeFalsy();
        expect(result.current.formState.dirtyFields).toEqual({});
      },
    );

    it.each(['isDirty', 'dirtyFields'])(
      'should set name to dirtyFieldRef if field value is different with default value when formState.dirtyFields is defined',
      (property) => {
        const { result } = renderHook(() =>
          useForm<{ test: string }>({
            defaultValues: { test: 'default' },
          }),
        );
        result.current.formState[property as 'dirtyFields' | 'isDirty'];
        result.current.formState.isDirty;
        result.current.formState.dirtyFields;

        result.current.register('test');

        act(() => result.current.setValue('test', '1', { shouldDirty: true }));

        expect(result.current.formState.isDirty).toBeTruthy();
        expect(result.current.formState.dirtyFields.test).toBeTruthy();
      },
    );

    it.each(['isDirty', 'dirtyFields'])(
      'should unset name from dirtyFieldRef if field value is not different with default value when formState.dirtyFields is defined',
      (property) => {
        const { result } = renderHook(() =>
          useForm<{ test: string }>({
            defaultValues: { test: 'default' },
          }),
        );
        result.current.formState[property as 'isDirty' | 'dirtyFields'];
        result.current.formState.isDirty;
        result.current.formState.dirtyFields;

        result.current.register('test');

        act(() => result.current.setValue('test', '1', { shouldDirty: true }));

        expect(result.current.formState.isDirty).toBeTruthy();
        expect(result.current.formState.dirtyFields.test).toBeTruthy();

        act(() =>
          result.current.setValue('test', 'default', { shouldDirty: true }),
        );

        expect(result.current.formState.isDirty).toBeFalsy();
        expect(result.current.formState.dirtyFields.test).toBeUndefined();
      },
    );
  });

  describe('with touched', () => {
    it('should update touched with shouldTouched config', () => {
      const App = () => {
        const {
          setValue,
          register,
          formState: { touchedFields },
        } = useForm();

        return (
          <>
            <p>{Object.keys(touchedFields).map((field: string) => field)}</p>
            <input {...register('test')} />
            <button
              onClick={() => {
                setValue('test', 'data', { shouldTouch: true });
              }}
            >
              Test
            </button>
          </>
        );
      };
      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      expect(screen.getByText('test')).toBeVisible();
    });
  });

  describe('with strict mode', () => {
    it('should be able to set input value async', async () => {
      function App() {
        const { control, setValue } = useForm();

        React.useEffect(() => {
          sleep(1000);
          setValue('name', 'test');
        }, [setValue]);

        return (
          <div className="App">
            <form>
              <Controller
                defaultValue=""
                name="name"
                control={control}
                render={({ field }) => {
                  return (
                    <div>
                      <input />
                      <p>{field.value}</p>
                    </div>
                  );
                }}
              />
            </form>
          </div>
        );
      }

      render(<App />, { reactStrictMode: true });

      jest.advanceTimersByTime(10000);

      expect(await screen.findByText('test')).toBeVisible();
    });
  });

  it('should set hidden input value correctly and reflect on the submission data', async () => {
    let submitData: Record<string, string> | undefined = undefined;

    const Component = () => {
      const { register, handleSubmit, setValue } = useForm<{
        test: string;
      }>();

      return (
        <div>
          <input type="hidden" defaultValue="test" {...register('test')} />
          <button
            onClick={() => {
              setValue('test', 'changed');
            }}
          >
            change
          </button>
          <button
            onClick={handleSubmit((data) => {
              submitData = data;
            })}
          >
            submit
          </button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button', { name: 'change' }));

    fireEvent.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(submitData).toEqual({
        test: 'changed',
      }),
    );
  });

  it('should validate the input and return correct isValid formState', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: { data: string; data1: string } }>({
        mode: VALIDATION_MODE.onChange,
      }),
    );

    result.current.formState.isValid;

    await act(async () => {
      await result.current.register('test.data', { required: true });
      await result.current.register('test.data1', { required: true });
    });

    await act(async () => {
      await result.current.trigger();
    });

    await act(async () => {
      result.current.setValue('test.data', 'test', { shouldValidate: true });
    });

    expect(result.current.formState.isValid).toBeFalsy();

    await act(async () => {
      await result.current.setValue('test.data1', 'test', {
        shouldValidate: true,
      });
    });

    expect(result.current.formState.isValid).toBeTruthy();
  });

  it('should setValue with valueAs', async () => {
    let result: Record<string, string>;

    function App() {
      const { register, handleSubmit, setValue } = useForm();

      React.useEffect(() => {
        setValue('setStringDate', '2021-04-23');
      }, [setValue]);

      return (
        <form
          onSubmit={handleSubmit((data) => {
            result = data;
          })}
        >
          <input
            type="date"
            {...register('setStringDate', { valueAsDate: true })}
          />
          <input type="submit" />
        </form>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    await waitFor(() =>
      expect(result).toEqual({
        setStringDate: new Date('2021-04-23'),
      }),
    );
  });

  it('should set value for field array name correctly', () => {
    const inputId = 'name';

    const App = () => {
      const { control, setValue } = useForm<{
        names: { name: string; id?: string }[];
      }>();

      const { fields } = useFieldArray({ control, name: 'names' });

      React.useEffect(() => {
        setValue('names', [{ name: 'initial value' }]);
      }, [setValue]);

      const onChangeValue = () => {
        setValue('names.0', { name: 'updated value', id: 'test' });
      };

      return (
        <>
          {fields.map((item, index) => (
            <Controller
              key={item.id}
              control={control}
              name={`names.${index}.name` as const}
              render={({ field }) => <input data-testid={inputId} {...field} />}
            />
          ))}
          <button onClick={onChangeValue}>Update</button>
        </>
      );
    };

    render(<App />);

    expect(screen.getByTestId(inputId)).toHaveValue('initial value');

    fireEvent.click(screen.getByText('Update'));

    expect(screen.getByTestId(inputId)).toHaveValue('updated value');
  });

  it('should set field array correctly without affect the parent field array', async () => {
    const fieldsValue: unknown[] = [];
    type FormValues = {
      test: { name: string; nestedArray: { name: string }[] }[];
    };

    const Child = ({
      control,
      index,
    }: {
      control: Control<FormValues>;
      index: number;
    }) => {
      useFieldArray({
        control,
        name: `test.${index}.nestedArray`,
      });

      return null;
    };

    const App = () => {
      const { setValue, control } = useForm<FormValues>({
        defaultValues: {
          test: [{ name: 'bill', nestedArray: [] }],
        },
      });
      const { fields } = useFieldArray({
        control,
        name: 'test',
      });

      fieldsValue.push(fields);

      return (
        <div>
          {fields.map((field, index) => (
            <Child key={field.id} control={control} index={index} />
          ))}
          <button
            onClick={() => {
              setValue('test.0.nestedArray' as `test.0.nestedArray`, [
                { name: 'append' },
              ]);
            }}
          >
            setValue
          </button>
        </div>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    fireEvent.click(screen.getByRole('button'));

    expect(fieldsValue.length).toEqual(2);
  });

  it('should not register deeply nested inputs', () => {
    let fields: unknown;
    let data: unknown;

    const App = () => {
      const { setValue, control, getValues } = useForm();
      useFieldArray({
        control,
        name: 'test',
      });
      const [, setShow] = React.useState(false);
      fields = control._fields;

      return (
        <>
          <button
            onClick={() => {
              setValue('test', [
                {
                  name: 'append',
                  nestedArray: [{ field1: 'append', field2: 'append' }],
                },
              ]);
              setShow(true);
            }}
          >
            setValue
          </button>
          <button
            onClick={() => {
              data = getValues();
            }}
          >
            getValues
          </button>
        </>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'setValue' }));

    expect(fields).toEqual({});

    fireEvent.click(screen.getByRole('button', { name: 'getValues' }));

    expect(data).toEqual({
      test: [
        {
          name: 'append',
          nestedArray: [
            {
              field1: 'append',
              field2: 'append',
            },
          ],
        },
      ],
    });
  });

  describe('when set field to null', () => {
    it('should be able to set correctly with register', () => {
      let result: unknown;

      type FormData = {
        user: { name: string } | null;
      };

      function App() {
        const { setValue, watch, register } = useForm<FormData>({
          defaultValues: {
            user: {
              name: 'John Doe',
            },
          },
        });

        result = watch();

        register('user');

        return (
          <div>
            <button onClick={() => setValue('user', null)}>
              Set user to null
            </button>
          </div>
        );
      }

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      expect(result).toEqual({
        user: null,
      });
    });

    it('should be able to set correctly without register', () => {
      let result: unknown;

      type FormData = {
        user: { name: string } | null;
      };

      function App() {
        const { setValue, watch } = useForm<FormData>({
          defaultValues: {
            user: {
              name: 'John Doe',
            },
          },
        });

        result = watch();

        return (
          <div>
            <button onClick={() => setValue('user', null)}>
              Set user to null
            </button>
          </div>
        );
      }

      render(<App />);

      fireEvent.click(screen.getByRole('button'));

      expect(result).toEqual({
        user: null,
      });
    });
  });

  it('should only be able to update value of array which is not registered', async () => {
    const App = () => {
      const { setValue, watch } = useForm({
        defaultValues: {
          test: ['1', '2', '3'],
        },
      });

      React.useEffect(() => {
        setValue('test', ['2', '2']);
      }, [setValue]);

      const result = watch('test');

      return <p>{JSON.stringify(result)}</p>;
    };

    render(<App />);

    expect(await screen.findByText('["2","2"]')).toBeVisible();
  });

  it('should only be able to update value of object which is not registered', async () => {
    const App = () => {
      const { setValue, watch } = useForm<{
        test: {
          data: string;
          data1: string;
          data2: string;
        };
      }>({
        defaultValues: {
          test: {
            data: '1',
            data1: '2',
          },
        },
      });

      React.useEffect(() => {
        setValue('test', {
          data: '2',
          data1: '2',
          data2: '3',
        });
      }, [setValue]);

      const result = watch('test');

      return <p>{JSON.stringify(result)}</p>;
    };

    render(<App />);

    expect(
      await screen.findByText('{"data":"2","data1":"2","data2":"3"}'),
    ).toBeVisible();
  });

  it('should update nested object which contain date object without register', () => {
    const watchedValue: unknown[] = [];
    const defaultValues = {
      userData: {
        userId: 'abc',
        date: new Date('2021-06-15'),
      },
    };

    function App() {
      const { setValue, watch } = useForm({
        defaultValues,
      });

      const setUserData = () => {
        setValue('userData', {
          userId: '1234',
          date: new Date('2021-12-17'),
        });
      };

      watchedValue.push(watch('userData'));

      return (
        <div>
          <form>
            <button type="button" onClick={() => setUserData()}>
              Update
            </button>
          </form>
        </div>
      );
    }

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(watchedValue).toEqual([
      {
        date: new Date('2021-06-15T00:00:00.000Z'),
        userId: 'abc',
      },
      {
        date: new Date('2021-06-15T00:00:00.000Z'),
        userId: 'abc',
      },
      {
        date: new Date('2021-12-17T00:00:00.000Z'),
        userId: '1234',
      },
    ]);
  });

  it('should update isDirty even input is not registered', async () => {
    const App = () => {
      const {
        setValue,
        formState: { isDirty },
      } = useForm({
        defaultValues: {
          test: '',
        },
      });

      React.useEffect(() => {
        setValue('test', '1234', { shouldDirty: true });
      }, [setValue]);

      return <p>{isDirty ? 'dirty' : 'not'}</p>;
    };

    render(<App />);

    expect(await screen.findByText('dirty')).toBeVisible();
  });

  it('should update both dirty and touched state', () => {
    const App = () => {
      const {
        register,
        formState: { dirtyFields, touchedFields },
        setValue,
      } = useForm({
        defaultValues: {
          firstName: '',
        },
      });

      return (
        <form>
          <label>First Name</label>
          <input type="text" {...register('firstName')} />
          {dirtyFields.firstName && <p>dirty</p>}
          {touchedFields.firstName && <p>touched</p>}

          <button
            type="button"
            onClick={() =>
              setValue('firstName', 'test', {
                shouldValidate: true,
                shouldDirty: true,
                shouldTouch: true,
              })
            }
          >
            setValue
          </button>
        </form>
      );
    };

    render(<App />);

    fireEvent.click(screen.getByRole('button'));

    expect(screen.getByText('dirty')).toBeVisible();
    expect(screen.getByText('touched')).toBeVisible();
  });

  it('should notify observers exactly once when field is watched', async () => {
    const { result } = renderHook(() => useForm());
    const control = result.current.control as any;

    control._names.watch.add('test');

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    await act(async () => {
      result.current.setValue('test', 'value');
    });

    expect(nextSpy).toHaveBeenCalledTimes(1);
  });

  it('should not notify subscribers when setValue is called with an unchanged value', async () => {
    const { result } = renderHook(() =>
      useForm<{ test: string }>({ defaultValues: { test: 'initial' } }),
    );
    const control = result.current.control as any;

    // Set the initial value first
    await act(async () => {
      result.current.setValue('test', 'initial');
    });

    const nextSpy = jest.spyOn(control._subjects.state, 'next');

    // Call setValue again with the same value
    await act(async () => {
      result.current.setValue('test', 'initial');
    });

    // Should not have notified subscribers with values since value is unchanged
    const valueNotifications = nextSpy.mock.calls.filter(
      (call) =>
        call[0] != null &&
        typeof call[0] === 'object' &&
        'values' in (call[0] as Record<string, unknown>),
    );
    expect(valueNotifications).toHaveLength(0);
  });

  it('should mark field as dirty when updating array of objects with shouldDirty true', () => {
    type IData = {
      data: { id: number; name: string }[];
    };

    const defaultValues: IData = {
      data: [{ id: 1, name: 'a' }],
    };

    const { result } = renderHook(() =>
      useForm<IData>({
        defaultValues,
      }),
    );

    result.current.register('data.0.name');
    result.current.formState.isDirty;
    result.current.formState.dirtyFields;

    act(() => {
      result.current.setValue('data', [], { shouldDirty: true });
    });

    expect(result.current.formState.isDirty).toBeTruthy();
    expect(result.current.formState.dirtyFields).toEqual({
      data: [{ id: true, name: true }],
    });
  });
});
