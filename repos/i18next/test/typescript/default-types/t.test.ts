import { describe, it, expectTypeOf } from 'vitest';
import { TFunction } from 'i18next';

describe('t', () => {
  it('should not throw error for different t functions', () => {
    const tOrd = (() => '') as TFunction<'ord'>;
    const tOrdPlurals = (() => '') as TFunction<['ord', 'plurals']>;
    const tPluralsOrd = (() => '') as TFunction<['plurals', 'ord']>;
    const tString = (() => '') as TFunction<[string, string]>;
    const tPlurals = (() => '') as TFunction<'plurals'>;
    const tPlain = (() => '') as TFunction;

    // no error - not checked when CustomTypeOptions["resources"] is not provided
    expectTypeOf(tOrd).toEqualTypeOf(tPlurals);
    expectTypeOf(tOrdPlurals).toEqualTypeOf(tPlurals);
    expectTypeOf(tPluralsOrd).toEqualTypeOf(tPlurals);
    expectTypeOf(tString).toEqualTypeOf(tPlurals);

    expectTypeOf(tOrd).toEqualTypeOf(tPlain);
    expectTypeOf(tOrdPlurals).toEqualTypeOf(tPlain);
    expectTypeOf(tPluralsOrd).toEqualTypeOf(tPlain);
    expectTypeOf(tString).toEqualTypeOf(tPlain);
  });
});
