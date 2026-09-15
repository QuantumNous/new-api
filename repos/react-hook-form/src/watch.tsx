import type {
  FieldPath,
  FieldValues,
  WatchProps,
  WatchRenderValue,
} from './types';
import { useWatch } from './useWatch';

/**
 * Watch component that subscribes to form field changes and re-renders when watched fields update.
 *
 * @param control - The form control object from useForm
 * @param name - Can be field name, array of field names, or undefined to watch the entire form
 * @param disabled - Disable subscription
 * @param exact - Whether to watch exact field names or not
 * @param defaultValue - The default value to use if the field is not yet set
 * @param compute - Function to compute derived values from watched fields
 * @param render - The function that receives watched values and returns ReactNode
 * @returns The result of calling render function with watched values
 *
 * @example
 * The `Watch` component only re-render when the values of `foo`, `bar`, and `baz.qux` change.
 * The types of `foo`, `bar`, and `baz.qux` are precisely inferred.
 *
 * ```tsx
 * const { control } = useForm();
 *
 * <Watch
 *   control={control}
 *   names={['foo', 'bar', 'baz.qux']}
 *   render={([foo, bar, baz_qux]) => <div>{foo}{bar}{baz_qux}</div>}
 * />
 * ```
 */
export const Watch = <
  TFieldValues extends FieldValues = FieldValues,
  TFieldName extends
    | FieldPath<TFieldValues>
    | readonly [FieldPath<TFieldValues>, ...FieldPath<TFieldValues>[]]
    | FieldPath<TFieldValues>[]
    | readonly FieldPath<TFieldValues>[]
    | undefined = undefined,
  TContext = any,
  TTransformedValues = TFieldValues,
  TComputeValue = undefined,
>(
  props: WatchProps<
    TFieldName,
    TFieldValues,
    TContext,
    TTransformedValues,
    TComputeValue
  >,
) =>
  props.render(
    useWatch({ name: props.names, ...(props as any) }) as WatchRenderValue<
      TFieldName,
      TFieldValues,
      TComputeValue
    >,
  );
