import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Trans } from '../../../TransWithoutContext';

describe('<Trans />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      // <Trans i18nKey="foo">foo</Trans>
      expectTypeOf(Trans).toBeCallableWith({
        i18nKey: 'foo',
      });
    });

    it('should trow if key do not exist', () => {
      expectTypeOf<React.ComponentProps<typeof Trans>>()
        .toHaveProperty('i18nKey')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      // <Trans ns="custom" i18nKey="foo">foo</Trans>
      expectTypeOf(Trans).toBeCallableWith({
        ns: 'custom',
        i18nKey: 'foo',
      });
    });

    it('should trow if namespace do not exist', () => {
      expectTypeOf<React.ComponentProps<typeof Trans>>()
        .toHaveProperty('ns')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('array namespace', () => {
    it('should work with array namespace', () => {
      // <Trans ns={['alternate', 'custom']} i18nKey={['alternate:baz', 'custom:bar']} />
      expectTypeOf(Trans).toBeCallableWith({
        ns: ['alternate', 'custom'],
        i18nKey: ['alternate:baz', 'custom:bar'],
      });
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');

      // <Trans t={t} i18nKey="foobar.barfoo">foo</Trans>
      expectTypeOf(Trans).toBeCallableWith({
        t,
        i18nKey: 'foobar.barfoo',
      });
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <Trans t={t} i18nKey="deeper.deeeeeper">foo</Trans>
      expectTypeOf<
        typeof Trans<'deeper.deeeeeper', 'alternate', {}, 'foobar.deep'>
      >().toBeCallableWith({
        t,
        i18nKey: 'deeper.deeeeeper',
      });
    });

    it('should throw error with `t` function with key prefix and wrong `i18nKey`', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <Trans t={t} i18nKey="xxx">foo</Trans>
      expectTypeOf<
        typeof Trans<'deeper.deeeeeper', 'alternate', {}, 'foobar.deep'>
      >().toBeCallableWith({
        t,
        // @ts-expect-error
        i18nKey: 'xxx',
      });
    });
  });

  describe('interpolation', () => {
    it('should work with text and interpolation', () => {
      expectTypeOf(Trans).toBeCallableWith({
        children: ['foo ', { var: '' }],
      });
    });
  });
});
