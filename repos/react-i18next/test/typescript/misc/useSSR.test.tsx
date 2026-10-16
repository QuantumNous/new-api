import { it, expectTypeOf } from 'vitest';
import { useSSR } from 'react-i18next';
import { Resource } from 'i18next';

it('useSSR', () => {
  expectTypeOf(useSSR).parameter(0).toEqualTypeOf<Resource>();
  expectTypeOf(useSSR).parameter(1).toEqualTypeOf<string>();

  expectTypeOf(useSSR).returns.toBeVoid();
});
