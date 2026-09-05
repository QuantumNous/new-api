import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction } from 'i18next';

declare const t: TFunction;

describe('t', () => {
  it('allows arbitrary traversal when resources is not defined, and always returns type string', () => {
    expectTypeOf(t(($) => $.a)).toEqualTypeOf<string>();
    expectTypeOf(t(($) => $.a[0])).toEqualTypeOf<string>();
    expectTypeOf(t(($) => $.a[0].b)).toEqualTypeOf<string>();
    expectTypeOf(t(($) => $.a[0].b[1])).toEqualTypeOf<string>();
    expectTypeOf(t(($) => $.a[0].b[1].c)).toEqualTypeOf<string>();
    expectTypeOf(t(($) => $.a[0].b[1].c[2])).toEqualTypeOf<string>();
  });
});
