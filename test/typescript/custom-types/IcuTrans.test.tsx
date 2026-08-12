import { describe, it, expectTypeOf, assertType } from 'vitest';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { IcuTrans } from '../../..';

describe('<IcuTrans />', () => {
  describe('default namespace', () => {
    it('standard usage', () => {
      // <IcuTrans i18nKey="foo" defaultTranslation="foo" content={[]} />
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
      // <IcuTrans ns="custom" i18nKey="foo" defaultTranslation="foo" content={[]} />
      expectTypeOf(IcuTrans).toBeCallableWith({
        ns: 'custom',
        i18nKey: 'foo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw if namespace does not exist', () => {
      expectTypeOf<React.ComponentProps<typeof IcuTrans>>()
        .toHaveProperty('ns')
        .extract<'Nope'>()
        // @ts-expect-error
        .toMatchTypeOf<'Nope'>();
    });
  });

  describe('array namespace', () => {
    it('should work with array namespace', () => {
      // <IcuTrans ns={['alternate', 'custom']} i18nKey="alternate:baz" defaultTranslation="baz" content={[]} />
      expectTypeOf(IcuTrans).toBeCallableWith({
        ns: ['alternate', 'custom'],
        i18nKey: 'alternate:baz',
        defaultTranslation: 'baz',
        content: [],
      });
    });

    it('should throw error if key is not present inside namespaces', () => {
      // <IcuTrans ns={['alternate', 'custom']} i18nKey="custom:bar2" defaultTranslation="bar" content={[]} />
      expectTypeOf(IcuTrans).toBeCallableWith({
        ns: ['alternate', 'custom'],
        // @ts-expect-error
        i18nKey: 'custom:bar2',
        defaultTranslation: 'bar',
        content: [],
      });
    });
  });

  describe('usage with `t` function', () => {
    it('should work when providing `t` function', () => {
      const { t } = useTranslation('alternate');

      // <IcuTrans t={t} i18nKey="foobar.barfoo" defaultTranslation="foo" content={[]} />
      expectTypeOf(IcuTrans).toBeCallableWith({
        t,
        i18nKey: 'foobar.barfoo',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should work when providing `t` function with a prefix', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <IcuTrans t={t} i18nKey="deeper.deeeeeper" defaultTranslation="foo" content={[]} />
      expectTypeOf<
        typeof IcuTrans<'deeper.deeeeeper', 'alternate', 'foobar.deep'>
      >().toBeCallableWith({
        t,
        i18nKey: 'deeper.deeeeeper',
        defaultTranslation: 'foo',
        content: [],
      });
    });

    it('should throw error with `t` function with key prefix and wrong `i18nKey`', () => {
      const { t } = useTranslation('alternate', { keyPrefix: 'foobar.deep' });

      // <IcuTrans t={t} i18nKey="xxx" defaultTranslation="foo" content={[]} />
      expectTypeOf<
        typeof IcuTrans<'deeper.deeeeeper', 'alternate', 'foobar.deep'>
      >().toBeCallableWith({
        t,
        // @ts-expect-error
        i18nKey: 'xxx',
        defaultTranslation: 'foo',
        content: [],
      });
    });
  });

  describe('values and content props', () => {
    it('should work with values for ICU interpolation', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Hello {name}!',
        content: [],
        values: { name: 'World' },
      });
    });

    it('should work with component and values', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Hello <0>{name}</0>!',
        content: [{ type: 'strong', props: {} }],
        values: { name: 'World' },
      });
    });

    it('should work with nested content declarations', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: '<0><0>Item 1</0><1>Item 2</1></0>',
        content: [
          {
            type: 'ul',
            props: {
              children: [
                { type: 'li', props: {} },
                { type: 'li', props: {} },
              ],
            },
          },
        ],
      });
    });
  });

  describe('type safety with different namespaces', () => {
    it('should work with context namespace', () => {
      const { t } = useTranslation('context');

      assertType<React.ReactElement>(
        <IcuTrans t={t} i18nKey="dessert_cake" defaultTranslation="a nice cake" content={[]} />,
      );
    });

    it('should work with plurals namespace', () => {
      const { t } = useTranslation('plurals');
      assertType<React.ReactElement>(
        <IcuTrans ns="plurals" i18nKey="foo_one" defaultTranslation="foo" content={[]} />,
      );
    });

    it('should work with alternate namespace', () => {
      assertType<React.ReactElement>(
        <IcuTrans ns="alternate" i18nKey="baz" defaultTranslation="baz" content={[]} />,
      );
    });
  });
});
