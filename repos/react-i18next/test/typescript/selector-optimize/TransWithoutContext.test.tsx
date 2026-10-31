import { describe, it, expectTypeOf, assertType } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trans } from '../../../TransWithoutContext';

describe('<Trans />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      <Trans i18nKey={($) => $.foo}>foo</Trans>;
    });

    it("raises a TypeError given a key that doesn't exist", () => {
      expectTypeOf<React.ComponentProps<typeof Trans>>()
        .toHaveProperty('i18nKey')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      <Trans ns="custom" i18nKey={($) => $.foo}></Trans>;
    });

    it("raises a TypeError given a namespace that doesn't exist", () => {
      expectTypeOf<React.ComponentProps<typeof Trans>>()
        .toHaveProperty('ns')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('array namespace', () => {
    it('should work with array namespace', () => (
      <>
        <Trans ns={['alternate', 'custom']} i18nKey={($) => $.baz} />
        <Trans ns={['alternate', 'custom']} i18nKey={($) => $.custom.bar} />
        <Trans ns={['alternate', 'custom']} i18nKey={($) => $.alternate.baz} />
        <Trans ns={['custom', 'alternate']} i18nKey={($) => $.bar} />
        <Trans ns={['custom', 'alternate']} i18nKey={($) => $.custom.bar} />
        <Trans ns={['custom', 'alternate']} i18nKey={($) => $.alternate.baz} />
      </>
    ));

    it('raises a TypeError given a key not present inside the current namespace', () => {
      // @ts-expect-error
      <Trans ns={['custom', 'alternate']} i18nKey={($) => $.baz} />;
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');

      <Trans t={t} i18nKey={($) => $.foobar.barfoo}>
        foo
      </Trans>;
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      <Trans t={t} i18nKey={($) => $.deeper.deeeeeper}>
        foo
      </Trans>;
    });

    it('raises a TypeError given a `t` function with key prefix when the key is invalid', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // @ts-expect-error
      <Trans t={t} i18nKey={($) => $.xxx}>
        foo
      </Trans>;
    });
  });

  describe('interpolation', () => {
    it('should work with text and interpolation', () => {
      expectTypeOf(Trans).toBeCallableWith({
        children: ['foo ', { var: '' }],
      });
    });

    it('should work with Interpolation in HTMLElement', () => {
      expectTypeOf(Trans).toBeCallableWith({
        children: (
          <>
            foo <strong>{{ var: '' }}</strong>
          </>
        ),
      });
    });

    it('should work with text and interpolation as children of an HTMLElement', () => {
      expectTypeOf(Trans).toBeCallableWith({
        children: <span>foo {{ var: '' }}</span>,
      });
    });
  });

  describe('usage with context', () => {
    it('should work with default namespace', () => {
      assertType<React.ReactElement>(<Trans i18nKey={($) => $.some} context="me" />);
    });

    it('should work with `ns` prop', () => {
      assertType<React.ReactElement>(<Trans ns="context" i18nKey={($) => $.beverage} />);
    });

    it('should work with default `t` function', () => {
      const { t } = useTranslation();

      assertType<React.ReactElement>(<Trans t={t} i18nKey={($) => $.some} context="me" />);
    });

    it('raises a TypeError given a default `t` function when context is invalid', () => {
      // @ts-expect-error should
      assertType<React.ReactElement>(<Trans t={t} i18nKey={($) => $.some} context="Test1222" />);
    });

    it('should work with custom `t` function', () => {
      const { t } = useTranslation('context');

      assertType<React.ReactElement>(<Trans t={t} i18nKey={($) => $.dessert_cake} />);
    });

    it('raises a TypeError given a custom `t` function when context is invalid', () => {
      // @ts-expect-error
      assertType<React.ReactElement>(<Trans t={t} i18nKey="dessert" context="sake" />);
    });
  });
});
