import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseNativeEnumDef } from './native-enum';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('native enum', () => {
  it('should be possible to convert a basic native number enum', () => {
    enum MyEnum {
      val1,
      val2,
      val3,
    }

    const parsedSchema = parseNativeEnumDef(z.nativeEnum(MyEnum)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      enum: [0, 1, 2],
    } satisfies JSONSchema7);
  });

  it('should be possible to convert a native string enum', () => {
    enum MyEnum {
      val1 = 'a',
      val2 = 'b',
      val3 = 'c',
    }

    const parsedSchema = parseNativeEnumDef(z.nativeEnum(MyEnum)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      enum: ['a', 'b', 'c'],
    } satisfies JSONSchema7);
  });

  it('should be possible to convert a mixed value native enum', () => {
    enum MyEnum {
      val1 = 'a',
      val2 = 1,
      val3 = 'c',
    }

    const parsedSchema = parseNativeEnumDef(z.nativeEnum(MyEnum)._def);

    expect(parsedSchema).toStrictEqual({
      type: ['string', 'number'],
      enum: ['a', 1, 'c'],
    } satisfies JSONSchema7);
  });

  it('should be possible to convert a native const assertion object', () => {
    const MyConstAssertionObject = {
      val1: 0,
      val2: 1,
      val3: 2,
    } as const;

    const parsedSchema = parseNativeEnumDef(
      z.nativeEnum(MyConstAssertionObject)._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      enum: [0, 1, 2],
    } satisfies JSONSchema7);
  });

  it('should be possible to convert a native const assertion string object', () => {
    const MyConstAssertionObject = {
      val1: 'a',
      val2: 'b',
      val3: 'c',
    } as const;

    const parsedSchema = parseNativeEnumDef(
      z.nativeEnum(MyConstAssertionObject)._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      enum: ['a', 'b', 'c'],
    } satisfies JSONSchema7);
  });

  it('should be possible to convert a mixed value native const assertion string object', () => {
    const MyConstAssertionObject = {
      val1: 'a',
      val2: 1,
      val3: 'c',
    } as const;

    const parsedSchema = parseNativeEnumDef(
      z.nativeEnum(MyConstAssertionObject)._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: ['string', 'number'],
      enum: ['a', 1, 'c'],
    } satisfies JSONSchema7);
  });
});
