import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';
import PostProcessor from '../../../src/postProcessor';

describe('Translator', () => {
  describe('translate() skip interpolation', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'test_en {{key}}',
            deep: {
              arr: ['deep_en arr {{key1}}', 'deep_en arr {{key2}}'],
            },
          },
        },
        de: {
          translation: {
            test: 'test_de {{key}}',
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
          keySeparator: '.',
          defaultNS: 'translation',
          ns: 'translation',
          interpolation: {},
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      { args: ['translation:test', { skipInterpolation: true }], expected: 'test_en {{key}}' },
      {
        args: ['translation:test', { skipInterpolation: false, key: 'value' }],
        expected: 'test_en value',
      },
      {
        args: ['translation:test', { lng: 'de', skipInterpolation: true }],
        expected: 'test_de {{key}}',
      },
      {
        args: ['translation:test', { lng: 'fr', skipInterpolation: true }],
        expected: 'test_en {{key}}',
      },
      {
        args: ['translation:deep', { returnObjects: true, skipInterpolation: true }],
        expected: { arr: ['deep_en arr {{key1}}', 'deep_en arr {{key2}}'] },
      },
      {
        args: [
          'translation:deep',
          { returnObjects: true, skipInterpolation: false, key1: 'value1', key2: 'value2' },
        ],
        expected: { arr: ['deep_en arr value1', 'deep_en arr value2'] },
      },
      {
        args: ['translation:deep.arr', { joinArrays: ' + ', skipInterpolation: true }],
        expected: 'deep_en arr {{key1}} + deep_en arr {{key2}}',
      },
      {
        args: [
          'translation:deep.arr',
          { joinArrays: ' + ', skipInterpolation: false, key1: '1', key2: '2' },
        ],
        expected: 'deep_en arr 1 + deep_en arr 2',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });

  describe('translate() skip interpolation should allow post process', () => {
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            test: 'test_en',
            simpleArr: ['simpleArr_en 1', 'simpleArr_en 2'],
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
          keySeparator: '.',
          defaultNS: 'translation',
          ns: 'translation',
          interpolation: {},
        },
      );
      PostProcessor.addPostProcessor({
        name: 'postProcessValue',
        process: (value) => `post processed: ${value}`,
      });
      t.changeLanguage('en');
    });

    const tests = [
      {
        args: ['translation:test', { skipInterpolation: true, postProcess: 'postProcessValue' }],
        expected: 'post processed: test_en',
      },
      {
        args: ['translation:test', { skipInterpolation: false, postProcess: 'postProcessValue' }],
        expected: 'post processed: test_en',
      },
      {
        args: [
          'translation:simpleArr',
          { returnObjects: true, skipInterpolation: true, postProcess: 'postProcessValue' },
        ],
        expected: ['post processed: simpleArr_en 1', 'post processed: simpleArr_en 2'],
      },
      {
        args: [
          'translation:simpleArr',
          { returnObjects: true, skipInterpolation: false, postProcess: 'postProcessValue' },
        ],
        expected: ['post processed: simpleArr_en 1', 'post processed: simpleArr_en 2'],
      },
      {
        args: [
          'translation:simpleArr',
          { joinArrays: ' + ', skipInterpolation: true, postProcess: 'postProcessValue' },
        ],
        expected: 'post processed: simpleArr_en 1 + simpleArr_en 2',
      },
      {
        args: [
          'translation:simpleArr',
          { joinArrays: ' + ', skipInterpolation: false, postProcess: 'postProcessValue' },
        ],
        expected: 'post processed: simpleArr_en 1 + simpleArr_en 2',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
