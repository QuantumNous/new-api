import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { parseArrayDef } from './array';
import { getRefs } from '../refs';

describe('array', () => {
  it('should be possible to describe a simple array', () => {
    const parsedSchema = parseArrayDef(z.array(z.string())._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      items: {
        type: 'string',
      },
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a simple array with any item', () => {
    const parsedSchema = parseArrayDef(z.array(z.any())._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'array',
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a string array with a minimum and maximum length', () => {
    const parsedSchema = parseArrayDef(
      z.array(z.string()).min(2).max(4)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 2,
      maxItems: 4,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a string array with an exact length', () => {
    const parsedSchema = parseArrayDef(
      z.array(z.string()).length(5)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 5,
      maxItems: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe a string array with a minimum length of 1 by using nonempty', () => {
    const parsedSchema = parseArrayDef(
      z.array(z.any()).nonempty()._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'array',
      minItems: 1,
    } satisfies JSONSchema7);
  });

  it('should be possible do properly reference array items', () => {
    const willHaveBeenSeen = z.object({ hello: z.string() });
    const unionSchema = z.union([willHaveBeenSeen, willHaveBeenSeen]);
    const arraySchema = z.array(unionSchema);
    const jsonSchema = parseArrayDef(arraySchema._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      items: {
        anyOf: [
          {
            additionalProperties: false,
            properties: {
              hello: {
                type: 'string',
              },
            },
            required: ['hello'],
            type: 'object',
          },
          {
            $ref: '#/items/anyOf/0',
          },
        ],
      },
      type: 'array',
    } satisfies JSONSchema7);
  });
});
