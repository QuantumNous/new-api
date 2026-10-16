import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('exists()', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'test_en',
            deep: {
              test: 'deep_en',
            },
          },
        },
        de: {
          translation: {
            test: 'test_de',
          },
        },
      });
      const lu = new LanguageUtils({ fallbackLng: 'en' });
      t = new Translator(
        {
          resourceStore: rs,
          languageUtils: lu,
          pluralResolver: new PluralResolver(lu, { prepend: '_' }),
          interpolator: new Interpolator(),
        },
        {
          defaultNS: 'translation',
          ns: 'translation',
          interpolation: {
            interpolateResult: true,
            interpolateDefaultValue: true,
            interpolateKey: true,
          },
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      { args: ['translation:test'], expected: true },
      { args: ['translation:test', { lngs: ['en-US', 'en'] }], expected: true },
      { args: ['translation:test', { lngs: ['de'] }], expected: true },
      { args: ['translation:test', { lng: 'de' }], expected: true },
      { args: ['translation:test', { lng: 'fr' }], expected: true },
      { args: ['translation:test', { lng: 'en-US' }], expected: true },
      { args: ['translation.test', { lng: 'en-US', nsSeparator: '.' }], expected: true },
      { args: ['translation.deep.test', { lng: 'en-US', nsSeparator: '.' }], expected: true },
      { args: ['deep.test', { lng: 'en-US', nsSeparator: '.' }], expected: true },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.exists.apply(t, test.args)).toEqual(test.expected);
      });
    });

    const nullishArgs = ['', undefined, null];

    nullishArgs.forEach((nullishArg) => {
      it(`should return false if a "${nullishArg}" key is passed as an argument`, () => {
        expect(t.exists(nullishArg)).toBeFalsy();
      });
    });

    it('it should not crash for undefined or null keys', () => {
      expect(t.exists(null)).to.equal(false);
      expect(t.exists(undefined)).to.equal(false);
      expect(t.exists()).to.equal(false);
    });

    it('should return false for object keys when returnObjects is false, true otherwise', () => {
      expect(t.exists('deep', { returnObjects: false })).toBe(false);
      expect(t.exists('deep', { returnObjects: true })).toBe(true);
    });

    it('should return true for string keys regardless of returnObjects option', () => {
      expect(t.exists('test', { returnObjects: false })).toBe(true);
      expect(t.exists('test', { returnObjects: true })).toBe(true);
    });

    it('should handle object keys correctly with returnObjects option', () => {
      expect(t.exists('deep', { returnObjects: false })).toBe(false);
      expect(t.exists('deep', { returnObjects: true })).toBe(true);
    });

    it('should handle returnObjects option with nested keys', () => {
      // Test with namespace separator - object key
      expect(t.exists('translation:deep', { returnObjects: false })).toBe(false);
      expect(t.exists('translation:deep', { returnObjects: true })).toBe(true);

      // Test with key separator for nested string
      expect(t.exists('deep.test', { returnObjects: false })).toBe(true);
      expect(t.exists('deep.test', { returnObjects: true })).toBe(true);
    });

    it('should demonstrate object detection pattern with returnObjects comparison', () => {
      // Helper function to detect if key points to object (proposed feature)
      const isObjectKey = (key, options = {}) => {
        const withFalse = t.exists(key, { ...options, returnObjects: false });
        const withTrue = t.exists(key, { ...options, returnObjects: true });
        return withFalse !== withTrue;
      };

      expect(isObjectKey('deep')).toBe(true); // object key
    });
  });
});
