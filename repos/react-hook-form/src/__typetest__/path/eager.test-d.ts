import type { ArrayPath, FieldPathValues, Path, PathValue } from '../../types';
import type { Depth3Type } from '../__fixtures__';
import type { Equal, Expect } from '../__fixtures__';
import { _ } from '../__fixtures__';

/** {@link Path} */ {
  /** it should evaluate to never for an empty object */ {
    const actual = _ as Path<object>;
    type _t = Expect<Equal<typeof actual, never>>;
  }

  /** it should evaluate to all paths of an object */ {
    const actual = _ as Path<{ foo: { bar: string; baz: string } }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'foo.bar' | 'foo.baz'>>;
  }

  /** it should include paths through tuples */ {
    const actual = _ as Path<{ foo: [string, number] }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'foo.0' | 'foo.1'>>;
  }

  /** it should include paths through arrays */ {
    const actual = _ as Path<{ foo: string[] }>;
    type _t = Expect<Equal<typeof actual, 'foo' | `foo.${number}`>>;
  }

  /** it should be able to avoid self-referencing/recursion, not crashing on self-referencing types. */ {
    type Foo = { foo: Foo };
    const actual = _ as Path<Foo>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should not erroneously match subtypes as traversed */ {
    type Foo =
      | {
          foo?: Foo;
          bar?: {
            baz: 1;
          };
        }
      | Record<string, never>;
    const actual = _ as Path<Foo>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'bar' | 'bar.baz'>>;
  }
}

/** {@link ArrayPath} */ {
  /** it should evaluate to all paths pointing to a non-primitive array */ {
    const actual = _ as ArrayPath<{
      foo: Array<{ bar: string[]; baz: string[] }>;
    }>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should include paths through tuples */ {
    const actual = _ as ArrayPath<{ foo: [object[], object[]] }>;
    type _t = Expect<Equal<typeof actual, 'foo' | 'foo.0' | 'foo.1'>>;
  }

  /** it should include paths through arrays */ {
    const actual = _ as ArrayPath<{ foo: string[][][] }>;
    type _t = Expect<Equal<typeof actual, 'foo' | `foo.${number}`>>;
  }

  /** it should be able to avoid self-referencing/recursion, not crashing on self-referencing types. */ {
    type Foo = { foo: Foo[] };
    const actual = _ as ArrayPath<Foo>;
    type _t = Expect<Equal<typeof actual, 'foo'>>;
  }

  /** it should not erroneously match subtypes as traversed */ {
    type Foo =
      | {
          bar?: {
            baz?: 1;
            fooArr?: Foo[];
          };
        }
      | Record<string, never>;
    const actual = _ as ArrayPath<Foo>;
    type _t = Expect<Equal<typeof actual, 'bar.fooArr'>>;
  }
}

/** {@link PathValue} */ {
  /** it should traverse an object */ {
    const actual = _ as PathValue<Depth3Type<number>, 'foo.foo.value'>;
    type _t = Expect<Equal<typeof actual, number>>;
  }

  /** it should traverse a tuple */ {
    const actual = _ as PathValue<Depth3Type<boolean>, 'bar.0.value'>;
    type _t = Expect<Equal<typeof actual, boolean>>;
  }

  /** it should traverse an array */ {
    const actual = _ as PathValue<Depth3Type<boolean>, 'baz.42.value'>;
    type _t = Expect<Equal<typeof actual, boolean>>;
  }

  /** it should apply optional type for optional arrays */ {
    const actual = _ as PathValue<Depth3Type<string[] | undefined>, 'value.1'>;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should traverse an object and apply optional type for optional arrays */ {
    const actual = _ as PathValue<
      Depth3Type<string[] | undefined>,
      'foo.foo.value.3'
    >;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should traverse a tuple and apply optional type for optional arrays */ {
    const actual = _ as PathValue<
      Depth3Type<string[] | undefined>,
      'bar.0.value.3'
    >;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }

  /** it should traverse an array and apply optional type for optional arrays */ {
    const actual = _ as PathValue<
      Depth3Type<string[] | undefined>,
      'baz.0.value.3'
    >;
    type _t = Expect<Equal<typeof actual, string | undefined>>;
  }
}

/** {@link FieldPathValues} */ {
  /** it should resolve all paths */ {
    const actual = _ as FieldPathValues<
      Depth3Type<string>,
      ['foo.foo.value', 'bar.0.value', 'baz.42.value']
    >;
    type _t = Expect<Equal<typeof actual, [string, string, string]>>;
  }
}
