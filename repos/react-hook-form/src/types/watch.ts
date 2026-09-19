import type { ReactNode } from 'react';

import type { FieldValues } from './fields';
import type { Control } from './form';
import type { FieldPath, FieldPathValue, FieldPathValues } from './path';
import type { DeepPartialSkipArrayKey } from './utils';

export type UseWatchProps<TFieldValues extends FieldValues = FieldValues> = {
  defaultValue?: unknown;
  disabled?: boolean;
  name?:
    | FieldPath<TFieldValues>
    | FieldPath<TFieldValues>[]
    | readonly FieldPath<TFieldValues>[];
  control?: Control<TFieldValues>;
  exact?: boolean;
  compute?: (formValues: TFieldValues) => TFieldValues;
};

export type WatchDefaultValue<
  TFieldName,
  TFieldValues extends FieldValues = FieldValues,
> =
  TFieldName extends FieldPath<TFieldValues>
    ? FieldPathValue<TFieldValues, TFieldName>
    : DeepPartialSkipArrayKey<TFieldValues>;

export type WatchName<TFieldValues extends FieldValues> =
  | FieldPath<TFieldValues>
  | FieldPath<TFieldValues>[]
  | readonly FieldPath<TFieldValues>[]
  | undefined;

export type WatchValue<
  TFieldName,
  TFieldValues extends FieldValues = FieldValues,
> = TFieldName extends
  | FieldPath<TFieldValues>[]
  | readonly FieldPath<TFieldValues>[]
  ? FieldPathValues<TFieldValues, TFieldName>
  : TFieldName extends FieldPath<TFieldValues>
    ? FieldPathValue<TFieldValues, TFieldName>
    : TFieldValues;

export type WatchRenderValue<
  TFieldName,
  TFieldValues extends FieldValues,
  TComputeValue,
> = TComputeValue extends undefined
  ? WatchValue<TFieldName, TFieldValues>
  : TComputeValue;

export type WatchProps<
  TFieldName extends WatchName<TFieldValues>,
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
  TComputeValue = undefined,
> = {
  control?: Control<TFieldValues, TContext, TTransformedValues>;
  /**
   * @deprecated This prop will be renamed to `name` in the next major release.
   * Use `name` instead.
   */
  names?: TFieldName;
  name?: TFieldName;
  disabled?: boolean;
  exact?: boolean;
  defaultValue?: WatchDefaultValue<TFieldName, TFieldValues>;
  compute?: (value: WatchValue<TFieldName, TFieldValues>) => TComputeValue;
  render: (
    value: WatchRenderValue<TFieldName, TFieldValues, TComputeValue>,
  ) => ReactNode | ReactNode[];
};
