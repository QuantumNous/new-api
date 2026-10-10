import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() in cimode', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'test_en',
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
          interpolation: {
            interpolateResult: true,
            interpolateDefaultValue: true,
            interpolateKey: true,
          },
        },
      );
      t.changeLanguage('cimode');
    });

    const tests = [
      {
        args: [
          'translation:test',
          { appendNamespaceToCIMode: false, ns: 'translation', nsSeparator: ':' },
        ],
        expected: 'test',
      },
      {
        args: ['test', { appendNamespaceToCIMode: false, ns: 'translation', nsSeparator: ':' }],
        expected: 'test',
      },
      {
        args: [
          'translation:test',
          { appendNamespaceToCIMode: true, ns: 'translation', nsSeparator: ':' },
        ],
        expected: 'translation:test',
      },
      {
        args: ['test', { appendNamespaceToCIMode: true, ns: 'translation', nsSeparator: ':' }],
        expected: 'translation:test',
      },
    ];

    tests.forEach((test) => {
      it(`correctly return key for ${JSON.stringify(test.args)} args in cimode`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
