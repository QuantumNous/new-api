# Changelog

## [7.79.0] - 2026-06-13

### Added

- `disabled` option to `useFieldArray`

### Fixed

- `Controller` `onChange` promise return type
- `deepEqual` false positives with shared object references
- `shouldUseNativeValidation` behavior for radio groups
- `createFormControl` stability with fast refresh in dev mode
- `StrictMode` value preservation during remount
- `formState.errors` reactivity with React compiler

## [7.78.0] - 2026-06-08

### Fixed

- Recover `Controller` fields after `reset` without rerender (RN issue #13455)
- `useFormState().isDirty` race with async resolver in `onChange` mode
- Use reactive `values` prop over `defaultValues` when `shouldUnregister` is true
- `deepEqual` for empty non-plain objects

### Types

- Update `dirtyFields` typing for field arrays with undefined entries

## [7.77.0] - 2026-05-31

### Added

- `resetDefaultValues` API

### Fixed

- Stale `isDirty` in `subscribe` payload after `reset(..., { keepValues: true })`
- Preserve values with `shouldUnregister`
- Inconsistent `reset({})` behavior requiring double-call to take effect
- `FieldArray` errors overriding nested fields

### Security

- Harden `get()` against prototype-path traversal (`__proto__` / `constructor` / `prototype`)

### Performance

- Bundle size reduction

## [7.76.1] - 2026-05-23

### Fixed

- Revert notify all matching field-array roots on nested `setValue` updates
- Revert treat `NaN` as empty when `valueAsNumber` is `true` in `validateField`
- `setValues` pass `options` parameter through to enable validation
- `setValues` emit whole-form change without stale `name`/`type`

### Performance

- `setValues` skip redundant per-field deep clones
- `setValues` thread `skipClone` through `setFieldValue`

## [7.76.0] - 2026-05-16

### Added

- Improve `isDirty` sync with `dirtyFields` state

### Fixed

- Preserve `formState.defaultValues` when `useFieldArray` and `watch` are used together
- Preserve nested resolver field-array errors in `trigger()`
- Notify all matching field-array roots on nested `setValue` updates
- `useFieldArray` `remove` leaves array with empty object when using `values` prop
- Preserve reset values for conditionally mounted `Controller` fields with `shouldUnregister`
- Propagate `setValues` updates to mounted `Controller` fields
- Native validation tooltip suppression caused by duplicate submit-error focus
- `append({ obj: null })` silently replaced by `defaultValues` after `remove()`
- Errors state when using form-level validation
- `isValidating` reactivity when `validatingFields` is not subscribed

## [7.75.0] - 2026-05-02

### Added

- Improve `getDirtyFields` to prune empty fields
- TypeScript 6.0 support

### Fixed

- Include `setValues` in `FormProvider` context value
- Preserve watch updates on field array unmount
- Prevent `useWatch` re-render when unrelated field validation occurs
- Recompute `isDirty` after re-registering a previously unregistered field

## [7.74.0] - 2026-04-26

### Added

- `setValues` API

### Fixed

- Preserve previous field value when `useController` name changes
- Handle null parent when unregistering nested field
- Treat `NaN` as empty when `valueAsNumber` is `true` in `validateField`

## [7.73.1] - 2026-04-21

### Fixed

- Reverted `setValues` that was accidentally included in patch; fix build to exclude test files

## [7.73.0] - 2026-04-18

### Added

- Improve `subscribe` API performance

### Performance

- Memoize submit handler
- Improve `deepEqual` performance

### Fixed

- Safely access `field._f` during register
- Improve `fieldState` errors when resolver uses dot-notation string keys
- Update state correctly in watch callback with `Controller`, `trigger`, and `reset`
- Skip field array validation when mode is `onBlur`
- `isDirty` remains false after deleting an item with `shouldDirty: true`
- Handle nested field when parent `defaultValue` is null
- Skip re-render in `setValue` when value is unchanged

## [7.72.1] - 2026-04-03

### Fixed

- Prevent `setValue` with `shouldDirty` from polluting unrelated dirty fields
- Memoize control in `HookFormControlContext` to prevent render conflicts
- `isNameInFieldArray` should check all ancestor paths for nested field arrays
- `formState.isValid` incorrect on `Controller` re-mount

## [7.72.0] - 2026-03-22

### Added

- Built-in form-level `validate` option
- Subscribe `formState` to track submit state

### Fixed

- Checkbox form validation ignored with native validation
- Prevent `useFieldArray` from marking unrelated fields as dirty

## [7.71.2] - 2026-02-21

### Fixed

- `clearErrors` emit name signal for targeted field updates
- Use `DeepPartialSkipArrayKey` for `WatchObserver` value parameter

## [7.71.1] - 2026-01-14

### Fixed

- Issue with `booleans_as_integers` value handling

## [7.71.0] - 2026-01-11

### Changed

- Separate control context to prevent unnecessary rerenders
- Memoize `FormProvider` context value to prevent unnecessary rerenders

### Fixed

- Update `isValid` when field `disabled` state changes

## [7.70.0] - 2026-01-04

### Fixed

- Prevent field array ghost elements with `keepDirtyValues`
- Improve `watch` return types
- Improve invalid date handling in `deepEqual` and validation
- Handle branded types correctly in `DeepPartial`
- Fix native validation focus issue
- Prevent duplicate subscription trigger in `setValue`

## [7.69.0] - 2025-12-20

### Added

- Align `<Watch />` API with `useWatch`

### Fixed

- Security: CVE-2025-67779, CVE-2025-55184, CVE-2025-55183, CVE-2025-55182
- Preserve `isValid` state when `keepIsValid` option is used
- Ensure `createFormControl.subscribe` subscription listens only to subscribed changes
- Batch `isValidating` state updates with validation result
- Resolve race condition between `setError` and `setFocus`

## [7.68.0] - 2025-12-04

### Added

- `<FormStateSubscribe />` component

### Fixed

- Clear validation errors synchronously in `reset()` to fix Next.js 16 Server Actions issue

## [7.67.0] - 2025-11-29

### Added

- `exact` option for `useController` props

### Fixed

- Allow `undefined` value with async `defaultValues` in `Controller`
- Correct `PathValueImpl` type inference

## [7.66.1] - 2025-11-18

### Performance

- Reduce redundant property access in `getDirtyFields`

### Fixed

- Skip `setValid()` during batch array updates
- Recompute `isValid` after `reset` when values update asynchronously
- Handle NaN comparison correctly using `Object.is` in `deepEqual`

## [7.66.0] - 2025-11-01

### Added

- `useWatch` and `useController` now react to `name` prop changes

### Fixed

- `watch()` returning `undefined` immediately after `reset()`
- Correct render function parameter typing for `<Watch />` component

## [7.65.0] - 2025-10-11

### Added

- `<Watch />` component

### Fixed

- Respect parent-provided `useFieldArray` rules
- `getDirtyFields` submit fields with `null` values when using `useForm`

## [7.64.0] - 2025-10-04

### Added

- Support optional array fields in `PathValueImpl` type

### Fixed

- Preserve `Controller`'s `defaultValue` with `shouldUnregister` prop

## [7.63.0] - 2025-09-20

### Added

- Improve get dirty fields logic
- Extra form values accessible via `formState`

### Fixed

- Only execute trigger function when deps has a valid array
- Unregister previous field when switching conditional Controllers
- Use field name to update `isValidating` fields

## [7.62.0] - 2025-08-02

### Fixed

- Sync two `defaultValues` after `reset` with new `defaultValues`
- Field name type conflict in nested `FieldErrors`
- Prevent `onBlur` for `readOnly` fields
- Do not override prototype of `data` in `cloneObject`

## [7.61.1] - 2025-07-24

### Fixed

- Reverted `watch` return type change based on `defaultValue` (caused regressions)

## [7.61.0] - 2025-07-24

### Added

- `compute` prop for `useWatch` subscription

### Fixed

- Subscribe with latest `defaultValues`
- Trigger watch callbacks only in response to value changes
- Track name with `setValue` subscription callbacks
- Handle explicit `"multipart/form-data"` encType in `<Form />` component
- Remove React wildcard import to resolve ESM build issues

## [7.60.0] - 2025-07-05

### Added

- `reset` with `keepFieldsRef` option to keep fields reference

### Fixed

- Remove `Set` from clone object

## [7.59.0] - 2025-06-28

### Added

- Support deep equality checking with circular references

### Fixed

- Issue with `formData` reference clone
- Issue with `undefined` value for submit data
- `useWatch` object variable param handling

## [7.58.0] - 2025-06-15

### Added

- `FieldArrayPathByValue` type
- Use `stringToPath` to prevent errors at field names containing quotes

### Fixed

- Incorrect `formControl` return from `useForm`
- Initial `useFieldArray` fields population

## [7.57.0] - 2025-06-02

### Added

- Focus form field for errors supplied via `errors` prop
- Export `UseFormResetFieldOptions` type for `resetField` API
- Root errors count in schema error lookup

### Fixed

- Type info for callback args in `subscribe`
- Proper types for `form.subscribe`
- `useController` focus function runtime issue
- `setValue` skips values not in own properties (prevents infinite call stack with self-referencing proto)
- Checkbox duplication handling in `useFieldArray`
- `mode` and `reValidateMode` reactivity
- Default value being overwritten by `values` prop regression

## [7.56.0] - 2025-04-20

### Added

- Reactive `mode` and `reValidateMode` support
- `isReady` state for subscription

### Fixed

- Regression on move/swap in `useFieldArray` input update
- Use `useIsomorphicLayoutEffect` to address SSR warning

## [7.55.0] - 2025-03-29

### Added

- `createFormControl` and `subscribe` function
- Infer resolver output types
- Allow components with `useController` hook to be memoized
- Track disabled fields and only omit data on submit
- Stable reference for `useWatch` `defaultValue`
- `handleSubmit` with native events support

### Fixed

- Type inference for `useFormContext`
- `values` and `defaultValues` work correctly with `createFormControl` and `useMemo`
- Prevent infinite render with condition check
- Valid state update with `onBlur` mode
- `disabled` field value not returned as `undefined` in resolver
- `revalidateMode` issue with `useFieldArray` validation
- `useController` unregister issue with strict mode
- `setError` in `useEffect` not working inside `FormProvider` context
- `useController` return props reference stability

## [7.54.0] - 2024-12-09

### Changed

- `useForm` return methods will be memorized based `formState` update

## [7.53.0] - 2024-8-31

### Added

- add support for `onBlur` with formState `isValid`

### Changed

- `validateFields` will only trigger re-render for async validation

## [7.51.0] - 2024-3-2

### Added

- added 'validateFields' to formState

```tsx
const {
  formState: { validateFields },
} = useForm();
```

## [7.49.0] - 2023-12-10

### Added

- add reactive `errors` prop at `useForm`

```tsx
useForm({
  errors, // Server errors
});
```

## [7.48.0] - 2023-11-05

### Added

- added new `disabled` prop for `useForm` to disable the entire form

```
const App = () => {
  const [disabled, setDisabled] = useState(false);
  const { handleSubmit } = useForm({ disabled });

  return (
    <form
      onSubmit={handleSubmit(async () => {
        setDisabled(true);
        await sleep(100);
        setDisabled(false);
      })}
    / >
  );
}
```

## [7.47.0] - 2023-10-02

### Added

- `reset` api with `keepIsSubmitSuccessful` option, keep successfully submitted form state.

```tsx
<Form
  onSubmit={() => {
    reset(formValues, {
      keepIsSubmitSuccessful: true,
    });
  }}
/>
```

## [7.46.0] - 2023-09-03

### Added

- Controller `disabled` prop

```jsx
const [disabled, setDisabled] = useState(false);
useController({
  disabled,
});
```

- Trigger passed names to construct resolver options
- Add `exact` option for array name in `useWatch`

### Changed

- Update `isDirty` when setting `disabled` in `register`

## Fixed

- Prevent `reset` argument mutation

## [7.45.0] - 2023-06-20

### Changed

- Controller with type check on `onChange`

```diff
- onChange: (...event: any[]) => void;
+ onChange: (event: ChangeEvent | FieldPathValue<TFieldValues, TName>) => void;
```

- Include missing generic for `useFormContext`

```diff
- export const useFormContext: <TFieldValues extends FieldValues, TransformedValues extends FieldValues | undefined = undefined>() => UseFormReturn<TFieldValues>;
+ export const useFormContext: <TFieldValues extends FieldValues, TContext = any, TransformedValues extends FieldValues | undefined = undefined>() => UseFormReturn<TFieldValues, TContext, TransformedValues>;
```

## [7.44.0] - 2023-06-14

### Added

- New `<Form />` component

```tsx
// Send post request with formData
<Form
  action="/api"
  control={control}
  onSuccess={() => {
    alert("Great");
  }}
/>

// Send post request with json form data
<Form action="/api" encType="application/json" headers={{ accessToken: 'test' }}>
  {errors.root?.server.type === 500 && 'Error message'}
  {errors.root?.server.type === 400 && 'Error message'}
</Form>

// Send post request with formData with fetch
<Form
  onSubmit={async ({ formData, data, formDataJson, event }) => {
    await fetch("api", {
      method: "post",
      body: formData,
    });
  }}
/>
```

- support `TransformedValues` with `useFormContext`

`useFormContext<FormValue, TransformedValues>()`

- added `TTransformedValues` to `FormProvider`

FormProviderProps<TFieldValues, TContext, TTransformedValues>

## [7.43.0] - 2023-01-30

### Added

- support global error type

```tsx
const onSubmit = async () => {
  setError('root.serverError', {
    type: response.statusCode,
  });
};
const onClick = () => {
  setError('root.random', {
    type: 'random',
  });
};

return (
  <>
    {errors.root.serverError.type === 400 && <p>server response message</p>}
    <p>{errors.root?.random?.message}</p>
  </>
);
```

## [7.42.0] - 2023-01-13

### Added

- build in validation `validate` support second argument for form values

```tsx
// Making exported validate function isolated for validation
export function validateNumber(_: number, formValus: FormValues) {
  return formValus.number1 + formValus.number2 === 3;
}

<input
  type="number"
  {...register('number1', {
    validate: validateNumber,
    valueAsNumber: true,
  })}
/>;
```

### Changed

- `handleSubmit` no longer catch `onSubmit` callback error
- Remove deprecated for `fieldState.invalid`

## [7.41.0] - 2022-12-17

### Added

- `useForm` added `values` props

```tsx
const values = await fetch('API');

useForm({
  values, // will reset the form when values updates
  // resetOptions: {
  //   keepDirtyValues: true
  // }
});
```

- new `isLoading` formState for async `defaultValues`

```tsx
const {
  formState: { isLoading },
} = useForm();
```

### Changed

- `useForm` support async `defaultValues` props

```tsx
const {
  formState: { isLoading },
} = useForm({
  defaultValues: fetch('API'),
  // resetOptions: {
  //   keepDirtyValues: true
  // }
});
```

## [7.40.0] - 2022-11-30

### Changed

- async validation (or combined with sync) will always the take the latest validation result and abort the previous

## [7.39.5] - 2022-11-21

### Changed

- Conditional render `useFormState` will trigger an extra re-render to reflect the current `formState`

## [7.39.0] - 2022-11-2

### Changed

- `isValid` formState is no longer only applicable with `onChange`, `onTouched`, and `onBlur` mode.

## [7.38.0] - 2022-10-19

### Added

- support build-in validation with input type week and time

```tsx
<input {...register("week", { min: "2022-W40" })} type="week" />
<input {...register("time", { min: "11:00" })} type="time" />
```

## [7.37.0] - 2022-10-07

### Added

- new formState `defaultValues`

```tsx
const { formState, watch } = useForm({
  defaultValues: { name: 'test' },
});
const { defaultValues } = useFormState();

const name = watch('name');

return (
  <div>
    <p>Your name was {defaultValues.name}</p>
    <p>Updated name is {name}</p>
  </div>
);
```

### Changed

- defaultValues: complex object data contains prototype methods will not be cloned internally

## [7.36.0] - 2022-9-20

### Added

- reset to support callback syntax

```tsx
reset((formValues) => {
  return {
    ...formValues,
    partialData: 'onlyChangeThis',
  };
});
```

## [7.35.0] - 2022-9-10

### Added

- new type `FieldPathByValue` field path by value generic implementation

```tsx
function CustomFormComponent<
  TFieldValues extends FieldValues,
  Path extends FieldPathByValue<TFieldValues, Date>,
>({ control, name }: { control: Control<FieldValues>; name: Path }) {
  const { field } = useController({
    control,
    name,
  });
}

function App() {
  const { control } = useForm<{
    foo: Date;
    baz: string;
  }>();

  return (
    <form>
      <CustomFormComponent control={control} name="foo" /> {/* no error */}
      <CustomFormComponent control={control} name="baz" />{' '}
      {/*  throw an error since baz is string */}
    </form>
  );
}
```

### Changed

- form context support children prop type

```tsx
<FormProvider {...methods}>
  <div /> // ✅
  <div /> // ✅
</FormProvider>
```

## [7.34.0] - 2022-7-28

### Added

- Build in validation support for `useFieldArray` with `rules` prop

```tsx
useFieldArray({
  name: 'test',
  rules: {
    required: true,
    minLength: 2,
    maxLength: 10,
    validate: (fieldArrayValues) => {
      if (fieldArrayValues[2].title === 'test') {
        return 'validate Error';
      }
    },
  },
});

errors?.test?.root?.message; // access root level errors
```

## [7.33.0] - 2022-6-24

## Breaking Change

- `@hookform/resolvers` needs to upgraded to version `^2.9.3` above
- `useFormContext` do always required to provide a generic type check for your form, without providing generic will now require developers to convert error messages to `String` to pass the type check

```tsx
useFormContext<FormValues>(); // ✅ correct usage by provide form type defination

const { formState } = useFormContext(); // if generic is missing
String(formState.errors?.input?.message); // will need to convert to string
```

### Changed

- Deprecate `NestedValue` and `UnpackNestedValue` type, will be **removed** in the next major version. **Important**: If you are using them, it may cause TS compile error, so please just remove the type usage.

```diff
type FormValues = {
-  select: NestedValue<{
-    nested: string
-  }>
+  select: {
+    nested: string
+  }
}

type Data = UnpackNestedValue<FieldValues>
```

- `formState`'s `errors` is now mapped/merged with `FieldError`
- `UseFormHandleSubmit` has removed unused function generic

## [7.32.0] - 2022-6-10

### Changed

- `UseFormRegisterReturn` name type change from `string` to `TFieldName`

## [7.31.0] - 2022-5-11

### Added

- new: `reset` optional prop: `keepDirtyValues`

```tsx
reset(
  {
    firstName: 'bill', // if firstName is dirty then the value will be retained
    lastName: 'luo',
  },
  { keepDirtyValues: true }, // keep any changed field
);
```

### Changed

- `useFieldArray` auto-correct field array errors on user action

```tsx
const { append } = useFieldArray();

append({ data: '' }); // will auto correct existing field array errors if any
```

## [7.30.0] - 2022-4-17

### Changed

- improve checkboxes value determine by defaultValues

```tsx
useForm({
  defaultValues: {
    checkboxes: [], // register checkbox will be determine as array of checkboxes
  },
});
register('checkboxes'); // will return array as value
```

## [7.29.0] - 2022-3-30

### Changed

- tsconfig config change from es2017 to es2018

## [7.28.0] - 2022-3-13

### Changed

- `register` API options `deps` now support string

```tsx
register('test', { deps: 'test' });
```

## [7.27.0] - 2022-2-11

### Added

- new option for `setFocus` to select the entire field value

```tsx
setFocus('fieldName', { shouldSelect: true });
```

## [7.25.2] - 2022-1-29

### Changed

- `onTouched` mode will honor `focusout` event

## [7.25.0] - 2022-1-22

### Added

- `getFieldState` get individual field state

```tsx
export default function App() {
  const {
    register,
    getFieldState,
    formState: { isDirty, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      firstName: '',
    },
  });

  // you can invoke before render or within the render function
  const fieldState = getFieldState('firstName');

  return (
    <form>
      <input {...register('firstName', { required: true })} />
      <p>{getFieldState('firstName').isDirty && 'dirty'}</p>
      <p>{getFieldState('firstName').isTouched && 'touched'}</p>
      <button
        type="button"
        onClick={() => console.log(getFieldState('firstName'))}
      >
        field state
      </button>
    </form>
  );
}
```

## [7.24.0] - 2022-1-14

### Changed

- `useController` return prop: `onChange`, `onBlur` and `ref` will be memorized with `useCallback`

## [7.23.0] - 2022-1-12

### Changed

- `useFieldArray` change `keyName` is no longer required when field value contains `id`

```tsx
const App = () => {
  const { control, register, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      test: [{ id: 'UUID5678', test: 'data' }], // id value will be retained
    },
  });
  const { fields, append } = useFieldArray({
    control,
    name: 'test',
  });

  return (
    <form>
      {fields.map((field, index) => {
        return <input key={field.id} {...register(`test.${index}.test`)} />;
      })}

      <button
        type={'button'}
        onClick={() => {
          append({
            id: 'UUID1234', // id value will be retained
            test: '1234',
          });
        }}
      >
        append
      </button>
    </form>
  );
};
```

- `useFormState` will no longer fire state update after hook unmount
- `UseFormHandleSubmit` type will infer formValues

## [7.22.0] - 2021-12-14

### Changed

- Browser native reset API will no longer be invoked when `reset` provided with value

```tsx
const onSubmit = (data) => {};

React.useEffect(() => {
  if (formState.isSubmitSuccessful) {
    reset({ something: '' });
  }
}, [formState, reset]);

handleSubmit(onSubmit);
```

to

```tsx
const onSubmit = (data) => {
  setSubmittedData(data);
  reset(data); // no longer need to have useEffect
};

handleSubmit(onSubmit);
```

## [7.21.0] - 2021-12-06

### Changed

- `shouldUseNativeValidation` will pass down validation props both at client and server render

```tsx
const { register } = useForm()

<input {...register('name', { required: true })} />

<input name="name" required /> // both client and server render
```

## [7.20.3] - 2021-11-26

### Changed

- register `onChange` will share same logic with `useController` for non standard event payload

```tsx
const { onChange } = register('test');
onChange('stringIsValid'); // this is only valid use case for JS
```

- empty node in `formState` will no longer gets unset

## [7.20.0] - 2021-11-19

### Added

- new `exact` prop for `useWatch`
- new `exact` prop for `useFormState`

```tsx
useWatch({
  name: 'test.test',
  exact: true,
});

useFormState({
  name: 'test.test',
  exact: true,
});
```

### Changed

- `useWatch` subscription will occurred at `useEffect` instead before `render`

## [7.19.0] - 2021-11-05

### Added

- new `resetField` API

```tsx
const { resetField } = useForm();

resetField('test');

resetField('test', {
  keepError: true,
  keepDirty: true,
  keepTouched: true,
  defaultValue: 'test1',
});
```

### Changed

- `useController` will return shallow clone value for the following data type on each rerender
  - object: `{... value}`
  - array: `[...value]`

## [7.18.1] - 2021-11-02

- revert `FieldPathWithValue`

## [7.18.0] - 2021-10-28

### Added

- bring back `FieldPathWithValue`
- schema errors parent object look up

```tsx
const validationSchema = object().shape({
  questions: array().min(1, 'Array cannot be empty'),
});

// the above schema will be picked up by field array action
// the logic applies to group error object eg checkboxes
<button
  type="button"
  onClick={() => {
    remove(questionIndex);
  }}
>
  Remove
</button>;
```

## [7.17.0] - 2021-10-02

### Added

- new type `FieldPathWithValue` to improve generic components type support

```tsx
type ExpectedType = { test: string };

const Generic = <FormValues extends FieldValues>({
  name,
  control,
}: {
  name: FieldPathWithValue<FormValues, ExpectedType>;
  control: Control<FormValues>;
}) => {
  const {
    field: { value, ...fieldProps },
  } = useController<FormValues, ExpectedType>({
    name,
    control,
    defaultValue: { test: 'value' },
  });

  return <input type="text" value={value.test} {...fieldProps} />;
};
```

## [7.16.1] - 2021-09-27

### Changed

- `formState` subscription no longer subscribed at `useEffect` instead the execution of each hook

## [7.16.0] - 2021-09-25

### Added

- `register` allowed pass custom `onChange` and `onBlur`

```tsx
<input
  type="text"
  {...register('test', {
    onChange: (e) => {},
    onBlur: (e) => {},
  })}
/>
```

## [7.15.0] - 2021-09-05

### Added

- `useFieldArray` new method `replace()`

```tsx
const { control } = useForm({
  defaultValues: {
    test: [{ value: 'lorem' }, { value: 'ipsum' }],
  },
});
const { fields, replace } = useFieldArray({
  control,
  name: 'test',
});

const handleFullyReplacement = (): void => {
  // remove old and set fully new values
  replace([{ value: 'dolor' }, { value: 'sit' }, { value: 'amet' }]);
};
```

- Improved to not map types defined with `interface`.

```tsx
import { useForm } from 'react-hook-form';

interface CustomValue {
  custom: string;
}

type FormValues = {
  fieldName: CustomValue;
};

const { formState: errors } = useForm<FormValues>({
  defaultValues: { fieldName: { custom: 'value' } },
});
```

## [7.14.0] - 2021-08-27

### Added

- `register` add dependent validation

```tsx
const App = () => {
  const { register, getValues } = useForm();

  return (
    <form>
      <input
        {...register('firstName', {
          validate: (value) => {
            return getValues('lastName') === value;
          },
        })}
      />
      <input {...register('lastName', { deps: ['firstName'] })} /> // dependant
      validation
    </form>
  );
};
```

## [7.13.0] - 2021-08-22

### Added

`Trigger`

- Trigger will enable object name trigger and field array name trigger

```tsx
useFieldArray({ name: 'test' });

trigger('name'); // will trigger the whole field array to validate
```

`register`

- added a `disabled` prop as an option to toggle input disable attribute
- register will be able to seek input DOM reference through the `ref` callback

```tsx
register('test', { disabled: true }) // will set value to undefined and pass disabled down to the input attribute

<div {...register('test')}>
  <input name="test" /> // this input will be registered
</div>
```

`useWatch`

- added `disabled` prop to toggle the state subscription.

```tsx
useWatch({ disabled: true }); // you toggle the subscription
```

`useFormState`

- added `disabled` prop to toggle the state subscription.

```tsx
useFormState({ disabled: true }); // you toggle the subscription
```

`setValue`

- allow set value for non-registered inputs include nested object and array field.

```tsx
<input {...register('test.0.firstName')} />

setValue('test', [{ firstName: 'bill' }, {firstName: 'kotaro}, {firstName: 'joris'}]) // this will works
```

## [7.12.0] - 2021-07-24

### Added

- new `useForm` config `delayError`

```tsx
useForm({
  delayError: 500, // delay error appear with 500ms
});
```

## [7.11.0] - 2021-07-13

### Added

- `update` method to update an field array inputs

```tsx
const { update } = useFieldArray();

update(0, data); // update an individual field array node
```

## [7.10.0] - 2021-07-02

### Changed

- `defaultValue` is no longer a required prop for register input with `useFieldArray`

## [7.9.0] - 2021-06-19

### Added

- new config at `useForm` to enabled native browser validation

```tsx
const { register, handleSubmit } = useForm({
  shouldUseNativeValidation: true,
});
```

## [7.8.5] - 2021-06-15

### Change

- `useController` no longer access input `ref` except `focus` event for focus management

## [7.8.0] - 2021-06-5

### Added

- `setValue` support `shouldTouch` to update formState touchFields

```tsx
setValue('firstName', 'value', { shouldTouch: true });
```

- `register` now accept `value` as option

```tsx
register('firstName', { value: 'value' });
```

### Changed

- `isValid` will initialise as `false`

## [7.7.1] - 2021-05-30

### Fixed

- `shouldUnregister: false` should not shallow merge or register absent input fields from `defaultValues`

## [7.7.0] - 2021-05-29

### Added

- `trigger` support focus with error input

```ts
trigger('inputName', { shouldFocus: true });
```

### Changed

- `handleSubmit` will `throw` error within the onSubmit callback

## [7.6.0] - 2021-05-15

### Changed

- `useForm` will `register` missing inputs from `defaultValues`

```tsx
const App = () => {
  const { register, handleSubmit } = useForm({
    defaultValues: {
      test: { firstName: 'bill', lastName: 'luo' },
    },
  });

  const onSubmit = (data) => {
    // missing registered input will be included
    console.log(data); // { test: { firstName: 'bill', lastName: 'luo' } }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('test.firstName')} />
      <button />
    </form>
  );
};
```

## [7.5.0] - 2021-05-09

### Changed

- `isSubmitSuccessful` will return false when `handleSubmit` callback failed with `Error` or `Promise` reject.
- unmounted input will no longer get validated even with `shouldUnregister: false`

## [7.4.0] - 2021-05-04

### Added

- new `name` prop for `useFormState` to subscribe to individual inputs.

```ts
useFormState({
  name: 'inputName', // optional and can be array of inputs' name as well
});
```

## [7.2.2] - 2021-04-21

### Changes

- set `shouldUnregister` to `true` will not shallow merge `defaultValues`

## [7.2.0] - 2021-04-19

### Changes

- `shouldUnregister` config to remove input value after unmount

```tsx
// Global config (can't be overwrite)
useForm({
  shouldUnregister: true // default to false
})

// Component/Hook level config (can not overwrites global config)
register('test', {
  shouldUnregister: true // default to false
})

<Controller  shouldUnregister={true} />

useController({ shouldUnregister: true })

useFieldArray({ shouldUnregister: true })
```

## [7.0.6] - 2021-04-12

### Changes

- `register` will retrieve `onChange`'s target value when component'ref is not a valid input element.

## [7.0.0-rc.7] - 2021-03-28

### Changes

- change type name from `RefCallbackHandler` to `UseFormRegisterReturn` for register callback's return

## [7.0.0-rc.7] - 2021-03-23

### Changes

- `useFieldArray` will produce an empty array `[]` when no field is presented.

## [7.0.0-rc.1] - 2021-03-08

### Changes

- `setValue` with field array will `register` all inputs before rendering.

## [7.0.0-beta.17] - 2021-03-03

### Changes

- `append`, `prepend` and `insert` will `register` deeply nested inputs at `useFieldArray`.

## [7.0.0-beta.15] - 2021-02-27

### Changes

- typescript array index restriction removed.
- `append`, `prepend` and `insert` will `register` inputs during each action at `useFieldArray`.

## [7.0.0-beta.11] - 2021-02-20

### Changes

- change `ArrayKey` type to `number | '${number}'`

## [7.0.0-beta.10] - 2021-02-19

### Changes

- Change `useController`'s `meta` into `fieldState` and include `formState`, these change will be applied to `Controller` too.

```diff
- const { field, meta } = useController({ control });
+ const { field, fieldState, formState } = useController({ control });
```

## [7.0.0-beta.9] - 2021-02-19

### Changes

- typescript array index support is changed to `49` instead of `99`

## [7.0.0-beta.4] - 2021-02-08

- **Breaking change:** `valueAs` will be run before the built-in validation and `resolver`

```diff
- <input {...register('test', { validate: (data: string) => {}, valueAsNumber: true })} />
+ <input {...register('test', { validate: (data: number) => {}, valueAsNumber: true })} />
```

## [7.0.0-beta.1] - 2021-02-08

### Changes

- `useWatch` will no longer required `defaultValue` for field Array

## [7.0.0-beta.0] - 2021-02-06

### Changes

- **Breaking change:** shallow merge defaultValues with result (#4074)

```ts
useForm({ defaultValues: { test: 'test' } });

getValues(); // v6 will return {}
getValues(); // v7 will return { test: 'test' }
```

## [v7.0.0-alpha.2] - 2021-02-04

### Changes

- **Breaking change:** `setError`'s `shouldFocus` option has been moved into the third argument.

```diff
- setError('test', { type: 'type', message: 'issue', shouldFocus: true })
+ setError('test', { type: 'type', message: 'issue' }, { shouldFocus: true })
```

- **Breaking change:** type name changes:

```diff
- UseFormMethods
+ UseFormReturn
- UseFormOptions
+ UseFormProps
- UseFieldArrayMethods
+ UseFieldArrayReturn
- UseFieldArrayOptions
+ UseFieldArrayProps
- UseControllerMethods
+ UseControllerReturn
- UseControllerOptions
+ UseControllerProps
- ArrayField
+ FieldArray
```

### Fixes

- fix `setValue` with `Controller` and `reset` with `useFieldArray` issues: 4111 & 4108 (#4113)

## [v7.0.0-alpha.2] - 2021-02-02

### Changes

- **Breaking change:** `setError`'s `shouldFocus` option has been moved to the third argument.

```diff
- setError('test', { type: 'type', message: 'issue', shouldFocus: true })
+ setError('test', { type: 'type', message: 'issue' }, { shouldFocus: true })
```

### Fixes

- fix #4078 issue with watch + mode: onChange

### Improvements

- remove internal deep clone (#4088)
- remove transformToNestObject (#4089)

## [v7.0.0-alpha.1] - 2021-02-01

### Changes

- field name reference will be removed with `unregister` (#4010)

- **Breaking change:** improve field array remove result and no longer remove field array value after unmount

```diff
const { remove } = useFieldArray({ name: 'test' })
remove();
getValues(); // V6: result form value {}
getValues(); // V7: result form value { test: [] }
```

### Improvements

- change internal field names into `Set` (#4015)
- improve `onChange` perf with `resolver (#4017)
- improve field array name look up perf (#4030)

## [v7.0.0-alpha.0] - 2021-01-31

### Added

- new custom hook `useFormState` (#3740)

```ts
const { isDirty, errors } = useFormState();
```

- `watch` support can subscribe to the entire form with a callback

```ts
watch((data, { name, type }) => {
  console.log('formValue', data);
  console.log('name', name);
  console.log('type', type);
});
```

- `useController` includes new `isValidating` state (#3778)
- `useController` includes new `error` state (#3921)

```ts
const {
  meta: { error, isValidating },
} = useController({ name: 'test' });
```

- new `unregister` second argument (#3964)

```ts
unregister('test', { keepDirty: true });
```

- Resolver add `field` being validated (#3881)

```diff
- resolver: (values: any, context?: object) => Promise<ResolverResult> | ResolverResult
+ resolver: (
+    values: any,
+    context?: object,
+    options: {
+       criteriaMode?: 'firstError' | 'all',
+       names?: string[],
+       fields: { [name]: field } // Support nested field
+    }
+  ) => Promise<ResolverResult> | ResolverResult
```

- `useFieldArray` action can focus input by name and index

```ts
append(object, config: { shouldDirty: boolean, focusIndex: number, focusName: string })
insert(object, config: { shouldDirty: boolean, focusIndex: number, focusName: string })
prepend(object, config: { shouldDirty: boolean, focusIndex: number, focusName: string })
```

### Changes

- **Breaking change:** No longer support IE 11 support

- **Breaking change:** `register` has been changed from register at `ref` to a function which needs to be spread as props.

```diff
- <input ref={register, { required: true }} name="test" />
+ <input {...register('name', { required: true })} />
+ <TextInput {...register('name', { required: true })} />
```

- **Breaking change:** `name` with array will only support dot syntax instead of brackets.

```
- test[2].test
+ test.2.test
```

- **Breaking change:** remove `as` prop at `Controller` and fix render prop consistency (#3732)

```diff
- <Controller render={props => <input {...props} />} />
+ <Controller render={({ field }) => <input {...field} />} />
```

- **Breaking change:** remove `errors` alias (#3737)

```diff
- const { errors } = useForm();
+ const { formState: { errors } } = useForm();
```

- **Breaking change:** improved `reset` second argument (#3905)

```diff
- reset({}, { isDirty: true })
+ reset({}, { keepIsDirty: true })
```

- **Breaking change:** change `touched` to `touchedFields` for consistency (#3923)

```diff
- const { formState: { touched } } = useForm();
+ const { formState: { touchedFields }} = useForm();
```

- **Breaking change:** `trigger` will no longer return validation result.

```diff
- await trigger('test') // return true or false
+ trigger('test') // void
```

- remove `isSubmitting` proxy (#4000)

- input `register` will no longer be removed due to unmount, user will have to manually invoke `unregister`

### Improvements

- `useWatch` internal mechanism improvement (#3754)
- `Controller` and `useController` apply `useFormState` internally and improve performance (#3778)
- `register` type support for input name (#3738)
- `Controller` and `useCOntroller` type support for input name (#3738)
- `useFieldArray` internal logic and data structure improvement (#3858)
- improve `useFieldArray` internal fields update with subscription (#3943)
- improve tests structure (#3916)
- `useWatch` type improvement (#3931)
- improve type support for nested field array with `const` (#3920)
- improve `useFieldArray` internal type structure (#3986)
- `MutationObserver` removed from `useForm`

## [6.15.0] - 2021-02-02

### Changed

- radio input default selection will return `null` instead of empty string `''`
- `valueAsNumber` with empty input will return `NaN` instead of `0`

## [6.14.0] - 2020-12-31

### Changed

- `setValue` without shouldUnregister:false will no longer deep clone its value instead with shallow clone

### Added

- new formState `isValidating`, this will set to `true` during validation.

```ts
const {
  formState: { isValidating },
} = useForm();
```

## [6.12.0] - 2020-12-12

### Changed

- When invoking `reset({ value })` value will be shallow clone value object which you have supplied instead of deepClone.

```tsx
// ❌ avoid the following with deep nested default values
const defaultValues = { object: { deepNest: { file: new File() } } };
useForm({ defaultValues });
reset(defaultValues); // share the same reference

// ✅ it's safer with the following, as we only doing shallow clone with defaultValues
useForm({ deepNest: { file: new File() } });
reset({ deepNest: { file: new File() } });
```

### Added

- New custom hook `useController`: This custom hook is what powers Controller, and shares the same props and methods as Controller. It's useful to create reusable Controlled input, while Controller is the flexible option to drop into your page or form.

```tsx
import React from 'react';
import { TextField } from '@material-ui/core';
import { useController } from 'react-hook-form';

function Input({ control, name }) {
  const {
    field: { ref, ...inputProps },
    meta: { invalid, isTouched, isDirty },
  } = useController({
    name,
    control,
    rules: { required: true },
    defaultValue: '',
  });

  return <TextField {...inputProps} inputRef={ref} />;
}
```

## [6.12.0] - 2020-11-28

### Changed

- `useWatch` will retrieve the latest value from `reset(data)` instead of return `defaultValue`

```tsx
useWatch({
  name: 'test',
  defaultValue: 'data', // this value will only show on the initial render
});
```

- TS: name changed from `ValidationRules` to `RegisterOptions` due to valueAs functionality included as `register` function.

### Added

- `register` function with additional options to transform value
  - `valueAsDate`
  - `valueAsNumber`
  - `setValueAs`

```tsx
register({
  valueAsNumber: true,
});

register({
  valueAsNumber: true,
});

register({
  setValueAs: (value) => value,
});
```

### Added

## [6.11.0] - 2020-11-07

### Changed

- `defaultValues` is **required** to measure `isDirty`, keep a single source of truth to avoid multiple issues raised around `isDirty`
- when `watch` with `useFieldArray`, `fields` object is no longer required as defaultValue

```diff
- watch('fieldArray', fields);
+ watch('fieldArray');
```

## [6.10.0] - 2020-10-31

### Added

- `Controller` will have an extra `ref` props to improve DX in terms of focus management.

```tsx
<Controller
  name="test"
  render={(props) => {
    return (
      <input
        value={props.value}
        onChange={props.onChange}
        ref={props.ref} // you can assign ref now without the use of `onFocus`
      />
    );
  }}
/>

// focus will work correct without the `onFocus` prop
<Controller name="test" as={<input />} />
```

### Changed

- `resolver` with group error object will no longer need with `trigger` to show and clear error. This minor version made hook form look at parent error node to detect if there is any group error to show and hide.

```tsx
const schema = z.object({
  items: z.array(z.boolean()).refine((items) => items.some((item) => item)),
});

{
  items.map((flag, index) => (
    <input
      type="checkbox"
      defaultChecked={false}
      // onChange={() => trigger("items")} now can be removed
      ref={register}
      name={`items.${index}`}
    />
  ));
}
```

## [6.9.0] - 2020-10-3

### Changed

- with shouldUnregister set to false, empty Field Array will default [] as submission result.

```tsx
const { handleSubmit } = useForm({
  shouldUnregister: false,
});

useFieldArray({
  name: 'test',
});

handleSubmit((data) => {
  // shouldUnregister: false
  // result:  { data: {test: []} }
  // shouldUnregister: true
  // result: {}
});
```

## [6.8.4] - 2020-09-22

### Changed

- when input unmounts `touched` and `dirtyFields` will no longer get removed from `formState` (shouldUnregister: true).

## [6.8.0] - 2020-09-09

### Added

- new formState `isSubmitSuccessful` to indicate successful submission
- `setError` now support focus on the actual input

```typescript jsx
setError('test', { message: 'This is required', shouldFocus: true });
```

### Changed

- with `shouldUnregister:false` `defaultValues` data will be part of the submission data
- with `shouldUnregister:false` conditional field is going to work with `useFieldArray`
- `setValue` now support `useFieldArray`

```diff
- setValue('test', 'data')
+ setValue('test', [{ test: '123' }]) // make it work for useFieldArray and target a field array key
```

- remove `exact` config at clearErrors

```diff
- clearErrors('test', { exact: false })
+ clearErrors('test') // does it automatically in the lib
```

## [6.7.0] - 2020-08-30

### Added

- `clearError` have second option argument for clear errors which are exact or key name

```ts
register('test.firstName', { required: true });
register('test.lastName', { required: true });
clearErrors('test', { exact: false }); // will clear both errors from test.firstName and test.lastName
clearErrors('test.firstName'); // for clear single input error
```

## [6.6.0] - 2020-08-28

### Changed

- all types from this lib has been exported. **Important:** only documented type: https://react-hook-form.com/ts will avoid breaking change.

## [6.5.0] - 2020-08-23

### Changed

- `errors` is also part of `formState` object
- `disabled` input will not be part of the submission data by following the [HTML standard](https://html.spec.whatwg.org/multipage/forms.html#constructing-the-form-data-set)

## [6.4.0] - 2020-08-15

### Added

- `Controller`'s `render` prop will pass down `name` prop
- `handleSubmit` take a second callback for errors callback
- new mode `onTouched` will only trigger validation after inputs are touched

### Changed

- `register` no longer compare `ref` difference with React Native

## [6.3.2] - 2020-08-11

### Changed

- IE 11 version will be required to install `@babel/runtime-corejs3` as dependency at your own project

## [6.3.0] - 2020-08-8

### Changed

- `defaultValue` is become **required** for `useFieldArray` at each input

## [6.2.0] - 2020-07-30

### Changed

- revert `getValues` will return default values before inputs registration

## [6.1.0] - 2020-07-26

### Changed

- `resolver` supports both async and sync
- `getValues` will return default values before inputs registration

## [6.0.7] - 2020-07-17

### Added

- export `ArrayField` type

### Changed

- error message will support array of messages for specific type

```diff
- export type ValidateResult = Message | boolean | undefined;
+ export type ValidateResult = Message | Message[] | boolean | undefined;
```

## [6.0.3] - 2020-07-10

### Changed

- Controller `onFocus` works with React Native
- Controller stop producing `checked` prop by boolean `value`

## [6.0.2] - 2020-07-8

### Added

- export `UseFormOptions`, `UseFieldArrayOptions`, `FieldError`, `Field` and `Mode` type

## [6.0.1] - 2020-07-3

### Added

- export `ValidationRules` type

## [6.0.0] - 2020-07-1

### Added

- config for `shouldUnregister` which allow input to be persist even after unmount

```typescript
useForm({
  shouldUnregister: false, // unmount input state will be remained
});
```

- auto focus with useFieldArray

```ts
append({}, (autoFocus = true));
prepend({}, (autoFocus = true));
insert({}, (autoFocus = true));
```

- TS: NestedValue

```tsx
import { useForm, NestedValue } from 'react-hook-form';

type FormValues = {
  key1: string;
  key2: number;
  key3: NestedValue<{
    key1: string;
    key2: number;
  }>;
  key4: NestedValue<string[]>;
};

const { errors } = useForm<FormValues>();

errors?.key1?.message; // no type error
errors?.key2?.message; // no type error
errors?.key3?.message; // no type error
errors?.key4?.message; // no type error
```

- `useWatch` (new) subscribe to registered inputs.

```tsx
<input name="test" ref={register} />;

function IsolateReRender() {
  const { state } = useWatch({
    name: 'test',
    control,
    defaultValue: 'default',
  });

  return <div>{state}</div>;
}
```

- `getValues()` support array of field names

```typescript jsx
getValues(['test', 'test1']); // { test: 'test', test1: 'test1' }
```

- `useForm({ mode: 'all' })` support all validation

### Changed

- rename `validationResolver` to `resolver`
- rename `validationContext` to `context`
- rename `validateCriteriaMode` to `criteriaMode`
- rename `triggerValidation` to `trigger`
- rename `clearError` to `clearErrors`
- rename `FormContext` to `FormProvider`
- rename `dirty` to `isDirty`
- `dirtyFields` change type from `Set` to `Object`

- Controller with render props API, and removed the following props:
  - onChange
  - onChangeName
  - onBlur
  - onBlurName
  - valueName

```diff
-<Controller
-  as={CustomInput}
-  valueName="textValue"
-  onChangeName="onTextChange"
-  control={control}
-  name="test"
-/>
+<Controller
+  render={({ onChange, onBlur, value }) => (
+     <CustomInput onTextChange={onChange} onBlur={onBlur} textValue={value} />
+  )}
+  control={control}
+  name="test"
+/>
```

- `setError` will focus one error at a time and remove confusing set multiple errors, behavior change.
  - setError will persist an error if it's not part of the form, which requires manual remove with clearError
  - setError error will be removed by validation rules, rules always take over errors

```diff
- setError('test', 'test', 'test')
+ setError('test', { type: 'test', message: 'bill'})
```

- `setValue` will focus on input at a time

```diff
setValue('test', 'value', { shouldValidate: false, shouldDirty: false })
```

### Removed

- remove `validationSchema` and embrace validation `resolver`
- remove `nest` option for `watch` & `getValues`, so data return from both methods will be in FormValues shape.

```diff
-getValues({ nest: true }); // { test: { data: 'test' }}
-watch({ nest: true }); // { test: { data: 'test' }}
+getValues(); // { test: { data: 'test' }}
+watch(); // { test: { data: 'test' }}
```

## [5.0.0] - 2020-03-07

### Breaking Change

- `Controller`: onChange will only evaluate payload as event like object. eg: react-select will no longer need the extra `onChange` method at `Controller`.

```diff
import { TextInput } from 'react-native';

-<Controller
-  as={<TextInput style={{ borderWidth: 2, borderColor: 'black'}} />}
-  name="text"
-  control={args => ({
-    value: args[0].nativeEvent.text,
-  })}
-  onChange={onChange}
-/>
+<Controller
+  as={<TextInput style={{ borderWidth: 2, borderColor: 'black'}} />}
+  name="text"
+  control={args => args[0].nativeEvent.text}
+  onChange={onChange}
+/>
```

## [4.0.0] - 2019-12-24

### Breaking changes

- improve module **exports**:

```tsx
import { useForm } from 'react-hook-form';
```

- nested `errors` object and better typescript support

```tsx
type form = {
  yourDetail: {
    firstName: string;
  };
};

errors?.yourDetail?.firstName;
```

- triggerValidation argument change from `Object`, `Object[]` to `String`, `String[]`

```tsx
triggerValidation('firstName');
triggerValidation(['firstName', 'lastName']);
```

- watch support `{ nest: boolean }`

```tsx
watch(); // { 'test.firstName': 'bill' }
watch({ nest: true }); // { test: { firstName: 'bill' } }
```

- improve custom `register`

```tsx
register('test', { required: true });
```

- setError` support nested object

```tsx
setError('yourDetail.firstName', 'test');
errors.yourDetails.firstName;
```

- `handleSubmit` no longer rerun array inputs contains `undefined` or `null`

### Added

- move `RHFInput` into the main repo and rename it to `Controller`

```tsx
<Controller control={control} name="test" />
```

### Removed

- `validationSchemaOption`: hardly anyone want to use validation with abort early, or change the config.

- native validation: hardly anyone used this feature. https://react-hook-form.com/docs/#Browserbuiltinvalidation

## [3.0.0] - 2019-04-21

### Added

React Hook Form return a new `formState: Object` which contain the following information

- `dirty`: when user interactive any fields
- `touched`: what are the fields have interacted
- `isSubmitted`: whether the form have been triggered with submitting

```tsx
const {
  formState: { dirty, touched, isSubmitted },
} = useForm();
```

## [2.0.0] - 2019-03-29

### Added

- support `ref={register}` instead of only `ref={register()}`
