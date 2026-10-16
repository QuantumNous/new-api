import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { parseBigintDef } from './bigint';

describe('bigint', () => {
  it('should be possible to use bigint', () => {
    const parsedSchema = parseBigintDef(z.bigint()._def);

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'int64',
    } satisfies JSONSchema7);
  });

  it('should be possible to define gt/lt', () => {
    const parsedSchema = parseBigintDef(
      z.bigint().gte(BigInt(10)).lte(BigInt(20))._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'int64',
      minimum: BigInt(10) as any, // json schema type does not support bigint
      maximum: BigInt(20) as any, // json schema type does not support bigint
    } satisfies JSONSchema7);
  });

  it('should be possible to define gt/lt', () => {
    const parsedSchema = parseBigintDef(
      z.bigint().gt(BigInt(10)).lt(BigInt(20))._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'int64',
      exclusiveMinimum: BigInt(10) as any, // json schema type does not support bigint
      exclusiveMaximum: BigInt(20) as any, // json schema type does not support bigint
    } satisfies JSONSchema7);
  });

  it('should be possible to define multipleOf', () => {
    const parsedSchema = parseBigintDef(z.bigint().multipleOf(BigInt(5))._def);

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
      format: 'int64',
      multipleOf: BigInt(5) as any, // json schema type does not support bigint
    } satisfies JSONSchema7);
  });
});
