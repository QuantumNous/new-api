import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { parseNumberDef } from './number';

describe('number', () => {
  it('should be possible to describe minimum number', () => {
    const parsedSchema = parseNumberDef(z.number().min(5)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      minimum: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe maximum number', () => {
    const parsedSchema = parseNumberDef(z.number().max(5)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      maximum: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe both minimum and maximum number', () => {
    const parsedSchema = parseNumberDef(z.number().min(5).max(5)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      minimum: 5,
      maximum: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe an integer', () => {
    const parsedSchema = parseNumberDef(z.number().int()._def);

    expect(parsedSchema).toStrictEqual({
      type: 'integer',
    } satisfies JSONSchema7);
  });

  it('should be possible to describe multiples of n', () => {
    const parsedSchema = parseNumberDef(z.number().multipleOf(2)._def);

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      multipleOf: 2,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe positive, negative, nonpositive and nonnegative numbers', () => {
    const parsedSchema = parseNumberDef(
      z.number().positive().negative().nonpositive().nonnegative()._def,
    );

    expect(parsedSchema).toStrictEqual({
      type: 'number',
      minimum: 0,
      maximum: 0,
      exclusiveMaximum: 0,
      exclusiveMinimum: 0,
    } satisfies JSONSchema7);
  });
});
