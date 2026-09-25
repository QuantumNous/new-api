import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { Trans, useTranslation } from 'react-i18next';

describe('<Trans /> under enableSelector: "strict"', () => {
  describe('default namespace', () => {
    it('requires an explicit namespace prefix', () => {
      <Trans i18nKey={($) => (expectTypeOf($.custom.foo).toEqualTypeOf<'foo'>(), $.custom.foo)} />;
    });

    it(`raises a TypeError given a flat-primary path (no ns prefix)`, () => {
      // @ts-expect-error
      <Trans i18nKey={($) => $.foo} />;
    });

    it(`raises a TypeError given a key that doesn't exist`, () => {
      // @ts-expect-error
      <Trans i18nKey={($) => $.custom.Nope} />;
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      <Trans
        ns="custom"
        i18nKey={($) => (expectTypeOf($.custom.foo).toEqualTypeOf<'foo'>(), $.custom.foo)}
      />;
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
    it('always routes via an explicit namespace prefix', () => (
      <>
        <Trans
          ns={['alternate', 'custom']}
          i18nKey={($) => (expectTypeOf($.alternate.baz).toEqualTypeOf<'baz'>(), $.alternate.baz)}
        />
        <Trans
          ns={['alternate', 'custom']}
          i18nKey={($) => (expectTypeOf($.custom.bar).toEqualTypeOf<'bar'>(), $.custom.bar)}
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

    it(`raises a TypeError given a flat-primary path`, () => {
      // @ts-expect-error
      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.baz} />;
      // @ts-expect-error
      <Trans ns={['custom', 'alternate']} i18nKey={($) => $.bar} />;
    });

    it(`raises a TypeError given a key that's not present inside any namespace`, () => {
      // @ts-expect-error
      <Trans ns={['alternate', 'custom']} i18nKey={($) => $.custom.baz} />;
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');
      <Trans
        t={t}
        i18nKey={($) => (
          expectTypeOf($.alternate.foobar.barfoo).toEqualTypeOf<'barfoo'>(),
          $.alternate.foobar.barfoo
        )}
      />;
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
});
