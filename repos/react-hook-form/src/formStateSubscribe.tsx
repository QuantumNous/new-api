import type { ReactNode } from 'react';

import type {
  FieldValues,
  UseFormStateProps,
  UseFormStateReturn,
} from './types';
import { useFormState } from './useFormState';

export type FormStateSubscribeProps<
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
> = UseFormStateProps<TFieldValues, TTransformedValues> & {
  render: (values: UseFormStateReturn<TFieldValues>) => ReactNode;
};

export const FormStateSubscribe = <
  TFieldValues extends FieldValues,
  TTransformedValues = TFieldValues,
>({
  control,
  disabled,
  exact,
  name,
  render,
}: FormStateSubscribeProps<TFieldValues, TTransformedValues>) =>
  render(useFormState({ control, name, disabled, exact }));
