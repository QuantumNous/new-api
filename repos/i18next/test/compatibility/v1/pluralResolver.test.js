import { describe, it, expect, beforeAll } from 'vitest';

import { createInstance } from '../../../src/index';
import compatibilityLayer from '../v4/v4Compatibility';

describe('PluralResolver', () => {
  describe('getRule()', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next
        .use(compatibilityLayer)
        .use({ type: 'formatter', init: () => {}, format: (v) => v })
        .init({
          fallbackLng: 'en',
          compatibilityJSON: 'v3',
        });
      pr = i18next.services.pluralResolver;
    });

    it('correctly returns getRule for a supported locale', () => {
      const rule = pr.getRule('en');

      expect(rule.numbers).to.deep.equal([1, 2]);
      expect(rule.plurals).to.be.a('function');
    });

    it('correctly returns getRule for an unsupported locale', () => {
      expect(pr.getRule('non-existent')).toBeUndefined();
    });
  });

  describe('needsPlural()', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({
        fallbackLng: 'en',
        compatibilityJSON: 'v3',
      });
      pr = i18next.services.pluralResolver;
    });

    const tests = [
      { args: ['en'], expected: true },
      { args: ['fr'], expected: true },
      { args: ['ar'], expected: true },
      { args: ['ru'], expected: true },
      { args: ['ms'], expected: false },
      { args: ['lo'], expected: false },
      { args: ['su'], expected: false },
      { args: ['ach'], expected: true },
      { args: ['af'], expected: true },
      { args: ['ay'], expected: false },
      { args: ['be'], expected: true },
      { args: ['cs'], expected: true },
      { args: ['csb'], expected: true },
      { args: ['cy'], expected: true },
      { args: ['ga'], expected: true },
      { args: ['gd'], expected: true },
      { args: ['is'], expected: true },
      { args: ['jv'], expected: true },
      { args: ['kw'], expected: true },
      { args: ['lt'], expected: true },
      { args: ['lv'], expected: true },
      { args: ['mk'], expected: true },
      { args: ['mnk'], expected: true },
      { args: ['mt'], expected: true },
      { args: ['or'], expected: true },
      { args: ['ro'], expected: true },
      { args: ['sl'], expected: true },
      { args: ['he'], expected: true },
    ];

    tests.forEach((test) => {
      it(`correctly returns needsPlural for ${JSON.stringify(test.args)} args`, () => {
        expect(pr.needsPlural.apply(pr, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getSuffix()', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({
        fallbackLng: 'en',
        compatibilityJSON: 'v3',
        pluralSeparator: '',
      });
      pr = i18next.services.pluralResolver;
    });

    const tests = [
      { args: ['en', 0], expected: 'plural' },
      { args: ['en', 1], expected: '' },
      { args: ['en', 10], expected: 'plural' },
      { args: ['en', 10.5], expected: 'plural' },

      { args: ['fr', 0], expected: '' },
      { args: ['fr', 1], expected: '' },
      { args: ['fr', 10], expected: 'plural' },
      { args: ['fr', 10.5], expected: 'plural' },

      { args: ['pt', 0], expected: '' },
      { args: ['pt', 1], expected: '' },
      { args: ['pt', 10], expected: 'plural' },
      { args: ['pt', 10.5], expected: 'plural' },

      { args: ['pt-PT', 0], expected: 'plural' },
      { args: ['pt-PT', 1], expected: '' },
      { args: ['pt-PT', 10], expected: 'plural' },
      { args: ['pt-PT', 10.5], expected: 'plural' },

      { args: ['pt-BR', 0], expected: '' },
      { args: ['pt-BR', 1], expected: '' },
      { args: ['pt-BR', 10], expected: 'plural' },
      { args: ['pt-BR', 10.5], expected: 'plural' },

      { args: ['ach', 0], expected: '' },
      { args: ['ach', 1], expected: '' },
      { args: ['ach', 10], expected: 'plural' },
      { args: ['ach', 10.5], expected: 'plural' },

      // only singular
      { args: ['su', 0], expected: '0' },
      { args: ['su', 1], expected: '0' },
      { args: ['su', 10], expected: '0' },

      // ar
      { args: ['ar', 0], expected: '0' },
      { args: ['ar', 1], expected: '1' },
      { args: ['ar', 2], expected: '2' },
      { args: ['ar', 3], expected: '3' },
      { args: ['ar', 4], expected: '3' },
      { args: ['ar', 104], expected: '3' },
      { args: ['ar', 11], expected: '4' },
      { args: ['ar', 99], expected: '4' },
      { args: ['ar', 199], expected: '4' },
      { args: ['ar', 100], expected: '5' },

      // be
      { args: ['be', 0], expected: '2' },
      { args: ['be', 1], expected: '0' },
      { args: ['be', 5], expected: '2' },

      // sk
      { args: ['sk', 0], expected: '2' },
      { args: ['sk', 1], expected: '0' },
      { args: ['sk', 5], expected: '2' },

      // pl
      { args: ['pl', 0], expected: '2' },
      { args: ['pl', 1], expected: '0' },
      { args: ['pl', 5], expected: '2' },

      // cy
      { args: ['cy', 0], expected: '2' },
      { args: ['cy', 1], expected: '0' },
      { args: ['cy', 3], expected: '2' },
      { args: ['cy', 8], expected: '3' },

      // ga
      { args: ['ga', 1], expected: '0' },
      { args: ['ga', 2], expected: '1' },
      { args: ['ga', 3], expected: '2' },
      { args: ['ga', 7], expected: '3' },
      { args: ['ga', 11], expected: '4' },

      // gd
      { args: ['gd', 1], expected: '0' },
      { args: ['gd', 2], expected: '1' },
      { args: ['gd', 3], expected: '2' },
      { args: ['gd', 20], expected: '3' },

      // is
      { args: ['is', 1], expected: '' },
      { args: ['is', 2], expected: 'plural' },

      // jv
      { args: ['jv', 0], expected: '0' },
      { args: ['jv', 1], expected: '1' },

      // kw
      { args: ['kw', 1], expected: '0' },
      { args: ['kw', 2], expected: '1' },
      { args: ['kw', 3], expected: '2' },
      { args: ['kw', 4], expected: '3' },

      // lt
      { args: ['lt', 1], expected: '0' },
      { args: ['lt', 2], expected: '1' },
      { args: ['lt', 10], expected: '2' },

      // lv
      { args: ['lv', 1], expected: '0' },
      { args: ['lv', 2], expected: '1' },
      { args: ['lv', 0], expected: '2' },

      // mk
      { args: ['mk', 1], expected: '' },
      { args: ['mk', 2], expected: 'plural' },
      { args: ['mk', 0], expected: 'plural' },
      { args: ['mk', 11], expected: 'plural' },
      { args: ['mk', 21], expected: '' },
      { args: ['mk', 31], expected: '' },
      { args: ['mk', 311], expected: 'plural' },

      // mnk
      { args: ['mnk', 0], expected: '0' },
      { args: ['mnk', 1], expected: '1' },
      { args: ['mnk', 2], expected: '2' },

      // mt
      { args: ['mt', 1], expected: '0' },
      { args: ['mt', 2], expected: '1' },
      { args: ['mt', 11], expected: '2' },
      { args: ['mt', 20], expected: '3' },

      // or
      { args: ['or', 2], expected: '1' },
      { args: ['or', 1], expected: '0' },

      // ro
      { args: ['ro', 0], expected: '1' },
      { args: ['ro', 1], expected: '0' },
      { args: ['ro', 20], expected: '2' },

      // sl
      { args: ['sl', 5], expected: '0' },
      { args: ['sl', 1], expected: '1' },
      { args: ['sl', 2], expected: '2' },
      { args: ['sl', 3], expected: '3' },

      // he
      { args: ['he', 0], expected: '3' },
      { args: ['he', 0.5], expected: '3' },
      { args: ['he', 1], expected: '0' },
      { args: ['he', 2], expected: '1' },
      { args: ['he', 3], expected: '3' },
      { args: ['he', 20], expected: '2' },
      { args: ['he', 21], expected: '3' },
      { args: ['he', 30], expected: '2' },
      { args: ['he', 100], expected: '2' },
      { args: ['he', 101], expected: '3' },
    ];

    tests.forEach((test) => {
      it(`correctly returns suffix for ${JSON.stringify(test.args)} args`, () => {
        expect(pr.getSuffix.apply(pr, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getPluralFormsOfKey()', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({
        fallbackLng: 'en',
        pluralSeparator: '_',
        compatibilityJSON: 'v3',
      });
      pr = i18next.services.pluralResolver;
    });

    const tests = [
      { args: ['en', 'key'], expected: ['key', 'key_plural'] },
      { args: ['ar', 'key'], expected: ['key_0', 'key_1', 'key_2', 'key_3', 'key_4', 'key_5'] },
    ];

    tests.forEach((test) => {
      it(`correctly returns pluralforms of a given key for ${JSON.stringify(
        test.args,
      )} args`, () => {
        expect(pr.getPluralFormsOfKey.apply(pr, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getPluralFormsOfKey() with nonSimplifiedPluralSuffix', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({
        fallbackLng: 'en',
        simplifyPluralSuffix: false,
        pluralSeparator: '_',
        compatibilityJSON: 'v3',
      });
      pr = i18next.services.pluralResolver;
    });

    const tests = [
      { args: ['en', 'key'], expected: ['key_0', 'key_1'] },
      { args: ['ar', 'key'], expected: ['key_0', 'key_1', 'key_2', 'key_3', 'key_4', 'key_5'] },
    ];

    tests.forEach((test) => {
      it(`correctly returns pluralforms of a given key for ${JSON.stringify(
        test.args,
      )} args`, () => {
        expect(pr.getPluralFormsOfKey.apply(pr, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getSuffixes()', () => {
    let pr;

    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({
        fallbackLng: 'en',
        pluralSeparator: '_',
        compatibilityJSON: 'v3',
      });
      pr = i18next.services.pluralResolver;
    });

    const tests = [
      { args: [], expected: [] },
      { args: ['en'], expected: ['', '_plural'] },
      { args: ['ar'], expected: ['_0', '_1', '_2', '_3', '_4', '_5'] },
    ];

    tests.forEach((test) => {
      it(`correctly returns pluralforms of a given key for ${JSON.stringify(
        test.args,
      )} args`, () => {
        expect(pr.getSuffixes.apply(pr, test.args)).to.eql(test.expected);
      });
    });
  });
});
