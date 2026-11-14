import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseObjectDef } from './object';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('object', () => {
  it('should be possible to describe catchAll schema', () => {
    const schema = z
      .object({ normalProperty: z.string() })
      .catchall(z.boolean());

    const parsedSchema = parseObjectDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        normalProperty: { type: 'string' },
      },
      required: ['normalProperty'],
      additionalProperties: {
        type: 'boolean',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to use selective partial', () => {
    const schema = z
      .object({ foo: z.boolean(), bar: z.number() })
      .partial({ foo: true });

    const parsedSchema = parseObjectDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['bar'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should allow additional properties unless strict when removeAdditionalStrategy is strict', () => {
    const schema = z.object({ foo: z.boolean(), bar: z.number() });

    const parsedSchema = parseObjectDef(
      schema._def,
      getRefs({ removeAdditionalStrategy: 'strict' }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['foo', 'bar'],
      additionalProperties: true,
    } satisfies JSONSchema7);

    const strictSchema = z
      .object({ foo: z.boolean(), bar: z.number() })
      .strict();

    const parsedStrictSchema = parseObjectDef(
      strictSchema._def,
      getRefs({ removeAdditionalStrategy: 'strict' }),
    );

    expect(parsedStrictSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['foo', 'bar'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should allow additional properties with catchall when removeAdditionalStrategy is strict', () => {
    const schema = z
      .object({ foo: z.boolean(), bar: z.number() })
      .catchall(z.boolean());

    const parsedSchema = parseObjectDef(
      schema._def,
      getRefs({ removeAdditionalStrategy: 'strict' }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['foo', 'bar'],
      additionalProperties: {
        type: 'boolean',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to not set additionalProperties at all when allowed', () => {
    const schema = z
      .object({ foo: z.boolean(), bar: z.number() })
      .passthrough();

    const parsedSchema = parseObjectDef(
      schema._def,
      getRefs({
        removeAdditionalStrategy: 'passthrough',
        allowedAdditionalProperties: undefined,
      }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['foo', 'bar'],
    } satisfies JSONSchema7);
  });

  it('should be possible to not set additionalProperties at all when rejected', () => {
    const schema = z.object({ foo: z.boolean(), bar: z.number() }).strict();

    const parsedSchema = parseObjectDef(
      schema._def,
      getRefs({
        removeAdditionalStrategy: 'passthrough',
        rejectedAdditionalProperties: undefined,
      }),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        foo: { type: 'boolean' },
        bar: { type: 'number' },
      },
      required: ['foo', 'bar'],
    } satisfies JSONSchema7);
  });
});
