import { assertType, describe, expectTypeOf, it } from 'vitest';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';

describe('<Trans />', () => {
  it('should work with string as `children`', () => {
    expectTypeOf(Trans).toBeCallableWith({ children: 'Foo' });
  });

  it('should work with HTMLNode as children', () => {
    expectTypeOf(Trans).toBeCallableWith({ children: <div /> });
  });

  describe('should work with `components`', () => {
    it('inline', () => {
      expectTypeOf(Trans).toBeCallableWith({
        components: [<div />],
        children: 'Foo',
      });
    });

    it('inline const variable', () => {
      const components = [<div />] as const;

      expectTypeOf(Trans).toBeCallableWith({
        components,
        children: 'Foo',
      });
    });

    it('JSX', () => {
      expectTypeOf(Trans).toBeCallableWith({
        components: {
          Btn: <button />,
        },
        defaults: 'Hello <Btn />',
      });
    });

    it('JSX.Element', () => {
      function MyComponent() {
        return <>world</>;
      }

      expectTypeOf(Trans).toBeCallableWith({
        components: {
          Btn: <MyComponent />,
        },
        defaults: 'Hello <Btn />',
      });
    });

    it('object with JSX.Element', () => {
      const components = {
        Btn: <button />,
      } as const;

      expectTypeOf(Trans).toBeCallableWith({
        components,
        defaults: 'Hello <Btn />',
      });
    });
  });

  it('should work with `count`', () => {
    expectTypeOf(Trans).toBeCallableWith({ count: 42, children: 'Foo' });
  });

  it('should work with `defaults`', () => {
    expectTypeOf(Trans).toBeCallableWith({ defaults: 'defaults', children: 'Foo' });
  });

  it('should work with `i18n`', () => {
    const { i18n } = useTranslation();
    expectTypeOf(Trans).toBeCallableWith({ i18n, children: 'Foo' });
  });

  it('should work with `i18nKey`', () => {
    expectTypeOf(Trans).toBeCallableWith({ i18nKey: 'i18nKey', children: 'Foo' });
  });

  it('should work with `ns`', () => {
    expectTypeOf(Trans).toBeCallableWith({ ns: 'ns', children: 'Foo' });
  });

  it('should work with `parent`', () => {
    expectTypeOf(Trans).toBeCallableWith({ parent: 'div', children: 'Foo' });

    // No parent(overrides the default one)
    expectTypeOf(Trans).toBeCallableWith({ parent: null, children: 'Foo' });

    // Use a custom component as parent
    const CustomRedComponent = (props: React.PropsWithChildren) => (
      <div style={{ color: 'red' }}>{props.children}</div>
    );
    expectTypeOf(Trans).toBeCallableWith({ parent: CustomRedComponent, children: 'Foo' });

    assertType<React.ReactElement>(
      <Trans parent="div" style={{ color: 'green' }}>
        Foo
      </Trans>,
    );

    /* div is the default parent */
    assertType<React.ReactElement>(<Trans style={{ color: 'green' }}>Foo</Trans>);
  });

  it('should work with `tOptions`', () => {
    expectTypeOf(Trans).toBeCallableWith({ tOptions: {}, children: 'Foo' });
  });

  it('should work with `values`', () => {
    expectTypeOf(Trans).toBeCallableWith({ values: {}, children: 'Foo' });
  });

  it('should work with `t`', () => {
    const { t } = useTranslation();
    expectTypeOf(Trans).toBeCallableWith({ t, children: 'Foo' });
  });

  it('should work with extra div`t`', () => {
    const { t } = useTranslation();
    expectTypeOf(Trans).toBeCallableWith({ t, children: 'Foo' });
  });

  it('should not work with object child', () => {
    assertType<React.ReactElement>(
      <Trans>
        {/* @ts-expect-error */}
        <span>This {{ var: '' }} is an error since `allowObjectInHTMLChildren` is disabled</span>
      </Trans>,
    );
  });
});
