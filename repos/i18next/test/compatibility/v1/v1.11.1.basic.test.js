import { describe, it, expect, vitest, beforeEach, afterEach, beforeAll } from 'vitest';
import sinon from 'sinon';
import {
  i18nCompatibilityV1 as i18n,
  getI18nCompatibilityV1InitOptions,
  httpApiCompatibilityV1 as httpApi,
  httpApiReadMockImplementation,
} from './v1.i18nInstance.js';

import * as compat from './v1.js';

describe('v1.11.1 basic usage', () => {
  let opts;

  beforeEach(() => {
    opts = compat.convertAPIOptions(getI18nCompatibilityV1InitOptions());
  });

  describe('CI mode', () => {
    beforeEach(async () => {
      await i18n.init(
        i18n.functions.extend(opts, {
          resStore: {
            'en-US': { translation: { simpleTest: 'ok_from_en-US' } },
            'de-DE': { translation: { simpleTest: 'ok_from_de-DE' } },
          },
        }),
      );
    });

    it('it should provide resources for set language', async () => {
      expect.assertions(2);

      expect(i18n.t('simpleTest')).to.equal('ok_from_en-US');

      await i18n.setLng('CIMode', (err, t) => {
        expect(t('simpleTest')).to.equal('simpleTest');
      });
    });
  });

  describe('setting language', () => {
    beforeEach(async () => {
      await i18n.init(
        i18n.functions.extend(opts, {
          resStore: {
            'en-US': { translation: { simpleTest: 'ok_from_en-US' } },
            'de-DE': { translation: { simpleTest: 'ok_from_de-DE' } },
          },
        }),
      );
    });

    it('it should provide resources for set language', async () => {
      expect.assertions(2);

      expect(i18n.t('simpleTest')).to.equal('ok_from_en-US');

      await i18n.setLng('de-DE', (err, t) => {
        expect(t('simpleTest')).to.equal('ok_from_de-DE');
      });
    });

    it('should be possible to call setLng multiple times to get specialized callbacks', () => {
      expect.assertions(5);

      i18n.setLng('de-DE', { fixLng: true }, (deError, deDE) => {
        expect(deDE.lng).to.equal('de-DE');

        i18n.setLng('en-US', { fixLng: true }, (enError, enUS) => {
          expect(deDE.lng).to.equal('de-DE');
          expect(enUS.lng).to.equal('en-US');

          expect(deDE('simpleTest')).to.equal('ok_from_de-DE');
          expect(enUS('simpleTest')).to.equal('ok_from_en-US');
        });
      });
    });
  });

  describe('preloading multiple languages', () => {
    /** @type {import('vitest').MockInstance}  */
    let spy;

    beforeEach(async () => {
      spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);
      return () => {
        spy.mockReset();
      };
    });

    beforeEach(async () => {
      await i18n.init(opts);
    });

    it('it should preload resources for languages', () => {
      expect.assertions(1);

      spy.mockClear();
      // if (i18n.sync.resStore) i18n.sync.resStore = {}; // to reset for test on server!
      i18n.preload('de-DE', () => {
        expect(spy).toHaveBeenCalledTimes(2); // de-DE, de
      });
    });
  });

  describe('postprocessing tranlation', () => {
    describe('having a postprocessor', () => {
      beforeAll(() => {
        i18n.addPostProcessor('myProcessor', () => 'ok_from_postprocessor');
        i18n.addPostProcessor('myProcessor2', (val) => `${val} ok`);
      });

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore: {
              'en-US': { translation: { simpleTest: 'ok_from_en-US' } },
              'de-DE': { translation: { simpleTest: 'ok_from_de-DE' } },
            },
          }),
        );
      });

      it('it should postprocess the translation by passing in postProcess name to t function', () => {
        expect(i18n.t('simpleTest', { postProcess: 'myProcessor' })).to.equal(
          'ok_from_postprocessor',
        );
      });

      it('it should postprocess on default value', () => {
        expect(
          i18n.t('notFound1', { defaultValue: 'defaultValue', postProcess: 'myProcessor2' }),
        ).to.equal('defaultValue ok');
      });

      it('it should postprocess on missing value', () => {
        expect(i18n.t('notFound2', { postProcess: 'myProcessor2' })).to.equal('notFound2 ok');
      });

      it('it should postprocess with multiple post processors', () => {
        expect(i18n.t('simpleTest', { postProcess: ['myProcessor', 'myProcessor2'] })).to.equal(
          'ok_from_postprocessor ok',
        );
      });

      it('it should postprocess on missing value with multiple post processes', () => {
        expect(i18n.t('notFound2', { postProcess: ['myProcessor', 'myProcessor2'] })).to.equal(
          'ok_from_postprocessor ok',
        );
      });

      describe('or setting it as default on init', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              resStore: {
                'en-US': { translation: { simpleTest: 'ok_from_en-US' } },
                'de-DE': { translation: { simpleTest: 'ok_from_de-DE' } },
              },
              postProcess: 'myProcessor',
              shortcutFunction: 'defaultValue',
            }),
          );
        });

        it('it should postprocess the translation by default', () => {
          expect(i18n.t('simpleTest')).to.equal('ok_from_postprocessor');
        });
      });
    });
  });

  describe('post missing resources', () => {
    describe('to fallback', () => {
      /** @type {import('sinon').SinonFakeServer}  */
      let server;
      /** @type {import('vitest').MockInstance}  */
      let spy;

      beforeEach(async () => {
        server = sinon.fakeServer.create();
        spy = vitest.spyOn(httpApi, 'create');
        // spy = sinon.spy(i18n.services.backendConnector, 'saveMissing');

        server.respondWith([200, { 'Content-Type': 'text/html', 'Content-Length': 2 }, 'OK']);

        await i18n.init(
          i18n.functions.extend(opts, {
            sendMissing: true,
            resStore: {
              'en-US': { translation: {} },
              en: { translation: {} },
              dev: { translation: {} },
            },
          }),
        );
      });

      afterEach(() => {
        server.restore();
        // stub.restore();
        spy.mockClear();
      });

      it('it should post missing resource to server', () => {
        i18n.t('missing');
        server.respond();
        expect(spy).toHaveBeenCalledOnce();
      });

      it('it should post missing resource to server when language is passed in', () => {
        i18n.t('missing_en', { lng: 'en' });
        server.respond();
        expect(spy).toHaveBeenCalledOnce();
      });

      it('it should call with right arguments', () => {
        i18n.t('missing');
        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
          ['en-US'],
          'translation',
          'missing',
          'missing',
          expect.objectContaining({
            isUpdate: expect.any(Boolean),
            postProcess: expect.any(String),
          }),
        );
      });

      describe('with fallbackLng set to false', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              lng: 'de',
              sendMissing: true,
              fallbackLng: false,
              sendMissingTo: 'fallback',
              resStore: {
                'en-US': { translation: {} },
                en: { translation: {} },
                dev: { translation: {} },
              },
            }),
          );
        });

        it('it should post missing resource to server', () => {
          i18n.t('missing');
          server.respond();
          expect(spy).toHaveBeenCalledOnce();
        });

        it('it should call post missing with right arguments', () => {
          i18n.t('missing');

          expect(spy).toHaveBeenCalledWith(
            ['de'],
            'translation',
            'missing',
            'missing',
            expect.objectContaining({
              isUpdate: expect.any(Boolean),
              postProcess: expect.any(String),
            }),
          );
        });
      });
    });

    describe('to current', () => {
      /** @type {import('sinon').SinonFakeServer}  */
      let server;
      /** @type {import('vitest').MockInstance}  */
      let spy;

      beforeEach(() => {
        server = sinon.fakeServer.create();
        spy = vitest.spyOn(httpApi, 'create');

        server.respondWith([200, { 'Content-Type': 'text/html', 'Content-Length': 2 }, 'OK']);

        return () => {
          server.restore();
          spy.mockClear();
        };
      });

      beforeEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            sendMissing: true,
            sendMissingTo: 'current',
            // fallbackLng: false,
            resStore: {
              'en-US': { translation: {} },
              en: { translation: {} },
              dev: { translation: {} },
            },
          }),
        );
      });

      it('it should post missing resource for all lng to server', () => {
        i18n.t('missing');
        server.respond();
        expect(spy).toHaveBeenCalledOnce();
      });

      it('it should call post missing with right arguments', () => {
        i18n.t('missing2');

        expect(spy).toHaveBeenCalledWith(
          ['en-US'],
          'translation',
          'missing2',
          'missing2',
          expect.objectContaining({
            isUpdate: expect.any(Boolean),
            postProcess: expect.any(String),
          }),
        );
      });
    });

    describe('to all', () => {
      /** @type {import('sinon').SinonFakeServer}  */
      let server;
      /** @type {import('vitest').MockInstance}  */
      let spy;

      beforeEach(() => {
        server = sinon.fakeServer.create();
        spy = sinon.spy(httpApi, 'create');

        server.respondWith([200, { 'Content-Type': 'text/html', 'Content-Length': 2 }, 'OK']);

        return () => {
          server.restore();
          spy.restore();
        };
      });

      afterEach(async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            sendMissing: true,
            sendMissingTo: 'all',
            resStore: {
              'en-US': { translation: {} },
              en: { translation: {} },
              dev: { translation: {} },
            },
          }),
        );
      });

      it('it should post missing resource for all lng to server', () => {
        i18n.t('missing');
        server.respond();
        expect(spy.calledOnce).to.equal(true);
      });

      it('it should call post missing with right arguments', () => {
        i18n.t('missing2');
        expect(spy.args[0][0]).to.eql(['en-US', 'en', 'dev']);
        expect(spy.args[0][1]).to.equal('translation');
        expect(spy.args[0][2]).to.equal('missing2');
        expect(spy.args[0][3]).to.equal('missing2');
      });
    });
  });

  describe('using objectTreeKeyHandler', () => {
    beforeEach(async () => {
      await i18n.init(
        i18n.functions.extend(opts, {
          objectTreeKeyHandler(key) {
            return i18n.t(`${key}.a`);
          },
          resStore: {
            'en-US': { translation: { simpleTest: { a: 'a value', b: 'b value' } } },
          },
          returnObjectTrees: false,
        }),
      );
    });

    it('it should apply objectTreeKeyHandler', () => {
      expect(i18n.t('simpleTest')).to.equal('a value');
    });
  });

  describe.skip('[WONT BE EXPOSED AS I18N]Global variable conflict', () => {
    it(
      'it should rename global "window.i18n" to "window.i18next"' +
        ' and restore window.i18n conflicting reference',
      () => {
        window.i18n.noConflict();

        expect(window.i18n.isFakeConflictingLib).to.equal(true);
        expect(window.i18next).to.be.an(Object);
        expect(window.i18next.t).to.be.a(Function);
      },
    );
  });
});
