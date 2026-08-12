import type { InternalFieldName } from '../types';

export default (names: Set<InternalFieldName>, name: InternalFieldName) =>
  name
    .split('.')
    .some(
      (part, index, arr) =>
        !isNaN(Number(part)) && names.has(arr.slice(0, index).join('.')),
    );
