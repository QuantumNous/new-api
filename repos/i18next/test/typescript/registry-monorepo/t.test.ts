import { describe, it, assertType, expectTypeOf } from 'vitest';
import type {
  TFunction,
  ResourceNamespaceMap,
  CustomTypeOptions,
  FlatNamespace,
  TypeOptions,
} from 'i18next';

describe('ResourceNamespaceMap registry (issue #2409)', () => {
  describe('package-ui (@repo/ui)', () => {
    const t = (() => '') as TFunction<'@repo/ui'>;

    it('types keys from the registry', () => {
      expectTypeOf(t('button_label')).toEqualTypeOf<'Click'>();
      expectTypeOf(t('panel.title')).toEqualTypeOf<'Settings'>();
    });

    it('rejects unknown keys', () => {
      // @ts-expect-error not in '@repo/ui' namespace
      assertType(t('not_a_key'));
    });
  });

  describe('package-common (second registry file)', () => {
    const t = (() => '') as TFunction<'common'>;

    it('merges with package-ui in the same program', () => {
      expectTypeOf(t('hello', { name: 'world' })).toEqualTypeOf<'Hello {{name}}'>();
      expectTypeOf(t('farewell')).toEqualTypeOf<'Goodbye'>();
    });
  });

  describe('package-app-legacy (CustomTypeOptions.resources)', () => {
    const t = (() => '') as TFunction<'app-feature'>;

    it('still works next to registry namespaces', () => {
      expectTypeOf(t('landing_title')).toEqualTypeOf<'Welcome to the app'>();
    });

    it('rejects keys from other namespaces', () => {
      // @ts-expect-error 'button_label' belongs to '@repo/ui'
      assertType(t('button_label'));
    });
  });

  describe('overlap namespace (registry + legacy on one ns)', () => {
    const t = (() => '') as TFunction<'overlap'>;

    it('picks up registry-only keys', () => {
      expectTypeOf(t('registry_only')).toEqualTypeOf<'from registry'>();
    });

    it('picks up legacy-only keys', () => {
      expectTypeOf(t('legacy_only')).toEqualTypeOf<'from legacy'>();
    });

    it('keeps a key when both sides agree on the literal', () => {
      expectTypeOf(t('shared_literal')).toEqualTypeOf<'same value'>();
    });

    it('merges both halves into TypeOptions.resources.overlap', () => {
      type OverlapNs = TypeOptions['resources']['overlap'];
      type ExpectedKeys = 'registry_only' | 'legacy_only' | 'shared_literal';
      assertType<keyof OverlapNs>('' as ExpectedKeys);
      assertType<ExpectedKeys>('' as keyof OverlapNs);
      expectTypeOf<OverlapNs['shared_literal']>().toEqualTypeOf<'same value'>();
    });

    it('drops same-key/different-literal conflicts from the merged namespace', () => {
      // `shared_conflict` is 'A' in legacy and 'B' in registry. Without
      // filtering, the entire `overlap` namespace would collapse to `never`
      // (TS reduces `{ x:'A' } & { x:'B' }` to `never`) and poison `t()`
      // overload resolution.
      // @ts-expect-error 'shared_conflict' is dropped because legacy says 'A', registry says 'B'
      assertType(t('shared_conflict'));
    });
  });

  describe('FlatNamespace', () => {
    it('lists every namespace from registry and legacy', () => {
      type Expected = '@repo/ui' | 'common' | 'app-feature' | 'overlap';
      assertType<FlatNamespace>('' as Expected);
      assertType<Expected>('' as FlatNamespace);
    });
  });

  describe('default namespace via CustomTypeOptions still applies', () => {
    const t = (() => '') as TFunction;

    it('uses the default namespace declared in package-common.d.ts', () => {
      expectTypeOf(t('hello', { name: 'world' })).toEqualTypeOf<'Hello {{name}}'>();
      expectTypeOf(t('farewell')).toEqualTypeOf<'Goodbye'>();
    });
  });

  describe('exports', () => {
    it('ResourceNamespaceMap', () => {
      const registry: ResourceNamespaceMap = {} as ResourceNamespaceMap;
      assertType<ResourceNamespaceMap>(registry);
    });

    it('CustomTypeOptions', () => {
      const opts: CustomTypeOptions = {} as CustomTypeOptions;
      assertType<CustomTypeOptions>(opts);
    });
  });
});
