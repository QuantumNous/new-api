import { describe, expectTypeOf, it } from 'vitest';
import * as React from 'react';
import { withSSR } from 'react-i18next';

describe('withSSR', () => {
  describe('class component', () => {
    it('without props', () => {
      class ClassComponent extends React.Component {
        render = () => null;
      }

      const ExtendedClass = withSSR()(ClassComponent);

      // <ExtendedClass initialLanguage={'en'} initialI18nStore={{ en: { namespace: { key: 'value' } } }} />;
      expectTypeOf(ExtendedClass).toBeCallableWith({
        initialLanguage: 'en',
        initialI18nStore: { en: { namespace: { key: 'value' } } },
      });
    });

    it('with props', () => {
      class ClassComponentWithProps extends React.Component<{ foo: number }> {
        render = () => null;
      }

      const ExtendedClassWithProps = withSSR()(ClassComponentWithProps);

      // <ExtendedClassWithProps
      //   initialLanguage={'en'}
      //   initialI18nStore={{ en: { namespace: { key: 'value' } } }}
      //   foo={1}
      // />;
      expectTypeOf(ExtendedClassWithProps).toBeCallableWith({
        initialLanguage: 'en',
        initialI18nStore: { en: { namespace: { key: 'value' } } },
        foo: 1,
      });
    });
  });

  describe('functional component', () => {
    it('without props', () => {
      const FunctionComponent: React.FunctionComponent = () => null;

      const ExtendedFn = withSSR()(FunctionComponent);

      // <ExtendedFn initialLanguage={'en'} initialI18nStore={{ en: { namespace: { key: 'value' } } }} />;
      expectTypeOf(ExtendedFn).toBeCallableWith({
        initialLanguage: 'en',
        initialI18nStore: { en: { namespace: { key: 'value' } } },
      });
    });

    it('with props', () => {
      const FunctionComponentWithProps: React.FunctionComponent<{ foo: string }> = () => null;

      const ExtendedFnWithProp = withSSR()(FunctionComponentWithProps);

      // <ExtendedFnWithProp
      //   initialLanguage={'en'}
      //   initialI18nStore={{ en: { namespace: { key: 'value' } } }}
      //   foo="bar"
      // />;
      expectTypeOf(ExtendedFnWithProp).toBeCallableWith({
        initialLanguage: 'en',
        initialI18nStore: { en: { namespace: { key: 'value' } } },
        foo: 'bar',
      });
    });
  });
});
