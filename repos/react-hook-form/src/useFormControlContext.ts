import React from 'react';

import type { Control, FieldValues } from './types';

/**
 * Separate context for `control` to prevent unnecessary rerenders.
 * Internal hooks that only need control use this instead of full form context.
 */
export const HookFormControlContext = React.createContext<Control | null>(null);
HookFormControlContext.displayName = 'HookFormControlContext';

/**
 * @internal Internal hook to access only control from context.
 */
export const useFormControlContext = <
  TFieldValues extends FieldValues,
  TContext = any,
  TTransformedValues = TFieldValues,
>(): Control<TFieldValues, TContext, TTransformedValues> =>
  React.useContext(HookFormControlContext) as Control<
    TFieldValues,
    TContext,
    TTransformedValues
  >;
