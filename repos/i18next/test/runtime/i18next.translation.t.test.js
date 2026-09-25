import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next.js';

describe('i18next t default returns', () => {
  /** @type {import('i18next').i18n} */
  let i18n;
  beforeAll(() => {
    i18n = i18next.createInstance();
    i18n.init({
      fallbackLng: 'en',
      resources: {
        en: {
          translation: {
            key: 'normal',
            keyNull: null,
            keyEmpty: '',
          },
        },
      },
    });
  });

  it('it should not return null values by default', () => {
    expect(i18n.t('key')).to.equal('normal');
    expect(i18n.t('keyNull')).to.equal('keyNull');
    expect(i18n.t('keyEmpty')).to.equal('');
  });

  it('it should not return Object prototype stuff', () => {
    expect(i18n.t('constructor')).to.equal('constructor');
    expect(i18n.t('constructor_test')).to.equal('constructor_test');
    expect(i18n.t('hasOwnProperty')).to.equal('hasOwnProperty');
    expect(i18n.t('__defineGetter__')).to.equal('__defineGetter__');
    expect(i18n.t('__defineSetter__')).to.equal('__defineSetter__');
    expect(i18n.t('__lookupGetter__')).to.equal('__lookupGetter__');
    expect(i18n.t('__lookupSetter__')).to.equal('__lookupSetter__');
    expect(i18n.t('__proto__')).to.equal('__proto__');
  });

  it('it should not crash for undefined or null keys', () => {
    expect(i18n.t(null)).to.equal('');
    expect(i18n.t(undefined)).to.equal('');
    expect(i18n.t()).to.equal('');
  });

  describe('with selector fallback arrays', () => {
    /** @type {import('i18next').i18n} */
    let i18nSel;
    beforeAll(() => {
      i18nSel = i18next.createInstance();
      i18nSel.init({
        enableSelector: true,
        fallbackLng: 'en',
        resources: {
          en: {
            ns1: {
              greeting: 'hello',
              farewell: 'goodbye',
              deep: { nested: 'deep value' },
            },
            ns2: {
              fromNs2: 'from ns2',
            },
          },
        },
      });
    });

    it('resolves with the first selector when its key exists', () => {
      expect(i18nSel.t([($) => $.greeting, ($) => $.farewell], { ns: 'ns1' })).toEqual('hello');
    });

    it('falls back to the second selector when the first key is missing', () => {
      expect(i18nSel.t([($) => $.missing, ($) => $.farewell], { ns: 'ns1' })).toEqual('goodbye');
    });

    it('falls back through multiple missing keys to the last resolvable one', () => {
      expect(
        i18nSel.t([($) => $.missing1, ($) => $.missing2, ($) => $.greeting], { ns: 'ns1' }),
      ).toEqual('hello');
    });

    it('works with deeply nested selector keys', () => {
      expect(i18nSel.t([($) => $.missing, ($) => $.deep.nested], { ns: 'ns1' })).toEqual(
        'deep value',
      );
    });

    it('returns the key string when all selectors miss', () => {
      const result = i18nSel.t([($) => $.missing1, ($) => $.missing2], { ns: 'ns1' });
      // i18next returns the last key string when nothing resolves
      expect(result).toEqual('missing2');
    });

    it('works across namespaces when ns option is provided', () => {
      expect(i18nSel.t([($) => $.missing, ($) => $.fromNs2], { ns: 'ns2' })).toEqual('from ns2');
    });

    it('a single-element selector array behaves identically to the bare selector', () => {
      expect(i18nSel.t([($) => $.greeting], { ns: 'ns1' })).toEqual(
        i18nSel.t(($) => $.greeting, { ns: 'ns1' }),
      );
    });
  });

  describe('with custome separators', () => {
    /** @type {import('i18next').i18n} */
    let i18nSep;
    beforeAll(() => {
      i18nSep = i18next.createInstance();
      i18nSep.init({
        keySeparator: '::',
        nsSeparator: ':::',
        fallbackLng: 'en',
        resources: {
          en: {
            root: {
              foo: {
                bar: 'foobar',
              },
            },
          },
        },
      });
    });

    const tests = [
      { args: ['root:::foo::bar'], expected: 'foobar' },
      { args: ['foo::bar', { ns: 'root' }], expected: 'foobar' },
      { args: [($) => $.foo.bar, { ns: 'root' }], expected: 'foobar' },
      // Array of selectors: first key resolves, fallback never reached.
      { args: [[($) => $.foo.bar, ($) => $.foo.missing], { ns: 'root' }], expected: 'foobar' },
      // Array of selectors: first key missing, fallback resolves.
      { args: [[($) => $.foo.missing, ($) => $.foo.bar], { ns: 'root' }], expected: 'foobar' },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(i18nSep.t.apply(i18nSep, test.args)).toEqual(test.expected);
      });
    });
  });
});
