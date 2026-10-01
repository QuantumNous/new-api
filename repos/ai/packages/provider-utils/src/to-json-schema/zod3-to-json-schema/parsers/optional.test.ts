import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseDef } from '../parse-def';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('Standalone optionals', () => {
  it('should work as unions with undefined', () => {
    const parsedSchema = parseDef(z.string().optional()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      anyOf: [
        {
          not: {},
        },
        {
          type: 'string',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should work as unions with void', () => {
    const parsedSchema = parseDef(z.void().optional()._def, getRefs());

    expect(parsedSchema).toStrictEqual({} satisfies JSONSchema7);
  });

  it('should not affect object properties', () => {
    const parsedSchema = parseDef(
      z.object({ myProperty: z.string().optional() })._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        myProperty: {
          type: 'string',
        },
      },
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should work with nested properties', () => {
    const parsedSchema = parseDef(
      z.object({ myProperty: z.string().optional().array() })._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        myProperty: {
          type: 'array',
          items: {
            anyOf: [{ not: {} }, { type: 'string' }],
          },
        },
      },
      required: ['myProperty'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should work with nested properties as object properties', () => {
    const parsedSchema = parseDef(
      z.object({
        myProperty: z.object({ myInnerProperty: z.string().optional() }),
      })._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        myProperty: {
          type: 'object',
          properties: {
            myInnerProperty: {
              type: 'string',
            },
          },
          additionalProperties: false,
        },
      },
      required: ['myProperty'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should work with nested properties with nested object property parents', () => {
    const parsedSchema = parseDef(
      z.object({
        myProperty: z.object({
          myInnerProperty: z.string().optional().array(),
        }),
      })._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'object',
      properties: {
        myProperty: {
          type: 'object',
          properties: {
            myInnerProperty: {
              type: 'array',
              items: {
                anyOf: [
                  { not: {} },
                  {
                    type: 'string',
                  },
                ],
              },
            },
          },
          required: ['myInnerProperty'],
          additionalProperties: false,
        },
      },
      required: ['myProperty'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });

  it('should work with ref pathing', () => {
    const recurring = z.string();

    const schema = z.tuple([recurring.optional(), recurring]);

    const parsedSchema = parseDef(schema._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      minItems: 2,
      maxItems: 2,
      items: [
        { anyOf: [{ not: {} }, { type: 'string' }] },
        { $ref: '#/items/0/anyOf/1' },
      ],
    } satisfies JSONSchema7);
  });
});
