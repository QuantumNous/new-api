import { useEffect } from 'react';

const DEFAULT_INTERVAL_MS = 500;

const useRepeatingDomPatch = (
  patchFn,
  deps = [],
  intervalMs = DEFAULT_INTERVAL_MS,
) => {
  useEffect(() => {
    if (typeof patchFn !== 'function') {
      return undefined;
    }

    patchFn();
    const timer = window.setInterval(patchFn, intervalMs);

    return () => window.clearInterval(timer);
  }, deps);
};

export default useRepeatingDomPatch;
