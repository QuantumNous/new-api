import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next.js';

const instance = i18next.createInstance();

describe('i18next.translation.formatting', () => {
  beforeAll(
    () =>
      new Promise((resolve) => {
        instance.init(
          {
            lng: 'en',
            resources: {
              en: {
                translation: {
                  oneFormatterTest: 'The following text is uppercased: $t(key5, uppercase)',
                  anotherOneFormatterTest:
                    'The following text is underscored: $t(key6, underscore)',
                  twoFormattersTest:
                    'The following text is uppercased: $t(key5, uppercase). The following text is underscored: $t(key5, underscore)',
                  twoFormattersTogetherTest:
                    'The following text is uppercased, underscored, then uri component encoded: $t(key7, uppercase, underscore, encodeuricomponent)',
                  oneFormatterUsingAnotherFormatterTest:
                    'The following text is lowercased: $t(twoFormattersTogetherTest, lowercase)',
                  twoFormattersTogetherInterpolationTest:
                    'pre format {{value, uppercase, underscore}} after format',
                  oneFormatterUsingCurrencyTest:
                    'The following text is an amount: $t(key8, currency)',
                  missingTranslationTest:
                    'No text will be shown when the translation key is missing: $t(, uppercase)',
                  key5: 'Here is some text',
                  key6: 'Here is some text with numb3r5',
                  key7: 'Here is some: text? with, (punctuation)',
                  key8: '10000',
                  withSpace: ' there',
                  keyWithNesting: 'hi$t(withSpace)',
                  intlNumber: 'Some {{val, number}}',
                  intlNumberWithOptions: 'Some {{val, number(minimumFractionDigits: 2)}}',
                  intlNumberWithOptions2: '{{val,number(useGrouping:false)}}',
                  intlCurrencyWithOptions: 'The value is {{val, currency(currency: USD)}}',
                  intlCurrencyWithOptionsSimplified: 'The value is {{val, currency(USD)}}',
                  twoIntlCurrencyWithUniqueFormatOptions:
                    'The value is {{localValue, currency}} or {{altValue, currency}}',
                  intlDateTime: 'On the {{val, datetime}}',
                  intlRelativeTime: 'Lorem {{val, relativetime}}',
                  intlRelativeTimeWithOptions: 'Lorem {{val, relativetime(quarter)}}',
                  intlRelativeTimeWithOptionsExplicit:
                    'Lorem {{val, relativetime(range: quarter; style: short;)}}',
                  intlList: 'A list of {{val, list}}',
                  keyCustomFormatWithColon:
                    'Before {{date, customDate(format: EEEE d MMMM yyyy HH:mm; otherParam: 0)}}',
                  keyCustomCachedFormatWithColon:
                    'Before {{date, customDateCached(format: EEEE d MMMM yyyy HH:mm; otherParam: 0)}}',
                  customFormatWithSeparator: "Hello {{myVar, join(separator: ' | ')}}",
                  customFormatWithSeparatorComma: "Hello {{myVar, join(separator: ', ')}}",
                  customFormatWithSeparatorCommaNotFirst:
                    "Hello {{myVar, upper, join(separator: ', ')}}",
                  boy: 'Boy',
                  boy_other: 'Boys',
                  girl: 'Girl',
                  girl_other: 'Girls',
                  park: 'a {{name}} park',
                  park_other: '{{count}} {{name}} parks',
                  be: 'is',
                  be_other: 'are',
                  girlsAndBoysWithoutFormatTest:
                    'They have {{girls}} $t(girl, { "count": {{girls}} }) and {{boys}} $t(boy, { "count": {{boys}} })',
                  girlsAndBoysWithoutPluralTest:
                    'They have {{girls}} $t(girl, lowercase) and {{boys}} $t(boy, lowercase)',
                  girlsAndBoysFormatTest:
                    'They have {{girls}} $t(girl, { "count": {{girls}} }, lowercase) and {{boys}} $t(boy, { "count": {{boys}} }, lowercase)',
                  girlsAndBoysInTheParkFormatTest:
                    'There $t(be, { "count": {{girls}} }) {{girls}} $t(girl, { "count": {{girls}} }, lowercase) and {{boys}} $t(boy, { "count": {{boys}} }, lowercase) in $t(park, { "count": {{parkCount}}, "name": "{{parkName}}" }, title case, underscore)',
                },
              },
            },
          },
          () => {
            // add some custom formats used by legacy
            instance.services.formatter.add('uppercase', (value) => value.toUpperCase());
            instance.services.formatter.add('lowercase', (value) => value.toLowerCase());
            instance.services.formatter.add('title case', (value) =>
              value
                .split(' ')
                .map((word) => word[0].toUpperCase() + word.slice(1))
                .join(' '),
            );
            instance.services.formatter.add('underscore', (value) => value.replace(/\s+/g, '_'));
            instance.services.formatter.add('encodeuricomponent', (value) =>
              encodeURIComponent(value),
            );
            instance.services.formatter.add(
              'customDate',
              (_value, _lng, options) =>
                `customized date in format ${options.format} (and other param ${options.otherParam})`,
            );
            instance.services.formatter.addCached(
              'customDateCached',
              (lng, options) => (val) =>
                `customized cached ${lng} date in format ${options.format} (and other param ${
                  options.otherParam
                }) for ${val.getTime()}`,
            );
            instance.services.formatter.add('join', (value, lng, options) =>
              value.join(options.separator),
            );
            instance.services.formatter.add('upper', (value) =>
              value.map((item) => item.toUpperCase()),
            );
            resolve();
          },
        );
      }),
  );

  describe('formatting', () => {
    // some legacy tests
    let tests = [
      {
        args: ['oneFormatterTest'],
        expected: 'The following text is uppercased: HERE IS SOME TEXT',
      },
      {
        args: ['anotherOneFormatterTest'],
        expected: 'The following text is underscored: Here_is_some_text_with_numb3r5',
      },
      {
        args: ['twoFormattersTest'],
        expected:
          'The following text is uppercased: HERE IS SOME TEXT. The following text is underscored: Here_is_some_text',
      },
      {
        args: ['twoFormattersTogetherTest'],
        expected:
          'The following text is uppercased, underscored, then uri component encoded: HERE_IS_SOME%3A_TEXT%3F_WITH%2C_(PUNCTUATION)',
      },
      {
        args: ['oneFormatterUsingAnotherFormatterTest'],
        expected:
          'The following text is lowercased: the following text is uppercased, underscored, then uri component encoded: here_is_some%3a_text%3f_with%2c_(punctuation)',
      },
      {
        args: ['twoFormattersTogetherInterpolationTest', { value: 'my interpolated value' }],
        expected: 'pre format MY_INTERPOLATED_VALUE after format',
      },
      {
        args: ['missingTranslationTest'],
        expected: 'No text will be shown when the translation key is missing: ',
      },
      {
        args: ['keyWithNesting'],
        expected: 'hi there',
      },

      // number formatting
      {
        args: ['intlNumber', { val: 1000 }],
        expected: 'Some 1,000',
      },
      {
        args: ['intlNumber', { val: 1000.1, minimumFractionDigits: 3 }],
        expected: 'Some 1,000.100',
      },
      {
        args: ['intlNumberWithOptions', { val: 2000 }],
        expected: 'Some 2,000.00',
      },
      {
        args: ['intlNumberWithOptions', { val: 2000, minimumFractionDigits: 3 }],
        expected: 'Some 2,000.000',
      },
      {
        args: [
          'intlNumberWithOptions',
          { val: 2000, formatParams: { val: { minimumFractionDigits: 3 } } },
        ],
        expected: 'Some 2,000.000',
      },
      {
        args: ['intlNumberWithOptions2', { val: 123456 }],
        expected: '123456',
      },

      // currency
      {
        args: ['intlCurrencyWithOptions', { val: 2000 }],
        expected: 'The value is $2,000.00',
      },
      {
        args: ['intlCurrencyWithOptionsSimplified', { val: 2000 }],
        expected: 'The value is $2,000.00',
      },
      {
        args: [
          'twoIntlCurrencyWithUniqueFormatOptions',
          {
            localValue: 12345.67,
            altValue: 16543.21,
            formatParams: {
              localValue: { currency: 'USD', locale: 'en-US' },
              altValue: { currency: 'DKK', locale: 'da' },
            },
          },
        ],
        expected: 'The value is $12,345.67 or 16.543,21 kr.',
      },

      // datetime
      {
        args: ['intlDateTime', { val: new Date(Date.UTC(2012, 11, 20, 3, 0, 0)) }],
        expected: 'On the 12&#x2F;20&#x2F;2012', // &#x2F; = /
      },
      {
        args: [
          'intlDateTime',
          {
            val: new Date(Date.UTC(2012, 11, 20, 3, 0, 0)),
            formatParams: {
              val: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
            },
          },
        ],
        expected: 'On the Thursday, December 20, 2012',
      },

      // relativetime
      {
        args: ['intlRelativeTime', { val: 3 }],
        expected: 'Lorem in 3 days',
      },
      {
        args: ['intlRelativeTime', { val: -3 }],
        expected: 'Lorem 3 days ago',
      },
      {
        args: ['intlRelativeTimeWithOptions', { val: -3 }],
        expected: 'Lorem 3 quarters ago',
      },
      {
        args: ['intlRelativeTimeWithOptionsExplicit', { val: -3 }],
        expected: 'Lorem 3 qtrs. ago',
      },
      {
        args: ['intlRelativeTimeWithOptionsExplicit', { val: -3, style: 'long' }],
        expected: 'Lorem 3 quarters ago',
      },

      // list
      {
        args: ['intlList', { val: ['locize', 'i18next', 'awesome'] }],
        expected: 'A list of locize, i18next, and awesome',
      },

      // formatting + plural + interpolation
      {
        args: ['girlsAndBoysWithoutFormatTest', { girls: 1, boys: 2 }],
        expected: 'They have 1 Girl and 2 Boys',
      },
      {
        args: ['girlsAndBoysWithoutPluralTest', { girls: 1, boys: 2 }],
        expected: 'They have 1 girl and 2 boy',
      },
      {
        args: ['girlsAndBoysFormatTest', { girls: 1, boys: 2 }],
        expected: 'They have 1 girl and 2 boys',
      },
      {
        args: [
          'girlsAndBoysInTheParkFormatTest',
          { girls: 1, boys: 2, parkCount: 3, parkName: 'national' },
        ],
        expected: 'There is 1 girl and 2 boys in 3_National_Parks',
      },
    ];

    // custom
    tests = tests.concat([
      {
        args: ['keyCustomFormatWithColon', { date: new Date(Date.UTC(2022, 0, 4, 14, 33, 10)) }],
        expected: 'Before customized date in format EEEE d MMMM yyyy HH:mm (and other param 0)',
      },
      {
        args: [
          'keyCustomCachedFormatWithColon',
          { date: new Date(Date.UTC(2022, 0, 4, 14, 33, 10)) },
        ],
        expected:
          'Before customized cached en date in format EEEE d MMMM yyyy HH:mm (and other param 0) for 1641306790000',
      },
      {
        args: ['customFormatWithSeparator', { myVar: ['here', 'there'] }],
        expected: 'Hello here | there',
      },
      {
        args: ['customFormatWithSeparatorComma', { myVar: ['here', 'there'] }],
        expected: 'Hello here, there',
      },
      {
        args: ['customFormatWithSeparatorCommaNotFirst', { myVar: ['a', 'b'] }],
        expected: 'Hello A, B',
      },
    ]);

    tests.forEach((test) => {
      it(`correctly formats translations for ${JSON.stringify(test.args)}`, () => {
        expect(instance.t.apply(instance, test.args)).to.eql(test.expected);
      });
    });
  });
});
