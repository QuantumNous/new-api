import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction, KeyPrefix, Namespace } from 'i18next';

describe('keyPrefix return type (#2434 regression)', () => {
  it('resolves a leaf key to its exact value, not a union with sibling keys', () => {
    // Mirrors how `react-i18next`'s `useTranslation(ns, { keyPrefix })` composes
    // i18next's public types: `KPrefix` is constrained to `KeyPrefix<Ns>` and
    // inferred from an options-object property. This is the surface that
    // regressed in 26.3.0 (#2434); `getFixedT` takes `keyPrefix` positionally
    // and is unaffected, hence the local helper.
    const useTranslation = <Ns extends Namespace, KPrefix extends KeyPrefix<Ns> = undefined>(
      _: Ns,
      __: {
        keyPrefix?: KPrefix;
      },
      // @ts-expect-error we only care about typing here, not about actual returns
    ): { t: TFunction<Ns, KPrefix> } => undefined;

    const { t } = useTranslation('app', { keyPrefix: 'settings.profile' });

    // Before the fix this was inferred as `'Profile' | { on: 'On'; off: 'Off' }`,
    // unioning the sibling `settings.notifications.title` object.
    expectTypeOf(t('title')).toEqualTypeOf<'Profile'>();
    expectTypeOf(t('description')).toEqualTypeOf<'Manage your profile'>();
  });
});
