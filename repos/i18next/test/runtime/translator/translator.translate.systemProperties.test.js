import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

// These tests originated from issues:
//
// https://github.com/i18next/i18next/issues/906
// https://github.com/i18next/i18next-xhr-backend/issues/258
//
// should ignore non-string properties when finding 'deep' translations
// (ex: `.length`, `.search`)
// when a fallback is needed to find the actual definition of that property

describe('Translator', () => {
  describe('translate()', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: {
              length: 'test_length',
              search: 'test_search',
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
      t.changeLanguage('de');
    });

    const tests = [
      { args: ['test', { lng: 'de', nsSeparator: '.' }], expected: 'test_de' },
      { args: ['test.length', { lng: 'de', nsSeparator: '.' }], expected: 'test_length' },
      { args: ['test.search', { lng: 'de', nsSeparator: '.' }], expected: 'test_search' },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
