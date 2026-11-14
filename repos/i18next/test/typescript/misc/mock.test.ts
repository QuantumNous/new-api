import { describe, it, expectTypeOf } from 'vitest';
import { TFunction, WithT } from 'i18next';

describe('WithT', () => {
  it('should infer correct type', () => {
    expectTypeOf<WithT>().toHaveProperty('t').toEqualTypeOf<TFunction>();
  });
});
