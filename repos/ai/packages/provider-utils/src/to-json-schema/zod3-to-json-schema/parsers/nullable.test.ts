import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseObjectDef } from './object';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('nullable', () => {
  it('should be possible to properly reference nested nullable primitives', () => {
    const nullablePrimitive = z.string().nullable();

    const schema = z.object({
      one: nullablePrimitive,
      two: nullablePrimitive,
    });

    const jsonSchema: any = parseObjectDef(schema._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      additionalProperties: false,
      type: 'object',
      properties: {
        one: { type: ['string', 'null'] },
        two: { $ref: '#/properties/one' },
      },
      required: ['one', 'two'],
    } satisfies JSONSchema7);
  });

  it('should be possible to properly reference nested nullable primitives', () => {
    const three = z.string();

    const nullableObject = z
      .object({
        three,
      })
      .nullable();

    const schema = z.object({
      one: nullableObject,
      two: nullableObject,
      three,
    });

    const jsonSchema: any = parseObjectDef(schema._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      type: 'object',
      properties: {
        one: {
          anyOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['three'],
              properties: { three: { type: 'string' } },
            },
            { type: 'null' },
          ],
        },
        two: { $ref: '#/properties/one' },
        three: { $ref: '#/properties/one/anyOf/0/properties/three' },
      },
      required: ['one', 'two', 'three'],
      additionalProperties: false,
    } satisfies JSONSchema7);
  });
});
