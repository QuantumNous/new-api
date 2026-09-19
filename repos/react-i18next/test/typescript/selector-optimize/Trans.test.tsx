import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';

describe('<Trans />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      <Trans i18nKey={($) => (expectTypeOf($.foo).toMatchTypeOf<'foo'>, $.foo)} />;
    });

    it(`raises a TypeError given a key that doesn't exist`, () => {
      // @ts-expect-error
      <Trans i18nKey={($) => $.Nope} />;
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      <Trans ns="custom" i18nKey={($) => (expectTypeOf($.foo).toEqualTypeOf<'foo'>, $.foo)} />;
    });

    it(`raises a TypeError given a namespace that doesn't exist`, () => {
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
        <Trans
          ns={['alternate', 'custom']}
          i18nKey={($) => (expectTypeOf($.baz).toEqualTypeOf<'baz'>(), $.baz)}
        />
        <Trans
          ns={['alternate', 'custom']}
          i18nKey={($) => (expectTypeOf($.alternate.baz).toEqualTypeOf<'baz'>(), $.baz)}
        />
        <Trans
          ns={['alternate', 'custom']}
          i18nKey={($) => (expectTypeOf($.custom.bar).toEqualTypeOf<'bar'>(), $.custom.bar)}
        />
        <Trans
          ns={['custom', 'alternate']}
          i18nKey={($) => (expectTypeOf($.alternate.baz).toEqualTypeOf<'baz'>(), $.alternate.baz)}
        />
        <Trans
          ns={['custom', 'alternate']}
          i18nKey={($) => (expectTypeOf($.bar).toEqualTypeOf<'bar'>(), $.bar)}
        />
        <Trans
          ns={['custom', 'alternate']}
          i18nKey={($) => (expectTypeOf($.custom.bar).toEqualTypeOf<'bar'>(), $.bar)}
        />
        <Trans
          ns={['custom', 'alternate']}
          i18nKey={($) => (
            expectTypeOf($.alternate.foobar.deep.deeper.deeeeeper).toEqualTypeOf<'foobar'>(),
            $.alternate.foobar.deep.deeper.deeeeeper
          )}
        />
      </>
    ));

    it(`raises a TypeError given a key that's not present inside any namespace`, () => {
      // @ts-expect-error
      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.bar} />;
      // @ts-expect-error
      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.custom.baz} />;
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');
      <Trans
        t={t}
        i18nKey={($) => (expectTypeOf($.foobar.barfoo).toEqualTypeOf<'barfoo'>(), $.foobar.barfoo)}
      />;
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });
      <Trans
        t={t}
        i18nKey={($) => (
          expectTypeOf($.deeper.deeeeeper).toEqualTypeOf<'foobar'>(),
          $.deeper.deeeeeper
        )}
      />;
    });

    it('raises a TypeError given a key-prefixed `t` function and an invalid key', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });
      // @ts-expect-error
      <Trans t={t} i18nKey={($) => $.xxx} />;
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

    it('should work with text and interpolation as children of an  HTMLElement', () => {
      expectTypeOf(Trans).toBeCallableWith({
        children: <span>foo {{ var: '' }}</span>,
      });
    });
  });
});
