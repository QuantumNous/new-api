import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next, { Interpolator } from 'i18next';

describe('interpolator', () => {
  const interpolator = i18next.services.interpolator;

  it('should have correct type', () => {
    assertType<Interpolator>(interpolator);
  });

  it('initReturn', () => {
    expectTypeOf(interpolator.init).parameters.toMatchTypeOf<[object, boolean]>();
    expectTypeOf(interpolator.init).returns.toBeUndefined();
  });

  it('reset', () => {
    expectTypeOf(interpolator.reset).parameters.toEqualTypeOf<[]>();
    expectTypeOf(interpolator.reset).returns.toBeUndefined();
  });

  it('resetRegExp', () => {
    expectTypeOf(interpolator.resetRegExp).parameters.toEqualTypeOf<[]>();
    expectTypeOf(interpolator.resetRegExp).returns.toBeUndefined();
  });

  it('nest', () => {
    expectTypeOf(interpolator.nest).parameters.toMatchTypeOf(['', () => undefined, {}]);
    expectTypeOf(interpolator.nest).returns.toBeString();
  });

  it('interpolate', () => {
    expectTypeOf(interpolator.interpolate).parameters.toMatchTypeOf(['', {}, '', {}]);
    expectTypeOf(interpolator.interpolate).returns.toBeString();
  });
});
