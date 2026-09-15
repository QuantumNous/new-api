import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { IcuTransWithoutContext } from '../../../';

describe('<IcuTransWithoutContext />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      // <IcuTransWithoutContext i18nKey="foo" defaultTranslation="foo" content={[]} />
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw if key does not exist', () => {
      expectTypeOf<React.ComponentProps<typeof IcuTransWithoutContext>>()
        .toHaveProperty('i18nKey')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      // <IcuTransWithoutContext ns="custom" i18nKey="foo" defaultTranslation="foo" content={[]} />
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        ns: 'custom',
        i18nKey: 'foo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw if namespace does not exist', () => {
      expectTypeOf<React.ComponentProps<typeof IcuTransWithoutContext>>()
        .toHaveProperty('ns')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('array namespace', () => {
    it('should work with array namespace', () => {
      // <IcuTransWithoutContext ns={['alternate', 'custom']} i18nKey="alternate:baz" defaultTranslation="baz" content={[]} />
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        ns: ['alternate', 'custom'],
        i18nKey: 'alternate:baz',
        defaultTranslation: 'baz',
        content: [],
      });
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');

      // <IcuTransWithoutContext t={t} i18nKey="foobar.barfoo" defaultTranslation="foo" content={[]} />
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        t,
        i18nKey: 'foobar.barfoo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <IcuTransWithoutContext t={t} i18nKey="deeper.deeeeeper" defaultTranslation="foo" content={[]} />
      expectTypeOf<
        typeof IcuTransWithoutContext<'deeper.deeeeeper', 'alternate', 'foobar.deep'>
      >().toBeCallableWith({
        t,
        i18nKey: 'deeper.deeeeeper',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw error with `t` function with key prefix and wrong `i18nKey`', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <IcuTransWithoutContext t={t} i18nKey="xxx" defaultTranslation="foo" content={[]} />
      expectTypeOf<
        typeof IcuTransWithoutContext<'deeper.deeeeeper', 'alternate', 'foobar.deep'>
      >().toBeCallableWith({
        t,
        // @ts-expect-error
        i18nKey: 'xxx',
        defaultTranslation: 'foo',
        content: [],
      });
    });
  });

  describe('values prop', () => {
    it('should work with values for ICU interpolation', () => {
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Hello {name}!',
        content: [],
        values: { name: 'World' },
      });
    });
  });
});
