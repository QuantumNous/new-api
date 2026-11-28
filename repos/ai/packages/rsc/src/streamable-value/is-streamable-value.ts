import {
  STREAMABLE_VALUE_TYPE,
  type StreamableValue,
} from './streamable-value';
export function isStreamableValue(value: unknown): value is StreamableValue {
  return (
    value != null &&
    typeof value === 'object' &&
    'type' in value &&
    value.type === STREAMABLE_VALUE_TYPE
  );
}
