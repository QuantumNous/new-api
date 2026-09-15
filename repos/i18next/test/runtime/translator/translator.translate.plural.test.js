import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() with plural', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test_one: 'test_en',
            test_other: 'tests_en',
            pos_test_ordinal_one: 'pos_test_en_one',
            pos_test_ordinal_two: 'pos_test_en_two',
            pos_test_ordinal_few: 'pos_test_en_few',
            pos_test_ordinal_other: 'pos_test_en_other',
            oTest_ordinal_one: 'Every {{count}}st month',
            oTest_one: 'Every month',
            oTest_month_ordinal_one: 'Every {{count}}st month (ctx)',
            oTest_month_one: 'Every month (ctx)',
          },
          translationWithZero: {
            test_zero: 'test_zero',
            test_one: 'test_en',
            test_other: 'tests_en',
          },
        },
        de: {
          translation: {
            test_one: 'test_de',
            test_other: 'tests_de',
          },
        },
        ja: {
          translation: {
            test: 'test_ja',
            test_other: 'tests_ja',
          },
        },
        ar: {
          translation: {
            test: 'test_ar',
            test_few: 'tests_ar_few',
            test_many: 'tests_ar_many',
            test_one: 'tests_ar_one',
            test_two: 'tests_ar_two',
            test_zero: 'tests_ar_zero',
            test_other: 'tests_ar_other',
          },
        },
        it: {
          translation: {
            test: 'test_it',
            test_other: 'tests_it_other',
            test_many: 'tests_it_many', // ordinal
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
          pluralSeparator: '_',
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
      { args: ['translation:test', { count: 1 }], expected: 'test_en' },
      { args: ['translation:test', { count: 2 }], expected: 'tests_en' },
      { args: ['translation:test', { count: 0 }], expected: 'tests_en' },
      {
        args: ['translation:pos_test', { count: 0, ordinal: true }],
        expected: 'pos_test_en_other',
      },
      { args: ['translation:pos_test', { count: 1, ordinal: true }], expected: 'pos_test_en_one' },
      { args: ['translation:pos_test', { count: 2, ordinal: true }], expected: 'pos_test_en_two' },
      { args: ['translation:pos_test', { count: 3, ordinal: true }], expected: 'pos_test_en_few' },
      {
        args: ['translation:pos_test', { count: 4, ordinal: true }],
        expected: 'pos_test_en_other',
      },
      { args: ['translationWithZero:test', { count: 0 }], expected: 'test_zero' },
      { args: ['translation:test', { count: 1, lngs: ['en-US', 'en'] }], expected: 'test_en' },
      { args: ['translation:test', { count: 2, lngs: ['en-US', 'en'] }], expected: 'tests_en' },
      { args: ['translation:test', { count: 1, lngs: ['de'] }], expected: 'test_de' },
      { args: ['translation:test', { count: 2, lngs: ['de'] }], expected: 'tests_de' },
      { args: ['translation:test', { count: 1, lng: 'de' }], expected: 'test_de' },
      { args: ['translation:test', { count: 2, lng: 'de' }], expected: 'tests_de' },
      { args: ['translation:test', { count: 1, lng: 'fr' }], expected: 'test_en' },
      { args: ['translation:test', { count: 2, lng: 'fr' }], expected: 'tests_en' },
      { args: ['translation:test', { count: 1, lng: 'en-US' }], expected: 'test_en' },
      { args: ['translation:test', { count: 2, lng: 'en-US' }], expected: 'tests_en' },
      { args: ['translation:test', { count: 1, lng: 'ja' }], expected: 'tests_ja' },
      { args: ['translation:test', { count: 2, lng: 'ja' }], expected: 'tests_ja' },
      { args: ['translation:test', { count: 10, lng: 'ja' }], expected: 'tests_ja' },
      { args: ['translation:test', { count: 0, lng: 'ar' }], expected: 'tests_ar_zero' },
      { args: ['translation:test', { count: 1, lng: 'ar' }], expected: 'tests_ar_one' },
      { args: ['translation:test', { count: 2, lng: 'ar' }], expected: 'tests_ar_two' },
      { args: ['translation:test', { count: 3, lng: 'ar' }], expected: 'tests_ar_few' },
      { args: ['translation:test', { count: 15, lng: 'ar' }], expected: 'tests_ar_many' },
      { args: ['translation:test', { count: 101, lng: 'ar' }], expected: 'tests_ar_other' },
      {
        args: ['translation:test', { count: 0, lng: 'ar', ordinal: true }],
        expected: 'tests_ar_other', // fallback
      },
      {
        args: ['translation:test', { count: 1, lng: 'ar', ordinal: true }],
        expected: 'tests_ar_other', // fallback
      },
      {
        args: ['translation:test', { count: 2, lng: 'ar', ordinal: true }],
        expected: 'tests_ar_other', // fallback
      },
      {
        args: ['translation:test', { count: 3, lng: 'ar', ordinal: true }],
        expected: 'tests_ar_other', // fallback
      },
      {
        args: ['translation:test', { count: 15, lng: 'ar', ordinal: true }],
        expected: 'tests_ar_other', // fallback
      },
      { args: ['translation:test', { count: 0, lng: 'it' }], expected: 'tests_it_other' },
      { args: ['translation:test', { count: 1, lng: 'it' }], expected: 'test_it' },
      { args: ['translation:test', { count: 2, lng: 'it' }], expected: 'tests_it_other' },
      { args: ['translation:test', { count: 11, lng: 'it' }], expected: 'tests_it_other' },
      {
        args: ['translation:test', { count: 0, lng: 'it', ordinal: true }],
        expected: 'tests_it_other', // fallback
      },
      {
        args: ['translation:test', { count: 1, lng: 'it', ordinal: true }],
        expected: 'tests_it_other', // fallback
      },
      {
        args: ['translation:test', { count: 2, lng: 'it', ordinal: true }],
        expected: 'tests_it_other', // fallback
      },
      {
        args: ['translation:test', { count: 11, lng: 'it', ordinal: true }],
        expected: 'tests_it_many', // fallback
      },
      {
        args: ['translation:oTest', { count: 1, lng: 'en', ordinal: true }],
        expected: 'Every 1st month',
      },
      {
        args: ['translation:oTest', { count: 1, lng: 'en' }],
        expected: 'Every month',
      },
      {
        args: ['translation:oTest', { count: 1, lng: 'en', ordinal: true, context: 'month' }],
        expected: 'Every 1st month (ctx)',
      },
      {
        args: ['translation:oTest', { count: 1, lng: 'en', context: 'month' }],
        expected: 'Every month (ctx)',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
