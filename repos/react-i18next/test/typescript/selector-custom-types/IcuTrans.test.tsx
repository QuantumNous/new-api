import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { IcuTrans } from '../../..';

describe('<IcuTrans />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw if key does not exist', () => {
      expectTypeOf<React.ComponentProps<typeof IcuTrans>>()
        .toHaveProperty('i18nKey')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('named namespace', () => {
    it('standard usage', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        ns: 'custom',
        i18nKey: 'foo',
        defaultTranslation: 'foo',
        content: [],
      });
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');

      expectTypeOf(IcuTrans).toBeCallableWith({
        t,
        i18nKey: 'foobar.barfoo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      expectTypeOf<
        typeof IcuTrans<'deeper.deeeeeper', 'alternate', 'foobar.deep'>
      >().toBeCallableWith({
        t,
        i18nKey: 'deeper.deeeeeper',
        defaultTranslation: 'foo',
        content: [],
      });
    });
  });

  describe('values and content', () => {
    it('should work with values', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Hello {name}!',
        content: [],
        values: { name: 'World' },
      });
    });

    it('should work with content declaration', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Welcome <0>friend</0>!',
        content: [{ type: 'strong', props: {} }],
      });
    });
  });
});
