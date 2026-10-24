import { describe, it, expect, beforeAll, beforeEach, afterEach, vitest } from 'vitest';
import PluralResolver from './lib/PluralResolver';
import { createInstance } from '../../../src/index';
import compatibilityLayer from './v4Compatibility';

describe('PluralResolver', () => {
  describe('getRule()', () => {
    /** @type {PluralResolver} */
    let pr;
    beforeAll(() => {
      const i18next = createInstance();
      i18next
        .use({ type: 'formatter', init: () => {}, format: (v) => v })
        .use(compatibilityLayer)
        .init({ fallbackLng: 'en' });
      pr = i18next.services.pluralResolver;
    });

    beforeEach(() => {
      pr.clearCache();
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    it('correctly returns getRule for a supported locale', () => {
      const expected = {
        resolvedOptions: () => {},
        select: () => {},
      };
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return expected;
      });

      const locale = 'en';

      expect(pr.getRule(locale)).toEqual(expected);
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });

    it('correctly returns getRule for an unsupported locale', () => {
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        throw Error('mock error');
      });

      const locale = 'en';

      expect(pr.getRule(locale)).toBeUndefined();
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });
  });

  describe('needsPlural()', () => {
    /** @type {PluralResolver} */
    let pr;
    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({ fallbackLng: 'en' });
      pr = i18next.services.pluralResolver;
    });

    beforeEach(() => {
      pr.clearCache();
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    it('correctly returns needsPlural for locale with more than one plural form', () => {
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return { resolvedOptions: () => ({ pluralCategories: ['one', 'other'] }) };
      });

      const locale = 'en';

      expect(pr.needsPlural(locale)).toBeTruthy();
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });

    it('correctly returns needsPlural for locale with just one plural form', () => {
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return { resolvedOptions: () => ({ pluralCategories: ['other'] }) };
      });

      const locale = 'ja';

      expect(pr.needsPlural(locale)).toBeFalsy();
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });
  });

  describe('getSuffix()', () => {
    /** @type {PluralResolver} */
    let pr;
    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({ fallbackLng: 'en', prepend: '_' });
      pr = i18next.services.pluralResolver;
    });

    beforeEach(() => {
      pr.clearCache();
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    it('correctly returns suffix for a supported locale', () => {
      const locale = 'en';
      const count = 10.5;
      const expected = 'other';

      const selectStub = vitest.fn().mockReturnValue(expected);
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return { select: selectStub };
      });

      expect(pr.getSuffix(locale, count)).to.equal(`_${expected}`);
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
      expect(selectStub).toHaveBeenCalledOnce();
      expect(selectStub).toHaveBeenCalledWith(count);
    });

    it('correctly returns suffix for an unsupported locale', () => {
      const locale = 'nonexistent';

      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        throw Error('mock error');
      });

      expect(pr.getSuffix(locale, 10.5)).toEqual('');
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });
  });

  describe('getPluralFormsOfKey()', () => {
    /** @type {PluralResolver} */
    let pr;
    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({ fallbackLng: 'en', prepend: '_' });
      pr = i18next.services.pluralResolver;
    });

    beforeEach(() => {
      pr.clearCache();
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    it('correctly returns plural forms for a given key', () => {
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return { resolvedOptions: () => ({ pluralCategories: ['one', 'other'] }) };
      });

      const locale = 'en';

      expect(pr.getPluralFormsOfKey(locale, 'key')).toStrictEqual(['key_one', 'key_other']);
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });
  });

  describe('getSuffixes()', () => {
    /** @type {PluralResolver} */
    let pr;
    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({ fallbackLng: 'en', prepend: '_' });
      pr = i18next.services.pluralResolver;
    });

    beforeEach(() => {
      pr.clearCache();
    });

    afterEach(() => {
      vitest.restoreAllMocks();
    });

    it('correctly returns plural suffixes for a given key', () => {
      vitest.spyOn(Intl, 'PluralRules').mockImplementation(function () {
        return {
          resolvedOptions: () => ({
            pluralCategories: ['zero', 'one', 'two', 'few', 'many', 'other'],
          }),
        };
      });

      const locale = 'en';

      expect(pr.getSuffixes(locale)).toStrictEqual([
        '_zero',
        '_one',
        '_two',
        '_few',
        '_many',
        '_other',
      ]);
      expect(Intl.PluralRules).toHaveBeenCalledOnce();
      expect(Intl.PluralRules).toHaveBeenCalledWith(
        locale,
        expect.objectContaining({ type: expect.any(String) }),
      );
    });
  });

  describe('shouldUseIntlApi()', () => {
    /** @type {LanguageUtils} */
    let lu;
    let logger;
    beforeAll(() => {
      const i18next = createInstance();
      i18next.use(compatibilityLayer).init({ fallbackLng: 'en' });
      lu = i18next.services.languageUtils;
      logger = i18next.services.logger;
    });

    const tests = [
      { compatibilityJSON: 'v1', expected: false },
      { compatibilityJSON: 'v2', expected: false },
      { compatibilityJSON: 'v3', expected: false },
      { compatibilityJSON: 'v4', expected: true },
      { expected: true },
    ];

    tests.forEach(({ compatibilityJSON, expected }) => {
      it(`correctly returns shouldUseIntlApi for compatibilityJSON set to ${compatibilityJSON}`, () => {
        const pr = new PluralResolver(lu, { compatibilityJSON }, logger);

        expect(pr.shouldUseIntlApi()).to.equal(expected);
      });
    });
  });
});
