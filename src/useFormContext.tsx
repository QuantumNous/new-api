import React from 'react';

import type {
  Control,
  FieldValues,
  FormProviderProps,
  UseFormReturn,
} from './types';
import { HookFormControlContext } from './useFormControlContext';

const HookFormContext = React.createContext<UseFormReturn | null>(null);
HookFormContext.displayName = 'HookFormContext';

/**
 * This custom hook allows you to access the form context. useFormContext is intended to be used in deeply nested structures, where it would become inconvenient to pass the context as a prop. To be used with {@link FormProvider}.
 *
 * @remarks
 * [API](https://react-hook-form.com/docs/useformcontext) • [Demo](https://codesandbox.io/s/react-hook-form-v7-form-context-ytudi)
 *
 * @returns return all useForm methods
 *
 * @example
 * ```tsx
 * function App() {
 *   const methods = useForm();
 *   const onSubmit = data => console.log(data);
 *
 *   return (
 *     <FormProvider {...methods} >
 *       <form onSubmit={methods.handleSubmit(onSubmit)}>
 *         <NestedInput />
 *         <input type="submit" />
 *       </form>
 *     </FormProvider>
 *   );
 * }
 *
 *  function NestedInput() {
 *   const { register } = useFormContext(); // retrieve all hook methods
 *   return <input {...register("test")} />;
 * }
 * ```
 */
export const useFormContext = <
  TFieldValues extends FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>(): UseFormReturn<TFieldValues, TContext, TTransformedValues> =>
  React.useContext(HookFormContext) as UseFormReturn<
    TFieldValues,
    TContext,
    TTransformedValues
  >;

/**
 * A provider component that propagates the `useForm` methods to all children components via [React Context](https://react.dev/reference/react/useContext) API. To be used with {@link useFormContext}.
 *
 * @remarks
 * [API](https://react-hook-form.com/docs/useformcontext) • [Demo](https://codesandbox.io/s/react-hook-form-v7-form-context-ytudi)
 *
 * @param props - all useForm methods
 *
 * @example
 * ```tsx
 * function App() {
 *   const methods = useForm();
 *   const onSubmit = data => console.log(data);
 *
 *   return (
 *     <FormProvider {...methods} >
 *       <form onSubmit={methods.handleSubmit(onSubmit)}>
 *         <NestedInput />
 *         <input type="submit" />
 *       </form>
 *     </FormProvider>
 *   );
 * }
 *
 *  function NestedInput() {
 *   const { register } = useFormContext(); // retrieve all hook methods
 *   return <input {...register("test")} />;
 * }
 * ```
 */
export const FormProvider = <
  TFieldValues extends FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>({
  children,
  watch,
  getValues,
  getFieldState,
  setError,
  clearErrors,
  setValue,
  setValues,
  trigger,
  formState,
  resetField,
  reset,
  handleSubmit,
  unregister,
  control,
  register,
  setFocus,
  subscribe,
}: FormProviderProps<TFieldValues, TContext, TTransformedValues>) => {
  const memoizedValue = React.useMemo(
    () => ({
      watch,
      getValues,
      getFieldState,
      setError,
      clearErrors,
      setValue,
      setValues,
      trigger,
      formState,
      resetField,
      reset,
      handleSubmit,
      unregister,
      control,
      register,
      setFocus,
      subscribe,
    }),
    [
      clearErrors,
      control,
      formState,
      getFieldState,
      getValues,
      handleSubmit,
      register,
      reset,
      resetField,
      setError,
      setFocus,
      setValue,
      setValues,
      subscribe,
      trigger,
      unregister,
      watch,
    ],
  );

  return (
    <HookFormContext.Provider value={memoizedValue as unknown as UseFormReturn}>
      <HookFormControlContext.Provider value={memoizedValue.control as Control}>
        {children}
      </HookFormControlContext.Provider>
    </HookFormContext.Provider>
  );
};
