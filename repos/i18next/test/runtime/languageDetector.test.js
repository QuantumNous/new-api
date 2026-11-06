import { describe, it, expect } from 'vitest';
import { createInstance } from '../../src/index.js';

describe('LanguageDetector with different signatures', () => {
  describe('LanguageDetector with minimal sync signature', () => {
    let detectingLanguage = 'de-CH';
    const i18n = createInstance();
    i18n.use({
      type: 'languageDetector',
      detect: () => detectingLanguage,
    });

    describe('#init', () => {
      it('should work as usual', () => {
        i18n.init({ initAsync: false });
        expect(i18n.language).to.eql('de-CH');
      });
    });

    describe('#changeLanguage', () => {
      it('should detect the language accordingly', () => {
        detectingLanguage = 'it';
        i18n.changeLanguage();
        expect(i18n.language).to.eql('it');
      });
    });
  });

  describe('LanguageDetector with full sync signature', () => {
    let detectingLanguage = 'de-CH';
    let cachedLng;
    const i18n = createInstance();
    i18n.use({
      type: 'languageDetector',
      init: () => {},
      detect: () => detectingLanguage,
      cacheUserLanguage: (l) => {
        cachedLng = l;
        return l;
      },
    });

    describe('#init', () => {
      it('should work as usual', () => {
        i18n.init({ initAsync: false });
        expect(i18n.language).to.eql('de-CH');
        expect(cachedLng).to.eql('de-CH');
      });
    });

    describe('#changeLanguage', () => {
      it('should detect the language accordingly', () => {
        detectingLanguage = 'it';
        i18n.changeLanguage();
        expect(i18n.language).to.eql('it');
        expect(cachedLng).to.eql('it');
      });
    });
  });

  describe('LanguageDetector with async callback signature', () => {
    let detectingLanguage = 'de-CH';
    const i18n = createInstance();
    i18n.use({
      type: 'languageDetector',
      async: true,
      detect: (clb) => clb(detectingLanguage),
    });

    describe('#init', () => {
      it('should work as usual', async () => {
        await i18n.init();
        expect(i18n.language).to.eql('de-CH');
      });
    });

    describe('#changeLanguage', () => {
      it('should detect the language accordingly', async () => {
        detectingLanguage = 'it';
        await i18n.changeLanguage(undefined);
        expect(i18n.language).to.eql('it');
      });
    });
  });

  describe('LanguageDetector with async promise signature', () => {
    let detectingLanguage = 'de-CH';
    let cachedLng;
    const i18n = createInstance();
    i18n.use({
      type: 'languageDetector',
      async: true,
      detect: async () => Promise.resolve(detectingLanguage),
      cacheUserLanguage: async (l) => {
        cachedLng = l;
        return Promise.resolve(l);
      },
    });

    describe('#init', () => {
      it('should work as usual', async () => {
        await i18n.init();

        expect(i18n.language).to.eql('de-CH');
        expect(cachedLng).to.eql('de-CH');
      });
    });

    describe('#changeLanguage', () => {
      it('should detect the language accordingly', async () => {
        detectingLanguage = 'it';
        await i18n.changeLanguage(undefined);

        expect(i18n.language).to.eql('it');
        expect(cachedLng).to.eql('it');
      });
    });
  });
});
