import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'custom';
    parseInterpolation: false;
    resources: {
      custom: {
        // ICU MessageFormat strings — the default i18next type extractor would
        // produce phantom variable names from the nested-brace syntax. With
        // `parseInterpolation: false`, the extractor short-circuits and `t()`
        // accepts any options shape for these keys (matching what i18next-icu
        // expects at runtime).
        rows: '{count, plural, one {{count} row} other {{count} rows}}';
        select: '{gender, select, male {his} female {her} other {their}} book';
        plain: 'Just a plain string';
      };
    };
  }
}
