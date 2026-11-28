import { describe, it, expect, vitest, beforeEach } from 'vitest';
import Interpolator from '../../../src/Interpolator';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import ResourceStore from '../../../src/ResourceStore.js';
import Translator from '../../../src/Translator';

const NB_PLURALS_ARABIC = 6;

const NB_PLURALS_ENGLISH_ORDINAL = 4;

describe('Translator', () => {
  /** @type {Translator} */
  let t;
  /** @type {import('i18next').Services} */
  let tServices;
  /** @type {unknown} */
  let missingKeyHandler;

  beforeEach(() => {
    const rs = new ResourceStore({
      en: {
        translation: {
          test: 'test_en',
          deep: {
            test: 'deep_en',
          },
        },
      },
      de: {
        translation: {
          test: 'test_de',
        },
      },
    });

    const lu = new LanguageUtils({ fallbackLng: 'en' });

    tServices = {
      resourceStore: rs,
      languageUtils: lu,
      pluralResolver: new PluralResolver(lu, { prepend: '_' }),
      interpolator: new Interpolator(),
    };

    missingKeyHandler = vitest.fn();
  });

  describe('translate() saveMissing', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('en');
    });

    it('correctly sends missing for "translation:test.missing"', () => {
      expect(t.translate('translation:test.missing')).toEqual('test.missing');
      expect(missingKeyHandler).toHaveBeenCalledWith(
        ['en'],
        'translation',
        'test.missing',
        'test.missing',
        false,
        expect.objectContaining({}),
      );
    });
  });

  describe('translate() with missing key and a custom parseMissingKeyHandler', () => {
    const calledParseMissingKeyHandler = [];
    const parseMissingKeyHandler = (key, defaultValue, options) => {
      calledParseMissingKeyHandler.push({
        key,
        defaultValue,
        options,
      });
      return defaultValue || key;
    };
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        parseMissingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('en');
    });

    it('correctly calls parseMissingKeyHandler for "translation:test.missing"', () => {
      expect(t.translate('translation:test.missing', { someV: 'hi there' })).toEqual(
        'test.missing',
      );
      expect(calledParseMissingKeyHandler).to.have.lengthOf(1);
      expect(calledParseMissingKeyHandler[0]).to.have.property('key', 'test.missing');
      expect(calledParseMissingKeyHandler[0]).to.have.property('defaultValue', undefined);
      expect(calledParseMissingKeyHandler[0]).to.have.property('options');
      expect(calledParseMissingKeyHandler[0].options).to.have.property('someV', 'hi there');
    });
  });

  describe('translate() saveMissing with saveMissingPlurals options', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        saveMissingPlurals: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('ar');
    });

    [
      { args: ['translation:test.missing', { count: 10 }], expected: NB_PLURALS_ARABIC },
      { args: ['translation:test.missing', { count: 0 }], expected: NB_PLURALS_ARABIC },
    ].forEach((test) => {
      it(`correctly sends missing for ${JSON.stringify(test.args)} args`, () => {
        t.translate.apply(t, test.args);
        expect(missingKeyHandler).toHaveBeenCalledTimes(test.expected);
        expect(missingKeyHandler).toHaveBeenNthCalledWith(
          1,
          ['ar'],
          'translation',
          'test.missing_zero',
          'test.missing',
          false,
          expect.objectContaining({}),
        );
      });
    });
  });

  describe('translate() saveMissing with saveMissingPlurals and defaults', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        saveMissingPlurals: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('ar');

      const tr = t.translate('translation:test.missing', {
        count: 0,
        defaultValue_zero: 'default0',
        defaultValue_one: 'default1',
      });
      expect(tr).toEqual('default0');
    });

    it('correctly sends missing resolved value', () => {
      expect(missingKeyHandler).toHaveBeenCalledTimes(NB_PLURALS_ARABIC);
      expect(missingKeyHandler).toHaveBeenNthCalledWith(
        1,
        ['ar'],
        'translation',
        'test.missing_zero',
        'default0',
        false,
        expect.objectContaining({}),
      );
      expect(missingKeyHandler).toHaveBeenNthCalledWith(
        2,
        ['ar'],
        'translation',
        'test.missing_one',
        'default1',
        false,
        expect.objectContaining({}),
      );
      expect(missingKeyHandler).toHaveBeenNthCalledWith(
        3,
        ['ar'],
        'translation',
        'test.missing_two',
        'default0',
        false,
        expect.objectContaining({}),
      );
    });
  });

  describe('translate() saveMissing with saveMissingPlurals options (ordinal)', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        saveMissingPlurals: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('en');
    });

    [
      {
        args: ['translation:test.missing', { count: 3, ordinal: true }],
        expected: NB_PLURALS_ENGLISH_ORDINAL,
      },
      {
        args: ['translation:test.missing', { count: 0, ordinal: true }],
        expected: NB_PLURALS_ENGLISH_ORDINAL,
      },
    ].forEach((test) => {
      it(`correctly sends missing for ${JSON.stringify(test.args)} args`, () => {
        t.translate.apply(t, test.args);
        expect(missingKeyHandler).toHaveBeenCalledTimes(test.expected);
        expect(missingKeyHandler).toHaveBeenNthCalledWith(
          1,
          ['en'],
          'translation',
          'test.missing_ordinal_one',
          'test.missing',
          false,
          expect.objectContaining({}),
        );
      });
    });
  });

  describe('translate() saveMissing with saveMissingPlurals and defaults (ordinal)', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        saveMissingPlurals: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('en');

      t.translate('translation:test.missing', {
        count: 0,
        ordinal: true,
        defaultValue_ordinal_one: 'default1',
        defaultValue_ordinal_other: 'defaultOther',
      });
    });

    it('correctly sends missing resolved value', () => {
      expect(missingKeyHandler).toHaveBeenCalledTimes(NB_PLURALS_ENGLISH_ORDINAL);
      expect(missingKeyHandler).toHaveBeenCalledWith(
        ['en'],
        'translation',
        'test.missing_ordinal_other',
        'defaultOther',
        false,
        expect.objectContaining({}),
      );
      expect(missingKeyHandler).toHaveBeenCalledWith(
        ['en'],
        'translation',
        'test.missing_ordinal_one',
        'default1',
        false,
        expect.objectContaining({}),
      );
      expect(missingKeyHandler).toHaveBeenCalledWith(
        ['en'],
        'translation',
        'test.missing_ordinal_two',
        'defaultOther',
        false,
        expect.objectContaining({}),
      );
    });
  });
});
