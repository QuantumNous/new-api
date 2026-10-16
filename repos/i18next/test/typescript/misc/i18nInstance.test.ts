import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next, { InitOptions, TFunction, createInstance, i18n } from 'i18next';

describe('i18nInstance', () => {
  describe('initOptions', () => {
    it('should accept `initAsync`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        initAsync: false,
      });
    });

    it('should accept `fallbackLng`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        fallbackLng: 'en',
      });

      expectTypeOf(i18next.init).toBeCallableWith({
        fallbackLng: ['fr', 'en'],
      });

      // depending on user language
      // fallback depending on user language
      expectTypeOf(i18next.init).toBeCallableWith({
        fallbackLng: {
          'de-CH': ['fr', 'it'],
          'zh-HANT': ['zh-HANS', 'en'],
          es: ['fr'],
          default: ['en'],
        },
      });
    });

    it('should accept `resources`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        resources: {
          en: {
            namespace1: {
              key: 'hello from namespace 1',
            },
            namespace2: {
              key: 'hello from namespace 2',
            },
          },
          de: {
            namespace1: {
              key: 'hallo von namespace 1',
            },
            namespace2: {
              key: 'hallo von namespace 2',
            },
          },
        },
      });
    });

    it('should accept `lng`, `nsSeparator`, `keySeparator` and `fallbackLng`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        lng: 'de',

        // allow keys to be phrases having `:`, `.`
        nsSeparator: false,
        keySeparator: false,

        // do not load a fallback
        fallbackLng: false,
      });
    });

    it('should accept `enableSelector`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        enableSelector: false,
      });
      expectTypeOf(i18next.init).toBeCallableWith({
        enableSelector: true,
      });
      expectTypeOf(i18next.init).toBeCallableWith({
        enableSelector: 'optimize',
      });
      expectTypeOf(i18next.init).toBeCallableWith({
        enableSelector: 'strict',
      });
    });

    it('should accept `backend` options', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        fallbackLng: 'en',
        debug: true,
        ns: ['special', 'common'],
        defaultNS: 'special',
        backend: {
          // load from i18next-gitbook repo
          loadPath:
            'https://raw.githubusercontent.com/i18next/i18next-gitbook/master/locales/{{lng}}/{{ns}}.json',
          crossDomain: true,
        },
      });
    });

    it('should accept locize options', () => {
      // Init with Locize options.
      // From https://github.com/i18next/react-i18next/blob/master/example/locize/src/i18n.js
      const locizeOptions = {
        projectId: '',
        apiKey: '',
        referenceLng: 'en',
      };
      expectTypeOf(i18next.init).toBeCallableWith({
        fallbackLng: 'en',
        debug: true,
        saveMissing: true,

        interpolation: {
          escapeValue: false, // not needed for react as it escapes by default
        },
        backend: locizeOptions,
        locizeLastUsed: locizeOptions,
        react: {
          bindI18n: 'languageChanged editorSaved',
        },
      });
    });

    it('should accept `react`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        react: {
          hashTransKey: (defaultValue) => {
            if (typeof defaultValue === 'string') {
              return defaultValue.replace(/\s+/g, '_');
            }

            throw new Error("Don't know how to make key for non-string defaultValue");
          },
        },
      });
    });

    it('should accept `resources` and `interpolation`', () => {
      expectTypeOf(i18next.init).toBeCallableWith({
        lng: 'en',
        fallbackLng: 'en',

        resources: {
          en: {
            translation: {
              key1: 'test',
              interpolateKey: 'add {{insert}} {{up, uppercase}}',
              interpolateKey2: '<strong>add</strong> {{insert}} {{up, uppercase}}',
            },
          },
        },

        interpolation: {
          escapeValue: false, // not needed for react!!
          formatSeparator: ',',
        },
      });
    });

    it('should infer namespace from initOptions', () => {
      i18next.init(
        {
          ns: ['common', 'moduleA', 'moduleB'] as const,
          defaultNS: 'moduleA',
        },
        (err, t) => {
          // key in moduleA namespace (defined default)
          assertType<string>(t('myKey'));
          // key in common namespace
          assertType<string>(t('common:myKey'));
        },
      );
    });
  });

  it('should provide t function on ready callback', () => {
    // i18next.js export default as esm module because the build is apart from commonjs.
    i18next.init(
      {
        lng: 'en',
        debug: true,
        resources: {
          en: {
            translation: {
              key: 'hello world',
            },
            key: 'hello world',
          },
        },
        ignoreJSONStructure: false,
      },
      (err, t) => {
        // not necessary but check a non-inferred arg for paranoia's sake
        assertType<TFunction>(t);
        // initialized and ready to go!
        assertType<string>(t('key'));
      },
    );
  });

  describe('`loadNamespaces`', () => {
    i18next.loadNamespaces('anotherNamespace', (err, t) => {
      assertType<any>(err);
      assertType<TFunction>(t);
    });

    const cb = () => {};
    expectTypeOf(i18next.loadNamespaces).toBeCallableWith('myNamespace', cb);
    expectTypeOf(i18next.loadNamespaces).toBeCallableWith(['myNamespace1', 'myNamespace2'], cb);

    expectTypeOf(i18next.loadLanguages).toBeCallableWith('de', cb);
    expectTypeOf(i18next.loadLanguages).toBeCallableWith(['de', 'fr'], cb);
  });

  it('`reloadResources`', () => {
    // due to function overload can't use .toBeCallableWith

    // reload all
    i18next.reloadResources();

    // reload languages
    i18next.reloadResources(['de', 'fr'] as const);

    // reload namespaces for all languages
    i18next.reloadResources(null, ['ns1', 'ns2']);

    // reload namespaces in languages
    i18next.reloadResources(['de', 'fr'], ['ns1', 'ns2']);
  });

  it('`dir`', () => {
    type Dir = 'ltr' | 'rtl';
    // for current language
    assertType<Dir>(i18next.dir());

    // for another language
    assertType<Dir>(i18next.dir('en-US'));
    assertType<Dir>(i18next.dir('ar'));
  });

  it('`getDataByLanguage`', () => {
    const data = i18next.getDataByLanguage('de');
    assertType<Record<string, Record<string, string>> | undefined>(data);

    assertType<string | undefined>(data?.translation.myKey);
    assertType<string | undefined>(data?.common.myKey);
  });

  it('`getFixedT`', () => {
    const anotherNamespace = i18next.getFixedT(null, 'anotherNamespace');
    // no need to prefix ns i18n.t('anotherNamespace:anotherNamespaceKey')
    assertType<string>(anotherNamespace('anotherNamespaceKey'));
  });

  it('`changeLanguage`', () => {
    i18next.changeLanguage('en', (err, t) => {
      assertType<any>(err);
      assertType<TFunction>(t);
    });
  });

  describe('`EventEmitter`', () => {
    it('should work with EventEmitter methods', () => {
      expectTypeOf(i18next.on).toBeCallableWith('languageChanged', () => {});
      expectTypeOf(i18next.off).toBeCallableWith('languageChanged', () => {});
    });

    it('should have correct `initialized` event callback signature ', () => {
      i18next.on('initialized', (options) => {
        assertType<InitOptions>(options);
      });
    });
    it('should have correct `loaded` event callback signature ', () => {
      i18next.on('loaded', (loaded) => {
        assertType<{ [language: string]: { [namespace: string]: boolean } }>(loaded);
      });
    });
    it('should have correct `failedLoading` event callback signature ', () => {
      i18next.on('failedLoading', (lng, ns, msg) => {
        assertType<string>(lng);
        assertType<string>(ns);
        assertType<string>(msg);
      });
    });
    it('should have correct `missingKey` event callback signature ', () => {
      i18next.on('missingKey', (lngs, ns, key, res) => {
        assertType<readonly string[]>(lngs);
        assertType<string>(ns);
        assertType<string>(key);
        assertType<string>(res);
      });
    });
    it('should have correct `added` event callback signature ', () => {
      i18next.on('added', (lng, ns) => {
        assertType<string>(lng);
        assertType<string>(ns);
      });
    });
    it('should have correct `removed` event callback signature ', () => {
      i18next.on('removed', (lng, ns) => {
        assertType<string>(lng);
        assertType<string>(ns);
      });
    });
    it('should have correct `languageChanged` event callback signature ', () => {
      i18next.on('languageChanged', (lng) => {
        assertType<string>(lng);
      });
    });
    it('should have correct `customEvent` event callback signature ', () => {
      i18next.on('customEvent', () => {});
    });
  });

  it('store event emitter', () => {
    i18next.store.on('added', (lng, ns) => {
      assertType<string>(lng);
      assertType<string>(ns);
    });
    i18next.store.on('removed', (lng, ns) => {
      assertType<string>(lng);
      assertType<string>(ns);
    });
  });

  describe('resource store', () => {
    it('`getResource`', () => {
      expectTypeOf(i18next.getResource).toBeCallableWith('en', 'test', 'key');
      expectTypeOf(i18next.getResource).toBeCallableWith('en', 'test', 'key', {
        keySeparator: '-',
        ignoreJSONStructure: false,
      });
    });

    it('`addResource`', () => {
      expectTypeOf(i18next.addResource).toBeCallableWith('en', 'test', 'key', 'value');
      expectTypeOf(i18next.addResource).toBeCallableWith('en', 'test', 'key', 'value', {
        keySeparator: '-',
        silent: false,
      });

      expectTypeOf(i18next.addResources).toBeCallableWith('en', 'test', { key: 'value' });
    });

    it('`addResourceBundle`', () => {
      expectTypeOf(i18next.addResourceBundle).toBeCallableWith(
        'en',
        'translations',
        {
          key: 'value',
        },
        true,
        true,
      );
    });

    // @see https://github.com/i18next/i18next/issues/2419
    it('`addResourceBundle` with options', () => {
      expectTypeOf(i18next.addResourceBundle).toBeCallableWith(
        'en',
        'translations',
        { key: 'value' },
        true,
        true,
        { silent: true },
      );
      expectTypeOf(i18next.addResourceBundle).toBeCallableWith(
        'en',
        'translations',
        { key: 'value' },
        true,
        true,
        { skipCopy: true },
      );
    });

    it('`hasResourceBundle`', () => {
      expectTypeOf(i18next.hasResourceBundle).toBeCallableWith('en', 'test');
      expectTypeOf(i18next.hasResourceBundle).returns.toBeBoolean();
    });

    it('`getResourceBundle`', () => {
      expectTypeOf(i18next.getResourceBundle).toBeCallableWith('en', 'test');
    });

    it('`removeResourceBundle`', () => {
      expectTypeOf(i18next.removeResourceBundle).toBeCallableWith('en', 'test');
    });

    it('`addResourceBundle`', () => {
      expectTypeOf(i18next.addResourceBundle).toBeCallableWith('en', 'namespace1', {
        key: 'hello from namespace 1',
      });
    });
  });

  it('`createInstance`', () => {
    expectTypeOf(createInstance).toBeCallableWith({
      lng: 'en',
      fallbackLng: 'en',
    });

    const instance = createInstance();

    expectTypeOf(instance.init).toBeCallableWith(
      {
        fallbackLng: 'en',
        ns: ['file1', 'file2'] as const,
        defaultNS: 'file1',
        debug: true,
      },
      (err, t) => {
        assertType<any>(err);
        assertType<TFunction>(t);
      },
    );
  });

  it('`cloneInstance`', () => {
    expectTypeOf(i18next.cloneInstance().init).toBeCallableWith(
      {
        fallbackLng: 'en',
        ns: ['file1', 'file2'],
        defaultNS: 'file1',
        debug: true,
      },
      (err, t) => {
        assertType<any>(err);
        assertType<TFunction>(t);
      },
    );
  });

  it('`hasLoadedNamespace`', () => {
    expectTypeOf(i18next.hasLoadedNamespace).toBeCallableWith('test-ns');

    expectTypeOf(i18next.hasLoadedNamespace).toBeCallableWith('test-ns', {
      lng: 'en',
    });

    expectTypeOf(i18next.hasLoadedNamespace).toBeCallableWith('test-ns', {
      lng: 'it',
      fallbackLng: 'en',
    });

    expectTypeOf(i18next.hasLoadedNamespace).toBeCallableWith('test-ns', {
      lng: 'it',
      fallbackLng: 'en',
      precheck(i18nPreCheck, loadNotPending) {
        assertType<i18n>(i18nPreCheck);

        type ExpectedLoadNotPending = (
          lng: string | readonly string[],
          ns: string | readonly string[],
        ) => boolean | undefined;
        assertType<ExpectedLoadNotPending>(loadNotPending);

        return false;
      },
    });

    expectTypeOf(i18next.hasLoadedNamespace('test-ns')).toBeBoolean();
  });
});
