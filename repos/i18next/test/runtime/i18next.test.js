import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';
import i18next from '../../src/i18next.js';
import { get as getDefaults } from '../../src/defaults.js';

describe('i18next', () => {
  beforeAll(() => {
    i18next.init({
      foo: 'bar',
      debug: false,
    });
    i18next.changeLanguage('en');
  });

  describe('instance creation', () => {
    describe('createInstance()', () => {
      let newInstance;
      beforeAll(() => {
        newInstance = i18next.createInstance({ bar: 'foo' });
      });

      it('it should not inherit options from initial i18next', () => {
        expect(newInstance.options.bar).to.equal('foo');
      });

      it('it has own instance of resource store', () => {
        expect(newInstance.store).to.not.equal(i18next.store);
      });
    });

    describe('cloneInstance()', () => {
      /** @type {import('i18next').i18n} */
      let newInstance;
      beforeAll(() => {
        newInstance = i18next.cloneInstance({ bar: 'foo' });
      });

      it('it should inherit options from initial i18next', () => {
        expect(newInstance.options.foo).to.equal('bar');
        expect(newInstance.options.bar).to.equal('foo');
      });

      it('it has shared instance of resource store', () => {
        expect(newInstance.store).to.equal(i18next.store);
      });

      it('it is set to same language', () => {
        expect(newInstance.language).to.equal(i18next.language);
      });

      it('it can change language independent to original', () => {
        newInstance.changeLanguage('de');
        expect(newInstance.language).to.equal('de');
        expect(i18next.language).to.equal('en');
      });

      it('changeLanguage on clone should not be overridden by deferred init load', () => {
        vi.useFakeTimers();

        const instance = i18next.createInstance();
        instance.use({
          type: 'backend',
          read: (language, namespace, callback) => {
            const delay = language === 'en' ? 50 : 200;
            setTimeout(() => {
              callback(null, { key: `value_${language}` });
            }, delay);
          },
        });

        const task = new Promise((resolve) => {
          instance.init({ fallbackLng: 'en' }, () => {
            const clone = instance.cloneInstance();
            resolve(
              clone.changeLanguage('de').then(() => {
                expect(clone.language).to.equal('de');
                expect(clone.resolvedLanguage).to.equal('de');
              }),
            );
          });
        });

        vi.advanceTimersByTime(1000);

        return task.finally(() => {
          vi.useRealTimers();
        });
      });

      it('should interpolate list for cloned instance with empty interpolation config', async () => {
        const config = {
          lng: 'en',
          resources: {
            en: {
              translation: {
                test: 'My list: {{items, list(type: conjunction; style: long;)}}',
              },
            },
          },
          interpolation: {},
        };
        const instance = i18next.createInstance(config);
        await instance.init(config);
        const clone = instance.cloneInstance(config);
        await clone.init(config);
        expect(clone.t('test', { items: ['foo', 'bar'] })).to.equal('My list: foo and bar');
      });
    });

    describe('create/cloneInstance()', () => {
      /** @type {import('i18next').i18n} */
      let instance1;
      /** @type {import('i18next').i18n} */
      let instance2;
      beforeAll(
        () =>
          new Promise((resolve) => {
            instance1 = i18next.cloneInstance({ lng: 'en' }, () => {
              instance2 = instance1.cloneInstance({ lng: 'de' }, () => resolve());
            });
          }),
      );

      it('it should have correct lngs', () => {
        expect(instance1.language).to.equal('en');
        expect(instance1.languages).to.eql(['en', 'dev']);
        expect(instance2.language).to.equal('de');
        expect(instance2.languages).to.eql(['de', 'dev']);

        expect(instance1.translator.language).to.equal('en');
        expect(instance2.translator.language).to.equal('de');
      });
    });

    describe('cloneInstance({ forkResourceStore: true })', () => {
      /** @type {import('i18next').i18n} */
      let orgInstance;
      /** @type {import('i18next').i18n} */
      let newInstance;
      beforeAll(() => {
        orgInstance = i18next.createInstance();
        orgInstance.init({
          lng: 'en',
          resources: {
            en: {
              translation: {
                deeper: {
                  key: 'value here',
                },
              },
            },
          },
        });
        orgInstance.addResourceBundle(
          'en',
          'translation',
          {
            some: { key: 'another value here' },
          },
          true,
          false,
        );
        newInstance = orgInstance.cloneInstance({ forkResourceStore: true, keySeparator: '__' });
        newInstance.addResourceBundle('en', 'translation', {
          deeper: { key: 'value here cloned' },
        });
      });

      it('it not has shared instance of resource store', () => {
        expect(newInstance.store).not.to.equal(orgInstance.store);
        expect(orgInstance.t('deeper.key')).to.equal('value here');
        expect(orgInstance.t('some.key')).to.equal('another value here');
        expect(orgInstance.t('deeper.key')).not.to.equal(newInstance.t('deeper.key'));
        expect(newInstance.t('deeper__key')).to.equal('value here cloned');
        expect(newInstance.t('some__key')).to.equal('another value here');
      });
    });
  });

  describe('i18next - functions', () => {
    describe('t', () => {
      it('is usable as a free function', () => {
        const { t } = i18next;
        expect(t('key')).to.equal('key');
      });

      describe('t with interpolated key', () => {
        let i18nInst;
        beforeAll(() => {
          const { createInstance } = i18next;
          i18nInst = createInstance();
          i18nInst.init({
            fallbackLng: 'en',
            resources: {
              en: {
                translation: {
                  interKey: 'hi {{name}}',
                },
              },
            },
          });
        });

        it('does not manipulate passed options', () => {
          const { t } = i18nInst;
          const o = { name: 'Fritz' };
          expect(t('interKey', o)).to.equal('hi Fritz');
          expect(o).to.not.have.property('lng');
        });
      });
    });

    describe('getFixedT', () => {
      it('it should have lng, ns on t', () => {
        const t = i18next.getFixedT('de', 'common');
        expect(t.lng).to.equal('de');
        expect(t.ns).to.equal('common');
      });
      it('should handle default value', () => {
        const t = i18next.getFixedT(null, null);
        const translatedKey = t('key', 'default');
        const translatedSecondKey = t('key', { defaultValue: 'default' });
        expect(translatedKey).to.equal('default');
        expect(translatedSecondKey).to.equal('default');
      });
      it('should apply keyPrefix', () => {
        i18next.addResource('fr', 'translation', 'deeply.nested.key', 'ici!');
        const t = i18next.getFixedT('fr', null, 'deeply.nested');
        expect(t('key')).to.equal('ici!');
        expect(t(($) => $.key)).to.equal('ici!');
        expect(t.keyPrefix).to.equal('deeply.nested');
      });
      it('should apply keyPrefix using a selector function', () => {
        i18next.addResource('fr', 'translation', 'deeply.nested.key', 'ici!');
        const t = i18next.getFixedT('fr', null, ($) => $.deeply.nested);
        expect(t('key')).to.equal('ici!');
        expect(t(($) => $.key)).to.equal('ici!');
      });
      it('should apply keyPrefix and also be able to overwrite it', () => {
        i18next.addResource('it', 'translation', 'deeply.nested.key', 'quì!');
        const t = i18next.getFixedT('it', null, 'deeply.nested');
        expect(t('nested.key', { keyPrefix: 'deeply' })).to.equal('quì!');
        expect(t.keyPrefix).to.equal('deeply.nested');
      });
      it('should apply keyPrefix and also be able to overwrite it with a selector function', () => {
        i18next.addResource('it', 'translation', 'deeply.nested.key', 'quì!');
        const t = i18next.getFixedT('it', null, 'deeply.nested');
        expect(t('nested.key', { keyPrefix: ($) => $.deeply })).to.equal('quì!');
      });
      it('should apply keyPrefix and also be able to "reset" it', () => {
        i18next.addResource('pt', 'translation', 'deeply.nested.key', 'quì!');
        const t = i18next.getFixedT('pt', null, 'deeply.nested');
        expect(t('nested.key', { keyPrefix: 'deeply' })).to.equal('quì!');
        expect(t.keyPrefix).to.equal('deeply.nested');
        expect(t('deeply.nested.key', { keyPrefix: 'deeply' })).to.equal(
          'deeply.deeply.nested.key',
        );
        expect(t('deeply.nested.key', { keyPrefix: '' })).to.equal('quì!');
        expect(t.keyPrefix).to.equal('deeply.nested');
      });
      it('should apply keyPrefix also for fallback keys', () => {
        i18next.addResource('fr', 'translation', 'group.key1', 'Translation 1');
        i18next.addResource('fr', 'translation', 'group.key2', 'Translation 2');
        const t = i18next.getFixedT('fr', null, 'group');
        expect(t('key1')).to.equal('Translation 1');
        expect(t.keyPrefix).to.equal('group');
        expect(t('key2')).to.equal('Translation 2');
        expect(t.keyPrefix).to.equal('group');
        expect(i18next.t(['group.key1', 'group.key2'], { lng: 'fr' })).to.equal('Translation 1');
        expect(t(['key1', 'key2'])).to.equal('Translation 1');
      });

      // `scopeNs` decouples selector path[0] matching from resolution scope.
      // The bound `ns` (a single primary string) still drives Translator.resolve,
      // so non-selector lookups stay isolated to the primary namespace; but the
      // selector now sees the full hook namespace list and can route a leading
      // secondary-ns segment to the right namespace.
      describe('scopeNs (4th opts arg)', () => {
        beforeAll(async () => {
          i18next.addResource('en', 'authNs', 'login.welcome', 'WelcomeFromAuth');
          i18next.addResource('en', 'authNs', 'shared', 'auth-shared');
          i18next.addResource('en', 'validationNs', 'email.required', 'EmailRequired');
          i18next.addResource('en', 'validationNs', 'shared', 'validation-shared');
          await i18next.loadNamespaces(['authNs', 'validationNs']);
        });
        it('routes selector path with secondary-ns prefix to that namespace', () => {
          const t = i18next.getFixedT('en', 'authNs', undefined, {
            scopeNs: ['authNs', 'validationNs'],
          });
          expect(t(($) => $.validationNs.email.required)).to.equal('EmailRequired');
        });
        it('does NOT rewrite a primary-ns prefixed selector path', () => {
          // path[0] === primary ('authNs') means a literal sub-key, not a ns switch.
          const t = i18next.getFixedT('en', 'authNs', undefined, {
            scopeNs: ['authNs', 'validationNs'],
          });
          // No `authNs.login.welcome` key exists under primary; the rewrite is intentionally not applied.
          expect(t(($) => $.authNs.login.welcome)).to.equal('authNs.login.welcome');
        });
        it('still routes a non-prefixed selector to the primary ns', () => {
          const t = i18next.getFixedT('en', 'authNs', undefined, {
            scopeNs: ['authNs', 'validationNs'],
          });
          expect(t(($) => $.login.welcome)).to.equal('WelcomeFromAuth');
        });
        it('keeps non-selector resolution isolated to the primary ns (no fallback)', () => {
          // `shared` exists in BOTH namespaces. Without scopeNs it would resolve to
          // the primary's value; with scopeNs it must STILL resolve to the primary,
          // because scopeNs is selector-only and does not change resolution scope.
          const t = i18next.getFixedT('en', 'authNs', undefined, {
            scopeNs: ['authNs', 'validationNs'],
          });
          expect(t('shared')).to.equal('auth-shared');
        });
        it('lets per-call ns override scopeNs for selector path detection', () => {
          const t = i18next.getFixedT('en', 'authNs', undefined, {
            scopeNs: ['authNs', 'validationNs'],
          });
          // Caller explicitly passed `ns: 'validationNs'` → selector $ proxies the
          // validationNs root; path[0] is a real key, no rewriting kicks in.
          expect(t(($) => $.email.required, { ns: 'validationNs' })).to.equal('EmailRequired');
        });
      });
    });
  });

  describe('chained resource manipulation', () => {
    describe('can add resources', () => {
      it('it adds resources by addResource', () => {
        i18next
          .addResource('de', 'translation', 'test', 'test')
          .addResource('de', 'translation', 'nest.test', 'test_nest');
        expect(i18next.getResource('de', 'translation', 'test')).to.equal('test');
        expect(i18next.getResource('de', 'translation', 'nest.test')).to.equal('test_nest');
      });

      it('it adds resources by addResources', () => {
        i18next
          .addResources('fr', 'translation', {
            hi: 'salut',
          })
          .addResources('fr', 'translation', {
            hi: 'salut',
            hello: 'bonjour',
          });
        expect(i18next.getResource('fr', 'translation', 'hi')).to.equal('salut');
        expect(i18next.getResource('fr', 'translation', 'hello')).to.equal('bonjour');
      });

      it('it adds resources by addResourceBundle', () => {
        i18next
          .addResourceBundle('en.translation', { something1: 'deeper1' })
          .addResourceBundle('en.translation', { something2: 'deeper2' });
        expect(i18next.getResource('en.translation')).to.eql({
          something1: 'deeper1',
          something2: 'deeper2',
        });
      });

      it('it adds resources by addResourceBundle without mutating the input resources', () => {
        const base = { k1: { k2: 'v' } };
        i18next.addResourceBundle('en', 'ns1', base);
        expect(base.k1.k2).to.eql('v');
        i18next.addResourceBundle('en', 'ns1', { k1: { k2: 'v for ns1' } }, true, true);
        expect(base.k1.k2).to.eql('v');
        i18next.addResourceBundle('en', 'ns2', base);
        expect(base.k1.k2).to.eql('v');
        i18next.addResourceBundle('en', 'ns2', { k1: { k2: 'v for ns2' } }, true, true);
        expect(base.k1.k2).to.eql('v');
        expect(i18next.t('ns1:k1.k2')).to.eql('v for ns1');
      });

      describe('can remove resources bundle', () => {
        it('it removes resources by removeResourceBundle', () => {
          i18next.removeResourceBundle('en', 'translation');
          expect(i18next.getResourceBundle('en', 'translation')).toBeFalsy();
        });
      });
    });
  });

  describe.skip('#JSON.stringify', () => {
    /** @type {import('i18next').i18n} */
    let newInstance;
    beforeAll(() => {
      newInstance = i18next.createInstance({ some: 'options' });
    });

    it('it should JSON.stringify non-initialized without errors', () => {
      expect(JSON.stringify(newInstance)).to.equal(
        JSON.stringify({
          options: { some: 'options' },
        }),
      );
    });

    it('it should JSON.stringify initialized without errors', () => {
      expect.assertions(1);
      newInstance.init({ other: 'opts' }, (err) => {
        if (err) throw err;

        newInstance.addResourceBundle('en', 'translation', { key: 'value' });
        newInstance.changeLanguage('en');

        expect(JSON.stringify(newInstance)).to.equal(
          JSON.stringify({
            options: {
              ...getDefaults(),
              some: 'options',
              other: 'opts',
              ignoreJSONStructure: true,
            },
            store: {
              en: {
                translation: {
                  key: 'value',
                },
              },
            },
            language: 'en',
            languages: ['en', 'dev'],
            resolvedLanguage: 'en',
          }),
        );
      });
    });
  });

  describe('language properties', () => {
    /** @type {import('i18next').i18n} */
    let newInstance;
    beforeAll(async () => {
      newInstance = i18next.createInstance({
        fallbackLng: 'en',
        resources: {
          en: {
            translation: {
              key: 'value in en',
            },
          },
          de: {
            translation: {
              key: 'value in de',
            },
          },
          fr: {
            translation: {},
          },
        },
      });
      await newInstance.init();
    });

    describe('after init', () => {
      it('it should have the appq', () => {
        expect(newInstance).to.have.property('language', 'en');
        expect(newInstance).to.have.property('languages');
        expect(newInstance.languages).to.have.lengthOf(1);
        expect(newInstance.languages[0]).to.equal('en');
        expect(newInstance).to.have.property('resolvedLanguage', 'en');
      });
    });

    describe('after changeLanguage with a non available language', () => {
      beforeAll(() => {
        newInstance.changeLanguage('it');
      });
      it('it should have the appropriate language properties', () => {
        expect(newInstance).to.have.property('language', 'it');
        expect(newInstance).to.have.property('languages');
        expect(newInstance.languages).to.have.lengthOf(2);
        expect(newInstance.languages[0]).to.equal('it');
        expect(newInstance.languages[1]).to.equal('en');
        expect(newInstance).to.have.property('resolvedLanguage', 'en');
      });
    });

    describe('after changeLanguage with a region specific language', () => {
      beforeAll(() => {
        newInstance.changeLanguage('de-CH');
      });
      it('it should have the appropriate language properties', () => {
        expect(newInstance).to.have.property('language', 'de-CH');
        expect(newInstance).to.have.property('languages');
        expect(newInstance.languages).to.have.lengthOf(3);
        expect(newInstance.languages[0]).to.equal('de-CH');
        expect(newInstance.languages[1]).to.equal('de');
        expect(newInstance.languages[2]).to.equal('en');
        expect(newInstance).to.have.property('resolvedLanguage', 'de');
      });
    });

    describe('after changeLanguage with an empty loaded language', () => {
      beforeAll(() => {
        newInstance.changeLanguage('fr');
      });
      it('it should have the appropriate language properties', () => {
        expect(newInstance).to.have.property('language', 'fr');
        expect(newInstance).to.have.property('languages');
        expect(newInstance.languages).to.have.lengthOf(2);
        expect(newInstance.languages[0]).to.equal('fr');
        expect(newInstance.languages[1]).to.equal('en');
        expect(newInstance).to.have.property('resolvedLanguage', 'en');
      });
    });
  });

  describe('#loadLanguages()', () => {
    describe('with supportedLngs', () => {
      /** @type {import('i18next').i18n} */
      let newInstance;
      beforeAll(async () => {
        newInstance = i18next.createInstance({
          fallbackLng: 'en',
          supportedLngs: ['en', 'de', 'it'],
          preload: ['en', 'de'],
        });
        await newInstance.init();
      });

      describe('passing a supported lng', () => {
        it('it should extend preload', () => {
          newInstance.loadLanguages('it');
          expect(newInstance.options.preload).to.include('it');
        });
      });

      describe('passing a non supported lng', () => {
        it('it should extend preload', () => {
          newInstance.loadLanguages('es');
          expect(newInstance.options.preload).not.to.include('es');
        });
      });
    });

    describe('without supportedLngs', () => {
      /** @type {import('i18next').i18n} */
      let newInstance;
      beforeAll(async () => {
        newInstance = i18next.createInstance({
          fallbackLng: 'en',
          preload: ['en', 'de'],
        });
        await newInstance.init();
      });

      describe('passing a supported lng', () => {
        it('it should extend preload', () => {
          newInstance.loadLanguages('it');
          expect(newInstance.options.preload).to.include('it');
        });
      });

      describe('passing a non supported lng', () => {
        it('it should extend preload', () => {
          newInstance.loadLanguages('es');
          expect(newInstance.options.preload).to.include('es');
        });
      });

      describe('calling order of the changeLanguage function', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });
        afterEach(() => {
          vi.restoreAllMocks();
        });

        const mockLanguageResource = (lan, delay, value = `${lan}`) => ({
          delay,
          value: {
            foo: value,
          },
        });

        it('it should make sure the resolved language matches the order of changeLanguage calls', () => {
          const instance = i18next.createInstance();

          const langMap = {
            en: mockLanguageResource('en', 100),
            zh: mockLanguageResource('zh', 500),
            es: mockLanguageResource('es', 300),
            jp: mockLanguageResource('jp', 200),
          };

          const task = new Promise((resolve) => {
            instance
              .use({
                type: 'backend',
                read: (language, namespace, callback) => {
                  const lang = langMap[language];

                  setTimeout(() => {
                    callback(null, lang.value);
                  }, lang.delay);
                },
              })
              .init(
                {
                  fallbackLng: 'en',
                },
                (err, t) => {
                  resolve(
                    Promise.all([
                      instance.changeLanguage('en'),
                      instance.changeLanguage('zh'),
                      instance.changeLanguage('jp'),
                      instance.changeLanguage('es'),
                    ]).then(() => {
                      expect(t('foo')).to.equal('es');
                    }),
                  );
                },
              );
          });

          vi.advanceTimersByTime(1000);
          return task;
        });
      });
    });
  });
});
