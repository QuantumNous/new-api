import { describe, it, expect, beforeAll } from 'vitest';
import i18next from '../../src/i18next.js';

const Logger = {
  type: 'logger',

  entries: {
    log: [],
    warn: [],
    error: [],
  },

  log(args) {
    this.entries.log.push(args[0]);
  },
  warn(args) {
    this.entries.warn.push(args[0]);
  },
  error(args) {
    this.entries.error.push(args[0]);
  },

  reset() {
    this.entries = {
      log: [],
      warn: [],
      error: [],
    };
  },
};

const Backend = {
  type: 'backend',

  init(services, options) {
    this.services = services;
    this.options = options;
  },

  read(language, namespace, callback) {
    if (namespace.indexOf('fail') === 0) return callback('failed', false);
    callback(null, { status: 'ok', key: `${language}-${namespace}` });
  },

  created: [],

  create(languages, namespace, key) {
    this.created.push(`${languages.join('-')}-${namespace}-${key}`);
  },

  reset() {
    this.created = [];
  },
};

/** @type {import('i18next').i18n} */
let i18n = i18next.createInstance();
i18n.use(Backend);
i18n.use(Logger);

describe('i18next', () => {
  describe('hasLoadedNamespace', () => {
    describe('not called init()', () => {
      it('it should nok', () => {
        expect(i18n.isInitialized).toBeFalsy();
        expect(i18n.hasLoadedNamespace('ns1')).toBeFalsy();
      });
    });

    describe('called init() not detecting lng', () => {
      it('it should ok - but warn about issue', async () => {
        expect(i18n.isInitialized).toBeFalsy();
        expect(i18n.isInitializing).toBeFalsy();
        const prom = i18n.init({ debug: true, saveMissing: true });
        expect(i18n.isInitializing).toBeTruthy();
        expect(i18n.isInitialized).toBeFalsy();
        await prom;
        expect(i18n.isInitializing).toBeFalsy();
        expect(i18n.isInitialized).toBeTruthy();

        expect(i18n.hasLoadedNamespace('translation')).to.equal(false);

        expect(Logger.entries.warn[0]).to.equal(
          'i18next: init: no languageDetector is used and no lng is defined',
        );
        expect(Logger.entries.warn[1]).to.equal(
          'i18next: hasLoadedNamespace: i18n.languages were undefined or empty',
        );
        Logger.reset();
      });
    });

    describe('called init() properly', () => {
      beforeAll(
        () =>
          new Promise((resolve) => {
            i18n = i18n.cloneInstance({ debug: true, saveMissing: true, lng: 'en-US' }, () => {
              resolve();
            });
          }),
      );

      it('it should ok for loaded ns', () => {
        expect(i18n.hasLoadedNamespace('translation')).toBeTruthy();
      });

      it('it should nok for not loaded ns', () => {
        expect(i18n.hasLoadedNamespace('ns1')).toBeFalsy();
      });

      describe('translator - calling t', () => {
        it('it should not log anything if loaded ns', () => {
          i18n.t('keyNotFound');
          expect(Logger.entries.warn.length).to.equal(0);
          Logger.reset();
        });

        it('it should not call saveMissing create on backend if not loaded ns', () => {
          i18n.t('ns1:keyNotFound');

          expect(Logger.entries.warn.length).to.equal(3);
          expect(Logger.entries.warn[0]).to.equal(
            'i18next::translator: key "keyNotFound" for languages "en-US, en, dev" won\'t get resolved as namespace "ns1" was not yet loaded',
          );
          Logger.reset();
        });
      });

      describe('backendConnector - saveMissing', () => {
        it('it should call saveMissing create on backend if loaded ns', () => {
          i18n.t('keyNotFound');
          expect(Backend.created.length).to.equal(1);
          expect(Backend.created[0]).to.equal('dev-translation-keyNotFound');
          Backend.reset();
        });

        it('it should not call saveMissing create on backend if not loaded ns', () => {
          i18n.t('ns1:keyNotFound');

          expect(Backend.created.length).to.equal(0);
          Backend.reset();

          expect(Logger.entries.warn.length).to.equal(2);
          expect(Logger.entries.warn[1]).to.equal(
            'i18next::backendConnector: did not save key "keyNotFound" as the namespace "ns1" was not yet loaded',
          );
          Logger.reset();
        });
      });
    });

    describe('for a namespace failed loading', () => {
      beforeAll(async () => {
        await i18n.loadNamespaces('fail-ns');
      });

      it('it should ok for loaded ns', () => {
        expect(i18n.hasLoadedNamespace('fail-ns')).to.equal(true);
      });
    });
  });

  describe('for lng = cimode', () => {
    beforeAll(async () => {
      i18n.changeLanguage('cimode');
    });

    it('it should ok for loaded ns', () => {
      expect(i18n.hasLoadedNamespace('translation')).to.equal(true);
    });

    it('it should ok for not loaded ns', () => {
      expect(i18n.hasLoadedNamespace('ns1')).to.equal(true);
    });
  });

  describe('not having a backend', () => {
    /** @type {import('i18next').i18n} */
    const i18n2 = i18next.createInstance();
    i18n2.use(Logger);
    beforeAll(async () => {
      await i18n2.init({
        debug: true,
        lng: 'en-US',
        resources: { 'en-US': { translation: {} }, dev: { translation: {} } },
      });
    });

    it('it should ok for passed in ns', () => {
      expect(i18n2.hasLoadedNamespace('translation')).to.equal(true);
    });

    it('it should ok for not passed in ns - as there is no loading done', () => {
      expect(i18n2.hasLoadedNamespace('ns1')).to.equal(true);
    });
  });

  describe('having a backend and having resources but without partialBundledLanguages flag', () => {
    /** @type {import('i18next').i18n} */
    const i18n2 = i18next.createInstance();
    i18n2.use(Backend);
    i18n2.use(Logger);
    beforeAll(async () => {
      await i18n2.init({
        debug: true,
        lng: 'en-US',
        resources: { 'en-US': { translation: {} }, dev: { translation: {} } },
      });
    });

    it('it should ok for passed in ns', () => {
      expect(i18n2.hasLoadedNamespace('translation')).to.equal(true);
    });

    it('it should ok for not passed in ns - as there is no loading done', () => {
      expect(i18n2.hasLoadedNamespace('notLoaded')).to.equal(true);
    });
  });
});
