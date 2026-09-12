import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() un/escape', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'text {{var}}',
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
            escapeValue: true,
          },
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      { args: ['translation:test', { var: 'a&b' }], expected: 'text a&amp;b' },
      {
        args: ['translation:test', { var: 'a&b', interpolation: { escapeValue: false } }],
        expected: 'text a&b',
      },
      { args: ['translation:test', { var: ['a', 'b'] }], expected: 'text a,b' },
      {
        args: [
          'translation:test',
          {
            var: ['a', 'b'],
            interpolation: { useRawValueToEscape: true, escape: (value) => value.join('-') },
          },
        ],
        expected: 'text a-b',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
