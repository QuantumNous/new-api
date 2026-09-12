import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() with arrays', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: ['test_en_1', 'test_en_2', '{{myVar}}'],
            flagList: [
              ['basic1', 'Basic1'],
              ['simple1', 'Simple1'],
            ],
            search: {
              flagList: [
                ['basic', 'Basic'],
                ['simple', 'Simple'],
              ],
            },
            keyArray_one: ['hello world {{count}}', 'hey {{count}}'],
            keyArray_other: ['hello world plural {{count}}', 'hey plural {{count}}'],
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
          returnObjects: true,
          ns: 'translation',
          defaultNS: 'translation',
          keySeparator: '.',
          interpolation: {
            // interpolateResult: true,
            // interpolateDefaultValue: true,
            // interpolateKey: true
          },
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      { args: ['translation:test.0'], expected: 'test_en_1' },
      { args: ['translation:test.2', { myVar: 'test' }], expected: 'test' },
      {
        args: ['translation:test', { myVar: 'test', joinArrays: '+' }],
        expected: 'test_en_1+test_en_2+test',
      },
      {
        args: ['translation:test', { myVar: 'test', joinArrays: '' }],
        expected: 'test_en_1test_en_2test',
      },
      {
        args: [['search.flagList', 'flagList'], {}],
        expected: [
          ['basic', 'Basic'],
          ['simple', 'Simple'],
        ],
      },
      {
        args: ['keyArray', { count: 1 }],
        expected: ['hello world 1', 'hey 1'],
      },
      {
        args: ['keyArray', { count: 100 }],
        expected: ['hello world plural 100', 'hey plural 100'],
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
