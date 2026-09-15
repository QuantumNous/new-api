import { describe, it, expectTypeOf } from 'vitest';
import type { TFunction } from 'i18next';

declare const t: TFunction<'@repo/ui'>;

describe('ResourceNamespaceMap registry selector (issue #2409)', () => {
  it('resolves keys via selector on registry namespace', () => {
    expectTypeOf(t(($) => $.button_label)).toEqualTypeOf<'Click'>();
    expectTypeOf(t(($) => $.panel.title)).toEqualTypeOf<'Settings'>();
  });
});
