import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next.js';

const instance = i18next.createInstance();

describe('i18next.translation.formatting without escaping', () => {
  beforeAll(async () => {
    await instance.init({
      lng: 'en',
      interpolation: {
        escapeValue: false,
      },
      resources: {
        en: {
          translation: {
            intlDateTime: 'On the {{val, datetime}}',
          },
        },
      },
    });
  });

  describe('formatting', () => {
    const tests = [
      {
        args: ['intlDateTime', { val: new Date(Date.UTC(2012, 11, 20, 3, 0, 0)) }],
        expected: 'On the 12/20/2012',
      },
    ];

    tests.forEach((test) => {
      it(`correctly formats translations for ${JSON.stringify(test.args)}`, () => {
        expect(instance.t.apply(instance, test.args)).to.eql(test.expected);
      });
    });
  });
});
