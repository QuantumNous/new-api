import { describe, it, expect, beforeAll } from 'vitest';
import Translator from '../../../src/Translator';
import ResourceStore from '../../../src/ResourceStore.js';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import Interpolator from '../../../src/Interpolator';

describe('Translator', () => {
  describe('translate() with combined functionality', () => {
    /** @type {Translator} */
    let t;

    beforeAll(() => {
      const rs = new ResourceStore({
        en: {
          translation: {
            key1: 'hello world',
            key2: 'It is: $t(key1)',
            key3: 'It is: {{val}}',

            // context with pluralization
            test_one: 'test_en',
            test_other: 'tests_en',
            test_male_one: 'test_male_en',
            test_male_other: 'tests_male_en',

            nest: {
              foo: 'bar',
              nest: '$t(nestedArray)',
            },
            nestedArray: [
              { a: 'b', c: 'd' },
              { a: 'b', c: 'd' },
            ],

            friends:
              '$t(friend, {"context": "male", "count": {{maleCount}} }) & $t(friend, {"context": "female", "count": {{femaleCount}} })',
            friend_male_zero: 'No boyfriend',
            friend_male_one: 'A boyfriend',
            friend_male_other: '{{count}} boyfriends',
            friend_female_zero: 'no girlfriend',
            friend_female_one: 'a girlfriend',
            friend_female_other: '{{count}} girlfriends',

            message:
              'Something went wrong: $t(error_code.{{error_type}}, {"defaultValue": "Unknown error"})',
            error_code: {
              it_error: 'it went wrong',
            },
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
          contextSeparator: '_',
          keySeparator: '.',
          ns: 'translation',
          defaultNS: 'translation',
          interpolation: {},
          returnObjects: true,
        },
      );
      t.changeLanguage('en');
    });

    const tests = [
      // interpolation and nesting in var
      { args: ['key2'], expected: 'It is: hello world' },
      { args: ['key3', { val: '$t(key1)' }], expected: 'It is: hello world' },

      // disable nesting while interpolation
      { args: ['key3', { val: '$t(key1)', nest: false }], expected: 'It is: $t(key1)' },

      // context with pluralization
      { args: ['test', { context: 'unknown', count: 1 }], expected: 'test_en' },
      { args: ['test', { context: 'unknown', count: 2 }], expected: 'tests_en' },
      { args: ['test', { context: 'male', count: 1 }], expected: 'test_male_en' },
      { args: ['test', { context: 'male', count: 2 }], expected: 'tests_male_en' },
      {
        args: ['nest'],
        expected: {
          foo: 'bar',
          nest: [
            { a: 'b', c: 'd' },
            { a: 'b', c: 'd' },
          ],
        },
      },
      {
        args: ['friends', { maleCount: 0, femaleCount: 0 }],
        expected: 'No boyfriend & no girlfriend',
      },
      {
        args: ['friends', { maleCount: 0, femaleCount: 5 }],
        expected: 'No boyfriend & 5 girlfriends',
      },
      {
        args: ['friends', { maleCount: 5, femaleCount: 0 }],
        expected: '5 boyfriends & no girlfriend',
      },
      {
        args: ['friends', { maleCount: 1, femaleCount: 2 }],
        expected: 'A boyfriend & 2 girlfriends',
      },
      {
        args: ['friends', { maleCount: 2, femaleCount: 1 }],
        expected: '2 boyfriends & a girlfriend',
      },

      // interpolation and nesting on defaultValue
      {
        args: ['noKeyFoundTestingDefault_1', { defaultValue: '{{val}} bar', val: '$t(foo)' }],
        expected: 'foo bar',
      },

      {
        args: ['message', { error_type: 'it_error' }],
        expected: 'Something went wrong: it went wrong',
      },
      {
        args: ['message', { error_type: 'other_error' }],
        expected: 'Something went wrong: Unknown error',
      },
    ];

    tests.forEach((test) => {
      it(`correctly translates for ${JSON.stringify(test.args)} args`, () => {
        expect(t.translate.apply(t, test.args)).toEqual(test.expected);
      });
    });
  });
});
