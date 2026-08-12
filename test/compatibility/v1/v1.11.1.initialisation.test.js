import { describe, it, expect, vitest, beforeEach, afterEach } from 'vitest';
import {
  i18nCompatibilityV1 as i18n,
  getI18nCompatibilityV1InitOptions,
  httpApiCompatibilityV1 as httpApi,
  httpApiReadMockImplementation,
} from './v1.i18nInstance.js';
import * as compat from './v1.js';

describe('v1.11.1 initialisation', () => {
  let opts;

  beforeEach(() => {
    opts = compat.convertAPIOptions(getI18nCompatibilityV1InitOptions());
  });

  describe('determining language directionality', () => {
    /** @type {import('vitest').MockInstance}  */
    let spy;

    beforeEach(async () => {
      spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);
      await i18n.init();
      return () => {
        spy.mockReset();
      };
    });

    it('returns ltr for en-US', () => {
      i18n.setLng('en-US');
      expect(i18n.dir()).to.equal('ltr');
    });

    it('returns ltr for unknown language', () => {
      i18n.setLng('unknown');
      expect(i18n.dir()).to.equal('ltr');
    });

    it('returns rtl for ar', async () => {
      await i18n.setLng('ar');
      expect(i18n.dir()).to.equal('rtl');
    });

    it('returns rtl for ar-IR', async () => {
      await i18n.setLng('ar-Ir');
      expect(i18n.dir()).to.equal('rtl');
    });

    it('returns rtl for fa-AF', async () => {
      await i18n.setLng('fa-AF');
      expect(i18n.dir()).to.equal('rtl');
    });

    it('returns ltr for fa-Latn-AF', async () => {
      await i18n.setLng('fa-Latn-AF');
      expect(i18n.dir()).to.equal('ltr');
    });
  });

  describe('with passed in resource set', () => {
    const resStore = {
      dev: { translation: { simple_dev: 'ok_from_dev' } },
      en: { translation: { simple_en: 'ok_from_en' } },
      'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } },
    };

    beforeEach(async () => {
      await i18n.init(i18n.functions.extend(opts, { resStore }));
    });

    it('it should provide passed in resources for translation', () => {
      expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
      expect(i18n.t('simple_en')).to.equal('ok_from_en');
      expect(i18n.t('simple_dev')).to.equal('ok_from_dev');
    });
  });

  describe('loading from server with static route', () => {
    /** @type {import('vitest').MockInstance}  */
    let spy;
    beforeEach(() => {
      spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

      return () => {
        spy.mockClear();
      };
    });

    beforeEach(async () => {
      await i18n.init(opts);
    });

    it('it should provide loaded resources for translation', () => {
      expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
      expect(i18n.t('simple_en')).to.equal('ok_from_en');
      expect(i18n.t('simple_dev')).to.equal('ok_from_dev');

      expect(i18n.t('xhr_simple_en-US')).to.equal('xhr_ok_from_en-US');
      expect(i18n.t('xhr_simple_en')).to.equal('xhr_ok_from_en');
      expect(i18n.t('xhr_simple_dev')).to.equal('xhr_ok_from_dev');
    });
  });

  describe('advanced initialisation options', () => {
    describe('setting fallbackLng', () => {
      const resStore = {
        dev1: { translation: { simple_dev1: 'ok_from_dev1' } },
        en: { translation: { simple_en: 'ok_from_en' } },
        'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore, fallbackLng: 'dev1' }));
      });

      it('it should provide passed in resources for translation', () => {
        expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
        expect(i18n.t('simple_en')).to.equal('ok_from_en');
        expect(i18n.t('simple_dev1')).to.equal('ok_from_dev1');
      });
    });

    describe('multiple fallbackLng', () => {
      const resStore = {
        dev1: { translation: { simple_dev1: 'ok_from_dev1', simple_dev: 'ok_from_dev1' } },
        dev2: { translation: { simple_dev2: 'ok_from_dev2', simple_dev: 'ok_from_dev2' } },
        en: { translation: { simple_en: 'ok_from_en' } },
        'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } },
      };

      beforeEach(async () => {
        i18n.init(i18n.functions.extend(opts, { resStore, fallbackLng: ['dev1', 'dev2'] }));
      });

      it('it should provide passed in resources for translation', () => {
        expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
        expect(i18n.t('simple_en')).to.equal('ok_from_en');
        // in one
        expect(i18n.t('simple_dev1')).to.equal('ok_from_dev1');
        expect(i18n.t('simple_dev2')).to.equal('ok_from_dev2');
        // in both
        expect(i18n.t('simple_dev')).to.equal('ok_from_dev1');
      });
    });

    describe('adding resources after init', () => {
      const resStore = {
        dev: { translation: { simple_dev: 'ok_from_dev' } },
        en: { translation: { simple_en: 'ok_from_en' } }, // ,
        // 'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } }
      };

      describe('resources', () => {
        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { resStore }));
          i18n.addResource('en-US', 'translation', 'some.deep.thing', 'ok_from_en-US');
        });

        it('it should provide passed in resources for translation', () => {
          expect(i18n.t('some.deep.thing')).to.equal('ok_from_en-US');
        });

        describe('multiple resources', () => {
          beforeEach(async () => {
            await i18n.init(i18n.functions.extend(opts, { resStore }));
            i18n.addResources('en-US', 'translation', {
              'some.other.deep.thing': 'ok_from_en-US_1',
              'some.other.deep.deeper.thing': 'ok_from_en-US_2',
            });
          });

          it('it should add the new namespace to the namespace array', () => {
            expect(i18n.t('some.other.deep.thing')).to.equal('ok_from_en-US_1');
            expect(i18n.t('some.other.deep.deeper.thing')).to.equal('ok_from_en-US_2');
          });
        });
      });

      describe('bundles', () => {
        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { resStore }));
          i18n.addResourceBundle('en-US', 'translation', { 'simple_en-US': 'ok_from_en-US' });
        });

        it('it should provide passed in resources for translation', () => {
          expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
          expect(i18n.t('simple_en')).to.equal('ok_from_en');
          expect(i18n.t('simple_dev')).to.equal('ok_from_dev');
        });

        describe('with a additional namespace', () => {
          beforeEach(async () => {
            await i18n.init(i18n.functions.extend(opts, { resStore }));
            i18n.addResourceBundle('en-US', 'newNamespace', {
              'simple_en-US': 'ok_from_en-US',
            });
          });

          it('it should add the new namespace to the namespace array', () => {
            expect(i18n.options.ns).to.contain('newNamespace');
          });
        });

        describe('with using deep switch', () => {
          beforeEach(async () => {
            await i18n.init(i18n.functions.extend(opts, { resStore }));
            i18n.addResourceBundle('en-US', 'translation', {
              deep: { 'simple_en-US_1': 'ok_from_en-US_1' },
            });
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_2': 'ok_from_en-US_2' } },
              true,
            );
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_3': 'ok_from_en-US_3' } },
              true,
            );
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_3': 'ok_from_en-US_3-overwrite' } },
              true,
            );
          });

          it('it should add the new namespace to the namespace array', () => {
            expect(i18n.t('deep.simple_en-US_1')).to.equal('ok_from_en-US_1');
            expect(i18n.t('deep.simple_en-US_2')).to.equal('ok_from_en-US_2');
          });

          it('it should not overwrite any existing entries if the overwrite switch is off', () => {
            expect(i18n.t('deep.simple_en-US_3')).to.equal('ok_from_en-US_3');
          });
        });

        describe('with using deep switch and overwrite switch', () => {
          beforeEach(async () => {
            i18n.init(i18n.functions.extend(opts, { resStore }));
            i18n.addResourceBundle('en-US', 'translation', {
              deep: { 'simple_en-US_1': 'ok_from_en-US_1' },
            });
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_2': 'ok_from_en-US_2' } },
              true,
            );
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_3': 'ok_from_en-US_3' } },
              true,
            );
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_3': 'ok_from_en-US_3-overwrite' } },
              true,
              true,
            );
          });

          it('it should add the new namespace to the namespace array', () => {
            expect(i18n.t('deep.simple_en-US_1')).to.equal('ok_from_en-US_1');
            expect(i18n.t('deep.simple_en-US_2')).to.equal('ok_from_en-US_2');
          });

          it('it should overwrite any existing entries if the overwrite switch is on', () => {
            expect(i18n.t('deep.simple_en-US_3')).to.equal('ok_from_en-US_3-overwrite');
          });
        });

        describe('check if exists', () => {
          beforeEach(() => {
            i18n.init(i18n.functions.extend(opts, { resStore }));
            i18n.addResourceBundle('en-US', 'translation', {
              deep: { 'simple_en-US_1': 'ok_from_en-US_1' },
            });
            i18n.addResourceBundle(
              'en-US',
              'translation',
              { deep: { 'simple_en-US_2': 'ok_from_en-US_2' } },
              true,
            );
          });

          it('it should return true for existing bundle', () => {
            expect(i18n.hasResourceBundle('en-US', 'translation')).toBe(true);
          });

          it('it should return false for non-existing bundle', () => {
            expect(i18n.hasResourceBundle('de-CH', 'translation')).not.toBe(true);
          });
        });
      });
    });

    describe('getting resources after init', () => {
      const resStore = {
        dev: { translation: { test: 'ok_from_dev' } },
        en: { translation: { test: 'ok_from_en' } },
        'en-US': { translation: { test: 'ok_from_en-US' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
      });

      it('it should return resources for existing bundle', () => {
        const devTranslation = i18n.getResourceBundle('dev', 'translation');
        const enTranslation = i18n.getResourceBundle('en', 'translation');
        const enUSTranslation = i18n.getResourceBundle('en-US', 'translation');
        expect(devTranslation.test).to.equal('ok_from_dev');
        expect(enTranslation.test).to.equal('ok_from_en');
        expect(enUSTranslation.test).to.equal('ok_from_en-US');
      });

      it('it should return empty object for non-existing bundle', () => {
        const nonExisting = i18n.getResourceBundle('en-GB', 'translation');
        expect(Object.keys(nonExisting).length).to.equal(0);
      });

      it('it should use default namespace when namespace argument is left out', () => {
        const enTranslation = i18n.getResourceBundle('en');
        expect(enTranslation.test).to.equal('ok_from_en');
      });

      it('it should return a clone of the resources', () => {
        const enTranslation = i18n.getResourceBundle('en');
        enTranslation.test = 'ok_from_en_changed';
        expect(enTranslation.test).to.equal('ok_from_en_changed');
        expect(resStore.en.translation.test).to.equal('ok_from_en');
      });
    });

    describe('removing resources after init', () => {
      const resStore = {
        dev: { translation: { test: 'ok_from_dev' } },
        en: { translation: { test: 'ok_from_en' } },
        'en-US': { translation: { test: 'ok_from_en-US' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }));
        i18n.removeResourceBundle('en-US', 'translation');
      });

      it('it should remove resources', () => {
        expect(i18n.t('test')).to.equal('ok_from_en');
      });
    });

    describe('setting load', () => {
      describe('to current', () => {
        let spy;
        beforeEach(() => {
          spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

          return () => {
            spy.mockClear();
          };
        });

        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { load: 'current' }));
        });

        it('it should load only current and fallback language', () => {
          expect(spy).toHaveBeenCalledTimes(2); // en-US, en
        });

        it('it should provide loaded resources for translation', () => {
          expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
          expect(i18n.t('simple_en')).not.to.equal('ok_from_en');
          expect(i18n.t('simple_dev')).to.equal('ok_from_dev');
        });
      });

      describe('to unspecific', () => {
        /** @type {import('vitest').MockInstance}  */
        let spy;
        beforeEach(() => {
          spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

          return () => {
            spy.mockClear();
          };
        });

        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { load: 'unspecific' }));
        });

        it('it should load only unspecific and fallback language', () => {
          expect(spy).toBeCalled(3); // en-US, en
        });

        it('it should provide loaded resources for translation', () => {
          expect(i18n.t('simple_en-US')).not.to.equal('ok_from_en-US');
          expect(i18n.t('simple_en')).to.equal('ok_from_en');
          expect(i18n.t('simple_dev')).to.equal('ok_from_dev');
        });

        it('it should return unspecific language', () => {
          expect(i18n.lng()).to.equal('en');
        });
      });
    });

    describe('with fallback language set to false', () => {
      /** @type {import('vitest').MockInstance}  */
      let spy;
      beforeEach(() => {
        spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

        return () => {
          spy.mockClear();
        };
      });

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { fallbackLng: false }));
      });

      it('it should load only specific and unspecific languages', () => {
        expect(spy).toBeCalledTimes(2); // en-US, en
      });

      it('it should provide loaded resources for translation', () => {
        expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
        expect(i18n.t('simple_en')).to.equal('ok_from_en');
        expect(i18n.t('simple_dev')).not.to.equal('ok_from_dev');
      });
    });

    describe('preloading multiple languages', () => {
      /** @type {import('vitest').MockInstance}  */
      let spy;
      beforeEach(() => {
        spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

        return () => {
          spy.mockClear();
        };
      });

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { preload: ['fr', 'de-DE'] }));
      });

      it('it should load additional languages', () => {
        expect(spy).toBeCalledTimes(6); // en-US, en, de-DE, de, fr, dev
      });

      describe('changing the language', () => {
        beforeEach(async () => {
          spy.mockClear();
          // if (i18n.sync.resStore) i18n.sync.resStore = {}; // to reset for test on server!
          await i18n.setLng('de-DE');
        });

        it('it should not reload the preloaded languages', () => {
          expect(spy).not.toBeCalled(); // de-DE the missing one
        });
      });
    });

    describe('[WONT FIX - HARD DEPRECATION]with synchronous flag', () => {
      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { getAsync: false }));
      });

      it('it should provide loaded resources for translation', () => {
        expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
        expect(i18n.t('simple_en')).to.equal('ok_from_en');
        expect(i18n.t('simple_dev')).to.equal('ok_from_dev');
      });
    });

    describe('with namespace', () => {
      describe('with one namespace set', () => {
        /** @type {import('vitest').MockInstance}  */
        let spy;
        beforeEach(() => {
          spy = vitest.spyOn(httpApi, 'read').mockImplementation(httpApiReadMockImplementation);

          return () => {
            spy.mockClear();
          };
        });

        beforeEach(async () => {
          await i18n.init(i18n.functions.extend(opts, { ns: 'ns.special' }));
        });

        it('it should provide loaded resources for translation', () => {
          expect(i18n.t('simple_en-US')).to.equal('ok_from_special_en-US');
          expect(i18n.t('simple_en')).to.equal('ok_from_special_en');
          expect(i18n.t('simple_dev')).to.equal('ok_from_special_dev');
        });
      });

      describe('with more than one namespace set', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              ns: { namespaces: ['ns.common', 'ns.special'], defaultNs: 'ns.special' },
            }),
          );
        });

        it('it should provide loaded resources for translation', () => {
          // default ns
          expect(i18n.t('simple_en-US')).to.equal('ok_from_special_en-US');
          expect(i18n.t('simple_en')).to.equal('ok_from_special_en');
          expect(i18n.t('simple_dev')).to.equal('ok_from_special_dev');

          // ns prefix
          expect(i18n.t('ns.common:simple_en-US')).to.equal('ok_from_common_en-US');
          expect(i18n.t('ns.common:simple_en')).to.equal('ok_from_common_en');
          expect(i18n.t('ns.common:simple_dev')).to.equal('ok_from_common_dev');

          // ns in options
          expect(i18n.t('simple_en-US', { ns: 'ns.common' })).to.equal('ok_from_common_en-US');
          expect(i18n.t('simple_en', { ns: 'ns.common' })).to.equal('ok_from_common_en');
          expect(i18n.t('simple_dev', { ns: 'ns.common' })).to.equal('ok_from_common_dev');
        });

        describe('and fallbacking to default namespace', () => {
          const resStore = {
            dev: { 'ns.special': { simple_dev: 'ok_from_dev' } },
            en: { 'ns.special': { simple_en: 'ok_from_en' } },
            'en-US': { 'ns.special': { 'simple_en-US': 'ok_from_en-US' } },
          };

          beforeEach(async () => {
            await i18n.init(
              i18n.functions.extend(opts, {
                fallbackToDefaultNS: true,
                resStore,
                ns: { namespaces: ['ns.common', 'ns.special'], defaultNs: 'ns.special' },
              }),
            );
          });

          it('it should fallback to default ns', () => {
            // default ns fallback lookup
            expect(i18n.t('ns.common:simple_en-US')).to.equal('ok_from_en-US');
            expect(i18n.t('ns.common:simple_en')).to.equal('ok_from_en');
            expect(i18n.t('ns.common:simple_dev')).to.equal('ok_from_dev');

            // ns in options
            expect(i18n.t('simple_en-US', { ns: 'ns.common' })).to.equal('ok_from_en-US');
            expect(i18n.t('simple_en', { ns: 'ns.common' })).to.equal('ok_from_en');
            expect(i18n.t('simple_dev', { ns: 'ns.common' })).to.equal('ok_from_dev');
          });
        });

        describe('and fallbacking to set namespace', () => {
          const resStore = {
            dev: {
              'ns.special': { simple_dev: 'ok_from_dev' },
              'ns.fallback': { simple_fallback: 'ok_from_fallback' },
            },
            en: { 'ns.special': { simple_en: 'ok_from_en' } },
            'en-US': { 'ns.special': { 'simple_en-US': 'ok_from_en-US' } },
          };

          beforeEach(async () => {
            await i18n.init(
              i18n.functions.extend(opts, {
                fallbackNS: 'ns.fallback',
                resStore,
                ns: {
                  namespaces: ['ns.common', 'ns.special', 'ns.fallback'],
                  defaultNs: 'ns.special',
                },
              }),
            );
          });

          it('it should fallback to set fallback namespace', () => {
            expect(i18n.t('ns.common:simple_fallback')).to.equal('ok_from_fallback');
          });
        });

        describe('and fallbacking to multiple set namespace', () => {
          const resStore = {
            dev: {
              'ns.common': {},
              'ns.special': { simple_dev: 'ok_from_dev' },
              'ns.fallback1': {
                simple_fallback: 'ok_from_fallback1',
                simple_fallback1: 'ok_from_fallback1',
              },
            },
            en: {
              'ns.special': { simple_en: 'ok_from_en' },
              'ns.fallback2': {
                simple_fallback: 'ok_from_fallback2',
                simple_fallback2: 'ok_from_fallback2',
              },
            },
            'en-US': { 'ns.special': { 'simple_en-US': 'ok_from_en-US' } },
          };

          beforeEach(async () => {
            await i18n.init(
              i18n.functions.extend(opts, {
                fallbackNS: ['ns.fallback1', 'ns.fallback2'],
                resStore,
                ns: {
                  namespaces: ['ns.common', 'ns.special', 'ns.fallback'],
                  defaultNs: 'ns.special',
                },
              }),
            );
          });

          it('it should fallback to set fallback namespace', () => {
            expect(i18n.t('ns.common:simple_fallback')).to.equal(
              'ok_from_fallback1',
            ); /* first wins */
            expect(i18n.t('ns.common:simple_fallback1')).to.equal('ok_from_fallback1');
            expect(i18n.t('ns.common:simple_fallback2')).to.equal('ok_from_fallback2');
          });

          describe('and post missing', () => {
            /** @type {import('vitest').MockInstance}  */
            let spy;

            beforeEach(async () => {
              await i18n.init(
                i18n.functions.extend(opts, {
                  fallbackNS: ['ns.fallback1', 'ns.fallback2'],
                  resStore,
                  sendMissing: true /* must be changed to saveMissing */,
                  ns: {
                    namespaces: ['ns.common', 'ns.special', 'ns.fallback'],
                    defaultNs: 'ns.special',
                  },
                }),
                (_, t) => {
                  spy = vitest.spyOn(httpApi, 'create');
                  t('ns.common:notExisting');
                },
              );
            });

            afterEach(() => {
              spy.mockClear();
            });

            it('it should post only to origin namespace', () => {
              expect(spy).toHaveBeenCalledTimes(1);
              expect(spy).toHaveBeenCalledWith(
                ['en-US'],
                'ns.common',
                'notExisting',
                'notExisting',
                expect.objectContaining({
                  isUpdate: expect.any(Boolean),
                  postProcess: expect.any(String),
                }),
              );
            });
          });
        });
      });

      describe('with reloading additional namespace', () => {
        describe('without using localStorage', () => {
          beforeEach(async () => {
            await i18n.init(opts);
            i18n.setDefaultNamespace('ns.special');
            await i18n.loadNamespaces(['ns.common', 'ns.special']);
          });

          it('it should provide loaded resources for translation', () => {
            // default ns
            expect(i18n.t('simple_en-US')).to.equal('ok_from_special_en-US');
            expect(i18n.t('simple_en')).to.equal('ok_from_special_en');
            expect(i18n.t('simple_dev')).to.equal('ok_from_special_dev');

            // ns prefix
            expect(i18n.t('ns.common:simple_en-US')).to.equal('ok_from_common_en-US');
            expect(i18n.t('ns.common:simple_en')).to.equal('ok_from_common_en');
            expect(i18n.t('ns.common:simple_dev')).to.equal('ok_from_common_dev');

            // ns in options
            expect(i18n.t('simple_en-US', { ns: 'ns.common' })).to.equal('ok_from_common_en-US');
            expect(i18n.t('simple_en', { ns: 'ns.common' })).to.equal('ok_from_common_en');
            expect(i18n.t('simple_dev', { ns: 'ns.common' })).to.equal('ok_from_common_dev');
          });

          it('it should add the new namespaces to the namespace array', () => {
            expect(i18n.options.ns).to.contain('ns.common');
            expect(i18n.options.ns).to.contain('ns.special');
          });

          describe('and fallbackToDefaultNS turned on', () => {
            beforeEach(async () => {
              await i18n.init(
                i18n.functions.extend(opts, {
                  ns: 'ns.common',
                  fallbackToDefaultNS: true,
                }),
              );
              await i18n.loadNamespaces(['ns.special']);
            });

            it('it should fallback to default namespace', () => {
              expect(i18n.t('ns.special:test.fallback_en')).to.equal('ok_from_common_en-fallback');
              expect(i18n.t('ns.special:test.fallback_dev')).to.equal(
                'ok_from_common_dev-fallback',
              );
            });
          });
        });

        // cache was removed

        //   describe('with using localStorage', function() {
        //
        //     var spy;
        //
        //     before(function() {
        //       if (typeof window !== 'undefined') { // safe use on server
        //         window.localStorage.removeItem('res_en-US');
        //         window.localStorage.removeItem('res_en');
        //         window.localStorage.removeItem('res_dev');
        //       }
        //     });
        //
        //     beforeEach(function(done) {
        //       spy = sinon.spy(httpApi, 'read');
        //       i18n.init(i18n.functions.extend(opts, {
        //         useLocalStorage: true
        //       }), function(t) {
        //         i18n.setDefaultNamespace('ns.special');
        //         i18n.loadNamespaces(['ns.common', 'ns.special'], done);
        //       });
        //     });
        //
        //     afterEach(function() {
        //       spy.restore();
        //     });
        //
        //     it('it should load language', function() {
        //       expect(spy.callCount).to.equal(9); // en-US, en, de-DE, de, fr, dev * 3 namespaces (translate, common, special)
        //     });
        //
        //     describe('on later reload of namespaces', function() {
        //
        //       beforeEach(function(done) {
        //         spy.reset();
        //         i18n.init(i18n.functions.extend(opts, {
        //           useLocalStorage: true,
        //           ns: 'translation'
        //         }), function(t) {
        //           i18n.setDefaultNamespace('ns.special');
        //           i18n.loadNamespaces(['ns.common', 'ns.special'], done);
        //         });
        //       });
        //
        //       it('it should not reload language', function() {
        //         expect(spy.callCount).to.equal(0);
        //       });
        //
        //     });
        //
        //   });
        //
      });
    });

    // describe('using localStorage', function() {
    //
    //   var spy;
    //
    //   before(function() {
    //     window.localStorage.removeItem('res_en-US');
    //     window.localStorage.removeItem('res_en');
    //     window.localStorage.removeItem('res_dev');
    //   });
    //
    //   beforeEach(function(done) {
    //     spy = sinon.spy(httpApi, 'read');
    //     i18n.init(i18n.functions.extend(opts, {
    //       useLocalStorage: true
    //     }), function(t) { done(); });
    //   });
    //
    //   afterEach(function() {
    //     spy.restore();
    //   });
    //
    //   it('it should load language', function() {
    //     expect(spy.callCount).to.equal(3); // en-US, en, de-DE, de, fr, dev
    //   });
    //
    //   describe('on later init', function() {
    //
    //     beforeEach(function(done) {
    //       spy.reset();
    //       i18n.init(function(t) { done(); });
    //     });
    //
    //     it('it should not reload language', function() {
    //       expect(spy.callCount).to.equal(0); // de-DE, de, fr, dev
    //     });
    //
    //     describe('on later init - after caching duration', function() {
    //
    //       beforeEach(function(done) {
    //         spy.reset();
    //
    //         // expired
    //         var local = window.localStorage.getItem('res_en-US');
    //         local = JSON.parse(local);
    //         local.i18nStamp = 0;
    //         window.localStorage.setItem('res_en-US', JSON.stringify(local));
    //
    //         i18n.init(function(t) { done(); });
    //       });
    //
    //       it('it should reload language', function() {
    //         expect(spy.callCount).to.equal(1); // de-DE, de, fr, dev
    //       });
    //
    //     });
    //
    //   });
    //
    // });

    describe("using function provided in callback's argument", () => {
      /** @type {import('i18next').TFunction} */
      let tCallback;

      const resStore = {
        dev: { translation: { simple_dev: 'ok_from_dev' } },
        en: { translation: { simple_en: 'ok_from_en' } },
        'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } },
      };

      beforeEach(async () => {
        await i18n.init(i18n.functions.extend(opts, { resStore }), (_, t) => {
          tCallback = t;
        });
      });

      it('it should provide loaded resources for translation', () => {
        expect(tCallback('simple_en-US')).to.equal('ok_from_en-US');
        expect(tCallback('simple_en')).to.equal('ok_from_en');
        expect(tCallback('simple_dev')).to.equal('ok_from_dev');
      });
    });

    describe('with lowercase flag', () => {
      describe('default behaviour will uppercase specific country part.', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              lng: 'en-us',
              resStore: {
                'en-US': { translation: { 'simple_en-US': 'ok_from_en-US' } },
              },
            }),
          );
        });

        it('it should translate the uppercased lng value', () => {
          expect(i18n.t('simple_en-US')).to.equal('ok_from_en-US');
        });

        it('it should get uppercased set language', () => {
          expect(i18n.lng()).to.equal('en-US');
        });
      });

      describe('overridden behavior will accept lowercased country part.', () => {
        beforeEach(async () => {
          await i18n.init(
            i18n.functions.extend(opts, {
              lng: 'en-us',
              lowerCaseLng: true,
              resStore: {
                'en-us': { translation: { 'simple_en-us': 'ok_from_en-us' } },
              },
            }),
          );
        });

        it('it should translate the lowercase lng value', () => {
          expect(i18n.t('simple_en-us')).to.equal('ok_from_en-us');
        });

        it('it should get lowercased set language', () => {
          expect(i18n.lng()).to.equal('en-us');
        });
      });
    });

    describe('with language whitelist', () => {
      const resStore = {
        'zh-CN': { translation: { string_one: 'good_zh-CN' } },
        en: { translation: { string_one: 'good_en' } },
        zh: { translation: { string_one: 'BAD_zh' } },
        'en-US': { translation: { string_one: 'BAD_en-ZH' } },
      };

      it('should degrade UNwhitelisted 2-part lang code (en-US) to WHITELISTED 1-part (en)', async () => {
        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            lngWhitelist: ['en', 'zh-CN'],
            lng: 'en-US',
          }),
          () => {
            expect(i18n.lng()).to.equal('en');
            expect(i18n.t('string_one')).to.equal('good_en');
          },
        );
      });

      it('should NOT degrade WHITELISTED 2-part lang code (zh-CN) to UNwhitelisted 1-part (en)', async () => {
        expect.assertions(2);

        await i18n.init(
          i18n.functions.extend(opts, {
            resStore,
            lngWhitelist: ['en', 'zh-CN'],
            lng: 'zh-CN',
          }),
          () => {
            expect(i18n.lng()).to.equal('zh-CN');
            expect(i18n.t('string_one')).to.equal('good_zh-CN');
          },
        );
      });
    });
  });
});
