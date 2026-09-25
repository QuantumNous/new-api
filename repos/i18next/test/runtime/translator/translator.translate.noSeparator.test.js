import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator.js';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils.js';
import PluralResolver from '../../../src/PluralResolver.js';
import Interpolator from '../../../src/Interpolator.js';

describe('Translator', () => {
  describe('translate() with separators set to false', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore(
        {
          en: {
            translation: {
              'test: with a sentence. or more text': 'test_en',
            },
          },
          de: {
            translation: {
              'test: with a sentence. or more text': 'test_de',
            },
          },
        },
        { keySeparator: false },
      );
      const lu = new LanguageUtils({ fallbackLng: 'en' });
      t = new Translator(
        {
          resourceStore: rs,
          languageUtils: lu,
          pluralResolver: new PluralResolver(lu, { prepend: '_' }),
          interpolator: new Interpolator(),
        },
        {
          ns: ['translation'],
          defaultNS: 'translation',
          nsSeparator: false,
          keySeparator: false,
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
      { args: ['test: with a sentence. or more text'], expected: 'test_en' },
      {
        args: ['test: with a sentence. or more text', { lngs: ['en-US', 'en'] }],
        expected: 'test_en',
      },
      { args: ['test: with a sentence. or more text', { lngs: ['de'] }], expected: 'test_de' },
      { args: ['test: with a sentence. or more text', { lng: 'de' }], expected: 'test_de' },
      { args: ['test: with a sentence. or more text', { lng: 'fr' }], expected: 'test_en' },
      { args: ['test: with a sentence. or more text', { lng: 'en-US' }], expected: 'test_en' },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
