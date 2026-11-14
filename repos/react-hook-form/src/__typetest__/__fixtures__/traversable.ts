interface Base<T, V> {
  foo: T;
  bar: [T];
  baz: Array<T>;
  value: V;
}

export type InfiniteType<T> = Base<InfiniteType<T>, T>;

export type NullableInfiniteType<T> =
  | null
  | undefined
  | Partial<Base<NullableInfiniteType<T>, T>>;

export type Depth3Type<T> = Base<Base<Base<never, T>, T>, T>;

export interface Nested<T> {
  nested: T;
}
