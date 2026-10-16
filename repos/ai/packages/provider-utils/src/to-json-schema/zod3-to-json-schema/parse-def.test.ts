import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseDef } from './parse-def';
import { getRefs } from './refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('parseDef', () => {
  it('should return a proper json schema with some common types without validation', () => {
    const zodSchema = z.object({
      requiredString: z.string(),
      optionalString: z.string().optional(),
      literalString: z.literal('literalStringValue'),
      stringArray: z.array(z.string()),
      stringEnum: z.enum(['stringEnumOptionA', 'stringEnumOptionB']),
      tuple: z.tuple([z.string(), z.number(), z.boolean()]),
      record: z.record(z.boolean()),
      requiredNumber: z.number(),
      optionalNumber: z.number().optional(),
      numberOrNull: z.number().nullable(),
      numberUnion: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      mixedUnion: z.union([
        z.literal('abc'),
        z.literal(123),
        z.object({ nowItGetsAnnoying: z.literal(true) }),
      ]),
      objectOrNull: z.object({ myString: z.string() }).nullable(),
      passthrough: z.object({ myString: z.string() }).passthrough(),
    });

    const parsedSchema = parseDef(zodSchema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        requiredString: {
          type: 'string',
        },
        optionalString: {
          type: 'string',
        },
        literalString: {
          type: 'string',
          const: 'literalStringValue',
        },
        stringArray: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        stringEnum: {
          type: 'string',
          enum: ['stringEnumOptionA', 'stringEnumOptionB'],
        },
        tuple: {
          type: 'array',
          minItems: 3,
          items: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
            {
              type: 'boolean',
            },
          ],
          maxItems: 3,
        },
        record: {
          type: 'object',
          additionalProperties: {
            type: 'boolean',
          },
        },
        requiredNumber: {
          type: 'number',
        },
        optionalNumber: {
          type: 'number',
        },
        numberOrNull: {
          type: ['number', 'null'],
        },
        numberUnion: {
          type: 'number',
          enum: [1, 2, 3],
        },
        mixedUnion: {
          anyOf: [
            {
              type: 'string',
              const: 'abc',
            },
            {
              type: 'number',
              const: 123,
            },
            {
              type: 'object',
              properties: {
                nowItGetsAnnoying: {
                  type: 'boolean',
                  const: true,
                },
              },
              required: ['nowItGetsAnnoying'],
              additionalProperties: false,
            },
          ],
        },
        objectOrNull: {
          anyOf: [
            {
              type: 'object',
              properties: {
                myString: {
                  type: 'string',
                },
              },
              required: ['myString'],
              additionalProperties: false,
            },
            {
              type: 'null',
            },
          ],
        },
        passthrough: {
          type: 'object',
          properties: {
            myString: {
              type: 'string',
            },
          },
          required: ['myString'],
          additionalProperties: true,
        },
      },
      required: [
        'requiredString',
        'literalString',
        'stringArray',
        'stringEnum',
        'tuple',
        'record',
        'requiredNumber',
        'numberOrNull',
        'numberUnion',
        'mixedUnion',
        'objectOrNull',
        'passthrough',
      ],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should handle a nullable string properly', () => {
    const shorthand = z.string().nullable();
    const union = z.union([z.string(), z.null()]);

    expect(parseDef(shorthand._def, getRefs())).toStrictEqual({
      type: ['string', 'null'],
    } satisfies JSONSchema7);
    expect(parseDef(union._def, getRefs())).toStrictEqual({
      type: ['string', 'null'],
    } satisfies JSONSchema7);
  });

  it('should be possible to use branded string', () => {
    const schema = z.string().brand<'x'>();
    const parsedSchema = parseDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });

  it('should be possible to use readonly', () => {
    const parsedSchema = parseDef(z.object({}).readonly()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {},
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should be possible to use catch', () => {
    const parsedSchema = parseDef(z.number().catch(5)._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'number',
    } satisfies JSONSchema7);
  });

  it('should be possible to use pipeline', () => {
    const schema = z.number().pipe(z.number().int());

    expect(parseDef(schema._def, getRefs())).toStrictEqual({
      allOf: [{ type: 'number' }, { type: 'integer' }],
    } satisfies JSONSchema7);
  });

  it('should get undefined for function', () => {
    const parsedSchema = parseDef(z.function()._def, getRefs());
    expect(parsedSchema).toBeUndefined();
  });

  it('should get undefined for void', () => {
    const parsedSchema = parseDef(z.void()._def, getRefs());
    expect(parsedSchema).toBeUndefined();
  });

  it('nested lazy', () => {
    const zodSchema = z.lazy(() => z.lazy(() => z.string()));
    const parsed = parseDef(zodSchema._def, getRefs());

    expect(parsed).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });
});
