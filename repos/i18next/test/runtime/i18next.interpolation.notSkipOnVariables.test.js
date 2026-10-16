import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next.js';

/** @type {import('i18next').i18n} */
const instance = i18next.createInstance();

describe('i18next.interpolation.nesting (skipOnVariables: false)', () => {
  beforeAll(async () => {
    await instance.init({
      lng: 'en',
      interpolation: {
        skipOnVariables: false,
      },
      resources: {
        en: {
          translation: {
            key: 'value {{a}}',
            key2: 'value {{a}} {{b}}',
            keyWithoutVar: 'value',
            nested: 'nested stuff',
            keyWithNest: '$t(nested2) value',
            keyWithNestAndVar: '$t(nested2) value {{a}}',
            nested2: 'HI',
          },
        },
      },
    });
  });

  describe('nesting', () => {
    const tests = [
      {
        args: ['keyWithoutVar'],
        expected: 'value',
      },
      {
        args: ['key', { a: 'hahaha' }],
        expected: 'value hahaha',
      },
      {
        args: ['keyWithNest'],
        expected: 'HI value',
      },
      {
        args: ['keyWithNestAndVar', { a: 'normal value' }],
        expected: 'HI value normal value',
      },
      {
        args: ['keyWithNestAndVar', { a: '$t(nested)' }],
        expected: 'HI value nested stuff',
      },
      {
        args: ['key', { a: '{{nested}}' }],
        expected: 'value ',
      },
      {
        args: ['key2', { a: '{{nested}}', b: 'something' }],
        expected: 'value  something',
      },
      {
        args: [
          '{{a}} {{w}} {{a}} {{other}}',
          { a: '{{b}}', b: 'c', w: 'normal', other: 'whatever' },
        ],
        expected: 'c normal c whatever',
      },
      {
        args: [
          '{{a}} {{w}} {{a}} {{other}}',
          { a: '     {{b}}', b: 'c', w: 'normal', other: 'whatever' },
        ],
        expected: '     c normal      c whatever',
      },
    ];

    tests.forEach((test) => {
      it(`correctly nests for ${JSON.stringify(test.args)} args`, () => {
        expect(instance.t.apply(instance, test.args)).to.eql(test.expected);
      });
    });
  });
});
