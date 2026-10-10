type ConcatTupleTenTimes<T extends unknown[]> = [
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
  ...T,
];

export type HundredTuple<T> = ConcatTupleTenTimes<ConcatTupleTenTimes<[T]>>;
