import React from 'react';
import { render } from '@testing-library/react';

import { Controller } from '../controller';
import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  Path,
  PathValue,
  UseFormRegister,
} from '../types';
import { useController } from '../useController';
import { useFieldArray } from '../useFieldArray';
import { useForm } from '../useForm';
import { useFormState } from '../useFormState';
import { useWatch } from '../useWatch';

test('should not throw type error with path name', () => {
  type MissingCompanyNamePath = Path<{
    test: {
      test: {
        name: string;
      }[];
      testName: string;
    };
  }>;

  const test: MissingCompanyNamePath[] = [
    'test',
    'test.test',
    'test.testName',
    'test.test.0',
    'test.test.0.name',
  ];

  test;
});

test('should not throw type error with optional array fields', () => {
  type Thing = { id: string; name: string };

  interface FormData {
    name: string;
    things?: Array<{ name: string }>;
    items?: Array<Thing>;
  }

  function App() {
    const { control, register } = useForm<FormData>({
      defaultValues: { name: 'test' },
    });
    const { fields, append } = useFieldArray({ control, name: 'things' });
    const fieldArray = useFieldArray({ control, name: 'items' });

    return (
      <div className="App">
        <input {...register('name')} />

        <button onClick={() => append({ name: '' })}>Add</button>

        {fields.map((field, index) => (
          <div key={field.id}>
            <input {...register(`things.${index}.name` as const)} />
          </div>
        ))}
        {fieldArray.fields.map((item) => {
          return <div key={item.id}>{item.name}</div>;
        })}
      </div>
    );
  }

  App;
});

test('should work with optional field with Controller', () => {
  type FormValues = {
    firstName: string;
    lastName?: string;
  };

  function App() {
    const { control } = useForm<FormValues>();

    return (
      <div>
        <Controller
          name="firstName"
          defaultValue=""
          control={control}
          render={({ field: { value, onChange } }) => {
            return <input value={value} onChange={onChange} />;
          }}
        />
        <Controller
          name="lastName"
          defaultValue=""
          control={control}
          render={({ field: { value, onChange } }) => {
            return <input value={value} onChange={onChange} />;
          }}
        />
      </div>
    );
  }

  App;
});

test('should work with useWatch return correct array types', () => {
  type FormValues = {
    testString: string;
    testNumber: number;
    testObject: {
      testString: string;
      test1String: string;
    };
  };

  const App = () => {
    const { control } = useForm<FormValues>();
    const output: [
      FormValues['testString'],
      FormValues['testNumber'],
      FormValues['testObject'],
    ] = useWatch({
      control,
      name: ['testString', 'testNumber', 'testObject'],
    });

    return output;
  };

  App;
});

test('should type errors correctly with Path generic', () => {
  interface InputProps<T extends FieldValues = FieldValues> {
    name: FieldPath<T>;
    register: UseFormRegister<T>;
    errors: FieldErrors<T>;
  }

  function Input<T extends FieldValues = FieldValues>({
    name,
    register,
    errors,
  }: InputProps<T>) {
    return (
      <>
        <input {...register(name)} />
        <p>{errors[name] ? String(errors?.[name]?.message) : 'no error'}</p>
      </>
    );
  }

  Input;
});

test('should allow unpackedValue and deep partial unpackValue for reset', () => {
  type Type1 = { name: string };
  type Type2 = { name: string };

  type Forms = {
    test: Type1;
    test1: Type2;
  };

  type FormMapKey = keyof Forms;

  const Test = <T extends FormMapKey>() => {
    const { reset, getValues } = useForm<Forms[T]>();
    reset(getValues());
  };

  Test;
});

test('should infer context type into control', () => {
  function App() {
    const [isValid] = React.useState(true);
    const { control } = useForm<
      { test: Record<string, unknown>[] },
      { isValid: boolean }
    >({
      resolver: (data, context) => {
        return {
          values: context?.isValid ? data : {},
          errors: {},
        };
      },
      context: {
        isValid,
      },
    });

    useFieldArray({
      name: 'test',
      control,
    });

    return null;
  }

  App;
});

test('should support optional field errors', () => {
  type Errors = FieldErrors<{
    steps?: { action: string }[];
    foo?: {
      bar: string;
    };
    baz: { action: string };
  }>;

  const error = {
    type: 'test',
    message: 'test',
  };

  let errors: Errors = {
    steps: error,
    foo: error,
    baz: error,
  };

  errors = {
    steps: [{ action: error }],
    foo: {
      bar: error,
    },
    baz: {
      action: error,
    },
  };

  errors;
});

test('should support nullable field errors', () => {
  type Errors = FieldErrors<{
    steps?: { action: string }[] | null;
    foo: {
      bar: string;
    } | null;
    baz: { action: string };
  }>;

  const error = {
    type: 'test',
    message: 'test',
  };

  let errors: Errors = {
    steps: error,
    foo: error,
    baz: error,
  };

  errors = {
    steps: [{ action: error }],
    foo: {
      bar: error,
    },
    baz: {
      action: error,
    },
  };

  errors;
});

test('should work with generic component path assertion', () => {
  function App<T extends FieldValues>() {
    const { register } = useForm<T>();
    const FIELD_DATA_EXTENSION = '__data';
    const item = {
      value: 'data',
    };

    register(`FieldName${FIELD_DATA_EXTENSION}` as FieldPath<T>, {
      value: item as PathValue<T, Path<T>>,
    });

    return null;
  }

  App;
});

