import { describe, it, assertType, expectTypeOf } from 'vitest';
import i18next, {
  Modules,
  BackendModule,
  LanguageDetectorModule,
  LoggerModule,
  I18nFormatModule,
  ThirdPartyModule,
  FormatterModule,
  LanguageDetectorAsyncModule,
} from 'i18next';

describe('modules', () => {
  describe('module types', () => {
    it('BackendModule', () => {
      assertType<BackendModule>({
        type: 'backend',
        init: () => null,
        read: (_language, _namespace, callback) => {
          callback(null, {
            key: 'value',
          });
        },
        create: () => null,
        readMulti: (_languages, _namespaces, callback) => {
          callback(null, {
            en: {
              namespace: {
                key: 'value',
              },
            },
          });
        },
        save: () => null,
      });

      expectTypeOf(i18next.use<BackendModule>)
        .parameter(0)
        .extract<BackendModule>()
        .toMatchTypeOf<BackendModule>();
    });

    it('LanguageDetectorModule', () => {
      assertType<LanguageDetectorModule>({
        type: 'languageDetector',
        init: () => null,
        detect: () => '',
        cacheUserLanguage: () => null,
      });

      expectTypeOf(i18next.use<LanguageDetectorModule>)
        .parameter(0)
        .extract<LanguageDetectorModule>()
        .toMatchTypeOf<LanguageDetectorModule>();
    });

    it('LanguageDetectorModule', () => {
      assertType<LanguageDetectorAsyncModule>({
        type: 'languageDetector',
        async: true,
        init: () => null,
        detect: () => Promise.resolve(''),
        cacheUserLanguage: () => Promise.resolve(),
      });

      expectTypeOf(i18next.use<LanguageDetectorAsyncModule>)
        .parameter(0)
        .extract<LanguageDetectorAsyncModule>()
        .toMatchTypeOf<LanguageDetectorAsyncModule>();
    });

    describe('LoggerModule', () => {
      it('as object', () => {
        assertType<LoggerModule>({
          type: 'logger',
          log: () => null,
          warn: () => null,
          error: () => null,
        });

        expectTypeOf(i18next.use<LoggerModule>)
          .parameter(0)
          .extract<LoggerModule>()
          .toMatchTypeOf<LoggerModule>();
      });

      it('as class', () => {
        // exercise class usage
        // Need both static and member definitions of type to satisfy use() signature, see #1442
        class MyLoggerModule implements LoggerModule {
          static type = 'logger' as const;

          type = 'logger' as const;

          log = () => null;

          warn = () => null;

          error = () => null;
        }

        expectTypeOf(i18next.use<MyLoggerModule>)
          .parameter(0)
          .extract<MyLoggerModule>()
          .toMatchTypeOf<MyLoggerModule>();
      });
    });

    it('I18nFormatModule', () => {
      assertType<I18nFormatModule>({
        type: 'i18nFormat',
      });

      expectTypeOf(i18next.use<I18nFormatModule>)
        .parameter(0)
        .extract<I18nFormatModule>()
        .toMatchTypeOf<I18nFormatModule>();
    });

    it('FormatterModule', () => {
      assertType<FormatterModule>({
        type: 'formatter',
        init: () => null,
        add: () => null,
        addCached: () => () => null,
        format: () => '',
      });

      expectTypeOf(i18next.use<FormatterModule>)
        .parameter(0)
        .extract<FormatterModule>()
        .toMatchTypeOf<FormatterModule>();
    });

    it('ThirdPartyModule', () => {
      assertType<ThirdPartyModule>({
        type: '3rdParty',
        init: () => null,
      });

      expectTypeOf(i18next.use<ThirdPartyModule>)
        .parameter(0)
        .extract<ThirdPartyModule>()
        .toMatchTypeOf<ThirdPartyModule>();
    });
  });

  it('Modules', () => {
    expectTypeOf<Modules>()
      .toHaveProperty('backend')
      .exclude<undefined>()
      .toEqualTypeOf<BackendModule>();

    expectTypeOf<Modules>()
      .toHaveProperty('languageDetector')
      .exclude<undefined>()
      .toEqualTypeOf<LanguageDetectorModule | LanguageDetectorAsyncModule>();

    expectTypeOf<Modules>()
      .toHaveProperty('i18nFormat')
      .exclude<undefined>()
      .toEqualTypeOf<I18nFormatModule>();

    expectTypeOf<Modules>()
      .toHaveProperty('logger')
      .exclude<undefined>()
      .toEqualTypeOf<LoggerModule>();

    expectTypeOf<Modules>()
      .toHaveProperty('formatter')
      .exclude<undefined>()
      .toEqualTypeOf<FormatterModule>();

    expectTypeOf<Modules>()
      .toHaveProperty('external')
      .exclude<undefined>()
      .toEqualTypeOf<ThirdPartyModule[]>();
  });
});
