import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction } from 'i18next';

describe('CustomTypeOptions.resources only (no registry)', () => {
  const t = (() => '') as TFunction<'legacy-only'>;

  it('types keys the way it did before ResourceNamespaceMap', () => {
    expectTypeOf(t('greeting')).toEqualTypeOf<'Hello from legacy-only'>();
  });
});