test('should infer async default values', () => {
  const formValues = {
    test: 'test',
    test1: {
      nested: 'test',
    },
    fieldArray: [{ test: '' }],
  };

  function App() {
    const {
      register,
      control,
      formState,
      setValue,
      reset,
      watch,
      getValues,
      getFieldState,
      clearErrors,
      unregister,
      setFocus,
      trigger,
      setError,
    } = useForm<typeof formValues>({
      defaultValues: async () => {
        return formValues;
      },
    });
    useFieldArray({
      name: 'fieldArray' as const,
      control,
    });
    useController({
      name: 'test1.nested',
      control,
    });
    useWatch({
      name: 'test1',
      control,
    });
    useFormState({
      name: 'fieldArray',
      control,
    });

    setValue('test', 'data');
    setValue('test1.nested', 'data');
    reset({
      test: 'test',
      test1: {
        nested: 'test1',
      },
    });

    watch('test');
    watch('test1.nested');

    getValues('test');
    getValues('test1.nested');

    getFieldState('test');
    getFieldState('test1.nested');

    clearErrors('test');
    clearErrors('test1.nested');

    unregister('test');
    unregister('test1.nested');

    setFocus('test');
    setFocus('test1.nested');

    trigger('test');
    trigger('test1.nested');

    setError('test', { type: 'test ' });
    setError('test1.nested', { type: 'test ' });

    return (
      <form>
        <input {...register('test')} />
        <Controller render={() => <input />} name={'test1'} control={control} />
        <p>{formState.errors?.test?.message}</p>
        <p>{formState.errors?.test1?.message}</p>
        <p>{formState.touchedFields.test}</p>
        <p>{formState.touchedFields.test1?.nested}</p>
        <p>{formState.dirtyFields.test}</p>
        <p>{formState.dirtyFields.test1?.nested}</p>
      </form>
    );
  }

  App;
});

test('should work for root error type', () => {
  const App = () => {
    const {
      setError,
      formState: { errors },
    } = useForm();

    setError('root', {
      type: 'data',
      message: 'test',
    });
    setError('root.nested', {
      type: 'data',
      message: 'test',
    });

    React.useEffect(() => {
      setError('root.test', {
        type: 'root.test',
      });
      setError('root', {
        type: 'root',
      });
    }, [setError]);

    return (
      <form>
        <p>{errors.root?.test?.message}</p>
        <p>{errors.root?.message}</p>
      </form>
    );
  };

  App;
});

it('should worked for error with type or message keyword', () => {
  type FormInputs = {
    object: { id: string; type: string; message: string };
  };

  const App = () => {
    const {
      register,
      handleSubmit,
      formState: { errors },
    } = useForm<FormInputs>({
      defaultValues: {
        object: {
          type: 'test',
          id: 'test',
        },
      },
    });

    const onSubmit = (data: FormInputs) => {
      alert(JSON.stringify(data));
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <label>Id</label>
        <input type="number" {...register('object.type', { min: 1 })} />
        <input type="number" {...register('object.id', { min: 1 })} />
        <p>{errors?.object?.id?.message}</p>
        <input type="submit" />
      </form>
    );
  };

  App;
});

test('should provide correct type for validate function with useFieldArray', () => {
  const App = () => {
    const { control } = useForm<{
      test: {
        first: string;
        last: string;
      }[];
      test1: {
        first: string;
        last: string;
      }[];
    }>({
      defaultValues: {
        test: [
          {
            first: 'value',
            last: 'test',
          },
        ],
      },
    });
    useFieldArray({
      control,
      name: 'test',
      rules: {
        validate: (data) => {
          return !!data.find((test) => test.first && test.last);
        },
      },
    });
    useFieldArray({
      control,
      name: 'test1',
      rules: {
        validate: {
          test: (data) => {
            return !!data.find((test) => test.first && test.last);
          },
        },
      },
    });

    return null;
  };

  App;
});

test('should support compute function via useWatch without name prop', () => {
  const Form = () => {
    type FormValue = {
      test: string;
    };

    const methods = useForm<FormValue>({
      defaultValues: { test: 'test' },
    });

    const test = useWatch({
      control: methods.control,
      compute: (data: FormValue) => {
        return {
          data: 'test',
          test: data.test,
        };
      },
    });

    return (
      <div>
        {test.test}
        {test.data}
      </div>
    );
  };

  render(<Form />);
});

test('should support compute function via useWatch with string name prop', () => {
  const Form = () => {
    type FormValue = {
      test: string;
    };

    const methods = useForm<FormValue>({
      defaultValues: { test: 'test' },
    });

    const test: boolean = useWatch({
      control: methods.control,
      name: 'test' as const,
      compute: (data: string) => {
        return data === 'test';
      },
    });

    return <div>{test}</div>;
  };

  render(<Form />);
});

test('should support compute function via useWatch with array name prop', () => {
  const Form = () => {
    type FormValue = {
      test1: string;
      test2: number;
      test3: boolean;
    };

    const methods = useForm<FormValue>({
      defaultValues: {
        test1: 'test',
        test2: 1,
        test3: true,
      },
    });

    const test: string = useWatch({
      control: methods.control,
      name: ['test1', 'test2'] as const,
      compute: ([test1Value, test2Value]: [string, number]) => {
        return `${test1Value}${test2Value}`;
      },
    });

    return <div>{test}</div>;
  };

  render(<Form />);
});

test('useWatch should correctly select the name from object like param', () => {
  const App = () => {
    const { control } = useForm<{
      test: {
        first: { second: string };
      };
    }>();

    const obj = {
      name: 'test.first' as const,
      control,
    };

    const resultFromObj = useWatch(obj);
    const resultFromInline = useWatch({
      name: 'test.first',
      control,
    });

    void (resultFromObj satisfies { second: string });
    void ({ ...resultFromObj } satisfies { second: string });
    void (resultFromInline satisfies { second: string });

    return null;
  };

  App;
});
