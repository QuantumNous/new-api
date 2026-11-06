import { describe, it, expectTypeOf } from 'vitest';
import { useTranslation } from 'react-i18next';

describe('useTranslation with defaultNS: false', () => {
  describe('namespace as array with explicit ns in selector call', () => {
    it('should work with explicit ns option', () => {
      const [t] = useTranslation(['ns1']);

      expectTypeOf(t(($) => $.prova, { ns: 'ns1' })).toEqualTypeOf<'prova 1'>();
    });

    it('should work with nested keys and explicit ns option', () => {
      const [t] = useTranslation(['ns1']);

      expectTypeOf(t(($) => $.job_details.title, { ns: 'ns1' })).toEqualTypeOf<'sample test'>();
    });
  });

  describe('namespace as array with options but no keyPrefix', () => {
    it('should not break selector types when options are passed without keyPrefix', () => {
      const { t } = useTranslation(['ns1'], { useSuspense: false });

      expectTypeOf(t(($) => $.prova, { ns: 'ns1' })).toEqualTypeOf<'prova 1'>();
    });
  });

  describe('named namespace', () => {
    it('should work with a single named namespace', () => {
      const [t] = useTranslation('ns1');

      expectTypeOf(t(($) => $.prova)).toEqualTypeOf<'prova 1'>();
      expectTypeOf(t(($) => $.job_details.title)).toEqualTypeOf<'sample test'>();
    });
  });
});
