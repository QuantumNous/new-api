import { isDeepEqualData } from 'ai';
import { useEffect, useState } from 'react';

/**
 * Returns a stable value that only updates the stored value (and triggers a re-render)
 * when the value's contents differ by deep-compare.
 */
export function useStableValue<T>(latestValue: T): T {
  const [value, setValue] = useState<T>(latestValue);

  useEffect(() => {
    if (!isDeepEqualData(latestValue, value)) {
      setValue(latestValue);
    }
  }, [latestValue, value]);

  return value;
}
