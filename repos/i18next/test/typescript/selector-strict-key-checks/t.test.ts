import { describe, it, expectTypeOf, assertType } from 'vitest';
import { TFunction } from 'i18next';

describe('basic usage with strictKeyChecks == true', () => {
  const t: TFunction<'alternate'> = (() => '') as never;

  it('should resolve to the correct type when `defaultValue` is provided and key exists', () => {
    expectTypeOf(t(($) => $.foobar.barfoo)).toEqualTypeOf<'barfoo'>();
    expectTypeOf(t(($) => $.foobar.barfoo, { defaultValue: 'some default value' })).toEqualTypeOf<
      'barfoo' | 'some default value'
    >();
  });

  it('should throw an error when key is missing (even when `defaultValue` is provided)', () => {
    // @ts-expect-error
    assertType(t(($) => $.new));
    // @ts-expect-error
    assertType(t(($) => $.new, { defaultValue: 'some default value' }));
  });

  it('should work alongside `returnObjects`', () => {
    expectTypeOf(t(($) => $.foobar, { returnObjects: true })).toEqualTypeOf<{
      barfoo: 'barfoo';
      deep: {
        deeper: {
          deeeeeper: 'foobar';
        };
      };
    }>();

    expectTypeOf(
      t(($) => $.foobar, { returnObjects: true, defaultValue: 'some default value' }),
    ).toEqualTypeOf<
      | 'some default value'
      | {
          barfoo: 'barfoo';
          deep: {
            deeper: {
              deeeeeper: 'foobar';
            };
          };
        }
    >();

    expectTypeOf(
      // @ts-expect-error
      t(($) => $.nonExistent, { returnObjects: true, defaultValue: 'some default value' }),
    );
  });
});

describe('basic array access with strictKeyChecks == true', () => {
  const t: TFunction<['arrayKeys']> = (() => '') as never;

  it('works with simple usage', () => {
    expectTypeOf(t(($) => $.arrayOfStrings[0])).toEqualTypeOf<'zero'>();
    expectTypeOf(
      t(($) => $.arrayOfObjects[2][0].test, { defaultValue: 'some default value' }),
    ).toEqualTypeOf<'success' | 'some default value'>();
    expectTypeOf(
      t(($) => $.arrayOfObjects[2][0].sub.deep, { defaultValue: 'some default value' }),
    ).toEqualTypeOf<'still success' | 'some default value'>();
  });

  it('should throw an error when key is not present', () => {
    // @ts-expect-error
    assertType(t(($) => $.arrayOfStrings[2]));
    // @ts-expect-error
    assertType(t(($) => $.arrayOfStrings[2], { defaultValue: 'some default value' }));
    // @ts-expect-error
    assertType(t(($) => $.arrayOfObjects[2].sub.deep));
    // @ts-expect-error
    assertType(t(($) => $.arrayOfObjects[2].test, { defaultValue: 'some default value' }));
  });

  it('should work with `returnObjects`', () => {
    expectTypeOf(t(($) => $.arrayOfStrings, { returnObjects: true })).toBeArray();
    expectTypeOf(t(($) => $.arrayOfObjects, { returnObjects: true })).toEqualTypeOf<
      [{ foo: 'bar' }, { fizz: 'buzz' }, [{ test: 'success'; sub: { deep: 'still success' } }]]
    >();
    expectTypeOf(t(($) => $.arrayOfObjects[0], { returnObjects: true })).toEqualTypeOf<{
      foo: 'bar';
    }>();

    expectTypeOf(
      // @ts-expect-error
      t(($) => $.nonExistent, { returnObjects: true, defaultValue: 'some default value' }),
    );
  });
});

describe('interpolation values with strictKeyChecks == true', () => {
  const t: TFunction<['interpolators']> = (() => '') as never;

  it('should allow anything when key is a string', () => {
    expectTypeOf(t(($) => $.just_a_string, { asd: '', beep: 'boop' })).toEqualTypeOf<string>();
    expectTypeOf(
      t(($) => $.just_a_string, { asd: '', beep: 'boop', defaultValue: 'some default value' }),
    ).toEqualTypeOf<string>();
  });

  it('simple key', () => {
    expectTypeOf(t(($) => $.simple)).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(t(($) => $.simple, { olim: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(
      t(($) => $.simple, { olim: 'yes', defaultValue: 'other default value' }),
    ).toEqualTypeOf<'This is {{olim}}' | 'other default value'>();

    // @ts-expect-error because nope isn't a valid key
    expectTypeOf(t(($) => $.simple, { nope: 'yes' })).toEqualTypeOf<string>();
    expectTypeOf(
      // @ts-expect-error because nope isn't a valid key
      t(($) => $.simple, { nope: 'yes', defaultValue: 'some default value' }),
    ).toEqualTypeOf<string>();
    expectTypeOf(
      // @ts-expect-error because nope isn't a valid key
      t(($) => $.simple, { nope: 'yes', defaultValue: 'other default value' }),
    ).toEqualTypeOf<string>();

    // @ts-expect-error because nonexisting isn't found in namespace
    expectTypeOf(t(($) => $.nonexisting, { nope: 'yes' }));
  });
});
