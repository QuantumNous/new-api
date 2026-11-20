import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() with context', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'test_en',
            test_male: 'test_male_en',
            test_female: 'test_female_en',
            test_1: 'test_one_en',
          },
        },
        de: {
          translation: {
            test: 'test_de',
            test_male: 'test_male_de',
            test_female: 'test_female_de',
            test_1: 'test_one_de',
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
          contextSeparator: '_',
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
      { args: ['translation:test', { context: 'unknown' }], expected: 'test_en' },
      { args: ['translation:test', { context: 'male' }], expected: 'test_male_en' },
      { args: ['translation:test', { context: 'female' }], expected: 'test_female_en' },
      {
        args: ['translation:test', { context: 'male', lngs: ['en-US', 'en'] }],
        expected: 'test_male_en',
      },
      {
        args: ['translation:test', { context: 'female', lngs: ['en-US', 'en'] }],
        expected: 'test_female_en',
      },
      { args: ['translation:test', { context: 'male', lngs: ['de'] }], expected: 'test_male_de' },
      {
        args: ['translation:test', { context: 'female', lngs: ['de'] }],
        expected: 'test_female_de',
      },
      { args: ['translation:test', { context: 'male', lng: 'de' }], expected: 'test_male_de' },
      { args: ['translation:test', { context: 'female', lng: 'de' }], expected: 'test_female_de' },
      { args: ['translation:test', { context: 'male', lng: 'fr' }], expected: 'test_male_en' },
      { args: ['translation:test', { context: 'female', lng: 'fr' }], expected: 'test_female_en' },
      { args: ['translation:test', { context: 'male', lng: 'en-US' }], expected: 'test_male_en' },
      {
        args: ['translation:test', { context: 'female', lng: 'en-US' }],
        expected: 'test_female_en',
      },
      {
        args: ['translation:test', { context: '1', lng: 'en-US' }],
        expected: 'test_one_en',
      },
      {
        args: ['translation:test', { context: '1', lng: 'de' }],
        expected: 'test_one_de',
      },
      {
        args: ['translation:test', { context: 1, lng: 'en-US' }],
        expected: 'test_one_en',
      },
      {
        args: ['translation:test', { context: 1, lng: 'de' }],
        expected: 'test_one_de',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
