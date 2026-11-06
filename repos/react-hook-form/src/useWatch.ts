import React from 'react';

import generateWatchOutput from './logic/generateWatchOutput';
import deepEqual from './utils/deepEqual';
import type {
  Control,
  DeepPartialSkipArrayKey,
  FieldPath,
  FieldPathValue,
  FieldPathValues,
  FieldValues,
  InternalFieldName,
  UseWatchProps,
} from './types';
import { useFormControlContext } from './useFormControlContext';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Subscribe to the entire form values change and re-render at the hook level.
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-usewatch-h9i5e)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   defaultValue: {
 *     name: "data"
 *   },
 *   exact: false,
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TTransformedValues = TFieldValues,
>(props: {
  name?: undefined;
  defaultValue?: DeepPartialSkipArrayKey<TFieldValues>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute?: undefined;
}): DeepPartialSkipArrayKey<TFieldValues>;
/**
 * Custom hook to subscribe to field change and isolate re-rendering at the component level.
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-usewatch-h9i5e)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   name: "fieldA",
 *   defaultValue: "default value",
 *   exact: false,
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
>(props: {
  name: TFieldName;
  defaultValue?: FieldPathValue<TFieldValues, TFieldName>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute?: undefined;
}): FieldPathValue<TFieldValues, TFieldName>;
/**
 * Custom hook to subscribe to field change and compute function to produce state update
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   compute: (formValues) => formValues.fieldA
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TTransformedValues = TFieldValues,
  TComputeValue = unknown,
>(props: {
  name?: undefined;
  defaultValue?: DeepPartialSkipArrayKey<TFieldValues>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute: (formValues: TFieldValues) => TComputeValue;
}): TComputeValue;
/**
 * Custom hook to subscribe to field change and compute function to produce state update
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   name: "fieldA",
 *   defaultValue: "default value",
 *   exact: false,
 *   compute: (fieldValue) => fieldValue === "data" ? fieldValue : null,
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
  TTransformedValues = TFieldValues,
  TComputeValue = unknown,
>(props: {
  name: TFieldName;
  defaultValue?: FieldPathValue<TFieldValues, TFieldName>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute: (
    fieldValue: FieldPathValue<TFieldValues, TFieldName>,
  ) => TComputeValue;
}): TComputeValue;
/**
 * Custom hook to subscribe to field change and isolate re-rendering at the component level.
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-usewatch-h9i5e)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   name: ["fieldA", "fieldB"],
 *   defaultValue: {
 *     fieldA: "data",
 *     fieldB: "data"
 *   },
 *   exact: false,
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TFieldNames extends readonly FieldPath<TFieldValues>[] =
    readonly FieldPath<TFieldValues>[],
  TTransformedValues = TFieldValues,
>(props: {
  name: readonly [...TFieldNames];
  defaultValue?: DeepPartialSkipArrayKey<TFieldValues>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute?: undefined;
}): FieldPathValues<TFieldValues, TFieldNames>;
/**
 * Custom hook to subscribe to field change and compute function to produce state update
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch)
 *
 * @param props - defaultValue, disable subscription and match exact name.
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   control,
 *   name: ["fieldA", "fieldB"],
 *   defaultValue: {
 *     fieldA: "data",
 *     fieldB: 0
 *   },
 *   compute: ([fieldAValue, fieldBValue]) => fieldB === 2 ? fieldA : null,
 *   exact: false,
 * })
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
  TFieldNames extends readonly FieldPath<TFieldValues>[] =
    readonly FieldPath<TFieldValues>[],
  TTransformedValues = TFieldValues,
  TComputeValue = unknown,
>(props: {
  name: readonly [...TFieldNames];
  defaultValue?: DeepPartialSkipArrayKey<TFieldValues>;
  control?: Control<TFieldValues, any, TTransformedValues>;
  disabled?: boolean;
  exact?: boolean;
  compute: (
    fieldValue: FieldPathValues<TFieldValues, TFieldNames>,
  ) => TComputeValue;
}): TComputeValue;
/**
 * Custom hook to subscribe to field change and isolate re-rendering at the component level.
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-usewatch-h9i5e)
 *
 * @example
 * ```tsx
 * // can skip passing down the control into useWatch if the form is wrapped with the FormProvider
 * const values = useWatch()
 * ```
 */
