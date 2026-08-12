import type { DeepPartial, ExtractObjects, IsAny, IsNever } from '../types';

import type { Equal, Expect } from './__fixtures__';
import { _ } from './__fixtures__';

/** {@link IsAny} */ {
  /** it should evaluate to true for any */ {
    const actual = _ as IsAny<any>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to false for never */ {
    const actual = _ as IsAny<never>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to false for unknown */ {
    const actual = _ as IsAny<unknown>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to false for string */ {
    const actual = _ as IsAny<string>;
    type _t = Expect<Equal<typeof actual, false>>;
  }
}

/** {@link IsNever} */ {
  /** it should evaluate to false for any */ {
    const actual = _ as IsNever<any>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to true for never */ {
    const actual = _ as IsNever<never>;
    type _t = Expect<Equal<typeof actual, true>>;
  }

  /** it should evaluate to false for unknown */ {
    const actual = _ as IsNever<unknown>;
    type _t = Expect<Equal<typeof actual, false>>;
  }

  /** it should evaluate to false for string */ {
    const actual = _ as IsNever<string>;
    type _t = Expect<Equal<typeof actual, false>>;
  }
}

/** {@link ExtractObjects} */ {
  /** it should extract all objects from a union */ {
    const actual = _ as ExtractObjects<
      { x: string } | { y: number; z: { w: number } } | number | string | null
    >;
    type _t = Expect<
      Equal<typeof actual, { x: string } | { y: number; z: { w: number } }>
    >;
  }
}

/** {@link DeepPartial} */ {
  /** it should make all nested properties optional */ {
    const actual = _ as DeepPartial<{
      x: string;
      y: number;
      z: { w: boolean };
    }>;
    type _t = Expect<
      Equal<typeof actual, { x?: string; y?: number; z?: { w?: boolean } }>
    >;
  }

  /** it should make all nested properties optional for union types */ {
    const actual = _ as DeepPartial<{
      x: string | number;
      y: { a: string | null } | null;
    }>;
    type _t = Expect<
      Equal<
        typeof actual,
        {
          x?: string | number;
          y?: { a?: string | null } | null;
        }
      >
    >;
  }

  /** it should make all nested properties optional for intersection types */ {
    const actual = _ as DeepPartial<{
      x: string;
      y: { a: string } & { b: number };
    }>;
    type _t = Expect<
      Equal<
        typeof actual,
        {
          x?: string;
          y?: { a?: string; b?: number };
        }
      >
    >;
  }

  /** it should be assignable for types containing unknown */ {
    const actual = _ as { x: unknown };
    type _t = Expect<
      typeof actual extends DeepPartial<{ x: unknown }> ? true : false
    >;
  }

  /** it should preserve branded types as-is */ {
    type UserId = string & { __brand: 'UserId' };
    type ProductId = number & { __brand: 'ProductId' };

    const actual = _ as DeepPartial<{
      userId: UserId;
      productId: ProductId;
      nested: {
        brandedField: UserId;
      };
    }>;

    type _t = Expect<
      Equal<
        typeof actual,
        {
          userId?: UserId;
          productId?: ProductId;
          nested?: {
            brandedField?: UserId;
          };
        }
      >
    >;
  }
}
