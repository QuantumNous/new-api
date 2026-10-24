import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() defaultValue', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {},
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
          pluralSeparator: '_',
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      { args: ['translation:test', { defaultValue: 'test_en' }], expected: 'test_en' },
      { args: ['translation:test', { defaultValue: 'test_en', count: 1 }], expected: 'test_en' },
      {
        args: [
          'translation:test',
          { defaultValue_other: 'test_en_plural', defaultValue_one: 'test_en', count: 10 },
        ],
        expected: 'test_en_plural',
      },
      {
        args: [
          'translation:testMe',
          {
            defaultValue_other: 'test_en_plural',
            defaultValue_one: 'test_en',
            defaultValue_zero: 'test_en_zero',
            count: 0,
          },
        ],
        expected: 'test_en_zero',
      },
      {
        args: [
          'translation:testArr',
          { defaultValue: ['some {{ value }}'], value: 'text', returnObjects: true },
        ],
        expected: ['some text'],
      },
      {
        args: [
          'translation:testObj',
          { defaultValue: { o: 'some {{ value }}' }, value: 'text', returnObjects: true },
        ],
        expected: { o: 'some text' },
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
