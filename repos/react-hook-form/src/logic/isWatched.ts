import type { InternalFieldName, Names } from '../types';

export default (
  name: InternalFieldName,
  _names: Names,
  isBlurEvent?: boolean,
) => {
  if (isBlurEvent) return false;
  if (_names.watchAll || _names.watch.has(name)) return true;
  for (const watchName of _names.watch) {
    if (name.startsWith(watchName) && name.charAt(watchName.length) === '.')
      return true;
  }
  return false;
};
