/**
 * Lookup in which each date library can register its supported date object type.
 *
 * ```
 * // Example taken from the TemporalAdapterDateFns.ts file.
 * declare module '@base-ui/react/internals/temporal' {
 *   interface TemporalSupportedObjectLookup {
 *     'date-fns': Date;
 *   }
 * }
 * ```
 */
export interface TemporalSupportedObjectLookup {}

/**
 * The valid shape date objects can take in the components and utilities that deal with dates and times.
 */
export type TemporalSupportedObject = keyof TemporalSupportedObjectLookup extends never
  ? any
  : TemporalSupportedObjectLookup[keyof TemporalSupportedObjectLookup];

/**
 * The valid value for the timezone argument in components and utilities that deal with dates and times.
 */
export type TemporalTimezone = 'default' | 'system' | 'UTC' | string;

/**
 * The type that the `value` and `defaultValue` props can receive on non-range date and time components (date, time and date-time).
 */
export type TemporalValue = TemporalSupportedObject | null;

/**
 * The type that the `value` and `defaultValue` props can receive on range components (date-range, time-range and date-time-range).
 */
export type TemporalRangeValue = [TemporalValue, TemporalValue];

/**
 * The type that the `value` and `defaultValue` props can receive on all temporal components.
 */
export type TemporalSupportedValue = TemporalValue | TemporalRangeValue;

export type TemporalNonNullableRangeValue = [TemporalSupportedObject, TemporalSupportedObject];

export type TemporalNonNullableValue<TValue extends TemporalSupportedValue> =
  TValue extends TemporalRangeValue
    ? TValue extends TemporalValue
      ? TemporalSupportedObject | TemporalNonNullableRangeValue
      : TemporalNonNullableRangeValue
    : TemporalSupportedObject;
