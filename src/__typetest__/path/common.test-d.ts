import type {
  ArrayKey,
  AsKey,
  AsPathTuple,
  CheckKeyConstraint,
  ContainsIndexable,
  EvaluateKey,
  EvaluatePath,
  HasKey,
  HasPath,
  IsTuple,
  JoinPathTuple,
  Key,
  Keys,
  NumericKeys,
  ObjectKeys,
  PathString,
  SplitPathString,
  ToKey,
  TupleKeys,
  UnionToIntersection,
  ValidPathPrefix,
} from '../../types/path/common';
import type {
  HundredPathString,
  HundredTuple,
  InfiniteType,
  Nested,
  NullableInfiniteType,
} from '../__fixtures__';
import type { Equal, Expect } from '../__fixtures__';
import { _ } from '../__fixtures__';

/** {@link IsTuple} */ {
  /** it should evaluate to true if it's a tuple */ {
    const actual = _ as IsTuple<[string, number]>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to false if it's not a tuple */ {
    const actual = _ as IsTuple<string[]>;
    type _t = Expect<Equal<typeof actual, false>>;
  }
}

/** {@link TupleKeys} */ {
  /** it should evaluate to the own keys of the tuple */ {
    const actual = _ as TupleKeys<[string, number]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should evaluate to never if an array type is passed */ {
    const actual = _ as TupleKeys<string[]>;
    type _t = Expect<Equal<typeof actual, never>>;
  }
}

/** {@link AsKey} */ {
  /** it should behave like a noop type when a Key is passed */ {
    const actual = _ as AsKey<'foo'>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should evaluate to never if not a Key is passed */ {
    const actual = _ as AsKey<boolean>;
    type _t = Expect<Equal<typeof actual, never>>;
  }
}

/** {@link ToKey} */ {
  /** it should behave like a noop type when a Key is passed */ {
    const actual = _ as ToKey<'foo'>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should evaluate to never if not a Key or ArrayKey is passed */ {
    const actual = _ as ToKey<boolean>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should convert an ArrayKey to a template literal type */ {
    const actual = _ as ToKey<ArrayKey>;
    type _t = Expect<Equal<typeof actual, `${ArrayKey}`>>;
  }
}

/** {@link AsPathTuple} */ {
  /** it should behave like a noop type when a PathTuple is passed */ {
    const actual = _ as AsPathTuple<['foo']>;
    type _t = Expect<Equal<typeof actual, ['foo']>>;
  }

  /** it should evaluate to never if not a PathTuple is passed */ {
    const actual = _ as AsPathTuple<[42]>;
    type _t = Expect<Equal<typeof actual, never>>;
  }
}

/** {@link SplitPathString} */ {
  /** it should split the PathString */ {
    const actual = _ as SplitPathString<'foo.bar.0.baz'>;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', '0', 'baz']>>;
  }

  /** it should split a PathString which does not contain a "." */ {
    const actual = _ as SplitPathString<'foo'>;
    type _t = Expect<Equal<typeof actual, ['foo']>>;
  }

  /** it should return an empty tuple for a blank PathString */ {
    const actual = _ as SplitPathString<''>;
    type _t = Expect<Equal<typeof actual, []>>;
  }

  /** it should return an empty tuple for a PathString containing only a "." */ {
    const actual = _ as SplitPathString<'.'>;
    type _t = Expect<Equal<typeof actual, []>>;
  }

  /** it should be implemented tail recursively */ {
    const actual = _ as SplitPathString<HundredPathString<'foo'>>;
    type _t = Expect<Equal<typeof actual, HundredTuple<'foo'>>>;
  }

  /** it should work on unions */ {
    const actual = _ as SplitPathString<'foo.bar' | 'bar.foo'>;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar'] | ['bar', 'foo']>>;
  }

  /** it should split a PathString containing a number template */ {
    const actual = _ as SplitPathString<`foo.bar.${number}.baz`>;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', `${number}`, 'baz']>>;
  }

  /** it should split a PathString containing a string template */ {
    const actual = _ as SplitPathString<`foo.bar.${string}.baz`>;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', string, 'baz']>>;
  }
}

/** {@link JoinPathTuple} */ {
  /** it should join the PathTuple */ {
    const actual = _ as JoinPathTuple<['foo', 'bar', '0', 'baz']>;
    type _t = Expect<Equal<typeof actual, 'foo.bar.0.baz'>>;
  }

  /** it should join a PathTuple of length 1 */ {
    const actual = _ as JoinPathTuple<['foo']>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should evaluate to never when passed an empty PathTuple */ {
    const actual = _ as JoinPathTuple<[]>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should be implemented tail recursively */ {
    const actual = _ as JoinPathTuple<HundredTuple<'foo'>>;
    type _t = Expect<Equal<typeof actual, HundredPathString<'foo'>>>;
  }

  /** it should work on unions */ {
    const actual = _ as JoinPathTuple<['foo', 'bar'] | ['bar', 'foo']>;
    type _t = Expect<Equal<typeof actual, 'foo.bar' | 'bar.foo'>>;
  }

  /** it should evaluate to never if a keys is never */ {
    const actual = _ as JoinPathTuple<['foo', never]>;
    type _t = Expect<Equal<typeof actual, never>>;
  }
}

/** {@link CheckKeyConstraint} */ {
  /** it should remove the keys which don't match the constraint */ {
    const actual = _ as CheckKeyConstraint<
      { foo: string; bar: number },
      'foo' | 'bar',
      string
    >;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }
}

/** {@link UnionToIntersection} */ {
  /** it should intersect a union of objects */ {
    const actual = _ as UnionToIntersection<{ foo: string } | { bar: number }>;
    type _t = Expect<Equal<typeof actual, { foo: string } & { bar: number }>>;
  }

  /** it should intersect wrapped unions */ {
    const actual = _ as UnionToIntersection<[0 | 1] | [1 | 2]>[never];
    type _t = Expect<Equal<typeof actual, 1>>;
  }
}

/** {@link ContainsIndexable} */ {
  /** it should evaluate to true when an array is passed */ {
    const actual = _ as ContainsIndexable<number[]>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to true when a tuple is passed */ {
    const actual = _ as ContainsIndexable<[number]>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to false when a string is passed */ {
    const actual = _ as ContainsIndexable<string>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to false when an object is passed */ {
    const actual = _ as ContainsIndexable<{ foo: string }>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to true when an array is part of the union */ {
    const actual = _ as ContainsIndexable<{ foo: string } | number[]>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to true when a tuple is part of the union */ {
    const actual = _ as ContainsIndexable<{ foo: string } | [number]>;
    type _t = Expect<Equal<typeof actual, true>>;
  }
}

/** {@link NumericKeys} */ {
  /** it should return the numeric keys of an object */ {
    const actual = _ as NumericKeys<{ 0: string; '1': string; foo: string }>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the numeric keys of an array */ {
    const actual = _ as NumericKeys<number[]>;
    type _t = Expect<Equal<typeof actual, `${number}`>>;
  }

  /** it should return the numeric keys of a tuple */ {
    const actual = _ as NumericKeys<[string, number]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the overlapping numeric keys of a tuple and array */ {
    const actual = _ as NumericKeys<[number, string] | number[]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the overlapping numeric keys of an object and array */ {
    const actual = _ as NumericKeys<{ 0: string; '1': string } | number[]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the overlapping numeric keys of an object and tuple */ {
    const actual = _ as NumericKeys<{ 1: string } | [number, string]>;
    type _t = Expect<Equal<typeof actual, '1'>>;
  }
}

/** {@link ObjectKeys} */ {
  /** it should return the keys of an object */ {
    const actual = _ as ObjectKeys<{ foo: string; bar: number }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the overlapping keys of a union of objects */ {
    const actual = _ as ObjectKeys<
      { foo: string; bar: number } | { bar: number; baz: string }
    >;
    type _t = Expect<Equal<typeof actual, 'bar'>>;
  }

  /** it should not return keys which contain dots */ {
    const actual = _ as ObjectKeys<{ foo: string; 'foo.bar': number }>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should not return blank keys */ {
    const actual = _ as ObjectKeys<{ foo: string; '': number }>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }
}

/** {@link Keys} */ {
  /** it should return the keys of an object */ {
    const actual = _ as Keys<{ foo: string; bar: number }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the keys of a tuple */ {
    const actual = _ as Keys<[number, string]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the keys of an array */ {
    const actual = _ as Keys<string[]>;
    type _t = Expect<Equal<typeof actual, `${number}`>>;
  }

  /** it should return the optional keys of an object */ {
    const actual = _ as Keys<{ foo?: string; bar?: number }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the keys of a nullable type */ {
    const actual = _ as Keys<{ foo: string; bar: number } | null>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the keys of an undefinable type */ {
    const actual = _ as Keys<{ foo: string; bar: number } | undefined>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the optional keys of a tuple */ {
    const actual = _ as Keys<[foo?: string, bar?: number]>;
    type _t = Expect<Equal<typeof actual, '0' | '1'>>;
  }

  /** it should return the optional keys of a union of tuple and object */ {
    const actual = _ as Keys<[foo?: string] | { 0?: string; 1?: string }>;
    type _t = Expect<Equal<typeof actual, '0'>>;
  }

  /** it should only return the keys of string properties */ {
    const actual = _ as Keys<{ foo: string; bar: number }, string>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should only return the keys of string properties */ {
    const actual = _ as Keys<{ 1: string; 2: number }, string>;
    type _t = Expect<Equal<typeof actual, '1'>>;
  }

  /** it should return only the required keys when undefined is excluded */ {
    const actual = _ as Keys<{ foo: string; bar?: string }, string>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should return the optional keys when undefined is included */ {
    const actual = _ as Keys<{ foo: string; bar?: string }, string | undefined>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar'>>;
  }

  /** it should return the overlapping keys of a union of objects */ {
    const actual = _ as Keys<
      { foo: string; bar: number } | { bar: number; baz: string }
    >;
    type _t = Expect<Equal<typeof actual, 'bar'>>;
  }

  /** it should return the keys of the tuple when given a tuple and an array */ {
    const actual = _ as Keys<number[] | [number]>;
    type _t = Expect<Equal<typeof actual, '0'>>;
  }

  /** it should return the overlapping keys when given a tuple and an object */ {
    const actual = _ as Keys<{ 0: string; 1: number } | [number]>;
    type _t = Expect<Equal<typeof actual, '0'>>;
  }

  /** it should return the overlapping keys when given a tuple and an object */ {
    const actual = _ as Keys<{ foo: string } | [number]>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should return the numeric keys when given an array and an object */ {
    const actual = _ as Keys<{ 0: string; foo: number } | number[]>;
    type _t = Expect<Equal<typeof actual, '0'>>;
  }

  /** it should return {@link Key} when given any */ {
    const actual = _ as Keys<any>;
    type _t = Expect<Equal<typeof actual, Key>>;
  }

  /** it should return {@link Key} when given never */ {
    const actual = _ as Keys<never>;
    type _t = Expect<Equal<typeof actual, Key>>;
  }

  /** it should return never when given unknown */ {
    const actual = _ as Keys<unknown>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should return never when given a string */ {
    const actual = _ as Keys<string>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should return never when given undefined */ {
    const actual = _ as Keys<undefined>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should return never when given null */ {
    const actual = _ as Keys<null>;
    type _t = Expect<Equal<typeof actual, never>>;
  }
}

/** {@link HasKey} */ {
  /** it should return true when the key exists */ {
    const actual = _ as HasKey<{ foo: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should return false when the key doesn't exist */ {
    const actual = _ as HasKey<{ foo: string }, 'bar'>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should return false when one of the keys doesn't exist */ {
    const actual = _ as HasKey<{ foo: string }, 'foo' | 'bar'>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should return false when one key doesn't exist in one of the types */ {
    const actual = _ as HasKey<{ foo: string } | { bar: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, false>>;
  }
}

/** {@link EvaluateKey} */ {
  /** it should traverse an object */ {
    const actual = _ as EvaluateKey<{ foo: number; bar: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse an index signature */ {
    const actual = _ as EvaluateKey<Record<string, number>, string>;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse a numeric index signature */ {
    const actual = _ as EvaluateKey<Record<number, string>, `${number}`>;
    type _t = Expect<Equal<typeof actual, string>>;
  }

  /** it should traverse an object with numeric keys */ {
    const actual = _ as EvaluateKey<{ 0: number }, '0'>;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse a tuple */ {
    const actual = _ as EvaluateKey<[boolean, string], '1'>;
    type _t = Expect<Equal<typeof actual, string>>;
  }

  /** it should traverse an array */ {
    const actual = _ as EvaluateKey<boolean[], '42'>;
    type _t = Expect<Equal<typeof actual, boolean>>;
  }

  /** it should handle optional keys */ {
    const actual = _ as EvaluateKey<{ foo?: number }, 'foo'>;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should handle optional indexes */ {
    const actual = _ as EvaluateKey<[foo?: number], '0'>;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should add undefined if the key is not valid */ {
    const actual = _ as EvaluateKey<{ foo: string }, 'foobar'>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should evaluate to undefined if the key is out of bounds */ {
    const actual = _ as EvaluateKey<[string], '1'>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should work on path unions */ {
    const actual = _ as EvaluateKey<
      { foo: number; bar: string },
      'foo' | 'bar'
    >;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should add undefined if one of the keys doesn't exist */ {
    const actual = _ as EvaluateKey<{ foo: number }, 'foo' | 'bar'>;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should add null if the type may be null */ {
    const actual = _ as EvaluateKey<null | { foo: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, string | null>>;
  }

  /** it should add undefined if the type may be undefined */ {
    const actual = _ as EvaluateKey<undefined | { foo: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should add null and undefined if the type may be null or undefined */ {
    const actual = _ as EvaluateKey<null | undefined | { foo: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, string | null | undefined>>;
  }

  /** it should evaluate to undefined if the type is not traversable */ {
    const actual = _ as EvaluateKey<string, 'foo'>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should evaluate to undefined if the key is non-numeric */ {
    const actual = _ as EvaluateKey<string[], 'foo'>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should work on unions of object */ {
    const actual = _ as EvaluateKey<{ foo: number } | { foo: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should work on unions of object and tuple */ {
    const actual = _ as EvaluateKey<{ 0: number } | [string], '0'>;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should work on unions of object and array */ {
    const actual = _ as EvaluateKey<{ 0: number } | string[], '0'>;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should work on unions of tuple and array */ {
    const actual = _ as EvaluateKey<[number] | string[], '0'>;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should add undefined if the key doesn't exist in one of the types */ {
    const actual = _ as EvaluateKey<{ foo: number } | { bar: string }, 'foo'>;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should add undefined if the key is out of bounds in one of the types */ {
    const actual = _ as EvaluateKey<[] | [number], '0'>;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should evaluate to any if the type is any */ {
    const actual = _ as EvaluateKey<any, string>;
    type _t = Expect<Equal<typeof actual, any>>;
  }

  /** it should access methods on primitives */ {
    const actual = _ as EvaluateKey<string, 'toString'>;
    type _t = Expect<Equal<typeof actual, () => string>>;
  }

  /** it should access methods on arrays */ {
    const actual = _ as EvaluateKey<number[], 'toString'>;
    type _t = Expect<Equal<typeof actual, () => string>>;
  }

  /** it should access methods on tuples */ {
    const actual = _ as EvaluateKey<[number], 'toString'>;
    type _t = Expect<Equal<typeof actual, () => string>>;
  }
}

/** {@link ValidPathPrefix} */ {
  /** it should return the entire path if it is valid */ {
    const actual = _ as ValidPathPrefix<
      InfiniteType<string>,
      ['foo', 'bar', '0', 'baz', '42']
    >;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', '0', 'baz', '42']>>;
  }

  /** it should return the entire nullable path if it is valid */ {
    const actual = _ as ValidPathPrefix<
      NullableInfiniteType<string>,
      ['foo', 'bar', '0', 'baz', '42']
    >;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', '0', 'baz', '42']>>;
  }

  /** it should return the longest valid prefix */ {
    const actual = _ as ValidPathPrefix<
      InfiniteType<string>,
      ['foo', 'bar', '0', 'ba', '42']
    >;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', '0']>>;
  }

  /** it should return the longest common valid prefix */ {
    const actual = _ as ValidPathPrefix<
      InfiniteType<string> | { foo: string },
      ['foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, ['foo']>>;
  }

  /** it should return an empty tuple when the path is an empty tuple */ {
    const actual = _ as ValidPathPrefix<InfiniteType<string>, []>;
    type _t = Expect<Equal<typeof actual, []>>;
  }

  /** it should be implemented tail recursively */ {
    const actual = _ as ValidPathPrefix<
      InfiniteType<string>,
      HundredTuple<'foo'>
    >;
    type _t = Expect<Equal<typeof actual, HundredTuple<'foo'>>>;
  }

  /** it should be distributive on path unions */ {
    const actual = _ as ValidPathPrefix<
      InfiniteType<string>,
      ['foo', 'bar', '0', 'ba', '42'] | ['foo', 'ba']
    >;
    type _t = Expect<Equal<typeof actual, ['foo', 'bar', '0'] | ['foo']>>;
  }
}

/** {@link HasPath} */ {
  /** it should return true if the path exists */ {
    const actual = _ as HasPath<
      InfiniteType<string>,
      ['foo', 'bar', '0', 'baz', '42']
    >;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should return false if the path doesn't exist */ {
    const actual = _ as HasPath<
      InfiniteType<string>,
      ['foo', 'bar', '0', 'ba', '42']
    >;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should return true if the path exist in both types */ {
    const actual = _ as HasPath<
      InfiniteType<string> | { foo: { bar: string } },
      ['foo', 'bar']
    >;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should return false if the path doesn't exist in both types */ {
    const actual = _ as HasPath<
      InfiniteType<string> | { foo: { bar: string } },
      ['foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should return false if either of the paths is invalid */ {
    const actual = _ as HasPath<
      InfiniteType<string>,
      ['foo', 'bar'] | ['foo', 'ba']
    >;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should return true if both of the path are valid */ {
    const actual = _ as HasPath<
      InfiniteType<string>,
      ['foo', 'baz'] | ['foo', 'bar']
    >;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to true when any is encountered */ {
    const actual = _ as HasPath<{ foo: any }, ['foo', 'bar', 'baz']>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to false when any is not encountered */ {
    const actual = _ as HasPath<{ foo: any }, ['bar', 'baz']>;
    type _t = Expect<Equal<typeof actual, false>>;
  }
}

/** {@link EvaluatePath} */ {
  /** it should traverse an object */ {
    const actual = _ as EvaluatePath<
      InfiniteType<number>,
      ['foo', 'foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse an index signature */ {
    const actual = _ as EvaluatePath<Record<string, number>, [string]>;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse a numeric index signature */ {
    const actual = _ as EvaluatePath<Record<number, string>, [`${number}`]>;
    type _t = Expect<Equal<typeof actual, string>>;
  }

  /** it should traverse a tuple */ {
    const actual = _ as EvaluatePath<
      InfiniteType<boolean>,
      ['bar', '0', 'value']
    >;
    type _t = Expect<Equal<typeof actual, boolean>>;
  }

  /** it should traverse an array */ {
    const actual = _ as EvaluatePath<
      InfiniteType<boolean>,
      ['baz', '42', 'value']
    >;
    type _t = Expect<Equal<typeof actual, boolean>>;
  }

  /** it should evaluate to never if the path is not valid */ {
    const actual = _ as EvaluatePath<InfiniteType<string>, ['foobar']>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should be implemented tail recursively */ {
    const actual = _ as EvaluatePath<InfiniteType<string>, HundredTuple<'foo'>>;
    type _t = Expect<Equal<typeof actual, InfiniteType<string>>>;
  }

  /** it should work on path unions */ {
    const actual = _ as EvaluatePath<
      InfiniteType<number>,
      ['foo', 'foo'] | ['foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, number | InfiniteType<number>>>;
  }

  /** it should add undefined if one of the paths doesn't exist */ {
    const actual = _ as EvaluatePath<
      InfiniteType<number>,
      ['foo', 'value'] | ['foo', 'foobar']
    >;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should add null if the path contains a nullable */ {
    const actual = _ as EvaluatePath<
      { foo: null | { bar: string } },
      ['foo', 'bar']
    >;
    type _t = Expect<Equal<typeof actual, string | null>>;
  }

  /** it should add undefined if the path contains an optional */ {
    const actual = _ as EvaluatePath<{ foo?: { bar: string } }, ['foo', 'bar']>;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should add undefined if the path contains an undefineable */ {
    const actual = _ as EvaluatePath<
      { foo: undefined | { bar: string } },
      ['foo', 'bar']
    >;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should evaluate to undefined if the type is not traversable */ {
    const actual = _ as EvaluatePath<string, ['foo']>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should work on type unions */ {
    const actual = _ as EvaluatePath<
      InfiniteType<number> | InfiniteType<string>,
      ['foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, number | string>>;
  }

  /** it should add undefined if the path doesn't exist in one of the types */ {
    const actual = _ as EvaluatePath<
      InfiniteType<number> | Nested<string>,
      ['foo', 'value']
    >;
    type _t = Expect<Equal<typeof actual, number | undefined>>;
  }

  /** it should evaluate to any if the type is any */ {
    const actual = _ as EvaluatePath<any, ['foo']>;
    type _t = Expect<Equal<typeof actual, any>>;
  }

  /** it should evaluate to any if it encounters any */ {
    const actual = _ as EvaluatePath<{ foo: any }, ['foo', 'bar', 'baz']>;
    type _t = Expect<Equal<typeof actual, any>>;
  }

  /** it should not evaluate to any if it doesn't encounter any */ {
    const actual = _ as EvaluatePath<{ foo: any }, ['bar', 'baz']>;
    type _t = Expect<Equal<typeof actual, undefined>>;
  }

  /** it should not create a union which is too complex to represent */ {
    const makeSetter =
      <T>() =>
      <PS extends PathString>(
        _: PS,
        value: EvaluatePath<T, SplitPathString<PS>>,
      ) =>
        value;

    const setter = makeSetter<{ foo: string }>();

    const actual = setter('foo', 'bar');
    type _t = Expect<Equal<typeof actual, string>>;
  }
}
