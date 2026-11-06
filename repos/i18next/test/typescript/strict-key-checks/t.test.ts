import { describe, it, expectTypeOf, assertType } from 'vitest';
import { TFunction } from 'i18next';

describe('basic usage with strictKeyChecks == true', () => {
  const t = (() => '') as unknown as TFunction<'alternate'>;

  it('should resolve to the correct type when `defaultValue` is provided and key exists', () => {
    expectTypeOf(t('foobar.barfoo')).toMatchTypeOf<'barfoo'>();
    expectTypeOf(
      t('foobar.barfoo', { defaultValue: 'some default value' }),
    ).toMatchTypeOf<'barfoo'>();
    expectTypeOf(t('foobar.barfoo', 'some default value')).toMatchTypeOf<'barfoo'>();
  });

  it('should throw an error even if `defaultValue` is provided when key is missing', () => {
    // @ts-expect-error
    assertType(t('new.key'));
    // @ts-expect-error
    assertType(t('new.key', 'some default value'));
    // @ts-expect-error
    assertType(t('new.key', { defaultValue: 'some default value' }));
  });

  it('should work alongside `returnObjects`', () => {
    expectTypeOf(t('foobar', { returnObjects: true })).toMatchTypeOf<{
      barfoo: 'barfoo';
      deep: {
        deeper: {
          deeeeeper: 'foobar';
        };
      };
    }>();

    expectTypeOf(t('foobar', 'some default value', { returnObjects: true })).toMatchTypeOf<{
      barfoo: 'barfoo';
      deep: {
        deeper: {
          deeeeeper: 'foobar';
        };
      };
    }>();

    expectTypeOf(
      t('foobar', { returnObjects: true, defaultValue: 'some default value' }),
    ).toMatchTypeOf<{
      barfoo: 'barfoo';
      deep: {
        deeper: {
          deeeeeper: 'foobar';
        };
      };
    }>();

    expectTypeOf(
      // @ts-expect-error
      t('nonExistent', 'some default value', {
        returnObjects: true,
        defaultValue: 'some default value',
      }),
    );
    // @ts-expect-error
    expectTypeOf(t('nonExistent', { returnObjects: true, defaultValue: 'some default value' }));
  });
});

describe('basic array access with strictKeyChecks == true', () => {
  const t = (() => '') as unknown as TFunction<['arrayKeys']>;

  it('works with simple usage', () => {
    expectTypeOf(t('arrayOfStrings.0')).toEqualTypeOf<'zero'>();
    expectTypeOf(t('arrayOfObjects.2.0.test', 'some default value')).toEqualTypeOf<'success'>();
    expectTypeOf(
      t('arrayOfObjects.2.0.sub.deep', { defaultValue: 'some default value' }),
    ).toEqualTypeOf<'still success'>();
  });

  it('should throw an error when key is not present', () => {
    // @ts-expect-error
    assertType(t('arrayOfStrings.2'));
    // @ts-expect-error
    assertType(t('arrayOfStrings.2', 'some default value'));
    // @ts-expect-error
    assertType(t('arrayOfStrings.2', { defaultValue: 'some default value' }));
    // @ts-expect-error
    assertType(t('arrayOfObjects.2.sub.deep'));
    // @ts-expect-error
    assertType(t('arrayOfObjects.2.sub.deep', 'some default value'));
    // @ts-expect-error
    assertType(t('arrayOfObjects.2.test', { defaultValue: 'some default value' }));
  });

  it('should work with `returnObjects`', () => {
    expectTypeOf(t('arrayOfStrings', { returnObjects: true })).toBeArray();
    expectTypeOf(t('arrayOfObjects', { returnObjects: true })).toEqualTypeOf<
      [{ foo: 'bar' }, { fizz: 'buzz' }, [{ test: 'success'; sub: { deep: 'still success' } }]]
    >();
    expectTypeOf(t('arrayOfObjects.0', { returnObjects: true })).toEqualTypeOf<{ foo: 'bar' }>();

    // @ts-expect-error
    expectTypeOf(t('nonExistent', 'some default value', { returnObjects: true }));
    // @ts-expect-error
    expectTypeOf(t('nonExistent', { returnObjects: true, defaultValue: 'some default value' }));
  });
});

describe('interpolation values with strictKeyChecks == true', () => {
  const t = (() => '') as unknown as TFunction<['interpolators']>;

  it('should allow anything when key is a string', () => {
    expectTypeOf(t('just_a_string', { asd: '', beep: 'boop' }));
    expectTypeOf(t('just_a_string', 'some default value', { asd: '', beep: 'boop' }));
  });

  it('simple key', () => {
    expectTypeOf(t('simple')).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(t('simple', { olim: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(
      t('simple', 'some default value', { olim: 'yes' }),
    ).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(
      t('simple', { olim: 'yes', defaultValue: 'other default value' }),
    ).toEqualTypeOf<'This is {{olim}}'>();

    // @ts-expect-error because nope isn't a valid key
    expectTypeOf(t('simple', { nope: 'yes' })).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(
      // @ts-expect-error because nope isn't a valid key
      t('simple', 'some default value', { nope: 'yes' }),
    ).toEqualTypeOf<'This is {{olim}}'>();
    expectTypeOf(
      // @ts-expect-error because nope isn't a valid key
      t('simple', { nope: 'yes', defaultValue: 'other default value' }),
    ).toEqualTypeOf<'This is {{olim}}'>();

    // @ts-expect-error because nonexisting isn't found in namespace
    expectTypeOf(t('nonexisting', { nope: 'yes' }));
  });

  it('simple key (multiple)', () => {
    type Expected = 'This has {{more}} than {{one}}';
    expectTypeOf(t('simple_multiple_keys', { more: '', one: '' })).toEqualTypeOf<Expected>();

    expectTypeOf(
      t('simple_multiple_keys', 'some default value', { more: '', one: '' }),
    ).toEqualTypeOf<Expected>();
    expectTypeOf(
      t('simple_multiple_keys', 'some default value', {
        more: '',
        one: '',
        defaultValue: 'some default value',
      }),
    ).toEqualTypeOf<Expected>();

    // @ts-expect-error one of the required keys is missing
    expectTypeOf(t('simple_multiple_keys', { less: '', one: '' })).toEqualTypeOf<Expected>();

    expectTypeOf(
      // @ts-expect-error one of the required keys is missing
      t('simple_multiple_keys', 'some default value', { less: '', one: '' }),
    ).toEqualTypeOf<Expected>();

    expectTypeOf(
      // @ts-expect-error one of the required keys is missing
      t('simple_multiple_keys', { less: '', one: '', defaultValue: 'some default value' }),
    ).toEqualTypeOf<Expected>();

    // @ts-expect-error because nonexisting isn't found in namespace
    expectTypeOf(t('nonexisting', { less: '', one: '' }));
  });
});
