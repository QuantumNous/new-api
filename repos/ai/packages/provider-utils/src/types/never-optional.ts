// 0 extends 1 & N checks for any
// [N] extends [never] checks for never
export type NeverOptional<N, T> = 0 extends 1 & N
  ? Partial<T>
  : [N] extends [never]
    ? Partial<Record<keyof T, undefined>>
    : T;
