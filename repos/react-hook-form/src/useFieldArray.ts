import React from 'react';

import generateId from './logic/generateId';
import getFocusFieldName from './logic/getFocusFieldName';
import getValidationModes from './logic/getValidationModes';
import isWatched from './logic/isWatched';
import iterateFieldsByAction from './logic/iterateFieldsByAction';
import updateFieldArrayRootError from './logic/updateFieldArrayRootError';
import validateField from './logic/validateField';
import appendAt from './utils/append';
import cloneObject from './utils/cloneObject';
import convertToArrayPayload from './utils/convertToArrayPayload';
import fillEmptyArray from './utils/fillEmptyArray';
import get from './utils/get';
import insertAt from './utils/insert';
import isBoolean from './utils/isBoolean';
import isEmptyObject from './utils/isEmptyObject';
import isObject from './utils/isObject';
import moveArrayAt from './utils/move';
import prependAt from './utils/prepend';
import removeArrayAt from './utils/remove';
import set from './utils/set';
import swapArrayAt from './utils/swap';
import unset from './utils/unset';
import updateAt from './utils/update';
import { VALIDATION_MODE } from './constants';
import type {
  Control,
  Field,
  FieldArray,
  FieldArrayMethodProps,
  FieldArrayPath,
  FieldArrayWithId,
  FieldError,
  FieldErrors,
  FieldPath,
  FieldValues,
  FormState,
  InternalFieldName,
  RegisterOptions,
  UseFieldArrayProps,
  UseFieldArrayReturn,
} from './types';
import { useFormControlContext } from './useFormControlContext';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * A custom hook that exposes convenient methods to perform operations with a list of dynamic inputs that need to be appended, updated, removed etc. • [Demo](https://codesandbox.io/s/react-hook-form-usefieldarray-ssugn) • [Video](https://youtu.be/4MrbfGSFY2A)
 *
 * @remarks
 * [API](https://react-hook-form.com/docs/usefieldarray) • [Demo](https://codesandbox.io/s/react-hook-form-usefieldarray-ssugn)
 *
 * @param props - useFieldArray props
 *
 * @returns methods - functions to manipulate with the Field Arrays (dynamic inputs) {@link UseFieldArrayReturn}
 *
 * @example
 * ```tsx
 * function App() {
 *   const { register, control, handleSubmit, reset, trigger, setError } = useForm({
 *     defaultValues: {
 *       test: []
 *     }
 *   });
 *   const { fields, append } = useFieldArray({
 *     control,
 *     name: "test"
 *   });
 *
 *   return (
 *     <form onSubmit={handleSubmit(data => console.log(data))}>
 *       {fields.map((item, index) => (
 *          <input key={item.id} {...register(`test.${index}.firstName`)}  />
 *       ))}
 *       <button type="button" onClick={() => append({ firstName: "bill" })}>
 *         append
 *       </button>
 *       <input type="submit" />
 *     </form>
 *   );
 * }
 * ```
 */
export function useFieldArray<
  TFieldValues extends FieldValues = FieldValues,
  TFieldArrayName extends FieldArrayPath<TFieldValues> =
    FieldArrayPath<TFieldValues>,
  TKeyName extends string = 'id',
  TTransformedValues = TFieldValues,
>(
  props: UseFieldArrayProps<
    TFieldValues,
    TFieldArrayName,
    TKeyName,
    TTransformedValues
  >,
): UseFieldArrayReturn<TFieldValues, TFieldArrayName, TKeyName> {
  const formControl = useFormControlContext<
    TFieldValues,
    any,
    TTransformedValues
  >();
  const {
    control = formControl,
    name,
    keyName = 'id',
    disabled,
    shouldUnregister,
    rules,
  } = props;
  const [fields, setFields] = React.useState(control._getFieldArray(name));
  const ids = React.useRef<string[]>(
    control._getFieldArray(name).map(generateId),
  );

  const _actioned = React.useRef(false);

  if (!disabled) {
    control._names.array.add(name);
  }

  React.useMemo(
    () =>
      !disabled &&
      rules &&
      fields.length >= 0 &&
      (control as Control<TFieldValues, any, TTransformedValues>).register(
        name as FieldPath<TFieldValues>,
        rules as RegisterOptions<TFieldValues>,
      ),
    [control, name, fields.length, rules, disabled],
  );

  useIsomorphicLayoutEffect(() => {
    if (disabled) {
      return;
    }

    return control._subjects.array.subscribe({
      next: ({
        values,
        name: fieldArrayName,
      }: {
        values?: FieldValues;
        name?: InternalFieldName;
      }) => {
        if (fieldArrayName === name || !fieldArrayName) {
          const fieldValues = get(values, name);
          if (Array.isArray(fieldValues)) {
            setFields(fieldValues);
            ids.current = fieldValues.map(generateId);
          } else if (!fieldArrayName) {
            setFields([]);
            ids.current = [];
          }
        }
      },
    }).unsubscribe;
  }, [control, name, disabled]);

  const updateValues = React.useCallback(
    <
      T extends Partial<
        FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>
      >[],
    >(
      updatedFieldArrayValues: T,
    ) => {
      _actioned.current = true;
      control._setFieldArray(name, updatedFieldArrayValues);
    },
    [control, name],
  );

  const append = (
    value:
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>[],
    options?: FieldArrayMethodProps,
  ) => {
    if (disabled) {
      return;
    }

    const appendValue = convertToArrayPayload(cloneObject(value));
    const updatedFieldArrayValues = appendAt(
      control._getFieldArray(name),
      appendValue,
    );
    control._names.focus = getFocusFieldName(
      name,
      updatedFieldArrayValues.length - 1,
      options,
    );
    ids.current = appendAt(ids.current, appendValue.map(generateId));
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    control._setFieldArray(name, updatedFieldArrayValues, appendAt, {
      argA: fillEmptyArray(value),
    });
  };

  const prepend = (
    value:
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>[],
    options?: FieldArrayMethodProps,
  ) => {
    if (disabled) {
      return;
    }

    const prependValue = convertToArrayPayload(cloneObject(value));
    const updatedFieldArrayValues = prependAt(
      control._getFieldArray(name),
      prependValue,
    );
    control._names.focus = getFocusFieldName(name, 0, options);
    ids.current = prependAt(ids.current, prependValue.map(generateId));
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    control._setFieldArray(name, updatedFieldArrayValues, prependAt, {
      argA: fillEmptyArray(value),
    });
  };

  const remove = (index?: number | number[]) => {
    if (disabled) {
      return;
    }

    const updatedFieldArrayValues: Partial<
      FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>
    >[] = removeArrayAt(control._getFieldArray(name), index);
    ids.current = removeArrayAt(ids.current, index);
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    !Array.isArray(get(control._fields, name)) &&
      set(control._fields, name, undefined);
    control._setFieldArray(name, updatedFieldArrayValues, removeArrayAt, {
      argA: index,
    });
  };

  const insert = (
    index: number,
    value:
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>[],
    options?: FieldArrayMethodProps,
  ) => {
    if (disabled) {
      return;
    }

    const insertValue = convertToArrayPayload(cloneObject(value));
    const updatedFieldArrayValues = insertAt(
      control._getFieldArray(name),
      index,
      insertValue,
    );
    control._names.focus = getFocusFieldName(name, index, options);
    ids.current = insertAt(ids.current, index, insertValue.map(generateId));
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    control._setFieldArray(name, updatedFieldArrayValues, insertAt, {
      argA: index,
      argB: fillEmptyArray(value),
    });
  };

  const swap = (indexA: number, indexB: number) => {
    if (disabled) {
      return;
    }

    const updatedFieldArrayValues = control._getFieldArray(name);
    swapArrayAt(updatedFieldArrayValues, indexA, indexB);
    swapArrayAt(ids.current, indexA, indexB);
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    control._setFieldArray(
      name,
      updatedFieldArrayValues,
      swapArrayAt,
      {
        argA: indexA,
        argB: indexB,
      },
      false,
    );
  };

  const move = (from: number, to: number) => {
    if (disabled) {
      return;
    }

    const updatedFieldArrayValues = control._getFieldArray(name);
    moveArrayAt(updatedFieldArrayValues, from, to);
    moveArrayAt(ids.current, from, to);
    updateValues(updatedFieldArrayValues);
    setFields(updatedFieldArrayValues);
    control._setFieldArray(
      name,
      updatedFieldArrayValues,
      moveArrayAt,
      {
        argA: from,
        argB: to,
      },
      false,
    );
  };

  const update = (
    index: number,
    value: FieldArray<TFieldValues, TFieldArrayName>,
  ) => {
    if (disabled) {
      return;
    }

    const updateValue = cloneObject(value);
    const updatedFieldArrayValues = updateAt(
      control._getFieldArray<
        FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>
      >(name),
      index,
      updateValue as FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>,
    );
    ids.current = [...updatedFieldArrayValues].map((item, i) =>
      !item || i === index ? generateId() : ids.current[i],
    );
    updateValues(updatedFieldArrayValues);
    setFields([...updatedFieldArrayValues]);
    control._setFieldArray(
      name,
      updatedFieldArrayValues,
      updateAt,
      {
        argA: index,
        argB: updateValue,
      },
      true,
      false,
    );
  };

  const replace = (
    value:
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>
      | Partial<FieldArray<TFieldValues, TFieldArrayName>>[],
  ) => {
    if (disabled) {
      return;
    }

    const updatedFieldArrayValues = convertToArrayPayload(cloneObject(value));
    ids.current = updatedFieldArrayValues.map(generateId);
    updateValues([...updatedFieldArrayValues]);
    setFields([...updatedFieldArrayValues]);
    control._setFieldArray(
      name,
      [...updatedFieldArrayValues],
      <T>(data: T): T => data,
      {},
      true,
      false,
    );
  };

  React.useEffect(() => {
    if (disabled) {
      return;
    }

    control._state.action = false;

    isWatched(name, control._names) &&
      control._subjects.state.next({
        ...control._formState,
      } as FormState<TFieldValues>);

    const validationModes = getValidationModes(control._options.mode);

    if (
      _actioned.current &&
      (!validationModes.isOnSubmit || control._formState.isSubmitted) &&
      !getValidationModes(control._options.reValidateMode).isOnSubmit &&
      !validationModes.isOnBlur
    ) {
      if (control._options.resolver) {
        control._runSchema([name]).then((result) => {
          control._updateIsValidating([name]);
          const error = get(result.errors, name);
          const existingError = get(control._formState.errors, name);
          const existingErrorType =
            existingError && (existingError.type || existingError.root?.type);
          const existingErrorMessage =
            existingError &&
            (existingError.message || existingError.root?.message);

          if (
            existingError
              ? (!error && existingErrorType) ||
                (error &&
                  (existingErrorType !== error.type ||
                    existingErrorMessage !== error.message))
              : error && error.type
          ) {
            if (error) {
              isObject(error) &&
              !Object.keys(error).some((key) => !Number.isNaN(+key))
                ? updateFieldArrayRootError(
                    control._formState.errors as FieldErrors<TFieldValues>,
                    { [name]: error } as Partial<Record<string, FieldError>>,
                    name,
                  )
                : set(control._formState.errors, name, error);
            } else {
              unset(control._formState.errors, name);
            }
            control._subjects.state.next({
              errors: control._formState.errors as FieldErrors<TFieldValues>,
            });
          }
        });
      } else {
        const field: Field = get(control._fields, name);
        if (
          field &&
          field._f &&
          !(
            getValidationModes(control._options.reValidateMode).isOnSubmit &&
            getValidationModes(control._options.mode).isOnSubmit
          )
        ) {
          validateField(
            field,
            control._names.disabled,
            control._formValues,
            control._options.criteriaMode === VALIDATION_MODE.all,
            control._options.shouldUseNativeValidation,
            true,
          ).then(
            (error) =>
              !isEmptyObject(error) &&
              control._subjects.state.next({
                errors: updateFieldArrayRootError(
                  control._formState.errors as FieldErrors<TFieldValues>,
                  error,
                  name,
                ) as FieldErrors<TFieldValues>,
              }),
          );
        }
      }
    }

    // External updates that change `fields` (e.g. reset() or setValue() on
    // the array) already notify subscribers with the up-to-date values
    // themselves, so only re-broadcast here for genuine array method calls.
    _actioned.current &&
      control._subjects.state.next({
        name,
        values: cloneObject(control._formValues) as TFieldValues,
      });

    control._names.focus &&
      iterateFieldsByAction(control._fields, (ref, key: string) => {
        if (
          control._names.focus &&
          key.startsWith(control._names.focus) &&
          ref.focus
        ) {
          ref.focus();
          return 1;
        }
        return;
      });

    control._names.focus = '';

    control._setValid();
    _actioned.current = false;
  }, [fields, name, control, disabled]);

  React.useEffect(() => {
    if (!disabled) {
      !get(control._formValues, name) && control._setFieldArray(name);
    }

    return () => {
      if (disabled) {
        return;
      }

      const shouldKeepFieldArrayValues = !(
        control._options.shouldUnregister || shouldUnregister
      );
      const updateMounted = (name: InternalFieldName, value: boolean) => {
        const field: Field = get(control._fields, name);
        if (field && field._f) {
          field._f.mount = value;
        }
      };

      if (_actioned.current && shouldKeepFieldArrayValues) {
        control._subjects.state.next({
          name,
          values: cloneObject(control._formValues) as TFieldValues,
        });
      }

      shouldKeepFieldArrayValues
        ? updateMounted(name, false)
        : control.unregister(name as FieldPath<TFieldValues>);
    };
  }, [name, control, keyName, shouldUnregister, disabled]);

  return {
    swap: React.useCallback(swap, [updateValues, name, control, disabled]),
    move: React.useCallback(move, [updateValues, name, control, disabled]),
    prepend: React.useCallback(prepend, [
      updateValues,
      name,
      control,
      disabled,
    ]),
    append: React.useCallback(append, [updateValues, name, control, disabled]),
    remove: React.useCallback(remove, [updateValues, name, control, disabled]),
    insert: React.useCallback(insert, [updateValues, name, control, disabled]),
    update: React.useCallback(update, [updateValues, name, control, disabled]),
    replace: React.useCallback(replace, [
      updateValues,
      name,
      control,
      disabled,
    ]),
    fields: React.useMemo(
      () =>
        fields.map((field, index) => ({
          ...field,
          ...(isBoolean(disabled) ? { disabled } : {}),
          [keyName]: ids.current[index] || generateId(),
        })) as FieldArrayWithId<TFieldValues, TFieldArrayName, TKeyName>[],
      [fields, keyName, disabled],
    ),
  };
}
