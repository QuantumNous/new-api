import { describe, expectTypeOf, it } from 'vitest';
import * as React from 'react';
import { Translation } from 'react-i18next';
import { TFunction, i18n } from 'i18next';

describe('<Translation />', () => {
  it('basic usage', () => {
    expectTypeOf(Translation).toBeCallableWith({
      children: (t) => t('key1'),
    });
  });

  it('should provide `ready` in children function', () => {
    // <Translation>
    //   {(t, { i18n, lng }, ready) => <div>{ready ? t('key1') : 'default'}</div>}
    // </Translation>
    type CmpProps = React.ComponentProps<typeof Translation>;
    expectTypeOf<CmpProps>().toHaveProperty('children').parameter(0).toMatchTypeOf<TFunction>();
    expectTypeOf<CmpProps>()
      .toHaveProperty('children')
      .parameter(1)
      .toEqualTypeOf<{ i18n: i18n; lng: string }>();
    expectTypeOf<CmpProps>().toHaveProperty('children').parameter(2).toBeBoolean();
  });

  describe('should accept `ns` prop', () => {
    it('as string', () => {
      expectTypeOf(Translation).toBeCallableWith({
        ns: 'foo',
        children: (t) => t('key1'),
      });
    });

    it('as array', () => {
      expectTypeOf(Translation).toBeCallableWith({
        ns: ['foo', 'bar'],
        children: (t) => t('key1'),
      });
    });
  });
});
