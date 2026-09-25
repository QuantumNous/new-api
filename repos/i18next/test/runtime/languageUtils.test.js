import { describe, it, expect, beforeAll } from 'vitest';
import LanguageUtils from '../../src/LanguageUtils';

describe('LanguageUtils', () => {
  describe('toResolveHierarchy()', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en' });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['fr', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['de-CH'], expected: ['de-CH', 'de', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'nb', 'en'] },
      { args: ['zh-Hant-MO'], expected: ['zh-Hant-MO', 'zh-Hant', 'zh', 'en'] },
      { args: ['de-x-custom1'], expected: ['de-x-custom1', 'de', 'en'] },
      { args: ['de-DE-x-custom1'], expected: ['de-DE-x-custom1', 'de', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - extended fallback object', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: {
          de: ['de-CH', 'en'],
          'de-CH': ['fr', 'it', 'en'],
          'zh-Hans': ['zh-Hant', 'zh', 'en'],
          'zh-Hant': ['zh-Hans', 'zh', 'en'],
          ja: ['ja'],
          nb: ['no'],
          nn: ['no'],
          default: ['en'],
        },
      });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'de-CH', 'en'] },
      { args: ['de-CH'], expected: ['de-CH', 'de', 'fr', 'it', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'nb', 'no'] },
      { args: ['nn'], expected: ['nn', 'no'] },
      { args: ['zh-Hant-MO'], expected: ['zh-Hant-MO', 'zh-Hant', 'zh', 'zh-Hans', 'en'] },
      { args: ['fr'], expected: ['fr', 'en'] },
      { args: ['ja'], expected: ['ja'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - fallback function returns object', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: () => ({
          de: ['de-CH', 'en'],
          'de-CH': ['fr', 'it', 'en'],
          'zh-Hans': ['zh-Hant', 'zh', 'en'],
          'zh-Hant': ['zh-Hans', 'zh', 'en'],
          nb: ['no'],
          nn: ['no'],
          default: ['en'],
        }),
      });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'de-CH', 'en'] },
      { args: ['de-CH'], expected: ['de-CH', 'de', 'fr', 'it', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'nb', 'no'] },
      { args: ['nn'], expected: ['nn', 'no'] },
      { args: ['zh-Hant-MO'], expected: ['zh-Hant-MO', 'zh-Hant', 'zh', 'zh-Hans', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - fallback function returns string', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: () => 'en',
      });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['fr', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['de-CH'], expected: ['de-CH', 'de', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'nb', 'en'] },
      { args: ['zh-Hant-MO'], expected: ['zh-Hant-MO', 'zh-Hant', 'zh', 'en'] },
      { args: ['de-x-custom1'], expected: ['de-x-custom1', 'de', 'en'] },
      { args: ['de-DE-x-custom1'], expected: ['de-DE-x-custom1', 'de', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - fallback function returns array', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: () => ['de', 'en', 'zh'],
      });
    });

    const tests = [
      { args: ['en'], expected: ['en', 'de', 'zh'] },
      { args: ['de'], expected: ['de', 'en', 'zh'] },
      { args: ['de-AT'], expected: ['de-AT', 'de', 'en', 'zh'] },
      { args: ['zh-HK'], expected: ['zh-HK', 'zh', 'de', 'en'] },
      { args: ['zh-CN'], expected: ['zh-CN', 'zh', 'de', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - cleanCode Option', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en', cleanCode: true });
    });

    const tests = [
      { args: ['EN'], expected: ['en'] },
      { args: ['DE'], expected: ['de', 'en'] },
      { args: ['DE', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['FR', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['DE-CH'], expected: ['de-CH', 'de', 'en'] },
      { args: ['NB-NO'], expected: ['nb-NO', 'nb', 'en'] },
      { args: ['ZH-HANT-MO'], expected: ['zh-Hant-MO', 'zh-Hant', 'zh', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - lowerCaseLng Option', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en', lowerCaseLng: true });
    });

    const tests = [
      { args: ['EN'], expected: ['en'] },
      { args: ['DE'], expected: ['de', 'en'] },
      { args: ['DE', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['FR', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['DE-CH'], expected: ['de-ch', 'de', 'en'] },
      { args: ['nb-NO'], expected: ['nb-no', 'nb', 'en'] },
      { args: ['zh-Hant-MO'], expected: ['zh-hant-mo', 'zh-hant', 'zh', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - load Option: lngOnly', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en', load: 'languageOnly' });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['fr', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['de-CH'], expected: ['de', 'en'] },
      { args: ['nb-NO'], expected: ['nb', 'en'] },
      { args: ['zh-Hant-MO'], expected: ['zh', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - load Option: currentOnly', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en', load: 'currentOnly' });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de', 'fr'], expected: ['de', 'fr'] },
      { args: ['de', ['fr', 'en']], expected: ['de', 'fr', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de', 'fr'] },
      { args: ['de-CH'], expected: ['de-CH', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'en'] },
      { args: ['zh-Hant-MO'], expected: ['zh-Hant-MO', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - supportedLngs', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({ fallbackLng: 'en', supportedLngs: ['nb-NO', 'de', 'en'] });
      cu.logger.debug = false; // silence
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de', 'fr'], expected: ['de'] },
      { args: ['de', ['fr', 'en']], expected: ['de', 'en'] },
      { args: ['de', ['fr', 'de']], expected: ['de'] },
      { args: ['de-CH'], expected: ['de', 'en'] },
      { args: ['nb-NO'], expected: ['nb-NO', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('toResolveHierarchy() - non explicit supportedLngs ', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: ['en'],
        supportedLngs: ['de', 'en', 'zh'],
        nonExplicitSupportedLngs: true,
      });
    });

    const tests = [
      { args: ['en'], expected: ['en'] },
      { args: ['de'], expected: ['de', 'en'] },
      { args: ['de-AT'], expected: ['de-AT', 'de', 'en'] },
      { args: ['zh-HK'], expected: ['zh-HK', 'zh', 'en'] },
      { args: ['zh-CN'], expected: ['zh-CN', 'zh', 'en'] },
    ];

    tests.forEach((test) => {
      it(`correctly prepares resolver for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.toResolveHierarchy.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getBestMatchFromCodes()', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: ['en'],
        supportedLngs: ['en-US', 'en', 'de-DE', 'zh-Hans', 'zh-Hant'],
      });
    });

    const tests = [
      { args: [['en']], expected: 'en' },
      { args: [['ru', 'en']], expected: 'en' },
      { args: [['en-GB']], expected: 'en' },
      { args: [['ru', 'en-GB']], expected: 'en' },
      { args: [['de-CH']], expected: 'de-DE' },
      { args: [['ru']], expected: 'en' },
      { args: [['c']], expected: 'en' },
      { args: [['e']], expected: 'en' },
      { args: [['user-id']], expected: 'en' },
      { args: [['en-AU-SA']], expected: 'en' },
      { args: [[]], expected: 'en' },
      { args: [['zh-Hant-TW']], expected: 'zh-Hant' },
      { args: [['zh-Hans-TW']], expected: 'zh-Hans' },
    ];

    tests.forEach((test) => {
      it(`correctly get best match for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.getBestMatchFromCodes.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getBestMatchFromCodes() with dev', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: ['fr'],
        supportedLngs: ['dev', 'en', 'fr'],
      });
    });

    const tests = [
      { args: [['de']], expected: 'fr' },
      { args: [['ru', 'en']], expected: 'en' },
      { args: [['en-GB']], expected: 'en' },
      { args: [['ru', 'en-GB']], expected: 'en' },
      { args: [['de-CH']], expected: 'fr' },
      { args: [['ru']], expected: 'fr' },
      { args: [[]], expected: 'fr' },
    ];

    tests.forEach((test) => {
      it(`correctly get best match for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.getBestMatchFromCodes.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });

  describe('getBestMatchFromCodes() with dev and nonExplicitSupportedLngs: true', () => {
    /** @type {LanguageUtils} */
    let cu;
    beforeAll(() => {
      cu = new LanguageUtils({
        fallbackLng: ['fr'],
        supportedLngs: ['dev', 'en', 'fr'],
        nonExplicitSupportedLngs: true,
      });
    });

    const tests = [
      { args: [['de']], expected: 'fr' },
      { args: [['ru', 'en']], expected: 'en' },
      { args: [['en-GB']], expected: 'en-GB' },
      { args: [['ru', 'en-GB']], expected: 'en-GB' },
      { args: [['de-CH']], expected: 'fr' },
      { args: [['ru']], expected: 'fr' },
      { args: [[]], expected: 'fr' },
    ];

    tests.forEach((test) => {
      it(`correctly get best match for ${JSON.stringify(test.args)} args`, () => {
        expect(cu.getBestMatchFromCodes.apply(cu, test.args)).to.eql(test.expected);
      });
    });
  });
});
