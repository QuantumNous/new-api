import { describe, it, expectTypeOf } from 'vitest';
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

    it('should work with content declaration', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Welcome <0>friend</0>!',
        content: [{ type: 'strong', props: {} }],
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

  describe('values prop', () => {
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
  });

  describe('component types', () => {
    it('should work with string component type', () => {
      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Click <0>here</0>',
        content: [{ type: 'a', props: { href: '#' } }],
      });
    });

    it('should work with React component type', () => {
      const Link = ({ to, children }: { to: string; children: React.ReactNode }) => (
        <a href={to}>{children}</a>
      );

      expectTypeOf(IcuTrans).toBeCallableWith({
        i18nKey: 'foo',
        defaultTranslation: 'Click <0>here</0>',
        content: [{ type: Link, props: { to: '/path' } }],
      });
    });
  });
});
