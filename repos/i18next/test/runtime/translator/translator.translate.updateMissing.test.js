import { describe, it, expect, vitest, beforeEach } from 'vitest';
import Interpolator from '../../../src/Interpolator';
import LanguageUtils from '../../../src/LanguageUtils';
import PluralResolver from '../../../src/PluralResolver';
import ResourceStore from '../../../src/ResourceStore.js';
import Translator from '../../../src/Translator';

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

  describe('translate() using updateMissing', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        updateMissing: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });

      t.changeLanguage('en');
    });

    describe('without default value', () => {
      it('does not invoke missingKeyHandler', () => {
        expect(t.translate('translation:test')).toEqual('test_en');
        expect(missingKeyHandler).not.toHaveBeenCalled();
      });
    });

    describe('with an unchanged default value', () => {
      it('does not invoke missingKeyHandler', () => {
        expect(t.translate('translation:test', { defaultValue: 'test_en' })).toEqual('test_en');
        expect(missingKeyHandler).not.toHaveBeenCalled();
      });
    });

    describe('with a new default value', () => {
      it('correctly sends missing', () => {
        expect(t.translate('translation:test', { defaultValue: 'new value' })).toEqual('test_en');
        expect(missingKeyHandler).toHaveBeenCalledOnce();
        expect(missingKeyHandler).toHaveBeenCalledWith(
          ['en'],
          'translation',
          'test',
          'new value',
          true,
          expect.objectContaining({
            defaultValue: expect.any(String),
            lng: expect.any(String),
          }),
        );
      });
    });
  });

  describe('translate() using updateMissing with saveMissingPlurals', () => {
    beforeEach(() => {
      t = new Translator(tServices, {
        defaultNS: 'translation',
        ns: 'translation',
        saveMissing: true,
        saveMissingPlurals: true,
        updateMissing: true,
        missingKeyHandler,
        interpolation: {
          interpolateResult: true,
          interpolateDefaultValue: true,
          interpolateKey: true,
        },
      });
      t.changeLanguage('en');
    });

    describe('without a count option', () => {
      it('only sends one missing key', () => {
        expect(
          t.translate('translation:test', {
            defaultValue: 'new value',
            defaultValue_plural: 'new values',
          }),
        ).toEqual('test_en');
        expect(missingKeyHandler).toHaveBeenCalledOnce();
        expect(missingKeyHandler).toHaveBeenCalledWith(
          ['en'],
          'translation',
          'test',
          'new value',
          true,
          expect.objectContaining({
            defaultValue: expect.any(String),
            lng: expect.any(String),
          }),
        );
      });
    });

    describe('with a non-numeric count option', () => {
      it('only sends one missing key', () => {
        expect(
          t.translate('translation:test', {
            count: 'foo',
            defaultValue: 'new value',
            defaultValue_plural: 'new values',
          }),
        ).toEqual('test_en');
        expect(missingKeyHandler).toHaveBeenCalledOnce();
      });
    });

    describe('without a default plural value', () => {
      [1, 2].forEach((count) => {
        it(`count=${count}: sends falls back on singular default value`, () => {
          expect(
            t.translate('translation:test', {
              count,
              defaultValue: 'new value',
            }),
          ).toEqual('test_en');
          expect(missingKeyHandler).toHaveBeenCalledTimes(2);
          expect(missingKeyHandler).toHaveBeenNthCalledWith(
            1,
            ['en'],
            'translation',
            'test_one',
            'new value',
            true,
            expect.objectContaining({
              defaultValue: expect.any(String),
              lng: expect.any(String),
            }),
          );
          expect(missingKeyHandler).toHaveBeenNthCalledWith(
            2,
            ['en'],
            'translation',
            'test_other',
            'new value',
            true,
            expect.objectContaining({
              defaultValue: expect.any(String),
              lng: expect.any(String),
            }),
          );
        });
      });
    });

    describe('with a numeric count option', () => {
      it('sends correct missing keys per default plural values', () => {
        expect(
          t.translate('translation:test', {
            count: 1,
            defaultValue_one: 'new value',
            defaultValue_other: 'new values',
          }),
        ).toEqual('test_en');
        expect(missingKeyHandler).toHaveBeenCalledTimes(2);
        expect(missingKeyHandler).toHaveBeenNthCalledWith(
          1,
          ['en'],
          'translation',
          'test_one',
          'new value',
          true,
          expect.objectContaining({
            count: expect.any(Number),
            defaultValue_one: expect.any(String),
            defaultValue_other: expect.any(String),
            lng: expect.any(String),
          }),
        );
        expect(missingKeyHandler).toHaveBeenNthCalledWith(
          2,
          ['en'],
          'translation',
          'test_other',
          'new values',
          true,
          expect.objectContaining({
            count: expect.any(Number),
            defaultValue_one: expect.any(String),
            defaultValue_other: expect.any(String),
            lng: expect.any(String),
          }),
        );
      });
    });
  });
});
