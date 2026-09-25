import { describe, it, expectTypeOf, assertType } from 'vitest';
import { FormatFunction, InterpolationOptions } from 'i18next';

describe('format', () => {
  it('should accept parameters', () => {
    type FormatFunctionOptions = InterpolationOptions & Record<string, any>;

    expectTypeOf<FormatFunction>().parameter(0).toEqualTypeOf<any>();
    expectTypeOf<FormatFunction>().parameter(1).toEqualTypeOf<string | undefined>();
    expectTypeOf<FormatFunction>().parameter(2).toEqualTypeOf<string | undefined>();
    expectTypeOf<FormatFunction>().parameter(3).toEqualTypeOf<FormatFunctionOptions | undefined>();

    expectTypeOf<FormatFunction>().returns.toBeString();
  });

  it('should accept custom implementation', () => {
    assertType<FormatFunction>((value, _, lng, options) => {
      const passedOptions = options?.formatParams?.[options.interpolationkey] || {};

      // All keys should can be read from options without any error
      const randomParameter = options?.random;
      return passedOptions + randomParameter;
    });
  });
});
