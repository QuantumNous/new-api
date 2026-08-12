import { describe, it, expect } from 'vitest';
import { z } from 'zod/v3';
import { parseIntersectionDef } from './intersection';
import { getRefs } from '../refs';
import type { JSONSchema7 } from '@ai-sdk/provider';

describe('intersection', () => {
  it('should be possible to use intersections', () => {
    const intersection = z.intersection(z.string().min(1), z.string().max(3));

    const jsonSchema = parseIntersectionDef(intersection._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      allOf: [
        {
          type: 'string',
          minLength: 1,
        },
        {
          type: 'string',
          maxLength: 3,
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should be possible to deref intersections', () => {
    const schema = z.string();
    const intersection = z.intersection(schema, schema);
    const jsonSchema = parseIntersectionDef(intersection._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      allOf: [
        {
          type: 'string',
        },
        {
          $ref: '#/allOf/0',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should return `unevaluatedProperties` only if all of the multiple sub-schemas have additionalProperties set to false', () => {
    const schema1 = z.object({
      foo: z.string(),
    });
    const schema2 = z.object({
      bar: z.string(),
    });
    const schema3 = z
      .object({
        baz: z.string(),
      })
      .passthrough();
    const intersection = schema1.and(schema2).and(schema3);
    const jsonSchema = parseIntersectionDef(intersection._def, getRefs());

    expect(jsonSchema).toStrictEqual({
      allOf: [
        {
          properties: {
            foo: {
              type: 'string',
            },
          },
          required: ['foo'],
          type: 'object',
        },
        {
          properties: {
            bar: {
              type: 'string',
            },
          },
          required: ['bar'],
          type: 'object',
        },
        {
          additionalProperties: true,
          properties: {
            baz: {
              type: 'string',
            },
          },
          required: ['baz'],
          type: 'object',
        },
      ],
    } satisfies JSONSchema7);
  });
});
