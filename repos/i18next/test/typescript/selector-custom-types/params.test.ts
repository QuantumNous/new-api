import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction, SelectorParam } from 'i18next';

describe('Parameters<TFunction>', () => {
  it('should resolve first parameter to a callable type', () => {
    type FirstParam = Parameters<TFunction<['custom']>>[0];
    // Parameters<> resolves against the last overload (TS limitation).
    // After reordering, the last overload is the general selector, so
    // the first parameter should be a function, not SelectorKey.
    expectTypeOf<FirstParam>().toBeFunction();
  });

  it('should allow extracting parameters from TFunction with default namespace', () => {
    type FirstParam = Parameters<TFunction>[0];
    expectTypeOf<FirstParam>().toBeFunction();
  });
});

describe('SelectorParam', () => {
  it('should accept a valid selector function for the default namespace', () => {
    type Param = SelectorParam;
    expectTypeOf<Param>().toBeFunction();
    // Should be usable as a prop type
    const fn: Param = ($) => $.bar;
    expectTypeOf(fn).toEqualTypeOf<Param>();
  });

  it('should accept a valid selector function for a specific namespace', () => {
    type Param = SelectorParam<'custom'>;
    const fn: Param = ($) => $.bar;
    expectTypeOf(fn).toEqualTypeOf<Param>();
  });

  it('should reject invalid keys', () => {
    type Param = SelectorParam<'custom'>;
    // @ts-expect-error — 'nonexistent' is not a valid key
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const fn: Param = ($) => $.nonexistent;
  });
});
