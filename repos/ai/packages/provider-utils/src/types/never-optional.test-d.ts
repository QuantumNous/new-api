import { describe, expectTypeOf, it } from 'vitest';
import type { NeverOptional } from './never-optional';

describe('NeverOptional', () => {
  type Properties = {
    required: string;
    optional?: number;
    readonly readonlyProperty: boolean;
  };

  it('preserves the original properties for known types', () => {
    expectTypeOf<
      NeverOptional<string, Properties>
    >().toEqualTypeOf<Properties>();
    expectTypeOf<
      NeverOptional<unknown, Properties>
    >().toEqualTypeOf<Properties>();
    expectTypeOf<
      NeverOptional<string | undefined, Properties>
    >().toEqualTypeOf<Properties>();
  });

  it('makes the properties optional when the condition type is any', () => {
    expectTypeOf<NeverOptional<any, Properties>>().toEqualTypeOf<
      Partial<Properties>
    >();

    expectTypeOf<NeverOptional<any, Properties>>().toMatchTypeOf<{
      required?: string;
      optional?: number;
      readonly readonlyProperty?: boolean;
    }>();
  });

  it('allows only undefined optional properties when the condition type is never', () => {
    expectTypeOf<NeverOptional<never, Properties>>().toEqualTypeOf<{
      required?: undefined;
      optional?: undefined;
      readonlyProperty?: undefined;
    }>();

    expectTypeOf<{}>().toMatchTypeOf<NeverOptional<never, Properties>>();
    expectTypeOf<{ required: undefined }>().toMatchTypeOf<
      NeverOptional<never, Properties>
    >();
    expectTypeOf<{ optional: undefined }>().toMatchTypeOf<
      NeverOptional<never, Properties>
    >();

    expectTypeOf<{ required: string }>().not.toMatchTypeOf<
      NeverOptional<never, Properties>
    >();
    expectTypeOf<{ optional: number }>().not.toMatchTypeOf<
      NeverOptional<never, Properties>
    >();
    expectTypeOf<{ readonlyProperty: boolean }>().not.toMatchTypeOf<
      NeverOptional<never, Properties>
    >();
  });
});
