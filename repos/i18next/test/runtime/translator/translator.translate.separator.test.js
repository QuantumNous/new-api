import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() separator usage', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore(
        {
          en: {
            translation: {
              test: 'test_en',
              deep: {
                test: 'testDeep_en',
              },
              'test::single': 'single_en',
              'test.single': 'single_en',
            },
            translation2: {
              test: 'test2_en',
            },
          },
        },
        {
          keySeparator: '::',
          nsSeparator: ':::',
        },
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
          keySeparator: '::',
          nsSeparator: ':::',
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
      { args: ['translation:::test'], expected: 'test_en' },
      { args: ['translation2:::test'], expected: 'test2_en' },
      { args: ['translation:::deep::test'], expected: 'testDeep_en' },
      { args: ['translation:test', { nsSeparator: ':', keySeparator: '.' }], expected: 'test_en' },
      {
        args: ['translation2:test', { nsSeparator: ':', keySeparator: '.' }],
        expected: 'test2_en',
      },
      {
        args: ['translation:deep.test', { nsSeparator: ':', keySeparator: '.' }],
        expected: 'testDeep_en',
      },
      { args: ['translation:::test::single', { keySeparator: false }], expected: 'single_en' },
      { args: ['translation:::test.single', { keySeparator: false }], expected: 'single_en' },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
