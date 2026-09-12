import React from 'react';

import { DEFAULT_FORM_STATE } from './logic/createFormControl';
import getProxyFormState from './logic/getProxyFormState';
import cloneObject from './utils/cloneObject';
import deepEqual from './utils/deepEqual';
import isFunction from './utils/isFunction';
import { createFormControl } from './logic';
import type {
  FieldValues,
  FormState,
  UseFormProps,
  UseFormReturn,
} from './types';
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect';

/**
 * Custom hook to manage the entire form.
 *
 * @remarks
 * [API](https://react-hook-form.com/docs/useform) • [Demo](https://codesandbox.io/s/react-hook-form-get-started-ts-5ksmm) • [Video](https://www.youtube.com/watch?v=RkXv4AXXC_4)
 *
 * @param props - form configuration and validation parameters.
 *
 * @returns methods - individual functions to manage the form state. {@link UseFormReturn}
 *
 * @example
 * ```tsx
 * function App() {
 *   const { register, handleSubmit, watch, formState: { errors } } = useForm();
 *   const onSubmit = data => console.log(data);
 *
 *   console.log(watch("example"));
 *
 *   return (
 *     <form onSubmit={handleSubmit(onSubmit)}>
 *       <input defaultValue="test" {...register("example")} />
 *       <input {...register("exampleRequired", { required: true })} />
 *       {errors.exampleRequired && <span>This field is required</span>}
 *       <button>Submit</button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useForm<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>(
  props: UseFormProps<TFieldValues, TContext, TTransformedValues> = {},
): UseFormReturn<TFieldValues, TContext, TTransformedValues> {
  const _formControl = React.useRef<
    UseFormReturn<TFieldValues, TContext, TTransformedValues> | undefined
  >(undefined);
  const _values = React.useRef<typeof props.values>(undefined);
  const _formControlProp = React.useRef(props.formControl);
  const [formState, updateFormState] = React.useState<FormState<TFieldValues>>(
    () => ({
      ...cloneObject(DEFAULT_FORM_STATE),
      isLoading: isFunction(props.defaultValues),
      errors: props.errors || {},
      disabled: props.disabled || false,
      defaultValues: isFunction(props.defaultValues)
        ? undefined
        : props.defaultValues,
    }),
  );

  if (
    !_formControl.current ||
    (props.formControl && _formControlProp.current !== props.formControl)
  ) {
    _formControlProp.current = props.formControl;
    if (props.formControl) {
      _formControl.current = {
        ...props.formControl,
        formState,
      };

      if (props.defaultValues && !isFunction(props.defaultValues)) {
        props.formControl.reset(props.defaultValues, props.resetOptions);
      }
    } else {
      const { formControl, ...rest } = createFormControl(props);

      _formControl.current = {
        ...rest,
        formState,
      };
    }
  }

  const control = _formControl.current.control;
  control._options = props;

  useIsomorphicLayoutEffect(() => {
    const sub = control._subscribe({
      formState: control._proxyFormState,
      callback: () =>
        updateFormState({
          ...control._formState,
          defaultValues:
            control._defaultValues as FormState<TFieldValues>['defaultValues'],
        }),
      reRenderRoot: true,
    });

    updateFormState((data) => ({
      ...data,
      isReady: true,
    }));

    control._formState.isReady = true;

    return sub;
  }, [control]);

  React.useEffect(
    () => control._disableForm(props.disabled),
    [control, props.disabled],
  );

  React.useEffect(() => {
    if (props.mode) {
      control._options.mode = props.mode;
    }
    if (props.reValidateMode) {
      control._options.reValidateMode = props.reValidateMode;
    }
  }, [control, props.mode, props.reValidateMode]);

  React.useEffect(() => {
    if (props.errors) {
      control._setErrors(props.errors);
      control._focusError();
    }
  }, [control, props.errors]);

  React.useEffect(() => {
    props.shouldUnregister &&
      control._subjects.state.next({
        values: control._getWatch(),
      });
  }, [control, props.shouldUnregister]);

  React.useEffect(() => {
    if (control._proxyFormState.isDirty) {
      const isDirty = control._getDirty();
      if (isDirty !== formState.isDirty) {
        control._subjects.state.next({
          isDirty,
        });
      }
    }
  }, [control, formState.isDirty]);

  React.useEffect(() => {
    if (props.values && !deepEqual(props.values, _values.current)) {
      control._reset(props.values, {
        keepFieldsRef: true,
        ...control._options.resetOptions,
      });
      if (!control._options.resetOptions?.keepIsValid) {
        control._setValid();
      }
      _values.current = props.values;
      updateFormState((state) => ({ ...state }));
    } else {
      control._resetDefaultValues();
    }
  }, [control, props.values]);

  React.useEffect(() => {
    if (!control._state.mount) {
      control._setValid();
      control._state.mount = true;
    }

    if (control._state.watch) {
      control._state.watch = false;
      control._subjects.state.next({ ...control._formState });
    }

    control._removeUnmounted();
  });

  _formControl.current.formState = React.useMemo(
    () => getProxyFormState(formState, control),
    [control, formState],
  );

  return _formControl.current;
}
