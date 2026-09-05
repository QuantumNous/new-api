import { assertType, describe, expectTypeOf, it } from 'vitest';
import * as React from 'react';
import { withTranslation, WithTranslation } from 'react-i18next';
import { TFunction, i18n } from 'i18next';

describe('withTranslation', () => {
  it('WithTranslation expose all information', () => {
    expectTypeOf<WithTranslation>().toEqualTypeOf<{
      t: TFunction;
      i18n: i18n;
      tReady: boolean;
    }>();
  });

  interface MyComponentProps extends WithTranslation {
    bar?: 'baz';
  }
  const MyComponent = (props: MyComponentProps): React.JSX.Element => {
    return <h2>something {props.tReady}</h2>;
  };

  it('default usage', () => {
    const ExtendedComponent = withTranslation()(MyComponent);
    // <ExtendedComponent />
    expectTypeOf(ExtendedComponent).toBeCallableWith({});
    // <ExtendedComponent bar="baz" />
    expectTypeOf(ExtendedComponent).toBeCallableWith({
      bar: 'baz',
    });
  });

  /**
   * @see https://react.i18next.com/latest/withtranslation-hoc#withtranslation-params
   */
  describe('with namespace', () => {
    it('string', () => {
      const ExtendedComponent = withTranslation('ns')(MyComponent);

      // <ExtendedComponent />
      expectTypeOf(ExtendedComponent).toBeCallableWith({});
      // <ExtendedComponent bar="baz" />
      expectTypeOf(ExtendedComponent).toBeCallableWith({
        bar: 'baz',
      });
    });

    it('array', () => {
      const ExtendedComponent = withTranslation(['ns', 'ns2'])(MyComponent);

      // <ExtendedComponent />
      expectTypeOf(ExtendedComponent).toBeCallableWith({});
      // <ExtendedComponent bar="baz" />
      expectTypeOf(ExtendedComponent).toBeCallableWith({
        bar: 'baz',
      });
    });
  });

  /**
   * @see https://react.i18next.com/latest/withtranslation-hoc#overriding-the-i-18-next-instance
   */
  it('should work with i18n override', () => {
    const ExtendedComponent = withTranslation('ns')(MyComponent);
    expectTypeOf<React.ComponentProps<typeof ExtendedComponent>>()
      .toHaveProperty('i18n')
      .exclude<undefined>()
      .toEqualTypeOf<i18n>();
  });

  /**
   * @see https://react.i18next.com/latest/withtranslation-hoc#not-using-suspense
   */
  it('should work with `useSuspense`', () => {
    const ExtendedComponent = withTranslation('ns')(MyComponent);
    expectTypeOf<React.ComponentProps<typeof ExtendedComponent>>()
      .toHaveProperty('useSuspense')
      .exclude<undefined>()
      .toEqualTypeOf<boolean>();
  });

  it('should work with namespace and `keyPrefix`', () => {
    interface KeyPrefixComponentProps extends WithTranslation<'translation', 'deepPath'> {
      bar?: 'baz';
    }
    const KeyPrefixComponent = (props: KeyPrefixComponentProps) => {
      return <h2>{props.t('deepKey1')}</h2>;
    };

    const ExtendedComponent = withTranslation('translation', { keyPrefix: 'deepPath' })(
      KeyPrefixComponent,
    );

    expectTypeOf(ExtendedComponent).toBeCallableWith({
      bar: 'baz',
    });
  });
});
