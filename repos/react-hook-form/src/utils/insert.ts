import convertToArrayPayload from './convertToArrayPayload';

export default function insert<T>(data: T[], index: number): (T | undefined)[];
export default function insert<T>(
  data: T[],
  index: number,
  value: T | T[],
): T[];
export default function insert<T>(
  data: T[],
  index: number,
  value?: T | T[],
): (T | undefined)[] {
  return [
    ...data.slice(0, index),
    ...convertToArrayPayload(value),
    ...data.slice(index),
  ];
}
