import { describe, expectTypeOf, it } from 'vitest';
import type { StreamableValue } from '.';

describe('StreamableValue type', () => {
  it('should yield a type error when assigning a wrong value', () => {
    expectTypeOf<StreamableValue<string>>().not.toEqualTypeOf<
      StreamableValue<boolean>
    >();

    expectTypeOf<StreamableValue<string>>().not.toEqualTypeOf<string>();

    expectTypeOf<
      StreamableValue<string>
    >().not.toEqualTypeOf<'THIS IS NOT A STREAMABLE VALUE'>();
  });
});
