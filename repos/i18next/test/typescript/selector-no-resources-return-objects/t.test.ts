import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction, DefaultTReturn, SelectorOptions } from 'i18next';

declare const t: TFunction;

describe('t', () => {
  it('allows arbitrary traversal when resources is not defined, and always returns type string', () => {
    expectTypeOf(t(($) => $.a)).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
    expectTypeOf(t(($) => $.a[0])).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
    expectTypeOf(t(($) => $.a[0].b)).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
    expectTypeOf(t(($) => $.a[0].b[1])).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
    expectTypeOf(t(($) => $.a[0].b[1].c)).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
    expectTypeOf(t(($) => $.a[0].b[1].c[2])).toEqualTypeOf<DefaultTReturn<SelectorOptions>>();
  });
});