export function useWatch<
  TFieldValues extends FieldValues = FieldValues,
>(): DeepPartialSkipArrayKey<TFieldValues>;
/**
 * Custom hook to subscribe to field change and isolate re-rendering at the component level.
 *
 * @remarks
 *
 * [API](https://react-hook-form.com/docs/usewatch) • [Demo](https://codesandbox.io/s/react-hook-form-v7-ts-usewatch-h9i5e)
 *
 * @example
 * ```tsx
 * const { control } = useForm();
 * const values = useWatch({
 *   name: "fieldName"
 *   control,
 * })
 * ```
 */
export function useWatch<TFieldValues extends FieldValues>(
  props?: UseWatchProps<TFieldValues>,
) {
  const formControl = useFormControlContext<TFieldValues>();
  const {
    control = formControl,
    name,
    defaultValue,
    disabled,
    exact,
    compute,
  } = props || {};
  const _defaultValue = React.useRef(defaultValue);
  const _compute = React.useRef(compute);
  const _computeFormValues = React.useRef<undefined | unknown>(undefined);

  const _prevControl = React.useRef(control);
  const _prevName = React.useRef(name);

  _compute.current = compute;

  const [value, updateValue] = React.useState(() => {
    const defaultValue = control._getWatch(
      name as InternalFieldName,
      _defaultValue.current as DeepPartialSkipArrayKey<TFieldValues>,
    );

    return _compute.current ? _compute.current(defaultValue) : defaultValue;
  });

  const getCurrentOutput = React.useCallback(
    (values?: TFieldValues) => {
      const formValues = generateWatchOutput(
        name as InternalFieldName | InternalFieldName[],
        control._names,
        values || control._formValues,
        false,
        _defaultValue.current,
      );

      return _compute.current ? _compute.current(formValues) : formValues;
    },
    [control._formValues, control._names, name],
  );

  const refreshValue = React.useCallback(
    (values?: TFieldValues) => {
      if (!disabled) {
        const formValues = generateWatchOutput(
          name as InternalFieldName | InternalFieldName[],
          control._names,
          values || control._formValues,
          false,
          _defaultValue.current,
        );

        if (_compute.current) {
          const computedFormValues = _compute.current(formValues);

          if (!deepEqual(computedFormValues, _computeFormValues.current)) {
            updateValue(computedFormValues);
            _computeFormValues.current = computedFormValues;
          }
        } else {
          updateValue(formValues);
        }
      }
    },
    [control._formValues, control._names, disabled, name],
  );

  useIsomorphicLayoutEffect(() => {
    if (
      _prevControl.current !== control ||
      !deepEqual(_prevName.current, name)
    ) {
      _prevControl.current = control;
      _prevName.current = name;
      refreshValue();
    }

    return control._subscribe({
      name,
      formState: {
        values: true,
      },
      exact,
      callback: (formState) => {
        refreshValue(formState.values);
      },
    });
  }, [control, exact, name, refreshValue]);

  React.useEffect(() => control._removeUnmounted());

  // If name or control changed for this render, synchronously reflect the
  // latest value so callers (like useController) see the correct value
  // immediately on the same render.

  // Optimize: Check control reference first before expensive deepEqual
  const controlChanged = _prevControl.current !== control;
  const prevName = _prevName.current;

  // Cache the computed output to avoid duplicate calls within the same render
  // We include shouldReturnImmediate in deps to ensure proper recomputation
  const computedOutput = React.useMemo(() => {
    if (disabled) {
      return null;
    }

    const nameChanged = !controlChanged && !deepEqual(prevName, name);
    const shouldReturnImmediate = controlChanged || nameChanged;

    return shouldReturnImmediate ? getCurrentOutput() : null;
  }, [disabled, controlChanged, name, prevName, getCurrentOutput]);

  return computedOutput !== null ? computedOutput : value;
}
