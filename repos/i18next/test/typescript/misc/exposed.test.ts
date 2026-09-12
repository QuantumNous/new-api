import { describe, it, assertType, expectTypeOf } from 'vitest';

/** Exercise exposed types/imports for different tsconfig esModuleInterop settings */

/* esModuleInterop: true, allowSyntheticDefaultImports: true */
import i18next, { Interpolator, ResourceStore, Resource, Formatter } from 'i18next';

describe('exposed', () => {
  it('should expose languages', () => {
    expectTypeOf(i18next).toHaveProperty('resolvedLanguage').toEqualTypeOf<string | undefined>();
    expectTypeOf(i18next).toHaveProperty('language').toBeString();
  });

  it('should expose interpolator', () => {
    expectTypeOf(i18next.services).toHaveProperty('interpolator').toEqualTypeOf<Interpolator>();
  });

  it('ResourceStore', () => {
    const resourceStore = i18next.services.resourceStore;

    assertType<ResourceStore>(resourceStore);

    expectTypeOf(resourceStore).toHaveProperty('data').toEqualTypeOf<Resource>();

    type Callback = (lng: string, ns: string) => void;

    expectTypeOf(resourceStore.on).parameters.toMatchTypeOf<['added' | 'removed', Callback]>();
    expectTypeOf(resourceStore.on).returns.toBeVoid();

    expectTypeOf(resourceStore.off).parameter(0).toMatchTypeOf<'added' | 'removed'>();
    expectTypeOf(resourceStore.off).parameter(1).toMatchTypeOf<Callback | undefined>();
    expectTypeOf(resourceStore.off).returns.toBeVoid();
  });

  describe('formatter', () => {
    const formatter = i18next.services.formatter;

    assertType<Formatter | undefined>(formatter);

    expectTypeOf(formatter?.add).parameters.toMatchTypeOf<
      [string, (value: any, lng: string | undefined, options: any) => string]
    >();
    expectTypeOf(formatter?.add).returns.toBeVoid();

    expectTypeOf(formatter?.addCached).parameters.toMatchTypeOf<
      [string, (lng: string | undefined, options: any) => (value: any) => string]
    >();
    expectTypeOf(formatter?.addCached).returns.toBeVoid();
  });

  describe('eventEmitter', () => {
    /**
     * After vitest 2.1 update accessing `parameters` of this `i18next.on` reports an error.
     * Probably it is related to the fact that the function has different overrides.
     * As a workaround we perform the assertions on the "full" function type
     */
    expectTypeOf(i18next.on).toMatchTypeOf<
      (event: string, callback: (...args: unknown[]) => void) => void
    >();

    expectTypeOf(i18next.emit).parameters.toMatchTypeOf<[string, ...unknown[]]>();
    expectTypeOf(i18next.emit).returns.toBeVoid();
  });
});
