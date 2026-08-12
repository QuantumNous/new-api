import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate()', () => {
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

    describe('basic usage', () => {
      const tests = [
        { args: ['translation:test'], expected: 'test_en' },
        { args: ['translation:test', { lngs: ['en-US', 'en'] }], expected: 'test_en' },
        { args: ['translation:test', { lngs: ['de'] }], expected: 'test_de' },
        { args: ['translation:test', { lng: 'de' }], expected: 'test_de' },
        { args: ['translation:test', { lng: 'fr' }], expected: 'test_en' },
        { args: ['translation:test', { lng: 'en-US' }], expected: 'test_en' },
        { args: ['translation.test', { lng: 'en-US', nsSeparator: '.' }], expected: 'test_en' },
        {
          args: ['translation.deep.test', { lng: 'en-US', nsSeparator: '.' }],
          expected: 'deep_en',
        },
        { args: ['deep.test', { lng: 'en-US', nsSeparator: '.' }], expected: 'deep_en' },
      ];

      tests.forEach((test) => {
        it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
          expect(t.translate.apply(t, test.args)).toEqual(test.expected);
        });
      });
    });

    describe('with returnDetails option', () => {
      const tests = [
        {
          args: ['translation:test', { returnDetails: true }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['test', { returnDetails: true }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, lngs: ['en-US', 'en'] }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, lngs: ['de'] }],
          expected: {
            usedKey: 'test',
            res: 'test_de',
            exactUsedKey: 'test',
            usedLng: 'de',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, lng: 'de' }],
          expected: {
            usedKey: 'test',
            res: 'test_de',
            exactUsedKey: 'test',
            usedLng: 'de',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, lng: 'fr' }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, lng: 'en-US' }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation.test', { returnDetails: true, lng: 'en-US', nsSeparator: '.' }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation.deep.test', { returnDetails: true, lng: 'en-US', nsSeparator: '.' }],
          expected: {
            usedKey: 'deep.test',
            res: 'deep_en',
            exactUsedKey: 'deep.test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['deep.test', { returnDetails: true, lng: 'en-US', nsSeparator: '.' }],
          expected: {
            usedKey: 'deep.test',
            res: 'deep_en',
            exactUsedKey: 'deep.test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {},
          },
        },
        {
          args: ['translation:test', { returnDetails: true, testParam: 'test-param' }],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {
              testParam: 'test-param',
            },
          },
        },
        {
          args: [
            'translation:test',
            {
              returnDetails: true,
              replace: { testParam: 'test-param' },
            },
          ],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {
              testParam: 'test-param',
            },
          },
        },
        {
          args: [
            'translation:test',
            {
              defaultValue: 'default',
              ordinal: true,
              context: undefined,
              replace: { testParam: 'test-param' },
              lng: 'en',
              lngs: ['en', 'de'],
              fallbackLng: 'en',
              ns: ['translation', 'other'],
              keySeparator: '.',
              nsSeparator: ':',
              returnObjects: false,
              returnDetails: true,
              joinArrays: true,
              postProcess: false,
              interpolation: { escapeValue: false },
              count: 1,
            },
          ],
          expected: {
            usedKey: 'test',
            res: 'test_en',
            exactUsedKey: 'test',
            usedLng: 'en',
            usedNS: 'translation',
            usedParams: {
              testParam: 'test-param',
              count: 1,
            },
          },
        },
      ];

      tests.forEach((test) => {
        it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
          expect(t.translate.apply(t, test.args)).toEqual(test.expected);
        });
      });
    });
  });
});
