import { describe, it, expectTypeOf } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { IcuTransWithoutContext } from '../../../';

describe('<IcuTransWithoutContext />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
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
      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
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

      expectTypeOf(IcuTransWithoutContext).toBeCallableWith({
        t,
        i18nKey: 'foobar.barfoo',
        defaultTranslation: 'foo',
        content: [],
      });
    });
  });
});
