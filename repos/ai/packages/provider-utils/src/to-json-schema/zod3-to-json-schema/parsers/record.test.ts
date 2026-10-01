import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseRecordDef } from './record';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('record', () => {
  it('should be possible to describe a simple record', () => {
    const schema = z.record(z.number());

    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
    } satisfies JSONSchema7);
  });
  it('should be possible to describe a simple record with a branded key', () => {
    const schema = z.record(z.string().brand('MyBrand'), z.number());

    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a complex record with checks', () => {
    const schema = z.record(
      z.object({ foo: z.number().min(2) }).catchall(z.string().cuid()),
    );

    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          foo: {
            type: 'number',
            minimum: 2,
          },
        },
        required: ['foo'],
        additionalProperties: {
          type: 'string',
          pattern: '^[cC][^\\s-]{8,}$',
        },
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a key schema', () => {
    const schema = z.record(z.string().uuid(), z.number());

    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      propertyNames: {
        format: 'uuid',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a branded key schema', () => {
    const schema = z.record(
      z.string().regex(/.+/).brand('MyBrandedThingo'),
      z.number(),
    );

    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      propertyNames: {
        pattern: '.+',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a key with an enum', () => {
    const schema = z.record(z.enum(['foo', 'bar']), z.number());
    const parsedSchema = parseRecordDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      additionalProperties: {
        type: 'number',
      },
      propertyNames: {
        enum: ['foo', 'bar'],
      },
    } satisfies JSONSchema7);
  });
});
