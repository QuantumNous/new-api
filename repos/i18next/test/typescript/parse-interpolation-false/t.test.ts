import { describe, it } from 'vitest';
import type { TFunction } from 'i18next';

// `parseInterpolation: false` short-circuits the type-level extraction of
// interpolation variables. Use case: ICU MessageFormat strings (via the
// i18next-icu plugin) — the default extractor would treat the outermost `{{`
// in `{count, plural, one {{count} row} other {{count} rows}}` as the start of
// an i18next interpolation and demand a phantom variable name spanning the
// rest of the string.
//
// With the flag off, `t()` accepts arbitrary options for any key.

describe('parseInterpolation: false (ICU-friendly)', () => {
  const t: TFunction<'custom'> = (() => '') as never;

  it('accepts t calls on ICU plural strings without phantom variable types', () => {
    // No "{{count} row} other {{count} rows" phantom variable demanded.
    t('rows', { count: 1 });
    t('rows', { count: 42 });
  });

  it('accepts t calls on ICU select strings', () => {
    t('select', { gender: 'male' });
    t('select', { gender: 'female' });
  });

  it('still works for keys with no interpolation', () => {
    t('plain');
  });

  it('accepts arbitrary additional options (extraction is disabled)', () => {
    // No type-checking of option shape; we don't want false positives from
    // the i18next extractor on ICU strings.
    t('rows', { count: 5, foo: 'bar', anything: 123 });
  });

  it('does NOT demand the phantom variable from ICU plural syntax', () => {
    // Regression for i18next-icu#85. Default extraction would parse the
    // outermost `{{` … `}}` and produce the phantom variable
    //   `count} row} other {{count} rows`
    // demanding it on every `t('rows', …)` call. With parseInterpolation off,
    // no such property is required.
    t('rows', { count: 1 }); // no error
  });
});
